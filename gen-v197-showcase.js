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
const ctx = vm.createContext(sandbox);

// —— epilogue：种入活动 + 图片缓存，渲染三大面板 ——
const epi = `
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : (typeof seedState === "function" ? seedState() : {}));
function mkActivity(over) {
  const base = {
    id: "v197-demo", type: "海岛桨板", title: "秋季彩林徒步 · 龙门山环线", place: "龙门山",
    date: "2026-10-18", dateMD: "10月18日", meeting: "成都天府广场",
    price: 199, limitUnit: "人", limit: 25, days: 2,
    distance: 12, elevation: 1100, difficulty: "中等", season: "秋",
    photos: Array.from({ length: 6 }, (_, i) => "https://example.com/v197-p" + i + ".jpg"),
    photoCaptions: ["刚出林线，风突然大起来"],
    tags: ["赏秋"], highlights: [], sellingPoints: [], body: [], reviews: [],
    feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    includeLeader: true, includeInsurance: true, ageRange: "8-60岁",
    confirmed: [{ key: "services" }, { key: "difficulty" }],
    itineraryDays: [{ label: "成都—龙门山", sub: "", items: [{ time: "08:00", text: "集合出发" }] }],
    departures: [{ id: "d-old-1", date: "2026-09-28", dateMD: "9月28日", weekDay: "周一", price: 228, capacity: null, status: "open", note: "", signups: 2 }],
    gear: [], coverIndex: 0, edTheme: "", pageStyle: "outdoor", audience: []
  };
  return Object.assign(base, over || {});
}
const A = mkActivity();
state.draft = A;
// 图片分析缓存（与真实上传 analyzeImageFocus 同一条写回路径）
if (typeof PHOTO_FOCUS_CACHE !== "undefined" && typeof photoMeta === "function") {
  A.photos.forEach((src, i) => {
    PHOTO_FOCUS_CACHE.set(src, {
      quality_score: 0.88 - i * 0.03,
      orientation: ["landscape", "portrait", "square"][i % 3],
      category: "风光", subjects: ["山脊", "林木", "晨雾"], emotion: "开阔",
      recommended_use: ["cover", "hero", "story", "detail", "full", "gallery"],
      safe_text_area: ["top-left", "bottom-right", "center"][i % 3]
    });
  });
}
state.editorDepBatch = { start: "2026-09-17", end: "2026-10-01", freq: "daily", capacity: 20, price: 199 };
const depHtml = (typeof departuresEditHtml === "function") ? departuresEditHtml(A) : "<!-- departuresEditHtml 不可用 -->";
const visHtml = (typeof visualTabHtml === "function") ? visualTabHtml(A) : "<!-- visualTabHtml 不可用 -->";
const pv = (typeof depBatchPreview === "function") ? depBatchPreview(A) : { text: "", count: 0 };
// 整体视觉切换：渲染同一详情页在 snow / island 两种主题下的结果
const pageSnow = (typeof renderActivityPhone === "function") ? renderActivityPhone(mkActivity({ type: "海岛桨板", place: "三亚", edTheme: "snow", body: [{ h: "上午", p: "桨板教学与出海" }, { h: "下午", p: "自由浮潜" }] })) : "<!-- renderActivityPhone 不可用 -->";
const pageIsland = (typeof renderActivityPhone === "function") ? renderActivityPhone(mkActivity({ type: "海岛桨板", place: "三亚", edTheme: "island", body: [{ h: "上午", p: "桨板教学与出海" }, { h: "下午", p: "自由浮潜" }] })) : "<!-- renderActivityPhone 不可用 -->";
return { dep: depHtml, vis: visHtml, pvText: pv.text, pvCount: pv.count, pageSnow: pageSnow, pageIsland: pageIsland,
         hasDep: typeof departuresEditHtml === "function", hasVis: typeof visualTabHtml === "function", hasPage: typeof renderActivityPhone === "function" };
`;

try {
  vm.runInContext(code + "\nglobalThis.__RESULT__ = (async function () {\n  try {\n" + epi + "\n  } catch (e) { return { error: String((e && e.stack) || e) }; }\n})();", ctx, { filename: "spa-bundle.js", timeout: 30000 });
} catch (e) {
  console.error("LOAD ERROR", String((e && e.stack) || e)); process.exit(1);
}

Promise.resolve(sandbox.__RESULT__).then((r) => {
  if (r && r.error) { console.error("EPILOGUE ERROR", r.error); process.exit(1); }
  const outDir = projDir;
  const styles = fs.readFileSync(path.join(projDir, "styles.css"), "utf8");

  // ===== 样例页 v197-sample.html =====
  const sample = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClubOS v197 编辑器重做 · 样例页</title>
<style>${styles}</style>
<style>
  body { background:#f4f1ea; }
  .show-wrap { max-width: 960px; margin: 0 auto; padding: 28px 18px 80px; }
  .show-h { font: 600 22px/1.3 system-ui,"PingFang SC",sans-serif; color:#233; margin: 36px 0 6px; }
  .show-sub { color:#7a7468; font: 14px/1.6 system-ui,sans-serif; margin: 0 0 14px; }
  .show-card { background:#fff; border-radius:14px; box-shadow:0 2px 14px rgba(0,0,0,.06); padding:18px; margin-bottom:18px; }
  .badge { display:inline-block; font:600 12px/1 sans-serif; color:#fff; background:#2e7d5b; padding:4px 9px; border-radius:20px; vertical-align:middle; margin-right:8px; }
  .pv-note { font:600 14px/1.4 system-ui,sans-serif; color:#1f6f4a; background:#eaf6ef; border:1px solid #cfe9d8; border-radius:10px; padding:10px 12px; margin:10px 0; }
  .theme-demo { display:flex; gap:14px; flex-wrap:wrap; }
  .theme-demo > div { flex:1 1 320px; min-width:280px; }
  .theme-cap { font:600 13px/1 system-ui,sans-serif; color:#555; margin:0 0 6px; }
  .frame { border:1px solid #e4e0d6; border-radius:12px; overflow:hidden; background:#fff; }
  .frame-note { font:12px/1.5 system-ui,sans-serif; color:#8a8478; padding:6px 10px; background:#faf8f3; border-top:1px solid #ece8de; }
</style>
</head>
<body>
<div class="show-wrap">
  <h1 class="show-h">ClubOS v197 · 后台编辑器三处重做（样例页）</h1>
  <p class="show-sub">以下面板由线上代码（v197）真实渲染输出，已内联 styles.css，所见即所得。版本校验：APP_VER=${JSON.stringify(r.pvCount)}（预览团期数占位，详见各区块）。</p>

  <h2 class="show-h"><span class="badge">①</span>团期批量生成</h2>
  <p class="show-sub">反馈原文：「团期可以不可以批量选，比如9月17日至10月1日，每天都可以发团，每团限20人」。下方为真实 <code>departuresEditHtml</code> 输出，含日期区间 + 节奏三选 + 周几 + 限人数 + 价格 + 实时预览 + 生成按钮。</p>
  <div class="show-card">${r.dep}</div>
  <div class="pv-note">实时预览（<code>depBatchPreview</code>，配置 9/17–10/1 每天、限20人、¥199）：<br>${r.pvText}</div>

  <h2 class="show-h"><span class="badge">②</span>视觉呈现 Tab 卡片化</h2>
  <p class="show-sub">反馈原文：「视觉显现（视觉呈现 Tab）UI 太差」。下方为真实 <code>visualTabHtml</code> 输出：整体视觉五主题卡 + 每张图一张分析卡（质量分 / 中文 chips / 用途全中文）+ 封面大图 + 页面结构大纲。</p>
  <div class="show-card">${r.vis}</div>

  <h2 class="show-h"><span class="badge">③</span>整体视觉可切换</h2>
  <p class="show-sub">反馈原文：「整视也不能换」。下面对比同一详情页在「雪境(snow)」与「海岛(island)」两种主题下的渲染（类 <code>ed-theme-snow</code> / <code>ed-theme-island</code> 已打在根/阅读栏/抽屉节点），证明整站配色主题可一键切换。</p>
  <div class="theme-demo">
    <div><p class="theme-cap">雪境 snow</p><div class="frame">${r.pageSnow}</div><div class="frame-note">renderActivityPhone(edTheme:"snow")</div></div>
    <div><p class="theme-cap">海岛 island</p><div class="frame">${r.pageIsland}</div><div class="frame-note">renderActivityPhone(edTheme:"island")</div></div>
  </div>
</div>
</body>
</html>`;
  fs.writeFileSync(path.join(outDir, "v197-sample.html"), sample, "utf8");

  // ===== 对比页 v197-compare.html（改前改后截图并排）=====
  const shots = {
    before: path.join("/tmp", "v197-before-full.png"),
    after: path.join("/tmp", "v197-after-mediafix.png"),
    liveVisual: path.join("/tmp", "v197-live-visual.png"),
    livePrice: path.join("/tmp", "v197-live-price.png")
  };
  function b64(p) {
    try { return "data:image/png;base64," + fs.readFileSync(p).toString("base64"); }
    catch (e) { return ""; }
  }
  const cmp = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClubOS v197 编辑器重做 · 改前改后对比</title>
<style>
  body { background:#f4f1ea; margin:0; font-family:system-ui,"PingFang SC",sans-serif; color:#233; }
  .cmp-wrap { max-width:1180px; margin:0 auto; padding:28px 18px 80px; }
  h1 { font:600 22px/1.3 system-ui,sans-serif; margin:0 0 4px; }
  .lead { color:#7a7468; font:14px/1.6 system-ui,sans-serif; margin:0 0 22px; }
  .row { display:flex; gap:16px; margin-bottom:26px; flex-wrap:wrap; }
  .col { flex:1 1 0; min-width:320px; }
  .col h3 { font:600 15px/1.2 system-ui,sans-serif; margin:0 0 8px; }
  .col .tag { display:inline-block; font:600 12px/1 sans-serif; color:#fff; padding:4px 9px; border-radius:20px; margin-right:8px; }
  .tag.before { background:#b4543a; } .tag.after { background:#2e7d5b; }
  .col img { width:100%; border-radius:12px; border:1px solid #e4e0d6; display:block; background:#fff; }
  .cap { font:12px/1.5 system-ui,sans-serif; color:#8a8478; margin-top:6px; }
  .feat { background:#fff; border-radius:14px; padding:14px 16px; margin:0 0 26px; box-shadow:0 2px 14px rgba(0,0,0,.05); }
  .feat b { color:#1f6f4a; }
</style>
</head>
<body>
<div class="cmp-wrap">
  <h1>ClubOS v197 · 后台编辑器三处重做（改前 / 改后对比）</h1>
  <p class="lead">左为 v197 之前的编辑器面板截图，右为 v197 上线后的真实页面截图。三处重做对应三条用户反馈。</p>

  <div class="feat">
    <p style="margin:0 0 6px;"><b>① 团期批量生成</b> — 支持「起始日~结束日 + 节奏（每天/每周几/每隔N天）+ 每团限人数 + 价格」一键批量生成团期，实时预览「将新增 N 个团期 · 每团限 X 人」，已有日期自动跳过。</p>
  </div>
  <div class="row">
    <div class="col"><h3><span class="tag before">改前</span>编辑器面板（旧）</h3>${shots.before && fs.existsSync(shots.before) ? `<img src="${b64(shots.before)}">` : "<p class='cap'>（缺改前截图）</p>"}<p class="cap">v197-before-full.png</p></div>
    <div class="col"><h3><span class="tag after">改后</span>实时页面（新）</h3>${shots.after && fs.existsSync(shots.after) ? `<img src="${b64(shots.after)}">` : "<p class='cap'>（缺改后截图）</p>"}<p class="cap">v197-after-mediafix.png</p></div>
  </div>

  <div class="feat">
    <p style="margin:0 0 6px;"><b>② 视觉呈现 Tab 卡片化</b> — 整体视觉五主题卡 + 每张图独立分析卡（质量分 / 构图·主体·情绪中文 chips / 用途全中文）+ 封面大图 + 页面结构大纲。</p>
  </div>
  <div class="row">
    <div class="col"><h3><span class="tag after">改后</span>视觉呈现 Tab（真机）</h3>${shots.liveVisual && fs.existsSync(shots.liveVisual) ? `<img src="${b64(shots.liveVisual)}">` : "<p class='cap'>（缺截图）</p>"}<p class="cap">v197-live-visual.png</p></div>
    <div class="col"><h3><span class="tag after">改后</span>团期/价格面板（真机）</h3>${shots.livePrice && fs.existsSync(shots.livePrice) ? `<img src="${b64(shots.livePrice)}">` : "<p class='cap'>（缺截图）</p>"}<p class="cap">v197-live-price.png</p></div>
  </div>
</div>
</body>
</html>`;
  fs.writeFileSync(path.join(outDir, "v197-compare.html"), cmp, "utf8");

  console.log("OK: hasDep=%s hasVis=%s hasPage=%s pvCount=%s", r.hasDep, r.hasVis, r.hasPage, r.pvCount);
  console.log("WROTE v197-sample.html (" + sample.length + " bytes)  v197-compare.html (" + cmp.length + " bytes)");
}).catch((e) => { console.error("RUN ERROR", String((e && e.stack) || e)); process.exit(1); });
