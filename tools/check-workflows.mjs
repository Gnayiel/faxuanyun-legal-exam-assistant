#!/usr/bin/env node
/**
 * GitHub Actions 工作流静态检查（无依赖、不联网、只读）。
 *
 *   node tools/check-workflows.mjs
 *
 * 在 CI 里跑得非常快，专门拦几种「平时看不出来、出事才知道」的配置漂移：
 *   1. 每个 workflow 都有 runs-on / permissions / timeout-minutes（避免无限卡住或权限过大）
 *   2. 第三方 action 一律 pin 到 40 位 commit SHA（tag 可以被人重新指向，SHA 不会）
 *   3. workflow 里引用的本地脚本（node tools/xxx.mjs）必须真实存在
 *   4. 禁止 pull_request_target + 检出 PR 代码的组合（会执行不可信代码，安全红线）
 *   5. 发版 workflow 必须在 push tag 时触发
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
const SHA_COMMENT = /#\s*v?[\w.-]+/;

let failed = 0;
const ok = (name, cond, extra = '') => {
    if (cond) { console.log(`  ✓ ${name}`); return; }
    failed++;
    console.log(`  ✗ ${name}${extra ? `  → ${extra}` : ''}`);
};

if (!existsSync(DIR)) { console.log('没有 .github/workflows 目录，跳过。'); process.exit(0); }
const files = readdirSync(DIR).filter(f => /\.ya?ml$/i.test(f)).sort();
ok('找到 workflow 文件', files.length > 0, `${files.length} 个`);

const texts = new Map(files.map(f => [f, readFileSync(join(DIR, f), 'utf8')]));

for (const f of files) {
    const t = texts.get(f);
    console.log(`\n[${f}]`);
    ok('有 name', /^name:\s*\S+/m.test(t));
    ok('有 runs-on', /^\s*runs-on:\s*\S+/m.test(t));
    ok('有 permissions（最小权限）', /^permissions:/m.test(t));
    ok('有 timeout-minutes（防止无限卡住）', /timeout-minutes:\s*\d+/m.test(t));

    // 第三方 action 必须 pin SHA；本地相对路径 action 不受限
    const uses = [...t.matchAll(/^\s*uses:\s*(\S+)/gm)].map(m => m[1]);
    const badPin = uses.filter(u => !u.startsWith('./') && !SHA_PIN.test(u));
    ok(`${uses.length} 个 action 全部 pin 到 commit SHA`, badPin.length === 0, badPin.join(', '));
    const noComment = uses.filter(u => !u.startsWith('./') && !SHA_COMMENT.test(t.split(u)[0].split('\n').pop() || ''));
    ok('pin 的 SHA 带版本注释（方便 Dependabot 升级）', noComment.length === 0, noComment.join(', '));

    // 引用的本地脚本必须存在
    const scripts = [...t.matchAll(/\bnode\s+(tools\/[\w.-]+\.mjs)\b/g)].map(m => m[1]);
    const missing = [...new Set(scripts)].filter(p => !existsSync(join(ROOT, p)));
    ok(`${[...new Set(scripts)].length} 个本地脚本都存在`, missing.length === 0, missing.join(', '));

    // 安全红线：pull_request_target 下检出 PR 代码 = 给外部 PR 执行任意代码的机会
    if (/pull_request_target/.test(t)) {
        const danger = /ref:\s*\$\{\{\s*github\.event\.pull_request\.head/;
        ok('危险组合：pull_request_target 不得检出 PR 代码', !danger.test(t));
    }
}

// 发版 workflow 必须由 tag push 触发，否则「推 tag 自动发版」不成立
const release = [...texts.entries()].find(([, t]) => /gh release (create|edit)/.test(t));
ok('存在自动发版的 workflow', !!release);
if (release) ok('发版 workflow 由 tag push 触发', /tags:\s*\[?\s*['"]?v\*/.test(release[1]), release[0]);

console.log(failed === 0 ? '\n工作流静态检查全部通过。\n' : `\n${failed} 项未通过。\n`);
process.exit(failed === 0 ? 0 : 1);
