# data/ — 题库快照

这个目录放**答案库快照**。脚本面板上的「导出答案库」一次给两个文件，
它们共用同一个日期戳、内容一一对应，可以整对丢进这里归档。

## 文件命名

| 文件 | 说明 |
|---|---|
| `faxuanyun-legal-exam-bank-<YYYYMMDD>.csv` | 六列 `序号,题型,题目,正确答案,错误选项,来源`，UTF-8 **带 BOM** + CRLF，Excel 双击不乱码；给人看、方便 diff |
| `faxuanyun-legal-exam-bank-<YYYYMMDD>.json` | 字段完整的备份（`q/t/s/a/l/src/by/ts/us/hit/ok/bad/cft` 一个不少），导入可无损往返；**换电脑请用它** |
| `faxuanyun-legal-exam-log-<YYYYMMDD>-<HHMMSS>.txt` | 导出的面板日志，按时间戳命名 |

> **v2.0.0 起导出前缀改为 `faxuanyun-legal-exam-*`**（题库 `faxuanyun-legal-exam-bank-*`、
> 日志 `faxuanyun-legal-exam-log-*`），随仓库分发的题库快照一并改名。
> v1.x 时期导出的旧前缀文件（`faxuanyun-answer-bank-*` / `faxuanyun-exam-log-*`）
> 仍按原样忽略，不会被误提交。

日期与时间一律取**本机本地时间**（不是 UTC），所以东八区凌晨导出不会退回前一天。
同一天导出第二次时，浏览器会自动给后一个文件加 `(1)` 后缀，两次快照都留着，不会互相覆盖。

## 哪些会被提交

`.gitignore` 默认忽略所有 `faxuanyun-legal-exam-bank-*.{csv,json}` 与 `faxuanyun-legal-exam-log-*.txt`
（那是你自己的数据；v1.x 的旧前缀 `faxuanyun-answer-bank-*` / `faxuanyun-exam-log-*` 同样继续忽略）。
**随仓库分发的那一份**按命名规则自动放行（`.gitignore` 里是
`!data/faxuanyun-legal-exam-bank-*.csv` / `!data/faxuanyun-legal-exam-bank-*.json` 两条通配）：

- `data/faxuanyun-legal-exam-bank-20261020.csv`
- `data/faxuanyun-legal-exam-bank-20261020.json`

仓库**只保留一份快照**（`tools/check-data.mjs` 发现第二份会直接报错）：换题库时用新日期戳的一对文件
替换旧的两个文件即可，不用再改 `.gitignore`；旧版本留在 git 历史里。

## 机器可校验的格式

`data/bank.schema.json` 是这份 JSON 的 [JSON Schema](https://json-schema.org/)（draft-07）：
字段类型、必填项、题型枚举、`bank` / `wrong` 里每条记录的形态都写在里面。想自己生成 / 校验题库的人可以直接拿它，
`tools/check-data.mjs` 也用**同一份** schema 校验仓库随附的快照，所以「文档写的格式」和「文件实际的格式」
不会各走各的。

顶层字段：`format`（固定 `faxuanyun-legal-exam-bank`，导入时不校验它）、`schema`（数据结构版本，当前为 `2`）、
`version`（导出时的脚本 `@version`，仅作溯源）、`exportedAt`（导出时间，UTC 的 ISO 8601 字符串）、
`count`（题库条数）、`bank`（题库）、`wrong`（错题记录，没有错题时为 `{}`）。

`bank` 里的每条记录：

| 字段 | 含义 |
|---|---|
| `q` | 完整题干 |
| `t` | 题型：`single` / `multi` / `judge` |
| `s` | 科目名（仓库快照里是「学法考试」或「甘肃省国家工作人员学法考试」） |
| `a` | 正确答案的**选项内容**数组（如 `["中国特色社会主义"]`；判断题是 `["对"]` / `["错"]`）。只有字母答案的旧数据为 `null` |
| `l` | 正确答案**字母**，与 `a` 逐项对应（`a` 非 `null` 时 `l.length === a.length`；判断题 对/错 对应 A/B，兼容旧数据的 1/0） |
| `src` | 答案来源：`exam` / `import` / `legacy` / `user` 等 |
| `by` | 记录者；`user` 表示用户手改过答案（导入时优先级最高） |
| `ts` / `us` | 首次入库 / 最近使用时间戳（毫秒） |
| `hit` / `ok` / `bad` | 命中 / 验证答对 / 答错次数 |
| `cft` | 答案冲突次数（累计值，不是置信度） |

`wrong` 里每条记录是 `{q, w, tried}`：`q` 是题干，`w` 是答错时累计的错误选项内容，
`tried` 是已失败的多选组合文本（如 `A+B`）；它和 `bank` 使用同一套题干指纹做键。

## 关于本次随附的快照

2026-10-20 那一份是当前随仓库分发的题库：**299 题**（单选 90 / 多选 59 / 判断 150），
没有错误记录（`wrong` 为空；导出文件里若带错题，提交前会按仓库规则移除）。

它的 JSON 里 `"version": "2.0.7"` 是**导出时的脚本版本号**（2026-10-20 导出）。
这个字段只作溯源用，导入时脚本不看它，不影响兼容性。

> 上一份快照是 2026-10-17 的 300 题（单选 96 / 多选 54 / 判断 150），已被本份替换；历史可在 git 记录里查看。

> 这份快照**不会随每个版本自动更新**：题库有实质变化时，维护者会用面板重新导出、按上面的命名规则替换或新增，
> 并在 CHANGELOG 里说明。想自己整理一份题库，请按 [CONTRIBUTING.md](../CONTRIBUTING.md) 的「题库快照维护」操作。

> 题库里的答案是答题过程中累积下来的，**不保证正确**。脚本本身有自我纠错：
> 交卷判定答错会删掉库里记错的答案，判定答对会修正并累加答对次数。

## 导入方式

面板「题库与本场 → 导入答案库」，选 `.csv` 或 `.json` 都行。
导入时**库内已有的用户手改答案不会被脚本答案覆盖**，冲突只记数。

## 合并多份快照

手上有多台电脑、多份导出的题库时，可以用 `node tools/merge-bank.mjs a.json b.csv -o merged.json` 合成一份：
同一题自动去重、用户手改答案优先、脚本答案冲突保留较新的并累加冲突次数、错题记录取并集；重复合并结果幂等。
合并出的 `.json` 可以直接从面板导入。
