// P0-5 验收：Itinerary Structuring（行程结构化）—— v198 契约更新
// ⚠️ 夹具契约：本文件被包进 async 函数体，必须「裸顶层 return」返回；含 ok:false 才判失败。
// v198 老板反馈「详情页多次出现详细行程，一直大重复，没有实现智能编辑」：
//   ① 阅读页（lean / editorial）完整行程只出现一次（DAY 时间轴），叙事块不再同屏复述；
//   ② 叙事（仅保留在后台行程编辑面板预览）必须是「节奏摘要」——不逐条复述中间时间点；
//   ③ 角色分类：closing 项（抵达…活动结束）不得再被误判为 arrival。
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
const count = (h, re) => (String(h).match(re) || []).length;

function mkActivity(over) {
  const base = (typeof blankActivity === "function") ? blankActivity() : { id: "x", itineraryDays: [], days: 1 };
  Object.assign(base, over || {});
  base.id = base.id || ("p05-" + Math.random().toString(36).slice(2, 7));
  base.itineraryDays = over && over.itineraryDays ? over.itineraryDays : (base.itineraryDays || []);
  base.days = Math.max(1, (base.itineraryDays || []).length || base.days || 1);
  return base;
}

let dbg = {};
try {
  // 老板在后台粘贴的真实行程（原始文本）
  const raw = [
    "08:00 集合签到",
    "10:30 抵达徒步起点",
    "12:00 午餐（路餐）",
    "14:00 登顶观景",
    "15:30 返程解散"
  ].join("\n");

  // ① 老板原始输入 → 结构化数据（itineraryDays）
  const parsed = (typeof parseItinerary === "function") ? parseItinerary(raw) : [];
  add("老板原始行程解析为结构化 itineraryDays", Array.isArray(parsed) && parsed.length >= 1 && parsed.some((d) => (d.items || []).length >= 4), "days=" + parsed.length);

  const a = mkActivity({
    title: "赵公山轻徒步", type: "徒步", place: "彭州", distance: 12, days: 1,
    itineraryDays: parsed, price: 168, limit: 25, limitUnit: "人", meeting: "成都天府广场", dateMD: "10月12日"
  });

  // ② 结构化数据：[{time, fact, contentRole}]，保留真实时间表
  const itin = (typeof structureItinerary === "function") ? structureItinerary(a) : { timeline: [] };
  const tl = itin.timeline || [];
  const realTimes = ["08:00", "10:30", "12:00", "14:00", "15:30"];
  add("结构型行程：真实时间表转为结构化数组", Array.isArray(tl) && tl.length >= 5, "len=" + tl.length);
  add("结构化数据含 time / fact / contentRole 三字段", tl.length > 0 && tl.every((t) => "time" in t && "fact" in t && "contentRole" in t));
  add("结构型行程保留真实时间表（08:00/10:30/12:00/14:00/15:30 原样，未改写）",
    realTimes.every((t) => tl.some((x) => x.time === t)), "got=" + tl.map((x) => x.time).join(","));
  add("contentRole 按语义归类（opening/arrival/core/meal/closing 齐全）",
    ["opening", "arrival", "core", "meal", "closing"].every((r) => tl.some((x) => x.contentRole === r)),
    tl.map((x) => x.contentRole).join(","));
  // v198：closing 先于 arrival 判定 —— 「15:30 返程解散」必须是 closing 而非 arrival
  const closingItem = tl.find((x) => x.time === "15:30");
  add("closing 优先于 arrival（15:30 返程解散 → closing，不再误判 arrival）",
    closingItem && closingItem.contentRole === "closing", "role=" + (closingItem && closingItem.contentRole));

  // ③ 叙事 = 节奏摘要（不再逐条复述时间表）
  const nar = (typeof buildItineraryNarrative === "function") ? buildItineraryNarrative(a, tl) : { paras: [] };
  const narText = (nar.paras || []).join(" ");
  add("体验叙事：生成可读节奏摘要（≥2 段）", (nar.paras || []).length >= 2, "paras=" + (nar.paras || []).length);
  add("体验叙事保留首尾时间锚点（08:00 / 15:30）",
    narText.includes("08:00") && narText.includes("15:30"), "sample=" + narText.slice(0, 48));
  // v198 核心：叙事不复述中间时间点（10:30/12:00/14:00 只属于 DAY 时间轴）
  add("叙事是摘要不是复述（中间时间点 10:30/12:00/14:00 不出现在叙事里）",
    !narText.includes("10:30") && !narText.includes("12:00") && !narText.includes("14:00"),
    "narTimes=" + (narText.match(/\d{1,2}:\d{2}/g) || []).join(","));
  const narTimes = (narText.match(/\d{1,2}:\d{2}/g) || []);
  add("叙事未编造新时间点（所有时间都在真实时间表内）",
    narTimes.every((t) => realTimes.includes(t)), "narTimes=" + narTimes.join(","));

  // ④ v198：阅读页（lean）完整行程只出现一次（时间轴），叙事块不再同屏
  state.detailMode = "lean";
  const lean = renderActivityPhone(a);
  add("简洁页含结构型时间轴（真实时间表 tl-item）", lean.includes('class="timeline"') && lean.includes("tl-item"), "tl=" + lean.includes("tl-item"));
  add("简洁页不再出现叙事复述块（itin-narrative 已从阅读页摘除）", !lean.includes("itin-narrative"), "nar=" + lean.includes("itin-narrative"));
  add("简洁页真实时间出现在结构型时间轴", realTimes.every((t) => lean.includes(t)), "times=" + realTimes.every((t) => lean.includes(t)));
  add("简洁页「详细行程」区块只出现一次", count(lean, /<h3>详细行程<\/h3>/g) === 1, "n=" + count(lean, /<h3>详细行程<\/h3>/g));

  // ⑤ v198：图文长页（editorial）同样时间轴唯一、无叙事复述
  state.detailMode = "editorial";
  const ed = renderActivityEditorial(a);
  add("图文页含结构型时间轴", ed.includes('class="timeline"') && ed.includes("tl-item"));
  add("图文页不再出现叙事复述块", !ed.includes("itin-narrative"));
  add("图文页「详细行程」区块只出现一次（底部目录条不计）", count(ed, /<h3>详细行程<\/h3>/g) === 1, "n=" + count(ed, /<h3>详细行程<\/h3>/g));
  add("阅读页时间轴唯一且完整（tl-item ≥5 且不互相替换）",
    (ed.match(/tl-item/g) || []).length >= 5, "tlItems=" + (ed.match(/tl-item/g) || []).length);

  dbg = { tlLen: tl.length, narParas: (nar.paras || []).length, leanTl: count(lean, /tl-item/g), edTl: count(ed, /tl-item/g) };
} catch (e) {
  add("行程结构化渲染未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  checks
};
