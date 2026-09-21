/* =======================================================================
 * contentV3Renderer.js — Content Engine V3 渲染层（Phase 2 / 任务 H）
 * -----------------------------------------------------------------------
 * 铁律（V3 开发文本 §七.4 / §九 / §二十六）：
 *   ① Block 是「视觉词汇」，不是模板。渲染器**不得假设任何固定 Block 顺序**，
 *      只能按 document.blocks 的真实顺序逐块渲染（这也是 fingerprint 能表达差异的前提）。
 *   ② 渲染器**不得自创任何文案 / 促销话术**。页面上出现的每一个字，
 *      要么来自 block.copy，要么来自 Info Stack 的 canonical 事实字段。
 *      宁可整块留空，也绝不补一句「名额有限」「治愈之旅」之类的漂亮话。
 *   ③ evidenceRefs 落到 data-evidence 属性上做可回溯留痕（用户不可见，但可断言）。
 * ======================================================================= */

/* ------------------------------------------------------------ 数值工具 */
function contentV3Num(v, d) {
  var n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return d;
  return Math.max(0, Math.min(1, n));
}

/* StyleVector → CSS 自定义属性。全部是**连续量纲**，没有任何 style enum。
   之所以写成内联变量：即便 styles.css 被 CDN 缓存住旧版，版式差异依然生效。 */
function contentV3StyleVarsObj(doc) {
  var sv = (doc && doc.direction && doc.direction.styleVector) || {};
  var textDensity = contentV3Num(sv.textDensity, 0.45);
  var imageDominance = contentV3Num(sv.imageDominance, 0.6);
  var ctaStrength = contentV3Num(sv.ctaStrength, 0.5);
  var typo = contentV3Num(sv.typographyEnergy, 0.5);
  var wsanse = String(sv.whitespace || "balanced");
  var gap = wsanse === "tight" ? 16 : (wsanse === "generous" ? 46 : 28);
  var rhythm = String(sv.rhythm || "medium");
  var rgap = rhythm === "slow" ? 42 : (rhythm === "fast" ? 18 : 28);
  return {
    "--v3-text-scale": (0.94 + textDensity * 0.2).toFixed(3),
    "--v3-blk-gap": gap + "px",
    "--v3-ry-gap": rgap + "px",
    "--v3-cta-scale": (0.94 + ctaStrength * 0.16).toFixed(3),
    "--v3-letter": (typo * 0.04).toFixed(3) + "em",
    "--v3-fig-h": Math.round(170 + imageDominance * 150) + "px"
  };
}

function contentV3StyleVars(doc) {
  var o = contentV3StyleVarsObj(doc);
  var out = "";
  for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) out += k + ":" + o[k] + ";"; }
  return out;
}

/* ------------------------------------------------------------ 文案闸门 */
/* v224：V3 文档的文学块（lead/statement/quote/cta/chapter_break/text_image 及一切
   headline/caption）必须过 v201 文学层闸门的 **strict 档** —— 此前 V3 双轨直接
   contentV3Paras 上屏，完全绕过了闸门，导致「10月1日，双楠大道94号集合——这是我们的
   句首」「单日，15人，¥128——这是我们的分行与字距」「类型：户外探索，地点：…，季节：…」
   这类数据句 / 元数据行原样出现在图文情感宣传里（老板第三次反馈）。
   strict 档额外丢「元数据行」与「元叙事句」（见 core.js LITERARY_META_WORDS）。
   metric 块是事实层（数字行是刻意呈现），**不**过闸门。
   兜底形态：闸门清成空 → 该段/该标题直接不渲染（渲染器绝不补写文案，铁律②）。 */
function contentV3Lit(txt) {
  if (typeof sanitizeLiteraryText !== "function") return String(txt == null ? "" : txt);
  return sanitizeLiteraryText(txt, true);
}

/* 正文按空行拆段（AI 可能在 body 里塞软换行）；逐段过闸门再转义。
   注意：这里**只做结构化 + 净化**，不补任何文字。 */
function contentV3Paras(txt) {
  var s = String(txt == null ? "" : txt).replace(/\r/g, "").trim();
  if (!s) return "";
  return s.split(/\n{1,}/).map(function (p) {
    p = contentV3Lit(String(p).trim());
    return p ? "<p>" + esc(p) + "</p>" : "";
  }).filter(Boolean).join("");
}

function contentV3Trim(txt, n) {
  return String(txt == null ? "" : txt).trim().slice(0, n || 60);
}

function contentV3MetaLines(b) {
  var s = String((b && b.copy && b.copy.body) || "").replace(/\r/g, "");
  if (!s.trim()) return [];
  var lines = s.split(/[\n；;]+/).map(function (x) { return String(x).trim(); }).filter(Boolean);
  /* 一行之内可能用「、」，」并列多个指标，一并拆开 */
  var out = [];
  for (var i = 0; i < lines.length; i++) {
    var parts = lines[i].split(/[、,，]+/).map(function (x) { return String(x).trim(); }).filter(Boolean);
    if (parts.length > 1) { out = out.concat(parts); } else { out.push(lines[i]); }
  }
  return out.slice(0, 6);
}

/* -------------------------------------------------------- 素材（图）解析 */
/* 后端回的 mediaRefs 是素材 id（如 p0 / p3），前端 a.photos 是 URL 串数组。
   两侧口径不同，这里做**健壮解析**（不至于因为一个 ref 解不出来整块没图）：
     p{数字} → 下标      纯数字且在范围内 → 下标      http/blob/data → 直接用 URL
   都解不出来时，从「未被占用的图」里轮转取一张，保证配图承诺不落空。 */
function contentV3ResolvePhoto(a, ref, ctx) {
  var photos = (a && a.photos) || [];
  if (!photos.length) return null;
  var s = String(ref == null ? "" : ref).trim();
  if (!s) return null;
  var idx = -1;
  var m = s.match(/^p(\d+)$/i);
  if (m) idx = Number(m[1]);
  else if (/^\d+$/.test(s)) idx = Number(s);
  if (idx >= 0 && idx < photos.length) return { index: idx, src: photos[idx] };
  if (/^(https?:|blob:|data:)/i.test(s)) {
    /* URL 直给：可能不在 a.photos 里，交给调用方按直链渲染 */
    return { index: -1, src: s };
  }
  /* 兜底轮转：优先给还没用过的图，用过一轮后才允许复用 */
  for (var round = 0; round < 2; round++) {
    for (var i = 0; i < photos.length; i++) {
      if (ctx.used[i] && round === 0) continue;
      ctx.used[i] = true;
      return { index: i, src: photos[i] };
    }
  }
  return null;
}

function contentV3MediaList(a, b, ctx) {
  var refs = (b && b.mediaRefs) || [];
  var out = [];
  for (var i = 0; i < refs.length; i++) {
    var hit = contentV3ResolvePhoto(a, refs[i], ctx);
    if (!hit || !hit.src) continue;
    if (hit.index >= 0) ctx.used[hit.index] = true;
    out.push(hit);
  }
  return out;
}

/* 单图：优先复用 xhFig（它已处理真实比例 / 裁切风险 / 原比例降级），
   拿不到下标（例如 ref 是直链）时退化为直出的 <img>。 */
function contentV3FigHtml(a, hit, cap) {
  if (!hit || !hit.src) return "";
  var capTxt = String(cap || "").trim();
  if (hit.index >= 0 && typeof xhFig === "function") {
    var h = xhFig(a, hit.index, capTxt);
    if (h) return h;
  }
  var contain = (typeof pagePhotoContain === "function") ? pagePhotoContain(hit.src) : false;
  var img = `<div class="v3-fig v3-fig-raw" data-ar-auto><img data-smart-img src="${esc(hit.src)}" alt="" style="object-fit:${contain ? "contain" : "cover"}"></div>`;
  return capTxt ? `<figure class="v3-figure">${img}<figcaption>${esc(capTxt)}</figcaption></figure>` : img;
}

function contentV3FigsHtml(a, hits, cap0) {
  if (!hits || !hits.length) return "";
  var n = hits.length;
  var shape = n === 1 ? "one" : (n === 2 ? "two" : "three");
  /* 刻意同时挂 xh-ed-figs：复用既有图件的真实比例 / 裁切风险 / 原比例降级 + max-height 分档，
     不另写一套（另写一套最容易把「竖图左右露米色留白」这类老毛病重新带回来）。
     .v3-figs 只负责 V3 自己的列数与高度变量。 */
  return `<div class="xh-ed-figs v3-figs ${shape}">${hits.map(function (hit, i) {
    return contentV3FigHtml(a, hit, i === 0 ? cap0 : "");
  }).join("")}</div>`;
}

/* ------------------------------------------------------------ Hero 提取 */
/* V3 文档可能在首页就给了 hero Block —— 它的 copy 用来接管页面页头大标题，
   不让页面出现两个 hero（Block 本体在画布里跳过）。 */
function contentV3HeroCopy(doc) {
  var b = contentV3FirstBlock(doc, "hero");
  if (!b) return null;
  var c = b.copy || {};
  var headline = contentV3Lit(contentV3Trim(c.headline, 40));
  var sub = contentV3Lit(contentV3Trim(c.body || c.caption, 60));
  if (!headline && !sub) return null;
  return { headline: headline, sub: sub };
}

/* ------------------------------------------------------------ 单块渲染 */
function contentV3BlockHtml(a, b, ctx) {
  if (!contentV3IsValidBlock(b)) return "";
  var t = b.type;
  /* hero 由页面页头承担，画布里不重复渲染 */
  if (t === "hero") return "";

  var lay = (b && b.layout) || {};
  var width = (lay.width === "wide" || lay.width === "full") ? lay.width : "normal";
  var align = (lay.alignment === "left" || lay.alignment === "center" || lay.alignment === "right") ? lay.alignment : "";
  var ws = (lay.whitespace === "tight" || lay.whitespace === "generous") ? lay.whitespace : "";
  var emphasis = contentV3Num(lay.emphasis, 0.5);
  var colsNum = Number(lay.columns);
  var cols = (isFinite(colsNum) && colsNum >= 1 && colsNum <= 4) ? Math.floor(colsNum) : 0;

  var c = b.copy || {};
  /* v224：headline/caption 也是文学层 —— 过 strict 闸门，清成空就不渲染（绝不保留脏标题）。 */
  var headline = contentV3Lit(contentV3Trim(c.headline, 60));
  var body = c.body;
  var caption = contentV3Lit(contentV3Trim(c.caption, 80));

  var media = contentV3MediaList(a, b, ctx);
  var ev = Array.isArray(b.evidenceRefs) ? b.evidenceRefs.slice(0, 8).filter(function (x) { return typeof x === "string" && x; }) : [];
  var evAttr = ev.length ? ` data-evidence="${esc(ev.join(" "))}"` : "";
  var styleAttr = ` style="--v3-em:${emphasis.toFixed(3)}${cols ? ";--v3-cols:" + cols : ""}"`;

  var cls = "v3-blk v3-" + t + " v3-w-" + width + (align ? " v3-al-" + align : "") + (ws ? " v3-ws-" + ws : "");
  var head = headline ? `<div class="v3-head">${esc(headline)}</div>` : "";
  var inner = "";

  if (t === "lead") {
    inner = head + contentV3Paras(body);
  } else if (t === "statement") {
    inner = head + contentV3Paras(body);
  } else if (t === "image") {
    inner = contentV3FigsHtml(a, media, caption) + (headline ? `<div class="v3-cap">${esc(headline)}</div>` : "");
  } else if (t === "image_group" || t === "gallery") {
    inner = head + contentV3FigsHtml(a, media, caption);
  } else if (t === "text_image") {
    /* 图文并行：媒体主导度高时图在左，反之文在左 —— 这是 layout 带来的顺序差异，
       不改动任何文案。 */
    var figs = contentV3FigsHtml(a, media, caption);
    inner = lay.mediaDominance >= 0.5 ? (figs + head + contentV3Paras(body)) : (head + contentV3Paras(body) + figs);
  } else if (t === "metric") {
    /* 指标块：把 body 的每一行拆成一个指标格。
       拆的是**已存在的行**，不是由渲染器补写的数字。 */
    var lines = contentV3MetaLines(b);
    if (lines.length) {
      inner = head + `<div class="v3-metrics"${cols ? ` style="--v3-cols:${cols}"` : ""}>${lines.map(function (x) {
        return `<div class="v3-metric"><span>${esc(x)}</span></div>`;
      }).join("")}</div>`;
    } else {
      inner = head + contentV3Paras(body);
    }
  } else if (t === "quote") {
    inner = (typeof ICON === "function" ? `<div class="v3-qmark">${ICON("quote")}</div>` : "") + contentV3Paras(body || headline);
  } else if (t === "chapter_break") {
    inner = head;
  } else if (t === "cta") {
    /* id 与 legacy CTA 保持一致（#ed-cta）：换渲染轨道后原「目录 / 跳转」仍指向这里。
       CTA 按钮是页面自身动作（与 legacy 同一个 openSignup），不是广告话术；
       价格取自 canonical 事实，绝不由渲染器编造。 */
    inner = head + contentV3Paras(body)
      + `<div class="v3-cta-act"><div class="v3-cta-price">${(typeof priceTextOf === "function") ? priceTextOf(a, null) : ""}</div>`
      + `<button class="btn btn-primary" data-action="openSignup" data-id="${esc(a && a.id)}">${(typeof ICON === "function") ? ICON("check") : ""} 立即报名</button></div>`;
    return `<section class="${cls}" id="ed-cta"${evAttr}${styleAttr}>${inner}</section>`;
  } else {
    inner = head + contentV3Paras(body);
  }

  if (!headline && !String(body || "").trim() && !caption && !media.length) return "";
  if (!inner.trim()) return "";

  return `<section class="${cls}"${evAttr}${styleAttr}>${inner}</section>`;
}

/* ------------------------------------------------------------ 画布渲染 */
function contentV3CanvasHtml(a, doc) {
  if (!contentV3IsValidDoc(doc)) return "";
  var ctx = { used: {} };
  var out = "";
  for (var i = 0; i < doc.blocks.length; i++) {
    out += contentV3BlockHtml(a, doc.blocks[i], ctx);
  }
  return out;
}
