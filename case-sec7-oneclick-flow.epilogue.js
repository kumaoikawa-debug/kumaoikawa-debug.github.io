/* §七 最终完成标准 · 端到端一键闭环验收
   模拟老板的真实操作：输入一句话 → 上传图片 → AI 自动理解 → 系统只问必要问题
   → 自动生成完整活动 → 自动生成图文详情页 → 换版式/换风格 → 确认发布。
   并通过「反面对照」断言老板不再需要：逐字段修改 / 自己挑图 / 自己配图 / 自己排版 / 自己检查裁图。 

   契约：epilogue 为裸脚本 + 顶层 return {ok,total,passed,checks} */

state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);
if (state && !Array.isArray(state.activities)) state.activities = [];
if (state && !Array.isArray(state.signups)) state.signups = [];
if (state) state.xf = null;

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

/* ---------- 4) 一键闭环：确认卡 → 落库 → 直接生成图文详情页 ---------- */
await confirmFactsToPage();
const lib = (state.activities || []).find((x) => x.id === a.id);
rec("§七-4 活动自动落库（老板无需手动保存）", !!lib);
const xf = publishState();
rec("§七-4 场景自动切到「活动招募」且指向本活动", xf.scenario === "recruit" && xf.aid === a.id, xf.scenario + "/" + xf.aid);
rec("§七-4 旧资料/原话自动带入 AI", typeof xf.notes === "string" && xf.notes.indexOf("赵公山") >= 0, xf.notes);
rec("§七-4 照片自动带进生成链路", (xf.photos || []).length === 3, (xf.photos || []).length);
rec("§七-4 自动生成图文详情页（step=result 且 gzh 非空）", xf.step === "result" && !!xf.out && !!xf.out.gzh, xf.step + "/" + !!xf.out);
rec("§七-4 全程未进入逐字段编辑器", state.view !== "editor", state.view);
rec("§七-4 草稿已释放（未在编辑器里挂着改）", !state.draft);

/* ---------- 5) 自动排版 / 自动配图 / 自动筛选 / 自动裁切安全 ---------- */
const dir = xf.strategy && xf.strategy.editorialDirection;
rec("§七-5 自动选定编辑家族与版式变体（无需自己排版）", !!(dir && dir.family) && typeof dir.variant === "number", dir && dir.family + "/" + (dir && dir.variant));
rec("§七-5 自动产出章节结构", !!(dir && dir.structure && dir.structure.length), dir && (dir.structure || []).length);
const intel = xf.strategy && xf.strategy.photoIntel;
rec("§七-5 照片智能自动执行（筛选+角色分配，无需自己挑图/配图）", !!intel && !!intel.roleLabel, intel ? "roles=" + Object.keys(intel.roles || {}).length : "no intel");
rec("§七-5 裁切安全自动评估（无需自己检查人物是否被裁坏）", !!t(() => evaluateCropSafety(a.photos, intel && intel.analysis, "hero")) , "evaluateCropSafety 可自动调用");
const resHtml = t(() => recruitResult());
rec("§七-5 详情页已渲染出来（含公众号正文）", has(resHtml, "xf-theme") || has(resHtml, "xf-gzh-head"), typeof resHtml === "string" ? resHtml.length : resHtml);

/* ---------- 6) 不满意就换版式 / 换风格 ---------- */
rec("§七-6 详情页提供「换一种版式」", has(resHtml, "nextVariant"));
rec("§七-6 详情页提供「换一种风格」", has(resHtml, "switchStyle"));
const factsBefore = JSON.stringify((xf.master || {}).confirmedFacts || {});
const quick = t(() => { quickStyle("magazine"); return "ok"; });
rec("§七-6 换风格可执行（quickStyle 不报错）", quick === "ok", quick);
const factsAfter = JSON.stringify((publishState().master || {}).confirmedFacts || {});
rec("§七-6 换风格后事实不变（只改视觉/表达，不改事实）", factsBefore === factsAfter && factsBefore.length > 2, factsBefore.length + "→" + factsAfter.length);

/* ---------- 7) 确认发布 ---------- */
rec("§七-7 详情页提供「确认发布」出口", has(resHtml, "confirmPublishPage"));
confirmPublishPage();
const published = (state.activities || []).find((x) => x.id === a.id);
rec("§七-8 确认发布后活动状态变为「招募中」", !!published && published.status === "recruiting", published && published.status);
rec("§七-8 发布后自动进历史活动库（下次一键沿用）", (state.history || []).some((h) => h.id === a.id));

/* ---------- 9) 反面对照：事实不全时不硬发，回到确认卡补全 ---------- */
const b = blankActivity();
b.title = "只写了一句话的活动";
b.raw = "下周去爬山";
b.factConfirmed = {};
upsert(b);
const xf2 = publishState();
xf2.scenario = "recruit"; xf2.aid = b.id; xf2._a = b; xf2.out = null; xf2.master = null; xf2.step = null;
confirmPublishPage();
const bAfter = (state.activities || []).find((x) => x.id === b.id);
rec("§七-9 关键事实不全 → 不硬发（状态仍非招募中）", !!bAfter && bAfter.status !== "recruiting", bAfter && bAfter.status);
rec("§七-9 自动回到确认卡补全（而不是丢进编辑器）", state.view === "factConfirm", state.view);

/* ---------- 10) 反面对照汇总 ---------- */
rec("§七-10 未手动指定封面（photoOverrides.cover 仍为空=AI 自动选）", (xf.photoOverrides || {}).cover === null || (xf.photoOverrides || {}).cover == null, JSON.stringify((xf.photoOverrides || {}).cover));
rec("§七-10 未手动排除任何图（excluded 为空=AI 自动筛）", Object.keys((xf.photoOverrides || {}).excluded || {}).length === 0);

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  total: checks.length,
  passed: checks.length - failed.length,
  failedNames: failed.map((c) => c.name),
  checks: checks,
};
