#!/usr/bin/env node
/**
 * 文档链接检查（无依赖、不联网、只读）。
 *
 *   node tools/check-docs.mjs
 *
 * GitHub 上的相对链接和锚点失效时不会报错，只会把读者带到 404 或页面顶部。
 * 这个脚本检查仓库内 Markdown 的：
 *   - 相对文件链接 / 图片是否存在；
 *   - 指向 .md 的 `#锚点` 是否真的对应一个标题；
 *   - 同文件内的 `#锚点` 是否存在；
 *   - HTML 里的本地 src / href。
 *
 * 跳过 http(s)、mailto、data、协议相对地址、纯外链图片；不校验代码块里的命令。
 * 锚点按 GitHub 的 slug 规则换算（中文保留、空格转 `-`、重复标题追加 `-1`）。
 *
 * 退出码：0 全部通过；1 有死链或死锚点。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');

const ROOT_DOCS = [
    'README.md',
    'CONTRIBUTING.md',
    'SUPPORT.md',
    'SECURITY.md',
    'CODE_OF_CONDUCT.md',
    'CHANGELOG.md',
    'data/README.md',
    'tests/README.md',
    '.github/pull_request_template.md',
];
const DOCS_DIR = join(ROOT, 'docs');
const docsFiles = existsSync(DOCS_DIR)
    ? readdirSync(DOCS_DIR).filter(f => f.endsWith('.md')).sort().map(f => `docs/${f}`)
    : [];
const files = [...new Set([...ROOT_DOCS, ...docsFiles])]
    .filter(f => existsSync(join(ROOT, f)))
    .sort();

const failures = [];
const fail = (file, line, target, why) => failures.push({ file, line, target, why });
let linkCount = 0;

/** GitHub 标题锚点：小写、去标点、空格转连字符；保留 Unicode 字母/数字。 */
const slugify = s => s.trim().toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');

const anchorCache = new Map();
/** 解析一份 Markdown 的标题锚点；重复标题按 GitHub 规则加 -1/-2。 */
function anchorsOf(file) {
    if (anchorCache.has(file)) return anchorCache.get(file);
    const src = readFileSync(join(ROOT, file), 'utf8');
    const seen = new Map();
    const anchors = new Set();
    let inFence = false;
    for (const line of src.split(/\r?\n/)) {
        if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue; }
        if (inFence) continue;
        const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (!m) continue;
        const base = slugify(m[2]);
        if (!base) continue;
        const n = seen.get(base) || 0;
        seen.set(base, n + 1);
        anchors.add(n === 0 ? base : `${base}-${n}`);
    }
    anchorCache.set(file, anchors);
    return anchors;
}

const isExternal = target => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target);
const decode = s => {
    try { return decodeURIComponent(s); } catch { return s; }
};

function checkTarget(sourceFile, line, rawTarget) {
    let target = rawTarget.trim();
    if (!target) return;
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1).trim();
    if (!target || isExternal(target)) return;
    if (target === '#' || target === '#top') return;

    const hashAt = target.indexOf('#');
    let pathPart = hashAt >= 0 ? target.slice(0, hashAt) : target;
    const hash = hashAt >= 0 ? decode(target.slice(hashAt + 1)) : '';
    pathPart = decode(pathPart.split('?')[0]);

    // 纯页内锚点
    if (!pathPart) {
        if (hash && !anchorsOf(sourceFile).has(hash)) {
            fail(sourceFile, line, `#${hash}`, '当前文件没有这个标题锚点');
        }
        linkCount++;
        return;
    }

    const baseDir = dirname(join(ROOT, sourceFile));
    const targetAbs = pathPart.startsWith('/')
        ? join(ROOT, pathPart.slice(1))
        : resolve(baseDir, pathPart);
    const targetRel = relative(ROOT, targetAbs).split('\\').join('/');
    linkCount++;

    if (!existsSync(targetAbs)) {
        fail(sourceFile, line, target, `目标不存在（解析为 ${targetRel}）`);
        return;
    }

    // 目录链接只要求目录存在；文件锚点只对 Markdown 有意义。
    const isDir = statSync(targetAbs).isDirectory();
    if (hash && !isDir && /\.md$/i.test(targetAbs)) {
        const targetFile = relative(ROOT, targetAbs).split('\\').join('/');
        if (!anchorsOf(targetFile).has(hash)) {
            fail(sourceFile, line, target, `${targetFile} 没有标题锚点 #${hash}`);
        }
    }
}

/** 去掉行内代码，避免把示例当链接；保持字符位置不变。 */
const stripInlineCode = line => line.replace(/`[^`]*`/g, m => ' '.repeat(m.length));

for (const file of files) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    let inFence = false;
    src.split(/\r?\n/).forEach((raw, i) => {
        const lineNo = i + 1;
        if (/^\s*(```|~~~)/.test(raw)) { inFence = !inFence; return; }
        if (inFence) return;
        const line = stripInlineCode(raw);
        for (const m of line.matchAll(/!?\[[^\]]*\]\(\s*([^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g)) {
            checkTarget(file, lineNo, m[1]);
        }
        for (const m of line.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(\S+)/g)) {
            checkTarget(file, lineNo, m[1]);
        }
        for (const m of line.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) {
            checkTarget(file, lineNo, m[1]);
        }
    });
}

console.log(`\n文档链接检查：${files.length} 个 Markdown 文件，${linkCount} 条本地链接。`);
if (failures.length === 0) {
    console.log('✓ 相对链接与锚点全部有效。\n');
    process.exit(0);
}
for (const f of failures.slice(0, 30)) {
    console.error(`  ✗ ${f.file}:${f.line} → ${f.target}  (${f.why})`);
}
if (failures.length > 30) console.error(`  … 另有 ${failures.length - 30} 条未显示`);
console.error(`\n${failures.length} 条死链 / 死锚点。\n`);
process.exit(1);
