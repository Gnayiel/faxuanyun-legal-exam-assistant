# 文档索引

本目录存放维护者与贡献者需要长期参考的文档。普通使用者先看仓库根目录的 [README.md](../README.md)；想直接安装，跳到 README 的「安装」章节即可。

## 从哪里开始

| 文档 | 面向 | 内容 |
| --- | --- | --- |
| [README.md](../README.md) | 使用者 | 功能特性、安装与升级、使用说明、答案优先级、导入导出、数据与隐私、常见问题 |
| [docs/ARCHITECTURE.md](ARCHITECTURE.md) | 维护者 / 想改代码的人 | 运行时架构、模块划分、数据流、存储与跨页同步、AI/百度的调用与降级 |
| [docs/DEVELOPMENT.md](DEVELOPMENT.md) | 贡献者 / 维护者 | 开发环境、目录结构、第一次跑、命令表、统一门禁、测试分层、加断言与 fixture、调试、代码约定、真机回归、文档配图 |
| [docs/RELEASING.md](RELEASING.md) | 发版维护者 | 版本号来源与副本、发布前检查、本地发版流程、`release.yml`、更新链、失败恢复、发布后验证、回滚、仓库保护依赖 |
| [docs/REPOSITORY_SETTINGS.md](REPOSITORY_SETTINGS.md) | 仓库管理员 | GitHub 描述/topics/社交预览、Discussions/Wiki、Actions 权限、rulesets、required checks、Security、Releases（全部为建议，需人工确认） |
| [docs/IMAGE_PIPELINE.md](IMAGE_PIPELINE.md) | 维护者 | `docs/panel.webp` 与社交预览图的生成方式、字体与 `ffmpeg` 依赖、版本号/自检数的同步 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 贡献者 | 贡献流程、如何提 issue/PR、代码约定、测试要求、报告问题、发版入口 |
| [SUPPORT.md](../SUPPORT.md) | 使用者 | 求助渠道、提问前自查、提问需要附带的材料、响应预期 |
| [SECURITY.md](../SECURITY.md) | 报告安全问题的人 | 支持范围、私密报告入口、响应时限、披露约定 |
| [CHANGELOG.md](../CHANGELOG.md) | 所有人 | 每个版本的变更分类与验证方式；版本号以用户脚本头部 `@version` 为准 |
| [docs/CHANGELOG-archive.md](CHANGELOG-archive.md) | 所有人 | v2.0.0 – v2.0.14 的历史更新记录归档 |

补充材料：

- [tests/README.md](../tests/README.md)：测试目录说明、测试分层概览与断言数同步点。
- [data/README.md](../data/README.md)：题库快照的命名、字段、导入导出与隐私注意事项。

## 文档维护约定

- **数字要同步**：README 徽章、CHANGELOG、脚本内注释、`tests/README.md` 与 [docs/DEVELOPMENT.md](DEVELOPMENT.md) 里的自检/冒烟数字必须一致；改断言数时按 DEVELOPMENT 的「测试分层」清单逐处更新。
- **相对链接必须能打开**：本地文档之间用相对路径（如 `DEVELOPMENT.md`、`../SECURITY.md`），不要写死分支或提交 URL；`node tools/check-docs.mjs` 会检查文件是否存在、`.md` 锚点是否存在。
- **命令按最终结构写**：测试脚本在 `tests/`，构建/检查工具在 `tools/`；门禁命令以 `package.json` 的 scripts 为准，不要手抄旧路径。
- **设置类内容标注状态**：GitHub 网页设置无法由代码保证，涉及仓库设置时写“建议/需人工确认”，不要声称已经配置。
- **图片改动走生成脚本**：不要手工替换 `docs/*.webp`；按 [docs/IMAGE_PIPELINE.md](IMAGE_PIPELINE.md) 用 `npm run docs:images` 重新生成并检查。
