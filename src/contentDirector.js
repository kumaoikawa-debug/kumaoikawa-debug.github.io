/* =======================================================================
 * contentDirector.js — M1 of《活动详情页 AI 智能宣传重构 V1.0》
 * -----------------------------------------------------------------------
 * AI Content Director：把「活动事实 + 可用照片 + 目标人群 + 品牌调性 + 历史创意」
 * 推导成一份动态 Page Blueprint，而不是套用「视觉杂志型 / 纪实型 / 专业信息型 /
 * 生活方式型」之类预设风格模板。
 *
 * 本文件只做 M1 的最小落地：
 *   ① aiContentDirector  —— 单次 LLM 调用，返回完整 Blueprint；
 *   ② directorOutline     —— 把 Blueprint 的 sections 映射成 renderActivityEditorial
 *                            需要的 outline 形状（失败安全回退到旧双轴）；
 *   ③ runContentDirector  —— regenStyle 的异步入口（成功写 a.pageBlueprint）；
 *   ④ Creative Memory     —— 最近 ~20 场「创意指纹」的 localStorage 读写，
 *                            供 Director 在 prompt 里反重复。
 *
 * 旧双轴 buildEditorialOutline / regenStyleContent 保留作安全回退，零回归：
 *   - 渲染层：a.pageBlueprint 存在才走 Director，否则回退；
 *   - regenStyle：Director 失败（无 Key / 无后端 / 接口异常）自动回退旧双轴。
 *
 * 后续里程碑（不在本文件落地）：
 *   M2 Creative Memory + Diversity Controller 完整（3 方向按适合度/素材/历史重复度打分选最优）；
 *   M3 三层反重复（copySimilarity / layoutFingerprint / semanticSimilarity）超阈值局部重生成；
 *   M4 30 场压力测试 harness。
 * ===================================================================== */

const CD_MEM_KEY = "clubos_creative_memory_v1";
const CD_MEM_MAX = 20;

/* ===================== Creative Memory ===================== */
/* 存最近 ~20 场的「创意指纹」，供 Director 在 prompt 里反重复。
   后端未部署，先用 localStorage；多端不共享，但单端已能避免连续撞车。 */
function creativeMemoryRaw() {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return [];
    const s = localStorage.getItem(CD_MEM_KEY);
    const arr = s ? JSON.parse(s) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (e) { return []; }
}
function creativeMemoryOf() { return creativeMemoryRaw(); }
function creativeMemoryPush(fp) {
  if (!fp) return;
  try {
    if (typeof localStorage === "undefined" || !localStorage) return;
    const arr = creativeMemoryRaw();
    arr.push(Object.assign({ at: Date.now() }, fp));
    // 只保留最近 CD_MEM_MAX 条
    localStorage.setItem(CD_MEM_KEY, JSON.stringify(arr.slice(-CD_MEM_MAX)));
  } catch (e) {}
}
/* 把最近记忆压成给模型的「反重复提示」短文本 */
function creativeMemoryBrief() {
  const arr = creativeMemoryRaw().slice(-8);
  if (!arr.length) return "（暂无历史创意记录，可自由发挥）";
  return arr.map(function (m) {
    const dir = m.dir || "?";
    const tone = m.tone || "?";
    const pal = m.palette || "?";
    return "- " + dir + " / 调性:" + tone + " / 色板:" + pal;
  }).join("\n");
}

/* ===================== 事实采样（喂给 Director） ===================== */
function directorFacts(a) {
  a = a || {};
  const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a) : null;
  const days = (a.itineraryDays || []).filter(function (d) { return (d.items || []).some(function (t) { return t && (t.time || t.text); }); });
  const photos = (a.photos || []).filter(Boolean).length;
  const aud = (typeof activityAudienceText === "function") ? activityAudienceText(a) : (a.audience || "");
  const facts = [];
  if (a.title) facts.push("活动：" + a.title);
  if (a.type) facts.push("类型：" + a.type);
  if (a.place) facts.push("地点：" + a.place);
  if (dna && dna.season) facts.push("季节：" + dna.season);
  if (a.days) facts.push("天数：" + a.days);
  if (a.distance) facts.push("里程：" + a.distance + "km");
  if (a.elevation) facts.push("海拔：" + a.elevation + "m");
  if (a.difficulty && !/missing/i.test(a.difficulty)) facts.push("强度：" + a.difficulty);
  if (a.date || a.dateMD) facts.push("时间：" + (a.dateMD || a.date));
  if (a.meeting) facts.push("集合：" + a.meeting);
  if (a.limit) facts.push("名额：" + a.limit + (a.limitUnit || "人"));
  if (a.price) facts.push("价格：¥" + a.price + (a.limitUnit ? "/" + a.limitUnit : ""));
  if (aud) facts.push("适合人群：" + aud);
  if (days.length) facts.push("行程天数：" + days.length + " 天");
  if (photos) facts.push("可用照片：" + photos + " 张");
  if (dna && dna.copyAngles && dna.copyAngles.length) facts.push("可选角度：" + dna.copyAngles.slice(0, 4).join("；"));
  if (dna && dna.sceneSignature) facts.push("场景特征：" + dna.sceneSignature);
  return facts.join("\n");
}

/* ===================== AI Content Director（单次调用 → Blueprint） ===================== */
/* 返回结构：
   { insight, directions:[{id,name,thesis,why,fitScore}], chosen,
     styleInference:{tone,energy,warmth,visualRichness,typography,palette},
     pageBlueprint:{ coreThesis, contentGoal, openingStrategy, storyArc,
                     sections:[{purpose,heading,contentIntent,facts[],assetRequirement,
                                kind,textDensity,visualWeight,informationWeight,emotionalWeight}] } }
   无事实 / 无 Key / 调用失败都返回 null（上层自动回退本地双轴）。 */
async function aiContentDirector(a) {
  if (!a) return null;
  const facts = directorFacts(a);
  if (!facts.trim()) return null;
  const mem = creativeMemoryBrief();
  const photoN = (a.photos || []).filter(Boolean).length;
  const sys = "你是 ClubOS 的「AI 内容总监（Content Director）」。你不为活动套用固定风格模板，"
    + "而是基于活动事实、可用照片、目标人群与品牌调性，推导一整套连贯的营销策划。"
    + "必须严格遵守事实边界：不要编造时间、价格、名额、路线、人物评价等未提供的事实；"
    + "照片数量不足时不要承诺不存在的视觉。"
    + "输出严格 JSON，不要任何解释文字。";
  const user = "【活动事实】\n" + facts
    + "\n\n【品牌调性】远拓旅游：年轻、松弛、山系高级感，文案有语言美感而非堆数字；图片主导。"
    + "\n\n【最近创意记忆（避免重复）】\n" + mem
    + "\n\n请产出 JSON：\n"
    + "{\n"
    + "  \"insight\": \"一句话营销洞察（这场合在哪一点上打动人）\",\n"
    + "  \"directions\": [ 三条创意方向，每条 {\"id\":\"d1\",\"name\":\"方向名\",\"thesis\":\"核心主张\",\"why\":\"为什么适合这场\",\"fitScore\":0-100} ],\n"
    + "  \"chosen\": \"选中的方向 id（从三条里挑最适合的一场）\",\n"
    + "  \"styleInference\": { \"tone\":\"松弛/热血/沉静…\",\"energy\":0-1,\"warmth\":0-1,\"visualRichness\":0-1,\"typography\":\"衬线/无衬线\",\"palette\":\"自然色/冷调/暖调\" },\n"
    + "  \"pageBlueprint\": {\n"
    + "    \"coreThesis\": \"整页核心主张\",\n"
    + "    \"contentGoal\": \"这页想让 reader 产生什么感受/动作\",\n"
    + "    \"openingStrategy\": \"开场如何切入（避免俗套标语）\",\n"
    + "    \"storyArc\": \"情绪/信息推进顺序\",\n"
    + "    \"sections\": [ 3-6 个章节，每节 {\n"
    + "        \"purpose\":\"这节的任务(吸引/建立信任/展示体验/促成报名…)\",\n"
    + "        \"heading\":\"章节标题(有美感，不堆数字)\",\n"
    + "        \"contentIntent\":\"这一节的文案(2-4 句，换行分隔；可含文学化表达)\",\n"
    + "        \"facts\":[\"需嵌入的硬事实，逐条自然语言短句，不要管道符分隔\"],\n"
    + "        \"assetRequirement\":\"hero 大图 / 2-3 张体验图 / 路线图 / 人物特写 / 无图\",\n"
    + "        \"kind\":\"scenic|experience|route|people|night|info 之一\",\n"
    + "        \"textDensity\":0-1,\"visualWeight\":0-1,\"informationWeight\":0-1,\"emotionalWeight\":0-1\n"
    + "    } ]\n"
    + "  }\n"
    + "}\n"
    + "要求：章节数量与顺序由活动本身决定，不要固定六段；图片需求(kind/assetRequirement)要与可用照片数("
    + photoN + " 张)匹配，照片少就少配图。";
  let bp = null;
  try {
    bp = (typeof clubLLM === "function")
      ? await clubLLM({ system: sys, user: user, json: true, temperature: 0.8 })
      : null;
  } catch (e) { bp = null; }
  if (!bp || typeof bp !== "object") return null;
  // 结构兜底校验
  if (!bp.pageBlueprint || !Array.isArray(bp.pageBlueprint.sections) || !bp.pageBlueprint.sections.length) return null;
  bp._generatedAt = Date.now();
  return bp;
}

/* ===================== Blueprint → outline（渲染器消费的形状） ===================== */
/* 失败安全：非法 Blueprint 返回 null，调用方应回退 buildEditorialOutline。
   每个 section 字段含义对齐旧双轴 outline：
     key 唯一；num 序号；heading 标题；paras 段落数组；
     imgCount 取图预算(1-3)；imgKind 图种(CSS)；kind 语义类型(驱动照片匹配)；
     angle 方向标签；density/typo/family 给渲染层兜底。 */
function directorOutline(bp) {
  if (!bp || !bp.pageBlueprint || !Array.isArray(bp.pageBlueprint.sections)) return null;
  const secs = bp.pageBlueprint.sections;
  if (!secs.length) return null;
  const chosenId = bp.chosen || "";
  const out = [];
  secs.forEach(function (s, i) {
    if (!s || typeof s !== "object") return;
    const heading = String(s.heading || s.purpose || ("第 " + (i + 1) + " 节")).trim();
    // 文案：facts（事实层，原样保留）+ contentIntent（文学层），各自成段
    const paras = [];
    if (Array.isArray(s.facts) && s.facts.length) {
      const f = s.facts.map(function (x) { return String(x).trim(); }).filter(Boolean).join("，");
      if (f) paras.push(f);
    }
    const intent = String(s.contentIntent || "").split(/\n+/).map(function (t) { return t.trim(); }).filter(Boolean);
    intent.forEach(function (t) { paras.push(t); });
    if (!paras.length) {
      const fb = String(s.contentIntent || s.purpose || "").trim();
      paras.push(fb || "（待补充）");
    }
    // 图片：visualWeight 推数量，assetRequirement 推图种
    const vw = Number(s.visualWeight != null ? s.visualWeight : 0.5);
    const imgCount = vw > 0.66 ? 3 : (vw > 0.33 ? 2 : 1);
    const ar = String(s.assetRequirement || "").toLowerCase();
    let imgKind = "scenic";
    if (/people|人物|特写/.test(ar)) imgKind = "experience";
    else if (/route|路线/.test(ar)) imgKind = "route";
    else if (/hero|大图|风光/.test(ar)) imgKind = "scenic";
    const kind = (["scenic", "experience", "route", "people", "night", "info"].indexOf(s.kind) >= 0) ? s.kind : "scenic";
    out.push({
      key: "dir-" + (i + 1),
      num: i + 1,
      heading: heading,
      paras: paras,
      imgCount: imgCount,
      imgKind: imgKind,
      kind: kind,
      angle: chosenId || "director",
      density: "magazine",
      typo: "serif",
      family: "magazine"
    });
  });
  return out.length ? out : null;
}

/* ===================== AI 是否可走 Director ===================== */
/* 只有真正配了 AI（浏览器直连 Key 或后端代理）才走 Director；
   没配 AI 时 regenStyle 回退旧双轴 regenStyleContent（仍会推进风格轴，零回归）。 */
function aiDirectorReady() {
  try {
    if (typeof getAIKey === "function" && getAIKey && getAIKey()) return true;
    if (typeof getBackendURL === "function" && getBackendURL && getBackendURL()) return true;
  } catch (e) {}
  return false;
}

/* ===================== regenStyle 的异步入口 ===================== */
/* 成功：写 a.pageBlueprint 并回写创意指纹；失败：cb(false)（上层回退本地双轴）。
   cb 为可选回调（成功/失败都调用一次）。 */
async function runContentDirector(a, cb) {
  if (!a) { if (typeof cb === "function") cb(false); return; }
  let bp = null;
  try { bp = (typeof aiContentDirector === "function") ? await aiContentDirector(a) : null; } catch (e) { bp = null; }
  if (bp) {
    a.pageBlueprint = bp;
    if (!a._directorAngle && bp.chosen) a._directorAngle = bp.chosen;
    // 写创意指纹到 Creative Memory（供后续反重复）
    try {
      const inf = bp.styleInference || {};
      const chosenDir = (bp.directions || []).filter(function (d) { return d && d.id === bp.chosen; })[0];
      creativeMemoryPush({
        dir: (chosenDir && chosenDir.name) || bp.chosen || "?",
        tone: inf.tone || "?",
        palette: inf.palette || "?"
      });
    } catch (e) {}
    if (typeof cb === "function") cb(true);
  } else {
    if (typeof cb === "function") cb(false);
  }
}

/* 显式挂到 window，兼容 vm 沙箱（顶层函数声明在沙箱里不一定进全局） */
if (typeof window !== "undefined") {
  window.aiContentDirector = aiContentDirector;
  window.runContentDirector = runContentDirector;
  window.directorOutline = directorOutline;
  window.creativeMemoryOf = creativeMemoryOf;
  window.creativeMemoryPush = creativeMemoryPush;
}
