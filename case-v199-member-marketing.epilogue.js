/* case-v199-member-marketing.epilogue.js
   ClubOS v199「会员价 / 积分抵现 / 优惠券」回归契约。

   用户反馈原文：「会员价格这一套营销包括积分、这些都没有实现。」
   实测根因（修复前）：
     ① 会员价只作用于 a.price —— 图文长页 / 决策速览 / 底部报名栏 / C 端列表全部只显示基础价；
     ② 积分只有 state.points 一个数字：没有任何入口发放，也没有任何入口抵扣；
     ③ 优惠券后台能建、首页能领，报名流程完全不读它。

   本文件按「老板能亲眼看到的四件事」分四组断言：
     §A 会员价真的出现在每一个价格展示点，且「等于原价」时不许标会员价（防假优惠）
     §B 积分真的能累积、能抵扣、有上限、不会变负数、有流水
     §C 优惠券真的按门槛/范围筛可用，并算得出抵扣额
     §D 结算金额自洽（会员价 → 券 → 积分 → 应付），后台与会员中心如实展示

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v199-member-marketing.epilogue.js
   注意：epilogue 必须裸顶层 return；state 只能用 loadState()（本 bundle 没有 initState）。 */
state = (typeof loadState === "function") ? loadState() : state;

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;
const occ = (h, s) => String(h).split(s).length - 1;
const money = (n) => Math.round(n * 100) / 100;

function mkActivity(over) {
  const base = {
    id: "v199-" + Math.random().toString(36).slice(2, 7),
    type: "徒步", title: "青城后山山脊徒步", place: "青城后山",
    date: "2026-09-20", dateMD: "9月20日", meeting: "天府广场",
    price: 180, limitUnit: "人", limit: 15, days: 1, childPrice: 90,
    photos: [], photoCaptions: [], tags: [], highlights: [], sellingPoints: [], body: [], reviews: [],
    feeInclude: ["专业领队", "户外保险"], feeExclude: ["个人消费"],
    itineraryDays: [{ label: "一日", sub: "", items: [{ time: "08:00", text: "集合" }] }],
    useMemberPrice: true, allowPoints: true, allowCoupons: true,
    tierPrices: { t_normal: 180, t_silver: 168, t_gold: 158, t_black: 148 },
    departures: [], coverIndex: 0, confirmed: [{ key: "services" }],
  };
  return Object.assign(base, over || {});
}
/* 每个小节都从干净状态起步：积分/券/规则都是可变的全局 state 字段 */
function resetState(points, over) {
  state.memberMarketing = (typeof defaultMemberMarketing === "function") ? defaultMemberMarketing() : {};
  Object.assign(state.memberMarketing, over || {});
  state.points = points == null ? 2600 : points;
  state.pointsLedger = [];
  state.coupons = [
    { id: "cp_ok", title: "会员满 100 减 20", type: "reduce", threshold: 100, value: 20, scope: "all", total: 800, claimed: 156, used: 73, status: "active" },
    { id: "cp_high", title: "满 500 减 100", type: "reduce", threshold: 500, value: 100, scope: "all", total: 100, claimed: 1, used: 0, status: "active" },
    { id: "cp_gear", title: "装备 9 折券", type: "discount", threshold: 0, value: 90, scope: "gear", total: 300, claimed: 8, used: 1, status: "active" },
    { id: "cp_paused", title: "已暂停满减", type: "reduce", threshold: 0, value: 30, scope: "all", total: 100, claimed: 1, used: 0, status: "paused" },
  ];
  state.detailMode = "editorial";
}

let dbg = {};
try {
  if (typeof currentMemberTier !== "function") throw new Error("会员营销引擎未加载：currentMemberTier 缺失");

  /* ================= §A 会员价出现在每一个价格展示点 ================= */
  resetState(2600);                                   // 2600 分 → 金卡（2000 起）
  const A = mkActivity();
  const tier = currentMemberTier();
  add("A1 积分 2600 → 当前等级为金卡会员", tier && tier.id === "t_gold" && tier.name === "金卡会员", tier ? tier.name : "null");

  const ben = memberBenefitOf(A, null);
  add("A2 会员价低于活动价时 hasBenefit=true", ben.hasBenefit === true, "member=" + ben.member + " base=" + ben.base);
  add("A3 会员价取该等级档位价（金卡 158）", ben.member === 158, "member=" + ben.member);
  add("A4 单位省额 = 原价 − 会员价（22）", ben.savePerUnit === 22, "save=" + ben.savePerUnit);

  const edHtml = (typeof renderActivityEditorial === "function") ? renderActivityEditorial(A) : "";
  add("A5 图文长页出现会员价标记 pp-mem", has(edHtml, "pp-mem"), "");
  add("A6 图文长页价格含会员价 ¥158", has(edHtml, ">¥158<") || has(edHtml, "¥158"), "");
  add("A7 图文长页含原价划线 ¥180", has(edHtml, "pp-base") && has(edHtml, "¥180"), "");
  add("A8 图文长页费用说明含「金卡会员价」行", has(edHtml, "fee-mem-row") && has(edHtml, "金卡会员价"), "");
  add("A9 图文长页费用说明含积分抵现说明行", has(edHtml, "fee-note-soft") && has(edHtml, "积分"), "");
  add("A10 图文长页费用说明含可用券说明行", has(edHtml, "会员满 100 减 20"), "");

  state.detailMode = "lean";
  const leanHtml = (typeof renderActivityPhone === "function") ? renderActivityPhone(A) : "";
  add("A11 简洁页价格含会员价", has(leanHtml, "pp-mem") && has(leanHtml, "¥158"), "");
  add("A12 简洁页费用说明含会员价行", has(leanHtml, "fee-mem-row"), "");
  add("A13 简洁页决策速览「价格」行含会员价", /价格[\s\S]{0,160}pp-mem/.test(leanHtml), "");
  add("A14 简洁页底部报名栏价格含会员价", (() => {
    const i = leanHtml.indexOf('class="bottom-bar"');
    return i > 0 && has(leanHtml.slice(i, i + 400), "pp-mem");
  })(), "");
  const ctaAt = leanHtml.indexOf("decision-cta-price");
  add("A15 简洁页 CTA 价格含会员价", ctaAt > 0 && has(leanHtml.slice(ctaAt, ctaAt + 300), "pp-mem"), "");
  add("A16 会员价只渲染一次规则：pp-mem 出现次数 ≥ 3（价格点多处生效）", occ(leanHtml, "pp-mem") >= 3, "n=" + occ(leanHtml, "pp-mem"));

  /* 团期价也要走会员价 */
  const A2 = mkActivity({ departures: [{ id: "d1", date: "2026-09-20", dateMD: "9月20日", weekDay: "周日", price: 200, status: "open" }] });
  add("A17 会员价优先于团期价（团期 200 → 金卡 158）", effectiveUnitPrice(A2, A2.departures[0]) === 158, "got=" + effectiveUnitPrice(A2, A2.departures[0]));
  add("A18 未开会员价时取团期价原值", effectiveUnitPrice(mkActivity({ useMemberPrice: false, departures: [{ id: "d1", price: 200 }] }), { id: "d1", price: 200 }) === 200, "");

  /* 防假优惠：档位价 == 基础价时不许出现会员价字样 */
  const A3 = mkActivity({ tierPrices: { t_normal: 180, t_silver: 180, t_gold: 180, t_black: 180 } });
  const ben3 = memberBenefitOf(A3, null);
  const ed3 = renderActivityEditorial(A3);
  add("A19 全部档位价 == 活动价时 hasBenefit=false", ben3.hasBenefit === false, "");
  add("A20 此时图文长页不出现任何会员价标记（防假优惠）", !has(ed3, "pp-mem") && !has(ed3, "fee-mem-row"), "");
  add("A21 此时价格显示原价 ¥180", has(ed3, "¥180"), "");
  const A4 = mkActivity({ useMemberPrice: false });
  add("A22 未开启执行会员价时也不出现会员价", !has(renderActivityEditorial(A4), "pp-mem"), "");
  add("A23 C 端列表卡价格走同一引擎（含会员价）", (() => {
    const h = (typeof activityPriceHtml === "function") ? activityPriceHtml(A, false) : "";
    return has(h, "pp-mem") && has(h, "¥158") && has(h, "¥180");
  })(), "");

  /* ================= §B 积分：累积 / 抵扣 / 上限 / 不为负 / 流水 ================= */
  resetState(2600);
  const B = mkActivity();
  add("B1 积分余额读取 state.points（2600）", memberPointsBalance() === 2600, "got=" + memberPointsBalance());
  add("B2 100 积分 = ¥1 → 2600 积分抵 ¥26", pointsToYuan(2600) === 26, "got=" + pointsToYuan(2600));

  const bk0 = orderBreakdown(B, { adults: 1, children: 0, usePoints: false });
  add("B3 不用积分时按会员价结算（158）", bk0.subtotal === 158 && bk0.payable === 158, "subtotal=" + bk0.subtotal + " payable=" + bk0.payable);
  add("B4 记录会员优惠省额（180→158 省 22）", bk0.memberSaved === 22, "saved=" + bk0.memberSaved);

  const bk1 = orderBreakdown(B, { adults: 1, children: 0, usePoints: true });
  add("B5 勾选积分抵现后扣减（上限 20% 未及，用满余额 2600）", bk1.pointsUsed === 2600, "used=" + bk1.pointsUsed);
  add("B6 积分抵现金额 ¥26", bk1.pointsDiscount === 26, "got=" + bk1.pointsDiscount);
  add("B7 应付 = 158 − 26 = 132", bk1.payable === 132, "got=" + bk1.payable);
  /* 等级 pointsRate 的单位是「几元赠送 1 积分」（金卡 0.8）—— 不是倍率。
     132 元 ÷ 0.8 = 165 积分；这条断言把这个单位钉死，避免以后又被当成乘数。 */
  add("B8a 等级 pointsRate 语义为「元/积分」（金卡 0.8 → 每 ¥1 累积 1.25）", pointsPerYuanOf(tier) === 1.25, "got=" + pointsPerYuanOf(tier));
  add("B8b 赠分 = 实付 ÷ 等级费率（132 ÷ 0.8 = 165）", bk1.pointsEarned === 165, "got=" + bk1.pointsEarned);
  add("B8c 未开启消费送积分的等级不赠分", yuanToPoints(100, { pointsRate: 0.8, pointsEnabled: false }) === 0, "");

  /* 大额订单：抵现受 20% 上限约束 */
  const bkBig = orderBreakdown(B, { adults: 5, children: 0, usePoints: true });
  add("B9 5 人订单小计 = 158×5 = 790", bkBig.subtotal === 790, "got=" + bkBig.subtotal);
  add("B10 抵现上限 20% → 158.00 元，受余额 26 元约束", bkBig.pointsDiscount === 26, "got=" + bkBig.pointsDiscount);
  /* 余额充足（100000 分 = ¥1000）时，约束应来自「单笔 20% 上限」而不是余额：
     100000 分落在黑卡档 → 档位价 3000 → 上限 600 元 → 需 60000 积分。 */
  const B2 = mkActivity({ price: 5000, tierPrices: { t_normal: 5000, t_silver: 4000, t_gold: 3500, t_black: 3000 } });
  state.points = 100000;
  add("B11a 大额积分进入黑卡档（档位价 3000）", effectiveUnitPrice(B2, null) === 3000, "got=" + effectiveUnitPrice(B2, null));
  const bkCap = orderBreakdown(B2, { adults: 1, children: 0, usePoints: true });
  add("B11b 余额充足时按单笔 20% 上限封顶（3000 × 20% = 600）", bkCap.pointsDiscount === 600, "got=" + bkCap.pointsDiscount + " used=" + bkCap.pointsUsed);
  add("B11c 封顶后消耗积分为 60000（未超余额）", bkCap.pointsUsed === 60000, "got=" + bkCap.pointsUsed);
  add("B11d 应付 = 3000 − 600 = 2400", bkCap.payable === 2400, "got=" + bkCap.payable);

  /* 扣减 / 发放 / 不为负 / 流水 */
  resetState(2600);
  const used = redeemMemberPoints(2600, "积分抵现 · 单元测试", "s1");
  add("B12 扣减积分返回实际扣除数", used === 2600, "got=" + used);
  add("B13 扣减后余额归零", memberPointsBalance() === 0, "got=" + memberPointsBalance());
  add("B14 扣减写入一条 spend 流水", (state.pointsLedger || []).filter((x) => x.type === "spend").length === 1, "n=" + (state.pointsLedger || []).length);
  const over = redeemMemberPoints(500, "余额不足测试", "s2");
  add("B15 余额不足时整体不扣、不产生负数余额", over === 0 && memberPointsBalance() === 0, "ret=" + over + " bal=" + memberPointsBalance());
  const got = grantMemberPoints(198, "报名赠送 · 单元测试", "s1");
  add("B16 发放积分累加余额", got === 198 && memberPointsBalance() === 198, "got=" + got + " bal=" + memberPointsBalance());
  add("B17 发放写入一条 earn 流水", (state.pointsLedger || []).filter((x) => x.type === "earn").length === 1, "");
  add("B18 流水含原因与关联单号（可审计）", (() => {
    const it = (state.pointsLedger || [])[0] || {};
    return !!it.reason && it.refId === "s1" && !!it.id && !!it.at;
  })(), "");

  /* 起抵线与总开关 */
  resetState(50);
  const bkLow = orderBreakdown(B, { adults: 1, children: 0, usePoints: true });
  add("B19 余额低于起抵线（100）时不抵扣", bkLow.pointsUsed === 0 && bkLow.pointsDiscount === 0, "used=" + bkLow.pointsUsed);
  resetState(2600, { pointsEnabled: false });
  const bkOff = orderBreakdown(B, { adults: 1, children: 0, usePoints: true });
  add("B20 俱乐部关闭积分抵现时不抵扣", bkOff.pointsUsed === 0 && bkOff.payable === 158, "payable=" + bkOff.payable);
  resetState(2600);
  const bkNotAllowed = orderBreakdown(mkActivity({ allowPoints: false }), { adults: 1, children: 0, usePoints: true });
  add("B21 活动未开启「接受积分抵现」时不抵扣", bkNotAllowed.pointsUsed === 0, "used=" + bkNotAllowed.pointsUsed);

  /* ================= §C 优惠券：门槛 / 范围 / 抵扣额 ================= */
  resetState(2600);
  const C = mkActivity();
  const usable = usableCouponsFor(C, 158);
  const usableIds = usable.map((c) => c.id).join(",");
  add("C1 达门槛的全场券可用（cp_ok）", usableIds.indexOf("cp_ok") >= 0, "usable=" + usableIds);
  add("C2 门槛高于订单额的券不可用（满 500）", usableIds.indexOf("cp_high") < 0, "");
  add("C3 装备专用券不适用于活动报名", usableIds.indexOf("cp_gear") < 0, "");
  add("C4 已暂停的券不可用", usableIds.indexOf("cp_paused") < 0, "");
  add("C5 满减券抵扣额 = 券面额", couponDiscountOf(state.coupons[0], 158) === 20, "got=" + couponDiscountOf(state.coupons[0], 158));
  add("C6 折扣券抵扣额 = 订单额 × 折扣差（9 折 → 10%）", couponDiscountOf(state.coupons[2], 200) === 20, "got=" + couponDiscountOf(state.coupons[2], 200));
  add("C7 满减券不会超过订单额", couponDiscountOf({ type: "reduce", value: 500 }, 158) === 158, "");
  add("C8 活动未开启「接受优惠券」时无可用券", usableCouponsFor(mkActivity({ allowCoupons: false }), 158).length === 0, "");

  /* ================= §D 结算自洽 + 后台/会员中心如实展示 ================= */
  resetState(2600);
  const D = mkActivity();
  const bk = orderBreakdown(D, { adults: 1, children: 0, couponId: "cp_ok", usePoints: true });
  add("D1 优惠券先于积分抵扣（小计 158）", bk.subtotal === 158 && bk.couponDiscount === 20, "coupon=" + bk.couponDiscount);
  add("D2 积分上限基于「券后金额」138 → 20% = 27.6 元，受余额 26 元约束", bk.pointsDiscount === 26, "got=" + bk.pointsDiscount);
  add("D3 应付 = 158 − 20 − 26 = 112", bk.payable === 112, "got=" + bk.payable);
  add("D4 金额自洽：应付 + 会员优惠 + 券 + 积分 = 原价小计", money(bk.payable + bk.memberSaved + bk.couponDiscount + bk.pointsDiscount) === money(bk.rawSubtotal), "sum=" + (bk.payable + bk.memberSaved + bk.couponDiscount + bk.pointsDiscount) + " raw=" + bk.rawSubtotal);
  add("D5 返还结算快照字段齐全（供落库留档）", ["unit", "rawUnit", "couponDiscount", "pointsUsed", "pointsDiscount", "payable", "pointsEarned"].every((k) => bk[k] !== undefined), "");

  const bkChild = orderBreakdown(D, { adults: 1, children: 1, usePoints: false });
  add("D6 儿童价按会员价同比例折算（90 → 79）", bkChild.childUnit === 79, "got=" + bkChild.childUnit);
  add("D7 多人数小计 = 成人会员价 + 儿童会员价", bkChild.subtotal === 158 + 79, "got=" + bkChild.subtotal);

  /* 报名结算面板 HTML（表单未填时走默认值） */
  const settleHtml = (typeof signupSettleInnerHtml === "function") ? signupSettleInnerHtml(D) : "";
  add("D8 报名页出现结算面板 su-settle 内容", has(settleHtml, "su-line") && has(settleHtml, "应付"), "");
  add("D9 结算面板列出可用券并给出抵扣额", has(settleHtml, "会员满 100 减 20") && has(settleHtml, "-20 元"), "");
  add("D10 结算面板给出积分抵扣控件与上限说明", has(settleHtml, "积分抵现") && has(settleHtml, "单笔上限 20%"), "");
  add("D11 结算面板显示完成后预计获得积分", has(settleHtml, "预计获得"), "");
  add("D12 可用券为空时给诚实空态（不隐瞒也不虚构）", (() => {
    const h = signupSettleInnerHtml(mkActivity({ allowCoupons: true, price: 50, tierPrices: { t_normal: 50, t_silver: 48, t_gold: 45, t_black: 40 } }));
    return has(h, "暂无可用优惠券");
  })(), "");

  /* 后台面板：生效预览 + 积分规则 */
  const panel = (typeof memberMarketingEditHtml === "function") ? memberMarketingEditHtml(D) : "";
  add("D13 后台面板含「客户实际看到的价格」生效预览", has(panel, "mm-preview") && has(panel, "客户实际看到的价格"), "");
  add("D14 预览逐档给出可省金额", has(panel, "省 ¥22"), "");
  add("D15 后台面板含积分规则四项配置", ["pointsPerYuan", "maxRedeemPercent", "minRedeemPoints", "earnPerYuan"].every((k) => has(panel, 'data-mm-cfg="' + k + '"')), "");
  add("D16 后台面板给出本活动可用券统计", has(panel, "本次可用券"), "");
  const D2 = mkActivity({ tierPrices: { t_normal: 180, t_silver: 180, t_gold: 180, t_black: 180 } });
  const panel2 = memberMarketingEditHtml(D2);
  add("D17 全部档位价等于活动价时，后台明确提示「客户看不到会员优惠」", has(panel2, "客户在详情页看不到任何会员优惠"), "");
  add("D18 预览逐档标注「与活动价相同」", has(panel2, "与活动价相同"), "");

  /* 会员中心：可抵现金额 + 积分明细 */
  const mc = (typeof renderMembershipH5 === "function") ? renderMembershipH5() : "";
  add("D19 会员中心显示积分可抵现金额", has(mc, "可抵 ¥26"), "");
  add("D20 会员中心展示积分换算规则", has(mc, "积分 = ¥1") && has(mc, "单笔最多抵 20%"), "");
  add("D21 会员中心展示积分明细区段", has(mc, "积分明细"), "");
  resetState(0);
  const mcEmpty = renderMembershipH5();
  add("D22 无流水时给诚实空态（平台不凭空生成积分）", has(mcEmpty, "平台不会凭空生成积分"), "");
  resetState(2600);
  grantMemberPoints(120, "报名赠送 · 青城后山", "s99");     // 造一条真实流水（不手工塞 state）
  redeemMemberPoints(100, "积分抵现 · 青城后山", "s99");
  const mcLed = renderMembershipH5();
  add("D23 有流水时逐条列出（含正负号与原因）", has(mcLed, "mc-pts-row") && has(mcLed, "报名赠送 · 青城后山") && has(mcLed, "积分抵现 · 青城后山"), "");
  add("D23b 余额 = 2600 + 120 − 100 = 2620（含流水后仍在同一等级区间展示）", memberPointsBalance() === 2620, "got=" + memberPointsBalance());

  /* 引擎模块登记（缺函数只能在点下去时才报错，这里提前断言） */
  const missing = (typeof checkRequiredModules === "function") ? checkRequiredModules() : ["checkRequiredModules 缺失"];
  add("D24 必需模块自检通过（会员营销引擎已登记）", missing.length === 0, missing.join(" / "));

  dbg = {
    tier: tier ? tier.name : "-", member: ben.member, save: ben.savePerUnit,
    payableBase: bk0.payable, payableAll: bk1.payable, payableCoupon: bk.payable,
    pointsUsed: bk1.pointsUsed, earned: bk1.pointsEarned,
    ppMemLean: occ(leanHtml, "pp-mem"), usable: usableIds,
  };
} catch (e) {
  add("v199 会员营销契约未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  checks,
  debug: dbg,
};
