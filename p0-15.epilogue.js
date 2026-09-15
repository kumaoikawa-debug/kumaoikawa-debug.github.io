// P0-15 冒烟：重写招募 Fallback（无 AI 时只生成事实安全版本）
// 验收：
//   1) Fallback 不默认 专业领队 / 新手友好 / 路线成熟 / 轻装即可 / 风景绝美 / 安全放心
//   2) Fallback 内每一条事实都能在 confirmedFacts(活动字段) 找到来源——不凭空写现场事实/服务承诺
//   3) 有领队名时只写真实领队名，绝不补默认「专业领队」
//   4) 信息缺失(最小活动)时，Fallback 不臆造领队/保险/餐食/交通/装备/风景品质等
//   5) xfFitText 不产生 专业领队/路线成熟/门槛友好 等无依据断言

function mkAct(extra) {
  return Object.assign({
    id: "act-p15", title: "赵公山周末徒步", type: "徒步", place: "赵公山",
    date: "2026-10-02", dateMD: "10月2日", price: 168, days: 1, limit: 25, limitUnit: "人",
    difficulty: "中级", photos: []
  }, extra || {});
}
function allText(out) {
  var s = [];
  if (out.gzh) {
    s.push(out.gzh.title || "", out.gzh.subtitle || "", out.gzh.summary || "");
    (out.gzh.sections || []).forEach(function (x) { s.push((x.h || "") + " " + (x.html || "").replace(/<[^>]+>/g, " ")); });
    s.push(out.gzh.fee || "", out.gzh.service || "", out.gzh.cta || "");
  }
  if (out.xhs) { s.push(out.xhs.titles.join(" "), out.xhs.body, out.xhs.coverText); }
  if (out.moments) { s.push(out.moments.warm || "", out.moments.formal || "", out.moments.last || ""); }
  if (out.wechat) { s.push(out.wechat.recruit || "", out.wechat.brief || ""); }
  if (out.voice) { s.push(out.voice.s30 || "", out.voice.s60 || ""); }
  if (out.poster) { s.push(out.poster.title || "", out.poster.sub || "", out.poster.points.join(" ")); }
  return s.join("\n");
}

var BANNED = ["专业领队", "新手友好", "路线成熟", "轻装即可", "风景绝美", "安全放心"];
var checks = [];
function check(pass, name, detail) { checks.push({ name: name, pass: !!pass, detail: detail || "" }); }

// --- 无领队名：默认 6 类断言一律不得出现 ---
var a0 = mkAct({ leaderName: "", insurance: "" });
var m0 = buildContentMaster(a0, []);
var out0 = xfFallbackRecruit(a0, m0, {});
var t0 = allText(out0);
BANNED.forEach(function (w) {
  check(t0.indexOf(w) < 0, "Fallback 无默认断言：「" + w + "」", t0.indexOf(w) < 0 ? "absent" : "FOUND");
});

// --- 全字段活动：事实必须可溯源，且仍不出现默认断言 ---
var a1 = mkAct({
  leaderName: "王教练（8年）", insurance: "户外意外险", meal: "简餐", transport: "大巴往返",
  gear: ["登山杖", "头灯"], feeInclude: ["领队", "保险", "午餐", "车费"]
});
var m1 = buildContentMaster(a1, []);
var out1 = xfFallbackRecruit(a1, m1, {});
var t1 = allText(out1);
BANNED.forEach(function (w) {
  check(t1.indexOf(w) < 0, "全字段活动 Fallback 仍无默认断言：「" + w + "」", t1.indexOf(w) < 0 ? "absent" : "FOUND");
});
// 事实可溯源：价格/地点/强度/领队名/含项 必须出现在正文
check(t1.indexOf("168") >= 0, "Fallback 含费用(¥168)", "fee=" + out1.gzh.fee);
check(t1.indexOf("赵公山") >= 0, "Fallback 含地点(赵公山)", "place present");
check(t1.indexOf("中级") >= 0, "Fallback 含强度(中级)", "difficulty present");
check(t1.indexOf("王教练") >= 0, "Fallback 含真实领队名(王教练)", "leader present");
check(t1.indexOf("户外意外险") >= 0, "Fallback 含保险(已确认)", "insurance present");
check(t1.indexOf("大巴往返") >= 0, "Fallback 含交通(已确认)", "transport present");
check(t1.indexOf("登山杖") >= 0, "Fallback 含装备(已确认)", "gear present");

// --- 有领队名：只写真实名，绝不补默认「专业领队」 ---
check(t1.indexOf("专业领队") < 0, "有领队名时不补默认「专业领队」", "only real name used");
check(out1.gzh.sections.length >= 4, "Fallback 结构完整(gzh.sections>=4)", "n=" + out1.gzh.sections.length);

// --- 最小活动(仅标题)：不臆造任何服务/风景品质断言 ---
var aMin = mkAct({ place: "", date: "", price: "", days: 1, limit: "", difficulty: "", leaderName: "", insurance: "", meal: "", transport: "", gear: [], feeInclude: [] });
aMin.title = "测试活动"; delete aMin.place; delete aMin.date; delete aMin.price; delete aMin.difficulty;
var mMin = buildContentMaster(aMin, []);
var outMin = xfFallbackRecruit(aMin, mMin, {});
var tMin = allText(outMin);
// 这些「服务/品质」在无数据时不应凭空出现
["领队", "保险", "午餐", "晚餐", "大巴", "包车", "接送", "装备", "住宿", "路线成熟", "风景绝美", "专业领队"].forEach(function (w) {
  check(tMin.indexOf(w) < 0, "最小活动不臆造：「" + w + "」", tMin.indexOf(w) < 0 ? "absent" : "FOUND");
});

// --- xfFitText 不产生无依据断言 ---
var fit0 = xfFitText(a0, m0);
check(fit0.indexOf("专业领队") < 0 && fit0.indexOf("路线成熟") < 0 && fit0.indexOf("门槛友好") < 0,
  "xfFitText 无 专业领队/路线成熟/门槛友好", fit0);
var fit1 = xfFitText(a1, m1);
check(fit1.indexOf("专业领队") < 0 && fit1.indexOf("王教练") >= 0, "xfFitText 仅写真实领队名", fit1);

// --- 自定义 structure 路径同样事实安全 ---
var out2 = xfFallbackRecruit(a0, m0, { structure: ["为什么值得去", "来了怎么玩", "适不适合我", "真实信息", "怎么报名"], angle: "去山里透口气" });
var t2 = allText(out2);
BANNED.forEach(function (w) { check(t2.indexOf(w) < 0, "自定义structure Fallback 无「" + w + "」", t2.indexOf(w) < 0 ? "absent" : "FOUND"); });

var allPass = checks.every(function (c) { return c.pass; });
return { ok: allPass, total: checks.length, passed: checks.filter(function (c) { return c.pass; }).length, checks: checks };
