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
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
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
const jsonFiles = files.filter(f => f.endsWith('.json')).sort();
const csvFiles = files.filter(f => f.endsWith('.csv')).sort();
ok('data/ 只保留一份题库快照 JSON（旧版本交给 git 历史）', jsonFiles.length === 1,
    `发现 ${jsonFiles.length} 份 JSON：${jsonFiles.join(', ') || '（空）'}`);
ok('data/ 只保留一份题库快照 CSV（旧版本交给 git 历史）', csvFiles.length === 1,
    `发现 ${csvFiles.length} 份 CSV：${csvFiles.join(', ') || '（空）'}`);
if (!jsonFiles.length || !csvFiles.length) process.exit(1);
const wantDate = process.argv.slice(2).find(a => /^\d{8}$/.test(a));
const jsonName = wantDate ? `faxuanyun-legal-exam-bank-${wantDate}.json` : jsonFiles[0];
const date = (jsonName.match(/(\d{8})/) || [])[1];
const csvName = jsonName.replace(/\.json$/, '.csv');
ok(`快照 ${date} 的 JSON / CSV 成对且无孤儿文件`, csvFiles.length === 1 && csvFiles[0] === csvName,
    `期望 ${csvName}，实际 ${csvFiles.join(', ') || '（空）'}`);

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

// CSV 是给人看 / 给 Excel 的导出，最容易出现「JSON 改了、CSV 没同步」。逐行按顺序比对，
// 而不是只比题型分布——题干、答案、题型任何一列漂移都要在 CI 里暴露。
const stripLeadApostrophe = s => String(s === null || s === undefined ? '' : s).replace(/^'/, '');
const csvAnswerOf = e => (Array.isArray(e.a) && e.a.length ? e.a.join('; ') : (e.l || ''));
const rowIssues = [];
body.forEach((r, i) => {
    const e = entries[i];
    if (!e) { rowIssues.push(`第 ${i + 2} 行：JSON 没有对应条目`); return; }
    const csvQ = stripLeadApostrophe(r[2]).trim();
    if (csvQ !== String(e.q || '').trim()) rowIssues.push(`第 ${i + 2} 行题干不一致`);
    const csvA = stripLeadApostrophe(r[3]).trim();
    const jsonA = String(csvAnswerOf(e)).trim();
    if (csvA !== jsonA) rowIssues.push(`第 ${i + 2} 行答案不一致（CSV=${csvA} JSON=${jsonA}）`);
    if (String(r[1]).trim() !== (LABEL[e.t] || '')) rowIssues.push(`第 ${i + 2} 行题型不一致`);
});
ok('CSV 与 JSON 逐行一致（题干 / 答案 / 题型）', rowIssues.length === 0, rowIssues.slice(0, 3).join(' | '));

// Excel / WPS 公式注入：以 = + - @ 或 TAB/CR 开头的单元格可能被执行。
// 导出工具会在前面加一个单引号消毒；这里同时接受「已消毒」与「本来安全」的单元格。
const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const riskyFormula = v => {
    const s = String(v === null || v === undefined ? '' : v);
    return s.startsWith("'") ? false : FORMULA_PREFIX.test(s);
};
const riskyCells = [];
body.forEach((r, i) => {
    for (const col of [2, 3, 4]) {
        if (riskyFormula(r[col])) riskyCells.push(`第 ${i + 2} 行第 ${col + 1} 列`);
    }
});
ok('CSV 无未消毒的公式前缀（= + - @ / TAB / CR）', riskyCells.length === 0, riskyCells.slice(0, 5).join(' | '));

// 扫描器自身的负例：不能保证真实快照里永远没有危险单元格，否则这段检查可能悄悄失效。
const riskySamples = ['=1+1', '+x', '-x', '@x', '\tx', '\rx'];
ok('公式前缀扫描负例：危险单元格必须被识别', riskySamples.every(riskyFormula));
ok('公式前缀扫描负例：前加单引号消毒后不误报', riskySamples.every(v => !riskyFormula("'" + v)));

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
// 目录树属维护者向内容，已迁到 docs/DEVELOPMENT.md
const development = readDoc('docs/DEVELOPMENT.md');
const m2 = development.match(/随仓库分发的 (\d+) 题快照（6 列）/);
ok('DEVELOPMENT 目录树里写的是 6 列 / N 题快照', !!m2 && Number(m2[1]) === count, m2 ? m2[0] : '找不到');
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
    if (m2) planFix('docs/DEVELOPMENT.md', m2[0], `随仓库分发的 ${count} 题快照（6 列）`, 'DEVELOPMENT 目录树数字');
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
// ---------- 题库 JSON Schema 校验（v2.0.14）----------
// data/bank.schema.json 不只是给人看的约定：这里用同一份 schema 校验随仓库分发的快照，
// 保证「文档写的格式」与「文件实际的格式」不会各走各的。只实现用到的关键字，不引第三方依赖。
const schemaPath = join(DATA, 'bank.schema.json');
if (!existsSync(schemaPath)) {
    ok('存在 data/bank.schema.json', false);
} else {
    ok('存在 data/bank.schema.json', true);
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    const typeOf = v => Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v;
    const resolveRef = ref => {
        const p = ref.replace(/^#\//, '').split('/');
        let cur = schema;
        for (const k of p) cur = cur && cur[k];
        return cur || null;
    };
    const errs = [];
    const check = (val, sc, path) => {
        if (!sc || typeof sc !== 'object') return;
        if (sc.$ref) return check(val, resolveRef(sc.$ref), path);
        if (sc.const !== undefined && val !== sc.const) errs.push(`${path}: 期望常量 ${JSON.stringify(sc.const)}，实际 ${JSON.stringify(val)}`);
        if (sc.enum && !sc.enum.includes(val)) errs.push(`${path}: 不在枚举 ${JSON.stringify(sc.enum)} 内（实际 ${JSON.stringify(val)}）`);
        if (sc.type) {
            const t = typeOf(val);
            const want = Array.isArray(sc.type) ? sc.type : [sc.type];
            // integer 是 number 的细化
            const hitType = want.some(w => (w === 'integer' ? Number.isInteger(val) : w === 'number' ? typeof val === 'number' : w === t));
            if (!hitType) errs.push(`${path}: 类型应为 ${want.join('|')}，实际 ${t}`);
        }
        if (typeof val === 'string') {
            if (sc.minLength !== undefined && val.length < sc.minLength) errs.push(`${path}: 长度 ${val.length} < ${sc.minLength}`);
            if (sc.pattern && !new RegExp(sc.pattern).test(val)) errs.push(`${path}: 不匹配 ${sc.pattern}`);
        }
        if (typeof val === 'number' && sc.minimum !== undefined && val < sc.minimum) errs.push(`${path}: ${val} < minimum ${sc.minimum}`);
        if (typeof val === 'number' && sc.maximum !== undefined && val > sc.maximum) errs.push(`${path}: ${val} > maximum ${sc.maximum}`);
        if (typeOf(val) === 'object') {
            for (const req of sc.required || []) if (!(req in val)) errs.push(`${path}: 缺必填字段 ${req}`);
            const props = sc.properties || {};
            for (const [k, v] of Object.entries(val)) {
                if (props[k]) check(v, props[k], `${path}.${k}`);
                else if (sc.additionalProperties === false) errs.push(`${path}: 不允许的字段 ${k}`);
                else if (sc.additionalProperties && typeof sc.additionalProperties === 'object') check(v, sc.additionalProperties, `${path}.${k}`);
            }
        }
        if (typeOf(val) === 'array' && sc.items) val.forEach((x, i) => check(x, sc.items, `${path}[${i}]`));
        if (Array.isArray(sc.oneOf)) {
            let matched = 0;
            for (const sub of sc.oneOf) {
                const mark = errs.length;
                check(val, sub, path);
                if (errs.length === mark) matched++;
                else errs.length = mark;
            }
            // oneOf 的语义是「恰好命中一个」：命中 0 个和 2 个都不合法
            if (matched === 0) errs.push(`${path}: 不符合 oneOf 任一分支`);
            else if (matched > 1) errs.push(`${path}: 同时符合 ${matched} 个 oneOf 分支（应恰好 1 个）`);
        }
    };
    // 检查器负例自测：schema 校验退化（pattern 失效、oneOf 分支数错）时必须报警而不是放行。
    const sampleErrors = (val, sc) => { errs.length = 0; check(val, sc, '$'); return errs.slice(); };
    ok('schema 负例：类型不符必须报错',
        sampleErrors({ v: 'x' }, { type: 'object', properties: { v: { type: 'integer' } } }).length > 0);
    ok('schema 负例：枚举外的值必须报错', sampleErrors('x', { enum: ['a', 'b'] }).length > 0);
    ok('schema 负例：pattern 不匹配必须报错',
        sampleErrors('abc', { type: 'string', pattern: '^\\d+$' }).length > 0);
    ok('schema 负例：minimum / maximum 越界必须报错',
        sampleErrors(-1, { type: 'integer', minimum: 0 }).length > 0
        && sampleErrors(11, { type: 'integer', maximum: 10 }).length > 0);
    ok('schema 负例：oneOf 两个分支同时命中必须报错',
        sampleErrors('a', { oneOf: [{ type: 'string' }, { minLength: 1 }] }).length > 0);
    ok('schema 正例：oneOf 恰好命中一个分支时零错误',
        sampleErrors('a', { oneOf: [{ type: 'string' }, { type: 'integer' }] }).length === 0);

    const snapshot = JSON.parse(readFileSync(join(DATA, jsonName), 'utf8'));
    check(snapshot, schema, '$');
    ok('题库 JSON 通过 data/bank.schema.json 校验', errs.length === 0, errs.slice(0, 5).join('；'));

    // schema 文件由文档维护者演进，未必把 exportedAt / cft / wrong 全写成 required；
    // 但仓库随附快照必须满足这些语义，否则脚本导入后会拿到坏数据。
    const isPlainObject = v => !!v && typeof v === 'object' && !Array.isArray(v);
    const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
    const semanticIssues = (s, bankObj = bank) => {
        const issues = [];
        if (typeof s.exportedAt !== 'string' || !s.exportedAt.trim()) {
            issues.push('exportedAt 缺失');
        } else if (!ISO_UTC.test(s.exportedAt) || Number.isNaN(Date.parse(s.exportedAt))) {
            issues.push(`exportedAt 不是 ISO-8601 UTC：${s.exportedAt}`);
        }
        if (!isPlainObject(s.wrong)) {
            issues.push('wrong 不是对象');
        } else {
            for (const [k, w] of Object.entries(s.wrong)) {
                if (!isPlainObject(w)) { issues.push(`wrong[${k}] 不是对象`); continue; }
                if (w.q !== undefined && typeof w.q !== 'string') issues.push(`wrong[${k}].q 不是字符串`);
                for (const f of ['w', 'tried']) {
                    if (w[f] !== undefined && (!Array.isArray(w[f]) || !w[f].every(x => typeof x === 'string'))) {
                        issues.push(`wrong[${k}].${f} 不是字符串数组`);
                    }
                }
                if (w.w === undefined && w.tried === undefined) issues.push(`wrong[${k}] 既没有 w 也没有 tried`);
            }
        }
        for (const [k, e] of Object.entries(bankObj || {})) {
            if (!isPlainObject(e)) { issues.push(`bank[${k}] 不是对象`); continue; }
            if (e.cft !== undefined && (!Number.isInteger(e.cft) || e.cft < 0)) {
                issues.push(`bank[${k}].cft 应为非负整数（实际 ${JSON.stringify(e.cft)}）`);
            }
        }
        return issues;
    };
    const semanticBad = semanticIssues(
        { exportedAt: 'not-a-date', wrong: [], bank: { k: { cft: -1 } } },
        { k: { cft: -1 } },
    );
    ok('快照语义负例：坏 exportedAt / wrong / cft 必须被抓出',
        semanticBad.length >= 3, `只抓到 ${semanticBad.length} 项：${semanticBad.slice(0, 3).join('；')}`);
    const semantic = semanticIssues(snapshot);
    ok('快照语义约束（exportedAt 为 ISO-8601 / cft 非负整数 / wrong 结构）',
        semantic.length === 0, semantic.slice(0, 5).join('；'));
}

console.log(failed === 0 ? '\n全部通过。\n' : `\n${failed} 项未通过。\n`);
process.exit(failed === 0 || warnOnly ? 0 : 1);
