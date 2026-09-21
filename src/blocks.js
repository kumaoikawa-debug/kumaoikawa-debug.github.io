/* ============ v228：积木式预览编辑视图 (blocks.js) ============
   把「AI 生成详情页」升级为「先拼 6 块、看拼装效果再改」的积木式预览。
   6 块 = 标签 / Hook / Timeline / Trust / Price / CTA（IR 见 publish.js 的
   buildContentBlocks / applyContentBlocks / parseItinText）。
   数据纪律：Trust / Price 是硬数据块，本视图只读呈现、不提供改写入口，
   也不把它们塞进 Hook / CTA 情感文案。Hook / CTA 改写落库前过 sanitizePublishCopy。 */

/* ---------- 文本序列化辅助（行程时间线的可读编辑） ---------- */
function itinToText(days) {
  if (!Array.isArray(days) || !days.length) return "";
  return days.map(function (d) {
    let s = "DAY " + (d.label || "");
    if (d.sub) s += " — " + d.sub;
    s += "\n";
    (d.items || []).forEach(function (it) {
      s += (it.time ? it.time + " " : "") + (it.text || "") + "\n";
    });
    return s;
  }).join("\n");
}

function itinFromText(text) {
  const days = [];
  let cur = null;
  String(text || "").split(/\n+/).forEach(function (raw) {
    const line = raw.trim();
    if (!line) return;
    const dh = line.match(/^DAY\s*(.+)$/i);
    if (dh) {
      const body = dh[1].trim();
      const subM = body.match(/^(.*?)[\s—-]+(.+)$/);
      cur = { label: body, sub: subM ? subM[2] : "", items: [] };
      days.push(cur);
      return;
    }
    const tm = line.match(/^([0-9]{1,2}[:：][0-9]{2})\s*(.*)$/);
    const item = { time: tm ? tm[1] : "", text: tm ? tm[2] : line };
    if (cur) cur.items.push(item);
    else { cur = { label: "行程", sub: "", items: [item] }; days.push(cur); }
  });
  return days;
}

/* ---------- 转义辅助 ---------- */
function escAttr(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escTA(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/<\/textarea/gi, "<\\/textarea");
}

/* ---------- 主视图 ---------- */
function renderBlockPreview() {
  const id = (state.params && state.params.id) || null;
  const a = (id && typeof getActivity === "function") ? getActivity(id) : null;
  if (!a) {
    return '<div class="card card-pad"><div class="eyebrow">未找到活动</div>'
      + '<p class="muted">活动不存在或已删除，请返回活动列表。</p>'
      + '<button class="btn btn-ghost" data-action="nav" data-view="list">返回列表</button></div>';
  }
  const b = (typeof buildContentBlocks === "function") ? buildContentBlocks(a) : null;
  if (!b) return '<div class="card card-pad"><p class="muted">积木构建失败。</p></div>';

  const aid = escAttr(a.id);
  const cover = (a.photos && a.photos.length && a.coverIndex != null && a.photos[a.coverIndex]) ? a.photos[a.coverIndex] : (a.photos && a.photos[0]) || "";

  /* 封面选择 */
  let coverHtml = "";
  if (a.photos && a.photos.length) {
    coverHtml = '<div class="block-cover-row">'
      + a.photos.map(function (p, i) {
        const on = (i === (a.coverIndex != null ? a.coverIndex : 0)) ? " on" : "";
        return '<div class="block-cover-thumb' + on + '">'
          + '<img src="' + escAttr(p) + '" alt="照' + (i + 1) + '" loading="lazy">'
          + '<button class="block-cover-set" data-action="blockCoverPick" data-input="' + i + '" data-id="' + aid + '">设封面</button>'
          + '</div>';
      }).join("")
      + '</div>';
  } else {
    coverHtml = '<p class="muted small">本活动暂无照片，去详情页可联网配图。</p>';
  }

  /* 可编辑块（标签 / Hook / Timeline / CTA） + 只读块（Trust / Price） */
  const tagsVal = b.tags.value.join("，");
  const hookVal = b.hook.value;
  const ctaVal = b.cta.value;
  const timeVal = itinToText(b.timeline.value);

  const trustHtml = (b.trust.value.length ? b.trust.value : ["（暂无领队/含项/保险信息）"])
    .map(function (t) { return "<li>" + escTA(t) + "</li>"; }).join("");

  const price = b.price.value;
  const priceHtml = '<div class="block-price-main">' + escTA(price.text) + '</div>'
    + (price.unit ? '<div class="muted small">单价单位：' + escTA(price.unit) + '</div>' : "")
    + (price.limit != null ? '<div class="muted small">名额上限：' + escTA(price.limit) + '</div>' : "")
    + (price.tbd ? '<div class="muted small">价格待定</div>' : "");

  return ''
    + '<div class="block-preview">'
    + '  <div class="block-head">'
    + '    <div class="eyebrow">AI 已拼好 6 块 · 先看拼装效果再改</div>'
    + '    <h2 class="section-title">' + escTA(a.title || "未命名活动") + '</h2>'
    + '  </div>'

    + '  <div class="block-cover">'
    + (cover ? '<img class="block-cover-img" src="' + escAttr(cover) + '" alt="封面">' : '<div class="block-cover-img block-cover-empty">无封面</div>')
    + '    <div class="block-cover-tip muted small">点下方缩略图可换封面（硬数据，不改写）</div>'
    + '    ' + coverHtml
    + '  </div>'

    /* 标签 */
    + '  <div class="block-card">'
    + '    <div class="block-card-h"><span class="block-tag editable">可改</span>' + escTA(b.tags.label) + '</div>'
    + '    <input class="block-input" data-block="tags" value="' + escAttr(tagsVal) + '" placeholder="多个标签用逗号分隔">'
    + '    <button class="btn btn-ghost btn-sm block-ai" data-action="blockRewrite" data-type="tags" data-id="' + aid + '">AI 重写标签</button>'
    + '  </div>'

    /* Hook */
    + '  <div class="block-card">'
    + '    <div class="block-card-h"><span class="block-tag editable">可改</span>' + escTA(b.hook.label) + '</div>'
    + '    <textarea class="block-input block-ta" data-block="hook" rows="3" placeholder="一句话传播主张，不写价格/人数等硬数据">' + escTA(hookVal) + '</textarea>'
    + '    <button class="btn btn-ghost btn-sm block-ai" data-action="blockRewrite" data-type="hook" data-id="' + aid + '">AI 重写主张</button>'
    + '  </div>'

    /* Timeline */
    + '  <div class="block-card">'
    + '    <div class="block-card-h"><span class="block-tag editable">可改</span>' + escTA(b.timeline.label) + '</div>'
    + '    <textarea class="block-input block-ta" data-block="timeline" rows="8" placeholder="每行一段：以 DAY 1 开头分天，节点写 07:30 集合出发">' + escTA(timeVal) + '</textarea>'
    + '    <div class="muted small">格式：DAY 1 换天；节点行「07:30 集合出发」</div>'
    + '  </div>'

    /* Trust（只读） */
    + '  <div class="block-card block-readonly">'
    + '    <div class="block-card-h"><span class="block-tag ro">只读</span>' + escTA(b.trust.label) + '</div>'
    + '    <ul class="block-trust">' + trustHtml + '</ul>'
    + '  </div>'

    /* Price（只读） */
    + '  <div class="block-card block-readonly">'
    + '    <div class="block-card-h"><span class="block-tag ro">只读</span>' + escTA(b.price.label) + '</div>'
    + '    ' + priceHtml
    + '  </div>'

    /* CTA */
    + '  <div class="block-card">'
    + '    <div class="block-card-h"><span class="block-tag editable">可改</span>' + escTA(b.cta.label) + '</div>'
    + '    <textarea class="block-input block-ta" data-block="cta" rows="2" placeholder="一句行动召唤，不编造价格/名额">' + escTA(ctaVal) + '</textarea>'
    + '    <button class="btn btn-ghost btn-sm block-ai" data-action="blockRewrite" data-type="cta" data-id="' + aid + '">AI 重写 CTA</button>'
    + '  </div>'

    /* 操作栏 */
    + '  <div class="block-actions">'
    + '    <button class="btn btn-primary" data-action="blockApplyEdits" data-id="' + aid + '">' + (typeof ICON === "function" ? ICON("save") : "✓") + ' 保存积木编辑</button>'
    + '    <button class="btn btn-ghost" data-action="blockToDetail" data-id="' + aid + '">看详情页</button>'
    + '    <button class="btn btn-ghost" data-action="blockToCardset" data-id="' + aid + '">生成卡片组</button>'
    + '    <button class="btn btn-ghost" data-action="blockExport" data-id="' + aid + '">导出摘要</button>'
    + '  </div>'
    + '  <p class="muted small block-note">改完点「保存」才会写回活动；Trust / Price 为硬数据只读，不会进情感文案。</p>'
    + '</div>';
}

/* ---------- 保存编辑 ---------- */
async function applyBlockEdits(id) {
  const a = (typeof getActivity === "function") ? getActivity(id) : null;
  if (!a) { if (typeof toast === "function") toast("活动不存在"); return; }
  const tagsEl = document.querySelector('[data-block="tags"]');
  const hookEl = document.querySelector('[data-block="hook"]');
  const timeEl = document.querySelector('[data-block="timeline"]');
  const ctaEl = document.querySelector('[data-block="cta"]');
  if (!tagsEl || !hookEl || !timeEl || !ctaEl) { if (typeof toast === "function") toast("页面未就绪"); return; }

  const blocks = (typeof buildContentBlocks === "function") ? buildContentBlocks(a) : null;
  if (!blocks) { if (typeof toast === "function") toast("积木构建失败"); return; }

  blocks.tags.value = tagsEl.value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
  blocks.hook.value = hookEl.value;
  blocks.timeline.value = itinFromText(timeEl.value);
  blocks.cta.value = ctaEl.value;

  if (typeof applyContentBlocks === "function") applyContentBlocks(a, blocks);
  if (typeof upsert === "function") upsert(a);
  if (typeof saveState === "function") saveState();
  if (typeof toast === "function") toast("已保存积木编辑");
  if (typeof showView === "function") showView("blockPreview", { id: id });
}

/* ---------- 单块 AI 重写（Hook / CTA / Tags，不编造硬数据） ---------- */
async function blockRewrite(type, id) {
  const a = (typeof getActivity === "function") ? getActivity(id) : null;
  if (!a) { if (typeof toast === "function") toast("活动不存在"); return; }
  const sys = (typeof AI_SYSTEM_PROMPT !== "undefined") ? AI_SYSTEM_PROMPT
    : "你是户外俱乐部内容主笔，写有销售转化力的宣传文案。";
  let userMsg = "";
  if (type === "hook") {
    userMsg = "为这场活动写一句传播主张（Hook）。只写主张，严禁出现价格、人数、名额、领队年限等任何硬数据。活动标题："
      + (a.title || "") + "；类型：" + (a.type || "") + "；地点：" + (a.place || "");
  } else if (type === "cta") {
    userMsg = "为这场活动写一句行动召唤（CTA）。只写号召语，严禁编造价格、名额、优惠等硬数据。活动标题：" + (a.title || "");
  } else if (type === "tags") {
    userMsg = "给这场活动生成 4-6 个标签，用中文逗号分隔，每个 2-6 字。活动标题：" + (a.title || "") + "；类型：" + (a.type || "");
  } else { return; }

  if (typeof toast === "function") toast("AI 重写中…");
  let out;
  try {
    out = await clubLLM({ system: sys, user: userMsg, json: false, temperature: 0.7 });
  } catch (e) { if (typeof toast === "function") toast("重写失败：" + (e && e.message ? e.message : e)); return; }

  if (!out || out === "__fallback__") { if (typeof toast === "function") toast("AI 暂不可用，请手动修改"); return; }
  const text = String(out).trim();

  if (type === "tags") {
    const el = document.querySelector('[data-block="tags"]');
    if (el) el.value = text.split(/[\n,，、]/).map(function (s) { return s.trim(); }).filter(Boolean).join("，");
  } else {
    const sel = (type === "hook") ? '[data-block="hook"]' : '[data-block="cta"]';
    const el = document.querySelector(sel);
    if (el) el.value = (typeof sanitizePublishCopy === "function") ? sanitizePublishCopy(text) : text;
  }
  if (typeof toast === "function") toast("AI 已重写「" + type + "」，确认后点保存");
}

/* ---------- 换封面 ---------- */
async function blockCoverPick(input, id) {
  const a = (typeof getActivity === "function") ? getActivity(id) : null;
  if (!a) return;
  a.photos = a.photos || [];
  const idx = parseInt(input, 10);
  if (isFinite(idx) && idx >= 0 && idx < a.photos.length) {
    a.coverIndex = idx; a._coverManual = true;
    if (typeof upsert === "function") upsert(a);
    if (typeof saveState === "function") saveState();
    if (typeof toast === "function") toast("已更换封面");
    if (typeof showView === "function") showView("blockPreview", { id: id });
  }
}

/* ---------- 跳卡片组（复用 cardset.js 的 cardsetGenerate） ---------- */
function blockToCardset(id) {
  if (typeof showView === "function") showView("cardset");
  if (typeof cardsetGenerate === "function") cardsetGenerate("", id);
}

/* ---------- 跳详情页 ---------- */
function blockToDetail(id) {
  if (typeof showView === "function") showView("activityPage", { id: id });
}

/* ---------- 导出可读摘要（复制） ---------- */
function blockExport(id) {
  const a = (typeof getActivity === "function") ? getActivity(id) : null;
  if (!a) return;
  const b = (typeof buildContentBlocks === "function") ? buildContentBlocks(a) : null;
  if (!b) return;
  let s = "【" + (a.title || "未命名活动") + "】\n";
  s += "标签：" + (b.tags.value.join("、") || "—") + "\n";
  s += "主张：" + (b.hook.value || "—") + "\n";
  s += "价格：" + b.price.value.text + "\n";
  s += "信任：" + (b.trust.value.join("；") || "—") + "\n";
  s += "CTA：" + (b.cta.value || "—") + "\n";
  if (typeof xbCopy === "function") xbCopy(s);
  if (typeof toast === "function") toast("已复制积木摘要，可粘贴到公众号 / 企微");
}
