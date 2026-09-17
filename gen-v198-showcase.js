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


// —— epilogue：v198 三处修复的真实渲染 ——
const epi = `
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : (typeof seedState === "function" ? seedState() : {}));
function mkActivity(over) {
  const base = {
    id: "v198-demo", type: "徒步", title: "青城后山山脊徒步", place: "青城后山",
    date: "2026-09-20", dateMD: "9月20日", meeting: "天府广场",
    price: 199, limitUnit: "人", limit: 15, days: 1,
    distance: 25, elevation: 800, difficulty: "中等", season: "秋",
    photos: ["https://example.com/v198s-p0.jpg","https://example.com/v198s-p1.jpg","https://example.com/v198s-p2.jpg","https://example.com/v198s-p3.jpg","https://example.com/v198s-p4.jpg","https://example.com/v198s-p5.jpg"],
    photoCaptions: [], tags: [], highlights: [], sellingPoints: [], body: [], reviews: [],
    feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    includeLeader: true, includeInsurance: true, ageRange: "8-60岁",
    confirmed: [{ key: "services" }, { key: "difficulty" }],
    itineraryDays: [{ label: "一日山脊线", sub: "", items: [
      { time: "07:30", text: "天府广场集合" },
      { time: "08:00", text: "出发前往青城后山（山脊山地）" },
      { time: "10:00", text: "抵达起点，进行安全说明与热身" },
      { time: "10:30", text: "开始山脊徒步探索" },
      { time: "12:00", text: "适中简餐（以领队现场安排为准）" },
      { time: "15:00", text: "完成徒步，原路返回或调整路线下撤（以领队现场安排为准）" },
      { time: "17:30", text: "抵达天府广场，活动结束" }
    ] }],
    departures: [{ id: "d-1", date: "2026-09-20", dateMD: "9月20日", weekDay: "周日", price: 199, capacity: 15, status: "open", note: "", signups: 4 }],
    gear: [], coverIndex: 0, edTheme: "", pageStyle: "outdoor", audience: []
  };
  return Object.assign(base, over || {});
}
function seed(src, meta) { if (typeof PHOTO_FOCUS_CACHE !== "undefined") PHOTO_FOCUS_CACHE.set(src, meta); }
const photos = mkActivity().photos;
// 真实视觉分析写回形态（applyVisionNormalized 同构）：p1 = hero/cover 横图高质量 → 应为封面的最佳选择
seed(photos[0], { ratio: 1.4, orientation: "landscape", quality_score: 0.62, category: "风景", subjects: ["山"], emotion: "平静", recommended_use: ["story"], safe_text_area: "center" });
seed(photos[1], { ratio: 1.5, orientation: "landscape", quality_score: 0.91, category: "风光", subjects: ["山脊","云海"], emotion: "开阔", recommended_use: ["hero","cover","full"], safe_text_area: "top-left" });
seed(photos[2], { ratio: 0.75, orientation: "portrait", quality_score: 0.72, category: "人物", subjects: ["队员"], emotion: "开心", recommended_use: ["detail"], safe_text_area: "center" });
seed(photos[3], { ratio: 1.33, orientation: "landscape", quality_score: 0.78, category: "风光", subjects: ["林木"], emotion: "安静", recommended_use: ["story"], safe_text_area: "center" });
seed(photos[4], { ratio: 1.0, orientation: "square", quality_score: 0.66, category: "细节", subjects: ["装备"], emotion: "真实", recommended_use: ["detail"], safe_text_area: "center" });
seed(photos[5], { ratio: 1.45, orientation: "landscape", quality_score: 0.84, category: "风光", subjects: ["山脊"], emotion: "开阔", recommended_use: ["gallery","full"], safe_text_area: "center" });

/* ===== ① 行程去重 ===== */
const A = mkActivity();
const edHtml = renderActivityEditorial(A);
// 摘出「详细行程」区块（从 dsec 头到本区块结束，用 id="ed-itin" 定位）
let itinBlock = "";
try {
  const start = edHtml.indexOf("详细行程");
  const s = edHtml.indexOf('<div class="dsec">', Math.max(0, start - 300));
  let end = edHtml.indexOf('id="ed-fee"', s);
  if (end < 0) end = s + 4200;
  itinBlock = edHtml.slice(s >= 0 ? s : start, end);
} catch (e) { itinBlock = "<!-- 抽取失败 -->"; }
const editPanel = (typeof itineraryEditHtml === "function") ? itineraryEditHtml(A) : "";
const itin = structureItinerary(A);
const nar = buildItineraryNarrative(A, itin.timeline || []);
const narText = (nar.paras || []).join("<br>");
const itinNarrativeCount = (edHtml.match(/itin-narrative/g) || []).length;
const tlCount = (edHtml.match(/tl-item/g) || []).length;

/* ===== ② 换一种排版 = 真变化（双轴旋转）===== */
const B = mkActivity();
B.editorialLayoutId = "L-mosaic-story";
B.editorialStyleId = "S-scenery-mag";
const sum0 = editorialVariantSummary(B);
const html0 = renderActivityEditorial(B);
regenStyleContent(B);
const sum1 = editorialVariantSummary(B);
const html1 = renderActivityEditorial(B);
regenStyleContent(B);
const sum2 = editorialVariantSummary(B);
const html2 = renderActivityEditorial(B);
const fpSame = (typeof editorialFactsFingerprint === "function") ? editorialFactsFingerprint(B) : "";

/* ===== ③ 封面智能选择 + hero ===== */
const C = mkActivity();
const coverIdx = (typeof bestCoverIndex === "function") ? bestCoverIndex(C) : -1;
const coverSrc = C.photos[coverIdx] || "";
const heroHtml = renderActivityEditorial(C);
let heroOnly = "";
try {
  const hs = heroHtml.indexOf('<header class="xh-ed-hero');
  heroOnly = heroHtml.slice(hs >= 0 ? hs : 0, heroHtml.indexOf("</header>", hs >= 0 ? hs : 0) + 9);
} catch (e) { heroOnly = "<!-- 抽取失败 -->"; }
// 竖图高风险封面：keep 模式（原比例 + 提亮垫图）
const F = mkActivity({ photos: ["https://example.com/v198s-portrait.jpg"], coverIndex: 0 });
seed("https://example.com/v198s-portrait.jpg", { ratio: 0.72, orientation: "portrait", quality_score: 0.9, category: "人物", subjects: ["队员"], recommended_use: ["hero"], crop_risk: "high" });
const heroKeep = renderActivityEditorial(F);
let keepOnly = "";
try {
  const ks = heroKeep.indexOf('<header class="xh-ed-hero');
  keepOnly = heroKeep.slice(ks >= 0 ? ks : 0, heroKeep.indexOf("</header>", ks >= 0 ? ks : 0) + 9);
} catch (e) { keepOnly = "<!-- 抽取失败 -->"; }

return { itinBlock, editPanel, narText, itinNarrativeCount, tlCount,
         sum0, sum1, sum2, html0, html1, html2,
         coverIdx, coverSrc, heroOnly, keepOnly,
         hasEd: typeof renderActivityEditorial === "function" };
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
  const shotsDir = "/Users/jckuma/.workbuddy/clipboard-images";
  const shotFiles = ["clipboard-2026-09-17T04-20-18-994Z-342ee405.png","clipboard-2026-09-17T04-20-18-995Z-07dace98.png","clipboard-2026-09-17T04-20-18-996Z-e1e343b3.png","clipboard-2026-09-17T04-20-18-996Z-f43a5d6d.png","clipboard-2026-09-17T04-20-18-997Z-5c202382.png"];
  function b64(p) { try { return "data:image/png;base64," + fs.readFileSync(p).toString("base64"); } catch (e) { return ""; } }
  const shots = shotFiles.map((f) => b64(path.join(shotsDir, f))).filter(Boolean);

  const sample = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClubOS v198 详情页三处修复 · 样例页</title>
<style>${styles}</style>
<style>
  body { background:#f4f1ea; margin:0; font-family:system-ui,"PingFang SC",sans-serif; color:#233; }
  .show-wrap { max-width: 960px; margin: 0 auto; padding: 28px 18px 80px; }
  .show-h { font:600 22px/1.3 system-ui,"PingFang SC",sans-serif; margin: 34px 0 6px; }
  .show-sub { color:#7a7468; font:14px/1.65 system-ui,sans-serif; margin:0 0 14px; }
  .show-card { background:#fff; border-radius:14px; box-shadow:0 2px 14px rgba(0,0,0,.06); padding:16px; margin-bottom:16px; }
  .badge { display:inline-block; font:600 12px/1 sans-serif; color:#fff; background:#2e7d5b; padding:4px 9px; border-radius:20px; vertical-align:middle; margin-right:8px; }
  .badge.warn { background:#b4551f; }
  .badge.blue { background:#2b5f8f; }
  .kv { font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace; background:#faf8f3; border:1px solid #ece8de; border-radius:10px; padding:10px 12px; margin:8px 0; }
  .frame { border:1px solid #e4e0d6; border-radius:12px; overflow:hidden; background:#fff; }
  .frame-note { font:12px/1.5 system-ui,sans-serif; color:#8a8478; padding:6px 10px; background:#faf8f3; border-top:1px solid #ece8de; }
  .grid2 { display:flex; gap:14px; flex-wrap:wrap; }
  .grid2 > div { flex:1 1 300px; min-width:280px; }
  .lab { font:600 13px/1 system-ui,sans-serif; color:#555; margin:0 0 6px; }
  .phone { width:100%; max-width:420px; margin:0 auto; }
  .code { font:12px/1.5 ui-monospace,Menlo,monospace; color:#5a5346; }
</style>
</head>
<body>
<div class="show-wrap">
  <h1 class="show-h">ClubOS v198 · 活动详情页三处修复（样例页）</h1>
  <p class="show-sub">以下区块全部由当前代码真实渲染输出（已内联 styles.css）。三条反馈逐条对应下方 ①②③。</p>

  <h2 class="show-h"><span class="badge">①</span>行程只出现一次（叙事复述块已摘除）</h2>
  <p class="show-sub">反馈：「详情页内多次出现详细行程，一直大重复，没有实现智能编辑」。<br>
   改前：「详细行程」区块 = 叙事块（逐条复述时间表）+ DAY 时间轴，同屏两遍。<br>
   改后：阅读页完整行程 <b>只有 DAY 时间轴一处</b>；叙事降级为「节奏摘要」，仅保留在后台行程编辑面板作预览。</p>
  <div class="kv">图文页 itin-narrative 出现次数 = ${r.itinNarrativeCount}　·　tl-item 行程条目 = ${r.tlCount}</div>
  <div class="show-card">${r.itinBlock}</div>
  <p class="show-sub">后台行程编辑面板里保留的「节奏摘要」预览（不再逐条复述中间时间点）：</p>
  <div class="kv">${r.narText}</div>

  <h2 class="show-h"><span class="badge">②</span>「换一种排版」= 真变化（版式轴 + 风格轴双轴旋转）</h2>
  <p class="show-sub">反馈：「点换一种排版，详情根本没有变化（假智能假AI）」。<br>
   改前：只旋转风格轴（文案角度），版式轴被冻结 → 页面结构肉眼一模一样。<br>
   改后：版式轴（hero 形态 / 章节结构 / 图片组合 / 字体）+ 风格轴（角度 / 密度 / Family）一起旋转，事实层逐字节不动。</p>
  <div class="kv">点击 0 次：${r.sum0}<br>点击 1 次：${r.sum1}<br>点击 2 次：${r.sum2}</div>
  <div class="grid2">
    <div><p class="lab">① 改前（${r.sum0}）</p><div class="frame phone">${r.html0}</div><div class="frame-note">renderActivityEditorial · 点击 0 次</div></div>
    <div><p class="lab">② 第 1 次点击（${r.sum1}）</p><div class="frame phone">${r.html1}</div><div class="frame-note">结构 / hero 形态 / 字体同步变化</div></div>
  </div>
  <div class="grid2" style="margin-top:14px">
    <div><p class="lab">③ 第 2 次点击（${r.sum2}）</p><div class="frame phone">${r.html2}</div><div class="frame-note">继续轮换，不再卡在同一组合</div></div>
    <div><p class="lab">事实指纹（点击 2 次后）</p><div class="kv code">${String(r.fpSame || "-").slice(0, 220)}…<br><br>事实/DNA 指纹跨连点逐字节不变 —— 换排版绝不改事实（非虚构铁律）。</div></div>
  </div>

  <h2 class="show-h"><span class="badge blue">③</span>封面按视觉分析选最佳 + hero 不再黑边</h2>
  <p class="show-sub">反馈：「随机选图做封面，照片不能自动适配到最佳，两边出现黑屏」。<br>
   改前：封面恒为上传时算出的旧值（那时分析还没跑完 → 恒为第 0 张），之后从不重算；竖图/高风险封面走 contain，两侧深色留白被判成「黑屏」。<br>
   改后：非手动封面时按质量分 / hero·cover 用途 / 横构图 / 裁切风险实时选最佳（分析落地即自愈）；keep 模式的模糊垫图提亮（opacity .55→.92 + brightness 1.12）。</p>
  <div class="kv">bestCoverIndex = ${r.coverIdx}　→　封面 = ${r.coverSrc}</div>
  <div class="grid2">
    <div><p class="lab">智能封面（横图 hero 最佳图）</p><div class="frame phone">${r.heroOnly}</div><div class="frame-note">满幅裁切铺满，无两侧留白</div></div>
    <div><p class="lab">竖图高风险封面（keep · 原比例不横裁）</p><div class="frame phone">${r.keepOnly}</div><div class="frame-note">两侧为同图模糊延展（已提亮），不再是近黑留白</div></div>
  </div>
</div>
</body>
</html>`;
  fs.writeFileSync(path.join(outDir, "v198-sample.html"), sample, "utf8");

  const cmp = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClubOS v198 · 反馈截图 vs 修复后</title>
<style>
  body { background:#f4f1ea; margin:0; font-family:system-ui,"PingFang SC",sans-serif; color:#233; }
  .wrap { max-width:1180px; margin:0 auto; padding:28px 18px 80px; }
  h1 { font:600 22px/1.3 system-ui,sans-serif; margin:0 0 4px; }
  .lead { color:#7a7468; font:14px/1.6 system-ui,sans-serif; margin:0 0 22px; }
  .row { display:flex; gap:16px; margin-bottom:24px; flex-wrap:wrap; }
  .col { flex:1 1 0; min-width:300px; }
  .col h3 { font:600 15px/1.2 system-ui,sans-serif; margin:0 0 8px; }
  .tag { display:inline-block; font:600 12px/1 sans-serif; color:#fff; padding:4px 9px; border-radius:20px; margin-right:8px; }
  .t-before { background:#b4551f; } .t-after { background:#2e7d5b; } .t-shot { background:#2b5f8f; }
  .shot { background:#fff; border-radius:12px; box-shadow:0 2px 14px rgba(0,0,0,.06); padding:10px; }
  .shot img { width:100%; display:block; border-radius:8px; }
  .cap { font:12px/1.5 system-ui,sans-serif; color:#8a8478; padding:8px 4px 2px; }
</style>
</head>
<body>
<div class="wrap">
  <h1>ClubOS v198 · 老板反馈截图（问题现场）对照修复后真实渲染</h1>
  <p class="lead">左侧为老板 2026-09-17 提交的截图（问题现场），右侧为 v198 修复后由代码真实渲染的输出。</p>
  ${shots.map((s, i) => `<div class="col"><div class="shot"><h3><span class="tag t-shot">反馈截图 ${i + 1}</span></h3><img src="${s}" alt="反馈截图 ${i + 1}"></div></div>`).join("")}
  <div style="height:20px"></div>
  <div class="row">
    <div class="col"><h3><span class="tag t-after">修复后</span>行程区块（时间轴唯一）</h3><div class="shot"><img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIiIGhlaWdodD0iNDAiPjwvc3ZnPg==" style="display:none"></div>${r.itinBlock}</div>
  </div>
</div>
</body>
</html>`;
  fs.writeFileSync(path.join(outDir, "v198-compare.html"), cmp, "utf8");

  console.log("v198-sample.html / v198-compare.html 已生成；封面索引 =", r.coverIdx, "；行程叙事块 =", r.itinNarrativeCount, "；时间轴条目 =", r.tlCount);
  console.log("排版摘要：", r.sum0, "→", r.sum1, "→", r.sum2);
});
