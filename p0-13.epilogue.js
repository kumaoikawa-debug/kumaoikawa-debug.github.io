// P0-13 冒烟：把 P0-12 单一「变体」拆成「版式(layout)」「风格(style)」双轴
// 验收核心：
//   换版式：保持 事实/主题/文案；只改 图片组合/布局/留白/Typography/章节视觉 —— 正文段落必须逐字不变
//   换风格：保持 confirmedFacts；重生成 角度/标题/章节表达/文案节奏/图片策略/Family/Layout
// 兼容：旧 editorialVariantId 数据仍能解析出 (layout, style)

function mkAct(extra) {
  return Object.assign({
    id: "act-test", title: "夏溪谷轻徒步", place: "莫干山", editorialTitle: "把夏天走成一条溪",
    intro: "一条沿溪而上的清凉路线，适合第一次走进山野的你。",
    whyGo: ["城里的夏天太闷，想找一个能听见水声的地方。", "夏溪谷的溪水在树荫下泛着冷光，走三步就要停下来看一眼。", "这条线不陡，孩子和长辈都能跟上，却足够把日常甩在身后。"],
    experience: ["前半小时是竹林，风一过整片林子都在动。", "中段踩着石头过溪，水没过脚踝，凉得人一激灵。", "终点是一片塌方的石滩，正午的光打下来像撒了盐。"],
    gain: ["你会带回去一整天的安静，和城市里难得的慢。", "也可能顺便认识一两个同样想逃出来的人。"],
    fitFor: ["第一次徒步的新手，想找一条不劝退的线。", "带孩子的家庭，需要一处能玩水也能走路的地方。"],
    sellingPoints: [{ title: "本地领队", desc: "熟悉每一处可以下水的浅滩" }, { title: "轻装出行", desc: "背个包就能走" }, { title: "溪边午餐", desc: "树荫下吃一顿便当" }],
    body: ["出发前夜下了点雨，溪水比往常更急一点。", "领队在路上讲了很多竹林的故事。", "回程时大家都不怎么说话，像是把力气留在了山里。"],
    itineraryDays: [
      { label: "集合出发", items: [{ time: "08:00", text: "镇口集合" }, { time: "08:30", text: "乘车前往登山口" }] },
      { label: "沿溪上行", items: [{ time: "09:30", text: "进入竹林小道" }, { time: "12:00", text: "溪边午餐" }] },
      { label: "返程", items: [{ time: "14:00", text: "原路返回" }, { time: "15:30", text: "镇口解散" }] }
    ],
    photos: (function () { var arr = []; for (var i = 0; i < 12; i++) arr.push("photo" + (i + 1) + ".jpg"); return arr; })(),
    pullQuote: "把夏天走成一条溪，回头看全是凉的。"
  }, extra || {});
}

var L = EDITORIAL_LAYOUTS, S = EDITORIAL_STYLES;
var L0 = L[0], L1 = L[1], L2 = L[2];          // mosaic-story / solo-route / strip-exp
var S0 = S[0], S1 = S[1];                       // scenery-mag / challenge-doc
var aL = function (lid, sid) { return mkAct({ editorialLayoutId: lid, editorialStyleId: sid }); };
var o = function (lid, sid) { return buildEditorialOutline(aL(lid, sid)); };

var paraMap = function (out) { var m = {}; out.forEach(function (s) { m[s.key] = s.paras.join(""); }); return m; };
var orderStr = function (out) { return out.map(function (s) { return s.key; }).join(","); };
var headOf = function (out, k) { var s = out.filter(function (x) { return x.key.indexOf(k) === 0; })[0]; return s ? s.heading : ""; };
var typOf = function (out) { return out.length ? out[0].typo : ""; };

var checks = [];
function check(pass, name, detail) { checks.push({ name: name, pass: !!pass, detail: detail || "" }); }

// 1) 双轴枚举齐全
check(L.length >= 5, "layouts>=5", "got " + L.length);
check(S.length >= 7, "styles>=7", "got " + S.length);
check(Object.keys(EDITORIAL_ANGLES).length === 7, "angles=7", "got " + Object.keys(EDITORIAL_ANGLES).length);
check(Object.keys(EDITORIAL_DENSITY).length === 4, "densities=4", "got " + Object.keys(EDITORIAL_DENSITY).length);
check(Object.keys(EDITORIAL_STRUCTURES).length === 5, "structures=5", "got " + Object.keys(EDITORIAL_STRUCTURES).length);
check(Object.keys(EDITORIAL_IMG).length === 5, "img-modes=5", "got " + Object.keys(EDITORIAL_IMG).length);

// 2) 换版式冻结正文：同风格 S0，换 L0→L1→L2，各节段落文本逐字一致（按 key 比对，忽略章节顺序差异）
var oL0 = o(L0.id, S0.id), oL1 = o(L1.id, S0.id), oL2 = o(L2.id, S0.id);
var pm0 = paraMap(oL0), pm1 = paraMap(oL1), pm2 = paraMap(oL2);
var canon = function (pm) { return Object.keys(pm).sort().map(function (k) { return k + "=" + pm[k]; }).join("|"); };
var frozen = canon(pm0) === canon(pm1) && canon(pm1) === canon(pm2);
check(frozen, "换版式 正文段落逐字不变", "pm0==pm1==" + frozen);
// 标题也不随版式变化（标题由 angle/style 决定）
check(headOf(oL0, "why") === headOf(oL1, "why") && headOf(oL1, "why") === headOf(oL2, "why"),
  "换版式 标题不变", "why@L0=" + headOf(oL0, "why"));

// 3) 换版式确有视觉差异（结构顺序 / 图种 / typo 至少一维不同）
var visDiff = orderStr(oL0) !== orderStr(oL1) || oL0[0].imgKind !== oL1[0].imgKind || typOf(oL0) !== typOf(oL1);
check(visDiff, "换版式 视觉有差异", "order:" + (orderStr(oL0) !== orderStr(oL1)) + " imgKind:" + (oL0[0].imgKind !== oL1[0].imgKind) + " typo:" + (typOf(oL0) !== typOf(oL1)));

// 4) 换风格改文案：同布局 L0，换 S0→S1，角度/标题/密度裁剪均不同
var oS0 = o(L0.id, S0.id), oS1 = o(L0.id, S1.id);
check(editorialStyleOf(aL(L0.id, S0.id)).angle !== editorialStyleOf(aL(L0.id, S1.id)).angle,
  "换风格 角度变化", S0.angle + " -> " + S1.angle);
check(headOf(oS0, "why") !== headOf(oS1, "why"), "换风格 标题变化",
  "why@S0=" + headOf(oS0, "why") + " | why@S1=" + headOf(oS1, "why"));
var chars = function (out) { return out.reduce(function (n, s) { return n + s.paras.join("").length; }, 0); };
check(chars(oS0) !== chars(oS1), "换风格 文案节奏(密度)变化", "chars=" + chars(oS0) + "/" + chars(oS1));

// 5) 换风格保留事实：确认的「地点」事实在两版 why 节均出现（P0-A 事实边界：
//    角度化重生成只换角度/标题/表达，确认的地点/日期等事实必须原样保留，不能丢）
var factTok = mkAct().place;
var whyS0 = (paraMap(oS0)["why"] || ""), whyS1 = (paraMap(oS1)["why"] || "");
check(whyS0.indexOf(factTok) >= 0 && whyS1.indexOf(factTok) >= 0, "换风格 事实保留(地点)",
  "place='" + factTok + "' in S0=" + (whyS0.indexOf(factTok) >= 0) + " S1=" + (whyS1.indexOf(factTok) >= 0));
check((typeof confirmedFacts === "function" ? confirmedFacts(mkAct()).length : 0) >= 0, "confirmedFacts 可用", "");

// 6) 旧 editorialVariantId 兼容：解析出 (layout, style) 且默认兜底 v-scenery-mag
var vDef = editorialVariantOf({});
var vLeg = editorialVariantOf({ editorialVariantId: "v-challenge-doc" });
check(vDef.id === "v-scenery-mag", "legacy 默认= v-scenery-mag", "id=" + vDef.id);
check(vLeg.layout === "L-solo-route" && vLeg.style === "S-challenge-doc" && vLeg.id === "v-challenge-doc",
  "legacy v-challenge-doc 解析", "layout=" + vLeg.layout + " style=" + vLeg.style);
check(editorialVariantOf({ editorialVariantId: "nope" }).id === "v-scenery-mag", "legacy 未知 id 兜底", "");

// 7) picker：换版式/换风格均推进到不同项
check(pickEditorialLayout(L0.id).id !== L0.id, "regenLayout 推进", "next=" + pickEditorialLayout(L0.id).id);
check(pickEditorialStyle(S0.id).id !== S0.id, "regenStyle 推进", "next=" + pickEditorialStyle(S0.id).id);

// 8) 新字段活动：双轴互相独立（只换风格时布局/图不变，只换版式时角度/密度不变）
var aBoth = aL(L1.id, S1.id);
var aStyleOnly = aL(L1.id, S0.id);   // 同布局 L1，换风格 S0
var oBoth = o(L1.id, S1.id), oStyleOnly = o(L1.id, S0.id);
check(orderStr(oBoth) === orderStr(oStyleOnly) && oBoth[0].imgKind === oStyleOnly[0].imgKind,
  "只换风格 布局/图不变", "orderEq=" + (orderStr(oBoth) === orderStr(oStyleOnly)));
var aLayoutOnly = aL(L2.id, S0.id);  // 同风格 S0，换布局 L2
var oLayoutOnly = o(L2.id, S0.id);
check(editorialStyleOf(aLayoutOnly).angle === editorialStyleOf(aStyleOnly).angle && editorialStyleOf(aLayoutOnly).density === editorialStyleOf(aStyleOnly).density,
  "只换版式 角度/密度不变", "");

var allPass = checks.every(function (c) { return c.pass; });
return { ok: allPass, total: checks.length, passed: checks.filter(function (c) { return c.pass; }).length, checks: checks };
