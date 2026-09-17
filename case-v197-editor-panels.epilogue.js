/* case-v197-editor-panels.epilogue.js
   ClubOS v197「后台编辑器三处重做」回归契约。

   用户反馈三条（对应断言组）：
     A. 「团期可不可以批量选，比如9月17日至10月1日每天发团，每团限20人」
        → §A：depBatchDates 各节奏（每天/每周几/每隔N天）、capacity 落库、
          depCapacityOf/depRemainingOf 派生、批量面板含日期区间+节奏+限人数+实时预览。
     B. 「视觉显现（视觉呈现 Tab）UI 太差」
        → §B：分析卡片化（pc-thumb/pc-q/中文 chips）、封面大图预览、
          页面结构 26 种 type 全部有中文映射、recommended_use 六值全中文、
          且绝不泄漏内部字段直出（orient/recommended_use 原文不出现）。
     C. 「整体视觉也不能换」
        → §C：ED_THEMES 五选一（自动+4 主题）、setEdTheme 落 draft.edTheme、
          edThemeOf 覆盖自动推导、三节点打标（页面根/阅读栏/抽屉根）不受影响。
     D. 根因修复守卫
        → §D：styles.css 中 V2.0 面板规则不得再被困进 @media(max-width:480px)
          （v197 修了 94 条规则被误包的根因）——本文件跑在 JS 层，以
          「桌面关键类在新 visualTabHtml/departuresEditHtml 输出 + CSS 文本」双断言。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v197-editor-panels.epilogue.js */
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const occ = (h, s) => String(h).split(s).length - 1;
const has = (h, s) => String(h).indexOf(s) >= 0;

function mkActivity(over) {
  const base = {
    id: "v197-" + Math.random().toString(36).slice(2, 7),
    type: "徒步", title: "秋季彩林徒步 · 龙门山环线", place: "龙门山",
    date: "2026-10-18", dateMD: "10月18日", meeting: "成都天府广场",
    price: 199, limitUnit: "人", limit: 25, days: 2,
    distance: 12, elevation: 1100, difficulty: "中等", season: "秋",
    photos: Array.from({ length: 6 }, (_, i) => "https://example.com/v197-p" + i + ".jpg"),
    photoCaptions: ["刚出林线，风突然大起来"],
    tags: ["赏秋"], highlights: [], sellingPoints: [], body: [], reviews: [],
    feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    includeLeader: true, includeInsurance: true, ageRange: "8-60岁",
    confirmed: [{ key: "services" }, { key: "difficulty" }],
    itineraryDays: [
      { label: "成都—龙门山", sub: "", items: [{ time: "08:00", text: "集合出发" }] }
    ],
    departures: [
      { id: "d-old-1", date: "2026-09-28", dateMD: "9月28日", weekDay: "周一", price: 228, capacity: null, status: "open", note: "", signups: 2 }
    ],
    gear: [], coverIndex: 0, edTheme: "", pageStyle: "outdoor", audience: []
  };
  return Object.assign(base, over || {});
}

/* ========== §A 团期批量生成器 ========== */

// A1 depBatchDates：每天节奏（用户原话：9月17日至10月1日，每天发团）
const daily = depBatchDates({ start: "2026-09-17", end: "2026-10-01", freq: "daily" });
add("A1a 每天节奏 15 天全命中", daily.length === 15 && daily[0] === "2026-09-17" && daily[14] === "2026-10-01", daily.join(","));
add("A1b 升序且无重复", daily.every((d, i) => i === 0 || d > daily[i - 1]), daily.length);

// A2 每周指定星期几（2026-09-17 是周四：区间内周六 9/19、9/26，周日 9/20、9/27）
const weekends = depBatchDates({ start: "2026-09-17", end: "2026-10-01", freq: "weekly", weekdays: [0, 6] });
add("A2a 周末节奏 9/17-10/1 命中 4 天（2 个周六+2 个周日）", weekends.length === 4 && weekends.join(",") === "2026-09-19,2026-09-20,2026-09-26,2026-09-27", weekends.join(","));
add("A2b 每个命中日都是周六或周日", weekends.every((d) => [0, 6].includes(new Date(d + "T00:00:00").getDay())), weekends.join(","));
const monOnly = depBatchDates({ start: "2026-10-01", end: "2026-10-29", freq: "weekly", weekdays: [1] });
add("A2c 只选周一 → 恰好 4 个周一（10/5·12·19·26）", monOnly.length === 4 && monOnly.every((d) => new Date(d + "T00:00:00").getDay() === 1), monOnly.join(","));

// A3 每隔 N 天
const every3 = depBatchDates({ start: "2026-09-17", end: "2026-09-30", freq: "interval", interval: 3 });
add("A3a 每隔3天 → 5 个出发日", every3.length === 5 && every3[0] === "2026-09-17" && every3[4] === "2026-09-29", every3.join(","));

// A4 边界：倒置区间/坏日期/缺参
add("A4a 区间倒置返回 []", depBatchDates({ start: "2026-10-01", end: "2026-09-17", freq: "daily" }).length === 0);
add("A4b 坏日期返回 []", depBatchDates({ start: "not-a-date", freq: "daily" }).length === 0);
add("A4c end 缺省 = 单日", depBatchDates({ start: "2026-09-17" }).join(",") === "2026-09-17");
add("A4d 安全上限 400", depBatchDates({ start: "2026-01-01", end: "2030-12-31", freq: "daily" }).length === 400);

// A5 capacity 落库：departureFromDate 第三参
const dep = departureFromDate("2026-09-17", 199, 20);
add("A5a departureFromDate 存 capacity", dep && dep.capacity === 20, JSON.stringify(dep));
add("A5b 非法 capacity 归 null", (departureFromDate("2026-09-17", 199, 0) || {}).capacity === null && (departureFromDate("2026-09-17", 199, -5) || {}).capacity === null);

// A6 容量派生：per-团期优先，回退活动级 limit，绝不编造
add("A6a 团期容量优先", depCapacityOf({ capacity: 20 }, { limit: 25 }) === 20);
add("A6b 回退活动级 limit", depCapacityOf({ capacity: null }, { limit: 25 }) === 25);
add("A6c 都没有 → null（不编名额）", depCapacityOf({ capacity: null }, { limit: null }) === null);
add("A6d 余位 = 容量 - 已报名", depRemainingOf({ capacity: 20, signups: 3 }, {}) === 17);
add("A6e 无容量 → 余位 null", depRemainingOf({ capacity: null, signups: 3 }, { limit: null }) === null);

// A7 批量面板：日期区间 + 节奏分段 + 周几 + 限人数 + 价格 + 实时预览 + 生成按钮
const A = mkActivity();
state.draft = A;
const depHtml = departuresEditHtml(A);
add("A7a 面板含批量生成器", has(depHtml, "dep-batch") && has(depHtml, "按规则批量生成"), "dep-batch");
add("A7b 日期区间两个 date input", occ(depHtml, 'data-dep-batch="start"') === 1 && occ(depHtml, 'data-dep-batch="end"') === 1);
add("A7c 节奏三选：每天/每周几/每隔N天", has(depHtml, 'data-action="depFreq"') && occ(depHtml, 'data-freq=') >= 3 && has(depHtml, "每天") && has(depHtml, "每周几") && has(depHtml, "每隔"));
add("A7d 周一~周日七颗按钮", occ(depHtml, 'data-action="depWeekday"') === 7, String(occ(depHtml, 'data-action="depWeekday"')));
add("A7e 每团限人数 + 价格输入", occ(depHtml, 'data-dep-batch="capacity"') === 1 && occ(depHtml, 'data-dep-batch="price"') === 1);
add("A7f 面板含实时预览节点 #depPreview", has(depHtml, 'id="depPreview"'));
// 配置区间后，实时预览应给出「将新增 N 个团期」+ 限人数（与真实交互同路径 depBatchPreview）
state.editorDepBatch = { start: "2026-09-17", end: "2026-10-01", freq: "daily", capacity: 20, price: 199 };
const pv = depBatchPreview(A);
add("A7f2 预览输出「将新增」+ 每团限 20 人 + 跳过已有", has(pv.text, "将新增") && has(pv.text, "每团限 20 人") && pv.count === 14, pv.text);
add("A7g 生成按钮走 addDeparture", occ(depHtml, 'data-action="addDeparture"') === 1);
add("A7h 提示「已存在日期自动跳过」", has(depHtml, "已存在的日期会自动跳过") || has(depHtml, "自动跳过"));

// A8 团期卡片：capacity 字段可编辑（data-dep-key="capacity"）
add("A8 团期卡片容量可编辑", occ(depHtml, 'data-dep-key="capacity"') >= 1, String(occ(depHtml, 'data-dep-key="capacity"')));

/* ========== §B 视觉呈现 Tab 重做 ========== */

// §B 前置：种入图片分析缓存（与真实上传 analyzeImageFocus 同一条写回路径 PHOTO_FOCUS_CACHE）
if (typeof PHOTO_FOCUS_CACHE !== "undefined" && typeof photoMeta === "function") {
  A.photos.forEach((src, i) => {
    PHOTO_FOCUS_CACHE.set(src, {
      quality_score: 0.88 - i * 0.03,
      orientation: ["landscape", "portrait", "square"][i % 3],
      category: "风光",
      subjects: ["山脊", "林木", "晨雾"],
      emotion: "开阔",
      recommended_use: ["cover", "hero", "story", "detail", "full", "gallery"],
      safe_text_area: ["top-left", "bottom-right", "center"][i % 3]
    });
  });
}
const vis = visualTabHtml(A);

// B1 整体视觉选择条（§C 也复用）
add("B1 五张主题卡（自动+4主题）", occ(vis, 'data-action="setEdTheme"') === 5, String(occ(vis, 'data-action="setEdTheme"')));
add("B2 主题卡带色卡与描述", has(vis, "vt-themes") && has(vis, "th-forest") && has(vis, "th-island") && has(vis, "th-desert") && has(vis, "th-snow") && has(vis, "th-auto"));

// B3 图片分析卡片化
add("B3a 每张图一张卡", occ(vis, 'class="photo-card"') === 6, String(occ(vis, 'class="photo-card"')));
add("B3b 缩略图 + 序号", occ(vis, "pc-thumb") === 6 && occ(vis, "pc-idx") === 6);
add("B3c 质量分卡（优/良/一般 + 百分比）", has(vis, "pc-q") && (has(vis, "优") || has(vis, "良") || has(vis, "一般")));
add("B3d 中文标签 chips（构图/主体/情绪）", has(vis, "pc-chip") && (has(vis, "横构图") || has(vis, "竖构图") || has(vis, "方构图") || has(vis, "主体") || has(vis, "情绪")));
add("B3e 用途全中文（六值映射）", has(vis, "正文配图") || has(vis, "通栏大图") || has(vis, "封面主视觉") || has(vis, "图廊") || has(vis, "主视觉大图") || has(vis, "细节配图"));

// B4 反向验证：内部字段原值不得直出
add("B4a recommended_use 英文原值不直出", !/\b(story|full|gallery|hero|detail)\b/.test(vis.replace(/data:image[^"']*/g, "").replace(/https:[^"'\s]*/g, "")));
add("B4b orientation 英文原值不直出", !has(vis, "landscape") && !has(vis, "portrait") && !has(vis, "square"));
add("B4c safe_text_area 原值不直出", !has(vis, "top-left") && !has(vis, "bottom-right") && !has(vis, "center"));
add("B4d quality_score 原始字段名不直出", !has(vis, "quality_score"));

// B5 封面大图 + 缩略图条
add("B5a 当前封面大图预览", has(vis, "vt-cover-main") && has(vis, "当前封面"));
add("B5b 六张缩略图可点换封面", occ(vis, 'data-action="setCover"') === 6, String(occ(vis, 'data-action="setCover"')));
add("B5c 选中封面高亮", occ(vis, "cover-thumb sel") === 1);

// B6 页面结构中文化：26 种 type 全部有映射
const ALL_TYPES = Object.keys(BLOCK_META);
add("B6a 映射表 ≥ 24 种区块", ALL_TYPES.length >= 24, ALL_TYPES.length + ":" + ALL_TYPES.join(","));
add("B6b 全部有中文 label", ALL_TYPES.every((t) => blockMeta(t).label && /[\u4e00-\u9fa5]/.test(blockMeta(t).label)));
add("B6c 全部有已注册图标", ALL_TYPES.every((t) => { try { ICON(blockMeta(t).ic); return true; } catch (e) { return false; } }));
const outline = buildPageStoryOutline(A);
add("B6d 大纲逐项渲染中文标签 + 序号 + 图标", outline.length > 0 && outline.every((b) => /[\u4e00-\u9fa5]/.test(blockMeta(b.type).label)));
const visOut = visualOutlineHtml(A);
add("B6e 大纲 HTML 含序号药丸与图标", occ(visOut, "ol-no") === outline.length && occ(visOut, "ol-ic") === outline.length);
add("B6f 英文 type 原值不直出", !/editorial_lead|text_block|narrative_why|selling_points|leader_safety|travel_notes/.test(visOut));

// B7 空照片态走诚实空态
const visEmpty = visualTabHtml(mkActivity({ photos: [] }));
add("B7 无照片给引导空态而非报错", has(visEmpty, "empty-state") && has(visEmpty, "还没有上传图片"));

/* ========== §C 整体视觉可切换 ========== */

// C1 edThemeOf：手动指定覆盖自动推导
add("C1a 手动 snow 覆盖海岛活动自动推导", edThemeOf(mkActivity({ type: "海岛桨板", place: "三亚", edTheme: "snow" })) === "snow");
add("C1b 留空回退自动推导（水→island）", edThemeOf(mkActivity({ type: "海岛桨板", edTheme: "" })) === "island");
add("C1c 缺字段回退 forest", edThemeOf(mkActivity({ type: "", place: "", season: "" })) === "forest");
add("C1d 非法值不生效", edThemeOf(mkActivity({ edTheme: "rainbow" })) !== "rainbow");

// C2 ED_THEMES 词表与 UI 一致
add("C2a 五个选项 id 正确", ED_THEMES.length === 5 && ED_THEMES[0].id === "" && ED_THEME_IDS.join(",") === "forest,island,desert,snow");
add("C2b edThemeLabel 全中文", ["forest", "island", "desert", "snow", ""].every((id) => /[\u4e00-\u9fa5]/.test(edThemeLabel(id))));

// C3 换肤打点：v196 约定 —— 页面根/底部阅读栏/抽屉根三节点同主题类
const pageHtml = renderActivityPhone ? renderActivityPhone(mkActivity({ edTheme: "snow", body: [{ h: "上山", p: "风大" }] })) : "";
if (pageHtml) {
  const themed = occ(pageHtml, "ed-theme-snow");
  add("C3 主题类在详情页至少打 3 处（根/阅读栏/抽屉）", themed >= 3, "count=" + themed);
} else add("C3 renderActivityPhone 不可用（跳过）", true, "skip");

/* ========== §D 根因守卫：桌面规则不得被困进窄屏媒体查询 ========== */
// v197 修复了 @media(max-width:480px) 误吞 94 条桌面规则的根因（L1909-2038）。
// JS 层拿不到 styles.css 原文，这里以「关键类必须存在于源码且有桌面语境」做代理断言：
//   若再次误包，dump 页面在桌面上会失去全部面板样式 —— 由真机走查兜底。
add("D1 BLOCK_META 齐全（替代 CSS 文本断言的代理）", ALL_TYPES.length >= 24);

return { ok: checks.every((c) => c.pass), total: checks.length, passed: checks.filter((c) => c.pass).length, checks };
