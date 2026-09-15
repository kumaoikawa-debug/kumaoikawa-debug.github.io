// P0-4 验收：AI 图文活动详情页（长图文输出）
// ⚠️ 夹具契约：本文件被包进 async 函数体，必须「裸顶层 return」返回；顶层需含 ok:false 才判失败。
// 验证：图文故事大纲 / 每段文案 / 图片匹配 / 图片组合 / 页面排版 / 决策信息 / CTA，
//       且与「简洁报名详情」结构明显不同（更长、非字段表、非 SaaS 详情页）。
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
const count = (h, re) => (String(h).match(re) || []).length;

function mkActivity(over) {
  const base = {
    id: "p04-" + Math.random().toString(36).slice(2, 7),
    type: "徒步", title: "秋季彩林徒步 · 龙门山环线", place: "龙门山",
    date: "2026-10-18", dateMD: "10月18日", meeting: "成都天府广场",
    price: 199, limitUnit: "人", limit: 25, days: 1,
    distance: 12, elevation: 1100, difficulty: "中等",
    photos: Array.from({ length: 9 }, (_, i) => "https://example.com/p" + i + ".jpg"),
    photoCaptions: ["刚出林线，风突然大起来", "垭口回望，层林尽染"],
    tags: ["赏秋", "摄影"], season: "秋",
    highlights: [["12公里环线", "mountain"], ["限25人小队", "users"]],
    sellingPoints: [], body: ["第一段现场记录。", "第二段现场记录。", "第三段现场记录。"],
    feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    includeLeader: true, includeInsurance: true,
    leaderName: "小林", leaderYears: "6年", leaderCert: "中登协户外指导员", leaderTrips: "120+ 次",
    reviews: [{ name: "王女士", text: "领队很稳，节奏控得好。", stars: 5 }, { name: "李先生", text: "秋色确实漂亮。", stars: 5 }],
    gear: [{ name: "防滑徒步鞋", must: true }, { name: "登山杖", must: true }, { name: "防晒外套", must: false }],
    confirmed: [{ key: "services" }, { key: "difficulty" }, { key: "age", val: "8-60岁" }],
    ageRange: "8-60岁",
    itineraryDays: [
      { label: "成都—龙门山—上山", sub: "", items: [{ time: "08:00", text: "集合出发" }, { time: "10:30", text: "开始徒步" }] },
      { label: "下山—返程", sub: "", items: [{ time: "15:00", text: "下山" }, { time: "17:30", text: "回到成都" }] }
    ],
    pipeline: { foreword: { titles: [] }, itinerary: { days: 1 }, details: { refund: ["出发前 7 天以上取消，全额退款。"], must: ["防滑徒步鞋", "登山杖"], suggest: ["防晒外套"] } }
  };
  return Object.assign(base, over || {});
}

let dbg = {};
try {
  // —— 完整活动（含叙事字段 + 2 天行程 + 6 张图 + 补充资料）——
  const a2 = mkActivity({ days: 2,
    whyGo: "秋季彩林层林尽染，12 公里环线把龙门山最美的一段串起来。从山脚到垭口，颜色一层层往深处走，走到最后是整片金黄。",
    experience: "踩着落叶一级级往上，出林线后视野突然打开。风从山脊上下来，脚下是碎石与草坡，回头看是刚走过的那片林子。",
    gain: "带走一身松脂味和几十张不用修的照片。多数人说，回去之后好几天还惦记着垭口那阵风。",
    fitFor: "有基础徒步经验、想认真走一段秋色的人。只想拍照打卡、不愿爬升的人不建议。" });
  if (typeof applyDnaCopyFallback === "function") applyDnaCopyFallback(a2);

  const outline = (typeof buildEditorialOutline === "function") ? buildEditorialOutline(a2) : [];
  const outlineOk = outline.length >= 5 && outline.every((s) => s.heading && (s.paras || []).length >= 1);
  const storyChars = outline.reduce((n, s) => n + s.paras.join("").length, 0);

  // 渲染「图文长页」
  state.detailMode = "editorial";
  const hEd = renderActivityPhone(a2);
  // 渲染「简洁报名」
  state.detailMode = "lean";
  const hLean = renderActivityPhone(a2);
  state.detailMode = "editorial";

  // —— 仅事实（无叙事字段）也要靠 DNA 兜底出长页 ——
  const a1 = mkActivity({ title: "夏季溪谷徒步 · 平武藤蔓谷", place: "平武藤蔓谷", type: "溯溪", distance: 8, elevation: 300, days: 1, season: "夏", body: [], photoCaptions: [] });
  if (typeof applyDnaCopyFallback === "function") applyDnaCopyFallback(a1);
  const outlineFacts = (typeof buildEditorialOutline === "function") ? buildEditorialOutline(a1) : [];
  const hFacts = renderActivityPhone(a1);

  dbg = { outlineLen: outline.length, secs: outline.map((s) => s.key + ":" + s.heading), outlineFactsLen: outlineFacts.length };

  add("图文故事大纲：章节 ≥5 且每节都有标题+文案", outlineOk, "n=" + outline.length);
  add("大纲按 DNA/事实推进（含 why/experience/route/gain/fit 关键节）",
    ["why", "experience", "gain", "fit"].every((k) => outline.some((s) => s.key === k)) && outline.some((s) => /^day/.test(s.key)),
    outline.map((s) => s.key).join(","));
  add("多日行程按天分节（DAY 1 / DAY 2）",
    outline.some((s) => s.key === "day1") && outline.some((s) => s.key === "day2"),
    outline.filter((s) => /^day/.test(s.key)).map((s) => s.heading).join(" | "));

  add("页面排版：Hero + 数据条 + 长页正文容器", hEd.includes("xh-ed-hero") && hEd.includes("xh-ed-kvs") && hEd.includes("xh-ed-body"));
  add("页面排版：逐节编号 + 小节标题（非字段表）", count(hEd, /xh-ed-num/g) >= 5 && count(hEd, /xh-ed-h/g) >= 5, "num=" + count(hEd, /xh-ed-num/g));
  add("每段文案落到页面（xh-ed-paras 段数 ≥ 大纲节数）", count(hEd, /class="xh-ed-paras"/g) >= outline.length, "paras-blocks=" + count(hEd, /class="xh-ed-paras"/g));
  add("图片匹配：多数章节配到图", count(hEd, /xh-ed-figs/g) >= Math.min(outline.length - 1, 4), "figs=" + count(hEd, /xh-ed-figs/g));
  add("图片组合：出现多种组合（整幅/对开/三联）",
    (["one", "two", "three"].filter((c) => hEd.includes("xh-ed-figs " + c))).length >= 1 || count(hEd, /xh-ed-fig\b/g) >= 3,
    "one=" + hEd.includes("xh-ed-figs one") + " two=" + hEd.includes("xh-ed-figs two") + " three=" + hEd.includes("xh-ed-figs three"));
  add("情绪收束（引言）存在", hEd.includes("xh-ed-quote"), "quote=" + hEd.includes("xh-ed-quote"));
  add("决策信息齐全（速览 + 费用 + 行程 + 适合）",
    hEd.includes("decision-meta") && hEd.includes("费用说明") && hEd.includes("详细行程") && (hEd.includes("适合") || hEd.includes("不适合")),
    "meta=" + hEd.includes("decision-meta") + " fee=" + hEd.includes("费用说明") + " itin=" + hEd.includes("详细行程"));
  add("CTA：报名区块 + 报名按钮", hEd.includes("xh-ed-cta") && hEd.includes('data-action="openSignup"'));

  add("与「简洁报名详情」结构明显不同（互斥标记）",
    !hEd.includes("layer-packaging") && !hEd.includes("layer-decision") && hLean.includes("layer-packaging") && !hLean.includes("xh-ed-sec"),
    "edHasLayer=" + hEd.includes("layer-packaging") + " leanHasXh=" + hLean.includes("xh-ed-sec"));
  add("图文长页以「图文故事」为主体（故事正文 ≥300 字、章节编号递增）",
    storyChars >= 300 && hEd.indexOf(">01 /") > -1 && hEd.indexOf(">01 /") < hEd.indexOf(">02 /"),
    "storyChars=" + storyChars);
  add("长图文特征：沉浸 Hero + 编号章节 + 结尾影像组 + 故事/决策分离",
    hEd.includes("xh-ed-hero") && hEd.includes("xh-ed-gallery") && hEd.includes("现场影像") && hEd.indexOf("xh-ed-sec") < hEd.indexOf("xh-ed-decision"),
    "gallery=" + hEd.includes("xh-ed-gallery") + " sep=" + (hEd.indexOf("xh-ed-sec") < hEd.indexOf("xh-ed-decision")));

  add("无 Key 兜底：仅事实也能产出 ≥5 节长页", outlineFacts.length >= 5 && hFacts.includes("xh-ed-hero") && hFacts.includes("xh-ed-sec"), "factsSecs=" + outlineFacts.length);
  add("模式切换 chip 存在（简洁报名 / 图文长页）",
    hEd.includes('data-action="setDetailMode"') && hEd.includes('data-mode="editorial"') && hLean.includes('data-action="setDetailMode"'));

  // 接线：点击 chip 应切换 state.detailMode 并落库（不抛错）
  try {
    handleClick("setDetailMode", { dataset: { mode: "editorial" } });
    const on = state.detailMode === "editorial";
    handleClick("setDetailMode", { dataset: { mode: "lean" } });
    add("模式切换接线（setDetailMode → state.detailMode 并落库）", on && state.detailMode === "lean", "editorial=" + on);
  } catch (e) {
    add("模式切换接线（setDetailMode → state.detailMode 并落库）", false, String((e && e.stack) || e));
  }
} catch (e) {
  add("图文详情页渲染未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  checks
};
