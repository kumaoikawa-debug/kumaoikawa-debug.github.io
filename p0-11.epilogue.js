// P0-11 Safe Crop Policy 冒烟：验收「图片裁切优先保护受保护主体，宁改版式不强裁」
// 受保护主体 6 类：人脸 / 人体 / 主体 / 合影人物 / 动作主体 / 关键景物
// 硬规则：若目标比例会破坏主体 → 改版式（原比例展示 contain），绝不强制裁切。
// 验收：一批人物 / 亲子 / 合影照片，渲染后不得出现「人物图在不安全版式里被 cover 强裁」。
state = (typeof loadState === "function") ? loadState() : {};
function mkPhoto(i, o) {
  return Object.assign({
    src: "s" + i + ".jpg", imageId: "ph_" + i, index: i,
    orientation: "landscape", quality: 0.8, scene: "scenic", tags: ["风景"],
    people: 0, action: "", focal: { x: 0.5, y: 0.45 },
  }, o || {});
}
const checks = [];
const add = (name, pass, detail) => checks.push({ name: name, pass: !!pass, detail: detail || "" });

/* ---------- 1) 受保护主体识别（6 类）---------- */
const pp = mkPhoto(0, { orientation: "portrait", people: 1, tags: ["人物"] });
const subP = protectedSubjects(pp);
add("受保护主体：竖图单人 → 人脸/人体/主体（不含合影人物）",
  subP.indexOf("人脸") >= 0 && subP.indexOf("人体") >= 0 && subP.indexOf("主体") >= 0 && subP.indexOf("合影人物") < 0,
  JSON.stringify(subP));

const gp = mkPhoto(1, { orientation: "landscape", people: 3, tags: ["合影"] });
const subG = protectedSubjects(gp);
add("受保护主体：合影(≥2人) → 含 合影人物 + 人脸",
  subG.indexOf("合影人物") >= 0 && subG.indexOf("人脸") >= 0, JSON.stringify(subG));

const ap = mkPhoto(2, { orientation: "landscape", people: 1, tags: ["动作", "人物"], action: "攀岩" });
add("受保护主体：动作图 → 含 动作主体",
  protectedSubjects(ap).indexOf("动作主体") >= 0, JSON.stringify(protectedSubjects(ap)));

const sp = mkPhoto(3, { orientation: "landscape", people: 0, tags: ["风景"] });
const subS = protectedSubjects(sp);
add("受保护主体：风景(无人) → 含 关键景物（不含人脸）",
  subS.indexOf("关键景物") >= 0 && subS.indexOf("人脸") < 0, JSON.stringify(subS));

/* ---------- 2) safePatterns（该图可安全 cover 进入的版式集合）---------- */
const safePP = safePatternsOf(pp, evaluateCropSafety(pp));
add("安全版式：竖图单人 → 仅 PortraitPair/AspectPreserved（不进 FullWidth/ImagePair/Mosaic/GalleryStrip）",
  safePP.indexOf("FullWidth") < 0 && safePP.indexOf("ImagePair") < 0 && safePP.indexOf("Mosaic") < 0 && safePP.indexOf("GalleryStrip") < 0 && safePP.indexOf("PortraitPair") >= 0 && safePP.indexOf("AspectPreserved") >= 0,
  JSON.stringify(safePP));

const safeLP = safePatternsOf(gp, evaluateCropSafety(gp));
add("安全版式：横图合影 → 进 ImagePair（4/3轻裁安全），不进 FullWidth",
  safeLP.indexOf("ImagePair") >= 0 && safeLP.indexOf("FullWidth") < 0, JSON.stringify(safeLP));

const safeS = safePatternsOf(sp, evaluateCropSafety(sp));
add("安全版式：横图风景(无人) → 全部安全（含 FullWidth）",
  safeS.indexOf("FullWidth") >= 0 && safeS.length === PI_LAYOUT_PATTERNS.length, JSON.stringify(safeS));

const hp = mkPhoto(4, { orientation: "portrait", people: 2, tags: ["合影"], cropRisk: "high" });
const safeH = safePatternsOf(hp, evaluateCropSafety(hp));
add("安全版式：模型判定 high → 仅 AspectPreserved（绝不 cover 强裁）",
  safeH.length === 1 && safeH[0] === "AspectPreserved", JSON.stringify(safeH));

/* ---------- 3) 排版路由：Hero 不强制竖图人物/合影进横幅 ---------- */
const used = [
  mkPhoto(10, { orientation: "landscape", people: 0, tags: ["风景"] }),
  mkPhoto(11, { orientation: "portrait", people: 1, tags: ["人物"] }),
  mkPhoto(12, { orientation: "portrait", people: 3, tags: ["合影"] }),
];
const planHero = buildAdaptiveLayout(used, 3);
const heroComp = planHero.components.find((c) => c.pattern === "FullWidth");
add("排版路由：Hero 优先取对 FullWidth 安全的横图风景（不强制竖图人物/合影进横幅）",
  heroComp && heroComp.photos[0] && heroComp.photos[0].imageId === "ph_10",
  "hero=" + (heroComp && heroComp.photos[0] && heroComp.photos[0].imageId));

/* ---------- 4) 渲染：不安全版式→contain(ph-safe)，安全版式→cover ---------- */
const plan2 = {
  tier: "mid", mode: "hero_grid", patterns: ["FullWidth", "PortraitPair"],
  components: [
    { pattern: "FullWidth", photos: [mkPhoto(20, { orientation: "portrait", people: 1, tags: ["人物"] })] },
    { pattern: "PortraitPair", photos: [mkPhoto(21, { orientation: "portrait", people: 1, tags: ["人物"] }), mkPhoto(22, { orientation: "portrait", people: 2, tags: ["合影"] })] },
  ],
};
const html2 = layoutHtml(plan2);
const safeCount = (html2.match(/ph-safe/g) || []).length;
add("渲染：FullWidth 中的竖图人物 → ph-safe + object-fit:contain（宁留白不裁）",
  html2.indexOf("s20.jpg") >= 0 && html2.indexOf("object-fit:contain") >= 0 && safeCount === 1,
  "ph-safe 次数=" + safeCount);
add("渲染：竖图人物在 PortraitPair(安全版式) → 走 cover，不标 ph-safe",
  html2.indexOf("s21.jpg") >= 0 && html2.indexOf("s22.jpg") >= 0 && safeCount === 1,
  "ph-safe 次数=" + safeCount);

/* ---------- 5) 验收：一批人物/亲子/合影照片，无「人物图在不安全版式被 cover 强裁」---------- */
function assertNoBadCrop(oris, total, label) {
  const u = oris.map((o, i) => mkPhoto(i, o));
  const plan = buildAdaptiveLayout(u, total != null ? total : oris.length);
  const html = layoutHtml(plan);
  let bad = 0; const detail = [];
  plan.components.forEach((c) => {
    c.photos.forEach((p) => {
      const safe = evaluateCropSafety(p).safePatterns;
      const unsafe = safe.indexOf(c.pattern) < 0;
      if (!unsafe) return; // 安全版式：cover 没问题
      // 该图渲染卡片是否标了 ph-safe（=原比例 contain，未强裁）
      const idx = html.indexOf(p.src);
      const ctx = html.slice(Math.max(0, idx - 200), idx + 40);
      const hasSafe = /class="ph[^"]*ph-safe/.test(ctx);
      if (!hasSafe) { bad++; detail.push(p.src + " @ " + c.pattern + " 被 cover 强裁"); }
    });
  });
  add("验收(" + label + ")：人物/亲子/合影照片无错误强裁", bad === 0, bad === 0 ? "ok" : detail.join(" ; "));
}
// 批次 A：6 张竖图人物/亲子（mid 级）
assertNoBadCrop([
  { orientation: "portrait", people: 1, tags: ["人物"] },
  { orientation: "portrait", people: 2, tags: ["合影"] },
  { orientation: "portrait", people: 1, tags: ["人物"] },
  { orientation: "portrait", people: 3, tags: ["合影"] },
  { orientation: "portrait", people: 1, tags: ["人物"] },
  { orientation: "portrait", people: 2, tags: ["合影"] },
], 6, "6张竖图亲子/合影");
// 批次 B：8 张混合（横图合影 + 竖图亲子 + 风景，mid 级）
assertNoBadCrop([
  { orientation: "landscape", people: 4, tags: ["合影"] },
  { orientation: "portrait", people: 2, tags: ["合影"] },
  { orientation: "portrait", people: 1, tags: ["人物"] },
  { orientation: "landscape", people: 0, tags: ["风景"] },
  { orientation: "landscape", people: 3, tags: ["合影"] },
  { orientation: "portrait", people: 1, tags: ["人物"] },
  { orientation: "landscape", people: 0, tags: ["风景"] },
  { orientation: "portrait", people: 3, tags: ["合影"] },
], 8, "8张混合(横图合影+竖图亲子+风景)");
// 批次 C：12 张大量混合（many 级，含画廊横条）
assertNoBadCrop([
  { orientation: "portrait", people: 2, tags: ["合影"] },
  { orientation: "portrait", people: 1, tags: ["人物"] },
  { orientation: "landscape", people: 5, tags: ["合影"] },
  { orientation: "landscape", people: 0, tags: ["风景"] },
  { orientation: "portrait", people: 3, tags: ["合影"] },
  { orientation: "landscape", people: 2, tags: ["合影"] },
  { orientation: "portrait", people: 1, tags: ["人物"] },
  { orientation: "landscape", people: 0, tags: ["风景"] },
  { orientation: "portrait", people: 2, tags: ["合影"] },
  { orientation: "landscape", people: 4, tags: ["合影"] },
  { orientation: "portrait", people: 1, tags: ["人物"] },
  { orientation: "landscape", people: 0, tags: ["风景"] },
], 12, "12张大量混合(含GalleryStrip)");

/* ---------- 6) pagePhotoContain 接线（通用 4/3 卡片：含人物→contain，风景→cover）---------- */
PAGE_PHOTO_INTEL = {
  analysis: [mkPhoto(30, { people: 1, orientation: "portrait", tags: ["人物"] }), mkPhoto(31, { people: 0, tags: ["风景"] })],
  cropSafety: evaluateCropSafetyAll([mkPhoto(30, { people: 1, orientation: "portrait", tags: ["人物"] }), mkPhoto(31, { people: 0, tags: ["风景"] })]),
  roles: {}, used: [],
};
add("pagePhotoContain：竖图人物 true（原比例）/ 风景图 false（可 cover）",
  (typeof pagePhotoContain === "function" ? pagePhotoContain("s30.jpg") : "fn?") === true
  && (typeof pagePhotoContain === "function" ? pagePhotoContain("s31.jpg") : "fn?") === false,
  "c30=" + (typeof pagePhotoContain === "function" ? pagePhotoContain("s30.jpg") : "fn?") + " c31=" + (typeof pagePhotoContain === "function" ? pagePhotoContain("s31.jpg") : "fn?"));

const failed = checks.filter((c) => !c.pass);
const allPass = failed.length === 0;
return { ok: allPass, results: { safePatternsSample: { portraitPerson: safePP, landscapeGroup: safeLP, scenery: safeS } }, checks: checks };
