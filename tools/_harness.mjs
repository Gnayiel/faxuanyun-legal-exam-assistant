/**
 * 两个浏览器冒烟工具共用的页面内打桩片段（v2.0.14）。
 *
 * 以前 panel-smoke.mjs 与 page-smoke.mjs 各写了一遍 GM_* 打桩，
 * 改一处漏一处很容易让两边行为不一致。这里只放「页面里要注入的脚本字符串」，
 * 不碰 Node 侧逻辑，所以两边各自的断言仍留在自己文件里。
 */

/** 核心 GM_* 打桩：内存版 KV + 版本号 + 不落盘的 addStyle */
export function gmCore({ version = '9.9.9', name = 'smoke' } = {}) {
    return `window.__store = new Map();
window.GM_info = { script: { version: ${JSON.stringify(version)}, name: ${JSON.stringify(name)} } };
window.GM_getValue = (k, d) => window.__store.has(k) ? window.__store.get(k) : d;
window.GM_setValue = (k, v) => { window.__store.set(k, v); };
window.GM_addStyle = () => document.createElement('style');
window.GM_addValueChangeListener = () => 0;`;
}

/** 离线闸门：任何网络请求都直接抛错，用来证明「这段流程不联网」 */
export function noNetwork(message = '冒烟测试不允许联网') {
    return `window.GM_xmlhttpRequest = () => { throw new Error(${JSON.stringify(message)}); };`;
}

/** 拦截 <a download> 点击，把「导出」变成可断言的记录（不真的落盘） */
export function downloadHook() {
    return `window.__downloads = [];
URL.createObjectURL = (blob) => { window.__lastBlob = blob; return 'blob:fx/' + window.__downloads.length; };
URL.revokeObjectURL = () => {};
const realClick = HTMLAnchorElement.prototype.click;
HTMLAnchorElement.prototype.click = function () {
    if (this.download) { window.__downloads.push({ name: this.download, size: window.__lastBlob ? window.__lastBlob.size : -1 }); return; }
    return realClick.apply(this, arguments);
};`;
}

/**
 * 假的百度搜索接口（离线）：按 clue 命中答案，记录每次请求 URL，
 * 供断言「答案来自百度」「没有真的联网」。正文塞够长度的解析文本，模拟真实结果页。
 */
export function fakeBaidu({ answers = [], store = {}, delayMs = 0 } = {}) {
    return `(function () {
  var cfg = ${JSON.stringify({ answers, store, delayMs })};
  for (var k in cfg.store) window.__store.set(k, cfg.store[k]);
  window.__fxNet = [];
  window.__fxAnswers = cfg.answers;
  window.GM_xmlhttpRequest = function (o) {
    var url = String((o && o.url) || '');
    window.__fxNet.push(url);
    var m = url.match(/[?&]wd=([^&]*)/);
    var wd = m ? decodeURIComponent(m[1]) : '';
    var ans = '';
    for (var i = 0; i < cfg.answers.length; i++) {
      if (wd.indexOf(cfg.answers[i].clue) >= 0) { ans = cfg.answers[i].answer; break; }
    }
    var responseText;
    if (ans) {
      var filler = '';
      for (var j = 0; j < 20; j++) filler += '根据相关法律法规的规定，本选项符合法定情形，故选择该答案。';
      responseText = '<html><body><div class="result c-container"><h3 class="t">题目答案与解析</h3>'
        + '<div class="c-abstract">参考答案：' + ans + '。' + filler + '</div></div></body></html>';
    } else {
      responseText = '<html><body><div class="result c-container">没有找到该题的答案</div></body></html>';
    }
    setTimeout(function () { if (o && o.onload) o.onload({ status: 200, responseText: responseText }); }, cfg.delayMs || 0);
    return { abort: function () { } };
  };
})();`;
}
