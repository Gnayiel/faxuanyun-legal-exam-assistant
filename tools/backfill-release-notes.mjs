#!/usr/bin/env node
/**
 * 回填历史 Release 的「首次安装」链接。
 *
 * 早期发版的 Release 说明里，首装链接指向 main 分支：
 *   https://github.com/<owner>/<repo>/raw/main/faxuanyun-legal-exam-assistant.user.js
 * main 上的脚本会随每次提交变化，新用户点历史 Release 的链接时拿到的不是那一版。
 * 这里把每个 Release 正文里的旧链接替换成「钉到该 Release tag」的 jsDelivr 地址：
 *   https://fastly.jsdelivr.net/gh/<owner>/<repo>@<tag>/faxuanyun-legal-exam-assistant.user.js
 *
 * 用法：
 *   GITHUB_TOKEN=... node tools/backfill-release-notes.mjs --dry-run   # 只打印会改哪些，不写
 *   GITHUB_TOKEN=... node tools/backfill-release-notes.mjs             # 真正 PATCH 每个 Release
 *   node tools/backfill-release-notes.mjs --self-test                  # 离线自测替换逻辑，不联网
 *
 * 约定：
 *   - token 从 GITHUB_TOKEN 读，兼容 GH_TOKEN；没有 token 直接退出 2（不猜、不交互）。
 *   - 仓库默认 Gnayiel/faxuanyun-legal-exam-assistant，可用 --repo owner/name 覆盖。
 *   - 分页拉取（per_page=100，最多 20 页），只对正文确实包含旧链接的 Release 发 PATCH。
 *   - 只用 Node 22+ 自带的 fetch，无第三方依赖；本脚本不会在本机自动执行写接口。
 */

const FILE = 'faxuanyun-legal-exam-assistant.user.js';
const DEFAULT_REPO = 'Gnayiel/faxuanyun-legal-exam-assistant';
const API = 'https://api.github.com';
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const selfTest = argv.includes('--self-test');
const repoIdx = argv.indexOf('--repo');
const repo = ((repoIdx !== -1 ? argv[repoIdx + 1] : '') || process.env.GITHUB_REPOSITORY || DEFAULT_REPO).trim();
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';

const oldUrl = (r) => `https://github.com/${r}/raw/main/${FILE}`;
const newUrl = (r, tag) => `https://fastly.jsdelivr.net/gh/${r}@${tag}/${FILE}`;

/** 把一段 Release 正文里的旧首装链接整体换成该 tag 的钉版链接；空正文 / 空 tag 原样返回。 */
function rewriteBody(body, repository, tag) {
    if (typeof body !== 'string' || !body || !tag) return body;
    const needle = oldUrl(repository);
    if (!body.includes(needle)) return body;
    return body.split(needle).join(newUrl(repository, tag));
}

function fail2(msg) {
    console.error(`✗ ${msg}`);
    process.exit(2);
}

if (selfTest) {
    const r = DEFAULT_REPO;
    const tag = 'v2.0.5';
    const src = `## ${tag}\n\n- 首次安装：[安装脚本](${oldUrl(r)})\n- 其他说明保持不动\n`;
    const out = rewriteBody(src, r, tag);
    const checks = [
        ['旧 main 链接被替换', !out.includes(oldUrl(r)) && out.includes(newUrl(r, tag))],
        ['正文其他内容保留', out.includes('其他说明保持不动') && out.includes(`## ${tag}`)],
        ['空正文原样返回', rewriteBody('', r, tag) === ''],
        ['没有 tag 时原样返回', rewriteBody(src, r, '') === src],
        ['正文没有旧链接时不变', rewriteBody('nothing here', r, tag) === 'nothing here'],
    ];
    let bad = 0;
    for (const [name, ok] of checks) {
        console.log(`  ${ok ? '✓' : '✗'} ${name}`);
        if (!ok) bad++;
    }
    console.log(bad ? `自测失败：${bad} 项` : '回填脚本离线自测通过');
    process.exit(bad ? 1 : 0);
}

if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    fail2(`--repo 必须是 owner/name 形式：${repo}`);
}
if (!token) {
    fail2('缺少 GITHUB_TOKEN（或 GH_TOKEN）：回填 Release 说明需要能读写 Releases 的 token；离线验证请用 --self-test');
}

async function api(path, init = {}) {
    const res = await fetch(API + path, {
        ...init,
        headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'fx-tools2-backfill-release-notes',
            ...(init.body ? { 'Content-Type': 'application/json' } : {}),
            ...(init.headers || {}),
        },
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`${init.method || 'GET'} ${path} 失败：HTTP ${res.status} ${text.slice(0, 300)}`);
    }
    try {
        return JSON.parse(text);
    } catch {
        throw new Error(`${init.method || 'GET'} ${path} 返回的不是 JSON：${text.slice(0, 200)}`);
    }
}

async function main() {
    let page = 1;
    let scanned = 0;
    let changed = 0;
    let occurrences = 0;
    while (page <= 20) {
        const batch = await api(`/repos/${repo}/releases?per_page=100&page=${page}`);
        if (!Array.isArray(batch)) throw new Error('Releases 列表返回格式不是数组');
        for (const rel of batch) {
            scanned++;
            const tag = rel.tag_name;
            const body = rel.body || '';
            const next = rewriteBody(body, repo, tag);
            if (next === body) continue;
            changed++;
            occurrences += body.split(oldUrl(repo)).length - 1;
            if (dryRun) {
                console.log(`[dry-run] ${tag}：将替换 ${body.split(oldUrl(repo)).length - 1} 处旧链接`);
                continue;
            }
            await api(`/repos/${repo}/releases/${rel.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ body: next }),
            });
            console.log(`✓ ${tag}：已回填首装链接`);
        }
        if (batch.length < 100) break;
        page++;
    }
    if (dryRun) {
        console.log(`— dry-run：扫描 ${scanned} 个 Release，${changed} 个需要回填（共 ${occurrences} 处），未写任何数据`);
    } else {
        console.log(`✓ 扫描 ${scanned} 个 Release，更新 ${changed} 个（共 ${occurrences} 处旧链接）`);
    }
}

main().catch(e => {
    console.error(`✗ 回填失败：${e.message}`);
    process.exit(1);
});
