// 面板冒烟测试：把用户脚本内联进一个最小页面，用真实的 Chromium 内核（Edge / Chrome）
// 跑一遍「面板能不能建起来、按钮还全不全、导出文件名对不对」。
//
// 用法： node tools/panel-smoke.mjs [用户脚本路径] [--require-browser]
// 找不到浏览器时默认跳过（退出码 0），方便在没装浏览器的机器上跑；
// 加 --require-browser（或设置 FX_REQUIRE_BROWSER=1）则改为失败（退出码 2），
// CI 用它来防止「没装浏览器 → 静默跳过 → 假绿」。
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
// 参数里可能混着 --require-browser 这类开关，先滤掉再取脚本路径
const CLI_ARGS = process.argv.slice(2).filter(a => !a.startsWith('--'));
const SCRIPT = resolve(CLI_ARGS[0] || join(HERE, '..', 'faxuanyun-legal-exam-assistant.user.js'));
const REQUIRE_BROWSER = process.argv.includes('--require-browser') || process.env.FX_REQUIRE_BROWSER === '1';

const BROWSERS = [
    process.env.FX_BROWSER,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/google/chrome/chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find(p => existsSync(p));

if (!BROWSERS) {
    console.log('未找到 Edge / Chrome，跳过面板冒烟测试。');
    console.log('（想强制指定可用 FX_BROWSER=/path/to/chrome 环境变量。）');
    if (REQUIRE_BROWSER) {
        console.error('❌ 指定了 --require-browser，但没找到浏览器：面板冒烟测试无法执行。');
        process.exit(2);
    }
    process.exit(0);
}

const userscript = readFileSync(SCRIPT, 'utf8');

const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>panel smoke</title></head>
<body>
<div id="fx-out">RUNNING</div>
<script>
/* ---------- 油猴 API 打桩 ---------- */
window.__store = new Map();
window.GM_info = { script: { version: '9.9.9', name: 'smoke' } };
window.GM_getValue = (k, d) => window.__store.has(k) ? window.__store.get(k) : d;
window.GM_setValue = (k, v) => { window.__store.set(k, v); };
window.GM_addStyle = () => document.createElement('style');
window.GM_addValueChangeListener = () => 0;
window.GM_xmlhttpRequest = () => { throw new Error('冒烟测试不允许联网'); };

/* ---------- 拦截下载 ---------- */
window.__downloads = [];
URL.createObjectURL = (blob) => { window.__lastBlob = blob; return 'blob:fx/' + window.__downloads.length; };
URL.revokeObjectURL = () => {};
const realClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
    if (this.download) { window.__downloads.push({ name: this.download, size: window.__lastBlob ? window.__lastBlob.size : -1 }); return; }
    return realClick.apply(this, arguments);
};
</script>

<script>
${userscript}
</script>

<script>
(async () => {
    const R = [];
    const ok = (name, cond, extra) => R.push({ name, pass: !!cond, extra: extra === undefined ? '' : String(extra) });
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const panel = () => document.getElementById('fx-panel-host');

    try {
        for (let i = 0; i < 200 && !panel(); i++) await sleep(25);
        const host = panel();
        ok('面板宿主已插入页面', !!host);
        const root = host && host.shadowRoot;
        ok('样式与 DOM 关在 Shadow DOM 里', !!root);
        const $ = id => root.getElementById(id);
        const $$ = sel => [...root.querySelectorAll(sel)];

        // ---- 顶栏常驻按钮 ----
        const bar = ['fx-stop', 'fx-pause', 'fx-toggle'];
        ok('顶栏 3 个常驻按钮齐全', bar.every(id => $(id)),
            bar.filter(id => !$(id)).join(',') || '齐全');
        ok('顶栏按钮文案正确',
            $('fx-stop').textContent === '开始' && $('fx-pause').textContent === '暂停' &&
            $('fx-toggle').textContent === '收起',
            [$('fx-stop').textContent, $('fx-pause').textContent, $('fx-toggle').textContent].join('/'));
        ok('「隐藏」与小圆点都已并进「收起」，面板里不再有 fx-hide / fx-mini-dot',
            !$('fx-hide') && !$('fx-mini-dot'));

        // ---- 分类 ----
        const heads = $$('.group-head').map(h => h.dataset.group);
        ok('4 个分类且顺序正确', heads.join(',') === 'mode,api,bank,log', heads.join(','));
        ok('默认全部收起', $$('.group.open').length === 0, $$('.group.open').length + ' 个展开');
        ok('分类标题带无障碍属性',
            $$('.group-head').every(h => h.getAttribute('role') === 'button' && h.getAttribute('tabindex') === '0' && h.getAttribute('aria-expanded') === 'false'));

        // ---- 控件清单 ----
        const WANT_IDS = [
            'fx-stop', 'fx-pause', 'fx-toggle',
            'fx-speed', 'fx-submit', 'fx-debug',
            'fx-settings-btn', 'fx-test', 'fx-f-url', 'fx-f-key', 'fx-f-model', 'fx-f-save', 'fx-f-cancel',
            'fx-export', 'fx-import', 'fx-reparse', 'fx-autoclose', 'fx-clear-session',
            'fx-crosscheck',
            'fx-log-clear', 'fx-log-copy', 'fx-log-export', 'fx-selftest',
        ];
        const missing = WANT_IDS.filter(id => !$(id));
        ok('23 个具名控件一个不少', missing.length === 0, missing.join(','));
        ok('两个模式按钮在', $$('.mode-btn').length === 2, $$('.mode-btn').length + ' 个');
        ok('控件总数 25（23 具名 + 2 模式）', $$('button, input').length === 25, $$('button, input').length + ' 个');

        // ---- 新增开关：二源交叉验证 / 关闭页档位 ----
        ok('二源按钮默认「自动」且 aria-pressed 同步',
            $('fx-crosscheck').textContent === '二源：自动' && $('fx-crosscheck').getAttribute('aria-pressed') === 'false',
            $('fx-crosscheck').textContent);
        $('fx-crosscheck').click();
        await sleep(10);
        ok('二源按钮点击切到「强制」并落盘',
            $('fx-crosscheck').textContent === '二源：强制'
            && $('fx-crosscheck').getAttribute('aria-pressed') === 'true'
            && window.GM_getValue('forceCrossCheck', null) === true,
            $('fx-crosscheck').textContent + ' / ' + JSON.stringify(window.GM_getValue('forceCrossCheck', null)));
        ok('关闭页按钮默认 8 秒档', $('fx-autoclose').textContent === '关闭页：8 秒', $('fx-autoclose').textContent);
        $('fx-autoclose').click();
        await sleep(10);
        ok('关闭页按钮点击切到 15 秒并落盘',
            $('fx-autoclose').textContent === '关闭页：15 秒' && window.GM_getValue('autoCloseSec', null) === 15,
            $('fx-autoclose').textContent + ' / ' + JSON.stringify(window.GM_getValue('autoCloseSec', null)));

        // ---- 摘要 ----
        const badge = k => $('fx-gb-' + k).textContent;
        ok('模式分类摘要跟随默认设置', badge('mode') === '百度搜索 · 标准', badge('mode'));
        ok('接口分类摘要显示未配置', badge('api') === '未配置', badge('api'));
        ok('题库分类摘要显示题数与已答', /^题库 \\d+ 题$/.test(badge('bank')), badge('bank'));
        ok('日志分类摘要显示行数', /^日志 \\d+ 行$/.test(badge('log')), badge('log'));

        // ---- 展开 / 收起 + 落盘 ----
        $('fx-group-bank').querySelector('.group-head').click();
        await sleep(10);
        ok('点分类标题能展开', $('fx-group-bank').classList.contains('open'));
        ok('展开后 aria-expanded 同步', $('fx-group-bank').querySelector('.group-head').getAttribute('aria-expanded') === 'true');
        ok('展开后摘要按 CSS 隐藏（display:none）',
            window.getComputedStyle($('fx-gb-bank')).display === 'none',
            window.getComputedStyle($('fx-gb-bank')).display);
        ok('展开状态落盘到 panelGroups', (window.GM_getValue('panelGroups', {}) || {}).bank === true,
            JSON.stringify(window.GM_getValue('panelGroups', {})));

        // ---- 导出链路（本次重构动过的地方）----
        const today = new Date();
        const p2 = n => String(n).padStart(2, '0');
        const day = '' + today.getFullYear() + p2(today.getMonth() + 1) + p2(today.getDate());
        $('fx-export').click();
        await sleep(600);
        const names = window.__downloads.map(d => d.name);
        ok('导出答案库产出 CSV + JSON 两个文件', names.length === 2, names.join(' , '));
        ok('CSV 文件名带本地日期戳', names[0] === 'faxuanyun-legal-exam-bank-' + day + '.csv', names[0]);
        ok('JSON 与 CSV 共用同一个日期戳', names[1] === 'faxuanyun-legal-exam-bank-' + day + '.json', names[1]);
        ok('两个导出文件都非空', window.__downloads.every(d => d.size > 0), JSON.stringify(window.__downloads));

        $('fx-log-export').click();
        await sleep(50);
        const logName = window.__downloads[2] && window.__downloads[2].name;
        ok('导出日志文件名格式正确',
            !!logName && new RegExp('^faxuanyun-legal-exam-log-' + day + '-\\\\d{6}\\\\.txt$').test(logName), logName);

        // ---- 自检 ----
        $('fx-selftest').click();
        await sleep(50);
        const logText = $('fx-log').textContent;
        // 断言条数会随版本涨，这里只认「N/N 项通过」这个形状，不写死数字；
        // 但要有下限：万一自检整个没跑起来（0/0）也不能算通过
        // 注意：这段脚本整体躺在模板字面量里，正则的反斜杠必须写成 \\，否则 \s / \d 会被
        // 模板字面量吃掉，页面里留下 /自检s*(d+)/ 直接语法报错（整页没结果）。
        const selfTestHit = (logText.match(/自检\\s*(\\d+)\\/(\\d+)\\s*项通过/) || []);
        ok('面板自检全部通过（N/N 全部通过，且 N ≥ 50）',
            !!selfTestHit[1] && selfTestHit[1] === selfTestHit[2] && Number(selfTestHit[1]) >= 50,
            selfTestHit[1] ? (selfTestHit[1] + '/' + selfTestHit[2] + ' 项通过') : (logText.match(/自检[^，。]*/) || [''])[0]);

        // ---- 快捷键 / 收起（完整 ⇄ 窄条，一个按钮来回）----
        document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd', altKey: true, bubbles: true }));
        await sleep(20);
        ok('Alt+D 打开调试且摘要同步', badge('mode').indexOf('调试') >= 0, badge('mode'));
        ok('调试按钮文案同步', $('fx-debug').textContent === '调试：开', $('fx-debug').textContent);

        // 窄条标题是「收起时才出现」的：完整态若也显示，面板名会重复出现两遍
        ok('完整态面板名只出现一次（窄条标题在完整态隐藏）',
            getComputedStyle($('fx-collapse-title')).display === 'none' &&
            getComputedStyle($('fx-drag-title')).display !== 'none' &&
            $('fx-panel').innerText.split('法宣在线助手').length - 1 === 1,
            getComputedStyle($('fx-collapse-title')).display + ' / 可见 ' +
            ($('fx-panel').innerText.split('法宣在线助手').length - 1) + ' 次');

        $('fx-toggle').click(); await sleep(10);
        ok('收起成一条窄条（写着自己的名字）',
            $('fx-panel').dataset.state === 'collapsed' && $('fx-panel').classList.contains('collapsed') &&
            getComputedStyle($('fx-collapse-title')).display === 'flex' &&
            $('fx-collapse-title').textContent === '法宣在线助手',
            $('fx-panel').dataset.state + ' / ' + getComputedStyle($('fx-collapse-title')).display);
        ok('窄条真的窄（≤ 140px，样式没被改坏）',
            $('fx-panel').getBoundingClientRect().width <= 140,
            Math.round($('fx-panel').getBoundingClientRect().width) + 'px');
        ok('窄条上按钮改口叫「展开」', $('fx-toggle').textContent === '展开', $('fx-toggle').textContent);
        $('fx-toggle').click(); await sleep(10);
        ok('再点一下回完整面板，按钮改口叫「收起」',
            $('fx-panel').dataset.state === 'normal' && !$('fx-panel').classList.contains('collapsed') &&
            $('fx-toggle').textContent === '收起',
            $('fx-panel').dataset.state + ' / ' + $('fx-toggle').textContent);

        // ---- 分类状态容错 ----
        window.GM_setValue('panelGroups', { mode: 'yes', api: true, nope: 1, bank: null });
        ok('脏数据经 normalizeGroupState 归一（纯函数）',
            (() => { const s = window.__FX_TEST__.normalizeGroupState(window.GM_getValue('panelGroups'), ['mode', 'api', 'bank', 'log']);
                     return s.mode === false && s.api === true && s.bank === false && s.log === false && !('nope' in s); })());
    } catch (e) {
        R.push({ name: '运行期异常', pass: false, extra: (e && e.stack || String(e)).split('\\n').slice(0, 3).join(' | ') });
    }

    const failed = R.filter(r => !r.pass);
    document.getElementById('fx-out').textContent =
        'FX_RESULT ' + JSON.stringify({ pass: R.length - failed.length, total: R.length, failed });
})();
</script>
</body></html>`;

const dir = mkdtempSync(join(tmpdir(), 'fx-smoke-'));
const page = join(dir, 'smoke.html');
writeFileSync(page, html, 'utf8');

let dom = '';
try {
    dom = execFileSync(BROWSERS, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--disable-background-networking', '--mute-audio',
        // CI 容器里以 root 运行，需要用 --no-sandbox 才能起内核；本地不加
        ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
        '--user-data-dir=' + join(dir, 'profile'),
        '--virtual-time-budget=20000',
        '--dump-dom', 'file:///' + page.replace(/\\/g, '/'),
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
    console.error('启动浏览器失败：', e.message);
    process.exit(2);
}

const m = dom.match(/FX_RESULT (\{.*?\})<\/div>/s);
if (!m) {
    // 排障用：FX_SMOKE_DUMP=<路径> 时把整份 DOM 与生成的页面落盘，方便对比「同一份页面为什么结果不同」
    if (process.env.FX_SMOKE_DUMP) {
        writeFileSync(process.env.FX_SMOKE_DUMP, dom, 'utf8');
        writeFileSync(process.env.FX_SMOKE_DUMP + '.html', html, 'utf8');
        console.error('DOM 已落盘：' + process.env.FX_SMOKE_DUMP + '（' + dom.length + ' 字符）');
    }
    console.error('页面没有产出结果（--dump-dom 里找不到 FX_RESULT）。片段：');
    console.error(dom.slice(0, 1200));
    process.exit(2);
}
const res = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));

for (const f of res.failed) console.log('FAIL  ' + f.name + (f.extra ? '  → ' + f.extra : ''));
console.log(`\n面板冒烟测试：${res.pass}/${res.total} 通过  （浏览器：${BROWSERS}）`);
process.exit(res.failed.length ? 1 : 0);
