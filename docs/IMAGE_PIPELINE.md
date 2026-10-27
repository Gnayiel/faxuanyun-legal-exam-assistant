# 文档图片生成说明

README 使用的三张图：

- `docs/social-preview-light.webp`
- `docs/social-preview-dark.webp`
- `docs/panel.webp`

都是仓库内的脱敏海报/截图，不包含真实账号信息。发版时版本号和自检数会变化，用脚本重新生成，避免手工维护漂移。三张图都由 Chrome 从 HTML 重新渲染：`panel.webp` 使用脚本自身的 `PANEL_CSS` 与固定演示状态，题库题数 / 手改数 / 体积 / 错题数从 `data/` 最新快照自动读取；两张社交预览使用独立 HTML（右侧嵌入这张干净面板）；ffmpeg 只负责把截图转成 WebP，不再在旧图上覆盖文字：

```bash
# 默认读取 package.json 的 version、README 里的 self--test-N 徽章
npm run docs:images

# 或显式指定
node tools/generate-docs-images.mjs --version 3.0.0 --count 193
```

依赖：`ffmpeg`（PNG→WebP，可用 `FFMPEG` 指定）、Chrome/Chromium（可用 `CHROME` 指定）与系统中文字体。面板按 316×561、2 倍缩放截图（输出 632×1122）；社交预览按 1280×640、1 倍截图。若本机没有 Chrome 或 `ffmpeg`，脚本会直接报错；中文字体缺失时截图会出现方框，请先安装中文字体。脚本只在本地手动运行，不进入 CI。

## 发版检查清单

1. 改版本号后执行 `npm run docs:images`，用图片查看器确认三张图的版本号/自检数/题库数字正确；替换题库快照后也要跑一次；
2. `npm run ci`（含页面冒烟 135 项）全绿；
3. `node tools/release.mjs --check-ci vX.Y.Z` 通过后再打 tag；
4. 若调整海报布局，改 `tools/generate-docs-images.mjs` 里的 `socialHtml()`；若调整面板演示状态或布局，改 `panelHtml()`（以及脚本里的 `PANEL_CSS`），再生成；题库数字不要手改，脚本从 `data/` 快照读取。不要改坐标去覆盖旧图上的文字。
