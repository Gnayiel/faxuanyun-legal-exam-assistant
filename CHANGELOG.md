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

## v2.0.13

**2026-10-21**

> v2.0.12 把自动更新指向了 `cdn.jsdelivr.net`，实测在国内被重置（`ERR_CONNECTION_RESET`）——换成同一 CDN 的 `fastly.jsdelivr.net` 边缘域名，路径不变。

**修复**

- `@downloadURL` / `@updateURL` 的主机从 `cdn.jsdelivr.net` 换成 `fastly.jsdelivr.net`。`cdn.jsdelivr.net` 在用户网络（甘肃移动）下连接被重置，`fastly` / `gcore` / `testingcf` 三个边缘域名实测均 200 且内容为同一份（`@version` 一致）；三个域名共享缓存，可随时互换。
- `tools/selftest.mjs` 的镜像 host 断言从只认 `cdn.jsdelivr.net` 改为认 `cdn` / `fastly` / `gcore` / `testingcf` 四个边缘域名；`release.yml` 的 purge 步骤改为按路径拼 `purge.jsdelivr.net` 地址，不再假定具体边缘域名。

**验证方式**

- `node tools/selftest.mjs`：元数据 + 内置 **181 项**断言 + 文档数字校验全部通过。
- `node tools/check-data.mjs`、`node tools/check-workflows.mjs`：通过。
- `node tools/panel-smoke.mjs --require-browser`：**40 项断言全部通过**；`node tools/page-smoke.mjs --require-browser`：**72 项断言全部通过**。
- `node tools/release.mjs --check-ci v2.0.13`：通过。

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

更早的版本记录（v2.0.0 – v2.0.10）见 [CHANGELOG-archive.md](CHANGELOG-archive.md)。
