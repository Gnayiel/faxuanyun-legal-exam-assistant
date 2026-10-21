# 测试与冒烟

本目录放**可执行测试**和它们的夹具；`tools/` 只放开发、检查、发布工具。两边都从仓库根目录运行，路径以脚本自身位置定位，换工作目录不影响。

| 文件 | 作用 | 需要浏览器 |
| --- | --- | --- |
| `selftest.mjs` | 加载用户脚本，校验元数据，跑脚本内置的 193 项断言和文档数字 | 否 |
| `merge-smoke.mjs` | 题库合并冒烟：冲突、用户答案优先、错题并集、幂等、CSV 公式消毒（17 项） | 否 |
| `panel-smoke.mjs` | 真实 Chromium 里建面板，检查按钮、导出文件名与导入落库等（42 项） | 是 |
| `page-smoke.mjs` | 在 `fixtures/` 的脱敏考试页 / 成绩页上跑站点适配与作答断言（135 项，11 个用例） | 是 |
| `_harness.mjs` | 两个浏览器冒烟共用的页面内打桩：GM 存储、断网、下载、百度、AI | — |
| `browser.mjs` | 浏览器探测与 headless 启动，两个冒烟共用 | — |
| `fixtures/` | 脱敏 HTML 页面，不含真实账号、考试名称或个人信息 | — |

常用命令：

```bash
npm test                 # selftest + merge-smoke，不要求浏览器
npm run smoke            # panel + page，需要 Chrome/Edge/Chromium
npm run ci               # 9 步统一门禁（含两个浏览器冒烟）
```

单独跑：

```bash
node tests/selftest.mjs
node tests/merge-smoke.mjs
node tests/panel-smoke.mjs --require-browser
node tests/page-smoke.mjs --require-browser
```

找不到浏览器时，两个冒烟默认**跳过**；加 `--require-browser` 或缺浏览器即失败，CI 用这个开关防止假绿。用 `FX_BROWSER=/path/to/chrome` 指定浏览器；`FX_PAGE_SMOKE_DUMP=1` 会把每个用例的页面与 DOM 落盘到系统临时目录。

## 改断言数时

断言总数不是本目录的私事，以下位置必须同步，否则 `npm test` / CI 会红：

- `README.md` 的 `self--test-N`、`panel--smoke-N`、`page--smoke-N` 徽章；
- `CHANGELOG.md` 当前版本「验证方式」里的数字；
- 用户脚本 `@description` 与文件结构注释里的「含 N 项内置自检」「N 项纯函数断言」；
- `docs/DEVELOPMENT.md` 的命令注释和测试分层说明；
- `tests/page-smoke.mjs` 的 `EXPECTED_ASSERTIONS` 与各用例 `expectCount` 之和。

新增 fixture 或页面用例时先读 `docs/DEVELOPMENT.md#测试分层`；不要让测试依赖真实站点、真实账号或外网。
