# 更新日志

本文件记录**甘肃省国家工作人员学法考试平台自动答题助手**的所有版本变更。
版本号以脚本头部的 `@version` 为准；面板标题栏会显示当前版本。

> **关于版本号**：仓库首次公开的版本是 `v2.0.0`（2026-10-17）。
> 更早的 2.x 内部迭代没有随仓库公开，其记录不再维护；
> 随仓库分发的题库快照 JSON 里 `"version": "2.0.0"` 是导出时的脚本版本号，只作溯源用。

变更分四类：**新增**（新能力）、**变更**（行为或文案改了）、**修复**（原来不对的）、**移除**。
每个版本末尾的「验证方式」写的是**当次真实跑出来**的结果；可复现的命令见
[CONTRIBUTING 的质量门禁](CONTRIBUTING.md#质量门禁与工具)。

---

## v2.0.12

**2026-10-21**

> 自动更新改走国内可达的 jsDelivr；答题过程中题库定时落盘，浏览器崩了也不再有「白答一轮」；顺手清掉死代码与重复的 `@match`。

**变更**

- `@downloadURL` / `@updateURL` 从 `raw.githubusercontent.com/.../main/...` 改指 jsDelivr 镜像 `cdn.jsdelivr.net/gh/Gnayiel/faxuanyun-legal-exam-assistant@main/faxuanyun-legal-exam-assistant.user.js`。raw 在国内多数网络下不可达，「检查更新」会静默失败；镜像的缓存延迟（约 12 小时以内）换来的是国内用户真能收到更新。README 的安装说明同步把镜像提到推荐位，raw 退为备用。
- 答题过程中补上落盘节流：每答一题尝试落盘一次，但最多每 `CONFIG.bankFlushMinInterval`（默认 20000 毫秒）写一次盘。此前 `flushBank()` 只在导入 / 对账 / 页面关闭（`beforeunload` / `pagehide` / `visibilitychange`）时被调用，浏览器崩溃、被系统回收、手机切后台被 OOM 都不会触发这些事件，那一轮新学的答案与命中统计会整轮丢失。
- 脚本头 `@author` / `@homepageURL` / `@supportURL` 与仓库地址的大小写统一为 `Gnayiel`（GitHub 大小写不敏感，功能不受影响）。`@namespace` 保持原样——它是脚本身份，改了油猴会当成另一个脚本。
- `CHANGELOG.md` 只保留最近三个版本，更早的记录移入 `CHANGELOG-archive.md`（内容原样保留，不再更新）。

**修复**

- 删除从未被调用的 `getTotalQ()`：所有调用方用的都是 `getTotalQExact()`，兜底值 `CONFIG.defaultTotalQ` 另有用处，保留。
- 去掉与 `*://*.faxuanyun.com/*` 完全重复的 `@match *://gs.faxuanyun.com/*`（后者覆盖前者）。

**验证方式**

- `node tools/selftest.mjs`：元数据 + 内置 **181 项**断言 + 文档数字校验全部通过。
- `node tools/check-data.mjs`、`node tools/check-workflows.mjs`：通过。
- `node tools/panel-smoke.mjs --require-browser`：**40 项断言全部通过**；`node tools/page-smoke.mjs --require-browser`：**72 项断言全部通过**。
- `node --check faxuanyun-legal-exam-assistant.user.js`：通过。
- `node tools/release.mjs --check-ci v2.0.12`：通过。

---

## v2.0.11

**2026-10-21**

> CodeQL 收尾：把「HTML 转纯文本」从正则剥标签换成浏览器解析器，顺带清掉测试里的两处误报，安全页告警归零。

**修复**

- `stripHtml` 不再用 `<[^>]*>` 这类正则剥标签（CodeQL `js/bad-tag-filter`：正则做 HTML 过滤永远会漏），改用 `DOMParser` 解析成惰性文档后取 `textContent`，并移除 `script/style/noscript`；实体解码、注释、畸形标签交给解析器。没有 DOM 的宿主回退到单遍实体解码。
- `tools/selftest.mjs` 的 `downloadURL` / `updateURL` 断言从 `endsWith()` 改成解析 URL 取 pathname 末段比较（CodeQL `js/incomplete-url-substring-sanitization`）。
- `tools/selftest.mjs` 的标题 `slugify` 去掉「剥标签」式的伪消毒，改成只滤掉尖括号与非词字符（CodeQL `js/incomplete-multi-character-sanitization`）：它只用于把 README 标题换算成锚点，没有 HTML 上下文。

**验证方式**

- `node tools/selftest.mjs`：元数据 + 内置 **181 项**断言 + 文档数字校验全部通过。
- `node tools/check-data.mjs`、`node tools/check-workflows.mjs`：通过。
- `node tools/panel-smoke.mjs --require-browser`：**40 项断言全部通过**；`node tools/page-smoke.mjs --require-browser`：**72 项断言全部通过**。
- `node --check faxuanyun-legal-exam-assistant.user.js`：通过。
- `node tools/release.mjs --check-ci v2.0.11`：通过。

---

## v2.0.10

**2026-10-21**

> 安全与健壮性收尾：修掉 GitHub CodeQL 首扫报出的正则回溯与 HTML 实体二次解码两处真实缺陷，顺手把 README 预览图从 PNG 换成 WebP。

**修复**

- 答案文本解析的「提示词 + 字母」正则把 `[\s]*` 嵌在 `(?:…)*` 里，遇到「答案是」后面跟超长空白时会发生灾难性回溯、整页假死（CodeQL `js/redos`）。改为单层字符类 `[是为:：\]】）)］\s]*`，匹配线性化，语义不变。
- `stripHtml` 先解 `&amp;` 再解 `&lt;`/`&gt;`，`&amp;lt;` 会被二次解码成 `<`（CodeQL `js/double-escaping`）。改为单遍实体映射 `decodeEntities`，并把 script/style 剥离正则收紧为允许属性与结尾空白。
- `tools/panel-smoke.mjs` / `tools/page-smoke.mjs` 的 DOM 反解实体同样改成单遍，快照里的 `&amp;quot;` 不再解错。
- `tools/selftest.mjs` 的 `@match` 与四个仓库地址断言从 `includes()` 改成锚定正则 / URL 解析（CodeQL `js/incomplete-url-substring-sanitization`），顺带堵住 `*://evil.com/?u=faxuanyun.com/*` 这类假通过。
- `tools/selftest.mjs` 的 `slugify` 告警（`js/incomplete-multi-character-sanitization`）属误报：它只用于算 README 锚点、不产出 HTML，加注释说明后在 Security 页面 dismiss。

**变更**

- README 顶部深浅色预览图从 PNG（728 KB + 619 KB）换成 WebP Q82（59 KB + 60 KB），合计 **1.35 MB → 117 KB**；`docs/social-preview-*.png` 不再随仓库分发。
- CI 小加固：`.github/workflows/selftest.yml` 的 checkout 设 `persist-credentials: false`（该 job 不推送代码）；`.github/dependabot.yml` 补 `labels` 与 `open-pull-requests-limit: 5`。
- 内置自检 **179 → 181 项**：新增「提示词正则遇到超长空白不回溯爆炸」「实体单遍解码」两条纯函数断言。

**验证方式**

- `node tools/selftest.mjs`：元数据 + 内置 **181 项**断言 + 文档数字校验全部通过。
- `node tools/check-data.mjs`、`node tools/check-workflows.mjs`：通过。
- `node tools/panel-smoke.mjs --require-browser`：**40 项断言全部通过**；`node tools/page-smoke.mjs --require-browser`：**72 项断言全部通过**。
- `node --check faxuanyun-legal-exam-assistant.user.js`：通过。
- `node tools/release.mjs --check-ci v2.0.10`：通过。

---

更早的版本记录（v2.0.0 – v2.0.9）见 [CHANGELOG-archive.md](CHANGELOG-archive.md)。
