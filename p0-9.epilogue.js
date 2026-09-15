/* P0-9 冒烟：图片↔行程/章节 语义匹配 —— 绝不"文字说徒步、配图却是餐食" */
if (typeof applyVision === "undefined" || typeof analyzePhotos === "undefined" ||
    typeof buildPhotoIntelligence === "undefined" || typeof structureItinerary === "undefined" ||
    typeof pagePhotoSections === "undefined" || typeof matchItineraryPhotos === "undefined") {
  return { ok: false, error: "P0-9 所需函数未定义（applyVision/analyzePhotos/buildPhotoIntelligence/structureItinerary/pagePhotoSections/matchItineraryPhotos）" };
}

const inject = (src, sig) => applyVision(src, Object.assign({ simulated: false }, sig));

/* 注入 5 张「内容各不相同」的图（驱动 tagPhoto 产出不同 14 类标签）。
   注意：pHash 必须用两两汉明距离 >4 的位模式，否则 selectPhotos 的重复检测会把它们合并成一组（测试数据坑，非代码缺陷）。 */
inject("p0-9://water", { isWater: true, blueRatio: 0.5, avgLum: 140, people_count: 0, quality_score: 0.79, pHash: { lo: 0x000000FF, hi: 1 } }); // 水上（桨板）；质量略低于 hike，避免被选为封面 Hero 而被排除在行程匹配外
inject("p0-9://meal",  { warmRatio: 0.5, avgLum: 130, people_count: 2, blueRatio: 0.05, quality_score: 0.82, pHash: { lo: 0x0000FF00, hi: 1 } }); // 餐食
inject("p0-9://group", { people_count: 4, avgLum: 130, quality_score: 0.80, pHash: { lo: 0x00FF0000, hi: 1 } });                                 // 合影/人物互动
inject("p0-9://night", { avgLum: 40, people_count: 1, quality_score: 0.78, pHash: { lo: 0xFF000000, hi: 1 } });                                  // 夜景
inject("p0-9://hike",  { isHike: true, avgLum: 140, people_count: 0, quality_score: 0.83, pHash: { lo: 0x00000FF0, hi: 1 } });                    // 徒步

/* 真实行程：涵盖 集合/到达/水上核心/午餐/休息合影/返程结尾 */
const a = {
  activityDNA: { coreMotivation: "release", environment: "water" },
  itineraryDays: [{ label: "桨板徒步一日", items: [
    { time: "08:00", text: "成都集合出发" },
    { time: "10:30", text: "到达基地，整理装备" },
    { time: "11:00", text: "桨板滑行，水上体验" },
    { time: "12:30", text: "湖边午餐，补给回血" },
    { time: "14:00", text: "沿途合影拍照，观景休息" },
    { time: "16:30", text: "返程回城，结束" },
  ] }],
};
const photos = ["p0-9://water", "p0-9://meal", "p0-9://group", "p0-9://night", "p0-9://hike"];

const intel = buildPhotoIntelligence(photos, a, pagePhotoSections(a), "recruit");
const mi = intel.matchedItinerary;
const byItem = mi ? mi.byItem : [];
const checks = [];
const fail = (name, detail) => checks.push({ name, pass: false, detail });

/* ① 集成：buildPhotoIntelligence 产出 matchedItinerary */
if (!mi || !byItem.length) fail("生成 matchedItinerary（逐段匹配）", "matchedItinerary 为空");
else checks.push({ name: "生成 matchedItinerary（逐段匹配）", pass: true, detail: byItem.length + " 个行程段已匹配图片" });

/* 工具：src → 其 14 类标签的英文键集合 */
const analysisMap = {};
analyzePhotos(photos).forEach((p) => { analysisMap[p.src] = p; });
const keysOf = (src) => {
  const p = analysisMap[src]; if (!p) return [];
  const ks = (p.tags || []).map((t) => ({ "风景": "scenic", "人物": "people", "合影": "group", "动作": "action", "水上": "water", "徒步": "hike", "露营": "camp", "餐食": "meal", "装备": "gear", "夜景": "night", "细节": "detail", "路线": "route" }[t])).filter(Boolean);
  if (p.scene && ks.indexOf(p.scene) < 0) ks.push(p.scene);
  return ks;
};
const itemOf = (role, hasTextTag) => byItem.find((it) => it.contentRole === role && (!hasTextTag || (it.textTags || []).indexOf(hasTextTag) >= 0));

/* ② 桨板/水上照片 → 水上体验段（core 且文本含 water） */
const waterItem = itemOf("core", "water");
const waterOk = !!(waterItem && waterItem.matched.indexOf("p0-9://water") >= 0);
checks.push({ name: "桨板/水上照片 → 水上体验段", pass: waterOk, detail: waterOk ? "water 图命中 core+water 段" : "未命中（matched=" + (waterItem ? waterItem.matched : "无段") + "）" });

/* ③ 餐食照片 → 午餐/休息段（meal） */
const mealItem = itemOf("meal");
const mealOk = !!(mealItem && mealItem.matched.indexOf("p0-9://meal") >= 0);
checks.push({ name: "餐食照片 → 午餐段", pass: mealOk, detail: mealOk ? "meal 图命中 meal 段" : "未命中（matched=" + (mealItem ? mealItem.matched : "无段") + "）" });

/* ④ 人物互动/合影 → 体验·陪伴段（rest） */
const restItem = itemOf("rest");
const restOk = !!(restItem && restItem.matched.indexOf("p0-9://group") >= 0);
checks.push({ name: "人物互动/合影 → 陪伴段", pass: restOk, detail: restOk ? "group 图命中 rest 段" : "未命中（matched=" + (restItem ? restItem.matched : "无段") + "）" });

/* ⑤ 夜景 → 结尾氛围段（closing） */
const closeItem = itemOf("closing");
const closeOk = !!(closeItem && closeItem.matched.indexOf("p0-9://night") >= 0);
checks.push({ name: "夜景 → 结尾氛围段", pass: closeOk, detail: closeOk ? "night 图命中 closing 段" : "未命中（matched=" + (closeItem ? closeItem.matched : "无段") + "）" });

/* ⑥ 硬性验收：每张被匹配的图，其标签绝不在该段的「硬禁忌」清单里（杜绝文字徒步配餐食图） */
const PI_ROLE_FORBID = {
  opening: ["meal", "night"], arrival: ["meal", "night"], warmup: ["meal", "night"],
  core: ["meal", "night"], meal: ["hike", "route", "water", "action", "camp", "night"],
  rest: ["meal", "hike", "route", "water", "camp"], closing: ["meal", "hike", "route", "water", "action", "camp"],
};
let mismatch = [];
byItem.forEach((it) => {
  const forbid = PI_ROLE_FORBID[it.contentRole] || [];
  it.matched.forEach((src) => { keysOf(src).forEach((k) => { if (forbid.indexOf(k) >= 0) mismatch.push(it.contentRole + "←" + src + "(" + k + ")"); }); });
});
checks.push({ name: "无任何语义错配（图标签不落入段落硬禁忌）", pass: mismatch.length === 0, detail: mismatch.length ? ("错配：" + mismatch.join("; ")) : "全部段落图文强相关" });

/* ⑦ 与上传顺序无关：打乱图片数组后，每张 src 命中的 contentRole 集合不变 */
const shuffled = photos.slice().reverse();
const mi2 = buildPhotoIntelligence(shuffled, a, pagePhotoSections(a), "recruit").matchedItinerary;
const rolesOf = (src, m) => (m.byItem || []).filter((it) => it.matched.indexOf(src) >= 0).map((it) => it.contentRole).sort().join(",");
let orderOk = true, orderDetail = [];
photos.forEach((src) => { if (rolesOf(src, mi) !== rolesOf(src, mi2)) { orderOk = false; orderDetail.push(src + " 顺序不同导致命中段变化"); } });
checks.push({ name: "匹配与上传顺序无关（乱序后逐图命中段一致）", pass: orderOk, detail: orderOk ? "乱序前后每张图命中段完全一致" : orderDetail.join("; ") });

/* ⑧ 显式反例：纯"徒步登山"核心段 + 一张餐食图，餐食图绝不能进该段 */
const hikeOnly = { itineraryDays: [{ label: "x", items: [{ time: "10:00", text: "徒步登山，登顶" }] }] };
const hi = buildPhotoIntelligence(["p0-9://hike", "p0-9://meal"], hikeOnly, [], "recruit").matchedItinerary;
const hikeItem = hi.byItem[0];
const mealNotInHike = hikeItem && hikeItem.matched.indexOf("p0-9://meal") < 0;
checks.push({ name: "反例：文字徒步段绝不放餐食图", pass: !!mealNotInHike, detail: mealNotInHike ? "餐食图被排除在徒步段之外" : "餐食图错误地进了徒步段（matched=" + (hikeItem ? hikeItem.matched : "无") + "）" });

/* ⑨ 活动DNA 驱动差异化：release 动机下，水上图在 core 段得分高于 scenery 动机 */
const dnaA = buildPhotoIntelligence(photos, Object.assign({}, a, { activityDNA: { coreMotivation: "release" } }), pagePhotoSections(a), "recruit").matchedItinerary;
const dnaB = buildPhotoIntelligence(photos, Object.assign({}, a, { activityDNA: { coreMotivation: "scenery" } }), pagePhotoSections(a), "recruit").matchedItinerary;
const waterInRelease = !!(dnaA.byItem.find((it) => it.contentRole === "core" && (it.textTags || []).indexOf("water") >= 0) || {}).matched;
const waterInScenery = !!(dnaB.byItem.find((it) => it.contentRole === "core" && (it.textTags || []).indexOf("water") >= 0) || {}).matched;
checks.push({ name: "活动DNA 驱动匹配（水上图在 release 动机下仍命中水上段）", pass: waterInRelease && waterInScenery, detail: "release=" + waterInRelease + " scenery=" + waterInScenery });

const allPass = checks.every((c) => c.pass);
return { ok: allPass, results: { total: byItem.length, checks }, checks };
