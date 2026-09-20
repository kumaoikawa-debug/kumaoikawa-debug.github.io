/* =======================================================================
 * contentV3Editor.js — Content Engine V3 编辑器（Phase 3：人工微调 PromoDocument）
 * -----------------------------------------------------------------------
 * 职责边界（严格遵守 V3 开发文本 §三 / §二十六）：
 *   ① 老板在后台对 AI 生成的 PromoDocument「人工微调」：改区块文案、调顺序、增删区块。
 *   ② 编辑器**绝不触动事实层**：价格取自 canonical（渲染器负责）、日期/地点/行程/费用
 *      由活动主记录驱动；这里的输入框只对应 block.copy 的文学性字段（headline/body/caption）。
 *   ③ 编辑在「草稿」(state._v3EditDraft) 上进行，只有点「保存修改」才写回
 *      a.v3Document.blocks 并打 _manuallyEdited 标记；取消则丢弃草稿，原文档不动。
 *   ④ 打 _manuallyEdited 后，contentV3DocOf 仍按原 truthKey 判定（事实没变），
 *      页面继续走 V3 轨道；但再点「V3 排版」重新生成会整体覆盖（老板知情）。
 *
 * 为什么用草稿而非直接改 a.v3Document：
 *   取消时若已直接改了 blocks，就无从回滚；草稿让「取消 = 丢弃」零成本，
 *   也避免 move/delete 的中间态污染已落库文档。
 * ======================================================================= */

/* 区块类型 → 中文标签（编辑器卡片标题用） */
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
  return `<button type="button" class="dms-chip" data-action="edV3Edit" title="人工微调 V3 排版（区块文案 / 顺序 / 增删）">${ICON("edit")} 编辑排版</button>`;
}

/* ----------------------------------------------------- 草稿（编辑工作区） */
/* 打开编辑器：把当前 blocks 深拷贝成草稿，记录正在编辑的活动 id。 */
function contentV3EditorBegin(a) {
  if (!a || !contentV3EditorEnabled(a)) return false;
  var doc = contentV3DocOf(a);
  if (!doc) return false;
  try { state._v3EditDraft = JSON.parse(JSON.stringify(doc.blocks || [])); }
  catch (e) { state._v3EditDraft = (doc.blocks || []).slice(); }
  state._v3EditId = a.id;
  if (typeof showView === "function") showView(state.view, state.params);
  else if (typeof refreshPreview === "function") refreshPreview();
  return true;
}

/* 把当前 DOM 里已输入的字段值收集回草稿（move/delete/add 前必调，防丢未保存文字） */
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

/* 单个区块卡片 HTML */
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
    + `<button type="button" class="mini danger" data-action="edV3Delete" data-v3-i="${i}" title="删除">✕</button>`
    + `</span></div>`
    + fields
    + `</div>`;
}

/* 编辑器面板 HTML（仅当 state._v3EditId === a.id 且有草稿时渲染） */
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
    + `<div class="v3-editor-cards">${cards}</div>`
    + `<div class="v3-editor-add">新增区块：<select data-v3-add>${addOpts}</select>`
    + `<button type="button" class="btn btn-sm" data-action="edV3Add">添加</button></div>`
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

function contentV3EditorMove(a, i, dir) {
  if (!state || !Array.isArray(state._v3EditDraft)) return;
  contentV3EditorCollect();
  var d = state._v3EditDraft;
  var j = dir < 0 ? i - 1 : i + 1;
  if (j < 0 || j >= d.length) return;
  var tmp = d[i]; d[i] = d[j]; d[j] = tmp;
  contentV3RegenPanel();
}

function contentV3EditorDelete(a, i) {
  if (!state || !Array.isArray(state._v3EditDraft)) return;
  contentV3EditorCollect();
  if (i < 0 || i >= state._v3EditDraft.length) return;
  state._v3EditDraft.splice(i, 1);
  contentV3RegenPanel();
}

function contentV3EditorAdd(a, type) {
  if (!state || !Array.isArray(state._v3EditDraft)) return;
  if (CONTENT_V3_BLOCK_TYPES.indexOf(type) < 0) return;
  contentV3EditorCollect();
  var nb = { type: type, copy: { headline: "", body: "" }, layout: { width: "normal" }, mediaRefs: [] };
  if (CONTENT_V3_EDITOR_MEDIA.indexOf(type) < 0) delete nb.mediaRefs;
  state._v3EditDraft.push(nb);
  contentV3RegenPanel();
}

/* 保存：草稿写回文档 + 打标记 + 落库；返回是否成功 */
function contentV3EditorSave(a) {
  if (!a || !state || !Array.isArray(state._v3EditDraft)) return false;
  contentV3EditorCollect();
  var doc = a.v3Document;
  if (!doc || !contentV3IsValidDoc(doc)) return false;
  doc.blocks = state._v3EditDraft;
  doc._manuallyEdited = true;
  if (typeof contentV3TruthKey === "function") a.v3TruthKey = contentV3TruthKey(a);
  state._v3EditId = null;
  state._v3EditDraft = null;
  try { if (typeof saveState === "function") saveState(); } catch (e) {}
  if (typeof toast === "function") toast("已保存 V3 人工微调");
  contentV3RegenPanel();
  return true;
}

/* 取消：丢弃草稿，原文档不动 */
function contentV3EditorClose() {
  if (!state) return;
  state._v3EditId = null;
  state._v3EditDraft = null;
  contentV3RegenPanel();
}
