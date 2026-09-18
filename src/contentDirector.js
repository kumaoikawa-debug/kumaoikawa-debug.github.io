/* =======================================================================
 * contentDirector.js — M1 of《活动详情页 AI 智能宣传重构 V1.0》
 * -----------------------------------------------------------------------
 * AI Content Director：把「活动事实 + 可用照片 + 目标人群 + 品牌调性 + 历史创意」
 * 推导成一份动态 Page Blueprint，而不是套用「视觉杂志型 / 纪实型 / 专业信息型 /
 * 生活方式型」之类预设风格模板。
 *
 * 本文件做 M1 + M2 + M3 的落地：
 *   —— M1 ——
 *   ① aiContentDirector  —— 单次 LLM 调用，返回完整 Blueprint（兼容旧契约）；
 *   ② directorOutline     —— 把 Blueprint 的 sections 映射成 renderActivityEditorial
 *                            需要的 outline 形状（失败安全回退到旧双轴）；
 *   ③ runContentDirector  —— regenStyle 的异步入口（成功写 a.pageBlueprint）；
 *   ④ Creative Memory     —— 最近 ~20 场「创意指纹」的 localStorage 读写。
 *   —— M2 Diversity Controller ——
 *   ⑤ aiContentDirectorCandidates —— 单次 LLM 返回 3 套完整 Blueprint 候选；
 *   ⑥ scoreDirectorCandidate      —— 适合度(bigram Jaccard)+素材满足度+历史重复度 打分；
 *   ⑦ selectBestDirector          —— 综合打分选最优（并列时素材分高者胜），
 *                            取代「盲信 AI 的 fitScore」，让 Creative Memory 真正参与决策。
 *   —— M3 三层反重复（Anti-Repetition）——
 *   ⑧ copySimilarity / layoutSimilarity / semanticSimilarity —— 三层撞车检测（离线可算）；
 *   ⑨ repetitionReport            —— 汇总三层与 Creative Memory 的相似度，超阈值判定 over；
 *   ⑩ aiDirectorRepair            —— 仅重写撞车层（局部重生成），失败保留原 Blueprint；
 *   ⑪ directorFingerprintOf       —— 富化创意指纹(thesis/layout/copy)，供后续场次比对。
 *
 * 旧双轴 buildEditorialOutline / regenStyleContent 保留作安全回退，零回归：
 *   - 渲染层：a.pageBlueprint 存在才走 Director，否则回退；
 *   - regenStyle：Director 失败（无 Key / 无后端 / 接口异常）自动回退旧双轴。
 *
 * 后续里程碑（不在本文件落地）：
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

/* ===================== M2 Diversity Controller =====================
 * 让 Director 一次性产出 3 套完整 Blueprint，再用自有打分器（而非盲信 AI 的 fitScore）
 * 选最优：① 适合度 = 活动事实与 Blueprint 嵌入事实的 bigram Jaccard；
 *         ② 素材满足度 = 可用照片数 vs 各章节配图需求；
 *         ③ 历史重复度 = 与 Creative Memory 最近调性/色板/方向的撞车程度。
 * 三维度综合打分选最优；打分器离线可跑（不依赖网络），便于单测与回归。 */

/* 字符级 bigram 集合（中文按字、英文按小写词），用于事实重合度 */
function cdBigrams(text) {
  const s = String(text || "").toLowerCase().replace(/[\s，。、；：！？“”‘’（）()\[\]【】…—\-_,.;:!?]+/g, "");
  const set = new Set();
  if (!s) return set;
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  for (let i = 0; i < s.length; i++) set.add("□" + s[i]); // 单字兜底，避免极短文本空集
  return set;
}
function cdJaccard(a, b) {
  const A = (a instanceof Set) ? a : cdBigrams(a);
  const B = (b instanceof Set) ? b : cdBigrams(b);
  if (!A.size && !B.size) return 1;
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach(function (x) { if (B.has(x)) inter++; });
  return inter / (A.size + B.size - inter);
}

/* 收集 Blueprint 里所有「嵌入事实」文本（章节 facts + heading + contentIntent） */
function cdBlueprintFactText(bp) {
  const secs = (bp && bp.pageBlueprint && bp.pageBlueprint.sections) || [];
  const parts = [];
  if (bp && bp.insight) parts.push(String(bp.insight));
  secs.forEach(function (s) {
    if (!s) return;
    if (Array.isArray(s.facts)) s.facts.forEach(function (f) { parts.push(String(f)); });
    if (s.heading) parts.push(String(s.heading));
    if (s.contentIntent) parts.push(String(s.contentIntent));
  });
  return parts.join(" ");
}

/* 章节配图预算（与 directorOutline 同口径）：vw>0.66→3，>0.33→2，else 1 */
function cdSectionImgCount(s) {
  if (!s || typeof s !== "object") return 0;
  const vw = Number(s.visualWeight != null ? s.visualWeight : 0.5);
  return vw > 0.66 ? 3 : (vw > 0.33 ? 2 : 1);
}

/* 三维度打分：返回 {fit, asset, history, total}（各 0-1，total 加权） */
function scoreDirectorCandidate(bp, a, mem) {
  a = a || {};
  bp = bp || {};
  const photoN = (a.photos || []).filter(Boolean).length;
  const actFacts = directorFacts(a);
  const bpFacts = cdBlueprintFactText(bp);
  // ① 适合度：活动事实词表 vs Blueprint 事实词表 的 Jaccard
  const fit = cdJaccard(actFacts, bpFacts);
  // ② 素材满足度：可用照片 vs 各章节配图需求总和
  const secs = (bp.pageBlueprint && bp.pageBlueprint.sections) || [];
  let need = 0;
  secs.forEach(function (s) { need += cdSectionImgCount(s); });
  let asset;
  if (need <= 0) asset = 1;
  else if (photoN <= 0) asset = 0;
  else asset = Math.min(1, photoN / need);
  // ③ 历史重复度：与 Creative Memory 最近调性/色板/方向 撞车则降权
  const inf = bp.styleInference || {};
  const tone = String(inf.tone || "").trim();
  const pal = String(inf.palette || "").trim();
  const chosenDir = (bp.directions || []).filter(function (d) { return d && d.id === bp.chosen; })[0];
  const dirName = String((chosenDir && chosenDir.name) || "").trim();
  let repeat = 0;
  const arr = Array.isArray(mem) ? mem : creativeMemoryRaw().slice(-8);
  arr.forEach(function (m) {
    if (!m) return;
    const mt = String(m.tone || "").trim(), mp = String(m.palette || "").trim(), md = String(m.dir || "").trim();
    if (tone && mt && tone === mt) repeat += 0.5;
    if (pal && mp && pal === mp) repeat += 0.4;
    if (dirName && md && dirName === md) repeat += 0.3;
  });
  repeat = Math.min(0.9, repeat);
  const history = 1 - repeat;
  // 综合：适合度主导，素材与历史各占权重
  const total = 0.5 * fit + 0.3 * asset + 0.2 * history;
  return { fit: fit, asset: asset, history: history, total: total };
}

/* 从候选数组里选综合分最高者；并列时素材分高者胜；无候选返 null。
   mem 可不传（缺省读 Creative Memory）。返回 { blueprint, score } 或 null。 */
function selectBestDirector(list, a) {
  if (!Array.isArray(list) || !list.length) return null;
  const mem = creativeMemoryRaw().slice(-8);
  let best = null, bestScore = null;
  list.forEach(function (bp) {
    const sc = scoreDirectorCandidate(bp, a, mem);
    bp._candidateScore = sc; // 调试可见
    if (!best
        || sc.total > bestScore.total + 1e-9
        || (Math.abs(sc.total - bestScore.total) <= 1e-9 && sc.asset > bestScore.asset)) {
      best = bp; bestScore = sc;
    }
  });
  if (!best) return null;
  return { blueprint: best, score: bestScore };
}

/* 单次 LLM 返回 n 套完整 Blueprint 候选（结构同 aiContentDirector 的单套）。
   无事实/无 Key/失败返 null。每套自带 id 便于追踪。 */
async function aiContentDirectorCandidates(a, n) {
  n = (typeof n === "number" && n > 0) ? n : 3;
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
  let user = "【活动事实】\n" + facts
    + "\n\n【品牌调性】远拓旅游：年轻、松弛、山系高级感，文案有语言美感而非堆数字；图片主导。"
    + "\n\n【最近创意记忆（避免重复）】\n" + mem
    + "\n\n请产出 JSON，包含 " + n + " 套彼此差异化的完整策划候选（candidates 数组），每套结构如下：\n"
    + "{\n"
    + "  \"candidates\": [ {\n"
    + "    \"id\": \"c1\",\n"
    + "    \"insight\": \"一句话营销洞察\",\n"
    + "    \"directions\": [ {\"id\":\"d1\",\"name\":\"方向名\",\"thesis\":\"核心主张\",\"why\":\"为什么适合\",\"fitScore\":0-100} ],\n"
    + "    \"chosen\": \"选中的方向 id\",\n"
    + "    \"styleInference\": { \"tone\":\"松弛/热血/沉静…\",\"energy\":0-1,\"warmth\":0-1,\"visualRichness\":0-1,\"typography\":\"衬线/无衬线\",\"palette\":\"自然色/冷调/暖调\" },\n"
    + "    \"pageBlueprint\": {\n"
    + "      \"coreThesis\": \"整页核心主张\",\n"
    + "      \"contentGoal\": \"想让 reader 产生什么感受/动作\",\n"
    + "      \"openingStrategy\": \"开场切入\",\n"
    + "      \"storyArc\": \"情绪/信息推进顺序\",\n"
    + "      \"sections\": [ 3-6 个章节，每节 {\n"
    + "        \"purpose\":\"这节的任务\",\"heading\":\"章节标题(有美感)\",\n"
    + "        \"contentIntent\":\"文案(2-4 句，换行分隔)\",\n"
    + "        \"facts\":[\"需嵌入的硬事实，逐条自然语言短句\"],\n"
    + "        \"assetRequirement\":\"hero 大图 / 2-3 张体验图 / 路线图 / 人物特写 / 无图\",\n"
    + "        \"kind\":\"scenic|experience|route|people|night|info 之一\",\n"
    + "        \"textDensity\":0-1,\"visualWeight\":0-1,\"informationWeight\":0-1,\"emotionalWeight\":0-1\n"
    + "      } ]\n"
    + "    }\n"
    + "  } ]\n"
    + "}\n"
    + "要求：每套候选应是风格/调性/叙事角度明显不同的方案；章节数量与顺序由活动决定；"
    + "图片需求(kind/assetRequirement)要与可用照片数(" + photoN + " 张)匹配，照片少就少配图。"
    + "只返回 JSON，不要任何解释。";
  let out = null;
  try {
    out = (typeof clubLLM === "function")
      ? await clubLLM({ system: sys, user: user, json: true, temperature: 0.9 })
      : null;
  } catch (e) { out = null; }
  if (!out || typeof out !== "object") return null;
  const cands = Array.isArray(out) ? out : (Array.isArray(out.candidates) ? out.candidates : null);
  if (!cands || !cands.length) return null;
  // 结构兜底：每套都要有合法 sections 才是候选
  const valid = cands.filter(function (bp) {
    return bp && bp.pageBlueprint && Array.isArray(bp.pageBlueprint.sections) && bp.pageBlueprint.sections.length;
  });
  return valid.length ? valid : null;
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

/* ===================== M3 三层反重复（Anti-Repetition） =====================
 * 不只靠 prompt 里「避免重复」的口头约束，而是把最近场次的创意指纹拿出来做
 * **可量化的撞车检测**，并对撞车的那一层做**局部重生成**（其余字段不动）：
 *   ① copySimilarity     —— 文案层：标题/正文句子的最大重合度；
 *   ② layoutSimilarity   —— 版式层：章节 kind 序列的集合/顺序/长度相似度；
 *   ③ semanticSimilarity —— 语义层：核心主张(coreThesis/insight)的文本相似度。
 * 任一层超阈值即 over，触发 aiDirectorRepair 只重写该层。
 * 所有相似度均为离线字符级 bigram 启发式（无需 embedding），可单测。 */

const CD_M3_THRESHOLDS = { copy: 0.72, layout: 0.80, semantic: 0.70 };

/* 句子切分（换行 + 中文标点） */
function cdSentences(text) {
  return String(text || "").split(/[\n。！？；;!?]+/).map(function (s) { return s.trim(); }).filter(Boolean);
}

/* ① 文案相似度：两段文案间「最相似句子对」的 bigram Jaccard（0-1） */
function copySimilarity(a, b) {
  const sa = cdSentences(a), sb = cdSentences(b);
  if (!sa.length || !sb.length) return 0;
  let max = 0;
  for (let i = 0; i < sa.length; i++) {
    for (let j = 0; j < sb.length; j++) {
      const v = cdJaccard(sa[i], sb[j]);
      if (v > max) max = v;
    }
  }
  return max;
}

/* 取 coreThesis（优先）或 insight 作为「语义层」文本 */
function cdThesisOf(bp) {
  if (!bp) return "";
  const bb = bp.pageBlueprint || {};
  return String(bb.coreThesis || bp.insight || "").trim();
}
/* 取「文案层」文本：所有章节 heading + contentIntent 拼接 */
function cdCopyTextOf(bp) {
  const secs = (bp && bp.pageBlueprint && bp.pageBlueprint.sections) || [];
  const parts = [];
  secs.forEach(function (s) {
    if (!s) return;
    if (s.heading) parts.push(String(s.heading));
    if (s.contentIntent) parts.push(String(s.contentIntent));
  });
  return parts.join("\n");
}

/* ② 版式指纹：章节 kind 序列（存 Creative Memory 用；比对也可传指纹串或 Blueprint） */
function layoutFingerprint(bp) {
  const secs = (bp && bp.pageBlueprint && bp.pageBlueprint.sections) || [];
  return secs.map(function (s) { return (s && s.kind) || "?"; }).join(">");
}
/* 归一化成 kind 数组：接受「scenic>route」串 或 Blueprint 对象 */
function layoutKindsOf(x) {
  if (typeof x === "string") return x.split(">").map(function (s) { return s.trim(); }).filter(Boolean);
  const secs = (x && x.pageBlueprint && x.pageBlueprint.sections) || [];
  return secs.map(function (s) { return (s && s.kind) || "?"; });
}
/* 版式相似度：kind 集合 Jaccard(0.5) + 长度接近度(0.25) + 同位 kind 顺序一致率(0.25) */
function layoutSimilarity(x, y) {
  const A = layoutKindsOf(x), B = layoutKindsOf(y);
  if (!A.length || !B.length) return 0;
  const setA = {}, setB = {};
  A.forEach(function (k) { setA[k] = 1; });
  B.forEach(function (k) { setB[k] = 1; });
  const keysA = Object.keys(setA), keysB = Object.keys(setB);
  let inter = 0;
  keysA.forEach(function (k) { if (setB[k]) inter++; });
  const union = keysA.length + keysB.length - inter;
  const kindJ = union ? inter / union : 0;
  const lenSim = 1 - Math.abs(A.length - B.length) / Math.max(A.length, B.length);
  const n = Math.min(A.length, B.length);
  let pos = 0;
  for (let i = 0; i < n; i++) if (A[i] === B[i]) pos++;
  const orderSim = n ? pos / n : 0;
  return 0.5 * kindJ + 0.25 * lenSim + 0.25 * orderSim;
}

/* ③ 语义相似度：核心主张文本的 bigram Jaccard（无 embedding 的离线代理） */
function semanticSimilarity(a, b) {
  return cdJaccard(String(a || ""), String(b || ""));
}

/* 富化创意指纹：兼容 M2 的 dir/tone/palette，并补 thesis/layout/copy 供 M3 比对 */
function directorFingerprintOf(bp) {
  if (!bp) return null;
  const inf = bp.styleInference || {};
  const chosenDir = (bp.directions || []).filter(function (d) { return d && d.id === bp.chosen; })[0];
  return {
    dir: (chosenDir && chosenDir.name) || bp.chosen || "?",
    tone: inf.tone || "?",
    palette: inf.palette || "?",
    thesis: cdThesisOf(bp),
    layout: layoutFingerprint(bp),
    copy: cdCopyTextOf(bp)
  };
}

/* 汇总三层与 Creative Memory（最近 8 条）的最大相似度，超阈值判定 over */
function repetitionReport(bp, mem) {
  const arr = Array.isArray(mem) ? mem : creativeMemoryRaw().slice(-8);
  const thesis = cdThesisOf(bp);
  const copy = cdCopyTextOf(bp);
  let maxCopy = 0, maxLayout = 0, maxSem = 0;
  arr.forEach(function (m) {
    if (!m) return;
    if (m.copy) maxCopy = Math.max(maxCopy, copySimilarity(copy, m.copy));
    if (m.layout) maxLayout = Math.max(maxLayout, layoutSimilarity(bp, m.layout));
    if (m.thesis) maxSem = Math.max(maxSem, semanticSimilarity(thesis, m.thesis));
  });
  const layers = [];
  if (maxCopy >= CD_M3_THRESHOLDS.copy) layers.push("copy");
  if (maxLayout >= CD_M3_THRESHOLDS.layout) layers.push("layout");
  if (maxSem >= CD_M3_THRESHOLDS.semantic) layers.push("semantic");
  return { copy: maxCopy, layout: maxLayout, semantic: maxSem, layers: layers, over: layers.length > 0 };
}

/* 局部重生成：只让 AI 重写撞车层（semantic/layout/copy），其余字段一律保留。
   无 AI / 无输出 / 输出非法 → 返回 null（调用方保留原 Blueprint，不做死循环）。 */
async function aiDirectorRepair(a, bp, layers) {
  if (!a || !bp || !Array.isArray(layers) || !layers.length) return null;
  // 只有真配了 AI（直连 Key 或后端代理）才尝试重写；未配则原样返回 null（离线安全）
  if (!(typeof aiDirectorReady === "function" && aiDirectorReady())) return null;
  const facts = directorFacts(a);
  const layerText = layers.map(function (L) {
    if (L === "semantic") return "语义层（coreThesis/insight/openingStrategy 与最近场次撞车，换一个全新的核心立意）";
    if (L === "layout") return "版式层（章节 kind 序列与最近场次撞车，调整章节结构/顺序/数量，事实必须保留）";
    if (L === "copy") return "文案层（部分标题/正文与最近场次撞车，重写这些句子，事实不变）";
    return String(L);
  }).join("；");
  const cur = bp.pageBlueprint || {};
  const sys = "你是 ClubOS 的「AI 内容总监」。你只做**局部重写**：只改动被指出的撞车层，其他字段一律保持。"
    + "严格遵守事实边界：不得新增或篡改时间、价格、名额、路线、人物评价等事实。输出严格 JSON。";
  const user = "【活动事实（不得改动）】\n" + facts
    + "\n\n【需要重写的层】\n" + layerText
    + "\n\n【当前 Blueprint（摘要）】\n"
    + JSON.stringify({
      insight: bp.insight,
      coreThesis: cur.coreThesis,
      openingStrategy: cur.openingStrategy,
      sections: (cur.sections || []).map(function (s) {
        return { kind: s.kind, heading: s.heading, contentIntent: s.contentIntent, facts: s.facts || [], visualWeight: s.visualWeight };
      })
    })
    + "\n\n只返回你改动的 key，JSON 形如：\n"
    + "{\n"
    + "  \"semantic\": { \"insight\": \"…\", \"coreThesis\": \"…\", \"openingStrategy\": \"…\" },\n"
    + "  \"layout\": { \"sections\": [ 完整新章节，必须保留原 facts ] },\n"
    + "  \"copy\": { \"sections\": [ {\"heading\": \"…\", \"contentIntent\": \"…\"} ] }\n"
    + "}\n（只含被要求改的 key；copy.sections 按原章节下标对齐，只覆盖 heading/contentIntent）";
  let out = null;
  try {
    out = (typeof clubLLM === "function")
      ? await clubLLM({ system: sys, user: user, json: true, temperature: 0.85 })
      : null;
  } catch (e) { out = null; }
  if (!out || typeof out !== "object") return null;
  const merged = JSON.parse(JSON.stringify(bp));
  merged.pageBlueprint = merged.pageBlueprint || {};
  let changed = false;
  if (out.semantic && layers.indexOf("semantic") >= 0) {
    if (out.semantic.insight) merged.insight = out.semantic.insight;
    if (out.semantic.coreThesis) merged.pageBlueprint.coreThesis = out.semantic.coreThesis;
    if (out.semantic.openingStrategy) merged.pageBlueprint.openingStrategy = out.semantic.openingStrategy;
    changed = true;
  }
  if (out.layout && Array.isArray(out.layout.sections) && layers.indexOf("layout") >= 0) {
    const secs = out.layout.sections.filter(function (s) { return s && (s.heading || s.contentIntent); });
    if (secs.length) { merged.pageBlueprint.sections = secs; changed = true; }
  }
  if (out.copy && Array.isArray(out.copy.sections) && layers.indexOf("copy") >= 0) {
    const curSecs = merged.pageBlueprint.sections || [];
    out.copy.sections.forEach(function (patch, i) {
      if (!patch || !curSecs[i]) return;
      if (patch.heading) { curSecs[i].heading = patch.heading; changed = true; }
      if (patch.contentIntent) { curSecs[i].contentIntent = patch.contentIntent; changed = true; }
    });
  }
  if (!changed) return null;
  merged._repairedAt = Date.now();
  return merged;
}

/* ===================== regenStyle 的异步入口 ===================== */
/* 成功：写 a.pageBlueprint 并回写创意指纹；失败：cb(false)（上层回退本地双轴）。
   cb 为可选回调（成功/失败都调用一次）。 */
async function runContentDirector(a, cb) {
  if (!a) { if (typeof cb === "function") cb(false); return; }
  let bp = null;
  // M2 优先：一次产出多套候选，自有打分器选最优（不再盲信 AI 的 fitScore）
  try {
    if (typeof aiContentDirectorCandidates === "function") {
      const list = await aiContentDirectorCandidates(a, 3);
      if (list && list.length) {
        const best = (typeof selectBestDirector === "function") ? selectBestDirector(list, a) : null;
        if (best && best.blueprint) bp = best.blueprint;
      }
    }
  } catch (e) { bp = null; }
  // 回退 M1：单套调用（候选为空 / 失败 / 无后端时兜底，契约不变）
  if (!bp) {
    try { bp = (typeof aiContentDirector === "function") ? await aiContentDirector(a) : null; } catch (e) { bp = null; }
  }
  if (bp) {
    // M3：三层反重复检测 → 撞车则局部重生成（仅一次；失败保留原 bp，不做死循环）
    try {
      const mem = creativeMemoryRaw().slice(-8);
      const rep = (typeof repetitionReport === "function") ? repetitionReport(bp, mem) : null;
      if (rep && rep.over && typeof aiDirectorRepair === "function") {
        const fixed = await aiDirectorRepair(a, bp, rep.layers);
        if (fixed) { fixed._repairedLayers = rep.layers; bp = fixed; }
      }
    } catch (e) {}
    a.pageBlueprint = bp;
    if (!a._directorAngle && bp.chosen) a._directorAngle = bp.chosen;
    // 写富化创意指纹到 Creative Memory（兼容 M2 的 tone/palette/dir，补 M3 的 thesis/layout/copy）
    try { creativeMemoryPush(directorFingerprintOf(bp)); } catch (e) {}
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
  window.aiContentDirectorCandidates = aiContentDirectorCandidates;
  window.scoreDirectorCandidate = scoreDirectorCandidate;
  window.selectBestDirector = selectBestDirector;
  window.copySimilarity = copySimilarity;
  window.layoutSimilarity = layoutSimilarity;
  window.semanticSimilarity = semanticSimilarity;
  window.layoutFingerprint = layoutFingerprint;
  window.repetitionReport = repetitionReport;
  window.aiDirectorRepair = aiDirectorRepair;
  window.directorFingerprintOf = directorFingerprintOf;
}
