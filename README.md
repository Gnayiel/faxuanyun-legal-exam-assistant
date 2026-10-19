# 甘肃省国家工作人员学法考试平台自动答题助手

[![version](https://img.shields.io/badge/version-2.0.4-blue)](CHANGELOG.md)
[![release](https://img.shields.io/github/v/release/Gnayiel/faxuanyun-legal-exam-assistant?label=release)](https://github.com/Gnayiel/faxuanyun-legal-exam-assistant/releases/latest)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![selftest CI](https://github.com/Gnayiel/faxuanyun-legal-exam-assistant/actions/workflows/selftest.yml/badge.svg)](https://github.com/Gnayiel/faxuanyun-legal-exam-assistant/actions/workflows/selftest.yml)
[![self-test](https://img.shields.io/badge/self--test-97%20passing-success)](#开发与自检)
[![panel--smoke](https://img.shields.io/badge/panel--smoke-40%20passing-success)](#开发与自检)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-4.0%2B-black)](https://www.tampermonkey.net/)

用于 **法宣在线**（`*.faxuanyun.com`）学法考试平台的 Tampermonkey 用户脚本。
单文件、无构建、无第三方依赖：结构化题库 + 站点适配层 + AI / 百度双通道查答案 + 内置自检。

> [!WARNING]
> **本项目仅供个人学习与研究使用。** 自动答题可能违反考试平台的使用规则，
> 由此产生的一切后果由使用者自行承担。
> 脚本联网查询会访问第三方站点（百度、以及你自己配置的 AI 接口），
> 请自行遵守其服务条款与访问频率约定。

---

## 目录

- [特性](#特性)
- [安装](#安装)
- [升级到 v2.0.0](#升级到-v200)
- [更新与自动更新](#更新与自动更新)
- [使用](#使用)
- [答案优先级](#答案优先级)
- [导入 / 导出](#导入--导出)
- [数据与隐私](#数据与隐私)
- [常见问题](#常见问题)
- [开发与自检](#开发与自检)
- [已知限制](#已知限制)
- [目录结构](#目录结构)
- [贡献](#贡献)
- [许可](#许可)
- [更新记录](#更新记录)

## 特性

- **结构化题库**：以「归一化题干的指纹」为主键，题号变动、同题不同表述都能复用；
  答案优先存**选项内容**（选项乱序也能对上），同时兼容纯字母答案与判断题的 `1/0`
- **用户答案优先**：你在页面上手动改的答案会被正确归属到对应题目、**立即入库**并标记来源「用户」；
  导入答案库时，用户答案不会被脚本答案覆盖
- **自我纠错**：答错会删掉库里记错的答案并记下错误选项 / 已失败的多选组合；
  判定答对会清掉本题错题记录并修正答案
- **多源查询**：题库 → AI（OpenAI 兼容接口）→ 百度搜索；主源把握不足或是多选题时自动追加次源交叉验证，
  两源冲突且优势不足时宁可不答。面板「二源」可强制每题交叉验证；题库里冲突过的题会自动改走联网复核
- **失败分类与退避**：题干未渲染 / 选项未渲染 / 算不出答案 / 点击没生效 / 选中项没文本各有容忍次数，
  连续失败递增退避，不会一有风吹草动就整场停掉
- **考试流程控制**：自适应切题等待、最后一题识别、暂停 / 继续 / 续答、回退保护、倒计时提醒与末段提速、
  弹窗安全处理（涉及交卷 / 提交的弹窗一个按钮都不会被自动点，包括「取消」）
- **交卷后自动收尾**：成绩解析与入库流程走完后按设置自动关闭考试页（默认 8 秒，可在面板
  「题库与本场 → 关闭页」切 8 / 15 / 30 秒或关闭，倒计时中再点一下可取消）；浏览器不允许脚本关闭
  自己没打开的标签页时，日志会提示手动关闭，脚本不重复尝试
- **面板**：可拖拽、一键收起（收成一条写着自己名字的窄条）、**按钮按用途分类折叠**、分类标题带实时状态摘要、
  快捷键、Shadow DOM 隔离站点样式（面板样式不污染页面，页面样式也不会打乱面板）、日志分级与导出、题库导入导出
- **内置自检**：97 项纯函数断言，面板一键运行；不联网、不读写题库数据
- **多标签页写保护**：落盘前先读盘合并、用 3 秒短时写锁串行化两个标签页的写入，再用「墓碑」确保删除不会被旧副本搬回来
- **同场双页提醒**：同一场考试在第二个标签页打开时会提示「只留一个标签页」，避免两页记录分叉
- **手动对账兜底**：成绩页识别不出答题卡时，面板「题库与本场 → 手动对账」可按 `1-8=对, 9=错, 10=未答` 手填，照样走对账 / 写库 / 错题清理

## 安装

1. 浏览器安装 [Tampermonkey](https://www.tampermonkey.net/)（或 Violentmonkey）
2. 安装脚本，任选其一：
   - 打开原始文件地址，油猴会直接弹出安装页：
     `https://raw.githubusercontent.com/GNAYIEL/faxuanyun-legal-exam-assistant/main/faxuanyun-legal-exam-assistant.user.js`
   - **国内网络打不开 raw 时**，用 jsDelivr 镜像安装（只影响这一次安装；装好后自动更新仍走上面的原始地址）：
     `https://cdn.jsdelivr.net/gh/Gnayiel/faxuanyun-legal-exam-assistant@main/faxuanyun-legal-exam-assistant.user.js`
     ⚠️ 镜像路径**区分大小写**，请照抄 `Gnayiel`；镜像也不通时见下面两条。
   - 到 [Releases](https://github.com/Gnayiel/faxuanyun-legal-exam-assistant/releases/latest) 下载最新版本的
     `.user.js` 附件，拖进浏览器窗口安装
   - 或下载仓库里的 [`faxuanyun-legal-exam-assistant.user.js`](faxuanyun-legal-exam-assistant.user.js)，
     拖进浏览器窗口安装
3. 打开考试页面，右上角会出现控制面板

> **更新安装不会丢题库**：脚本身份由 `@name` + `@namespace` 决定，**改文件名、改仓库地址都不影响**。
> 反过来，改动 `@name` 或 `@namespace` 会被油猴当成一个新脚本，用户已存的题库会「找不到」——
> v2.0.0 就是这么一次破坏性变更，升级方式见下一节。

脚本文件名里的 `.user.js` 后缀**不要改**，这是油猴识别安装的必要条件。

装好之后不用再手动跟进：脚本头部带 `@updateURL` / `@downloadURL`，后续版本的自动更新由油猴完成，
细节见 [更新与自动更新](#更新与自动更新)。

## 升级到 v2.0.0

v2.0.0 重命名了脚本文件与导出文件前缀，属于**破坏性变更**：

| | v1.x | v2.0.0 |
|---|---|---|
| 脚本文件 | `faxuanyun-auto-exam.user.js` | `faxuanyun-legal-exam-assistant.user.js` |
| 脚本身份 `@namespace` | `http://tampermonkey.net/`（油猴默认值） | `https://github.com/GNAYIEL/faxuanyun-legal-exam-assistant` |
| 仓库 slug | `faxuanyun-auto-exam` | `faxuanyun-legal-exam-assistant` |
| 题库导出前缀 | `faxuanyun-answer-bank-*` | `faxuanyun-legal-exam-bank-*` |
| 日志导出前缀 | `faxuanyun-exam-log-*` | `faxuanyun-legal-exam-log-*` |
| 备份 JSON 的 `format` 自述 | `faxuanyun-answer-bank` | `faxuanyun-legal-exam-bank` |

`@namespace` 变了（v1.x 用的是油猴默认值 `http://tampermonkey.net/`），所以油猴把 v2.0.0 当成**全新脚本**：
不会自动继承 v1.x 的数据。升级步骤：

1. 在**旧版**面板「题库与本场」里点「导出答案库」（或「日志与自检 → 导出日志」备份日志）
2. 安装 v2.0.0
3. 在新版面板「题库与本场」里点「导入答案库」，选刚才导出的 `.json`（换电脑、跨版本都用它，字段一个不少）
4. 确认题库题数、来源标记都正常后，卸载旧版

**旧导出文件照样能导入**：导入只认「有没有 `bank` 容器 / 是不是一张题干字典」，
**不校验 `format` 的取值**，所以 v1.x 导出的文件名和 `format` 旧值都不影响导入。
真正标识数据结构版本的是 `schema` 字段（当前为 `2`）。

## 更新与自动更新

脚本头部已经写好 `@updateURL` / `@downloadURL`，都指向本仓库 `main` 分支上的这个
`faxuanyun-legal-exam-assistant.user.js`。**用户装好一版之后不需要再做任何事**，后续版本由油猴自动更新。

### 用户侧：油猴怎么更新

- **自动检查**：油猴在后台按自己的检查间隔（可在油猴设置里调整）请求 `@updateURL`，
  读取远端的 `@version` 并与本地比较；远端更高时按 `@downloadURL` 下载新脚本并替换旧脚本。
  已经打开的页面不会热替换，刷新页面或下次打开就会跑新版本。
- **手动检查**：油猴管理面板 →「已安装脚本」页点「检查更新」；
  Violentmonkey 在脚本列表 / 脚本详情页点「更新」。装好后列表里的版本号会变成新版。
- **数据不丢**：更新是「同一个脚本」的原地替换，身份由 `@name` + `@namespace` 决定，
  题库、错题记录、AI 设置、面板位置都保留。只有改 `@name` / `@namespace` 才会被当成新脚本
  （v2.0.0 就是这么一次，迁移见上一节）。
- **更新失败的兜底**：`raw.githubusercontent.com` 在部分网络（尤其国内）下可能连不上，
  自动检查会静默失败（不会损坏数据）。可以开代理后重试；也可以到
  [Releases](https://github.com/Gnayiel/faxuanyun-legal-exam-assistant/releases/latest) 下载该版本的
  `.user.js` 附件，或直接下载仓库里的文件，拖进浏览器窗口安装——
  同一脚本的新版本会覆盖旧版本，效果与自动更新一致，数据同样不丢。

### 维护者：每次发版的固定动作

自动更新要生效，只取决于三件事：**仓库公开**、**`@version` 递增**、**文件路径不变**。

1. 把脚本头部的 `@version` 改成**严格大于**上一版的值（`x.y.z`，如 `2.0.0 → 2.0.1`）。
   油猴比较的是版本号而不是文件内容：**内容改了但版本号没改，用户永远收不到这次更新**。
2. 把改动写进 [`CHANGELOG.md`](CHANGELOG.md)，同步 README 里的版本徽章与写死的断言数
   （断言数忘了同步，`node tools/selftest.mjs` 会直接报错）。
3. 提交并 `git push` 到 `main`。更新检查只认 `@updateURL` 指向的 `main` 分支原始文件，
   **和发不发 GitHub Release 无关**；Release / `tag` 只是里程碑记录，可选。
4. 发布后自查：浏览器打开
   `https://raw.githubusercontent.com/GNAYIEL/faxuanyun-legal-exam-assistant/main/faxuanyun-legal-exam-assistant.user.js`，
   确认看到新的 `@version`；或留一个旧版装着，点油猴「检查更新」看是否升到新版。
   如果看到的还是旧版，等几分钟——`raw.githubusercontent.com` 走 CDN 缓存，不会立刻生效。

> **不要动** `.user.js` 文件名、`@name`、`@namespace`、`@downloadURL`、`@updateURL`：
> 文件名或 URL 变了，老用户就找不到更新源；`@name` / `@namespace` 变了，油猴会当成另一个脚本。
> 只改 README / CHANGELOG / `data/` 的提交不必递增 `@version`。

仓库必须是**公开**仓库：私有仓库的 `raw.githubusercontent.com` 匿名取不到，用户端的更新检查会 404。

## 使用

### 面板

顶栏是**常驻**的，不随分类收起；其余按钮按用途分成 4 类，**点分类标题才展开**同类按钮
（默认收起，展开状态会记住）。

| 区域 | 说明 |
|---|---|
| 开始 / 停止 | 常驻顶栏。停止后再点「开始」会从当前题接着答，已答过的题不重答 |
| 暂停 / 继续 | 常驻顶栏。暂停期间不会再去点页面；继续后从原位置接着走 |
| 收起 / 展开 | 常驻顶栏。一个按钮：收成一条写着自己名字的窄条（还能拖动），再点一下还原 |
| **答题模式与节奏** | AI智能 / 百度搜索（选主查询通道，另一条作为备源）；二源（默认关，打开后每题都追加第二个来源交叉验证）；节奏（慢速 3~6 秒 / 标准 1~3 秒 / 快速 0.3~0.8 秒）；交卷（手动默认，答完只提示 ／ 自动，需谨慎）；调试（输出更详细的日志）。摘要显示当前模式与节奏 |
| **接口设置** | AI 设置（接口地址 / API Key / 模型名，保存前逐项校验）；「Key 仅本次会话」勾选后 Key 不落盘（刷新后需重填）；测试连接。摘要显示接口是否已配置 |
| **题库与本场** | 导出 / 导入答案库（见 [导入 / 导出](#导入--导出)）；解析成绩（交卷后手动再解析一次）；手动对账（答题卡识别不出时按 `题号=对/错/未答` 手填，走同一套入库流程）；关闭页（成绩解析/入库完成后自动关闭本页的秒数，默认 8 秒，可切 8/15/30/不关，倒计时中再点一下取消）；清空本场（丢弃本场记录）。摘要显示题库题数与已答数 |
| **日志与自检** | 清空 / 复制 / 导出日志（最多留 300 行）；自检（跑内置断言）。摘要显示日志行数 |

收起时分类标题右侧的摘要是活的：切模式、改节奏、答了几题、写了几行日志都会即时刷新，
不展开也能看到关键状态；展开后摘要让位给按钮（按钮自己带状态）。
分类标题支持鼠标点击，也支持键盘 `Enter` / 空格。

面板整体可拖拽，位置会记住；拖动后如果超出视口，缩放窗口时会自动拉回可见范围。

### 快捷键

| 快捷键 | 作用 |
|---|---|
| `Alt + S` | 开始 / 停止 |
| `Alt + P` | 暂停 / 继续 |
| `Alt + H` | 收起 / 展开面板（等同顶栏那个按钮） |
| `Alt + L` | 清空日志 |
| `Alt + E` | 导出日志 |
| `Alt + D` | 开关调试 |
| `Alt + T` | 运行自检 |

在输入框里打字时快捷键不会触发。收起面板分类不影响快捷键（按钮仍在 DOM 里）。
判键用的是物理键位（`KeyboardEvent.code`），所以在非拉丁输入法或 macOS 上也不会静默失效。

### AI 接口配置

- 在面板「接口设置」里点「AI 设置」，填 OpenAI 兼容的接口地址
  （形如 `https://api.deepseek.com/v1/chat/completions`）、API Key、模型名
- 内置 `@connect` 白名单：`www.baidu.com`、`api.deepseek.com`、`api.openai.com`、
  `dashscope.aliyuncs.com`、`open.bigmodel.cn`、`api.moonshot.cn`、`api.siliconflow.cn`、
  `ark.cn-beijing.volces.com`
- 用其它服务时，需要在脚本头部补一行 `// @connect 你的域名`；保存设置时脚本会检测并提示你要补哪一行、
  （`tools/selftest.mjs` 也会校验这份白名单与脚本里的 `CONNECT_HOSTS` 常量一一对应）

## 答案优先级

| 来源 | 优先级 | 说明 |
|---|---|---|
| 用户手动答案（`by='user'`） | 最高 | 你在页面上改的答案立即入库并标记「用户」 |
| 交卷判定答对 | 高 | 已被验证的正确值，写库时覆盖旧值（**不论旧值来自谁**） |
| 导入的脚本答案 | 低 | 不会覆盖库内已有的用户答案，只记为冲突 |

导出 CSV 的「来源」列会写明每条是「用户」还是「脚本」，导入时据此还原优先级。

## 导入 / 导出

**导出**一次给两个文件，文件名统一为 `faxuanyun-legal-exam-bank-<日期>`
（如导出于 2026-10-17 就是 `faxuanyun-legal-exam-bank-20261017.*`，两个文件共用同一个日期戳，按天归档）：

- `faxuanyun-legal-exam-bank-20261017.csv` —— 六列 `序号,题型,题目,正确答案,错误选项,来源`，
  带 UTF-8 BOM + CRLF，Excel 双击不乱码
- `faxuanyun-legal-exam-bank-20261017.json` —— 字段完整的备份，可无损往返；**换电脑、跨版本升级建议用它**

> 日期取**本机本地时间**；同一天导出第二次时，浏览器会自动加 `(1)` 之类的后缀，两次的快照都留着。
> 导出日志同理，文件名是 `faxuanyun-legal-exam-log-<日期>-<时间>.txt`。
> 命名规范的完整说明见 [`data/README.md`](data/README.md)。

**导入**支持 `.csv / .json / .txt / .tsv`：

- 自动嗅探分隔符（逗号 / Tab / 分号 / 竖线）与编码（UTF-8 / UTF-16 / GB18030 / GBK / Big5）
- 有表头按列名映射（序号 / 题型 / 题目 / 正确答案 / 错误选项 / 来源），没有表头按列数推断
- JSON 支持本脚本的完整备份（含 v1.x 导出的旧前缀文件）、`{bank, wrong}` 结构、数组形态、
  以及「一张 `{题干: 答案}` 字典」
- 注意：选项内容里自带 `;` 或 `+` 时，CSV 往返会被拆项（导出时会提示），此时以 JSON 为准

仓库 [`data/`](data/) 里随附了一份 300 题（单选 96 / 多选 54 / 判断 150，无错误记录）的题库快照，可以直接导入。

想合并多台电脑 / 多份导出的题库，用 `node tools/merge-bank.mjs a.json b.csv -o merged.json`：
同一题自动去重、用户手改答案优先、脚本答案冲突保留较新的并累加冲突次数、错题记录取并集，输出可直接导入。

## 数据与隐私

脚本使用油猴存储保存：题库、错题记录、未交卷会话、面板位置、面板收起状态与分类展开状态、AI 设置。

API Key 落盘前会做一次**异或 + Base64 混淆**——请知悉这**不是加密**：脚本是开源的，任何人都能还原。
它的目的只是不裸存，避免顺手被看到，或随存储一起导出时泄露。全程不打印 Key，导出的答案库也不包含 Key。

首次使用会弹一次使用须知，点击确认后不再提示。

脚本向哪台服务器发请求是可枚举的：脚本**主动发起**的请求只会发往上面 `@connect` 白名单里的域名（百度 + 你配置的 AI 接口），
不会回传任何遥测数据。页面上的题干会作为查询词发送给这些第三方服务。
百度结果里的「跳转链接」由百度服务端 302 到你搜索到的网页，落地域名不受本脚本控制。

脚本没有「只用题库、不联网」的独立模式，题库未命中时才会发起查询；介意的话请不要在考试中使用联网查询，或直接停止脚本。

## 常见问题

- **搜不到答案？** 这个平台的题目在公网**不容易搜到、但不是完全搜不到**；百度通道只能拿到服务端返回的
  HTML，**无法执行页面 JS**，所以纯 JS 渲染的结果页、需要验证码的页面都取不到。命中率不高是正常现象。
- **脚本停下来了？** 连续同类失败会停手并说明原因（日志里会写「同类失败 N/M 次」）。
  展开面板「答题模式与节奏」把「调试」打开，能看到更细的过程。
- **想换台电脑？** 用导出的 `.json` 导入，字段一个不少。
- **重进同一场考试？** 脚本会恢复 3 小时内未交卷的记录并提示你；
  如果这是新一场考试，请点面板「清空本场」；已交卷的残留记录会在下次开考时自动清空，不再提示。
- **交卷后解析不出对错？** 先确认已经停在成绩页；有的版本答题卡默认收起，点开「查看答题卡 / 查看解析」后
  脚本会自动再解析一次。仍失败就展开「答题模式与节奏」打开「调试」，再点「解析成绩」，
  用 `Alt + E` 导出日志反馈——日志里会写明扫描了多少元素、图例拿到了什么颜色、页面上有哪些入口。
  实在识别不出来时，用面板「题库与本场 → 手动对账」按 `1-8=对, 9=错, 10=未答` 手填，脚本会走同一套入库流程。
  另外 v2.0.2 起，交卷后退回「选择考试」列表页不会再被误判成成绩页空转解析（旧版会红字提示「确认停在结果页」）。
- **页面改版了？** 优先只改脚本里的「站点适配层」`SEL` / `BTN` 两组选择器，其余逻辑不用动。
  脚本顶部的「文件结构」注释列出了 13 个章节的位置。
- **从 v1.x 升级后题库是空的？** 这是预期行为（`@namespace` 变了），按
  [升级到 v2.0.0](#升级到-v200) 用 `.json` 导入一次即可。

## 开发与自检

单文件、纯前端、**无构建步骤**，改完直接安装即可。验证命令都不需要安装依赖：

```bash
node tools/selftest.mjs                      # 校验 @-metadata + 跑脚本内置的 97 项断言，不联网
node tools/check-data.mjs                    # 题库快照与 README / data/README 的数字是否一致（--fix 可自动改）
node tools/check-workflows.mjs               # GitHub Actions 配置静态检查（action 必须 pin SHA 等）
node tools/merge-bank.mjs data/*.json -o /tmp/merged.json   # 题库合并工具冒烟（幂等）
node tools/panel-smoke.mjs --require-browser # 用真实 Chromium 内核（Edge / Chrome）建面板，40 项断言
node tools/release.mjs --dry-run             # 本地发版助手：版本/CHANGELOG 校验 + 跑测试 + 打 tag 预演
```

- `tools/selftest.mjs` 在最小 DOM / 油猴打桩下加载脚本，跑的就是面板「自检」按钮调用的同一批用例；
  它还会校验 `@-metadata` 是否完整、`@downloadURL` / `@updateURL` 是否指向仓库里真实存在的文件名、
  脚本里的 `CONNECT_HOSTS` 常量和头部 `@connect` 白名单是否一一对应、
  README 徽章 / 脚本文案里写明的断言数是否与真实用例数一致，以及 **README 版本徽章是否与 `@version` 一致**（数字和版本写死都会过期）。
- `tools/panel-smoke.mjs` 找不到浏览器时默认**跳过**（退出码 0）；
  加 `--require-browser`（或设 `FX_REQUIRE_BROWSER=1`）则直接失败，CI 用的就是强制模式，
  避免「没装浏览器 → 静默跳过 → 假绿」。也可以用 `FX_BROWSER=/path/to/chrome` 指定浏览器。
- `tools/check-data.mjs` 校验 `data/` 下最新的题库快照：JSON / CSV 成对、条数与题型分布自洽、
  且与 README / `data/README.md` 里写死的数字一致——改快照或改文档时能第一时间发现数字漂移；
  加 `--fix` 会按实测值直接改写文档里写错的数字。
- `tools/merge-bank.mjs` 是题库合并工具：把多台电脑 / 多份导出的 `.json`、`.csv` 合成一份可直接导入的 `.json`
  （规则见 [导入 / 导出](#导入--导出)）；加 `--emit-snapshot` 会按仓库约定在 `data/` 下生成成对的 JSON + CSV 快照。
- `tools/check-workflows.mjs` 对 `.github/workflows/*.yml` 做静态检查：第三方 action 必须 pin 到 40 位 commit SHA、
  必须声明 `permissions` 与 `timeout-minutes`、禁止 `pull_request_target` 检出 PR 代码、引用的本地脚本必须存在、
  发版必须由 tag 触发。
- `tools/release.mjs` 是本地发版助手：校验 `@version` 与 CHANGELOG 章节一致 → 跑自检 / 数据 / 工作流检查 → 打本地 tag，
  然后按提示 `git push origin main --tags`，由 `release.yml` 自动建 Release。
- 面板里**「自检」（`Alt + T`）**是同一批断言，失败项会逐条写进日志。
- CI：`.github/workflows/selftest.yml` 在 push 到 `main`、以及每个 PR 上跑上面的检查（也可手动触发）；
  推送 `v*` tag 时 `.github/workflows/release.yml` 自动跑同样的门禁并创建 Release、上传 `.user.js` 与同名 `.sha256`。
  环境固定为 `ubuntu-24.04` + Node 22，第三方 action 全部固定到 commit SHA，由 Dependabot 每周开 PR 升级。

改动前请留意两点：

1. 脚本只有一个版本号来源，就是头部的 `@version`（运行时读 `GM_info`），**不要在代码里另写一份版本常量**。
2. 改文件名或导出前缀时，`tools/` 里的默认脚本路径与文件名断言要同步改，否则 CI 会红。

### 真机已确认的点

题目容器 `#timucontent`、题干 `h2`、选项 `input[name="option"]`（`value` 就是 A/B/C/D）
都是第一候选命中；考试页**没有 iframe**；弹窗是 `position: fixed`（可见性判断已用
`getClientRects()` 兜底）；`body.innerText` 只有 264 字符、耗时 < 1ms。

v2.0.2 起在真实油猴环境下持续验证：成绩弹窗解析、交卷后残留会话清理、关闭页倒计时与取消、
百度 / AI 查询链路（`GM_xmlhttpRequest` 跨域 + `@connect` 白名单）、题库跨页持久化与跨电脑导入合并。
还剩两项没有真机完整走一遍：油猴「自动更新」跨版本升级链路（`@updateURL`）与多标签页同场双开。

## 已知限制

- **题库答案不保证正确**。它是答题过程中累积下来的，靠交卷判定自我纠错；
  跨电脑搬运请用 `.json`，不要用 Excel 手改 CSV（选项内容里的 `;` / `+` 会被拆项）。
- **判断题不做「相似题复用」**：判断题选项永远是「正确 / 错误」，一字之差的另一道题
  （「…一切权力属于人民」vs「…一切权力不属于人民」）相似度极高但答案相反，
  所以判断题只接受前缀等价的截断版本，其余一律走网络。
- **百度通道仍有不确定性**：查询词会出现在搜索结果里，脚本已用 `stripQueryEcho` 剔除回显并给百度结果降权
  （×0.9），但反爬页、纯 JS 渲染的结果页仍然取不到，最终把握度只能参考。
- **对账是保守的**：交卷后如果题号不可靠、两边条数又对不上，脚本**只出报告、不写题库**，
  宁可少学一条也不写错一条。
- **推断不出总题数时不会自动交卷**：为了不出现「答了 10 题就被当成答满」的提前交卷，
  题目里读不到总题数时脚本会把最后一题留给手动交卷。
- **答题卡颜色判定宁可不写**：正确 / 错误 / 未答三色接近时优先判「未答」，这一题就不入库，
  等你人工核对。
- **多标签页**：落盘有 3 秒短锁 + 读盘合并 + 墓碑，先后落盘不会互相覆盖；但同一场考试同时在两个
  标签页作答仍会产生分叉记录（脚本会检测到并提醒，建议只留一个标签页）。
- **自动关闭本页受浏览器限制**：脚本只能关闭「自己打开的」标签页；考试页是你自己点开时，
  `window.close()` 可能被浏览器拒绝。被拒绝时脚本不会反复重试，而是退回上一页
  （没有上一页就置为空白页），并在日志里说明。

## 目录结构

```
.
├── faxuanyun-legal-exam-assistant.user.js   # 用户脚本本体（.user.js 后缀是油猴识别安装所必需，勿改）
├── README.md
├── CHANGELOG.md                  # 版本更新记录
├── CONTRIBUTING.md               # 贡献与发版流程
├── SECURITY.md                   # 安全问题报告方式
├── CODE_OF_CONDUCT.md            # 行为准则
├── LICENSE                       # MIT
├── .gitignore
├── .gitattributes
├── .github/
│   ├── dependabot.yml            # 自动升级 GitHub Actions
│   ├── ISSUE_TEMPLATE/           # issue 模板（bug 报告 + 安全引导）
│   ├── pull_request_template.md  # PR 自查清单
│   └── workflows/
│       ├── selftest.yml          # CI：元数据校验 + 内置自检 + 数据/工作流检查 + 面板冒烟
│       ├── release.yml           # 推送 v* tag 时自动建 Release 并上传 .user.js + .sha256
│       └── auto-merge.yml        # Dependabot 依赖升级 PR：自检全绿后自动合并
├── data/
│   ├── README.md                 # 题库快照的命名规范与提交规则
│   ├── faxuanyun-legal-exam-bank-20261017.csv    # 随仓库分发的 300 题快照（6 列）
│   └── faxuanyun-legal-exam-bank-20261017.json   # 同上，字段完整版
└── tools/
    ├── selftest.mjs              # 无依赖自检（元数据 + 97 项断言）
    ├── check-data.mjs            # 题库快照与文档数字一致性校验（--fix 可自动修）
    ├── merge-bank.mjs            # 多份题库导出合并（--emit-snapshot 生成 data/ 快照）
    ├── check-workflows.mjs       # GitHub Actions 配置静态检查
    ├── release.mjs               # 本地发版助手（校验 → 测试 → 打 tag）
    └── panel-smoke.mjs           # 真实浏览器面板冒烟测试（40 项），CI 用强制模式
```

从面板「导出答案库」拿到的文件按日期命名，可以直接放进 `data/` 归档；
这类带日期的快照默认被 `.gitignore` 排除，不会误提交——
只有随仓库分发的那一份用 `!` 规则显式放行，规则见 [`data/README.md`](data/README.md)。

## 贡献

- 报 bug / 提需求请用 [issue 模板](.github/ISSUE_TEMPLATE/bug_report.yml)，附上浏览器与油猴版本、脚本 `@version`、面板日志（`Alt + E` 导出）
- 提交代码前请本地跑通上面两条测试命令；完整约定、代码风格、发版流程见 [CONTRIBUTING.md](CONTRIBUTING.md)
- 平台改版导致选择器失配时，改动范围应限制在「站点适配层」，不要在业务逻辑里散落新的选择器
- 版本号只在 `@version` 里改，同时把改动写进 [`CHANGELOG.md`](CHANGELOG.md)
- 安全问题（含泄露的 API Key）请按 [SECURITY.md](SECURITY.md) 私下报告，**不要**公开贴；参与讨论请遵守 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## 许可

[MIT](LICENSE)

## 更新记录

当前版本 **v2.0.4**（2026-10-19）：成绩对账逻辑抽成可单测的纯函数、手动对账兜底、同场双页检测、AI Key 仅会话、维护与发版工具补全

- 新增：面板「手动对账」（答题卡识别不出时按 `题号=对/错/未答` 手填，走同一套对账入库）
- 新增：同场双页检测（第二个标签页打开同一场考试时提醒只留一个）；AI Key「仅本次会话」选项（不落盘）
- 新增：`tools/check-workflows.mjs` 工作流静态检查、`tools/release.mjs` 本地发版助手；Dependabot PR 自检全绿后自动合并
- 增强：`check-data.mjs --fix` 自动修正文档数字；`merge-bank.mjs --emit-snapshot` 直接生成 `data/` 成对快照；Release 说明附 SHA256
- 优化：对账逻辑抽成 `planResultActions()` 纯函数，题号/顺序映射与「未标对=答错」兜底全部纳入自检
- 同步：自检断言 83 → 97，面板冒烟 37 → 40；已知限制与真机验证章节按实现更新

完整清单见 [CHANGELOG.md](CHANGELOG.md)。
