// P0-5 验收：Itinerary Structuring（行程结构化 · 双表达并存）
// ⚠️ 夹具契约：本文件被包进 async 函数体，必须「裸顶层 return」返回；含 ok:false 才判失败。
// 验证：老板原始行程 → 结构化数据 [{time,fact,contentRole}]；输出「结构型行程（真实时间表）」
//       +「内容型行程（体验叙事）」两种表达同时存在，且内容叙事保留真实时间、不替换时间表。
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

  // ③ 内容型行程：体验叙事（保留真实时间锚点，不替换时间表）
  const nar = (typeof buildItineraryNarrative === "function") ? buildItineraryNarrative(a, tl) : { paras: [] };
  const narText = (nar.paras || []).join(" ");
  add("内容型行程：生成可读体验叙事（≥2 段）", (nar.paras || []).length >= 2, "paras=" + (nar.paras || []).length);
  add("内容型叙事保留真实时间锚点（含 08:00 / 12:00 / 15:30）",
    narText.includes("08:00") && narText.includes("12:00") && narText.includes("15:30"),
    "sample=" + narText.slice(0, 48));
  // 内容叙事不得出现时间表之外的任意时间点（证明未编造事件）
  const narTimes = (narText.match(/\d{1,2}:\d{2}/g) || []);
  add("内容型叙事未编造新时间点（所有时间都在真实时间表内）",
    narTimes.every((t) => realTimes.includes(t)), "narTimes=" + narTimes.join(","));

  // ④ 两种表达同时存在于「简洁报名详情」
  state.detailMode = "lean";
  const lean = renderActivityPhone(a);
  add("简洁页含结构型时间轴（真实时间表 tl-item）", lean.includes('class="timeline"') && lean.includes("tl-item"), "tl=" + lean.includes("tl-item"));
  add("简洁页含内容型叙事（itin-narrative）", lean.includes("itin-narrative"), "nar=" + lean.includes("itin-narrative"));
  add("简洁页真实时间出现在结构型时间轴", realTimes.every((t) => lean.includes(t)), "times=" + realTimes.every((t) => lean.includes(t)));

  // ⑤ 两种表达同时存在于「图文长页」
  state.detailMode = "editorial";
  const ed = renderActivityPhone(a);
  add("图文页含结构型时间轴", ed.includes('class="timeline"') && ed.includes("tl-item"));
  add("图文页含内容型叙事", ed.includes("itin-narrative"));

  // ⑥ 两种表达结构独立：内容叙事块与时间轴块共存，非互相替换
  add("两种表达并存且不互相替换（叙事块 + 时间轴块 各自独立存在）",
    (ed.match(/itin-narrative/g) || []).length >= 1 && (ed.match(/tl-item/g) || []).length >= 5,
    "narBlocks=" + (ed.match(/itin-narrative/g) || []).length + " tlItems=" + (ed.match(/tl-item/g) || []).length);

  dbg = { tlLen: tl.length, narParas: (nar.paras || []).length, leanTl: count(lean, /tl-item/g), edTl: count(ed, /tl-item/g) };
} catch (e) {
  add("行程双表达渲染未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  checks
};
