/* case-v213-honest-price.epilogue.js
   ClubOS v213「诚实价格」回归契约。

   起因（M4 30 场压测抓到的既有缺陷）：
     a.price = 0（价格没填）时，页面把 0 当成真金额印出来 ——
       · CTA 块      `<div class="xh-ed-cta-price">¥0<small>/人</small></div>`
       · 悬浮目录条  `<div class="xh-ed-dock-price">¥0<small>/人</small></div>`
       · 单团期条    `<div class="dep-single-price">¥0<small>/人</small></div>`
       · 手机版 / C 端列表卡 / 报名页 hero 同样出 `¥0`
     根因：priceBaseOf 只判 `!= null`，0 是合法金额 → 一路传到展示层；
     而多数列表用的是 `a.price ? "¥" + a.price : "详询"`，于是 0 被吃掉、
     但 `"免费"` 这种非金额字符串又被拼成「¥免费」—— 同一类毛病两种表现。

     但 priceBaseOf / effectiveUnitPrice 是**结算真源**（0 在那里合法），不能改；
     所以只加一层「展示口径」归一，并把列表/标签/团期条的文案收敛到一个真源。

   本文件分七组断言：
     §A priceDisplayBaseOf 归一（同时证明结算口径没被改）
     §B priceUnpricedTextOf / priceTextOf 诚实文案（详询 / 价格待定 / 免费）
     §C 全部出口 + 图文长页 / 手机版 / 回退路径都不再出现「¥0」
     §D 正数价格与会员价链路零回归（含防假优惠、未定价不许冒会员价）
     §E 结算真源未被改动（priceBaseOf / effectiveUnitPrice / orderBreakdown 对 0 不变）
     §F 团期未定价：展示归一到「详询」，但 data-price 仍是结算原值
     §G 价格待定 / 免费 两种非数字价格不被拼成「¥免费」

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v213-honest-price.epilogue.js
   注意：epilogue 必须裸顶层 return；state 只能用 loadState()（本 bundle 没有 initState）。 */
state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h || "").indexOf(s) >= 0;

function mkActivity(over) {
  const base = {
    id: "v213-" + Math.random().toString(36).slice(2, 7),
    type: "徒步", title: "青城后山山脊徒步", place: "青城后山",
    date: "2026-09-20", dateMD: "9月20日", meeting: "天府广场",
    price: 180, limitUnit: "人", limit: 15, days: 1,
    photos: [], photoCaptions: [], tags: [], highlights: [], sellingPoints: [], body: [], reviews: [],
    feeInclude: ["专业领队", "户外保险"], feeExclude: ["个人消费"],
    itineraryDays: [{ label: "一日", sub: "", items: [{ time: "08:00", text: "集合出发" }] }],
    useMemberPrice: false, allowPoints: true, allowCoupons: true,
    tierPrices: {}, departures: [], coverIndex: 0, confirmed: [{ key: "services" }],
  };
  return Object.assign(base, over || {});
}
/* ★currentMemberTier() 由 state.points 推导（2600 → 金卡会员），
   所以想验会员价必须先把积分给上 —— 否则 member == base，hasBenefit 恒 false。 */
function resetState(points) {
  state.memberMarketing = (typeof defaultMemberMarketing === "function") ? defaultMemberMarketing() : {};
  state.points = points == null ? 0 : points;
  state.pointsLedger = [];
  state.coupons = [];
  state.detailMode = "editorial";
  state.activities = [];
}
function pageOf(a) {
  const prev = state.activities;
  let html = "";
  try { state.activities = [a]; html = renderActivityEditorial(a); } catch (e) { html = "THROW:" + e.message; }
  state.activities = prev;
  return html;
}
function signupOf(a) {
  const prev = state.activities;
  let html = "";
  try { state.activities = [a]; html = renderSignupPage(a.id); } catch (e) { html = "THROW:" + e.message; }
  state.activities = prev;
  return html;
}
/* 整页里每一处 ¥ 的上下文（便于失败时定位） */
function yenCtx(html) {
  const out = []; let i = -1;
  while ((i = String(html).indexOf("¥", i + 1)) >= 0) out.push(String(html).slice(Math.max(0, i - 60), i + 24).replace(/\s+/g, " "));
  return out;
}
const mkDep = (id, md, wd, price) => ({ id: id, date: md, dateMD: md, weekDay: wd, price: price, status: "open" });

let dbg = {};
try {
  if (typeof priceDisplayBaseOf !== "function") throw new Error("诚实价格层未加载：priceDisplayBaseOf 缺失");
  if (typeof priceUnpricedTextOf !== "function") throw new Error("诚实价格层未加载：priceUnpricedTextOf 缺失");
  if (typeof priceTextOf !== "function") throw new Error("诚实价格层未加载：priceTextOf 缺失");

  /* ================= §A 展示口径归一（结算口径不动） ================= */
  add("A1 priceBaseOf 仍返回 0（结算真源未被改）",
    priceBaseOf({ price: 0 }, null) === 0, "got=" + priceBaseOf({ price: 0 }, null));
  add("A2 ★priceDisplayBaseOf 把 0 归一为「未定价」",
    priceDisplayBaseOf({ price: 0 }, null) === null, "got=" + priceDisplayBaseOf({ price: 0 }, null));
  add("A3 正数价格原样通过（180）",
    priceDisplayBaseOf({ price: 180 }, null) === 180, "got=" + priceDisplayBaseOf({ price: 180 }, null));
  add("A4 数字字符串价格也能用（\"380\"）",
    priceDisplayBaseOf({ price: "380" }, null) === 380, "got=" + priceDisplayBaseOf({ price: "380" }, null));
  add("A5 非数字价格（\"免费\"）→ 未定价",
    priceDisplayBaseOf({ price: "免费" }, null) === null, "got=" + priceDisplayBaseOf({ price: "免费" }, null));
  add("A6 null / 空对象 / 负价 全部 → 未定价",
    priceDisplayBaseOf({ price: null }, null) === null
    && priceDisplayBaseOf({}, null) === null
    && priceDisplayBaseOf({ price: -50 }, null) === null, "ok");
  add("A7 团期 0 价同口径归一（dep 优先仍生效）",
    priceBaseOf({ price: 180 }, { price: 0 }) === 0 && priceDisplayBaseOf({ price: 180 }, { price: 0 }) === null, "ok");
  add("A8 团期正价优先于活动价",
    priceDisplayBaseOf({ price: 180 }, { price: 220 }) === 220, "ok");

  /* ================= §B 未定价文案 / 单行价格文案 ================= */
  add("B1 0 价 → 「详询」", priceUnpricedTextOf({ price: 0 }) === "详询", priceUnpricedTextOf({ price: 0 }));
  add("B2 标注价格待定 → 「价格待定」",
    priceUnpricedTextOf({ priceTBD: true }) === "价格待定", priceUnpricedTextOf({ priceTBD: true }));
  add("B3 标注免费 → 「免费」", priceUnpricedTextOf({ price: "免费" }) === "免费", priceUnpricedTextOf({ price: "免费" }));
  add("B4 空活动 → 「详询」", priceUnpricedTextOf({}) === "详询" && priceUnpricedTextOf(null) === "详询", "ok");
  add("B5 priceTextOf 正价（含单位）→ 「¥180/人」",
    priceTextOf({ price: 180, limitUnit: "人" }, null, { withUnit: true }) === "¥180/人",
    priceTextOf({ price: 180, limitUnit: "人" }, null, { withUnit: true }));
  add("B6 ★priceTextOf 0 价 → 「详询」（不产出 ¥0）",
    priceTextOf({ price: 0 }, null) === "详询", priceTextOf({ price: 0 }, null));

  /* ================= §C 所有出口不再出现「¥0」 ================= */
  resetState();
  const A0 = mkActivity({ price: 0, useMemberPrice: false });
  const html0 = pageOf(A0);
  add("C1 ★图文长页整页不含「¥0」（CTA / 悬浮条 / 决策速览 / 单团期条 / 标签格）",
    !has(html0, "¥0"), yenCtx(html0).join(" ｜ ").slice(0, 220));
  add("C2 ★未定价时页面改用诚实文案",
    has(html0, "详询") || has(html0, "价格待定") || has(html0, "免费"), "");
  add("C3 费用说明区（fee-hero）不含「¥0」",
    !/fee-hero-v">¥0</.test(html0), "");
  add("C4 单团期条（dep-single-price）不含「¥0」",
    !/dep-single-price">¥0</.test(html0), "");
  add("C5 priceDisplayHtml 未定价 → 「详询」（两种形态）",
    priceDisplayHtml(A0, null, {}) === "详询" && priceDisplayHtml(A0, null, { bare: true, showRange: false }) === "详询", "");
  add("C6 ★C 端列表卡 activityPriceHtml 未定价 → 「详询」",
    (typeof activityPriceHtml === "function") && activityPriceHtml(A0, false) === "详询",
    (typeof activityPriceHtml === "function") ? activityPriceHtml(A0, false) : "activityPriceHtml 缺失");
  add("C7 ★手机版 renderActivityPhone 不含「¥0」", (() => {
    let h = ""; try { h = renderActivityPhone(A0); } catch (e) { h = "THROW:" + e.message; }
    return !/^THROW/.test(h) && !has(h, "¥0");
  })(), "");
  add("C8 回退路径（无 Blueprint）同样不含「¥0」", (() => {
    const a = JSON.parse(JSON.stringify(A0)); delete a.pageBlueprint;
    let h = ""; try { h = renderActivityEditorial(a); } catch (e) { h = "THROW:" + e.message; }
    return !/^THROW/.test(h) && !has(h, "¥0");
  })(), "");

  /* ================= §D 正数价格与会员价链路零回归 ================= */
  resetState();
  const A1 = mkActivity({ price: 180 });
  add("D1 正数价格照常输出（bare → ¥180）",
    priceDisplayHtml(A1, null, { bare: true, showRange: false }) === "¥180",
    priceDisplayHtml(A1, null, { bare: true, showRange: false }));
  add("D2 正数价格带单位（含「/人」）",
    has(priceDisplayHtml(A1, null, {}), "¥180") && has(priceDisplayHtml(A1, null, {}), "/人"),
    priceDisplayHtml(A1, null, {}));
  add("D3 C 端列表卡正数价格照常（¥180）",
    (typeof activityPriceHtml === "function") && has(activityPriceHtml(A1, false), "¥180"),
    (typeof activityPriceHtml === "function") ? activityPriceHtml(A1, false) : "n/a");
  add("D4 正价活动的费用说明区与决策速览照常显示 ¥180",
    has(pageOf(A1), 'fee-hero-v">¥180') && has(pageOf(A1), "¥180"), "");

  /* 会员价：档位价真的更低才出现会员价标记（防假优惠），金卡 158 < 原价 180 */
  resetState(2600);
  const AM = mkActivity({ price: 180, useMemberPrice: true, tierPrices: { t_normal: 180, t_silver: 168, t_gold: 158, t_black: 148 } });
  const hM = pageOf(AM);
  add("D5 会员价路径照常（页面含 pp-mem 与会员价 ¥158 / 原价 ¥180）",
    has(hM, "pp-mem") && has(hM, "¥158") && has(hM, "¥180"), "");
  add("D6 C 端列表卡会员价照常（pp-mem / ¥158 / ¥180）", (() => {
    const h = (typeof activityPriceHtml === "function") ? activityPriceHtml(AM, false) : "";
    return has(h, "pp-mem") && has(h, "¥158") && has(h, "¥180");
  })(), "");
  const AMeq = mkActivity({ price: 180, useMemberPrice: true, tierPrices: { t_normal: 180, t_silver: 180, t_gold: 180, t_black: 180 } });
  add("D7 ★防假优惠未回归：档位价 == 活动价时 hasBenefit=false 且无会员价标记",
    memberBenefitOf(AMeq, null).hasBenefit === false && !has(pageOf(AMeq), "pp-mem"), "");
  /* 未定价 + 开了会员价：不许冒出「会员价 ¥0 起」
     （★这条是本次改动引入的真实风险：以前 base=0 会走到 memberBestPriceOf） */
  resetState(2600);
  const A0M = mkActivity({ price: 0, useMemberPrice: true, tierPrices: { t_normal: 0, t_silver: 0, t_gold: 0, t_black: 0 } });
  add("D8 ★未定价活动即使开了会员价，也不出现「会员价 ¥0 起」且整页无「¥0」",
    memberBestPriceOf(A0M, null) === null && !has(pageOf(A0M), "¥0"),
    "best=" + memberBestPriceOf(A0M, null));

  /* ================= §E 结算真源未被改动 ================= */
  resetState();
  const A0b = mkActivity({ price: 0 });
  add("E1 ★effectiveUnitPrice 对 0 价仍返回 0（结算口径不变）",
    effectiveUnitPrice(A0b, null) === 0, "got=" + effectiveUnitPrice(A0b, null));
  add("E2 ★orderBreakdown 对 0 价仍按 0 结算（未被展示层牵连）", (() => {
    try {
      const bk = orderBreakdown(A0b, { adults: 1, children: 0, usePoints: false });
      return !!bk && bk.subtotal === 0 && bk.payable === 0;
    } catch (e) { return false; }
  })(), "");
  add("E3 正价结算不受影响（180 → subtotal 180）", (() => {
    try { return orderBreakdown(A1, { adults: 1, children: 0, usePoints: false }).subtotal === 180; } catch (e) { return false; }
  })(), "");

  /* ================= §F 团期未定价：展示归一，data-price 保留结算原值 =================
     ★注意 renderSignupPage 只在 deps.length > 1 时才渲染团期选择器，
       所以验 data-price 必须给两个团期。 */
  resetState();
  const AD1 = mkActivity({ price: 0, departures: [mkDep("d1", "2026-09-20", "周六", 0)] });
  const su1 = signupOf(AD1);
  add("F1 ★单团期 0 价：报名页不含「¥0」",
    !/^THROW/.test(su1) && !has(su1, "¥0"), /^THROW/.test(su1) ? su1.slice(0, 120) : "");
  add("F2 单团期 0 价：hero / 价格位显示「详询」", has(su1, "详询"), "");

  resetState();
  const AD2 = mkActivity({ price: 0, departures: [mkDep("d1", "2026-09-20", "周六", 0), mkDep("d2", "2026-09-27", "周日", 0)] });
  const su2 = signupOf(AD2);
  add("F3 ★团期选择器：0 价显示「详询」且整页不含「¥0」",
    !has(su2, "¥0") && has(su2, "详询"), yenCtx(su2).join(" ｜ ").slice(0, 200));
  add("F4 ★结算口径未被动过：data-price 仍保留原值 0",
    has(su2, 'data-price="0"'), "");

  resetState();
  const AD3 = mkActivity({ price: 180, departures: [mkDep("d1", "2026-09-20", "周六", 200), mkDep("d2", "2026-09-27", "周日", 220)] });
  const su3 = signupOf(AD3);
  add("F5 正价团期照常显示（¥200 / ¥220 + data-price 原值）",
    has(su3, "¥200") && has(su3, "¥220") && has(su3, 'data-price="200"') && has(su3, 'data-price="220"'), "");
  add("F6 无团期时报名页 hero 用活动价（¥180）", (() => {
    resetState();
    const AD4 = mkActivity({ price: 180, departures: [] });
    const h = signupOf(AD4);
    return !/^THROW/.test(h) && has(h, "¥180");
  })(), "");

  /* ================= §G 价格待定 / 免费 不被拼成「¥免费」 ================= */
  resetState();
  const AT = mkActivity({ priceTBD: true });
  delete AT.price;
  const hT = pageOf(AT);
  add("G1 ★价格待定活动：详情页含「价格待定」且不含「¥0」",
    has(hT, "价格待定") && !has(hT, "¥0"), "");
  add("G2 价格待定活动的标签格文案为「价格待定」",
    priceDisplayHtml(AT, null, { bare: true, showRange: false }) === "价格待定", priceDisplayHtml(AT, null, { bare: true, showRange: false }));

  resetState();
  const AF = mkActivity({ price: "免费" });
  const hF = pageOf(AF);
  add("G3 ★免费活动：不出现「¥免费」（把非金额拼进 ¥ 是同一类毛病）",
    !has(hF, "¥免费") && !has(hF, "¥0"), yenCtx(hF).join(" ｜ ").slice(0, 220));
  add("G4 免费活动价格位显示「免费」",
    priceDisplayHtml(AF, null, { bare: true, showRange: false }) === "免费", priceDisplayHtml(AF, null, { bare: true, showRange: false }));
  add("G5 免费活动 C 端列表卡也显示「免费」",
    (typeof activityPriceHtml === "function") && activityPriceHtml(AF, false) === "免费",
    (typeof activityPriceHtml === "function") ? activityPriceHtml(AF, false) : "n/a");

} catch (e) {
  dbg.fatal = String(e && e.stack || e);
  add("FATAL 契约执行未抛错", false, dbg.fatal);
}

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
