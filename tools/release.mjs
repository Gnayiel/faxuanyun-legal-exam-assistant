#!/usr/bin/env node
/**
 * 本地发版助手：把「版本号 → 跑测试 → 打 tag」串成一条命令。
 *
 *   node tools/release.mjs              # 跑测试 + 打本地 tag，并打印推送命令
 *   node tools/release.mjs --dry-run    # 只检查，不创建 tag
 *   node tools/release.mjs --skip-tests # 跳过测试（不推荐；CI 里还会再跑一遍）
 *
 * 推送 tag 后，GitHub Actions 的 .github/workflows/release.yml 会自动：
 *   再跑一遍门禁 → 创建 Release → 上传 .user.js 与同名 .sha256。
 * 本脚本不联网、不推送，避免把 token / 网络问题带进发版流程。
 */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const USER_JS = join(ROOT, 'faxuanyun-legal-exam-assistant.user.js');
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const skipTests = argv.includes('--skip-tests');

const die = msg => { console.error(`✗ ${msg}`); process.exit(1); };
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });

const script = readFileSync(USER_JS, 'utf8');
const version = (script.match(/^\/\/ @version\s+(\S+)/m) || [])[1];
if (!version) die('读不到用户脚本的 @version');
if (!/^\d+\.\d+\.\d+$/.test(version)) die(`@version 不是 x.y.z：${version}`);

const changelog = readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8');
if (!new RegExp(`^## v${version.replace(/\./g, '\\.')}$`, 'm').test(changelog)) {
    die(`CHANGELOG.md 里没有「## v${version}」章节：先补更新记录再发版`);
}
console.log(`✓ 版本号 ${version}，CHANGELOG 有对应章节`);

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

const tag = `v${version}`;
let hasTag = false;
try { execFileSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: ROOT }); hasTag = true; } catch { }

if (dryRun) {
    console.log(`\n--dry-run：未创建 tag。当前${hasTag ? '已有' : '没有'} tag ${tag}`);
    process.exit(0);
}
if (hasTag) console.log(`ℹ️ tag ${tag} 已存在，未重复创建`);
else {
    run('git', ['tag', '-a', tag, '-m', tag]);
    console.log(`\n✓ 已创建本地 tag ${tag}`);
}
console.log(`\n下一步（由人工推送；推送后 release.yml 自动发版）：`);
console.log(`  git push origin main --tags`);
console.log(`  然后在 Actions 里确认「发版」workflow 变绿，Release 自动出现。`);
