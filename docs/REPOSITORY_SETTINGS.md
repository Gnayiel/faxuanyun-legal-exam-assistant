# 仓库设置建议

> **本文所有设置均为建议，需要在 GitHub 网页上人工确认，不代表当前仓库已经这样配置。** 适用于仓库管理员 / owner。仓库侧的 rulesets、Actions 权限等不在 git 里，无法通过代码评审保证；发版流程对其中几项的依赖见 [docs/RELEASING.md](RELEASING.md)。

仓库：`Gnayiel/faxuanyun-legal-exam-assistant`（公开仓库，MIT，纯单文件 userscript，无 npm 依赖）。

## 基本信息

| 设置 | 建议值 | 说明 |
| --- | --- | --- |
| Description | `甘肃省国家工作人员学法考试平台（法宣在线）Tampermonkey 用户脚本：本地题库 + AI/百度多源 + 自动答题与成绩对账` | 与 `package.json` 的描述保持一致，便于搜索与识别 |
| Website | 暂留空或填 `https://greasyfork.org/` 发布页（如有） | 没有官方站点时不必编造 |
| Topics | `tampermonkey`、`userscript`、`faxuanyun`、`legal-exam`、`gansu`、`automation`、`javascript`、`greasemonkey`、`ai`、`baidu` | 建议 8–12 个；别堆无关热门标签 |
| Social preview | 上传 `docs/social-preview-light.webp`（深色界面用户可换 dark 版） | 仓库已自带浅/深两张预览图；上传后请在分享卡片里预览确认 |
| Default branch | `main` | 所有 workflow 与文档都按 `main` 写 |
| Features → Issues | 开启 | 需要 `bug_report.yml` 模板与 issue 检索 |
| Features → Discussions | 可开启（Q&A / 使用交流） | [SUPPORT.md](../SUPPORT.md) 与 issue 模板的 config 都会引导到 Discussions；开启后建议建 `Q&A`、`Announcements` 分类 |
| Features → Wiki | 关闭 | 文档统一放 `docs/`，Wiki 容易与仓库文档分叉 |
| Features → Projects | 可关闭 | 单人维护，issue/PR 足够 |
| Sponsorships | 按需 | 与代码无关，不影响使用 |

README 已链接架构、开发、发版、仓库设置与支持文档；改仓库名或默认分支时，记得同步 README 里的安装链接与文档链接。

## Actions 权限

建议在 **Settings → Actions → General** 人工确认：

- **Workflow permissions**：默认选 `Read repository contents and packages permissions`。`release.yml` 在自己的 job 内声明 `contents: write`，不依赖仓库级默认写权限；`selftest.yml` 只需 `contents: read`。
- **Allow GitHub Actions to create and approve pull requests**：关闭。本仓库的 workflow 不创建 PR（Dependabot 的 PR 由 Dependabot 自己开）。
- **Fork pull request workflows**：保持默认的“需要批准后运行”，且 fork PR 不暴露 secrets——本仓库的 CI 不需要任何 secret。
- **Artifact and log retention**：默认即可；发版附件放在 Release，不占 Actions 制品配额。
- **Self-hosted runners**：不使用；workflow 固定 `ubuntu-24.04`。

注意：`auto-merge.yml` 声明了 `contents: write`，用于对 Dependabot PR 执行 squash 合并；若组织策略限制写权限，这个自动合并会失败，但不影响「自检」与发版。是否保留自动合并属于维护者选择。

## 分支与 tag 保护（Rulesets 建议）

优先使用 **Settings → Rules → Rulesets**（比旧版 Branch protection 更清晰），建议建两条：

### `protect-main`

- Target：`main`（默认分支）。
- 要求通过 pull request 合并；是否要求 1 个 approval 取决于是否有第二维护者——单人仓库可设为 0，但**必须**勾选 required status checks。
- Required checks：`自检 / selftest (22)` 与 `自检 / selftest (24)`（对应 `selftest.yml` 的 Node 22/24 矩阵；名称以 Actions 页面实际显示为准，需人工确认）。
- 阻止 force push、阻止删除分支。
- 要求对话解决（Require conversation resolution）后再合并。
- 允许 bypass：仅仓库 owner，且明确知道在做什么时使用；日常不要绕过。

### `protect-release-tags`

- Target：tag 模式 `v*`。
- 阻止删除、阻止更新（移动/强推）已存在的 tag。
- 不设常规 bypass；确需重打 tag 时由 owner 临时停用，见 [docs/RELEASING.md](RELEASING.md) 的失败恢复。
- 注意：启用后“删除 tag 再重打”会被拒绝，这正是发版流程假设的行为。

如果同时保留旧版 Branch protection 与 Rulesets，请确认两者规则不冲突；以 Rulesets 为准时，删除旧规则。

## 合并与发布

- **Merge 方式**：只保留 `Squash merging`，关闭 merge commit 与 rebase merging，保持 `main` 线性、每个 PR 一个提交。
- **Automatically delete head branches**：开启。
- **Allow auto-merge**：开启（Dependabot PR 在「自检」通过后由 `auto-merge.yml` squash 合并；该 workflow 只处理 `dependabot[bot]` 的 PR）。
- **Releases → Enable immutable releases**（若仓库可见此选项）：建议开启，防止已发布附件被替换；开启后发版前检查要更严格，因为修正只能靠发新版本。
- **Releases → latest**：保持由 GitHub 自动指向最新非预发布 Release；发版 workflow 会校验 latest 指向当前 tag。
- **Tag 保护**：见上一节 `protect-release-tags`。

## Security

建议在 **Settings → Security** 人工确认：

- **Dependabot alerts**：开启。
- **Dependabot security updates**：开启（本仓库只有 GitHub Actions 依赖，`.github/dependabot.yml` 已按周检查并分组）。
- **Code scanning（CodeQL default setup）**：可开启，语言选 JavaScript；本仓库没有构建步骤，若默认扫描不识别 `.user.js`，不必强求，以 `npm run ci` 的静态检查为准。
- **Secret scanning**：公开仓库建议开启；**Push protection** 一并开启。
- **Private vulnerability reporting**：开启。`SECURITY.md` 承诺通过 Security → Report a vulnerability 私密报告，若该功能未开启，这个入口不存在，需人工确认。
- **Security policy**：确认指向 `SECURITY.md`，并在仓库首页显示。

## 社区与协作

- **Issue 模板**：仓库已有 `.github/ISSUE_TEMPLATE/bug_report.yml` 与 `config.yml`；`config.yml` 已关闭空白 issue，并把使用问题引导到 Discussions、安全问题引导到私密报告。开启 Issues 后请在新建 issue 页面确认模板生效。
- **Discussions**：若开启，建议至少建 `Q&A`（使用求助）与 `Announcements`（版本通知）两个分类，并在 [SUPPORT.md](../SUPPORT.md) 中保持链接一致。
- **CODEOWNERS**：仓库已有 `.github/CODEOWNERS`（`* @Gnayiel`），开启 “Require review from Code Owners” 前确认 owner 账号可接收通知。
- **PR 模板**：`.github/pull_request_template.md` 已存在；可在 Rulesets 里要求 PR 描述非空（GitHub 无原生校验时，靠评审把关）。
- **Wiki / Projects**：见基本信息，建议关闭，避免文档分叉。

## 可选：用 `gh` 核对（不代替网页确认）

以下命令只读/示例，**执行前先确认本机已安装并登录 `gh`**（`gh auth status`）。本仓库当前环境未安装 `gh`，不应假设可直接运行。

```bash
# 查看仓库描述与 topics（只读）
gh repo view Gnayiel/faxuanyun-legal-exam-assistant --json description,repositoryTopics,homepageUrl

# 修改描述与补充 topic（会改线上设置，需 owner 执行）
gh repo edit Gnayiel/faxuanyun-legal-exam-assistant \
  --description "甘肃省国家工作人员学法考试平台（法宣在线）Tampermonkey 用户脚本：本地题库 + AI/百度多源 + 自动答题与成绩对账" \
  --add-topic tampermonkey,userscript,faxuanyun,legal-exam,gansu,automation,javascript

# 查看已有 rulesets（只读；具体规则仍以网页为准）
gh api repos/Gnayiel/faxuanyun-legal-exam-assistant/rulesets

# 查看 Actions 默认权限（只读）
gh api repos/Gnayiel/faxuanyun-legal-exam-assistant/actions/permissions
```

社交预览图、Discussions 分类、immutable releases 等设置通常只能在网页操作；命令失败不代表设置有问题，以网页实际状态为准。

## 与文档的对应关系

| 设置 | 影响 | 相关文档 |
| --- | --- | --- |
| `protect-main` + required checks | 未过门禁的代码不能进 main | [docs/DEVELOPMENT.md](DEVELOPMENT.md) 的统一门禁 |
| `protect-release-tags` | 已推 tag 不能删/改指向 | [docs/RELEASING.md](RELEASING.md) 的失败恢复 |
| Actions 默认只读 | workflow 必须显式声明权限 | [docs/RELEASING.md](RELEASING.md) |
| Private vulnerability reporting | `SECURITY.md` 的私密报告入口可用 | [SECURITY.md](../SECURITY.md) |
| Discussions | 使用求助的主渠道 | [SUPPORT.md](../SUPPORT.md) |
| Immutable releases | 发布后附件不可覆盖 | [docs/RELEASING.md](RELEASING.md) 的回滚策略 |
