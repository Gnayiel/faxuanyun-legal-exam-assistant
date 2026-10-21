# 贡献指南

感谢愿意一起维护这个项目。先说明：这是一个个人学习项目，维护精力有限，issue / PR 会尽量看，但不保证响应时间。

## 适合提交什么

- **平台改版导致的选择器失配**（最优先）
- 脚本 bug、浏览器 / 油猴兼容性问题
- 文档错误、题库快照问题
- 新功能：用 [功能建议模板](.github/ISSUE_TEMPLATE/feature_request.yml) 说明场景与方案；方向不确定时先到 GitHub Discussions 讨论，避免做完才发现方向不对

## 开始之前

- Node.js ≥ 22（工具脚本只用 Node 内置模块，**没有任何 npm 依赖**）
- Edge / Chrome / Chromium 任一（浏览器冒烟用；可用 `FX_BROWSER` 指定可执行路径）
- 不需要构建：改完 `faxuanyun-legal-exam-assistant.user.js`，重新装到油猴里刷新页面即可
- 先读 [架构说明](docs/ARCHITECTURE.md) 和 [开发与测试](docs/DEVELOPMENT.md)，尤其是站点适配层与测试分层

## 快速验证

提交前至少跑：

```bash
npm test        # 内置自检 + 题库合并，不要求浏览器
npm run check   # 语法、文档链接、数字、数据、工作流
npm run ci      # 9 步统一门禁，含两个真实浏览器冒烟
```

`npm run ci` 每一步查什么、失败怎么定位，见 [开发文档的统一门禁](docs/DEVELOPMENT.md#统一门禁)。浏览器冒烟在没有浏览器时默认跳过；CI 用 `--require-browser` 强制失败，避免「没装浏览器 → 静默跳过 → 假绿」。

## 代码约定

1. 单文件 userscript，无构建、无第三方依赖；不要把 npm 包引进来。
2. 平台相关选择器集中在「站点适配层」`SEL` / `BTN` 两组常量里，业务逻辑里不要新增散落选择器；平台改版只改这一层。
3. 新逻辑尽量写成纯函数并挂进 `__FX_TEST__` 与内置自检用例（`selfTestCases`）；断言数变化后同步 `README.md`、`CHANGELOG.md`、脚本注解与 `docs/DEVELOPMENT.md`。
4. 面板 DOM 在 Shadow DOM 里构建；静态骨架可以一次性 `innerHTML`，但用户/页面/网络数据一律 `createElement` / `textContent`，禁止把动态内容拼进 HTML。
5. 不引入遥测、不请求 `@connect` 白名单之外的域名；新增域名要同步脚本头部 `@connect` 与 `CONNECT_HOSTS`（`tests/selftest.mjs` 会校验两者一一对应）。
6. 不提交 API Key、带日期的题库导出、日志或其它个人数据；仓库只放脚本、文档、工具和一份演示快照。
7. 文本文件 UTF-8 无 BOM、LF 换行（`.gitattributes` 已设置）；`data/README.md` 的命名与放行规则继续遵守。

## 测试与文档

- `tests/` 放可执行测试和夹具，`tools/` 放开发、检查、发布工具；不要往 `tests/` 塞一次性脚本。
- 加断言、加 fixture、加 AI 用例的步骤见 [开发文档的测试分层](docs/DEVELOPMENT.md#测试分层)；夹具必须是脱敏页面，不含真实账号、考试名称或个人信息。
- 断言数是多处写死的：`README.md` 徽章、`CHANGELOG.md` 当前版本、脚本 `@description` 与文件结构注释、`docs/DEVELOPMENT.md`、`tests/page-smoke.mjs` 的 `EXPECTED_ASSERTIONS`。改完跑 `npm test`，`selftest.mjs` 会指出缺哪个数字。
- 改文档后跑 `npm run check`：`tools/check-docs.mjs` 会检查相对链接与 Markdown 锚点，死链不会等到 GitHub 上才暴露。

## 题库快照维护

- 随仓库分发的快照（如 `data/faxuanyun-legal-exam-bank-20261020.*`）是某一时刻的切片，**不会随每个版本自动更新**。
- 题库有实质变化时，用面板导出新的 `.json` + `.csv`，按 `data/README.md` 的命名规则替换或新增，并在 `CHANGELOG.md` 里说明来源与日期。
- 换成新快照时，用新日期戳的一对文件替换旧文件即可（`.gitignore` 已按命名规则通配放行）；`data/` 只保留一份快照，`tools/check-data.mjs` 会拦第二份。

## 真机确认

自动测试覆盖不到油猴自动更新、bfcache 返回、自动关闭、多标签页同场、百度 / AI 真实收益等链路。发版前建议按 [开发文档的真机回归清单](docs/DEVELOPMENT.md) 在真实考试页逐项过一遍；报 bug 时用面板「导出诊断包」回传（已脱敏，不含 API Key）。

## 发版

发版由维护者按 [发版流程](docs/RELEASING.md) 执行：版本号、CHANGELOG、README 徽章与 tag 同步，`release.yml` 负责建 Release 与回读校验。贡献者不需要自己打 tag 或发布 Release；涉及版本的 PR 先说明意图，由维护者确认发布时机。

## 报告问题

- 普通 bug：用仓库的 [issue 模板](.github/ISSUE_TEMPLATE/bug_report.yml)
- 功能建议：先到 [Discussions](https://github.com/Gnayiel/faxuanyun-legal-exam-assistant/discussions) 讨论，确认方向后再开 issue / PR
- 安全问题、泄露的 Key：走 [SECURITY.md](SECURITY.md)，不要公开贴
- 使用问题与求助：见 [SUPPORT.md](SUPPORT.md)
- 参与讨论请遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
