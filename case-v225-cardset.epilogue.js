/* =======================================================================
 * case-v225-cardset.epilogue.js — 一键卡片组：结构化事实解析 + 4 类卡规划
 * -----------------------------------------------------------------------
 * 老板一句话 / 活动文案 → parseCardsetInput 抽结构化事实 → planCardset 规划
 * 封面 / 按天行程 / 亮点 / 出行提示 四张卡。纯函数，无 DOM 依赖，可离线断言。
 * 栏杆：中文数字「第一天/第二天」必须被识别为分段；集合地点须从「XX07:30集合」剥出。
 * ======================================================================= */
state = loadState();
const out = {};
const checks = [];
function rec(name, pass, detail) { checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) }); }
const has = (s, sub) => String(s == null ? "" : s).indexOf(sub) >= 0;
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const A = "赵公山周末轻装徒步，9月12日天府广场07:30集合，12公里环线爬升1100米，限25人，168元/人含保险。亮点：一日往返、小队领队随队。装备：防滑鞋、登山杖、饮水路餐。";
const B = "第一天\n07:30 天府广场集合签到\n09:00 抵达山脚热身\n14:30 登顶赵公山\n第二天\n08:00 早餐后出发";

/* ---------- §1 一句话解析 ---------- */
const fA = parseCardsetInput(A);
rec("S1 标题抽取（截断到首逗号前）", fA.title === "赵公山周末轻装徒步", fA.title);
rec("S2 类型识别=徒步 / pageStyle=hike", fA.type === "徒步" && fA.pageStyle === "hike", fA.type + "/" + fA.pageStyle);
rec("S3 日期=9月12日", fA.dateMD === "9月12日", fA.dateMD);
rec("S4 集合地点从「天府广场07:30集合」剥出=天府广场", fA.meeting === "天府广场", fA.meeting);
rec("S5 集合时间=07:30", fA.meetTime === "07:30", fA.meetTime);
rec("S6 价格=168", fA.price === 168, fA.price);
rec("S7 人数=25", fA.limit === 25, fA.limit);
rec("S8 亮点=2 条（一日往返 / 小队领队随队）", fA.sellingPoints.length === 2 && fA.sellingPoints[0].title === "一日往返" && fA.sellingPoints[1].title === "小队领队随队", JSON.stringify(fA.sellingPoints.map(p=>p.title)));
rec("S9 装备=3 件", fA.gear.length === 3 && fA.gear[0].name === "防滑鞋", JSON.stringify(fA.gear.map(g=>g.name)));
rec("S10 一句话无分段标记 → 行程天数 0（规划时补默认日卡）", fA.itineraryDays.length === 0, fA.itineraryDays.length);

/* ---------- §2 多天行程解析（中文数字栏杆） ---------- */
const fB = parseCardsetInput(B);
rec("M1 两天分段均被识别", fB.itineraryDays.length === 2, fB.itineraryDays.length);
rec("M2 第一天 label=第一天", fB.itineraryDays[0].label === "第一天", fB.itineraryDays[0].label);
rec("M3 第一天 3 个时间轴项", fB.itineraryDays[0].items.length === 3, fB.itineraryDays[0].items.length);
rec("M4 首项正确带时间 07:30 且含「集合」", fB.itineraryDays[0].items[0].time === "07:30" && has(fB.itineraryDays[0].items[0].text, "集合"), JSON.stringify(fB.itineraryDays[0].items[0]));
rec("M5 第二天 label=第二天 且 1 项", fB.itineraryDays[1].label === "第二天" && fB.itineraryDays[1].items.length === 1, JSON.stringify(fB.itineraryDays[1]));

/* ---------- §3 规划：4 类卡 ---------- */
const planA = planCardset(fA);
rec("P1 一句话 → 恰好 4 张卡（封面+默认日+亮点+提示）", planA.length === 4, planA.map(c=>c.kind).join(","));
rec("P2 封面卡价格格式=¥168/人", planA[0].kind === "cover" && planA[0].price === "¥168/人", planA[0].price);
rec("P3 行程卡为默认日（无项）", planA[1].kind === "day", planA[1].kind);
rec("P4 亮点卡=2 点", planA[2].kind === "highlights" && planA[2].points.length === 2, planA[2].points.length);
rec("P5 提示卡装备=3 且集合地点=天府广场", planA[3].kind === "tips" && planA[3].gear.length === 3 && planA[3].meeting === "天府广场", planA[3].gear.length + "/" + planA[3].meeting);

const planB = planCardset(fB);
rec("P6 多天 → 5 张卡（封面+2日+亮点+提示）", planB.length === 5, planB.map(c=>c.kind).join(","));
rec("P7 其中 day 卡=2 张", planB.filter(c=>c.kind === "day").length === 2, planB.filter(c=>c.kind === "day").length);

/* ---------- §4 卡片标题 + 空输入兜底 ---------- */
rec("T1 cardsetCardTitle 四类标签正确",
  cardsetCardTitle({kind:"cover"}) === "封面卡" &&
  cardsetCardTitle({kind:"day",label:"D1"}) === "行程卡 · D1" &&
  cardsetCardTitle({kind:"highlights"}) === "亮点卡" &&
  cardsetCardTitle({kind:"tips"}) === "出行提示卡",
  "ok");
const emptyPlan = planCardset(parseCardsetInput(""));
rec("T2 空输入 → 封面标题兜底=活动卡片", emptyPlan[0].title === "活动卡片", emptyPlan[0].title);
rec("T3 空输入 → 亮点卡兜底=敬请期待", emptyPlan[2].points[0].title === "敬请期待", emptyPlan[2].points[0].title);

/* ---------- §5 解析确定性（同输入两次结果一致） ---------- */
rec("D1 解析幂等", eq(parseCardsetInput(A), parseCardsetInput(A)), "ok");

/* ---------- 汇总 ---------- */
let passN = 0;
checks.forEach(c => { if (c.pass) passN++; });
const fail = checks.filter(c => !c.pass);
console.log("[cardset] " + passN + "/" + checks.length + " 通过");
if (fail.length) { console.log("失败项："); fail.forEach(c => console.log("  ✗ " + c.name + " → " + c.detail)); }
out.cardset = { pass: passN, total: checks.length, failed: fail.map(c=>c.name) };
if (fail.length) { throw new Error("cardset contract failed: " + fail.map(c=>c.name).join(", ")); }
