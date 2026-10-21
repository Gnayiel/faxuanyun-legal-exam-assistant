# 文档图片生成说明

README 使用的三张图：

- `docs/social-preview-light.webp`
- `docs/social-preview-dark.webp`
- `docs/panel.webp`

都是仓库内的脱敏海报/截图，不包含真实账号信息。发版时版本号和自检数会变化，用脚本重新盖字，避免手工维护漂移：

```bash
# 默认读取 package.json 的 version、README 里的 self--test-N 徽章
npm run docs:images

# 或显式指定
node tools/generate-docs-images.mjs --version 2.0.22 --count 193
```

依赖：`ffmpeg`、DejaVu Sans Bold、Droid Sans Fallback（可用 `FX_FONT` / `FX_CJK_FONT` / `FFMPEG` 覆盖路径）。脚本只在本地手动运行，不进入 CI。

## 发版检查清单

1. 改版本号后执行 `npm run docs:images`，用图片查看器确认三张图的版本号/自检数正确；
2. `npm run ci`（含页面冒烟 135 项）全绿；
3. `node tools/release.mjs --check-ci vX.Y.Z` 通过后再打 tag；
4. 若调整了海报/面板布局，先更新 `tools/generate-docs-images.mjs` 里对应的坐标与底色，再生成。
