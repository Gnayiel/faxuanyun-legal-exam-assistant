#!/usr/bin/env node
/**
 * 无依赖自检：校验用户脚本的元数据块，并在 Node 里跑脚本自带的内置断言。
 *
 *   node tools/selftest.mjs [用户脚本路径]
 *
 * 不联网、不写盘、不需要浏览器。脚本在最小 DOM / 油猴 API 打桩下加载，
 * 因此这里跑的就是面板「自检」按钮调用的同一批用例。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(process.argv[2] || join(HERE, '..', 'faxuanyun-legal-exam-assistant.user.js'));
const code = readFileSync(SCRIPT, 'utf8');

let failed = 0;
const ok = (name, cond, extra = '') => {
    if (cond) { console.log(`  ✓ ${name}`); return; }
    failed++;
    console.log(`  ✗ ${name}${extra ? `  → ${extra}` : ''}`);
};

// ---------------------------------------------------------------- 元数据块
console.log(`\n[1/4] UserScript 元数据  ${SCRIPT}`);
const block = code.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/);
if (!block) {
    console.error('  ✗ 找不到 // ==UserScript== 元数据块');
    process.exit(1);
}
const meta = {};
for (const line of block[1].split('\n')) {
    const m = line.match(/^\/\/\s*@([-\w:]+)\s*(.*)$/);
    if (!m) continue;
    const val = m[2].trim();
    (meta[m[1]] = meta[m[1]] || []).push(val);
}
const one = k => (meta[k] || [])[0] || '';
const many = k => (meta[k] || []).filter(Boolean);

ok('@name 存在', !!one('name'));
ok('@namespace 存在（改了会丢用户已存的题库）', !!one('namespace'));
ok('@version 是 x.y.z', /^\d+\.\d+\.\d+$/.test(one('version')), one('version'));
ok('@license 存在', !!one('license'), one('license'));
ok('@match 已限定在法宣在线域名', many('match').length > 0 && many('match').every(x => x.includes('faxuanyun.com')), many('match').join(' '));
ok('@noframes 已声明（避免 iframe 里重复注入）', meta.noframes !== undefined);
ok('@run-at document-idle', one('run-at') === 'document-idle', one('run-at'));
for (const g of ['GM_xmlhttpRequest', 'GM_getValue', 'GM_setValue', 'GM_addStyle', 'GM_addValueChangeListener', 'GM_info']) {
    ok(`@grant ${g}`, many('grant').includes(g));
}
ok('@connect 覆盖 www.baidu.com', many('connect').includes('www.baidu.com'));

// 四个仓库地址必须都指向同一个仓库，且不能留着 <你的用户名> 这类占位符：
// 油猴的「检查更新」与 README 里的安装链接都靠它们。
const REPO = 'GNAYIEL/faxuanyun-legal-exam-assistant';
const urlKeys = ['homepageURL', 'supportURL', 'downloadURL', 'updateURL'];
ok('仓库地址四行都指向同一仓库、无占位符',
    urlKeys.every(k => one(k).includes(REPO) && !/[<>]/.test(one(k))),
    urlKeys.map(k => `${k}=${one(k)}`).join('  '));
ok('downloadURL / updateURL 指向当前文件名（改名后必须同步）',
    one('downloadURL').endsWith('/faxuanyun-legal-exam-assistant.user.js') &&
    one('updateURL').endsWith('/faxuanyun-legal-exam-assistant.user.js'),
    `${one('downloadURL')}  |  ${one('updateURL')}`);

// 自动更新链路（C5）：油猴「检查更新」只认 https 直链；downloadURL / updateURL 各指一处时，
// 不同客户端会从不同地址取更新，行为分叉且难排查，所以两个字段必须完全一致。
const RAW_FILE = 'faxuanyun-legal-exam-assistant.user.js';
const UPDATE_URL_PREFIXES = [
    `https://raw.githubusercontent.com/${REPO}/main/`,
    `https://github.com/${REPO}/raw/main/`,
];
const isUpdateUrl = u => UPDATE_URL_PREFIXES.some(p => u.startsWith(p)) && u.endsWith('/' + RAW_FILE);
ok('downloadURL / updateURL 是完整 https 直链',
    isUpdateUrl(one('downloadURL')) && isUpdateUrl(one('updateURL')),
    `允许：${UPDATE_URL_PREFIXES.join(' 或 ')}${RAW_FILE}`);
ok('downloadURL 与 updateURL 一致（两个字段不能各指一处）',
    !!one('downloadURL') && one('downloadURL') === one('updateURL'),
    `${one('downloadURL')}  |  ${one('updateURL')}`);

// 脚本头部声明的白名单常量必须和 @connect 一致，否则「补一行 @connect」的提示会指错
const connConst = code.match(/const CONNECT_HOSTS = \[([\s\S]*?)\];/);
if (connConst) {
    const hosts = [...connConst[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
    const missing = hosts.filter(h => !many('connect').includes(h));
    const extra = many('connect').filter(h => !hosts.includes(h));
    ok('CONNECT_HOSTS 与 @connect 一一对应', missing.length === 0 && extra.length === 0,
        `@connect 缺 ${missing.join(',') || '无'}；常量多 ${extra.join(',') || '无'}`);
} else {
    ok('找到 CONNECT_HOSTS 常量', false);
}

// 体积预算（C5）：单文件脚本越大，油猴解析越慢、从 GitHub raw 同步也越贵。
// 超预算时应该拆资源或用外链，而不是继续往单文件里堆；实测值随名字一起打印。
const SIZE_BUDGET = 512 * 1024;
const sizeBytes = Buffer.byteLength(code, 'utf8');
ok(`脚本体积在预算内（${(sizeBytes / 1024).toFixed(1)} KB ≤ ${SIZE_BUDGET / 1024} KB）`,
    sizeBytes <= SIZE_BUDGET,
    `${sizeBytes} 字节`);

// ------------------------------------------------------------------ 加载
console.log('\n[2/4] 在最小 DOM / 油猴打桩下加载脚本');
const makeEl = () => ({
    style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    children: [], value: '', textContent: '', innerHTML: '',
    offsetParent: null, offsetWidth: 0, offsetHeight: 0,
    appendChild(c) { this.children.push(c); return c; },
    removeChild() {}, setAttribute() {}, getAttribute: () => null,
    addEventListener() {}, removeEventListener() {}, click() {},
    querySelector: () => null, querySelectorAll: () => [],
    getClientRects: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
    closest: () => null, contains: () => false, focus() {}, attachShadow: () => null,
});
const documentStub = {
    body: null,                       // 刻意留空：脚本会挂 DOMContentLoaded，不建面板
    documentElement: makeEl(), head: makeEl(), activeElement: null, hidden: false,
    createElement: makeEl, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
};
const store = new Map();
const win = {
    document: documentStub,
    navigator: { onLine: true, userAgent: 'node' },
    location: { href: 'https://gs.faxuanyun.com/exam', pathname: '/exam', search: '' },
    innerWidth: 1280, innerHeight: 800, PointerEvent: undefined,
    addEventListener() {}, removeEventListener() {},
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: cb => setTimeout(cb, 0),
    console, URL, Blob: class {}, FileReader: class {},
    getComputedStyle: () => ({ color: 'rgb(0,0,0)' }),
    MutationObserver: class { observe() {} disconnect() {} },
    alert() {}, prompt: () => null, confirm: () => true,
    GM_info: { script: { version: one('version'), name: one('name') } },
    GM_getValue: (k, d) => (store.has(k) ? store.get(k) : d),
    GM_setValue: (k, v) => { store.set(k, v); },
    GM_addStyle: () => makeEl(),
    GM_addValueChangeListener: () => 0,
    GM_xmlhttpRequest: () => { throw new Error('自检不应发起网络请求'); },
};
win.window = win; win.self = win; win.top = win; win.globalThis = win;

try {
    vm.runInContext(code, vm.createContext(win), { filename: SCRIPT });
    ok('脚本顶层执行无异常', true);
} catch (e) {
    ok('脚本顶层执行无异常', false, (e && e.stack || String(e)).split('\n').slice(0, 3).join(' | '));
    process.exit(1);
}
ok('挂上了 window.__FX_TEST__ 测试钩子', !!win.__FX_TEST__);
ok('默认不暴露写库函数（无 __FX_TEST_ALLOW_MUTATE__）', !!win.__FX_TEST__ && win.__FX_TEST__.saveCorrect === undefined);
if (!win.__FX_TEST__) process.exit(1);

// ------------------------------------------------------------------ 自检
console.log('\n[3/4] 运行脚本内置断言');
const res = win.__FX_TEST__.runSelfTest();
ok(`内置自检 ${res.pass}/${res.total} 通过`, res.pass === res.total && res.total > 0);
for (const f of res.fails) console.log(`      失败：${f}`);

// ------------------------------------------------------------------ 文档
// 断言总数会变，文档里写死的数字也会过期。这些数字是 README 徽章、脚本
// @description / 文件结构注释的一部分，改自检却忘了同步它们，读者看到的就是错的。
console.log('\n[4/4] 校验文档里的断言数');
// 从任意工作目录调用都要能定位仓库：一律以脚本自身位置为基准（不读 process.cwd()）。
const ROOT = resolve(HERE, '..');
const readDoc = p => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; } };
const n = res.total;
const docs = [
    ['README.md', `self--test-${n}%20passing`, 'README 自检徽章'],
    ['README.md', `内置的 ${n} 项断言`, 'README 开发与自检'],
    ['README.md', `${n} 项断言`, 'README 目录结构'],
    [SCRIPT.replace(/^.*[\\/]/, ''), `含 ${n} 项内置自检`, '脚本 @description'],
    [SCRIPT.replace(/^.*[\\/]/, ''), `${n} 项纯函数断言`, '脚本文件结构注释'],
];
for (const [file, needle, label] of docs) {
    ok(`${label}写着 ${n}`, readDoc(file).includes(needle), `缺「${needle}」`);
}

// README 的版本徽章是手写的，而 @version 才是版本唯一事实来源：
// 发版时只改了 @version 却忘了改徽章，读者看到的还是旧版本号，所以在这里对一次。
const ver = (readDoc(SCRIPT.replace(/^.*[\\/]/, '')).match(/^\/\/ @version\s+(\S+)/m) || [])[1] || '';
ok(`README 版本徽章与 @version 一致（${ver}）`,
    !!ver && readDoc('README.md').includes(`version-${ver}-blue`),
    `缺「version-${ver}-blue」`);

// panel-smoke 的断言数在 Node 里跑不出来（要真浏览器），但可以数它源码里的 ok(...)
// 调用：改了那个数字却忘了同步 README / CHANGELOG，这里就会红。
const m = (readDoc('tools/panel-smoke.mjs').match(/^\s+ok\(/gm) || []).length;
ok(`数得出 panel-smoke 的断言数（${m} 项）`, m > 0, '一个 ok(...) 都没数到，检查 tools/panel-smoke.mjs 是否还在');
for (const [file, needle, label] of [
    ['README.md', `panel--smoke-${m}%20passing`, 'README 冒烟徽章'],
    ['README.md', `${m} 项断言`, 'README 开发与自检'],
    ['README.md', `（${m} 项）`, 'README 目录结构'],
    ['CHANGELOG.md', `**${m} 项断言全部通过**`, 'CHANGELOG 验证方式'],
]) {
    ok(`${label}写着 ${m}`, readDoc(file).includes(needle), `缺「${needle}」`);
}

// page-smoke 的断言数写在 tools/page-smoke.mjs 的 EXPECTED_ASSERTIONS 常量里：浏览器冒烟
// 在 Node 侧跑不起来，但可以读常量、再核对 CASES 的 expectCount 之和。改了 fixture / 驱动
// 却忘了同步 README / CHANGELOG 时，这里和 page-smoke 自己的运行时计数都会红。
const pageSrc = readDoc('tools/page-smoke.mjs');
const pageConst = pageSrc.match(/const EXPECTED_ASSERTIONS = (\d+);/);
let PAGE_N = 0;
if (!pageConst) {
    ok('page-smoke 源码里声明了 EXPECTED_ASSERTIONS 常量', false,
        '缺「const EXPECTED_ASSERTIONS = <断言总数>;」');
} else {
    PAGE_N = +pageConst[1];
    ok(`数得出 page-smoke 的断言数（${PAGE_N} 项）`, PAGE_N > 0, 'EXPECTED_ASSERTIONS 必须是正整数');
    const declared = [...pageSrc.matchAll(/expectCount:\s*(\d+)/g)].map(x => +x[1]);
    ok('page-smoke 各用例的 expectCount 之和与 EXPECTED_ASSERTIONS 一致',
        declared.length > 0 && declared.reduce((a, b) => a + b, 0) === PAGE_N,
        `EXPECTED_ASSERTIONS=${PAGE_N}，expectCount 合计=${declared.reduce((a, b) => a + b, 0)}（${declared.length} 个用例）`);
    for (const [file, needle, label] of [
        ['README.md', `page--smoke-${PAGE_N}%20passing`, 'README 冒烟徽章'],
        ['README.md', `${PAGE_N} 项断言`, 'README 开发与自检'],
        ['README.md', `（${PAGE_N} 项）`, 'README 目录结构'],
        ['CHANGELOG.md', `**${PAGE_N} 项断言全部通过**`, 'CHANGELOG 验证方式'],
    ]) {
        ok(`${label}写着 ${PAGE_N}`, readDoc(file).includes(needle), `缺「${needle}」`);
    }
}

// README 命令注释最容易漂（例如 page-smoke 从 40 项加到 72 项时漏改一行）：前面只校验
// 「数字出现过」，这里再校验「出现在正确的那条命令后面」，并全量扫描文档 / 工作流里的
// 「N 项断言」，只允许 n / m / PAGE_N 三个真实数字（CHANGELOG 属历史记录，不扫）。
const allowedNums = new Set([String(n), String(m), String(PAGE_N)]);
const scanTargets = ['README.md', 'CONTRIBUTING.md', 'data/README.md'];
try {
    for (const f of readdirSync(join(ROOT, '.github', 'workflows'))) {
        if (/\.ya?ml$/i.test(f)) scanTargets.push(`.github/workflows/${f}`);
    }
} catch { /* 没有 workflows 目录时只扫文档 */ }
const staleNums = [];
for (const f of scanTargets) {
    for (const hit of readDoc(f).matchAll(/(\d+)\s*项断言/g)) {
        if (!allowedNums.has(hit[1])) staleNums.push(`${f}「${hit[0]}」`);
    }
}
ok('文档 / 工作流里没有过期的断言数', staleNums.length === 0, staleNums.slice(0, 8).join('；'));

const readmeCmd = cmd => (readDoc('README.md').split('\n').find(l => l.includes(cmd)) || '').trim();
ok(`README 的 panel-smoke 命令注释写着 ${m} 项断言`,
    readmeCmd('tools/panel-smoke.mjs').includes(`${m} 项断言`), readmeCmd('tools/panel-smoke.mjs'));
ok(`README 的 page-smoke 命令注释写着 ${PAGE_N} 项断言`,
    readmeCmd('tools/page-smoke.mjs').includes(`${PAGE_N} 项断言`), readmeCmd('tools/page-smoke.mjs'));

// README 里引用的本地图片必须真实存在，否则 GitHub 上就是裂图（换预览图时最容易漏提交）
const imgRefs = [...readDoc('README.md').matchAll(/(?:src|srcset)="([^"#?]+)"/g)]
    .map(mm => mm[1])
    .filter(p => !/^[a-z][a-z0-9+.-]*:/i.test(p));
const missingImg = imgRefs.filter(p => !existsSync(join(ROOT, p)));
ok('README 引用的本地图片都存在', imgRefs.length > 0 && missingImg.length === 0,
    imgRefs.length ? missingImg.join(', ') : '没找到本地图片引用');

console.log(failed === 0
    ? `\n全部通过。\n`
    : `\n${failed} 项未通过。\n`);
process.exit(failed === 0 ? 0 : 1);
