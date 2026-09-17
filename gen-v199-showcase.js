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



// —— epilogue：v199 会员价 / 积分抵现 / 优惠券的真实渲染 ——
const epi = `
state = (typeof loadState === "function") ? loadState() : state;
state.memberMarketing = (typeof defaultMemberMarketing === "function") ? defaultMemberMarketing() : {};
state.points = 2600;
state.pointsLedger = [];
state.coupons = [
  { id: "cp_ok",  title: "会员满 100 减 20", type: "reduce",   threshold: 100, value: 20,  scope: "all",  total: 800, claimed: 156, used: 73, status: "active" },
  { id: "cp_hi",  title: "满 500 减 100",   type: "reduce",   threshold: 500, value: 100, scope: "all",  total: 100, claimed: 1,   used: 0,  status: "active" },
  { id: "cp_gear",title: "老会员 9 折券",   type: "discount", threshold: 0,   value: 90,  scope: "gear", total: 300, claimed: 88,  used: 41, status: "active" }
];
var __b = { id:"v199-demo", type:"徒步", title:"青城后山山脊徒步", place:"青城后山", date:"2026-09-20", dateMD:"9月20日",
  meeting:"天府广场", price:180, limitUnit:"人", limit:15, days:1, childPrice:90,
  photos:[], photoCaptions:[], tags:[], highlights:[], sellingPoints:[], body:[], reviews:[],
  feeInclude:["专业领队","户外保险","往返交通"], feeExclude:["个人消费","装备租赁"],
  itineraryDays:[{label:"一日山脊线",sub:"",items:[{time:"08:00",text:"天府广场集合"},{time:"12:00",text:"路餐补给"}]}],
  departures:[{id:"d1",date:"2026-09-20",dateMD:"9月20日",weekDay:"周日",price:180,status:"open"}],
  coverIndex:0, confirmed:[{key:"services"}],
  useMemberPrice:true, allowPoints:true, allowCoupons:true,
  tierPrices:{ t_normal:180, t_silver:168, t_gold:158, t_black:148 } };
function mk(over){ const o = JSON.parse(JSON.stringify(__b)); return Object.assign(o, over || {}); }

const tier = currentMemberTier();
const ben  = memberBenefitOf(mk(), null);

/* ① 详情页价格展示点：图文长页 & 简洁页 */
state.detailMode = "editorial";
const edHtml = renderActivityEditorial(mk());
state.detailMode = "lean";
const leanHtml = renderActivityPhone(mk());

function grab(html, marker, len) {
  const i = html.indexOf(marker);
  if (i < 0) return "<!-- 未找到 " + marker + " -->";
  const s = html.lastIndexOf("<div", i);
  return html.slice(s >= 0 ? s : i, (s >= 0 ? s : i) + (len || 900));
}
const edFeeBlock   = grab(edHtml, "fee-card", 1200);
const leanFeeBlock = grab(leanHtml, "decision-fee", 1100);
const leanPriceBar = (function () {
  const i = leanHtml.indexOf('class="bottom-bar"');
  return i < 0 ? "" : leanHtml.slice(leanHtml.lastIndexOf("<div", i), i + 420);
})();
const leanCta = (function () {
  const i = leanHtml.indexOf("decision-cta-price");
  return i < 0 ? "" : leanHtml.slice(leanHtml.lastIndexOf("<div", i), i + 380);
})();
const leanMeta = grab(leanHtml, "decision-meta", 900);
const feedCard = (typeof activityPriceHtml === "function") ? activityPriceHtml(mk(), false) : "";

/* ② 防假优惠：档位价全部等于活动价 */
state.points = 2600;
const noBenefit = mk({ tierPrices: { t_normal: 180, t_silver: 180, t_gold: 180, t_black: 180 } });
const noBenefitNote = priceDisplayHtml(noBenefit, null, { bare: true, showRange: false });
const noBenefitFee  = memberMarketingExtrasHtml(noBenefit, 180);
const panelNoBenefit = memberMarketingEditHtml(noBenefit);

/* ③ 报名结算面板（三种组合，展示金额如何逐步下降） */
const cases = [
  { k: "仅会员价",       o: { adults: 1, children: 0, couponId: "",       usePoints: false } },
  { k: "会员价 + 优惠券", o: { adults: 1, children: 0, couponId: "cp_ok",  usePoints: false } },
  { k: "会员价 + 券 + 积分", o: { adults: 1, children: 0, couponId: "cp_ok", usePoints: true } }
];
const settleRows = cases.map(function (c) {
  const bk = orderBreakdown(mk(), c.o);
  return { k: c.k, bk: bk,
    lines: [
      "小计（" + bk.adults + " 成人 × ¥" + bk.unit + "）  ¥" + bk.subtotal,
      bk.memberSaved > 0 ? "会员优惠（原价 ¥" + bk.rawSubtotal + "）  −¥" + bk.memberSaved : null,
      bk.couponDiscount > 0 ? (bk.coupon ? bk.coupon.title : "优惠券") + "  −¥" + bk.couponDiscount : null,
      bk.pointsDiscount > 0 ? "积分抵现 " + bk.pointsUsed + " 积分  −¥" + bk.pointsDiscount : null,
      "应付  ¥" + bk.payable + "　（完成赠 " + bk.pointsEarned + " 积分）"
    ].filter(Boolean)
  };
});
const settlePanel = signupSettleInnerHtml(mk());
const settleCouponEmpty = signupSettleInnerHtml(mk({ price: 50, tierPrices: { t_normal: 50, t_silver: 48, t_gold: 46, t_black: 44 } }));

/* ④ 后台「会员与营销」面板 */
const panel = memberMarketingEditHtml(mk());

/* ⑤ 会员中心（有流水） */
reset: {
  state.points = 2600;
  state.pointsLedger = [];
  grantMemberPoints(165, "报名赠送 · 青城后山山脊徒步", "s1");
  redeemMemberPoints(2600, "积分抵现 · 青城后山山脊徒步", "s1");
  grantMemberPoints(120, "邀请好友 · 成功 1 人", "inv1");
}
const mcHtml = renderMembershipH5();
function grabSection(html, title, len) {
  const i = html.indexOf(title);
  if (i < 0) return "<!-- 未找到 " + title + " -->";
  const s = html.lastIndexOf("<div", i);
  return html.slice(s >= 0 ? s : i, (s >= 0 ? s : i) + (len || 1200));
}
const mcCard = (function () {
  const i = mcHtml.indexOf("mc-card");
  return i < 0 ? "" : mcHtml.slice(mcHtml.lastIndexOf("<div", i), i + 900);
})();
const mcLedger = grabSection(mcHtml, "积分明细", 1400);
state.points = 0; state.pointsLedger = [];
const mcEmpty = grabSection(renderMembershipH5(), "积分明细", 500);

/* ⑥ 积分账户操作的可审计性 */
state.points = 2600; state.pointsLedger = [];
const before = memberPointsBalance();
const spent = redeemMemberPoints(2600, "积分抵现 · 单元验证", "sX");
const blocked = redeemMemberPoints(500, "余额不足验证", "sY");
const balAfterSpend = memberPointsBalance();
const earned = grantMemberPoints(165, "报名赠送 · 单元验证", "sX");
const accountSteps = [
  ["初始余额", before, ""],
  ["抵扣 2600 积分", "实际扣 " + spent, "余额 " + balAfterSpend],
  ["再抵扣 500 积分（余额不足）", "实际扣 " + blocked, "余额 " + balAfterSpend + "（不产生负数）"],
  ["报名赠分 165", "实际加 " + earned, "余额 " + memberPointsBalance()]
];
const ledgerDump = (state.pointsLedger || []).map(function (it) {
  return (it.type === "spend" ? "−" : "+") + it.points + "　" + it.reason + "　ref=" + (it.refId || "—");
});

return { tier: tier ? tier.name : "-", ben: ben,
  edFeeBlock, leanFeeBlock, leanPriceBar, leanCta, leanMeta, feedCard,
  noBenefitNote, noBenefitFee, panelNoBenefit,
  settleRows, settlePanel, settleCouponEmpty, panel,
  mcCard, mcLedger, mcEmpty, accountSteps, ledgerDump,
  ppMemLean: (leanHtml.split("pp-mem").length - 1),
  hasEd: typeof renderActivityEditorial === "function" };
`;

try {
  vm.runInContext(code + "\nglobalThis.__RESULT__ = (async function () {\n  try {\n" + epi + "\n  } catch (e) { return { error: String((e && e.stack) || e) }; }\n})();", ctx, { filename: "spa-bundle.js", timeout: 30000 });
} catch (e) {
  console.error("LOAD ERROR", String((e && e.stack) || e));
  process.exit(1);
}

Promise.resolve(sandbox.__RESULT__).then(function (r) {
  if (r && r.error) { console.error("EPILOGUE ERROR", r.error); process.exit(1); }
  const projDir2 = projDir;
  const styles = fs.readFileSync(path.join(projDir2, "styles.css"), "utf8");
  const shotsDir = "/Users/jckuma/.workbuddy/clipboard-images";
  const shotFile = "clipboard-2026-09-17T05-34-48-918Z-a2ecb331.png";
  function b64(p) { try { return "data:image/png;base64," + fs.readFileSync(p).toString("base64"); } catch (e) { return ""; } }
  const shot = b64(path.join(shotsDir, shotFile));

  const money2 = function (n) { return (Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, ""); };
  const settleTable = r.settleRows.map(function (row) {
    return '<div class="col"><h3>' + row.k + '</h3><div class="kv">' + row.lines.join("<br>") + '</div>'
      + '<div class="big">应付 ¥' + money2(row.bk.payable) + '</div>'
      + '<div class="cap">会员省 ¥' + money2(row.bk.memberSaved) + ' · 券抵 ¥' + money2(row.bk.couponDiscount) + ' · 积分抵 ¥' + money2(row.bk.pointsDiscount) + '</div></div>';
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ClubOS v199 会员价 · 积分抵现 · 优惠券（样例页）</title>
<style>${styles}</style>
<style>
  body { background:#f4f1ea; margin:0; font:14px/1.6 system-ui,"PingFang SC",sans-serif; color:#233; }
  .w { max-width:1080px; margin:0 auto; padding:26px 18px 80px; }
  h1 { font-size:23px; margin:0 0 6px; }
  .lead { color:#7a7468; margin:0 0 24px; }
  h2 { font-size:17px; margin:34px 0 4px; }
  .sub { color:#7a7468; font-size:13px; margin:0 0 14px; }
  .badge { display:inline-block; font:600 12px/1 sans-serif; color:#fff; background:#2e7d5b; padding:4px 9px; border-radius:20px; margin-right:8px; vertical-align:middle; }
  .badge.blue { background:#2b5f8f; } .badge.warn { background:#b4551f; }
  .card { background:#fff; border-radius:14px; box-shadow:0 2px 14px rgba(0,0,0,.06); padding:16px; margin-bottom:14px; }
  .grid2 { display:flex; gap:14px; flex-wrap:wrap; }
  .grid2 > .col { flex:1 1 300px; min-width:270px; background:#fff; border-radius:14px; box-shadow:0 2px 14px rgba(0,0,0,.06); padding:14px; }
  .grid2 h3 { font-size:14px; margin:0 0 8px; }
  .kv { font:12px/1.7 ui-monospace,Menlo,monospace; background:#faf8f3; border:1px solid #ece8de; border-radius:10px; padding:10px 12px; white-space:pre-wrap; word-break:break-all; }
  .big { font:800 24px/1.3 system-ui,sans-serif; color:#DD6B33; margin-top:8px; }
  .cap { font-size:12px; color:#7a7468; }
  .phone { max-width:420px; border:1px solid #e4e0d6; border-radius:12px; overflow:hidden; background:#fff; }
  .phone-l { display:flex; gap:14px; flex-wrap:wrap; }
  .note { font-size:12px; color:#8a8478; padding:6px 2px 0; }
  .shot { width:100%; max-width:520px; display:block; border-radius:10px; }
  .tick { color:#2e7d5b; font-weight:700; }
</style>
</head>
<body>
<div class="w">
  <h1>ClubOS v199 · 会员价 / 积分抵现 / 优惠券 真正落地（样例页）</h1>
  <p class="lead">以下所有区块都是当前代码的真实渲染输出（已内联 styles.css）。老板反馈原文：「会员价格这一套营销包括积分、这些都没有实现。」<br>
  实测根因：会员价只作用于活动基础价且「等于原价时也标会员价」；积分只有数字没有账户与抵扣；优惠券后台能建、报名流程完全不读。下面逐条对照。</p>

  <h2><span class="badge">①</span>会员价现在出现在每一个价格展示点</h2>
  <p class="sub">当前会员：<b>${r.tier}</b>（2600 积分）· 活动价 ¥180 → 会员价 ¥${r.ben.member}（省 ¥${r.ben.savePerUnit}）· 简洁页会员价标记出现 <b>${r.ppMemLean}</b> 处</p>
  <div class="grid2">
    <div class="col"><h3>图文长页 · 费用说明（新增会员价行）</h3><div class="phone">${r.edFeeBlock}</div><div class="note">renderActivityEditorial · fee-card</div></div>
    <div class="col"><h3>简洁报名页 · 费用说明</h3><div class="phone">${r.leanFeeBlock}</div><div class="note">renderActivityPhone · decision-fee</div></div>
  </div>
  <div class="grid2" style="margin-top:14px">
    <div class="col"><h3>决策速览「价格」行</h3><div class="phone">${r.leanMeta}</div><div class="note">同一引擎产出，含等级标签与原价划线</div></div>
    <div class="col"><h3>底部报名栏 + CTA 价格</h3><div class="phone">${r.leanPriceBar}</div><div class="note">CTA：</div><div class="phone" style="margin-top:8px">${r.leanCta}</div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3 style="margin-top:0">C 端列表卡价格</h3><div class="kv">${r.feedCard.replace(/</g, "&lt;")}</div></div>
  <div class="card"><h3 style="margin-top:0">反馈截图（问题现场）</h3>${shot ? '<img class="shot" src="' + shot + '" alt="反馈截图">' : '<div class="note">（截图不可读）</div>'}</div>

  <h2><span class="badge warn">②</span>防「假优惠」：等于原价时不再标会员价</h2>
  <p class="sub">老板截图里「普通会员」档填的价正好等于活动价 ¥180 —— 旧代码仍会给它套上「会员价」字样，客户看到的价格与定价毫无区别。现在 <b>会员价不低于原价就完全不显示会员价</b>，后台同时明确提示。</p>
  <div class="grid2">
    <div class="col"><h3>档位价全等于 ¥180 时的价格展示</h3><div class="kv">${r.noBenefitNote.replace(/</g, "&lt;")}</div><div class="note">无 pp-mem、无划线 —— 不制造虚假优惠</div></div>
    <div class="col"><h3>后台提示</h3><div class="kv">${(r.panelNoBenefit.match(/mm-pv-warn">[^<]*/) || ["（无）"])[0].replace(/</g, "&lt;")}</div><div class="note">面板直接告诉老板「客户在详情页看不到任何会员优惠」</div></div>
  </div>

  <h2><span class="badge">③</span>报名结算：会员价 → 优惠券 → 积分抵现，金额逐步下降</h2>
  <p class="sub">金额全部由 <code>orderBreakdown()</code> 单点计算，页面只负责展示 —— 避免前后端两套算法对不上。</p>
  <div class="grid2">${settleTable}</div>
  <div class="card" style="margin-top:14px"><h3 style="margin-top:0">报名页结算面板（真实渲染）</h3><div class="phone">${r.settlePanel}</div></div>
  <div class="card"><h3 style="margin-top:0">可用券为空时的诚实空态</h3><div class="phone">${r.settleCouponEmpty}</div></div>

  <h2><span class="badge blue">④</span>积分账户：能累积、能抵扣、有上限、不为负、有流水</h2>
  <p class="sub">等级 <code>pointsRate</code> 的单位是「几元赠 1 积分」（金卡 0.8）—— 这一字段此前只存不用，现在真正参与计算。</p>
  <div class="grid2">
    <div class="col"><h3>账户操作逐笔验证</h3><div class="kv">${r.accountSteps.map(function (s) { return s[0] + "　→　" + s[1] + "　" + s[2]; }).join("<br>")}</div></div>
    <div class="col"><h3>积分流水（可审计）</h3><div class="kv">${r.ledgerDump.join("<br>")}</div></div>
  </div>
  <div class="card" style="margin-top:14px"><h3 style="margin-top:0">会员中心 · 积分卡 + 积分明细</h3><div class="phone">${r.mcCard}${r.mcLedger}</div></div>
  <div class="card"><h3 style="margin-top:0">无流水时的诚实空态</h3><div class="phone">${r.mcEmpty}</div></div>

  <h2><span class="badge">⑤</span>后台「会员与营销」：开关 + 规则 + 生效预览</h2>
  <p class="sub">面板不再只有三个开关 —— 直接告诉老板「客户实际看到的价格」「每档省多少」「每 ¥1 累积多少积分」「本活动可用几张券」。</p>
  <div class="card"><div class="phone" style="max-width:640px">${r.panel}</div></div>
</div>
</body>
</html>`;
  fs.writeFileSync(path.join(projDir2, "v199-sample.html"), html, "utf8");
  console.log("v199-sample.html 已生成");
  console.log("等级:", r.tier, "会员价:", r.ben.member, "省:", r.ben.savePerUnit);
  console.log("结算三档:", r.settleRows.map(function (x) { return x.k + "=¥" + x.bk.payable; }).join(", "));
});
