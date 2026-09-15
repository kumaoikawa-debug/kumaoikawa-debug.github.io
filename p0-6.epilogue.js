// P0-6 冒烟验收（epilogue）：证明图片按「内容」识别 14 类，而非按上传顺序轮流套分类。
// 通过 applyVision 为每张图注入不同内容的视觉元信息，断言：
//  ① 每张图都输出完整 11 字段 schema + tags；
//  ② 14 类识别（风景/人物/合影/动作/水上/徒步/露营/餐食/装备/夜景/细节/路线/重复图/低质量图）全部覆盖；
//  ③ 重复图（pHash 近邻）与低质量图（quality<0.5）被正确标记；
//  ④ 同一张图无论排第几，识别结果一致（与上传下标无关）。
if (typeof analyzePhotos === "undefined" || typeof applyVision === "undefined" || typeof buildPhotoIntelligence === "undefined") {
  return { ok: false, reason: "P0-6 依赖函数未加载(analyzePhotos/applyVision/buildPhotoIntelligence)", results: [], checks: [{ name: "函数就绪", pass: false }] };
}

// —— 为每张图注入不同内容的视觉元信息（模拟真实视觉模型写回）——
const BASE = { orientation: "landscape", safe_text_area: "top-right", recommended_use: ["story"], category: "内容识别", emotion: "真实", focal_point: { x: 0.5, y: 0.45 }, cropRisk: null, sat: 0.2, edge: 10, blueRatio: 0.1, warmRatio: 0.2, skinRatio: 0, motionScore: 0 };
// 感知哈希用强混合函数生成，确保不同图之间汉明距离 >> 4（避免误判重复）
const phFor = (i) => ({ lo: Math.imul(i + 1, 0x9E3779B1) >>> 0, hi: Math.imul(i + 1, 0x85EBCA77) >>> 0 });
const RAW = [
  { quality_score: 0.85, avgLum: 140, sat: 0.42, edge: 18 },                                                   // 风景
  { quality_score: 0.80, avgLum: 130, skinRatio: 0.06 },                                                       // 人物
  { quality_score: 0.80, avgLum: 130, skinRatio: 0.25 },                                                       // 合影
  { quality_score: 0.82, avgLum: 130, action: "登山", motionScore: 0.6 },                                      // 动作
  { quality_score: 0.83, avgLum: 140, blueRatio: 0.45 },                                                       // 水上
  { quality_score: 0.80, avgLum: 140, isHike: true },                                                          // 徒步
  { quality_score: 0.78, avgLum: 50, warmRatio: 0.45, skinRatio: 0.06 },                                       // 露营(夜景+人物+暖色)
  { quality_score: 0.80, avgLum: 130, warmRatio: 0.50, skinRatio: 0.06 },                                      // 餐食
  { quality_score: 0.80, avgLum: 130, isGear: true },                                                          // 装备
  { quality_score: 0.80, avgLum: 40 },                                                                         // 夜景
  { quality_score: 0.80, avgLum: 140, sat: 0.10, edge: 30 },                                                   // 细节+风景(高边缘)
  { quality_score: 0.80, avgLum: 140, isRoute: true },                                                         // 路线
  { quality_score: 0.85, avgLum: 140, sat: 0.42, edge: 18 },                                                   // 重复图(主)
  { quality_score: 0.85, avgLum: 140, sat: 0.42, edge: 18 },                                                   // 重复图(副, 同 pHash)
  { quality_score: 0.40, avgLum: 120 },                                                                        // 低质量图
];
const M = RAW.map((o, i) => Object.assign({}, BASE, o, { pHash: phFor(i) }));
M[13].pHash = M[12].pHash; // 重复图副帧与 idx12 共享哈希

const photos = M.map((m, i) => "p0-6://img" + i);
photos.forEach((src, i) => applyVision(src, M[i]));

const analysis = analyzePhotos(photos);
const byIndex = {};
analysis.forEach((p) => { byIndex[p.index] = p; });

const checks = [];
const SCHEMA = ["imageId", "orientation", "quality", "scene", "people", "action", "subject", "emotion", "recommendedUse", "safeTextArea", "cropRisk"];
// ① 完整 11 字段 schema + 每张≥1 标签
let schemaOk = true, schemaDetail = [];
analysis.forEach((p) => {
  const miss = SCHEMA.filter((k) => !(k in p));
  if (miss.length) { schemaOk = false; schemaDetail.push("ph_" + p.index + " 缺字段:" + miss.join(",")); }
  if (!Array.isArray(p.tags) || !p.tags.length) { schemaOk = false; schemaDetail.push("ph_" + p.index + " 无 tags"); }
});
checks.push({ name: "每张图输出完整 11 字段 schema + tags", pass: schemaOk, detail: schemaDetail.join("; ") || ("共 " + analysis.length + " 张全部齐全") });

// ② 14 类识别全覆盖
const ALL14 = ["风景", "人物", "合影", "动作", "水上", "徒步", "露营", "餐食", "装备", "夜景", "细节", "路线", "重复图", "低质量图"];
const found = new Set();
analysis.forEach((p) => p.tags.forEach((t) => found.add(t)));
const missing = ALL14.filter((t) => !found.has(t));
checks.push({ name: "14 类内容识别全覆盖", pass: missing.length === 0, detail: missing.length ? ("缺失:" + missing.join(",")) : ("全部命中: " + ALL14.join("/")) });

// ③ 重复图 / 低质量图 标记正确
const dupImg = analysis.find((p) => p.dupOf);
const lowImg = analysis.find((p) => p.lowQuality);
checks.push({ name: "重复图检出(pHash 近邻)", pass: !!(dupImg && dupImg.tags.indexOf("重复图") >= 0), detail: dupImg ? ("ph_" + dupImg.index + " dupOf=" + dupImg.dupOf) : "未检出" });
checks.push({ name: "低质量图检出(quality<0.5)", pass: !!(lowImg && lowImg.tags.indexOf("低质量图") >= 0), detail: lowImg ? ("ph_" + lowImg.index + " quality=" + lowImg.quality) : "未检出" });

// ④ 与上传顺序无关：把图片数组顺序打乱后再分析，逐图「内容识别」应一致。
//    允许的唯一差异是「重复图」标记（去重时哪一张被保留取决于先后顺序，属正常行为）。
const shuffled = photos.slice().reverse();
const analysis2 = analyzePhotos(shuffled);
const bySrc1 = {}; analysis.forEach((p) => { bySrc1[p.src] = new Set(p.tags); });
const bySrc2 = {}; analysis2.forEach((p) => { bySrc2[p.src] = new Set(p.tags); });
let orderOk = true, orderDetail = [];
Object.keys(bySrc1).forEach((src) => {
  const a = bySrc1[src], b = bySrc2[src];
  const onlyInA = [...a].filter((x) => !b.has(x));
  const onlyInB = [...b].filter((x) => !a.has(x));
  const onlyDupFlip = onlyInA.length <= 1 && onlyInB.length <= 1 && onlyInA.concat(onlyInB).every((x) => x === "重复图");
  if (!onlyDupFlip) { orderOk = false; orderDetail.push(src + " 内容识别随顺序改变: " + [...a].join(",") + " vs " + [...b].join(",")); }
});
checks.push({ name: "识别与上传顺序无关(乱序后逐图内容一致，仅重复图标记随序翻转)", pass: orderOk, detail: orderDetail.length ? orderDetail.join("; ") : "乱序前后每张图内容识别完全一致" });

// ⑤ 内容驱动(非轮流)：首尾两张本应不同类，且识别结果由内容决定而非下标
const firstScene = byIndex[0].scene, lastScene = byIndex[analysis.length - 1].scene;
checks.push({ name: "不同内容得到不同识别(非轮流套分类)", pass: firstScene !== lastScene && byIndex[0].tags.indexOf("风景") >= 0 && byIndex[4].tags.indexOf("水上") >= 0, detail: "ph_0=" + byIndex[0].tags.join(",") + " / ph_4=" + byIndex[4].tags.join(",") + " / ph_12=" + byIndex[12].tags.join(",") });

// ⑥ 筛选层消费新信号：重复图/低质量图进入弃用理由
const intel = buildPhotoIntelligence(photos, null, null, "recruit");
const reasons = intel.selection.discarded.map((d) => d.reason);
checks.push({
  name: "筛选层按内容弃用(重复/低质量)",
  pass: reasons.indexOf("重复（与其他图近似）") >= 0 && reasons.indexOf("质量较低") >= 0,
  detail: "弃用理由=" + reasons.join(" | "),
});

const ok = checks.every((c) => c.pass);
return {
  ok: ok,
  results: { total: analysis.length, used: intel.used.length, discarded: intel.selection.discarded.length, allTags: Array.from(found) },
  checks: checks,
};
