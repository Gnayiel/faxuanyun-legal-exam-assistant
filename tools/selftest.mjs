#!/usr/bin/env node
/**
 * 无依赖自检：校验用户脚本的元数据块，并在 Node 里跑脚本自带的 73 项断言。
 *
 *   node tools/selftest.mjs [用户脚本路径]
 *
 * 不联网、不写盘、不需要浏览器。脚本在最小 DOM / 油猴 API 打桩下加载，
 * 因此这里跑的就是面板「自检」按钮调用的同一批用例。
 */
import { readFileSync } from 'node:fs';
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
const repoRoot = join(HERE, '..');
const readDoc = p => { try { return readFileSync(join(repoRoot, p), 'utf8'); } catch { return ''; } };
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

console.log(failed === 0
    ? `\n全部通过。\n`
    : `\n${failed} 项未通过。\n`);
process.exit(failed === 0 ? 0 : 1);
