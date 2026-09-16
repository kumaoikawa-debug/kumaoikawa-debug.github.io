// v192 验收：图文详情页「照片驱动」配图分配（每节至少 1 张 / 照片不浪费 / 图廊必有 / 变体上限不变）
// ⚠️ 夹具契约：本文件被包进 async 函数体 → 必须「裸顶层 return」；顶层需含 ok:false 才判失败。
state = (typeof initState === "function") ? initState() : loadState();
state.detailMode = "editorial";

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
const count = (h, re) => (String(h).match(re) || []).length;

function mk(n, extra) {
  return Object.assign({
    id: "v192-" + n + "-" + Math.random().toString(36).slice(2, 6),
    type: "徒步", title: "秋季彩林徒步 · 龙门山环线", place: "龙门山",
    date: "2026-10-18", dateMD: "10月18日", meeting: "成都天府广场",
    price: 199, limitUnit: "人", limit: 25, days: 1, distance: 12, elevation: 1100, difficulty: "中等",
    intro: "秋天的龙门山，是一整片会流动的颜色。",
    photos: Array.from({ length: n }, (_, i) => "https://example.com/p" + i + ".jpg"),
    photoCaptions: ["刚出林线，风突然大起来", "垭口回望，层林尽染"],
    tags: ["赏秋"], season: "秋",
    whyGo: "秋季彩林层林尽染，12 公里环线把龙门山最美的一段串起来。",
    experience: "踩着落叶一级级往上，出林线后视野突然打开。",
    gain: "带走一身松脂味和几十张不用修的照片。",
    fitFor: "有基础徒步经验、想认真走一段秋色的人。",
    sellingPoints: [{ title: "本地领队", desc: "熟悉每一处观景点" }],
    body: ["出发前夜下了点雨。", "领队讲了很多山里的故事。"],
    feeInclude: ["往返大巴", "专业领队"], feeExclude: ["午餐"], includeLeader: true,
    itineraryDays: [{ label: "成都—龙门山", items: [{ time: "08:00", text: "集合出发" }, { time: "10:30", text: "开始徒步" }] }],
    confirmed: [{ key: "services" }, { key: "difficulty" }],
  }, extra || {});
}
// 取出「正文章节（排除结尾图廊）」里每个章节的配图数
function secFigCounts(html) {
  const parts = String(html).split('class="xh-ed-sec').slice(1);
  return parts.map((p) => {
    const isGallery = /gallery/.test(p.slice(0, 60));
    return { gallery: isGallery, figs: count(p, /class="xh-ed-fig /g) };
  }).filter((x) => !x.gallery);
}

try {
  add("v192：分配计划函数已注册（planEditorialPhotoCaps / galleryMaxFor）",
    typeof planEditorialPhotoCaps === "function" && typeof galleryMaxFor === "function");

  // —— 1) 10 张图：每个正文章节都要有图（旧行为：8 张时只铺满 2 个头节）——
  const a10 = mk(10);
  const o10 = buildEditorialOutline(a10, editorialVariantOf(a10));
  const h10 = renderActivityPhone(a10);
  const c10 = secFigCounts(h10);
  add("v192：10 张图 → 每个正文章节都有配图（photo-driven）",
    c10.length > 0 && c10.every((s) => s.figs >= 1),
    "章节=" + c10.length + " 有图=" + c10.filter((s) => s.figs >= 1).length + " 分布=" + c10.map((s) => s.figs).join("/"));

  // —— 2) 4 张图（图少）：也要尽量铺开，而不是把 3 张全塞进同一节 ——
  const a4 = mk(4);
  const h4 = renderActivityPhone(a4);
  const c4 = secFigCounts(h4);
  const withFig4 = c4.filter((s) => s.figs >= 1).length;
  add("v192：4 张图 → 至少铺到 2 个章节（旧行为：仅 1 节、且一节塞 3 张）",
    withFig4 >= 2 && c4.every((s) => s.figs <= 3),
    "有图节=" + withFig4 + " 分布=" + c4.map((s) => s.figs).join("/"));

  // —— 3) 照片不浪费：hero-mosaic 下 20 张图应全部用上（章节 + 图廊 + 封面）——
  const a20 = mk(20, { editorialLayoutId: "L-mosaic-story" });
  const h20 = renderActivityPhone(a20);
  const secFigs20 = count(h20, /class="xh-ed-fig /g);
  const galPh20 = count(h20, /class="ph /g);
  add("v192：20 张图（mosaic）→ 章节+图廊+封面用满，几乎不浪费",
    secFigs20 + galPh20 >= 18,
    "章节图=" + secFigs20 + " 图廊图=" + galPh20 + " 合计=" + (secFigs20 + galPh20) + "/20");

  // —— 4) 每节配图数不超过变体上限（big-solo / gallery-strip = 1）——
  ["L-solo-route", "L-strip-exp"].forEach((lid) => {
    const a = mk(14, { editorialLayoutId: lid });
    const c = secFigCounts(renderActivityPhone(a));
    add("v192：版式 " + lid + " 每节配图 ≤ 1（变体上限不被突破）",
      c.length > 0 && c.every((s) => s.figs <= 1),
      "分布=" + c.map((s) => s.figs).join("/"));
  });
  const aMosaic = mk(14, { editorialLayoutId: "L-mosaic-story" });
  const cMosaic = secFigCounts(renderActivityPhone(aMosaic));
  add("v192：版式 L-mosaic-story 允许每节 2 张（富余照片补第二节）",
    cMosaic.some((s) => s.figs === 2), "分布=" + cMosaic.map((s) => s.figs).join("/"));

  // —— 5) 结尾「现场影像」图廊：照片 ≥4 张（池子 ≥3）时必须存在（p0-4 长图文契约）——
  //        照片仅 3 张时优先把图铺进章节（否则整页只剩 1 节有图），不强求图廊。
  const galOk = [4, 5, 9, 15, 30].every((n) => /xh-ed-gallery/.test(renderActivityPhone(mk(n))));
  add("v192：照片 ≥4 张时结尾必有「现场影像」图廊", galOk);
  const c3 = secFigCounts(renderActivityPhone(mk(3)));
  add("v192：照片仅 3 张 → 优先铺章节（≥2 节有图），不强占图廊",
    c3.filter((s) => s.figs >= 1).length >= 2,
    "有图节=" + c3.filter((s) => s.figs >= 1).length + " 分布=" + c3.map((s) => s.figs).join("/"));

  // —— 6) 同一张照片不重复出现在正文两个章节里（usedSet 生效）——
  const a12 = mk(12);
  const h12 = renderActivityPhone(a12);
  const srcs = (h12.match(/class="xh-ed-fig [\s\S]*?<img src="([^"]+)"/g) || []).map((m) => (m.match(/<img src="([^"]+)"/) || [])[1]).filter(Boolean);
  const uniq = Array.from(new Set(srcs));
  add("v192：正文配图不重复用图（每张照片只出现一次）", srcs.length === uniq.length, "总数=" + srcs.length + " 去重=" + uniq.length);

  // —— 7) 纯函数：planEditorialPhotoCaps 的边界（图 ≤ 章节数 / 图远多于章节）——
  const secs7 = buildEditorialOutline(mk(6), editorialVariantOf(mk(6)));
  const pFew = planEditorialPhotoCaps(3, secs7, 0, 2, galleryMaxFor(3));
  add("v192：图少于章节数 → 每节上限 1、图廊预留不挤占唯一一张",
    Object.keys(pFew.caps).every((k) => pFew.caps[k] === 1) && pFew.reserveN <= 1,
    "caps全为1=" + Object.keys(pFew.caps).every((k) => pFew.caps[k] === 1) + " reserveN=" + pFew.reserveN);
  const pMany = planEditorialPhotoCaps(30, secs7, 0, 3, galleryMaxFor(30));
  const capsSum = Object.keys(pMany.caps).reduce((n, k) => n + pMany.caps[k], 0);
  add("v192：图远多于章节（30 张）→ 章节吃满上限 + 图廊受 galleryMax 约束",
    capsSum + pMany.reserveN + 1 === 30 && pMany.reserveN <= 9,
    "章节合计=" + capsSum + " 图廊=" + pMany.reserveN + " 总计=" + (capsSum + pMany.reserveN + 1));

  // —— 8) editorialPhotosFor 的 cap 参数被尊重（旧调用不传 cap → 回退 sec.imgCount）——
  const aCap = mk(12);
  const sec0 = { key: "why", kind: "scenic", imgCount: 2 };
  const set1 = new Set([0]);
  const r1 = editorialPhotosFor(aCap, sec0, set1, 1);
  const set2 = new Set([0]);
  const r2 = editorialPhotosFor(aCap, sec0, set2, 3);
  const set3 = new Set([0]);
  const r3 = editorialPhotosFor(aCap, { key: "why", kind: "scenic" }, set3);
  add("v192：editorialPhotosFor 尊重 cap（1→≤1 / 3→≤3 / 缺省回退 imgCount=2）",
    r1.length <= 1 && r1.length >= 1 && r2.length <= 3 && r2.length >= 2 && r3.length <= 2 && r3.length >= 1,
    "cap1=" + r1.length + " cap3=" + r2.length + " 缺省=" + r3.length);

  // —— 9) 回归护栏：sec.imgCount 仍由变体 img 结构决定（P0-12 语义未被改写）——
  const vMosaic = { angle: "scenery", structure: "story", img: "hero-mosaic", density: "magazine" };
  const vSolo = { angle: "challenge", structure: "route", img: "big-solo", density: "documentary" };
  const oM = buildEditorialOutline(mk(12), vMosaic);
  const oS = buildEditorialOutline(mk(12), vSolo);
  const sum = (o) => o.reduce((n, s) => n + (s.imgCount || 0), 0);
  add("v192：sec.imgCount 仍随变体变化（mosaic 2/节 > big-solo 1/节）",
    sum(oM) > sum(oS) && oM[0].imgKind === "mosaic" && oS[0].imgKind === "big",
    "mosaic=" + sum(oM) + " big-solo=" + sum(oS) + " kind=" + oM[0].imgKind + "/" + oS[0].imgKind);
} catch (e) {
  add("v192 断言未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  total: checks.length,
  passed: checks.filter((c) => c.pass).length,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  checks
};
