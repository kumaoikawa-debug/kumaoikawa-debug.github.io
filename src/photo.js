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
function piTextTags(text) {
  const s = String(text || ""); const out = [];
  for (const m of PI_TEXT_TAG_KW) if (m[1].test(s)) out.push(m[0]);
  return out;
}
/* 图片语义键集合（14 类中文标签 → 英文键，并入主场景 scene） */
function piImageKeySet(p) {
  const tags = (p && p.tags) || [];
  const keys = tags.map((t) => PI_TAG_TO_SCENE[t]).filter(Boolean);
  if (p && p.scene && keys.indexOf(p.scene) < 0) keys.push(p.scene);
  return keys;
}
/* 片段（行程项 / 章节）期望语义 = 角色/类型默认表 ∪ 文本关键词提取；硬禁忌另列 */
function piSegTarget(roleOrKind, text, forbidMap, tagMap) {
  const base = (tagMap[roleOrKind] || ["scenic", "people", "detail"]).slice();
  const txt = piTextTags(text);
  const accept = base.slice();
  txt.forEach((t) => { if (accept.indexOf(t) < 0) accept.push(t); });
  const forbid = (forbidMap[roleOrKind] || []).slice();
  return { accept: accept, forbid: forbid, textTags: txt };
}
/* 单图对单片段的语义契合分：契合为正、禁忌为 -∞（绝不放入）、其余中性偏画质。
   textTags：该片段自身文本显式提到的语义（如行程 fact「合影拍照」→ group、章节标题「装备建议」→ gear），
   命中则额外加成——让「文字说合影」的段真正绑定合影图，而非被泛用段抢走。 */
function piSegScore(p, accept, forbid, dnaBonus, textTags) {
  const keys = piImageKeySet(p);
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
function piRoleBudget(n) {
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
   内容驱动：先按画质/场景/朝向排序，再依次领角色预算；重复图/低质量图已在 piSelect 阶段被剔除出使用池。 */
function piAssignAllRoles(analysis, selection) {
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
  const b = piRoleBudget(used.length);
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
function piImportanceOf(roles, imageId) {
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
/* P0-9：图片↔「内容章节」语义匹配（按 kind + 章节标题文本 + 活动DNA，逐段匹配） */
function piMatchSections(sections, used, roles, dna) {
  const avail = (used || []).slice();
  const dnaBonus = (dna && dna.coreMotivation && PI_DNA_BONUS[dna.coreMotivation]) ? PI_DNA_BONUS[dna.coreMotivation] : null;
  const taken = {};
  const heroPic = avail.find((p) => roles[p.imageId] === "HeroImage");
  const take = (kind, text, count) => {
    const { accept, forbid, textTags } = piSegTarget(kind, text, PI_KIND_FORBID, PI_KIND_TAGS);
    const cand = avail.filter((p) => !taken[p.imageId] && roles[p.imageId] !== "HeroImage")
      .map((p) => ({ p: p, s: piSegScore(p, accept, forbid, dnaBonus, textTags) }))
      .filter((x) => x.s > -Infinity)
      .sort((a, b) => b.s - a.s);
    const picks = cand.slice(0, count).map((x) => x.p);
    picks.forEach((p) => { taken[p.imageId] = true; });
    return picks;
  };
  return (sections || []).map((sec, idx) => {
    const kind = sec.kind || piKindFromText(typeof sec === "string" ? sec : (sec.h || ""));
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
function piMatchItinerary(timeline, used, roles, dna) {
  const items = (timeline || []).filter((t) => t && (t.time || t.fact || t.text));
  if (!items.length) return { byItem: [], byDay: {}, byRole: {}, note: "无行程可匹配" };
  const dnaBonus = (dna && dna.coreMotivation && PI_DNA_BONUS[dna.coreMotivation]) ? PI_DNA_BONUS[dna.coreMotivation] : null;
  const heroId = (roles && (function () { for (const k in roles) if (roles[k] === "HeroImage") return k; return null; })()) || null;
  const avail = (used || []).filter((p) => p.imageId !== heroId); // Hero 留给封面，不占行程段
  // 预计算每个段的期望语义与容量
  const segInfo = items.map((t) => {
    const role = t.contentRole || "core";
    const text = (t.time || "") + " " + (t.fact || t.text || "");
    const { accept, forbid, textTags } = piSegTarget(role, text, PI_ROLE_FORBID, PI_ROLE_TAGS);
    return { role: role, accept: accept, forbid: forbid, textTags: textTags, want: (role === "meal" || role === "rest" || role === "warmup") ? 1 : 2 };
  });
  // 每张图 → 其最优段（契合分最高；平分时偏向语义更具体的段）
  const imgBest = {};
  avail.forEach((p) => {
    let best = -1, bestScore = -Infinity, bestSpec = -1;
    segInfo.forEach((s, idx) => {
      const sc = piSegScore(p, s.accept, s.forbid, dnaBonus, s.textTags);
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
    const cands = segInfo.map((s, idx) => ({ idx: idx, sc: piSegScore(p, s.accept, s.forbid, dnaBonus, s.textTags) }))
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
function piLayoutIs(p, o) { return (p.orientation || "landscape") === o; }
function piLayoutPull(pool, pred, k) {
  const out = [];
  for (let i = pool.length - 1; i >= 0; i--) {
    if (pred(pool[i])) { out.push(pool[i]); pool.splice(i, 1); if (out.length >= k) break; }
  }
  return out;
}
// used：筛选后待展示图（analysis 对象，含 orientation/src/imageId）；total：原始上传张数（决定数量分级）
function piAdaptiveLayout(used, total) {
  const m = (used || []).slice();
  const n = total != null ? total : m.length;          // 数量分级按「原始上传张数」
  const land0 = m.filter((p) => piLayoutIs(p, "landscape")).length;
  const port0 = m.filter((p) => piLayoutIs(p, "portrait")).length;
  const sq0 = m.filter((p) => piLayoutIs(p, "square")).length;
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
  const isLand = (p) => piLayoutIs(p, "landscape");
  const isPort = (p) => piLayoutIs(p, "portrait");
  const isAny = () => true;
  const pairPattern = () => (dominant === "portrait" ? "PortraitPair" : "ImagePair");

  // 主图 / Hero：优先横图，否则任意
  const hero = piLayoutPull(m, isLand, 1);
  if (!hero.length) hero.push.apply(hero, piLayoutPull(m, isAny, 1));
  add("FullWidth", hero);

  if (tier === "few") {
    // 1-3 张：大图 + 留白；剩余按横竖走双图或原比例
    if (m.length >= 2) {
      const wantPort = dominant === "portrait" || port0 >= 2;
      const pair = wantPort ? piLayoutPull(m, isPort, 2) : piLayoutPull(m, isAny, 2);
      if (pair.length === 2) add(wantPort ? "PortraitPair" : "ImagePair", pair);
      else if (pair.length === 1) m.push(pair[0]);   // 不足一对则放回，走原比例
    }
    if (m.length === 1) add("AspectPreserved", piLayoutPull(m, isAny, 1));
    while (m.length >= 2) {                            // 零散余图按横竖补一对
      const pair = piLayoutPull(m, isPort, 2);
      if (pair.length === 2) add("PortraitPair", pair);
      else { if (pair.length) m.push(pair[0]); const pr = piLayoutPull(m, isAny, 2); if (pr.length < 2) { if (pr.length) m.push(pr[0]); break; } add(pairPattern(), pr); }
    }
    if (m.length === 1) add("AspectPreserved", piLayoutPull(m, isAny, 1));
  } else if (tier === "mid") {
    // 4-8 张：Hero + 双图/三图穿插；横图走 ImagePair、竖图走 PortraitPair、混合走 Mosaic
    while (m.length >= 2 && land0 >= 2) { const lp = piLayoutPull(m, isLand, 2); if (lp.length < 2) { if (lp.length) m.push(lp[0]); break; } add("ImagePair", lp); }
    while (m.length >= 2 && port0 >= 2) { const pp = piLayoutPull(m, isPort, 2); if (pp.length < 2) { if (pp.length) m.push(pp[0]); break; } add("PortraitPair", pp); }
    if (m.length >= 3) add("Mosaic", piLayoutPull(m, isAny, Math.min(4, m.length)));
    while (m.length >= 2) { const pr = piLayoutPull(m, isAny, 2); if (pr.length < 2) { if (pr.length) m.push(pr[0]); break; } add(pairPattern(), pr); }
    if (m.length === 1) add("AspectPreserved", piLayoutPull(m, isAny, 1));
  } else if (tier === "many") {
    // 9-20 张：分章节图文——大图 + 精选双图/拼贴 + 余图画廊横条
    // 预留 ≥4 张给章节画廊横条，避免被精选双图耗尽（用「实时剩余」而非固定总数做循环守卫）
    const reserve = 4;
    const room = () => m.length - reserve;
    while (room() >= 2 && m.filter(isLand).length >= 2) { const lp = piLayoutPull(m, isLand, 2); if (lp.length < 2) { if (lp.length) m.push(lp[0]); break; } add("ImagePair", lp); }
    while (room() >= 2 && m.filter(isPort).length >= 2) { const pp = piLayoutPull(m, isPort, 2); if (pp.length < 2) { if (pp.length) m.push(pp[0]); break; } add("PortraitPair", pp); }
    if (room() >= 3) add("Mosaic", piLayoutPull(m, isAny, Math.min(4, room())));   // 精选拼贴作章节点缀
    if (m.length >= 4) add("GalleryStrip", piLayoutPull(m, isAny, m.length));        // 余图统一横条浏览
    else if (m.length === 3) add("Mosaic", piLayoutPull(m, isAny, 3));
    else if (m.length === 2) { const pr = piLayoutPull(m, isAny, 2); if (pr.length === 2) add(pairPattern(), pr); else if (pr.length) m.push(pr[0]); }
    if (m.length === 1) add("AspectPreserved", piLayoutPull(m, isAny, 1));
  } else {
    // 20+ 张：先筛图再排版——画廊横条为主，拼贴点缀，少强裁
    if (m.length >= 4) add("GalleryStrip", piLayoutPull(m, isAny, m.length));
    else if (m.length >= 3) add("Mosaic", piLayoutPull(m, isAny, m.length));
    else if (m.length >= 2) { const pr = piLayoutPull(m, isAny, 2); if (pr.length === 2) add(pairPattern(), pr); else if (pr.length) m.push(pr[0]); }
    if (m.length === 1) add("AspectPreserved", piLayoutPull(m, isAny, 1));
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
function piLayoutHtml(plan) {
  if (!plan || !plan.components || !plan.components.length) return "";
  const roleClsOf = (src) => {
    if (typeof pagePhotoRole === "function") { const r = pagePhotoRole(src); if (r && PI_ROLES && PI_ROLES[r]) return PI_ROLES[r].cls; }
    return "";
  };
  const card = (p) => {
    const src = p.src || p;
    const risk = (typeof pagePhotoRisk === "function") ? pagePhotoRisk(src) : null;
    const rc = roleClsOf(src);
    const contain = risk === "high";
    const port = (p.orientation === "portrait") ? " portrait" : "";
    return `<div class="ph ${rc}${contain ? " ph-safe" : ""}${port}"><img class="ph-img" data-smart-img src="${esc(src)}" alt="" style="object-fit:${contain ? "contain" : "cover"}"></div>`;
  };
  const blocks = plan.components.map((c) => `<div class="ly ly-${c.pattern}">${c.photos.map(card).join("")}</div>`).join("");
  return `<div class="photo-layout" data-tier="${plan.tier}" data-mode="${plan.mode}" data-patterns="${plan.patterns.join(",")}">${blocks}</div>`;
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
  const roleInfo = piAssignAllRoles(analysis, selection);
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
  const layout = piAdaptiveLayout(used, (photos || []).length);   // total=原始上传张数，决定数量分级（20+ 触发 curated）
  const dna = (a && a.activityDNA) || null;
  const matched = sections && sections.length ? piMatchSections(sections, used, roleInfo.roles, dna) : [];
  const itin = (a && typeof structureItinerary === "function") ? structureItinerary(a) : null;
  const matchedItinerary = (itin && itin.timeline && itin.timeline.length) ? piMatchItinerary(itin.timeline, used, roleInfo.roles, dna) : null;
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
    importanceOf: (imageId) => piImportanceOf(roleInfo.roles, imageId),
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
