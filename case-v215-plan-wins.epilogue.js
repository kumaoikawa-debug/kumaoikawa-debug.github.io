/* case-v215-plan-wins.epilogue.js
   ClubOS v215「上传方案后生成不再被烂 AI 毁掉」契约。

   老板实测吐槽（真实 PPT 方案上传）：v214 上传详细方案后详情页出现 4 类垃圾 ——
     ①「10月xx日」占位日期泄漏到页面；② AI Director 输出「因为山不议程」之类无意义的导语；
     ③「费用说明」区块只剩一张 BBQ 图、没有费用内容；④ hero 空 beige 统计格 + 日期 pill 折行。
   根因：applyAIResult 用 demo / 弱 AI 返回的（垃圾）JSON 盲目覆盖从方案精心抽取的 _planFields，
        而 _planFields 本被标记为「最高优先预填来源」却被丢弃；intake 还漏抽费用包含/不含与地点全名。

   修复（见 MEMORY / skill）：
     · intake 抽费用包含/不含 + 地点全名（f.place）；占位符【不】在抽字段阶段拒（v205 要求留在确认卡补全）；
     · applyAIResult 拒绝 AI 回填的占位日期/价格；
     · applyPlanFieldsOverride：AI 写完后用方案真实事实回盖 date/price/meeting/limit/days/place/fee；
     · cdLeadGrounded：导语/金句必须含数字或命中活动自有文案 2-gram，否则拒收（回退模板）；
     · 详情页日期 pill 渲染层兜底拒占位符；CSS：kvs 改 auto-fit、pill 不折行。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v215-plan-wins.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;

/* ============ 夹具（复刻老板截图里的两天天文活动） ============ */
function mkShot(extra) {
  return Object.assign({
    id: "v215-" + Math.random().toString(36).slice(2, 6),
    type: "徒步", title: "鱼子西观景台两天", place: "四川省甘孜州康定市 · 新都桥镇 · 鱼子西",
    date: "2026-09-26", dateMD: "9月26日", meeting: "成都东站", price: 160, limitUnit: "人", limit: 20,
    days: 2, distance: 8, elevation: 4200, difficulty: "中等", season: "秋",
    photos: Array.from({ length: 6 }, (_, i) => "https://example.com/v215-" + i + ".jpg"),
    photoCaptions: ["日落把山脊烧成一条线", "夜里银河压得很低"],
    whyGo: "鱼子西的日落和日照金山，是川西少见的「一天看两次光」的地方。",
    experience: "傍晚在观景台等日落，天黑后营地亮起灯，抬头是整条银河。",
    gain: "带走一整夜的星轨和一张日照金山的照片。",
    feeInclude: ["往返车费", "专业领队", "高原保险"], feeExclude: ["餐费"],
    itineraryDays: [{ label: "Day1", items: [{ time: "07:00", text: "成都东站集合出发" }, { time: "19:30", text: "营地扎营看日落" }] }],
    confirmed: [{ key: "services" }, { key: "difficulty" }, { key: "price" }]
  }, extra || {});
}

/* ================= §A factPlaceholderReject：占位符拒收 ================= */
try {
  add("A1 占位日期 10月xx日 被拒", factPlaceholderReject("10月xx日", "date") === "", factPlaceholderReject("10月xx日", "date"));
  add("A2 占位价格 价格待定 被拒", factPlaceholderReject("价格待定", "price") === "", factPlaceholderReject("价格待定", "price"));
  add("A3 占位日期 10月某日 被拒（某）", factPlaceholderReject("10月某日", "date") === "", factPlaceholderReject("10月某日", "date"));
  add("A4 具体日期 2026-10-01 放行", factPlaceholderReject("2026-10-01", "date") === "2026-10-01", factPlaceholderReject("2026-10-01", "date"));
  add("A5 具体日期 10月1日 放行", factPlaceholderReject("10月1日", "date") === "10月1日", factPlaceholderReject("10月1日", "date"));
  add("A6 具体价格 168 放行（去单位）", factPlaceholderReject("168元/人", "price") === "168", factPlaceholderReject("168元/人", "price"));
  add("A7 只有月份没有日 10月 被拒", factPlaceholderReject("10月", "date") === "", factPlaceholderReject("10月", "date"));
} catch (e) {
  add("§A 占位符拒收断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §B intake 抽费用包含/不含 + 地点全名 ================= */
try {
  const fee = intakeFeeItemsFromLines("费用包含：往返车费\n专业领队\n高原保险\n费用不含：餐费\n个人消费");
  add("B1 费用包含抽取", JSON.stringify(fee.feeInclude) === JSON.stringify(["往返车费", "专业领队", "高原保险"]), JSON.stringify(fee.feeInclude));
  add("B2 费用不含抽取", JSON.stringify(fee.feeExclude) === JSON.stringify(["餐费", "个人消费"]), JSON.stringify(fee.feeExclude));

  const plan = intakeParseFields("活动时间：2026年10月1日\n集合地点：天府广场地铁站A口\n费用：168元/人\n限25人\n活动地点：四川省成都市都江堰市 · 赵公山\n费用包含：往返车费\n专业领队\n高原保险\n费用不含：餐费\n个人消费");
  add("B3 地点全名写入 f.place（之前漏抽）", has(plan.place, "赵公山"), plan.place);
  add("B4 费用包含写入 f.feeInclude", JSON.stringify(plan.feeInclude) === JSON.stringify(["往返车费", "专业领队", "高原保险"]), JSON.stringify(plan.feeInclude));
  add("B5 费用不含写入 f.feeExclude", JSON.stringify(plan.feeExclude) === JSON.stringify(["餐费", "个人消费"]), JSON.stringify(plan.feeExclude));
  add("B6 日期/价格照常抽取", plan.date === "2026年10月1日" && plan.price === "168", JSON.stringify(plan));
} catch (e) {
  add("§B 费用/地点抽取断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §C applyPlanFieldsOverride：方案事实回盖烂 AI ================= */
try {
  const draft = (typeof blankActivity === "function") ? blankActivity() : {};
  draft._planFields = {
    date: "2026-10-01", price: "168", meeting: "天府广场", limit: "25", days: "2",
    place: "赵公山", feeInclude: ["往返车费", "专业领队"], feeExclude: ["餐费"]
  };
  const garbage = {
    title: "垃圾标题", date: "10月xx日", price: "价格待定", meeting: "某集合点",
    includedServices: ["无关服务"],
    pageBlueprint: { coreThesis: "因为山不议程。", openingStrategy: "因为山不议程。所有议程由风制定。", sections: [] }
  };
  applyAIResult(garbage, draft);
  add("C1 方案日期覆盖 AI 占位日期", draft.date === "2026-10-01", draft.date);
  add("C2 方案价格覆盖 AI 占位价格", draft.price === 168, draft.price);
  add("C3 方案集合地点保留", draft.meeting === "天府广场", draft.meeting);
  add("C4 方案人数保留", draft.limit === 25, draft.limit);
  add("C5 方案天数保留", draft.days === 2, draft.days);
  add("C6 方案地点保留", has(draft.place, "赵公山"), draft.place);
  add("C7 方案费用包含覆盖 AI 无关服务", JSON.stringify(draft.feeInclude) === JSON.stringify(["往返车费", "专业领队"]), JSON.stringify(draft.feeInclude));
  add("C8 方案费用不含保留", JSON.stringify(draft.feeExclude) === JSON.stringify(["餐费"]), JSON.stringify(draft.feeExclude));
  add("C9 AI 占位日期被拒（a.date 不是占位）", !/xx/.test(draft.date || ""), draft.date);
  add("C10 AI 占位价格被拒（a.price 不是占位）", draft.price === 168, draft.price);

  /* 方案日期本身就是占位 → 也不许泄漏到 a.date */
  const d2 = (typeof blankActivity === "function") ? blankActivity() : {};
  d2._planFields = { date: "10月xx日", price: "168" };
  applyAIResult({ date: "10月xx日", price: "价格待定" }, d2);
  add("C11 ★方案占位日期也不落 a.date（交由确认卡补全，不泄漏页面）", !/xx/.test(d2.date || "") && d2.price === 168, d2.date + "|" + d2.price);
} catch (e) {
  add("§C 方案回盖断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §D 导语/金句接地闸门 ================= */
try {
  const gAct = mkShot({ pageBlueprint: { chosen: "d1", pageBlueprint: { coreThesis: "因为山不议程。", openingStrategy: "因为山不议程。所有议程由风制定。", sections: [] } } });
  add("D1 ★垃圾导语被接地闸门拒收（回退空，调用方用模板）", directorLeadOf(gAct) === "", directorLeadOf(gAct));

  const lAct = mkShot({ pageBlueprint: { chosen: "d1", pageBlueprint: { coreThesis: "把一天的光看完", openingStrategy: "先看到日落，再等到日出。", sections: [] } } });
  add("D2 文学导语（命中活动文案意象）被接地闸门放行", directorLeadOf(lAct) === "先看到日落，再等到日出。", directorLeadOf(lAct));

  add("D3 cdLeadGrounded：含数字放行", cdLeadGrounded(mkShot(), "海拔 4200 米看日照金山") === "海拔 4200 米看日照金山", cdLeadGrounded(mkShot(), "海拔 4200 米看日照金山"));
  add("D4 cdLeadGrounded：活动无任何文案时放行（无法判定）", cdLeadGrounded({ title: "" }, "一句完全独立的话") === "一句完全独立的话", cdLeadGrounded({ title: "" }, "一句完全独立的话"));
  add("D5 cdLeadGrounded：与活动无 2-gram 重合的废话拒收", cdLeadGrounded(mkShot(), "所有议程由风制定。所有结论由脚步推导。") === "", cdLeadGrounded(mkShot(), "所有议程由风制定。所有结论由脚步推导。"));
} catch (e) {
  add("§D 接地闸门断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §E 端到端：烂 AI + 方案 → 详情页不烂 ================= */
try {
  const rd = (typeof blankActivity === "function") ? blankActivity() : {};
  rd._planFields = {
    date: "2026-10-01", price: "168", meeting: "天府广场", limit: "25", days: "2",
    place: "赵公山", feeInclude: ["往返车费", "专业领队"], feeExclude: ["餐费"]
  };
  rd.pageBlueprint = { chosen: "d1", pageBlueprint: { coreThesis: "因为山不议程。", openingStrategy: "因为山不议程。所有议程由风制定。", sections: [] } };
  applyAIResult({ date: "10月xx日", price: "价格待定", includedServices: ["无关"], openingStrategy: "因为山不议程。" }, rd);
  let html = "";
  try { html = renderActivityEditorial(rd); } catch (e) { html = "THROW:" + e.message; }
  add("E1 渲染不抛错", !has(html, "THROW"), has(html, "THROW") ? html.slice(0, 120) : "");
  add("E2 页面不出现占位日期 10月xx日", !has(html, "10月xx日"), "");
  add("E3 页面显示方案真实日期（2026-10-01 / 10月1日）", has(html, "2026-10-01") || has(html, "10月1日"), "");
  add("E4 页面显示方案真实价格 168", has(html, "168"), "");
  add("E5 ★费用说明含方案费用包含项（不再只剩一张图）", has(html, "往返车费") && has(html, "专业领队"), "");
  add("E6 页面不出现垃圾导语 因为山不议程", !has(html, "因为山不议程"), "");
} catch (e) {
  add("§E 端到端渲染断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §F 不破坏既有契约 ================= */
try {
  const pf = intakeParseFields("活动时间：10月xx日\n集合地点：天府广场\n费用：168元/人\n活动地点：赵公山");
  add("F1 占位日期仍留在 fields.date（确认卡供用户补全，不泄漏页面）—— 与 v205 B5 一致", has(pf.date, "10月xx日"), pf.date);
  add("F2 价格照常抽取", pf.price === "168", pf.price);
  add("F3 地点全名仍写入 f.place", has(pf.place, "赵公山"), pf.place);

  /* v214 文学导语契约仍成立 */
  const lAct = mkShot({ pageBlueprint: { chosen: "d1", pageBlueprint: { coreThesis: "把一天的光看完", openingStrategy: "先看到日落，再等到日出。", sections: [] } } });
  add("F4 v214 文学导语契约仍成立", directorLeadOf(lAct) === "先看到日落，再等到日出。", directorLeadOf(lAct));
} catch (e) {
  add("§F 既有契约回归断言未抛错", false, String((e && e.stack) || e));
}

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
