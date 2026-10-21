#!/usr/bin/env node
/**
 * 生成 README 用的三张文档图（最小实现，不引入图片库）：
 *   - docs/social-preview-light.webp / dark.webp：同步版本号、自检数
 *   - docs/panel.webp：同步面板徽章、自检日志
 *
 * 图片是仓库里已有的脱敏截图/海报，本脚本只负责把「版本号 / 自检数」重新盖到固定坐标上；
 * 这样发版时不用手工开图片编辑器，也不依赖截图环境。需要 ffmpeg 与两套字体：
 *   FX_FONT     拉丁字体（默认 DejaVu Sans Bold）
 *   FX_CJK_FONT 中文字体（默认 Droid Sans Fallback）
 *
 * 用法：
 *   npm run docs:images
 *   node tools/generate-docs-images.mjs --version 2.0.22 --count 193
 *
 * 只在本地手动运行；不进入 CI（CI 不保证有 ffmpeg / 中文字体）。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
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
try {
    execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' });
} catch {
    console.error(`找不到 ffmpeg（${ffmpeg}）。请安装 ffmpeg，或用 FFMPEG 指定路径。`);
    process.exit(2);
}

// 临时目录必须和 docs/ 在同一个文件系统，否则 renameSync 会 EXDEV；
// 放在仓库内也避免把中间产物写到 /tmp 后跨设备复制。
const tmp = mkdtempSync(join(ROOT, 'docs', '.tmp-images-'));
const run = args => execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const toPng = (src, dst) => run(['-i', src, '-frames:v', '1', dst]);
const toWebp = (src, dst) => run(['-i', src, '-c:v', 'libwebp', '-quality', '82', '-compression_level', '6', dst]);
const draw = (fontfile, value, x, y, size, color, boxColor) => {
    let filter = `drawtext=fontfile=${fontfile}:text='${value}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}`;
    // 用 drawtext 自带的 box 紧贴文字打底：只覆盖旧文字，不会把徽章边框一起涂掉。
    if (boxColor) filter += `:box=1:boxcolor=${boxColor}:boxborderw=3`;
    return filter;
};
const text = (value, x, y, size, color, boxColor) => draw(font, value, x, y, size, color, boxColor);
const fill = (x, y, w, h, color) => `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=${color}:t=fill`;

/** social preview：左侧海报的版本/自检 + 右侧面板徽章 + 页脚版本 */
function socialFilters(theme) {
    const light = theme === 'light';
    const badgeBg = light ? '0xffffff' : '0x0d192f';
    const badgeFg = light ? '0x3d465b' : '0xc8d3e6';
    const footerBg = light ? '0xeef3fd' : '0x071425';
    const footerFg = light ? '0x44506a' : '0xb7c5da';
    const digitBg = light ? '0xedf4ff' : '0x0a1224';
    const digitFg = light ? '0x1f2a44' : '0xe7edf7';
    const label = 'v' + version;
    return [
        text(label, 1110, 59, 11, badgeFg, badgeBg),
        text(label, 461, 572, 10, footerFg, footerBg),
        text(count, 439, 372, 18, digitFg, digitBg),
    ].join(',');
}

/** panel：右上角版本徽章 + 底部「自检 N/N 项通过」 */
function panelFilters() {
    const digits = `${count}/${count}`;
    return [
        text('v' + version, 458, 51, 21, '0xc7d2e3', '0x1a1f28'),
        text(digits, 307, 1032, 20, '0xd8e2d2', '0x0d1117'),
        // 只重写数字后的中文，保留原日志时间戳；字体用中文字体，避免方框。
        draw(cjkFont, '项通过', 410, 1031, 20, '0xd8e2d2', '0x0d1117'),
        // 原截图末尾有一小段被截断的时间戳残影，补一块日志底色保持干净。
        fill(474, 1030, 92, 27, '0x0d1117'),
    ].join(',');
}

const jobs = [
    ['social-preview-light.webp', socialFilters('light')],
    ['social-preview-dark.webp', socialFilters('dark')],
    ['panel.webp', panelFilters()],
];
for (const [name, filter] of jobs) {
    const src = join(ROOT, 'docs', name);
    if (!existsSync(src)) {
        console.error(`缺图片：${src}`);
        process.exit(1);
    }
    const png = join(tmp, name.replace(/\.webp$/, '.png'));
    const out = join(tmp, name);
    toPng(src, png);
    run(['-i', png, '-vf', filter, '-frames:v', '1', join(tmp, 'patched.png')]);
    toWebp(join(tmp, 'patched.png'), out);
    renameSync(out, src);
    console.log(`✓ docs/${name}`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`完成：${version} / ${count} 项自检`);
