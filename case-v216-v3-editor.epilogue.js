/* case-v216-v3-editor.epilogue.js
   Content Engine V3 —— Phase 3 编辑器（人工微调 PromoDocument）契约。

   覆盖（按 V3 开发文本 §三 / §二十六）：
     · 编辑器只在「草稿」上改，保存才写回 a.v3Document.blocks 并打 _manuallyEdited；
     · 可改字段严格对应 block.copy 文学字段（headline/body/caption）+ mediaRefs，
       绝不触碰事实层（价格/日期/地点/行程/费用仍由 canonical 驱动）；
     · 区块可上移 / 下移 / 删除 / 新增；新增区块按类型决定是否带 mediaRefs；
     · 面板输入用 data-v3-field / data-v3-i 标记，collect 能回填草稿。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v216-v3-editor.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;

/* ============ 夹具 ============ */
function mkBlocks() {
  return [
    { type: "hero", copy: { headline: "赵公山一日", body: "山脊的早晨" }, layout: { width: "normal" } },
    { type: "lead", copy: { headline: "关于这次", body: "我们走完一整条山脊线。" }, layout: { width: "normal" } },
    { type: "image", copy: { caption: "山脊" }, mediaRefs: ["p0", "p2"], layout: { width: "wide" } },
    { type: "cta", copy: { headline: "一起出发", body: "现在就报名。" }, layout: { width: "normal" } }
  ];
}
function mkActivity() {
  const a = {
    id: "v3ed-" + Math.random().toString(36).slice(2, 6),
    type: "徒步", title: "赵公山徒步", place: "都江堰赵公山",
    date: "2026-10-01", dateMD: "10月1日", meeting: "天府广场地铁站A口",
    price: 168, limitUnit: "人", limit: 25, days: 1,
    photos: ["https://example.com/p0.jpg", "https://example.com/p1.jpg", "https://example.com/p2.jpg", "https://example.com/p3.jpg"],
    itineraryDays: [{ label: "一日线", items: [{ time: "07:30", text: "集合" }] }],
    feeInclude: ["往返车费"], feeExclude: ["午餐"]
  };
  a.v3Document = { schemaVersion: 3, direction: { styleVector: { textDensity: 0.4 } }, blocks: mkBlocks() };
  a.v3TruthKey = (typeof contentV3TruthKey === "function") ? contentV3TruthKey(a) : "";
  return a;
}

/* ============ 1. 文档合法性与双轨可见 ============ */
const a = mkActivity();
add("v3 文档被 contentV3DocOf 认可（未过期）", (typeof contentV3DocOf === "function") && contentV3DocOf(a) === a.v3Document, "truthKey=" + a.v3TruthKey);
add("编辑器函数均已加载", (typeof contentV3EditorPanel === "function") && (typeof contentV3EditorSave === "function") && (typeof contentV3EditorMove === "function"));

/* ============ 2. 面板结构（字段与动作齐全） ============ */
state._v3EditId = a.id;
state._v3EditDraft = JSON.parse(JSON.stringify(a.v3Document.blocks));
const panel = contentV3EditorPanel(a);
add("面板含容器 v3-editor", has(panel, "v3-editor"), "");
add("面板含 headline 输入框（lead 区块）", has(panel, 'data-v3-field="headline"'), "");
add("面板含 caption 输入框（image 区块）", has(panel, 'data-v3-field="caption"'), "");
add("面板含 mediaRefs 输入框（image 区块）", has(panel, 'data-v3-field="mediaRefs"'), "");
add("面板含保存/新增/删除动作", has(panel, "edV3Save") && has(panel, "edV3Add") && has(panel, "edV3Delete"), "");
add("image 区块的 caption 输入框回填了原文「山脊」", has(panel, 'value="山脊"'), "");
add("非编辑态不渲染面板", (state._v3EditId = "other", !has(contentV3EditorPanel(a), "v3-editor")) && (state._v3EditId = a.id, true));

/* ============ 3. 上移 / 下移 ============ */
state._v3EditDraft = JSON.parse(JSON.stringify(a.v3Document.blocks));
contentV3EditorMove(a, 0, 1);
add("上移：hero 与 lead 交换顺序", state._v3EditDraft[0].type === "lead" && state._v3EditDraft[1].type === "hero", state._v3EditDraft.map(b => b.type).join(","));

/* ============ 4. 删除 ============ */
state._v3EditDraft = JSON.parse(JSON.stringify(a.v3Document.blocks));
const beforeLen = state._v3EditDraft.length;
contentV3EditorDelete(a, 0);
add("删除首块：长度 -1 且原 lead 顶上", state._v3EditDraft.length === beforeLen - 1 && state._v3EditDraft[0].type === "lead", state._v3EditDraft.map(b => b.type).join(","));

/* ============ 5. 新增（按类型带/不带 mediaRefs） ============ */
state._v3EditDraft = JSON.parse(JSON.stringify(a.v3Document.blocks));
contentV3EditorAdd(a, "quote");
let last = state._v3EditDraft[state._v3EditDraft.length - 1];
add("新增 quote：块类型正确且无 mediaRefs", last.type === "quote" && last.mediaRefs === undefined, JSON.stringify(last));
contentV3EditorAdd(a, "image");
last = state._v3EditDraft[state._v3EditDraft.length - 1];
add("新增 image：块类型正确且 mediaRefs 为空数组", last.type === "image" && Array.isArray(last.mediaRefs) && last.mediaRefs.length === 0, JSON.stringify(last));

/* ============ 6. collect 不抛错且返回草稿 ============ */
state._v3EditDraft = JSON.parse(JSON.stringify(a.v3Document.blocks));
let collectErr = null, collected = null;
try { collected = contentV3EditorCollect(); } catch (e) { collectErr = String(e); }
add("collect 不抛错并返回草稿数组", !collectErr && Array.isArray(collected) && collected.length === a.v3Document.blocks.length, collectErr || "");

/* ============ 7. 保存：写回文档 + 打标记 + 清草稿 ============ */
state._v3EditDraft = JSON.parse(JSON.stringify(a.v3Document.blocks));
const draftRef = state._v3EditDraft;
state._v3EditDraft[1].copy.headline = "改过的标题";
state._v3EditId = a.id;
const okSave = contentV3EditorSave(a);
add("保存返回成功", okSave === true, "");
add("保存写回 a.v3Document.blocks（同一引用）", a.v3Document.blocks === draftRef, "");
add("保存打 _manuallyEdited 标记", a.v3Document._manuallyEdited === true, "");
add("保存后文档仍合法（双轨不破）", (typeof contentV3IsValidDoc === "function") && contentV3IsValidDoc(a.v3Document), "");
add("保存刷新了 v3TruthKey", typeof a.v3TruthKey === "string" && a.v3TruthKey.length > 0, a.v3TruthKey);
add("保存后清空编辑草稿态", state._v3EditId === null && state._v3EditDraft === null, "id=" + state._v3EditId);
add("保存落地了人工改动（headline 被改）", a.v3Document.blocks[1].copy.headline === "改过的标题", a.v3Document.blocks[1].copy.headline);

/* ============ 8. 入口把关：无 V3 文档时按钮为空（admin 可见性由 isAdminMode 守，不在此重赋值） ============ */
const aNoDoc = mkActivity();
delete aNoDoc.v3Document;
add("无 V3 文档：编辑按钮为空", !has((typeof contentV3EditorButton === "function") ? contentV3EditorButton(aNoDoc) : "x", "edV3Edit"), "");
add("contentV3EditorEnabled 是函数且返回布尔", (typeof contentV3EditorEnabled === "function") && typeof contentV3EditorEnabled(a) === "boolean", "");

/* ============ 汇总 ============ */
const total = checks.length;
const passed = checks.filter(c => c.pass).length;
return { ok: passed === total, total: total, passed: passed, checks: checks };
