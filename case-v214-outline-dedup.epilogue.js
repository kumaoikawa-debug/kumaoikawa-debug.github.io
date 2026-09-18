/* case-v214-outline-dedup.epilogue.js
   ClubOS v214「行程只渲染一处 + AI 总监真正接管页面」契约。

   背景（老板截图质疑的那一版）：详情页里同一张时间表同屏出现两遍 ——
     ① 叙事大纲的 route 章节把当天 items 用「；」串成整段（publish.js buildEditorialOutline）；
     ② 下方「详细行程」的 DAY 时间轴又逐条渲染同一份时间表（activities.js itinHtml）。
   v198 只摘掉了 itinContentHtml，漏了 ①；本版补齐，并顺带修掉暴露出来的三件事：

   §A 行程去重：叙事大纲不再含 route/day 章节，时间表在页面上只出现一次（正/反向都验）；
   §B 长地名病句：「{P}不是散步的路线。」不再被塞进完整行政区划（shortPlaceOf）；
   §C AI 总监接管导语 / 金句：之前 Blueprint 只驱动正文，页头仍是模板句（openingStrategy 从未落地）；
   §D kind 标签补齐 night（本地「入夜」章节与 Director 的 night 章节都不再显示成兜底 STORY）；
   §E 自动跑一次 Director：runContentDirector 此前只有手动「换一种排版」一个入口，
      配了 AI 也不会自动编排 → 详情页永远停在模板版。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v214-outline-dedup.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};
const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;
const occ = (h, s) => String(h).split(s).length - 1;

/* ============ 夹具：复刻老板截图里的那场活动（2 天、密时间表、长行政区划地名） ============ */
function mkShot(extra) {
  return Object.assign({
    id: "v214-" + Math.random().toString(36).slice(2, 6),
    type: "徒步", title: "鱼子西观景台两天", place: "四川省甘孜州康定市 · 新都桥镇 · 鱼子西",
    date: "2026-09-26", dateMD: "9月26日", meeting: "成都东站", price: 160, limitUnit: "人", limit: 20,
    days: 2, distance: 8, elevation: 4200, difficulty: "中等", season: "秋",
    photos: Array.from({ length: 6 }, (_, i) => "https://example.com/v214-" + i + ".jpg"),
    photoCaptions: ["日落把山脊烧成一条线", "夜里银河压得很低"],
    whyGo: "鱼子西的日落和日照金山，是川西少见的「一天看两次光」的地方。",
    experience: "傍晚在观景台等日落，天黑后营地亮起灯，抬头是整条银河。",
    gain: "带走一整夜的星轨和一张日照金山的照片。",
    fitFor: "有一点徒步经验、能接受 4200 米海拔的人。",
    sellingPoints: [{ title: "本地领队", desc: "熟川西每一处观景机位" }],
    feeInclude: ["往返车费", "专业领队", "高原保险"], feeExclude: ["餐费"],
    includeLeader: true, includeInsurance: true,
    itineraryDays: [
      { label: "成都—新都桥—鱼子西", items: [
        { time: "07:00", text: "成都东站集合出发" },
        { time: "12:30", text: "新都桥午餐" },
        { time: "16:00", text: "抵达鱼子西观景台" },
        { time: "19:30", text: "营地扎营看日落" }
      ] },
      { label: "日出—返程", items: [
        { time: "06:30", text: "观景台看日照金山" },
        { time: "10:00", text: "收拾营地下山" },
        { time: "17:30", text: "回到成都解散" }
      ] }
    ],
    confirmed: [{ key: "services" }, { key: "difficulty" }, { key: "price" }]
  }, extra || {});
}
const A = mkShot();
const ITEM_TEXTS = A.itineraryDays.reduce((acc, d) => acc.concat((d.items || []).map((t) => t.text)), []);

/* ================= §A 行程去重：完整行程只渲染一处 ================= */
try {
  const outline = (typeof buildEditorialOutline === "function") ? buildEditorialOutline(A, (typeof editorialVariantOf === "function" ? editorialVariantOf(A) : null)) : [];
  const routeSecs = outline.filter((s) => s.kind === "route" || /^day/.test(s.key));
  add("A1 叙事大纲不再含 route/day 章节（行程不进叙事）",
    outline.length > 0 && routeSecs.length === 0,
    "sections=" + outline.map((s) => s.key).join(","));
  add("A2 大纲段落里不再出现时刻（时间表只留给 DAY 时间轴）",
    outline.every((s) => !/\d{1,2}:\d{2}/.test((s.paras || []).join(""))),
    (outline.find((s) => /\d{1,2}:\d{2}/.test((s.paras || []).join(""))) || {}).heading || "none");

  let html = "";
  try { html = renderActivityEditorial(A); } catch (e) { html = "THROW:" + ((e && e.message) || e); }
  add("A3 图文详情页渲染不抛错", !has(html, "THROW"), has(html, "THROW") ? html.slice(0, 120) : "");

  /* 核心断言：每个行程条目文本在整页出现 ≤1 次。
     旧版这里会是 2 次（叙事 route 段 1 次 + DAY 时间轴 1 次）。 */
  const dup = ITEM_TEXTS.filter((t) => occ(html, t) > 1);
  const onceN = ITEM_TEXTS.filter((t) => occ(html, t) === 1).length;
  add("A4 ★同一行程条目在页面上只出现一次（旧版 = 2 次大重复）",
    dup.length === 0 && onceN >= 5,
    "重复=" + dup.slice(0, 3).join(" | ") + " 出现1次的条目=" + onceN + "/" + ITEM_TEXTS.length);

  add("A5 DAY 时间轴完整（tl-item = 行程条目总数）",
    occ(html, "tl-item") === ITEM_TEXTS.length,
    "tl=" + occ(html, "tl-item") + " items=" + ITEM_TEXTS.length);
  add("A6「详细行程」区块只出现一次",
    occ(html, "<h3>详细行程</h3>") === 1, "n=" + occ(html, "<h3>详细行程</h3>"));
  add("A7 叙事区（xh-ed-sec）里没有把时间表串成一整段（无「07:00 …；12:30 …」形态）",
    !/0?7:00[^<]{0,40}；[^<]{0,40}12:30/.test(html), "");

  /* ★反向验证：只删了「本地模板复述行程」，没有封死 route 章节这个能力 ——
     AI 总监显式要一节 route 时，页面必须照样渲染出来。 */
  const A2 = mkShot({ pageBlueprint: {
    insight: "一天看两次光，是这场的钩子",
    chosen: "d1",
    pageBlueprint: { coreThesis: "把一天的光看完", openingStrategy: "先看到日落，再等到日出。",
      sections: [{ purpose: "路线", heading: "两天怎么走", contentIntent: "第一天在观景台等日落，第二天等日出。",
        facts: ["海拔 4200m"], assetRequirement: "路线图", kind: "route", visualWeight: 0.5 }] }
  } });
  let html2 = "";
  try { html2 = renderActivityEditorial(A2); } catch (e) { html2 = "THROW:" + ((e && e.message) || e); }
  add("A8 ★反向：AI 总监显式要 route 章节时仍照常渲染（能力未被封死）",
    has(html2, "两天怎么走") && has(html2, "第一天在观景台等日落"),
    has(html2, "THROW") ? html2.slice(0, 100) : "");
} catch (e) {
  add("§A 行程去重断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §B 长地名病句（shortPlaceOf + {P}） ================= */
try {
  add("B1 shortPlaceOf 就绪且在模块表中登记",
    typeof shortPlaceOf === "function" && typeof checkRequiredModules === "function"
    && checkRequiredModules().filter((x) => /shortPlaceOf/.test(x)).length === 0, "");
  const cases = [
    ["四川省甘孜州康定市 · 新都桥镇 · 鱼子西", "鱼子西", "分隔符 → 取最后一段"],
    ["四川省甘孜州康定市新都桥镇鱼子西", "鱼子西", "无分隔符 → 按行政区划后缀取最小地名"],
    ["龙门山", "龙门山", "已够短 → 原样"],
    ["", "", "空值 → 空串"]
  ];
  cases.forEach(([inp, want, why], i) => {
    const got = shortPlaceOf(inp);
    add("B2-" + (i + 1) + " shortPlaceOf(" + (inp || "空") + ") → " + (want || "空") + "（" + why + "）",
      got === want, "got=" + got);
  });

  const dna = (typeof buildActivityDNA === "function") ? buildActivityDNA(A, A.photos) : {};
  const f = (typeof editorialFacts === "function") ? editorialFacts(A, dna) : {};
  add("B3 editorialFacts 的 {P} 用短地名（place 字段仍保留全名）",
    f.P === "鱼子西" && f.place === "四川省甘孜州康定市 · 新都桥镇 · 鱼子西",
    "P=" + f.P + " place=" + f.place);

  const V = (typeof EDITORIAL_ANGLE_VOICE === "object") ? EDITORIAL_ANGLE_VOICE : {};
  const challengeLeads = (typeof fillFrames === "function") ? fillFrames((V.challenge || {}).leads || [], f).join(" | ") : "";
  add("B4 ★challenge 导语填充后不再是病句（「鱼子西不是散步的路线。」）",
    has(challengeLeads, "鱼子西不是散步的路线") && !has(challengeLeads, "甘孜州") && !has(challengeLeads, "新都桥镇"),
    challengeLeads.slice(0, 80));

  const shortAct = mkShot({ place: "龙门山" });
  const fShort = (typeof editorialFacts === "function") ? editorialFacts(shortAct, dna) : {};
  add("B5 短地名不受影响（龙门山的句子仍用龙门山）", fShort.P === "龙门山", "P=" + fShort.P);

  const noPlace = mkShot({ place: "" });
  const fNo = (typeof editorialFacts === "function") ? editorialFacts(noPlace, dna) : {};
  add("B6 没填地点 → {P} 回退「这条路线」（不出现空地名病句）", fNo.P === "这条路线", "P=" + fNo.P);
} catch (e) {
  add("§B 长地名断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §C AI 总监接管导语 / 金句 ================= */
try {
  const bpAct = mkShot({ pageBlueprint: {
    insight: "一天看两次光，是这场的钩子",
    chosen: "d1",
    pageBlueprint: {
      coreThesis: "把一天的光看完", openingStrategy: "先看到日落，再等到日出。",
      sections: [{ purpose: "吸引", heading: "天亮前出发", contentIntent: "第一句\n第二句", facts: [], kind: "scenic", visualWeight: 0.6 }]
    }
  } });
  add("C1 directorLeadOf 读 openingStrategy", directorLeadOf(bpAct) === "先看到日落，再等到日出。", directorLeadOf(bpAct));
  add("C2 directorQuoteOf 读 insight（且不与导语重复）",
    directorQuoteOf(bpAct) === "一天看两次光，是这场的钩子", directorQuoteOf(bpAct));

  /* ★安全闸门：AI 把「创作说明」写进这两个字段时不许贴到页面上（回退模板，而不是把策划笔记给读者看） */
  const metaAct = mkShot({ pageBlueprint: {
    insight: "这句可以用作金句",
    pageBlueprint: { coreThesis: "把一天的光看完", openingStrategy: "从一个具体的清晨切入", sections: [{ heading: "H", contentIntent: "c", kind: "scenic" }] }
  } });
  add("C3 ★策略口吻的 openingStrategy 被拒（回退 coreThesis，而不是把创作说明当导语）",
    directorLeadOf(metaAct) === "把一天的光看完", directorLeadOf(metaAct));

  add("C4 没有 Blueprint 时两个函数都返回空（调用方回退风格包模板）",
    directorLeadOf(A) === "" && directorQuoteOf(A) === "", directorLeadOf(A) + "|" + directorQuoteOf(A));

  let hNo = "", hBp = "";
  try { hNo = renderActivityEditorial(A); } catch (e) { hNo = "THROW:" + e.message; }
  try { hBp = renderActivityEditorial(bpAct); } catch (e) { hBp = "THROW:" + e.message; }
  add("C5 ★带 Blueprint：导语 = openingStrategy，金句 = insight（真的落到页面上）",
    has(hBp, "先看到日落，再等到日出。") && has(hBp, "一天看两次光，是这场的钩子"),
    has(hBp, "THROW") ? hBp.slice(0, 100) : "");
  add("C6 ★不带 Blueprint：页面不出现 Blueprint 的句子（证明 C5 不是空转）",
    !has(hNo, "先看到日落，再等到日出。") && !has(hNo, "一天看两次光，是这场的钩子"), "");
  const iLead = hNo.indexOf("xh-ed-lead");
  add("C7 没有 Blueprint 时导语仍有内容（回退风格包，不留白）",
    iLead >= 0 && !/xh-ed-lead"><\/div>/.test(hNo),
    "threw=" + has(hNo, "THROW") + " lead@" + iLead);

  /* C8 ★连续渲染稳定性（v214 顺手修掉的既有缺陷）：
     成因：第一遍渲染会把 a.date 规范化（syncDepartures：2026-09-26 → 9月26日），
     而风格包指纹里存的是规范化的 date → 第二遍渲染时指纹不符、包被丢弃，
     导语与角度化正文整体消失（老板的体感是「换了版式之后页面变差了」）。
     现在指纹里的日期先归一，只有真的事实变化才会让包失效。 */
  const seq = mkShot();
  const seqLead = [0, 1, 2].map(() => has(renderActivityEditorial(seq), "xh-ed-lead"));
  add("C8 ★同一活动连续渲染 3 次导语都在（日期规范化不再让风格包失效）",
    seqLead.every(Boolean), seqLead.join(","));
} catch (e) {
  add("§C 导语/金句断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §D kind 标签补齐 night ================= */
try {
  add("D1 EDITORIAL_KIND_LABEL 已含 night",
    typeof EDITORIAL_KIND_LABEL === "object" && EDITORIAL_KIND_LABEL.night === "NIGHT",
    JSON.stringify(EDITORIAL_KIND_LABEL));
  const nightBp = mkShot({ pageBlueprint: {
    chosen: "d1",
    pageBlueprint: { coreThesis: "t", openingStrategy: "s",
      sections: [{ purpose: "入夜", heading: "星空下的营地", contentIntent: "夜里银河压得很低。", facts: [], kind: "night", visualWeight: 0.5 }] }
  } });
  let hN = "";
  try { hN = renderActivityEditorial(nightBp); } catch (e) { hN = "THROW:" + e.message; }
  add("D2 Director 的 night 章节在页面上显示 NIGHT（而不是兜底 STORY）",
    has(hN, "NIGHT") && !has(hN, "STORY"), has(hN, "THROW") ? hN.slice(0, 100) : "");
} catch (e) {
  add("§D kind 标签断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §E 活动生成后自动跑一次 Director（配了 AI 才生效） ================= */
try {
  add("E1 autoRunDirector 就绪（挂在活动生成链路上）", typeof autoRunDirector === "function", typeof autoRunDirector);

  /* E2 未配 AI：不触网、不写 Blueprint —— 离线/演示环境行为必须与旧版一致 */
  const noAi = mkShot();
  const savedKey = (typeof getAIKey === "function") ? getAIKey() : "";
  let offlineCalls = 0;
  try {
    getAIKey = function () { return ""; };
    if (typeof getBackendURL === "function") getBackendURL = function () { return ""; };
    clubLLM = async function () { offlineCalls++; return null; };
    await autoRunDirector(noAi);
  } catch (e) { /* 断言在下一行 */ }
  add("E2 未配 AI：直接返回，不调模型、不写 pageBlueprint",
    !noAi.pageBlueprint && offlineCalls === 0, "calls=" + offlineCalls + " bp=" + !!noAi.pageBlueprint);

  /* E3 配了 AI（伪造 Key + 伪造 clubLLM）：跑一次自动编排 → Blueprint 落库 */
  let calls = 0;
  getAIKey = function () { return "sk-v214-test"; };
  clubLLM = async function () {
    calls++;
    return { candidates: [{
      id: "c1", insight: "一天看两次光，是这场的钩子", chosen: "d1",
      directions: [{ id: "d1", name: "光的两次", thesis: "t", why: "w", fitScore: 90 }],
      styleInference: { tone: "沉静", energy: 0.3, warmth: 0.6, visualRichness: 0.8, typography: "衬线", palette: "自然色" },
      pageBlueprint: { coreThesis: "把一天的光看完", contentGoal: "让人想报名", openingStrategy: "先看到日落，再等到日出。", storyArc: "日落→夜→日出",
        sections: [{ purpose: "吸引", heading: "天亮前出发", contentIntent: "第一句", facts: [], assetRequirement: "hero 大图", kind: "scenic", visualWeight: 0.8 }] }
    }] };
  };
  const autoAct = mkShot();
  state.view = "list";   // 不进详情页视图，避免 showView 依赖
  upsert(autoAct); saveState();
  await autoRunDirector(autoAct);
  const stored = (state.activities || []).filter((x) => x.id === autoAct.id)[0] || null;
  add("E3 ★配了 AI：自动编排写入 pageBlueprint 并落库（活动生成后页头就由总监决定）",
    !!autoAct.pageBlueprint && !!stored && !!stored.pageBlueprint && autoAct._directorAutoAt > 0,
    "calls=" + calls + " bp=" + !!autoAct.pageBlueprint + " stored=" + !!(stored && stored.pageBlueprint));

  await autoRunDirector(autoAct);
  add("E4 已有 Blueprint 不重复跑（避免每次生成都白烧一次 AI）",
    calls === 1, "calls=" + calls);

  let hAuto = "";
  try { hAuto = renderActivityEditorial(autoAct); } catch (e) { hAuto = "THROW:" + e.message; }
  add("E5 自动编排后的页面真的换了内容（含总监章节标题 + 总监导语）",
    has(hAuto, "天亮前出发") && has(hAuto, "先看到日落，再等到日出。"), has(hAuto, "THROW") ? hAuto.slice(0, 100) : "");

  /* 还原：别把伪造的 Key 留给后面的契约 */
  getAIKey = function () { return savedKey || ""; };
} catch (e) {
  add("§E 自动编排断言未抛错", false, String((e && e.stack) || e));
}

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
