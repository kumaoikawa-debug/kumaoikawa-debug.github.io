/* ClubOS · 一键卡片组（v225）
 * 结构化事实 / 老板一句话 → 自动生成多张图文卡片（封面 / 按天行程 / 亮点 / 出行提示）。
 * 复用 shell.js 的画布底座：rr / wrapText / rgb / mix / drawImageCover / loadImage / posterPalette / POSTER_PALETTE。
 * parseCardsetInput / planCardset 为纯函数（无 DOM 依赖），便于契约测试；drawCardsetCard 仅浏览器内运行。
 * 约定：扁平 classic script，顶层函数即全局；不在本文件重复声明 shell.js 已有的全局底座。
 */
var CARD_W = 1080, CARD_H = 1440;
var CARD_FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';

// 类型 → pageStyle（对齐 POSTER_PALETTE 的 key）
var CARDSET_TYPE_STYLE = {
  "徒步": "hike", "登山": "hike", "爬山": "hike",
  "溯溪": "water", "漂流": "water",
  "露营": "camp", "野营": "camp",
  "骑行": "cycling", "自行车": "cycling",
  "滑雪": "ski",
  "亲子": "kids",
  "摄影": "photo", "拍照": "photo",
  "团建": "team",
  "自驾": "drive", "自驾游": "drive",
  "跑步": "run", "马拉松": "run",
  "攀岩": "climb", "攀冰": "climb", "攀登": "climb",
  "观光": "sight", "景区": "sight", "风景": "sight",
  "旅行": "travel", "游玩": "travel",
  "城市": "city", "citywalk": "city",
  "户外": "outdoor"
};

function cardsetDetectType(text) {
  for (var k in CARDSET_TYPE_STYLE) {
    if (text.indexOf(k) >= 0) return { type: k, pageStyle: CARDSET_TYPE_STYLE[k] };
  }
  return { type: "户外", pageStyle: "outdoor" };
}

function cardsetClean(s) { return (s || "").replace(/[​-‍﻿]/g, "").replace(/\s+/g, " ").trim(); }
function cardsetLines(text) { return (text || "").split(/\r?\n/).map(cardsetClean).filter(Boolean); }

// ---- 纯函数：把自由文案解析成结构化事实 ----
function parseCardsetInput(text) {
  text = text || "";
  var src = cardsetLines(text);
  var raw = cardsetClean(text);
  var f = {
    title: "", type: "户外", pageStyle: "outdoor", place: "", dateMD: "", date: "",
    meeting: "", meetTime: "", returnTime: "", durationDays: 1, difficulty: "",
    price: null, limit: null, limitUnit: "人",
    itineraryDays: [], sellingPoints: [], gear: [], photos: []
  };

  var DAY_RE = /^(第\s*[0-9一二三四五六七八九十]+\s*天|Day\s*\d+|D\s*\d+|行程安排|详细行程|行程)/i;
  var firstLine = src[0] || raw;
  if (DAY_RE.test(firstLine)) {
    firstLine = src.filter(function (l) { return !DAY_RE.test(l); })[0] || raw;
  }
  var titleCut = firstLine.split(/[，,。．；;：:（\(【\[]/)[0].trim();
  f.title = titleCut.length > 2 ? titleCut : firstLine;

  var t = cardsetDetectType(raw);
  f.type = t.type; f.pageStyle = t.pageStyle;

  var m = raw.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (m) { f.dateMD = m[1] + "月" + m[2] + "日"; f.date = f.dateMD; }
  else {
    m = raw.match(/(\d{1,2})[.\/](\d{1,2})/);
    if (m) { f.dateMD = m[1] + "月" + m[2] + "日"; f.date = f.dateMD; }
  }

  var meetLoc = "";
  var m1 = raw.match(/(?:集合点|集合地点|上车点|出发点)[:：]?\s*([^，,。；;]+)/);
  if (m1) meetLoc = m1[1];
  else {
    var clause2 = (raw.split(/[，,。；;]/).filter(function (s) { return /集合|上车|出发/.test(s); })[0] || "");
    if (clause2) {
      var before = clause2.split(/集合|上车|出发/)[0];
      meetLoc = before.replace(/\d{1,2}月\d{1,2}日/g, "").replace(/\d{1,2}[.\/]\d{1,2}/g, "")
        .replace(/\d{1,2}:\d{2}/g, "").replace(/(在|于|地点)[:：]?/g, "").replace(/[：:]/g, "").trim();
    }
  }
  if (meetLoc) f.meeting = cardsetClean(meetLoc);
  var tm = raw.match(/(\d{1,2}):(\d{2})/);
  if (tm) f.meetTime = tm[1] + ":" + tm[2];
  var rt = raw.match(/(?:返[程回]|解散|回到)\s*[^，,。；;]*?(\d{1,2}):(\d{2})/);
  if (rt) f.returnTime = rt[1] + ":" + rt[2];

  if (/轻松|简单|初级|休闲/.test(raw)) f.difficulty = "轻松";
  else if (/挑战|高强度|困难|高级|硬核/.test(raw)) f.difficulty = "挑战";
  else if (/进阶|中等|中级|适中/.test(raw)) f.difficulty = "进阶";

  var dm = raw.match(/(\d{1,2})\s*天\s*(\d{1,2})\s*晚/);
  if (dm) f.durationDays = parseInt(dm[1], 10) || 1;
  else if (/当日往返|单日|一天|1天/.test(raw)) f.durationDays = 1;
  else if (/(\d{1,2})\s*天/.test(raw)) { var d2 = raw.match(/(\d{1,2})\s*天/); f.durationDays = parseInt(d2[1], 10) || 1; }

  var pm = raw.match(/¥?\s*(\d+(?:\.\d+)?)\s*元\s*\/\s*人/) || raw.match(/(\d+(?:\.\d+)?)\s*元\s*\/\s*人/) || raw.match(/费用[:：]\s*(\d+(?:\.\d+)?)/) || raw.match(/(\d+(?:\.\d+)?)\s*元/);
  if (pm) f.price = parseFloat(pm[1]);
  var lm = raw.match(/限\s*(\d{1,3})\s*人/) || raw.match(/(\d{1,3})\s*人小队/) || raw.match(/招募\s*(\d{1,3})\s*人?/);
  if (lm) f.limit = parseInt(lm[1], 10);

  var dayMarks = [];
  src.forEach(function (ln, i) {
    if (/^(第\s*[0-9一二三四五六七八九十]+\s*天|Day\s*\d+|D\s*\d+|行程安排|详细行程|行程)/i.test(ln)) dayMarks.push(i);
  });
  if (dayMarks.length) {
    for (var di = 0; di < dayMarks.length; di++) {
      var start = dayMarks[di];
      var end = (di + 1 < dayMarks.length) ? dayMarks[di + 1] : src.length;
      var head = src[start];
      var label = head.replace(/^(第\s*[0-9一二三四五六七八九十]+\s*天|Day\s*\d+|D\s*\d+|行程安排|详细行程|行程)[:：]?\s*/, "").trim() || head;
      var items = [];
      for (var j = start + 1; j < end; j++) {
        var it = src[j];
        var im = it.match(/^(\d{1,2}):(\d{2})\s*[—\-~]?\s*(.+)$/) || it.match(/^(\d{1,2}):(\d{2})\s*(.+)$/);
        if (im) items.push({ time: im[1] + ":" + im[2], text: cardsetClean(im[3]) });
        else if (it.length > 1) items.push({ time: "", text: it });
      }
      f.itineraryDays.push({ label: label, sub: f.dateMD, items: items });
    }
  } else {
    var timeline = [];
    src.forEach(function (ln) {
      var im2 = ln.match(/^(\d{1,2}):(\d{2})\s*[—\-~]?\s*(.+)$/) || ln.match(/^(\d{1,2}):(\d{2})\s*(.+)$/);
      if (im2) timeline.push({ time: im2[1] + ":" + im2[2], text: cardsetClean(im2[3]) });
    });
    if (timeline.length) f.itineraryDays.push({ label: "行程安排", sub: f.dateMD, items: timeline });
  }

  var spLines = cardsetCollectAfter(src, ["亮点", "卖点", "特色", "看点"]);
  if (!spLines.length) {
    src.forEach(function (ln) {
      if (/^[\d①-⑨⑩][\.、]/.test(ln) || /^[•·\-—]/.test(ln)) spLines.push(ln.replace(/^[\d①-⑨⑩][\.、]\s*/, "").replace(/^[•·\-—]\s*/, ""));
    });
    var sm = raw.match(/(?:亮点|卖点|特色)[：:]\s*([^。]+)/);
    if (sm) sm[1].split(/[；;、]/).forEach(function (x) { if (cardsetClean(x)) spLines.push(cardsetClean(x)); });
  }
  spLines.slice(0, 6).forEach(function (s) {
    var parts = s.split(/[:：—\-–]|，/);
    var title = cardsetClean(parts[0]);
    var desc = cardsetClean(parts.slice(1).join("，"));
    if (title.length > 26 && !desc) { desc = title.slice(24); title = title.slice(0, 24); }
    f.sellingPoints.push({ title: title, desc: desc });
  });

  var gearLines = cardsetCollectAfter(src, ["装备", "携带", "需带", "准备", "带好"]);
  if (!gearLines.length) {
    var gm = raw.match(/(?:装备|携带|需带|准备)[：:]\s*([^。]+)/);
    if (gm) gm[1].split(/[、，,；;]/).forEach(function (x) { if (cardsetClean(x)) gearLines.push(cardsetClean(x)); });
  }
  gearLines.slice(0, 8).forEach(function (g) {
    var name = cardsetClean(g.replace(/[：:].*$/, "").replace(/[（(].*$/, ""));
    var must = /必|强制|必备|一定/.test(g);
    if (name) f.gear.push({ name: name, must: must });
  });

  return f;
}

function cardsetCollectAfter(srcLines, keys) {
  var out = [], capture = false;
  for (var i = 0; i < srcLines.length; i++) {
    var ln = srcLines[i];
    if (keys.some(function (k) { return ln.indexOf(k) === 0; })) {
      var rest = ln.replace(new RegExp("^(?:" + keys.join("|") + ")[：: ]?"), "");
      if (rest) out.push(rest);
      capture = true; continue;
    }
    if (capture) {
      if (/^(第\s*\d+\s*天|Day|行程|价格|费用|集合|装备|亮点|说明|注意|提示|备注)/i.test(ln)) { capture = false; continue; }
      out.push(ln);
    }
  }
  var flat = [];
  out.forEach(function (o) { o.split(/[；;。]/).forEach(function (x) { if (cardsetClean(x)) flat.push(cardsetClean(x)); }); });
  return flat;
}

// ---- 纯函数：结构化事实 → 4 类卡规划 ----
function planCardset(facts) {
  facts = facts || {};
  var pal = (typeof posterPalette === "function") ? posterPalette(facts) : POSTER_PALETTE.outdoor;
  var cards = [];
  var priceTxt = facts.price != null ? ("¥" + facts.price + (facts.limitUnit ? "/" + facts.limitUnit : "")) : "待定";
  var sub = (facts.type || "户外") + (facts.durationDays > 1 ? " · " + facts.durationDays + "天" : (facts.dateMD ? " · " + facts.dateMD : ""));
  cards.push({
    kind: "cover", title: facts.title || "活动卡片", type: facts.type || "户外", sub: sub,
    date: facts.dateMD || facts.date || "待定", place: facts.place || "待定",
    price: priceTxt, palette: pal, photo: null
  });
  var days = (facts.itineraryDays && facts.itineraryDays.length)
    ? facts.itineraryDays
    : [{ label: "行程安排", sub: facts.dateMD || "", items: [] }];
  days.forEach(function (d) {
    cards.push({
      kind: "day", label: d.label || "行程安排", sub: d.sub || "",
      items: (d.items || []).map(function (it) { return { time: it.time || "", text: it.text || "" }; }),
      palette: pal
    });
  });
  var pts = (facts.sellingPoints || []).slice(0, 4)
    .map(function (p) { return { title: p.title || "", desc: p.desc || "" }; })
    .filter(function (p) { return p.title; });
  cards.push({
    kind: "highlights",
    points: pts.length ? pts : [{ title: "敬请期待", desc: "本场亮点将于出发前公布" }],
    palette: pal
  });
  cards.push({
    kind: "tips",
    gear: (facts.gear || []).map(function (g) { return { name: g.name || "", must: !!g.must }; }),
    meeting: facts.meeting || "待定", meetTime: facts.meetTime || "", returnTime: facts.returnTime || "",
    date: facts.dateMD || facts.date || "", place: facts.place || "待定", difficulty: facts.difficulty || "",
    palette: pal
  });
  return cards;
}

function cardsetCardTitle(card) {
  if (card.kind === "cover") return "封面卡";
  if (card.kind === "day") return "行程卡 · " + (card.label || "行程");
  if (card.kind === "highlights") return "亮点卡";
  if (card.kind === "tips") return "出行提示卡";
  return "卡片";
}

// ---- 画布绘制（仅浏览器） ----
function drawCardsetCard(canvas, card) {
  canvas.width = CARD_W; canvas.height = CARD_H;
  var ctx = canvas.getContext("2d");
  var pal = card.palette || POSTER_PALETTE.outdoor;
  var ink = pal.ink, paper = pal.paper, accent = pal.accent;
  var brand = (typeof state !== "undefined" && state && state.brand) || {};
  ctx.textBaseline = "alphabetic";
  ctx.clearRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = rgb(paper); ctx.fillRect(0, 0, CARD_W, CARD_H);

  function font(sz, wt) { ctx.font = wt + " " + sz + "px " + CARD_FONT; }
  function fill(c) { ctx.fillStyle = c; }
  function txt(t, x, y) { ctx.fillText(t, x, y); }
  function paperBg() {
    var g = ctx.createLinearGradient(0, 0, 0, CARD_H);
    g.addColorStop(0, rgb(pal.top)); g.addColorStop(1, rgb(pal.bot));
    fill(g); ctx.fillRect(0, 0, CARD_W, CARD_H);
  }
  function brandMark(x, y, align) {
    var name = (brand.name || "").slice(0, 12);
    var slogan = (brand.slogan || "").slice(0, 18);
    font(30, "800");
    var nw = ctx.measureText(name).width;
    var lw = 56, gap = 18;
    var blockW = lw + gap + Math.max(nw, ctx.measureText(slogan).width);
    var bx = align === "right" ? x - blockW : x;
    fill(rgb(accent)); rr(ctx, bx, y, lw, lw, lw / 2); ctx.fill();
    fill("#fff"); font(30, "800");
    var ch = (brand.logoText || name || "野").slice(0, 1);
    txt(ch, bx + lw / 2 - ctx.measureText(ch).width / 2, y + lw / 2 + 11);
    if (name) {
      fill(rgb(ink)); font(30, "800"); txt(name, bx + lw + gap, y + 26);
      if (slogan) { fill(rgb(ink, 0.55)); font(22, "500"); txt(slogan, bx + lw + gap, y + 52); }
    }
  }
  function sectionHeader(title, sub) {
    fill(rgb(accent)); rr(ctx, 72, 92, 12, 76, 6); ctx.fill();
    fill(rgb(ink)); font(50, "800"); txt(title, 104, 146);
    if (sub) { fill(rgb(ink, 0.5)); font(28, "500"); txt(sub, 104, 184); }
  }
  function pill(t, x, y, bg, fg, sz, pad, hh, r) {
    font(sz, "700"); var tw = ctx.measureText(t).width;
    fill(bg); rr(ctx, x, y, tw + pad * 2, hh, r); ctx.fill();
    fill(fg); txt(t, x + pad, y + hh * 0.72);
    return tw + pad * 2;
  }
  function fitTitle(text, maxW, maxLines, sizes) {
    for (var i = 0; i < sizes.length; i++) {
      font(sizes[i], "800");
      var L = wrapText(ctx, text, maxW);
      if (L.length <= maxLines) return { size: sizes[i], lines: L };
    }
    font(sizes[sizes.length - 1], "800");
    return { size: sizes[sizes.length - 1], lines: wrapText(ctx, text, maxW).slice(0, maxLines) };
  }
  function clipCJK(text, maxW, sz) {
    font(sz, "500");
    if (ctx.measureText(text).width <= maxW) return text;
    var s = text;
    while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
    return s + "…";
  }

  if (card.kind === "cover") {
    var heroH = 900;
    if (card.photo && card.photo.naturalWidth) { drawImageCover(ctx, card.photo, 0, 0, CARD_W, heroH, { x: 50, y: 42 }); }
    else { paperBg(); }
    var sg = ctx.createLinearGradient(0, heroH * 0.32, 0, heroH);
    sg.addColorStop(0, "rgba(0,0,0,0)"); sg.addColorStop(1, "rgba(0,0,0,0.64)");
    fill(sg); ctx.fillRect(0, 0, CARD_W, heroH);
    pill(card.type, 72, 104, "rgba(255,255,255,0.92)", rgb(ink), 28, 22, 56, 28);
    var ft = fitTitle(card.title, CARD_W - 144, 3, [66, 58, 52, 46]);
    var ty = heroH - 150;
    ft.lines.forEach(function (l, i) { if (i) ty += ft.size + 14; fill("#fff"); font(ft.size, "800"); txt(l, 72, ty); });
    var infoY = heroH - 70;
    fill("rgba(255,255,255,0.9)"); font(30, "500");
    txt(card.date + "  ·  " + clipCJK(card.place, CARD_W - 200, 30), 72, infoY);
    fill(rgb(paper)); ctx.fillRect(0, heroH, CARD_W, CARD_H - heroH);
    fill(rgb(accent)); font(84, "900"); txt(card.price, 72, heroH + 180);
    fill(rgb(ink, 0.5)); font(26, "500"); txt((card.limit ? "限 " + card.limit + " " + (card.limitUnit || "人") : "名额有限"), 72, heroH + 220);
    brandMark(CARD_W - 72, heroH + 96, "right");
    fill(rgb(ink, 0.35)); font(24, "500");
    txt("扫码或搜「" + ((brand.name) || "俱乐部") + "」即可报名", 72, CARD_H - 60);
  }
  else if (card.kind === "day") {
    sectionHeader(card.label || "行程安排", card.sub);
    var y = 260;
    var items = card.items || [];
    if (!items.length) {
      fill(rgb(ink, 0.7)); font(34, "600");
      txt("当日往返 · 具体行程以出发前通知为准", 72, y + 20);
      y += 80;
    } else {
      var chipW = 150, leftX = 72, textX = leftX + chipW + 28, maxW = CARD_W - textX - 72;
      items.forEach(function (it) {
        var bodyLines = wrapText(ctx, it.text || "", maxW);
        var rowH = Math.max(it.time ? 56 : 0, bodyLines.length * 44) + 30;
        if (it.time) {
          fill(rgb(accent)); rr(ctx, leftX, y, chipW, 56, 14); ctx.fill();
          fill("#fff"); font(30, "700"); txt(it.time, leftX + chipW / 2 - ctx.measureText(it.time).width / 2, y + 38);
        } else {
          fill(rgb(accent)); rr(ctx, leftX + 22, y + 22, 16, 16, 8); ctx.fill();
        }
        fill(rgb(ink)); font(34, "600");
        bodyLines.forEach(function (bl, bi) { txt(bl, textX, y + 40 + bi * 44); });
        y += rowH;
      });
    }
    fill(rgb(accent)); rr(ctx, 72, y + 10, CARD_W - 144, 4, 2); ctx.fill();
    fill(rgb(ink, 0.6)); font(28, "500");
    txt("集合：" + (card.meeting || "待定") + (card.meetTime ? "  " + card.meetTime : ""), 72, y + 70);
    brandMark(CARD_W - 72, CARD_H - 150, "right");
  }
  else if (card.kind === "highlights") {
    sectionHeader("本场亮点", "");
    var hy = 270, pts = card.points || [];
    pts.slice(0, 4).forEach(function (p, i) {
      fill(rgb(accent)); rr(ctx, 72, hy, 64, 64, 32); ctx.fill();
      fill("#fff"); font(36, "800"); txt(String(i + 1), 72 + 32 - ctx.measureText(String(i + 1)).width / 2, hy + 44);
      fill(rgb(ink)); font(38, "800");
      var tl = wrapText(ctx, p.title, CARD_W - 200).slice(0, 2);
      tl.forEach(function (l, bi) { txt(l, 168, hy + 34 + bi * 44); });
      if (p.desc) {
        fill(rgb(ink, 0.55)); font(27, "500");
        var dl = wrapText(ctx, p.desc, CARD_W - 200).slice(0, 2);
        dl.forEach(function (l, bi) { txt(l, 168, hy + 34 + tl.length * 44 + bi * 38); });
      }
      hy += 300;
    });
    brandMark(CARD_W - 72, CARD_H - 150, "right");
  }
  else if (card.kind === "tips") {
    sectionHeader("出行提示", "");
    var ty2 = 280;
    fill(rgb(accent)); font(32, "800"); txt("装备清单", 72, ty2);
    ty2 += 56;
    var gear = card.gear || [];
    if (!gear.length) {
      fill(rgb(ink, 0.55)); font(28, "500"); txt("具体装备以出发前通知为准", 72, ty2 + 10); ty2 += 60;
    } else {
      gear.slice(0, 5).forEach(function (g) {
        if (g.must) { fill(rgb(accent)); rr(ctx, 76, ty2 + 6, 36, 36, 10); ctx.fill(); fill("#fff"); font(26, "800"); txt("✓", 94 - ctx.measureText("✓").width / 2, ty2 + 31); }
        else { fill(rgb(ink, 0.3)); rr(ctx, 76, ty2 + 6, 36, 36, 18); ctx.fill(); }
        fill(rgb(ink)); font(32, "600"); txt(g.name, 132, ty2 + 32);
        fill(g.must ? rgb(accent) : rgb(ink, 0.45)); font(24, "600");
        txt(g.must ? "必带" : "建议", 132 + ctx.measureText(g.name).width + 22, ty2 + 30);
        ty2 += 64;
      });
    }
    ty2 += 30;
    fill(rgb(accent)); rr(ctx, 72, ty2, CARD_W - 144, 4, 2); ctx.fill();
    ty2 += 60;
    fill(rgb(accent)); font(32, "800"); txt("集合信息", 72, ty2);
    ty2 += 56;
    var infoLines = [
      "集合时间：" + (card.meetTime || "待定") + (card.date ? "  " + card.date : ""),
      "集合地点：" + (card.place || "待定") + (card.meeting && card.meeting !== "待定" ? " · " + card.meeting : ""),
      card.returnTime ? ("返程时间：" + card.returnTime) : "",
      card.difficulty ? ("活动难度：" + card.difficulty) : ""
    ].filter(Boolean);
    infoLines.forEach(function (ln) {
      fill(rgb(ink, 0.7)); font(30, "500"); txt(ln, 72, ty2); ty2 += 48;
    });
    brandMark(CARD_W - 72, CARD_H - 150, "right");
  }
  canvas._kind = card.kind;
  return canvas;
}

// ---- 渲染编排（浏览器） ----
var cardsetCanvases = [];

function cardsetRenderAll(facts) {
  var plan = planCardset(facts);
  var coverPhoto = (facts && facts.photos && facts.photos[0]) || null;
  var coverImg = null;
  if (coverPhoto && typeof loadImage === "function") {
    try { coverImg = loadImage(coverPhoto); } catch (e) { coverImg = null; }
  }
  return Promise.resolve(coverImg).then(function (img) {
    var out = [];
    plan.forEach(function (card) {
      var cv = document.createElement("canvas");
      if (card.kind === "cover") card.photo = img;
      cardsetDrawCardSafe(cv, card);
      out.push({ kind: card.kind, title: cardsetCardTitle(card), canvas: cv });
    });
    return out;
  });
}

function cardsetDrawCardSafe(canvas, card) {
  try { drawCardsetCard(canvas, card); }
  catch (err) {
    console.error("[cardset] draw failed", err);
    canvas.width = CARD_W; canvas.height = CARD_H;
    var c = canvas.getContext("2d");
    c.fillStyle = "#fff"; c.fillRect(0, 0, CARD_W, CARD_H);
    c.fillStyle = "#c53030"; c.font = "bold 32px sans-serif"; c.textBaseline = "alphabetic";
    c.fillText("卡片渲染失败：" + (err && err.message ? err.message : err), 48, CARD_H / 2);
  }
}

function cardsetGenerate(text, actId) {
  var grid = document.getElementById("cardsetGrid");
  if (!grid) return;
  grid.innerHTML = '<div class="cardset-empty">正在生成卡片…</div>';
  var facts;
  try {
    if (actId && typeof getActivity === "function") {
      var a = getActivity(actId);
      facts = a ? a : parseCardsetInput(text || "");
    } else {
      facts = parseCardsetInput(text || "");
    }
  } catch (e) { facts = parseCardsetInput(text || ""); }

  cardsetRenderAll(facts).then(function (cards) {
    cardsetCanvases = cards.map(function (c) { return c.canvas; });
    grid.innerHTML = "";
    var head = document.createElement("div");
    head.className = "cardset-head";
    head.innerHTML = '<div class="cardset-head-t">共 ' + cards.length + ' 张卡片</div>' +
      '<button class="btn btn-primary btn-sm" data-action="cardsetDownloadAll">' + (typeof ICON === "function" ? ICON("download") : "↓") + ' 下载全部（JPG）</button>';
    grid.appendChild(head);
    cards.forEach(function (c, i) {
      var wrap = document.createElement("div");
      wrap.className = "cardset-card";
      var label = document.createElement("div");
      label.className = "cardset-card-label";
      label.textContent = c.title;
      c.canvas.className = "cardset-canvas";
      var dl = document.createElement("button");
      dl.className = "btn btn-ghost btn-sm cardset-dl";
      dl.setAttribute("data-action", "cardsetDownloadOne");
      dl.setAttribute("data-idx", String(i));
      dl.innerHTML = (typeof ICON === "function" ? ICON("download") : "↓") + " 下载";
      wrap.appendChild(label); wrap.appendChild(c.canvas); wrap.appendChild(dl);
      grid.appendChild(wrap);
    });
    if (typeof toast === "function") toast("已生成 " + cards.length + " 张卡片");
  }).catch(function (err) {
    console.error(err);
    grid.innerHTML = '<div class="cardset-empty">卡片生成失败：' + (err && err.message ? err.message : err) + '</div>';
  });
}

function cardsetDownloadCanvas(cv, name) {
  var finish = function (blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  };
  try {
    cv.toBlob(function (b) { if (!b) cardsetFallbackDataUrl(cv, name); else finish(b); }, "image/jpeg", 0.92);
  } catch (e) { cardsetFallbackDataUrl(cv, name); }
}
function cardsetFallbackDataUrl(cv, name) {
  try {
    var url = cv.toDataURL("image/jpeg", 0.92);
    var a = document.createElement("a"); a.href = url; a.download = name; a.click();
  } catch (e) {
    if (typeof toast === "function") toast("该卡片含跨域照片，浏览器禁止下载，请改用本地上传的照片");
  }
}
function cardsetDownloadOne(i) {
  var cv = cardsetCanvases && cardsetCanvases[i];
  if (!cv) { if (typeof toast === "function") toast("请先生成卡片"); return; }
  cardsetDownloadCanvas(cv, "ClubOS_卡片_" + (i + 1) + "_" + (cv._kind || "card") + ".jpg");
}
function cardsetDownloadAll() {
  if (!cardsetCanvases || !cardsetCanvases.length) { if (typeof toast === "function") toast("请先生成卡片"); return; }
  cardsetCanvases.forEach(function (cv, i) {
    setTimeout(function () { cardsetDownloadCanvas(cv, "ClubOS_卡片_" + (i + 1) + "_" + (cv._kind || "card") + ".jpg"); }, i * 350);
  });
  if (typeof toast === "function") toast("已开始下载 " + cardsetCanvases.length + " 张卡片");
}
