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
 *   FX_PAGE_SMOKE_DUMP 设置后把每个用例的页面与 DOM 落盘到 /tmp，便于排查。
 *
 * 退出码：0 通过 / 1 断言失败 / 2 环境问题（没有浏览器、浏览器启动失败、页面没跑出结果）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBrowser, runHeadless } from './browser.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CLI_ARGS = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SCRIPT = resolve(CLI_ARGS[0] || join(ROOT, 'faxuanyun-legal-exam-assistant.user.js'));
const REQUIRE_BROWSER = process.argv.includes('--require-browser') || process.env.FX_REQUIRE_BROWSER === '1';
const FIXTURES = join(ROOT, 'tests', 'fixtures');
const DUMP = process.env.FX_PAGE_SMOKE_DUMP === '1' || !!process.env.FX_PAGE_SMOKE_DUMP;

// 六个用例的断言总数（README 徽章 / CHANGELOG 验证方式都写这个数）。
// 每个用例在 CASES 里另有 expectCount；父进程会核对运行时 total 与这里的常量一致，
// tools/selftest.mjs 也会数这一行并检查 README / CHANGELOG 是否同步，避免改了 fixture
// 却忘记更新文档。改断言时先改这里，再跑一遍确认运行时总数一致。
const EXPECTED_ASSERTIONS = 72;

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
    return `
window.__store = new Map();
window.GM_info = { script: { version: '9.9.9', name: 'page-smoke' } };
window.GM_getValue = function (k, d) { return window.__store.has(k) ? window.__store.get(k) : d; };
window.GM_setValue = function (k, v) { window.__store.set(k, v); };
window.GM_addStyle = function () { return document.createElement('style'); };
window.GM_addValueChangeListener = function () { return 0; };
(function () {
  var cfg = ${JSON.stringify({ answers: cfg.answers || [], store: cfg.store || {} })};
  for (var k in cfg.store) window.__store.set(k, cfg.store[k]);
  window.__fxNet = [];
  window.__fxAnswers = cfg.answers;
  window.GM_xmlhttpRequest = function (o) {
    var url = String((o && o.url) || '');
    window.__fxNet.push(url);
    var m = url.match(/[?&]wd=([^&]*)/);
    var wd = m ? decodeURIComponent(m[1]) : '';
    var ans = '';
    for (var i = 0; i < cfg.answers.length; i++) {
      if (wd.indexOf(cfg.answers[i].clue) >= 0) { ans = cfg.answers[i].answer; break; }
    }
    var responseText;
    if (ans) {
      var filler = '';
      for (var j = 0; j < 20; j++) filler += '根据相关法律法规的规定，本选项符合法定情形，故选择该答案。';
      responseText = '<html><body><div class="result c-container"><h3 class="t">题目答案与解析</h3>'
        + '<div class="c-abstract">参考答案：' + ans + '。' + filler + '</div></div></body></html>';
    } else {
      responseText = '<html><body><div class="result c-container">没有找到该题的答案</div></body></html>';
    }
    setTimeout(function () { if (o && o.onload) o.onload({ status: 200, responseText: responseText }); }, 0);
    return { abort: function () { } };
  };
})();
`;
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

    if (CFG.scenario === 'result') {
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
  out.textContent = 'FX_RESULT ' + JSON.stringify({ case: CFG.case, pass: R.length - failed.length, total: R.length, expectCount: CFG.expectCount, failed: failed });
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

function unescapeDom(s) {
    return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

let pass = 0, total = 0, fatal = 0;
const failures = [];
console.log(`页面适配冒烟测试：用 ${BROWSERS} 跑 ${CASES.length} 个脱敏页面…\n`);
for (const c of CASES) {
    let dom = '';
    try {
        const html = buildPage(c);
        const run = runHeadless(BROWSERS, html, { prefix: 'fx-page-smoke-', budgetMs: c.budgetMs });
        dom = run.dom;
        if (DUMP) {
            writeFileSync(join('/tmp', 'fx-page-smoke-' + c.file + '.html'), html, 'utf8');
            writeFileSync(join('/tmp', 'fx-page-smoke-' + c.file + '.dom.html'), dom, 'utf8');
        }
    } catch (e) {
        fatal++;
        console.error(`  ✗ ${c.name}：浏览器运行失败 ${e.message}`);
        continue;
    }
    const m = dom.match(/FX_RESULT (\{.*?\})<\/div>/s);
    if (!m) {
        fatal++;
        console.error(`  ✗ ${c.name}：页面里没有跑出 FX_RESULT（驱动脚本可能抛异常，或用例页面与脚本不匹配）`);
        if (!DUMP) console.error('    排查：FX_PAGE_SMOKE_DUMP=1 node tools/page-smoke.mjs --require-browser');
        continue;
    }
    const r = JSON.parse(unescapeDom(m[1]));
    if (r.case !== c.case || r.expectCount !== c.expectCount || r.total !== c.expectCount) {
        fatal++;
        console.error(`  ✗ ${c.name}：结构化结果与用例声明不符（case=${r.case}，total=${r.total}，expectCount=${r.expectCount}/${c.expectCount}）`);
        continue;
    }
    pass += r.pass;
    total += r.total;
    console.log(`__FX_SMOKE__ ${JSON.stringify({ case: c.case, pass: r.pass, total: r.total, expectCount: c.expectCount })}`);
    const mark = r.pass === r.total ? '✓' : '✗';
    console.log(`  ${mark} ${c.name}：${r.pass}/${r.total}（预期 ${c.expectCount}）`);
    for (const f of r.failed || []) {
        failures.push(`  ✗ [${c.name}] ${f.name}${f.extra ? '  → ' + f.extra : ''}`);
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
