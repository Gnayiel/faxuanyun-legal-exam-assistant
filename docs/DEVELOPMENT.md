# 开发指南

> 面向要改脚本、跑测试、定位失败的维护者。第一次使用请先看 [README.md](../README.md)；准备提 PR 前请读 [CONTRIBUTING.md](../CONTRIBUTING.md)。完整文档入口见 [docs/README.md](README.md)。

## 环境要求

| 依赖 | 要求 | 用途 |
| --- | --- | --- |
| Node.js | ≥ 22（`.nvmrc` 为 `22`；CI 矩阵跑 22 与 24） | 运行全部测试与工具 |
| Chromium 系浏览器 | Edge / Chrome / Chromium 任一 | `panel-smoke`、`page-smoke` 两个浏览器冒烟 |
| git | 任意近版 | 提交、打 tag、发版 |
| ffmpeg + Chrome + 中文字体 | 仅重绘文档图时需要 | `npm run docs:images` |

补充说明：

- 仓库**没有 npm 依赖**（`dependencies` / `devDependencies` 都为空）。不要为了“顺手”安装第三方包：测试与工具只用 Node 内置模块（`node:fs`、`node:child_process`、`node:vm` 等）。
- **没有构建步骤**：`faxuanyun-legal-exam-assistant.user.js` 既是源码也是发布物。改完保存、刷新页面即可，不存在 `dist/` 或打包产物。
- 浏览器不在常见安装路径时，用 `FX_BROWSER` 指定可执行文件或 PATH 里的命令名（如 `google-chrome`），见[测试分层](#测试分层)。

## 仓库结构

```text
.
├── faxuanyun-legal-exam-assistant.user.js   # 唯一运行时代码（单文件，无构建）
├── package.json                             # 命令入口（test / check / check:external / ci / smoke / release / docs:images）
├── tests/                                   # 可执行测试与夹具
│   ├── selftest.mjs                         # vm 内置自检 + 文档数字校验
│   ├── merge-smoke.mjs                      # 题库合并冒烟
│   ├── panel-smoke.mjs                      # 面板冒烟（真实浏览器）
│   ├── page-smoke.mjs                       # 页面适配冒烟（真实浏览器）
│   ├── _harness.mjs                         # 两个冒烟共用的 GM_* / 百度 / AI 打桩
│   ├── browser.mjs                          # 浏览器探测与 headless 启动
│   └── fixtures/                            # 8 份脱敏 HTML 页面
├── tools/                                   # 开发、检查、发布工具
│   ├── ci.mjs                               # 8 步统一门禁清单
│   ├── check-syntax.mjs                     # 语法检查
│   ├── check-docs.mjs                       # 文档相对链接与锚点检查
│   ├── check-data.mjs                       # 题库快照 / 文档数字一致性
│   ├── check-workflows.mjs                  # GitHub Actions 静态检查
│   ├── check-external-links.mjs              # 文档外链可达性检查
│   ├── merge-bank.mjs                       # 题库合并实现
│   ├── release.mjs                          # 本地发版助手
│   └── generate-docs-images.mjs             # 重绘 README 配图
├── data/                                    # 随仓库分发的 319 题快照（6 列）与说明
├── docs/                                    # 架构、开发、发版、仓库设置、配图说明
├── .github/workflows/                       # selftest.yml、release.yml、auto-merge.yml
├── README.md / CONTRIBUTING.md / SUPPORT.md / SECURITY.md / CHANGELOG.md
└── ...
```

职责边界：

- `tests/` 放**可执行测试**、共用打桩和夹具。测试只依赖 Node 内置模块与同目录的 `_harness.mjs` / `browser.mjs`，统一从仓库根运行；脚本用 `import.meta.url` 定位仓库，换工作目录不影响结果。
- `tools/` 放**检查器、门禁和发布辅助**。`check-*.mjs` 只读、不联网；`merge-bank.mjs` 是合并算法本体，`merge-smoke.mjs` 只调用它；`release.mjs` 只打本地 tag，不 push。
- `fixtures/` 是脱敏页面，不含真实账号、考试名称或个人信息。新增夹具时保持这一约束，见[加断言 / 加 fixture / 加 AI 用例](#加断言--加-fixture--加-ai-用例)。
- `data/` 随仓库只保留一份题库快照，命名与字段规则见 [data/README.md](../data/README.md)。
- 测试文件与门禁的细节见下文[测试分层](#测试分层)与[统一门禁](#统一门禁)。

## 第一次跑起来

1. 克隆仓库并确认 Node 版本：

   ```bash
   git clone https://github.com/Gnayiel/faxuanyun-legal-exam-assistant.git
   cd faxuanyun-legal-exam-assistant
   node -v          # 需要 ≥ 22
   npm test         # 不需要先 npm install
   ```

2. 在油猴里安装**本地**脚本：打开 Tampermonkey 管理面板 →「添加新脚本」，用仓库里的 `faxuanyun-legal-exam-assistant.user.js` 全文替换并保存；也可以把该文件拖进浏览器，按提示安装。开发时不要装 jsDelivr 的发布版（`@2` / `@3`），否则你改的本地文件不会生效。
3. 打开/刷新法宣在线的考试页或成绩页。脚本按 `document-idle` 注入，面板出现后展开即可看到日志与按钮。
4. 改完 `user.js` 后保存并刷新页面即可验证；无需构建、无需重启浏览器。油猴加载的始终是保存后的那份文件。
5. 提 PR 前跑一遍 `npm run ci`（或至少 `npm test` + `npm run check`），确认数字与链接没有漂移。

## 常用命令

所有命令都在**仓库根目录**执行。命令与测试数写在 `package.json` 与 `tools/ci.mjs` 里，两边保持一致。

| 命令 | 做什么 | 需要浏览器 |
| --- | --- | --- |
| `npm test` | `tests/selftest.mjs` + `tests/merge-smoke.mjs`：内置 193 项断言、17 项合并检查 | 否 |
| `npm run check` | 语法、文档链接、内置自检、数据一致性、工作流、题库合并共 6 步 | 否 |
| `npm run check:external` | 扫描文档中的 http(s) 外链并检查可达性；默认只报告，`-- --strict` 时有硬失败才退出 1 | 否（需网络） |
| `npm run ci` | `node tools/ci.mjs`：与 CI 完全相同的 8 步统一门禁 | 是 |
| `npm run smoke` | 只跑两个浏览器冒烟（自动带 `--require-browser`） | 是 |
| `npm run release` | 本地发版助手：前置检查 → 统一门禁 → 打本地 tag（不 push） | 默认要（内部跑 `npm run ci`） |
| `npm run docs:images` | 重绘 `docs/` 下三张 README 用图 | 否（要 ffmpeg / Chrome / 中文字体） |
| `npm run merge-smoke` | 只跑题库合并冒烟 | 否 |

单独运行某一项（排查失败时最常用）：

```bash
node tests/selftest.mjs                       # 元数据 + 内置自检（193 项断言）+ 文档数字
node tests/merge-smoke.mjs                    # 17 项合并检查（冲突 / 幂等 / 公式消毒）
node tests/panel-smoke.mjs --require-browser  # 42 项断言（真实 Chromium）
node tests/page-smoke.mjs --require-browser   # 135 项断言（11 个用例，8 份 fixture）
node tools/check-docs.mjs                     # 文档相对链接与锚点
node tools/check-data.mjs                     # 题库快照与 README / data/README 数字
node tools/check-workflows.mjs                # GitHub Actions 配置
node tools/check-external-links.mjs           # 外链可达性（需要网络；默认只报告）
node tools/ci.mjs --no-browser                # 无浏览器环境跑门禁的前 6 步
```

`npm test` 与 `npm run check` 不要求浏览器；`npm run ci` 默认要求浏览器，装了浏览器但不在默认路径时先设置 `FX_BROWSER`。

## 统一门禁

`npm run ci` 就是 `node tools/ci.mjs`，本地、`selftest.yml` 与 `release.yml` 的 `verify` job 共用这一份清单；任何一步非零退出即整体失败，不吞异常。共 8 步，顺序固定：

| # | 展示名 | 实际命令 | 检查什么 | 失败先看 |
| --- | --- | --- | --- | --- |
| 1 | 语法检查 | `node tools/check-syntax.mjs` | 用户脚本、`tools/*.mjs`、`tests/*.mjs` 的 `node --check`，以及 `package.json` 是否为合法 JSON | 报错里的“文件:行号” |
| 2 | 文档链接与锚点 | `node tools/check-docs.mjs` | README、CONTRIBUTING、SUPPORT、SECURITY、CODE_OF_CONDUCT、CHANGELOG、`docs/*.md`、`data/README.md` 的相对链接、图片和 `#锚点` | `文件:行号 → 链接 (原因)` |
| 3 | 内置自检 + 文档数字 | `node tests/selftest.mjs` | 元数据、vm 加载、内置的 193 项断言，以及 README 徽章 / CHANGELOG / 脚本注解 / 本文档里的数字 | 最后一段“缺「…」”的逐条提示 |
| 4 | 数据 / 文档一致性 | `node tools/check-data.mjs` | 快照 JSON/CSV 成对、内部自洽、CSV 对应，README 与 data/README 的 319 题（单选 96 / 多选 63 / 判断 160） | 具体哪份文档的哪个数字 |
| 5 | 工作流静态检查 | `node tools/check-workflows.mjs` | `runs-on` / `permissions` / `timeout-minutes`、action pin SHA 与版本注释、本地脚本存在性、禁止 `pull_request_target` + 检出 PR 代码、发版必须 tag 触发 | 对应 workflow 与规则名 |
| 6 | 题库合并冒烟（冲突 / 幂等 / 公式消毒） | `node tests/merge-smoke.mjs` | 冲突取新、用户答案优先、错题并集、幂等、CSV 公式注入消毒，共 17 项合并检查 | 第几个 `[1/3]`～`[3/3]` 子段 |
| 7 | 面板冒烟（需要真实浏览器） | `node tests/panel-smoke.mjs --require-browser` | 真实 Chromium 里建面板、按钮齐全、导出文件名与 JSON/CSV 导入落库，42 项断言 | 面板用例名与 DOM dump |
| 8 | 页面适配冒烟（需要真实浏览器） | `node tests/page-smoke.mjs --require-browser` | 8 份 fixture / 11 个用例上的识题、作答、交卷、对账，135 项断言 | `FX_PAGE_SMOKE_DUMP=1` 的落盘页面 |

定位方法：

- 输出里的 `[i/8] 名称` 与 `$ node ...` 就是失败步骤和原命令，直接单独重跑该命令即可。
- 没有浏览器时用 `node tools/ci.mjs --no-browser` 跳过第 7、8 步（共 6 步）；这只用于本机自检，CI 不会跳过。
- 改完重跑整条门禁，不要只重跑单步就认为通过：后面的步骤可能依赖前面的结果。

## 测试分层

### 测试文件与职责

| 文件 | 作用 | 需要浏览器 |
| --- | --- | --- |
| `tests/selftest.mjs` | 加载用户脚本，校验元数据，跑内置 193 项断言与文档数字 | 否 |
| `tests/merge-smoke.mjs` | 题库合并冒烟：冲突、用户答案优先、错题并集、幂等、CSV 公式消毒（17 项） | 否 |
| `tests/panel-smoke.mjs` | 真实 Chromium 里建面板，检查按钮、导出文件名与 JSON/CSV 导入落库（42 项） | 是 |
| `tests/page-smoke.mjs` | 在 `fixtures/` 的脱敏考试页/成绩页上跑站点适配与作答断言（135 项，11 个用例） | 是 |
| `tests/_harness.mjs` | 两个浏览器冒烟共用的页面内打桩：GM 存储、断网、下载、百度、AI | — |
| `tests/browser.mjs` | 浏览器探测与 headless 启动，两个冒烟共用 | — |
| `tests/fixtures/` | 脱敏 HTML 页面，不含真实账号、考试名称或个人信息 | — |

### vm 自检（tests/selftest.mjs）

在 Node 的 `vm` 沙箱里用最小 DOM / `GM_*` 打桩加载用户脚本，不启动浏览器、不联网、不写盘。分四段输出：`[1/4]` 元数据与体积、`[2/4]` 顶层加载与 `__FX_TEST__` 钩子、`[3/4]` 跑内置的 193 项断言、`[4/4]` 校验文档数字。脚本的纯函数通过 `window.__FX_TEST__` 暴露，测试不依赖真实页面结构。

### 题库合并冒烟（tests/merge-smoke.mjs）

在系统临时目录里构造两份题库，连续调用 `tools/merge-bank.mjs`，验证冲突取新、用户答案优先、错题并集、幂等（两次合并除 `exportedAt` 外一致）、CSV 公式注入消毒、输入文件只读等 17 项合并检查。不需要浏览器。

### 面板冒烟（42 项）

用 headless Chromium 打开只包含用户脚本与打桩的最小页面，等面板建好后检查宿主、Shadow DOM、顶栏按钮、折叠、导出文件名等。控件清单直接从用户脚本模板里提取 `id`，少一个按钮或改 `id` 会自动失败。没有浏览器时默认跳过；加 `--require-browser` 则改为失败（退出码 2）。

### 页面适配冒烟（135 项）

把 `tests/fixtures/*.html` 当作脱敏站点页面，依次注入 `GM_*` 打桩、用户脚本和断言驱动脚本，再用 headless Chromium 跑真实流程，覆盖 11 个用例：单选题页、AI 纯 JSON / 代码块、AI 解释文字 + 失败降级 + 强制二源、本地题库精确命中、跨页持久化、停止后立即重开、多选 / 判断、成绩页、判断题页、答题卡页、无总分成绩页。断言总数写在 `EXPECTED_ASSERTIONS`，每个用例另有 `expectCount`，父进程会核对运行时总数与声明值一致。

### 文档链接检查（tools/check-docs.mjs）

静态扫描仓库内 Markdown 的相对文件链接、图片和 `#锚点`，跳过 `http(s)://`、`mailto:`、`data:`、协议相对地址与代码块；锚点按 GitHub slug 规则换算（中文保留、空格转 `-`、重复标题加 `-1`）。失败时输出 `文件:行号 → 链接 (原因)` 并以 1 退出。

### 浏览器开关

| 开关 | 行为 |
| --- | --- |
| 默认 | 找不到 Edge / Chrome 时打印提示并跳过，退出码 0 |
| `--require-browser` 或 `FX_REQUIRE_BROWSER=1` | 找不到浏览器时失败，退出码 2；CI 用它避免“没装浏览器 → 静默跳过 → 假绿” |
| `FX_BROWSER` | 指定浏览器可执行文件（绝对路径）或 PATH 里的命令名；优先级最高 |

浏览器探测顺序固定为：`FX_BROWSER` → 常见安装路径（Windows Edge / Chrome、Linux `/usr/bin`、macOS `.app`）→ 遍历 PATH。两个冒烟共用 `tests/browser.mjs`，不要各写一份。

## 加断言 / 加 fixture / 加 AI 用例

### 加一条内置断言

1. 在用户脚本里把逻辑写成纯函数，并挂到 `__FX_TEST__`（参考 `selfTestCases` 现有写法）。
2. 在 `selfTestCases` 里补一条断言，运行 `npm test`；`selftest` 会打印新的总数。
3. 同步所有写死数字的位置（见下表），再跑一次 `npm test`，直到 `[4/4]` 全部通过。
4. 如果新增的是页面行为，优先加到 `page-smoke` 的用例，而不是塞进 vm 自检。

### 加一份 fixture / 页面用例

1. 在 `tests/fixtures/` 新增脱敏 HTML：不含真实账号、考试名称、单位或个人信息；结构尽量贴近真实页面。
2. 在 `tests/page-smoke.mjs` 的 `CASES` 里加一项：`name`、`fixture`、`case`、`expectCount`，以及该用例需要的 `answers` / `store` / `aiResponses` 等配置。
3. 更新 `EXPECTED_ASSERTIONS` 与各用例 `expectCount` 之和；`selftest` 会核对两者一致。
4. 同步 README 的 `page--smoke` 徽章、CHANGELOG 当前版本与本文档里的数字。
5. 本地跑 `node tests/page-smoke.mjs --require-browser`；失败时加 `FX_PAGE_SMOKE_DUMP=1` 看落盘页面。

### 加 AI 用例

AI 响应由 `tests/_harness.mjs` 的 `fakeAI` 打桩，完全离线：在 `CASES` 里用 `aiResponses` 给每次请求预置返回（纯 JSON、代码块、带解释文字、超时/失败等），用 `forceCrossCheck` 等开关覆盖强制二源路径。断言重点看“是否降级百度、答案是否正确、是否有额外网络请求”，不要依赖真实 AI 服务或真实 Key。

### 断言数同步点

| 位置 | 需要同步的内容 | 谁检查 |
| --- | --- | --- |
| `README.md` | `self--test-*`、`panel--smoke-*`、`page--smoke-*` 三个徽章 | `tests/selftest.mjs` |
| `CHANGELOG.md` | 当前版本「验证方式」里的 `**42 项断言全部通过**`、`**135 项断言全部通过**` | `tests/selftest.mjs` |
| 用户脚本 | `@description` 的「含 193 项内置自检」与文件结构注释的「193 项纯函数断言」 | `tests/selftest.mjs` |
| `docs/DEVELOPMENT.md` | 本文档里的 193 / 42 / 135 与命令注释 | `tests/selftest.mjs` |
| `tests/page-smoke.mjs` | `EXPECTED_ASSERTIONS` 与各用例 `expectCount` 之和 | `tests/selftest.mjs` 与页面冒烟自身 |

## 调试

### 保留失败现场

- 页面冒烟：`FX_PAGE_SMOKE_DUMP=1 node tests/page-smoke.mjs --require-browser`，每个用例的页面与 DOM 会落到系统临时目录，按日志里的路径打开。
- 面板冒烟：`FX_SMOKE_DUMP=/tmp/panel.html node tests/panel-smoke.mjs --require-browser`，同时写出 DOM 与生成页面，便于对比。
- 用户脚本自身：面板「日志与自检」里按级别看日志。级别由首字符判断：`❌ ⛔ 🚫` 为 error，`⚠️ ⚠ 🪟 ↩️ ⏰ ❔ 📴` 为 warn，`✅ ♻️ 📊 🎯 📌` 为 ok，`🔍 🧪` 为 debug，其余为 info；面板里以左侧色条区分。
- 诊断包：「日志与自检 → 导出诊断包」生成 `fx-diagnostics-YYYYMMDD-HHMMSS.json`，包含版本、UA、去掉查询串的页面地址、选择器命中、配置、请求统计、存储占用与最近 300 条日志；不含 `keySalt`，日志里的 `sk-` / `Bearer` / `key|token` 查询参数会脱敏。可以直接贴到 issue（仍建议先扫一眼）。

### 浏览器路径

`FX_BROWSER` 可以是绝对路径，也可以是 PATH 里的命令名。Windows 常见路径包括 Edge 的 `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`；Linux 可试 `google-chrome` / `chromium`；macOS 在 `/Applications/...` 下。找不到时先 `command -v google-chrome`（Windows 用 `where msedge`）确认。

### 常见失败

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `selftest` 报“缺「…」” | 断言数变了但文档/脚本注解没同步 | 按提示逐个补齐；同步点见上表 |
| `check-data` 报题库数字不一致 | README / data/README 手写数字过期 | `node tools/check-data.mjs --fix` 后人工 review diff |
| 冒烟退出码 2 | 没找到浏览器，或指定了 `--require-browser` | 安装 Chromium 系浏览器或设置 `FX_BROWSER` |
| 冒烟退出码 1 | 断言失败（脚本或页面行为回归） | 用 dump 开关保留现场，单跑该用例 |
| `EXDEV: cross-device link not permitted` | 图片脚本的临时目录与 `docs/` 不在同一文件系统 | 把仓库放在本地磁盘；脚本默认在 `docs/.tmp-images-*` 建临时目录，不要把它指到另一挂载点 |
| `找不到 Chrome` / `找不到 ffmpeg` / 中文变方框 | 配图依赖缺失 | 安装 Chrome/Chromium、`ffmpeg` 与中文字体；或用 `CHROME` / `FFMPEG` 指定路径 |
| `check-docs` 报死链 | 相对链接或锚点失效 | 按 `文件:行号 → 链接` 修正；标题改了要同步锚点 |
| 页面冒烟超时 | 浏览器启动慢或页面脚本卡住 | 先单独跑，确认浏览器可启动；CI 上使用 `--no-sandbox` 由脚本自动加 |

## 代码约定

1. **单文件、无构建**：所有运行时逻辑放在 `faxuanyun-legal-exam-assistant.user.js`，不引入打包器与第三方运行时依赖。
2. **站点适配集中**：选择器统一走 `SEL`，按钮文案走 `BTN`；平台改版只改这一层，业务逻辑不要散落选择器。
3. **纯函数可测**：可独立验证的逻辑写成纯函数并挂到 `__FX_TEST__`，由内置自检覆盖；不要为了测试把网络/存储耦合进来。
4. **静态模板可用 `innerHTML`，动态数据一律 `textContent`**：面板骨架可以在 Shadow DOM 内用一次 `innerHTML` 写入脚本内静态模板；题干、选项、日志、设置、网络返回等动态值必须用 `createElement` / `textContent`，禁止把动态内容拼进 HTML。当前 `panel.innerHTML` 只用于静态骨架（VERSION/分组按钮文案均为脚本内常量），不是用户数据入口。
5. **无遥测**：不主动上报任何数据；只有用户主动导出日志/诊断包时才落盘。
6. **不提交 Key / 个人信息**：真实 API Key、考试账号、单位信息、带个人信息的导出文件都不进仓库。
7. **UTF-8 + LF**：源码与文档统一 UTF-8、LF 换行，遵守 `.editorconfig` 与 `.gitattributes`。

## 真机回归清单

自动测试覆盖不到油猴自动更新、bfcache 返回、自动关闭、多标签页同场、百度 / AI 真实收益等链路。发版前建议在真实考试页逐项过一遍：

- [ ] 自动更新：旧版能通过 `@updateURL`（v2.0.22 起为 `@3` 别名）检查到新版本并安装成功。
- [ ] bfcache：考试页前进/后退恢复后，停止/暂停状态、自动关闭计时器和答题循环没有重影。
- [ ] 自动关闭：成绩解析/入库完成后按设置倒计时关闭；倒计时中再点「关闭页」能取消；浏览器拒绝 `window.close()` 时只提示、不反复重试。
- [ ] 多标签页：同场双页会提醒，只留一个标签页时写库与答题正常。
- [ ] 百度 / AI 真实收益：真实网络下能查到答案、失败时能按预期降级或跳过，不误答。
- [ ] 答题卡三色：正确 / 错误 / 未答判定符合预期，拿不准时宁可不写。
- [ ] 日志颜色：info / ok / warn / error / debug 的色条与导出内容一致。
- [ ] 诊断包：导出的 JSON 结构完整、最近日志不超过 300 条、不含 Key 与查询串。

## 文档与配图

- 文档入口与适用读者见 [docs/README.md](README.md)；安全报告见 [SECURITY.md](../SECURITY.md)，求助渠道见 [SUPPORT.md](../SUPPORT.md)。
- 三张 README 用图（`docs/social-preview-light.webp`、`docs/social-preview-dark.webp`、`docs/panel.webp`）由 `npm run docs:images` 重绘，原理与依赖见 [docs/IMAGE_PIPELINE.md](IMAGE_PIPELINE.md)。
- 脚本默认读取 `package.json` 的 `version` 与 README 的 `self--test-*` 徽章；也可显式传 `--version` / `--count`。调整海报或面板布局时，改 `tools/generate-docs-images.mjs` 的 `socialHtml()` / `panelHtml()`，让文字由浏览器重新排版，不要覆盖旧图。
- 配图依赖 `ffmpeg`、Chrome/Chromium 与系统中文字体，可用 `FFMPEG` / `CHROME` 覆盖路径；该脚本只在本机手动运行，不进入 CI。
- 新增或修改文档后跑一次 `node tools/check-docs.mjs`，确认相对链接与锚点都能解析。
