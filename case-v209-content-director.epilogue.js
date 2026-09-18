/* case-v209-content-director.epilogue.js
   ClubOS v209「AI Content Director（M1）」契约 —— 把 M1 的接入钉死：
     ① directorOutline 把 Blueprint 正确映射成渲染器需要的 outline 形状；
     ② 非法 / 空 Blueprint 返回 null（调用方回退旧双轴，不崩）；
     ③ aiContentDirector 在无事实时离线返回 null（不触发网络，不抛错）；
     ④ Creative Memory 读写不抛错（localStorage 缺失环境也能跑）；
     ⑤ ★渲染接入：带 pageBlueprint 的详情页走 Director 大纲（含 AI 章节标题），
        不带 pageBlueprint 的回退旧双轴（含默认「为什么值得去」）—— 双向验证零回归。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v209-content-director.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};
const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;

/* ============ §A directorOutline：Blueprint → outline 形状 ============ */
add("A1 directorOutline 是函数", typeof directorOutline === "function", "");
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
const ol = directorOutline(sampleBp);
add("A2 ★Blueprint 映射出 3 个章节", ol && ol.length === 3, ol ? ol.length : "null");
const keys = ol ? ol.map((s) => s.key) : [];
add("A3 每节有唯一 key", ol && new Set(keys).size === 3, keys.join(","));
const sec0 = ol ? ol[0] : null;
add("A4 章节字段齐全(key/num/heading/paras/imgCount/imgKind/kind)",
  sec0 && sec0.key && sec0.num === 1 && sec0.heading && Array.isArray(sec0.paras) && sec0.imgCount && sec0.imgKind && sec0.kind,
  sec0 ? JSON.stringify({ k: sec0.key, n: sec0.num, h: sec0.heading, p: sec0.paras.length, ic: sec0.imgCount, ik: sec0.imgKind, kind: sec0.kind }) : "null");
add("A5 ★facts 事实层原样保留（不丢硬事实）",
  sec0 && sec0.paras.some((p) => has(p, "海拔 3200m")), sec0 ? sec0.paras.join(" | ") : "");
add("A6 visualWeight 高→imgCount=3，中→2，低→1",
  ol && ol[0].imgCount === 3 && ol[1].imgCount === 2 && ol[2].imgCount === 1,
  ol ? ol.map((s) => s.imgCount).join(",") : "");
add("A7 kind 受控词表（scenic/experience/route 映射正确）",
  ol && ol[0].kind === "scenic" && ol[1].kind === "experience" && ol[2].kind === "route",
  ol ? ol.map((s) => s.kind).join(",") : "");

/* ============ §B 失败安全 ============ */
add("B1 空 Blueprint 返回 null（回退旧双轴）", directorOutline(null) === null, "");
add("B2 缺 sections 的 Blueprint 返回 null", directorOutline({ pageBlueprint: {} }) === null, "");
add("B3 空 sections 数组返回 null", directorOutline({ pageBlueprint: { sections: [] } }) === null, "");

/* ============ §C aiContentDirector 离线不崩 ============ */
add("C1 aiContentDirector 是函数", typeof aiContentDirector === "function", "");
const noFacts = await (async () => {
  try { return await aiContentDirector({}); } catch (e) { return "THROW:" + e.message; }
})();
add("C2 ★无事实的活动离线返回 null（不触网、不抛错）", noFacts === null, String(noFacts));

/* ============ §D Creative Memory 不崩 ============ */
add("D1 creativeMemoryOf / creativeMemoryPush 是函数",
  typeof creativeMemoryOf === "function" && typeof creativeMemoryPush === "function", "");
let memOk = true;
try {
  creativeMemoryPush({ dir: "秋色沉浸", tone: "松弛", palette: "自然色" });
  const mem = creativeMemoryOf();
  if (!Array.isArray(mem)) memOk = false;
} catch (e) { memOk = false; }
add("D2 ★Creative Memory 读写不抛错", memOk, "");
add("D3 runContentDirector 是函数（regenStyle 入口）", typeof runContentDirector === "function", "");

/* ============ §E ★渲染接入：双向验证 ============ */
const baseAct = { id: "v209", title: "川西秋色两天", type: "徒步", place: "新都桥", days: 2, photos: [],
  itineraryDays: [{ label: "第 1 天", sub: "成都—鱼子西", items: [{ time: "08:00 - 12:00", text: "成都集合出发" }] }] };
const actNoBp = JSON.parse(JSON.stringify(baseAct));
const actWithBp = JSON.parse(JSON.stringify(baseAct));
actWithBp.pageBlueprint = sampleBp;
let htmlNoBp = "", htmlWithBp = "";
try { htmlNoBp = renderActivityEditorial(actNoBp); } catch (e) { htmlNoBp = "THROW:" + e.message; }
try { htmlWithBp = renderActivityEditorial(actWithBp); } catch (e) { htmlWithBp = "THROW:" + e.message; }
add("E1 ★两版详情页都能渲染（不抛错）", !has(htmlNoBp, "THROW") && !has(htmlWithBp, "THROW"),
  has(htmlNoBp, "THROW") ? htmlNoBp.slice(0, 80) : (has(htmlWithBp, "THROW") ? htmlWithBp.slice(0, 80) : ""));
add("E2 ★带 Blueprint 走 Director：含 AI 章节标题「闯进一片不被打扰的秋色」",
  has(htmlWithBp, "闯进一片不被打扰的秋色"), "");
add("E3 ★带 Blueprint 不含默认「为什么值得去」（证明不是旧双轴）",
  !has(htmlWithBp, "为什么值得去"), "");
add("E4 ★不带 Blueprint 回退旧双轴：含默认「为什么值得去」",
  has(htmlNoBp, "为什么值得去"), "");
add("E5 ★带 Blueprint 仍保留行程原文（事实章节不丢）",
  has(htmlWithBp, "成都集合出发"), "");
add("E6 ★带 Blueprint 仍保留费用/报名等事实区块（决策区）",
  has(htmlWithBp, "报名信息") || has(htmlWithBp, "费用说明"), "");

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
