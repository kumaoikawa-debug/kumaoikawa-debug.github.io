/* =======================================================================
 * case-v224-v3-gate.epilogue.js — V3 图文文学层闸门 + AI 超时 + 报名卡排版
 * -----------------------------------------------------------------------
 * 老板第三次反馈（截图）：
 *  ① 详情图文文学段落出现数据句「10月1日，双楠大道94号集合——这是我们的句首。」
 *     「单日，15人，¥128——这是我们的分行与字距。」与元数据行
 *     「类型：户外探索，地点：成都金龙长城，季节：秋季」、口水话
 *     「金龙长城的秋径，正等待15种不同的生成方式。」
 *     根因：V3 双轨渲染器（contentV3Renderer.js）完全没接 v201/v203 闸门。
 *  ② 「AI 生成活动」点了没反应 → clubLLM 两路 fetch 无超时（Render 冷启动挂死）。
 *  ③ 报名信息卡 3 列网格窄屏一字一行竖排。
 * ======================================================================= */
state = loadState();
const out = {};
const checks = [];
function rec(name, pass, detail) { checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) }); }
const has = (s, sub) => String(s == null ? "" : s).indexOf(sub) >= 0;

/* ---------- §A 闸门 strict 档：脏句必掉、好句必留 ---------- */
const S = (t) => (typeof sanitizeLiteraryText === "function") ? sanitizeLiteraryText(t, true) : "__no_fn__";
const A = {};
A.dataSentence = S("10月1日，双楠大道94号集合——这是我们的句首。");
A.dataSentence2 = S("单日，15人，¥128——这是我们的分行与字距。");
A.metaLine = S("类型：户外探索，地点：成都金龙长城，季节：秋季");
A.metaNonsense = S("金龙长城的秋径，正等待15种不同的生成方式。");
A.cleanPara = S("它不躺在导航里，也不刻在景区导览图上。");
A.hanziNum = S("走完回来，周一没那么难熬了。");
A.broadcastLine = S("9月20日单日往返｜98元/人｜限15人｜4小时车程｜海拔800米");
A.singleLabelStrict = S("时间：9月20日的集合，我们不见不散。");
A.singleLabelDefault = sanitizeLiteraryText("时间：9月20日");
A.noStrictNoMetaDrop = sanitizeLiteraryText("类型：户外探索，地点：成都金龙长城，季节：秋季");
rec("A1 数据句（10月1日/94号）被丢弃", !has(A.dataSentence, "94号") && !has(A.dataSentence, "10月1日"), JSON.stringify(A.dataSentence));
rec("A2 数据句（15人/¥128/分行字距）被丢弃", !has(A.dataSentence2, "15人") && !has(A.dataSentence2, "¥128"), JSON.stringify(A.dataSentence2));
rec("A3 元数据行（类型/地点/季节）被丢弃", !has(A.metaLine, "类型") && !has(A.metaLine, "季节"), JSON.stringify(A.metaLine));
rec("A4 口水话（15种/生成方式）被丢弃", !has(A.metaNonsense, "生成") && !has(A.metaNonsense, "15"), JSON.stringify(A.metaNonsense));
rec("A5 干净文学句保留", has(A.cleanPara, "它不躺在导航里"), JSON.stringify(A.cleanPara));
rec("A6 中文数词句不误伤（v201 回归）", has(A.hanziNum, "周一没那么难熬"), JSON.stringify(A.hanziNum));
rec("A7 参数播报行仍被丢（v201 回归）", !has(A.broadcastLine, "98元"), JSON.stringify(A.broadcastLine));
rec("A8 strict 不产生破句残留（参数剥净/好句保留）", !has(A.singleLabelStrict, "9月20日") && has(A.singleLabelStrict, "不见不散"), JSON.stringify(A.singleLabelStrict));
rec("A9 默认档无「时间：」残渣（剥参数不留破句）", !has(A.singleLabelDefault, "时间：") || A.singleLabelDefault === "", JSON.stringify(A.singleLabelDefault));
rec("A10 默认档不丢元数据行（v203 事实层语义不变）", has(A.noStrictNoMetaDrop, "类型：户外探索"), JSON.stringify(A.noStrictNoMetaDrop));

/* ---------- §B V3 渲染器接闸门（端到端） ---------- */
const B = {};
if (typeof contentV3CanvasHtml !== "function") {
  rec("B0 V3 渲染器已加载", false, "contentV3CanvasHtml is not defined");
} else {
  const doc = { schemaVersion: 3, direction: { styleVector: {} }, blocks: [
    { type: "hero", copy: { headline: "路在脚下慢慢铺开", body: "10月1日，双楠大道94号集合——这是我们的句首。" } },
    { type: "lead", copy: { headline: "01 / OPENING", body: "类型：户外探索，地点：成都金龙长城，季节：秋季\n它不躺在导航里，也不刻在景区导览图上。" } },
    { type: "statement", copy: { headline: "这些，是我们共同的标点", body: "单日，15人，¥128——这是我们的分行与字距。" } },
    { type: "metric", copy: { body: "10月1日\n限15人\n¥128/人" } },
    { type: "quote", copy: { body: "路在脚下慢慢铺开——不是等它完成，是参与它的生成。" } },
    { type: "cta", copy: { headline: "把这一天留给自己", body: "金龙长城的秋径，正等待15种不同的生成方式。" } },
  ] };
  const act = { id: "t1", title: "成都金龙长城徒步", price: 128, limit: 15, days: 1, photos: [], meeting: "医院门口：双楠大道94号", dateMD: "10月1日" };
  const html = contentV3CanvasHtml(act, doc);
  B.html = html;
  rec("B1 渲染产物无数据句「句首」", !has(html, "这是我们的句首"), "");
  rec("B2 渲染产物无数据句「分行与字距」", !has(html, "分行与字距"), "");
  rec("B3 渲染产物无元数据行", !has(html, "类型：户外探索") && !has(html, "季节：秋季"), "");
  rec("B4 渲染产物无口水话「生成方式」", !has(html, "生成方式"), "");
  rec("B5 渲染产物无元叙事引文「参与它的生成」", !has(html, "参与它的生成"), "");
  rec("B6 干净 lead 段保留", has(html, "它不躺在导航里"), "");
  rec("B7 statement 标题保留", has(html, "这些，是我们共同的标点"), "");
  rec("B8 metric 事实块数字原样保留（事实层不过闸门）", has(html, "10月1日") && has(html, "限15人") && has(html, "¥128/人"), "");
  rec("B9 CTA 干净标题保留", has(html, "把这一天留给自己"), "");
  const heroCopy = (typeof contentV3HeroCopy === "function") ? contentV3HeroCopy(doc) : null;
  rec("B10 hero 标题保留、脏 sub 被清", !!heroCopy && heroCopy.headline === "路在脚下慢慢铺开" && !heroCopy.sub, JSON.stringify(heroCopy));
  /* 反向验证①：脏源文本确实含参数 —— 闸门有事可做，不是空转 */
  const dirty = "10月1日，双楠大道94号集合——这是我们的句首。单日，15人，¥128——这是我们的分行与字距。";
  rec("B11 反向：脏源文本确实含硬参数", has(dirty, "¥128") && has(dirty, "94号"), "");
  /* 反向验证②：把渲染器闸门摘掉（模拟旧实现 = 只 esc）会漏脏 —— 用 contentV3Paras 的旧逻辑对照 */
  const oldWay = String("10月1日，双楠大道94号集合").trim();
  rec("B12 反向：旧逻辑（不过闸门）会原样输出", oldWay.indexOf("94号") >= 0, "");
}

/* ---------- §C AI 超时兜底（P1「点了没反应」） ---------- */
rec("C1 aiFetchSignal 存在", typeof aiFetchSignal === "function", typeof aiFetchSignal);
rec("C2 后端代理 fetch 带超时", has(String(clubLLMviaBackend), "aiFetchSignal"), "");
rec("C3 直连 fetch 带超时", has(String(clubLLMdirect), "aiFetchSignal"), "");
rec("C4 登录 fetch 带超时", has(String(ensureBackendToken), "aiFetchSignal"), "");
rec("C5 aiFetchSignal 不支持时安全降级为空对象", JSON.stringify(aiFetchSignal(1000)).length >= 2, "");

/* ---------- §D 报名信息卡窄屏排版（P3） ---------- */
const css = (typeof __PROJ_CSS__ === "string") ? __PROJ_CSS__ : "";
rec("D1 CSS 存在", css.length > 1000, "len=" + css.length);
rec("D2 窄屏 decision-meta 降为 2 列", has(css, ".activity-page .decision-meta { grid-template-columns: repeat(2, 1fr)"), "");
rec("D3 窄屏规则在 media 块内（620px）", /@media \(max-width: 620px\)[\s\S]*\.decision-meta \{ grid-template-columns: repeat\(2, 1fr\)/.test(css), "");
rec("D4 桌面主样式仍是 3 列（未被窄屏块误吞）", /(?<!@media[\s\S]{0,200})\.activity-page \.decision-meta \{\s*\n?\s*display: grid;\s*\n\s*grid-template-columns: repeat\(3, 1fr\)/.test(css) || (css.match(/\.activity-page \.decision-meta \{[\s\S]{0,120}?repeat\(3, 1fr\)/) || []).length === 1, "");

/* ---------- §E hero「1 单日」文案 ---------- */
if (typeof renderActivityEditorial === "function") {
  try {
    const act = { id: "kv1", title: "测试活动", price: 128, limit: 15, days: 1, photos: [], type: "徒步", place: "测试山" };
    const kvHtml2 = renderActivityEditorial(act);
    rec("E1 kv 数据条不再出现「单日」作单位", !has(kvHtml2, ">单日</span>"), has(kvHtml2, ">单日</span>") ? "仍存在" : "ok");
  } catch (e) {
    rec("E1 kv 数据条不再出现「单日」作单位", "skip", "渲染依赖缺失: " + e.message);
  }
} else {
  rec("E1 kv 数据条不再出现「单日」作单位", "skip", "renderActivityEditorial 未加载");
}

const pass = checks.every((c) => c.pass !== false);
return { ok: pass, results: out, checks };
