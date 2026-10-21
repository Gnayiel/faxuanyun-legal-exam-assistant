# 更新日志（归档）

本文件是 `CHANGELOG.md` 的归档部分，收录 **v2.0.0 – v2.0.14** 的历史记录，内容与当时发布时一致，不再更新。
当前版本与最近三个版本的记录见 [CHANGELOG.md](CHANGELOG.md)。

---

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

---

## v2.0.9

**2026-10-20**

> 收尾：判断题安全复用补上「量化词」闸门；导入题库后同步清会话缓存。另清理了仓库外会话日志里的明文访问凭据。

**新增**

- 判断题「量化词一致性」闸门：题干里 所有 / 全部 / 任何 / 部分 / 个别 / 有些 / 一律 / 全都 的数量不一致时，即使编辑距离 ≤ 2 也不复用（如「所有…」vs「部分…」）；「所有权 / 所有制 / 所有者」这类法律术语不会被误判为量化词。
- 内置自检新增 2 项纯函数断言（量化词闸门），**177 → 179 项**。

**修复**

- 导入题库成功后清空会话答案缓存，避免导入后同一场继续命中导入前的旧答案（R5 收尾）。

**安全**

- 清理仓库外会话日志中的明文 GitHub 访问令牌（仅本地脱敏；建议同步在 GitHub 撤销该 token）。

**验证方式**

- `node tools/selftest.mjs`：内置自检 **179 项断言全部通过**；文档数字/徽章/体积全绿。
- `node tools/panel-smoke.mjs --require-browser`：**40 项断言全部通过**。
- `node tools/page-smoke.mjs --require-browser`：72 项断言全部通过。
- `node tools/release.mjs --check-ci v2.0.9`：通过；`--dry-run`：通过。

---

## v2.0.8

**2026-10-20**

> 收掉 v2.0.7 复核留下的几个正确性尾巴：判断题安全复用加入「模态词」闸门，对账删除后同步失效会话缓存，AI 主响应不再被跟进页体积上限误伤；同时修掉 page-smoke 负例文案与争议导出里从未写入的字段。

**新增**

- 判断题「模态词一致性」闸门：题干里必须/应当/可以/不得/禁止/无需/无须/不能/不应/有权/无权 等模态词的数量不一致时，即使编辑距离 ≤ 2 也不复用，避免「应当 ↔ 可以」这类语义不同的判断题被复用后稳定答反。
- 内置自检新增 3 项纯函数断言（模态词闸门 / 对账后缓存失效 / 响应上限只作用于跟进页），**174 → 177 项**。

**修复**

- 交卷对账删除题库错答案后，同步失效本题的会话答案缓存（R5 收尾），同一场重放同题不再命中旧缓存。
- 大响应体截断只作用于百度跟进页，AI 主响应（JSON）不再受 512 KB 上限影响（R7 收尾）。
- 争议题导出移除从未写入的 `disputed` 字段（R10 收尾），导出结构只保留 `bad` 与 `fx_disputes` 冲突记录。
- `tools/page-smoke.mjs` 在断言数或用例数与 `EXPECTED_ASSERTIONS` 不一致时不再打印「通过」摘要行（T4 收尾）。

**文档**

- README 补「GitHub 被拦截时的手动更新兜底」说明。
- 真机回归清单标注多标签页同场双开为可选场景。

**验证方式**

- `node tools/selftest.mjs`：内置自检 **177 项断言全部通过**；文档数字 / 徽章 / 体积同步校验全绿。
- `node tools/panel-smoke.mjs --require-browser`：**40 项断言全部通过**。
- `node tools/page-smoke.mjs --require-browser`：**72 项断言全部通过**。
- `node tools/release.mjs --check-ci v2.0.8`：通过；`--dry-run`：前置检查通过。

## v2.0.7

**2026-10-20**

> 一轮以「命中率、网络效率、可观测性、门禁闭环」为中心的优化：判断题安全复用、答案会话缓存、
> 双源并行、多选组合上限、争议题与诊断包导出、墓碑定期清理与存储体积监控；工程侧把页面适配冒烟
> 扩到 6 个 fixture 并结构化断言，selftest 机检 page-smoke 数字、CI 深历史检出与发布体积留痕。
> 内置断言 136 → 174（面板冒烟保持 40，页面适配冒烟 40 → 72）。

### 新增

- **判断题安全相似复用**（`judgeStemMatch`，`CONFIG.judgeFuzzyMaxDiff = 2`）：规范化题干（去空白 / 标点 / 全半角统一）后
  完全相等，或长度 ≥ 10 且编辑距离 ≤ 2、题库中唯一命中时才复用该题答案；语义相反的题干不会因字面相似而答反，
  多命中或超差仍走网络。
- **会话级答案缓存**（`CONFIG.answerCacheTtl = 30 分钟`，最多 200 条）：同一题型 + 题干 + 选项组合在有效期内直接复用
  已合并的答案；强制造次源（`forceCrossCheck`）时绕过缓存；清场 / 新卷自动清空。
- **双源并行**（`CONFIG.parallelDualSource`）：需要次源时主源与次源共享同一 deadline 并行请求，
  单个来源失败不影响另一来源；可关闭开关回到串行。
- **争议题记录与导出**（GM 键 `fx_disputes`，上限 100 条）：两个来源都高置信但分歧、无法按 gap 定论时，
  把题干 / 选项 / 候选 / 理由记入争议列表；面板新增「导出争议题」，生成 JSON 供人工复核。
- **诊断包导出**：面板一键导出 JSON（版本、User-Agent、URL、选择器命中情况、CONFIG 快照、各来源请求统计、
  存储占用、墓碑 / 题库 / 错题计数、最近 300 条日志），报 bug 时可回传；不含 API Key。
- **存储占用监控**（`storageFootprint()`）：面板显示「存储占用 xx KB（题库 / 错题 / 墓碑）」，
  超过 `CONFIG.storageWarnBytes`（3 MB）时提醒一次。
- **多选组合上限**（`CONFIG.multiComboLimit = 256`、`multiComboBudgetMs = 1500`）：选项组合超过上限或生成超时
  不再穷举，可信候选优先，否则保留随机策略。
- **发布体积留痕**：Release notes 与 `tools/release.mjs` 输出脚本体积（KB、512 KB 预算、使用率）；
  上传前仍由 `selftest.mjs` 做体积硬门禁。
- **页面适配冒烟扩容**：新增判断题页、答题卡页、无总题数成绩页 3 个 fixture（共 6 个），断言改为结构化 JSON
  输出，并在文件内用 `EXPECTED_ASSERTIONS` 自洽校验，共 72 项；`selftest.mjs` 机检 README / CHANGELOG 里的
  page-smoke 数字。
- **真机回归清单**：README 新增维护者清单（自动更新跨版本、bfcache 返回、自动关闭、多标签同场双开、
  百度 / AI 真实站点收益、诊断包回传）。

### 变更

- `paperFingerprint` 的试卷指纹从「前 3 题」扩展到「前 6 题」（去重后排序），进一步降低不同试卷共用幂等键的概率。
- AI 结构化直采阈值从 conf ≥ 0.8 提高到 0.9（`CONFIG.aiDirectAcceptConf`），其余场景仍按 gap ≥ 0.3 判定。
- 百度跟进页响应体上限 512 KB（`CONFIG.followPageMaxBytes`），超长广告页截断后不再参与抽取。
- 墓碑清理从「仅加载时」改为「每 10 次落盘或条目 > 500 时」定期清理（`CONFIG.tombPurgeEvery`），长期挂页也不膨胀。
- `tools/selftest.mjs` 改为按脚本自身路径解析仓库（任意 cwd 运行都能过）；CI checkout 改为完整历史（`fetch-depth: 0`）。
- `tools/browser.mjs` 跑完冒烟自动清理临时 profile 目录。

### 修复

- `bankAnswerIsWrongPick` 对 `e.a` 非数组（历史数据单值 / `undefined`）不再抛错，按单值或文本安全降级判等。
- `selftest.mjs` 此前只机检 panel-smoke 断言数、漏检 page-smoke 数字；现在 README / CHANGELOG 的 page-smoke
  数字漏改会直接变红。
- `tools/selftest.mjs` 头部注释里过期的「97 项断言」文案。
- **面板 4 枚状态按钮文字压边框（v2.0.6 起）**：300–345px 宽的面板里，「节奏 / 交卷 / 调试 / 二源」和题库首行
  4 枚按钮一行放不下（按钮文字宽于内容区，字符压到边框、挤向相邻按钮，看起来像字体排版错位）；
  这两行改为 2×2 等宽网格（`.row.grid-2`），行内按钮内边距 8px→6px，其余行不变。
- **面板日志级别误判（v2.0.6 回归）**：`LOG_LEVELS` 的 emoji 字符类正则缺 `u` 标志，`🚫` 被拆成代理对后字符类里留下 `\uD83D`，
  导致 `🕒` / `📊` / `🎯` 等共享高位码元的普通日志被判成 `error`、显示成红色；补 `u` 标志并加 6 条日志级别回归断言。

### 验证方式

- `node --check faxuanyun-legal-exam-assistant.user.js` ✅
- `node tools/selftest.mjs` → **174 项断言全部通过**（内置 174 项 + 元数据 / 文档数字 / 版本徽章 / 体积预算校验）
- `node tools/panel-smoke.mjs --require-browser` → **40 项断言全部通过**（真实 Chromium 内核）
- `node tools/page-smoke.mjs --require-browser` → **72 项断言全部通过**（6 个脱敏 fixture）
- `node tools/check-data.mjs`、`node tools/check-workflows.mjs`、`node tools/merge-bank.mjs data/*.json -o /tmp/merged.json` 全部通过
- `node tools/release.mjs --check-ci v2.0.7` 通过；`node tools/release.mjs --dry-run` 前置检查全过
- 未做真实站点回归（同 v2.0.6）：百度反爬页面结构、站点整体改版与真实多标签页行为不在本机验证范围

---

## v2.0.6

**2026-10-20**

> 一轮以「正确率、数据安全、可回归」为中心的优化：对账加入试卷指纹、百度取答案的回显与跟进页相关性、
> 单题网络总预算、跨标签页删除的持久化墓碑；同时把页面适配冒烟与自动更新链路校验并入门禁。
> 内置断言 118 → 136（面板冒烟保持 40，新增页面适配冒烟 40）。

### 新增

- **试卷指纹**（`paperFingerprint`）：对账幂等键在「页面 + 分数 + 总分 + 逐题判定 + 记录数」之外，
  再加本场作答记录前 3 道题的指纹。同一成绩页重复解析仍然只入库一次，但同一标签页里重考另一张
  **题目不同** 的试卷时不再被误判为「已对账」，避免第二场静默漏入库。
- **百度跟进页相关性过滤**（`followPageRelevant`）：搜索结果之后不再无条件打开前两个链接，
  候选页必须先含题干特征（前 20 字或 bigram 重合度 ≥ 0.5）才继续抽取；跟进页请求 `maxRetry: 0`，广告页直接跳过。
- **单题网络总预算**（`CONFIG.queryBudgetMs`，默认 20 秒）：一次作答内 AI / 百度及跟进页请求共享同一 deadline，
  单个请求超时取「配置值与剩余预算的较小者」；预算耗尽立即用已得结果作答，不再换源或重试。
- **跨标签页删除的持久化墓碑**（`fx_bank_tombs` / `fx_wrong_tombs`，7 天 TTL）：删除记录时登记墓碑，
  别的标签页落盘合并前先过滤墓碑，旧标签页不会把已删条目「复活」；导入题库时重置本机墓碑，保留跨电脑合并语义。
- **页面适配冒烟测试**（`tools/page-smoke.mjs`）：用 3 个脱敏 fixture（单选页、多选 + 判断页、成绩页）
  在真实 Chromium 内核里注入脚本，走完识题 / 作答 / 交卷 / 对账链路，共 40 项断言；CI 必跑。
- `tools/browser.mjs`：面板冒烟与页面适配冒烟共用的浏览器探测（`FX_BROWSER` → 常见安装路径 → PATH，支持 Windows）。
- `selftest.mjs` 的静态校验：`@updateURL` / `@downloadURL` 必须是本仓库 `main` 分支的完整 https 直链且两者一致；
  用户脚本体积不超过 512 KB 预算。

### 变更

- AI 结构化直采判据从 `why` 文案前缀（`/^AI 结构化/`）改为显式 `structured: true` 标记；`why` 仅用于展示与日志。
- 答错删除判定改为**文本优先**：有选项文本时按归一化文本判等，只有缺文本的旧条目才按字母判等，
  避免「字母相同、选项内容被手改」时误删相似题。
- 观察器改为 100ms 尾沿节流并优先只观察题目容器，页面隐藏（`document.hidden`）时不再轮询；
  保留原有退避轮询与超时兜底，站点换卷整体替换容器时仍能靠轮询恢复。
- 百度查询词超长时改为「头 40 + 尾 20 字符」，不再从 60 字处直接截断；回显剔除改为先归一空白再做 8 字窗口片段匹配。
- `release.yml`：发版前自检补 `merge-bank` 与两种冒烟；发布后新增更新链校验——拉取远端 `@updateURL` 的
  `// @version` 与 tag 比对（带重试），并核对 latest Release 的 tag。
- 文档：README 增加「非官方、与平台无关、自用风险自负」声明；修正「Release 与自动更新关系」的表述
  （自动更新只看 `main`，tag 触发 Release）；修正 `selftest` 实际校验口径；补页面适配冒烟与体积预算说明；
  CONTRIBUTING 发版流程按当前 CI 门禁更新，并补 SSH over 443 推送与「只升不降」回滚说明。

### 修复

- `confidence: 0` 不再被默认值抬成 0.5（只有 `null / undefined` 才取默认值）；置信度 0 的低把握候选按 0 参与比较。
- 百度回显剔除在 `正确 答案` 拆词、全角空格、空回显等情况下可能残留查询词、污染题干匹配的问题。
- 跨标签页合并时旧副本可把对方刚删掉的题库 / 错题记录写回的问题（持久墓碑消除复活窗口）。
- 文档中若干与实际行为不一致的表述：`selftest`「指向真实存在的文件名」、Release 是否影响自动更新、已知限制里自动关闭的说明。

### 验证方式

- `node --check faxuanyun-legal-exam-assistant.user.js` ✅
- `node tools/selftest.mjs` → **136 项断言全部通过**（内置 136 项 + 元数据 / 文档数字 / 版本徽章 / 体积预算校验）
- `node tools/panel-smoke.mjs --require-browser` → **40 项断言全部通过**（真实 Chromium 内核）
- `node tools/page-smoke.mjs --require-browser` → **40 项断言全部通过**（3 个脱敏 fixture）
- `node tools/check-data.mjs`、`node tools/check-workflows.mjs`、`node tools/merge-bank.mjs data/*.json -o /tmp/merged.json` 全部通过
- `node tools/release.mjs --check-ci v2.0.6` 通过；`node tools/release.mjs --dry-run` 前置检查全过
- 未做真实站点回归：百度反爬页面结构与站点整体改版不在本机验证范围，以 fixture + 打桩 + 纯函数断言覆盖

---

## v2.0.5

**2026-10-19**

> 一轮「把会出错的地方变确定」的加固：答案解析的正确率、成绩对账的准确性、自动答题的运行稳定性，
> 以及 CI / 发版链路的硬门禁。自检断言 97 → 118（面板冒烟保持 40）。

### 新增

- **发版门禁（CI）**：推送 `v*` tag 时先跑 `release.mjs --check-ci`，校验 tag 与脚本 `@version` 完全一致、
  `CHANGELOG.md` 有本版非空章节，不一致直接失败（避免「v2.0.5 的 Release 里挂 2.0.4 的脚本」或空说明发布）。
  发布后回读 Release：断言非草稿、附件 2 个、下载附件 `cmp` 本地文件并复算 SHA256，失败信息注明「Release 已发布，可重跑」。
- **本地发版前置检查**：`tools/release.mjs` 正式发版前硬门禁——工作区干净、`@version` 严格大于最近 tag、
  HEAD 包含 `origin/main`；并打印明确命令 `git push origin main && git push origin vX.Y.Z`（一次只推这一版 tag）。
- **`check-workflows.mjs` 负例自测**：用内存样本断言错误配置会被抓出，且真实仓库必须检出非 0 个 action（防再次假绿）。
- 对账幂等键、作答库键记录、清场复位、解析看门狗、bfcache 恢复处理等逻辑抽成可单测纯函数，全部纳入内置自检。

### 变更

- 交卷后自动关闭被浏览器拒绝时，不再 `history.back()` / `location.replace('about:blank')`，改为日志提示手动关闭
  （旧实现里 `history` 是本场作答记录数组，调用必然抛错；退回上一页还可能落在已交卷的考试页）。
- 页面从往返缓存（bfcache）恢复时复位 `running / parseRunning / 自动关闭计时器 / 同场双页心跳` 并重新探测：
  成绩页自动重新解析（幂等，不重复入库）、考试页提示可继续、其它页提示手动刷新。
- 候选「把握度」语义收紧：两源一致的合并分数封顶 1（旧实现可到 1.09）；两源冲突比较时把百度折减分数除回去再比 gap，
  且 AI 结构化 JSON 把握 ≥ 0.8 时直接采信领先方。

### 修复

- **AI 结构化答案解析 4 个漏判**：`confidence: 0` 被 `Number(...) || 0.9` 当成 0.9 的高把握；单选返回 `"AB"`
  被静默取第一个字母；贪婪正则遇到「示例 JSON + 正式 JSON」整段解析失败；`content` 为空时把整段 `reasoning_content`
  推理文本当成答案。改为大括号配对扫描多候选、`Number.isFinite` + 0≤c≤1 校验、单选/判断多字母丢弃、
  `reasoning_content` 仅在含合法 JSON 时使用。
- **两源冲突永远用不了领先方**：百度折扣后 0.81 对 AI 0.9，gap 只有 0.09，达不到 0.3 阈值，冲突时永远返回空。
- **弱候选绕过多选组合策略**：百度孤立字母折减后把握度只有 0.32，却会压过「全选 / 少一个」的组合枚举；
  现在低于阈值（单选/判断 0.6、多选 0.65）的候选当没有候选，交给排除法 / 组合策略。
- **答错后删不掉库里的错答案**：对账只查规范指纹键与前 50 字旧键，模糊 / 哈希键命中时条目键是 `fpKey(e.q)`，
  导致删不掉且 `bad` 不增长。现在按作答时记录的 `bankKey` 定位，键失效时用 `findEquivalent + prefixSame` 唯一同题兜底
  （双闸，避免误删相似题）；答案一致才删并写墓碑，不一致只记 `bad`。
- **重复对账重复记分**：同一成绩页被二次解析时题库 `ok/hit` 被再次累加；现在用
  `reconcileKey(页面 + 分数 + 总分 + 逐题判定 + 记录数)` 幂等，完全相同只重新展示、不写库。
- **解析成绩锁死**：`parseResult` 无 `try/catch/finally`，任一异常后「解析成绩」静默失效到刷新；
  现在 `finally` 统一释放，另加 15 秒看门狗兜底。
- **「停止」不释放心跳、切题等待卡最长 12 秒**：`fx-stop` 立即 `abortPendingWaits()` + `releaseActiveTab()`，
  主循环在被停止打断后不再点「下一题」。
- **清场残留 / 连考误判**：清场时一并复位 `submittedMark / totalQ / parsedOnce / lastSubmitTs` 等运行态并清掉对账键；
  交卷后在同一页面开新一场时，当前题干不在旧记录里就当作新试卷清场，不再误判「已答满」。

### 移除

- 移除交卷后自动关闭失败时的 `history.back()` / `location.replace('about:blank')` 退路。

### 验证方式

- `node --check faxuanyun-legal-exam-assistant.user.js` ✅
- 仓库根目录：`node tools/selftest.mjs` → **118 项断言全部通过**（含元数据、文档数字、版本徽章校验）
- 仓库根目录：`node tools/panel-smoke.mjs --require-browser` → **40 项断言全部通过**（需要 Chromium 内核；没有浏览器时跳过）
- `node tools/check-data.mjs`、`node tools/check-workflows.mjs`（真实检出 4 个 action，全部 pin）、
  `node tools/merge-bank.mjs data/*.json -o /tmp/merged.json`、`node tools/release.mjs --dry-run` 全绿

---

## v2.0.4

**2026-10-19**

> 一轮「把不可测的流程变成可测的」优化：成绩对账抽成纯函数并补手动兜底、同场双页检测、
> AI Key 仅会话，以及发版 / 维护工具补全。自检断言 83 → 97，面板冒烟 37 → 40。

### 新增：成绩对账的手动兜底与单测

- 面板「题库与本场」新增「手动对账」：答题卡识别不出来时，按提示输入 `1-8=对, 9=错, 10=未答`，
  走同一套对账 / 写库 / 错题清理流程（以前自动解析失败，这一场的对错就白丢了）。
- 对账逻辑从 `reportResult` 抽成纯函数 `planResultActions()`：题号映射、按顺序映射、
  「未标对=答错」兜底、无法对应 / 记录不完整 / 无标记的跳过统计都能被自检直接覆盖（新增 14 项断言）。

### 新增：同场双页检测

- 脚本用 localStorage 心跳标记「本页正在答题」；同一场考试在第二个标签页打开时会提醒只留一个，
  避免两页各答各的、记录分叉。写锁只能保证落盘不互相覆盖，防不了同一时刻两页同时作答。
- 停止答题或关页时自动撤掉心跳（TTL 15 秒，异常退出也会自然过期）。

### 新增：AI Key「仅本次会话」

- 「接口设置」新增勾选项：勾上后 Key 只放内存、不落盘（刷新 / 重开页面需重填），适合共用电脑；
  默认仍是原来的混淆存储。表单保存、回填、测试连接都按该开关走。

### 新增：维护与发版工具

- `tools/check-workflows.mjs`：工作流静态检查（第三方 action 必须 pin commit SHA、声明 `permissions` 与
  `timeout-minutes`、禁止 `pull_request_target` 检出 PR 代码、引用的本地脚本必须存在、发版必须由 tag 触发），已接入 CI。
- `tools/release.mjs`：本地发版助手（校验 `@version` 与 CHANGELOG 章节 → 跑自检 / 数据 / 工作流检查 → 打本地 tag → 打印推送命令）。
- `.github/workflows/auto-merge.yml`：Dependabot 的依赖升级 PR 在自检全绿后自动 squash 合并；普通 PR 仍需人工 review。
- `check-data.mjs` 支持 `--fix`（按实测值改写 README / `data/README.md` 里写错的数字）；
  `merge-bank.mjs` 支持 `--emit-snapshot`（直接生成 `data/` 下成对的 JSON + CSV 快照）。
- Release 说明中自动附上 `.user.js` 的 SHA256。

### 文档

- 更正已知限制：百度通道已做查询词回显过滤与降权；多标签页改为如实的「先后落盘不互相覆盖，同场双开仍会分叉」。
- 真机验证章节补充 v2.0.2 起已确认的链路，并列出仍未完整走一遍的两项。

### 验证方式

- 仓库根目录：`node tools/selftest.mjs` → **97 项断言全部通过**
- 仓库根目录：`node tools/panel-smoke.mjs --require-browser` → **40 项断言全部通过**
- `node tools/check-data.mjs` / `node tools/check-workflows.mjs` / `node tools/merge-bank.mjs ... --emit-snapshot` 全绿

---

## v2.0.3

**2026-10-19**

> 一轮面向「更准、更快、更省心」的维护：答题准确率与成绩解析性能优化、交卷后自动关闭倒计时、
> 多标签页写锁、数据/文档一致性校验、题库合并工具与发版自动化。
> 自检断言 74 → 83，面板冒烟 33 → 37。

### 新增

- **二源交叉验证开关**：面板「答题模式与节奏」新增「二源」按钮，打开后每个答案都会追加第二个来源交叉验证
  （更准但更慢，默认关闭）。题库里同一道题冲突过 2 次以上时，脚本会自动改走「联网复核」，两源一致才采用。
- **自动关闭倒计时与取消**：「题库与本场 → 关闭页」进入倒计时后显示剩余秒数，倒计时期间再点一下即可取消关闭；
  仍可循环切换 8 / 15 / 30 秒或不关。
- **题库合并工具** `tools/merge-bank.mjs`：把多台电脑 / 多份导出的 `.json`、`.csv` 题库合并成一个可直接导入的 `.json`
  （同一题去重、用户手改答案优先、脚本答案冲突保留较新的并累加冲突次数、错题记录取并集；重复合并结果幂等）。
- **数据/文档一致性校验** `tools/check-data.mjs`：校验随仓库分发的题库快照（JSON/CSV 成对、内部自洽、题型分布）
  与 README / data/README 里写死的数字一致，已接入 CI。
- **发版自动化** `.github/workflows/release.yml`：推送 `v*` tag 时自动跑自检与数据校验、创建 Release、
  上传 `.user.js` 与同名 `.sha256`。

### 变更

- 百度通道的把握度统一乘 0.9 后再参与合并（搜索结果页回显容易虚高）；同时剔除「查询词回显」里的答案线索，
  减少把搜索页原句误当答案。
- AI 通道优先解析结构化 JSON 输出（`{"answer":"B","confidence":0.93,"reason":"…"}`，兼容 ```json 代码块与内嵌 JSON），
  解析失败才退回旧文本格式；仍沿用 `reasoning_content` 兜底。

### 优化

- 成绩解析更快：每次重试先用轻量快照（正文 / 分数 / 是否有答题卡）判断，不像成绩页就不再全量扫描；
  判定为成绩页后只做一次完整扫描与图例读取，图例三色齐了就提前停。
- 多标签页写锁：落盘前抢一个 3 秒有效期的短锁，抢不到就稍后重试，避免两个标签页同一瞬间落盘时丢记录。

### 修复

- 导入 / 合并题库时冲突计数（`cft`）的累加更准确；写锁超时自动释放，不会因为另一页崩溃而永远卡住。

### 验证方式

- 仓库根目录：`node tools/selftest.mjs` → **83 项断言全部通过**（含元数据、文档数字与版本徽章校验）
- 仓库根目录：`node tools/panel-smoke.mjs --require-browser` → **37 项断言全部通过**
- `node tools/check-data.mjs` → 快照与文档数字一致
- `node tools/merge-bank.mjs data/*.json -o /tmp/m.json` → 幂等，合并结果 300 题

---

## v2.0.2

**2026-10-19**

> 针对「交卷后成绩页解析不出答题卡 / 退回列表页被误判成成绩页」的兼容修复、交卷后残留记录的自动清理，
> 以及新增「成绩入库后自动关闭本页」。
> 自检断言 73 → 74，面板冒烟保持 33 项。

### 新增：交卷后自动关闭本页

- 成绩解析与入库流程走完后，按设置延时关闭当前考试页（默认 **8 秒**）。
- 面板「题库与本场 → 关闭页」循环切换 8 / 15 / 30 秒或不关，设置保存在油猴存储里。
- 浏览器不允许脚本关闭「用户自己打开的」标签页时，脚本不反复重试，而是退回上一页
  （没有上一页就置为空白页），并在日志里说明。

### 修复：成绩页判定的兼容性

- 答题卡格子的题号文本现在接受 `第12题`、`12题`、`12.`、`12、` 等写法（旧实现只认纯数字，整卡漏识别）。
- 答题卡若在**同源 iframe** 里，脚本会进入 iframe 一起扫描（旧实现只看顶层文档）。
- 结果页正文 / 分数 / 图例的读取同样覆盖同源 iframe，并剔除脚本自身面板的日志文字
  （面板日志里出现「正确答案」等字样时，别再被当成结果页证据）。
- 扫描选择器补充 `label / mark / th / dt / dd` 等常见容器标签。
- **考试列表页不再被当成成绩页**：列表页每门课都显示「考试成绩：100分」，旧实现只看分数就判成绩页，
  交卷退回列表后还会空转十几次解析、最后提示「确认停在结果页」。现在分数必须配合答题卡
  或「正确率 / 答对N题 / 答题结果 / 成绩解析」这类结果页措辞才算数。

### 修复：解析失败时给出可反馈的诊断

- 失败日志会输出：扫描了几个文档 / 多少元素 / 多少数字候选 / 多少可见格子 / 图例颜色键；
  调试模式下还会给出样例元素（标签、类名、背景色、文字色）与页面上的「查看答题卡 / 查看解析」等入口。
- 识别到「查看答题卡 / 查看解析 / 查看试卷 / 查看答卷 / 核对答案 / 查看答案」入口时，
  脚本会挂一次点击监听：用户点开后自动再解析一次（旧实现必须手点面板「解析成绩」）。

### 修复：交卷后的残留会话

- 成绩页一出现就给未交卷会话打「已交卷」标记；下次开新一场时这份残留会被**自动清空**，
  不再弹「若这是新一场请点『清空本场』」，也不会再触发「疑似上一场残留记录」的暂停。
- 成绩页本身仍保留会话：刷新成绩页后还能重新解析对账。
- 恢复记录「已答满」但本次一题没答时：题干对得上就视为同一场（只暂停一次让用户核对）；
  题干对不上就直接判定为上一场残留、自动清空并继续，不再暂停让用户去点「清空本场」。

---

## v2.0.1

**2026-10-17**

> 仓库公开后的第一轮全量核查修复：答案抽取正确性、自动交卷安全边界、成绩对账与导入一致性，
> 以及文档里与实物不符的统计数字。自检断言 63 → 73，面板冒烟保持 33 项。

### 修复：两个可能把答案答错的抽取 bug（已补回归用例）

- **判断题题干回显被误判**：来源文本里出现「下列说法是否正确」时，旧实现命中裸「否」，
  把整道判断题判成「错误」，而且把握度 0.85 高于交叉验证阈值，第二源都不会查。
  现在问句只采信「？」之后的回答；没有回答就不猜，交给交叉验证。
- **英文返回文本被当成字母答案**：旧正则允许任意大小写字母串，`The answer is B` 会取到 `A`、
  `Baidu 搜索结果…` 也会被当成选 `A`。现在只认「片段本身是大写字母且都在选项内」，
  把握度压到 0.75，会触发交叉验证。
- 新增 5 项自检用例覆盖上面两类回归；「我认为C是对的」这类中文夹字母也能取出答案。

### 修复：自动交卷与暂停 / 停止边界

- 自动交卷确认前改用可被「停止」打断的等待：点了停止就不会再替你点确认。
- 确认按钮只在交卷相关弹窗里找，不再误点页面上其它「确定 / 确认」。
- 涉及交卷 / 提交的弹窗**一个按钮都不自动点**（旧实现会先点「取消」，等于替你取消交卷）；
  处理不了就暂停，等你手动确认。
- 节流等待结束后再确认一次运行 / 暂停状态，暂停时不再动页面。

### 修复：总题数推断与收工判定

- 推断不出总题数时不再拿兜底值 10 当真实题数：旧实现可能答了 10 题就「已答满」提前交卷。
- 恢复记录「已答满」不再静默清空本场记录，改为暂停并提示你核对。
- 「已见过下一题」标志每场重置，不再把上一场的状态带进本场。

### 修复：成绩解析与对账

- 解析前先判是否真的在成绩页，不再在考试页空转重试。
- 答题卡颜色判定改为「取最近的图例色」；正确 / 错误 / 未答三色接近时优先判未答，宁可不写。
- 位置对账要求题号确实从 1 连续，不再按顺序硬套。
- 答案冲突计数改用 `saveCorrect` 的返回值，答案归并到别的键时也不会漏计。
- 本次没有新答案写入时，不再显示「题库已更新」。

### 修复：导入与存储一致性

- JSON 导入与 CSV 同口径：答案不一致计「冲突」并提示，不再静默当重复丢弃。
- 编码识别顺序改为 BOM → UTF-8（严格）→ GB18030 → Big5；GBK 由 GB18030 超集覆盖。
- 导入错误提示改用物理行号（以前把序号当行号）；错误明细上限 20 → 200 条。
- 错题记录单独设容量上限（500 条），不会无限增长。
- 修正 CSV 导入函数上方残留的旧文档块（返回字段早已变化）。
- 保存答案时选项文本为空，不再残留旧答案。

### 修复：面板、隔离与无障碍

- `__FX_TEST__` 只暴露纯函数：删除页面可写的 `__FX_TEST_ALLOW_MUTATE__` 闸门，写库函数一律不挂 `window`。
- 「清空本场」加确认；「测试连接」不再把表单静默落盘；导入文件读取失败有错误提示。
- 收起态刷新不再丢面板位置；拖拽只认左键。
- 模式 / 交卷 / 调试按钮补 `aria-pressed`，提示条补 `role="status"` 与 `aria-live="polite"`。
- 10.5px 小字用的弱对比度色 `--fx-text-mute` 改为 `#8794a8`。
- `@connect` 根域推导对 IP 与 `co.uk` 这类多段后缀不再截错。

### 变更：文档与数据统计对齐实物

- 随仓库分发的题库快照实为 **300 题（单选 96 / 多选 54 / 判断 150）**、没有错误记录；
  README / `data/README.md` 里过时的 208 题与 `2.11.0` 说法一并修正。
- README 目录补「更新记录」；不存在的「题库模式」改为如实说明（题库未命中才会联网）。
- 修正脚本头部「答案优先级」「自动更新」等过时说明与重复注释；工作流注释里的断言数同步更新。

### 验证方式

- `node tools/selftest.mjs`：元数据 + 加载探针 + **内置自检 73/73 通过**（自检断言 63 → 73）
- `node tools/panel-smoke.mjs`：真实 Chromium 内核建面板，**33 项断言全部通过**
- GitHub Actions：同上两条命令在 `ubuntu-latest` 上跑通

## v2.0.0

**2026-10-17**

> **迁移提示**：这一版把仓库 slug 与用户脚本文件名统一为 `faxuanyun-legal-exam-assistant`；
> 导出文件前缀改为 `faxuanyun-legal-exam-bank` / `faxuanyun-legal-exam-log`，
> 随仓库分发的题库快照（`data/faxuanyun-legal-exam-bank-20261017.csv` / `.json`）一并改名。
> `@namespace` 的变更属于**破坏性变更**（v1.x 用的是油猴默认值 `http://tampermonkey.net/`）——
> 油猴会把它当成一个新脚本，
> 已安装的老用户需要**重新安装**，并**重新导入题库**。

### 变更：文件与命名把「这个平台叫什么」写对

- 用户脚本改名 `faxuanyun-auto-exam.user.js` → **`faxuanyun-legal-exam-assistant.user.js`**；
  `@namespace` / `@homepageURL` / `@supportURL` / `@downloadURL` / `@updateURL` 统一指向
  `GNAYIEL/faxuanyun-legal-exam-assistant`，占位符 `<你的用户名>/<仓库名>` 全部换成真实仓库地址
- 导出文件前缀：`faxuanyun-answer-bank-*` → `faxuanyun-legal-exam-bank-*`，
  `faxuanyun-exam-log-*` → `faxuanyun-legal-exam-log-*`（面板日志里写明的文件名同步改）
- 随仓库分发的题库快照同步改名为 `data/faxuanyun-legal-exam-bank-20261017.csv` / `.json`（只改名，内容一字未动）
- 备份 JSON 的自述字段 `format` 改为 `faxuanyun-legal-exam-bank`

### 变更：面板 UI 重做

- 顶栏 3 个按钮（开始 / 停止 · 暂停 / 继续 · 收起），标题左侧新增**运行状态灯**
  （绿=答题中、黄=已暂停、灰=已停止），运行状态文字实时显示「答题中 / 已暂停」，
  标题右侧显示当前脚本版本
- **按钮按用途分成 4 类折叠**（答题模式与节奏 / 接口设置 / 题库与本场 / 日志与自检）：
  默认全部收起，点分类标题才展开同类按钮，展开状态记在油猴存储里；
  分类标题支持鼠标点击与键盘 `Enter` / 空格
- 收起时分类标题右侧显示**实时状态摘要**（当前模式与节奏、接口是否已配置、题库题数与已答数、日志行数），
  不展开也能看到关键状态；展开后摘要让位给按钮（按钮自己带状态）
- 配色统一到一套设计令牌（`--fx-*`），按钮高度统一、密度更紧凑，对比度提高；
  样式仍全部关在 Shadow DOM 内，不污染也不受站点页面影响
- 按钮状态更明确：运行中「停止」高亮、没在跑时「暂停」置灰、「交卷」开启时高亮
- **「折叠」与「隐藏」合并为一个「收起」**：原来两个顶栏按钮一个收成窄条、一个收成小圆点，
  作用重叠又各占一格；现在只留**一个收起状态**——收成一条写着自己名字的窄条，按钮随之改口叫「展开」，
  再点一下回完整面板（`Alt+H` 同一个动作）；小圆点那一档连同它的状态、样式、节点一起删掉

### 变更：脚本文本按「平台叫什么」重写

- 脚本头部说明按「使用说明 / 升级须知 / 平台改版怎么办 / 答案优先级 / 面板怎么用 / 文件结构」重新分节，
  并补上 v2.0.0 的破坏性变更与迁移步骤
- 平台称呼统一为**甘肃省国家工作人员学法考试平台**（简称「法宣在线」），不再出现旧简称与旧仓库名
- 检查提示、日志文案、面板标题等用户可见文本统一措辞

### 变更：导入不挑 `format` 取值（向后兼容）

- 导入的载荷解析抽成纯函数 `parseBankPayload()`（解析与写库分离，可被自检单独断言）。
  它只认「有没有 `bank` 容器 / 是不是一张 `{题干: 答案}` 字典」，**不校验 `format` 的具体取值**，
  因此 v1.x 导出的旧文件（`format` 仍是 `faxuanyun-answer-bank`）与 `data/` 里的题库快照都能正常导入；
  真正的结构版本看 `schema`（当前为 `2`）
- 带 `format` 却没有 `bank` 的备份信封判为空库，不会把 `schema` / `version` / `exportedAt` 当成题目导进去

### 变更：仓库按公开标准整理

- `README.md` 整篇重写：特性、安装、**升级到 v2.0.0**（含新旧命名对照表与迁移四步）、使用、
  答案优先级、导入 / 导出、数据与隐私、常见问题、开发与自检、已知限制、目录结构、贡献、许可
- 补 `.gitattributes`（文本文件统一 LF，导出的 CSV 按字节原样保留）与 `data/README.md` 的命名规范；
  `.gitignore` 同时覆盖新旧两套前缀，只显式放行随仓库分发的那一份快照
- 面板与 `README` 不再引用仓库里查不到的编号；版本号仍然只有 `@version` 一个来源

### 修复：面板状态自相矛盾与日志区被挤扁

两个都是照截图与探针实测出来的，不是推测：

- **状态栏和状态灯各说各话**：点「开始」后状态栏显示「答题中」，紧接着点「停止」，
  状态栏**仍停在「答题中」**，而状态灯已灭、按钮已变回「开始」。
  根因是状态文案由两处分别硬编码（`updateStatus('已停止')` 与 `syncRunBtns()` 里的一句），
  收尾路径又正好把停下来的那次写入盖掉。现在统一由 `runStatusLabel(isRunning, isPaused)`
  一个纯函数产出（运行中「答题中」、暂停「⏸️ 已暂停」、其余「已停止」），
  并加了一条自检断言把它钉住
- **四个分类全部展开时日志区被挤成十几像素**：面板顶到 `calc(100vh - 24px)` 后，
  日志区作为弹性项被压到 **16px**（实测），基本看不见。
  给日志区补 `min-height: 120px` 下限，超出部分交给内容区自己出滚动条；
  同一视口下复测，日志区稳定在 120px
- **窄条上看不到面板名字**：折叠标题元素自带内联 `display:none`，样式表里的 `.collapsed` 规则盖不过它，
  于是收成窄条后只剩一个按钮、认不出这是谁；改成不带内联样式、由 CSS 按状态显示，
  窄条上稳稳写着「法宣在线助手」

### 验证方式

- `node tools/selftest.mjs`：元数据 + 加载探针 + **内置自检 63/63 通过**（自检断言 55 → 63，
  新增 6 项覆盖导入载荷解析：新旧 `format` 取值、一页题干字典、数组形态、缺 `bank` 的信封、坏数据；
  另 1 项锁定状态栏文案与状态灯同源、1 项锁定「收起 / 展开」两档文案）
- `node tools/panel-smoke.mjs`：真实 Chromium 内核建面板，**33 项断言全部通过**
  （含 4 个分类顺序与无障碍属性、四类摘要文案、导出文件名、Alt+D 后摘要同步、
  「收起」一个按钮来回、完整态面板名只出现一次、窄条上写着自己的名字且真的窄，
  面板里不再有 `fx-hide` / `fx-mini-dot`）
- `tools/` 两个脚本的默认用户脚本路径与文件名断言随改名同步更新，CI 不会再因为改名而红
