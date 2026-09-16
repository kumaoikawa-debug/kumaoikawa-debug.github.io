/* case-v195-detail-skeleton.epilogue.js
   ClubOS v195「活动详情页重构：行程骨架 + 杂志视觉（组合方案）」回归契约。
   覆盖：吸顶导航兄弟节点位置 / 5 个锚点闭环 / 出行清单(localStorage) / 灯箱 / 主题换肤 / DAY 卡片 / 接线实测 / 反向验证（仅影响图文长页）。
   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v195-detail-skeleton.epilogue.js */
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const occ = (h, s) => String(h).split(s).length - 1;

function mkActivity(over) {
  const base = {
    id: "v195-" + Math.random().toString(36).slice(2, 7),
    type: "徒步", title: "秋季彩林徒步 · 龙门山环线", place: "龙门山",
    date: "2026-10-18", dateMD: "10月18日", meeting: "成都天府广场",
    price: 199, limitUnit: "人", limit: 25, days: 2,
    distance: 12, elevation: 1100, difficulty: "中等", season: "秋",
    photos: Array.from({ length: 9 }, (_, i) => "https://example.com/v195-p" + i + ".jpg"),
    photoCaptions: ["刚出林线，风突然大起来", "垭口回望，层林尽染"],
    tags: ["赏秋"], highlights: [], sellingPoints: [], body: [],
    feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    includeLeader: true, includeInsurance: true, ageRange: "8-60岁",
    confirmed: [{ key: "services" }, { key: "difficulty" }, { key: "age", val: "8-60岁" }],
    itineraryDays: [
      { label: "成都—龙门山—上山", sub: "", items: [{ time: "08:00", text: "集合出发" }, { time: "10:30", text: "开始徒步" }] },
      { label: "下山—返程", sub: "", items: [{ time: "15:00", text: "下山" }, { time: "17:30", text: "回到成都" }] }
    ],
    whyGo: "秋季彩林层林尽染，12 公里环线把龙门山最美的一段串起来。",
    experience: "踩着落叶一级级往上，出林线后视野突然打开。",
    gain: "带走一身松脂味和几十张不用修的照片。",
    fitFor: "有基础徒步经验、想认真走一段秋色的人。"
  };
  return Object.assign(base, over || {});
}

const TARGETS = ["#ed-story", "#ed-itin", "#ed-fee", "#ed-prep", "#ed-cta"];

try {
  state.detailMode = "editorial";
  const aHike = mkActivity({});
  const hEd = renderActivityPhone(aHike);

  // ── 1) 吸顶导航存在且为 5 个区段 ──
  add("§1 吸顶导航存在（#xhTabs）", hEd.indexOf('id="xhTabs"') >= 0, "len=" + hEd.length);
  add("§1 导航含 5 个区段 Tab",
    occ(hEd, 'class="xh-ed-tab"') === 5 && occ(hEd, 'data-action="edTab"') === 5,
    "tabs=" + occ(hEd, 'class="xh-ed-tab"'));
  add("§1 五个 data-target 与设计一致",
    TARGETS.every((t) => hEd.indexOf('data-target="' + t + '"') >= 0),
    TARGETS.filter((t) => hEd.indexOf('data-target="' + t + '"') < 0).join(",") || "all");

  // ── 2) 关键结构：导航必须作为 .activity-page 的【前置兄弟节点】──
  // 若放进 .activity-page 内，其 overflow:hidden 会让 sticky 失效（这正是本版本的核心坑）
  add("§2 导航在 .activity-page 之前（兄弟节点，sticky 才生效）",
    hEd.indexOf('id="xhTabs"') >= 0 && hEd.indexOf('id="xhTabs"') < hEd.indexOf('class="activity-page'),
    "nav@" + hEd.indexOf('id="xhTabs"') + " root@" + hEd.indexOf('class="activity-page'));
  add("§2 灯箱作为 .activity-page 的【后置兄弟节点】",
    hEd.indexOf('id="xhLightbox"') > hEd.indexOf('id="ed-cta"'), "@" + hEd.indexOf('id="xhLightbox"'));

  // ── 3) 五个锚点闭环：每个 Tab 的落点 id 必须真实存在 ──
  const missing = TARGETS.filter((t) => hEd.indexOf('id="' + t.slice(1) + '"') < 0);
  add("§3 锚点闭环：5 个 Tab 落点 id 全部存在于页面", missing.length === 0, missing.join(",") || "all-resolved");
  add("§3 原有 DOM 契约锚点未被改名（hero/body/sec/decision/gallery/cta）",
    ["xh-ed-hero", "xh-ed-body", "xh-ed-sec", "xh-ed-decision", "xh-ed-gallery", "xh-ed-cta"].every((k) => hEd.indexOf(k) >= 0),
    "ok");

  // ── 4) 出行清单 ──
  const clN = occ(hEd, 'data-action="clToggle"');
  add("§4 出行清单存在且默认展开", hEd.indexOf('class="xh-ed-checklist"') >= 0 && hEd.indexOf('id="ed-prep"') >= 0 && /<details[^>]*id="ed-prep"[^>]*open/.test(hEd), "open");
  add("§4 清单条目 5~8 条", clN >= 5 && clN <= 8, "n=" + clN);
  add("§4 进度显示 0/N 且 N==条目数", hEd.indexOf('id="clProg">0/' + clN + "<") >= 0, "prog=0/" + clN);
  add("§4 勾选状态带持久化 storage key", occ(hEd, 'data-store="clubos_prep_') === clN, "stores=" + occ(hEd, 'data-store="clubos_prep_'));

  // ── 5) 清单按活动类型差异化（state 级断言）──
  const prepHike = editorialPrepItems({ type: "徒步" }).map((x) => x.key);
  const prepWater = editorialPrepItems({ type: "溯溪" }).map((x) => x.key);
  const prepBike = editorialPrepItems({ type: "公路骑行" }).map((x) => x.key);
  add("§5 徒步清单含保暖层/头灯", prepHike.indexOf("warm") >= 0 && prepHike.indexOf("head") >= 0, prepHike.join(","));
  add("§5 溯溪清单含溯溪鞋/防水袋", prepWater.indexOf("aquashoe") >= 0 && prepWater.indexOf("dry") >= 0, prepWater.join(","));
  add("§5 骑行清单含头盔/补胎", prepBike.indexOf("helmet") >= 0 && prepBike.indexOf("repair") >= 0, prepBike.join(","));
  add("§5 三类清单确实不同（非千篇一律）",
    prepHike.join() !== prepWater.join() && prepWater.join() !== prepBike.join(), "diff");

  // ── 6) 主题换肤（按活动类型/季节）──
  add("§6 徒步 → 森林主题", edThemeOf({ type: "徒步", place: "龙门山" }) === "forest", edThemeOf({ type: "徒步" }));
  add("§6 冰川/雪 → 雪主题", edThemeOf({ type: "冰川徒步" }) === "snow" && edThemeOf({ place: "雪乡" }) === "snow", edThemeOf({ type: "冰川徒步" }));
  add("§6 溯溪/海岛 → 海岛主题", edThemeOf({ type: "溯溪" }) === "island" && edThemeOf({ type: "海岛露营" }) === "island", edThemeOf({ type: "溯溪" }));
  add("§6 沙漠/峡谷 → 沙漠主题", edThemeOf({ type: "沙漠穿越" }) === "desert" && edThemeOf({ place: "丹霞峡谷" }) === "desert", edThemeOf({ type: "沙漠穿越" }));
  add("§6 空活动安全兜底为森林主题", edThemeOf({}) === "forest" && edThemeOf(null) === "forest", "safe");
  add("§6 渲染根与导航带同一主题类（换肤一致）",
    occ(hEd, "ed-theme-forest") === 2 && hEd.indexOf('class="xh-ed-tabs ed-theme-forest"') >= 0,
    "occ=" + occ(hEd, "ed-theme-forest"));

  // 换肤真的跟着活动类型变：溯溪活动应渲染 island
  const hWater = renderActivityPhone(mkActivity({ type: "溯溪", title: "藤蔓谷溯溪", place: "平武藤蔓谷", days: 1 }));
  add("§6 溯溪活动渲染为海岛主题（换肤跟随类型变化）",
    hWater.indexOf("ed-theme-island") >= 0 && hWater.indexOf("ed-theme-forest") < 0, "island");

  // ── 7) DAY 卡片化骨架（保留既有 tl-item 内容）──
  add("§7 DAY 卡存在且带时间轴", hEd.indexOf('class="xh-ed-day"') >= 0 && hEd.indexOf('class="timeline"') >= 0, "days=" + occ(hEd, 'class="xh-ed-day"'));
  add("§7 DAY 节点与时刻文案仍在（未破坏既有行程渲染）",
    hEd.indexOf('class="tl-item"') >= 0 && hEd.indexOf('class="tl-node"') >= 0 && hEd.indexOf("集合出发") >= 0, "tl");

  // ── 8) 灯箱结构 ──
  add("§8 灯箱含遮罩 + 关闭按钮 + 图片位",
    hEd.indexOf('id="xhLightboxImg"') >= 0 && hEd.indexOf('class="lb-close"') >= 0 && hEd.indexOf('id="xhLightbox"') >= 0, "lb");

  // ── 9) 接线实测（不依赖真实 DOM）──
  // 9a. clToggle：勾选应翻转 class（localStorage 缺失也应安全）
  try {
    const mkCls = () => { const s = {}; return { add: (c) => { s[c] = 1; }, remove: (c) => { delete s[c]; }, toggle: (c, on) => { if (on) s[c] = 1; else delete s[c]; return !!on; }, contains: (c) => !!s[c], _s: s }; };
    const fake = { dataset: { key: "id", store: "clubos_prep_v195probe" }, classList: mkCls() };
    handleClick("clToggle", fake);
    const on = fake.classList.contains("cl-done");
    handleClick("clToggle", fake);
    add("§9 clToggle 接线：勾选/取消可翻转", on === true && fake.classList.contains("cl-done") === false, "on=" + on);
  } catch (e) {
    add("§9 clToggle 接线：勾选/取消可翻转", false, String((e && e.message) || e));
  }
  // 9b. edTab：滚动到锚点不应抛错（锚点不存在/无 scrollIntoView 也要安全）
  try {
    handleClick("edTab", { dataset: { target: "#ed-story" } });
    handleClick("edTab", { dataset: { target: "#ed-not-exist" } });
    handleClick("edTab", { dataset: {} });
    add("§9 edTab 接线：滚动/缺目标均不抛错", true, "safe");
  } catch (e) {
    add("§9 edTab 接线：滚动/缺目标均不抛错", false, String((e && e.message) || e));
  }
  // 9c. initEditorialTabs 在无 IntersectionObserver 的环境必须安全返回
  try {
    initEditorialTabs();
    add("§9 initEditorialTabs 环境缺失时安全返回", true, "safe");
  } catch (e) {
    add("§9 initEditorialTabs 环境缺失时安全返回", false, String((e && e.message) || e));
  }

  // ── 10) 反向验证：新骨架只作用于图文长页，不污染「简洁报名详情」──
  state.detailMode = "lean";
  const hLean = renderActivityPhone(aHike);
  add("§10 反向：简洁报名详情不含吸顶导航", hLean.indexOf("xh-ed-tabs") < 0, "clean");
  add("§10 反向：简洁报名详情不含出行清单/灯箱/主题类",
    hLean.indexOf("xh-ed-checklist") < 0 && hLean.indexOf("xhLightbox") < 0 && hLean.indexOf("ed-theme-") < 0, "clean");
  state.detailMode = "editorial";

  // ── 11) 反向验证：拍照驱动/比例契约相关既有结构仍在（v190 未被本轮改动破坏）──
  add("§11 v190 相关：章节图容器仍走既有 xh-ed-fig（未替换为固定比例网格）",
    hEd.indexOf("xh-ed-fig") >= 0 && hEd.indexOf("photo-layout") >= 0, "figs=" + occ(hEd, "xh-ed-fig"));
} catch (e) {
  add("v195 图文详情页渲染未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  checks: checks
};
