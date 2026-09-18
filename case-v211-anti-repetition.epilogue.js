/* case-v211-anti-repetition.epilogue.js
   ClubOS v211「M3 三层反重复（Anti-Repetition）」契约 —— 把三层撞车检测与局部重生成钉死：
     ① 三层相似度离线可算：copySimilarity / layoutSimilarity / semanticSimilarity；
     ② layoutFingerprint 产出可存储的 kind 序列；layoutSimilarity 同时接受
        「指纹串」与「Blueprint 对象」两种入参；
     ③ repetitionReport 汇总与 Creative Memory 的最大相似度，超阈值判定 over + layers；
     ④ directorFingerprintOf 富化指纹（兼容 M2 的 tone/palette/dir，补 thesis/layout/copy）；
     ⑤ aiDirectorRepair 离线（无 AI）返回 null，不触网；
     ⑥ ★不破坏 M1/M2 契约：directorOutline 仍 3 节、scoreDirectorCandidate 仍可算、
        renderActivityEditorial 双向（带 Blueprint 走 Director / 不带回退旧双轴）。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v211-anti-repetition.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};
const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;
const r3 = (x) => Math.round(x * 1000) / 1000;

/* 供打分/渲染复用的样例 Blueprint */
const sampleBp = {
  insight: "秋色是这场最硬的钩子",
  directions: [{ id: "d1", name: "秋色沉浸", thesis: "t", why: "w", fitScore: 90 }],
  chosen: "d1",
  styleInference: { tone: "松弛", energy: 0.4, warmth: 0.7, visualRichness: 0.8, typography: "衬线", palette: "自然色" },
  pageBlueprint: {
    coreThesis: "核心主张",
    openingStrategy: "从一个具体的清晨切入",
    sections: [
      { purpose: "吸引", heading: "闯进一片不被打扰的秋色", contentIntent: "第一句\n第二句", facts: ["海拔 3200m，单日 12 公里"], assetRequirement: "hero 大图", kind: "scenic", textDensity: 0.5, visualWeight: 0.8, informationWeight: 0.3, emotionalWeight: 0.9 },
      { purpose: "体验", heading: "脚步里的慢", contentIntent: "第三句", facts: [], assetRequirement: "2-3 张体验图", kind: "experience", textDensity: 0.6, visualWeight: 0.5, informationWeight: 0.2, emotionalWeight: 0.7 },
      { purpose: "路线", heading: "两天怎么走", contentIntent: "路线说明", facts: ["D1 成都—新都桥"], assetRequirement: "路线图", kind: "route", textDensity: 0.7, visualWeight: 0.2, informationWeight: 0.8, emotionalWeight: 0.2 }
    ]
  }
};
const act = { id: "v211", title: "川西秋色两天", type: "徒步", place: "新都桥", days: 2, photos: [1, 2, 3, 4],
  price: 1280, limitUnit: "人", difficulty: "轻松", meeting: "成都", elevation: 3200,
  itineraryDays: [{ label: "第 1 天", items: [{ time: "08:00", text: "成都集合出发" }] }] };

/* ============ §A 三层相似度（离线、不触网） ============ */
add("A1 四个相似度函数就绪",
  typeof copySimilarity === "function" && typeof layoutSimilarity === "function"
  && typeof semanticSimilarity === "function" && typeof layoutFingerprint === "function", "");

const cSame = copySimilarity("成都集合出发，海拔三千二", "成都集合出发，海拔三千二");
const cDiff = copySimilarity("成都集合出发", "深夜的篝火与整片银河");
const cEmpty = copySimilarity("", "随便一段");
add("A2 ★copySimilarity：相同≈1、无关<0.3、空=0",
  cSame >= 0.95 && cDiff < 0.3 && cEmpty === 0,
  "same=" + r3(cSame) + " diff=" + r3(cDiff) + " empty=" + cEmpty);

const fp = layoutFingerprint(sampleBp);
add("A3 layoutFingerprint 产出 kind 序列串", fp === "scenic>experience>route", String(fp));

const bpOther = { pageBlueprint: { sections: [
  { kind: "info", heading: "须知" }, { kind: "night", heading: "星空" }
] } };
const lSame = layoutSimilarity(sampleBp, sampleBp);
const lDiff = layoutSimilarity(sampleBp, bpOther);
add("A4 ★layoutSimilarity：同结构=1、异结构<0.4",
  lSame >= 0.999 && lDiff < 0.4, "same=" + r3(lSame) + " diff=" + r3(lDiff));
add("A5 ★layoutSimilarity 同时接受「指纹串」与「Blueprint」入参",
  layoutSimilarity("scenic>experience>route", sampleBp) >= 0.999
  && layoutSimilarity(fp, "scenic>experience>route") >= 0.999, "");

const sSame = semanticSimilarity("秋色是这场最硬的钩子", "秋色是这场最硬的钩子");
const sDiff = semanticSimilarity("秋色是这场最硬的钩子", "城市里的慢生活");
add("A6 ★semanticSimilarity：相同=1、无关<0.3", sSame >= 0.999 && sDiff < 0.3,
  "same=" + r3(sSame) + " diff=" + r3(sDiff));

/* ============ §B repetitionReport 阈值判定 ============ */
add("B1 repetitionReport / directorFingerprintOf 就绪",
  typeof repetitionReport === "function" && typeof directorFingerprintOf === "function", "");

const repEmpty = repetitionReport(sampleBp, []);
add("B2 空记忆 → over=false 且无撞车层",
  repEmpty.over === false && repEmpty.layers.length === 0,
  JSON.stringify({ over: repEmpty.over, layers: repEmpty.layers }));

const fpSelf = directorFingerprintOf(sampleBp);
const repSelf = repetitionReport(sampleBp, [fpSelf]);
add("B3 ★记忆含自身指纹 → over=true 且三层全中",
  repSelf.over === true && repSelf.layers.length === 3
  && repSelf.layers.indexOf("copy") >= 0 && repSelf.layers.indexOf("layout") >= 0 && repSelf.layers.indexOf("semantic") >= 0,
  JSON.stringify(repSelf.layers));

const repSem = repetitionReport(sampleBp, [{ thesis: "核心主张" }]);
add("B4 只撞语义层 → layers 恰为 [semantic]",
  repSem.layers.length === 1 && repSem.layers[0] === "semantic", JSON.stringify(repSem.layers));

const repLay = repetitionReport(sampleBp, [{ layout: "scenic>experience>route" }]);
add("B5 只撞版式层 → layers 恰为 [layout]",
  repLay.layers.length === 1 && repLay.layers[0] === "layout", JSON.stringify(repLay.layers));

const repCopy = repetitionReport(sampleBp, [{ copy: fpSelf.copy }]);
add("B6 只撞文案层 → layers 恰为 [copy]",
  repCopy.layers.length === 1 && repCopy.layers[0] === "copy", JSON.stringify(repCopy.layers));

/* ============ §C directorFingerprintOf 富化指纹 ============ */
add("C1 ★指纹含 dir/tone/palette/thesis/layout/copy 且与 Blueprint 一致",
  fpSelf && typeof fpSelf.dir === "string" && fpSelf.tone && fpSelf.palette
  && fpSelf.thesis === "核心主张" && fpSelf.layout === layoutFingerprint(sampleBp)
  && typeof fpSelf.copy === "string" && has(fpSelf.copy, "闯进一片不被打扰的秋色"),
  JSON.stringify({ dir: fpSelf.dir, tone: fpSelf.tone, thesis: fpSelf.thesis, layout: fpSelf.layout }));

/* ============ §D aiDirectorRepair 离线安全 ============ */
add("D1 aiDirectorRepair 是函数", typeof aiDirectorRepair === "function", "");
const repaired = await (async () => {
  try { return await aiDirectorRepair(act, sampleBp, ["copy"]); } catch (e) { return "THROW:" + e.message; }
})();
add("D2 ★离线（无 AI）返回 null，不触网、不抛错", repaired === null, String(repaired));

/* ============ §E ★N 回归：M1/M2 契约不破 + 渲染双向 ============ */
add("E1 directorOutline 仍把 Blueprint 映射成 3 个章节（M1 不破）",
  (function () { const o = directorOutline(sampleBp); return o && o.length === 3; })(), "");

const sc = scoreDirectorCandidate(sampleBp, act, []);
add("E2 scoreDirectorCandidate 仍可算且 total∈[0,1]（M2 不破）",
  sc && typeof sc.total === "number" && sc.total >= 0 && sc.total <= 1, sc ? r3(sc.total) : "null");
add("E3 runContentDirector 仍是函数（regenStyle 入口）", typeof runContentDirector === "function", "");

const baseAct = { id: "v211r", title: "川西秋色两天", type: "徒步", place: "新都桥", days: 2, photos: [],
  itineraryDays: [{ label: "第 1 天", sub: "成都—鱼子西", items: [{ time: "08:00 - 12:00", text: "成都集合出发" }] }] };
const actNoBp = JSON.parse(JSON.stringify(baseAct));
const actWithBp = JSON.parse(JSON.stringify(baseAct));
actWithBp.pageBlueprint = sampleBp;
let htmlNoBp = "", htmlWithBp = "";
try { htmlNoBp = renderActivityEditorial(actNoBp); } catch (e) { htmlNoBp = "THROW:" + e.message; }
try { htmlWithBp = renderActivityEditorial(actWithBp); } catch (e) { htmlWithBp = "THROW:" + e.message; }
add("E4 ★两版详情页都能渲染（不抛错）", !has(htmlNoBp, "THROW") && !has(htmlWithBp, "THROW"),
  has(htmlNoBp, "THROW") ? htmlNoBp.slice(0, 80) : (has(htmlWithBp, "THROW") ? htmlWithBp.slice(0, 80) : ""));
add("E5 ★带 Blueprint 走 Director：含 AI 章节标题且不含默认「为什么值得去」",
  has(htmlWithBp, "闯进一片不被打扰的秋色") && !has(htmlWithBp, "为什么值得去"), "");
add("E6 ★不带 Blueprint 回退旧双轴：含默认「为什么值得去」",
  has(htmlNoBp, "为什么值得去"), "");

/* ============ §F ★（沙箱内伪造 AI 可用）局部重写只改撞车层 ============ */
/* clubLLM / getAIKey 是 classic script 的顶层函数声明（可重赋值）。
   伪造 AI 后验证：只覆盖被点名的层，其它层/事实/节数一律保留。 */
let fOk = false, fDetail = "skipped";
try {
  if (typeof clubLLM === "function" && typeof getAIKey === "function") {
    const savedKey = getAIKey, savedLLM = clubLLM;
    getAIKey = function () { return "epilogue-stub-key"; };
    clubLLM = async function () { return { copy: { sections: [{ heading: "反重复改后标题" }] } }; };
    const before = JSON.parse(JSON.stringify(sampleBp));
    const fixed = await aiDirectorRepair(act, before, ["copy"]);
    fOk = !!(fixed && fixed._repairedAt
      && fixed.pageBlueprint.sections.length === 3
      && fixed.pageBlueprint.sections[0].heading === "反重复改后标题"
      && fixed.pageBlueprint.sections[1].heading === before.pageBlueprint.sections[1].heading
      && fixed.pageBlueprint.sections[0].contentIntent === before.pageBlueprint.sections[0].contentIntent
      && (fixed.pageBlueprint.sections[0].facts || []).join() === (before.pageBlueprint.sections[0].facts || []).join());
    fDetail = fixed ? JSON.stringify({ h0: fixed.pageBlueprint.sections[0].heading, h1: fixed.pageBlueprint.sections[1].heading, n: fixed.pageBlueprint.sections.length }) : "null";
    getAIKey = savedKey; clubLLM = savedLLM;
  } else { fDetail = "no clubLLM/getAIKey in scope"; }
} catch (e) { fOk = false; fDetail = "THROW:" + e.message; }
add("F1 ★（沙箱伪造 AI）局部重写只覆盖撞车层、保留事实/其余层/节数", fOk, fDetail);

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
