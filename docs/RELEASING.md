# 发版流程

> 面向有写权限、负责打 tag 与发布 Release 的维护者。日常开发与测试见 [docs/DEVELOPMENT.md](DEVELOPMENT.md)；仓库侧的 rulesets、Actions 权限与安全设置见 [docs/REPOSITORY_SETTINGS.md](REPOSITORY_SETTINGS.md)，那些设置需要在 GitHub 网页上人工确认。**当前 `protect-main` 没有启用 required checks，main 仍可直接 push；本文按“建议启用”描述保护规则，不能当作已生效的保障。**

## 版本号

版本号只有一个事实来源：用户脚本头部的 `// @version`。其余位置都是它的副本，发版时必须同步：

| 位置 | 写法 | 校验方式 |
| --- | --- | --- |
| `faxuanyun-legal-exam-assistant.user.js` | `// @version x.y.z` | 唯一来源 |
| `package.json` | `"version": "x.y.z"` | `tests/selftest.mjs` 断言与 `@version` 一致 |
| `README.md` | `version-x.y.z-blue` 徽章 | `tests/selftest.mjs` 断言与 `@version` 一致 |
| `CHANGELOG.md` | `## vx.y.z` 一节 | 发版门禁要求该节正文非空 |
| git tag | `vx.y.z` | 必须与 `@version` 完全一致（含 `v` 前缀） |

规则：

- 语义化版本：修 bug 升 patch，向后兼容的新能力升 minor，破坏兼容（例如存储格式、面板交互大改）才升 major。
- **只升不降**：新版本号必须大于本地与远端已有的最高 tag，不能复用已发布过的版本号。
- 不要在 tag 已经推送后补改文件再移动 tag：`protect-release-tags` 会拒绝，且已安装用户的更新链会混乱。打错了就发一个更高的 patch。

## 发布前

按顺序完成，任何一项不通过都不要打 tag：

1. **版本与说明就位**：改 `@version`、`package.json`、README 徽章，在 `CHANGELOG.md` 写 `## vx.y.z` 章节（新增 / 变更 / 修复 / 验证方式），验证方式要写真实跑出来的结果。
2. **配图同步**：`npm run docs:images`，打开 `docs/` 下三张图确认版本号、自检数与题库数字正确；再到 GitHub **Settings → Social preview** 重新上传 `docs/social-preview-light.webp`（或深色版）。OG 图是独立设置，不会随 README 自动更新。原理见 [docs/IMAGE_PIPELINE.md](IMAGE_PIPELINE.md)。
3. **统一门禁全绿**：`npm run ci`（8 步，含两个浏览器冒烟）。不要用 `--no-browser` 的结果代替发布前的全量门禁；CI 也不会跳过。
4. **发版门禁自检**：`node tools/release.mjs --check-ci vx.y.z`，确认输出通过。该命令校验 tag 字符串与 `@version` 一致、CHANGELOG 对应章节非空，并打印脚本体积。
5. **工作区干净**：`git status --porcelain` 为空；本地 `main` 与 `origin/main` 同步，且 `origin/main` 是当前 HEAD 的祖先。
6. **体积检查**：脚本预算 512 KB，`selftest` 会做硬断言；`release.mjs --check-ci` 会打印实际 KB，接近上限时先确认不是误引入大段数据。
7. **外链与来源**：`npm run check:external -- --strict` 检查文档外链（需要网络，默认不进门禁）；发版 workflow 会自动为 `.user.js` 生成 GitHub 构建来源证明，发布后在 Release 页可见。

离线预检可以用 `node tools/release.mjs --dry-run`：它只做检查、不创建 tag、不联网，工作区脏时也只告警。

## 本地流程

推荐用发版助手，把“前置检查 → 统一门禁 → 打本地 tag”串起来。推送 main 时用 `HEAD:main`，这样从祖先提交发升级桥也不会误推本地 `main`：

```bash
# 1) 提交并先推 main（release.yml 会校验 raw main 已经是本版）
git add faxuanyun-legal-exam-assistant.user.js package.json README.md CHANGELOG.md docs/
git commit -m "release: vx.y.z - 一句话说明"
git push origin HEAD:main

# 2) 本地打 tag：同步远端 tag、版本单调、工作区干净、跑 npm run ci，然后打 annotated tag
node tools/release.mjs

# 3) 只推这一个 tag（不要 git push --tags）
git push origin vx.y.z
```

手工等价流程：

```bash
git tag -a vx.y.z -m "vx.y.z"
git push origin vx.y.z
```

约束：

- **先推 main，再推 tag**。`release.yml` 会用 raw main 判断“main 是否已跟上 tag”，main 落后时发版会红。
- `release.mjs` 只打本地 tag，**不 push**；它唯一的联网动作是带 20 秒超时的 `git fetch`。打印的推送命令按当前 HEAD 生成 `git push origin HEAD:main`，从祖先提交发升级桥时不会误推本地 `main`。
- 一次只推一个 tag。`git push --tags` 会把本地遗留的旧 tag 一起推上去，可能触发多次发版或推送错误版本。
- 重复执行是安全的：如果 tag 已存在，`release.mjs` 只提示并退出 0，不会重复打 tag 或重复跑门禁；workflow 也可以重跑，但附件用 `--clobber` 覆盖**只在未开启 immutable releases 时成立**，开启后见下面第 4、5 步与回滚策略。
- 不要跳过门禁。`--skip-tests` 只用于明确的本地调试；CI 仍会跑全套，带着失败打 tag 只会得到红色 Release。

### SSH 推不上去（22 端口被拦）

如果 `git push` 卡在连接或超时，改用 GitHub 的 443 端口：

```text
# ~/.ssh/config
Host github.com
  HostName ssh.github.com
  Port 443
  User git
```

然后 `ssh -T git@github.com` 验证，成功后再推 main 与 tag。`https://` 远端不受此影响。

## release.yml 做什么

推送 `v*` tag 会触发 `.github/workflows/release.yml`（workflow 名「发版」）。workflow 拆成两个 job：

- `verify`（只读）先跑 tag/版本/CHANGELOG 门禁与完整自检；失败时 `release` 不会启动。
- `release`（`needs: verify`，只在发布 job 内申请最小写权限）生成校验和、发布 Release、回读校验与更新链检查。

| 步骤 | job | 内容 | 失败后果 |
| --- | --- | --- | --- |
| 1. 校验 tag 与版本 / CHANGELOG | verify | `node tools/release.mjs --check-ci "$TAG"`：tag 必须等于 `@version`，CHANGELOG 章节必须非空 | 不创建 Release，tag 保留 |
| 2. 发版前自检 | verify | `npm run ci`：与本地相同的 8 步统一门禁 | 不创建 Release，tag 保留 |
| 3. 生成校验和与发布说明 | release | `sha256sum` 生成同名 `.sha256`；用 `awk` 抽取 CHANGELOG 正文并校验非空；拼装安装/更新、体积（预算 512 KB）与校验和 | 中止，不创建 Release |
| 4. 生成构建来源证明 | release | `actions/attest-build-provenance` 对 `.user.js` 生成 GitHub 构建来源证明（`subject-path`），便于追溯附件由本仓库 workflow 产出 | 中止；不会发布无证明版本 |
| 5. 创建或更新 Release | release | `gh release create`，或对已存在的 Release `edit --draft=false` + `upload --clobber`；上传 `.user.js` 与 `.sha256` 两个附件 | Release 可能已存在，修好后重跑；未开启 immutable releases 才可用 `--clobber` 覆盖 |
| 6. 验证 Release | release | 回读 `isDraft=false`、附件数为 2、下载附件、`sha256sum -c`、`cmp` 与复算校验和 | 报错并提示重跑；未开启 immutable releases 时附件会被覆盖，开启后只能发新 patch |
| 7. 更新链校验 | release | 主动 purge jsDelivr；以 raw main 为权威重试 6 次 × 20 秒；镜像未刷新只告警；latest Release 必须指向本 tag | raw 未跟上或 latest 不对会红 |

权限与并发：

- workflow 顶层 `permissions: contents: read`；`verify` job 继承只读；`release` job 显式声明 `contents: write`、`id-token: write`、`attestations: write`，用于创建 Release 与生成来源证明。
- `verify` job 在 `ubuntu-24.04` 上跑，`timeout-minutes: 20`，Node 22；checkout 用 `fetch-depth: 0` 读完整 tag 历史，并设置 `persist-credentials: false`。
- `release` job 也在 `ubuntu-24.04` 上跑，`timeout-minutes: 15`；不安装 Node，checkout 用 `fetch-depth: 1` 取 tag 快照，只执行 shell / `gh` / `sha256sum` / `curl`，并设置 `persist-credentials: false`。
- 全局并发组 `release`，`cancel-in-progress: false`：两个 tag 同时发版会排队，不会互相覆盖 latest 与附件。
- 所有第三方 action 都 pin 到 40 位 commit SHA，升级由 Dependabot 开 PR。

发布后的 Release 内容应包含：

- 标题 `vx.y.z`，正文来自 CHANGELOG 对应章节；
- 固定到本 tag 的安装链接：`https://fastly.jsdelivr.net/gh/Gnayiel/faxuanyun-legal-exam-assistant@vx.y.z/faxuanyun-legal-exam-assistant.user.js`；
- 脚本体积（KB）与 SHA256；
- 两个附件：`faxuanyun-legal-exam-assistant.user.js`、`faxuanyun-legal-exam-assistant.user.js.sha256`。

## 更新链

用户侧的自动更新、首装链接与“最新版”判断分别走不同地址，排查时要分清：

| 入口 | 地址 | 特点 |
| --- | --- | --- |
| 油猴自动更新 | `@updateURL` / `@downloadURL`：`https://fastly.jsdelivr.net/gh/Gnayiel/faxuanyun-legal-exam-assistant@3/faxuanyun-legal-exam-assistant.user.js` | `@3` 主版本别名（v2.0.22 升级桥起；此前为 `@2`）；边缘缓存最长约 12 小时，客户端还可能缓存更久 |
| 固定版本安装 | `https://fastly.jsdelivr.net/gh/Gnayiel/faxuanyun-legal-exam-assistant@vx.y.z/faxuanyun-legal-exam-assistant.user.js` | 钉死到某个 tag；不受 `@3` 缓存和 main 后续提交影响，适合排障与首发验证 |
| 权威版本判定 | `https://raw.githubusercontent.com/Gnayiel/faxuanyun-legal-exam-assistant/main/faxuanyun-legal-exam-assistant.user.js` | main 的 raw 文件，无长缓存；发版门禁以它判断 main 是否已跟上 tag |
| Release 附件 | Releases 页的 `.user.js` 与 `.sha256` | 离线安装与校验；下载后可用 `.sha256` 复算 |

> **v2.0.22 升级桥**：脚本 `@version` 仍是 2.0.22，但 `@updateURL` / `@downloadURL` 已指 `@3`，并带 `// fx-bridge-to 3`。发布顺序是先发 v2.0.22（让 2.x 用户先升到桥），再发 v3.0.0；`tests/selftest.mjs` 与 `node tools/release.mjs --check-ci` 都校验这个例外，普通版本的主版本错位会直接失败。桥从祖先提交发布时，先 `git checkout <bridge-commit>` 再运行 `node tools/release.mjs`：它按当前 HEAD 生成 `git push origin HEAD:main`，不会把本地 `main`（可能已是 v3）误推上去。

因此发布顺序必须是：先推 main（raw 跟上）→ 再推 tag（workflow 建 Release）→ latest 指向新 tag。`@3` 镜像没刷新只会 `::warning::`，不会卡住发版；急着验证时用 `@vx.y.z` 固定链接；未开启 immutable releases 时可稍后重跑 workflow 再刷一次，开启后只能等缓存自然过期。

> 别名元数据与脚本文件是两层缓存：曾出现 `@2/package.json` 已是 2.0.22、`@2/...user.js` 仍返回 2.0.16 的情况。`purge.jsdelivr.net` 不保证一次清掉所有边缘；判断版本以 `@vx.y.z` 的脚本文件为准，或等 `s-maxage`（约 12 小时）自然过期。

## 失败恢复

| 场景 | 处理 |
| --- | --- |
| `--check-ci` 报 tag 与 `@version` 不一致 | 改版本号或改 tag；**tag 未推送**时可 `git tag -d vx.y.z` 后重来 |
| CHANGELOG 缺失或章节为空 | 补 `## vx.y.z` 正文，提交并推 main，再发新 tag |
| 本地门禁失败 | 修代码后重新提交；不要带着红灯打 tag |
| Release 已创建，但“验证 Release”失败 | 先按报错修（附件数、校验和、latest）；然后在 Actions 里重跑同一 tag 的 workflow。未开启 immutable releases 时上传步骤用 `--clobber` 可覆盖；开启后不能覆盖，只能修知识性说明或发新 patch |
| raw main 版本未跟上 tag | 确认 main 已包含本版脚本并推送；workflow 会重试 6 次（每次间隔 20 秒），仍失败则重跑 |
| `@3` 镜像仍旧版 | 属正常缓存延迟；用固定 `@vx.y.z` 链接验证，或等待缓存过期；未开启 immutable releases 时可重跑 workflow，开启后只能等 |
| latest Release 不是本 tag | 到 Releases 页把 `vx.y.z` 设为 latest，再重跑 workflow 的更新链步骤 |
| tag 打错但已经推送 | **不要删除或强推移动已推 tag**。发一个更高的 patch 版本；`protect-release-tags` 会阻止删除/改指向 |
| 确需重打已推 tag（极端情况） | 需管理员临时停用 `protect-release-tags`，删除 Release 与 tag 后重新打，再恢复规则；优先选择“发新 patch”，避免用户更新链断裂 |

补充：

- 不要为了“让 CI 变绿”而删除失败的 tag 或 Release 资产；已安装用户可能已经拿到该版本。正确做法是发新补丁并在 CHANGELOG / Release 说明里写清问题与修复。
- 不要用 `--skip-tests` 发布，也不要在 workflow 里临时注释门禁步骤。
- 如果 Release 已存在但内容错误，且仓库未开启 immutable releases，workflow 会 `edit --draft=false` 并用 `--clobber` 覆盖两个附件，正文也会按当前 CHANGELOG 重建；开启 immutable releases 后这条修复路径不可用，只能发新 patch（见回滚策略）。

## 发布后验证

1. Actions 里「发版」workflow 全绿，尤其第 5、6 步没有跳过。
2. Releases 页：`vx.y.z` 是 latest，标题与正文正确，恰好两个附件，说明里有体积与 SHA256。
3. 下载附件并复算：

   ```bash
   sha256sum -c faxuanyun-legal-exam-assistant.user.js.sha256
   # Windows PowerShell: Get-FileHash .\faxuanyun-legal-exam-assistant.user.js -Algorithm SHA256
   ```

4. 在一个干净的浏览器配置里用固定版本链接安装，确认油猴显示 `@version` 为 `x.y.z`，考试页能正常出面板。
5. 已安装旧版的浏览器里点「检查脚本更新」：`@3` 缓存未过期时可能仍提示最新；可先用 `@vx.y.z` 验证，或等待缓存过期后重试。
6. 需要排查自动更新时，让用户附上面板「导出诊断包」的 JSON（已脱敏，不含 API Key）。

## 回滚策略

- **回滚 = 发一个更高的 patch 版本**：把有问题的提交 revert 或修正后，按本文流程发 `x.y.(z+1)`，CHANGELOG 写清“回滚了哪个版本、影响是什么、建议升级”。
- **不删除、不移动已发布的 tag**；也尽量不要删除 Release 资产。固定版本链接与用户已安装的版本都依赖它们。
- 如果问题只影响说明文字，可以编辑 Release 正文加警告；脚本本身有问题时，仍以发新补丁为准。
- 若仓库启用了 immutable releases，已发布 Release 的资产不可再改，更不能依赖“事后覆盖”，发布前检查要更严格。

## 仓库保护依赖

以下 GitHub 设置会影响发版安全，但**不在 git 里**，也不是本文能保证已开启的；请按 [docs/REPOSITORY_SETTINGS.md](REPOSITORY_SETTINGS.md) 在网页上人工确认：

- `protect-release-tags`：阻止 `v*` tag 被删除或改指向，是“打错不发新版”的最后一道保险；启用后重打 tag 必须先临时停用。
- `protect-main`：**当前未启用**，main 允许直接 push；如果以后启用，应要求 PR 与自检通过，避免未过门禁的代码直接进 main。在未启用期间，发版者必须自己保证本地 `npm run ci` 已通过，不能把“CI 绿”当成服务端已拦截。
- required checks：若启用 `protect-main`，应包含 `selftest (22)` 与 `selftest (24)` 两个实际 check-run 名称；写成 `自检 / selftest (22)` 不会命中。未启用时，这两个 job 仍会跑，但不阻止直接 push。
- Actions 默认权限为 read、fork PR 不自动跑带 secrets 的 workflow；`release.yml` 的 `release` job 才声明 `contents: write` 与来源证明所需权限，其余 workflow 不需要写权限。
- Releases 的 latest 指向、immutable releases（如可用）与附件保留策略。
