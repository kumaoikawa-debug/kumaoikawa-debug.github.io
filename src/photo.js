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
const PI_SCENE_LABEL = {
  scenic: "风景", sky: "天空", people: "人物", group: "合影", action: "动作",
  water: "水上", hike: "徒步", camp: "露营", meal: "餐食", gear: "装备",
  night: "夜景", detail: "细节", route: "路线",
};
const PI_TAG_TO_SCENE = { "风景": "scenic", "人物": "people", "合影": "group", "动作": "action", "水上": "water", "徒步": "hike", "露营": "camp", "餐食": "meal", "装备": "gear", "夜景": "night", "细节": "detail", "路线": "route" };
/* P0-6：14 类内容识别（多标签——一张图可命中多个类，与上传顺序无关） */
const PI_TAGS = ["风景", "人物", "合影", "动作", "水上", "徒步", "露营", "餐食", "装备", "夜景", "细节", "路线", "重复图", "低质量图"];
const PI_ROLE_LABEL = { HeroImage: "封面主图", SectionLeadImage: "段落主图", SupportImage: "辅助图", GalleryImage: "图廊", DetailImage: "细节图", InfoBackground: "信息区背景", DiscardCandidate: "建议弃用" };

/* ---------- P0-6：感知哈希（64 位，分 lo/hi 两段，避免 BigInt 依赖） ---------- */
function piPhashHamming(a, b) {
  if (!a || !b) return 999;
  const pop = (n) => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };
  return pop((a.lo ^ b.lo) >>> 0) + pop((a.hi ^ b.hi) >>> 0);
}
function piProxyPhash(src) {
  // 无真实分析时的确定性代理（仅按 src 内容派生，不引用上传下标）
  const h = piHash(src || "x");
  return { lo: h >>> 0, hi: (Math.imul(h, 2654435761)) >>> 0 };
}

/* 把 photoMeta（真实 Canvas 分析 或 视觉模型注入）归一化为识别信号。
   关键：信号只来自图片「内容」，绝不引用上传下标 i —— 这是 P0-6 验收「不按上传顺序轮流套分类」的根基。 */
function metaToSignals(m) {
  const orientation = m.orientation || "landscape";
  const quality = (m.quality_score != null) ? m.quality_score : 0.6;
  const avgLum = (m.avgLum != null) ? m.avgLum : 128;
  const sat = (m.sat != null) ? m.sat : 0;
  const edge = (m.edge != null) ? m.edge : 8;
  const blueRatio = (m.blueRatio != null) ? m.blueRatio : 0;
  const warmRatio = (m.warmRatio != null) ? m.warmRatio : 0;
  const skinRatio = (m.skinRatio != null) ? m.skinRatio : 0;
  const peopleCount = (m.people_count != null) ? m.people_count
    : (skinRatio > 0.20 ? 3 : (skinRatio > 0.10 ? 2 : (skinRatio > 0.04 ? 1 : 0)));
  const actionFlag = !!(m.action) || !!(m.actionFlag);
  const motionScore = (m.motionScore != null) ? m.motionScore : 0;
  const isWater = !!(m.isWater) || blueRatio > 0.28;
  const isNight = !!(m.isNight) || avgLum < 70;
  const isGear = !!(m.isGear);
  const isHike = !!(m.isHike);
  const isRoute = !!(m.isRoute);
  const isDetail = edge > 26 && blueRatio < 0.18 && warmRatio < 0.45;
  const pHash = (m.pHash != null) ? m.pHash : null;
  return {
    orientation, quality, avgLum, sat, edge, blueRatio, warmRatio, skinRatio,
    peopleCount, actionFlag, motionScore, isWater, isNight, isGear, isHike, isRoute, isDetail,
    pHash,
    category: m.category || "内容识别", emotion: m.emotion || "真实",
    actionLabel: m.action || "", sceneLabel: m.sceneLabel || "",
    safe_text_area: m.safe_text_area || "top-right",
    recommended_use: m.recommended_use || ["story"],
    focal_point: m.focal_point || { x: 0.5, y: 0.45 },
    cropRisk: m.crop_risk || null,
  };
}

/* 无真实分析时的确定性内容指纹（仅基于 src 内容，不使用上传下标）。
   与旧版 piRand(index) 的根本区别：同一张图无论排第几都得到相同识别，
   不同内容（不同 src）得到不同识别——绝不按上传顺序轮流套分类。 */
function piFallbackMeta(src) {
  const h = piHash(src || "x");
  const r = (k) => { const x = Math.sin((h + k) * 12.9898) * 43758.5453; return x - Math.floor(x); };
  const orientation = r(1) < 0.34 ? "portrait" : (r(2) < 0.72 ? "landscape" : "square");
  const quality = Number((0.56 + r(3) * 0.38).toFixed(2));
  const blueRatio = r(4) * 0.5;
  const warmRatio = r(5) * 0.5;
  const skinRatio = r(6) * 0.3;
  const avgLum = 70 + r(7) * 150;
  const sat = r(8) * 0.5;
  const edge = 8 + r(9) * 22;
  const peopleCount = skinRatio > 0.18 ? 3 : (skinRatio > 0.09 ? 2 : (skinRatio > 0.04 ? 1 : 0));
  return {
    orientation, quality, avgLum, sat, edge, blueRatio, warmRatio, skinRatio,
    peopleCount, actionFlag: r(10) > 0.8, motionScore: r(11) * 0.4,
    isWater: blueRatio > 0.28, isNight: avgLum < 70,
    isGear: r(12) > 0.85, isHike: r(13) > 0.8, isRoute: r(14) > 0.8,
    isDetail: edge > 26 && blueRatio < 0.18 && warmRatio < 0.45,
    pHash: null,
    category: "内容识别", emotion: r(15) < 0.5 ? "明快" : "沉静",
    actionLabel: "", sceneLabel: "", safe_text_area: "top-right",
    recommended_use: ["story"], focal_point: { x: 0.5, y: 0.45 }, cropRisk: null,
  };
}

/* P0-6 核心：14 类内容识别（纯函数，输入信号 → 输出多标签）。
   识别严格基于图片「内容信号」，与上传顺序无关。 */
function piTagPhoto(sig) {
  const tags = [];
  if (!sig) return ["细节"];
  const q = sig.quality != null ? sig.quality : 0.6;
  const lum = sig.avgLum != null ? sig.avgLum : 128;
  const sat = sig.sat != null ? sig.sat : 0;
  const blue = sig.blueRatio != null ? sig.blueRatio : 0;
  const warm = sig.warmRatio != null ? sig.warmRatio : 0;
  const skin = sig.skinRatio != null ? sig.skinRatio : 0;
  const people = sig.peopleCount || 0;
  const action = sig.actionFlag;
  const motion = sig.motionScore || 0;
  const edge = sig.edge != null ? sig.edge : 8;
  const isNight = lum < 70;
  const isWater = sig.isWater || blue > 0.28;
  const lowQuality = q < 0.5;
  if (isNight) tags.push("夜景");
  if (isWater) tags.push("水上");
  if (people >= 3) tags.push("合影");
  else if (people >= 1) tags.push("人物");
  if (action || motion > 0.5) tags.push("动作");
  if (sig.isHike) tags.push("徒步");
  if (sig.isRoute) tags.push("路线");
  if (sig.isGear) tags.push("装备");
  // 餐食：暖色主导 + 有人 + 非水上
  if (warm > 0.42 && people >= 1 && !isWater) tags.push("餐食");
  // 露营：暖色 + 夜景 + 有人（篝火/营地场景近似）
  if (warm > 0.3 && isNight && people >= 1) tags.push("露营");
  // 风景：自然/开阔、无人、非夜景、非纯细节
  if (!people && !isNight && (sat > 0.3 || edge > 16)) tags.push("风景");
  // 细节：高边缘、低蓝低暖（近景纹理/特写）
  if (edge > 26 && blue < 0.18 && warm < 0.45) tags.push("细节");
  if (!tags.length) tags.push(isNight ? "夜景" : (people ? "人物" : "细节"));
  if (lowQuality) tags.push("低质量图");
  return tags;
}

/* 主场景（单值）：从多标签中取优先级最高的场景语义键，供版式/角色系统使用 */
function piPrimaryScene(tags) {
  const pri = ["合影", "人物", "动作", "水上", "徒步", "露营", "餐食", "装备", "夜景", "路线", "风景", "细节"];
  for (const t of pri) if (tags.indexOf(t) >= 0) return PI_TAG_TO_SCENE[t];
  return "detail";
}
function piSubject(tags) {
  if (tags.indexOf("合影") >= 0 || tags.indexOf("人物") >= 0) return "人物";
  if (tags.indexOf("水上") >= 0) return "水景";
  if (tags.indexOf("餐食") >= 0) return "餐食";
  if (tags.indexOf("装备") >= 0) return "装备";
  if (tags.indexOf("夜景") >= 0) return "夜景";
  if (tags.indexOf("风景") >= 0) return "环境";
  return "细节";
}

/* 亮点文案 ↔ 图片标签语义匹配（用于亮点卡片配图，避免按上传顺序轮流） */
function piSellMatch(kw, p) {
  const tags = p.tags || [];
  const k = String(kw || "");
  const map = [
    ["风景", /风景|景|山|湖|林|自然|风光/],
    ["人物", /人|队友|领队|陪伴|故事/],
    ["合影", /合影|团队|大家|一起/],
    ["动作", /挑战|运动|爬|登|涉水|刺激|体验/],
    ["水上", /水|溪|桨|漂|泳|清凉/],
    ["徒步", /徒步|步道|路线|登山|爬山/],
    ["露营", /露营|营地|篝火|星空|帐篷/],
    ["餐食", /餐|吃|美食|补给|野炊/],
    ["装备", /装备|物资|背包|帐篷|穿/],
    ["夜景", /夜|星空|篝火|日落/],
    ["细节", /细节|特写|质感|纹理/],
    ["路线", /路线|轨迹|里程|海拔/],
  ];
  for (const m of map) if (tags.indexOf(m[0]) >= 0 && m[1].test(k)) return true;
  return false;
}

/* ---------- P0-6：Photo Analysis 2.0（内容识别 + 重复/低质量标记） ---------- */
function piAnalyzeOne(src, i, phashSeen) {
  const m = (typeof photoMeta === "function") ? photoMeta(src) : null;
  const sig = m ? metaToSignals(m) : piFallbackMeta(src); // 信号只来自内容，不引用 i
  const tags = piTagPhoto(sig).slice();
  const isLow = (sig.quality != null ? sig.quality : 0.6) < 0.5;
  // 批量重复图检测：真实 pHash 优先，否则用 src 代理哈希做近邻比较（汉明距离 ≤ 4 判重）
  const ph = (sig.pHash != null) ? sig.pHash : piProxyPhash(src);
  let dupOf = null;
  if (phashSeen) {
    for (const seen of phashSeen) { if (piPhashHamming(ph, seen.ph) <= 4) { dupOf = seen.id; break; } }
    phashSeen.push({ id: "ph_" + i, ph: ph });
  }
  if (dupOf) tags.push("重复图");
  if (isLow) tags.push("低质量图");
  // 重复图退为 detail，避免抢占封面/Hero
  const scene = dupOf ? "detail" : piPrimaryScene(tags);
  const people = sig.peopleCount || 0;
  const action = sig.actionLabel || (sig.actionFlag ? "动态" : "");
  const subject = piSubject(tags);
  const emotion = sig.emotion || "真实";
  const safeTextArea = sig.safe_text_area || "top-right";
  const recommendedUse = sig.recommended_use || ["story"];
  const cropRisk = sig.cropRisk || null;
  // P0-6：完整 11 字段 schema + tags + 重复/低质量标记
  return {
    imageId: "ph_" + i, src: src, index: i,
    orientation: sig.orientation, quality: sig.quality,
    scene: scene, sceneLabel: PI_SCENE_LABEL[scene] || scene,
    subject: subject, people: people, action: action, emotion: emotion,
    tags: tags, category: sig.category || "内容识别",
    safeTextArea: safeTextArea, recommendedUse: recommendedUse,
    focal: sig.focal_point || { x: 0.5, y: 0.45 },
    cropRisk: cropRisk,
    simulated: !(m && m.simulated === false),
    dupOf: dupOf, lowQuality: isLow,
  };
}
function piAnalyze(photos) {
  const list = (photos || []).filter(Boolean);
  const uniq = list.filter((s, i) => list.indexOf(s) === i); // 同源去重
  const phashSeen = [];
  return uniq.map((s, i) => piAnalyzeOne(s, i, phashSeen));
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
  // P0-7：AI 先筛素材，再排版。绝不让 20+ 张无脑全塞进页面。
  //   弃用精确分为三类：① 重复（近邻 pHash 命中，每组仅留首张代表）
  //                     ② 质量较低（quality<0.5）
  //                     ③ 内容重复 / 与主题弱相关（可用池超出 cap 的剩余张数）
  //   注意：重复图与低质量图一律不进「使用」池，避免劣图抢占版面。
  const dups = [], lows = [], candidates = [];
  analysis.forEach((p) => {
    if (p.dupOf) dups.push(p);
    else if (p.lowQuality) lows.push(p);
    else candidates.push(p);
  });
  const STRONG = ["scenic", "people", "group", "action", "water", "hike", "camp", "meal", "gear", "night", "route"];
  const scoreOf = (p) => Math.round((p.quality || 0) * 100 + (p.orientation === "landscape" ? 6 : 0) + (STRONG.indexOf(p.scene) >= 0 ? 5 : 0));
  const ranked = candidates.slice().sort((a, b) => scoreOf(b) - scoreOf(a));
  const used = ranked.slice(0, cap);
  const usedIds = {}; used.forEach((p) => { usedIds[p.imageId] = true; });
  const weak = ranked.slice(cap);
  const discarded = dups.map((p) => ({ imageId: p.imageId, src: p.src, reason: "重复（与其他图近似）" }))
    .concat(lows.map((p) => ({ imageId: p.imageId, src: p.src, reason: "质量较低" })))
    .concat(weak.map((p) => ({ imageId: p.imageId, src: p.src, reason: "内容重复 / 与主题弱相关" })));
  return {
    strategy: strat.label, cap: cap, total: n,
    usedIds: used.map((p) => p.imageId), used: used, discarded: discarded,
    reasons: { dup: dups.length, low: lows.length, weak: weak.length },
  };
}

/* ---------- P0-8：图片角色系统 ---------- */
/* P0-7：角色预算（按「使用张数」比例分配，对齐案例 14 张 = Hero1+主图5+辅助图6+细节图2）
   约束：hero 恒为 1（有图时）；lead≈35%、detail≈14%，其余归辅助图。 */
function piRoleBudget(n) {
  if (n <= 0) return { hero: 0, lead: 0, support: 0, detail: 0 };
  if (n === 1) return { hero: 1, lead: 0, support: 0, detail: 0 };
  const hero = 1;
  const lead = Math.max(1, Math.min(Math.round(n * 0.35), n - 2));               // 主图（段落主图）
  const detail = Math.max(0, Math.min(Math.round(n * 0.14), n - hero - lead - 1)); // 细节图
  const support = Math.max(0, n - hero - lead - detail);                        // 辅助图
  return { hero: hero, lead: lead, support: support, detail: detail };
}
function piAssignRoles(used) {
  const roles = {};
  if (!used.length) return { heroId: null, roles: roles };
  const b = piRoleBudget(used.length);
  const STRONG = ["scenic", "people", "group", "action", "water", "hike", "camp", "meal", "gear", "night", "route"];
  const rankOf = (p) => (p.quality || 0) * 100 + (p.orientation === "landscape" ? 6 : 0) + (STRONG.indexOf(p.scene) >= 0 ? 5 : 0) + (p.lowQuality ? -30 : 0) + (p.dupOf ? -40 : 0);
  const ranked = used.slice().sort((a, b) => rankOf(b) - rankOf(a));
  // Hero：最优选横幅风景（避免竖图强裁主体）
  const hero = ranked.find((p) => p.orientation !== "portrait" && p.scene === "scenic")
    || ranked.find((p) => p.orientation !== "portrait")
    || ranked[0];
  roles[hero.imageId] = "HeroImage";
  const rest = ranked.filter((p) => p.imageId !== hero.imageId);
  // 主图（段落主图）：次优候选（used 内已排除重复/低质量，此处仅作安全守卫）
  let leadN = 0;
  for (const p of rest) {
    if (leadN >= b.lead) break;
    if (p.dupOf || p.lowQuality) continue;
    roles[p.imageId] = "SectionLeadImage"; leadN++;
  }
  // 细节图：细节场景优先，其次画质偏低者
  const remain = rest.filter((p) => !roles[p.imageId]);
  const detailCands = remain.slice().sort((a, b) => {
    const d = (p) => (p.scene === "detail" ? 100 : 0) + (1 - (p.quality || 0)) * 50;
    return d(b) - d(a);
  });
  let detailN = 0;
  for (const p of detailCands) {
    if (detailN >= b.detail) break;
    roles[p.imageId] = "DetailImage"; detailN++;
  }
  // 辅助图：其余全部
  remain.filter((p) => !roles[p.imageId]).forEach((p) => { roles[p.imageId] = "SupportImage"; });
  return { heroId: hero.imageId, roles: roles };
}

/* ---------- P0-9：图片-行程/段落匹配 ---------- */
/* section.kind 提示 → 偏好场景；无 kind 时按关键词兜底 */
const PI_KIND_SCENES = {
  opening: ["scenic", "sky", "route", "hike"], scenic: ["scenic", "sky", "route", "hike"], landscape: ["scenic", "sky"],
  experience: ["action", "people", "group", "water", "camp", "hike"], people: ["people", "group", "action"], action: ["action", "people", "group"],
  water: ["water", "action"], camp: ["camp", "sky", "people", "group"], meal: ["meal", "detail"], gear: ["gear", "detail"],
  detail: ["detail", "gear"], ending: ["sky", "scenic", "people", "group", "night"], fit: ["people", "group", "detail"], info: ["detail", "gear"], night: ["night", "scenic"],
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

/* ---------- P0-9：图片↔「行程段落」匹配（按 contentRole 语义绑定） ---------- */
const PI_ROLE_SCENES = {
  opening: ["route", "scenic", "sky", "hike", "detail"],
  arrival: ["route", "scenic", "hike", "detail"],
  warmup: ["people", "group", "gear", "detail"],
  core: ["action", "people", "group", "water", "camp", "scenic", "hike"],
  meal: ["meal", "detail", "people", "group"],
  rest: ["people", "group", "scenic", "detail"],
  closing: ["sky", "scenic", "people", "group", "night", "detail"],
};
/* 输入 structureItinerary() 的 timeline（含 contentRole/day），输出「每天 → 匹配到的图」
   语义优先、不重复用图；某天匹配不足时不再强行凑图（宁缺毋滥） */
function piMatchItinerary(timeline, used, roles) {
  const avail = (used || []).slice();
  const taken = {};
  const pickFor = (role, n) => {
    const prefer = PI_ROLE_SCENES[role] || ["scenic", "people", "detail"];
    const out = [];
    for (const want of prefer) {
      for (const p of avail) {
        if (out.length >= n) break;
        if (!taken[p.imageId] && p.scene === want) { out.push(p); taken[p.imageId] = true; }
      }
      if (out.length >= n) break;
    }
    return out;
  };
  const byDayRoles = {};
  (timeline || []).forEach((t) => { const d = t.day || 1; (byDayRoles[d] = byDayRoles[d] || []).push(t.contentRole); });
  const byDay = {};
  Object.keys(byDayRoles).forEach((d) => {
    const cnt = {};
    byDayRoles[d].forEach((r) => { cnt[r] = (cnt[r] || 0) + 1; });
    const dominant = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || "core";
    byDay[d] = pickFor(dominant, 2);
  });
  return { byDay: byDay, note: "按行程段落语义匹配" };
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
  if (p.orientation === "portrait") {
    risk += 14; reasons.push("竖图，横裁风险高");
    // P0-11 安全裁切：竖幅构图放进横幅位（Hero / 通栏）只会保留中间一条横带，
    // 含人物的竖图必然切到头或脚 —— 属于「宁可改版式，也不强裁主体」，直接判高风险。
    if (p.people > 1) { risk += 34; reasons.push("竖图含多人/合影：横裁必然切人"); }
    else if (p.people === 1) { risk += 26; reasons.push("竖图含人物：横裁易切头/切脚"); }
  }
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
    if (alt) {
      roleInfo.roles[roleInfo.heroId] = "SectionLeadImage"; roleInfo.roles[alt.imageId] = "HeroImage"; roleInfo.heroId = alt.imageId;
    } else {
      // 全部候选都高风险（例如整组竖图人像）：封面上必须有一张图 —— 退而求其次选「风险最低」的那张，
      // 且渲染层仍会按 pagePhotoRisk 走原比例展示（.ph-safe），不会强裁。
      const curRisk = crops.byId[roleInfo.heroId].risk;
      let best = null, bestRisk = Infinity;
      used.forEach((p) => {
        if (p.imageId === roleInfo.heroId) return;
        const c = crops.byId[p.imageId]; const r = c ? c.risk : 0;
        if (r < bestRisk) { bestRisk = r; best = p; }
      });
      if (best && bestRisk < curRisk) {
        roleInfo.roles[roleInfo.heroId] = "SectionLeadImage"; roleInfo.roles[best.imageId] = "HeroImage"; roleInfo.heroId = best.imageId;
      }
    }
  }
  const layout = piAdaptiveLayout(used);
  const matched = sections && sections.length ? piMatchSections(sections, used, roleInfo.roles) : [];
  const dnaEnv = (a && a.activityDNA && a.activityDNA.environment) || "";
  // P0-7：角色计数 + 弃用三类汇总（供 UI 文案与验收展示）
  const roleCounts = {};
  used.forEach((p) => { const r = roleInfo.roles[p.imageId] || "SupportImage"; roleCounts[r] = (roleCounts[r] || 0) + 1; });
  const rc = selection.reasons || { dup: 0, low: 0, weak: 0 };
  return {
    analysis: analysis, selection: selection, used: used,
    heroId: roleInfo.heroId, roles: roleInfo.roles, roleLabel: PI_ROLE_LABEL, roleCounts: roleCounts,
    layout: layout, cropSafety: crops, matched: matched,
    orientation: {
      landscape: used.filter((p) => p.orientation === "landscape").length,
      portrait: used.filter((p) => p.orientation === "portrait").length,
      square: used.filter((p) => p.orientation === "square").length,
    },
    dnaEnv: dnaEnv,
    simulated: analysis.some((p) => p.simulated),
    summary: `${analysis.length} 张 → 使用 ${used.length} 张（弃用 ${selection.discarded.length}：重复 ${rc.dup} / 质量较低 ${rc.low} / 内容重复·弱相关 ${rc.weak}）；角色 Hero ${roleCounts.HeroImage || 0} · 主图 ${roleCounts.SectionLeadImage || 0} · 辅助图 ${roleCounts.SupportImage || 0} · 细节图 ${roleCounts.DetailImage || 0}`,
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
