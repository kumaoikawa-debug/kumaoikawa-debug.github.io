/* case-v200-hero-keep-layer.epilogue.js
   ClubOS v200「hero keep 虚化」回归契约。

   用户反馈：「视觉管理里面任选一个图做封面，然后详情这边出现虚化 bug」。

   根因（层序，不是滤镜参数）：
     v198 为了让竖图/人物封面的两侧不留黑边，把 .xh-ed-hero-backdrop（同图 + blur(26px)）
     的 opacity 从 .55 提到 .92。但照片本体是画在 **header 自身的 background** 上的，
     而绝对定位的子元素永远绘制在父元素背景**之上** —— 于是那层 92% 不透明的糊图把
     整幅 hero 盖住了。keep 模式的判定条件（高风险裁切 / 竖图）恰好会被「人物竖图封面」命中，
     所以老板一选人像图做封面就必然虚化。

   修法：
     keep 模式下照片改为独立图层 .xh-ed-hero-fig（z-index 1），压在垫图层(0)之上、
     面具(2)与文字(3)之下；header 自身不再画照片。
     ★ 本文件最关键的断言是 A6：**keep 模式 header 开标签里不得再出现 background-image:url(**
       —— 只要照片还被画在 header 背景上，这层糊图就会立刻把它盖回去。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v200-hero-keep-layer.epilogue.js */
state = (typeof loadState === "function") ? loadState() : ((typeof initState === "function") ? initState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;
/* 样式契约：harness 现把 styles.css 注入为 __PROJ_CSS__（此前 epilogue 读不到 CSS，
   层序/z-index 这类规则只能靠 DOM 断言或不测）。 */
const css = (typeof __PROJ_CSS__ === "string") ? __PROJ_CSS__ : "";

function mkActivity(over) {
  const base = {
    id: "v200-" + Math.random().toString(36).slice(2, 7),
    type: "徒步", title: "青城后山山脊徒步", place: "青城后山",
    date: "2026-09-20", dateMD: "9月20日", meeting: "天府广场",
    price: 199, limitUnit: "人", limit: 15, days: 1,
    distance: 25, elevation: 800, difficulty: "中等", season: "秋",
    photos: [], photoCaptions: [], tags: [], highlights: [], sellingPoints: [], body: [], reviews: [],
    feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    includeLeader: true, includeInsurance: true, ageRange: "8-60岁",
    confirmed: [{ key: "services" }, { key: "difficulty" }],
    itineraryDays: [{ label: "一日山脊线", sub: "", items: [
      { time: "08:00", text: "天府广场集合" },
      { time: "12:00", text: "适中简餐（以领队现场安排为准）" },
      { time: "17:30", text: "抵达天府广场，活动结束" }
    ] }],
    departures: [], coverIndex: 0, useMemberPrice: false, allowPoints: false, allowCoupons: false,
  };
  return Object.assign(base, over || {});
}
/* 视觉分析写回形态（与 applyVisionNormalized 同构） */
function seedMeta(src, meta) { if (typeof PHOTO_FOCUS_CACHE !== "undefined") PHOTO_FOCUS_CACHE.set(src, meta); }

/* 取出 <header class="xh-ed-hero…"> 到 </header> 之间的片段 */
function heroOf(html) {
  const i = String(html).indexOf('<header class="xh-ed-hero');
  if (i < 0) return "";
  const j = String(html).indexOf("</header>", i);
  return String(html).slice(i, j < 0 ? i + 3000 : j + 9);
}
/* 把「本次修复」的四条收敛成一个可复用判定，供反向验证使用：
     ① 有模糊垫图层 ② 有照片本体图层且排在垫图之后 ③ 面具在图层之后 ④ header 自身不再画照片 */
function heroLayerOk(heroHtml) {
  const h = String(heroHtml);
  const iB = h.indexOf("xh-ed-hero-backdrop");
  const iF = h.indexOf('class="xh-ed-hero-fig"');
  const iM = h.indexOf("xh-ed-hero-mask");
  const gt = h.indexOf(">");
  const tag = gt < 0 ? h : h.slice(0, gt + 1);
  return iB >= 0 && iF > iB && iM > iF && !/background-image:url\(/.test(tag);
}

let dbg = {};
try {
  state.detailMode = "editorial";

  /* ========== §A keep 模式（竖图人物封面）：照片必须叠在糊图之上 ==========
     v200 用独立 URL 前缀：前序渲染会 scheduleSmartFocus → analyzeImageFocus().then()
     在后续 tick 回写同一 URL 的启发式 meta，把种入的视觉分析覆盖掉（竞态）——换前缀隔离。 */
  const K = mkActivity({ photos: ["https://example.com/v200k-p0.jpg"], coverIndex: 0 });
  seedMeta("https://example.com/v200k-p0.jpg", {
    ratio: 0.72, orientation: "portrait", quality_score: 0.9, category: "人物",
    subjects: [{ name: "队员", bbox: { x: 0.1, y: 0.05, w: 0.8, h: 0.9 } }],
    recommended_use: ["hero"], safe_text_area: "center", crop_risk: "high",
  });
  const heroK = heroOf(renderActivityEditorial(K));
  const tagK = heroK.slice(0, heroK.indexOf(">") + 1);

  add("A1 竖图高风险封面走 keep（原比例不横裁，P0-B 主体完整优先）", /class="xh-ed-hero[^"]*keep/.test(heroK), tagK.slice(0, 90));
  add("A2 存在模糊垫图层（两侧不是黑屏）", has(heroK, "xh-ed-hero-backdrop"), "");
  add("A3 存在照片本体图层 .xh-ed-hero-fig", has(heroK, 'class="xh-ed-hero-fig"'), "");
  add("A4 层序正确：垫图(0) → 照片(1) → 面具 → 文字（照片在糊图之上）", heroLayerOk(heroK), "");
  add("A5 fig 几何内联（contain 不裁主体 + z-index:1）——不依赖 styles.css 缓存版本",
    /class="xh-ed-hero-fig"[^>]*background-size:contain/.test(heroK) && /class="xh-ed-hero-fig"[^>]*z-index:1/.test(heroK), "");
  /* ★ 本次回归的守门断言：照片只要还被画在 header 自身背景上，就会被 92% 不透明的垫图层整幅盖住 */
  add("A6 keep 模式 header 自身不再画照片（background-image:none）",
    !/background-image:url\(/.test(tagK) && /background-image:none/.test(tagK), tagK.slice(0, 110));
  add("A7 fig 用的就是封面那张图（未串图）", has(heroK, "v200k-p0.jpg"), "");

  /* ========== §B 老板的真实路径：手动指定封面（_coverManual + coverIndex 指向竖图） ========== */
  const M = mkActivity({ photos: ["https://example.com/v200m-p0.jpg", "https://example.com/v200m-p1.jpg"], coverIndex: 1, _coverManual: true });
  seedMeta("https://example.com/v200m-p0.jpg", { ratio: 1.5, orientation: "landscape", quality_score: 0.9, recommended_use: ["hero", "cover"] });
  seedMeta("https://example.com/v200m-p1.jpg", { ratio: 0.7, orientation: "portrait", quality_score: 0.95, category: "人物", recommended_use: ["hero"], crop_risk: "high" });
  const heroM = heroOf(renderActivityEditorial(M));
  add("B1 手动封面（_coverManual）仍按老板所选图渲染 hero", has(heroM, "v200m-p1.jpg"), "");
  add("B2 手动选中的竖图人物封面走 keep 且不虚化（图层齐全 + header 无图）", /keep/.test(heroM) && heroLayerOk(heroM), "");
  add("B3 老板所选封面未被自动改选（_coverManual 守护）", M.coverIndex === 1, "coverIndex=" + M.coverIndex);

  /* ========== §C 非 keep 模式（横图低风险）必须与旧行为一致 ========== */
  const N = mkActivity({ photos: ["https://example.com/v200n-p0.jpg"], coverIndex: 0 });
  seedMeta("https://example.com/v200n-p0.jpg", { ratio: 1.5, orientation: "landscape", quality_score: 0.88, recommended_use: ["hero", "cover"] });
  const heroN = heroOf(renderActivityEditorial(N));
  const tagN = heroN.slice(0, heroN.indexOf(">") + 1);
  add("C1 横图低风险仍走满幅 cover（不加 keep 类）", !/keep/.test(tagN), tagN.slice(0, 90));
  add("C2 非 keep 模式仍由 header 承载照片（行为未变）", /background-image:url\('https:\/\/example.com\/v200n-p0.jpg'\)/.test(tagN), "");
  add("C3 非 keep 模式不引入垫图层/照片图层（不多画无谓节点）",
    !has(heroN, "xh-ed-hero-backdrop") && !has(heroN, "xh-ed-hero-fig"), "");

  /* ========== §D 样式契约（z-index 链必须与 DOM 顺序一致） ========== */
  const rule = (sel) => {
    const m = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{([^}]*)\\}").exec(css);
    return m ? m[1] : "";
  };
  const rFig = rule(".xh-ed-hero-fig");
  const rBd = rule(".xh-ed-hero-backdrop");
  const rMask = rule(".xh-ed-hero.keep .xh-ed-hero-mask");
  const rTxt = rule(".xh-ed-hero.keep .xh-ed-hero-txt");
  const rKeep = rule(".xh-ed-hero.keep");
  add("D1 CSS：.xh-ed-hero-fig 存在且 contain + z-index:1", /background-size:\s*contain/.test(rFig) && /z-index:\s*1/.test(rFig), rFig.slice(0, 80));
  add("D2 CSS：垫图层 z-index:0 且保留模糊与提亮", /z-index:\s*0/.test(rBd) && /blur\(/.test(rBd) && /opacity:\s*\.9/.test(rBd), rBd.slice(0, 90));
  add("D3 CSS：keep 的 mask=2 / txt=3（都在照片图层之上，文字仍可读）", /z-index:\s*2/.test(rMask) && /z-index:\s*3/.test(rTxt), rMask + " | " + rTxt);
  add("D4 CSS：keep 加 overflow:hidden（收掉垫图 inset:-24px 的外溢）", /overflow:\s*hidden/.test(rKeep), rKeep.slice(0, 80));

  /* ========== §E 反向验证：判定函数必须能抓到这个 bug ========== */
  const figRe = /<div class="xh-ed-hero-fig"[^>]*><\/div>/;
  const noFig = heroK.replace(figRe, "");
  add("E1 反向验证：摘掉照片图层后 heroLayerOk 变 false", !heroLayerOk(noFig) && has(noFig, "xh-ed-hero-backdrop"), "（证明 A4 真能失败）");
  const v198Shape = noFig.replace('style="background-image:none"', "style=\"background-image:url('https://example.com/v200k-p0.jpg')\"");
  add("E2 反向验证：还原 v198 形态（照片画回 header 背景 + 无图层）heroLayerOk 变 false",
    !heroLayerOk(v198Shape) && /background-image:url\(/.test(v198Shape.slice(0, v198Shape.indexOf(">") + 1)), "（证明 A6 真能失败）");
  add("E3 反向验证：CSS 契约对旧值（mask=1 / txt=2）判 false",
    !(/z-index:\s*2/.test(".xh-ed-hero.keep .xh-ed-hero-mask { z-index: 1; }")), "");

  dbg = { keepHeroTag: tagK.slice(0, 150), layerOk: heroLayerOk(heroK), figInline: /class="xh-ed-hero-fig"[^>]*z-index:1/.test(heroK) };
} catch (e) {
  add("hero keep 图层渲染未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  total: checks.length,
  passed: checks.length - failed.length,
  checks,
  debug: dbg,
};
