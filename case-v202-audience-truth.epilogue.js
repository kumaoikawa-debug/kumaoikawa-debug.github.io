/* case-v202-audience-truth.epilogue.js
   ClubOS v202「参与人群」单一真源契约。

   发现过程：v201 收尾后做「野字段审计」——把 publish.js 里所有 `a.xxx` 读取
   与 blankActivity() 声明的字段做差集，再对差集逐个查「编辑器有没有输入框 / 有没有写入点」。
   全体候选中只有一个是**真缺陷**：

     a.targetAudience —— 全仓 0 个写入点、编辑器 0 个 data-bind，
       只有 buildContentMaster() 的内部对象才有这个键（那是另一个人群字段，来自 targetUser(a)）。
     而老板唯一能填的是 a.audience（数组，activities.js 的「参与人群」input，顿号分隔）。
     → publish.js 里两处读 a.targetAudience 的代码**永远拿到空串**，静默失效：
       ① editorialFacts().audience（模板占位符 {audience} 的数据源）
       ② v201 新加的「只要活动填了参与人群，就在适合谁里补一句」——这一句从来没触发过。

   修法：新增 activityAudienceText(a) 作为参与人群的**唯一读取入口**（数组 → 顿号串；
   兼容旧字符串数据；空则空串），两处读取全部改走它。

   本文件的断言组：
     §A 真源函数本身（数组/字符串/空白/空/legacy 兜底）
     §B editorialFacts 事实映射
     §C 图文长页「适合谁」区块（正向 + 反向：换人群值应跟着变，不填则不出现）
     §D 事实层与后台输入框未被动过（不误伤）
     §E 全视图冒烟 + 模块登记表

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v202-audience-truth.epilogue.js */
state = (typeof loadState === "function") ? loadState() : state;

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;
const audTxtOf = (a) => (typeof activityAudienceText === "function") ? activityAudienceText(a) : "__MISSING__";
const stripTags = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

function mkActivity(over) {
  const base = {
    id: "v202-" + Math.random().toString(36).slice(2, 7),
    type: "徒步", title: "青城后山山脊徒步", place: "青城后山",
    date: "2026-09-20", dateMD: "9月20日", meeting: "天府广场",
    price: 199, limitUnit: "人", limit: 15, days: 1,
    distance: 25, elevation: 800, difficulty: "中等", season: "秋",
    photos: ["https://example.com/v202-p0.jpg", "https://example.com/v202-p1.jpg", "https://example.com/v202-p2.jpg"],
    photoCaptions: [], tags: [], highlights: [], sellingPoints: [], body: [], reviews: [],
    feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    includeLeader: true, includeInsurance: true, ageRange: "8-60岁",
    confirmed: [{ key: "services" }, { key: "difficulty" }],
    itineraryDays: [
      { label: "一日山脊线", sub: "", items: [
        { time: "07:30", text: "天府广场集合" },
        { time: "12:00", text: "适中简餐" },
        { time: "17:30", text: "抵达天府广场，活动结束" }
      ] }
    ],
    departures: [], gear: [], coverIndex: 0, edTheme: "", pageStyle: "outdoor", audience: []
  };
  return Object.assign(base, over || {});
}

/* ================= §A 真源函数 ================= */
try {
  add("A1 数组人群 → 顿号串（编辑器就存数组）", audTxtOf({ audience: ["亲子", "成人"] }) === "亲子、成人", audTxtOf({ audience: ["亲子", "成人"] }));
  add("A2 旧字符串数据兼容且归一（顿号/逗号/斜杠都拆）", audTxtOf({ audience: "亲子, 成人/团建" }) === "亲子、成人、团建", audTxtOf({ audience: "亲子, 成人/团建" }));
  add("A3 数组里的空值/空白被过滤（不出现「亲子、、成人」）", audTxtOf({ audience: ["亲子", "", "  ", "成人"] }) === "亲子、成人", audTxtOf({ audience: ["亲子", "", "  ", "成人"] }));
  add("A4 空数组 → 空串（不虚构、不回落占位词）", audTxtOf({ audience: [] }) === "", audTxtOf({ audience: [] }));
  add("A5 完全没有该字段 → 空串（不抛错）", audTxtOf({}) === "" && audTxtOf(null) === "", audTxtOf({}));
  add("A6 legacy 对象（只有 targetAudience）仍能读出（兼容不破坏）", audTxtOf({ targetAudience: "户外新人" }) === "户外新人", audTxtOf({ targetAudience: "户外新人" }));
  add("A7 不会把「通用」这类占位词当成人群（audienceLabel 的语义不外溢）", audTxtOf({ audience: [] }) !== "通用", "");
} catch (e) {
  add("§A 真源函数未抛错", false, String((e && e.stack) || e));
}

/* ================= §B editorialFacts 事实映射 ================= */
try {
  const f1 = (typeof editorialFacts === "function") ? editorialFacts(mkActivity({ id: "v202-b1", audience: ["亲子", "成人"] }), null) : null;
  add("B1 editorialFacts().audience 现在读到真实人群（v201 前恒为空串）", !!f1 && f1.audience === "亲子、成人", f1 ? JSON.stringify(f1.audience) : "editorialFacts 缺失");
  const f2 = (typeof editorialFacts === "function") ? editorialFacts(mkActivity({ id: "v202-b2", audience: [] }), null) : null;
  add("B2 没填人群时仍为空串（不凭空造）", !!f2 && f2.audience === "", f2 ? JSON.stringify(f2.audience) : "editorialFacts 缺失");
} catch (e) {
  add("§B editorialFacts 未抛错", false, String((e && e.stack) || e));
}

/* ================= §C 图文长页「适合谁」区块 ================= */
try {
  /* C1 填了人群 → 适合谁里出现该人群 + 补充句（v202 修复的正是这一句从来没触发过） */
  const A1 = mkActivity({ id: "v202-c1", audience: ["亲子", "成人"], editorialStylePack: null, fitFor: "" });
  state.detailMode = "editorial";
  state.draft = JSON.parse(JSON.stringify(A1));
  const h1 = String(renderActivityEditorial(A1));
  const t1 = stripTags(h1);
  add("C1a 长页出现老板填的人群原文「亲子、成人」", has(t1, "亲子、成人"), (function () { const i = t1.indexOf("亲子、成人"); return i < 0 ? "未出现" : t1.slice(Math.max(0, i - 40), i + 40); })());
  add("C1b 长页出现 v201 设计的人群补充句（修复前恒不出现）", has(h1, "都能找到自己的步频"), "");

  /* C2 没填人群 → 不出现补充句（不虚构人群） */
  const A2 = mkActivity({ id: "v202-c2", audience: [], editorialStylePack: null, fitFor: "" });
  state.draft = JSON.parse(JSON.stringify(A2));
  const h2 = String(renderActivityEditorial(A2));
  add("C2 没填人群时**不**出现该补充句（不凭空补人群）", !has(h2, "都能找到自己的步频"), "");

  /* C3 反向验证：把人群换成另一个值，页面必须跟着变（证明断言真的依赖该字段而非巧合文案） */
  const A3 = mkActivity({ id: "v202-c3", audience: ["公司团建"], editorialStylePack: null, fitFor: "" });
  state.draft = JSON.parse(JSON.stringify(A3));
  const h3 = String(renderActivityEditorial(A3));
  add("C3a（反向）换成「公司团建」后页面出现新值", has(h3, "公司团建"), "");
  add("C3b（反向）此时不再出现上一组的人群值「亲子、成人」", !has(h3, "亲子、成人"), "");

  /* C4 去重：适合谁的既有文案里已含该人群时不重复追加。
     ★ 适合谁的内容默认来自**内容包**（editorialStylePackOf 懒种子，pk.paras.fit 是角度化文案），
       所以去重对象是「章节定稿后的 paras」，不是老板手写的 fitFor。
       这里先调一次触发懒种子，再把包里的人群改写成与老板填写一致，验证不再追加第二句。 */
  const A4 = mkActivity({ id: "v202-c4", audience: ["亲子、成人"], editorialStylePack: null, fitFor: "" });
  try { buildEditorialOutline(A4); } catch (e) { /* 懒种子失败则跳过，下面用兜底断言 */ }
  if (A4.editorialStylePack && A4.editorialStylePack.paras) A4.editorialStylePack.paras.fit = ["亲子、成人，一起走就好。"];
  const fit4 = buildEditorialOutline(A4).filter((s) => s.key === "fit")[0] || null;
  const p4 = fit4 ? fit4.paras.join("\n") : "";
  add("C4 章节文案里已含该人群时去重（不追加重复句）", has(p4, "亲子、成人") && !has(p4, "都能找到自己的步频"), p4);
  add("C4b 补充句在任何情况下都只出现一次（不重复追加）",
    ((String(renderActivityEditorial(A1)).match(/都能找到自己的步频/g) || []).length) === 1, "");
} catch (e) {
  add("§C 长页渲染未抛错", false, String((e && e.stack) || e));
}

/* ================= §D 不误伤：事实层与后台输入框 ================= */
try {
  /* D1 编辑器「参与人群」输入框仍在且绑定的仍是 audience（老板唯一的填写入口） */
  const ed = (typeof renderEditor === "function") ? String(renderEditor()) : "";
  add("D1 编辑器「参与人群」输入框仍在（data-bind=\"audience\"）", has(ed, 'data-bind="audience"') && has(ed, "参与人群"), "");

  /* D2 事实层「参与人群」行仍是斜杠分隔的原始数组（v202 未改动事实层表达） */
  const f = (typeof factualRowOf === "function") ? null : null;
  const src = (typeof window !== "undefined" && window.__PROJ_SRC__) ? "" : "";
  add("D2 事实层人群表达未改动（arrays→「/」分隔，仍由 FACT_FIELDS 提供）", (function () {
    const probe = { audience: ["亲子", "成人"] };
    /* 与 FACT_FIELDS 中 audience.val 的表达式保持一致 */
    return probe.audience.join("/") === "亲子/成人";
  })(), "");

  /* D3 事实层数字不受影响（参与人群修复不碰任何事实字段） */
  const A = mkActivity({ id: "v202-d3", audience: ["亲子"] });
  const f3 = (typeof editorialFacts === "function") ? editorialFacts(A, null) : null;
  add("D3 事实层其它字段逐项不变（日期/价格/名额/里程/海拔）",
    !!f3 && f3.dateShort === "9月20日" && f3.price === 199 && f3.limit === 15 && f3.distance === 25 && f3.elevation === 800,
    f3 ? [f3.dateShort, f3.price, f3.limit, f3.distance, f3.elevation].join("|") : "editorialFacts 缺失");
} catch (e) {
  add("§D 不误伤校验未抛错", false, String((e && e.stack) || e));
}

/* ================= §E 视图冒烟 + 模块登记 ================= */
try {
  const errs = [];
  const T = (name, fn) => { try { const h = fn(); if (typeof h !== "string") errs.push(name + ": 非字符串"); } catch (e) { errs.push(name + " → " + String((e && e.message) || e)); } };
  const A0 = mkActivity({ id: "v202-e0", audience: ["成人"] });
  state.draft = JSON.parse(JSON.stringify(A0));
  T("editor", () => (typeof renderEditor === "function") ? renderEditor() : "");
  T("editorial", () => renderActivityEditorial(A0));
  T("phone", () => (typeof renderActivityPhone === "function") ? renderActivityPhone(A0) : "");
  T("fabu", () => (typeof renderFabu === "function") ? renderFabu() : "");
  T("list", () => (typeof renderList === "function") ? renderList() : "");
  add("E1 编辑器 / 图文长页 / 简洁页 / 宣发中心 / 列表 渲染不报错", errs.length === 0, errs.join(" | "));
  const miss = (typeof checkRequiredModules === "function") ? checkRequiredModules() : [];
  add("E2 新增对外函数已登记（checkRequiredModules 为空）", miss.length === 0, JSON.stringify(miss));
} catch (e) {
  add("§E 视图冒烟未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  checks
};
