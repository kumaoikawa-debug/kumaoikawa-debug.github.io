/* case-v212-stress-30.epilogue.js
   ClubOS v212「M4 30 场压力测试 harness」契约 —— 单场绿 ≠ 30 场绿：
     ① 30 场确定性差异化场景（含 0/20 照片、无价格、无行程、无类型、超长标题、特殊字符等边界）；
     ② 端到端走真实 runContentDirector（M1→M2→M3 全链路），沙箱内伪造 clubLLM/getAIKey；
     ③ 逐场核对不变量：outline key 唯一 / imgCount∈[1,3] / kind 白名单 / 段落非空 / 节数一致；
     ④ 逐场核对「M2 选优路径真的跑了」（_candidateScore 存在 = 过了 selectBestDirector，
        否则说明静默回退到了 M1 单次调用）；
     ⑤ 连续场次的记忆有界（≤20）与真实累积、M3 局部重生成真的被触发；
     ⑥ 端到端渲染出口也被压（30 场渲染全不抛错）；
     ⑦ 失败安全：AI 返回 null / 畸形 / 空 candidates → 单场失败但不中断整轮、不抛错；
     ⑧ 记忆隔离：压测跑完用户真实 Creative Memory 必须原样还原。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v212-stress-30.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};
const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;
const r4 = (x) => Math.round(x * 1e4) / 1e4;

/* ============ 沙箱内伪造 AI：确定性 3 候选 + 反重复重写分支 ============ */
let STUB_MODE = "good";     // good | null | malformed | empty
let SEQ = 0;
let LAST_CANDS = [];
const TONES = ["松弛", "热血", "沉静"];
const PALS = ["自然色", "冷调", "暖调"];
const KINDS = [["scenic", "experience", "route"], ["route", "night", "scenic", "info"], ["people", "scenic", "info"]];
function mkCand(k, facts) {
  const ks = KINDS[k % 3];
  return {
    id: "c" + k, insight: "洞察" + k,
    directions: [{ id: "d1", name: "方向" + k, thesis: "主张" + k, why: "w", fitScore: 80 }],
    chosen: "d1",
    styleInference: { tone: TONES[k % 3], palette: PALS[k % 3], energy: 0.5, warmth: 0.5, visualRichness: 0.7, typography: "衬线" },
    pageBlueprint: {
      coreThesis: "核心主张" + k, openingStrategy: "开场", contentGoal: "g", storyArc: "a",
      sections: ks.map(function (kind, i) {
        return {
          purpose: "p" + i, heading: "标题" + k + "-" + i, contentIntent: "正文" + i,
          facts: i === 0 ? facts : [], assetRequirement: i === 0 ? "hero 大图" : "无图",
          kind: kind, textDensity: 0.5, visualWeight: i === 0 ? 0.8 : 0.2,
          informationWeight: 0.5, emotionalWeight: 0.5
        };
      })
    }
  };
}
function promptFacts(u) {
  const m = String(u).match(/\u3010\u6d3b\u52a8\u4e8b\u5b9e\u3011\n([\s\S]*?)\n\n/);
  return (m ? m[1] : "").split("\n").filter(Boolean).slice(0, 4);
}
const savedKey = (typeof getAIKey === "function") ? getAIKey : null;
const savedLLM = (typeof clubLLM === "function") ? clubLLM : null;
function installStub() {
  getAIKey = function () { return "stress-stub-key"; };
  clubLLM = async function (o) {
    const u = String((o && o.user) || "");
    if (/\u9700\u8981\u91cd\u5199\u7684\u5c42/.test(u)) return { copy: { sections: [{ heading: "反重复重写标题" }] } };
    if (STUB_MODE === "null") return null;
    if (STUB_MODE === "malformed") return { candidates: [{ foo: 1 }, null, "not-an-object"] };
    if (STUB_MODE === "empty") return { candidates: [] };
    const facts = promptFacts(u);
    const base = SEQ % 3; SEQ++;
    LAST_CANDS = [mkCand(base, facts), mkCand(base + 1, facts), mkCand(base + 2, facts)];
    return { candidates: LAST_CANDS };
  };
}
function restoreStub() { if (savedKey) getAIKey = savedKey; if (savedLLM) clubLLM = savedLLM; }
installStub();

/* ============ §A 场景生成器与数据形状 ============ */
add("A1 cdStressScenarios / cdStressRun / creativeMemoryWrite 就绪",
  typeof cdStressScenarios === "function" && typeof cdStressRun === "function" && typeof creativeMemoryWrite === "function", "");

const scns = cdStressScenarios();
const ids = {};
scns.forEach(function (s) { ids[s.id] = 1; });
add("A2 ★场景 ≥30 场且 id 唯一", scns.length >= 30 && Object.keys(ids).length === scns.length,
  "n=" + scns.length + " uniq=" + Object.keys(ids).length);

const tags = scns.map(function (s) { return s.tag; }).join("|");
const needTags = ["0照片", "20照片", "无价格", "无行程", "超长标题", "特殊字符"];
add("A3 ★覆盖关键边界（0/20 照片、无价格、无行程、超长标题、特殊字符）",
  needTags.every(function (t) { return tags.indexOf(t) >= 0; }),
  needTags.filter(function (t) { return tags.indexOf(t) < 0; }).join(",") || "all covered");

/* 数据形状回归闸门：本里程碑曾因 audience 写成字符串导致渲染层 (a.audience||[]).join 抛错 */
const shapeBad = scns.filter(function (s) {
  const a = s.act;
  return !Array.isArray(a.audience) || !Array.isArray(a.photos) || !Array.isArray(a.itineraryDays) || !a.title;
}).map(function (s) { return s.id; });
add("A4 ★场景数据形状合规（audience/photos/itineraryDays 均为数组 + title 非空）",
  shapeBad.length === 0, shapeBad.join(",") || "ok");

/* ============ §B 30 场端到端压测 ============ */
const R = await cdStressRun(scns);

add("B1 ★30 场全部跑通（failed=0）且 AI 通路为真", R.total === 30 && R.ok === 30 && R.failed === 0 && R.aiReady === true,
  JSON.stringify({ total: R.total, ok: R.ok, failed: R.failed, aiReady: R.aiReady }));
add("B2 ★outline 不变量零违规（key 唯一 / imgCount 1-3 / kind 白名单 / 段落非空 / 节数一致）",
  R.badOutline === 0, "badOutline=" + R.badOutline);
const lenMismatch = R.runs.filter(function (r) { return r.ok && r.outlineLen !== r.sections; }).map(function (r) { return r.id; });
add("B3 逐场 outline 节数 = Blueprint 节数", lenMismatch.length === 0, lenMismatch.join(",") || "ok");
const noScore = R.runs.filter(function (r) { return r.ok && r.total == null; }).map(function (r) { return r.id; });
add("B4 ★逐场都走 M2 选优路径（_candidateScore 存在，未静默回退 M1 单次调用）",
  noScore.length === 0, noScore.join(",") || "all via selectBestDirector");
add("B5 ★逐场创意指纹完整（dir/tone/palette/thesis/layout/copy）", R.badFingerprint === 0,
  "badFingerprint=" + R.badFingerprint);
const lastRec = R.runs[R.runs.length - 1] || {};
add("B6 ★记忆有界且真实累积：峰值 ≤20 且末场 = 20",
  R.memPeak <= 20 && R.memPeak >= 8 && lastRec.memSize === 20,
  JSON.stringify({ memPeak: R.memPeak, last: lastRec.memSize }));
add("B7 ★端到端渲染出口零抛错且产页非空", R.badRender === 0 && R.runs.every(function (r) { return !r.ok || (r.htmlLen || 0) > 1000; }),
  "badRender=" + R.badRender + " minLen=" + Math.min.apply(null, R.runs.filter(function (r) { return r.ok; }).map(function (r) { return r.htmlLen || 0; })));
add("B8 ★多候选→选优链路连通（30 场产出 ≥3 种版式，非单模板复读）", R.uniqLayouts >= 3,
  "uniqLayouts=" + R.uniqLayouts);
const repInRange = R.maxCopy >= 0 && R.maxCopy <= 1 && R.maxLayout >= 0 && R.maxLayout <= 1 && R.maxSem >= 0 && R.maxSem <= 1;
add("B9 撞车度指标有界 ∈[0,1]", repInRange,
  JSON.stringify({ copy: R.maxCopy, layout: R.maxLayout, semantic: R.maxSem }));

/* ============ §C 边界专项 ============ */
const rec0 = R.runs.filter(function (r) { return r.id === "stress-1"; })[0] || {};
add("C1 ★0 照片场：不崩且素材满足度=0（无照片不该被要求配图）",
  rec0.ok === true && rec0.asset === 0, JSON.stringify({ ok: rec0.ok, asset: rec0.asset }));

/* 事实保真：无价格活动 + AI 不产价格 → Blueprint/outline 里不得凭空出现价格 */
const noPriceSc = scns.filter(function (s) { return s.tag.indexOf("无价格") >= 0; })[0];
const noPriceAct = JSON.parse(JSON.stringify(noPriceSc.act));
await runContentDirector(noPriceAct);
const noPriceBp = noPriceAct.pageBlueprint;
const noPriceOutline = noPriceBp ? directorOutline(noPriceBp) : null;
const noPriceText = JSON.stringify(noPriceBp || {}) + JSON.stringify(noPriceOutline || []);
add("C2 ★事实保真：无价格活动不凭空生成价格（Blueprint 与 outline 均不含 ¥）",
  !!noPriceBp && noPriceText.indexOf("\u00a5") < 0 && noPriceText.indexOf("¥") < 0,
  noPriceText.indexOf("¥") >= 0 ? "FABRICATED-PRICE" : "clean");

["边界:超长标题", "边界:特殊字符", "边界:几乎全空"].forEach(function (t, i) {
  const r = R.runs.filter(function (x) { return x.tag === t; })[0] || {};
  add("C" + (3 + i) + " 边界场渲染不抛错：" + t,
    r.ok === true && r.renderOk === true, JSON.stringify({ ok: r.ok, renderOk: r.renderOk, err: r.renderError || "" }));
});

/* ============ §D 连续场次的反重复 ============ */
add("D1 ★30 场中 M3 局部重生成真的被触发（撞车 → 局部重写）", R.repaired >= 1, "repaired=" + R.repaired);

creativeMemoryWrite([directorFingerprintOf(mkCand(0, ["x"]))]);
const pair = [mkCand(0, ["x"]), mkCand(1, ["y"])];
const picked = selectBestDirector(pair, scns[0].act);
add("D2 ★历史已知撞车时倾向选差异化候选（记忆含「松弛/自然色/方向0」→ 不选它）",
  !!picked && picked.blueprint.styleInference.tone === "热血" && picked.blueprint.styleInference.palette === "冷调",
  picked ? JSON.stringify({ tone: picked.blueprint.styleInference.tone, palette: picked.blueprint.styleInference.palette }) : "null");
creativeMemoryWrite([]);

/* ============ §E 失败安全：三种 AI 故障 ============ */
const small = scns.slice(0, 3);
const modes = ["null", "malformed", "empty"];
let eOk = true, eDetail = [];
for (let i = 0; i < modes.length; i++) {
  STUB_MODE = modes[i];
  let bad = null;
  try { bad = await cdStressRun(small); } catch (e) { bad = "THROW:" + e.message; }
  const ok = bad && bad.total === 3 && bad.ok === 0
    && bad.runs.every(function (r) { return r.ok === false && !r.error; });
  if (!ok) eOk = false;
  eDetail.push(modes[i] + "=" + (bad && bad.total !== undefined ? bad.ok + "/" + bad.total : String(bad)));
}
add("E1 ★AI 故障（null/畸形/空 candidates）：单场失败但不抛错、整轮不中断", eOk, eDetail.join(" "));

STUB_MODE = "good";
const rec = await cdStressRun(small);
add("E2 ★故障后恢复：切回正常 AI 立即 3/3 成功（状态未被污染）",
  rec.ok === 3 && rec.failed === 0, JSON.stringify({ ok: rec.ok, failed: rec.failed }));

/* ============ §F 记忆隔离与不回归 ============ */
creativeMemoryWrite([{ dir: "SENTINEL", tone: "S", palette: "S" }]);
const iso = await cdStressRun(scns.slice(0, 5));
const memAfter = creativeMemoryOf();
add("F1 ★记忆隔离：压测跑完用户真实 Creative Memory 原样还原（哨兵未被动过）",
  iso.memoryRestored === true && memAfter.length === 1 && memAfter[0].dir === "SENTINEL",
  JSON.stringify({ restored: iso.memoryRestored, len: memAfter.length }));
creativeMemoryWrite([]);

/* fixture 说明：回退路径（buildEditorialOutline）的默认章节集合会随活动数据变化
   （有照片/有价格的场次不一定出现「为什么值得去」区块）。要断言「回退真的回退」，
   必须用一个已知稳定的形态 —— 这里沿用 M1/M3 契约的 0 照片无价格形态。 */
const renderAct = JSON.parse(JSON.stringify(scns.filter(function (s) { return s.tag === "边界:0照片"; })[0].act));
const withBp = JSON.parse(JSON.stringify(renderAct));
withBp.pageBlueprint = mkCand(0, ["D1 集合出发"]);
const withoutBp = JSON.parse(JSON.stringify(renderAct));
let hw = "", hn = "";
try { hw = renderActivityEditorial(withBp); } catch (e) { hw = "THROW:" + e.message; }
try { hn = renderActivityEditorial(withoutBp); } catch (e) { hn = "THROW:" + e.message; }
add("F2 ★渲染双向不回归：带 Blueprint 走 Director（含 AI 标题、无默认「为什么值得去」）/ 不带回退旧双轴",
  !has(hw, "THROW") && has(hw, "标题0-0") && !has(hw, "为什么值得去") && !has(hn, "THROW") && has(hn, "为什么值得去"),
  JSON.stringify({ withBp: has(hw, "标题0-0"), noDefault: !has(hw, "为什么值得去"), fallback: has(hn, "为什么值得去") }));

add("F3 M1/M2/M3 导出仍在（aiContentDirector/directorOutline/scoreDirectorCandidate/repetitionReport/aiDirectorRepair）",
  typeof aiContentDirector === "function" && typeof directorOutline === "function"
  && typeof scoreDirectorCandidate === "function" && typeof repetitionReport === "function"
  && typeof aiDirectorRepair === "function" && typeof runContentDirector === "function", "");

restoreStub();

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return {
  ok: passed === total, total, passed, checks,
  /* 非致命但值得知道的现场事实（不进断言，避免把既有问题记成本次回归失败） */
  knownIssues: [
    "无价格活动在详情页仍渲染「¥0/人」（cta/dock），非本里程碑引入，建议后续做诚实空态"
  ],
  metrics: {
    total: R.total, ok: R.ok, memPeak: R.memPeak, uniqLayouts: R.uniqLayouts,
    maxCopy: r4(R.maxCopy), maxLayout: r4(R.maxLayout), maxSem: r4(R.maxSem),
    repaired: R.repaired, badOutline: R.badOutline, badRender: R.badRender
  }
};
