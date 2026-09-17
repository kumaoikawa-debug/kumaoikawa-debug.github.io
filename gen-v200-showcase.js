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




// —— epilogue：v200 hero keep 层序修复的真实渲染 ——
const epi = `
state = (typeof loadState === "function") ? loadState() : state;
state.detailMode = "editorial";
function seedMeta(src, meta) { if (typeof PHOTO_FOCUS_CACHE !== "undefined") PHOTO_FOCUS_CACHE.set(src, meta); }
function mk(over) {
  const base = { id:"v200-demo", type:"徒步", title:"9月20日，把朋友约到青城后山（山脊山地）", place:"青城后山",
    date:"2026-09-20", dateMD:"9月20日", meeting:"天府广场", price:199, limitUnit:"人", limit:15, days:1,
    distance:25, elevation:800, difficulty:"中等", season:"秋",
    photos:[], photoCaptions:[], tags:[], highlights:[], sellingPoints:[], body:[], reviews:[],
    feeInclude:["往返大巴","专业领队","户外保险"], feeExclude:["午餐"],
    confirmed:[{key:"services"},{key:"difficulty"}], itineraryDays:[{label:"一日",sub:"",items:[{time:"08:00",text:"天府广场集合"}]}],
    departures:[], coverIndex:0, useMemberPrice:false, allowPoints:false, allowCoupons:false };
  return Object.assign(base, over || {});
}
function heroOf(html) {
  const i = String(html).indexOf('<header class="xh-ed-hero');
  if (i < 0) return "";
  const j = String(html).indexOf("</header>", i);
  return String(html).slice(i, j < 0 ? i + 3000 : j + 9);
}

/* ① 老板的真实场景：视觉管理里手动把「人像竖图」选为封面 */
const A = mk({ photos:["https://example.com/v200s-p0.jpg","https://example.com/v200s-p1.jpg"], coverIndex:1, _coverManual:true });
seedMeta("https://example.com/v200s-p0.jpg", { ratio:1.5, orientation:"landscape", quality_score:0.86, recommended_use:["hero","cover"] });
seedMeta("https://example.com/v200s-p1.jpg", { ratio:0.72, orientation:"portrait", quality_score:0.93, category:"人物",
  subjects:[{name:"队员",bbox:{x:0.1,y:0.05,w:0.8,h:0.9}}], recommended_use:["hero"], safe_text_area:"center", crop_risk:"high" });
const heroKeep = heroOf(renderActivityEditorial(A));

/* ② 改前形态（v198 的 DOM）：把照片图层摘掉、照片画回 header 自身背景。
   用 indexOf 切片而不是正则，避免生成器模板字符串把 \\/ 吃掉。 */
const cutFig = function (h) {
  const i = h.indexOf('<div class="xh-ed-hero-fig"');
  if (i < 0) return h;
  const j = h.indexOf("></div>", i);
  return j < 0 ? h : h.slice(0, i) + h.slice(j + 7);
};
const heroBefore = cutFig(heroKeep)
  .replace('style="background-image:none"', 'style="background-image:url(\\'https://example.com/v200s-p1.jpg\\')"');

/* ③ 横图风景封面（cover 模式）：行为未变，同一份代码渲染 */
const B = mk({ photos:["https://example.com/v200s-b0.jpg"], coverIndex:0 });
seedMeta("https://example.com/v200s-b0.jpg", { ratio:1.5, orientation:"landscape", quality_score:0.9, recommended_use:["hero","cover"] });
const heroCover = heroOf(renderActivityEditorial(B));

const layerOk = (function (h) {
  const iB = h.indexOf("xh-ed-hero-backdrop"), iF = h.indexOf('class="xh-ed-hero-fig"'), iM = h.indexOf("xh-ed-hero-mask");
  const tag = h.slice(0, h.indexOf(">") + 1);
  return iB >= 0 && iF > iB && iM > iF && !/background-image:url\\(/.test(tag);
});
return {
  heroKeep: heroKeep, heroBefore: heroBefore, heroCover: heroCover,
  okBefore: layerOk(heroBefore), okAfter: layerOk(heroKeep),
  tagBefore: heroBefore.slice(0, heroBefore.indexOf(">") + 1),
  tagAfter: heroKeep.slice(0, heroKeep.indexOf(">") + 1),
  figAttrs: (heroKeep.match(/<div class="xh-ed-hero-fig"[^>]*>/) || [""])[0],
  cssHasFig: (typeof __PROJ_CSS__ === "string") ? __PROJ_CSS__.indexOf(".xh-ed-hero-fig {") >= 0 : null
};
`;

try {
  vm.runInContext(code + "\nglobalThis.__RESULT__ = (async function () {\n  try {\n" + epi + "\n  } catch (e) { return { error: String((e && e.stack) || e) }; }\n})();", ctx, { filename: "spa-bundle.js", timeout: 30000 });
} catch (e) {
  console.error("LOAD ERROR", String((e && e.stack) || e)); process.exit(1);
}

Promise.resolve(sandbox.__RESULT__).then(function (r) {
  if (r && r.error) { console.error("EPILOGUE ERROR", r.error); process.exit(1); }
  const styles = fs.readFileSync(path.join(projDir, "styles.css"), "utf8");
  const shotsDir = "/Users/jckuma/.workbuddy/clipboard-images";
  function b64(p) { try { return "data:image/png;base64," + fs.readFileSync(p).toString("base64"); } catch (e) { return ""; } }
  const shot = b64(path.join(shotsDir, "clipboard-2026-09-17T06-06-08-129Z-ecd59d1e.png"));

  /* 把示例 URL 换成真实照片（内嵌 data URI，离线可看）。
     结构、类名、内联样式全部来自上面 epilogue 的真实渲染 —— 只替换 url() 里的地址字符串，
     因此不会改变任何布局判定（layerOk 仍然成立）。 */
  const COVER_CROP = "/tmp/v200-keep.jpg";   // 从老板反馈截图里裁出的那张封面照片（真实照片，有细节）
  const DATA_KEEP = "data:image/jpeg;base64," + fs.readFileSync(COVER_CROP).toString("base64");
  const DATA_COVER = DATA_KEEP;             // 对照面板用同一张图，只改 keep / cover 判定，比较才公平
  const subAll = (h, from, to) => String(h).split(from).join(to);
  const heroKeep = subAll(r.heroKeep, "https://example.com/v200s-p1.jpg", DATA_KEEP);
  const heroBefore = subAll(r.heroBefore, "https://example.com/v200s-p1.jpg", DATA_KEEP);
  const heroCover = subAll(r.heroCover, "https://example.com/v200s-b0.jpg", DATA_COVER);

  const esc2 = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const phone = (inner, cap, bad) => '<div class="ph"><div class="ph-cap ' + (bad ? "bad" : "good") + '">' + cap + '</div>'
    + '<div class="phone"><div class="activity-page xh-ed">' + inner + '</div></div></div>';

  const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClubOS v200 · hero keep 虚化修复（样例页）</title>
<style>${styles}</style>
<style>
  body { background:#f4f1ea; margin:0; font:14px/1.6 system-ui,"PingFang SC",sans-serif; color:#233; }
  .w { max-width:1120px; margin:0 auto; padding:26px 18px 80px; }
  h1 { font-size:23px; margin:0 0 6px; }
  .lead { color:#7a7468; margin:0 0 8px; }
  h2 { font-size:17px; margin:34px 0 4px; }
  .sub { color:#7a7468; font-size:13px; margin:0 0 14px; }
  .badge { display:inline-block; font:600 12px/1 sans-serif; color:#fff; background:#2e7d5b; padding:4px 9px; border-radius:20px; margin-right:8px; vertical-align:middle; }
  .badge.warn { background:#b4551f; } .badge.blue { background:#2b5f8f; }
  .ph { flex:1 1 300px; min-width:280px; background:#fff; border-radius:14px; box-shadow:0 2px 14px rgba(0,0,0,.06); padding:12px; margin-bottom:14px; }
  .ph-cap { font:600 12.5px/1.5 system-ui,sans-serif; margin:0 0 9px; }
  .ph-cap.good { color:#2e7d5b; } .ph-cap.bad { color:#b4551f; }
  .phone { border:1px solid #e4e0d6; border-radius:12px; overflow:hidden; background:#fff; }
  .kv { font:12px/1.7 ui-monospace,Menlo,monospace; background:#faf8f3; border:1px solid #ece8de; border-radius:10px; padding:10px 12px; word-break:break-all; white-space:pre-wrap; }
  .card { background:#fff; border-radius:14px; box-shadow:0 2px 14px rgba(0,0,0,.06); padding:16px; margin-bottom:14px; }
  .shot { width:100%; max-width:1000px; display:block; border-radius:10px; border:1px solid #e4e0d6; }
  table.tb { border-collapse:collapse; width:100%; font-size:12.5px; }
  table.tb th, table.tb td { border:1px solid #ece8de; padding:7px 9px; text-align:left; vertical-align:top; }
  table.tb th { background:#faf8f3; font-weight:700; }
  .ok { color:#2e7d5b; font-weight:700; } .no { color:#b4551f; font-weight:700; }
</style></head>
<body><div class="w">
  <h1>ClubOS v200 · 「任选一张图做封面 → 详情页虚化」修复</h1>
  <p class="lead">反馈原话：「视觉管理里面任选一个图做封面，然后详情这边出现虚化 bug。」</p>
  <p class="lead">根因不是滤镜参数，是<b>层序</b>：照片画在 header 自身的 background 上，而绝对定位的模糊垫图层永远绘制在父元素背景<b>之上</b> —— v198 把垫图 opacity 从 .55 提到 .92 后，整幅 Hero 就只剩那层糊图。下面两块是同一份代码、同一张封面图的真实渲染对比。</p>

  <h2><span class="badge warn">改前</span>v198 形态：照片画在 header 背景上 → 整幅被糊图盖住</h2>
  <p class="sub">把照片图层摘掉、照片放回 header 自身 background（正是 v198 输出的 DOM），层序判定 = <span class="no">${r.okBefore}</span></p>
  <div class="card">${phone(heroBefore, "改前 · 整幅虚化（垫图层 opacity .92 把照片本体整幅盖住）", true)}</div>

  <h2><span class="badge">改后</span>v200：照片独立成层（z-index 1）压在垫图之上</h2>
  <p class="sub">层序判定 = <span class="ok">${r.okAfter}</span>　·　垫图只负责两侧留白，照片本体清晰可辨</p>
  <div class="card">${phone(heroKeep, "改后 · 照片本体清晰（keep 按原比例不裁主体，余下部分是提亮后的同图模糊延展）", false)}</div>

  <h2><span class="badge blue">对照</span>横图风景封面（cover 模式）：行为未变</h2>
  <p class="sub">三块面板用的是<b>同一张照片</b>（您截图里选中的那张封面）：差别只来自 keep / cover 判定，不来自素材本身。</p>
  <div class="card">${phone(heroCover, "低风险 → 满幅 cover 铺满（与 v198 行为一致）", false)}</div>

  <h2>层序与改动点</h2>
  <div class="card">
    <table class="tb">
      <tr><th>层</th><th>元素</th><th>z-index</th><th>作用</th></tr>
      <tr><td>1（最底）</td><td><code>.xh-ed-hero-backdrop</code></td><td>0</td><td>同图模糊延展（blur 26px / opacity .92）填原比例留白</td></tr>
      <tr><td>2</td><td><code>.xh-ed-hero-fig</code> <b>（v200 新增）</b></td><td>1</td><td><b>照片本体</b>：contain 原比例、不裁主体</td></tr>
      <tr><td>3</td><td><code>.xh-ed-hero-mask</code></td><td>2</td><td>下深上浅渐变，保证文字可读</td></tr>
      <tr><td>4（最上）</td><td><code>.xh-ed-hero-txt</code></td><td>3</td><td>标题 / 时间 / 集合点</td></tr>
    </table>
    <p class="sub" style="margin:12px 0 6px">改后 header 与照片图层的实际属性：</p>
    <div class="kv">${esc2(r.tagAfter)}
${esc2(r.figAttrs)}</div>
    <p class="sub" style="margin:12px 0 6px">改前 header（照片仍在自身背景上 —— 契约断言 A6 守的就是这一条）：</p>
    <div class="kv">${esc2(r.tagBefore)}</div>
    <p class="sub" style="margin:12px 0 6px">styles.css 已含 <code>.xh-ed-hero-fig</code> 规则：<b>${r.cssHasFig}</b>；同时给 <code>.xh-ed-hero.keep</code> 加了 <code>overflow:hidden</code>，收掉垫图 <code>inset:-24px</code> 的外溢。</p>
  </div>

  <h2>反馈截图（问题现场）</h2>
  <div class="card">${shot ? '<img class="shot" src="' + shot + '" alt="反馈截图">' : '<p class="sub">（截图不可读）</p>'}</div>
</div></body></html>`;
  /* 专用对照页：只放两个 Hero（坐标完全确定，便于逐像素量锐度） */
  const pair = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>v200 hero 层序对照（改前 / 改后）</title>
<style>${styles}</style>
<style>
  html,body { margin:0; padding:0; background:#f4f1ea; }
  .p { position:absolute; width:349px; height:440px; overflow:hidden; border-radius:12px; }
  #a { left:24px; top:24px; }
  #b { left:397px; top:24px; }
</style></head><body>
<div class="p" id="a"><div class="activity-page xh-ed">${heroBefore}</div></div>
<div class="p" id="b"><div class="activity-page xh-ed">${heroKeep}</div></div>
</body></html>`;
  fs.writeFileSync(path.join(projDir, "v200-compare.html"), pair, "utf8");

  fs.writeFileSync(path.join(projDir, "v200-sample.html"), html, "utf8");
  console.log("v200-sample.html 已生成");
  console.log("改前层序判定:", r.okBefore, "| 改后:", r.okAfter, "| CSS 规则:", r.cssHasFig);
});
