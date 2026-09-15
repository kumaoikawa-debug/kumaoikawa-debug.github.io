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

/* Editorial 家族：3 招募 + 3 回顾，每族 ≥3 变体 = 18 版式（V2.0 §15/16/45） */
/* 变体命名以「版式」为准（P1-3）：避免问答体/对话体/绘本体等文体套路名，改为可预期的视觉结构。 */
var XF_FAMILIES = {
  route_editorial:    { label: "路线叙事", scenario: ["recruit"], variants: ["杂志专题", "大片跨页", "极简刊例"] },
  visual_campaign:    { label: "视觉种草", scenario: ["recruit"], variants: ["卡片流", "清单长图", "左右图文"] },
  challenge_editorial:{ label: "挑战叙事", scenario: ["recruit"], variants: ["数据条版", "纪实长文", "勋章墙"] },
  brand_journal:      { label: "品牌手记", scenario: ["recap"],  variants: ["山野日记", "晨昏手札", "长线随记"] },
  photo_documentary:  { label: "影像纪实", scenario: ["recap"],  variants: ["手账步骤", "图廊穿插", "轻画册"] },
  outdoor_lookbook:   { label: "户外型录", scenario: ["recap"],  variants: ["长图长廊", "九宫格", "胶片墙"] },
};
/* 家族 → 基础版式渲染器（变体在渲染器内做差异化） */
var XF_FAMILY_LAYOUT = { route_editorial: "magazine", visual_campaign: "youth", challenge_editorial: "challenge", brand_journal: "diary", photo_documentary: "family", outdoor_lookbook: "longform" };

/* ---------- 编辑组件库注册表（§25，具名组件 ×21） ----------
 * 所有版式由这些具名组件组合而成；Layout Engine 只选组件、不写文案。
 * type: media(图) / text(文) / meta(信息) / block(整块)；full: 是否整宽。 */
var XF_COMPONENTS = {
  EditorialHero:  { label: "全幅封面", type: "media", full: true,  desc: "封面大图 + 主标题 + 副标题/眉标" },
  ChapterHeader:  { label: "章节标题", type: "text",  full: true,  desc: "章节小标题（h2/h3）" },
  LeadParagraph:  { label: "导语",     type: "text",  full: true,  desc: "开篇导语段" },
  PullQuote:      { label: "引文",     type: "text",  full: true,  desc: "金句引文块" },
  FullBleedImage: { label: "全宽大图", type: "media", full: true,  desc: "整幅图片（带图注）" },
  ImagePair:      { label: "图文左右", type: "media", full: true,  desc: "左文右图 / 左图右文" },
  ImageTriptych:  { label: "三图并置", type: "media", full: true,  desc: "三张图并排" },
  MetricStrip:    { label: "数据条",   type: "meta",  full: true,  desc: "距离/爬升/强度等 KV 条" },
  SectionDivider: { label: "分隔",     type: "text",  full: true,  desc: "章节分隔" },
  EditorialCTA:   { label: "行动号召", type: "meta",  full: true,  desc: "报名 / 下一期预告 CTA" },
  InfoGrid:       { label: "信息网格", type: "meta",  full: true,  desc: "活动信息网格" },
  InfoTable:      { label: "信息表",   type: "meta",  full: true,  desc: "活动信息表" },
  FeeBlock:       { label: "费用说明", type: "meta",  full: true,  desc: "费用 + 服务说明" },
  ServiceBlock:   { label: "服务保障", type: "meta",  full: false, desc: "服务说明块" },
  GalleryGrid:    { label: "照片墙",   type: "media", full: true,  desc: "九宫格 / 网格照片" },
  YouthCard:      { label: "潮流卡片", type: "text",  full: false, desc: "社交种草卡片" },
  FamilyStep:     { label: "手账步骤", type: "text",  full: false, desc: "亲子手账步骤" },
  ChallengeSec:   { label: "挑战章节", type: "text",  full: false, desc: "挑战叙事章节" },
  LongformSec:    { label: "型录章节", type: "text",  full: false, desc: "户外型录章节" },
  UploadHint:     { label: "上传提示", type: "text",  full: true,  desc: "缺图引导" },
  TagRow:         { label: "标签行",   type: "meta",  full: true,  desc: "话题标签行" },
};
function xfRenderComponent(name, opts) {
  opts = opts || {};
  const paras = opts.paras || [];
  const ph = opts.ph || null;
  switch (name) {
    case "EditorialHero":   return opts.html || "";
    case "ChapterHeader":   return `<h2>${esc(opts.h || "")}</h2>`;
    case "LeadParagraph":   return opts.html || "";
    case "PullQuote":       return `<section class="gzh-sec gzh-sec-quote"><div class="gzh-quote-mark">”</div>${opts.h ? `<h2>${esc(opts.h)}</h2>` : ""}<div class="gzh-quote-body">${paras.join("")}</div></section>`;
    case "FullBleedImage":  return ph && ph.src ? `<div class="gzh-wide-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(xfCap(ph, ""))}</span></div>` : "";
    case "ImagePair":       return (ph && ph.src) ? `<section class="gzh-sec gzh-sec-split"><div class="gzh-split-text">${opts.h ? `<h2>${esc(opts.h)}</h2>` : ""}${paras.join("")}</div><div class="gzh-split-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(xfCap(ph, ""))}</span></div></section>` : `<section class="gzh-sec gzh-sec-full">${opts.h ? `<h2>${esc(opts.h)}</h2>` : ""}${paras.join("")}</section>`;
    case "MetricStrip":     return (opts.kvs || []).map((r) => `<div class="gzh-challenge-kv"><b>${esc(r.v)}</b><span>${esc(r.k)}</span></div>`).join("");
    case "SectionDivider":  return `<div class="gzh-divider"></div>`;
    case "EditorialCTA":    return opts.text ? `<div class="${opts.cls || "gzh-diary-cta"}">${esc(opts.text)}</div>` : "";
    case "InfoGrid":        return (opts.rows || []).map((r) => `<div class="gzh-info-cell"><span class="gzh-info-k">${esc(r.k)}</span><span class="gzh-info-v">${esc(r.v)}</span></div>`).join("");
    case "InfoTable":       return `<table>${(opts.rows || []).map((r) => `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`).join("")}</table>`;
    case "FeeBlock":        return `${opts.fee ? `<p>${esc(opts.fee)}</p>` : ""}${opts.service ? `<p class="gzh-service">${esc(opts.service)}</p>` : ""}`;
    case "GalleryGrid":     return `<div class="gzh-gallery-grid">${(opts.photos || []).map((p) => `<div class="gzh-gallery-item" ${smartBg(p.src)}><span class="gzh-img-cap">${esc(xfCap(p, ""))}</span></div>`).join("")}</div>`;
    case "YouthCard":       return `<div class="gzh-youth-card">${ph && ph.src ? `<div class="gzh-youth-card-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(xfCap(ph, ""))}</span></div>` : ""}<div class="gzh-youth-card-body"><div class="gzh-youth-card-num">0${((opts.i || 0) % 9) + 1}</div>${opts.h ? `<h3>${esc(opts.h)}</h3>` : ""}${paras.join("")}</div></div>`;
    case "FamilyStep":      return `<div class="gzh-family-step"><div class="gzh-family-step-num">${(opts.i || 0) + 1}</div><div class="gzh-family-step-body">${opts.h ? `<h3>${esc(opts.h)}</h3>` : ""}${paras.join("")}</div>${ph && ph.src ? `<div class="gzh-family-step-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(xfCap(ph, ""))}</span></div>` : ""}</div>`;
    case "ChallengeSec":    return `<section class="gzh-sec gzh-challenge-sec"><div class="gzh-challenge-sec-head"><div class="gzh-challenge-sec-num">0${((opts.i || 0) % 9) + 1}</div>${opts.h ? `<h2>${esc(opts.h)}</h2>` : ""}</div><div class="gzh-challenge-sec-body">${paras.join("")}${ph && ph.src ? `<div class="gzh-challenge-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(xfCap(ph, ""))}</span></div>` : ""}</div></section>`;
    case "LongformSec":     return `<section class="gzh-sec gzh-longform-sec gzh-longform-sec-${opts.align || "left"}">${ph && ph.src ? `<div class="gzh-longform-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(xfCap(ph, ""))}</span></div>` : ""}<div class="gzh-longform-text"><div class="gzh-longform-sec-num">0${((opts.i || 0) % 9) + 1}</div>${opts.h ? `<h2>${esc(opts.h)}</h2>` : ""}${paras.join("")}</div></section>`;
    case "UploadHint":      return opts.html || "";
    case "TagRow":          return (opts.tags || []).map((t) => `<span class="gzh-youth-tag">#${esc(t)}</span>`).join("");
    default:                return opts.html || "";
  }
}
function xfWsIr(xf, isRecap) {
  const dir = (xf && xf.strategy && xf.strategy.editorialDirection) || {};
  const ws = dir.whitespace || "generous";
  let irBand = "mid";
  if (dir.imageRatio != null) irBand = dir.imageRatio >= 0.6 ? "high" : "mid";
  else irBand = isRecap ? "high" : "mid";
  return ` class="gzh-ws-${ws} gzh-ir-${irBand}"`;
}

function xfState() {
  state.xf = state.xf || {
    scenario: null, aid: null, step: null,
    master: null, out: null, recap: null,
    layout: "route_editorial", family: "route_editorial", variant: 0, styleSeed: null,
    photos: [], notes: "", recapNotes: "",
    photoOverrides: { cover: null, excluded: {} },
    genState: "idle", platTab: "gzh", recapType: "",
    strategy: null, quality: null,
    customRecap: { title: "", date: "", place: "", type: "", signups: "", leader: "" },
    _a: null, _styleHistory: [],
  };
  if (!state.xf.customRecap) state.xf.customRecap = { title: "", date: "", place: "", type: "", signups: "", leader: "" };
  if (!state.xf.photoOverrides) state.xf.photoOverrides = { cover: null, excluded: {} };
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
  // 统一委托 ai.js 的 xfSeasonOf（修复原「10月20日」被误解析为 月=20 的问题，见 v147）
  if (typeof xfSeasonOf === "function") return xfSeasonOf(a);
  return "";
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
  // 注意：这里只输出“抽象的传播方向 / 消费价值”，严禁出现任何具体景观、天气或现场事件。
  // 具体场景一律只能来自 confirmedFacts 与照片；无照片无事实时宁可留白，也不得凭空生成画面。
  if (/亲子|研学|自然|儿童|少儿/.test(t)) return { kind: "family", tone: "温暖、轻快、有画面", themeA: "陪孩子去自然里上一堂户外课", scenic: "适合亲子一起感受的自然环境", experience: "一起动手、一起完成的亲子时光", participation: "一段高质量陪伴，与孩子共同的自然记忆" };
  if (/露营|营地|星空|音乐|派对/.test(t)) return { kind: "camp", tone: "松弛、年轻、有氛围", themeA: "周末逃离城市，去营地松弛一下", scenic: "松弛的户外氛围", experience: "放慢节奏的营地社交", participation: "卸下疲惫的周末放松与同好相聚" };
  if (/漂流|溯溪|水上|溪降|桨板|皮划艇|冲浪/.test(t)) return { kind: "water", tone: "清凉、活泼、直接", themeA: "天热最爽的事，是跳进山里的水里", scenic: "清凉的水上环境", experience: "戏水漂流直接的刺激与畅快", participation: "高温天极致的降温与释放" };
  if (/登山|雪山|高海拔|攀岩|攀冰|越野|重装|穿越/.test(t)) return { kind: "mountain", tone: "克制、专业、有力量", themeA: "用脚步丈量山脊，把城市留在身后", scenic: "开阔的山野地貌", experience: "一步步向上的身体挑战与专注", participation: "体能突破与完成挑战的成就感" };
  if (/摄影|出片|风光|秋色|红叶|花海|银河/.test(t)) return { kind: "photo", tone: "审美、克制、有质感", themeA: "这片山，只为此刻的光而来", scenic: "有层次的户外光影与地貌", experience: "等光、构图的创作过程", participation: "带得走的一组自己拍的大片" };
  return { kind: "hike", tone: "真诚、自然、不浮夸", themeA: "走得动的山，才装得下周末的好心情", scenic: "行走其中才懂的山水与季节变化", experience: "呼吸、流汗、和朋友边走边聊的节奏", participation: "一次身体舒展与精神放空的周末充电" };
}

function xfCta(a) {
  const when = a.dateMD || a.date || "近期";
  const price = a.price != null ? "¥" + a.price + "/" + (a.limitUnit || "人") : "详询";
  return `报名方式：私信 / 群里接龙，或直接在本页提交报名。${when} 出发，名额${a.limit ? a.limit + (a.limitUnit || "人") + "，" : ""}先到先得。`;
}

/* ---------- 事实护栏：creativeContext 只给表达方向，禁止写成现场事实 ---------- */
// 下列为「具体景观/天气/事件」词。除非资料或图片确认，否则不得出现在 creativeContext / consumerValue。
// 活动类型推断(kind)是「内容方向分类」，绝不是现场事实——不得暗示任何具体景观/天气/事件。
const SCENE_CLAIM_KEYWORDS = ["星空","星河","星轨","银河","云海","云瀑","佛光","日出","日落","晚霞",
  "篝火","营火","溪流","溪水","瀑布","花海","红叶","雪景","雪线","草甸","林间","山顶","森林","峡谷","溶洞","海浪","潮水","礁石","云影","晨雾"];
function stripSceneClaims(s) {
  if (!s || typeof s !== "string") return s;
  let out = s;
  for (const k of SCENE_CLAIM_KEYWORDS) {
    if (out.indexOf(k) >= 0) out = out.replace(new RegExp("的?" + k + "(下|里|边|上|中|旁|间)?", "g"), "");
  }
  return out;
}
function hasSceneClaim(s) {
  if (!s || typeof s !== "string") return false;
  return SCENE_CLAIM_KEYWORDS.some((k) => s.indexOf(k) >= 0);
}
// 递归清洗 creativeContext / consumerValue 的全部字符串字段，确保不含现场事实断言（防御式）
function sanitizeCreativeContext(cc) {
  let stripped = false;
  function walk(v) {
    if (typeof v === "string") { const c = stripSceneClaims(v); if (c !== v) stripped = true; return c; }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") { const o = {}; for (const k of Object.keys(v)) o[k] = walk(v[k]); return o; }
    return v;
  }
  return { value: walk(cc), stripped: stripped };
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
/* P0-5 / P0-6 / P0-17 实际活动数据：与原计划事实严格分离；只采用用户在「补充资料 / actualActivityData」中确认的信息。
   报名人数(registeredParticipants) ≠ 实际参加人数(actualParticipants)——两者是独立字段，未明确提供实际人数时保持 null，回顾不得写「XX 人参加」。
   P0-17：actualActivityData 为独立对象（活动上持久存储），优先取结构化字段；仅当结构化字段为空时才从 notes 文本解析兜底。 */
function xfActualActivityData(a, notes) {
  const stored = (a && a.actualActivityData) || {};
  // 报名人数：优先用结构化 actualActivityData.registeredParticipants，否则回退原计划 signups/departures
  const registered = (stored.registeredParticipants != null && stored.registeredParticipants !== "")
    ? +stored.registeredParticipants
    : (a.signups || (a.departures ? a.departures.reduce((s, d) => s + (d.sign || 0), 0) : 0) || null);
  const txt = (notes || "").trim();
  // 实际参与人数：优先用结构化 actualActivityData.actualParticipants（独立确认），否则从补充资料文本解析兜底
  let actual = (stored.actualParticipants != null && stored.actualParticipants !== "") ? +stored.actualParticipants : null;
  if (actual == null) {
    const mActual = txt.match(/(?:实际|到场|实到|共|参加)[^。；\n]{0,10}?(\d+)\s*(?:人|位|名)/);
    if (mActual) actual = +mActual[1];
  }
  const arr = (x) => (Array.isArray(x) ? x.filter(Boolean).map(String) : (x ? String(x).split(/[；;\n]/).map((s) => s.trim()).filter(Boolean) : []));
  const str = (x) => (x == null ? "" : (Array.isArray(x) ? x.filter(Boolean).join("；") : String(x)));
  return {
    registeredParticipants: registered,
    actualParticipants: actual,
    actualWeather: str(stored.actualWeather) || "",
    actualHighlights: arr(stored.actualHighlights),
    actualFeedback: arr(stored.actualFeedback),
    memorableMoments: arr(stored.memorableMoments),
    completionSummary: str(stored.completionSummary) || "",
    actualRouteChange: str(stored.actualRouteChange) || "",
    providedNotes: txt, // 用户在「补充资料」里填写的真实信息，是唯一可用的实际事件来源
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
  // P0-14 事实边界：
  //   confirmedFacts = 唯一事实源（只来自用户资料/照片，绝不从活动类型推断出现场景观）
  //   creativeContext = 只给表达方向；活动类型推断(inferredContentKind)是「内容方向分类」，assertsScenes=false，绝不暗示具体景观/天气/事件
  //   consumerValue = 抽象消费价值
  const ccRaw = {
    tone: p.tone,
    inferredContentKind: p.kind,   // 类型推断：仅内容方向分类，不是现场事实
    assertsScenes: false,
    isInference: true,
    angles: [cs.mainTheme].filter(Boolean),
    visualMoodHint: "视觉情绪由照片画像与编辑方向决定，不得凭空指定具体景观或天气",
  };
  const cc = sanitizeCreativeContext(ccRaw).value;
  const cvSan = sanitizeCreativeContext({ scenicValue: cv.scenicValue, experienceValue: cv.experienceValue, participationValue: cv.participationValue }).value;
  return {
    contentType: "recruitment", confirmedFacts: f, actualActivityData: null,
    creativeContext: cc,
    consumerValue: { scenicValue: cvSan.scenicValue, experienceValue: cvSan.experienceValue, participationValue: cvSan.participationValue },
    targetAudience: cv.targetUser, mainTheme: cs.mainTheme, mainSellingPoint: cs.mainSellingPoint,
    scenicValue: cvSan.scenicValue, experienceValue: cvSan.experienceValue, participationValue: cvSan.participationValue,
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
/* 同步版照片画像（供家族权重选择等同步逻辑使用；AI 细分析版见 xfPhotoProfile） */
function xfPhotoProfileBase(a, photos) {
  const list = autoClassifyPhotos(photos || []);
  const byCat = {};
  list.forEach((p) => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  const has = (c) => (byCat[c] || []).length > 0;
  const peopleN = (byCat.people || []).length + (byCat.team || []).length;
  const scenicN = (byCat.scenic || []).length + (byCat.route || []).length + (byCat.water || []).length + (byCat.camp || []).length;
  return {
    count: list.length,
    cats: Object.keys(byCat),
    cover: (byCat.cover && byCat.cover[0]) || list[0] || null,
    hasScenic: has("scenic") || has("route") || has("water") || has("camp"),
    hasPeople: has("people") || has("team"),
    hasAction: has("action"),
    hasDetail: has("detail") || has("gear"),
    scenicCount: scenicN,
    landscapeRatio: list.length ? +(scenicN / list.length).toFixed(2) : 0,
    peopleRatio: list.length ? +(peopleN / list.length).toFixed(2) : 0,
    sceneTypes: byCat.scenic ? ["自然风光"] : (byCat.water ? ["水上"] : (byCat.camp ? ["营地"] : [])),
    peopleCount: peopleN,
    crowdLevel: peopleN >= 3 ? "多人" : (peopleN >= 1 ? "小队" : "未出现人物"),
    actionTypes: byCat.action ? ["动态瞬间"] : [],
    mood: (byCat.scenic && byCat.scenic.length >= 3) ? "风景主导" : (has("people") ? "人物主导" : "综合"),
    emotion: has("people") ? "有陪伴感" : "宁静",
    note: list.length === 0 ? "未上传照片，建议补充 3-6 张活动照以增强排版" : "",
  };
}
async function xfPhotoProfile(a, photos, scenario) {
  const base = xfPhotoProfileBase(a, photos);
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

/* ---------- §34 图注 AI 化：基于可见分类 + 已确认事实生成描述性图注（非分类标签） ---------- */
function xfCap(ph, def) {
  if (!ph) return def || "";
  return ph.cap || ph.cat || def || "";
}
/* 无 Key 兜底：分类标签 + 已确认事实，产出描述性短句（不虚构照片内容） */
function xfPhotoCaptionFallback(ph, facts, dir) {
  const cat = (ph && ph.cat) || "";
  const place = (facts && facts.place) ? facts.place : "";
  const season = (facts && facts.season) ? facts.season : "";
  const labelMap = {
    cover: "封面大图", scenic: "山野风景", people: "同行伙伴", action: "行进瞬间",
    team: "团队合影", gear: "装备细节", meal: "餐食补给", camp: "营地一隅",
    route: "路线地貌", water: "亲水时刻", detail: "现场细节",
  };
  let cap = labelMap[cat] || "现场记录";
  if (place) cap += " · " + place;
  if (season) cap += " " + season;
  return cap;
}
/* 挂载 AI 描述性图注到 keyImages（保 src/cat，补充 cap）；无 Key 走兜底 */
async function xfAttachPhotoCaptions(photos, facts, dir) {
  if (!photos || !photos.length) return photos || [];
  if (!aiAuthMode()) {
    return photos.map((p) => Object.assign({}, p, { cap: xfPhotoCaptionFallback(p, facts, dir) }));
  }
  try {
    const cats = photos.map((p, i) => ({ i: i, cat: p.cat || "" }));
    const sys = `你是户外照片图注写作助手。为每张照片写一句描述性图注（≤16字），基于"照片分类 + 已确认活动事实"，描述照片可见内容；禁止虚构照片里看不到的东西（如天气、未出现的情绪）。返回 JSON 数组，每项 {i:序号, cap:图注}。`;
    const user = `照片分类：${JSON.stringify(cats)}\n活动事实：${JSON.stringify({ place: (facts || {}).place, season: (facts || {}).season, activity: (facts || {}).activityName, type: (facts || {}).type })}\n编辑方向：${JSON.stringify(dir ? { angle: dir.angle, mood: dir.readingMood } : {})}`;
    let res = await xfLLM(sys, user, true);
    let arr = null;
    if (Array.isArray(res)) arr = res;
    else if (res && Array.isArray(res.caps)) arr = res.caps;
    if (arr && arr.length) {
      const map = {};
      arr.forEach((r) => { if (r && r.i != null) map[r.i] = r.cap || ""; });
      return photos.map((p, i) => Object.assign({}, p, { cap: (map[i] && ("" + map[i]).trim()) ? ("" + map[i]).trim() : xfPhotoCaptionFallback(p, facts, dir) }));
    }
  } catch (e) { /* 回退兜底 */ }
  return photos.map((p) => Object.assign({}, p, { cap: xfPhotoCaptionFallback(p, facts, dir) }));
}

/* §31 小红书 schema 归一：兼容旧字段 cover/tags/imgOrder → 新字段 coverText/hashtags/imageOrder */
function xfNormalizeXhs(x) {
  if (!x) return x;
  const coverText = (x.coverText != null && x.coverText !== "") ? x.coverText : (x.cover || "");
  const hashtags = (Array.isArray(x.hashtags) && x.hashtags.length) ? x.hashtags : (Array.isArray(x.tags) ? x.tags : []);
  const imageOrder = (Array.isArray(x.imageOrder) && x.imageOrder.length) ? x.imageOrder : (Array.isArray(x.imgOrder) ? x.imgOrder : []);
  return { titles: x.titles || [], body: x.body || "", coverText: coverText, hashtags: hashtags, imageOrder: imageOrder };
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
  // 活动类型只作为「弱先验」，不再单独决定最终视觉
  if (scenario === "recruit") {
    if (/亲子|研学|自然|儿童/.test(t)) { weight.visual_campaign += 2; weight.route_editorial += 1; }
    if (/摄影|风光|秋色|红叶|花海/.test(t)) { weight.route_editorial += 1; weight.visual_campaign += 1; }
    if (/漂流|溯溪|水上|派对|音乐|露营/.test(t)) { weight.visual_campaign += 2; weight.route_editorial += 1; }
    if (/登山|雪山|越野|高海拔|攀岩/.test(t)) { weight.challenge_editorial += 2; weight.route_editorial += 1; }
  } else {
    if (/亲子|研学|自然|儿童/.test(t)) { weight.photo_documentary += 2; weight.brand_journal += 1; }
    if (/摄影|风光|秋色|红叶|花海/.test(t)) { weight.outdoor_lookbook += 1; weight.photo_documentary += 1; }
    if (/漂流|溯溪|水上|派对|音乐|露营/.test(t)) { weight.brand_journal += 2; weight.photo_documentary += 1; }
    if (/登山|雪山|越野|高海拔|攀岩/.test(t)) { weight.outdoor_lookbook += 1; weight.brand_journal += 1; }
    weight.brand_journal += 1; // 回顾默认偏品牌手记
  }
  // P0-1 照片真正参与家族权重：风景多→风景/画册，人物多→人物纪实，动作多→挑战/画册
  const pp = xfPhotoProfileBase(a, photos);
  if (pp && pp.count > 0) {
    const lr = pp.landscapeRatio || 0, pr = pp.peopleRatio || 0;
    const hasAction = /动态/.test((pp.actionTypes || []).join(""));
    if (scenario === "recruit") {
      if (lr >= 0.6 && pr < 0.3) { weight.route_editorial += 4; weight.visual_campaign += 1; }
      if (pr >= 0.5) { weight.visual_campaign += 4; weight.route_editorial += 1; }
      if (hasAction) weight.challenge_editorial += 2;
      if (hasAction && /登山|雪山|越野|高海拔|攀岩/.test(t)) weight.challenge_editorial += 2;
      if (lr >= 0.6 && pp.count >= 15) weight.route_editorial += 1;
    } else {
      if (pr >= 0.55) weight.photo_documentary += 4;
      if (pr >= 0.35) weight.photo_documentary += 2;
      if (lr >= 0.6) weight.outdoor_lookbook += 4;
      if (hasAction) { weight.outdoor_lookbook += 1; weight.photo_documentary += 1; }
      if (lr >= 0.6 && pp.count >= 15) weight.outdoor_lookbook += 2;
      if (pp.hasDetail && lr < 0.5 && pr < 0.4) weight.brand_journal += 2;
    }
  }
  // P0-2 Activity DNA 参与家族权重：把「季节/场景/动机/人群」从原始活动类型里解耦出来
  const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a, photos) : null;
  if (dna) {
    if (scenario === "recruit") {
      if (dna.visualPotential === "high") weight.route_editorial += 2;
      if (dna.coreMotivation === "challenge") weight.challenge_editorial += 2;
      if (dna.coreMotivation === "family") weight.visual_campaign += 2;
      if (dna.activityForm === "water" || dna.activityForm === "camp") weight.visual_campaign += 1;
      if (dna.professionalLevel === "technical") weight.challenge_editorial += 1;
    } else {
      if (dna.coreMotivation === "family") weight.photo_documentary += 3;
      if (dna.visualPotential === "high") weight.outdoor_lookbook += 2;
      if (dna.coreMotivation === "challenge") weight.brand_journal += 1;
    }
  }
  // P2-5 风格去重：最近几次生成用过的家族降权，避免连续几版过于相似（最近一次降得最狠）
  const histAll = (state.xf && state.xf._styleHistory) || [];
  const recentFams = histAll.slice(-3).map((h) => h.family).reverse();
  const decay = [0.38, 0.6, 0.82];
  recentFams.forEach((fam, i) => { if (weight[fam] != null) weight[fam] *= (decay[i] || 1); });
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
    route_editorial: "这一程，值得被认真记录", visual_campaign: "这周末，去山里当个本地人",
    challenge_editorial: "我们真的把这座山走完了", brand_journal: "走得慢一点，才看得见山",
    photo_documentary: "这一程的画面，比文字更诚实", outdoor_lookbook: "把这一程，存进相册里",
  };
  const hookMap = {
    route_editorial: "这一程，值得被认真记录", visual_campaign: "谁懂啊这地方",
    challenge_editorial: "登顶那刻，值了", brand_journal: "山一直在，刚好今天有空",
    photo_documentary: "九张图，装下整个周末", outdoor_lookbook: "九张图，装下整个周末",
  };
  const compMap = { route_editorial: "左右交替", visual_campaign: "卡片流", challenge_editorial: "数据条+区块", brand_journal: "大图主导", photo_documentary: "手账步骤", outdoor_lookbook: "网格画廊" };
  const colorMap = { route_editorial: "墨绿", visual_campaign: "暖米", challenge_editorial: "夜空蓝", brand_journal: "山系橙", photo_documentary: "松石", outdoor_lookbook: "暖米" };
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
    editorialConcept: angleMap[family] || p.themeA,
    visualFocus: compMap[family],
    readingMood: photoProfile.mood || (scenario === "recap" ? "温暖回看" : "松弛向往"),
    imagePriority: scenario === "recap" ? "high" : "medium",
    storyStyle: family === "challenge_editorial" ? "纪实推进" : (family === "visual_campaign" ? "种草叙事" : "沉浸叙述"),
    informationStyle: family === "challenge_editorial" ? "数据化" : "场景化",
    titleTone: family === "route_editorial" ? "克制" : "亲和",
    ctaStrength: scenario === "recruit" ? "strong" : "soft",
    layoutFamily: family,
    layoutRhythm: { maxSamePatternRepeat: 2, cadence: "alternating" },
    textDensity: "medium",
    whitespace: (family === "brand_journal" || family === "photo_documentary") ? "generous" : (family === "route_editorial" ? "medium" : "generous"),
    imageRatio: scenario === "recap" ? 0.68 : 0.55,
    visual: { mood: photoProfile.mood, emotion: photoProfile.emotion, scene: photoProfile.dominantScene || (photoProfile.sceneTypes || []).join(""), color: colorMap[family], composition: compMap[family], coverHint: photoProfile.cover ? "用已上传封面" : "建议补充 1 张大图", typographic: family === "route_editorial" ? "衬线大标题" : "无衬线粗体" },
    copyDirectives: { avoid: ["硬销", "名额仅剩", "最后机会"], must: ["地点真实感", "基于已确认事实"] },
  };
}
async function genStrategy(a, photos, notes, scenario) {
  const facts = xfConfirmedFacts(a, photos);
  const photoProfile = await xfPhotoProfile(a, photos, scenario);
  const p = xfTypeProfile(a);
  const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a, photos) : null;
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
  copyDirectives: { avoid:[], must:[] },
  editorialConcept, visualFocus, readingMood, imagePriority: "medium/high", storyStyle, informationStyle, titleTone, ctaStrength: "strong/soft", layoutFamily,
  layoutRhythm: { maxSamePatternRepeat: 2, cadence: "alternating" },
  textDensity: "low/medium/high", whitespace: "low/medium/generous", imageRatio: 数字(招募0.5-0.65 / 回顾0.6-0.75)
}`;
    const user = `场景：${scenario === "recruit" ? "活动招募" : "活动回顾"}
事实：${JSON.stringify(facts)}
照片画像：${JSON.stringify(photoProfile)}
活动类型画像：${JSON.stringify({ kind: p.kind, themeA: p.themeA, tone: p.tone })}
活动基因(Activity DNA)：${JSON.stringify(dna)}
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
    activityDNA: dna,
    photoProfile: photoProfile,
    photoIntel: (typeof buildPhotoIntelligence === "function") ? buildPhotoIntelligence(photos, a, (dir.structure || []), scenario) : null,
    editorialDirection: dir,
  };
}

/* ---------- 阶段二：AI 完整文案（六平台，全部由 AI 生成） ---------- */
function xfSectionBody(h, a, m) {
  // P0-15：Fallback 章节正文只从 confirmedFacts(f) 推导，绝不把类型推断的
  // scenicValue/experienceValue/participationValue 当作现场事实写入。
  const f = m.confirmedFacts;
  const T = h || "";
  if (/信息|详情|报名|费用|时间|地点|怎么报名|出行/.test(T)) {
    const rows = xfInfoRows(a).map((r) => `<b>${r.k}</b> ${r.v}`);
    return `<p>${rows.length ? rows.join("；") + "。" : "活动详情以发布页为准。"}</p>`;
  }
  if (/玩|体验|行程|内容|安排|路线|活动/.test(T)) {
    const parts = [];
    if (f.days > 1) parts.push(f.days + " 天行程");
    if (f.difficulty) parts.push("强度" + f.difficulty);
    if (f.distance) parts.push("全程约 " + f.distance + " 公里");
    if (f.elevation) parts.push("海拔约 " + f.elevation + " 米");
    if (f.itinerary && f.itinerary.length) parts.push("已规划 " + f.itinerary.length + " 段行程");
    if (f.gear && f.gear.length) parts.push("建议自备：" + f.gear.slice(0, 5).join("、"));
    if (f.transport) parts.push("交通：" + f.transport);
    if (f.meal) parts.push("含餐：" + f.meal);
    if (f.includedServices && f.includedServices.length) parts.push("费用含：" + f.includedServices.join("、"));
    return `<p>${parts.length ? parts.join("；") + "。" : "具体玩法与行程以发布页与现场说明为准。"}</p>`;
  }
  if (/适合|谁|门槛|匹配|友好/.test(T)) {
    const parts = [];
    if (f.ageRange) parts.push("适合 " + f.ageRange);
    else if (f.audience) parts.push("面向 " + f.audience);
    if (f.difficulty) parts.push("强度" + f.difficulty + "，报名前请确认与自身情况匹配");
    if (f.leader) parts.push("本场由 " + f.leader + " 带队");
    return `<p>${parts.length ? parts.join("；") + "。" : "具体是否适合你，请结合强度、时间与自身情况判断，或私信咨询。"}</p>`;
  }
  if (/值得|为什么|去|亮点|看点/.test(T)) {
    const parts = [];
    if (f.activityType) parts.push("活动类型：" + f.activityType);
    if (f.place) parts.push("地点在" + f.place);
    if (f.photosCount > 0) parts.push("已上传 " + f.photosCount + " 张活动照，可在详情页查看");
    if (f.date) parts.push(f.date + " 出发");
    return `<p>${parts.length ? parts.join("；") + "。" : "活动亮点与实拍见详情页。"}</p>`;
  }
  if (/得到|收获|意义|价值|陪伴|成长/.test(T)) {
    return `<p>报名后可在群里获取集合、时间与行程提醒；活动信息以发布页为准。</p>`;
  }
  if (/预告|下一期|集结/.test(T)) return `咱们还会继续进山，下一期路线正在安排，留意群里接龙就能占位。`;
  return `<p>${(f.place ? "在" + f.place + "的" : "") + (f.date || "近期") + "这场活动，信息以发布页为准。"}</p>`;
}

function xfFallbackRecruit(a, m, dir) {
  const f = m.confirmedFacts;
  // P0-15：招募 Fallback 只生成事实安全版本。
  // 仅使用 confirmedFacts(f) 与活动字段；类型推断的 scenicValue/experienceValue/participationValue
  // 仅是「表达方向」，绝不作为事实断言写入正文——避免默认 专业领队/新手友好/路线成熟/轻装即可/风景绝美/安全放心。
  const struct = (dir.structure && dir.structure.length >= 4) ? dir.structure.slice(0, 6) : ["为什么值得去", "来了会体验什么", "参加完你能得到什么", "适不适合我", "真实信息", "怎么报名"];
  const sections = struct.map((h) => ({ h: h, html: xfSectionBody(h, a, m) }));
  const angle = dir.angle || (f.activityName || "这场活动"); // 表达方向（标题/邀约语气），非事实断言
  const infoRows = xfInfoRows(a);
  const feeTxt = f.price != null ? `¥${f.price}/${f.limitUnit || "人"}${f.limit ? `，限 ${f.limit}${f.limitUnit || "人"}` : ""}` : "详询";
  const summary = [f.activityName || "这场活动", (f.place ? "在" + f.place : ""), (f.date || "近期") + "出发"].filter(Boolean).join("，") + "。以下基于已确认的活动信息整理，具体以发布页为准。";
  const xhsInfo = [
    "· 时间：" + (f.date || "近期"),
    "· 地点：" + (f.place || "集合点群内发"),
    (f.price != null ? "· 费用：¥" + f.price + "/" + (f.limitUnit || "人") : "· 费用：详询") + (f.difficulty ? "｜强度" + f.difficulty : ""),
    (f.limit ? "· 名额：" + f.limit + (f.limitUnit || "人") : ""),
    (f.gear && f.gear.length ? "· 装备：" + f.gear.slice(0, 4).join("、") : ""),
    (f.includedServices && f.includedServices.length ? "· 含：" + f.includedServices.join("、") : ""),
  ].filter((s) => s);
  return {
    gzh: {
      title: `${f.activityName || "这场活动"}｜${angle}`,
      subtitle: `${dir.hook ? dir.hook + " · " : ""}${f.place ? "在" + f.place + "的" : ""}${f.season ? f.season : ""}${f.date || "近期"}出发`,
      summary: summary,
      sections: sections,
      info: infoRows,
      fee: feeTxt,
      service: (f.includedServices && f.includedServices.length) ? f.includedServices.join("、") : "",
      cta: m.cta,
    },
    xhs: {
      titles: [xfXhsTitle(a, m, 1, dir), xfXhsTitle(a, m, 2, dir), xfXhsTitle(a, m, 3, dir)],
      body: [
        (f.place ? "📍 " + f.place + (xfSeason(a) ? "·" + xfSeason(a) : "") : "📍 地点见发布页"),
        "✅ 活动信息",
        xhsInfo.join("\n"),
        "",
        "信息以发布页为准，想一起的评论区扣 1 或私信报名～",
      ].join("\n"),
      coverText: `${f.place || "山里"}·${xfSeason(a) || ""}`,
      hashtags: xfTags(a),
      imageOrder: ["cover", "scenic", "people", "action", "detail"],
    },
    moments: {
      warm: `${dir.hook ? dir.hook + " " : ""}周末有空的不妨看过来🌿 ${f.place ? "在" + f.place + "的" : ""}${f.season || ""}局又开了，${f.date || ""} 出发。信息都在发布页，想一起的私我占位～`,
      formal: `【招募】${f.activityName || "本周活动"} · ${f.date || "近期"} 出发\n${summary}\n名额有限，想一起的接龙或私信我留位～`,
      last: `⏰ 最后几个名额！${f.activityName || "本周活动"} ${f.date || ""} 出发。信息见发布页，想来的抓紧私信，手慢无～`,
    },
    wechat: {
      recruit: `各位群友好👋 ${f.activityName || "本周活动"} 开始招募啦：\n🗓 时间：${f.date || "近期"}\n📍 地点：${f.place || "集合点群内发"}\n💰 ${f.price != null ? "费用：¥" + f.price + "/" + (f.limitUnit || "人") : "费用详询"}${f.difficulty ? "\n🔥 强度：" + f.difficulty : ""}\n\n信息以发布页为准，名额有限，想一起的直接接龙或私信我，我帮你留位～`,
      brief: `【一句话】${f.activityName || "活动"} ${f.date || ""} 出发｜名额有限，戳我报名👇`,
    },
    voice: {
      s30: `大家好，这周末咱们去${f.place || "山里"}，主题是${angle}。${f.price != null ? "费用" + f.price + "一人" : "费用详询"}${f.difficulty ? "，强度" + f.difficulty : ""}。想一起的朋友私信我报名哈。`,
      s60: `大家好，给大伙说个周末的活动。咱们${f.date || "这周末"}去${f.place || "山里"}，这场活动的主题是${angle}。${f.price != null ? "费用" + f.price + "一人" : "费用详询"}${f.includedServices && f.includedServices.length ? "，含" + f.includedServices.join("、") : ""}${f.difficulty ? "，强度" + f.difficulty : ""}。名额不多，想一起的朋友现在就可以私信我报名。`,
    },
    poster: {
      title: f.activityName || "户外活动",
      sub: angle,
      place: f.place || "",
      points: [
        (f.place ? "地点：" + f.place : "地点见发布页"),
        (f.price != null ? "费用 ¥" + f.price + "/" + (f.limitUnit || "人") : (f.difficulty ? "强度" + f.difficulty : "信息见发布页")),
      ].slice(0, 2),
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
- xhs：小红书 JSON {titles:[3-5],body,coverText:封面短句,hashtags:[],imageOrder:[]}
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
    out = xfQualityCheck(out, dir, "recruit", f) || out;
    // 质量检查不达标 → 自动重生成一次（§41）
    if (aiAuthMode() && state.xf && state.xf.quality) {
      if (state.xf.quality.fictionRisk) {
        const retry = await xfLLM(sys + "\n⚠️ 上一版被质量检查判定含虚构表述。请严格只使用 confirmedFacts 中的事实，绝对禁止出现任何天气描写、领队具体行为、用户感受代词（我们/大家纷纷表示）、或任何未提供的数据。", user + "\n请基于已确认事实重新生成，确保零虚构。", true);
        if (retry && retry.gzh && retry.gzh.sections && retry.gzh.sections.length >= 3) {
          const rechk = xfQualityCheck(retry, dir, "recruit", f);
          if (state.xf.quality && !state.xf.quality.fictionRisk) out = rechk || retry;
        }
      } else if (state.xf.quality.contentRisk) {
        const retry = await xfLLM(sys + "\n⚠️ 上一版文案质量分偏低（模板感/空洞词/段落重复/缺报名指引）。请去掉套路化开头与空洞词，确保每段有具体事实，结尾给出清晰报名方式。", user, true);
        if (retry && retry.gzh && retry.gzh.sections && retry.gzh.sections.length >= 3) {
          const rechk = xfQualityCheck(retry, dir, "recruit", f);
          if (state.xf.quality && !state.xf.quality.contentRisk && !state.xf.quality.fictionRisk) out = rechk || retry;
        }
      }
    }
  }
  if (!out || !out.gzh || !out.gzh.sections) out = xfFallbackRecruit(a, m, dir);
  out = xfQualityCheck(out, dir, "recruit", f) || out;
  if (out && out.xhs) out.xhs = xfNormalizeXhs(out.xhs);
  return out;
}

/* ---------- 活动回顾 阶段二 ---------- */
/* P0-4 + P0-16 回顾 Fallback 事实安全化：只输出「原活动事实 + 用户补充事实 + 照片现场记录」，绝不虚构现场事件/感受/故事。
   没有补充资料、只有照片时：回顾只能做「照片现场记录」（描述照片里实际存在的画面），不得写
   「我们完成全程 / 大家玩得尽兴 / 有人说… / 合照那一刻 / 返程车上… / 当天下雨 / 大家互相照顾」等未经 actualActivityData 确认的现场。
   类型推断的 scenicValue/experienceValue/participationValue 一律不得作为回顾正文（那是招募视角，不是回顾事实）。 */
function xfFallbackRecap(a, m, dir, photos, notes, type, actual) {
  const f = m.confirmedFacts;
  const act = actual || xfActualActivityData(a, notes);
  const notesTxt = (notes || "").trim();
  const struct = (dir.structure && dir.structure.length >= 5) ? dir.structure.slice(0, 7) : ["开场", "本次活动核心记忆", "本次参与体验", "值得记住的瞬间", "参与者收获", "照片回顾", "下一期预告"];
  const sections = struct.map((h) => ({ h: h, html: xfRecapBody(h, a, m, act, notes, type, photos) }));
  const angle = dir.angle || (type + "的一天");
  return {
    gzh: {
      title: `回顾｜${f.activityName || "这场活动"}`,
      summary: `${f.date || "这场活动"}，${f.place ? f.place + "的" : ""}这场活动已结束。以下基于已确认的活动信息${notesTxt ? "与你补充的现场记录" : ""}${photos && photos.length ? `、共 ${photos.length} 张现场照片` : ""}整理。`,
      sections: sections,
      next: xfNextText(a),
    },
    xhs: {
      titles: [`回顾｜${f.activityName || "这场活动"}`, `${f.place || "山里"}这一趟，记一下`, `${type}的一天`],
      body: `刚结束的${f.activityName || "这场活动"}，记一笔📷\n\n${notesTxt ? "🌟 现场记录\n" + notesTxt + "\n\n" : ""}📍 活动信息\n· 时间：${f.date || "近期"}\n· 地点：${f.place || "—"}\n\n${xfNextText(a)}`,
      coverText: `活动回顾·${f.place || "山野"}`,
      hashtags: xfTags(a).concat(["活动回顾"]),
      imageOrder: ["cover", "people", "team", "scenic", "action"],
    },
    moments: `【活动回顾】${f.activityName || "本周活动"}已结束。${notesTxt ? notesTxt : "感谢每一位到场的朋友。"}${xfNextText(a)}`,
    wechat: `各位群友，${f.activityName || "本次活动"}已经结束。\n\n${notesTxt ? "现场记录：" + notesTxt + "\n\n" : ""}感谢每一位参与的朋友。${xfNextText(a)}`,
    next: xfNextText(a),
  };
}
function xfRecapBody(h, a, m, act, notes, type, photos) {
  const f = m.confirmedFacts;
  const notesTxt = (notes || "").trim();
  // 照片现场记录：只描述照片里实际存在的画面，绝不虚构风景/体验/感受/故事
  const photoList = autoClassifyPhotos(photos || []);
  const photoCount = photoList.length;
  const byCat = {};
  photoList.forEach((p) => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  const has = (c) => (byCat[c] || []).length > 0;
  const sceneCats = ["scenic", "route", "water", "camp", "cover", "detail"].filter(has);
  const peopleCats = ["people", "team", "action"].filter(has);
  const photoRecord = photoCount
    ? `现场共 ${photoCount} 张照片${sceneCats.length ? "，记录了山野、路线与出发/到达等画面" : ""}${peopleCats.length ? "，也有同行伙伴与队伍的身影" : ""}。`
    : "";
  if (/开场|集结/.test(h || "")) return `${f.date || "那天"}，${f.place || "集合点"}，这场「${f.activityName || "活动"}」结束了。`;
  if (/核心记忆|风景|画面|景/.test(h || "")) {
    // 只做照片现场记录，不写类型推断的风景判断（scenicValue 属招募视角，非回顾事实）
    if (photoCount) return photoRecord || `以下为本次活动的现场照片。`;
    return notesTxt ? `本次核心记录：${notesTxt}` : `（暂无现场照片，可在「补充资料」填写现场记录后再生成。）`;
  }
  if (/参与体验|强度|节奏/.test(h || "")) {
    const bits = [];
    // P0-17 人数护栏：仅当用户「独立确认」实际参与人数时才写"实际参加 N 人"；报名人数(registeredParticipants) 绝不被视为实际到场，未确认则不写任何参加人数。
    if (act && act.actualParticipants != null && act.actualParticipants !== "") bits.push("实际参加 " + act.actualParticipants + " 人");
    if (f.difficulty) bits.push("强度为 " + f.difficulty);
    if (f.distance) bits.push("路线约 " + f.distance);
    if (act && act.completionSummary) bits.push(act.completionSummary); // 仅用户确认的实际完成情况
    if (bits.length) return bits.join("，") + "。";
    if (photoCount) return `本次以现场照片为准，可看下方影像记录。`;
    return `以下为本次活动的已确认信息。`;
  }
  if (/瞬间|记得|特别/.test(h || "")) return notesTxt ? `这次特别记下：${notesTxt}` : (photoCount ? `现场的照片里留住了当天的若干瞬间。` : "（如需补充现场瞬间，可在「补充资料」里填写。）");
  if (/收获|得到/.test(h || "")) {
    // 不写类型推断的「收获」判断；只有用户确认的实际反馈才呈现
    if (act && act.actualFeedback && act.actualFeedback.length) return `参与者反馈：${act.actualFeedback.join("；")}。`;
    return photoCount ? `本次的收获与体验以现场照片为准。` : `（参与者收获以现场记录为准；如需补充，请在补充资料填写。）`;
  }
  if (/照片|相册|回顾/.test(h || "")) return photoCount ? `以下为本次活动的现场照片（共 ${photoCount} 张）。` : `本次暂未上传现场照片。`;
  if (/预告|下一期|集结/.test(h || "")) return xfNextText(a);
  // 兜底：只描述照片现场，绝不输出类型推断的体验/价值判断
  return photoCount ? photoRecord : `（本节以现场照片与补充资料为准。）`;
}

async function genRecap(a, m, strategy, photos, notes) {
  const f = m.confirmedFacts;
  const dir = strategy.editorialDirection;
  const type = xfRecapType(a, photos);
  // P0-6 报名人数 ≠ 实际参加人数：仅当用户补充资料明确给出实际人数时才可引用
  const actual = xfActualActivityData(a, notes);
  const peopleLine = actual.actualParticipants
    ? `实际参加 ${actual.actualParticipants} 人（用户已确认，可引用）`
    : `${actual.registeredParticipants ? "报名 " + actual.registeredParticipants + " 人；" : ""}实际参加人数未提供——禁止在正文中写出任何具体参加人数。`;
  const sys = `你是 ClubOS 户外俱乐部内容主笔，写活动回顾。像真正参加过的人认真回看这一天：真实、克制、有完成感。
原则：允许创造表达，禁止创造事件——只基于给定事实与补充资料，不得虚构天气/事件/用户感受/领队行为/具体人数。尤其禁止写「我们完成全程/大家玩得尽兴/有人说…/合照那一刻/返程车上…/当天下雨/大家互相照顾」等未经补充资料确认的现场；只有照片、没有备注时，回顾只能做「照片现场记录」（描述照片里实际存在的画面），绝不能虚构故事或感受。
特别约束：未提供实际参加人数时，正文不得出现任何具体人数；报名人数不能被当作实际参加人数。
按各平台输出：
- gzh：公众号回顾 JSON {title,summary,sections:[{h,html}],next}
- xhs：小红书回顾 JSON {titles:[3],body,coverText:封面短句,hashtags:[],imageOrder:[]}
- moments：朋友圈回顾文案（字符串）
- wechat：微信群感谢文案（字符串）
- next：下一期预告（字符串）
章节标题参考 Editorial Direction.structure，但可按回顾逻辑调整。`;
  const user = `Editorial Direction：${JSON.stringify(dir)}
事实：${JSON.stringify(f)}
回顾类型：${type}
人数：${peopleLine}
补充资料：${notes || "无"}
照片：${photos.length} 张（已分类）`;
  let out = null;
  if (aiAuthMode()) {
    out = await xfLLM(sys, user, true);
    if (!out || !out.gzh || !out.gzh.sections || out.gzh.sections.length < 4) {
      out = await xfLLM(sys + "\n（请严格返回完整 JSON：gzh.sections 至少 5 段，moments/wechat/next 为字符串）", user, true);
    }
    out = xfQualityCheck(out, dir, "recap", f, actual) || out;
    // 质量检查不达标 → 自动重生成一次（§41）
    if (aiAuthMode() && state.xf && state.xf.quality) {
      if (state.xf.quality.fictionRisk) {
        const retry = await xfLLM(sys + "\n⚠️ 上一版被质量检查判定含虚构表述。请严格只用事实与补充资料，禁止任何天气/事件/用户感受/领队行为描写。", user + "\n请基于事实重新生成，确保零虚构。", true);
        if (retry && retry.gzh && retry.gzh.sections && retry.gzh.sections.length >= 4) {
          const rechk = xfQualityCheck(retry, dir, "recap", f, actual);
          if (state.xf.quality && !state.xf.quality.fictionRisk) out = rechk || retry;
        }
      } else if (state.xf.quality.contentRisk) {
        const retry = await xfLLM(sys + "\n⚠️ 上一版文案质量分偏低（模板感/空洞词/段落重复）。请去掉套路化开头，确保每段基于真实事实，结尾有下一期预告。", user, true);
        if (retry && retry.gzh && retry.gzh.sections && retry.gzh.sections.length >= 4) {
          const rechk = xfQualityCheck(retry, dir, "recap", f, actual);
          if (state.xf.quality && !state.xf.quality.contentRisk && !state.xf.quality.fictionRisk) out = rechk || retry;
        }
      }
    }
  }
  if (!out || !out.gzh || !out.gzh.sections) out = xfFallbackRecap(a, m, dir, photos, notes, type, actual);
  out = xfQualityCheck(out, dir, "recap", f) || out;
  if (out && out.xhs) out.xhs = xfNormalizeXhs(out.xhs);
  return out;
}

/* ---------- 质量检查（§39 ContentQualityCheck / §40 EditorialQualityCheck） ---------- */
function xfTextOf(out) {
  const parts = [];
  const gzh = out.gzh || {};
  (gzh.sections || []).forEach((s) => { if (s && s.html) parts.push(s.html); });
  if (gzh.title) parts.push(gzh.title);
  if (gzh.summary) parts.push(gzh.summary);
  if (out.xhs && out.xhs.body) parts.push(out.xhs.body);
  if (out.moments) { if (typeof out.moments === "string") parts.push(out.moments); else ["warm", "formal", "last"].forEach((k) => { if (out.moments[k]) parts.push(out.moments[k]); }); }
  if (out.wechat) { if (typeof out.wechat === "string") parts.push(out.wechat); else ["recruit", "brief"].forEach((k) => { if (out.wechat[k]) parts.push(out.wechat[k]); }); }
  return parts.join("\n");
}

/* §39 ContentQualityCheck：虚构词 / 模板拼接感 / 空洞词 / 重复 / 主题统一 / 图文匹配 / 转化 / 纪实 */
function xfContentQuality(out, dir, scenario, facts, adv) {
  const T = xfTextOf(out);
  const flags = [];
  let score = 100;
  const FORBID = ["万里无云", "阳光明媚", "下起了雨", "突然放晴", "领队说", "大家纷纷表示", "据说", "据说当时", "不得不说", "说实话", "我们都很", "大家都说", "很多人都说", "风景绝好", "风景绝佳", "新手友好", "新手也能跟上", "不用担心跟不上", "强度友好", "我们登顶了", "把山踩在了脚下", "绝对值得", "必去", "guaranteed", "走完了全程", "走完全程", "把这条线走完了", "玩得超尽兴", "玩得尽兴", "大家玩得尽兴", "我们完成全程", "互相照应", "互相照顾", "大家互相照顾", "有人说来对了", "有人说", "合照那一刻", "返程车上安静下来", "返程车上", "当天下雨"];
  let fiction = 0; FORBID.forEach((w) => { if (T.indexOf(w) >= 0) { fiction++; if (flags.indexOf("fiction:" + w) < 0) flags.push("fiction:" + w); } });
  if (fiction > 0) score -= Math.min(45, fiction * 14);
  // P0-8 Claim→Fact 硬校验：服务/保障类声明必须有对应已确认事实，否则标记为无依据声明并降分
  if (facts) {
    const claims = [
      { k: /保险|意外险|投保/, ok: !!facts.insurance, w: "保险" },
      { k: /领队|教练|向导/, ok: !!facts.leader, w: "领队" },
      { k: /大巴|包车|专车|接送/, ok: !!facts.transport, w: "交通" },
      { k: /含餐|午餐|晚餐|早餐|团餐|正餐/, ok: !!facts.meal, w: "餐食" },
      { k: /(提供|配发|免费使用)[^。；\n]{0,6}(装备|登山杖|头盔|救生衣)/, ok: !!(facts.gear && facts.gear.length), w: "装备" },
      // 住宿：不再恒判无依据 —— 若费用包含里写了住宿/房，则视为已确认
      { k: /住宿|客栈|民宿|入住|标间/, ok: !!(facts.lodging || (facts.includedServices || []).some((s) => /住宿|客栈|民宿|房/.test(String(s)))), w: "住宿" },
    ];
    claims.forEach((c) => { if (c.k.test(T) && !c.ok) { score -= 8; flags.push("unsupported:" + c.w); } });
    // P2-2 更强 Claim→Fact：天气 / 实际人数 / 完成情况 / 用户反馈 / 路线成熟度 / 风景判断
    // 全部依赖「已确认事实」或「回顾的实际活动数据」，无依据即标记（不给 AI 留想象空间）
    const A = adv || {};
    const hasList = (x) => (Array.isArray(x) ? x.filter(Boolean).length > 0 : !!x);
    const extraClaims = [
      { k: /(万里无云|阳光明媚|晴空万里|下起了雨|突然放晴|阴雨绵绵|艳阳高照|天气很(好|差))/, ok: !!A.actualWeather, w: "天气" },
      { k: /(\d+)\s*(人|位|名)\s*(参加|到场|实到|出席)|共\s*\d+\s*人|实际参加\s*\d+/, ok: A.actualParticipants != null, w: "实际人数" },
      { k: /(走完|完成)(了)?(全程|整条|整段|路线)|全员登顶|我们登顶|一个不落/, ok: !!A.completionSummary, w: "完成情况" },
      { k: /(有人说|大家(都)?(表示|说)|(队员|学员|家长|参与者)(们)?(都)?(表示|反馈|说)|好评如潮|纷纷点赞|大家一致)/, ok: hasList(A.actualFeedback), w: "用户反馈" },
      { k: /(路线(很|非常)?成熟|成熟的?(路线|线路)|老少皆宜|男女皆宜|毫无难度|闭眼可走|零门槛)/, ok: !!(facts.routeMaturity), w: "路线成熟度" },
      { k: /(风景(绝美|绝佳|美到)|美到窒息|人间仙境|宛如仙境|震撼人心|美得不像话|此生必去)/, ok: false, w: "风景判断" },
    ];
    extraClaims.forEach((c) => { if (c.k.test(T) && !c.ok) { score -= 8; flags.push("unsupported:" + c.w); } });
  }
  const TEMPLATE = ["大家好，", "大家好！", "今天给大家", "一起来看看", "不仅如此", "总而言之", "总的来说", "首先，", "其次，", "最后，"];
  let tpl = 0; TEMPLATE.forEach((w) => { if (T.indexOf(w) >= 0) tpl++; });
  if (tpl >= 3) { flags.push("template"); score -= 10; }
  const HOLLOW = ["说走就走", "治愈", "松弛感", "诗和远方", "岁月静好", "人间值得", "小确幸", "元气满满", "绝绝子"];
  let hollow = 0; HOLLOW.forEach((w) => { if (T.indexOf(w) >= 0) hollow++; });
  if (hollow >= 2) { flags.push("hollow"); score -= 8; }
  const secs = (out.gzh && out.gzh.sections || []).map((s) => (s.html || "").replace(/<[^>]+>/g, ""));
  const seen = {}; let dup = 0;
  secs.forEach((s) => { const key = s.trim().slice(0, 24); if (key.length > 6) { if (seen[key]) dup++; seen[key] = 1; } });
  if (dup > 0) { flags.push("repeat"); score -= 8; }
  const cta = (out.gzh && out.gzh.cta) || (scenario === "recap" && out.gzh && out.gzh.next) || out.next;
  if (!cta) { flags.push("no_cta"); score -= 6; }
  if (scenario === "recap" && fiction > 0) { flags.push("recap_fiction"); score -= 10; }
  return { score: Math.max(0, score), flags: flags, fiction: fiction };
}

/* §40 EditorialQualityCheck：Card Wall / 同结构连续 / 图片占比 / 留白 / 字体层级 / Hero / 招募回顾差异 / 家族匹配 */
function xfEditorialQuality(dir, scenario, family, variant) {
  const flags = [];
  let score = 100;
  const fam = XF_FAMILIES[family];
  if (!fam || !fam.scenario || !fam.scenario.includes(scenario)) { flags.push("family_mismatch"); score -= 20; }
  const structLen = (dir && dir.structure) ? dir.structure.length : 0;
  if (scenario === "recruit" && structLen < 4) { flags.push("recruit_struct"); score -= 6; }
  if (scenario === "recap" && structLen < 5) { flags.push("recap_struct"); score -= 6; }
  if (dir && dir.layoutRhythm && dir.layoutRhythm.maxSamePatternRepeat && dir.layoutRhythm.maxSamePatternRepeat > 2) { flags.push("rhythm"); score -= 10; }
  if (dir && dir.visual && !dir.visual.typographic) { flags.push("no_typo"); score -= 6; }
  if (dir && dir.visual && !dir.visual.coverHint) { flags.push("no_hero"); score -= 6; }
  if (dir && dir.imageRatio) {
    const band = scenario === "recruit" ? [0.5, 0.65] : [0.6, 0.75];
    if (dir.imageRatio < band[0] - 0.05 || dir.imageRatio > band[1] + 0.05) { flags.push("image_ratio"); score -= 8; }
  }
  if (dir && dir.whitespace && ["low", "medium", "generous"].indexOf(dir.whitespace) < 0) { flags.push("whitespace"); score -= 8; }
  return { score: Math.max(0, score), flags: flags };
}

function xfQualityCheck(out, dir, scenario, facts, adv) {
  if (!out) return out;
  const gzh = out.gzh;
  if (!gzh || !gzh.sections || gzh.sections.length < 3) return out;
  const cq = xfContentQuality(out, dir, scenario, facts, adv);
  const family = (dir && dir.family) || (state.xf && state.xf.family) || "";
  const eq = xfEditorialQuality(dir, scenario, family, (dir && dir.variant));
  const fictionRisk = cq.fiction > 0;
  const contentRisk = cq.score < 60;
  const editorialRisk = eq.score < 60;
  if (state.xf) {
    const ficHits = cq.flags.filter((f) => f.indexOf("fiction:") >= 0).map((f) => f.split(":")[1]).slice(0, 3);
    // P2-2：无事实依据的声明（保险/领队/天气/人数/完成情况/用户反馈/路线成熟度/风景判断…）
    const unsupHits = cq.flags.filter((f) => f.indexOf("unsupported:") >= 0).map((f) => f.split(":")[1]).slice(0, 5);
    state.xf.quality = {
      flag: fictionRisk ? "fiction_risk" : (unsupHits.length ? "unsupported_claim" : (contentRisk || editorialRisk ? "quality_risk" : "ok")),
      content: cq, editorial: eq, unsupported: unsupHits,
      contentRisk: contentRisk, editorialRisk: editorialRisk, fictionRisk: fictionRisk,
      note: fictionRisk ? ("检测到可能的虚构表述，建议人工复核：" + ficHits.join("、"))
        : (unsupHits.length ? ("以下说法缺少事实依据，建议修改或删除：" + unsupHits.join("、"))
          : (contentRisk ? "文案质量分偏低（" + cq.score + "），已尝试自动重生成"
            : (editorialRisk ? "版式质量分偏低（" + eq.score + "），已尝试重选家族/变体"
              : "文案基于已确认事实，质量达标（内容 " + cq.score + " / 版式 " + eq.score + "）"))),
    };
  }
  return out;
}

/* ---------- 文案辅助（保留原有模板回退用） ---------- */
function xfFitTitle(a) { return (a.audience && a.audience.length) ? `适合谁 · ${a.audience.join("/")}` : "适不适合我"; }
function xfFitText(a, m) {
  // P0-15：仅从 confirmedFacts 推导「适合谁」。不默认 专业领队/路线成熟/门槛友好 等无依据断言。
  const f = m.confirmedFacts;
  const parts = [];
  if (f.ageRange) parts.push("适合 " + f.ageRange);
  else if (f.audience) parts.push("面向 " + f.audience);
  if (f.difficulty) parts.push("强度" + f.difficulty + "，报名前请确认与自身情况匹配");
  if (f.leader) parts.push("本场由 " + f.leader + " 带队");
  return parts.length ? parts.join("；") + "。" : "具体是否适合你，请结合强度、时间与自身情况判断，或私信咨询。";
}
function xfInfoRows(a) {
  const rows = [];
  if (a.dateMD || a.date) rows.push({ k: "时间", v: a.dateMD || a.date });
  if (a.place) rows.push({ k: "地点", v: a.place });
  if (a.meeting) rows.push({ k: "集合", v: a.meeting + (a.meetTime ? " " + a.meetTime : "") });
  if (a.transport) rows.push({ k: "交通", v: a.transport });
  if (a.meal) rows.push({ k: "餐食", v: a.meal });
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
  // P0-15：标题仅基于事实/表达方向，不做「风景绝美/好拍/松弛」等品质断言。
  const f = m.confirmedFacts;
  const name = f.activityName || "这场活动";
  const arr = [
    `${name}｜${(f.place ? f.place + "·" : "") + (xfSeason(a) || "周末")}招募`,
    `周末去哪？${name}报名信息一览`,
    `${f.place || "户外"}的${xfSeason(a) || ""}行程，报名看这里`,
    `${name}｜${(f.date || "近期")}出发，详情见内文`,
    `${name}活动信息：时间、地点、费用一次说清`,
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
  ${aiAuthMode() === "backend" ? "" : `<div class="xf-banner">未配置总平台后端：当前 AI 走本地演示直连（仅本机 Key）。<button class="xf-banner-btn" data-action="nav" data-view="settings">去「设置 → AI 设置」接入</button></div>`}
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
  const xf = xfState();
  const acts = (state.activities || []).filter(filterFn);
  return `
  <div class="xf-pick">
    <button class="btn btn-ghost btn-sm" data-action="xfGoScenario" data-s="back">${ICON("chevron-left")} 返回</button>
    <h3>${label}</h3>
    ${acts.length ? `<div class="xf-act-list">${acts.map((a) => {
      const selected = xf.aid === a.id;
      const thumbSrc = (a.photos && a.photos[a.coverIndex || 0]) || "";
      return `
      <div class="xf-act ${selected ? "active" : ""}">
        <div class="xf-act-thumb" ${thumbSrc ? smartBg(thumbSrc) : ""}></div>
        <div class="xf-act-info">
          <b>${esc(a.title || "未命名活动")}</b>
          <span class="muted small">${(a.dateMD || a.date || "时间待定")} · ${esc(a.place || "")} · ${esc(a.status || "")}</span>
        </div>
        <button class="btn btn-sm ${selected ? "btn-ghost active" : "btn-primary"}" data-action="xfPickActivity" data-aid="${a.id}">${selected ? `${ICON("check")} 已选` : "选择"}</button>
      </div>`;
    }).join("")}</div>` : `<div class="empty"><div class="e-ic">📭</div><div>${esc(emptyMsg || "没有符合条件的活动，先去「活动内容」创建一场吧。")}</div></div>`}
  </div>`;
}

/* ---------- P1-6 / P1-2：智能筛图结果「轻确认」 ----------
   老板上传的图先经过 piSelect（去重/质量/数量策略），生成前给出：
   建议使用 M 张、封面是哪张、各角色数量、不建议使用的张数；老板可改封面 / 移除某张 / 一键采用推荐。 */
function xfExcluded(xf) { return (xf.photoOverrides && xf.photoOverrides.excluded) || {}; }
function xfActivePhotos(xf) {
  const ex = xfExcluded(xf);
  return (xf.photos || []).filter((s) => !ex[s]);
}
function xfPhotoIntelFor(xf, a, scenario) {
  const photos = xfActivePhotos(xf);
  if (!photos.length || typeof buildPhotoIntelligence !== "function") return null;
  const intel = buildPhotoIntelligence(photos, a || {}, [], scenario || xf.scenario || "recruit");
  // 老板手动指定封面 → 覆盖 Hero 角色
  const ov = xf.photoOverrides || {};
  if (ov.cover != null && ov.cover >= 0) {
    const src = (xf.photos || [])[ov.cover];
    const p = src && intel.used.find((u) => u.src === src);
    if (p) {
      if (intel.heroId) intel.roles[intel.heroId] = "SectionLeadImage";
      intel.roles[p.imageId] = "HeroImage";
      intel.heroId = p.imageId;
    }
  }
  return intel;
}
function xfCoverIndex(xf) {
  const ov = xf.photoOverrides || {};
  if (ov.cover != null && ov.cover >= 0) return Math.min(ov.cover, (xf.photos || []).length - 1);
  const intel = xfPhotoIntelFor(xf, xf._a, xf.scenario);
  if (intel && intel.heroId) {
    const h = intel.used.find((u) => u.imageId === intel.heroId);
    if (h) { const i = (xf.photos || []).indexOf(h.src); if (i >= 0) return i; }
  }
  return 0;
}
function xfPhotoReview(xf) {
  const photos = xf.photos || [];
  if (!photos.length) return "";
  const intel = xfPhotoIntelFor(xf, xf._a, xf.scenario);
  if (!intel) return "";
  const ex = xfExcluded(xf);
  const coverSrc = photos[xfCoverIndex(xf)];
  const usedSet = {}; intel.used.forEach((u) => { usedSet[u.src] = true; });
  const roleOf = (src) => { const p = intel.analysis.find((u) => u.src === src); return intel.roles[p && p.imageId]; };
  const rc = {};
  intel.used.forEach((u) => { const r = intel.roles[u.imageId] || "GalleryImage"; rc[r] = (rc[r] || 0) + 1; });
  const dirty = (xf.photoOverrides && (xf.photoOverrides.cover != null || Object.keys(ex).length));
  return `<div class="xpr">
    <div class="xpr-head"><b>智能筛图结果</b><span class="tiny muted">上传 ${intel.analysis.length} 张 → 建议使用 ${intel.used.length} 张（弃用 ${intel.selection.discarded.length}）</span></div>
    <div class="xpr-chips">
      ${(intel.roleOrder || PI_ROLE_ORDER).map((r) => {
        const n = (intel.roleCounts && intel.roleCounts[r]) || 0;
        if (r === "DiscardCandidate") return n ? `<span class="xpr-chip discard">${intel.roleLabel[r] || r} ${n}</span>` : "";
        return `<span class="xpr-chip ${r === "HeroImage" ? "hl" : ""}">${intel.roleLabel[r] || r} ${n}</span>`;
      }).join("")}
      ${intel.cropSafety.highRiskIds.length ? `<span class="xpr-chip warn">${intel.cropSafety.highRiskIds.length} 张不宜大图（已按原比例保护）</span>` : ""}
      <span class="xpr-chip ${intel.simulated ? "" : "ok"}">${intel.simulated ? "规则推断（模拟分析）" : "真实视觉识别"}</span>
    </div>
    <div class="xpr-vision">
      ${(typeof visionAvailable === "function" && visionAvailable())
        ? `<button class="btn btn-soft btn-sm" data-action="xfVisionAnalyze" ${xf._visionBusy ? "disabled" : ""}>${ICON("sparkles")} ${xf._visionBusy ? "识别中…" : "用视觉模型重新识别"}</button>`
        : `<span class="tiny muted">未配置视觉模型 → 当前为本地像素分析 + 规则推断（可在「设置 → AI 设置 → 视觉模型」接入）</span>`}
      ${xf._visionNote ? `<span class="tiny muted">${esc(xf._visionNote)}</span>` : ""}
    </div>
    <div class="xpr-grid">
      ${photos.map((p, i) => {
        const isCover = p === coverSrc;
        const isEx = !!ex[p];
        const inUsed = !!usedSet[p];
        const lab = isCover ? "封面" : (isEx ? "已移除" : (inUsed ? (intel.roleLabel[roleOf(p)] || "使用") : "建议弃用"));
        return `<div class="xpr-cell ${isCover ? "is-cover" : ""} ${isEx ? "is-ex" : ""} ${(!inUsed && !isEx) ? "is-soft" : ""}">
          <div class="xpr-ph" ${smartBg(p)}></div>
          <span class="xpr-badge">${esc(lab)}</span>
          <span class="xpr-ops">
            ${isCover ? "" : `<button class="xpr-btn" data-action="xfSetCover" data-i="${i}">设为封面</button>`}
            <button class="xpr-btn" data-action="xfToggleExclude" data-i="${i}">${isEx ? "恢复" : "移除"}</button>
          </span>
        </div>`;
      }).join("")}
    </div>
    ${dirty ? `<button class="xpr-reset" data-action="xfUseRecommended">采用 AI 推荐（还原封图与筛选）</button>` : ""}
    <p class="tiny muted">AI 会按内容把图片匹配到正文段落；「移除」的图不会进入生成结果。</p>
  </div>`;
}

function xfRecruitPicker() {
  const xf = xfState();
  return xfActivityPicker((a) => a.status === "recruiting" || a.status === "draft" || a.status === "full" || !a.status, "选择要招募的活动") +
    (xf.genState === "loading" ? `<div class="xf-loading-overlay"><div class="xf-spinner"></div><div class="xf-loading-title">正在生成宣传内容</div><div class="xf-loading-tip">理解活动 → 分析照片 → 撰写文案 → 多平台排版</div></div>` : "") +
    `<div class="xf-supp">
      <div class="panel"><div class="panel-head"><h3>补充资料（可选）</h3><span class="tiny muted">粘贴旧文案 / 备注，帮助 AI 更准</span></div>
        <div class="panel-body"><textarea class="textarea" data-xf="note" placeholder="例如：往年这篇活动阅读很高、客户最关心亲子安全、这次新增了溯溪环节…">${esc(xf.notes || "")}</textarea></div></div>
      <div class="panel"><div class="panel-head"><h3>添加图片 / 海报（可选）</h3><span class="tiny muted">用于公众号配图，自动分类</span></div>
        <div class="panel-body">
          <div class="xf-photos">${(xf.photos || []).map((p, i) => `<div class="xf-ph" ${smartBg(p)}><button class="x" data-action="xfDelPhoto" data-i="${i}">${ICON("x")}</button></div>`).join("")}
            <label class="xf-ph-add">${ICON("upload")}<input type="file" id="xfPhotoInput" accept="image/*" multiple hidden></label></div>
          ${xfPhotoReview(xf)}
          <button class="btn btn-primary btn-sm" data-action="xfRecruitGen" style="margin-top:10px" ${xf.genState === "loading" ? "disabled" : ""}>${ICON("sparkles")} ${xf.genState === "loading" ? "生成中…" : "生成宣传内容"}</button>
        </div></div>
    </div>`;
}

function xfRecapPicker() {
  const xf = xfState();
  const c = xf.customRecap || {};
  const selected = xf.aid ? (state.activities || []).find((a) => a.id === xf.aid) : null;
  return xfActivityPicker((a) => a.status === "ended", "选择已结束的活动", "没有已结束活动，可直接填写下方信息生成回顾") +
    (selected ? `<div class="xf-supp"><div class="panel"><div class="panel-head"><h3>已选择活动</h3></div><div class="panel-body"><div class="xf-act" style="margin:0"><div class="xf-act-info"><b>${esc(selected.title || "未命名活动")}</b><span class="muted small">${(selected.dateMD || selected.date || "时间待定")} · ${esc(selected.place || "")}</span></div><button class="btn btn-ghost btn-sm" data-action="xfPickActivity" data-aid="">清除选择</button></div></div></div></div>` : "") +
    (xf.genState === "loading" ? `<div class="xf-loading-overlay"><div class="xf-spinner"></div><div class="xf-loading-title">正在生成活动回顾</div><div class="xf-loading-tip">理解活动 → 分析照片 → 撰写回顾 → 多平台排版</div></div>` : "") +
    `<div class="xf-supp">
      <div class="panel"><div class="panel-head"><h3>上传本次活动照片</h3><span class="tiny muted">先传照片，AI 先识别 / 筛图 / 分类，再据此提炼回顾主题</span></div>
        <div class="panel-body">
          <div class="xf-photos">${(xf.photos || []).map((p, i) => `<div class="xf-ph" ${smartBg(p)}><button class="x" data-action="xfDelPhoto" data-i="${i}">${ICON("x")}</button><span class="xf-ph-cat">${xfPhotoCategory(p, i)}</span></div>`).join("")}
            <label class="xf-ph-add">${ICON("camera")}<input type="file" id="xfPhotoInput" accept="image/*" multiple hidden></label></div>
          ${xfPhotoReview(xf)}
          ${(xf.photos || []).length ? "" : `<p class="tiny muted">上传现场照片后，AI 会先整理照片，再基于照片与补充信息提炼回顾主题。</p>`}
        </div></div>
      <div class="panel"><div class="panel-head"><h3>或直接填写活动信息生成回顾</h3><span class="tiny muted">不绑定已有活动时使用这些信息</span></div>
        <div class="panel-body">
          <div class="xf-field"><label>活动名称</label><input class="input" data-xf="customTitle" placeholder="例如：虹口漂流一日记" value="${esc(c.title || "")}"></div>
          <div class="xf-field"><label>活动时间</label><input class="input" data-xf="customDate" placeholder="例如：9月28日" value="${esc(c.date || "")}"></div>
          <div class="xf-field"><label>活动地点</label><input class="input" data-xf="customPlace" placeholder="例如：都江堰虹口" value="${esc(c.place || "")}"></div>
          <div class="xf-field"><label>活动类型</label><input class="input" data-xf="customType" placeholder="漂流 / 登山 / 亲子 / 露营…" value="${esc(c.type || "")}"></div>
          <div class="xf-field"><label>参与人数</label><input class="input" data-xf="customSignups" type="number" placeholder="例如：18" value="${esc(c.signups || "")}"></div>
          <div class="xf-field"><label>领队 / 组织者</label><input class="input" data-xf="customLeader" placeholder="例如：阿龙" value="${esc(c.leader || "")}"></div>
        </div></div>
      <div class="panel"><div class="panel-head"><h3>补充真实信息（可选）</h3><span class="tiny muted">领队备注 / 用户反馈 / 特别瞬间 / 实际天气</span></div>
        <div class="panel-body"><textarea class="textarea" data-xf="recapNotes" placeholder="例如：当天其实放晴了、小朋友第一次自己爬上来、大家最满意的是晚餐…">${esc(xf.recapNotes || "")}</textarea>
          <button class="btn btn-primary btn-sm" data-action="xfRecapGen" style="margin-top:10px" ${xf.genState === "loading" ? "disabled" : ""}>${ICON("sparkles")} ${xf.genState === "loading" ? "生成中…" : "生成活动回顾"}</button>
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
  const famLabel = (XF_FAMILIES[xf.family] && XF_FAMILIES[xf.family].label) || "";
  const vs = (XF_FAMILIES[xf.family] && XF_FAMILIES[xf.family].variants) || [""];
  const vName = vs[xf.variant || 0] || "";
  const q = xf.quality || {};
  // P1-8 质量信息用户化：**分数**属内部信息，留在「高级信息」内。
  // 但「缺少事实依据」是合规警告（P2-2），必须默认可见 —— 折进折叠块里等于没提示。
  const warnText = q.fictionRisk ? ("⚠️ " + (q.note || "发现可能缺少事实依据的描述，请确认。"))
    : ((q.unsupported && q.unsupported.length) ? ("⚠️ 以下说法缺少事实依据，建议修改或删除：" + q.unsupported.join("、")) : "");
  const qText = (q.content || q.editorial) ? "✓ 已检查真实信息，未发现明显事实冲突" : "";
  return `<div class="xf-stylebar">
    <div class="xf-stylebar-row xf-stylebar-main">
      <span class="xf-stylebar-lbl">当前风格</span>
      <b class="xf-style-name">${esc(famLabel)}${vName ? " · " + esc(vName) : ""}</b>
      <button class="btn btn-ghost btn-sm" data-action="xfNextVariant">${ICON("refresh")} 换一种版式</button>
      <button class="btn btn-ghost btn-sm" data-action="xfSwitchStyle">${ICON("sparkles")} 换一种风格</button>
    </div>
    ${warnText ? `<div class="xf-stylebar-row xf-warn">${esc(warnText)}</div>` : ""}
    <div class="xf-stylebar-row xf-quick"><span class="xf-stylebar-lbl">快速调整</span>${(sc === "recruit"
      ? [["magazine", "更杂志"], ["visual", "更视觉"], ["pro", "更专业"], ["young", "更年轻"], ["challenge", "更有挑战感"]]
      : [["doc", "更纪实"], ["warm", "更温暖"], ["album", "更像画册"], ["people", "更有人物感"], ["nature", "更自然"]]
    ).map(([k, l]) => `<button class="xf-chip xf-chip-soft" data-action="xfQuickStyle" data-k="${k}">${l}</button>`).join("")}</div>
    <div class="xf-stylebar-row xf-stylebar-local"><span class="xf-stylebar-lbl">局部重生成</span>
      <button class="xf-chip" data-action="xfRegenTitle">${ICON("refresh")} 只改标题</button>
      <button class="xf-chip" data-action="xfRegenCta">${ICON("refresh")} 只改结尾</button>
      <button class="xf-chip" data-action="xfShufflePhotos">${ICON("refresh")} 只换图片安排</button>
      <button class="xf-chip" data-action="xfNextVariant">${ICON("refresh")} 只换布局</button>
    </div>
    <details class="xf-adv"><summary>高级信息（内部版式参数）</summary>
      <div class="xf-stylebar-row"><span class="xf-stylebar-lbl">编辑家族</span>${fams.map((f) => `<button class="xf-chip ${xf.family === f ? "active" : ""}" data-action="xfSwitchFamily" data-f="${f}">${XF_FAMILIES[f].label}</button>`).join("")}</div>
      <div class="xf-stylebar-row"><span class="xf-stylebar-lbl">版式变体</span>${vs.map((v, i) => `<button class="xf-chip ${xf.variant === i ? "active" : ""}" data-action="xfSwitchVariant" data-v="${i}">${v}</button>`).join("")}</div>
      ${dir ? `<div class="xf-dir">编辑方向：<b>${esc(dir.angle || "")}</b>${dir.hook ? ` · 钩子「${esc(dir.hook)}」` : ""} · 视觉 ${esc((dir.visual && dir.visual.color) || "")}/${esc((dir.visual && dir.visual.composition) || "")}</div>` : ""}
      ${qText ? `<div class="xf-q">${esc(qText)}</div>` : ""}
    </details>
  </div>`;
}

/* §38 平台快速风格控制：仅调 ED 权重/视觉参数 + 换版式，不整跑文案 */
function xfQuickStyle(kind) {
  const xf = xfState();
  if (!xf.strategy) { toast("请先生成内容"); return; }
  const sc = xf.scenario;
  const map = sc === "recruit"
    ? {
      magazine: { family: "route_editorial", color: "墨绿", typographic: "衬线大标题", composition: "左右交替", whitespace: "medium" },
      visual: { family: "visual_campaign", color: "暖米", typographic: "无衬线粗体", composition: "卡片流", whitespace: "generous" },
      pro: { family: "challenge_editorial", color: "夜空蓝", typographic: "无衬线粗体", composition: "数据条+区块", whitespace: "low" },
      young: { family: "visual_campaign", color: "暖米", typographic: "无衬线粗体", composition: "卡片流", whitespace: "generous" },
      challenge: { family: "challenge_editorial", color: "夜空蓝", typographic: "无衬线粗体", composition: "数据条+区块", whitespace: "low" },
    }
    : {
      doc: { family: "brand_journal", color: "山系橙", composition: "大图主导", whitespace: "generous" },
      warm: { family: "photo_documentary", color: "松石", composition: "手账步骤", whitespace: "generous" },
      album: { family: "outdoor_lookbook", color: "暖米", composition: "网格画廊", whitespace: "generous" },
      people: { family: "photo_documentary", color: "松石", composition: "手账步骤", whitespace: "medium", imagePriority: "high" },
      nature: { family: "brand_journal", color: "山系橙", composition: "大图主导", whitespace: "generous" },
    };
  const cfg = map[kind];
  if (!cfg) return;
  const dir = xf.strategy.editorialDirection;
  if (cfg.family && XF_FAMILIES[cfg.family]) {
    xf.family = cfg.family; dir.family = cfg.family;
    const vs = (XF_FAMILIES[cfg.family].variants || [""]).length;
    xf.variant = Math.floor(xfRand(xfStyleSeed() * 3.3 + 7) * vs) % vs;
    dir.variant = xf.variant;
  }
  if (cfg.color) dir.visual.color = cfg.color;
  if (cfg.typographic) dir.visual.typographic = cfg.typographic;
  if (cfg.composition) dir.visual.composition = cfg.composition;
  if (cfg.whitespace) dir.whitespace = cfg.whitespace;
  if (cfg.imagePriority) dir.imagePriority = cfg.imagePriority;
  xf._styleHistory.push({ family: xf.family, variant: xf.variant });
  toast("已应用风格");
  showView(state.view);
}

/* ---------- P2-1 局部重生成：只改标题 / 只改结尾 / 只换图片安排（不动其他内容与事实） ---------- */
function xfBumpSeed(xf) { xf.regenSeed = ((xf.regenSeed || 0) + 1); return xf.regenSeed; }
function xfTitleCandidates(a, m, dir, scenario) {
  const f = (m && m.confirmedFacts) || {};
  const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a) : null;
  const place = f.place || "";
  const season = f.season || (dna && dna.season) || "";
  const dist = f.distance || "";
  const kind = (dna && dna.coreMotivationLabel) || "";
  const name = f.activityName || "这场活动";
  const theme = (m && m.mainTheme) || (dir && dir.angle) || "这一程";
  const t = [];
  if (scenario === "recap") {
    t.push(`回顾｜${name}`);
    t.push(`${season ? season + "，" : ""}我们在${place || "山野"}的这一程`);
    t.push(`记一次${f.activityType || "户外"}｜${place || "山野"}`);
    t.push(`${name} · 现场记录`);
  } else {
    t.push(`${name}｜${theme}`);
    if (place) t.push(`${season ? season + "的" : ""}${place}，${dist ? "约" + dist + "公里" : "值得走一趟"}`);
    if (kind) t.push(`${kind}${season ? "｜" + season : ""}${place ? " · " + place : ""}`);
    t.push(`${theme}${dist ? "｜约 " + dist + " 公里" : ""}`);
  }
  return t.filter(Boolean);
}
function xfRegenTitle() {
  const xf = xfState();
  if (!xf.out || !xf.out.gzh) { toast("请先生成内容"); return; }
  const cands = xfTitleCandidates(xf._a, xf.master, xf.strategy && xf.strategy.editorialDirection, xf.scenario);
  if (!cands.length) return;
  const seed = xfBumpSeed(xf);
  const pick = cands[seed % cands.length];
  xf.out.gzh.title = pick;
  if (xf.out.poster) xf.out.poster.title = pick;
  if (xf.out.xhs && Array.isArray(xf.out.xhs.titles) && xf.out.xhs.titles.length) xf.out.xhs.titles[0] = pick;
  toast("已换一版标题");
  showView(state.view);
}
function xfRegenCta() {
  const xf = xfState();
  if (!xf.out || !xf.out.gzh) { toast("请先生成内容"); return; }
  const f = (xf.master && xf.master.confirmedFacts) || {};
  const seed = xfBumpSeed(xf);
  const when = f.date || "近期";
  const price = f.price != null ? "¥" + f.price + "/" + (f.limitUnit || "人") : "详询";
  const opts = xf.scenario === "recap"
    ? ["下一期正在安排，留意群里接龙就能占位。", "想去的先加群，路线一确定就发通知。", "老地方见，下一程继续一起走。"]
    : [`${when} 出发，${price}${f.limit ? "，限 " + f.limit + (f.limitUnit || "人") : ""}，先到先得。`,
      `名额有限，私信或群里接龙占位，${when} 见。`,
      `${price}，含已确认服务；报名从本页提交即可。`];
  const pick = opts[seed % opts.length];
  if (xf.scenario === "recap") xf.out.gzh.next = pick; else xf.out.gzh.cta = pick;
  toast("已换一版结尾");
  showView(state.view);
}
function xfShufflePhotos() {
  const xf = xfState();
  const ki = xf.master && xf.master.keyImages;
  if (!ki || ki.length < 2) { toast("图片不足，无法调整安排"); return; }
  ki.push(ki.shift()); // 轮转一位：改变图文配图顺序，不动文案与事实
  if (xf.photoOverrides) xf.photoOverrides.cover = null;
  toast("已换一种图片安排");
  showView(state.view);
}
/* 无 Key 时的事实驱动「换一种说法」——只换表达，不新增任何事实 */
function xfSectionAlt(h, m, a, seed) {
  const f = (m && m.confirmedFacts) || {};
  const dna = (typeof activityDNAOf === "function") ? activityDNAOf(a) : null;
  const place = f.place || "";
  const season = f.season || (dna && dna.season) || "";
  const mood = (dna && dna.coreMotivationLabel) || "";
  const H = String(h || "");
  const opts = [];
  if (/为什么|值得|风景|地点|路线|地貌|景/.test(H)) {
    opts.push(`${season ? season + "，" : ""}${place || "这一程"}值得走一趟，不是因为多难，而是它刚好把${mood || "这一段心情"}接住了。`);
    opts.push(`先去走一遍${place || "它"}。看得见的风景，比任何描述都可靠。`);
    opts.push(`${place || "这里"}的好，不在攻略里，在你走进去的那几步。`);
  } else if (/体验|玩|挑战|探索|运动|做/.test(H)) {
    opts.push(`${season ? season + "的" : ""}节奏里，注意力会从待办清单挪到脚下——走、看、停一停。`);
    opts.push(`不用急着打卡；${f.days > 1 ? "两天一夜" : "一天"}的工夫，够把节奏慢下来。`);
    opts.push(`体验很具体：身体动起来，脑子空下来。`);
  } else if (/收获|得到|适合|谁|陪伴|成长/.test(H)) {
    opts.push(`${f.ageRange ? "适合 " + f.ageRange + "。" : ""}${m.targetAudience || "想换口气的人"}会喜欢这种踏实感。`);
    opts.push(`带走的不是照片，是一个能反复回想的周末。`);
  } else if (/预告|下一期|集结/.test(H)) {
    opts.push(`下一程还在排，群里接龙就能占位。`);
  } else {
    return "";
  }
  return opts.length ? opts[(seed || 0) % opts.length] : "";
}
async function xfRegenSection(i) {
  const xf = xfState();
  const gzh = xf.out && xf.out.gzh;
  if (!gzh || !gzh.sections || !gzh.sections[i]) { toast("没有可重写的段落"); return; }
  const sec = gzh.sections[i];
  if (/信息|报名|费用|详情|须知/.test(String(sec.h || ""))) {
    // 决策信息段不参与改写，避免把事实改成表达
    toast("「" + sec.h + "」是决策信息段，保持事实原样不改写");
    return;
  }
  let html = null;
  if (aiAuthMode() && xf.master) {
    const f = xf.master.confirmedFacts || {};
    const dir = (xf.strategy && xf.strategy.editorialDirection) || {};
    const plain = String(sec.html || "").replace(/<[^>]+>/g, "").slice(0, 220);
    const sys = `你是户外活动内容编辑。只重写「指定段落」，其余段落不动。
原则：允许创造表达，禁止创造事件——不得新增任何未确认事实（天气 / 领队行为 / 具体人数 / 用户感受 / 完成情况 / 服务承诺 / 路线成熟度 / 风景判断）。
输出 JSON：{ "html": "一段 HTML 正文，可用 <p> 分段，80-160 字，口语自然、有画面感但不虚构" }`;
    const user = `已确认事实：${JSON.stringify(f)}
编辑角度：${dir.angle || ""}（语气：${dir.tone || ""}）
段落标题：${sec.h}
现有内容：${plain}
请只重写这一段，与标题一致、与事实一致。`;
    const r = await xfLLM(sys, user, true);
    if (r && r.html) html = String(r.html).replace(/<script[\s\S]*?<\/script>/gi, "");
  }
  if (!html) {
    const seed = xfBumpSeed(xf);
    html = xfSectionAlt(sec.h, xf.master || {}, xf._a || {}, seed) || xfSectionBody(sec.h, xf._a || {}, xf.master || {}) || sec.html;
  }
  sec.html = html;
  toast("已重写「" + sec.h + "」");
  showView(state.view);
}
function xfSectionRegen(xf) {
  const gzh = xf.out && xf.out.gzh;
  if (!gzh || !gzh.sections || gzh.sections.length < 2) return "";
  return `<div class="xf-secregen">
    <span class="xf-stylebar-lbl">只重写某一段</span>
    ${gzh.sections.map((s, i) => `<button class="xf-chip" data-action="xfRegenSection" data-i="${i}">${ICON("refresh")} ${esc(s.h || ("第" + (i + 1) + "段"))}</button>`).join("")}
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
  ${xfSectionRegen(xf)}
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
  let cover = gzh.cover && gzh.cover.src ? gzh.cover : null;
  if (!cover) {
    // P0-8：封面优先使用图片智能判定的 HeroImage（横图 + 风景优先、且规避高风险裁切）
    const intel = (xf.strategy && xf.strategy.photoIntel) || null;
    const heroUsed = (intel && intel.heroId) ? intel.used.find((u) => u.imageId === intel.heroId) : null;
    const list = (xf.master && xf.master.keyImages) || [];
    if (heroUsed) cover = list.find((p) => p.src === heroUsed.src) || null;
    if (!cover && xf.master) cover = matchPhoto(xf.master, "cover", 0);
    if (!cover || !cover.src) { if (list.length) cover = list[0]; }
  }
  return cover || {};
}
function xfPhotoSet(xf, prefer, count) {
  const list = [];
  const used = new Set();
  // P0-7/P0-8：若有图片智能结果，先用「自动筛图 + 角色」排序后的池子（Hero 优先，弃用图不参与）
  const intel = (xf.strategy && xf.strategy.photoIntel) || null;
  let imgs = (xf.master && xf.master.keyImages) || [];
  if (intel && intel.used && intel.used.length) {
    const rank = {};
    intel.used.forEach((u, i) => { rank[u.src] = i; });
    const roleOrder = { HeroImage: 0, SectionLeadImage: 1, SupportImage: 2, GalleryImage: 3, DetailImage: 4 };
    const filtered = imgs.filter((p) => p && p.src && rank[p.src] != null)
      .sort((p1, p2) => (roleOrder[intel.roles[intel.used[rank[p1.src]].imageId]] || 9) - (roleOrder[intel.roles[intel.used[rank[p2.src]].imageId]] || 9) || rank[p1.src] - rank[p2.src]);
    if (filtered.length) imgs = filtered; // 全被筛掉时回退原集合，避免无图
  }
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
  // P0-14：高亮关键词只含「资料/类型确认」的字段，禁止凭类型推断注入未确认的具体景观(森林/溪流/山顶/篝火/星空…)
  const kw = [p.themeA, (a.place || ""), (a.type || ""), "露营", "徒步", "溯溪", "桨板", "漂流"].filter(Boolean);
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
        ${ph && ph.src ? `<div class="gzh-sec-spread-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(xfCap(ph, ""))}</span></div>` : ""}
        <div class="gzh-sec-spread-body">${parasFn(s.html)}</div>
      </section>`;
    }).join("");
  }
  return `<div class="gzh-sec-grid">` + sections.map((s, i) => {
    const ph = secPhotos[i] || null;
    return `<div class="gzh-sec-cell">
      ${ph && ph.src ? `<div class="gzh-sec-cell-img" ${smartBg(ph.src)}></div>` : ""}
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
    ? `<div class="gzh-hero" ${smartBg(cover.src)}><div class="gzh-hero-mask"></div><div class="gzh-hero-txt"><div class="gzh-eyebrow">${esc(eyebrow)}</div><h1 class="gzh-hero-title">${esc(heroTitle)}</h1>${heroSub ? `<div class="gzh-hero-sub">${esc(heroSub)}</div>` : ""}${heroDate ? `<div class="gzh-hero-pill">${esc(heroDate)}</div>` : `<div class="gzh-hero-pill">${esc(pill)}</div>`}</div></div>`
    : `<div class="gzh-hero gzh-hero-empty"><div class="gzh-hero-mask"></div><div class="gzh-hero-txt"><div class="gzh-eyebrow">${esc(eyebrow)}</div><h1 class="gzh-hero-title">${esc(heroTitle)}</h1>${heroSub ? `<div class="gzh-hero-sub">${esc(heroSub)}</div>` : ""}${heroDate ? `<div class="gzh-hero-pill">${esc(heroDate)}</div>` : `<div class="gzh-hero-pill">${esc(pill)}</div>`}<div class="gzh-hero-upload-hint">📷 上传 1 张大图，这里会变成全幅封面</div></div></div>`;

  const lead = gzh.summary ? `<div class="gzh-lead"><p>${esc(gzh.summary)}</p></div>` : "";

  const nextPhoto = (layout) => {
    if (layout === "gzh-sec-quote") return null;
    return secPhotos[photoIdx++] || null;
  };

  const sections = (gzh.sections || []).map((s, i) => {
    const layoutClass = ["gzh-sec-full", "gzh-sec-split", "gzh-sec-quote", "gzh-sec-img"][i % 4];
    const ph = nextPhoto(layoutClass);
    const paras = xfGzhTextParas(s.html).map((p) => `<p>${xfGzhHighlight(p, a)}</p>`);
    if (layoutClass === "gzh-sec-quote") return xfRenderComponent("PullQuote", { h: s.h, paras: paras });
    if (layoutClass === "gzh-sec-split" && ph && ph.src) return xfRenderComponent("ImagePair", { h: s.h, paras: paras, ph: ph });
    if (layoutClass === "gzh-sec-img" && ph && ph.src) return `<section class="gzh-sec gzh-sec-img">${xfRenderComponent("FullBleedImage", { ph: ph })}<div class="gzh-img-text"><h2>${esc(s.h)}</h2>${paras.join("")}</div></section>`;
    return `<section class="gzh-sec gzh-sec-full"><h2>${esc(s.h)}</h2>${paras.join("")}${ph && ph.src ? `<div class="gzh-sec-imgbox" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(xfCap(ph, ""))}</span></div>` : ""}</section>`;
  }).join("");

  const infoBlock = (!isRecap && gzh.info && gzh.info.length)
    ? `<div class="gzh-info-grid">${xfRenderComponent("InfoGrid", { rows: gzh.info })}</div>`
    : "";

  const feeBlock = (!isRecap && gzh.fee)
    ? `<div class="gzh-diary-block"><h2>费用说明</h2>${xfRenderComponent("FeeBlock", { fee: gzh.fee, service: gzh.service })}</div>`
    : "";

  const uploadHint = !hasPhotos
    ? `<div class="gzh-upload-tip"><div class="gzh-upload-tip-ic">📷</div><div><b>这张图文还没有照片</b><p>在「添加图片 / 海报」处上传 3–6 张活动照片，系统会自动匹配到封面与各段落，排版会立刻更有杂志感。</p></div></div>`
    : "";

  const ctaText = gzh.cta || (isRecap && gzh.next) || "";
  const cta = ctaText ? xfRenderComponent("EditorialCTA", { text: ctaText }) : "";

  return `<div class="gzh-article gzh-diary gzh-var-${xf.variant}"${xfWsIr(xf, isRecap)} id="xfGzhArticle" contenteditable="true" spellcheck="false">
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
    ? `<div class="gzh-info"><h2>活动信息</h2>${xfRenderComponent("InfoTable", { rows: gzh.info })}</div>`
    : "";
  const feeBlock = (!isRecap && gzh.fee)
    ? `<div class="gzh-block"><h2>费用说明</h2>${xfRenderComponent("FeeBlock", { fee: gzh.fee, service: gzh.service })}</div>`
    : "";
  const ctaText = gzh.cta || (isRecap && gzh.next) || "";
  const cta = ctaText ? xfRenderComponent("EditorialCTA", { text: ctaText, cls: "gzh-cta" }) : "";
  const uploadHint = !hasPhotos
    ? `<div class="gzh-upload-tip"><div class="gzh-upload-tip-ic">📷</div><div><b>这张图文还没有照片</b><p>上传 3–6 张照片，各版式会自动匹配封面与段落配图。</p></div></div>`
    : "";

  if (layout === "youth") {
    const cards = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = xfGzhTextParas(s.html).map((p) => `<p>${xfGzhHighlight(p, a)}</p>`);
      return xfRenderComponent("YouthCard", { h: s.h, paras: paras, ph: ph, i: i });
    }).join("");
    const tags = xfTags(a).slice(0, 6);
    return `<div class="gzh-article gzh-youth gzh-var-${xf.variant}"${xfWsIr(xf, isRecap)} id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-youth-hero">
        <div class="gzh-youth-eyebrow">${esc(eyebrow)}</div>
        <h1 class="gzh-youth-title">${esc(gzh.title)}</h1>
        ${gzh.subtitle ? `<div class="gzh-youth-sub">${esc(gzh.subtitle)}</div>` : ""}
        ${cover.src ? `<div class="gzh-youth-cover" ${smartBg(cover.src)}></div>` : ""}
      </div>
      ${gzh.summary ? `<div class="gzh-youth-lead">${parasFn(gzh.summary)}</div>` : ""}
      <div class="gzh-youth-cards">${vSec != null ? vSec : cards}</div>
      <div class="gzh-youth-tags">${xfRenderComponent("TagRow", { tags: tags })}</div>
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  if (layout === "family") {
    const steps = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = xfGzhTextParas(s.html).map((p) => `<p>${xfGzhHighlight(p, a)}</p>`);
      return xfRenderComponent("FamilyStep", { h: s.h, paras: paras, ph: ph, i: i });
    }).join("");
    return `<div class="gzh-article gzh-family gzh-var-${xf.variant}"${xfWsIr(xf, isRecap)} id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-family-hero">
        <div class="gzh-family-cover" ${cover.src ? `${smartBg(cover.src)}` : ""}>
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
    const kvHtml = xfRenderComponent("MetricStrip", { kvs: kv });
    const sections = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = xfGzhTextParas(s.html).map((p) => `<p>${xfGzhHighlight(p, a)}</p>`);
      return xfRenderComponent("ChallengeSec", { h: s.h, paras: paras, ph: ph, i: i });
    }).join("");
    return `<div class="gzh-article gzh-challenge gzh-var-${xf.variant}"${xfWsIr(xf, isRecap)} id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-challenge-hero">
        <div class="gzh-challenge-eyebrow">${esc(eyebrow)}</div>
        <h1 class="gzh-challenge-title">${esc(gzh.title)}</h1>
        ${gzh.subtitle ? `<div class="gzh-challenge-sub">${esc(gzh.subtitle)}</div>` : ""}
        <div class="gzh-challenge-kvs">${kvHtml}</div>
      </div>
      ${cover.src ? `<div class="gzh-challenge-cover" ${smartBg(cover.src)}></div>` : ""}
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
    const kvHtml = xfRenderComponent("MetricStrip", { kvs: kv });
    const sections = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = xfGzhTextParas(s.html).map((p) => `<p>${xfGzhHighlight(p, a)}</p>`);
      const align = i % 2 === 0 ? "left" : "right";
      return xfRenderComponent("LongformSec", { h: s.h, paras: paras, ph: ph, i: i, align: align });
    }).join("");
    return `<div class="gzh-article gzh-longform gzh-var-${xf.variant}"${xfWsIr(xf, isRecap)} id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-longform-hero">
        ${cover.src ? `<div class="gzh-longform-cover" ${smartBg(cover.src)}><div class="gzh-longform-cover-mask"></div></div>` : ""}
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
      ${ph && ph.src ? `<div class="gzh-mag-img" ${smartBg(ph.src)}><span class="gzh-img-cap">${esc(xfCap(ph, ""))}</span></div>` : ""}
    </section>`;
  }).join("");
  const gallery = photos.length > 1
    ? `<div class="gzh-gallery-classic"><h2>本期画面</h2>${xfRenderComponent("GalleryGrid", { photos: photos.slice(0, 4) })}</div>`
    : "";
  return `<div class="gzh-article gzh-magazine gzh-var-${xf.variant}"${xfWsIr(xf, isRecap)} id="xfGzhArticle" contenteditable="true" spellcheck="false">
    <div class="gzh-cover" ${cover.src ? `${smartBg(cover.src)}` : ""}><div class="gzh-cover-mask"><div class="gzh-cover-cap">${esc(xfCap(cover, "") ? "封面建议：" + xfCap(cover, "") : (xf.photos && xf.photos.length ? "可换一张更具张力的大图作封面" : "未上传照片，建议补 1 张封面大图"))}</div></div></div>
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
  const d = xfNormalizeXhs(x);
  const orderLabel = { cover: "封面", scenic: "风景", people: "人物", action: "行进步", team: "团队", gear: "装备", meal: "餐食", camp: "营地", route: "路线", water: "亲水", detail: "细节" };
  const orderChips = (d.imageOrder && d.imageOrder.length)
    ? d.imageOrder.map((o) => `<span class="xf-tag xf-tag-soft">${esc(orderLabel[o] || o)}</span>`).join("")
    : "";
  return `<div class="xf-text-card">
    <div class="xf-field"><label>标题候选</label>${d.titles.map((t) => `<div class="xf-line">· ${esc(t)} <button class="copy-btn" data-action="xfCopyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>
    <div class="xf-field"><label>正文</label><div class="xf-pre">${esc(d.body)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(d.body)}">复制正文</button></div>
    <div class="xf-field"><label>封面短句</label><div class="xf-line">${esc(d.coverText)}</div></div>
    <div class="xf-field"><label>话题标签</label><div class="xf-tags">${d.hashtags.map((t) => `<span class="xf-tag">#${esc(t)}</span>`).join("")}</div></div>
    ${orderChips ? `<div class="xf-field"><label>建议配图顺序</label><div class="xf-tags">${orderChips}</div></div>` : ""}
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
    <div class="xf-poster-art" ${cover ? smartBg(cover) : ""}>
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
  <details class="xf-legacy">
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
