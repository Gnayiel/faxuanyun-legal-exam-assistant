#!/usr/bin/env node
/**
 * 题库合并冒烟（离线、只读仓库、所有临时文件写系统临时目录）。
 *
 *   node tests/merge-smoke.mjs
 *
 * tools/merge-bank.mjs 是发版流程里唯一会「写题库」的工具，但以前没有任何自动测试：
 * 冲突计数、用户答案优先、错题并集、重复合并幂等、CSV 公式消毒都只能靠人肉验。
 * 这里构造两份最小题库，断言上面几条规则，并确认输入文件不被改写。
 *
 * 退出码：0 全部通过；1 有断言失败。
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const MERGE = join(ROOT, 'tools', 'merge-bank.mjs');

let failed = 0, total = 0;
const ok = (name, cond, extra = '') => {
    total++;
    if (cond) { console.log(`  ✓ ${name}`); return true; }
    failed++;
    console.error(`  ✗ ${name}${extra ? '  → ' + extra : ''}`);
    return false;
};

// 与用户脚本 / merge-bank 一致的归一化与主键算法（这里只用来构造键，不参与合并判断）
const normStem = s => String(s || '')
    .replace(/^\s*\d{1,3}\s*[、.．)）]\s*/, '')
    .replace(/[（(]\s*(单选|多选|判断)题?\s*[）)]/g, '')
    .replace(/\s+/g, '')
    .replace(/[A-Z]/g, c => c.toLowerCase())
    .replace(/[，,。.；;：:！!？?“”"'‘’（）()【】\[\]《》〈〉、\-—_~·…|｜]/g, '');
function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return (h >>> 0).toString(16).padStart(8, '0') + str.length.toString(36);
}
const fpKey = stem => '#' + hash32(normStem(stem));

const S1 = '1、限制人身自由的行政处罚权，只能由（ ）行使。';
const S2 = '2、行政诉讼中，对被诉行政行为的合法性承担举证责任的是（ ）。';
const S3 = '3、行政机关作出行政处罚决定前，应当告知当事人拟作出的处罚内容。';
const K1 = fpKey(S1), K2 = fpKey(S2), K3 = fpKey(S3);
const DANGEROUS = '=SUM(A1:A2) 公式注入题干';

const entry = (q, t, a, l, extra = {}) => ({
    q, t, s: '学法考试', a, l, src: 'exam', by: '', ts: 1000, us: 0, hit: 0, ok: 0, bad: 0, cft: 0, ...extra,
});
const wrap = (bank, wrong = {}) => ({
    // 合成夹具：版本/日期只用于导出字段，不代表仓库当前的题库快照。
    format: 'faxuanyun-legal-exam-bank', schema: 2, version: '3.0.0',
    exportedAt: '2026-10-27T00:00:00.000Z', count: Object.keys(bank).length, bank, wrong,
});

const dir = mkdtempSync(join(tmpdir(), 'fx-merge-smoke-'));
const out = name => join(dir, name);
const runMerge = (...args) => spawnSync(process.execPath, [MERGE, ...args], { cwd: dir, encoding: 'utf8' });

try {
    // 输入 A：K1 同答案；K2 脚本答案 A/原告；K3 用户手改答案 B/错误
    const a = wrap({
        [K1]: entry(S1, 'single', ['公安机关'], 'B', { hit: 5, ok: 3 }),
        [K2]: entry(S2, 'single', ['原告'], 'A', { hit: 2, ok: 1, ts: 1000 }),
        [K3]: entry(S3, 'judge', ['错误'], 'B', { hit: 1, ok: 1, by: 'user', src: 'user', ts: 1000 }),
    }, {
        [K2]: { q: S2, w: ['原告'], tried: [] },
    });
    // 输入 B：K1 同答案但计数更高；K2 更新（ts 更大）的脚本答案 B/被告；K3 脚本答案 A/正确
    const b = wrap({
        [K1]: entry(S1, 'single', ['公安机关'], 'B', { hit: 9, ok: 4, ts: 3000 }),
        [K2]: entry(S2, 'single', ['被告'], 'B', { hit: 4, ok: 2, ts: 2000 }),
        [K3]: entry(S3, 'judge', ['正确'], 'A', { hit: 3, ok: 2, ts: 2000 }),
    }, {
        [K2]: { q: S2, w: ['原告', '被告'], tried: [] },
    });
    const aText = JSON.stringify(a, null, 2) + '\n';
    const bText = JSON.stringify(b, null, 2) + '\n';
    writeFileSync(out('a.json'), aText);
    writeFileSync(out('b.json'), bText);

    console.log('\n[1/3] 合并两份 JSON：计数取 max / 冲突取新 / 用户优先 / 错题并集');
    let r = runMerge('a.json', 'b.json', '-o', 'merged.json', '--csv', 'merged.csv', '--quiet');
    const mergedOk = ok('merge-bank 退出码 0', r.status === 0, String(r.stderr || r.stdout || '').slice(0, 300));
    const merged = mergedOk ? JSON.parse(readFileSync(out('merged.json'), 'utf8')) : { bank: {}, wrong: {} };
    const mb = merged.bank || {};
    ok('输出结构正确（format / schema / count）',
        merged.format === 'faxuanyun-legal-exam-bank' && merged.schema === 2 && merged.count === 3,
        JSON.stringify({ format: merged.format, schema: merged.schema, count: merged.count }));
    ok('唯一题数为 3', Object.keys(mb).length === 3, String(Object.keys(mb).length));
    ok('同答案命中次数取 max（5 与 9 → 9）', mb[K1] && mb[K1].hit === 9, String(mb[K1] && mb[K1].hit));
    ok('脚本答案冲突时保留较新答案（B / 被告）',
        mb[K2] && mb[K2].l === 'B' && Array.isArray(mb[K2].a) && mb[K2].a[0] === '被告',
        JSON.stringify(mb[K2] && { l: mb[K2].l, a: mb[K2].a }));
    ok('脚本答案冲突计数 cft = 1', mb[K2] && mb[K2].cft === 1, String(mb[K2] && mb[K2].cft));
    ok('用户答案优先于脚本答案（B / 错误 / by=user）',
        mb[K3] && mb[K3].l === 'B' && mb[K3].a[0] === '错误' && mb[K3].by === 'user',
        JSON.stringify(mb[K3] && { l: mb[K3].l, a: mb[K3].a, by: mb[K3].by }));
    ok('错题记录取并集并去重（原告 + 被告）',
        merged.wrong && merged.wrong[K2]
        && merged.wrong[K2].w.slice().sort().join('|') === ['原告', '被告'].sort().join('|'),
        JSON.stringify(merged.wrong && merged.wrong[K2]));

    console.log('\n[2/3] 幂等：同一份输入合并两次，结果除 exportedAt 外完全一致');
    r = runMerge('a.json', 'b.json', '-o', 'merged2.json', '--quiet');
    const merged2Ok = ok('第二次合并退出码 0', r.status === 0, String(r.stderr || '').slice(0, 300));
    const merged2 = merged2Ok ? JSON.parse(readFileSync(out('merged2.json'), 'utf8')) : { bank: {} };
    const stable = o => {
        const copy = { ...o };
        delete copy.exportedAt;
        return JSON.stringify(copy);
    };
    ok('两次合并结果一致（exportedAt 之外）', stable(merged) === stable(merged2));
    ok('重复合并不把冲突计数灌水（cft 仍为 1）',
        merged2.bank && merged2.bank[K2] && merged2.bank[K2].cft === 1,
        String(merged2.bank && merged2.bank[K2] && merged2.bank[K2].cft));

    console.log('\n[3/3] CSV 公式注入消毒 + 输入只读');
    const csv = readFileSync(out('merged.csv'), 'utf8').replace(/^\uFEFF/, '');
    const csvLines = csv.trim().split(/\r?\n/);
    ok('CSV 行数 = 表头 + 3 条数据', csvLines.length === 4, String(csvLines.length));
    ok('CSV 表头正确', csvLines[0] === '序号,题型,题目,正确答案,错误选项,来源', csvLines[0]);

    const danger = wrap({ [fpKey(DANGEROUS)]: entry(DANGEROUS, 'single', ['选项A'], 'A', { hit: 0 }) });
    writeFileSync(out('danger.json'), JSON.stringify(danger, null, 2));
    r = runMerge('danger.json', '-o', 'danger-out.json', '--csv', 'danger-out.csv', '--quiet');
    const dangerOk = ok('公式题干合并退出码 0', r.status === 0, String(r.stderr || '').slice(0, 300));
    const dangerJson = dangerOk ? JSON.parse(readFileSync(out('danger-out.json'), 'utf8')) : { bank: {} };
    const dangerCsv = dangerOk ? readFileSync(out('danger-out.csv'), 'utf8').replace(/^\uFEFF/, '') : '';
    ok('JSON 保留原始题干（仍可被脚本导入）',
        dangerJson.bank[fpKey(DANGEROUS)] && dangerJson.bank[fpKey(DANGEROUS)].q === DANGEROUS);
    ok('CSV 单元格前加单引号消毒（Excel 不再当公式执行）',
        dangerCsv.includes("'=SUM(A1:A2)"), dangerCsv.split(/\r?\n/).find(l => l.includes('=SUM')) || '');

    ok('输入文件未被改写', readFileSync(out('a.json'), 'utf8') === aText && readFileSync(out('b.json'), 'utf8') === bText);
} finally {
    rmSync(dir, { recursive: true, force: true });
}

console.log(failed === 0 ? `\n题库合并冒烟全部通过（${total} 项断言）。\n` : `\n${total - failed}/${total} 通过，${failed} 项失败。\n`);
process.exit(failed === 0 ? 0 : 1);
