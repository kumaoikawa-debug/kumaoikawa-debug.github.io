/* contentV3EditorTools.js —— Editor.js 的 ClubOS 自定义 Block Tool（文档 §十二 / A2）
 *
 * A2 点名的 11 个 Block Tool：
 *   ClubHero / ClubLead / ClubStatement / ClubImage / ClubImageGroup / ClubTextImage
 *   ClubMetric / ClubQuote / ClubChapterBreak / ClubGallery / ClubCTA
 *
 * ★ 两条硬边界：
 *   1. 输出必须保存为 ClubOS 自己的 PromoDocument Schema —— Editor.js 只是编辑层，
 *      它的 JSON 格式**不得反向绑死业务**（所以这里做双向映射，落库永远落 PromoDocument）。
 *   2. 详细行程 / 费用 / 清单**不进入**创意 Block 系统（它们属于 Info Stack），
 *      因此这里没有对应的 Block Tool —— 老板改不到 confirmedFacts / 费用 / 行程真源。
 *
 * 依赖：vendor/editorjs/editorjs.umd.js（固定版本 2.30.6，仅在「编辑宣传内容」模式由
 * contentV3Editor.js 动态加载，平时不进页面）。
 */

/* 11 个 Tool 的字段声明 —— 与 PromoDocument 的 block type 一一对应 */
const V3_EDITOR_TOOL_SPECS = [
  { name: "ClubHero",         type: "hero",          title: "主视觉 Hero", fields: ["headline", "body"], media: true },
  { name: "ClubLead",         type: "lead",          title: "导语 Lead",   fields: ["body"] },
  { name: "ClubStatement",    type: "statement",     title: "主张 Statement", fields: ["headline", "body"] },
  { name: "ClubImage",        type: "image",         title: "单图",        fields: ["caption"], media: true },
  { name: "ClubImageGroup",   type: "image_group",   title: "图片组",      fields: ["caption"], media: true },
  { name: "ClubTextImage",    type: "text_image",    title: "图文混排",    fields: ["headline", "body", "caption"], media: true },
  { name: "ClubMetric",       type: "metric",        title: "数据 Metric", fields: ["headline", "body"] },
  { name: "ClubQuote",        type: "quote",         title: "引语 Quote",  fields: ["body", "caption"] },
  { name: "ClubChapterBreak", type: "chapter_break", title: "章节分隔",    fields: ["headline"] },
  { name: "ClubGallery",      type: "gallery",       title: "图廊 Gallery", fields: ["caption"], media: true },
  { name: "ClubCTA",          type: "cta",           title: "行动召唤 CTA", fields: ["headline", "body"] }
];

/* 字段中文占位（编辑态提示，不是文案模板） */
const V3_EDITOR_PLACEHOLDER = {
  headline: "标题",
  body: "正文",
  caption: "图注"
};

const V3_EDITOR_ICON = '<svg width="17" height="15" viewBox="0 0 17 15" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="15" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4 5h9M4 8h9M4 11h5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

/* ---------------------------------------------------------------- 内部工具 */

/* 一个可编辑字段：contenteditable 的 div。
   ★ 存回时取 textContent（纯文本），不把 HTML 塞进 PromoDocument.copy ——
     渲染器按纯文本渲染，混进标签会变成肉眼可见的尖括号。 */
function v3EdField(value, kind, placeholder) {
  const el = document.createElement("div");
  el.className = "v3ed-field v3ed-" + kind;
  el.contentEditable = "true";
  el.setAttribute("data-placeholder", placeholder || V3_EDITOR_PLACEHOLDER[kind] || kind);
  el.textContent = String(value == null ? "" : value);
  return el;
}

/* 图片 id 编辑区：一行一个 id + 「换图」按钮（换图走宿主注入的回调） */
function v3EdMedia(ids, onPick) {
  const wrap = document.createElement("div");
  wrap.className = "v3ed-media";

  const label = document.createElement("div");
  label.className = "v3ed-media-label";
  label.textContent = "图片 id（一行一个）";
  wrap.appendChild(label);

  const area = document.createElement("textarea");
  area.className = "v3ed-media-ids";
  area.rows = Math.max(2, (ids || []).length);
  area.value = (ids || []).join("\n");
  wrap.appendChild(area);

  if (typeof onPick === "function") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "v3ed-pick";
    btn.textContent = "换图";
    btn.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      onPick(function (picked) {
        if (!picked) return;
        const cur = area.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
        if (cur.length) cur[cur.length - 1] = picked; else cur.push(picked);
        area.value = cur.join("\n");
      });
    });
    wrap.appendChild(btn);
  }

  wrap.__ids = function () {
    return area.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
  };
  return wrap;
}

/* 生成一个 Club* Block Tool 类 */
function v3EdMakeTool(spec) {
  function ClubTool(params) {
    const d = (params && params.data) || {};
    this.api = params && params.api;
    this.data = {
      headline: d.headline || "",
      body: d.body || "",
      caption: d.caption || "",
      media: Array.isArray(d.media) ? d.media.slice() : []
    };
    /* 宿主（contentV3Editor.js）注入的换图回调：从本活动的照片里挑一张 */
    this.onPick = (params && params.config && params.config.onPickImage) || null;
    this.els = {};
  }

  ClubTool.toolbox = function () { return { title: spec.title, icon: V3_EDITOR_ICON }; };

  ClubTool.prototype.render = function () {
    const root = document.createElement("div");
    root.className = "v3ed-block v3ed-" + spec.type;

    spec.fields.forEach((kind) => {
      const f = v3EdField(this.data[kind], kind);
      this.els[kind] = f;
      root.appendChild(f);
    });

    if (spec.media) {
      const m = v3EdMedia(this.data.media, this.onPick);
      this.els.media = m;
      root.appendChild(m);
    }
    return root;
  };

  ClubTool.prototype.save = function () {
    const out = {};
    spec.fields.forEach((kind) => {
      const el = this.els[kind];
      out[kind] = el ? String(el.textContent || "").trim() : (this.data[kind] || "");
    });
    if (spec.media) {
      const m = this.els.media;
      out.media = m && typeof m.__ids === "function" ? m.__ids() : (this.data.media || []);
    }
    /* 落回时带上 type —— 保存端据此还原 PromoDocument 的 block.type */
    out.__type = spec.type;
    return out;
  };

  return ClubTool;
}

/* ---------------------------------------------------------------- 对外：Tool 集合 */

/* Editor.js 的 tools 配置对象 */
function contentV3EditorTools(config) {
  const cfg = config || {};
  const out = {};
  V3_EDITOR_TOOL_SPECS.forEach(function (spec) {
    out[spec.name] = v3EdMakeTool(spec);
  });
  /* 换图回调挂到 config 上，各 Tool 通过 params.config.onPickImage 取到 */
  out.__config = cfg;
  return out;
}

/* ---------------------------------------------------------------- 双向映射 */

/* PromoDocument.blocks → Editor.js blocks 数组 */
function contentV3BlocksToEditorData(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  return list.map(function (b) {
    const spec = V3_EDITOR_TOOL_SPECS.filter(function (s) { return s.type === b.type; })[0];
    if (!spec) return null;
    const copy = b.copy || {};
    return {
      type: spec.name,
      data: {
        headline: String(copy.headline || ""),
        body: String(copy.body || ""),
        caption: String(copy.caption || ""),
        media: Array.isArray(b.mediaRefs) ? b.mediaRefs.slice() : []
      }
    };
  }).filter(Boolean);
}

/* Editor.js blocks → PromoDocument.blocks
   ★ 只回写「文案 + 图片」；purpose / communicationGoal / evidenceRefs / layout 一律沿用原块，
     绝不让 Editor.js 的输出格式反向定义业务结构。
   ★ 顺序调整 / 删除块由数组顺序与长度天然表达。 */
function contentV3EditorDataToBlocks(originalBlocks, editorBlocks) {
  const orig = Array.isArray(originalBlocks) ? originalBlocks : [];
  const ed = Array.isArray(editorBlocks) ? editorBlocks : [];
  const out = [];

  ed.forEach(function (eb, i) {
    const d = (eb && eb.data) || {};
    const type = d.__type || null;
    const spec = type
      ? V3_EDITOR_TOOL_SPECS.filter(function (s) { return s.type === type; })[0]
      : V3_EDITOR_TOOL_SPECS.filter(function (s) { return s.name === (eb && eb.type); })[0];
    if (!spec) return;

    /* 同类型里按顺序配对原块（第 n 个 hero 对第 n 个原 hero），保住它的 purpose/证据/layout */
    let src = null;
    let seen = -1;
    for (let k = 0; k < orig.length; k++) {
      if (orig[k] && orig[k].type === spec.type) {
        seen++;
        if (seen === (function () {
          let n = -1;
          for (let j = 0; j <= i; j++) {
            const t = (ed[j] && ed[j].data && ed[j].data.__type)
              || (V3_EDITOR_TOOL_SPECS.filter(function (s) { return s.name === (ed[j] && ed[j].type); })[0] || {}).type;
            if (t === spec.type) n++;
          }
          return n;
        })()) { src = orig[k]; break; }
      }
    }
    const base = src || { purpose: spec.title, communicationGoal: "", evidenceRefs: [], layout: { width: "normal" } };

    out.push({
      id: (src && src.id) || ("b-" + spec.type + "-" + (i + 1)),
      type: spec.type,
      purpose: (src && src.purpose) || spec.title,
      communicationGoal: (src && src.communicationGoal) || "",
      evidenceRefs: Array.isArray(src && src.evidenceRefs) ? src.evidenceRefs.slice() : [],
      copy: {
        headline: String(d.headline || ""),
        body: String(d.body || ""),
        caption: String(d.caption || "")
      },
      /* 图片：编辑层给什么就是什么；没给就沿用原块（不让编辑动作莫名丢图） */
      mediaRefs: Array.isArray(d.media) ? d.media.slice() : (Array.isArray(src && src.mediaRefs) ? src.mediaRefs.slice() : []),
      layout: (src && src.layout) || { width: "normal" }
    });
  });

  return out;
}
