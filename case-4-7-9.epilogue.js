// §六 最终验收：Case 4 / 7 / 9 的能力断言（确定性夹具，不依赖 AI Key 与视觉模型）
// ⚠️ 夹具契约：本文件被包进 async 函数体，必须「裸顶层 return」返回；顶层需含 ok:false 才判失败。
//   Case 4：露营昼夜素材 → 自动形成 白天→夜晚 情绪节奏
//   Case 7：雪山挑战 → 强度/海拔/装备/安全 信息权重提高，页面更专业
//   Case 9：同一活动换风格（家族）→ 事实一致、图文结构明显不同
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });

let dbg = {};
try {
  /* ============ Case 9：同一活动换风格 → 结构随家族明显不同 ============ */
  const a9 = {
    id: "case9", type: "徒步", title: "秋季彩林徒步 · 龙门山环线", place: "龙门山",
    date: "2026-10-18", dateMD: "10月18日", days: 1, distance: 12, elevation: 1100,
    difficulty: "中等", price: 199, limit: 25, limitUnit: "人", ageRange: "8-60岁",
    gear: [{ name: "防滑徒步鞋", must: true }], tags: ["赏秋"], photos: [],
  };
  const p9 = (typeof typeProfile === "function") ? typeProfile(a9) : { kind: "hike", themeA: "徒步", tone: "松弛" };
  const fams = ["route_editorial", "challenge_editorial", "photo_documentary"];
  const structs = fams.map((f) => heuristicDirection(a9, p9, f, "recruit", {}).structure);
  const sigs = structs.map((s) => s.join("|"));
  dbg.structs = sigs;

  add("Case9 换风格：三个家族产出的图文结构互不相同", new Set(sigs).size === 3, sigs.map((s, i) => fams[i] + "→" + s).join(" // "));
  add("Case9 每个家族结构 ≥4 节且标题非空",
    structs.every((s) => Array.isArray(s) && s.length >= 4 && s.every((h) => h && String(h).trim().length >= 2)),
    structs.map((s) => s.length).join("/"));

  // 事实一致性：结构变化不应导致 fallback 正文出现空段（每个标题都要路由到某个正文桶）
  const m9 = { confirmedFacts: (typeof extractFacts === "function") ? extractFacts(a9, []) : {} };
  let emptyHeads = [];
  structs.forEach((s) => s.forEach((h) => {
    const body = (typeof sectionBody === "function") ? sectionBody(h, a9, m9) : "";
    if (!body || !String(body).replace(/<[^>]+>/g, "").trim()) emptyHeads.push(h);
  }));
  add("Case9 结构变化后：每个新标题都能产出非空 fallback 正文（事实未丢）", emptyHeads.length === 0, "empty=" + emptyHeads.join(","));

  /* ============ Case 7：雪山挑战 → 强度/海拔/装备/安全 权重提高 ============ */
  const a7 = {
    id: "case7", type: "高海拔登山", title: "四姑娘山雪山挑战", place: "四姑娘山",
    date: "2026-01-10", days: 2, distance: 12, elevation: 4500, difficulty: "挑战",
    gear: [{ name: "冰爪" }, { name: "安全带" }, { name: "头盔" }],
    insurance: "户外高风险保险", safety: ["高反应急预案"], photos: [],
  };
  const m7 = {
    confirmedFacts: {
      activityName: "四姑娘山雪山挑战", place: "四姑娘山", elevation: 4500, difficulty: "挑战",
      distance: 12, days: 2, gear: ["冰爪", "安全带", "头盔"], photosCount: 0,
    },
  };
  const cPro0 = generateSectionCopy("你会体验什么", m7, a7, 0);
  const cPro1 = generateSectionCopy("你会体验什么", m7, a7, 1);
  const cSafe = generateSectionCopy("强度与安全须知", m7, a7, 0);
  dbg.pro0 = cPro0; dbg.pro1 = cPro1; dbg.safe = cSafe;

  add("Case7 高强度：体验段显性给出目标海拔（4500 米）", /4500/.test(cPro0), cPro0.slice(0, 80));
  add("Case7 高强度：体验段给出装备底线（冰爪/安全带）", /冰爪/.test(cPro1) || /安全带/.test(cPro1), cPro1.slice(0, 80));
  add("Case7 强度/安全段：汇总硬指标（海拔+装备+保险）",
    /4500/.test(cSafe) && /冰爪/.test(cSafe) && /保险/.test(cSafe), cSafe.slice(0, 120));

  // 低强度活动不应被套用高强度专业话术（避免过度渲染风险）
  const aEz = { id: "case7b", type: "亲子", title: "亲子自然观察", place: "城市公园", days: 1, distance: 2, elevation: 50, difficulty: "轻松", photos: [] };
  const mEz = { confirmedFacts: { place: "城市公园", elevation: 50, difficulty: "轻松", gear: ["水壶"], days: 1, distance: 2 } };
  const cEz = generateSectionCopy("你会体验什么", mEz, aEz, 0);
  add("Case7 低强度：不套用高强度专业话术（差异化生效）", !/这不是轻松的散步/.test(cEz), cEz.slice(0, 80));

  /* ============ Case 4：露营昼夜素材 → 白天→夜晚 情绪节奏 ============ */
  const photos = [];
  for (let i = 0; i < 6; i++) photos.push({ src: "https://ex.com/day" + i + ".jpg", isNight: false });
  for (let i = 0; i < 4; i++) photos.push({ src: "https://ex.com/night" + i + ".jpg", isNight: true });
  const a4 = {
    id: "case4", type: "露营", title: "秋季营地露营 · 昼夜", place: "营地", days: 2,
    elevation: 800, difficulty: "轻松", photos: photos,
    itineraryDays: [
      { label: "抵达营地", items: [{ time: "10:00", text: "扎营、准备午餐" }, { time: "14:00", text: "周边徒步" }] },
      { label: "返程", items: [{ time: "09:00", text: "拔营" }, { time: "12:00", text: "返回市区" }] },
    ],
  };
  const PIPE = (typeof CLUBOS_PIPELINE !== "undefined") ? CLUBOS_PIPELINE : {};
  const dn = (typeof PIPE.photoDayNight === "function") ? PIPE.photoDayNight(photos) : null;
  dbg.dayNight = dn ? { day: dn.dayCount, night: dn.nightCount, hasRhythm: dn.hasRhythm } : null;

  add("Case4 昼夜识别：正确区分白天 6 张 / 夜晚 4 张",
    !!dn && dn.dayCount === 6 && dn.nightCount === 4 && dn.hasRhythm === true,
    JSON.stringify(dbg.dayNight));

  // 固定变体，保证结构顺序确定性（story: why→experience→night→gain→fit）
  const fixedVariant = { angle: "scenery", structure: "story", img: "hero-mosaic", density: "magazine", layout: "L-mosaic-story", style: "S-scenery-mag" };
  const ol4 = buildEditorialOutline(a4, fixedVariant);
  const keys4 = ol4.map((s) => s.key);
  const iNight = ol4.findIndex((s) => s.kind === "night");
  const iExp = ol4.findIndex((s) => s.group === "experience");
  const iGain = ol4.findIndex((s) => s.group === "gain");
  dbg.outline4 = keys4.join(",");

  add("Case4 长页自动注入「入夜」章节", iNight >= 0, keys4.join(","));
  /* v214 契约变更：叙事大纲里不再有 route/day 章节（完整行程只由阅读页的 DAY 时间轴渲染一处，
     否则同一张时间表同屏出现两遍 —— v198 已定此约定）。所以「夜在白天行程之后」这句
     改为按叙事里的实际锚点断言：夜章节排在「体验」之后、「收获」之前，昼→夜情绪弧依然成立。 */
  add("Case4 昼→夜节奏：夜章节排在体验之后、收获之前（情绪弧成立）",
    iExp >= 0 && iNight > iExp && iGain >= 0 && iNight < iGain,
    "exp=" + iExp + " night=" + iNight + " gain=" + iGain + " | " + keys4.join(","));

  // 纯白天素材不应凭空造出「入夜」章节（不臆造未发生的夜晚）
  const a4d = Object.assign({}, a4, { photos: photos.slice(0, 6) });
  const ol4d = buildEditorialOutline(a4d, fixedVariant);
  add("Case4 纯白天素材：不生成「入夜」章节（不臆造）",
    !ol4d.some((s) => s.kind === "night"), ol4d.map((s) => s.key).join(","));

  // 夜章节配图应取自夜晚素材（节奏在配图层同样成立）
  const nightSec = ol4[iNight];
  if (nightSec && typeof PIPE.photoDayNight === "function") {
    const usedSet = new Set();
    const picked = (typeof editorialPhotosFor === "function") ? editorialPhotosFor(a4, nightSec, usedSet) : [];
    const nightIdx = dn.night;
    add("Case4 夜章节配图取自夜晚素材",
      picked.length > 0 && picked.every((i) => nightIdx.indexOf(i) >= 0),
      "picked=[" + picked.join(",") + "] night=[" + nightIdx.join(",") + "]");
  }
} catch (e) {
  add("验收脚本执行未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  total: checks.length,
  passed: checks.length - failed.length,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  dbg: dbg,
  checks
};
