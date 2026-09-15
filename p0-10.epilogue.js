// P0-10 Photo Layout Intelligence 冒烟：验收「同一套模板不能硬塞所有不同图片组合」
// 引擎按 ①原始张数分级(1-3/4-8/9-20/20+) ②横竖比例主导(dominant) 选 6 种版式。
state = loadState();
function mk(orients, total) {
  return orients.map((o, i) => ({ src: "s" + i + ".jpg", orientation: o, imageId: "ph_" + i, index: i }));
}
function planOf(orients, total) { return buildAdaptiveLayout(mk(orients, total != null ? total : orients.length), total != null ? total : orients.length); }
const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
const has = (arr, x) => arr.indexOf(x) >= 0;

// 1) 1-3 张·竖图：大图 + 留白，命中 PortraitPair（竖图对），绝不 GalleryStrip/Mosaic
const pFewPort = planOf(["portrait", "portrait", "portrait"], 3);
add("1-3 竖图 → solo + PortraitPair", pFewPort.mode === "solo" && has(pFewPort.patterns, "PortraitPair") && !has(pFewPort.patterns, "GalleryStrip") && !has(pFewPort.patterns, "Mosaic"), "mode=" + pFewPort.mode + " patterns=" + pFewPort.patterns.join(","));

// 2) 1-3 张·横图：大图 + 双图(ImagePair)，无 PortraitPair
const pFewLand = planOf(["landscape", "landscape", "landscape"], 3);
add("1-3 横图 → solo + ImagePair(无 PortraitPair)", pFewLand.mode === "solo" && has(pFewLand.patterns, "ImagePair") && !has(pFewLand.patterns, "PortraitPair"), "patterns=" + pFewLand.patterns.join(","));

// 3) 1 张：仅 FullWidth
const pOne = planOf(["landscape"], 1);
add("1 张 → 仅 FullWidth", pOne.mode === "solo" && pOne.patterns.length === 1 && pOne.patterns[0] === "FullWidth", "patterns=" + pOne.patterns.join(","));

// 4) 4-8 张·混合：hero_grid，多种版式(含 ImagePair)
const pMid = planOf(["landscape", "landscape", "landscape", "portrait", "portrait", "square"], 6);
add("4-8 混合 → hero_grid + 多版式", pMid.mode === "hero_grid" && pMid.patterns.length >= 3 && has(pMid.patterns, "ImagePair"), "mode=" + pMid.mode + " patterns=" + pMid.patterns.join(","));

// 5) 9-20 张·混合：chapters，含 GalleryStrip（分章节图文 + 画廊横条）
const pMany = planOf(["landscape","landscape","landscape","landscape","landscape","landscape","landscape","landscape","portrait","portrait","portrait","portrait","square","square","square"], 15);
add("9-20 混合 → chapters + GalleryStrip", pMany.mode === "chapters" && has(pMany.patterns, "GalleryStrip") && has(pMany.patterns, "FullWidth") && has(pMany.patterns, "ImagePair"), "mode=" + pMany.mode + " patterns=" + pMany.patterns.join(","));

// 6) 20+ 张：curated（先筛图再排版，画廊横条为主）
const pHuge = planOf(["landscape","landscape","landscape","landscape","landscape","portrait","portrait","portrait","portrait","square","square","square","square","square"], 25);
add("20+ 混合 → curated + GalleryStrip 为主", pHuge.mode === "curated" && has(pHuge.patterns, "GalleryStrip"), "mode=" + pHuge.mode + " patterns=" + pHuge.patterns.join(","));

// 7) 横竖比例驱动版式（同 8 张，不同朝向 → 不同 patterns）：验收核心
const p8Port = planOf(["portrait","portrait","portrait","portrait","portrait","portrait","portrait","portrait"], 8);
const p8Land = planOf(["landscape","landscape","landscape","landscape","landscape","landscape","landscape","landscape"], 8);
add("横竖驱动：8竖图含 PortraitPair 无 ImagePair", has(p8Port.patterns, "PortraitPair") && !has(p8Port.patterns, "ImagePair"), "竖图 patterns=" + p8Port.patterns.join(","));
add("横竖驱动：8横图含 ImagePair 无 PortraitPair", has(p8Land.patterns, "ImagePair") && !has(p8Land.patterns, "PortraitPair"), "横图 patterns=" + p8Land.patterns.join(","));
add("横竖驱动：同数量不同朝向 → 版式集合不同", p8Port.patterns.join(",") !== p8Land.patterns.join(","), "竖=" + p8Port.patterns.join(",") + " | 横=" + p8Land.patterns.join(","));

// 8) 数量驱动：2 / 6 / 15 / 25 四组版式签名互不相同（同模板不硬塞所有组合）
const sig = (p) => p.mode + "|" + p.patterns.join(",") + "|" + p.components.length;
const s2 = sig(planOf(["portrait", "portrait"], 2));
const s6 = sig(pMid);
const s15 = sig(pMany);
const s25 = sig(pHuge);
const uniq = new Set([s2, s6, s15, s25]);
add("数量驱动：2/6/15/25 四组版式签名互不相同", uniq.size === 4, "s2=" + s2 + " s6=" + s6 + " s15=" + s15 + " s25=" + s25);

// 9) 渲染 HTML 反映版式：竖图组出 ly-PortraitPair、横图组出 ly-ImagePair、20+ 出 ly-GalleryStrip
const htmlPort = layoutHtml(p8Port);
const htmlLand = layoutHtml(p8Land);
const htmlHuge = layoutHtml(pHuge);
add("渲染：竖图组 HTML 含 ly-PortraitPair", /ly-PortraitPair/.test(htmlPort) && /data-tier="mid"/.test(htmlPort), "has=" + /ly-PortraitPair/.test(htmlPort));
add("渲染：横图组 HTML 含 ly-ImagePair(无 ly-PortraitPair)", /ly-ImagePair/.test(htmlLand) && !/ly-PortraitPair/.test(htmlLand), "has=" + /ly-ImagePair/.test(htmlLand));
add("渲染：20+ HTML 含 ly-GalleryStrip", /ly-GalleryStrip/.test(htmlHuge), "has=" + /ly-GalleryStrip/.test(htmlHuge));

// 10) 空输入不崩、返回空组件
const pEmpty = buildAdaptiveLayout([], 0);
add("空输入 → empty + 无组件", pEmpty.mode === "empty" && pEmpty.components.length === 0, "mode=" + pEmpty.mode);

// 11) 渲染接线集成：用真实 buildPhotoIntelligence 产出的 intel 形状，复刻 activities.js:170-176 的画廊构造
//     验证「现场影像」画廊确实走 buildAdaptiveLayout + layoutHtml，输出 .photo-layout + 正确 .ly-* + data-tier
function buildIntel(oris, heroIdx) {
  const used = oris.map((o, i) => ({ imageId: "ph_" + i, src: "s" + i + ".jpg", index: i, orientation: o, quality: 0.8, scene: "scenic", tags: ["scenic"] }));
  return { used: used, heroId: "ph_" + (heroIdx || 0), roles: {}, analysis: used, cropSafety: { byId: {} } };
}
function galleryConstruct(oris, total, reserved) {
  const intel = buildIntel(oris, 0);
  PAGE_PHOTO_INTEL = intel; // 模拟 renderActivityEditorial 调用的 setPagePhotoIntel(a) 之后读到的全局
  const read = pagePhotoIntel();
  const usedSet = new Set(reserved || []);
  let galleryHtml = "";
  if (read && read.used && read.used.length) {
    const gPhotos = read.used.filter((p) => p.imageId !== read.heroId && !usedSet.has(p.index));
    if (gPhotos.length) {
      const plan = buildAdaptiveLayout(gPhotos, total);
      const lay = layoutHtml(plan);
      if (lay) galleryHtml = `<section class="xh-ed-sec xh-ed-gallery" data-sec="gallery"><div class="xh-ed-num">12 / GALLERY</div><h2 class="xh-ed-h">现场影像</h2>${lay}</section>`;
    }
  }
  const m = galleryHtml.match(/data-tier="([a-z]+)"/);
  const lys = (galleryHtml.match(/ly-[A-Za-z]+/g) || []);
  return { galleryHtml, tier: m ? m[1] : "", lys: lys };
}
// 6 张混合（横图主导）→ hero_grid + .ly-ImagePair / .ly-FullWidth；15 张混合 → chapters + .ly-GalleryStrip
const gMid = galleryConstruct(["landscape","landscape","landscape","portrait","portrait","square"], 6, [0]);
add("接线：6张混合 → hero_grid + .photo-layout + data-tier=mid + 含 ly-ImagePair",
  gMid.galleryHtml.indexOf("photo-layout") >= 0 && gMid.tier === "mid" && gMid.lys.indexOf("ly-ImagePair") >= 0,
  "tier=" + gMid.tier + " lys=" + gMid.lys.join(","));
const gMany = galleryConstruct(["landscape","landscape","landscape","landscape","landscape","landscape","landscape","landscape","portrait","portrait","portrait","portrait","square","square","square"], 15, [0]);
add("接线：15张混合 → chapters + .photo-layout + data-tier=many + 含 ly-GalleryStrip",
  gMany.galleryHtml.indexOf("photo-layout") >= 0 && gMany.tier === "many" && gMany.lys.indexOf("ly-GalleryStrip") >= 0,
  "tier=" + gMany.tier + " lys=" + gMany.lys.join(","));
add("接线：galleryHtml 含现场影像标题(section 不空)", gMany.galleryHtml.indexOf("现场影像") >= 0, "len=" + gMany.galleryHtml.length);

const failed = checks.filter((c) => !c.pass);
const allPass = failed.length === 0;
return { ok: allPass, results: { signatures: { s2: s2, s6: s6, s15: s15, s25: s25 } }, checks: checks };
