## 改动内容

（一句话说明改了什么、为什么改）

## 验证

- [ ] `node tools/selftest.mjs` 全部通过
- [ ] `node tools/panel-smoke.mjs --require-browser` 全部通过（本机没有 Edge/Chrome 时 CI 会跑）
- [ ] 改动只落在该改的层（平台改版相关改动限制在「站点适配层」）
- [ ] 没有提交 API Key、带日期的题库导出、日志或其它个人数据
- [ ] 如果改了自检断言数，README / CHANGELOG / 脚本头部注释已同步（`selftest.mjs` 会校验）
- [ ] 如果发版：`@version` 已 bump、`CHANGELOG.md` 已加条目、README 版本徽章已同步（`selftest.mjs` 会校验）

## 关联 issue

Closes #
