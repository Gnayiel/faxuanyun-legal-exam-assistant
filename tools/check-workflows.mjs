#!/usr/bin/env node
/**
 * GitHub Actions 工作流静态检查（无依赖、不联网、只读）。
 *
 *   node tools/check-workflows.mjs              # 先跑检查器负例自测，再检查真实仓库
 *   node tools/check-workflows.mjs --self-test  # 只跑负例自测（改检查器本身时用）
 *
 * 在 CI 里跑得非常快，专门拦几种「平时看不出来、出事才知道」的配置漂移：
 *   1. 每个 workflow 都有 runs-on / permissions / timeout-minutes（避免无限卡住或权限过大）
 *   2. 第三方 action 一律 pin 到 40 位 commit SHA（tag 可以被人重新指向，SHA 不会）
 *   3. pin 的 SHA 必须在本行带 `# vX.Y.Z` 注释（Dependabot 靠它判断当前版本）
 *   4. workflow 里引用的本地脚本（node tools/xxx.mjs）必须真实存在
 *   5. 禁止 pull_request_target + 检出 PR 代码的组合（会执行不可信代码，安全红线）
 *   6. 发版 workflow 必须在 push tag 时触发
 *
 * 注意 workflow 里 action 行的真实写法是 `      - uses: owner/repo@<sha>  # vX`
 * ——步骤列表的 `- ` 前缀是匹配关键。早期正则写成 `^\s*uses:`，漏掉 `- ` 后
 * 每个 workflow 都只数到「0 个 action」，检查恒为真、CI 假绿。现在文件开头会跑
 * 负例自测，并用两种独立方式交叉核对 action 数量，防止这类退化再次发生。
 *
 * 退出码：0 全部通过；1 有硬错误。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DIR = join(ROOT, '.github', 'workflows');
const SHA_PIN = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;
// 整行注释必须是「# vX.Y.Z」：前面可以没 v，但 # 之后只能有版本号和空白。
const VERSION_COMMENT = /^#\s*v?\d+(?:\.\d+){1,2}\s*$/i;
// GitHub Actions 的权限项白名单：写错键名或值（如 contents: admin）不会报错，只会静默失效。
const PERMISSION_KEYS = new Set([
    'actions', 'attestations', 'checks', 'contents', 'deployments', 'discussions', 'id-token',
    'issues', 'models', 'packages', 'pages', 'pull-requests', 'repository-projects',
    'security-events', 'statuses',
]);
const PERMISSION_VALUES = new Set(['read', 'write', 'none']);

let failed = 0;
const ok = (name, cond, extra = '') => {
    if (cond) { console.log(`  ✓ ${name}`); return true; }
    failed++;
    console.log(`  ✗ ${name}${extra ? `  → ${extra}` : ''}`);
    return false;
};

const isLocalAction = url => url.startsWith('./') || url.startsWith('../');

/** 解析顶层 permissions: 块，返回内联写法或逐项键值。 */
function parsePermissions(text) {
    const lines = text.split(/\r?\n/);
    const idx = lines.findIndex(l => /^permissions:\s*(.*)$/.test(l));
    if (idx === -1) return { found: false, inline: '', entries: [] };
    const inline = (lines[idx].match(/^permissions:\s*(.*)$/) || [])[1].trim();
    const entries = [];
    if (!inline) {
        for (let i = idx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (/^\S/.test(line)) break;               // 下一个顶层键，块结束
            const m = line.match(/^\s+([A-Za-z0-9_-]+):\s*(\S+)\s*(?:#.*)?$/);
            if (m) entries.push({ key: m[1], value: m[2] });
        }
    }
    return { found: true, inline, entries };
}

/** 统计 jobs: 下的 job 数（两个空格缩进的键）。 */
function countJobs(text) {
    const lines = text.split(/\r?\n/);
    const idx = lines.findIndex(l => /^jobs:\s*$/.test(l));
    if (idx === -1) return 0;
    let n = 0;
    for (let i = idx + 1; i < lines.length; i++) {
        if (/^\S/.test(lines[i])) break;
        if (/^ {2}[A-Za-z0-9_-]+:\s*$/.test(lines[i])) n++;
    }
    return n;
}

/** 收集所有 cron 表达式，去掉引号与行尾注释。 */
function parseCrons(text) {
    return [...text.matchAll(/cron:\s*['"]?([^'"\n#]+?)['"]?\s*(?:#.*)?$/gm)]
        .map(m => m[1].trim())
        .filter(Boolean);
}

/**
 * 解析 workflow 文本里的 action 引用。
 * 同时支持两种合法写法：
 *   - `      - uses: owner/repo@<sha>  # vX`（最常见，横线在行首）
 *   - `        uses: owner/repo@<sha>  # vX`（步骤先用 `- name:` 开头，再换行写 uses）
 * 返回每项的 url / 行内剩余内容 / 原始行 / 行号，供 pin 与注释检查共用。
 */
function parseActions(text) {
    const actions = [];
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const m = line.match(/^\s*-\s*uses:\s*(\S+)\s*(.*)$/)
            || line.match(/^\s{2,}uses:\s*(\S+)\s*(.*)$/);
        if (!m) continue;
        actions.push({
            url: m[1].replace(/^['"]|['"]$/g, ''),
            rest: m[2].trim(),
            raw: line,
            line: i + 1,
        });
    }
    return actions;
}

/**
 * 纯函数式检查一个 workflow 文本，只返回结果、不打印、不计数。
 * fileExists 可注入，便于负例自测不依赖真实仓库文件。
 */
function checkWorkflow(text, { fileExists = p => existsSync(join(ROOT, p)) } = {}) {
    const results = [];
    const add = (key, label, cond, extra = '') => results.push({ key, label, cond: !!cond, extra });

    add('name', '有 name', /^name:\s*\S+/m.test(text));
    add('on', '有 on 触发条件', /^on\s*:/m.test(text));
    add('runs-on', '有 runs-on', /^\s*runs-on:\s*\S+/m.test(text));
    add('permissions', '有 permissions（最小权限）', /^permissions:/m.test(text));
    add('timeout', '有 timeout-minutes（防止无限卡住）', /timeout-minutes:\s*\d+/m.test(text));
    add('jobs', 'jobs 下至少有一个 job', countJobs(text) > 0, `jobs=${countJobs(text)}`);
    add('tabs', '缩进没有 TAB（YAML 只允许空格）', !/^\t/m.test(text));

    // cron 必须是 5 段（分 时 日 月 周）：写错段数 GitHub 会直接拒绝整份 workflow
    const crons = parseCrons(text);
    add('cron', crons.length === 0 ? '没有 cron 表达式（无需校验）' : '所有 cron 都是 5 段（分 时 日 月 周）',
        crons.every(c => c.split(/\s+/).length === 5),
        crons.filter(c => c.split(/\s+/).length !== 5).join(' | '));

    // permissions 键名/值写错时 GitHub 不会报错，只会静默忽略；write-all 则等于把权限拉到最大
    const perms = parsePermissions(text);
    const badPerms = [];
    if (perms.found) {
        if (perms.inline) {
            if (perms.inline !== 'read-all') badPerms.push(`permissions: ${perms.inline}`);
        } else {
            if (!perms.entries.length) badPerms.push('permissions 块为空');
            for (const p of perms.entries) {
                if (!PERMISSION_KEYS.has(p.key) || !PERMISSION_VALUES.has(p.value)) badPerms.push(`${p.key}: ${p.value}`);
            }
        }
    }
    add('permissions-values', 'permissions 只含合法权限项（read / write / none）', badPerms.length === 0, badPerms.join(', '));
    add('permissions-write-all', 'permissions 不使用 write-all', !/\bwrite-all\b/.test(text));

    // 第三方 action 必须 pin SHA；本地相对路径 action（./xxx）不受限
    const actions = parseActions(text);
    const thirdParty = actions.filter(a => !isLocalAction(a.url));
    const badPin = thirdParty.filter(a => !SHA_PIN.test(a.url));
    add('pin', thirdParty.length === 0
        ? '本文件没有第三方 action（无需 pin）'
        : `${thirdParty.length} 个第三方 action 全部 pin 到 commit SHA`,
    badPin.length === 0, badPin.map(a => `${a.url}（第 ${a.line} 行）`).join(', '));

    const badComment = thirdParty.filter(a => !VERSION_COMMENT.test(a.rest));
    add('comment', thirdParty.length === 0
        ? '本文件没有第三方 action（无需版本注释）'
        : 'pin 的 SHA 在本行带 `# vX.Y.Z` 版本注释（方便 Dependabot 升级）',
    badComment.length === 0,
    badComment.map(a => `${a.url} 缺本行整行注释（第 ${a.line} 行：${a.raw.trim()}）`).join(' | '));

    // 引用的本地脚本必须存在
    const scripts = [...new Set([...text.matchAll(/\bnode\s+(tools\/[\w.-]+\.mjs)\b/g)].map(m => m[1]))];
    const missing = scripts.filter(p => !fileExists(p));
    add('scripts', `${scripts.length} 个本地脚本都存在`, missing.length === 0, missing.join(', '));

    // 安全红线：pull_request_target 下检出 PR 代码 = 给外部 PR 执行任意代码的机会
    if (/pull_request_target/.test(text)) {
        add('prt', '危险组合：pull_request_target 不得检出 PR 代码',
            !/ref:\s*\$\{\{\s*github\.event\.pull_request\.head/.test(text));
    }
    return results;
}

// ------------------------------------------------------------ 检查器负例自测
// 这些样本必须能在「检查器自己坏掉」时报警：旧版正则漏掉 `- ` 后，所有 workflow
// 都数到 0 个 action 却全部通过——这里用固定样本把每类坏配置都断言成「必须被抓出」。
function runSelfTest() {
    console.log('\n[1/2] 检查器负例自测（内存样本，不依赖仓库内容）');
    const SHA = '3d3c42e5aac5ba805825da76410c181273ba90b1';
    const good = [
        'name: 测试',
        'on:',
        '  push:',
        'permissions:',
        '  contents: read',
        'jobs:',
        '  t:',
        '    runs-on: ubuntu-24.04',
        '    timeout-minutes: 5',
        '    steps:',
        `      - uses: actions/checkout@${SHA}   # v7.0.1`,
        `      - uses: actions/setup-node@${SHA}  # v7.1.0`,
        '        with:',
        "          node-version: '22'",
        '      - run: node tools/check-data.mjs',
        '',
    ].join('\n');
    const run = (text, opts) => checkWorkflow(text, opts);
    const alwaysExists = { fileExists: () => true };
    const hasFail = (results, key, needle = '') => results.some(
        r => r.key === key && !r.cond && (needle === '' || String(r.extra).includes(needle)));

    const goodResults = run(good, alwaysExists);
    ok('合法样本零失败', goodResults.every(r => r.cond),
        goodResults.filter(r => !r.cond).map(r => `${r.key}: ${r.label}`).join('; '));
    ok('合法样本检出 2 个 action（缩进的 `- uses:` 必须匹配到）',
        parseActions(good).length === 2, `实际 ${parseActions(good).length} 个`);

    const unpinned = good.replace(`actions/checkout@${SHA}`, 'actions/checkout@v4');
    ok('负例：未 pin 到 SHA 的 action 会被抓出',
        hasFail(run(unpinned, alwaysExists), 'pin', 'actions/checkout@v4'));

    const noComment = good.replace(`@${SHA}   # v7.0.1`, `@${SHA}`);
    ok('负例：pin 了 SHA 但本行没有 `# vX.Y.Z` 注释会被抓出',
        hasFail(run(noComment, alwaysExists), 'comment', 'checkout'));

    const badComment = good.replace('# v7.0.1', '# 固定版本');
    ok('负例：注释不是 `# vX.Y.Z` 版本形式会被抓出',
        hasFail(run(badComment, alwaysExists), 'comment', 'checkout'));

    const misplaced = good.replace(`@${SHA}   # v7.0.1`, `@${SHA}\n      # v7.0.1`);
    ok('负例：版本注释不在 uses 本行（整行校验）会被抓出',
        hasFail(run(misplaced, alwaysExists), 'comment', 'checkout'));

    const noPerm = good.replace('permissions:\n  contents: read\n', '');
    ok('负例：缺 permissions 会被抓出', hasFail(run(noPerm, alwaysExists), 'permissions'));

    const noTimeout = good.replace('    timeout-minutes: 5\n', '');
    ok('负例：缺 timeout-minutes 会被抓出', hasFail(run(noTimeout, alwaysExists), 'timeout'));

    const noRunsOn = good.replace('    runs-on: ubuntu-24.04\n', '');
    ok('负例：缺 runs-on 会被抓出', hasFail(run(noRunsOn, alwaysExists), 'runs-on'));

    const noOn = good.replace('on:\n  push:\n', '');
    ok('负例：缺 on 触发条件会被抓出', hasFail(run(noOn, alwaysExists), 'on'));

    const badCron = good.replace('on:\n  push:', 'on:\n  schedule:\n    - cron: "0 3 * *"');
    ok('负例：cron 不是 5 段会被抓出', hasFail(run(badCron, alwaysExists), 'cron'));

    const tabbed = good.replace('    timeout-minutes: 5', '\ttimeout-minutes: 5');
    ok('负例：TAB 缩进会被抓出', hasFail(run(tabbed, alwaysExists), 'tabs'));

    const noJobs = good.replace('jobs:\n  t:\n', '');
    ok('负例：jobs 下没有 job 会被抓出', hasFail(run(noJobs, alwaysExists), 'jobs'));

    const writeAll = good.replace('permissions:\n  contents: read', 'permissions: write-all');
    ok('负例：permissions: write-all 会被抓出',
        hasFail(run(writeAll, alwaysExists), 'permissions-write-all'));

    const badPerm = good.replace('permissions:\n  contents: read', 'permissions:\n  contents: admin\n  foo: read');
    ok('负例：permissions 非法键/值会被抓出',
        hasFail(run(badPerm, alwaysExists), 'permissions-values'));

    const missingScript = good.replace('tools/check-data.mjs', 'tools/not-here.mjs');
    ok('负例：引用不存在的本地脚本会被抓出',
        hasFail(run(missingScript, { fileExists: p => p === 'tools/check-data.mjs' }), 'scripts', 'tools/not-here.mjs'));

    const prt = good
        .replace('on:\n  push:', 'on:\n  pull_request_target:')
        .replace('- run: node tools/check-data.mjs',
            `- uses: actions/checkout@${SHA}  # v7.0.1\n        with:\n          ref: \${{ github.event.pull_request.head.sha }}`);
    ok('负例：pull_request_target + 检出 PR 代码会被抓出', hasFail(run(prt, alwaysExists), 'prt'));
}

runSelfTest();
if (process.argv.includes('--self-test')) {
    console.log(failed === 0 ? '\n检查器自测全部通过。\n' : `\n检查器自测 ${failed} 项失败。\n`);
    process.exit(failed === 0 ? 0 : 1);
}

// -------------------------------------------------------------- 真实仓库检查
if (!existsSync(DIR)) { console.log('没有 .github/workflows 目录，跳过。'); process.exit(0); }
const files = readdirSync(DIR).filter(f => /\.ya?ml$/i.test(f)).sort();
console.log('\n[2/2] 扫描真实仓库 .github/workflows');
ok('找到 workflow 文件', files.length > 0, `${files.length} 个`);

const texts = new Map(files.map(f => [f, readFileSync(join(DIR, f), 'utf8')]));
let parsedTotal = 0;
let thirdPartyTotal = 0;

for (const f of files) {
    const t = texts.get(f);
    console.log(`\n[${f}]`);

    for (const r of checkWorkflow(t)) ok(r.label, r.cond, r.extra);

    // 再拿一种「不依赖上面正则」的逐行扫描交叉核对 action 数量：
    // 两边不一致就说明有 action 行被漏检或误检，pin 检查可能是假绿。
    const actions = parseActions(t);
    parsedTotal += actions.length;
    thirdPartyTotal += actions.filter(a => !isLocalAction(a.url)).length;
    const naiveCount = t.split(/\r?\n/).filter(l => {
        const s = l.trim();
        return (s.startsWith('-') && s.includes('uses:')) || s.startsWith('uses:');
    }).length;
    ok(`action 行扫描与解析器数量一致（${actions.length}）`, actions.length === naiveCount,
        `解析器=${actions.length} 逐行扫描=${naiveCount}`);
}

// 全局兜底：真实仓库一个 action 都数不到，多半是正则又退化了，直接判红。
ok(`真实仓库共检出 ${parsedTotal} 个 action 引用（其中第三方 ${thirdPartyTotal} 个需 pin）`,
    parsedTotal > 0 && thirdPartyTotal > 0, '一个 action 都没检出：pin 检查等于没跑，拒绝假绿');

// 发版 workflow 必须由 tag push 触发，否则「推 tag 自动发版」不成立
const release = [...texts.entries()].find(([, t]) => /gh release (create|edit)/.test(t));
ok('存在自动发版的 workflow', !!release);
if (release) ok('发版 workflow 由 tag push 触发', /tags:\s*\[?\s*['"]?v\*/.test(release[1]), release[0]);

console.log(failed === 0 ? '\n工作流静态检查全部通过。\n' : `\n${failed} 项未通过。\n`);
process.exit(failed === 0 ? 0 : 1);
