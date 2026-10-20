// ==UserScript==
// @name         甘肃省国家工作人员学法考试平台自动答题助手
// @namespace    https://github.com/GNAYIEL/faxuanyun-legal-exam-assistant
// @version      2.0.7
// @description  甘肃省国家工作人员学法考试平台（法宣在线）自动答题助手：结构化题库 + 站点适配层 + AI / 百度双通道查答案，含 174 项内置自检
// @author       GNAYIEL
// @license      MIT
// @match        *://gs.faxuanyun.com/*
// @match        *://*.faxuanyun.com/*
// @noframes
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_addValueChangeListener
// @grant        GM_info
// @connect      www.baidu.com
// @connect      api.deepseek.com
// @connect      api.openai.com
// @connect      dashscope.aliyuncs.com
// @connect      open.bigmodel.cn
// @connect      api.moonshot.cn
// @connect      api.siliconflow.cn
// @connect      ark.cn-beijing.volces.com
// @homepageURL  https://github.com/GNAYIEL/faxuanyun-legal-exam-assistant
// @supportURL   https://github.com/GNAYIEL/faxuanyun-legal-exam-assistant/issues
// @downloadURL  https://raw.githubusercontent.com/GNAYIEL/faxuanyun-legal-exam-assistant/main/faxuanyun-legal-exam-assistant.user.js
// @updateURL    https://raw.githubusercontent.com/GNAYIEL/faxuanyun-legal-exam-assistant/main/faxuanyun-legal-exam-assistant.user.js
// ==/UserScript==

/*
 * 甘肃省国家工作人员学法考试平台（简称「法宣在线」）自动答题助手
 *
 * 单文件、无构建、无第三方依赖。题库 + 站点适配层 + AI / 百度双通道查答案 + 内置自检。
 *
 * ------------------------------------------------------------------ 使用说明
 *
 * 1) AI 模式：在面板「接口设置 → AI 设置」里填接口地址、API Key 与模型名，点「保存」落盘，再用「测试连接」验证一次。
 * 2) 用下面 @connect 列表之外的 AI 服务时，请在本文件顶部按同样格式补一行：// @connect 你的接口域名
 *    （保存设置时脚本会比对这份名单，并直接告诉你该补哪一行。）
 * 3) 自动更新已配好：@homepageURL / @supportURL / @downloadURL / @updateURL 都指向本仓库，
 *    油猴会按 @version 自动检查并升级，普通用户不需要改任何一行。
 *    只有「自己 fork 改脚本」的人才需要把这四行换成自己的仓库（改这四行不影响脚本身份，
 *    已存的题库不会丢）；别人用的版本不要动，改了反而收不到更新。
 *
 * ------------------------------------------------------------------ 升级须知
 *
 * 【v2.0.0 是破坏性变更】@namespace 在这一版改了（v1.x 用的是油猴默认值 http://tampermonkey.net/，
 *   现在是本仓库地址），油猴会把它当成一个全新的脚本：
 *   装上 v2.0.0 不会自动继承 v1.x 的题库与设置。请在升级前先在旧版面板点「导出答案库」，
 *   装好新版后再「导入答案库」；确认无误后卸载旧版即可。导出文件前缀也从
 *   faxuanyun-answer-bank 改成了 faxuanyun-legal-exam-bank，但导入不挑文件名，旧文件照样能读。
 *
 * 【此后不要轻易改 @name 与 @namespace】油猴靠这两项识别「这是同一个脚本」。改了会被当成
 *   新脚本安装，用户已存的题库、错题记录、AI 设置都会对不上。换文件名、换仓库地址都不影响身份。
 *
 * ------------------------------------------------------------------ 平台改版怎么办
 *
 *   优先只改下面「站点适配层 SEL / BTN」里的选择器清单，其余逻辑无需改动。
 *
 * ------------------------------------------------------------------ 答案优先级
 *
 *   你在页面上手动改过的答案会被单独记住，标记为「用户」来源：
 *   · 交卷后判定答对的答案一律写回题库（不论旧值来自谁——它已经被验证是正确/错误的）；
 *   · 「用户答案优先」只用于「导入 vs 库内」这种双方都还没被验证的场合。
 *   导出 CSV 的「来源」列会写明是「用户」还是「脚本」。
 * 面板上的「自检」按钮会跑一遍内置用例（纯函数断言），改完脚本点一下就知道有没有踩坏。
 * 仓库里的 tools/selftest.mjs 用 Node 跑同一批用例，无需浏览器。
 *
 * ------------------------------------------------------------------ 面板怎么用
 *
 *   面板按钮按用途分成 4 类（答题模式与节奏 / 接口设置 / 题库与本场 / 日志与自检），默认收起；
 *   点分类标题展开同类按钮，收起时标题右侧显示状态摘要，展开状态会记住。
 *   「开始 / 暂停 / 收起」常驻顶栏，不随分类收起。
   「题库与本场 → 关闭页」设置交卷后自动关闭本页的秒数（倒计时中再点一下取消）。
   「答题模式与节奏 → 二源」打开后每题都追加第二个来源交叉验证（更准但更慢，默认关）。
 *
 * ------------------------------------------------------------------ 文件结构
 *
 * 单文件、无构建，自上而下依次是（搜「====================」可直接跳章节）：
 *   站点适配层        SEL / BTN 两组选择器，平台改版只动这里
 *   通用工具          日志、API Key 混淆、页面交互节流、提示条、导出文件命名
 *   DOM 解析          取题干 / 选项 / 题号 / 总题数 / 按钮 / 题目签名
 *   题库（数据层）    指纹主键、相似题复用、落盘合并与墓碑、容量淘汰、答案写入
 *   导入导出          CSV / JSON 编解码、分隔符与编码嗅探、导入结果播报、会话恢复
 *   答案抽取          从来源文本抽字母，判断题语义判定，多源候选合并
 *   网络请求          带重试退避的请求、百度通道、AI 通道、多源查询链
 *   答题核心          选项点击与选中态同步、监听用户手改、切题等待、就绪探测
 *   作答策略          多选组合枚举、chooseAnswer 决策、answerCurrent 单题流程
 *   成绩解析          答题卡颜色判定、分数读取、交卷对账入库
 *   考试流程控制      退出原因、暂停等待、倒计时、弹窗、最后一题、mainLoop
 *   内置自检          174 项纯函数断言 + window.__FX_TEST__ 测试钩子
 *   面板              UI 构建、分类折叠、拖拽、状态摘要、AI 设置、导入导出与日志按钮
 */

(function () {
    'use strict';

    // 只在顶层文档运行：@noframes 之外的兜底。iframe 里重复注入会跑出多个面板、多份主循环，
    // 还会争抢同一组 GM 存储键
    try { if (window.top !== window.self) return; } catch { return; }

    // 版本号单一来源：直接取脚本头部的 @version
    const VERSION = (typeof GM_info !== 'undefined' && GM_info?.script?.version) || '';

    const CONFIG = {
        // ---------- 答题模式 ----------
        answerMode: GM_getValue('answerMode', 'baidu'),

        // ---------- 答题节奏（档位可切） ----------
        speed: GM_getValue('speed', 'normal'),  // slow | normal | fast

        // ---------- 页面/切题 ----------
        readyTimeout: 20000,         // 等待考试页面就绪的最长时间（毫秒）
        switchSettleDelay: 500,      // 检测到切题后的缓冲等待（毫秒）
        clickSyncRounds: 2,          // 选中态同步的最大轮次
        clickSyncDelay: 60,          // 每轮同步之间的等待（毫秒）

        // ---------- 请求超时 ----------
        baiduTimeout: GM_getValue('baiduTimeout', 8000),   // 百度请求超时（毫秒）
        aiTimeout: GM_getValue('aiTimeout', 15000),        // AI 请求超时（毫秒）
        // 单题网络总预算（毫秒）：百度最坏 2 入口×3 次×8s + 2 跟进页、AI 再 3 次×15s，
        // 串行且各自重试会把一道题拖到几分钟。两源共享这个 deadline，
        // 单请求 timeout 取 min(配置, 剩余)，预算用完立刻按已有结果作答（A6）
        queryBudgetMs: 20000,

        // ---------- 请求重试与限流 ----------
        maxRetry: GM_getValue('maxRetry', 2),              // 网络/超时/5xx 的重试次数
        retryBaseMs: 600,                                   // 退避基数：第 n 次重试等 基数 × 2^n
        maxConcurrent: GM_getValue('maxConcurrent', 2),     // 同时进行的请求数上限

        // ---------- AI 接口 ----------
        aiModel: GM_getValue('aiModel', 'deepseek-chat'),  // 模型名（面板可改）
        aiTemperature: GM_getValue('aiTemperature', 0.1),  // 采样温度（越低越稳定）
        aiMaxTokens: GM_getValue('aiMaxTokens', 512),      // 单次返回上限

        // ---------- 多源查询 ----------
        crossCheckBelow: 0.8,        // 主源置信度低于此值时，才追加次源做交叉验证
        crossAcceptGap: 0.3,         // 两源冲突时，领先方至少要有这么大的置信度优势才敢采用
        multiSourceBonus: 0.15,      // 两源答案一致时的置信度加成

        // ---------- 答案抽取 ----------
        textMatchMinLen: 2,          // 选项原文匹配：选项文本最短长度
        textMatchMinHits: 1,         // 选项原文匹配：最少出现次数
        textMatchShortMax: 30,       // 答案文本超过此长度时，2 字以内的选项需出现 2 次才算命中
        textMatchKeepRatio: 0.6,     // 多选题保留选项的得分下限（相对最高分）

        // ---------- 百度搜索 ----------
        baiduFollowLinks: GM_getValue('baiduFollowLinks', 2),  // 跟进前 N 条结果页正文
        baiduMinChars: 400,          // 抓到的正文短于此值就换下一个搜索入口

        // ---------- 切题等待 ----------
        switchWaitMin: 3000,         // 自适应等待下限（毫秒）
        switchWaitMax: 12000,        // 自适应等待上限（毫秒）
        switchWaitDefaultAuto: 4000, // 页面自动切题时的初始等待
        switchWaitDefaultManual: 10000, // 手动点「下一题」后的初始等待
        switchWaitAutoRatio: 2.5,    // 按实测切题耗时 × 该系数估算等待
        switchStableRounds: 2,       // 签名连续稳定多少轮才算切题完成

        // ---------- 失败重试（按原因分类，各有阈值） ----------
        maxAnswerFailStreak: 3,      // 连续作答失败次数上限（兜底）
        maxSwitchFail: 2,            // 连续切题失败次数上限
        retryDelay: 2000,            // 失败后重试间隔（毫秒）
        retryBackoffMax: 4,          // 同类失败连续出现时的最大退避倍数
        failLimits: {                // 各类失败的容忍次数
            'no-stem': 6,            // 题干还没渲染出来，多等几次无妨
            'no-options': 6,
            'invalid-answer': 3,
            'click-failed': 4,
            'no-text': 3,
            unknown: 3,
        },

        // ---------- 最后一题与交卷 ----------
        autoSubmit: GM_getValue('autoSubmit', false),  // 默认不自动交卷，答完只提示
        autoCloseSec: GM_getValue('autoCloseSec', 8),  // 成绩解析/入库流程走完后自动关闭本页的秒数（0 = 不关闭）
        forceCrossCheck: GM_getValue('forceCrossCheck', false), // 强制二源交叉验证：每题都追加第二个来源（更准但更慢）
        baiduConfFactor: 0.9,        // 百度通道把握度系数（搜索结果页回显容易虚高，统一降一点再参与合并）
        crossCheckConflictMin: 2,    // 题库同一题答案冲突过多少次后，不再直接采信题库、改为联网交叉验证

        // ---------- 回退与倒计时 ----------
        maxBackwardStreak: 3,        // 连续回退超过此次数就停下
        timeWarnSec: 180,            // 剩余时间低于此值开始告警
        timeRushSec: 300,            // 剩余时间低于此值时自动切到快速节奏

        // ---------- 页面弹窗 ----------
        // 「返回」不再自动点：它可能是跳转链接，会把考生点出考试页
        dialogSafeDismiss: ['继续答题', '取消', '关闭'],
        dialogNeverAuto: ['返回', '离开', '退出'],
        dialogSubmitWords: ['交卷', '提交'],
        maxDialogDismiss: 3,         // 同一个弹窗连点几次还不消失，就停下交给人处理

        // ---------- 题目范围与解析 ----------
        maxTotalQ: 100,              // 题号上限（用于推算总题数）
        maxQuestionNum: 500,         // 解析答题卡时识别的最大题号（原来 50，长卷子会漏）
        // 答题卡可能裸放在 td / li / span 里，也可能包在 label / mark 里；扫描选择器宁宽勿窄，
        // 数字格子的文本变体（第12题 / 12. / 12题）交给 cellNumberText() 兜底，容器锁再排除误伤。
        resultScanSelector: 'a, span, div, button, li, td, i, em, b, strong, p, label, mark, u, small, font, ins, th, dt, dd, text',
        resultOpenWords: ['查看答题卡', '答题卡', '查看解析', '查看试卷', '查看答卷', '核对答案', '查看答案'],
        greenDelta: 20,              // 备用绿/红判定：通道之间的最小差值
        colorMatchTolerance: 60,     // 与图例参考色的最大色差
        defaultTotalQ: 10,           // 总题数推断失败时的兜底值
        parseStartDelay: 3000,       // 点交卷后等待结果弹窗的时间（毫秒）
        parseFirstDelay: 500,        // 首次解析延迟（毫秒）
        parseRetryInterval: 300,     // 解析重试间隔（毫秒）
        parseMaxRetry: 10,           // 解析最大重试次数
        reparseDebounce: 5000,       // 二次交卷/连点时的解析去抖（毫秒）
        parseWatchdogMs: 15000,      // 成绩解析看门狗：超时强制释放解析锁（B3）
        absentAsWrongCoverage: 0.8,  // 「只标对不标错」兜底要求的最低识别覆盖率

        // ---------- 多选题策略 ----------
        // 组合顺序固定为「全选 → 少一个 → 少两个 …」，不再用写死的概率摇点数
        multiMinChoices: 2,          // 多选最少选几个（平台规定多选至少 2 个）
        multiMaxTries: 6,            // 同一题最多尝试几个组合，避免把组合穷举光
        // 候选把握度门槛：低于门槛的「弱候选」不再直接采信，交给排除法 / 多选组合策略。
        // 旧实现只看候选字母个数：百度孤立字母折减后把握度只有 0.32，4 选 3 的题里
        // 部分回显 "ABC" 也会压过「全选」策略（A4）。
        minCandConf: { single: 0.6, judge: 0.6, multi: 0.65 },

        // ---------- 题库 ----------
        bankMaxEntries: 2000,        // 题库容量上限，超出按「低分 + 久未使用」淘汰
    wrongMaxEntries: 500,        // 错题记录容量上限（只有错误选项/失败组合，信息少，单独设更小的上限）
        fuzzyThreshold: 0.9,         // 相似题匹配阈值（低于此值不认，宁可不答也不答错）
        prefixMatchMin: 30,          // 短题干是长题干前缀且达到此长度时，视为同一题
        sessionTtl: 3 * 60 * 60 * 1000, // 未交卷会话记录的保鲜期（毫秒）

        // ---------- 面板 ----------
        debug: GM_getValue('debug', false),   // 调试开关：打开后输出细节日志
        logMaxLines: 300,             // 日志区最多留多少行，超出丢最旧的

        // ---------- 健壮性与合规 ----------
        opMinInterval: 400,           // 与页面交互的最小间隔（毫秒），避免高频点击
        opMaxPerMin: 90,              // 每分钟交互上限，超了自动放慢并提示
        pollStartInterval: 200,       // 轮询起始间隔
        pollMaxInterval: 1200,        // 轮询退避上限（页面没动静就慢慢等）
        mutationThrottleMs: 100,      // DOM 观察器尾沿节流窗口（毫秒）：倒计时每秒改 DOM，不该每次都读题（B6）
        crashMax: 5,                  // 主循环连续异常多少次后停手
        errLogPerMin: 8,              // 站点自身异常每分钟最多记几条，避免刷屏
        // ---------- v2.0.7 新增 ----------
        judgeFuzzyMaxDiff: 2,         // 判断题题干安全复用的编辑距离容差（仅唯一命中时启用）
        aiDirectAcceptConf: 0.9,      // AI 结构化答案直采门槛（v2.0.6 的 0.8 太松）
        paperFingerprintCount: 6,     // 试卷指纹取前 N 题（3 题在同分/同判定时容易撞车）
        multiComboLimit: 256,         // 多选组合枚举上限：超过不再穷举，改用候选/随机保留
        multiComboBudgetMs: 1500,     // 多选组合生成时间预算（毫秒）
        answerCacheTtl: 30 * 60 * 1000, // 会话级答案缓存保鲜期（毫秒）
        answerCacheMax: 200,          // 会话级答案缓存条数上限
        parallelDualSource: true,     // 需要次源时并行请求；关掉退回串行
        followPageMaxBytes: 512 * 1024, // 跟进页/响应体上限（按 UTF-8 字节估算截断）
        tombPurgeEvery: 10,           // 每落盘 N 次清理一次过期墓碑
        storageWarnBytes: 3 * 1024 * 1024, // GM 存储占用告警阈值（字节）
        disputeMaxEntries: 100,       // 争议题记录上限
        keySalt: 'fx-legal-2026',     // API Key 落盘混淆用（不是加密，任何人都能还原）
    };

    // 脚本头部 @connect 白名单（填了名单外的接口地址时，提前告诉用户要补哪一行）
    const CONNECT_HOSTS = [
        'www.baidu.com', 'api.deepseek.com', 'api.openai.com', 'dashscope.aliyuncs.com',
        'open.bigmodel.cn', 'api.moonshot.cn', 'api.siliconflow.cn', 'ark.cn-beijing.volces.com',
    ];

    // 答题节奏档位
    const SPEED_NAME = { slow: '慢速', normal: '标准', fast: '快速' };
    const SPEED = {
        slow:   [3000, 6000],   // 稳妥：每题 3~6 秒
        normal: [1000, 3000],   // 标准：每题 1~3 秒
        fast:   [300, 800],     // 快速：每题 0.3~0.8 秒
    };

    // ==================== 站点适配层 ====================
    // 每个字段都是「按优先级排列的候选选择器」，命中第一个即用。
    // 平台改版时只需要动这里。
    const SEL = {
        // 题目容器
        box: ['#timucontent', '#timuContent', '#questionContent', '.timucontent', '#examContent', '.exam-content'],
        // 题干（在题目容器内查找）
        stem: ['h2', 'h3', '.question-title', '.q-title', '.stem', 'h1', '.title'],
        // 选项输入框
        optionInput: ['input[name="option"]', 'input[name^="option"]', 'input[name^="answer"]', '.option input', '.opt input'],
        // 选项输入框兜底：不依赖 name
        optionInputLoose: ['input[type="radio"]', 'input[type="checkbox"]'],
        // 选项文本可能所在的位置
        optionHolder: 'label, li, .option, .opt, dd, p',
        // 可点击元素
        clickable: 'a, button, input[type="submit"], input[type="button"], [role="button"]',
        // 弹窗
        dialog: '.layui-layer, .el-dialog, .modal, .dialog, [role="dialog"], .ant-modal, #popup, .popup',
        // 倒计时（多数取不到，靠整页文本兜底）
        timer: '#timer, #remainTime, #timeLeft, .timer, .remain-time, [id*="timer"], [id*="Timer"], [class*="timer"]',
    };

    // 按钮文案（按优先级），exclude 用于排除误命中
    const BTN = {
        next: { labels: ['下一题', '下一页'], exclude: ['上一题', '上页'] },
        submit: { labels: ['交卷'], exclude: ['确定', '确认'] },
        confirm: { labels: ['确定交卷', '确认交卷', '确定', '确认'] },
    };

    // 题型统计文案（用于推算总题数）：兼容「单选题：共20题」「单选题（共20题）」两种写法
    const TOTAL_RE = /(?:单选题|多选题|判断题|单项选择题|多项选择题|是非题)[：:（(\s]{0,3}共\s*(\d+)\s*题/g;
    // 判断题选项文本
    const JUDGE_YES_OPT = /^(对|正确|是|√|✓|T|True|Y|Yes|1)$/i;
    const JUDGE_NO_OPT = /^(错|错误|否|×|✗|X|F|False|N|No|0)$/i;
    // 判断题答案文本（含否定优先，避免「不正确」被判成「正确」）
    // 去掉裸「是」——「答案是B」「本题是…」会把答案劫持成「对」；判定前先剥掉标签词
    const JUDGE_NO_TEXT = /不正确|不对|错误|错|×|✗|否|False|^F$|^N$|^0$/i;
    const JUDGE_YES_TEXT = /正确|对|√|✓|True|^T$|^Y$|^1$/i;
    // 「整句就是一个判定词」时用的锚定式：剥掉标签词与标点后整串匹配。
    // 这样「是」「否」这类单字选项仍然能命中，而「答案是B」剥完是「是B」，不会误判
    const JUDGE_YES_VERDICT = /^(是|对|正确|对的|是正确的|√|✓|T|True|Y|Yes|1)$/i;
    const JUDGE_NO_VERDICT = /^(否|错|错误|不对|不正确|错的|是错误的|×|✗|F|False|N|No|0)$/i;
    // 这些词里的「正确/是」只是标签，不是判断题的判定结论，语义判定前先剥掉
    const JUDGE_LABEL_RE = /正确答案|参考答案|标准答案|正确选项|本题答案|答案|选项|解析|分析|故选|应选/g;

    // 面板样式：全部注入 Shadow DOM，不再受站点 CSS 影响，也不会影响站点页面。
    // 配色只用一套设计令牌（--fx-*），改主题只动这一块；按钮高度统一 34px，密度比 v1 更紧凑。
    const PANEL_CSS = `
        :host { all: initial; position: fixed; top: 0; left: 0; z-index: 2147483000; }
        #fx-panel {
            /* ---- 设计令牌 ---- */
            --fx-bg: #12161d;
            --fx-bg-soft: #1a1f28;
            --fx-surface: #212836;
            --fx-surface-2: #2a3242;
            --fx-line: #313a4b;
            --fx-line-soft: #262e3c;
            --fx-text: #e8ecf3;
            --fx-text-dim: #98a4b8;
            --fx-text-mute: #8794a8;
            --fx-accent: #5aa9ff;
            --fx-accent-soft: rgba(90, 169, 255, 0.14);
            --fx-ok: #46c98a;
            --fx-warn: #f0b445;
            --fx-error: #f2666f;
            --fx-radius: 10px;
            --fx-radius-sm: 7px;
            --fx-btn-h: 34px;

            position: fixed; top: 80px; right: 15px;
            background: var(--fx-bg);
            color: var(--fx-text);
            border: 1px solid var(--fx-line);
            border-radius: 14px; padding: 10px;
            font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif;
            font-size: 13px; line-height: 1.45;
            width: min(300px, calc(100vw - 24px)); max-height: calc(100vh - 24px);
            display: flex; flex-direction: column;
            box-sizing: border-box;
            box-shadow: 0 18px 48px -12px rgba(0, 0, 0, 0.72), 0 0 0 1px rgba(255, 255, 255, 0.03) inset;
        }
        #fx-panel * { box-sizing: border-box; font-family: inherit; font-size: 13px; }
        #fx-panel ::-webkit-scrollbar { width: 8px; height: 8px; }
        #fx-panel ::-webkit-scrollbar-thumb { background: #39435a; border-radius: 8px; }
        #fx-panel ::-webkit-scrollbar-thumb:hover { background: #47536e; }
        #fx-panel ::-webkit-scrollbar-track { background: transparent; }

        /* ---------- 按钮 ---------- */
        #fx-panel button {
            background: var(--fx-surface); border: 1px solid var(--fx-line); color: var(--fx-text);
            padding: 0 8px; border-radius: var(--fx-radius-sm); cursor: pointer;
            height: var(--fx-btn-h); white-space: nowrap;
            display: flex; align-items: center; justify-content: center;
            font-weight: 500; transition: background 0.14s, border-color 0.14s, color 0.14s, transform 0.1s;
        }
        #fx-panel button:hover { background: var(--fx-surface-2); border-color: #43506a; }
        #fx-panel button:active { transform: translateY(1px); }
        #fx-panel button:focus-visible { outline: 2px solid var(--fx-accent); outline-offset: 1px; }
        #fx-panel button.active {
            background: var(--fx-accent-soft); color: #cfe6ff;
            border-color: rgba(90, 169, 255, 0.55); font-weight: 600;
        }
        #fx-panel button[disabled] { opacity: 0.45; cursor: not-allowed; }
        #fx-panel .row { display: flex; gap: 6px; margin-bottom: 7px; align-items: center; }
        #fx-panel .row:last-child { margin-bottom: 0; }
        #fx-panel .row button { flex: 1; min-width: 0; padding: 0 6px; }
        /* 窄面板（300px）里 4 枚按钮一行放不下：文字会压到边框、挤进相邻按钮，改 2x2 等宽 */
        #fx-panel .row.grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
        #fx-panel .row.grid-2 button { flex: none; }

        /* ---------- 标题栏 ---------- */
        #fx-panel .panel-title {
            display: flex; align-items: center; gap: 7px;
            margin: -2px -2px 9px; padding: 5px 8px 7px;
            border-bottom: 1px solid var(--fx-line-soft);
            cursor: move; user-select: none;
        }
        #fx-panel .panel-title span { font-size: 13.5px; font-weight: 650; letter-spacing: 0.2px; }
        #fx-panel .title-dot { flex: none; width: 8px; height: 8px; border-radius: 50%;
            background: var(--fx-text-mute); transition: background 0.2s, box-shadow 0.2s; }
        #fx-panel .title-dot.on { background: var(--fx-ok); box-shadow: 0 0 0 3px rgba(70, 201, 138, 0.16); }
        #fx-panel .title-dot.paused { background: var(--fx-warn); box-shadow: 0 0 0 3px rgba(240, 180, 69, 0.16); }
        #fx-panel .title-ver { flex: none; margin-left: auto; padding: 1px 6px; border-radius: 999px;
            background: var(--fx-bg-soft); border: 1px solid var(--fx-line);
            color: var(--fx-text-mute); font-size: 10.5px; font-weight: 600; letter-spacing: 0.3px; }
        /* 顶栏常驻按钮（开始 / 暂停 / 收起）：等宽三列，主按钮用强调色区分 */
        #fx-panel .topbar { display: grid; grid-template-columns: 1.15fr 1fr 1fr; gap: 6px; margin-bottom: 9px; }
        #fx-panel .topbar button { flex: none; min-width: 0; }
        #fx-panel #fx-stop:not(.active) { background: var(--fx-accent-soft); border-color: rgba(90, 169, 255, 0.5); color: #cfe6ff; font-weight: 600; }
        #fx-panel #fx-stop:hover { background: rgba(90, 169, 255, 0.22); }

        /* ---------- 内容区 ---------- */
        #fx-panel .fx-content { display: flex; flex-direction: column; min-height: 0; overflow-y: auto; padding-right: 2px; }

        /* ---------- 分类折叠 ---------- */
        #fx-panel .group { flex: none; margin-bottom: 7px; border: 1px solid var(--fx-line-soft);
            border-radius: var(--fx-radius-sm); overflow: hidden; background: rgba(255, 255, 255, 0.012); }
        #fx-panel .group-head { display: flex; align-items: center; gap: 7px; padding: 8px 9px;
            cursor: pointer; user-select: none; transition: background 0.14s; }
        #fx-panel .group-head:hover { background: rgba(255, 255, 255, 0.045); }
        #fx-panel .group-head:focus-visible { outline: 2px solid var(--fx-accent); outline-offset: -2px; }
        #fx-panel .group.open .group-head { border-bottom: 1px solid var(--fx-line-soft); }
        #fx-panel .group-caret { flex: none; width: 9px; color: var(--fx-text-mute);
            transition: transform 0.18s ease, color 0.18s; font-size: 10px; }
        #fx-panel .group.open .group-caret { transform: rotate(90deg); color: var(--fx-accent); }
        #fx-panel .group-name { flex: 1; font-weight: 600; white-space: nowrap; color: var(--fx-text); }
        #fx-panel .group-badge { flex: none; max-width: 60%; color: var(--fx-text-dim);
            font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        #fx-panel .group.open .group-badge { display: none; }   /* 展开后按钮自己带状态，摘要让位 */
        #fx-panel .group-body { display: none; padding: 9px 9px 3px; }
        #fx-panel .group.open .group-body { display: block; }

        /* ---------- 进度 / 状态 / 统计 ---------- */
        #fx-panel .bar { width: 100%; height: 4px; background: var(--fx-bg-soft); border-radius: 999px;
            margin-top: 9px; overflow: hidden; flex: none; }
        #fx-panel .fill { height: 100%; border-radius: 999px; width: 0%;
            background: linear-gradient(90deg, #4a9eff, #6fd3ff); transition: width 0.35s ease; }
        #fx-panel .status { margin-top: 8px; font-weight: 600; text-align: center; color: var(--fx-text); }
        #fx-panel .stats { margin-top: 5px; text-align: center; color: var(--fx-text-dim);
            font-size: 12px; line-height: 1.45; }

        /* ---------- 提示条 ---------- */
        #fx-panel .notice { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 8px;
            background: rgba(240, 180, 69, 0.1); border: 1px solid rgba(240, 180, 69, 0.28);
            border-radius: var(--fx-radius-sm); padding: 8px 9px; cursor: pointer; }
        #fx-panel .notice-info { background: var(--fx-accent-soft); border-color: rgba(90, 169, 255, 0.3); }
        #fx-panel .notice-warn { background: rgba(240, 180, 69, 0.1); border-color: rgba(240, 180, 69, 0.28); }
        #fx-panel .notice-error { background: rgba(242, 102, 111, 0.1); border-color: rgba(242, 102, 111, 0.3); }
        #fx-panel .notice span { flex: 1; line-height: 1.4; font-size: 12.5px; }

        /* ---------- 设置表单 ---------- */
        #fx-panel .settings { margin-bottom: 3px; }
        #fx-panel .fld { display: block; margin-bottom: 7px; }
        #fx-panel .fld i { display: block; font-style: normal; margin-bottom: 4px;
            color: var(--fx-text-dim); font-size: 12px; }
        #fx-panel input { width: 100%; height: 32px; background: var(--fx-bg-soft); color: var(--fx-text);
            border: 1px solid var(--fx-line); border-radius: var(--fx-radius-sm); padding: 0 9px; font-size: 12.5px; }
        #fx-panel input::placeholder { color: var(--fx-text-mute); }
        #fx-panel input:focus { outline: none; border-color: var(--fx-accent); box-shadow: 0 0 0 3px var(--fx-accent-soft); }
        #fx-panel .form-err { margin-bottom: 7px; color: #ffc4c9; font-size: 12px;
            padding: 5px 8px; border-radius: 6px; background: rgba(242, 102, 111, 0.12); }

        /* ---------- 日志 ---------- */
        /* max-height 是上限、min-height 是下限：四个分组全部展开时面板会顶到
           「calc(100vh - 24px)」，这里不加下限的话日志区会被挤成十几像素高。
           有了下限就由 .fx-content 自己出滚动条，日志始终留着可读的几行。 */
        #fx-panel .log-box { margin-top: 9px; min-height: 120px;
            max-height: min(210px, 30vh); overflow-y: auto;
            background: #0d1117; border: 1px solid var(--fx-line-soft); padding: 7px 6px;
            border-radius: var(--fx-radius-sm); word-break: break-all; font-size: 12px;
            font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; }
        #fx-panel .log-line { margin-bottom: 2px; padding: 1px 6px; border-radius: 4px;
            border-left: 3px solid transparent; color: #c3cbd9; }
        #fx-panel .log-info  { border-left-color: #3d4657; }
        #fx-panel .log-ok    { border-left-color: var(--fx-ok); color: #c9f0dd; }
        #fx-panel .log-warn  { border-left-color: var(--fx-warn); color: #ffe6b8; }
        #fx-panel .log-error { border-left-color: var(--fx-error); color: #ffd0d3; }
        #fx-panel .log-debug { border-left-color: var(--fx-accent); color: #b9d8ff; opacity: 0.9; }

        /* ---------- 收起：只留一条窄条，点「展开」还原 ---------- */
        #fx-panel.collapsed { width: min(132px, calc(100vw - 24px)); }
        #fx-panel .collapse-title { display: none; }   /* 基础态隐藏：窄条标题只在收起时出现，否则和 .panel-title 重复 */
        #fx-panel.collapsed .fx-content, #fx-panel.collapsed .panel-title { display: none; }
        #fx-panel.collapsed .collapse-title { display: flex; align-items: center; justify-content: center; gap: 6px;
            font-weight: 600; margin-bottom: 8px; cursor: move; user-select: none; }
        #fx-panel.collapsed .topbar { grid-template-columns: 1fr; margin-bottom: 0; }
        #fx-panel.collapsed #fx-stop, #fx-panel.collapsed #fx-pause { display: none; }

        @media (max-width: 380px) {
            #fx-panel { width: calc(100vw - 16px); max-height: calc(100vh - 16px); padding: 8px; }
            #fx-panel .log-box { max-height: 24vh; }
        }
    `;

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // 面板所在根节点：有 Shadow DOM 就用影子根，没有就退回 document。
    // 只在自己的根里找，绝不回落到 document——站点元素撞 id 时会把站点的「确定」当成面板按钮。
    let uiRoot = document;
    const $ = id => {
        try { return uiRoot.getElementById ? uiRoot.getElementById(id) : null; } catch { return null; }
    };

    const LOG_LEVELS = [
        { k: 'error', re: /^[❌⛔🚫]/u },
        { k: 'warn', re: /^[⚠️⚠🪟↩️⏰❔📴]/u },
        { k: 'ok', re: /^[✅♻️📊🎯📌]/u },
        { k: 'debug', re: /^[🔍🧪]/u },
    ];
    /** 日志级别：显式传入优先，否则按首字符判断 */
    const logLevel = text => (LOG_LEVELS.find(l => l.re.test(String(text).trim())) || { k: 'info' }).k;
    const logLines = [];

    function log(text, level) {
        const lv = level || logLevel(text);
        const time = new Date().toLocaleTimeString();
        const line = `[${time}] ${text}`;
        logLines.push(line);
        if (logLines.length > CONFIG.logMaxLines) logLines.splice(0, logLines.length - CONFIG.logMaxLines);

        syncGroupBadges(['log']);   // 收起时标题上的行数也要跟着走
        const box = $('fx-log');
        if (!box) return;
        const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 50;
        const div = document.createElement('div');
        div.className = `log-line log-${lv}`;
        div.textContent = line;
        box.appendChild(div);
        while (box.childElementCount > CONFIG.logMaxLines) box.removeChild(box.firstElementChild);
        if (atBottom) box.scrollTop = box.scrollHeight;
    }

    /** 只在打开调试开关时输出 */
    const dbg = text => { if (CONFIG.debug) log(`🔍 ${text}`, 'debug'); };

    const logText = () => logLines.join('\n');

    // ---------- API Key 落盘混淆 ----------
    // 脚本本身是开源的，任何"加密"都能被读出来；这里做的是不裸存：
    // 存储里看到的是一串无意义字符，避免明文被人顺手看到 / 连存储一起导出去时泄露。
    const obf = s => {
        const t = String(s || '');
        if (!t) return '';
        const salt = CONFIG.keySalt;
        let x = '';
        for (let i = 0; i < t.length; i++) x += String.fromCharCode(t.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
        try { return 'v1:' + btoa(unescape(encodeURIComponent(x))); } catch { return t; }
    };
    const deobf = v => {
        const s = String(v || '');
        if (!s) return '';
        if (!s.startsWith('v1:')) return s;          // 老数据是明文，读出来继续用
        try {
            const x = decodeURIComponent(escape(atob(s.slice(3))));
            const salt = CONFIG.keySalt;
            let t = '';
            for (let i = 0; i < x.length; i++) t += String.fromCharCode(x.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
            return t;
        } catch { return ''; }
    };
    // 「仅本次会话」模式：Key 只放在内存里，刷新/重开页面即失效（不落盘，降低泄露面）
    let sessionKey = '';
    let keySessionOnly = GM_getValue('aiKeySessionOnly', false);
    const getKey = () => sessionKey || deobf(GM_getValue('aiKey', ''));
    const setKey = k => GM_setValue('aiKey', obf(k));

    // ---------- 与页面交互的节流 ----------
    let lastSiteOp = 0, siteOpWarned = false;
    const siteOps = [];
    /**
     * 登记一次「真实的页面写操作」
     * 以前只统计 pacedOp 的调用，而真正的点击（选项、弹窗按钮、交卷）都走 autoClick，
     * 于是「6 选多选点 12 次」在计数里只算 1 次，限速形同虚设。现在 autoClick 也登记。
     */
    function noteSiteOp() {
        const now = TS();
        siteOps.push(now);
        while (siteOps.length && now - siteOps[0] > 60000) siteOps.shift();
        if (siteOps.length > CONFIG.opMaxPerMin) {
            if (!siteOpWarned) {
                siteOpWarned = true;
                log(`⚠️ 每分钟交互已达 ${siteOps.length} 次（上限 ${CONFIG.opMaxPerMin}），已自动放慢节奏`);
                notify('操作过于频繁，已自动放慢节奏', 'warn');
            }
        } else if (siteOps.length < CONFIG.opMaxPerMin / 2) {
            siteOpWarned = false;
        }
        return siteOps.length;
    }
    /** 超过每分钟上限后要额外等多久：超出越多等越久，最多 4 倍最小间隔（以前只提示不减速） */
    function overLimitWait() {
        const over = siteOps.length - CONFIG.opMaxPerMin;
        if (over <= 0) return 0;
        return CONFIG.opMinInterval * Math.min(4, Math.ceil(over / 10) + 1);
    }
    /** 与页面交互前登记一次：返回还需要等多少毫秒 */
    function siteOp(kind) {
        noteSiteOp();
        const now = TS();
        const gap = now - lastSiteOp;
        lastSiteOp = Math.max(now, lastSiteOp + CONFIG.opMinInterval);
        return Math.max(0, CONFIG.opMinInterval - gap) + overLimitWait();
    }
    /** 按节流节奏执行一次页面操作（点击选项、切题等） */
    async function pacedOp(kind, fn) {
        const wait = siteOp(kind);
        if (wait > 0) {
            dbg(`${kind}：距上次交互不足 ${CONFIG.opMinInterval}ms，等 ${wait}ms`);
            if (!await pauseAwareSleep(wait)) return undefined;   // 已停止就别再动页面
        }
        // 等待期间可能被暂停/停止：再确认一次，暂停时安静返回，由调用方按「没做」处理
        if (!running || paused) return undefined;
        return fn();
    }

    // ---------- 面向用户的提示通道 ----------
    function notify(text, level = 'warn', kind = 'info') {
        const line = String(text || '').trim();
        if (!line) return;
        const box = $('fx-notice');
        if (!box) return;
        box.dataset.kind = kind;
        box.className = `notice notice-${level}`;
        box.style.display = 'flex';
        const txt = $('fx-notice-text');
        if (txt) txt.textContent = line;
    }
    function hideNotice() {
        const box = $('fx-notice');
        if (box) box.style.display = 'none';
    }

    /** 包一层异常兜底：任何一处抛错都不该把整个流程带走 */
    const safe = (label, fn) => async (...a) => {
        try { return await fn(...a); }
        catch (e) {
            log(`❌ ${label}出错：${(e && e.message) || e}`);
            dbg(`堆栈：${String((e && e.stack) || '').split('\n').slice(0, 2).join(' | ')}`);
            notify(`${label}出错：${(e && e.message) || e}`, 'error');
        }
    };

    async function copyLog() {
        const text = logText();
        if (!text) { log('日志还是空的'); return; }
        try {
            await navigator.clipboard.writeText(text);
            log(`✅ 已复制 ${logLines.length} 行日志到剪贴板`);
        } catch {
            // 剪贴板不可用（非安全上下文等）时退回选中提示
            log('⚠️ 剪贴板不可用，请用「导出日志」保存到文件');
        }
    }

    // ---------- 导出文件命名 ----------
    // 统一成仓库的命名规范：小写英文 + 连字符 + 项目前缀；答案库带日期、日志带时间，便于按天归档。
    // 一律用**本地时间**：以前日志名走 toISOString()（UTC），东八区凌晨导出的名字会退回前一天。
    const BANK_FILE_BASE = 'faxuanyun-legal-exam-bank';
    const LOG_FILE_BASE = 'faxuanyun-legal-exam-log';
    const pad2 = n => String(n).padStart(2, '0');
    /** 日期戳 YYYYMMDD（本地时间） */
    const dayStamp = d => {
        const t = d || new Date();
        return `${t.getFullYear()}${pad2(t.getMonth() + 1)}${pad2(t.getDate())}`;
    };
    /** 时间戳 YYYYMMDD-HHMMSS（本地时间） */
    const timeStamp = d => {
        const t = d || new Date();
        return `${dayStamp(t)}-${pad2(t.getHours())}${pad2(t.getMinutes())}${pad2(t.getSeconds())}`;
    };
    /** 答案库导出的两个文件名：同一次导出共用一个日期戳，成对好找 */
    const bankFileNames = d => {
        const s = dayStamp(d);
        return { csv: `${BANK_FILE_BASE}-${s}.csv`, json: `${BANK_FILE_BASE}-${s}.json` };
    };
    const logFileName = d => `${LOG_FILE_BASE}-${timeStamp(d)}.txt`;

    /**
     * 触发一次浏览器下载：Blob + 临时 <a>，用完回收 objectURL。
     * delay 用来错开多次下载——同一次导出会连着给两个文件（CSV + JSON），
     * 浏览器对同一时刻的多次下载可能只放行第一个。
     */
    function downloadFile(name, content, mime, delay = 0) {
        setTimeout(() => {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([content], { type: mime }));
            a.download = name;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }, delay);
    }

    function exportLog() {
        if (!logLines.length) { log('日志还是空的'); return; }
        const name = logFileName();
        downloadFile(name, logText(), 'text/plain;charset=utf-8');
        log(`✅ 已导出 ${logLines.length} 行日志：${name}`);
    }

    // ==================== 通用工具 ====================
    /** 按候选列表取第一个命中的元素 */
    function pick(list, root = document) {
        for (const s of list) {
            let el = null;
            try { el = root.querySelector(s); } catch { el = null; }
            if (el) return el;
        }
        return null;
    }
    /** 按候选列表取第一组非空元素 */
    function pickAll(list, root = document) {
        for (const s of list) {
            let els = [];
            try { els = [...root.querySelectorAll(s)]; } catch { els = []; }
            if (els.length) return els;
        }
        return [];
    }
    const elText = el => (el && (el.value || el.textContent) || '').replace(/\s+/g, ' ').trim();
    /**
     * 可见性判断（提到通用区，供按钮/弹窗/题号共用）
     * offsetParent 对 position:fixed 元素返回 null——固定底栏里的「下一题/交卷」以及 layui-layer、
     * el-dialog 这类弹窗都会被它误判成不可见，所以补一道 getClientRects()。
     */
    const isVisible = el => !!el && (el.offsetParent !== null || el.getClientRects().length > 0);

    // ==================== DOM 解析 ====================
    const getBox = () => pick(SEL.box);

    const getStem = () => {
        const box = getBox();
        if (!box) return null;
        const el = pick(SEL.stem, box);
        return el ? el.textContent.trim() : null;
    };

    /** 取选项输入框：容器内优先，找不到再全页兜底（全页兜底要求至少 2 个，避免误抓） */
    function getOptionInputs() {
        const box = getBox();
        if (box) {
            const strict = pickAll(SEL.optionInput, box);
            if (strict.length) return strict;
            const loose = pickAll(SEL.optionInputLoose, box);
            if (loose.length) return loose;
        }
        const strict = pickAll(SEL.optionInput, document);
        if (strict.length) return strict;
        const loose = pickAll(SEL.optionInputLoose, document);
        return loose.length >= 2 ? loose : [];
    }

    /** 取某个选项的文本：label[for] → 最近的可视祖先 → 父元素，并剥掉开头序号 */
    function optionText(input, box) {
        let holder = null;
        if (input.id) {
            try { holder = (box || document).querySelector(`label[for="${input.id}"]`); } catch { holder = null; }
        }
        if (!holder) holder = input.closest(SEL.optionHolder);
        if (!holder) holder = input.parentElement;

        let txt = (holder?.textContent || '').replace(/\s+/g, ' ').trim();
        // 文本过长说明抓到了整个题目区域，退回到父元素重取
        if (txt.length > 200 && input.parentElement) {
            txt = (input.parentElement.textContent || '').replace(/\s+/g, ' ').trim();
        }
        // 剥掉 "A." "A、" "1)" "(A)" 之类的序号前缀
        return txt.replace(/^\s*[(（]?\s*[A-Za-z0-9]\s*[.、．)）:：]\s*/, '').trim();
    }

    /**
     * 统一的选项模型：letter 由顺序推导（A/B/C…），与平台真实 value 解耦。
     * 这样 value 是 1/2/3、是整段文字、甚至没有 value，都不影响答题。
     */
    function getOptions() {
        const box = getBox();
        return getOptionInputs().map((inp, i) => ({
            letter: String.fromCharCode(65 + i),
            value: inp.value,
            input: inp,
            // 关联的 label：某些模板直接点 input 不生效，需要改点 label
            label: (inp.id && document.querySelector(`label[for="${inp.id}"]`)) || (inp.closest ? inp.closest('label') : null),
            text: optionText(inp, box),
        }));
    }

    /** 题型识别：输入框类型 > 题干文字 > 选项文本特征 */
    function getType() {
        const inputs = getOptionInputs();
        if (inputs.some(i => i.type === 'checkbox')) return 'multi';
        const stem = getStem() || '';
        if (/多选|多项选择/.test(stem)) return 'multi';
        const opts = getOptions();
        if (opts.length === 2 && opts.every(o => JUDGE_YES_OPT.test(o.text) || JUDGE_NO_OPT.test(o.text))) return 'judge';
        if (/判断|正确与否/.test(stem)) return 'judge';
        return 'single';
    }

    /**
     * 题号识别：题干前缀 → 题干内「第N题」。
     * 取不到时返回 0，后续对账会退化为「按答题顺序」匹配。
     */
    function getQNum() {
        const stem = getStem() || '';
        let m = stem.match(/^\s*(\d{1,3})\s*[、.．)）]/);
        if (m) return +m[1];
        m = stem.match(/第\s*(\d{1,3})\s*题/);
        return m ? +m[1] : 0;
    }

    /**
     * 总题数推断（严格版）：题型统计「共N题」求和 → 答题卡最大序号。
     * 推断不出时返回 0——不能拿兜底值当真的总题数用，否则可能少答几题就「已答满」提前收工。
     */
    function getTotalQExact() {
        const scope = getBox()?.parentElement || document.body;
        const txt = scope?.innerText || '';
        const hits = [...txt.matchAll(TOTAL_RE)].map(m => +m[1]);
        if (hits.length >= 2) {
            const sum = hits.reduce((a, b) => a + b, 0);
            if (sum >= 1 && sum <= CONFIG.maxTotalQ) return sum;
        }
        let max = 0;
        [...document.querySelectorAll('a, li, span, div, button')].forEach(el => {
            // 先按文本快速过滤，再判可见性：isVisible 会触发 layout，全量扫一遍太贵
            const t = elText(el);
            if (!/^\d{1,3}$/.test(t)) return;          // 整个文本就是数字，排除 "10/10"
            if (!isVisible(el)) return;                // 不再只看 offsetParent（fixed 元素会误判）
            const n = +t;
            if (n >= 1 && n <= CONFIG.maxTotalQ) max = Math.max(max, n);
        });
        return max;
    }

    /** 总题数（带兜底值，只用于界面显示，不能用于「是否答满」的判定） */
    function getTotalQ() {
        return getTotalQExact() || CONFIG.defaultTotalQ;
    }

    /**
     * 给用户提示该补哪条 @connect：IP 原样返回；co.uk 这类多段后缀取三层，其余取末两层。
     * 不能用 slice(-2) 一刀切——IP 会被截成「0.1」，co.uk 会被截成「co.uk」的上一级。
     */
    function connectRoot(host) {
        const h = String(host || '').trim().toLowerCase();
        if (!h) return h;
        if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(h) || h.includes(':')) return h;   // IPv4 / IPv6
        const labels = h.split('.');
        if (labels.length <= 2) return h;
        const second = labels[labels.length - 2];
        const suffix = labels[labels.length - 1];
        const multiSecond = ['co', 'com', 'org', 'net', 'gov', 'edu', 'ac'];
        const multiSuffix = ['uk', 'cn', 'jp', 'au', 'nz', 'br', 'in', 'tw', 'hk', 'sg', 'za', 'kr'];
        return (multiSecond.includes(second) && multiSuffix.includes(suffix))
            ? labels.slice(-3).join('.') : labels.slice(-2).join('.');
    }

    /** 按钮定位：优先文本全等，再退到包含；支持 a / button / input */
    function findButton(labels, exclude = []) {
        // 用 isVisible——固定底栏里的「下一题 / 交卷」会被 offsetParent 判成不可见，
        // 于是脚本报「未找到下一题按钮」提前收工。
        // 先按文本粗筛、再对候选判可见：isVisible 会触发 layout，页面大时逐个过滤全页元素会明显卡顿。
        const cand = [];
        for (const el of document.querySelectorAll(SEL.clickable)) {
            if (el.disabled) continue;
            const t = elText(el);
            if (!t || exclude.some(x => t.includes(x))) continue;
            cand.push({ el, t });
        }
        for (const lb of labels) {
            const hit = cand.find(c => c.t === lb && isVisible(c.el));
            if (hit) return hit.el;
        }
        for (const lb of labels) {
            const hit = cand.find(c => c.t.includes(lb) && isVisible(c.el));
            if (hit) return hit.el;
        }
        return null;
    }

    /**
     * 题目内容签名
     * 由「题号 + 题干 + 各选项文本」构成。原来只取容器前 120 字，
     * 同题干、选项不同，或者渲染到一半去读，都会读成同一个签名。
     */
    function questionSignature() {
        const box = getBox();
        if (!box) return '';
        const stem = (getStem() || '').replace(/\s+/g, '').slice(0, 200);
        const opts = getOptionInputs()
            .map(i => String(optionText(i, box) || i.value || '').replace(/\s+/g, ''))
            .join('|').slice(0, 200);
        return `${getQNum()}#${stem}#${opts}`;
    }

    // ==================== 题库（数据层） ====================
    // schema 2：条目结构化；答案以「选项内容」为主、字母为辅（选项乱序也不受影响）；
    //           支持相似题复用、冲突检测、容量淘汰、增量迁移。
    const SCHEMA = 2;
    const IDX_LEN = 12;                 // 相似题索引：取归一化题干前 12 字建索引

    const TS = () => Date.now();
    const pureStem = s => String(s || '')
        .replace(/^\d+[、.．]\s*/, '')
        .replace(/[（(]\s*(单选|多选|判断)题?\s*[）)]\s*/, '')
        .trim();

    /** 强归一化：用于「同题不同表述」判定，去掉题号/题型/空白/标点，字母统一小写 */
    const normStem = s => String(s || '')
        .replace(/^\s*\d{1,3}\s*[、.．)）]\s*/, '')
        .replace(/[（(]\s*(单选|多选|判断)题?\s*[）)]/g, '')
        .replace(/\s+/g, '')
        .replace(/[A-Z]/g, c => c.toLowerCase())
        .replace(/[，,。.；;：:！!？?“”"'‘’（）()【】\[\]《》〈〉、\-—_~·…|｜]/g, '');

    /** FNV-1a + 长度，做题库主键；不带外部依赖且碰撞概率足够低 */
    function hash32(str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
        return (h >>> 0).toString(16).padStart(8, '0') + str.length.toString(36);
    }
    const fpKey = stem => '#' + hash32(normStem(stem));

    /**
     * 试卷指纹（纯函数，自检可断言）：取本次作答记录里前 N 道题（默认 6，见 CONFIG.paperFingerprintCount）的主键，排序后拼接。
     * 记录没有 stem（旧会话/手工构造）时退回它的 bankKey，再没有就跳过——全部空安全。
     * 排序保证「题序不同但同卷」得到同一个值；不同卷即使分数/判定/记录数全撞也不会误去重（B1）。
     */
    function paperFingerprint(history) {
        const list = Array.isArray(history) ? history : [];
        const keys = [];
        for (const r of list) {
            if (!r) continue;
            const k = r.stem ? fpKey(r.stem) : (r.bankKey || '');
            if (k) keys.push(String(k));
        }
        const n = Math.max(1, Math.floor(+CONFIG.paperFingerprintCount) || 6);
        return [...new Set(keys)].sort().slice(0, n).join(',');
    }

    /**
     * 对账幂等键（纯函数，自检可断言）：
     * 同一份成绩页被重复解析时（手动点「解析成绩」/点「查看答题卡」再触发一次），
     * 判定、分数、题号、记录数与试卷指纹都相同 → 得到同一个键，用于跳过重复写库（B1）。
     * 键 = 页面地址 + 分数 + 总分 + 逐题判定 + 本次作答记录数 + 试卷指纹（history 前 N 题，默认 6）；
     * 任何一项变了都算新的一次对账。旧版本写入的 lastReconcileKey 不带指纹，最多多写一次，可接受。
     */
    function reconcileKey(verdicts, scoreInfo, opt) {
        const v = verdicts || {};
        const nums = Object.keys(v).map(Number).filter(n => n > 0).sort((a, b) => a - b);
        const marks = nums.map(n => {
            const t = v[n];
            return n + (t === 'correct' ? 'c' : t === 'wrong' ? 'w' : t === 'unanswered' ? 'u' : '?');
        }).join(',');
        const si = scoreInfo || {};
        const loc = (typeof location !== 'undefined' && location)
            ? String(location.pathname || '') + String(location.search || '') : '';
        const len = (opt && opt.historyLen) || 0;
        const fp = paperFingerprint(opt && opt.history);
        return hash32(`${loc}|${si.score == null ? '' : si.score}|${si.total == null ? '' : si.total}|${marks}|${len}|${fp}`);
    }

    const inferType = ans => /^[01]$/.test(ans) ? 'judge' : (String(ans).length > 1 ? 'multi' : 'single');
    const sameTexts = (a, b) => {
        const x = (a || []).slice().sort(), y = (b || []).slice().sort();
        return x.length === y.length && x.every((v, i) => v === y[i]);
    };

    let bankCache = null, wrongCache = null, dirty = false;
    // 多标签页 / 多账号同开时的写保护：落盘前先读盘合并，别互相覆盖
    // pendingDeletes / pendingWrongDeletes 是「墓碑」：本页删掉的键，合并时不再从盘上搬回来
    const pendingDeletes = new Set(), pendingWrongDeletes = new Set();
    let bankVer = 0, idxCache = null, idxVer = -1;

    // ==================== 持久化墓碑（跨标签页删除保护，B7） ====================
    // 只靠内存里的 pendingDeletes 挡不住这个顺序：
    //   A 页判错 → 删掉条目 → flush 写盘（盘上没这条了）
    //   B 页 flush → 读盘合并（读不到被删的条目），但 B 页内存里还留着旧条目，
    //   于是把「本该删掉」的答案原样写回盘 —— 删除等于没发生。
    // 修法：删除时把键记进 GM 存储的墓碑表（{key: 时间戳}，7 天过期）；
    // 任何标签页在「读盘合并 → 写盘」之前都先按墓碑过滤；同键再次答对/新增时清墓碑。
    const TOMB_TTL = 7 * 24 * 60 * 60 * 1000;                       // 墓碑保鲜期：7 天
    const TOMB_KEYS = { bank: 'fx_bank_tombs', wrong: 'fx_wrong_tombs' };
    const tombMem = { bank: null, wrong: null };

    /** 清掉过期墓碑（纯函数，自检可断言）：只保留 ttl 内（含边界）的记录 */
    function purgeTombstones(map, now, ttl) {
        const out = {};
        for (const [k, ts] of Object.entries(map || {})) {
            if (now - (+ts || 0) < (ttl || TOMB_TTL)) out[k] = +ts || now;
        }
        return out;
    }
    /** 登记一条墓碑（纯函数）：返回新表，不改入参 */
    const addTombKey = (map, key, now) => (key ? { ...(map || {}), [key]: now } : { ...(map || {}) });
    /** 清一条墓碑（纯函数）：返回新表，不改入参 */
    function clearTombKey(map, key) {
        const out = { ...(map || {}) };
        delete out[key];
        return out;
    }
    /** 剔除墓碑键（纯函数，自检可断言）：删掉的条目不该被任何标签页写回来 */
    function filterTombstoned(map, tombs) {
        const out = {};
        for (const [k, v] of Object.entries(map || {})) if (!(k in (tombs || {}))) out[k] = v;
        return out;
    }
    function tombMap(which) {
        if (!TOMB_KEYS[which]) return {};
        if (!tombMem[which]) {
            let raw = {};
            try { raw = GM_getValue(TOMB_KEYS[which], {}) || {}; } catch { }
            tombMem[which] = purgeTombstones(raw, Date.now(), TOMB_TTL);
        }
        return tombMem[which];
    }
    let tombSaveCount = 0;

    /** 这次墓碑落盘后要不要清理（纯函数，自检可断言，R8）：每 tombPurgeEvery 次，或表超过上限 */
    function tombPurgeDue(count, size, every = CONFIG.tombPurgeEvery, maxEntries = 500) {
        return (every > 0 && count > 0 && count % every === 0) || size > maxEntries;
    }

    /** 墓碑表超过上限时只保留最近的 maxEntries 条（纯函数，自检可断言，R8） */
    function trimTombMap(map, maxEntries = 500) {
        const src = map || {};
        const keys = Object.keys(src);
        if (keys.length <= maxEntries) return src;
        const keep = keys.sort((a, b) => (+src[b] || 0) - (+src[a] || 0)).slice(0, Math.max(0, maxEntries));
        const out = {};
        for (const k of keep) out[k] = src[k];
        return out;
    }

    function saveTombMap(which) {
        try { GM_setValue(TOMB_KEYS[which], tombMem[which] || {}); } catch { }
        // R8：墓碑只增不减会越积越多（每次删除都会登记一条）。每落盘 tombPurgeEvery 次
        // 或表超过 500 条时清一次过期项；仍超上限就按时间裁掉最旧的，保证 GM 存储不无限膨胀。
        tombSaveCount++;
        const before = Object.keys(tombMem[which] || {}).length;
        if (!tombPurgeDue(tombSaveCount, before)) return;
        const purged = purgeTombstones(tombMem[which] || {}, Date.now(), TOMB_TTL);
        const trimmed = trimTombMap(purged, 500);
        const after = Object.keys(trimmed).length;
        tombMem[which] = trimmed;
        if (after !== before) {
            try { GM_setValue(TOMB_KEYS[which], trimmed); } catch { }
            log(`🧹 墓碑定期清理（${which}）：${before} → ${after}`);
        }
    }
    /** 删除/淘汰时登记墓碑：其它标签页合并时「墓碑优先」 */
    function addTombstone(which, key) {
        if (!key || !TOMB_KEYS[which]) return;
        tombMem[which] = addTombKey(tombMap(which), key, Date.now());
        saveTombMap(which);
    }
    /** 同键再次答对/新增时清墓碑：否则新答案会被别的标签页的旧墓碑压掉 */
    function clearTombstone(which, key) {
        if (!key || !TOMB_KEYS[which]) return;
        const m = tombMap(which);
        if (!(key in m)) return;
        tombMem[which] = clearTombKey(m, key);
        saveTombMap(which);
    }
    function isTombstoned(which, key) {
        return !!key && !!TOMB_KEYS[which] && (key in tombMap(which));
    }
    /** 导入是「用户明确要求这些条目进库」：清掉本地遗留墓碑，跨电脑导入的合并语义不受影响 */
    function resetTombstones() {
        tombMem.bank = {};
        tombMem.wrong = {};
        saveTombMap('bank');
        saveTombMap('wrong');
    }
    /** 从内存副本里删掉墓碑键，返回删除条数（flush 前调用，保证不再写回盘） */
    function dropTombstoned(cache, which) {
        const tombs = tombMap(which);
        let n = 0;
        for (const k of Object.keys(cache || {})) {
            if (!(k in tombs)) continue;
            delete cache[k]; n++;
        }
        return n;
    }
    /**
     * 别的标签页改动后的双向合并（用 oldV→newV 差异判断删除）：
     * 新增的键并进来；oldV 里有、newV 里没有的键 = 对方删掉了 → 本页也删，并登记墓碑（B7）。
     */
    function syncFromStorage(cache, pendingSet, which, oldV, newV) {
        const ov = oldV && typeof oldV === 'object' ? oldV : {};
        const nv = newV && typeof newV === 'object' ? newV : {};
        if (!cache) return { added: 0, removed: 0 };
        tombMem[which] = null;      // 对方可能刚清过墓碑（它又答对了），合并前先重读一次
        let added = 0, removed = 0;
        for (const k of Object.keys(nv)) {
            if (k in cache || (pendingSet && pendingSet.has(k)) || isTombstoned(which, k)) continue;
            cache[k] = nv[k]; added++;
        }
        for (const k of Object.keys(ov)) {
            if (k in nv) continue;                       // 盘上仍然有：不是删除
            if (pendingSet) pendingSet.add(k);
            if (k in cache) { delete cache[k]; removed++; }
            if (!isTombstoned(which, k)) addTombstone(which, k);
        }
        return { added, removed };
    }

    function blankEntry(o = {}) {
        return {
            q: o.q || '',                 // 完整题干（用于相似匹配与导出）
            t: o.t || 'single',           // 题型 single / multi / judge
            s: o.s || '甘肃省国家工作人员学法考试',  // 科目，便于后续多科目共存
            a: o.a || null,               // 正确答案的「选项内容」数组（主）
            l: o.l || '',                 // 正确答案字母（兼容旧数据与导出）
            src: o.src || 'exam',         // 来源 exam / import / legacy / user
            by: o.by || '',               // 'user' = 用户手动改过的答案（最高优先级）
            ts: o.ts || TS(),             // 首次入库时间
            us: o.us || 0,                // 最近使用时间
            hit: o.hit || 0,              // 命中次数
            ok: o.ok || 0,                // 验证答对次数
            bad: o.bad || 0,              // 答错次数
            cft: o.cft || 0,              // 答案冲突次数
        };
    }
    /** 是否为「用户手动答案」条目：入库时优先保留，脚本自动答案不得覆盖 */
    const isUserEntry = e => !!e && e.by === 'user';

    /** 迁移：旧 schema 的字符串答案 → 结构化条目（保留原 key，不丢数据） */
    function migrateBank(raw) {
        const out = {};
        for (const [k, v] of Object.entries(raw || {})) {
            if (typeof v === 'string') out[k] = blankEntry({ q: k, t: inferType(v), l: v, src: 'legacy' });
            else if (v && typeof v === 'object') out[k] = blankEntry({ ...v, q: v.q || k });
            // 自愈：答案内容里其实存的是字母或判断题的 1/0（属于旧式值），归位到 l 字段
            const e = out[k];
            if (e && !e.l && e.a && e.a.length === 1 && /^([A-Za-z]{1,8}|[01])$/.test(e.a[0])) {
                e.l = e.a[0].toUpperCase();
                e.a = null;
            }
        }
        return out;
    }

    function ensureBank() {
        if (bankCache) return bankCache;
        bankCache = migrateBank(GM_getValue('questionBank', {}));
        // 盘上残留的墓碑键不载入（另一标签页删过、只是本页还没 flush 时会出现）（B7）
        for (const k of Object.keys(bankCache)) if (isTombstoned('bank', k)) delete bankCache[k];
        if (GM_getValue('bankSchema', 1) < SCHEMA) { GM_setValue('bankSchema', SCHEMA); dirty = true; }
        return bankCache;
    }
    const blankWrong = (q = '') => ({ q, w: [], tried: [] });

    function ensureWrong() {
        if (!wrongCache) {
            wrongCache = {};
            for (const [k, v] of Object.entries(GM_getValue('wrongBank', {}) || {})) {
                // 兼容三种历史格式：纯数组 / { q, w } / { q, w, tried }
                if (Array.isArray(v)) wrongCache[k] = { q: '', w: v.filter(Boolean), tried: [] };
                else if (v && typeof v === 'object') {
                    wrongCache[k] = {
                        q: v.q || '',
                        w: Array.isArray(v.w) ? v.w.filter(Boolean) : [],
                        tried: Array.isArray(v.tried) ? v.tried.filter(Boolean) : [],
                    };
                }
            }
            for (const k of Object.keys(wrongCache)) if (isTombstoned('wrong', k)) delete wrongCache[k];
        }
        return wrongCache;
    }

    /** 容量淘汰：低分（答对少/答错多）且久未使用的先删；用户手改的答案最后才淘汰 */
    function enforceCapacity(b) {
        const keys = Object.keys(b);
        if (keys.length <= CONFIG.bankMaxEntries) return 0;
        const score = e => (e.ok || 0) * 3 + (e.hit || 0) - (e.bad || 0) * 2;
        keys.sort((x, y) =>
            (isUserEntry(b[x]) ? 1 : 0) - (isUserEntry(b[y]) ? 1 : 0)
            || score(b[x]) - score(b[y])
            || (b[x].us || 0) - (b[y].us || 0));
        const drop = keys.slice(0, keys.length - CONFIG.bankMaxEntries);
        // 淘汰也要登记墓碑：否则另一标签页的写库事件会把盘上仍存在的这些键再并回来
        drop.forEach(k => { delete b[k]; pendingDeletes.add(k); addTombstone('bank', k); });
        return drop.length;
    }

    /**
     * 错题记录容量淘汰：错题库只存「错误选项 / 失败组合」，没有正答，信息量比题库低，
     * 给它单独设更小的上限并淘汰「提示信息最少」的记录，避免无限膨胀。
     * 同样登记墓碑，防止另一标签页把删掉的键搬回来。
     */
    function enforceWrongCapacity(wb) {
        const keys = Object.keys(wb);
        if (keys.length <= CONFIG.wrongMaxEntries) return 0;
        const info = k => (wb[k].w.length + wb[k].tried.length) * 10 + (wb[k].q ? 1 : 0);
        keys.sort((x, y) => info(x) - info(y));
        const drop = keys.slice(0, keys.length - CONFIG.wrongMaxEntries);
        drop.forEach(k => { delete wb[k]; pendingWrongDeletes.add(k); addTombstone('wrong', k); });
        return drop.length;
    }

    /** 批量落盘：内存缓存 + 脏标记，避免每题都全量读写 JSON */
    /**
     * 把存储里「别的标签页写进来」的条目并进本标签页的内存副本，返回并入条数
     * tombstones：本页故意删掉的键，必须跳过——否则「删掉的答案」会被盘上的旧副本原样搬回来
     * （这正是「答错删不掉库里的错答案」「容量淘汰不生效」的根因）
     */
    function mergeFromStore(key, cache, tombstones, which) {
        let disk = null;
        try { disk = JSON.parse(JSON.stringify(GM_getValue(key, {}) || {})); } catch { return 0; }
        let n = 0;
        for (const k of Object.keys(disk)) {
            if (k in cache) continue;
            if (tombstones && tombstones.has(k)) continue;
            if (which && isTombstoned(which, k)) continue;   // 持久化墓碑优先：别的标签页删掉的不搬回来（B7）
            cache[k] = disk[k]; n++;
        }
        return n;
    }

    // ==================== 多标签页写锁 ====================
    // 「读盘 → 合并 → 写盘」不是事务：两个标签页同一瞬间落盘仍可能互相覆盖。
    // 这里加一把带过期时间的软锁，把同时写的窗口从「整次落盘」缩到几毫秒；
    // 抢不到锁的一方不丢数据（脏标记还在），过一会儿自动重试。
    // 油猴存储没有 CAS，锁做不到强事务，但足以消掉日常「两个标签页在同一秒交卷」的覆盖问题。
    const WRITE_LOCK_KEY = 'fxWriteLock';
    const WRITE_LOCK_TTL = 3000;        // 锁过期时间（毫秒）；持锁方异常退出也会自动释放
    let writeLockMe = '';
    /** 写锁的标签页标识（惰性生成，刷新页面后换新） */
    function writeLockId() {
        if (!writeLockMe) writeLockMe = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        return writeLockMe;
    }
    /** 锁是否已过期/可抢（纯函数，便于自检）：没有锁、自己的锁、或别的标签页持锁超时都算可抢 */
    function lockIsStale(lock, now, ttl, me) {
        if (!lock || !lock.owner) return true;
        if (lock.owner === me) return true;
        return now - (lock.ts || 0) >= (ttl || WRITE_LOCK_TTL);
    }
    function acquireWriteLock() {
        const lock = GM_getValue(WRITE_LOCK_KEY, null);
        if (!lockIsStale(lock, Date.now(), WRITE_LOCK_TTL, writeLockId())) return false;
        GM_setValue(WRITE_LOCK_KEY, { owner: writeLockId(), ts: Date.now() });
        // 二次确认：刚写完若被别的标签页覆盖，说明撞上了，让出一轮
        const chk = GM_getValue(WRITE_LOCK_KEY, null);
        return !!(chk && chk.owner === writeLockId());
    }
    function releaseWriteLock() {
        try {
            const lock = GM_getValue(WRITE_LOCK_KEY, null);
            if (lock && lock.owner === writeLockId()) GM_setValue(WRITE_LOCK_KEY, null);
        } catch { }
    }

    // ==================== 同场双页检测 / 人工对账 ====================
    // 写锁只保证「先后落盘不互相覆盖」，防不了两个标签页同时答同一场导致 session 分叉：
    // 用一个 localStorage 心跳标记「本页正在答题」，另一页看到未过期的心跳就提醒用户。
    const ACTIVE_TAB_KEY = 'fxActiveTab';
    const ACTIVE_TAB_TTL = 15000;       // 心跳超时：15 秒没更新视为标签页已关闭
    const TAB_ID = `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    let tabClaimTimer = null;

    /** 心跳判定（纯函数，便于自检）：claim={owner,ts}；返回 true 表示另一个标签页正在答题 */
    function tabClaimConflict(claim, now, ttl, me) {
        if (!claim || !claim.owner) return false;
        if (claim.owner === me) return false;
        const age = now - (+claim.ts || 0);
        return age < (ttl || ACTIVE_TAB_TTL);   // ts 在未来（时钟回拨）也按「正在答」处理
    }
    function readActiveTab() {
        try { return JSON.parse(localStorage.getItem(ACTIVE_TAB_KEY) || 'null'); } catch { return null; }
    }
    function writeActiveTab(claim) {
        try { localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify(claim)); } catch { }
    }
    /** 开答前认领「本页正在答题」并起心跳；发现另一页也在答就提醒（不强行停，交给用户） */
    function claimActiveTab() {
        try {
            const other = readActiveTab();
            if (tabClaimConflict(other, Date.now(), ACTIVE_TAB_TTL, TAB_ID)) {
                const when = other.ts ? new Date(other.ts).toLocaleTimeString() : '刚刚';
                log(`⚠️ 另一个标签页（${when}）也在答同一场：两页记录会各自累积、互相看不见，建议只保留一个标签页答题`);
                notify('检测到另一个标签页也在答题：建议关闭其中一个，避免两页记录分叉', 'warn');
            }
            const beat = () => writeActiveTab({ owner: TAB_ID, ts: Date.now(), path: location.pathname + location.search });
            beat();
            if (tabClaimTimer) clearInterval(tabClaimTimer);
            tabClaimTimer = setInterval(beat, 5000);
        } catch { }
    }
    /** 停止答题时撤掉心跳（标记里不是自己就不动，避免误删别的标签页） */
    function releaseActiveTab() {
        if (tabClaimTimer) { clearInterval(tabClaimTimer); tabClaimTimer = null; }
        try {
            const cur = readActiveTab();
            if (cur && cur.owner === TAB_ID) writeActiveTab({ owner: '', ts: 0, path: '' });
        } catch { }
    }

    // ---------- 手动对账：成绩页 DOM 识别不出来时的兜底入口 ----------
    const MANUAL_VERDICT_WORDS = [
        ['correct', ['对', '正确', '答对', '√', '✔', 'yes', 'y', 'ok']],
        ['wrong', ['错', '错误', '答错', '×', '✗', 'x', 'no', 'n', 'wrong']],
        ['unanswered', ['未答', '没答', '空白', '空', '漏答', '没做', '跳过', 'skip']],
    ];
    const manualVerdictOf = word => {
        const w = String(word || '').trim().toLowerCase();
        if (!w) return '';
        for (const [verdict, words] of MANUAL_VERDICT_WORDS) if (words.includes(w)) return verdict;
        return '';
    };
    /** 纯函数：解析手动对账文本 `1-5=对, 6=错, 7-10=未答` → { 题号: 'correct'|'wrong'|'unanswered' } */
    function parseManualVerdicts(raw) {
        const out = {};
        const text = String(raw || '').replace(/[；;、，,\s]+/g, ' ').trim();
        if (!text) return out;
        for (const token of text.split(' ')) {
            const m = token.match(/^(\d{1,3})(?:\s*[-~—至]\s*(\d{1,3}))?\s*(?:=|:|：|＝)\s*(.+)$/);
            if (!m) continue;
            const a = +m[1];
            const b = m[2] ? +m[2] : a;
            const verdict = manualVerdictOf(m[3]);
            if (!verdict || a < 1 || b < 1) continue;
            if (a > CONFIG.maxQuestionNum || b > CONFIG.maxQuestionNum) continue;
            const lo = Math.min(a, b), hi = Math.max(a, b);
            for (let n = lo; n <= hi; n++) out[n] = verdict;
        }
        return out;
    }

    /**
     * 落盘：先读盘合并再写回，两个标签页先后落盘时不会把对方的记录冲掉。
     * 同一道题两边都改过时以本标签页为准（本页刚答完，更新）。
     * 注意：读-改-写不是事务，两个标签页在同一瞬间落盘仍有一方覆盖另一方的小概率；
     * 日常使用（有先后）不受影响，别在考试时开两个标签页同时答就行。
     *
     * ① 合并放在容量淘汰之前，淘汰不再被合并撤销；
     *              ② 墓碑在合并时跳过、写盘成功后才清空（写失败保留，下次重试继续压制旧键）。
     * 以前是先淘汰再合并，刚淘汰的条目立刻被盘上副本搬回来，于是容量上限形同虚设，
     * 「答错删掉库里的错答案」也永远删不掉。
     */
    let flushRetryTimer = null;
    function flushBank() {
        if (!dirty) return;
        // 抢写锁：别的标签页正在落盘时先让路，稍后自动重试（脏标记还在，数据不丢）
        if (!acquireWriteLock()) {
            if (CONFIG.debug) dbg('检测到另一标签页正在写库，稍后重试');
            if (!flushRetryTimer) flushRetryTimer = setTimeout(() => { flushRetryTimer = null; flushBank(); }, 800);
            return;
        }
        try {
            if (bankCache) {
                const foreign = mergeFromStore('questionBank', bankCache, pendingDeletes, 'bank');
                dropTombstoned(bankCache, 'bank');   // 别的标签页删掉的键：本页也别再写回去（B7）
                const n = enforceCapacity(bankCache);
                if (n) log(`🧹 超出容量上限，已淘汰 ${n} 条低分记录`);
                GM_setValue('questionBank', bankCache);
                pendingDeletes.clear();          // 只有写盘成功才作废墓碑
                if (foreign) {
                    bankVer++; idxVer = -1;                 // 索引失效，下次重建
                    log(`🔄 已并入其它标签页写入的 ${foreign} 条题目（多标签页保护）`);
                    notify(`并入其它标签页的 ${foreign} 条题目`, 'warn');
                }
            }
            if (wrongCache) {
                const fw = mergeFromStore('wrongBank', wrongCache, pendingWrongDeletes, 'wrong');
                dropTombstoned(wrongCache, 'wrong');
                const nw = enforceWrongCapacity(wrongCache);
                if (nw) log(`🧹 错题记录超出容量上限，已淘汰 ${nw} 条`);
                GM_setValue('wrongBank', wrongCache);
                pendingWrongDeletes.clear();
                if (fw) log(`🔄 已并入其它标签页写入的 ${fw} 条错题记录（多标签页保护）`);
            }
            dirty = false;
        } catch (e) {
            log(`❌ 题库落盘失败：${(e && e.message) || e}`);   // 墓碑保留，下次重试继续压制旧键
            notify(`题库写入失败：${(e && e.message) || e}`, 'error');
        } finally {
            releaseWriteLock();
            // 写失败/中途又变脏：过一会儿再试一次，避免这次落盘丢了
            if (dirty && !flushRetryTimer) {
                flushRetryTimer = setTimeout(() => { flushRetryTimer = null; flushBank(); }, 2000);
            }
        }
    }

    // 别的标签页写库时，反过来把新条目并进来；它删掉的键要同步删掉并记墓碑，
    // 否则本页 flush 会把「对方刚删掉的旧答案」原样写回盘（B7）。
    if (typeof GM_addValueChangeListener === 'function') {
        try {
            const watchStore = (storeKey, which, label) => {
                GM_addValueChangeListener(storeKey, (name, oldV, newV, remote) => {
                    if (!remote) return;                    // 自己写的不用管
                    const cache = which === 'bank' ? bankCache : wrongCache;
                    const tombs = which === 'bank' ? pendingDeletes : pendingWrongDeletes;
                    const r = syncFromStorage(cache, tombs, which, oldV, newV);
                    if (!r.added && !r.removed) return;
                    if (which === 'bank') { bankVer++; idxVer = -1; }
                    log(`🔄 另一标签页更新了${label}：并入 ${r.added} 条${r.removed ? `，同步删除 ${r.removed} 条` : ''}`);
                    notify(`另一标签页更新了${label}（并入 ${r.added} 条${r.removed ? `、删除 ${r.removed} 条` : ''}）`, 'warn');
                });
            };
            watchStore('questionBank', 'bank', '题库');
            watchStore('wrongBank', 'wrong', '错题记录');
            // 墓碑表被别的标签页改过（清了某个键的墓碑 = 它又答对了）：作废本页缓存，下次重读
            GM_addValueChangeListener(TOMB_KEYS.bank, () => { tombMem.bank = null; });
            GM_addValueChangeListener(TOMB_KEYS.wrong, () => { tombMem.wrong = null; });
        } catch { }
    }

    /** 前缀索引：取归一化题干前 IDX_LEN 字做桶，避免每次全表扫描 */
    function bankIndex() {
        const b = ensureBank();
        if (idxCache && idxVer === bankVer) return idxCache;
        idxCache = new Map();
        for (const [k, e] of Object.entries(b)) {
            const nq = normStem(e.q || k);
            if (nq.length < 4) continue;
            const p = nq.slice(0, IDX_LEN);
            if (!idxCache.has(p)) idxCache.set(p, []);
            idxCache.get(p).push(k);
        }
        idxVer = bankVer;
        return idxCache;
    }

    function levenshtein(a, b) {
        const m = a.length, n = b.length;
        let prev = new Array(n + 1), cur = new Array(n + 1);
        for (let j = 0; j <= n; j++) prev[j] = j;
        for (let i = 1; i <= m; i++) {
            cur[0] = i;
            for (let j = 1; j <= n; j++) {
                cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            }
            const t = prev; prev = cur; cur = t;
        }
        return prev[n];
    }

    /** 相似度：完全相同 1；短的是长的前缀且够长（兼容旧的 50 字截断）算 1；否则按编辑距离 */
    function similarity(a, b) {
        if (!a || !b) return 0;
        if (a === b) return 1;
        const [s, l] = a.length <= b.length ? [a, b] : [b, a];
        if (s.length >= CONFIG.prefixMatchMin && l.startsWith(s)) return 1;
        if (s.length / l.length < 0.7) return 0;
        return 1 - levenshtein(a, b) / l.length;
    }

    /**
     * 查找与给定题干等价的已有条目（先精确，再前缀包含）。
     * 用于把「同一题因截断长度不同」产生的重复条目归并成一条。
     * 改为「前缀等价 + 唯一命中」——旧实现返回第一个命中，
     * 链式前缀（A⊂B⊂C）时结果取决于键的插入顺序，会把两道题合并到不同目标上。
     */
    function findEquivalent(q) {
        const b = ensureBank();
        const nk = fpKey(q);
        if (b[nk]) return nk;
        const nq = normStem(q);
        if (!nq) return null;
        let hit = null, n = 0;
        for (const [k, e] of Object.entries(b)) {
            if (!prefixSame(e.q || k, nq)) continue;
            n++;
            const len = normStem(e.q || k).length;
            if (!hit || len > hit.len) hit = { k, len };
        }
        return n === 1 ? hit.k : null;
    }

    /** 是否是「同一题的不同长度版本」：短的是长的前缀且达到 prefixMatchMin 字（抽出复用） */
    function prefixSame(a, b) {
        const x = normStem(a), y = normStem(b);
        if (!x || !y) return false;
        if (x === y) return true;
        const [s, l] = x.length <= y.length ? [x, y] : [y, x];
        return s.length >= CONFIG.prefixMatchMin && l.startsWith(s);
    }

    /**
     * 答错对账时定位库内条目（纯函数，自检可断言）
     * 返回 { key, keyFrom, e }。查找顺序：
     *   1) history 记录的 bankKey（模糊/旧键命中时它就是库里的键；旧实现只查规范键，所以永远删不掉）；
     *   2) 规范指纹键 fpKey(stem)；3) 旧 50 字键；
     *   4) 以上都失效（旧会话没 bankKey、题库导入后换键）→ 在传入的题库里按 prefixSame 找唯一同题。
     * 第 4 步必须「唯一 + 前缀等价」双闸，防止把相似题的条目误删（A1）。
     * keyFrom: history / exact / legacy / equivalent / ''（没找到）。
     */
    function locateBankEntryForWrong(rec, bank) {
        const b = bank || {};
        const stem = (rec && rec.stem) || '';
        if (!stem) return { key: '', keyFrom: '', e: null };
        const nk = fpKey(stem), lk = pureStem(stem).slice(0, 50);
        if (rec.bankKey && b[rec.bankKey]) return { key: rec.bankKey, keyFrom: 'history', e: b[rec.bankKey] };
        if (b[nk]) return { key: nk, keyFrom: 'exact', e: b[nk] };
        if (b[lk]) return { key: lk, keyFrom: 'legacy', e: b[lk] };
        let hit = '', n = 0;
        for (const k of Object.keys(b)) {
            const e = b[k];
            if (!e || !prefixSame(e.q || k, stem)) continue;
            hit = k; n++;
        }
        return (n === 1 && hit) ? { key: hit, keyFrom: 'equivalent', e: b[hit] } : { key: '', keyFrom: '', e: null };
    }

    /**
     * 库里的答案是否就是本次选错的那个答案（纯函数）
     * 只有一致才允许「删除 + 写墓碑」：不一致说明库内条目不是这次作答的依据（换题/被改过），
     * 删掉会把别的正确答案一起误伤（A1）。
     * 有选项文本时以文本为准（字母只是辅助）：选项乱序、题库迁移后字母可能和文本对不上，
     * 这时按字母判等会误删「字母相同、文本不同」的正确条目（P2#2）。
     * 只有旧条目（没有 a，只有 l）才退回按字母判等。
     */
    function bankAnswerIsWrongPick(rec, e) {
        if (!rec || !e) return false;
        const norm = t => String(t || '').replace(/\s+/g, '').trim();
        const texts = (rec.pickedText || []).filter(Boolean).map(norm);
        // R12：e.a 不一定是数组（手工导入/旧数据可能把答案写成字符串 'A'、数字或 null）。
        // 先安全归一成数组再按选项文本比对；空数组 / undefined / null 才退回旧条目的字母判等。
        const arr = Array.isArray(e.a)
            ? e.a.filter(Boolean)
            : (e.a === null || e.a === undefined || e.a === '' ? [] : [e.a]);
        if (arr.length) {
            if (!texts.length) return false;                  // 库内有文本、本次没有文本：无从比对，宁可不删
            const bank = arr.map(norm).filter(Boolean);
            return !!bank.length && sameTexts(bank, texts);
        }
        return !!e.l && e.l === rec.letters;                  // 旧条目只有字母：仍按字母判等
    }

    /**
     * 相似题能不能直接拿来用
     * 判断题的选项永远是「正确 / 错误」，一旦把「一字之差」的另一道题当成同题，
     * 答案会稳定答反而且毫无提示（例如「…一切权力属于人民」vs「…一切权力不属于人民」）。
     * 所以判断题只接受「前缀等价的截断版本」，不做编辑距离意义上的相似复用。
     */
    function fuzzyUsable(type, entryStem, stem) {
        return type !== 'judge' || prefixSame(entryStem, stem);
    }

    /** 判断题题干归一（纯函数，R1）：全角转半角，再走 normStem（去题号/题型/空白/标点） */
    const judgeStemNorm = s => normStem(String(s || '')
        .replace(/[\uff01-\uff5e]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
        .replace(/\u3000/g, ' '));

    /**
     * 判断题专用安全复用（纯函数，自检可断言，R1）
     * 判断题的选项永远是「正确/错误」，普通相似度分不清「属于人民」与「不属于人民」——
     * 复用错了就是稳定答反，而且毫无提示。所以只接受两种极强证据：
     *   ① 规范化题干（去空白/标点/全半角）完全相等；
     *   ② 双方长度都 ≥10 且编辑距离 ≤ maxDiff（默认 2）。
     * 并且题库里必须「唯一命中」：0 条或多条都返回 null，交回联网查询。
     * entries 形如 [[key, e], ...]；非 judge 查询直接返回 null（非判断题不启用）。
     */
    function judgeStemMatch(stem, type, entries, maxDiff = CONFIG.judgeFuzzyMaxDiff) {
        if (type !== 'judge') return null;
        const target = judgeStemNorm(stem);
        if (!target) return null;
        const limit = Math.max(0, Math.floor(+maxDiff || 0));
        const hits = [];
        for (const item of (entries || [])) {
            const key = Array.isArray(item) ? item[0] : (item && item.key);
            const e = Array.isArray(item) ? item[1] : (item && item.e);
            if (!key || !e || e.t !== 'judge') continue;
            const norm = judgeStemNorm(e.q || key);
            if (!norm) continue;
            if (norm === target) { hits.push({ key, e, diff: 0, sim: 1 }); continue; }
            if (target.length < 10 || norm.length < 10) continue;
            if (Math.abs(target.length - norm.length) > limit) continue;
            // 否定词数量不同 = 语义可能相反（「属于人民」vs「不属于人民」编辑距离只有 1），
            // 编辑距离再小也不能当成同一题——否则答案会稳定答反。这类一律维持联网。
            const negCount = s => (s.match(/[不无非未]/g) || []).length;
            if (negCount(target) !== negCount(norm)) continue;
            const diff = levenshtein(target, norm);
            if (diff <= limit) {
                hits.push({ key, e, diff, sim: 1 - diff / Math.max(target.length, norm.length) });
            }
        }
        if (hits.length !== 1) return null;                        // 0 = 没命中；>1 = 有歧义，宁可联网
        return { key: hits[0].key, e: hits[0].e, how: 'judge-fuzzy', diff: hits[0].diff, sim: hits[0].sim };
    }

    /**
     * 查题库：指纹精确 → 旧键 → 相似题（前缀索引 + 阈值 + 唯一性把关）
     * 返回 { key, e, how } 或 null
     */
    function lookupBank(stem, type) {
        const b = ensureBank();
        const k1 = fpKey(stem);
        if (b[k1]) return { key: k1, e: b[k1], how: 'exact' };

        const k2 = pureStem(stem).slice(0, 50);
        if (b[k2]) return { key: k2, e: b[k2], how: 'legacy' };

        const nq = normStem(stem);
        const cands = bankIndex().get(nq.slice(0, IDX_LEN)) || [];
        let best = null, second = 0;
        for (const k of cands) {
            const sim = similarity(nq, normStem(b[k].q || k));
            if (!best || sim > best.sim) { second = best ? best.sim : 0; best = { key: k, e: b[k], sim }; }
            else if (sim > second) second = sim;
        }
        // 必须达到阈值，且第二名不能也过线（否则歧义，宁可当作没查到）
        if (best && best.sim >= CONFIG.fuzzyThreshold && second < CONFIG.fuzzyThreshold) {
            if (fuzzyUsable(type, best.e.q || best.key, stem)) {
                return { key: best.key, e: best.e, how: 'fuzzy', sim: best.sim };
            }
            // 判断题不走普通相似度：相似 ≠ 同题，语义相反的题干相似度也可能很高（R1）
            log(`⚠️ 「相似题」命中被跳过（判断题不做相似复用，相似度 ${(best.sim * 100).toFixed(0)}%），改查判断题干规范化复用`);
        }
        // R1：判断题安全复用。仅当「规范化后相等」或「长度≥10 且编辑距离≤2」且唯一命中时采用；
        // 多命中/超差维持联网，避免把「…属于人民」和「…不属于人民」当成同一题。
        if (type === 'judge') {
            const judgeHit = judgeStemMatch(stem, type, Object.entries(b));
            if (judgeHit) {
                const ansTxt = judgeHit.e.l || (Array.isArray(judgeHit.e.a) ? judgeHit.e.a.join('/') : judgeHit.e.a) || '';
                log(`📚 判断题题干安全复用命中（${judgeHit.diff ? `差 ${judgeHit.diff} 字` : '规范化后相同'}）：${ansTxt}`);
                return judgeHit;
            }
        }
        return null;
    }

    /**
     * 命中旧键/相似题后，把条目升级到指纹键，并同步迁移错误记录。
     * 安全闸门：只有「同一题的截断/旧键」才允许改键改名。
     * 以前相似题命中（similarity ≥ 0.9 就够）也会走到这里，会把另一道题的条目搬到本题键上、
     * 题干被改写、旧键被删——两道题来回改键，必有一道被答错。
     */
    function upgradeKey(oldKey, stem) {
        const b = ensureBank();
        const nk = fpKey(stem);
        if (nk === oldKey || b[nk]) return oldKey;
        const e = b[oldKey];
        if (!e) return oldKey;
        if (!prefixSame(e.q || oldKey, stem)) return oldKey;     // 不是同一题的截断版本，不动它
        e.q = pureStem(stem);
        b[nk] = e;
        delete b[oldKey]; pendingDeletes.add(oldKey); addTombstone('bank', oldKey); clearTombstone('bank', nk);
        const wb = ensureWrong();
        if (wb[oldKey]) {
            const prev = wb[nk] || blankWrong();
            wb[nk] = {
                q: e.q || prev.q,
                w: [...new Set([...(prev.w || []), ...(wb[oldKey].w || [])])],
                tried: [...new Set([...(prev.tried || []), ...(wb[oldKey].tried || [])])],
            };
            delete wb[oldKey]; pendingWrongDeletes.add(oldKey); addTombstone('wrong', oldKey); clearTombstone('wrong', nk);
        }
        dirty = true; bankVer++;
        return nk;
    }

    /**
     * 选项文本 → 选项
     * 旧实现是「双向子串包含 + opts.find 取第一个」，中文短选项下会把答案映射到错的字母：
     * 记录「5年」而选项是「15年 / 5年 / 10年」时，会先命中「15年」。
     * 现在：精确全等优先；其次只认「唯一、长度差最小」的包含关系；有多义就返回 null 交网络。
     */
    function matchOption(opts, text) {
        const nt = normStem(text);
        if (!nt) return null;
        const exact = opts.filter(o => normStem(o.text) === nt);
        if (exact.length === 1) return exact[0];
        if (exact.length > 1) return null;                       // 两个选项文本一样，无解
        const cands = [];
        for (const o of opts) {
            const no = normStem(o.text);
            if (!no || no === nt) continue;
            if (Math.min(no.length, nt.length) < 2) continue;     // 单字包含太容易误判
            if (no.includes(nt)) cands.push({ o, diff: no.length - nt.length });
            else if (nt.includes(no)) cands.push({ o, diff: nt.length - no.length });
        }
        if (!cands.length) return null;
        const min = Math.min(...cands.map(c => c.diff));
        const best = cands.filter(c => c.diff === min);
        return best.length === 1 ? best[0].o : null;             // 并列就算认不出来
    }

    /** 条目 → 当前页面的选项字母（选项乱序也能对上） */
    function entryToLetters(e, opts) {
        if (e.a && e.a.length) {
            const ls = [];
            for (const t of e.a) {
                const hit = matchOption(opts, t);
                if (!hit) return { letters: null, reason: `选项已变动或有歧义（记录的是「${t}」）` };
                ls.push(hit.letter);
            }
            return { letters: [...new Set(ls)].sort().join(''), how: 'text' };
        }
        return e.l ? { letters: e.l, how: 'letter' } : { letters: null, reason: '空记录' };
    }

    /**
     * 答对：写入/修正正确答案；同题答案内容不一致时记录冲突。
     * by='user' 表示本次作答的答案是你手动选的；写库后条目标为「用户答案」，优先级最高。
     *
     * 本函数只在「交卷后判定答对」时被调用，也就是说手上这个答案是**已被验证正确**的，
     * 所以它一律覆盖库内旧值（旧值要么没被验证过，要么刚被证明是错的）。
     * 「用户答案优先」只用于「导入 vs 库内」这种双方都未验证的场合（见 importCsv / importJson）。
     * 以前这里会「保留库内的用户答案、拒绝写入已验证的正确值」，反而把错答案锁死了。
     *
     * @returns {number} 0 = 没有写入（内容一致），1 = 已写入/修正，2 = 已写入且发生了答案冲突
     */
    function saveCorrect(stem, letters, texts, type, by) {
        const b = ensureBank();
        const nk = fpKey(stem);
        let k = findEquivalent(stem);
        if (k && k !== nk) k = upgradeKey(k, stem);    // 归并到规范键，同时把截断题干补全
        if (!k) k = nk;
        clearTombstone('bank', k);          // 同键再次写入（答对/手改）：解除墓碑，别被别的标签页压掉（B7）
        const e = b[k];
        const user = by === 'user';
        let saved = 0, conflict = false;

        if (!e) {
            b[k] = blankEntry({
                q: pureStem(stem), t: type, a: texts.length ? texts : null, l: letters,
                ok: 1, hit: 1, us: TS(), by: user ? 'user' : '', src: user ? 'user' : 'exam',
            });
            saved = 1;
        } else {
            const oldDisp = (e.a && e.a.length ? e.a.join('；') : e.l) || '（空）';
            const sameA = sameTexts(e.a, texts);
            const wasUser = isUserEntry(e);
            if (e.l !== letters || !sameA) {
                if (e.a && e.a.length && !sameA) {
                    e.cft++;
                    conflict = true;
                    log(`⚔️ 答案冲突（第${e.cft}次）：原「${oldDisp}」→ 新「${texts.join('；') || letters}」`);
                }
                if (wasUser && !user) log(`ℹ️ 本题原为您手改的「${oldDisp}」，本场判定它不对，已改用答对的「${texts.join('；') || letters}」`);
                if (texts.length) e.a = texts;
                else if (e.a && e.a.length) e.a = null;   // 新答案没有选项文本：清掉旧文本，避免导出/展示用错选项
                e.l = letters;
                e.t = type;
                e.by = user ? 'user' : '';        // 来源跟着「这次最终是谁选的」走
                e.src = user ? 'user' : 'exam';
                saved = 1;
            } else if (user) {
                e.by = 'user'; e.src = 'user';    // 内容一致，只是确认这次是你选的
                saved = 1;
            }
            e.ok++; e.hit++; e.us = TS();
        }
        dropWrongFor(stem);                       // 判定答对了，这题的错题记录该清掉（两个键都清）
        dirty = true; bankVer++;
        return conflict ? 2 : saved;
    }

    /**
     * 用户手动作答 / 改答案时立刻入库
     * 平台在交卷前不告诉对错，所以这条只标 by='user'，不涨 ok/hit（ok 是「验证答对次数」）。
     * 交卷对账判定答对时走 saveCorrect(..., 'user') 转正；判定答错时删掉本条并记错误项。
     */
    function saveUserAnswer(stem, letters, texts, type) {
        if (!stem || !letters || !(texts || []).length) return false;
        const b = ensureBank();
        const nk = fpKey(stem);
        let k = findEquivalent(stem);
        if (k && k !== nk) k = upgradeKey(k, stem);
        if (!k) k = nk;
        clearTombstone('bank', k);          // 同键再次写入（答对/手改）：解除墓碑，别被别的标签页压掉（B7）
        const e = b[k];
        if (!e) {
            b[k] = blankEntry({ q: pureStem(stem), t: type || 'single', a: texts, l: letters, src: 'user', by: 'user', ts: TS(), us: TS() });
        } else {
            e.a = texts;
            e.l = letters;
            if (type) e.t = type;
            e.src = 'user';
            e.by = 'user';
            e.us = TS();
            if (!e.q) e.q = pureStem(stem);
        }
        // 用户自己选了，说明这题的错项记录不该再拦它（否则下次回答会被排除法吃掉）
        dropWrongFor(stem);
        dirty = true; bankVer++;
        return true;
    }

    /** 读出某题的已知错误选项（兼容旧键，并兜底按题干等价匹配） */
    function wrongFor(stem) {
        const wb = ensureWrong();
        const out = new Set([
            ...(wb[fpKey(stem)]?.w || []),
            ...(wb[pureStem(stem).slice(0, 50)]?.w || []),
        ]);
        if (!out.size) {
            // 直接键没命中时，按「同一题的截断版本」找（以前用 similarity ≥0.9，
            // 会把别的相似题的错项注入本题——判断题尤其致命，「正确/错误」两字词的相似题错项一注入就必错）
            for (const v of Object.values(wb)) {
                if (!v.q || !v.w.length) continue;
                if (prefixSame(v.q, stem)) v.w.forEach(x => out.add(x));
            }
        }
        return [...out];
    }

    /**
     * 读出某题「已试过且失败的多选组合」
     * 组合用组内选项文本排序后以 + 连接，选项乱序不影响比较
     */
    function triedFor(stem) {
        const wb = ensureWrong();
        const out = new Set([
            ...(wb[fpKey(stem)]?.tried || []),
            ...(wb[pureStem(stem).slice(0, 50)]?.tried || []),
        ]);
        if (!out.size) {
            // 同上：只认同一题的截断版本，不做跨题的相似度注入
            for (const v of Object.values(wb)) {
                if (!v.q || !v.tried.length) continue;
                if (prefixSame(v.q, stem)) v.tried.forEach(x => out.add(x));
            }
        }
        return [...out];
    }

    /**
     * 清掉某题的错题记录——「规范键 + 旧 50 字键」两处都要清
     * 读侧 `wrongFor`/`triedFor` 两个键都会读，旧版本数据与导入数据可能只落在旧键上；
     * 只清规范键的话，旧键上的错项在被判定答对后仍然残留，继续把正确选项排除掉。
     */
    function dropWrongFor(stem) {
        const wb = ensureWrong();
        const nk = fpKey(stem), lk = pureStem(stem).slice(0, 50);
        let n = 0;
        for (const k of [nk, lk]) if (k && wb[k]) { delete wb[k]; pendingWrongDeletes.add(k); addTombstone('wrong', k); n++; }
        if (n) dirty = true;
        return n;
    }

    /** 记录一个已失败的多选组合 */
    function saveTried(stem, comboText) {
        if (!comboText) return 0;
        const wb = ensureWrong();
        const nk = fpKey(stem), lk = pureStem(stem).slice(0, 50);
        const prev = wb[nk] || wb[lk] || blankWrong();
        wb[nk] = {
            q: pureStem(stem) || prev.q,
            w: prev.w || [],
            tried: [...new Set([...(prev.tried || []), comboText])],
        };
        if (lk !== nk) { delete wb[lk]; pendingWrongDeletes.add(lk); addTombstone('wrong', lk); }   // 登记墓碑，别被盘上旧键搬回来
        clearTombstone('wrong', nk);
        dirty = true;
        return 1;
    }

    /** 答错：累计错误选项内容（连同题干一起存，保证导出后换台电脑也能用） */
    function saveWrong(stem, texts) {
        if (!texts || !texts.length) return 0;
        const wb = ensureWrong();
        const nk = fpKey(stem), lk = pureStem(stem).slice(0, 50);
        const prev = wb[nk] || wb[lk] || blankWrong();
        wb[nk] = {
            q: pureStem(stem) || prev.q,
            w: [...new Set([...(prev.w || []), ...texts])],
            tried: prev.tried || [],
        };
        if (lk !== nk) { delete wb[lk]; pendingWrongDeletes.add(lk); addTombstone('wrong', lk); }   // 登记墓碑，别被盘上旧键搬回来
        clearTombstone('wrong', nk);
        enforceWrongCapacity(wb);
        dirty = true;
        return texts.length;
    }

    // ==================== 导入导出 ====================
    // 原来导出手工拼串、导入靠三条正则。现在：
    //   · 导出走 RFC4180 编码（引号、逗号、换行都安全）
    //   · 导入走通用分隔符解析 + 表头列名映射，外部的 CSV/TSV 也能读
    //   · 另给一份 JSON：字段完整，可无损往返
    //   · 编码自动识别（UTF-8 / UTF-16 / GBK / GB18030 / Big5）

    /** RFC4180 单元格编码：一律加引号，内部引号翻倍，换行保留 */
    const csvCell = v => `"${String(v === null || v === undefined ? '' : v).replace(/"/g, '""')}"`;

    /** 通用分隔符解析：引号内的分隔符与换行不当分隔 */
    function parseDelimited(text, delim) {
        const s = String(text || '').replace(/^\ufeff/, '');
        const rows = [];
        let row = [], cell = '', inQ = false;
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (inQ) {
                if (c === '"') {
                    if (s[i + 1] === '"') { cell += '"'; i++; }   // 转义的引号
                    else inQ = false;
                } else cell += c;
                continue;
            }
            if (c === '"') { inQ = true; continue; }
            if (c === delim) { row.push(cell); cell = ''; continue; }
            if (c === '\r') continue;
            if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue; }
            cell += c;
        }
        if (cell.length || row.length) { row.push(cell); rows.push(row); }
        return rows.map(r => r.map(x => String(x).trim()));
    }

    /** 猜分隔符：看前几行哪种分隔符出现得最多 */
    function sniffDelim(text) {
        const head = String(text).split(/\r?\n/).slice(0, 6).join('\n');
        // 只统计「引号外」的分隔符：导出文件里选项内容用 '; ' 连接，
        // 老算法把引号内的分号也算进去，多选题一多就会把自己导出的 CSV 判成分号文件
        const counts = { ',': 0, '\t': 0, ';': 0, '|': 0 };
        let inQ = false;
        for (let i = 0; i < head.length; i++) {
            const c = head[i];
            if (c === '"') { inQ = !inQ; continue; }
            if (!inQ && counts[c] !== undefined) counts[c]++;
        }
        let best = ',', bestN = counts[','];
        for (const d of ['\t', ';', '|']) if (counts[d] > bestN) { bestN = counts[d]; best = d; }
        return best;
    }

    /** 表头列名 → 列号（兼容外部题库的常见叫法） */
    function mapColumns(header) {
        const h = header.map(x => String(x || '').replace(/[\s　]/g, '').toLowerCase());
        const at = (...keys) => h.findIndex(x => x && keys.some(k => x.includes(k)));
        const map = {
            idx: at('序号', '编号', '题号', 'index', 'no', 'id'),
            type: at('题型', '类型', 'type'),
            q: at('题目', '题干', '问题', 'question', 'stem', 'title'),
            a: at('正确答案', '答案', 'answer', '正确'),
            w: at('错误', '错题', 'wrong', '错误选项'),
            src: at('来源', '出处', 'source', 'by'),      // 「用户 / 脚本」，用于保住手改答案的优先级
        };
        // 「正确答案」列别被「错误选项」抢走
        if (map.a === map.w && map.a >= 0) map.a = h.findIndex(x => x.includes('正确'));
        return map;
    }
    function isHeaderRow(r) {
        if (!r || r.length < 2) return false;
        const m = mapColumns(r);
        return m.q >= 0 && (m.a >= 0 || m.w >= 0 || m.type >= 0);
    }

    const TYPE_MAP = {
        '单选': 'single', '单项选择题': 'single', '单项选择': 'single', 'single': 'single', 'radio': 'single',
        '多选': 'multi', '多项选择题': 'multi', '多项选择': 'multi', '不定项': 'multi', 'multi': 'multi', 'checkbox': 'multi',
        '判断': 'judge', '判断题': 'judge', '是非题': 'judge', 'judge': 'judge', 'boolean': 'judge',
    };
    /** 题型判定：题型列 → 题干文字 → 答案形态，不再只看答案长度 */
    function resolveType(rawT, ans, q) {
        const t = String(rawT || '').replace(/[\s　()（）]/g, '').toLowerCase();
        if (t) {
            for (const k of Object.keys(TYPE_MAP)) {
                const kk = k.toLowerCase();
                if (t === kk || t === kk + '题' || t.includes(kk)) return TYPE_MAP[k];
            }
        }
        if (/多选|多项选择|不定项/.test(q)) return 'multi';
        if (/判断|对错|是否正确|是非/.test(q)) return 'judge';
        if (/^[01]$/.test(ans)) return 'judge';
        if (/^[A-Za-z]{1,8}$/.test(ans)) return ans.length > 1 ? 'multi' : 'single';
        return String(ans).split(/\s*[;；]\s*/).filter(Boolean).length > 1 ? 'multi' : 'single';
    }

    /** 题干清洗：去控制字符与乱码替换符 */
    const cleanStem = s => String(s || '')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\uFFFD+/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const splitAns = s => String(s || '').split(/\s*[;；]\s*/).map(x => x.trim()).filter(Boolean);

    /** 逐行校验，不合格的行报出原因而不是静默入库 */
    function validateRow(q, ans, wr) {
        if (!q) return { ok: false, why: '题干为空' };
        if (q.length < 4) return { ok: false, why: '题干过短' };
        if (!/[\u4e00-\u9fa5A-Za-z0-9]/.test(q)) return { ok: false, why: '题干没有有效文字' };
        if (!ans && !wr) return { ok: false, why: '答案与错误选项都为空' };
        if (ans) {
            if (/^[A-Za-z]{1,8}$/.test(ans)) {
                const u = ans.toUpperCase();
                if (new Set(u).size !== u.length) return { ok: false, why: `答案字母重复：${ans}` };
                if (!/^[A-H]{1,8}$/.test(u)) return { ok: false, why: `答案字母超出范围：${ans}` };
            } else if (!/^[01]$/.test(ans)) {
                const parts = splitAns(ans);
                if (!parts.length) return { ok: false, why: '答案为空' };
                if (parts.some(p => p.length > 200)) return { ok: false, why: '答案内容过长' };
                if (parts.some(p => !/[\u4e00-\u9fa5A-Za-z0-9]/.test(p))) return { ok: false, why: '答案内容无效' };
            }
        }
        return { ok: true };
    }

    /**
     * 文件编码识别：BOM 优先 → UTF-8（严格模式，出现坏字节就判失败）→ GB18030（含 GBK）→ Big5。
     * 以前 gb18030 排在最前且不带 fatal：UTF-8 文本里只要出现一个替换符就会被当成国标解码，
     * 个别文件整片乱码；big5 也永远轮不到。现在用 fatal 让「不适合的编码」直接抛错。
     */
    function decodeFile(buf) {
        const u8 = new Uint8Array(buf);
        const td = (enc, arr) => {
            try { return new TextDecoder(enc, { fatal: true }).decode(arr); } catch { return null; }
        };
        if (u8[0] === 0xff && u8[1] === 0xfe) return td('utf-16le', u8) || '';
        if (u8[0] === 0xfe && u8[1] === 0xff) return td('utf-16be', u8) || '';
        if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return td('utf-8', u8) || '';
        const utf8 = td('utf-8', u8);
        if (utf8 !== null) return utf8;
        for (const enc of ['gb18030', 'big5']) {          // 国标优先，其次繁体
            const t = td(enc, u8);
            if (t !== null) return t;
        }
        return new TextDecoder('utf-8').decode(u8) || '';   // 全失败时保留替换符，让用户看到哪段坏了
    }

    /** 写入错误库（正确题与只有错误记录的题共用） */
    function mergeWrong(wb, key, q, wr) {
        const parts = String(wr || '').split(/\s*[;；]\s*/).map(x => x.trim()).filter(Boolean);
        if (!parts.length) return 0;
        const prev = wb[key] || blankWrong();
        wb[key] = {
            q: q || prev.q,
            w: [...new Set([...(prev.w || []), ...parts.filter(x => !x.includes('+'))])],
            tried: [...new Set([...(prev.tried || []), ...parts.filter(x => x.includes('+'))])],
        };
        return parts.length;
    }

    /**
     * 导入 CSV 答案库，增量合并：同一题只补全题干/错误选项，不重复入库
     * 兼容多种列型：序号,题型,"题目","答案","错误" / 序号,"题目","答案" / "题目","答案"
     * 返回 { added, dup, updated, conflict, bad, wrongOnly, errors, userCount, total }（与 importJson 同口径）
     */
    function importCsv(text) {
        const b = ensureBank(), wb = ensureWrong();
        const delim = sniffDelim(text);
        const rows = parseDelimited(text, delim);
        const errors = [];
        const addErr = (line, why, src) => { if (errors.length < 200) errors.push({ line, why, text: String(src || '').slice(0, 30) }); };
        let added = 0, dup = 0, updated = 0, conflict = 0, bad = 0, wrongOnly = 0, userCount = 0;

        // 有表头就按列名映射，没有就按列数猜
        let map, start = 0;
        if (rows.length && isHeaderRow(rows[0])) { map = mapColumns(rows[0]); start = 1; }
        else {
            const n = (rows[0] || []).length;
            map = n >= 5 ? { idx: 0, type: 1, q: 2, a: 3, w: 4 }
                : n === 4 ? { idx: 0, type: 1, q: 2, a: 3, w: -1 }
                    : n === 3 ? { idx: 0, q: 1, a: 2, w: -1 }
                        : { q: 0, a: 1, w: -1 };
            if (n >= 6) map.src = 5;                     // 第 6 列是「来源」（导出会多这一列）
        }
        dbg(`分隔符「${delim === '\t' ? 'Tab' : delim}」· 共 ${rows.length} 行 · 列映射 ${JSON.stringify(map)}`);

        for (let i = start; i < rows.length; i++) {
            const r = rows[i] || [];
            if (!r.length || r.every(x => !x)) continue;
            const line = i + 1;
            const q = cleanStem(map.q >= 0 ? r[map.q] : '');
            const ans = String(map.a >= 0 ? (r[map.a] || '') : '').trim();
            const wr = map.w >= 0 ? String(r[map.w] || '').trim() : '';
            const rawSrc = map.src >= 0 ? String(r[map.src] || '').trim() : '';
            const byUser = /用户|手动|user/i.test(rawSrc);   // 「来源」列标明这条是用户手改的答案
            const chk = validateRow(q, ans, wr);
            if (!chk.ok) { bad++; addErr(line, chk.why, q || r.join(' ')); continue; }

            if (!ans) {                                  // 只有错误记录的行
                const key = findEquivalent(q) || fpKey(q);
                mergeWrong(wb, key, q, wr);
                wrongOnly++;
                continue;
            }

            const type = resolveType(map.type >= 0 ? r[map.type] : '', ans, q);
            const isLett = /^[A-Za-z]{1,8}$/.test(ans);
            const isJudge = /^[01]$/.test(ans);
            const incA = isLett || isJudge ? null : splitAns(ans);
            const incL = isLett || isJudge ? ans.toUpperCase() : '';

            const exist = findEquivalent(q);
            if (exist) {                                 // 已存在：按合并策略处理
                const e = b[exist];
                const oldDisp = (e.a && e.a.length ? e.a.join('/') : e.l) || '（空）';
                if (normStem(q).length > normStem(e.q || '').length) e.q = q;
                const hasOld = (e.a && e.a.length) || e.l;
                const same = incA ? sameTexts(e.a, incA) : String(incL) === String(e.l || '');
                if (byUser && !isUserEntry(e)) {          // 导入的是用户手改答案 → 优先级最高，直接覆盖
                    if (incA) e.a = incA; else { e.a = null; e.l = incL; }
                    e.t = type;
                    e.by = 'user'; e.src = 'user';
                    updated++;
                    userCount++;
                    log(`👤 第${line}行：采用导入的用户手改答案（原「${oldDisp}」）`);
                } else if (isUserEntry(e) && !byUser) {   // 库内是用户答案，导入的是脚本答案 → 不覆盖
                    conflict++;
                    addErr(0, `库内是您手改过的答案（${oldDisp}），已保留库内、忽略导入的 ${ans}`, q);
                } else if (!hasOld) {                    // 库里是空的，补齐
                    if (incA) e.a = incA; else e.l = incL;
                    e.t = type;
                    updated++;
                } else if (same) dup++;
                else {
                    conflict++;                          // 保留库内那份（来自真实答题结果，可信度更高）
                    addErr(0, `答案与库内不一致（库内 ${oldDisp} ↔ 导入 ${ans}），已保留库内答案`, q);
                }
                mergeWrong(wb, exist, q, wr);
                continue;
            }
            const k = fpKey(q);
            b[k] = blankEntry({ q, t: type, a: incA, l: incL, src: byUser ? 'user' : 'import', by: byUser ? 'user' : '', ok: 0 });
            if (byUser) userCount++;
            mergeWrong(wb, k, q, wr);
            added++;
        }
        dirty = true; bankVer++;
        flushBank();
        return { added, dup, updated, conflict, bad, wrongOnly, errors, userCount, total: Object.keys(b).length };
    }

    function exportCsv() {
        const b = ensureBank(), wb = ensureWrong();
        const typeName = { single: '单选', multi: '多选', judge: '判断' };
        // 第 6 列「来源」：用户 / 脚本——导入时据此保住手改答案的优先级
        const lines = ['序号,题型,题目,正确答案,错误选项,来源'];
        let i = 0, wrongOnly = 0, userCount = 0, riskySep = 0;
        for (const [k, e] of Object.entries(b)) {
            i++;
            // 正确答案优先导出「选项内容」，没有内容（旧数据/纯字母导入）才导出字母
            const ans = (e.a && e.a.length ? e.a.join('; ') : (e.l || ''));
            const errCell = [...(wb[k]?.w || []), ...(wb[k]?.tried || [])].join('; ');
            if (isUserEntry(e)) userCount++;
            // 选项内容里自带 ; 或 + 时，CSV 往返会被拆成两项（JSON 备份不受影响）
            if (e.a && e.a.some(t => /[;+；]/.test(t))) riskySep++;
            lines.push([i, csvCell(typeName[e.t] || '单选'), csvCell(e.q || ''), csvCell(ans), csvCell(errCell),
                csvCell(isUserEntry(e) ? '用户' : '脚本')].join(','));
        }
        for (const [k, v] of Object.entries(wb)) {
            if (b[k] || !v.q || (!v.w.length && !v.tried.length)) continue;
            i++; wrongOnly++;
            lines.push([i, csvCell(''), csvCell(v.q), csvCell(''), csvCell([...v.w, ...v.tried].join('; ')), csvCell('')].join(','));
        }
        return { csv: '\ufeff' + lines.join('\r\n') + '\r\n', count: i, wrongOnly, userCount, riskySep };
    }

    /** 完整备份：字段一个不少，可无损往返 */
    function exportJson() {
        const b = ensureBank(), wb = ensureWrong();
        return JSON.stringify({
            format: 'faxuanyun-legal-exam-bank',
            schema: SCHEMA,
            version: VERSION,
            exportedAt: new Date().toISOString(),
            count: Object.keys(b).length,
            bank: b,
            wrong: wb,
        });
    }

    /**
     * 导入载荷 → { bank, wrong }（纯函数，自检可断言；解析与写库分离）
     *
     * 支持三种形态：
     *   1) 本脚本导出的完整备份 { format, schema, version, bank, wrong }
     *   2) { bank, wrong } 精简形态
     *   3) 干脆就是一张 { 题干: 答案 } 的字典
     *
     * 判定只认「有没有 bank 容器 / 本来就是一页题干字典」，**不校验 format 的取值**：
     * 这个自述字段从 faxuanyun-answer-bank 改成了 faxuanyun-legal-exam-bank，但 v1.x 导出的
     * 旧文件（format 仍是旧值，data/ 里的题库快照就是）必须继续能导入——真正的结构版本看 schema。
     * 带 format 却没有 bank 的载荷一律当空，避免把 schema/version/exportedAt 这些字段
     * 当成题目导进去。
     */
    function parseBankPayload(raw) {
        let obj = raw;
        // 数组形态：[{题目,答案}, …] —— 以前会被换成空 bank 静默丢弃，现在当题库逐条导入
        if (Array.isArray(obj)) {
            const m = {};
            obj.forEach((it, i) => { m[String(i)] = it; });
            obj = { bank: m };
        }
        if (!obj || typeof obj !== 'object') return { bank: {}, wrong: {} };
        const wrong = (obj.wrong && typeof obj.wrong === 'object') ? obj.wrong : {};
        if (obj.bank && typeof obj.bank === 'object') return { bank: obj.bank, wrong };
        if (obj.format) return { bank: {}, wrong };   // 备份文件但缺 bank：宁可为空，也不乱猜
        // 一页题干字典：本脚本当前的键形如「#<题干指纹>」，v1.x 用的是 q2-…
        // 其他键（schema/version/…）是元数据，不能当题目
        const bank = {};
        for (const [k, v] of Object.entries(obj)) {
            if (k === 'wrong' || k === 'format' || k === 'schema' || k === 'version'
                || k === 'exportedAt' || k === 'count') continue;
            if (k.startsWith('q2-')) { bank[k] = v; continue; }
            const s = String(k);
            if (s.length >= 4 && (v === null || typeof v !== 'object')) bank[k] = v;
        }
        return { bank, wrong };
    }

    function importJson(text) {
        const b = ensureBank(), wb = ensureWrong();
        const errors = [];
        const addErr = (why, src) => { if (errors.length < 200) errors.push({ line: 0, why, text: String(src || '').slice(0, 30) }); };
        let obj;
        try { obj = JSON.parse(text); } catch (e) {
            return { added: 0, dup: 0, updated: 0, conflict: 0, bad: 1, wrongOnly: 0, errors: [{ line: 1, why: `JSON 解析失败：${e.message}` }], total: Object.keys(b).length };
        }
        const parsed = parseBankPayload(obj);
        const srcBank = parsed.bank, srcWrong = parsed.wrong;
        let added = 0, dup = 0, updated = 0, conflict = 0, bad = 0, wrongOnly = 0, userCount = 0;

        for (const [k, v] of Object.entries(srcBank || {})) {
            if (v === null || v === undefined) continue;
            const plain = typeof v !== 'object';                      // 字典形态：值是答案
            // 兼容外部 JSON 常见的中文字段名
            const q = cleanStem(plain ? k : (v.q || v.题干 || v.题目 || v.问题 || ''));
            const rawA = plain ? v
                : (v.a && v.a.length ? v.a.join('; ') : (v.l || v.答案 || v.正确答案 || ''));
            const ans = String(rawA || '').trim();
            const byUser = !plain && (v.by === 'user' || v.src === 'user' || /用户|手动/i.test(String(v.来源 || '')));
            const chk = validateRow(q, ans, '');
            if (!chk.ok) { bad++; addErr(chk.why, q || k); continue; }
            const itype = (v && !plain && v.t) || resolveType('', ans, q);
            const exist = b[k] && b[k].q ? k : findEquivalent(q);
            if (exist) {
                const e = b[exist];
                const hasOld = (e.a && e.a.length) || e.l;
                const incA = /^[A-Za-z]{1,8}$/.test(ans) || /^[01]$/.test(ans) ? null : splitAns(ans);
                const incL = incA ? '' : ans.toUpperCase();
                const oldDisp = (e.a && e.a.length ? e.a.join('/') : e.l) || '（空）';
                const same = incA ? sameTexts(e.a, incA) : String(incL) === String(e.l || '');
                if (normStem(q).length > normStem(e.q || '').length) e.q = q;
                if (byUser && !isUserEntry(e)) {          // 导入的是用户答案 → 优先采用
                    if (incA) e.a = incA; else { e.a = null; e.l = incL; }
                    e.t = itype;
                    e.by = 'user'; e.src = 'user';
                    updated++; userCount++;
                } else if (isUserEntry(e) && !byUser) {   // 库内是用户答案 → 脚本答案不覆盖
                    conflict++;
                    addErr(0, `库内是您手改过的答案（${oldDisp}），已保留库内、忽略导入的 ${ans}`, q);
                } else if (!hasOld) { if (incA) e.a = incA; else e.l = incL; e.t = itype; updated++; }
                else if (same) dup++;
                else {
                    // 与 CSV 导入同口径：答案不一致既不覆盖也不静默丢弃，计数并提示（以前直接 dup++ 静默保留旧值）
                    conflict++;
                    addErr(0, `答案与库内不一致（库内 ${oldDisp} ↔ 导入 ${ans}），已保留库内答案`, q);
                }
                continue;
            }
            const isLett = /^[A-Za-z]{1,8}$/.test(ans);
            const isJudge = /^[01]$/.test(ans);
            if (byUser) userCount++;
            // 完整还原条目字段（以前丢 s/us/bad，答案里有内容时连 l 也丢）
            b[fpKey(q)] = plain
                ? blankEntry({
                    q, t: resolveType('', ans, q),
                    a: isLett || isJudge ? null : splitAns(ans),
                    l: isLett || isJudge ? ans.toUpperCase() : '',
                    src: 'import',
                })
                : blankEntry({
                    ...v, q,
                    t: itype,
                    a: isLett || isJudge ? null : splitAns(ans),
                    l: isLett || isJudge ? ans.toUpperCase() : (v.l || ''),
                    src: v.src || 'import',
                });
            added++;
        }
        for (const [k, v] of Object.entries(srcWrong || {})) {
            if (!v) continue;
            const wq = String(v.q || '').trim();
            // 题干为空的错题记录以前被整条丢掉；现在按原键保留
            const key = b[k] ? k : (wq ? (findEquivalent(wq) || k) : k);
            const n = mergeWrong(wb, key, wq, [...(v.w || []), ...(v.tried || [])].join('; '));
            if (n) wrongOnly++;
        }
        dirty = true; bankVer++;
        flushBank();
        return { added, dup, updated, conflict, bad, wrongOnly, errors, userCount, total: Object.keys(b).length };
    }

    /** 导入入口：按内容自动判别 CSV / JSON */
    function importData(text) {
        const t = String(text || '').replace(/^\ufeff/, '').trim();
        resetTombstones();   // 用户主动导入=明确要求这些条目进库：清掉本地遗留墓碑（B7），跨电脑合并语义不变
        if (t.startsWith('{') || t.startsWith('[')) {
            // 数组形态以前被换成空 bank 静默丢弃，现在原样交给 importJson
            return importJson(t);
        }
        return importCsv(t);
    }

    /** 导入结果统一播报，含失败行原因 */
    function reportImport(r) {
        log(`✅ 导入完成：新增 ${r.added} 题${r.updated ? `，补齐答案 ${r.updated} 题` : ''}，重复归并 ${r.dup} 题${r.wrongOnly ? `，错误记录 ${r.wrongOnly} 条` : ''}${r.userCount ? `，其中用户手改答案 ${r.userCount} 题` : ''}`);
        if (r.conflict) log(`⚠️ ${r.conflict} 题答案与库内不一致，已保留库内答案`);
        if (r.bad) log(`❌ ${r.bad} 行无法导入`);
        (r.errors || []).slice(0, 5).forEach(e => log(`　${e.line ? `第${e.line}行` : '条目'}：${e.why}${e.text ? `（${e.text}…）` : ''}`));
        if ((r.errors || []).length > 5) log(`　…另有 ${r.errors.length - 5} 条同类问题未列出`);
        log(`📊 题库现有 ${r.total} 题`);
        updateStats();
    }

    // 会话内统计（attempted 用于「每道题只统计第一次」，重试不灌水）
    const session = { ans: 0, hit: 0, attempted: new Set() };

    function saveSession() {
        try {
            GM_setValue('pendingSession', {
                url: location.pathname + location.search,   // 完整地址，便于判断是不是同一场
                path: location.pathname,
                ts: TS(),
                submitted: submittedMark,   // 已交卷的会话，下次开考直接丢弃
                history,
            });
        } catch { }
    }

    /**
     * 交卷后给未交卷会话打「已交卷」标记。
     * 成绩页出现时这场考试已经结束，这份记录只对「重新解析成绩」有用；新开一场时
     * 直接清掉，不再让用户看到「若这是新一场请点清空本场」而不知所措。
     */
    let submittedMark = false;
    function markPendingSubmitted() {
        if (submittedMark) return;
        submittedMark = true;
        try {
            const s = GM_getValue('pendingSession', null);
            if (s) { s.submitted = true; GM_setValue('pendingSession', s); }
        } catch { }
    }
    let sessionRestored = false;
    let restoredUnsure = false;      // 恢复的记录可能来自另一场（进入地址不同）

    /**
     * 清场时必须一并复位的运行态字段（纯函数，自检可断言）。
     * 旧实现只清 history 与会话统计，submittedMark / totalQ / parsedOnce 会残留（B5）：
     * 清场后再答新一场，saveSession 仍写 submitted:true（下次刷新会被当成「已交卷」清掉），
     * 进度条还挂着上一场的总题数，连考时容易误判「已答满」。
     */
    function clearedSessionState() {
        return {
            submitted: false,
            totalQ: 0,
            parsedOnce: false,
            lastSubmitTs: 0,
            answered: 0,
            autoSubmitted: false,
            sawNextBtn: false,
        };
    }

    /** 清空本场作答记录：面板按钮 / 识别出不是同一场考试时调用 */
    function clearSession(reason) {
        history.length = 0;
        answered = 0;
        clearAnswerCache();   // R5：清本场同时清会话答案缓存，避免下一场同题误用上一场结果
        sessionRestored = false;
        restoredUnsure = false;
        // 会话统计也要一起清：否则按钮显示「已答 0」而命中率还是旧数据
        session.ans = 0; session.hit = 0;
        try { session.attempted.clear(); } catch { }
        try { GM_setValue('pendingSession', null); } catch { }
        // 运行态一起复位（B5）：否则下一场还挂着上一场的「已交卷 / 总题数 / 已解析」状态
        const reset = clearedSessionState();
        submittedMark = reset.submitted;
        totalQ = reset.totalQ;
        parsedOnce = reset.parsedOnce;
        lastSubmitTs = reset.lastSubmitTs;
        answered = reset.answered;
        autoSubmitted = reset.autoSubmitted;
        sawNextBtn = reset.sawNextBtn;
        try { GM_setValue('lastReconcileKey', ''); } catch { }   // 清掉对账幂等键，下一场允许重新入库（B1）
        log(`🧹 已清空本场作答记录${reason ? `（${reason}）` : ''}`);
        updateStats();
    }

    /**
     * 恢复未交卷的作答记录
     * 只比路径不比查询串：平台地址栏参数会变；
     * 路径也变了但当前是结果页时同样恢复——交卷后跳转/刷新都能接着解析。
     * 恢复后会在日志/提示里讲清楚；并且主循环加了「一条都没答就报已答满 → 判定为残留记录并丢弃」
     * 的自愈逻辑，避免 3 小时内重考同一路径时把上一场当成已作答（开着自动交卷会直接交白卷）。
     */
    function restoreSession() {
        if (sessionRestored) return;
        const s = GM_getValue('pendingSession', null);
        if (!s || !Array.isArray(s.history) || !s.history.length) return;
        const age = TS() - (s.ts || 0);
        if (age > CONFIG.sessionTtl) {
            GM_setValue('pendingSession', null);
            log('上次的答题记录已过期，已清空');
            return;
        }
        // 上一场已经交卷：这份记录只剩「重新解析成绩」的用途，对新一场毫无意义。
        // 成绩页里保留（刷新后还能重新对账），其它页面直接清掉——不再弹「若这是新一场请点清空本场」。
        if (s.submitted && !isResultPage()) {
            GM_setValue('pendingSession', null);
            try { GM_setValue('lastReconcileKey', ''); } catch { }   // 新一场重新开始计：旧对账键作废（B5）
            log('ℹ️ 上一场已交卷，已自动清空残留的作答记录（题库数据不受影响）');
            return;
        }
        const storePath = String(s.path || s.url || '').split('?')[0];
        if (storePath && storePath !== location.pathname && !isResultPage()) {
            log(`ℹ️ 上次记录来自其它页面（${storePath}），本次不恢复`);
            return;
        }
        sessionRestored = true;
        // 进入地址（含查询串）与上次不同 → 可能是新一场：对账照常，但本场不允许自动交卷（见 finishExam）
        restoredUnsure = !!s.url && String(s.url) !== location.pathname + location.search;
        s.history.forEach(r => history.push(r));
        answered = history.length;
        log(`♻️ 已恢复 ${age >= 60000 ? Math.round(age / 60000) + ' 分钟前' : ''}未交卷的 ${s.history.length} 条答题记录，交卷后一并核对入库${restoredUnsure ? '（本次进入地址与上次不同，按「可能不是同一场」处理）' : ''}`);
        if (!isResultPage()) {
            notify(restoredUnsure
                ? `恢复了 ${s.history.length} 条记录，但本次进入地址与上次不同：若是新一场，开始答题后脚本核对题目会自动清掉这份记录；本场不会自动交卷`
                : `恢复了 ${s.history.length} 条未交卷记录；若这是新一场考试，请点「清空本场」`, 'warn');
        }
        updateStats();
    }

    // ==================== 答案抽取 ====================
    /**
     * 从任意文本里抽出答案字母。
     * 返回 { letters, conf, why }：conf 是 0~1 的把握程度，供多源交叉验证使用；
     * 抽不出答案返回 null。
     * 覆盖：带提示词的各种表述、括号/点号形式、纯字母、选项原文命中、孤立字母、判断题语义。
     */
    function extractAnswer(raw, options, type) {
        if (!raw || !options || !options.length) return null;
        const letters = options.map(o => o.letter);
        const s = String(raw).trim();
        if (!s) return null;

        // 把一段含字母的片段收敛成合法答案：去掉不在选项里的字母并去重排序
        const shape = frag => {
            const up = [...new Set(String(frag).toUpperCase().replace(/[^A-Z]/g, '').split(''))]
                .filter(l => letters.includes(l)).sort().join('');
            if (!up) return null;
            return type === 'multi' ? up : up[0];
        };
        const hit = (frag, conf, why) => {
            const l = shape(frag);
            return l ? { letters: l, conf, why } : null;
        };

        // 1) 判断题：先看有没有明确的答案字母，再按对/错语义判定
        let judgeEchoOnly = false;
        //    旧实现直接拿返回文本前 30 字匹配「正确/对/是」，于是「答案是B」「正确答案：B」，
        //    或百度返回页开头就是题干「下列说法是否正确」时，一律被判成「对」，而且 conf 0.9
        //    还会跳过第二源交叉验证——判断题里答「错」的那一半会系统性答反。
        //    现在：明确字母优先 → 剥掉「答案/选项」这类标签词 → 语义分支降把握度以触发交叉验证。
        if (type === 'judge') {
            const yes = options.find(o => JUDGE_YES_OPT.test(o.text));
            const no = options.find(o => JUDGE_NO_OPT.test(o.text));
            const keyed = s.match(/(?:正确答案|参考答案|标准答案|本题答案|答案)\s*(?:[是为]|[:：]|\s)*\s*([A-Za-z]{1,8})/);
            if (keyed) {
                const r = hit(keyed[1], 0.9, '判断题：明确答案字母');
                if (r) return r;
            }
            const head = s.slice(0, 40).replace(JUDGE_LABEL_RE, ' ');
            // 「整句就是一个判定词」时优先按锚定式判：这样「是 / 否」这种单字选项不会漏
            // （以前去掉裸「是」之后，「是」既不是字母也过不了语义分支，会直接查不到答案）
            const verdict = head.replace(/[\s:：。，,；;、！!？?"'“”]/g, '');
            if (no && JUDGE_NO_VERDICT.test(verdict)) return { letters: no.letter, conf: 0.85, why: '判断题否定式（单字判定）' };
            if (yes && JUDGE_YES_VERDICT.test(verdict)) return { letters: yes.letter, conf: 0.85, why: '判断题肯定式（单字判定）' };
            // 题干里带「是否」的是非题（如「下列说法是否正确」）不能按语义判：
            // 旧实现会命中 JUDGE_NO_TEXT 里的裸「否」，于是每道题干出现在返回文本开头的
            // 判断题都被判成「错误」，而且 conf 0.85 > crossCheckBelow，连第二源都不查。
            // 现在问句只采信「？」之后的回答部分；没有回答就不猜，交给交叉验证。
            const askedWhether = /是否/.test(head);
            if (askedWhether) {
                judgeEchoOnly = true;
                const tail = s.split(/[？?]/).slice(1).join('？').replace(JUDGE_LABEL_RE, ' ');
                if (tail) {
                    if (no && JUDGE_NO_TEXT.test(tail)) return { letters: no.letter, conf: 0.7, why: '判断题否定式（问句后的回答）' };
                    if (yes && JUDGE_YES_TEXT.test(tail)) return { letters: yes.letter, conf: 0.7, why: '判断题肯定式（问句后的回答）' };
                }
            } else {
                // 语义分支把握度压到 0.8 以下（crossCheckBelow），确保会去查第二源
                if (no && JUDGE_NO_TEXT.test(head)) return { letters: no.letter, conf: 0.7, why: '判断题否定式' };
                if (yes && JUDGE_YES_TEXT.test(head)) return { letters: yes.letter, conf: 0.7, why: '判断题肯定式' };
            }
        }

        // 2) 整段就是字母（题库命中 / AI 被要求只回字母）
        if (/^[A-Za-z]{1,8}\s*[.。、]?$/.test(s)) {
            const r = hit(s, 0.95, '纯字母');
            if (r) return r;
        }

        // 3) 带提示词后的字母：「答案是 A」「正确答案为 B」「【答案】C」「正确选项：B」「应选 D」
        const KEYED = /(?:正确答案|参考答案|标准答案|正确选项|本题答案|答案|应选|选择|选项|判断|结论|选)\s*(?:[是为]|[:：]|[\]】）)］]|[\s]*)*\s*([A-Za-z](?:[\s,，、/和及与]*[A-Za-z])*)/;
        const keyed = s.match(KEYED);
        if (keyed) {
            const r = hit(keyed[1], 0.9, '提示词+字母');
            if (r) return r;
        }

        // 4) 括号形式：（C）【AB】[D]
        const bracketed = s.match(/[（(【\[<]\s*([A-Za-z](?:[\s,，、/和及与]*[A-Za-z])*)\s*[)）】\]>]/);
        if (bracketed) {
            const r = hit(bracketed[1], 0.85, '括号字母');
            if (r) return r;
        }

        // 5) 句首/句尾的裸字母：「A. 书面」「答 B」「A、C」
        //    只认「片段本身就是大写字母（可带分隔符）」且字母都在选项范围内的情况。
        //    旧实现允许任意大小写字母串，结果 "The answer is B" 开场第一个单词被整串吞掉
        //    （"TheanswerisB" → 过滤后取到 A），"Baidu 搜索结果…" 也会被当成选 A，
        //    而且 conf 0.8 正好不低于 crossCheckBelow，连第二源交叉验证都跳过了。
        const strictUp = frag => {
            const txt = String(frag).trim();
            if (!/^[A-Z](?:[\s,，、/和及与]*[A-Z])*$/.test(txt)) return '';
            const up = txt.replace(/[^A-Z]/g, '');
            return up && up.split('').every(l => letters.includes(l)) ? up : '';
        };
        const bareHead = s.match(/^\s*([A-Z](?:[\s,，、/和及与]*[A-Z])*)\s*[.。、:：]?(?![A-Za-z])/);
        const bareTail = s.match(/(?:^|[^A-Za-z])([A-Z](?:[\s,，、/和及与]*[A-Z])*)\s*[.。]?\s*$/);
        const bareFrag = (bareHead && strictUp(bareHead[1])) || (bareTail && strictUp(bareTail[1]));
        if (bareFrag) {
            return {
                letters: type === 'multi' ? bareFrag : bareFrag[0],
                conf: 0.75,          // 低于 crossCheckBelow，保证会去核对第二源
                why: '裸字母',
            };
        }

        // 5.5) 问句回显且没给回答：到此为止，别再用「选项原文命中」去猜——
        //      「是否正确」的题干里天然含「正确」，整个题干回显会被误判成选「正确」。
        if (judgeEchoOnly) return null;

        // 6) 选项原文在答案文本里的命中（阈值全部可配）
        //    单选的「选项原文命中」只在唯一命中时才敢用。百度结果页常把题干连同
        //    A/B/C/D 一起回显，那时每个选项都会命中一次，旧实现按 hits×len 取最长的那个当答案，
        //    等于随机，却报 45%~80% 的把握度。
        const MINLEN = CONFIG.textMatchMinLen, MINHITS = CONFIG.textMatchMinHits;
        const cands = options
            .filter(o => o.text && o.text.length >= 2)
            .map(o => ({ l: o.letter, hits: s.split(o.text).length - 1, len: o.text.length }))
            .filter(x => {
                if (x.hits < MINHITS) return false;
                // 很短的选项出现在很长的一段话里，单次命中不足以采信
                if (x.len < MINLEN && x.hits < 2) return false;
                if (x.len <= 2 && s.length > CONFIG.textMatchShortMax && x.hits < 2) return false;
                return true;
            });
        const hitCands = type === 'multi' ? cands : (cands.length === 1 ? cands : []);
        if (hitCands.length) {
            const score = x => x.hits * x.len;
            const best = Math.max(...hitCands.map(score));
            const kept = hitCands.filter(x => score(x) >= best * CONFIG.textMatchKeepRatio)
                .map(x => x.l).sort().join('');
            if (kept) {
                const totalHits = hitCands.reduce((a, x) => a + x.hits, 0);
                return {
                    letters: type === 'multi' ? kept : kept[0],
                    conf: Math.min(0.8, 0.45 + 0.1 * totalHits),
                    why: '选项原文命中',
                };
            }
        }

        // 7) 兜底：文本里独立出现的单个字母（把握最低）
        //    旧实现先 match 再 map(trim)，匹配串里带的是「前面的非字母字符」，
        //    于是「我认为C是对的」这类中文夹字母的句子永远抽不出来；现在用捕获组取字母本身。
        const tokens = [...new Set(
            [...s.toUpperCase().matchAll(/(?:^|[^A-Z])([A-Z])(?![A-Z])/g)].map(m => m[1])
        )].filter(l => letters.includes(l)).sort();
        if (tokens.length) {
            // 单选/判断在文本里同时出现多个候选字母时不再硬猜一个（对错接近瞎猜），
            // 交回排除法/兜底；多选仍按全部出现处理。
            if (type !== 'multi' && tokens.length > 1) return null;
            return {
                letters: type === 'multi' ? tokens.join('') : tokens[0],
                conf: 0.35,
                why: '孤立字母',
            };
        }
        return null;
    }

    /** 兼容旧调用：只取字母 */
    function normalizeAnswer(raw, options, type) {
        const r = extractAnswer(raw, options, type);
        return r ? r.letters : null;
    }

    /**
     * 多源结果交叉验证
     * - 全部候选都校验过：字母必须在选项范围内，多选题不能只给一个字母
     * - 同答案的来源合并并提升置信度
     * - 出现互相冲突的答案时，只有明显更优的那个才敢用，否则宁可不答
     */
    function mergeCandidates(cands, type, options, onDispute = null) {
        const letters = options.map(o => o.letter);
        const usable = (cands || []).filter(c =>
            c && c.letters &&
            c.letters.split('').every(l => letters.includes(l)) &&
            !(type === 'multi' && c.letters.length < 2));
        if (!usable.length) return null;

        const groups = {};
        usable.forEach(c => {
            (groups[c.letters] = groups[c.letters] || []).push(c);
        });
        const ranked = Object.entries(groups).map(([k, v]) => {
            const srcs = [...new Set(v.map(x => x.src))];
            return {
                letters: k,
                // 封顶 1：两源一致时 max 0.9 + 0.15 会到 1.05，旧实现甚至能到 1.0999，
                // 既超出 0~1 的把握度语义，也把后面的 gap 比较带偏（A2）。
                // conf 缺失才补 0.5：旧实现 `x.conf || 0.5` 把「明确给出 0」抬成 0.5，
                // 等于「模型说完全没把握」被当成中等把握（P2#1）
                conf: Math.min(1, Math.max(...v.map(x => x.conf == null ? 0.5 : x.conf)) + (srcs.length > 1 ? CONFIG.multiSourceBonus : 0)),
                srcs,
                // structured：「AI 给了结构化 JSON」的机器可读标记；why 只是给人看的文案（P2#5）
                structured: v.some(x => x && x.structured === true),
                why: v[0].why,
            };
        }).sort((a, b) => b.conf - a.conf);

        if (ranked.length === 1) return ranked[0];
        // 有冲突：领先方要足够领先才采用。
        // 但百度结果统一 ×baiduConfFactor(0.9) 折减，同一份把握的 AI 结构化 JSON（0.9 对 0.81）
        // 只差 0.09，冲突阈值 0.3 永远够不着 → 领先方永远用不上（A2）。
        // 折减是「两把尺子」的问题：比较前把百度分数除回去再算 gap；
        // 另外 AI 结构化 JSON（模型明确给了答案和把握度）conf≥0.8 时直接采信。
        if (ranked[0].srcs.length === 1 && ranked[0].srcs[0] === 'ai'
            && ranked[0].structured === true && ranked[0].conf >= CONFIG.aiDirectAcceptConf) {
            return ranked[0];
        }
        const eff = r => (r.srcs.length === 1 && r.srcs[0] === 'baidu')
            ? Math.min(1, r.conf / (CONFIG.baiduConfFactor || 1))
            : r.conf;
        const gap = eff(ranked[0]) - eff(ranked[1]);
        if (gap >= CONFIG.crossAcceptGap) return ranked[0];
        // R2：两源都给了候选、把握度都不低，却拉不开差距——旧实现静默丢弃，事后无法复盘。
        // 现在记一条争议（fx_disputes，上限 CONFIG.disputeMaxEntries），但返回值仍为 null：
        // 作答行为不变（宁可不答也不赌），只是多一个可观测/可导出的证据。
        const srcPool = new Set([...(ranked[0].srcs || []), ...(ranked[1].srcs || [])]);
        if (typeof onDispute === 'function' && srcPool.size > 1
            && ranked[0].conf >= 0.8 && ranked[1].conf >= 0.8) {
            try { onDispute(ranked); } catch (e) { log(`⚠️ 争议记录失败：${e && e.message ? e.message : e}`); }
        }
        return null;
    }

    const DISPUTE_KEY = 'fx_disputes';
    /** 读争议题列表（坏数据一律当空，R2） */
    function loadDisputes() {
        try {
            const raw = GM_getValue(DISPUTE_KEY, []);
            return Array.isArray(raw) ? raw.filter(x => x && typeof x === 'object') : [];
        } catch { return []; }
    }
    /**
     * 争议入列（纯函数，自检可断言，R2）：同题干 + 同候选只更新时间戳并挪到最前，
     * 最多保留 max 条（默认 CONFIG.disputeMaxEntries=100），返回值是新数组。
     */
    function addDispute(list, item, now = Date.now(), max = CONFIG.disputeMaxEntries) {
        if (!item || typeof item !== 'object') return Array.isArray(list) ? list.slice() : [];
        const sig = x => `${(x && x.stem) || ''}|${((x && x.cands) || []).map(c => (c && c.letters) || '').join(',')}`;
        const key = sig(item);
        const out = (Array.isArray(list) ? list : []).filter(x => x && typeof x === 'object' && sig(x) !== key);
        out.unshift({ ...item, ts: +now || Date.now() });
        const limit = Math.max(1, Math.floor(+max) || 100);
        return out.slice(0, limit);
    }
    /** 把一次冲突写进 GM 键（R2）：只做观测，不改变作答结果 */
    function recordDispute(stem, type, options, ranked) {
        const top = (ranked || []).slice(0, 2);
        if (top.length < 2) return null;
        const item = {
            stem: pureStem(stem),
            type,
            options: (options || []).map(o => ({ letter: o.letter, text: o.text })),
            cands: top.map(r => ({ letters: r.letters, conf: r.conf, srcs: r.srcs, why: r.why || '' })),
            why: '两源答案冲突（差距不足 crossAcceptGap）',
        };
        const list = addDispute(loadDisputes(), item);
        try { GM_setValue(DISPUTE_KEY, list); } catch { }
        log(`⚔️ 记录争议题：${item.cands.map(c => `${c.letters}(${(c.conf * 100).toFixed(0)}%)`).join(' vs ')}（共 ${list.length} 条）`);
        return { ...item, ts: Date.now() };
    }

    // ==================== 网络请求（重试 / 退避 / 限流） ====================
    const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36';
    let reqActive = 0;
    const reqQueue = [];
    const acquireReq = () => new Promise(r => {
        if (reqActive < CONFIG.maxConcurrent) { reqActive++; r(); }
        else reqQueue.push(() => { reqActive++; r(); });
    });
    const releaseReq = () => { reqActive--; reqQueue.shift()?.(); };

    /** UTF-8 字节数估算（纯函数）：ASCII 1 字节、Latin 系 2 字节、CJK 3 字节，够用来做上限判断 */
    function utf8Bytes(text) {
        const s = String(text || '');
        let n = 0;
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            n += c <= 0x7f ? 1 : c <= 0x7ff ? 2 : 3;
        }
        return n;
    }

    /**
     * 响应体截断（纯函数，自检可断言，R7）：
     * 广告页/超大结果页动辄几 MB，整段留在内存里既拖慢正则又可能把页面拖死。
     * 超过 CONFIG.followPageMaxBytes 时按 UTF-8 字节预算截断；正常大小的响应原样返回。
     */
    function truncateResponseText(text, maxBytes = CONFIG.followPageMaxBytes) {
        const s = String(text || '');
        const limit = +maxBytes > 0 ? Math.floor(+maxBytes) : 0;
        if (!(limit > 0) || utf8Bytes(s) <= limit) return s;
        let used = 0, i = 0;
        for (; i < s.length; i++) {
            const c = s.charCodeAt(i);
            const w = c <= 0x7f ? 1 : c <= 0x7ff ? 2 : 3;
            if (used + w > limit) break;
            used += w;
        }
        return s.slice(0, i);
    }

    /** 各来源请求统计（R11 诊断包用）：desc → { n, ok, fail, timeout, totalMs } */
    const reqStats = {};
    function noteReqStat(desc, r, ms) {
        const k = String(desc || '其他');
        const st = reqStats[k] || (reqStats[k] = { n: 0, ok: 0, fail: 0, timeout: 0, totalMs: 0 });
        st.n++;
        if (r && r.ok) st.ok++; else st.fail++;
        if (r && r.err === 'timeout') st.timeout++;
        st.totalMs += Math.max(0, +ms || 0);
    }
    /** 请求统计快照（纯函数，自检可断言）：附带平均耗时（未四舍五入） */
    function reqStatsSnapshot(stats = reqStats) {
        const out = {};
        for (const [k, v] of Object.entries(stats || {})) {
            out[k] = { ...v, avgMs: v && v.n ? v.totalMs / v.n : 0 };
        }
        return out;
    }

    /**
     * 单次请求超时（纯函数，自检可断言）：
     * 取「配置超时」与「剩余预算」的较小值；预算已耗尽返回 0，调用方据此不再发请求、不再重试（A6）。
     */
    function requestTimeout(configured, deadline, now) {
        const base = +configured > 0 ? +configured : CONFIG.baiduTimeout;
        if (!deadline) return base;
        const left = +deadline - (+now || Date.now());
        return left > 0 ? Math.max(1, Math.min(base, Math.floor(left))) : 0;
    }

    /**
     * 带重试与退避的请求
     * 只对「超时 / 网络错误 / 5xx」重试，4xx 是参数或鉴权问题，重试没有意义。
     * o.deadline：本题网络总预算的截止时间戳；每次尝试的 timeout 取 min(配置, 剩余)，
     *             预算耗尽立刻返回 { err:'budget', budgetSpent:true }，不再重试（A6）。
     * o.maxRetry：单次调用可覆盖全局重试次数（跟进页用 0，别把预算耗在补充页上）。
     * 始终返回结构化结果 { ok, status, text, err }，不抛异常、不静默。
     */
    async function request(o) {
        const deadline = o.deadline || 0;
        const maxRetry = Number.isFinite(o.maxRetry) ? o.maxRetry : CONFIG.maxRetry;
        let last = { ok: false, status: 0, text: '', err: 'unknown' };
        for (let i = 0; i <= maxRetry; i++) {
            const timeout = requestTimeout(o.timeout || CONFIG.baiduTimeout, deadline, Date.now());
            if (!timeout) return { ok: false, status: 0, text: '', err: 'budget', budgetSpent: true };   // 预算耗尽：立即返回，不重试
            await acquireReq();
            try {
                const t0 = Date.now();
                last = await new Promise(resolve => {
                    GM_xmlhttpRequest({
                        method: o.method || 'GET',
                        url: o.url,
                        headers: o.headers,
                        data: o.data,
                        timeout,
                        // R7：大页面在进内存前就按字节上限截断，避免广告页/导航页把整段正文留在内存里
                        onload: x => resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, text: truncateResponseText(x.responseText || '', CONFIG.followPageMaxBytes), err: '' }),
                        onerror: () => resolve({ ok: false, status: 0, text: '', err: 'network' }),
                        ontimeout: () => resolve({ ok: false, status: 0, text: '', err: 'timeout' }),
                    });
                });
                noteReqStat(o.desc, last, Date.now() - t0);   // R11：按来源累计次数/成功/失败/超时/耗时
            } finally { releaseReq(); }
            if (last.ok) return last;
            const worthRetry = last.err === 'timeout' || last.err === 'network' || last.status >= 500;
            if (!worthRetry || i === maxRetry) return last;
            await sleep(CONFIG.retryBaseMs * Math.pow(2, i));
        }
        return last;
    }

    /** 把请求失败翻译成人能看懂的一句话；带上响应体片段，4xx 的原因通常在里面 */
    function failText(r, who) {
        const body = String((r && r.text) || '').replace(/\s+/g, ' ').slice(0, 120);
        const tail = body ? `：${body}` : '';
        if (r.err === 'timeout') return `${who}请求超时`;
        if (r.err === 'network') return `${who}网络错误（可能被拦截或断网；若地址不在脚本 @connect 白名单里也会这样）`;
        if (r.status === 0) return `${who}请求失败`;
        if (r.status === 401 || r.status === 403) return `${who}鉴权失败（${r.status}），请检查 API Key${tail}`;
        if (r.status === 404) return `${who}地址不存在（404），请检查 API 地址${tail}`;
        if (r.status === 429) return `${who}被限流（429），请稍后再试${tail}`;
        if (r.status >= 500) return `${who}服务端错误（${r.status}）${tail}`;
        return `${who}返回 ${r.status}${tail}`;
    }

    const stripHtml = html => String(html)
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&emsp;/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ');

    const SRC_NAME = { ai: 'AI', baidu: '百度', cache: '缓存' };

    /** 空白归一后的「扁平文本」+ 每个字符在原文里的下标（纯函数） */
    function flattenText(text) {
        const src = String(text || '');
        let flat = '';
        const map = [];
        for (let i = 0; i < src.length; i++) {
            if (/\s/.test(src[i])) continue;
            flat += src[i];
            map.push(i);
        }
        return { flat, map };
    }

    /**
     * 在「空白归一」后的文本里按 len 字片段查找并删掉原文对应区间（纯函数，自检可断言）。
     * 用途：百度会把查询词拆开回显（「正确 答案」/标题里被标签隔开），整段永远匹配不到；
     * 8 字窗口足够长，不会误删无关文字，又能容忍中间插进来的空白（A5）。
     */
    function removeFlatFragments(text, frag, len = 8) {
        const src = String(text || '');
        const f = String(frag || '').replace(/\s+/g, '');
        if (!f || f.length < len) return src;
        const { flat, map } = flattenText(src);
        const cuts = [];
        const find = needle => {
            let at = flat.indexOf(needle);
            while (at >= 0) {
                cuts.push([map[at], map[at + needle.length - 1] + 1]);
                at = flat.indexOf(needle, at + needle.length);
            }
        };
        for (let i = 0; i + len <= f.length; i += 4) find(f.slice(i, i + len));   // 步长 4 保证任意 8 字窗口都被覆盖
        find(f.slice(-len));                                                     // 尾片段：保证「正确答案」这类结尾词也删掉
        if (!cuts.length) return src;
        cuts.sort((a, b) => a[0] - b[0]);
        let out = '', pos = 0;
        for (const [a, b] of cuts) {
            if (b <= pos) continue;                 // 已被前一段覆盖
            if (a > pos) out += src.slice(pos, a);
            out += ' ';
            pos = b;
        }
        return out + src.slice(pos);
    }

    /**
     * 去掉搜索结果里「我们自己的查询词」回显。
     * 百度会把查询词原样放进标题/摘要，而查询词里带着「正确答案」字样，
     * 回显就会被 extractAnswer 的 keyed 分支当成答案线索，虚增把握度。
     * 两轮：① 原样出现 → 整段删；② 被拆词/插空白 → 空白归一后按 8 字片段删（A5）。
     */
    function stripQueryEcho(text, queries) {
        let t = String(text || '');
        const qs = (queries || []).map(s => String(s || '').trim())
            .filter(s => s.length >= 6)
            .sort((a, b) => b.replace(/\s+/g, '').length - a.replace(/\s+/g, '').length);   // 长的先删，避免短查询把长回显切碎
        for (const s of qs) {
            const flat = s.replace(/\s+/g, '');
            if (flat.length >= 8) t = removeFlatFragments(t, flat, 8);
            t = t.split(s).join(' ');
        }
        return t.replace(/\s+/g, ' ').trim();
    }

    /**
     * 查询词截断（纯函数，自检可断言）：题干长时只取「头 40 字 + 尾 20 字」，中间省略。
     * 旧实现 slice(0,60) 只留头部：题干的关键限定/问法常在尾部，被切掉后搜出来的题经常对不上（A5）。
     */
    function clipQuery(stemText, head = 40, tail = 20) {
        const s = String(stemText || '').replace(/\s+/g, ' ').trim();
        if (s.length <= head + tail) return s;
        return s.slice(0, head) + '…' + s.slice(-tail);
    }

    /**
     * 跟进结果页相关性（纯函数，自检可断言）：
     * 搜索结果里混着广告/导航页，正文里根本没有这道题，跟进只会把噪声塞进答案候选（A5）。
     * 判定：正文（空白与标点归一后）含题干前 20 字 → 相关；否则按题干 bigram 覆盖率 ≥ 0.5 认。
     */
    function followPageRelevant(pageText, stem) {
        const page = normStem(pageText);
        const st = normStem(stem);
        if (!page || !st) return false;
        if (page.includes(st.length >= 20 ? st.slice(0, 20) : st)) return true;
        let hit = 0, total = 0;
        for (let i = 0; i + 2 <= st.length; i++) {
            total++;
            if (page.includes(st.slice(i, i + 2))) hit++;
        }
        return total > 0 && hit / total >= 0.5;
    }

    /**
     * 按「大括号配对」扫出文本里的所有候选 JSON 对象（纯函数，自检可断言）。
     * 旧实现用贪婪正则 /\{[\s\S]*\}/ 只取「第一个 { 到最后一个 }」：模型先给示例对象、
     * 再给正式答案（中间夹解释文字）时整段不是合法 JSON，解析失败直接掉回文本兜底（A3）。
     * 这里按配对扫描、跳过字符串里的括号，按出现顺序返回，调用方逐个 parse。
     */
    function jsonObjectCandidates(raw) {
        const s = String(raw || '');
        const out = [];
        let i = 0;
        while (i < s.length) {
            while (i < s.length && s[i] !== '{') i++;
            if (i >= s.length) break;
            let depth = 0, inStr = false, esc = false, end = -1;
            for (let j = i; j < s.length; j++) {
                const ch = s[j];
                if (inStr) {
                    if (esc) esc = false;
                    else if (ch === '\\') esc = true;
                    else if (ch === '"') inStr = false;
                    continue;
                }
                if (ch === '"') inStr = true;
                else if (ch === '{') depth++;
                else if (ch === '}') {
                    depth--;
                    if (depth === 0) { end = j; break; }
                }
            }
            if (end < 0) break;          // 括号没配平，后面的内容不再猜
            out.push(s.slice(i, end + 1));
            i = end + 1;
        }
        return out;
    }

    /** 文本里是否含「能被解析」的 JSON 对象（reasoning_content 能否当答案文本用的闸门，A3） */
    function hasJsonObject(text) {
        for (const body of jsonObjectCandidates(text)) {
            try {
                const o = JSON.parse(body);
                if (o && typeof o === 'object') return true;
            } catch { }
        }
        return false;
    }

    /**
     * 解析 AI 的结构化回答：优先 JSON（{"answer":"B","confidence":0.9}），
     * 兼容 ```json 代码块、前后夹带解释文字；不是 JSON 就退回原来的文本抽取。
     * 让模型自己给把握度，比从自然语言里猜置信度稳得多；也更省输出 token。
     */
    function extractAIAnswer(content, options, type) {
        const raw = String(content || '').trim();
        const letters = options.map(o => o.letter);
        if (!raw) return null;
        // 先找代码块里的 JSON；再按大括号配对扫正文（多个候选按出现顺序 parse）
        const bodies = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map(m => m[1]);
        bodies.push(...jsonObjectCandidates(raw));
        for (const body of bodies) {
            let obj = null;
            try { obj = JSON.parse(String(body).trim()); } catch { continue; }
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
            const ansRaw = String(obj.answer || obj.letters || obj['答案'] || '').toUpperCase().replace(/[^A-Z]/g, '');
            if (!ansRaw) continue;
            if (!ansRaw.split('').every(l => letters.includes(l))) continue;
            const ans = [...new Set(ansRaw.split(''))].sort().join('');
            // 单选/判断给了多个字母 = 模型自相矛盾，丢弃这个候选。
            // 旧实现单选取第一个字母，把 "AB" 静默当成 A（A3）。
            if (type !== 'multi' && ans.length !== 1) continue;
            if (type === 'multi' && ans.length < CONFIG.multiMinChoices) continue;
            // confidence：缺失 / 非数字 / 越界 → 0.9；显式给出 0~1 的数字 → 原样采信。
            // 旧实现 Number(...) || 0.9 把 conf=0 当成 0.9，等于「没把握」被当成高把握（A3）。
            const rawConf = Number(obj.confidence);
            const conf = (obj.confidence !== undefined && obj.confidence !== null
                && Number.isFinite(rawConf) && rawConf >= 0 && rawConf <= 1) ? rawConf : 0.9;
            const reason = obj.reason || obj['理由'] || '';
            // structured：机器可读的「结构化答案」标记。以前靠 why 文案的「AI 结构化」前缀做正则判定，
            // 文案一改直采就悄悄失效；why 现在只用于展示/日志（P2#5）
            return { letters: ans, conf, structured: true, why: `AI 结构化${reason ? `：${String(reason).slice(0, 40)}` : ''}` };
        }
        // 3) 不是 JSON → 退回文本抽取（兼容不支持 JSON 输出的接口/模型）
        const fb = extractAnswer(raw, options, type);
        return fb ? { ...fb, structured: false, why: `${fb.why}（AI 文本兜底）` } : null;
    }

    /** 百度：多个入口 + 只跟进「确实在讲这道题」的结果页正文（A5 / A6） */
    async function queryBaidu(stem, ctx = {}) {
        const q = clipQuery(pureStem(stem));                 // 头 40 + 尾 20：题干尾部常含关键限定（A5）
        const entries = [
            `https://www.baidu.com/s?wd=${encodeURIComponent(q + ' 正确答案')}`,
            `https://www.baidu.com/s?wd=${encodeURIComponent(q + ' 答案')}`,
        ];
        const queries = [q + ' 正确答案', q + ' 答案', q];   // 需要从结果正文里剔除的查询词回显
        let text = '', note = '', budgetSpent = false;
        for (const url of entries) {
            const r = await request({ url, headers: { 'User-Agent': UA }, desc: '百度', deadline: ctx.deadline });
            if (r.budgetSpent) { budgetSpent = true; note = '本题网络预算已用完'; break; }   // 预算耗尽：不换入口、不重试（A6）
            if (!r.ok) { note = failText(r, '百度'); continue; }
            // 反爬/验证码/跳转页识别：正文很短且不含结果块
            if (/安全验证|请输入验证码|访问异常|网络不给力/.test(r.text.slice(0, 3000))) {
                note = '百度要求安全验证（反爬），本次未取到结果';
                continue;
            }
            if (!/class="result|result c-container|c-container/.test(r.text)) {
                note = '百度未返回搜索结果（可能被跳转或需登录）';
            }
            text += stripQueryEcho(stripHtml(r.text), queries);
            // 跟进前 N 条结果页正文，避免只看标题摘要。
            // 跟进页指向的是站外页面，混着广告/导航页：正文不是这道题就跳过（A5）。
            const links = [...r.text.matchAll(/href="(https?:\/\/(?:www\.)?baidu\.com\/link\?url=[^"]+)"/g)]
                .map(m => m[1].replace(/&amp;/g, '&'))
                .slice(0, CONFIG.baiduFollowLinks);
            for (const u of links) {
                // 跟进页只是补充：不重试，避免一页拖垮整题预算（A6）
                const pr = await request({ url: u, headers: { 'User-Agent': UA }, desc: '结果页', maxRetry: 0, deadline: ctx.deadline });
                if (pr.budgetSpent) { budgetSpent = true; break; }
                if (!pr.ok || !pr.text) continue;
                const pageText = stripHtml(pr.text);
                if (!followPageRelevant(pageText, stem)) { dbg('跳过与本题无关的跟进页（广告/导航）'); continue; }
                text += stripQueryEcho(pageText, queries);
            }
            if (budgetSpent) break;
            if (text.trim().length >= CONFIG.baiduMinChars) break;
        }
        return { text: text.trim() || null, note, budgetSpent };
    }

    /** AI：模型与参数可配，提问模板适配题型 */
    async function queryAI(stem, options, type, ctx = {}) {
        const url = GM_getValue('aiUrl', ''), key = getKey();
        if (!url) return { text: null, note: '未设置 API 地址，AI 模式不可用' };
        if (!key) return { text: null, note: '未设置 API Key，AI 模式不可用' };

        const typeTxt = type === 'multi' ? '多选题' : type === 'judge' ? '判断题' : '单选题';
        const rule = type === 'multi'
            ? `本题是多选题，正确答案有 2 个或以上，必须给出全部正确项；只给一个是错的。`
            : type === 'judge'
                ? `本题是判断题，请按选项字母作答（选项文本为「对/错」或「正确/错误」）。`
                : `本题只有一个正确选项。`;
        let prompt = `你是考试答题助手。下面是${typeTxt}，请从选项中选出正确答案。\n${rule}\n\n题目：${stem}\n选项：\n`;
        options.forEach(o => prompt += `${o.letter}. ${o.text}\n`);
        // 结构化输出：答案与把握度分开给，脚本不用再从自然语言里猜置信度。
        prompt += `\n只输出一个 JSON 对象，不要代码块外的任何文字，也不要复述题目：` +
                  `{"answer":"X","confidence":0.9,"reason":"一句话理由"}` +
                  `（answer 的字母必须来自 ${options.map(o => o.letter).join('/')}；多选写成 "AB"；` +
                  `confidence 是你对答案的把握，0~1 之间的小数）`;

        const r = await request({
            method: 'POST', url, timeout: CONFIG.aiTimeout, desc: 'AI', deadline: ctx.deadline,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            data: JSON.stringify({
                model: CONFIG.aiModel,
                messages: [{ role: 'user', content: prompt }],
                temperature: CONFIG.aiTemperature,
                max_tokens: CONFIG.aiMaxTokens,
            }),
        });
        if (!r.ok) return { text: null, note: failText(r, 'AI 接口'), status: r.status };

        let data = null;
        try { data = JSON.parse(r.text); }
        catch { return { text: null, note: 'AI 返回的不是合法 JSON，请检查 API 地址是否兼容 OpenAI 格式' }; }
        const msg = (data && data.choices && data.choices[0] && data.choices[0].message) || {};
        // 推理模型（deepseek-reasoner 等）正文可能只出现在 reasoning_content，content 为空。
        // 但推理过程是自然语言，整段当答案会让文本兜底把「推理里提到的某个字母」当成答案（A3）；
        // 只有里面确实含「合法 JSON 对象」时才拿来用。
        let content = String(msg.content || '').trim();
        if (!content) {
            const reasoning = String(msg.reasoning_content || '').trim();
            if (reasoning && hasJsonObject(reasoning)) content = reasoning;
        }
        if (!content) {
            const apiErr = data && data.error && (data.error.message || data.error.code);
            return { text: null, note: apiErr ? `AI 返回错误：${String(apiErr).slice(0, 120)}` : 'AI 返回内容为空' };
        }
        return { text: content, note: '' };
    }

    // ==================== 会话级答案缓存（R5） ====================
    const answerCache = new Map();

    /** 缓存键（纯函数，自检可断言）：题型 + 题干指纹 + 选项文本序列 */
    function answerCacheKey(stem, type, options) {
        const opts = (options || []).map(o => String((o && o.text) || '').replace(/\s+/g, '')).join('|');
        return `${type || ''}|${fpKey(stem)}|${opts}`;
    }
    /** 读缓存（纯函数，可注入时间/ttl）：过期项顺手删掉；返回 null 表示未命中 */
    function cacheLookup(map, key, now = Date.now(), ttl = CONFIG.answerCacheTtl) {
        if (!(map instanceof Map) || !key) return null;
        const it = map.get(key);
        if (!it) return null;
        const age = (+now || Date.now()) - (+it.ts || 0);
        if (!(+ttl > 0) || age >= +ttl) { map.delete(key); return null; }
        return it;
    }
    /** 写缓存（就地更新 Map）：超上限时按插入顺序淘汰最旧，返回 true */
    function cacheStore(map, key, value, now = Date.now(), max = CONFIG.answerCacheMax) {
        if (!(map instanceof Map) || !key) return false;
        map.delete(key);
        map.set(key, { ...(value || {}), ts: +now || Date.now() });
        const limit = Math.max(1, Math.floor(+max) || 200);
        while (map.size > limit) map.delete(map.keys().next().value);
        return true;
    }
    /** 本次查询是否绕过缓存（纯函数，自检可断言）：强制二源 / forceCrossCheck / 显式 noCache */
    function answerCacheBypassed(opts) {
        const o = opts || {};
        return !!(o.forceTwoSources || o.forceCrossCheck || o.noCache || CONFIG.forceCrossCheck);
    }
    function clearAnswerCache() {
        answerCache.clear();
    }

    /**
     * 双源并行策略（纯函数，自检可断言，R6）
     * 'parallel'：能提前确定「一定需要次源」（强制二源 / 多选题）且并行开关打开，
     *             两源同时发起、共享同一个 deadline，再合并结果；
     * 'serial'  ：其余情况仍走 v2.0.6 的串行回退——主源把握足够就不打扰备源，省一次请求。
     * 并行关闭时即使强制二源也走串行（两个来源都会查，但不是并发）。
     */
    function dualSourcePlan(type, forceTwoSources, opts = {}) {
        const parallel = opts.parallel === undefined ? CONFIG.parallelDualSource : !!opts.parallel;
        const need = !!(forceTwoSources || type === 'multi');
        if (!need) return 'serial';
        return parallel ? 'parallel' : 'serial';
    }

    /**
     * 多源返回合并（纯函数，自检可断言，R6）
     * responses: [{src:'ai'|'baidu', r:{text,note,budgetSpent}} | {src, error}]
     * 单源失败/超时只记一条 note，不影响其它源；返回 { cands, notes, budgetSpent }。
     * 串行与并行两条路径共用这一份合并逻辑，保证行为一致。
     */
    function combineSourceResults(responses, type, options) {
        const cands = [], notes = [];
        let budgetSpent = false;
        for (const item of (responses || [])) {
            if (!item || !item.src) continue;
            const src = item.src, who = SRC_NAME[src] || src;
            if (item.error || !item.r) {
                const why = item.error ? `（${String(item.error.message || item.error).slice(0, 60)}）` : '';
                notes.push(`${who}：请求异常${why}`);
                continue;
            }
            const r = item.r;
            if (r.budgetSpent) budgetSpent = true;
            if (!r.text) {
                notes.push(`${who}：${r.budgetSpent ? '本题网络预算已用完' : (r.note || '未搜到相关内容')}`);
                continue;
            }
            const c = src === 'ai' ? extractAIAnswer(r.text, options, type) : extractAnswer(r.text, options, type);
            if (!c) { notes.push(`${who}：有返回但解析不出答案`); continue; }
            if (src === 'baidu') {
                c.conf = Math.max(0.3, Math.round(c.conf * CONFIG.baiduConfFactor * 100) / 100);
                c.why = `${c.why}·已按百度可信度折减`;
            }
            cands.push({ ...c, src });
            notes.push(`${who}：${c.letters}（${c.why}，把握 ${(c.conf * 100).toFixed(0)}%）`);
        }
        return { cands, notes, budgetSpent };
    }

    /**
     * 多源查询链
     * 1. 按面板选择的模式决定主源，另一源作为备源
     * 2. 主源没结果/失败 → 自动降级到备源
     * 3. 主源把握不足（或题目是多选）→ 追加备源做交叉验证
     * 4. 两个来源共享「单题网络总预算」：预算耗尽立即按已得结果作答，不再重试（A6）
     * 返回 { cand, notes, budget }：cand 为 { letters, conf, srcs, why } 或 null；
     * budget=true 表示本题因预算耗尽提前收尾（不代表答案一定错）
     */
    async function queryAnswer(stem, options, type, opts = {}) {
        const forceTwoSources = !!opts.forceTwoSources;   // 强制两个来源都查（冲突题交叉验证用）
        const notes = [];
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return { cand: null, notes: ['当前离线，已跳过联网查询'], budget: false, dispute: null };
        }
        // R5：会话级答案缓存。同一道题（题型+题干指纹+选项文本都相同）本场已查过就直接复用，
        // 不再花钱联网；强制二源 / forceCrossCheck / 显式 noCache 时绕过（冲突题必须查新鲜的）。
        const cacheKey = answerCacheKey(stem, type, options);
        if (!answerCacheBypassed(opts)) {
            const hit = cacheLookup(answerCache, cacheKey);
            if (hit) {
                log(`⚡ 会话缓存命中：${hit.letters}（${(hit.conf * 100).toFixed(0)}%），本题不再联网`);
                return {
                    cand: { letters: hit.letters, conf: hit.conf, srcs: ['cache'], why: hit.why || '会话缓存' },
                    answer: hit.letters, conf: hit.conf, source: 'cache', cached: true,
                    notes: ['⚡ 会话缓存命中（本场同题已查过）'], budget: false, dispute: null,
                };
            }
        }
        const budgetMs = Math.max(1000, +CONFIG.queryBudgetMs || 20000);
        const deadline = Date.now() + budgetMs;
        const order = CONFIG.answerMode === 'ai' ? ['ai', 'baidu'] : ['baidu', 'ai'];
        const cands = [];
        let budgetSpent = false, dispute = null;
        const onDispute = ranked => {
            dispute = recordDispute(stem, type, options, ranked);
        };
        const runSource = src => (src === 'ai'
            ? queryAI(stem, options, type, { deadline })
            : queryBaidu(stem, { deadline }));
        const absorb = responses => {
            const got = combineSourceResults(responses, type, options);
            got.notes.forEach(n => notes.push(n));
            got.cands.forEach(c => cands.push(c));
            if (got.budgetSpent) budgetSpent = true;
            return got;
        };

        const sourcePlan = dualSourcePlan(type, forceTwoSources);
        if (sourcePlan === 'parallel') {
            // R6：能提前确定需要次源的场景（强制二源 / 多选），两源并行、共享同一个 deadline。
            // Promise.allSettled 保证单源失败（网络/超时/解析异常）不会影响另一源参与合并。
            const settled = await Promise.allSettled(order.map(src => runSource(src)));
            absorb(settled.map((x, i) => x.status === 'fulfilled'
                ? { src: order[i], r: x.value }
                : { src: order[i], error: x.reason }));
        } else {
            // 串行回退（保留 v2.0.6 行为）：主源把握足够就不打扰备源；预算耗尽立即按已有结果收尾（A6）
            let needSecond = true;
            for (const src of order) {
                if (!needSecond) {
                    notes.push(`主源${SRC_NAME[order[0]]}把握 ${(cands[0].conf * 100).toFixed(0)}%，跳过${SRC_NAME[src]}交叉验证`);
                    break;
                }
                if (!requestTimeout(CONFIG.baiduTimeout, deadline, Date.now())) {
                    budgetSpent = true;
                    notes.push(`⏱ 本题网络预算（${Math.round(budgetMs / 1000)} 秒）已用完，先按已获得的结果作答`);
                    break;
                }
                let r = null;
                try { r = await runSource(src); }
                catch (err) { r = { text: null, note: `请求异常：${err && err.message ? err.message : err}` }; }
                const got = absorb([{ src, r }]);
                const c = got.cands[got.cands.length - 1] || null;
                if (!c) {
                    if (budgetSpent) break;
                    if (Date.now() >= deadline) { budgetSpent = true; break; }
                    continue;
                }
                needSecond = forceTwoSources || c.conf < CONFIG.crossCheckBelow || type === 'multi';
                if (Date.now() >= deadline) {
                    budgetSpent = true;
                    notes.push(`⏱ 本题网络预算（${Math.round(budgetMs / 1000)} 秒）已用完，先按已获得的结果作答`);
                    break;
                }
            }
        }
        const merged = mergeCandidates(cands, type, options, onDispute);
        // R5：只缓存两源合并后的最终结果，避免把中间候选当成定论
        if (merged) cacheStore(answerCache, cacheKey, { letters: merged.letters, conf: merged.conf, why: merged.why });
        return { cand: merged, notes, budget: budgetSpent, dispute };
    }

    // ==================== 答题核心 ====================
    let running = false, answered = 0;
    let paused = false;          // 暂停标志
    let remainSec = null;        // 最近一次读到的剩余时间
    let lastTimeWarn = 0, timeUp = false;
    let sawNextBtn = false;      // 是否见过「下一题」，用于判断最后一题
    let autoSubmitted = false;   // 本场是否已由脚本点过「确认交卷」，收尾文案据此区分
    const history = [];
    let totalQ = 0;   // 本次考试总题数，用于进度条

    // 脚本点击计数。input.click() 同步派发事件，用计数器而不是定时器，彻底消除竞态
    let autoClicking = 0;
    function autoClick(el) {
        autoClicking++;
        try { el.click(); } finally { autoClicking--; }
    }

    /** 点某个选项：先点 input，状态没变再改点 label（兜底） */
    function clickOption(o) {
        const before = !!o.input.checked;
        autoClick(o.input);
        if (!!o.input.checked !== before) return;
        if (o.label) autoClick(o.label);
    }

    /**
     * 把页面选中态同步成目标状态，返回实际选中的字母
     * 只点「状态不一致」的选项——已经选中的不再点，避免把复选反选掉；
     * 平台没响应时最多重试 CONFIG.clickSyncRounds 轮。
     */
    async function syncSelection(options, want, click = clickOption) {
        for (let round = 0; round < CONFIG.clickSyncRounds; round++) {
            if (await pacedOp('选项点击', () => true) === undefined) return '';   // 节流等待中被停止，不再动页面
            options.forEach(o => {
                if (want.has(o.letter) !== !!o.input.checked) click(o);
            });
            if (!options.some(o => want.has(o.letter) !== !!o.input.checked)) break;
            await sleep(CONFIG.clickSyncDelay);
        }
        return options.filter(o => o.input.checked).map(o => o.letter).sort().join('');
    }

    /**
     * 监听用户手动改答案 / 手动作答
     * 以「点完之后页面上的真实选中态」为准，改几次、改回原样都能算准。本轮修三处：
     *   1) 归属：以前一律写进 history 的最后一条。点「上一题」改答案时改动会记到最后一题上，
     *      交卷对账就会用错的记录入库 —— 现在按题干找到对应记录，找不到就新建一条。
     *   2) 触发判定：以前只认 e.target 正好是 input。点 label / li / 选项文字（由站点 JS 改选中态）会漏判，
     *      现在按「落在同一个选项容器内」判定。
     *   3) 入库：用户改完立刻以「用户答案」写进题库（by='user'，优先级最高，页面关掉也不丢），
     *      并登记到手动作答记录；交卷判定答对转正、答错撤销。
     */
    function watchUserClick() {
        // 记下「按下鼠标时」的选中态：用来判断这次点击是否真的改动了选择
        let selBefore = '';
        document.addEventListener('mousedown', () => {
            try {
                if (!getBox()) return;
                const os = getOptions();
                selBefore = os.filter(o => o.input.checked).map(o => o.letter).sort().join('');
            } catch { }
        }, true);
        document.addEventListener('click', e => {
            if (autoClicking > 0) return;                       // 脚本自己点的，忽略
            if (!getBox()) return;                              // 不在考试页，跳过（避免每次点击都全量解析）
            const t = e.target;
            if (!t) return;
            const stemThen = getStem();                         // 点击发生时的题目
            const opts = getOptions();
            if (!opts.length) return;
            // 命中判定：只认「点 input 本身」「点它的 label」「同一个选项容器」
            // 去掉了「父元素包含 input 就算」的兜底——那条会把点题干、点「下一题」按钮
            // 也算成点选项，配合切题就会把上一题的答案写进下一题。
            const owned = o => {
                if (o.input === t) return true;
                if (o.label && o.label.contains && o.label.contains(t)) return true;
                if (t.closest && o.input.closest) {
                    const h = SEL.optionHolder;
                    return t.closest(h) === o.input.closest(h);
                }
                return false;
            };
            if (!opts.some(owned)) return;                      // 点的不是选项
            // 让平台的 onclick 先跑完，再读真实选中态
            setTimeout(() => {
                const stem = getStem();
                if (!stem || !stemThen || stem !== stemThen) return;      // 页面已经切题，这次点击不算改答案
                if (!opts[0].input.isConnected) return;                   // 选项 DOM 已被替换
                const sel = opts.filter(o => o.input.checked);
                const now = sel.map(o => o.letter).sort().join('');
                const texts = sel.map(o => o.text).filter(Boolean);
                const type = getType();
                const nq = normStem(stem);
                // 先按归一化题干找，再退到「同一题的截断版本」，避免为同一道题留下第二条记录
                let rec = history.find(r => normStem(r.stem) === nq)
                    || history.find(r => prefixSame(r.stem, stem));
                if (!rec) {
                    // 脚本没答过这道题（空题、或脚本已停止）——用户自己答的也要记住
                    // 但必须「这次点击确实改变了选择」才认，否则平台自带的预选态会被当成你的答案
                    if (!now || !texts.length || now === selBefore) return;
                    rec = {
                        qNum: getQNum(), stem, letters: now, pickedText: texts, type,
                        autoLetters: '', userEdited: true, by: 'user',
                        bankKey: fpKey(stem), bankHow: 'user',   // 手动作答记录也带库键，对账才有据可查（A1）
                    };
                    history.push(rec);
                    answered = history.length;
                    log(`✋ 已记录您手动作答的第 ${rec.qNum || '?'} 题：${now}`);
                } else {
                    if (now === rec.letters) return;            // 选中态没变，不记
                    rec.letters = now;
                    rec.pickedText = texts;
                    rec.userEdited = now !== (rec.autoLetters || '');
                    log(rec.userEdited
                        ? `✋ 您把答案从 ${rec.autoLetters || '（未选）'} 改为 ${now || '（未选）'}`
                        : `↩️ 答案已改回脚本所选的 ${rec.autoLetters}`);
                }
                // 只有「最终确实是用户选的」才标成用户答案：改回脚本原答案时不能标，
                // 否则脚本自己的猜测会获得最高优先级并从此不可被覆盖
                const userAuthored = !rec.autoLetters || now !== rec.autoLetters;
                rec.by = userAuthored ? 'user' : 'auto';
                if (now && texts.length && userAuthored) {
                    // 立刻入库：用户答案优先级最高，且不依赖交卷
                    if (saveUserAnswer(stem, now, texts, type)) {
                        log('💾 已按您的选择更新题库（用户答案优先；交卷判定答错会自动撤销）');
                    }
                }
                saveSession();
                updateStats();
            }, 60);
        });
    }

    // 实测切题耗时，用于自适应等待
    const switchStat = { n: 0, max: 0, total: 0 };
    function recordSwitch(ms) {
        if (ms <= 0 || ms > CONFIG.switchWaitMax) return;
        switchStat.n++; switchStat.total += ms; switchStat.max = Math.max(switchStat.max, ms);
    }
    /**
     * 自适应切题等待：没有样本时用初始值，有样本后按「实测耗时 × 系数」估算，
     * 并夹在上下限之间（不再写死 4 秒 / 10 秒）。
     */
    function switchWait(base) {
        if (!switchStat.n) return base;
        const avg = switchStat.total / switchStat.n;
        const est = Math.max(switchStat.max, avg * 1.5) * CONFIG.switchWaitAutoRatio;
        return Math.min(Math.max(Math.round(est), CONFIG.switchWaitMin), CONFIG.switchWaitMax);
    }

    // 停止按钮要让「切题等待」立刻结束，而不是等最长 12 秒超时（B4）：
    // 正在等待的 Promise 把 abort 函数登记在这里，stop 时统一调用。
    const waitAborters = new Set();
    function abortPendingWaits() {
        const list = [...waitAborters];
        waitAborters.clear();
        list.forEach(fn => { try { fn(); } catch { } });
    }

    /**
     * 尾沿节流（纯函数，自检可断言；timer 可注入假定时器）：
     * 窗口内多次调用只保留最后一次的参数，在最后一次调用后 wait 毫秒执行。
     * 用于 DOM 观察器：倒计时每秒都在改 DOM，但真正需要的是「安静下来后检查一次」（B6）。
     */
    function trailingThrottle(fn, wait, timer) {
        const t = timer || { set: setTimeout, clear: clearTimeout };
        let handle = null, pending = null, hasPending = false;
        const wrapped = (...args) => {
            pending = args; hasPending = true;
            if (handle !== null) return;                     // 窗口内已在等待：只覆盖最后一次参数
            handle = t.set(() => {
                handle = null;
                if (!hasPending) return;
                const a = pending;
                hasPending = false; pending = null;
                fn(...a);
            }, wait);
        };
        wrapped.cancel = () => {
            if (handle !== null) { t.clear(handle); handle = null; }
            hasPending = false; pending = null;
        };
        return wrapped;
    }

    /**
     * 等待切换完成
     * 1. 签名必须与旧签名不同
     * 2. 新签名要连续稳定若干轮，才算渲染结束——避免页面渲染到一半就被当成切好了
     */
    function waitForChange(sig, timeout) {
        return new Promise(resolve => {
            let done = false, last = questionSignature(), stable = 0, timer = null, to = null, obs = null, onMutation = null;
            let iv = CONFIG.pollStartInterval;
            const finish = ok => {
                if (done) return;
                done = true;
                waitAborters.delete(abort);
                try { onMutation && onMutation.cancel(); } catch { }
                try { obs && obs.disconnect(); } catch { }
                clearTimeout(timer); clearTimeout(to);
                resolve(ok);
            };
            const abort = () => finish(false);       // 点「停止」时由 abortPendingWaits() 调用（B4）
            waitAborters.add(abort);
            const check = () => {
                if (done) return;
                if (!running) return finish(false);   // 已停止：立刻结束等待，主循环下一轮就退出
                const now = questionSignature();
                if (now !== last) { last = now; stable = 0; iv = CONFIG.pollStartInterval; return; }   // 页面在动，恢复正常频率
                if (now === sig) return;
                if (++stable >= CONFIG.switchStableRounds) finish(true);
            };
            // 轮询间隔逐步退避：页面没动静时不再高频读 DOM
            const tick = () => {
                if (done) return;
                check();
                if (done) return;
                iv = Math.min(Math.round(iv * 1.6), CONFIG.pollMaxInterval);
                timer = setTimeout(tick, iv);
            };
            // 只观察题目容器（找不到再退回 body）：倒计时每秒都会改 DOM，观察全 body 等于每秒跑一次
            // questionSignature（B6）。回调做 100ms 尾沿节流，标签页不可见时先不读 DOM。
            onMutation = trailingThrottle(() => {
                if (done) return;
                if (typeof document !== 'undefined' && document.hidden) return;
                iv = CONFIG.pollStartInterval;
                check();
            }, CONFIG.mutationThrottleMs);
            obs = new MutationObserver(onMutation);
            const target = getBox() || (typeof document !== 'undefined' ? document.body : null);
            if (target) obs.observe(target, { childList: true, subtree: true, characterData: true });
            timer = setTimeout(tick, iv);
            // 超时也做一次判定：有变化就认，没变化才算失败
            to = setTimeout(() => finish(running && questionSignature() !== sig), timeout);
        });
    }

    async function waitForNew(oldSig, timeout) {
        const t0 = Date.now();
        const ok = await waitForChange(oldSig, timeout);
        if (ok) {
            recordSwitch(Date.now() - t0);
            await sleep(CONFIG.switchSettleDelay);
        }
        return ok;
    }


    /** 页面就绪：题目与选项都出现才算就绪 */
    async function waitReady(timeout = CONFIG.readyTimeout) {
        const start = Date.now();
        let iv = CONFIG.pollStartInterval;
        while (Date.now() - start < timeout) {
            if (getStem() && getOptions().length) return true;
            await sleep(iv);
            iv = Math.min(Math.round(iv * 1.6), CONFIG.pollMaxInterval);   // 逐步退避，别高频撞页面
        }
        return false;
    }

    // ==================== 作答策略 ====================
    /** 枚举 arr 中取 k 个的所有组合，按字典序 */
    function combosOf(arr, k) {
        if (k <= 0 || k > arr.length) return [];
        if (k === arr.length) return [arr.join('')];
        if (k === 1) return arr.slice();
        const out = [];
        const walk = (start, acc) => {
            if (acc.length === k) { out.push(acc.join('')); return; }
            for (let i = start; i < arr.length; i++) walk(i + 1, [...acc, arr[i]]);
        };
        walk(0, []);
        return out;
    }

    /**
     * 多选题的组合顺序：全选 → 少一个 → 少两个 ……
     * 选项数 3~6 个都适用，不再假设固定 4 个
     * 注意：这里按 CONFIG.multiMaxTries 截断；「组合总数是否多到不能穷举」由 multiComboPlan 判断。
     */
    function multiCombos(options) {
        return multiComboPlan(options).combos;
    }

    /** 组合数 C(n,k)（纯函数，自检可断言） */
    function binomial(n, k) {
        const N = Math.max(0, Math.floor(+n) || 0);
        let K = Math.max(0, Math.floor(+k) || 0);
        if (K > N) return 0;
        K = Math.min(K, N - K);
        let r = 1;
        for (let i = 1; i <= K; i++) r = r * (N - K + i) / i;
        return Math.round(r);
    }

    /**
     * 多选组合总数（纯函数，自检可断言，R4）
     * 只累加到 cap+1：选项数很大时也不做无意义的精确计算。
     */
    function multiComboCount(n, minK, cap = CONFIG.multiComboLimit) {
        const N = Math.max(0, Math.floor(+n) || 0);
        const lo = Math.max(1, Math.floor(+minK) || 1);
        const limit = Math.max(1, Math.floor(+cap) || 1);
        let total = 0;
        for (let k = N; k >= lo; k--) {
            total += binomial(N, k);
            if (total > limit) return limit + 1;    // 已确定超限，不必再算
        }
        return total;
    }

    /**
     * 多选组合计划（纯函数，自检可断言，R4）
     * 正常题（组合总数 ≤ CONFIG.multiComboLimit）：与旧版一样按「全选→少一个…」生成，
     * 最多 CONFIG.multiMaxTries 个，返回 { combos, exhausted:false }。
     * 组合总数超限（选项一多就是组合爆炸：10 个选项 1013 种）或生成预算
     * （CONFIG.multiComboBudgetMs）耗尽：exhausted:true，调用方不再穷举，
     * 改走「可信候选优先，否则随机保留」的降级策略。
     * opts 可注入 { limit, budgetMs, now } 便于自检；now 是返回毫秒的函数。
     */
    function multiComboPlan(options, opts = {}) {
        const all = (options || []).map(o => o.letter);
        const n = all.length;
        const minK = Math.min(CONFIG.multiMinChoices, n);
        const limit = Math.max(1, Math.floor(+(opts.limit ?? CONFIG.multiComboLimit)) || 256);
        const budget = Math.max(0, +(opts.budgetMs ?? CONFIG.multiComboBudgetMs) || 0);
        const maxOut = Math.max(1, Math.floor(+CONFIG.multiMaxTries) || 6);
        const clock = typeof opts.now === 'function' ? opts.now : Date.now;
        const total = multiComboCount(n, minK, limit);
        if (total > limit) {
            return { combos: [], exhausted: true, reason: 'over-limit', total, elapsedMs: 0 };
        }
        const t0 = +clock() || 0;
        const out = [];
        let timedOut = false;
        for (let k = n; k >= minK && out.length < maxOut && !timedOut; k--) {
            for (const c of combosOf(all, k)) {
                if (out.length >= maxOut) break;
                if (budget > 0 && (+clock() || 0) - t0 > budget) { timedOut = true; break; }
                out.push(c);
            }
        }
        return {
            combos: out,
            exhausted: timedOut,
            reason: timedOut ? 'timeout' : '',
            total,
            elapsedMs: Math.max(0, (+clock() || 0) - t0),
        };
    }

    /** 组合的文本签名：组内选项文本排序后以 + 连接，选项乱序不影响比较 */
    function comboKey(options, letters) {
        return options.filter(o => letters.includes(o.letter))
            .map(o => String(o.text).replace(/\s+/g, '')).sort().join('+');
    }

    /**
     * 作答决策
     * 入参 options / wrongTexts（绝对不可选的选项文本）/ triedCombos（多选已失败组合）/
     *      cand（题库或联网给的候选字母）/ candConf（该候选的把握度 0~1，弱候选会被降级为「没有候选」）
     * 返回 { letters, why, strategy }
     */
    function chooseAnswer({ type, options, wrongTexts = [], triedCombos = [], cand = null, candConf = null }) {
        // 错项匹配置换：只认「归一化后相等」；其次才认「短的那边 ≥4 字」的包含关系，且必须唯一。
        // 旧实现对任意长度的双向子串一律判等——错项「书面」会把正确项「书面形式」一起排除，
        // 更致命的是题库给出的正确候选也会被 pool 丢掉，这题就再也答不对了。
        const norm = t => normStem(t);
        const isWrongOpt = o => {
            const a = norm(o.text);
            if (!a) return false;
            let loose = 0;
            for (const t of wrongTexts) {
                const b = norm(t);
                if (!b) continue;
                if (a === b) return true;
                if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) loose++;
            }
            return loose === 1;      // 有歧义（多个错项都能包含）就不排除，宁可不排除也不错排
        };
        const kept = options.filter(o => !isWrongOpt(o));          // 排除已知错误选项后的候选
        const allLetters = options.map(o => o.letter).join('');
        // 候选先过把握度门槛：弱候选（百度孤立字母折减后 0.3x、AI 文本兜底）直接当没有候选，
        // 单选交给排除法、多选交给组合策略；candConf 不传（旧调用/自检）按可信候选处理，保持兼容（A4）。
        const minConf = (CONFIG.minCandConf && CONFIG.minCandConf[type]) || 0;
        const candTrusted = candConf === null || candConf === undefined || candConf >= minConf;
        // 候选再过排除法：候选里落在已知错误选项上的字母一律剔掉
        const pool = (cand && candTrusted) ? cand.split('').filter(l => kept.some(o => o.letter === l)) : [];

        if (type === 'multi') {
            // 候选有 2 项以上才采信（只给一个字母等于没查到），且这个组合不能是已经失败过的
            if (pool.length >= Math.max(2, CONFIG.multiMinChoices)) {
                const key = comboKey(options, pool.join(''));
                if (!triedCombos.includes(key)) {
                    return { letters: pool.join(''), why: `候选 ${pool.join('')}`, strategy: 'cand' };
                }
            }
            // 没有可靠候选（或候选组合已失败过）→ 走组合序列
            // R4：选项很多时组合数是组合爆炸（10 个选项就有 1013 种），不再穷举。
            // 超限/生成超时：可信候选分支上面已经处理过，这里退化为「随机保留 minCand 个选项」，
            // 保证不抛错、不把页面点满；正常小题仍走下面的组合序列。
            const plan = multiComboPlan(options);
            if (plan.exhausted) {
                const letters = kept.map(o => o.letter);
                const size = Math.max(2, Math.min(CONFIG.multiMinChoices, letters.length));
                const bag = [...letters];
                const pick = [];
                while (pick.length < size && bag.length) {
                    const i = Math.floor(Math.random() * bag.length);
                    pick.push(bag.splice(i, 1)[0]);
                }
                return {
                    letters: pick.length >= 2 ? pick.sort().join('') : allLetters,
                    why: `组合过多（${plan.reason || '超限'}），随机保留 ${pick.length} 项`,
                    strategy: 'random-kept',
                };
            }
            const seq = plan.combos;
            const notTried = c => !triedCombos.includes(comboKey(options, c));
            const noWrong = c => c.split('').every(l => kept.some(o => o.letter === l));
            let usable = seq.filter(c => notTried(c) && noWrong(c));
            if (!usable.length) usable = seq.filter(notTried);   // 排除法把组合清空了，放宽到只避开已试组合
            if (!usable.length) usable = seq;                     // 组合都用过，只能用回第一个
            const first = usable[0] || allLetters;
            const dropped = options.length - first.length;
            return {
                letters: first,
                why: dropped <= 0 ? '优先全选' : `少 ${dropped} 个`,
                strategy: 'multi-combo',
            };
        }

        // 单选 / 判断：只有唯一候选才直接采用。
        // 两个以上字母对单选题没有意义（以前会把「AB」原样传下去，脚本就去点两个选项），交给排除法
        if (pool.length === 1) return { letters: pool[0], why: '候选', strategy: 'cand' };

        // 排除法兜底
        if (kept.length === 1) {
            return { letters: kept[0].letter, why: '排除后只剩一个', strategy: 'exclude' };
        }
        if (!kept.length) {
            // 单选/判断把所有选项都排除光，说明错题记录本身有问题。
            // 旧实现返回 allLetters（如「ABCD」）——对单选题等于把每个选项都点一遍，
            // 最终由页面决定选中哪个，等于固定选错。现在交回去「清错题记录 + 重查」。
            return { letters: null, why: '错误记录把所有选项都排除了，已清空该题错题记录后重试', strategy: 'reset-wrong' };
        }
        // 还有多个候选：只在没被排除的选项里随机，不再全量乱选
        const pick = kept[Math.floor(Math.random() * kept.length)];
        return { letters: pick.letter, why: `排除后 ${kept.length} 选 1`, strategy: 'random-kept' };
    }

    async function answerCurrent() {
        const stem = getStem();
        if (!stem) { log('未找到题干'); return { ok: false, reason: 'no-stem' }; }
        const opts = getOptions();
        if (!opts.length) { log('未找到选项'); return { ok: false, reason: 'no-options' }; }

        const qNum = getQNum(), type = getType();
        log(`📝 第${qNum || '?'}题（${type === 'multi' ? '多选' : type === 'judge' ? '判断' : '单选'}）：${stem.slice(0, 30)}...`);
        updateStatus(`答题中：第 ${qNum || '?'} 题`);

        // 统计只按「每道题第一次」算，重试不再灌水（以前 answered / session.ans 在失败重试路径也会涨）
        const statKey = normStem(stem);
        const firstTry = !session.attempted.has(statKey);
        if (firstTry) { session.attempted.add(statKey); session.ans++; }

        // 查答案：本地题库优先（精确 → 旧键 → 相似题），命中就不再花钱查 AI/百度。
        // validConf 记录答案来源的把握度，弱候选（0.3x）不会在 chooseAnswer 里压过排除/组合策略（A4）；
        // bankKey/bankHow 记录命中的真实库键（模糊命中时是 fpKey(e.q)，不是本题规范键），
        // 交卷对账答错时靠它才能删掉库里记错的答案（A1）。
        let valid = null, networkDone = false, validConf = 1, bankKey = '', bankHow = 'none';
        const hitE = lookupBank(stem, type);
        if (hitE) {
            // 只有「同一题的旧键/截断版本」才升级键。
            // 以前相似题命中也会走到 upgradeKey，会把另一道题的条目改名搬走——必须禁止。
            if (hitE.how === 'legacy') {
                const nk2 = upgradeKey(hitE.key, stem);
                if (nk2) hitE.key = nk2;          // 升键后记录新键，别拿旧键去对账
            }
            bankKey = hitE.key; bankHow = hitE.how;
            const conv = entryToLetters(hitE.e, opts);
            valid = normalizeAnswer(conv.letters, opts, type);
            hitE.e.hit++; hitE.e.us = TS(); dirty = true;
            if (valid) {
                session.hit++;
                const howTxt = hitE.how === 'exact' ? '精确'
                    : hitE.how === 'fuzzy' ? `相似 ${(hitE.sim * 100).toFixed(0)}%`
                    : hitE.how === 'judge-fuzzy' ? (hitE.diff ? `判断题干差 ${hitE.diff} 字` : '判断题干规范相同')
                    : '旧记录';
                const byTxt = isUserEntry(hitE.e) ? '用户手改' : '脚本';
                log(`📚 题库命中（${howTxt}·${byTxt}）：${conv.letters}`);
                dbg(`命中来源 ${conv.how || howTxt} · 词条 t=${hitE.e.t} · by=${hitE.e.by || '脚本'} · 转换字母 ${conv.letters}`);
            } else {
                log(`⚠️ 题库命中但${conv.reason}，改查网络`);
            }
            // 冲突题（同一题历史答案被改过 ≥ N 次）：题库不再算数，必须联网交叉验证；
            // 网络与题库一致才放心用，不一致时采用更新鲜的网络结果（题库正是靠交卷结果自纠错的）。
            if (valid && (hitE.e.cft || 0) >= CONFIG.crossCheckConflictMin) {
                log(`⚔️ 题库该题历史冲突 ${hitE.e.cft} 次，不直接采信：联网交叉验证`);
                const qr2 = await queryAnswer(stem, opts, type, { forceTwoSources: true });
                qr2.notes.forEach(n => log(`🔍 ${n}`));
                if (qr2.cand) {
                    if (qr2.cand.letters === valid) {
                        log(`✅ 冲突题交叉验证：题库与网络一致（${valid}），采用`);
                    } else {
                        log(`⚠️ 冲突题交叉验证：题库(${valid}) 与网络(${qr2.cand.letters}) 不一致，采用网络结果`);
                        valid = qr2.cand.letters;
                        validConf = qr2.cand.conf;
                    }
                } else {
                    log('⚠️ 冲突题网络也没给出答案，交回排除/兜底');
                    valid = null;
                }
                networkDone = true;
            }
        }
        if (!valid && !networkDone) {
            const qr = await queryAnswer(stem, opts, type);
            qr.notes.forEach(n => log(`🔍 ${n}`));
            if (qr.cand) {
                const who = qr.cand.srcs.map(x => SRC_NAME[x]).join('+');
                const cross = qr.cand.srcs.length > 1 ? '（多源一致）' : '';
                valid = qr.cand.letters;
                validConf = qr.cand.conf;
                log(`✅ 采用${who}答案：${valid}${cross}，把握 ${(qr.cand.conf * 100).toFixed(0)}%`);
            } else {
                log('⚠️ 各来源均未给出可用答案，转排除/随机兜底');
            }
        }

        // 作答决策：候选 → 排除法 → 多选组合序列
        const wrongTexts = wrongFor(stem), triedCombos = triedFor(stem);
        if (wrongTexts.length) log(`🚫 已知错误选项：${wrongTexts.join(', ')}`);
        if (triedCombos.length) log(`🚫 已失败组合 ${triedCombos.length} 个`);
        const plan = chooseAnswer({ type, options: opts, wrongTexts, triedCombos, cand: valid, candConf: validConf });
        valid = plan.letters;
        if (plan.strategy === 'reset-wrong') {
            // 错题记录把所有选项都排除了——先清掉它，下一轮重新查
            const cleared = dropWrongFor(stem);
            log(`🧹 ${plan.why}（清掉 ${cleared} 条错题记录）`);
            return { ok: false, reason: 'invalid-answer' };
        }
        dbg(`本题作答 ${valid}（${type}）· 已排除错误项 ${(wrongTexts || []).length} 条 · 已失败组合 ${(triedCombos || []).length} 个`);
        log(`🧠 ${plan.why} → ${valid}`);

        // 校验：字母必须都在可用范围内，且多选题不能只选一个
        const letters = opts.map(o => o.letter);
        if (!valid || !valid.split('').every(l => letters.includes(l))) { log('⚠️ 答案无效'); return { ok: false, reason: 'invalid-answer' }; }
        if (type === 'multi' && valid.length < CONFIG.multiMinChoices) { log('⚠️ 多选题答案不足两项'); return { ok: false, reason: 'invalid-answer' }; }

        // 点击选项：只动选中态不一致的，点完复核实际状态
        const want = new Set(valid.split(''));
        const picked = await syncSelection(opts, want);
        if (!picked) {
            // 点不上就不再强行点第一个——那会把假答案写进题库
            log('⚠️ 选项未能选中（页面可能未响应），本题不计入记录');
            return { ok: false, reason: 'click-failed' };
        }
        if (picked !== [...valid].sort().join('')) {
            log(`⚠️ 实际选中 ${picked} 与预期 ${valid} 不一致，按实际选中记录`);
            valid = picked;
        }
        // 用真实选中态回填答案与选项文本，保证记录与页面一致
        const pickedText = opts.filter(o => o.input.checked).map(o => o.text).filter(Boolean);
        if (!pickedText.length) {
            log('⚠️ 选中项文本为空，本题不计入记录');
            return { ok: false, reason: 'no-text' };
        }

        // 记录本次作答（未交卷前不入正确题库，但会落盘以免刷新丢失）
        history.push({
            qNum, stem, letters: valid, pickedText, type,
            autoLetters: valid,      // 脚本自动选的答案，用于识别用户后续改动
            userEdited: false,
            by: 'auto',              // 'user' = 用户后来手改过
            bankKey: bankKey || fpKey(stem),   // 作答时命中的真实库键（交卷对账按它定位，A1）
            bankHow,                 // exact / legacy / fuzzy / none
        });
        saveSession();
        answered = history.length;   // answered 只是 history 的镜像，不再单独自增
        updateProgress(history.length, totalQ);
        updateStats();
        return { ok: true };
    }

    // ==================== 成绩解析 ====================
    // 交卷后平台才显示对错。这里不再只认「背景色是绿色」，
    // 而是多路识别：图例参考色 → 背景/文字绿红 → 类名 → 图标或文字标记。
    let lastSubmitTs = 0, parsedOnce = false, parseRunning = false;
    let parseTimer = null, parseWatchdog = null;   // 解析重试定时器 / 超时看门狗（B3）

    const parseRgb = s => {
        const m = String(s || '').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/);
        if (!m) return null;
        if (m[4] !== undefined && +m[4] === 0) return null;      // 全透明不算颜色
        return [+m[1], +m[2], +m[3]];
    };
    const colorNear = (a, b, tol) => !!a && !!b
        && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) <= tol * 3;
    /** 两色 RGB 差值总和；有一方没取到颜色就返回 Infinity */
    const colorDist = (a, b) => (a && b)
        ? Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) : Infinity;
    /**
     * 在容差内找「最近」的图例类别。
     * 以前按 correct→wrong→unanswered 顺序逐条试 colorNear，换肤后「未答灰」与「答对绿」
     * 只差十几点色差时，灰格子会被当成答对写进题库。现在取距离最近的那个；
     * 距离完全相同时按 未答 > 错 > 对 取舍（保守：宁可少判定，也不写错题库）。
     */
    const legendVerdict = (bg, legend) => {
        const rank = { unanswered: 0, wrong: 1, correct: 2 };
        let best = '', bestD = Infinity;
        for (const [key, ref] of Object.entries(legend || {})) {
            const d = colorDist(bg, ref);
            if (d < bestD - 1e-9 || (Math.abs(d - bestD) < 1e-9 && (rank[key] || 0) < (rank[best] || 0))) {
                best = key; bestD = d;
            }
        }
        return best && bestD <= CONFIG.colorMatchTolerance * 3 ? best : null;
    };
    const isGreenish = c => !!c && c[1] > c[0] + CONFIG.greenDelta && c[1] > c[2] + CONFIG.greenDelta && c[1] > 80;
    const isReddish = c => !!c && c[0] > c[1] + CONFIG.greenDelta && c[0] > c[2] + CONFIG.greenDelta && c[0] > 80;
    const isGrayish = c => !!c && Math.max(...c) - Math.min(...c) < 24;
    const classOf = el => {
        const c = el && el.className;
        const s = c && c.baseVal !== undefined ? c.baseVal : c;    // SVG 的 className 是对象
        return `${s || ''} ${(el && el.parentElement && el.parentElement.className) || ''}`;
    };

    /** 取计算样式：同源 iframe 里的元素要用它自己文档的 window，顶层 window 取不到 */
    function csOf(el) {
        try {
            const w = (el && el.ownerDocument && el.ownerDocument.defaultView) || window;
            return typeof w.getComputedStyle === 'function' ? w.getComputedStyle(el) : null;
        } catch { return null; }
    }

    /**
     * 结果页可能被平台放在同源 iframe 里（有的版本把答题卡嵌在内嵌框架）。
     * 顶层文档扫不到就会漏判，所以统一按「顶层 + 同源 iframe」取根节点；
     * 跨域 iframe 读不到 contentDocument，直接跳过。
     */
    function resultRoots() {
        const roots = [document];
        for (const f of document.querySelectorAll('iframe, frame')) {
            try {
                const d = f.contentDocument;
                if (d && d.body) roots.push(d);
            } catch { /* 跨域 iframe 读不了，忽略 */ }
        }
        return roots;
    }

    /**
     * 答题卡格子的文本要「整段就是一个题号」：1 / 12. / 12、/ 12题 / 第12题。
     * 旧实现只认纯数字，「第12题」这种写法会整题漏掉；而「10/10」「答案12」「85分」
     * 这类不能算题号（把评分区、进度条上的数字当成题号，会覆盖真实判定）。
     */
    function cellNumberText(t) {
        const m = String(t || '').match(/^(?:第\s*)?(\d{1,3})(?:\s*题)?\s*[.、．:：]?$/);
        if (!m) return 0;
        const n = +m[1];
        return n >= 1 && n <= CONFIG.maxQuestionNum ? n : 0;
    }

    /** 结果页正文：顶层 + 同源 iframe，并剔除脚本自己的面板（面板日志里可能出现「正确答案」等字样） */
    function resultBodyText(roots) {
        const texts = [];
        for (const root of roots || resultRoots()) {
            const body = root.body;
            if (!body) continue;
            let t = body.innerText || body.textContent || '';
            if (root === document) {
                const panel = document.getElementById('fx-panel');
                const pt = panel && panel.innerText;
                if (pt) t = t.split(pt).join(' ');
            }
            texts.push(t);
        }
        return texts.join('\n');
    }

    /**
     * 解析失败时的自诊断：把「为什么没认出来」写进日志。
     * 不联网、不改页面；只用于用户反馈时判断是页面结构问题还是颜色问题。
     */
    function resultDiag(rootsIn, legendIn) {
        const roots = rootsIn || resultRoots();
        let elements = 0, numeric = 0, visible = 0;
        const samples = [];
        for (const root of roots) {
            let list = [];
            try { list = root.querySelectorAll(CONFIG.resultScanSelector); } catch { continue; }
            for (const el of list) {
                elements++;
                const t = elText(el);
                const n = cellNumberText(t);
                if (!n) {
                    if (samples.length < 8 && /^\d{1,3}[^\d]{0,4}$/.test(t)) samples.push(`~${t}`);
                    continue;
                }
                numeric++;
                if (!isVisible(el)) continue;
                visible++;
                if (samples.length < 8) {
                    const st = csOf(el);
                    samples.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${(classOf(el).split(' ')[0] || '-')} bg=${st ? st.backgroundColor : '?'} fg=${st ? st.color : '?'}`);
                }
            }
        }
        const legend = legendIn || readLegendColors(roots);
        const opens = [];
        for (const root of roots) {
            for (const el of root.querySelectorAll('a, button, span, div, li')) {
                const t = elText(el);
                if (t && t.length <= 8 && /查看答题卡|答题卡|查看解析|查看试卷|查看答卷|核对答案|查看答案/.test(t) && !opens.includes(t)) opens.push(t);
            }
        }
        dbg(`成绩页诊断：${roots.length} 个文档 / ${elements} 个元素 / ${numeric} 个数字候选 / ${visible} 个可见格子 / 图例 ${Object.keys(legend).join('/') || '无'}`);
        if (samples.length) dbg(`成绩页诊断样例：${samples.join(' | ')}`);
        if (opens.length) dbg(`成绩页诊断入口：${opens.slice(0, 6).join(' / ')}`);
        return { opens };
    }

    let resultOpenHooked = false;
    /** 用户点开「查看答题卡 / 查看解析」后，等渲染完自动再解析一次（答题卡默认收起时旧流程只能手点解析） */
    function watchResultOpen() {
        if (resultOpenHooked) return;
        resultOpenHooked = true;
        const re = new RegExp(CONFIG.resultOpenWords.join('|'));
        document.addEventListener('click', e => {
            let el = e.target;
            for (let i = 0; el && i < 4; i++, el = el.parentElement) {
                const t = el.nodeType === 1 ? elText(el) : '';
                if (t && t.length <= 8 && re.test(t)) {
                    log('👀 看到你点开答题卡入口，2 秒后自动再解析一次…');
                    setTimeout(parseResult, 2000);
                    return;
                }
            }
        }, true);
    }

    /**
     * 从图例取参考色
     * 结果页一般有「●正确 ●错误 ●未答」图例，用它自己的颜色当基准，
     * 换主题、换配色都不用改代码。
     */
    function readLegendColors(roots) {
        const out = {};
        if (typeof window.getComputedStyle !== 'function') return out;
        // 图例可能在顶层文档，也可能在同源 iframe 里，全部扫一遍
        const els = [];
        for (const root of roots || resultRoots()) {
            try { els.push(...root.querySelectorAll('span, div, li, p, td, i, em, b, strong')); } catch { }
        }
        for (const el of els) {
            // 性能：先用原始 textContent 的「短文本」做预过滤（整页几千个节点时便宜得多），
            // 只有可能是图例的短文本才做 elText 归一化。
            const raw = String(el.textContent || '').trim();
            if (!raw || raw.length > 10) continue;
            const t = elText(el);
            if (!t || t.length > 10) continue;
            const key = /未答|放弃|未做/.test(t) ? 'unanswered'
                : (/错误|答错|不正确/.test(t) ? 'wrong' : (/正确|答对/.test(t) ? 'correct' : ''));
            if (!key || out[key]) continue;
            for (const c of [el.firstElementChild, el, el.previousElementSibling, el.nextElementSibling]) {
                if (!c) continue;
                const st = csOf(c);
                if (!st) continue;
                const col = parseRgb(st.backgroundColor) || parseRgb(st.color);
                // 「未答」图例本来就是灰色，不能被 isGrayish 过滤掉（否则 legend.unanswered 永远取不到）
                if (col && (key === 'unanswered' || !isGrayish(col))) { out[key] = col; break; }
            }
            if (out.correct && out.wrong && out.unanswered) break;   // 三色都拿到就不用再扫剩余节点
        }
        return out;
    }

    /**
     * 单个答题卡格子的判定
     * 依次看：类名 → 图标或文字标记 → 图例参考色 → 背景绿/红/灰。
     * 任何一路命中即可，不再只认 RGB 绿色。
     */
    function cellVerdict(el, legend) {
        const cls = classOf(el);
        if (/unans|notanswer|weida|blank|no-answer/i.test(cls)) return 'unanswered';
        if (/correct|right|success|green|dui|pass|ok-answer/i.test(cls)) return 'correct';
        if (/wrong|error|err\b|red|cuo|fail|incorrect/i.test(cls)) return 'wrong';

        // 图标 / 文字标记
        const marks = [
            elText(el),
            ...[...el.querySelectorAll('i, em, b, span, svg, img')].map(x => `${elText(x)} ${classOf(x)}`),
        ].join(' ');
        if (/[✓✔√]|答对|正确/.test(marks)) return 'correct';
        if (/[×✕✗]|答错|错误/.test(marks)) return 'wrong';

        const st = csOf(el);
        if (!st) return null;
        const bg = parseRgb(st.backgroundColor);
        const fg = parseRgb(st.color);
        // 取最近的图例色，而不是「正确优先」逐条试：未答灰和答对绿在某些换肤下只差十几点，
        // 逐条试会把灰格子判成答对、再写进题库
        const legendHit = legendVerdict(bg, legend);
        if (legendHit) return legendHit;
        if (!bg || isGrayish(bg)) {
            // 背景透明/白色时再用文字色兜一次（部分皮肤用彩色文字标状态）
            const fgHit = legendVerdict(fg, legend);
            if (fgHit) return fgHit;
        }
        if (isGreenish(bg) || isGreenish(fg)) return 'correct';
        if (isReddish(bg)) return 'wrong';
        if (isGrayish(bg)) return 'unanswered';
        return null;
    }

    /**
     * 扫答题卡，逐题判定
     * 题号上限提到 500，数字允许 1~3 位，可见性判断也不再只认 offsetParent，
     * 结果落在 { 题号: 'correct' | 'wrong' | 'unanswered' }
     */
    function collectResult(rootsIn, legendIn) {
        const roots = rootsIn || resultRoots();
        const legend = legendIn || readLegendColors(roots);
        if (Object.keys(legend).length) dbg(`图例参考色：${JSON.stringify(legend)}`);
        const seen = {};
        const rank = { unanswered: 1, wrong: 2, correct: 3 };
        // 1) 先收集「整段文本就是一个数字」的可见元素（答题卡格子）
        const cells = [];
        for (const root of roots) {
            for (const el of root.querySelectorAll(CONFIG.resultScanSelector)) {
                // 性能：先用原始 textContent 排除绝大多数非数字节点（长文本 / 空节点），
                // 只对短文本做归一化与可见性判断，避免整页几千个节点都跑一遍正则。
                const raw = el.textContent;
                if (!raw || raw.length > 40) continue;
                const n = cellNumberText(raw.trim());
                if (!n) continue;                       // 不是题号格子，排除 "10/10"、分数、页码
                if (!isVisible(el)) continue;
                cells.push({ el, n });
            }
        }
        if (!cells.length) {
            dbg(`答题卡扫描：${roots.length} 个文档里没找到题号格子`);
            return seen;
        }
        // 2) 锁定「答题卡容器」：取包含最多格子的祖先，避免把页面上孤立的数字（分数、页码、
        //    题号导航）也当成题号，更避免它们用一个误判的 correct 覆盖真实判定
        let card = null, bestCount = 0;
        const probe = cells.length > 120 ? cells.slice(0, 120) : cells;   // 长卷子限制搜索量
        for (const { el } of probe) {
            let p = el.parentElement, depth = 0;
            while (p && depth++ < 6) {
                let cnt = 0;
                for (const c of cells) if (p.contains(c.el)) cnt++;
                if (cnt > bestCount) { bestCount = cnt; card = p; }
                p = p.parentElement;
            }
        }
        const scope = (card && bestCount >= 3) ? cells.filter(c => card.contains(c.el)) : cells;
        if (scope.length < cells.length) {
            dbg(`答题卡容器锁定：${scope.length}/${cells.length} 个数字格子，其余 ${cells.length - scope.length} 个视为无关数字已忽略`);
        }
        // 3) 逐格判定；同一题号在多处出现时按「对 / 错 / 未答」的优先级合并
        for (const { el, n } of scope) {
            const v = cellVerdict(el, legend);
            if (!v) continue;
            if (!seen[n] || rank[v] > rank[seen[n]]) seen[n] = v;
        }
        if (!Object.keys(seen).length) {
            dbg(`答题卡扫描：${scope.length} 个格子都没判定出对错（图例 ${Object.keys(legend).join('/') || '无'}）`);
        }
        return seen;
    }

    /** 从页面读分数与总分 */
    function readScore(body) {
        const txt = body === undefined ? resultBodyText() : body;
        let m = txt.match(/您的分数\s*(?:为)?\s*[:：]?\s*(\d{1,3})\s*分/)
            || txt.match(/(?:得\s*分|成绩|本次得分|考试成绩)\s*[:：]?\s*(\d{1,3})\s*分/);
        const score = m ? +m[1] : null;
        const mt = txt.match(/(?:总分|满分|试卷总分)\s*[:：]?\s*(\d{1,3})\s*分/);
        return { score, total: mt ? +mt[1] : null };
    }

    /**
     * 结果页快照：把正文 / 分数 / 图例 / 答题卡判定一次算好。
     * 解析有 10 次重试机会，旧实现每次都要把「正文 innerText + 图例背景色 + 扫描所有格子」
     * 重复算 2~3 遍（isResultPage 一遍、collectResult 再一遍），大页面上单次要 1 秒左右。
     * 现在每次尝试只算一次快照，结果页判定与入库都复用它。
     */
    /**
     * 轻量快照：只取正文与分数，不扫图例颜色、不逐格判定。
     * 解析重试时先用它做「像不像成绩页」的便宜判断，只有可能是成绩页才做昂贵扫描——
     * 旧实现每次重试都把整页图例色和答题卡扫一遍，大页面上单次要 1 秒。
     */
    function resultPageInfo(rootsIn) {
        const roots = rootsIn || resultRoots();
        const body = resultBodyText(roots);
        return { roots, body, score: readScore(body), hasCard: /答题卡/.test(body) };
    }

    /** 页面是否已有「成绩页专属」的明确证据（不依赖逐格判定，成本低） */
    function lightLooksLikeResult(light) {
        if (/答题结果|成绩解析|正确率|答对\s*\d+\s*题|您的分数/.test(light.body)) return true;
        return light.score.score !== null && (light.hasCard || /未答|答错|答对/.test(light.body));
    }

    function resultSnapshot(rootsIn, lightIn) {
        const roots = rootsIn || resultRoots();
        const light = lightIn || resultPageInfo(roots);
        const legend = readLegendColors(roots);
        const verdicts = collectResult(roots, legend);
        return { roots, body: light.body, score: light.score, hasCard: light.hasCard, legend, verdicts };
    }

    /** 用快照判断是不是结果页（判断口径与旧版一致，只是不再重复扫描） */
    function isResultPageFrom(body, score, verdicts) {
        const hasCard = /答题卡/.test(body);
        // 结果页专有措辞：到成绩页才会出现「正确率 / 答对N题 / 答题结果 / 成绩解析」这类字样
        if (/答题结果|成绩解析|正确率|答对\s*\d+\s*题|您的分数/.test(body)) return true;
        // 光有分数不够：考试列表页每门课都显示「考试成绩：100分」，
        // 旧实现会把它当成成绩页，空转十几次解析后提示「确认停在结果页」——用户以为解析坏了。
        if (score && score.score !== null && (hasCard || /未答|答错|答对/.test(body))) return true;
        // 答题卡上真的能读出对错（≥3 个题号有判定）
        return hasCard && Object.keys(verdicts || {}).length >= 3;
    }

    /** 这个页面像不像考试结果页（先做便宜判断，必要时才扫答题卡） */
    function isResultPage() {
        const light = resultPageInfo();
        if (lightLooksLikeResult(light)) return true;
        // 答题卡上真的能读出对错（≥3 个题号有判定）
        return light.hasCard && Object.keys(collectResult(light.roots)).length >= 3;
    }

    /**
     * 交卷/离开确认是不是真的
     * 原来只要页面上有文本叫「确定」的元素被点到就触发解析，
     * 页面上随便一个「确定」都会误触发。现在要求：
     *   - 不能是我们自己面板里的元素
     *   - 文本本身是「确定交卷 / 确认交卷 / 确认提交」这类，或
     *   - 是「确定」但必须出现在含「交卷 / 提交 / 离开 / 退出」的弹窗里
     */
    function isSubmitConfirm(el) {
        if (!el || !el.closest) return false;
        if (el.closest('#fx-panel')) return false;                    // 自己面板的不算
        let t = elText(el);
        // 点到「确定」按钮里的文字或图标时 e.target 不是按钮本身，先归到最近的按钮元素
        if (!t || (t !== '确定' && t !== '确认' && !/确定交卷|确认交卷|确认提交|确定提交/.test(t))) {
            const c = el.closest('a, button, input[type="submit"], input[type="button"], [role="button"]');
            if (c) t = elText(c);
        }
        if (/确定交卷|确认交卷|确认提交|确定提交/.test(t)) return true;
        if (t !== '确定' && t !== '确认') return false;
        const dlg = el.closest(SEL.dialog);
        const ctx = `${(dlg && dlg.innerText) || ''} ${(el.parentElement && el.parentElement.innerText) || ''}`;
        return /交卷|提交|离开|退出|结束考试/.test(ctx);
    }

    function watchSubmit() {
        document.addEventListener('click', e => {
            if (!isSubmitConfirm(e.target)) return;
            if (TS() - lastSubmitTs < CONFIG.reparseDebounce) return;  // 连点去抖
            lastSubmitTs = TS();
            log(`检测到交卷确认，${parsedOnce ? '重新' : '开始'}解析结果...`);
            setTimeout(parseResult, CONFIG.parseStartDelay);
        });
    }

    /** 释放成绩解析锁：正常结束 / 放弃重试 / 异常 / 看门狗超时都走这里（B3） */
    function releaseParse() {
        parseRunning = false;
        if (parseTimer) { clearTimeout(parseTimer); parseTimer = null; }
        if (parseWatchdog) { clearTimeout(parseWatchdog); parseWatchdog = null; }
    }

    function parseResult() {
        if (parseRunning) return;
        parseRunning = true;
        // 看门狗：任何分支意外卡住（异常、页面跳转、bfcache 恢复）都要在 15 秒内释放解析锁，
        // 否则「解析成绩」按钮会静默失效到刷新页面（B3）
        if (parseWatchdog) clearTimeout(parseWatchdog);
        parseWatchdog = setTimeout(() => {
            parseWatchdog = null;
            if (!parseRunning) return;
            log('⚠️ 成绩解析超过 15 秒未完成，已自动释放解析锁（可再点「解析成绩」重试）');
            releaseParse();
        }, CONFIG.parseWatchdogMs);
        log('正在解析考试结果...');
        let attempt = 0;
        const tryParse = () => {
            let scheduled = false;      // true = 已安排下一次重试，锁要保留到那时
            try {
                const t0 = TS();
                // 1) 便宜判断：只取正文/分数。不是成绩页就别做昂贵扫描（图例色 + 整页逐格判定）。
                const light = resultPageInfo();
                if (!lightLooksLikeResult(light) && !light.hasCard) {
                    if (attempt++ < CONFIG.parseMaxRetry) { parseTimer = setTimeout(tryParse, CONFIG.parseRetryInterval); scheduled = true; return; }
                    log('⚠️ 当前页面不像成绩页，本次不解析（成绩页出来后点面板「解析成绩」可再试）');
                    return;
                }
                // 2) 可能是成绩页 → 做一次完整快照，结果页判定与入库都复用它
                const snap = resultSnapshot(light.roots, light);
                const verdicts = snap.verdicts;
                // 先确认真的停在成绩页：watchSubmit 触发解析时可能还在考试页或成绩页未加载完，
                // 旧实现会对着考试页空转重试，白等十几秒还可能在考试页误判。
                if (!isResultPageFrom(snap.body, snap.score, verdicts)) {
                    if (attempt++ < CONFIG.parseMaxRetry) { parseTimer = setTimeout(tryParse, CONFIG.parseRetryInterval); scheduled = true; return; }
                    log('⚠️ 当前页面不像成绩页，本次不解析（成绩页出来后点面板「解析成绩」可再试）');
                    return;
                }
                markPendingSubmitted();      // 已经确认停在成绩页 → 这场一定交过了，给残留会话打标
                const nums = Object.keys(verdicts);
                if (!nums.length) {
                    if (attempt++ < CONFIG.parseMaxRetry) { parseTimer = setTimeout(tryParse, CONFIG.parseRetryInterval); scheduled = true; return; }
                    if (CONFIG.debug) dbg(`解析重试 ${attempt} 次仍无判定，最后一次快照用时 ${TS() - t0}ms`);
                    const diag = resultDiag(snap.roots, snap.legend);
                    log('⚠️ 答题卡上没识别到任何对错标记，本次不入库');
                    if (diag.opens.length) {
                        log(`👉 页面上有「${diag.opens[0]}」入口：点开它，脚本会自动再解析一次`);
                        watchResultOpen();
                    }
                    log('👉 确认已停在结果页后，点面板「解析成绩」可再试一次；仍失败可开「调试」后 Alt+E 导出日志反馈');
                    return;
                }
                parsedOnce = true;
                if (CONFIG.debug) dbg(`成绩页解析成功，用时 ${TS() - t0}ms（${nums.length} 个题号）`);
                reportResult(verdicts, snap.score);
            } catch (e) {
                log(`❌ 成绩解析异常：${(e && e.message) || e}（已释放解析锁，可点「解析成绩」重试）`);
                if (CONFIG.debug) dbg(`堆栈：${String((e && e.stack) || '').split('\n').slice(0, 3).join(' | ')}`);
                notify('成绩解析异常，已释放解析锁，可点面板「解析成绩」重试', 'warn');
            } finally {
                // 只有「已经排了重试」才保留锁；成功 / 放弃 / 异常一律在 finally 释放（B3）
                if (!scheduled) releaseParse();
            }
        };
        parseTimer = setTimeout(tryParse, CONFIG.parseFirstDelay);
    }

    /** 输出明细、分数、正确率，并按判定对账入库 */
    /**
     * 成绩对账规划（纯函数）：把「答题卡判定 verdicts」对应到「本场作答记录 recs」上。
     * 之前这套映射逻辑混在 reportResult 里，既没法单测，改一处也容易牵动写库细节。
     * 返回：
     *   { nums, good, bad, blank, coverTotal, coverage, absentAsWrong,
     *     numberMapOk, positionalOk, numsContiguous,
     *     items:[{ rec, no, skip:'incomplete'|'unmapped'|'unknown'|null, verdict, absentWrong }],
     *     absentWrong, unknown, unmapped, skipped }
     * 只做判定与计数，不写题库——写库仍由 reportResult 按 items 执行。
     */
    /**
     * 成绩对账的纯决策函数（不碰 DOM、不写库，便于自检）：
     * 输入答题卡判定 verdicts={题号:'correct'|'wrong'|'unanswered'} 与本地作答记录 recs，
     * 输出每条记录该怎么处理（items[].skip / items[].verdict）以及跳过/兜底统计。
     */
    function planResultActions(verdicts, recs, opt) {
        opt = opt || {};
        const v = verdicts || {};
        const list = recs || [];
        const nums = Object.keys(v).map(Number).filter(n => n > 0).sort((a, b) => a - b);
        const good = nums.filter(n => v[n] === 'correct');
        const bad = nums.filter(n => v[n] === 'wrong');
        const blank = nums.filter(n => v[n] === 'unanswered');
        // 两条前置条件：① 答题卡识别到的题号要覆盖卷面大部分，否则「识别漏了一批」会被当成「这一批都答错」；
        // ② 识别到的题数不能少于本地记录数，答题卡只标对、不标错时未标对的才能按答错兜底。
        const coverTotal = Math.max(+opt.totalQ || 0, +opt.paper || 0, +opt.historyLen || 0, list.length);
        const coverage = coverTotal ? nums.length / coverTotal : 0;
        const numsContiguous = nums.length > 0 && nums.every((n, i) => n === i + 1);
        const absentAsWrong = bad.length === 0 && blank.length === 0 && nums.length >= 3
            && nums.length >= list.length
            && (!coverTotal || coverage >= CONFIG.absentAsWrongCoverage);
        // 逐条按题号：要求每条记录都有题号且互不相同——防止「题号全是 5」这类解析故障把所有题对到同一格；
        // 按顺序：两边条数必须一致，且答题卡题号要从 1 开始连续，否则一旦跳题整卷错位。
        const qnums = list.map(r => r && r.qNum);
        const allNumbered = qnums.length > 0 && qnums.every(n => n > 0);
        const distinctNums = new Set(qnums).size === qnums.length;
        const numberMapOk = allNumbered && distinctNums;
        const positionalOk = numsContiguous && nums.length === list.length;
        const items = [];
        let skipped = 0, unknown = 0, unmapped = 0, absentWrong = 0;
        list.forEach((rec, i) => {
            const no = (rec && rec.qNum) || i + 1;
            // 记录完整性校验，不完整的直接跳过，避免污染题库
            if (!rec || !rec.stem || !rec.letters || !(rec.pickedText || []).length) {
                skipped++;
                items.push({ rec, no, skip: 'incomplete' });
                return;
            }
            let verdict, mapped = false;
            if (numberMapOk) { verdict = v[rec.qNum]; mapped = true; }
            else if (positionalOk) { verdict = v[i + 1]; mapped = true; }
            // 映射不上的记录只跳过它自己（旧实现是整卷不写库，等于永久丢数据）
            if (!mapped) { unmapped++; items.push({ rec, no, skip: 'unmapped' }); return; }
            if (!verdict && absentAsWrong) { verdict = 'wrong'; absentWrong++; }
            if (!verdict || verdict === 'unanswered') {
                // 没识别出来的不猜：宁可不入库，也不要把答对的记成答错
                unknown++;
                items.push({ rec, no, skip: 'unknown', verdict });
                return;
            }
            items.push({ rec, no, skip: null, verdict });
        });
        return {
            nums, good, bad, blank, coverTotal, coverage,
            absentAsWrong, numberMapOk, positionalOk, numsContiguous,
            items, skipped, unknown, unmapped, absentWrong,
        };
    }

    function reportResult(verdicts, scoreInfo) {
        const nums = Object.keys(verdicts || {}).map(Number).filter(n => n > 0).sort((a, b) => a - b);
        const good = nums.filter(n => verdicts[n] === 'correct');
        const bad = nums.filter(n => verdicts[n] === 'wrong');
        const blank = nums.filter(n => verdicts[n] === 'unanswered');
        const { score, total: paper } = scoreInfo || readScore();

        // 逐题明细
        log(`📋 答题卡识别到 ${nums.length} 个题号：${nums.join(', ')}`);
        log(`📋 逐题明细：${nums.map(n => `${n}${verdicts[n] === 'correct' ? '✅' : verdicts[n] === 'wrong' ? '❌' : '⬜'}`).join(' ')}`);
        log(`✅ 答对 ${good.length} 题${good.length ? '：' + good.join(', ') : ''}`);
        if (bad.length) log(`❌ 答错 ${bad.length} 题：${bad.join(', ')}`);
        if (blank.length) log(`⬜ 未答 ${blank.length} 题：${blank.join(', ')}`);

        // 分数 / 正确率 / 交叉校验
        const rate = nums.length ? Math.round(good.length / nums.length * 100) : 0;
        log(score === null
            ? `🎯 正确率 ${rate}%（${good.length}/${nums.length}）`
            : `🎯 分数 ${score}${paper ? ' / ' + paper : ''} 分 · 正确率 ${rate}%（${good.length}/${nums.length}）`);
        if (score !== null && paper && nums.length) {
            const expect = Math.round(score / paper * nums.length);
            if (Math.abs(expect - good.length) > Math.max(1, Math.round(nums.length * 0.1))) {
                log(`⚠️ 分数与答题卡对不上：按分数推算约 ${expect} 题对，答题卡识别到 ${good.length} 题，请人工核对`);
            }
        }

        // 同一份成绩页可能被重复解析（手动点「解析成绩」/点「查看答题卡」再触发一次）：
        // 旧实现每次都再 saveCorrect 一遍，题库 ok/hit 被二次灌水（B1）。幂等键完全相同 → 只展示不写库。
        const rcKey = reconcileKey(verdicts, { score, total: paper }, { historyLen: history.length, history });
        let lastRcKey = '';
        try { lastRcKey = String(GM_getValue('lastReconcileKey', '') || ''); } catch { }
        if (rcKey && lastRcKey && rcKey === lastRcKey) {
            log('ℹ️ 本次成绩与上次对账完全相同：只重新展示结果，不重复写库（避免题库 ok/hit 被二次灌水）');
            log(`📊 题库现有 ${Object.keys(ensureBank()).length} 题`);
            updateStats();
            updateStatus('✅ 成绩已重新解析（与上次一致，未重复入库）');
            scheduleAutoClose();
            return;
        }

        // 同一题若留下多条记录（脚本一条 + 手改一条），顺序对账会整体错位：
        // 这里按归一化题干去重，重复时保留较新的那条（即用户手改后的状态）
        const recs = [];
        const recIdx = new Map();
        for (const r of history) {
            const k = r && r.stem ? normStem(r.stem) : '';
            if (k && recIdx.has(k)) recs[recIdx.get(k)] = r;
            else { if (k) recIdx.set(k, recs.length); recs.push(r); }
        }
        if (recs.length !== history.length) {
            log(`ℹ️ 本次记录里有 ${history.length - recs.length} 条重复题，已按题干归并后再对账`);
        }

        // 对账决策全部交给纯函数 planResultActions（可单测）：题号映射 / 顺序映射 / 未标对兜底 / 跳过统计
        const plan = planResultActions(verdicts, recs, { totalQ, paper, historyLen: history.length });
        if (plan.absentAsWrong) log('ℹ️ 答题卡上只有答对标记，未标对的按答错处理');
        else if (plan.bad.length === 0 && plan.blank.length === 0 && plan.nums.length >= 3) {
            log(`⚠️ 只识别到 ${plan.nums.length} 题 / 本地 ${recs.length} 条（覆盖率 ${Math.round(plan.coverage * 100)}%），不敢按「未标对=答错」处理，本次不入库`);
        }
        if (recs.length && !plan.numberMapOk) {
            log(plan.positionalOk
                ? '题号不可靠，改用答题顺序对账'
                : `⚠️ 题号不可靠（本地记录 ${recs.length} 条 / 答题卡识别 ${plan.nums.length} 题），无法按题号或顺序安全对应，只对能对上的作数`);
            if (!plan.positionalOk) notify(`有 ${recs.length} 条记录无法安全对应答题卡，这部分不会入库`, 'warn');
        }

        let saved = 0, wrong = 0, conflict = 0, edited = 0, correctN = 0;
        const absentWrong = plan.absentWrong, unknown = plan.unknown, skipped = plan.skipped, unmapped = plan.unmapped;
        for (const item of plan.items) {
            const rec = item.rec;
            const no = item.no;
            if (item.skip === 'incomplete') { log(`⚠️ 第${no}题记录不完整，已跳过（不入库）`); continue; }
            if (item.skip === 'unmapped') { log(`❔ 第${no}题无法安全对应到答题卡（题号不可靠且条数不一致），本次不判定也不入库`); continue; }
            if (item.skip === 'unknown') { log(`❔ 第${no}题答题卡上没有明确对错标记，本次不判定（不入库）`); continue; }
            const texts = (rec.pickedText || []).filter(Boolean);
            // 来源：用户手动作答/手改过的答案记 by='user'
            const by = (rec.by === 'user' || rec.userEdited) ? 'user' : 'auto';
            if (item.verdict === 'correct') {
                correctN++;
                // saveCorrect 直接报冲突（2），不再比较 cft 前后值——题库归并到别的键时会漏计
                const sv = saveCorrect(rec.stem, rec.letters, texts, rec.type, by);
                if (sv) saved++;
                if (sv === 2) conflict++;
                if (rec.userEdited) edited++;
                if (by === 'user') log(`✅ 第${no}题您手动作答/改过的答案答对了，已按用户答案入库：${rec.letters}`);
            } else {
                // 答错对账：先按作答时记录的 bankKey 找库内条目（模糊命中时它是 fpKey(e.q)，旧实现
                // 只查规范键和前 50 字键，这类错答案一直删不掉、bad 也不涨，A1）；键失效时回退到
                // 规范键 / 旧键 / 前缀等价的唯一同题（双闸），都靠纯函数定位，可单测。
                const nb = ensureBank();
                const found = locateBankEntryForWrong(rec, nb);
                const e = found.e;
                if (bankAnswerIsWrongPick(rec, e)) {
                    // 删除必须登记墓碑，否则下一次 flush 会把盘上的旧副本原样搬回来；
                    // 顺手清掉同一题的规范键/旧键副本（题库升级/导入可能留下多个键），
                    // 但每个副本都要再过一次「答案一致」闸门，避免误删别的题。
                    delete nb[found.key]; pendingDeletes.add(found.key); addTombstone('bank', found.key);
                    const extra = [fpKey(rec.stem), pureStem(rec.stem).slice(0, 50)];
                    for (const k of extra) {
                        if (k && k !== found.key && nb[k] && bankAnswerIsWrongPick(rec, nb[k])) {
                            delete nb[k]; pendingDeletes.add(k); addTombstone('bank', k);
                        }
                    }
                    dirty = true; bankVer++;
                    log(`${by === 'user' ? '（您手动作答的）' : ''}第${no}题答错，已删除库里记错的答案：${rec.letters}${found.keyFrom === 'history' ? '（按作答时的库键定位）' : ''}`);
                } else if (e) {
                    e.bad = (e.bad || 0) + 1;            // 答案对不上：只记一次答错，不删库
                    dirty = true;
                } else if (rec.bankKey) {
                    dirty = true; bankVer++;             // 作答题库命中过，现在一条都对不上：至少把缓存标记为脏
                }
                if (rec.type === 'multi') {
                    // 多选记录「已失败的组合」，而不是把组内每个选项都当成错选项
                    const key = texts.map(t => t.replace(/\s+/g, '')).sort().join('+');
                    if (saveTried(rec.stem, key)) {
                        wrong++;
                        log(`第${no}题多选失败${by === 'user' ? '（您手动作答/改过）' : ''}，记为失败组合：${key}`);
                    }
                } else if (texts.length && saveWrong(rec.stem, texts)) {
                    wrong++;
                }
            }
        }

        try { GM_setValue('lastReconcileKey', rcKey); } catch { }   // 记下本次对账键：同一份成绩页再解析时只展示不写库（B1）
        flushBank();
        GM_setValue('pendingSession', null);
        log(`✅ 判定答对 ${correctN} 题（其中 ${saved} 题写入/修正了库内答案），记录 ${wrong} 道错误题${absentWrong ? `（含 ${absentWrong} 题按「未标对=答错」兜底）` : ''}${conflict ? `，${conflict} 道答案冲突` : ''}${edited ? `，其中 ${edited} 道是您手动改对的` : ''}`);
        log(`📋 本次作答 ${answered} 题，完整记录 ${recs.length - skipped} 条${skipped ? `，跳过 ${skipped} 条不完整记录` : ''}${unknown ? `，${unknown} 条未识别未入库` : ''}${unmapped ? `，${unmapped} 条无法安全对账未入库` : ''}`);
        const total = Object.keys(ensureBank()).length;
        log(`📊 题库现有 ${total} 题`);
        updateStats();
        updateStatus(saved > 0 ? '✅ 题库已更新，可以关闭页面' : '✅ 成绩解析完成（本次没有需要写入的新答案）');
        scheduleAutoClose();
    }

    /**
     * 成绩解析/入库流程走完后，按设置延时关闭本页。
     * 浏览器只允许脚本关闭「自己打开的」标签页；考试页通常是用户自己点开的，
     * window.close() 可能被拒绝——这时只提示手动关闭，不反复尝试。
     */
    let autoCloseTimer = null, autoCloseTick = null, autoCloseLeft = 0;

    /** 取消「关闭页」倒计时（用户点按钮取消，或重新设置档位时调用） */
    function cancelAutoClose(reason) {
        if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
        if (autoCloseTick) { clearInterval(autoCloseTick); autoCloseTick = null; }
        const had = autoCloseLeft > 0;
        autoCloseLeft = 0;
        updateAutoCloseBtn();
        if (had) log(`🛑 已取消自动关闭${reason ? `（${reason}）` : ''}，本页保持打开`);
    }

    function scheduleAutoClose() {
        const sec = +CONFIG.autoCloseSec || 0;
        if (!sec) return;
        if (autoCloseTimer) clearTimeout(autoCloseTimer);
        if (autoCloseTick) clearInterval(autoCloseTick);
        autoCloseLeft = sec;
        updateAutoCloseBtn();
        log(`🕒 ${sec} 秒后自动关闭本页；倒计时期间点「关闭页」按钮可取消`);
        autoCloseTick = setInterval(() => {
            autoCloseLeft = Math.max(0, autoCloseLeft - 1);
            updateAutoCloseBtn();
        }, 1000);
        autoCloseTimer = setTimeout(() => {
            autoCloseTimer = null;
            if (autoCloseTick) { clearInterval(autoCloseTick); autoCloseTick = null; }
            autoCloseLeft = 0;
            try { window.close(); } catch { }
            // 关成功时页面已卸载，下面的定时器不会执行；只有「浏览器拒绝关闭」才会走到这里。
            // 这里只提示手动关闭（B2）：旧实现会 history.back() / location.replace('about:blank')，
            // 但脚本作用域里的 history 是本场作答记录数组（不是 window.history），调用必然抛错；
            // 而退回上一页可能落在已交卷的考试页上。成绩已入库，本页直接手动关闭即可。
            setTimeout(() => {
                if (document.hidden) return;
                log('⚠️ 浏览器不允许脚本自动关闭这个标签页，请手动关闭（成绩已解析入库，本页可安全关闭）');
            }, 900);
        }, sec * 1000);
    }

    // ==================== 考试流程控制 ====================
    const FAIL_TEXT = {
        'no-stem': '题干未渲染出来',
        'no-options': '选项未渲染出来',
        'invalid-answer': '算不出有效答案',
        'click-failed': '点击选项没生效',
        'no-text': '选中项没有文本',
        unknown: '未知原因',
    };

    /** 退出原因 → 状态栏文案（异常停止不再被显示成「答题完成」） */
    function stopReasonText(r) {
        if (!r) return '未知原因';
        if (r === 'done') return '答题完成';
        if (r === 'timeup') return '考试时间已到';
        if (r === 'backward') return '连续回退';
        if (r === 'switch-fail') return '连续切题失败';
        if (r === 'crash') return '连续异常';
        if (r === 'restored') return '疑似上一场残留记录，待你核对（可「清空本场」或「继续」）';
        if (String(r).startsWith('fail:')) return `连续${FAIL_TEXT[String(r).slice(5)] || '作答失败'}`;
        return String(r);
    }

    /**
     * 可中断的等待：暂停或停止时立刻让出
     * 暂停期间「顺延」截止时间——以前暂停只多睡 120ms、墙钟照走，
     * 到点仍返回成功，于是面板显示「已暂停」时脚本还会去点选项、切题。
     */
    async function pauseAwareSleep(ms) {
        let end = Date.now() + ms;
        while (Date.now() < end) {
            if (!running) return false;
            if (paused) {
                const t0 = Date.now();
                await sleep(120);
                end += Date.now() - t0;      // 暂停多久就往后顺延多久
                continue;
            }
            await sleep(Math.min(150, Math.max(0, end - Date.now())));
        }
        return running;
    }

    /**
     * 剩余时间（秒）；读不到返回 null
     * 优先读「明确写着剩余/倒计时」的计时器元素（便宜、不用重排）；
     * 光有 class/id 含 timer 的元素不算数——页面上「用时 00:05」这类秒表会被当成剩余时间，
     * 一旦读到 00:00 就会立刻判定「考试时间已到」把答题停掉。
     */
    let remainCache = { t: 0, txt: '' };
    function bodyTextCached() {
        const now = TS();
        if (now - remainCache.t > 500) {
            remainCache = { t: now, txt: (document.body && document.body.innerText) || '' };
        }
        return remainCache.txt;
    }
    function getRemainSec() {
        const el = pick(SEL.timer);
        if (el && isVisible(el)) {
            const t = elText(el);
            const ctx = `${t} ${elText(el.parentElement)} ${el.className || ''} ${el.id || ''}`;
            if (/剩余|倒计时|remain/i.test(ctx)) {
                const m = t.match(/(\d{1,3})\s*[:：]\s*(\d{1,2})(?:\s*[:：]\s*(\d{1,2}))?/);
                if (m) return m[3] === undefined ? (+m[1]) * 60 + (+m[2]) : (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]);
            }
        }
        const m = bodyTextCached().match(/剩余时间\s*[:：]?\s*(\d{1,3})\s*[:：]\s*(\d{1,2})(?:\s*[:：]\s*(\d{1,2}))?/);
        if (!m) return null;
        const a = +m[1], b = +m[2];
        return m[3] === undefined ? a * 60 + b : a * 3600 + b * 60 + (+m[3]);
    }
    const fmtSec = s => `${Math.floor(s / 60)} 分 ${s % 60} 秒`;

    /** 考试末尾自动提速前的用户档位，考试结束/停止时恢复；rushDisabled = 用户已手动接管节奏 */
    let rushSpeedSaved = '', rushDisabled = false;
    function restoreRushSpeed() {
        if (rushDisabled || !rushSpeedSaved) { rushSpeedSaved = ''; return; }
        CONFIG.speed = rushSpeedSaved;
        rushSpeedSaved = '';
        syncRunBtns();
        log(`⏱️ 已恢复您选择的节奏档位：${SPEED_NAME[CONFIG.speed] || '标准'}`);
    }

    /**
     * 倒计时检查
     * 时间紧就自动提速，时间到就停下，中途定期提醒。
     * 返回 true 表示本轮该跳过（已经停下）。
     */
    function checkTime() {
        const left = getRemainSec();
        if (left === null) return false;
        remainSec = left;
        if (left <= 0 && !timeUp) {
            timeUp = true;
            log('⏰ 考试时间已到，停止自动答题');
            running = false;
            return true;
        }
        if (!rushDisabled && left <= CONFIG.timeRushSec && CONFIG.speed !== 'fast') {
            // 只在本场内存里提速，不再写 GM 存储——否则下一场考试一开跑就是快速档，
            // 用户手动切回慢速也会被立刻改回。
            if (!rushSpeedSaved) rushSpeedSaved = CONFIG.speed;
            CONFIG.speed = 'fast';
            syncRunBtns();
            log(`⏰ 剩余 ${fmtSec(left)}，本场已自动切到快速节奏（考试结束后恢复原档位）`);
        }
        if (left <= CONFIG.timeWarnSec && TS() - lastTimeWarn > 30000) {
            lastTimeWarn = TS();
            log(`⏰ 剩余时间仅 ${fmtSec(left)}，已答 ${history.length} 题，请抓紧`);
        }
        return false;
    }

    /**
     * 处理会拦路的页面弹窗
     * 只点「继续答题 / 取消 / 关闭」这类安全按钮（「返回/离开/退出」可能跳走，绝不自动点）；
     * 没有安全按钮又涉及交卷的，一律不自作主张，停下来交给用户。
     * 返回 true 表示这轮拦到了弹窗。
     */
    let dialogDismissCount = 0, lastDialogText = '';

    function handleDialogs() {
        // 改用 isVisible()——offsetParent 对 position:fixed 的元素返回 null，
        // layui-layer / el-dialog / ant-modal 这类弹窗基本都是 fixed，以前会被整片漏掉。
        const dlg = [...document.querySelectorAll(SEL.dialog)]
            .filter(el => isVisible(el) && (el.innerText || '').trim());
        if (!dlg.length) { dialogDismissCount = 0; lastDialogText = ''; return false; }
        const full = dlg.map(el => el.innerText).join(' ').replace(/\s+/g, ' ');
        const text = full.slice(0, 60);
        // 先判风险：交卷/提交类弹窗里一个按钮都不自动点。
        // 旧实现先找「安全按钮」（含「取消」）并在 risky 判断之前就返回，
        // 于是「确定要交卷吗？[取消][确定]」会被点「取消」——看起来就像脚本擅自取消交卷。
        // 这里用全文判风险，不被 60 字截断；「提交成功」这类结果提示不算风险。
        const risky = CONFIG.dialogSubmitWords.some(w => full.includes(w))
            && !/成功|已完成|已提交|已交卷/.test(full);
        if (risky) {
            log(`⛔ 检测到交卷相关弹窗「${text}」，已暂停，请你亲自确认后再点「继续」`);
            notify('有交卷相关弹窗，已暂停等你确认', 'warn');
            paused = true;
            syncRunBtns();
            updateStatus('⚠️ 有弹窗待你确认');
            return true;
        }
        for (const el of dlg) {
            const btns = [...el.querySelectorAll('a, button, input[type="button"], input[type="submit"], [role="button"]')]
                .filter(b => isVisible(b) && !b.disabled);
            const safe = btns.find(b => {
                const t = elText(b);
                if (!t) return false;
                if (CONFIG.dialogNeverAuto.some(w => t === w || t.includes(w))) return false;
                return CONFIG.dialogSafeDismiss.some(w => t === w || t.includes(w));
            });
            if (safe) {
                // 同一个弹窗反复关不掉就交给人处理。
                // 以前是无条件每 retryDelay(2 秒) 点一次，而这条 continue 排在 checkTime() 之前，
                // 于是倒计时到点也不会停、答题零进展。
                if (text === lastDialogText) dialogDismissCount++;
                else { lastDialogText = text; dialogDismissCount = 1; }
                if (dialogDismissCount > CONFIG.maxDialogDismiss) {
                    log(`⛔ 弹窗「${text}」连点 ${dialogDismissCount - 1} 次仍未关闭，已暂停，请你手动处理`);
                    notify('弹窗反复关不掉，已暂停自动答题', 'error');
                    paused = true;
                    syncRunBtns();
                    updateStatus('⚠️ 弹窗反复出现，已暂停');
                    return true;
                }
                log(`🪟 关闭弹窗「${text}」（第 ${dialogDismissCount} 次）`);
                autoClick(safe);
                return true;
            }
        }
        // 有弹窗、不涉及交卷、又没有可安全关闭的按钮（公告/人机验证等）：交给人处理。
        // 只在文本变化时记一次，别每轮刷屏；同一个弹窗拖太久才暂停。
        if (text === lastDialogText) dialogDismissCount++;
        else { lastDialogText = text; dialogDismissCount = 1; }
        if (dialogDismissCount === 1) log(`ℹ️ 有弹窗「${text}」但没有可安全关闭的按钮，先等你手动处理`);
        if (dialogDismissCount > CONFIG.maxDialogDismiss) {
            log(`⛔ 弹窗「${text}」持续 ${dialogDismissCount} 轮未消失，已暂停，请你手动处理`);
            notify('有弹窗需要你手动处理，已暂停', 'warn');
            paused = true;
            syncRunBtns();
            updateStatus('⚠️ 有弹窗需要你处理');
        }
        return true;
    }

    /** 最后一题：没有「下一题」但有「交卷」 */
    function isLastQuestion() {
        if (findButton(BTN.next.labels, BTN.next.exclude)) { sawNextBtn = true; return false; }
        if (!sawNextBtn) return false;
        if (!findButton(BTN.submit.labels, BTN.submit.exclude)) return false;
        // （真机）这个平台**每道题顶部都有「交卷」**，所以「没有下一题」不足以判定最后一题。
        // 题号与总题数都能拿到时，要求题号确实到了最后一题，避免切题瞬间误判成最后一题而提前收工/提前交卷。
        const q = getQNum();
        if (q && totalQ) return q >= totalQ;
        return true;
    }

    /** 当前这道题是否已经作答过（续答 / 回退时避免重复作答） */
    function alreadyAnswered() {
        const stem = getStem();
        if (!stem) return false;
        const nq = normStem(stem);
        // 只有「记录里确实有答案」才算答过：你如果手动把选项全部取消，这题应该回到可作答状态
        return history.some(r => r.letters && normStem(r.stem) === nq);
    }

    /**
     * 最后一题的处理
     * 默认不自动交卷——你之前明确要求由自己点交卷（怕自动交卷把你改过的答案也交上去）。
     * 需要自动交卷时把 CONFIG.autoSubmit 设为 true 即可。
     */
    async function finishExam() {
        const n = history.length;
        // 恢复的记录可能来自另一场：这种情况下绝不自动交卷，免得「少答几题就交上去」
        if (CONFIG.autoSubmit && restoredUnsure) {
            log(`⚠️ 本场恢复了来源不确定的历史记录（${history.length} 条），为避免少答就交卷，已跳过自动交卷`);
            notify('本场历史记录来源不确定，已跳过自动交卷，请核对答题卡后手动交卷', 'warn');
            updateStatus(`⚠️ 已跳过自动交卷，共答 ${n} 题，请核对后手动交卷`);
            return;
        }
        if (!CONFIG.autoSubmit) {
            updateStatus(`✅ 答题完成，共答 ${n} 题，请自行点击交卷`);
            log(`✅ 答题完成！共答 ${n} 题，请检查后点击交卷`);
            notify(`答题完成，共答 ${n} 题，请自行点击交卷`, 'info');
            return;
        }
        const btn = findButton(BTN.submit.labels, BTN.submit.exclude);
        if (!btn) { log('未找到交卷按钮，请手动交卷'); return; }
        log('⏳ 已开启自动交卷，点击交卷…');
        autoClick(btn);
        // 等确认弹窗出现：用可被「停止」打断的等待，别用裸 sleep——
        // 点完交卷后用户按了停止，脚本不该继续替他确认交卷。
        if (!await pauseAwareSleep(CONFIG.switchSettleDelay * 4)) {
            log('已停止，跳过自动交卷确认');
            return;
        }
        // 只在交卷相关弹窗里找确认按钮，避免误点页面上的其他「确定 / 确认」
        const dlg = [...document.querySelectorAll(SEL.dialog)]
            .filter(el => isVisible(el) && (el.innerText || '').trim());
        const dlgBtns = dlg.flatMap(el => [...el.querySelectorAll(SEL.clickable)])
            .filter(b => isVisible(b) && !b.disabled);
        const confirm = dlgBtns.find(b => {
            const t = elText(b);
            return !!t && BTN.confirm.labels.some(lb => t === lb || t.includes(lb))
                && !CONFIG.dialogNeverAuto.some(w => t.includes(w));
        }) || (!dlg.length ? findButton(BTN.confirm.labels, BTN.confirm.exclude) : null);
        if (confirm) { autoClick(confirm); autoSubmitted = true; log('✅ 已点击确认交卷'); }
        else if (dlg.length) {
            log(`⛔ 交卷弹窗里没找到确认按钮「${elText(dlg[dlg.length - 1])?.slice(0, 40) || ''}」，已在面板暂停，请你手动确认`);
            notify('自动交卷没找到确认按钮，已在面板暂停，请手动确认', 'warn');
            paused = true;
            syncRunBtns();
            updateStatus('⚠️ 交卷确认待你手动点击');
        }
        else log('未找到确认按钮，请手动确认交卷');
    }

    async function mainLoop() {
        if (running) return;
        running = true; paused = false; timeUp = false;
        updateStatus(runStatusLabel(running, paused));   // 一开始就写清楚，别让状态栏停在「就绪」
        rushSpeedSaved = ''; rushDisabled = false;      // 每场重新判断自动提速
        answered = history.length;          // 续答时接着已有记录算，不重复计数
        // 新卷识别（B5）：交卷后（submittedMark=true）若又在同一页面开了新一场，旧记录会被当成
        // 「本场已答」，把新卷拖进「已答满」误判。当前题目不在上一场记录里就判为新试卷并清场。
        if (history.length && submittedMark) {
            const curStem = (getStem() || '').trim();
            const samePaper = !!curStem && history.some(r => r && r.stem
                && (fpKey(r.stem) === fpKey(curStem) || prefixSame(r.stem, curStem)));
            if (curStem && !samePaper) {
                log('🧹 检测到新试卷（当前题目不在上一场的作答记录里），已丢弃上一场记录');
                clearSession('检测到新试卷');
            }
        }
        claimActiveTab();                   // 同场双页检测：另一页也在答时提醒（心跳 15 秒）
        preflight();
        sawNextBtn = false;                 // 每场重置：上一场见过「下一题」不代表本场也有
        autoSubmitted = false;
        let noChange = 0, backwardStreak = 0, lastQ = 0;
        let runAnswered = 0;                // 本次点「开始」之后真正答了几题（用于识破残留记录）
        let staleConfirmed = false;         // 用户已点过「继续」确认沿用恢复记录：别再反复按残留记录暂停
        let stopReason = '';                // 退出原因：只有正常答完才显示「答题完成」
        const failCount = {};
        let total = getTotalQExact();       // 0 = 推断不出；此时不能用「已答 N 题」收工（旧实现的兜底 10 会少答一半就交卷）
        totalQ = total;
        log(`总题数: ${total || '未识别'}${history.length ? `（另有 ${history.length} 条已恢复的记录）` : ''}，节奏：${SPEED_NAME[CONFIG.speed] || '标准'}`);
        dbg(`首题签名：${questionSignature().slice(0, 80)}`);
        const left0 = getRemainSec();
        if (left0 !== null) log(`⏰ 剩余时间 ${fmtSec(left0)}`);
        syncRunBtns();

        let crash = 0;
        while (running) {
          try {   // 单题内的任何异常都在这里兜住，不让整场答题中断
            if (paused) { await sleep(200); continue; }

            // 倒计时先判（以前 handleDialogs 的 continue 排在它前面，
            // 弹窗反复关不掉时会一直跳过倒计时检查，时间到也不停）
            if (checkTime()) { stopReason = 'timeup'; break; }
            // 弹窗拦截
            if (handleDialogs()) { await pauseAwareSleep(CONFIG.retryDelay); continue; }
            // 已经答满（只在总题数确定时判；0 表示推断不出，交给最后一题/切题逻辑收工）
            if (total > 0 && history.length >= total) {
                // ① 本次一条都没答就「已答满」，且记录来自 restoreSession → 多半是上一场残留。
                //    不再静默 clearSession（旧实现会直接丢弃并重新开始，用户的答题记录就没了），
                //    先暂停让用户核对：是上一场就点「清空本场」，是本场就点「继续」。
                if (runAnswered === 0 && history.length > 0 && sessionRestored) {
                    // 恢复的记录数已经「答满」本场，而本次一题没答：基本只能是上一场残留。
                    // 若本次进入地址与上次也不同（新一场），直接清掉继续答，不再打断用户；
                    // 地址相同则暂停一次让用户核对，用户点「继续」就当作本场记录，不再反复暂停。
                    // 拿当前题的题干和恢复记录比一下：命中就当同一场（不丢记录，暂停一次让用户核对）；
                    // 明显对不上、且进入地址与上次不同，才判定为上一场残留并自动清掉——
                    // 这样新一场不会被旧记录卡住，也不会把「刷新后重进同一场」的记录误删。
                    const curStem = (getStem() || '').trim();
                    const samePaper = !!curStem && history.some(r => r && r.stem
                        && (fpKey(r.stem) === fpKey(curStem) || prefixSame(r.stem, curStem)));
                    if (!samePaper) {
                        log(`🧹 恢复的 ${history.length} 条记录与当前题目对不上，判定为上一场残留，已自动清空并继续答题`);
                        clearSession('上一场残留 · 自动清理');
                        continue;
                    }
                    if (!staleConfirmed) {
                        staleConfirmed = true;
                        log(`⚠️ 本次一条都没答就显示「已答满」（${history.length} 条恢复记录），已暂停，请核对是否上一场残留`);
                        notify('检测到可能的上一场残留记录，已暂停：若是上一场请点「清空本场」；确认是本场记录请点「继续」', 'warn');
                        paused = true;
                        syncRunBtns();
                        updateStatus('⚠️ 疑似上一场残留记录，请核对');
                        stopReason = 'restored';
                        break;
                    }
                    log('▶️ 已确认沿用恢复记录（不再按残留记录暂停）');
                }
                // ② 重新推一次总题数，推断值变大了就继续答，不要提前收工
                const reTotal = getTotalQExact();
                if (reTotal > total) {
                    log(`📈 总题数重算为 ${reTotal}（原 ${total}），继续答题`);
                    total = reTotal; totalQ = reTotal; updateStats();
                    continue;
                }
                log(`📌 已答满 ${total} 题`);
                stopReason = 'done';
                await finishExam();
                break;
            }

            const q = getQNum();
            let skipAnswer = false;
            if (q && lastQ && q < lastQ) {
                // 题目倒退
                backwardStreak++;
                const seen = alreadyAnswered();
                log(`↩️ 检测到回退到第 ${q} 题（此前在第 ${lastQ} 题）${seen ? '，该题已作答过，跳过不重复作答' : ''}`);
                if (backwardStreak >= CONFIG.maxBackwardStreak) {
                    log(`⛔ 连续回退 ${backwardStreak} 次，停止自动答题，请检查页面`);
                    stopReason = 'backward';
                    break;
                }
                skipAnswer = seen;
            } else if (q) {
                backwardStreak = 0;
            }
            // 已作答过的题一律不再答一遍（续答、切题失败重入、手动回退都靠这条兜住）
            if (!skipAnswer && alreadyAnswered()) {
                log(`⏭️ 第 ${q || '?'} 题已作答过，跳过不重复作答`);
                skipAnswer = true;
            }

            const oldSig = questionSignature();
            if (!skipAnswer) {
                const res = await answerCurrent();
                if (!res || !res.ok) {
                    const r = (res && res.reason) || 'unknown';
                    failCount[r] = (failCount[r] || 0) + 1;
                    const limit = (CONFIG.failLimits || {})[r] || CONFIG.maxAnswerFailStreak;
                    log(`⚠️ 作答失败（${FAIL_TEXT[r] || r}）第 ${failCount[r]}/${limit} 次`);
                    if (failCount[r] >= limit) {
                        log(`⛔ 同类失败已达 ${limit} 次，已停止`);
                        notify(`连续 ${limit} 次「${FAIL_TEXT[r] || r}」，已停止答题，请检查页面`, 'error');
                        stopReason = `fail:${r}`;
                        break;
                    }
                    // 同类失败越连续，退避越久
                    await pauseAwareSleep(CONFIG.retryDelay * Math.min(failCount[r], CONFIG.retryBackoffMax));
                    continue;
                }
                Object.keys(failCount).forEach(k => delete failCount[k]);   // 成功一次就清空
                runAnswered++;
            }
            if (q) lastQ = q;

            // 最后一题：答完就收工
            if (isLastQuestion()) {
                log(`📌 已是最后一题（已答 ${history.length}/${total} 题）`);
                stopReason = 'done';
                await finishExam();
                break;
            }

            // 按节奏档随机等待，模拟真人操作
            const [lo, hi] = SPEED[CONFIG.speed] || SPEED.normal;
            if (!await pauseAwareSleep(lo + Math.random() * (hi - lo))) break;

            // 切题：先等页面自己切，超时再手动点「下一题」（自适应等待）
            const waitAuto = switchWait(CONFIG.switchWaitDefaultAuto);
            dbg(`切题等待 ${waitAuto}ms（已实测 ${switchStat.n} 次，最长 ${switchStat.max}ms）`);
            if (!await waitForNew(oldSig, waitAuto)) {
                if (!running) break;      // 等待被「停止」打断（B4）：别再点「下一题」
                const nb = findButton(BTN.next.labels, BTN.next.exclude);
                if (!nb) {
                    log('未找到「下一题」按钮，可能已是最后一题');
                    stopReason = 'done';
                    await finishExam();
                    break;
                }
                await pacedOp('切题', () => nb.click());
                if (!await pauseAwareSleep(CONFIG.switchSettleDelay)) break;
                if (!await waitForNew(oldSig, switchWait(CONFIG.switchWaitDefaultManual))) {
                    if (!running) break;      // 同上：被停止打断就收工（B4）
                    log(`⚠️ 点击「下一题」后题目未变化（第 ${++noChange}/${CONFIG.maxSwitchFail} 次）`);
                    if (noChange >= CONFIG.maxSwitchFail) {
                        log('⛔ 连续切题失败，已停止');
                        stopReason = 'switch-fail';
                        break;
                    }
                    await pauseAwareSleep(CONFIG.retryDelay);
                    continue;
                }
            }
            noChange = 0;
            Object.keys(failCount).forEach(k => delete failCount[k]);   // 成功切到新题也清空失败计数
            log(`已切到第 ${getQNum() || '?'} 题`);
            updateStats();
            crash = 0;
          } catch (e) {
            crash++;
            log(`❌ 答题流程异常（第 ${crash}/${CONFIG.crashMax} 次）：${(e && e.message) || e}`);
            dbg(`堆栈：${String((e && e.stack) || '').split('\n').slice(0, 2).join(' | ')}`);
            notify(`答题流程异常：${(e && e.message) || e}`, 'error');
            if (crash >= CONFIG.crashMax) {
                log('⛔ 连续异常过多，已停止自动答题，请刷新页面重试');
                stopReason = 'crash';
                break;
            }
            await pauseAwareSleep(CONFIG.retryDelay * crash);
          }
        }

        // 先收尾再写状态栏：restoreRushSpeed() 内部会调 syncRunBtns()，
        // 而 syncRunBtns 在 running 为真时会把状态栏改回「答题中」，把结束文案冲掉
        running = false; paused = false;
        releaseActiveTab();                 // 撤掉「本页正在答题」心跳
        restoreRushSpeed();
        // 只有正常答完才显示「答题完成」；异常停止如实说明原因（倒计时到点的 running 已为 false，这里靠 stopReason 判断）
        if (stopReason === 'done') updateStatus(autoSubmitted ? '✅ 已自动点交卷，等待成绩页' : `✅ 答题完成，共答 ${history.length} 题，请自行点击交卷`);
        else if (stopReason) updateStatus(`⛔ 已停止：${stopReasonText(stopReason)}`);
        else updateStatus(runStatusLabel(running, paused));   // 与状态灯同源，不留「答题中」的残影
        syncRunBtns();
    }

    // ==================== 内置自检 ====================
    // 以前这个脚本没有任何可执行的回归测试，每次改动只能人肉看。这里把关键纯函数的断言放进脚本本身：
    // 点面板「自检」（或 Alt+T）即可运行；不依赖 Node、不联网、不读写题库数据。
    function selfTestCases() {
        const cases = [];
        const t = (name, fn) => cases.push({ name, fn });

        // ---------- 题干归一化与主键 ----------
        t('题号/题型/标点差异归一到同一主键',
            () => fpKey('4、（单选题）下列哪项属于书面形式?') === fpKey('9、(单选题)下列哪项属于书面形式？'));
        t('年份不同的两题不碰撞', () => fpKey('2023年的规定是什么') !== fpKey('2024年的规定是什么'));
        t('短题干是长题干前缀 → 视为同一题的截断版本', () => prefixSame(
            '根据安全生产法的规定，生产经营单位应当具备本法和有关法律、行政法规和国家标准或者行业标准规定的安全生产条件',
            '根据安全生产法的规定，生产经营单位应当具备本法和有关法律、行政法规和国家标准或者行业标准规定的安全生产条件，下列说法正确的是'));
        t('一字之差的两道判断题不视为同题', () => !prefixSame(
            '中华人民共和国的一切权力属于人民人民代表大会制度是我国的根本政治制度',
            '中华人民共和国的一切权力不属于人民人民代表大会制度是我国的根本政治制度'));

        // ---------- 选项文本匹配（曾经把「5年」映射到「15年」） ----------
        const o1 = [{ letter: 'A', text: '15年' }, { letter: 'B', text: '5年' }, { letter: 'C', text: '10年' }];
        t('「5年」精确命中 5年（不会先命中 15年）', () => matchOption(o1, '5年')?.letter === 'B');
        t('「书面」精确命中「书面」', () => matchOption([{ letter: 'A', text: '书面' }, { letter: 'B', text: '书面形式' }], '书面')?.letter === 'A');
        t('唯一超串才认（非等值）：记录「书面形式的规定」→ 命中「书面形式」',
            () => matchOption([{ letter: 'A', text: '书面形式' }, { letter: 'B', text: '书面' }], '书面形式的规定')?.letter === 'A');
        t('多义超串返回 null（宁可不答）',
            () => matchOption([{ letter: 'A', text: '书面形式' }, { letter: 'B', text: '书面材料' }], '书面') === null);
        t('单字包含不认', () => matchOption([{ letter: 'A', text: '罚款' }], '罚') === null);

        // ---------- 判断题抽取（曾经被「正确/是」劫持成「对」） ----------
        const jOpts = [{ letter: 'A', text: '正确' }, { letter: 'B', text: '错误' }];
        t('「正确答案：B」判为 B（旧实现判成 A）', () => extractAnswer('正确答案：B', jOpts, 'judge')?.letters === 'B');
        t('「答案是B」判为 B（旧实现判成 A）', () => extractAnswer('答案是B', jOpts, 'judge')?.letters === 'B');
        t('「该说法错误，正确答案是B」判为 B', () => extractAnswer('该说法错误，正确答案是B', jOpts, 'judge')?.letters === 'B');
        t('「该说法正确」判为 A', () => extractAnswer('该说法正确', jOpts, 'judge')?.letters === 'A');
        t('「该说法错误」判为 B', () => extractAnswer('该说法错误', jOpts, 'judge')?.letters === 'B');
        const ynOpts = [{ letter: 'A', text: '是' }, { letter: 'B', text: '否' }];
        t('「是/否」型判断题：答案是「是」→ A', () => extractAnswer('是', ynOpts, 'judge')?.letters === 'A');
        t('「答案：是」→ A', () => extractAnswer('答案：是', ynOpts, 'judge')?.letters === 'A');
        t('「否」→ B（否定式优先）', () => extractAnswer('否', ynOpts, 'judge')?.letters === 'B');
        t('「答案是B」在是/否题型下仍取字母 B', () => extractAnswer('答案是B', ynOpts, 'judge')?.letters === 'B');
        t('判断题语义分支把握度 <0.8（会触发第二源交叉验证）',
            () => (extractAnswer('该说法正确', jOpts, 'judge')?.conf || 1) < CONFIG.crossCheckBelow
                && (extractAnswer('该说法错误', jOpts, 'judge')?.conf || 1) < CONFIG.crossCheckBelow);
        t('题干回显「是否正确」时不按语义乱判（旧实现每道都判成「错误」）',
            () => extractAnswer('下列说法是否正确？各级人民政府应当加强法治宣传教育工作', jOpts, 'judge') === null);
        t('「是否正确」问句后的回答仍可采用，且 conf 会触发交叉验证', () => {
            const r = extractAnswer('下列说法是否正确？错误', jOpts, 'judge');
            return !!r && r.letters === 'B' && r.conf < CONFIG.crossCheckBelow;
        });

        // ---------- 单选 / 多选抽取与合并 ----------
        const sOpts = [{ letter: 'A', text: '书面' }, { letter: 'B', text: '口头' }, { letter: 'C', text: '音像' }, { letter: 'D', text: '公证' }];
        t('「答案是：C」→ C', () => extractAnswer('答案是：C', sOpts, 'single')?.letters === 'C');
        t('英文句子开头的单词不会被当成答案（旧实现 "The answer is B" 抽成 A）',
            () => extractAnswer('The answer is B', sOpts, 'single')?.letters === 'B');
        t('「Baidu 搜索结果…」不再把开头的 Baidu 当成选 A（仍按选项原文命中到 B）', () => {
            const r = extractAnswer('Baidu 搜索结果显示本题应选口头', sOpts, 'single');
            return !!r && r.letters === 'B' && r.why !== '裸字母';
        });
        t('中文夹字母的兜底仍能取出（「我认为C是对的」→ C）',
            () => extractAnswer('我认为C是对的', sOpts, 'single')?.letters === 'C');
        t('多选「答案：AB」→ AB', () => extractAnswer('答案：AB', sOpts, 'multi')?.letters === 'AB');
        t('多选题只给一个字母的来源作废', () => mergeCandidates([{ letters: 'A', conf: 0.9, src: 'ai' }], 'multi', sOpts) === null);
        t('越界字母作废', () => mergeCandidates([{ letters: 'Z', conf: 0.9, src: 'ai' }], 'single', sOpts) === null);
        t('两源一致时加成', () => {
            const m = mergeCandidates([{ letters: 'A', conf: 0.6, src: 'ai' }, { letters: 'A', conf: 0.6, src: 'baidu' }], 'single', sOpts);
            return !!m && m.conf > 0.6;
        });

        t('题干回显（所有选项都命中）时单选不瞎猜', () => extractAnswer('下列哪项属于书面形式？A.书面 B.口头 C.音像 D.公证', sOpts, 'single') === null);
        t('唯一选项原文命中仍可用', () => extractAnswer('本题的答案是书面，其余都不对', sOpts, 'single')?.letters === 'A');

        t('一字之差的两道判断题不算同题（闸门对 judge 生效）', () => {
            const a = '中华人民共和国的一切权力属于人民人民代表大会制度是我国的根本政治制度';
            const b = '中华人民共和国的一切权力不属于人民人民代表大会制度是我国的根本政治制度';
            return !prefixSame(a, b) && !fuzzyUsable('judge', a, b) && !fuzzyUsable('judge', b, a);
        });
        t('非判断题不受该闸门限制（仍按相似度复用）', () => {
            const a = '中华人民共和国的一切权力属于人民人民代表大会制度是我国的根本政治制度';
            const b = '中华人民共和国的一切权力不属于人民人民代表大会制度是我国的根本政治制度';
            return fuzzyUsable('single', a, b) === true;
        });
        t('判断题的截断版本仍可复用', () => fuzzyUsable('judge',
            '根据安全生产法的规定，生产经营单位应当具备本法和有关法律、行政法规和国家标准或者行业标准规定的安全生产条件',
            '根据安全生产法的规定，生产经营单位应当具备本法和有关法律、行政法规和国家标准或者行业标准规定的安全生产条件，下列说法正确的是'));

        // ---------- 作答决策 ----------
        t('短错项不再误伤正确候选（回归：错项「书面」曾把「书面形式」一起排除）', () => {
            const r = chooseAnswer({
                type: 'single',
                options: [{ letter: 'A', text: '书面形式' }, { letter: 'B', text: '口头' }],
                wrongTexts: ['书面'], triedCombos: [], cand: 'A',
            });
            return r.strategy === 'cand' && r.letters === 'A';
        });
        t('错项全等时正常排除（剩一个直接选）', () => {
            const r = chooseAnswer({
                type: 'single',
                options: [{ letter: 'A', text: '书面形式' }, { letter: 'B', text: '口头' }],
                wrongTexts: ['书面形式'], triedCombos: [], cand: null,
            });
            return r.strategy === 'exclude' && r.letters === 'B';
        });
        t('单选候选项被排除光 → 交回清错题记录（旧实现返回 ABCD 去点全部选项）', () => {
            const r = chooseAnswer({
                type: 'single',
                options: [{ letter: 'A', text: '书面' }, { letter: 'B', text: '口头' }],
                wrongTexts: ['书面', '口头'], triedCombos: [], cand: null,
            });
            return r.strategy === 'reset-wrong' && r.letters === null;
        });
        t('多选无候选时优先全选', () => {
            const r = chooseAnswer({ type: 'multi', options: sOpts, wrongTexts: [], triedCombos: [], cand: null });
            return r.letters === 'ABCD';
        });
        t('多选已失败组合会被跳过', () => {
            const first = chooseAnswer({ type: 'multi', options: sOpts, wrongTexts: [], triedCombos: [], cand: null });
            const key = comboKey(sOpts, first.letters);
            const r = chooseAnswer({ type: 'multi', options: sOpts, wrongTexts: [], triedCombos: [key], cand: null });
            return r.letters !== first.letters;
        });

        // ---------- CSV / 导入导出基础 ----------
        t('引号内的逗号不当分隔', () => {
            const rows = parseDelimited('a,"b,c",d\n', ',');
            return rows.length === 1 && rows[0][1] === 'b,c' && rows[0].length === 3;
        });
        t('引号内的换行不当分隔', () => {
            const rows = parseDelimited('"line1\nline2",x\n', ',');
            return rows.length === 1 && rows[0][0] === 'line1\nline2';
        });
        t('csvCell 内部引号翻倍', () => csvCell('a"b') === '"a""b"');
        t('分隔符嗅探忽略引号内的分号（自产 CSV 不再被判成分号文件）', () => {
            const csv = '序号,题型,题目,正确答案,错误选项,来源\r\n'
                + '1,多选,"题目一","A; B; C","错一; 错二; 错三","脚本"\r\n'
                + '2,多选,"题目二","A; B; C","错一; 错二; 错三","脚本"\r\n'
                + '3,多选,"题目三","A; B; C","错一; 错二; 错三","脚本"\r\n';
            return sniffDelim(csv) === ',';
        });
        t('表头识别「来源」列', () => mapColumns(['序号', '题型', '题目', '正确答案', '错误选项', '来源']).src === 5);

        // ---------- 校验与题型 ----------
        t('判断题答案 1/0 可入库', () => validateRow('这是一个足够长的判断题题干', '1', '').ok && validateRow('这是一个足够长的判断题题干', '0', '').ok);
        t('重复字母被拒收', () => !validateRow('这是一个足够长的判断题题干', 'AAB', '').ok);
        t('题干过短被拒收', () => !validateRow('短', 'A', '').ok);
        t('题型判定：判断 / 多选 / 单选', () => resolveType('', '1', '下列说法') === 'judge'
            && resolveType('多选题', 'ABC', 'x') === 'multi'
            && resolveType('', 'A', 'x') === 'single');

        // ---------- 题干题量统计写法兼容 ----------
        t('认得出「单选题（共20题）」', () => {
            const m = [...'单选题（共20题）多选题（共5题）'.matchAll(TOTAL_RE)].map(x => +x[1]);
            return m.length === 2 && m[0] === 20 && m[1] === 5;
        });

        // ---------- 用户答案优先级字段 ----------
        t('新条目默认不是用户答案', () => blankEntry({}).by === '' && !isUserEntry(blankEntry({})));
        t('by=user 条目被识别为用户答案', () => isUserEntry(blankEntry({ by: 'user' })));

        // ---------- 退出原因文案 ----------
        t('异常停止不会被写成「答题完成」', () => stopReasonText('crash') !== '答题完成'
            && stopReasonText('done') === '答题完成'
            && stopReasonText('fail:no-stem') === '连续题干未渲染出来');

        // ---------- 面板分类折叠 ----------
        t('折叠状态只认已知分类，缺失 / 非法值一律当「收起」', () => {
            const st = normalizeGroupState({ mode: true, api: 'yes', nope: true }, ['mode', 'api', 'bank']);
            return st.mode === true && st.api === false && st.bank === false && !('nope' in st);
        });
        t('折叠状态能扛住坏数据（字符串 / 数组 / null）', () =>
            normalizeGroupState('mode', ['mode']).mode === false
            && normalizeGroupState([1], ['mode']).mode === false
            && normalizeGroupState(null, ['mode']).mode === false);
        t('默认没有面板存储时全部收起', () => PANEL_GROUP_KEYS.every(k => normalizeGroupState(undefined)[k] === false));
        t('分类摘要跟随当前设置（收起时也能看到状态）', () =>
            groupBadge('mode', { mode: 'ai', speed: 'fast', autoSubmit: true, debug: false }) === 'AI智能 · 快速 · 自动交卷'
            && groupBadge('mode', { mode: 'baidu', speed: 'normal' }) === '百度搜索 · 标准'
            && groupBadge('api', { keySet: true }) === '已配置'
            && groupBadge('api', {}) === '未配置'
            && groupBadge('bank', { bank: 12, answered: 3 }) === '题库 12 题 · 已答 3'
            && groupBadge('log', { lines: 5 }) === '日志 5 行');

        // ---------- 导出文件命名 ----------
        t('答案库文件名带本地日期戳（月、日补零）', () =>
            bankFileNames(new Date(2026, 9, 17)).csv === 'faxuanyun-legal-exam-bank-20261017.csv'
            && bankFileNames(new Date(2026, 0, 5)).json === 'faxuanyun-legal-exam-bank-20260105.json');
        t('日志文件名用本地时间（东八区凌晨导出不会退回前一天）', () =>
            logFileName(new Date(2026, 9, 17, 0, 21, 52)) === 'faxuanyun-legal-exam-log-20261017-002152.txt');
        t('导出文件名只含小写英文、数字、连字符与点', () =>
            /^[a-z0-9.-]+$/.test(bankFileNames(new Date(2026, 9, 17)).csv)
            && /^[a-z0-9.-]+$/.test(logFileName(new Date(2026, 9, 17, 0, 21, 52))));
        t('同一次导出的 CSV 与 JSON 共用同一个日期戳', () => {
            const f = bankFileNames(new Date(2026, 11, 31, 23, 59, 59));
            return f.csv.replace(/\.csv$/, '') === f.json.replace(/\.json$/, '');
        });

        // ---------- 导入载荷解析（改名后的向后兼容） ----------
        const e1 = { q: '第一题题干', a: ['甲'] };
        t('v2 备份（format=faxuanyun-legal-exam-bank）能读出题库', () =>
            Object.keys(parseBankPayload({ format: 'faxuanyun-legal-exam-bank', json: 1, bank: { k1: e1 } }).bank).length === 1);
        t('v1 旧备份（format=faxuanyun-answer-bank）照样能导入', () =>
            Object.keys(parseBankPayload({ format: 'faxuanyun-answer-bank', bank: { k1: e1 } }).bank).length === 1);
        t('一页题干字典按原键导入（以前会被换成空题库静默丢弃）', () => {
            const p = parseBankPayload({ 'q2-abc': e1, '这是一道很长的题干': 'A' });
            return Object.keys(p.bank).length === 2 && p.bank['q2-abc'] === e1;
        });
        t('数组形态按序号当键导入', () => {
            const p = parseBankPayload([e1, e1]);
            return p.bank['0'] === e1 && p.bank['1'] === e1;
        });
        t('带 format 但缺 bank 的载荷判为空（不把 schema/version 当题目）', () => {
            const p = parseBankPayload({ format: 'faxuanyun-answer-bank', schema: 2, version: '2.0.0', exportedAt: 'x' });
            return Object.keys(p.bank).length === 0;
        });
        t('坏数据（null / 数字 / 字符串）当空载荷，不抛错', () =>
            Object.keys(parseBankPayload(null).bank).length === 0
            && Object.keys(parseBankPayload(42).bank).length === 0
            && Object.keys(parseBankPayload('x').bank).length === 0);

        // ---------- 状态栏文案与状态灯同源 ----------
        t('状态灯与状态栏说同一件事：运行中/已暂停/已停止', () =>
            runStatusLabel(false, false) === '已停止'
            && runStatusLabel(true, true) === '⏸️ 已暂停'
            && runStatusLabel(true, false) === '答题中'
            && runStatusLabel(false, true) === '已停止');   // 没在运行时 paused 不该影响文案

        // ---------- 收起按钮文案 ----------
        t('收起按钮文案跟状态走：收起 / 展开，未知状态退回收起', () =>
            collapseLabel('normal') === '收起'
            && collapseLabel('collapsed') === '展开'
            && collapseLabel('mini') === '收起'      // 小圆点那一档已并进窄条
            && collapseLabel('') === '收起'
            && collapseLabel(undefined) === '收起');

        t('@connect 根域：IP 不被截断', () => connectRoot('192.168.1.5') === '192.168.1.5');
        t('@connect 根域：co.uk 这类多段后缀取三层', () => connectRoot('api.example.co.uk') === 'example.co.uk');
        t('@connect 根域：普通域名取两层', () => connectRoot('api.deepseek.com') === 'deepseek.com');

        // ---------- 接口设置校验（以前没有任何自检覆盖） ----------
        t('接口校验：http 地址被拒绝（Key 会明文传输）',
            () => validateApi('http://api.example.com/v1/chat/completions', 'sk-12345678', 'm') !== '');
        t('接口校验：合法 https 配置通过',
            () => validateApi('https://api.deepseek.com/v1/chat/completions', 'sk-12345678', 'deepseek-chat') === '');

        // ---------- 答题卡格子识别（结果页题号写法不止一种，旧实现只认纯数字） ----------
        t('答题卡题号识别：第12题 / 12. / 12题 / 12、都算，「10/10」「答案12」「85分」不算', () => {
            const yes = [['第12题', 12], ['12.', 12], ['12题', 12], ['12、', 12], ['第 3 题', 3], ['7', 7]];
            const no = ['10/10', '答案12', '85分', '12 题（错误）', '0', '501', '第12题解析'];
            return yes.every(([s, n]) => cellNumberText(s) === n)
                && no.every(s => cellNumberText(s) === 0);
        });

        // ---------- v2.0.3：百度回显过滤 / AI 结构化输出 / 成绩页轻量判定 / 多标签页写锁 ----------
        t('stripQueryEcho：剔除查询词回显，答案线索保留', () => {
            const q = '下列说法是否正确的表述中哪一项符合要求';
            const raw = `${q} 正确答案 答案：B 解析：人民政府应当依法行政`;
            const out = stripQueryEcho(raw, [q + ' 正确答案', q + ' 答案', q]);
            return out.includes('答案：B') && out.includes('人民政府应当依法行政') && !out.includes(q);
        });
        t('stripQueryEcho：过短的查询词不动（避免误删正常文字）', () =>
            stripQueryEcho('abc xyz', ['abc']) === 'abc xyz');

        t('extractAIAnswer：JSON 结构化答案与把握度', () => {
            const judgeOpts = [{ letter: 'A', text: '正确' }, { letter: 'B', text: '错误' }];
            const o = extractAIAnswer('{"answer":"B","confidence":0.93,"reason":"法条"}', judgeOpts, 'single');
            return !!o && o.letters === 'B' && Math.abs(o.conf - 0.93) < 1e-9 && /结构化/.test(o.why);
        });
        t('extractAIAnswer：```json 代码块 + 多选题排序', () => {
            const threeOpts = ['A', 'B', 'C'].map(l => ({ letter: l, text: '选项' + l }));
            const o = extractAIAnswer('```json\n{"answer":"BA","confidence":0.8}\n```', threeOpts, 'multi');
            return !!o && o.letters === 'AB';
        });
        t('extractAIAnswer：不是 JSON 就退回文本抽取', () => {
            const threeOpts = ['A', 'B', 'C'].map(l => ({ letter: l, text: '选项' + l }));
            const o = extractAIAnswer('答案：C', threeOpts, 'single');
            return !!o && o.letters === 'C' && /文本兜底/.test(o.why);
        });
        t('extractAIAnswer：答案字母不在选项里时不采信', () => {
            const judgeOpts = [{ letter: 'A', text: '正确' }, { letter: 'B', text: '错误' }];
            return extractAIAnswer('{"answer":"Z","confidence":0.99}', judgeOpts, 'single') === null;
        });

        t('lightLooksLikeResult：课程列表页「考试成绩：100分」不再算成绩页', () =>
            lightLooksLikeResult({ body: '已完成必修课 27 考试成绩：100分', score: { score: 100, total: null }, hasCard: false }) === false);
        t('lightLooksLikeResult：「您的分数」/答题结果算成绩页', () =>
            lightLooksLikeResult({ body: '您的分数为 100 分', score: { score: 100, total: 100 }, hasCard: false }) === true
            && lightLooksLikeResult({ body: '答题结果', score: { score: null, total: null }, hasCard: true }) === true);

        t('lockIsStale：无锁/自己的锁可抢，别人的新锁要等，过期锁可抢', () =>
            lockIsStale(null, 1000, 3000, 'me') === true
            && lockIsStale({ owner: 'me', ts: 900 }, 1000, 3000, 'me') === true
            && lockIsStale({ owner: 'other', ts: 900 }, 1000, 3000, 'me') === false
            && lockIsStale({ owner: 'other', ts: 0 }, 5000, 3000, 'me') === true);

        // ---- v2.0.4：同场双页检测 / 人工对账 / 成绩对账纯函数 ----
        t('parseManualVerdicts：范围 + 单个 + 三种判定', () => {
            const r = parseManualVerdicts('1-5=对, 6=错, 7-10=未答');
            return r[1] === 'correct' && r[5] === 'correct' && r[6] === 'wrong'
                && r[7] === 'unanswered' && r[10] === 'unanswered' && Object.keys(r).length === 10;
        });
        t('parseManualVerdicts：全角冒号 / 分号也能当分隔符', () => {
            const r = parseManualVerdicts('3：正确；4=未答;5=×');
            return r[3] === 'correct' && r[4] === 'unanswered' && r[5] === 'wrong';
        });
        t('parseManualVerdicts：非法片段忽略，超范围题号不认', () =>
            Object.keys(parseManualVerdicts('abc, 999=对, 0=对, 1-2=乱, 6=不知道')).length === 0);
        t('parseManualVerdicts：同一题写两次以后面的为准', () => {
            const r = parseManualVerdicts('1=对,1=错');
            return r[1] === 'wrong' && Object.keys(r).length === 1;
        });
        t('parseManualVerdicts：空输入返回空对象', () => Object.keys(parseManualVerdicts('   ')).length === 0);
        t('tabClaimConflict：无标记 / 自己的标记不算冲突', () =>
            tabClaimConflict(null, 1000, 5000, 'me') === false
            && tabClaimConflict({ owner: 'me', ts: 1000 }, 2000, 5000, 'me') === false);
        t('tabClaimConflict：别人 5 秒内的心跳算冲突，过期不算', () =>
            tabClaimConflict({ owner: 'other', ts: 1000 }, 4000, 5000, 'me') === true
            && tabClaimConflict({ owner: 'other', ts: 0 }, 9000, 5000, 'me') === false);
        t('tabClaimConflict：时间戳在未来（时钟回拨）仍按「正在答题」处理', () =>
            tabClaimConflict({ owner: 'other', ts: 9000 }, 1000, 5000, 'me') === true);
        t('planResultActions：题号可靠时按题号映射', () => {
            const recs = [
                { qNum: 1, stem: '题干一', letters: 'A', type: 'single', pickedText: ['选项一'] },
                { qNum: 2, stem: '题干二', letters: 'B', type: 'single', pickedText: ['选项二'] },
            ];
            const p = planResultActions({ 1: 'correct', 2: 'wrong' }, recs, { totalQ: 2, historyLen: 2 });
            return p.numberMapOk === true && p.items[0].verdict === 'correct' && p.items[1].verdict === 'wrong'
                && p.bad.length === 1 && p.good.length === 1 && p.absentWrong === 0;
        });
        t('planResultActions：题号重复时退回按顺序对账', () => {
            const recs = [
                { qNum: 1, stem: '题干一', letters: 'A', type: 'single', pickedText: ['选项一'] },
                { qNum: 1, stem: '题干二', letters: 'B', type: 'single', pickedText: ['选项二'] },
            ];
            const p = planResultActions({ 1: 'correct', 2: 'wrong' }, recs, { totalQ: 2, historyLen: 2 });
            return p.numberMapOk === false && p.positionalOk === true
                && p.items[0].verdict === 'correct' && p.items[1].verdict === 'wrong';
        });
        t('planResultActions：按顺序对账要求答题卡题号从 1 连续', () => {
            const recs = [
                { qNum: 1, stem: '题干一', letters: 'A', type: 'single', pickedText: ['选项一'] },
                { qNum: 1, stem: '题干二', letters: 'B', type: 'single', pickedText: ['选项二'] },
            ];
            const p = planResultActions({ 1: 'correct', 3: 'wrong' }, recs, { totalQ: 2, historyLen: 2 });
            return p.numberMapOk === false && p.positionalOk === false
                && p.items.every(it => it.skip === 'unmapped') && p.unmapped === 2;
        });
        t('planResultActions：只标对时未标对的按答错兜底（题数覆盖够）', () => {
            const recs = [
                { qNum: 1, stem: '题干一', letters: 'A', type: 'single', pickedText: ['选项一'] },
                { qNum: 2, stem: '题干二', letters: 'B', type: 'single', pickedText: ['选项二'] },
                { qNum: 5, stem: '题干五', letters: 'C', type: 'single', pickedText: ['选项三'] },
            ];
            const p = planResultActions({ 1: 'correct', 2: 'correct', 3: 'correct', 4: 'correct' }, recs, { totalQ: 4, historyLen: 3 });
            return p.absentAsWrong === true && p.absentWrong === 1 && p.items[2].verdict === 'wrong';
        });
        t('planResultActions：记录不完整的跳过并计数', () => {
            const recs = [{ qNum: 1, stem: '题干一', letters: 'A', type: 'single', pickedText: [] }];
            const p = planResultActions({ 1: 'correct' }, recs, { totalQ: 1, historyLen: 1 });
            return p.skipped === 1 && p.items[0].skip === 'incomplete';
        });
        t('planResultActions：答题卡上「未答」不写库、记为未识别', () => {
            const recs = [{ qNum: 1, stem: '题干一', letters: 'A', type: 'single', pickedText: ['选项一'] }];
            const p = planResultActions({ 1: 'unanswered' }, recs, { totalQ: 1, historyLen: 1 });
            return p.unknown === 1 && p.items[0].skip === 'unknown';
        });

        // ---- v2.0.5 A 批：对账定位 / 两源合并 / AI 结构化 / 弱候选 ----
        t('对账定位：模糊命中时按作答记录的 bankKey 找到库内条目', () => {
            const bank = { '#fuzzy001': { q: '根据安全生产法和有关法律行政法规的规定生产经营单位应当具备相应的安全生产条件', l: 'A', a: [] } };
            const rec = {
                stem: '根据安全生产法和有关法律行政法规的规定生产经营单位应当具备相应的安全生产条件，下列说法正确的是',
                letters: 'B', pickedText: ['口头'],
            };
            const exact = locateBankEntryForWrong({ ...rec, bankKey: '#fuzzy001' }, bank);
            const noKey = locateBankEntryForWrong(rec, bank);   // 旧会话记录没有 bankKey
            return exact.key === '#fuzzy001' && exact.keyFrom === 'history'
                && noKey.key === '#fuzzy001' && noKey.keyFrom === 'equivalent';
        });
        t('对账定位：旧记录按规范键兜底，一字之差的相似题不会被误判同题', () => {
            const stem = '根据安全生产法和有关法律行政法规的规定生产经营单位应当具备相应的安全生产条件，下列说法正确的是';
            const bank = {};
            bank[fpKey(stem)] = { q: stem, l: 'A' };
            const exact = locateBankEntryForWrong({ stem, letters: 'B', pickedText: ['口头'] }, bank);
            const similar = {};
            const other = '中华人民共和国的一切权力不属于人民人民代表大会制度是我国的根本政治制度';
            similar[fpKey(other)] = { q: other, l: 'A' };
            const miss = locateBankEntryForWrong(
                { stem: '中华人民共和国的一切权力属于人民人民代表大会制度是我国的根本政治制度', letters: 'B', pickedText: ['错误'] }, similar);
            return exact.key === fpKey(stem) && exact.keyFrom === 'exact'
                && miss.key === '' && miss.e === null;
        });
        t('对账删除闸门：库内答案与本次选的一致才删，不一致只记 bad', () => {
            const rec = { letters: 'B', pickedText: ['口头', '音像'] };
            return bankAnswerIsWrongPick(rec, { l: 'B' }) === true
                && bankAnswerIsWrongPick(rec, { l: 'A' }) === false
                && bankAnswerIsWrongPick(rec, { a: ['口头', '音像'] }) === true
                && bankAnswerIsWrongPick(rec, { a: ['书面'] }) === false
                && bankAnswerIsWrongPick(rec, null) === false;
        });

        t('两源同答案的把握度封顶 1（不再出现 1.09 这种越界值）', () => {
            const m = mergeCandidates([
                { letters: 'A', conf: 0.99, src: 'ai' },
                { letters: 'A', conf: 0.99, src: 'baidu' },
            ], 'single', sOpts);
            return !!m && m.letters === 'A' && m.conf === 1;
        });
        t('AI 结构化高把握 vs 百度冲突时采信领先方（不再永远 null）', () => {
            const m = mergeCandidates([
                { letters: 'A', conf: 0.9, src: 'ai', structured: true, why: 'AI 结构化：法条' },
                { letters: 'B', conf: 0.81, src: 'baidu', why: '孤立字母·已按百度可信度折减' },
            ], 'single', sOpts);
            return !!m && m.letters === 'A' && Math.abs(m.conf - 0.9) < 1e-9;
        });
        t('两源同分冲突仍判 null（宁可不答）', () => {
            const m = mergeCandidates([
                { letters: 'A', conf: 0.6, src: 'ai', why: 'AI 文本兜底' },
                { letters: 'B', conf: 0.6, src: 'baidu', why: '孤立字母' },
            ], 'single', sOpts);
            return m === null;
        });

        t('AI 结构化：confidence=0 原样保留（不再被当成 0.9 的高把握）', () => {
            const o = extractAIAnswer('{"answer":"A","confidence":0}', sOpts, 'single');
            return !!o && o.letters === 'A' && o.conf === 0 && o.conf < CONFIG.crossCheckBelow;
        });
        t('AI 结构化：非数字 confidence 回退 0.9', () => {
            const o = extractAIAnswer('{"answer":"A","confidence":"high"}', sOpts, 'single');
            return !!o && o.letters === 'A' && o.conf === 0.9;
        });
        t('AI 结构化：单选给 "AB" 直接丢弃候选，不静默取 A', () =>
            extractAIAnswer('{"answer":"AB","confidence":0.9}', sOpts, 'single') === null);
        t('AI 结构化：正文多个 JSON 时按出现顺序解析（示例对象不撑坏正式答案）', () => {
            const o = extractAIAnswer('示例格式：{"note":"不要照抄"}；正式答案：{"answer":"C","confidence":0.9}', sOpts, 'single');
            return !!o && o.letters === 'C';
        });
        t('reasoning_content 只有含合法 JSON 才当答案文本用', () =>
            hasJsonObject('推理过程：先排除 A，再看 B，最终选 C') === false
            && hasJsonObject('推理……最终输出 {"answer":"A"}') === true
            && jsonObjectCandidates('a {x} b {y}').length === 2);

        t('弱候选不再直接采信：多选孤立字母改走组合策略（4 选 3 不再点 ABC）', () => {
            const r = chooseAnswer({ type: 'multi', options: sOpts, wrongTexts: [], triedCombos: [], cand: 'ABC', candConf: 0.32 });
            return r.strategy === 'multi-combo' && r.letters === 'ABCD';
        });
        t('强候选（≥0.65）多选仍直接采信', () => {
            const r = chooseAnswer({ type: 'multi', options: sOpts, wrongTexts: [], triedCombos: [], cand: 'AB', candConf: 0.9 });
            return r.strategy === 'cand' && r.letters === 'AB';
        });
        t('单选弱候选改走排除法；不传 candConf（旧调用）保持原行为', () => {
            const weak = chooseAnswer({
                type: 'single', options: sOpts, wrongTexts: ['口头', '音像', '公证'], triedCombos: [],
                cand: 'A', candConf: 0.32,
            });
            const legacy = chooseAnswer({
                type: 'single', options: sOpts, wrongTexts: ['口头', '音像', '公证'], triedCombos: [], cand: 'A',
            });
            return weak.strategy === 'exclude' && weak.letters === 'A'
                && legacy.strategy === 'cand' && legacy.letters === 'A';
        });

        // ---- v2.0.5：B 批（对账幂等 / 缓存恢复 / 看门狗 / 清场复位） ----
        t('对账幂等键：同分数同题号同记录数得到同一个键（与题号顺序无关）', () => {
            const a = reconcileKey({ 1: 'correct', 2: 'wrong', 3: 'unanswered' }, { score: 80, total: 100 }, { historyLen: 3 });
            const b = reconcileKey({ 3: 'unanswered', 2: 'wrong', 1: 'correct' }, { score: 80, total: 100 }, { historyLen: 3 });
            return !!a && a === b && a.length >= 8;
        });
        t('对账幂等键：分数/判定/记录数任一变化都会换键（不同场次不被误去重）', () => {
            const base = reconcileKey({ 1: 'correct', 2: 'wrong' }, { score: 80, total: 100 }, { historyLen: 2 });
            return base !== reconcileKey({ 1: 'correct', 2: 'wrong' }, { score: 79, total: 100 }, { historyLen: 2 })
                && base !== reconcileKey({ 1: 'wrong', 2: 'wrong' }, { score: 80, total: 100 }, { historyLen: 2 })
                && base !== reconcileKey({ 1: 'correct', 2: 'wrong' }, { score: 80, total: 100 }, { historyLen: 3 });
        });
        t('对账幂等键：缺字段的旧成绩数据也能算键（不抛错）', () => {
            const k = reconcileKey(null, null, null);
            return typeof k === 'string' && k.length > 0 && k !== reconcileKey(null, { score: 1 }, null);
        });
        t('缓存恢复探测：成绩页 → 重新解析；考试页 → 提示继续；其它页 → 待命', () =>
            pageShowAction(false, false, true) === 'result'
            && pageShowAction(true, true, false) === 'exam'
            && pageShowAction(true, false, false) === 'idle'
            && pageShowAction(false, false, false) === 'idle');
        t('解析看门狗时长覆盖全部重试（正常重试途中不会误释放）', () =>
            CONFIG.parseWatchdogMs > CONFIG.parseRetryInterval * CONFIG.parseMaxRetry
            && CONFIG.parseWatchdogMs >= 10000);
        t('清场复位：submitted/totalQ/parsedOnce 等运行态全部归零（连考不再误判）', () => {
            const r = clearedSessionState();
            return r.submitted === false && r.totalQ === 0 && r.parsedOnce === false
                && r.lastSubmitTs === 0 && r.answered === 0
                && r.autoSubmitted === false && r.sawNextBtn === false;
        });
        t('清场复位：每次返回新对象（不会污染共享状态）', () => {
            const a = clearedSessionState();
            a.submitted = true;
            return clearedSessionState().submitted === false;
        });

        // ---- v2.0.6：B1 试卷指纹 / A5 百度回显与跟进页 / A6 网络预算 / P2 / B6 观察器 / B7 跨页删除 ----
        t('对账幂等键：同一份试卷（history 题序不同）仍得到同一个键', () => {
            const h1 = [{ stem: '第一道题的题干内容' }, { stem: '第二道题的题干内容' }, { stem: '第三道题的题干内容' }];
            const h2 = [h1[2], h1[0], h1[1]];
            const a = reconcileKey({ 1: 'correct' }, { score: 90, total: 100 }, { historyLen: 3, history: h1 });
            const b = reconcileKey({ 1: 'correct' }, { score: 90, total: 100 }, { historyLen: 3, history: h2 });
            return !!a && a === b;
        });
        t('对账幂等键：分数/判定/记录数相同但试卷不同 → 换键（不再误跳过写库）', () => {
            const base = reconcileKey({ 1: 'correct' }, { score: 90, total: 100 },
                { historyLen: 3, history: [{ stem: '甲题题干' }, { stem: '乙题题干' }] });
            const other = reconcileKey({ 1: 'correct' }, { score: 90, total: 100 },
                { historyLen: 3, history: [{ stem: '丙题题干' }, { stem: '丁题题干' }] });
            return base !== other;
        });
        t('对账幂等键：试卷指纹取排序后前 6 题（与题序无关，R3）', () => {
            const h = [{ stem: '题一' }, { stem: '题二' }, { stem: '题三' }, { stem: '题四' },
                { stem: '题五' }, { stem: '题六' }, { stem: '题七' }];
            return paperFingerprint(h) === paperFingerprint([...h].reverse())
                && paperFingerprint(h).split(',').length === CONFIG.paperFingerprintCount;
        });
        t('对账幂等键：history 缺 stem 用 bankKey 兜底、空值不抛错', () => {
            const k = reconcileKey(null, null, { historyLen: 2, history: [null, {}, { bankKey: '#abc' }, { stem: '' }] });
            return typeof k === 'string' && k.length > 0
                && paperFingerprint(null) === '' && paperFingerprint([{}]) === '';
        });

        t('stripQueryEcho：查询词被拆词回显（「正确 答案」）也能剔除（A5）', () => {
            const q = '下列关于法治政府建设要求的表述';
            const raw = `${q} 正确 答案 答案：C 解析：依法行政`;
            const out = stripQueryEcho(raw, [q + ' 正确答案', q + ' 答案', q]);
            return out.includes('答案：C') && !out.includes('正确 答案') && !out.includes('正确答案') && !out.includes(q);
        });
        t('查询词截断：长题干取「头 40 字 + 尾 20 字」，短题干原样（A5）', () => {
            const head = '甲'.repeat(40), mid = '乙'.repeat(50), tail = '丙'.repeat(20);
            const q = clipQuery(head + mid + tail);
            return q === head + '…' + tail && !q.includes('乙') && clipQuery('短的题干') === '短的题干';
        });
        t('百度跟进页相关性：题干命中的结果页才跟进，广告/导航页跳过（A5）', () => {
            const stem = '根据安全生产法的规定生产经营单位应当具备本法和有关法律行政法规和国家标准或者行业标准规定的安全生产条件';
            const related = '本题解析：' + stem.slice(0, 30) + ' 正确答案：A';
            const ad = '百度推广 考研培训 名师一对一 立即咨询 法律职业资格考试课程 限时优惠';
            return followPageRelevant(related, stem) === true && followPageRelevant(ad, stem) === false;
        });

        t('单题网络预算：单请求超时取「配置超时」与「剩余预算」的较小值（A6）', () =>
            requestTimeout(8000, 3000, 1000) === 2000
            && requestTimeout(8000, 0, 1000) === 8000
            && requestTimeout(3000, 9000, 1000) === 3000);
        t('单题网络预算：耗尽时返回 0（不再发请求/不重试），CONFIG 默认 20 秒（A6）', () =>
            requestTimeout(8000, 1000, 1000) === 0
            && requestTimeout(8000, 500, 1000) === 0
            && CONFIG.queryBudgetMs === 20000);
        t('单题网络预算：预算小于两源最坏耗时（否则起不到收敛作用）（A6）', () => {
            const worst = CONFIG.baiduTimeout * (CONFIG.maxRetry + 1) * 2   // 百度 2 入口×重试
                + CONFIG.baiduTimeout * 2                                    // 跟进页（maxRetry 0）
                + CONFIG.aiTimeout * (CONFIG.maxRetry + 1);                  // AI 重试
            return CONFIG.queryBudgetMs > 0 && CONFIG.queryBudgetMs < worst;
        });

        t('两源合并：conf=0 不会被抬成 0.5（明确「没把握」保持 0）（P2#1）', () => {
            const m = mergeCandidates([{ letters: 'A', conf: 0, src: 'ai' }], 'single', sOpts);
            return !!m && m.letters === 'A' && m.conf === 0;
        });
        t('对账删除闸门：字母相同但选项文本不同 → 不删库（P2#2）', () => {
            const rec = { letters: 'B', pickedText: ['口头'] };
            return bankAnswerIsWrongPick(rec, { l: 'B', a: ['书面'] }) === false
                && bankAnswerIsWrongPick(rec, { l: 'B', a: ['口头'] }) === true
                && bankAnswerIsWrongPick(rec, { l: 'B' }) === true;          // 旧条目只有字母：仍按字母判
        });
        t('AI 结构化直采只看 structured 标记，不再依赖「AI 结构化」文案（P2#5）', () => {
            const byFlag = mergeCandidates([
                { letters: 'A', conf: 0.9, src: 'ai', structured: true, why: '随便什么文案' },
                { letters: 'B', conf: 0.81, src: 'baidu', why: '孤立字母' },
            ], 'single', sOpts);
            const byWhy = mergeCandidates([
                { letters: 'A', conf: 0.9, src: 'ai', why: 'AI 结构化：法条' },
                { letters: 'B', conf: 0.81, src: 'baidu', why: '孤立字母' },
            ], 'single', sOpts);
            const json = extractAIAnswer('{"answer":"A","confidence":0.9}', sOpts, 'single');
            const text = extractAIAnswer('答案：C', sOpts, 'single');
            return !!byFlag && byFlag.letters === 'A' && byWhy === null
                && !!json && json.structured === true && !!text && text.structured === false;
        });

        t('观察器节流：窗口内多次触发只执行最后一次（100ms 尾沿）（B6）', () => {
            const calls = [];
            const timers = new Map();
            let seq = 0;
            const th = trailingThrottle(x => calls.push(x), 100, {
                set: (fn, ms) => { const id = ++seq; timers.set(id, { fn, ms }); return id; },
                clear: id => timers.delete(id),
            });
            th(1); th(2); th(3);
            const pending = [...timers.values()];
            pending.forEach(o => o.fn());
            return calls.length === 1 && calls[0] === 3 && pending.length === 1 && pending[0].ms === 100;
        });
        t('观察器节流：cancel 后不再执行，窗口结束后可再次触发（B6）', () => {
            const calls = [];
            const timers = new Map();
            let seq = 0;
            const th = trailingThrottle(x => calls.push(x), 50, {
                set: (fn, ms) => { const id = ++seq; timers.set(id, { fn, ms }); return id; },
                clear: id => timers.delete(id),
            });
            th('a'); th.cancel();
            const fired = [...timers.values()].map(o => o.fn());
            th('b'); [...timers.values()].map(o => o.fn());
            return fired.length === 0 && calls.length === 1 && calls[0] === 'b';
        });

        t('墓碑：删除后另一标签页合并不会把条目搬回来（B7）', () => {
            const disk = { k1: { q: '题一' }, k2: { q: '题二' }, k3: { q: '题三' } };
            const tombs = addTombKey({}, 'k2', 1000);
            const kept = filterTombstoned(disk, tombs);
            return Object.keys(kept).length === 2 && !('k2' in kept) && ('k1' in kept);
        });
        t('墓碑：同键再次答对清掉墓碑后可以重新写回（B7）', () => {
            const tombs = addTombKey({ k1: 1000 }, 'k1', 2000);
            const cleared = clearTombKey(tombs, 'k1');
            return Object.keys(tombs).length === 1 && Object.keys(cleared).length === 0
                && Object.keys(filterTombstoned({ k1: {} }, cleared)).length === 1;
        });
        t('墓碑：超过 7 天的自动过期清理，未过期的保留（B7）', () => {
            const now = 100 * 24 * 60 * 60 * 1000;
            const ttl = 7 * 24 * 60 * 60 * 1000;
            const kept = purgeTombstones({ old: now - ttl - 1, fresh: now - 1000 }, now, ttl);
            return Object.keys(kept).length === 1 && ('fresh' in kept) && !('old' in kept);
        });

        // ---- v2.0.7：R1 判断题安全复用 / R2 直采与争议 / R3 指纹 / R4 组合上限 /
        //      R5 会话缓存 / R6 双源并行 / R7 响应截断 / R8 墓碑清理 / R9 存储监控 /
        //      R10 争议导出 / R11 诊断包 / R12 脏数据健壮性 ----

        // R1
        t('判断题复用：规范化后相等（全角标点/空白不影响）命中且方式为 judge-fuzzy（R1）', () => {
            const e = { t: 'judge', q: '中华人民共和国的一切权力属于人民。', a: ['正确'], l: 'A' };
            const hit = judgeStemMatch('中华人民共和国的一切权力属于人民', 'judge', [['k1', e]], 2);
            return !!hit && hit.key === 'k1' && hit.how === 'judge-fuzzy' && hit.diff === 0;
        });
        t('判断题复用：长度≥10 时编辑距离 1 也能命中（R1）', () => {
            const e = { t: 'judge', q: '甲乙丙丁戊己庚辛壬癸子丑寅卯辰', a: ['正确'], l: 'A' };
            const hit = judgeStemMatch('甲乙丙丁戊己庚辛壬癸子丑寅卯巳', 'judge', [['k2', e]], 2);
            return !!hit && hit.key === 'k2' && hit.diff === 1;
        });
        t('判断题复用：编辑距离 3 不命中，维持联网（R1）', () => {
            const e = { t: 'judge', q: '甲乙丙丁戊己庚辛壬癸子丑寅卯辰', a: ['正确'], l: 'A' };
            return judgeStemMatch('甲乙丙丁戊己庚辛壬癸子丑午未申', 'judge', [['k3', e]], 2) === null;
        });
        t('判断题复用：两条例目都近似（多命中）时不采用（R1）', () => {
            const mk = suf => ({ t: 'judge', q: '甲乙丙丁戊己庚辛壬癸子丑寅' + suf, a: ['正确'], l: 'A' });
            return judgeStemMatch('甲乙丙丁戊己庚辛壬癸子丑寅卯', 'judge', [['a', mk('卯')], ['b', mk('辰')]], 2) === null;
        });
        t('判断题复用：只差一个「不」字的反义题干不采用（R1）', () => {
            const e = { t: 'judge', q: '中华人民共和国的一切权力属于人民', a: ['正确'], l: 'A' };
            return judgeStemMatch('中华人民共和国的一切权力不属于人民', 'judge', [['k', e]], 2) === null;
        });
        t('判断题复用：非判断题调用、或库内条目不是判断题，一律不启用（R1）', () => {
            const e = { t: 'judge', q: '甲乙丙丁戊己庚辛壬癸子丑寅卯', a: ['正确'], l: 'A' };
            const s = { t: 'single', q: '甲乙丙丁戊己庚辛壬癸子丑寅卯', a: ['A'], l: 'A' };
            return judgeStemMatch(e.q, 'single', [['k', e]], 2) === null
                && judgeStemMatch(e.q, 'judge', [['k', s]], 2) === null;
        });

        // R2
        t('直采阈值：AI 结构化把握 0.85 不再直采，冲突且差距不足时返回 null（R2）', () => {
            const cands = [
                { src: 'ai', letters: 'A', conf: 0.85, structured: true, why: 'a' },
                { src: 'ai', letters: 'B', conf: 0.6, structured: true, why: 'b' },
            ];
            return mergeCandidates(cands, 'single', sOpts) === null;
        });
        t('直采阈值：AI 结构化把握 0.95 且明显领先时仍直采（R2）', () => {
            const cands = [
                { src: 'ai', letters: 'A', conf: 0.95, structured: true, why: 'a' },
                { src: 'ai', letters: 'B', conf: 0.5, structured: true, why: 'b' },
            ];
            const m = mergeCandidates(cands, 'single', sOpts);
            return !!m && m.letters === 'A';
        });
        t('争议观测：两源都≥0.8 但差距不足时仍返回 null，并回调记录争议（R2）', () => {
            const cands = [
                { src: 'ai', letters: 'A', conf: 0.85, structured: true, why: 'ai-a' },
                { src: 'baidu', letters: 'B', conf: 0.85, why: 'bd-b' },
            ];
            let got = null;
            const m = mergeCandidates(cands, 'single', sOpts, ranked => { got = ranked; });
            return m === null && Array.isArray(got) && got.length === 2;
        });
        t('争议记录：同题干+同候选只更新时间戳，超上限裁掉最旧（R2）', () => {
            const a = addDispute([], { stem: '题一', cands: [{ letters: 'A' }, { letters: 'B' }] }, 100);
            const b = addDispute(a, { stem: '题一', cands: [{ letters: 'A' }, { letters: 'B' }] }, 200);
            const c = addDispute(b, { stem: '题二', cands: [{ letters: 'C' }] }, 300, 1);
            return a.length === 1 && b.length === 1 && b[0].ts === 200 && c.length === 1 && c[0].stem === '题二';
        });

        // R3
        t('试卷指纹：前 3 题相同、后 3 题不同 → 指纹不同（R3）', () => {
            const head = [{ stem: '同题一' }, { stem: '同题二' }, { stem: '同题三' }];
            const a = [...head, { stem: '甲一' }, { stem: '甲二' }, { stem: '甲三' }];
            const b = [...head, { stem: '乙一' }, { stem: '乙二' }, { stem: '乙三' }];
            return paperFingerprint(a).split(',').length === 6 && paperFingerprint(a) !== paperFingerprint(b);
        });

        // R4
        t('组合上限：10 个选项不再穷举，exhausted=over-limit（R4）', () => {
            const opts10 = 'ABCDEFGHIJ'.split('').map(l => ({ letter: l, text: '选项' + l }));
            const plan = multiComboPlan(opts10);
            return plan.exhausted === true && plan.reason === 'over-limit'
                && plan.combos.length === 0 && plan.total > CONFIG.multiComboLimit;
        });
        t('组合上限：正常 4 选项仍按全选优先生成 6 个组合（R4）', () => {
            const plan = multiComboPlan(sOpts);
            return !plan.exhausted && plan.combos.length === CONFIG.multiMaxTries && plan.combos[0] === 'ABCD';
        });
        t('组合上限：生成预算耗尽时置 timeout，不抛错（R4）', () => {
            let tick = 0;
            const six = 'ABCDEF'.split('').map(l => ({ letter: l, text: '选项' + l }));
            const plan = multiComboPlan(six, { budgetMs: 15, now: () => { tick += 10; return tick; } });
            return plan.exhausted === true && plan.reason === 'timeout';
        });
        t('组合上限：10 选项无候选时降级为随机保留，字母都在选项里（R4）', () => {
            const opts10 = 'ABCDEFGHIJ'.split('').map(l => ({ letter: l, text: '选项' + l }));
            const plan = chooseAnswer({ type: 'multi', options: opts10 });
            return plan.strategy === 'random-kept'
                && plan.letters.length >= Math.max(2, CONFIG.multiMinChoices)
                && plan.letters.split('').every(l => opts10.some(o => o.letter === l));
        });
        t('组合上限：10 选项有可信候选时直接用候选（R4）', () => {
            const opts10 = 'ABCDEFGHIJ'.split('').map(l => ({ letter: l, text: '选项' + l }));
            const plan = chooseAnswer({ type: 'multi', options: opts10, cand: 'ABCD', candConf: 0.9 });
            return plan.strategy === 'cand' && plan.letters === 'ABCD';
        });

        // R5
        t('会话缓存：键由题型+题干指纹+选项文本组成，题型/选项变化即不命中（R5）', () => {
            const a = answerCacheKey('同一道题', 'single', sOpts);
            const b = answerCacheKey(' 同一道题 ', 'single', sOpts);
            const c = answerCacheKey('同一道题', 'multi', sOpts);
            const d = answerCacheKey('同一道题', 'single', [{ letter: 'A', text: '别的选项' }]);
            return a === b && a !== c && a !== d;
        });
        t('会话缓存：写入后可命中，超过 TTL 失效并删除（R5）', () => {
            const m = new Map();
            cacheStore(m, 'k', { letters: 'A', conf: 0.9 }, 1000, 10);
            const hit = cacheLookup(m, 'k', 1500, 1000);
            const expired = cacheLookup(m, 'k', 2000, 1000);
            return !!hit && hit.letters === 'A' && expired === null && !m.has('k');
        });
        t('会话缓存：超过 answerCacheMax 时淘汰最旧（R5）', () => {
            const m = new Map();
            cacheStore(m, 'a', { letters: 'A' }, 1, 2);
            cacheStore(m, 'b', { letters: 'B' }, 2, 2);
            cacheStore(m, 'c', { letters: 'C' }, 3, 2);
            return m.size === 2 && !m.has('a') && m.has('c');
        });
        t('会话缓存：强制二源 / forceCrossCheck / noCache 均绕过缓存（R5）', () => {
            // 注意：空参数的结果跟随全局 forceCrossCheck 开关，面板冒烟会把它切到「强制」，
            // 所以这里按当前配置值断言，不能写死 false。
            return answerCacheBypassed({ forceTwoSources: true })
                && answerCacheBypassed({ forceCrossCheck: true })
                && answerCacheBypassed({ noCache: true })
                && answerCacheBypassed({}) === !!CONFIG.forceCrossCheck;
        });

        // R6
        t('双源并行：多选/强制二源走并行，单选默认串行（R6）', () => {
            return dualSourcePlan('multi', false) === 'parallel'
                && dualSourcePlan('single', true) === 'parallel'
                && dualSourcePlan('single', false) === 'serial'
                && dualSourcePlan('multi', false, { parallel: false }) === 'serial';
        });
        t('双源并行：两源结果都并入候选，一方失败不影响另一方（R6）', () => {
            const both = combineSourceResults([
                { src: 'baidu', r: { text: '答案是A', note: '' } },
                { src: 'ai', r: { text: '{"answer":"A","confidence":0.9}', note: '' } },
            ], 'single', sOpts);
            const one = combineSourceResults([
                { src: 'baidu', r: { text: '答案是A', note: '' } },
                { src: 'ai', error: new Error('boom') },
            ], 'single', sOpts);
            return both.cands.length === 2 && one.cands.length === 1 && one.cands[0].src === 'baidu'
                && one.notes.some(x => x.includes('AI') && x.includes('请求异常'));
        });
        t('双源并行：一方预算耗尽时仍返回另一方结果并置 budgetSpent（R6）', () => {
            const got = combineSourceResults([
                { src: 'baidu', r: { text: null, note: '', budgetSpent: true } },
                { src: 'ai', r: { text: '{"answer":"B","confidence":0.9}', note: '' } },
            ], 'single', sOpts);
            return got.budgetSpent === true && got.cands.length === 1 && got.cands[0].src === 'ai';
        });

        // R7
        t('响应截断：UTF-8 字节估算与超长截断（R7）', () => {
            return utf8Bytes('abc') === 3 && utf8Bytes('中') === 3 && utf8Bytes('a中') === 4
                && truncateResponseText('abcdef', 3) === 'abc'
                && truncateResponseText('中中', 4) === '中'
                && truncateResponseText('短文本', 1024) === '短文本'
                && CONFIG.followPageMaxBytes === 512 * 1024;
        });
        t('响应截断：未超限的响应原样返回，不被改写（R7）', () => {
            const s = 'x'.repeat(100);
            return truncateResponseText(s) === s && truncateResponseText(s, 0) === s;
        });

        // R8
        t('墓碑清理：每 10 次落盘触发一次，超过 500 条立即触发（R8）', () => {
            const trimmed = trimTombMap({ a: 1, b: 3, c: 2 }, 2);
            return tombPurgeDue(10, 0) && tombPurgeDue(20, 3) && !tombPurgeDue(9, 0)
                && tombPurgeDue(1, 501) && ('b' in trimmed) && ('c' in trimmed) && !('a' in trimmed);
        });

        // R9
        t('存储监控：按已知键汇总 JSON 字节数，缺键记 0（R9）', () => {
            const fake = { questionBank: { a: 1 }, wrongBank: 'xy' };
            const fp = storageFootprint(k => fake[k]);
            return fp.byKey.questionBank === utf8Bytes('{"a":1}') && fp.byKey.wrongBank === 2
                && fp.byKey.pendingSession === 0 && fp.totalBytes === utf8Bytes('{"a":1}') + 2;
        });
        t('存储监控：超过 storageWarnBytes 判定为超限（R9）', () => {
            return storageOverLimit(CONFIG.storageWarnBytes + 1)
                && !storageOverLimit(100) && storageOverLimit(5, 4);
        });

        // R10
        t('争议导出：题库 bad>0 / disputed、错题与 fx_disputes 都进导出结构（R10）', () => {
            const bank = {
                k1: { t: 'single', q: '争议题', a: ['X'], bad: 2 },
                k2: { t: 'single', q: '干净题', a: ['Y'], bad: 0 },
                k3: { t: 'judge', q: '争议判定', a: ['正确'], disputed: true },
            };
            const wrong = { w1: { q: '错题', bad: 1 }, w2: { q: '干净错题', bad: 0 } };
            const data = buildDisputesExport(bank, wrong, [{ stem: '冲突题', cands: [] }], 1710000000000);
            return data.bank.length === 2 && data.wrong.length === 1 && data.disputes.length === 1
                && /^fx-disputes-\d{8}\.json$/.test(data.file) && JSON.stringify(data).length > 10;
        });

        // R11
        t('诊断包：结构完整，缺省字段/空日志也不抛错（R11）', () => {
            const d = buildDiagnostics({
                ua: 'UA', url: 'https://gs.faxuanyun.com/exam',
                sel: { box: true, stem: false },
                requestStats: { '百度': { n: 2, ok: 1, fail: 1, timeout: 0, totalMs: 100, avgMs: 50 } },
                storage: { totalBytes: 123, byKey: {} },
                counts: { bank: 3 }, tombstones: { bank: 1 }, logs: ['[10:00:00] 日志一'],
            }, 1710000000000);
            const empty = buildDiagnostics(null, 1710000000000);
            const s = JSON.stringify(d);
            return d.version === VERSION && /^fx-diagnostics-\d{8}-\d{6}\.json$/.test(d.file)
                && d.sel.box === true && d.sel.stem === false
                && d.config.queryBudgetMs === CONFIG.queryBudgetMs
                && d.logs.length === 1 && d.requestStats['百度'].avgMs === 50
                && !s.includes('undefined') && JSON.stringify(empty).length > 0;
        });
        t('诊断包：最近日志只保留最后 300 条（R11）', () => {
            const logs = Array.from({ length: 305 }, (_, i) => 'L' + i);
            const d = buildDiagnostics({ logs }, 1710000000000);
            return d.logs.length === 300 && d.logs[0] === 'L5' && d.logs[299] === 'L304';
        });

        // R12
        t('脏数据：e.a 为非数组字符串/undefined/null 时判定不抛错（R12）', () => {
            const rec = { letters: 'A', pickedText: [] };
            const s1 = bankAnswerIsWrongPick(rec, { a: 'A' });
            const s2 = bankAnswerIsWrongPick(rec, { a: undefined, l: 'A' });
            const s3 = bankAnswerIsWrongPick(rec, { a: null, l: 'B' });
            const s4 = bankAnswerIsWrongPick({ letters: 'A', pickedText: ['正确'] }, { a: '正确' });
            return s1 === false && s2 === true && s3 === false && s4 === true;
        });

        // 日志级别：字符类必须带 u 标志，否则 emoji 代理对高位会互相误判
        // （历史 bug：🕒 等 D83D 前缀 emoji 全被判成 error，正常日志显示成红色错误）
        t('日志级别：🕒 时钟 emoji 是普通信息，不误判为错误', () => logLevel('🕒 成绩解析/入库完成后 15 秒自动关闭本页') === 'info');
        t('日志级别：⏳/🖊️ 等普通 emoji 不误判为错误', () => logLevel('⏳ 等待考试页面就绪…') === 'info' && logLevel('🖊️ 手动对账') === 'info');
        t('日志级别：❌ 判为错误', () => logLevel('❌ 出错了') === 'error' && logLevel('⛔ 禁止') === 'error');
        t('日志级别：⚠️/⏰ 判为警告', () => logLevel('⚠️ 注意') === 'warn' && logLevel('⚠ 注意') === 'warn' && logLevel('⏰ 提醒') === 'warn');
        t('日志级别：✅/📊/🎯 判为成功', () => logLevel('✅ 成功') === 'ok' && logLevel('📊 统计') === 'ok' && logLevel('🎯 目标') === 'ok');
        t('日志级别：🔍/🧪 判为调试', () => logLevel('🔍 调试') === 'debug' && logLevel('🧪 测试') === 'debug');

        return cases;
    }

    function runSelfTest() {
        const cases = selfTestCases();
        let pass = 0;
        const fails = [];
        for (const c of cases) {
            let ok = false, err = '';
            try { ok = !!c.fn(); } catch (e) { err = (e && e.message) || String(e); }
            if (ok) pass++;
            else fails.push(`${c.name}${err ? `（抛错：${err}）` : ''}`);
        }
        const total = cases.length;
        log(`${pass === total ? '✅' : '❌'} 自检 ${pass}/${total} 项通过`);
        fails.slice(0, 8).forEach(f => log(`　❌ ${f}`));
        if (fails.length > 8) log(`　…另有 ${fails.length - 8} 项未列出`);
        if (pass === total) notify(`自检全部通过（${total} 项）`, 'info');
        else notify(`自检有 ${fails.length} 项未通过，详见日志`, 'error');
        return { pass, total, fails };
    }

    // 把纯函数挂到 window 上，方便在浏览器控制台或外部测试页里直接调用做验证
    try {
        window.__FX_TEST__ = {
            normStem, fpKey, similarity, prefixSame, matchOption, entryToLetters, extractAnswer,
            stripQueryEcho, clipQuery, followPageRelevant, flattenText, removeFlatFragments,
            extractAIAnswer, jsonObjectCandidates, hasJsonObject,
            locateBankEntryForWrong, bankAnswerIsWrongPick, reconcileKey, clearedSessionState, pageShowAction,
            mergeCandidates, chooseAnswer, combosOf, multiCombos, comboKey, parseDelimited, sniffDelim,
            csvCell, validateRow, resolveType, isUserEntry, blankEntry, stopReasonText, fuzzyUsable,
            normalizeGroupState, groupBadge, collapseLabel,
            connectRoot, validateApi, cellNumberText, lockIsStale, lightLooksLikeResult,
            parseManualVerdicts, tabClaimConflict, planResultActions,
            paperFingerprint, requestTimeout, trailingThrottle,
            judgeStemMatch, judgeStemNorm, tombPurgeDue, trimTombMap, addDispute, loadDisputes,
            combineSourceResults, dualSourcePlan, answerCacheKey, cacheLookup, cacheStore, answerCacheBypassed,
            utf8Bytes, truncateResponseText, noteReqStat, reqStatsSnapshot,
            multiComboPlan, multiComboCount, binomial,
            storageFootprint, storageOverLimit, buildDisputesExport, buildDiagnostics,
            purgeTombstones, filterTombstoned, addTombKey, clearTombKey,
            dayStamp, timeStamp, bankFileNames, logFileName, parseBankPayload,
            selfTestCases, runSelfTest,
        };
        // 写库/发请求的内部函数一律不挂到 window。
        // 旧实现用 `window.__FX_TEST_ALLOW_MUTATE__ === true` 做闸门，但页面自己的脚本也能先把
        // 这个全局变量置 true，再通过 __FX_TEST__ 清空/改写答案库——那道闸门等于没有。
        // 自检用到的纯函数都已在上面；需要调试写库请在油猴控制台里直接调用源码函数。
    } catch { }

    // ==================== 存储占用 / 导出（v2.0.7） ====================
    /** GM 里需要统计体积的已知键（R9） */
    const STORAGE_KEYS = [
        'questionBank', 'wrongBank', 'pendingSession', 'fx_bank_tombs', 'fx_wrong_tombs',
        'fx_disputes', 'aiKey', 'bankSchema', 'lastReconcileKey',
    ];

    /**
     * GM 存储占用统计（纯函数，自检可断言，R9）
     * read 可注入（默认 GM_getValue）：字符串按原样、对象按 JSON 序列化，再按 UTF-8 估算字节数。
     * 返回 { totalBytes, byKey }；缺键/坏数据记 0 字节，不抛错。
     */
    function storageFootprint(read) {
        const rd = typeof read === 'function' ? read : (k => GM_getValue(k, null));
        const byKey = {};
        let totalBytes = 0;
        for (const k of STORAGE_KEYS) {
            let v = null;
            try { v = rd(k); } catch { v = null; }
            let raw = '';
            if (v !== null && v !== undefined) {
                if (typeof v === 'string') raw = v;
                else { try { raw = JSON.stringify(v) || ''; } catch { raw = ''; } }
            }
            const n = raw ? utf8Bytes(raw) : 0;
            byKey[k] = n;
            totalBytes += n;
        }
        return { totalBytes, byKey };
    }

    /** 存储是否超过告警阈值（纯函数，自检可断言，R9） */
    function storageOverLimit(bytes, limit = CONFIG.storageWarnBytes) {
        return (+bytes || 0) > (+limit || 0);
    }

    // 10 秒缓存：updateStats 会随答题频繁调用，不能每次都把整个题库重新序列化一遍
    let storageFpCache = { ts: 0, fp: null };
    let storageWarned = false;
    function currentStorageFootprint() {
        const now = Date.now();
        if (storageFpCache.fp && now - storageFpCache.ts < 10000) return storageFpCache.fp;
        let fp;
        try { fp = storageFootprint(); } catch { fp = { totalBytes: 0, byKey: {} }; }
        storageFpCache = { ts: now, fp };
        return fp;
    }
    /** 超过阈值时每次会话只提醒一次（R9），面板更新时调用 */
    function storageWarnOnce(fp) {
        if (storageWarned || !fp) return;
        if (!storageOverLimit(fp.totalBytes)) return;
        storageWarned = true;
        const kb = (fp.totalBytes / 1024).toFixed(1);
        const mb = (CONFIG.storageWarnBytes / 1024 / 1024).toFixed(1);
        log(`💾 存储占用 ${kb} KB，已超过告警阈值 ${mb} MB：建议先导出备份，再清理题库/错题`);
        notify(`存储占用 ${kb} KB，超过 ${mb} MB，建议导出备份后清理`, 'warn');
    }

    /**
     * 争议题导出结构（纯函数，自检可断言，R10）
     * 题库/错题里 bad>0 或 disputed 的条目 + fx_disputes 冲突记录。
     * 返回 { file, generatedAt, version, bank, wrong, disputes }。
     */
    function buildDisputesExport(bank, wrong, disputes, now = Date.now()) {
        const t = new Date(+now || Date.now());
        const keep = map => Object.entries(map || {})
            .filter(([, e]) => e && ((+e.bad || 0) > 0 || e.disputed))
            .map(([key, e]) => ({
                key,
                type: e.t || '',
                stem: e.q || '',
                answer: Array.isArray(e.a) ? e.a : (e.a == null ? [] : [e.a]),
                letters: e.l || '',
                bad: +e.bad || 0,
                disputed: !!e.disputed,
                src: e.src || '',
                by: e.by || '',
                hit: +e.hit || 0,
            }));
        return {
            file: `fx-disputes-${dayStamp(t)}.json`,
            generatedAt: t.toISOString(),
            version: VERSION,
            bank: keep(bank),
            wrong: keep(wrong),
            disputes: Array.isArray(disputes) ? disputes.slice(0, CONFIG.disputeMaxEntries) : [],
        };
    }

    /**
     * 诊断包结构（纯函数，自检可断言，R11）
     * 版本/UA/URL/SEL 命中/CONFIG 快照/各来源请求统计/存储占用/墓碑与题库计数/最近日志。
     * 所有字段都做空值兜底，JSON.stringify 不会因为 undefined 抛错。
     */
    function buildDiagnostics(input, now = Date.now()) {
        const i = input || {};
        const cfg = {};
        for (const [k, v] of Object.entries(CONFIG)) {
            if (typeof v === 'function') continue;
            cfg[k] = v;
        }
        const sel = {};
        for (const [k, v] of Object.entries(i.sel || {})) sel[k] = !!v;
        const lines = Array.isArray(i.logs) ? i.logs.slice(-300) : [];
        const t = new Date(+now || Date.now());
        return {
            file: `fx-diagnostics-${timeStamp(t)}.json`,
            generatedAt: t.toISOString(),
            version: VERSION,
            ua: String(i.ua || ''),
            url: String(i.url || ''),
            sel,
            config: cfg,
            requestStats: i.requestStats && typeof i.requestStats === 'object' ? i.requestStats : {},
            storage: i.storage && typeof i.storage === 'object' ? i.storage : { totalBytes: 0, byKey: {} },
            counts: i.counts && typeof i.counts === 'object' ? i.counts : {},
            tombstones: i.tombstones && typeof i.tombstones === 'object' ? i.tombstones : {},
            logs: lines.map(x => String(x)),
        };
    }

    /** SEL 各选择器当前是否命中（R11）：分组选择器逐个试，取第一个能命中的 */
    function selHitReport(doc) {
        const d = doc || (typeof document !== 'undefined' ? document : null);
        const out = {};
        if (!d) return out;
        for (const [k, v] of Object.entries(SEL)) {
            const list = Array.isArray(v) ? v : [v];
            out[k] = list.some(one => {
                try { return !!one && !!d.querySelector(String(one)); } catch { return false; }
            });
        }
        return out;
    }

    // ==================== 面板 ====================
    // 位置可拖拽并记住；样式与 DOM 全部关在 Shadow DOM 里
    // 按钮按用途分类折叠：默认全部收起，点分类标题才展开同类按钮，展开状态记在油猴存储里
    const PANEL_GROUPS = [
        { key: 'mode', name: '答题模式与节奏' },   // AI智能 / 百度搜索 / 节奏 / 交卷 / 调试
        { key: 'api',  name: '接口设置' },         // AI 设置 / 测试连接
        { key: 'bank', name: '题库与本场' },       // 导出 / 导入答案库 / 解析成绩 / 清空本场
        { key: 'log',  name: '日志与自检' },       // 清空 / 复制 / 导出日志 / 自检
    ];
    const PANEL_GROUP_KEYS = PANEL_GROUPS.map(g => g.key);

    /**
     * 折叠状态归一化（纯函数，自检可断言）
     * 只认已知分类：缺省、坏数据（字符串/数组/null）一律当「收起」，
     * 免得旧版本存下的脏数据把面板撑开、或者让分类凭空多出来。
     */
    function normalizeGroupState(raw, keys) {
        const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
        const out = {};
        for (const k of (keys || PANEL_GROUP_KEYS)) out[k] = src[k] === true;
        return out;
    }

    /**
     * 分类标题右侧的摘要（纯函数，自检可断言）
     * 收起时也能一眼看到关键状态（当前模式与节奏、接口是否配好、题库题数与已答数、日志行数），
     * 不用为了确认一件事把分类一个个点开。
     */
    function groupBadge(key, ctx) {
        const c = ctx || {};
        if (key === 'mode') {
            const bits = [c.mode === 'ai' ? 'AI智能' : '百度搜索', SPEED_NAME[c.speed] || '标准'];
            if (c.autoSubmit) bits.push('自动交卷');
            if (c.debug) bits.push('调试');
            return bits.join(' · ');
        }
        if (key === 'api') return c.keySet ? '已配置' : '未配置';
        if (key === 'bank') return `题库 ${c.bank || 0} 题${c.answered ? ` · 已答 ${c.answered}` : ''}`;
        if (key === 'log') return `日志 ${c.lines || 0} 行`;
        return '';
    }

    /** 分类外壳：标题 + 摘要 + 折叠体，body 里放同类按钮 */
    function groupHtml(key, body) {
        const g = PANEL_GROUPS.find(x => x.key === key) || { key, name: key };
        return `<div class="group" id="fx-group-${key}">
                    <div class="group-head" data-group="${key}" role="button" tabindex="0" aria-expanded="false">
                        <span class="group-caret">▸</span><span class="group-name">${g.name}</span><span class="group-badge" id="fx-gb-${key}"></span>
                    </div>
                    <div class="group-body">${body}</div>
                </div>`;
    }

    /** 各分类摘要要用的数据：按分类取值，别为了一格摘要去读整库 */
    function groupCtx(key) {
        if (key === 'mode') return { mode: CONFIG.answerMode, speed: CONFIG.speed, autoSubmit: CONFIG.autoSubmit, debug: CONFIG.debug };
        if (key === 'api') return { keySet: !!(GM_getValue('aiUrl', '') && getKey()) };
        if (key === 'bank') return { bank: Object.keys(ensureBank()).length, answered: history.length };
        if (key === 'log') return { lines: logLines.length };
        return {};
    }

    /** 刷新分类摘要；传 only 时只刷新指定分类（日志每写一行只动日志那一格） */
    function syncGroupBadges(only) {
        PANEL_GROUPS.forEach(g => {
            if (only && only.indexOf(g.key) < 0) return;
            const el = $('fx-gb-' + g.key);
            if (!el) return;
            const txt = groupBadge(g.key, groupCtx(g.key));
            if (el.textContent !== txt) el.textContent = txt;   // 文案没变就不碰 DOM
        });
    }

    const readGroupState = () => normalizeGroupState(GM_getValue('panelGroups', null), PANEL_GROUP_KEYS);

    /** 把折叠状态写进 DOM：只改 class 与 aria，不重建节点，免得把已绑定的按钮事件冲掉 */
    function applyGroupState(state) {
        const st = state || readGroupState();
        PANEL_GROUP_KEYS.forEach(k => {
            const g = $('fx-group-' + k);
            if (!g) return;
            const open = st[k] === true;
            g.classList.toggle('open', open);
            const head = g.querySelector('.group-head');
            if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        syncGroupBadges();
    }

    /** 点分类标题：展开 / 收起同类按钮，并把状态落盘 */
    function toggleGroup(key) {
        const g = $('fx-group-' + key);
        if (!g || PANEL_GROUP_KEYS.indexOf(key) < 0) return;
        const open = !g.classList.contains('open');
        g.classList.toggle('open', open);
        const head = g.querySelector('.group-head');
        if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
        const st = readGroupState();
        st[key] = open;
        GM_setValue('panelGroups', st);
        // 展开后如果被挤出内容区（窗口矮、或前面的分类也开着），把它滚进来：
        // 「点开就能看到按钮」，不用再自己往下找。只滚动面板内容区，不碰考试页面
        if (open) {
            const box = $('fx-content'), body = g.querySelector('.group-body');
            if (box && body) {
                const bb = body.getBoundingClientRect(), cb = box.getBoundingClientRect();
                if (bb.bottom > cb.bottom) box.scrollTop += bb.bottom - cb.bottom + 8;
            }
        }

        syncGroupBadges();
    }

    function docEl() { return document.documentElement || document.body; }

    function clampPanelPos(x, y) {
        const p = $('fx-panel');
        const w = (p && p.offsetWidth) || 280;
        const h = (p && p.offsetHeight) || 200;
        const maxX = Math.max(0, (window.innerWidth || docEl().clientWidth || 1024) - w - 8);
        const maxY = Math.max(0, (window.innerHeight || docEl().clientHeight || 768) - h - 8);
        return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
    }

    function applyPanelPos(pos) {
        const p = $('fx-panel');
        if (!p) return;
        if (pos) {
            const c = clampPanelPos(pos.x, pos.y);
            p.style.right = 'auto';
            p.style.left = c.x + 'px';
            p.style.top = c.y + 'px';
        } else {
            p.style.left = 'auto';
            p.style.top = '80px';
            p.style.right = '15px';
        }
    }

    /** 拖拽：鼠标与触摸都支持，松手后记住位置 */
    function makeDraggable(handle, panel) {
        let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
        const down = e => {
            if (e.button !== undefined && e.button !== 0) return;   // 只认左键/主指针，右键中键不拖
            if (e.target && e.target.closest && e.target.closest('button')) return;   // 点在按钮上不拖
            const r = panel.getBoundingClientRect();
            dragging = true;
            sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
            panel.style.right = 'auto';
            panel.style.left = r.left + 'px';
            panel.style.top = r.top + 'px';
            if (e.pointerId !== undefined && handle.setPointerCapture) {
                try { handle.setPointerCapture(e.pointerId); } catch { }
            }
            e.preventDefault();
        };
        const move = e => {
            if (!dragging) return;
            const c = clampPanelPos(ox + (e.clientX - sx), oy + (e.clientY - sy));
            panel.style.left = c.x + 'px';
            panel.style.top = c.y + 'px';
        };
        const up = () => {
            if (!dragging) return;
            dragging = false;
            const p = $('fx-panel');
            if (p) GM_setValue('panelPos', { x: p.getBoundingClientRect().left, y: p.getBoundingClientRect().top });
        };
        if (window.PointerEvent) {
            handle.addEventListener('pointerdown', down);
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', up);
            handle.addEventListener('pointercancel', up);
        } else {
            handle.addEventListener('mousedown', down);
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', up);
        }
        handle.style.touchAction = 'none';
    }

    /**
     * 收起控件文案与面板状态同源（和状态灯一个思路）：只在这里定义一次，
     * 免得「收起 / 展开」在 setPanelState 和 syncRunBtns 里各写一遍再走样。
     * 窄条上那一条也是同一个按钮，所以只有这两个值。
     */
    function collapseLabel(state) {
        return state === 'collapsed' ? '展开' : '收起';
    }

    /** 收起只做一件事：完整 ⇄ 窄条（按钮收起来，窄条上的同一个按钮放回去） */
    function togglePanelState() {
        const p = $('fx-panel');
        if (!p) return;
        setPanelState(p.dataset.state === 'collapsed' ? 'normal' : 'collapsed');
        syncRunBtns();
    }

    function setPanelState(state) {
        // state: 'normal' | 'collapsed'（早先的 'mini' 小圆点那一档已并进窄条）
        const p = $('fx-panel');
        if (!p) return;
        const collapsed = state === 'collapsed';   // 未知取值（含旧版本存的 'mini'）一律当完整态
        p.classList.toggle('collapsed', collapsed);
        p.dataset.state = collapsed ? 'collapsed' : 'normal';
        const tg = $('fx-toggle');
        if (tg) tg.textContent = collapseLabel(p.dataset.state);
        GM_setValue('panelState', p.dataset.state);
        // 收起态也要恢复位置：窄条和完整面板是同一个元素，只是高度变了（以前收起时刷新会丢位置）
        applyPanelPos(GM_getValue('panelPos', null) || null);
    }

    function createPanel() {
        const host = document.createElement('div');
        host.id = 'fx-panel-host';
        const shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : null;
        uiRoot = shadow || document;
        if (shadow) {
            const st = document.createElement('style');
            st.textContent = PANEL_CSS;
            shadow.appendChild(st);
        } else {
            GM_addStyle(PANEL_CSS);
        }

        const panel = document.createElement('div');
        panel.id = 'fx-panel';
        panel.dataset.state = 'normal';
        panel.innerHTML = `
            <div class="collapse-title" id="fx-collapse-title">法宣在线助手</div>
            <div class="panel-title" id="fx-drag-title">
                <span class="title-dot" id="fx-run-dot"></span>
                <span>法宣在线助手</span>
                ${VERSION ? `<span class="title-ver">v${VERSION}</span>` : ''}
            </div>
            <div class="topbar">
                <button id="fx-stop">停止</button>
                <button id="fx-pause">暂停</button>
                <button id="fx-toggle" title="收起 / 展开面板">收起</button>
            </div>
            <div class="fx-content" id="fx-content">
                <div class="notice" id="fx-notice" role="status" aria-live="polite" style="display:none;"><span id="fx-notice-text"></span></div>
                ${groupHtml('mode', `
                    <div class="row">
                        <button class="mode-btn ${CONFIG.answerMode === 'ai' ? 'active' : ''}" data-mode="ai" aria-pressed="${CONFIG.answerMode === 'ai' ? 'true' : 'false'}">AI智能</button>
                        <button class="mode-btn ${CONFIG.answerMode === 'baidu' ? 'active' : ''}" data-mode="baidu" aria-pressed="${CONFIG.answerMode === 'baidu' ? 'true' : 'false'}">百度搜索</button>
                    </div>
                    <div class="row grid-2">
                        <button id="fx-speed">节奏：${SPEED_NAME[CONFIG.speed] || '标准'}</button>
                        <button id="fx-submit" class="${CONFIG.autoSubmit ? 'active' : ''}" aria-pressed="${CONFIG.autoSubmit ? 'true' : 'false'}">交卷：${CONFIG.autoSubmit ? '自动' : '手动'}</button>
                        <button id="fx-debug" class="${CONFIG.debug ? 'active' : ''}" aria-pressed="${CONFIG.debug ? 'true' : 'false'}">调试：${CONFIG.debug ? '开' : '关'}</button>
                        <button id="fx-crosscheck" class="${CONFIG.forceCrossCheck ? 'active' : ''}" aria-pressed="${CONFIG.forceCrossCheck ? 'true' : 'false'}">二源：${CONFIG.forceCrossCheck ? '强制' : '自动'}</button>
                    </div>
                `)}
                ${groupHtml('api', `
                    <div class="row">
                        <button id="fx-settings-btn">AI 设置</button>
                        <button id="fx-test">测试连接</button>
                    </div>
                    <div class="settings" id="fx-settings" style="display:none;">
                        <label class="fld"><i>接口地址</i><input id="fx-f-url" type="text" placeholder="https://api.deepseek.com/v1/chat/completions"></label>
                        <label class="fld"><i>API Key</i><input id="fx-f-key" type="password" placeholder="sk-..."></label>
                        <label class="fld"><i>模型</i><input id="fx-f-model" type="text" placeholder="deepseek-chat"></label>
                        <label class="fld"><i>Key 保存</i><span><input id="fx-f-key-session" type="checkbox"${keySessionOnly ? ' checked' : ''}> 仅本次会话（不落盘，刷新后需重填）</span></label>
                        <div class="form-err" id="fx-f-err" style="display:none;"></div>
                        <div class="row">
                            <button id="fx-f-save">保存</button>
                            <button id="fx-f-cancel">取消</button>
                        </div>
                    </div>
                `)}
                ${groupHtml('bank', `
                    <div class="row grid-2">
                        <button id="fx-export">导出答案库</button>
                        <button id="fx-import">导入答案库</button>
                        <button id="fx-reparse">解析成绩</button>
                        <button id="fx-disputes-export">导出争议题</button>
                    </div>
                    <div class="row">
                        <button id="fx-autoclose" aria-pressed="${CONFIG.autoCloseSec ? 'true' : 'false'}">关闭页：${CONFIG.autoCloseSec ? CONFIG.autoCloseSec + ' 秒' : '不关'}</button>
                        <button id="fx-clear-session">清空本场</button>
                        <button id="fx-manual-reconcile">手动对账</button>
                    </div>
                `)}
                ${groupHtml('log', `
                    <div class="row">
                        <button id="fx-log-clear">清空日志</button>
                        <button id="fx-log-copy">复制日志</button>
                        <button id="fx-log-export">导出日志</button>
                    </div>
                    <div class="row">
                        <button id="fx-selftest">自检</button>
                        <button id="fx-diag-export">导出诊断包</button>
                    </div>
                `)}
                <div class="bar"><div class="fill" id="fx-fill"></div></div>
                <div class="status" id="fx-status">就绪</div>
                <div class="stats" id="fx-stats"></div>
                <div class="stats" id="fx-stats2"></div>
                <div class="log-box" id="fx-log"></div>
            </div>
        `;
        (shadow || document.body).appendChild(panel);
        document.body.appendChild(host);

        // 分类标题：点一下展开 / 收起同类按钮，键盘 Enter / 空格也能开
        (uiRoot.querySelectorAll ? uiRoot.querySelectorAll('.group-head') : []).forEach(h => {
            h.onclick = () => toggleGroup(h.dataset.group);
            h.onkeydown = e => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    toggleGroup(h.dataset.group);
                }
            };
        });
        applyGroupState();
        // 第一次用（还没有分类存储）时说明一句：按钮都在分类里，点标题展开
        if (!GM_getValue('panelGroups', null)) {
            log('面板按钮已按分类收起：点分类标题（如「题库与本场」）展开同类按钮；展开状态会记住，快捷键不受影响');
        }

        makeDraggable($('fx-drag-title'), panel);
        makeDraggable($('fx-collapse-title'), panel);

        // 开始 / 停止：停下后再点「开始」能从当前题接着答，已记录过的题不会重答
        $('fx-stop').onclick = () => {
            if (running) {
                running = false; paused = false;
                abortPendingWaits();            // 让正在进行的切题等待立刻结束，不再卡 12 秒（B4）
                releaseActiveTab();             // 立刻撤掉「本页正在答题」心跳，另一页不再误报同场双开（B4）
                log(`⏹️ 已停止（已答 ${history.length} 题）· 点「开始」可从当前题继续`);
                updateStatus(runStatusLabel(running, paused));
            } else {
                log('▶️ 开始答题');
                mainLoop();
            }
            syncRunBtns();
        };
        // 暂停 / 继续
        $('fx-pause').onclick = () => togglePause();
        // 收起：完整 ⇄ 窄条，一个按钮来回
        $('fx-toggle').onclick = () => togglePanelState();
        // 提示条：点一下关掉；使用须知点过就记住，不再打扰
        $('fx-notice').onclick = () => {
            if ($('fx-notice').dataset.kind === 'compliance') {
                GM_setValue('complianceAck', true);
                log('✅ 已确认使用须知，之后不再提示');
            }
            hideNotice();
        };

        // 模式：两个按钮互斥
        (uiRoot.querySelectorAll ? uiRoot.querySelectorAll('.mode-btn') : []).forEach(b => {
            b.onclick = () => {
                CONFIG.answerMode = b.dataset.mode;
                GM_setValue('answerMode', CONFIG.answerMode);
                (uiRoot.querySelectorAll ? uiRoot.querySelectorAll('.mode-btn') : [])
                    .forEach(x => {
                        x.classList.toggle('active', x === b);
                        x.setAttribute('aria-pressed', String(x === b));   // 读屏软件也能知道当前模式
                    });
                log(`已切到「${b.dataset.mode === 'ai' ? 'AI智能' : '百度搜索'}」模式`);
                updateStats();
            };
        });

        $('fx-speed').onclick = () => {
            const order = ['slow', 'normal', 'fast'];
            CONFIG.speed = order[(order.indexOf(CONFIG.speed) + 1) % order.length];
            GM_setValue('speed', CONFIG.speed);
            if (rushSpeedSaved) { rushDisabled = true; log('（已按你的选择接管节奏：本场不再自动提速，收工也不会改回旧档位）'); }
            syncRunBtns();
            log(`节奏已切换为「${SPEED_NAME[CONFIG.speed]}」`);
        };
        // 自动交卷开关（以前只能去改脚本里的 CONFIG.autoSubmit）
        $('fx-submit').onclick = () => {
            CONFIG.autoSubmit = !CONFIG.autoSubmit;
            GM_setValue('autoSubmit', CONFIG.autoSubmit);
            syncRunBtns();
            log(CONFIG.autoSubmit
                ? '⚠️ 已开启自动交卷：答完最后一题会自动点「交卷」并确认'
                : '已关闭自动交卷：答完只提示，由你自己点交卷');
            notify(CONFIG.autoSubmit ? '已开启自动交卷，答完会自动提交，请谨慎' : '已关闭自动交卷',
                CONFIG.autoSubmit ? 'warn' : 'info');
        };
        // 调试开关：打开后额外输出细节日志
        $('fx-debug').onclick = () => {
            CONFIG.debug = !CONFIG.debug;
            GM_setValue('debug', CONFIG.debug);
            $('fx-debug').textContent = `调试：${CONFIG.debug ? '开' : '关'}`;
            $('fx-debug').classList.toggle('active', CONFIG.debug);
            $('fx-debug').setAttribute('aria-pressed', String(CONFIG.debug));
            syncGroupBadges(['mode']);   // 收起时摘要里的「调试」也要跟着变
            log(CONFIG.debug ? '🔍 调试模式已打开，会输出更详细的日志' : '已关闭调试模式');
        };
        // 二源交叉验证开关：自动（把握不足/多选才查第二源）↔ 强制（每题都查两个来源）
        $('fx-crosscheck').onclick = () => {
            CONFIG.forceCrossCheck = !CONFIG.forceCrossCheck;
            GM_setValue('forceCrossCheck', CONFIG.forceCrossCheck);
            syncRunBtns();
            log(CONFIG.forceCrossCheck
                ? '🛡️ 已开启强制二源交叉验证：每题都会再查一个来源（更准，但更慢、更费额度）'
                : '已关闭强制二源交叉验证：只在主源把握不足或多选题时查第二源');
        };

        // AI 设置：面板内表单，带格式校验与连接测试
        const apiFormErr = msg => {
            const el = $('fx-f-err');
            if (el) { el.textContent = msg || ''; el.style.display = msg ? 'block' : 'none'; }
            return !msg;
        };
        const fillApiForm = () => {
            $('fx-f-url').value = GM_getValue('aiUrl', '');
            $('fx-f-key').value = getKey();
            $('fx-f-model').value = CONFIG.aiModel;
            const cb = $('fx-f-key-session');
            if (cb) cb.checked = !!keySessionOnly;
            apiFormErr('');
        };
        const showApiForm = on => {
            $('fx-settings').style.display = on ? 'block' : 'none';
            $('fx-settings-btn').classList.toggle('active', on);
            if (on) {
                fillApiForm();
                log('填好三项后点「保存」；若输入框点不进去，用 Tab 键切过去或直接点输入框（会自动改用弹窗输入）');
            }
        };
        /** 校验通过才落盘；Key 走混淆存储，不裸存 */
        const saveApiForm = () => {
            const url = String($('fx-f-url').value || '').trim();
            const key = String($('fx-f-key').value || '').trim();
            const model = String($('fx-f-model').value || '').trim();
            const err = validateApi(url, key, model);
            if (err) { apiFormErr(err); notify(err, 'warn'); return false; }
            GM_setValue('aiUrl', url);
            // 「仅本次会话」：Key 只放内存、不落盘；取消勾选则恢复混淆落盘
            keySessionOnly = !!$('fx-f-key-session').checked;
            GM_setValue('aiKeySessionOnly', keySessionOnly);
            if (keySessionOnly) { sessionKey = key; GM_setValue('aiKey', ''); }
            else { sessionKey = ''; setKey(key); }
            CONFIG.aiModel = model;
            GM_setValue('aiModel', model);
            // @connect 白名单外的域名会被油猴直接拦掉，这里提前讲清楚要补哪一行
            try {
                const host = new URL(url).hostname;
                if (!CONNECT_HOSTS.some(h => host === h || host.endsWith('.' + h))) {
                    const root = connectRoot(host);
                    log(`⚠️ 域名 ${host} 不在脚本头部的 @connect 白名单里，请求会被拦截。请在脚本头部补一行：// @connect ${root}`);
                    notify(`接口域名 ${host} 不在 @connect 白名单，请按日志提示补一行`, 'warn');
                }
            } catch { }
            apiFormErr('');
            return true;
        };
        $('fx-settings-btn').onclick = () => showApiForm($('fx-settings').style.display === 'none');
        $('fx-f-cancel').onclick = () => showApiForm(false);
        $('fx-f-save').onclick = safe('保存设置', () => {
            if (!saveApiForm()) return;
            log(`✅ 设置已保存（地址已填 · Key 已填 · 模型 ${CONFIG.aiModel}）`);
            notify('设置已保存', 'info');
            showApiForm(false);
        });
        $('fx-test').onclick = safe('测试连接', async () => {
            // 表单开着时用表单里的值测试，但不落盘（以前点「测试连接」会顺手把设置保存了）
            if ($('fx-settings').style.display !== 'none') {
                const url = String($('fx-f-url').value || '').trim();
                const key = String($('fx-f-key').value || '').trim();
                const model = String($('fx-f-model').value || '').trim();
                const err = validateApi(url, key, model);
                if (err) { apiFormErr(err); notify(err, 'warn'); return; }
                await testApi({ url, key, model });
                return;
            }
            await testApi();
        });
        // 这个站点早期出现过输入框聚焦不了，点不动就退回弹窗输入
        const fieldFallback = (id, label) => {
            const input = $(id);
            input.addEventListener('click', () => setTimeout(() => {
                const active = uiRoot.activeElement || document.activeElement;
                if (active === input) return;
                const v = prompt(label, input.value || '');
                if (v === null) return;
                input.value = v.trim();
                log(`（输入框聚焦不了，已改用弹窗输入${label}）`);
            }, 260));
        };
        fieldFallback('fx-f-url', '接口地址');
        fieldFallback('fx-f-key', 'API Key');
        fieldFallback('fx-f-model', '模型名');

        // 清空本场：识别到不是同一场考试、或想重新开始时用
        $('fx-clear-session').onclick = safe('清空本场', () => {
            if (!history.length) { log('本场还没有作答记录'); return; }
            // 不可撤销：先让用户确认（以前一点就清空，误点只能重答）
            if (!confirm(`确定清空本场 ${history.length} 条作答记录？\n清空后无法恢复（题库不受影响）。`)) {
                log('已取消清空本场');
                return;
            }
            if (running) {
                // 运行中点清空会让脚本立刻重答当前题，先暂停交给你决定
                paused = true;
                syncRunBtns();
                log('已先暂停：清空本场后，点「继续」会从当前题重新作答');
            }
            clearSession('手动清空');
            notify('已清空本场作答记录，可重新开始答题', 'info');
        });
        // 关闭页：成绩解析/入库流程走完后自动关闭本页（浏览器可能不允许，见 scheduleAutoClose）；
        // 倒计时进行中再点一下 = 取消本次自动关闭，页面保持打开
        $('fx-autoclose').onclick = safe('关闭页设置', () => {
            if (autoCloseLeft > 0 || autoCloseTimer) { cancelAutoClose('手动取消'); return; }
            const idx = AUTO_CLOSE_STEPS.indexOf(+CONFIG.autoCloseSec);
            CONFIG.autoCloseSec = AUTO_CLOSE_STEPS[(idx + 1) % AUTO_CLOSE_STEPS.length];
            GM_setValue('autoCloseSec', CONFIG.autoCloseSec);
            updateAutoCloseBtn();
            log(CONFIG.autoCloseSec
                ? `🕒 成绩解析/入库完成后 ${CONFIG.autoCloseSec} 秒自动关闭本页`
                : '🕒 已关闭「自动关闭本页」');
        });
        // 自检：跑一遍内置用例（纯函数断言），改完脚本点一下就知道有没有踩坏
        $('fx-selftest').onclick = safe('自检', () => runSelfTest());
        // 手动重新解析成绩：二次交卷、刷新结果页、重考都能再解析
        $('fx-reparse').onclick = safe('解析成绩', () => {
            if (!isResultPage()) { log('当前页面不像考试结果页，交卷后再点「解析成绩」'); return; }
            log('🔄 手动解析成绩…');
            parseResult();
        });
        // 手动对账：答题卡识别不出来时的兜底——按题号手填对错，走同一套对账/入库流程
        $('fx-manual-reconcile').onclick = safe('手动对账', () => {
            if (!history.length) { log('本场还没有作答记录，无法手动对账'); return; }
            const tip = '题号=对/错/未答，范围用 -，比如：1-8=对, 9=错, 10=未答';
            const raw = prompt(`手动对账（本场 ${history.length} 条记录）\n${tip}`, '');
            if (raw === null) { log('已取消手动对账'); return; }
            const verdicts = parseManualVerdicts(raw);
            const nums = Object.keys(verdicts).map(Number);
            if (!nums.length) {
                log('❌ 手动对账没解析出有效内容。格式示例：1-8=对, 9=错, 10=未答');
                notify('手动对账格式不对，详见日志', 'warn');
                return;
            }
            log(`🖊️ 手动对账：识别 ${nums.length} 个题号（${nums.slice(0, 20).join(',')}${nums.length > 20 ? '…' : ''}），按同一套流程对账入库`);
            reportResult(verdicts, readScore());
        });
        $('fx-export').onclick = safe('导出答案库', () => {
            // 一次导出两个文件：CSV 给 Excel 看，JSON 是字段完整的备份，可无损往返
            const { csv, count, wrongOnly, userCount, riskySep } = exportCsv();
            // 文件名统一成仓库规范、带日期戳，导出的两个文件成对好找
            const files = bankFileNames();
            downloadFile(files.csv, csv, 'text/csv;charset=utf-8;', 0);
            downloadFile(files.json, exportJson(), 'application/json;charset=utf-8;', 300);
            log(`✅ 已导出 ${count} 题${wrongOnly ? `（其中 ${wrongOnly} 题只有错误记录）` : ''}${userCount ? `，含 ${userCount} 条用户手改答案` : ''}：${files.csv} + ${files.json}`);
            if (riskySep) log(`⚠️ 有 ${riskySep} 题的选项内容里含「;」或「+」，CSV 往返可能被拆项——需要换电脑时请以 .json 为准`);
        });
        $('fx-import').onclick = safe('导入答案库', () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv,.json,.txt,.tsv,text/csv,application/json';
            input.onchange = e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                    try {
                        log(`📥 读取 ${file.name}（${(file.size / 1024).toFixed(1)} KB）`);
                        reportImport(importData(decodeFile(ev.target.result)));
                    } catch (err) { log(`❌ 导入失败：${err.message}`); }
                };
                // 读文件也会失败/被取消：以前没有兜底，面板上什么都不显示
                reader.onerror = () => log(`❌ 读取 ${file.name} 失败：${(reader.error && reader.error.message) || '未知错误'}`);
                reader.onabort = () => log('导入已取消');
                reader.readAsArrayBuffer(file);      // 拿字节自己判编码，避免 GBK 乱码
            };
            input.click();
        });

        // 日志区：清空 / 复制 / 导出
        $('fx-log-clear').onclick = safe('清空日志', () => {
            logLines.length = 0;
            const box = $('fx-log');
            if (box) box.innerHTML = '';
            log('日志已清空');
        });
        $('fx-log-copy').onclick = safe('复制日志', () => copyLog());
        $('fx-log-export').onclick = safe('导出日志', () => exportLog());
        // R10：导出争议题——题库/错题里被标记过错误或争议的条目 + fx_disputes 冲突记录
        $('fx-disputes-export').onclick = safe('导出争议题', () => {
            const data = buildDisputesExport(ensureBank(), ensureWrong(), loadDisputes());
            const total = data.bank.length + data.wrong.length + data.disputes.length;
            if (!total) {
                notify('暂无可导出的争议题（题库里 bad=0，也没有两源冲突记录）', 'info');
                log('ℹ️ 导出争议题：没有数据');
                return;
            }
            downloadFile(data.file, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;');
            log(`✅ 已导出争议题：题库 ${data.bank.length} / 错题 ${data.wrong.length} / 冲突记录 ${data.disputes.length} → ${data.file}`);
        });
        // R11：导出诊断包——版本/环境/选择器命中/CONFIG/请求统计/存储/计数/最近日志
        $('fx-diag-export').onclick = safe('导出诊断包', () => {
            const tb = tombMap('bank'), tw = tombMap('wrong');
            const data = buildDiagnostics({
                ua: typeof navigator !== 'undefined' ? navigator.userAgent : '',
                url: typeof location !== 'undefined' ? String(location.href || '') : '',
                sel: selHitReport(),
                requestStats: reqStatsSnapshot(),
                storage: currentStorageFootprint(),
                counts: {
                    bank: Object.keys(ensureBank()).length,
                    wrong: Object.keys(ensureWrong()).length,
                    tombs: Object.keys(tb).length + Object.keys(tw).length,
                    disputes: loadDisputes().length,
                    history: history.length,
                    answered: session.ans,
                    totalQ,
                },
                tombstones: { bank: Object.keys(tb).length, wrong: Object.keys(tw).length },
                logs: logLines.slice(-300),
            });
            downloadFile(data.file, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;');
            log(`✅ 已导出诊断包：${data.file}（日志 ${data.logs.length} 条 / 请求来源 ${Object.keys(data.requestStats).length} 个）`);
        });

        // 快捷键：Alt + 字母，不干扰页面里正常打字
        document.addEventListener('keydown', e => {
            if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
            // 在输入框里打字时不响应快捷键
            const ae = uiRoot.activeElement || document.activeElement;
            if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
            // 用 e.code 判键——e.key 在非拉丁布局或 macOS 上会因修饰键变成别的字符（'ß'/'π' 等），
            // 导致 Alt+S/P/H/L/E/D 静默失效
            const code = String(e.code || '');
            const k = code.startsWith('Key') ? code.slice(3).toLowerCase() : String(e.key || '').toLowerCase();
            const acts = {
                s: () => { $('fx-stop').click(); },
                p: () => togglePause(),
                h: () => togglePanelState(),
                l: () => $('fx-log-clear').click(),
                e: () => $('fx-log-export').click(),
                d: () => $('fx-debug').click(),
                t: () => $('fx-selftest').click(),
            };
            if (!acts[k]) return;
            e.preventDefault();
            acts[k]();
        });

        // 视口变化时把面板拉回可见范围
        window.addEventListener('resize', () => {
            const p = $('fx-panel');
            if (!p || !p.style.left) return;
            applyPanelPos({ x: p.getBoundingClientRect().left, y: p.getBoundingClientRect().top });
        });

        // 恢复上次的位置与状态
        const savedState = GM_getValue('panelState', 'normal');
        if (savedState !== 'normal') setPanelState(savedState);
        else applyPanelPos(GM_getValue('panelPos', null) || null);

        // 就绪探测替代固定 2 秒硬等待
        (async () => {
            // 老数据里的明文 Key 顺手转成混淆存储，不用用户重新填
            const rawKey = GM_getValue('aiKey', '');
            if (rawKey && !String(rawKey).startsWith('v1:')) {
                setKey(String(rawKey));
                log('🔐 已把明文保存的 API Key 转为混淆存储');
            }
            updateStats();
            restoreSession();
            log('等待考试页面就绪...');
            if (await waitReady()) {
                log('✅ 页面就绪，开始答题');
                mainLoop();
                return;
            }
            // 不是考试页：可能是交卷后的结果页，刷新进来也能解析
            if (isResultPage()) {
                log('检测到考试结果页，自动解析成绩…');
                markPendingSubmitted();
                setTimeout(parseResult, CONFIG.parseFirstDelay);
                return;
            }
            updateStatus('未检测到题目');
            log('❌ 未检测到题目，请确认已进入考试页面');
        })();

        watchSubmit();
        watchUserClick();
        syncRunBtns();
        updateAutoCloseBtn();
        updateStats();
        dbg(`面板已就绪 · 分类可折叠（点标题展开同类按钮） · 快捷键 Alt+S 开始/停止 · Alt+P 暂停 · Alt+H 收起/还原 · Alt+L 清空日志 · Alt+E 导出日志 · Alt+D 调试 · Alt+T 自检`);
    }

    /** 暂停 / 继续的统一入口（按钮与快捷键共用） */
    function togglePause() {
        if (!running) { log('当前没在答题，点「开始」后再试'); return; }
        paused = !paused;
        if (!paused) {
            // 用户点了「继续」：给弹窗处理再一轮机会，否则同一个弹窗会立刻把流程又暂停回去
            lastDialogText = ''; dialogDismissCount = 0;
        }
        log(paused
            ? `⏸️ 已暂停在第 ${getQNum() || '?'} 题 · 点「继续」从这里接着答`
            : '▶️ 已继续答题');
        updateStatus(paused ? '⏸️ 已暂停' : '答题中');
        syncRunBtns(); updateStats();
    }

    /** 开答前的体检：离线 / 接口没配好，都要明说 */
    function preflight() {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            log('📴 当前处于离线状态，联网查询会被跳过，只能靠本地题库与排除法');
            notify('当前离线，联网查询已跳过，只能靠本地题库与排除法', 'warn');
        }
        if (CONFIG.answerMode === 'ai') {
            if (!GM_getValue('aiUrl', '')) { log('⚠️ 未设置 API 地址，AI 模式不可用，已自动降级到百度搜索'); notify('AI 模式未配置地址，已降级到百度搜索（可在「AI 设置」里补上）', 'warn'); }
            else if (!getKey()) log('⚠️ 未设置 API Key，AI 模式不可用，已自动降级到百度搜索');
        }
    }

    /** 设置项校验：地址要能解析、Key 不能带空格、模型不能空 */
    function validateApi(url, key, model) {
        if (!url) return '⚠️ 接口地址不能为空';
        let u = null;
        try { u = new URL(url); } catch { return '⚠️ 接口地址格式不对，示例：https://api.deepseek.com/v1/chat/completions'; }
        if (!/^https?:$/.test(u.protocol)) return '⚠️ 接口地址必须以 http:// 或 https:// 开头';
        if (u.protocol === 'http:') return '⚠️ 已拒绝 http 地址：Key 会明文传输，请换成 https 地址';
        if (!key) return '⚠️ API Key 不能为空';
        if (/\s/.test(key)) return '⚠️ API Key 里不能有空格或换行';
        if (key.length < 8) return '⚠️ API Key 看起来太短，请确认是否复制完整';
        if (!model) return '⚠️ 模型名不能为空';
        if (/\s/.test(model)) return '⚠️ 模型名里不能有空格';
        return '';
    }

    async function testApi(form) {
        const url = (form && form.url) || GM_getValue('aiUrl', '');
        const key = (form && form.key) || getKey();
        const model = (form && form.model) || CONFIG.aiModel;
        if (!url || !key) { log('⚠️ 请先设置 API 地址与 API Key'); return; }
        log(`正在测试API连接（模型 ${model}）...`);
        const r = await request({
            method: 'POST', url, timeout: CONFIG.aiTimeout, desc: 'AI',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
            data: JSON.stringify({
                model,
                messages: [{ role: 'user', content: '你好，请回复「连接成功」四个字' }],
                temperature: 0, max_tokens: 32,
            }),
        });
        if (!r.ok) { log(`❌ ${failText(r, 'AI 接口')}`); return; }
        let data = null;
        try { data = JSON.parse(r.text); }
        catch { log('❌ 返回的不是合法 JSON，请确认 API 地址是 OpenAI 兼容的 chat/completions'); return; }
        const msg = (data && data.choices && data.choices[0] && data.choices[0].message) || {};
        const content = String(msg.content || msg.reasoning_content || '').trim();
        if (content) { log(`✅ API连接成功（${model}）：${content.slice(0, 30)}`); return; }
        const apiErr = data && data.error && (data.error.message || data.error.code);
        log(apiErr ? `❌ 接口返回错误：${String(apiErr).slice(0, 160)}` : '❌ API返回内容为空');
    }

    const AUTO_CLOSE_STEPS = [8, 15, 30, 0];   // 「关闭页」按钮循环档位（秒，0 = 不关闭）

    /** 「关闭页」按钮文案跟随设置；倒计时期间显示剩余秒数，点一下就是取消 */
    function updateAutoCloseBtn() {
        const b = $('fx-autoclose');
        if (!b) return;
        if (autoCloseLeft > 0) {
            b.textContent = `关闭页：${autoCloseLeft} 秒（点击取消）`;
            b.classList.add('active');
            b.setAttribute('aria-pressed', 'true');
            return;
        }
        b.textContent = CONFIG.autoCloseSec ? `关闭页：${CONFIG.autoCloseSec} 秒` : '关闭页：不关';
        b.classList.toggle('active', !!CONFIG.autoCloseSec);
        b.setAttribute('aria-pressed', String(!!CONFIG.autoCloseSec));
    }

    /** 按钮文案跟随运行状态 */
    function syncRunBtns() {
        const st = $('fx-stop');
        if (st) {
            st.textContent = running ? '停止' : '开始';
            st.classList.toggle('active', !!running);   // 运行中主按钮高亮，避免误点
        }
        const ps = $('fx-pause');
        if (ps) {
            ps.textContent = paused ? '继续' : '暂停';
            ps.disabled = !running;                     // 没在跑就没什么可暂停的
        }
        const sp = $('fx-speed');
        if (sp) sp.textContent = `节奏：${SPEED_NAME[CONFIG.speed] || '标准'}`;
        const sb = $('fx-submit');
        if (sb) {
            sb.textContent = `交卷：${CONFIG.autoSubmit ? '自动' : '手动'}`;
            sb.classList.toggle('active', !!CONFIG.autoSubmit);
            sb.setAttribute('aria-pressed', String(!!CONFIG.autoSubmit));
        }
        const cc = $('fx-crosscheck');
        if (cc) {
            cc.textContent = `二源：${CONFIG.forceCrossCheck ? '强制' : '自动'}`;
            cc.classList.toggle('active', !!CONFIG.forceCrossCheck);
            cc.setAttribute('aria-pressed', String(!!CONFIG.forceCrossCheck));
        }
        const tg = $('fx-toggle');
        const pn = $('fx-panel');
        if (tg && pn) tg.textContent = collapseLabel(pn.dataset.state);
        // 标题左侧状态灯：绿=答题中，黄=已暂停，灰=已停止
        const rd = $('fx-run-dot');
        if (rd) {
            rd.classList.toggle('on', !!running && !paused);
            rd.classList.toggle('paused', !!running && !!paused);
        }
        // 运行中的状态文案由 runStatusLabel 统一推，和上面那盏状态灯不会各说各话
        const st2 = $('fx-status');
        if (st2 && running) st2.textContent = runStatusLabel(true, paused);
        syncGroupBadges();   // 模式 / 节奏 / 交卷 / 调试 变化后，收起状态的摘要同步
    }

    const updateStatus = t => { const el = $('fx-status'); if (el) el.textContent = t; };

    /**
     * 状态栏文案与状态灯同源：运行时返回「已暂停 / 答题中」，停止时返回「已停止」。
     * 由 mainLoop 开头、收尾以及「停止」按钮三处调用，保证状态灯和文案不会各说各话。
     */
    function runStatusLabel(isRunning, isPaused) {
        if (!isRunning) return '已停止';
        return isPaused ? '⏸️ 已暂停' : '答题中';
    }
    /** 进度条按真实题数算，题数不是 10 的倍数也不失真 */
    const updateProgress = (done, total) => {
        const el = $('fx-fill');
        if (!el) return;
        const d = total > 0 ? total : Math.max(done, CONFIG.defaultTotalQ);
        el.style.width = Math.min(Math.round(done / d * 100), 100) + '%';
    };
    /** 状态面板：题库规模、命中率、当前模式、运行状态、进度与剩余时间 */
    function updateStats() {
        syncGroupBadges();   // 题库题数 / 已答数变化后同步摘要，收起时也看得到
        const el = $('fx-stats'), el2 = $('fx-stats2');
        if (!el) return;
        const bank = ensureBank();
        const n = Object.keys(bank).length;
        let userN = 0, letterOnly = 0;
        for (const e of Object.values(bank)) {
            if (isUserEntry(e)) userN++;
            if (!e.a || !e.a.length) letterOnly++;   // 只有字母、没有选项内容：选项一乱序就可能答错
        }
        const rate = session.ans ? Math.round(session.hit / session.ans * 100) : 0;
        const bits = [];
        if (userN) bits.push(`手改 ${userN}`);
        if (letterOnly) bits.push(`纯字母 ${letterOnly}`);
        // R9：存储占用 + 题库/错题/墓碑计数（10 秒缓存，避免每次刷新都序列化整个题库）
        const fp = currentStorageFootprint();
        storageWarnOnce(fp);
        const wrongN = Object.keys(ensureWrong()).length;
        const tombN = Object.keys(tombMap('bank')).length + Object.keys(tombMap('wrong')).length;
        const disputeN = loadDisputes().length;
        const kb = (fp.totalBytes / 1024).toFixed(fp.totalBytes >= 102400 ? 0 : 1);
        const storageTxt = ` · 💾 ${kb} KB（题库 ${n} / 错题 ${wrongN} / 墓碑 ${tombN}）`;
        const disputeTxt = disputeN ? ` · ⚔️ 争议 ${disputeN}` : '';
        el.textContent = `📊 题库 ${n} 题${bits.length ? `（${bits.join(' · ')}）` : ''}${session.ans ? ` · 命中 ${session.hit}/${session.ans}（${rate}%）` : ''}${storageTxt}${disputeTxt}`;
        if (!el2) return;
        const mode = CONFIG.answerMode === 'ai' ? 'AI智能' : '百度搜索';
        const run = running ? (paused ? '⏸️ 已暂停' : '▶️ 进行中') : '⏹️ 已停止';
        const time = remainSec === null ? '' : ` · ⏰ 剩余 ${fmtSec(Math.max(remainSec, 0))}`;
        const dbgOn = CONFIG.debug ? ' · 🔍调试' : '';
        el2.textContent = `🎛 模式：${mode} · ${run} · 已答 ${history.length}${totalQ ? '/' + totalQ : ''}${time}${dbgOn}`;
    }

    // 未捕获异常也记一笔，至少能让人在日志里看到发生了什么
    // 页面上的异常（含站点自身与第三方脚本）都会走到这里：去重 + 每分钟限流，避免把面板日志刷掉
    const errSeen = new Map();
    let errWindow = 0, errCount = 0;
    function logSiteError(kind, msg) {
        const now = TS();
        if (now - errWindow > 60000) { errWindow = now; errCount = 0; errSeen.clear(); }   // 窗口滚动时一并清去重表
        if (errCount >= CONFIG.errLogPerMin) return;          // 每分钟最多几条
        const key = `${kind}:${msg}`;
        const n = (errSeen.get(key) || 0) + 1;
        if (errSeen.size > 200) errSeen.clear();
        errSeen.set(key, n);
        if (n > 1 && n % 10 !== 0) return;                    // 同一条反复出现时每 10 次才记一次
        errCount++;
        log(`❌ ${kind}：${msg}${n > 1 ? `（同类已出现 ${n} 次）` : ''}`);
    }
    window.addEventListener('error', e => {
        if (!e) return;
        // 资源加载失败（img/script/link）没有 message，也不是脚本逻辑错误，直接忽略
        if (!e.message && !(e.error && e.error.message)) return;
        const msg = e.message || (e.error && e.error.message) || '未知错误';
        logSiteError('页面脚本异常', `${msg}${e.filename ? ` @${String(e.filename).split('/').pop()}:${e.lineno || 0}` : ''}`);
    });
    window.addEventListener('unhandledrejection', e => {
        const r = e && e.reason;
        logSiteError('未处理的异步异常', (r && r.message) || String(r || '未知'));
    });

    // 首次使用先讲清楚风险与边界
    if (!GM_getValue('complianceAck', false)) {
        setTimeout(() => notify(
            '⚠️ 使用须知：本脚本仅供个人学习研究；自动答题可能违反平台考试规则，风险请自行评估；' +
            '联网查询会访问第三方站点，请遵守其服务条款与访问频率约定（点此确认）', 'warn', 'compliance'), 800);
    }

    // 页面关闭/切后台时把未落盘的改动写回，避免丢数据
    const flushOnExit = () => { saveSession(); flushBank(); };
    window.addEventListener('beforeunload', flushOnExit);
    window.addEventListener('pagehide', flushOnExit);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushOnExit(); });

    // ==================== 往返缓存（bfcache）恢复 ====================
    /**
     * 从往返缓存恢复后该做什么（纯函数，自检可断言）。
     * 成绩页 → 重新解析（对账幂等，不会重复计分）；考试页 → 提示继续；其它 → 待命（B2）。
     */
    function pageShowAction(hasStem, hasOptions, isResult) {
        if (isResult) return 'result';
        if (hasStem && hasOptions) return 'exam';
        return 'idle';
    }

    /**
     * bfcache 恢复后的状态复位（B2）：页面从往返缓存恢复时不会重新执行脚本，
     * running / parseRunning / 自动关闭计时器 / 同场双页心跳都可能停留在上一轮的状态，
     * 表现为「看着在答题其实没动」「解析成绩点了没反应」「另一页一直提示同场双开」。
     */
    function resetRuntimeAfterPageShow() {
        const wasBusy = running || parseRunning || !!autoCloseLeft;
        running = false; paused = false; timeUp = false;
        abortPendingWaits();            // 缓存恢复时也中止未完成的切题等待（B2/B4）
        releaseActiveTab();
        if (autoCloseTimer) { clearTimeout(autoCloseTimer); autoCloseTimer = null; }
        if (autoCloseTick) { clearInterval(autoCloseTick); autoCloseTick = null; }
        autoCloseLeft = 0;
        releaseParse();                 // 解析锁 / 看门狗 / 重试定时器一起作废
        lastSubmitTs = 0;               // 允许重新识别本页的交卷确认
        try { updateAutoCloseBtn(); } catch { }
        try { syncRunBtns(); } catch { }
        if (wasBusy) log('♻️ 页面从缓存恢复，已复位上一轮的运行状态');
        updateStatus('页面从缓存恢复，正在重新检测…');
        setTimeout(() => {
            try {
                const hasStem = !!(getStem() || '').trim();
                const hasOptions = getOptions().length > 0;
                let isResult = false;
                try { isResult = isResultPage(); } catch { }
                const action = pageShowAction(hasStem, hasOptions, isResult);
                if (action === 'result') {
                    log('♻️ 缓存恢复后检测到成绩页，自动重新解析（与上次对账一致时不会重复写库）');
                    markPendingSubmitted();
                    parseResult();
                } else if (action === 'exam') {
                    log('♻️ 缓存恢复后检测到考试页：点面板「开始」可继续答题');
                    updateStatus('就绪');
                } else {
                    log('♻️ 缓存恢复后未检测到题目/成绩页，请手动刷新页面');
                    updateStatus('未检测到题目');
                }
            } catch (e) {
                log(`⚠️ 缓存恢复后的页面探测失败：${(e && e.message) || e}`);
            }
        }, 120);
    }

    // 只在「从往返缓存恢复」时复位；正常加载（persisted=false）不动，避免干扰首屏初始化
    window.addEventListener('pageshow', e => {
        if (!e || !e.persisted) return;
        try { resetRuntimeAfterPageShow(); } catch (err) {
            log(`⚠️ 页面恢复复位失败：${(err && err.message) || err}`);
        }
    });

    document.body ? createPanel() : window.addEventListener('DOMContentLoaded', createPanel);
})();
//（注：内容由AI生成）
