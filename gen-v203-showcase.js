#!/usr/bin/env node
/* gen-v203-showcase.js — 渲染 v203「所有宣传文案都不出现日期/年龄」改前/改后真实对比，生成样例页。
   复用 spa-smoke.js 的 vm 加载器（剔除 boot.js），本进程自带 fs 可直接写盘。

   对照设计：
     改前 = versions/publish-pre-v203.js（= 线上 v202 的 publish.js：旧模板 + 没有闸门）
     改后 = src/publish.js（源头断供 + gatePublishOut）

   ★ 关键：两侧都是**真跑出来的产物**，不是手写的说明文字。
     「改前」之所以脏，是因为旧模板把 f.date / f.distance / f.ageRange 直接填进文案，
     且没有任何闸门；「改后」干净，来自两条：模板不再塞日期 + 出口统一过闸门。

   用法：node gen-v203-showcase.js <projDir>   （产物 v203-sample.html 不进 git） */
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

function mkA(over) {
  var a = blankActivity();
  Object.assign(a, {
    id: "v203-demo", title: "青城后山一日徒步", type: "徒步", place: "青城后山",
    date: "2026年9月20日", dateMD: "9月20日", days: 1,
    price: 98, limit: 15, limitUnit: "人", ageRange: "16—55岁",
    difficulty: "中等", distance: 25, elevation: 1200,
    meeting: "天府广场", meetTime: "07:30", returnTime: "19:00",
    audience: ["亲子", "成人"], status: "招募中", signups: 6,
    insurance: "含户外意外险", transport: "大巴往返",
    leaderName: "阿泽", leaderYears: "8年",
    includedServices: ["领队费", "保险费"], gear: [{ name: "登山鞋" }, { name: "外套" }],
    feeInclude: ["领队费", "保险费"]
  }, over || {});
  return a;
}
var A = mkA();
state.activities = [A];
var M = buildContentMaster(A, []);
var DIR = { structure: ["为什么值得去", "来了会体验什么", "参加完你能得到什么", "适不适合我", "真实信息", "怎么报名"],
            angle: "把周末交给山风", hook: "山里的风比空调舒服", family: "diary", variant: 1 };

var raw = fallbackRecruitCopy(A, M, DIR);
var hasGate = (typeof gatePublishOut === "function");
var out = hasGate ? gatePublishOut(JSON.parse(JSON.stringify(raw)), "recruit") : raw;

/* 标签行判定（事实层）—— 与闸门同构但独立书写，用来区分「文案层参数」与「信息行参数」 */
function nonLabel(t) {
  return String(t == null ? "" : t).split(/\\n+/).map(function (line) {
    return splitLiterarySentences(line).filter(function (s) {
      var x = s.trim(); if (!x) return false;
      var b = x.replace(/^[^\\u4e00-\\u9fa5A-Za-z0-9]+/, "");
      return !/^[^\\s：:，。；、]{1,8}\\s*[：:]/.test(b);
    }).join("");
  }).join("\\n");
}
function fld(key, v) {
  var s = String(v == null ? "" : v);
  var stripped = s.replace(/<[^>]*>/g, " ");
  return { key: key, v: stripped, lit: factBroadcastHits(nonLabel(stripped)) };
}
var fields = [
  fld("公众号 · 标题", out.gzh.title),
  fld("公众号 · 副标题", out.gzh.subtitle),
  fld("公众号 · 摘要", out.gzh.summary),
  fld("公众号 · CTA", out.gzh.cta),
  fld("小红书 · 标题候选（第 4 条）", (out.xhs.titles || [])[3] || (out.xhs.titles || [])[0] || ""),
  fld("小红书 · 正文", out.xhs.body),
  fld("小红书 · 封面短句", out.xhs.coverText),
  fld("朋友圈 · 预热版", (out.moments || {}).warm),
  fld("朋友圈 · 正式招募版", (out.moments || {}).formal),
  fld("朋友圈 · 最后招募版", (out.moments || {}).last),
  fld("微信群 · 简短说明", (out.wechat || {}).brief),
  fld("微信群 · 招募版", (out.wechat || {}).recruit),
  fld("口播 · 60 秒", (out.voice || {}).s60),
  fld("海报 · 氛围标语", (out.poster || {}).sub)
];
(out.gzh.sections || []).forEach(function (s, i) {
  var isFact = /信息|详情|费用|时间|地点|出行|交通|集合|须知|怎么去/.test(String(s.h || ""));
  if (isFact) return;
  fields.push(fld("公众号 · 正文段落【" + s.h + "】", s.html));
});
var dirty = fields.filter(function (f) { return f.lit.length; }).map(function (f) { return f.key; });

/* 事实层：这些必须带精确数字（没带就是被误伤了） */
var facts = [
  { key: "信息表（时间/集合/海拔/名额）", v: (out.gzh.info || []).map(function (r) { return r.k + " " + r.v; }).join("；") },
  { key: "费用行", v: out.gzh.fee },
  { key: "小红书信息行", v: String(out.xhs.body || "").split("\\n").filter(function (l) { return /[：:]/.test(l); }).join(" / ") },
  { key: "微信群信息行", v: String((out.wechat || {}).recruit || "").split("\\n").filter(function (l) { return /[：:]/.test(l); }).join(" / ") },
  { key: "海报信息位", v: "时间 " + (out.poster || {}).time + " ｜ " + (out.poster || {}).price + " ｜ " + ((out.poster || {}).points || []).join("，") }
];

return { hasGate: hasGate, fields: fields, facts: facts, dirty: dirty };
`;

function run(publishOverride) {
  const built = makeCtx(publishOverride);
  vm.runInContext(built.code + "\nglobalThis.__RESULT__ = (async function () {\n  try {\n" + EPI + "\n  } catch (e) { return { error: String((e && e.stack) || e) }; }\n})();", built.ctx, { filename: "spa-bundle.js", timeout: 60000 });
  return Promise.resolve(built.sandbox.__RESULT__);
}

const OLD_PUBLISH = path.join(projDir, "versions", "publish-pre-v203.js");
const oldSrc = fs.existsSync(OLD_PUBLISH) ? fs.readFileSync(OLD_PUBLISH, "utf8") : null;

/* 高亮：把参数命中词标红（用于"改前"那一栏） */
function hl(text, hits) {
  let esc = String(text == null ? "" : text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const uniq = Array.from(new Set((hits || []).filter(Boolean))).sort((a, b) => b.length - a.length);
  uniq.forEach((h) => {
    const e = h.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    esc = esc.replace(new RegExp(e, "g"), '<mark>' + e + "</mark>");
  });
  return esc;
}

Promise.all([run(null), oldSrc ? run(oldSrc) : Promise.resolve(null)]).then(function (r) {
  const [now, before] = r;
  if (now && now.error) { console.error("EPILOGUE ERROR", now.error); process.exit(1); }
  if (before && before.error) console.warn("改前对照渲染失败（跳过）:", before.error.slice(0, 200));

  const beforeMap = {};
  if (before && before.fields) before.fields.forEach((f) => { beforeMap[f.key] = f; });

  const row = (f) => {
    const b = beforeMap[f.key];
    const cell = (o, bad) => o
      ? `<pre class="txt ${bad ? "bad" : "good"}">${hl(o.v, bad ? o.lit : [])}</pre>`
      : `<pre class="txt na">（此版本无该字段）</pre>`;
    const tag = (o) => {
      if (!o) return "";
      return o.lit.length
        ? `<span class="badge b-bad">文案层参数 ×${o.lit.length}</span>`
        : `<span class="badge b-good">干净</span>`;
    };
    return `<tr>
      <td class="k">${f.key}</td>
      <td class="c">${cell(b, true)}${tag(b)}</td>
      <td class="c">${cell(f, false)}${tag(f)}</td>
    </tr>`;
  };

  const factRows = (now.facts || []).map((x) => `<tr><td class="k">${x.key}</td><td colspan="2">${String(x.v || "（空）").replace(/</g, "&lt;")}</td></tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClubOS v203 · 所有宣传文案不出现日期/年龄（改前 / 改后）</title>
<style>
  body{background:#0d0f0d;color:#e8e6e0;font:15px/1.75 -apple-system,"PingFang SC",system-ui,sans-serif;margin:0;padding:28px 20px 72px}
  .wrap{max-width:1240px;margin:0 auto}
  h1{font-size:23px;margin:0 0 6px}.lead{color:#a8a49a;margin:0 0 22px}
  h2{font-size:17px;margin:34px 0 12px;padding-left:10px;border-left:3px solid #d8b26a}
  table{border-collapse:collapse;width:100%;font-size:14px}
  th,td{border:1px solid #2b302a;padding:9px 11px;text-align:left;vertical-align:top}
  th{background:#1b1f1a;color:#c9c5bb;font-weight:600;position:sticky;top:0}
  td.k{width:190px;color:#cfcabd;font-weight:600}
  td.c{width:auto}
  code{background:#20241e;padding:1px 5px;border-radius:4px;font-size:13px;color:#d8c69a}
  pre.txt{margin:0 0 6px;font-size:13px;white-space:pre-wrap;word-break:break-word;font-family:inherit}
  pre.bad{color:#ffb3a3}pre.good{color:#cfe9cf}pre.na{color:#6d6a63}
  mark{background:#5a2a2a;color:#ffd9d0;padding:1px 3px;border-radius:3px}
  .badge{font-size:12px;padding:1px 8px;border-radius:20px;display:inline-block}
  .b-bad{background:#3a1c1c;color:#ff9a8a;border:1px solid #5a2a2a}
  .b-good{background:#1c2f1c;color:#a6e0a6;border:1px solid #2f5233}
  .hl{color:#a6e0a6;font-weight:600}
  .note{background:#151814;border:1px solid #262b24;border-radius:10px;padding:14px 18px;color:#b9b5ab;font-size:13.5px;margin:18px 0}
</style></head><body><div class="wrap">
  <h1>ClubOS v203 · 所有宣传文案都不出现日期 / 年龄</h1>
  <p class="lead">同一场活动（青城后山一日徒步 · 9月20日 · ¥98/人 · 限15人 · 16—55岁 · 25公里 · 海拔1200米），
  同一份数据，只换 <code>publish.js</code>。<br>
  左列 = <code>versions/publish-pre-v203.js</code>（线上 v202 的模板 + 没有闸门）；右列 = 本轮产物。
  <span class="hl">两侧都是真跑出来的文案，不是手写说明。</span></p>

  <div class="note">
    <b>分层判据（与 v201 一致，本轮把它结构化）</b><br>
    · <b>事实层</b> = 「带标签的信息」→ 原样保留：「🗓 时间：9月20日」「· 费用：¥98/人」「活动类型：徒步」，
      以及 gzh 里标题命中「信息 / 报名 / 费用 / 时间 / 地点」的章节整段、海报的时间与价格位。<br>
    · <b>文学层</b> = 其余一切句子（标题 / 副标题 / 摘要 / 正文段落 / 朋友圈 / 口播 / 海报标语）→ 过闸门：
      句中参数剥离、参数播报句丢弃。
  </div>

  <h2>一、文学层：改前（红底 = 参数）→ 改后</h2>
  <table>
    <tr><th>字段</th><th>改前 · v202（旧模板，无闸门）</th><th>改后 · v203</th></tr>
    ${(now.fields || []).map(row).join("")}
  </table>

  <h2>二、事实层：这些精确数字<b>必须</b>留着（闸门不许误伤）</h2>
  <table>
    <tr><th>位置</th><th colspan="2">内容（逐字保留）</th></tr>
    ${factRows}
  </table>

  <h2>三、本轮还做了两件事</h2>
  <table>
    <tr><th>问题</th><th>处理</th></tr>
    <tr><td>「费用98一人」这种没有「元」字的写法，参数闸门完全漏网</td><td>price 规则改为「引导词 + 数字」即可命中（同时保留「数字+元/块」「¥+数字」两条老分支，且要求引导词 —— 否则「长 25」会被误判成价格）</td></tr>
    <tr><td>公众号「怎么报名」章节与「真实信息」渲染同一张信息表，一字不差地重复</td><td>信息表只留在信息章节；报名章节改为给报名方式</td></tr>
    <tr><td>摘要「青城后山一日徒步，在青城后山。」把活动名里的地名再说一遍</td><td>活动名已含地点时不再重复</td></tr>
  </table>

  <h2>四、出口统一：AI 与本地回退都挡</h2>
  <div class="note">
    · <code>genRecruit()</code> / <code>genRecap()</code> 在 <b>return 前</b>统一调 <code>gatePublishOut()</code>，
      AI 生成与本地回退两条来源走同一个出口。<br>
    · <code>recruitResult()</code> / <code>recapResult()</code> 渲染前再兜一次 ——
      老板浏览器 localStorage 里可能存着闸门上线<b>之前</b>生成的脏文案。<br>
    · AI prompt 侧同步加了硬约束（此前反而<b>要求</b>微信群文案「包含时间、地点、价格」），
      单渠道重生成的 5 个 style 提示词也补齐了禁令。<br>
    · 本轮文学层参数命中：改前 <b>${before ? (before.dirty || []).length : "?"}</b> 处 → 改后 <b>${(now.dirty || []).length}</b> 处。
  </div>

  <p class="lead">线上版本 <code>v203</code>；全量契约 <b>39 个 epilogue 全绿</b>（新增 <code>case-v203-publish-copy</code> 56 项），
  含反向验证：把 <code>core.js</code> / <code>publish.js</code> 分别换回改前版本，契约立刻变红。</p>
</div></body></html>`;

  fs.writeFileSync(path.join(projDir, "v203-sample.html"), html, "utf8");
  console.log("v203-sample.html 已生成");
  console.log("改前 文案层违规字段数:", before ? (before.dirty || []).length : "（未跑对照）");
  console.log("改后 文案层违规字段数:", (now.dirty || []).length);
  if (before) console.log("改前 违规字段:", (before.dirty || []).join(" / ").slice(0, 300));
  (now.fields || []).slice(0, 6).forEach((f) => console.log("  [改后]", f.key, "|", f.v.replace(/\s+/g, " ").slice(0, 80)));
});

