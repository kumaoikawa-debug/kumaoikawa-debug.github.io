/* =====================================================================
   ClubOS · AI 宣发中心（合并模块）
   由 ai.js + photo.js + pipeline.js + publish.js 合并而来（P3 重构 v182）
   加载顺序：本文件位于 core.js 之后、vision.js 之前，admin/C 端/落地页共用。
   ===================================================================== */


/* =================== MERGED FROM src/photo.js =================== */
/* photo.js  (Photo Layout Intelligence: pi* + buildPhotoIntelligence) */
/* ================= ClubOS · Photo Layout Intelligence（v147 / P0-6~P0-11） =================
   职责：照片分析归一化 → 自动筛图 → 角色分配 → 图片-行程匹配 → 自适应排版 → 安全裁切评估。
   数据来源：ai.js 的 photoMeta(src)（v145 已真实计算 焦点/朝向/画质/类别/情绪/文字安全区）。
   设计原则：
     ① 版式服从素材（先分析再排版），不先选模板硬塞图；
     ② 无真实视觉模型时的推断一律标记 simulated，UI 需提示「模拟分析（演示）」；
     ③ 只负责「排版与呈现」，绝不改动任何活动事实（事实边界由 ai.js/publish.js 把关）。 */

/* ---------- 基础工具（确定性哈希，保证同素材同结果） ---------- */
function photoHash(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function photoRand(seed) { const x = Math.sin(seed * 12.9898) * 43758.5453; return x - Math.floor(x); }

/* 分类 → 场景语义（photoMeta.category 来自 v145 的像素启发式） */
const PI_SCENE_BY_CAT = { "山野/植被": "scenic", "天空/开阔地": "sky", "人物/动态": "people", "环境/细节": "detail", "未分析": "detail" };
const PI_SCENE_LABEL = {
  scenic: "风景", sky: "天空", people: "人物", group: "合影", action: "动作",
  water: "水上", hike: "徒步", camp: "露营", meal: "餐食", gear: "装备",
  night: "夜景", detail: "细节", route: "路线",
  // P1：细粒度识别标签（桨板/皮划艇/帐篷/营地/车辆/森林/雪山/日出日落/水域）
  paddle: "桨板", kayak: "皮划艇", tent: "帐篷", campsite: "营地",
  vehicle: "车辆", forest: "森林", snow: "雪山", sunrise: "日出日落",
};
const PI_TAG_TO_SCENE = { "风景": "scenic", "人物": "people", "合影": "group", "动作": "action", "水上": "water", "徒步": "hike", "露营": "camp", "餐食": "meal", "装备": "gear", "夜景": "night", "细节": "detail", "路线": "route" };
/* P0-6：14 类内容识别（多标签——一张图可命中多个类，与上传顺序无关） */
const PI_TAGS = ["风景", "人物", "合影", "动作", "水上", "徒步", "露营", "餐食", "装备", "夜景", "细节", "路线", "重复图", "低质量图"];
const PI_ROLE_LABEL = { HeroImage: "封面主图", SectionLeadImage: "段落主图", SupportImage: "辅助图", GalleryImage: "图廊", DetailImage: "细节图", InfoBackground: "信息区背景", DiscardCandidate: "建议弃用" };

/* ---------- P0-9：图片↔行程/段落 语义匹配映射 ----------
   目标：图片必须按「图片内容 + 行程内容 + 活动DNA + 内容章节」自动匹配，
   杜绝「文字说徒步、配图却是餐食」的语义错配。
   匹配键统一为英文场景键（scenic/people/group/action/water/hike/camp/meal/gear/night/detail/route），
   图片 14 类中文标签经 PI_TAG_TO_SCENE 归一化后与之一致。 */
const PI_ROLE_TAGS = {           // 行程 contentRole → 期望图片语义（强匹配区）
  opening:  ["route", "scenic", "hike", "people", "group", "detail", "sky"],
  arrival:  ["scenic", "route", "hike", "people", "detail"],
  warmup:   ["people", "group", "gear", "detail", "action"],
  core:     ["hike", "water", "action", "scenic", "camp", "people", "group", "route", "gear"],
  meal:     ["meal", "people", "group", "detail"],
  rest:     ["people", "group", "scenic", "detail", "action", "night"],
  closing:  ["night", "scenic", "sky", "people", "group", "detail", "route"],
};
const PI_ROLE_FORBID = {         // 行程 contentRole → 硬禁忌图片（绝不放入该段）
  opening:  ["meal", "night"],
  arrival:  ["meal", "night"],
  warmup:   ["meal", "night"],
  core:     ["meal", "night"],                                 // 徒步/水上段绝不放餐食/夜景图
  meal:     ["hike", "route", "water", "action", "camp", "night"], // 餐食段绝不放徒步/水上/动作/夜景图
  rest:     ["meal", "hike", "route", "water", "camp"],       // 休息合影段不放餐食/徒步/水上图
  closing:  ["meal", "hike", "route", "water", "action", "camp"], // 结尾氛围段只放夜景/风景/人物
};
const PI_KIND_TAGS = {           // 内容章节 kind → 期望图片语义
  scenic:    ["scenic", "sky", "route", "hike", "night", "detail"],
  experience:["action", "water", "people", "group", "hike", "camp", "scenic", "detail"],
  people:    ["people", "group", "detail", "action"],
  route:     ["route", "hike", "scenic", "detail", "action"],
  gear:      ["gear", "detail", "people"],
  info:      ["detail", "gear"],
  meal:      ["meal", "people", "detail"],
  night:     ["night", "scenic", "sky", "people"],
  ending:    ["night", "scenic", "sky", "people", "group"],
  detail:    ["detail", "gear"],
  fit:       ["people", "group", "detail"],
  reasons:   ["detail", "gear", "scenic", "people"],
};
const PI_KIND_FORBID = {         // 内容章节 kind → 硬禁忌图片
  scenic:    ["meal"],
  experience:["meal", "night"],
  people:    ["meal", "hike", "route", "water", "night"],
  route:     ["meal", "night"],
  gear:      ["meal", "night", "water", "people", "group"],
  info:      ["meal", "night", "water", "people", "group", "action"],
  meal:      ["hike", "route", "water", "action", "camp", "night"],
  night:     ["meal", "hike", "route", "water", "action", "camp"],
  ending:    ["meal", "hike", "route", "water", "action", "camp"],
  detail:    ["meal", "night", "water"],
  fit:       ["meal", "hike", "route", "water", "night"],
  reasons:   ["meal", "night", "water", "people", "group"],
};
/* 活动DNA 核心动机 → 匹配加分（让 DNA 真正驱动差异化匹配，而非统一套方向） */
const PI_DNA_BONUS = {
  release:    { water: 8, action: 4 },        // 清凉释放型：水上图更该进体验段
  social:     { people: 6, group: 6 },        // 社交型：人物/合影更该进陪伴段
  family:     { people: 5, group: 5, meal: 3 },
  challenge:  { hike: 6, action: 5, route: 4 },// 挑战型：徒步/路线更该进核心段
  sport:      { action: 6, hike: 4 },
  photo:      { scenic: 6, night: 5, detail: 4 },
  healing:    { scenic: 5, night: 4 },
  scenery:    { scenic: 5, route: 3 },
};
/* 文本关键词 → 图片语义（从行程 fact / 章节 heading 显式提取语义） */
const PI_TEXT_TAG_KW = [
  ["water", /桨板|皮划艇|皮艇|溯溪|漂流|下水|玩水|游泳|清凉|溪降|冲浪|独木舟|桨|湖面/],
  ["meal", /午餐|中餐|用餐|吃饭|野餐|补给|下午茶|早餐|晚餐|餐|美食|野炊|干饭|围炉/],
  ["group", /合影|团建|集体照|合影留念|全家福|大合照|一起|队伍/],
  ["people", /人|队友|领队|陪伴|故事|孩子|亲子|朋友|大家/],
  ["night", /夜|星空|篝火|日落|晚霞|夜晚|夜景|星河|黄昏/],
  ["hike", /徒步|登山|爬山|穿越|登顶|步道|山路|登山道|爬升/],
  ["route", /路线|轨迹|里程|海拔|环线|垭口|垭口/],
  ["camp", /露营|营地|帐篷|扎营|篝火/],
  ["gear", /装备|物资|背包|护具|安全带|穿/],
  ["action", /挑战|运动|爬|涉水|刺激|体验|滑行|划|攀登|跃/],
  ["scenic", /风景|风光|景|自然|山|湖|林|雪山|云海|峡谷/],
];
function photoTextTags(text) {
  const s = String(text || ""); const out = [];
  for (const m of PI_TEXT_TAG_KW) if (m[1].test(s)) out.push(m[0]);
  return out;
}
/* 图片语义键集合（14 类中文标签 → 英文键，并入主场景 scene） */
function photoImageKeySet(p) {
  const tags = (p && p.tags) || [];
  const keys = tags.map((t) => PI_TAG_TO_SCENE[t]).filter(Boolean);
  if (p && p.scene && keys.indexOf(p.scene) < 0) keys.push(p.scene);
  return keys;
}
/* 片段（行程项 / 章节）期望语义 = 角色/类型默认表 ∪ 文本关键词提取；硬禁忌另列 */
function segTarget(roleOrKind, text, forbidMap, tagMap) {
  const base = (tagMap[roleOrKind] || ["scenic", "people", "detail"]).slice();
  const txt = photoTextTags(text);
  const accept = base.slice();
  txt.forEach((t) => { if (accept.indexOf(t) < 0) accept.push(t); });
  const forbid = (forbidMap[roleOrKind] || []).slice();
  return { accept: accept, forbid: forbid, textTags: txt };
}
/* 单图对单片段的语义契合分：契合为正、禁忌为 -∞（绝不放入）、其余中性偏画质。
   textTags：该片段自身文本显式提到的语义（如行程 fact「合影拍照」→ group、章节标题「装备建议」→ gear），
   命中则额外加成——让「文字说合影」的段真正绑定合影图，而非被泛用段抢走。 */
function segScore(p, accept, forbid, dnaBonus, textTags) {
  const keys = photoImageKeySet(p);
  for (const k of keys) if (forbid.indexOf(k) >= 0) return -Infinity; // 硬禁忌
  let s = 0;
  for (const k of keys) if (accept.indexOf(k) >= 0) s += 10;
  if (textTags && textTags.length) { const tt = {}; textTags.forEach((t) => { tt[t] = 1; }); for (const k of keys) if (tt[k]) s += 6; }
  if (dnaBonus) for (const k of keys) if (dnaBonus[k]) s += dnaBonus[k];
  s += (p.quality || 0) * 4;
  if (p.orientation === "landscape") s += 2;
  return s;
}

/* ---------- P0-6：感知哈希（64 位，分 lo/hi 两段，避免 BigInt 依赖） ---------- */
function phashHamming(a, b) {
  if (!a || !b) return 999;
  const pop = (n) => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };
  return pop((a.lo ^ b.lo) >>> 0) + pop((a.hi ^ b.hi) >>> 0);
}
function proxyPhash(src) {
  // 无真实分析时的确定性代理（仅按 src 内容派生，不引用上传下标）
  const h = photoHash(src || "x");
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
   与旧版 photoRand(index) 的根本区别：同一张图无论排第几都得到相同识别，
   不同内容（不同 src）得到不同识别——绝不按上传顺序轮流套分类。 */
function fallbackMeta(src) {
  const h = photoHash(src || "x");
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
function tagPhoto(sig) {
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
function primaryScene(tags) {
  const pri = ["合影", "人物", "动作", "水上", "徒步", "露营", "餐食", "装备", "夜景", "路线", "风景", "细节"];
  for (const t of pri) if (tags.indexOf(t) >= 0) return PI_TAG_TO_SCENE[t];
  return "detail";
}
function photoSubject(tags) {
  if (tags.indexOf("合影") >= 0 || tags.indexOf("人物") >= 0) return "人物";
  if (tags.indexOf("水上") >= 0) return "水景";
  if (tags.indexOf("餐食") >= 0) return "餐食";
  if (tags.indexOf("装备") >= 0) return "装备";
  if (tags.indexOf("夜景") >= 0) return "夜景";
  if (tags.indexOf("风景") >= 0) return "环境";
  return "细节";
}

/* 亮点文案 ↔ 图片标签语义匹配（用于亮点卡片配图，避免按上传顺序轮流） */
function sellMatch(kw, p) {
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
function analyzeOnePhoto(src, i, phashSeen) {
  const m = (typeof photoMeta === "function") ? photoMeta(src) : null;
  const sig = m ? metaToSignals(m) : fallbackMeta(src); // 信号只来自内容，不引用 i
  const tags = tagPhoto(sig).slice();
  const isLow = (sig.quality != null ? sig.quality : 0.6) < 0.5;
  // 批量重复图检测：真实 pHash 优先，否则用 src 代理哈希做近邻比较（汉明距离 ≤ 4 判重）
  const ph = (sig.pHash != null) ? sig.pHash : proxyPhash(src);
  let dupOf = null;
  if (phashSeen) {
    for (const seen of phashSeen) { if (phashHamming(ph, seen.ph) <= 4) { dupOf = seen.id; break; } }
    phashSeen.push({ id: "ph_" + i, ph: ph });
  }
  if (dupOf) tags.push("重复图");
  if (isLow) tags.push("低质量图");
  // 重复图退为 detail，避免抢占封面/Hero
  const scene = dupOf ? "detail" : primaryScene(tags);
  const people = sig.peopleCount || 0;
  const action = sig.actionLabel || (sig.actionFlag ? "动态" : "");
  const subject = photoSubject(tags);
  const emotion = sig.emotion || "真实";
  const safeTextArea = sig.safe_text_area || "top-right";
  const recommendedUse = sig.recommended_use || ["story"];
  const cropRisk = sig.cropRisk || null;
  // P0-6：完整 11 字段 schema + tags + 重复/低质量标记
  // Case 1：额外暴露「色调/曝光/肤色」信号（warm/blue/skin/lum），供照片驱动的暖感判定使用；
  //   这些字段来自内容识别（metaToSignals / fallbackMeta），依旧不引用上传下标 i。
  return {
    imageId: "ph_" + i, src: src, index: i,
    orientation: sig.orientation, quality: sig.quality,
    scene: scene, sceneLabel: PI_SCENE_LABEL[scene] || scene,
    subject: subject, people: people, action: action, emotion: emotion,
    warm: (sig.warmRatio != null) ? sig.warmRatio : 0,
    blue: (sig.blueRatio != null) ? sig.blueRatio : 0,
    skin: (sig.skinRatio != null) ? sig.skinRatio : 0,
    lum: (sig.avgLum != null) ? sig.avgLum : 128,
    tags: tags, category: sig.category || "内容识别",
    safeTextArea: safeTextArea, recommendedUse: recommendedUse,
    focal: sig.focal_point || { x: 0.5, y: 0.45 },
    cropRisk: cropRisk,
    simulated: !(m && m.simulated === false),
    dupOf: dupOf, lowQuality: isLow,
  };
}
function analyzePhotos(photos) {
  const list = (photos || []).filter(Boolean);
  const uniq = list.filter((s, i) => list.indexOf(s) === i); // 同源去重
  const phashSeen = [];
  return uniq.map((s, i) => analyzeOnePhoto(s, i, phashSeen));
}

/* ---------- P0-7：自动筛图（去重 / 质量 / 数量策略） ---------- */
const PI_COUNT_STRATEGY = [
  { max: 3, cap: (n) => n, label: "少图（1-3）：全部使用，克制留白" },
  { max: 8, cap: (n) => Math.min(n, 8), label: "中量（4-8）：Hero + 双图/三图组合" },
  { max: 20, cap: (n) => Math.min(n, 12), label: "多图（9-20）：图文章节化，筛到约 12 张" },
  { max: Infinity, cap: () => 14, label: "大量（20+）：自动筛图，最多 14 张" },
];
function photoStrategy(n) { return PI_COUNT_STRATEGY.find((s) => n <= s.max); }
function selectPhotos(analysis) {
  const n = analysis.length;
  const strat = photoStrategy(n);
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

/* ---------- P0-8：图片角色系统（7 类角色 + 重要度阶梯） ----------
   每张图必须先确定角色，再进入排版；角色决定其在页面中的视觉权重，
   绝不允许所有图片拥有同等重要性。
   重要度阶梯（importance）：Hero 100 > SectionLead 80 > Support 55 > Gallery 40 > Detail 30 > InfoBackground 20 > Discard 0
   分配规则：内容信号（画质/场景/朝向）+ 预算驱动，与上传顺序无关。 */
const PI_ROLES = {
  HeroImage:       { importance: 100, label: "封面主图",   desc: "全幅开篇大图，最高视觉权重",   render: "full-bleed",   cls: "ph-hero" },
  SectionLeadImage:{ importance: 80,  label: "段落主图",   desc: "每个内容章节开篇大图",          render: "section-lead", cls: "ph-lead" },
  SupportImage:    { importance: 55,  label: "辅助图",     desc: "正文穿插的中等配图",             render: "inline-medium",cls: "ph-support" },
  GalleryImage:    { importance: 40,  label: "图廊",       desc: "成组小图，低密度陈列",           render: "gallery-grid", cls: "ph-gallery" },
  DetailImage:     { importance: 30,  label: "细节图",     desc: "特写/纹理，近景补充",            render: "detail-small", cls: "ph-detail" },
  InfoBackground:  { importance: 20,  label: "信息区背景", desc: "弱化作底色/信息区衬托，低存在感", render: "faint-bg",     cls: "ph-info" },
  DiscardCandidate:{ importance: 0,   label: "建议弃用",   desc: "筛图阶段弃用，不进入版面",       render: "none",         cls: "ph-discard" },
};
const PI_ROLE_ORDER = ["HeroImage", "SectionLeadImage", "SupportImage", "GalleryImage", "DetailImage", "InfoBackground", "DiscardCandidate"];

/* 按「使用张数」分配 7 角色预算。
   锚点：hero 恒 1（有图时）；lead≈35%、detail≈14%；
   gallery≈18%（成组小图）、info≈7%（信息区背景）；其余归 辅助图(Support)。
   n=14 时：Hero1 + 主图5 + (辅助图2 / 图廊3 / 信息背景1 = 6) + 细节图2 = 14，
   与 P0-7 验收「使用14张=Hero1/主图5/辅助图6/细节图2」兼容（辅助图含图廊与信息背景）。 */
function roleBudget(n) {
  if (n <= 0) return { hero: 0, lead: 0, support: 0, gallery: 0, detail: 0, info: 0 };
  if (n === 1) return { hero: 1, lead: 0, support: 0, gallery: 0, detail: 0, info: 0 };
  const hero = 1;
  const lead = Math.max(1, Math.min(Math.round(n * 0.35), n - 2));
  const detail = Math.max(0, Math.min(Math.round(n * 0.14), n - hero - lead - 3));
  const gallery = Math.max(0, Math.min(Math.round(n * 0.18), n - hero - lead - detail - 2));
  const info = Math.max(0, Math.min(Math.round(n * 0.07), n - hero - lead - detail - gallery - 1));
  const support = Math.max(0, n - hero - lead - detail - gallery - info);
  return { hero: hero, lead: lead, support: support, gallery: gallery, detail: detail, info: info };
}

/* 给「全部已分析图片」分配角色：
   使用池 → 6 类（Hero/SectionLead/Support/Gallery/Detail/InfoBackground）；
   弃用池 → DiscardCandidate（让「每张图都有明确角色、且重要性为 0」可见）。
   内容驱动：先按画质/场景/朝向排序，再依次领角色预算；重复图/低质量图已在 selectPhotos 阶段被剔除出使用池。 */
function assignAllRoles(analysis, selection) {
  const roles = {};
  const used = selection.used || [];
  const STRONG = ["scenic", "people", "group", "action", "water", "hike", "camp", "meal", "gear", "night", "route"];
  const rankOf = (p) => (p.quality || 0) * 100 + (p.orientation === "landscape" ? 6 : 0) + (STRONG.indexOf(p.scene) >= 0 ? 5 : 0) + (p.lowQuality ? -30 : 0) + (p.dupOf ? -40 : 0);
  const ranked = used.slice().sort((a, b) => rankOf(b) - rankOf(a));
  // Hero：最优选横幅风景（避免竖图强裁主体）
  const hero = ranked.find((p) => p.orientation !== "portrait" && p.scene === "scenic")
    || ranked.find((p) => p.orientation !== "portrait")
    || ranked[0];
  if (hero) roles[hero.imageId] = "HeroImage";
  const rest = ranked.filter((p) => !hero || p.imageId !== hero.imageId);
  // 段落主图：次优候选（内容强的优先）
  const b = roleBudget(used.length);
  let leadN = 0;
  for (const p of rest) {
    if (leadN >= b.lead) break;
    if (p.dupOf || p.lowQuality) continue;
    roles[p.imageId] = "SectionLeadImage"; leadN++;
  }
  const remain1 = rest.filter((p) => !roles[p.imageId]);
  // 细节图：细节场景优先
  const detailCands = remain1.slice().sort((a, c) => {
    const d = (p) => (p.scene === "detail" ? 100 : 0) + (1 - (p.quality || 0)) * 50;
    return d(c) - d(a);
  });
  let detailN = 0;
  for (const p of detailCands) {
    if (detailN >= b.detail) break;
    roles[p.imageId] = "DetailImage"; detailN++;
  }
  const remain2 = remain1.filter((p) => !roles[p.imageId]);
  // 图廊：成组小图 —— 取一批次重要的（画质中等、非强场景）作低密度陈列
  const galleryCands = remain2.slice().sort((a, c) => rankOf(a) - rankOf(c));
  let galleryN = 0;
  for (const p of galleryCands) {
    if (galleryN >= b.gallery) break;
    roles[p.imageId] = "GalleryImage"; galleryN++;
  }
  const remain3 = remain2.filter((p) => !roles[p.imageId]);
  // 信息区背景：最低存在感（再取最弱的一批，弱化作底色/衬托）
  const infoCands = remain3.slice().sort((a, c) => rankOf(a) - rankOf(c));
  let infoN = 0;
  for (const p of infoCands) {
    if (infoN >= b.info) break;
    roles[p.imageId] = "InfoBackground"; infoN++;
  }
  // 辅助图：其余全部
  remain3.filter((p) => !roles[p.imageId]).forEach((p) => { roles[p.imageId] = "SupportImage"; });
  // 弃用池：明确标记 DiscardCandidate（无角色→不可见，重要度 0）
  (selection.discarded || []).forEach((d) => { roles[d.imageId] = "DiscardCandidate"; });
  return { heroId: hero ? hero.imageId : null, roles: roles };
}
function importanceOf(roles, imageId) {
  const r = roles[imageId] || "SupportImage";
  return (PI_ROLES[r] && PI_ROLES[r].importance) || 0;
}

/* ---------- P0-9：图片-行程/段落匹配 ---------- */
/* section.kind 提示 → 偏好场景；无 kind 时按关键词兜底 */
const PI_KIND_SCENES = {
  opening: ["scenic", "sky", "route", "hike"], scenic: ["scenic", "sky", "route", "hike"], landscape: ["scenic", "sky"],
  experience: ["action", "people", "group", "water", "camp", "hike"], people: ["people", "group", "action"], action: ["action", "people", "group"],
  water: ["water", "action"], camp: ["camp", "sky", "people", "group"], meal: ["meal", "detail"], gear: ["gear", "detail"],
  detail: ["detail", "gear"], ending: ["sky", "scenic", "people", "group", "night"], fit: ["people", "group", "detail"], info: ["detail", "gear"], night: ["night", "scenic"],
};
function kindFromText(txt) {
  const h = String(txt || "");
  if (/为什么|值得|风景|景|地点|路线|地貌|山|湖|林/.test(h)) return "scenic";
  if (/体验|玩|挑战|探索|运动|做|水上|walk/.test(h)) return "experience";
  if (/收获|适合|谁|陪伴|人/.test(h)) return "people";
  if (/装备|准备/.test(h)) return "gear";
  if (/费用|信息|报名|详情|须知/.test(h)) return "info";
  if (/预告|下一期|结尾|收束/.test(h)) return "ending";
  return "";
}
/* P0-9：图片↔「内容章节」语义匹配（按 kind + 章节标题文本 + 活动DNA，逐段匹配） */
function matchPhotosToSections(sections, used, roles, dna) {
  const avail = (used || []).slice();
  const dnaBonus = (dna && dna.coreMotivation && PI_DNA_BONUS[dna.coreMotivation]) ? PI_DNA_BONUS[dna.coreMotivation] : null;
  const taken = {};
  const heroPic = avail.find((p) => roles[p.imageId] === "HeroImage");
  const take = (kind, text, count) => {
    const { accept, forbid, textTags } = segTarget(kind, text, PI_KIND_FORBID, PI_KIND_TAGS);
    const cand = avail.filter((p) => !taken[p.imageId] && roles[p.imageId] !== "HeroImage")
      .map((p) => ({ p: p, s: segScore(p, accept, forbid, dnaBonus, textTags) }))
      .filter((x) => x.s > -Infinity)
      .sort((a, b) => b.s - a.s);
    const picks = cand.slice(0, count).map((x) => x.p);
    picks.forEach((p) => { taken[p.imageId] = true; });
    return picks;
  };
  return (sections || []).map((sec, idx) => {
    const kind = sec.kind || kindFromText(typeof sec === "string" ? sec : (sec.h || ""));
    const text = typeof sec === "string" ? sec : ((sec.h || sec.heading || "") + " " + ((sec.paras || []).join(" ") || ""));
    // 封面段（第一段）优先用 Hero；没有则用最契合开篇语义的图
    if (idx === 0 && heroPic) return { sectionIndex: idx, kind: kind, photos: [heroPic] };
    const want = (kind === "scenic" || kind === "experience") ? 2 : 1;
    return { sectionIndex: idx, kind: kind, photos: take(kind, text, want) };
  });
}

/* ---------- P0-9：图片↔「行程段落」语义匹配（按 contentRole + 文本 + DNA，逐图归属最优段） ---------- */
/* 输入 structureItinerary() 的 timeline（含 contentRole/day/fact），输出逐段匹配的图。
   匹配严格语义化：每段期望语义 = 该 contentRole 默认表 ∪ fact 文本关键词（如「桨板」→ water、「午餐」→ meal、「夜」→ night）；
   硬禁忌图片（如餐食图绝不放徒步段）一律排除。
   关键：采用「逐图归属最优段」而非「逐段贪心」——避免开头的泛用段（集合/到达）把本应进
   具体段（水上/陪伴/结尾）的图提前抢走；每张图落到「契合分最高」的段，平分时偏向语义更具体的段
   （core/meal/rest/closing > opening/arrival/warmup），从而 桨板→水上段、餐食→午餐段、合影→陪伴段、夜景→结尾段。 */
const PI_ROLE_SPEC = { opening: 0, arrival: 0, warmup: 1, rest: 2, core: 3, meal: 3, closing: 3 };
function matchItineraryPhotos(timeline, used, roles, dna) {
  const items = (timeline || []).filter((t) => t && (t.time || t.fact || t.text));
  if (!items.length) return { byItem: [], byDay: {}, byRole: {}, note: "无行程可匹配" };
  const dnaBonus = (dna && dna.coreMotivation && PI_DNA_BONUS[dna.coreMotivation]) ? PI_DNA_BONUS[dna.coreMotivation] : null;
  const heroId = (roles && (function () { for (const k in roles) if (roles[k] === "HeroImage") return k; return null; })()) || null;
  const avail = (used || []).filter((p) => p.imageId !== heroId); // Hero 留给封面，不占行程段
  // 预计算每个段的期望语义与容量
  const segInfo = items.map((t) => {
    const role = t.contentRole || "core";
    const text = (t.time || "") + " " + (t.fact || t.text || "");
    const { accept, forbid, textTags } = segTarget(role, text, PI_ROLE_FORBID, PI_ROLE_TAGS);
    return { role: role, accept: accept, forbid: forbid, textTags: textTags, want: (role === "meal" || role === "rest" || role === "warmup") ? 1 : 2 };
  });
  // 每张图 → 其最优段（契合分最高；平分时偏向语义更具体的段）
  const imgBest = {};
  avail.forEach((p) => {
    let best = -1, bestScore = -Infinity, bestSpec = -1;
    segInfo.forEach((s, idx) => {
      const sc = segScore(p, s.accept, s.forbid, dnaBonus, s.textTags);
      if (sc > -Infinity) {
        const spec = PI_ROLE_SPEC[s.role] || 0;
        if (sc > bestScore || (sc === bestScore && spec > bestSpec)) { bestScore = sc; best = idx; bestSpec = spec; }
      }
    });
    imgBest[p.imageId] = best >= 0 ? { segIdx: best, score: bestScore } : null;
  });
  // 强契合（高分）的图优先落位；段满则退到次优契合段
  const takenCount = {}; segInfo.forEach((_, i) => { takenCount[i] = 0; });
  const assign = {};
  const ordered = avail.slice().sort((a, b) => (imgBest[b.imageId] ? imgBest[b.imageId].score : -1e9) - (imgBest[a.imageId] ? imgBest[a.imageId].score : -1e9));
  ordered.forEach((p) => {
    const best = imgBest[p.imageId];
    if (!best) return; // 该图在所有段都被硬禁忌（如餐食图放进纯徒步行程）——宁缺毋滥，不强行错配
    const cands = segInfo.map((s, idx) => ({ idx: idx, sc: segScore(p, s.accept, s.forbid, dnaBonus, s.textTags) }))
      .filter((x) => x.sc > -Infinity)
      .sort((a, b) => (b.sc - a.sc) || ((PI_ROLE_SPEC[segInfo[b.idx].role] || 0) - (PI_ROLE_SPEC[segInfo[a.idx].role] || 0)));
    for (const c of cands) {
      if (takenCount[c.idx] < segInfo[c.idx].want) { assign[p.imageId] = c.idx; takenCount[c.idx]++; break; }
    }
  });
  const byDay = {};
  const byRole = {};
  const byItem = items.map((t, idx) => {
    const picks = avail.filter((p) => assign[p.imageId] === idx);
    picks.forEach((p) => { const day = t.day || 1; (byDay[day] = byDay[day] || []).push(p); (byRole[t.contentRole || "core"] = byRole[t.contentRole || "core"] || []).push(p); });
    return { day: t.day || 1, time: t.time || "", fact: t.fact || t.text || "", contentRole: t.contentRole || "core", photos: picks, textTags: segInfo[idx].textTags, matched: picks.map((p) => p.src) };
  });
  return { byItem: byItem, byDay: byDay, byRole: byRole, note: "按行程内容语义匹配（图-文强相关）" };
}

/* ---------- P0-10：Photo Layout Intelligence（按数量 + 横竖比例自动选版式） ---------- */
// 6 种版式组件（与验收一一对应）：
//   FullWidth      通栏大图（单张横图，留白）
//   PortraitPair   竖图对（两张竖图并排，原比例）
//   ImagePair      双图（两张横图/混合并排）
//   Mosaic         拼贴网格（3-4 张混合）
//   GalleryStrip   画廊横条（≥4 张统一缩略图横滑浏览）
//   AspectPreserved 原比例展示（单/双张，不强裁，留白）
const PI_LAYOUT_PATTERNS = ["FullWidth", "PortraitPair", "ImagePair", "Mosaic", "GalleryStrip", "AspectPreserved"];
function layoutIs(p, o) { return (p.orientation || "landscape") === o; }
function layoutPull(pool, pred, k) {
  const out = [];
  for (let i = pool.length - 1; i >= 0; i--) {
    if (pred(pool[i])) { out.push(pool[i]); pool.splice(i, 1); if (out.length >= k) break; }
  }
  return out;
}
// used：筛选后待展示图（analysis 对象，含 orientation/src/imageId）；total：原始上传张数（决定数量分级）
function buildAdaptiveLayout(used, total) {
  const m = (used || []).slice();
  const n = total != null ? total : m.length;          // 数量分级按「原始上传张数」
  const land0 = m.filter((p) => layoutIs(p, "landscape")).length;
  const port0 = m.filter((p) => layoutIs(p, "portrait")).length;
  const sq0 = m.filter((p) => layoutIs(p, "square")).length;
  const tot = m.length || 1;
  const dominant = (land0 / tot) >= 0.6 ? "landscape" : ((port0 / tot) >= 0.6 ? "portrait" : "mixed");
  let tier, mode;
  if (n <= 0) return { tier: "empty", mode: "empty", total: n, usedCount: m.length, orientation: { landscape: land0, portrait: port0, square: sq0, dominant: dominant }, components: [], patterns: [], hint: "0 图：纯文字克制版式" };
  if (n <= 3) { tier = "few"; mode = "solo"; }
  else if (n <= 8) { tier = "mid"; mode = "hero_grid"; }
  else if (n <= 20) { tier = "many"; mode = "chapters"; }
  else { tier = "huge"; mode = "curated"; }

  const comps = [];
  const add = (pattern, photos) => { if (photos && photos.length) comps.push({ pattern: pattern, photos: photos }); };
  const isLand = (p) => layoutIs(p, "landscape");
  const isPort = (p) => layoutIs(p, "portrait");
  const isAny = () => true;
  const pairPattern = () => (dominant === "portrait" ? "PortraitPair" : "ImagePair");

  // 主图 / Hero：优先「横图且对 FullWidth 安全（风景/无受保护主体）」；否则退而求其次取任意横图；
  // 若整组都不安全（如全是人物/竖图），仍取一张作封面，但渲染层会按 safePatterns 走原比例展示(contain)，宁留白不裁主体
  const safeFull = (p) => (p.orientation === "landscape") && safePatternsOf(p, evaluateCropSafety(p)).indexOf("FullWidth") >= 0;
  const hero = layoutPull(m, safeFull, 1);
  if (!hero.length) hero.push.apply(hero, layoutPull(m, isLand, 1));
  if (!hero.length) hero.push.apply(hero, layoutPull(m, isAny, 1));
  add("FullWidth", hero);

  if (tier === "few") {
    // 1-3 张：大图 + 留白；剩余按横竖走双图或原比例
    if (m.length >= 2) {
      const wantPort = dominant === "portrait" || port0 >= 2;
      const pair = wantPort ? layoutPull(m, isPort, 2) : layoutPull(m, isAny, 2);
      if (pair.length === 2) add(wantPort ? "PortraitPair" : "ImagePair", pair);
      else if (pair.length === 1) m.push(pair[0]);   // 不足一对则放回，走原比例
    }
    if (m.length === 1) add("AspectPreserved", layoutPull(m, isAny, 1));
    while (m.length >= 2) {                            // 零散余图按横竖补一对
      const pair = layoutPull(m, isPort, 2);
      if (pair.length === 2) add("PortraitPair", pair);
      else { if (pair.length) m.push(pair[0]); const pr = layoutPull(m, isAny, 2); if (pr.length < 2) { if (pr.length) m.push(pr[0]); break; } add(pairPattern(), pr); }
    }
    if (m.length === 1) add("AspectPreserved", layoutPull(m, isAny, 1));
  } else if (tier === "mid") {
    // 4-8 张：Hero + 双图/三图穿插；横图走 ImagePair、竖图走 PortraitPair、混合走 Mosaic
    while (m.length >= 2 && land0 >= 2) { const lp = layoutPull(m, isLand, 2); if (lp.length < 2) { if (lp.length) m.push(lp[0]); break; } add("ImagePair", lp); }
    while (m.length >= 2 && port0 >= 2) { const pp = layoutPull(m, isPort, 2); if (pp.length < 2) { if (pp.length) m.push(pp[0]); break; } add("PortraitPair", pp); }
    if (m.length >= 3) add("Mosaic", layoutPull(m, isAny, Math.min(4, m.length)));
    while (m.length >= 2) { const pr = layoutPull(m, isAny, 2); if (pr.length < 2) { if (pr.length) m.push(pr[0]); break; } add(pairPattern(), pr); }
    if (m.length === 1) add("AspectPreserved", layoutPull(m, isAny, 1));
  } else if (tier === "many") {
    // 9-20 张：分章节图文——大图 + 精选双图/拼贴 + 余图画廊横条
    // 预留 ≥4 张给章节画廊横条，避免被精选双图耗尽（用「实时剩余」而非固定总数做循环守卫）
    const reserve = 4;
    const room = () => m.length - reserve;
    while (room() >= 2 && m.filter(isLand).length >= 2) { const lp = layoutPull(m, isLand, 2); if (lp.length < 2) { if (lp.length) m.push(lp[0]); break; } add("ImagePair", lp); }
    while (room() >= 2 && m.filter(isPort).length >= 2) { const pp = layoutPull(m, isPort, 2); if (pp.length < 2) { if (pp.length) m.push(pp[0]); break; } add("PortraitPair", pp); }
    if (room() >= 3) add("Mosaic", layoutPull(m, isAny, Math.min(4, room())));   // 精选拼贴作章节点缀
    if (m.length >= 4) add("GalleryStrip", layoutPull(m, isAny, m.length));        // 余图统一横条浏览
    else if (m.length === 3) add("Mosaic", layoutPull(m, isAny, 3));
    else if (m.length === 2) { const pr = layoutPull(m, isAny, 2); if (pr.length === 2) add(pairPattern(), pr); else if (pr.length) m.push(pr[0]); }
    if (m.length === 1) add("AspectPreserved", layoutPull(m, isAny, 1));
  } else {
    // 20+ 张：先筛图再排版——画廊横条为主，拼贴点缀，少强裁
    if (m.length >= 4) add("GalleryStrip", layoutPull(m, isAny, m.length));
    else if (m.length >= 3) add("Mosaic", layoutPull(m, isAny, m.length));
    else if (m.length >= 2) { const pr = layoutPull(m, isAny, 2); if (pr.length === 2) add(pairPattern(), pr); else if (pr.length) m.push(pr[0]); }
    if (m.length === 1) add("AspectPreserved", layoutPull(m, isAny, 1));
  }

  const patterns = [];
  comps.forEach((c) => { if (patterns.indexOf(c.pattern) < 0) patterns.push(c.pattern); });
  const hintMap = { few: "1-3 张：大图 + 留白", mid: "4-8 张：Hero + 双图/三图", many: "9-20 张：分章节图文", huge: "20+ 张：先筛图再排版（画廊横条为主）", empty: "0 图" };
  return {
    tier: tier, mode: mode, total: n, usedCount: (used || []).length,
    orientation: { landscape: land0, portrait: port0, square: sq0, dominant: dominant },
    components: comps, patterns: patterns,
    hint: hintMap[tier] + `（横 ${land0} / 竖 ${port0} / 方 ${sq0}，主 ${dominant}）`,
  };
}
// 渲染：把排版计划输出为 6 种版式的 HTML（尊重角色重要度 + 安全裁切，复用 pagePhotoRole/pagePhotoRisk）
function layoutHtml(plan) {
  if (!plan || !plan.components || !plan.components.length) return "";
  const roleClsOf = (src) => {
    if (typeof pagePhotoRole === "function") { const r = pagePhotoRole(src); if (r && PI_ROLES && PI_ROLES[r]) return PI_ROLES[r].cls; }
    return "";
  };
  const card = (p, pat) => {
    const src = p.src || p;
    // P0-11：按 safePatterns 决定该图在本版式中是否可 cover；不安全 → 原比例展示(contain)，宁留白不裁主体
    const crop = (typeof evaluateCropSafety === "function") ? evaluateCropSafety(p) : null;
    const safe = (crop && crop.safePatterns) || PI_LAYOUT_PATTERNS;
    const contain = safe.indexOf(pat) < 0;
    // 安全 cover 时按焦点(focal)设 object-position，让受保护主体保持在画面内
    const fx = p.focal ? p.focal.x : 0.5, fy = p.focal ? p.focal.y : 0.45;
    const pos = contain ? "50% 50%" : (Math.round(fx * 100) + "% " + Math.round(fy * 100) + "%");
    const rc = roleClsOf(src);
    const port = (p.orientation === "portrait") ? " portrait" : "";
    const fit = contain ? "contain" : "cover";
    return `<div class="ph ${rc}${contain ? " ph-safe" : ""}${port}"><img class="ph-img" data-smart-img src="${esc(src)}" alt="" style="object-position:${pos};object-fit:${fit}"></div>`;
  };
  const blocks = plan.components.map((c) => `<div class="ly ly-${c.pattern}">${c.photos.map((p) => card(p, c.pattern)).join("")}</div>`).join("");
  return `<div class="photo-layout" data-tier="${plan.tier}" data-mode="${plan.mode}" data-patterns="${plan.patterns.join(",")}">${blocks}</div>`;
}

/* ---------- P0-11：安全裁切评估（优先保护受保护主体，宁改版式不强裁） ----------
   受保护主体 6 类：人脸 / 人体 / 主体 / 合影人物 / 动作主体 / 关键景物
   硬规则：若目标比例会破坏主体 → 改版式（原比例展示），绝不强制裁切。
   绝不出现：半张脸 / 半个人 / 腰膝盖尴尬截断 / 合影边缘人物消失大半 / 主体被裁掉。 */
function protectedSubjects(p) {
  const s = [];
  const people = p.people || 0;
  const tags = p.tags || [];
  const hasAction = !!(p.action) || tags.indexOf("动作") >= 0;
  const isScenery = people === 0 && (tags.indexOf("风景") >= 0 || (p.subject && p.subject === "环境"));
  if (people >= 1) { s.push("人脸"); s.push("人体"); s.push("主体"); }
  if (people >= 2) s.push("合影人物");
  if (hasAction) s.push("动作主体");
  if (isScenery) s.push("关键景物");
  return s;
}
/* 返回该图「可安全 cover 裁切进入」的版式集合；不在此集合的版式 → 渲染层改走原比例(contain)，绝不强裁主体。
   容器真实形状见 styles.css：FullWidth 16/9、PortraitPair 3/4、ImagePair 4/3、Mosaic 1/1、GalleryStrip 132x99、AspectPreserved 原比例。 */
function safePatternsOf(p, crop) {
  const people = p.people || 0;
  const portrait = p.orientation === "portrait";
  const high = crop && crop.level === "high";
  // 高风险（模型或本地）：只保留原比例展示；若被迫进入其它版式，渲染层一律 contain
  if (high) return ["AspectPreserved"];
  if (people >= 1) {
    // 含人物（人脸/人体/主体/合影/动作）：横幅通栏必切头脚、拼贴/横条必切边缘人物 → 均不可
    if (portrait) return ["PortraitPair", "AspectPreserved"];                       // 竖图含人：仅竖对(3/4)与原比例安全
    if (p.orientation === "square") return ["ImagePair", "Mosaic", "AspectPreserved"]; // 方图含人：轻裁版式安全
    return ["ImagePair", "AspectPreserved"];                                        // 横图含人：仅 4/3 轻裁安全
  }
  if (portrait) return ["PortraitPair", "AspectPreserved"]; // 竖图无人（关键景物）：不进横幅通栏
  return PI_LAYOUT_PATTERNS.slice();                        // 横/方风景无人：无主体可毁，全部安全
}
function evaluateCropSafety(p) {
  // P2-3：若真实视觉模型已判定裁切风险，直接采用（优先级高于本地启发式）
  if (p.cropRisk && ["low", "medium", "high"].indexOf(p.cropRisk) >= 0) {
    const map = { high: 70, medium: 38, low: 8 };
    const level = p.cropRisk;
    return {
      imageId: p.imageId, risk: map[level], level: level, reasons: ["视觉模型判定"],
      subjects: protectedSubjects(p), safePatterns: safePatternsOf(p, { level: level, fromModel: true }),
      prefer: level === "high" ? "aspect_preserved" : (level === "medium" ? "wide_safe_focus" : "any"),
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
    // 竖图含人 → 横幅/双图(4/3)/拼贴/横条等「横向裁切」会切头脚或边缘人物，判中风险；
    // 但竖图对(PortraitPair 3/4，与竖图同比例)与原比例展示安全，故不强制 high —— 渲染层仅在不安全版式走 contain。
    if (p.people > 1) { risk += 10; reasons.push("竖图含多人/合影：横向裁切必切人"); }
    else if (p.people === 1) { risk += 18; reasons.push("竖图含人物：横向裁切易切头/切脚"); }
  }
  if (p.quality < 0.58) { risk += 12; reasons.push("画质偏低，放大后易失真"); }
  risk = Math.max(0, Math.min(100, risk));
  const level = risk >= 45 ? "high" : (risk >= 22 ? "medium" : "low");
  return {
    imageId: p.imageId, risk: risk, level: level, reasons: reasons,
    subjects: protectedSubjects(p),
    safePatterns: safePatternsOf(p, { level: level, fromModel: false }),
    // high → 原比例展示 / 不用作 Hero；medium → 允许整宽但需安全焦点裁切
    prefer: risk >= 45 ? "aspect_preserved" : (risk >= 22 ? "wide_safe_focus" : "any"),
  };
}
function evaluateCropSafetyAll(used) {
  const list = used.map(evaluateCropSafety);
  const byId = {}; list.forEach((c) => { byId[c.imageId] = c; });
  return { list: list, byId: byId, highRiskIds: list.filter((c) => c.level === "high").map((c) => c.imageId) };
}

/* ---------- 门面：一次产出完整图片智能（供详情页 / 宣发 / UI 轻确认复用） ---------- */
function buildPhotoIntelligence(photos, a, sections, scenario) {
  const analysis = analyzePhotos(photos);
  const selection = selectPhotos(analysis);
  const used = selection.used;
  const roleInfo = assignAllRoles(analysis, selection);
  const crops = evaluateCropSafetyAll(used);
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
  const layout = buildAdaptiveLayout(used, (photos || []).length);   // total=原始上传张数，决定数量分级（20+ 触发 curated）
  const dna = (a && a.activityDNA) || null;
  const matched = sections && sections.length ? matchPhotosToSections(sections, used, roleInfo.roles, dna) : [];
  const itin = (a && typeof structureItinerary === "function") ? structureItinerary(a) : null;
  const matchedItinerary = (itin && itin.timeline && itin.timeline.length) ? matchItineraryPhotos(itin.timeline, used, roleInfo.roles, dna) : null;
  const dnaEnv = (a && a.activityDNA && a.activityDNA.environment) || "";
  // P0-8：角色计数覆盖「全部已分析图片」（含弃用池的 DiscardCandidate），供 UI 文案与验收展示
  const roleCounts = {};
  analysis.forEach((p) => { const r = roleInfo.roles[p.imageId] || "SupportImage"; roleCounts[r] = (roleCounts[r] || 0) + 1; });
  const rc = selection.reasons || { dup: 0, low: 0, weak: 0 };
  const roleSummary = PI_ROLE_ORDER
    .filter((r) => roleCounts[r])
    .map((r) => `${PI_ROLE_LABEL[r] || r} ${roleCounts[r]}`)
    .join(" · ");
  return {
    analysis: analysis, selection: selection, used: used,
    heroId: roleInfo.heroId, roles: roleInfo.roles, roleLabel: PI_ROLE_LABEL,
    roleCounts: roleCounts, rolesMeta: PI_ROLES, roleOrder: PI_ROLE_ORDER,
    importanceOf: (imageId) => importanceOf(roleInfo.roles, imageId),
    layout: layout, cropSafety: crops, matched: matched, matchedItinerary: matchedItinerary,
    orientation: {
      landscape: used.filter((p) => p.orientation === "landscape").length,
      portrait: used.filter((p) => p.orientation === "portrait").length,
      square: used.filter((p) => p.orientation === "square").length,
    },
    dnaEnv: dnaEnv,
    simulated: analysis.some((p) => p.simulated),
    summary: `${analysis.length} 张 → 使用 ${used.length} 张（弃用 ${selection.discarded.length}：重复 ${rc.dup} / 质量较低 ${rc.low} / 内容重复·弱相关 ${rc.weak}）；角色分配 ${roleSummary}`,
  };
}

/* ---------- P2-4：真实视觉模型接口（标准化写回入口） ----------
   本项目当前的 scene / subject / people / action / emotion 为规则启发式推断（simulated=true）。
   接入真实视觉模型时，无需改动任何版式/渲染代码，只需走统一契约写回缓存：
     ① 模型返回「归一化 JSON」（字段见 vision.js 的 VISION_NORMALIZED_SCHEMA / VISION_FIELD_WHITELIST）；
     ② vision.js 的 visionToPhotoMeta() 把它映射成 photoMeta 形态（metaToSignals 读取的字段名）；
     ③ applyVisionNormalized(src, norm) 写回 PHOTO_FOCUS_CACHE（simulated 强制 false）。
   之后 analyzePhotos() 经 photoMeta 读到真实字段，selectPhotos / assignPhotoRoles / buildAdaptiveLayout 全部自动采用。
   旧的直接写回 applyVision(src, meta) 仍可用（meta 已是 photoMeta 形态）。 */
function visionEnabled() { return (typeof window !== "undefined" && !!window.CLUBOS_VISION_API); }
function applyVision(src, data) {
  if (!src || !data || typeof PHOTO_FOCUS_CACHE === "undefined") return false;
  try {
    const prev = PHOTO_FOCUS_CACHE.get(src) || {};
    PHOTO_FOCUS_CACHE.set(src, Object.assign({}, prev, data, { simulated: false }));
    /* P1：同步登记统一 visionResult —— 让 evidenceScope / groundingTags / 细粒度场景
       在「真实视觉结果」写回后立即可用（不依赖再跑一次 batch）。 */
    try {
      if (typeof visionUnifiedOf === "function" && typeof VISION_RESULTS !== "undefined") {
        VISION_RESULTS[src] = visionUnifiedOf(src, Object.assign({}, prev, data, { simulated: false }));
      }
    } catch (e2) {}
    return true;
  } catch (e) { return false; }
}
function applyVisionBatch(map) {
  let n = 0;
  Object.keys(map || {}).forEach((src) => { if (applyVision(src, map[src])) n++; });
  return n;
}



/* =================== MERGED FROM src/ai.js =================== */
/* ai.js  (facts/DNA/itinerary/outline/gaps + smartBg) */
  const AI_SYSTEM_PROMPT = `你是一个户外俱乐部的内容主笔。你写的不是游记、不是百科、也不是机械的行程说明，而是一份「有销售转化能力的户外活动宣传内容」。

【最高原则：允许创造表达，不允许创造事实】
- 可以创造：标题、修辞、文字节奏、情绪、内容角度、表达方式、叙述顺序。
- 不可以创造：路线事实、领队行为、保险、餐食、交通、住宿、装备、现场设施、服务内容、时间节点、用户评价、安全保障、救援能力、活动结果、未确认的体验细节。
- 所有事实只能来自「已确认活动资料」。没提到的具体数字、场景、服务不要编；信息不足就写「以领队现场安排为准」「出发前群内通知」或留白。

【写作顺序（必须遵循消费者阅读决策，不要按路线时间机械展开）】
1. 为什么值得来（风景/场景/季节/地点价值，但不是百科介绍）
2. 来了会体验什么（真实参与感：运动/探索/挑战/互动/拍照/社交/亲子/户外技能，必须建立在真实活动形式之上）
3. 参加完能得到什么（身体/心理/成长/亲子/社交等收获，只取最真实匹配的 1—3 项）
4. 适不适合我（推荐人群/不建议人群/强度/年龄/经验）
5. 真实行程与费用（作为决策验证信息，不统治全文）

【绝对禁止】
- 口号式反问：想不想、要不要、你准备好了吗、还在等什么、难道不
- 模板动词：带你、一起浪、约起来、等你来、冲起来、搞起来
- 空洞形容词堆砌：炎炎夏日、清凉刺激、清澈、蜿蜒、速度与激情、后花园、绝美、无敌、超赞、治愈、松弛感拉满、breathtaking、诗与远方、风景优美、景色宜人、绝美秘境、不容错过
- 无事实兜底的安全感口号：装备齐全、保险无忧、专业护航、全程保障、安全放心、专业领队、路线成熟、新手友好、轻装即可
- 招募 Fallback（无 AI 时）只输出事实安全版本：每条事实须来自 confirmedFacts（地点/时间/费用/强度/名额/装备/含项/领队名等）；类型推断的 scenicValue/experienceValue/participationValue 仅作表达方向，不得当作现场事实；禁止默认 专业领队/新手友好/路线成熟/轻装即可/风景绝美/安全放心
- 强行动召唤：赶紧报名、限时抢购、先到先得、手慢无
- 百科式开头：某山位于某省……（除非确实对用户决策有价值）
- 过度文学化：山风吹过灵魂。内容首先服务报名决策。
- 固定对比句式：禁止套用「前半段……你以为……；后半段……才……」。
- 虚构现场细节：小卖部、冰棍、某次领队动作、某位用户反应、某种未确认服务。

【怎么写出吸引力——靠具体，不靠夸张】
1. 用名词和动词写画面：不要写「风景很美」，写「天气好的时候，从高处可以看到成都平原慢慢铺开」。
2. 优先写用户「得到什么」「参与后改变」：不要写「6公里徒步路线」，写「对刚开始接触徒步的人，这次更像一次对自己体能的真实测试」；不要写「这是一场有意义的户外活动」，写「走完以后，你会更清楚自己能走多远、下一次可以挑战什么」。
3. 地点语料只作背景：地点数据库不能决定内容主题，更不能复制成百科正文。先想清楚「这场活动为什么值得卖」，再决定地点怎么用。
4. 动态章节标题：正文允许用 AI 自定的小标题（如「为什么值得专门来一次」「这一天下来，你会带走什么」），但必须克制，不堆砌文艺腔。
5. hook 用只有这场活动才有的事实/画面/悬念开头，一句话 20-45 字。
6. body 必须是一篇连贯长文：按上面的写作顺序展开，段与段之间有逻辑递进，不要各写一段再拼接；最后给决策信息。
7. marketingTitles 一次 5 个，像杂志专题标题一样短而完整，彼此明显不同（地点气质/季节体感/行动邀请/情绪画面/完成感）。严禁出现任何硬销信息：具体日期、人数限制、名额、价格、公里数、爬升米数、年龄、保险、集合时间、装备清单、报名/优惠/倒计时/仅限/只剩/只限等字样。标题表达的是「为什么想去」，不是「什么时候、多少人、多少钱」。
8. highlights 每条「事实+好处」；sellingPoints 必须 4—6 条且角度明显不同（如稀缺场景/真实体验/服务保障/季节时机/人群匹配/完成感），禁止互相近义或空泛堆砌，desc 写清为什么重要。

请始终只返回一个严格符合给定 JSON Schema 的对象，不要输出任何额外文字或 Markdown 代码块。`;


    const STRATEGY_PROMPT = `你是一个户外俱乐部的「内容策略师」。你不直接写文案，而是先判断这场活动到底为什么值得卖，再给主笔一份统一的传播策略。

【输入】俱乐部的真实活动资料（已确认事实）。

【你的任务】只做三件事，严格按 JSON 返回：
1. consumerValue（消费者价值分析）：这场活动对参与者真正的价值。
   - scenicValue：这个地方为什么值得去（风景/季节/地貌/视野/稀缺场景/与城市的差异）。地点只作背景，不要写成百科。
   - experienceValue：参加到底有什么意思（运动/探索/挑战/互动/拍照/社交/亲子/户外技能），必须建立在真实活动形式之上，禁止只写「好玩/刺激/治愈」。
   - participationValue：完成以后能得到什么（身体/心理/成长/亲子/社交，只取最真实匹配的 1—3 项）。
   - targetUser：最推荐的人群。
   - mainConcern：这类用户在报名前最担心什么。
   - mainSellingPoint：整场活动最该被记住的那一句话价值。
2. contentStrategy（核心传播主题）：
   - mainTheme：整场活动只能有一个主传播主题（景观型/季节型/体验型/挑战型/成长型/亲子型/社交型/城市逃离型/第一次型）。
   - secondaryTheme：最多一个辅助主题，可空。
   - mainSellingPoint：贯穿所有渠道的核心卖点句。
   - audienceInsight：对目标人群的一句洞察。
   - tone：整体语气（如：克制专业/轻快陪伴/诗意克制）。
3. narrativePlan（完整叙事计划，不写长文，只列要点）：
   - coreMessage：核心信息一句。
   - whyGo：为什么值得去（要点）。
   - whatExperience：体验什么（要点）。
   - whatGain：能得到什么（要点）。
   - decisionInfo：需要给用户的决策信息。
   - closingEmotion：收尾情绪。

【类型价值权重（仅内部判断，不要写进文案）】
徒步：景观 40% / 体验 30% / 成长 30%；亲子：景观 20% / 体验 35% / 成长 45%；露营：景观 35% / 体验 45% / 成长 20%；高海拔登山：景观 20% / 体验 30% / 成长挑战 50%；漂流水上：景观 20% / 体验 60% / 成长 20%。

【事实边界】只能依据输入中的已确认事实；缺什么就标 missing，不要编造。
请只返回一个严格符合 Schema 的 JSON 对象。`;

  async function aiStrategy(text) {
    const schema = [
      "{",
      " \"facts\": {\"activityName\":\"\",\"activityType\":\"\",\"place\":\"\",\"date\":\"\",\"season\":\"\",\"price\":0,\"limit\":0,\"limitUnit\":\"人\",\"ageRange\":\"\",\"audience\":\"\",\"distance\":0,\"elevation\":0,\"difficulty\":\"\",\"meeting\":\"\",\"meetTime\":\"\",\"returnTime\":\"\",\"includedServices\":[],\"gear\":[],\"transport\":\"\",\"meal\":\"\",\"insurance\":\"\",\"leader\":\"\",\"itinerary\":[],\"missing\":[]},",
      " \"consumerValue\": {\"scenicValue\":\"\",\"experienceValue\":\"\",\"participationValue\":\"\",\"targetUser\":\"\",\"mainConcern\":\"\",\"mainSellingPoint\":\"\"},",
      " \"contentStrategy\": {\"mainTheme\":\"\",\"secondaryTheme\":\"\",\"mainSellingPoint\":\"\",\"audienceInsight\":\"\",\"tone\":\"\"},",
      " \"narrativePlan\": {\"coreMessage\":\"\",\"whyGo\":\"\",\"whatExperience\":\"\",\"whatGain\":\"\",\"decisionInfo\":\"\",\"closingEmotion\":\"\"}",
      "}"
    ].join("\n");
    const userMsg = ["请分析以下真实活动资料，严格按 Schema 返回 JSON：", text, dnaPromptBlock({ raw: text }), "JSON Schema:", schema].join("\n\n");
    try {
      return await clubLLM({ system: STRATEGY_PROMPT, user: userMsg, json: true, temperature: 0.4 });
    } catch (e) { console.error("AI 策略分析异常:", e); return null; }
  }

  async function aiNarrative(text, strategy) {
    const stratTxt = strategy ? JSON.stringify({ consumerValue: strategy.consumerValue, contentStrategy: strategy.contentStrategy, narrativePlan: strategy.narrativePlan }, null, 2) : "";
    const schema = [
      "{",
      " \"title\":\"活动标题\",",
      " \"subtitle\":\"副标题（一句话承接主题）\",",
      " \"marketingTitles\":[\"标题备选1\",\"标题备选2\",\"标题备选3\",\"标题备选4\",\"标题备选5\"],",
      " \"heroHook\":\"详情页 Hero 钩子，20-45字，用本场才有的事实/画面/悬念开头\",",
      " \"intro\":\"120-220字导语：先事实定位，再写本场才有的具体画面，最后给决策信息\",",
      " \"hook\":\"正文开场钩子（可与 heroHook 不同角度），20-45字\",",
      " \"body\":[\"连贯长文第1段：为什么值得去\",\"第2段：来了会体验什么\",\"第3段：参加完能得到什么\",\"第4段：决策信息（适合谁/费用/名额）\"],",
      " \"editorialTitle\":\"详情页故事区小标题（动态、克制，禁止套固定句式）\",",
      " \"posterTagline\":\"海报氛围标语，结合季节+时间+地点，16-36字\",",
      " \"pullQuote\":\"记忆句/金句，8-20字\",",
      " \"storyPurpose\":\"照片故事主题，8-20字\",",
      " \"photoCaptions\":[\"配文1\",\"配文2\"],",
      " \"sectionTitles\":{\"whyGo\":\"为什么值得去（动态标题）\",\"experience\":\"来了会体验什么（动态标题）\",\"gain\":\"参加完你能得到什么（动态标题）\"},",
      " \"whyGo\":\"为什么值得去的一段话（具体、有画面）\",",
      " \"experience\":\"来了会体验什么的一段话\",",
      " \"gain\":\"参加完能得到什么的一段话\",",
      " \"fitFor\":\"推荐人群（一句话）\",",
      " \"notFitFor\":\"不建议人群（一句话，可空）\",",
      " \"socialCoreMessage\":\"贯穿所有渠道的核心传播句\",",
      " \"highlights\":[{\"text\":\"事实+好处\",\"icon\":\"star\"}],",
      " \"sellingPoints\":[{\"title\":\"一句话卖点标题\",\"desc\":\"具体支撑：为什么这个点对用户重要\"}],",
      " \"gearAdvice\":[\"装备1\"],",
      " \"itineraryDays\":[{\"label\":\"行程\",\"sub\":\"\",\"items\":[{\"time\":\"08:00\",\"text\":\"集合\"}]}],",
      " \"missingFacts\":[\"缺集合地点\"],",
      " \"shareCopies\":{\"wechat\":\"\",\"moments\":\"\",\"xhs\":\"\",\"gzh\":\"\",\"voice\":\"\"}",
      "}"
    ].join("\n");
    const userMsg = ["【已确认活动资料】", text, dnaPromptBlock({ raw: text }), "【内容策略（必须严格服从，所有渠道同一主主题）】", stratTxt, "请严格按 Schema 返回 JSON。要求：1) 必须返回 Schema 中所有字段，不得省略；2) 每个字段都必须有有效内容，禁止空字符串、null 或省略；3) 正文必须是一篇连贯长文，围绕上面的主传播主题展开，不得各写一段再拼接；4) 若某字段信息不足，可基于已确认事实合理推断，但字段必须存在且有内容。"].join("\n\n");
    try {
      return await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.7 });
    } catch (e) { console.error("AI 叙事生成异常:", e); return null; }
  }

  function buildFactsText(a) {
    const f = [];
    if (a.title) f.push("活动名称：" + a.title);
    if (a.type) f.push("活动类型：" + a.type);
    if (a.place) f.push("地点：" + a.place);
    if (a.date || a.dateMD) f.push("日期：" + (a.dateMD || a.date));
    if (a.days > 1) f.push("天数：" + a.days);
    if (a.price != null) f.push("价格：" + a.price + "/" + (a.limitUnit || "人"));
    if (a.limit) f.push("名额：" + a.limit + (a.limitUnit || "人"));
    if (a.ageRange) f.push("适合年龄：" + a.ageRange);
    if (a.audience && a.audience.length) f.push("人群：" + a.audience.join("/"));
    if (a.distance != null) f.push("距离：" + a.distance + "KM");
    if (a.elevation) f.push("海拔：" + a.elevation + "米");
    if (a.difficulty) f.push("难度：" + a.difficulty);
    if (a.meeting) f.push("集合：" + a.meeting + (a.meetTime ? " " + a.meetTime : ""));
    if (a.returnTime) f.push("返回：" + a.returnTime);
    const inc = a.feeInclude || []; if (inc.length) f.push("包含：" + inc.join("、"));
    if (a.gear && a.gear.length) f.push("装备：" + a.gear.map(function(g){return g.name;}).join("、"));
    if (a.itineraryDays && a.itineraryDays.length) {
      const its = a.itineraryDays.map(function(d){ return (d.label || "") + "：" + (d.items || []).map(function(t){return t.time + " " + t.text;}).join("；"); }).join(" | ");
      if (its) f.push("行程：" + its);
    }
    if (a.leaderName) f.push("领队：" + a.leaderName + (a.leaderYears ? ("（" + a.leaderYears + "）") : ""));
    if (a.raw) f.push("原始资料：\n" + a.raw);
    return f.join("\n");
  }

  function contentConsistencyCheck(a) {
    const score = { readability: 0, attractiveness: 0, specificity: 0, consistency: 0, conversionValue: 0, factSafety: 0 };
    const notes = [];
    const prose = [a.intro, a.hook, (a.body || []).join(" "), (a.highlights || []).map(function(h){return h[0];}).join(" "), a.gain, a.experience, a.whyGo].filter(Boolean).join(" ");
    const fab = /(小卖部|冰棍|领队.*?(演示|说)|某次|往期|去年|上次)/.test(prose);
    score.factSafety = fab ? 1 : 5;
    if (fab) notes.push("检测到疑似虚构现场细节，请核对事实。");
    const hollow = /(绝美|无敌|超赞|治愈|松弛感|诗与远方|风景优美|景色宜人|不容错过|清凉刺激|速度与激情|breathtaking)/g;
    const hollowN = (prose.match(hollow) || []).length;
    score.specificity = hollowN === 0 ? 5 : Math.max(1, 5 - hollowN);
    if (hollowN >= 2) notes.push("文案出现较多空洞形容词，建议换具体描述。");
    const theme = a.contentPlan && a.contentPlan.contentStrategy && a.contentPlan.contentStrategy.mainTheme;
    score.consistency = theme ? 5 : 2;
    const ans = [ !!(a.whyGo || /为什么|值得/.test(prose)), !!(a.experience || /体验|参与|挑战/.test(prose)), !!(a.gain || /得到|收获|成长/.test(prose)) ].filter(Boolean).length;
    score.conversionValue = ans >= 2 ? 5 : (ans === 1 ? 3 : 1);
    if (ans < 2) notes.push("内容未充分回答「为什么值得去 / 好不好玩 / 能得到什么」。");
    const paras = (a.body || []).filter(Boolean);
    const dup = paras.length ? paras.some(function(p, i){ return paras.indexOf(p) !== i; }) : false;
    score.readability = (paras.length >= 3 && !dup) ? 5 : (paras.length ? 3 : 1);
    score.attractiveness = (a.hook && a.hook.length >= 15 && a.pullQuote) ? 5 : 3;
    return { score: score, notice: notes.join(" ") };
  }


  async function parseActivityWithAI(inputText) {
    if (!aiAuthMode()) return { _needKey: true, raw: inputText };
    const strategy = await aiStrategy(inputText);
    if (!strategy) return { _error: "策略分析失败", raw: inputText };
    const content = await aiNarrative(inputText, strategy);
    if (!content) return { _error: "内容生成失败", raw: inputText };
    // 合并：事实来自策略层（facts），正文来自叙事层；详情页渲染只需最终活动字段
    const merged = Object.assign({}, strategy.facts || {}, content);
    merged._raw = inputText;
    merged._contentPlan = {
      consumerValue: strategy.consumerValue || {},
      contentStrategy: strategy.contentStrategy || {},
      narrativePlan: strategy.narrativePlan || {}
    };
    return merged;
  }

  // 标题清洗：过滤掉带硬销/硬数据的标题（日期、人数、价格、公里、时间、保险、年龄、名额、报名、优惠、倒计时、只限/仅剩等）
  function sanitizeMarketingTitle(t) {
    const s = String(t || "").trim();
    if (!s) return "";
    // 含日期、时间、人数、价格、公里/米、年龄、保险、装备、名额、报名、优惠、倒计时、仅/只/剩/限等硬销字样
    const banned = /\d{1,2}月\d{1,2}[日号]?|\d{1,2}[日号]|周[一二三四五六日]|周六|周日|周末|星期[一二三四五六日]|仅\d+|只[限给]\d+|仅剩\d+|只剩\d+|限\d+|名额|\d+元|\d+折|\d+[\.\d]*公里|\d+KM|\d+km|\d+米|\d+m|保险|费用|报名费|报名|早鸟|优惠|立减|原价|现价|抢购|倒计时|最后一天|即将截止|满\d+减\d+|集合|装备|年龄|适合\d+|不建议\d+|只给|留了位置|还剩|剩\d+|限位|余位/;
    if (banned.test(s)) return "";
    // 太短的纯标签也过滤
    if (s.length < 5) return "";
    return s;
  }

  // 标题去重：先清洗，再去掉完全相同/互相包含的近义包装
  function dedupeTitles(titles) {
    const norm = (s) => String(s || "").trim().replace(/[\s，。、：:·\-—_]+/g, "");
    const out = [];
    for (const t of titles) {
      const clean = sanitizeMarketingTitle(t);
      if (!clean) continue;
      const tn = norm(clean);
      if (!tn) continue;
      const dup = out.some((o) => { const on = norm(o); return on === tn || on.includes(tn) || tn.includes(on); });
      if (!dup) out.push(clean);
    }
    return out;
  }
  // 标题数量不足时用本地方向库补齐，保证明显不同且数量足够
  function fillTitlesFromPool(titles, a) {
    const pool = directionPoolFor(a).map((d) => sanitizeMarketingTitle(d.headline)).filter(Boolean);
    const have = new Set(titles.map((t) => String(t).trim().replace(/[\s，。、：:·\-—_]+/g, "")));
    for (const h of pool) {
      if (titles.length >= 5) break;
      const hn = String(h).trim().replace(/[\s，。、：:·\-—_]+/g, "");
      if (!have.has(hn)) { titles.push(h.trim()); have.add(hn); }
    }
    return titles;
  }

  // —— 难度字段清洗：AI 在缺字段时常按提示词返回字面 "missing"，必须过滤，否则详情页会显示 missing ——
  const DIFFICULTY_VALID = ["轻松", "适中", "进阶", "挑战", "专业"];
  // AI 在缺字段时会把字面量 "missing"/"null" 当值返回（difficulty 已单独清洗）。
  // 其它自由文本事实字段同样要洗，否则详情页会渲染出「适合missing」这类脏文案。
  const AI_SENTINEL = /^(missing|undefined|null|nan|none|n\/a|n\.a\.?|待确认|待机构确认|未知|不详|暂无|无|-|—|\/)$/i;
  function cleanFactText(v, maxLen) {
    if (v == null) return "";
    if (typeof v === "number") return isFinite(v) ? String(v) : "";
    let s = String(v).trim();
    if (!s || AI_SENTINEL.test(s)) return "";
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
    return s;
  }
  function cleanDifficulty(d) {
    if (d == null) return "";
    d = String(d).trim();
    if (/^missing$/i.test(d) || d === "待确认" || d === "待机构确认" || d === "未知" || d.length > 6) return "";
    if (DIFFICULTY_VALID.includes(d)) return d;
    const map = { "简单": "轻松", "简易": "轻松", "易": "轻松", "中等": "适中", "中强度": "适中", "中等强度": "适中", "困难": "挑战", "较难": "挑战", "难": "挑战", "进阶段": "进阶", "进阶难度": "进阶" };
    return map[d] || "";
  }

  // 把 LLM JSON 映射到 state.activity，保持详情页渲染所需的字段形态
  function applyAIResult(json, base) {
    const a = base || blankActivity();
    a.raw = json._raw || a.raw || "";
    if (json.title) a.title = json.title;
    if (Array.isArray(json.marketingTitles) && json.marketingTitles.length) {
      let mt = dedupeTitles(json.marketingTitles);
      mt = fillTitlesFromPool(mt, a);
      a.forewordTitles = mt;
      const first = mt[0] || json.title || a.title || "";
      a.titleVariants = { brand: first, info: first, wechat: first, xhs: first, moments: first };
      if (!a.title) a.title = first;
    }
    if (Array.isArray(json.contentDirections) && json.contentDirections.length) {
      a.contentDirections = json.contentDirections.slice(0, 3).map((d, i) => ({
        name: String(d.name || `方向 ${i + 1}`),
        headline: String(d.headline || ""),
        reason: String(d.reason || ""),
        intro: String(d.intro || ""),
        posterLine: String(d.posterLine || d.poster_line || "")
      }));
      a.contentDirection = 0;
      a.contentStrategy = a.contentDirections[0];
    }
    if (!a.contentDirections.length && Array.isArray(a.forewordTitles) && a.forewordTitles.length) {
      const facts = [a.distance ? `${a.distance}公里` : "", a.ageRange || "", a.days > 1 ? `${a.days}天` : "", a.limit ? `${a.limit}${a.limitUnit}` : ""].filter(Boolean);
      a.contentDirections = a.forewordTitles.slice(0, 3).map((headline, i) => ({
        name: ["主表达", "场景感", "招募感"][i] || `方向 ${i + 1}`,
        headline,
        reason: facts.length ? `基于本场已确认的${facts.slice(0, 2).join("、")}来组织表达。` : "基于老板提供的活动信息组织表达。",
        intro: a.intro || "",
        posterLine: a.posterTagline || ""
      }));
      a.contentDirection = 0;
      a.contentStrategy = a.contentDirections[0];
    }
    if (json.type) a.type = cleanFactText(json.type, 12) || a.type;
    if (json.place) a.place = cleanFactText(json.place, 24) || a.place;
    if (json.days) a.days = +json.days;
    if (json.startDate || json.date) { const d = cleanFactText(json.startDate || json.date, 24) || (json.startDate || json.date); a.date = d; a.dateMD = toDateMD(d); }
    if (json.price != null) a.price = +json.price;
    if (json.meeting) a.meeting = cleanFactText(json.meeting, 30) || a.meeting;
    if (json.meetTime) a.meetTime = cleanFactText(json.meetTime, 16) || a.meetTime;
    if (json.returnTime) a.returnTime = cleanFactText(json.returnTime, 16) || a.returnTime;
    if (json.transport) a.transport = cleanFactText(json.transport, 40) || a.transport;
    if (json.leader) a.leaderName = cleanFactText(json.leader, 20) || a.leaderName;
    // 首次 AI 生成时，把日期/价格同步为默认团期
    if (a.date && (!a.departures || !a.departures.length)) {
      const d = departureFromDate(a.date, a.price);
      if (d) a.departures = [d];
    } else if (a.departures && a.departures.length && json.price != null) {
      a.departures.forEach((d) => { if (d.price == null) d.price = a.price; });
    }
    if (json.limit != null) a.limit = +json.limit;
    if (json.limitUnit) a.limitUnit = json.limitUnit;
    // 年龄：AI 缺字段常返回字面 "missing"，洗掉后视为「未确认」，绝不进页面
    const aiAge = cleanFactText(json.ageRange, 24);
    if (aiAge) { a.ageRange = aiAge; const mm = String(aiAge).match(/(\d{1,2})\s*[-—~至到]\s*(\d{1,2})/); if (mm) { a.ageFrom = +mm[1]; a.ageTo = +mm[2]; } }
    else if (json.ageRange != null) { a.ageRange = ""; }
    if (json.distance != null) a.distance = +json.distance;
    if (json.elevation != null) a.elevation = +json.elevation;
    // 难度：AI 缺字段会返回 "missing"，清洗后无效则归「待确认」，避免详情页渲染字面 missing
    if (json.difficulty != null) {
      const cd = cleanDifficulty(json.difficulty);
      a.difficulty = cd || "待确认";
    }
    if (Array.isArray(json.includedServices)) {
      a.included = json.includedServices.slice();
      a.feeInclude = json.includedServices.slice();
      a.includeLeader = json.includedServices.some((s) => /领队|向导|教练|带队/.test(s));
      a.includeMeal = json.includedServices.some((s) => /餐|食|午饭|午餐/.test(s));
      a.includeInsurance = json.includedServices.some((s) => /保险/.test(s));
      a.includeTransport = json.includedServices.some((s) => /交通|车|接送/.test(s));
      a.includeGear = json.includedServices.some((s) => /装备/.test(s));
    }
    if (json.intro) a.intro = json.intro;
    if (json.hook) a.hook = json.hook;
    if (Array.isArray(json.body)) a.body = json.body.filter(Boolean);
    if (Array.isArray(json.sellingPoints)) a.sellingPoints = json.sellingPoints.map((s) => ({ title: String((s && (s.title || s.text || (typeof s === "string" ? s : ""))) || ""), desc: String((s && s.desc) || "") }));
    if (json.editorialTitle) a.editorialTitle = json.editorialTitle;
    if (json.posterTagline) a.posterTagline = json.posterTagline;
    if (json.pullQuote) a.pullQuote = json.pullQuote;
    if (json.storyPurpose) a.storyPurpose = json.storyPurpose;
    if (Array.isArray(json.photoCaptions)) a.photoCaptions = json.photoCaptions.filter(Boolean);
    if (Array.isArray(json.highlights)) a.highlights = json.highlights.map((h) => {
      if (Array.isArray(h)) return [String(h[0] || ""), String(h[1] || "star")];
      if (h && typeof h === "object") return [String(h.text || h.title || ""), String(h.icon || "star")];
      return [String(h || ""), "star"];
    });
    if (Array.isArray(json.gearAdvice)) a.gear = json.gearAdvice.map((n) => ({ name: n, must: true }));
    if (Array.isArray(json.itineraryDays)) a.itineraryDays = json.itineraryDays;
    if (Array.isArray(json.missingFacts)) a.missingFacts = json.missingFacts;
    if (json.shareCopies && typeof json.shareCopies === "object") {
      a.shareWechat = json.shareCopies.wechat || "";
      a.shareMoments = json.shareCopies.moments || "";
      a.shareXhs = json.shareCopies.xhs || "";
      a.shareGzh = json.shareCopies.gzh || "";
      a.shareVoice = json.shareCopies.voice || "";
    }
    // 新架构：消费者价值 / 核心传播主题 / 叙事计划（来自策略层）+ 新版叙事字段
    if (json._contentPlan) a.contentPlan = json._contentPlan;
    if (a.contentPlan && a.contentPlan.contentStrategy) {
      const cs = a.contentPlan.contentStrategy;
      const cv = a.contentPlan.consumerValue || {};
      a.contentStrategy = {
        name: cs.mainTheme || (a.contentDirections[0] && a.contentDirections[0].name) || "主表达",
        headline: cs.mainSellingPoint || (a.contentDirections[0] && a.contentDirections[0].headline) || a.title,
        reason: cs.audienceInsight || "",
        intro: cv.mainSellingPoint || a.intro || "",
        posterLine: a.posterTagline || ""
      };
    }
    if (json.subtitle) a.subtitle = json.subtitle;
    if (json.heroHook) a.heroHook = json.heroHook;
    if (json.sectionTitles && typeof json.sectionTitles === "object") a.sectionTitles = json.sectionTitles;
    if (json.whyGo) a.whyGo = json.whyGo;
    if (json.experience) a.experience = json.experience;
    if (json.gain) a.gain = json.gain;
    if (json.fitFor) a.fitFor = json.fitFor;
    if (json.notFitFor) a.notFitFor = json.notFitFor;
    if (json.socialCoreMessage) a.socialCoreMessage = json.socialCoreMessage;
    // 构造详情页渲染所需的 pipeline 形态（卖点 + 出行须知），渲染器无需改动
    a.pipeline = {
      foreword: { titles: a.forewordTitles || [], intro: a.intro || "" },
      sellingPoints: ((json.sellingPoints && json.sellingPoints.length) ? json.sellingPoints : (json.highlights || [])).map((s) => ({ title: String((s && (s.title || s.text || (typeof s === "string" ? s : ""))) || ""), desc: String((s && s.desc) || "") })),
      itinerary: { days: a.days || 1 },
      details: {
        refund: ["出发前 7 天以上取消，全额退款。", "出发前 3—7 天取消，扣除 30% 费用。", "出发前 3 天内取消，费用不退，可协商转让名额。"],
        altitude: (a.elevation && +a.elevation >= 3500) ? ["本路线目标海拔约 " + a.elevation + " 米，请提前做好高反预防。"] : [],
        missing: Array.isArray(json.missingFacts) ? json.missingFacts : [],
        must: json.gearAdvice || [],
        suggest: []
      }
    };
    a.missing = [];
    syncItineraryDays(a);
    // 开场钩子模板化检测：命中固定对比句式则提示用户重新生成
    a.aiNotice = (a.hook && /你以为|前半段|后半段/.test(a.hook)) ? "开场钩子疑似套用固定句式，建议点「重新生成」换一版。" : "";
    // 新架构：内容一致性检查 + 评分（规则引擎，不额外消耗 AI）
    const chk = contentConsistencyCheck(a);
    a.contentScore = chk.score;
    if (chk.notice) a.aiNotice = a.aiNotice ? a.aiNotice + " " + chk.notice : chk.notice;
    return a;
  }

  // 已有一个 draft 时，调用 LLM 基于现有事实重新生成文案（不重解析事实）
    async function regenerateCopy(a) {
    if (!a) return false;
    if (!aiAuthMode()) return false;
    const factsText = buildFactsText(a);
    const hasPlan = a.contentPlan && a.contentPlan.contentStrategy && a.contentPlan.contentStrategy.mainTheme;
    const strategy = hasPlan ? a.contentPlan : await aiStrategy(factsText);
    if (!strategy) return false;
    const content = await aiNarrative(factsText, strategy);
    if (!content) return false;
    content._raw = a.raw;
    content._contentPlan = { consumerValue: strategy.consumerValue || {}, contentStrategy: strategy.contentStrategy || {}, narrativePlan: strategy.narrativePlan || {} };
    applyAIResult(content, a);
    await ensureNarrativeFields(a);
    await ensureItineraryFields(a);
    syncItineraryDays(a);
    return true;
  }

  // 兜底：若 AI 首次返回的叙事字段有空缺，用一次有针对性的补全调用填满，不再让编辑区留白
  async function ensureNarrativeFields(a) {
    if (!a) return false;
    const need = [];
    if (!a.intro) need.push("intro");
    if (!a.hook) need.push("hook");
    if (!Array.isArray(a.body) || !a.body.length) need.push("body");
    if (!a.whyGo) need.push("whyGo");
    if (!a.experience) need.push("experience");
    if (!a.gain) need.push("gain");
    if (!a.fitFor) need.push("fitFor");
    if (!a.notFitFor) need.push("notFitFor");
    if (!a.editorialTitle) need.push("editorialTitle");
    if (!a.pullQuote) need.push("pullQuote");
    if (!a.posterTagline) need.push("posterTagline");
    if (!a.storyPurpose) need.push("storyPurpose");
    if (!Array.isArray(a.photoCaptions) || !a.photoCaptions.length) need.push("photoCaptions");
    if (!a.sectionTitles || !a.sectionTitles.whyGo) need.push("sectionTitles");
    if (!need.length) return true;
    if (!aiAuthMode()) return false;
    const factsText = buildFactsText(a);
    const stratTxt = a.contentPlan ? JSON.stringify(a.contentPlan, null, 2) : "";
    const schemaParts = need.map((f) => {
      switch (f) {
        case "intro": return "\"intro\":\"120-220字导语\"";
        case "hook": return "\"hook\":\"20-45字开场钩子\"";
        case "body": return "\"body\":[\"第1段：为什么值得去\",\"第2段：来了会体验什么\",\"第3段：参加完能得到什么\",\"第4段：决策信息\"]";
        case "whyGo": return "\"whyGo\":\"为什么值得去的一段话\"";
        case "experience": return "\"experience\":\"来了会体验什么的一段话\"";
        case "gain": return "\"gain\":\"参加完能得到什么的一段话\"";
        case "fitFor": return "\"fitFor\":\"推荐人群\"";
        case "notFitFor": return "\"notFitFor\":\"不建议人群\"";
        case "editorialTitle": return "\"editorialTitle\":\"故事区小标题\"";
        case "pullQuote": return "\"pullQuote\":\"记忆句/金句\"";
        case "posterTagline": return "\"posterTagline\":\"海报氛围标语\"";
        case "storyPurpose": return "\"storyPurpose\":\"照片故事主题\"";
        case "photoCaptions": return "\"photoCaptions\":[\"配文1\",\"配文2\"]";
        case "sectionTitles": return "\"sectionTitles\":{\"whyGo\":\"章节标题\",\"experience\":\"章节标题\",\"gain\":\"章节标题\"}";
      }
      return "";
    });
    const schema = `{ ${schemaParts.join(", ")} }`;
    const userMsg = `${dnaPromptBlock(a)}\n\n已有活动事实：${factsText}\n\n${stratTxt ? "内容策略：\n" + stratTxt + "\n\n" : ""}请严格补全以下空缺字段，每个字段都必须有有效内容，禁止空字符串或省略：${need.join("、")}。\n\n严格只返回如下 JSON：\n${schema}`;
    try {
      const json = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.7 });
      if (!json) return false;
      if (json.intro) a.intro = json.intro;
      if (json.hook) a.hook = json.hook;
      if (Array.isArray(json.body)) a.body = json.body.filter(Boolean);
      if (json.whyGo) a.whyGo = json.whyGo;
      if (json.experience) a.experience = json.experience;
      if (json.gain) a.gain = json.gain;
      if (json.fitFor) a.fitFor = json.fitFor;
      if (json.notFitFor) a.notFitFor = json.notFitFor;
      if (json.editorialTitle) a.editorialTitle = json.editorialTitle;
      if (json.pullQuote) a.pullQuote = json.pullQuote;
      if (json.posterTagline) a.posterTagline = json.posterTagline;
      if (json.storyPurpose) a.storyPurpose = json.storyPurpose;
      if (Array.isArray(json.photoCaptions)) a.photoCaptions = json.photoCaptions.filter(Boolean);
      if (json.sectionTitles && typeof json.sectionTitles === "object") a.sectionTitles = Object.assign(a.sectionTitles || {}, json.sectionTitles);
      return true;
    } catch (e) { console.error("补全叙事字段异常:", e); return false; }
  }

  // 为活动生成真实可执行的日程安排；只基于已确认事实，不编造服务/设施/领队行为
  async function generateItinerary(a) {
    if (!a) return false;
    if (!aiAuthMode()) return { _needKey: true };
    if (aiBalance() < AI_COST_PER_CALL) return { _noCredit: true };
    const days = Math.max(1, a.days || 1);
    const baseDate = parseDateBase(a.date || a.dateMD || "");
    const dateSub = (offset) => {
      if (!baseDate) return "";
      const d = addDays(baseDate, offset);
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    };
    const factsText = buildFactsText(a);
    const schema = [
      "{",
      `  "itineraryDays": [`,
      `    {"label": "${days > 1 ? "第 1 天" : "行程安排"}", "sub": "${dateSub(0)}", "items": [{"time": "08:00", "text": "集合出发"}, {"time": "12:00", "text": "途中简餐（以现场安排为准）"}]}` + (days > 1 ? "," : ""),
      (days > 1 ? `    {"label": "第 2 天", "sub": "${dateSub(1)}", "items": [{"time": "08:00", "text": "继续行程"}, {"time": "16:00", "text": "解散返程"}]}` : ""),
      `  ]`,
      "}"
    ].join("\n");
    const userMsg = `请为以下户外活动生成详细行程。\n\n【最高原则】\n- 必须严格依据已确认事实；未确认的具体时间、服务内容、设施、餐厅、领队动作不要编造。\n- 没有具体时间时，用“以领队现场安排为准”占位，不要写“专业护航”“全程保障”等无法验证的口号。\n- 总天数 ${days} 天，每天 4-8 个时间节点，时间段用 24 小时制（如 08:00）。\n\n已确认活动事实：\n${factsText}\n\n严格只返回如下 JSON Schema，不要输出任何额外文字或 Markdown：\n${schema}`;
    try {
      const json = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.6 });
      if (!json || !Array.isArray(json.itineraryDays)) return false;
      const out = [];
      for (let i = 0; i < days; i++) {
        const src = json.itineraryDays[i] || {};
        const items = (src.items || [])
          .map((it) => ({ time: String(it.time || "").trim(), text: String(it.text || "").trim() }))
          .filter((it) => it.time || it.text);
        out.push({
          label: String(src.label || (days > 1 ? `第 ${i + 1} 天` : "行程安排")).trim(),
          sub: String(src.sub || dateSub(i)).trim(),
          items: items.length ? items : [{ time: "", text: "行程待补充" }]
        });
      }
      if (!out.some((d) => d.items.some((it) => it.text && it.text !== "行程待补充"))) return false;
      a.itineraryDays = out;
      syncItineraryDays(a);
      consumeAi(AI_COST_PER_CALL, "AI 生成 · 行程");
      return true;
    } catch (e) { console.error("行程生成异常:", e); return false; }
  }

  // 兜底：若当前没有有效行程，自动调用 generateItinerary 补全
  async function ensureItineraryFields(a) {
    if (!a) return false;
    const hasItin = (a.itineraryDays || []).some((d) => (d.items || []).some((t) => t && (t.time || t.text)));
    if (hasItin) return true;
    return await generateItinerary(a);
  }

  const REGEN_FIELDS = {
    posterTagline: { label: "海报氛围标语", kind: "text", rule: "海报主标题下方的氛围标语。结合季节+时间+地点，16-36字，有户外向往感，不出现公里/价格/保险/年龄/人数等硬数据" },
    editorialTitle: { label: "故事区小标题", kind: "text", rule: "详情页故事区小标题（H2）。根据本次活动事实独创，禁止套用固定句式" },
    pullQuote: { label: "记忆句/金句", kind: "text", rule: "一句能让人记住的具体画面或判断，8-20字，不喊口号" },
    storyPurpose: { label: "照片故事主题", kind: "text", rule: "一句话说明这组照片应该呈现什么，8-20字，紧扣本次活动" },
    hook: { label: "开场钩子", kind: "text", rule: "详情页正文开场钩子，一句话（20-45字）。用只有这场活动才有的具体事实/画面/悬念开头，禁止口号/反问/想不想/空洞形容词" },
    intro: { label: "活动介绍/导语", kind: "text", rule: "120-200字。2-3个短段落：先事实定位，再写本场才有的具体画面，最后给决策信息。有吸引力但不油腻，禁止口号/反问/形容词堆砌" },
    photoCaptions: { label: "照片配文", kind: "list", rule: "每张照片一句配文，8-16字，紧扣场景" },
    body: { label: "正文段落", kind: "list", rule: "每段60-140字，用具体名词和动词写真实体验（出发准备/途中画面/某个细节），禁止形容词堆砌" },
    forewordTitles: { label: "标题备选", kind: "list", rule: "一次性给出 5 个像杂志专题一样的短标题，彼此必须明显不同（从不同角度切入：地点气质 / 季节体感 / 行动邀请 / 情绪画面 / 完成感），禁止只是换近义词或调整语序。严禁出现任何硬销信息：具体日期、人数限制、名额、价格、公里数、爬升米数、年龄、保险、集合时间、装备清单、报名/优惠/倒计时/仅限/只剩/只限等字样" }
  };
  function seasonOf(a) {
    const md = a.dateMD || "";
    const m = md.match(/(\d{1,2})月/);
    const mo = m ? +m[1] : (new Date().getMonth() + 1);
    if (mo >= 3 && mo <= 5) return "春季";
    if (mo >= 6 && mo <= 8) return "夏季";
    if (mo >= 9 && mo <= 11) return "秋季";
    return "冬季";
  }
  async function regenField(a, field) {
    if (!a || !REGEN_FIELDS[field]) return false;
    if (!aiAuthMode()) return { _needKey: true };
    // V2.0：先校验 AI 积分余额（不显 Token，只按「AI 积分」计量）
    if (aiBalance() < AI_COST_PER_CALL) return { _noCredit: true };
    const def = REGEN_FIELDS[field];
    const current = a[field];
    const ctx = {
      title: a.title, type: a.type, place: a.place, dateMD: a.dateMD,
      season: seasonOf(a), days: a.days, difficulty: a.difficulty,
      ageRange: a.ageRange, distance: a.distance, elevation: a.elevation
    };
    const isList = def.kind === "list";
    const cnt = isList ? (field === "forewordTitles" ? 5 : (Array.isArray(current) ? current.length : (field === "photoCaptions" ? (a.photos ? a.photos.length : 3) : 3))) : 0;
    const schemaItems = Array.from({ length: Math.max(cnt, 3) }, (_, i) => `"${def.label}${i + 1}"`).join(",");
    const schemaField = isList
      ? `{ "${field}": [${schemaItems}] }`
      : `{ "${field}": "${def.label}（${def.rule}）" }`;
    const currentRef = isList
      ? `当前已有版本（仅供参考，请勿重复，需全新角度）：${JSON.stringify(Array.isArray(current) ? current : [])}`
      : `当前已有版本（仅供参考，请勿重复，需全新角度）：${typeof current === "string" ? current : ""}`;
    const userMsg = `${dnaPromptBlock(a)}\n\n已有活动事实：${JSON.stringify(ctx)}\n\n请只重新生成「${def.label}」这一项。要求：${def.rule}。${currentRef}\n\n严格只返回如下 JSON Schema 中的一个字段：\n${schemaField}`;
    try {
      const json = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.85 });
      if (json == null) return false;
      if (isList) {
        if (Array.isArray(json[field]) && json[field].length) a[field] = json[field].filter(Boolean);
        else return false;
      } else {
        if (!json[field]) return false;
        a[field] = json[field];
      }
      if (field === "forewordTitles") {
        a[field] = fillTitlesFromPool(dedupeTitles(a[field]), a);
        const first = a[field][0] || a.title || "";
        a.titleVariants = { brand: first, info: first, wechat: first, xhs: first, moments: first };
      }
      consumeAi(AI_COST_PER_CALL, `AI 重写 · ${def.label}`);
      return true;
    } catch (e) { console.error("字段重生成异常:", e); return false; }
  }

  // 单个卖点重生成：只重写某一条 sellingPoint，要求与现有角度不同
  async function regenSellingPoint(a, idx) {
    if (!a || !Array.isArray(a.sellingPoints) || a.sellingPoints[idx] == null) return false;
    if (!aiAuthMode()) return { _needKey: true };
    if (aiBalance() < AI_COST_PER_CALL) return { _noCredit: true };
    const ctx = {
      title: a.title, type: a.type, place: a.place, dateMD: a.dateMD,
      season: seasonOf(a), days: a.days, difficulty: a.difficulty,
      ageRange: a.ageRange, distance: a.distance, elevation: a.elevation,
      meeting: a.meeting, meetTime: a.meetTime, price: a.price
    };
    const existing = a.sellingPoints.map((s, i) => (i === idx ? null : `${s.title || ""}｜${s.desc || ""}`)).filter(Boolean);
    const current = a.sellingPoints[idx];
    const userMsg = `${dnaPromptBlock(a)}\n\n已有活动事实：${JSON.stringify(ctx)}\n\n现有卖点（禁止重复或近义）：${existing.join("；") || "无"}\n\n请只重新生成第 ${idx + 1} 条卖点。要求：\n1. title 一句话事实点（8-20字），不要空泛形容词；\n2. desc 写清为什么这个点对用户重要（30-60字）；\n3. 必须与上面「现有卖点」角度明显不同；\n4. 从稀缺场景 / 真实体验 / 服务保障 / 季节时机 / 人群匹配 / 完成感 中任选一个不重复的角度。\n\n严格只返回如下 JSON Schema：\n{ "title": "卖点标题", "desc": "卖点描述" }`;
    try {
      const json = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.85 });
      if (json == null) return false;
      const title = String((json.title || json.sellingPointTitle || (typeof json === "string" ? json : "")) || "").trim();
      const desc = String((json.desc || json.sellingPointDesc || json.description || "") || "").trim();
      if (!title) return false;
      a.sellingPoints[idx] = { title, desc };
      // 同步 pipeline 形态
      a.pipeline = a.pipeline || { foreword: { titles: [] }, itinerary: { days: 1 }, details: {} };
      a.pipeline.sellingPoints = a.sellingPoints.map((s) => ({ title: String(s.title || ""), desc: String(s.desc || "") }));
      consumeAi(AI_COST_PER_CALL, "AI 重写 · 卖点");
      return true;
    } catch (e) { console.error("卖点重生成异常:", e); return false; }
  }

  // 单渠道分享文案重生成：只重写微信/朋友圈/小红书/公众号/口播中的一项
  const SHARE_COPY_CHANNELS = {
    wechat: { label: "微信群招募文案", style: "口语化，像发给微信群的招募通知。包含时间、地点、价格、报名召唤，不用标题党，不喊口号。" },
    moments: { label: "朋友圈文案", style: "适合配图发朋友圈，有画面感和轻微情绪，但不油腻、不堆砌形容词。" },
    xhs: { label: "小红书文案", style: "带 2-4 个相关话题标签（#xxx），口吻年轻、有场景感，避免过度营销感。" },
    gzh: { label: "公众号摘要", style: "正式一点的公众号摘要/导语，1-2 个短段落，有信息密度。" },
    voice: { label: "口播文案", style: "口语化，适合短视频口播或直播话术，自然、有节奏感。" }
  };
  async function regenShareCopy(a, type) {
    if (!a || !SHARE_COPY_CHANNELS[type]) return false;
    const key = "share" + type.charAt(0).toUpperCase() + type.slice(1);
    const keyDef = SHARE_COPY_CHANNELS[type];
    if (!aiAuthMode()) return { _needKey: true };
    const ctx = {
      title: a.title, type: a.type, place: a.place, dateMD: a.dateMD,
      days: a.days, difficulty: a.difficulty, price: a.price, limit: a.limit, limitUnit: a.limitUnit,
      ageRange: a.ageRange, distance: a.distance, elevation: a.elevation,
      meeting: a.meeting, meetTime: a.meetTime
    };
    const current = a[key] || "";
    const userMsg = `已有活动事实：${JSON.stringify(ctx)}\n\n请只重新生成「${keyDef.label}」。要求：${keyDef.style}。当前已有版本（仅供参考，请勿重复，可全新角度）：${current}\n\n严格只返回如下 JSON Schema 中的一个字段：\n{ "${type}": "${keyDef.label}内容" }`;
    try {
      const json = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.85 });
      if (json == null) return false;
      if (!json[type]) return false;
      a[key] = String(json[type]);
      saveState();
      return true;
    } catch (e) { console.error("分享文案重生成异常:", e); return false; }
  }

  // 事实派生的轻量同步（仅费用清单等，不含营销文案），替代旧 recompute
  function syncDerived(a) {
    const inc = [];
    if (a.includeLeader) inc.push("专业领队/向导");
    if (a.includeMeal) inc.push(a.type === "露营" ? "营地餐食" : "餐食");
    if (a.includeInsurance) inc.push("户外保险");
    if (a.includeTransport) inc.push("往返交通");
    if (a.includeGear) inc.push("活动装备");
    a.feeInclude = inc;
    a.activityDNA = buildActivityDNA(a); // P0-2：活动基因随派生同步刷新
  }

  function openAISettings() { showView("ai"); }

  function blankActivity() {
    return {
      id: uid(), title: "", titleCandidates: [], type: "户外探索", pageStyle: "outdoor", audience: [], place: "自然", date: "", dateMD: "", departures: [],
      ageFrom: 6, ageTo: 12, ageRange: "", price: null, originalPrice: null,
      limit: null, limitUnit: "人", meeting: "", meetTime: "", returnTime: "", distance: null, elevation: "",
      includeLeader: false, includeMeal: false, includeInsurance: false, includeTransport: false, includeGear: false,
      photos: [], videos: [], highlights: [], intro: "", hook: "", body: [], sellingPoints: [], editorialTitle: "", posterTagline: "", pullQuote: "", storyPurpose: "", photoCaptions: [], itineraryDays: [], feeInclude: [], feeExclude: [], subtitle: "", heroHook: "", sectionTitles: {}, whyGo: "", experience: "", gain: "", fitFor: "", notFitFor: "", socialCoreMessage: "", contentPlan: null, contentScore: null,
      route: "",
      gear: [], gearManual: [], days: 1, difficulty: "轻松", tags: [], deposit: null, transport: "", contact: "", priceTBD: false, priceNote: "", childPrice: null, leaderIds: [], leaderName: "", leaderYears: "", leaderCert: "", leaderTrips: "", reviews: [], feeSummary: "", headline: "",
      safety: [], notesType: "", shareWechat: "", shareMoments: "", shareXhs: "", shareGzh: "", shareVoice: "",
      notes: "出发前 3 天可全额退；前 1 天退 50%；当天不退，但可转让名额。",
      status: "draft", createdAt: Date.now(), signups: 0, raw: "",
      pinned: false, pinnedAt: 0, ageManual: false,
      contentDirections: [], contentDirection: 0, contentApproved: false,
      brandTone: "",
      editorialVariantId: "",
      editorialLayoutId: "",
      editorialStyleId: "",
      useMemberPrice: false, allowPoints: false, allowCoupons: false, tierPrices: {},
      // P0-17 独立的活动实际数据：与招募 facts 严格分离，由用户「补充资料」逐项确认填写。
      // 报名人数(registeredParticipants) ≠ 实际参与人数(actualParticipants)；未确认 actualParticipants 时回顾禁止写"XX人参加"。
      actualActivityData: {
        registeredParticipants: null, actualParticipants: null,
        actualWeather: "", actualHighlights: [], actualFeedback: [], memorableMoments: [],
        completionSummary: "", actualRouteChange: "",
      },
    };
  }

  function getActivity(id) { return state.activities.find((x) => x.id === id); }

  /* ---------------- mock AI ---------------- */
  /* ---------------- 活动类型知识库（规则引擎：优先关键词，不让 AI 自由猜测） ---------------- */
  const TYPE_RULES = [
    { type: "高海拔登山", kw: ["大峰", "二峰", "三峰", "雪山", "登顶", "冲顶", "攀登", "冰川", "垭口", "高原", "那玛峰", "贡嘎", "雨崩", "狼塔", "鳌太", "梅里", "珠峰", "乞力马扎罗", "哈巴雪山", "技术型雪山"] },
    { type: "滑雪", kw: ["滑雪", "雪场", "双板", "单板", "滑雪教学", "雪季", "开板", "滑雪营"] },
    { type: "攀岩", kw: ["攀岩", "攀冰", "岩壁", "抱石", "攀岩馆"] },
    { type: "骑行", kw: ["骑行", "自行车", "骑车", "单车", "公路车"] },
    { type: "桨板或皮划艇", kw: ["桨板", "皮划艇", "独木舟", "sup", "kayak"] },
    { type: "溯溪", kw: ["溯溪", "溪降", "溪谷", "玩水", "漂流"] },
    { type: "露营", kw: ["露营", "帐篷", "营地", "星空", "篝火", "天幕", "过夜营", "野营"] },
    { type: "跑步", kw: ["跑步", "马拉松", "越野跑", "夜跑", "晨跑"] },
    { type: "自驾旅行", kw: ["自驾", "开车", "房车", "自驾游"] },
    { type: "摄影旅行", kw: ["摄影", "旅拍", "风光摄影", "人像摄影", "扫街"] },
    { type: "企业团建", kw: ["团建", "拓展", "年会", "公司活动", "团队建设", "企业"] },
    { type: "研学", kw: ["研学", "自然教育", "夏令营", "冬令营", "独立营", "青少年营", "少年营"] },
    { type: "徒步", kw: ["徒步", "轻徒步", "穿越", "拉练", "步道", "徒步线路", "越野", "野路", "山脊", "爬山", "登山", "ridge", "trail", "登山徒步"] },
    { type: "城市旅行", kw: ["城市游", "城市旅行", "citywalk", "city walk", "夜景", "美食", "老街", "商圈", "博物馆", "步行街", "都市", "市区游", "周末游", "两日游", "三日游", "重庆", "上海", "北京", "西安", "长沙", "成都城区", "成都市区", "广州", "深圳", "杭州", "武汉", "南京", "苏州"] },
    { type: "景区观光", kw: ["景区", "观光", "打卡", "乐园", "古镇", "园林", "看展", "展览", "门票游", "周边游"] },
    { type: "综合旅行", kw: ["旅行", "游玩", "出游", "度假", "休闲游"] },
  ];
  const OUTDOOR_HARD = ["雪山", "登顶", "冲顶", "攀登", "冰川", "垭口", "高原", "大峰", "二峰", "三峰", "徒步", "爬山", "登山", "穿越", "拉练", "步道", "越野", "野路", "山脊", "露营", "帐篷", "营地", "滑雪", "雪场", "攀岩", "攀冰", "骑行", "自行车", "桨板", "皮划艇", "溯溪", "溪降", "跑步", "马拉松", "自驾", "摄影", "团建", "研学", "夏令营", "冬令营"];
  const PAGE_STYLE_MAP = {
    "城市旅行": "city", "景区观光": "sight", "徒步": "hike", "高海拔登山": "alpine", "露营": "camp",
    "亲子活动": "kids", "研学": "kids", "滑雪": "ski", "骑行": "cycling", "跑步": "run", "漂流": "water",
    "攀岩": "climb", "桨板或皮划艇": "water", "溯溪": "water", "自驾旅行": "drive",
    "摄影旅行": "photo", "企业团建": "team", "综合旅行": "travel", "户外探索": "outdoor",
  };
  // 编辑器下拉选项：value 为内部标准类型，label 为界面友好名称
  const TYPE_OPTIONS = [
    { value: "亲子活动", label: "亲子户外" },
    { value: "徒步", label: "徒步登山" },
    { value: "高海拔登山", label: "高海拔登山" },
    { value: "骑行", label: "骑行" },
    { value: "滑雪", label: "滑雪" },
    { value: "溯溪", label: "溯溪/漂流" },
    { value: "桨板或皮划艇", label: "桨板/皮划艇" },
    { value: "露营", label: "营地/露营" },
    { value: "城市旅行", label: "城市漫游" },
    { value: "景区观光", label: "景区观光" },
    { value: "摄影旅行", label: "摄影旅行" },
    { value: "企业团建", label: "企业团建" },
    { value: "综合旅行", label: "综合旅行" },
    { value: "户外探索", label: "户外探索" }
  ];
  // 高风险地点仅作参考；年龄 / 难度收紧必须结合「强风险关键词 + 海拔 + 天数 + 距离」综合判断，不能只凭地点名称
  const HIGH_RISK_PLACES = ["牛背山", "四姑娘山", "四姑娘", "哈巴雪山", "哈巴", "贡嘎", "雨崩", "狼塔", "鳌太", "梅里", "珠峰", "乞力马扎罗", "那玛峰", "华山", "黄山", "泰山", "峨眉山", "青城山", "青城后山", "赵公山", "鹤鸣山", "虹口"];
  // 强风险关键词：只有活动文本命中这些词才上调年龄 / 难度（如「大峰登顶」才算高风险；双桥沟观光、青城山亲子徒步都不算）
;
  const CITY_NAMES = ["重庆", "上海", "北京", "西安", "长沙", "成都城区", "成都市区", "广州", "深圳", "杭州", "武汉", "南京", "苏州", "成都", "天津", "青岛", "厦门", "昆明"];

  // 编辑器下拉框选项可能与内部标准类型名称不同，统一映射到标准类型
  function normalizeType(t) {
    const map = {
      "徒步登山": "徒步",
      "漂流": "溯溪",
      "营地": "露营",
      "亲子户外": "亲子活动",
    };
    return map[t] || t;
  }
  // 风险年龄收紧：须同时满足「户外类活动」+（强风险关键词 或 高海拔≥3500 或 长线≥15km 或 多日≥3天），不单凭地点名称



  function parseDatePhrase(a, text) {
    let m;
    if ((m = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/))) {
      a.date = `${curYear()}年${m[1]}月${m[2]}日`;
      a.dateMD = `${m[1]}月${m[2]}日`;
    } else {
      const resolved = resolveRelativeDate(text);
      if (resolved) { a.date = resolved; a.dateMD = toDateMD(resolved); }
    }
    // 首次识别日期时，把单日期自动写入团期数组
    if (a.date && (!a.departures || !a.departures.length)) {
      const d = departureFromDate(a.date, a.price);
      if (d) a.departures = [d];
    }
  }



  // 自动难度评估：根据类型 + 距离 + 天数，免去老板手动评级


  // 按「活动类型 + 风险度 + 地点风险」自动推荐适合年龄段（用户可在编辑器手动覆盖）


  // 当类型/天数/距离/海拔等事实变化时，重新评估难度与年龄（用户手动改过年龄则保留）


  function parseAgeRange(a, text) {
    const t = text != null ? text : a.ageRange || "";
    let m;
    if ((m = t.match(/(\d{1,2})\s*[-—~至到]\s*(\d{1,2})\s*岁?/))) { a.ageFrom = +m[1]; a.ageTo = +m[2]; a.ageRange = `${m[1]}—${m[2]}岁`; a.ageManual = true; }
    else if ((m = t.match(/(\d{1,2})\s*岁以上/))) { a.ageFrom = +m[1]; a.ageTo = 99; a.ageRange = `${m[1]}岁以上`; a.ageManual = true; }
    else if ((m = t.match(/(\d{1,2})\s*岁/))) { a.ageFrom = +m[1]; a.ageTo = +m[1]; a.ageRange = `${m[1]}岁`; a.ageManual = true; }
    else if ((m = t.match(/^(\d{1,2})$/))) { a.ageFrom = +m[1]; a.ageTo = 99; a.ageRange = `${m[1]}岁以上`; a.ageManual = true; }
  }

  function isFamilyActivity(a) {
    // 人群标签由规则引擎统一判定：亲子 / 研学 / 团队 / 成人 / 通用
    if (!a) return false;
    // 显式成人/非亲子输入优先，不因默认推断错判为亲子
    if (a.raw && /成人|非亲子|年轻化|不含儿童|仅成人/.test(a.raw)) return false;
    if (a.audience && a.audience.includes("亲子")) return true;
    if (a.type === "亲子活动" || a.type === "研学") return true;
    if (a.raw && /亲子|儿童|孩子|少年|家庭/.test(a.raw)) return true;
    // 仅当年龄区间明确出现亲子/儿童/少年/孩子时才算亲子；成人向的“X岁以上/16—55岁”不应被误判
    if (a.ageRange && /亲子|儿童|少年|孩子/.test(a.ageRange)) return true;
    return false;
  }
  function audienceLabel(a) {
    if (!a.audience || !a.audience.length) return "";
    if (a.audience.includes("亲子")) return "亲子";
    if (a.audience.includes("研学")) return "研学";
    if (a.audience.includes("团队")) return "团队";
    if (a.audience.includes("成人")) return "成人";
    return "通用";
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }




  /* V1.8 地点季节语料：让介绍文案扎根于真实地点与当季氛围。 */
  const SEASON_MONTHS = { spring:[3,4,5], summer:[6,7,8], autumn:[9,10,11], winter:[12,1,2] };
  function seasonKeyFromMonth(m) {
    for (const k in SEASON_MONTHS) if (SEASON_MONTHS[k].includes(m)) return k;
    return "spring";
  }
  function seasonFromActivity(a) {
    const d = a.date || a.dateMD || "";
    const m = d.match(/(\d{1,2})月/); if (m) return seasonKeyFromMonth(+m[1]);
    const dt = a.startDate ? new Date(a.startDate) : (a.date ? new Date(a.date) : null);
    if (dt && !isNaN(dt)) return seasonKeyFromMonth(dt.getMonth()+1);
    return seasonKeyFromMonth(new Date().getMonth()+1);
  }
  const PLACE_DB = {
    "都江堰": {
      aliases:["都江堰","青城山","虹口","龙池","赵公山","熊猫谷"],
      season:{
        spring:"春水涨满时，都江堰的山道刚被新绿洗过一遍。",
        summer:"暑气正盛的八月，青城山下的溪风比城里低好几度。",
        autumn:"秋意渐起，银杏和红叶把都江堰的山路铺成暖色调。",
        winter:"冬天的人少，山更静，都江堰的云雾像一层轻纱。"
      },
      vibe:"两千年的水利沉稳，和青城山道的清幽，都在这里。"
    },
    "成都": {
      aliases:["成都","天府新区","龙泉山","金堂","大邑","邛崃","崇州"],
      season:{
        spring:"成都的春天很短，短到值得用一场户外去认真接住。",
        summer:"成都夏天的余热，最适合交给山里的一场凉风。",
        autumn:"秋天的成都，天空和银杏一起变高。",
        winter:"冬天出太阳的日子，成都人都在往山里跑。"
      },
      vibe:"离城市不远，但离日常很远。"
    },
    "川西": {
      aliases:["川西","贡嘎","四姑娘山","毕棚沟","达瓦更扎","冷嘎措","稻城亚丁","海螺沟","牛背山","西岭雪山"],
      season:{
        spring:"高原的春天来得晚，但来得格外认真。",
        summer:"川西的夏天是流动的，草甸、花海和云影都在路上。",
        autumn:"秋天是川西的高光时刻，每一寸山色都是礼物。",
        winter:"冬天的川西很安静，雪山把天地都擦干净。"
      },
      vibe:"高原、雪山与风，是川西最直接的表达。"
    },
    "云南": {
      aliases:["云南","大理","丽江","香格里拉","泸沽湖","西双版纳","腾冲"],
      season:{
        spring:"云南的春天没有边界，花开到哪，路就延伸到哪。",
        summer:"夏天的云南是凉快的，云低得像是伸手就能够到。",
        autumn:"秋天的云南日光很长，适合慢慢走。",
        winter:"冬天的云南依旧温和，阳光是最好的行李。"
      },
      vibe:"去云南，就是把时间调慢一点。"
    },
    "贵州": {
      aliases:["贵州","贵阳","荔波","黔东南","铜仁","安顺"],
      season:{
        spring:"贵州的春天藏在山坳里，一转弯就是一片新绿。",
        summer:"夏天的贵州是天然的凉棚，瀑布和溶洞都在降温。",
        autumn:"秋天的贵州，梯田和村寨一起变颜色。",
        winter:"冬天的贵州多雨雾，山像水墨一样淡。"
      },
      vibe:"贵州的山，一层叠着一层，藏着不少秘密。"
    },
    "西藏": {
      aliases:["西藏","拉萨","林芝","阿里","珠峰","羊湖","纳木错"],
      season:{
        spring:"西藏的春天从林芝开始，桃花一路开到雪山脚下。",
        summer:"夏天的西藏氧气足、云多，是入藏最稳妥的季节。",
        autumn:"秋天的西藏干燥晴朗，能见度和心情一样好。",
        winter:"冬天的西藏游客少，阳光却把雪地照得很暖。"
      },
      vibe:"西藏不在 checklist 上，它在心里慢慢展开。"
    },
    "新疆": {
      aliases:["新疆","伊犁","喀纳斯","喀什","赛里木湖","独库公路"],
      season:{
        spring:"新疆的春天从伊犁的杏花开始，一路向北铺开。",
        summer:"夏天的新疆白天很长，草原和湖泊都在发光。",
        autumn:"秋天的喀纳斯，是新疆写给世界的一封情书。",
        winter:"冬天的新疆是雪的故乡，安静得像童话。"
      },
      vibe:"新疆的远，是风景的第一道门槛。"
    },
    "海南": {
      aliases:["海南","三亚","万宁","文昌","陵水"],
      season:{
        spring:"海南的春天和夏天很像，海是永远的背景。",
        summer:"夏天的海南浪大、云多，是玩海的好时候。",
        autumn:"秋天的海南少了暑期人潮，海更自在。",
        winter:"冬天的海南是很多人的季节转换器。"
      },
      vibe:"海南的方向，永远朝着海。"
    },
    "default": {
      season:{ spring:"这个时节的山野，刚好适合出门。", summer:"夏天 outdoors，风比空调更解闷。", autumn:"秋天的户外，每一口空气都清爽。", winter:"冬天出门需要一点勇气，但风景值得。" },
      vibe:"出门这件事，本身就是目的地。"
    }
  };
  function matchPlace(a) {
    const p = (a.place || "") + " " + (a.meeting || "") + " " + (a.title || "");
    const norm = p.replace(/后(?=山)|前(?=山)|景区|风景区|森林公园|地质公园|大峡谷/g, "");
    for (const key in PLACE_DB) {
      if (key === "default") continue;
      if (PLACE_DB[key].aliases.some((al)=>p.includes(al) || norm.includes(al))) return PLACE_DB[key];
    }
    return PLACE_DB.default;
  }
  function placeFlavorFor(a) {
    const rec = matchPlace(a);
    const s = seasonFromActivity(a);
    return { seasonLine: (rec.season[s] || rec.season.spring || PLACE_DB.default.season[s]), localVibe: rec.vibe || PLACE_DB.default.vibe };
  }

  /* V1.3 内容策略层：只改变表达，不增加活动事实。 */
  /* ===== V2.0 事实层：规则引擎负责事实，每个字段记录来源状态 =====
     status: confirmed(老板输入/确认) / inferred(规则推断，发布前须确认) / missing(缺失) / not_applicable(不适用)
     source: owner_input / owner_confirmed / rule_inferred / ""                                */
  /* 活动难度自动匹配：按活动类型 / 路线距离 / 海拔推断一个初始难度（老板可在编辑页手动改） */
  function inferDifficulty(a) {
    const t = (a.type || "") + " " + (a.title || "");
    const dist = parseFloat(a.distance) || 0;
    const elev = parseFloat(a.elevation) || 0;
    if (/亲子|研学|自然|儿童|露营|营地|古镇|休闲|采摘|夜游|公园/.test(t)) return "轻松";
    if (/高海拔|雪山|越野|重装|穿越|攀冰|攀岩|登顶/.test(t) || elev >= 3500 || dist >= 20) return "挑战";
    if (/登山|徒步|溯溪|漂流|水上|骑行/.test(t)) return (dist >= 15 || elev >= 2500) ? "挑战" : "中等";
    if (dist >= 15) return "挑战";
    if (dist >= 8) return "中等";
    return "中等";
  }
  /* ===== P0-2 Activity DNA（活动基因） =====
     由「事实 + 抽象启发式」派生的活动画像，驱动内容角度 / 视觉 / 章节结构 / 图片策略。
     每位带 evidence（依据）；只输出抽象方向，不创造具体景观、天气或现场事件。 */
  const DNA_ENV_RULES = [
    { key: "snow", label: "雪山地貌", kw: ["雪山", "冰川", "高海拔", "雪线", "雪场", "垭口", "登顶", "冲顶"] },
    { key: "canyon", label: "峡谷沟壑", kw: ["峡谷", "大峡谷", "沟", "塬", "峡", "崖"] },
    { key: "water", label: "溪流水域", kw: ["溪", "溯溪", "漂流", "水上", "桨板", "湖", "水库", "河", "瀑布", "皮划艇", "冲浪", "海岸"] },
    { key: "meadow", label: "草甸花野", kw: ["草原", "草甸", "花海", "花田", "梯田", "牧场", "牧"] },
    { key: "forest", label: "森林林间", kw: ["林", "森林", "松", "竹", "杉", "银杏", "红叶", "彩林", "叶"] },
    { key: "coast", label: "海岸海岛", kw: ["海", "岛", "沙滩", "礁"] },
    { key: "urban", label: "城郊人文", kw: ["古镇", "古城", "公园", "城市", "街区", "夜市", "博物馆", "寺庙", "村"] },
    { key: "mountain", label: "山脊山地", kw: ["山", "峰", "岭", "脊", "垭口"] },
  ];
  const DNA_FORM_LABELS = { hike: "徒步行走", mountain: "山地挑战", water: "水上玩乐", camp: "营地露营", family: "亲子自然", ride: "骑行", photo: "风光摄影", culture: "城郊人文", explore: "户外探索" };
  const DNA_MOTIVATION_LABELS = { scenery: "看风景", sport: "运动舒展", social: "社交相聚", family: "亲子陪伴", healing: "放松治愈", challenge: "挑战自我", photo: "摄影出片", release: "清凉释放" };
  function seasonOf(a) {
    const ds = ((a && (a.dateMD || a.date)) || "").trim();
    if (!ds) return "";
    let mo = 0, m;
    m = ds.match(/(\d{4})\s*[-/年]\s*(\d{1,2})/);          // 2026-10-20 / 2026年10月
    if (m) mo = +m[2];
    else { m = ds.match(/(\d{1,2})\s*月/); if (m) mo = +m[1]; } // 10月20日
    if (!mo) { m = ds.match(/^(\d{1,2})\s*[-/]\s*\d{1,2}$/); if (m) mo = +m[1]; } // 10/20
    if (!mo || mo < 1 || mo > 12) return "";
    if (mo >= 3 && mo <= 5) return "春季";
    if (mo >= 6 && mo <= 8) return "夏季";
    if (mo >= 9 && mo <= 11) return "秋季";
    return "冬季";
  }
  /* ===== P0-A（v193）Activity DNA 事实边界 =====
     DNA 拆两层：① Fact-grounded DNA（可参与事实表达）② Creative Context（只影响表达方式）。
     groundedScenes 只有 4 个受控来源：
       Source A 用户明确输入 ｜ Source B 行程明确出现 ｜ Source C 图片真实 Vision 识别 ｜ Source D 老板手动确认。
     禁止：秋季森林→一定有红叶 / 夏季溪谷→一定下水 / 露营→一定有篝火 /
           高山→一定有云海 / 冬季→一定有雪 / 高海拔→一定登顶。 */
  const GROUNDED_SCENE_LEXICON = [
    { scene: "红叶", kw: ["红叶", "红枫", "枫叶", "秋叶", "叶子红了"] },
    { scene: "彩林", kw: ["彩林", "彩叶", "层林尽染", "金色林", "金黄林"] },
    { scene: "落叶", kw: ["落叶", "叶雨"] },
    { scene: "溪水", kw: ["溪水", "溪流", "溯溪", "戏水", "玩水", "泡水", "下水", "踩水"] },
    { scene: "瀑布", kw: ["瀑布", "跌水"] },
    { scene: "雪景", kw: ["雪景", "雪线", "积雪", "雪坡", "下雪", "雪地", "雪山"] },
    { scene: "云海", kw: ["云海", "云瀑"] },
    { scene: "篝火", kw: ["篝火", "营火", "火堆"] },
    { scene: "星空", kw: ["星空", "银河", "星轨", "星河", "观星"] },
    { scene: "野花", kw: ["野花", "花海", "花田"] },
    { scene: "日出日落", kw: ["日出", "日落", "朝霞", "晚霞"] },
    { scene: "草甸", kw: ["草甸", "高山草", "草原"] },
    { scene: "露营", kw: ["帐篷", "营地", "露营"] },
    { scene: "海景", kw: ["海浪", "海边", "沙滩", "潮水", "礁石"] },
    { scene: "晨雾", kw: ["晨雾", "云影", "雾凇"] },
  ];
  const GROUNDED_SOURCE_LABEL = {
    user_input: "老板明确输入", itinerary: "行程明确出现",
    vision: "图片真实识别", owner_confirmed: "老板手动确认"
  };
  function groundedAdd(out, seen, scene, source, confidence, evidenceText) {
    if (!scene || seen[scene]) return;
    seen[scene] = true;
    out.push({ scene: scene, source: source, confidence: (confidence == null ? 1 : Number(confidence)), evidence: evidenceText || "" });
  }
  function groundedScan(out, seen, text, source, label) {
    if (!text) return;
    const str = String(text);
    GROUNDED_SCENE_LEXICON.forEach(function (g) {
      const hit = g.kw.filter(function (k) { return str.indexOf(k) >= 0; })[0];
      if (hit) groundedAdd(out, seen, g.scene, source, source === "vision" ? 0.9 : 1, label + "：" + hit);
    });
  }
  /* 汇总 4 个受控来源；photos 传入时额外采纳真实 Vision 识别结果（Source C） */
  function collectGroundedScenes(a, photos) {
    a = a || {};
    const out = [], seen = {};
    // Source A：用户明确输入（老板自己写的字）
    groundedScan(out, seen, [a.raw, a.title, a.intro, a.whyGo, a.experience, a.gain, a.notes].filter(Boolean).join(" "), "user_input", "老板输入");
    groundedScan(out, seen, (a.body || []).join(" "), "user_input", "老板输入正文");
    groundedScan(out, seen, (a.highlights || []).map(function (h) { return Array.isArray(h) ? h[0] : h; }).join(" "), "user_input", "亮点");
    groundedScan(out, seen, (a.sellingPoints || []).map(function (x) { return x && ((x.title || "") + " " + (x.desc || "")); }).join(" "), "user_input", "卖点");
    // Source B：行程明确出现
    groundedScan(out, seen, (a.itineraryDays || []).map(function (d) {
      return ((d && d.label) || "") + " " + ((d && d.sub) || "") + " " + ((d && d.items) || []).map(function (i) { return i && (i.text || i.title || ""); }).join(" ");
    }).join(" "), "itinerary", "行程");
    // Source C：图片真实 Vision 识别（只证明「素材里有什么」，不证明活动当天发生了什么）
    const vtags = (typeof visionGroundingTags === "function") ? visionGroundingTags(photos || a.photos || []) : [];
    vtags.forEach(function (t) { groundedAdd(out, seen, t.scene, "vision", t.confidence, "图片识别：" + t.scene); });
    // Source D：老板手动确认（确认卡 / 手动补充）
    (a.confirmedScenes || []).forEach(function (x) {
      groundedAdd(out, seen, (typeof x === "string" ? x : (x && x.scene)), "owner_confirmed", 1, "老板确认");
    });
    return out;
  }
  /* P0-A：季节只影响「情绪 / 配色 / 节奏」，不得自动生成现场事实（disclaimer 固定 creative_only） */
  function seasonalCreativeContextFor(a) {
    const s = seasonOf(a || {});
    const MOOD = {
      "春": { mood: ["苏醒", "轻快", "新绿"], palette: ["嫩绿", "浅灰蓝"], rhythm: "轻快" },
      "夏": { mood: ["通透", "清爽", "旺盛"], palette: ["深绿", "水蓝"], rhythm: "舒展" },
      "秋": { mood: ["清爽", "成熟", "层次感"], palette: ["暖色", "大地色"], rhythm: "舒展" },
      "冬": { mood: ["克制", "安静", "清晰"], palette: ["冷灰", "素白"], rhythm: "缓慢" }
    };
    const key = String(s || "").replace("季", "").slice(0, 1);
    const m = MOOD[key] || { mood: ["真实", "自然"], palette: ["中性色"], rhythm: "自然" };
    return { season: s || "", mood: m.mood.slice(), palette: m.palette.slice(), rhythm: m.rhythm, disclaimer: "creative_only" };
  }
  function seasonalCreativeContextOf(a) {
    if (a && a.activityDNA && a.activityDNA.seasonalCreativeContext) return a.activityDNA.seasonalCreativeContext;
    return seasonalCreativeContextFor(a || {});
  }

  function buildActivityDNA(a, photos) {
    a = a || {};
    const t = ((a.type || "") + " " + (a.title || "") + " " + (a.raw || "") + " " + ((a.gear || []).map((g) => g && (g.name || g)).join(" ")) + " " + (a.audience || []).join("")).toLowerCase();
    const placeText = (a.place || "") + " " + (a.title || "") + " " + (a.raw || "");
    const facts = (typeof factRegistry === "function") ? factRegistry(a) : [];
    const evidence = {};

    // activityForm 活动形式（弱先验）
    let activityForm = "explore";
    if (/亲子|研学|儿童|少儿|自然教育|家庭/.test(t)) activityForm = "family";
    else if (/桨板|皮划艇|冲浪|漂流|溯溪|溪降|水上|独木舟|kayak/.test(t)) activityForm = "water";
    else if (/露营|营地|星空|篝火|音乐节|派对/.test(t)) activityForm = "camp";
    else if (/雪山|高海拔|越野|重装|穿越|攀冰|攀岩|登顶|冲顶|技术型/.test(t)) activityForm = "mountain";
    else if (/骑行|单车|公路车|摩托/.test(t)) activityForm = "ride";
    else if (/摄影|出片|风光|银河|星轨/.test(t)) activityForm = "photo";
    else if (/古镇|人文|寺庙|citywalk|博物馆|城市|采摘|公园/.test(t)) activityForm = "culture";
    else if (/徒步|登山|穿越|行走|健行/.test(t)) activityForm = "hike";
    evidence.activityForm = /亲子|桨板|露营|雪山|骑行|摄影|古镇|徒步/.test(t) ? "类型/标题关键词" : "默认（未识别具体形式）";

    // environment 环境地貌（仅取地点/标题线索，不臆造）
    let environment = "unspecified", environmentLabel = "";
    for (const r of DNA_ENV_RULES) { if (r.kw.some((k) => placeText.includes(k))) { environment = r.key; environmentLabel = r.label; break; } }
    evidence.environment = environment === "unspecified" ? "地点/标题无可用地貌线索" : "地点/标题关键词";

    // intensity 强度
    const dist = parseFloat(a.distance) || 0, elev = parseFloat(a.elevation) || 0;
    const diff = a.difficulty || "";
    let intensity;
    if (/挑战|专业|高强度/.test(diff) || dist >= 15 || elev >= 2500) intensity = "challenge";
    else if (/中等|进阶/.test(diff) || dist >= 8 || elev >= 800) intensity = "medium";
    else if (/轻松|入门|休闲|亲子/.test(diff)) intensity = "light";
    else intensity = (activityForm === "family" || activityForm === "camp" || activityForm === "culture") ? "light" : "medium";
    evidence.intensity = (a.difficulty ? "难度=" + a.difficulty : "无难度字段") + (dist ? " / 距离=" + dist + "km" : "") + (elev ? " / 海拔=" + elev + "m" : "");

    // season 季节
    const season = seasonOf(a);
    evidence.season = (a.date || a.dateMD) ? "活动日期" : "无日期";

    // P0-A：已确认场景（只有受控来源才能进入事实层）
    const groundedScenesRaw = collectGroundedScenes(a, photos);
    const groundedNames = groundedScenesRaw.map(function (g) { return g.scene; });
    const groundedHas = function (kw) {
      return groundedNames.some(function (n) { return kw.indexOf(n) >= 0 || n.indexOf(kw) >= 0; });
    };

    // coreMotivation 核心动机
    let coreMotivation = "scenery";
    if (activityForm === "family") coreMotivation = "family";
    else if (activityForm === "mountain" || intensity === "challenge") coreMotivation = "challenge";
    else if (activityForm === "camp") coreMotivation = "social";
    else if (activityForm === "photo") coreMotivation = "photo";
    else if (activityForm === "water") coreMotivation = "release";
    else if (environment === "water" && /清凉|溯溪|溪|水|夏/.test((season || "") + " " + t)) coreMotivation = "release";
    else if (/治愈|放松|冥想|减压|慢生活|疗愈/.test(t)) coreMotivation = "healing";
    else if (/社交|交友|团建|脱单|聚会/.test(t)) coreMotivation = "social";
    else if (/运动|健身|拉练|体能/.test(t)) coreMotivation = "sport";
    evidence.coreMotivation = "由活动形式 + 强度 + 关键词派生";

    // socialLevel 社交形态
    const aud = (a.audience || []).join("");
    let socialLevel = "small";
    if (activityForm === "family" || /亲子|家庭|儿童/.test(aud + t)) socialLevel = "family";
    else if (/团建|企业|团体|班级/.test(t)) socialLevel = "group";
    else if (/独行|单人|solo/.test(t)) socialLevel = "solo";
    else if (/社交|交友|脱单/.test(t)) socialLevel = "social";
    evidence.socialLevel = aud ? "参与人群=" + aud : "由类型关键词派生";

    // challengeLevel / professionalLevel
    const challengeLevel = intensity === "challenge" ? "high" : (intensity === "medium" ? "mid" : "low");
    let professionalLevel = "casual";
    const gearRisk = (a.gear || []).map((g) => (g && g.riskLevel) || "").join("");
    if (/L3/.test(gearRisk) || /攀岩|攀冰|雪山|技术型|绳索|头盔|安全带/.test(t)) professionalLevel = "technical";
    else if (intensity !== "light" || /登山|徒步|溯溪/.test(t)) professionalLevel = "standard";
    evidence.professionalLevel = gearRisk ? "装备等级=" + gearRisk : "由活动形式/强度派生";

    // visualPotential 视觉潜能（不臆造景观）
    let visualPotential = "medium";
    if (["snow", "canyon", "water", "meadow", "forest", "coast", "mountain"].includes(environment)) visualPotential = "high";
    else if (environment === "unspecified") visualPotential = "medium";
    evidence.visualPotential = environment === "unspecified" ? "无地貌线索，保守给 medium" : "由地貌推断";

    // targetAudience
    const ageTxt = a.ageRange || "";
    let targetAudience;
    if (activityForm === "family") targetAudience = (ageTxt ? ageTxt + " 孩子的家庭" : "亲子家庭");
    else if (intensity === "challenge") targetAudience = "有训练基础的户外爱好者";
    else if (activityForm === "camp") targetAudience = "想松弛社交的年轻都市人";
    else if (activityForm === "water") targetAudience = "想痛快玩水的户外新人";
    else if (/老驴|进阶|专业级/.test(t)) targetAudience = "有经验的户外玩家";
    else targetAudience = "城市通勤人群";
    evidence.targetAudience = (aud || a.ageRange) ? "参与人群/年龄字段" : "由活动形式派生";

    // tripRhythm 行程节奏
    const days = +a.days || 1;
    const itinDays = (a.itineraryDays || []).filter((d) => (d.items || []).some((x) => x && (x.time || x.text))).length;
    const tripRhythm = days >= 3 ? "multi_day" : (days === 2 ? "overnight" : "single_day");
    evidence.tripRhythm = "天数=" + days + (itinDays ? " / 已填行程=" + itinDays + "天" : "");

    // commercialAngle 商业角度
    const price = a.price;
    let commercialAngle = "experience_value";
    if (price != null && price <= 120 && tripRhythm === "single_day") commercialAngle = "low_decision";
    else if (price != null && price >= 600) commercialAngle = "premium";
    else if (activityForm === "family") commercialAngle = "family_value";
    evidence.commercialAngle = price != null ? "价格=¥" + price + " / 天数=" + days : "无价格，按默认体验价值";

    // ---- P0-2 差异化描述符：由 12 维组合派生，真正驱动文案差异 ----
    // 目的：同样「徒步」，秋彩林 / 夏溪谷 / 雪山 / 亲子 产出不同 sceneSignature / copyAngles / toneWords
    const DNA_SCENE_BY_ENV = {
      snow: { winter: "仰头是刃脊般的雪线，山风把云层撕开一道缝，脚下的碎石随每一步松动", autumn: "秋阳斜打在雪坡上，雪线以上白得晃眼，雪线以下是大片金黄", default: "雪线之上世界只剩呼吸和脚步，风声比人声更清楚" },
      forest: { autumn: "脚下是铺满红黄落叶的木栈道，头上是层叠的彩林，风一过就落一阵叶雨", summer: "林子里绿得发亮，蝉声把暑气挡在树冠之外", default: "树影浓得化不开，呼吸里全是松脂和湿土的味道" },
      water: { summer: "把脚泡进溪水里，暑气立刻被冲散，水花溅在小腿上发亮", autumn: "溪水瘦了一圈，卵石露出来，岸边的芦苇白了头", default: "踩进齐踝的溪水，凉意顺着脚踝往上爬，两岸是浓绿的灌木" },
      meadow: { summer: "草甸被晒得暖烘烘的，野花铺到天边", autumn: "草色转黄，风一过就是一片起伏的金浪", default: "草甸一直铺到天边，云影在绿浪上慢慢挪" },
      canyon: { default: "两壁夹出一线天，阳光只在正午漏进来一小块" },
      coast: { summer: "海风裹着咸味扑过来，浪把脚印一遍遍抹平", default: "潮水退去，礁石上留着一窝窝小海鲜" },
      mountain: { default: "山脊在云里时隐时现，每转一个弯就换一幅远景" },
      urban: { default: "巷子深处飘出饭菜香，老墙根的猫比你更懂慢生活" },
      unspecified: { default: "路在脚下慢慢铺开，沿途的风景还没被名字定义" }
    };
    const envSceneMap = DNA_SCENE_BY_ENV[environment] || DNA_SCENE_BY_ENV.unspecified;
    /* —— P0-A 事实边界 ——
       environment + season 只能决定「创意气质（visualMood）」，不得自动生成现场画面。
       只有 groundedScenes 里确实存在该地貌的具体物象时，才允许把画面写进正文；
       否则 sceneSignature 留空，文案退回中性表达。
       Case 1：10月青城山徒步（无照片无红叶信息）→ 不得写「漫山红叶铺满山路」。 */
    const SCENE_NEEDS = {
      snow: ["雪景"], forest: ["红叶", "彩林", "落叶"], water: ["溪水", "瀑布"],
      meadow: ["草甸", "野花"], canyon: [], coast: ["海景"], mountain: ["云海"], urban: []
    };
    const needScenes = SCENE_NEEDS[environment] || [];
    const sceneGrounded = needScenes.length ? needScenes.some(function (n) { return groundedHas(n); }) : false;
    const visualMood = (season && envSceneMap[season]) ? envSceneMap[season] : (envSceneMap.default || "");
    const sceneSignature = sceneGrounded ? visualMood : "";

    const DNA_THEME = {
      hike: { scenery: "把脚步交给风景，让路自己说话", healing: "在林子里把城市调成静音", sport: "用双腿重新丈量山野", social: "和同频的人走同一条路", default: "走一段少有人走的路" },
      mountain: { challenge: "往更高处走一遭", sport: "把体力推过临界点", default: "山就在那里，去靠近它" },
      water: { release: "把这一季的燥热交给水", sport: "让水流替你冲掉疲惫", default: "顺着水走，凉意一路相随" },
      camp: { social: "把聚会搬到山野的夜色里", healing: "在营地的暖光里把时钟调慢", default: "把卧室搬到山野里" },
      family: { family: "把第一次山野，留给孩子", default: "陪孩子，认识世界的第一页" },
      ride: { sport: "用车轮丈量风的形状", default: "风从耳边过，路在轮下长" },
      photo: { photo: "等一束光，等一片云", default: "把镜头对准没人去的角度" },
      culture: { healing: "在老街旧物里，把节奏慢下来", default: "在城郊的旧时光里走神" },
      explore: { default: "去地图边缘，看看没被命名的地方" }
    };
    const themeMap = DNA_THEME[activityForm] || DNA_THEME.explore;
    const mainTheme = themeMap[coreMotivation] || themeMap.default || "走一段值得记住的路";

    const DNA_ANGLES_BY_MOTIV = {
      scenery: ["把镜头交给沿途，不赶路", "用脚步丈量一条小众路线", "把看过变成走过"],
      healing: ["把手机调成飞行模式，听林子说话", "允许自己什么都不做，只是待着", "让山野替你按下重启键"],
      release: ["把这一趟走成一次彻底的深呼吸", "让身心重新回到更轻的状态", "把一整个夏天的燥热留在路上"],
      challenge: ["把体力推到临界点，再往上前一步", "走到筋疲力尽那一刻，答案自己出现", "用坚持换一段只有走到的人才知道的视野"],
      family: ["把孩子交给泥土和树叶，而不是屏幕", "第一次爬山，由你陪他走完", "在自然课堂上，你也是学生"],
      sport: ["用一次拉练换一周好睡眠", "让心率回到山林的节奏", "把通勤久坐的身体重新打开"],
      social: ["和一群同频的人走同一条路", "路上聊的比目的地更难忘", "把聚会从会议室搬到山里"],
      photo: ["把相机对焦在没人去的角度", "等一束光，等一片云", "出片是顺便，不是目的"],
      default: ["走一段值得记住的路", "把日子过成户外", "让风景替你说话"]
    };
    const DNA_ENV_ANGLE = {
      forest: { autumn: "把红叶装进相册，也装进回忆", summer: "在绿荫里躲过整个酷暑" },
      water: { summer: "溯溪而上，每一段都是天然空调", autumn: "浅溪瘦水，正好教孩子辨认石头" },
      snow: { default: "雪线之上，世界只剩呼吸和脚步" },
      meadow: { summer: "躺在草甸上，看云慢慢走", autumn: "风一过，整片草浪都金了" },
      canyon: { default: "一线天里，光只肯在正午露一小块" },
      coast: { summer: "海风把咸味拍在脸上，浪抹平脚印" },
      mountain: { default: "每个转弯，都换一幅远景" },
      urban: { default: "巷子深处的饭菜香，比景点更动人" }
    };
    const envAngleMap = DNA_ENV_ANGLE[environment];
    const envAngle = envAngleMap ? ((season && envAngleMap[season]) ? envAngleMap[season] : (envAngleMap.default || null)) : null;
    const motivAngles = DNA_ANGLES_BY_MOTIV[coreMotivation] || DNA_ANGLES_BY_MOTIV.default;
    /* P0-A：环境角度本身含具体画面（如「把红叶装进相册」/「溯溪而上」），
       只有在 groundedScenes 命中该地貌场景时才允许作为内容角度；否则它只留在
       creativeContext 里作为气质参考，不得出现在正文角度中。 */
    const envAngleAllowed = (envAngle && sceneGrounded) ? envAngle : null;
    const copyAngles = (envAngleAllowed ? [envAngleAllowed] : []).concat(motivAngles).slice(0, 4);

    const DNA_TONE = {
      scenery: ["松弛", "通透", "沉浸", "慢下来"],
      healing: ["安静", "清透", "留白", "出神"],
      release: ["清凉", "痛快", "沁凉", "畅快"],
      challenge: ["硬核", "突破", "炽热", "耐力"],
      family: ["陪伴", "惊喜", "安心", "生长"],
      sport: ["舒展", "酣畅", "元气", "律动"],
      social: ["相聚", "热闹", "联结", "同频"],
      photo: ["光影", "氛围", "定格", "出片"],
      default: ["真实", "自然", "当下", "在场"]
    };
    const toneWords = DNA_TONE[coreMotivation] || DNA_TONE.default;

    /* P0-A：中性标签（只含地貌/动作类抽象词，不含具体现场物象）。
       具体物象（红叶/彩林/落叶/溪水/水花/雪线/云海…）只能来自 groundedScenes，
       不得由 environment + season 自动生成。 */
    const DNA_ENV_TAGS = {
      snow: ["高海拔", "风口", "垭口"],
      forest: ["林间路", "树影", "湿润"],
      water: ["水道", "河谷", "浅滩"],
      meadow: ["开阔地", "缓坡", "风"],
      canyon: ["峡谷", "窄谷", "石壁"],
      coast: ["海岸线", "堤岸", "风"],
      mountain: ["山脊线", "爬升", "转弯"],
      urban: ["街巷", "院落", "慢行"],
      unspecified: ["路", "风景", "远方", "脚步"]
    };
    const envTags = DNA_ENV_TAGS[environment] || DNA_ENV_TAGS.unspecified;
    const sceneTags = [environmentLabel || "山野"].concat(groundedNames).concat(envTags)
      .filter(function (v, i, arr) { return !!v && arr.indexOf(v) === i; }).slice(0, 6);

    const editorialTitle = (season ? season + "，" : "") + (environmentLabel || "山野") + "里的一场" + (DNA_FORM_LABELS[activityForm] || "出行");
    const pullQuote = mainTheme;
    evidence.descriptors = "由 " + (DNA_FORM_LABELS[activityForm] || "户外活动") + " × " + (environmentLabel || "未定地貌") + " × " + (season || "未定季节") + " × " + (DNA_MOTIVATION_LABELS[coreMotivation] || "户外体验") + " 组合派生";

    /* P0-A：分层返回 —— Fact-grounded DNA（可参与事实表达）+ Creative Context（只影响表达方式） */
    const creativeContext = {
      mainTheme: mainTheme,
      toneWords: toneWords,
      suggestedAngles: motivAngles.slice(),
      visualMood: visualMood,
      seasonalMood: seasonalCreativeContextFor(a).mood.join("、"),
      envAngleHint: envAngle || ""
    };
    return {
      // —— Fact-grounded DNA：可以参与事实表达 ——
      activityForm, activityFormLabel: DNA_FORM_LABELS[activityForm] || "户外活动",
      intensity, environment, environmentLabel, season,
      coreMotivation, coreMotivationLabel: DNA_MOTIVATION_LABELS[coreMotivation] || "户外体验",
      socialLevel, challengeLevel, professionalLevel,
      visualPotential, targetAudience, tripRhythm, commercialAngle,
      groundedScenes: groundedNames,
      groundedSceneDetails: groundedScenesRaw,
      seasonalCreativeContext: seasonalCreativeContextFor(a),
      evidence: evidence,
      _evidence: evidence, // 向后兼容旧字段名
      // —— Creative Context：只能影响表达方式，不得写成事实 ——
      creativeContext: creativeContext,
      // 以下字段保留同名（下游渲染/回归大量消费），但语义已收窄为「表达层」：
      mainTheme: mainTheme, toneWords: toneWords,
      sceneSignature: sceneSignature, copyAngles: copyAngles, sceneTags: sceneTags,
      visualMood: visualMood,
      pullQuote: pullQuote, editorialTitle: editorialTitle,
    };
  }
  function activityDNAOf(a, photos) { return (a && a.activityDNA) || buildActivityDNA(a, photos); }

  // P0-2：把活动基因拼成一段给 LLM 的「差异化指令」，强制按基因写不同文案（禁止套通用模板）
  function dnaPromptBlock(a) {
    const dna = (a && a.activityDNA) || buildActivityDNA(a);
    if (!dna) return "";
    const lines = [
      "【活动基因 Activity DNA（必须依此写出差异化，禁止套用通用徒步/户外模板）】",
      "- 活动形式：" + (dna.activityFormLabel || dna.activityForm),
      "- 环境地貌：" + (dna.environmentLabel || dna.environment || "未定"),
      "- 季节：" + (dna.season || "未定"),
      "- 强度：" + dna.intensity + "（挑战度 " + dna.challengeLevel + " / 专业度 " + dna.professionalLevel + "）",
      "- 核心动机：" + (dna.coreMotivationLabel || dna.coreMotivation),
      "- 社交形态：" + dna.socialLevel,
      "- 目标人群：" + (dna.targetAudience || "通用"),
      "- 行程节奏：" + dna.tripRhythm,
      "- 商业角度：" + dna.commercialAngle,
      "【已确认场景】（只有这里列出的具体景象才可以写进正文）",
      (function () {
        const g = dna.groundedSceneDetails || [];
        if (!g.length) return "- 无。本次没有任何已确认的具体景象：正文不得出现红叶 / 彩林 / 落叶 / 溪水 / 水花 / 雪线 / 云海 / 篝火 / 星空等具体画面，宁可留白。";
        return g.map(function (x) {
          const src = GROUNDED_SOURCE_LABEL[x.source] || x.source;
          return "- " + x.scene + "（来源：" + src + "｜" + (x.evidence || "已确认") + "）";
        }).join("\n");
      })(),
      "【创意方向】（只能影响文字气质、叙事角度与视觉语言；不得把其中内容写成真实发生的天气、景色、事件或体验）",
      "- 本次主主题（贯穿所有渠道）：" + (dna.mainTheme || "无"),
      "- 推荐内容角度（挑 2-3 个展开，不要全用）：" + (dna.copyAngles || []).join("；"),
      "- 推荐语气词（仅参考，不要堆砌）：" + (dna.toneWords || []).join("、"),
      "- 视觉气质：" + ((dna.creativeContext && dna.creativeContext.visualMood) || "无"),
      "- 季节气质：" + ((dna.seasonalCreativeContext && dna.seasonalCreativeContext.season) || "未定") +
        "｜情绪 " + (((dna.seasonalCreativeContext || {}).mood) || []).join("、") +
        "｜配色 " + (((dna.seasonalCreativeContext || {}).palette) || []).join("、"),
      "【硬性要求】",
      "1) 以上基因相同主题/场景/角度的文案才算「贴合本场」；换成任何其他户外活动也能成立的写法，说明还不够具体，必须回到本场基因重写。",
      "2) 严禁把季节经验当作现场事实：秋季森林≠一定有红叶、夏季溪谷≠一定下水、露营≠一定有篝火、高山≠一定有云海、冬季≠一定有雪、高海拔≠一定登顶。",
      "3) 没有依据的天气 / 景色 / 事件 / 体验一律不写；允许创造表达，不允许创造事实。"
    ];
    return lines.join("\n");
  }

  // P0-2：纯本地、由基因派生的文案（无 Key / LLM 失败时的兜底，确保 4 种徒步也明显不同）
  function dnaCopyFor(dna) {
    dna = dna || {};
    const sig = dna.sceneSignature || "";
    const theme = dna.mainTheme || "走一段值得记住的路";
    const angles = dna.copyAngles || [];
    const tones = dna.toneWords || [];
    const tags = dna.sceneTags || [];
    const envLabel = dna.environmentLabel || "山野";
    const heroHook = (angles[0] || theme) + (sig ? "。" + sig.slice(0, 24) : "");
    const hook = angles[0] || theme;
    const editorialTitle = dna.editorialTitle || theme;
    const pullQuote = dna.pullQuote || theme;
    const intro = ((angles[1] || theme) + "。") + (sig ? sig + "。" : "") + "这一程，把脚步交给" + envLabel + "本身。";
    // 结构化叙事字段（供消费者详情页「场景体验 / 活动价值 / 适合谁」区块直接消费）
    const whyGo = ((angles[1] || theme) + "。") + (sig ? sig + "。" : "");
    const experience = sig || (tags.length ? tags.slice(0, 4).join("、") + "，构成这一段路的基本样子。" : "这一段路的具体样子，留给现场。");
    const gain = angles[2] || (tones.join("、") + "，是这趟行程留给你的余韵。");
    const fitFor = (dna.targetAudience || "想换个节奏的人") + "，都可以在这里找到自己的步频。";
    const body = [
      "为什么值得去：" + whyGo,
      "来了会体验什么：" + experience,
      "参加完能得到什么：" + gain,
      "适不适合你：" + fitFor
    ];
    const sellingPoints = [
      { title: envLabel + "本场才有的画面", desc: sig || "这一程最具体的风景，只属于这条路线。" },
      { title: theme, desc: "围绕「" + theme + "」组织整场表达，让参与者一眼知道为什么来。" },
      { title: (angles[1] || "具体而真实的体验"), desc: (angles[1] || "用真实场景替代空泛形容词，让文案站得住脚。") }
    ];
    const forewordTitles = [
      (dna.season ? dna.season + "的" : "") + envLabel + "，值得用脚步丈量",
      theme,
      (tags[1] ? tags[1] + "里的一场" + (dna.activityFormLabel || "出行") : (dna.activityFormLabel || "出行") + "邀请"),
      (angles[1] || "走一段少有人走的路"),
      (dna.targetAudience ? "写给" + dna.targetAudience : "把日子过成户外")
    ];
    return {
      heroHook, hook, editorialTitle, pullQuote, intro, body, sellingPoints, forewordTitles,
      whyGo, experience, gain, fitFor,
      posterTagline: (dna.season ? dna.season + "，" : "") + envLabel + "在等你",
      storyPurpose: theme
    };
  }

  // P0-2：把基因文案兜底填进活动对象（缺啥补啥，不覆盖 AI 已生成的内容）
  function applyDnaCopyFallback(a) {
    if (!a) return a;
    if (!a.activityDNA) a.activityDNA = buildActivityDNA(a);
    const c = dnaCopyFor(a.activityDNA);
    if (!a.heroHook) a.heroHook = c.heroHook;
    if (!a.hook) a.hook = c.hook;
    if (!a.editorialTitle) a.editorialTitle = c.editorialTitle;
    if (!a.pullQuote) a.pullQuote = c.pullQuote;
    if (!a.intro) a.intro = c.intro;
    if (!a.whyGo) a.whyGo = c.whyGo;
    if (!a.experience) a.experience = c.experience;
    if (!a.gain) a.gain = c.gain;
    if (!a.fitFor) a.fitFor = c.fitFor;
    if (!Array.isArray(a.body) || !a.body.length) a.body = c.body;
    if (!Array.isArray(a.sellingPoints) || !a.sellingPoints.length) {
      a.sellingPoints = c.sellingPoints;
      const mt = dedupeTitles ? dedupeTitles(c.forewordTitles) : c.forewordTitles.slice();
      a.forewordTitles = (typeof fillTitlesFromPool === "function") ? fillTitlesFromPool(mt, a) : mt;
      const first = (a.forewordTitles && a.forewordTitles[0]) || a.title || "";
      a.titleVariants = { brand: first, info: first, wechat: first, xhs: first, moments: first };
      if (!a.title) a.title = first;
    }
    if (!a.posterTagline) a.posterTagline = c.posterTagline;
    if (!a.storyPurpose) a.storyPurpose = c.storyPurpose;
    if (!a.contentStrategy) a.contentStrategy = { name: (a.activityDNA && a.activityDNA.coreMotivationLabel) || "主表达", headline: c.heroHook, reason: c.intro, intro: c.intro, posterLine: c.posterTagline };
    a.pipeline = a.pipeline || { foreword: { titles: [] }, itinerary: { days: a.days || 1 }, details: {} };
    a.pipeline.foreword = { titles: a.forewordTitles || [], intro: a.intro || "" };
    a.pipeline.sellingPoints = (a.sellingPoints || []).map((s) => ({ title: String((s && s.title) || ""), desc: String((s && s.desc) || "") }));
    return a;
  }

  /* ===== P0-5 行程结构化：结构型时间表（事实层）+ 内容型叙事（表达层）=====
     原则：时间表只搬运真实行程；叙事只做表达，不新增事件、不臆造天气/感受。 */
  const ITIN_ROLE_RULES = [
    { role: "opening", kw: ["集合", "出发", "前往", "签到", "上车"] },
    { role: "arrival", kw: ["到达", "抵达", "入园", "进山", "下车"] },
    { role: "warmup", kw: ["热身", "讲解", "说明", "培训", "教学", "装备检查", "安全"] },
    { role: "meal", kw: ["午餐", "中餐", "用餐", "吃饭", "野餐", "补给", "下午茶", "早餐", "晚餐"] },
    { role: "core", kw: ["徒步", "登山", "溯溪", "漂流", "桨板", "攀岩", "骑行", "穿越", "探索", "游玩", "活动", "行走", "登顶", "下水", "体验"] },
    { role: "rest", kw: ["休息", "自由", "拍照", "合影", "观景"] },
    { role: "closing", kw: ["返程", "返回", "解散", "结束", "回程", "总结", "回城"] },
  ];
  function itineraryContentRole(text) {
    const s = String(text || "");
    for (const r of ITIN_ROLE_RULES) if (r.kw.some((k) => s.includes(k))) return r.role;
    return "core";
  }
  function buildItineraryNarrative(a, timeline) {
    if (!timeline || !timeline.length) return { title: "", paras: [] };
    a = a || {};
    const dna = activityDNAOf(a);
    const pick = (r) => timeline.filter((t) => t.contentRole === r);
    const place = a.place || "";
    // 体验基调：由 DNA 动机驱动，但绝不新增事件、不臆造天气/感受
    const mood = ({ scenery: "把节奏放慢，看清一路的季节", sport: "让身体舒展开来", family: "陪孩子一起走进自然", challenge: "一步一步把这段路走完", healing: "暂时放下待办，只专注脚下", social: "和同频的人边走边聊", photo: "等光、构图，把此刻装进相册", release: "彻底松开身心的那口气" })[dna.coreMotivation] || "走进户外，换一种节奏";
    const paras = [];
    // 1) 开场：保留真实时间锚点 + 体验基调
    const start = pick("opening")[0] || pick("arrival")[0] || timeline[0];
    if (start && start.fact) paras.push(`${start.time ? start.time + "，" : ""}${start.fact}。这一程从这里开始，${mood}。`);
    // 2) 途中：热身 / 到达 / 核心 / 休息·拍照 全部串成一段可读体验，逐条保留真实时间
    const mid = [].concat(pick("arrival"), pick("warmup"), pick("core"), pick("rest"));
    if (mid.length) {
      const spine = mid.filter((t) => t.fact).map((t) => (t.time ? t.time + " " : "") + t.fact).join("；");
      const tail = place ? `（${place}）` : "";
      const dist = a.distance ? `全程约 ${a.distance} 公里，` : "";
      paras.push(`${spine}${tail}，是整段行程最值得沉浸的部分。${dist}按自己的节奏走就好。`);
    }
    // 3) 餐食：保留真实时间
    const meal = pick("meal");
    if (meal.length && meal[0].fact) paras.push(`${meal[0].time ? meal[0].time + "，" : ""}${meal[0].fact}，找个舒服的地方补给、回血，也是难得的松弛时刻。`);
    // 4) 收尾：保留真实时间
    const end = pick("closing")[0] || timeline[timeline.length - 1];
    if (end && end.fact && end !== start) paras.push(`${end.time ? end.time + "，" : ""}${end.fact}。带着这一程的疲惫与满足，为这次出发收尾。`);
    return { title: "这一程，这样走过", paras: paras };
  }
  function structureItinerary(a) {
    const days = (a && a.itineraryDays) || [];
    const timeline = [];
    days.forEach((d, di) => {
      (d.items || []).forEach((it) => {
        if (!it || (!it.time && !it.text)) return;
        timeline.push({ day: di + 1, time: it.time || "", fact: it.text || "", contentRole: itineraryContentRole((it.time || "") + " " + (it.text || "")) });
      });
    });
    return { timeline: timeline, hasReal: timeline.length > 0, days: days.length, narrative: buildItineraryNarrative(a, timeline) };
  }
  // P0-5：两种表达的 HTML 片段（复用，避免各页面各写一份）
  // 内容型行程：把真实行程转成可阅读体验叙事（已保留真实时间锚点，未新增事件）
  function itinContentHtml(a) {
    const itin = (typeof structureItinerary === "function") ? structureItinerary(a) : null;
    if (!itin || !itin.narrative || !itin.narrative.paras.length) return "";
    return `<div class="itin-narrative"><div class="itin-narrative-t">${esc(itin.narrative.title || "这一程，这样走过")}</div>${itin.narrative.paras.map((p) => `<p>${esc(p)}</p>`).join("")}</div>`;
  }
  // 结构型行程：真实时间表（只搬运 time + fact，never 被 AI 叙事替换）
  function itinTimelineHtml(a) {
    const days = (a.itineraryDays || []).filter((d) => (d.items || []).some((t) => t && (t.time || t.text)));
    if (!days.length) return "";
    return days.map((day, idx) => `<div class="xh-ed-day"><div class="xh-ed-day-h"><span>DAY</span><b>${idx + 1}</b>${day.label ? " · " + esc(day.label) : ""}</div><div class="timeline">${(day.items || []).filter((t) => t && (t.time || t.text)).map((t) => `<div class="tl-item"><div class="tl-node"></div><div class="t">${esc(t.time)}</div><div class="d">${esc(t.text)}</div></div>`).join("")}</div></div>`).join("");
  }

  const FACT_SPECS = [
    { key: "place", label: "活动地点", required: true, val: (a) => a.place, test: (raw) => /[\u4e00-\u9fa5]{2,8}?(?:山|湖|谷|林|公园|峰|岭|沟|塬|垭口|草原|梯田|古镇|古城|寺庙|州|市|县|镇|区|城|村|坪|堰|屯|堡)/.test(raw) || CITY_NAMES.some((k) => raw.includes(k)) },
    { key: "route", label: "具体路线", required: (a) => ["徒步", "登山", "骑行", "越野", "跑步", "溯溪"].includes(a.type) || /徒步|登山|骑行|越野|穿越|爬山|轻徒步/.test(a.raw || ""), val: (a) => a.route, test: (raw) => /路线|线路|轨迹|途经|途径|上山路线|徒步路线/.test(raw) },
    { key: "date", label: "活动日期", required: true, val: (a) => a.date || a.dateMD, test: (raw) => /\d{1,2}\s*月\s*\d{1,2}\s*日|本周|下周|本周末|下周末|周末|周六|周日|国庆|元旦|春节|中秋|端午|清明|五一/.test(raw) },
    { key: "days", label: "活动天数", val: (a) => a.days, test: (raw) => /\d+\s*天|两日|三日|多天|多日|过夜/.test(raw) },
    { key: "type", label: "活动类型", val: (a) => a.type, test: (raw) => TYPE_RULES.some((r) => r.kw.some((k) => raw.includes(k))) },
    { key: "difficulty", label: "活动难度", required: (a) => a.type === "高海拔登山", val: (a) => a.difficulty || inferDifficulty(a), test: (raw) => /难度|轻松|中等|挑战|入门|进阶|专业级/.test(raw) },
    { key: "audience", label: "参与人群", val: (a) => (a.audience || []).join("/"), test: (raw) => /亲子|儿童|孩子|家庭|成人|团建|企业|研学|青少年|少年/.test(raw) },
    { key: "age", label: "适合年龄", required: (a) => isFamilyActivity(a), val: (a) => a.ageRange, test: (raw) => /\d{1,2}\s*[-—~至到]\s*\d{1,2}\s*岁|\d{1,2}\s*岁以上/.test(raw) },
    { key: "price", label: "活动价格", required: true, val: (a) => (a.price != null ? "¥" + a.price + "/" + a.limitUnit : (a.priceTBD ? "待定" : "")), test: (raw) => /\d{2,4}\s*元|\d{2,4}\s*\/\s*人|价格待定|费用待定|\d{2,4}\s*每人/.test(raw) },
    { key: "limit", label: "招募上限", val: (a) => (a.limit ? a.limit + a.limitUnit : ""), test: (raw) => /限\s*\d+|招募\s*\d+|成行\s*\d+|\d+\s*组|\d+\s*人/.test(raw) },
    { key: "distance", label: "路线距离", val: (a) => (a.distance ? a.distance + "KM" : ""), test: (raw) => /\d+(?:\.\d+)?\s*(?:KM|km|公里)/.test(raw) },
    { key: "elevation", label: "海拔", na: (a) => !["高海拔登山", "徒步"].includes(a.type), val: (a) => (a.elevation ? a.elevation + "m" : ""), test: (raw) => /海拔/.test(raw) },
    { key: "meeting", label: "集合地点", required: true, val: (a) => a.meeting, test: (raw) => /集合|上车|出发|签到/.test(raw) },
    { key: "meetTime", label: "集合时间", required: true, val: (a) => a.meetTime, test: (raw) => /\d{1,2}\s*[:：]\s*\d{2}|\d{1,2}\s*点/.test(raw) },
    { key: "returnTime", label: "返回时间", val: (a) => a.returnTime, test: (raw) => /返回|回到|解散/.test(raw) },
    { key: "services", label: "费用包含（80元含什么）", required: (a) => (a.price != null || a.priceTBD), val: (a) => { const s = []; if (a.includeLeader) s.push("领队"); if (a.includeMeal) s.push("餐食"); if (a.includeInsurance) s.push("保险"); if (a.includeTransport) s.push("交通"); if (a.includeGear) s.push("装备"); if ((a.feeInclude || []).length && !s.length) s.push.apply(s, a.feeInclude); return s.join("、"); }, test: (raw) => /领队|向导|教练|带队|协作|午餐|含餐|餐饮|吃饭|保险|交通|接送|包车|装备|全包|含|包含/.test(raw) },
    { key: "feeExclude", label: "费用不含", val: (a) => ((a.feeExclude || []).length ? "已填写" : ""), test: (raw) => /不含|自理|自费/.test(raw) },
    { key: "itinerary", label: "详细行程", required: (a) => a.type === "高海拔登山" || a.difficulty === "挑战" || (parseFloat(a.elevation) >= 3500), val: (a) => { const d = (a.itineraryDays || []).filter((x) => (x.items || []).some((t) => t && (t.time || t.text))); return d.length ? d.length + " 天已填" : ""; }, test: (raw) => /行程|集合后|出发后/.test(raw) },
    { key: "leaderInfo", label: "领队资料", val: (a) => a.leaderName, test: (raw) => /领队|教练|向导|从业|资质/.test(raw) },
    { key: "gear", label: "装备清单", val: (a) => ((a.gear || []).length ? "已生成" : ""), test: (raw) => /装备|租借|自备/.test(raw) },
    { key: "refund", label: "退款规则", val: (a) => a.notes, test: (raw) => /退款|退费|取消|转让|退订/.test(raw) },
    { key: "contact", label: "联系方式", val: (a) => a.contact, test: (raw) => /1\d{10}/.test(raw) },
  ];
  function factRegistry(a) {
    const raw = a.raw || "";
    const cf = a.factConfirmed || {};
    return FACT_SPECS.map((spec) => {
      if (spec.na && spec.na(a)) return { key: spec.key, label: spec.label, value: "", status: "not_applicable", source: "rule", required: false };
      const v = spec.val ? spec.val(a) : "";
      const has = !!(v !== null && v !== undefined && String(v).trim() !== "");
      const hit = spec.test ? spec.test(raw) : false;
      let status = "missing", source = "";
      if (hit && has) { status = "confirmed"; source = "owner_input"; }
      else if (has) { status = "inferred"; source = "rule_inferred"; }
      // 老板在后台手动确认过的事实升级为 confirmed
      if (cf[spec.key] && has) { status = "confirmed"; source = "owner_confirmed"; }
      // Fact Confidence：confirmed=老板已确认/已填（高）；inferred=系统推断待确认（中）；missing=待补充（无）
      const confidence = status === "confirmed" ? "high" : status === "inferred" ? "medium" : status === "missing" ? "none" : "na";
      return { key: spec.key, label: spec.label, value: String(v || ""), status, source, confidence, required: typeof spec.required === "function" ? !!spec.required(a) : !!spec.required };
    });
  }
  function factsOf(a, st) { return factRegistry(a).filter((f) => f.status === st); }
  function confirmedFacts(a) { return factsOf(a, "confirmed"); }
  function inferredFacts(a) { return factsOf(a, "inferred"); }
  function missingFacts(a) { return factsOf(a, "missing"); }
  function missingRequiredFacts(a) { return factRegistry(a).filter((f) => f.required && f.status === "missing"); }

  /* ===== P0-1 关键事实缺口检测：一句话创建后，告诉老板还差哪些关键事实 =====
     返回有序缺口列表，供「老板确认卡」渲染。分两类：
       missingGaps  —— 必填且缺失（算进「还差 N 项」）
       inferredGaps —— 系统推断的关键事实（如难度/费用包含），需老板确认但不算缺失 */
  const GAP_META = {
    route:     { prompt: "具体路线怎么走？（系统无法替你决定，请写明）", kind: "text", placeholder: "如：彭州小鱼洞—中坝森林环线" },
    meeting:   { prompt: "在哪里集合上车？", kind: "text", placeholder: "如：成都·太平园地铁站 A 口" },
    meetTime:  { prompt: "几点集合出发？", kind: "text", placeholder: "如：08:00", inputmode: "time" },
    services:  { prompt: "这 80 元包含什么？直接写，系统帮你归类", kind: "textarea", placeholder: "如：专业领队、户外保险、午餐、往返车费" },
    price:     { prompt: "活动价格是多少？", kind: "text", placeholder: "如：80" },
    date:      { prompt: "活动是哪一天？", kind: "text", placeholder: "如：本周六 / 10月12日" },
    place:     { prompt: "活动地点在哪？", kind: "text", placeholder: "如：彭州" },
    difficulty:{ prompt: "难度怎么标？（系统已推测，请确认或改正）", kind: "text", placeholder: "轻松 / 适中 / 进阶 / 挑战" },
    itinerary: { prompt: "详细行程？（可稍后在编辑器补）", kind: "textarea", placeholder: "如：08:00 集合出发，10:00 进山，16:00 返程" },
    age:       { prompt: "适合什么年龄？", kind: "text", placeholder: "如：18-45 岁" },
    limit:     { prompt: "招募上限几人？", kind: "text", placeholder: "如：20 人" },
    days:      { prompt: "活动几天？", kind: "text", placeholder: "如：1 天" },
    leaderInfo:{ prompt: "领队是谁？", kind: "text", placeholder: "领队姓名" },
    contact:   { prompt: "报名联系电话？", kind: "text", placeholder: "手机号" },
    refund:    { prompt: "退款规则？（可留空用默认）", kind: "text", placeholder: "可留空" },
  };
  const GAP_PRIORITY = ["route", "meeting", "meetTime", "services", "price", "date", "place", "difficulty", "itinerary", "age", "limit", "days", "leaderInfo", "contact", "refund"];
  /* ===== v190 事实建议引擎：能推断的绝不让老板打字 =====
     来源优先级：① 本次一句话已解析（raw）② 俱乐部历史活动同类型众数 ③ 品牌资料 ④ 活动常规默认
     每条建议带 src/label，UI 必须如实展示来源；老板一键采用，也可改写。 */
  const WEEKDAY_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  function factHistPool() {
    const st = (typeof state !== "undefined" && state) ? state : null;
    if (!st) return [];
    const out = [];
    (st.history || []).forEach((x) => { if (x && typeof x === "object") out.push(x); });
    (st.activities || []).forEach((x) => { if (x && typeof x === "object") out.push(x); });
    return out;
  }
  function sameKindHist(a) {
    const pool = factHistPool().filter((x) => x && x.id !== (a && a.id));
    if (!pool.length) return [];
    const k = pool.filter((x) => x.type && a && a.type && x.type === a.type);
    return k.length >= 2 ? k : pool;
  }
  function modeRaw(list) {
    const m = new Map();
    (list || []).forEach((v) => {
      const t = String(v == null ? "" : v).trim();
      if (!t || /^(待定|待确认|missing)/i.test(t)) return;
      m.set(t, (m.get(t) || 0) + 1);
    });
    let best = "", n = 0;
    m.forEach((c, v) => { if (c > n) { n = c; best = v; } });
    return n >= 2 ? best : (n === 1 && m.size === 1 ? best : best);
  }
  function upcomingWeekday(off) {
    const d = new Date();
    d.setDate(d.getDate() + ((off - d.getDay() + 7) % 7));
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function suggestDateFromRaw(raw) {
    const r = String(raw || "");
    if (/国庆|十一/.test(r)) return "国庆期间（请填写具体日期）";
    if (/本周|这周|周六|周日|周末/.test(r)) return /周日|周末/.test(r) ? upcomingWeekday(0) : upcomingWeekday(6);
    const m = r.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
    if (m) return `${+m[1]}月${+m[2]}日`;
    return "";
  }
  const FACT_SUGGEST = {
    date: (a) => {
      const v = suggestDateFromRaw(a.raw);
      if (v) return { value: v, src: "raw", label: "按你这句话里的时间" };
      return { value: upcomingWeekday(6), src: "rule", label: "默认下一个周六（" + upcomingWeekday(6) + "，可改）" };
    },
    meetTime: (a) => {
      const h = modeRaw(sameKindHist(a).map((x) => x.meetTime));
      if (h) return { value: h, src: "history", label: "按你的历史活动" };
      const early = /高海拔|登山|越野|骑行|挑战/.test(String(a.type || "") + String(a.raw || ""));
      return { value: early ? "07:00" : "08:00", src: "rule", label: early ? "长线常规出发时间" : "一日活动常规出发时间" };
    },
    meeting: (a) => {
      const h = modeRaw(sameKindHist(a).map((x) => x.meeting));
      if (h) return { value: h, src: "history", label: "按你的历史活动" };
      const bd = (typeof state !== "undefined" && state && state.brand) ? state.brand : null;
      if (bd && bd.address) return { value: bd.address, src: "brand", label: "按你的门店地址" };
      return { value: "", src: "", label: "需你定（点一下候选即可）", chips: ["市区地铁站 A 口", "俱乐部门店", "客户指定地点"] };
    },
    price: (a) => {
      if (a.priceTBD) return { value: "待定", src: "raw", label: "你已标注价格待定" };
      const nums = sameKindHist(a).map((x) => Number(x.price)).filter((n) => n > 0);
      if (nums.length) {
        const avg = Math.max(10, Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) / 10) * 10);
        return { value: String(avg), src: "history", label: `按你的历史均价 ¥${avg}` };
      }
      return { value: "", src: "", label: "需你定（点一下候选即可）", chips: ["80", "128", "198", "免费"] };
    },
    services: (a) => {
      const h = modeRaw(sameKindHist(a).map((x) => ((x.feeInclude || []).length ? x.feeInclude.join("、") : "")));
      if (h) return { value: h, src: "history", label: "按你的历史活动" };
      return { value: "专业领队、户外保险", src: "rule", label: "一日活动常规配置（请核对）" };
    },
    route: (a) => {
      const m = String(a.raw || "").match(/([\u4e00-\u9fa5A-Za-z]{2,10})\s*[—\-–~至到]\s*([\u4e00-\u9fa5A-Za-z]{2,10})/);
      if (m) return { value: m[1] + "—" + m[2], src: "raw", label: "按你这句话里的路线" };
      const cands = [];
      sameKindHist(a).forEach((x) => { if (x.route && cands.indexOf(x.route) < 0) cands.push(x.route); });
      if (cands.length) return { value: "", src: "", label: "选一条你走过的路线", chips: cands.slice(0, 3) };
      return { value: "", src: "", label: "路线系统无法替你决定，写一句就行", chips: [] };
    },
    difficulty: (a) => {
      const d = (typeof inferDifficulty === "function") ? inferDifficulty(a) : "";
      if (d) return { value: d, src: "rule", label: "按路线/海拔推断" };
      return { value: "", src: "", label: "", chips: ["轻松", "适中", "进阶", "挑战"] };
    },
    age: (a) => {
      const h = modeRaw(sameKindHist(a).map((x) => x.ageRange));
      if (h) return { value: h, src: "history", label: "按你的历史活动" };
      if (typeof isFamilyActivity === "function" && isFamilyActivity(a)) return { value: "5-12岁（需家长陪同）", src: "rule", label: "亲子活动常规" };
      return { value: "", src: "", label: "" };
    },
    limit: (a) => {
      const h = modeRaw(sameKindHist(a).map((x) => x.limit));
      if (h) return { value: h, src: "history", label: "按你的历史活动" };
      return { value: "20", src: "rule", label: "小团常规上限" };
    },
    days: (a) => ({ value: String(Number(a.days) || 1), src: "rule", label: "按行程推断" }),
    leaderInfo: (a) => {
      const h = modeRaw(sameKindHist(a).map((x) => x.leaderName));
      if (h) return { value: h, src: "history", label: "按你的历史活动" };
      return { value: "", src: "", label: "" };
    },
    contact: (a) => {
      const p = (typeof state !== "undefined" && state && state.brand && state.brand.phone) || "";
      if (p) return { value: p, src: "brand", label: "按你的品牌资料" };
      return { value: "", src: "", label: "" };
    },
    refund: (a) => {
      const h = modeRaw(sameKindHist(a).map((x) => x.notes));
      if (h) return { value: h, src: "history", label: "按你的历史活动" };
      return { value: "", src: "", label: "" };
    },
  };
  function factSuggestionFor(a, key) {
    const f = FACT_SUGGEST[key];
    if (!f || !a) return null;
    try { return f(a) || null; } catch (e) { return null; }
  }
  function suggestGapValue(a, key) { const s = factSuggestionFor(a, key); return (s && s.value) ? s.value : ""; }
  function keyFactValue(a, key) {
    switch (key) {
      case "date": return a.date || a.dateMD || "";
      case "meetTime": return a.meetTime || "";
      case "meeting": return a.meeting || "";
      case "price": return a.price != null ? String(a.price) : "";
      case "services": return (a.feeInclude || []).length ? a.feeInclude.join("、") : "";
      case "route": return a.route || "";
      case "difficulty": return a.difficulty || "";
      case "age": return a.ageRange || "";
      case "limit": return a.limit ? String(a.limit) : "";
      case "days": return a.days ? String(a.days) : "";
      case "leaderInfo": return a.leaderName || "";
      case "contact": return a.contact || "";
      case "refund": return a.notes || "";
      default: return "";
    }
  }
  /* 一键采用：把「有建议且尚未填写」的关键事实一次写回活动，老板零输入也能生成完整详情页 */
  function applyAllSuggestions(a, onlyEmpty) {
    const applied = [];
    Object.keys(FACT_SUGGEST).forEach((k) => {
      if (onlyEmpty && keyFactValue(a, k)) return;
      const v = suggestGapValue(a, k);
      if (v) { applyBossFact(a, k, v); applied.push(k); }
    });
    return applied;
  }
  function countActionableGaps(a) {
    const gaps = detectKeyGaps(a);
    return {
      total: gaps.length,
      suggested: gaps.filter((g) => g.suggest && g.suggest.value).length,
      needOwner: gaps.filter((g) => !(g.suggest && g.suggest.value)).length,
    };
  }
  function detectKeyGaps(a) {
    const reg = factRegistry(a);
    const need = reg.filter((f) => {
      if (f.required && f.status === "missing") return true;
      if (f.status === "inferred" && (f.required || f.key === "difficulty" || f.key === "services")) return true;
      return false;
    });
    return need.map((f) => {
      const m = GAP_META[f.key] || { prompt: "请补充：" + f.label, kind: "text", placeholder: f.label };
      const sg = factSuggestionFor(a, f.key);
      return { key: f.key, label: f.label, status: f.status, confidence: f.confidence, value: f.value || "", prompt: m.prompt, kind: m.kind, placeholder: m.placeholder, inputmode: m.inputmode, suggest: sg || null };
    }).sort((x, y) => GAP_PRIORITY.indexOf(x.key) - GAP_PRIORITY.indexOf(y.key));
  }
  function isPublishBlocked(a) { const chk = runPublishCheck(a); return !chk.ok; }

  // 把老板写的「费用包含」自由文本归类为结构化字段（同步 feeInclude / include* 标志）
  function parseFeeInclude(text, a) {
    const items = String(text || "").split(/[、，,;；\n]+/).map((s) => s.trim()).filter(Boolean);
    a.includeLeader = items.some((s) => /领队|向导|教练|带队|协作/.test(s));
    a.includeMeal = items.some((s) => /餐|食|午饭|午餐|吃饭/.test(s));
    a.includeInsurance = items.some((s) => /保险/.test(s));
    a.includeTransport = items.some((s) => /交通|车|接送|包车/.test(s));
    a.includeGear = items.some((s) => /装备/.test(s));
    if (!a.factConfirmed) a.factConfirmed = {};
    a.factConfirmed.services = true;
  }
  // 把老板在确认卡里填的某一个关键事实写回活动，并同步派生字段
  function applyBossFact(a, key, value) {
    value = String(value == null ? "" : value).trim();
    if (!a.factConfirmed) a.factConfirmed = {};
    if (!value) return;
    if (key === "route") { a.route = value; a.factConfirmed.route = true; }
    else if (key === "meeting") { a.meeting = value; a.factConfirmed.meeting = true; }
    else if (key === "meetTime") { a.meetTime = value; a.factConfirmed.meetTime = true; }
    else if (key === "services") { parseFeeInclude(value, a); }
    else if (key === "price") {
      const n = parseFloat(value.replace(/[^\d.]/g, ""));
      if (!isNaN(n)) {
        a.price = n;
        if (!a.departures || !a.departures.length) { const d = departureFromDate(a.date, a.price); if (d) a.departures = [d]; }
        else a.departures.forEach((d) => { if (d.price == null) d.price = a.price; });
      }
      a.factConfirmed.price = true;
    }
    else if (key === "date") { a.date = value; a.dateMD = toDateMD(value); a.factConfirmed.date = true; }
    else if (key === "place") { a.place = value; a.factConfirmed.place = true; }
    else if (key === "difficulty") { const cd = cleanDifficulty(value); if (cd) a.difficulty = cd; a.factConfirmed.difficulty = true; }
    else if (key === "age") { a.ageRange = value; const mm = value.match(/(\d{1,3})\s*[-—~至到]\s*(\d{1,3})/); if (mm) { a.ageFrom = +mm[1]; a.ageTo = +mm[2]; } a.factConfirmed.age = true; }
    else if (key === "limit") { const n = parseInt(value.replace(/\D/g, ""), 10); if (!isNaN(n)) a.limit = n; a.factConfirmed.limit = true; }
    else if (key === "days") { const n = parseInt(value.replace(/\D/g, ""), 10); if (!isNaN(n)) a.days = n; a.factConfirmed.days = true; }
    else if (key === "itinerary") { a._itineraryNote = value; a.factConfirmed.itinerary = true; }
    else if (key === "leaderInfo") { a.leaderName = value; a.factConfirmed.leaderInfo = true; }
    else if (key === "contact") { a.contact = value; a.factConfirmed.contact = true; }
    else if (key === "refund") { if (value) a.notes = value; a.factConfirmed.refund = true; }
    syncDerived(a); syncItineraryDays(a);
  }
  function confirmFact(a, key) { if (!a.factConfirmed) a.factConfirmed = {}; a.factConfirmed[key] = true; }
  /* ===== V2.0 发布前事实检查 =====
     blocking：关键错误，禁止发布；warnings：非关键缺失，可隐藏对应模块后发布。 */
  const STRATEGY_WORDS = ["推荐理由", "适合朋友圈传播", "强化年轻用户", "不虚构具体景点", "推荐选择该方向", "当前模板匹配度", "制造向往", "情绪钩子", "转化"];
  const TEMPLATE_PHRASES = ["走进自然，收获成长", "身体想念山野", "说走就走的旅行", "感受城市烟火", "重新认识自己", "治愈之旅", "松弛感拉满"];
  function runPublishCheck(a) {
    const blocking = [], warnings = [];
    const reg = factRegistry(a);

    // 1) 关键事实缺失
    const reqMissing = reg.filter((f) => f.required && f.status === "missing").map((f) => f.label);
    if (reqMissing.length) blocking.push("缺少关键事实：" + reqMissing.join("、"));

    // 2) 规则推断但未确认
    const inf = reg.filter((f) => f.status === "inferred");
    const criticalInf = inf.filter((f) => f.required || ["difficulty", "services"].includes(f.key));
    const optionalInf = inf.filter((f) => !criticalInf.includes(f));
    if (criticalInf.length) blocking.push("以下关键事实为系统推断，请老板确认：" + criticalInf.map((f) => f.label).join("、"));
    if (optionalInf.length) warnings.push("以下为规则推断，未确认前不会进入客户页：" + optionalInf.map((f) => f.label).join("、"));

    // 3) 全包与费用不含冲突
    if (a.allInclusive) {
      if ((a.feeExclude || []).length) blocking.push("已勾选“全包”，但费用不含仍有项目，二者冲突");
      if (!(a.feeInclude || []).length) warnings.push("“全包”需要老板确认具体包含项目");
    }

    // 4) 高风险活动的难度、适合人群与行程
    const hard = a.type === "高海拔登山" || a.difficulty === "挑战" || (a.elevation && +a.elevation >= 3500);
    const demandingRoute = (+a.distance >= 10) || (+a.elevation >= 800 && a.type !== "高海拔登山");
    if (demandingRoute && a.difficulty === "轻松") {
      blocking.push(`路线数据与难度冲突：${a.distance ? a.distance + "公里" : ""}${a.distance && a.elevation ? "、" : ""}${a.elevation ? "累计爬升/海拔数据 " + a.elevation + "米" : ""}不能直接标为“轻松”，请老板重新确认难度`);
    }
    if (hard) {
      if (!a.difficulty || a.difficulty === "待确认") blocking.push("高风险活动缺少难度评级");
      if (!reg.some((f) => f.key === "age" && f.status === "confirmed")) blocking.push("高风险活动必须由老板确认适合人群（年龄）");
      const hasItin = (a.itineraryDays || []).some((d) => (d.items || []).some((t) => t && (t.time || t.text)));
      if (!hasItin) warnings.push("高风险活动建议补充详细行程");
    } else {
      const hasItin = (a.itineraryDays || []).some((d) => (d.items || []).some((t) => t && (t.time || t.text)));
      if (!hasItin) warnings.push("暂无详细行程，详情页将显示“待补充”");
    }

    // 5) 价格与计价单位
    if (a.price == null && !a.priceTBD) blocking.push("缺少活动价格（或需标记为价格待定）");

    // 6) 内部策略语言不得进入客户页面
    const text = [
      a.title, a.intro, a.headline, a.shareWechat, a.shareMoments, a.shareXhs, a.shareGzh, a.shareVoice,
      (a.highlights || []).map((h) => (Array.isArray(h) ? h[0] : h)).join(" "),
      (a.safety || []).join(" "),
    ].filter(Boolean).join(" ");
    const hitStrategy = STRATEGY_WORDS.filter((w) => text.includes(w));
    if (hitStrategy.length) blocking.push("客户可见文案含内部策略语言：" + hitStrategy.join("、"));
    const hitTpl = TEMPLATE_PHRASES.filter((w) => text.includes(w));
    if (hitTpl.length) warnings.push("存在明显模板句，建议改写：" + hitTpl.join("、"));

    // 7) 中英文混杂
    const en = (text.match(/\b[A-Za-z]{3,}\b/g) || []);
    if (en.length > 10) warnings.push("文案中英文混杂偏多，建议统一为中文");

    return { blocking, warnings, ok: blocking.length === 0 };
  }



  function factTags(a) {
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    const out = [];
    if (confirmed.has("distance") && a.distance) out.push(`${a.distance}KM`);
    if (confirmed.has("elevation") && a.elevation) out.push(`${a.elevation}m`);
    if (confirmed.has("days") && a.days > 1) out.push(`${a.days}天`);
    if (confirmed.has("age") && a.ageRange) out.push(a.ageRange);
    if (confirmed.has("limit") && a.limit) out.push(`${a.limit}${a.limitUnit}`);
    return out;
  }
  /* V2.1 气候维度：让文案能引用当季体感，而不只是罗列“X月X日”。 */
  function climateFor(a) {
    const p = (a.place || "") + " " + (a.meeting || "") + " " + (a.title || "");
    const norm = p.replace(/后(?=山)|前(?=山)|景区|风景区|森林公园|地质公园|大峡谷/g, "");
    let key = "default";
    for (const k in PLACE_DB) {
      if (k === "default") continue;
      if (PLACE_DB[k].aliases.some((al) => p.includes(al) || norm.includes(al))) { key = k; break; }
    }
    const s = seasonFromActivity(a);
    const table = {
      "都江堰": { spring: "新绿刚醒，山路还带着潮气", summer: "溪风清凉，午后偶有阵雨", autumn: "天高云淡，昼夜微凉", winter: "湿冷多雾，山静人稀" },
      "成都": { spring: "短春多变，早晚仍凉", summer: "城里闷热，山里却爽", autumn: "爽朗少雨", winter: "湿冷，出太阳最宜出门" },
      "川西": { spring: "风大仍寒，高原慢慢苏醒", summer: "多雨多雾，午后易变天", autumn: "金光遍野，昼夜温差大", winter: "干冷日照强，雪线清晰" },
      "云南": { spring: "花开不断，昼暖夜凉", summer: "清凉多雨，云很低", autumn: "日光绵长，宜慢慢走", winter: "温和如春，阳光正好" },
      "贵州": { spring: "山坳新绿，润润的", summer: "天然凉棚，瀑布正丰", autumn: "梯田染色，村寨转暖", winter: "雨雾如水墨淡开" },
      "西藏": { spring: "林芝桃花映着雪", summer: "氧气足云多，最稳", autumn: "干晴通透", winter: "游客少，日照却暖" },
      "新疆": { spring: "伊犁杏花一路向北", summer: "白昼长，草原发光", autumn: "喀纳斯像一封情书", winter: "雪的故乡，安静如童话" },
      "海南": { spring: "海风常驻", summer: "浪大湿热，多阵雨", autumn: "人少海自在", winter: "温暖得像季节转换器" },
      "default": { spring: "山野渐渐回暖", summer: "风比空调更解闷", autumn: "空气清爽", winter: "出门需一点勇气，但风景值得" }
    };
    const text = (table[key] && table[key][s]) || table.default[s] || "";
    return { season: s, place: key, text };
  }
  /* P0-A：季节/气候只能提供「情绪与准备方向」，不得把
     「午后偶有阵雨 / 金光遍野 / 瀑布正丰」这类未经确认的当季画面写成活动现场事实。
     故此处不再引用 climateFor().text 作为可写素材，disclaimer 固定 creative_only。 */
  function climateDirections(a) {
    const sc = seasonalCreativeContextOf(a);
    if (!sc.season) return [];
    const p = (a && a.place) || "这里";
    const mood = (sc.mood || []).join("、");
    const palette = (sc.palette || []).join("、");
    return [
      { name: "季节气质", headline: `${sc.season}的${p}，适合用「${mood}」的节奏走一趟。`, reason: "只借用季节的情绪与配色，不对当天天气或景色作任何断言。", mood: "时令", disclaimer: "creative_only" },
      { name: "按季节准备", headline: `${sc.season}出发，${p}这趟路值得按${palette}的色调、${sc.rhythm}的节奏来准备。`, reason: "把季节当作准备理由，而不是现场事实。", mood: "准备", disclaimer: "creative_only" }
    ];
  }

  // V1.9：AI 内容方向库——按活动类型 + 地点季节 + 事实属性生成丰富且美的表达方向
  function directionPoolFor(a) {
    const p = a.place || "这里";
    const flavor = placeFlavorFor(a);
    const season = (flavor.seasonLine || "").replace(/[。，]/g, "").trim();
    const localVibe = flavor.localVibe || "";
    const dist = a.distance ? `${a.distance}KM` : "";
    const days = a.days > 1 ? `${a.days}天` : "一天";
    const isFamily = isFamilyActivity(a);
    const diff = a.difficulty || "轻松";
    const date = a.dateMD || "下一次出发";
    const monthMatch = (a.dateMD || "").match(/(\d{1,2})月/);
    const month = monthMatch ? +monthMatch[1] : (new Date().getMonth() + 1);
    const isAutumn = [9, 10, 11].includes(month);
    const isSummer = [6, 7, 8].includes(month);
    const isSpring = [3, 4, 5].includes(month);
    const isWinter = [12, 1, 2].includes(month);
    const seasonWord = isAutumn ? "秋天" : (isSummer ? "夏天" : (isSpring ? "春天" : "冬天"));
    const isWeekend = /周六|周日|周末|星期六|星期天/.test(a.dateMD || a.date || "");
    const isHoliday = /国庆|五一|清明|端午|中秋|元旦|春节|假期/.test(a.dateMD || a.date || "");

    // 地点地貌/气质标签，用于生成更有辨识度的 headline
    const placeTone = (() => {
      const raw = (a.raw || "") + " " + (a.place || "");
      if (/云海|日出|星空|银河|云瀑|佛光/.test(raw)) return "云海星空";
      if (/瀑布|溪流|溪谷|峡谷|玩水|溪水/.test(raw)) return "溪水峡谷";
      if (/古镇|老城|寺庙|道观|文化|历史|古道|遗址/.test(raw)) return "人文古道";
      if (/草甸|花海|草原|森林|竹海|杜鹃|红叶|银杏/.test(raw)) return "森林草甸";
      if (/雪山|冰川|海拔|垭口|高海拔/.test(raw)) return "雪山高原";
      return "山野";
    })();

    // 通用户外 / 徒步方向池：季节、周末、地点气质、情绪拆分，避免 3 个固定模板
    const hikeDirections = [
      { name: "山野叙事", headline: dist ? `${p}${dist}，用脚步把${seasonWord}走得更远。` : `${p}的山路，${seasonWord}正好。`, reason: "把路线长度、季节和完成感串成一句邀请。", mood: "完成" },
      { name: "城市逃逸", headline: isWeekend ? `这个周末，去${p}把城市关掉。` : `城市之外，${p}正好。`, reason: "距离不远，刚好能把城市的喧嚣关在身后。", mood: "逃离" },
      { name: "季节在场", headline: season ? `${season}，${p}在等。` : `这个${seasonWord}，去${p}走一走。`, reason: "季节本身，就是出发的最好理由。", mood: "时令" },
      { name: "完成仪式", headline: `${days}${dist ? "、" + dist : ""}，把${p}走成一次小型远征。`, reason: "用一段路，完成一次给自己的小小仪式。", mood: "挑战" },
      { name: "山风来信", headline: `${p}的风${isAutumn ? "开始带凉" : (isSummer ? "比城里低好几度" : "已经吹到城市边缘")}，该出发了。`, reason: "山风先到一步，提醒你城市之外还有另一种节奏。", mood: "诗意" },
      { name: "脚踏实地", headline: `不追打卡点，只追${p}的真实山路。`, reason: "不追打卡点，只认真走一段真实山路。", mood: "真实" },
      { name: "云端对话", headline: `在${p}，把城市听不见的声音重新打开。`, reason: "城市听不见的声音，在这里重新打开。", mood: "感知" },
      { name: "克制向导", headline: `${p} / ${date}`, reason: "信息本身，就是态度。", mood: "克制" },
      { name: "周末重启", headline: isHoliday ? `假期不多，${p}足够让你换一口气。` : `用一个周末，把${p}走成生活的逗号。`, reason: "用一个周末，把生活节奏轻轻重启。", mood: "逃离" },
      { name: "在地气息", headline: localVibe ? `${p}的${placeTone}，比滤镜更真实。` : `${p}的${placeTone}，比攻略更具体。`, reason: "把地点的气质，写进每一步。", mood: "真实" },
      { name: "一步一景", headline: `${p}不赶时间，${days}只认真走一段。`, reason: "慢下来，山和树都会主动和你打招呼。", mood: "完成" },
      { name: "初阶友好", headline: diff === "轻松" ? `${p}这条线，新手也能走得尽兴。` : `${p}的真实山路，不需要朋友圈滤镜。`, reason: "新手也能走得尽兴，真实山路不需要滤镜。", mood: "真实" },
      { name: "独处阈值", headline: `不需要说话，${p}会把你安静地接住。`, reason: "有时出门不是为了热闹，而是为了把脑子清空。", mood: "松弛" },
      { name: "向光而行", headline: `光线好的时候，${p}会替你说出来出发的理由。`, reason: "光线和天气，是户外最诚实的文案。", mood: "诗意" },
      { name: "慢问自己", headline: `走${p}的路上，答案常常比问题先到。`, reason: "把户外写成一次和自己的对话，而非打卡。", mood: "哲思" },
      { name: "野趣入口", headline: `${p}不收门票，只收一点好奇心。`, reason: "把山野的开放性写成邀请，而非清单。", mood: "好奇" },
      { name: "微度假", headline: `把${p}当成离城市最近的一次深呼吸。`, reason: "近郊也能重置状态，不必远行。", mood: "松弛" },
      { name: "同行引力", headline: `和同样想去${p}的人，把周末走成经历。`, reason: "一个人出发是旅行，一群人出发是经历。", mood: "陪伴" }
    ];

    // 地点专属方向：根据已知地点扩展更有辨识度的表达
    const placeExtra = [];
    if (/牛背山|达瓦更扎|轿顶山|红岩顶/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "云海之上", headline: `${p}的云海和日出，值得一次早起。`, reason: "云海和日出，是写给早起的人的第一封信。", mood: "诗意" },
      { name: "星空营地", headline: `在${p}，等一场城市看不到的星空。`, reason: "城市的灯熄得太晚，这里的星空值得一次等待。", mood: "诗意" }
    );
    if (/青城山|青城后山|鹤鸣山|赵公山/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "古道问道", headline: `${p}的山道，藏着比风景更深的静谧。`, reason: "山道的静谧，藏在脚步声比人声更清楚的地方。", mood: "感知" },
      { name: "竹海听风", headline: `穿过${p}的竹林，风声比导航更清楚。`, reason: "竹林把风声筛得很轻，走着走着，心也慢了。", mood: "诗意" }
    );
    if (/四姑娘山|毕棚沟|双桥沟|长坪沟/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "雪山前站", headline: `${p}是通往雪山的第一站，也是很多人心动的开始。`, reason: "雪山的轮廓一旦出现，就想走得更近一点。", mood: "挑战" },
      { name: "高原初体验", headline: `${p}的海拔不高不低，刚好让人认真喘口气。`, reason: "海拔不高不低，刚好让呼吸和风景都变认真。", mood: "真实" }
    );
    if (/都江堰|虹口|龙池|熊猫谷/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "山水之间", headline: `${p}的水和山，把夏天的暑气冲淡。`, reason: "水和山挨得很近，夏天的暑气在这里自然退场。", mood: "清凉" },
      { name: "近郊出逃", headline: `离成都最近的山野，${p}刚刚好。`, reason: "不用太远，就能从城市切换成山野模式。", mood: "逃离" }
    );
    if (/成都|重庆|杭州|西安|苏州|南京|武汉|长沙|广州|深圳/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "城市绿肺", headline: `不用出城太远，${p}就能换一口气。`, reason: "周末不必奔波，近处的山野也能换一口气。", mood: "松弛" }
    );
    if (/川西|贡嘎|稻城亚丁|海螺沟|冷嘎措/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "高原长卷", headline: `${p}的每一公里，都是川西写给眼睛的礼物。`, reason: "川西的 landscape 不讲重点，每一公里都好看。", mood: "感知" },
      { name: "雪山注视", headline: `在${p}，雪山一直看着你走。`, reason: "雪山在远处看着你走，这种感觉比到达更难忘。", mood: "诗意" }
    );
    if (/云南|大理|丽江|香格里拉|泸沽湖/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "云南慢调", headline: `${p}的云很慢，慢到能看清时间。`, reason: "云很慢，慢到你有时间认真看一朵。", mood: "松弛" },
      { name: "风物人间", headline: `${p}的风里，有花和远方的味道。`, reason: "风里有花的味道，也有远方的预感。", mood: "诗意" }
    );

    // 气候 + 地点专属方向：与活动类型无关的共情钩子，合并进所有类型，避免“写死三种风格”
    const generic = [...climateDirections(a), ...placeExtra];

    if (a.type === "高海拔登山") return [
      { name: "海拔仪式", headline: a.elevation ? `把人生的新高度，写在 ${a.elevation} 米。` : "把人生的新高度，留在那座山上。", reason: "高海拔活动的核心是目标、仪式感和完成感。", mood: "成就" },
      { name: "专业敬畏", headline: `${p}，每一米海拔都需要被认真对待。`, reason: "强调真实难度与已确认的专业协作。", mood: "专业" },
      { name: "风的边界", headline: `向上走，直到 ${p} 只剩风和呼吸。`, reason: "用克制的画面感表达攻顶过程。", mood: "探险" },
      { name: "山不言语", headline: `${p}不会答应你什么，但会让你重新校准对自己的判断。`, reason: "把登山从「征服」转向「对话」。", mood: "哲思" },
      ...generic
    ];

    if (a.type === "城市旅行" || a.type === "景区观光") return [
      { name: "城市漫游", headline: `${days}，轻松进入${p}的城市生活。`, reason: "行程已经确定，用松弛感而非户外挑战来吸引用户。", mood: "松弛" },
      { name: "周末逃离", headline: `换个城市过周末，这次去${p}。`, reason: "适合朋友圈与年轻用户，但不虚构具体景点。", mood: "逃离" },
      { name: "旅行杂志", headline: `${p} / ${a.days > 1 ? a.days + " DAYS" : "ONE DAY"}`, reason: "用 City Guide 语法展示已确认的旅行信息。", mood: "杂志" },
      { name: "本地切片", headline: `在${p}，把一天切成几个好片段。`, reason: "强调节奏与本地体验，而非赶路打卡。", mood: "生活" },
      { name: "城市绿肺", headline: `不用出城太远，${p}就能换一口气。`, reason: "周末不必奔波，近处的山野也能换一口气。", mood: "松弛" },
      ...generic
    ];

    if (a.type === "露营") return [
      { name: "星空停机", headline: `把闹钟关掉，去${p}听一夜风声。`, reason: "露营的核心是暂停与重置。", mood: "暂停" },
      { name: "山野过夜", headline: `${days}，${p}的夜色比城市安静很多。`, reason: "用夜晚场景制造稀缺感，不虚构具体星空。", mood: "夜晚" },
      { name: "帐篷生活", headline: `在${p}扎一顶帐篷，把自己还给自然。`, reason: "强调简单生活的吸引力。", mood: "简单" },
      ...generic
    ];

    if (a.type === "滑雪") return [
      { name: "雪季重启", headline: `雪季不该只活在收藏夹里，${p}在等你。`, reason: "用季节限定制造紧迫感。", mood: "季节" },
      { name: "速度回归", headline: `去${p}的雪里，重新感受速度。`, reason: "把滑雪从运动变成情绪释放。", mood: "速度" },
      { name: "白色周末", headline: `${date}，${p}的粉雪是最好的周末答案。`, reason: "强调雪场与周末的契合。", mood: "周末" },
      ...generic
    ];

    if (a.type === "骑行") return [
      { name: "公路自由", headline: `风、公路和自由的味道，${p}都给你。`, reason: "把骑行与自由感直接绑定。", mood: "自由" },
      { name: "车轮视角", headline: `用两个轮子，重新看${p}。`, reason: "强调慢速深入的观察方式。", mood: "观察" },
      { name: "骑行周末", headline: `${date}，去${p}骑一段不堵车的路。`, reason: "用对比突出骑行的轻松。", mood: "轻松" },
      ...generic
    ];

    if (a.type === "攀岩") return [
      { name: "高度对话", headline: `低头是地面，抬头是${p}的岩壁与天空。`, reason: "用空间对比制造张力。", mood: "张力" },
      { name: "突破自己", headline: `在${p}，突破那点不敢尝试的自己。`, reason: "强调心理突破而非体能炫耀。", mood: "成长" },
      { name: "岩壁上的专注", headline: `${p}，让注意力回到身体本身。`, reason: "把攀岩描述为专注力训练。", mood: "专注" },
      ...generic
    ];

    if (a.type === "溯溪" || a.type === "桨板或皮划艇" || a.type === "漂流") return [
      { name: "夏日清凉", headline: `夏天的${p}，水是唯一的正解。`, reason: "用季节与水的关系制造渴望。", mood: "清凉" },
      { name: "水中漫游", headline: `在${p}的水面，把自己交给波纹。`, reason: "强调漂浮与放松的感觉。", mood: "漂浮" },
      { name: "野趣出片", headline: `${p}的溪谷，随手就是夏天的形状。`, reason: "兼顾体验与视觉传播。", mood: "出片" },
      ...generic
    ];

    if (a.type === "跑步") return [
      { name: "山风晨光", headline: `不为 PB，只为${p}那一程山风与晨光。`, reason: "把跑步从竞技转向体验。", mood: "体验" },
      { name: "脚步丈量", headline: `用脚步丈量${p}的清晨。`, reason: "强调简单与仪式感。", mood: "仪式" },
      { name: "跑者日常", headline: `${date}，和${p}一起醒来。`, reason: "把活动融入生活方式。", mood: "日常" },
      ...generic
    ];

    if (a.type === "自驾旅行") return [
      { name: "公路叙事", headline: `方向盘一转，把周末交给${p}的公路与山谷。`, reason: "强调驾驶本身的自由感。", mood: "自由" },
      { name: "车队同行", headline: `不独自赶路，${p}的车队领航更安心。`, reason: "突出编队与后勤保障。", mood: "安心" },
      { name: "路上风景", headline: `去${p}，重要的不是终点，是路上的光。`, reason: "弱化目的地，强化过程。", mood: "过程" },
      ...generic
    ];

    if (a.type === "摄影旅行") return [
      { name: "重新看见", headline: `把${p}的光与影，装进你的镜头。`, reason: "强调观察与记录。", mood: "看见" },
      { name: "机位之外", headline: `${p}不只有打卡机位，还有属于你的画面。`, reason: "反打卡，强调个人视角。", mood: "独特" },
      { name: "光线时刻", headline: `在${p}，等一束属于你的光。`, reason: "用光线制造诗意。", mood: "诗意" },
      ...generic
    ];

    if (a.type === "企业团建") return [
      { name: "山野默契", headline: `把团队带去${p}，找回办公室久违的默契。`, reason: "把团建与关系重建挂钩。", mood: "默契" },
      { name: "共同完成", headline: `${p}的${days}，让团队真正近一点。`, reason: "强调共同经历的价值。", mood: "协作" },
      { name: "换场思考", headline: `离开会议室，在${p}重新看见彼此。`, reason: "用场景转换激发团队活力。", mood: "转换" },
      ...generic
    ];

    if (a.type === "综合旅行") return [
      { name: "轻松打包", headline: `${days}，把${p}的好体验打包带走。`, reason: "强调一站式与省心。", mood: "省心" },
      { name: "慢慢来", headline: `在${p}，把假期过成羡慕的样子。`, reason: "强调松弛与品质。", mood: "松弛" },
      { name: "旅行杂志", headline: `${p} / ${a.days > 1 ? a.days + " DAYS" : "ONE DAY"}`, reason: "用 City Guide 语法展示已确认的旅行信息。", mood: "杂志" },
      ...generic
    ];

    if (isFamily || a.type === "亲子活动" || a.type === "研学") return [
      { name: "成长刻度", headline: dist ? `${p}${dist}，是孩子认识山野的第一条刻度。` : "不是带孩子走一次，是让他发现：原来我真的可以。", reason: "年龄与路线适合将真实的完成感作为主卖点。", mood: "成长" },
      { name: "自然课堂", headline: `第一次认识${p}，不需要从课本开始。`, reason: "把真实场地与孩子的感知体验连接起来。", mood: "探索" },
      { name: "陪伴时刻", headline: `这个周末，不赶时间。陪孩子好好走完${dist || "一段路"}。`, reason: "把家长的参与感和共同完成放在中心。", mood: "陪伴" },
      { name: "好奇心", headline: `${p}会替孩子问出很多问题，答案在路上。`, reason: "强调探索而非说教。", mood: "好奇" },
      ...generic
    ];

    // 通用户外 / 徒步：合并通用方向 + 气候 + 地点专属方向
    return [...hikeDirections, ...climateDirections(a), ...placeExtra];
  }


  function stableScore(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return h % 26;
  }
  // 按活动事实稳定打分。同一组事实输出一致，便于老板复用和测试。
  function scoreDirections(a, dirs) {
    const diff = a.difficulty || "轻松";
    const isFamily = isFamilyActivity(a);
    const days = a.days || 1;
    const dist = a.distance || 0;
    const flavor = placeFlavorFor(a);
    const hasSeason = !!flavor.seasonLine;
    const hasPlaceVibe = !!flavor.localVibe;
    const isWeekend = /周六|周日|周末|星期六|星期天/.test(a.dateMD || a.date || "");
    return dirs.map((d) => {
      let score = stableScore(`${a.raw || ""}|${d.name}|${d.headline}`);
      if (diff === "挑战" && d.mood === "挑战") score += 8;
      if (diff === "挑战" && d.mood === "成就") score += 6;
      if (days >= 2 && (d.mood === "完成" || d.mood === "远征")) score += 5;
      if (isFamily && (d.mood === "陪伴" || d.mood === "成长" || d.mood === "探索")) score += 7;
      if (!isFamily && (d.mood === "逃离" || d.mood === "诗意")) score += 4;
      if (!isFamily && isWeekend && d.mood === "逃离") score += 5;
      if (dist && (d.mood === "完成" || d.mood === "挑战")) score += 4;
      if (hasSeason && d.mood === "时令") score += 6;
      if (hasPlaceVibe && d.headline && d.headline.includes(a.place || "")) score += 6;
      // 徒步/户外类更偏好「真实」「感知」类方向，减少固定三种模板的出现概率
      if ((a.type === "徒步" || a.type === "户外探索") && ["真实", "感知", "诗意"].includes(d.mood)) score += 2;
      return { ...d, score };
    }).sort((x, y) => y.score - x.score);
  }

  /* ===== V2.0 洞察层：AI 只做内容策划，洞察必须引用本场具体事实，不补全事实 ===== */
  function buildInsight(a) {
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    const dist = a.distance ? a.distance + " 公里" : "";
    const days = a.days > 1 ? a.days + " 天" : "一天";
    const svc = [];
    const servicesConfirmed = confirmedFacts(a).some((f) => f.key === "services");
    if (servicesConfirmed && a.includeLeader) svc.push("领队");
    if (servicesConfirmed && a.includeMeal) svc.push("餐食");
    if (servicesConfirmed && a.includeInsurance) svc.push("保险");
    if (servicesConfirmed && a.includeTransport) svc.push("交通");
    if (servicesConfirmed && a.includeGear) svc.push("装备");

    const uniq = [];
    if (dist) uniq.push(dist);
    if (confirmed.has("age") && a.ageRange) uniq.push(a.ageRange);
    if (confirmed.has("limit") && a.limit) uniq.push("限 " + a.limit + a.limitUnit);
    if (confirmed.has("elevation") && a.elevation) uniq.push("海拔 " + a.elevation + " m");
    if (confirmed.has("days") && a.days > 1) uniq.push(days);
    if (confirmed.has("meeting") && confirmed.has("meetTime") && a.meeting && a.meetTime) uniq.push(a.meetTime + " " + a.meeting + " 集合");
    if (a.price != null) uniq.push("¥" + a.price + "/" + a.limitUnit);
    if (svc.length) uniq.push("已确认含" + svc.join("、"));

    const isFam = isFamilyActivity(a);
    let motivation = "用一段时间把自己从日常里抽离出来";
    if (isFam && a.type === "研学") motivation = "让孩子在真实场景里独立完成一件事";
    else if (isFam) motivation = "孩子完成一次可以感知的户外挑战";
    else if (a.type === "高海拔登山") motivation = "在有海拔目标的路线上验证自己的体能与经验";
    else if (a.type === "城市旅行" || a.type === "景区观光") motivation = "用最短的时间换一种生活节奏";
    else if (a.type === "露营") motivation = "把一整段连续的时间交还给自然";
    else if (a.type === "企业团建") motivation = "让团队在非工作场景里重新建立默契";
    else if (["滑雪", "攀岩", "骑行"].includes(a.type)) motivation = "把一项运动真正学会，而不只是体验一次";

    const isHard = a.type === "高海拔登山" || a.difficulty === "挑战" || (a.elevation && +a.elevation >= 3500);
    let core = "";
    if (isHard) {
      core = (a.elevation ? a.elevation + " 米" : (a.type === "高海拔登山" ? "雪线以上的强度" : "挑战级的强度")) + "决定了这不是一次轻松的出行，体能和经验都需要如实评估";
      if (a.days > 1) core += "，完整行程共 " + a.days + " 天";
    }
    else if (isFam && dist && a.ageRange) core = dist + " 是 " + a.ageRange + " 的孩子第一次自己掌握行走节奏的具体尺度";
    else if (isFam && dist) core = dist + " 把“陪孩子走一段”变成了一件可以被完成、被记住的事";
    else if (a.elevation) core = a.elevation + " 米的海拔差距，决定了这是一场需要认真准备的行程";
    else if (dist && a.days > 1) core = dist + " 压在 " + a.days + " 天里，强度是清晰可判断的";
    else if (dist) core = dist + " 把本次活动的路程变成了可以直接判断的具体数字";
    else if (a.limit) core = "本次招募上限为 " + a.limit + " " + a.limitUnit;
    else if (a.type === "城市旅行" || a.type === "景区观光") core = days + "的安排，把 " + a.place + " 的日常过成一段假期";
    else core = days + "的安排，让 " + a.place + " 成为一段不需要复杂准备就能出发的行程";

    let psp = "";
    if (isHard) psp = "用 " + days + " 认真完成一次" + (a.elevation ? a.elevation + " 米" : "高强度") + "的行程";
    else if (isFam && dist) psp = "用 " + dist + " 换来孩子一次“我自己走完了”的确认";
    else if (dist) psp = dist + "，一步一景地走完";
    else if (a.elevation) psp = "在 " + a.elevation + " 米的高度上重新看 " + a.place;
    else if (a.type === "城市旅行" || a.type === "景区观光") psp = "用 " + days + " 把 " + a.place + " 的城市节奏走一遍";
    else psp = "在 " + a.place + " 用 " + days + " 完成一次真实的户外";

    const support = [];
    if (isFam) support.push("家长全程同行，共同完成");
    if ((a.days || 1) <= 1) support.push("一天之内可以完成");
    else support.push(a.days + " 天的连续安排");
    if (svc.length) support.push("已确认含" + svc.join("、"));
    if (a.ageRange) support.push("适合 " + a.ageRange);

    const prohibited = [
      "自然教育课程", "专业认证", "独家路线", "小团/精品团", "避开大众路线",
      "网红机位/本地人私藏", "后勤保障", "全程安全管控", "应急预案", "海拔适应方案",
      "酒店/餐厅推荐", "领队资质", "未确认的保险/交通/餐食", "活动物料",
    ];
    if (a.type === "高海拔登山") prohibited.push("登顶承诺", "安全保障承诺");

    return {
      unique_facts: uniq,
      audience_motivation: motivation,
      core_insight: core,
      primary_selling_point: psp,
      supporting_points: support,
      prohibited_claims: prohibited,
      missing_facts: missingFacts(a).map((f) => f.label),
      confirmed_summary: confirmedFacts(a).map((f) => f.label + "：" + f.value),
    };
  }

  /* ===== V2.0 概念层：每次按洞察动态生成三个创意概念，三个必须是不同用户动机 ===== */
  const MOTIVATIONS = [
    { key: "achievement", label: "完成感", fit: (a) => !!a.distance || (a.days || 1) >= 2 || !!a.elevation,
      headline: (a) => a.distance ? a.distance + " 公里，是今天可以完整走完的一段路。" : a.days + " 天，把 " + a.place + " 走完一遍。",
      intro: (a) => (a.distance ? a.distance + " 公里" : a.days + " 天") + "不是一个靠意志硬撑的数字，而是被反复走过、确认过节奏的一条线。走完它不需要训练基础，但需要你真的走完全程。" + (a.ageRange ? "这也是 " + a.ageRange + " 能一起完成的长度。" : ""),
      story: "用距离/天数记录从出发到完成的变化",
      poster: (a) => a.distance ? "走完这 " + a.distance + " 公里。" : "用 " + a.days + " 天走完。",
      channel: "微信群 / 公众号",
      reason: (a) => (a.distance ? a.distance + " 公里" : a.days + " 天") + "是本场最容易被感知、也最容易形成完成感的事实" },

    { key: "companionship", label: "同行", fit: () => true,
      headline: (a) => isFamilyActivity(a) ? (a.distance ? a.distance + " 公里，不是孩子一个人的路。" : "这一天，陪孩子把 " + a.place + " 走完。") : "和一群同样想去 " + a.place + " 的人一起出发。",
      intro: (a) => isFamilyActivity(a) ? "这段路的意义不全在风景，而在于有人陪着走完。家长不用在旁边指挥，只是陪着，让孩子自己决定什么时候快、什么时候停。走完了，这件事会被记住很久。" : "一个人出发是旅行，一群人出发是经历。同行的都是奔着同一段路来的人，节奏相近，也不用互相迁就。",
      story: "人物互动与共同完成的过程",
      poster: (a) => isFamilyActivity(a) ? "陪他走完这一段。" : "和同路的人一起出发。",
      channel: "朋友圈 / 小红书",
      reason: (a) => isFamilyActivity(a) ? (a.ageRange || "亲子") + "决定了这场活动的决策者是家长，陪伴是最直接的动机" : "同行人群是这类活动复购与口碑的关键" },

    { key: "ease", label: "低门槛", fit: (a) => (a.days || 1) <= 1,
      headline: (a) => "一天来回，" + a.place + " 不用请假的走法。",
      intro: (a) => "不用提前训练，不用凑假期，也不用准备复杂装备。" + (a.meetTime ? a.meetTime + " 集合" : "早上集合") + "，" + (a.returnTime ? "大约 " + a.returnTime + " 返回" : "当天返回") + "，剩下的时间还是自己的。这是那种想去就能去的安排。",
      story: "用时间成本降低决策门槛",
      poster: () => "一天，来回。",
      channel: "微信群 / 小红书",
      reason: () => "单日活动的时间成本最低，“一天可完成”是最强的报名理由" },

    { key: "scarcity", label: "名额", fit: (a) => !!a.limit && a.limit <= 30,
      headline: (a) => a.limit + " " + a.limitUnit + "，这一场能被照顾到的规模。",
      intro: (a) => "这一场只收 " + a.limit + " " + a.limitUnit + "。人数不是用来制造紧张的，而是为了让每个人在路上都能被看见、被等到。" + (a.includeLeader ? "领队全程跟队，" : "") + "节奏按队伍的实际状态调整。",
      story: "用规模说明照顾程度",
      poster: (a) => a.limit + " " + a.limitUnit + "，报满为止。",
      channel: "微信群",
      reason: (a) => "限 " + a.limit + " " + a.limitUnit + " 是老板明确给出的规模，直接决定体验密度" },

    { key: "timing", label: "时机", fit: () => true,
      headline: (a) => (a.dateMD || "这个时节") + "，" + a.place + " 的样子只出现一次。",
      intro: (a) => "季节会决定同一条路的样子。" + (a.dateMD || "这个时节") + "的 " + a.place + "，光、温度和山色都和别的时候不一样。错过就要等下一年，这也是为什么它值得被单独安排一次。",
      story: "用时间限定制造出发理由",
      poster: (a) => (a.dateMD || "这一次") + "，就是现在。",
      channel: "朋友圈 / 小红书",
      reason: (a) => (a.dateMD || "日期") + "把这场活动限定在特定时间，是天然的出发理由" },

    { key: "growth", label: "成长", fit: (a) => isFamilyActivity(a) || a.type === "研学",
      headline: (a) => (a.ageRange || "这个年纪") + "，第一次自己掌握行走的节奏。",
      intro: () => "大人很容易替孩子决定速度和终点，但这段路留给孩子自己。什么时候快、什么时候歇、什么时候再站起来，都由他决定。走完之后，他会知道自己原来可以。",
      story: "记录孩子从依赖到独立的过程",
      poster: () => "这一次，让他自己走完。",
      channel: "小红书 / 公众号",
      reason: (a) => (a.ageRange || "孩子年龄") + "让“独立完成”成为家长真正在意的结果" },

    { key: "escape", label: "抽离", fit: (a) => (a.days || 1) <= 1,
      headline: (a) => "从 " + (a.meeting || "城市") + " 出发，" + (a.returnTime || "当天") + " 回到日常。",
      intro: (a) => "不需要长假期，也不需要复杂的计划。离开熟悉的环境一整天，把注意力交给路、风和身边发生的小事，再按时回来。这样的抽离，比一次长途旅行更容易重复。",
      story: "用出发与返回的时间结构说明可重复性",
      poster: () => "离开一天，再回来。",
      channel: "朋友圈",
      reason: (a) => (a.meetTime || "集合") + "到" + (a.returnTime || "返回") + "的完整时间结构，是最具体的可执行信息" },

    { key: "mastery", label: "专业", fit: (a) => ["高海拔登山", "攀岩", "滑雪", "骑行", "桨板或皮划艇", "溯溪"].includes(a.type),
      headline: (a) => a.elevation ? a.elevation + " 米，是一条对体能和经验都诚实的线。" : a.type + "不是体验一次，是认真学一次。",
      intro: (a) => "这条线路不会因为报名就变得容易。" + (a.elevation ? a.elevation + " 米的海拔" : "这项运动") + "要求你如实评估自己的体能和经验，也要求你按要求准备装备。把它当成一次认真的练习，而不是一次打卡。",
      story: "用海拔/强度/装备要求建立专业感",
      poster: (a) => a.elevation ? a.elevation + " 米，认真对待。" : "认真学一次。",
      channel: "公众号 / 微信群",
      reason: (a) => a.type + "的强度需要被如实呈现，专业表达反而更能建立信任" },
  ];

  // 不同活动的叙事重点不同：高海拔/高难度偏专业克制，城市偏生活方式，亲子偏成长与陪伴
  const MOTIVATION_WEIGHT = {
    "高海拔登山": { mastery: 12, achievement: 6, timing: 2, companionship: -10, escape: -12, ease: -12 },
    "攀岩": { mastery: 9, achievement: 4, companionship: -6 },
    "滑雪": { mastery: 9, achievement: 4, companionship: -4 },
    "骑行": { mastery: 5, achievement: 4 },
    "城市旅行": { escape: 5, ease: 3, timing: 3, achievement: -3 },
    "景区观光": { escape: 5, ease: 3, timing: 3, achievement: -3 },
    "亲子活动": { growth: 7, companionship: 5 },
    "研学": { growth: 7, achievement: 3 },
    "露营": { escape: 4, timing: 3, companionship: 2 },
  };
  function motivationWeight(a, key) {
    let w = (MOTIVATION_WEIGHT[a.type] || {})[key] || 0;
    if (a.difficulty === "挑战") {
      if (key === "mastery" || key === "achievement") w += 6;
      if (key === "ease" || key === "escape") w -= 8;
    }
    return w;
  }
  function buildConcepts(a) {
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    const place = a.place || "这次活动";
    const dist = a.distance ? `${a.distance}公里` : "";
    const days = a.days > 1 ? `${a.days}天` : "一天";
    const age = confirmed.has("age") ? (a.ageRange || "") : "";
    const limit = a.limit ? `${a.limit}${a.limitUnit}` : "";
    const elevation = a.elevation ? `${a.elevation}米` : "";
    const isFam = isFamilyActivity(a);
    const services = [];
    if (a.includeLeader) services.push("领队");
    if (a.includeMeal) services.push("餐食");
    if (a.includeInsurance) services.push("保险");
    if (a.includeTransport) services.push("交通");
    if (a.includeGear) services.push("装备");
    const safeServices = confirmed.has("services") ? services : [];
    const candidates = [];
    const add = (id, name, headline, intro, story, poster, reason, score) => candidates.push({
      id, motivation: id, motivationLabel: name, concept_name: name, name, mood: id,
      headline, intro, story_direction: story, poster_line: poster,
      channel: "活动页 / 微信 / 朋友圈", reason, score
    });

    if (dist && isFam) add(
      "measurable-growth", "一段可以完成的成长",
      `${dist}，是孩子第一次自己掌握行走节奏的具体尺度。`,
      `${place}把成长变成了一段看得见的距离。${age ? `这次活动面向${age}，` : ""}家长陪在身边，孩子用自己的节奏走完${dist}。`,
      "用距离记录孩子从出发到完成的变化", `这一次，让他自己走完${dist}。`,
      `${dist}${age ? `和${age}` : ""}是本场最具体、最有辨识度的事实。`, 100
    );
    if (elevation) add(
      "altitude", "高度是一条边界",
      `${elevation}，每一步都需要认真对待。`,
      `目的地是${place}，已知目标海拔为${elevation}${a.days > 1 ? `，行程共${days}` : ""}。页面不承诺登顶，只把强度、准备和真实行程说明白。`,
      "先讲海拔与强度，再讲风景", `${elevation}，认真对待。`,
      `海拔${elevation}直接决定用户是否适合参加。`, 96
    );
    if (dist) add(
      "distance", "路程有了刻度",
      `${place}，用${dist}把这次出发说清楚。`,
      `这不是一句模糊的“去山里走走”。本次${a.type}的已知距离是${dist}${a.days > 1 ? `，安排在${days}内完成` : ""}，用户可以据此判断自己的时间与体力。`,
      "围绕路线长度组织画面和信息", `${dist}，走完再回来。`,
      `${dist}让活动从抽象体验变成可判断的具体路线。`, 82
    );
    if (a.meetTime && a.returnTime) add(
      "time-window", "一天的完整去向",
      `${a.meetTime}出发，${a.returnTime}回来，把这一天交给${place}。`,
      `从${a.meetTime}${a.meeting ? `在${a.meeting}` : ""}集合，到${a.returnTime}返回，时间边界已经明确。对用户而言，这是一次可以直接放进日程里的${a.type}。`,
      "用出发与返回构成完整时间叙事", `${a.meetTime}出发，${a.returnTime}回来。`,
      `明确的出发与返回时间降低了报名决策成本。`, 88
    );
    if (a.days > 1) add(
      "duration", `${days}的连续体验`,
      `${days}，不是路过${place}，是把时间真正留在这里。`,
      `本次${a.type}共${days}${dist ? `，已知距离为${dist}` : ""}。页面将重点呈现每天的真实安排，让用户先理解节奏，再决定是否参加。`,
      "以每天的变化建立长线叙事", `把${days}留给${place}。`,
      `${days}是这场活动区别于单日体验的核心事实。`, 84
    );
    if (limit) add(
      "capacity", "名额是明确的",
      `这一场，只开放${limit}。`,
      `本次活动的招募上限是${limit}。不使用“精品小团”等未经确认的包装，只把真实名额、日期与报名信息清楚呈现。`,
      "用真实名额形成行动理由", `${limit}，本次招募。`,
      `招募上限来自老板输入，可以直接用于报名转化。`, 72
    );
    if (safeServices.length) add(
      "confirmed-service", "已确认的省心",
      `${safeServices.join("、")}，已经写进这次${place}的安排。`,
      `本次已经确认包含${safeServices.join("、")}。页面只展示这些明确服务，不补充酒店、交通、安全承诺或其他未确认项目。`,
      "把已确认服务放在决策信息中", `已确认包含${safeServices.join("、")}。`,
      `这些服务来自老板输入，是可以对外表达的真实信息。`, 68
    );
    add(
      "specific-invitation", "把活动说具体",
      `${a.dateMD || "这一次"}，去${place}完成一场${a.type}。`,
      `${a.dateMD ? `时间是${a.dateMD}，` : ""}地点是${place}，活动是${a.type}${age ? `，面向${age}` : ""}${a.price != null ? `，费用为${a.price}元/${a.limitUnit}` : ""}。信息足够清楚，出发才不需要靠想象。`,
      "用已确认事实建立可信邀请", `${a.dateMD || "这一次"}，去${place}。`,
      "当独特素材较少时，清楚准确比空泛抒情更有说服力。", 45
    );

    const seen = new Set();
    return candidates
      .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id))
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      .slice(0, 3)
      .map(({ score, ...c }) => c);
  }



  // V2.0：标题分三类——品牌型（创意概念主宣传语，必须引用具体事实）/ 信息型 / 招募型

  /* 有温度、结合季节/气候/地点、不堆砌日期的详情页引言；按创意方向的情绪变化文体 */






  // 多平台文案：公式化（Hook+场景+干货+召唤）+ 去 AI 味，复用已确认事实




  function parseDateBase(dstr) {
    if (!dstr) return null;
    const m = dstr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const m2 = dstr.match(/(\d{1,2})月(\d{1,2})日/);
    if (m2) return new Date(curYear(), +m2[1] - 1, +m2[2]);
    return null;
  }
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  // 行程录入：机构粘贴真实行程（微信/Word/旧文案），AI 只负责分段与整理，不编造事实
  const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  function cn2num(s) {
    if (/^\d+$/.test(s)) return +s;
    if (CN_NUM[s]) return CN_NUM[s];
    if (s.length === 2 && CN_NUM[s[0]] === 10) return 10 + (CN_NUM[s[1]] || 0);
    return 1;
  }
  function parseItinerary(text) {
    if (!text || !text.trim()) return [];
    const lines = text.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
    const days = [];
    let cur = null;
    const pushCur = () => { if (cur) days.push(cur); };
    for (const line of lines) {
      let m;
      if ((m = line.match(/^(?:第\s*)?([一二三四五六七八九十\d]+)\s*(?:天|日|Day|day)(?=$|\s|：|·)/i))) {
        pushCur();
        const n = cn2num(m[1]);
        cur = { label: `第 ${n} 天`, sub: "", items: [] };
        const rest = line.replace(/^(?:第\s*)?([一二三四五六七八九十\d]+)\s*(?:天|日|Day|day)(?=$|\s|：|·)/i, "").trim();
        if (rest) cur.items.push({ time: "", text: rest });
        continue;
      }
      if ((m = line.match(/^day\s*(\d+)/i))) {
        pushCur();
        const n = +m[1];
        cur = { label: `第 ${n} 天`, sub: "", items: [] };
        const rest = line.replace(/^day\s*\d+/i, "").trim();
        if (rest) cur.items.push({ time: "", text: rest });
        continue;
      }
      let time = "", text2 = line;
      if ((m = line.match(/^(\d{1,2})[:：](\d{2})\s*[：: ]*\s*(.*)$/))) { time = `${m[1]}:${m[2]}`; text2 = m[3]; }
      else if ((m = line.match(/^(\d{1,2})\s*点\s*(?:[：: ]*)\s*(.*)$/))) { time = `${m[1]}:00`; text2 = m[2]; }
      else if ((m = line.match(/^(上午|早上|中午|下午|傍晚|晚上|凌晨)\s*[：: ]*\s*(.*)$/))) { time = m[1]; text2 = m[2]; }
      if (!cur) cur = { label: "行程安排", sub: "", items: [] };
      if (text2) cur.items.push({ time, text: text2 });
    }
    pushCur();
    if (!days.length) days.push({ label: "行程安排", sub: "", items: [{ time: "", text: text.trim() }] });
    return days;
  }
  // 保证 itineraryDays 数量与 days 一致（空天仅占位，等机构填充真实内容）
  function syncItineraryDays(a) {
    const n = Math.max(1, a.days || 1);
    const arr = a.itineraryDays || [];
    const out = [];
    for (let i = 0; i < n; i++) {
      if (arr[i]) out.push(arr[i]);
      else out.push({ label: n > 1 ? `第 ${i + 1} 天` : "行程安排", sub: "", items: [] });
    }
    a.itineraryDays = out;
  }

  /* ---------------- equipment intelligence ---------------- */
  const EQUIP_DB = {
    hiking: {
      mandatory: ["徒步/运动鞋", "双肩背包", "饮用水（≥1L）", "防晒用品", "雨具", "手机与充电宝", "个人证件"],
      recommended: ["登山杖", "速干衣裤", "替换衣物", "能量零食", "驱蚊液", "头灯/小手电", "垃圾袋"],
    },
    camping: {
      mandatory: ["帐篷", "睡袋", "防潮垫", "头灯/营地灯", "营地炊具", "饮用水与食物", "保暖衣物"],
      recommended: ["天幕", "折叠椅", "充电宝", "防蚊用品", "拖鞋", "洗漱包", "急救包", "垃圾袋"],
    },
    cycling: {
      mandatory: ["头盔", "骑行手套", "水壶/水袋", "备胎与修车工具", "反光背心", "手机"],
      recommended: ["骑行眼镜", "速干衣", "防晒", "能量补给", "小背包", "雨衣"],
    },
    rafting: {
      mandatory: ["救生衣", "防水袋", "防滑鞋", "换洗衣物", "毛巾", "防晒"],
      recommended: ["防水手机袋", "溯溪鞋", "速干衣", "能量零食", "保温杯"],
    },
    climbing: {
      mandatory: ["安全带", "头盔", "攀岩鞋", "主锁/保护器", "粉袋", "手机"],
      recommended: ["防滑粉", "运动手套", "能量补给", "防晒", "保暖层"],
    },
    skiing: {
      mandatory: ["滑雪服", "雪镜", "手套", "头盔", "保暖内层", "防晒（高原强紫外线）"],
      recommended: ["护具", "雪袜", "暖宝宝", "能量零食", "润唇膏"],
    },
    general: {
      mandatory: ["运动鞋", "饮用水", "防晒用品", "雨具", "替换衣物", "手机"],
      recommended: ["双肩包", "能量零食", "充电宝", "驱蚊液", "湿巾"],
    },
    city: {
      mandatory: ["舒适运动鞋", "轻便双肩包", "充电宝", "雨具", "防晒用品", "身份证件"],
      recommended: ["水杯", "小零食", "耳机", "纸巾湿巾", "随身小药包"],
    },
  };
  function equipType(type) {
    if (/徒步|登山|爬山/.test(type)) return "hiking";
    if (/露营|营地/.test(type)) return "camping";
    if (/骑行|自行车/.test(type)) return "cycling";
    if (/漂流|桨板|皮划艇|溯溪/.test(type)) return "rafting";
    if (/攀岩/.test(type)) return "climbing";
    if (/滑雪/.test(type)) return "skiing";
    if (/城市|景区|观光|旅行|自驾|摄影|团建/.test(type)) return "city";
    return "general";
  }


  function gearChipsHtml(a, must) {
    return (a.gear || [])
      .filter((g) => (typeof g === "string" ? false : g.must) === must)
      .map((g) => {
        const name = typeof g === "string" ? g : g.name;
        const note = typeof g === "object" && g.note ? g.note : "";
        const noteHtml = note ? `<span class="gnote" title="${esc(note)}">${esc(note)}</span>` : "";
        return `<span class="gear-chip ${note ? "has-note" : ""}"><span class="gname">${esc(name)}</span>${noteHtml}<button class="gx" data-action="delGear" data-name="${esc(name)}">${ICON("x")}</button></span>`;
      }).join("");
  }
  function gearIcon(name) {
    if (/鞋|靴/.test(name)) return "shoe";
    if (/雨|防水/.test(name)) return "umbrella";
    if (/包/.test(name)) return "bag";
    if (/水|水杯|保温杯|饮水/.test(name)) return "droplet";
    if (/食|餐|零食|干粮|补给|能量/.test(name)) return "food";
    if (/充电|电池/.test(name)) return "battery";
    if (/衣|服|保暖|速干|替换/.test(name)) return "shirt";
    if (/防晒|墨镜|雪镜|太阳/.test(name)) return "sun";
    if (/头灯|手电|营灯|灯/.test(name)) return "headlamp";
    if (/帐|帐篷/.test(name)) return "tent";
    if (/头盔|帽/.test(name)) return "shield";
    if (/相机|手机/.test(name)) return "camera";
    if (/登山杖|杖/.test(name)) return "mountain";
    if (/证件|身份证/.test(name)) return "book";
    return "ruler";
  }

  // 智能解析用户粘贴的大段装备建议文本，拆分为结构化装备项
  function parseGearText(text) {
    if (!text || text.trim().length < 2) return [];
    let s = text.replace(/\s+/g, " ").replace(/[;；]/g, "；").trim();

    // 定位装备清单开始位置
    const markers = ["装备建议", "建议携带", "必备装备", "需要准备", "装备清单", "携带物品", "建议准备"];
    let start = -1;
    for (const m of markers) { const i = s.indexOf(m); if (i > -1) { start = i + m.length; break; } }
    if (start > -1) s = s.slice(start);
    s = s.replace(/^[：:\s]+/, "");

    // 按句号/分号切分成句
    const sentences = s.split(/[；。]/).map((x) => x.trim()).filter((x) => x.length > 1);
    if (!sentences.length && s.includes("、")) sentences.push(s);

    const out = [];
    sentences.forEach((sentence) => {
      const sent = sentence.replace(/^\d+[\.、]/, "").trim();
      // 判断是必备还是建议：含"可备/建议/可选/备用"即为建议，否则必备
      const isMust = !/可备|建议携带|可选|备用|酌情|自行/.test(sent);
      // 去掉常见动词前缀
      let content = sent;
      const verbs = ["穿着", "可备", "准备", "携带", "带上", "备好", "建议", "需", "需要", "请", "如"];
      for (const v of verbs) { if (content.startsWith(v)) { content = content.slice(v.length); break; } }

      const parts = splitGearParts(content).filter((p) => p && !/等用品|等物品|等$/.test(p));
      parts.forEach((part) => {
        const item = parseGearItem(part);
        if (item) { item.must = isMust; out.push(item); }
      });
    });

    // 去重
    const seen = new Set();
    return out.filter((it) => { const k = it.name + "|" + it.note; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  // 按顿号切分，但保护括号内的顿号不被误拆
  function splitGearParts(s) {
    const parts = [];
    let cur = "", depth = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "（" || ch === "(") depth++;
      else if (ch === "）" || ch === ")") depth--;
      if (ch === "、" && depth === 0) { parts.push(cur); cur = ""; }
      else cur += ch;
    }
    if (cur) parts.push(cur);
    return parts.map((p) => p.trim());
  }
  function parseGearItem(str) {
    let name = str.trim();
    let note = "";
    const m1 = name.match(/（([^）]+)）/);
    const m2 = name.match(/\(([^)]+)\)/);
    if (m1) { note = m1[1].trim(); name = name.replace(/（[^）]+）/, "").trim(); }
    else if (m2) { note = m2[1].trim(); name = name.replace(/\([^)]+\)/, "").trim(); }
    name = name.replace(/[及和等]$/, "").trim();
    if (name.length < 2) return null;
    return { name, note, must: false };
  }

  function departuresEditHtml(a) {
    syncDepartures(a);
    const deps = a.departures || [];
    const list = deps.map((d) => {
      const price = d.price != null ? d.price : (a.price || "");
      return `<div class="departure-card">
        <div class="dep-date">
          <div class="dep-week">${esc(d.weekDay || "")}</div>
          <div class="dep-md">${esc(formatDepartureSlash(d.date))}</div>
        </div>
        <div class="dep-fields">
          <input type="number" class="input input-sm" data-bind-dep="${d.id}" data-dep-key="price" value="${price}" placeholder="价格">
          <select class="select select-sm" data-bind-dep="${d.id}" data-dep-key="status">
            <option value="open" ${d.status === "open" ? "selected" : ""}>可报名</option>
            <option value="full" ${d.status === "full" ? "selected" : ""}>已满员</option>
            <option value="closed" ${d.status === "closed" ? "selected" : ""}>已截止</option>
          </select>
          <input type="text" class="input input-sm" data-bind-dep="${d.id}" data-dep-key="note" value="${esc(d.note || "")}" placeholder="备注，如余位3">
        </div>
        <button class="icon-btn" data-action="deleteDeparture" data-id="${d.id}" title="删除团期">${ICON("x")}</button>
      </div>`;
    }).join("");
    return `<div class="panel">
      <div class="panel-head"><h3>行程与团期</h3><span class="tiny muted">一个活动可设置多个出发日期，每个团期可独立定价</span></div>
      <div class="panel-body">
        <div class="departure-add-row">
          <div class="field">
            <label>开始日期</label>
            <input type="date" class="input" id="depStartDate">
          </div>
          <div class="field">
            <label>结束日期（可选）</label>
            <input type="date" class="input" id="depEndDate">
          </div>
          <div class="field">
            <label>价格（可选）</label>
            <input type="number" class="input" id="depPriceInput" placeholder="默认 ¥${a.price || 0}">
          </div>
          <button class="btn btn-primary btn-sm" data-action="addDeparture">${ICON("plus")} 批量添加团期</button>
        </div>
        <div class="dep-hint"><span style="opacity:.7"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span> 选择起止日期可批量生成每一天的团期；只填开始日期则添加单日。已存在日期会自动跳过。</div>
        ${deps.length ? `<div class="departure-list">${list}</div>` : `<div class="dep-empty"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg><div><b>还没有团期</b><div>在上方选择日期范围，一键生成多日团期</div></div></div>`}
      </div>
    </div>`;
  }

  function memberMarketingEditHtml(a) {
    const tiers = state.memberTiers || [];
    const priceRows = tiers.map((t) => {
      const price = (a.tierPrices || {})[t.id];
      return `<div class="tier-price-row"><span class="tier-name" style="color:${esc(t.color)}">${ICON(t.icon)} ${esc(t.name)}</span><input type="number" class="input input-sm" data-bind-tier="${t.id}" value="${price != null ? price : ""}" placeholder="默认 ¥${a.price || 0}"></div>`;
    }).join("");
    return `<div class="panel">
      <div class="panel-head"><h3>会员与营销</h3><span class="tiny muted">每个俱乐部可独立设定会员体系与活动优惠规则</span></div>
      <div class="panel-body">
        <div class="opt-row">
          <label class="switch-label">
            <input type="checkbox" ${a.useMemberPrice ? "checked" : ""} data-action="toggleActOpt" data-key="useMemberPrice">
            <span>执行会员价</span>
          </label>
          <p class="tiny muted">开启后，不同等级会员报名时显示对应价格；不填则自动 fallback 到活动基础价</p>
          ${a.useMemberPrice ? `<div class="tier-price-list">${priceRows}</div>` : ""}
        </div>
        <div class="opt-row">
          <label class="switch-label">
            <input type="checkbox" ${a.allowPoints ? "checked" : ""} data-action="toggleActOpt" data-key="allowPoints">
            <span>接受会员积分抵现</span>
          </label>
          <p class="tiny muted">开启后会员可用积分抵扣部分报名费用</p>
        </div>
        <div class="opt-row">
          <label class="switch-label">
            <input type="checkbox" ${a.allowCoupons ? "checked" : ""} data-action="toggleActOpt" data-key="allowCoupons">
            <span>接受优惠券</span>
          </label>
          <p class="tiny muted">开启后会员可在报名时使用本俱乐部发放的优惠券</p>
        </div>
      </div>
    </div>`;
  }

  function leaderEditHtml(a) {
    ensureLeaders();
    const leaders = state.leaders || [];
    const editingId = a._editingLeaderId || "";
    const editing = editingId ? findLeaderById(editingId) : null;
    // 优先展示本次上传的草稿头像，未上传时才回落到资料库已有头像
    const avatar = (a._leaderAvatarDraft || "").trim() || (editing ? editing.avatar : "");
    const selectedCount = (a.leaderIds || []).length;
    return `<div class="panel" style="margin-bottom:18px">
      <div class="panel-head"><h3>领队与安全保障</h3><span class="tiny muted">据实填写，前端仅展示真实信息</span></div>
      <div class="panel-body">
        <div class="leader-library">
          <div class="tiny muted" style="margin-bottom:8px">从领队资料库选择（已保存 ${leaders.length} 位${selectedCount ? " · 本场已选 " + selectedCount + " 位" : ""}）</div>
          <div class="leader-chips">
            ${leaders.map((l) => {
              const sel = (a.leaderIds || []).includes(l.id);
              const isEditing = editingId === l.id;
              const av = l.avatar
                ? `<img class="lc-av" src="${esc(l.avatar)}" alt="">`
                : `<span class="lc-av-fallback" style="background:linear-gradient(140deg,var(--accent),#A86B2C)">${esc((l.name || "领")[0])}</span>`;
              return `<span class="leader-chip-wrap">
              <button class="leader-chip ${sel ? "sel" : ""} ${isEditing ? "editing" : ""}" data-action="toggleLeader" data-id="${l.id}">${av}<span>${esc(l.name)}${l.cert ? ` · ${esc(l.cert)}` : ""}</span></button>
              <button class="leader-chip-edit" data-action="editLeader" data-id="${l.id}" title="编辑资料">${ICON("edit")}</button>
            </span>`;
            }).join("")}
            <button class="leader-chip ghost" data-action="newLeader">+ 新建领队</button>
          </div>
        </div>

        <div class="leader-form-card">
          <div class="leader-form-head">
            <div class="leader-avatar-upload" data-action="uploadLeaderAvatar">
              ${avatar
                ? `<img class="leader-av-preview" src="${esc(avatar)}" alt=""><button class="logo-del" data-action="delLeaderAvatar" title="移除头像">${ICON("x")}</button>`
                : `<div class="leader-av-ph"><div class="ic">${ICON("upload")}</div><span>上传头像</span></div>`}
            </div>
            <input type="file" id="leaderAvatarInput" accept="image/*" style="display:none">
            <div class="leader-form-title">${editing ? "编辑领队资料" : "新建领队"}</div>
          </div>
          <div class="grid-2">
            <div class="field"><label>领队姓名 / 昵称</label><input class="input" data-bind="leaderName" value="${esc(a.leaderName || "")}"></div>
            <div class="field"><label>从业经验</label><input class="input" data-bind="leaderYears" value="${esc(a.leaderYears || "")}" placeholder="如：8 年户外领队"></div>
            <div class="field"><label>相关资质</label><input class="input" data-bind="leaderCert" value="${esc(a.leaderCert || "")}" placeholder="如：中国登山协会指导员"></div>
            <div class="field"><label>带队场次</label><input class="input" data-bind="leaderTrips" value="${esc(a.leaderTrips || "")}" placeholder="如：200+ 场"></div>
          </div>
          <div class="row gap-8" style="margin-top:10px">
            <button class="btn btn-soft btn-sm" data-action="saveLeader">${editing ? "保存到资料库" : "保存并加入活动"}</button>
            <button class="btn btn-ghost btn-sm" data-action="newLeader">清空/新建</button>
            ${editing && (a.leaderIds || []).includes(editingId) ? `<button class="btn btn-ghost btn-sm" data-action="removeLeaderFromActivity" data-id="${editingId}">从本场活动移除</button>` : ""}
            ${editing ? `<button class="btn btn-ghost btn-sm btn-danger" data-action="deleteLeader" data-id="${editingId}">从资料库删除</button>` : ""}
          </div>
        </div>
        <div class="tiny muted" style="margin-top:10px">领队头像上传后系统自动裁剪为圆形；未选择领队时，前端自动隐藏此模块，不生成虚假资质。</div>
      </div>
    </div>`;
  }
  function itineraryEditHtml(a) {
    const days = a.itineraryDays || [];
    const dayBlocks = days.map((day, di) => {
      const items = day.items.map((item, ii) => `
        <div class="itin-row">
          <input class="input itin-time" data-bind-itin="time" data-day="${di}" data-idx="${ii}" value="${esc(item.time)}" placeholder="时间">
          <input class="input itin-text" data-bind-itin="text" data-day="${di}" data-idx="${ii}" value="${esc(item.text)}" placeholder="行程内容">
          <button class="btn btn-ghost btn-sm" data-action="delItinItem" data-day="${di}" data-idx="${ii}">${ICON("x")}</button>
        </div>
      `).join("");
      return `
        <div class="itin-day">
          <div class="itin-day-head"><b>${esc(day.label)}</b><span class="tiny muted">${esc(day.sub)}</span></div>
          <div class="itin-items">${items}</div>
          <button class="btn btn-soft btn-sm" data-action="addItinItem" data-day="${di}">+ 添加行程项</button>
        </div>
      `;
    }).join("");
    const itinNar = (typeof itinContentHtml === "function") ? itinContentHtml(a) : "";
    return `
      <div class="panel" style="margin-bottom:18px">
        <div class="panel-head"><h3>详细行程 · 共 ${a.days || 1} 天</h3><span class="tiny muted">结构型行程（真实时间表）· 你手动调整，AI 不增删事件</span></div>
        <div class="panel-body">
          ${dayBlocks}
          ${itinNar ? `<div class="itin-express-note"><span class="tiny muted">内容型行程（体验叙事预览，自动从上方真实行程生成，保留真实时间、不编造事件）</span>${itinNar}</div>` : ""}
          <div class="row gap-8" style="margin-top:12px">
            <button class="btn btn-soft btn-sm" data-action="regenItinerary">重新生成行程</button>
            <button class="btn btn-soft btn-sm" data-action="addItinDay" ${(a.days || 1) >= 7 ? "disabled" : ""}>+ 增加一天</button>
            <button class="btn btn-ghost btn-sm" data-action="delItinDay" ${(a.days || 1) <= 1 ? "disabled" : ""}>- 减少一天</button>
          </div>
        </div>
      </div>`;
  }

  /* ---------------- brand logo helpers ---------------- */
  function psLogo(white) {
    const b = state.brand;
    const inner = b.logo
      ? `<img class="l l-img" src="${esc(b.logo)}" alt="">`
      : `<span class="l"${white ? ' style="background:rgba(255,255,255,.25)"' : ""}>${esc(b.logoText || "C")}</span>`;
    return `<span class="ps-logo"${white ? ' style="color:#fff"' : ""}>${inner}${esc(b.name)}</span>`;
  }
  function brandMark() {
    const b = state.brand;
    if (b.logo) return `<div class="brand-logo brand-logo-img" style="background-image:url('${esc(b.logo)}')"></div>`;
    return `<div class="brand-logo">${esc(b.logoText || "C")}</div>`;
  }
  function orgLogo() {
    const b = state.brand;
    if (b.logo) return `<div class="org-logo org-logo-img" style="background-image:url('${esc(b.logo)}')"></div>`;
    return `<div class="org-logo">${esc(b.logoText || "C")}</div>`;
  }
  function gearRender(a, must, gearProduct) {
    const items = (a.gear || []).filter((g) => (typeof g === "string" ? false : g.must) === must);
    if (!items.length) return "";
      return `<div class="gear-group"><div class="gear-group-h">${must ? "必备装备" : "建议携带"}</div>
      <div class="gear-flow">${items.map((g) => {
        const name = typeof g === "string" ? g : g.name;
        const note = typeof g === "object" && g.note ? g.note : "";
        const hit = gearProduct && gearProduct[name];
        return `<div class="gear-item ${note ? "has-note" : ""} ${hit ? "has-mall" : ""}"><span class="gi">${ICON(gearIcon(name))}</span><div class="gi-text"><span class="gi-name">${esc(name)}</span>${note ? `<span class="gi-note">${esc(note)}</span>` : ""}</div>${hit ? `<button class="gi-link" data-action="mallProduct" data-id="${hit.id}" data-srctype="ai_gear_list" data-srcid="${a.id}"><span class="gi-member-t">商城同款</span><span class="gi-member-badge">会员价</span></button>` : ""}</div>`;
      }).join("")}</div></div>`;
  }

  // —— P3 活动 × 装备融合：把活动装备清单匹配到商城商品 ——
  // 关键词 → 商品标题/类目 谓词，避免泛化活动标签导致误匹配
  const GEAR_MATCH = [
    { kw: ["鞋", "徒步鞋", "登山鞋", "越野"], test: (p) => /(鞋)/.test(p.title + p.category) },
    { kw: ["杖", "手杖"], test: (p) => /杖/.test(p.title) },
    { kw: ["水", "饮水", "杯", "保温", "路餐"], test: (p) => /(水具|水壶|杯)/.test(p.category + p.title) },
    { kw: ["防晒", "帽", "渔夫帽"], test: (p) => /(帽)/.test(p.category + p.title) || /防晒/.test((p.tags || []).join()) },
    { kw: ["雨", "雨衣", "雨备"], test: (p) => /(雨具|雨衣)/.test(p.category + p.title) },
    { kw: ["灯", "照明", "头灯"], test: (p) => /(照明|灯)/.test(p.category + p.title) },
    { kw: ["包", "背包", "重装"], test: (p) => /(背包)/.test(p.category + p.title) },
    { kw: ["手套"], test: (p) => /手套/.test(p.title) },
    { kw: ["袜"], test: (p) => /袜/.test(p.title) },
    { kw: ["收纳", "袋"], test: (p) => /(收纳)/.test(p.category + p.title) },
    { kw: ["补给", "能量", "胶", "电解质"], test: (p) => /(补给)/.test(p.category + p.title) },
    { kw: ["营钉", "帐篷", "睡袋", "露营", "营地"], test: (p) => /(露营|睡眠)/.test(p.category + p.title) },
    { kw: ["头盔", "攀登", "攀岩", "雪山"], test: (p) => /(安全装备|头盔|绳|安全带)/.test(p.category + p.title) },
    { kw: ["安全带"], test: (p) => /安全带/.test(p.title) },
    { kw: ["绳"], test: (p) => /绳/.test(p.title) },
    { kw: ["防风", "外套", "冲锋衣"], test: (p) => /(冲锋衣|外套|防风)/.test(p.title) }
  ];
  // 推荐优先级：匹配 > 安全 > 品质 > 评价 > 价格 > 佣金（佣金绝不参与排序）
  function matchGearProducts(a) {
    const prods = state.mallProducts || [];
    const matchedIds = new Set();
    const gearProduct = {};
    (a.gear || []).forEach((g) => {
      const name = typeof g === "string" ? g : (g && g.name) || "";
      if (!name) return;
      for (const rule of GEAR_MATCH) {
        if (rule.kw.some((k) => name.indexOf(k) >= 0)) {
          // 只推荐商城在售有货商品（stock 为 null 视为不限库存）
          const hit = prods.find((p) => rule.test(p) && (p.stock == null || p.stock > 0));
          if (hit) { matchedIds.add(hit.id); if (!gearProduct[name]) gearProduct[name] = hit; }
          break;
        }
      }
    });
    return { matchedIds, gearProduct };
  }

  // —— 地点风景图：联网自动搜索 ——
  // 主源：Wikimedia Commons（CORS 友好、免 Key）；备用：Flickr 公共 feed（JSONP）。
  // 结果按地点缓存，老板可手动更换。
  const placePhotoCache = {};
  function fetchPlacePhotos(place, cb) {
    cb = cb || function () {};
    if (!place) { cb([]); return; }
    const key = String(place).trim();
    if (placePhotoCache[key]) { cb(placePhotoCache[key]); return; }
    let finished = false;
    let fkScript = null;
    let fkCbName = "";
    const cleanupFlickr = () => {
      try { if (fkCbName) delete window[fkCbName]; } catch (e) {}
      if (fkScript && fkScript.parentNode) fkScript.parentNode.removeChild(fkScript);
    };
    const done = (res) => {
      if (finished) return; finished = true;
      cleanupFlickr();
      const arr = (res || []).slice(0, 8);
      if (arr.length) placePhotoCache[key] = arr;
      cb(arr);
    };

    // 1) Wikimedia Commons（CORS + 免 Key）
    fetch("https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=" + encodeURIComponent(key) + "&prop=imageinfo&iiprop=url|thumburl&gsrlimit=12&format=json&origin=*")
      .then((r) => r.json())
      .then((data) => {
        const pages = (data && data.query && data.query.pages) || {};
        const arr = Object.values(pages).map((p) => {
          const ii = (p.imageinfo && p.imageinfo[0]) || {};
          return { src: ii.url || ii.thumburl || "", title: (p.title || "").replace(/^File:/, ""), author: "Wikimedia Commons" };
        }).filter((x) => x.src);
        if (arr.length) done(arr); else tryFlickr();
      })
      .catch(() => tryFlickr());

    // 2) Flickr 公共 feed（JSONP 备用）
    function tryFlickr() {
      if (finished) return;
      let fkDone = false;
      fkCbName = "fkcb_" + Math.random().toString(36).slice(2);
      window[fkCbName] = function (data) {
        const items = ((data && data.items) || []).map((it) => ({
          src: (it.media && it.media.m ? it.media.m.replace(/_m\.jpg$/, "_b.jpg") : ""),
          title: it.title || "",
          author: (it.author || "").replace(/^.*\("(.+)"\)\s*$/, "$1")
        })).filter((x) => x.src);
        if (!fkDone) { fkDone = true; done(items.slice(0, 8)); }
      };
      fkScript = document.createElement("script");
      fkScript.src = "https://www.flickr.com/services/feeds/photos_public.gne?tags=" + encodeURIComponent(key.replace(/\s+/g, ",")) + "&tagmode=any&format=json&jsoncallback=" + fkCbName;
      fkScript.onerror = () => { if (!fkDone) { fkDone = true; done([]); } };
      document.head.appendChild(fkScript);
      setTimeout(() => { if (!fkDone) { fkDone = true; done([]); } }, 7000);
    }

    setTimeout(() => done([]), 14000);
  }

  // 按活动类型 / 地点 / 季节 / 天气智能推荐装备清单（同时匹配商城商品）
  // 规则本地可跑、零依赖：依据 a.type/title/place、seasonOf(a)、a.elevation、天气关键词产出必备+建议，
  // 写入 a.gear 并去重；随后详情页经 matchGearProducts 自动挂「商城同款」。
  function autoRecommendGear(a) {
    if (!a) return { added: 0, total: 0 };
    const season = seasonOf(a);
    const typeText = ((a.type || "") + " " + (a.title || "") + " " + (a.place || ""));
    const elev = Number(a.elevation) || 0;
    const weatherText = ((a.raw || "") + " " + (a.weather || ""));
    const has = (...kws) => kws.some((k) => typeText.indexOf(k) >= 0);
    const wHas = (...kws) => kws.some((k) => weatherText.indexOf(k) >= 0);

    // 1) 活动分类（决定装备主调）
    let cat = "hike";
    if (has("雪山", "高海拔", "技术", "攀冰") || elev >= 3500) cat = "alpine";
    else if (has("漂流", "溯溪", "溪降", "皮划艇", "桨板", "水域", "漂流")) cat = "water";
    else if (has("露营", "营地", "过夜", "野营", "帐篷")) cat = "camp";
    else if (has("亲子", "研学", "自然教育", "少儿", "儿童", "亲子活动")) cat = "family";
    else if (has("骑行", "自行车", "公路车")) cat = "cycling";

    // 2) 通用基础必备（所有户外）
    const must = [
      { name: "徒步鞋/登山鞋", note: "防滑、包裹脚踝" },
      { name: "速干衣裤", note: "避免棉质，出汗不闷" },
      { name: "双肩背包", note: "装水与补给，20-30L" },
      { name: "饮用水", note: "人均 1.5L 起" },
      { name: "路餐/能量补给", note: "坚果、能量棒" },
      { name: "防晒帽", note: "遮挡紫外线" },
      { name: "防晒霜", note: "SPF50+" },
      { name: "身份证", note: "报名与保险核验" }
    ];
    const recommend = [
      { name: "登山杖", note: "下坡护膝" },
      { name: "雨衣", note: "山区天气多变" },
      { name: "头灯", note: "防天黑" },
      { name: "充电宝", note: "手机续航" },
      { name: "替换衣物", note: "返程更换" }
    ];

    // 3) 分类补充
    if (cat === "alpine") {
      must.push(
        { name: "硬壳冲锋衣", note: "防风防水" },
        { name: "保暖中层", note: "抓绒或羽绒" },
        { name: "雪镜/墨镜", note: "防雪盲与紫外线" }
      );
      recommend.push(
        { name: "头盔", note: "技术路段保护" },
        { name: "保暖手套", note: "高海拔防护" },
        { name: "保温杯", note: "喝热水" }
      );
    } else if (cat === "water") {
      must.push(
        { name: "溯溪鞋/防滑凉鞋", note: "湿滑路面抓地" },
        { name: "防水袋", note: "保护手机衣物" },
        { name: "速干毛巾", note: "" }
      );
      recommend.push(
        { name: "换洗衣物", note: "全套备用" },
        { name: "防晒衣", note: "水上暴晒" }
      );
    } else if (cat === "camp") {
      must.push(
        { name: "帐篷", note: "按人数选择" },
        { name: "睡袋", note: "按夜温选择" },
        { name: "防潮垫", note: "" },
        { name: "营地灯", note: "" }
      );
      recommend.push(
        { name: "炉具/套锅", note: "热食" },
        { name: "折叠椅", note: "" },
        { name: "防风绳/营钉", note: "" }
      );
    } else if (cat === "family") {
      must.push(
        { name: "儿童防晒", note: "温和不刺激" },
        { name: "备用衣物", note: "多带一套" }
      );
      recommend.push(
        { name: "小背包", note: "孩子自己背" },
        { name: "驱蚊液", note: "" },
        { name: "湿巾", note: "" }
      );
    } else if (cat === "cycling") {
      must.push(
        { name: "骑行头盔", note: "必备" },
        { name: "骑行手套", note: "防滑" }
      );
      recommend.push(
        { name: "骑行镜", note: "" },
        { name: "反光背心", note: "夜骑可见" }
      );
    }

    // 4) 季节补充
    if (season === "冬季" || (season === "秋季" && cat === "alpine")) {
      must.push({ name: "保暖手套", note: "" }, { name: "抓绒帽", note: "护耳" });
      recommend.push({ name: "暖宝宝", note: "" });
    } else if (season === "夏季") {
      recommend.push({ name: "驱蚊液", note: "" }, { name: "降温巾", note: "" });
    }

    // 5) 海拔 / 天气补充
    if (elev >= 3000 || wHas("雪", "降温", "寒冷", "低温", "严寒")) {
      recommend.push({ name: "羽绒服", note: "高海拔保暖" });
    }
    if (wHas("雨", "雷阵雨", "降水", "潮湿", "小雨")) {
      if (!must.some((g) => g.name === "雨衣")) must.push({ name: "雨衣", note: "一次性或便携" });
    }
    if (wHas("大风", "阵风", "强风")) {
      recommend.push({ name: "防风外套", note: "" });
    }

    // 6) 合并去重写入 a.gear
    const arr = a.gear || [];
    const exists = new Set(arr.map((g) => (typeof g === "string" ? g : (g && g.name) || "")));
    let added = 0;
    [...must.map((g) => ({ ...g, must: true })), ...recommend.map((g) => ({ ...g, must: false }))].forEach((g) => {
      if (!g.name || exists.has(g.name)) return;
      arr.push(g); exists.add(g.name); added++;
    });
    a.gear = arr;
    confirmFact(a, "gear");
    saveState();
    return { added, total: arr.length, cat, season };
  }

  function gearMallRecs(a, matchedIds) {
    const prods = state.mallProducts || [];
    const riskW = { L3: 300, L2: 200, L1: 100 };
    return prods.map((p) => {
      const matched = matchedIds.has(p.id);
      const score = (matched ? 10000 : 0) + (riskW[p.riskLevel] || 0) + (p.rating || 0) * 50 - (p.retailPrice || 0) / 50;
      return { p, score, matched };
    }).sort((x, y) => y.score - x.score).slice(0, 6);
  }
  function renderGearMall(a, matchedIds) {
    const recs = gearMallRecs(a, matchedIds);
    if (!recs.length) return "";
    return `<div class="gear-mall">
      <div class="gear-mall-h"><span>${ICON("shopping-bag")}</span> 可在商城一站式备齐 · 按「安全 &gt; 评价 &gt; 价格」推荐，正品直发、7 天无理由</div>
      <div class="gear-mall-grid">${recs.map((r) => `<button class="gear-mall-card" data-action="mallProduct" data-id="${r.p.id}" data-srctype="ai_gear_list" data-srcid="${a.id}">
        <div class="gmc-ph" ${smartBg(r.p.cover)}></div>
        <div class="gmc-body">
          <div class="gmc-title">${esc(r.p.title)}</div>
          <div class="gmc-meta"><span class="gear-type g-${r.p.riskLevel}">${gearTypeLabel(r.p.riskLevel)}</span><span class="mall-rate">★ ${r.p.rating}</span>${r.matched ? `<span class="gmc-match">清单匹配</span>` : ""}</div>
          <div class="gmc-foot"><b>¥${r.p.retailPrice}</b><span class="gmc-go">查看 ${ICON("arrow-right")}</span></div>
        </div>
      </button>`).join("")}</div>
    </div>`;
  }

  /* ---------------- smart focus / auto best crop ---------------- */
  // V1.3.2+ 智能焦点：纯浏览器 Canvas 分析，零后端，自动识别主体并给出 object-position / background-position。
  const PHOTO_FOCUS_CACHE = new Map();
  const PHOTO_FOCUS_PENDING = new Set();
  function focusValue(src) { return PHOTO_FOCUS_CACHE.get(src) || { x: 50, y: 45 }; }
  function updateSmartFocus(src, focus) {
    const pos = `${focus.x}% ${focus.y}%`;
    // v190：分析完成后回填图片真实比例，让「原比例展示(contain)」的容器等比例贴合图片，左右不再出现留白色块
    if (focus && focus.ratio) {
      const ar = Math.max(0.62, Math.min(2.6, Number(focus.ratio) || 0));
      document.querySelectorAll("figure.xh-ed-fig[data-ar-auto]").forEach((fig) => {
        const im = fig.querySelector("img");
        if (im && im.getAttribute("src") === src) {
          fig.style.setProperty("--ar", ar);
          fig.classList.remove("s-tall", "s-wide", "s-square");
          fig.classList.add(ar < 0.95 ? "s-tall" : (ar > 1.32 ? "s-wide" : "s-square"));
          // 极端长图比例被收敛后，容器不再等于原图比例 → 撤掉 contain，避免重新露出留白
          if (Math.abs(ar - Number(focus.ratio)) > 0.001 && fig.classList.contains("ph-safe")) {
            fig.classList.remove("ph-safe");
            const im2 = fig.querySelector("img");
            if (im2) im2.style.objectFit = "cover";
          }
        }
      });
      document.querySelectorAll(".itin-day-photo[data-ar-auto]").forEach((box) => {
        const im = box.querySelector("img");
        if (im && im.getAttribute("src") === src) box.style.setProperty("--ar", ar);
      });
    }
    document.querySelectorAll("img[data-smart-img]").forEach((img) => {
      if (img.getAttribute("src") === src) img.style.objectPosition = pos;
    });
    document.querySelectorAll("[data-smart-bg]").forEach((el) => {
      if (el.getAttribute("data-smart-bg") === src) el.style.backgroundPosition = pos;
    });
  }
  function smartImg(src, alt) {
    return `<img data-smart-img src="${esc(src)}" alt="${esc(alt || '')}" style="object-position:${smartPos(src)}">`;
  }
  function smartBg(src) {
    return `data-smart-bg="${esc(src)}" style="background-image:url('${esc(src)}');background-position:${smartPos(src)};"`;
  }
  function analyzeImageFocus(src) {
    // P0-6：fallback 也携带归一化信号字段（缺省中性值），tagPhoto 才能稳定识别
    const fallback = () => ({ x: 50, y: 45, ratio: 1.5, orientation: "landscape", quality_score: 0.6, category: "未分析", emotion: "真实", subjects: [], focal_point: { x: 0.5, y: 0.45 }, safe_text_area: "top-right", recommended_use: ["story"], duplicate_group: null, simulated: true,
      avgLum: 128, sat: 0.2, edge: 10, blueRatio: 0.1, warmRatio: 0.15, skinRatio: 0, people_count: 0, motionScore: 0, pHash: null });
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const max = 200, scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(28, Math.round(img.naturalWidth * scale));
          const h = Math.max(28, Math.round(img.naturalHeight * scale));
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          const cx = c.getContext("2d", { willReadFrequently: true });
          cx.drawImage(img, 0, 0, w, h);
          const px = cx.getImageData(0, 0, w, h).data;
          const cells = [], gx = 14, gy = 14;
          const lumAt = (x, y) => { const i = (Math.min(h-1,y)*w + Math.min(w-1,x))*4; return px[i]*.299 + px[i+1]*.587 + px[i+2]*.114; };
          const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
          const isPortrait = ratio < 0.87;
          const isLandscape = ratio > 1.15;
          for (let yy=0; yy<gy; yy++) for (let xx=0; xx<gx; xx++) {
            const x0=Math.floor(xx*w/gx), x1=Math.max(x0+1,Math.floor((xx+1)*w/gx));
            const y0=Math.floor(yy*h/gy), y1=Math.max(y0+1,Math.floor((yy+1)*h/gy));
            let edge=0, hEdge=0, vEdge=0, sat=0, contrast=0, count=0, lum=0, skin=0, blue=0, warm=0;
            for(let y=y0; y<y1; y+=2) for(let x=x0; x<x1; x+=2){
              const i=(y*w+x)*4, r=px[i],g=px[i+1],b=px[i+2], hi=Math.max(r,g,b),lo=Math.min(r,g,b), l=r*.299+g*.587+b*.114;
              const dh = Math.abs(l-lumAt(Math.min(w-1,x+2),y));
              const dv = Math.abs(l-lumAt(x,Math.min(h-1,y+2)));
              edge += dh + dv; hEdge += dh; vEdge += dv;
              sat += hi ? (hi-lo)/hi : 0;
              contrast += Math.abs(l-150); lum += l; count++;
              if (r > 80 && r < 240 && g > 40 && g < 200 && b > 20 && b < 170 && r - g > 8 && g - b > 8 && r > g && g > b) skin++;
              if (b > r + 20 && b > g) blue++;
              if (r > g && g > b) warm++;
            }
            const n = Math.max(1, count);
            const ny=(yy+.5)/gy, nx=(xx+.5)/gx;
            const centerPrior = 1 - Math.min(.45, Math.abs(nx-.5)*.6);
            const ruleOfThirdsY = isPortrait ? 0.32 : (isLandscape ? 0.42 : 0.45);
            const thirdPrior = 0.82 + 0.18 * Math.max(0, 1 - Math.abs(ny - ruleOfThirdsY) * 4);
            const rawScore=(edge/n)*2.6 + (sat/n)*72 + (contrast/n)*.14 + (skin/n)*18;
            const structureBoost = (hEdge > vEdge * 1.25 && edge/n > 12) ? 1.08 : 1;
            const score=rawScore * centerPrior * thirdPrior * structureBoost;
            cells.push({ x:(xx+.5)*100/gx, y:(yy+.5)*100/gy, score, rawScore, edge: edge/n, sat: sat/n, contrast: contrast/n, lum: lum/n, skin: skin/n, blue: blue/n, warm: warm/n });
          }
          cells.sort((a,b)=>b.score-a.score);
          const chosen=cells.slice(0,Math.max(6,Math.round(cells.length*.15)));
          let sw=0,sx=0,sy=0; chosen.forEach(v=>{const wt=Math.max(.01,v.score);sw+=wt;sx+=v.x*wt;sy+=v.y*wt;});
          let fx=Math.round(Math.max(18,Math.min(82,sx/sw))), fy=Math.round(Math.max(18,Math.min(82,sy/sw)));
          const rawTop=cells.slice().sort((a,b)=>b.rawScore-a.rawScore).slice(0,Math.max(4,Math.round(cells.length*.10)));
          if(rawTop.length){
            const rawTopY=rawTop.reduce((s,v)=>s+v.y,0)/rawTop.length;
            const rawTopScore=rawTop.reduce((s,v)=>s+v.rawScore,0)/rawTop.length;
            const bottomCells=cells.filter(v=>v.y>55);
            const bottomScore=bottomCells.length?bottomCells.reduce((s,v)=>s+v.rawScore,0)/bottomCells.length:0;
            const topStrong = rawTopY < 48 && rawTopScore > (bottomScore * 1.05 + 0.01);
            const hasFace = rawTop.some(v => v.skin > 0.08);
            if (topStrong || hasFace) {
              const targetY = Math.round(Math.max(30, Math.min(55, rawTopY + 6)));
              fy = Math.min(fy, targetY);
            }
          }
          const focusCell = cells.find(v => Math.abs(v.x - fx) < 8 && Math.abs(v.y - fy) < 8);
          if (focusCell && focusCell.lum > 180 && focusCell.edge < 10) {
            fy = Math.min(70, Math.max(fy, 55));
          }
          resolve(buildPhotoMeta(img, fx, fy, cells));
        } catch(e) { resolve(fallback()); }
      };
      img.onerror = () => resolve(fallback());
      if (/^https?:\/\//.test(src)) { img.crossOrigin = "anonymous"; img.referrerPolicy = "no-referrer"; }
      img.src = src;
    });
  }

  /* V2.0 图片理解层
     真实计算：焦点坐标、横竖朝向、画质评分、文字安全区（基于像素统计）
     模拟推断：类别、主体、情绪（无视觉模型时的启发式结果，UI 必须标注「模拟分析（演示）」） */
  function buildPhotoMeta(img, fx, fy, cells) {
    const W = img.naturalWidth || 1, H = img.naturalHeight || 1;
    const ratio = W / H;
    const orientation = ratio > 1.15 ? "landscape" : (ratio < 0.87 ? "portrait" : "square");
    const avg = (k) => cells.reduce((s, v) => s + (v[k] || 0), 0) / Math.max(1, cells.length);
    const edge = avg("edge"), sat = avg("sat"), contrast = avg("contrast"), lum = avg("lum");
    // P0-6：新增内容识别信号（供 tagPhoto 做 14 类识别，不依赖上传顺序）
    const blueRatio = Math.max(0, Math.min(1, avg("blue")));
    const warmRatio = Math.max(0, Math.min(1, avg("warm")));
    const skinRatio = Math.max(0, Math.min(1, avg("skin")));
    const peopleCount = skinRatio > 0.20 ? 3 : (skinRatio > 0.10 ? 2 : (skinRatio > 0.04 ? 1 : 0));
    const motionScore = edge > 16 ? Math.max(0, Math.min(1, (edge - 12) / 22)) : 0;
    const quality = Math.max(0.35, Math.min(0.99, 0.42 + edge / 850 + contrast / 700 + Math.min(0.14, Math.min(W, H) / 5200)));
    // 文字安全区：选边缘最少、亮度适中的象限
    const quad = (bx, by) => { const q = cells.filter(v => v.x >= bx && v.x < bx + 50 && v.y >= by && v.y < by + 50); if (!q.length) return null; return { e: q.reduce((s,v)=>s+v.edge,0)/q.length, l: q.reduce((s,v)=>s+v.lum,0)/q.length }; };
    const qs = [["top-left", quad(0,0)], ["top-right", quad(50,0)], ["bottom-left", quad(0,50)], ["bottom-right", quad(50,50)]].filter(x => x[1]);
    let safe = "top-right";
    if (qs.length) safe = qs.slice().sort((a,b) => (a[1].e + Math.abs(a[1].l-170)*0.25) - (b[1].e + Math.abs(b[1].l-170)*0.25))[0][0];
    // —— 以下为启发式模拟，不可作为真实识别结果对外宣称 ——
    let category = "环境/细节", emotion = "真实", subjects = ["环境"];
    if (sat > 0.34 && edge > 16) { category = "山野/植被"; subjects = ["植被", "地形"]; }
    else if (lum > 165) { category = "天空/开阔地"; subjects = ["天空", "远景"]; }
    else if (edge > 24) { category = "人物/动态"; subjects = ["人物"]; }
    if (lum < 95) emotion = "沉静"; else if (sat > 0.3) emotion = "明快";
    const rec = [];
    if (quality >= 0.7 && orientation !== "portrait") rec.push("hero");
    rec.push("story");
    if (orientation === "portrait") rec.push("full");
    if (quality < 0.58) rec.push("detail");
    // P0-6：感知哈希（8x8，降采样 14x14 亮度网格 → 按中位亮度二值化），供重复图检测
    let phLo = 0, phHi = 0;
    try {
      const g8 = [];
      for (let gy8 = 0; gy8 < 8; gy8++) for (let gx8 = 0; gx8 < 8; gx8++) {
        let sum = 0, cnt = 0;
        cells.forEach((c) => {
          const cx8 = Math.min(7, Math.floor(c.x / 12.5)), cy8 = Math.min(7, Math.floor(c.y / 12.5));
          if (cx8 === gx8 && cy8 === gy8) { sum += c.lum; cnt++; }
        });
        g8.push(cnt ? sum / cnt : 128);
      }
      const med = g8.slice().sort((a, b) => a - b)[Math.floor(g8.length / 2)];
      g8.forEach((v, idx) => { if (v >= med) { if (idx < 32) phLo |= (1 << idx); else phHi |= (1 << (idx - 32)); } });
    } catch (e) { phLo = 0; phHi = 0; }
    return {
      x: fx, y: fy,
      ratio: Math.round(ratio * 1000) / 1000,
      category, orientation, emotion, subjects,
      quality_score: Math.round(quality * 100) / 100,
      focal_point: { x: Math.round(fx) / 100, y: Math.round(fy) / 100 },
      safe_text_area: safe,
      recommended_use: rec,
      duplicate_group: null,
      simulated: true,
      // P0-6 内容识别信号（归一化，供 tagPhoto）
      avgLum: Math.round(lum), sat: Math.round(sat * 1000) / 1000, edge: Math.round(edge * 100) / 100,
      blueRatio: Math.round(blueRatio * 1000) / 1000, warmRatio: Math.round(warmRatio * 1000) / 1000,
      skinRatio: Math.round(skinRatio * 1000) / 1000, people_count: peopleCount, motionScore: Math.round(motionScore * 1000) / 1000,
      pHash: { lo: phLo >>> 0, hi: phHi >>> 0 },
    };
  }
  function photoMeta(src) { return PHOTO_FOCUS_CACHE.get(src) || null; }

  function scheduleSmartFocus(src) {
    if (!src || PHOTO_FOCUS_CACHE.has(src) || PHOTO_FOCUS_PENDING.has(src)) return;
    PHOTO_FOCUS_PENDING.add(src);
    analyzeImageFocus(src).then((focus) => {
      PHOTO_FOCUS_CACHE.set(src, focus); updateSmartFocus(src, focus); PHOTO_FOCUS_PENDING.delete(src);
    });
  }
  function smartPos(src) {
    if (!src) return "center";
    scheduleSmartFocus(src);
    const f = focusValue(src);
    return `${f.x}% ${f.y}%`;
  }
  function bestCoverIndex(a) {
    const photos = (a && a.photos) || [];
    if (!photos.length) return 0;
    let best = 0, bestScore = -1;
    photos.forEach((src, i) => {
      const meta = photoMeta(src);
      if (!meta) return;
      const uses = meta.recommended_use || [];
      const score = (meta.quality_score || 0) * 100
        + (uses.includes("hero") ? 35 : 0)
        + (meta.orientation === "landscape" ? 18 : 0)
        + ((meta.subjects || []).length ? 8 : 0)
        - (meta.category === "天空" ? 24 : 0);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  }
  function coverStyle(a) {
    if (a.photos && a.photos[0]) return `background-image:url('${a.photos[0]}');background-position:${smartPos(a.photos[0])};`;
    return "";
  }
  // 详情页按活动类型切换版式 + 图文混排（模块化合，类型决定顺序与视觉基调）
  const STYLE_ACCENT = {
    city:   { grad: "linear-gradient(135deg,#1d2742,#3b2c52)", accent: "#E8B04B", vibe: "城市漫游 · 老街、夜景与烟火气" },
    sight:  { grad: "linear-gradient(135deg,#26473b,#3a5a4a)", accent: "#7FC8A9", vibe: "景区观光 · 慢游不赶路" },
    hike:   { grad: "linear-gradient(135deg,#233a2c,#3f5e3a)", accent: "#9CCC65", vibe: "山野徒步 · 一步一景" },
    alpine: { grad: "linear-gradient(135deg,#1a1a1a,#3a3a3a)", accent: "#E6E6E6", vibe: "高海拔登山 · 云端之上" },
    camp:   { grad: "linear-gradient(135deg,#3a2e22,#5a4a35)", accent: "#E0A96D", vibe: "露营 · 星空与篝火" },
    kids:   { grad: "linear-gradient(135deg,#ffd9c0,#ffb0a3)", accent: "#FF7043", vibe: "亲子户外 · 自然里的成长" },
    ski:    { grad: "linear-gradient(135deg,#1e3a5f,#3a6ea5)", accent: "#B3E5FC", vibe: "滑雪 · 雪道与速度" },
    cycling:{ grad: "linear-gradient(135deg,#2a2640,#4a3a5a)", accent: "#CE93D8", vibe: "骑行 · 风与路" },
    run:    { grad: "linear-gradient(135deg,#3a2626,#5a3a3a)", accent: "#FF8A65", vibe: "跑步 · 节奏与坚持" },
    climb:  { grad: "linear-gradient(135deg,#2a2626,#4a3a2a)", accent: "#FFB74D", vibe: "攀岩 · 向上每一步" },
    water:  { grad: "linear-gradient(135deg,#123a4a,#2a6a7a)", accent: "#4DD0E1", vibe: "溯溪玩水 · 清凉一夏" },
    drive:  { grad: "linear-gradient(135deg,#2a2a3a,#4a4a5a)", accent: "#90CAF9", vibe: "自驾旅行 · 自由在路上" },
    photo:  { grad: "linear-gradient(135deg,#2a263a,#5a3a4a)", accent: "#F48FB1", vibe: "摄影旅行 · 把风景带回家" },
    team:   { grad: "linear-gradient(135deg,#1f3a2a,#3a5a4a)", accent: "#81C784", vibe: "企业团建 · 一起出发" },
    travel: { grad: "linear-gradient(135deg,#2a3a4a,#4a5a6a)", accent: "#4DB6AC", vibe: "综合旅行 · 去远方" },
    outdoor:{ grad: "linear-gradient(135deg,#233a2c,#3f5e3a)", accent: "#9CCC65", vibe: "户外探索 · 把周末交给自然" },
  };
  /* Case 1：暖调照片（暖占比达标且横向风景为主）→ 页面强调色/氛围整体调暖。
     不改动活动类型带来的基础渐变与字号体系，只把 accent 与 hero 遮罩调暖，肉眼可辨。 */
  const STYLE_ACCENT_WARM = { accent: "#D98A3D" };
  function styleAccent(a) {
    const base = STYLE_ACCENT[(a && a.pageStyle)] || STYLE_ACCENT.outdoor;
    const cp = photoContentProfile((a && a.photos) || []);
    if (cp.warmthLabel === "暖调" && cp.landscapeRatio >= 0.6) {
      return { grad: base.grad, accent: STYLE_ACCENT_WARM.accent, vibe: base.vibe + " · 暖调", warm: true };
    }
    return base;
  }
  function emotionLine(a) {
    if (a.headline) return a.headline;
    const T = a.type || "";
    if (/亲子|遛娃|儿童|少年|自然教育/.test(T)) return "这个周末，把手机还给孩子，把自然还给孩子。";
    if (/研学/.test(T)) return "最好的课堂，从来不带围墙。";
    if (/滑雪/.test(T)) return "雪季不该只活在收藏夹里。";
    if (/骑行/.test(T)) return "风、公路和自由，这次都给你。";
    if (/攀岩/.test(T)) return "抬头是岩壁与天空，低头是那个不敢尝试的自己。";
    if (/溯溪|桨板|漂流|玩水/.test(T)) return "夏天该有的样子，就是和水在一起。";
    if (/跑步|马拉松/.test(T)) return "不为 PB，只为那一程山风与晨光。";
    if (/自驾/.test(T)) return "方向盘一转，把周末交给公路、山谷和日落。";
    if (/摄影/.test(T)) return "把眼睛重新打开，把风景装进镜头。";
    if (/团建|企业/.test(T)) return "把团队带去山野，找回办公室里久违的默契。";
    if (/高海拔|雪山|登山/.test(T)) return "每一步，都在把海拔换成具体的体感。";
    if (/露营|营地/.test(T)) return "把闹钟关掉，去山里听一夜风声。";
    if (/徒步|爬山/.test(T)) return "城市待太久了，山风该吹一吹了。";
    if (/城市/.test(T)) return "城市待久了，总得找个周末，把一座城慢慢走完。";
    if (/景区|观光/.test(T)) return "不用做攻略，把假期过成朋友圈最羡慕的样子。";
    if (/旅行|游/.test(T)) return "你只管放松，剩下的交给山野。";
    return "走出城市，把周末交给自然。";
  }
  function coreTags(a) {
    const t = [];
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    if (confirmed.has("days") && a.days > 1) t.push(a.days + " 天行程");
    if (confirmed.has("age")) { const ar = cleanFactText(a.ageRange, 24); if (ar) t.push("适合" + ar); }
    if (confirmed.has("difficulty")) t.push(a.difficulty + "难度");
    if (confirmed.has("limit")) t.push("限额" + a.limit + a.limitUnit);
    if (confirmed.has("services") && a.includeLeader) t.push("含领队");
    return t.slice(0, 4);
  }
  /* P0-3/P0-9/P0-11：页面级图片智能缓存（渲染期间由 renderActivityPhone 注入，同步渲染安全） */
  let PAGE_PHOTO_INTEL = null;
  /* P0-9：详情页的「内容段落」标准序（用于图片-段落语义匹配，而不是纯数量分组） */
  function pagePhotoSections(a) {
    const s = [];
    if (!a) return s;
    if (a.whyGo) s.push({ h: "为什么值得去", kind: "scenic" });
    if (a.experience) s.push({ h: "来了会体验什么", kind: "experience" });
    if (a.gain) s.push({ h: "参加完你能得到什么", kind: "people" });
    if ((a.itineraryDays || []).length) s.push({ h: "详细行程", kind: "route" });
    if ((a.gear || []).length) s.push({ h: "装备建议", kind: "gear" });
    if (a.price != null) s.push({ h: "费用说明", kind: "info" });
    return s;
  }
  function setPagePhotoIntel(a) {
    PAGE_PHOTO_INTEL = (a && typeof buildPhotoIntelligence === "function")
      ? buildPhotoIntelligence(a.photos || [], a, pagePhotoSections(a), "recruit") : null;
    return PAGE_PHOTO_INTEL;
  }
  function pagePhotoIntel() { return PAGE_PHOTO_INTEL; }
  /* P0-9：行程段落 → 匹配图（供详情页「详细行程」在每一天旁配对应图片） */
  function pageItineraryPhotos(a) {
    if (!PAGE_PHOTO_INTEL || typeof matchItineraryPhotos !== "function") return null;
    const itin = (typeof structureItinerary === "function") ? structureItinerary(a) : null;
    if (!itin || !itin.timeline.length) return null;
    return matchItineraryPhotos(itin.timeline, PAGE_PHOTO_INTEL.used, PAGE_PHOTO_INTEL.roles, (a && a.activityDNA) || null);
  }
  function pagePhotoRisk(src) {
    if (!PAGE_PHOTO_INTEL) return null;
    const p = PAGE_PHOTO_INTEL.analysis.find((x) => x.src === src);
    if (!p) return null;
    const c = PAGE_PHOTO_INTEL.cropSafety.byId[p.imageId];
    return c ? c.level : null;
  }
  function pagePhotoRole(src) {
    if (!PAGE_PHOTO_INTEL) return null;
    const p = PAGE_PHOTO_INTEL.analysis.find((x) => x.src === src);
    return p ? (PAGE_PHOTO_INTEL.roles[p.imageId] || null) : null;
  }
  /* P0-11 安全裁切：判断某张图在「通用 4/3 卡片容器」(等价于 ImagePair) 是否必须原比例展示(contain)。
     含人物 / 竖图关键景物 / 高风险 → 必须 contain，宁留白不裁主体；横/方风景无人 → 可 cover。 */
  function pagePhotoContain(src) {
    if (!PAGE_PHOTO_INTEL) return false;
    const p = PAGE_PHOTO_INTEL.analysis.find((x) => x.src === src);
    if (!p) return false;
    const c = PAGE_PHOTO_INTEL.cropSafety.byId[p.imageId] || (typeof evaluateCropSafety === "function" ? evaluateCropSafety(p) : null);
    if (!c) return false;
    if (c.level === "high") return true;
    const safe = (typeof safePatternsOf === "function") ? safePatternsOf(p, c) : null;
    if (!safe) return false;
    return safe.indexOf("ImagePair") < 0;
  }
  function mediaBlock(a, i, label) {
    const ph = (a.photos || []);
    if (ph[i]) {
      // P0-B：统一走 CropPolicy —— 高风险图强制原比例(contain)，最终渲染不得因容器比例改回 cover
      const cr = (typeof cropRenderOf === "function") ? cropRenderOf(ph[i]) : { contain: (typeof pagePhotoContain === "function" ? pagePhotoContain(ph[i]) : false), pos: smartPos(ph[i]), mode: "cover", risk: "low" };
      const contain = cr.contain;
      // P0-8：角色决定视觉重要度——给容器打上角色类，CSS 据此差异化尺寸/透明度
      const role = (typeof pagePhotoRole === "function") ? pagePhotoRole(ph[i]) : null;
      const roleCls = role && PI_ROLES && PI_ROLES[role] ? PI_ROLES[role].cls : "";
      const roleAttr = role ? ` data-role="${role}"` : "";
      return `<div class="ph ${roleCls} ${contain ? "ph-safe" : ""}"${roleAttr} data-crop-mode="${cr.mode}" data-crop-risk="${cr.risk}"><img class="ph-img" data-smart-img src="${ph[i]}" alt="" style="object-position:${cr.pos};object-fit:${contain ? "contain" : "cover"}"></div>`;
    }
    const ac = styleAccent(a);
    return `<div class="ph ph-ph" style="background:${ac.grad}"><span class="ph-ic">${ICON("camera")}</span><span class="ph-lab">${esc(label || "现场实拍")}</span></div>`;
  }
  function galleryLayoutFor(a) {
    const p = a.pageStyle;
    if (p === "hike" || p === "alpine" || p === "ski") return "mosaic";
    if (p === "city" || p === "water") return "split";
    return "cards"; // kids, camp, sight, fallback
  }
  function galleryTitleFor(a) {
    const p = a.place || "这里";
    switch (a.pageStyle) {
      case "hike": return `${p}的山野，比滤镜更真实`;
      case "alpine": return `高处的人，最先看见光`;
      case "city": return `${p}的另一种打开方式`;
      case "camp": return `营地不是终点，是暂停`;
      case "water": return `水是${p}夏天的真实形状`;
      case "ski": return `雪季该有的样子，${p}都有`;
      case "kids": return `让孩子看见真实的世界`;
      case "sight": return `${p}的光，值得被认真看见`;
      default: return `走进现场，感受这次出发`;
    }
  }
  function galleryCaption(a) {
    // 优先用一段与 headline 不重复的地点季节短句
    const f = placeFlavorFor(a);
    if (f.seasonLine && a.headline && !a.headline.includes(f.seasonLine.slice(0, 10))) {
      return f.seasonLine.replace(/[。]$/, "") + "，照片里是没加修饰的真实现场。";
    }
    // 次选：从介绍中抽一句非 headline 的段落
    if (a.intro) {
      const paras = a.intro.split(/\n+/).map((s) => s.trim()).filter((s) => s && !s.includes(a.headline || "__NOHEAD__"));
      if (paras[0]) return paras[0].length > 44 ? paras[0].slice(0, 44) + "…" : paras[0];
    }
    // 兜底
    if (f.localVibe) return f.localVibe;
    return "照片记录的是活动的真实现场。";
  }
  function blockGallery(a) {
    const n = (a.photos || []).length;
    if (!n) return "";
    const title = galleryTitleFor(a);
    const caption = galleryCaption(a);
    const layout = galleryLayoutFor(a);
    const copy = `<span>FIELD NOTES</span><b>${esc(a.headline || title)}</b><small>${esc(caption)}</small>`;
    let inner;
    if (n === 1) {
      inner = `<div class="editorial-gallery one">${mediaBlock(a,0,"")}<div class="photo-note"><b>${esc(a.headline || title)}</b><span>${esc(caption)}</span></div></div>`;
    } else if (n === 2) {
      inner = `<div class="editorial-gallery two ${layout}"><div class="photo-a">${mediaBlock(a,0,"")}</div><div class="photo-copy">${copy}</div><div class="photo-b">${mediaBlock(a,1,"")}</div></div>`;
    } else {
      inner = `<div class="editorial-gallery many ${layout}"><div class="photo-a">${mediaBlock(a,0,"")}</div><div class="photo-b">${mediaBlock(a,1,"")}</div><div class="photo-copy">${copy}</div><div class="photo-c">${mediaBlock(a,2,"")}</div></div>`;
    }
    return `<section class="dsec story-sec editorial-sec"><div class="editorial-index">03 / MOMENTS</div><h3>${title}</h3>${inner}</section>`;
  }
  function departuresBlockHtml(a) {
    syncDepartures(a);
    const deps = (a.departures || []).filter((d) => d.status !== "closed");
    if (!deps.length) return "";
    if (deps.length === 1) {
      const d = deps[0];
      const price = d.price != null ? d.price : a.price;
      return `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("calendar")}</span><h3>行程与团期</h3></div>
        <div class="departure-single">
          <div class="dep-single-date"><span class="dep-single-week">${esc(d.weekDay)}</span><span class="dep-single-md">${esc(formatDepartureSlash(d.date))}</span></div>
          <div class="dep-single-info">
            <div class="dep-single-price">${price != null ? "¥" + price + "<small>/" + esc(a.limitUnit) + "</small>" : "价格详询"}</div>
            ${d.note ? `<div class="dep-single-note">${esc(d.note)}</div>` : ""}
          </div>
        </div>
      </div>`;
    }
    const cards = deps.map((d) => {
      const price = d.price != null ? d.price : a.price;
      const disabled = d.status === "full";
      return `<div class="departure-slide ${disabled ? "full" : ""}" data-departure-id="${d.id}">
        <div class="dep-slide-week">${esc(d.weekDay)}</div>
        <div class="dep-slide-md">${esc(formatDepartureSlash(d.date))}</div>
        <div class="dep-slide-price">${price != null ? "¥" + price : "详询"}</div>
        ${d.note ? `<div class="dep-slide-note">${esc(d.note)}</div>` : ""}
        ${disabled ? `<div class="dep-slide-badge">已满员</div>` : ""}
      </div>`;
    }).join("");
    return `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("calendar")}</span><h3>行程与团期</h3></div>
      <div class="departure-swiper">
        <div class="departure-track">${cards}</div>
      </div>
      <div class="tiny muted" style="margin-top:6px">左右滑动查看可报名团期，报名时请选择对应日期。</div>
    </div>`;
  }

  function blockLeader(a) {
    const ids = a.leaderIds || [];
    if (!ids.length) return "";
    const list = ids.map((id) => findLeaderById(id)).filter(Boolean);
    if (!list.length) return "";
    const cards = list.map((l, i) => {
      const rows = [];
      if (l.years) rows.push(["从业经验", l.years]);
      if (l.cert) rows.push(["相关资质", l.cert]);
      if (l.trips) rows.push(["带队场次", l.trips]);
      const av = l.avatar
        ? `<div class="leader-av leader-av-img" style="background-image:url('${esc(l.avatar)}')"></div>`
        : `<div class="leader-av">${esc((l.name || "领")[0])}</div>`;
      const tag = i === 0 ? "主领队" : (i === list.length - 1 ? "收尾领队" : "协作领队");
      const rowsHtml = rows.map(([k, v]) => `<div class="leader-meta-row"><span class="leader-meta-label">${esc(k)}</span><span class="leader-meta-value">${esc(v)}</span></div>`).join("");
      return `<div class="leader-slide-card leader-slide-card-v2">
        <div class="leader-top">
          ${av}
          <div class="leader-name-line"><span class="leader-name-text">${esc(l.name)}</span><span class="leader-tag">${tag}</span></div>
        </div>
        ${rowsHtml ? `<div class="leader-meta">${rowsHtml}</div>` : ""}
      </div>`;
    }).join("");
    const dots = list.length > 1 ? `<div class="leader-dots">${list.map((_, i) => `<span class="ld ${i === 0 ? "active" : ""}"></span>`).join("")}</div>` : "";
    return `<div class="dsec"><h3><span class="bar"></span>领队与安全保障</h3>
      <div class="leader-swiper">
        <div class="leader-track" id="leaderTrack">${cards}</div>
      </div>
      ${dots}
      <div class="tiny muted" style="margin-top:8px">具体的安全说明与应急安排，以机构出团通知为准。</div>
    </div>`;
  }

  // 领队资料库：复用真实领队信息，避免每场活动重复填写
  function ensureLeaders() { if (!state.leaders) state.leaders = []; }
  function findLeaderById(id) { return (state.leaders || []).find((l) => l.id === id); }
  function loadLeaderIntoDraft(a, id) {
    const l = findLeaderById(id);
    if (!l) return;
    a._editingLeaderId = id;
    a.leaderName = l.name || "";
    a.leaderYears = l.years || "";
    a.leaderCert = l.cert || "";
    a.leaderTrips = l.trips || "";
  }
  function clearLeaderDraft(a) {
    a._editingLeaderId = "";
    a.leaderName = "";
    a.leaderYears = "";
    a.leaderCert = "";
    a.leaderTrips = "";
  }
  function toggleLeader(a, id) {
    ensureLeaders();
    const ids = a.leaderIds = a.leaderIds || [];
    const idx = ids.indexOf(id);
    if (idx >= 0) {
      ids.splice(idx, 1);
      if (a._editingLeaderId === id) clearLeaderDraft(a);
    } else {
      ids.push(id);
      loadLeaderIntoDraft(a, id);
      confirmFact(a, "leaderInfo");
    }
    saveState();
  }
  function removeLeaderFromActivity(a, id) {
    const ids = a.leaderIds = a.leaderIds || [];
    const idx = ids.indexOf(id);
    if (idx >= 0) ids.splice(idx, 1);
    if (a._editingLeaderId === id) clearLeaderDraft(a);
    saveState();
  }
  function saveLeaderFromDraft(a) {
    ensureLeaders();
    const name = String(a.leaderName || "").trim();
    if (!name) { toast("请先填写领队姓名"); return false; }
    const editingId = a._editingLeaderId || "";
    const existing = editingId ? findLeaderById(editingId) : null;
    const avatar = (a._leaderAvatarDraft || "").trim();
    if (existing) {
      existing.name = name;
      existing.years = a.leaderYears || "";
      existing.cert = a.leaderCert || "";
      existing.trips = a.leaderTrips || "";
      if (avatar) existing.avatar = avatar;
      existing.updatedAt = Date.now();
      if (!(a.leaderIds || []).includes(existing.id)) a.leaderIds.push(existing.id);
    } else {
      const id = uid();
      state.leaders.push({ id, name, years: a.leaderYears || "", cert: a.leaderCert || "", trips: a.leaderTrips || "", avatar: avatar || "", createdAt: Date.now() });
      a.leaderIds = a.leaderIds || [];
      a.leaderIds.push(id);
      a._editingLeaderId = id;
    }
    a._leaderAvatarDraft = "";
    saveState();
    confirmFact(a, "leaderInfo");
    return true;
  }
  function deleteLeaderFromLibrary(id) {
    ensureLeaders();
    state.leaders = (state.leaders || []).filter((l) => l.id !== id);
    (state.activities || []).forEach((a) => {
      a.leaderIds = (a.leaderIds || []).filter((lid) => lid !== id);
      if (a._editingLeaderId === id) clearLeaderDraft(a);
    });
    saveState();
  }
  // 领队头像：上传后自动居中裁剪为 1:1 正方形（前端圆形容器展示即为圆形头像）
  function cropToSquare(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const c = document.createElement("canvas");
        c.width = 256; c.height = 256;
        const cx = c.getContext("2d");
        cx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => resolve("");
      img.src = src;
    });
  }

  // 头像手动裁剪编辑器：上传后可在圆形取景框内拖拽/缩放，确认后再生成头像
  let cropState = null;
  const CROP_VIEW = 260; // 取景框尺寸
  const CROP_OUT = 256;  // 输出头像尺寸
  function openAvatarCropper(src) {
    cropState = { src, w: 0, h: 0, scale: 1, x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };
    let overlay = $("#avatarCropOverlay");
    if (overlay) { if (overlay._cropCleanup) overlay._cropCleanup(); overlay.remove(); }
    overlay = document.createElement("div");
    overlay.className = "avatar-crop-overlay";
    overlay.id = "avatarCropOverlay";
    overlay.innerHTML = `
      <div class="avatar-crop-modal">
        <div class="avatar-crop-head">
          <h4>调整头像显示区域</h4>
          <p class="tiny muted">拖动图片，或滚动缩放，确保面部居中清晰</p>
        </div>
        <div class="avatar-crop-body">
          <div class="crop-stage" id="cropStage">
            <div class="crop-frame"></div>
            <img class="crop-img" id="cropImg" src="${esc(src)}" draggable="false" alt="">
          </div>
          <div class="crop-preview-col">
            <canvas class="crop-preview" id="cropPreview" width="64" height="64"></canvas>
            <span class="tiny muted">预览</span>
          </div>
        </div>
        <div class="crop-zoom">
          <span class="tiny muted">-</span>
          <input type="range" id="cropZoom" min="0" max="100" value="0">
          <span class="tiny muted">+</span>
        </div>
        <div class="avatar-crop-actions">
          <button class="btn btn-ghost btn-sm" data-action="autoCenterAvatar">自动居中</button>
          <button class="btn btn-ghost btn-sm" data-action="cancelAvatarCrop">取消</button>
          <button class="btn btn-soft btn-sm" data-action="confirmAvatarCrop">确认使用</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const img = $("#cropImg");
    const doFit = () => {
      if (!cropState || !cropState.w) return;
      cropState.scale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      cropState.x = 0; cropState.y = 0;
      updateCropPreview();
      if (img) img.classList.add("loaded");
    };
    img.onload = () => {
      cropState.w = img.naturalWidth || img.width || 260;
      cropState.h = img.naturalHeight || img.height || 260;
      doFit();
    };
    if (img.complete && img.naturalWidth) {
      cropState.w = img.naturalWidth; cropState.h = img.naturalHeight;
      doFit();
    }
    bindCropEvents(overlay);
  }
  function autoCenterAvatarCrop() {
    if (!cropState || !cropState.w || !cropState.h) return;
    cropState.scale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
    cropState.x = 0; cropState.y = 0;
    updateCropPreview();
  }
  function updateCropPreview() {
    if (!cropState || !cropState.w || !cropState.h || !cropState.scale) return;
    const { w, h, scale, x, y } = cropState;
    const imgW = w * scale;
    const imgH = h * scale;
    const baseX = (CROP_VIEW - imgW) / 2;
    const baseY = (CROP_VIEW - imgH) / 2;
    const rawX = baseX + x;
    const rawY = baseY + y;
    const minX = CROP_VIEW - imgW;
    const minY = CROP_VIEW - imgH;
    const clampedX = Math.max(minX, Math.min(0, rawX));
    const clampedY = Math.max(minY, Math.min(0, rawY));
    cropState.x = clampedX - baseX;
    cropState.y = clampedY - baseY;
    const img = $("#cropImg");
    if (img) { img.style.width = `${imgW}px`; img.style.height = `${imgH}px`; img.style.left = `${clampedX}px`; img.style.top = `${clampedY}px`; }
    drawCropPreview();
    const zoom = $("#cropZoom");
    if (zoom) {
      const minScale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      const t = Math.log(scale / minScale) / Math.log(3);
      zoom.value = Math.max(0, Math.min(100, Math.round(t * 100)));
    }
  }
  function drawCropPreview() {
    if (!cropState || !cropState.w || !cropState.h) return;
    const canvas = $("#cropPreview");
    if (!canvas || !canvas.getContext) return;
    const cx = canvas.getContext("2d");
    const size = canvas.width;
    cx.clearRect(0, 0, size, size);
    const img = $("#cropImg");
    if (!img || !img.complete || !img.naturalWidth) return;
    const { w, h, scale, x, y } = cropState;
    const imgW = w * scale;
    const imgH = h * scale;
    const baseX = (CROP_VIEW - imgW) / 2;
    const baseY = (CROP_VIEW - imgH) / 2;
    const left = baseX + x;
    const top = baseY + y;
    const sx = -left / scale;
    const sy = -top / scale;
    const sSize = CROP_VIEW / scale;
    cx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);
  }
  function bindCropEvents(overlay) {
    const stage = overlay.querySelector(".crop-stage");
    const zoom = $("#cropZoom");
    const onStart = (e) => {
      if (!cropState) return;
      e.preventDefault();
      cropState.dragging = true;
      const p = e.touches ? e.touches[0] : e;
      cropState.lastX = p.clientX; cropState.lastY = p.clientY;
      stage.style.cursor = "grabbing";
    };
    const onMove = (e) => {
      if (!cropState || !cropState.dragging) return;
      e.preventDefault();
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - cropState.lastX;
      const dy = p.clientY - cropState.lastY;
      cropState.x += dx; cropState.y += dy;
      cropState.lastX = p.clientX; cropState.lastY = p.clientY;
      updateCropPreview();
    };
    const onEnd = () => { if (cropState) cropState.dragging = false; stage.style.cursor = "grab"; };
    stage.addEventListener("mousedown", onStart);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    stage.addEventListener("touchstart", onStart, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (!cropState || !cropState.w) return;
      const minScale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      const delta = e.deltaY > 0 ? -0.06 : 0.06;
      cropState.scale = Math.max(minScale, Math.min(minScale * 3, cropState.scale * (1 + delta)));
      updateCropPreview();
    }, { passive: false });
    zoom.addEventListener("input", () => {
      if (!cropState || !cropState.w) return;
      const minScale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      const t = parseInt(zoom.value, 10) / 100;
      cropState.scale = minScale * Math.pow(3, t);
      updateCropPreview();
    });
    overlay._cropCleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }
  function closeAvatarCropper() {
    const overlay = $("#avatarCropOverlay");
    if (overlay && overlay._cropCleanup) overlay._cropCleanup();
    if (overlay) overlay.remove();
    cropState = null;
  }
  function confirmAvatarCrop() {
    if (!cropState || !cropState.w || !state.draft) { closeAvatarCropper(); return; }
    const img = new Image();
    img.onload = () => {
      const { w, h, scale, x, y } = cropState;
      const imgW = w * scale;
      const imgH = h * scale;
      const baseX = (CROP_VIEW - imgW) / 2;
      const baseY = (CROP_VIEW - imgH) / 2;
      const left = baseX + x;
      const top = baseY + y;
      const sx = -left / scale;
      const sy = -top / scale;
      const sSize = CROP_VIEW / scale;
      const c = document.createElement("canvas");
      c.width = CROP_OUT; c.height = CROP_OUT;
      const cx = c.getContext("2d");
      cx.drawImage(img, sx, sy, sSize, sSize, 0, 0, CROP_OUT, CROP_OUT);
      state.draft._leaderAvatarDraft = c.toDataURL("image/png");
      saveState();
      rerenderEditor();
      closeAvatarCropper();
    };
    img.src = cropState.src;
  }

  // 兼容旧逻辑：单领队字段仍可通过 confirmFact 识别
  function matchLeaderByFields(a) {
    return (state.leaders || []).find((l) =>
      l.name === (a.leaderName || "") &&
      l.years === (a.leaderYears || "") &&
      l.cert === (a.leaderCert || "") &&
      l.trips === (a.leaderTrips || "")
    );
  }
  function blockStats(a) {
    const items = [];
    if (a.elevation) items.push(["海拔", a.elevation + " m", "trending-up"]);
    items.push(["天数", (a.days > 1 ? a.days + " 天" : "单日"), "calendar"]);
    const routeConflict = a.difficulty === "轻松" && ((+a.distance >= 10) || (+a.elevation >= 800 && a.type !== "高海拔登山"));
    items.push(["难度", routeConflict ? "待机构确认" : (a.difficulty || "待确认"), "activity"]);
    if (!items.length) return "";
    return `<div class="stat-row">${items.map(([k,v,ic]) => `<div class="stat"><span class="st-ic">${ICON(ic)}</span><span class="s-k">${esc(k)}</span><div class="s-v">${esc(v)}</div></div>`).join("")}</div>`;
  }
  function blockRoute(a) {
    const facts = [];
    if (a.distance) facts.push(["路线距离", a.distance + " 公里"]);
    if (a.elevation) facts.push(["累计爬升", a.elevation + " 米"]);
    if (a.days > 1) facts.push(["行程天数", a.days + " 天"]);
    if (!facts.length) return "";
    return `<section class="route-facts"><h3>路线数据</h3><div class="route-list">${facts.map(([k, v]) => `<div class="route-fact"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div><p class="route-note">具体轨迹、爬升和路况以机构确认的真实行程为准。</p></section>`;
  }
  function atmosphereSentence(a) {
    const p = a.place || "这里";
    const f = placeFlavorFor(a);
    const s = (f.seasonLine || "").replace(/[。，]/, "");
    const dir = a.contentStrategy || {};
    const mood = dir.mood || "";
    const lines = [
      `${s ? s + "，" : ""}${p}的${a.type}，是把自己从日常里短暂打捞出来的方式。`,
      `去${p}，不是为了逃避城市，是为了让${a.type === "滑雪" ? "雪" : "风"}把节奏重新吹慢。`,
      `在${p}，${a.type}不是表演，是认真在场。`,
      `${p}不会承诺你什么，但会给你一段真实的时间。`,
      `这个${a.dateMD || "周末"}，和${p}一起醒来。`,
      `${a.type}的真正奖励，从来不是终点，是${p}路上的那阵风。`,
      `去${p}，把${a.type}过成一种看得见的生活。`
    ];
    // 按方向 mood 轻微排序，让氛围句与主方向呼应
    const scored = lines.map((l, i) => {
      let sc = i;
      if (mood === "诗意" && /风|云|光/.test(l)) sc += 3;
      if (mood === "逃离" && /逃避|打捞|日常/.test(l)) sc += 3;
      if (mood === "完成" && /终点|奖励/.test(l)) sc += 3;
      if (mood === "陪伴" && /一起|陪伴/.test(l)) sc += 3;
      if (s && l.includes(s.slice(0, 6))) sc += 2;
      return { l, sc };
    }).sort((x, y) => y.sc - x.sc);
    return scored[0].l;
  }
  function blockAtmosphere(a, text) {
    const ac = styleAccent(a);
    return `<div class="atmosphere" style="background:${ac.grad}"><div class="at-ic">${ICON("quote")}</div><div class="at-txt">${esc(text)}</div></div>`;
  }
  function blockVideo(a) {
    if (a.videos && a.videos[0]) return `<div class="video-card"><video class="vc" src="${a.videos[0]}" muted loop autoplay playsinline poster="${((a.photos||[])[0]||"")}" onerror="this.style.display='none'"></video><span class="vc-play">${ICON("play")}</span><span class="vc-dur">真实活动记录</span></div>`;
    return ""; // 无视频内容时直接隐藏模块，不显示占位
  }
  function blockReviews(a) {
    if (!a.reviews || !a.reviews.length) return ""; // 无真实评价时隐藏，绝不冒充
    return `<div class="reviews"><div class="rv-head">往期评价</div>${a.reviews.slice(0, 6).map((r)=>`<div class="rv"><div class="rv-av" style="${r.avatar?`background-image:url('${esc(r.avatar)}')`:''}"></div><div class="rv-body"><div class="rv-row"><span class="rv-name">${esc(r.name||"匿名用户")}</span><span class="rv-stars">${"★".repeat(r.stars||5)}</span></div><div class="rv-txt">${esc(r.text||"")}</div></div></div>`).join("")}</div>`;
  }
  /* ===== V2.0 动态区块编排 =====
     区块只是渲染能力；顺序、是否出现、图片分配均由「内容 + 素材数量 + 数据有无」决定，
     不再按活动类型套用整页固定模板。节奏：感性吸引 → 视觉证据 → 故事 → 记忆点
     → 更多视觉 → 强度与适合人群 → 行程/服务/费用 → 报名。 */
  function buildPageStoryOutline(a) {
    const photos = a.photos || [];
    const n = photos.length;
    const T = a.type;
    const isFam = isFamilyActivity(a);
    const hasItin = (a.itineraryDays || []).some((d) => (d.items || []).some((t) => t && (t.time || t.text)));
    const hasVideo = !!(a.videos && a.videos[0]);
    const hasReviews = !!(a.reviews && a.reviews.length);
    const hasLeader = !!a.leaderName;
    const hasGear = !!(a.gear && a.gear.length);
    const hasHl = !!(a.highlights && a.highlights.length);
    const svc = [];
    if (a.includeLeader) svc.push("领队");
    if (a.includeMeal) svc.push("餐食");
    if (a.includeInsurance) svc.push("保险");
    if (a.includeTransport) svc.push("交通");
    if (a.includeGear) svc.push("装备");

    const cover = Math.max(0, Math.min(+(a.coverIndex || 0), Math.max(0, n - 1)));
    // P0-7/P0-8/P0-10：优先只用「自动筛图」保留的照片（弃用不进入页面）；不足 3 张时回退全部，避免少图页面崩
    const intel = (typeof PAGE_PHOTO_INTEL !== "undefined" && PAGE_PHOTO_INTEL) ? PAGE_PHOTO_INTEL : null;
    const keepSrc = {};
    if (intel && intel.used && intel.used.length) intel.used.forEach((u) => { keepSrc[u.src] = true; });
    const hasKeep = Object.keys(keepSrc).length > 0;
    const allIdx = photos.map((src, i) => i).filter((i) => i !== cover);
    const keptIdx = allIdx.filter((i) => !hasKeep || keepSrc[photos[i]]);
    const useIdx = keptIdx.length >= 3 ? keptIdx : allIdx;
    // P0-9：被「段落语义匹配」命中的图优先（越靠前的段落权重越高），详情页不再只按数量分组
    const matchedRank = {};
    if (intel && intel.matched) {
      intel.matched.forEach((mm, si) => (mm.photos || []).forEach((p) => { if (matchedRank[p.src] == null) matchedRank[p.src] = si; }));
    }
    const ranked = useIdx.map((i) => {
      const m = photoMeta(photos[i]);
      let score = m ? (m.quality_score || 0) * 100 : 50;
      if (m && m.orientation === "landscape") score += 8;
      const role = intel ? intel.roles[(intel.used.find((u) => u.src === photos[i]) || {}).imageId] : null;
      if (role === "HeroImage") score += 12;
      else if (role === "SectionLeadImage") score += 6;
      const msi = matchedRank[photos[i]];
      if (msi != null) score += Math.max(2, 8 - msi * 2);
      return { i, score };
    }).sort((x, y) => y.score - x.score || x.i - y.i).map((x) => x.i);
    let cursor = 0;
    const take = (k) => {
      const result = ranked.slice(cursor, cursor + k);
      cursor += result.length;
      return result;
    };

    const fallbackStoryPurpose =
      T === "高海拔登山" ? "说明海拔、强度与每一天的行进目标"
      : (T === "城市旅行" || T === "景区观光") ? "呈现城市街区与生活方式"
      : T === "露营" ? "营地、夜晚与慢下来的时间"
      : T === "漂流" || T === "溯溪" || T === "桨板或皮划艇" ? "水、浪与出发前的那一下心跳"
      : T === "企业团建" ? "团队在一起完成的动作"
      : isFam ? "人物互动与共同完成的过程"
      : T === "徒步" ? "路线、距离与沿途变化"
      : "活动当天的真实过程";
    const storyPurpose = (a.storyPurpose && String(a.storyPurpose).trim()) || fallbackStoryPurpose;

    const out = [];
    let capIdx = 0;
    // 只使用 AI/用户提供的真实照片配文；没有配文时不展示内部用途标签
    const nextCaption = () => {
      const caps = a.photoCaptions || [];
      const c = caps[capIdx];
      capIdx++;
      return (c && String(c).trim()) ? String(c).trim() : "";
    };

    // 自适应相册：按照片数量把图分组，营造杂志式“大图 + 留白 + 图文交错”的节奏
    function splitPhotos(cnt) {
      if (cnt <= 0) return [];
      if (cnt === 1) return [1];
      if (cnt === 2) return [2];
      if (cnt === 3) return [3];
      if (cnt === 4) return [2, 2];
      if (cnt === 5) return [3, 2];
      if (cnt === 6) return [3, 3];
      if (cnt === 7) return [3, 2, 2];
      if (cnt === 8) return [3, 3, 2];
      if (cnt === 9) return [3, 3, 3];
      return [3, 3, 3, cnt - 9]; // 10 张以上：末组吃剩余
    }
    function photoCls(c) { return c === 1 ? "v2-full" : c === 2 ? "v2-pair" : c === 3 ? "v2-trio" : c === 4 ? "v2-grid" : "v2-mosaic"; }
    const bodyParas = (a.body && a.body.length) ? a.body.slice() : [];
    let bodyCursor = 0;
    // 图文交错：每放一组图就接一段正文，形成连续阅读节奏；无图时正文集中呈现
    function emitStory() {
      const remain = Math.max(0, ranked.length - cursor);
      const groups = splitPhotos(remain);
      groups.forEach((c) => {
        const p = take(c);
        if (!p.length) return;
        out.push({ type: "gallery", cls: photoCls(p.length), caption: nextCaption(), photos: p });
        if (bodyCursor < bodyParas.length) { out.push({ type: "text_block", para: bodyCursor }); bodyCursor++; }
      });
      while (bodyCursor < bodyParas.length) { out.push({ type: "text_block", para: bodyCursor }); bodyCursor++; }
    }
    const pushFull = () => { const f = take(1); if (f.length) out.push({ type: "gallery", cls: "v2-full", caption: nextCaption(), photos: f }); };

    // 开场策略按活动类型不同，中段图文统一智能交错，不再套用单一版式
    if (T === "高海拔登山") {
      out.push({ type: "metric_strip", purpose: "先判断海拔与强度" });
      pushFull();
      out.push({ type: "editorial_lead", purpose: "说明挑战的具体边界" });
      out.push({ type: "suitability", purpose: "说明适合与不适合人群" });
      out.push({ type: "pull_quote", purpose: "强调认真准备" });
      emitStory();
      out.push({ type: "route_story", purpose: "路线、距离与海拔信息" });
    } else if (T === "城市旅行" || T === "景区观光") {
      out.push({ type: "editorial_lead", purpose: "建立本次城市体验的主线" });
      emitStory();
      out.push({ type: "pull_quote", purpose: "形成城市记忆点" });
      pushFull();
      out.push({ type: "metric_strip", purpose: "快速判断时间与费用" });
    } else if (isFam) {
      out.push({ type: "editorial_lead", purpose: "说明这次同行将完成什么" });
      emitStory();
      out.push({ type: "pull_quote", purpose: "留下本场活动的记忆句" });
      pushFull();
      out.push({ type: "metric_strip", purpose: "帮助快速判断" });
    } else {
      pushFull();
      out.push({ type: "editorial_lead", purpose: "说明这场活动为什么值得来" });
      out.push({ type: "pull_quote", purpose: "形成记忆点" });
      emitStory();
      out.push({ type: "metric_strip", purpose: "快速判断强度与时间安排" });
      if (T === "徒步" || T === "高海拔登山") out.push({ type: "route_story", purpose: "路线与距离信息" });
    }
    // 新架构：消费者价值叙事——围绕核心传播主题，先回答「为什么值得去 → 来了会体验什么 → 参加完能得到什么 → 适合谁」
    // 只有当至少一项叙事字段有值时才插入叙事序列，否则详情页完全回退到旧架构（editorial_lead/body/selling_points），避免半新半旧。
    const hasNarrative = (a.whyGo && String(a.whyGo).trim()) || (a.experience && String(a.experience).trim()) || (a.gain && String(a.gain).trim()) || (a.fitFor && String(a.fitFor).trim()) || (a.notFitFor && String(a.notFitFor).trim());
    if (hasNarrative) {
      out.push({ type: "narrative_why", purpose: "回答：为什么值得去" });
      out.push({ type: "narrative_experience", purpose: "回答：来了会体验什么" });
      out.push({ type: "narrative_gain", purpose: "回答：参加完能得到什么" });
      out.push({ type: "narrative_fit", purpose: "回答：适合谁 / 不适合谁" });
    }
    out.push({ type: "selling_points", purpose: "路线核心卖点（多阶段管线输出）" });
    if (hasVideo) out.push({ type: "video", purpose: "真实活动记录" });

    // 决策信息
    out.push({ type: "fee", purpose: "先说明价格与费用包含/不含" });
    if (hasItin) out.push({ type: "itinerary", purpose: "提供理性决策信息" });
    else out.push({ type: "itinerary", purpose: "提示真实行程待补充", pending: true });
    if (svc.length) out.push({ type: "services", purpose: "说明已确认服务" });
    if (hasGear) out.push({ type: "gear", purpose: "出发前建议准备什么" });
    if (hasLeader) out.push({ type: "leader_safety", purpose: "真实领队资料" });
    if (hasHl) out.push({ type: "highlights", purpose: "归纳核心卖点" });
    if (hasReviews) out.push({ type: "reviews", purpose: "往期真实评价" });
    out.push({ type: "travel_notes", purpose: "退改与安全须知（多阶段管线输出）" });
    out.push({ type: "org", purpose: "机构信息" });
    return out;
  }

  /* ===== P0-4「AI 图文活动详情页」：图文故事大纲（事实+行程+图片+补充资料 → 章节序列）=====
     与「简洁报名详情」并存的第二种输出，目标是接近公众号/活动宣传长图文，而非固定 SaaS 详情页。 */
  const EDITORIAL_KIND_LABEL = { scenic: "SCENERY", experience: "EXPERIENCE", route: "ROUTE", people: "PEOPLE", gear: "GEAR", info: "INFO" };

  /* ===== P0-12 图文详情页「多样生成」=====
     同一活动连续生成多版，必须在四个维度同时产生差异：
       内容角度 angle：风景 / 自由 / 挑战 / 陪伴 / 社交 / 季节 / 生活方式
       页面结构 structure：章节顺序
       图片结构 img：Hero / 拼图 / 图廊 / 大图 / 小图 的组合方式
       文案密度 density：画册型 / 杂志型 / 纪实型 / 转化型 */
  const EDITORIAL_ANGLES = {
    scenery:    { key: "scenery",    label: "看风景",   cta: "把看过变成走过" },
    freedom:    { key: "freedom",    label: "自由",     cta: "让风景替你说话" },
    challenge:  { key: "challenge",  label: "挑战",     cta: "用坚持换一片只有山顶才有的视野" },
    companion:  { key: "companion",  label: "陪伴",     cta: "第一次爬山，由你陪他走完" },
    social:     { key: "social",     label: "社交",     cta: "把聚会从会议室搬到山里" },
    season:     { key: "season",     label: "季节",     cta: "把这一季收进脚步里" },
    lifestyle:  { key: "lifestyle",  label: "生活方式", cta: "把日子过成户外" },
  };
  // 各角度下，每个章节的「角度化标题」——保证不同角度的同一活动，章节标题明显不同（不止背景色/主标题）
  const EDITORIAL_ANGLE_HEADINGS = {
    scenery:    { why: "为什么值得去",     experience: "你会看到的风景", route: "沿着风景走",       gain: "带走的一片风景",   fit: "谁会爱上这条路线", reasons: "这条路线值得的理由" },
    freedom:    { why: "为什么想逃出来",   experience: "把节奏交给山野", route: "不设闹钟的一天",   gain: "找回的松弛感",     fit: "想喘口气的人",       reasons: "放下城市的理由" },
    challenge:  { why: "为什么要挑战它",   experience: "身体会经历的",   route: "一步步往上",       gain: "突破之后得到的",   fit: "能走完的人",         reasons: "它难在哪、又值在哪" },
    companion:  { why: "为什么带孩子来",   experience: "孩子会经历的",   route: "陪他走完全程",     gain: "一起攒下的回忆",   fit: "愿意同行的家庭",     reasons: "亲子场才有的细节" },
    social:     { why: "为什么约朋友来",   experience: "一路上会发生什么", route: "同走一条路",     gain: "认识的人与事",     fit: "想找同频的人",       reasons: "聚在一起的理由" },
    season:     { why: "这一季为什么去",   experience: "此刻才有的样子", route: "踩准季节的步点",   gain: "把季节收进记忆",   fit: "赶在这一季的人",     reasons: "错过等一年的理由" },
    lifestyle:  { why: "为什么把生活搬出来", experience: "另一种过法",     route: "慢下来的路线",     gain: "带回去的生活感",   fit: "想换种活法的人",     reasons: "把日子过成户外的理由" },
  };
  const EDITORIAL_STRUCTURES = {
    story:      ["why", "experience", "route", "night", "gain", "fit", "reasons"],
    experience: ["experience", "why", "route", "night", "gain", "fit", "reasons"],
    route:      ["route", "why", "experience", "night", "gain", "fit", "reasons"],
    value:      ["gain", "why", "experience", "route", "night", "fit", "reasons"],
    social:     ["fit", "why", "gain", "experience", "route", "night", "reasons"],
  };
  // img：每节取图数量 + 图种（拼图 mosaic / 大图 big / 单图 solo / 小图 thumbs）+ 末尾图廊模式
  const EDITORIAL_IMG = {
    "hero-mosaic":   { hero: "full", secCount: 2, secKind: "mosaic",  gallery: "mosaic" },
    "gallery-strip": { hero: "full", secCount: 1, secKind: "solo",    gallery: "strip" },
    "big-solo":      { hero: "full", secCount: 1, secKind: "big",     gallery: "big" },
    "small-thumbs":  { hero: "band", secCount: 3, secKind: "thumbs",  gallery: "thumbs" },
    "mixed":         { hero: "full", secCount: 2, secKind: "mosaic",  gallery: "mixed" },
  };
  const EDITORIAL_DENSITY = {
    album:       { maxPara: 1, trunc: 90,  quote: false, cta: false },
    magazine:    { maxPara: 2, trunc: 200, quote: true,  cta: false },
    conversion:  { maxPara: 2, trunc: 150, quote: true,  cta: true },
    documentary: { maxPara: 99, trunc: 0,  quote: false, cta: false },
  };
  // 一组精选「版式预设」：每一版都好看，且彼此在四维度上明显不同（连续生成相邻两版必不同）
  // —— P0-13：保留该合并列表仅用于向后兼容（P0-12 回归脚本与旧数据）；新版改为「版式」「风格」双轴 ——
  const EDITORIAL_VARIANTS = [
    { id: "v-scenery-mag",     angle: "scenery",    structure: "story",      img: "hero-mosaic",   density: "magazine" },
    { id: "v-challenge-doc",   angle: "challenge",  structure: "route",      img: "big-solo",      density: "documentary" },
    { id: "v-companion-album", angle: "companion",  structure: "experience", img: "gallery-strip", density: "album" },
    { id: "v-social-conv",     angle: "social",     structure: "social",    img: "small-thumbs",  density: "conversion" },
    { id: "v-season-mag",      angle: "season",     structure: "story",      img: "hero-mosaic",   density: "magazine" },
    { id: "v-freedom-doc",     angle: "freedom",    structure: "route",      img: "big-solo",      density: "documentary" },
    { id: "v-lifestyle-conv",  angle: "lifestyle",  structure: "value",      img: "gallery-strip", density: "conversion" },
  ];

  /* === P0-13：版式 / 风格 双轴 ===
     换版式：保持 事实 / 主题 / 文案；只改 图片组合(structure→顺序, img→图组) / 布局 / 留白(typo) / Typography / 章节视觉(tone)。
     换风格：保持 confirmedFacts；重生成 内容角度(angle) / 标题 / 章节表达 / 文案节奏(density) / 图片策略 / Family / Layout。
     —— 正文段落只由 style 轴(angle→标题, density→裁剪) 与活动数据决定，版式轴绝不触碰文案，故「换版式后正文不变」。 */
  const EDITORIAL_LAYOUTS = [
    { id: "L-mosaic-story",  structure: "story",      img: "hero-mosaic",   typo: "serif" },
    { id: "L-solo-route",    structure: "route",      img: "big-solo",      typo: "condensed" },
    { id: "L-strip-exp",     structure: "experience", img: "gallery-strip", typo: "airy" },
    { id: "L-thumbs-social", structure: "social",     img: "small-thumbs",  typo: "grid" },
    { id: "L-mixed-value",   structure: "value",      img: "mixed",         typo: "classic" },
  ];
  const EDITORIAL_STYLES = [
    { id: "S-scenery-mag",     angle: "scenery",    density: "magazine",    family: "magazine" },
    { id: "S-challenge-doc",   angle: "challenge",  density: "documentary", family: "diary" },
    { id: "S-companion-album", angle: "companion",  density: "album",       family: "family" },
    { id: "S-social-conv",     angle: "social",     density: "conversion",  family: "social" },
    { id: "S-season-mag",      angle: "season",     density: "magazine",    family: "album" },
    { id: "S-freedom-doc",     angle: "freedom",    density: "documentary", family: "diary" },
    { id: "S-lifestyle-conv",  angle: "lifestyle",  density: "conversion",  family: "gallery" },
  ];
  // 旧版单一变体 → (版式, 风格) 映射（向后兼容已发布/回归数据）
  const EDITORIAL_VARIANT_LEGACY_BY_OLD = {
    "v-scenery-mag":     { layout: "L-mosaic-story",  style: "S-scenery-mag" },
    "v-challenge-doc":   { layout: "L-solo-route",    style: "S-challenge-doc" },
    "v-companion-album": { layout: "L-strip-exp",     style: "S-companion-album" },
    "v-social-conv":     { layout: "L-thumbs-social", style: "S-social-conv" },
    "v-season-mag":      { layout: "L-mosaic-story",  style: "S-season-mag" },
    "v-freedom-doc":     { layout: "L-solo-route",    style: "S-freedom-doc" },
    "v-lifestyle-conv":  { layout: "L-strip-exp",     style: "S-lifestyle-conv" },
  };
  // 反查：组合 id → 旧版合并 id（默认/未知组合回退为组合串）
  const EDITORIAL_VARIANT_LEGACY = {};
  Object.keys(EDITORIAL_VARIANT_LEGACY_BY_OLD).forEach(function (k) {
    const m = EDITORIAL_VARIANT_LEGACY_BY_OLD[k];
    EDITORIAL_VARIANT_LEGACY[m.layout + "|" + m.style] = k;
  });
  /* Case 1 / Case 2（页面层）：活动未显式指定版式/风格时，按「照片画像」自动选轴。
     优先级（与 §六 期待一致）：
       ① 亲子 / 竖图人物为主 → 陪伴·画册（竖图对/原比例展示，不横裁孩子）
       ② 高强度挑战（海拔/难度/类型）→ 挑战·纪实（大图 + 硬指标，配合 Case 7 专业文案权重）
       ③ 人物主导 → 社交·体验（体验前置、图组为主，页面明显转人物/体验主导）
       ④ 暖调横图风景 → 季节·杂志（大图通栏 + 拼图，暖调杂志结构）
     显式指定 editorialLayoutId / editorialStyleId / editorialVariantId 时永不覆盖（用户选择优先）。 */
  function autoEditorialPick(a) {
    a = a || {};
    if (a.editorialLayoutId || a.editorialStyleId || a.editorialVariantId) return null;
    const cp = photoContentProfile(a.photos || []);
    if (!cp.count) return null;
    const t = String((a.type || "") + (a.title || ""));
    const parentChild = /亲子|研学|儿童|少年|遛娃|自然教育/.test(t);
    const hard = /雪山|高海拔|登山|越野|攀岩|挑战/.test(t)
      || (+a.elevation >= 2500) || /挑战|高强度|进阶/.test(String(a.difficulty || ""));
    if (parentChild || (cp.peopleRatio >= 0.6 && cp.portraitRatio >= 0.5)) {
      return { layout: "L-thumbs-social", style: "S-companion-album", why: "亲子/竖图人物：陪伴画册，竖图原比例不裁孩子" };
    }
    if (hard) {
      return { layout: "L-solo-route", style: "S-challenge-doc", why: "高强度挑战：挑战纪实，大图 + 硬指标更专业" };
    }
    if (cp.peopleRatio >= 0.5) {
      return { layout: "L-strip-exp", style: "S-social-conv", why: "人物主导：社交体验，体验前置、图组为主" };
    }
    if (cp.warmthLabel === "暖调" && cp.landscapeRatio >= 0.6) {
      return { layout: "L-mosaic-story", style: "S-season-mag", why: "暖调横图风景：季节杂志，大图通栏 + 拼图" };
    }
    return null;
  }
  function editorialLayoutOf(a) {
    a = a || {};
    if (a.editorialLayoutId) {
      const L = EDITORIAL_LAYOUTS.filter(function (x) { return x.id === a.editorialLayoutId; })[0];
      if (L) return L;
    }
    if (a.editorialVariantId) {
      const m = EDITORIAL_VARIANT_LEGACY_BY_OLD[a.editorialVariantId];
      if (m) return EDITORIAL_LAYOUTS.filter(function (x) { return x.id === m.layout; })[0] || EDITORIAL_LAYOUTS[0];
    }
    // Case 1/2：未显式指定时，按照片画像自动选版式轴（亲子/人物/挑战/暖调各有对应版式）
    const autoL = autoEditorialPick(a);
    if (autoL) {
      const AL = EDITORIAL_LAYOUTS.filter(function (x) { return x.id === autoL.layout; })[0];
      if (AL) return AL;
    }
    return EDITORIAL_LAYOUTS[0];
  }
  function editorialStyleOf(a) {
    a = a || {};
    if (a.editorialStyleId) {
      const S = EDITORIAL_STYLES.filter(function (x) { return x.id === a.editorialStyleId; })[0];
      if (S) return S;
    }
    if (a.editorialVariantId) {
      const m = EDITORIAL_VARIANT_LEGACY_BY_OLD[a.editorialVariantId];
      if (m) return EDITORIAL_STYLES.filter(function (x) { return x.id === m.style; })[0] || EDITORIAL_STYLES[0];
    }
    // Case 1/2：未显式指定时，按照片画像自动选风格轴（角度/密度/Family → 页面 tone 明显不同）
    const autoS = autoEditorialPick(a);
    if (autoS) {
      const AS = EDITORIAL_STYLES.filter(function (x) { return x.id === autoS.style; })[0];
      if (AS) return AS;
    }
    return EDITORIAL_STYLES[0];
  }
  // 合并出 {angle,structure,img,density,...}（兼容旧调用点）；双轴字段优先，旧 editorialVariantId 兜底
  function editorialVariantOf(a) {
    a = a || {};
    const L = editorialLayoutOf(a), S = editorialStyleOf(a);
    const combo = L.id + "|" + S.id;
    const legacyId = EDITORIAL_VARIANT_LEGACY[combo] || "";
    const rawId = (a.editorialVariantId && EDITORIAL_VARIANT_LEGACY_BY_OLD[a.editorialVariantId]) ? a.editorialVariantId : "";
    return {
      id: rawId || legacyId || combo,
      angle: S.angle, structure: L.structure, img: L.img, density: S.density,
      layout: L.id, style: S.id, typo: L.typo, family: S.family
    };
  }
  // 连续生成：给定上一版 id，挑下一版（相邻两版在 angle/structure/img/density 上都有差异）—— 向后兼容
  function pickEditorialVariant(a, prevId) {
    const list = EDITORIAL_VARIANTS;
    let i = 0;
    if (prevId) {
      const idx = list.map(function (x) { return x.id; }).indexOf(prevId);
      i = (idx >= 0 ? (idx + 1) % list.length : 0);
    }
    return list[i];
  }
  // P0-13：换版式 —— 仅推进版式轴（布局/图片组合/留白/字体/章节视觉），文案与事实冻结
  function pickEditorialLayout(prevId) {
    const list = EDITORIAL_LAYOUTS;
    let i = 0;
    if (prevId) {
      const idx = list.map(function (x) { return x.id; }).indexOf(prevId);
      i = (idx >= 0 ? (idx + 1) % list.length : 0);
    }
    return list[i];
  }
  // P0-13：换风格 —— 仅推进风格轴（角度/密度/Family/章节表达），守住 confirmedFacts
  function pickEditorialStyle(prevId) {
    const list = EDITORIAL_STYLES;
    let i = 0;
    if (prevId) {
      const idx = list.map(function (x) { return x.id; }).indexOf(prevId);
      i = (idx >= 0 ? (idx + 1) % list.length : 0);
    }
    return list[i];
  }
  /* ===== P0-C（v193）「换风格」必须真正重生成内容，而不是只换 CSS =====
     换版式：冻结 事实/DNA 事实层/策略/方向/文案 → 只改 LayoutPlan。
     换风格：冻结 confirmedFacts / actualActivityData / DNA 事实层 / Photo Intelligence，
             重生成 内容角度 → 主主题 → 标题 → 副标题 → 导语 → 章节标题与正文 →
             金句 → 图片叙事策略 → Editorial Direction → LayoutPlan，并重跑 Claim→Fact 检查。
     实现方式：把「重生成结果」存成 stylePack，渲染层优先消费它；事实字段（时间/地点/价格/
     行程/装备/保险/领队）永远从 canonical 字段渲染，所以「换风格后事实一字不变」是结构保证，
     不依赖文案生成器自觉。 */
  const EDITORIAL_STYLE_PHOTO = {
    "S-scenery-mag":     { name: "风景优先·大图慢节奏", galleryBias: 0.9,  perSectionBias: 1.3 },
    "S-challenge-doc":   { name: "纪实·少而稳",         galleryBias: 0.5,  perSectionBias: 1.0 },
    "S-companion-album": { name: "陪伴·人物密集",       galleryBias: 1.2,  perSectionBias: 1.4 },
    "S-social-conv":     { name: "社交·快节奏图组",     galleryBias: 1.0,  perSectionBias: 1.2 },
    "S-season-mag":      { name: "季节·拼图铺陈",       galleryBias: 1.1,  perSectionBias: 1.35 },
    "S-freedom-doc":     { name: "自由·留白优先",       galleryBias: 0.6,  perSectionBias: 1.0 },
    "S-lifestyle-conv":  { name: "生活方式·切片感",     galleryBias: 1.0,  perSectionBias: 1.25 },
  };
  /* 事实切片：只放「canonical 字段 + DNA 事实层」里确实存在的东西。
     任何未确认的天气/景色/事件都不会被写进这里 —— 这是 P0-A 事实边界的落地。 */
  function editorialFacts(a, dna) {
    a = a || {};
    const season = (dna && dna.season) || seasonOf(a) || "";
    const ground = (dna && dna.groundedScenes) || [];
    const days = a.itineraryDays || [];
    const items0 = (days[0] && days[0].items) || [];
    const firstTime = (items0[0] && items0[0].time) || "";
    const last = items0.length ? items0[items0.length - 1] : null;
    const svc = [];
    if (a.includeLeader) svc.push("专业领队");
    if (a.includeInsurance) svc.push("户外保险");
    if (a.includeTransport) svc.push("往返交通");
    if (a.includeMeal) svc.push("餐食");
    (a.feeInclude || []).forEach(function (x) { const t = String(x || "").trim(); if (t && svc.indexOf(t) < 0) svc.push(t); });
    const dif = String(a.difficulty || "").trim();
    const difWord = /高|难|挑战|进阶/.test(dif) ? "偏难" : (/低|轻松|入门|休闲/.test(dif) ? "轻松" : (dif ? "适中" : ""));
    return {
      place: String(a.place || "").trim(),
      hasPlace: !!String(a.place || "").trim(),
      P: String(a.place || "").trim() || "这条路线",
      dateShort: String(a.dateMD || a.date || "").trim(),
      D: String(a.dateMD || a.date || "").trim() || "这一天",
      season: season,
      seasonWord: season ? season : "",
      distance: (+a.distance > 0) ? +a.distance : 0,
      elevation: (+a.elevation > 0) ? +a.elevation : 0,
      difficulty: dif, difficultyWord: difWord,
      days: (+a.days > 0) ? +a.days : 0,
      dayWord: (+a.days > 1) ? (+a.days + " 天") : "一天",
      limit: (+a.limit > 0) ? +a.limit : 0,
      limitUnit: a.limitUnit || "人",
      price: (a.price != null && +a.price > 0) ? +a.price : 0,
      services: svc,
      audience: String(a.targetAudience || "").trim(),
      startTime: firstTime,
      endTime: (last && last.time) || "",
      ground: ground,
      envLabel: (dna && dna.environmentLabel) || (String(a.place || "").trim() || "山野"),
      formLabel: (dna && dna.activityFormLabel) || "户外活动",
      distWord: (+a.distance > 0) ? (+a.distance + " 公里") : "",
      eleWord: (+a.elevation > 0) ? ("海拔 " + (+a.elevation) + " 米") : "",
    };
  }
  /* 7 个角度的「表达声音」：动词/意象/结构句都不同 —— 保证连点换风格得到的不是换皮。 */
  const EDITORIAL_ANGLE_VOICE = {
    scenery: {
      label: "看风景", verb: "看", focus: "风景",
      titles: ["{P}{D}，把视野一层层打开", "{P}这条线，看得比走得更远", "在{P}，把{seasonWord}的风景走完"],
      leads: ["{P}这条路，风景不是背景，是主线。{D}出发，不赶点，把脚步交给山水。",
              "从集合点出发走完{P}。{distWord}{eleWord}，一路都在换视野。"],
      paras: {
        why: ["去{P}，不是为了打卡，是为了把被楼宇切碎的视野重新接起来。", "这条路的价值在视野：走一段，就换一幅。", "风景不挑人，第一次来也能在转弯处遇见惊喜。"],
        experience: ["{difficultyWord}的强度配得上{dayWord}的路程，走完不会觉得赶。", "沿线以{envLabel}为主，节奏由自己和队伍一起决定。", "不赶时间，才有余力留意脚边的植物和远处的轮廓。"],
        route: ["按行程走：{startTime}集合出发，{endTime}回到集合点。", "全程约{distWord}，沿途依据实际路况调整休息点。"],
        gain: ["带走的不是照片数量，是一整天连续的视野。", "把{D}这一天的节奏完整地还给自己。", "回到城里，眼睛还留着山线的弧度。"],
        fit: ["{audience}，以及想安安静静看一天风景的人。", "有基础体力、愿意按自己步频走的人都能跟上。", "一个人来也行，队伍里总有同频的人。"],
        reasons: ["路线成熟、节奏可控，领队随队，把注意力留给风景。", "人数控制在{limit}{limitUnit}内，队形不散。"],
      },
      quotes: ["风景不在终点，在每一段转弯之后。", "把{D}交给一条有视野的路。", "走完才知道，视野是需要一步步换来的。"],
    },
    freedom: {
      label: "自由", verb: "松开", focus: "节奏",
      titles: ["{D}，在{P}关掉闹钟", "把自己还给{P}", "{P}：{dayWord}不用赶路的走法"],
      leads: ["{D}这天没有闹钟，只有{P}。走多快、停多久，自己说了算。",
              "去{P}不是为了完成清单，是为了把节奏调回来。{distWord}，走成自己的样子。"],
      paras: {
        why: ["城市里的时间被切得很碎，{P}能把它重新连成一条线。", "离开固定安排{dayWord}，节奏自然会慢下来。", "把{P}当成一次不给日程表留位置的练习。"],
        experience: ["不设打卡点，累了就停。{difficultyWord}的强度刚好留出喘息的余地。", "在{envLabel}里走，注意力从屏幕移回脚下。", "走到哪算哪，反而比按计划更记得清楚。"],
        route: ["{startTime}出发，{endTime}回到集合点，中间的时间归自己安排。", "全程约{distWord}，不赶路，按队伍状态调整。"],
        gain: ["一天结束时，手里多出来的是一点松弛。", "把被日程表占据的注意力要回来。", "这种松弛会渗进接下来的一周。"],
        fit: ["{audience}，以及最近想喘口气的人。", "不喜欢被行程推着走、愿意自己掌握节奏的人。", "哪怕只是想独自安静半天，也合适。"],
        reasons: ["不设硬性打卡点，把时间还给参与者。", "限{limit}{limitUnit}，小队伍更好照顾各自的节奏。"],
      },
      quotes: ["真正的休息，是把时间从表格里拿回来。", "走慢一点，才听得见自己的节奏。", "把{D}还给不做计划的自己。"],
    },
    challenge: {
      label: "挑战", verb: "走完", focus: "体力",
      titles: ["{eleWord}，{D}走完{P}这条线", "{P}{D}：走到累，也走到值", "在{P}，把体力用在该用的地方"],
      leads: ["{D}这条线不轻松：{distWord}{eleWord}，{difficultyWord}的强度。走完它，答案自己出现。",
              "{P}不是散步的路线。{distWord}走下来，需要的是节奏和坚持，而不是冲动。"],
      paras: {
        why: ["难度是这条线的一部分：{difficultyWord}的强度，才配得上走完之后的踏实。", "选择{P}，是想用{dayWord}换一个明确的完成感。", "不是每条线都值得用力，这条算一条。"],
        experience: ["前段爬升集中，中后段趋于稳定，身体会经历一个明确的临界点。", "{eleWord}的落差带来真实的体力消耗，也带来真实的消耗感。", "临界点之后，腿会找到自己的节奏。"],
        route: ["{startTime}集合出发，{endTime}回到集合点，中途按体力设休息点。", "全程约{distWord}，{difficultyWord}；领队控速，禁止超越前队。"],
        gain: ["得到的是一个自己能确认的完成度。", "把{dayWord}的体力完整地用在该用的地方。", "完成感比照片更经得住回头看。"],
        fit: ["{audience}，以及有徒步基础、能接受{difficultyWord}强度的人。", "身体状态稳定、愿意按队伍节奏推进的人。", "没把握的人，可以先从更短的线练手。"],
        reasons: ["路线难度与队伍配比经过匹配，不硬拼。", "限{limit}{limitUnit}，保证领队能照顾到队尾。"],
      },
      quotes: ["难的部分，往往才是记得住的部分。", "不是征服高度，是完整经历一天。", "走到累，才知道自己还剩多少。"],
    },
    companion: {
      label: "陪伴", verb: "陪着", focus: "一起",
      titles: ["带他走一次{P}", "{P}{D}：陪孩子走完这一程", "在{P}，一起攒一段路"],
      leads: ["{D}带孩子去{P}。{distWord}的强度适合第一次走长线的小朋友，家长在旁，一起走完。",
              "把周末交给{P}：孩子在前面探路，大人跟在后面，{dayWord}就这样过。"],
      paras: {
        why: ["带孩子来{P}，是想让他知道路是要自己走完的。", "{difficultyWord}的路线对孩子友好，成就感来得刚刚好。", "山里的第一课，是不着急。"],
        experience: ["孩子会经历从兴奋到疲惫再到坚持的完整过程，这比说教有用。", "一路上大人小孩同速前进，节奏由队伍里最慢的人决定。", "他记住的不会是公里数，是某块石头和某阵风。"],
        route: ["{startTime}集合出发，{endTime}返回，途中的休息点按孩子状态调整。", "全程约{distWord}，留足玩耍与休息的时间。"],
        gain: ["带回去的是一起完成一件事的记忆。", "孩子得到一次自己走完的经验，家长得到一天不被打扰的相处。", "这段路会成为以后提起就笑的素材。"],
        fit: ["{audience}，以及愿意陪孩子慢慢走的家庭。", "孩子能独立走完短程、家长愿意全程陪同的家庭。", "二胎或朋友结伴也很好，孩子有伴更敢走。"],
        reasons: ["路线难度对亲子友好，不设置硬性挑战段。", "限{limit}{limitUnit}，保证每家的孩子都在视野内。"],
      },
      quotes: ["第一次走完全程，是他自己挣来的。", "陪他走的路，比替他走的路长。", "一起走完，才算一起出发。"],
    },
    social: {
      label: "社交", verb: "约", focus: "同频",
      titles: ["{D}，把朋友约到{P}", "{P}：一场不用会议室的聚会", "和同频的人去{P}走{dayWord}"],
      leads: ["{D}不做室内局，约在{P}。{distWord}边走边聊，比坐在桌前更容易说开。",
              "把聚会搬到{P}：一起出发、一起走完、一起吃个饭。"],
      paras: {
        why: ["换掉会议室，{P}里并排走一段，话题自然就有了。", "一起走过一段路，比交换名片更容易记住彼此。", "约人这件事，放在路上比放在群里容易得多。"],
        experience: ["队伍规模控制在{limit}{limitUnit}，不喧闹，也不至于冷场。", "{difficultyWord}的强度刚好：有点喘，但不影响说话。", "边走边聊，尴尬会被风景接住。"],
        route: ["{startTime}集合，热身之后出发，{endTime}左右回到集合点。", "全程约{distWord}，中间设一次集体休息。"],
        gain: ["多认识几个能一起走路的人。", "把{dayWord}的相处时间换成一段共同经历。", "说不定下次的活动，就是这趟认识的谁发起的。"],
        fit: ["{audience}，以及想找人一起出去走走的你。", "愿意和陌生人并排走一段路、聊几句的人。", "社恐也没关系，走路时沉默也很自然。"],
        reasons: ["小队伍制，限{limit}{limitUnit}，保证每个人都插得上话。", "路线强度适中，注意力可以留给同伴。"],
      },
      quotes: ["并排走过一段路，比并排坐一天更有用。", "同频的人，是在路上遇到的。", "聚会不必有桌子，有路就够了。"],
    },
    season: {
      label: "季节", verb: "赶", focus: "时令",
      titles: ["{seasonWord}的{P}，值得赶一趟", "{P}{D}：只有这一季才有的样子", "踩准{seasonWord}的步点去{P}"],
      leads: ["{seasonWord}的{P}，一年只有这一段时间。{D}出发，把这一季收进脚步里。",
              "{D}去{P}。{seasonWord}的时令不等人，{distWord}走完，正好赶上这一季。"],
      paras: {
        why: ["{seasonWord}有明确的窗口期，错过就要等一年。", "选在{D}，是为了赶上{P}这一季才成立的状态。", "时令不等人，这一季的{P}只属于现在。"],
        experience: ["{seasonWord}的体感与其它季节不同，出发前按当季准备衣物更稳妥。", "{difficultyWord}的强度配{seasonWord}的天气，节奏需要按当季调整。", "当季的光线和颜色，过完这阵就调不回来了。"],
        route: ["{startTime}集合出发，{endTime}返回，预留应对当季日照的时间。", "全程约{distWord}，按当季路况安排休息。"],
        gain: ["把{seasonWord}的这一段留在记忆里。", "等到换季，你手里有一段别人没有的记录。", "错过今年，要等下一次轮回。"],
        fit: ["{audience}，以及想踩准时令走一趟的人。", "愿意按当季准备、不介意天气变化的人。", "想拍到当季样子的人，这趟最值。"],
        reasons: ["{D}落在{seasonWord}窗口内，时令是这场的核心价值。", "限{limit}{limitUnit}，保证当季队伍不拥挤。"],
      },
      quotes: ["时令不等人，路也不会一直等。", "一年只有一段时间，值得为它腾出一天。", "赶在换季之前，把这一程走完。"],
    },
    lifestyle: {
      label: "生活方式", verb: "过成", focus: "日常",
      titles: ["把{dayWord}过成{P}的样子", "{P}{D}：另一种过法", "在{P}，换一种节奏生活"],
      leads: ["如果{dayWord}可以不用通勤和会议开头，它会是什么样？{D}的{P}是一种回答。",
              "{D}把生活搬到{P}：走路、吃饭、聊天，节奏比平时慢一档。"],
      paras: {
        why: ["户外不是假期特供，它可以是一种常规的过法。", "把{D}交给{P}，是给日常换一个参照。", "不必等长假，一个周末就够重启一次。"],
        experience: ["{difficultyWord}的强度不会打乱生活，反而让第二天更清醒。", "在{envLabel}里走{dayWord}，身体会重新记住什么是舒展。", "走完回来，周一没那么难熬了。"],
        route: ["{startTime}出发，{endTime}回到集合点，不影响第二天的安排。", "全程约{distWord}，属于可以放进常规日程的强度。"],
        gain: ["带回去的是一种可以重复的生活节奏。", "把户外从「偶尔」变成「可以安排」。", "这种节奏攒多了，就成了生活方式。"],
        fit: ["{audience}，以及想把户外变成日常的人。", "工作日节奏紧、周末想换一种过法的人。", "独行或约朋友都行，关键是走出去。"],
        reasons: ["单日行程，前后不占额外时间。", "限{limit}{limitUnit}，把体验控制在舒服的规模。"],
      },
      quotes: ["把日子过成户外，比把户外当假期更耐用。", "生活方式不需要远行，需要一天。", "重复得起来，才算生活方式。"],
    },
  };
  function angleVoice(angle) { return EDITORIAL_ANGLE_VOICE[angle] || EDITORIAL_ANGLE_VOICE.scenery; }
  /* 事实填充：{P} 地点 / {D} 日期 / {seasonWord} 季节 / 其余为可选事实，缺省时整句降级为中性表述。
     只做字符串替换，不引入任何未确认信息。 */
  function fillFrames(frames, f) {
    const one = (tpl) => String(tpl || "").replace(/\{(\w+)\}/g, function (_, k) {
      const v = (f && f[k] != null) ? String(f[k]) : "";
      if (k === "P") return v || "这条路线";
      if (k === "D") return v || "这一天";
      if (k === "seasonWord") return v || "当季";
      if (k === "distWord" || k === "eleWord") return v ? v : "";
      return v;
    }).replace(/\s{2,}/g, " ").replace(/，\s*，/g, "，").replace(/。\s*。/g, "。").trim();
    return (frames || []).map(one).filter(Boolean);
  }
  /* 主生成：由「风格(角度+密度) × 事实」组合出完整内容包 */
  function angleEditorialPack(a, variant, dna) {
    a = a || {}; variant = variant || {}; dna = dna || {};
    const angle = variant.angle || "scenery";
    const V = angleVoice(angle);
    const f = editorialFacts(a, dna);
    const dens = (typeof EDITORIAL_DENSITY !== "undefined" && EDITORIAL_DENSITY[variant.density]) || EDITORIAL_DENSITY.magazine;
    const takes = (arr, n) => fillFrames(arr, f).slice(0, n);
    // 标题：按角度写出，缺地点时自动降级；同一风格下 titleIdx 轮换，避免连点同一风格永远同一句
    const titles = fillFrames(V.titles, f);
    const leads = fillFrames(V.leads, f);
    const quotes = fillFrames(V.quotes, f);
    const paras = {};
    Object.keys(V.paras || {}).forEach(function (k) { paras[k] = fillFrames(V.paras[k], f); });
    // 副标题：角度 label + 事实骨架，不含任何未确认画面
    const subtitle = [V.label, f.dateShort ? f.dateShort : "", f.distWord ? f.distWord : "", f.difficultyWord ? f.difficultyWord + "强度" : ""]
      .filter(Boolean).join(" · ");
    // 图片叙事策略（风格轴决定，但不改 sec.imgCount 这一 P0-12 契约）
    const ps = EDITORIAL_STYLE_PHOTO[variant.style] || { name: "标准", galleryBias: 1, perSectionBias: 1 };
    return {
      angle: angle, angleLabel: V.label,
      styleId: variant.style || "", layoutId: variant.layout || "", density: variant.density || "magazine",
      createdAt: Date.now(),
      title: titles[0] || (f.P + (f.dateShort ? f.dateShort : "")),
      titleAlts: titles.slice(),
      subtitle: subtitle,
      lead: leads.length ? leads.join("\n") : "",
      paras: paras,
      pullQuote: quotes[0] || "",
      pullQuoteAlts: quotes.slice(),
      photoStrategy: { name: ps.name, galleryBias: ps.galleryBias, perSectionBias: ps.perSectionBias },
      factsFingerprint: editorialFactsFingerprint(a),
      dnaFactFingerprint: dnaFactFingerprint(a),
    };
  }
  /* 事实指纹：事实一变，旧内容包自动作废（防止换了日期/价格还沿用旧文案） */
  function editorialFactsFingerprint(a) {
    a = a || {};
    return [a.place, a.date, a.dateMD, a.price, a.distance, a.elevation, a.difficulty, a.days, a.limit, a.limitUnit,
      a.meeting, a.meetTime, a.returnTime, a.title,
      (a.itineraryDays || []).map(function (d) { return (d.label || "") + "|" + (d.items || []).map(function (i) { return (i.time || "") + (i.text || ""); }).join(","); }).join(";"),
      (a.feeInclude || []).join(","), (a.feeExclude || []).join(","),
      (a.gear || []).map(function (g) { return g && g.name; }).join(","),
      [a.includeLeader ? "领队" : "", a.includeInsurance ? "保险" : "", a.includeTransport ? "交通" : "", a.includeMeal ? "餐食" : ""].join("/"),
    ].map(function (v) { return String(v == null ? "" : v); }).join("~");
  }
  function dnaFactFingerprint(a) {
    const d = (a && a.activityDNA) || null;
    if (!d) return "";
    return [(d.groundedScenes || []).join(","), d.environment || "", d.season || "", d.activityForm || ""].join("~");
  }
  /* 取当前有效的内容包：角度匹配 + 两条事实指纹都匹配才认（否则视为过期，渲染层回退旧路径） */
  function editorialStylePackOf(a) {
    const p = a && a.editorialStylePack;
    if (p && p.angle) {
      if (p.factsFingerprint !== editorialFactsFingerprint(a)) return null;
      if (p.dnaFactFingerprint !== dnaFactFingerprint(a)) return null;
      const variant = (typeof editorialVariantOf === "function") ? editorialVariantOf(a) : null;
      if (variant && p.angle !== variant.angle) return null;   // 角度不一致 → 换版式不该复用（角度由风格决定）
      return p;
    }
    /* 懒生成：未显式「换过风格」的活动（§七 一键生成 / 历史活动 / 导入活动），
       按当前自动选定的风格直接产出角度化文案包，让默认图文页也是「角度驱动」，
       而不是千篇一律的 canonical 副本（修复「所有文案都一样 / 跟原来一样」）。
       只「按当前风格产出」、不旋转风格——旋转由 regenStyleContent 负责。 */
    if (a && typeof angleEditorialPack === "function") {
      try {
        const dna = (typeof buildActivityDNA === "function") ? buildActivityDNA(a, a.photos) : {};
        const L = (typeof editorialLayoutOf === "function") ? editorialLayoutOf(a) : {};
        const S = (typeof editorialStyleOf === "function") ? editorialStyleOf(a) : {};
        if (S && S.angle) {
          const v = { angle: S.angle, structure: L.structure, img: L.img, density: S.density, layout: L.id, style: S.id, typo: L.typo, family: S.family };
          const np = angleEditorialPack(a, v, dna);
          np._auto = true;   // 自动（未显式「换风格」）生成：hero 仍回退老板原标题 a.title，避免覆盖其原标题
          a.editorialStylePack = np;
          return np;
        }
      } catch (e) {}
    }
    return null;
  }
  /* P0-C：换风格 —— 真正重生成内容，并做「连续重复降权」 */
  function regenStyleContent(a, opts) {
    if (!a) return null;
    opts = opts || {};
    const curStyle = (typeof editorialStyleOf === "function") ? editorialStyleOf(a) : { id: "" };
    const curLayout = (typeof editorialLayoutOf === "function") ? editorialLayoutOf(a) : { id: "" };
    const hist = Array.isArray(a._styleHistory) ? a._styleHistory.slice() : [];
    const recent = hist.slice(-2).map(function (h) { return h && h.contentAngle; }).filter(Boolean);
    // 选下一个风格：逐个尝试，跳过「近两次已用过的角度」（连续重复降权）
    let next = null, tried = 0, prevId = curStyle.id;
    while (tried < EDITORIAL_STYLES.length) {
      const cand = (typeof pickEditorialStyle === "function") ? pickEditorialStyle(prevId) : null;
      if (!cand) break;
      tried++;
      prevId = cand.id;
      if (recent.indexOf(cand.angle) < 0 || tried >= EDITORIAL_STYLES.length) { next = cand; break; }
    }
    next = next || (typeof pickEditorialStyle === "function" ? pickEditorialStyle(curStyle.id) : curStyle);
    // 冻结事实 → 只写 style 轴；事实字段一概不碰
    a.editorialStyleId = next.id;
    const dna = (typeof buildActivityDNA === "function") ? buildActivityDNA(a, a.photos) : null;
    const variant = { angle: next.angle, structure: curLayout.structure, img: curLayout.img, density: next.density, layout: curLayout.id, style: next.id, typo: curLayout.typo, family: next.family };
    const pack = angleEditorialPack(a, variant, dna || {});
    a.editorialStylePack = pack;
    a._styleHistory = hist.concat([{ contentAngle: next.angle, styleId: next.id, layoutId: curLayout.id, createdAt: Date.now() }]).slice(-12);
    // 同步重生成后置的图片策略（不改 sec.imgCount / imgKind）
    return pack;
  }
  function angleLeadOf(angle, a, fb) {
    const A = EDITORIAL_ANGLES[angle] || EDITORIAL_ANGLES.scenery;
    const fbk = fb || {};
    const lead = (fbk.intro || a.intro || A.cta || "").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean)[0] || A.cta;
    return A.label + " · " + lead;
  }
  // 按密度裁剪每段文案长度与段数（画册型短、杂志型中、纪实型全、转化型短而利落）
  function editorialDensityTrim(density, paras) {
    const d = EDITORIAL_DENSITY[density] || EDITORIAL_DENSITY.magazine;
    let out = (paras || []).map(function (p) { return String(p || "").trim(); }).filter(Boolean);
    if (d.maxPara < 99) out = out.slice(0, d.maxPara);
    if (d.trunc > 0) out = out.map(function (p) { return p.length > d.trunc ? p.slice(0, d.trunc) + "…" : p; });
    return out;
  }
  function editorialImgCount(imgMode, secKey) {
    const m = EDITORIAL_IMG[imgMode] || EDITORIAL_IMG["hero-mosaic"];
    return { count: m.secCount, kind: m.secKind };
  }
  function editorialGalleryMode(imgMode) {
    const m = EDITORIAL_IMG[imgMode] || EDITORIAL_IMG["hero-mosaic"];
    return m.gallery;
  }
  /* Case 4：昼夜节奏判定 —— 返回原始 photos 数组中的「白天/夜晚」索引，
     供长页在白天素材之后注入「入夜」章节，自动形成 昼→夜 情绪节奏。
     夜晚信号优先级：照片显式 isNight / analysis.isNight > 内容识别 scene=night / 标签含「夜景」。 */
  function photoDayNight(photos) {
    const list = (photos || []).filter(Boolean);
    const night = [], day = [];
    list.forEach((p, i) => {
      let isNight = !!(p && p.isNight) || !!(p && p.analysis && p.analysis.isNight);
      if (!isNight) {
        try {
          const sig = analyzeOnePhoto(typeof p === "string" ? p : (p.src || ""), i, null);
          isNight = sig.scene === "night" || (sig.tags || []).indexOf("夜景") >= 0;
        } catch (e) { isNight = false; }
      }
      (isNight ? night : day).push(i);
    });
    return { night: night, day: day, nightCount: night.length, dayCount: day.length, total: list.length, hasRhythm: night.length > 0 && day.length > 0 };
  }

  function buildEditorialOutline(a) {
    a = a || {};
    // P0-12：同一活动按不同「变体」生成不同角度/结构/图片/密度的图文长页
    // P0-13：版式轴(layout→structure/img/typo) 与 风格轴(style→angle/density/family) 解耦
    const variant = (arguments.length > 1 && arguments[1]) ? arguments[1] : editorialVariantOf(a);
    const vAngle = variant.angle, vStruct = variant.structure, vImg = variant.img, vDens = variant.density;
    const layout = (variant.layout && EDITORIAL_LAYOUTS.filter(function (x) { return x.id === variant.layout; })[0]) || editorialLayoutOf(a);
    const style = (variant.style && EDITORIAL_STYLES.filter(function (x) { return x.id === variant.style; })[0]) || editorialStyleOf(a);
    const vTypo = layout.typo, vFamily = style.family;
    const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a) : null;
    const dn = photoDayNight(a.photos);
    const fb = (typeof dnaCopyFor === "function") ? dnaCopyFor(dna || {}) : {};
    /* P0-C：换风格生成的内容包优先 —— 有包用包（正文本就是这次风格重生成的产物），
       无包回退旧路径。事实章节（行程/费用/装备）永远来自 canonical 字段，不受内容包影响。 */
    const pk = (typeof editorialStylePackOf === "function") ? editorialStylePackOf(a) : null;
    const pkPick = (key, v, f) => {
      const pl = (pk && pk.paras && pk.paras[key]) || null;
      return (pl && pl.length) ? pl.slice() : pick(v, f);
    };
    const theme = (dna && dna.mainTheme) || a.storyPurpose || a.editorialTitle || a.title || "这一程";
    const sig = (dna && dna.sceneSignature) || "";
    const angles = (dna && dna.copyAngles) || [];
    const envLabel = (dna && dna.environmentLabel) || a.place || "山野";
    const lines = (t) => String(t || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const pick = (v, f) => (lines(v).length ? lines(v) : lines(f));
    const st = a.sectionTitles || {};
    const heads = EDITORIAL_ANGLE_HEADINGS[vAngle] || {};

    // 各章节先按固定逻辑生成内容，再按 variant 做「角度化标题 / 密度裁剪 / 取图数量」
    const byGroup = {};
    const make = (group, key, kind, baseHeading, paras) => {
      const list = editorialDensityTrim(vDens, paras || []);
      if (!list.length) return;
      const ic = editorialImgCount(vImg, key);
      byGroup[group] = byGroup[group] || [];
      byGroup[group].push({ group: group, key: key, kind: kind, heading: heads[key] || baseHeading || theme, paras: list, imgCount: ic.count, imgKind: ic.kind, angle: vAngle, density: vDens, typo: vTypo, family: vFamily });
    };

    make("why", "why", "scenic", st.whyGo || "为什么值得去", pkPick("why", a.whyGo, fb.whyGo));
    make("experience", "experience", "experience", st.experience || "来了会体验什么", pkPick("experience", a.experience, fb.experience));

    // 行程：多日每天一节，统一归到 route 组（保持内部顺序）
    const days = a.itineraryDays || [];
    const dayHasContent = days.some((d) => (d.items || []).some((t) => t && (t.time || t.text)));
    if (dayHasContent) {
      let narTxt = "";
      if (typeof structureItinerary === "function" && typeof buildItineraryNarrative === "function") {
        const itin = structureItinerary(a) || {};
        const nar = buildItineraryNarrative(a, itin.timeline || []);
        if (nar && nar.paras && nar.paras.length) narTxt = nar.paras.join("");
      }
      if (days.length > 1) {
        days.forEach((d, i) => {
          const items = (d.items || []).filter((t) => t && (t.time || t.text));
          if (!items.length) return;
          make("route", "day" + (i + 1), "route", "DAY " + (i + 1) + (d.label ? " · " + d.label : ""),
            [items.map((t) => (t.time ? t.time + " " : "") + t.text).join("；")]);
        });
      } else {
        const items = (days[0].items || []).filter((t) => t && (t.time || t.text));
        make("route", "route", "route", "这一天会怎么过", [narTxt, items.map((t) => (t.time ? t.time + " " : "") + t.text).join("；")]);
      }
    }

    make("gain", "gain", "people", st.gain || "参加完能得到什么", pkPick("gain", a.gain, fb.gain));
    make("fit", "fit", "people", "适合谁", pkPick("fit", a.fitFor, fb.fitFor || (a.targetAudience ? a.targetAudience + "，都能找到自己的步频。" : "")));

    // Case 4：昼夜节奏 —— 白天+夜晚素材齐备时，注入「入夜」章节（kind=night），
    //   排序位于 route 之后、gain 之前，长页自然呈现 白天→夜晚 的情绪弧。
    if (dn.hasRhythm) {
      const nightParas = [];
      if (dna && dna.season) nightParas.push(dna.season + "的白天在脚步里铺开，入夜后营地亮起，这一程换了另一种温度。");
      nightParas.push("白天的山路安静下来，星空或篝火把画面交还给夜——留一段给夜晚，才算完整。");
      make("night", "night", "night", st.night || "从白天到夜晚", nightParas);
    }

    const sp = (a.sellingPoints || []).filter((s) => s && (s.title || s.desc));
    if (sp.length) make("reasons", "reasons", "info", "这场活动的几个理由",
      (pk && pk.paras && pk.paras.reasons && pk.paras.reasons.length)
        ? pk.paras.reasons.slice(0, 6)
        : sp.slice(0, 6).map((s) => ((s.title ? s.title : "") + (s.title && s.desc ? "：" : "") + (s.desc || "")).trim()).filter(Boolean));

    const bodyParas = (a.body || []).map((p) => String(p || "").trim()).filter(Boolean);
    if (bodyParas.length) {
      const half = bodyParas.length > 3 ? Math.ceil(bodyParas.length / 2) : bodyParas.length;
      make("field", "field1", "scenic", "现场纪实", bodyParas.slice(0, half));
      if (bodyParas.length > half) make("field", "field2", "scenic", "路上的细节", bodyParas.slice(half));
    }

    // 兜底：内容极薄时用 DNA 主题 + 标志场景 + 推荐角度撑起大纲，避免长页空壳
    if (!byGroup.why && !byGroup.experience) {
      const extra = [];
      if (theme) extra.push(theme + "。");
      if (sig) extra.push(sig + "。");
      if (angles.length) extra.push(angles.slice(0, 3).join("；") + "。");
      make("why", "why", "scenic", heads.why || (a.editorialTitle || theme), extra);
      if (envLabel) make("experience", "experience", "scenic", heads.experience || (envLabel + "的这一天"),
        [sig || (envLabel + "会给你一个不重复的现场。"), (dna && dna.season ? dna.season + "的" + envLabel + "，值得用脚步丈量。" : "")]);
    }

    // 按 variant.structure 排序输出（route 组保持内部顺序；field 组兜底排在最后）
    const order = EDITORIAL_STRUCTURES[vStruct] || EDITORIAL_STRUCTURES.story;
    const secs = [];
    let num = 0;
    order.forEach((g) => { (byGroup[g] || []).forEach((s) => { num++; s.num = num; secs.push(s); }); });
    Object.keys(byGroup).forEach((g) => { if (order.indexOf(g) < 0) (byGroup[g] || []).forEach((s) => { num++; s.num = num; secs.push(s); }); });
    return secs;
  }

  /* P0-4：图文详情页的图片匹配——按章节语义（kind）从页面图片智能里取图（scenic/experience/route/people…），
     不足时从「未用过的图」按序补；最多 3 张，构成「图片组合」（1 整幅 / 2 对开 / 3 三联）。 */
  function editorialPhotosFor(a, sec, usedSet, cap) {
    const photos = (a && a.photos) || [];
    const out = [];
    // v192：每节取图「预算」由页面级分配计划给出（cap）；缺省回退到变体 img 结构（P0-12 语义不变）
    const want = Math.max(1, +cap || (sec && sec.imgCount) || 2);
    const addSrc = (src) => { const i = photos.indexOf(src); if (i >= 0 && out.indexOf(i) < 0 && !usedSet.has(i)) out.push(i); };
    const intel = (typeof pagePhotoIntel === "function") ? pagePhotoIntel() : null;
    if (intel && intel.matched && intel.matched.length) {
      const meta = (typeof pagePhotoSections === "function") ? pagePhotoSections(a) : [];
      for (let i = 0; i < meta.length; i++) {
        if (meta[i].kind !== sec.kind) continue;
        ((intel.matched[i] && intel.matched[i].photos) || []).forEach((p) => addSrc(p.src));
      }
      if ((sec.kind === "route" || /^day/.test(sec.key)) && typeof pageItineraryPhotos === "function") {
        const ip = pageItineraryPhotos(a);
        if (ip && ip.byDay) Object.keys(ip.byDay).forEach((k) => (ip.byDay[k] || []).forEach((p) => addSrc(p && p.src)));
      }
    }
    // Case 4：「入夜」章节优先取夜晚素材，确保昼→夜节奏在配图上也成立
    if (sec.kind === "night") {
      const dn = (typeof photoDayNight === "function") ? photoDayNight(photos) : null;
      if (dn && dn.night.length) dn.night.forEach((i) => { if (out.length < want && out.indexOf(i) < 0 && !usedSet.has(i)) out.push(i); });
    }
    /* v192 修复（照片驱动）：旧逻辑只在「语义匹配一张都没命中」时才从池子里顺序补图，
       于是语义命中 1 张的章节永远只有 1 张、剩余照片全部闲置（实测 20 张只用了 7 张）。
       现改为「语义不足 → 一律补齐到该节预算」，既让每节都有图，也不浪费用户上传的照片。 */
    if (out.length < want) {
      for (let i = 0; i < photos.length && out.length < want; i++) if (!usedSet.has(i) && out.indexOf(i) < 0) out.push(i);
    }
    const res = out.slice(0, want);
    res.forEach((i) => usedSet.add(i));
    return res;
  }

  /* v192：页面级配图分配计划 —— 目标「照片驱动」：
     ① 每个章节至少 1 张；② 余图优先补给章节第二/三张（轮转，不超过变体上限）；
     ③ 再留 1–3 张给结尾「现场影像」图廊；④ 章节容量已满时分不出去的，一律并入图廊（不浪费）。
     每节上限仍由变体 img 结构决定（hero-mosaic=2 / small-thumbs=3 / big-solo|gallery-strip=1），
     故 P0-12「不同变体图片结构不同」的语义保持不变（sec.imgCount 未被改写）。 */
  function planEditorialPhotoCaps(photoCount, secs, coverIdx, maxPer, galleryMax) {
    const pool = [];
    for (let i = 0; i < (photoCount || 0); i++) if (i !== coverIdx) pool.push(i);
    const list = secs || [];
    const n = list.length;
    const cap = Math.max(1, +maxPer || 1);
    /* 结尾「现场影像」图廊预留：照片 ≥3 张时至少留 1 张（p0-4 长图文契约：须有结尾影像组），
       富余时最多 3 张；但永远至少留 1 张给正文章节，避免整页只剩图廊。 */
    let reserveN = pool.length >= 3 ? Math.min(3, Math.max(1, pool.length - n)) : 0;
    reserveN = Math.min(reserveN, Math.max(0, pool.length - 1));
    let extra = Math.max(0, (pool.length - reserveN) - n);   // 可补给章节第二/三张的富余
    const caps = {};
    list.forEach((s) => { caps[s.key] = 1; });
    let guard = 0;
    while (extra > 0 && guard < 64) {
      let moved = false;
      for (let i = 0; i < n && extra > 0; i++) {
        const k = list[i].key;
        if (caps[k] < cap) { caps[k]++; extra--; moved = true; }
      }
      if (!moved) break;
      guard++;
    }
    reserveN += extra;                                         // 章节容量已满 → 分不出去的并入图廊，不浪费照片
    reserveN = Math.max(0, Math.min(reserveN, pool.length));
    if (galleryMax && reserveN > galleryMax) reserveN = galleryMax;
    return { caps: caps, reserveN: reserveN, pool: pool };
  }

  // 适合 / 不适合人群：只依据已确认事实，不做医疗或安全承诺
  function blockSuitability(a) {
    const fit = [], unfit = [];
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    if (confirmed.has("age")) {
      fit.push("符合机构确认的年龄范围：" + a.ageRange);
      unfit.push("年龄不在 " + a.ageRange + " 范围内");
    }
    if (confirmed.has("difficulty")) fit.push("能够完成机构确认的“" + a.difficulty + "”强度");
    if (confirmed.has("days") && a.days > 1) fit.push("可以完整参加 " + a.days + " 天行程");
    if (confirmed.has("meetTime") && confirmed.has("meeting")) fit.push("可以按时到达 " + a.meeting);
    if (a.type === "高海拔登山" && !confirmed.has("difficulty")) unfit.push("尚未与机构确认体能和经验要求的人");
    if (!fit.length) fit.push("请先向机构确认年龄、体能和经验要求");
    if (!unfit.length) unfit.push("不符合机构最终报名条件的人");
    if (!fit.length && !unfit.length) return "";
    return `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("users")}</span><h3>适合与不适合</h3></div><div class="suit-grid">`
      + (fit.length ? `<div class="suit-col ok"><div class="suit-h">适合</div>${fit.map((t) => `<div class="suit-row">${ICON("check")}<span>${esc(t)}</span></div>`).join("")}</div>` : "")
      + (unfit.length ? `<div class="suit-col no"><div class="suit-h">不适合</div>${unfit.map((t) => `<div class="suit-row">${ICON("x")}<span>${esc(t)}</span></div>`).join("")}</div>` : "")
      + `</div></div>`;
  }

  function pageComposition(a) {
    // P0-12：页面编排由 Activity DNA 驱动（活动形式/强度/人群），不只按粗类型——
    // 同为「徒步」，秋季林间、夏日溪谷、雪山挑战、亲子自然会走不同版式。
    const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a) : null;
    const form = dna ? dna.activityForm : "";
    if (a.type === "高海拔登山" || (form === "mountain" && dna && dna.intensity === "challenge")) return "expedition";
    if (a.type === "城市旅行" || a.type === "景区观光" || form === "culture") return "city-guide";
    if (isFamilyActivity(a) || form === "family") return "family-journal";
    if (a.type === "露营" || form === "camp") return "camp-diary";
    return "route-journal";
  }

  function editorialSectionTitle(a) {
    if (a.editorialTitle && String(a.editorialTitle).trim()) return String(a.editorialTitle).trim();
    const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a) : null;
    const form = dna ? dna.activityForm : "";
    if (a.type === "高海拔登山" || (form === "mountain" && dna && dna.intensity === "challenge")) return "先看清强度，再决定是否出发";
    if (a.type === "城市旅行" || a.type === "景区观光" || form === "culture") return `把${a.days > 1 ? a.days + "天" : "这一天"}留给${a.place}`;
    if (isFamilyActivity(a) || form === "family") return a.distance ? `让孩子自己走完这${a.distance}公里` : "让孩子自己完成这一次";
    if (form === "water") return (dna && dna.season) ? `${dna.season}最该做的事，是把自己交给水` : "这趟水，值得期待";
    // camp 必须在 distance 兜底之前：否则露营会被套上「这 N 公里」的徒步口吻（验收 2 要求同类型不同场景明显不同）
    // 措辞只陈述「住一晚」这一活动形式本身，不引入星空/篝火/天气等未确认事实
    if (form === "camp" || a.type === "露营") return (dna && dna.season) ? `${dna.season}，在户外住一晚` : "这一晚，换个地方睡";
    if (a.distance) return `这${a.distance}公里，具体意味着什么`;
    return `${(dna && dna.season) ? dna.season + "，" : ""}为什么是这次${a.place}${a.type}`;
  }

  /* ============ V2.1 文案深度引擎：Prompt Enhancer + 去 AI 味 + 公式 + 多阶段管线 ============ */
  // —— 去 AI 味黑名单：删除空洞无画面感词汇（出现即剔除）——
;


  // —— Prompt Enhancer：隐式变量补全 + 风格路由 ——




  // —— 公式化结构：[情绪Hook/痛点反差] + [核心场景/五感体验] + [轻量干货] + [行动召唤] ——





  // —— 多阶段管线：阶段 A 爆款标题与情绪前言 ——



  // —— 阶段 B 路线核心卖点（3 个具象场景卖点）——


  // —— 阶段 C 逻辑化逐日行程 ——


  // —— 阶段 D 后勤干货与安全须知 ——





  // 文案归一化：去掉空白与标点，便于判断两条文案是否实质相同
  function normCopyTxt(s) { return String(s || "").replace(/[\s\p{P}\p{S}]/gu, ""); }
  // 判断两条文案是否实质相同：完全相同 / 一方包含另一方 / 共同前缀 ≥ 6 字。
  // 用于避免「亮点 bullets」与「产品亮点卡片」把同一批卖点渲染两遍。
  function isSameCopy(a, b) {
    const x = normCopyTxt(a), y = normCopyTxt(b);
    if (!x || !y) return false;
    if (x === y) return true;
    if (x.includes(y) || y.includes(x)) return true;
    let i = 0;
    while (i < x.length && i < y.length && x[i] === y[i]) i++;
    return i >= 6;
  }
  function pipelineSellingHtml(a) {
    const pl = a.pipeline;
    if (!pl || !pl.sellingPoints || !pl.sellingPoints.length) return "";
    const cover = Math.max(0, Math.min(+(a.coverIndex || 0), Math.max(0, (a.photos || []).length - 1)));
    const intel = (typeof pagePhotoIntel === "function") ? pagePhotoIntel() : null;
    // P0-6：候选图池优先用「内容筛选后保留」的图（已按内容排序，而非上传顺序），排除封面
    const pool = (intel && intel.used && intel.used.length)
      ? intel.used.filter((p) => p.index !== cover)
      : (a.photos || []).map((_, i) => ({ index: i, src: a.photos[i], tags: [] })).filter((p) => p.index !== cover);
    const usedSet = new Set();
    return `<div class="dsec sp-sec" id="sec-highlights"><div class="dsec-h"><h3>产品亮点</h3></div>
      <div class="feature-stack">${pl.sellingPoints.map((s, i) => {
        // 内容匹配：亮点关键词 ↔ 图片标签语义对齐；命中且尚未用过的优先
        const kw = (s.title || "") + " " + (s.desc || "");
        let pick = null;
        for (const p of pool) { if (!usedSet.has(p.index) && (typeof sellMatch === "function" ? sellMatch(kw, p) : false)) { pick = p; break; } }
        if (!pick) { for (const p of pool) if (!usedSet.has(p.index)) { pick = p; break; } }      // 退而求其次：用下一张未用的（仍是内容筛选池，非上传顺序）
        if (!pick && pool.length) pick = pool[i % pool.length];                                    // 极端兜底：保证不白屏
        const imgIdx = pick ? pick.index : -1;
        const hasImg = imgIdx >= 0 && a.photos && a.photos[imgIdx];
        if (pick) usedSet.add(imgIdx);
        const num = String(i + 1).padStart(2, "0");
        return `<div class="feature-card">
          ${hasImg ? `<div class="feature-media">${mediaBlock(a, imgIdx, "")}</div>` : ""}
          <div class="feature-body">
            <div class="feature-head">
              <span class="feature-num">${num}</span>
              <h4 class="feature-title">${esc(s.title)}</h4>
            </div>
            <p class="feature-desc">${esc(s.desc)}</p>
          </div>
        </div>`;
      }).join("")}</div>
    </div>`;
  }
  function pipelineNotesHtml(a) {
    const pl = a.pipeline;
    if (!pl || !pl.details) return "";
    const d = pl.details;
    const refund = (d.refund && d.refund.length) ? `<div class="note-block"><div class="note-h">退改守则</div>${d.refund.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}</div>` : "";
    const alt = (d.altitude && d.altitude.length) ? `<div class="note-block"><div class="note-h">高海拔提示</div>${d.altitude.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}</div>` : "";
    // 防御：pipeline.details 可能来自本地兜底（applyDnaCopyFallback 会写成 {}），
    // 此时 must/suggest 缺失 → 旧代码 .map 直接抛错，导致整页详情崩溃。
    const must = Array.isArray(d.must) ? d.must : [];
    const suggest = Array.isArray(d.suggest) ? d.suggest : [];
    const gear = ((!a.gear || !a.gear.length) && (must.length || suggest.length))
      ? `<div class="note-block"><div class="note-h">装备建议</div>${must.length ? `<div class="note-sub">强制</div>${must.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}` : ""}${suggest.length ? `<div class="note-sub">建议</div>${suggest.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}` : ""}</div>`
      : "";
    return `<div class="dsec note-sec"><div class="dsec-h"><span class="dsec-ic">${ICON("shield")}</span><h3>出行须知</h3></div>${refund}${alt}${gear}</div>`;
  }



/* =================== MERGED FROM src/pipeline.js =================== */
/* pipeline.js  (facade: 15 clean module names + CLUBOS_PIPELINE) */
/* ================= ClubOS · AI Pipeline 文档对照层（v153） =================
   用途：把 V142 优化文档「§四 建议代码层新增/调整模块」「§五 推荐状态结构」「§十 模块定义」
        里建议的模块名与函数名，逐字映射到本项目的既有实现，并提供单一聚合状态 activityAiState，
        便于①按文档逐条对照验收；②调试时一处取到全量中间产物。

   三条硬原则（必须遵守，否则这层就成了谎）：
     ① 只做「取名 + 聚合」，零二次逻辑 —— 每个别名直接转发既有实现，不重写、不复制业务判断；
     ② 全部防御式 —— 目标模块未加载（如 front.html 不加载 publish.js）时返回安全空值，不抛错；
     ③ 事实边界不变 —— 本层绝不生成任何事实，只搬运已确认事实与既有推断结果。

   名称对照表（文档名 → 本项目实现）：
     extractFacts            → extractConfirmedFacts（降级 consumerFactSnapshot，同字段名）
     detectMissingFacts      → missingRequiredFacts
     confidenceMap           → factRegistry 的 confirmed/inferred/missing
     buildActivityDNA        → buildActivityDNA（同名，已实现）
     structureItinerary      → structureItinerary（同名，已实现）
     analyzePhotos           → analyzePhotos
     selectPhotos            → selectPhotos
     assignPhotoRoles        → assignAllRoles
     matchPhotosToSections   → matchPhotosToSections（宣发 sections）
     matchItineraryPhotos    → matchItineraryPhotos（详情页逐日行程）
     evaluateCropSafety      → evaluateCropSafety / evaluateCropSafetyAll
     buildAdaptiveLayout     → buildAdaptiveLayout
     buildPageStoryOutline   → buildPageStoryOutline
     generateSectionCopy     → generateSectionCopy（事实驱动的段落换说法）
     validateClaims          → contentQuality（含 unsupported:* 标记）
     validateLayout          → editorialQuality
     renderActivityStoryPage → renderActivityPhone
     describePhotoProfile    → 新增：输出文档 P0-7 要求的完整图片画像字段
     buildActivityAiState    → 新增：聚合文档 §五 的 14 个状态位（严格对齐推荐状态结构）
*/

/* ---------- §四 事实层 ---------- */

/* consumerFactSnapshot(a, photos) → 消费者事实快照（与 publish.js 的 extractConfirmedFacts 「同字段名」）
   ⚠️ 这个函数必须与 publish.js 的 extractConfirmedFacts 保持一致！
   原因：extractFacts 在 admin 页走 extractConfirmedFacts、在 C 端（无 publish.js）走本函数，
        两条路径若字段名/语义不同，同一活动会得出「25 个事实」vs「0 个事实」的矛盾结果。
   防漂移：冒烟测试里有一条断言 —— 在加载 publish.js 的模式下，比对两者的键集必须完全相等，
          一旦 publish.js 改了字段，测试即失败（见 pipe epilogue 的 extractFacts_shapeMatches）。
   本函数只做「取值」，不做置信度判断；置信度请用 confidenceMap()。 */
function consumerFactSnapshot(a, photos) {
  const s = a || {};
  const season = (typeof seasonOf === "function") ? seasonOf(s) : ((typeof publishSeason === "function") ? publishSeason(s) : "");
  return {
    activityName: s.title || "", activityType: s.type || "", place: s.place || "",
    date: s.dateMD || s.date || "", season: season,
    price: s.price != null ? s.price : "", limit: s.limit || "", limitUnit: s.limitUnit || "人",
    days: s.days || 1, ageRange: s.ageRange || "", audience: (s.audience || []).join("/"),
    distance: s.distance || "", elevation: s.elevation || "", difficulty: s.difficulty || "",
    meeting: s.meeting || "", meetTime: s.meetTime || "", returnTime: s.returnTime || "",
    includedServices: s.feeInclude || [], gear: (s.gear || []).map((g) => (g && g.name) || g),
    transport: s.transport || "", meal: s.meal || "", insurance: s.insurance || "",
    leader: s.leaderName ? (s.leaderName + (s.leaderYears ? "（" + s.leaderYears + "）" : "")) : "",
    itinerary: s.itineraryDays || [],
    photosCount: (photos || []).length,
  };
}

/* extractFacts(a, photos) → 消费者视角的事实快照（文档 §四 / §五 confirmedFacts）
   首选 publish.js 的 extractConfirmedFacts —— 它就是 AI 生成实际使用的那份事实源；
   该模块未加载时（C 端 / 详情页）用 consumerFactSnapshot 产出「同字段名」的快照，保证两路径可比。 */
function extractFacts(a, photos) {
  if (typeof extractConfirmedFacts === "function") {
    try { return extractConfirmedFacts(a, photos) || consumerFactSnapshot(a, photos); } catch (e) { /* 降级 */ }
  }
  return consumerFactSnapshot(a, photos);
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
function assignPhotoRoles(used) { return (typeof assignAllRoles === "function") ? assignAllRoles(null, { used }) : { heroId: null, roles: {} }; }
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
    warmthRatio: 0, coolRatio: 0, warmthLabel: "未判定",
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
  // Case 1：暖感也属于「图片画像」——由已选图的色调信号汇总（warm/blue），无信号时为中性
  const avgSig = (k) => (used.length ? Number((used.reduce((s, p) => s + (p[k] || 0), 0) / used.length).toFixed(2)) : 0);
  const warmthRatio = avgSig("warm"), coolRatio = avgSig("blue");
  const warmthLabel = (warmthRatio >= 0.42 && warmthRatio - coolRatio >= 0.12) ? "暖调"
    : ((coolRatio >= 0.34 && coolRatio - warmthRatio >= 0.14) ? "冷调" : "中性");

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
    warmthRatio: warmthRatio, coolRatio: coolRatio, warmthLabel: warmthLabel,
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

/* validateClaims(out, facts, adv) → Claim→Fact 校验结果（文档 P2-2）
   只搬运 contentQuality 的既有判定，不新增规则。 */
function validateClaims(out, facts, adv) {
  const res = { available: false, score: null, unsupported: [], fiction: [], flags: [], note: "" };
  if (typeof contentQuality !== "function") return res;
  let cq = null;
  try { cq = contentQuality(out, {}, "recruit", facts, adv) || {}; } catch (e) { return res; }
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
  if (typeof editorialQuality !== "function" || !dir) return res;
  try {
    const eq = editorialQuality(dir, scenario || "recruit", (dir && dir.family) || "", (dir && dir.variant) || 0) || {};
    res.available = true; res.score = eq.score; res.flags = eq.flags || [];
  } catch (e) { /* 保持 available:false */ }
  return res;
}

/* ---------- §四 编排 / 渲染层 ---------- */
function renderActivityStoryPage(a) {
  return (typeof renderActivityPhone === "function") ? renderActivityPhone(a) : "";
}
function pageCompositionOf(a) { return (typeof pageComposition === "function") ? pageComposition(a) : ""; }
function editorialSectionTitleOf(a) { return (typeof editorialSectionTitle === "function") ? editorialSectionTitle(a) : ""; }

/* ---------- §五 聚合状态（严格对齐文档推荐状态结构，14 字段） ----------
   buildActivityAiState(a, opts) → 文档推荐的单一状态对象。
   opts: { photos, scenario, dir, out, master, sections }
   仅聚合「已产出」的内容 —— finalCopy/claimValidation 等在未生成时保持 null，
   不做任何占位编造（宁可为 null，也不给假数据）；返回键集精确等于文档 §五 的 14 项。 */
function buildActivityAiState(a, opts) {
  const o = opts || {};
  const photos = o.photos || (a && a.photos) || [];
  const scenario = o.scenario || "recruit";
  const intel = buildPhotoLayoutIntelligence(photos, a, o.sections || [], scenario);

  return {
    /* §五 推荐状态结构（文档对照层：严格 14 字段，零额外派生键，顺序与文档一致）
       publishCheck / photoLayout / cropSafety / photoToSections / photoIntel 等原始派生数据
       不纳入聚合状态 —— 仍可通过 CLUBOS_PIPELINE.publishCheck / evaluateCropSafety /
       matchPhotosToSections / buildAdaptiveLayout / describePhotoProfile 独立取得。 */
    confirmedFacts: extractFacts(a, photos),
    missingFacts: detectMissingFacts(a),
    confidenceMap: confidenceMap(a),
    activityDNA: activityDNAFor(a, photos),
    itineraryStructure: itineraryStructure(a),
    photoProfile: describePhotoProfile(intel),
    selectedPhotos: intel.used || [],
    photoRoles: intel.roles || {},
    storyOutline: buildPageStoryOutline(a),
    editorialDirection: o.dir || null,
    finalCopy: o.out || null,
    layoutPlan: (o.dir && (o.dir.layout || o.dir.visual)) || null,
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
  qualityCheck: function (out, dir, scenario, facts, adv) { return (typeof qualityCheck === "function") ? qualityCheck(out, dir, scenario, facts, adv) : out; },
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

/* pipelineVersion() → 本层版本号
   ⚠️ 不能读 APP_VER：它在 boot.js 的 IIFE 内（函数作用域，非全局），且 boot.js 在 pipeline.js 之后加载。
   可靠来源：本脚本自身的 ?v= 查询串（bump.py 保证与 version.json 同步），仅在载入时可用。 */
function pipelineVersion() {
  try {
    if (typeof document !== "undefined" && document.currentScript && document.currentScript.src) {
      const m = String(document.currentScript.src).match(/[?&]v=(\d+)/);
      if (m) return "v" + m[1];
    }
  } catch (e) { /* 降级 */ }
  try { if (typeof window !== "undefined" && window.APP_VER) return "v" + window.APP_VER; } catch (e) { /* 降级 */ }
  return "unknown";
}
const PIPELINE_VER = pipelineVersion(); // 载入时立即捕获（document.currentScript 仅此时有效）

/* 控制台逐条验收入口：window.CLUBOS_PIPELINE.extractFacts(...) 等 */
if (typeof window !== "undefined") {
  window.CLUBOS_PIPELINE = {
    version: PIPELINE_VER,
    pipelineVersion: pipelineVersion, // 供测试与排查
    extractFacts: extractFacts,
    consumerFactSnapshot: consumerFactSnapshot, // 降级实现（供防漂移比对）
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
    buildEditorialOutline: buildEditorialOutline,
    photoDayNight: photoDayNight, // Case 4：昼夜素材判定（昼→夜节奏）
    generateSectionCopy: generateSectionCopy,
    heuristicDirection: heuristicDirection,
    photoContentProfile: photoContentProfile, // Case 1/2：照片色调/主体构成信号（暖调、人物占比）
    photoDominance: photoDominance,           // Case 2：人物主导 / 风景主导判定
    autoEditorialPick: autoEditorialPick,     // Case 1/2：按照片自动选版式轴 + 风格轴
    styleAccent: styleAccent,                 // Case 1：暖调 accent
    recapHasActualEvidence: recapHasActualEvidence,           // Case 10：回顾是否存在真实来源
    stripFabricatedRecapEvents: stripFabricatedRecapEvents,   // Case 10：无来源现场事件阻断
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



/* =================== MERGED FROM src/publish.js =================== */
/* publish.js  (render / copy / quality / 选图) */
/* ================= ClubOS · AI 宣发中心（v113） =================
   一次理解，多平台适配：上传活动资料/照片 → 提取 Content Master →
   生成并排版微信公众号图文（4 套版式，可编辑、可复制 HTML）+
   小红书 / 朋友圈 / 微信群 / 口播 / 海报；活动结束可生成活动回顾。
   无 AI Key 时全部回退到基于真实活动事实的模板生成。 */

/* ================= ClubOS · AI 宣发中心 V2（两阶段生成 + Editorial Direction） =================
   流程：confirmedFacts → Content Strategy → Photo Analysis → Editorial Direction
        → AI 完整文案（六平台） → Layout Plan（family/variant） → 前端组件渲染
   所有文案原则上由 AI 基于真实事实生成；无 Key 时回退到基于事实的模板（仍受 Editorial Direction 驱动）。
   两最高原则：① 允许创造表达，禁止创造事件（不虚构天气/领队行为/用户感受/具体人数/未提供价格）；
              ② 换版式只改视觉、换风格才重生成方向+文案。 */

/* Editorial 家族：3 招募 + 3 回顾，每族 ≥3 变体 = 18 版式（V2.0 §15/16/45） */
/* 变体命名以「版式」为准（P1-3）：避免问答体/对话体/绘本体等文体套路名，改为可预期的视觉结构。 */
var XF_FAMILIES = {
  route_editorial:    { label: "路线叙事", scenario: ["recruit"], variants: ["杂志专题", "大片跨页", "极简刊例"] },
  visual_campaign:    { label: "视觉种草", scenario: ["recruit"], variants: ["卡片流", "清单长图", "左右图文"] },
  challenge_editorial:{ label: "挑战叙事", scenario: ["recruit"], variants: ["数据条版", "纪实长文", "勋章墙"] },
  brand_journal:      { label: "品牌手记", scenario: ["recap"],  variants: ["山野日记", "晨昏手札", "长线随记"] },
  photo_documentary:  { label: "影像纪实", scenario: ["recap"],  variants: ["手账步骤", "图廊穿插", "轻画册"] },
  outdoor_lookbook:   { label: "户外型录", scenario: ["recap"],  variants: ["长图长廊", "九宫格", "胶片墙"] },
};
/* 家族 → 基础版式渲染器（变体在渲染器内做差异化） */
var XF_FAMILY_LAYOUT = { route_editorial: "magazine", visual_campaign: "youth", challenge_editorial: "challenge", brand_journal: "diary", photo_documentary: "family", outdoor_lookbook: "longform" };

/* ---------- 编辑组件库注册表（§25，具名组件 ×21） ----------
 * 所有版式由这些具名组件组合而成；Layout Engine 只选组件、不写文案。
 * type: media(图) / text(文) / meta(信息) / block(整块)；full: 是否整宽。 */
var XF_COMPONENTS = {
  EditorialHero:  { label: "全幅封面", type: "media", full: true,  desc: "封面大图 + 主标题 + 副标题/眉标" },
  ChapterHeader:  { label: "章节标题", type: "text",  full: true,  desc: "章节小标题（h2/h3）" },
  LeadParagraph:  { label: "导语",     type: "text",  full: true,  desc: "开篇导语段" },
  PullQuote:      { label: "引文",     type: "text",  full: true,  desc: "金句引文块" },
  FullBleedImage: { label: "全宽大图", type: "media", full: true,  desc: "整幅图片（带图注）" },
  ImagePair:      { label: "图文左右", type: "media", full: true,  desc: "左文右图 / 左图右文" },
  ImageTriptych:  { label: "三图并置", type: "media", full: true,  desc: "三张图并排" },
  MetricStrip:    { label: "数据条",   type: "meta",  full: true,  desc: "距离/爬升/强度等 KV 条" },
  SectionDivider: { label: "分隔",     type: "text",  full: true,  desc: "章节分隔" },
  EditorialCTA:   { label: "行动号召", type: "meta",  full: true,  desc: "报名 / 下一期预告 CTA" },
  InfoGrid:       { label: "信息网格", type: "meta",  full: true,  desc: "活动信息网格" },
  InfoTable:      { label: "信息表",   type: "meta",  full: true,  desc: "活动信息表" },
  FeeBlock:       { label: "费用说明", type: "meta",  full: true,  desc: "费用 + 服务说明" },
  ServiceBlock:   { label: "服务保障", type: "meta",  full: false, desc: "服务说明块" },
  GalleryGrid:    { label: "照片墙",   type: "media", full: true,  desc: "九宫格 / 网格照片" },
  YouthCard:      { label: "潮流卡片", type: "text",  full: false, desc: "社交种草卡片" },
  FamilyStep:     { label: "手账步骤", type: "text",  full: false, desc: "亲子手账步骤" },
  ChallengeSec:   { label: "挑战章节", type: "text",  full: false, desc: "挑战叙事章节" },
  LongformSec:    { label: "型录章节", type: "text",  full: false, desc: "户外型录章节" },
  UploadHint:     { label: "上传提示", type: "text",  full: true,  desc: "缺图引导" },
  TagRow:         { label: "标签行",   type: "meta",  full: true,  desc: "话题标签行" },
};
function renderComponent(name, opts) {
  opts = opts || {};
  const paras = opts.paras || [];
  const ph = opts.ph || null;
  switch (name) {
    case "EditorialHero":   return opts.html || "";
    case "ChapterHeader":   return `<h2>${esc(opts.h || "")}</h2>`;
    case "LeadParagraph":   return opts.html || "";
    case "PullQuote":       return `<section class="gzh-sec gzh-sec-quote"><div class="gzh-quote-mark">”</div>${opts.h ? `<h2>${esc(opts.h)}</h2>` : ""}<div class="gzh-quote-body">${paras.join("")}</div></section>`;
    case "FullBleedImage":  return ph && ph.src ? `<div class="gzh-wide-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(photoCaption(ph, ""))}</span></div>` : "";
    case "ImagePair":       return (ph && ph.src) ? `<section class="gzh-sec gzh-sec-split"><div class="gzh-split-text">${opts.h ? `<h2>${esc(opts.h)}</h2>` : ""}${paras.join("")}</div><div class="gzh-split-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(photoCaption(ph, ""))}</span></div></section>` : `<section class="gzh-sec gzh-sec-full">${opts.h ? `<h2>${esc(opts.h)}</h2>` : ""}${paras.join("")}</section>`;
    case "MetricStrip":     return (opts.kvs || []).map((r) => `<div class="gzh-challenge-kv"><b>${esc(r.v)}</b><span>${esc(r.k)}</span></div>`).join("");
    case "SectionDivider":  return `<div class="gzh-divider"></div>`;
    case "EditorialCTA":    return opts.text ? `<div class="${opts.cls || "gzh-diary-cta"}">${esc(opts.text)}</div>` : "";
    case "InfoGrid":        return (opts.rows || []).map((r) => `<div class="gzh-info-cell"><span class="gzh-info-k">${esc(r.k)}</span><span class="gzh-info-v">${esc(r.v)}</span></div>`).join("");
    case "InfoTable":       return `<table>${(opts.rows || []).map((r) => `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`).join("")}</table>`;
    case "FeeBlock":        return `${opts.fee ? `<p>${esc(opts.fee)}</p>` : ""}${opts.service ? `<p class="gzh-service">${esc(opts.service)}</p>` : ""}`;
    case "GalleryGrid":     return `<div class="gzh-gallery-grid">${(opts.photos || []).map((p) => `<div class="gzh-gallery-item" ${smartBg(p.src)}><span class="gzh-img-cap">${esc(photoCaption(p, ""))}</span></div>`).join("")}</div>`;
    case "YouthCard":       return `<div class="gzh-youth-card">${ph && ph.src ? `<div class="gzh-youth-card-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(photoCaption(ph, ""))}</span></div>` : ""}<div class="gzh-youth-card-body"><div class="gzh-youth-card-num">0${((opts.i || 0) % 9) + 1}</div>${opts.h ? `<h3>${esc(opts.h)}</h3>` : ""}${paras.join("")}</div></div>`;
    case "FamilyStep":      return `<div class="gzh-family-step"><div class="gzh-family-step-num">${(opts.i || 0) + 1}</div><div class="gzh-family-step-body">${opts.h ? `<h3>${esc(opts.h)}</h3>` : ""}${paras.join("")}</div>${ph && ph.src ? `<div class="gzh-family-step-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(photoCaption(ph, ""))}</span></div>` : ""}</div>`;
    case "ChallengeSec":    return `<section class="gzh-sec gzh-challenge-sec"><div class="gzh-challenge-sec-head"><div class="gzh-challenge-sec-num">0${((opts.i || 0) % 9) + 1}</div>${opts.h ? `<h2>${esc(opts.h)}</h2>` : ""}</div><div class="gzh-challenge-sec-body">${paras.join("")}${ph && ph.src ? `<div class="gzh-challenge-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(photoCaption(ph, ""))}</span></div>` : ""}</div></section>`;
    case "LongformSec":     return `<section class="gzh-sec gzh-longform-sec gzh-longform-sec-${opts.align || "left"}">${ph && ph.src ? `<div class="gzh-longform-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(photoCaption(ph, ""))}</span></div>` : ""}<div class="gzh-longform-text"><div class="gzh-longform-sec-num">0${((opts.i || 0) % 9) + 1}</div>${opts.h ? `<h2>${esc(opts.h)}</h2>` : ""}${paras.join("")}</div></section>`;
    case "UploadHint":      return opts.html || "";
    case "TagRow":          return (opts.tags || []).map((t) => `<span class="gzh-youth-tag">#${esc(t)}</span>`).join("");
    default:                return opts.html || "";
  }
}
function wsIr(xf, isRecap) {
  const dir = (xf && xf.strategy && xf.strategy.editorialDirection) || {};
  const ws = dir.whitespace || "generous";
  let irBand = "mid";
  if (dir.imageRatio != null) irBand = dir.imageRatio >= 0.6 ? "high" : "mid";
  else irBand = isRecap ? "high" : "mid";
  return ` class="gzh-ws-${ws} gzh-ir-${irBand}"`;
}

function publishState() {
  state.xf = state.xf || {
    scenario: null, aid: null, step: null,
    master: null, out: null, recap: null,
    layout: "route_editorial", family: "route_editorial", variant: 0, styleSeed: null,
    photos: [], notes: "", recapNotes: "",
    photoOverrides: { cover: null, excluded: {} },
    genState: "idle", platTab: "gzh", recapType: "",
    strategy: null, quality: null,
    customRecap: { title: "", date: "", place: "", type: "", signups: "", leader: "" },
    _a: null, _styleHistory: [],
  };
  if (!state.xf.customRecap) state.xf.customRecap = { title: "", date: "", place: "", type: "", signups: "", leader: "" };
  if (!state.xf.photoOverrides) state.xf.photoOverrides = { cover: null, excluded: {} };
  if (!state.xf._styleHistory) state.xf._styleHistory = [];
  var xf0 = state.xf;
  if (xf0.scenario === "recruit" && xf0.step === "result") {
    if (!xf0.out || !xf0.master || !xf0.master.mainTheme) { xf0.step = null; xf0.out = null; }
  }
  if (xf0.scenario === "recap" && xf0.step === "result") {
    if (!xf0.recap) { xf0.step = null; }
  }
  return xf0;
}

/* ---------- 工具 ---------- */
function publishSeason(a) {
  // 统一委托 ai.js 的 seasonOf（修复原「10月20日」被误解析为 月=20 的问题，见 v147）
  if (typeof seasonOf === "function") return seasonOf(a);
  return "";
}
function targetUser(a) {
  const t = (a.type || "") + (a.audience || []).join("") + (a.title || "");
  if (/亲子|研学|自然|儿童/.test(t)) return "3-12 岁孩子的家庭，希望周末高质量陪伴";
  if (/露营|营地|派对|音乐/.test(t)) return "想松弛社交、逃离内卷的年轻都市人";
  if (/漂流|溯溪|水上|桨板/.test(t)) return "怕热又爱玩水、想痛快释放的户外新人";
  if (/登山|雪山|越野|高海拔|攀岩/.test(t)) return "有训练基础、追求挑战与完成感的老驴";
  if (/摄影|出片|风光|银河/.test(t)) return "喜欢用相机记录山河的摄影爱好者";
  return "平时坐办公室、周末想动一动的城市人群";
}
function concern(a) {
  const t = (a.type || "") + (a.title || "");
  if (/亲子|研学/.test(t)) return "安全、孩子能否玩得投入、大人是否轻松";
  if (/漂流|溯溪|水上/.test(t)) return "会不会太危险、装备怎么准备、谁带";
  if (/登山|雪山|越野|高海拔/.test(t)) return "强度是否匹配自己、路线是否成熟、保障是否到位";
  return "值不值这个价、强度适不适合我、有没有人带";
}

function typeProfile(a) {
  const t = (a.type || "") + (a.title || "");
  // 注意：这里只输出“抽象的传播方向 / 消费价值”，严禁出现任何具体景观、天气或现场事件。
  // 具体场景一律只能来自 confirmedFacts 与照片；无照片无事实时宁可留白，也不得凭空生成画面。
  if (/亲子|研学|自然|儿童|少儿/.test(t)) return { kind: "family", tone: "温暖、轻快、有画面", themeA: "陪孩子去自然里上一堂户外课", scenic: "适合亲子一起感受的自然环境", experience: "一起动手、一起完成的亲子时光", participation: "一段高质量陪伴，与孩子共同的自然记忆" };
  if (/露营|营地|星空|音乐|派对/.test(t)) return { kind: "camp", tone: "松弛、年轻、有氛围", themeA: "周末逃离城市，去营地松弛一下", scenic: "松弛的户外氛围", experience: "放慢节奏的营地社交", participation: "卸下疲惫的周末放松与同好相聚" };
  if (/漂流|溯溪|水上|溪降|桨板|皮划艇|冲浪/.test(t)) return { kind: "water", tone: "清凉、活泼、直接", themeA: "天热最爽的事，是跳进山里的水里", scenic: "清凉的水上环境", experience: "戏水漂流直接的刺激与畅快", participation: "高温天极致的降温与释放" };
  if (/登山|雪山|高海拔|攀岩|攀冰|越野|重装|穿越/.test(t)) return { kind: "mountain", tone: "克制、专业、有力量", themeA: "用脚步丈量山脊，把城市留在身后", scenic: "开阔的山野地貌", experience: "一步步向上的身体挑战与专注", participation: "体能突破与完成挑战的成就感" };
  if (/摄影|出片|风光|秋色|红叶|花海|银河/.test(t)) return { kind: "photo", tone: "审美、克制、有质感", themeA: "这片山，只为此刻的光而来", scenic: "有层次的户外光影与地貌", experience: "等光、构图的创作过程", participation: "带得走的一组自己拍的大片" };
  return { kind: "hike", tone: "真诚、自然、不浮夸", themeA: "走得动的山，才装得下周末的好心情", scenic: "行走其中才懂的山水与季节变化", experience: "呼吸、流汗、和朋友边走边聊的节奏", participation: "一次身体舒展与精神放空的周末充电" };
}

/* ===== P0-D（v193）CTA 也属于 Fact System =====
   CTA 必须基于真实 signupMethod；名额紧迫感必须来自 capacity - confirmedSignups 的计算。
   禁止无依据的「名额有限 / 最后几个 / 手慢无 / 先到先得 / 名额疯抢 / 马上满员 / 私信我 / 群里接龙 / 评论区扣1」。 */
function confirmedSignupCount(a) {
  if (!a) return 0;
  const list = (typeof state !== "undefined" && state && Array.isArray(state.signups)) ? state.signups : [];
  const mine = list.filter(function (x) { return x && a.id != null && x.activityId === a.id; });
  if (mine.length) return mine.reduce(function (n, x) { return n + (+(x.adults || 1)) + (+(x.children || 0)); }, 0);
  const n = Math.max(0, +((a && a.signups) || 0));
  return isNaN(n) ? 0 : n;
}
function confirmedCTAOf(a) {
  a = a || {};
  const capacity = (a.limit != null && +a.limit > 0) ? +a.limit : null;
  const signed = confirmedSignupCount(a);
  const remaining = (capacity != null) ? Math.max(0, capacity - signed) : null;
  const methods = Array.isArray(a.signupMethod) ? a.signupMethod.slice() : [];
  const deadline = a.signupDeadline || a.enrollDeadline || null;
  return {
    signupMethod: methods,
    capacity: capacity,
    confirmedSignups: signed,
    remainingSlots: remaining,
    deadline: deadline,
    urgencyConfirmed: !!a.urgencyConfirmed,
    hasData: (capacity != null) || signed > 0,
    fillRatio: (capacity && capacity > 0) ? (signed / capacity) : null
  };
}
/* 紧迫感只能来自计算：>50% 不强调；20%-50%「报名进行中」；<=20%「剩余名额不多」；
   只有明确剩余 ≤3 个时才允许写具体数字。没有 capacity 数据一律不说名额。 */
function urgencyTextOf(cta) {
  if (!cta || cta.remainingSlots == null || !cta.capacity) return "";
  if (cta.remainingSlots === 0) return "名额已满。";
  if (cta.remainingSlots <= 3) return "剩余 " + cta.remainingSlots + " 个名额。";
  const r = cta.remainingSlots / cta.capacity;
  if (r <= 0.2) return "剩余名额不多。";
  if (r <= 0.5) return "报名进行中。";
  return ""; // > 50%：不强调
}
/* 报名方式必须有来源；没有配置任何渠道时只给中性表述。 */
function ctaShortOf(a) {
  const c = confirmedCTAOf(a);
  const m = c.signupMethod;
  const parts = [];
  if (m.indexOf("page") >= 0) parts.push("点击本页报名");
  if (m.indexOf("wechat") >= 0) parts.push("添加客服微信咨询报名");
  if (m.indexOf("group") >= 0) parts.push("群内接龙");
  if (m.indexOf("phone") >= 0) parts.push("电话报名");
  if (!parts.length) return "查看活动详情与报名信息";
  return parts.join(" / ");
}
function ctaText(a) {
  a = a || {};
  const c = confirmedCTAOf(a);
  const when = a.dateMD || a.date || "近期";
  const capLine = c.capacity ? (c.capacity + (a.limitUnit || "人") + "名额") : "";
  const urg = urgencyTextOf(c);
  return "报名方式：" + ctaShortOf(a) + "。" + when + " 出发" + (capLine ? "，" + capLine : "") + "。" + urg;
}
/* ===== P0-B（v193）Safe Crop：统一 CropPolicy =====
   图片渲染优先级固定，不可被任何「版式美观 / 容器填满」需求推翻：
     人物·主体完整 > 图片语义正确 > 图片质量 > 版式美观 > 容器填满
   绝不为了「没有留白」而把人裁掉。 */
function cropPolicyOf(src) {
  const m = (typeof photoMeta === "function") ? photoMeta(src) : null;
  const intel = (typeof pagePhotoIntel === "function") ? pagePhotoIntel() : null;
  const p = (intel && Array.isArray(intel.analysis)) ? intel.analysis.filter(function (x) { return x.src === src; })[0] : null;
  let crop = null;
  if (p) {
    crop = (intel.cropSafety && intel.cropSafety.byId && intel.cropSafety.byId[p.imageId]) ||
      ((typeof evaluateCropSafety === "function") ? evaluateCropSafety(p) : null);
  }
  /* 风险等级优先级：① 真实视觉模型 crop_risk（光写回 PHOTO_FOCUS_CACHE 也生效）
                    ② 页面级 intel 里 evaluateCropSafety 的判定（其内部同样以模型优先）
                    ③ 无数据 → low（等价旧 cover 行为）
     ★ 之所以要有 ①：页面级 intel 需要先跑 buildPhotoIntelligence；单张真实结果写回后
       若没跑过整页分析，旧实现会退回 low，把模型判定的 high 风险丢掉。 */
  const modelRisk = (m && m.crop_risk) ? String(m.crop_risk) : ((p && p.cropRisk) ? String(p.cropRisk) : "");
  const localLevel = (crop && crop.level) ? String(crop.level) : "";
  const riskLevel = (["low", "medium", "high"].indexOf(modelRisk) >= 0) ? modelRisk
    : ((["low", "medium", "high"].indexOf(localLevel) >= 0) ? localLevel : "low");
  const realAspect = (m && m.ratio) ? Number(m.ratio) : ((p && p.ratio) ? Number(p.ratio) : null);
  const fp = (m && m.focal_point) ? m.focal_point : ((p && p.focal) ? p.focal : null);
  const focalPoint = fp ? { x: +fp.x, y: +fp.y } : { x: 0.5, y: 0.45 };
  const cropSubjects = (crop && Array.isArray(crop.subjects)) ? crop.subjects : [];
  /* subjects 可能有两种形态：启发式的字符串数组（["人物"]）或真实模型的 [{name,bbox}]。
     两种都要能取到名字与 bbox —— 否则真实模型的 bbox 到不了 Safe Crop。 */
  const metaSubjectsRaw = (m && Array.isArray(m.subjects)) ? m.subjects : [];
  const metaSubjectNames = metaSubjectsRaw.map(function (x) {
    return (x && typeof x === "object") ? String(x.name || x.label || "").trim() : String(x == null ? "" : x).trim();
  }).filter(Boolean);
  const metaBoxes = metaSubjectsRaw.map(function (x) {
    if (!x || typeof x !== "object") return null;
    const b = x.bbox || x.box || null;
    return (b && typeof b === "object") ? b : null;
  }).filter(Boolean);
  const subjects = cropSubjects.length ? cropSubjects : metaSubjectNames;   // 只证明「图里有什么」，不等于活动事实
  let subjectBoxes = (m && Array.isArray(m.subjectBoxes) && m.subjectBoxes.length) ? m.subjectBoxes.slice() : metaBoxes;
  if (!subjectBoxes.length && crop && Array.isArray(crop.subjectBoxes)) subjectBoxes = crop.subjectBoxes.slice();
  const safeCropBox = (m && m.safeCropBox) ? m.safeCropBox : ((crop && crop.safeCropBox) ? crop.safeCropBox : null);
  const allowCrop = (riskLevel !== "high");
  const mode = (riskLevel === "high") ? "aspect_preserved" : (riskLevel === "medium" ? "safe_cover" : "cover");
  const reason = [];
  if (crop && crop.reasons) crop.reasons.forEach(function (r) { reason.push(r); });
  if (riskLevel === "high") reason.push("高风险：人物/主体完整性优先于容器填满，最终渲染不得改回 cover");
  if (riskLevel === "medium") reason.push("中风险：允许裁切，但须按 focalPoint / safeCropBox 调整 object-position");
  return {
    src: src, mode: mode, riskLevel: riskLevel, allowCrop: allowCrop,
    focalPoint: focalPoint, subjectBoxes: subjectBoxes, protectedSubjects: subjects,
    safeCropBox: safeCropBox, reason: reason, realAspect: realAspect
  };
}

/* P0-B：目标裁剪区域能否完整包含主体 bbox？不能 → 禁止裁切（文档 §七）。 */
function cropFitsSubjects(policy, containerAspect) {
  if (!policy) return true;
  if (!policy.allowCrop) return false;
  if (!policy.realAspect || !containerAspect) return true;
  const boxes = policy.subjectBoxes || [];
  if (!boxes.length) return true;
  const pr = policy.realAspect, ca = containerAspect;
  // cover 裁切后被保留的画面比例窗口（居中对齐时）
  const keepW = (pr / ca >= 1) ? (ca / pr) : 1;
  const keepH = (pr / ca >= 1) ? 1 : (pr / ca);
  const x0 = 0.5 - keepW / 2, y0 = 0.5 - keepH / 2;
  return boxes.every(function (b) {
    const bx = (b && b.bbox) ? b.bbox : b;
    if (!bx) return true;
    const x = +bx.x || 0, y = +bx.y || 0, w = +bx.width || 0, h = +bx.height || 0;
    return (x >= x0 - 0.002) && (y >= y0 - 0.002) && (x + w <= x0 + keepW + 0.002) && (y + h <= y0 + keepH + 0.002);
  });
}
/* medium → safe_cover：按 focalPoint / safeCropBox 计算 object-position（把主体留在可见区） */
function safePosOf(policy) {
  if (!policy) return "50% 45%";
  const box = policy.safeCropBox;
  if (box && typeof box === "object" && box.x != null && box.width != null) {
    const cx = (+box.x + (+box.width) / 2), cy = (+box.y + (+box.height) / 2);
    return Math.max(0, Math.min(100, Math.round(cx * 100))) + "% " + Math.max(0, Math.min(100, Math.round(cy * 100))) + "%";
  }
  const f = policy.focalPoint || { x: 0.5, y: 0.45 };
  const cl = function (v) { return Math.max(0, Math.min(100, Math.round((+v || 0) * 100))); };
  return cl(f.x) + "% " + cl(f.y) + "%";
}
/* P0-B：渲染层唯一入口 —— 所有 <img> 的 object-fit / object-position 都应由它决定，
   以保证「安全层判不裁」不会被渲染层因为容器比例擅自改回 cover。 */
function cropRenderOf(src) {
  const policy = cropPolicyOf(src);
  let contain = (typeof pagePhotoContain === "function") ? pagePhotoContain(src) : false;
  if (policy.riskLevel === "high") contain = true; // ★ 最高优先级，任何情况不得翻回 cover
  const mode = contain ? "aspect_preserved" : (policy.mode === "safe_cover" ? "safe_cover" : "cover");
  const pos = (mode === "safe_cover") ? safePosOf(policy) : ((typeof smartPos === "function") ? smartPos(src) : "50% 45%");
  return { policy: policy, contain: contain, mode: mode, pos: pos, risk: policy.riskLevel, style: "object-position:" + pos + ";object-fit:" + (contain ? "contain" : "cover") };
}
/* P0-B：渲染结果审计 —— 找出「高风险图却被 cover 渲染」的违规（供验收与自查） */
function cropRenderViolations(html) {
  const out = [];
  const re = /data-crop-risk="high"[^>]*|data-crop-mode="(cover|safe_cover)"[^>]*/g;
  const tagRe = /<(figure|div)[^>]*data-crop-mode="(cover|safe_cover)"[^>]*data-crop-risk="high"[^>]*>/g;
  let m;
  while ((m = tagRe.exec(String(html || "")))) out.push(m[0].slice(0, 120));
  const tagRe2 = /<(figure|div)[^>]*data-crop-risk="high"[^>]*data-crop-mode="(cover|safe_cover)"[^>]*>/g;
  while ((m = tagRe2.exec(String(html || "")))) out.push(m[0].slice(0, 120));
  return out;
}
/* P0-D：Fallback 定位 = 「AI 不可用时，生成一份朴素但 100% 安全的信息内容」。
   优先级：准确 > 完整 > 可读 > 漂亮 > 营销感。 */
/* P0-D：下一期信息受控 —— 没有已确认的下一场活动时，不得预告「下一期正在安排 / 群里接龙占位」。 */
function nextActivityOf(a) {
  const list = (typeof state !== "undefined" && state && state.activities) || [];
  const id = a && a.id;
  const cands = list.filter(function (x) {
    if (!x || x.id === id) return false;
    return x.status !== "ended";
  });
  return cands[0] || null;
}
/* P0-D：未确认实际参与情况时，不得默认「感谢每一位到场的朋友」 */
function recapParticipationConfirmed(a) {
  const d = (a && a.actualActivityData) || null;
  if (!d) return false;
  if (+(d.actualParticipants) > 0) return true;
  if (Array.isArray(d.participants) && d.participants.length) return true;
  if (d.attendanceConfirmed === true) return true;
  return false;
}
function recapThanksLine(a) {
  return recapParticipationConfirmed(a)
    ? "谢谢这次一起出发的朋友。"
    : "本次活动已经结束，以下为本次活动的现场记录。";
}

/* ---------- 事实护栏：creativeContext 只给表达方向，禁止写成现场事实 ---------- */
// 下列为「具体景观/天气/事件」词。除非资料或图片确认，否则不得出现在 creativeContext / consumerValue。
// 活动类型推断(kind)是「内容方向分类」，绝不是现场事实——不得暗示任何具体景观/天气/事件。
const SCENE_CLAIM_KEYWORDS = ["星空","星河","星轨","银河","云海","云瀑","佛光","日出","日落","晚霞",
  "篝火","营火","溪流","溪水","瀑布","花海","红叶","雪景","雪线","草甸","林间","山顶","森林","峡谷","溶洞","海浪","潮水","礁石","云影","晨雾"];
function stripSceneClaims(s) {
  if (!s || typeof s !== "string") return s;
  let out = s;
  for (const k of SCENE_CLAIM_KEYWORDS) {
    if (out.indexOf(k) >= 0) out = out.replace(new RegExp("的?" + k + "(下|里|边|上|中|旁|间)?", "g"), "");
  }
  return out;
}
function hasSceneClaim(s) {
  if (!s || typeof s !== "string") return false;
  return SCENE_CLAIM_KEYWORDS.some((k) => s.indexOf(k) >= 0);
}
// 递归清洗 creativeContext / consumerValue 的全部字符串字段，确保不含现场事实断言（防御式）
function sanitizeCreativeContext(cc) {
  let stripped = false;
  function walk(v) {
    if (typeof v === "string") { const c = stripSceneClaims(v); if (c !== v) stripped = true; return c; }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k]); return o; }
    return v;
  }
  return { value: walk(cc), stripped: stripped };
}

/* ---------- Content Master（确认事实层 + 实际活动数据） ---------- */
function extractConfirmedFacts(a, photos) {
  return {
    activityName: a.title || "", activityType: a.type || "", place: a.place || "",
    date: a.dateMD || a.date || "", season: publishSeason(a),
    price: a.price != null ? a.price : "", limit: a.limit || "", limitUnit: a.limitUnit || "人",
    days: a.days || 1, ageRange: a.ageRange || "", audience: (a.audience || []).join("/"),
    distance: a.distance || "", elevation: a.elevation || "", difficulty: a.difficulty || "",
    meeting: a.meeting || "", meetTime: a.meetTime || "", returnTime: a.returnTime || "",
    includedServices: a.feeInclude || [], gear: (a.gear || []).map((g) => (g.name || g)),
    transport: a.transport || "", meal: a.meal || "", insurance: a.insurance || "",
    leader: a.leaderName ? (a.leaderName + (a.leaderYears ? "（" + a.leaderYears + "）" : "")) : "",
    itinerary: a.itineraryDays || [],
    photosCount: (photos || []).length,
  };
}
/* P0-5 / P0-6 / P0-17 实际活动数据：与原计划事实严格分离；只采用用户在「补充资料 / actualActivityData」中确认的信息。
   报名人数(registeredParticipants) ≠ 实际参加人数(actualParticipants)——两者是独立字段，未明确提供实际人数时保持 null，回顾不得写「XX 人参加」。
   P0-17：actualActivityData 为独立对象（活动上持久存储），优先取结构化字段；仅当结构化字段为空时才从 notes 文本解析兜底。 */
function extractActualActivityData(a, notes) {
  const stored = (a && a.actualActivityData) || {};
  // 报名人数：优先用结构化 actualActivityData.registeredParticipants，否则回退原计划 signups/departures
  const registered = (stored.registeredParticipants != null && stored.registeredParticipants !== "")
    ? +stored.registeredParticipants
    : (a.signups || (a.departures ? a.departures.reduce((s, d) => s + (d.sign || 0), 0) : 0) || null);
  const txt = (notes || "").trim();
  // 实际参与人数：优先用结构化 actualActivityData.actualParticipants（独立确认），否则从补充资料文本解析兜底
  let actual = (stored.actualParticipants != null && stored.actualParticipants !== "") ? +stored.actualParticipants : null;
  if (actual == null) {
    const mActual = txt.match(/(?:实际|到场|实到|共|参加)[^。；\n]{0,10}?(\d+)\s*(?:人|位|名)/);
    if (mActual) actual = +mActual[1];
  }
  const arr = (x) => (Array.isArray(x) ? x.filter(Boolean).map(String) : (x ? String(x).split(/[；;\n]/).map((s) => s.trim()).filter(Boolean) : []));
  const str = (x) => (x == null ? "" : (Array.isArray(x) ? x.filter(Boolean).join("；") : String(x)));
  return {
    registeredParticipants: registered,
    actualParticipants: actual,
    actualWeather: str(stored.actualWeather) || "",
    actualHighlights: arr(stored.actualHighlights),
    actualFeedback: arr(stored.actualFeedback),
    memorableMoments: arr(stored.memorableMoments),
    completionSummary: str(stored.completionSummary) || "",
    actualRouteChange: str(stored.actualRouteChange) || "",
    providedNotes: txt, // 用户在「补充资料」里填写的真实信息，是唯一可用的实际事件来源
  };
}
function buildContentMaster(a, photos) {
  const f = extractConfirmedFacts(a, photos);
  const p = typeProfile(a);
  const cv = {
    scenicValue: p.scenic, experienceValue: p.experience, participationValue: p.participation,
    targetUser: targetUser(a), mainConcern: concern(a), mainSellingPoint: p.themeA,
  };
  const cs = { mainTheme: p.themeA, secondaryTheme: "", mainSellingPoint: p.themeA, audienceInsight: cv.targetUser, tone: p.tone };
  // P0-14 事实边界：
  //   confirmedFacts = 唯一事实源（只来自用户资料/照片，绝不从活动类型推断出现场景观）
  //   creativeContext = 只给表达方向；活动类型推断(inferredContentKind)是「内容方向分类」，assertsScenes=false，绝不暗示具体景观/天气/事件
  //   consumerValue = 抽象消费价值
  const ccRaw = {
    tone: p.tone,
    inferredContentKind: p.kind,   // 类型推断：仅内容方向分类，不是现场事实
    assertsScenes: false,
    isInference: true,
    angles: [cs.mainTheme].filter(Boolean),
    visualMoodHint: "视觉情绪由照片画像与编辑方向决定，不得凭空指定具体景观或天气",
  };
  const cc = sanitizeCreativeContext(ccRaw).value;
  const cvSan = sanitizeCreativeContext({ scenicValue: cv.scenicValue, experienceValue: cv.experienceValue, participationValue: cv.participationValue }).value;
  return {
    contentType: "recruitment", confirmedFacts: f, actualActivityData: null,
    creativeContext: cc,
    consumerValue: { scenicValue: cvSan.scenicValue, experienceValue: cvSan.experienceValue, participationValue: cvSan.participationValue },
    targetAudience: cv.targetUser, mainTheme: cs.mainTheme, mainSellingPoint: cs.mainSellingPoint,
    scenicValue: cvSan.scenicValue, experienceValue: cvSan.experienceValue, participationValue: cvSan.participationValue,
    tone: cs.tone, keyImages: autoClassifyPhotos([...(photos || []), ...(a.photos || [])].filter((x, i, arr) => x && arr.indexOf(x) === i)), cta: ctaText(a),
  };
}

/* ---------- 照片分析（Photo Analysis） ---------- */
function photoCategory(src, i) {
  const meta = (typeof photoMeta === "function") ? photoMeta(src) : null;
  if (meta && meta.category) return meta.category;
  const order = ["cover", "scenic", "people", "action", "team", "gear", "meal", "camp", "route", "water", "detail"];
  return order[i % order.length];
}
function autoClassifyPhotos(photos) {
  return (photos || []).map((src, i) => ({ src: src, cat: photoCategory(src, i), i: i }));
}
function matchPhoto(m, prefer, idx) {
  const list = m.keyImages || [];
  if (!list.length) return null;
  const want = {
    cover: ["cover"], scenic: ["scenic", "route", "water", "camp", "detail", "cover"],
    experience: ["action", "people", "team", "scenic"], people: ["people", "team", "cover"],
  }[prefer] || [prefer];
  let f = list.find((p) => want.includes(p.cat));
  if (f) return f;
  return list[idx % list.length] || list[0];
}
/* 同步版照片画像（供家族权重选择等同步逻辑使用；AI 细分析版见 photoProfile） */
function photoProfileBase(a, photos) {
  const list = autoClassifyPhotos(photos || []);
  const byCat = {};
  list.forEach((p) => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  const has = (c) => (byCat[c] || []).length > 0;
  const peopleN = (byCat.people || []).length + (byCat.team || []).length;
  const scenicN = (byCat.scenic || []).length + (byCat.route || []).length + (byCat.water || []).length + (byCat.camp || []).length;
  return {
    count: list.length,
    cats: Object.keys(byCat),
    cover: (byCat.cover && byCat.cover[0]) || list[0] || null,
    hasScenic: has("scenic") || has("route") || has("water") || has("camp"),
    hasPeople: has("people") || has("team"),
    hasAction: has("action"),
    hasDetail: has("detail") || has("gear"),
    scenicCount: scenicN,
    landscapeRatio: list.length ? +(scenicN / list.length).toFixed(2) : 0,
    peopleRatio: list.length ? +(peopleN / list.length).toFixed(2) : 0,
    sceneTypes: byCat.scenic ? ["自然风光"] : (byCat.water ? ["水上"] : (byCat.camp ? ["营地"] : [])),
    peopleCount: peopleN,
    crowdLevel: peopleN >= 3 ? "多人" : (peopleN >= 1 ? "小队" : "未出现人物"),
    actionTypes: byCat.action ? ["动态瞬间"] : [],
    mood: (byCat.scenic && byCat.scenic.length >= 3) ? "风景主导" : (has("people") ? "人物主导" : "综合"),
    emotion: has("people") ? "有陪伴感" : "宁静",
    note: list.length === 0 ? "未上传照片，建议补充 3-6 张活动照以增强排版" : "",
  };
}
/* Case 1/2（照片信号 → 内容方向）：photoContentProfile(photos)
   从「内容识别信号」汇总色调与主体构成（同步 / 纯函数 / 只读内容，不读上传顺序）。
   与 photoProfileBase 的区别：base 只按分类计数，这里带真实色调（warm/blue）与人物、竖图占比，
   供「暖感排版」「人物主导」这类照片驱动决策使用（§六 Case 1 / Case 2）。 */
let _photoContentMemo = { key: "", val: null };
function photoContentProfile(photos) {
  const list = (photos || []).filter(Boolean);
  const key = list.join("|");
  if (_photoContentMemo.key === key && _photoContentMemo.val) return _photoContentMemo.val;
  const out = {
    count: 0, peopleRatio: 0, groupRatio: 0, portraitRatio: 0, landscapeRatio: 0,
    actionRatio: 0, nightRatio: 0, warmthRatio: 0, coolRatio: 0, warmthLabel: "未判定",
  };
  try {
    const an = analyzePhotos(list);
    const used = (selectPhotos(an).used || []);
    if (used.length) {
      const n = used.length;
      const ratio = (fn) => Number((used.filter(fn).length / n).toFixed(2));
      const avg = (k) => Number((used.reduce((s, p) => s + (p[k] || 0), 0) / n).toFixed(2));
      out.count = n;
      out.peopleRatio = ratio((p) => (p.people || 0) > 0);
      out.groupRatio = ratio((p) => (p.people || 0) > 1);
      out.portraitRatio = ratio((p) => p.orientation === "portrait");
      out.landscapeRatio = ratio((p) => p.orientation === "landscape");
      out.actionRatio = ratio((p) => !!p.action);
      out.nightRatio = ratio((p) => p.scene === "night");
      out.warmthRatio = avg("warm");
      out.coolRatio = avg("blue");
      // 暖调判定：暖占比达标且明显高于冷占比；冷调同理；两者都不达标 → 中性（不硬套暖感）
      out.warmthLabel = (out.warmthRatio >= 0.42 && out.warmthRatio - out.coolRatio >= 0.12) ? "暖调"
        : ((out.coolRatio >= 0.34 && out.coolRatio - out.warmthRatio >= 0.14) ? "冷调" : "中性");
    }
  } catch (e) { /* 保持默认「未判定」，照片层异常绝不影响方向生成 */ }
  _photoContentMemo = { key: key, val: out };
  return out;
}
/* Case 2：主体主导判定 —— 让内容方向真正由照片决定（人物主导 / 风景主导 / 均衡）。
   两种口径合并：分类口径(photoProfileBase.peopleRatio) 与 信号口径(signalPeopleRatio) 取高者。 */
function photoDominance(pp) {
  const p = pp || {};
  const pr = Math.max(p.peopleRatio || 0, p.signalPeopleRatio || 0);
  const lr = Math.max(p.landscapeRatio || 0, p.usedLandscapeRatio || 0);
  const mood = p.mood || p.aiMood || "";
  const peopleLed = (mood === "人物主导") || pr >= 0.5;
  const sceneLed = !peopleLed && ((mood === "风景主导") || (lr >= 0.6 && pr < 0.35));
  return {
    peopleLed: peopleLed, sceneLed: sceneLed,
    groupLed: Math.max(p.groupRatio || 0, p.signalGroupRatio || 0) >= 0.4,
    portraitLed: (p.usedPortraitRatio || 0) >= 0.5,
    peopleRatio: pr, landscapeRatio: lr,
    warmthLabel: p.warmthLabel || "未判定", warmthRatio: p.warmthRatio || 0, mood: mood,
  };
}
async function photoProfile(a, photos, scenario) {
  const base = photoProfileBase(a, photos);
  // Case 1/2：并入「内容识别」层的色调与主体构成信号（与分类口径分开命名，互不覆盖），
  //   使 heuristicDirection 能按照片做方向/结构决策（暖调排版、人物主导）。
  const cp = photoContentProfile(photos);
  base.signalPeopleRatio = cp.peopleRatio;
  base.signalGroupRatio = cp.groupRatio;
  base.usedLandscapeRatio = cp.landscapeRatio;
  base.usedPortraitRatio = cp.portraitRatio;
  base.actionRatio = cp.actionRatio;
  base.warmthRatio = cp.warmthRatio;
  base.coolRatio = cp.coolRatio;
  base.warmthLabel = cp.warmthLabel;
  // 有 Key：调用 AI 做更细的照片理解（场景/情绪/人物/动作），回退到启发式
  if (aiAuthMode()) {
    try {
      const pp = await llmCall(`你是户外照片分析助手。基于照片分类与活动信息，产出照片画像 JSON：{dominantScene(字符串), mood(风景主导/人物主导/综合), peopleCount(数字), crowdLevel(独行/小队/多人), actionTypes:[], emotion(宁静/活力/陪伴感/治愈), bestCoverCat(分类名), suggestion(一句话排版建议)}。禁止虚构照片内容，只能基于已给分类推断。`,
        `活动：${a.title || ""} 类型：${a.type || ""}\n照片分类：${JSON.stringify(base.cats)} 数量：${base.count}`, true);
      if (pp && pp.mood) {
        Object.assign(base, {
          aiMood: pp.mood, dominantScene: pp.dominantScene || base.sceneTypes.join(""),
          peopleCount: pp.peopleCount != null ? pp.peopleCount : base.peopleCount,
          crowdLevel: pp.crowdLevel || base.crowdLevel,
          actionTypes: pp.actionTypes || base.actionTypes,
          emotion: pp.emotion || base.emotion,
          bestCoverCat: pp.bestCoverCat || "", suggestion: pp.suggestion || "",
        });
      }
    } catch (e) { /* 回退启发式 base */ }
  }
  return base;
}

/* ---------- AI 增强（可选） ---------- */
async function llmCall(system, user, json) {
  if (!aiAuthMode()) return null;
  try {
    return await clubLLM({ system: system, user: user, json: !!json, temperature: 0.7 });
  } catch (e) { return null; }
}

/* ---------- §34 图注 AI 化：基于可见分类 + 已确认事实生成描述性图注（非分类标签） ---------- */
function photoCaption(ph, def) {
  if (!ph) return def || "";
  return ph.cap || ph.cat || def || "";
}
/* 无 Key 兜底：分类标签 + 已确认事实，产出描述性短句（不虚构照片内容） */
function photoCaptionFallback(ph, facts, dir) {
  const cat = (ph && ph.cat) || "";
  const place = (facts && facts.place) ? facts.place : "";
  const season = (facts && facts.season) ? facts.season : "";
  const labelMap = {
    cover: "封面大图", scenic: "山野风景", people: "同行伙伴", action: "行进瞬间",
    team: "团队合影", gear: "装备细节", meal: "餐食补给", camp: "营地一隅",
    route: "路线地貌", water: "亲水时刻", detail: "现场细节",
  };
  let cap = labelMap[cat] || "现场记录";
  if (place) cap += " · " + place;
  if (season) cap += " " + season;
  return cap;
}
/* 挂载 AI 描述性图注到 keyImages（保 src/cat，补充 cap）；无 Key 走兜底 */
async function attachPhotoCaptions(photos, facts, dir) {
  if (!photos || !photos.length) return photos || [];
  if (!aiAuthMode()) {
    return photos.map((p) => Object.assign({}, p, { cap: photoCaptionFallback(p, facts, dir) }));
  }
  try {
    const cats = photos.map((p, i) => ({ i: i, cat: p.cat || "" }));
    const sys = `你是户外照片图注写作助手。为每张照片写一句描述性图注（≤16字），基于"照片分类 + 已确认活动事实"，描述照片可见内容；禁止虚构照片里看不到的东西（如天气、未出现的情绪）。返回 JSON 数组，每项 {i:序号, cap:图注}。`;
    const user = `照片分类：${JSON.stringify(cats)}\n活动事实：${JSON.stringify({ place: (facts || {}).place, season: (facts || {}).season, activity: (facts || {}).activityName, type: (facts || {}).type })}\n编辑方向：${JSON.stringify(dir ? { angle: dir.angle, mood: dir.readingMood } : {})}`;
    let res = await llmCall(sys, user, true);
    let arr = null;
    if (Array.isArray(res)) arr = res;
    else if (res && Array.isArray(res.caps)) arr = res.caps;
    if (arr && arr.length) {
      const map = {};
      arr.forEach((r) => { if (r && r.i != null) map[r.i] = r.cap || ""; });
      return photos.map((p, i) => Object.assign({}, p, { cap: (map[i] && ("" + map[i]).trim()) ? ("" + map[i]).trim() : photoCaptionFallback(p, facts, dir) }));
    }
  } catch (e) { /* 回退兜底 */ }
  return photos.map((p) => Object.assign({}, p, { cap: photoCaptionFallback(p, facts, dir) }));
}

/* §31 小红书 schema 归一：兼容旧字段 cover/tags/imgOrder → 新字段 coverText/hashtags/imageOrder */
function normalizeXhs(x) {
  if (!x) return x;
  const coverText = (x.coverText != null && x.coverText !== "") ? x.coverText : (x.cover || "");
  const hashtags = (Array.isArray(x.hashtags) && x.hashtags.length) ? x.hashtags : (Array.isArray(x.tags) ? x.tags : []);
  const imageOrder = (Array.isArray(x.imageOrder) && x.imageOrder.length) ? x.imageOrder : (Array.isArray(x.imgOrder) ? x.imgOrder : []);
  return { titles: x.titles || [], body: x.body || "", coverText: coverText, hashtags: hashtags, imageOrder: imageOrder };
}

/* ---------- styleSeed + 加权随机（Rule-based Weighted Randomization） ---------- */
function styleSeed() {
  const xf = publishState();
  if (!xf.styleSeed) xf.styleSeed = Math.floor((Date.now() % 1000000) + Math.random() * 1000);
  return xf.styleSeed;
}
function rand(seed) {
  let x = Math.sin(seed * 999.137) * 10000;
  return x - Math.floor(x);
}
function weightedPick(keys, weight, seed) {
  let total = 0; keys.forEach((k) => { total += Math.max(0.01, weight[k] || 1); });
  let r = rand(seed) * total;
  for (const k of keys) {
    r -= Math.max(0.01, weight[k] || 1);
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}
/* ---------- P2-3：最近风格去重（家族 / 变体 / 配色 / 构图 多维避让） ----------
   目标：连续多次生成时，最近几版的「家族 + 变体 + 配色 + 构图」不要过于相似。
   实现：
     ① pickFamily：最近 1-3 次用过的家族按衰减权重降权（最近一次降最狠）；
     ② pickVariant：避开最近几次用过的「变体序号」（跨家族，因 variant 0/1/2 = 版式结构）；
     ③ heuristicDirection：避开最近用过的配色 / 构图。
   _styleHistory 每条记录完整视觉签名 {family, variant, color, composition, whitespace}，
   由 styleSignature() 在每次生成 / 换风格 / 换版式 / 快捷预设后统一写出。 */
const XF_COLOR_PALETTE = ["墨绿", "暖米", "夜空蓝", "山系橙", "松石"];
const XF_COMPOSITION_PALETTE = ["左右交替", "卡片流", "数据条+区块", "大图主导", "手账步骤", "网格画廊"];
function styleSignature(xf) {
  const dir = (xf && xf.strategy && xf.strategy.editorialDirection) || {};
  const vis = dir.visual || {};
  return {
    family: xf.family,
    variant: xf.variant,
    color: vis.color || "",
    composition: vis.composition || "",
    whitespace: (dir.whitespace || "") + "",
  };
}
function recentHistory(n) {
  const hist = (state.xf && state.xf._styleHistory) || [];
  return hist.slice(-(n || 3));
}
/* 最近 2 次用过的配色 → 选一个近期没出现过的备选色（仅启发式路径生效，AI 路径由模型自定） */
function avoidRecentColor(defaultColor, fam) {
  const recent = recentHistory(2).map((h) => h.color).filter(Boolean);
  if (recent.indexOf(defaultColor) < 0) return defaultColor;
  const alt = XF_COLOR_PALETTE.filter((c) => c !== defaultColor && recent.indexOf(c) < 0);
  if (alt.length) return alt[Math.floor(styleSeed() * alt.length) % alt.length];
  return defaultColor;
}
/* 最近 2 次用过的构图 → 选一个近期没出现过的备选构图 */
function avoidRecentComposition(defaultComp) {
  const recent = recentHistory(2).map((h) => h.composition).filter(Boolean);
  if (recent.indexOf(defaultComp) < 0) return defaultComp;
  const alt = XF_COMPOSITION_PALETTE.filter((c) => c !== defaultComp && recent.indexOf(c) < 0);
  if (alt.length) return alt[Math.floor(styleSeed() * alt.length) % alt.length];
  return defaultComp;
}
function pickFamily(a, photos, scenario) {
  const allowed = Object.keys(XF_FAMILIES).filter((f) => XF_FAMILIES[f].scenario.includes(scenario));
  const t = (a.type || "") + (a.title || "");
  const weight = {}; allowed.forEach((f) => { weight[f] = 1; });
  // 活动类型只作为「弱先验」，不再单独决定最终视觉
  if (scenario === "recruit") {
    if (/亲子|研学|自然|儿童/.test(t)) { weight.visual_campaign += 2; weight.route_editorial += 1; }
    if (/摄影|风光|秋色|红叶|花海/.test(t)) { weight.route_editorial += 1; weight.visual_campaign += 1; }
    if (/漂流|溯溪|水上|派对|音乐|露营/.test(t)) { weight.visual_campaign += 2; weight.route_editorial += 1; }
    if (/登山|雪山|越野|高海拔|攀岩/.test(t)) { weight.challenge_editorial += 2; weight.route_editorial += 1; }
  } else {
    if (/亲子|研学|自然|儿童/.test(t)) { weight.photo_documentary += 2; weight.brand_journal += 1; }
    if (/摄影|风光|秋色|红叶|花海/.test(t)) { weight.outdoor_lookbook += 1; weight.photo_documentary += 1; }
    if (/漂流|溯溪|水上|派对|音乐|露营/.test(t)) { weight.brand_journal += 2; weight.photo_documentary += 1; }
    if (/登山|雪山|越野|高海拔|攀岩/.test(t)) { weight.outdoor_lookbook += 1; weight.brand_journal += 1; }
    weight.brand_journal += 1; // 回顾默认偏品牌手记
  }
  // P0-1 照片真正参与家族权重：风景多→风景/画册，人物多→人物纪实，动作多→挑战/画册
  const pp = photoProfileBase(a, photos);
  if (pp && pp.count > 0) {
    const lr = pp.landscapeRatio || 0, pr = pp.peopleRatio || 0;
    const hasAction = /动态/.test((pp.actionTypes || []).join(""));
    if (scenario === "recruit") {
      if (lr >= 0.6 && pr < 0.3) { weight.route_editorial += 4; weight.visual_campaign += 1; }
      if (pr >= 0.5) { weight.visual_campaign += 4; weight.route_editorial += 1; }
      if (hasAction) weight.challenge_editorial += 2;
      if (hasAction && /登山|雪山|越野|高海拔|攀岩/.test(t)) weight.challenge_editorial += 2;
      if (lr >= 0.6 && pp.count >= 15) weight.route_editorial += 1;
    } else {
      if (pr >= 0.55) weight.photo_documentary += 4;
      if (pr >= 0.35) weight.photo_documentary += 2;
      if (lr >= 0.6) weight.outdoor_lookbook += 4;
      if (hasAction) { weight.outdoor_lookbook += 1; weight.photo_documentary += 1; }
      if (lr >= 0.6 && pp.count >= 15) weight.outdoor_lookbook += 2;
      if (pp.hasDetail && lr < 0.5 && pr < 0.4) weight.brand_journal += 2;
    }
  }
  // P0-2 Activity DNA 参与家族权重：把「季节/场景/动机/人群」从原始活动类型里解耦出来
  const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a, photos) : null;
  if (dna) {
    if (scenario === "recruit") {
      if (dna.visualPotential === "high") weight.route_editorial += 2;
      if (dna.coreMotivation === "challenge") weight.challenge_editorial += 2;
      if (dna.coreMotivation === "family") weight.visual_campaign += 2;
      if (dna.activityForm === "water" || dna.activityForm === "camp") weight.visual_campaign += 1;
      if (dna.professionalLevel === "technical") weight.challenge_editorial += 1;
    } else {
      if (dna.coreMotivation === "family") weight.photo_documentary += 3;
      if (dna.visualPotential === "high") weight.outdoor_lookbook += 2;
      if (dna.coreMotivation === "challenge") weight.brand_journal += 1;
    }
  }
  // P2-3 风格去重：最近几次生成用过的家族降权，避免连续几版过于相似（最近一次降得最狠）
  const histAll = (state.xf && state.xf._styleHistory) || [];
  const recentFams = histAll.slice(-3).map((h) => h.family).reverse();
  const decay = [0.38, 0.6, 0.82];
  recentFams.forEach((fam, i) => { if (weight[fam] != null) weight[fam] *= (decay[i] || 1); });
  return weightedPick(allowed, weight, styleSeed() * 1.7 + 3);
}
function pickVariant(family, scenario, seed) {
  const n = (XF_FAMILIES[family].variants || [""]).length;
  if (n <= 1) return 0;
  const hist = (state.xf && state.xf._styleHistory) || [];
  let v = Math.floor(rand(seed * 7.13 + 11) * n) % n;
  // P2-3：避开最近几次用过的「变体序号」（跨家族）。variant 0/1/2 对应版式结构（原生/舒展/紧致），
  // 即便换了家族，连续两版用同一种版式结构也会显得太像，因此整体避让。
  const recent = hist.slice(-3).map((h) => h.variant);
  if (recent.indexOf(v) >= 0) {
    let cand = [];
    for (let i = 0; i < n; i++) if (recent.indexOf(i) < 0) cand.push(i);
    if (!cand.length) {
      // 所有 variant 近期都用过了：选「最久未用」的那一个（绝不重复紧邻的上一次）
      const lastSeen = {};
      hist.forEach((h, idx) => { lastSeen[h.variant] = idx; });
      let best = -1, bestPos = Infinity;
      for (let i = 0; i < n; i++) { const pos = (lastSeen[i] != null) ? lastSeen[i] : -1; if (pos < bestPos) { bestPos = pos; best = i; } }
      if (best >= 0) cand = [best];
    }
    if (cand.length) v = cand[Math.floor(rand(seed * 3.7 + 5) * cand.length) % cand.length];
  }
  // 同家族上一次用过的 variant 仍避让
  const last = hist.filter((h) => h.family === family).slice(-1)[0];
  if (last && last.variant === v) v = (v + 1) % n;
  return v;
}

/* ---------- 阶段一：Content Strategy + Photo Analysis + Editorial Direction ---------- */
function heuristicDirection(a, p, family, scenario, photoProfile) {
  // Case 1/2：把「照片画像」纳入方向决策 —— 人物主导 / 暖调 都由照片真实信号驱动；
  //   无信号（如未上传照片、或离线夹具未提供画像）时维持家族默认，绝不错判。
  const ppSafe = photoProfile || {};
  const dom = photoDominance(ppSafe);
  const warmLed = dom.warmthLabel === "暖调";
  const angleMap = {
    route_editorial: "这一程，值得被认真记录", visual_campaign: "这周末，去山里当个本地人",
    challenge_editorial: "我们真的把这座山走完了", brand_journal: "走得慢一点，才看得见山",
    photo_documentary: "这一程的画面，比文字更诚实", outdoor_lookbook: "把这一程，存进相册里",
  };
  const hookMap = {
    route_editorial: "这一程，值得被认真记录", visual_campaign: "谁懂啊这地方",
    challenge_editorial: "登顶那刻，值了", brand_journal: "山一直在，刚好今天有空",
    photo_documentary: "九张图，装下整个周末", outdoor_lookbook: "九张图，装下整个周末",
  };
  const compMap = { route_editorial: "左右交替", visual_campaign: "卡片流", challenge_editorial: "数据条+区块", brand_journal: "大图主导", photo_documentary: "手账步骤", outdoor_lookbook: "网格画廊" };
  const colorMap = { route_editorial: "墨绿", visual_campaign: "暖米", challenge_editorial: "夜空蓝", brand_journal: "山系橙", photo_documentary: "松石", outdoor_lookbook: "暖米" };
  // Case 9：结构随「编辑家族」明显不同（同一活动换风格/家族，事实不变、章节结构变）
  //   每个标题都内嵌 legacy 触发词，确保 sectionBody 路由到正确正文桶。
  const structRecruitByFamily = {
    route_editorial:    ["为什么值得走这条路线", "你会体验什么", "走完能收获什么", "适不适合你", "真实信息 & 装备", "怎么报名"],
    visual_campaign:    ["为什么这地方值得去", "现场是什么体验", "最适合谁来玩", "怎么拍都出片", "报名占位"],
    challenge_editorial:["我们想挑战什么", "行程难度 & 装备", "走完能收获什么", "适不适合你", "报名 & 下一程"],
    brand_journal:     ["为什么值得慢下来走", "山里你会体验什么", "走完能收获什么", "适不适合你", "怎么报名"],
    photo_documentary: ["这组照片为什么值得看", "镜头里你体验什么", "拍完能收获什么", "适不适合你来拍", "报名占位"],
    outdoor_lookbook:  ["本季山系穿搭为什么值得看", "出片场景怎么玩", "这些角度最出片", "适不适合你", "报名 & 同款"],
  };
  const structRecapByFamily = {
    route_editorial:    ["开场", "路线核心记忆", "途中体验", "值得记住的瞬间", "你的收获", "照片回顾", "下一期预告"],
    visual_campaign:    ["先放结论", "出片现场", "最爱的几个瞬间", "大家玩嗨了", "照片墙", "下一期"],
    challenge_editorial:["开场", "硬核数据回顾", "登顶时刻", "装备 & 体能复盘", "你的成长", "照片回顾", "下一程"],
    brand_journal:     ["开场", "山里的慢时光", "我们记住的画面", "想说的话", "照片回顾", "下一期见"],
    photo_documentary: ["开场", "九张图的回看", "镜头里的真实", "照片回顾", "下一期预告"],
    outdoor_lookbook:  ["本季回顾", "出片合集", "同款清单", "照片墙", "下一期"],
  };
  // Case 2｜同一活动换「人物图」→ 页面明显转成人物/体验主导。
  //   与 Case 9（换家族结构不同）不冲突：这里是「同一家族内」按照片主体切换结构，
  //   家族差异依旧保留（6 家族各一套人物版结构）。每个标题仍内嵌 legacy 触发词，
  //   确保 sectionBody 路由到正确正文桶，不会产出空段。
  const structRecruitPeople = {
    route_editorial:    ["同行的人为什么值得一起出发", "路上你会体验什么", "这些人把路线走成了故事", "走完能收获什么", "适不适合你", "怎么报名"],
    visual_campaign:    ["这群人为什么值得一起玩", "现场是什么体验", "同行伙伴有多出片", "怎么报名"],
    challenge_editorial:["我们要一起挑战什么", "同行的人会经历什么", "走完能收获什么", "适不适合你", "报名 & 下一程"],
    brand_journal:     ["为什么值得和这些人走一趟", "路上你会体验什么", "同行的人是什么样", "走完能收获什么", "怎么报名"],
    photo_documentary: ["这些面孔为什么值得看", "镜头里的你会体验什么", "拍完能收获什么", "适不适合你来拍", "报名占位"],
    outdoor_lookbook:  ["他们为什么值得一起入镜", "同行穿搭怎么拍", "这些角度最出片", "适不适合你", "报名 & 同款"],
  };
  const structRecapPeople = {
    route_editorial:    ["开场", "同行的人构成核心记忆", "现场体验与互动", "值得记住的瞬间", "我们的收获", "照片回顾", "下一期预告"],
    visual_campaign:    ["先放结论", "人是今天的主角", "最爱的几个瞬间", "大家玩嗨了", "照片墙", "下一期"],
    challenge_editorial:["开场", "一起完成的硬核数据", "同行者的登顶时刻", "装备 & 体能复盘", "我们的成长", "照片回顾", "下一程"],
    brand_journal:     ["开场", "山里同行的人", "我们记住的画面", "想说的话", "照片回顾", "下一期见"],
    photo_documentary: ["开场", "九张图里的面孔", "镜头里的真实", "照片回顾", "下一期预告"],
    outdoor_lookbook:  ["本季回顾", "同行出片合集", "同款清单", "照片墙", "下一期"],
  };
  // Case 2：人物主导时的角度/钩子（换图不换事实，只换表达重心）
  const peopleAngleMap = {
    route_editorial: "这一程，人才是主角", visual_campaign: "这一群人，把周末过成了节日",
    challenge_editorial: "不是山赢了，是我们一起走到了", brand_journal: "同行的人，才是山的注解",
    photo_documentary: "这一程的脸，比风景更值得看", outdoor_lookbook: "并肩的样子，最上镜",
  };
  const peopleHookMap = {
    route_editorial: "这一程，人比风景好看", visual_campaign: "谁懂啊，这群人太会玩了",
    challenge_editorial: "一起走到那一步，值了", brand_journal: "山一直在，人刚好都在",
    photo_documentary: "九张图，全是人", outdoor_lookbook: "九张图，全是并肩的样子",
  };
  const baseRecruit = dom.peopleLed ? structRecruitPeople[family] : structRecruitByFamily[family];
  const baseRecap = dom.peopleLed ? structRecapPeople[family] : structRecapByFamily[family];
  const structRecruit = baseRecruit || structRecruitByFamily[family] || ["为什么值得去", "来了会体验什么", "参加完你能得到什么", "适不适合我", "真实信息", "怎么报名"];
  const structRecap = baseRecap || structRecapByFamily[family] || ["开场", "本次活动核心记忆", "本次参与体验", "值得记住的瞬间", "参与者收获", "照片回顾", "下一期预告"];
  // Case 1/2：照片驱动的最终表达（人物主导 > 暖调 > 家族默认）
  const finalAngle = dom.peopleLed ? (peopleAngleMap[family] || angleMap[family] || p.themeA) : (angleMap[family] || p.themeA);
  const finalHook = dom.peopleLed ? (peopleHookMap[family] || hookMap[family] || "周末就该这么过") : (hookMap[family] || "周末就该这么过");
  const finalComp = dom.peopleLed ? "网格画廊" : compMap[family];
  const finalColor = dom.peopleLed ? "暖米" : (warmLed ? "山系橙" : colorMap[family]);
  const finalMood = dom.peopleLed ? "人物主导" : (warmLed ? "暖调" : (ppSafe.mood || ""));
  const finalReadingMood = dom.peopleLed ? "热闹陪伴"
    : (warmLed ? (scenario === "recap" ? "暖调回看" : "暖调向往")
      : (ppSafe.mood || (scenario === "recap" ? "温暖回看" : "松弛向往")));
  return {
    family: family, variant: pickVariant(family, scenario, styleSeed()),
    styleSeed: styleSeed(),
    angle: finalAngle,
    tone: warmLed ? (p.tone ? p.tone + "、暖调" : "暖调") : p.tone,
    voice: scenario === "recap" ? "第一人称、认真回看" : "第一人称、像朋友安利",
    hook: finalHook,
    structure: scenario === "recap" ? structRecap : structRecruit,
    editorialConcept: finalAngle,
    visualFocus: finalComp,
    readingMood: finalReadingMood,
    imagePriority: scenario === "recap" ? "high" : "medium",
    storyStyle: dom.peopleLed ? "人物推进" : (family === "challenge_editorial" ? "纪实推进" : (family === "visual_campaign" ? "种草叙事" : "沉浸叙述")),
    // Case 1/2：方向决策的照片依据（可追踪：为什么这版是人物主导/暖调）
    photoLed: { people: dom.peopleLed, scene: dom.sceneLed, warmth: dom.warmthLabel, peopleRatio: dom.peopleRatio, warmthRatio: dom.warmthRatio },
    informationStyle: family === "challenge_editorial" ? "数据化" : "场景化",
    titleTone: family === "route_editorial" ? "克制" : "亲和",
    ctaStrength: scenario === "recruit" ? "strong" : "soft",
    layoutFamily: family,
    layoutRhythm: { maxSamePatternRepeat: 2, cadence: "alternating" },
    textDensity: "medium",
    whitespace: (family === "brand_journal" || family === "photo_documentary") ? "generous" : (family === "route_editorial" ? "medium" : "generous"),
    imageRatio: scenario === "recap" ? 0.68 : 0.55,
    visual: { mood: finalMood, emotion: ppSafe.emotion, scene: ppSafe.dominantScene || (ppSafe.sceneTypes || []).join(""), color: avoidRecentColor(finalColor, family), composition: avoidRecentComposition(finalComp), coverHint: ppSafe.cover ? "用已上传封面" : "建议补充 1 张大图", typographic: (warmLed || family === "route_editorial") ? "衬线大标题" : "无衬线粗体" },
    copyDirectives: { avoid: ["硬销", "名额仅剩", "最后机会"], must: ["地点真实感", "基于已确认事实"] },
  };
}
async function genStrategy(a, photos, notes, scenario) {
  const facts = extractConfirmedFacts(a, photos);
  const pp = await photoProfile(a, photos, scenario);
  const p = typeProfile(a);
  const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a, photos) : null;
  const family = pickFamily(a, photos, scenario);
  const seed = styleSeed();
  const variant = pickVariant(family, scenario, seed);
  let dir = null;
  if (aiAuthMode()) {
    const sys = `你是 ClubOS 的户外内容主编兼视觉指导。基于"已确认事实"产出一份 Editorial Direction（编辑方向），它将同时驱动文案写作与视觉排版。
原则：允许创造表达，禁止创造事件——只能基于给定事实（活动名称/地点/日期/强度/价格/领队/照片分类等），不得虚构天气、领队行为、用户感受、具体人数、未提供的价格。
返回 JSON：{
  angle: 一句话编辑角度（≤18字，带观点而非硬销），
  tone: 语气关键词,
  voice: 人称与口吻（如"第一人称松弛"）,
  hook: 一个情绪/反差钩子（≤14字）,
  structure: [4-6个章节标题，按消费者决策或回顾逻辑排序],
  visual: { mood, color:"山系橙/墨绿/夜空蓝/暖米/松石", composition:"大图主导/网格/左右交替/卡片流", coverHint, typographic:"衬线大标题/无衬线粗体/手写感" },
  copyDirectives: { avoid:[], must:[] },
  editorialConcept, visualFocus, readingMood, imagePriority: "medium/high", storyStyle, informationStyle, titleTone, ctaStrength: "strong/soft", layoutFamily,
  layoutRhythm: { maxSamePatternRepeat: 2, cadence: "alternating" },
  textDensity: "low/medium/high", whitespace: "low/medium/generous", imageRatio: 数字(招募0.5-0.65 / 回顾0.6-0.75)
}`;
    const user = `场景：${scenario === "recruit" ? "活动招募" : "活动回顾"}
事实：${JSON.stringify(facts)}
照片画像：${JSON.stringify(pp)}
活动类型画像：${JSON.stringify({ kind: p.kind, themeA: p.themeA, tone: p.tone })}
活动基因(Activity DNA)：${JSON.stringify(dna)}
补充资料：${notes || "无"}
指定编辑家族：${family}（${XF_FAMILIES[family].label}），变体序号：${variant}`;
    dir = await llmCall(sys, user, true);
  }
  if (!dir || !dir.angle) dir = heuristicDirection(a, p, family, scenario, pp);
  dir.family = family; dir.variant = variant; dir.styleSeed = seed;
  return {
    contentStrategy: {
      mainTheme: p.themeA, secondaryTheme: dir.angle || p.themeA,
      mainSellingPoint: p.themeA, audienceInsight: targetUser(a),
      tone: p.tone, angle: dir.angle, hook: dir.hook, scenario: scenario,
    },
    activityDNA: dna,
    photoProfile: pp,
    photoIntel: (typeof buildPhotoIntelligence === "function") ? buildPhotoIntelligence(photos, a, (dir.structure || []), scenario) : null,
    editorialDirection: dir,
  };
}

/* ---------- 阶段二：AI 完整文案（六平台，全部由 AI 生成） ---------- */
function sectionBody(h, a, m) {
  // P0-15：Fallback 章节正文只从 confirmedFacts(f) 推导，绝不把类型推断的
  // scenicValue/experienceValue/participationValue 当作现场事实写入。
  const f = m.confirmedFacts;
  const T = h || "";
  if (/信息|详情|报名|费用|时间|地点|怎么报名|出行/.test(T)) {
    const rows = infoRows(a).map((r) => `<b>${r.k}</b> ${r.v}`);
    return `<p>${rows.length ? rows.join("；") + "。" : "活动详情以发布页为准。"}</p>`;
  }
  if (/玩|体验|行程|内容|安排|路线|活动/.test(T)) {
    const parts = [];
    if (f.days > 1) parts.push(f.days + " 天行程");
    if (f.difficulty) parts.push("强度" + f.difficulty);
    if (f.distance) parts.push("全程约 " + f.distance + " 公里");
    if (f.elevation) parts.push("海拔约 " + f.elevation + " 米");
    if (f.itinerary && f.itinerary.length) parts.push("已规划 " + f.itinerary.length + " 段行程");
    if (f.gear && f.gear.length) parts.push("建议自备：" + f.gear.slice(0, 5).join("、"));
    if (f.transport) parts.push("交通：" + f.transport);
    if (f.meal) parts.push("含餐：" + f.meal);
    if (f.includedServices && f.includedServices.length) parts.push("费用含：" + f.includedServices.join("、"));
    // Case 7：资料已填的保险/安全事实，高强度活动页须显性呈现
    if (a && a.insurance) parts.push("保险：" + a.insurance);
    if (a && a.safety && a.safety.length) parts.push("安全：" + a.safety.join("、"));
    return `<p>${parts.length ? parts.join("；") + "。" : "具体玩法与行程以发布页与现场说明为准。"}</p>`;
  }
  if (/适合|谁|门槛|匹配|友好/.test(T)) {
    const parts = [];
    if (f.ageRange) parts.push("适合 " + f.ageRange);
    else if (f.audience) parts.push("面向 " + f.audience);
    if (f.difficulty) parts.push("强度" + f.difficulty + "，报名前请确认与自身情况匹配");
    if (f.leader) parts.push("本场由 " + f.leader + " 带队");
    return `<p>${parts.length ? parts.join("；") + "。" : "具体是否适合你，请结合强度、时间与自身情况判断，或向发布方咨询。"}</p>`;
  }
  if (/值得|为什么|去|亮点|看点/.test(T)) {
    const parts = [];
    if (f.activityType) parts.push("活动类型：" + f.activityType);
    if (f.place) parts.push("地点在" + f.place);
    if (f.photosCount > 0) parts.push("已上传 " + f.photosCount + " 张活动照，可在详情页查看");
    if (f.date) parts.push(f.date + " 出发");
    return `<p>${parts.length ? parts.join("；") + "。" : "活动亮点与实拍见详情页。"}</p>`;
  }
  if (/得到|收获|意义|价值|陪伴|成长/.test(T)) {
    return `<p>报名后可在群里获取集合、时间与行程提醒；活动信息以发布页为准。</p>`;
  }
  if (/预告|下一期|集结/.test(T)) return "更多活动信息可关注机构后续发布。";
  return `<p>${(f.place ? "在" + f.place + "的" : "") + (f.date || "近期") + "这场活动，信息以发布页为准。"}</p>`;
}

function fallbackRecruitCopy(a, m, dir) {
  const f = m.confirmedFacts;
  // P0-15：招募 Fallback 只生成事实安全版本。
  // 仅使用 confirmedFacts(f) 与活动字段；类型推断的 scenicValue/experienceValue/participationValue
  // 仅是「表达方向」，绝不作为事实断言写入正文——避免默认 专业领队/新手友好/路线成熟/轻装即可/风景绝美/安全放心。
  const struct = (dir.structure && dir.structure.length >= 4) ? dir.structure.slice(0, 6) : ["为什么值得去", "来了会体验什么", "参加完你能得到什么", "适不适合我", "真实信息", "怎么报名"];
  const sections = struct.map((h) => ({ h: h, html: sectionBody(h, a, m) }));
  const angle = dir.angle || (f.activityName || "这场活动"); // 表达方向（标题/邀约语气），非事实断言
  const infoData = infoRows(a);
  const feeTxt = f.price != null ? `¥${f.price}/${f.limitUnit || "人"}${f.limit ? `，限 ${f.limit}${f.limitUnit || "人"}` : ""}` : "详询";
  const summary = [f.activityName || "这场活动", (f.place ? "在" + f.place : ""), (f.date || "近期") + "出发"].filter(Boolean).join("，") + "。以下基于已确认的活动信息整理，具体以发布页为准。";
  const xhsInfo = [
    "· 时间：" + (f.date || "近期"),
    "· 地点：" + (f.place || "集合点群内发"),
    (f.price != null ? "· 费用：¥" + f.price + "/" + (f.limitUnit || "人") : "· 费用：详询") + (f.difficulty ? "｜强度" + f.difficulty : ""),
    (f.limit ? "· 名额：" + f.limit + (f.limitUnit || "人") : ""),
    (f.gear && f.gear.length ? "· 装备：" + f.gear.slice(0, 4).join("、") : ""),
    (f.includedServices && f.includedServices.length ? "· 含：" + f.includedServices.join("、") : ""),
  ].filter((s) => s);
  return {
    gzh: {
      title: `${f.activityName || "这场活动"}｜${angle}`,
      subtitle: `${dir.hook ? dir.hook + " · " : ""}${f.place ? "在" + f.place + "的" : ""}${f.season ? f.season : ""}${f.date || "近期"}出发`,
      summary: summary,
      sections: sections,
      info: infoData,
      fee: feeTxt,
      service: (f.includedServices && f.includedServices.length) ? f.includedServices.join("、") : "",
      cta: m.cta,
    },
    xhs: {
      titles: [xhsTitle(a, m, 1, dir), xhsTitle(a, m, 2, dir), xhsTitle(a, m, 3, dir)],
      body: [
        (f.place ? "📍 " + f.place + (publishSeason(a) ? "·" + publishSeason(a) : "") : "📍 地点见发布页"),
        "✅ 活动信息",
        xhsInfo.join("\n"),
        "",
        "信息以发布页为准。" + ctaShortOf(a) + "。" + urgencyTextOf(confirmedCTAOf(a)),
      ].join("\n"),
      coverText: `${f.place || "山里"}·${publishSeason(a) || ""}`,
      hashtags: tags(a),
      imageOrder: ["cover", "scenic", "people", "action", "detail"],
    },
    moments: {
      warm: `${dir.hook ? dir.hook + " " : ""}${f.place ? "在" + f.place + "的" : ""}${f.season || ""}这一场已开放报名，${f.date || ""} 出发。${ctaShortOf(a)}。${urgencyTextOf(confirmedCTAOf(a))}`,
      formal: `【招募】${f.activityName || "本周活动"} · ${f.date || "近期"} 出发\n${summary}\n${ctaShortOf(a)}。${urgencyTextOf(confirmedCTAOf(a))}`,
      last: `【提醒】${f.activityName || "本周活动"} ${f.date || ""} 出发。${urgencyTextOf(confirmedCTAOf(a)) || "活动信息以发布页为准。"}`,
    },
    wechat: {
      recruit: `各位群友好👋 ${f.activityName || "本周活动"} 开始招募啦：\n🗓 时间：${f.date || "近期"}\n📍 地点：${f.place || "集合点群内发"}\n💰 ${f.price != null ? "费用：¥" + f.price + "/" + (f.limitUnit || "人") : "费用详询"}${f.difficulty ? "\n🔥 强度：" + f.difficulty : ""}\n\n${ctaShortOf(a)}。${urgencyTextOf(confirmedCTAOf(a))}`,
      brief: `【一句话】${f.activityName || "活动"} ${f.date || ""} 出发｜${ctaShortOf(a)}`,
    },
    voice: {
      s30: `大家好，这周末咱们去${f.place || "山里"}，主题是${angle}。${f.price != null ? "费用" + f.price + "一人" : "费用详询"}${f.difficulty ? "，强度" + f.difficulty : ""}。${ctaShortOf(a)}。${urgencyTextOf(confirmedCTAOf(a))}`,
      s60: `大家好，给大伙说个周末的活动。咱们${f.date || "这周末"}去${f.place || "山里"}，这场活动的主题是${angle}。${f.price != null ? "费用" + f.price + "一人" : "费用详询"}${f.includedServices && f.includedServices.length ? "，含" + f.includedServices.join("、") : ""}${f.difficulty ? "，强度" + f.difficulty : ""}。${ctaShortOf(a)}。${urgencyTextOf(confirmedCTAOf(a))}`,
    },
    poster: {
      title: f.activityName || "户外活动",
      sub: angle,
      place: f.place || "",
      points: [
        (f.place ? "地点：" + f.place : "地点见发布页"),
        (f.price != null ? "费用 ¥" + f.price + "/" + (f.limitUnit || "人") : (f.difficulty ? "强度" + f.difficulty : "信息见发布页")),
      ].slice(0, 2),
      time: f.date || "近期",
      price: f.price != null ? "¥" + f.price + " 起/" + (f.limitUnit || "人") : "详询",
      cta: ctaShortOf(a),
    },
  };
}

async function genRecruit(a, m, strategy) {
  const f = m.confirmedFacts;
  const dir = strategy.editorialDirection;
  const p = typeProfile(a);
  const sys = `你是 ClubOS 户外俱乐部的多平台内容写手。严格遵循下面的 Editorial Direction 写作，所有事实只来自 confirmedFacts，禁止虚构天气/领队行为/用户感受/具体人数/未给的价格。
按各平台输出：
- gzh：公众号图文 JSON {title,subtitle,summary,sections:[{h,html}],info:[{k,v}],fee,service,cta}
- xhs：小红书 JSON {titles:[3-5],body,coverText:封面短句,hashtags:[],imageOrder:[]}
- moments：朋友圈三版 {warm,formal,last}
- wechat：微信群 {recruit,brief}
- voice：口播 {s30,s60}
- poster：海报 {title,sub,place,points:[2],time,price,cta}
所有标题/正文/章节标题/摘要/图片说明/CTA 由你创作，不要使用固定模板句式；章节标题参考 Editorial Direction.structure，但可根据事实调整。`;
  const user = `Editorial Direction：${JSON.stringify(dir)}
confirmedFacts：${JSON.stringify(f)}
价值：${m.scenicValue} / ${m.experienceValue} / ${m.participationValue}
受众：${m.targetAudience}`;
  let out = null;
  if (aiAuthMode()) {
    out = await llmCall(sys, user, true);
    if (!out || !out.gzh || !out.gzh.sections || out.gzh.sections.length < 3) {
      out = await llmCall(sys + "\n（上一次返回不完整，请严格返回全部 6 个平台的完整 JSON，gzh.sections 至少 4 段）", user, true);
    }
    out = qualityCheck(out, dir, "recruit", f) || out;
    // 质量检查不达标 → 自动重生成一次（§41）
    if (aiAuthMode() && state.xf && state.xf.quality) {
      if (state.xf.quality.fictionRisk) {
        const retry = await llmCall(sys + "\n⚠️ 上一版被质量检查判定含虚构表述。请严格只使用 confirmedFacts 中的事实，绝对禁止出现任何天气描写、领队具体行为、用户感受代词（我们/大家纷纷表示）、或任何未提供的数据。", user + "\n请基于已确认事实重新生成，确保零虚构。", true);
        if (retry && retry.gzh && retry.gzh.sections && retry.gzh.sections.length >= 3) {
          const rechk = qualityCheck(retry, dir, "recruit", f);
          if (state.xf.quality && !state.xf.quality.fictionRisk) out = rechk || retry;
        }
      } else if (state.xf.quality.contentRisk) {
        const retry = await llmCall(sys + "\n⚠️ 上一版文案质量分偏低（模板感/空洞词/段落重复/缺报名指引）。请去掉套路化开头与空洞词，确保每段有具体事实，结尾给出清晰报名方式。", user, true);
        if (retry && retry.gzh && retry.gzh.sections && retry.gzh.sections.length >= 3) {
          const rechk = qualityCheck(retry, dir, "recruit", f);
          if (state.xf.quality && !state.xf.quality.contentRisk && !state.xf.quality.fictionRisk) out = rechk || retry;
        }
      }
    }
  }
  if (!out || !out.gzh || !out.gzh.sections) out = fallbackRecruitCopy(a, m, dir);
  out = qualityCheck(out, dir, "recruit", f) || out;
  if (out && out.xhs) out.xhs = normalizeXhs(out.xhs);
  return out;
}

/* ---------- 活动回顾 阶段二 ---------- */
/* P0-4 + P0-16 回顾 Fallback 事实安全化：只输出「原活动事实 + 用户补充事实 + 照片现场记录」，绝不虚构现场事件/感受/故事。
   没有补充资料、只有照片时：回顾只能做「照片现场记录」（描述照片里实际存在的画面），不得写
   「我们完成全程 / 大家玩得尽兴 / 有人说… / 合照那一刻 / 返程车上… / 当天下雨 / 大家互相照顾」等未经 actualActivityData 确认的现场。
   类型推断的 scenicValue/experienceValue/participationValue 一律不得作为回顾正文（那是招募视角，不是回顾事实）。 */
function fallbackRecapCopy(a, m, dir, photos, notes, type, actual) {
  const f = m.confirmedFacts;
  const act = actual || extractActualActivityData(a, notes);
  const notesTxt = (notes || "").trim();
  const struct = (dir.structure && dir.structure.length >= 5) ? dir.structure.slice(0, 7) : ["开场", "本次活动核心记忆", "本次参与体验", "值得记住的瞬间", "参与者收获", "照片回顾", "下一期预告"];
  const sections = struct.map((h) => ({ h: h, html: recapBody(h, a, m, act, notes, type, photos) }));
  const angle = dir.angle || (type + "的一天");
  return {
    gzh: {
      title: `回顾｜${f.activityName || "这场活动"}`,
      summary: `${f.date || "这场活动"}，${f.place ? f.place + "的" : ""}这场活动已结束。以下基于已确认的活动信息${notesTxt ? "与你补充的现场记录" : ""}${photos && photos.length ? `、共 ${photos.length} 张现场照片` : ""}整理。`,
      sections: sections,
      next: nextText(a),
    },
    xhs: {
      titles: [`回顾｜${f.activityName || "这场活动"}`, `${f.place || "山里"}这一趟，记一下`, `${type}的一天`],
      body: `刚结束的${f.activityName || "这场活动"}，记一笔📷\n\n${notesTxt ? "🌟 现场记录\n" + notesTxt + "\n\n" : ""}📍 活动信息\n· 时间：${f.date || "近期"}\n· 地点：${f.place || "—"}\n\n${nextText(a)}`,
      coverText: `活动回顾·${f.place || "山野"}`,
      hashtags: tags(a).concat(["活动回顾"]),
      imageOrder: ["cover", "people", "team", "scenic", "action"],
    },
    moments: `【活动回顾】${f.activityName || "本周活动"}已结束。${notesTxt ? notesTxt : recapThanksLine(a)}${nextText(a)}`,
    wechat: `各位群友，${f.activityName || "本次活动"}已经结束。\n\n${notesTxt ? "现场记录：" + notesTxt + "\n\n" : ""}${recapThanksLine(a)}${nextText(a)}`,
    next: nextText(a),
  };
}
function recapBody(h, a, m, act, notes, type, photos) {
  const f = m.confirmedFacts;
  const notesTxt = (notes || "").trim();
  // 照片现场记录：只描述照片里实际存在的画面，绝不虚构风景/体验/感受/故事
  const photoList = autoClassifyPhotos(photos || []);
  const photoCount = photoList.length;
  const byCat = {};
  photoList.forEach((p) => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  const has = (c) => (byCat[c] || []).length > 0;
  const sceneCats = ["scenic", "route", "water", "camp", "cover", "detail"].filter(has);
  const peopleCats = ["people", "team", "action"].filter(has);
  const photoRecord = photoCount
    ? `现场共 ${photoCount} 张照片${sceneCats.length ? "，记录了山野、路线与出发/到达等画面" : ""}${peopleCats.length ? "，也有同行伙伴与队伍的身影" : ""}。`
    : "";
  if (/开场|集结/.test(h || "")) return `${f.date || "那天"}，${f.place || "集合点"}，这场「${f.activityName || "活动"}」结束了。`;
  if (/核心记忆|风景|画面|景/.test(h || "")) {
    // 只做照片现场记录，不写类型推断的风景判断（scenicValue 属招募视角，非回顾事实）
    if (photoCount) return photoRecord || `以下为本次活动的现场照片。`;
    return notesTxt ? `本次核心记录：${notesTxt}` : `（暂无现场照片，可在「补充资料」填写现场记录后再生成。）`;
  }
  if (/参与体验|强度|节奏/.test(h || "")) {
    const bits = [];
    // P0-17 人数护栏：仅当用户「独立确认」实际参与人数时才写"实际参加 N 人"；报名人数(registeredParticipants) 绝不被视为实际到场，未确认则不写任何参加人数。
    if (act && act.actualParticipants != null && act.actualParticipants !== "") bits.push("实际参加 " + act.actualParticipants + " 人");
    if (f.difficulty) bits.push("强度为 " + f.difficulty);
    if (f.distance) bits.push("路线约 " + f.distance);
    if (act && act.completionSummary) bits.push(act.completionSummary); // 仅用户确认的实际完成情况
    if (bits.length) return bits.join("，") + "。";
    if (photoCount) return `本次以现场照片为准，可看下方影像记录。`;
    return `以下为本次活动的已确认信息。`;
  }
  if (/瞬间|记得|特别/.test(h || "")) return notesTxt ? `这次特别记下：${notesTxt}` : (photoCount ? `现场的照片里留住了当天的若干瞬间。` : "（如需补充现场瞬间，可在「补充资料」里填写。）");
  if (/收获|得到/.test(h || "")) {
    // 不写类型推断的「收获」判断；只有用户确认的实际反馈才呈现
    if (act && act.actualFeedback && act.actualFeedback.length) return `参与者反馈：${act.actualFeedback.join("；")}。`;
    return photoCount ? `本次的收获与体验以现场照片为准。` : `（参与者收获以现场记录为准；如需补充，请在补充资料填写。）`;
  }
  if (/照片|相册|回顾/.test(h || "")) return photoCount ? `以下为本次活动的现场照片（共 ${photoCount} 张）。` : `本次暂未上传现场照片。`;
  if (/预告|下一期|集结/.test(h || "")) return nextText(a);
  // 兜底：只描述照片现场，绝不输出类型推断的体验/价值判断
  return photoCount ? photoRecord : `（本节以现场照片与补充资料为准。）`;
}

async function genRecap(a, m, strategy, photos, notes) {
  const f = m.confirmedFacts;
  const dir = strategy.editorialDirection;
  const type = recapType(a, photos);
  // P0-6 报名人数 ≠ 实际参加人数：仅当用户补充资料明确给出实际人数时才可引用
  const actual = extractActualActivityData(a, notes);
  const peopleLine = actual.actualParticipants
    ? `实际参加 ${actual.actualParticipants} 人（用户已确认，可引用）`
    : `${actual.registeredParticipants ? "报名 " + actual.registeredParticipants + " 人；" : ""}实际参加人数未提供——禁止在正文中写出任何具体参加人数。`;
  const sys = `你是 ClubOS 户外俱乐部内容主笔，写活动回顾。像真正参加过的人认真回看这一天：真实、克制、有完成感。
原则：允许创造表达，禁止创造事件——只基于给定事实与补充资料，不得虚构天气/事件/用户感受/领队行为/具体人数。尤其禁止写「我们完成全程/大家玩得尽兴/有人说…/合照那一刻/返程车上…/当天下雨/大家互相照顾」等未经补充资料确认的现场；只有照片、没有备注时，回顾只能做「照片现场记录」（描述照片里实际存在的画面），绝不能虚构故事或感受。
特别约束：未提供实际参加人数时，正文不得出现任何具体人数；报名人数不能被当作实际参加人数。
按各平台输出：
- gzh：公众号回顾 JSON {title,summary,sections:[{h,html}],next}
- xhs：小红书回顾 JSON {titles:[3],body,coverText:封面短句,hashtags:[],imageOrder:[]}
- moments：朋友圈回顾文案（字符串）
- wechat：微信群感谢文案（字符串）
- next：下一期预告（字符串）
章节标题参考 Editorial Direction.structure，但可按回顾逻辑调整。`;
  const user = `Editorial Direction：${JSON.stringify(dir)}
事实：${JSON.stringify(f)}
回顾类型：${type}
人数：${peopleLine}
补充资料：${notes || "无"}
照片：${photos.length} 张（已分类）`;
  let out = null;
  if (aiAuthMode()) {
    out = await llmCall(sys, user, true);
    if (!out || !out.gzh || !out.gzh.sections || out.gzh.sections.length < 4) {
      out = await llmCall(sys + "\n（请严格返回完整 JSON：gzh.sections 至少 5 段，moments/wechat/next 为字符串）", user, true);
    }
    out = qualityCheck(out, dir, "recap", f, actual) || out;
    // 质量检查不达标 → 自动重生成一次（§41）
    if (aiAuthMode() && state.xf && state.xf.quality) {
      if (state.xf.quality.fictionRisk) {
        const retry = await llmCall(sys + "\n⚠️ 上一版被质量检查判定含虚构表述。请严格只用事实与补充资料，禁止任何天气/事件/用户感受/领队行为描写。", user + "\n请基于事实重新生成，确保零虚构。", true);
        if (retry && retry.gzh && retry.gzh.sections && retry.gzh.sections.length >= 4) {
          const rechk = qualityCheck(retry, dir, "recap", f, actual);
          if (state.xf.quality && !state.xf.quality.fictionRisk) out = rechk || retry;
        }
      } else if (state.xf.quality.contentRisk) {
        const retry = await llmCall(sys + "\n⚠️ 上一版文案质量分偏低（模板感/空洞词/段落重复）。请去掉套路化开头，确保每段基于真实事实，结尾有下一期预告。", user, true);
        if (retry && retry.gzh && retry.gzh.sections && retry.gzh.sections.length >= 4) {
          const rechk = qualityCheck(retry, dir, "recap", f, actual);
          if (state.xf.quality && !state.xf.quality.contentRisk && !state.xf.quality.fictionRisk) out = rechk || retry;
        }
      }
    }
  }
  if (!out || !out.gzh || !out.gzh.sections) out = fallbackRecapCopy(a, m, dir, photos, notes, type, actual);
  // §六 Case 10：回顾只有现场照片（无补充资料、无已确认实际信息）时，先阻断一切无来源的
  //   「现场事件 / 参与者反应」叙述，再走质量检查 —— 从「检测并提示」升级为「直接删除」。
  const fabEvents = stripFabricatedRecapEvents(out, notes, actual);
  if (fabEvents.length && out.gzh && (out.gzh.sections || []).length < 3) {
    // 叙事被清空 → 退回「照片现场记录」安全版（宁少写，不编造）
    out = fallbackRecapCopy(a, m, dir, photos, notes, type, actual);
  }
  // 末次质检必须带上已确认实际信息（此前漏传 actual，会把用户确认过的反馈/人数误判为无依据并删除）
  out = qualityCheck(out, dir, "recap", f, actual) || out;
  if (fabEvents.length && state.xf && state.xf.quality) {
    const q = state.xf.quality;
    q.fabricationGuard = fabEvents;
    q.removed = (q.removed || []).concat(fabEvents).filter((v, i, arr) => arr.indexOf(v) === i);
    if (q.flag === "ok") q.flag = "fabrication_blocked";
    q.note = (q.note || "") + " 已阻断无来源的现场事件叙述（" + fabEvents.join("、") + "）。";
  }
  if (out && out.xhs) out.xhs = normalizeXhs(out.xhs);
  return out;
}

/* ---------- 质量检查（§39 ContentQualityCheck / §40 EditorialQualityCheck） ---------- */
function textOf(out) {
  const parts = [];
  const gzh = out.gzh || {};
  (gzh.sections || []).forEach((s) => { if (s && s.html) parts.push(s.html); });
  if (gzh.title) parts.push(gzh.title);
  if (gzh.summary) parts.push(gzh.summary);
  if (out.xhs && out.xhs.body) parts.push(out.xhs.body);
  if (out.moments) { if (typeof out.moments === "string") parts.push(out.moments); else ["warm", "formal", "last"].forEach((k) => { if (out.moments[k]) parts.push(out.moments[k]); }); }
  if (out.wechat) { if (typeof out.wechat === "string") parts.push(out.wechat); else ["recruit", "brief"].forEach((k) => { if (out.wechat[k]) parts.push(out.wechat[k]); }); }
  return parts.join("\n");
}

/* §39b P0-18 Claim→Fact 执行层：无依据 claim 的删除/重写
   12 类重点校验：领队 / 保险 / 餐食 / 住宿 / 交通 / 天气 / 人数 / 登顶 / 完成路线 / 用户反馈 / 安全保障 / 装备提供
   逻辑：生成文案 → 提取关键 Claim → 对应事实字段检查 → 无依据 → 删除（或按事实安全重写清空）。 */
function claimDetectors(facts, adv) {
  const A = adv || {};
  const f = facts || {};
  const hasList = (x) => (Array.isArray(x) ? x.filter(Boolean).length > 0 : !!x);
  const summitText = [A.completionSummary, (Array.isArray(A.actualHighlights) ? A.actualHighlights.join("") : ""), A.memorableMoments].filter(Boolean).join("");
  // 住宿：已确认 / 费用包含住宿 / 或句子本身是「不含住宿」这类事实陈述 → 视为有依据，不删
  const lodgingOk = (txt) => !!(f.lodging || (f.includedServices || []).some((s) => /住宿|客栈|民宿|房/.test(String(s)))) || /(不含|不提供|无住宿|没有住宿|未含住宿)/.test(txt);
  return [
    { w: "保险", re: /保险|意外险|投保/, ok: !!f.insurance },
    { w: "领队", re: /领队|教练|向导/, ok: !!f.leader },
    { w: "交通", re: /大巴|包车|专车|接送/, ok: !!f.transport },
    { w: "餐食", re: /含餐|午餐|晚餐|早餐|团餐|正餐/, ok: !!f.meal },
    { w: "装备", re: /(提供|配发|免费使用)[^。；\n]{0,6}(装备|登山杖|头盔|救生衣)/, ok: !!(f.gear && f.gear.length) },
    { w: "住宿", re: /住宿|客栈|民宿|入住|标间/, ok: lodgingOk },
    { w: "天气", re: /(万里无云|阳光明媚|晴空万里|下起了雨|突然放晴|阴雨绵绵|艳阳高照|天气很(好|差))/, ok: !!A.actualWeather },
    { w: "实际人数", re: /(\d+)\s*(人|位|名)\s*(参加|到场|实到|出席)|共\s*\d+\s*人|实际参加\s*\d+/, ok: A.actualParticipants != null },
    { w: "登顶", re: /(登顶|到达顶峰|登顶成功|成功登顶|全员登顶|把山踩在脚下|站在山顶)/, ok: /登顶|顶峰|山顶/.test(summitText) },
    { w: "完成路线", re: /(走完|完成)(了)?(全程|整条|整段|路线)|一个不落/, ok: !!A.completionSummary },
    { w: "用户反馈", re: /(有人说|大家(都)?(表示|说)|大家纷纷表示|(队员|学员|家长|参与者)(们)?(都)?(表示|反馈|说|觉得|认为)|不少人(说|表示|觉得)|好评如潮|好评(一片|满满|不断)|赞不绝口|纷纷(点赞|表示|说|反馈|夸|称赞)|大家一致|都说不虚此行|反馈(很好|特别好|超好))/, ok: hasList(A.actualFeedback) },
    { w: "路线成熟度", re: /(路线(很|非常)?成熟|成熟的?(路线|线路)|老少皆宜|男女皆宜|毫无难度|闭眼可走|零门槛)/, ok: !!f.routeMaturity },
    { w: "安全保障", re: /(安全保障|全程保障|安全无忧|安全放心|专业保障|安全措施完善|全程安全|安全保障到位)/, ok: !!(f.safetyMeasures || f.insurance) },
    { w: "风景判断", re: /(风景(绝美|绝佳|美到)|美到窒息|人间仙境|宛如仙境|震撼人心|美得不像话|此生必去)/, ok: false },
  ];
}
function stripTags(s) { return (s || "").replace(/<[^>]+>/g, ""); }
// 按句切分 HTML（保留标签与标点；标点须在标签外），供逐句删除无依据 claim
function splitSentences(html) {
  const out = []; let buf = ""; let inTag = false;
  for (let i = 0; i < (html || "").length; i++) {
    const ch = html[i];
    if (ch === "<") { inTag = true; buf += ch; continue; }
    if (ch === ">") { inTag = false; buf += ch; continue; }
    buf += ch;
    if (!inTag && "。！？；\n".indexOf(ch) >= 0) { out.push(buf); buf = ""; }
  }
  if (buf.trim()) out.push(buf);
  return out;
}
function cleanInner(inner, detectors, removed, seen) {
  const sents = splitSentences(inner);
  const kept = [];
  sents.forEach((s) => {
    const t = stripTags(s).trim();
    if (!t) { kept.push(s); return; }
    const hit = detectors.find((d) => d.re.test(t) && ((typeof d.ok === "function") ? d.ok(t) : d.ok) === false);
    if (hit) { if (!seen[hit.w]) { seen[hit.w] = 1; removed.push(hit.w); } return; }
    kept.push(s);
  });
  return kept.join("");
}
function cleanSectionHtml(html, detectors, removed, seen) {
  return (html || "").replace(/<(p|li|blockquote|h[1-6])([^>]*)>([\s\S]*?)<\/\1>/g,
    (m, tag, attrs, inner) => {
      const cleaned = cleanInner(inner, detectors, removed, seen);
      return cleaned ? `<${tag}${attrs}>${cleaned}</${tag}>` : "";
    });
}
// P0-18 执行层：就地删除/重写无依据 claim，返回被删除的类别清单（去重）
function stripUnsupportedClaims(out, facts, adv) {
  if (!out || !out.gzh) return [];
  const detectors = claimDetectors(facts, adv);
  const removed = []; const seen = {};
  const stripText = (text) => {
    const sents = (text || "").split(/(?<=[。！？；])/);
    const kept = [];
    sents.forEach((s) => {
      const t = s.trim();
      if (!t) { kept.push(s); return; }
      const hit = detectors.find((d) => d.re.test(t) && ((typeof d.ok === "function") ? d.ok(t) : d.ok) === false);
      if (hit) { if (!seen[hit.w]) { seen[hit.w] = 1; removed.push(hit.w); } return; }
      kept.push(s);
    });
    return kept.join("");
  };
  (out.gzh.sections || []).forEach((sec) => { if (sec && sec.html) sec.html = cleanSectionHtml(sec.html, detectors, removed, seen); });
  if (out.gzh.sections) out.gzh.sections = out.gzh.sections.filter((s) => s && s.html && stripTags(s.html).trim().length > 0);
  const origTitle = out.gzh.title;
  if (out.gzh.title) { out.gzh.title = stripText(out.gzh.title); if (!out.gzh.title.trim()) out.gzh.title = origTitle; }
  if (out.gzh.subtitle) out.gzh.subtitle = stripText(out.gzh.subtitle);
  if (out.gzh.summary) out.gzh.summary = stripText(out.gzh.summary);
  if (out.xhs && out.xhs.body) out.xhs.body = out.xhs.body.split("\n").map((l) => stripText(l)).filter((l) => l.trim().length > 0).join("\n");
  if (out.moments) {
    if (typeof out.moments === "string") out.moments = stripText(out.moments);
    else ["warm", "formal", "last"].forEach((k) => { if (out.moments[k]) out.moments[k] = stripText(out.moments[k]); });
  }
  if (out.wechat) {
    if (typeof out.wechat === "string") out.wechat = stripText(out.wechat);
    else ["recruit", "brief"].forEach((k) => { if (out.wechat[k]) out.wechat[k] = stripText(out.wechat[k]); });
  }
  return removed;
}

/* §六 Case 10｜回顾「只有现场照片」时的现场故事闸门 —— 阻断，而非仅检测。
   当回顾没有任何「用户补充资料」与「已确认实际信息」（天气/人数/完成情况/精彩瞬间/反馈/路线变化）时，
   正文只允许做「照片现场记录」：一切具体现场事件叙述与参与者反应断言都必须被删除。
   与 claimDetectors 的分工：claimDetectors 管 12 类「无依据承诺」（保险/领队/人数/天气…），
   这里管「无依据叙事」（大家一起做了什么、现场气氛如何）——这正是 Case 10 的验收点。 */
const RECAP_EVENT_PATTERNS = [
  // ① 主体 + 事件推进：把「队伍/大家/孩子们」写成故事主角
  /(队伍|大家|队友|队员|孩子们?|小朋友们?|家长们?|同学们?)[^。！？；\n]{0,16}(一起|陆续|轮流|互相|纷纷|开始|依次|接着)[^。！？；\n]{0,16}(走|爬|登|玩|唱|笑|聊|分享|热身|合影|拍照|收拾|用餐|干杯|围坐|出发|返程|席地而坐|做起|练起)/,
  // ② 具体现场环节：未经补充资料确认的流程/环节
  /(热身|破冰游戏|破冰环节|自我介绍环节|交换联系方式|围坐|篝火晚会|露天电影|生日蛋糕|才艺展示|拉歌|集体照|合影留念|分发物资|讲解装备)/,
  // ③ 参与者反应 / 现场气氛断言
  /((大家|队员们?|家长们?|孩子们?|小朋友们?)[^。！？；\n]{0,10}(意犹未尽|依依不舍|玩得很|玩得特别|舍不得|流连忘返|念念不忘)|(现场|气氛|氛围)[^。！？；\n]{0,6}(很|特别|格外)(热闹|温馨|欢乐|融洽))/,
];
/* 回顾是否存在「真实来源」：用户补充资料 或 任一已确认实际信息 */
function recapHasActualEvidence(notes, actual) {
  const A = actual || {};
  const txt = ((notes != null && notes !== "") ? notes : (A.providedNotes || "")) + "";
  const has = (x) => (Array.isArray(x) ? x.filter(Boolean).length > 0 : !!x);
  return !!(txt.trim() || has(A.actualWeather) || has(A.actualHighlights) || has(A.memorableMoments)
    || has(A.actualFeedback) || has(A.completionSummary) || has(A.actualRouteChange));
}
/* 返回被阻断的类别清单（去重）；有真实来源时返回空数组（绝不干预有依据的回顾） */
function stripFabricatedRecapEvents(out, notes, actual) {
  if (!out) return [];
  if (recapHasActualEvidence(notes, actual)) return [];
  const removed = [];
  const hitOf = (t) => RECAP_EVENT_PATTERNS.some((re) => re.test(t));
  const drop = (t) => { if (hitOf(t)) { if (removed.indexOf("现场事件") < 0) removed.push("现场事件"); return true; } return false; };
  const cleanHtml = (html) => (html || "").replace(/<(p|li|blockquote|h[1-6])([^>]*)>([\s\S]*?)<\/\1>/g,
    (m, tag, attrs, inner) => {
      const kept = splitSentences(inner).filter((s) => {
        const t = stripTags(s).trim();
        return !t || !drop(t);
      });
      const h = kept.join("");
      return h.trim() ? `<${tag}${attrs}>${h}</${tag}>` : "";
    });
  const stripText = (text) => {
    const kept = String(text || "").split(/(?<=[。！？；])/).filter((s) => {
      const t = stripTags(s).trim();
      return !t || !drop(t);
    });
    return kept.join("");
  };
  (out.gzh && out.gzh.sections || []).forEach((sec) => { if (sec && sec.html) sec.html = cleanHtml(sec.html); });
  if (out.gzh) {
    if (out.gzh.sections) out.gzh.sections = out.gzh.sections.filter((s) => s && s.html && stripTags(s.html).trim().length > 0);
    ["title", "subtitle", "summary", "next"].forEach((k) => { if (out.gzh[k]) out.gzh[k] = stripText(out.gzh[k]); });
  }
  if (out.xhs) {
    if (out.xhs.body) out.xhs.body = out.xhs.body.split("\n").map(stripText).filter((l) => l.trim()).join("\n");
    if (out.xhs.coverText) out.xhs.coverText = stripText(out.xhs.coverText);
    if (Array.isArray(out.xhs.titles)) out.xhs.titles = out.xhs.titles.map(stripText).filter((t) => t.trim());
  }
  if (out.moments) {
    if (typeof out.moments === "string") out.moments = stripText(out.moments);
    else ["warm", "formal", "last"].forEach((k) => { if (out.moments[k]) out.moments[k] = stripText(out.moments[k]); });
  }
  if (out.wechat) {
    if (typeof out.wechat === "string") out.wechat = stripText(out.wechat);
    else ["recruit", "brief"].forEach((k) => { if (out.wechat[k]) out.wechat[k] = stripText(out.wechat[k]); });
  }
  if (out.next) out.next = stripText(out.next);
  return removed;
}

/* §39 ContentQualityCheck：虚构词 / 模板拼接感 / 空洞词 / 重复 / 主题统一 / 图文匹配 / 转化 / 纪实 */
// P2-5：FORBID 词表抽为模块级常量，供 contentQuality 与 pageQuality(事实安全维) 共用，避免两处漂移
const XF_FORBID_WORDS = ["万里无云", "阳光明媚", "下起了雨", "突然放晴", "领队说", "大家纷纷表示", "据说", "据说当时", "不得不说", "说实话", "我们都很", "大家都说", "很多人都说", "风景绝好", "风景绝佳", "新手友好", "新手也能跟上", "不用担心跟不上", "强度友好", "我们登顶了", "把山踩在了脚下", "绝对值得", "必去", "guaranteed", "走完了全程", "走完全程", "把这条线走完了", "玩得超尽兴", "玩得尽兴", "大家玩得尽兴", "我们完成全程", "互相照应", "互相照顾", "大家互相照顾", "有人说来对了", "有人说", "合照那一刻", "返程车上安静下来", "返程车上", "当天下雨"];
function contentQuality(out, dir, scenario, facts, adv) {
  const T = textOf(out);
  const flags = [];
  let score = 100;
  const FORBID = XF_FORBID_WORDS;
  let fiction = 0; FORBID.forEach((w) => { if (T.indexOf(w) >= 0) { fiction++; if (flags.indexOf("fiction:" + w) < 0) flags.push("fiction:" + w); } });
  if (fiction > 0) score -= Math.min(45, fiction * 14);
  // P0-18：统一 12 类 Claim→Fact 硬校验（含新增 登顶 / 安全保障）。
  // 此处仅做「标记 + 降分」；真正的「删除/重写」由 stripUnsupportedClaims 在 qualityCheck 中执行。
  if (facts || adv) {
    const detectors = claimDetectors(facts, adv);
    detectors.forEach((c) => {
      const okv = (typeof c.ok === "function") ? c.ok(T) : c.ok;
      if (c.re.test(T) && !okv) { score -= 8; flags.push("unsupported:" + c.w); }
    });
  }
  const TEMPLATE = ["大家好，", "大家好！", "今天给大家", "一起来看看", "不仅如此", "总而言之", "总的来说", "首先，", "其次，", "最后，"];
  let tpl = 0; TEMPLATE.forEach((w) => { if (T.indexOf(w) >= 0) tpl++; });
  if (tpl >= 3) { flags.push("template"); score -= 10; }
  const HOLLOW = ["说走就走", "治愈", "松弛感", "诗和远方", "岁月静好", "人间值得", "小确幸", "元气满满", "绝绝子"];
  let hollow = 0; HOLLOW.forEach((w) => { if (T.indexOf(w) >= 0) hollow++; });
  if (hollow >= 2) { flags.push("hollow"); score -= 8; }
  const secs = (out.gzh && out.gzh.sections || []).map((s) => (s.html || "").replace(/<[^>]+>/g, ""));
  const seen = {}; let dup = 0;
  secs.forEach((s) => { const key = s.trim().slice(0, 24); if (key.length > 6) { if (seen[key]) dup++; seen[key] = 1; } });
  if (dup > 0) { flags.push("repeat"); score -= 8; }
  const cta = (out.gzh && out.gzh.cta) || (scenario === "recap" && out.gzh && out.gzh.next) || out.next;
  if (!cta) { flags.push("no_cta"); score -= 6; }
  if (scenario === "recap" && fiction > 0) { flags.push("recap_fiction"); score -= 10; }
  return { score: Math.max(0, score), flags: flags, fiction: fiction };
}

/* §40 EditorialQualityCheck：Card Wall / 同结构连续 / 图片占比 / 留白 / 字体层级 / Hero / 招募回顾差异 / 家族匹配 */
function editorialQuality(dir, scenario, family, variant) {
  const flags = [];
  let score = 100;
  const fam = XF_FAMILIES[family];
  if (!fam || !fam.scenario || !fam.scenario.includes(scenario)) { flags.push("family_mismatch"); score -= 20; }
  const structLen = (dir && dir.structure) ? dir.structure.length : 0;
  if (scenario === "recruit" && structLen < 4) { flags.push("recruit_struct"); score -= 6; }
  if (scenario === "recap" && structLen < 5) { flags.push("recap_struct"); score -= 6; }
  if (dir && dir.layoutRhythm && dir.layoutRhythm.maxSamePatternRepeat && dir.layoutRhythm.maxSamePatternRepeat > 2) { flags.push("rhythm"); score -= 10; }
  if (dir && dir.visual && !dir.visual.typographic) { flags.push("no_typo"); score -= 6; }
  if (dir && dir.visual && !dir.visual.coverHint) { flags.push("no_hero"); score -= 6; }
  if (dir && dir.imageRatio) {
    const band = scenario === "recruit" ? [0.5, 0.65] : [0.6, 0.75];
    if (dir.imageRatio < band[0] - 0.05 || dir.imageRatio > band[1] + 0.05) { flags.push("image_ratio"); score -= 8; }
  }
  if (dir && dir.whitespace && ["low", "medium", "generous"].indexOf(dir.whitespace) < 0) { flags.push("whitespace"); score -= 8; }
  return { score: Math.max(0, score), flags: flags };
}

function qualityCheck(out, dir, scenario, facts, adv) {
  if (!out) return out;
  // P0-18：先执行无依据 claim 的删除/重写（就地修改 out，返回被删类别）
  const removed = stripUnsupportedClaims(out, facts, adv);
  const gzh = out.gzh;
  if (!gzh || !gzh.sections || gzh.sections.length < 3) return out;
  const cq = contentQuality(out, dir, scenario, facts, adv);
  const family = (dir && dir.family) || (state.xf && state.xf.family) || "";
  const eq = editorialQuality(dir, scenario, family, (dir && dir.variant));
  const fictionRisk = cq.fiction > 0;
  const contentRisk = cq.score < 60;
  const editorialRisk = eq.score < 60;
  if (state.xf) {
    const ficHits = cq.flags.filter((f) => f.indexOf("fiction:") >= 0).map((f) => f.split(":")[1]).slice(0, 3);
    // P2-2：无事实依据的声明（保险/领队/天气/人数/完成情况/用户反馈/路线成熟度/风景判断…）
    const unsupHits = cq.flags.filter((f) => f.indexOf("unsupported:") >= 0).map((f) => f.split(":")[1]).slice(0, 5);
    const removedNote = removed.length ? ("已自动删除以下无依据声明：" + removed.join("、")) : "";
    state.xf.quality = {
      // P0-18：删除层已直接处理无依据声明，故 flag 改为 unsupported_removed（不再只是标记）
      flag: fictionRisk ? "fiction_risk" : (removed.length ? "unsupported_removed" : (unsupHits.length ? "unsupported_claim" : (contentRisk || editorialRisk ? "quality_risk" : "ok"))),
      content: cq, editorial: eq, unsupported: unsupHits, removed: removed,
      contentRisk: contentRisk, editorialRisk: editorialRisk, fictionRisk: fictionRisk,
      note: fictionRisk ? ("检测到可能的虚构表述，建议人工复核：" + ficHits.join("、"))
        : (removed.length ? removedNote
          : (unsupHits.length ? ("以下说法缺少事实依据，建议修改或删除：" + unsupHits.join("、"))
            : (contentRisk ? "文案质量分偏低（" + cq.score + "），已尝试自动重生成"
              : (editorialRisk ? "版式质量分偏低（" + eq.score + "），已尝试重选家族/变体"
                : "文案基于已确认事实，质量达标（内容 " + cq.score + " / 版式 " + eq.score + "）")))),
    };
    // P2-5：六维页面质量评分（内部判断，不向用户暴露数字，仅存定性档位供 UI/日志/自动优化决策）
    state.xf.pageQuality = pageQuality(state.xf, out);
  }
  return out;
}

/* ---------- P2-5 页面内容质量评分（内部判断，不直接暴露数字给用户） ----------
   六维：事实安全 / 重复 / 主题一致 / 图片匹配 / 模板感 / 情绪感染力
   每维 0-1 子分；加权合成总评 0-100；对外仅给定性档位(优秀/良好/可优化/需优化)。 */
function qualityBand(s01) {
  if (s01 >= 0.82) return "优秀";
  if (s01 >= 0.65) return "良好";
  if (s01 >= 0.45) return "可优化";
  return "需优化";
}
// ① 事实安全：FORBID 虚构词 + 12 类无依据 claim（复用 §39 的 claimDetectors）
function dimFactSafety(text, facts, adv) {
  const forb = (XF_FORBID_WORDS || []).filter((w) => (text || "").indexOf(w) >= 0).length;
  let unsup = 0;
  if (facts || adv) {
    const det = claimDetectors(facts, adv);
    det.forEach((c) => {
      const okv = (typeof c.ok === "function") ? c.ok(text) : c.ok;
      if (c.re.test(text) && !okv) unsup++;
    });
  }
  const penalty = Math.min(1, forb * 0.18 + unsup * 0.10);
  return { score: +(1 - penalty).toFixed(2), detail: { forb: forb, unsup: unsup } };
}
// ② 重复：正文句子级精确重复 + 12 字前缀近似重复
function dimRepeat(text) {
  const sents = (text || "").split(/(?<=[。！？；\n])/).map((s) => s.trim()).filter((s) => s.length >= 8);
  if (!sents.length) return { score: 1, detail: { dup: 0, total: 0 } };
  const seenExact = {}, seenPre = {}; let dup = 0;
  sents.forEach((s) => {
    const n = s.replace(/\s+/g, ""); const pre = n.slice(0, 12);
    if (seenExact[n] || (pre.length >= 12 && seenPre[pre])) dup++;
    else { seenExact[n] = 1; if (pre.length >= 12) seenPre[pre] = 1; }
  });
  const ratio = dup / sents.length;
  return { score: +(1 - Math.min(1, ratio * 1.5)).toFixed(2), detail: { dup: dup, total: sents.length } };
}
// ③ 主题一致：正文是否覆盖活动核心事实/主题词（mainTheme/place/activityName/type/卖点/季节）
function dimTheme(text, xf) {
  const m = (xf && xf.master) || {};
  const f = m.confirmedFacts || {};
  const kws = [];
  if (m.mainTheme) kws.push(m.mainTheme);
  if (f.place) kws.push(f.place);
  if (f.activityName) kws.push(f.activityName);
  if (f.type) kws.push(f.type);
  if (m.mainSellingPoint) kws.push(m.mainSellingPoint);
  if (f.season) kws.push(f.season);
  const uniq = []; kws.forEach((k) => { if (k && uniq.indexOf(k) < 0) uniq.push(k); });
  if (!uniq.length) return { score: 0.6, detail: { matched: 0, total: 0 } };
  let matched = 0; uniq.forEach((k) => { if ((text || "").indexOf(k) >= 0) matched++; });
  const expected = Math.min(uniq.length, 5);
  return { score: +Math.min(1, matched / expected).toFixed(2), detail: { matched: matched, total: uniq.length } };
}
// ④ 图片匹配：正文描述的场景是否有对应照片分类覆盖（xf.master.keyImages[].cat）
function dimImage(text, xf) {
  const m = (xf && xf.master) || {};
  const photos = m.keyImages || [];
  if (!photos.length) return { score: 0.55, detail: { note: "no-photos", needed: 0, matched: 0 } };
  const cats = photos.map((p) => p.cat).filter(Boolean);
  const sceneMap = [
    [/水|河|湖|溪|海|泳|桨|漂/, ["water", "scenic"]],
    [/山|峰|林|野|自然|风景|景/, ["scenic", "route", "water", "camp"]],
    [/路|线|徒步|登山|爬|坡|垭/, ["route", "scenic"]],
    [/营|帐|野炊|篝火/, ["camp", "meal"]],
    [/餐|食|饭|补给/, ["meal"]],
    [/人|伙伴|队友|合影|我们|大家|同行/, ["people", "team", "cover"]],
    [/装备|杖|头盔|包/, ["gear", "detail"]],
    [/夜|星|晚/, ["scenic", "detail"]],
    [/细节|特写|近景/, ["detail", "gear"]],
  ];
  let needed = [];
  sceneMap.forEach((pair) => { if (pair[0].test(text || "")) pair[1].forEach((c) => { if (needed.indexOf(c) < 0) needed.push(c); }); });
  if (!needed.length) return { score: 0.8, detail: { note: "no-scene-mention", cats: cats.length, needed: 0, matched: 0 } };
  const have = needed.filter((c) => cats.indexOf(c) >= 0);
  const ratio = have.length / needed.length;
  return { score: +Math.max(0.3, Math.min(1, ratio)).toFixed(2), detail: { needed: needed.length, matched: have.length } };
}
// ⑤ 模板感：套路开头 + 空洞词（复用 §39 的 TEMPLATE/HOLLOW 思路）
function dimTemplate(text) {
  const TEMPLATE = ["大家好，", "大家好！", "今天给大家", "一起来看看", "不仅如此", "总而言之", "总的来说", "首先，", "其次，", "最后，"];
  const HOLLOW = ["说走就走", "治愈", "松弛感", "诗和远方", "岁月静好", "人间值得", "小确幸", "元气满满", "绝绝子"];
  let tpl = 0; TEMPLATE.forEach((w) => { if ((text || "").indexOf(w) >= 0) tpl++; });
  let hollow = 0; HOLLOW.forEach((w) => { if ((text || "").indexOf(w) >= 0) hollow++; });
  const penalty = Math.min(1, tpl * 0.12 + hollow * 0.15);
  return { score: +(1 - penalty).toFixed(2), detail: { tpl: tpl, hollow: hollow } };
}
// ⑥ 情绪感染力：感官/画面词 + 互动/第二人称 + 情绪词 + 设问 + 句式长短变化
function dimEmotion(text) {
  const SENSE = ["风", "光", "云", "山", "水", "汗", "笑", "呼吸", "夕阳", "清晨", "落日", "星空", "暖", "凉", "静", "慢", "雾", "林", "野", "溪", "海"];
  const ENGAGE = ["你", "我们", "一起", "不妨", "何不", "试试", "记得", "想象"];
  const FEEL = ["治愈", "感动", "惊喜", "期待", "宁静", "欢喜", "自由", "心动", "惬意", "温柔", "热烈", "雀跃", "忘我", "辽阔"];
  const Q = ((text || "").match(/[？?]/g) || []).length;
  let sense = 0; SENSE.forEach((w) => { if ((text || "").indexOf(w) >= 0) sense++; });
  let engage = 0; ENGAGE.forEach((w) => { if ((text || "").indexOf(w) >= 0) engage++; });
  let feel = 0; FEEL.forEach((w) => { if ((text || "").indexOf(w) >= 0) feel++; });
  const sents = (text || "").split(/(?<=[。！？；])/).map((s) => s.trim()).filter((s) => s.length > 0);
  let variation = 0;
  if (sents.length >= 3) { const ls = sents.map((s) => s.length); const span = Math.max.apply(null, ls) - Math.min.apply(null, ls); variation = span > 10 ? 1 : 0; }
  const signals = sense + engage + feel + (Q > 0 ? 1 : 0) + variation;
  const expected = 6;
  return { score: +Math.min(1, signals / expected).toFixed(2), detail: { sense: sense, engage: engage, feel: feel, q: Q, variation: variation } };
}
// 综合：六维加权 → 总评 0-100 + 定性档位
function pageQuality(xf, out) {
  xf = xf || ((typeof state !== "undefined" && state.xf) || {});
  out = out || xf.out;
  const text = (typeof textOf === "function" && out) ? textOf(out) : "";
  const m = xf.master || {};
  const f = m.confirmedFacts || {};
  const adv = m.actualActivityData || null;
  const fact = dimFactSafety(text, f, adv);
  const repeat = dimRepeat(text);
  const theme = dimTheme(text, xf);
  const image = dimImage(text, xf);
  const tpl = dimTemplate(text);
  const emotion = dimEmotion(text);
  const W = { factSafety: 0.28, repeat: 0.15, theme: 0.20, image: 0.12, template: 0.10, emotion: 0.15 };
  const dims = { factSafety: fact.score, repeat: repeat.score, theme: theme.score, image: image.score, template: tpl.score, emotion: emotion.score };
  let overall01 = 0; Object.keys(W).forEach((k) => { overall01 += dims[k] * W[k]; });
  const overall = Math.round(overall01 * 100);
  const band = qualityBand(overall / 100);
  const lowDims = Object.keys(dims).filter((k) => dims[k] < 0.55).map((k) => k);
  return {
    overall: overall, overall01: +overall01.toFixed(2), band: band, dims: dims, weights: W,
    detail: { fact: fact.detail, repeat: repeat.detail, theme: theme.detail, image: image.detail, template: tpl.detail, emotion: emotion.detail },
    lowDims: lowDims, computedAt: (typeof Date !== "undefined") ? Date.now() : 0,
  };
}

/* ---------- 文案辅助（保留原有模板回退用） ---------- */
function fitTitle(a) { return (a.audience && a.audience.length) ? `适合谁 · ${a.audience.join("/")}` : "适不适合我"; }
function fitText(a, m) {
  // P0-15：仅从 confirmedFacts 推导「适合谁」。不默认 专业领队/路线成熟/门槛友好 等无依据断言。
  const f = m.confirmedFacts;
  const parts = [];
  if (f.ageRange) parts.push("适合 " + f.ageRange);
  else if (f.audience) parts.push("面向 " + f.audience);
  if (f.difficulty) parts.push("强度" + f.difficulty + "，报名前请确认与自身情况匹配");
  if (f.leader) parts.push("本场由 " + f.leader + " 带队");
  return parts.length ? parts.join("；") + "。" : "具体是否适合你，请结合强度、时间与自身情况判断，或向发布方咨询。";
}
function infoRows(a) {
  const rows = [];
  if (a.dateMD || a.date) rows.push({ k: "时间", v: a.dateMD || a.date });
  if (a.place) rows.push({ k: "地点", v: a.place });
  if (a.meeting) rows.push({ k: "集合", v: a.meeting + (a.meetTime ? " " + a.meetTime : "") });
  if (a.transport) rows.push({ k: "交通", v: a.transport });
  if (a.meal) rows.push({ k: "餐食", v: a.meal });
  if (a.days > 1) rows.push({ k: "天数", v: a.days + " 天" });
  if (a.elevation) rows.push({ k: "海拔", v: a.elevation + " 米" });
  if (a.difficulty) rows.push({ k: "强度", v: a.difficulty });
  if (a.limit) rows.push({ k: "名额", v: a.limit + (a.limitUnit || "人") });
  if (a.leaderName) rows.push({ k: "领队", v: a.leaderName + (a.leaderYears ? "（" + a.leaderYears + "）" : "") });
  if (a.insurance) rows.push({ k: "保险", v: a.insurance });
  return rows;
}
function tags(a) {
  const t = (a.type || "") + (a.title || "");
  const base = ["户外", "周末去哪儿"];
  if (/亲子|研学/.test(t)) base.push("亲子户外", "自然教育");
  else if (/露营|营地/.test(t)) base.push("露营", "营地生活");
  else if (/漂流|溯溪|水上/.test(t)) base.push("玩水", "溯溪");
  else if (/登山|雪山|越野/.test(t)) base.push("徒步登山", "向上挑战");
  else if (/摄影/.test(t)) base.push("户外摄影", "出片");
  else base.push("徒步", "爬山");
  return base;
}
function xhsTitle(a, m, n, dir) {
  // P0-15：标题仅基于事实/表达方向，不做「风景绝美/好拍/松弛」等品质断言。
  const f = m.confirmedFacts;
  const name = f.activityName || "这场活动";
  const arr = [
    `${name}｜${(f.place ? f.place + "·" : "") + (publishSeason(a) || "周末")}招募`,
    `周末去哪？${name}报名信息一览`,
    `${f.place || "户外"}的${publishSeason(a) || ""}行程，报名看这里`,
    `${name}｜${(f.date || "近期")}出发，详情见内文`,
    `${name}活动信息：时间、地点、费用一次说清`,
  ];
  return arr[(n - 1) % arr.length];
}
function recapType(a, photos) {
  const t = (a.type || "") + (a.title || "");
  if (/亲子|研学|自然|儿童/.test(t)) return "亲子陪伴型";
  if (/雪山|越野|高海拔|重装|攀岩/.test(t)) return "完成挑战型";
  if (/漂流|溯溪|水上|露营|营地|派对/.test(t)) return "活动氛围型";
  if (/摄影|风光|秋色|红叶|花海/.test(t)) return "风景纪实型";
  if (photos && photos.length >= 6) return "团队成长型";
  return "户外体验型";
}
function nextText(a) {
  const next = nextActivityOf(a);
  if (next) {
    const when = next.dateMD || next.date || "";
    const place = next.place || next.title || "下一场活动";
    return "下一场：" + place + (when ? "（" + when + "）" : "") + "，活动信息以发布页为准。";
  }
  return "更多活动信息可关注机构后续发布。";
}

/* ================= 渲染：AI 宣发中心 ================= */
function renderFabu() {
  const xf = publishState();
  return `
  <div class="section-head">
    <div class="section-title">AI 宣发中心</div>
    <div class="section-sub">上传活动资料和照片，ClubOS 自动理解内容、提炼传播主题、生成并排版微信公众号图文，同步生成小红书等内容。活动结束还能一键生成活动回顾。</div>
  </div>
  ${aiAuthMode() === "backend" ? "" : `<div class="xf-banner">未配置总平台后端：当前 AI 走本地演示直连（仅本机 Key）。<button class="xf-banner-btn" data-action="nav" data-view="settings">去「设置 → AI 设置」接入</button></div>`}
  ${publishFlow()}
  ${legacySection()}
  `;
}

function publishFlow() {
  const xf = publishState();
  if (!xf.scenario) return scenarioHtml();
  if (xf.scenario === "recruit") return xf.step === "result" && xf.out ? recruitResult() : recruitPicker();
  if (xf.scenario === "recap") return xf.step === "result" && xf.recap ? recapResult() : recapPicker();
  return scenarioHtml();
}

function scenarioHtml() {
  return `
  <div class="xf-hero">
    <div class="xf-hero-txt">
      <div class="eyebrow">一次理解 · 多平台适配</div>
      <h2>把活动资料和照片交给 ClubOS</h2>
      <p class="muted">自动生成公众号图文与小红书内容；活动结束还能生成完整活动回顾。目标：10–20 分钟完成初稿、排版与修改。</p>
    </div>
    <div class="xf-cards">
      <button class="xf-card" data-action="goScenario" data-s="recruit">
        <span class="xf-card-ic">${ICON("send")}</span>
        <b>活动招募</b>
        <span>生成宣传内容</span>
        <i>公众号图文 · 小红书 · 朋友圈 · 微信群 · 口播 · 海报</i>
      </button>
      <button class="xf-card" data-action="goScenario" data-s="recap">
        <span class="xf-card-ic">${ICON("camera")}</span>
        <b>活动回顾</b>
        <span>生成活动回顾</span>
        <i>选已完成活动 · 传照片 · 自动排版回顾</i>
      </button>
    </div>
  </div>`;
}

function activityPicker(filterFn, label, emptyMsg) {
  const xf = publishState();
  const acts = (state.activities || []).filter(filterFn);
  return `
  <div class="xf-pick">
    <button class="btn btn-ghost btn-sm" data-action="goScenario" data-s="back">${ICON("chevron-left")} 返回</button>
    <h3>${label}</h3>
    ${acts.length ? `<div class="xf-act-list">${acts.map((a) => {
      const selected = xf.aid === a.id;
      const thumbSrc = (a.photos && a.photos[a.coverIndex || 0]) || "";
      return `
      <div class="xf-act ${selected ? "active" : ""}">
        <div class="xf-act-thumb" ${thumbSrc ? smartBg(thumbSrc) : ""}></div>
        <div class="xf-act-info">
          <b>${esc(a.title || "未命名活动")}</b>
          <span class="muted small">${(a.dateMD || a.date || "时间待定")} · ${esc(a.place || "")} · ${esc(a.status || "")}</span>
        </div>
        <button class="btn btn-sm ${selected ? "btn-ghost active" : "btn-primary"}" data-action="pickActivity" data-aid="${a.id}">${selected ? `${ICON("check")} 已选` : "选择"}</button>
      </div>`;
    }).join("")}</div>` : `<div class="empty"><div class="e-ic">📭</div><div>${esc(emptyMsg || "没有符合条件的活动，先去「活动内容」创建一场吧。")}</div></div>`}
  </div>`;
}

/* ---------- P1-6 / P1-2：智能筛图结果「轻确认」 ----------
   老板上传的图先经过 selectPhotos（去重/质量/数量策略），生成前给出：
   建议使用 M 张、封面是哪张、各角色数量、不建议使用的张数；老板可改封面 / 移除某张 / 一键采用推荐。 */
function excludedPhotos(xf) { return (xf.photoOverrides && xf.photoOverrides.excluded) || {}; }
function activePhotos(xf) {
  const ex = excludedPhotos(xf);
  return (xf.photos || []).filter((s) => !ex[s]);
}
function photoIntelFor(xf, a, scenario) {
  const photos = activePhotos(xf);
  if (!photos.length || typeof buildPhotoIntelligence !== "function") return null;
  const intel = buildPhotoIntelligence(photos, a || {}, [], scenario || xf.scenario || "recruit");
  // 老板手动指定封面 → 覆盖 Hero 角色
  const ov = xf.photoOverrides || {};
  if (ov.cover != null && ov.cover >= 0) {
    const src = (xf.photos || [])[ov.cover];
    const p = src && intel.used.find((u) => u.src === src);
    if (p) {
      if (intel.heroId) intel.roles[intel.heroId] = "SectionLeadImage";
      intel.roles[p.imageId] = "HeroImage";
      intel.heroId = p.imageId;
    }
  }
  return intel;
}
function coverIndex(xf) {
  const ov = xf.photoOverrides || {};
  if (ov.cover != null && ov.cover >= 0) return Math.min(ov.cover, (xf.photos || []).length - 1);
  const intel = photoIntelFor(xf, xf._a, xf.scenario);
  if (intel && intel.heroId) {
    const h = intel.used.find((u) => u.imageId === intel.heroId);
    if (h) { const i = (xf.photos || []).indexOf(h.src); if (i >= 0) return i; }
  }
  return 0;
}
// P1-2：把老板在轻确认里选的「封面」，落到生成结果的 photoIntel.heroId。
// 否则 genStrategy 会按内容自己选封面，导致「改封面」在生成后无效（只改了预览、没改输出）。
function applyCoverOverride(xf) {
  const ov = xf.photoOverrides || {};
  if (ov.cover == null || ov.cover < 0) return;
  const src = (xf.photos || [])[ov.cover];
  if (!src) return;
  const intel = xf.strategy && xf.strategy.photoIntel;
  if (!intel || !intel.used) return;
  const p = intel.used.find((u) => u.src === src);
  if (!p) return; // 已弃用的图不可作封面
  if (intel.heroId && intel.roles) intel.roles[intel.heroId] = "SectionLeadImage";
  intel.roles[p.imageId] = "HeroImage";
  intel.heroId = p.imageId;
}
function photoReviewPanel(xf) {
  const photos = xf.photos || [];
  if (!photos.length) return "";
  const intel = photoIntelFor(xf, xf._a, xf.scenario);
  if (!intel) return "";
  const ex = excludedPhotos(xf);
  const coverSrc = photos[coverIndex(xf)];
  const usedSet = {}; intel.used.forEach((u) => { usedSet[u.src] = true; });
  const roleOf = (src) => { const p = intel.analysis.find((u) => u.src === src); return intel.roles[p && p.imageId]; };
  const rc = {};
  intel.used.forEach((u) => { const r = intel.roles[u.imageId] || "GalleryImage"; rc[r] = (rc[r] || 0) + 1; });
  const dirty = (xf.photoOverrides && (xf.photoOverrides.cover != null || Object.keys(ex).length));
  return `<div class="xpr">
    <div class="xpr-head"><b>智能筛图结果</b><span class="tiny muted">上传 ${intel.analysis.length} 张 → 建议使用 ${intel.used.length} 张（弃用 ${intel.selection.discarded.length}）</span></div>
    <div class="xpr-chips">
      ${(intel.roleOrder || PI_ROLE_ORDER).map((r) => {
        const n = (intel.roleCounts && intel.roleCounts[r]) || 0;
        if (r === "DiscardCandidate") return n ? `<span class="xpr-chip discard">${intel.roleLabel[r] || r} ${n}</span>` : "";
        return `<span class="xpr-chip ${r === "HeroImage" ? "hl" : ""}">${intel.roleLabel[r] || r} ${n}</span>`;
      }).join("")}
      ${intel.cropSafety.highRiskIds.length ? `<span class="xpr-chip warn">${intel.cropSafety.highRiskIds.length} 张不宜大图（已按原比例保护）</span>` : ""}
      <span class="xpr-chip ${intel.simulated ? "" : "ok"}">${intel.simulated ? "规则推断（模拟分析）" : "真实视觉识别"}</span>
      <span class="xpr-chip" data-role="vision-intel" title="${esc((typeof visionIntelDetail === "function") ? visionIntelDetail(photos) : "")}">${esc((typeof visionIntelLabel === "function") ? visionIntelLabel(photos) : (intel.simulated ? "图片智能：基础分析" : "图片智能：视觉识别"))}</span>
    </div>
    <div class="xpr-vision">
      ${(typeof visionAvailable === "function" && visionAvailable())
        ? `<button class="btn btn-soft btn-sm" data-action="visionAnalyze" ${xf._visionBusy ? "disabled" : ""}>${ICON("sparkles")} ${xf._visionBusy ? "识别中…" : "用视觉模型重新识别"}</button>`
        : `<span class="tiny muted">未配置视觉模型 → 当前为本地像素分析 + 规则推断（可在「设置 → AI 设置 → 视觉模型」接入）</span>`}
      ${xf._visionNote ? `<span class="tiny muted">${esc(xf._visionNote)}</span>` : ""}
    </div>
    <div class="xpr-grid">
      ${photos.map((p, i) => {
        const isCover = p === coverSrc;
        const isEx = !!ex[p];
        const inUsed = !!usedSet[p];
        const lab = isCover ? "封面" : (isEx ? "已移除" : (inUsed ? (intel.roleLabel[roleOf(p)] || "使用") : "建议弃用"));
        return `<div class="xpr-cell ${isCover ? "is-cover" : ""} ${isEx ? "is-ex" : ""} ${(!inUsed && !isEx) ? "is-soft" : ""}">
          <div class="xpr-ph" ${smartBg(p)}></div>
          <span class="xpr-badge">${esc(lab)}</span>
          <span class="xpr-ops">
            ${isCover ? "" : `<button class="xpr-btn" data-action="setCover" data-i="${i}">设为封面</button>`}
            <button class="xpr-btn" data-action="toggleExclude" data-i="${i}">${isEx ? "恢复" : "移除"}</button>
          </span>
        </div>`;
      }).join("")}
    </div>
    ${dirty ? `<button class="xpr-reset" data-action="useRecommended">采用 AI 推荐（还原封图与筛选）</button>` : ""}
    <p class="tiny muted">AI 会按内容把图片匹配到正文段落；「移除」的图不会进入生成结果。</p>
  </div>`;
}

function recruitPicker() {
  const xf = publishState();
  return activityPicker((a) => a.status === "recruiting" || a.status === "draft" || a.status === "full" || !a.status, "选择要招募的活动") +
    (xf.genState === "loading" ? `<div class="xf-loading-overlay"><div class="xf-spinner"></div><div class="xf-loading-title">正在生成宣传内容</div><div class="xf-loading-tip">理解活动 → 分析照片 → 撰写文案 → 多平台排版</div></div>` : "") +
    `<div class="xf-supp">
      <div class="panel"><div class="panel-head"><h3>补充资料（可选）</h3><span class="tiny muted">粘贴旧文案 / 备注，帮助 AI 更准</span></div>
        <div class="panel-body"><textarea class="textarea" data-xf="note" placeholder="例如：往年这篇活动阅读很高、客户最关心亲子安全、这次新增了溯溪环节…">${esc(xf.notes || "")}</textarea></div></div>
      <div class="panel"><div class="panel-head"><h3>添加图片 / 海报（可选）</h3><span class="tiny muted">用于公众号配图，自动分类</span></div>
        <div class="panel-body">
          <div class="xf-photos">${(xf.photos || []).map((p, i) => `<div class="xf-ph" ${smartBg(p)}><button class="x" data-action="delPhoto" data-i="${i}">${ICON("x")}</button></div>`).join("")}
            <label class="xf-ph-add" data-action="upload">${ICON("upload")}</label></div>
          ${photoReviewPanel(xf)}
          <button class="btn btn-primary btn-sm" data-action="recruitGen" style="margin-top:10px" ${xf.genState === "loading" ? "disabled" : ""}>${ICON("sparkles")} ${xf.genState === "loading" ? "生成中…" : "生成宣传内容"}</button>
        </div></div>
    </div>`;
}

function recapPicker() {
  const xf = publishState();
  const c = xf.customRecap || {};
  const selected = xf.aid ? (state.activities || []).find((a) => a.id === xf.aid) : null;
  return activityPicker((a) => a.status === "ended", "选择已结束的活动", "没有已结束活动，可直接填写下方信息生成回顾") +
    (selected ? `<div class="xf-supp"><div class="panel"><div class="panel-head"><h3>已选择活动</h3></div><div class="panel-body"><div class="xf-act" style="margin:0"><div class="xf-act-info"><b>${esc(selected.title || "未命名活动")}</b><span class="muted small">${(selected.dateMD || selected.date || "时间待定")} · ${esc(selected.place || "")}</span></div><button class="btn btn-ghost btn-sm" data-action="pickActivity" data-aid="">清除选择</button></div></div></div></div>` : "") +
    (xf.genState === "loading" ? `<div class="xf-loading-overlay"><div class="xf-spinner"></div><div class="xf-loading-title">正在生成活动回顾</div><div class="xf-loading-tip">理解活动 → 分析照片 → 撰写回顾 → 多平台排版</div></div>` : "") +
    `<div class="xf-supp">
      <div class="panel"><div class="panel-head"><h3>上传本次活动照片</h3><span class="tiny muted">先传照片，AI 先识别 / 筛图 / 分类，再据此提炼回顾主题</span></div>
        <div class="panel-body">
          <div class="xf-photos">${(xf.photos || []).map((p, i) => `<div class="xf-ph" ${smartBg(p)}><button class="x" data-action="delPhoto" data-i="${i}">${ICON("x")}</button><span class="xf-ph-cat">${photoCategory(p, i)}</span></div>`).join("")}
            <label class="xf-ph-add" data-action="upload">${ICON("camera")}</label></div>
          ${photoReviewPanel(xf)}
          ${(xf.photos || []).length ? "" : `<p class="tiny muted">上传现场照片后，AI 会先整理照片，再基于照片与补充信息提炼回顾主题。</p>`}
        </div></div>
      <div class="panel"><div class="panel-head"><h3>或直接填写活动信息生成回顾</h3><span class="tiny muted">不绑定已有活动时使用这些信息</span></div>
        <div class="panel-body">
          <div class="xf-field"><label>活动名称</label><input class="input" data-xf="customTitle" placeholder="例如：虹口漂流一日记" value="${esc(c.title || "")}"></div>
          <div class="xf-field"><label>活动时间</label><input class="input" data-xf="customDate" placeholder="例如：9月28日" value="${esc(c.date || "")}"></div>
          <div class="xf-field"><label>活动地点</label><input class="input" data-xf="customPlace" placeholder="例如：都江堰虹口" value="${esc(c.place || "")}"></div>
          <div class="xf-field"><label>活动类型</label><input class="input" data-xf="customType" placeholder="漂流 / 登山 / 亲子 / 露营…" value="${esc(c.type || "")}"></div>
          <div class="xf-field"><label>参与人数</label><input class="input" data-xf="customSignups" type="number" placeholder="例如：18" value="${esc(c.signups || "")}"></div>
          <div class="xf-field"><label>领队 / 组织者</label><input class="input" data-xf="customLeader" placeholder="例如：阿龙" value="${esc(c.leader || "")}"></div>
        </div></div>
      <div class="panel"><div class="panel-head"><h3>补充真实信息（可选）</h3><span class="tiny muted">领队备注 / 用户反馈 / 特别瞬间 / 实际天气</span></div>
        <div class="panel-body"><textarea class="textarea" data-xf="recapNotes" placeholder="例如：当天其实放晴了、小朋友第一次自己爬上来、大家最满意的是晚餐…">${esc(xf.recapNotes || "")}</textarea>
          <button class="btn btn-primary btn-sm" data-action="recapGen" style="margin-top:10px" ${xf.genState === "loading" ? "disabled" : ""}>${ICON("sparkles")} ${xf.genState === "loading" ? "生成中…" : "生成活动回顾"}</button>
        </div></div>
    </div>`;
}

/* 平台 Tab */
function platformTabs(active, prefix) {
  const tabs = [["gzh", "公众号"], ["xhs", "小红书"], ["moments", "朋友圈"], ["wechat", "微信群"], ["voice", "口播"], ["poster", "海报"]];
  return `<div class="xf-tabs">${tabs.map(([k, l]) => `<button class="xf-tab ${active === k ? "active" : ""}" data-action="platformTab" data-k="${k}" data-prefix="${prefix}">${l}</button>`).join("")}</div>`;
}

function styleBar(xf) {
  const sc = xf.scenario;
  const fams = Object.keys(XF_FAMILIES).filter((f) => XF_FAMILIES[f].scenario.includes(sc));
  const dir = xf.strategy && xf.strategy.editorialDirection;
  const famLabel = (XF_FAMILIES[xf.family] && XF_FAMILIES[xf.family].label) || "";
  const vs = (XF_FAMILIES[xf.family] && XF_FAMILIES[xf.family].variants) || [""];
  const vName = vs[xf.variant || 0] || "";
  const q = xf.quality || {};
  // P2-5：页面质量评分属内部判断，主 UI 仅显示定性档位徽标，不暴露数字
  const pq = xf.pageQuality || null;
  // P1-8 质量信息用户化：**分数**属内部信息，留在「高级信息」内。
  // 但「缺少事实依据」是合规警告（P2-2），必须默认可见 —— 折进折叠块里等于没提示。
  const warnText = q.fictionRisk ? ("⚠️ " + (q.note || "发现可能缺少事实依据的描述，请确认。"))
    : ((q.unsupported && q.unsupported.length) ? ("⚠️ 以下说法缺少事实依据，建议修改或删除：" + q.unsupported.join("、")) : "");
  // P2-2：图片不足时给出降级提示（信息级，区别于橙色的合规警告）
  const dgNote = photoDowngrade(xf).hint;
  const cScore = (q.content && typeof q.content.score === "number") ? q.content.score : null;
  const eScore = (q.editorial && typeof q.editorial.score === "number") ? q.editorial.score : null;
  // P1-1 简化结果页：普通老板默认只看到「当前风格 / 换一种版式 / 换一种风格 / 快捷(4)」。
  // Family/Variant/Editorial Direction/Style Seed/Quality Score 与 局部重生成 全部收进「高级调试区」折叠块。
  return `<div class="xf-stylebar">
    <div class="xf-stylebar-row xf-stylebar-main">
      <span class="xf-stylebar-lbl">当前风格</span>
      <b class="xf-style-name">${esc(famLabel)}${vName ? " · " + esc(vName) : ""}</b>
      ${pq ? `<span class="xf-qbadge xf-qb-${esc(pq.band)}">内容质量 ${esc(pq.band)}</span>` : ""}
      <button class="btn btn-ghost btn-sm" data-action="nextVariant">${ICON("refresh")} 换一种版式</button>
      <button class="btn btn-ghost btn-sm" data-action="switchStyle">${ICON("sparkles")} 换一种风格</button>
      <button class="btn btn-primary btn-sm" data-action="confirmPublishPage">${ICON("check")} ${sc === "recap" ? "发布回顾" : "确认发布"}</button>
    </div>
    ${warnText ? `<div class="xf-stylebar-row xf-warn">${esc(warnText)}</div>` : ""}
    ${dgNote ? `<div class="xf-stylebar-row xf-down">${esc(dgNote)}</div>` : ""}
    <div class="xf-stylebar-row xf-quick"><span class="xf-stylebar-lbl">快捷</span>
      <button class="xf-chip xf-chip-soft" data-action="quickStyle" data-k="magazine">更杂志</button>
      <button class="xf-chip xf-chip-soft" data-action="quickStyle" data-k="visual">更视觉</button>
      <button class="xf-chip xf-chip-soft" data-action="quickStyle" data-k="pro">更专业</button>
      <button class="xf-chip xf-chip-soft" data-action="quickStyle" data-k="nature">更自然</button>
    </div>
    <details class="xf-adv"><summary>高级调试区</summary>
      <div class="xf-stylebar-row"><span class="xf-stylebar-lbl">局部重生成</span>
        <button class="xf-chip" data-action="regenTitle">${ICON("refresh")} 只改标题</button>
        <button class="xf-chip" data-action="regenCta">${ICON("refresh")} 只改结尾</button>
        <button class="xf-chip" data-action="shufflePhotos">${ICON("refresh")} 只换图片安排</button>
        <button class="xf-chip" data-action="nextVariant">${ICON("refresh")} 只换布局</button>
      </div>
      <div class="xf-stylebar-row"><span class="xf-stylebar-lbl">编辑家族 Family</span>${fams.map((f) => `<button class="xf-chip ${xf.family === f ? "active" : ""}" data-action="switchFamily" data-f="${f}">${XF_FAMILIES[f].label}</button>`).join("")}</div>
      <div class="xf-stylebar-row"><span class="xf-stylebar-lbl">版式变体 Variant</span>${vs.map((v, i) => `<button class="xf-chip ${xf.variant === i ? "active" : ""}" data-action="switchVariant" data-v="${i}">${v}</button>`).join("")}</div>
      ${dir ? `<div class="xf-dir">编辑方向 Editorial Direction：<b>${esc(dir.angle || "")}</b>${dir.hook ? ` · 钩子「${esc(dir.hook)}」` : ""} · 视觉 ${esc((dir.visual && dir.visual.color) || "")}/${esc((dir.visual && dir.visual.composition) || "")}</div>` : ""}
      <div class="xf-stylebar-row xf-debug-kv"><span class="xf-stylebar-lbl">Style Seed</span><code>${xf.styleSeed != null ? esc(String(xf.styleSeed)) : "—"}</code></div>
      <div class="xf-stylebar-row xf-debug-kv"><span class="xf-stylebar-lbl">Quality Score</span><code>内容 ${cScore != null ? cScore : "—"} ／ 版式 ${eScore != null ? eScore : "—"}</code></div>
      ${pq ? `<div class="xf-stylebar-row xf-debug-kv"><span class="xf-stylebar-lbl">页面质量(内部)</span><code>总评 ${esc(pq.band)} ｜ 事实 ${esc(qualityBand(pq.dims.factSafety))} ／ 重复 ${esc(qualityBand(pq.dims.repeat))} ／ 主题 ${esc(qualityBand(pq.dims.theme))} ／ 图片 ${esc(qualityBand(pq.dims.image))} ／ 模板 ${esc(qualityBand(pq.dims.template))} ／ 情绪 ${esc(qualityBand(pq.dims.emotion))}</code></div>` : ""}
    </details>
  </div>`;
}

/* §38 平台快速风格控制：仅调 ED 权重/视觉参数 + 换版式，不整跑文案 */
function quickStyle(kind) {
  const xf = publishState();
  if (!xf.strategy) { toast("请先生成内容"); return; }
  const sc = xf.scenario;
  const map = sc === "recruit"
    ? {
      magazine: { family: "route_editorial", color: "墨绿", typographic: "衬线大标题", composition: "左右交替", whitespace: "medium" },
      visual: { family: "visual_campaign", color: "暖米", typographic: "无衬线粗体", composition: "卡片流", whitespace: "generous" },
      pro: { family: "challenge_editorial", color: "夜空蓝", typographic: "无衬线粗体", composition: "数据条+区块", whitespace: "low" },
      young: { family: "visual_campaign", color: "暖米", typographic: "无衬线粗体", composition: "卡片流", whitespace: "generous" },
      challenge: { family: "challenge_editorial", color: "夜空蓝", typographic: "无衬线粗体", composition: "数据条+区块", whitespace: "low" },
      // P1-1：固定快捷预设在 recruit 场景也能解析（更自然 → 大图主导的编辑杂志感）
      nature: { family: "route_editorial", color: "山系橙", typographic: "衬线大标题", composition: "大图主导", whitespace: "generous" },
    }
    : {
      doc: { family: "brand_journal", color: "山系橙", composition: "大图主导", whitespace: "generous" },
      warm: { family: "photo_documentary", color: "松石", composition: "手账步骤", whitespace: "generous" },
      album: { family: "outdoor_lookbook", color: "暖米", composition: "网格画廊", whitespace: "generous" },
      people: { family: "photo_documentary", color: "松石", composition: "手账步骤", whitespace: "medium", imagePriority: "high" },
      nature: { family: "brand_journal", color: "山系橙", composition: "大图主导", whitespace: "generous" },
      // P1-1：固定快捷预设在 recap 场景也能解析（更杂志/更视觉/更专业）
      magazine: { family: "brand_journal", color: "山系橙", composition: "大图主导", whitespace: "generous" },
      visual: { family: "outdoor_lookbook", color: "暖米", composition: "网格画廊", whitespace: "generous" },
      pro: { family: "brand_journal", color: "夜空蓝", typographic: "无衬线粗体", composition: "数据条+区块", whitespace: "low" },
    };
  const cfg = map[kind];
  if (!cfg) return;
  const dir = xf.strategy.editorialDirection;
  if (cfg.family && XF_FAMILIES[cfg.family]) {
    xf.family = cfg.family; dir.family = cfg.family;
    const vs = (XF_FAMILIES[cfg.family].variants || [""]).length;
    xf.variant = Math.floor(rand(styleSeed() * 3.3 + 7) * vs) % vs;
    dir.variant = xf.variant;
  }
  if (cfg.color) dir.visual.color = cfg.color;
  if (cfg.typographic) dir.visual.typographic = cfg.typographic;
  if (cfg.composition) dir.visual.composition = cfg.composition;
  if (cfg.whitespace) dir.whitespace = cfg.whitespace;
  if (cfg.imagePriority) dir.imagePriority = cfg.imagePriority;
  xf._styleHistory.push(styleSignature(xf));
  toast("已应用风格");
  showView(state.view);
}

/* ---------- P2-1 局部重生成：只改标题 / 只改结尾 / 只换图片安排（不动其他内容与事实） ---------- */
function bumpSeed(xf) { xf.regenSeed = ((xf.regenSeed || 0) + 1); return xf.regenSeed; }
function titleCandidates(a, m, dir, scenario) {
  const f = (m && m.confirmedFacts) || {};
  const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a) : null;
  const place = f.place || "";
  const season = f.season || (dna && dna.season) || "";
  const dist = f.distance || "";
  const kind = (dna && dna.coreMotivationLabel) || "";
  const name = f.activityName || "这场活动";
  const theme = (m && m.mainTheme) || (dir && dir.angle) || "这一程";
  const t = [];
  if (scenario === "recap") {
    t.push(`回顾｜${name}`);
    t.push(`${season ? season + "，" : ""}我们在${place || "山野"}的这一程`);
    t.push(`记一次${f.activityType || "户外"}｜${place || "山野"}`);
    t.push(`${name} · 现场记录`);
  } else {
    t.push(`${name}｜${theme}`);
    if (place) t.push(`${season ? season + "的" : ""}${place}，${dist ? "约" + dist + "公里" : "值得走一趟"}`);
    if (kind) t.push(`${kind}${season ? "｜" + season : ""}${place ? " · " + place : ""}`);
    t.push(`${theme}${dist ? "｜约 " + dist + " 公里" : ""}`);
  }
  return t.filter(Boolean);
}
function regenTitle() {
  const xf = publishState();
  if (!xf.out || !xf.out.gzh) { toast("请先生成内容"); return; }
  const cands = titleCandidates(xf._a, xf.master, xf.strategy && xf.strategy.editorialDirection, xf.scenario);
  if (!cands.length) return;
  const seed = bumpSeed(xf);
  const pick = cands[seed % cands.length];
  xf.out.gzh.title = pick;
  if (xf.out.poster) xf.out.poster.title = pick;
  if (xf.out.xhs && Array.isArray(xf.out.xhs.titles) && xf.out.xhs.titles.length) xf.out.xhs.titles[0] = pick;
  toast("已换一版标题");
  showView(state.view);
}
function regenCta() {
  const xf = publishState();
  if (!xf.out || !xf.out.gzh) { toast("请先生成内容"); return; }
  const f = (xf.master && xf.master.confirmedFacts) || {};
  const seed = bumpSeed(xf);
  const when = f.date || "近期";
  const price = f.price != null ? "¥" + f.price + "/" + (f.limitUnit || "人") : "详询";
  /* P0-D：结尾话术同样受事实约束 —— 不出现「先到先得 / 名额有限 / 群里接龙占位」 */
  const ctaTarget = xf._a || {};
  const ctaShort = ctaShortOf(ctaTarget);
  const ctaUrg = urgencyTextOf(confirmedCTAOf(ctaTarget));
  const opts = xf.scenario === "recap"
    ? ["更多活动信息可关注机构后续发布。", "后续活动安排以机构发布为准。", "本次活动记录到此，感谢阅读。"]
    : [`${when} 出发，${price}。${ctaShort}。${ctaUrg}`,
      `${ctaShort}。${when} 见。`,
      `${price}，含已确认服务。${ctaShort}。`];
  const pick = opts[seed % opts.length];
  if (xf.scenario === "recap") xf.out.gzh.next = pick; else xf.out.gzh.cta = pick;
  toast("已换一版结尾");
  showView(state.view);
}
function shufflePhotos() {
  const xf = publishState();
  const ki = xf.master && xf.master.keyImages;
  if (!ki || ki.length < 2) { toast("图片不足，无法调整安排"); return; }
  ki.push(ki.shift()); // 轮转一位：改变图文配图顺序，不动文案与事实
  if (xf.photoOverrides) xf.photoOverrides.cover = null;
  toast("已换一种图片安排");
  showView(state.view);
}
/* 无 Key 时的事实驱动「换一种说法」——只换表达，不新增任何事实 */
function generateSectionCopy(h, m, a, seed) {
  const f = (m && m.confirmedFacts) || {};
  const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a) : null;
  const place = f.place || "";
  const season = f.season || (dna && dna.season) || "";
  const mood = (dna && dna.coreMotivationLabel) || "";
  // Case 7：专业/高强度活动（雪山、高海拔、技术型）抬高「强度/海拔/装备/安全」信息权重
  const elev = parseFloat(f.elevation) || 0;
  const gearTop = (f.gear && f.gear.length) ? f.gear.slice(0, 4).join("、") : "";
  const pro = !!(dna && (dna.intensity === "challenge" || dna.activityForm === "mountain" || elev >= 2500 || dna.professionalLevel === "technical"));
  const H = String(h || "");
  const opts = [];
  if (/为什么|值得|风景|地点|路线|地貌|景/.test(H)) {
    opts.push(`${season ? season + "，" : ""}${place || "这一程"}值得走一趟，不是因为多难，而是它刚好把${mood || "这一段心情"}接住了。`);
    opts.push(`先去走一遍${place || "它"}。看得见的风景，比任何描述都可靠。`);
    opts.push(`${place || "这里"}的好，不在攻略里，在你走进去的那几步。`);
  } else if (/体验|玩|挑战|探索|运动|做/.test(H)) {
    // Case 7：高强度活动优先给「海拔/装备/安全」表达，页面更专业
    if (pro) {
      if (elev) opts.push(`这不是轻松的散步：目标海拔约 ${elev} 米，强度${f.difficulty || "不低"}。每上升一段，都得靠装备和节奏兜底——准备越足，山越温柔。`);
      if (gearTop) opts.push(`装备是这场挑战的底线：自备${gearTop}。出发前逐项确认，不留侥幸。`);
      opts.push(`把体力推过临界点之前，先诚实地确认自己的经验与状态——专业路线，尊重它才走得远。`);
    }
    opts.push(`${season ? season + "的" : ""}节奏里，注意力会从待办清单挪到脚下——走、看、停一停。`);
    opts.push(`不用急着打卡；${f.days > 1 ? "两天一夜" : "一天"}的工夫，够把节奏慢下来。`);
    opts.push(`体验很具体：身体动起来，脑子空下来。`);
  } else if (/强度|海拔|装备|安全|准备|风险|硬指标/.test(H)) {
    if (pro) {
      const parts = [];
      if (f.difficulty) parts.push("强度" + f.difficulty);
      if (elev) parts.push("海拔约 " + elev + " 米");
      if (gearTop) parts.push("必备装备：" + gearTop);
      if (a && a.insurance) parts.push("已含保险：" + a.insurance);
      if (a && a.safety && a.safety.length) parts.push("安全：" + a.safety.join("、"));
      opts.push(parts.length ? `这场活动的硬指标：${parts.join("；")}。出发前逐项确认，比任何口号都管用。` : `这是一场需要专业准备的挑战，出发前请逐项确认装备与体能。`);
    } else {
      opts.push(`出发前把装备和体能都确认一遍，比任何口号都管用。`);
    }
  } else if (/收获|得到|适合|谁|陪伴|成长/.test(H)) {
    opts.push(`${f.ageRange ? "适合 " + f.ageRange + "。" : ""}${m.targetAudience || "想换口气的人"}会喜欢这种踏实感。`);
    opts.push(`带走的不是照片，是一个能反复回想的周末。`);
  } else if (/预告|下一期|集结/.test(H)) {
    opts.push(`更多活动信息可关注机构后续发布。`);
  } else {
    return "";
  }
  return opts.length ? opts[(seed || 0) % opts.length] : "";
}
async function regenSection(i) {
  const xf = publishState();
  const gzh = xf.out && xf.out.gzh;
  if (!gzh || !gzh.sections || !gzh.sections[i]) { toast("没有可重写的段落"); return; }
  const sec = gzh.sections[i];
  if (/信息|报名|费用|详情|须知/.test(String(sec.h || ""))) {
    // 决策信息段不参与改写，避免把事实改成表达
    toast("「" + sec.h + "」是决策信息段，保持事实原样不改写");
    return;
  }
  let html = null;
  if (aiAuthMode() && xf.master) {
    const f = xf.master.confirmedFacts || {};
    const dir = (xf.strategy && xf.strategy.editorialDirection) || {};
    const plain = String(sec.html || "").replace(/<[^>]+>/g, "").slice(0, 220);
    const sys = `你是户外活动内容编辑。只重写「指定段落」，其余段落不动。
原则：允许创造表达，禁止创造事件——不得新增任何未确认事实（天气 / 领队行为 / 具体人数 / 用户感受 / 完成情况 / 服务承诺 / 路线成熟度 / 风景判断）。
输出 JSON：{ "html": "一段 HTML 正文，可用 <p> 分段，80-160 字，口语自然、有画面感但不虚构" }`;
    const user = `已确认事实：${JSON.stringify(f)}
编辑角度：${dir.angle || ""}（语气：${dir.tone || ""}）
段落标题：${sec.h}
现有内容：${plain}
请只重写这一段，与标题一致、与事实一致。`;
    const r = await llmCall(sys, user, true);
    if (r && r.html) html = String(r.html).replace(/<script[\s\S]*?<\/script>/gi, "");
  }
  if (!html) {
    const seed = bumpSeed(xf);
    html = generateSectionCopy(sec.h, xf.master || {}, xf._a || {}, seed) || sectionBody(sec.h, xf._a || {}, xf.master || {}) || sec.html;
  }
  sec.html = html;
  toast("已重写「" + sec.h + "」");
  showView(state.view);
}
function sectionRegen(xf) {
  const gzh = xf.out && xf.out.gzh;
  if (!gzh || !gzh.sections || gzh.sections.length < 2) return "";
  return `<div class="xf-secregen">
    <span class="xf-stylebar-lbl">只重写某一段</span>
    ${gzh.sections.map((s, i) => `<button class="xf-chip" data-action="regenSection" data-i="${i}">${ICON("refresh")} ${esc(s.h || ("第" + (i + 1) + "段"))}</button>`).join("")}
  </div>`;
}

function recruitResult() {
  const xf = publishState();
  const o = xf.out;
  if (xf.genState === "loading") return `<div class="xf-loading">${ICON("sparkles")} 正在生成宣传内容…</div>`;
  return `
  <div class="xf-back"><button class="btn btn-ghost btn-sm" data-action="publishReset">${ICON("chevron-left")} 重新选择</button></div>
  <div class="xf-theme"><span class="xf-theme-lbl">本次核心传播主题</span><b>${esc((xf.master || {}).mainTheme || "")}</b></div>
  ${styleBar(xf)}
  ${platformTabs(xf.platTab, "recruit")}
  <div class="xf-plat-body">
    ${xf.platTab === "gzh" ? wechatArticlePanel(o.gzh, xf) : ""}
    ${xf.platTab === "xhs" ? xhsPanel(o.xhs) : ""}
    ${xf.platTab === "moments" ? momentsPanel(o.moments) : ""}
    ${xf.platTab === "wechat" ? wechatPanel(o.wechat) : ""}
    ${xf.platTab === "voice" ? voicePanel(o.voice) : ""}
    ${xf.platTab === "poster" ? posterPanel(o.poster, xf) : ""}
  </div>`;
}

function wechatArticlePanel(gzh, xf) {
  const base = XF_FAMILY_LAYOUT[xf.family] || "diary";
  return `
  <div class="xf-gzh-head">
    <button class="btn btn-primary btn-sm" data-action="copyGzhHtml">${ICON("copy")} 复制公众号（HTML）</button>
  </div>
  ${sectionRegen(xf)}
  ${base === "diary" ? renderDiaryPage(gzh, xf, false) : renderClassicPage(gzh, xf, base, false)}
  <p class="tiny muted">正文可直接点击修改（contenteditable）；换版式/换家族只改视觉，换风格才重生成文案。</p>`;
}
function photoSectionKind(h) {
  if (/为什么|值得去|风景|景|地点|路线|地貌/.test(h || "")) return "scenic";
  if (/体验|玩|挑战|探索|运动|做/.test(h || "")) return "experience";
  if (/收获|得到|适合|谁|陪伴|成长/.test(h || "")) return "people";
  return "scenic";
}

/* ---------- 公众号排版：图片与版式增强 ---------- */
function eyebrow(a, m) {
  const f = m && m.confirmedFacts ? m.confirmedFacts : {};
  const season = f.season || publishSeason(a) || "";
  const month = (f.date || "").match(/(\d{1,2})[\/\-]/) ? (f.date.match(/(\d{1,2})[\/\-]/)[1] + "月") : "";
  const enMonth = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mo = month ? parseInt(month, 10) - 1 : -1;
  const moEn = mo >= 0 && mo < 12 ? enMonth[mo] : "MOUNTAIN";
  const typeMap = { hike: "DIARY", mountain: "DIARY", water: "WATER", camp: "CAMP", family: "FAMILY", photo: "PHOTO" };
  const p = typeProfile(a);
  const tag = typeMap[p.kind] || "DIARY";
  return `${moEn} · ${tag}${season ? " · " + season : ""}`;
}
function brandPill(a) {
  const club = state.club && state.club.name ? state.club.name : "远拓旅游";
  const y = ((a.dateMD || a.date || "").match(/(\d{4})/) || ["", new Date().getFullYear()])[1];
  return `${club} · ${y}`;
}
function gzhCover(xf) {
  const gzh = xf.out && xf.out.gzh ? xf.out.gzh : {};
  let cover = gzh.cover && gzh.cover.src ? gzh.cover : null;
  if (!cover) {
    // P0-8：封面优先使用图片智能判定的 HeroImage（横图 + 风景优先、且规避高风险裁切）
    const intel = (xf.strategy && xf.strategy.photoIntel) || null;
    const heroUsed = (intel && intel.heroId) ? intel.used.find((u) => u.imageId === intel.heroId) : null;
    const list = (xf.master && xf.master.keyImages) || [];
    if (heroUsed) cover = list.find((p) => p.src === heroUsed.src) || null;
    if (!cover && xf.master) cover = matchPhoto(xf.master, "cover", 0);
    if (!cover || !cover.src) { if (list.length) cover = list[0]; }
  }
  return cover || {};
}
function photoSet(xf, prefer, count, exclude) {
  const list = [];
  const used = new Set();
  // P2-2：排除项（通常是封面 hero 图）——避免封面图在正文段落再次重复出现。
  // 少图时同一张图重复出现，根因正是封面被纳入正文图池；这里从源头把它挡在 section 之外。
  if (exclude) { (Array.isArray(exclude) ? exclude : [exclude]).forEach((s) => { if (s) used.add(s); }); }
  // P0-7/P0-8：若有图片智能结果，先用「自动筛图 + 角色」排序后的池子（Hero 优先，弃用图不参与）
  const intel = (xf.strategy && xf.strategy.photoIntel) || null;
  let imgs = (xf.master && xf.master.keyImages) || [];
  if (intel && intel.used && intel.used.length) {
    const rank = {};
    intel.used.forEach((u, i) => { rank[u.src] = i; });
    const roleOrder = { HeroImage: 0, SectionLeadImage: 1, SupportImage: 2, GalleryImage: 3, DetailImage: 4 };
    const filtered = imgs.filter((p) => p && p.src && rank[p.src] != null)
      .sort((p1, p2) => (roleOrder[intel.roles[intel.used[rank[p1.src]].imageId]] || 9) - (roleOrder[intel.roles[intel.used[rank[p2.src]].imageId]] || 9) || rank[p1.src] - rank[p2.src]);
    if (filtered.length) imgs = filtered; // 全被筛掉时回退原集合，避免无图
  }
  const order = Array.isArray(prefer) ? prefer : [prefer];
  for (const cat of order) {
    for (const p of imgs) {
      if (p && p.src && !used.has(p.src) && p.cat === cat) {
        list.push(p);
        used.add(p.src);
        if (list.length >= count) return list;
      }
    }
  }
  for (const p of imgs) {
    if (p && p.src && !used.has(p.src)) {
      list.push(p);
      used.add(p.src);
      if (list.length >= count) return list;
    }
  }
  return list;
}

/* ---------- P2-2：图片不足自动降级 ----------
   根据「实际可用图数」给出降级档位与文案 + 正文配图数量上限，
   避免少图时同一张图被反复塞进多个段落（封面已被 photoSet 的 exclude 挡在正文外，
   其余图也按上限克制取用，超出的段落自然退为纯文字 + 留白）。 */
function photoDowngrade(xf) {
  const n = (typeof activePhotos === "function") ? activePhotos(xf).length : (xf.photos || []).length;
  if (n <= 3) return { tier: "few", few: true, hint: "图片较少，已自动采用克制留白版式，部分段落以纯文字呈现。", reqCount: 3 };
  if (n < 9) return { tier: "mild", few: false, hint: "图片偏少，已精简配图、保留留白。", reqCount: 6 };
  return { tier: "full", few: false, hint: "", reqCount: 8 };
}
function gzhTextParas(html) {
  return (html || "").split(/\n+/).map((p) => p.trim()).filter(Boolean);
}
function gzhHighlight(html, a) {
  const p = typeProfile(a);
  // P0-14：高亮关键词只含「资料/类型确认」的字段，禁止凭类型推断注入未确认的具体景观(森林/溪流/山顶/篝火/星空…)
  const kw = [p.themeA, (a.place || ""), (a.type || ""), "露营", "徒步", "溯溪", "桨板", "漂流"].filter(Boolean);
  let out = html;
  for (const k of kw) {
    if (!k || k.length < 2) continue;
    out = out.split(k).join(`<span class="gzh-hl">${k}</span>`);
  }
  return out;
}

/* 山野日记型：大图叠标题、极简杂志长图 */
/* 结构级版式变体（第三维度，真正不同的 DOM 结构，而非仅 CSS）
 * variant 0 = 原生版式（各家族自带结构）
 * variant 1 = 舒展版：引文式大标题 + 全宽配图 + 居中窄栏正文
 * variant 2 = 紧致版：2 列网格，缩略图 + 紧凑文字
 */
function sectionsMarkup(variant, sections, secPhotos, parasFn) {
  if (!variant || variant === 0 || !sections || !sections.length) return null;
  if (variant === 1) {
    return sections.map((s, i) => {
      const ph = secPhotos[i] || null;
      return `<section class="gzh-sec gzh-sec-spread">
        <h2 class="gzh-sec-spread-h">${esc(s.h)}</h2>
        ${ph && ph.src ? `<div class="gzh-sec-spread-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(photoCaption(ph, ""))}</span></div>` : ""}
        <div class="gzh-sec-spread-body">${parasFn(s.html)}</div>
      </section>`;
    }).join("");
  }
  return `<div class="gzh-sec-grid">` + sections.map((s, i) => {
    const ph = secPhotos[i] || null;
    return `<div class="gzh-sec-cell">
      ${ph && ph.src ? `<div class="gzh-sec-cell-img" ${smartBg(ph.src)}></div>` : ""}
      <div class="gzh-sec-cell-body"><h3>${esc(s.h)}</h3>${parasFn(s.html)}</div>
    </div>`;
  }).join("") + `</div>`;
}



/* ---------- §图片规划（与文案/排版解耦）：封面排除出正文图池，降级档位决定配图数 ---------- */
function planWechatPhotos(xf, o) {
  const cover = gzhCover(xf);
  const coverSrc = cover.src || "";
  const dg = photoDowngrade(xf);
  const reqCount = (o.reqCount != null) ? o.reqCount
    : (dg.few ? dg.reqCount
      : (dg.tier === "mild" ? dg.reqCount
        : (o.sectionCount != null ? Math.max(o.sectionCount, dg.reqCount)
          : (o.baseReq != null ? o.baseReq : 8))));
  const secPhotos = photoSet(xf, o.cats, reqCount, coverSrc);
  const photos = o.catsWithCover ? photoSet(xf, o.catsWithCover, reqCount, coverSrc) : secPhotos;
  const hasPhotos = photos.length > 0 || !!cover.src;
  return { cover, coverSrc, dg, reqCount, secPhotos, photos, hasPhotos };
}

function renderDiaryPage(gzh, xf, isRecap) {
  const a = (state.activities || []).find((x) => x.id === xf.aid) || {};
  const m = xf.master || {};
  const f = m.confirmedFacts || {};
  const sectionCount = (gzh.sections || []).length || 4;
  const eb = eyebrow(a, m);
  const pill = brandPill(a);
  // P2-2 图片规划上移到 planWechatPhotos：封面排除出正文图池、降级档位决定配图数
  const pp = planWechatPhotos(xf, { cats: ["scenic", "people", "action", "detail", "cover", "team"], sectionCount });
  const cover = pp.cover;
  const coverSrc = pp.coverSrc;
  const secPhotos = pp.secPhotos;
  const hasPhotos = pp.hasPhotos;
  const parasFnDiary = (html) => gzhTextParas(html).map((p) => `<p>${gzhHighlight(p, a)}</p>`).join("");
  const vSec = (xf.variant >= 1) ? sectionsMarkup(xf.variant, gzh.sections, secPhotos, parasFnDiary) : null;
  let photoIdx = 0;

  // 标题拆分：活动名 + 主题，避免 hero 标题过长
  const titleParts = (gzh.title || "").split(/[｜|]/);
  const heroTitle = (titleParts[0] || gzh.title || f.activityName || "山野日记").trim();
  const heroSub = (titleParts[1] || gzh.subtitle || m.mainTheme || "").trim();
  const heroDate = f.date ? `${f.place || ""} · ${f.date}`.replace(/^ · /, "") : (f.place || "");

  const hero = cover.src
    ? `<div class="gzh-hero" ${smartBg(cover.src)}><div class="gzh-hero-mask"></div><div class="gzh-hero-txt"><div class="gzh-eyebrow">${esc(eb)}</div><h1 class="gzh-hero-title">${esc(heroTitle)}</h1>${heroSub ? `<div class="gzh-hero-sub">${esc(heroSub)}</div>` : ""}${heroDate ? `<div class="gzh-hero-pill">${esc(heroDate)}</div>` : `<div class="gzh-hero-pill">${esc(pill)}</div>`}</div></div>`
    : `<div class="gzh-hero gzh-hero-empty"><div class="gzh-hero-mask"></div><div class="gzh-hero-txt"><div class="gzh-eyebrow">${esc(eb)}</div><h1 class="gzh-hero-title">${esc(heroTitle)}</h1>${heroSub ? `<div class="gzh-hero-sub">${esc(heroSub)}</div>` : ""}${heroDate ? `<div class="gzh-hero-pill">${esc(heroDate)}</div>` : `<div class="gzh-hero-pill">${esc(pill)}</div>`}<div class="gzh-hero-upload-hint">📷 上传 1 张大图，这里会变成全幅封面</div></div></div>`;

  const lead = gzh.summary ? `<div class="gzh-lead"><p>${esc(gzh.summary)}</p></div>` : "";

  const nextPhoto = (layout) => {
    if (layout === "gzh-sec-quote") return null;
    return secPhotos[photoIdx++] || null;
  };

  const sections = (gzh.sections || []).map((s, i) => {
    const layoutClass = ["gzh-sec-full", "gzh-sec-split", "gzh-sec-quote", "gzh-sec-img"][i % 4];
    const ph = nextPhoto(layoutClass);
    const paras = gzhTextParas(s.html).map((p) => `<p>${gzhHighlight(p, a)}</p>`);
    if (layoutClass === "gzh-sec-quote") return renderComponent("PullQuote", { h: s.h, paras: paras });
    if (layoutClass === "gzh-sec-split" && ph && ph.src) return renderComponent("ImagePair", { h: s.h, paras: paras, ph: ph });
    if (layoutClass === "gzh-sec-img" && ph && ph.src) return `<section class="gzh-sec gzh-sec-img">${renderComponent("FullBleedImage", { ph: ph })}<div class="gzh-img-text"><h2>${esc(s.h)}</h2>${paras.join("")}</div></section>`;
    return `<section class="gzh-sec gzh-sec-full"><h2>${esc(s.h)}</h2>${paras.join("")}${ph && ph.src ? `<div class="gzh-sec-imgbox" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(photoCaption(ph, ""))}</span></div>` : ""}</section>`;
  }).join("");

  const infoBlock = (!isRecap && gzh.info && gzh.info.length)
    ? `<div class="gzh-info-grid">${renderComponent("InfoGrid", { rows: gzh.info })}</div>`
    : "";

  const feeBlock = (!isRecap && gzh.fee)
    ? `<div class="gzh-diary-block"><h2>费用说明</h2>${renderComponent("FeeBlock", { fee: gzh.fee, service: gzh.service })}</div>`
    : "";

  const uploadHint = !hasPhotos
    ? `<div class="gzh-upload-tip"><div class="gzh-upload-tip-ic">📷</div><div><b>这张图文还没有照片</b><p>在「添加图片 / 海报」处上传 3–6 张活动照片，系统会自动匹配到封面与各段落，排版会立刻更有杂志感。</p></div></div>`
    : "";

  const ctaText = gzh.cta || (isRecap && gzh.next) || "";
  const cta = ctaText ? renderComponent("EditorialCTA", { text: ctaText }) : "";

  return `<div class="gzh-article gzh-diary gzh-var-${xf.variant}"${wsIr(xf, isRecap)} id="gzhArticle" contenteditable="true" spellcheck="false">
    ${hero}
    ${lead}
    ${vSec != null ? vSec : sections}
    ${infoBlock}
    ${feeBlock}
    ${uploadHint}
    ${cta}
  </div>`;
}

/* 经典四版式：杂志/潮流/亲子/挑战 */
function renderClassicPage(gzh, xf, layout, isRecap) {
  const a = (state.activities || []).find((x) => x.id === xf.aid) || {};
  const m = xf.master || {};
  const f = m.confirmedFacts || {};
  const eb = eyebrow(a, m);
  // P2-2 图片规划上移到 planWechatPhotos
  const pp = planWechatPhotos(xf, { cats: ["scenic", "people", "action", "detail"], catsWithCover: ["scenic", "people", "action", "cover", "detail"], baseReq: 8 });
  const cover = pp.cover;
  const coverSrc = pp.coverSrc;
  const photos = pp.photos;
  const secPhotos = pp.secPhotos;
  const hasPhotos = pp.hasPhotos;
  const parasFn = (html) => gzhTextParas(html).map((p) => `<p>${gzhHighlight(p, a)}</p>`).join("");
  const vSec = (xf.variant >= 1) ? sectionsMarkup(xf.variant, gzh.sections, secPhotos, parasFn) : null;
  const infoBlock = (!isRecap && gzh.info && gzh.info.length)
    ? `<div class="gzh-info"><h2>活动信息</h2>${renderComponent("InfoTable", { rows: gzh.info })}</div>`
    : "";
  const feeBlock = (!isRecap && gzh.fee)
    ? `<div class="gzh-block"><h2>费用说明</h2>${renderComponent("FeeBlock", { fee: gzh.fee, service: gzh.service })}</div>`
    : "";
  const ctaText = gzh.cta || (isRecap && gzh.next) || "";
  const cta = ctaText ? renderComponent("EditorialCTA", { text: ctaText, cls: "gzh-cta" }) : "";
  const uploadHint = !hasPhotos
    ? `<div class="gzh-upload-tip"><div class="gzh-upload-tip-ic">📷</div><div><b>这张图文还没有照片</b><p>上传 3–6 张照片，各版式会自动匹配封面与段落配图。</p></div></div>`
    : "";

  if (layout === "youth") {
    const cards = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = gzhTextParas(s.html).map((p) => `<p>${gzhHighlight(p, a)}</p>`);
      return renderComponent("YouthCard", { h: s.h, paras: paras, ph: ph, i: i });
    }).join("");
    const tagList = tags(a).slice(0, 6);
    return `<div class="gzh-article gzh-youth gzh-var-${xf.variant}"${wsIr(xf, isRecap)} id="gzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-youth-hero">
        <div class="gzh-youth-eyebrow">${esc(eb)}</div>
        <h1 class="gzh-youth-title">${esc(gzh.title)}</h1>
        ${gzh.subtitle ? `<div class="gzh-youth-sub">${esc(gzh.subtitle)}</div>` : ""}
        ${cover.src ? `<div class="gzh-youth-cover" ${smartBg(cover.src)}></div>` : ""}
      </div>
      ${gzh.summary ? `<div class="gzh-youth-lead">${parasFn(gzh.summary)}</div>` : ""}
      <div class="gzh-youth-cards">${vSec != null ? vSec : cards}</div>
      <div class="gzh-youth-tags">${renderComponent("TagRow", { tags: tagList })}</div>
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  if (layout === "family") {
    const steps = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = gzhTextParas(s.html).map((p) => `<p>${gzhHighlight(p, a)}</p>`);
      return renderComponent("FamilyStep", { h: s.h, paras: paras, ph: ph, i: i });
    }).join("");
    return `<div class="gzh-article gzh-family gzh-var-${xf.variant}"${wsIr(xf, isRecap)} id="gzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-family-hero">
        <div class="gzh-family-cover" ${cover.src ? `${smartBg(cover.src)}` : ""}>
          <div class="gzh-family-cover-mask"></div>
          <div class="gzh-family-cover-txt">
            <div class="gzh-family-eyebrow">${esc(eb)}</div>
            <h1 class="gzh-family-title">${esc(gzh.title)}</h1>
          </div>
        </div>
        ${gzh.subtitle ? `<div class="gzh-family-sub">${esc(gzh.subtitle)}</div>` : ""}
      </div>
      ${gzh.summary ? `<div class="gzh-family-lead">${parasFn(gzh.summary)}</div>` : ""}
      <div class="gzh-family-steps">${vSec != null ? vSec : steps}</div>
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  if (layout === "challenge") {
    const kv = [
      { k: "距离", v: f.distance || "--" },
      { k: "爬升", v: f.elevation ? f.elevation + "m" : "--" },
      { k: "强度", v: f.difficulty || "--" },
      { k: "天数", v: (f.days || 1) + "天" },
    ];
    const kvHtml = renderComponent("MetricStrip", { kvs: kv });
    const sections = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = gzhTextParas(s.html).map((p) => `<p>${gzhHighlight(p, a)}</p>`);
      return renderComponent("ChallengeSec", { h: s.h, paras: paras, ph: ph, i: i });
    }).join("");
    return `<div class="gzh-article gzh-challenge gzh-var-${xf.variant}"${wsIr(xf, isRecap)} id="gzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-challenge-hero">
        <div class="gzh-challenge-eyebrow">${esc(eb)}</div>
        <h1 class="gzh-challenge-title">${esc(gzh.title)}</h1>
        ${gzh.subtitle ? `<div class="gzh-challenge-sub">${esc(gzh.subtitle)}</div>` : ""}
        <div class="gzh-challenge-kvs">${kvHtml}</div>
      </div>
      ${cover.src ? `<div class="gzh-challenge-cover" ${smartBg(cover.src)}></div>` : ""}
      ${gzh.summary ? `<div class="gzh-challenge-lead">${parasFn(gzh.summary)}</div>` : ""}
      ${vSec != null ? vSec : sections}
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  if (layout === "longform") {
    const metaPill = f.date ? `${f.place || ""} · ${f.date}`.replace(/^ · /, "") : (f.place || "");
    const kv = [
      { k: "天数", v: (f.days || 1) + "天" },
      { k: "距离", v: f.distance || "--" },
      { k: "爬升", v: f.elevation ? f.elevation + "m" : "--" },
      { k: "强度", v: f.difficulty || "--" },
    ];
    const kvHtml = renderComponent("MetricStrip", { kvs: kv });
    const sections = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = gzhTextParas(s.html).map((p) => `<p>${gzhHighlight(p, a)}</p>`);
      const align = i % 2 === 0 ? "left" : "right";
      return renderComponent("LongformSec", { h: s.h, paras: paras, ph: ph, i: i, align: align });
    }).join("");
    return `<div class="gzh-article gzh-longform gzh-var-${xf.variant}"${wsIr(xf, isRecap)} id="gzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-longform-hero">
        ${cover.src ? `<div class="gzh-longform-cover" ${smartBg(cover.src)}><div class="gzh-longform-cover-mask"></div></div>` : ""}
        <div class="gzh-longform-hero-txt">
          <div class="gzh-longform-eyebrow">${esc(eb)}</div>
          <h1 class="gzh-longform-title">${esc(gzh.title)}</h1>
          ${gzh.subtitle ? `<div class="gzh-longform-sub">${esc(gzh.subtitle)}</div>` : ""}
          ${metaPill ? `<div class="gzh-longform-pill">${esc(metaPill)}</div>` : ""}
        </div>
      </div>
      <div class="gzh-longform-kvs">${kvHtml}</div>
      ${gzh.summary ? `<div class="gzh-longform-lead">${parasFn(gzh.summary)}</div>` : ""}
      ${vSec != null ? vSec : sections}
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  // magazine 默认：户外杂志型
  const sections = (gzh.sections || []).map((s, i) => {
    const ph = secPhotos[i] || null;
    const paras = parasFn(s.html);
    const align = i % 2 === 0 ? "left" : "right";
    return `<section class="gzh-sec gzh-mag-sec gzh-mag-sec-${align}">
      <div class="gzh-mag-text">
        <div class="gzh-mag-sec-num">0${(i % 9) + 1}</div>
        <h2>${esc(s.h)}</h2>
        ${paras}
      </div>
      ${ph && ph.src ? `<div class="gzh-mag-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(photoCaption(ph, ""))}</span></div>` : ""}
    </section>`;
  }).join("");
  const gallery = photos.length > 1
    ? `<div class="gzh-gallery-classic"><h2>本期画面</h2>${renderComponent("GalleryGrid", { photos: photos.slice(0, 4) })}</div>`
    : "";
  return `<div class="gzh-article gzh-magazine gzh-var-${xf.variant}"${wsIr(xf, isRecap)} id="gzhArticle" contenteditable="true" spellcheck="false">
    <div class="gzh-cover" ${cover.src ? `${smartBg(cover.src)}` : ""}><div class="gzh-cover-mask"><div class="gzh-cover-cap">${esc(photoCaption(cover, "") ? "封面建议：" + photoCaption(cover, "") : (xf.photos && xf.photos.length ? "可换一张更具张力的大图作封面" : "未上传照片，建议补 1 张封面大图"))}</div></div></div>
    <div class="gzh-mag-head">
      <div class="gzh-mag-eyebrow">${esc(eb)}</div>
      <h1 class="gzh-title">${esc(gzh.title)}</h1>
      ${gzh.subtitle ? `<div class="gzh-sub">${esc(gzh.subtitle)}</div>` : ""}
    </div>
    ${gzh.summary ? `<div class="gzh-sum">${parasFn(gzh.summary)}</div>` : ""}
    ${vSec != null ? vSec : sections}
    ${infoBlock}
    ${feeBlock}
    ${gallery}
    ${uploadHint}
    ${cta}
  </div>`;
}

function xhsPanel(x) {
  const d = normalizeXhs(x);
  const orderLabel = { cover: "封面", scenic: "风景", people: "人物", action: "行进步", team: "团队", gear: "装备", meal: "餐食", camp: "营地", route: "路线", water: "亲水", detail: "细节" };
  const orderChips = (d.imageOrder && d.imageOrder.length)
    ? d.imageOrder.map((o) => `<span class="xf-tag xf-tag-soft">${esc(orderLabel[o] || o)}</span>`).join("")
    : "";
  return `<div class="xf-text-card">
    <div class="xf-field"><label>标题候选</label>${d.titles.map((t) => `<div class="xf-line">· ${esc(t)} <button class="copy-btn" data-action="copyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>
    <div class="xf-field"><label>正文</label><div class="xf-pre">${esc(d.body)}</div><button class="copy-btn" data-action="copyText" data-text="${esc(d.body)}">复制正文</button></div>
    <div class="xf-field"><label>封面短句</label><div class="xf-line">${esc(d.coverText)}</div></div>
    <div class="xf-field"><label>话题标签</label><div class="xf-tags">${d.hashtags.map((t) => `<span class="xf-tag">#${esc(t)}</span>`).join("")}</div></div>
    ${orderChips ? `<div class="xf-field"><label>建议配图顺序</label><div class="xf-tags">${orderChips}</div></div>` : ""}
  </div>`;
}
function momentsPanel(m) {
  const items = [["预热版", m.warm], ["正式招募版", m.formal], ["最后招募版", m.last]];
  return `<div class="xf-text-card">${items.map(([l, t]) => `<div class="xf-field"><label>${l}</label><div class="xf-pre">${esc(t)}</div><button class="copy-btn" data-action="copyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>`;
}
function wechatPanel(w) {
  const items = [["直接招募文案", w.recruit], ["简短报名说明", w.brief]];
  return `<div class="xf-text-card">${items.map(([l, t]) => `<div class="xf-field"><label>${l}</label><div class="xf-pre">${esc(t)}</div><button class="copy-btn" data-action="copyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>`;
}
function voicePanel(v) {
  const items = [["30 秒口播", v.s30], ["60 秒口播", v.s60]];
  return `<div class="xf-text-card">${items.map(([l, t]) => `<div class="xf-field"><label>${l}</label><div class="xf-pre">${esc(t)}</div><button class="copy-btn" data-action="copyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>`;
}
function posterPanel(p, xf) {
  const cover = (xf && xf.out && xf.out.gzh && xf.out.gzh.cover && xf.out.gzh.cover.src) ? xf.out.gzh.cover.src : (gzhCover(xf).src || "");
  const pill = (p.place && p.time) ? (p.place + " · " + p.time) : (p.time || p.place || "");
  const pts = (p.points && p.points.length) ? p.points : [p.sub].filter(Boolean);
  return `<div class="xf-poster">
    <div class="xf-poster-art" ${cover ? smartBg(cover) : ""}>
      <div class="xf-poster-art-mask"></div>
      <div class="xf-poster-art-txt">
        <div class="xf-poster-eyebrow">${esc(brandPill({}))}</div>
        <h2 class="xf-poster-title">${esc(p.title)}</h2>
        ${p.sub ? `<div class="xf-poster-sub">${esc(p.sub)}</div>` : ""}
        ${pill ? `<div class="xf-poster-pill">📍 ${esc(pill)}</div>` : ""}
      </div>
    </div>
    <div class="xf-poster-info">
      <ul class="xf-poster-pts">${pts.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="xf-poster-meta"><span>⏰ ${esc(p.time)}</span><span>💰 ${esc(p.price)}</span></div>
      <div class="xf-poster-cta">${esc(p.cta)}</div>
    </div>
    <button class="copy-btn" data-action="copyText" data-text="${esc(p.title + "｜" + p.sub + " " + pill + " " + p.price + " " + p.cta)}">复制文案</button>
  </div>`;
}

function recapResult() {
  const xf = publishState();
  const o = xf.recap;
  if (xf.genState === "loading") return `<div class="xf-loading">${ICON("sparkles")} 正在生成活动回顾…</div>`;
  return `
  <div class="xf-back"><button class="btn btn-ghost btn-sm" data-action="publishReset">${ICON("chevron-left")} 重新选择</button></div>
  <div class="xf-theme"><span class="xf-theme-lbl">本次活动回顾主题</span><b>${esc(xf.recapType)}</b></div>
  ${styleBar(xf)}
  ${platformTabs(xf.platTab, "recap")}
  <div class="xf-plat-body">
    ${xf.platTab === "gzh" ? recapGzhPanel(o.gzh, xf) : ""}
    ${xf.platTab === "xhs" ? xhsPanel(o.xhs) : ""}
    ${xf.platTab === "moments" ? `<div class="xf-text-card"><div class="xf-field"><label>朋友圈回顾</label><div class="xf-pre">${esc(o.moments)}</div><button class="copy-btn" data-action="copyText" data-text="${esc(o.moments)}">复制</button></div></div>` : ""}
    ${xf.platTab === "wechat" ? `<div class="xf-text-card"><div class="xf-field"><label>微信群感谢</label><div class="xf-pre">${esc(o.wechat)}</div><button class="copy-btn" data-action="copyText" data-text="${esc(o.wechat)}">复制</button></div></div>` : ""}
    ${xf.platTab === "voice" ? "" : ""}
    ${xf.platTab === "poster" ? `<div class="xf-text-card"><div class="xf-field"><label>下一期预告</label><div class="xf-pre">${esc(o.next)}</div><button class="copy-btn" data-action="copyText" data-text="${esc(o.next)}">复制</button></div></div>` : ""}
  </div>`;
}

function recapGzhPanel(gzh, xf) {
  const base = XF_FAMILY_LAYOUT[xf.family] || "diary";
  return `
  <div class="xf-gzh-head">
    <button class="btn btn-primary btn-sm" data-action="copyGzhHtml">${ICON("copy")} 复制公众号（HTML）</button>
  </div>
  ${base === "diary" ? renderDiaryPage(gzh, xf, true) : renderClassicPage(gzh, xf, base, true)}
  <p class="tiny muted">回顾正文可直接点击修改；禁止虚构现场细节，所有事实须来自上传资料。改完点「复制公众号（HTML）」。</p>`;
}

/* 持续运营（保留原有运营任务 + 老客户召回） */
function legacySection() {
  const tasks = buildActivityTasks();
  const customers = deriveCustomers();
  const inactive = customers.filter((c) => c.inactiveDays != null && c.inactiveDays >= 60);
  return `
  <details class="xf-legacy">
    <summary class="xf-legacy-sum">持续运营 · 单渠道快生 & 老客户召回</summary>
    <div class="xf-legacy-body">
      <div class="section-head" style="margin-top:0"><div class="section-title">活动运营任务</div><span class="muted small">${tasks.length} 项</span></div>
      ${tasks.length ? `<div class="op-tasks">${tasks.map((t) => `
        <div class="op-task">
          <div class="op-task-l"><span class="op-badge">${esc(t.badge)}</span><div><div class="op-task-title">${esc(t.a.title)}</div><div class="op-task-tip">${esc(t.tip)}</div></div></div>
          <div class="op-task-r"><button class="btn btn-primary btn-sm" data-action="fromTask" data-aid="${t.a.id}">${ICON("sparkles")} ${esc(t.btn)}</button></div>
          ${renderOpCopies(t.a.id)}
        </div>`).join("")}</div>` : `<div class="empty"><div class="e-ic">📣</div><div>当前没有进行中的活动任务。</div></div>`}
      <div class="section-head"><div class="section-title">老客户召回</div><span class="muted small">${inactive.length} 人 60 天未参加</span></div>
      <div class="recall-card">
        <div class="recall-segs">
          <button class="recall-seg" data-action="recallGen" data-seg="亲子"><b>${customers.filter((c) => c.tags.has("亲子客户")).length}</b><span>亲子客户</span><i>生成邀请</i></button>
          <button class="recall-seg" data-action="recallGen" data-seg="徒步"><b>${customers.filter((c) => c.tags.has("徒步客户")).length}</b><span>徒步客户</span><i>生成邀请</i></button>
          <button class="recall-seg" data-action="recallGen" data-seg="inactive60"><b>${inactive.length}</b><span>60天未参加</span><i>生成邀请</i></button>
        </div>
        ${state._recall ? `<div class="recall-out"><div class="recall-out-h">召回文案 · ${esc(state._recall.seg)}<button class="btn btn-ghost btn-xs" data-action="copyText" data-text="${esc(state._recall.text)}">${ICON("copy")} 复制</button></div><div class="recall-out-body">${esc(state._recall.text)}</div></div>` : ""}
      </div>
    </div>
  </details>`;
}
