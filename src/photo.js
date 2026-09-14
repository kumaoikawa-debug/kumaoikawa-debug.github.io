/* ================= ClubOS · Photo Layout Intelligence（v147 / P0-6~P0-11） =================
   职责：照片分析归一化 → 自动筛图 → 角色分配 → 图片-行程匹配 → 自适应排版 → 安全裁切评估。
   数据来源：ai.js 的 photoMeta(src)（v145 已真实计算 焦点/朝向/画质/类别/情绪/文字安全区）。
   设计原则：
     ① 版式服从素材（先分析再排版），不先选模板硬塞图；
     ② 无真实视觉模型时的推断一律标记 simulated，UI 需提示「模拟分析（演示）」；
     ③ 只负责「排版与呈现」，绝不改动任何活动事实（事实边界由 ai.js/publish.js 把关）。 */

/* ---------- 基础工具（确定性哈希，保证同素材同结果） ---------- */
function piHash(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function piRand(seed) { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

/* 分类 → 场景语义（photoMeta.category 来自 v145 的像素启发式） */
const PI_SCENE_BY_CAT = { "山野/植被": "scenic", "天空/开阔地": "sky", "人物/动态": "people", "环境/细节": "detail", "未分析": "detail" };
const PI_SCENE_LABEL = { scenic: "风景", sky: "天空", people: "人物", action: "动作", water: "水上", camp: "营地", meal: "餐食", gear: "装备", detail: "细节", route: "路线" };
const PI_ROLE_LABEL = { HeroImage: "封面主图", SectionLeadImage: "段落主图", SupportImage: "辅助图", GalleryImage: "图廊", DetailImage: "细节图", InfoBackground: "信息区背景", DiscardCandidate: "建议弃用" };

/* ---------- P0-6：Photo Analysis 2.0（归一化 + 补全） ---------- */
function piAnalyzeOne(src, i) {
  const m = (typeof photoMeta === "function") ? photoMeta(src) : null;
  const h = piHash(src + "#" + i);
  const orientation = (m && m.orientation) || (piRand(h) < 0.34 ? "portrait" : (piRand(h + 1) < 0.72 ? "landscape" : "square"));
  const quality = (m && m.quality_score != null) ? m.quality_score : Number((0.56 + piRand(h + 2) * 0.38).toFixed(2));
  const cat = (m && m.category) || "未分析";
  const scene = PI_SCENE_BY_CAT[cat] || "detail";
  // P2-3：若已接入真实视觉模型，优先采用其 people_count / action（见 piApplyVision）
  const people = (m && m.people_count != null) ? m.people_count : (scene === "people" ? 1 + (h % 4) : (piRand(h + 3) < 0.3 ? 1 : 0));
  const action = (m && m.action) ? m.action : ((h % 5 === 0 && scene !== "sky") ? "动态" : "");
  const subject = scene === "people" ? "人物" : (scene === "scenic" ? "环境" : (scene === "sky" ? "天空" : "细节"));
  const emotion = (m && m.emotion) || (piRand(h + 4) < 0.5 ? "明快" : "沉静");
  const safeTextArea = (m && m.safe_text_area) || "top-right";
  const recommendedUse = (m && m.recommended_use) || ["story"];
  return {
    imageId: "ph_" + i, src: src, index: i,
    orientation: orientation, quality: quality, scene: scene, sceneLabel: PI_SCENE_LABEL[scene] || scene,
    subject: subject, people: people, action: action, emotion: emotion, category: cat,
    safeTextArea: safeTextArea, recommendedUse: recommendedUse,
    focal: (m && m.focal_point) || { x: 0.5, y: 0.45 },
    cropRisk: (m && m.crop_risk) || null, // P2-3：真实视觉模型给出的裁切风险（low/medium/high）
    simulated: !(m && m.simulated === false),
    dupKey: cat + "|" + orientation,
  };
}
function piAnalyze(photos) {
  const list = (photos || []).filter(Boolean);
  const uniq = list.filter((s, i) => list.indexOf(s) === i); // 同源去重
  return uniq.map((s, i) => piAnalyzeOne(s, i));
}

/* ---------- P0-7：自动筛图（去重 / 质量 / 数量策略） ---------- */
const PI_COUNT_STRATEGY = [
  { max: 3, cap: (n) => n, label: "少图（1-3）：全部使用，克制留白" },
  { max: 8, cap: (n) => Math.min(n, 8), label: "中量（4-8）：Hero + 双图/三图组合" },
  { max: 20, cap: (n) => Math.min(n, 12), label: "多图（9-20）：图文章节化，筛到约 12 张" },
  { max: Infinity, cap: () => 14, label: "大量（20+）：自动筛图，最多 14 张" },
];
function piStrategy(n) { return PI_COUNT_STRATEGY.find((s) => n <= s.max); }
function piSelect(analysis) {
  const n = analysis.length;
  const strat = piStrategy(n);
  const cap = strat.cap(n);
  const dupCount = {};
  analysis.forEach((p) => { dupCount[p.dupKey] = (dupCount[p.dupKey] || 0) + 1; });
  const seen = {};
  const scored = analysis.map((p) => {
    let score = p.quality * 100;
    if (p.orientation === "landscape") score += 6;
    if (p.scene === "scenic") score += 5;
    if (p.scene === "people") score += 3;
    if (p.quality < 0.58) score -= 22;
    const ord = seen[p.dupKey] || 0; seen[p.dupKey] = ord + 1;
    if (ord) score -= 12 + ord * 6;
    return Object.assign({}, p, { score: Math.round(score) });
  });
  const ranked = scored.slice().sort((a, b) => b.score - a.score);
  const used = ranked.slice(0, cap).sort((a, b) => a.index - b.index);
  const usedIds = {};
  used.forEach((p) => { usedIds[p.imageId] = true; });
  const discarded = ranked.filter((p) => !usedIds[p.imageId]).map((p, k) => ({
    imageId: p.imageId, src: p.src,
    reason: p.quality < 0.58 ? "画质偏低" : (dupCount[p.dupKey] > 1 ? "与其他图重复/近似" : (n > 20 ? "与主题相关性较弱" : "超出推荐张数")),
  }));
  return { strategy: strat.label, cap: cap, total: n, usedIds: used.map((p) => p.imageId), used: used, discarded: discarded };
}

/* ---------- P0-8：图片角色系统 ---------- */
function piAssignRoles(used) {
  const roles = {};
  if (!used.length) return { heroId: null, roles: roles };
  const hero = used.find((p) => p.orientation !== "portrait" && p.scene === "scenic")
    || used.find((p) => p.orientation !== "portrait")
    || used[0];
  let leadBudget = Math.max(1, Math.min(3, Math.round(used.length * 0.35)));
  used.forEach((p, i) => {
    if (p.imageId === hero.imageId) { roles[p.imageId] = "HeroImage"; return; }
    if (leadBudget > 0 && p.quality >= 0.6 && i <= 4) { roles[p.imageId] = "SectionLeadImage"; leadBudget--; return; }
    if (p.scene === "detail" || p.quality < 0.62) { roles[p.imageId] = "DetailImage"; return; }
    if (p.orientation === "portrait" && i >= used.length - 2) { roles[p.imageId] = "SupportImage"; return; }
    roles[p.imageId] = "GalleryImage";
  });
  return { heroId: hero.imageId, roles: roles };
}

/* ---------- P0-9：图片-行程/段落匹配 ---------- */
/* section.kind 提示 → 偏好场景；无 kind 时按关键词兜底 */
const PI_KIND_SCENES = {
  opening: ["scenic", "sky", "route"], scenic: ["scenic", "sky", "route"], landscape: ["scenic", "sky"],
  experience: ["action", "people", "water", "camp"], people: ["people", "action"], action: ["action", "people"],
  water: ["water", "action"], camp: ["camp", "sky", "people"], meal: ["meal", "detail"], gear: ["gear", "detail"],
  detail: ["detail", "gear"], ending: ["sky", "scenic", "people"], fit: ["people", "detail"], info: ["detail", "gear"],
};
function piKindFromText(txt) {
  const h = String(txt || "");
  if (/为什么|值得|风景|景|地点|路线|地貌|山|湖|林/.test(h)) return "scenic";
  if (/体验|玩|挑战|探索|运动|做|水上|walk/.test(h)) return "experience";
  if (/收获|适合|谁|陪伴|人/.test(h)) return "people";
  if (/装备|准备/.test(h)) return "gear";
  if (/费用|信息|报名|详情|须知/.test(h)) return "info";
  if (/预告|下一期|结尾|收束/.test(h)) return "ending";
  return "";
}
function piMatchSections(sections, used, roles) {
  const avail = used.slice();
  const take = (prefer, count) => {
    const picks = [];
    for (const want of prefer) {
      for (let i = 0; i < avail.length && picks.length < count; i++) {
        const p = avail[i];
        if (p.scene === want && !picks.includes(p)) picks.push(p);
      }
      if (picks.length >= count) break;
    }
    // 不足则按顺序补齐（但避免 Hero 抢位：Hero 优先留给需要大图的段落）
    for (let i = 0; i < avail.length && picks.length < count; i++) if (!picks.includes(avail[i])) picks.push(avail[i]);
    return picks;
  };
  return (sections || []).map((sec, idx) => {
    const kind = sec.kind || piKindFromText(typeof sec === "string" ? sec : (sec.h || ""));
    const prefer = PI_KIND_SCENES[kind] || ["scenic", "people", "detail"];
    const heroPic = avail.find((p) => roles[p.imageId] === "HeroImage");
    // 封面段（第一段）优先用 Hero
    if (idx === 0 && heroPic) return { sectionIndex: idx, kind: kind, photos: [heroPic] };
    const want = (kind === "scenic" || kind === "experience") ? 2 : 1;
    return { sectionIndex: idx, kind: kind, photos: take(prefer, want) };
  });
}

/* ---------- P0-10：自适应排版（按数量 + 横竖比例选组件） ---------- */
function piAdaptiveLayout(used) {
  const n = used.length;
  const land = used.filter((p) => p.orientation === "landscape").length;
  const port = used.filter((p) => p.orientation === "portrait").length;
  const sq = used.filter((p) => p.orientation === "square").length;
  const plan = [];
  // P2-4 少图降级：0/1/2/3/4-5 各自独立布局逻辑，绝不强行套复杂大图文
  if (n === 0) return { mode: "empty", components: [], hint: "0 图：纯文字克制版式" };
  if (n === 1) return { mode: "single", components: ["FullBleedImage"], hint: "1 图：单张大图 + 留白" };
  if (n === 2) return { mode: "pair", components: ["FullBleedImage", port >= 1 ? "AspectPreservedImage" : "TwoImageGrid"], hint: "2 图：一大一插图，不重复用图" };
  if (n === 3) return { mode: "trio", components: ["FullBleedImage", port >= 2 ? "PortraitPair" : "ThreeImageGrid"], hint: "3 图：大图 + 双/三图" };
  if (n <= 5) {
    plan.push("FullBleedImage");
    if (land >= 2) plan.push("TwoImageGrid");
    if (port >= 2) plan.push("PortraitPair");
    if (n >= 5) plan.push("ThreeImageGrid");
    return { mode: "hero_pairs", components: plan, hint: "4-5 图：Hero + 双图 / 三图穿插" };
  }
  if (n <= 8) {
    plan.push("FullBleedImage");
    if (land >= 2) plan.push("TwoImageGrid");
    if (port >= 2) plan.push("PortraitPair");
    if (n - 3 >= 3) plan.push("ThreeImageGrid");
    return { mode: "hero_pairs", components: plan, hint: "中量：Hero + 双/三图组合" };
  }
  if (n <= 20) {
    plan.push("FullBleedImage", "ImagePair", "ThreeImageGrid", "GalleryGrid", "AspectPreservedImage");
    if (sq >= 2) plan.push("MosaicGrid");
    return { mode: "chapters", components: plan, hint: "多图：章节化，大图 + 图廊穿插" };
  }
  plan.push("FullBleedImage", "ImagePair", "GalleryGrid", "GalleryGrid", "MosaicGrid");
  return { mode: "curated", components: plan, hint: "大量：先筛图再排版，图廊为主" };
}

/* ---------- P0-11：安全裁切评估 ---------- */
/* 风险来源：人物/合影主体位于画面边缘、画质低、竖图被强制横裁、焦点过于靠边 */
function piCropSafety(p) {
  // P2-3：若真实视觉模型已判定裁切风险，直接采用（优先级高于本地启发式）
  if (p.cropRisk && ["low", "medium", "high"].indexOf(p.cropRisk) >= 0) {
    const map = { high: 70, medium: 38, low: 8 };
    return {
      imageId: p.imageId, risk: map[p.cropRisk], level: p.cropRisk, reasons: ["视觉模型判定"],
      prefer: p.cropRisk === "high" ? "aspect_preserved" : (p.cropRisk === "medium" ? "wide_safe_focus" : "any"),
      fromModel: true,
    };
  }
  let risk = 0;
  const reasons = [];
  if (p.people > 1) { risk += 18; reasons.push("多人/合影主体"); }
  else if (p.people === 1) { risk += 8; reasons.push("含人物"); }
  const fx = p.focal ? p.focal.x : 0.5, fy = p.focal ? p.focal.y : 0.45;
  const edgeDist = Math.min(fx, 1 - fx, fy, 1 - fy);
  if (p.people > 0 && edgeDist < 0.18) { risk += 22; reasons.push("主体靠近画面边缘"); }
  if (p.orientation === "portrait") { risk += 14; reasons.push("竖图，横裁风险高"); }
  if (p.quality < 0.58) { risk += 12; reasons.push("画质偏低，放大后易失真"); }
  risk = Math.max(0, Math.min(100, risk));
  const level = risk >= 45 ? "high" : (risk >= 22 ? "medium" : "low");
  return {
    imageId: p.imageId, risk: risk, level: level, reasons: reasons,
    // high → 原比例展示 / 不用作 Hero；medium → 允许整宽但需安全焦点裁切
    prefer: risk >= 45 ? "aspect_preserved" : (risk >= 22 ? "wide_safe_focus" : "any"),
  };
}
function piEvaluateCrops(used) {
  const list = used.map(piCropSafety);
  const byId = {}; list.forEach((c) => { byId[c.imageId] = c; });
  return { list: list, byId: byId, highRiskIds: list.filter((c) => c.level === "high").map((c) => c.imageId) };
}

/* ---------- 门面：一次产出完整图片智能（供详情页 / 宣发 / UI 轻确认复用） ---------- */
function buildPhotoIntelligence(photos, a, sections, scenario) {
  const analysis = piAnalyze(photos);
  const selection = piSelect(analysis);
  const used = selection.used;
  const roleInfo = piAssignRoles(used);
  const crops = piEvaluateCrops(used);
  // 安全裁切：高风险图若被选为 Hero，降级为 SectionLead（避免强裁主体）
  if (roleInfo.heroId && crops.byId[roleInfo.heroId] && crops.byId[roleInfo.heroId].level === "high") {
    const alt = used.find((p) => p.imageId !== roleInfo.heroId && (!crops.byId[p.imageId] || crops.byId[p.imageId].level !== "high") && p.orientation !== "portrait");
    if (alt) { roleInfo.roles[roleInfo.heroId] = "SectionLeadImage"; roleInfo.roles[alt.imageId] = "HeroImage"; roleInfo.heroId = alt.imageId; }
  }
  const layout = piAdaptiveLayout(used);
  const matched = sections && sections.length ? piMatchSections(sections, used, roleInfo.roles) : [];
  const dnaEnv = (a && a.activityDNA && a.activityDNA.environment) || "";
  return {
    analysis: analysis, selection: selection, used: used,
    heroId: roleInfo.heroId, roles: roleInfo.roles, roleLabel: PI_ROLE_LABEL,
    layout: layout, cropSafety: crops, matched: matched,
    orientation: {
      landscape: used.filter((p) => p.orientation === "landscape").length,
      portrait: used.filter((p) => p.orientation === "portrait").length,
      square: used.filter((p) => p.orientation === "square").length,
    },
    dnaEnv: dnaEnv,
    simulated: analysis.some((p) => p.simulated),
    summary: `${analysis.length} 张 → 建议使用 ${used.length} 张（弃用 ${selection.discarded.length}）`,
  };
}

/* ---------- P2-3：真实视觉模型接口预留 ----------
   本项目当前的 scene / subject / people / action / emotion 为规则启发式推断（simulated=true）。
   接入真实视觉模型时，只需把模型结果写回缓存，无需改动任何版式/渲染代码：
     piApplyVision(src, { orientation, quality_score, category, emotion, subjects,
                          people_count, action, safe_text_area, focal_point, recommended_use })
   —— piAnalyze() 会自动采用（并把该图的 simulated 置为 false）。 */
function piVisionEnabled() { return (typeof window !== "undefined" && !!window.CLUBOS_VISION_API); }
function piApplyVision(src, data) {
  if (!src || !data || typeof PHOTO_FOCUS_CACHE === "undefined") return false;
  try {
    const prev = PHOTO_FOCUS_CACHE.get(src) || {};
    PHOTO_FOCUS_CACHE.set(src, Object.assign({}, prev, data, { simulated: false }));
    return true;
  } catch (e) { return false; }
}
function piApplyVisionBatch(map) {
  let n = 0;
  Object.keys(map || {}).forEach((src) => { if (piApplyVision(src, map[src])) n++; });
  return n;
}
