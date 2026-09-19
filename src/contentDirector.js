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
 *   —— M4 压力测试 harness ——
 *   ⑫ cdStressScenarios           —— 确定性生成 30 场差异化场景（含 0 照片/无价格/无行程/超长标题等边界）；
 *   ⑬ cdStressRun                 —— 逐场跑 runContentDirector 并汇总不变量/撞车度/记忆规模，
 *                                    默认记忆隔离（跑前快照、跑后还原），单场失败不中断整轮。
 *
 * 旧双轴 buildEditorialOutline / regenStyleContent 保留作安全回退，零回归：
 *   - 渲染层：a.pageBlueprint 存在才走 Director，否则回退；
 *   - regenStyle：Director 失败（无 Key / 无后端 / 接口异常）自动回退旧双轴。
 *
 * 里程碑已全部落地（M1 单次 Blueprint / M2 多候选打分选优 / M3 三层反重复 / M4 30 场压测）。
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
    + "  \"insight\": \"一句话金句（★直接给读者看：将作为页面金句原样展示，不要写创作说明）\",\n"
    + "  \"directions\": [ 三条创意方向，每条 {\"id\":\"d1\",\"name\":\"方向名\",\"thesis\":\"核心主张\",\"why\":\"为什么适合这场\",\"fitScore\":0-100} ],\n"
    + "  \"chosen\": \"选中的方向 id（从三条里挑最适合的一场）\",\n"
    + "  \"styleInference\": { \"tone\":\"松弛/热血/沉静…\",\"energy\":0-1,\"warmth\":0-1,\"visualRichness\":0-1,\"typography\":\"衬线/无衬线\",\"palette\":\"自然色/冷调/暖调\" },\n"
    + "  \"pageBlueprint\": {\n"
    + "    \"coreThesis\": \"整页核心主张\",\n"
    + "    \"contentGoal\": \"这页想让 reader 产生什么感受/动作\",\n"
    + "    \"openingStrategy\": \"开场第一句（★直接给读者看：将作为详情页导语原样展示；写一句能开篇的话，不要写“从…切入”这类创作说明）\",\n"
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

/* ===================== Blueprint → 导语 / 金句（v214） =====================
 * 为什么需要：页面顶部的导语与中段金句此前只来自「本地风格包模板」（publish.js 的
 * EDITORIAL_ANGLE_VOICE），AI 总监即使跑过，它的开场与金句也**从不出现在页面上** ——
 * 页头是模板句（且 {P} 塞长地名会出病句），正文却是 AI 编排，读起来「头尾两张皮」。
 * 现在：Blueprint 有 openingStrategy / insight 时由它接管导语与金句。
 * ★ 安全闸门：只接受「能给读者看」的句子。AI 很可能把创作说明（「从凌晨的黑暗切入」）
 *   写进这两个字段 —— 直接渲染等于把策划笔记贴给读者。命中策略口吻 / 过长一律弃用，
 *   回退本地模板（宁可回到模板，也不往页面贴创作说明）。 */
const CD_META_SPEAK = /(切入|策略|创作说明|章节|本节|叙事结构|意图|面向读者|开场如何|基调定为|建议采用)/;
function cdReaderFacing(t, max) {
  const s = String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  if (!s) return "";
  if (CD_META_SPEAK.test(s)) return "";
  if (max && s.length > max) return "";
  return s;
}
/* 导语：openingStrategy（首选）→ coreThesis（兜底）；过接地闸门，无接地则回退风格包模板 */
function directorLeadOf(a) {
  const bp = a && a.pageBlueprint;
  if (!bp) return "";
  const bb = bp.pageBlueprint || {};
  const lead = cdReaderFacing(bb.openingStrategy, 120) || cdReaderFacing(bb.coreThesis, 120);
  return cdLeadGrounded(a, lead);
}
/* 金句：insight（首选）→ coreThesis；过接地闸门，与导语重复则不用（同屏两句一样的话很蠢） */
function directorQuoteOf(a) {
  const bp = a && a.pageBlueprint;
  if (!bp) return "";
  const bb = bp.pageBlueprint || {};
  const q = cdLeadGrounded(a, cdReaderFacing(bp.insight, 60) || cdReaderFacing(bb.coreThesis, 60));
  return (q && q !== directorLeadOf(a)) ? q : "";
}

/* v215：导语 / 金句接地闸门 —— AI 总监（尤其 demo / 弱 Key）可能返回与活动毫无关系的废话
   （如「因为山不议程」「所有议程由风制定。所有结论由脚步推导。」），直接贴页头等于把垃圾给读者看。
   接地规则：导语 / 金句必须「含具体数字」或「命中活动自有文案（标题 / 地点 / 类型 / 原始方案 raw /
   _planText / 照片说明 / 为什么去 / 体验 / 收获 / 亮点）的 2-gram 锚点」才算接了地；否则拒收
   （调用方回退风格包模板句）。
   ★不破坏 v214 文学导语契约：v214 fixture 的文学导语「先看到日落，再等到日出。」复现活动文案里的
   「日落」意象，2-gram 命中 → 放行；垃圾句与活动文案无 2-gram 重合 → 拒收。 */
const CD_STOP_BI = /^(我们|你们|他们|她们|这里|那里|这个|那个|哪个|一场|这次|可以|就是|以及|还有|不仅|而且|因为|所以|但是|如果|它们|这些|那些|一个|一种|一些|已经|不会|一定|可能|觉得|认为|通过|对于|关于|进行|成为|这种|这样|那样|什么|怎么|为什么|自己|大家|朋友|一起|时候|开始|需要|能够|看到|感受|体验|享受|收获|其实|来说|而言|上面|下面|里面|出来|起来|之后|之前|之间|之上|之下|一下|一直|还是|不是|没有|这么|那么|多么|非常|十分|比较|更加|或者|只是)$/;
function cdTextBigrams(s) {
  const str = String(s == null ? "" : s).replace(/[\s，。、；：！？“”"'（）()\[\]【】…—\-\.,!?]/g, "");
  const out = [];
  for (let i = 0; i + 1 < str.length; i++) out.push(str.slice(i, i + 2));
  return out;
}
function cdAnchorBigrams(a) {
  const src = [
    a ? a.title : "", a ? a.place : "", a ? a.type : "",
    a ? (a._planText || "") : "", a ? (a.raw || "") : "",
    a ? (a.photoCaptions || []).join("") : "",
    a ? (a.whyGo || "") : "", a ? (a.experience || "") : "",
    a ? (a.gain || "") : "",
    a ? (a.highlights || []).map(function (h) { return (h && (h[0] || h.text || "")) || ""; }).join("") : ""
  ].join("");
  const set = {};
  cdTextBigrams(src).forEach(function (b) { if (b.length === 2 && !CD_STOP_BI.test(b)) set[b] = 1; });
  return Object.keys(set);
}
function cdLeadGrounded(a, t) {
  const s = cdReaderFacing(t, 0);
  if (!s) return "";
  if (/\d/.test(s)) return s;                 // 含具体数字 → 已接地
  const anchors = cdAnchorBigrams(a);
  if (!anchors.length) return s;              // 没有可比对的活动文案 → 无法判定，放行
  const bg = cdTextBigrams(s).filter(function (b) { return b.length === 2 && !CD_STOP_BI.test(b); });
  for (let i = 0; i < bg.length; i++) if (anchors.indexOf(bg[i]) >= 0) return s;
  return "";                                  // 与活动毫无 2-gram 重合 → 拒收
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
    + "    \"insight\": \"一句话金句（★直接给读者看，将作为页面金句展示）\",\n"
    + "    \"directions\": [ {\"id\":\"d1\",\"name\":\"方向名\",\"thesis\":\"核心主张\",\"why\":\"为什么适合\",\"fitScore\":0-100} ],\n"
    + "    \"chosen\": \"选中的方向 id\",\n"
    + "    \"styleInference\": { \"tone\":\"松弛/热血/沉静…\",\"energy\":0-1,\"warmth\":0-1,\"visualRichness\":0-1,\"typography\":\"衬线/无衬线\",\"palette\":\"自然色/冷调/暖调\" },\n"
    + "    \"pageBlueprint\": {\n"
    + "      \"coreThesis\": \"整页核心主张\",\n"
    + "      \"contentGoal\": \"想让 reader 产生什么感受/动作\",\n"
    + "      \"openingStrategy\": \"开场第一句（★直接给读者看，将作为详情页导语原样展示；不要写创作说明）\",\n"
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

/* ===================== M4 压力测试 harness（30 场） =====================
 * 为什么需要它：M1/M2/M3 的单元契约都只验证「单场」正确——但真实使用是**连续多场**，
 * 记忆会累积、候选会与历史撞车、边界字段会缺失。单场绿 ≠ 30 场绿。
 *
 * 设计原则：
 *   ① 不触网：默认 engine 就是 runContentDirector（线上配了 AI 就真跑真 AI；
 *      离线沙箱把 clubLLM/getAIKey 换掉即可确定性复跑同一套断言）。
 *   ② 记忆隔离：默认 resetMemory=true —— 跑前快照、跑后还原。
 *      只为跑测试却污染用户真实 Creative Memory 是 bug，不是 feature。
 *   ③ 单场失败不中断整轮：每场独立 try/catch，错误写进 runs[i].error 后继续跑下一场。
 *
 * 用法（线上真机自检，浏览器控制台）：
 *   const r = await cdStressRun(cdStressScenarios());
 *   console.table(r.runs);  r.uniqLayouts;  r.maxCopy;  r.memPeak;  r.memoryRestored
 * ===================================================================== */

/* 全量写回 Creative Memory（压测快照还原用；creativeMemoryPush 只能逐条追加） */
function creativeMemoryWrite(arr) {
  try {
    if (typeof localStorage === "undefined" || !localStorage) return false;
    localStorage.setItem(CD_MEM_KEY, JSON.stringify((Array.isArray(arr) ? arr : []).slice(-CD_MEM_MAX)));
    return true;
  } catch (e) { return false; }
}

/* 渲染器认的 kind 受控词表（与 directorOutline 内联白名单同口径） */
const CD_KIND_WHITELIST = ["scenic", "experience", "route", "people", "night", "info"];
function cdR4(x) { return Math.round(Number(x || 0) * 1e4) / 1e4; }

/* 30 场确定性场景：刻意覆盖「字段缺失 / 规模极值 / 字符异常」三类边界，
   并含一场与第 1 场高度同质的「重复压测基线场」用于逼出历史撞车。
   表列：标题 / 类型 / 地点 / 天数 / 照片数 / 价格 / 海拔 / 人群 / 行程天数 / 标签 */
function cdStressScenarios() {
  const T = [
    ["初秋轻徒步：莫干山竹海", "徒步", "莫干山", 1, 0, 380, 400, "周末轻徒步人群", 1, "边界:0照片"],
    ["只有一张照片的日落", "摄影", "东白山", 1, 1, 0, 800, "摄影爱好者", 1, "边界:1照片+无价格"],
    ["坝上草原秋摄五日", "摄影", "乌兰布统", 5, 20, 3680, 1500, "摄影发烧友", 5, "边界:20照片"],
    ["溪谷营地两日（无价格）", "露营", "安吉", 2, 6, 0, 300, "", 2, "边界:无价格+无人群"],
    ["无名高地", "", "", 2, 4, 880, 0, "山系青年", 0, "边界:无类型/无海拔/无行程"],
    ["横断长线十五日", "徒步", "横断山脉", 15, 12, 12800, 4200, "资深徒步者", 15, "边界:15天"],
    ["京郊最美的一段山脊线从清晨云海走到黄昏落日整整十二小时徒步纪实与装备清单", "徒步", "海坨山", 2, 8, 680, 2241, "徒步进阶人群", 2, "边界:超长标题"],
    ["溪谷 & 星空 <露营> 「双人帐篷」", "露营", "浙西大峡谷", 2, 5, 1280, 600, "情侣/朋友", 2, "边界:特殊字符"],
    ["贝加尔湖蓝冰八日", "摄影", "贝加尔湖", 8, 18, 9800, 460, "摄影+冰雪爱好者", 8, "常规:长线"],
    ["四明山越野训练营", "越野", "四明山", 2, 7, 1580, 900, "越野跑者", 2, "常规:越野"],
    ["梅里转山七日", "徒步", "德钦", 7, 16, 6800, 3700, "高原徒步者", 7, "常规:高原"],
    ["皮划艇日归体验", "皮划艇", "千岛湖", 1, 4, 580, 100, "水上运动新手", 1, "常规:水上"],
    ["雪季单板入门营", "滑雪", "崇礼", 3, 9, 4280, 2100, "滑雪新手", 3, "常规:雪季"],
    ["北海道温泉慢旅六日", "温泉", "登别", 6, 14, 11200, 200, "亲子家庭", 6, "常规:出境"],
    ["城市漫步：梧桐区半日", "城市漫步", "上海", 1, 3, 99, 0, "城市探索者", 1, "常规:城市"],
    ["腾格里沙漠穿越", "徒步", "阿拉善", 4, 11, 3980, 1200, "沙漠徒步爱好者", 4, "常规:沙漠"],
    ["武功山穿越三日", "徒步", "萍乡", 3, 13, 1680, 1918, "露营爱好者", 3, "常规:山脊"],
    ["香格里拉亲子五日", "亲子", "香格里拉", 5, 15, 5980, 3300, "亲子家庭", 5, "常规:亲子"],
    ["秦岭太白南北穿越", "徒步", "太白山", 3, 10, 2280, 3767, "重装徒步者", 3, "常规:重装"],
    ["洱海骑行环湖四日", "骑行", "大理", 4, 12, 2680, 2000, "骑行爱好者", 4, "常规:骑行"],
    ["甘南草原摄影七日", "摄影", "迭部", 7, 19, 7280, 3000, "风光摄影师", 7, "常规:风光"],
    ["吉林雾凇两日", "摄影", "吉林市", 2, 6, 1580, 300, "摄影爱好者", 2, "常规:冬季"],
    ["雅拉雪山徒步五日", "徒步", "康定", 5, 14, 5280, 4000, "高原徒步者", 5, "常规:雪山"],
    ["徽杭古道一日", "徒步", "绩溪", 1, 5, 280, 600, "入门徒步人群", 1, "常规:古道"],
    ["海南冲浪三日", "冲浪", "万宁", 3, 8, 3180, 10, "年轻运动人群", 3, "常规:海"],
    ["雨崩村六日", "徒步", "德钦", 6, 17, 6980, 3100, "徒步进阶人群", 6, "常规:秘境"],
    ["北疆喀纳斯九日", "摄影", "布尔津", 9, 20, 9880, 1374, "摄影+长线人群", 9, "常规:九日"],
    ["单人成行的露营日归", "露营", "富阳", 1, 2, 199, 150, "新手/独行", 1, "边界:2照片+独行"],
    ["无边界的空白活动", "", "", 1, 1, 0, 0, "", 1, "边界:几乎全空"],
    ["重复压测基线场", "徒步", "莫干山", 1, 4, 380, 400, "周末轻徒步人群", 1, "常规:基线"]
  ];
  const out = [];
  T.forEach(function (r, i) {
    const photos = [];
    for (let k = 0; k < (r[4] || 0); k++) photos.push({ id: "p" + (i + 1) + "-" + (k + 1) });
    const itin = [];
    for (let d = 0; d < (r[8] || 0); d++) {
      itin.push({ label: "第 " + (d + 1) + " 天", items: [
        { time: "08:00", text: (r[2] || "集合地") + "集合出发" },
        { time: "14:00", text: "第 " + (d + 1) + " 天抵达营地" }
      ] });
    }
    const id = "stress-" + (i + 1);
    out.push({
      id: id, name: r[0], tag: r[9],
      act: {
        id: id, title: r[0], type: r[1], place: r[2], days: r[3], photos: photos,
        price: r[5], elevation: r[6], audience: r[7] ? [r[7]] : [], limit: 12 + i, limitUnit: "人",
        difficulty: r[3] >= 4 ? "进阶" : "轻松",
        meeting: r[2] ? r[2] + "高铁站" : "",
        itineraryDays: itin
      }
    });
  });
  return out;
}

/* outline 不变量校验：key 唯一 / imgCount∈[1,3] / kind 在白名单 / 标题与段落非空 / 节数与 Blueprint 一致 */
function cdOutlineCheck(outline, bp) {
  const bad = [];
  if (!Array.isArray(outline) || !outline.length) return { ok: false, bad: ["no-outline"] };
  const seen = {};
  outline.forEach(function (s, i) {
    if (!s || typeof s !== "object") { bad.push("null@" + i); return; }
    if (seen[s.key]) bad.push("dup-key:" + s.key);
    seen[s.key] = 1;
    const ic = Number(s.imgCount);
    if (!(ic >= 1 && ic <= 3)) bad.push("imgCount:" + s.imgCount);
    if (CD_KIND_WHITELIST.indexOf(s.kind) < 0) bad.push("kind:" + s.kind);
    if (!s.heading) bad.push("heading@" + i);
    if (!Array.isArray(s.paras) || !s.paras.length) bad.push("paras@" + i);
    else if (s.paras.some(function (p) { return !String(p || "").trim(); })) bad.push("empty-para@" + i);
  });
  const want = ((bp && bp.pageBlueprint && bp.pageBlueprint.sections) || []).length;
  if (want !== outline.length) bad.push("count:" + outline.length + "/" + want);
  return { ok: bad.length === 0, bad: bad };
}

/* 默认执行器：走完整 M1→M2→M3 流水线（runContentDirector 内部已含候选打分 + 反重复） */
async function cdStressEngine(act) {
  if (typeof runContentDirector !== "function") return null;
  await runContentDirector(act);
  return (act && act.pageBlueprint) || null;
}

/* 压测主入口。
   opts.engine      自定义执行器 (act) => Promise<bp|null>（默认 cdStressEngine，可换真/假 AI）
   opts.resetMemory 默认 true：跑前快照、跑后还原（禁止污染真实 Creative Memory）
   返回 { total, ok, failed, runs[], uniqLayouts, uniqTones, maxCopy, maxLayout, maxSem,
          repaired, badOutline, badFingerprint, memPeak, memoryRestored } */
async function cdStressRun(scenarios, opts) {
  opts = opts || {};
  const list = (Array.isArray(scenarios) && scenarios.length) ? scenarios : cdStressScenarios();
  const resetMemory = opts.resetMemory !== false;
  const engine = (typeof opts.engine === "function") ? opts.engine : cdStressEngine;
  const snap = resetMemory ? creativeMemoryRaw() : null;
  if (resetMemory) creativeMemoryWrite([]);
  const runs = [];
  const seenLayout = {};
  let memPeak = 0;
  for (let i = 0; i < list.length; i++) {
    const sc = list[i] || {};
    const act = JSON.parse(JSON.stringify(sc.act || sc));
    const memBefore = creativeMemoryRaw().slice(-8);
    const t0 = Date.now();
    let bp = null, err = "";
    try { bp = await engine(act); } catch (e) { err = String((e && e.message) || e); bp = null; }
    const rec = {
      id: sc.id || ("s" + (i + 1)), tag: sc.tag || "", ok: !!bp, ms: Date.now() - t0,
      photos: (act.photos || []).filter(Boolean).length, error: err
    };
    if (bp) {
      const outline = (typeof directorOutline === "function") ? directorOutline(bp) : null;
      const chk = cdOutlineCheck(outline, bp);
      const fp = (typeof directorFingerprintOf === "function") ? directorFingerprintOf(bp) : null;
      const rep = (typeof repetitionReport === "function") ? repetitionReport(bp, memBefore) : null;
      const cs = bp._candidateScore || null;
      rec.sections = ((bp.pageBlueprint && bp.pageBlueprint.sections) || []).length;
      rec.outlineLen = outline ? outline.length : 0;
      rec.outlineOk = chk.ok;
      rec.bad = chk.bad;
      rec.layout = fp ? String(fp.layout || "") : "";
      rec.tone = fp ? String(fp.tone || "") : "";
      rec.palette = fp ? String(fp.palette || "") : "";
      rec.fpComplete = !!(fp && fp.dir && fp.tone && fp.palette && fp.thesis && fp.layout && fp.copy);
      rec.asset = cs ? cdR4(cs.asset) : null;
      rec.fit = cs ? cdR4(cs.fit) : null;
      rec.total = cs ? cdR4(cs.total) : null;
      rec.rep = rep ? { copy: cdR4(rep.copy), layout: cdR4(rep.layout), semantic: cdR4(rep.semantic), over: !!rep.over, layers: rep.layers } : null;
      rec.repaired = !!bp._repairedAt;
      if (rec.layout && seenLayout[rec.layout]) rec.dupLayout = true;
      if (rec.layout) seenLayout[rec.layout] = 1;
      /* 端到端再走一遍渲染层：只在「多场连续」时才暴露的问题（样式轴累积、记忆干扰、
         边界字段缺失）必须在渲染出口也被看见。opts.render=false 可跳过。 */
      if (opts.render !== false && typeof renderActivityEditorial === "function") {
        try {
          const html = String(renderActivityEditorial(act) || "");
          rec.renderOk = true;
          rec.htmlLen = html.length;
          rec.yen = (html.match(/¥/g) || []).length;
        } catch (e2) {
          rec.renderOk = false; rec.htmlLen = 0; rec.yen = 0;
          rec.renderError = String((e2 && e2.message) || e2);
        }
      }
    }
    const m = creativeMemoryRaw().length;
    rec.memSize = m;
    if (m > memPeak) memPeak = m;
    runs.push(rec);
  }
  if (resetMemory && snap) creativeMemoryWrite(snap);
  const okRuns = runs.filter(function (r) { return r.ok; });
  const layouts = {}, tones = {};
  let maxCopy = 0, maxLayout = 0, maxSem = 0, repaired = 0, badOutline = 0, badFp = 0, badRender = 0;
  okRuns.forEach(function (r) {
    if (r.layout) layouts[r.layout] = 1;
    if (r.tone) tones[r.tone] = 1;
    if (r.rep) {
      if (r.rep.copy > maxCopy) maxCopy = r.rep.copy;
      if (r.rep.layout > maxLayout) maxLayout = r.rep.layout;
      if (r.rep.semantic > maxSem) maxSem = r.rep.semantic;
    }
    if (r.repaired) repaired++;
    if (r.outlineOk === false) badOutline++;
    if (r.fpComplete === false) badFp++;
    if (r.renderOk === false) badRender++;
  });
  return {
    total: runs.length, ok: okRuns.length, failed: runs.length - okRuns.length, runs: runs,
    /* 便于区分「AI 没配 → 30 场全回退」与「流水线真的有 bug」 */
    aiReady: (typeof aiDirectorReady === "function") ? aiDirectorReady() : false,
    uniqLayouts: Object.keys(layouts).length, uniqTones: Object.keys(tones).length,
    maxCopy: cdR4(maxCopy), maxLayout: cdR4(maxLayout), maxSem: cdR4(maxSem),
    repaired: repaired, badOutline: badOutline, badFingerprint: badFp, badRender: badRender,
    memPeak: memPeak,
    memoryRestored: resetMemory ? (JSON.stringify(creativeMemoryRaw()) === JSON.stringify(snap || [])) : null
  };
}

/* 显式挂到 window，兼容 vm 沙箱（顶层函数声明在沙箱里不一定进全局） */
if (typeof window !== "undefined") {
  window.cdStressScenarios = cdStressScenarios;
  window.cdStressRun = cdStressRun;
  window.creativeMemoryWrite = creativeMemoryWrite;
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
  /* v214：Blueprint 接管导语/金句 */
  window.directorLeadOf = directorLeadOf;
  window.directorQuoteOf = directorQuoteOf;
}
