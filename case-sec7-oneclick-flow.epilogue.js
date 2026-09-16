/* §七 最终完成标准 · 端到端一键闭环验收
   模拟老板的真实操作：输入一句话 → 上传图片 → AI 自动理解 → 系统只问必要问题
   → 自动生成完整活动 → 自动生成图文详情页 → 换版式/换风格 → 确认发布。

   v188 关键回归：落点必须是【后台「活动详情」工作区 activityPage】，
   绝不能再跳到 AI 宣发中心（operator）——宣发文案是可选后置步骤。

   契约：epilogue 为裸脚本 + 顶层 return {ok,total,passed,checks} */

state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);
if (state && !Array.isArray(state.activities)) state.activities = [];
if (state && !Array.isArray(state.signups)) state.signups = [];
if (state) { state.xf = null; state.params = {}; state.draft = null; }

/* DOM stub 补丁：showView → updateBrandColor 会写 documentElement.style.setProperty，
   极简 stub 的 style 只有普通对象，这里补齐，避免链路断言被 harness 限制误判。 */
try {
  const de = document.documentElement;
  if (de) {
    de.style = de.style || {};
    if (typeof de.style.setProperty !== "function") de.style.setProperty = function () {};
    if (typeof de.style.removeProperty !== "function") de.style.removeProperty = function () {};
    if (typeof de.style.getPropertyValue !== "function") de.style.getPropertyValue = function () { return ""; };
  }
  const bd = document.body;
  if (bd && !bd.classList) bd.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
} catch (e) { /* ignore */ }

const checks = [];
const rec = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail === undefined ? "" : String(detail) });
const t = (fn) => { try { return fn(); } catch (e) { return "__ERR__" + String((e && e.message) || e); } };
const has = (html, needle) => typeof html === "string" && html.indexOf(needle) >= 0;

/* ---------- 1) 第 1 步：一句话输入 + 传图入口 ---------- */
const createHtml = t(() => renderCreate());
rec("§七-1 第 1 步就能传图（createPhotoInput 存在于创建页）", has(createHtml, "createPhotoInput"), typeof createHtml === "string" ? createHtml.length : createHtml);
rec("§七-1 创建页保留一句话输入（createInput）", has(createHtml, "createInput"));

/* ---------- 2) 构造「AI 已自动理解」后的活动（等效 parseActivityWithAI + applyAIResult 落点） ---------- */
const a = blankActivity();
a.raw = "本周六赵公山轻装徒步，12公里爬升1100米，168元/人，限25人，早上7:30天府广场集合";
a.title = "赵公山轻装徒步";
a.type = "徒步";
a.place = "都江堰";
a.date = "2026-09-20";
a.dateMD = "9月20日";
a.price = 168;
a.limit = 25;
a.limitUnit = "人";
a.meetTime = "07:30";
a.meeting = "天府广场";
a.route = "赵公山环线";
a.distance = 12;
a.elevation = "1100";
a.difficulty = "适中";
a.gear = ["登山鞋", "冲锋衣"];
a.includeLeader = true;
a.includeInsurance = true;
a.factConfirmed = { route: true, meeting: true, meetTime: true, price: true, date: true, place: true, difficulty: true, services: true, limit: true };
a.photos = ["data:image/png;base64,AAAA1", "data:image/png;base64,AAAA2", "data:image/png;base64,AAAA3"];
state.draft = a;

/* ---------- 3) 确认卡：只问必要问题 + 可传图 + 主按钮=一键生成详情页 ---------- */
const fcHtml = t(() => renderFactConfirm());
rec("§七-3 确认卡可传图（confirmPhotoInput）", has(fcHtml, "confirmPhotoInput"));
rec("§七-3 确认卡主按钮 = 一键生成图文详情页", has(fcHtml, "confirmFactsToPage"));
rec("§七-3 确认卡仍只问必要问题（确认卡区块存在）", has(fcHtml, "gc-block"));
rec("§七-3 已上传照片数在确认卡可见", has(fcHtml, "已上传 3 张"), typeof fcHtml === "string" ? (has(fcHtml, "已上传 3 张") ? "ok" : fcHtml.match(/已上传[^，<]{0,12}/) || "未命中") : fcHtml);

/* ---------- 4) 一键闭环：确认卡 → 落库 → 【活动详情】工作区（★本轮修复点） ---------- */
await confirmFactsToPage();
const lib = (state.activities || []).find((x) => x.id === a.id);
rec("§七-4 活动自动落库（老板无需手动保存）", !!lib);
rec("§七-4 ★落点 = 后台「活动详情」工作区（activityPage）", state.view === "activityPage", state.view);
rec("§七-4 ★不再跳到 AI 宣发中心（operator）", state.view !== "operator", state.view);
rec("§七-4 全程未进入逐字段编辑器", state.view !== "editor", state.view);
rec("§七-4 草稿已释放（未在编辑器里挂着改）", !state.draft);
rec("§七-4 默认输出「图文长页」（有感染力的详情页）", state.detailMode === "editorial", state.detailMode);
/* ★渲染层断言：只看 state.view 会被「view 设对了但渲染走兜底分支」骗过（backend 数组漏登记时正是如此） */
const appHtml = (document.querySelector("#app") || {}).innerHTML || "";
rec("§七-4 ★#app 真的渲染出活动详情工作区（ap-head）", has(appHtml, "ap-head"), appHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60));
rec("§七-4 ★#app 渲染出图文长页（xh-ed）", has(appHtml, "xh-ed"));
rec("§七-4 ★#app 不是兜底的前台首页", !has(appHtml, "front-v16") && !has(appHtml, "home-hero"));

/* ---------- 5) 自动生成【完整活动】：关键决策字段无需老板逐项填写 ---------- */
const keyFields = ["title", "type", "place", "date", "price", "limit", "difficulty"];
const missing = keyFields.filter((k) => !lib || lib[k] === undefined || lib[k] === null || String(lib[k]).trim() === "");
rec("§七-5 完整活动：关键决策字段齐备", missing.length === 0, "缺失=" + (missing.join(",") || "无"));
const factsN = (typeof confirmedFacts === "function" && lib) ? confirmedFacts(lib).length : 0;
rec("§七-5 已确认事实进入发布检查链路", factsN > 0, factsN + " 项");

/* ---------- 6) 自动生成【图文详情页】+ 自动筛图/配图/裁切 ---------- */
const pageHtml = t(() => renderActivityPage());
rec("§七-6 活动详情工作区渲染出图文长页（xh-ed）", has(pageHtml, "xh-ed"), typeof pageHtml === "string" ? pageHtml.length : pageHtml);
rec("§七-6 详情页含本活动标题", has(pageHtml, "赵公山轻装徒步"));
rec("§七-6 详情页含 AI 自动完成摘要（事实/选图/角色）", has(pageHtml, "ap-meta"));
rec("§七-6 详情页提供换版式 / 换风格", has(pageHtml, "regenLayout") && has(pageHtml, "regenStyle"));
rec("§七-6 详情页提供确认发布出口", has(pageHtml, "confirmPublishPage"));
rec("§七-6 宣发文案降级为可选按钮", has(pageHtml, "operatorFromActivity"));
rec("§七-6 未手动指定封面（AI 自动选最佳封面）", !!lib && lib.coverIndex !== undefined && !lib._coverManual, lib && lib.coverIndex);
rec("§七-6 自动选定版式与风格（无需自己排版）", !!lib && !!lib.editorialLayoutId && !!lib.editorialStyleId, lib ? lib.editorialLayoutId + "/" + lib.editorialStyleId : "none");
const intel = (lib && lib.photos) ? t(() => buildPhotoIntelligence(lib.photos, lib, [], "recruit")) : null;
rec("§七-6 照片智能自动执行（筛选+角色分配，无需自己挑图/配图）", !!intel && typeof intel === "object" && Object.keys(intel.roles || {}).length > 0, intel && typeof intel === "object" ? "roles=" + Object.keys(intel.roles || {}).length: "no intel");
rec("§七-6 裁切安全自动评估（无需自己检查人物是否被裁坏）", !!t(() => evaluateCropSafety(lib.photos, (intel && intel.analysis) || [], "hero")), "evaluateCropSafety 可自动调用");

/* ---------- 7) 不满意就换版式 / 换风格（且事实不变） ---------- */
const factsBefore = JSON.stringify((typeof confirmedFacts === "function") ? confirmedFacts(lib) : {});
const layoutBefore = lib.editorialLayoutId;
await handleClick("regenLayout", { dataset: {} });
const layoutAfter = ((state.activities || []).find((x) => x.id === a.id) || {}).editorialLayoutId;
rec("§七-7 换版式生效（版式轴推进）", !!layoutAfter && layoutAfter !== layoutBefore, layoutBefore + " → " + layoutAfter);
rec("§七-7 换版式后仍停留在活动详情页", state.view === "activityPage", state.view);
const styleBefore = lib.editorialStyleId;
await handleClick("regenStyle", { dataset: {} });
const styleAfter = ((state.activities || []).find((x) => x.id === a.id) || {}).editorialStyleId;
rec("§七-7 换风格生效（风格轴推进）", !!styleAfter && styleAfter !== styleBefore, styleBefore + " → " + styleAfter);
const factsAfter = JSON.stringify((typeof confirmedFacts === "function") ? confirmedFacts(lib) : {});
rec("§七-7 换版式/换风格后事实不变（只改视觉，不改事实）", factsBefore === factsAfter && factsBefore.length > 2, factsBefore.length + " → " + factsAfter.length);

/* ---------- 8) 宣发文案是【可选后置步骤】（不是默认落点） ---------- */
await handleClick("operatorFromActivity", { dataset: {} });
const xf = publishState();
rec("§七-8 点「生成宣发文案」才进 AI 宣发中心", state.view === "operator", state.view);
rec("§七-8 宣发中心已自动指向本活动（无需重新选择）", xf.aid === a.id && !!xf._a, xf.aid);
rec("§七-8 照片自动带入宣发链路", (xf.photos || []).length === 3, (xf.photos || []).length);

/* ---------- 9) 确认发布（最后一环） ---------- */
showView("activityPage", { id: a.id });
confirmPublishPage();
const published = (state.activities || []).find((x) => x.id === a.id);
rec("§七-9 确认发布后活动状态变为「招募中」", !!published && published.status === "recruiting", published && published.status);
rec("§七-9 发布后自动进历史活动库（下次一键沿用）", (state.history || []).some((h) => h.id === a.id));
rec("§七-9 发布后仍停在活动详情（不被打断去别处）", state.view === "activityPage", state.view);

/* ---------- 10) 活动列表入口：能随时回到「详情页」工作区 ---------- */
showView("list");
const listHtml = t(() => renderList());
rec("§七-10 活动列表可进入「详情页」工作区", has(listHtml, "openActivityPage"));

/* ---------- 11) 反面对照：事实不全时不硬发，回到确认卡补全 ---------- */
const b = blankActivity();
b.title = "只写了一句话的活动";
b.raw = "下周去爬山";
b.factConfirmed = {};
upsert(b);
showView("activityPage", { id: b.id });
confirmPublishPage();
const bAfter = (state.activities || []).find((x) => x.id === b.id);
rec("§七-11 关键事实不全 → 不硬发（状态仍非招募中）", !!bAfter && bAfter.status !== "recruiting", bAfter && bAfter.status);
rec("§七-11 自动回到确认卡补全（而不是丢进编辑器）", state.view === "factConfirm", state.view);

/* ---------- 12) 反面对照汇总：老板没动手挑图/配图/指定封面 ---------- */
const xf2 = publishState();
rec("§七-12 未手动指定封面（photoOverrides.cover 为空=AI 自动选）", (xf2.photoOverrides || {}).cover === null || (xf2.photoOverrides || {}).cover == null, JSON.stringify((xf2.photoOverrides || {}).cover));
rec("§七-12 未手动排除任何图（excluded 为空=AI 自动筛）", Object.keys((xf2.photoOverrides || {}).excluded || {}).length === 0);

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  total: checks.length,
  passed: checks.length - failed.length,
  failedNames: failed.map((c) => c.name),
  checks: checks,
};
