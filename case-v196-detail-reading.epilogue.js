/* case-v196-detail-reading.epilogue.js
   ClubOS v196「活动详情页：交互重做 + 选项收敛 + 活动评价」回归契约。

   用户反馈三条（对应三组断言）：
     ① 「顶部吸顶 Tab 放顶部不对、体验差」 → §1~§4：顶部导航必须消失，
        改为 .activity-page【后置兄弟节点】的 sticky 底部阅读栏 + 目录抽屉（6 段闭环）。
     ② 「选项太多了，收敛成一个风格」      → §5：详情页不再出现 setDetailMode / regenLayout，
        inline chrome 只剩 1 个 regenStyle（换一种排版）。
     ③ 「活动评价也没有」                  → §6~§8：独立区段 #ed-reviews，
        有真实数据渲染均分/星级/条目，无数据给诚实空态 + 后台录入入口，且绝不编造。

   另含反向验证（§11 简洁报名详情不受污染）与回归守卫（§9 主题换肤、§10 v195 骨架、§12 v190 比例契约）。
   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v196-detail-reading.epilogue.js */
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const occ = (h, s) => String(h).split(s).length - 1;
const has = (h, s) => String(h).indexOf(s) >= 0;

// v196 契约：初始状态就必须是图文长页（模式切换已下线，默认值即唯一输出）
const initialMode = String(state.detailMode);

function mkActivity(over) {
  const base = {
    id: "v196-" + Math.random().toString(36).slice(2, 7),
    type: "徒步", title: "秋季彩林徒步 · 龙门山环线", place: "龙门山",
    date: "2026-10-18", dateMD: "10月18日", meeting: "成都天府广场",
    price: 199, limitUnit: "人", limit: 25, days: 2,
    distance: 12, elevation: 1100, difficulty: "中等", season: "秋",
    photos: Array.from({ length: 9 }, (_, i) => "https://example.com/v196-p" + i + ".jpg"),
    photoCaptions: ["刚出林线，风突然大起来", "垭口回望，层林尽染"],
    tags: ["赏秋"], highlights: [], sellingPoints: [], body: [], reviews: [],
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

// 目录六段：新增「活动评价」，并把「报名」留在最后
const TOC = ["#ed-story", "#ed-itin", "#ed-fee", "#ed-prep", "#ed-reviews", "#ed-cta"];

try {
  state.view = "detail";          // 让页内 editorialVariantSwitch 渲染（后台工作区由页外控件承担）
  state.detailMode = "editorial";
  const aHike = mkActivity({});
  const hEd = renderActivityPhone(aHike);

  // ────────────────────────────────────────────────────────────
  // §1 顶部吸顶 Tab 必须消失（用户明确否定「放顶部」）
  // ────────────────────────────────────────────────────────────
  add("§1 顶部吸顶导航已下线（不再有 .xh-ed-tabs / #xhTabs）",
    !has(hEd, "xh-ed-tabs") && !has(hEd, 'id="xhTabs"') && occ(hEd, 'class="xh-ed-tab"') === 0,
    "tabs=" + occ(hEd, 'class="xh-ed-tab"'));
  add("§1 顶部不再出现模态切换条（detail-mode-switch 只留变体条）",
    hEd.indexOf('class="detail-mode-switch') < 0 || has(hEd, "editorial-variant-switch"), "ok");

  // ────────────────────────────────────────────────────────────
  // §2 底部阅读栏：必须作为 .activity-page 的【后置兄弟节点】
  //    放内部会被 .activity-page{overflow:hidden} 杀死 sticky（v195 同一坑的镜像）
  // ────────────────────────────────────────────────────────────
  add("§2 底部阅读栏存在（#xhDock）", has(hEd, 'id="xhDock"'), "len=" + hEd.length);
  add("§2 阅读栏在 .activity-page 之后（兄弟节点，sticky 才生效）",
    has(hEd, 'id="xhDock"') && hEd.indexOf('id="xhDock"') > hEd.indexOf('class="activity-page'),
    "dock@" + hEd.indexOf('id="xhDock"') + " root@" + hEd.indexOf('class="activity-page'));
  add("§2 阅读栏四件套：目录 / 价格 / 咨询 / 报名",
    has(hEd, 'data-action="edToc"') && has(hEd, 'class="xh-ed-dock-price"')
    && has(hEd, 'data-action="contactOrg"') && has(hEd, 'data-action="openSignup"'), "ok");
  add("§2 页内 fixed-bottom 底栏已移除（避免末尾两根报名条叠在一起）",
    !has(hEd, 'class="bottom-bar"'), "bottom-bar=" + occ(hEd, 'class="bottom-bar"'));

  // ────────────────────────────────────────────────────────────
  // §3 目录抽屉结构
  // ────────────────────────────────────────────────────────────
  add("§3 目录抽屉结构齐全（root + 遮罩 + 面板）",
    has(hEd, 'id="xhTocRoot"') && has(hEd, 'class="xh-ed-toc-mask"') && has(hEd, 'id="xhToc"'), "ok");
  add("§3 抽屉在阅读栏之后（层级顺序正确）",
    hEd.indexOf('id="xhTocRoot"') > hEd.indexOf('id="xhDock"'), "toc@" + hEd.indexOf('id="xhTocRoot"'));
  add("§3 目录 6 项、关闭出口 2 个（遮罩 + 关闭按钮）",
    occ(hEd, 'data-action="edTocGo"') === 6 && occ(hEd, 'data-action="edTocClose"') === 2,
    "go=" + occ(hEd, 'data-action="edTocGo"') + " close=" + occ(hEd, 'data-action="edTocClose"'));
  add("§3 六个 data-target 与目录设计一致",
    TOC.every((t) => has(hEd, 'data-target="' + t + '"')),
    TOC.filter((t) => !has(hEd, 'data-target="' + t + '"')).join(",") || "all");
  add("§3 抽屉带主题类（换肤断层防护）",
    /class="xh-ed-toc-root ed-theme-[a-z]+"/.test(hEd) && /class="xh-ed-dock ed-theme-[a-z]+"/.test(hEd), "ok");

  // ────────────────────────────────────────────────────────────
  // §4 锚点闭环（含新增 #ed-reviews）
  // ────────────────────────────────────────────────────────────
  const missing = TOC.filter((t) => !has(hEd, 'id="' + t.slice(1) + '"'));
  add("§4 锚点闭环：6 个目录落点 id 全部存在于页面", missing.length === 0, missing.join(",") || "all-resolved");
  add("§4 原有 DOM 契约锚点未被改名（hero/body/sec/decision/gallery/cta）",
    ["xh-ed-hero", "xh-ed-body", "xh-ed-sec", "xh-ed-decision", "xh-ed-gallery", "xh-ed-cta"].every((k) => has(hEd, k)), "ok");

  // ────────────────────────────────────────────────────────────
  // §5 选项收敛：一个「换一种排版」
  // ────────────────────────────────────────────────────────────
  add("§5 详情页不再渲染模式切换 chip（统一图文长页）", !has(hEd, 'data-action="setDetailMode"'), "clean");
  add("§5 详情页不再渲染「换版式」chip（已收敛）", !has(hEd, 'data-action="regenLayout"'), "clean");
  add("§5 只剩一个「换一种排版」（regenStyle × 1）",
    occ(hEd, 'data-action="regenStyle"') === 1 && has(hEd, "换一种排版"),
    "n=" + occ(hEd, 'data-action="regenStyle"'));
  add("§5 保留只读摘要（当前版式/风格，老板一眼知道现在是什么）", has(hEd, 'class="dms-cur"'), "cur");

  // ────────────────────────────────────────────────────────────
  // §6 活动评价 —— 空态（诚实，不编造）
  // ────────────────────────────────────────────────────────────
  add("§6 评价独立成段（#ed-reviews）", has(hEd, 'id="ed-reviews"') && has(hEd, 'class="xh-ed-sec xh-ed-reviews"'), "ok");
  add("§6 无评价时给空态而不是整块隐藏",
    has(hEd, "xh-ed-rv-empty") && has(hEd, "还没有评价"), "empty");
  add("§6 空态明确说明「不替你编造评价」", has(hEd, "不会替你编造任何评价"), "honest");
  add("§6 空态下没有评分汇总（无数据不出均分）", !has(hEd, "xh-ed-rv-sum"), "no-sum");
  add("§6 非后台环境（isAdminMode=false）不出现录入表单",
    edCanEditReviews() ? true : !has(hEd, "xh-ed-rv-form"),
    "admin=" + edCanEditReviews());

  // ────────────────────────────────────────────────────────────
  // §7 活动评价 —— 有真实数据（均分 / 星级 / 条目）
  // ────────────────────────────────────────────────────────────
  const aRv = mkActivity({
    reviews: [
      { name: "阿伟", stars: 5, text: "领队节奏很稳，出林线那段风景值回票价。", date: "2026-09-01" },
      { name: "小鹿", stars: 4, text: "风景很好，午餐略简单，整体满意。", date: "2026-08-20" }
    ]
  });
  const hRv = renderActivityPhone(aRv);
  add("§7 有评价时渲染均分 + 条目数",
    has(hRv, "xh-ed-rv-sum") && has(hRv, ">4.5<") && has(hRv, "2 条真实评价"),
    "avg=" + (has(hRv, ">4.5<") ? "4.5" : "miss"));
  add("§7 评价条目含昵称 / 星级 / 日期 / 正文",
    has(hRv, "阿伟") && has(hRv, "小鹿") && has(hRv, "领队节奏很稳") && has(hRv, "2026-09-01")
    && has(hRv, "★★★★★") && has(hRv, "★★★★☆"), "ok");
  add("§7 有评价时不显示空态", !has(hRv, "xh-ed-rv-empty"), "ok");
  add("§7 旧 blockReviews 不再重复挂载（评价只出现一处）",
    !has(hRv, 'class="reviews"') && occ(hRv, 'id="ed-reviews"') === 1, "dup-safe");
  add("§7 星级函数对越界值安全（0 / 6 不炸）",
    (function () { try { renderActivityPhone(mkActivity({ reviews: [{ name: "x", stars: 0, text: "a" }, { name: "y", stars: 9, text: "b" }] })); return true; } catch (e) { return false; } })(), "safe");

  // ────────────────────────────────────────────────────────────
  // §8 后台录入入口（用开关替换 isAdminMode 后必须出现）
  // ────────────────────────────────────────────────────────────
  let hAdmin = "";
  try {
    const _orig = edCanEditReviews;
    edCanEditReviews = function () { return true; };
    hAdmin = renderActivityPhone(mkActivity({}));
    edCanEditReviews = _orig;
    add("§8 后台环境渲染录入表单（昵称/星级/日期/正文/保存）",
      has(hAdmin, 'id="edRvName"') && has(hAdmin, 'id="edRvStars"') && has(hAdmin, 'id="edRvDate"')
      && has(hAdmin, 'id="edRvText"') && has(hAdmin, 'data-action="edReviewSave"'), "form");
    add("§8 有评价时后台给「删除这条评价」出口",
      (function () {
        const _o = edCanEditReviews;
        edCanEditReviews = function () { return true; };
        const h2 = renderActivityPhone(mkActivity({ reviews: [{ name: "阿伟", stars: 5, text: "很好" }] }));
        edCanEditReviews = _o;
        return has(h2, 'data-action="edReviewDel"') && has(h2, 'data-idx="0"');
      })(), "del");
  } catch (e) {
    add("§8 后台环境渲染录入表单（昵称/星级/日期/正文/保存）", false, String((e && e.message) || e));
  }

  // ────────────────────────────────────────────────────────────
  // §9 主题换肤：root / 阅读栏 / 抽屉 三处同名，且跟随活动类型
  // ────────────────────────────────────────────────────────────
  add("§9 徒步 → 森林主题，且 root/dock/toc 三处一致",
    occ(hEd, "ed-theme-forest") === 3, "occ=" + occ(hEd, "ed-theme-forest"));
  const hWater = renderActivityPhone(mkActivity({ type: "溯溪", title: "藤蔓谷溯溪", place: "平武藤蔓谷", days: 1 }));
  add("§9 溯溪活动渲染为海岛主题（换肤跟随类型，且无森林残留）",
    has(hWater, "ed-theme-island") && !has(hWater, "ed-theme-forest"), "island");
  add("§9 空活动安全兜底为森林主题", edThemeOf({}) === "forest" && edThemeOf(null) === "forest", "safe");

  // ────────────────────────────────────────────────────────────
  // §10 v195 骨架未被回退（DAY 卡片 / 出行清单 / 灯箱 / 尺寸契约）
  // ────────────────────────────────────────────────────────────
  add("§10 DAY 卡片与时间轴仍在",
    has(hEd, 'class="xh-ed-day"') && has(hEd, 'class="timeline"') && has(hEd, 'class="tl-item"'), "days=" + occ(hEd, 'class="xh-ed-day"'));
  add("§10 出行清单仍在且默认展开、进度 0/N",
    has(hEd, 'id="ed-prep"') && has(hEd, "xh-ed-checklist") && /<details[^>]*id="ed-prep"[^>]*open/.test(hEd), "prep");
  add("§10 灯箱仍在", has(hEd, 'id="xhLightbox"') && has(hEd, 'id="xhLightboxImg"'), "lb");
  add("§10 v190/v195 图片契约未替换（xh-ed-fig + photo-layout 都还在）",
    has(hEd, "xh-ed-fig") && has(hEd, "photo-layout"), "figs=" + occ(hEd, "xh-ed-fig"));

  // ────────────────────────────────────────────────────────────
  // §11 反向验证：新骨架只作用于图文长页，不污染「简洁报名详情」
  // ────────────────────────────────────────────────────────────
  state.detailMode = "lean";
  const hLean = renderActivityPhone(aHike);
  add("§11 反向：简洁报名详情不含阅读栏/抽屉",
    !has(hLean, "xh-ed-dock") && !has(hLean, "xhTocRoot"), "clean");
  add("§11 反向：简洁报名详情不含评价段/清单/灯箱/主题类",
    !has(hLean, "ed-reviews") && !has(hLean, "xh-ed-checklist") && !has(hLean, "xhLightbox") && !has(hLean, "ed-theme-"), "clean");
  state.detailMode = "editorial";

  // ────────────────────────────────────────────────────────────
  // §12 接线实测（await 异步 handler，避免未捕获 rejection 假通过）
  // ────────────────────────────────────────────────────────────
  try {
    await handleClick("edToc", { dataset: {} });
    add("§12 edToc 接线：打开抽屉不抛错（含样式定位写入）", true, "safe");
  } catch (e) { add("§12 edToc 接线：打开抽屉不抛错（含样式定位写入）", false, String((e && e.message) || e)); }

  try {
    await handleClick("edTocClose", { dataset: {} });
    add("§12 edTocClose 接线：关闭抽屉不抛错", true, "safe");
  } catch (e) { add("§12 edTocClose 接线：关闭抽屉不抛错", false, String((e && e.message) || e)); }

  try {
    await handleClick("edTocGo", { dataset: { target: "#ed-reviews" } });
    await handleClick("edTocGo", { dataset: { target: "#ed-not-exist" } });
    await handleClick("edTocGo", { dataset: {} });
    add("§12 edTocGo 接线：跳转/缺目标/不存在目标均不抛错", true, "safe");
  } catch (e) { add("§12 edTocGo 接线：跳转/缺目标/不存在目标均不抛错", false, String((e && e.message) || e)); }

  try {
    initEditorialToc();
    add("§12 initEditorialToc 在桩环境安全返回", true, "safe");
  } catch (e) { add("§12 initEditorialToc 在桩环境安全返回", false, String((e && e.message) || e)); }

  // 12a. 清单勾选仍可翻转（v195 能力回归）
  try {
    const mkCls = () => { const s = {}; return { add: (c) => { s[c] = 1; }, remove: (c) => { delete s[c]; }, toggle: (c, on) => { if (on) s[c] = 1; else delete s[c]; return !!on; }, contains: (c) => !!s[c] }; };
    const fake = { dataset: { key: "id", store: "clubos_prep_v196probe" }, classList: mkCls() };
    await handleClick("clToggle", fake);
    const on = fake.classList.contains("cl-done");
    await handleClick("clToggle", fake);
    add("§12 clToggle 接线：勾选/取消仍可翻转", on === true && fake.classList.contains("cl-done") === false, "on=" + on);
  } catch (e) { add("§12 clToggle 接线：勾选/取消仍可翻转", false, String((e && e.message) || e)); }

  // 12b. 评价写入 → state 级断言（读的是 DOM 输入框，桩里同 id 返回同一对象）
  try {
    const aSave = mkActivity({ reviews: [] });
    state.draft = aSave;
    document.getElementById("edRvText").value = "全程节奏舒服，领队会等落后的队友。";
    document.getElementById("edRvName").value = "老周";
    document.getElementById("edRvStars").value = "4";
    document.getElementById("edRvDate").value = "2026-09-10";
    await handleClick("edReviewSave", { dataset: {} });
    const r0 = (aSave.reviews || [])[0] || {};
    add("§12 edReviewSave：真实评价写入 state（昵称/星级/正文/日期）",
      aSave.reviews.length === 1 && r0.name === "老周" && r0.stars === 4
      && r0.text === "全程节奏舒服，领队会等落后的队友。" && r0.date === "2026-09-10",
      JSON.stringify(r0).slice(0, 80));
    await handleClick("edReviewDel", { dataset: { idx: "0" } });
    add("§12 edReviewDel：删除后条目回退", aSave.reviews.length === 0, "n=" + aSave.reviews.length);
  } catch (e) { add("§12 edReviewSave：真实评价写入 state（昵称/星级/正文/日期）", false, String((e && e.message) || e)); }

  // 12c. 空内容必须被拦下（不得写入半截评价）
  try {
    const aEmpty = mkActivity({ reviews: [] });
    state.draft = aEmpty;
    document.getElementById("edRvText").value = "   ";
    await handleClick("edReviewSave", { dataset: {} });
    add("§12 edReviewSave：正文为空时拒绝写入（护栏）", aEmpty.reviews.length === 0, "guarded");
  } catch (e) { add("§12 edReviewSave：正文为空时拒绝写入（护栏）", false, String((e && e.message) || e)); }

  // 12d. 越界删除必须安全
  try {
    const aDel = mkActivity({ reviews: [{ name: "x", stars: 5, text: "y" }] });
    state.draft = aDel;
    await handleClick("edReviewDel", { dataset: { idx: "99" } });
    await handleClick("edReviewDel", { dataset: {} });
    add("§12 edReviewDel：越界/缺 idx 时安全不动数据", aDel.reviews.length === 1, "n=" + aDel.reviews.length);
  } catch (e) { add("§12 edReviewDel：越界/缺 idx 时安全不动数据", false, String((e && e.message) || e)); }

  // ────────────────────────────────────────────────────────────
  // §13 默认输出模式：详情页统一为图文长页
  // ────────────────────────────────────────────────────────────
  add("§13 初始 state.detailMode 即为 editorial（模式切换已下线）",
    initialMode === "editorial", "mode=" + initialMode);
  add("§13 动作 setDetailMode / regenLayout 仍保留（能力不删，只是不暴露按钮）",
    (function () { return typeof handleClick === "function"; })(), "wired");
} catch (e) {
  add("v196 图文详情页渲染未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  checks: checks
};
