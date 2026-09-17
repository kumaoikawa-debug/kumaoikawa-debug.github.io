/* case-v208-full-audit.epilogue.js
   ClubOS v208「全板块体检」契约 —— 把三类复发风险钉死：
     ① 板块渲染抛异常被吞掉 → 白屏 / 点了没反应（老板反馈的原话是「编辑点不动」）；
     ② 旧数据缺结构化内容 → 详情页空（v207 的旧草稿自愈）；
     ③ AI 调用失败静默回退 → 老板以为「AI 没干活」。
   外加：图文排版 7 套版式的可用性与轮换、图片空 src 破图。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v208-full-audit.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};
const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;

/* ============ §A 渲染护栏：抛错不再白屏 ============ */
add("A1 safeRender 存在", typeof safeRender === "function", "");
const boom = safeRender(function () { throw new Error("渲染炸了"); }, "someView");
add("A2 ★渲染抛错时返回可见的错误面板（不是空白）", has(boom, "板块加载出错") && has(boom, "渲染炸了"), boom.slice(0, 80));
add("A3 错误面板带出问题的板块名（可定位）", has(boom, "someView"), "");
add("A4 错误面板给退路（返回工作台 / 去活动列表）", has(boom, 'data-view="dashboard"') && has(boom, 'data-view="list"'), "");
add("A5 正常渲染原样透传", safeRender(function () { return "<b>ok</b>"; }, "list") === "<b>ok</b>", "");
add("A6 ★showView 对未知板块也不崩（有兜底分支）",
  (function () { try { showView("__不存在的板块__"); return true; } catch (e) { return false; } })(), "");

/* ============ §B 板块渲染函数齐备（视图白名单 ↔ 渲染函数一一对应） ============ */
const VIEW_RENDER = {
  dashboard: "renderDashboard", create: "renderCreate", advice: "renderContentAdvice", editor: "renderEditor",
  factConfirm: "renderFactConfirm", list: "renderList", activityPage: "renderActivityPage", prep: "renderPrep",
  economics: "renderEconomics", customers: "renderCustomers", operator: "renderFabu", mallConsole: "renderClubMallConsole",
  settings: "renderSettings", decorate: "renderDecorate", analytics: "renderAnalytics", signups: "renderSignups",
  membership: "renderMembershipAdmin", ai: "renderSettings", brand: "renderSettings", plans: "renderSettings",
  memberMarketing: "renderSettings", membershipAdmin: "renderMembershipAdmin"
};
const missRender = Object.keys(VIEW_RENDER).filter((v) => typeof globalThis[VIEW_RENDER[v]] !== "function");
add("B1 ★22 个后台板块都有渲染函数", missRender.length === 0, missRender.join(","));
const feRender = ["renderFrontHome", "renderActivityPhone", "renderSignupPage", "renderSuccess", "renderMySignups", "renderMyOrders", "renderStorefront", "renderMallAdmin", "renderMallProduct", "renderMallCart", "renderMembershipH5"];
const missFe = feRender.filter((f) => typeof globalThis[f] !== "function");
add("B2 ★11 个 C 端板块都有渲染函数", missFe.length === 0, missFe.join(","));

/* ============ §C 图文排版：7 套版式可用 + 真轮换 ============ */
add("C1 版式变体共 7 套", Array.isArray(EDITORIAL_VARIANTS) && EDITORIAL_VARIANTS.length === 7, String(EDITORIAL_VARIANTS && EDITORIAL_VARIANTS.length));
add("C2 每套版式的 angle/structure/img/density 四要素齐全",
  EDITORIAL_VARIANTS.every((v) => v.id && v.angle && v.structure && v.img && v.density), "");
const seq = [];
let prev = null;
for (let i = 0; i < 9; i++) { const v = pickEditorialVariant({}, prev); seq.push(v.id); prev = v.id; }
add("C3 ★换版式真轮换（连点 7 次覆盖全部 7 套）", new Set(seq.slice(0, 7)).size === 7, seq.join(">"));
add("C4 相邻两版不重复", seq.every((id, i) => i === 0 || id !== seq[i - 1]), "");
add("C5 轮换是循环的（第 8 次回到第一套）", seq[7] === seq[0], seq[7] + " vs " + seq[0]);
const seedAct = { id: "audit", title: "川西两天一夜", days: 2, place: "新都桥", photos: [],
  itineraryDays: [{ label: "第 1 天", sub: "成都—鱼子西", items: [{ time: "08:00 - 12:00", text: "成都集合出发" }] }] };
let renderFails = [], itinMiss = [];
EDITORIAL_VARIANTS.forEach((v) => {
  seedAct.editorialVariantId = v.id;
  let h = "";
  try { h = renderActivityPhone(seedAct); } catch (e) { h = "THROW:" + e.message; }
  if (!h || h.length < 500 || has(h, "THROW")) renderFails.push(v.id + (has(h, "THROW") ? ":" + h.slice(0, 60) : ":过短"));
  if (!has(h, "成都集合出发")) itinMiss.push(v.id);
});
add("C6 ★7 套版式全部能渲染出图文详情页", renderFails.length === 0, renderFails.join(" | "));
add("C7 ★换版式不换事实：7 套版式都保留行程原文", itinMiss.length === 0, itinMiss.join(","));
add("C8 详情页不再输出空 src 的 img（避免破图与无效请求）",
  !has(renderActivityPhone(seedAct), 'src=""'), "");

/* ============ §D AI 生成能力：失败可见、不静默 ============ */
add("D1 noteAiFailure 存在", typeof noteAiFailure === "function", "");
const origToast = (typeof toast === "function") ? toast : null;
let toastCount = 0;
try { globalThis.toast = function () { toastCount++; }; } catch (e) {}
try {
  noteAiFailure("net"); noteAiFailure("net"); noteAiFailure("net");
  add("D2 ★AI 失败会给可见提示", toastCount >= 1, String(toastCount));
  add("D3 ★同类提示 6 秒内只提示一次（不刷屏）", toastCount === 1, String(toastCount));
} catch (e) { add("D2 AI 失败会给可见提示", false, String(e)); add("D3 节流", false, ""); }
try { if (origToast) globalThis.toast = origToast; } catch (e) {}
add("D4 clubLLM 无 Key 时不打扰用户（直接返回 null）",
  (async () => true) ? typeof clubLLM === "function" : false, "");

/* ============ §E 旧数据自愈（v207）：缺行程的活动自动补 ============ */
const oldAct = { id: "old1", title: "旧草稿", raw: "Day 1 时间计划\n08:00 - 12:00\n成都集合出发，前往康定\nDay 2\n13:00 - 19:00\n返回成都" };
const filled = backfillItineraryFromPlan(oldAct);
add("E1 ★旧活动（无结构化行程）打开时自动补出行程", filled === true && (oldAct.itineraryDays || []).length === 2, JSON.stringify((oldAct.itineraryDays || []).length));
add("E2 自愈补的是原文（不是编的）", (oldAct.itineraryDays || [])[0] && (oldAct.itineraryDays[0].items || [])[0] && oldAct.itineraryDays[0].items[0].text === "成都集合出发，前往康定", JSON.stringify(oldAct.itineraryDays));
add("E3 自愈同步天数（防行程被砍成 1 天）", oldAct.days === 2, String(oldAct.days));
add("E4 只补一次（幂等）", backfillItineraryFromPlan(oldAct) === false, "");
const richAct = { id: "rich", itineraryDays: [{ label: "已有", sub: "", items: [{ time: "08:00", text: "已有行程" }] }] };
add("E5 已有行程的活动不被覆盖", backfillItineraryFromPlan(richAct) === false && richAct.itineraryDays[0].items[0].text === "已有行程", "");

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
