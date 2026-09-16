// v190 验收：① 老板过目卡「AI 预填 + 零输入可生成」 ② 图文页图片按真实比例出图（不再左右留白）
// ⚠️ 夹具契约：本文件被包进 async 函数体，必须「裸顶层 return」返回；顶层需含 ok:false 才判失败。
state = (typeof initState === "function") ? initState() : ((typeof loadState === "function") ? loadState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
const dbg = {};

try {
  /* ============ 一、事实建议引擎 ============ */
  state.activities = [];
  state.history = [
    { id: "h1", type: "徒步", meeting: "成都·太平园地铁站 A 口", meetTime: "08:00", price: 80, limit: 20, feeInclude: ["专业领队", "户外保险"], route: "彭州小鱼洞—中坝森林环线", leaderName: "老王", ageRange: "8-60岁" },
    { id: "h2", type: "徒步", meeting: "成都·太平园地铁站 A 口", meetTime: "08:00", price: 100, limit: 20, feeInclude: ["专业领队", "户外保险"], route: "都江堰—青城后山", leaderName: "老王", ageRange: "8-60岁" },
  ];
  state.brand = Object.assign({}, state.brand, { phone: "13800001111", address: "" });

  // 老板只说了这一句
  const a = { id: "v190a", raw: "这周六带大家去彭州徒步", type: "徒步", place: "彭州", photos: [] };

  const sMeet = (typeof factSuggestionFor === "function") ? factSuggestionFor(a, "meeting") : null;
  add("建议·集合地点取自历史活动众数", !!sMeet && sMeet.value === "成都·太平园地铁站 A 口" && sMeet.src === "history", JSON.stringify(sMeet));
  const sTime = factSuggestionFor(a, "meetTime");
  add("建议·集合时间取自历史活动", !!sTime && sTime.value === "08:00", JSON.stringify(sTime));
  const sPrice = factSuggestionFor(a, "price");
  add("建议·价格=历史均价(80/100→90)", !!sPrice && sPrice.value === "90" && sPrice.src === "history", JSON.stringify(sPrice));
  const sSvc = factSuggestionFor(a, "services");
  add("建议·费用包含复用历史配置", !!sSvc && /领队/.test(sSvc.value) && /保险/.test(sSvc.value), JSON.stringify(sSvc));
  const sDate = factSuggestionFor(a, "date");
  add("建议·日期从「这周六」解析成具体日期", !!sDate && /\d{1,2}月\d{1,2}日/.test(sDate.value), JSON.stringify(sDate));
  const sContact = factSuggestionFor(a, "contact");
  add("建议·联系方式取品牌资料", !!sContact && sContact.value === "13800001111" && sContact.src === "brand", JSON.stringify(sContact));
  const sRoute = factSuggestionFor(a, "route");
  add("建议·路线无法推断时给候选而不是空白表单", !!sRoute && (sRoute.chips || []).length >= 2, JSON.stringify(sRoute));

  const gaps = detectKeyGaps(a);
  add("过目卡·每一项缺口都带 suggestion 字段", gaps.length > 0 && gaps.every((g) => "suggest" in g), "gaps=" + gaps.length);
  const pre = gaps.filter((g) => g.suggest && g.suggest.value).length;
  add("过目卡·多数缺口已自动预填（≥60%）", pre >= Math.ceil(gaps.length * 0.6), pre + "/" + gaps.length);

  /* 零输入一键生成：老板什么都不填 */
  const a2 = { id: "v190b", raw: "这周六带大家去彭州徒步", type: "徒步", place: "彭州", photos: [] };
  const applied = (typeof applyAllSuggestions === "function") ? applyAllSuggestions(a2, true) : [];
  add("一键生成·applyAllSuggestions 真的写回了事实", applied.length >= 5, applied.join(","));
  add("一键生成·集合点/时间/日期/价格/费用包含均已非空",
    !!a2.meeting && !!a2.meetTime && !!a2.date && a2.price != null && (a2.feeInclude || []).length > 0,
    JSON.stringify({ meeting: a2.meeting, meetTime: a2.meetTime, date: a2.date, price: a2.price, fee: a2.feeInclude }));
  add("一键生成·费用包含已归类为结构化标志（领队/保险）", a2.includeLeader === true && a2.includeInsurance === true, String([a2.includeLeader, a2.includeInsurance]));
  const chk = (typeof runPublishCheck === "function") ? runPublishCheck(a2) : { blocking: [] };
  const stillMissing = (chk.blocking || []).join("|");
  add("一键生成·发布阻断里不再出现「缺少关键事实：集合/时间/价格/日期」",
    !/集合地点|集合时间|活动价格|活动日期|费用包含/.test(stillMissing), stillMissing);
  add("一键生成·只有路线（系统无法替你决定）仍需老板补", /路线/.test(stillMissing), stillMissing);

  /* 无历史时的降级：给候选 chips，而不是干等老板打字 */
  state.history = []; state.activities = [];
  const a3 = { id: "v190c", raw: "城市周边走走", type: "徒步", place: "成都", photos: [] };
  const p3 = factSuggestionFor(a3, "price"), m3 = factSuggestionFor(a3, "meeting");
  add("无历史·价格给候选 chips", !!p3 && (p3.chips || []).length >= 3 && !p3.value, JSON.stringify(p3));
  add("无历史·集合点给候选 chips", !!m3 && (m3.chips || []).length >= 2, JSON.stringify(m3));

  /* ============ 二、图片按真实比例出图 ============ */
  const P_V = "v190://portrait-3x4.jpg";
  const P_L = "v190://landscape-3x2.jpg";
  const P_X = "v190://extreme-1x3.jpg";
  const P_W = "v190://wide-3x1.jpg";
  const BASE = { x: 50, y: 40, safe_text_area: "top-right", recommended_use: ["story"], category: "人物/动态", emotion: "真实", subjects: ["人物"], quality_score: 0.82, simulated: false };
  if (typeof applyVision === "function") {
    applyVision(P_V, Object.assign({}, BASE, { ratio: 0.667, orientation: "portrait", skinRatio: 0.3 }));
    applyVision(P_L, Object.assign({}, BASE, { ratio: 1.5, orientation: "landscape", skinRatio: 0 }));
    applyVision(P_X, Object.assign({}, BASE, { ratio: 0.33, orientation: "portrait" }));
    applyVision(P_W, Object.assign({}, BASE, { ratio: 3.0, orientation: "landscape", skinRatio: 0 }));
  }

  add("比例·照片分析结果里已带真实宽高比", !!(typeof photoMeta === "function" && photoMeta(P_V) && photoMeta(P_V).ratio === 0.667), JSON.stringify(typeof photoMeta === "function" ? photoMeta(P_V) : null));
  add("比例·竖图 figAspect = 真实比例 0.667（不再是固定高度容器）",
    typeof figAspect === "function" && Math.abs(figAspect(P_V) - 0.667) < 0.01, String(typeof figAspect === "function" ? figAspect(P_V) : "n/a"));
  add("比例·横图 figAspect = 1.5", Math.abs(figAspect(P_L) - 1.5) < 0.01, String(figAspect(P_L)));
  add("比例·极端竖图收敛到 0.62（避免超长留白）", Math.abs(figAspect(P_X) - 0.62) < 0.001, String(figAspect(P_X)));
  add("比例·超宽图收敛到 2.6", Math.abs(figAspect(P_W) - 2.6) < 0.001, String(figAspect(P_W)));
  add("比例·未分析图给中性比例 1.36（不会先拉成扁条）", Math.abs(figAspect("v190://none.jpg") - 1.36) < 0.001, String(figAspect("v190://none.jpg")));

  /* 反向验证：把分析结果抽掉，比例必须随之退化 —— 证明断言确实依赖真实比例而不是写死的常量 */
  const savedV = (typeof PHOTO_FOCUS_CACHE !== "undefined") ? PHOTO_FOCUS_CACHE.get(P_V) : null;
  if (typeof PHOTO_FOCUS_CACHE !== "undefined") PHOTO_FOCUS_CACHE.delete(P_V);
  const afterDel = figAspect(P_V);
  if (savedV) PHOTO_FOCUS_CACHE.set(P_V, savedV);
  add("★反向验证·抽掉图片比例后 figAspect 从 0.667 退化为 1.36（断言真的在读数据）",
    Math.abs(afterDel - 0.667) > 0.01 && Math.abs(afterDel - 1.36) < 0.001, String(afterDel));

  const af = { id: "v190p", type: "徒步", place: "成都", date: "10月18日", price: 80, limit: 20, limitUnit: "人", difficulty: "适中", photos: [P_V, P_L, P_X] };
  const fig0 = (typeof xhFig === "function") ? xhFig(af, 0, "") : "";
  add("出图·竖图 figure 带真实比例变量 --ar 与自动回填标记",
    /--ar:\s*0\.667/.test(fig0) && /data-ar-auto/.test(fig0), fig0.slice(0, 200));
  add("出图·竖图打上 s-tall 形状类（供版式差异化）", /s-tall/.test(fig0), fig0.slice(0, 120));
  add("出图·figure 内不再出现任何固定高度内联样式（旧 bug 根因）", !/height:\s*\d+px/.test(fig0), "");

  /* contain 与比例收敛的边界：容器比例 ≠ 图片比例时绝不允许 contain —— 那正是「左右米色留白」的来源 */
  const realContain = pagePhotoContain;
  pagePhotoContain = function () { return true; };
  const figP = xhFig(af, 0, ""); // 竖图 3:4（比例未收敛）
  const figX = xhFig(af, 2, ""); // 极端竖图 1:3（比例被收敛到 0.62）
  pagePhotoContain = realContain;
  add("出图·真实比例的高风险人物图允许 contain（容器等比例 → 不会留白）",
    /ph-safe/.test(figP) && /object-fit:contain/.test(figP) && /--ar:\s*0\.667/.test(figP), figP.slice(0, 170));
  /* ★ v193 P0-B 取代旧契约：旧做法是「比例被 clamp → 禁用 contain → 退回 cover」，
     代价是必须裁掉主体（老板反馈的「图片处理很差」根因之一）。
     P0-B 改为「需要原比例时不 clamp 比例」，容器比例直接等于图片真实比例 →
     既不裁切、也不产生留白色带，因此不再需要用 cover 去「填满」。 */
  add("出图·★需原比例的极端长图：容器比例 = 图片真实比例（不 clamp）且 contain（不裁切·不露留白）",
    /ph-safe/.test(figX) && /object-fit:contain/.test(figX) && /--ar:\s*0\.33/.test(figX), figX.slice(0, 200));

  let pageHtml = "";
  try { pageHtml = (typeof renderActivityEditorial === "function") ? renderActivityEditorial(af) : ""; } catch (e) { pageHtml = ""; }
  add("出图·整页图文渲染成功", pageHtml.length > 800, "len=" + pageHtml.length);
  add("出图·整页使用了 --ar 比例变量（图片容器等比例）", (pageHtml.match(/--ar:/g) || []).length >= 1, "count=" + (pageHtml.match(/--ar:/g) || []).length);
  add("出图·整页不再出现旧的固定高度 280/190/150px 内联高度", !/height:\s*(280|190|150)px/.test(pageHtml), "");

  dbg.gaps = gaps.map((g) => g.key + "=" + (g.suggest && g.suggest.value ? "AI" : "手动"));
  dbg.applied = applied;
  dbg.aspects = { P_V: figAspect(P_V), P_L: figAspect(P_L), P_X: figAspect(P_X), P_W: figAspect(P_W) };
} catch (e) {
  add("验收脚本执行未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  total: checks.length,
  passed: checks.length - failed.length,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  dbg: dbg,
  checks,
};
