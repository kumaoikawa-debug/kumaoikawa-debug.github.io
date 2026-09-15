/* §六 验收脚本（照片层 Case 1/2/3/5/6）—— 确定性 fixture，绕过视觉 API。
   运行：SPA_SMOKE_EXTRA=publish.js node <skill>/spa-smoke.js . _accept_sec6_photo.epilogue.js
   契约：顶层 return { ok, total, passed, checks:[...] }，checks 为字符串数组。 */
return (function () {
  var P = (typeof window !== "undefined" && window.CLUBOS_PIPELINE) || null;
  if (!P) return { ok: false, total: 0, passed: 0, checks: ["FAIL: CLUBOS_PIPELINE 未加载"] };
  var checks = [];
  function chk(name, cond) { checks.push((cond ? "PASS" : "FAIL") + ": " + name); return cond; }

  function mk(i, o) {
    o = o || {};
    return {
      imageId: "ph_" + i, src: "https://x/" + i + ".jpg", index: i,
      orientation: o.orientation || "landscape", quality: (o.quality != null ? o.quality : 0.8),
      scene: o.scene || "scenic", people: o.people || 0, action: o.action || "",
      tags: o.tags || [], dupOf: o.dupOf || null, lowQuality: !!o.lowQuality,
      focal: { x: 0.5, y: 0.45 },
    };
  }
  function profileOf(analysis, sel, layout) {
    return P.describePhotoProfile({
      used: sel.used, analysis: analysis, selection: sel,
      cropSafety: { highRiskIds: [] }, layout: { mode: layout.mode },
    });
  }
  function heroOf(sel) {
    var r = P.assignPhotoRoles(sel.used);
    var hp = sel.used.filter(function (p) { return p.imageId === r.heroId; })[0] || null;
    return { roles: r, hero: hp };
  }

  /* ---- Case 1：15 张横向秋景 → 大图/风景/杂志结构 ---- */
  (function () {
    var a = [];
    for (var i = 0; i < 15; i++) a.push(mk(i, { orientation: "landscape", scene: "scenic", quality: 0.82, people: 0 }));
    var sel = P.selectPhotos(a);
    var lay = P.buildAdaptiveLayout(sel.used, a.length);
    var pro = profileOf(a, sel, lay);
    var h = heroOf(sel);
    chk("C1 选图不超过 12（章节化）", sel.used.length === 12);
    chk("C1 版式为 many/chapters", lay.tier === "many");
    chk("C1 含 FullWidth 大图 Hero", lay.patterns.indexOf("FullWidth") >= 0);
    chk("C1 含拼贴/画廊（杂志感）", lay.patterns.indexOf("Mosaic") >= 0 || lay.patterns.indexOf("GalleryStrip") >= 0);
    chk("C1 横向主导", pro.landscapeRatio > 0.9);
    chk("C1 Hero 是横图风景", h.hero && h.hero.orientation === "landscape" && h.hero.scene === "scenic");
  })();

  /* ---- Case 2：同活动换人物图 → 人物主导 ---- */
  (function () {
    var a = [];
    for (var i = 0; i < 12; i++) a.push(mk(i, { orientation: "portrait", scene: "people", quality: 0.8, people: 1 }));
    for (var j = 12; j < 15; j++) a.push(mk(j, { orientation: "landscape", scene: "scenic", quality: 0.8, people: 0 }));
    var sel = P.selectPhotos(a);
    var lay = P.buildAdaptiveLayout(sel.used, a.length);
    var pro = profileOf(a, sel, lay);
    var h = heroOf(sel);
    chk("C2 人物占比高", pro.peopleRatio > 0.5);
    chk("C2 Hero 非合影（people<=1）", !h.hero || h.hero.people <= 1);
    chk("C2 仍有可用 Hero 候选（横风景）", pro.heroCandidates.length >= 1);
  })();

  /* ---- Case 3：亲子竖图 → 不横裁孩子身体（Hero 走原比例 contain） ---- */
  (function () {
    var a = [];
    for (var i = 0; i < 10; i++) a.push(mk(i, { orientation: "portrait", scene: "people", quality: 0.85, people: 1 }));
    var sel = P.selectPhotos(a);
    var h = heroOf(sel);
    var crop = P.evaluateCropSafety(h.hero);
    chk("C3 全竖图时 Hero 为竖图", h.hero && h.hero.orientation === "portrait");
    chk("C3 Hero 不容许 FullWidth 强裁（safePatterns 不含 FullWidth）", crop.safePatterns.indexOf("FullWidth") < 0);
    chk("C3 Hero 至少可原比例展示", crop.safePatterns.indexOf("AspectPreserved") >= 0);
  })();

  /* ---- Case 5：仅 2 张图 → 克制、不重复 ---- */
  (function () {
    var a = [mk(0, { orientation: "landscape", scene: "scenic" }), mk(1, { orientation: "portrait", scene: "people", people: 1 })];
    var sel = P.selectPhotos(a);
    var lay = P.buildAdaptiveLayout(sel.used, a.length);
    var ids = [];
    lay.components.forEach(function (c) { c.photos.forEach(function (p) { ids.push(p.imageId || (p.src && p.src)); }); });
    var uniq = {}; ids.forEach(function (x) { uniq[x] = 1; });
    chk("C5 少图全用（2 张）", sel.used.length === 2 && sel.discarded.length === 0);
    chk("C5 版式为 few/solo", lay.tier === "few");
    chk("C5 无重复图片（每图仅出现一次）", Object.keys(uniq).length === sel.used.length);
  })();

  /* ---- Case 6：35 张乱图 → 自动筛到 14 + 推荐候选 ---- */
  (function () {
    var a = [];
    var i = 0;
    for (; i < 5; i++) a.push(mk(i, { orientation: "landscape", scene: "scenic", dupOf: "ph_0" })); // 重复
    for (; i < 10; i++) a.push(mk(i, { orientation: "landscape", scene: "scenic", quality: 0.3, lowQuality: true })); // 低质
    for (; i < 35; i++) a.push(mk(i, { orientation: "landscape", scene: "scenic", quality: 0.82, people: 0 })); // 优质
    var sel = P.selectPhotos(a);
    var lay = P.buildAdaptiveLayout(sel.used, a.length);
    var pro = profileOf(a, sel, lay);
    var reasons = (sel.discarded || []).map(function (d) { return d.reason || ""; }).join("|");
    chk("C6 自动筛到 14 张", sel.used.length === 14);
    chk("C6 弃用 21 张", sel.discarded.length === 21 && pro.discardedCount === 21);
    chk("C6 弃用含 重复/质量较低/内容重复 三类", reasons.indexOf("重复") >= 0 && reasons.indexOf("质量较低") >= 0 && reasons.indexOf("内容重复") >= 0);
    chk("C6 有推荐候选（Hero/全幅/拼图）", pro.heroCandidates.length + pro.safeFullWidthCandidates.length + pro.collageCandidates.length > 0);
  })();

  var passed = checks.filter(function (c) { return c.indexOf("PASS") === 0; }).length;
  return { ok: passed === checks.length, total: checks.length, passed: passed, checks: checks };
})();
