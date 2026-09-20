/* =======================================================================
 * contentV3.js — Content Engine V3 前端「数据层」（Phase 2 / 任务 H）
 * -----------------------------------------------------------------------
 * 职责边界（严格遵守 V3 开发文本 §七 / §二十六）：
 *   ① 只负责三件事：向后端取 PromoDocument、校验它、把它挂到活动上落库；
 *   ② 本文件**不生产任何文案**，也不改写 blocks —— 渲染全部交给
 *      contentV3Renderer.js，那里同样禁止自创采购/促销话术；
 *   ③ 后端未配置 / 不可达 / 未鉴权 / 出参不合法时，一律返回 null，
 *      页面自动回退 legacy 轨道（双轨：见 activities.js renderActivityEditorial）。
 *
 * 为什么要有「事实漂移保护」（v3TruthKey）：
 *   老板反馈的线上事故是「方案抽出来的事实没进页面」。反过来同样致命 ——
 *   事实被改过之后却还在渲染上一次生成的旧文档。所以文档挂 activity 时同步记一把
 *   关键事实指纹，指纹不一致就判定旧文档过期（视同没有），强制重走 legacy 或重新生成。
 * ======================================================================= */

/* 合法 Block 类型 —— 必须与后端 contracts/promoDocument.ts CONTENT_BLOCK_TYPES 完全一致。
   AI 只能使用有限的合法 Block，绝不能发明新类型。 */
var CONTENT_V3_BLOCK_TYPES = [
  "hero", "lead", "statement", "image", "image_group",
  "text_image", "metric", "quote", "chapter_break", "gallery", "cta"
];

/* ---------------------------------------------------------------- 可用性 */
/* 后端根地址（复用 core.js 既有单一约定，不另起炉灶）→ /api/content */
function contentV3ApiBase() {
  try {
    if (typeof getBackendURL !== "function") return "";
    var base = getBackendURL();
    if (!base) return "";
    return base + "/api/content";
  } catch (e) { return ""; }
}

/* 是否具备 V3 生成条件（有后端地址即可；鉴权在真正调用时处理） */
function contentV3Available() { return !!contentV3ApiBase(); }

/* ---------------------------------------------------------------- 校验 */
function contentV3IsValidBlock(b) {
  if (!b || typeof b !== "object") return false;
  var t = b.type;
  return (typeof t === "string") && (CONTENT_V3_BLOCK_TYPES.indexOf(t) >= 0);
}

/* PromoDocument 结构合法性：schemaVersion=3 且至少 1 个合法 Block */
function contentV3IsValidDoc(doc) {
  if (!doc || typeof doc !== "object") return false;
  if (Number(doc.schemaVersion) !== 3) return false;
  if (!Array.isArray(doc.blocks) || !doc.blocks.length) return false;
  for (var i = 0; i < doc.blocks.length; i++) {
    if (contentV3IsValidBlock(doc.blocks[i])) return true;
  }
  return false;
}

function contentV3HasBlock(doc, type) {
  if (!contentV3IsValidDoc(doc)) return false;
  for (var i = 0; i < doc.blocks.length; i++) {
    if (doc.blocks[i] && doc.blocks[i].type === type) return true;
  }
  return false;
}

/* 取某个类型的第一个 Block（渲染层用它把 hero 交给页面页头承担） */
function contentV3FirstBlock(doc, type) {
  if (!contentV3IsValidDoc(doc)) return null;
  for (var i = 0; i < doc.blocks.length; i++) {
    if (doc.blocks[i] && doc.blocks[i].type === type) return doc.blocks[i];
  }
  return null;
}

/* ------------------------------------------------- 事实漂移保护（ goggles ） */
/* 日期信号：把「2026-10-01 / 2026年10月1日 / 10月1日」三种写法归一到同一个 月-日 指纹。
   ★ 这不是过度设计：renderActivityEditorial 内部（syncDepartures）会把 a.date 覆写成 dateMD，
     同一场活动在「挂文档时」与「渲染时」的日期字符串天然不同。若直接拿裸字符串进指纹，
     文档会被误判「事实漂移」而丢弃 —— 页面永远落回 legacy，看起来像 V3 没生效。
     真正的日期变化（10月1日 → 10月2日）依然能被识别出来。 */
function contentV3DateSig(s) {
  var t = String(s == null ? "" : s);
  var m = t.match(/(\d{4})[-\/年](\d{1,2})[-\/月](\d{1,2})/);
  if (m) return Number(m[2]) + "-" + Number(m[3]);
  var m2 = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/);
  if (m2) return Number(m2[1]) + "-" + Number(m2[2]);
  return t.replace(/[^\d]/g, "");
}

/* 关键事实指纹：这些字段任一变化，旧 V3 文档不再可信。
   只取「决定是否 communicated truth」的字段，不含文风/版本号等无关项。 */
function contentV3TruthKey(a) {
  if (!a) return "";
  var days = (a.itineraryDays || []).length || 0;
  var fee = (a.feeInclude || []).length || 0;
  return [
    contentV3DateSig(a.date || a.dateMD),
    String(a.place || ""),
    String(a.price == null ? "" : a.price),
    String(a.days || ""),
    String(a.meeting || ""),
    "d" + days,
    "f" + fee,
    "p" + ((a.photos || []).length || 0)
  ].join("|");
}

/* 当前可用来渲染的 V3 文档；没有 / 不合法 / 已过期 → null（回退 legacy） */
function contentV3DocOf(a) {
  if (!a) return null;
  var doc = a.v3Document;
  if (!contentV3IsValidDoc(doc)) return null;
  if (a.v3TruthKey && a.v3TruthKey !== contentV3TruthKey(a)) return null;
  return doc;
}

/* ---------------------------------------------------------------- 请求体 */
/* 活动主记录：只送「事实类」字段，不送任何现成推广文案字段
   （whyGo / experience / gain 属历史 AI 文学层，V3 不接受它们作为事实来源）。 */
function contentV3ActivityPayload(a) {
  if (!a) return {};
  return {
    title: a.title || "",
    type: a.type || "",
    date: a.date || a.dateMD || "",
    dateMD: a.dateMD || "",
    place: a.place || "",
    meeting: a.meeting || "",
    price: a.price == null ? "" : a.price,
    days: a.days || "",
    limit: a.limit || "",
    limitUnit: a.limitUnit || "",
    difficulty: a.difficulty || "",
    distance: a.distance || "",
    elevation: a.elevation || "",
    itineraryDays: a.itineraryDays || [],
    feeInclude: a.feeInclude || [],
    feeExclude: a.feeExclude || []
  };
}

/* 方案抽取事实（最高优先来源）—— 取活动上持久化的 _planFields，
   date / price 先过 v215 占位符闸门，避免「10月xx日」这类占位泄漏到 V3 事实层。 */
function contentV3PlanFactsPayload(a) {
  var out = {};
  var pf = (a && a._planFields) || null;
  if (!pf || typeof pf !== "object") return out;
  var keys = ["date", "place", "route", "price", "limit", "meeting", "days", "distance", "elevation", "difficulty"];
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    var v = pf[k];
    if (v === undefined || v === null || String(v).trim() === "") continue;
    if ((k === "date") && typeof factPlaceholderReject === "function") {
      v = factPlaceholderReject(String(v), "date");
      if (!v) continue;
    }
    if ((k === "price") && typeof factPlaceholderReject === "function") {
      v = factPlaceholderReject(String(v), "price");
      if (!v) continue;
    }
    out[k] = v;
  }
  if (Array.isArray(pf.feeInclude) && pf.feeInclude.length) out.feeInclude = pf.feeInclude.slice(0, 20);
  if (Array.isArray(pf.feeExclude) && pf.feeExclude.length) out.feeExclude = pf.feeExclude.slice(0, 20);
  return out;
}

/* 素材：与后端 VisionResult 侧 mediaRefs 对齐，id 用 p{下标}（0 基） */
function contentV3PhotoPayload(a) {
  var photos = (a && a.photos) || [];
  var out = [];
  for (var i = 0; i < photos.length && i < 60; i++) {
    var src = photos[i];
    if (!src) continue;
    out.push({ id: "p" + i, src: String(src) });
  }
  return out;
}

/* ---------------------------------------------------------------- 取 / 存 */
/* 取 JWT —— 复用 core.js ensureBackendToken()，不自己实现鉴权 */
async function contentV3AuthHeader() {
  try {
    if (typeof ensureBackendToken !== "function") return null;
    var token = await ensureBackendToken();
    return token ? ("Bearer " + token) : null;
  } catch (e) { return null; }
}

/* 生成 V3 PromoDocument。
   返回 null 表示「这次没拿到合法文档」（调用方应保持 legacy 轨道）。 */
async function contentV3Generate(a, opts) {
  opts = opts || {};
  if (!a) return null;
  var base = contentV3ApiBase();
  if (!base) return null;

  var auth = await contentV3AuthHeader();
  if (!auth) return null;

  var body = {
    activityId: String(a.id || opts.activityId || ""),
    activity: contentV3ActivityPayload(a),
    planFacts: contentV3PlanFactsPayload(a),
    photos: contentV3PhotoPayload(a)
  };
  if (!body.activityId) return null;
  /* 方案原文片段只作「接地素材」送过去（限制条数，别把整份 PPT 塞进请求） */
  var mt = [];
  var txt = (a && a._planText) ? String(a._planText) : "";
  if (txt) mt.push(txt.slice(0, 4000));
  if (Array.isArray(a && a.photoCaptions)) {
    for (var i = 0; i < a.photoCaptions.length && mt.length < 40; i++) {
      var c = a.photoCaptions[i];
      if (c && String(c).trim()) mt.push(String(c).trim().slice(0, 200));
    }
  }
  if (mt.length) body.materialText = mt;

  var json = function (res) { return res.json ? res.json().catch(function () { return {}; }) : Promise.resolve({}); };
  try {
    let res = await fetch(base + "/detail/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify(body)
    });
    // 401：JWT 过期 —— 清缓存重取一次（与 clubLLMviaBackend 同一套姿势）
    if (res && res.status === 401 && typeof clearBackendToken === "function") {
      clearBackendToken();
      auth = await contentV3AuthHeader();
      if (!auth) return null;
      res = await fetch(base + "/detail/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": auth },
        body: JSON.stringify(body)
      });
    }
    if (!res || !res.ok) return null;
    var d = await json(res);
    var doc = d && d.data && (d.data.document || d.data);
    if (!contentV3IsValidDoc(doc)) return null;
    return doc;
  } catch (e) {
    return null;
  }
}

/* 挂到活动并落库（同时记下事实指纹）
   ★ v222：后端现回传落库后的文档 id —— 必须存下来，否则 §十八 单块 AI 改写 / 重新设计
   （POST /:id/rewrite-block、/:id/regenerate-layout）与 §二十四 发布埋点（POST /:id/publish）
   全都拿不到 :id，按钮点了只会弹「该文档还没存到后端」/ 指标永远 0。 */
function contentV3Attach(a, doc) {
  if (!a || !contentV3IsValidDoc(doc)) return false;
  a.v3Document = doc;
  if (doc && doc.id != null && String(doc.id) !== "") a.v3DocId = String(doc.id);
  a.v3TruthKey = contentV3TruthKey(a);
  try { if (typeof saveState === "function") saveState(); } catch (e) {}
  return true;
}

/* 摘掉 V3 文档 → 立刻回退 legacy 轨道（给「回到旧版排」留的出口） */
function contentV3Detach(a) {
  if (!a) return false;
  try { delete a.v3Document; delete a.v3TruthKey; delete a.v3DocId; } catch (e) { a.v3Document = null; a.v3TruthKey = null; a.v3DocId = null; }
  try { if (typeof saveState === "function") saveState(); } catch (e) {}
  return true;
}

/* 历史活动（v222 之前生成的）本地没存后端文档 id —— 用 activityId 反查补齐。
   不补这一步，「标记已发布 / 单块 AI 改写 / 重新设计」对存量活动永远是死的。 */
async function contentV3EnsureDocId(a) {
  if (!a) return null;
  if (a.v3DocId) return a.v3DocId;
  if (a.v3Document && a.v3Document.id != null && String(a.v3Document.id) !== "") {
    a.v3DocId = String(a.v3Document.id);
    return a.v3DocId;
  }
  var base = (typeof contentV3ApiBase === "function") ? contentV3ApiBase() : "";
  if (!base) return null;
  var auth = (typeof contentV3AuthHeader === "function") ? await contentV3AuthHeader() : null;
  if (!auth) return null;
  try {
    var res = await fetch(base + "/activity/" + encodeURIComponent(String(a.id)) + "?scenario=detail", {
      headers: { Authorization: auth }
    });
    if (!res || !res.ok) return null;
    var j = await res.json();
    var id = j && j.data && j.data.id;
    if (id) {
      a.v3DocId = String(id);
      try { if (typeof saveState === "function") saveState(); } catch (e) {}
      return a.v3DocId;
    }
  } catch (e) { /* 取不到就保持 null，调用方给提示 */ }
  return null;
}

/* §二十四 发布埋点：告诉后端「这份内容已对外发布」，写入 publishedAt。
   它是 Direct Publish Rate 与 Time-to-Publish 的唯一时间基准点 —— 不埋这个点，
   两个指标恒为 0（线上核验已证实：published=0 / sample=0）。 */
/* 按文档 id 直接发布（渠道文档用：它们各自有 id，不挂在 a.v3DocId 上） */
async function contentV3PublishDoc(docId) {
  if (!docId) return false;
  var base = (typeof contentV3ApiBase === "function") ? contentV3ApiBase() : "";
  if (!base) return false;
  var auth = (typeof contentV3AuthHeader === "function") ? await contentV3AuthHeader() : null;
  if (!auth) return false;
  try {
    var res = await fetch(base + "/" + encodeURIComponent(String(docId)) + "/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({})
    });
    return !!(res && res.ok);
  } catch (e) {
    return false;
  }
}

async function contentV3Publish(a) {
  if (!a) return false;
  var docId = (typeof contentV3EnsureDocId === "function") ? await contentV3EnsureDocId(a) : null;
  if (!docId) return false;
  return contentV3PublishDoc(docId);
}

/* 渠道文档发布：scenario = wechat | xiaohongshu | recap */
async function contentV3PublishChannel(a, scenario) {
  if (!a) return false;
  var ids = a.v3ChannelDocIds || {};
  var docId = ids[scenario];
  if (!docId) return false;
  return contentV3PublishDoc(docId);
}

/* 渠道 key（运营任务卡片用的 ch）→ V3 scenario。非 V3 渠道返回 null。 */
function contentV3ScenarioOfChannel(ch) {
  var k = String(ch || "").toLowerCase();
  if (k === "wechat" || k === "gzh") return "wechat";
  if (k === "xhs" || k === "xiaohongshu" || k === "red") return "xiaohongshu";
  if (k === "recap" || k === "review") return "recap";
  return null;
}

/* ---------------------------------------------------------------- UI 辅助 */
/* 「生成 V3 / 已用 V3」小徽标 —— 只是状态提示，不含任何营销话术 */
function contentV3Badge(a) {
  if (typeof ICON !== "function") return "";
  var live = !!contentV3DocOf(a);
  if (live) {
    var editBtn = (typeof contentV3EditorButton === "function") ? contentV3EditorButton(a) : "";
    /* 发布埋点（§二十四）：id 在点击时补齐（contentV3EnsureDocId），
       故按钮始终给 —— 存量活动也能标记，取不到 id 时给明确提示而不是静默消失。 */
    var pubBtn = `<button type="button" class="dms-chip" data-action="edV3Publish" title="标记这份内容已对外发布 —— 作为「直发率 / 发布耗时」两个质量指标的时间基准">${ICON("check")} 标记已发布</button>`;
    return `<span class="dms-cur v3-badge on" title="本页正在按 Content Engine V3 动态 block 序列渲染">${ICON("sparkles")} V3 已完成</span>` + editBtn + pubBtn;
  }
  if (!contentV3Available()) return "";
  return `<button type="button" class="dms-chip" data-action="edV3Generate" title="用 Content Engine V3 重新排版（由后端受控管线生成动态排版）">${ICON("sparkles")} V3 排版</button>`;
}
