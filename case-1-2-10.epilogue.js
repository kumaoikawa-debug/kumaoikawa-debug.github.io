// §六 最终验收：Case 1 / 2 / 10 的能力断言（确定性夹具，不依赖 AI Key 与视觉模型）
// ⚠️ 夹具契约：本文件被包进 async 函数体，必须「裸顶层 return」返回；顶层需含 ok:false 才判失败。
//   Case 1：15 张横向秋景（暖调）→ 大图 / 风景 / 暖感 / 杂志结构
//   Case 2：同活动换人物图 → 页面明显转成人物 / 体验主导（事实不变）
//   Case 10：回顾只有现场照片 → 不得虚构用户反馈和具体事件（阻断，而非仅检测）
state = (typeof initState === "function") ? initState() : (typeof loadState === "function" ? loadState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
const PIPE = (typeof CLUBOS_PIPELINE !== "undefined") ? CLUBOS_PIPELINE : {};
const dbg = {};

try {
  /* ===== 通用：向 PHOTO_FOCUS_CACHE 注入「内容识别」元信息（模拟真实视觉模型写回） ===== */
  const BASEV = {
    safe_text_area: "top-right", recommended_use: ["story"], category: "内容识别", emotion: "真实",
    focal_point: { x: 0.5, y: 0.45 }, cropRisk: null, motionScore: 0, quality_score: 0.82, sat: 0.4, edge: 18,
  };
  function injectSet(tag, n, o) {
    const srcs = [];
    for (let i = 0; i < n; i++) {
      const src = "case1210://" + tag + i + ".jpg";
      applyVision(src, Object.assign({}, BASEV, {
        pHash: { lo: Math.imul(i + 1, 0x9E3779B1) >>> 0, hi: Math.imul(i + 1, 0x85EBCA77) >>> 0 },
      }, o || {}));
      srcs.push(src);
    }
    return srcs;
  }
  const act = {
    id: "case12", type: "徒步", title: "秋季彩林徒步 · 龙门山环线", place: "龙门山",
    date: "2026-10-18", dateMD: "10月18日", days: 1, distance: 12, elevation: 1100,
    difficulty: "中等", price: 199, limit: 25, limitUnit: "人", ageRange: "8-60岁",
    gear: [{ name: "防滑徒步鞋", must: true }], photos: [],
  };
  const p12 = (typeof typeProfile === "function") ? typeProfile(act) : { themeA: "徒步", tone: "松弛" };

  /* ============ Case 1：15 张横向暖调秋景 → 大图/风景/暖感/杂志结构 ============ */
  const warmPhotos = injectSet("warm", 15, { orientation: "landscape", warmRatio: 0.55, blueRatio: 0.08, avgLum: 150, skinRatio: 0 });
  const a1 = Object.assign({}, act, { photos: warmPhotos });
  const pp1 = await photoProfile(a1, warmPhotos, "recruit");
  const cp1 = (typeof PIPE.photoContentProfile === "function") ? PIPE.photoContentProfile(warmPhotos) : {};
  const d1 = heuristicDirection(a1, p12, "route_editorial", "recruit", pp1);
  const pick1 = (typeof PIPE.autoEditorialPick === "function") ? PIPE.autoEditorialPick(a1) : null;
  const ac1 = (typeof PIPE.styleAccent === "function") ? PIPE.styleAccent(a1) : null;
  const pro1 = PIPE.describePhotoProfile ? PIPE.describePhotoProfile(buildPhotoIntelligence(warmPhotos, a1, [], "recruit")) : {};
  dbg.case1 = { warmth: cp1.warmthLabel, warmthRatio: cp1.warmthRatio, pick: pick1, color: d1.visual.color, mood: d1.visual.mood, pro: pro1.warmthLabel };

  add("Case1 照片画像识别为「暖调」（暖占比高且明显高于冷占比）",
    cp1.warmthLabel === "暖调" && cp1.warmthRatio > 0.5, JSON.stringify({ w: cp1.warmthRatio, c: cp1.coolRatio, label: cp1.warmthLabel }));
  add("Case1 画像并入 photoProfile（信号层已接入方向决策）",
    pp1.warmthLabel === "暖调" && pp1.usedLandscapeRatio >= 0.9, JSON.stringify({ label: pp1.warmthLabel, lr: pp1.usedLandscapeRatio }));
  add("Case1 图片画像 describePhotoProfile 也带暖感字段",
    pro1.warmthLabel === "暖调", "warmthLabel=" + pro1.warmthLabel);
  add("Case1 编辑方向转为暖调（color/mood/typographic/readingMood）",
    d1.visual.color === "山系橙" && d1.visual.mood === "暖调" && d1.visual.typographic === "衬线大标题"
    && d1.readingMood === "暖调向往" && /暖调/.test(d1.tone),
    JSON.stringify({ color: d1.visual.color, mood: d1.visual.mood, typo: d1.visual.typographic, rm: d1.readingMood, tone: d1.tone }));
  add("Case1 方向留有照片依据（photoLed.warmth）", d1.photoLed && d1.photoLed.warmth === "暖调", JSON.stringify(d1.photoLed));
  add("Case1 版式自动选「大图 + 杂志」轴（L-mosaic-story / S-season-mag）",
    !!pick1 && pick1.layout === "L-mosaic-story" && pick1.style === "S-season-mag", JSON.stringify(pick1));
  add("Case1 页面强调色转暖（styleAccent.warm）", !!(ac1 && ac1.warm), JSON.stringify({ accent: ac1 && ac1.accent, warm: ac1 && ac1.warm }));

  // 冷调素材不应被硬套暖感（避免「只要上传照片就变暖」的假阳性）
  const coolPhotos = injectSet("cool", 15, { orientation: "landscape", warmRatio: 0.05, blueRatio: 0.45, avgLum: 130, skinRatio: 0 });
  const aCool = Object.assign({}, act, { photos: coolPhotos });
  const ppCool = await photoProfile(aCool, coolPhotos, "recruit");
  const dCool = heuristicDirection(aCool, p12, "route_editorial", "recruit", ppCool);
  const acCool = PIPE.styleAccent ? PIPE.styleAccent(aCool) : null;
  add("Case1 冷调素材：不套暖感（label=冷调、无色温改写、无暖 accent）",
    ppCool.warmthLabel === "冷调" && dCool.visual.mood !== "暖调" && dCool.visual.color === "墨绿" && !(acCool && acCool.warm),
    JSON.stringify({ label: ppCool.warmthLabel, mood: dCool.visual.mood, color: dCool.visual.color }));

  /* ============ Case 2：同活动换人物图 → 人物/体验主导（事实不变） ============ */
  const peoplePhotos = injectSet("people", 15, { orientation: "landscape", skinRatio: 0.06, warmRatio: 0.2, blueRatio: 0.1, avgLum: 140, sat: 0.35 });
  const a2 = Object.assign({}, act, { photos: peoplePhotos });
  const pp2 = await photoProfile(a2, peoplePhotos, "recruit");
  const d2 = heuristicDirection(a2, p12, "route_editorial", "recruit", pp2);
  const pick2 = PIPE.autoEditorialPick ? PIPE.autoEditorialPick(a2) : null;
  const dom2 = PIPE.photoDominance ? PIPE.photoDominance(pp2) : {};
  dbg.case2 = { peopleRatio: dom2.peopleRatio, peopleLed: dom2.peopleLed, angle: d2.angle, comp: d2.visualFocus, pick: pick2, struct: d2.structure };

  add("Case2 人物占比高 → 判定为「人物主导」",
    dom2.peopleLed === true && dom2.peopleRatio >= 0.5, JSON.stringify({ pr: dom2.peopleRatio, led: dom2.peopleLed }));
  add("Case2 角度/钩子转为人物视角（与风景版明显不同）",
    d2.angle !== d1.angle && /人/.test(d2.angle) && d2.hook !== d1.hook, "angle=" + d2.angle + " hook=" + d2.hook);
  add("Case2 版式组合转为人物/体验主导（网格画廊 + 人物推进 + 热闹陪伴）",
    d2.visualFocus === "网格画廊" && d2.visual.mood === "人物主导" && d2.storyStyle === "人物推进" && d2.readingMood === "热闹陪伴",
    JSON.stringify({ comp: d2.visualFocus, mood: d2.visual.mood, story: d2.storyStyle, rm: d2.readingMood }));
  add("Case2 章节结构明显变化（同家族内按主体切换）",
    d2.structure.join("|") !== d1.structure.join("|") && d2.structure[0] !== d1.structure[0],
    "风景版=" + d1.structure.join(" / ") + " ⏐ 人物版=" + d2.structure.join(" / "));
  add("Case2 页面版式自动切到人物/体验轴（L-strip-exp / S-social-conv）",
    !!pick2 && pick2.layout === "L-strip-exp" && pick2.style === "S-social-conv", JSON.stringify(pick2));

  // 结构变化不得丢事实：每个新标题都要路由到非空正文桶（v185 教训）
  const m2 = { confirmedFacts: (typeof extractFacts === "function") ? extractFacts(a2, []) : {} };
  const emptyHeads2 = d2.structure.filter((h) => {
    const body = (typeof sectionBody === "function") ? sectionBody(h, a2, m2) : "";
    return !body || !String(body).replace(/<[^>]+>/g, "").trim();
  });
  add("Case2 人物版结构：每个标题都产出非空 fallback 正文（事实未丢）", emptyHeads2.length === 0, "empty=" + emptyHeads2.join(","));

  // 事实一致性：换图不换事实
  const f1 = (typeof extractFacts === "function") ? extractFacts(a1, []) : {};
  const f2 = (typeof extractFacts === "function") ? extractFacts(a2, []) : {};
  const stripCount = (o) => { const c = Object.assign({}, o); delete c.photosCount; return JSON.stringify(c); };
  add("Case2 换图不改事实（除照片数外 confirmedFacts 完全一致）", stripCount(f1) === stripCount(f2), "");

  // 亲子/竖图人物 → 陪伴画册（竖图原比例，不横裁孩子）
  const kidPhotos = injectSet("kid", 12, { orientation: "portrait", skinRatio: 0.12, warmRatio: 0.3, blueRatio: 0.1, avgLum: 145, quality_score: 0.85 });
  const aKid = Object.assign({}, act, { id: "case12kid", type: "亲子", title: "亲子自然观察 · 溪谷寻秋", photos: kidPhotos });
  const pickKid = PIPE.autoEditorialPick ? PIPE.autoEditorialPick(aKid) : null;
  add("Case2 亲子竖图：自动选「陪伴画册」（子类分支生效）",
    !!pickKid && pickKid.layout === "L-thumbs-social" && pickKid.style === "S-companion-album", JSON.stringify(pickKid));

  /* ============ Case 10：回顾只有现场照片 → 不得虚构用户反馈和具体事件 ============ */
  const recapPhotos = ["case1210://r0.jpg", "case1210://r1.jpg", "case1210://r2.jpg", "case1210://r3.jpg", "case1210://r4.jpg"];
  const a10 = {
    id: "case10", type: "徒步", title: "赵公山周末徒步", place: "赵公山",
    date: "2026-10-02", dateMD: "10月2日", days: 1, distance: 8, elevation: 1200,
    difficulty: "中等", price: 168, limit: 25, limitUnit: "人", photos: recapPhotos,
  };
  const m10 = (typeof buildContentMaster === "function") ? buildContentMaster(a10, recapPhotos) : { confirmedFacts: {} };
  const act10 = extractActualActivityData(a10, "");
  const dir10 = { structure: ["开场", "本次活动核心记忆", "本次参与体验", "值得记住的瞬间", "参与者收获", "照片回顾", "下一期预告"], angle: "赵公山徒步回顾", family: "brand_journal", variant: 0 };

  add("Case10 只有现场照片时判定为「无真实来源」（照片不算事件来源）",
    PIPE.recapHasActualEvidence("", act10) === false && act10.actualFeedback.length === 0, JSON.stringify({ fb: act10.actualFeedback, notes: act10.providedNotes }));

  const mkFab = () => ({
    gzh: {
      title: "回顾｜赵公山周末徒步", summary: "这一程，大家一致说值。",
      sections: [
        { h: "开场", html: "<p>10月2日，赵公山，这场「赵公山周末徒步」结束了。</p>" },
        { h: "核心记忆", html: "<p>现场共 5 张照片，记录了山野与路线。</p>" },
        { h: "参与体验", html: "<p>出发前先做了热身，队伍一起沿着溪谷前行。孩子们一路上唱歌，家长们互相照应。</p>" },
        { h: "瞬间", html: "<p>返程车上大家意犹未尽，都说下次还来。</p>" },
        { h: "收获", html: "<p>参与者反馈很好，好评一片。</p>" },
      ], next: "咱们还会继续进山，下一期路线正在安排，留意群里接龙就能占位。",
    },
    xhs: { titles: ["回顾｜赵公山周末徒步"], body: "刚结束的一次徒步\n\n热身完就出发了\n合影留念", coverText: "活动回顾·赵公山", hashtags: [], imageOrder: [] },
    moments: "【活动回顾】结束了。大家一致说值。",
    wechat: "各位群友，本次活动已经结束。\n\n大家玩得特别开心。",
  });
  const fabOut = mkFab();
  const removed1 = PIPE.stripFabricatedRecapEvents(fabOut, "", act10);
  const fabTxt = JSON.stringify(fabOut);
  dbg.case10 = { removed: removed1, keepNext: /下一期路线正在安排/.test(fabOut.gzh.next) };

  add("Case10 无来源现场事件被阻断（removed 含「现场事件」）", removed1.indexOf("现场事件") >= 0, JSON.stringify(removed1));
  add("Case10 具体现场环节被删（热身 / 一起沿着溪谷前行）",
    !/热身/.test(fabTxt) && !/一起沿着/.test(fabTxt), "");
  add("Case10 参与者反应被删（意犹未尽 / 玩得特别开心）",
    !/意犹未尽/.test(fabTxt) && !/玩得特别开心/.test(fabTxt), "");
  add("Case10 无来源照片记录与「下一期预告」保留（不误删合规内容）",
    /现场共 5 张照片/.test(fabTxt) && /下一期路线正在安排/.test(fabTxt), "");
  add("Case10 无来源的「大家一致说值 / 好评一片」被质量检查判为无依据（用户反馈）",
    (function () {
      const cq = contentQuality({ gzh: { title: "回顾", summary: "这一程，大家一致说值。", sections: [{ h: "a", html: "<p>参与者反馈很好，好评一片。</p>" }], next: "y" } }, dir10, "recap", m10.confirmedFacts, act10);
      return (cq.flags || []).indexOf("unsupported:用户反馈") >= 0;
    })(), "");

  // 有真实来源 → 绝不干预（不误删用户确认过的现场叙述）
  const fabOut2 = mkFab();
  const notesOK = "当天很晒，孩子们第一次自己走上山顶，家长说这次很有意义。";
  const actWithNotes = extractActualActivityData(a10, notesOK);
  const removed2 = PIPE.stripFabricatedRecapEvents(fabOut2, notesOK, actWithNotes);
  add("Case10 有补充资料 → 闸门不干预（removed 为空且原文保留）",
    removed2.length === 0 && /热身/.test(JSON.stringify(fabOut2)), JSON.stringify(removed2));

  // 末次质检必须带 actual：带 → 用户确认过的反馈句保留；漏传 → 被误删（真缺陷回归）
  const mkConfOut = () => ({
    gzh: {
      title: "回顾", summary: "x",
      sections: [
        { h: "a", html: "<p>参与者反馈：孩子们第一次自己走上山顶。</p>" },
        { h: "b", html: "<p>本次以现场照片为准。</p>" },
        { h: "c", html: "<p>活动详情以发布页为准。</p>" },
      ], next: "y",
    },
  });
  const actFB = extractActualActivityData(Object.assign({}, a10, { actualActivityData: { actualFeedback: ["孩子们第一次自己走上山顶，家长很满意"] } }), "");
  state.xf = { scenario: "recap", out: null, master: m10 };
  const outWith = mkConfOut(); qualityCheck(outWith, dir10, "recap", m10.confirmedFacts, actFB);
  const keptWith = /参与者反馈/.test(JSON.stringify(outWith));
  state.xf = { scenario: "recap", out: null, master: m10 };
  const outWithout = mkConfOut(); qualityCheck(outWithout, dir10, "recap", m10.confirmedFacts, {});
  const keptWithout = /参与者反馈/.test(JSON.stringify(outWithout));
  add("Case10 带 actual → 用户确认过的反馈句保留；漏传 → 被误删（证明末次质检须带 actual）",
    keptWith === true && keptWithout === false, JSON.stringify({ withActual: keptWith, withoutActual: keptWithout }));

  // 端到端：只有照片的真实链路（genRecap 兜底路径）不得出现虚构现场事件
  state.xf = { scenario: "recap", out: null, master: m10, _styleHistory: [] };
  const out10 = await genRecap(a10, m10, { editorialDirection: dir10 }, recapPhotos, "");
  const txt10 = JSON.stringify(out10);
  const q10 = state.xf.quality || {};
  const EVENTS = [/热身/, /一起沿着/, /意犹未尽/, /合影留念/, /互相照应/, /大家一致/, /好评一片/];
  add("Case10 端到端（仅现场照片）：回顾正文零虚构现场事件",
    out10 && out10.gzh && (out10.gzh.sections || []).length >= 5 && EVENTS.every((re) => !re.test(txt10)),
    "sections=" + ((out10.gzh && out10.gzh.sections || []).length));
  add("Case10 端到端：兜底版就是「照片现场记录」（含现场照片/以现场照片为准）",
    /现场照片|现场共/.test(txt10), "");
  add("Case10 端到端：闸门已挂载到质量状态（fabricationGuard 为空 = 无需阻断）",
    !!q10 && (!q10.fabricationGuard || q10.fabricationGuard.length === 0), JSON.stringify({ guard: q10.fabricationGuard, flag: q10.flag }));
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
