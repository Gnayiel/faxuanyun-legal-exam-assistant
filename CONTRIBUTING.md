# 贡献指南

感谢愿意一起维护这个项目。先说明：这是一个个人学习项目，维护精力有限，issue / PR 会尽量看，但不保证响应时间。

## 适合提交什么

- **平台改版导致的选择器失配**（最优先）
- 脚本 bug、浏览器 / 油猴兼容性问题
- 文档错误、题库快照问题
- 新功能：先开 issue 讨论方向，避免做完才发现方向不对

## 开发环境

- Node.js ≥ 22（CI 用 22 LTS；工具脚本只用到 Node 内置模块，**没有任何 npm 依赖**）
- Edge / Chrome / Chromium 任一（面板冒烟测试用；可用 `FX_BROWSER` 指定可执行路径）
- 不需要构建：改完 `faxuanyun-legal-exam-assistant.user.js`，重新装到油猴里刷新页面即可

## 本地验证（提交前必跑）

```bash
node tools/check-syntax.mjs                  # user.js 与 tools/*.mjs 语法检查
node tools/selftest.mjs                      # 校验 @-metadata + 跑脚本内置的 190 项断言 + 文档数字校验，不联网
node tools/check-data.mjs                    # 题库快照与 README / data/README 的数字是否一致，并按 data/bank.schema.json 校验格式
node tools/check-workflows.mjs               # GitHub Actions 配置静态检查（pin SHA / 权限 / 脚本路径）
node tools/merge-smoke.mjs                   # 题库合并冒烟（冲突 / 幂等 / 公式消毒，17 项检查）
node tools/backfill-release-notes.mjs --self-test   # 旧 Release 说明回填脚本离线自测
node tools/panel-smoke.mjs --require-browser # 真实浏览器面板冒烟（40 项断言）
node tools/page-smoke.mjs --require-browser  # 真实浏览器页面适配冒烟（88 项断言）
```

- 装了 Node 之后也可以用 `package.json` 里的快捷命令：`npm run check`（语法 + 自检 + 数据 + 工作流 + 题库合并冒烟）、
  `npm run ci`（上述全部 + 回填脚本自测 + 面板/页面冒烟，共 8 步，与 selftest.yml、release.yml 共用同一份清单）、`npm run smoke`（两种浏览器冒烟，强制模式）、`npm run release`（发版助手）。
- 两种浏览器冒烟共用 `tools/browser.mjs` 探测浏览器（`FX_BROWSER` → 常见安装路径 → PATH，Windows 也支持），
  找不到浏览器时默认**跳过**（退出码 0）；加 `--require-browser`（或设 `FX_REQUIRE_BROWSER=1`）则改为失败——
  CI 用的就是强制模式，防止「没装浏览器 → 静默跳过 → 假绿」。
- `selftest.mjs` 会校验 README / CHANGELOG / 脚本注释里写死的自检断言数、page-smoke 断言数与 README 版本徽章是否与 `@version` 一致。
  改了这些数字必须同步，否则测试会直接指出缺哪个字符串；它还会校验 `@updateURL` / `@downloadURL` 是否为 `@2`
  （jsDelivr 主版本别名，仍受边缘缓存影响）或 `main` 分支的完整 https 直链（默认走 `fastly.jsdelivr.net` 等 jsDelivr 边缘域名，也认 `raw.githubusercontent.com`），以及用户脚本体积不超过 512 KB。
- 手动冒烟：装脚本 → 打开任意 `*.faxuanyun.com` 页面 → 面板能建起来、按钮与快捷键正常。

## 更新日志与版本号

- 每个版本在 `CHANGELOG.md` 顶部新增 `## vX.Y.Z` 章节，写完再改 `@version` 与 README 的版本徽章；三者不一致时门禁会拦。
- `CHANGELOG.md` 只保留最近三个版本，更早的记录移入 `CHANGELOG-archive.md`（原样保留，不再更新），避免主文件无限膨胀。
- 只改文档 / 预览图这类不影响脚本的提交不发版，用 `docs:` / `chore:` 前缀直接推 `main` 即可。

## 质量门禁与工具

单文件、纯前端、**无构建步骤**，改完直接安装即可。上面命令块里每条工具的职责：

- `tools/selftest.mjs` 在最小 DOM / 油猴打桩下加载脚本，跑的就是面板「自检」按钮调用的同一批用例；
  它还会校验 `@-metadata` 是否完整、`@downloadURL` / `@updateURL` 是否是 `@2`（jsDelivr 主版本别名）或 `main` 分支的完整 https 直链且两者一致（只校验字符串，不联网）、脚本体积是否超出 512 KB 预算、
  脚本里的 `CONNECT_HOSTS` 常量和头部 `@connect` 白名单是否一一对应、
  README 徽章 / 脚本文案里写明的断言数是否与真实用例数一致，以及 **README 版本徽章是否与 `@version` 一致**（数字和版本写死都会过期）。
- `tools/panel-smoke.mjs` 找不到浏览器时默认**跳过**（退出码 0）；
  加 `--require-browser`（或设 `FX_REQUIRE_BROWSER=1`）则直接失败，CI 用的就是强制模式，
  避免「没装浏览器 → 静默跳过 → 假绿」。也可以用 `FX_BROWSER=/path/to/chrome` 指定浏览器（`tools/browser.mjs` 统一探测，支持 PATH 与 Windows 常见路径）。
- `tools/page-smoke.mjs` 把脚本装进 `tests/fixtures/` 下的脱敏考试页 / 成绩页 fixture，在真实 Chromium 内核里
  走一遍「识题 → 作答 → 交卷 → 对账」链路，共 88 项断言；同样支持 `--require-browser` 强制模式（CI 必跑），
  `FX_PAGE_SMOKE_DUMP=1` 可导出页面快照辅助排查。
- `tools/check-data.mjs` 校验 `data/` 下最新的题库快照：JSON / CSV 成对、条数与题型分布自洽、
  且与 README / `data/README.md` 里写死的数字一致——改快照或改文档时能第一时间发现数字漂移；
  加 `--fix` 会按实测值直接改写文档里写错的数字。
- `tools/merge-bank.mjs` 是题库合并工具：把多台电脑 / 多份导出的 `.json`、`.csv` 合成一份可直接导入的 `.json`
  （规则见 [导入 / 导出](README.md#导入--导出)）；加 `--emit-snapshot` 会按仓库约定在 `data/` 下生成成对的 JSON + CSV 快照。
- `tools/check-workflows.mjs` 对 `.github/workflows/*.yml` 做静态检查：第三方 action 必须 pin 到 40 位 commit SHA、
  必须声明 `permissions` 与 `timeout-minutes`、禁止 `pull_request_target` 检出 PR 代码、引用的本地脚本必须存在、
  发版必须由 tag 触发。
- `tools/release.mjs` 是本地发版助手：校验 `@version` 与 CHANGELOG 章节一致 → 跑自检 / 数据 / 工作流检查 → 打本地 tag，
  然后按提示推送 `main` 与这一版的 `vX.Y.Z` tag（不要一次推所有 tag），由 `release.yml` 校验 tag 与 `@version` 一致、CHANGELOG 章节非空后自动建 Release，并在发布后回读附件复算 SHA256。
- 面板里**「自检」（`Alt + T`）**是同一批断言，失败项会逐条写进日志。
- CI：`.github/workflows/selftest.yml` 在 push 到 `main`、以及每个 PR 上跑上面的检查（含面板冒烟与页面适配冒烟，也可手动触发）；
  推送 `v*` tag 时 `.github/workflows/release.yml` 自动跑同样的门禁（另加 `merge-smoke`，其中会调用 `merge-bank`；以及两种浏览器冒烟）并创建 Release、上传 `.user.js` 与同名 `.sha256`（发布前校验 tag 与 `@version` 一致、CHANGELOG 章节非空；发布后回读 Release 校验附件数与 SHA256，再用 raw 上 `main` 的脚本核对 `@version` 与 latest tag，并主动 purge 一次 jsDelivr 缓存、尽力确认镜像也已刷新）。
  环境固定为 `ubuntu-24.04` + Node 22，第三方 action 全部固定到 commit SHA，由 Dependabot 每周开 PR 升级。

改动前请留意两点：

1. 脚本只有一个版本号来源，就是头部的 `@version`（运行时读 `GM_info`），**不要在代码里另写一份版本常量**。
2. 改文件名或导出前缀时，`tools/` 里的默认脚本路径与文件名断言要同步改，否则 CI 会红。

## 代码约定

1. 单文件 userscript，无构建、无第三方依赖；不要把 npm 包引进来。
2. 平台相关选择器集中在「站点适配层」`SEL` / `BTN` 两组常量里，业务逻辑里不要新增散落选择器；平台改版只改这一层。
3. 新逻辑尽量写成纯函数并挂进 `__FX_TEST__` 与内置自检用例（`selfTestCases`）；断言数变化后记得同步 README / CHANGELOG / 脚本注解里的数字。
4. 面板 DOM 在 Shadow DOM 里构建；不要用 `innerHTML` 拼接用户数据（一律 `textContent`）。
5. 不引入遥测、不请求 `@connect` 白名单之外的域名；新增域名要同步脚本头部 `@connect` 与 `CONNECT_HOSTS`（`selftest.mjs` 会校验两者一一对应）。
6. 不提交 API Key、带日期的题库导出、日志或其它个人数据；仓库只放脚本、文档、工具和一份演示快照。
7. 文本文件 UTF-8 无 BOM、LF 换行（`.gitattributes` 已设置）；`data/README.md` 的命名与放行规则继续遵守。

## 题库快照维护

- 随仓库分发的快照（如 `data/faxuanyun-legal-exam-bank-20261020.*`）是某一时刻的切片，**不会随每个版本自动更新**。
- 题库有实质变化时，用面板导出新的 `.json` + `.csv`，按 `data/README.md` 的命名规则替换或新增，并在 `CHANGELOG.md` 里说明来源与日期。
- 换成新快照时，用新日期戳的一对文件替换旧文件即可（`.gitignore` 已按命名规则通配放行）；`data/` 只保留一份快照，`tools/check-data.mjs` 会拦第二份。

## 真机确认与回归清单

题目容器 `#timucontent`、题干 `h2`、选项 `input[name="option"]`（`value` 就是 A/B/C/D）
都是第一候选命中；考试页**没有 iframe**；弹窗是 `position: fixed`（可见性判断已用
`getClientRects()` 兜底）；`body.innerText` 只有 264 字符、耗时 < 1ms。

v2.0.2 起在真实油猴环境下持续验证：成绩弹窗解析、交卷后残留会话清理、关闭页倒计时与取消、
百度 / AI 查询链路（`GM_xmlhttpRequest` 跨域 + `@connect` 白名单）、题库跨页持久化与跨电脑导入合并。
仍有几项只能真机完整走一遍（油猴「自动更新」跨版本升级链路、bfcache 返回、自动关闭、多标签页同场双开、百度 / AI 真实收益），逐项清单见下面「真机回归清单」。

### 真机回归清单（维护者）

以下项目本机无法自动覆盖，发版前建议在真机（油猴 + 真实考试页面）逐项过一遍；报 bug 时用面板「导出诊断包」回传：

- [ ] **自动更新跨版本**：装上一版 → 发布新版 → 油猴「检查更新」能拉到 `@updateURL` 的新 `@version` 并升级
- [ ] **bfcache 返回**：成绩页对账后前进 / 后退返回考试页，脚本能重新探测（`pageshow.persisted`），不残留旧状态
- [ ] **自动关闭**：成绩页对账完成后自动关闭本页；被浏览器拒绝时只在日志 / 通知提示，不反复重试
- [ ] **多标签页同场双开（可选，单标签页考试可跳过）**：两个标签页同时答同一场，脚本能提示分叉；先后落盘不互相覆盖、被删条目不会复活
- [ ] **百度 / AI 真实收益**：真实站点的回显剔除率、跟进页命中率、单题耗时（默认 20 秒预算内）
- [ ] **答题卡 / 判断题 / 多选**：真实页面上的三色判定、判断题复用、多选组合策略与旧版一致或更好
- [ ] **日志级别颜色**：`❌ / ⚠️ / ✅ / 🕒` 等前缀按级别着色，普通信息不会被标成红色错误
- [ ] **诊断包**：导出 JSON 可读、字段完整、**不含 API Key**；争议题导出结构与面板提示正常

## 目录结构

```
.
├── faxuanyun-legal-exam-assistant.user.js   # 用户脚本本体（.user.js 后缀是油猴识别安装所必需，勿改）
├── README.md
├── CHANGELOG.md                  # 版本更新记录（只留最近三个版本）
├── CHANGELOG-archive.md          # 更早的版本记录归档（v2.0.0 起）
├── CONTRIBUTING.md               # 贡献与发版流程
├── SECURITY.md                   # 安全问题报告方式
├── CODE_OF_CONDUCT.md            # 行为准则
├── LICENSE                       # MIT
├── .gitignore
├── .gitattributes
├── .editorconfig                 # 编辑器行为（统一 LF/缩进；CSV 与图片例外）
├── .nvmrc                        # Node 22（与 CI 一致）
├── package.json                  # 元数据 + npm run check / ci / smoke / release 快捷命令
├── .github/
│   ├── dependabot.yml            # 自动升级 GitHub Actions
│   ├── ISSUE_TEMPLATE/           # issue 模板（bug 报告 + 安全引导）
│   ├── pull_request_template.md  # PR 自查清单
│   └── workflows/
│       ├── selftest.yml          # CI：语法 + 内置自检 + 数据/工作流 + 合并/面板/页面冒烟（统一 npm run ci）
│       ├── release.yml           # 推送 v* tag 时自动建 Release、上传 .user.js + .sha256，并做更新链校验
│       ├── auto-merge.yml        # Dependabot 依赖升级 PR：自检全绿后自动合并
│       └── backfill-release-notes.yml  # 手动触发：把旧 Release 说明里的 raw/main 安装链换成 tag 级 jsDelivr 链接
├── docs/                         # README 顶部预览图与 GitHub 社交预览图（panel.webp、social-preview-*.webp）
├── data/
│   ├── README.md                 # 题库快照的命名规范与提交规则
│   ├── bank.schema.json                          # 题库 JSON 的 schema（check-data 校验用）
│   ├── faxuanyun-legal-exam-bank-20261020.csv    # 随仓库分发的 299 题快照（6 列）
│   └── faxuanyun-legal-exam-bank-20261020.json   # 同上，字段完整版
├── tests/
│   └── fixtures/                 # 页面适配冒烟的 6 个脱敏 fixture（单选/多选/判断/答题卡/成绩/无总题数）
└── tools/
    ├── check-syntax.mjs          # user.js 与全部 tools/*.mjs 的语法检查
    ├── selftest.mjs              # 无依赖自检（元数据 + 190 项断言）
    ├── check-data.mjs            # 题库快照与文档数字一致性校验（--fix 可自动修）
    ├── merge-bank.mjs            # 多份题库导出合并（--emit-snapshot 生成 data/ 快照）
    ├── merge-smoke.mjs           # 合并工具冒烟（冲突 / 幂等 / 公式消毒，17 项检查）
    ├── check-workflows.mjs       # GitHub Actions 配置静态检查
    ├── ci.mjs                    # 统一门禁：语法→自检→数据→工作流→回填自测→合并→面板→页面
    ├── release.mjs               # 本地发版助手（校验 → 测试 → 打 tag）
    ├── backfill-release-notes.mjs # 旧 Release 说明安装链回填（--dry-run / --self-test）
    ├── browser.mjs               # 浏览器探测与 headless 启动（两种冒烟共用）
    ├── _harness.mjs              # 页面内 GM_* 打桩与假百度接口（两种冒烟共用）
    ├── panel-smoke.mjs           # 真实浏览器面板冒烟测试（40 项），CI 用强制模式
    └── page-smoke.mjs            # 真实浏览器页面适配冒烟：7 个用例 / 6 份 fixture（88 项），CI 必跑
```

从面板「导出答案库」拿到的文件按日期命名，可以直接放进 `data/` 归档；
这类带日期的快照默认被 `.gitignore` 排除，不会误提交——
只有 `data/` 下随仓库分发的那一份按命名规则通配放行（仓库只保留一份，`check-data` 会拦第二份），规则见 [`data/README.md`](data/README.md)。

## 发版流程（维护者）

1. 改代码 → 本地跑上面几条测试全绿。
2. `@version` 递增（严格大于上一版，`x.y.z`）；README 版本徽章同步（`selftest.mjs` 会校验）。
3. `CHANGELOG.md` 顶部加新版本段落（日期 + 新增 / 变更 / 修复 / 移除 + 验证方式）。
4. 提交并推送：
   ```bash
   git add -A
   git commit -m "fix: 一句话说明"
   git push origin main
   ```

   > 本机 `github.com:443` 连不上时（`raw.githubusercontent.com` 也可能不通），可以改用 SSH over 443 显式推送：
   > `git push ssh://git@ssh.github.com:443/Gnayiel/faxuanyun-legal-exam-assistant.git main`，
   > tag 同理 `git push ssh://git@ssh.github.com:443/Gnayiel/faxuanyun-legal-exam-assistant.git vX.Y.Z`。
   > 常驻配置：`git config remote.origin.pushurl ssh://git@ssh.github.com:443/Gnayiel/faxuanyun-legal-exam-assistant.git`（之后直接 `git push origin main` 即可）。

5. 打 tag：推送后 `.github/workflows/release.yml` 会自动跑自检、建 Release 并上传
   该版本的 `.user.js` 与同名 `.sha256`（**自动更新不依赖 Release**；Release 是下载镜像与版本留档，打 tag 即触发）：
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```
   workflow 会先跑自检 / 数据 / 工作流 / 合并 / 两种冒烟，再建 Release、回读附件，最后核对远端 `@updateURL` 的 `@version` 与 latest tag。
   也可以在工作流跑完后到 Release 页面核对附件与发布说明。
6. **断点续发**：workflow 失败时按报错处理——`release.mjs --check-ci` 门禁失败（tag 与 `@version` 不符、CHANGELOG 缺章节）
   要先改代码 / 文档，再推送新的版本 tag（`v*` tag 受 `protect-release-tags` 保护，已推送的不能原地重打）；发布后回读校验失败（附件数 / SHA256 不一致）时 Release 其实已经建好，修好原因后
   直接在 Actions 里重跑本 workflow 即可，附件会用 `--clobber` 覆盖，**不需要**删 tag 重打。只有 tag 本身打错时，才需要先临时停用 `protect-release-tags` ruleset、删除后重打，打完记得重新启用（平时 `v*` tag 受保护，删不掉是正常的）。
7. **只升不降**：不要发布比已在线版本更低的 `@version`（油猴不会降级到旧版）；某版有问题时，改代码后发一个
   **更高**的版本修正，不要删除或重打已经推送的 tag（`protect-release-tags` 规则集会直接拦截）——Release 附件与 SHA256 是按 tag 固化的，删 tag 会让
   已下载的用户对不上版本。
8. 发布后自查：浏览器打开 `@updateURL` 指向的文件（jsDelivr 镜像或 raw）确认新 `@version`；或留一个旧版装油猴点「检查更新」，验证自动更新链路（镜像有边缘缓存，可能需要等几分钟）。
   CI 也会自动核对远端 `@updateURL` 的 `@version` 与 latest tag；如果刚推完 tag 就红，多半是 CDN 延迟，重跑即可。

## 报告问题

- 普通 bug / 功能建议：用仓库的 issue 模板
- 安全问题、泄露的 Key：走 [SECURITY.md](SECURITY.md)，不要公开贴
- 参与讨论请遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
