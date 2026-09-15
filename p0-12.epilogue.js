// P0-12 冒烟：同一活动按不同「变体」生成不同 angle/structure/img/density 的图文长页
// 验收核心：同一活动连续生成 3 版，四维度（内容角度/页面结构/图片结构/文案密度）不能只是背景色和标题变化。

function mkAct(extra) {
  return Object.assign({
    id: "act-test",
    title: "夏溪谷轻徒步",
    place: "莫干山",
    editorialTitle: "把夏天走成一条溪",
    intro: "一条沿溪而上的清凉路线，适合第一次走进山野的你。",
    whyGo: [
      "城里的夏天太闷，想找一个能听见水声的地方。",
      "夏溪谷的溪水在树荫下泛着冷光，走三步就要停下来看一眼。",
      "这条线不陡，孩子和长辈都能跟上，却足够把日常甩在身后。"
    ],
    experience: [
      "前半小时是竹林，风一过整片林子都在动。",
      "中段踩着石头过溪，水没过脚踝，凉得人一激灵。",
      "终点是一片塌方的石滩，正午的光打下来像撒了盐。"
    ],
    gain: [
      "你会带回去一整天的安静，和城市里难得的慢。",
      "也可能顺便认识一两个同样想逃出来的人。"
    ],
    fitFor: [
      "第一次徒步的新手，想找一条不劝退的线。",
      "带孩子的家庭，需要一处能玩水也能走路的地方。"
    ],
    sellingPoints: [
      { title: "本地领队", desc: "熟悉每一处可以下水的浅滩" },
      { title: "轻装出行", desc: "无需重装，背个包就能走" },
      { title: "溪边午餐", desc: "在树荫下吃一顿带着水汽的便当" }
    ],
    body: [
      "出发前夜下了点雨，溪水比往常更急一点。",
      "领队在路上讲了很多关于这片竹林的故事。",
      "回程时大家都不怎么说话，像是把力气留在了山里。"
    ],
    itineraryDays: [
      { label: "集合出发", items: [
        { time: "08:00", text: "镇口集合，分发装备" },
        { time: "08:30", text: "乘车前往登山口" }
      ] },
      { label: "沿溪上行", items: [
        { time: "09:30", text: "进入竹林小道" },
        { time: "10:30", text: "第一段涉溪" },
        { time: "12:00", text: "溪边午餐" }
      ] },
      { label: "返程", items: [
        { time: "14:00", text: "原路返回" },
        { time: "15:30", text: "镇口解散" }
      ] }
    ],
    photos: (function () { var arr = []; for (var i = 0; i < 12; i++) arr.push("photo" + (i + 1) + ".jpg"); return arr; })(),
    pullQuote: "把夏天走成一条溪，回头看全是凉的。"
  }, extra || {});
}

var V = EDITORIAL_VARIANTS;
var v0 = V[0], v1 = V[1], v2 = V[2]; // scenery-mag / challenge-doc / companion-album
var a = mkAct();
var o0 = buildEditorialOutline(a, v0);
var o1 = buildEditorialOutline(a, v1);
var o2 = buildEditorialOutline(a, v2);

var ord = function (o) { return o.map(function (s) { return s.key; }).join(","); };
var headOf = function (o, k) { var s = o.filter(function (x) { return x.key.indexOf(k) === 0; })[0]; return s ? s.heading : ""; };
var chars = function (o) { return o.reduce(function (n, s) { return n + s.paras.join("").length; }, 0); };
var imgSum = function (o) { return o.reduce(function (s, x) { return s + (x.imgCount || 0); }, 0); };
var sig3 = function (o) { return JSON.stringify(o.map(function (s) { return { k: s.key, h: s.heading, ik: s.imgKind, a: s.angle, d: s.density }; })); };

var checks = [];
function check(pass, name, detail) { checks.push({ name: name, pass: !!pass, detail: detail || "" }); }

// 1) 枚举齐全：7 角度 / 5 结构 / 5 图片形态 / 4 密度 / 7 版式预设
check(Object.keys(EDITORIAL_ANGLES).length === 7, "angles=7", "got " + Object.keys(EDITORIAL_ANGLES).length);
check(Object.keys(EDITORIAL_STRUCTURES).length === 5, "structures=5", "got " + Object.keys(EDITORIAL_STRUCTURES).length);
check(Object.keys(EDITORIAL_IMG).length === 5, "img-modes=5", "got " + Object.keys(EDITORIAL_IMG).length);
check(Object.keys(EDITORIAL_DENSITY).length === 4, "densities=4", "got " + Object.keys(EDITORIAL_DENSITY).length);
check(V.length === 7, "variants=7", "got " + V.length);

// 2) 连续 3 版：相邻两版在 angle/structure/img/density 四维度上全部不同
var d04 = [v0.angle !== v1.angle, v0.structure !== v1.structure, v0.img !== v1.img, v0.density !== v1.density].filter(Boolean).length;
var d14 = [v1.angle !== v2.angle, v1.structure !== v2.structure, v1.img !== v2.img, v1.density !== v2.density].filter(Boolean).length;
check(d04 === 4 && d14 === 4, "adjacent four-dim differ", "d04=" + d04 + ",d14=" + d14);

// 3) 三版大纲均非空，且都含核心章节 why/experience/day(按天分节)/gain/fit
var coreOk = function (o) {
  return o.length >= 4 && ["why", "experience", "day", "gain", "fit"].every(function (k) { return o.some(function (s) { return s.key.indexOf(k) === 0; }); });
};
check(coreOk(o0) && coreOk(o1) && coreOk(o2), "core sections present", "len=" + o0.length + "/" + o1.length + "/" + o2.length);

// 4) 章节顺序三版不同
check(ord(o0) !== ord(o1) && ord(o1) !== ord(o2) && ord(o0) !== ord(o2),
  "section order differs", "o0=" + ord(o0) + " | o1=" + ord(o1) + " | o2=" + ord(o2));

// 5) 章节标题随角度变化（同一 why 节，三版标题不同）
check(headOf(o0, "why") !== headOf(o1, "why") && headOf(o1, "why") !== headOf(o2, "why"),
  "heading changes w/ angle", "why@o0=" + headOf(o0, "why") + " | why@o1=" + headOf(o1, "why") + " | why@o2=" + headOf(o2, "why"));

// 6) 每节取图数量三版不同（至少一个维度轮换）+ imgKind 随版式变化（mosaic/big/solo 三态各异）
check(imgSum(o0) !== imgSum(o1) && imgSum(o0) !== imgSum(o2),
  "img-count differs", "imgSum=" + imgSum(o0) + "/" + imgSum(o1) + "/" + imgSum(o2) + " (mosaic=2/big=1/strip=1)");
check(o0[0].imgKind !== o1[0].imgKind && o1[0].imgKind !== o2[0].imgKind && o0[0].imgKind !== o2[0].imgKind,
  "img-kind differs", "kind@o0=" + o0[0].imgKind + " kind@o1=" + o1[0].imgKind + " kind@o2=" + o2[0].imgKind);

// 7) 文案密度：纪实型(全保留) > 杂志型(≤2段/170字) > 画册型(≤1段/90字)
check(chars(o1) > chars(o0) && chars(o0) > chars(o2),
  "density chars doc>mag>album", "chars=" + chars(o0) + "(mag)/" + chars(o1) + "(doc)/" + chars(o2) + "(album)");

// 8) 画册型单节 1 段、纪实型单节 ≥1 段
check((o2.find(function (s) { return s.key === "why"; }).paras.length === 1) &&
  (o1.find(function (s) { return s.key === "why"; }).paras.length >= 1),
  "album=1para doc>=1para",
  "albumPara=" + o2.find(function (s) { return s.key === "why"; }).paras.length +
  " docPara=" + o1.find(function (s) { return s.key === "why"; }).paras.length);

// 9) 末尾图廊模式三版不同（mosaic/big/strip）
var g0 = editorialGalleryMode(v0.img), g1 = editorialGalleryMode(v1.img), g2 = editorialGalleryMode(v2.img);
check(g0 !== g1 && g1 !== g2 && g0 !== g2, "gallery mode differs", "gallery=" + g0 + "/" + g1 + "/" + g2);

// 10) 三版内容指纹两两不同
check(sig3(o0) !== sig3(o1) && sig3(o1) !== sig3(o2) && sig3(o0) !== sig3(o2),
  "content fingerprint differs", "len0=" + sig3(o0).length + " len1=" + sig3(o1).length + " len2=" + sig3(o2).length);

// 11) editorialVariantOf 缺省 / 未知 id 兜底首版
check(editorialVariantOf({}).id === (V[0] && V[0].id) && editorialVariantOf({ editorialVariantId: "nope" }).id === (V[0] && V[0].id),
  "variant fallback to v0", "def=" + editorialVariantOf({}).id);

// 12) pickEditorialVariant 给定上一版 id 取确定性下一版且不同于上一版
var nx = pickEditorialVariant(null, v0.id);
check(nx.id !== v0.id && nx.id === V[1].id, "regen picks next", "next=" + nx.id);

var allPass = checks.every(function (c) { return c.pass; });
return { ok: allPass, total: checks.length, passed: checks.filter(function (c) { return c.pass; }).length, checks: checks };
