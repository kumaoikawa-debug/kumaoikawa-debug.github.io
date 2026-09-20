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
 *  - 预览：三个渠道文档形状不同 —— xiaohongshu 用 hook/body/tags/imageSequence；
 *    recap 有 sections[]；**wechat 没有 sections（正文全在 html，已带 inline style）**，
 *    故各映射器的 sections 分支会在缺失时回退为「整篇 html 单段」。
 *    doc.html 另存 v3RawHtml / v3Raw，供「复制粘贴进公众号后台」使用。
 *
 * 依赖（由 contentV3.js 提供，扁平 classic script 共享顶层作用域，本文件须在其后加载）：
 *  contentV3Available / contentV3ApiBase / contentV3AuthHeader / clearBackendToken /
 *  contentV3ActivityPayload / contentV3PlanFactsPayload / contentV3PhotoPayload
 * 另用全局 esc / stripTags（core.js / publish.js 提供）。
 * ========================================================================== */

/* legacy actualActivityData 形状 → 后端 ActualActivityData 契约
   ----------------------------------------------------------------------------
   ★2026-09-20 修复的真缺陷：后端 recap 契约字段是
     { attendance, weather, actualRoute, highlights[], feedbacks[], onSiteNotes[] }，
     而前端 extractActualActivityData() 产出的是
     { actualParticipants, actualWeather, actualHighlights[], actualFeedback[], ... }，
     两边**字段名零交集** → 后端永远读不到现场素材 → 回顾渠道恒定「无现场素材」诚实空态
     （用户填了实际人数/天气/亮点也无效，且不报错）。
   硬规则：attendance 只取「实到」(actualParticipants)，**绝不用报名数顶替**（P0-6）；
          无任何现场素材时返回 null，让请求不带 actual（保持后端诚实空态）。 */
function v3ActualPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;
  /* 已是后端契约形状（未来或其它调用方直传）→ 原样使用 */
  if (raw.highlights || raw.feedbacks || raw.onSiteNotes || raw.attendance != null || raw.weather != null) return raw;
  var str = function (x) {
    if (x == null) return '';
    return (Array.isArray(x) ? x.filter(Boolean).join('；') : String(x)).trim();
  };
  var arr = function (x) {
    if (Array.isArray(x)) return x.filter(Boolean).map(function (y) { return String(y).trim(); }).filter(Boolean);
    var t = str(x);
    return t ? t.split(/[；;\n]/).map(function (y) { return y.trim(); }).filter(Boolean) : [];
  };
  var out = {};
  /* 实到人数：只有用户明确确认过才带；缺失即不写（后端 attendance?: number） */
  var n = raw.actualParticipants;
  if (n != null && n !== '' && !isNaN(+n) && +n > 0) out.attendance = +n;
  var w = str(raw.actualWeather);
  if (w) out.weather = w.slice(0, 60);
  var rt = str(raw.actualRouteChange);
  if (rt) out.actualRoute = rt.slice(0, 120);
  var hl = arr(raw.actualHighlights);
  if (hl.length) out.highlights = hl.slice(0, 8);
  var fb = arr(raw.actualFeedback);
  if (fb.length) out.feedbacks = fb.slice(0, 8);
  var notes = arr(raw.memorableMoments);
  if (str(raw.completionSummary)) notes.push(str(raw.completionSummary).slice(0, 200));
  if (str(raw.providedNotes)) notes.push(str(raw.providedNotes).slice(0, 300));
  if (notes.length) out.onSiteNotes = notes.slice(0, 10);
  var hasAny = out.highlights || out.feedbacks || out.onSiteNotes ||
    out.attendance != null || out.weather || out.actualRoute;
  return hasAny ? out : null;
}

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
  if (opts.actual) {
    var ap = v3ActualPayload(opts.actual);
    if (ap) body.actual = ap;
  }
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

/* WechatDocument → legacy gzh 形状。
   ★后端 wechat 文档没有 sections 字段（正文全在 html），因此实际走 mapped 的兜底分支；
   预览直接渲染 html（自带 inline style），v3RawHtml 供「复制进公众号后台」。 */
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
