# 文档图片生成说明

README 使用的三张图：

- `docs/social-preview-light.webp`
- `docs/social-preview-dark.webp`
- `docs/panel.webp`

都是仓库内的脱敏海报/截图，不包含真实账号信息。发版时版本号和自检数会变化，用脚本重新生成，避免手工维护漂移。`panel.webp` 由 ffmpeg 更新版本徽章/日志数字；两张社交预览由 Chrome 渲染独立 HTML（右侧嵌入 `panel.webp`），不再在旧图上反复盖字：

```bash
# 默认读取 package.json 的 version、README 里的 self--test-N 徽章
npm run docs:images

# 或显式指定
node tools/generate-docs-images.mjs --version 3.0.0 --count 193
```

依赖：`ffmpeg`、Chrome/Chromium（可用 `CHROME` 指定）、DejaVu Sans Bold、Droid Sans Fallback（可用 `FX_FONT` / `FX_CJK_FONT` / `FFMPEG` 覆盖路径）。社交预览按 1280×640、`--force-device-scale-factor=1` 截图；若本机没有 Chrome，脚本会直接报错，不会写出半成品。脚本只在本地手动运行，不进入 CI。

## 发版检查清单

1. 改版本号后执行 `npm run docs:images`，用图片查看器确认三张图的版本号/自检数正确；
2. `npm run ci`（含页面冒烟 135 项）全绿；
3. `node tools/release.mjs --check-ci vX.Y.Z` 通过后再打 tag；
4. 若调整海报布局，改 `tools/generate-docs-images.mjs` 里的 `socialHtml()`；若调整面板截图，改 `panelFilters()` 的坐标与底色，再生成。
