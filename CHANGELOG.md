# 更新日志

本文件记录**甘肃省国家工作人员学法考试平台自动答题助手**的所有版本变更。
版本号以脚本头部的 `@version` 为准；面板标题栏会显示当前版本。

> **关于版本号**：仓库首次公开的版本是 `v2.0.0`（2026-10-17）。
> 更早的 2.x 内部迭代没有随仓库公开，其记录不再维护；
> 随仓库分发的题库快照 JSON 里的 `"version"` 是导出时的脚本版本号，只作溯源用（当前快照为 `3.0.0`）。
> 旧版本「验证方式」里的 `tools/selftest.mjs`、`tools/page-smoke.mjs` 等命令是当时目录结构的
> 历史记录；测试脚本现已迁入 `tests/`，现行命令见 [开发文档](docs/DEVELOPMENT.md)。
> 各版本「验证方式」里的题库题数反映该版本发布时的快照；当前随仓库分发的快照数字见 [data/README.md](data/README.md)。

变更分四类：**新增**（新能力）、**变更**（行为或文案改了）、**修复**（原来不对的）、**移除**。
每个版本末尾的「验证方式」写的是**当次真实跑出来**的结果；可复现的命令见
[开发文档的统一门禁](docs/DEVELOPMENT.md#统一门禁)。

---

## 未发布

### 变更

- **题库快照更新**：随仓库分发的快照从 2026-10-20 的 299 题（单选 90 / 多选 59 / 判断 150）更换为 2026-10-27 的 319 题（单选 96 / 多选 63 / 判断 160）。导出时带有 1 条错题记录，按仓库快照规则已从 JSON/CSV 中移除；两份文件仍逐行对应。

- **README 社交预览重新生成**：两张 1280×640 海报改为 HTML/CSS 排版、Chrome 截图，右侧嵌入由脚本 `PANEL_CSS` 与固定演示状态重新渲染的面板；面板图和海报都不再在旧 WebP 上重复覆盖版本号。修复旧图在 `2.0.22 → 3.0.0` 变短时留下的色块/残影，以及 `193` 与原海报字体不一致的问题。
- **图片管线说明**：`npm run docs:images` 现在需要 Chrome/Chromium（可用 `CHROME` 指定）；`docs/IMAGE_PIPELINE.md` 已同步依赖与布局入口；面板图也从 ffmpeg 覆盖改为 Chrome 干净渲染。
- **文档校准**：补充 `@2` 别名的元数据/文件双层缓存诊断，以及社交预览当前已在 GitHub 配置的说明。
- **社交预览流程补充**：发版检查清单增加 GitHub Settings → Social preview 重传步骤，明确 OG 不会随 README 自动更新；仓库设置文档的核验日期更新到 2026-10-27。
- **文档一致性**：架构文档的 `npm run ci` 门禁步数由「九步」更正为「八步」；发版清单的配图检查补充「题库数字」；README 补充 `@2` 缓存已恢复的说明。
- **仓库 Topics 补全**：仓库 Topics 从 8 个扩到 14 个（补 `legal-exam`、`javascript`、`greasemonkey`、`ai`、`baidu`、`chinese`），便于按考试/脚本/中文场景检索。
- **发版 workflow 权限拆分**：`release.yml` 拆成只读 `verify` job（tag/版本/CHANGELOG 校验 + `npm run ci`）与最小写权限 `release` job（校验和、构建来源证明、Release 上传、回读与更新链）；release job 不再安装 Node，checkout 改为浅克隆。
- **外链检查**：新增 `tools/check-external-links.mjs` 与 `npm run check:external`，扫描文档外链并分级报告 403/429 与硬失败；默认不进门禁，发版前可用 `--strict` 人工复核。
- **配置与文档小修**：开发目录树补上 `check-external-links.mjs` 与 `check:external`；Dependabot 标签改用仓库实际存在的 `github_actions`；CONTRIBUTING 的功能建议入口与 Feature request 模板统一。
- **快照维护门禁**：`tools/check-data.mjs` 现在要求 `data/` 恰好一对 JSON+CSV，孤立 CSV 或旧 JSON 都会失败；`tools/generate-docs-images.mjs` 从最新快照自动读取题数、手改数与体积，替换题库后跑 `npm run docs:images` 即可，不再手改配图数字；`tests/merge-smoke.mjs` 的合成夹具同步到 3.0.0 / 2026-10-27。

## v3.0.0

**2026-10-21**

### 修复

- **无表头 CSV 首行不再被误判为表头**：`isHeaderRow()` 要求至少两个列名命中，且题目列必须是
  「题目 / 题干 / 问题 / question」等表头标签；首行是「1,这道题目的答案是B,B,公安机关」这类数据行时不再被吞。
- **百度跟进页被 @connect 拦截时给出提示**：跟进页读取失败不再只写调试日志，每题首次失败会在面板提示
  「仅使用搜索摘要作答」，并在原因里区分网络错误与白名单拦截，避免用户误以为百度没搜到。
- **面板「强制二源」开关真正生效**：作答策略改用 `CONFIG.forceCrossCheck` 参与 `dualSourcePlan()` 与
  `needSecond` 判定，勾选后即使单选也会并行查询 AI + 百度，而不是只在多选时交叉验证。

### 变更

- **测试与工具分层**：`selftest` / `panel-smoke` / `page-smoke` / `merge-smoke` / `_harness` / `browser`
  迁入 `tests/`，`tests/fixtures/` 不动；`tools/` 只保留检查、发布与题库工具。`package.json` 的
  `test` / `check` / `smoke` / `ci` / `merge-smoke` 路径同步，新增 `npm test` 作为快速入口。
- **文档体系拆分**：新增 `docs/ARCHITECTURE.md`、`docs/DEVELOPMENT.md`、`docs/RELEASING.md`、
  `docs/REPOSITORY_SETTINGS.md`、`docs/README.md` 与根 `SUPPORT.md`；README 增加文档入口，
  CONTRIBUTING 只保留贡献流程与代码约定，开发/发版细节移入 docs。
- **文档链接门禁**：新增 `tools/check-docs.mjs`，检查相对链接、Markdown 标题锚点与 HTML 本地
  `src` / `href`；接入 `npm run check` 与统一门禁。
- **仓库元数据**：`package.json` 补齐 `author` / `repository` / `homepage` / `bugs` / `keywords`；
  新增 `.github/CODEOWNERS`（`* @Gnayiel`）；测试目录说明并入 `docs/DEVELOPMENT.md`。
- **社区模板补全**：新增 `.github/ISSUE_TEMPLATE/feature_request.yml`，`config.yml` 把功能建议、
  使用问题与安全报告分流到不同入口；README / CONTRIBUTING / SUPPORT / 仓库设置文档同步。
- **仓库状态文档校准**：明确 `protect-main` 当前未启用 required checks、main 仍可直接 push；
  required check 名改为实际的 `selftest (22)` / `selftest (24)`；CodeQL default setup 已启用，
  不再建议另加 `codeql.yml`；补充 immutable releases 下不能 `--clobber` 重跑、只能发新 patch 的说明；
  innerHTML 约定改为「静态骨架可用，动态数据一律 textContent」。
- **CI 双车道**：Node 22 跑完整 8 步（含浏览器冒烟），Node 24 跑快速 6 步，check-run 名称保持
  `selftest (22)` / `selftest (24)`，避免重复启动两次 Chromium。
- **自动更新主版本守卫**：`tests/selftest.mjs` 与 `tools/release.mjs --check-ci` 都检查 `@updateURL`
  的 `@N` 与 `@version` 主版本一致；升级桥必须带显式 `// fx-bridge-to N` 且版本主版本更小。
  `release.yml` 的镜像提示从实际 URL 提取别名，不再写死 `@2`。
- **归档与设置文档校准**：移除 `docs/CHANGELOG-archive.md` 指向自身的链接；仓库设置文档把
  Description / Website / Topics 的当前值与建议值分开，避免把建议写成已配置。
- **发布工具与自动合并**：`release.mjs` 的推送提示改为 `git push origin HEAD:main`，从任意提交发版
  都推当前 HEAD，升级桥不会误推本地 main；Dependabot 自动合并改为等待 PR 的全部 checks，不再依赖
  required checks。
- **移除一次性回填工具**：历史 Release 回填已完成，删除 `tools/backfill-release-notes.mjs` 及其
  CI 自测；统一门禁由 9 步精简为 8 步，`--no-browser` 跳过后两步。

### 测试

- **AI 通道页面冒烟**：新增两个真实浏览器用例——纯 JSON / JSON 代码块两种响应；解释文字包裹 JSON、
  AI 失败降级百度、强制二源。页面断言 105→135（共 11 个用例）。
- **导入链路端到端**：`tests/panel-smoke.mjs` 拦截文件选择框，从面板按钮依次导入 JSON 与 CSV，
  断言落到 `questionBank`；等待改为轮询（最长 5 秒），不再依赖固定 1600ms；面板断言 40→42。
- **CSV 表头回归**：内置自检新增 3 条（正常六列表头、两列「题目 / 答案」、无表头首行题干含「答案」不被吞），
  内置断言 190→193。
- **文档配图生成**：新增 `tools/generate-docs-images.mjs` 与 `docs/IMAGE_PIPELINE.md`，发版时用 Chrome
  按脚本 CSS / HTML 重新渲染三张 README 图，ffmpeg 只转 WebP，不再手工改图或覆盖旧图。

### 验证方式

- `npm run ci` 8 步全过：selftest 193/193、check-data 299 题、merge-smoke 17/17、panel 42/42（**42 项断言全部通过**）、page 135/135（**135 项断言全部通过**）。
- `node tests/page-smoke.mjs --require-browser` 单独复跑：135/135（11 个用例）。

## v2.0.22

**2026-10-21**

### 变更

- **自动更新升级桥**：在 v2.0.21 基础上合入 3 项未发布修复（CSV 表头、百度跟进提示、强制二源），并把
  `@downloadURL` / `@updateURL` 从 `@2` 切到 `@3`，在头部加 `// fx-bridge-to 3`。已装 2.x 的用户先升到本版，
  再由本版自动升到 3.x；`tests/selftest.mjs` 与 `node tools/release.mjs --check-ci` 都识别这个唯一例外，
  普通版本的主版本错位会直接失败。

### 验证方式

- `npm run ci` 9 步全过：selftest 193/193、check-data 299 题、merge-smoke 17/17、panel 42/42（**42 项断言全部通过**）、page 135/135（**135 项断言全部通过**）。
- `node tools/release.mjs --check-ci v2.0.22` 通过。

## v2.0.21

### 修复

- **按钮缓存不再被倒计时刷新作废**：`findButton()` 的 `MutationObserver` 只对按钮本身的增删/文字变化递增 DOM 版本号；
  考试页剩余时间每秒更新的普通文本不再触发整表重建。

### 验证方式

- `npm run ci` 8 步全过：selftest 190/190、check-data 299 题、merge-smoke 17/17、panel 40/40、**103 项断言全部通过**。
- `node tools/release.mjs --check-ci v2.0.21` 通过。

## v2.0.20

### 修复

- **保存答案后保持索引有效**：`saveCorrect()` / `saveUserAnswer()` / `upgradeKey()` 改用 `bankIndexAdd()` 增量更新 12 字前缀索引，不再每次 `bankVer++` 让索引整表失效；自动答题连续作答时不会每题重建索引。
- **文档**：CONTRIBUTING 的 fixture 说明由 6 个更正为 8 个。

### 验证方式

- `npm run ci` 8 步全过：selftest 190/190、check-data 299 题、merge-smoke 17/17、panel 40/40、**103 项断言全部通过**，check-syntax / check-workflows / 回填脚本自测正常。
- `node tools/release.mjs --check-ci v2.0.20` 通过。

## v2.0.19

### 变更

- **题库导入的等价题查找**：`findEquivalent()` 不再逐条扫描整个题库，改用既有的 12 字前缀索引先缩小候选，
  再按原来的「前缀等价 + 唯一命中」规则判定；导入长题库时由 O(n²) 降为接近 O(n)。
- **按钮定位缓存**：`findButton()` 用 `MutationObserver` 维护 DOM 版本号，同一版 DOM 下只做一次全页候选收集；
  每次查找仍对候选重新判断可见性与 disabled，按钮位置/显隐变化不受缓存影响。
- **成绩页答题卡解析**：`collectResult()` 先定位 `.answer-card` / `[class*="answerCard"]` / `[id*="答题卡"]`
  等答题卡容器，只扫容器内的题号格子；匹配不到时自动回退全页扫描，平台改版不影响识别。

### 修复

- **多标签页落盘互斥**：支持 Web Locks 的浏览器改用 `navigator.locks` 把「读盘 → 合并 → 写盘」串行化，
  不再只依赖带 3 秒过期的软锁；不支持 Web Locks 时仍退回软锁。页面关闭/切后台改用同步落盘路径，
  避免 `beforeunload` 阶段来不及 `await`。
- **Web Locks 超时兜底**：锁在 1.2 秒内未授予时退回软锁补写一次，避免无头环境或极端排队时
  「已提示更新题库但实际没落盘」；软锁仍负责挡住同时写。

### 测试

- `tools/page-smoke.mjs` 增加两个真实浏览器用例：
  - 跨页持久化：第一页手动作答写入题库，第二页全新页面精确命中且零联网；
  - 停止/重开竞态：查询中停止后立即开始，旧循环不再点击或写入第二条记录。
  页面断言 88→103，fixture 6→8。

### 验证方式

- `npm run ci` 8 步全过：selftest 190/190、check-data 299 题、merge-smoke 17/17、panel 40/40、**103 项断言全部通过**，check-syntax / check-workflows / 回填脚本自测正常。

---

## v2.0.18

**2026-10-21**

> 修复 v2.0.17 的导入回归：`A,B` / `A、B` 这类字母答案在一条链路上被拆开，在另一条链路上仍被当成选项内容；
> 同时把收起态丢失的「开始 / 停止」入口补回来。

### 修复

- **字母答案导入回归**：`splitAns()` 已支持逗号 / 顿号 / 斜杠，但 `resolveType()`、`validateRow()`、
  CSV/JSON 导入和 `extractAnswer()` 仍只认纯字母，导致 `l` 为空、题型可能判错。现在统一走
  `isLetterAnswer()` / `lettersOf()`，纯字母解析也兼容 `A,B`。
- **收起态没有停止入口**：面板窄条顶栏恢复「开始 / 停止」按钮（暂停仍隐藏），窄条上也能直接停。

### 验证方式

- `npm run ci` 8 步全过：selftest 190/190、check-data 299 题、merge-smoke 17/17、panel 40/40、page 88/88。
- `node tools/release.mjs --check-ci v2.0.18` 通过。

## v2.0.17

**2026-10-21**

> 更新链与运行期收口：自动更新从 `@latest` 切到 `@2` 主版本别名；停止后立刻开始不再跑双循环；
> 导入答案支持逗号 / 顿号 / 斜杠分隔的字母串；回填脚本纳入统一门禁。

### 新增

- 新增 `tools/backfill-release-notes.mjs` 与手动触发的 `.github/workflows/backfill-release-notes.yml`：
  分页把旧 Release 说明里的 `raw/main` 安装链替换为 tag 级 jsDelivr 链接，支持 `--dry-run` / `--self-test`
  （旧 Release 全部回填完成后，该一次性 workflow 已在 v2.0.18 后移除；离线脚本保留并继续在 CI 自测）。

### 变更

- `@downloadURL` / `@updateURL` 从 jsDelivr `@latest` 改为 `@2`：`@latest` 别名边缘缓存实测最长 7 天
  （2026-10-21 发布 v2.0.16 约 9 小时后，三边缘仍全部返回 2.0.14）；`@2` 在三个边缘立即解析到 2.0.16。
  `@2` 仍受 CDN 缓存影响，但不会继承 `@latest` 已缓存的旧版本；固定版本仍用 `@vX.Y.Z`。
- `tools/ci.mjs` 新增 `backfill-release-notes.mjs --self-test`，统一门禁由 7 步变 8 步。

### 修复

- **停止后立刻开始可能双循环**：`mainLoop()` 增加运行代际 `runSeq` 与 `AbortController`；停止时 `cancelRun()`
  同时失效旧循环、中止在途的百度 / AI 请求，旧循环醒来后直接退出，不再与新一场抢答同一页面。
- **停止不能中止联网请求**：`queryAnswer` / `queryBaidu` / `queryAI` 把运行 signal 透传到 `request()`；
  停止后不再等满 20 秒查询预算，也不会把旧请求的答案点到新一场。
- **导入字母答案分隔符**：`splitAns()` 对「A,B」「A、B」「A/B」这类纯字母串按常见分隔符拆分；
  含中文 / 长文本的答案仍只按分号拆，避免把选项内容里的逗号切坏。

### 验证方式

- `npm run ci` 8 步全过：selftest 190/190、check-data 299 题、merge-smoke 17/17、panel 40/40、page 88/88，
  另含 `backfill-release-notes --self-test`。
- `node tools/release.mjs --check-ci v2.0.17` 通过。
- 三边缘实测：发布前 `@2` 均返回 2.0.16；发布后若 CDN 仍缓存旧版，用 `@v2.0.17` 固定链接验证。

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

> **后续更正（v2.0.17）**：`@latest` 别名的 `cache-control` 为 `max-age=604800, s-maxage=43200`（浏览器 7 天 / 边缘 12 小时）；
> v2.0.16 发布约 9 小时后三个边缘仍全部返回 2.0.14，因此 v2.0.17 改用 `@2` 主版本别名。本节保留当时的记录。

---
