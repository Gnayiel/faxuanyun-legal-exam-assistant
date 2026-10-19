#!/usr/bin/env node
/**
 * 合并多个题库导出文件（.json / .csv）→ 一个 .json（可选同时写 .csv）。
 *
 *   node tools/merge-bank.mjs a.json b.csv c.json -o merged.json [--csv merged.csv] [--quiet]
 *
 * 规则（与脚本内部的合并口径一致）：
 *   - 用「归一化题干 + FNV-1a 主键」去重；前缀等价的截断版本也视为同一题（>=30 字前缀）
 *   - 用户手改答案（来源「用户」/ by=user）优先，脚本答案不得覆盖
 *   - 两边都是脚本答案且不一致时，保留 ts 较新的那条并累加冲突次数 cft
 *   - 错题记录取并集（错误选项 / 失败组合）
 *   - 输出格式与面板「导出答案库」一致，可直接导入脚本
 *
 * 只读输入、不联网、不改原文件。无第三方依赖。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const LABEL = { single: '单选', multi: '多选', judge: '判断' };
const LABEL2TYPE = { 单选: 'single', 多选: 'multi', 判断: 'judge', 单选题: 'single', 多选题: 'multi', 判断题: 'judge' };

const argv = process.argv.slice(2);
const files = argv.filter(a => !a.startsWith('-') && !/^-o$/.test(a) && argv[argv.indexOf(a) - 1] !== '-o' && argv[argv.indexOf(a) - 1] !== '--csv');
const outIdx = argv.findIndex(a => a === '-o' || a === '--out');
const csvIdx = argv.findIndex(a => a === '--csv');
const outPath = outIdx >= 0 ? argv[outIdx + 1] : '';
const csvPath = csvIdx >= 0 ? argv[csvIdx + 1] : '';
const quiet = argv.includes('--quiet');

const die = msg => { console.error(`✗ ${msg}`); process.exit(1); };
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
const blankEntry = o => ({
    q: o.q || '', t: o.t || 'single', s: o.s || '甘肃省国家工作人员学法考试',
    a: o.a || null, l: o.l || '', src: o.src || 'exam', by: o.by || '',
    ts: o.ts || Date.now(), us: o.us || 0, hit: o.hit || 0, ok: o.ok || 0, bad: o.bad || 0, cft: o.cft || 0,
});
const blankWrong = (q = '') => ({ q, w: [], tried: [] });

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
    return rows.filter(r => r.length);
}

/** 读一个输入文件 → { bank: {}, wrong: {} } */
function readInput(file) {
    const text = readFileSync(file, 'utf8');
    const bank = {}, wrong = {};
    const isJson = /\.json$/i.test(file) || /^\s*[\[{]/.test(text);
    if (isJson) {
        let obj;
        try { obj = JSON.parse(text); } catch (e) { die(`${basename(file)} 不是合法 JSON：${e.message}`); }
        const b = (obj && obj.bank) || (obj && obj.format === 'faxuanyun-legal-exam-bank' ? obj.bank : null) || (obj && !Array.isArray(obj) && typeof obj === 'object' ? obj : null);
        if (!b) die(`${basename(file)} 里找不到题库（bank）`);
        for (const [k, v] of Object.entries(b)) {
            if (!v || typeof v !== 'object') continue;
            const e = blankEntry({ ...v, q: v.q || (typeof v === 'string' ? k : '') });
            if (!e.q) continue;
            bank[fpKey(e.q)] = e;
        }
        for (const [k, v] of Object.entries(obj.wrong || {})) {
            if (Array.isArray(v)) wrong[fpKey(v.q || k)] = { q: '', w: v.filter(Boolean), tried: [] };
            else if (v && typeof v === 'object') {
                wrong[fpKey(v.q || k)] = { q: v.q || '', w: (v.w || []).filter(Boolean), tried: (v.tried || []).filter(Boolean) };
            }
        }
        return { bank, wrong, count: Object.keys(bank).length };
    }
    // CSV
    const rows = parseCsv(text);
    const header = (rows[0] || []).map(x => x.trim());
    const col = name => header.indexOf(name);
    if (col('题目') < 0) die(`${basename(file)} 缺少「题目」列（表头：${header.join(',')}）`);
    for (const r of rows.slice(1)) {
        const q = (r[col('题目')] || '').trim();
        if (!q) continue;
        const t = LABEL2TYPE[(r[col('题型')] || '').trim()] || 'single';
        const e = blankEntry({ q, t, l: (r[col('正确答案')] || '').trim(), src: 'import', by: /用户/.test(r[col('来源')] || '') ? 'user' : '' });
        bank[fpKey(q)] = e;
        const errCell = (r[col('错误选项')] || '').trim();
        if (errCell) wrong[fpKey(q)] = { q, w: errCell.split(/[;；]/).map(x => x.trim()).filter(Boolean), tried: [] };
    }
    return { bank, wrong, count: Object.keys(bank).length };
}

const sameTexts = (a, b) => {
    const x = (a || []).slice().sort(), y = (b || []).slice().sort();
    return x.length === y.length && x.every((v, i) => v === y[i]);
};
const letterOf = e => String(e.l || '').toUpperCase();

/** 合并同一条目的两份数据（返回 { entry, conflict }） */
function mergeEntry(a, b) {
    if (!a) return { entry: b, conflict: false };
    if (!b) return { entry: a, conflict: false };
    const same = letterOf(a) === letterOf(b) && sameTexts(a.a, b.a);
    // 频次取 max 而不是相加：同一份文件重复合并时结果保持幂等，不会把计数灌水
    const out = blankEntry({
        ...a,
        hit: Math.max(a.hit || 0, b.hit || 0), ok: Math.max(a.ok || 0, b.ok || 0), bad: Math.max(a.bad || 0, b.bad || 0),
        us: Math.max(a.us || 0, b.us || 0), ts: Math.min(a.ts || 0, b.ts || 0) || a.ts || b.ts,
    });
    if (same) {
        out.by = (a.by === 'user' || b.by === 'user') ? 'user' : (a.by || b.by || '');
        out.cft = Math.max(a.cft || 0, b.cft || 0);
        return { entry: out, conflict: false };
    }
    // 答案不一致：用户答案优先；都是脚本答案则保留更新的
    const userA = a.by === 'user', userB = b.by === 'user';
    const win = userA !== userB ? (userA ? a : b) : ((b.ts || 0) >= (a.ts || 0) ? b : a);
    out.l = win.l || ''; out.a = win.a || null; out.by = win.by || ''; out.src = win.src || out.src;
    out.cft = Math.max(a.cft || 0, b.cft || 0) + 1;
    return { entry: out, conflict: true };
}

if (!files.length) die('用法：node tools/merge-bank.mjs a.json b.csv … -o merged.json [--csv merged.csv]');
if (!outPath) die('缺少输出路径：用 -o merged.json 指定');

const merged = {}, mergedWrong = {};
let conflict = 0, dupPrefix = 0, totalIn = 0;
const prefixBucket = new Map();   // 前 30 字 → 主键列表，用于前缀等价归并

for (const f of files) {
    const part = readInput(f);
    totalIn += part.count;
    if (!quiet) console.log(`• ${basename(f)}：${part.count} 题，${Object.keys(part.wrong).length} 条错题记录`);
    for (const [key, e] of Object.entries(part.bank)) {
        // 前缀等价去重：截断版本（>=30 字）与完整版本视为同一题
        const s = normStem(e.q);
        const bucketKey = s.length >= 30 ? s.slice(0, 30) : '';
        let target = key;
        if (bucketKey && prefixBucket.has(bucketKey)) {
            for (const cand of prefixBucket.get(bucketKey)) {
                const ce = merged[cand];
                if (!ce) continue;
                const x = normStem(ce.q), y = s;
                const [short, long] = x.length <= y.length ? [x, y] : [y, x];
                if (short.length >= 30 && long.startsWith(short)) {
                    if (cand !== key) dupPrefix++;
                    target = cand; break;
                }
            }
        }
        const r = mergeEntry(merged[target], e);
        if (r.conflict) conflict++;
        merged[target] = r.entry;
        if (bucketKey) {
            if (!prefixBucket.has(bucketKey)) prefixBucket.set(bucketKey, []);
            if (!prefixBucket.get(bucketKey).includes(target)) prefixBucket.get(bucketKey).push(target);
        }
    }
    for (const [key, w] of Object.entries(part.wrong)) {
        const cur = mergedWrong[key] || blankWrong(w.q || '');
        cur.q = cur.q || w.q || '';
        cur.w = [...new Set([...cur.w, ...(w.w || [])])];
        cur.tried = [...new Set([...cur.tried, ...(w.tried || [])])];
        mergedWrong[key] = cur;
    }
}

// 清理：没有 q 的错题记录合并到同题干主键下（简单起见按 fpKey(q) 对齐）
for (const [k, w] of Object.entries(mergedWrong)) {
    if (!w.q) { mergedWrong[k] = { ...w, q: merged[k]?.q || '' }; }
    if (!w.q || (!w.w.length && !w.tried.length)) delete mergedWrong[k];
}

const scriptVer = (() => {
    try { const s = readFileSync(join(ROOT, 'faxuanyun-legal-exam-assistant.user.js'), 'utf8'); return (s.match(/^\/\/ @version\s+(\S+)/m) || [])[1] || '0.0.0'; }
    catch { return '0.0.0'; }
})();
const outJson = {
    format: 'faxuanyun-legal-exam-bank', schema: 2, version: scriptVer,
    exportedAt: new Date().toISOString(), count: Object.keys(merged).length,
    bank: merged, wrong: mergedWrong,
};
writeFileSync(outPath, JSON.stringify(outJson, null, 0) + '\n');
if (csvPath) {
    const header = ['序号,题型,题目,正确答案,错误选项,来源'];
    const csvCell = v => {
        const s = String(v === null || v === undefined ? '' : v);
        return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const entries = Object.values(merged).sort((a, b) => (LABEL[a.t] || '').localeCompare(LABEL[b.t] || '') || a.q.localeCompare(b.q));
    entries.forEach((e, i) => {
        const k = fpKey(e.q);
        const ans = (e.a && e.a.length ? e.a.join('; ') : (e.l || ''));
        const w = mergedWrong[k] || blankWrong();
        header.push([i + 1, csvCell(LABEL[e.t] || '单选'), csvCell(e.q), csvCell(ans),
            csvCell([...w.w, ...w.tried].join('; ')), csvCell(e.by === 'user' ? '用户' : '脚本')].join(','));
    });
    writeFileSync(csvPath, '\ufeff' + header.join('\r\n') + '\r\n');
}
if (!quiet) {
    console.log(`\n✓ 合并完成：输入 ${totalIn} 条（含重复）→ 输出 ${Object.keys(merged).length} 条唯一题`);
    console.log(`  答案冲突 ${conflict} 处（用户答案优先，其次保留较新），前缀等价归并 ${dupPrefix} 处`);
    console.log(`  错题记录 ${Object.keys(mergedWrong).length} 条`);
    console.log(`  JSON：${outPath}${csvPath ? `\n  CSV ：${csvPath}` : ''}`);
}
