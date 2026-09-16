/* =========================================================================
   ClubOS · AI 经营分析（v191）
   文档依据：《ClubOS v142+ 今日新增优化需求补充文档》第十 ~ 二十九节。

   定位（务必守住）：
     不是财务系统。不做报销审批 / 发票审核 / 会计凭证 / 总账 / 审批流。
     只做一件事：记录每场活动的真实收入与核心成本，由 AI 给出经营结论。
       第一层 单场活动分析 → 第二层 同类活动横向比较
       → 第三层 12 个月滚动基线 → 第四层 活动产品盈利能力与组合

   三条硬约束：
     1) 收入优先自动读取（报名/补款/附加/退款）；成本轻量录入，绝不强制凭证。
     2) activityProductId 稳定 —— 同一产品不同批次（3月/5月/9月）必须归为同一经营产品。
     3) 事实与推测严格分离：没有元数据支撑时只能说「无法确认具体原因」，
        禁止归因为旺季、供应商涨价等未记录因素。
   ========================================================================= */

/* ------------------------- 一、常量 ------------------------- */

const ECON_COST_DEFS = [
  { key: "transport", label: "车辆", icon: "truck" },
  { key: "accommodation", label: "住宿", icon: "building" },
  { key: "meals", label: "餐饮", icon: "utensils" },
  { key: "leaders", label: "领队·工作人员", icon: "users" },
  { key: "insurance", label: "保险", icon: "shield" },
  { key: "tickets", label: "门票·场地", icon: "ticket" },
  { key: "materials", label: "物料", icon: "bag" },
  { key: "other", label: "其他", icon: "tag" }
];
const ECON_COST_KEYS = ECON_COST_DEFS.map((d) => d.key);
const ECON_COST_LABEL = ECON_COST_DEFS.reduce((m, d) => { m[d.key] = d.label; return m; }, {});
const ECON_COST_ICON = ECON_COST_DEFS.reduce((m, d) => { m[d.key] = d.icon; return m; }, {});
/* 变动成本（随人数变化）；车辆/住宿/门票/物料/其他视为固定成本。可在 economics.costModel 覆盖 */
const ECON_DEFAULT_VAR_KEYS = ["meals", "insurance"];

/* 成本自然语言关键词表（顺序敏感：更具体的在前） */
const ECON_COST_KW = [
  ["accommodation", ["住宿", "房费", "房钱", "单房差", "酒店", "民宿", "客栈", "营位", "营地费", "宾馆", "标间", "房间", "标房", "住宿费"]],
  ["transport", ["车辆", "车费", "大巴", "包车", "用车", "交通", "油费", "油钱", "过路", "停车", "司机", "班车", "接驳", "中巴", "商务车", "座位车", "车"]],
  ["meals", ["餐饮", "餐费", "吃饭", "午饭", "午餐", "晚饭", "晚餐", "早餐", "夜宵", "伙食", "餐厅", "烧烤", "食材", "聚餐", "餐"]],
  ["leaders", ["领队", "向导", "教练", "导游", "协作", "工作人员", "带队", "收队", "后勤", "人工", "劳务"]],
  ["insurance", ["保险", "投保", "保费", "意外险"]],
  ["tickets", ["门票", "景区票", "场地费", "场地", "索道", "摆渡", "通行费", "门票费"]],
  ["materials", ["物料", "物资", "装备租赁", "租赁", "租用", "耗材", "补给", "药品", "旗帜", "物料费"]]
];
const ECON_META_FIELDS = {
  transport: [
    { key: "vehicleType", label: "车辆型号" },
    { key: "supplier", label: "车辆供应商" },
    { key: "vehicleCount", label: "车辆数量" },
    { key: "distanceKm", label: "行驶公里数" }
  ],
  accommodation: [
    { key: "supplier", label: "住宿供应商" },
    { key: "roomCount", label: "房间数" },
    { key: "roomType", label: "房型" }
  ],
  meals: [
    { key: "supplier", label: "餐饮供应商" },
    { key: "mealType", label: "用餐形式" }
  ],
  leaders: [{ key: "supplier", label: "领队来源" }],
  insurance: [{ key: "supplier", label: "保险服务商" }],
  tickets: [{ key: "supplier", label: "门票/场地供应商" }],
  materials: [{ key: "supplier", label: "物料供应商" }],
  other: []
};

const ECON_SAMPLE_QUESTIONS = [
  "今年最赚钱的 5 条线路是什么？",
  "哪些活动收入很高但其实不赚钱？",
  "哪些活动建议下半年少做？",
  "哪条线路车费最容易失控？",
  "哪几个供应商价格上涨最快？",
  "今年露营和徒步哪个业务更赚钱？",
  "20 人的活动一般什么价格才不亏？",
  "哪些活动值得明年继续重点做？"
];

const ECON_CLASS_DEFS = [
  { key: "stable", label: "核心稳定产品", note: "长期稳定盈利，适合常规化持续运营" },
  { key: "profit", label: "高利润产品", note: "频次可能不高，但单场利润突出" },
  { key: "traffic", label: "引流产品", note: "利润一般，但拉新明显" },
  { key: "season", label: "季节产品", note: "特定月份表现突出" },
  { key: "optimize", label: "待优化产品", note: "有需求，但成本结构存在问题" },
  { key: "weak", label: "低效产品", note: "连续多场利润偏低，且没有明显其他经营价值" },
  { key: "new", label: "观察中", note: "样本不足 2 场，暂不判断" }
];

/* ------------------------- 二、基础工具 ------------------------- */

function econNum(v) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}
function econMoney(v) {
  const n = Math.round(econNum(v));
  const s = Math.abs(n).toLocaleString("en-US");
  return (n < 0 ? "-¥" : "¥") + s;
}
function econPct(v) {
  if (!isFinite(v)) return "—";
  return (v * 100).toFixed(1).replace(/\.0$/, "") + "%";
}
function econMean(arr) {
  const a = (arr || []).map(econNum).filter((x) => isFinite(x));
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}
function econMedian(arr) {
  const a = (arr || []).map(econNum).slice().sort((x, y) => x - y);
  if (!a.length) return 0;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
function econMode(arr) {
  const a = (arr || []).filter((v) => v !== undefined && v !== null && v !== "");
  if (!a.length) return "";
  const c = {};
  a.forEach((v) => { const k = String(v); c[k] = (c[k] || 0) + 1; });
  let best = "", n = 0;
  Object.keys(c).forEach((k) => { if (c[k] > n) { n = c[k]; best = k; } });
  return best;
}
/* 变异系数：衡量波动（越小越稳）。样本 <2 或均值 0 时返回 null */
function econCV(arr) {
  const a = (arr || []).map(econNum);
  if (a.length < 2) return null;
  const m = econMean(a);
  if (!m) return null;
  const sd = Math.sqrt(a.reduce((s, x) => s + Math.pow(x - m, 2), 0) / a.length);
  return sd / Math.abs(m);
}
function econPercentile(arr, p) {
  const a = (arr || []).map(econNum).slice().sort((x, y) => x - y);
  if (!a.length) return 0;
  const idx = Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)));
  return a[idx];
}
function econSeason(m) {
  const n = Number(m);
  if (n === 3 || n === 4 || n === 5) return "春";
  if (n === 6 || n === 7 || n === 8) return "夏";
  if (n === 9 || n === 10 || n === 11) return "秋";
  return "冬";
}

/* 活动日期归一：economics.startDate > departures[0].date > a.date > createdAt */
function econDateOf(a) {
  const e = (a && a.economics) || {};
  let iso = String(e.startDate || "").trim();
  if (!iso && a && a.departures && a.departures[0] && a.departures[0].date) iso = a.departures[0].date;
  if (!iso && a && a.date && /^(\d{4})年(\d{1,2})月(\d{1,2})日/.test(a.date)) {
    const m = a.date.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
    iso = m[1] + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[3]).padStart(2, "0");
  }
  if (!iso && a && /^\d{4}-\d{1,2}-\d{1,2}/.test(String(a.date || ""))) iso = String(a.date);
  const ts = iso ? new Date(iso + "T00:00:00").getTime() : econNum(a && a.createdAt);
  const d = new Date(ts || Date.now());
  return {
    iso: iso || (isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : ""),
    ts: isFinite(ts) ? ts : Date.now(),
    year: d.getFullYear(), month: d.getMonth() + 1, season: econSeason(d.getMonth() + 1),
    md: d.getMonth() + 1 + "月" + d.getDate() + "日"
  };
}

/* ------------------------- 三、数据模型 ------------------------- */

function econBlank() {
  const costs = {};
  ECON_COST_KEYS.forEach((k) => { costs[k] = 0; });
  return {
    productId: "",
    activityType: "", route: "", startDate: "", season: "",
    registeredParticipants: null, actualParticipants: null,
    revenue: { registration: null, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 },
    costs: costs,
    transportMeta: { supplier: "", vehicleType: "", vehicleCount: null, distanceKm: null, note: "" },
    accommodationMeta: { supplier: "", roomCount: null, roomType: "" },
    mealMeta: { supplier: "", mealType: "" },
    costModel: { variableKeys: ECON_DEFAULT_VAR_KEYS.slice() },
    priceOverride: null,
    source: "", note: "", updatedAt: 0
  };
}
function econOf(a) { return (a && a.economics) || null; }
function econEnsure(a) {
  if (!a.economics) a.economics = econBlank();
  const e = a.economics;
  if (!e.costs) e.costs = {};
  ECON_COST_KEYS.forEach((k) => { e.costs[k] = econNum(e.costs[k]); });
  if (!e.revenue) e.revenue = { registration: null, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 };
  if (!e.costModel || !(e.costModel.variableKeys || []).length) {
    e.costModel = { variableKeys: ECON_DEFAULT_VAR_KEYS.slice() };
  }
  if (!e.transportMeta) e.transportMeta = { supplier: "", vehicleType: "", vehicleCount: null, distanceKm: null, note: "" };
  if (!e.accommodationMeta) e.accommodationMeta = { supplier: "", roomCount: null, roomType: "" };
  if (!e.mealMeta) e.mealMeta = { supplier: "", mealType: "" };
  if (!e.productId && a.activityProductId) e.productId = a.activityProductId;
  if (!e.activityType) e.activityType = a.type || "";
  if (!e.route) e.route = a.route || a.place || "";
  return e;
}
/* 是否已录入过经营数据（成本或成本元数据任一非空） */
function econHasData(a) {
  const e = econOf(a);
  if (!e) return false;
  const costSum = ECON_COST_KEYS.reduce((s, k) => s + econNum(e.costs && e.costs[k]), 0);
  if (costSum > 0) return true;
  return !!(e.transportMeta && (e.transportMeta.vehicleType || e.transportMeta.supplier));
}

/* ------------------------- 四、人数与收入（自动读取） ------------------------- */

function econSignupsOf(a) {
  return (state.signups || []).filter((s) => s && s.activityId === (a && a.id));
}
/* 报名人次（成人 + 儿童） */
function econSignupPeople(a) {
  return econSignupsOf(a).reduce((t, s) => t + (+s.adults || 0) + (+s.children || 0), 0);
}
function econPrice(a, e) { return econNum((e && e.priceOverride) != null ? e.priceOverride : a && a.price); }
function econPeopleInfo(a, e) {
  e = e || econOf(a) || {};
  if (e.actualParticipants !== null && e.actualParticipants !== undefined && e.actualParticipants !== "") {
    return { people: econNum(e.actualParticipants), basis: "actual" };
  }
  if (e.registeredParticipants !== null && e.registeredParticipants !== undefined && e.registeredParticipants !== "") {
    return { people: econNum(e.registeredParticipants), basis: "registered" };
  }
  const sp = econSignupPeople(a);
  if (sp > 0) return { people: sp, basis: "signups" };
  return { people: econNum(a && a.signups), basis: "activity" };
}
function econPeople(a, e) { return econPeopleInfo(a, e).people; }

/* 报名收入：有报名记录时按记录算（儿童用 childPrice），否则人数 × 单价 */
function econAutoRegistration(a, e) {
  e = e || econOf(a) || {};
  const price = econPrice(a, e);
  const cp = (a && a.childPrice != null && a.childPrice !== "") ? econNum(a.childPrice) : price;
  const ss = econSignupsOf(a);
  if (ss.length) {
    return ss.reduce((t, s) => t + econNum(s.adults) * price + econNum(s.children) * cp, 0);
  }
  return econPeople(a, e) * price;
}
function econRevenue(a, e) {
  e = econEnsure(a);
  const r = e.revenue;
  const registration = (r.registration === null || r.registration === undefined || r.registration === "")
    ? econAutoRegistration(a, e) : econNum(r.registration);
  const total = registration + econNum(r.supplements) + econNum(r.addons) + econNum(r.other) - econNum(r.refunds);
  return { registration: registration, supplements: econNum(r.supplements), addons: econNum(r.addons), refunds: econNum(r.refunds), other: econNum(r.other), total: total, autoRegistration: (r.registration === null || r.registration === undefined || r.registration === "") };
}

/* ------------------------- 五、成本 ------------------------- */

function econCostTotal(e) {
  return ECON_COST_KEYS.reduce((s, k) => s + econNum(e && e.costs && e.costs[k]), 0);
}
function econVarKeys(e) {
  const vk = (e && e.costModel && e.costModel.variableKeys) || ECON_DEFAULT_VAR_KEYS;
  return vk.filter((k) => ECON_COST_KEYS.indexOf(k) >= 0);
}
function econFixedTotal(e) {
  const vk = econVarKeys(e);
  return ECON_COST_KEYS.filter((k) => vk.indexOf(k) < 0)
    .reduce((s, k) => s + econNum(e && e.costs && e.costs[k]), 0);
}
function econVarTotal(e) {
  const vk = econVarKeys(e);
  return vk.reduce((s, k) => s + econNum(e && e.costs && e.costs[k]), 0);
}
function econVarPerPerson(a, e) {
  e = e || econEnsure(a);
  const p = econPeople(a, e);
  if (p <= 0) return 0;
  return econVarTotal(e) / p;
}
function econCostBreakdown(e, people) {
  const rows = ECON_COST_DEFS.map((d) => ({
    key: d.key, label: d.label, icon: d.icon,
    amount: econNum(e && e.costs && e.costs[d.key]),
    perPerson: people > 0 ? econNum(e && e.costs && e.costs[d.key]) / people : 0,
    variable: econVarKeys(e).indexOf(d.key) >= 0
  })).filter((r) => r.amount > 0);
  return rows.sort((x, y) => y.amount - x.amount);
}

/* 成本自然语言解析：「今天大巴2800，吃饭1260，两个领队一共1000。」 */
function parseCostText(text) {
  const raw = String(text == null ? "" : text);
  const items = [];
  const unmatched = [];
  if (!raw.trim()) return { items: [], total: 0, unmatched: [], grouped: {} };
  const segs = raw.split(/[，,。;；\n\r、]+|\s{2,}|\s+和\s*|\s*＋\s*|\s*\+\s*/).map((s) => s.trim()).filter(Boolean);
  segs.forEach((seg) => {
    const nums = seg.match(/\d+(?:\.\d+)?\s*(?:万|w|W|k|K|千)?/g) || [];
    const amounts = nums.filter((n) => {
      const after = seg.slice(seg.indexOf(n) + n.length, seg.indexOf(n) + n.length + 2);
      return !/^\s*(个|人|台|辆|间|份|次|张|名|位)/.test(after);
    }).map((n) => {
      const v = parseFloat(n);
      if (/万|[wW]$/.test(n)) return v * 10000;
      if (/[kK]$|千/.test(n)) return v * 1000;
      return v;
    });
    if (!amounts.length) { if (/\d/.test(seg)) unmatched.push(seg); return; }
    const amount = amounts[amounts.length - 1];
    let key = "other";
    for (let i = 0; i < ECON_COST_KW.length; i++) {
      const k = ECON_COST_KW[i][0];
      if (ECON_COST_KW[i][1].some((w) => seg.indexOf(w) >= 0)) { key = k; break; }
    }
    items.push({ key: key, label: ECON_COST_LABEL[key], amount: Math.round(amount), text: seg });
  });
  const grouped = {};
  items.forEach((it) => { grouped[it.key] = econNum(grouped[it.key]) + it.amount; });
  const total = items.reduce((s, it) => s + it.amount, 0);
  return { items: items, total: total, unmatched: unmatched, grouped: grouped };
}
function econApplyCostItems(a, items) {
  const e = econEnsure(a);
  (items || []).forEach((it) => { e.costs[it.key] = econNum(e.costs[it.key]) + econNum(it.amount); });
  e.source = e.source || "natural";
  e.updatedAt = Date.now();
  return e;
}

/* ------------------------- 六、单场经营结果 ------------------------- */

function econMetrics(a) {
  const e = econEnsure(a);
  const pi = econPeopleInfo(a, e);
  const rev = econRevenue(a, e);
  const costTotal = econCostTotal(e);
  const price = econPrice(a, e);
  const fixed = econFixedTotal(e);
  const varPP = econVarPerPerson(a, e);
  const gp = rev.total - costTotal;
  return {
    activityId: a.id, people: pi.people, peopleBasis: pi.basis, price: price,
    revenue: rev, revenueTotal: rev.total, costs: e.costs, costTotal: costTotal,
    grossProfit: gp, grossMargin: rev.total > 0 ? gp / rev.total : 0,
    revenuePerPerson: pi.people > 0 ? rev.total / pi.people : 0,
    costPerPerson: pi.people > 0 ? costTotal / pi.people : 0,
    grossProfitPerPerson: pi.people > 0 ? gp / pi.people : 0,
    fixedTotal: fixed, varPerPerson: varPP,
    breakEvenPeople: econBreakEvenPeople(price, fixed, varPP),
    hasData: econHasData(a),
    breakdown: econCostBreakdown(e, pi.people)
  };
}

/* ------------------------- 七、盈亏平衡 ------------------------- */

function econBreakEvenPeople(price, fixed, varPerPerson) {
  const p = econNum(price), f = econNum(fixed), v = econNum(varPerPerson);
  if (p - v <= 0) return null; // 单人毛利非正 → 不存在保本人数
  return Math.ceil(f / (p - v));
}
/* 给定人数模拟：返回 [{people, revenue, cost, profit}] */
function econSimulate(price, fixed, varPerPerson, counts) {
  return (counts || []).map((n) => {
    const revenue = econNum(price) * n;
    const cost = econNum(fixed) + econNum(varPerPerson) * n;
    return { people: n, revenue: revenue, cost: cost, profit: revenue - cost };
  });
}
function econBreakEvenFor(a) {
  const e = econEnsure(a);
  const price = econPrice(a, e);
  const fixed = econFixedTotal(e);
  const varPP = econVarPerPerson(a, e);
  const be = econBreakEvenPeople(price, fixed, varPP);
  return {
    price: price, fixed: fixed, varPerPerson: varPP, breakEvenPeople: be,
    hasData: econCostTotal(e) > 0 && price > 0,
    simulate: be ? econSimulate(price, fixed, varPP, [be - 5, be, be + 5, be + 10].filter((n) => n > 0)) : []
  };
}

/* ------------------------- 八、活动产品 ID（同产品跨批次） ------------------------- */

/* 归一化路线：去掉批次词（3月/第2期/周末…）与标点，保留线路本体 */
function econNormalizeRoute(txt) {
  return String(txt == null ? "" : txt)
    .replace(/\d{4}\s*年/g, "")
    .replace(/\d{1,2}\s*月(\s*\d{1,2}\s*日)?/g, "")
    .replace(/第\s*\d+\s*[期批场弹]/g, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/[·・\-—~～_/\\|,，、。.\s"'“”‘’!！?？:：;；\[\]【】]/g, "")
    .toLowerCase();
}
function econProductKey(a) {
  const type = String((a && a.type) || "").trim();
  const route = econNormalizeRoute((a && (a.route || a.place || "")) || "");
  if (route) return type + "|" + route;
  return type + "|" + econNormalizeRoute((a && a.title) || "");
}
function econProductName(a) {
  const route = String((a && (a.route || a.place)) || "").trim();
  const type = String((a && a.type) || "").trim();
  if (route && type) return route + " · " + type;
  return route || type || (a && a.title) || "未命名产品";
}
function econCatalog() {
  state.econProducts = state.econProducts || [];
  return state.econProducts;
}
/* 取得（或建立）活动产品 ID。已存在则复用 —— 3月/5月/9月 同一路线必为同一 ID */
function ensureActivityProductId(a) {
  if (!a) return "";
  const cat = econCatalog();
  if (a.activityProductId) {
    if (!cat.some((p) => p.id === a.activityProductId)) {
      cat.push({ id: a.activityProductId, key: econProductKey(a), type: a.type || "", route: a.route || a.place || "", place: a.place || "", name: econProductName(a), createdAt: Date.now() });
    }
    return a.activityProductId;
  }
  const key = econProductKey(a);
  const hit = cat.find((p) => p.key === key);
  if (hit) { a.activityProductId = hit.id; return hit.id; }
  const id = "PRODUCT_" + String(cat.length + 1).padStart(3, "0");
  cat.push({ id: id, key: key, type: a.type || "", route: a.route || a.place || "", place: a.place || "", name: econProductName(a), createdAt: Date.now() });
  a.activityProductId = id;
  return id;
}
function econSyncProducts() {
  const cat = econCatalog();
  (state.activities || []).forEach((a) => {
    ensureActivityProductId(a);
    const p = cat.find((x) => x.id === a.activityProductId);
    if (p && (!p.name || p.name === "未命名产品")) p.name = econProductName(a);
  });
  saveState();
  return cat;
}
function econProductNameById(pid) {
  const p = econCatalog().find((x) => x.id === pid);
  if (p && p.name) return p.name;
  const a = (state.activities || []).find((x) => x.activityProductId === pid);
  return a ? econProductName(a) : pid;
}
/* 同产品全部批次（按时间升序） */
function econRuns(productId) {
  return (state.activities || [])
    .filter((a) => a.activityProductId === productId)
    .map((a) => ({ a: a, d: econDateOf(a), m: econMetrics(a) }))
    .sort((x, y) => x.d.ts - y.d.ts);
}

/* ------------------------- 九、滚动 12 个月基线 ------------------------- */

function econEconActivities(months) {
  const win = months || 12;
  const now = Date.now();
  const from = now - win * 30.44 * 86400000;
  return (state.activities || []).filter((a) => {
    if (!econHasData(a) && !(econOf(a) && econCostTotal(econOf(a)) > 0)) return false;
    return econDateOf(a).ts >= from;
  });
}
/* byKey[k] = { n, avgPerRun, avgPerPerson, byProduct:{}, byVehicle:{}, bySupplier:{} } */
function econBaseline(months) {
  const runs = econEconActivities(months).map((a) => ({ a: a, e: econEnsure(a), d: econDateOf(a), m: econMetrics(a) }));
  const byKey = {};
  ECON_COST_KEYS.forEach((k) => {
    const rows = runs.filter((r) => econNum(r.e.costs[k]) > 0);
    if (!rows.length) { byKey[k] = { n: 0, avgPerRun: 0, avgPerPerson: 0, byProduct: {}, byVehicle: {}, bySupplier: {} }; return; }
    const byProduct = {}, byVehicle = {}, bySupplier = {};
    rows.forEach((r) => {
      const pid = r.a.activityProductId || "—";
      (byProduct[pid] = byProduct[pid] || []).push(econNum(r.e.costs[k]));
      const meta = econMetaOf(k, r.e);
      if (meta.vehicleType && k === "transport") (byVehicle[meta.vehicleType] = byVehicle[meta.vehicleType] || []).push(econNum(r.e.costs[k]));
      if (meta.supplier) (bySupplier[meta.supplier] = bySupplier[meta.supplier] || []).push(econNum(r.e.costs[k]));
    });
    const avg = (o) => { const out = {}; Object.keys(o).forEach((kk) => { out[kk] = econMean(o[kk]); }); return out; };
    byKey[k] = {
      n: rows.length,
      avgPerRun: econMean(rows.map((r) => econNum(r.e.costs[k]))),
      avgPerPerson: econMean(rows.map((r) => r.m.people > 0 ? econNum(r.e.costs[k]) / r.m.people : 0).filter((x) => x > 0)),
      byProduct: avg(byProduct),
      byVehicle: avg(byVehicle),
      bySupplier: avg(bySupplier)
    };
  });
  const withData = runs.filter((r) => r.m.revenueTotal > 0 || r.m.costTotal > 0);
  return {
    months: months || 12, runs: runs.length,
    byKey: byKey,
    overall: {
      avgRevenue: econMean(withData.map((r) => r.m.revenueTotal)),
      avgCost: econMean(withData.map((r) => r.m.costTotal)),
      avgCostPerPerson: econMean(withData.filter((r) => r.m.people > 0).map((r) => r.m.costPerPerson).filter((x) => x > 0)),
      avgMargin: econMean(withData.map((r) => r.m.grossMargin).filter((x) => isFinite(x))),
      avgFixed: econMean(withData.map((r) => r.m.fixedTotal)),
      avgVarPerPerson: econMean(withData.filter((r) => r.m.varPerPerson > 0).map((r) => r.m.varPerPerson))
    }
  };
}
function econMetaOf(costKey, e) {
  if (costKey === "transport") return (e && e.transportMeta) || {};
  if (costKey === "accommodation") return (e && e.accommodationMeta) || {};
  if (costKey === "meals") return (e && e.mealMeta) || {};
  return (e && e.supplierMeta) || {};
}

/* ------------------------- 十、事实 / 推测严格分离 ------------------------- */

function econMetaFieldLabels(costKey, fields) {
  const defs = ECON_META_FIELDS[costKey] || [];
  return fields.map((f) => {
    const d = defs.find((x) => x.key === f);
    return d ? d.label : f;
  });
}
/* 成本差异解释：有元数据 → 给「重要因素」；无元数据 → 只给「无法确认原因」 */
function econRunEcon(r) { return (r && (r.e || r.economics)) || {}; }
function econExplainDifference(costKey, target, peers) {
  const defs = ECON_META_FIELDS[costKey] || [];
  const tm = econMetaOf(costKey, econRunEcon(target));
  const have = defs.filter((d) => tm[d.key] !== undefined && tm[d.key] !== null && tm[d.key] !== "").map((d) => d.key);
  const missingText = () => {
    const labels = econMetaFieldLabels(costKey, defs.map((d) => d.key));
    if (!labels.length) return "该成本项的可比口径";
    return labels.join("、");
  };
  if (!defs.length) {
    return { hypothesis: null, reasonUnavailable: true, recorded: [], why: "「" + ECON_COST_LABEL[costKey] + "」没有可对比的结构化字段，因此暂时无法确认具体原因。" };
  }
  if (!have.length) {
    return { hypothesis: null, reasonUnavailable: true, recorded: [], why: "目前没有记录" + missingText() + "，因此暂时无法确认具体原因。" };
  }
  const peerMeta = peers.map((p) => econMetaOf(costKey, econRunEcon(p)));
  const diffs = [];
  have.forEach((f) => {
    const vals = peerMeta.map((m) => m[f]).filter((v) => v !== undefined && v !== null && v !== "");
    if (!vals.length) return;
    if (String(econMode(vals)) !== String(tm[f])) diffs.push(f);
  });
  if (!diffs.length) {
    const same = have.map((f) => econMetaFieldLabels(costKey, [f])[0] + " " + tm[f]).join("、");
    return { hypothesis: null, reasonUnavailable: true, recorded: have, why: "已记录的信息（" + same + "）与同线路其他场次一致，因此暂时无法确认具体原因。" };
  }
  const parts = diffs.map((f) => {
    const vals = peerMeta.map((m) => m[f]).filter((v) => v !== undefined && v !== null && v !== "");
    return econMetaFieldLabels(costKey, [f])[0] + "为 " + tm[f] + "（同线路其他场次多为 " + econMode(vals) + "）";
  });
  let hypo = parts.join("；") + "，该差异是本次成本变化的重要因素。";
  if (tm.note) hypo += "该场成本备注：「" + tm.note + "」。";
  return { hypothesis: hypo, reasonUnavailable: false, recorded: have, why: "" };
}

/* ------------------------- 十一、成本异常发现 ------------------------- */

/* opts.months 默认 12；阈值参照文档：车辆 >20%、人均餐饮 >18% */
function econAnomalies(opts) {
  opts = opts || {};
  const months = opts.months || 12;
  const thrTransport = opts.thrTransport != null ? opts.thrTransport : 0.2;
  const thrMeals = opts.thrMeals != null ? opts.thrMeals : 0.18;
  const out = [];
  const runs = econEconActivities(months).map((a) => ({ a: a, e: econEnsure(a), d: econDateOf(a), m: econMetrics(a) }));
  /* ① 同线路同类成本横向异常 */
  const byProduct = {};
  runs.forEach((r) => { const pid = r.a.activityProductId || "—"; (byProduct[pid] = byProduct[pid] || []).push(r); });
  Object.keys(byProduct).forEach((pid) => {
    const group = byProduct[pid];
    if (group.length < 3) return;
    ECON_COST_KEYS.forEach((k) => {
      const vals = group.map((r) => econNum(r.e.costs[k]));
      group.forEach((r, i) => {
        const v = vals[i];
        if (v <= 0) return;
        const peers = vals.filter((_x, j) => j !== i).filter((x) => x > 0);
        if (peers.length < 2) return;
        const avg = econMean(peers);
        if (avg <= 0) return;
        const delta = (v - avg) / avg;
        if (delta < thrTransport && !(k === "meals" && delta > thrMeals)) return;
        const ex = econExplainDifference(k, r, group.filter((_x, j) => j !== i));
        out.push({
          id: "anom_" + a_idOf(r.a) + "_" + k,
          kind: "anomaly", level: "warn",
          activityId: r.a.id, productId: pid, costKey: k,
          title: econProductNameById(pid) + " · " + r.d.md + " " + ECON_COST_LABEL[k] + " " + econMoney(v),
          fact: r.d.md + ECON_COST_LABEL[k] + " " + econMoney(v) + "，比同线路其他 " + peers.length + " 场平均 " + econMoney(avg) + " 高 " + econPct(delta) + "。",
          deltaPct: delta,
          hypothesis: ex.hypothesis, reasonUnavailable: ex.reasonUnavailable, why: ex.why
        });
      });
    });
  });
  /* ② 人均餐饮/人均成本对比 12 个月基线 */
  const base = econBaseline(months);
  /* 人均餐饮：与「其他场次」的人均均值比较（剔除自身，避免样本少时自我稀释） */
  const allPP = runs.filter((r) => econNum(r.e.costs.meals) > 0 && r.m.people > 0).map((r) => econNum(r.e.costs.meals) / r.m.people);
  if (allPP.length >= 3) {
    runs.forEach((r) => {
      const v = econNum(r.e.costs.meals);
      if (v <= 0 || r.m.people <= 0) return;
      const pp = v / r.m.people;
      const peersPP = allPP.filter((x) => Math.abs(x - pp) > 1e-9);
      if (peersPP.length < 2) return;
      const mealsPP = econMean(peersPP);
      const delta = (pp - mealsPP) / mealsPP;
      if (delta <= thrMeals) return;
      out.push({
        id: "anom_mealspp_" + a_idOf(r.a), kind: "anomaly", level: "warn",
        activityId: r.a.id, productId: r.a.activityProductId || "", costKey: "meals",
        title: r.d.md + " 人均餐饮 " + econMoney(pp),
        fact: r.d.md + " 人均餐饮 " + econMoney(pp) + "，比近 " + base.months + " 个月平均 " + econMoney(mealsPP) + " 高 " + econPct(delta) + "。",
        deltaPct: delta, hypothesis: null, reasonUnavailable: true,
        why: "目前没有记录餐饮供应商、用餐形式或人数口径差异，因此暂时无法确认具体原因。"
      });
    });
  }
  /* ③ 最近 3 场同线路住宿/车辆持续上涨 */
  Object.keys(byProduct).forEach((pid) => {
    const group = byProduct[pid].slice().sort((x, y) => x.d.ts - y.d.ts);
    if (group.length < 3) return;
    ["accommodation", "transport"].forEach((k) => {
      const last3 = group.slice(-3);
      const v = last3.map((r) => econNum(r.e.costs[k]));
      if (v.some((x) => x <= 0)) return;
      if (!(v[0] < v[1] && v[1] < v[2])) return;
      const up = (v[2] - v[0]) / v[0];
      const ex = econExplainDifference(k, last3[2], last3.slice(0, 2));
      out.push({
        id: "trend_" + a_idOf(last3[2].a) + "_" + k, kind: "anomaly", level: "info",
        activityId: last3[2].a.id, productId: pid, costKey: k,
        title: econProductNameById(pid) + " 最近 3 场" + ECON_COST_LABEL[k] + "成本持续上涨",
        fact: "最近 3 场" + ECON_COST_LABEL[k] + "依次为 " + v.map((x) => econMoney(x)).join(" → ") + "，累计上涨 " + econPct(up) + "。",
        deltaPct: up, hypothesis: ex.hypothesis, reasonUnavailable: ex.reasonUnavailable, why: ex.why
      });
    });
  });
  return out.sort((x, y) => Math.abs(y.deltaPct) - Math.abs(x.deltaPct));
}
function a_idOf(a) { return (a && a.id) || "x"; }

/* ------------------------- 十二、产品经营画像与组合 ------------------------- */

function econCustomerStats(productId) {
  const actIds = (state.activities || []).filter((a) => a.activityProductId === productId).map((a) => a.id);
  const people = (state.signups || []).filter((s) => actIds.indexOf(s.activityId) >= 0);
  const keys = {};
  people.forEach((s) => { const k = s.phone || s.name; keys[k] = (keys[k] || 0) + 1; });
  const uniq = Object.keys(keys);
  const repeat = uniq.filter((k) => keys[k] > 1).length;
  /* 拉新：该客户在全部活动中的最早一次报名就属于本产品 */
  const firstSeen = {};
  (state.signups || []).forEach((s) => {
    const k = s.phone || s.name;
    const t = s.createdAt || 0;
    if (!firstSeen[k] || t < firstSeen[k].t) firstSeen[k] = { t: t, activityId: s.activityId };
  });
  const newOnes = uniq.filter((k) => firstSeen[k] && actIds.indexOf(firstSeen[k].activityId) >= 0).length;
  return {
    customers: uniq.length, repeatRate: uniq.length ? repeat / uniq.length : 0,
    newCustomerRate: uniq.length ? newOnes / uniq.length : 0
  };
}
function econProductProfile(pid) {
  const runs = econRuns(pid);
  const withEcon = runs.filter((r) => econHasData(r.a) || r.m.costTotal > 0);
  const use = withEcon.length ? withEcon : runs;
  const margins = use.map((r) => r.m.grossMargin).filter((x) => isFinite(x));
  const costs = use.map((r) => r.m.costTotal).filter((x) => x > 0);
  const costPP = use.filter((r) => r.m.people > 0).map((r) => r.m.costPerPerson).filter((x) => x > 0);
  const profits = use.map((r) => r.m.grossProfit);
  const signups = runs.filter((r) => r.m.people > 0).map((r) => r.m.people);
  const prices = runs.map((r) => r.m.price).filter((x) => x > 0);
  const fills = runs.filter((r) => econNum(r.a.limit) > 0).map((r) => r.m.people / econNum(r.a.limit));
  const monthsMap = {}, seasonMap = {};
  runs.forEach((r) => {
    monthsMap[r.d.month] = (monthsMap[r.d.month] || 0) + (r.m.people || 0);
    seasonMap[r.d.season] = (seasonMap[r.d.season] || 0) + (r.m.people || 0);
  });
  const be = use.map((r) => r.m.breakEvenPeople).filter((x) => x != null);
  const cs = econCustomerStats(pid);
  const totalPeople = signups.reduce((s, x) => s + x, 0);
  const monthAvg = totalPeople / Math.max(1, Object.keys(monthsMap).length);
  const peakMonths = Object.keys(monthsMap).filter((m) => monthsMap[m] >= monthAvg * 1.25).map(Number).sort((a, b) => a - b);
  return {
    pid: pid, name: econProductNameById(pid),
    runs: runs.length, econRuns: use.length,
    firstDate: runs.length ? runs[0].d.iso : "", lastDate: runs.length ? runs[runs.length - 1].d.iso : "",
    avgSignups: econMean(signups), totalPeople: totalPeople,
    avgPrice: econMean(prices), minSignups: signups.length ? Math.min.apply(null, signups) : 0,
    avgRevenue: econMean(use.map((r) => r.m.revenueTotal)),
    avgCost: econMean(costs), avgCostPerPerson: econMean(costPP),
    avgRevenuePerPerson: econMean(use.filter((r) => r.m.people > 0).map((r) => r.m.revenuePerPerson).filter((x) => x > 0)),
    avgProfit: econMean(profits), totalProfit: profits.reduce((s, x) => s + x, 0),
    avgMargin: econMean(margins), marginMin: margins.length ? Math.min.apply(null, margins) : 0,
    costVolatility: econCV(costPP), profitVolatility: econCV(profits),
    avgFillRate: econMean(fills), breakEvenPeople: be.length ? Math.round(econMean(be)) : null,
    repeatRate: cs.repeatRate, newCustomerRate: cs.newCustomerRate, customers: cs.customers,
    monthsMap: monthsMap, seasonMap: seasonMap, peakMonths: peakMonths,
    seasonality: peakMonths.length > 0 && peakMonths.length <= 4 && runs.length >= 3,
    runs_meta: runs.map((r) => ({ id: r.a.id, iso: r.d.iso, md: r.d.md, people: r.m.people, revenue: r.m.revenueTotal, cost: r.m.costTotal, profit: r.m.grossProfit, margin: r.m.grossMargin }))
  };
}
/* 分档：绝不只看单场利润，综合频次/毛利率/报名/成团/成本与利润稳定性/复购/拉新/季节 */
function econClassifyProduct(p, cohort) {
  const cls = cohort || [];
  const profitP75 = econPercentile(cls.map((x) => x.avgProfit), 0.75);
  const marginP75 = econPercentile(cls.map((x) => x.avgMargin), 0.75);
  const scores = {
    profit: p.avgProfit, totalProfit: p.totalProfit, margin: p.avgMargin, signups: p.avgSignups,
    fill: p.avgFillRate, freq: p.runs,
    costStability: p.costVolatility == null ? null : Math.max(0, 1 - p.costVolatility),
    profitStability: p.profitVolatility == null ? null : Math.max(0, 1 - p.profitVolatility),
    repeat: p.repeatRate, newCustomer: p.newCustomerRate, seasonality: p.seasonality
  };
  const reasons = [];
  const stable = (p.costVolatility == null || p.costVolatility <= 0.12) && (p.profitVolatility == null || p.profitVolatility <= 0.35);
  if (p.runs < 2) { reasons.push("只执行了 " + p.runs + " 场，样本不足，先继续观察"); return { key: "new", label: "观察中", reasons: reasons, scores: scores }; }
  if (p.runs >= 3 && p.avgMargin < 0.08 && p.avgProfit <= 0) {
    reasons.push("连续 " + p.runs + " 场平均毛利率仅 " + econPct(p.avgMargin) + "，场均毛利 " + econMoney(p.avgProfit));
    reasons.push("复购 " + econPct(p.repeatRate) + "、拉新 " + econPct(p.newCustomerRate) + "，也没有明显其他经营价值");
    return { key: "weak", label: "低效产品", reasons: reasons, scores: scores };
  }
  if (p.runs >= 3 && p.avgMargin >= 0.25 && stable && p.avgMargin >= marginP75 * 0.8) {
    reasons.push("已执行 " + p.runs + " 场，平均毛利率 " + econPct(p.avgMargin));
    reasons.push("成本波动 " + (p.costVolatility == null ? "样本不足" : p.costVolatility <= 0.12 ? "较低" : econPct(p.costVolatility)) + "、利润波动 " + (p.profitVolatility == null ? "样本不足" : p.profitVolatility <= 0.35 ? "较低" : econPct(p.profitVolatility)));
    reasons.push("平均报名 " + Math.round(p.avgSignups) + " 人，成团率 " + econPct(p.avgFillRate));
    return { key: "stable", label: "核心稳定产品", reasons: reasons, scores: scores };
  }
  if (p.seasonality) {
    reasons.push("报名集中在 " + p.peakMonths.join("、") + " 月，显著高于其他月份");
    reasons.push("平均毛利率 " + econPct(p.avgMargin) + "，共 " + p.runs + " 场");
    return { key: "season", label: "季节产品", reasons: reasons, scores: scores };
  }
  if (p.newCustomerRate >= 0.5 && p.avgMargin < 0.25) {
    reasons.push("拉新占 " + econPct(p.newCustomerRate) + "，是主要的新客来源");
    reasons.push("平均毛利率 " + econPct(p.avgMargin) + "，利润一般但带动新客");
    return { key: "traffic", label: "引流产品", reasons: reasons, scores: scores };
  }
  if (p.avgProfit >= profitP75 && p.avgProfit > 0 && p.runs <= 3) {
    reasons.push("场均毛利 " + econMoney(p.avgProfit) + "，处于所有产品前 25%");
    reasons.push("执行频次仅 " + p.runs + " 场（受路线/季节限制），单场利润突出");
    return { key: "profit", label: "高利润产品", reasons: reasons, scores: scores };
  }
  if (p.avgMargin >= 0.08) {
    reasons.push("有需求（场均报名 " + Math.round(p.avgSignups) + " 人），但成本结构不稳定");
    if (p.costVolatility != null) reasons.push("人均成本波动 " + econPct(p.costVolatility));
    return { key: "optimize", label: "待优化产品", reasons: reasons, scores: scores };
  }
  reasons.push("平均毛利率 " + econPct(p.avgMargin) + "，场均毛利 " + econMoney(p.avgProfit));
  return { key: "weak", label: "低效产品", reasons: reasons, scores: scores };
}
function econPortfolio() {
  econSyncProducts();
  const ids = [];
  (state.activities || []).forEach((a) => { if (a.activityProductId && ids.indexOf(a.activityProductId) < 0) ids.push(a.activityProductId); });
  const profiles = ids.map((id) => econProductProfile(id));
  const cohort = profiles.filter((p) => p.econRuns >= 1);
  const items = profiles.map((p) => {
    const c = econClassifyProduct(p, cohort);
    return { profile: p, cls: c };
  });
  const groups = {};
  ECON_CLASS_DEFS.forEach((d) => { groups[d.key] = { def: d, items: [] }; });
  items.forEach((it) => { (groups[it.cls.key] = groups[it.cls.key] || { def: { key: it.cls.key, label: it.cls.label, note: "" }, items: [] }).items.push(it); });
  const ordered = ["stable", "profit", "traffic", "season", "optimize", "weak", "new"]
    .map((k) => groups[k]).filter((g) => g && g.items.length);
  return { items: items, all: items, groups: ordered };
}

/* ------------------------- 十三、年度概览与经营洞察 ------------------------- */

function econYearOverview(year) {
  const y = year || new Date().getFullYear();
  const all = (state.activities || []).filter((a) => econHasData(a) || econCostTotal(econOf(a) || {}) > 0);
  let runs = all.filter((a) => econDateOf(a).year === y);
  let label = y + " 年至今";
  if (!runs.length) { runs = all; label = "全部历史"; }
  const ms = runs.map((a) => econMetrics(a));
  const revenue = ms.reduce((s, m) => s + m.revenueTotal, 0);
  const cost = ms.reduce((s, m) => s + m.costTotal, 0);
  const profit = revenue - cost;
  const people = ms.reduce((s, m) => s + (m.people || 0), 0);
  const registered = runs.reduce((s, a) => s + econPeople(a), 0);
  const actual = runs.reduce((s, a) => {
    const e = econEnsure(a);
    return s + ((e.actualParticipants === null || e.actualParticipants === undefined || e.actualParticipants === "") ? econPeople(a) : econNum(e.actualParticipants));
  }, 0);
  return {
    year: y, label: label, runs: runs.length, revenue: revenue, cost: cost, profit: profit,
    margin: revenue > 0 ? profit / revenue : 0, people: people, registered: registered, actual: actual,
    avgProfit: runs.length ? profit / runs.length : 0,
    missing: (state.activities || []).filter((a) => !(econHasData(a) || econCostTotal(econOf(a) || {}) > 0)).length
  };
}
/* 本年度经营洞察：只写数据支持得了的结论 */
function econInsights() {
  const out = [];
  const pf = econPortfolio();
  const stable = pf.items.filter((it) => it.cls.key === "stable").sort((a, b) => b.profile.avgMargin - a.profile.avgMargin)[0];
  if (stable) {
    out.push({
      kind: "insight", icon: "target",
      text: stable.profile.name + " 是目前最稳定的常规产品。",
      fact: "已执行 " + stable.profile.runs + " 场，平均报名 " + Math.round(stable.profile.avgSignups) + " 人，平均毛利率 " + econPct(stable.profile.avgMargin) + "，人均成本波动 " + (stable.profile.costVolatility == null ? "样本不足" : econPct(stable.profile.costVolatility)) + "。",
      reasons: stable.cls.reasons, productId: stable.profile.pid,
      hypothesis: null, reasonUnavailable: true, why: "上述结论均来自已录入的真实执行数据；更细的原因需要补充车型/供应商等元数据。"
    });
  }
  /* 毛利率同比提升（需两年数据） */
  const y = new Date().getFullYear();
  pf.items.forEach((it) => {
    const runs = econRuns(it.profile.pid);
    const cur = runs.filter((r) => r.d.year === y && (econHasData(r.a) || r.m.costTotal > 0));
    const prev = runs.filter((r) => r.d.year === y - 1 && (econHasData(r.a) || r.m.costTotal > 0));
    if (!cur.length || !prev.length) return;
    const m1 = econMean(cur.map((r) => r.m.grossMargin)), m0 = econMean(prev.map((r) => r.m.grossMargin));
    if (m1 - m0 >= 0.05) {
      out.push({
        kind: "insight", icon: "trending-up",
        text: it.profile.name + " 毛利率比去年提升 " + econPct(m1 - m0) + "。",
        fact: y + " 年 " + cur.length + " 场平均毛利率 " + econPct(m1) + "，" + (y - 1) + " 年 " + prev.length + " 场平均毛利率 " + econPct(m0) + "。",
        reasons: [], productId: it.profile.pid,
        hypothesis: null, reasonUnavailable: true, why: "提升原因需要补充售价、成本结构与人数数据后才能进一步判断。"
      });
    }
  });
  /* 季节表现：只用报名数据说话 */
  pf.items.forEach((it) => {
    if (!it.profile.seasonality) return;
    out.push({
      kind: "insight", icon: "calendar",
      text: it.profile.name + " 在 " + it.profile.peakMonths.join("、") + " 月报名明显高于其他月份。",
      fact: "共 " + it.profile.runs + " 场，按月报名人次：" + Object.keys(it.profile.monthsMap).sort((a, b) => a - b).map((m) => m + "月 " + it.profile.monthsMap[m] + " 人次").join("、") + "。",
      reasons: [], productId: it.profile.pid,
      hypothesis: null, reasonUnavailable: true, why: "这里是报名数据的分布事实，不代表原因（如天气/假期）——ClubOS 不会在缺少记录时替你归因。"
    });
  });
  /* 成本异常转洞察 */
  econAnomalies({ months: 12 }).forEach((f) => {
    out.push({
      kind: "warn", icon: "trending", text: f.title + "。", fact: f.fact,
      reasons: [], productId: f.productId, activityId: f.activityId,
      hypothesis: f.hypothesis, reasonUnavailable: f.reasonUnavailable, why: f.why
    });
  });
  return out;
}

/* ------------------------- 十四、自然语言经营问答 ------------------------- */

function econRankProducts(by) {
  return econPortfolio().items
    .filter((it) => it.profile.econRuns > 0)
    .slice()
    .sort((a, b) => by(b.profile) - by(a.profile));
}
function econAnswer(question) {
  const q = String(question || "").trim();
  const base = { question: q, answer: "", basis: [], insufficient: false, intent: "" };
  if (!q) return Object.assign(base, { answer: "可以问我经营数据相关的问题，例如：今年最赚钱的线路是什么？", insufficient: true });
  const has = (re) => re.test(q);
  const anyData = econPortfolio().items.some((it) => it.profile.econRuns > 0);

  /* 1) 最赚钱的线路 */
  if (has(/最赚钱|利润最高|赚最多|利润最多|最挣|最高利润/)) {
    const list = econRankProducts((p) => p.totalProfit).filter((it) => it.profile.totalProfit > 0).slice(0, 5);
    if (!list.length) return Object.assign(base, { intent: "top_profit", answer: "目前录入成本的活动还不够，无法排出最赚钱的线路。先在活动详情里补上车辆、餐饮、领队这几项成本就能算了。", insufficient: true });
    base.intent = "top_profit";
    base.answer = "按累计毛利排序，前 " + list.length + " 名是：\n" + list.map((it, i) =>
      (i + 1) + ". " + it.profile.name + " —— 累计毛利 " + econMoney(it.profile.totalProfit) + "（" + it.profile.runs + " 场，场均 " + econMoney(it.profile.avgProfit) + "，平均毛利率 " + econPct(it.profile.avgMargin) + "）"
    ).join("\n");
    base.basis = list.map((it) => it.profile.name + "：" + it.profile.runs + " 场，均价 " + econMoney(it.profile.avgPrice) + "，场均成本 " + econMoney(it.profile.avgCost));
    return base;
  }
  /* 2) 收入高但不赚钱 */
  if (has(/不赚钱|赔钱|亏损|收入高.{0,6}(利润|不赚)|高收入低利润|成本高/)) {
    const list = econRankProducts((p) => p.avgRevenue).filter((it) => it.profile.avgMargin < 0.15).slice(0, 5);
    if (!list.length) return Object.assign(base, { intent: "rev_low_margin", answer: "已录入数据的活动里，没有「收入高但毛利很低」的产品（毛利率都 ≥15%）。", insufficient: true });
    base.intent = "rev_low_margin";
    base.answer = "收入靠前但毛利偏低的是：\n" + list.map((it) =>
      "· " + it.profile.name + " —— 场均收入 " + econMoney(it.profile.avgRevenue) + "，平均毛利率 " + econPct(it.profile.avgMargin) + "，场均毛利 " + econMoney(it.profile.avgProfit)
    ).join("\n") + "\n建议先看成本结构里哪一项偏高。";
    base.basis = list.map((it) => it.profile.name + " 场均成本 " + econMoney(it.profile.avgCost) + "（人均 " + econMoney(it.profile.avgCostPerPerson) + "）");
    return base;
  }
  /* 3) 建议少做 */
  if (has(/少做|不要做|减少|停做|砍掉/)) {
    const weak = econPortfolio().items.filter((it) => it.cls.key === "weak");
    if (!weak.length) return Object.assign(base, { intent: "reduce", answer: "按现有数据，没有连续多场利润偏低的低效产品。", insufficient: true });
    base.intent = "reduce";
    base.answer = "建议减少投入的是：\n" + weak.map((it) =>
      "· " + it.profile.name + " —— " + it.cls.reasons.join("；")
    ).join("\n");
    base.basis = weak.map((it) => it.profile.name + "：" + it.profile.runs + " 场，平均毛利率 " + econPct(it.profile.avgMargin) + "，场均毛利 " + econMoney(it.profile.avgProfit));
    return base;
  }
  /* 4) 车费最容易失控 */
  if (has(/车费|车辆|大巴|用车/) && has(/失控|异常|最高|偏高|贵|问题|涨/)) {
    const anoms = econAnomalies({ months: 12 }).filter((f) => f.costKey === "transport");
    if (!anoms.length) return Object.assign(base, { intent: "transport_risk", answer: "近 12 个月的车辆成本没有出现相对同线路平均高出 20% 的异常场次。", insufficient: true });
    const f = anoms[0];
    base.intent = "transport_risk";
    base.answer = "车辆成本最需要关注的是：" + f.title + "。\n" + f.fact + (f.hypothesis ? "\n" + f.hypothesis : "\n" + f.why);
    base.basis = anoms.slice(0, 5).map((x) => x.fact);
    return base;
  }
  /* 5) 供应商涨价 */
  if (has(/供应商|涨价|上涨最快|提价/)) {
    const runs = econEconActivities(12).map((a) => ({ e: econEnsure(a), d: econDateOf(a) }));
    const bySup = {};
    ECON_COST_KEYS.forEach((k) => {
      runs.forEach((r) => {
        const s = econMetaOf(k, r.e).supplier;
        if (!s || econNum(r.e.costs[k]) <= 0) return;
        const key = k + "|" + s;
        (bySup[key] = bySup[key] || { costKey: k, supplier: s, rows: [] }).rows.push({ ts: r.d.ts, v: econNum(r.e.costs[k]) });
      });
    });
    const rising = Object.keys(bySup).map((k) => {
      const g = bySup[k];
      if (g.rows.length < 2) return null;
      const sorted = g.rows.slice().sort((a, b) => a.ts - b.ts);
      const half = Math.max(1, Math.floor(sorted.length / 2));
      const before = econMean(sorted.slice(0, half).map((r) => r.v));
      const after = econMean(sorted.slice(half).map((r) => r.v));
      if (before <= 0) return null;
      return { costKey: g.costKey, supplier: g.supplier, n: sorted.length, before: before, after: after, delta: (after - before) / before };
    }).filter((x) => x && x.delta > 0).sort((a, b) => b.delta - a.delta);
    if (!rising.length) return Object.assign(base, { intent: "supplier", answer: "目前没有录入足够的供应商与成本对应记录（同一供应商至少 2 场），无法比较价格变化。录入成本时顺便填上供应商，下次就能算了。", insufficient: true });
    base.intent = "supplier";
    base.answer = "按同一供应商前后期均价比较，涨幅靠前的是：\n" + rising.slice(0, 5).map((x) =>
      "· " + x.supplier + "（" + ECON_COST_LABEL[x.costKey] + "）—— " + x.n + " 场，由 " + econMoney(x.before) + " 升至 " + econMoney(x.after) + "，上涨 " + econPct(x.delta)
    ).join("\n");
    base.basis = rising.slice(0, 5).map((x) => x.supplier + " " + x.n + " 场：" + econMoney(x.before) + " → " + econMoney(x.after));
    return base;
  }
  /* 6) 两个业务类型比较 */
  if (has(/哪个|哪个更赚|相比|比一比/) && /赚钱|赚|毛利|利润/.test(q)) {
    const types = [];
    ["露营", "徒步", "登山", "溯溪", "骑行", "研学", "团建", "滑雪", "攀岩"].forEach((t) => { if (q.indexOf(t) >= 0) types.push(t); });
    if (types.length >= 2) {
      const stat = {};
      types.forEach((t) => {
        const rows = (state.activities || []).filter((a) => String(a.type || "").indexOf(t) >= 0 && (econHasData(a) || econCostTotal(econOf(a) || {}) > 0));
        stat[t] = {
          n: rows.length,
          profit: rows.reduce((s, a) => s + econMetrics(a).grossProfit, 0),
          margin: econMean(rows.map((a) => econMetrics(a).grossMargin)),
          people: rows.reduce((s, a) => s + econMetrics(a).people, 0)
        };
      });
      const win = types.slice().sort((a, b) => stat[b].profit - stat[a].profit)[0];
      if (!stat[win].n) return Object.assign(base, { intent: "type_cmp", answer: "这两个业务里还没有录入成本的活动，无法比较。", insufficient: true });
      base.intent = "type_cmp";
      base.answer = "按累计毛利，目前 " + win + " 更赚钱：\n" + types.map((t) =>
        "· " + t + "：" + stat[t].n + " 场，累计毛利 " + econMoney(stat[t].profit) + "，平均毛利率 " + econPct(stat[t].margin) + "，累计 " + stat[t].people + " 人次"
      ).join("\n") + "\n（口径：累计毛利 = 收入 − 成本，场次不同不宜只看总额。）";
      base.basis = types.map((t) => t + " " + stat[t].n + " 场 / " + stat[t].people + " 人次");
      return base;
    }
  }
  /* 7) N 人什么价格不亏 */
  const pm = q.match(/(\d{1,3})\s*(?:人|个人的活动|人的活动)/);
  if (pm && has(/不亏|保本|盈亏|定价|价格|多少钱/)) {
    const n = parseInt(pm[1], 10);
    const b = econBaseline(12);
    const fixed = b.overall.avgFixed, varPP = b.overall.avgVarPerPerson;
    if (!fixed) return Object.assign(base, { intent: "be_price", answer: "还没有足够的成本数据来估算保本价，请先给几场活动录入成本。", insufficient: true });
    const need = varPP + fixed / n;
    base.intent = "be_price";
    base.answer = "按近 " + b.months + " 个月的基线（固定成本平均 " + econMoney(fixed) + "，变动成本人均 " + econMoney(varPP) + "）：\n" + n + " 人时不亏的单价约为 " + econMoney(need) + "/人（收入刚好覆盖成本）。\n报价低于这个数就会亏，建议留出 25% 以上毛利，即 " + econMoney(need / 0.75) + "/人。";
    base.basis = ["有效样本 " + b.runs + " 场", "平均固定成本 " + econMoney(fixed), "人均变动成本 " + econMoney(varPP)];
    return base;
  }
  /* 8) 明年 / 继续重点做 */
  if (has(/明年|下半年|继续做|重点做|值得做/)) {
    const items = econPortfolio().items.filter((it) => it.cls.key === "stable" || it.cls.key === "profit");
    if (!items.length) return Object.assign(base, { intent: "next_year", answer: "目前还没有达到「核心稳定」或「高利润」标准的产品（或样本不足）。多录几场成本后再看这里。", insufficient: true });
    base.intent = "next_year";
    base.answer = "建议明年继续重点做：\n" + items.map((it) =>
      "· " + it.profile.name + "（" + it.cls.label + "）—— " + it.cls.reasons.join("；")
    ).join("\n");
    base.basis = items.map((it) => it.profile.name + "：" + it.profile.runs + " 场，平均毛利率 " + econPct(it.profile.avgMargin) + "，场均毛利 " + econMoney(it.profile.avgProfit));
    return base;
  }
  /* 9) 为什么某月比某月低 */
  if (has(/为什么|为何/) && (/月/.test(q) || /场/.test(q))) {
    const ms = [];
    q.replace(/(\d{4}\s*年)?(\d{1,2})\s*月/g, (all, y, m) => { ms.push({ year: y ? parseInt(y, 10) : null, month: parseInt(m, 10) }); return all; });
    if (ms.length >= 2) {
      const pick = (t) => (state.activities || []).filter((a) => {
        const d = econDateOf(a);
        const okY = t.year ? d.year === t.year : true;
        return d.month === t.month && okY && (econHasData(a) || econCostTotal(econOf(a) || {}) > 0);
      });
      const A = pick(ms[0]), B = pick(ms[1]);
      if (!A.length || !B.length) return Object.assign(base, { intent: "why_diff", answer: ms[0].month + "月或" + ms[1].month + "月缺少已录入成本的活动，无法对比。", insufficient: true });
      const sum = (rows) => {
        const ms2 = rows.map((a) => econMetrics(a));
        const costs = {};
        ECON_COST_KEYS.forEach((k) => { costs[k] = ms2.reduce((s, m) => s + econNum(m.costs[k]), 0); });
        return { n: rows.length, revenue: ms2.reduce((s, m) => s + m.revenueTotal, 0), cost: ms2.reduce((s, m) => s + m.costTotal, 0), profit: ms2.reduce((s, m) => s + m.grossProfit, 0), people: ms2.reduce((s, m) => s + m.people, 0), costs: costs };
      };
      const sa = sum(A), sb = sum(B);
      const diffPeople = sa.people - sb.people;
      const lines = [];
      lines.push("收入相差 " + econMoney(sa.revenue - sb.revenue) + "（" + ms[0].month + "月 " + econMoney(sa.revenue) + "，共 " + sa.people + " 人次；" + ms[1].month + "月 " + econMoney(sb.revenue) + "，共 " + sb.people + " 人次）");
      if (diffPeople) lines.push("人次相差 " + (diffPeople > 0 ? "+" : "") + diffPeople);
      ECON_COST_KEYS.forEach((k) => {
        const d = sa.costs[k] - sb.costs[k];
        if (Math.abs(d) > 0) lines.push(ECON_COST_LABEL[k] + "成本相差 " + (d > 0 ? "+" : "") + econMoney(d) + "（" + ms[0].month + "月 " + econMoney(sa.costs[k]) + " vs " + ms[1].month + "月 " + econMoney(sb.costs[k]) + "）");
      });
      lines.push("最终毛利相差 " + (sa.profit - sb.profit >= 0 ? "+" : "") + econMoney(sa.profit - sb.profit) + "（" + ms[0].month + "月 " + econMoney(sa.profit) + " vs " + ms[1].month + "月 " + econMoney(sb.profit) + "）");
      const metas = {};
      A.concat(B).forEach((a) => {
        const e = econEnsure(a);
        ["transport", "accommodation", "meals"].forEach((k) => {
          const m = econMetaOf(k, e);
          if (m.supplier || m.vehicleType) { metas[k] = metas[k] || new Set(); metas[k].add((m.vehicleType || "") + (m.supplier ? "/" + m.supplier : "")); }
        });
      });
      const hasMeta = Object.keys(metas).some((k) => metas[k].size >= 2);
      base.intent = "why_diff";
      base.answer = lines.join("\n") + "\n" + (hasMeta
        ? "另外，已记录到的车辆/住宿/餐饮口径存在差异（" + Object.keys(metas).filter((k) => metas[k].size >= 2).map((k) => ECON_COST_LABEL[k] + "：" + Array.from(metas[k]).map((x) => x.replace(/^\//, "")).join(" / ")).join("；") + "），这是差异的重要因素。"
        : "差异的具体原因暂时无法确认：目前没有记录车辆型号、供应商、公里数或用餐形式等可比字段。");
      base.basis = ["对比样本：" + ms[0].month + "月 " + sa.n + " 场 / " + ms[1].month + "月 " + sb.n + " 场"].concat(lines);
      return base;
    }
  }
  /* 10) 成本结构 */
  if (has(/成本结构|成本构成|成本占比|成本花在哪/)) {
    const b = econBaseline(12);
    const rows = ECON_COST_KEYS.map((k) => ({ k: k, v: econNum(b.byKey[k] && b.byKey[k].avgPerRun) })).filter((r) => r.v > 0).sort((a, b2) => b2.v - a.v);
    if (!rows.length) return Object.assign(base, { intent: "cost_structure", answer: "还没有成本数据。", insufficient: true });
    const tot = rows.reduce((s, r) => s + r.v, 0);
    base.intent = "cost_structure";
    base.answer = "近 " + b.months + " 个月平均单场成本结构：\n" + rows.map((r) => "· " + ECON_COST_LABEL[r.k] + " " + econMoney(r.v) + "（占 " + econPct(r.v / tot) + "）").join("\n");
    base.basis = ["有效样本 " + b.runs + " 场"];
    return base;
  }
  base.answer = "这个问题我暂时答不上来。你可以换成数据层面的问法，例如：\n" + ECON_SAMPLE_QUESTIONS.map((s) => "· " + s).join("\n") + "\n（ClubOS 只按已录入的真实经营数据回答，不编结论。）";
  base.insufficient = true;
  return base;
}

/* ------------------------- 十五、视图：我的生意怎么样？ ------------------------- */

function econClassBadge(key) {
  const d = ECON_CLASS_DEFS.find((x) => x.key === key) || { label: key };
  return `<span class="econ-badge econ-badge-${esc(key)}">${esc(d.label)}</span>`;
}
function econKpi(label, value, sub) {
  return `<div class="econ-kpi"><div class="econ-kpi-l">${esc(label)}</div><div class="econ-kpi-v">${value}</div>${sub ? `<div class="econ-kpi-s">${esc(sub)}</div>` : ""}</div>`;
}
function econProductCard(it, expanded) {
  const p = it.profile;
  return `<div class="econ-prod${expanded ? " is-open" : ""}">
    <div class="econ-prod-h">
      <div>
        <div class="econ-prod-t">${esc(p.name)} ${econClassBadge(it.cls.key)}</div>
        <div class="econ-prod-s">${p.runs} 场 · ${p.firstDate || "—"} ~ ${p.lastDate || "—"} · 平均报名 ${Math.round(p.avgSignups)} 人 · 均价 ${econMoney(p.avgPrice)}</div>
      </div>
      <div class="econ-prod-r">
        <div class="econ-prod-profit">${econMoney(p.avgProfit)}<span>场均毛利</span></div>
        <button class="btn btn-ghost btn-sm" data-action="econToggleProduct" data-pid="${esc(p.pid)}">${expanded ? "收起" : "经营画像"}</button>
      </div>
    </div>
    ${expanded ? `<div class="econ-prod-body">
      <div class="econ-grid">
        ${econKpi("执行场次", p.runs + " 场")}
        ${econKpi("平均报名", Math.round(p.avgSignups) + " 人", "最少 " + p.minSignups + " 人")}
        ${econKpi("平均客单价", econMoney(p.avgPrice))}
        ${econKpi("平均人均成本", econMoney(p.avgCostPerPerson))}
        ${econKpi("平均毛利率", econPct(p.avgMargin))}
        ${econKpi("成本波动", p.costVolatility == null ? "样本不足" : p.costVolatility <= 0.12 ? "较低" : econPct(p.costVolatility))}
        ${econKpi("利润波动", p.profitVolatility == null ? "样本不足" : p.profitVolatility <= 0.35 ? "较低" : econPct(p.profitVolatility))}
        ${econKpi("最低成团人数", p.breakEvenPeople == null ? "数据不足" : p.breakEvenPeople + " 人", "盈亏平衡")}
        ${econKpi("复购率", econPct(p.repeatRate), p.customers + " 位客户")}
        ${econKpi("拉新占比", econPct(p.newCustomerRate))}
      </div>
      <div class="econ-why"><div class="econ-why-h">${ICON("sparkles")} AI 判断依据</div>
        <ul class="econ-why-list">${it.cls.reasons.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
        <div class="econ-why-note">分档不只看单场利润，还看频次 / 毛利率 / 报名与成团 / 成本与利润稳定性 / 复购 / 拉新 / 季节。</div>
      </div>
      <div class="econ-runs">
        <div class="econ-runs-h">各批次经营数据</div>
        <table class="econ-tbl"><thead><tr><th>批次</th><th>人次</th><th>收入</th><th>成本</th><th>毛利</th><th>毛利率</th><th></th></tr></thead><tbody>
        ${p.runs_meta.map((r) => `<tr><td>${esc(r.md)}</td><td>${r.people}</td><td>${econMoney(r.revenue)}</td><td>${econMoney(r.cost)}</td><td>${econMoney(r.profit)}</td><td>${econPct(r.margin)}</td>
          <td class="econ-td-r"><button class="btn btn-ghost btn-xs" data-action="econEditActivity" data-aid="${esc(r.id)}">录成本</button></td></tr>`).join("")}
        </tbody></table>
      </div>
    </div>` : ""}
  </div>`;
}
function renderEconomics() {
  econSyncProducts();
  const ov = econYearOverview();
  const ins = econInsights();
  const pf = econPortfolio();
  const ask = state._econAsk || null;
  const openPid = state.econProductId || "";
  return `
  <div class="section-head">
    <div>
      <div class="section-title">我的生意怎么样？</div>
      <div class="muted small">${esc(ov.label)} · 数据来自每场活动的真实收入与核心成本</div>
    </div>
    <div class="econ-head-actions">
      ${ov.missing ? `<span class="econ-todo-chip">${ICON("clipboard")} ${ov.missing} 场活动还没录成本</span>` : `<span class="econ-todo-chip ok">${ICON("check")} 全部活动已录成本</span>`}
    </div>
  </div>

  <div class="econ-kpis">
    ${econKpi("执行活动", ov.runs + " 场", "报名 " + ov.registered + " 人 · 实到 " + ov.actual + " 人")}
    ${econKpi("活动收入", econMoney(ov.revenue), "含补款/附加，已抵扣退款")}
    ${econKpi("活动毛利", econMoney(ov.profit), "成本 " + econMoney(ov.cost))}
    ${econKpi("平均毛利率", econPct(ov.margin), "场均毛利 " + econMoney(ov.avgProfit))}
  </div>

  <div class="econ-note">${ICON("shield")} ClubOS 不做报销、审批、发票与会计 —— 收入自动从报名读取，成本只需一句话录入，结论由 AI 直接给你。</div>

  <div class="section-head"><div class="section-title">本年度经营洞察</div><span class="muted small">${ins.length} 条</span></div>
  ${ins.length ? `<div class="econ-ins">${ins.map((x, i) => `
    <div class="econ-ins-item econ-ins-${esc(x.kind)}">
      <div class="econ-ins-ic">${ICON(x.icon || "sparkles")}</div>
      <div class="econ-ins-main">
        <div class="econ-ins-t">${esc(x.text)}</div>
        <div class="econ-ins-f">${esc(x.fact)}</div>
        <div class="econ-ins-w">${x.hypothesis ? ICON("sparkles") + " " + esc(x.hypothesis) : ICON("eye-off") + " " + esc(x.why)}</div>
      </div>
    </div>`).join("")}</div>` : `<div class="empty">还没有可分析的经营数据。给已完成的活动录入车辆、餐饮、领队等成本后，这里会自动出现洞察。</div>`}

  <div class="section-head"><div class="section-title">我的活动产品</div><span class="muted small">${pf.groups.reduce((s, g) => s + g.items.length, 0)} 个产品</span></div>
  ${pf.groups.length ? pf.groups.map((g) => `
    <div class="econ-group">
      <div class="econ-group-h"><span class="econ-group-t">${esc(g.def.label)}</span><span class="muted small">${esc(g.def.note || "")}</span></div>
      ${g.items.map((it) => econProductCard(it, openPid === it.profile.pid)).join("")}
    </div>`).join("") : `<div class="empty">还没有活动。先创建活动并执行、录入成本，这里会形成你的活动产品组合。</div>`}

  <div class="section-head"><div class="section-title">直接问经营问题</div><span class="muted small">答案只来自已录入的真实数据</span></div>
  <div class="econ-ask">
    <div class="econ-ask-row">
      <input class="input" id="econAskInput" placeholder="例如：今年最赚钱的 5 条线路是什么？" value="${esc(state._econAskQ || "")}">
      <button class="btn btn-primary" data-action="econAsk">${ICON("sparkles")} 问 AI</button>
    </div>
    <div class="econ-ask-chips">${ECON_SAMPLE_QUESTIONS.map((s) => `<button class="econ-chip" data-action="econAskChip" data-q="${esc(s)}">${esc(s)}</button>`).join("")}</div>
    ${ask ? `<div class="econ-answer">
      <div class="econ-answer-h">${ICON("message")} ${esc(ask.question)}${ask.insufficient ? `<span class="econ-answer-tag">数据不足</span>` : ""}</div>
      <div class="econ-answer-b">${esc(ask.answer).replace(/\n/g, "<br>")}</div>
      ${ask.basis && ask.basis.length ? `<div class="econ-answer-basis"><b>计算依据</b>${ask.basis.map((b) => `<div>· ${esc(b)}</div>`).join("")}</div>` : ""}
    </div>` : ""}
  </div>

  <div class="econ-foot">不是财务报表，是经营结论。想看某一场的明细，去「活动内容 → 查看」里的经营数据。</div>`;
}

/* 成本录入面板：三种方式（极简 / 自然语言 / 截图） */
function renderEconCostPanel(a) {
  const e = econEnsure(a);
  const m = econMetrics(a);
  const r = m.revenue;
  const rows = ECON_COST_DEFS.map((d) => `<div class="econ-cost-row">
      <label>${ICON(d.icon)}<span>${esc(d.label)}</span></label>
      <input class="input econ-cost-in" type="number" min="0" step="1" data-econ-cost="${d.key}" value="${econNum(e.costs[d.key]) || ""}" placeholder="0">
    </div>`).join("");
  return `
  <div class="econ-cost" data-econ-aid="${esc(a.id)}">
    <div class="econ-cost-h">
      <div><div class="econ-cost-t">经营数据</div><div class="muted small">收入自动读取，成本一句话录入 —— 不需要任何凭证</div></div>
      <button class="btn btn-ghost btn-sm" data-action="econToggleCost">${ICON("sliders")} ${state._econOpenCost ? "收起" : "录入成本"}</button>
    </div>
    <div class="econ-cost-preview">
      <span>收入 <b>${econMoney(r.total)}</b>${r.autoRegistration ? `<i class="tiny muted">（报名自动）</i>` : ""}</span>
      <span>成本 <b>${econMoney(m.costTotal)}</b></span>
      <span>毛利 <b class="${m.grossProfit >= 0 ? "pos" : "neg"}">${econMoney(m.grossProfit)}</b></span>
      <span>毛利率 <b>${econPct(m.grossMargin)}</b></span>
      ${m.breakEvenPeople ? `<span>保本 <b>${m.breakEvenPeople} 人</b></span>` : ""}
      <span class="tiny muted">按 ${m.people} 人${m.peopleBasis === "actual" ? "（实到）" : m.peopleBasis === "registered" ? "（报名）" : ""} 计算</span>
    </div>
    ${state._econOpenCost ? `<div class="econ-cost-body">
      <div class="econ-cost-modes">
        <div class="econ-cost-mode">
          <div class="econ-cost-mode-t">A · 极简填写</div>
          <div class="econ-cost-grid">${rows}</div>
        </div>
        <div class="econ-cost-mode">
          <div class="econ-cost-mode-t">B · 一句话说给我</div>
          <textarea class="input econ-cost-nl" rows="3" placeholder="例如：今天大巴2800，吃饭1260，两个领队一共1000。">${esc(state._econNL || "")}</textarea>
          <button class="btn btn-soft btn-sm" data-action="econParseCost">${ICON("sparkles")} 让 AI 拆解并填入</button>
          <div class="tiny muted">识别车辆 / 住宿 / 餐饮 / 领队 / 保险 / 门票 / 物料，自动归类。</div>
        </div>
        <div class="econ-cost-mode">
          <div class="econ-cost-mode-t">C · 上传付款截图</div>
          <button class="btn btn-soft btn-sm" data-action="econCostImage">${ICON("camera")} 选择截图识别金额</button>
          <div class="tiny muted">截图只是快速录入方式，不是报销凭证，不会进入任何审批流。${visionAvailable && visionAvailable() ? "" : "（当前未配置视觉模型 Key，可先用 A/B 两种方式）"}</div>
        </div>
      </div>
      <div class="econ-cost-extra">
        <div class="econ-extra-t">收入补充（可选）</div>
        <div class="econ-cost-grid">
          <div class="econ-cost-row"><label><span>报名人数</span></label><input class="input econ-cost-in" type="number" min="0" data-econ-field="registeredParticipants" value="${e.registeredParticipants == null ? "" : e.registeredParticipants}" placeholder="自动"></div>
          <div class="econ-cost-row"><label><span>实际参加</span></label><input class="input econ-cost-in" type="number" min="0" data-econ-field="actualParticipants" value="${e.actualParticipants == null ? "" : e.actualParticipants}" placeholder="自动"></div>
          <div class="econ-cost-row"><label><span>补款</span></label><input class="input econ-cost-in" type="number" min="0" data-econ-field="supplements" value="${econNum(e.revenue.supplements) || ""}" placeholder="0"></div>
          <div class="econ-cost-row"><label><span>附加项目</span></label><input class="input econ-cost-in" type="number" min="0" data-econ-field="addons" value="${econNum(e.revenue.addons) || ""}" placeholder="0"></div>
          <div class="econ-cost-row"><label><span>退款</span></label><input class="input econ-cost-in" type="number" min="0" data-econ-field="refunds" value="${econNum(e.revenue.refunds) || ""}" placeholder="0"></div>
          <div class="econ-cost-row"><label><span>其他收入</span></label><input class="input econ-cost-in" type="number" min="0" data-econ-field="other" value="${econNum(e.revenue.other) || ""}" placeholder="0"></div>
        </div>
      </div>
      <div class="econ-cost-extra">
        <div class="econ-extra-t">元数据（可选，但填了才能分析原因）</div>
        <div class="econ-cost-grid">
          <div class="econ-cost-row"><label><span>车辆型号</span></label><input class="input econ-cost-in" data-econ-meta="transport.vehicleType" value="${esc(e.transportMeta.vehicleType || "")}" placeholder="如 39 座"></div>
          <div class="econ-cost-row"><label><span>车辆供应商</span></label><input class="input econ-cost-in" data-econ-meta="transport.supplier" value="${esc(e.transportMeta.supplier || "")}" placeholder="如 川运车队"></div>
          <div class="econ-cost-row"><label><span>房间数</span></label><input class="input econ-cost-in" type="number" min="0" data-econ-meta="accommodation.roomCount" value="${e.accommodationMeta.roomCount == null ? "" : e.accommodationMeta.roomCount}" placeholder="0"></div>
          <div class="econ-cost-row"><label><span>住宿供应商</span></label><input class="input econ-cost-in" data-econ-meta="accommodation.supplier" value="${esc(e.accommodationMeta.supplier || "")}" placeholder="如 山语民宿"></div>
          <div class="econ-cost-row"><label><span>餐饮供应商</span></label><input class="input econ-cost-in" data-econ-meta="mealMeta.supplier" value="${esc(e.mealMeta.supplier || "")}" placeholder="如 山脚农家"></div>
          <div class="econ-cost-row"><label><span>成本备注</span></label><input class="input econ-cost-in" data-econ-meta="transport.note" value="${esc(e.transportMeta.note || "")}" placeholder="如 换了大车"></div>
        </div>
      </div>
      <div class="econ-cost-actions">
        <button class="btn btn-primary" data-action="econSaveCost" data-aid="${esc(a.id)}">${ICON("check")} 保存经营数据</button>
        <button class="btn btn-ghost" data-action="econEditActivity" data-aid="${esc(a.id)}">打开经营分析</button>
      </div>
    </div>` : ""}
  </div>`;
}

/* 读取面板 → 写入 economics */
function econReadPanel(panel) {
  const aid = panel.getAttribute("data-econ-aid");
  const a = getActivity(aid);
  if (!a) return null;
  const e = econEnsure(a);
  const q = (s) => Array.prototype.slice.call(panel.querySelectorAll(s));
  q("[data-econ-cost]").forEach((inp) => {
    const v = inp.value === "" ? 0 : econNum(inp.value);
    e.costs[inp.getAttribute("data-econ-cost")] = v;
  });
  q("[data-econ-field]").forEach((inp) => {
    const f = inp.getAttribute("data-econ-field");
    const v = inp.value === "" ? null : econNum(inp.value);
    if (f === "registeredParticipants" || f === "actualParticipants") e[f] = v;
    else if (e.revenue[f] !== undefined) e.revenue[f] = v === null ? 0 : v;
  });
  q("[data-econ-meta]").forEach((inp) => {
    const path = inp.getAttribute("data-econ-meta").split(".");
    const v = inp.value === "" ? (inp.type === "number" ? null : "") : (inp.type === "number" ? econNum(inp.value) : inp.value);
    if (!e[path[0]]) e[path[0]] = {};
    e[path[0]][path[1]] = v;
  });
  e.updatedAt = Date.now();
  e.route = a.route || a.place || e.route;
  e.activityType = a.type || e.activityType;
  const d = econDateOf(a);
  e.startDate = e.startDate || d.iso;
  e.season = e.season || d.season;
  a.economics = e;
  ensureActivityProductId(a);
  e.productId = a.activityProductId;
  return a;
}

/* ------------------------- 十六、截图识别（可选能力） ------------------------- */

/* 复用「文字模型」配置调用视觉接口，把截图里的金额与类别抽出来。
   未配置时明确返回不可用，不假装识别成功。 */
async function econParseCostImage(file) {
  const mode = (typeof visionAuthMode === "function") ? visionAuthMode() : false;
  if (!mode) return { ok: false, reason: "no_vision_key", message: "当前未配置视觉模型 Key，截图识别不可用；请用「一句话说给我」或手动填写。" };
  let src = "";
  try {
    src = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(new Error("read fail"));
      fr.readAsDataURL(file);
    });
  } catch (e) {
    return { ok: false, reason: "read_fail", message: "图片读取失败，请换一张试试。" };
  }
  const prompt = "这是一张户外俱乐部活动的付款截图或收据。请只输出 JSON，不要解释：{\"items\":[{\"category\":\"车辆|住宿|餐饮|领队|保险|门票|物料|其他\",\"amount\":数字}]}。只提取真实出现的一笔或多笔支付金额。";
  try {
    const res = await fetch(visionBase() + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + visionKey() },
      body: JSON.stringify({
        model: visionModel(),
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: src } }] }],
        temperature: 0
      })
    });
    if (!res.ok) return { ok: false, reason: "api_error", message: "识别服务返回 " + res.status + "，请稍后重试或改用文字录入。" };
    const json = await res.json();
    const text = json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    const m = String(text || "").match(/\{[\s\S]*\}/);
    if (!m) return { ok: false, reason: "parse_fail", message: "没能从图片里读出金额，请改用文字录入。" };
    const data = JSON.parse(m[0]);
    const nameToKey = { "车辆": "transport", "住宿": "accommodation", "餐饮": "meals", "领队": "leaders", "保险": "insurance", "门票": "tickets", "物料": "materials", "其他": "other" };
    const items = (data.items || []).map((it) => ({
      key: nameToKey[it.category] || "other",
      label: ECON_COST_LABEL[nameToKey[it.category] || "other"],
      amount: Math.round(econNum(it.amount)),
      text: "截图识别"
    })).filter((it) => it.amount > 0);
    if (!items.length) return { ok: false, reason: "empty", message: "截图里没识别到金额。" };
    return { ok: true, items: items, source: "image" };
  } catch (e) {
    return { ok: false, reason: "network", message: "识别失败：" + String((e && e.message) || e) };
  }
}

/* ------------------------- 十七、事件接线（面板级） ------------------------- */

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const act = btn.getAttribute("data-action");
  if (act !== "econParseCost" && act !== "econSaveCost" && act !== "econCostImage") return;
  const panel = btn.closest(".econ-cost");
  const aid = panel ? panel.getAttribute("data-econ-aid") : (btn.getAttribute("data-aid") || "");
  const a = aid ? getActivity(aid) : null;

  if (act === "econParseCost") {
    const ta = panel && panel.querySelector(".econ-cost-nl");
    const text = (ta && ta.value) || "";
    const parsed = parseCostText(text);
    if (!parsed.items.length) { toast("没听懂这句，试试「大巴2800，吃饭1260，领队1000」这样写"); return; }
    panel.querySelectorAll("[data-econ-cost]").forEach((inp) => {
      const k = inp.getAttribute("data-econ-cost");
      if (parsed.grouped[k] != null) inp.value = String(econNum(inp.value) + parsed.grouped[k]);
    });
    state._econNL = text;
    toast("已拆解：" + parsed.items.map((it) => it.label + " " + econMoney(it.amount)).join("、") + "（合计 " + econMoney(parsed.total) + "），确认后保存");
    return;
  }
  if (act === "econSaveCost") {
    if (!a) { toast("没找到这场活动"); return; }
    econReadPanel(panel);
    saveState();
    toast("经营数据已保存");
    rerenderEcon(btn);
    return;
  }
  if (act === "econCostImage") {
    if (!a) { toast("没找到这场活动"); return; }
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*";
    inp.addEventListener("change", () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      econParseCostImage(f).then((res) => {
        if (!res.ok) { toast(res.message); return; }
        panel.querySelectorAll("[data-econ-cost]").forEach((el) => {
          const k = el.getAttribute("data-econ-cost");
          const hit = res.items.filter((it) => it.key === k).reduce((s, it) => s + it.amount, 0);
          if (hit) el.value = String(econNum(el.value) + hit);
        });
        toast("截图识别到：" + res.items.map((it) => it.label + " " + econMoney(it.amount)).join("、"));
      });
    });
    inp.click();
    return;
  }
});

/* 在任意视图内就地刷新（不整页重渲染，避免输入丢失） */
function rerenderEcon(el) {
  if (state.view === "economics") showView("economics");
  else if (state.view === "activityPage") showView("activityPage", { id: (state.params || {}).id });
  else if (el) {
    const host = el.closest("[data-econ-host]");
    if (host) host.innerHTML = host.getAttribute("data-econ-host") === "cost" ? "" : host.innerHTML;
  }
}
