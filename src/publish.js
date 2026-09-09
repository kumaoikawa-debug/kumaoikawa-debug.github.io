/* ================= ClubOS · AI 宣发中心（v113） =================
   一次理解，多平台适配：上传活动资料/照片 → 提取 Content Master →
   生成并排版微信公众号图文（4 套版式，可编辑、可复制 HTML）+
   小红书 / 朋友圈 / 微信群 / 口播 / 海报；活动结束可生成活动回顾。
   无 AI Key 时全部回退到基于真实活动事实的模板生成。 */

/* ================= ClubOS · AI 宣发中心 V2（两阶段生成 + Editorial Direction） =================
   流程：confirmedFacts → Content Strategy → Photo Analysis → Editorial Direction
        → AI 完整文案（六平台） → Layout Plan（family/variant） → 前端组件渲染
   所有文案原则上由 AI 基于真实事实生成；无 Key 时回退到基于事实的模板（仍受 Editorial Direction 驱动）。
   两最高原则：① 允许创造表达，禁止创造事件（不虚构天气/领队行为/用户感受/具体人数/未提供价格）；
              ② 换版式只改视觉、换风格才重生成方向+文案。 */

/* Editorial 家族：3 招募 + 3 回顾，每族 ≥3 变体 = 18 版式 */
var XF_FAMILIES = {
  diary:       { label: "沉浸叙事", scenario: ["recruit", "recap"], variants: ["山野日记", "晨昏手札", "长线随记"] },
  magazine:    { label: "户外杂志", scenario: ["recruit", "recap"], variants: ["杂志专题", "大片跨页", "极简刊例"] },
  social:      { label: "社交种草", scenario: ["recruit"],           variants: ["潮流卡片", "清单体", "对话体"] },
  family:      { label: "亲子自然", scenario: ["recruit", "recap"], variants: ["手账步骤", "问答体", "绘本体"] },
  achievement: { label: "成就展示", scenario: ["recap"],             variants: ["数据战报", "登顶纪实", "勋章墙"] },
  gallery:     { label: "图文画廊", scenario: ["recap"],             variants: ["长图长廊", "九宫格", "胶片墙"] },
};
/* 家族 → 基础版式渲染器（变体在渲染器内做差异化） */
var XF_FAMILY_LAYOUT = { diary: "diary", magazine: "magazine", social: "youth", family: "family", achievement: "challenge", gallery: "longform" };

function xfState() {
  state.xf = state.xf || {
    scenario: null, aid: null, step: null,
    master: null, out: null, recap: null,
    layout: "diary", family: "diary", variant: 0, styleSeed: null,
    photos: [], notes: "", recapNotes: "",
    genState: "idle", platTab: "gzh", recapType: "",
    strategy: null, quality: null,
    customRecap: { title: "", date: "", place: "", type: "", signups: "", leader: "" },
    _a: null, _styleHistory: [],
  };
  if (!state.xf.customRecap) state.xf.customRecap = { title: "", date: "", place: "", type: "", signups: "", leader: "" };
  if (!state.xf._styleHistory) state.xf._styleHistory = [];
  var xf0 = state.xf;
  if (xf0.scenario === "recruit" && xf0.step === "result") {
    if (!xf0.out || !xf0.master || !xf0.master.mainTheme) { xf0.step = null; xf0.out = null; }
  }
  if (xf0.scenario === "recap" && xf0.step === "result") {
    if (!xf0.recap) { xf0.step = null; }
  }
  return xf0;
}

/* ---------- 工具 ---------- */
function xfSeason(a) {
  const ds = a.dateMD || a.date || "";
  const m = ds.match(/(\d{4})[-/](\d{1,2})/) || ds.match(/(\d{1,2})[-/](\d{1,2})/);
  if (!m) return "";
  const mo = +m[2];
  if (mo >= 3 && mo <= 5) return "春季";
  if (mo >= 6 && mo <= 8) return "夏季";
  if (mo >= 9 && mo <= 11) return "秋季";
  return "冬季";
}
function xfTargetUser(a) {
  const t = (a.type || "") + (a.audience || []).join("") + (a.title || "");
  if (/亲子|研学|自然|儿童/.test(t)) return "3-12 岁孩子的家庭，希望周末高质量陪伴";
  if (/露营|营地|派对|音乐/.test(t)) return "想松弛社交、逃离内卷的年轻都市人";
  if (/漂流|溯溪|水上|桨板/.test(t)) return "怕热又爱玩水、想痛快释放的户外新人";
  if (/登山|雪山|越野|高海拔|攀岩/.test(t)) return "有训练基础、追求挑战与完成感的老驴";
  if (/摄影|出片|风光|银河/.test(t)) return "喜欢用相机记录山河的摄影爱好者";
  return "平时坐办公室、周末想动一动的城市人群";
}
function xfConcern(a) {
  const t = (a.type || "") + (a.title || "");
  if (/亲子|研学/.test(t)) return "安全、孩子能否玩得投入、大人是否轻松";
  if (/漂流|溯溪|水上/.test(t)) return "会不会太危险、装备怎么准备、谁带";
  if (/登山|雪山|越野|高海拔/.test(t)) return "强度是否匹配自己、路线是否成熟、保障是否到位";
  return "值不值这个价、强度适不适合我、有没有人带";
}

function xfTypeProfile(a) {
  const t = (a.type || "") + (a.title || "");
  if (/亲子|研学|自然|儿童|少儿/.test(t)) return { kind: "family", tone: "温暖、轻快、有画面", themeA: "陪孩子去自然里上一堂户外课", scenic: "孩子能蹲下来观察的昆虫、溪流与植物", experience: "亲子协作的小任务，孩子在玩里认识世界", participation: "一段高质量陪伴，和孩子共同的自然记忆" };
  if (/露营|营地|星空|音乐|派对/.test(t)) return { kind: "camp", tone: "松弛、年轻、有氛围", themeA: "周末逃离城市，去营地躺平看星星", scenic: "开阔草地、营火与星空的氛围画面", experience: "搭帐篷、煮咖啡、围炉夜话的松弛社交", participation: "卸下疲惫的周末放松与同好相聚" };
  if (/漂流|溯溪|水上|溪降|桨板|皮划艇|冲浪/.test(t)) return { kind: "water", tone: "清凉、活泼、直接", themeA: "三伏天最爽的事，是跳进山里的水里", scenic: "清澈溪水与峡谷带来的清凉画面", experience: "戏水漂流直接的刺激与畅快", participation: "高温天极致的降温与释放" };
  if (/登山|雪山|高海拔|攀岩|攀冰|越野|重装|穿越/.test(t)) return { kind: "mountain", tone: "克制、专业、有力量", themeA: "用脚步丈量山脊，把城市留在脚下", scenic: "连绵山脊、云海与登顶视线的壮美", experience: "一步步向上的身体挑战与专注", participation: "体能突破与登顶完成的实在成就感" };
  if (/摄影|出片|风光|秋色|红叶|花海|银河/.test(t)) return { kind: "photo", tone: "审美、克制、有质感", themeA: "这片山，只为此刻的光而来", scenic: "此刻才有的光影与地貌层次", experience: "等一束光、构一张图的创作过程", participation: "带得走的一组自己拍的大片" };
  return { kind: "hike", tone: "真诚、自然、不浮夸", themeA: "走得动的山，才装得下周末的好心情", scenic: "行走其中才懂的山水与季节变化", experience: "呼吸、流汗、和朋友边走边聊的节奏", participation: "一次身体舒展与精神放空的周末充电" };
}

function xfCta(a) {
  const when = a.dateMD || a.date || "近期";
  const price = a.price != null ? "¥" + a.price + "/" + (a.limitUnit || "人") : "详询";
  return `报名方式：私信 / 群里接龙，或直接在本页提交报名。${when} 出发，名额${a.limit ? a.limit + (a.limitUnit || "人") + "，" : ""}先到先得。`;
}

/* ---------- Content Master（确认事实层 + 实际活动数据） ---------- */
function xfConfirmedFacts(a, photos) {
  return {
    activityName: a.title || "", activityType: a.type || "", place: a.place || "",
    date: a.dateMD || a.date || "", season: xfSeason(a),
    price: a.price != null ? a.price : "", limit: a.limit || "", limitUnit: a.limitUnit || "人",
    days: a.days || 1, ageRange: a.ageRange || "", audience: (a.audience || []).join("/"),
    distance: a.distance || "", elevation: a.elevation || "", difficulty: a.difficulty || "",
    meeting: a.meeting || "", meetTime: a.meetTime || "", returnTime: a.returnTime || "",
    includedServices: a.feeInclude || [], gear: (a.gear || []).map((g) => (g.name || g)),
    transport: a.transport || "", meal: a.meal || "", insurance: a.insurance || "",
    leader: a.leaderName ? (a.leaderName + (a.leaderYears ? "（" + a.leaderYears + "）" : "")) : "",
    itinerary: a.itineraryDays || [],
    photosCount: (photos || []).length,
  };
}
function buildContentMaster(a, photos) {
  const f = xfConfirmedFacts(a, photos);
  const p = xfTypeProfile(a);
  const cv = {
    scenicValue: p.scenic, experienceValue: p.experience, participationValue: p.participation,
    targetUser: xfTargetUser(a), mainConcern: xfConcern(a), mainSellingPoint: p.themeA,
  };
  const cs = { mainTheme: p.themeA, secondaryTheme: "", mainSellingPoint: p.themeA, audienceInsight: cv.targetUser, tone: p.tone };
  return {
    contentType: "recruitment", confirmedFacts: f, actualActivityData: f,
    targetAudience: cv.targetUser, mainTheme: cs.mainTheme, mainSellingPoint: cs.mainSellingPoint,
    scenicValue: cv.scenicValue, experienceValue: cv.experienceValue, participationValue: cv.participationValue,
    tone: cs.tone, keyImages: autoClassifyPhotos([...(photos || []), ...(a.photos || [])].filter((x, i, arr) => x && arr.indexOf(x) === i)), cta: xfCta(a),
  };
}

/* ---------- 照片分析（Photo Analysis） ---------- */
function xfPhotoCategory(src, i) {
  const meta = (typeof photoMeta === "function") ? photoMeta(src) : null;
  if (meta && meta.category) return meta.category;
  const order = ["cover", "scenic", "people", "action", "team", "gear", "meal", "camp", "route", "water", "detail"];
  return order[i % order.length];
}
function autoClassifyPhotos(photos) {
  return (photos || []).map((src, i) => ({ src: src, cat: xfPhotoCategory(src, i), i: i }));
}
function matchPhoto(m, prefer, idx) {
  const list = m.keyImages || [];
  if (!list.length) return null;
  const want = {
    cover: ["cover"], scenic: ["scenic", "route", "water", "camp", "detail", "cover"],
    experience: ["action", "people", "team", "scenic"], people: ["people", "team", "cover"],
  }[prefer] || [prefer];
  let f = list.find((p) => want.includes(p.cat));
  if (f) return f;
  return list[idx % list.length] || list[0];
}
async function xfPhotoProfile(a, photos, scenario) {
  const list = autoClassifyPhotos(photos || []);
  const byCat = {};
  list.forEach((p) => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  const has = (c) => (byCat[c] || []).length > 0;
  const peopleN = (byCat.people || []).length + (byCat.team || []).length;
  const base = {
    count: list.length,
    cats: Object.keys(byCat),
    cover: (byCat.cover && byCat.cover[0]) || list[0] || null,
    hasScenic: has("scenic") || has("route") || has("water") || has("camp"),
    hasPeople: has("people") || has("team"),
    hasAction: has("action"),
    hasDetail: has("detail") || has("gear"),
    sceneTypes: byCat.scenic ? ["自然风光"] : (byCat.water ? ["水上"] : (byCat.camp ? ["营地"] : [])),
    peopleCount: peopleN,
    crowdLevel: peopleN >= 3 ? "多人" : (peopleN >= 1 ? "小队" : "未出现人物"),
    actionTypes: byCat.action ? ["动态瞬间"] : [],
    mood: (byCat.scenic && byCat.scenic.length >= 3) ? "风景主导" : (has("people") ? "人物主导" : "综合"),
    emotion: has("people") ? "有陪伴感" : "宁静",
    note: list.length === 0 ? "未上传照片，建议补充 3-6 张活动照以增强排版" : "",
  };
  // 有 Key：调用 AI 做更细的照片理解（场景/情绪/人物/动作），回退到启发式
  if (aiAuthMode()) {
    try {
      const pp = await xfLLM(`你是户外照片分析助手。基于照片分类与活动信息，产出照片画像 JSON：{dominantScene(字符串), mood(风景主导/人物主导/综合), peopleCount(数字), crowdLevel(独行/小队/多人), actionTypes:[], emotion(宁静/活力/陪伴感/治愈), bestCoverCat(分类名), suggestion(一句话排版建议)}。禁止虚构照片内容，只能基于已给分类推断。`,
        `活动：${a.title || ""} 类型：${a.type || ""}\n照片分类：${JSON.stringify(base.cats)} 数量：${base.count}`, true);
      if (pp && pp.mood) {
        Object.assign(base, {
          aiMood: pp.mood, dominantScene: pp.dominantScene || base.sceneTypes.join(""),
          peopleCount: pp.peopleCount != null ? pp.peopleCount : base.peopleCount,
          crowdLevel: pp.crowdLevel || base.crowdLevel,
          actionTypes: pp.actionTypes || base.actionTypes,
          emotion: pp.emotion || base.emotion,
          bestCoverCat: pp.bestCoverCat || "", suggestion: pp.suggestion || "",
        });
      }
    } catch (e) { /* 回退启发式 base */ }
  }
  return base;
}

/* ---------- AI 增强（可选） ---------- */
async function xfLLM(system, user, json) {
  if (!aiAuthMode()) return null;
  try {
    return await clubLLM({ system: system, user: user, json: !!json, temperature: 0.7 });
  } catch (e) { return null; }
}

/* ---------- styleSeed + 加权随机（Rule-based Weighted Randomization） ---------- */
function xfStyleSeed() {
  const xf = xfState();
  if (!xf.styleSeed) xf.styleSeed = Math.floor((Date.now() % 1000000) + Math.random() * 1000);
  return xf.styleSeed;
}
function xfRand(seed) {
  let x = Math.sin(seed * 999.137) * 10000;
  return x - Math.floor(x);
}
function xfWeightedPick(keys, weight, seed) {
  let total = 0; keys.forEach((k) => { total += Math.max(0.01, weight[k] || 1); });
  let r = xfRand(seed) * total;
  for (const k of keys) {
    r -= Math.max(0.01, weight[k] || 1);
    if (r <= 0) return k;
  }
  return keys[keys.length - 1];
}
function xfPickFamily(a, photos, scenario) {
  const allowed = Object.keys(XF_FAMILIES).filter((f) => XF_FAMILIES[f].scenario.includes(scenario));
  const t = (a.type || "") + (a.title || "");
  const weight = {}; allowed.forEach((f) => { weight[f] = 1; });
  if (/亲子|研学|自然|儿童/.test(t)) { weight.family += 3; weight.diary += 1; }
  if (/摄影|风光|秋色|红叶|花海/.test(t)) { weight.magazine += 2; weight.gallery += 2; }
  if (/漂流|溯溪|水上|派对|音乐|露营/.test(t)) { weight.social += 2; weight.diary += 1; }
  if (/登山|雪山|越野|高海拔|攀岩/.test(t)) { weight.achievement += 3; weight.magazine += 1; }
  if (scenario === "recap") { weight.achievement += 2; weight.gallery += 2; weight.diary += 1; }
  return xfWeightedPick(allowed, weight, xfStyleSeed() * 1.7 + 3);
}
function xfPickVariant(family, scenario, seed) {
  const n = (XF_FAMILIES[family].variants || [""]).length;
  if (n <= 1) return 0;
  const hist = (state.xf && state.xf._styleHistory) || [];
  const last = hist.filter((h) => h.family === family).slice(-1)[0];
  let v = Math.floor(xfRand(seed * 7.13 + 11) * n) % n;
  if (last && last.variant === v) v = (v + 1) % n;
  return v;
}

/* ---------- 阶段一：Content Strategy + Photo Analysis + Editorial Direction ---------- */
function xfHeuristicDirection(a, p, family, scenario, photoProfile) {
  const angleMap = {
    family: "把自然变成孩子的第一间教室", social: "这周末，去山里当个本地人",
    diary: "走得慢一点，才看得见山", magazine: "这一程，值得被认真记录",
    achievement: "我们真的把这座山走完了", gallery: "把这一程，存进相册里",
  };
  const hookMap = {
    family: "原来陪玩也能这么省心", social: "谁懂啊这地方", diary: "山一直在，刚好今天有空",
    magazine: "这一程，值得被认真记录", achievement: "登顶那刻，值了", gallery: "九张图，装下整个周末",
  };
  const compMap = { diary: "大图主导", magazine: "左右交替", social: "卡片流", family: "手账步骤", achievement: "数据条+区块", gallery: "网格画廊" };
  const colorMap = { diary: "山系橙", magazine: "墨绿", social: "暖米", family: "松石", achievement: "夜空蓝", gallery: "暖米" };
  const structRecruit = ["为什么值得去", "来了会体验什么", "参加完你能得到什么", "适不适合我", "真实信息", "怎么报名"];
  const structRecap = ["开场", "本次活动核心记忆", "本次参与体验", "值得记住的瞬间", "参与者收获", "照片回顾", "下一期预告"];
  return {
    family: family, variant: xfPickVariant(family, scenario, xfStyleSeed()),
    styleSeed: xfStyleSeed(),
    angle: angleMap[family] || p.themeA,
    tone: p.tone,
    voice: scenario === "recap" ? "第一人称、认真回看" : "第一人称、像朋友安利",
    hook: hookMap[family] || "周末就该这么过",
    structure: scenario === "recap" ? structRecap : structRecruit,
    visual: { mood: photoProfile.mood, emotion: photoProfile.emotion, scene: photoProfile.dominantScene || (photoProfile.sceneTypes || []).join(""), color: colorMap[family], composition: compMap[family], coverHint: photoProfile.cover ? "用已上传封面" : "建议补充 1 张大图", typographic: family === "magazine" ? "衬线大标题" : "无衬线粗体" },
    copyDirectives: { avoid: ["硬销", "名额仅剩", "最后机会"], must: ["地点真实感", "基于已确认事实"] },
  };
}
async function genStrategy(a, photos, notes, scenario) {
  const facts = xfConfirmedFacts(a, photos);
  const photoProfile = await xfPhotoProfile(a, photos, scenario);
  const p = xfTypeProfile(a);
  const family = xfPickFamily(a, photos, scenario);
  const styleSeed = xfStyleSeed();
  const variant = xfPickVariant(family, scenario, styleSeed);
  let dir = null;
  if (aiAuthMode()) {
    const sys = `你是 ClubOS 的户外内容主编兼视觉指导。基于"已确认事实"产出一份 Editorial Direction（编辑方向），它将同时驱动文案写作与视觉排版。
原则：允许创造表达，禁止创造事件——只能基于给定事实（活动名称/地点/日期/强度/价格/领队/照片分类等），不得虚构天气、领队行为、用户感受、具体人数、未提供的价格。
返回 JSON：{
  angle: 一句话编辑角度（≤18字，带观点而非硬销），
  tone: 语气关键词,
  voice: 人称与口吻（如"第一人称松弛"）,
  hook: 一个情绪/反差钩子（≤14字）,
  structure: [4-6个章节标题，按消费者决策或回顾逻辑排序],
  visual: { mood, color:"山系橙/墨绿/夜空蓝/暖米/松石", composition:"大图主导/网格/左右交替/卡片流", coverHint, typographic:"衬线大标题/无衬线粗体/手写感" },
  copyDirectives: { avoid:[], must:[] }
}`;
    const user = `场景：${scenario === "recruit" ? "活动招募" : "活动回顾"}
事实：${JSON.stringify(facts)}
照片画像：${JSON.stringify(photoProfile)}
活动类型画像：${JSON.stringify({ kind: p.kind, themeA: p.themeA, tone: p.tone })}
补充资料：${notes || "无"}
指定编辑家族：${family}（${XF_FAMILIES[family].label}），变体序号：${variant}`;
    dir = await xfLLM(sys, user, true);
  }
  if (!dir || !dir.angle) dir = xfHeuristicDirection(a, p, family, scenario, photoProfile);
  dir.family = family; dir.variant = variant; dir.styleSeed = styleSeed;
  return {
    contentStrategy: {
      mainTheme: p.themeA, secondaryTheme: dir.angle || p.themeA,
      mainSellingPoint: p.themeA, audienceInsight: xfTargetUser(a),
      tone: p.tone, angle: dir.angle, hook: dir.hook, scenario: scenario,
    },
    photoProfile: photoProfile,
    editorialDirection: dir,
  };
}

/* ---------- 阶段二：AI 完整文案（六平台，全部由 AI 生成） ---------- */
function xfSectionBody(h, a, m) {
  const f = m.confirmedFacts;
  if (/为什么|值得去|风景|景|地点|路线|地貌/.test(h || "")) return `${m.scenicValue}。${f.place ? "在" + f.place + "的" : ""}${f.season ? f.season + "，" : ""}风景不是手机壁纸能替代的——得自己走一趟才装得下。`;
  if (/体验|玩|挑战|探索|运动|做/.test(h || "")) return `${m.experienceValue}。${f.days > 1 ? "两天一夜" : "一天"}的节奏里，你会暂时忘记待办清单，只剩下脚下的路和身边的人。`;
  if (/收获|得到|适合|谁|陪伴|成长/.test(h || "")) return `${m.participationValue}。比起又刷了一天手机，这种踏实感更耐放。`;
  if (/适合|谁|门槛/.test(h || "")) { const age = f.ageRange ? `适合 ${f.ageRange}` : "门槛友好"; return `${age}。${m.targetAudience}。这场有${f.leader || "专业领队"}带队，路线成熟，按自己的节奏走就好。`; }
  if (/信息|报名|费用|详情/.test(h || "")) return `${f.date || "近期"} 出发，${f.price != null ? "费用 ¥" + f.price + "/" + (f.limitUnit || "人") : "费用详询"}，${f.difficulty ? "强度" + f.difficulty : "强度友好"}。${m.cta}`;
  if (/预告|下一期|集结/.test(h || "")) return `咱们还会继续进山，下一期路线正在安排，留意群里接龙就能占位。`;
  return `${m.scenicValue} ${m.experienceValue}`;
}

function xfFallbackRecruit(a, m, dir) {
  const f = m.confirmedFacts;
  const struct = (dir.structure && dir.structure.length >= 4) ? dir.structure.slice(0, 6) : ["为什么值得去", "来了会体验什么", "参加完你能得到什么", "适不适合我", "真实信息", "怎么报名"];
  const sections = struct.map((h) => ({ h: h, html: xfSectionBody(h, a, m) }));
  const angle = dir.angle || m.mainTheme;
  return {
    gzh: {
      title: `${f.activityName || "这场活动"}｜${m.mainTheme}`,
      subtitle: `${dir.hook ? dir.hook + " · " : ""}${f.place ? "在" + f.place + "的" : ""}${f.season ? f.season : ""}${f.date || "近期"}出发`,
      summary: `${angle}。${m.scenicValue}本文讲清为什么值得去、来了体验什么、参加完能得到什么，以及真实的报名信息。`,
      sections: sections,
      info: xfInfoRows(a),
      fee: f.price != null ? `¥${f.price}/${f.limitUnit || "人"}${f.limit ? `，限 ${f.limit}${f.limitUnit || "人"}` : ""}` : "详询",
      service: (f.includedServices && f.includedServices.length) ? f.includedServices.join("、") : "专业领队全程陪同",
      cta: m.cta,
    },
    xhs: {
      titles: [xfXhsTitle(a, m, 1, dir), xfXhsTitle(a, m, 2, dir), xfXhsTitle(a, m, 3, dir)],
      body: `谁懂啊😭 ${angle}这么玩也太舒服了\n\n📍 ${f.place ? "在" + f.place + "的" : ""}${f.season || ""}这一程，不是手机壁纸能替代的——得自己走一趟才装得下。\n\n✅ 为什么值得去\n${m.scenicValue}。呼吸、流汗、和朋友边走边聊，比刷一天手机耐放多了。\n\n🎒 怎么玩\n${m.experienceValue}。${f.days > 1 ? "两天一夜" : "一天"}的节奏，不用赶景点，时间全是自己的。\n\n💡 真心话\n${m.participationValue}。真实去一次，比收藏一百篇攻略都管用。\n\n📌 实用信息\n· 时间：${f.date || "近期"}\n· ${f.price != null ? "费用：¥" + f.price + "/" + (f.limitUnit || "人") : "费用详询"}\n· ${f.difficulty ? "强度：" + f.difficulty : "强度友好"}\n· 装备：${(f.gear && f.gear.length) ? f.gear.slice(0, 4).join("、") : "轻装即可"}\n\n码住这篇，周末约起来👀 评论区扣 1 我拉你进群～`,
      cover: `${f.place || "山里"}·${xfSeason(a) || ""}封神`,
      tags: xfTags(a),
      imgOrder: [],
    },
    moments: {
      warm: `${dir.hook ? dir.hook + " " : ""}周末想透口气的不妨看过来🌿 ${f.place ? "在" + f.place + "的" : ""}${f.season || ""}局又开了，${f.date || ""} 出发。不用做攻略，跟着走就行，想一起的私我占位～`,
      formal: `【招募】${f.activityName || "本周活动"} · ${f.date || "近期"} 出发\n${angle}。名额不多，先把你那天的日历空出来☀️ 报名戳我或群里接龙。`,
      last: `⏰ 最后几个名额！${f.activityName || "本周活动"} ${f.date || ""} 出发，${angle}。错过这期要等下个月，想来的抓紧私信，手慢无～`,
    },
    wechat: {
      recruit: `各位群友好👋 ${f.activityName || "本周活动"} 开始招募啦，这趟真的别错过：\n🗓 时间：${f.date || "近期"}\n📍 地点：${f.place || "集合点群内发"}\n💰 ${f.price != null ? "费用：¥" + f.price + "/" + (f.limitUnit || "人") : "费用详询"}\n🔥 强度：${f.difficulty || "适中"}\n\n${angle}。名额有限，想一起的直接接龙或私信我，我帮你留位～`,
      brief: `【一句话】${f.activityName || "活动"} ${f.date || ""} 出发｜${angle}｜名额有限，戳我报名👇`,
    },
    voice: {
      s30: `大家好，这周末咱们去${f.place || "山里"}，主题是${angle}。${f.price != null ? "费用" + f.price + "一人" : "费用详询"}，强度${f.difficulty || "适中"}，新手也能跟上。想一起的朋友私信我报名哈。`,
      s60: `大家好，给大伙说个周末的好去处。咱们${f.date || "这周末"}去${f.place || "山里"}，这场活动的主题是${angle}。${m.experienceValue}，参加完${m.participationValue}。${f.price != null ? "费用" + f.price + "一人" : "费用详询"}，含${f.includedServices && f.includedServices.length ? f.includedServices.join("、") : "领队陪同"}，强度${f.difficulty || "适中"}，不用担心跟不上。名额不多，想一起的朋友现在就可以私信我报名。`,
    },
    poster: {
      title: f.activityName || "户外活动",
      sub: angle,
      place: f.place || "",
      points: [m.scenicValue, m.experienceValue].map((s) => s.split("。")[0]).filter(Boolean).slice(0, 2),
      time: f.date || "近期",
      price: f.price != null ? "¥" + f.price + " 起/" + (f.limitUnit || "人") : "详询",
      cta: "扫码 / 私信报名",
    },
  };
}

async function genRecruit(a, m, strategy) {
  const f = m.confirmedFacts;
  const dir = strategy.editorialDirection;
  const p = xfTypeProfile(a);
  const sys = `你是 ClubOS 户外俱乐部的多平台内容写手。严格遵循下面的 Editorial Direction 写作，所有事实只来自 confirmedFacts，禁止虚构天气/领队行为/用户感受/具体人数/未给的价格。
按各平台输出：
- gzh：公众号图文 JSON {title,subtitle,summary,sections:[{h,html}],info:[{k,v}],fee,service,cta}
- xhs：小红书 JSON {titles:[3-5],body,cover,tags:[]}
- moments：朋友圈三版 {warm,formal,last}
- wechat：微信群 {recruit,brief}
- voice：口播 {s30,s60}
- poster：海报 {title,sub,place,points:[2],time,price,cta}
所有标题/正文/章节标题/摘要/图片说明/CTA 由你创作，不要使用固定模板句式；章节标题参考 Editorial Direction.structure，但可根据事实调整。`;
  const user = `Editorial Direction：${JSON.stringify(dir)}
confirmedFacts：${JSON.stringify(f)}
价值：${m.scenicValue} / ${m.experienceValue} / ${m.participationValue}
受众：${m.targetAudience}`;
  let out = null;
  if (aiAuthMode()) {
    out = await xfLLM(sys, user, true);
    if (!out || !out.gzh || !out.gzh.sections || out.gzh.sections.length < 3) {
      out = await xfLLM(sys + "\n（上一次返回不完整，请严格返回全部 6 个平台的完整 JSON，gzh.sections 至少 4 段）", user, true);
    }
    out = xfQualityCheck(out, dir, "recruit") || out;
    // 质量检查不达标（含虚构表述）→ 自动重生成一次（更强事实约束）
    if (aiAuthMode() && state.xf && state.xf.quality && state.xf.quality.flag === "fiction_risk") {
      const retry = await xfLLM(sys + "\n⚠️ 上一版被质量检查判定含虚构表述。请严格只使用 confirmedFacts 中的事实，绝对禁止出现任何天气描写、领队具体行为、用户感受代词（我们/大家纷纷表示）、或任何未提供的数据。", user + "\n请基于已确认事实重新生成，确保零虚构。", true);
      if (retry && retry.gzh && retry.gzh.sections && retry.gzh.sections.length >= 3) {
        const rechk = xfQualityCheck(retry, dir, "recruit");
        if (!(state.xf.quality && state.xf.quality.flag === "fiction_risk")) out = rechk || retry;
      }
    }
  }
  if (!out || !out.gzh || !out.gzh.sections) out = xfFallbackRecruit(a, m, dir);
  out = xfQualityCheck(out, dir, "recruit") || out;
  return out;
}

/* ---------- 活动回顾 阶段二 ---------- */
function xfFallbackRecap(a, m, dir, photos, notes, type) {
  const f = m.confirmedFacts;
  const signN = a.signups || (a.departures ? a.departures.reduce((s, d) => s + (d.sign || 0), 0) : 0);
  const struct = (dir.structure && dir.structure.length >= 5) ? dir.structure.slice(0, 7) : ["开场", "本次活动核心记忆", "本次参与体验", "值得记住的瞬间", "参与者收获", "照片回顾", "下一期预告"];
  const sections = struct.map((h) => ({ h: h, html: xfRecapBody(h, a, m, signN, notes, type) }));
  const angle = dir.angle || (type + "的一天");
  return {
    gzh: {
      title: `回顾｜${f.activityName || "这场活动"}，${type === "完成挑战型" ? "我们登顶了" : "我们一起走过"}`,
      summary: `${f.date || "这场活动"}，${signN ? signN + " 位伙伴" : "一群伙伴"}在${f.place || "山野"}${angle}。`,
      sections: sections,
      next: xfNextText(a),
    },
    xhs: {
      titles: [`回顾｜${f.activityName || "这场活动"}，值了🔥`, `周末去${f.place || "山里"}的人，后来都怎样了`, `${type}的一天，比想象中更难忘`],
      body: `刚结束的${f.activityName || "这场活动"}，我宣布：值了📷\n\n🌟 最难忘的瞬间\n${sections[1] ? sections[1].html : ""}\n\n🤝 一起走过的人\n${sections[3] ? sections[3].html : ""}\n\n💬 真心话\n真实去一次，比任何攻略都具体。下一期${xfNextText(a)}，我已经先占位了。\n\n评论区蹲下次活动的小伙伴扣 1 👇`,
      cover: `圆满收官·${f.place || "山里"}`,
      tags: xfTags(a).concat(["活动回顾"]),
    },
    moments: `【活动回顾】${f.activityName || "本周活动"}顺利收官🎉 ${signN ? signN + " 位伙伴" : "大家"}一起${type === "完成挑战型" ? "把山踩在了脚下" : "度过了超舒服的一天"}。最开心的不是到达，是路上有人一起走。下一期${xfNextText(a)}`,
    wechat: `各位群友，咱们的${f.activityName || "活动"}圆满收官啦🌿 ${signN ? "共 " + signN + " 位伙伴参加" : "大家玩得超尽兴"}。\n\n特别感谢每一位准时出发、互相照应的伙伴——下次还跟你走。照片已整理在相册，记得自取📷\n\n错过这一次的别慌，${xfNextText(a)}想一起的下期提前占位，我帮你留着～`,
    next: xfNextText(a),
  };
}
function xfRecapBody(h, a, m, signN, notes, type) {
  const f = m.confirmedFacts;
  if (/开场|集结/.test(h || "")) return `${f.date || "那天"}，${signN ? signN + " 位伙伴" : "我们"}在${f.place || "集合点"}汇合。${type === "完成挑战型" ? "目标很明确：走完它。" : "没有什么宏大目标，就是认真地把这一天过好。"}`;
  if (/核心记忆|风景|画面|景/.test(h || "")) return `${(type === "风景纪实型") ? (m.scenicValue + "，这一程的景色是主线。") : (m.experienceValue + "，大家投入的样子就是最好的回忆。")}`;
  if (/参与体验|强度|节奏/.test(h || "")) return `${f.difficulty ? "强度" + f.difficulty + "，" : ""}但节奏把控得刚好。${f.leader ? f.leader + "带队，" : ""}该停就停，该走就走。`;
  if (/瞬间|记得|特别/.test(h || "")) return notes && notes.trim() ? `这次特别记下：${notes.trim()}` : `合照那一刻、抵达那一刻、还有返程车上安静下来的那一刻——都算数。`;
  if (/收获|得到/.test(h || "")) return `${m.participationValue}。有人说来对了，这就够。`;
  if (/照片|相册|回顾/.test(h || "")) return `这一程的画面都在下面，留给一起走过的人。`;
  if (/预告|下一期|集结/.test(h || "")) return xfNextText(a);
  return `${m.experienceValue}`;
}

async function genRecap(a, m, strategy, photos, notes) {
  const f = m.confirmedFacts;
  const dir = strategy.editorialDirection;
  const type = xfRecapType(a, photos);
  const signN = a.signups || (a.departures ? a.departures.reduce((s, d) => s + (d.sign || 0), 0) : 0);
  const sys = `你是 ClubOS 户外俱乐部内容主笔，写活动回顾。像真正参加过的人认真回看这一天：真实、有画面、有完成感。
原则：允许创造表达，禁止创造事件——只基于给定事实与补充资料，不得虚构天气/事件/用户感受/领队行为/具体人数。
按各平台输出：
- gzh：公众号回顾 JSON {title,summary,sections:[{h,html}],next}
- xhs：小红书回顾 JSON {titles:[3],body,cover,tags:[]}
- moments：朋友圈回顾文案（字符串）
- wechat：微信群感谢文案（字符串）
- next：下一期预告（字符串）
章节标题参考 Editorial Direction.structure，但可按回顾逻辑调整。`;
  const user = `Editorial Direction：${JSON.stringify(dir)}
事实：${JSON.stringify(f)}
回顾类型：${type}
实际参与：${signN} 人
补充资料：${notes || "无"}
照片：${photos.length} 张（已分类）`;
  let out = null;
  if (aiAuthMode()) {
    out = await xfLLM(sys, user, true);
    if (!out || !out.gzh || !out.gzh.sections || out.gzh.sections.length < 4) {
      out = await xfLLM(sys + "\n（请严格返回完整 JSON：gzh.sections 至少 5 段，moments/wechat/next 为字符串）", user, true);
    }
    out = xfQualityCheck(out, dir, "recap") || out;
    // 质量检查不达标 → 自动重生成一次（更强事实约束）
    if (aiAuthMode() && state.xf && state.xf.quality && state.xf.quality.flag === "fiction_risk") {
      const retry = await xfLLM(sys + "\n⚠️ 上一版被质量检查判定含虚构表述。请严格只用事实与补充资料，禁止任何天气/事件/用户感受/领队行为描写。", user + "\n请基于事实重新生成，确保零虚构。", true);
      if (retry && retry.gzh && retry.gzh.sections && retry.gzh.sections.length >= 4) {
        const rechk = xfQualityCheck(retry, dir, "recap");
        if (!(state.xf.quality && state.xf.quality.flag === "fiction_risk")) out = rechk || retry;
      }
    }
  }
  if (!out || !out.gzh || !out.gzh.sections) out = xfFallbackRecap(a, m, dir, photos, notes, type);
  out = xfQualityCheck(out, dir, "recap") || out;
  return out;
}

/* ---------- 质量检查（ContentQualityCheck / EditorialQualityCheck） ---------- */
function xfQualityCheck(out, dir, scenario) {
  if (!out) return out;
  const gzh = out.gzh;
  if (!gzh || !gzh.sections || gzh.sections.length < 3) return out;
  const FORBID = ["万里无云", "阳光明媚", "下起了雨", "突然放晴", "领队说", "大家纷纷表示", "据说", "据说当时", "不得不说", "说实话", "我们都很", "大家都说", "很多人都说"];
  let bad = 0; const hits = [];
  const scan = (s) => {
    if (s && typeof s === "object") { Object.values(s).forEach((v) => scan(v)); return; }
    const t = (s == null ? "" : String(s));
    (FORBID || []).forEach((w) => { if (t.indexOf(w) >= 0) { bad++; if (hits.indexOf(w) < 0) hits.push(w); } });
  };
  (gzh.sections || []).forEach((s) => scan(s.html));
  if (out.moments) scan(out.moments);
  if (out.wechat) scan(out.wechat);
  if (out.xhs && out.xhs.body) scan(out.xhs.body);
  if (bad > 0) {
    if (state.xf) state.xf.quality = { flag: "fiction_risk", count: bad, hits: hits.slice(0, 5), note: "检测到可能的虚构表述，已自动重生成一次；仍建议人工复核：" + hits.slice(0, 3).join("、") };
  } else if (state.xf) {
    state.xf.quality = { flag: "ok", note: "文案基于已确认事实" };
  }
  return out;
}

/* ---------- 文案辅助（保留原有模板回退用） ---------- */
function xfFitTitle(a) { return (a.audience && a.audience.length) ? `适合谁 · ${a.audience.join("/")}` : "适不适合我"; }
function xfFitText(a, m) {
  const f = m.confirmedFacts;
  const age = f.ageRange ? `适合 ${f.ageRange}` : "门槛友好";
  return `${age}。${m.targetAudience}。${f.concern ? "你可能担心" + f.concern + "——" : ""}这场有${f.leader || "专业领队"}带队，路线成熟，按自己的节奏走就好。`;
}
function xfInfoRows(a) {
  const rows = [];
  if (a.dateMD || a.date) rows.push({ k: "时间", v: a.dateMD || a.date });
  if (a.place) rows.push({ k: "地点", v: a.place });
  if (a.meeting) rows.push({ k: "集合", v: a.meeting + (a.meetTime ? " " + a.meetTime : "") });
  if (a.days > 1) rows.push({ k: "天数", v: a.days + " 天" });
  if (a.elevation) rows.push({ k: "海拔", v: a.elevation + " 米" });
  if (a.difficulty) rows.push({ k: "强度", v: a.difficulty });
  if (a.limit) rows.push({ k: "名额", v: a.limit + (a.limitUnit || "人") });
  if (a.leaderName) rows.push({ k: "领队", v: a.leaderName + (a.leaderYears ? "（" + a.leaderYears + "）" : "") });
  if (a.insurance) rows.push({ k: "保险", v: a.insurance });
  return rows;
}
function xfTags(a) {
  const t = (a.type || "") + (a.title || "");
  const base = ["户外", "周末去哪儿"];
  if (/亲子|研学/.test(t)) base.push("亲子户外", "自然教育");
  else if (/露营|营地/.test(t)) base.push("露营", "营地生活");
  else if (/漂流|溯溪|水上/.test(t)) base.push("玩水", "溯溪");
  else if (/登山|雪山|越野/.test(t)) base.push("徒步登山", "向上挑战");
  else if (/摄影/.test(t)) base.push("户外摄影", "出片");
  else base.push("徒步", "爬山");
  return base;
}
function xfXhsTitle(a, m, n, dir) {
  const f = m.confirmedFacts;
  const angle = (dir && dir.angle) ? dir.angle : m.mainTheme;
  const arr = [
    `${f.place || "山里"}的${xfSeason(a) || ""}也太好拍了｜${angle}`,
    `周末去哪？${f.activityName || "这场活动"}直接封神`,
    `谁懂啊，${f.place || "这儿"}才是${xfSeason(a) || "周末"}正确打开方式`,
    `${angle}｜一次说走就走的户外充电`,
    `${f.activityName || "活动"}实录：原来户外可以这么松弛`,
  ];
  return arr[(n - 1) % arr.length];
}
function xfRecapType(a, photos) {
  const t = (a.type || "") + (a.title || "");
  if (/亲子|研学|自然|儿童/.test(t)) return "亲子陪伴型";
  if (/雪山|越野|高海拔|重装|攀岩/.test(t)) return "完成挑战型";
  if (/漂流|溯溪|水上|露营|营地|派对/.test(t)) return "活动氛围型";
  if (/摄影|风光|秋色|红叶|花海/.test(t)) return "风景纪实型";
  if (photos && photos.length >= 6) return "团队成长型";
  return "户外体验型";
}
function xfNextText(a) {
  return `咱们还会继续进山，下一期路线正在安排，留意群里接龙就能占位。`;
}

/* ================= 渲染：AI 宣发中心 ================= */
function renderFabu() {
  const xf = xfState();
  return `
  <div class="section-head">
    <div class="section-title">AI 宣发中心</div>
    <div class="section-sub">上传活动资料和照片，ClubOS 自动理解内容、提炼传播主题、生成并排版微信公众号图文，同步生成小红书等内容。活动结束还能一键生成活动回顾。</div>
  </div>
  ${xfFlow()}
  ${xfLegacySection()}
  `;
}

function xfFlow() {
  const xf = xfState();
  if (!xf.scenario) return xfScenarioHtml();
  if (xf.scenario === "recruit") return xf.step === "result" && xf.out ? xfRecruitResult() : xfRecruitPicker();
  if (xf.scenario === "recap") return xf.step === "result" && xf.recap ? xfRecapResult() : xfRecapPicker();
  return xfScenarioHtml();
}

function xfScenarioHtml() {
  return `
  <div class="xf-hero">
    <div class="xf-hero-txt">
      <div class="eyebrow">一次理解 · 多平台适配</div>
      <h2>把活动资料和照片交给 ClubOS</h2>
      <p class="muted">自动生成公众号图文与小红书内容；活动结束还能生成完整活动回顾。目标：10–20 分钟完成初稿、排版与修改。</p>
    </div>
    <div class="xf-cards">
      <button class="xf-card" data-action="xfGoScenario" data-s="recruit">
        <span class="xf-card-ic">${ICON("send")}</span>
        <b>活动招募</b>
        <span>生成宣传内容</span>
        <i>公众号图文 · 小红书 · 朋友圈 · 微信群 · 口播 · 海报</i>
      </button>
      <button class="xf-card" data-action="xfGoScenario" data-s="recap">
        <span class="xf-card-ic">${ICON("camera")}</span>
        <b>活动回顾</b>
        <span>生成活动回顾</span>
        <i>选已完成活动 · 传照片 · 自动排版回顾</i>
      </button>
    </div>
  </div>`;
}

function xfActivityPicker(filterFn, label, emptyMsg) {
  const acts = (state.activities || []).filter(filterFn);
  return `
  <div class="xf-pick">
    <button class="btn btn-ghost btn-sm" data-action="xfGoScenario" data-s="back">${ICON("chevron-left")} 返回</button>
    <h3>${label}</h3>
    ${acts.length ? `<div class="xf-act-list">${acts.map((a) => `
      <div class="xf-act">
        <div class="xf-act-thumb" style="background-image:url('${(a.photos && a.photos[a.coverIndex || 0]) || ""}')"></div>
        <div class="xf-act-info">
          <b>${esc(a.title || "未命名活动")}</b>
          <span class="muted small">${(a.dateMD || a.date || "时间待定")} · ${esc(a.place || "")} · ${esc(a.status || "")}</span>
        </div>
        <button class="btn btn-primary btn-sm" data-action="xfPickActivity" data-aid="${a.id}">选择</button>
      </div>`).join("")}</div>` : `<div class="empty"><div class="e-ic">📭</div><div>${esc(emptyMsg || "没有符合条件的活动，先去「活动内容」创建一场吧。")}</div></div>`}
  </div>`;
}

function xfRecruitPicker() {
  const xf = xfState();
  return xfActivityPicker((a) => a.status === "recruiting" || a.status === "draft" || a.status === "full" || !a.status, "选择要招募的活动") +
    `<div class="xf-supp">
      <div class="panel"><div class="panel-head"><h3>补充资料（可选）</h3><span class="tiny muted">粘贴旧文案 / 备注，帮助 AI 更准</span></div>
        <div class="panel-body"><textarea class="textarea" data-xf="note" placeholder="例如：往年这篇活动阅读很高、客户最关心亲子安全、这次新增了溯溪环节…">${esc(xf.notes || "")}</textarea></div></div>
      <div class="panel"><div class="panel-head"><h3>添加图片 / 海报（可选）</h3><span class="tiny muted">用于公众号配图，自动分类</span></div>
        <div class="panel-body">
          <div class="xf-photos">${(xf.photos || []).map((p, i) => `<div class="xf-ph" style="background-image:url('${p}')"><button class="x" data-action="xfDelPhoto" data-i="${i}">${ICON("x")}</button></div>`).join("")}
            <label class="xf-ph-add">${ICON("upload")}<input type="file" id="xfPhotoInput" accept="image/*" multiple hidden></label></div>
          <button class="btn btn-primary btn-sm" data-action="xfRecruitGen" style="margin-top:10px">${ICON("sparkles")} 生成宣传内容</button>
        </div></div>
    </div>`;
}

function xfRecapPicker() {
  const xf = xfState();
  const c = xf.customRecap || {};
  const selected = xf.aid ? (state.activities || []).find((a) => a.id === xf.aid) : null;
  return xfActivityPicker((a) => a.status === "ended", "选择已结束的活动", "没有已结束活动，可直接填写下方信息生成回顾") +
    (selected ? `<div class="xf-supp"><div class="panel"><div class="panel-head"><h3>已选择活动</h3></div><div class="panel-body"><div class="xf-act" style="margin:0"><div class="xf-act-info"><b>${esc(selected.title || "未命名活动")}</b><span class="muted small">${(selected.dateMD || selected.date || "时间待定")} · ${esc(selected.place || "")}</span></div><button class="btn btn-ghost btn-sm" data-action="xfPickActivity" data-aid="">清除选择</button></div></div></div></div>` : "") +
    `<div class="xf-supp">
      <div class="panel"><div class="panel-head"><h3>或直接填写活动信息生成回顾</h3><span class="tiny muted">不绑定已有活动时使用这些信息</span></div>
        <div class="panel-body">
          <div class="xf-field"><label>活动名称</label><input class="input" data-xf="customTitle" placeholder="例如：虹口漂流一日记" value="${esc(c.title || "")}"></div>
          <div class="xf-field"><label>活动时间</label><input class="input" data-xf="customDate" placeholder="例如：9月28日" value="${esc(c.date || "")}"></div>
          <div class="xf-field"><label>活动地点</label><input class="input" data-xf="customPlace" placeholder="例如：都江堰虹口" value="${esc(c.place || "")}"></div>
          <div class="xf-field"><label>活动类型</label><input class="input" data-xf="customType" placeholder="漂流 / 登山 / 亲子 / 露营…" value="${esc(c.type || "")}"></div>
          <div class="xf-field"><label>参与人数</label><input class="input" data-xf="customSignups" type="number" placeholder="例如：18" value="${esc(c.signups || "")}"></div>
          <div class="xf-field"><label>领队 / 组织者</label><input class="input" data-xf="customLeader" placeholder="例如：阿龙" value="${esc(c.leader || "")}"></div>
        </div></div>
      <div class="panel"><div class="panel-head"><h3>上传本次活动照片</h3><span class="tiny muted">自动分类：封面/风景/人物/动作/团队/合影/细节</span></div>
        <div class="panel-body">
          <div class="xf-photos">${(xf.photos || []).map((p, i) => `<div class="xf-ph" style="background-image:url('${p}')"><button class="x" data-action="xfDelPhoto" data-i="${i}">${ICON("x")}</button><span class="xf-ph-cat">${xfPhotoCategory(p, i)}</span></div>`).join("")}
            <label class="xf-ph-add">${ICON("camera")}<input type="file" id="xfPhotoInput" accept="image/*" multiple hidden></label></div>
          <p class="tiny muted">分类为自动推断（演示），生成时按内容匹配到正文段落。</p>
        </div></div>
      <div class="panel"><div class="panel-head"><h3>补充资料（可选）</h3><span class="tiny muted">领队备注 / 用户反馈 / 特别瞬间 / 实际天气</span></div>
        <div class="panel-body"><textarea class="textarea" data-xf="recapNotes" placeholder="例如：当天其实放晴了、小朋友第一次自己爬上来、大家最满意的是晚餐…">${esc(xf.recapNotes || "")}</textarea>
          <button class="btn btn-primary btn-sm" data-action="xfRecapGen" style="margin-top:10px">${ICON("sparkles")} 生成活动回顾</button>
        </div></div>
    </div>`;
}

/* 平台 Tab */
function xfPlatTabs(active, prefix) {
  const tabs = [["gzh", "公众号"], ["xhs", "小红书"], ["moments", "朋友圈"], ["wechat", "微信群"], ["voice", "口播"], ["poster", "海报"]];
  return `<div class="xf-tabs">${tabs.map(([k, l]) => `<button class="xf-tab ${active === k ? "active" : ""}" data-action="xfPlatTab" data-k="${k}" data-prefix="${prefix}">${l}</button>`).join("")}</div>`;
}

function xfStyleBar(xf) {
  const sc = xf.scenario;
  const fams = Object.keys(XF_FAMILIES).filter((f) => XF_FAMILIES[f].scenario.includes(sc));
  const dir = xf.strategy && xf.strategy.editorialDirection;
  const vs = (XF_FAMILIES[xf.family] && XF_FAMILIES[xf.family].variants) || [""];
  return `<div class="xf-stylebar">
    <div class="xf-stylebar-row"><span class="xf-stylebar-lbl">编辑家族</span>${fams.map((f) => `<button class="xf-chip ${xf.family === f ? "active" : ""}" data-action="xfSwitchFamily" data-f="${f}">${XF_FAMILIES[f].label}</button>`).join("")}</div>
    <div class="xf-stylebar-row"><span class="xf-stylebar-lbl">版式变体</span>${vs.map((v, i) => `<button class="xf-chip ${xf.variant === i ? "active" : ""}" data-action="xfSwitchVariant" data-v="${i}">${v}</button>`).join("")}<button class="btn btn-ghost btn-sm" data-action="xfSwitchStyle">${ICON("refresh")} 换风格</button></div>
    ${dir ? `<div class="xf-dir">编辑方向：<b>${esc(dir.angle || "")}</b>${dir.hook ? ` · 钩子「${esc(dir.hook)}」` : ""} · 视觉 ${esc((dir.visual && dir.visual.color) || "")}/${esc((dir.visual && dir.visual.composition) || "")}</div>` : ""}
    ${xf.quality && xf.quality.note ? `<div class="xf-q">质量：${esc(xf.quality.note)}</div>` : ""}
  </div>`;
}

function xfRecruitResult() {
  const xf = xfState();
  const o = xf.out;
  if (xf.genState === "loading") return `<div class="xf-loading">${ICON("sparkles")} 正在生成宣传内容…</div>`;
  return `
  <div class="xf-back"><button class="btn btn-ghost btn-sm" data-action="xfReset">${ICON("chevron-left")} 重新选择</button></div>
  <div class="xf-theme"><span class="xf-theme-lbl">本次核心传播主题</span><b>${esc((xf.master || {}).mainTheme || "")}</b></div>
  ${xfStyleBar(xf)}
  ${xfPlatTabs(xf.platTab, "recruit")}
  <div class="xf-plat-body">
    ${xf.platTab === "gzh" ? xfGzhPanel(o.gzh, xf) : ""}
    ${xf.platTab === "xhs" ? xfXhsPanel(o.xhs) : ""}
    ${xf.platTab === "moments" ? xfMomentsPanel(o.moments) : ""}
    ${xf.platTab === "wechat" ? xfWechatPanel(o.wechat) : ""}
    ${xf.platTab === "voice" ? xfVoicePanel(o.voice) : ""}
    ${xf.platTab === "poster" ? xfPosterPanel(o.poster, xf) : ""}
  </div>`;
}

function xfGzhPanel(gzh, xf) {
  const base = XF_FAMILY_LAYOUT[xf.family] || "diary";
  return `
  <div class="xf-gzh-head">
    <button class="btn btn-primary btn-sm" data-action="xfCopyGzhHtml">${ICON("copy")} 复制公众号（HTML）</button>
  </div>
  ${base === "diary" ? xfGzhDiaryHtml(gzh, xf, false) : xfGzhClassicHtml(gzh, xf, base, false)}
  <p class="tiny muted">正文可直接点击修改（contenteditable）；换版式/换家族只改视觉，换风格才重生成文案。</p>`;
}
function xfPhotoForSection(h) {
  if (/为什么|值得去|风景|景|地点|路线|地貌/.test(h || "")) return "scenic";
  if (/体验|玩|挑战|探索|运动|做/.test(h || "")) return "experience";
  if (/收获|得到|适合|谁|陪伴|成长/.test(h || "")) return "people";
  return "scenic";
}

/* ---------- 公众号排版：图片与版式增强 ---------- */
function xfEyebrow(a, m) {
  const f = m && m.confirmedFacts ? m.confirmedFacts : {};
  const season = f.season || xfSeason(a) || "";
  const month = (f.date || "").match(/(\d{1,2})[\/\-]/) ? (f.date.match(/(\d{1,2})[\/\-]/)[1] + "月") : "";
  const enMonth = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mo = month ? parseInt(month, 10) - 1 : -1;
  const moEn = mo >= 0 && mo < 12 ? enMonth[mo] : "MOUNTAIN";
  const typeMap = { hike: "DIARY", mountain: "DIARY", water: "WATER", camp: "CAMP", family: "FAMILY", photo: "PHOTO" };
  const p = xfTypeProfile(a);
  const tag = typeMap[p.kind] || "DIARY";
  return `${moEn} · ${tag}${season ? " · " + season : ""}`;
}
function xfBrandPill(a) {
  const club = state.club && state.club.name ? state.club.name : "远拓旅游";
  const y = ((a.dateMD || a.date || "").match(/(\d{4})/) || ["", new Date().getFullYear()])[1];
  return `${club} · ${y}`;
}
function xfGzhCover(xf) {
  const gzh = xf.out && xf.out.gzh ? xf.out.gzh : {};
  let cover = gzh.cover && gzh.cover.src ? gzh.cover : (xf.master ? matchPhoto(xf.master, "cover", 0) : null);
  if (!cover || !cover.src) {
    const list = xf.master && xf.master.keyImages ? xf.master.keyImages : [];
    if (list.length) cover = list[0];
  }
  return cover || {};
}
function xfPhotoSet(xf, prefer, count) {
  const list = [];
  const used = new Set();
  const imgs = (xf.master && xf.master.keyImages) || [];
  const order = Array.isArray(prefer) ? prefer : [prefer];
  for (const cat of order) {
    for (const p of imgs) {
      if (p && p.src && !used.has(p.src) && p.cat === cat) {
        list.push(p);
        used.add(p.src);
        if (list.length >= count) return list;
      }
    }
  }
  for (const p of imgs) {
    if (p && p.src && !used.has(p.src)) {
      list.push(p);
      used.add(p.src);
      if (list.length >= count) return list;
    }
  }
  return list;
}
function xfGzhTextParas(html) {
  return (html || "").split(/\n+/).map((p) => p.trim()).filter(Boolean);
}
function xfGzhHighlight(html, a) {
  const p = xfTypeProfile(a);
  const kw = [p.themeA, (a.place || ""), (a.type || ""), "森林", "溪流", "山顶", "露营", "篝火", "星空", "徒步", "溯溪", "桨板", "漂流"].filter(Boolean);
  let out = html;
  for (const k of kw) {
    if (!k || k.length < 2) continue;
    out = out.split(k).join(`<span class="gzh-hl">${k}</span>`);
  }
  return out;
}

/* 山野日记型：大图叠标题、极简杂志长图 */
/* 结构级版式变体（第三维度，真正不同的 DOM 结构，而非仅 CSS）
 * variant 0 = 原生版式（各家族自带结构）
 * variant 1 = 舒展版：引文式大标题 + 全宽配图 + 居中窄栏正文
 * variant 2 = 紧致版：2 列网格，缩略图 + 紧凑文字
 */
function xfSectionsMarkup(variant, sections, secPhotos, parasFn) {
  if (!variant || variant === 0 || !sections || !sections.length) return null;
  if (variant === 1) {
    return sections.map((s, i) => {
      const ph = secPhotos[i] || null;
      return `<section class="gzh-sec gzh-sec-spread">
        <h2 class="gzh-sec-spread-h">${esc(s.h)}</h2>
        ${ph && ph.src ? `<div class="gzh-sec-spread-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
        <div class="gzh-sec-spread-body">${parasFn(s.html)}</div>
      </section>`;
    }).join("");
  }
  return `<div class="gzh-sec-grid">` + sections.map((s, i) => {
    const ph = secPhotos[i] || null;
    return `<div class="gzh-sec-cell">
      ${ph && ph.src ? `<div class="gzh-sec-cell-img" style="background-image:url('${ph.src}')"></div>` : ""}
      <div class="gzh-sec-cell-body"><h3>${esc(s.h)}</h3>${parasFn(s.html)}</div>
    </div>`;
  }).join("") + `</div>`;
}

function xfGzhDiaryHtml(gzh, xf, isRecap) {
  const a = (state.activities || []).find((x) => x.id === xf.aid) || {};
  const m = xf.master || {};
  const f = m.confirmedFacts || {};
  const cover = xfGzhCover(xf);
  const eyebrow = xfEyebrow(a, m);
  const pill = xfBrandPill(a);
  const sectionCount = (gzh.sections || []).length || 4;
  // quote 不配图，多取一些保证其它区块有图；照片按顺序喂给各 section
  const secPhotos = xfPhotoSet(xf, ["scenic", "people", "action", "detail", "cover", "team"], Math.max(sectionCount, 6));
  const hasPhotos = secPhotos.length > 0 || !!cover.src;
  const parasFnDiary = (html) => xfGzhTextParas(html).map((p) => `<p>${xfGzhHighlight(p, a)}</p>`).join("");
  const vSec = (xf.variant >= 1) ? xfSectionsMarkup(xf.variant, gzh.sections, secPhotos, parasFnDiary) : null;
  let photoIdx = 0;

  // 标题拆分：活动名 + 主题，避免 hero 标题过长
  const titleParts = (gzh.title || "").split(/[｜|]/);
  const heroTitle = (titleParts[0] || gzh.title || f.activityName || "山野日记").trim();
  const heroSub = (titleParts[1] || gzh.subtitle || m.mainTheme || "").trim();
  const heroDate = f.date ? `${f.place || ""} · ${f.date}`.replace(/^ · /, "") : (f.place || "");

  const hero = cover.src
    ? `<div class="gzh-hero" style="background-image:url('${cover.src}')"><div class="gzh-hero-mask"></div><div class="gzh-hero-txt"><div class="gzh-eyebrow">${esc(eyebrow)}</div><h1 class="gzh-hero-title">${esc(heroTitle)}</h1>${heroSub ? `<div class="gzh-hero-sub">${esc(heroSub)}</div>` : ""}${heroDate ? `<div class="gzh-hero-pill">${esc(heroDate)}</div>` : `<div class="gzh-hero-pill">${esc(pill)}</div>`}</div></div>`
    : `<div class="gzh-hero gzh-hero-empty"><div class="gzh-hero-mask"></div><div class="gzh-hero-txt"><div class="gzh-eyebrow">${esc(eyebrow)}</div><h1 class="gzh-hero-title">${esc(heroTitle)}</h1>${heroSub ? `<div class="gzh-hero-sub">${esc(heroSub)}</div>` : ""}${heroDate ? `<div class="gzh-hero-pill">${esc(heroDate)}</div>` : `<div class="gzh-hero-pill">${esc(pill)}</div>`}<div class="gzh-hero-upload-hint">📷 上传 1 张大图，这里会变成全幅封面</div></div></div>`;

  const lead = gzh.summary ? `<div class="gzh-lead"><p>${esc(gzh.summary)}</p></div>` : "";

  const nextPhoto = (layout) => {
    if (layout === "gzh-sec-quote") return null;
    return secPhotos[photoIdx++] || null;
  };

  const sections = (gzh.sections || []).map((s, i) => {
    const layoutClass = ["gzh-sec-full", "gzh-sec-split", "gzh-sec-quote", "gzh-sec-img"][i % 4];
    const ph = nextPhoto(layoutClass);
    const paras = xfGzhTextParas(s.html).map((p) => `<p>${xfGzhHighlight(p, a)}</p>`).join("");
    if (layoutClass === "gzh-sec-quote") {
      return `<section class="gzh-sec gzh-sec-quote"><div class="gzh-quote-mark">”</div><h2>${esc(s.h)}</h2><div class="gzh-quote-body">${paras}</div></section>`;
    }
    if (layoutClass === "gzh-sec-split" && ph && ph.src) {
      return `<section class="gzh-sec gzh-sec-split"><div class="gzh-split-text"><h2>${esc(s.h)}</h2>${paras}</div><div class="gzh-split-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div></section>`;
    }
    if (layoutClass === "gzh-sec-img" && ph && ph.src) {
      return `<section class="gzh-sec gzh-sec-img"><div class="gzh-wide-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div><div class="gzh-img-text"><h2>${esc(s.h)}</h2>${paras}</div></section>`;
    }
    return `<section class="gzh-sec gzh-sec-full"><h2>${esc(s.h)}</h2>${paras}${ph && ph.src ? `<div class="gzh-sec-imgbox" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}</section>`;
  }).join("");

  const infoBlock = (!isRecap && gzh.info && gzh.info.length)
    ? `<div class="gzh-info-grid">${gzh.info.map((r) => `<div class="gzh-info-cell"><span class="gzh-info-k">${esc(r.k)}</span><span class="gzh-info-v">${esc(r.v)}</span></div>`).join("")}</div>`
    : "";

  const feeBlock = (!isRecap && gzh.fee)
    ? `<div class="gzh-diary-block"><h2>费用说明</h2><p>${esc(gzh.fee)}</p>${gzh.service ? `<p class="gzh-service">${esc(gzh.service)}</p>` : ""}</div>`
    : "";

  const uploadHint = !hasPhotos
    ? `<div class="gzh-upload-tip"><div class="gzh-upload-tip-ic">📷</div><div><b>这张图文还没有照片</b><p>在「添加图片 / 海报」处上传 3–6 张活动照片，系统会自动匹配到封面与各段落，排版会立刻更有杂志感。</p></div></div>`
    : "";

  const cta = gzh.cta || (isRecap && gzh.next) ? `<div class="gzh-diary-cta">${esc(gzh.cta || gzh.next || "")}</div>` : "";

  return `<div class="gzh-article gzh-diary gzh-var-${xf.variant}" id="xfGzhArticle" contenteditable="true" spellcheck="false">
    ${hero}
    ${lead}
    ${vSec != null ? vSec : sections}
    ${infoBlock}
    ${feeBlock}
    ${uploadHint}
    ${cta}
  </div>`;
}

/* 经典四版式：杂志/潮流/亲子/挑战 */
function xfGzhClassicHtml(gzh, xf, layout, isRecap) {
  const a = (state.activities || []).find((x) => x.id === xf.aid) || {};
  const m = xf.master || {};
  const f = m.confirmedFacts || {};
  const cover = xfGzhCover(xf);
  const eyebrow = xfEyebrow(a, m);
  const photos = xfPhotoSet(xf, ["scenic", "people", "action", "cover", "detail"], 8);
  const secPhotos = xfPhotoSet(xf, ["scenic", "people", "action", "detail"], 8);
  const hasPhotos = photos.length > 0 || !!cover.src;
  const parasFn = (html) => xfGzhTextParas(html).map((p) => `<p>${xfGzhHighlight(p, a)}</p>`).join("");
  const vSec = (xf.variant >= 1) ? xfSectionsMarkup(xf.variant, gzh.sections, secPhotos, parasFn) : null;
  const infoBlock = (!isRecap && gzh.info && gzh.info.length)
    ? `<div class="gzh-info"><h2>活动信息</h2><table>${gzh.info.map((r) => `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`).join("")}</table></div>`
    : "";
  const feeBlock = (!isRecap && gzh.fee)
    ? `<div class="gzh-block"><h2>费用说明</h2><p>${esc(gzh.fee)}</p>${gzh.service ? `<p>${esc(gzh.service)}</p>` : ""}</div>`
    : "";
  const cta = gzh.cta || (isRecap && gzh.next) ? `<div class="gzh-cta">${esc(gzh.cta || gzh.next || "")}</div>` : "";
  const uploadHint = !hasPhotos
    ? `<div class="gzh-upload-tip"><div class="gzh-upload-tip-ic">📷</div><div><b>这张图文还没有照片</b><p>上传 3–6 张照片，各版式会自动匹配封面与段落配图。</p></div></div>`
    : "";

  if (layout === "youth") {
    const cards = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = parasFn(s.html);
      return `<div class="gzh-youth-card">
        ${ph && ph.src ? `<div class="gzh-youth-card-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
        <div class="gzh-youth-card-body">
          <div class="gzh-youth-card-num">0${(i % 9) + 1}</div>
          <h3>${esc(s.h)}</h3>
          ${paras}
        </div>
      </div>`;
    }).join("");
    const tags = xfTags(a).slice(0, 6).map((t) => `<span class="gzh-youth-tag">#${esc(t)}</span>`).join("");
    return `<div class="gzh-article gzh-youth gzh-var-${xf.variant}" id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-youth-hero">
        <div class="gzh-youth-eyebrow">${esc(eyebrow)}</div>
        <h1 class="gzh-youth-title">${esc(gzh.title)}</h1>
        ${gzh.subtitle ? `<div class="gzh-youth-sub">${esc(gzh.subtitle)}</div>` : ""}
        ${cover.src ? `<div class="gzh-youth-cover" style="background-image:url('${cover.src}')"></div>` : ""}
      </div>
      ${gzh.summary ? `<div class="gzh-youth-lead">${parasFn(gzh.summary)}</div>` : ""}
      <div class="gzh-youth-cards">${vSec != null ? vSec : cards}</div>
      <div class="gzh-youth-tags">${tags}</div>
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  if (layout === "family") {
    const steps = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = parasFn(s.html);
      return `<div class="gzh-family-step">
        <div class="gzh-family-step-num">${i + 1}</div>
        <div class="gzh-family-step-body">
          <h3>${esc(s.h)}</h3>
          ${paras}
        </div>
        ${ph && ph.src ? `<div class="gzh-family-step-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
      </div>`;
    }).join("");
    return `<div class="gzh-article gzh-family gzh-var-${xf.variant}" id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-family-hero">
        <div class="gzh-family-cover" ${cover.src ? `style="background-image:url('${cover.src}')"` : ""}>
          <div class="gzh-family-cover-mask"></div>
          <div class="gzh-family-cover-txt">
            <div class="gzh-family-eyebrow">${esc(eyebrow)}</div>
            <h1 class="gzh-family-title">${esc(gzh.title)}</h1>
          </div>
        </div>
        ${gzh.subtitle ? `<div class="gzh-family-sub">${esc(gzh.subtitle)}</div>` : ""}
      </div>
      ${gzh.summary ? `<div class="gzh-family-lead">${parasFn(gzh.summary)}</div>` : ""}
      <div class="gzh-family-steps">${vSec != null ? vSec : steps}</div>
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  if (layout === "challenge") {
    const kv = [
      { k: "距离", v: f.distance || "--" },
      { k: "爬升", v: f.elevation ? f.elevation + "m" : "--" },
      { k: "强度", v: f.difficulty || "--" },
      { k: "天数", v: (f.days || 1) + "天" },
    ];
    const kvHtml = kv.map((r) => `<div class="gzh-challenge-kv"><b>${esc(r.v)}</b><span>${esc(r.k)}</span></div>`).join("");
    const sections = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = parasFn(s.html);
      return `<section class="gzh-sec gzh-challenge-sec">
        <div class="gzh-challenge-sec-head">
          <div class="gzh-challenge-sec-num">0${(i % 9) + 1}</div>
          <h2>${esc(s.h)}</h2>
        </div>
        <div class="gzh-challenge-sec-body">
          ${paras}
          ${ph && ph.src ? `<div class="gzh-challenge-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
        </div>
      </section>`;
    }).join("");
    return `<div class="gzh-article gzh-challenge gzh-var-${xf.variant}" id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-challenge-hero">
        <div class="gzh-challenge-eyebrow">${esc(eyebrow)}</div>
        <h1 class="gzh-challenge-title">${esc(gzh.title)}</h1>
        ${gzh.subtitle ? `<div class="gzh-challenge-sub">${esc(gzh.subtitle)}</div>` : ""}
        <div class="gzh-challenge-kvs">${kvHtml}</div>
      </div>
      ${cover.src ? `<div class="gzh-challenge-cover" style="background-image:url('${cover.src}')"></div>` : ""}
      ${gzh.summary ? `<div class="gzh-challenge-lead">${parasFn(gzh.summary)}</div>` : ""}
      ${vSec != null ? vSec : sections}
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  if (layout === "longform") {
    const metaPill = f.date ? `${f.place || ""} · ${f.date}`.replace(/^ · /, "") : (f.place || "");
    const kv = [
      { k: "天数", v: (f.days || 1) + "天" },
      { k: "距离", v: f.distance || "--" },
      { k: "爬升", v: f.elevation ? f.elevation + "m" : "--" },
      { k: "强度", v: f.difficulty || "--" },
    ];
    const kvHtml = kv.map((r) => `<div class="gzh-longform-kv"><b>${esc(r.v)}</b><span>${esc(r.k)}</span></div>`).join("");
    const sections = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = parasFn(s.html);
      const align = i % 2 === 0 ? "left" : "right";
      return `<section class="gzh-sec gzh-longform-sec gzh-longform-sec-${align}">
        ${ph && ph.src ? `<div class="gzh-longform-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
        <div class="gzh-longform-text">
          <div class="gzh-longform-sec-num">0${(i % 9) + 1}</div>
          <h2>${esc(s.h)}</h2>
          ${paras}
        </div>
      </section>`;
    }).join("");
    return `<div class="gzh-article gzh-longform gzh-var-${xf.variant}" id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-longform-hero">
        ${cover.src ? `<div class="gzh-longform-cover" style="background-image:url('${cover.src}')"><div class="gzh-longform-cover-mask"></div></div>` : ""}
        <div class="gzh-longform-hero-txt">
          <div class="gzh-longform-eyebrow">${esc(eyebrow)}</div>
          <h1 class="gzh-longform-title">${esc(gzh.title)}</h1>
          ${gzh.subtitle ? `<div class="gzh-longform-sub">${esc(gzh.subtitle)}</div>` : ""}
          ${metaPill ? `<div class="gzh-longform-pill">${esc(metaPill)}</div>` : ""}
        </div>
      </div>
      <div class="gzh-longform-kvs">${kvHtml}</div>
      ${gzh.summary ? `<div class="gzh-longform-lead">${parasFn(gzh.summary)}</div>` : ""}
      ${vSec != null ? vSec : sections}
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  // magazine 默认：户外杂志型
  const sections = (gzh.sections || []).map((s, i) => {
    const ph = secPhotos[i] || null;
    const paras = parasFn(s.html);
    const align = i % 2 === 0 ? "left" : "right";
    return `<section class="gzh-sec gzh-mag-sec gzh-mag-sec-${align}">
      <div class="gzh-mag-text">
        <div class="gzh-mag-sec-num">0${(i % 9) + 1}</div>
        <h2>${esc(s.h)}</h2>
        ${paras}
      </div>
      ${ph && ph.src ? `<div class="gzh-mag-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
    </section>`;
  }).join("");
  const gallery = photos.length > 1
    ? `<div class="gzh-gallery-classic"><h2>本期画面</h2><div class="gzh-gallery-grid">${photos.slice(0, 4).map((p) => `<div class="gzh-gallery-item" style="background-image:url('${p.src}')"><span class="gzh-img-cap">${esc(p.cat || "")}</span></div>`).join("")}</div></div>`
    : "";
  return `<div class="gzh-article gzh-magazine gzh-var-${xf.variant}" id="xfGzhArticle" contenteditable="true" spellcheck="false">
    <div class="gzh-cover" ${cover.src ? `style="background-image:url('${cover.src}')"` : ""}><div class="gzh-cover-mask"><div class="gzh-cover-cap">${esc(cover.cat ? "封面建议：" + cover.cat : (xf.photos && xf.photos.length ? "可换一张更具张力的大图作封面" : "未上传照片，建议补 1 张封面大图"))}</div></div></div>
    <div class="gzh-mag-head">
      <div class="gzh-mag-eyebrow">${esc(eyebrow)}</div>
      <h1 class="gzh-title">${esc(gzh.title)}</h1>
      ${gzh.subtitle ? `<div class="gzh-sub">${esc(gzh.subtitle)}</div>` : ""}
    </div>
    ${gzh.summary ? `<div class="gzh-sum">${parasFn(gzh.summary)}</div>` : ""}
    ${vSec != null ? vSec : sections}
    ${infoBlock}
    ${feeBlock}
    ${gallery}
    ${uploadHint}
    ${cta}
  </div>`;
}

function xfXhsPanel(x) {
  return `<div class="xf-text-card">
    <div class="xf-field"><label>标题候选</label>${x.titles.map((t) => `<div class="xf-line">· ${esc(t)} <button class="copy-btn" data-action="xfCopyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>
    <div class="xf-field"><label>正文</label><div class="xf-pre">${esc(x.body)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(x.body)}">复制正文</button></div>
    <div class="xf-field"><label>封面短句</label><div class="xf-line">${esc(x.cover)}</div></div>
    <div class="xf-field"><label>话题标签</label><div class="xf-tags">${x.tags.map((t) => `<span class="xf-tag">#${esc(t)}</span>`).join("")}</div></div>
  </div>`;
}
function xfMomentsPanel(m) {
  const items = [["预热版", m.warm], ["正式招募版", m.formal], ["最后招募版", m.last]];
  return `<div class="xf-text-card">${items.map(([l, t]) => `<div class="xf-field"><label>${l}</label><div class="xf-pre">${esc(t)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>`;
}
function xfWechatPanel(w) {
  const items = [["直接招募文案", w.recruit], ["简短报名说明", w.brief]];
  return `<div class="xf-text-card">${items.map(([l, t]) => `<div class="xf-field"><label>${l}</label><div class="xf-pre">${esc(t)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>`;
}
function xfVoicePanel(v) {
  const items = [["30 秒口播", v.s30], ["60 秒口播", v.s60]];
  return `<div class="xf-text-card">${items.map(([l, t]) => `<div class="xf-field"><label>${l}</label><div class="xf-pre">${esc(t)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>`;
}
function xfPosterPanel(p, xf) {
  const cover = (xf && xf.out && xf.out.gzh && xf.out.gzh.cover && xf.out.gzh.cover.src) ? xf.out.gzh.cover.src : (xfGzhCover(xf).src || "");
  const pill = (p.place && p.time) ? (p.place + " · " + p.time) : (p.time || p.place || "");
  const pts = (p.points && p.points.length) ? p.points : [p.sub].filter(Boolean);
  return `<div class="xf-poster">
    <div class="xf-poster-art" ${cover ? `style="background-image:url('${cover}')"` : ""}>
      <div class="xf-poster-art-mask"></div>
      <div class="xf-poster-art-txt">
        <div class="xf-poster-eyebrow">${esc(xfBrandPill({}))}</div>
        <h2 class="xf-poster-title">${esc(p.title)}</h2>
        ${p.sub ? `<div class="xf-poster-sub">${esc(p.sub)}</div>` : ""}
        ${pill ? `<div class="xf-poster-pill">📍 ${esc(pill)}</div>` : ""}
      </div>
    </div>
    <div class="xf-poster-info">
      <ul class="xf-poster-pts">${pts.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="xf-poster-meta"><span>⏰ ${esc(p.time)}</span><span>💰 ${esc(p.price)}</span></div>
      <div class="xf-poster-cta">${esc(p.cta)}</div>
    </div>
    <button class="copy-btn" data-action="xfCopyText" data-text="${esc(p.title + "｜" + p.sub + " " + pill + " " + p.price + " " + p.cta)}">复制文案</button>
  </div>`;
}

function xfRecapResult() {
  const xf = xfState();
  const o = xf.recap;
  if (xf.genState === "loading") return `<div class="xf-loading">${ICON("sparkles")} 正在生成活动回顾…</div>`;
  return `
  <div class="xf-back"><button class="btn btn-ghost btn-sm" data-action="xfReset">${ICON("chevron-left")} 重新选择</button></div>
  <div class="xf-theme"><span class="xf-theme-lbl">本次活动回顾主题</span><b>${esc(xf.recapType)}</b></div>
  ${xfStyleBar(xf)}
  ${xfPlatTabs(xf.platTab, "recap")}
  <div class="xf-plat-body">
    ${xf.platTab === "gzh" ? xfRecapGzhPanel(o.gzh, xf) : ""}
    ${xf.platTab === "xhs" ? xfXhsPanel(o.xhs) : ""}
    ${xf.platTab === "moments" ? `<div class="xf-text-card"><div class="xf-field"><label>朋友圈回顾</label><div class="xf-pre">${esc(o.moments)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(o.moments)}">复制</button></div></div>` : ""}
    ${xf.platTab === "wechat" ? `<div class="xf-text-card"><div class="xf-field"><label>微信群感谢</label><div class="xf-pre">${esc(o.wechat)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(o.wechat)}">复制</button></div></div>` : ""}
    ${xf.platTab === "voice" ? "" : ""}
    ${xf.platTab === "poster" ? `<div class="xf-text-card"><div class="xf-field"><label>下一期预告</label><div class="xf-pre">${esc(o.next)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(o.next)}">复制</button></div></div>` : ""}
  </div>`;
}

function xfRecapGzhPanel(gzh, xf) {
  const base = XF_FAMILY_LAYOUT[xf.family] || "diary";
  return `
  <div class="xf-gzh-head">
    <button class="btn btn-primary btn-sm" data-action="xfCopyGzhHtml">${ICON("copy")} 复制公众号（HTML）</button>
  </div>
  ${base === "diary" ? xfGzhDiaryHtml(gzh, xf, true) : xfGzhClassicHtml(gzh, xf, base, true)}
  <p class="tiny muted">回顾正文可直接点击修改；禁止虚构现场细节，所有事实须来自上传资料。改完点「复制公众号（HTML）」。</p>`;
}

/* 持续运营（保留原有运营任务 + 老客户召回） */
function xfLegacySection() {
  const tasks = buildActivityTasks();
  const customers = deriveCustomers();
  const inactive = customers.filter((c) => c.inactiveDays != null && c.inactiveDays >= 60);
  return `
  <details class="xf-legacy" open>
    <summary class="xf-legacy-sum">持续运营 · 单渠道快生 & 老客户召回</summary>
    <div class="xf-legacy-body">
      <div class="section-head" style="margin-top:0"><div class="section-title">活动运营任务</div><span class="muted small">${tasks.length} 项</span></div>
      ${tasks.length ? `<div class="op-tasks">${tasks.map((t) => `
        <div class="op-task">
          <div class="op-task-l"><span class="op-badge">${esc(t.badge)}</span><div><div class="op-task-title">${esc(t.a.title)}</div><div class="op-task-tip">${esc(t.tip)}</div></div></div>
          <div class="op-task-r"><button class="btn btn-primary btn-sm" data-action="xfFromTask" data-aid="${t.a.id}">${ICON("sparkles")} ${esc(t.btn)}</button></div>
          ${renderOpCopies(t.a.id)}
        </div>`).join("")}</div>` : `<div class="empty"><div class="e-ic">📣</div><div>当前没有进行中的活动任务。</div></div>`}
      <div class="section-head"><div class="section-title">老客户召回</div><span class="muted small">${inactive.length} 人 60 天未参加</span></div>
      <div class="recall-card">
        <div class="recall-segs">
          <button class="recall-seg" data-action="recallGen" data-seg="亲子"><b>${customers.filter((c) => c.tags.has("亲子客户")).length}</b><span>亲子客户</span><i>生成邀请</i></button>
          <button class="recall-seg" data-action="recallGen" data-seg="徒步"><b>${customers.filter((c) => c.tags.has("徒步客户")).length}</b><span>徒步客户</span><i>生成邀请</i></button>
          <button class="recall-seg" data-action="recallGen" data-seg="inactive60"><b>${inactive.length}</b><span>60天未参加</span><i>生成邀请</i></button>
        </div>
        ${state._recall ? `<div class="recall-out"><div class="recall-out-h">召回文案 · ${esc(state._recall.seg)}<button class="btn btn-ghost btn-xs" data-action="copyText" data-text="${esc(state._recall.text)}">${ICON("copy")} 复制</button></div><div class="recall-out-body">${esc(state._recall.text)}</div></div>` : ""}
      </div>
    </div>
  </details>`;
}
