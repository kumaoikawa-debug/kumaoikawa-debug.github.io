#!/usr/bin/env node
/* gen-v197-showcase.js — 渲染 v197 三处重做的真实面板（来自线上代码），生成样例页 + 改前改后对比页。
   复用 spa-smoke.js 的 vm 加载器（剔除 boot.js），但本进程自带 fs，可直接写盘。 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projDir = process.argv[2] || ".";
const srcDir = path.join(projDir, "src");

// —— 模块顺序（同 harness：优先 index.html 的 <script src> 顺序）——
function orderFromHtml() {
  const html = ["index.html", "admin.html", "front.html"].map((f) => path.join(projDir, f)).find((p) => fs.existsSync(p));
  if (!html) return null;
  const s = fs.readFileSync(html, "utf8");
  const out = [];
  for (const m of s.matchAll(/<script[^>]+src="src\/([^"?]+)/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out.length ? out : null;
}
let files = orderFromHtml() || fs.readdirSync(srcDir).filter((f) => f.endsWith(".js")).sort();
files = files.filter((f) => f !== "boot.js" && fs.existsSync(path.join(srcDir, f)));
const extra = (process.env.SPA_SMOKE_EXTRA || "").split(",").map((s) => s.trim()).filter(Boolean);
for (const f of extra) if (!files.includes(f) && fs.existsSync(path.join(srcDir, f))) files.push(f);

let code = "";
for (const f of files) code += "\n;/* ==== " + f + " ==== */\n" + fs.readFileSync(path.join(srcDir, f), "utf8");

// —— 最小 DOM stub（同 harness）——
function el() {
  return {
    style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ""; } },
    dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    children: [], value: "", innerHTML: "", textContent: "", checked: false,
    setAttribute() {}, getAttribute() { return null; }, appendChild() {}, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, closest() { return null; },
    querySelector() { return el(); }, querySelectorAll() { return []; }, focus() {}, blur() {},
    insertAdjacentHTML() {}, getBoundingClientRect() { return { top: 0, left: 0, width: 0, height: 0 }; },
    scrollTo() {}, scrollIntoView() {}, matches() { return false; }, cloneNode() { return el(); }
  };
}
const fakeDoc = el();
fakeDoc.body = el(); fakeDoc.head = el(); fakeDoc.documentElement = el();
fakeDoc.createElement = () => el(); fakeDoc.createElementNS = () => el();
const _elCache = new Map();
const _elOnce = (key) => { if (!_elCache.has(key)) _elCache.set(key, el()); return _elCache.get(key); };
fakeDoc.getElementById = (id) => _elOnce("#" + id);
fakeDoc.querySelector = (sel) => _elOnce(String(sel));
fakeDoc.cookie = "";
const store = {};
const sandbox = {
  console, document: fakeDoc,
  navigator: { userAgent: "node-smoke", clipboard: { writeText() { return Promise.resolve(); } } },
  location: { href: "http://localhost/", pathname: "/index.html", search: "", hash: "" },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; }, clear() {}, key: () => null, length: 0 },
  sessionStorage: { getItem: () => null, setItem() {}, removeItem() {}, clear() {} },
  fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }),
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval,
  requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  Image: function () { return el(); }, FileReader: function () { return { readAsDataURL() {}, onload: null }; },
  URL, URLSearchParams, TextEncoder, TextDecoder,
  Blob: function () {}, FormData: function () {},
  XMLHttpRequest: function () { return { open() {}, send() {}, setRequestHeader() {}, addEventListener() {} }; },
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  alert() {}, confirm: () => true, prompt: () => "", scrollTo() {}
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
sandbox.__PROJ_CSS__ = fs.readFileSync(path.join(projDir, "styles.css"), "utf8");
const ctx = vm.createContext(sandbox);





// —— epilogue：v201 文案事实闸门的真实渲染 ——
const epi = `
state = (typeof loadState === "function") ? loadState() : state;
state.detailMode = "editorial";

/* 老板反馈里的原话文案（从两张截图里逐字摘出）——
   ① 标题/副标题/正文段落里的「9月20日 · 25 公里」；
   ② 正文末尾整行「9月20日单日往返｜98元/人｜限15人｜4小时车程｜海拔800米」。 */
var RAW_TITLE = "9月20日，把朋友约到青城后山（山脊山地）";
var RAW_SUB   = "社交 · 9月20日 · 25 公里 · 中等强度";
var RAW_LEAD  = "9月20日，不做室内局，约在青城后山。\\n一起出发、一起走完、一起吃个饭。";
var BROADCAST = "9月20日单日往返｜98元/人｜限15人｜4小时车程｜海拔800米";
var RAW_WHY   = "在场履历是城市里最容易被忽略的东西：会议、通勤、未读消息。\\n" + BROADCAST;
var RAW_QUOTE = "9月20日，并排走过一段路。";

function mk(over) {
  var base = {
    id: "v201-demo", type: "徒步", title: "青城后山山脊徒步", place: "青城后山",
    date: "2026-09-20", dateMD: "9月20日", meeting: "天府广场",
    price: 199, limitUnit: "人", limit: 15, days: 1,
    distance: 25, elevation: 800, difficulty: "中等", season: "秋",
    photos: [], photoCaptions: [], tags: [], highlights: [], sellingPoints: [], body: [], reviews: [],
    feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    confirmed: [{ key: "services" }, { key: "difficulty" }],
    itineraryDays: [{ label: "一日山脊线", sub: "", items: [
      { time: "07:30", text: "天府广场集合" },
      { time: "08:00", text: "出发前往青城后山" },
      { time: "12:00", text: "适中简餐" },
      { time: "17:30", text: "抵达天府广场，活动结束" }
    ] }],
    departures: [], gear: [], coverIndex: 0,
    useMemberPrice: false, allowPoints: false, allowCoupons: false
  };
  return Object.assign(base, over || {});
}
var esc2 = function (t) {
  return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};

/* ===== ① hero：标题 / 副标题 ===== */
var gTitle = sanitizeLiteraryText(RAW_TITLE);
var gSub   = sanitizeLiteraryText(RAW_SUB);
var DIRTY = mk({
  id: "v201-dirty",
  editorialStylePack: {
    /* angle 必须等于该活动当前风格的角度：editorialStylePackOf 会把「角度不一致」的包判为
       「换版式后的旧包」而弃用（正确的产品逻辑）。老板的真实场景里包就是当时存下的、角度一致，
       这里照实还原，否则 hero 会回退到活动原名，对照就失真了。 */
    angle: (typeof editorialVariantOf === "function") ? editorialVariantOf(mk()).angle : "",
    title: RAW_TITLE, subtitle: RAW_SUB, lead: RAW_LEAD,
    paras: { why: [BROADCAST], gain: ["带走的是不是公里数的记录，是一整天连续的视野。"] },
    pullQuote: RAW_QUOTE,
    factsFingerprint: (typeof editorialFactsFingerprint === "function") ? editorialFactsFingerprint(mk()) : "",
    dnaFactFingerprint: (typeof dnaFactFingerprint === "function") ? dnaFactFingerprint(mk()) : ""
  }
});
var afterHtml = renderActivityEditorial(DIRTY);
/* 改前 = 把闸门后的文案换回老板截图里的原文（同一份 DOM，只换文字，对照才公平） */
var beforeHtml = afterHtml.replace(gTitle, RAW_TITLE).replace(gSub, RAW_SUB);
/* 导语与金句同样换回原文：导语按行渲染成多个 <p>，逐行替换。
   （渲染层会把导语拆成段落，所以不能整段替换。） */
var gl = sanitizeLiteraryText(RAW_LEAD).split("\\n");
var rl = RAW_LEAD.split("\\n");
for (var qi = 0; qi < rl.length; qi++) {
  if (gl[qi] && gl[qi] !== rl[qi]) beforeHtml = beforeHtml.replace(gl[qi], rl[qi]);
}
var gQuote = sanitizeLiteraryText(RAW_QUOTE);
if (gQuote && gQuote !== RAW_QUOTE) beforeHtml = beforeHtml.replace(gQuote, RAW_QUOTE);

function heroOf(h) {
  var s = String(h), i = s.indexOf('<header class="xh-ed-hero');
  if (i < 0) return "";
  var j = s.indexOf("</header>", i);
  return s.slice(i, j < 0 ? i + 4000 : j + 9);
}
function sliceFrom(h, marker, len) {
  var s = String(h), i = s.indexOf(marker);
  if (i < 0) return "";
  var st = s.lastIndexOf("<div", i);
  return s.slice(st >= 0 ? st : i, (st >= 0 ? st : i) + (len || 1200));
}
var beforeHero = heroOf(beforeHtml), afterHero = heroOf(afterHtml);

/* ===== ② 导语 ===== */
var beforeLead = sliceFrom(beforeHtml, "xh-ed-lead", 1300);
var afterLead  = sliceFrom(afterHtml, "xh-ed-lead", 1300);

/* ===== ③ AI 消费叙事段（为什么值得去）===== */
var narA = mk({ id: "v201-nar", whyGo: RAW_WHY });
var narAfter = (typeof narrativeBlock === "function") ? narrativeBlock(narA, "whyGo", "", "为什么值得去", null) : "";
var narBefore = '<section class="v13-narrative" data-narr="whyGo"><h3>为什么值得去</h3><p>'
  + esc2(RAW_WHY).replace(/\\n/g, "<br>") + '</p></section>';

/* ===== ④ 闸门规则逐条对照（数据由闸门本身产出）===== */
var ruleInputs = [
  BROADCAST,
  "9月20日，不做室内局，约在青城后山。",
  "全程约 25 公里（海拔 800 米），一路都在换视野。",
  "走完这12公里，你会更清楚自己能走多远。",
  RAW_SUB,
  "把9月20日留给朋友。",
  "到达青城后山，活动结束。",
  "这一天，把注意力从屏幕移回脚下。",
  RAW_TITLE,
  "9月20日单日往返｜98元/人｜限15人｜4小时车程｜海拔800米走路的时候，话题自然就有了。"
];
var rules = ruleInputs.map(function (t) {
  var o = sanitizeLiteraryText(t);
  return { in: t, hits: factBroadcastHits(t), out: o, dropped: o === "" };
});
/* 老板可手写字段用的轻量闸门：只丢参数串，不改句子 */
var ownInputs = [
  "9月20日，把朋友约到青城后山",
  "9月20日单日往返｜98元/人｜限15人",
  "走路的时候，话题自然就有了。"
];
var ownRules = ownInputs.map(function (t) {
  return { in: t, out: stripBroadcastLines(t) };
});

/* ===== ⑤ 事实层未被触碰（客户据此决策/下单/核对）===== */
var afterText = String(afterHtml).replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ");
var facts = [["时间胶囊", "9月20日"], ["集合时刻", "07:30"], ["午餐时刻", "12:00"], ["返程时刻", "17:30"],
             ["价格", "199"], ["名额", "15"], ["里程", "25"], ["海拔", "800"]]
  .map(function (p) { return { k: p[0], v: p[1], kept: afterText.indexOf(p[1]) >= 0 }; });
var decisionHtml = sliceFrom(afterHtml, 'class="decision-meta"', 900);
var timelineHtml = sliceFrom(afterHtml, 'id="ed-itin"', 1500);
if (!timelineHtml) timelineHtml = sliceFrom(afterHtml, "tl-item", 1500);

return {
  rawTitle: RAW_TITLE, gTitle: gTitle, rawSub: RAW_SUB, gSub: gSub,
  beforeHero: beforeHero, afterHero: afterHero,
  beforeLead: beforeLead, afterLead: afterLead,
  narBefore: narBefore, narAfter: narAfter,
  rules: rules, ownRules: ownRules, facts: facts,
  decisionHtml: decisionHtml, timelineHtml: timelineHtml,
  hasEd: typeof renderActivityEditorial === "function",
  hasGate: typeof sanitizeLiteraryText === "function"
};
`;

try {
  vm.runInContext(code + "\nglobalThis.__RESULT__ = (async function () {\n  try {\n" + epi + "\n  } catch (e) { return { error: String((e && e.stack) || e) }; }\n})();", ctx, { filename: "spa-bundle.js", timeout: 30000 });
} catch (e) {
  console.error("LOAD ERROR", String((e && e.stack) || e));
  process.exit(1);
}

Promise.resolve(sandbox.__RESULT__).then(function (r) {
  if (r && r.error) { console.error("EPILOGUE ERROR", r.error); process.exit(1); }
  const styles = fs.readFileSync(path.join(projDir, "styles.css"), "utf8");
  const esc3 = (t) => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const ruleRows = r.rules.map((x, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="mono">${esc3(x.in)}</td>
      <td class="mono hits">${x.hits.length ? esc3(x.hits.join(" / ")) : "—"}</td>
      <td class="mono out ${x.dropped ? "drop" : ""}">${x.out ? esc3(x.out) : "（整句丢弃）"}</td>
    </tr>`).join("");
  const ownRows = r.ownRules.map((x) => `
    <tr>
      <td class="mono">${esc3(x.in)}</td>
      <td class="mono out ${x.out === "" ? "drop" : ""}">${x.out ? esc3(x.out) : "（丢弃）"}</td>
    </tr>`).join("");
  const factRows = r.facts.map((f) => `<span class="fchip ${f.kept ? "keep" : "lost"}">${esc3(f.k)} ${esc3(f.v)} ${f.kept ? "✓" : "✗"}</span>`).join("");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClubOS v201 · 文案不该是参数播报（样例页）</title>
<style>${styles}</style>
<style>
  body { background:#f4f1ea; margin:0; font:14px/1.6 system-ui,"PingFang SC",sans-serif; color:#233; }
  .w { max-width:1150px; margin:0 auto; padding:26px 18px 80px; }
  h1 { font-size:23px; margin:0 0 6px; }
  .lead { color:#7a7468; margin:0 0 6px; }
  h2 { font-size:17px; margin:36px 0 4px; }
  .sub { color:#7a7468; font-size:13px; margin:0 0 14px; }
  .badge { display:inline-block; font:600 12px/1 sans-serif; color:#fff; background:#2e7d5b; padding:4px 9px; border-radius:20px; margin-right:8px; vertical-align:middle; }
  .badge.warn { background:#b4551f; } .badge.blue { background:#2b5f8f; }
  .row { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-start; }
  .col { flex:1 1 420px; min-width:330px; background:#fff; border-radius:14px; box-shadow:0 2px 14px rgba(0,0,0,.06); padding:14px; }
  .col h3 { font-size:13.5px; margin:0 0 10px; }
  .tag { display:inline-block; font:700 11px/1 sans-serif; color:#fff; padding:3px 8px; border-radius:20px; margin-right:6px; }
  .t-bad { background:#b4551f; } .t-good { background:#2e7d5b; }
  .phone { border:1px solid #e4e0d6; border-radius:12px; overflow:hidden; background:#fff; }
  table.tb { border-collapse:collapse; width:100%; font-size:12.5px; }
  table.tb th, table.tb td { border:1px solid #ece8de; padding:7px 9px; text-align:left; vertical-align:top; }
  table.tb th { background:#faf8f3; font-weight:700; }
  .mono { font-family:ui-monospace,Menlo,monospace; }
  .hits { color:#b4551f; }
  .out { color:#1f5c3f; }
  .out.drop { color:#b4551f; font-style:italic; }
  .card { background:#fff; border-radius:14px; box-shadow:0 2px 14px rgba(0,0,0,.06); padding:16px; margin-bottom:14px; }
  .fchip { display:inline-block; font:600 12px/1 ui-monospace,Menlo,monospace; padding:6px 10px; border-radius:999px; margin:0 6px 6px 0; }
  .fchip.keep { background:#e8f5ee; color:#1f5c3f; border:1px solid #b9dcc8; }
  .fchip.lost { background:#fdecea; color:#b4551f; border:1px solid #f0c8c2; }
  code { background:#faf8f3; padding:1px 5px; border-radius:4px; font-size:12px; }
</style>
</head>
<body>
<div class="w">
  <h1>ClubOS v201 · 文案不是参数播报</h1>
  <p class="lead">反馈原话：「为什么文案里面老是出现 时间 日期，我们要的文案是有语言美感的，不是这种没有艺术的数字。」</p>
  <p class="lead">根因两条：① 本地角度模板把 <code>{D}</code>(日期)/<code>{startTime}</code>(时刻)/<code>{distWord}</code>(公里)/<code>{limit}</code>(人数) 直接填进标题导语正文；② AI 提示词曾要求正文「最后给决策信息」，AI 就在正文末尾播报一整行参数。</p>
  <p class="lead"><b>做法是分层，不是一刀切删数字：</b>文学层（标题/副标题/导语/正文/金句）只谈画面与感受；事实层（决策速览/DAY 时间轴/费用/结算）保留全部精确数字，一字不动。</p>

  <h2><span class="badge">①</span>大标题与副标题：日期与里程退出文案</h2>
  <p class="sub">改前 = 老板截图里的原文（<code>${esc3(r.rawTitle)}</code> / <code>${esc3(r.rawSub)}</code>）；改后 = 闸门输出（<code>${esc3(r.gTitle)}</code> / <code>${esc3(r.gSub)}</code>）。同一份 DOM，只换文字。</p>
  <div class="row">
    <div class="col"><h3><span class="tag t-bad">改前</span>标题带日期、副标题带日期+里程</h3><div class="phone">${r.beforeHero}</div></div>
    <div class="col"><h3><span class="tag t-good">改后</span>只留画面与强度，无参数</h3><div class="phone">${r.afterHero}</div></div>
  </div>

  <h2><span class="badge">②</span>导语：同一段话，去掉参数后依然通顺</h2>
  <p class="sub">只剥离「参数本身就是独立分句」的部分；嵌在短语中间的参数会让该分句整句丢弃 —— <b>宁可少一句，也不留破句</b>。</p>
  <div class="row">
    <div class="col"><h3><span class="tag t-bad">改前</span>「9月20日，不做室内局…」</h3><div class="phone">${r.beforeLead}</div></div>
    <div class="col"><h3><span class="tag t-good">改后</span>「不做室内局，约在青城后山。」</h3><div class="phone">${r.afterLead}</div></div>
  </div>

  <h2><span class="badge warning warn">③</span>AI 叙事段：整行参数播报直接消失</h2>
  <p class="sub">这是老板截图 ② 的场景：AI 在叙事段末尾播报「9月20日单日往返｜98元/人｜限15人｜4小时车程｜海拔800米」。这类整行参数串在渲染时被丢弃，同时保存进 localStorage 的旧文案也会被兜底（渲染层过闸门，不只落库时过）。</p>
  <div class="row">
    <div class="col"><h3><span class="tag t-bad">改前</span>叙事段末尾挂着参数播报行</h3><div class="phone">${r.narBefore}</div></div>
    <div class="col"><h3><span class="tag t-good">改后</span>只留叙事，参数行消失</h3><div class="phone">${r.narAfter}</div></div>
  </div>

  <h2><span class="badge blue">④</span>闸门逐条实测（数据由闸门本身产出，非手写示例）</h2>
  <div class="card">
    <table class="tb">
      <tr><th style="width:36px">#</th><th>输入（文学层文案）</th><th style="width:190px">识别到的硬参数</th><th>闸门输出</th></tr>
      ${ruleRows}
    </table>
  </div>
  <div class="card">
    <h3 style="margin-top:0">老板可手写字段走「轻量闸门」：只丢参数串，不替作者改句子</h3>
    <p class="sub" style="margin:4px 0 10px">活动名称 / 导语 / 正文段落 / 金句由老板亲自写过 —— 闸门只丢弃「参数播报串」，其余一字不动。</p>
    <table class="tb">
      <tr><th>输入</th><th>输出</th></tr>
      ${ownRows}
    </table>
  </div>

  <h2><span class="badge">⑤</span>事实层一个数字都没动（客户据此决策、下单、核对）</h2>
  <div class="card">
    <div>${factRows}</div>
    <p class="sub" style="margin:12px 0 6px">决策速览（真实渲染）：</p>
    <div class="phone" style="max-width:460px">${r.decisionHtml}</div>
    <p class="sub" style="margin:12px 0 6px">详细行程 DAY 时间轴（真实渲染）：</p>
    <div class="phone" style="max-width:460px">${r.timelineHtml}</div>
  </div>

  <h2>分层边界一览</h2>
  <div class="card">
    <table class="tb">
      <tr><th>层</th><th>包含</th><th>数字处理</th></tr>
      <tr><td>文学层</td><td>标题 / 副标题 / 导语 / 正文段落 / 金句 / 海报标语 / 宣发文案 / 消费叙事（为什么值得去·会体验什么·能得到什么）</td><td>参数一律剥离或丢弃，只保留画面与感受</td></tr>
      <tr><td>事实层</td><td>数据条 / 决策速览 / DAY 时间轴 / 费用说明 / 报名结算 / 会员与营销面板 / 退改条款</td><td>精确数字原样保留</td></tr>
    </table>
  </div>
</div>
</body>
</html>`;
  fs.writeFileSync(path.join(projDir, "v201-sample.html"), html, "utf8");
  console.log("v201-sample.html 已生成");
  console.log("标题:", r.rawTitle, "→", r.gTitle);
  console.log("副标题:", r.rawSub, "→", r.gSub);
  console.log("事实层保留:", r.facts.map((f) => f.k + (f.kept ? "✓" : "✗")).join(" "));
});
