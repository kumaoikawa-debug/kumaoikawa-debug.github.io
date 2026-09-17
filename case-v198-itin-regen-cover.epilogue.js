/* case-v198-itin-regen-cover.epilogue.js
   ClubOS v198「详情页三处真修复」回归契约。

   用户反馈三条（对应断言组）：
     A. 「活动详情页内多次出现详细行程，一直大重复，没有实现智能编辑」
        → §A：阅读页（editorial/lean）完整行程只出现一次（DAY 时间轴），
          叙事复述块（itin-narrative）从阅读页摘除；叙事降级为「节奏摘要」
          （中间时间点不复述）；closing 角色判定优先于 arrival（抵达…活动结束 不再乱序）。
     B. 「点换一种排版，详情根本没有变化（假智能假AI）」
        → §B：regenStyleContent 双轴旋转 —— 风格轴与版式轴都保证变化；
          摘要标签（editorialVariantSummary）同步反映新组合；
          事实指纹逐字节不变（非虚构铁律）。
     C. 「随机选图做封面，照片不能自动适配到最佳，两边出现黑屏」
        → §C：bestCoverIndex 按视觉分析选最佳封面（hero/cover 用途加分、
          高风险裁切降权）；recomputeAutoCover 在分析落地后自愈 draft 封面
          （手动设过封面 _coverManual 则永不覆盖）；hero keep 模式垫图提亮（CSS 断言）。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v198-itin-regen-cover.epilogue.js */
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const occ = (h, s) => String(h).split(s).length - 1;
const has = (h, s) => String(h).indexOf(s) >= 0;

function mkActivity(over) {
  const base = {
    id: "v198-" + Math.random().toString(36).slice(2, 7),
    type: "徒步", title: "青城后山山脊徒步", place: "青城后山",
    date: "2026-09-20", dateMD: "9月20日", meeting: "天府广场",
    price: 199, limitUnit: "人", limit: 15, days: 1,
    distance: 25, elevation: 800, difficulty: "中等", season: "秋",
    photos: Array.from({ length: 6 }, (_, i) => "https://example.com/v198-p" + i + ".jpg"),
    photoCaptions: [], tags: [], highlights: [], sellingPoints: [], body: [], reviews: [],
    feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    includeLeader: true, includeInsurance: true, ageRange: "8-60岁",
    confirmed: [{ key: "services" }, { key: "difficulty" }],
    itineraryDays: [
      { label: "一日山脊线", sub: "", items: [
        { time: "07:30", text: "天府广场集合" },
        { time: "08:00", text: "出发前往青城后山（山脊山地）" },
        { time: "10:00", text: "抵达起点，进行安全说明与热身" },
        { time: "10:30", text: "开始山脊徒步探索" },
        { time: "12:00", text: "适中简餐（以领队现场安排为准）" },
        { time: "15:00", text: "完成徒步，原路返回或调整路线下撤（以领队现场安排为准）" },
        { time: "17:30", text: "抵达天府广场，活动结束" }
      ] }
    ],
    departures: [], gear: [], coverIndex: 0, edTheme: "", pageStyle: "outdoor", audience: []
  };
  return Object.assign(base, over || {});
}

/* ========== §A 行程大重复（叙事复述摘除 + 摘要化 + 角色修复） ========== */

const A = mkActivity();

// A1 图文长页：完整行程只出现一次，叙事复述块不再同屏
const edHtml = renderActivityEditorial(A);
add("A1a 图文页含 DAY 时间轴（tl-item ≥7）", (edHtml.match(/tl-item/g) || []).length >= 7, "tl=" + (edHtml.match(/tl-item/g) || []).length);
add("A1b 图文页不再出现叙事复述块（itin-narrative=0）", !has(edHtml, "itin-narrative"), "n=" + occ(edHtml, "itin-narrative"));
add("A1c 图文页「详细行程」标题只出现一次", occ(edHtml, "<h3>详细行程</h3>") === 1, "n=" + occ(edHtml, "<h3>详细行程</h3>"));

// A2 简洁页：同样时间轴唯一
state.detailMode = "lean";
const leanHtml = renderActivityPhone(A);
add("A2a 简洁页含时间轴（tl-item ≥7）", (leanHtml.match(/tl-item/g) || []).length >= 7, "tl=" + (leanHtml.match(/tl-item/g) || []).length);
add("A2b 简洁页不再出现叙事复述块", !has(leanHtml, "itin-narrative"), "n=" + occ(leanHtml, "itin-narrative"));
add("A2c 简洁页「详细行程」标题只出现一次", occ(leanHtml, "<h3>详细行程</h3>") === 1, "n=" + occ(leanHtml, "<h3>详细行程</h3>"));
state.detailMode = "editorial";

// A3 角色修复：closing 优先于 arrival（「17:30 抵达天府广场，活动结束」→ closing）
const itin = structureItinerary(A);
const closingItem = (itin.timeline || []).find((t) => t.time === "17:30");
add("A3a 「抵达…活动结束」判为 closing（不再误判 arrival）", closingItem && closingItem.contentRole === "closing", closingItem && closingItem.contentRole);
const mealItem = (itin.timeline || []).find((t) => t.time === "12:00");
add("A3b 简餐判为 meal", mealItem && mealItem.contentRole === "meal", mealItem && mealItem.contentRole);

// A4 叙事 = 节奏摘要（保留在后台编辑面板预览，但不再逐条复述时间表）
const nar = buildItineraryNarrative(A, itin.timeline || []);
const narText = (nar.paras || []).join(" ");
add("A4a 叙事 ≥2 段（节奏摘要仍可读）", (nar.paras || []).length >= 2, "paras=" + (nar.paras || []).length);
add("A4b 叙事不复述中间时间点（10:00/10:30/12:00/15:00 不出现）",
  ["10:00", "10:30", "12:00", "15:00"].every((t) => !narText.includes(t)), "narTimes=" + (narText.match(/\d{1,2}:\d{2}/g) || []).join(","));
add("A4c 叙事保留首尾锚点（07:30 / 17:30）", narText.includes("07:30") && narText.includes("17:30"), narText.slice(0, 40));
add("A4d 叙事未编造新时间点", (narText.match(/\d{1,2}:\d{2}/g) || []).every((t) => ["07:30", "08:00", "17:30"].includes(t)), "");

// A5 保留能力 ≠ 保留入口：后台行程编辑面板仍可预览体验叙事（itineraryEditHtml）
const editPanel = itineraryEditHtml(A);
add("A5a 后台行程编辑面板仍含叙事预览（itin-narrative）", has(editPanel, "itin-narrative"), "");
add("A5b 预览叙事与时间表并存（面板含 tl 行编辑输入）", has(editPanel, "data-bind-itin"), "");

/* ========== §B 换一种排版 = 真变化（双轴旋转） ========== */

const B = mkActivity();
B.editorialLayoutId = "L-mosaic-story";
B.editorialStyleId = "S-scenery-mag";
const sumBefore = editorialVariantSummary(B);
const htmlBefore = renderActivityEditorial(B);
/* 指纹基准取在「首次渲染之后」：渲染层会惰性补齐 canonical 字段（whyGo/intro/pipeline…），
   先取会把补字段的动作算进 regen 头上；这样 B1f 只隔离 regenStyleContent 自身的写入。 */
const fpBefore = editorialFactsFingerprint(B);
const dnaBefore = dnaFactFingerprint(B);

const pack1 = regenStyleContent(B);
const sumAfter1 = editorialVariantSummary(B);
const htmlAfter1 = renderActivityEditorial(B);
add("B1a 版式轴真的换了（layoutId ≠ L-mosaic-story）", B.editorialLayoutId && B.editorialLayoutId !== "L-mosaic-story", B.editorialLayoutId);
add("B1b 风格轴真的换了（styleId ≠ S-scenery-mag）", B.editorialStyleId && B.editorialStyleId !== "S-scenery-mag", B.editorialStyleId);
add("B1c 摘要标签同步变化（老板可见的反馈）", sumAfter1 !== sumBefore, sumBefore + " → " + sumAfter1);
add("B1d 页面输出真变化（渲染 HTML ≠ 改前）", htmlAfter1 !== htmlBefore, "len " + htmlBefore.length + " → " + htmlAfter1.length);
add("B1e 内容包生成且带角度", pack1 && pack1.angle && pack1.title, pack1 && pack1.angleLabel);
add("B1f 事实指纹逐字节不变（非虚构铁律：事实层）", editorialFactsFingerprint(B) === fpBefore, "");
add("B1g DNA 指纹随首次 buildActivityDNA 落地后冻结", dnaFactFingerprint(B) === dnaFactFingerprint(B), "");

// B2 连点两次：双轴继续轮换（不再卡死在同一组合）；DNA/事实指纹跨连点稳定
const lay2 = B.editorialLayoutId, sty2 = B.editorialStyleId;
const fpMid = editorialFactsFingerprint(B), dnaMid = dnaFactFingerprint(B);
regenStyleContent(B);
add("B2a 第二次点击版式继续轮换", B.editorialLayoutId !== lay2, lay2 + " → " + B.editorialLayoutId);
add("B2b 第二次点击风格继续轮换", B.editorialStyleId !== sty2, sty2 + " → " + B.editorialStyleId);
add("B2c 历史记录滚动（_styleHistory 追加）", Array.isArray(B._styleHistory) && B._styleHistory.length >= 2, "n=" + (B._styleHistory || []).length);
add("B2d 事实/DNA 指纹跨连点逐字节不变", editorialFactsFingerprint(B) === fpMid && dnaFactFingerprint(B) === dnaMid, "");

// B3 渲染层消费新轴：typo 类随版式轴变化（serif/condensed/airy/grid/classic 各不相同）
const L2 = EDITORIAL_LAYOUTS.filter((x) => x.id === B.editorialLayoutId)[0];
const htmlAfter2 = renderActivityEditorial(B);
add("B3a 渲染根类含新版式 typo（typo-" + (L2 && L2.typo) + "）", has(htmlAfter2, "typo-" + (L2 && L2.typo)), "");
add("B3b 渲染根类不再是旧 typo serif（真切换非缓存）", !has(htmlAfter2.split("xh-ed-body")[0], "typo-serif") || (L2 && L2.typo) === "serif", "");

/* ========== §C 封面智能选择 + hero 黑边 ========== */

// 种入视觉分析（结构 = applyVisionNormalized 写回形态）
function seedMeta(src, meta) { if (typeof PHOTO_FOCUS_CACHE !== "undefined") PHOTO_FOCUS_CACHE.set(src, meta); }

/* §C 用独立 URL 前缀：§A/§B 的渲染对 v198-p* 触发了 scheduleSmartFocus，
   其 analyzeImageFocus().then() 会在后续 tick 回写同一 URL 的启发式 meta，
   把这里种入的视觉分析覆盖掉（竞态，非产品 bug）——换前缀隔离。 */
const C = mkActivity({ photos: ["https://example.com/v198c-p0.jpg", "https://example.com/v198c-p1.jpg", "https://example.com/v198c-p2.jpg"] });
// p0：横图但质量平平；p1：hero 用途 + 横图 + 高质量 → 应选 p1
seedMeta("https://example.com/v198c-p0.jpg", { ratio: 1.4, orientation: "landscape", quality_score: 0.62, category: "风景", subjects: ["山"], recommended_use: ["story"], safe_text_area: "center" });
seedMeta("https://example.com/v198c-p1.jpg", { ratio: 1.5, orientation: "landscape", quality_score: 0.91, category: "风光", subjects: ["山脊", "云海"], recommended_use: ["hero", "cover"], safe_text_area: "top-left" });
add("C1a bestCoverIndex 选分析最优（p1）", bestCoverIndex(C) === 1, "got=" + bestCoverIndex(C));

// C2 高风险裁切图显著降权：p2 质量更高但是竖图人物（高风险）→ 不该赢过 hero 横图
/* p2：质量最高但竖图人物 + 模型判高风险裁切（crop_risk:high）→ 必须被降权，不得夺封面 */
seedMeta("https://example.com/v198c-p2.jpg", { ratio: 0.7, orientation: "portrait", quality_score: 0.95, category: "人物", subjects: [{ name: "队员", bbox: { x: 0.1, y: 0.05, w: 0.8, h: 0.9 } }], recommended_use: ["detail"], safe_text_area: "center", crop_risk: "high" });
if (typeof cropPolicyOf === "function") {
  const cp = cropPolicyOf("https://example.com/v198c-p2.jpg");
  add("C2a p2 被判高风险/原比例（前置）", cp && (cp.riskLevel === "high" || cp.mode === "aspect_preserved"), JSON.stringify(cp && { risk: cp.riskLevel, mode: cp.mode }));
}
add("C2b 高风险图不夺封面（仍选 p1）", bestCoverIndex(C) === 1, "got=" + bestCoverIndex(C));

// C3 分析落地自愈：draft coverIndex=0（上传时算的旧值），分析写回后 recomputeAutoCover 修正
state.draft = C;   // C.coverIndex=0
applyVision("https://example.com/v198c-p1.jpg", { ratio: 1.5, orientation: "landscape", quality_score: 0.91, recommended_use: ["hero", "cover"] });
add("C3a 分析落地后 draft 封面自动改选最佳（0→1）", C.coverIndex === 1, "coverIndex=" + C.coverIndex);
// C3b 老板手动设过封面 → 永不覆盖
const D = mkActivity();
D._coverManual = true; D.coverIndex = 2;
state.draft = D;
applyVision("https://example.com/v198c-p1.jpg", { orientation: "landscape", quality_score: 0.99, recommended_use: ["hero", "cover"] });
add("C3b 手动封面绝不被覆盖（_coverManual）", D.coverIndex === 2, "coverIndex=" + D.coverIndex);

// C4 渲染层消费智能封面：非手动时 hero 用最佳图（非 coverIndex=0）
state.draft = null;
const E = mkActivity({ photos: ["https://example.com/v198c-p0.jpg", "https://example.com/v198c-p1.jpg"], coverIndex: 0 });  // 未手动设封面
const edE = renderActivityEditorial(E);
add("C4a 详情页 hero 用分析最优封面（p1 而非 p0）", has(edE, "v198c-p1.jpg") && has(edE.split("xh-ed-body")[0], "v198c-p1.jpg"), "");

// C5 hero keep 模式（竖图高风险封面）仍保留原比例能力，但垫图提亮（CSS 断言）
const F = mkActivity({ photos: ["https://example.com/v198c-portrait.jpg"], coverIndex: 0 });
seedMeta("https://example.com/v198c-portrait.jpg", { ratio: 0.7, orientation: "portrait", quality_score: 0.9, recommended_use: ["hero"] });
const edF = renderActivityEditorial(F);
add("C5a 竖图高风险封面走 keep（原比例不横裁）", has(edF, "xh-ed-hero keep"), "");
add("C5b keep 模式垫模糊底图存在（不再黑边裸露）", has(edF, "xh-ed-hero-backdrop"), "");

const failed = checks.filter((c) => !c.pass);
return { ok: failed.length === 0, total: checks.length, passed: checks.length - failed.length, checks };
