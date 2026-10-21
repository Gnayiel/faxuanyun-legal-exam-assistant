#!/usr/bin/env node
/**
 * 页面适配冒烟测试（C4）。
 *
 * 与 panel-smoke.mjs 的分工：
 *   - panel-smoke：只带用户脚本、不带站点 DOM，测面板 UI 是否完整；
 *   - page-smoke ：在脱敏的「法宣在线」考试页 / 成绩页上同时加载用户脚本，测站点适配层
 *     ——题干、选项、题型、题数、按钮能不能认出来，作答后页面的选中态对不对。
 *
 * 做法：读 tests/fixtures/*.html，在 </body> 前依次注入
 *   ① GM_* 打桩（含一个返回「百度搜索结果页」的 GM_xmlhttpRequest，不联网）
 *   ② 用户脚本
 *   ③ 断言驱动脚本（把结果写进 #fx-out 的 FX_RESULT 行）
 * 然后用 headless Edge/Chrome 打开这个临时页面，从 --dump-dom 里取回断言结果。
 *
 * 用法：
 *   node tools/page-smoke.mjs [用户脚本路径] [--require-browser]
 *
 *   --require-browser  找不到浏览器时失败（退出码 2）而不是跳过
 *                      对应环境变量 FX_REQUIRE_BROWSER=1；CI 用它防止「没装浏览器 → 静默跳过 → 假绿」。
 *   FX_BROWSER         指定浏览器（绝对路径或 PATH 里的命令名），见 ./browser.mjs。
 *   FX_PAGE_SMOKE_DUMP 设置后把每个用例的页面与 DOM 落盘到系统临时目录，便于排查。
 *
 * 退出码：0 通过 / 1 断言失败 / 2 环境问题（没有浏览器、浏览器启动失败、页面没跑出结果）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser, runHeadless } from './browser.mjs';
import { gmCore, fakeBaidu, fakeAI } from './_harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CLI_ARGS = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SCRIPT = resolve(CLI_ARGS[0] || join(ROOT, 'faxuanyun-legal-exam-assistant.user.js'));
const REQUIRE_BROWSER = process.argv.includes('--require-browser') || process.env.FX_REQUIRE_BROWSER === '1';
const FIXTURES = join(ROOT, 'tests', 'fixtures');
const DUMP = process.env.FX_PAGE_SMOKE_DUMP === '1' || !!process.env.FX_PAGE_SMOKE_DUMP;

// 九个用例的断言总数（README 徽章 / CHANGELOG 验证方式都写这个数）。
// 每个用例在 CASES 里另有 expectCount；父进程会核对运行时 total 与这里的常量一致，
// tools/selftest.mjs 也会数这一行并检查 README / CHANGELOG 是否同步，避免改了 fixture
// 却忘记更新文档。改断言时先改这里，再跑一遍确认运行时总数一致。
const EXPECTED_ASSERTIONS = 135; // 105 + 15（AI JSON/代码块）+ 15（AI 解释文字/失败降级/强制二源）

// 与用户脚本完全一致的题干归一化 / 主键算法：给「本地题库」用例预置键，保证命中的是
// 精确键（而不是旧记录 / 模糊匹配），从而能断言 bankHow === 'exact'。
function normStem(s) {
    return String(s || '')
        .replace(/^\s*\d{1,3}\s*[、.．)）]\s*/, '')
        .replace(/[（(]\s*(单选|多选|判断)题?\s*[）)]/g, '')
        .replace(/\s+/g, '')
        .toLowerCase()
        .replace(/[，,。.；;：:！!？?“”"'‘’（）()【】\[\]《》〈〉、\-—_~·…|｜]/g, '');
}
function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0') + str.length.toString(36);
}
const fpKey = stem => '#' + hash32(normStem(stem));

const BANK_STEM_1 = '1、限制人身自由的行政处罚权，只能由（ ）行使。';
const BANK_STEM_2 = '2、行政诉讼中，对被诉行政行为的合法性承担举证责任的是（ ）。';
const BANK_KEY_1 = fpKey(BANK_STEM_1);
const BANK_KEY_2 = fpKey(BANK_STEM_2);

// 浏览器探测复用了 panel-smoke 抽出来的 ./browser.mjs（FX_BROWSER → 常见安装路径 → PATH）。
const BROWSERS = findBrowser();
if (!BROWSERS) {
    console.log('未找到 Edge / Chrome，跳过页面适配冒烟测试。');
    console.log('（设置 FX_BROWSER 指向浏览器可执行文件；CI 里用 --require-browser 让缺浏览器直接失败）');
    if (REQUIRE_BROWSER) {
        console.error('页面适配冒烟测试要求浏览器（--require-browser），但没有找到 Edge / Chrome。');
        process.exit(2);
    }
    process.exit(0);
}

const userscript = readFileSync(SCRIPT, 'utf8');
if (userscript.includes('</script') || userscript.includes('<!--')) {
    console.error('用户脚本里含有 </script 或 <!--，无法安全内联进测试页面。');
    process.exit(2);
}
const readFixture = name => readFileSync(join(FIXTURES, name), 'utf8');

/** GM_* 打桩 + 假的百度搜索接口（全部离线，记录请求 URL 供断言「没有联网」） */
function stubScript(cfg) {
    // 打桩拆到 ./_harness.mjs：核心 GM_* + 离线假百度接口，两边冒烟共用同一份实现
    return `${gmCore({ name: 'page-smoke' })}
${fakeBaidu({ answers: cfg.answers || [], store: cfg.store || {}, delayMs: cfg.delayMs || 0 })}
${fakeAI({ responses: cfg.aiResponses || [], store: cfg.store || {}, delayMs: cfg.aiDelayMs || 0 })}`;
}

/** 页面内断言驱动：让用户脚本按真实流程自动跑（考试页就绪自动答题 / 成绩页自动解析），从面板日志与页面 DOM 取证据 */
function driverScript(cfg) {
    return `
(async function () {
  var R = [];
  var ok = function (name, cond, extra) {
    R.push({ name: name, pass: !!cond, extra: extra === undefined ? '' : String(extra).slice(0, 500) });
  };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var CFG = ${JSON.stringify(cfg)};
  var lines = [];
  var host = null, root = null, $ = null;
  var waitFor = async function (fn, what, tries) {
    for (var i = 0; i < (tries || 2400); i++) { var v = fn(); if (v) return v; await sleep(25); }
    throw new Error('等待超时：' + what);
  };
  var collect = function () {
    var box = $('fx-log');
    if (!box) return;
    var kids = box.children;
    for (var i = 0; i < kids.length; i++) {
      var t = kids[i].textContent || '';
      if (lines.indexOf(t) < 0) lines.push(t);
    }
  };
  try {
    host = await waitFor(function () { return document.getElementById('fx-panel-host'); }, '面板宿主');
    root = host.shadowRoot;
    ok('用户脚本已注入并建立面板', !!root);
    $ = function (id) { return root && root.getElementById(id); };
    collect();
    if ($('fx-log') && typeof MutationObserver === 'function') new MutationObserver(collect).observe($('fx-log'), { childList: true });
    var has = function (re) { return lines.some(function (t) { return re.test(t); }); };
    var tail = function () { return lines.slice(-6).join(' | '); };
    var currentChecked = function () {
      var inputs = document.querySelectorAll('input[name="option"]:checked');
      var out = [];
      for (var i = 0; i < inputs.length; i++) out.push(inputs[i].value);
      return out.sort().join('');
    };
    var done = function () { return has(/答题完成|已答满|⏹️ 已停止|已是最后一题|未找到「下一题」/); };

    if (CFG.scenario === 'persist') {
      await waitFor(done, '第一页答题结束');
      await sleep(200);
      // 自动答题只写 pendingSession；题库要等交卷判定或用户手改才落盘。
      // 这里模拟一次手动作答（B→A），既走真实事件链，也能让 saveUserAnswer 立刻写入题库。
      var aOpt = document.querySelector('input[name="option"][value="A"]');
      if (aOpt) aOpt.click();
      await sleep(500);
      collect();
      var pb = window.__store.get('questionBank') || {};
      var pkeys = Object.keys(pb);
      ok('第一页答题后题库已落盘', pkeys.length === 1, '题库条数：' + pkeys.length + ' | ' + tail());
      window.__FX_STORE__ = { questionBank: pb };
    } else if (CFG.scenario === 'persist-reload') {
      var rb = window.__store.get('questionBank') || {};
      ok('第二页加载后仍能读到第一页的题库', Object.keys(rb).length === 1, '题库条数：' + Object.keys(rb).length);
      await waitFor(done, '第二页答题结束');
      await sleep(300);
      collect();
      ok('第二页从本地题库精确命中（不查百度）', has(/📚 题库命中（精确·[^）]+）：A/), tail());
      var rnet = window.__fxNet || [];
      ok('第二页零联网（题库精确命中）', rnet.length === 0, rnet.slice(0, 3).join(' | '));
      var rs = window.__store.get('pendingSession');
      var rh = rs && rs.history ? rs.history : [];
      ok('第二页只写入一条作答记录且答案正确',
        rh.length === 1 && rh[0].letters === 'A' && rh[0].type === 'judge',
        rh.length ? JSON.stringify(rh.map(function (h) { return { n: h.qNum, letters: h.letters, type: h.type }; })) : '没有 pendingSession');
      ok('第二页页面选中态正确（A）', currentChecked() === 'A', '实际选中：' + currentChecked());
    } else if (CFG.scenario === 'race') {
      await waitFor(function () { return has(/📝 第1题/); }, '开始查答案');
      var stopBtn = $('fx-stop');
      if (stopBtn) stopBtn.click();
      await sleep(120);
      collect();
      ok('停止按钮立即生效', has(/⏹️ 已停止/), tail());
      // 同一个按钮在停止后就是「开始」：再点一次即从当前题继续
      if (stopBtn) stopBtn.click();
      await waitFor(function () { return has(/答题完成|已是最后一题/); }, '重新开始后完成答题');
      await sleep(400);
      collect();
      ok('重新开始后完成答题', has(/答题完成|已是最后一题/), tail());
      var clicks = window.__clicks || [];
      ok('停止/重开只点击一次选项', clicks.length === 1, '点击次数：' + clicks.length);
      var raceSess = window.__store.get('pendingSession');
      var raceHist = raceSess && raceSess.history ? raceSess.history : [];
      ok('停止/重开只写入一条作答记录',
        raceHist.length === 1 && raceHist[0].letters === 'B' && raceHist[0].type === 'judge',
        raceHist.length ? JSON.stringify(raceHist.map(function (h) { return { n: h.qNum, letters: h.letters, type: h.type }; })) : '没有 pendingSession');
      // 自动答题只写 pendingSession；再模拟一次手动作答，让题库落盘后断言只有一条。
      var raceOpt = document.querySelector('input[name="option"][value="A"]');
      if (raceOpt) raceOpt.click();
      // 落盘是异步的（Web Locks 需要排队），等脏数据真正写进 GM 存储再断言，避免固定 sleep 竞态。
      try {
        await waitFor(function () {
          return Object.keys(window.__store.get('questionBank') || {}).length > 0;
        }, '停止/重开后题库落盘', 120);
      } catch (e) { collect(); }
      await sleep(100);
      var raceBank = window.__store.get('questionBank') || {};
      ok('停止/重开只入库一条', Object.keys(raceBank).length === 1, '题库条数：' + Object.keys(raceBank).length + ' | 锁：' + JSON.stringify(window.__store.get('fxWriteLock')) + ' | ' + tail());
      ok('最终页面选中态正确（A）', currentChecked() === 'A', '实际选中：' + currentChecked());
    } else if (CFG.scenario === 'result') {
      ok('成绩页 fixture 就位（分数与弹窗答题卡）', !!document.querySelector('.layui-layer .answer-card'));
      // 成绩页是「打开面板后自动识别 + 延迟解析」的，不点按钮，等它自己跑完
      await waitFor(function () { return has(/📊 题库现有|成绩解析完成|成绩解析异常|不像成绩页|解析成绩失败/); }, '成绩解析结束');
      await sleep(300);
      collect();
      ok('识别到成绩页并开始解析', has(/正在解析考试结果/), tail());
      ok('答题卡题号识别到 1-5', has(/答题卡识别到 5 个题号：1, 2, 3, 4, 5/), tail());
      ok('逐题判定（对 / 错 / 未答）正确', has(/逐题明细：1✅ 2✅ 3❌ 4❌ 5⬜/), tail());
      ok('答对题号正确（1, 2）', has(/答对 2 题：1, 2/), tail());
      ok('答错题号正确（3, 4）', has(/答错 2 题：3, 4/), tail());
      ok('未答题号正确（5）', has(/未答 1 题：5/), tail());
      ok('分数 / 总分 / 正确率解析正确（40 / 100 / 40%）', has(/🎯 分数 40 \\/ 100 分 · 正确率 40%（2\\/5）/), tail());
      ok('题库统计正常（空库 0 题）', has(/📊 题库现有 0 题/), tail());
    } else if (CFG.scenario === 'judge') {
      ok('页面作答记录器就位（fixture 脚本已注入）', Array.isArray(window.__picks));
      await waitFor(function () { return has(/答题完成|已答满|⛔ 已停止|未找到「下一题」/); }, '答题流程结束');
      for (var j = 0; j < 200 && !has(/答题完成|已停止/); j++) await sleep(25);
      collect();
      var J = CFG.expect, qj = J.q1;
      ok('页面就绪后自动开始答题', has(/页面就绪，开始答题/), tail());
      ok('从页面题型统计推断出总题数 1', has(new RegExp(J.totalRe)), tail());
      ok('第 1 题题干与题型识别（' + qj.typeLabel + '）', has(new RegExp('第1题（' + qj.typeLabel + '）：[^|]*' + qj.stemPart)), tail());
      ok('第 1 题采用打桩的百度答案（' + qj.answer + '）', has(new RegExp('采用百度答案：' + qj.answer)), tail());
      var jchecked = currentChecked();
      ok('第 1 题页面选中态正确（' + qj.answer + '）', jchecked === qj.answer.split('').sort().join(''), '实际选中：' + jchecked);
      ok('无「下一题」时答完一题即收工', has(/未找到「下一题」按钮，可能已是最后一题/) && has(/答题完成！共答 1 题，请检查后点击交卷/), tail());
      var jsess = window.__store.get('pendingSession');
      var jhist = jsess && jsess.history ? jsess.history : [];
      var jhistOk = jhist.length === 1 && jhist[0].letters === qj.answer && jhist[0].type === qj.saveType;
      ok('作答记录写入本地会话（答案 / 题型 / 题干）', jhistOk, jhist.length ? JSON.stringify(jhist.map(function (h) { return { n: h.qNum, letters: h.letters, type: h.type }; })) : '没有 pendingSession');
      var jtxt = jhist.length ? String(jhist[0].pickedText || '') : '';
      ok('作答记录里的选项文本与页面一致', qj.pickedHas.every(function (s) { return jtxt.indexOf(s) >= 0; }), jtxt || '没有 pendingSession');
      var jnet = window.__fxNet || [];
      ok('只走打桩的百度接口（1 次请求，未联网）',
        jnet.length === 1 && jnet.every(function (u) { return /^https:\\/\\/www\\.baidu\\.com\\/s\\?wd=/.test(u); }),
        jnet.slice(0, 3).join(' | '));
    } else if (CFG.scenario === 'answer-card') {
      var wrap = document.getElementById('card-wrap');
      ok('答题卡页 fixture 就位（答题卡默认收起）',
        !!document.querySelector('.answer-card') && !!wrap && getComputedStyle(wrap).display === 'none');
      await waitFor(function () { return has(/答题卡上没识别到任何对错标记/); }, '首轮空答题卡提示');
      collect();
      ok('识别到成绩页并自动开始解析', has(/检测到考试结果页，自动解析成绩/), tail());
      ok('首轮扫描不到判定时给出提示', has(/答题卡上没识别到任何对错标记，本次不入库/), tail());
      ok('提示页面上的「查看解析」入口', has(/页面上有「查看解析」入口/), tail());
      document.getElementById('card-open').click();
      await waitFor(function () { return has(/看到你点开答题卡入口/); }, '入口点击后的自动重解析提示', 400);
      collect();
      ok('点击入口后触发「2 秒后自动再解析」', has(/看到你点开答题卡入口，2 秒后自动再解析一次/), tail());
      await waitFor(function () { return has(/📊 题库现有|成绩解析完成|成绩解析异常/); }, '自动重解析结束');
      await sleep(300);
      collect();
      ok('展开后答题卡题号识别到 1-4', has(/答题卡识别到 4 个题号：1, 2, 3, 4/), tail());
      ok('逐题判定（类名 / 背景色两条路径）正确', has(/逐题明细：1✅ 2✅ 3❌ 4❌/), tail());
      ok('答对题号正确（1, 2）', has(/答对 2 题：1, 2/), tail());
      ok('无分数时按答对 / 总题数算正确率（50%）', has(/🎯 正确率 50%（2\\/4）/), tail());
      ok('题库统计正常（空库 0 题）', has(/📊 题库现有 0 题/), tail());
    } else if (CFG.scenario === 'result-no-total') {
      ok('无总分成绩页 fixture 就位（有分数 / 无总分）',
        !!document.querySelector('.layui-layer .answer-card')
        && document.body.innerText.indexOf('总分') < 0
        && document.body.innerText.indexOf('您的分数：80 分') >= 0);
      await waitFor(function () { return has(/📊 题库现有|成绩解析完成|成绩解析异常/); }, '成绩解析结束');
      await sleep(300);
      collect();
      ok('识别到成绩页并开始解析', has(/正在解析考试结果/), tail());
      ok('答题卡题号识别到 1-5', has(/答题卡识别到 5 个题号：1, 2, 3, 4, 5/), tail());
      ok('逐题判定（4 对 1 错）正确', has(/逐题明细：1✅ 2✅ 3✅ 4✅ 5❌/), tail());
      ok('答对题号正确（1, 2, 3, 4）', has(/答对 4 题：1, 2, 3, 4/), tail());
      ok('答错题号正确（5）', has(/答错 1 题：5/), tail());
      ok('总分缺失时分数行不拼「/ 总分」', has(/🎯 分数 80 分 · 正确率 80%（4\\/5）/) && !has(/分数 80 \\/ /), tail());
      ok('总分缺失时不做「分数推算题数」交叉校验', !has(/分数与答题卡对不上/), tail());
      ok('题库统计正常（空库 0 题）', has(/📊 题库现有 0 题/), tail());
    } else if (CFG.scenario === 'ai') {
      ok('页面作答记录器就位（fixture 脚本已注入）', Array.isArray(window.__picks));
      await waitFor(done, '答题流程结束');
      for (var ai = 0; ai < 200 && !has(/答题完成|已停止/); ai++) await sleep(25);
      collect();
      var A = CFG.expect, a1 = A.q1, a2 = A.q2;
      ok('页面就绪后自动开始答题', has(/页面就绪，开始答题/), tail());
      ok('从页面题型统计推断出总题数 2', has(new RegExp(A.totalRe)), tail());
      ok('第 1 题题干与题型识别（' + a1.typeLabel + '）', has(new RegExp('第1题（' + a1.typeLabel + '）：[^|]*' + a1.stemPart)), tail());
      ok('第 1 题采用 ' + a1.source + ' 答案（' + a1.answer + '）',
        lines.some(function (t) { return t.indexOf('采用' + a1.source + '答案：' + a1.answer) >= 0; }), tail());
      var apicks = window.__picks || [];
      var achecked1 = apicks[0] ? apicks[0].checked.slice().sort().join('') : '';
      ok('第 1 题页面选中态正确（' + a1.answer + '）', achecked1 === a1.answer.split('').sort().join(''), '实际选中：' + achecked1);
      ok('已切换到第 2 题', has(/已切到第 2 题/), tail());
      ok('第 2 题题干与题型识别（' + a2.typeLabel + '）', has(new RegExp('第2题（' + a2.typeLabel + '）：[^|]*' + a2.stemPart)), tail());
      ok('第 2 题采用 ' + a2.source + ' 答案（' + a2.answer + '）',
        lines.some(function (t) { return t.indexOf('采用' + a2.source + '答案：' + a2.answer) >= 0; }), tail());
      var achecked2 = currentChecked();
      ok('第 2 题页面选中态正确（' + a2.answer + '）', achecked2 === a2.answer.split('').sort().join(''), '实际选中：' + achecked2);
      var asess = window.__store.get('pendingSession');
      var ahist = asess && asess.history ? asess.history : [];
      var ahistOk = ahist.length === 2
        && ahist[0].letters === a1.answer && ahist[1].letters === a2.answer
        && ahist[0].type === a1.saveType && ahist[1].type === a2.saveType;
      ok('作答记录共 2 条且答案 / 题型正确', ahistOk,
        ahist.length ? JSON.stringify(ahist.map(function (h) { return { n: h.qNum, letters: h.letters, type: h.type }; })) : '没有 pendingSession');
      var aModes = (window.__fxAIModes || []).join(',');
      ok('AI 响应形态覆盖：' + A.modes.join(' / '), aModes === A.modes.join(','), '实际：' + aModes);
      var aAiN = (window.__fxAIRequests || []).length, aBaiduN = (window.__fxNet || []).length;
      ok('网络请求数符合预期（AI ' + A.aiReqs + ' / 百度 ' + A.baiduReqs + '）',
        aAiN === A.aiReqs && aBaiduN === A.baiduReqs,
        '实际 AI=' + aAiN + '，百度=' + aBaiduN + '；' + (window.__fxNet || []).slice(0, 3).join(' | '));
      ok('最后一题判定与收尾文案正确',
        has(/已是最后一题（已答 2\\/2 题）/) && has(/答题完成！共答 2 题，请检查后点击交卷/), tail());
    } else if (CFG.scenario === 'bank') {
      ok('页面作答记录器就位（fixture 脚本已注入）', Array.isArray(window.__picks));
      await waitFor(function () { return has(/答题完成|已答满|⛔ 已停止|已是最后一题/); }, '答题流程结束');
      for (var b = 0; b < 200 && !has(/答题完成|已停止/); b++) await sleep(25);
      collect();
      var B = CFG.expect, b1 = B.q1, b2 = B.q2;
      ok('页面就绪后自动开始答题', has(/页面就绪，开始答题/), tail());
      ok('从页面题型统计推断出总题数 2', has(new RegExp(B.totalRe)), tail());
      ok('第 1 题题干与题型识别（' + b1.typeLabel + '）', has(new RegExp('第1题（' + b1.typeLabel + '）：[^|]*' + b1.stemPart)), tail());
      ok('第 1 题本地题库精确命中（不查百度）', has(/📚 题库命中（精确·脚本）：B/), tail());
      var bchecked1 = window.__picks && window.__picks[0] ? window.__picks[0].checked.slice().sort().join('') : '';
      ok('第 1 题页面选中态正确（' + b1.answer + '）', bchecked1 === b1.answer.split('').sort().join(''), '实际选中：' + bchecked1);
      var bsess = window.__store.get('pendingSession');
      var bhist = bsess && bsess.history ? bsess.history : [];
      ok('第 1 题作答记录命中方式为 exact 且键正确',
        !!bhist[0] && bhist[0].bankHow === 'exact' && bhist[0].bankKey === B.keys[0],
        bhist[0] ? JSON.stringify({ how: bhist[0].bankHow, key: bhist[0].bankKey }) : '没有 pendingSession');
      ok('已切换到第 2 题', has(/已切到第 2 题/), tail());
      ok('第 2 题题干与题型识别（' + b2.typeLabel + '）', has(new RegExp('第2题（' + b2.typeLabel + '）：[^|]*' + b2.stemPart)), tail());
      ok('第 2 题本地题库精确命中（不查百度）', has(/📚 题库命中（精确·脚本）：B/), tail());
      var bchecked2 = currentChecked();
      ok('第 2 题页面选中态正确（' + b2.answer + '）', bchecked2 === b2.answer.split('').sort().join(''), '实际选中：' + bchecked2);
      ok('第 2 题作答记录命中方式为 exact 且键正确',
        !!bhist[1] && bhist[1].bankHow === 'exact' && bhist[1].bankKey === B.keys[1],
        bhist[1] ? JSON.stringify({ how: bhist[1].bankHow, key: bhist[1].bankKey }) : '没有 pendingSession');
      var bnet = window.__fxNet || [];
      ok('全程零联网（题库精确命中，没有调用百度）', bnet.length === 0, bnet.slice(0, 3).join(' | '));
      var bhistOk = bhist.length === 2 && bhist[0].letters === b1.answer && bhist[1].letters === b2.answer
        && bhist[0].type === b1.saveType && bhist[1].type === b2.saveType;
      ok('作答记录共 2 条且答案 / 题型正确', bhistOk,
        bhist.length ? JSON.stringify(bhist.map(function (h) { return { n: h.qNum, letters: h.letters, type: h.type }; })) : '没有 pendingSession');
      ok('最后一题判定与收尾文案正确',
        has(/已是最后一题（已答 2\\/2 题）/) && has(/答题完成！共答 2 题，请检查后点击交卷/), tail());
      // P3：验证按钮缓存只对按钮相关 DOM 变化失效；考试页倒计时每秒刷新普通文本，不应重建整表。
      var cacheV0 = window.__FX_TEST__.buttonCacheVersion();
      var clock = document.createElement('span');
      clock.textContent = '00:01';
      document.body.appendChild(clock);
      await sleep(40);
      var cacheV1 = window.__FX_TEST__.buttonCacheVersion();
      if (clock.firstChild) clock.firstChild.data = '00:02';
      await sleep(40);
      var cacheV2 = window.__FX_TEST__.buttonCacheVersion();
      ok('倒计时文本刷新不重建按钮缓存', cacheV1 === cacheV0 && cacheV2 === cacheV1,
        'domVer ' + cacheV0 + '→' + cacheV1 + '→' + cacheV2);
      var probe = document.createElement('button');
      probe.textContent = '缓存探针';
      document.body.appendChild(probe);
      await sleep(40);
      var cacheV3 = window.__FX_TEST__.buttonCacheVersion();
      probe.textContent = '缓存探针 2';
      await sleep(40);
      var cacheV4 = window.__FX_TEST__.buttonCacheVersion();
      ok('按钮文本变化会重建按钮缓存', cacheV3 > cacheV2 && cacheV4 > cacheV3,
        'domVer ' + cacheV2 + '→' + cacheV3 + '→' + cacheV4);
    } else {
      ok('页面作答记录器就位（fixture 脚本已注入）', Array.isArray(window.__picks));
      // 考试页是「页面就绪后自动开始」的（面板初始化的就绪探测会调 mainLoop），不点按钮
      await waitFor(function () { return has(/答题完成|已答满|⛔ 已停止|已是最后一题/); }, '答题流程结束');
      for (var i = 0; i < 200 && !has(/答题完成|已停止/); i++) await sleep(25);
      collect();
      var E = CFG.expect, q1 = E.q1, q2 = E.q2;
      ok('页面就绪后自动开始答题', has(/页面就绪，开始答题/), tail());
      ok('从页面题型统计推断出总题数 2', has(new RegExp(E.totalRe)), tail());
      ok('第 1 题题干与题型识别（' + q1.typeLabel + '）', has(new RegExp('第1题（' + q1.typeLabel + '）：[^|]*' + q1.stemPart)), tail());
      ok('第 1 题采用打桩的百度答案（' + q1.answer + '）', has(new RegExp('采用百度答案：' + q1.answer)), tail());
      var p0 = window.__picks && window.__picks[0];
      var p0letters = p0 ? p0.checked.slice().sort().join('') : '';
      ok('第 1 题页面选中态正确（' + q1.answer + '）', p0letters === q1.answer.split('').sort().join(''), '实际选中：' + p0letters);
      ok('已切换到第 2 题', has(/已切到第 2 题/), tail());
      ok('第 2 题题干与题型识别（' + q2.typeLabel + '）', has(new RegExp('第2题（' + q2.typeLabel + '）：[^|]*' + q2.stemPart)), tail());
      ok('第 2 题采用打桩的百度答案（' + q2.answer + '）', has(new RegExp('采用百度答案：' + q2.answer)), tail());
      var q2checked = currentChecked();
      ok('第 2 题页面选中态正确（' + q2.answer + '）', q2checked === q2.answer.split('').sort().join(''), '实际选中：' + q2checked);
      ok('最后一题判定与收尾文案正确', has(/已是最后一题（已答 2\\/2 题）/) && has(/答题完成！共答 2 题，请检查后点击交卷/), tail());
      var sess = window.__store.get('pendingSession');
      var hist = sess && sess.history ? sess.history : [];
      var histOk = hist.length === 2;
      if (histOk) {
        histOk = hist[0].letters === q1.answer && hist[1].letters === q2.answer
          && hist[0].type === q1.saveType && hist[1].type === q2.saveType;
      }
      ok('作答记录写入本地会话（答案 / 题型 / 题干）', histOk, hist.length ? JSON.stringify(hist.map(function (h) { return { n: h.qNum, letters: h.letters, type: h.type }; })) : '没有 pendingSession');
      var pickedOk = hist.length === 2;
      if (pickedOk) {
        var txt = String(hist[0].pickedText || '');
        pickedOk = q1.pickedHas.every(function (s) { return txt.indexOf(s) >= 0; })
          && String(hist[1].pickedText || '').indexOf(q2.pickedHas[0]) >= 0;
      }
      ok('作答记录里的选项文本与页面一致', pickedOk, hist.length ? String(hist[0].pickedText || '') : '没有 pendingSession');
      var net = window.__fxNet || [];
      ok('只走打桩的百度接口（' + net.length + ' 次请求，未联网）',
        net.length >= 2 && net.every(function (u) { return /^https:\\/\\/www\\.baidu\\.com\\/s\\?wd=/.test(u); }),
        net.slice(0, 3).join(' | '));
    }
  } catch (e) {
    R.push({ name: '运行期异常', pass: false, extra: String((e && e.stack) || e).split('\\n').slice(0, 4).join(' | ') });
  }
  var failed = R.filter(function (r) { return !r.pass; });
  var out = document.getElementById('fx-out');
  if (!out) { out = document.createElement('div'); out.id = 'fx-out'; document.body.appendChild(out); }
  out.textContent = 'FX_RESULT ' + JSON.stringify({ case: CFG.case, pass: R.length - failed.length, total: R.length, expectCount: CFG.expectCount, failed: failed, store: window.__FX_STORE__ || null });
})();
`;
}

/**
 * 用例清单。
 *   scenario: exam   → 点「开始」跑完整答题流程，用打桩的百度结果作答；
 *             result → 点「解析成绩」跑成绩页解析。
 *   expect 里的正则都是对面板日志的断言（日志文案由用户脚本决定，见 answerCurrent / reportResult）。
 */
const CASES = [
    {
        name: '单选题页：题干/选项/题数/按钮识别与作答',
        case: 'exam-single',
        file: 'exam-single.html',
        budgetMs: 40000,
        scenario: 'exam',
        expectCount: 15,
        store: { answerMode: 'baidu', autoCloseSec: 0 },
        answers: [
            { clue: '限制人身自由的行政处罚权', answer: 'B' },
            { clue: '举证责任', answer: 'B' },
        ],
        expect: {
            totalRe: '总题数[:：]\\s*2',
            q1: { typeLabel: '单选', stemPart: '限制人身自由的行政处罚权', answer: 'B', saveType: 'single', pickedHas: ['公安机关'] },
            q2: { typeLabel: '单选', stemPart: '举证责任', answer: 'B', saveType: 'single', pickedHas: ['被告'] },
        },
    },
    {
        name: 'AI 模式：纯 JSON / 代码块两种响应，不降级百度',
        case: 'ai-json',
        file: 'exam-single.html',
        budgetMs: 45000,
        scenario: 'ai',
        expectCount: 15,
        store: {
            answerMode: 'ai', autoCloseSec: 0, aiModel: 'smoke',
            aiUrl: 'https://api.smoke.test/v1/chat/completions', aiKey: 'sk-smoke-test',
        },
        answers: [],
        aiResponses: [
            { clue: '限制人身自由的行政处罚权', mode: 'plain', content: '{"answer":"B","confidence":0.92,"reason":"mock"}' },
            { clue: '举证责任', mode: 'code', content: '{"answer":"B","confidence":0.9,"reason":"mock"}' },
        ],
        expect: {
            totalRe: '总题数[:：]\\s*2',
            q1: { typeLabel: '单选', stemPart: '限制人身自由的行政处罚权', answer: 'B', saveType: 'single', source: 'AI', pickedHas: ['公安机关'] },
            q2: { typeLabel: '单选', stemPart: '举证责任', answer: 'B', saveType: 'single', source: 'AI', pickedHas: ['被告'] },
            modes: ['plain', 'code'], aiReqs: 2, baiduReqs: 0,
        },
    },
    {
        name: 'AI 模式：解释文字包裹 JSON + AI 失败降级百度 + 强制二源',
        case: 'ai-cross',
        file: 'exam-single.html',
        budgetMs: 50000,
        scenario: 'ai',
        expectCount: 15,
        store: {
            answerMode: 'ai', autoCloseSec: 0, aiModel: 'smoke', forceCrossCheck: true,
            aiUrl: 'https://api.smoke.test/v1/chat/completions', aiKey: 'sk-smoke-test',
        },
        answers: [
            { clue: '限制人身自由的行政处罚权', answer: 'B' },
            { clue: '举证责任', answer: 'B' },
        ],
        aiResponses: [
            { clue: '限制人身自由的行政处罚权', mode: 'explain', content: '{"answer":"B","confidence":0.9,"reason":"mock"}' },
            { clue: '举证责任', mode: 'error', status: 400 },
        ],
        expect: {
            totalRe: '总题数[:：]\\s*2',
            q1: { typeLabel: '单选', stemPart: '限制人身自由的行政处罚权', answer: 'B', saveType: 'single', source: 'AI+百度', pickedHas: ['公安机关'] },
            q2: { typeLabel: '单选', stemPart: '举证责任', answer: 'B', saveType: 'single', source: '百度', pickedHas: ['被告'] },
            modes: ['explain', 'error'], aiReqs: 2, baiduReqs: 2,
        },
    },
    {
        name: '本地题库精确命中：不联网、作答记录带 bankKey / bankHow',
        case: 'bank',
        file: 'exam-single.html',
        budgetMs: 40000,
        scenario: 'bank',
        expectCount: 18,
        store: {
            answerMode: 'baidu',
            autoCloseSec: 0,
            bankSchema: 2,
            questionBank: {
                [BANK_KEY_1]: {
                    q: BANK_STEM_1, t: 'single', s: '学法考试',
                    a: ['公安机关'], l: 'B', src: 'exam', by: '',
                    ts: 1, us: 0, hit: 0, ok: 0, bad: 0, cft: 0,
                },
                [BANK_KEY_2]: {
                    q: BANK_STEM_2, t: 'single', s: '学法考试',
                    a: ['被告'], l: 'B', src: 'exam', by: '',
                    ts: 1, us: 0, hit: 0, ok: 0, bad: 0, cft: 0,
                },
            },
        },
        answers: [],
        expect: {
            totalRe: '总题数[:：]\\s*2',
            q1: { typeLabel: '单选', stemPart: '限制人身自由的行政处罚权', answer: 'B', saveType: 'single', pickedHas: ['公安机关'] },
            q2: { typeLabel: '单选', stemPart: '举证责任', answer: 'B', saveType: 'single', pickedHas: ['被告'] },
            keys: [BANK_KEY_1, BANK_KEY_2],
        },
    },
    {
        name: '跨页持久化：第一页答题入库，第二页全新加载只读命中',
        case: 'persist',
        file: 'exam-persist.html',
        budgetMs: 40000,
        scenario: 'persist',
        expectCount: 2,
        reloadExpectCount: 6,
        twoPhase: true,
        store: { answerMode: 'baidu', autoCloseSec: 0 },
        answers: [{ clue: '行政机关作出行政处罚决定前', answer: 'B' }],
        expect: {},
    },
    {
        name: '停止后立即重开：旧循环不再点击或写入第二条记录',
        case: 'race',
        file: 'exam-race.html',
        budgetMs: 40000,
        scenario: 'race',
        expectCount: 7,
        delayMs: 600,
        store: { answerMode: 'baidu', autoCloseSec: 0 },
        answers: [{ clue: '行政机关作出行政处罚决定前', answer: 'B' }],
        expect: {},
    },
    {
        name: '多选 / 判断题页：题型识别与作答',
        case: 'exam-multi',
        file: 'exam-multi.html',
        budgetMs: 40000,
        scenario: 'exam',
        expectCount: 15,
        store: { answerMode: 'baidu', autoCloseSec: 0 },
        answers: [
            { clue: '行政处罚决定前', answer: 'AB' },
            { clue: '行政法规可以设定', answer: 'A' },
        ],
        expect: {
            totalRe: '总题数[:：]\\s*2',
            q1: { typeLabel: '多选', stemPart: '行政处罚决定前', answer: 'AB', saveType: 'multi', pickedHas: ['拟作出的行政处罚内容', '事实、理由'] },
            q2: { typeLabel: '判断', stemPart: '行政法规可以设定', answer: 'A', saveType: 'judge', pickedHas: ['对'] },
        },
    },
    {
        name: '成绩页：答题卡判定与得分统计',
        case: 'result',
        file: 'result.html',
        budgetMs: 45000,
        scenario: 'result',
        expectCount: 10,
        store: { answerMode: 'baidu', autoCloseSec: 0 },
        answers: [],
        expect: {},
    },
    {
        name: '判断题页：正确/错误选项与单题收尾',
        case: 'judge',
        file: 'exam-judge.html',
        budgetMs: 40000,
        scenario: 'judge',
        expectCount: 11,
        store: { answerMode: 'baidu', autoCloseSec: 0 },
        answers: [{ clue: '行政机关作出行政处罚决定前', answer: 'B' }],
        expect: {
            totalRe: '总题数[:：]\\s*1',
            q1: { typeLabel: '判断', stemPart: '行政机关作出行政处罚决定前', answer: 'B', saveType: 'judge', pickedHas: ['错误'] },
        },
    },
    {
        name: '答题卡页：默认收起 → 点「查看解析」自动重解析',
        case: 'answer-card',
        file: 'answer-card.html',
        budgetMs: 50000,
        scenario: 'answer-card',
        expectCount: 11,
        store: { answerMode: 'baidu', autoCloseSec: 0 },
        answers: [],
        expect: {},
    },
    {
        name: '无总分成绩页：分数照常解析、不拼「/ 总分」',
        case: 'result-no-total',
        file: 'result-no-total.html',
        budgetMs: 45000,
        scenario: 'result-no-total',
        expectCount: 10,
        store: { answerMode: 'baidu', autoCloseSec: 0 },
        answers: [],
        expect: {},
    },
];

function buildPage(c) {
    const html = readFixture(c.file);
    const injected = [
        '<script>', stubScript(c), '</script>',
        '<script>', userscript, '</script>',
        '<script>', driverScript(c), '</script>',
    ].join('\n');
    const page = html.replace('</body>', () => injected + '\n</body>');
    if (page === html) throw new Error(`fixture ${c.file} 里没有 </body>，无法注入脚本`);
    return page;
}

// 单遍解实体：先解 &amp; 再解 &lt; 会把 "&amp;lt;" 解成 "<"（CodeQL js/double-escaping）
const HTML_ENTITY = { quot: '"', amp: '&', lt: '<', gt: '>' };
function unescapeDom(s) {
    return s.replace(/&(quot|amp|lt|gt);/g, (_, e) => HTML_ENTITY[e]);
}

function runResult(c, html, tag) {
    const run = runHeadless(BROWSERS, html, { prefix: 'fx-page-smoke-', budgetMs: c.budgetMs });
    if (DUMP) {
        const stem = c.file.replace(/\.html$/, '') + (tag || '');
        writeFileSync(join(tmpdir(), 'fx-page-smoke-' + stem + '.html'), html, 'utf8');
        writeFileSync(join(tmpdir(), 'fx-page-smoke-' + stem + '.dom.html'), run.dom, 'utf8');
    }
    const m = run.dom.match(/FX_RESULT (\{.*?\})<\/div>/s);
    if (!m) throw new Error('页面里没有跑出 FX_RESULT（驱动脚本可能抛异常，或用例页面与脚本不匹配）');
    return JSON.parse(unescapeDom(m[1]));
}

let pass = 0, total = 0, fatal = 0;
const failures = [];
console.log(`页面适配冒烟测试：用 ${BROWSERS} 跑 ${CASES.length} 个脱敏页面…\n`);
for (const c of CASES) {
    try {
        const results = [{ c, r: runResult(c, buildPage(c), '') }];

        // 跨页持久化：第一页答完写入 questionBank；第二页是全新页面，只把这份题库预置回 GM 存储，
        // 断言它从精确键命中、零联网，而不是再查一次百度。
        if (c.twoPhase) {
            const first = results[0].r;
            const bank = first.store && first.store.questionBank;
            if (!bank || !Object.keys(bank).length) {
                throw new Error('第一页没有写出 questionBank，无法验证跨页持久化');
            }
            const reload = {
                ...c,
                case: c.case + '-reload',
                name: c.name + '（第二页）',
                scenario: 'persist-reload',
                expectCount: c.reloadExpectCount,
                store: { ...c.store, questionBank: bank, bankSchema: 2, pendingSession: null },
                answers: [],
            };
            results.push({ c: reload, r: runResult(reload, buildPage(reload), '-reload') });
        }

        for (const { c: cc, r } of results) {
            if (r.case !== cc.case || r.expectCount !== cc.expectCount || r.total !== cc.expectCount) {
                throw new Error(`结构化结果与用例声明不符（case=${r.case}，total=${r.total}，expectCount=${r.expectCount}/${cc.expectCount}；failed=${JSON.stringify(r.failed || []).slice(0, 1200)}）`);
            }
            pass += r.pass;
            total += r.total;
            console.log(`__FX_SMOKE__ ${JSON.stringify({ case: cc.case, pass: r.pass, total: r.total, expectCount: cc.expectCount })}`);
            const mark = r.pass === r.total ? '✓' : '✗';
            console.log(`  ${mark} ${cc.name}：${r.pass}/${r.total}（预期 ${cc.expectCount}）`);
            for (const f of r.failed || []) {
                failures.push(`  ✗ [${cc.name}] ${f.name}${f.extra ? '  → ' + f.extra : ''}`);
            }
        }
    } catch (e) {
        fatal++;
        console.error(`  ✗ ${c.name}：${e.message}`);
        if (!DUMP) console.error('    排查：FX_PAGE_SMOKE_DUMP=1 node tools/page-smoke.mjs --require-browser');
    }
}
if (total > 0 && total !== EXPECTED_ASSERTIONS) {
    failures.push(`  ✗ 断言总数与 EXPECTED_ASSERTIONS 不一致：运行时 ${total} 项，常量 ${EXPECTED_ASSERTIONS} 项`);
}
if (failures.length) {
    console.log('');
    for (const line of failures) console.log(line);
}
console.log('');
if (fatal) {
    console.error(`页面适配冒烟测试：${pass}/${total || '?'} 断言通过，但有 ${fatal} 个用例没能跑起来。`);
    process.exit(2);
}
const allOk = pass === total && total === EXPECTED_ASSERTIONS;
console.log(allOk
    ? `页面适配冒烟测试：${pass}/${total} 通过（EXPECTED_ASSERTIONS=${EXPECTED_ASSERTIONS}）  （浏览器：${BROWSERS}）`
    : `页面适配冒烟测试：${pass}/${total} 未通过（EXPECTED_ASSERTIONS=${EXPECTED_ASSERTIONS}，浏览器：${BROWSERS}）`);
process.exit(allOk ? 0 : 1);
