/* ================= ClubOS · AI Pipeline 文档对照层（v153） =================
   用途：把 V142 优化文档「§四 建议代码层新增/调整模块」「§五 推荐状态结构」「§十 模块定义」
        里建议的模块名与函数名，逐字映射到本项目的既有实现，并提供单一聚合状态 activityAiState，
        便于①按文档逐条对照验收；②调试时一处取到全量中间产物。

   三条硬原则（必须遵守，否则这层就成了谎）：
     ① 只做「取名 + 聚合」，零二次逻辑 —— 每个别名直接转发既有实现，不重写、不复制业务判断；
     ② 全部防御式 —— 目标模块未加载（如 front.html 不加载 publish.js）时返回安全空值，不抛错；
     ③ 事实边界不变 —— 本层绝不生成任何事实，只搬运已确认事实与既有推断结果。

   名称对照表（文档名 → 本项目实现）：
     extractFacts            → xfConfirmedFacts / factRegistry
     detectMissingFacts      → missingRequiredFacts
     confidenceMap           → factRegistry 的 confirmed/inferred/missing
     buildActivityDNA        → buildActivityDNA（同名，已实现）
     structureItinerary      → structureItinerary（同名，已实现）
     analyzePhotos           → piAnalyze
     selectPhotos            → piSelect
     assignPhotoRoles        → piAssignRoles
     matchPhotosToSections   → piMatchSections（宣发 sections）
     matchItineraryPhotos    → piMatchItinerary（详情页逐日行程）
     evaluateCropSafety      → piCropSafety / piEvaluateCrops
     buildAdaptiveLayout     → piAdaptiveLayout
     buildPageStoryOutline   → buildPageOutline
     generateSectionCopy     → xfSectionAlt（事实驱动的段落换说法）
     validateClaims          → xfContentQuality（含 unsupported:* 标记）
     validateLayout          → xfEditorialQuality
     renderActivityStoryPage → renderActivityPhone
     describePhotoProfile    → 新增：输出文档 P0-7 要求的完整图片画像字段
     buildActivityAiState    → 新增：聚合文档 §五 的 15 个状态位
*/

/* ---------- §四 事实层 ---------- */

/* extractFacts(a, photos) → 消费者视角的已确认事实快照
   首选 publish.js 的 xfConfirmedFacts（字段命名与文档 confirmedFacts 一致）；
   该模块未加载时（C 端/详情页）退回 ai.js 的 factRegistry，只取 status==="confirmed"。 */
function extractFacts(a, photos) {
  if (typeof xfConfirmedFacts === "function") {
    try { return xfConfirmedFacts(a, photos) || {}; } catch (e) { /* 继续降级 */ }
  }
  const out = {};
  if (typeof factRegistry === "function") {
    try {
      factRegistry(a).forEach((f) => {
        if (f.status === "confirmed") out[f.key] = f.value;
      });
    } catch (e) { /* 空快照 */ }
  }
  return out;
}

/* detectMissingFacts(a) → 阻塞发布的必填缺失事实（[{key,label}]） */
function detectMissingFacts(a) {
  if (typeof missingRequiredFacts !== "function") return [];
  try {
    return (missingRequiredFacts(a) || []).map((f) => ({ key: f.key, label: f.label }));
  } catch (e) { return []; }
}

/* confidenceMap(a) → 逐事实置信度（confirmed / inferred / missing + 来源） */
function confidenceMap(a) {
  const map = {};
  if (typeof factRegistry !== "function") return map;
  try {
    (factRegistry(a) || []).forEach((f) => {
      map[f.key] = {
        level: f.status,          // confirmed | inferred | missing | not_applicable
        source: f.source || "",   // owner_input | owner_confirmed | rule_inferred
        label: f.label,
        value: f.value,
        required: !!f.required,
      };
    });
  } catch (e) { /* 空表 */ }
  return map;
}

/* publishCheck(a) → 发布阻塞项 / 警告（文档 P0-1「发布阻塞项判断」） */
function publishCheck(a) {
  if (typeof runPublishCheck !== "function") return { blocking: [], warnings: [], available: false };
  try {
    const r = runPublishCheck(a) || {};
    return { blocking: r.blocking || [], warnings: r.warnings || [], available: true };
  } catch (e) { return { blocking: [], warnings: [], available: false }; }
}

/* ---------- §四 记录层（同名实现，这里只做存在性锚点，避免日后改名时对照表失效） ---------- */
function buildActivityDNAAlias(a, photos) {
  return (typeof buildActivityDNA === "function") ? buildActivityDNA(a, photos) : null;
}
function activityDNAFor(a, photos) {
  return (typeof activityDNAOf === "function") ? activityDNAOf(a, photos) : buildActivityDNAAlias(a, photos);
}
function itineraryStructure(a) {
  // 注意：structureItinerary 的 days 是「天数（数字）」而非数组——降级形状必须与真实返回一致
  return (typeof structureItinerary === "function")
    ? structureItinerary(a)
    : { timeline: [], hasReal: false, days: 0, narrative: { title: "", paras: [] } };
}

/* ---------- §四 图片智能层（转发 photo.js） ---------- */
function analyzePhotos(photos) { return (typeof piAnalyze === "function") ? piAnalyze(photos) : []; }
function selectPhotos(analysis) { return (typeof piSelect === "function") ? piSelect(analysis) : { used: [], discarded: [], usedIds: [] }; }
function assignPhotoRoles(used) { return (typeof piAssignRoles === "function") ? piAssignRoles(used) : { heroId: null, roles: {} }; }
function matchPhotosToSections(sections, used, roles) {
  return (typeof piMatchSections === "function") ? piMatchSections(sections, used, roles) : [];
}
function matchItineraryPhotos(timeline, used, roles) {
  return (typeof piMatchItinerary === "function") ? piMatchItinerary(timeline, used, roles) : { byDay: {}, note: "" };
}
function evaluateCropSafety(photoAnalysis) {
  return (typeof piCropSafety === "function") ? piCropSafety(photoAnalysis) : { level: "low", prefer: "cover", reasons: [] };
}
function evaluateCropSafetyAll(used) {
  return (typeof piEvaluateCrops === "function") ? piEvaluateCrops(used) : { list: [], byId: {}, highRiskIds: [] };
}
function buildAdaptiveLayout(used) {
  return (typeof piAdaptiveLayout === "function") ? piAdaptiveLayout(used) : { mode: "empty", components: [], hint: "" };
}
function buildPhotoLayoutIntelligence(photos, a, sections, scenario) {
  if (typeof buildPhotoIntelligence === "function") return buildPhotoIntelligence(photos, a, sections, scenario);
  // 降级形状与 buildPhotoIntelligence 的真实返回逐字段对齐
  return {
    analysis: [], selection: { used: [], discarded: [], usedIds: [] }, used: [],
    heroId: null, roles: {}, roleLabel: {}, layout: { mode: "empty", components: [], hint: "" },
    cropSafety: { list: [], byId: {}, highRiskIds: [] }, matched: [],
    orientation: { landscape: 0, portrait: 0, square: 0 },
    dnaEnv: "", simulated: false, summary: "",
  };
}

/* describePhotoProfile(intel) → 文档 P0-5/P0-6/P0-7 要求的完整「图片画像」
   数量结构 / 横竖方比例 / 主体构成 / 质量与重复 / 三类候选（Hero、安全全幅、拼图）。 */
function describePhotoProfile(intel) {
  const empty = {
    total: 0, usedCount: 0, discardedCount: 0,
    landscapeRatio: 0, portraitRatio: 0, squareRatio: 0,
    peopleRatio: 0, groupRatio: 0, actionRatio: 0, detailRatio: 0, scenicRatio: 0,
    lowQualityCount: 0, repeatedCount: 0,
    heroCandidates: [], safeFullWidthCandidates: [], collageCandidates: [],
    strategy: "", layoutMode: "", simulated: false,
  };
  if (!intel) return empty;
  const used = intel.used || [];
  const total = (intel.analysis || []).length;
  const n = used.length || 1;
  const ratio = (fn) => Number((used.filter(fn).length / n).toFixed(2));
  // 重复图：同一 dupKey（类别 + 朝向）出现 ≥2 次，记超出部分数量
  const seen = {};
  let repeated = 0;
  used.forEach((p) => { const k = p.dupKey || p.scene; seen[k] = (seen[k] || 0) + 1; if (seen[k] > 1) repeated++; });
  const highRisk = {};
  (((intel.cropSafety && intel.cropSafety.highRiskIds) || [])).forEach((id) => { highRisk[id] = true; });
  const isLandscape = (p) => p.orientation === "landscape";
  const isPortrait = (p) => p.orientation === "portrait";

  return {
    total: total,
    usedCount: used.length,
    discardedCount: ((intel.selection && intel.selection.discarded) || []).length,
    landscapeRatio: ratio(isLandscape),
    portraitRatio: ratio(isPortrait),
    squareRatio: ratio((p) => p.orientation === "square"),
    peopleRatio: ratio((p) => (p.people || 0) > 0),
    groupRatio: ratio((p) => (p.people || 0) > 1),
    actionRatio: ratio((p) => !!p.action),
    detailRatio: ratio((p) => p.scene === "detail"),
    scenicRatio: ratio((p) => p.scene === "scenic"),
    lowQualityCount: used.filter((p) => (p.quality || 0) < 0.5).length,
    repeatedCount: repeated,
    // Hero 候选：横图 + 非高危裁切 + 非多人合影（合影主体大图易裁坏）
    heroCandidates: used.filter((p) => isLandscape(p) && !highRisk[p.imageId] && (p.people || 0) <= 1).map((p) => p.imageId),
    // 安全全幅候选：非高危 + 画质达标（可放心做通栏大图）
    safeFullWidthCandidates: used.filter((p) => !highRisk[p.imageId] && (p.quality || 0) >= 0.55).map((p) => p.imageId),
    // 拼图候选：朝向多样时更耐看，排除高危与低质
    collageCandidates: used.filter((p) => !highRisk[p.imageId] && (p.quality || 0) >= 0.5).map((p) => p.imageId),
    strategy: (intel.selection && intel.selection.strategy) || "",
    layoutMode: (intel.layout && intel.layout.mode) || "",
    simulated: !!intel.simulated,
  };
}

/* ---------- §四 内容层 ---------- */

/* generateSectionCopy(heading, opts) → 单个段落的替代文案（事实驱动，不造事件）
   opts: { master, activity, seed } */
function generateSectionCopy(heading, opts) {
  const o = opts || {};
  if (typeof xfSectionAlt !== "function") return "";
  try { return xfSectionAlt(heading, o.master || {}, o.activity || null, o.seed || 0) || ""; } catch (e) { return ""; }
}

/* validateClaims(out, facts, adv) → Claim→Fact 校验结果（文档 P2-2）
   只搬运 xfContentQuality 的既有判定，不新增规则。 */
function validateClaims(out, facts, adv) {
  const res = { available: false, score: null, unsupported: [], fiction: [], flags: [], note: "" };
  if (typeof xfContentQuality !== "function") return res;
  let cq = null;
  try { cq = xfContentQuality(out, {}, "recruit", facts, adv) || {}; } catch (e) { return res; }
  const flags = cq.flags || [];
  res.available = true;
  res.score = cq.score;
  res.flags = flags;
  res.unsupported = flags.filter((f) => f.indexOf("unsupported:") === 0).map((f) => f.split(":")[1]);
  res.fiction = flags.filter((f) => f.indexOf("fiction:") === 0).map((f) => f.split(":")[1]);
  res.note = res.unsupported.length ? ("以下说法缺少事实依据：" + res.unsupported.join("、"))
    : (res.fiction.length ? ("检测到可能的虚构表述：" + res.fiction.join("、")) : "未发现无依据声明");
  return res;
}

/* validateLayout(dir, scenario) → 版式质量校验（文档 P2-5） */
function validateLayout(dir, scenario) {
  const res = { available: false, score: null, flags: [] };
  if (typeof xfEditorialQuality !== "function" || !dir) return res;
  try {
    const eq = xfEditorialQuality(dir, scenario || "recruit", (dir && dir.family) || "", (dir && dir.variant) || 0) || {};
    res.available = true; res.score = eq.score; res.flags = eq.flags || [];
  } catch (e) { /* 保持 available:false */ }
  return res;
}

/* ---------- §四 编排 / 渲染层 ---------- */
function buildPageStoryOutline(a) {
  // buildPageOutline 返回的是区块数组（不是 {blocks:[]}）——降级形状保持一致
  return (typeof buildPageOutline === "function") ? buildPageOutline(a) : [];
}
function renderActivityStoryPage(a) {
  return (typeof renderActivityPhone === "function") ? renderActivityPhone(a) : "";
}
function pageCompositionOf(a) { return (typeof pageComposition === "function") ? pageComposition(a) : ""; }
function editorialSectionTitleOf(a) { return (typeof editorialSectionTitle === "function") ? editorialSectionTitle(a) : ""; }

/* ---------- §五 聚合状态 ----------
   buildActivityAiState(a, opts) → 文档推荐的单一状态对象。
   opts: { photos, scenario, dir, out, master, sections }
   注意：仅聚合「已产出」的内容 —— finalCopy/claimValidation 等在未生成时保持 null，
        不做任何占位编造（宁可为 null，也不给假数据）。 */
function buildActivityAiState(a, opts) {
  const o = opts || {};
  const photos = o.photos || (a && a.photos) || [];
  const scenario = o.scenario || "recruit";
  const intel = buildPhotoLayoutIntelligence(photos, a, o.sections || [], scenario);

  return {
    /* 事实与置信度 */
    confirmedFacts: extractFacts(a, photos),
    missingFacts: detectMissingFacts(a),
    confidenceMap: confidenceMap(a),
    publishCheck: publishCheck(a),
    /* 活动基因 */
    activityDNA: activityDNAFor(a, photos),
    /* 行程 */
    itineraryStructure: itineraryStructure(a),
    /* 图片智能 */
    photoProfile: describePhotoProfile(intel),
    selectedPhotos: intel.used || [],
    photoRoles: intel.roles || {},
    photoLayout: intel.layout || null,
    cropSafety: intel.cropSafety || null,
    photoToSections: intel.matched || [],
    photoIntel: intel,
    /* 表达（需显式传入产物才有值） */
    storyOutline: buildPageStoryOutline(a),
    editorialDirection: o.dir || null,
    finalCopy: o.out || null,
    layoutPlan: (o.dir && (o.dir.layout || o.dir.visual)) || null,
    /* 校验 */
    claimValidation: o.out ? validateClaims(o.out, o.master && o.master.confirmedFacts ? o.master.confirmedFacts : extractFacts(a, photos), (o.master && o.master.actualActivityData) || {}) : null,
    layoutValidation: validateLayout(o.dir, scenario),
  };
}

/* ---------- §十 四个模块命名空间（与文档模块名一一对应） ---------- */
const AI_ACTIVITY_DIRECTOR = {
  label: "AI Activity Director",
  buildDNA: activityDNAFor,
  extractFacts: extractFacts,
  detectMissingFacts: detectMissingFacts,
  confidenceMap: confidenceMap,
  publishCheck: publishCheck,
};
const AI_CONTENT_COMPOSER = {
  label: "AI Content Composer",
  buildContentMaster: function (a, photos) { return (typeof buildContentMaster === "function") ? buildContentMaster(a, photos) : null; },
  generateSectionCopy: generateSectionCopy,
  validateClaims: validateClaims,
  qualityCheck: function (out, dir, scenario, facts, adv) { return (typeof xfQualityCheck === "function") ? xfQualityCheck(out, dir, scenario, facts, adv) : out; },
};
const AI_PHOTO_LAYOUT_INTELLIGENCE = {
  label: "AI Photo Layout Intelligence",
  analyze: analyzePhotos,
  select: selectPhotos,
  assignRoles: assignPhotoRoles,
  matchSections: matchPhotosToSections,
  matchItinerary: matchItineraryPhotos,
  adaptiveLayout: buildAdaptiveLayout,
  cropSafety: evaluateCropSafety,
  cropSafetyAll: evaluateCropSafetyAll,
  describeProfile: describePhotoProfile,
  build: buildPhotoLayoutIntelligence,
};
const AI_LAYOUT_COMPOSER = {
  label: "AI Layout Composer",
  validateLayout: validateLayout,
  buildPageStoryOutline: buildPageStoryOutline,
  composition: pageCompositionOf,
  sectionTitle: editorialSectionTitleOf,
  renderPage: renderActivityStoryPage,
};

/* 控制台逐条验收入口：window.CLUBOS_PIPELINE.extractFacts(...) 等 */
if (typeof window !== "undefined") {
  window.CLUBOS_PIPELINE = {
    // 版本随发版动态读取，不硬编码（避免下次 bump 后失真）
    version: (typeof APP_VER !== "undefined") ? ("v" + APP_VER) : "unknown",
    extractFacts: extractFacts,
    detectMissingFacts: detectMissingFacts,
    confidenceMap: confidenceMap,
    publishCheck: publishCheck,
    activityDNA: activityDNAFor,
    itineraryStructure: itineraryStructure,
    analyzePhotos: analyzePhotos,
    selectPhotos: selectPhotos,
    assignPhotoRoles: assignPhotoRoles,
    matchPhotosToSections: matchPhotosToSections,
    matchItineraryPhotos: matchItineraryPhotos,
    evaluateCropSafety: evaluateCropSafety,
    buildAdaptiveLayout: buildAdaptiveLayout,
    describePhotoProfile: describePhotoProfile,
    buildPageStoryOutline: buildPageStoryOutline,
    generateSectionCopy: generateSectionCopy,
    validateClaims: validateClaims,
    validateLayout: validateLayout,
    renderActivityStoryPage: renderActivityStoryPage,
    buildActivityAiState: buildActivityAiState,
    modules: {
      activityDirector: AI_ACTIVITY_DIRECTOR,
      contentComposer: AI_CONTENT_COMPOSER,
      photoLayoutIntelligence: AI_PHOTO_LAYOUT_INTELLIGENCE,
      layoutComposer: AI_LAYOUT_COMPOSER,
    },
  };
}
