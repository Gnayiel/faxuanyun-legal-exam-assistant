#!/usr/bin/env node
/**
 * 外链可达性检查（需要网络；不进入默认 CI）。
 *
 *   node tools/check-external-links.mjs            # 只报告，退出码 0
 *   node tools/check-external-links.mjs --strict   # 有硬失败时退出码 1
 *
 * 扫描 README、社区文档、docs/*.md、data/README.md 与 issue 模板里的 http(s) 链接，
 * 去重后并发检查。默认 HEAD，部分站点不支持 HEAD 时退回 GET（Range: bytes=0-0）。
 * 本仓库自己的 GitHub 页面/附件/徽章会跳过（check-docs 与发布流程已覆盖）；
 * 403/429 视为“被站点拦截/限流”的 warning；404/410/5xx 与网络错误视为失败。
 * 外链受第三方站点、网络与限流影响，所以默认不阻塞日常 `npm run check`/CI；
 * 发版前可用 --strict 人工跑一次。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const STRICT = process.argv.includes('--strict');
const TIMEOUT_MS = Number(process.env.FX_LINK_TIMEOUT_MS || 12000);
const CONCURRENCY = Number(process.env.FX_LINK_CONCURRENCY || 4);

const ROOT_DOCS = [
    'README.md', 'CONTRIBUTING.md', 'SUPPORT.md', 'SECURITY.md',
    'CODE_OF_CONDUCT.md', 'CHANGELOG.md', 'data/README.md',
];
const DOCS_DIR = join(ROOT, 'docs');
const docsFiles = existsSync(DOCS_DIR)
    ? readdirSync(DOCS_DIR).filter(f => f.endsWith('.md')).sort().map(f => `docs/${f}`)
    : [];
const TEMPLATE_DIR = join(ROOT, '.github', 'ISSUE_TEMPLATE');
const templateFiles = existsSync(TEMPLATE_DIR)
    ? readdirSync(TEMPLATE_DIR).filter(f => /\.ya?ml$/i.test(f)).sort().map(f => `.github/ISSUE_TEMPLATE/${f}`)
    : [];
const files = [...new Set([...ROOT_DOCS, ...docsFiles, ...templateFiles])]
    .filter(f => existsSync(join(ROOT, f)));

// 占位链接、示例域名、本机地址不检查。
const SKIP = /(?:example\.(?:com|org|net)|localhost|127\.0\.0\.1|\.invalid(?:[/:]|$)|YOUR_|vx\.y\.z|@vX\.Y\.Z)/i;
// 本仓库的 GitHub 页面/附件/徽章不是第三方外链：仓库本身是否可达、文件是否存在
// 已由 check-docs/发布流程覆盖；这里跳过，避免把 GitHub 限流或网络故障误报成死链。
const SELF_REPO = /^https?:\/\/github\.com\/Gnayiel\/faxuanyun-legal-exam-assistant(?:[/?#]|$)/i;

const found = new Map();
for (const file of files) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    let inFence = false;
    src.split(/\r?\n/).forEach((raw, i) => {
        if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; return; }
        if (inFence) return;
        const line = raw.replace(/`[^`]*`/g, m => ' '.repeat(m.length));
        for (const m of line.matchAll(/https?:\/\/[^\s)\]>"'，。；]+/g)) {
            const url = m[0].replace(/[.,;:!?]+$/, '');
            if (SKIP.test(url) || SELF_REPO.test(url)) continue;
            if (!found.has(url)) found.set(url, []);
            if (found.get(url).length < 5) found.get(url).push(`${file}:${i + 1}`);
        }
    });
}

const urls = [...found.keys()].sort();
console.log(`\n外链检查：${files.length} 个文档，${urls.length} 条唯一 http(s) 链接。`);

const results = [];
async function checkOne(url) {
    const headers = {
        'user-agent': 'fx-legal-exam-link-check/1.0 (+https://github.com/Gnayiel/faxuanyun-legal-exam-assistant)',
        accept: '*/*',
    };
    for (const [method, extra] of [['HEAD', {}], ['GET', { range: 'bytes=0-0' }]]) {
        try {
            const res = await fetch(url, {
                method,
                redirect: 'follow',
                signal: AbortSignal.timeout(TIMEOUT_MS),
                headers: { ...headers, ...extra },
            });
            if (res.body) await res.body.cancel().catch(() => {});
            if (res.status >= 200 && res.status < 400) return { url, status: res.status, ok: true };
            if (method === 'HEAD' && (res.status === 403 || res.status === 405 || res.status === 429)) continue;
            if (res.status === 403 || res.status === 429) return { url, status: res.status, ok: true, warning: '站点拒绝/限流，未判定失败' };
            return { url, status: res.status, ok: false, reason: `HTTP ${res.status}` };
        } catch (e) {
            if (method === 'HEAD') continue;
            return { url, status: 0, ok: false, reason: e?.name === 'TimeoutError' ? '超时' : (e?.message || String(e)) };
        }
    }
    return { url, status: 0, ok: false, reason: 'HEAD/GET 均无法判定' };
}

const queue = [...urls];
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, async () => {
    while (queue.length) {
        const url = queue.shift();
        results.push(await checkOne(url));
    }
}));

const failed = results.filter(r => !r.ok);
const warned = results.filter(r => r.warning);
for (const r of results.filter(r => r.ok && !r.warning)) {
    console.log(`  ✓ ${r.status} ${r.url}`);
}
for (const r of warned) console.log(`  ⚠ ${r.status} ${r.url}  (${r.warning})`);
for (const r of failed) {
    console.error(`  ✗ ${r.url}  (${r.reason})`);
    for (const where of found.get(r.url)) console.error(`      ${where}`);
}
console.log(`\n通过 ${results.filter(r => r.ok).length} / ${results.length}，警告 ${warned.length}，失败 ${failed.length}。`);
if (failed.length && STRICT) {
    console.error('外链检查有硬失败（--strict）。\n');
    process.exit(1);
}
console.log(failed.length ? '外链检查有失败，但默认只报告；发版前请用 --strict 复核。\n' : '外链检查通过（403/429 仅告警）。\n');
