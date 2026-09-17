#!/usr/bin/env node
/* gen-v202-showcase.js — 渲染 v202「参与人群单一真源」改前/改后真实对比，生成样例页。
   复用 spa-smoke.js 的 vm 加载器（剔除 boot.js），本进程自带 fs 可直接写盘。

   对照设计（四格）：
     ① 改前 v201：填了「亲子、成人」 → 「适合谁」里没有人群（野键 a.targetAudience 恒空）
     ② 改后 v202：填了「亲子、成人」 → 「适合谁」出现「亲子、成人，都能找到自己的步频。」
     ③ 改后 v202：填「公司团建」     → 跟着变（证明是真的读这个字段）
     ④ 改后 v202：留空               → 不出现（不虚构人群）

   用法：node gen-v202-showcase.js <projDir>   （产物 v202-sample.html 不进 git） */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const projDir = process.argv[2] || ".";
const srcDir = path.join(projDir, "src");

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

/* publishOverride：非空时用这份源码替换 src/publish.js（用于「改前」对照） */
function makeCtx(publishOverride) {
  let code = "";
  for (const f of files) {
    const src = (f === "publish.js" && publishOverride) ? publishOverride : fs.readFileSync(path.join(srcDir, f), "utf8");
    code += "\n;/* ==== " + f + " ==== */\n" + src;
  }
  const fakeDoc = el();
  fakeDoc.body = el(); fakeDoc.head = el(); fakeDoc.documentElement = el();
  fakeDoc.createElement = () => el(); fakeDoc.createElementNS = () => el();
  const cache = new Map();
  const once = (key) => { if (!cache.has(key)) cache.set(key, el()); return cache.get(key); };
  fakeDoc.getElementById = (id) => once("#" + id);
  fakeDoc.querySelector = (sel) => once(String(sel));
  fakeDoc.cookie = "";
  const store = {};
  const sandbox = {
    console, document: fakeDoc,
    navigator: { userAgent: "node-showcase", clipboard: { writeText() { return Promise.resolve(); } } },
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
  return { ctx: vm.createContext(sandbox), sandbox, code };
}

const EPI = `
state = (typeof loadState === "function") ? loadState() : state;
state.detailMode = "editorial";

function mk(over) {
  var base = {
    id: "v202-demo", type: "徒步", title: "青城后山山脊徒步", place: "青城后山",
    date: "2026-09-20", dateMD: "9月20日", meeting: "天府广场",
    price: 199, limitUnit: "人", limit: 15, days: 1,
    distance: 25, elevation: 800, difficulty: "中等", season: "秋",
    photos: ["https://example.com/s0.jpg", "https://example.com/s1.jpg", "https://example.com/s2.jpg"],
    photoCaptions: [], tags: [], highlights: [], sellingPoints: [], body: [], reviews: [],
    feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    includeLeader: true, includeInsurance: true, ageRange: "8-60岁",
    confirmed: [{ key: "services" }, { key: "difficulty" }],
    itineraryDays: [{ label: "一日山脊线", sub: "", items: [
      { time: "07:30", text: "天府广场集合" },
      { time: "12:00", text: "适中简餐" },
      { time: "17:30", text: "抵达天府广场，活动结束" }
    ] }],
    departures: [], gear: [], coverIndex: 0, edTheme: "", pageStyle: "outdoor", audience: []
  };
  return Object.assign(base, over || {});
}
function strip(h) {
  return String(h || "").replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim();
}
function fitSecOf(a) {
  state.draft = JSON.parse(JSON.stringify(a));
  var h = renderActivityEditorial(a);
  var i = h.indexOf('data-sec="fit"');
  if (i < 0) return { html: "", txt: "", found: false };
  var start = h.lastIndexOf("<section", i);
  var end = h.indexOf("</section>", i);
  var seg = h.slice(start, end < 0 ? h.length : end + 10);
  return { html: seg, txt: strip(seg), found: true };
}
var AEmpty = mk({ id: "v202-empty", audience: [] });
var ATwo = mk({ id: "v202-two", audience: ["亲子", "成人"] });
var ATeam = mk({ id: "v202-team", audience: ["公司团建"] });
var f1 = fitSecOf(ATwo), f2 = fitSecOf(ATeam), f3 = fitSecOf(AEmpty);
var hasFn = (typeof activityAudienceText === "function");
return {
  fine: f1, team: f2, empty: f3,
  audTxt: hasFn ? [activityAudienceText(AEmpty), activityAudienceText(ATwo), activityAudienceText(ATeam)] : ["(无该函数)", "", ""],
  hasFn: hasFn
};
`;

function run(publishOverride) {
  const built = makeCtx(publishOverride);
  vm.runInContext(built.code + "\nglobalThis.__RESULT__ = (async function () {\n  try {\n" + EPI + "\n  } catch (e) { return { error: String((e && e.stack) || e) }; }\n})();", built.ctx, { filename: "spa-bundle.js", timeout: 60000 });
  return Promise.resolve(built.sandbox.__RESULT__);
}

const OLD_PUBLISH = path.join(projDir, "versions", "publish-pre-v202.js");
const oldSrc = fs.existsSync(OLD_PUBLISH) ? fs.readFileSync(OLD_PUBLISH, "utf8") : null;

Promise.all([run(null), oldSrc ? run(oldSrc) : Promise.resolve(null)]).then(function (r) {
  const [now, before] = r;
  if (now && now.error) { console.error("EPILOGUE ERROR", now.error); process.exit(1); }
  if (before && before.error) console.warn("改前对照渲染失败（跳过）:", before.error.slice(0, 200));
  const styles = fs.readFileSync(path.join(projDir, "styles.css"), "utf8");
  const pane = (title, sub, sec, tone) => `
    <div class="pane t-${tone}">
      <div class="pane-h">${title}<span class="pane-s">${sub}</span></div>
      <div class="phone"><div class="activity-page"><div class="xh-ed">${sec && sec.found ? sec.html : '<p class="miss">未渲染出「适合谁」章节</p>'}</div></div></div>
      <pre class="txt">${(sec && sec.txt) ? sec.txt.replace(/</g, "&lt;") : "（无）"}</pre>
    </div>`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClubOS v202 · 参与人群单一真源（改前 / 改后）</title>
<style>${styles}</style>
<style>
  body{background:#0d0f0d;color:#e8e6e0;font:15px/1.7 -apple-system,"PingFang SC",system-ui,sans-serif;margin:0;padding:28px 20px 72px}
  .wrap{max-width:1180px;margin:0 auto}
  h1{font-size:23px;margin:0 0 6px}.lead{color:#a8a49a;margin:0 0 22px}
  h2{font-size:17px;margin:34px 0 10px;padding-left:10px;border-left:3px solid #d8b26a}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}
  .pane{background:#151814;border:1px solid #262b24;border-radius:12px;padding:12px;overflow:hidden}
  .pane-h{font-weight:600;margin-bottom:8px;font-size:14px}
  .pane-s{display:block;color:#8f8b81;font-weight:400;font-size:12.5px;margin-top:2px}
  .pane.t-bad{border-color:#5a2a2a}.pane.t-bad .pane-h{color:#ff9a8a}
  .pane.t-good{border-color:#2f5233}.pane.t-good .pane-h{color:#a6e0a6}
  .pane.t-plain{border-color:#3b3f37}
  .phone{background:#111;border-radius:10px;max-height:330px;overflow:auto}
  .miss{color:#c98b5a}
  .txt{margin:10px 0 0;font-size:12.5px;color:#9a968c;white-space:pre-wrap;word-break:break-all;max-height:120px;overflow:auto}
  table{border-collapse:collapse;width:100%;font-size:14px}
  th,td{border:1px solid #2b302a;padding:8px 10px;text-align:left;vertical-align:top}
  th{background:#1b1f1a;color:#c9c5bb;font-weight:600}
  code{background:#20241e;padding:1px 5px;border-radius:4px;font-size:13px;color:#d8c69a}
  .hl{color:#a6e0a6;font-weight:600}
</style></head><body><div class="wrap">
  <h1>ClubOS v202 · 参与人群单一真源</h1>
  <p class="lead">同一份活动数据、同一个渲染函数，只改「参与人群」一个字段。<br>
  根因：<code>a.targetAudience</code> 是野键（全仓 0 个写入点），老板填的是 <code>a.audience</code>（数组，编辑器 <code>data-bind="audience"</code>）。</p>

  <h2>「适合谁」章节 · 改前 / 改后</h2>
  <div class="grid">
    ${before ? pane("改前 · v201", "参与人群 = 亲子、成人（填了也没用）", before.fine, "bad") : ""}
    ${pane("改后 · v202", "参与人群 = 亲子、成人", now.fine, "good")}
    ${pane("改后 · v202（换值）", "参与人群 = 公司团建", now.team, "good")}
    ${pane("改后 · v202（留空）", "参与人群 = 未填写", now.empty, "plain")}
  </div>

  <h2>为什么</h2>
  <table>
    <tr><th>字段</th><th>谁在写</th><th>谁在读</th><th>结果</th></tr>
    <tr><td><code>a.audience</code>（数组）</td><td>老板：编辑器「参与人群」输入框（顿号分隔）</td><td>v202 前：只用于事实行 / DNA 派生</td><td>—</td></tr>
    <tr><td><code>a.targetAudience</code>（字符串）</td><td class="hl">没人写（全仓 0 个写入点）</td><td>v201：<code>editorialFacts().audience</code> + 「适合谁」补充句</td><td class="hl">恒为空 → 静默失效</td></tr>
    <tr><td><code>activityAudienceText(a)</code></td><td>—（v202 新增）</td><td>唯一读取入口</td><td>数组→顿号串，空则空串（不回落占位词）</td></tr>
  </table>

  <h2>本轮第二个坑：内容包会把入参整段顶掉</h2>
  <table>
    <tr><th>阶段</th><th>做法</th><th>结果</th></tr>
    <tr><td>只改字段名</td><td>把补充句塞进 <code>fitLines</code>（= <code>pkPick()</code> 的入参）</td><td class="hl">仍然不出现</td></tr>
    <tr><td>v202 正确做法</td><td><code>make()</code> 返回章节对象 → 追加到 <code>fitSec.paras</code></td><td class="hl">出现（见上图）</td></tr>
  </table>
  <p class="lead" style="margin-top:10px">原因：<code>buildEditorialOutline</code> 的「内容包优先」选择器
  <code>pkPick()</code> 在 <code>pk.paras[key]</code> 有内容时整段返回包内容
  （<code>editorialStylePackOf</code> 懒种子，<code>pk.paras.fit</code> 是角度化文案），
  塞进入参等于交给包覆盖。<br>通用规律：<span class="hl">要往「由内容包/模板驱动的章节」里补东西，必须改章节定稿后的对象，不能改喂进去的入参。</span></p>

  <h2>字段读数</h2>
  <table>
    <tr><th>活动</th><th>activityAudienceText()</th></tr>
    <tr><td>未填写</td><td><code>${JSON.stringify(now.audTxt[0])}</code></td></tr>
    <tr><td>亲子、成人</td><td><code>${JSON.stringify(now.audTxt[1])}</code></td></tr>
    <tr><td>公司团建</td><td><code>${JSON.stringify(now.audTxt[2])}</code></td></tr>
  </table>
  <p class="lead" style="margin-top:10px">改前对照使用 <code>versions/publish-pre-v202.js</code>（其余模块与线上一致），
  因此左右两格的差异只来自本轮改动。线上版本 <code>v202</code>，全量 38 个 epilogue 全绿。</p>
</div></body></html>`;
  fs.writeFileSync(path.join(projDir, "v202-sample.html"), html, "utf8");
  console.log("v202-sample.html 已生成");
  console.log("改前 适合谁:", before && before.fine ? before.fine.txt.slice(0, 90) : "（未跑）");
  console.log("改后 适合谁:", now.fine.txt.slice(0, 120));
  console.log("换值 适合谁:", now.team.txt.slice(0, 120));
  console.log("留空 适合谁:", now.empty.txt.slice(0, 120));
  console.log("activityAudienceText:", JSON.stringify(now.audTxt));
});
