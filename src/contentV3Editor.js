/* =======================================================================
 * contentV3Editor.js — Content Engine V3 编辑器（文档 §十二 / A2：Editor.js 块级编辑）
 * -----------------------------------------------------------------------
 * 职责边界（严格遵守 V3 开发文本 §三 / §十二 / §二十六）：
 *   ① 老板在后台对 AI 生成的 PromoDocument「人工微调」：改文字、换照片、调顺序、删块、
 *      单块 AI 改写、重新设计这一段。
 *   ② 编辑器**绝不触动事实层**：confirmedFacts 真源 / 费用真源 / 行程真源一律改不到 ——
 *      详细行程、费用、清单属于 Info Stack，根本不在 PromoDocument 的创意 Block 里。
 *   ③ Editor.js 只在「编辑宣传内容」模式加载（vendor/editorjs/editorjs.umd.js，固定版本），
 *      平时不进页面；加载失败自动退回下方卡片式编辑器，绝不因为第三方库挂掉而编辑不了。
 *   ④ Editor.js 的输出必须落回 ClubOS 自己的 PromoDocument Schema ——
 *      purpose / evidenceRefs / layout 一律沿用原块，不让 Editor.js 格式反向绑死业务。
 *   ⑤ 编辑在草稿上进行，只有「保存修改」才写回 a.v3Document.blocks。
 * ======================================================================= */

/* 区块类型 → 中文标签（卡片式编辑器与提示用） */
var CONTENT_V3_EDITOR_LABELS = {
  hero: "主视觉标题",
  lead: "导语",
  statement: "主张 / 论点",
  image: "单图",
  image_group: "组图",
  text_image: "图文并行",
  metric: "指标",
  quote: "金句",
  chapter_break: "章节分隔",
  gallery: "图廊",
  cta: "行动召唤"
};

/* 各类型的可编辑字段（与 contentV3Renderer.js 的 block 结构严格对应） */
var CONTENT_V3_EDITOR_HEAD = ["hero", "lead", "statement", "quote", "text_image", "chapter_break", "cta"];
var CONTENT_V3_EDITOR_BODY = ["lead", "statement", "quote", "text_image", "metric", "cta"];
var CONTENT_V3_EDITOR_CAP = ["image", "image_group", "gallery"];
var CONTENT_V3_EDITOR_MEDIA = ["image", "image_group", "gallery", "text_image"];

function contentV3BlockLabel(t) {
  return CONTENT_V3_EDITOR_LABELS[t] || String(t || "");
}

/* 编辑器是否可用：admin + 当前活动确有合法且未过期的 V3 文档 */
function contentV3EditorEnabled(a) {
  if (!a) return false;
  if (typeof isAdminMode === "function" && !isAdminMode()) return false;
  return (typeof contentV3DocOf === "function") ? !!contentV3DocOf(a) : false;
}

/* 「编辑排版」按钮（挂在 V3 徽标旁，仅 admin + 已用 V3 时显示） */
function contentV3EditorButton(a) {
  if (!contentV3EditorEnabled(a)) return "";
  if (typeof ICON !== "function") return "";
  return `<button type="button" class="dms-chip" data-action="edV3Edit" title="人工微调 V3 排版（改文字 / 换图 / 调序 / 删块 / 单块 AI 改写）">${ICON("edit")} 编辑排版</button>`;
}

/* =======================================================================
 * Editor.js 集成（文档 §十二）—— 仅在编辑模式按需加载
 * ======================================================================= */

var V3_EDITORJS_SRC = "vendor/editorjs/editorjs.umd.js?v=222";
var _v3EditorJsPromise = null;

/* 动态加载 vendor 里的 Editor.js（固定版本，不引不锁版本公共 CDN）。
   同一页面只加载一次；失败返回 null，上层退回卡片式编辑器。 */
function contentV3EditorJsLoad() {
  if (typeof window === "undefined" || !window || !window.document) return Promise.resolve(null);
  if (typeof window.EditorJS === "function") return Promise.resolve(window.EditorJS);
  if (_v3EditorJsPromise) return _v3EditorJsPromise;

  _v3EditorJsPromise = new Promise(function (resolve) {
    var s = document.createElement("script");
    s.src = V3_EDITORJS_SRC;
    s.async = true;
    s.onload = function () { resolve(typeof window.EditorJS === "function" ? window.EditorJS : null); };
    s.onerror = function () { resolve(null); };
    document.head.appendChild(s);
  });
  return _v3EditorJsPromise;
}

/* Editor.js 是否已接管编辑（是则 move/delete/add/save 走它的 API） */
function contentV3EditorJsActive() {
  return !!(state && state._v3EditorJs && typeof state._v3EditorJs.save === "function");
}

/* 销毁实例（取消 / 保存后调用，避免 DOM 残留与内存泄漏） */
function contentV3EditorJsDestroy() {
  try {
    if (state && state._v3EditorJs && typeof state._v3EditorJs.destroy === "function") state._v3EditorJs.destroy();
  } catch (e) { /* 销毁失败不影响主流程 */ }
  if (state) { state._v3EditorJs = null; }
}

/* 初始化 Editor.js：把草稿 blocks 映射成 Editor.js 数据交给 11 个 Club* Block Tool */
function contentV3EditorJsInit(a) {
  if (!a || typeof window === "undefined" || !window || !window.document) return Promise.resolve(false);
  if (typeof contentV3BlocksToEditorData !== "function") return Promise.resolve(false);
  var host = document.getElementById("v3EditorJsHost");
  if (!host) return Promise.resolve(false);

  return contentV3EditorJsLoad().then(function (EditorJS) {
    if (!EditorJS) return false;
    var draft = (state && Array.isArray(state._v3EditDraft)) ? state._v3EditDraft : [];
    try {
      contentV3EditorJsDestroy();
      var tools = contentV3EditorTools({
        /* 换图：从本活动照片里挑一张（A2「替换照片」） */
        onPickImage: function (cb) { return contentV3EditorPickPhoto(a, cb); }
      });
      delete tools.__config;
      state._v3EditorJs = new EditorJS({
        holder: host,
        tools: tools,
        data: { blocks: contentV3BlocksToEditorData(draft) },
        /* 文案编辑为主，不需要 Editor.js 自带的多余 UI 噪音 */
        autofocus: false,
        placeholder: "在这里改文案；顶部工具条可新增区块"
      });
      return true;
    } catch (e) {
      return false;
    }
  });
}

/* 换图：从活动照片里挑一张（找不到照片列表时诚实返回 null，不伪造图片） */
function contentV3EditorPickPhoto(a, cb) {
  var photos = (a && Array.isArray(a.photos)) ? a.photos : [];
  var ids = photos.map(function (p, i) {
    return (p && (p.id || p.src)) ? String(p.id || p.src) : "";
  }).filter(Boolean);
  if (!ids.length) {
    if (typeof toast === "function") toast("本活动还没有照片，先在「照片」里上传");
    if (typeof cb === "function") cb(null);
    return null;
  }
  var picked = window.prompt("输入要换成的图片 id：\n可选：" + ids.join("、"), ids[0]);
  var ok = ids.indexOf(String(picked || "")) >= 0 ? String(picked) : null;
  if (typeof cb === "function") cb(ok);
  return ok;
}

/* 从 Editor.js 取回并映射成 PromoDocument.blocks（null = 未接管 / 失败） */
function contentV3EditorJsCollect() {
  if (!contentV3EditorJsActive()) return null;
  if (typeof contentV3EditorDataToBlocks !== "function") return null;
  return state._v3EditorJs.save().then(function (saved) {
    var orig = (state && Array.isArray(state._v3EditOriginalBlocks)) ? state._v3EditOriginalBlocks : [];
    return contentV3EditorDataToBlocks(orig, (saved && saved.blocks) || []);
  }).catch(function () { return null; });
}

/* =======================================================================
 * 草稿（编辑工作区）
 * ======================================================================= */

/* 打开编辑器：把当前 blocks 深拷贝成草稿，记录正在编辑的活动 id。 */
function contentV3EditorBegin(a) {
  if (!a || !contentV3EditorEnabled(a)) return false;
  var doc = contentV3DocOf(a);
  if (!doc) return false;
  try { state._v3EditDraft = JSON.parse(JSON.stringify(doc.blocks || [])); }
  catch (e) { state._v3EditDraft = (doc.blocks || []).slice(); }
  /* 原始块留一份：Editor.js 回写时用它还原 purpose / evidenceRefs / layout */
  try { state._v3EditOriginalBlocks = JSON.parse(JSON.stringify(doc.blocks || [])); }
  catch (e) { state._v3EditOriginalBlocks = (doc.blocks || []).slice(); }
  state._v3EditId = a.id;
  contentV3RegenPanel();
  /* 面板渲染完再挂 Editor.js（它在自己的 holder 里接管编辑） */
  if (typeof window !== "undefined" && window.setTimeout) {
    window.setTimeout(function () { contentV3EditorJsInit(a); }, 0);
  }
  return true;
}

/* 把当前 DOM 里已输入的字段值收集回草稿（卡片式编辑器用；move/delete/add 前必调） */
function contentV3EditorCollect() {
  var draft = state && state._v3EditDraft;
  if (!Array.isArray(draft)) return draft;
  if (typeof document === "undefined" || !document || !document.querySelectorAll) return draft;
  var inputs = document.querySelectorAll("[data-v3-field]");
  for (var k = 0; k < inputs.length; k++) {
    var inp = inputs[k];
    var i = Number(inp.getAttribute("data-v3-i"));
    var f = inp.getAttribute("data-v3-field");
    if (!isFinite(i) || i < 0 || i >= draft.length || !f) continue;
    var b = draft[i];
    if (!b) continue;
    var val = (typeof inp.value === "string") ? inp.value : "";
    if (f === "mediaRefs") {
      b.mediaRefs = val.split(/[\s,，、;；]+/).map(function (s) { return s.trim(); }).filter(Boolean);
    } else {
      if (!b.copy || typeof b.copy !== "object") b.copy = {};
      b.copy[f] = val;
    }
  }
  return draft;
}

/* 单个区块卡片 HTML（Editor.js 不可用时的兜底编辑器） */
function contentV3EditorCard(b, i, n) {
  if (!b || typeof b !== "object") return "";
  var t = b.type;
  var c = b.copy || {};
  var hasHead = CONTENT_V3_EDITOR_HEAD.indexOf(t) >= 0;
  var hasBody = CONTENT_V3_EDITOR_BODY.indexOf(t) >= 0;
  var hasCap = CONTENT_V3_EDITOR_CAP.indexOf(t) >= 0;
  var hasMedia = CONTENT_V3_EDITOR_MEDIA.indexOf(t) >= 0;

  var fields = "";
  if (hasHead) {
    fields += `<label class="v3-ef"><span>标题</span>`
      + `<input type="text" data-v3-i="${i}" data-v3-field="headline" value="${esc(c.headline || "")}"></label>`;
  }
  if (hasBody) {
    fields += `<label class="v3-ef"><span>正文</span>`
      + `<textarea data-v3-i="${i}" data-v3-field="body">${esc(c.body || "")}</textarea></label>`;
  }
  if (hasCap) {
    fields += `<label class="v3-ef"><span>图注</span>`
      + `<input type="text" data-v3-i="${i}" data-v3-field="caption" value="${esc(c.caption || "")}"></label>`;
  }
  if (hasMedia) {
    fields += `<label class="v3-ef"><span>配图引用（空格分隔，如 p0 p2）</span>`
      + `<input type="text" data-v3-i="${i}" data-v3-field="mediaRefs" value="${esc((b.mediaRefs || []).join(" "))}"></label>`;
  }
  if (!fields) fields = `<div class="v3-ef-none">本区块无可编辑文案（仅由 AI 结构与素材驱动）</div>`;

  var upDis = i === 0 ? " disabled" : "";
  var downDis = i === n - 1 ? " disabled" : "";
  return `<div class="v3-edit-card" data-v3-card="${i}">`
    + `<div class="v3-edit-card-h"><span class="v3-edit-type">${esc(contentV3BlockLabel(t))}</span>`
    + `<span class="v3-edit-ops">`
    + `<button type="button" class="mini" data-action="edV3MoveUp" data-v3-i="${i}"${upDis} title="上移">↑</button>`
    + `<button type="button" class="mini" data-action="edV3MoveDown" data-v3-i="${i}"${downDis} title="下移">↓</button>`
    + `<button type="button" class="mini" data-action="edV3AiRewrite" data-v3-i="${i}" title="单块 AI 改写">AI</button>`
    + `<button type="button" class="mini danger" data-action="edV3Delete" data-v3-i="${i}" title="删除">✕</button>`
    + `</span></div>`
    + fields
    + `</div>`;
}

/* 编辑器面板 HTML（仅当 state._v3EditId === a.id 且有草稿时渲染）
   ★ Editor.js 的 holder 与卡片兜底共存：Editor.js 加载成功会接管 holder，
     失败或不支持时卡片编辑器照常可用 —— 第三方库挂掉不该等于「编辑不了」。 */
function contentV3EditorPanel(a) {
  if (!a) return "";
  if (!state || state._v3EditId !== a.id) return "";
  var draft = state._v3EditDraft;
  if (!Array.isArray(draft) || !draft.length) return "";
  var cards = "";
  for (var i = 0; i < draft.length; i++) cards += contentV3EditorCard(draft[i], i, draft.length);
  var addOpts = "";
  for (var j = 0; j < CONTENT_V3_BLOCK_TYPES.length; j++) {
    addOpts += `<option value="${CONTENT_V3_BLOCK_TYPES[j]}">${esc(contentV3BlockLabel(CONTENT_V3_BLOCK_TYPES[j]))}</option>`;
  }
  return `<div class="v3-editor" id="v3-editor">`
    + `<div class="v3-editor-h">人工微调 V3 排版`
    + `<span class="v3-editor-hint">只改文案 / 顺序 / 增删，不改动事实与报价</span></div>`
    + `<div class="v3-editorjs-host" id="v3EditorJsHost"></div>`
    + `<div class="v3-editor-cards" id="v3EditorCards">${cards}</div>`
    + `<div class="v3-editor-add">新增区块：<select data-v3-add>${addOpts}</select>`
    + `<button type="button" class="btn btn-sm" data-action="edV3Add">添加</button>`
    + `<button type="button" class="btn btn-sm" data-action="edV3Redesign" title="重新设计这一段（换一种呈现）">重新设计</button>`
    + `</div>`
    + `<div class="v3-editor-actions">`
    + `<button type="button" class="btn btn-primary" data-action="edV3Save">保存修改</button>`
    + `<button type="button" class="btn" data-action="edV3Close">取消</button>`
    + `</div></div>`;
}

/* ----------------------------------------------------- 变更（mutate 草稿） */
function contentV3RegenPanel() {
  if (typeof showView === "function") showView(state.view, state.params);
  else if (typeof refreshPreview === "function") refreshPreview();
}

/* Editor.js 接管时用它的 API 调序，无需重渲染整页 */
function contentV3EditorMove(a, i, dir) {
  if (contentV3EditorJsActive()) {
    try {
      var to = dir < 0 ? i - 1 : i + 1;
      if (to < 0) return;
      state._v3EditorJs.blocks.move(i, to);
      return;
    } catch (e) { /* 失败则退回草稿模式 */ }
  }
  if (!state || !Array.isArray(state._v3EditDraft)) return;
  contentV3EditorCollect();
  var d = state._v3EditDraft;
  var j = dir < 0 ? i - 1 : i + 1;
  if (j < 0 || j >= d.length) return;
  var tmp = d[i]; d[i] = d[j]; d[j] = tmp;
  contentV3RegenPanel();
}

function contentV3EditorDelete(a, i) {
  if (contentV3EditorJsActive()) {
    try { state._v3EditorJs.blocks.delete(i); return; } catch (e) {}
  }
  if (!state || !Array.isArray(state._v3EditDraft)) return;
  contentV3EditorCollect();
  if (i < 0 || i >= state._v3EditDraft.length) return;
  state._v3EditDraft.splice(i, 1);
  contentV3RegenPanel();
}

/* 新增区块：Editor.js 模式下插入对应 Club* Tool */
function contentV3EditorAdd(a, type) {
  if (CONTENT_V3_BLOCK_TYPES.indexOf(type) < 0) return;
  if (contentV3EditorJsActive()) {
    try {
      var tool = contentV3EditorToolNameOf(type);
      if (tool) {
        state._v3EditorJs.blocks.insert(tool, { headline: "", body: "", caption: "", media: [] });
        return;
      }
    } catch (e) {}
  }
  if (!state || !Array.isArray(state._v3EditDraft)) return;
  contentV3EditorCollect();
  var nb = { type: type, copy: { headline: "", body: "" }, layout: { width: "normal" }, mediaRefs: [] };
  if (CONTENT_V3_EDITOR_MEDIA.indexOf(type) < 0) delete nb.mediaRefs;
  state._v3EditDraft.push(nb);
  contentV3RegenPanel();
}

/* PromoDocument block type → Editor.js Tool 名（Club* 那 11 个） */
function contentV3EditorToolNameOf(type) {
  if (typeof V3_EDITOR_TOOL_SPECS === "undefined") return null;
  for (var i = 0; i < V3_EDITOR_TOOL_SPECS.length; i++) {
    if (V3_EDITOR_TOOL_SPECS[i].type === type) return V3_EDITOR_TOOL_SPECS[i].name;
  }
  return null;
}

/* ----------------------------------------------------- AI 动作（§十二） */

/* 单块 AI 改写 / 重新设计：走后端 §十八 的编辑器端点。
   ★ 需要后端已保存的文档 id；本地草稿没落库时诚实告知，不假装改写成功。 */
function contentV3EditorAiCall(a, i, kind) {
  if (typeof contentV3ApiBase !== "function") return Promise.resolve(false);
  var base = contentV3ApiBase();
  if (!base) return Promise.resolve(false);
  var path = kind === "redesign" ? "regenerate-layout" : "rewrite-block";
  return (async function () {
    /* v222：后端的 :id 现在会随生成结果回传（a.v3DocId）；存量活动没有存过，
       用 activityId 反查补齐 —— 否则这里的改写 / 重新设计永远走不到后端。 */
    var docId = (typeof contentV3EnsureDocId === "function") ? await contentV3EnsureDocId(a) : null;
    if (!docId) {
      if (typeof toast === "function") toast("该文档还没存到后端，单块 AI 改写需要后端生成的文档");
      return false;
    }
    try {
      var auth = (typeof contentV3AuthHeader === "function") ? await contentV3AuthHeader() : null;
      if (!auth) return false;
      var body = kind === "redesign"
        ? { mode: "airy" }
        : { blockId: (state._v3EditDraft && state._v3EditDraft[i]) ? state._v3EditDraft[i].id : "" };
      if (kind !== "redesign" && !body.blockId) return false;
      var resp = await fetch(base + "/" + encodeURIComponent(docId) + "/" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: auth },
        body: JSON.stringify(body)
      });
      if (!resp.ok) return false;
      var json = await resp.json();
      var doc = json && (json.data || json.result);
      if (!doc) return false;
      /* 后端返回的是完整 PromoDocument —— 直接覆盖草稿并刷新面板 */
      var blocks = (doc.document && doc.document.blocks) || doc.blocks || null;
      if (!Array.isArray(blocks)) return false;
      state._v3EditDraft = blocks;
      try { state._v3EditOriginalBlocks = JSON.parse(JSON.stringify(blocks)); } catch (e) { state._v3EditOriginalBlocks = blocks.slice(); }
      contentV3EditorJsDestroy();
      contentV3RegenPanel();
      if (typeof window !== "undefined" && window.setTimeout) {
        window.setTimeout(function () { contentV3EditorJsInit(a); }, 0);
      }
      if (typeof toast === "function") toast(kind === "redesign" ? "已重新设计这一段" : "已改写该区块");
      return true;
    } catch (e) { return false; }
  })();
}

function contentV3EditorAiRewrite(a, i) { return contentV3EditorAiCall(a, i, "rewrite"); }
function contentV3EditorRedesign(a, i) { return contentV3EditorAiCall(a, i, "redesign"); }

/* ----------------------------------------------------- 保存 / 取消 */

/* 保存：草稿写回文档 + 打标记 + 落库；返回是否成功 */
function contentV3EditorSave(a) {
  if (!a || !state || !Array.isArray(state._v3EditDraft)) return false;
  var doc = a.v3Document;
  if (!doc || !contentV3IsValidDoc(doc)) return false;

  var finish = function (blocks) {
    if (Array.isArray(blocks) && blocks.length) doc.blocks = blocks;
    doc._manuallyEdited = true;
    if (typeof contentV3TruthKey === "function") a.v3TruthKey = contentV3TruthKey(a);
    state._v3EditId = null;
    state._v3EditDraft = null;
    state._v3EditOriginalBlocks = null;
    contentV3EditorJsDestroy();
    try { if (typeof saveState === "function") saveState(); } catch (e) {}
    if (typeof toast === "function") toast("已保存 V3 人工微调");
    contentV3RegenPanel();
  };

  /* Editor.js 接管时：先取它的输出，再映射回 PromoDocument Schema */
  var collected = contentV3EditorJsCollect();
  if (collected && typeof collected.then === "function") {
    return collected.then(function (blocks) {
      finish(blocks || state._v3EditDraft);
      return true;
    }).catch(function () {
      contentV3EditorCollect();
      finish(state._v3EditDraft);
      return true;
    });
  }
  contentV3EditorCollect();
  finish(state._v3EditDraft);
  return true;
}

/* 取消：丢弃草稿，原文档不动 */
function contentV3EditorClose() {
  if (!state) return;
  state._v3EditId = null;
  state._v3EditDraft = null;
  state._v3EditOriginalBlocks = null;
  contentV3EditorJsDestroy();
  contentV3RegenPanel();
}
