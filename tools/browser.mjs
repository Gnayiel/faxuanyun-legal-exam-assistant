// 浏览器探测 / headless 运行工具：panel-smoke.mjs 与 page-smoke.mjs 共用。
//
// 探测顺序：
//   1. 环境变量 FX_BROWSER（绝对路径，或 PATH 里的命令名，如 google-chrome）
//   2. 常见安装路径（Windows Edge / Chrome，Linux /usr/bin，macOS .app）
//   3. 遍历 PATH 找命令名（含 Windows 的 chrome.exe / msedge.exe）
// 找不到时返回空串，由调用方决定「跳过」还是「失败」。
//
// 启动参数与原来的 panel-smoke 内联实现保持一致（--headless=new + --dump-dom），
// 两个冒烟工具只是页面内容不同，浏览器这一层不该各写一份、慢慢跑偏。
import { existsSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, delimiter, isAbsolute } from 'node:path';

const FIXED_PATHS = [
    // Windows：Edge 是系统自带，Chrome 用户安装
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // Linux
    '/usr/bin/microsoft-edge', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/opt/google/chrome/chrome',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
];

const PATH_NAMES = process.platform === 'win32'
    ? ['chrome.exe', 'msedge.exe']
    : ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
        'microsoft-edge', 'microsoft-edge-stable', 'brave-browser'];

/** 解析一个浏览器引用：绝对/相对路径直接检查存在性；裸命令名则遍历 PATH。 */
function resolveRef(ref) {
    const name = String(ref || '').trim();
    if (!name) return '';
    if (isAbsolute(name) || name.includes('/') || name.includes('\\')) {
        return existsSync(name) ? name : '';
    }
    const dirs = String(process.env.PATH || '').split(delimiter).filter(Boolean);
    for (const dir of dirs) {
        const p = join(dir, name);
        if (existsSync(p)) return p;
    }
    return '';
}

/** 找本机可用的 Chromium 系浏览器；FX_BROWSER 优先，然后常见安装路径，最后 PATH。 */
export function findBrowser() {
    const fromEnv = resolveRef(process.env.FX_BROWSER);
    if (fromEnv) return fromEnv;
    for (const p of FIXED_PATHS) if (existsSync(p)) return p;
    for (const name of PATH_NAMES) {
        const p = resolveRef(name);
        if (p) return p;
    }
    return '';
}

/**
 * 把页面写入临时目录，用 headless Chromium 跑一遍并返回 --dump-dom 的序列化结果。
 * opts.prefix 是临时目录前缀（便于排障时认出是谁留下的）；
 * opts.budgetMs 是 --virtual-time-budget（虚拟时间预算）。
 */
export function runHeadless(browser, html, opts = {}) {
    const dir = mkdtempSync(join(tmpdir(), opts.prefix || 'fx-smoke-'));
    const page = join(dir, 'smoke.html');
    writeFileSync(page, html, 'utf8');
    const dom = execFileSync(browser, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--disable-background-networking', '--mute-audio',
        // CI 容器里以 root 运行，需要用 --no-sandbox 才能起内核；本地不加
        ...(process.platform === 'linux' ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
        '--user-data-dir=' + join(dir, 'profile'),
        '--virtual-time-budget=' + (opts.budgetMs || 20000),
        '--dump-dom', 'file:///' + page.replace(/\\/g, '/'),
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
    return { dom, page, dir };
}
