#!/usr/bin/env node
/**
 * 统一门禁（本地 / GitHub Actions / release.mjs 共用同一份步骤）。
 *
 *   node tools/ci.mjs              # 全部步骤
 *   node tools/ci.mjs --no-browser # 跳过需要真实浏览器的两项冒烟（无浏览器环境自检用）
 *
 * 以前 selftest.yml、release.yml 和 tools/release.mjs 各手抄一遍测试命令，改一处漏一处：
 * release.yml 少了页面冒烟、release.mjs 用 try/catch 把浏览器缺失吞成「已跳过」，
 * 于是「测试失败也能打 tag」这种假绿就出现了。现在只维护这一份清单：
 *   语法 → 内置自检 → 数据/文档 → 工作流 → 题库合并 → 面板冒烟 → 页面适配冒烟
 * 任何一步非零退出就整体失败，不吞异常。
 *
 * 退出码：0 全部通过；1 有步骤失败。
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const NO_BROWSER = process.argv.includes('--no-browser');

/** [展示名, node 参数]；顺序即执行顺序，失败即停。 */
const ALL_STEPS = [
    ['语法检查', ['tools/check-syntax.mjs']],
    ['内置自检 + 文档数字', ['tools/selftest.mjs']],
    ['数据 / 文档一致性', ['tools/check-data.mjs']],
    ['工作流静态检查', ['tools/check-workflows.mjs']],
    ['题库合并冒烟（冲突 / 幂等 / 公式消毒）', ['tools/merge-smoke.mjs']],
    ['面板冒烟（需要真实浏览器）', ['tools/panel-smoke.mjs', '--require-browser']],
    ['页面适配冒烟（需要真实浏览器）', ['tools/page-smoke.mjs', '--require-browser']],
];
const steps = NO_BROWSER
    ? ALL_STEPS.filter(([, args]) => !args.includes('--require-browser'))
    : ALL_STEPS;

console.log(`统一门禁：共 ${steps.length} 步${NO_BROWSER ? '（--no-browser：跳过浏览器冒烟）' : ''}\n`);
for (let i = 0; i < steps.length; i++) {
    const [name, args] = steps[i];
    console.log(`\n[${i + 1}/${steps.length}] ${name}`);
    console.log(`  $ node ${args.join(' ')}`);
    const r = spawnSync(process.execPath, args, { cwd: ROOT, stdio: 'inherit' });
    if (r.error) {
        console.error(`\n✗ 无法启动 ${name}：${r.error.message}`);
        process.exit(1);
    }
    if (r.status !== 0) {
        console.error(`\n✗ 门禁未通过：${name} 退出码 ${r.status === null ? r.signal : r.status}`);
        console.error('  后续步骤未执行；修好后重跑 node tools/ci.mjs。');
        process.exit(1);
    }
}
console.log(`\n✓ 统一门禁全部通过（${steps.length} 步）。\n`);
