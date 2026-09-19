/* case-v215-content-v3.epilogue.js
   ClubOS Content Engine V3 —— 前端双轨 + Promo Canvas 契约（任务 H/I/J）。

   按《ClubOS Content Engine V3 最终开发文本》：
     · Block 是「视觉词汇」，不是模板 → 渲染器不得假设任何固定 Block 顺序；
     · 差异化来自 StyleVector 连续量纲 + 本场证据，禁止 style enum（magazine/diary/family…）；
     · 允许创造表达，不允许创造事实 → 渲染器不得自补任何文案/促销话术/报价；
     · evidenceRefs 必须可回溯（本实现落到 data-evidence 属性做留痕）；
     · Info Stack（行程/费用/装备/评价）由 canonical 事实字段驱动，不进 Creative blocks。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v215-content-v3.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;
const occ = (h, s) => String(h).split(s).length - 1;

/* ============ 夹具：活动 + V3 PromoDocument ============ */
function mkActivity(over) {
  return Object.assign({
    id: "v3-" + Math.random().toString(36).slice(2, 6),
    type: "徒步", title: "赵公山徒步", place: "都江堰赵公山",
    date: "2026-10-01", dateMD: "10月1日", meeting: "天府广场地铁站A口",
    price: 168, limitUnit: "人", limit: 25, days: 1,
    distance: 12, elevation: 1200, difficulty: "中等", season: "秋",
    photos: Array.from({ length: 4 }, (_, i) => "https://example.com/v3-p" + i + ".jpg"),
    photoCaptions: ["山脊的早晨", "午饭后的坡"],
    whyGo: "赵公山的林线和视野，是成都近郊少见的一日组合。",
    experience: "早上从山口上攀，中午在林线一带休息。",
    gain: "走完一整条山脊线。",
    feeInclude: ["往返车费", "专业领队", "户外保险"], feeExclude: ["午餐"],
    itineraryDays: [{ label: "一日线", items: [{ time: "07:30", text: "集合出发" }, { time: "17:30", text: "返程" }] }],
    reviews: [], departures: [], gear: [], tags: [], coverIndex: 0, edTheme: "",
    confirmed: [{ key: "services" }, { key: "difficulty" }, { key: "price" }]
  }, over || {});
}

function blk(type, over) {
  return Object.assign({
    id: "b-" + type, type: type, purpose: "传递信息", communicationGoal: "说明",
    evidenceRefs: ["truth:date"], layout: { width: "normal" },
    copy: { headline: type + " 标题", body: type + " 正文。" }
  }, over || {});
}

function mkDoc(blocks, svOver) {
  return {
    schemaVersion: 3, activityId: "x", scenario: "detail", openingMode: "scene",
    direction: {
      id: "d1", thesis: "把一天走成一条线", targetAudience: "初次徒步的人",
      primaryMotivation: "想看山脊", primaryBarrier: "怕体力不够",
      communicationAngle: "从可完成的强度切入", evidenceRefs: ["truth:date"],
      narrativeStrategy: ["先给画面", "再说安排"],
      styleVector: Object.assign({
        imageDominance: 0.6, textDensity: 0.45, informationWeight: 0.5, emotionalWeight: 0.5,
        documentaryLevel: 0.5, aspirationLevel: 0.5, socialEnergy: 0.4, challengeSignal: 0.4,
        lifestyleSignal: 0.4, professionalSignal: 0.5, ctaStrength: 0.5,
        rhythm: "medium", whitespace: "balanced", typographyEnergy: 0.5
      }, svOver || {}),
      expectedVisualStrategy: "以实景为主", rationale: "内部留痕，不上屏"
    },
    blocks: blocks,
    fingerprint: { thesisText: "把一天走成一条线", componentSequence: blocks.map((b) => b.type), heroMode: "none", mediaTextRatio: 0.2, ctaPosition: "none" },
    generationMeta: { model: "test", workflowVersion: "v3", generatedAt: "2026-09-20", repairCount: 0 }
  };
}

/* ================= §A PromoDocument 校验 ================= */
try {
  const d1 = mkDoc([blk("lead"), blk("image"), blk("cta")]);
  add("A1 合法 V3 文档通过校验", contentV3IsValidDoc(d1) === true, String(contentV3IsValidDoc(d1)));
  add("A2 schemaVersion≠3 被拒", contentV3IsValidDoc(Object.assign({}, d1, { schemaVersion: 2 })) === false, "");
  add("A3 blocks 为空被拒", contentV3IsValidDoc(mkDoc([])) === false, "");
  add("A4 全为非法 Block 类型被拒", contentV3IsValidDoc(mkDoc([blk("carousel"), blk("video")])) === false, "");
  add("A5 含非法类型但至少 1 合法 → 通过", contentV3IsValidDoc(mkDoc([blk("carousel"), blk("lead")])) === true, "");
  add("A6 非对象/null 被拒", (contentV3IsValidDoc(null) === false) && (contentV3IsValidDoc("x") === false), "");
} catch (e) {
  add("§A 文档校验断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §B 事实漂移保护（改了事实就不得再渲染旧文档） ================= */
try {
  const a = mkActivity();
  const doc = mkDoc([blk("lead")]);
  a.v3Document = doc;
  a.v3TruthKey = contentV3TruthKey(a);
  add("B1 指纹一致 → V3 文档可用", contentV3DocOf(a) === doc, "");

  const a2 = JSON.parse(JSON.stringify(a));
  a2.date = "2026-11-11";
  add("B2 改了日期 → 旧文档过期（回退 legacy）", contentV3DocOf(a2) === null, "");

  const a3 = JSON.parse(JSON.stringify(a));
  a3.feeInclude = ["往返车费"];
  add("B3 改了费用包含 → 旧文档过期", contentV3DocOf(a3) === null, "");

  const a4 = mkActivity();
  a4.v3Document = mkDoc([blk("carousel")]);
  a4.v3TruthKey = contentV3TruthKey(a4);
  add("B4 挂了不合法文档 → 视为没有", contentV3DocOf(a4) === null, "");

  /* ★ 回归护栏：renderActivityEditorial / syncDepartures 会把 a.date 覆写成 dateMD ——
     那是**日期表示形式的抖动**，不是事实变了，绝不能因此判文档过期
     （一旦判错，页面永远落回 legacy，表现出来就是「V3 没生效」）。 */
  const a5 = mkActivity();
  a5.v3Document = mkDoc([blk("lead")]);
  a5.v3TruthKey = contentV3TruthKey(a5);
  a5.date = a5.dateMD;
  add("B5 a.date 被覆写成 dateMD 不得判过期", contentV3DocOf(a5) !== null, "");

  const a6 = mkActivity();
  a6.v3Document = mkDoc([blk("lead")]);
  a6.v3TruthKey = contentV3TruthKey(a6);
  a6.date = "2026-10-09"; a6.dateMD = "10月9日";
  add("B6 真的改期 → 旧文档过期", contentV3DocOf(a6) === null, "");
} catch (e) {
  add("§B 漂移保护断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §C Block 顺序零假设（不得套固定模板） ================= */
try {
  const a = mkActivity();
  const order1 = mkDoc([blk("lead"), blk("image"), blk("quote"), blk("cta")]);
  const order2 = mkDoc([blk("quote"), blk("image_group"), blk("lead"), blk("metric"), blk("cta")]);
  const h1 = contentV3CanvasHtml(a, order1);
  const h2 = contentV3CanvasHtml(a, order2);
  const seq = (h) => (String(h).match(/class="v3-blk v3-[a-z_]+/g) || []).map((s) => s.split("v3-blk ")[1]);
  const s1 = seq(h1).join(">");
  const s2 = seq(h2).join(">");
  add("C1 两份不同顺序的文档产出不同画布序列", s1 !== s2 && s1.length > 0 && s2.length > 0, s1 + "  VS  " + s2);
  add("C2 画布序列严格等于文档 blocks 顺序", s1 === "v3-lead>v3-image>v3-quote>v3-cta", s1);

  /* 所有合法 Block 类型都能渲染出非空 HTML（缺一类 = 该 type 静默丢失） */
  const miss = [];
  ["lead", "statement", "image", "image_group", "text_image", "metric", "quote", "chapter_break", "gallery", "cta"].forEach((t) => {
    const hh = contentV3BlockHtml(a, blk(t), { used: {} });
    if (!String(hh).trim()) miss.push(t);
  });
  add("C3 十种合法 Block 全部渲染出非空内容", miss.length === 0, "缺失：" + (miss.join(",") || "无"));

  const heroDoc = mkDoc([blk("hero", { copy: { headline: "AI 编的大标题", body: "AI 编的副标题" } }), blk("lead")]);
  const hh = contentV3CanvasHtml(a, heroDoc);
  add("C4 hero Block 不在画布里重复渲染", !has(hh, "v3-hero"), "");
} catch (e) {
  add("§C 顺序零假设断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §D evidence 可回溯 ================= */
try {
  const a = mkActivity();
  const h = contentV3BlockHtml(a, blk("lead", { evidenceRefs: ["truth:date", "vision:p1"] }), { used: {} });
  add("D1 evidenceRefs 落到 data-evidence（可回溯留痕）", has(h, 'data-evidence="truth:date vision:p1"'), h.slice(0, 160));
} catch (e) {
  add("§D evidence 留痕断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §E 渲染器不得自创文案 / 报价 ================= */
try {
  const a = mkActivity();
  add("E1 全空 Block（非 cta）→ 不输出任何东西", contentV3BlockHtml(a, blk("lead", { copy: {}, mediaRefs: [] }), { used: {} }) === "", "");

  /* 自补话术是最典型的「AI 帮你编」症状 —— 一个字都不许有 */
  const banned = ["名额有限", "仅剩", "逃离城市", "治愈", "手慢无", "松弛感", "错过再等一年", "绝美", "天花板"];
  const canvas = contentV3CanvasHtml(a, mkDoc([blk("lead"), blk("quote"), blk("cta"), blk("image")]));
  const leaked = banned.filter((p) => has(canvas, p));
  add("E2 画布零禁用话术泄漏", leaked.length === 0, leaked.join(",") || "无");

  /* CTA 的价格必须来自 canonical 事实：改价 → 页面价格跟着变，而不是写死 */
  const aHi = mkActivity({ price: 888 });
  const ctaHi = contentV3BlockHtml(aHi, blk("cta", { copy: { headline: "来吧" } }), { used: {} });
  add("E3 CTA 价格取自 canonical 事实（随 a.price 变化）", has(ctaHi, "888"), ctaHi.slice(0, 200));
  add("E4 direction.rationale（内部推理留痕）不上屏", !has(canvas, "内部留痕，不上屏"), "");
} catch (e) {
  add("§E 非创造事实断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §F StyleVector 连续量纲（禁止 style enum） ================= */
try {
  const low = contentV3StyleVarsObj(mkDoc([blk("lead")], { textDensity: 0.1 }));
  const high = contentV3StyleVarsObj(mkDoc([blk("lead")], { textDensity: 0.9 }));
  add("F1 textDensity 提高 → 字号连续放大", parseFloat(high["--v3-text-scale"]) > parseFloat(low["--v3-text-scale"]), low["--v3-text-scale"] + " → " + high["--v3-text-scale"]);

  const tight = contentV3StyleVarsObj(mkDoc([blk("lead")], { whitespace: "tight" }));
  const generous = contentV3StyleVarsObj(mkDoc([blk("lead")], { whitespace: "generous" }));
  add("F2 whitespace 三档映射到不同留白", (tight["--v3-blk-gap"] === "16px") && (generous["--v3-blk-gap"] === "46px"), tight["--v3-blk-gap"] + " / " + generous["--v3-blk-gap"]);

  const slow = contentV3StyleVarsObj(mkDoc([blk("lead")], { rhythm: "slow" }));
  add("F3 rhythm=slow → 节奏间距更大", parseInt(slow["--v3-ry-gap"], 10) === 42, slow["--v3-ry-gap"]);

  add("F4 StyleVector 越界被夹紧到 0~1", contentV3Num(9, 0.5) === 1 && contentV3Num(-3, 0.5) === 0 && contentV3Num("abc", 0.5) === 0.5, "");
  add("F5 渲染物不含任何 style enum", !/magazine|diary|family|season-challenge/i.test(contentV3StyleVars(mkDoc([blk("lead")]))), "");
} catch (e) {
  add("§F StyleVector 断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §G 双轨：有 V3 走 V3，没有走 legacy，且 Info Stack 不动 ================= */
try {
  const aLegacy = mkActivity();
  let hL = "";
  try { hL = renderActivityEditorial(aLegacy); } catch (e) { hL = ""; }
  add("G1 无 V3 文档 → 走 legacy 叙事（xh-ed-sec）", has(hL, "xh-ed-sec") && !has(hL, "v3-blk"), "sec=" + occ(hL, "xh-ed-sec") + " v3=" + occ(hL, "v3-blk"));

  const aV3 = mkActivity();
  aV3.v3Document = mkDoc([blk("lead"), blk("image"), blk("quote"), blk("cta")]);
  aV3.v3TruthKey = contentV3TruthKey(aV3);
  let h3 = "";
  try { h3 = renderActivityEditorial(aV3); } catch (e) { h3 = ""; }
  add("G2 有 V3 文档 → 走 V3 画布", has(h3, "v3-blk"), "v3blk=" + occ(h3, "v3-blk"));

  /* Info Stack 由 canonical 事实驱动，换轨道不得消失 —— 这正是「方案事实必须上屏」的兜底 */
  add("G3 V3 轨道下「费用说明」仍在", has(h3, 'id="ed-fee"'), "");
  add("G4 V3 轨道下「详细行程」仍在", has(h3, 'id="ed-itin"'), "");
  add("G5 大标题绝不被 AI 覆盖（仍是活动原标题）", has(h3, "赵公山徒步"), "");

  /* V3 自带 cta → 不得出现两个报名入口 */
  const single = occ(h3, 'id="ed-cta"');
  add("G6 V3 带 cta Block 时全页只有一个 #ed-cta", single === 1, "n=" + single);

  const noCtaV3 = mkActivity();
  noCtaV3.v3Document = mkDoc([blk("lead"), blk("image")]);
  noCtaV3.v3TruthKey = contentV3TruthKey(noCtaV3);
  let h3n = "";
  try { h3n = renderActivityEditorial(noCtaV3); } catch (e) { h3n = ""; }
  add("G7 V3 无 cta Block 时由 legacy CTA 兜底（仍只有一个）", occ(h3n, 'id="ed-cta"') === 1, "n=" + occ(h3n, 'id="ed-cta"'));
} catch (e) {
  add("§G 双轨断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §H 素材解析健壮性（一处解不出不至于整块没图） ================= */
try {
  const a = mkActivity();
  add("H1 p{下标} 解析到对应照片", has(contentV3FigHtml(a, { index: 2, src: a.photos[2] }, ""), "v3-p2.jpg"), "");
  const ctx = { used: {} };
  const r = contentV3ResolvePhoto(a, "p9", ctx);
  add("H2 越界 ref 兜底到可用照片（不返回空）", !!(r && r.src), JSON.stringify(r));
  const u = contentV3ResolvePhoto(a, "https://cdn.example.com/x.jpg", { used: {} });
  add("H3 直链 ref 原样透传", !!(u && u.src === "https://cdn.example.com/x.jpg"), String(u && u.src));
} catch (e) {
  add("§H 素材解析断言未抛错", false, String((e && e.stack) || e));
}

return { ok: checks.every((c) => c.pass), total: checks.length, passed: checks.filter((c) => c.pass).length, checks: checks };
