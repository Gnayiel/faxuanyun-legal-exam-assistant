#!/usr/bin/env node
/**
 * 数据 / 文档一致性校验（无依赖、不联网、不写盘）。
 *
 *   node tools/check-data.mjs [YYYYMMDD] [--warn-only] [--fix]
 *
 * 校验仓库里随附的题库快照与 README / data/README.md 里写死的数字是否一致：
 *   1. data/ 下同一日期戳的 .json 与 .csv 成对存在
 *   2. JSON 内部自洽：format/schema/count/bank 条数、题型分布、题目字段、重复题干、错误记录
 *   3. CSV 与 JSON 一一对应：条数、题型分布、六列表头、序号连续
 *   4. README.md 与 data/README.md 的「N 题（单选 X / 多选 Y / 判断 Z）」与实际数字一致
 *
 * 这些数字在 README 里是手写的，发版/换快照时最容易忘。CI 会跑这个脚本兜底。
 * 加 --fix 时，会把 README / data/README 里写错的数字直接改成本次实测值（默认只报告不改）。
 * 退出码：0 全部通过；1 有硬错误（--warn-only 时降级为 0）。
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const DATA = join(ROOT, 'data');
const LABEL = { single: '单选', multi: '多选', judge: '判断' };

let failed = 0;
const ok = (name, cond, extra = '') => {
    if (cond) { console.log(`  ✓ ${name}`); return; }
    failed++;
    console.log(`  ✗ ${name}${extra ? `  → ${extra}` : ''}`);
};
const readDoc = p => { try { return readFileSync(join(ROOT, p), 'utf8'); } catch { return ''; } };

/** 极简 CSV 解析：支持引号、转义引号、CRLF、BOM */
function parseCsv(text) {
    const t = String(text || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [], field = '', inQ = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (inQ) {
            if (c === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
            else field += c;
        } else if (c === '"') inQ = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); field = ''; rows.push(row); row = []; }
        else if (c !== '\r') field += c;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(x => x !== ''));
}

const normStem = s => String(s || '')
    .replace(/^\s*\d{1,3}\s*[、.．)）]\s*/, '')
    .replace(/[（(]\s*(单选|多选|判断)题?\s*[）)]/g, '')
    .replace(/\s+/g, '')
    .replace(/[A-Z]/g, c => c.toLowerCase())
    .replace(/[，,。.；;：:！!？?“”"'‘’（）()【】\[\]《》〈〉、\-—_~·…|｜]/g, '');

const normStemShort = s => (s || '').replace(/\s+/g, '');
const prefixSame = (a, b) => {
    const x = normStem(a), y = normStem(b);
    if (!x || !y) return false;
    if (x === y) return true;
    const [s, l] = x.length <= y.length ? [x, y] : [y, x];
    return s.length >= 30 && l.startsWith(s);
};

console.log('\n[1/3] 找快照文件');
const files = readdirSync(DATA).filter(f => /^faxuanyun-legal-exam-bank-\d{8}\.(json|csv)$/.test(f));
const snapshotJsonCount = files.filter(f => f.endsWith('.json')).length;
ok('data/ 只保留一份题库快照（旧版本交给 git 历史）', snapshotJsonCount <= 1,
    `发现 ${snapshotJsonCount} 份 JSON：${files.join(', ')}`);
const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
ok('data/ 下有题库快照 JSON', jsonFiles.length > 0, files.join(', ') || '（空）');
if (!jsonFiles.length) process.exit(1);
const wantDate = process.argv.slice(2).find(a => /^\d{8}$/.test(a));
const jsonName = wantDate ? `faxuanyun-legal-exam-bank-${wantDate}.json` : jsonFiles[jsonFiles.length - 1];
const date = (jsonName.match(/(\d{8})/) || [])[1];
const csvName = jsonName.replace(/\.json$/, '.csv');
ok(`快照 ${date} 成对（.json + .csv）`, files.includes(csvName), `缺 ${csvName}`);

console.log('\n[2/3] 校验 JSON 与 CSV');
const snap = JSON.parse(readFileSync(join(DATA, jsonName), 'utf8'));
const bank = (snap && snap.bank) || {};
const entries = Object.values(bank);
const count = entries.length;
ok('format 是题库导出格式', snap.format === 'faxuanyun-legal-exam-bank', String(snap.format));
ok('schema 为 2', snap.schema === 2, String(snap.schema));
ok('count 与 bank 实际条数一致', snap.count === count, `count=${snap.count} bank=${count}`);
const validAnswer = e => !!e && ((e.l && (/^[A-Z]+$/.test(e.l) || (e.t === 'judge' && /^[01]$/.test(e.l))))
    || (Array.isArray(e.a) && e.a.length > 0));
const badField = entries.filter(e => !e || !e.q || !LABEL[e.t] || !validAnswer(e));
ok('每个条目都有题干 / 合法题型 / 答案', badField.length === 0, `${badField.length} 条异常`);
const typeCount = { single: 0, multi: 0, judge: 0 };
entries.forEach(e => { if (typeCount[e.t] !== undefined) typeCount[e.t]++; });
const wrongN = Object.keys(snap.wrong || {}).length;
const dupStems = [];
const seen = new Map();
for (const e of entries) {
    const k = normStem(e.q);
    if (seen.has(k)) dupStems.push(k.slice(0, 20));
    else seen.set(k, 1);
}
ok('没有归一化后重复的题干', dupStems.length === 0, dupStems.slice(0, 3).join(' | '));

const rows = parseCsv(readFileSync(join(DATA, csvName), 'utf8'));
const header = rows[0] || [];
ok('CSV 六列表头正确', header.join(',') === '序号,题型,题目,正确答案,错误选项,来源', header.join(','));
const body = rows.slice(1);
ok(`CSV 条数与 JSON 一致（${count}）`, body.length === count, `csv=${body.length}`);
const csvType = { 单选: 0, 多选: 0, 判断: 0 };
let seqOk = true;
body.forEach((r, i) => {
    if (String(i + 1) !== String(r[0]).trim()) seqOk = false;
    if (csvType[r[1]] !== undefined) csvType[r[1]]++;
});
ok('CSV 序号从 1 连续到 N', seqOk);
ok('CSV 与 JSON 题型分布一致',
    ['single', 'multi', 'judge'].every(t => csvType[LABEL[t]] === typeCount[t]),
    `csv=${JSON.stringify(csvType)} json=${JSON.stringify(typeCount)}`);
ok('错误记录为空（随仓库快照不放错题）', wrongN === 0, `${wrongN} 条`);

console.log('\n[3/3] 校验文档里写死的数字');
const readme = readDoc('README.md');
const dataReadme = readDoc('data/README.md');
const num = n => `(\\d+)\\s*`;   // eslint-disable-line no-unused-vars
const m1 = readme.match(/(\d+)\s*题（单选\s*(\d+)\s*\/\s*多选\s*(\d+)\s*\/\s*判断\s*(\d+)/);
ok('README 写了快照「N 题（单选 / 多选 / 判断）」', !!m1, '找不到数字段落');
if (m1) {
    const [n, s, mu, j] = m1.slice(1).map(Number);
    ok('README 快照数字与实际一致', n === count && s === typeCount.single && mu === typeCount.multi && j === typeCount.judge,
        `README=${n}/${s}/${mu}/${j} 实际=${count}/${typeCount.single}/${typeCount.multi}/${typeCount.judge}`);
}
// 目录树属维护者向内容，已迁到 CONTRIBUTING.md
const contributing = readDoc('CONTRIBUTING.md');
const m2 = contributing.match(/随仓库分发的 (\d+) 题快照（6 列）/);
ok('CONTRIBUTING 目录树里写的是 6 列 / N 题快照', !!m2 && Number(m2[1]) === count, m2 ? m2[0] : '找不到');
const m3 = dataReadme.match(/\*\*(\d+) 题\*\*（单选\s*(\d+)\s*\/\s*多选\s*(\d+)\s*\/\s*判断\s*(\d+)/);
ok('data/README 写了快照数字', !!m3, '找不到数字段落');
if (m3) {
    const [n, s, mu, j] = m3.slice(1).map(Number);
    ok('data/README 快照数字与实际一致', n === count && s === typeCount.single && mu === typeCount.multi && j === typeCount.judge,
        `data/README=${n}/${s}/${mu}/${j} 实际=${count}/${typeCount.single}/${typeCount.multi}/${typeCount.judge}`);
}
ok('data/README 说明了解析快照的 version 只是溯源', /version|溯源/.test(dataReadme));
const script = readDoc('faxuanyun-legal-exam-assistant.user.js');
const scriptVer = (script.match(/^\/\/ @version\s+(\S+)/m) || [])[1] || '';
if (snap.version && scriptVer && snap.version !== scriptVer) {
    console.log(`  ℹ️ 快照 JSON version=${snap.version}（导出时的脚本版本，仅溯源用），当前脚本 ${scriptVer}`);
}

const warnOnly = process.argv.includes('--warn-only');
const doFix = process.argv.includes('--fix');
const fixes = [];
const planFix = (file, from, to, label) => { if (doFix && from && from !== to) fixes.push({ file, from, to, label }); };
if (doFix) {
    const exp = `${count} 题（单选 ${typeCount.single} / 多选 ${typeCount.multi} / 判断 ${typeCount.judge}`;
    if (m1) planFix('README.md', m1[0], exp, 'README 快照数字');
    if (m2) planFix('CONTRIBUTING.md', m2[0], `随仓库分发的 ${count} 题快照（6 列）`, 'README 目录树数字');
    if (m3) planFix('data/README.md', m3[0], `**${count} 题**（单选 ${typeCount.single} / 多选 ${typeCount.multi} / 判断 ${typeCount.judge}`, 'data/README 快照数字');
    for (const f of fixes) {
        const text = readDoc(f.file);
        if (!text.includes(f.from)) { console.log(`  ⚠️ ${f.label}：找不到待修正原文，已跳过`); continue; }
        writeFileSync(join(ROOT, f.file), text.replace(f.from, f.to), 'utf8');
        console.log(`  ✏️ 已修正 ${f.label}：${f.from} → ${f.to}`);
    }
    if (!fixes.length) console.log('  ℹ️ 文档数字已经一致，无需修正');
    else console.log('  ℹ️ 已按实测值修正文档，建议再跑一次 check-data 确认全绿');
}
console.log(failed === 0 ? '\n全部通过。\n' : `\n${failed} 项未通过。\n`);
process.exit(failed === 0 || warnOnly ? 0 : 1);
