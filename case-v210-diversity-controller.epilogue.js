/* case-v210-diversity-controller.epilogue.js
   ClubOS v210「Diversity Controller（M2）」契约 —— 把 M2 的接入钉死：
     ① scoreDirectorCandidate 三维度（fit / asset / history）离线可算、取值 [0,1]；
     ② history 维度对「撞最近创意记忆」的候选降权；
     ③ asset 维度：可用照片数 < 配图需求时得分 < 1；
     ④ selectBestDirector 从 3 候选选综合分最高者；fit 相同时保持时素材分高者胜；
        并列（totally equal）不崩、带 _candidateScore；
     ⑤ aiContentDirectorCandidates({}) 无事实离线返 null（不触网、不抛错）；
     ⑥ ★不破坏 M1 渲染契约：directorOutline 仍出 3 节、renderActivityEditorial
        带 Blueprint 走 Director、不带回退旧双轴（双向验证零回归）。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v210-diversity-controller.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};
const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;
const r2 = (x) => Math.round(x * 1000) / 1000;

/* 一个带事实、有 10 张照片的活动，供打分器离线运行 */
const act = {
  id: "m2", title: "川西秋色两天", type: "徒步", place: "新都桥", days: 2,
  photos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  price: 1280, limitUnit: "人", difficulty: "轻松", dateMD: "10.18", meeting: "成都",
  distance: 320, elevation: 3200,
  itineraryDays: [{ label: "第 1 天", items: [{ time: "08:00", text: "成都集合出发" }] }]
};

/* 候选 A：高 fit（用活动事实）/ 高 asset（图需 < 照片数）/ 新颖调性 */
const candA = {
  id: "cA",
  insight: "海拔 3200 的新都桥秋色是钩子",
  directions: [{ id: "d1", name: "秋色沉浸", thesis: "t", why: "w", fitScore: 90 }], chosen: "d1",
  styleInference: { tone: "热血", energy: 0.5, warmth: 0.6, visualRichness: 0.8, typography: "无衬线", palette: "冷调" },
  pageBlueprint: { coreThesis: "核心主张", sections: [
    { purpose: "吸引", heading: "闯进一片不被打扰的秋色", contentIntent: "第一句\n第二句", facts: ["海拔 3200m，单日 12 公里", "成都集合出发"], assetRequirement: "hero 大图", kind: "scenic", textDensity: 0.5, visualWeight: 0.8, informationWeight: 0.3, emotionalWeight: 0.9 },
    { purpose: "体验", heading: "脚步里的慢", contentIntent: "第三句", facts: ["新都桥两天徒步"], assetRequirement: "2-3 张体验图", kind: "experience", textDensity: 0.6, visualWeight: 0.5, informationWeight: 0.2, emotionalWeight: 0.7 }
  ] }
};
/* 候选 B：低 fit（几乎不用活动事实）/ 图需大（asset 较低） */
const candB = {
  id: "cB",
  insight: "一场普通的周末出行",
  directions: [{ id: "d1", name: "轻松周末", thesis: "t", why: "w", fitScore: 60 }], chosen: "d1",
  styleInference: { tone: "松弛", energy: 0.3, warmth: 0.7, visualRichness: 0.5, typography: "衬线", palette: "自然色" },
  pageBlueprint: { coreThesis: "核心主张", sections: [
    { purpose: "吸引", heading: "周末去走走", contentIntent: "随便逛逛", facts: ["天气不错"], assetRequirement: "hero 大图", kind: "scenic", textDensity: 0.5, visualWeight: 0.9, informationWeight: 0.3, emotionalWeight: 0.9 },
    { purpose: "体验", heading: "慢慢玩", contentIntent: "放松一下", facts: [], assetRequirement: "2-3 张体验图", kind: "experience", textDensity: 0.6, visualWeight: 0.9, informationWeight: 0.2, emotionalWeight: 0.7 },
    { purpose: "路线", heading: "路线", contentIntent: "随便走", facts: [], assetRequirement: "路线图", kind: "route", textDensity: 0.7, visualWeight: 0.9, informationWeight: 0.8, emotionalWeight: 0.2 },
    { purpose: "吃住", heading: "吃住", contentIntent: "住得舒服", facts: [], assetRequirement: "人物特写", kind: "people", textDensity: 0.5, visualWeight: 0.9, informationWeight: 0.5, emotionalWeight: 0.5 },
    { purpose: "夜", heading: "星空", contentIntent: "看星星", facts: [], assetRequirement: "无图", kind: "night", textDensity: 0.5, visualWeight: 0.9, informationWeight: 0.2, emotionalWeight: 0.8 },
    { purpose: "信息", heading: "须知", contentIntent: "注意事项", facts: [], assetRequirement: "无图", kind: "info", textDensity: 0.5, visualWeight: 0.9, informationWeight: 0.9, emotionalWeight: 0.2 }
  ] }
};
/* 候选 C：中等（调性不同，且事实重叠明显弱于 A，确保 A 综合分清晰占优） */
const candC = {
  id: "cC",
  insight: "松弛的山系高级感",
  directions: [{ id: "d1", name: "山系松弛", thesis: "t", why: "w", fitScore: 80 }], chosen: "d1",
  styleInference: { tone: "松弛", energy: 0.4, warmth: 0.8, visualRichness: 0.7, typography: "衬线", palette: "自然色" },
  pageBlueprint: { coreThesis: "核心主张", sections: [
    { purpose: "吸引", heading: "不被打扰的秋色", contentIntent: "第一句", facts: ["新都桥两天徒步"], assetRequirement: "hero 大图", kind: "scenic", textDensity: 0.5, visualWeight: 0.7, informationWeight: 0.4, emotionalWeight: 0.8 },
    { purpose: "体验", heading: "慢慢走", contentIntent: "第二句", facts: [], assetRequirement: "2-3 张体验图", kind: "experience", textDensity: 0.6, visualWeight: 0.4, informationWeight: 0.3, emotionalWeight: 0.6 }
  ] }
};

/* ============ §A scoreDirectorCandidate 三维度（离线、不触网） ============ */
add("A1 scoreDirectorCandidate 是函数", typeof scoreDirectorCandidate === "function", "");
const scA = scoreDirectorCandidate(candA, act, []);
add("A2 返回 {fit,asset,history,total} 四字段",
  scA && typeof scA.fit === "number" && typeof scA.asset === "number" && typeof scA.history === "number" && typeof scA.total === "number",
  JSON.stringify({ fit: r2(scA.fit), asset: r2(scA.asset), history: r2(scA.history), total: r2(scA.total) }));
const in01 = (x) => x >= 0 && x <= 1;
add("A3 三维度取值均在 [0,1]",
  in01(scA.fit) && in01(scA.asset) && in01(scA.history) && in01(scA.total),
  JSON.stringify({ fit: r2(scA.fit), asset: r2(scA.asset), history: r2(scA.history), total: r2(scA.total) }));

/* 历史重复度降权：撞最近记忆（热血 / 冷调）应被惩罚 */
const memHit = [{ tone: "热血", palette: "冷调", dir: "硬核登山" }];
const scA_hit = scoreDirectorCandidate(candA, act, memHit);
const scA_clean = scoreDirectorCandidate(candA, act, []);
add("A4 ★撞最近创意记忆 → history 维度被降权（< 无记忆时）",
  scA_hit.history < scA_clean.history,
  "hit=" + r2(scA_hit.history) + " clean=" + r2(scA_clean.history));

/* 素材满足度：图需 > 照片数 → asset < 1；图需 ≤ 照片数 → asset = 1 */
const scB = scoreDirectorCandidate(candB, act, []);
add("A5 ★可用照片不足满足配图需求 → asset < 1",
  scB.asset < 1, "assetB=" + r2(scB.asset) + " need>photoN(10)");
add("A6 图需 ≤ 照片数 → asset = 1",
  scA.asset === 1, "assetA=" + r2(scA.asset));

/* ============ §B selectBestDirector 选最优 ============ */
add("B1 selectBestDirector 是函数", typeof selectBestDirector === "function", "");
const pick = selectBestDirector([candA, candB, candC], act);
add("B2 ★三候选中选综合分最高者（cA 高 fit+高 asset）",
  pick && pick.blueprint && pick.blueprint.id === "cA", pick ? pick.blueprint.id : "null");

/* fit 相同时，素材满足度高者胜（asset 影响） */
const sameFacts = ["成都集合出发", "海拔 3200m，单日 12 公里"];
const candAssetHigh = {
  id: "h", insight: "i", directions: [{ id: "d1", name: "n", thesis: "t", why: "w", fitScore: 80 }], chosen: "d1",
  styleInference: { tone: "松弛", palette: "自然色" },
  pageBlueprint: { sections: [
    { purpose: "p", heading: "h1", contentIntent: "c", facts: sameFacts, kind: "scenic", visualWeight: 0.9 }
  ] }
};
const candAssetLow = {
  id: "l", insight: "i", directions: [{ id: "d1", name: "n", thesis: "t", why: "w", fitScore: 80 }], chosen: "d1",
  styleInference: { tone: "松弛", palette: "自然色" },
  pageBlueprint: { sections: [] }
};
/* 给 candAssetLow 补满 6 节高 visualWeight（need 大 → asset 低）以拉开素材分 */
for (let i = 0; i < 6; i++) candAssetLow.pageBlueprint.sections.push(
  { purpose: "p" + i, heading: "h" + i, contentIntent: "c", facts: sameFacts, kind: "scenic", visualWeight: 0.9 });
const pick2 = selectBestDirector([candAssetHigh, candAssetLow], act);
add("B3 ★fit 相同时保持 → 素材满足度高者（asset 高）胜出",
  pick2 && pick2.blueprint && pick2.blueprint.id === "h", pick2 ? pick2.blueprint.id : "null");

/* 并列（totally equal）安全：两候选内容完全相同 → 不崩、带 _candidateScore */
const twin = JSON.parse(JSON.stringify(candA));
twin.id = "twin";
const pick3 = selectBestDirector([candA, twin], act);
add("B4 并列候选不崩且返回其一并带 _candidateScore",
  pick3 && pick3.blueprint && pick3.blueprint._candidateScore
    && typeof pick3.blueprint._candidateScore.total === "number",
  pick3 ? (pick3.blueprint.id + " total=" + r2(pick3.blueprint._candidateScore.total)) : "null");

/* ============ §C aiContentDirectorCandidates 离线不崩 ============ */
add("C1 aiContentDirectorCandidates 是函数", typeof aiContentDirectorCandidates === "function", "");
const noFacts = await (async () => {
  try { return await aiContentDirectorCandidates({}); } catch (e) { return "THROW:" + e.message; }
})();
add("C2 ★无事实的活动离线返回 null（不触网、不抛错）", noFacts === null, String(noFacts));

/* ============ §D ★不破坏 M1 渲染契约（双向验证零回归） ============ */
const sampleBp = {
  insight: "秋色是这场最硬的钩子",
  directions: [{ id: "d1", name: "秋色沉浸", thesis: "t", why: "w", fitScore: 90 }],
  chosen: "d1",
  styleInference: { tone: "松弛", energy: 0.4, warmth: 0.7, visualRichness: 0.8, typography: "衬线", palette: "自然色" },
  pageBlueprint: {
    coreThesis: "核心主张",
    sections: [
      { purpose: "吸引", heading: "闯进一片不被打扰的秋色", contentIntent: "第一句\n第二句", facts: ["海拔 3200m，单日 12 公里"], assetRequirement: "hero 大图", kind: "scenic", textDensity: 0.5, visualWeight: 0.8, informationWeight: 0.3, emotionalWeight: 0.9 },
      { purpose: "体验", heading: "脚步里的慢", contentIntent: "第三句", facts: [], assetRequirement: "2-3 张体验图", kind: "experience", textDensity: 0.6, visualWeight: 0.5, informationWeight: 0.2, emotionalWeight: 0.7 },
      { purpose: "路线", heading: "两天怎么走", contentIntent: "路线说明", facts: ["D1 成都—新都桥"], assetRequirement: "路线图", kind: "route", textDensity: 0.7, visualWeight: 0.2, informationWeight: 0.8, emotionalWeight: 0.2 }
    ]
  }
};
add("D1 directorOutline 仍把 Blueprint 映射成 3 个章节（M1 契约不破）",
  (function () { const o = directorOutline(sampleBp); return o && o.length === 3; })(), "");
add("D2 runContentDirector 仍是函数（regenStyle 入口）", typeof runContentDirector === "function", "");

const baseAct = { id: "v210", title: "川西秋色两天", type: "徒步", place: "新都桥", days: 2, photos: [],
  itineraryDays: [{ label: "第 1 天", sub: "成都—鱼子西", items: [{ time: "08:00 - 12:00", text: "成都集合出发" }] }] };
const actNoBp = JSON.parse(JSON.stringify(baseAct));
const actWithBp = JSON.parse(JSON.stringify(baseAct));
actWithBp.pageBlueprint = sampleBp;
let htmlNoBp = "", htmlWithBp = "";
try { htmlNoBp = renderActivityEditorial(actNoBp); } catch (e) { htmlNoBp = "THROW:" + e.message; }
try { htmlWithBp = renderActivityEditorial(actWithBp); } catch (e) { htmlWithBp = "THROW:" + e.message; }
add("D3 ★两版详情页都能渲染（不抛错）", !has(htmlNoBp, "THROW") && !has(htmlWithBp, "THROW"),
  has(htmlNoBp, "THROW") ? htmlNoBp.slice(0, 80) : (has(htmlWithBp, "THROW") ? htmlWithBp.slice(0, 80) : ""));
add("D4 ★带 Blueprint 走 Director：含 AI 章节标题且不含默认「为什么值得去」",
  has(htmlWithBp, "闯进一片不被打扰的秋色") && !has(htmlWithBp, "为什么值得去"), "");
add("D5 ★不带 Blueprint 回退旧双轴：含默认「为什么值得去」",
  has(htmlNoBp, "为什么值得去"), "");

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
