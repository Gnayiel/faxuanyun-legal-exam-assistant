# 支持

这是一个个人维护的开源项目，没有客服团队，也不承诺固定响应时间。提问前请先按下面自查，能解决大部分“脚本没反应 / 不自动答”的问题。

## 先自查

1. **确认版本**：面板标题栏或油猴「已安装脚本」里显示的 `@version` 是否为最新版。旧版可能已被平台改版影响；升级方法见 [README.md](README.md#更新与自动更新)。
2. **看常见问题与已知限制**：[README.md](README.md#常见问题) 与 [README.md](README.md#已知限制) 覆盖了安装、更新、AI 配置、平台页面适配范围、自动关闭被拦截等高频情况。
3. **看面板日志**：面板「日志与自检」里先看红色错误与 `warn`，很多失败（例如 AI 401、百度验证、页面未识别）日志里已写明原因。
4. **最小化复现**：暂时关闭其它油猴脚本、换一个浏览器配置或隐身窗口再试，确认不是扩展冲突。
5. **确认范围**：脚本只适配 README 列出的考试/成绩页面；未适配的页面不会出现面板，也不应强行注入。

## 该去哪里

| 情况 | 渠道 |
| --- | --- |
| 脚本 bug（报错、识别失败、导入导出异常、平台改版失配） | [提交 Issue](https://github.com/Gnayiel/faxuanyun-legal-exam-assistant/issues/new/choose)，选择「Bug 报告」模板 |
| 使用问题、功能建议、求脚本、刷课刷视频等非 bug 讨论 | [GitHub Discussions](https://github.com/Gnayiel/faxuanyun-legal-exam-assistant/discussions)（若无法访问，可在 issue 中说明，但请勿开空白 issue） |
| 安全问题、疑似凭据泄露、绕过限制的漏洞 | **不要发公开 issue**，按 [SECURITY.md](SECURITY.md) 走私密报告 |
| 想贡献代码或文档 | 先读 [CONTRIBUTING.md](CONTRIBUTING.md)；开发与测试见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |

仓库已关闭空白 issue，必须选择模板；与项目无关的“求脚本 / 刷课”类请求会被关闭。

## 提问需要附带的材料

按模板填写即可，信息越具体处理越快：

- **脚本版本**：例如 `2.0.21`（不要写“最新版”）。
- **浏览器与版本**：Edge / Chrome / Firefox 的具体版本。
- **脚本管理器与版本**：Tampermonkey / Violentmonkey 的具体版本。
- **出问题的位置**：考试答题页 / 成绩页 / 面板本身 / 题库导入导出。
- **复现步骤**：从打开页面到出问题的每一步，越具体越好。
- **期望行为与实际行为**：一句话说明“应该怎样、实际怎样”。
- **面板日志**：复制相关片段；如果方便，附上面板「导出诊断包」生成的 `fx-diagnostics-<日期>-<时间>.json`。诊断包含版本、浏览器 UA、脱敏 URL、命中规则、配置、请求统计、存储计数与最近日志；**不含 API Key**，日志中的 `sk-`、`Bearer`、`key`/`token` 查询参数已脱敏。
- **截图**：可选，注意遮住姓名、单位、成绩等个人信息。

## 不要贴出来的内容

- **AI 接口的 API Key**、`Authorization` 头、完整请求体；日志若带出 Key，请先删掉再贴。
- 账号、密码、Cookie、身份证号、姓名、单位、考试邀请码等个人信息。
- 未脱敏的完整 URL（可能带 token / 查询参数）；诊断包已做脱敏，优先用它。
- 他人的成绩单、答题记录截图（除非已彻底打码）。

如果怀疑 Key 已泄露：立即到对应 AI 服务商后台吊销并重新生成；不要在 issue 里补发旧 Key。

## 响应预期

- 这是个人项目，维护者利用业余时间处理，**不承诺固定时限**，也不保证每个问题都能修（例如平台改版、地区差异、浏览器策略限制）。
- 安全问题按 [SECURITY.md](SECURITY.md) 的时限处理（首次回复通常在 7 天内）。
- 提交前请确认已看过常见问题与已知限制；重复提问可能会被合并或关闭。
- 修复发布后会在 [CHANGELOG.md](CHANGELOG.md) 与 Releases 中说明；升级方式见 [README.md](README.md#更新与自动更新)。

## 自己动手

如果你能定位问题，欢迎直接提 PR：

- 开发环境、命令与门禁：[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- 代码与提交约定：[CONTRIBUTING.md](CONTRIBUTING.md)
- 发版规则：[docs/RELEASING.md](docs/RELEASING.md)

即使不写代码，提供可复现的页面结构（脱敏后的 DOM 片段）、日志和稳定复现步骤，也是对修复最大的帮助。
