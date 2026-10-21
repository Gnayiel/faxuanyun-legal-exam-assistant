#!/usr/bin/env node
/**
 * 语法检查（无依赖、不联网、只读）。
 *
 *   node tools/check-syntax.mjs
 *
 * 以前 `npm run check` 只检查用户脚本 + 各工具的语义检查，新增的 .mjs 如果没有被
 * 单独 node --check，语法错误要等到真正执行时才暴露（CI 里表现为某一步莫名失败）。
 * 这里统一扫 tools/、tests/ 下所有 .mjs 和单文件用户脚本，并顺手校验 package.json 是合法 JSON。
 *
 * 退出码：0 全部通过；1 有文件语法错误。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const USER_JS = join(ROOT, 'faxuanyun-legal-exam-assistant.user.js');
const TOOLS = join(ROOT, 'tools');
const TESTS = join(ROOT, 'tests');

let failed = 0;
const ok = (name, cond, extra = '') => {
    if (cond) { console.log(`  ✓ ${name}`); return; }
    failed++;
    console.error(`  ✗ ${name}${extra ? `  → ${extra}` : ''}`);
};

const listScripts = dir => readdirSync(dir)
    .filter(f => f.endsWith('.mjs'))
    .sort()
    .map(f => join(dir, f));
const targets = [USER_JS, ...listScripts(TOOLS), ...listScripts(TESTS)];

console.log(`\n[1/2] 语法检查（${targets.length} 个文件）`);
for (const file of targets) {
    const rel = file.slice(ROOT.length + 1);
    try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
        ok(rel, true);
    } catch (e) {
        const msg = String((e.stderr && e.stderr.toString()) || e.message || e).trim();
        ok(rel, false, msg.split('\n').slice(0, 5).join(' | '));
    }
}

console.log('\n[2/2] package.json 可解析');
try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    ok('package.json 是合法 JSON 且有 version', typeof pkg.version === 'string' && pkg.version.length > 0);
} catch (e) {
    ok('package.json 是合法 JSON', false, String(e.message || e));
}

console.log(failed === 0 ? `\n语法检查全部通过（${targets.length} 个脚本 + package.json）。\n` : `\n${failed} 项未通过。\n`);
process.exit(failed === 0 ? 0 : 1);
