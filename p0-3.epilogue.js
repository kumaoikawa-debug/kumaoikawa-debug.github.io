// P0-3 验收：活动详情页「双层详情」结构断言
// ⚠️ 冒烟夹具契约：本文件会被包进 async 函数体，必须以「裸顶层 return」返回结果对象；
//    且顶层需含 ok:false 才能让夹具判定失败（夹具只检查顶层键 === false）。
// 复用页面真实渲染函数 renderActivityPhone（activities.js）：
//  1) 页面含 A.内容包装层(layer-packaging) / B.报名决策层(layer-decision) 两个显式层
//  2) 包装层在决策层之前（基础信息退居第二层）
//  3) 包装层含 主标题/副标题/情绪引子/图文故事/场景体验/活动价值/情绪收束
//  4) 决策层含 时间·地点·集合 速览 + 费用/行程/适合人群 + 报名CTA
//  5) 第一屏不含「费用说明/详细行程」等字段表（决策内容只在第二层）
//  6) DNA 真正驱动包装文案（秋彩林 vs 亲子的 pullQuote/intro 不同）

// 夹具会跳过 boot.js，必须自行初始化全局 state
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);
/* v196 契约变更：详情页默认输出已从「简洁报名详情」改为「图文长页」（模式二选一已下线）。
   本夹具测的是【双层详情页 layer-packaging/layer-decision】，属于 lean 输出，
   因此必须显式选择 —— 依赖全局默认值的写法在 v196 之后会全部落空。 */
state.detailMode = "lean";

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });

function mkActivity(over) {
  const base = {
    id: "p03-" + Math.random().toString(36).slice(2, 7),
    type: "徒步",
    title: "秋季彩林徒步 · 龙门山环线",
    place: "龙门山",
    date: "2026-10-18",
    dateMD: "10月18日",
    meeting: "成都天府广场",
    price: 199,
    limitUnit: "人",
    limit: 25,
    days: 1,
    distance: 12,
    elevation: 1100,
    difficulty: "中等",
    photos: Array.from({ length: 6 }, (_, i) => "https://example.com/p" + i + ".jpg"),
    tags: ["赏秋", "摄影"],
    body: ["第一段文字。", "第二段文字。"],
    sellingPoints: [],
    highlights: [["12公里环线", "mountain"], ["限25人小队", "users"]],
    feeInclude: ["往返大巴", "专业领队", "户外保险"],
    feeExclude: ["午餐"],
    includeLeader: true,
    includeInsurance: true,
    confirmed: [{ key: "services" }, { key: "difficulty" }, { key: "age", val: "8-60岁" }],
    ageRange: "8-60岁",
    itineraryDays: [
      { label: "成都—龙门山—上山", sub: "", items: [{ time: "08:00", text: "集合出发" }, { time: "10:30", text: "开始徒步" }] },
      { label: "下山—返程", sub: "", items: [{ time: "15:00", text: "下山" }, { time: "17:30", text: "回到成都" }] }
    ]
  };
  return Object.assign(base, over || {});
}

let detail = { a1: null, a2: null, h1: "", h2: "" };
try {
  // —— 秋彩林徒步 ——
  const a1 = mkActivity({ type: "徒步", title: "秋季彩林徒步 · 龙门山环线", place: "龙门山", distance: 12, elevation: 1100, season: "秋" });
  if (typeof applyDnaCopyFallback === "function") applyDnaCopyFallback(a1);
  const h1 = renderActivityPhone(a1);

  // —— 亲子轻徒步（不同基因）——
  const a2 = mkActivity({ type: "徒步", title: "亲子轻徒步 · 森林公园自然课", place: "森林公园", distance: 4, elevation: 120, season: "夏", tags: ["亲子", "自然"] });
  if (typeof applyDnaCopyFallback === "function") applyDnaCopyFallback(a2);
  const h2 = renderActivityPhone(a2);

  detail = { a1: a1, a2: a2, h1: h1, h2: h2 };

  add("双层结构存在（layer-packaging + layer-decision）",
    h1.includes("layer-packaging") && h1.includes("layer-decision"),
    "packaging=" + h1.includes("layer-packaging") + " decision=" + h1.includes("layer-decision"));
  add("包装层在决策层之前（基础信息退居第二层）",
    h1.indexOf("layer-packaging") > -1 && h1.indexOf("layer-packaging") < h1.indexOf("layer-decision"),
    "pack=" + h1.indexOf("layer-packaging") + " dec=" + h1.indexOf("layer-decision"));
  add("包装层含 主标题/副标题",
    h1.includes("lead-title") && h1.includes("lead-subtitle"),
    "title=" + h1.includes("lead-title") + " sub=" + h1.includes("lead-subtitle"));
  add("包装层含 图文故事(v2-img) + 情绪引子(v13-story)",
    h1.includes("v2-img") && h1.includes("v13-story"),
    "v2-img=" + h1.includes("v2-img") + " v13-story=" + h1.includes("v13-story"));
  add("包装层含 场景体验/活动价值（叙事块 v13-narrative）",
    h1.includes("v13-narrative") && h1.includes("data-narr="),
    "narrative=" + h1.includes("v13-narrative"));
  add("包装层含 情绪收束（atmosphere 记忆句）",
    h1.includes("atmosphere") || h1.includes("quote-mark"),
    "atmosphere=" + h1.includes("atmosphere"));
  add("决策层含 时间·地点·集合 速览(decision-meta) + 报名CTA(decision-cta)",
    h1.includes("decision-meta") && h1.includes("decision-cta"),
    "meta=" + h1.includes("decision-meta") + " cta=" + h1.includes("decision-cta"));
  add("决策层含 费用说明/详细行程/适合人群",
    h1.includes("费用说明") && h1.includes("详细行程") && (h1.includes("适合") || h1.includes("不适合")),
    "fee=" + h1.includes("费用说明") + " itin=" + h1.includes("详细行程") + " suit=" + (h1.includes("适合") || h1.includes("不适合")));
  add("第一屏非字段表（费用/行程只出现在决策层，晚于包装层与主标题）",
    h1.indexOf("layer-packaging") < h1.indexOf("layer-decision") &&
    h1.indexOf("layer-decision") < h1.indexOf("费用说明") &&
    h1.indexOf("lead-title") < h1.indexOf("费用说明"),
    "pack=" + h1.indexOf("layer-packaging") + " dec=" + h1.indexOf("layer-decision") + " fee=" + h1.indexOf("费用说明"));
  add("DNA 驱动包装文案差异化（秋彩林 vs 亲子 的 pullQuote/intro 不同）",
    !!a1.pullQuote && !!a2.pullQuote && a1.pullQuote !== a2.pullQuote && a1.intro !== a2.intro,
    "p1=" + JSON.stringify(a1.pullQuote) + " p2=" + JSON.stringify(a2.pullQuote));
  add("亲子版渲染同样为双层结构",
    h2.includes("layer-packaging") && h2.includes("layer-decision") && h2.includes("decision-meta"),
    "pkg=" + h2.includes("layer-packaging") + " dec=" + h2.includes("layer-decision") + " meta=" + h2.includes("decision-meta"));
} catch (e) {
  add("详情页渲染未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  checks: checks
};
