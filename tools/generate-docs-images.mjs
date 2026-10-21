#!/usr/bin/env node
/**
 * 生成 README 用的三张文档图（不引入图片库）：
 *   - docs/panel.webp：用 ffmpeg 同步面板徽章与自检日志
 *   - docs/social-preview-light.webp / dark.webp：用 Chrome 渲染 HTML 海报，
 *     再交给 ffmpeg 转 WebP
 *
 * 之前社交预览是在旧 WebP 上反复覆盖版本号，版本字符串变短时会留下旧字形，
 * 不同字体的数字也会和原海报不一致。现在海报文字由浏览器重新排版，面板截图
 * 作为图片嵌入，版本号/自检数每次都是新的。
 *
 * 依赖：ffmpeg、Chrome/Chromium、中文字体（默认 Droid Sans Fallback）。
 *   FX_FONT     面板图用的拉丁字体（默认 DejaVu Sans Bold）
 *   FX_CJK_FONT 面板图用的中文字体（默认 Droid Sans Fallback）
 *   CHROME      浏览器可执行文件（默认自动找 google-chrome / chromium）
 *
 * 用法：
 *   npm run docs:images
 *   node tools/generate-docs-images.mjs --version 3.0.0 --count 193
 *
 * 只在本地手动运行；不进入 CI（CI 不保证有 ffmpeg / Chrome / 中文字体）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const arg = (name, fallback) => {
    const i = process.argv.indexOf(name);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const version = arg('--version', pkg.version);
const count = String(arg('--count', (readme.match(/self--test-(\d+)%20passing/) || [])[1] || '193'));
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const font = process.env.FX_FONT || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const cjkFont = process.env.FX_CJK_FONT || '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf';

if (!/^\d+\.\d+\.\d+$/.test(version)) {
    console.error(`版本号格式不对：${version}（应为 x.y.z）`);
    process.exit(2);
}
if (!/^\d+$/.test(count)) {
    console.error(`自检数格式不对：${count}`);
    process.exit(2);
}
for (const f of [font, cjkFont]) {
    if (!existsSync(f)) {
        console.error(`缺少字体：${f}\n可用 FX_FONT / FX_CJK_FONT 指定字体路径。`);
        process.exit(2);
    }
}
for (const cmd of [ffmpeg]) {
    try {
        execFileSync(cmd, ['-version'], { stdio: 'ignore' });
    } catch {
        console.error(`找不到 ${cmd}（${cmd}）。请安装，或用 FFMPEG 指定路径。`);
        process.exit(2);
    }
}
const canRun = cmd => {
    try {
        execFileSync(cmd, ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
};
const chrome = [process.env.CHROME, 'google-chrome', 'chromium', 'chromium-browser']
    .filter(Boolean)
    .find(cmd => canRun(cmd));
if (!chrome) {
    console.error('找不到 Chrome / Chromium。社交预览需要浏览器渲染；可用 CHROME 指定路径。');
    process.exit(2);
}

// 临时目录必须和 docs/ 在同一个文件系统，否则 renameSync 会 EXDEV。
const tmp = mkdtempSync(join(ROOT, 'docs', '.tmp-images-'));
const run = args => execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const toPng = (src, dst) => run(['-i', src, '-frames:v', '1', dst]);
const toWebp = (src, dst) => run(['-i', src, '-c:v', 'libwebp', '-quality', '86', '-compression_level', '6', dst]);
const draw = (fontfile, value, x, y, size, color, boxColor) => {
    let filter = `drawtext=fontfile=${fontfile}:text='${value}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}`;
    if (boxColor) filter += `:box=1:boxcolor=${boxColor}:boxborderw=3`;
    return filter;
};
const text = (value, x, y, size, color, boxColor) => draw(font, value, x, y, size, color, boxColor);
const fill = (x, y, w, h, color) => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}:t=fill`;

/** panel：右上角版本徽章 + 底部「自检 N/N 项通过」 */
function panelFilters() {
    const digits = `${count}/${count}`;
    return [
        fill(454, 52, 98, 27, '0x19202b'),
        text('v' + version, 458, 51, 21, '0xc7d2e3'),
        text(digits, 307, 1032, 20, '0xd8e2d2', '0x0d1117'),
        draw(cjkFont, '项通过', 410, 1031, 20, '0xd8e2d2', '0x0d1117'),
        fill(474, 1030, 92, 27, '0x0d1117'),
    ].join(',');
}

function socialHtml(theme, panelB64) {
    const dark = theme === 'dark';
    const c = {
        bg: dark
            ? 'linear-gradient(135deg,#071322 0%,#08182d 55%,#040b18 100%)'
            : 'linear-gradient(135deg,#f9fcff 0%,#eef4fd 55%,#dfe9fa 100%)',
        grid: dark ? 'rgba(70,140,255,.10)' : 'rgba(70,120,180,.08)',
        glow: dark ? 'rgba(40,105,220,.22)' : 'rgba(150,190,255,.45)',
        text: dark ? '#eef4ff' : '#101820',
        sub: dark ? '#b6c6dc' : '#27364d',
        muted: dark ? '#93a8c4' : '#3f4e64',
        blue: dark ? '#4f8cff' : '#2f6fed',
        badgeBorder: dark ? '#2b466c' : '#c6d3e4',
        badgeText: dark ? '#a7bddb' : '#3b4a60',
        pillBg: dark ? 'rgba(17,36,64,.72)' : 'rgba(255,255,255,.72)',
        pillBorder: dark ? '#29476f' : '#c9d7ea',
        pillText: dark ? '#c6d5ea' : '#34445c',
        footer: dark ? '#9db0c9' : '#34445c',
        footerLine: dark ? 'rgba(90,140,220,.22)' : 'rgba(100,130,170,.22)',
        verBg: dark ? '#0d1b31' : '#ffffff',
        verBorder: dark ? '#29466d' : '#d5e0ef',
        shadow: dark ? 'rgba(0,0,0,.55)' : 'rgba(20,40,80,.25)',
    };
    return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;width:1280px;height:640px;overflow:hidden}
body{font-family:"Droid Sans Fallback","DejaVu Sans",sans-serif;background:${c.bg};color:${c.text}}
.poster{position:relative;width:1280px;height:640px;overflow:hidden;background:${c.bg}}
.poster:before{content:"";position:absolute;inset:0;background-image:linear-gradient(${c.grid} 1px,transparent 1px),linear-gradient(90deg,${c.grid} 1px,transparent 1px);background-size:80px 80px;opacity:.55;pointer-events:none}
.poster:after{content:"";position:absolute;width:780px;height:780px;right:-120px;top:-300px;background:radial-gradient(circle,${c.glow} 0%,transparent 62%);pointer-events:none}
.content{position:absolute;left:76px;top:54px;width:700px;z-index:2}
.eyebrow{display:flex;align-items:center;gap:22px;white-space:nowrap}
.badge{border:1.5px solid ${c.badgeBorder};color:${c.badgeText};border-radius:999px;padding:8px 18px 7px;font-size:13px;font-weight:700;letter-spacing:.16em;font-family:"DejaVu Sans",sans-serif}
.platform{font-size:15px;color:${c.muted};letter-spacing:.02em}
h1{margin:42px 0 26px;font-size:96px;line-height:1.05;letter-spacing:-.035em;font-weight:900;color:${c.text}}
h1 span{color:${c.blue}}
.lead{margin:0 0 7px;font-size:23px;line-height:1.55;color:${c.sub};font-weight:500}
.lead b{color:${c.text};font-weight:900}
.pills{display:flex;gap:10px;margin-top:30px}
.pill{display:flex;align-items:center;gap:8px;background:${c.pillBg};border:1.5px solid ${c.pillBorder};border-radius:9px;padding:9px 14px;color:${c.pillText};font-size:14px;font-weight:500;white-space:nowrap}
.dot{width:7px;height:7px;border-radius:50%;background:${c.blue};flex:none}
.footer{position:absolute;left:76px;bottom:38px;width:660px;display:flex;align-items:center;gap:12px;border-top:1px solid ${c.footerLine};padding-top:14px;color:${c.footer};font-size:16px;font-weight:500;z-index:2}
.gh{width:19px;height:19px;fill:currentColor;flex:none}
.repo{white-space:nowrap}
.ver,.mit{border:1.5px solid ${c.verBorder};background:${c.verBg};border-radius:5px;padding:3px 8px;font-size:12px;font-weight:700;color:${c.footer};font-family:"DejaVu Sans",sans-serif}
.panel{position:absolute;right:80px;top:40px;width:400px;height:560px;border-radius:14px;overflow:hidden;background:#0b111b;box-shadow:0 24px 60px ${c.shadow};z-index:1}
.panel img{display:block;width:100%;height:560px;object-fit:cover;object-position:top}
</style></head><body><div class="poster">
<div class="content">
<div class="eyebrow"><span class="badge">TAMPERMONKEY 用户脚本</span><span class="platform">法宣在线 · 甘肃省国家工作人员学法考试平台</span></div>
<h1>学法考试<br><span>自动答题助手</span></h1>
<p class="lead">结构化题库 + AI / 百度双源查答案，答错自纠、进度可控。</p>
<p class="lead">单文件 · 无构建 · 无第三方依赖，<b>内置 ${count} 项自检。</b></p>
<div class="pills"><span class="pill"><i class="dot"></i>题库优先</span><span class="pill"><i class="dot"></i>双源交叉验证</span><span class="pill"><i class="dot"></i>答错自纠</span><span class="pill"><i class="dot"></i>多标签页写保护</span></div>
</div>
<div class="footer"><svg class="gh" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg><span class="repo">Gnayiel / faxuanyun-legal-exam-assistant</span><span class="ver">v${version}</span><span class="mit">MIT</span></div>
<div class="panel"><img alt="" src="data:image/webp;base64,${panelB64}"></div>
</div></body></html>`;
}

// 1) 先更新面板图；社交预览会把它作为右侧截图。
const panelSrc = join(ROOT, 'docs', 'panel.webp');
if (!existsSync(panelSrc)) {
    console.error(`缺图片：${panelSrc}`);
    process.exit(1);
}
const panelPng = join(tmp, 'panel.png');
toPng(panelSrc, panelPng);
run(['-i', panelPng, '-vf', panelFilters(), '-frames:v', '1', join(tmp, 'panel-patched.png')]);
toWebp(join(tmp, 'panel-patched.png'), join(tmp, 'panel.webp'));
renameSync(join(tmp, 'panel.webp'), panelSrc);
console.log('✓ docs/panel.webp');

// 2) 重新渲染两张社交预览：文字由浏览器排版，面板截图作为图片嵌入。
const panelB64 = readFileSync(panelSrc).toString('base64');
for (const theme of ['light', 'dark']) {
    const htmlPath = join(tmp, `social-${theme}.html`);
    const pngPath = join(tmp, `social-${theme}.png`);
    writeFileSync(htmlPath, socialHtml(theme, panelB64), 'utf8');
    execFileSync(chrome, [
        '--headless=new',
        '--no-sandbox',
        '--disable-gpu',
        '--hide-scrollbars',
        '--force-device-scale-factor=1',
        '--window-size=1280,640',
        '--virtual-time-budget=2500',
        `--user-data-dir=${join(tmp, `chrome-${theme}`)}`,
        `--screenshot=${pngPath}`,
        `file://${htmlPath}`,
    ], { stdio: 'inherit' });
    toWebp(pngPath, join(tmp, `social-${theme}.webp`));
    renameSync(join(tmp, `social-${theme}.webp`), join(ROOT, 'docs', `social-preview-${theme}.webp`));
    console.log(`✓ docs/social-preview-${theme}.webp`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`完成：${version} / ${count} 项自检`);
