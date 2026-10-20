# 贡献指南

感谢愿意一起维护这个项目。先说明：这是一个个人学习项目，维护精力有限，issue / PR 会尽量看，但不保证响应时间。

## 适合提交什么

- **平台改版导致的选择器失配**（最优先）
- 脚本 bug、浏览器 / 油猴兼容性问题
- 文档错误、题库快照问题
- 新功能：先开 issue 讨论方向，避免做完才发现方向不对

## 开发环境

- Node.js ≥ 20（CI 用 22 LTS；工具脚本只用到 Node 内置模块，**没有任何 npm 依赖**）
- Edge / Chrome / Chromium 任一（面板冒烟测试用；可用 `FX_BROWSER` 指定可执行路径）
- 不需要构建：改完 `faxuanyun-legal-exam-assistant.user.js`，重新装到油猴里刷新页面即可

## 本地验证（提交前必跑）

```bash
node tools/selftest.mjs                      # 元数据 + 179 项内置断言 + 文档数字校验，不联网
node tools/check-workflows.mjs               # GitHub Actions 配置静态检查（pin SHA / 权限 / 脚本路径）
node tools/release.mjs --dry-run             # 本地发版助手：版本与 CHANGELOG 校验 + 跑测试 + 打 tag 预演
node tools/check-data.mjs                    # 题库快照与 README / data/README 的数字是否一致
node tools/merge-bank.mjs data/*.json -o /tmp/merged.json   # 题库合并工具冒烟（幂等）
node tools/panel-smoke.mjs --require-browser # 真实浏览器面板冒烟（40 项）
node tools/page-smoke.mjs --require-browser  # 真实浏览器页面适配冒烟（72 项）
```

- 两种浏览器冒烟共用 `tools/browser.mjs` 探测浏览器（`FX_BROWSER` → 常见安装路径 → PATH，Windows 也支持），
  找不到浏览器时默认**跳过**（退出码 0）；加 `--require-browser`（或设 `FX_REQUIRE_BROWSER=1`）则改为失败——
  CI 用的就是强制模式，防止「没装浏览器 → 静默跳过 → 假绿」。
- `selftest.mjs` 会校验 README / CHANGELOG / 脚本注释里写死的自检断言数、page-smoke 断言数与 README 版本徽章是否与 `@version` 一致。
  改了这些数字必须同步，否则测试会直接指出缺哪个字符串；它还会校验 `@updateURL` / `@downloadURL` 是否为 `main`
  分支的完整 https 直链，以及用户脚本体积不超过 512 KB。
- 手动冒烟：装脚本 → 打开任意 `*.faxuanyun.com` 页面 → 面板能建起来、按钮与快捷键正常。

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
   要先改代码 / 文档再重打 tag；发布后回读校验失败（附件数 / SHA256 不一致）时 Release 其实已经建好，修好原因后
   直接在 Actions 里重跑本 workflow 即可，附件会用 `--clobber` 覆盖，**不需要**删 tag 重打。只有 tag 本身打错时，才需要先临时停用 `protect-release-tags` ruleset、删除后重打，打完记得重新启用（平时 `v*` tag 受保护，删不掉是正常的）。
7. **只升不降**：不要发布比已在线版本更低的 `@version`（油猴不会降级到旧版）；某版有问题时，改代码后发一个
   **更高**的版本修正，不要删除或重打已经推送的 tag（`protect-release-tags` 规则集会直接拦截）——Release 附件与 SHA256 是按 tag 固化的，删 tag 会让
   已下载的用户对不上版本。
8. 发布后自查：浏览器打开 `@updateURL` 指向的 raw 文件确认新 `@version`；或留一个旧版装油猴点「检查更新」，验证自动更新链路（raw 走 CDN，可能需要等几分钟）。
   CI 也会自动核对远端 `@updateURL` 的 `@version` 与 latest tag；如果刚推完 tag 就红，多半是 CDN 延迟，重跑即可。

## 报告问题

- 普通 bug / 功能建议：用仓库的 issue 模板
- 安全问题、泄露的 Key：走 [SECURITY.md](SECURITY.md)，不要公开贴
- 参与讨论请遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
