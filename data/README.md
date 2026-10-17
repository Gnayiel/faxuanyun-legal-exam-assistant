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
**随仓库分发的那一份**用显式 `!` 规则单独放行：

- `data/faxuanyun-legal-exam-bank-20261017.csv`
- `data/faxuanyun-legal-exam-bank-20261017.json`

想再放一份进仓库，就在 `.gitignore` 里照着加一行 `!data/你的文件名`。

## 关于本次随附的快照

2026-10-17 那一份是仓库首次公开时附带的题库：**208 题**（单选 68 / 多选 34 / 判断 106），
另有 1 条错误记录（`wrong`）。

它的 JSON 里 `"version": "2.11.0"` 是**导出时的脚本版本号**，属于历史事实：
那次导出发生在仓库把版本号从 `2.11.0` 重新起算为 `1.x` 之前。这个字段只作溯源用，
导入时脚本不看它，不影响兼容性。

> 题库里的答案是答题过程中累积下来的，**不保证正确**。脚本本身有自我纠错：
> 交卷判定答错会删掉库里记错的答案，判定答对会修正并累加答对次数。

## 导入方式

面板「题库与本场 → 导入答案库」，选 `.csv` 或 `.json` 都行。
导入时**库内已有的用户手改答案不会被脚本答案覆盖**，冲突只记数。
