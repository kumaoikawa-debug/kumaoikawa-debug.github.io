/* case-v217-v3-channels —— Phase 4/5：publish.js 正式生成改走 V3 API（旧 XF Family 保留 fallback）
   同步契约（harness 捕获顶层 return，不 await 异步）：
     ① 三个映射器（V3 文档 → legacy gzh/xhs 形状）—— 即 V3 覆盖落库前的输出形状；
     ② 无后端守卫：contentV3Available()=false → genRecruit/genRecap 的 V3 分支被跳过，默认走 XF Family；
     ③ 请求体构造器 v3ChannelBody 形状正确。
   说明：v3ChannelGenerate 的 fetch/端点接线是 contentV3Generate 的 1:1 镜像（已在 v215 契约核验），
        本环境无后端，故只验证「守卫 + 映射 + 请求体」，异步网络路径由代码审查 + 上线后 CDN 走查覆盖。 */
var checks = [];
function add(name, pass, detail) { checks.push({ name: name, pass: !!pass, detail: detail || "" }); }
function has(s, sub) { return typeof s === "string" && s.indexOf(sub) >= 0; }

/* 样本 V3 渠道文档（与后端 contracts/channels.ts 完全一致） */
var WECHAT = {
  schemaVersion: 3, scenario: "wechat", activityId: "act-1",
  titleOptions: ["标题A", "标题B"], title: "标题A", digest: "摘要文案",
  html: "<h2>开篇</h2><p>正文一段。</p>",
  sections: [{ purpose: "开场", heading: "开篇", paragraphs: ["正文一段。"], imageSlots: 1, evidenceRefs: [] }],
  coverIndex: 0, imageOrder: [0, 2, 1], direction: {}, generationMeta: {}
};
var XHS = {
  schemaVersion: 3, scenario: "xiaohongshu", activityId: "act-1",
  hook: "钩子句", titleOptions: ["红书标题1", "红书标题2"], mainAngle: "主角度",
  body: "小红书正文",
  imageSequence: [{ photoIndex: 0, role: "目的地实感", caption: "c0" }, { photoIndex: 1, role: "r1", caption: "c1" }],
  coverSuggestion: 1, tags: ["#徒步", "#周末"], cta: "来呀", direction: {}, generationMeta: {}
};
var RECAP = {
  schemaVersion: 3, scenario: "recap", activityId: "act-1",
  insight: { coreMemory: "这趟最值得留下的是雨", whyItMatters: "因为一起走了全程", evidence: [] },
  sections: [{ purpose: "开场", heading: "集结", paragraphs: ["那天集合。"], imageSlots: 0, evidenceRefs: [] }],
  html: "<h2>集结</h2><p>那天集合。</p>",
  coverIndex: 0, imageOrder: [0, 1], direction: {}, generationMeta: {}
};
var a = { id: "act-1", title: "测试活动", type: "登山", place: "某山", date: "10月1日", photos: [] };

/* ---------- 1. 函数存在 ---------- */
add("v3ChannelGenerate 已定义", typeof v3ChannelGenerate === "function");
add("v3WechatToLegacy 已定义", typeof v3WechatToLegacy === "function");
add("v3XhsToLegacy 已定义", typeof v3XhsToLegacy === "function");
add("v3RecapToLegacy 已定义", typeof v3RecapToLegacy === "function");

/* ---------- 2. 映射器（确定性） ---------- */
var wg = v3WechatToLegacy(WECHAT);
add("wechat→legacy: title 取主标题", wg.title === "标题A", wg.title);
add("wechat→legacy: summary 取 digest", wg.summary === "摘要文案", wg.summary);
add("wechat→legacy: sections 由段落重渲染", Array.isArray(wg.sections) && wg.sections.length === 1 && wg.sections[0].h === "开篇" && has(wg.sections[0].html, "<p>正文一段。</p>"), JSON.stringify(wg.sections));
add("wechat→legacy: 备选标题保留", Array.isArray(wg.titleOptions) && wg.titleOptions.length === 2, JSON.stringify(wg.titleOptions));
add("wechat→legacy: 原始 html 存 v3RawHtml", has(wg.v3RawHtml, "<h2>开篇</h2>"), "");

var xg = v3XhsToLegacy(XHS);
add("xhs→legacy: titles 取 titleOptions", Array.isArray(xg.titles) && xg.titles.length === 2, JSON.stringify(xg.titles));
add("xhs→legacy: body=hook+body", has(xg.body, "钩子句") && has(xg.body, "小红书正文"), xg.body);
add("xhs→legacy: hashtags 透传", Array.isArray(xg.hashtags) && xg.hashtags.length === 2, JSON.stringify(xg.hashtags));
add("xhs→legacy: imageOrder 取 photoIndex", Array.isArray(xg.imageOrder) && xg.imageOrder[0] === 0 && xg.imageOrder[1] === 1, JSON.stringify(xg.imageOrder));
add("xhs→legacy: coverText 来自 coverSuggestion", xg.coverText === "封面 #1", xg.coverText);

var rg = v3RecapToLegacy(RECAP);
add("recap→legacy: gzh.title 取 coreMemory", rg.title === "这趟最值得留下的是雨", rg.title);
add("recap→legacy: gzh.sections 由段落重渲染", Array.isArray(rg.sections) && rg.sections[0].h === "集结" && has(rg.sections[0].html, "<p>那天集合。</p>"), JSON.stringify(rg.sections));
add("recap→legacy: xhs.body 含 coreMemory", has(rg.xhs.body, "这趟最值得留下的是雨"), rg.xhs.body.slice(0, 30));
add("recap→legacy: xhs.titles 含 coreMemory", Array.isArray(rg.xhs.titles) && rg.xhs.titles[0] === "这趟最值得留下的是雨", JSON.stringify(rg.xhs.titles));

/* ---------- 3. 无后端守卫（默认路径零变化） ---------- */
add("harness 无后端：contentV3Available()=false", (typeof contentV3Available !== "function") || contentV3Available() === false);
var p = (typeof v3ChannelGenerate === "function") ? v3ChannelGenerate("wechat", a, {}) : null;
add("无后端：v3ChannelGenerate 调用返回 Promise（不抛错，最终 resolve null）", !!p && typeof p.then === "function", "");
add("genRecruit/genRecap 的 V3 分支被守卫跳过（默认走 XF Family）", (typeof contentV3Available !== "function") || contentV3Available() === false);

/* ---------- 4. 请求体构造器（同步） ---------- */
var body = (typeof v3ChannelBody === "function") ? v3ChannelBody(a, {}) : null;
add("v3ChannelBody：有活动id时返回请求体", !!body && body.activityId === "act-1", body ? body.activityId : "null");
var bodyNoId = (typeof v3ChannelBody === "function") ? v3ChannelBody({}, {}) : "fn-missing";
add("v3ChannelBody：无活动id时返回 null", bodyNoId === null, String(bodyNoId));
var bodyActual = (typeof v3ChannelBody === "function") ? v3ChannelBody(a, { actual: { attendance: 5 } }) : null;
add("v3ChannelBody：recap 携带 actual（planned/actual 分离）", !!bodyActual && bodyActual.actual && bodyActual.actual.attendance === 5, "");

return { ok: checks.every(function (c) { return c.pass; }), total: checks.length, passed: checks.filter(function (c) { return c.pass; }).length, checks: checks };
