/* ============================================================================
 * Content Engine V3 — 渠道生成（Phase 4/5）
 * ----------------------------------------------------------------------------
 * 从 publish.js 拆出（文档 §二十「publish.js 必须拆」：万行 publish.js 继续迭代
 * 风险过高，V3 相关内容独立成文件）。
 *
 * 只放 V3 渠道管线对接：把活动事实发给后端 /api/content/:scenario/generate，
 * 再把返回的渠道文档映射回 legacy 的 gzh / xhs 形状（仅覆盖这两段，
 * moments/wechat/voice/poster/next 仍由 publish.js 本地生成）。
 *
 * 铁律（与 detail 同源）：
 *  - 后端未配 / 不可达 / 401 重试仍失败 / 出参不合法 → 一律返回 null，调用方保持 XF_FAMILY。
 *  - 映射只覆盖 gzh + xhs 两段；其余渠道与渲染器不变 —— 默认（无后端）路径零行为变化。
 *  - 预览用 doc.sections 的纯文本段落重渲染（不依赖后端 html 里可能失效的图片 src）；
 *    doc.html 另存 v3RawHtml / v3Raw，供「复制粘贴进公众号后台」使用。
 *
 * 依赖（由 contentV3.js 提供，扁平 classic script 共享顶层作用域，本文件须在其后加载）：
 *  contentV3Available / contentV3ApiBase / contentV3AuthHeader / clearBackendToken /
 *  contentV3ActivityPayload / contentV3PlanFactsPayload / contentV3PhotoPayload
 * 另用全局 esc / stripTags（core.js / publish.js 提供）。
 * ========================================================================== */

/* 构造渠道请求体（shape 与 detail 完全一致，复用 contentV3.js 的 payload 助手） */
function v3ChannelBody(a, opts) {
  opts = opts || {};
  if (!a) return null;
  var body = {
    activityId: String(a.id || opts.activityId || ""),
    activity: (typeof contentV3ActivityPayload === "function") ? contentV3ActivityPayload(a) : a,
    planFacts: (typeof contentV3PlanFactsPayload === "function") ? contentV3PlanFactsPayload(a) : null,
    photos: (typeof contentV3PhotoPayload === "function") ? contentV3PhotoPayload(a) : null
  };
  if (!body.activityId) return null;
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
  if (opts.actual) body.actual = opts.actual;
  return body;
}

/* 调后端 /api/content/:scenario/generate；返回合法渠道文档或 null（任何失败都 null） */
async function v3ChannelGenerate(scenario, a, opts) {
  opts = opts || {};
  if (!a || (scenario !== "wechat" && scenario !== "xiaohongshu" && scenario !== "recap")) return null;
  if (typeof contentV3Available !== "function" || !contentV3Available()) return null;
  var auth = (typeof contentV3AuthHeader === "function") ? await contentV3AuthHeader() : null;
  if (!auth) return null;
  var body = v3ChannelBody(a, opts);
  if (!body) return null;
  var base = (typeof contentV3ApiBase === "function") ? contentV3ApiBase() : "";
  if (!base) return null;
  var url = base + "/" + scenario + "/generate";
  var json = function (res) { return res && res.json ? res.json().catch(function () { return {}; }) : Promise.resolve({}); };
  try {
    let res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": auth },
      body: JSON.stringify(body)
    });
    if (res && res.status === 401 && typeof clearBackendToken === "function") {
      clearBackendToken();
      auth = (typeof contentV3AuthHeader === "function") ? await contentV3AuthHeader() : null;
      if (!auth) return null;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": auth },
        body: JSON.stringify(body)
      });
    }
    if (!res || !res.ok) return null;
    var d = await json(res);
    var doc = d && d.data && (d.data.document || d.data);
    if (!doc || Number(doc.schemaVersion) !== 3) return null;
    if (doc.scenario && doc.scenario !== scenario) return null;
    return doc;
  } catch (e) { return null; }
}

/* WechatDocument → legacy gzh 形状（预览用 sections 段落；html 存 v3RawHtml） */
function v3WechatToLegacy(wd) {
  var sections = Array.isArray(wd.sections) ? wd.sections : [];
  var mapped = sections.length
    ? sections.map(function (s) {
        var paras = (s.paragraphs || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
        return { h: s.heading || "", html: paras };
      })
    : [{ h: "", html: (wd.html || "") }];
  return {
    title: wd.title || (wd.titleOptions && wd.titleOptions[0]) || "",
    subtitle: "",
    summary: wd.digest || "",
    sections: mapped,
    titleOptions: wd.titleOptions || [],
    v3RawHtml: wd.html || "",
    v3ImageOrder: wd.imageOrder || [],
    v3CoverIndex: (typeof wd.coverIndex === "number") ? wd.coverIndex : -1
  };
}

/* XiaohongshuDocument → legacy xhs 形状 */
function v3XhsToLegacy(xd) {
  var body = [xd.hook, xd.body].filter(function (x) { return x && String(x).trim(); }).join("\n\n");
  var imageOrder = Array.isArray(xd.imageSequence) ? xd.imageSequence.map(function (s) { return s.photoIndex; }) : [];
  return {
    titles: xd.titleOptions || [],
    body: body,
    coverText: (typeof xd.coverSuggestion === "number") ? ("封面 #" + xd.coverSuggestion) : (xd.coverSuggestion || ""),
    hashtags: xd.tags || [],
    imageOrder: imageOrder,
    v3Raw: xd
  };
}

/* RecapDocument → legacy gzh + xhs（回顾只覆盖这两段；moments/wechat/next 保留本地） */
function v3RecapToLegacy(rd) {
  var sections = Array.isArray(rd.sections) ? rd.sections : [];
  var mapped = sections.length
    ? sections.map(function (s) {
        var paras = (s.paragraphs || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
        return { h: s.heading || "", html: paras };
      })
    : [{ h: "", html: (rd.html || "") }];
  var title = (rd.insight && rd.insight.coreMemory) || "";
  var summary = (rd.insight && rd.insight.whyItMatters) || "";
  var xhsBody = [title, summary].filter(Boolean).join("\n\n");
  if (rd.html) xhsBody += "\n\n" + stripTags(rd.html);
  return {
    title: title,
    summary: summary,
    sections: mapped,
    v3RawHtml: rd.html || "",
    v3ImageOrder: rd.imageOrder || [],
    v3CoverIndex: (typeof rd.coverIndex === "number") ? rd.coverIndex : -1,
    xhs: {
      titles: title ? [title] : [],
      body: xhsBody,
      coverText: (typeof rd.coverIndex === "number") ? ("封面 #" + rd.coverIndex) : "",
      hashtags: [],
      imageOrder: rd.imageOrder || []
    }
  };
}
