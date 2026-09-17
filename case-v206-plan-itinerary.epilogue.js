/* case-v206-plan-itinerary.epilogue.js
   ClubOS v206「方案 → 按天行程 → 行程页」契约。

   老板第二次反馈：「详细行程这些还是没有呀」。三个真凶：
     ① INTAKE_SYSTEM 第 7 条限「500 字以内」——与「行程逐条保留」直接打架，行程必被压没；
     ② intakeFallbackDescription 截断 1500 字 —— 实测 2820 字的真实方案正好卡在第 8 页
        Day 2 中间，返程段整段丢失；
     ③ ★行程只留在「描述文本」里，没进结构化字段 —— 后续靠 AI 从描述里二次提取，必然丢。

   修复：intakeParseItinerary() 直接从方案原文抽出 itineraryDays（按天 + 时间轴条目），
   经 draft._planItinerary 落到行程页；ensureItineraryFields 见到非空行程就不再调 AI 生成。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v206-plan-itinerary.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;

/* 真实方案 PPT 抽出的行程原文（第 5 页 Day 1 时间计划 + 第 8 页 Day 2 时间计划，逐字内嵌） */
const REAL_PLAN = "【第 5 页】\n04 — DAY 1 SCHEDULE\nDay 1 时间计划\n成都 → 康定 → 新都桥 → 鱼子西\n\n08:00 - 12:00\n\n成都集合出发，前往康定城区\n\n12:00 - 13:00\n\n康定城区午餐 · 菌王府（溜溜城店）\n\n13:00 - 15:00\n\n前往新都桥 · 赞巴明镜酒店\n\n15:00 - 16:00\n\n办理入住，稍作休整\n\n16:00 - 17:30\n\n出发前往鱼子西\n\n17:30 - 18:00\n\n抵达最佳观景位置\n\n18:00 - 19:30\n\n环眺贡嘎 · 雅拉「日照金山」（路餐补给）\n19:30 - 21:00\n\n返回酒店 · 篝火晚宴\n\n450KM\n全天车程\n\n4200M\n最高海拔\n\n90MIN\n金山观景\n\n21:00\n返回酒店\n\nARC'TERYX × 远拓户外\n05 / 15\n【第 6 页】\n05 — DAY 1 DINING\nDay 1 餐食计划\n藏式风味 · 从菌汤到篝火烤肉\n\nLUNCH · 12:00\n午餐 · 菌王府\n康定城区 · 溜溜城店\n藏式特色牛肉菌汤锅\n\nDINNER · 19:30\n晚餐 · 赞巴直火草原烤肉\n返回酒店后 · 篝火晚宴同场开烤\n\nARC'TERYX × 远拓户外\n06 / 15\n【第 8 页】\n07 — DAY 2 SCHEDULE\nDay 2 时间计划\n\n08:00 - 08:30\n\n酒店早餐\n\n08:30 - 12:00\n\n国家非遗体验 · 唐卡绘制（酒店内）\n\n12:00 - 13:00\n\n午餐\n13:00 - 19:00\n\n驱车返回成都\n\n350KM\n返程车程\n\n3.5H\n唐卡体验\n\n夜宿\n各自温馨的家\n\n温馨提示\n活动流程时间仅供参考，具体以当天实际情况为准。\n";

/* ============ §A 真实方案：按天行程抽取 ============ */
const itin = intakeParseItinerary(REAL_PLAN);
add("A1 ★真实方案抽出 2 天", itin.length === 2, JSON.stringify(itin.map(function (d) { return d.label; })));
add("A2 ★Day 1 抽出 8 条时间轴（去重后）", (itin[0] && itin[0].items.length) === 8, JSON.stringify(itin[0] && itin[0].items.length));
add("A3 ★Day 2 抽出 4 条", (itin[1] && itin[1].items.length) === 4, JSON.stringify(itin[1] && itin[1].items.map(function (x) { return x.time + " " + x.text; })));
add("A4 首条时刻与描述原样保留（08:00 - 12:00 成都集合出发，前往康定城区）",
  itin[0] && itin[0].items[0].time === "08:00 - 12:00" && has(itin[0].items[0].text, "成都集合出发"), JSON.stringify(itin[0] && itin[0].items[0]));
add("A5 Day 1 路线概述进 sub", itin[0] && has(itin[0].sub, "成都") && has(itin[0].sub, "鱼子西"), JSON.stringify(itin[0] && itin[0].sub));
add("A6 ★行程条目是原文搬运（每条 text 都能在原文里找到，零新增字符）",
  itin.every(function (d) { return d.items.every(function (t) { return REAL_PLAN.indexOf(t.text) >= 0; }); }), "");
add("A7 ★噪声行不进行程（页码 05 / 15、品牌页脚、450KM、全天车程）",
  !itin.some(function (d) { return d.items.some(function (t) { return has(t.text, "ARC") || has(t.text, "全天车程") || has(t.text, "15"); }); }),
  JSON.stringify(itin.reduce(function (a, d) { return a.concat(d.items.map(function (t) { return t.text; })); }, [])));
add("A8 ★汇总行「21:00 返回酒店」不与上一条重复",
  !itin[0].items.some(function (t) { return t.time === "21:00"; }), JSON.stringify(itin[0].items.map(function (t) { return t.time; })));
add("A9 输出结构符合行程页契约 {label, sub, items:[{time,text}]}",
  itin.every(function (d) { return typeof d.label === "string" && typeof d.sub === "string" && Array.isArray(d.items) && d.items.every(function (t) { return typeof t.time === "string" && typeof t.text === "string"; }); }), "");

/* ============ §B 中文天标题 / 单日 / 空输入 ============ */
const cn = intakeParseItinerary("第一天\n08:00 集合出发\n12:00 午餐\n第二天\n09:00 徒步\n16:00 返程");
add("B1 中文天标题「第一天/第二天」也认", cn.length === 2 && cn[0].items.length === 2 && cn[1].items.length === 2, JSON.stringify(cn));
add("B2 「第 1 天」数字写法也认", intakeParseItinerary("第 1 天\n08:00 出发").length === 1, "");
add("B3 单日活动（无天标题但有时刻）→ 不凭空造天数",
  intakeParseItinerary("集合时间 08:00\n12:00 午餐").length === 0, JSON.stringify(intakeParseItinerary("集合时间 08:00\n12:00 午餐")));
add("B4 空输入 → 空数组", intakeParseItinerary("").length === 0 && intakeParseItinerary(null).length === 0, "");
add("B5 无时刻的方案 → 空数组（不拿无关行拼行程）",
  intakeParseItinerary("Day 1\n风景很美\n大家玩得开心").length === 0, "");
add("B6b ★时刻与描述同行也认（Word/表格常见写法）",
  (function () { const r = intakeParseItinerary("Day 1\n08:00 集合出发\n12:00 午餐\nDay 2\n09:00 徒步"); return r.length === 2 && r[0].items.length === 2 && r[0].items[0].time === "08:00" && r[0].items[0].text === "集合出发"; })(),
  JSON.stringify(intakeParseItinerary("Day 1\n08:00 集合出发\n12:00 午餐\nDay 2\n09:00 徒步")));
add("B6 天标题大小写/空格不敏感（DAY 2 / day2 / Day 2）",
  intakeParseItinerary("Day 2 时间计划\n08:00 早餐").length === 1 && intakeParseItinerary("DAY 2\n08:00 早餐").length === 1, "");

/* ============ §C 字数限制解除（① / ②） ============ */
const long = "甲".repeat(5000);
add("C1 ★无 AI 回填上限从 1500 提到 4000（此前正好截掉 Day 2）",
  intakeFallbackDescription(long).length === 4000, String(intakeFallbackDescription(long).length));
add("C2 ★prompt 明确行程不受 500 字限制", has(INTAKE_SYSTEM, "不受此限制"), "");
add("C3 prompt 要求逐条完整保留、禁止压缩成总结",
  has(INTAKE_SYSTEM, "逐条完整保留") && has(INTAKE_SYSTEM, "压缩成一句总结"), "");
/* 真实方案全文 2820 字：旧上限 1500 会截掉 Day 2，新上限 4000 完整装下 */
add("C4 ★真实方案 2820 字在新上限内完整保留（旧上限 1500 会截掉 Day 2）",
  intakeFallbackDescription("甲".repeat(2820)).length === 2820 && 2820 <= 4000, "");

/* ============ §D 接线：方案行程 → 行程页 ============ */
add("D1 intakeRunFiles 会抽行程", has(String(intakeRunFiles), "intakeParseItinerary(merged)"), "");
add("D2 generateFromInput 把行程挂到草稿", has(String(generateFromInput), "_planItinerary = state._intake.itinerary"), "");
add("D3 ★AI 分支在 ensureItineraryFields 之前回填（防 AI 空数组覆盖）",
  has(String(generateFromInput), "restorePlanItinerary(state.draft)") &&
  String(generateFromInput).indexOf("restorePlanItinerary(state.draft)") < String(generateFromInput).indexOf("ensureItineraryFields(state.draft)"), "");
add("D4 无 AI 兜底分支同样回填", has(String(generateFromInput), "restorePlanItinerary(base)"), "");

/* restorePlanItinerary 的行为单测 */
const d1 = { days: 1, itineraryDays: [], _planItinerary: [{ label: "第 1 天", sub: "成都-鱼子西", items: [{ time: "08:00", text: "出发" }] }, { label: "第 2 天", sub: "", items: [{ time: "13:00", text: "返程" }] }] };
restorePlanItinerary(d1);
add("D5 空行程时回填方案行程", (d1.itineraryDays || []).length === 2, JSON.stringify(d1.itineraryDays));
add("D6 ★回填时同步天数（否则 syncItineraryDays 会按旧 days 把行程砍成 1 天）", d1.days === 2, String(d1.days));
const d2 = { days: 2, itineraryDays: [{ label: "AI 生成", sub: "", items: [{ time: "07:00", text: "AI 的行程" }] }], _planItinerary: [{ label: "第 1 天", sub: "", items: [{ time: "08:00", text: "方案原文" }] }] };
restorePlanItinerary(d2);
add("D7 ★方案行程覆盖 AI 生成的行程（方案原文是唯一真源）",
  d2.itineraryDays.length === 1 && d2.itineraryDays[0].items[0].text === "方案原文", JSON.stringify(d2.itineraryDays));
add("D8 没有 _planItinerary 时完全不动草稿",
  (function () { const x = { days: 1, itineraryDays: [] }; restorePlanItinerary(x); return x.itineraryDays.length === 0 && x.days === 1; })(), "");

/* ============ §E 端到端：有方案行程时不再调 AI 生成行程 ============ */
const draftWithItin = { days: 2, itineraryDays: itin.slice(), _planItinerary: null };
const before = JSON.stringify(draftWithItin.itineraryDays);
const ensured = await ensureItineraryFields(draftWithItin);
add("E1 ★已有方案行程 → ensureItineraryFields 直接返回 true（不另生成）", ensured === true, String(ensured));
add("E2 且行程内容一字未改", JSON.stringify(draftWithItin.itineraryDays) === before, "");
/* 同步天数后行程不被截断 */
draftWithItin.days = 2;
syncItineraryDays(draftWithItin);
add("E3 ★syncItineraryDays 后 2 天行程都在（不被砍成 1 天）",
  draftWithItin.itineraryDays.length === 2 && draftWithItin.itineraryDays[1].items.length === 4, JSON.stringify(draftWithItin.itineraryDays.length));

/* ============ §F 面板：老板能核对行程读全了没 ============ */
const saved = state._intake;
state._intake = { busy: false, busyText: "", items: [], description: "", warn: "", fields: {}, itinerary: itin.slice(), _fresh: false };
const panelHtml = intakePanelHtml();
add("F1 面板列出已读出的天数与条数", has(panelHtml, "2 天") && has(panelHtml, "12 条"), panelHtml.slice(0, 120));
add("F2 面板逐条显示时刻+内容（可核对）", has(panelHtml, "08:00 - 12:00") && has(panelHtml, "成都集合出发"), "");
add("F3 面板用已注册的图标（不留空 svg）", has(panelHtml, "<svg"), "");
add("F4 有行程但没描述时也渲染面板", has(panelHtml, 'id="intakePanel"'), "");
state._intake = { busy: false, busyText: "", items: [], description: "", warn: "", fields: {}, itinerary: [], _fresh: false };
add("F5 无行程无描述 → 不渲染空面板（幂等）", intakePanelHtml() === "", "");
state._intake = saved;

/* ============ §G 模块自检 / 回归护栏 ============ */
add("G1 模块登记表含 v206 新符号",
  REQUIRED_MODULE_FILES.intakeParseItinerary === "intake.js" && REQUIRED_MODULE_FILES.intakeParseFields === "intake.js", "");
add("G2 启动自检无缺失模块", checkRequiredModules().length === 0, checkRequiredModules().join(" | "));
add("G3 v205 的结构化字段抽取未被破坏", intakeParseFields("集合地点：天府广场\n集合时间：7:30").meeting === "天府广场", "");

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
