# 更新日志

本文件记录**甘肃省国家工作人员学法考试平台自动答题助手**的所有版本变更。
版本号以脚本头部的 `@version` 为准；面板标题栏会显示当前版本。

> **关于版本号**：仓库首次公开的版本是 `v2.0.0`（2026-10-17）。
> 更早的 2.x 内部迭代没有随仓库公开，其记录不再维护；
> 随仓库分发的题库快照 JSON 里 `"version": "2.0.7"` 是导出时的脚本版本号，只作溯源用。

变更分四类：**新增**（新能力）、**变更**（行为或文案改了）、**修复**（原来不对的）、**移除**。
每个版本末尾的「验证方式」写的是**当次真实跑出来**的结果；可复现的命令见
[CONTRIBUTING 的质量门禁](CONTRIBUTING.md#质量门禁与工具)。

---

## v2.0.16

**2026-10-21**

> 答题正确性与数据安全收口：成绩页不再被「未答」灰格误判，KEYED 不再把干扰项当答案；
> 导入失败不再留下半套数据，诊断包公开贴出也不泄露 Key；发版门禁只留一份清单。

### 修复

- **成绩页误判（P0）**：`isResultPage` 现在要求至少 3 个结果格、且其中至少 1 个判为「对/错」（`hasResultMark()`）；
  只有「未答」灰格的答题卡不再被当成成绩页，避免交卷后误关页、误清会话、把未作答当 0 分。
- **答题卡判色**：`cellVerdict()` 先判错再判对，修 `/correct/i` 命中 `incorrect` 把错题当对题；
  文字标记先认「错误/不正确」，红字白底（`isReddish(fg)`）也判错。
- **答案点到新题**：`answerCurrent()` 在等待联网前记录 `questionSignature()`，返回后题目已切换、
  选项节点被重渲染且文本不一致时放弃本题（`stale-question`），不再把上一题答案点到新题。
- **KEYED 过捕**：非多选解析出多个字母时返回 `null` 转人工；「正确答案：B，A项错误」这类
  尾随干扰项先剥离「A项」再收敛，避免把 `A` 当答案。
- **导入半套数据**：CSV / JSON 逐行、逐条 `try/catch`，坏行只计入失败原因并继续，不再中途抛出留下
  写了一半的题库；空文件、坏文件不清墓碑（已删除的条目 7 天内不会被复活）；导入文本超过 5 MB
  （按字符计）直接拒绝，防止大文件把页面卡死。
- **CSV 公式注入**：导出时对 `=`、`+`、`-`、`@`、TAB、CR 开头的单元格前置 `'`，Excel / WPS 打开不执行公式；
  导入时只剥这个保护前缀，自导自入不串数据。
- **满库淘汰**：`enforceCapacity()` 增加保护级（用户手改、本次导入优先，普通旧题先淘汰），
  淘汰条目登记墓碑并写日志，不再随机丢新题。
- **落盘失败刷屏**：写盘失败改为指数退避 2s→30s，日志前 2 次后每 5 次一条；落盘前重读墓碑，
  防止另一个标签页刚删掉的条目被旧副本搬回。
- **诊断包脱敏**：导出时跳过 `keySalt`，日志中的 `sk-*` / `Bearer` 打码，URL 只保留 origin+pathname
  （查询串里的 key/token 不外泄）。
- **题型误判**：答案文本为「正确/错误/对/错/是/否/√/×」时判为判断题，不再落到单选。
- **旧数据兼容**：`migrateBank()` / `sameTexts()` 接受字符串形式的 `a`，避免 `e.a.join` 抛错导致整库读不出。

### 变更

- **面板**：宽度 `min(300px, calc(100vw - 24px))`、高度 `calc(100vh - 92px)` 自适应，矮窗口上移不挡答题区；
  触屏（`pointer: coarse`）按钮 40px；`prefers-reduced-motion` 关动效；重复注入只创建一个面板；
  提示条可聚焦、Enter / 空格关闭；「关闭页」按钮文案缩短为「关闭页：8s / 15s / 30s / 不关」。
- **网络**：请求完成幂等、支持中止；429 读取 `Retry-After` 再退避，重试加 0~200ms 抖动、单次上限 30s；
  响应体按 UTF-8 字节截断，广告页不再整段进内存；AI 返回 `confidence: 0` 不再被当成 0.9，单选多字母丢弃。
- **自检**：内置断言 181 → 190，新增 KEYED 干扰项、CSV 公式消毒往返、判断题文字题型、
  成绩页闸门 3 条、诊断脱敏等用例。
- **文档 / 数据契约**：README 重写更新记录、FAQ 增补自动更新 / API Key / 导入排查、面板表补
  「导出诊断包」「导出争议题」、说明 ≤v2.0.12 必须手动重装一次；预览图改 WebP；
  `data/bank.schema.json` 按真实语义修正（`s`=科目、`a`=选项内容数组、`l`=答案字母、`cft`=冲突次数、
  `wrong` 结构、`exportedAt` ISO），`data/README.md` 补字段表；全仓 `docs/panel.png` 换为无损
  `docs/panel.webp`（109 KB → 54 KB）。

### 工具链 / CI

- 新增 `tools/ci.mjs`：语法 → 自检 → 数据/文档 → 工作流 → 题库合并冒烟 → 面板冒烟 → 页面冒烟，
  七步一份清单；`selftest.yml`、`release.yml` 与本地 `npm run ci` 共用，杜绝「本地跑 A、CI 跑 B」。
- `release.mjs` 修复假绿：缺浏览器不再静默跳过；先 `git fetch --tags` 再判 tag 是否存在；
  tag 已指向 HEAD 时直接退出，否则门禁全绿后才打 tag；「下一步」打印
  `git push origin main && git push origin vX.Y.Z`，避免先推 tag 导致 Release 指向旧提交。
- `check-workflows.mjs` 增加结构校验：`on` / `jobs` / `runs-on` / `timeout-minutes`、cron 必须 5 段、
  禁 TAB 缩进、permissions 只允许合法键值且禁 `write-all`，每条都有负例自测。
- `check-data.mjs` 增加 CSV↔JSON 逐行一致性、公式前缀、schema 负例、`oneOf` 恰好命中一次、
  快照语义校验；`--fix` 只修数字。
- 新增 `check-syntax.mjs`（全量 `node --check` + JSON 解析）、`merge-smoke.mjs`
  （冲突计数 / 用户优先 / 错题并集 / 幂等 / CSV 消毒）、`backfill-release-notes.mjs`
  （把历史 Release 里指向 `main` 的首装链接改为钉 tag 的 jsDelivr，支持 `--dry-run`）。
- `page-smoke.mjs` 增加「预置题库本地命中」用例，断言 72 → 88；`panel-smoke.mjs` 同步关闭按钮
  「8s」文案（40 项不变）。
- workflows 加固：`selftest.yml` Node 22/24 matrix 统一 `npm run ci`；`release.yml` 全局
  `concurrency: release`、`persist-credentials: false`、首装链接钉到本次 tag、附件下载后
  `sha256sum -c` 复算；`auto-merge` 等必填 checks（退出码 8 重试 10×15s）；`backfill-sha256`
  上传后重新下载复算。

### 验证方式

- `node tools/selftest.mjs`：元数据 + 内置 **190 项**断言 + 文档数字校验全部通过。
- `node tools/check-data.mjs`、`node tools/check-workflows.mjs`、`node tools/merge-smoke.mjs`、`node --check`：通过。
- `node tools/panel-smoke.mjs --require-browser`：**40 项断言全部通过**。
- `node tools/page-smoke.mjs --require-browser`：**88 项断言全部通过**。
- `node tools/ci.mjs --no-browser`：语法 / 自检 / 数据文档 / 工作流 / 题库合并冒烟 5 步全绿；
  两项浏览器冒烟另行全跑（40/40、88/88）。`node tools/release.mjs --check-ci v2.0.16` 通过。
- `npm run ci` 是含浏览器冒烟的七步完整清单，在 GitHub Actions `selftest.yml` 的 Node 22 / 24 两个 job 上全绿后才会发版。

## v2.0.15

**2026-10-21**

> 自动更新改用 `@latest`，绕开 jsDelivr 的分支缓存空窗。

### 修复
- `@downloadURL` / `@updateURL` 的 jsDelivr 路径从 `@main` 改为 `@latest`：jsDelivr 对分支路径有最长 12 小时的边缘缓存，
  发版后 purge 接口返回 `"status": "finished"` 但三个边缘仍持续返回旧版本（实测发 v2.0.14 后 `@main` 仍停在 2.0.12）；
  `@latest` 按 tag 解析，缓存窗口更短（同一次发版实测 `@latest` 只落后 1 个版本）。仍受边缘缓存影响，不等同即时生效；
  需要固定版本时用 `@vX.Y.Z` 直链（实测新 tag 的该路径在三个边缘立即返回新版本）。
- `tools/selftest.mjs` 的自动更新地址白名单同步接受 `@latest`。

### 验证方式
- `node --check`、`selftest`（181/181）、`check-data`、`check-workflows`、`release.mjs --check-ci v2.0.15`：通过。
- 发版后 `curl https://fastly.jsdelivr.net/gh/.../@latest/...user.js` 仍受边缘缓存影响：新 tag 的 `@vX.Y.Z` 路径在三个边缘立即生效，
  而 `@latest` 通常要数小时才陆续刷新；2026-10-21 实测 v2.0.15 已发布，三个边缘的 `@latest` 仍停在 2.0.14，不能承诺即时。

## v2.0.14

**2026-10-21**

> 内部工程化收口：内置自检按主题拆成 8 组、30 处静默失败改为留痕、题库格式补上机器可校验的 schema，两份冒烟的油猴打桩合并成一份。

**变更**

- `selfTestCases()` 从 933 行单函数拆成 8 个主题分组（`casesParsing` / `casesDecision` / `casesIo` / `casesUiState` / `casesPageParse` / `casesReconcile` / `casesNetwork` / `casesReliability`），`selfTestCases()` 只做拼接。断言总数不变（181），拆分只为定位失败和 review。
- 自检共用的固定输入（`CASE_OPTS_5Y` / `CASE_JUDGE_OPTS` / `CASE_YN_OPTS` / `CASE_SINGLE_OPTS` / `CASE_BANK_ENTRY`）提升到模块作用域——拆分后它们要被多个分组共用。
- 新增 `tools/_harness.mjs`：`gmCore()` / `noNetwork()` / `downloadHook()` / `fakeBaidu()` 四个页面内打桩片段，由 `panel-smoke.mjs` 与 `page-smoke.mjs` 共用，删掉两份各自维护的重复实现。
- 新增 `data/bank.schema.json`（JSON Schema draft-07），并在 `tools/check-data.mjs` 里用同一份 schema 校验随仓库分发的快照——文档写的格式与文件实际格式不再各走各的。
- `package.json` 补上 `version` 字段，`tools/selftest.mjs` 增加一条断言：`package.json` 的 version 必须与 `@version` 一致（第 5 个版本号副本从此有门禁）。

**修复**

- 30 处 `catch {}` 改为 `safeWarn(标签, e)`：存储配额满、隐私模式禁用 storage、页面结构变化时不再静默失灵，面板日志会留一条「⚠ … 失败，已跳过」，同一类只记一次（避免刷屏）。

**验证方式**

- `node tools/selftest.mjs`：元数据 + 内置 **181 项**断言 + 文档数字校验全部通过。
- `node tools/check-data.mjs`（含 schema 校验）、`node tools/check-workflows.mjs`：通过。
- `node tools/panel-smoke.mjs --require-browser`：**40 项断言全部通过**；`node tools/page-smoke.mjs --require-browser`：**72 项断言全部通过**。
- `node tools/release.mjs --check-ci v2.0.14`：通过。

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
