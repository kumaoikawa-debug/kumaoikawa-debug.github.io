/* case-v201-copy-literary.epilogue.js
   ClubOS v201「文案不该是参数播报」回归契约。

   老板反馈原话：「为什么文案里面老是出现 时间 日期，我们要的文案是有语言美感的，
   不是这种没有艺术的数字。」（附两张截图：① 标题/副标题/正文里的「9月20日 · 25 公里」；
   ② 正文末尾整行「9月20日单日往返｜98元/人｜限15人｜4小时车程｜海拔800米」）

   根因两条（本文件的断言组即对应）：
     A. 本地角度模板 EDITORIAL_ANGLE_VOICE 把 {D}(日期)/{startTime}(时刻)/{distWord}(公里)/
        {eleWord}(海拔)/{limit}(人数) 直接填进 标题/导语/正文/金句。
     B. AI prompt 曾要求正文「最后给决策信息」，AI 就在正文末尾播报一整行参数。

   核心设计：**分层**，不是「删掉数字」——
     · 事实层（数据条 / 决策速览 / DAY 时间轴 / 费用说明 / 报名结算）保留精确数字，一字不动；
     · 文学层（标题 / 副标题 / 导语 / 正文段落 / 金句 / 宣发文案）只谈画面与感受，参数一律剥离。
   闸门两条硬约束：
     ① 参数播报行（≥3 个硬参数，或 ≥2 竖线分隔的参数串）→ 整句丢弃；
     ② 参数**嵌在短语中间**时不硬删（否则会造出「把留给朋友」「走完这」这类破句）→ 整个分句丢弃。
        宁可少一句，也不留破句。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v201-copy-literary.epilogue.js */
state = (typeof loadState === "function") ? loadState() : state;

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;
const hitsOf = (t) => (typeof factBroadcastHits === "function") ? factBroadcastHits(t) : [];
const BAD_BROKEN = /[把将给从在对向为由被让的地得着][，。；、！？｜|]/;   // 破句特征：虚词紧邻标点

function mkActivity(over) {
  const base = {
    id: "v201-" + Math.random().toString(36).slice(2, 7),
    type: "徒步", title: "青城后山山脊徒步", place: "青城后山",
    date: "2026-09-20", dateMD: "9月20日", meeting: "天府广场",
    price: 199, limitUnit: "人", limit: 15, days: 1,
    distance: 25, elevation: 800, difficulty: "中等", season: "秋",
    photos: ["https://example.com/v201-p0.jpg", "https://example.com/v201-p1.jpg", "https://example.com/v201-p2.jpg"],
    photoCaptions: [], tags: [], highlights: [], sellingPoints: [], body: [], reviews: [],
    body: [], feeInclude: ["往返大巴", "专业领队", "户外保险"], feeExclude: ["午餐"],
    includeLeader: true, includeInsurance: true, ageRange: "8-60岁",
    confirmed: [{ key: "services" }, { key: "difficulty" }],
    itineraryDays: [
      { label: "一日山脊线", sub: "", items: [
        { time: "07:30", text: "天府广场集合" },
        { time: "12:00", text: "适中简餐" },
        { time: "17:30", text: "抵达天府广场，活动结束" }
      ] }
    ],
    departures: [], gear: [], coverIndex: 0, edTheme: "", pageStyle: "outdoor", audience: []
  };
  return Object.assign(base, over || {});
}
const heroOf = (html) => {
  const s = String(html);
  const i = s.indexOf('<header class="xh-ed-hero');
  if (i < 0) return "";
  const j = s.indexOf("</header>", i);
  return s.slice(i, j < 0 ? i + 4000 : j + 9);
};
const titleOf = (hero) => { const m = String(hero).match(/<h1 class="xh-ed-title">([\s\S]*?)<\/h1>/); return m ? m[1] : ""; };
const subOf = (hero) => { const m = String(hero).match(/<p class="xh-ed-sub">([\s\S]*?)<\/p>/); return m ? m[1] : ""; };
/* 文学层区域：从导语到「决策速览」之前（数据条在导语之前，属事实层） */
function storyZone(html) {
  const s = String(html);
  const a = s.indexOf("xh-ed-lead");
  const b = s.indexOf('class="decision', a < 0 ? 0 : a);
  if (a < 0) return "";
  return s.slice(a, b < 0 ? a + 6000 : b);
}
const stripTags = (h) => String(h).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

/* ================= §A 闸门本体（core.js） ================= */
try {
  const kinds = [
    ["日期", "9月20日出发"], ["日期斜杠", "9/20 见"], ["时刻", "07:30 集合"],
    ["价格", "人均 98 元"], ["名额", "限15人"], ["里程", "全程约 25 公里"],
    ["海拔", "海拔 800 米"], ["年龄", "适合 8-60 岁"], ["天数", "2 天行程"], ["车程", "4小时车程"]
  ];
  const miss = kinds.filter(([k, t]) => hitsOf(t).length === 0).map(([k]) => k);
  add("A1 闸门能识别 日期/时刻/价格/名额/里程/海拔/年龄/天数/车程 九类硬参数", miss.length === 0, "未识别: " + miss.join("/"));

  // A2 参数播报行：整句丢弃（不只是删数字）
  const bc = "9月20日单日往返｜98元/人｜限15人｜4小时车程｜海拔800米";
  add("A2a 纯参数播报行 → 整句丢弃（输出为空）", sanitizeLiteraryText(bc) === "", "got=" + sanitizeLiteraryText(bc));
  const mixed = "这一天，把注意力从屏幕移回脚下。" + bc + "走路的时候，话题自然就有了。";
  const mixedOut = sanitizeLiteraryText(mixed);
  add("A2b 混排时只丢参数那一句，前后正常句都保留",
    has(mixedOut, "把注意力从屏幕移回脚下") && has(mixedOut, "话题自然就有了") && !has(mixedOut, "98元/人｜限15人"),
    "got=" + mixedOut);
  add("A2c 竖线参数串（≥2 个竖线且含参数）一律丢弃", sanitizeLiteraryText("早上出发｜限15人｜98元") === "", "");

  // A3 ★ 不产出破句：参数嵌在短语中间 → 整个分句丢弃（而不是硬删）
  const danger = [
    ["把9月20日留给朋友。", /把留给/],
    ["带着9月20日的心情回到城里。", /带着的心情/],
    ["走完这12公里，你会更清楚自己能走多远。", /走完这，|走完这$/]
  ];
  const broken = [];
  danger.forEach(([t, bad]) => {
    const o = sanitizeLiteraryText(t);
    if (bad.test(o)) broken.push(t + " → " + o);
  });
  add("A3a 参数嵌在短语中间时不硬删（不产出「把留给朋友」这类破句）", broken.length === 0, broken.join(" | "));
  danger.forEach(([t], i) => {
    const o = sanitizeLiteraryText(t);
    add("A3b-" + (i + 1) + " 整句丢弃或已无参数（" + t.slice(0, 8) + "…）",
      o === "" || hitsOf(o).length === 0, "got=" + o);
  });
  const allOut = danger.map(([t]) => sanitizeLiteraryText(t)).join(" ");
  add("A3c 任何输出都不含「虚词紧邻标点」的破句特征", !BAD_BROKEN.test(allOut), allOut);

  // A4 干净句一字不动（不误伤）
  const clean = ["这一天，把注意力从屏幕移回脚下。", "把朋友约到青城后山，一起走过一段不用会议室的周末。", "风景不在终点，在每一段转弯之后。"];
  const changed = clean.filter((t) => sanitizeLiteraryText(t) !== t);
  add("A4 不含参数的句子一字不动（含「脚下」这类易误伤句）", changed.length === 0, changed.join(" | "));

  // A5 换行 = 段落边界，不能被合并
  const multi = "9月20日，把朋友约到青城后山。\n全程约 25 公里，一路都在换视野。\n带着这一天的松弛回城。";
  const multiOut = sanitizeLiteraryText(multi);
  add("A5 多段导语的换行结构保留（段落数不变）",
    multiOut.split("\n").length === 3 && has(multiOut, "一路都在换视野") && has(multiOut, "松弛回城"),
    JSON.stringify(multiOut));

  // A6 剥离后收拾标点：不留空括号、双标点、引导词残尾
  const tidy = sanitizeLiteraryText("全程约 25 公里（海拔 800 米），一路都在换视野。");
  add("A6 剥离后不留空括号 / 双标点 / 悬空引导词", !has(tidy, "（）") && !/，，|，。/.test(tidy) && !/(?:约|共|达|左右)$/.test(tidy.replace(/。$/, "")), "got=" + tidy);

  // A7 轻量版：只丢参数串，不替作者改句子
  add("A7a 轻量版保留老板写的单日期表达", stripBroadcastLines("9月20日，把朋友约到青城后山") === "9月20日，把朋友约到青城后山", "");
  add("A7b 轻量版丢弃参数串", stripBroadcastLines("9月20日单日往返｜98元/人｜限15人") === "", "got=" + stripBroadcastLines("9月20日单日往返｜98元/人｜限15人"));
} catch (e) {
  add("§A 闸门本体断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §B 本地角度模板（真实填充后无参数） ================= */
try {
  const A = mkActivity();
  const dna = (typeof buildActivityDNA === "function") ? buildActivityDNA(A, A.photos) : {};
  const f = (typeof editorialFacts === "function") ? editorialFacts(A, dna) : {};
  const V = (typeof EDITORIAL_ANGLE_VOICE === "object") ? EDITORIAL_ANGLE_VOICE : {};
  const angles = Object.keys(V);
  const bad = [];
  angles.forEach((ang) => {
    const v = V[ang];
    let all = [].concat(v.titles || [], v.leads || [], v.quotes || []);
    Object.keys(v.paras || {}).forEach((k) => { all = all.concat(v.paras[k] || []); });
    (typeof fillFrames === "function" ? fillFrames(all, f) : []).forEach((t) => {
      const h = hitsOf(t);
      if (h.length) bad.push(ang + "「" + t + "」← " + h.join("/"));
    });
  });
  add("B1 七个角度的 标题/导语/金句/段落 填充后均不含硬参数（含日期/公里/人数/时刻）",
    angles.length >= 7 && bad.length === 0, "angles=" + angles.length + " bad=" + bad.slice(0, 4).join(" | "));
  add("B2 标题/导语模板里不再出现 {D}/{startTime}/{distWord}/{eleWord}/{limit} 占位符",
    ["{D}", "{startTime}", "{endTime}", "{distWord}", "{eleWord}", "{limit}", "{price}"].every((ph) => JSON.stringify(V).indexOf(ph) < 0),
    "");
  const blank = (typeof fillFrames === "function")
    ? fillFrames(["{D}", "{startTime}", "{distWord}", "{eleWord}", "{limit}", "{price}", "{days}"], f) : ["x"];
  add("B3 事实型占位符在文学层被填成空串（将来谁写了 {D} 也漏不出数字）",
    blank.length === 0, "got=" + JSON.stringify(blank));
  const pack = (typeof angleEditorialPack === "function") ? angleEditorialPack(A, (typeof editorialVariantOf === "function") ? editorialVariantOf(A) : {}, dna) : null;
  add("B4 a 副标题不含日期与里程（旧实现是「社交 · 9月20日 · 25 公里 · 适中强度」）",
    !!pack && hitsOf(pack.subtitle || "").length === 0, pack ? "subtitle=" + pack.subtitle : "no pack");
  add("B4b 角度包标题不含参数", !!pack && hitsOf(pack.title || "").length === 0, pack ? pack.title : "");
  add("B4c 角度包金句不含参数", !!pack && hitsOf(pack.pullQuote || "").length === 0, pack ? pack.pullQuote : "");
} catch (e) {
  add("§B 模板层断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §C AI 落库闸门 + prompt 约束 ================= */
try {
  const src = mkActivity({
    title: "9月20日，青城后山一日",
    intro: "9月20日单日往返｜98元/人｜限15人｜4小时车程。这一天，把注意力从屏幕移回脚下。",
    body: ["9月20日单日往返｜98元/人｜限15人｜4小时车程", "走路的时候，话题自然就有了。"],
    hook: "9月20日集合出发｜限15人｜98元/人",
    pullQuote: "9月20日，把日子过成户外。",
    posterTagline: "9月20日，把这一季走进脚步里"
  });
  const D = mkActivity(Object.assign({}, src, { id: "v201-c1" }));
  sanitizeLiteraryFields(D);
  add("C1a 落库闸门清掉标题里的日期", hitsOf(D.title).length === 0 && has(D.title, "青城后山"), "title=" + D.title);
  add("C1b 落库闸门丢弃正文里的参数播报行、保留正常段",
    D.body.length === 1 && has(D.body[0], "话题自然就有了") && hitsOf(D.body.join(" ")).length === 0,
    JSON.stringify(D.body));
  add("C1c 落库闸门丢弃导语里的参数播报句、保留感受句",
    hitsOf(D.intro).length === 0 && has(D.intro, "移回脚下"), "intro=" + D.intro);
  add("C1d 落库闸门清掉金句 / 海报标语里的日期",
    hitsOf(D.pullQuote).length === 0 && hitsOf(D.posterTagline).length === 0,
    D.pullQuote + " / " + D.posterTagline);
  add("C1e 落库闸门清掉 hook 里的参数串", hitsOf(D.hook).length === 0, "hook=" + D.hook);

  // 事实层必须逐字节不变（客户据此决策/下单/核对）
  const E = mkActivity();
  E.pipeline = { details: { refund: ["出发前 7 天以上取消，全额退款。", "出发前 3 天内取消，费用不退。"] } };
  const snap = JSON.stringify({
    it: E.itineraryDays, price: E.price, limit: E.limit, dist: E.distance, ele: E.elevation,
    inc: E.feeInclude, exc: E.feeExclude, age: E.ageRange, dep: E.departures,
    refund: E.pipeline.details.refund
  });
  sanitizeLiteraryFields(E);
  const snap2 = JSON.stringify({
    it: E.itineraryDays, price: E.price, limit: E.limit, dist: E.distance, ele: E.elevation,
    inc: E.feeInclude, exc: E.feeExclude, age: E.ageRange, dep: E.departures,
    refund: E.pipeline.details.refund
  });
  add("C2 事实层（行程时间轴 / 价格 / 名额 / 里程 / 海拔 / 费用含不含 / 年龄 / 退改条款）逐字节不变",
    snap === snap2, "");
  add("C2b 行程时刻 07:30 / 12:00 / 17:30 仍在（DAY 时间轴是事实层）",
    ["07:30", "12:00", "17:30"].every((t) => JSON.stringify(E.itineraryDays).indexOf(t) >= 0), "");

  // prompt 约束
  const P = (typeof AI_SYSTEM_PROMPT === "string") ? AI_SYSTEM_PROMPT : "";
  add("C3a 系统提示词新增「正文类字段禁止具体数字参数」硬约束", has(P, "禁止出现任何具体数字参数"), "");
  add("C3b 系统提示词不再要求正文「最后给决策信息」（那是参数播报的直接诱因）",
    !has(P, "最后给决策信息"), "");
  add("C3c 提示词要求用文学说法指代时间（这个周末 / 出发那天 / 一整天 / 早发晚归）",
    ["这个周末", "出发那天", "一整天", "早发晚归"].every((k) => has(P, k)), "");
  add("C3d 提示词把「｜分隔的参数串」列为不合格判定", has(P, "参数串"), "");
  add("C3e 提示词明确数字只允许出现在专门的事实字段",
    has(P, "itineraryDays") && has(P, "includedServices"), "");
} catch (e) {
  add("§C AI 落库与 prompt 断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §D 渲染层兜底（历史脏数据 / 老板手写） ================= */
try {
  /* D0-D2：脏风格包（老板截图①的场景：点过「换一种排版」，包里存着旧模板的输出） */
  const P1 = mkActivity({ id: "v201-d1" });
  const variant = (typeof editorialVariantOf === "function") ? editorialVariantOf(P1) : {};
  const dirty = {
    angle: variant.angle,
    title: "9月20日，把朋友约到青城后山",
    subtitle: "社交 · 9月20日 · 25 公里",
    lead: "9月20日，不做室内局，约在青城后山。\n一起出发、一起走完、一起吃个饭。",
    paras: {
      why: ["9月20日单日往返｜98元/人｜限15人｜4小时车程"],
      gain: ["带走的是不是公里数的记录，是一整天连续的视野。"]
    },
    pullQuote: "9月20日，并排走过一段路。",
    factsFingerprint: editorialFactsFingerprint(P1),
    dnaFactFingerprint: dnaFactFingerprint(P1)
  };
  P1.editorialStylePack = dirty;
  const seen = (typeof editorialStylePackOf === "function") ? editorialStylePackOf(P1) : null;
  add("D0（反向验证前提）脏包确实带着参数进入渲染 —— 未过闸门的原文含「9月20日」与参数串",
    !!seen && has(seen.title, "9月20日") && has((seen.paras.why || [])[0], "98元/人｜限15人"),
    seen ? seen.title : "pack 未被识别");

  state.detailMode = "editorial";
  const ed = renderActivityEditorial(P1);
  const hero = heroOf(ed);
  const story = storyZone(ed);
  add("D1a 图文页 hero 大标题不含日期（截图①的主诉）", !has(titleOf(hero), "9月20日"), "title=" + titleOf(hero));
  add("D1b 图文页副标题不含日期与里程", !has(subOf(hero), "9月20日") && !has(subOf(hero), "25 公里"), "sub=" + subOf(hero));
  add("D1c 图文页导语不含日期且保留正常句",
    !has(stripTags(story).split("不做室内局")[0], "9月20日") && has(stripTags(story), "不做室内局"), "");
  add("D1d 图文页文学层区域（导语+章节+金句）不含参数播报行",
    !has(stripTags(story), "98元/人") && !has(stripTags(story), "4小时车程"), stripTags(story).slice(0, 90));
  add("D1e 图文页金句不含日期", !has(stripTags(story).split("并排走过一段路")[0].slice(-12), "9月20日"), "");

  /* D2 事实层保留（防「一刀切删数字」） */
  const edText = stripTags(ed);
  /* 取 pill 元素本身再断言 —— 早先用 `/xh-ed-pill[\s\S]{0,220}2026-09-20/`，
     但 pill 内容以 calendar 图标 SVG 开头（长度 > 220），日期被窗口截掉而假红。
     这是测试写法缺陷，不是产品问题。 */
  const pillHtml = (() => {
    const i = hero.indexOf('class="xh-ed-pill"');
    if (i < 0) return "";
    const j = hero.indexOf("</div>", i);
    return hero.slice(i, j < 0 ? i + 1500 : j);
  })();
  /* 断言语义 = 「事实层仍带着日期」，不写死格式：pill 里渲染的是 dateMD
     （「9月20日」，渲染层会把 date 归一成 dateMD），写成 ISO 会假红。 */
  add("D2a 事实层时间胶囊保留日期（hero 内的 .xh-ed-pill 是事实层）",
    hitsOf(stripTags(pillHtml)).length > 0 && /9月20日|2026-09-20/.test(stripTags(pillHtml)),
    "pill=" + stripTags(pillHtml).slice(0, 60));
  add("D2b 决策速览保留日期与名额", has(edText, "9月20日") && has(edText, "15人"), "");
  add("D2c DAY 时间轴保留真实时刻与价格", has(edText, "07:30") && has(edText, "17:30") && has(edText, "199"), "");
  add("D2d 数据条保留里程与海拔（事实层数字不进文学层）",
    has(edText, "25") && has(edText, "800"), "");

  /* D3 老板手写（无可用的非自动包）→ 标题类策略：清完仍成句就清，清成空保留原文 */
  const H = mkActivity({ id: "v201-d3", title: "9月20日，青城后山徒步", editorialStylePack: null });
  const hHero = heroOf(renderActivityEditorial(H));
  add("D3a 老板手写标题里的独立日期分句被清掉，正文部分保留",
    !has(titleOf(hHero), "9月20日") && has(titleOf(hHero), "青城后山徒步"), "title=" + titleOf(hHero));
  const H2 = mkActivity({ id: "v201-d4", title: "9月20日 徒步", editorialStylePack: null });
  const h2Hero = heroOf(renderActivityEditorial(H2));
  add("D3b 标题被清成空时保留原文（绝不出现空白标题）",
    /<h1 class="xh-ed-title">[^<]{2,}<\/h1>/.test(h2Hero), "title=" + titleOf(h2Hero));

  /* D4 简洁页（lean）：intro / body / hook */
  const L = mkActivity({
    id: "v201-d5",
    intro: "9月20日单日往返｜98元/人｜限15人｜4小时车程。这一天，把注意力从屏幕移回脚下。",
    body: ["9月20日单日往返｜98元/人｜限15人", "走路的时候，话题自然就有了。"],
    hook: "9月20日集合出发｜限15人｜98元/人",
    highlights: [["小队伍成行，节奏自己掌握", "star"]]
  });
  state.detailMode = "lean";
  const lean = renderActivityPhone(L);
  const leanText = stripTags(lean);
  add("D4a 简洁页导语丢掉参数播报句、保留感受句",
    has(leanText, "移回脚下") && !has(leanText, "98元/人｜限15人"), "");
  add("D4b 简洁页正文段落不含参数播报行、保留正常段",
    !has(leanText, "单日往返｜98元") && has(leanText, "话题自然就有了"), "");
  add("D4c 简洁页开场钩子不含参数串", !has(leanText, "集合出发｜限15人"), "");
  add("D4d 简洁页决策速览仍保留时间/名额/价格（事实层）",
    has(leanText, "9月20日") && has(leanText, "15人") && has(leanText, "199"), "");
  state.detailMode = "editorial";
} catch (e) {
  add("§D 渲染层兜底断言未抛错", false, String((e && e.stack) || e));
}

/* ================= §E 其它主视图不因闸门报错 ================= */
try {
  const errs = [];
  const T = (name, fn) => { try { const h = fn(); if (typeof h !== "string") errs.push(name + ": 非字符串"); } catch (e) { errs.push(name + " → " + String((e && e.message) || e)); } };
  const A0 = mkActivity({ id: "v201-e0" });
  state.draft = JSON.parse(JSON.stringify(A0));
  T("editor", () => (typeof renderEditor === "function") ? renderEditor() : "");
  T("dashboard", () => (typeof renderDashboard === "function") ? renderDashboard() : "");
  T("list", () => (typeof renderList === "function") ? renderList() : "");
  T("fabu", () => (typeof renderFabu === "function") ? renderFabu() : "");
  T("itineraryEdit", () => (typeof itineraryEditHtml === "function") ? itineraryEditHtml(A0) : "");
  add("E1 后台编辑器 / 列表 / 宣发中心 渲染不报错", errs.length === 0, errs.join(" | "));
  const miss = (typeof checkRequiredModules === "function") ? checkRequiredModules() : [];
  add("E2 新增对外函数均已登记（checkRequiredModules 为空）", miss.length === 0, JSON.stringify(miss));
} catch (e) {
  add("§E 视图冒烟未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  checks
};
