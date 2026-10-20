#!/usr/bin/env node
/**
 * 本地发版助手：把「前置检查 → 跑测试 → 打 tag」串成一条命令。
 *
 *   node tools/release.mjs                  # 三项前置硬门禁 + 跑测试 + 打本地 tag，并打印推送命令
 *   node tools/release.mjs --dry-run        # 只检查（前置检查降级为警告）、不创建 tag、不联网
 *   node tools/release.mjs --skip-tests     # 跳过测试（不推荐；CI 里还会再跑一遍）
 *   node tools/release.mjs --check-ci <tag> # CI 发版门禁：tag 必须等于 @version，且 CHANGELOG 有非空章节
 *
 * 三项前置检查（正式发版时是硬门禁；--dry-run 下只在输出里告警，方便在脏工作区离线预检）：
 *   1. 工作区干净：git status --porcelain 为空
 *   2. 版本单调：@version 大于现有 tag 的最高版本
 *   3. 包含远端：origin/main 是 HEAD 的祖先（正式发版会先 git fetch，网络失败降级为警告）
 *
 * 推送 tag 后，GitHub Actions 的 .github/workflows/release.yml 会自动：
 *   复验 tag=@version → 再跑门禁 → 创建 Release → 上传 .user.js 与同名 .sha256 → 复算校验和。
 * 本脚本只在正式发版时打本地 tag；不 push、不联网（唯一的 fetch 有 20 秒超时保护）。
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const USER_JS = join(ROOT, 'faxuanyun-legal-exam-assistant.user.js');
const CHANGELOG = join(ROOT, 'CHANGELOG.md');
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const skipTests = argv.includes('--skip-tests');
/** 正式发版（非 --dry-run）才启用硬门禁；--dry-run 一律只警告不失败。 */
const hardMode = !dryRun;

const die = msg => { console.error(`✗ ${msg}`); process.exit(1); };
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
const errText = e => String((e && (e.stderr || e.message)) || e || '未知错误').trim().split('\n').slice(0, 3).join(' ');

/** 同步跑 git 并取 stdout；失败抛异常。fetch 之类可能联网的命令必须传 timeout（毫秒）。 */
function git(args, { timeout } = {}) {
    return execFileSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        // 没有终端时绝不让 git 停在交互式密码提示上
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        timeout,
    }).trim();
}
function tryGit(args, opts) {
    try { return { ok: true, out: git(args, opts) }; }
    catch (e) { return { ok: false, out: String(e.stdout || '').trim(), err: e }; }
}

const VERSION_RE = /^\d+\.\d+\.\d+$/;
const cmpVersion = (a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
};

/** 取出 CHANGELOG 里「## vX.Y.Z」这一节的正文（到下一个 `## v…` 或 `---` 为止）。 */
function extractChangelogSection(text, version) {
    const lines = text.split(/\r?\n/);
    const start = lines.findIndex(l => l.trim() === `## v${version}`);
    if (start === -1) return null;
    const body = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (/^## v\d/.test(lines[i])) break;
        if (/^---\s*$/.test(lines[i])) break;
        body.push(lines[i]);
    }
    return body.join('\n');
}

// ------------------------------------------------------------ 版本号 / CHANGELOG
const script = readFileSync(USER_JS, 'utf8');
const version = (script.match(/^\/\/ @version\s+(\S+)/m) || [])[1];
if (!version) die('读不到用户脚本的 @version');
if (!VERSION_RE.test(version)) die(`@version 不是 x.y.z：${version}`);

// 体积行：--dry-run / --check-ci 的输出里都要能看到按实际文件字节数折算的 KB。
// 预算与 tools/selftest.mjs 的 SIZE_BUDGET 保持一致（512 KB），超出只告警不阻断：
// 是否允许发版交给 selftest 的体积断言（硬门禁）判断。
const SIZE_BUDGET = 512 * 1024;
const sizeBytes = Buffer.byteLength(script, 'utf8');
const sizeKb = (sizeBytes / 1024).toFixed(1);
const sizePct = (sizeBytes / SIZE_BUDGET * 100).toFixed(1);
console.log(`脚本体积：${sizeKb} KB（预算 ${SIZE_BUDGET / 1024} KB，使用 ${sizePct}%）${sizeBytes > SIZE_BUDGET ? ' ⚠ 已超出预算' : ''}`);

const changelog = readFileSync(CHANGELOG, 'utf8');
const changelogSection = extractChangelogSection(changelog, version);
/** 本地发版和 CI 门禁共用同一套版本/CHANGELOG 校验逻辑。 */
function verifyVersionAndChangelog() {
    if (changelogSection === null) {
        die(`CHANGELOG.md 里没有「## v${version}」章节：先补更新记录再发版`);
    }
    if (!changelogSection.trim()) {
        die(`CHANGELOG.md 的「## v${version}」章节是空的：补上变更内容再发版（空章节会让 Release 说明缺正文）`);
    }
    console.log(`✓ 版本号 ${version}，CHANGELOG 有对应章节且非空`);
}

// ------------------------------------------------- CI 门禁（release.yml 调用）
// 与本地流程复用上面同一套校验，额外要求「推送的 tag 必须正好等于 @version」。
const ciIdx = argv.indexOf('--check-ci');
if (ciIdx !== -1) {
    const tag = (argv[ciIdx + 1] || '').trim();
    if (!tag) die('--check-ci 需要一个 tag 参数，例如：node tools/release.mjs --check-ci v2.0.5');
    if (!/^v\d+\.\d+\.\d+$/.test(tag)) die(`--check-ci 的 tag 必须是 vX.Y.Z：${tag}`);
    verifyVersionAndChangelog();
    if (tag !== `v${version}`) {
        die(`tag ${tag} 与脚本 @version v${version} 不一致：推错 tag 会让 Release 挂上错误版本的脚本`);
    }
    console.log(`✓ CI 门禁通过：tag ${tag} = @version v${version}，CHANGELOG 章节存在且非空`);
    process.exit(0);
}

// ------------------------------------------------------------------ 本地发版
verifyVersionAndChangelog();

const tag = `v${version}`;
let hasTag = false;
try {
    execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: ROOT, stdio: 'ignore' });
    hasTag = true;
} catch { }
const headSha = tryGit(['rev-parse', 'HEAD']).out;

// 三项前置检查：正式发版是硬门禁；--dry-run 只警告，保证「脏工作区 + 离线」也能预检。
const problems = [];
const pass = title => console.log(`  ✓ ${title}`);
const gate = (title, detail = '') => {
    if (hardMode) {
        problems.push(title);
        console.log(`  ✗ ${title}`);
    } else {
        console.log(`  ⚠ ${title}（--dry-run 只警告，不阻断）`);
    }
    if (detail) console.log(detail.split('\n').map(l => `    ${l}`).join('\n'));
};
const step = (n, title) => console.log(`\n[前置 ${n}/3] ${title}`);

console.log(`\n前置检查${hardMode ? '（正式发版：硬门禁）' : '（--dry-run：只告警）'}`);

// 1) 工作区干净：发版必须基于已提交的状态，否则 tag 指向的提交和本地文件不一致
step(1, '工作区干净');
const st = tryGit(['status', '--porcelain', '--untracked-files=normal']);
if (!st.ok) {
    gate(`读不到 git 工作区状态：${errText(st.err)}`);
} else {
    const dirty = st.out.split('\n').filter(Boolean);
    if (dirty.length === 0) pass('工作区干净');
    else gate(`工作区有 ${dirty.length} 处未提交改动（发版只允许已提交的干净状态）`,
        dirty.slice(0, 10).join('\n') + (dirty.length > 10 ? `\n……还有 ${dirty.length - 10} 处` : ''));
}

// 2) 版本单调：@version 必须大于已有 tag 的最高版本，防止发版发回旧号
step(2, '版本号单调递增');
const tagList = tryGit(['tag', '-l', 'v*']);
if (!tagList.ok) {
    gate(`读不到本地 tag：${errText(tagList.err)}`);
} else {
    const known = tagList.out.split('\n').map(t => t.trim().replace(/^v/, '')).filter(v => VERSION_RE.test(v));
    const latest = known.length ? known.sort(cmpVersion)[known.length - 1] : null;
    const cmp = latest ? cmpVersion(version, latest) : 1;
    if (cmp > 0) {
        pass(latest ? `@version ${version} 大于最近 tag v${latest}` : `本地还没有版本 tag，${version} 是首个版本`);
    } else if (cmp === 0) {
        pass(`@version ${version} 与最近 tag v${latest} 相同（待推送的 tag 已存在，不重复创建）`);
    } else {
        gate(`@version ${version} 小于最近 tag v${latest}（版本号必须单调递增）`);
    }
    // tag 已经存在时，必须打在当前 HEAD 上；否则「重跑发版」会把旧提交重新发布
    if (hasTag) {
        const tagSha = tryGit(['rev-parse', '-q', '--verify', `refs/tags/${tag}^{commit}`]);
        if (!tagSha.ok || !tagSha.out) gate(`tag ${tag} 存在但解析不出提交`);
        else if (headSha && tagSha.out !== headSha) {
            gate(`tag ${tag} 已存在但不在 HEAD（${tagSha.out.slice(0, 7)} ≠ ${headSha.slice(0, 7)}）：先删掉 tag 或改成打新提交`);
        }
    }
}

// 3) 包含远端：origin/main 必须是 HEAD 的祖先，防止在落后远端的本地分支上发版
step(3, '包含 origin/main');
if (dryRun) {
    console.log('  ℹ️ --dry-run 不执行 git fetch（不联网；本地 origin/main 引用可能过期）');
} else {
    const fetched = tryGit(['fetch', '--prune', 'origin'], { timeout: 20000 });
    if (fetched.ok) console.log('  ℹ️ 已 git fetch --prune origin（20 秒超时）');
    else console.log(`  ⚠ git fetch 失败（网络/权限问题，降级使用本地 origin/main 引用）：${errText(fetched.err)}`);
}
const baseRef = tryGit(['rev-parse', '--verify', '-q', 'origin/main']);
if (!baseRef.ok || !baseRef.out) {
    gate('找不到 origin/main（没有配置远端或还没 fetch 过）');
} else if (tryGit(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']).ok) {
    pass('origin/main 是 HEAD 的祖先（没有落后远端）');
} else {
    gate('HEAD 没有包含 origin/main（远端有新提交，先 git pull --rebase origin main）');
}

if (problems.length) {
    console.error(`\n✗ 前置检查未通过（${problems.length} 项；正式发版拒绝继续）：`);
    for (const p of problems) console.error(`  - ${p}`);
    console.error('\n修好后重跑；只想预检可用 --dry-run（只告警不阻断）。');
    process.exit(1);
}

// ---------------------------------------------------------------------- 测试
if (!skipTests) {
    console.log('\n[1/4] 内置自检 + 文档数字');
    run(process.execPath, ['tools/selftest.mjs']);
    console.log('\n[2/4] 数据 / 文档一致性');
    run(process.execPath, ['tools/check-data.mjs']);
    console.log('\n[3/4] 工作流静态检查');
    run(process.execPath, ['tools/check-workflows.mjs']);
    console.log('\n[4/4] 面板冒烟（没有浏览器会跳过）');
    try { run(process.execPath, ['tools/panel-smoke.mjs']); }
    catch { console.log('  ℹ️ 面板冒烟没有可用浏览器，已跳过（CI 会用真实 Edge 跑）'); }
} else {
    console.log('ℹ️ --skip-tests：已跳过测试');
}

if (dryRun) {
    console.log(`\n--dry-run：前置检查只报告不阻断，未创建 tag。当前${hasTag ? '已有' : '没有'} tag ${tag}`);
    console.log(`正式发版预计打印的命令：git push origin main && git push origin ${tag}`);
    process.exit(0);
}

// ---------------------------------------------------------------- 创建 tag + 推送说明
if (hasTag) console.log(`\nℹ️ tag ${tag} 已存在，未重复创建`);
else {
    run('git', ['tag', '-a', tag, '-m', tag]);
    console.log(`\n✓ 已创建本地 tag ${tag}`);
}
console.log(`\n下一步（由人工推送；推送后 release.yml 自动发版）：`);
console.log(`  git push origin main && git push origin ${tag}`);
console.log(`  只推这一版 tag：一次推所有 tag 容易把没测过的历史 tag 也推上去。`);
console.log(`  然后在 Actions 里确认「发版」workflow 变绿，Release 自动出现。`);
