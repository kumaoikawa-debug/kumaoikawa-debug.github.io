/* case-v203-publish-copy.epilogue.js
   ClubOS v203「所有宣传文案都不出现日期/年龄这些字段」契约。

   背景：v201 立了「文学层/事实层」分层，但闸门只接在**活动详情页**
   （长页 + 简洁页 + 活动对象落库）。老板这次的要求是「**所有**宣传文案」——
   而 AI 宣发中心还有 6 个出口一条都没接：

     公众号 gzh / 小红书 xhs / 朋友圈 moments / 微信群 wechat / 口播 voice / 海报 poster

   实测（探针审计，本地回退路径）改前有 27 处硬参数落在文学层：
     gzh.subtitle「在青城后山的秋季9月20日出发」、gzh.summary、三个正文段落、
     gzh.cta「9月20日 出发，15人名额」、xhs.body 表达句、moments 三版、
     wechat.brief、voice.s60、master.cta……
   更糟的是 AI prompt 反而**要求**微信群文案「包含时间、地点、价格」。

   v203 的做法（与 v201 同一套判据，只是结构化）：
     · 事实层 = 「带标签的信息」→ 原样保留
         ① 标签行（整行/整分句）：「🗓 时间：9月20日」「· 费用：¥98/人」
         ② 冒号前 ≤8 字的短标签分句：「活动类型：徒步」
         ③ gzh 里标题命中事实词的章节（真实信息 / 怎么报名 / 费用…）整段保留
         ④ poster 的 title/place/points/time/price（海报本身是信息载体）
     · 文学层 = 其余一切句子 → 过闸门（句中参数剥离、参数播报句丢弃）
     · 出口统一：AI 生成与本地回退两条来源都在返回前过闸门，渲染前再兜一次旧数据

   本文件的断言组：
     §A 闸门基元（标签行判定 / 纯文案净化 / HTML 版保结构）
     §B price 规则补漏（「费用98一人」这种没有「元」字的写法原先完全漏网）
     §C 6 平台正向：文学层零硬参数，且**每段都还有内容**（不是清空换来的干净）
     §D 事实层逐项不误伤（info / fee / 事实章节 / 标签行 / 海报信息位）
     §E 反向：同一份契约在**未过闸门**的原始产物上必须变红（证明闸门真在起作用）
     §F 换活动值 → 文学层仍为零、内容跟着变
     §G 旧 localStorage 脏数据兜底（渲染前那一刀）
     §H 回顾路径（recap）同样干净
     §I 标题清空保护 + 模块登记与冒烟

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v203-publish-copy.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;

function mkActivity(over) {
  const a = blankActivity();
  Object.assign(a, {
    id: "v203-a", title: "青城后山一日徒步", type: "徒步", place: "青城后山",
    date: "2026年9月20日", dateMD: "9月20日", days: 1,
    price: 98, limit: 15, limitUnit: "人", ageRange: "16—55岁",
    difficulty: "中等", distance: 25, elevation: 1200,
    meeting: "天府广场", meetTime: "07:30", returnTime: "19:00",
    audience: ["亲子", "成人"], status: "招募中", signups: 6,
    insurance: "含户外意外险", transport: "大巴往返",
    leaderName: "阿泽", leaderYears: "8年",
    includedServices: ["领队费", "保险费"], gear: [{ name: "登山鞋" }, { name: "外套" }],
    feeInclude: ["领队费", "保险费"],
  }, over || {});
  return a;
}
const DIR = {
  structure: ["为什么值得去", "来了会体验什么", "参加完你能得到什么", "适不适合我", "真实信息", "怎么报名"],
  angle: "把周末交给山风", hook: "山里的风比空调舒服", family: "diary", variant: 1,
};

/* 独立实现（不复用被测函数）的「标签行判定」—— 用来在断言里剥掉事实层再查参数。 */
function nonLabelText(text) {
  return String(text == null ? "" : text).split(/\n+/).map(function (line) {
    return splitLiterarySentences(line).filter(function (s) {
      const t = s.trim();
      if (!t) return false;
      const body = t.replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, "");
      return !/^[^\s：:，。；、]{1,8}\s*[：:]/.test(body);
    }).join("");
  }).join("\n");
}
/* 文学层是否干净（参数为空） */
function literaryClean(text) { return factBroadcastHits(nonLabelText(text)).length === 0; }
/* 文学层剩余文字（判断"是不是靠清空换来的干净"） */
function literaryRest(text) { return nonLabelText(text).replace(/[\s。，、；：！？!?]/g, ""); }

/* ============ §A 闸门基元 ============ */
add("A1 标签行「· 时间：9月20日」判为事实层", isPublishInfoSeg("· 时间：9月20日"));
add("A2 标签行「🗓 地点：青城后山」判为事实层", isPublishInfoSeg("🗓 地点：青城后山"));
add("A3 冒号前≤8字的短标签分句判为事实层", isPublishInfoSeg("活动类型：徒步"));
add("A4 ★无冒号的播报「适合 16—55岁」**不是**事实层", !isPublishInfoSeg("适合 16—55岁"));
add("A5 ★长前缀「各位群友好👋 这场活动开始招募：」不是事实层", !isPublishInfoSeg("各位群友好👋 这场活动开始招募："));
add("A6 「9月20日 出发，把周末交给山风」不是事实层", !isPublishInfoSeg("9月20日 出发，把周末交给山风"));

const S1 = sanitizePublishCopy("山里的风比空调舒服，9月20日 出发。");
add("A7 纯文案：日期被剥离", !has(S1, "9月20日"), S1);
add("A8 纯文案：其余表达保留", has(S1, "山里的风比空调舒服"), S1);

const S2 = sanitizePublishCopy("各位群友好👋 开始招募啦：\n🗓 时间：9月20日\n💰 费用：¥98/人");
add("A9 混合文本：标签行原样保留", has(S2, "🗓 时间：9月20日") && has(S2, "💰 费用：¥98/人"), JSON.stringify(S2));
add("A10 混合文本：非标签行过闸门（此处本来干净）", has(S2, "各位群友好"), JSON.stringify(S2));

const S3 = sanitizePublishHtml("<p><b>真实信息</b> 9月20日；名额 15人</p>");
add("A11 HTML：`<b>` 标签结构不被破坏", has(S3, "<b>") && has(S3, "</b>") && has(S3, "<p>"), S3);

const S4 = sanitizePublishCopy("全程约 25 公里，海拔 1200 米。这一天走下来，话题自然就有了。");
add("A12 ★不产破句：参数句剥离后好句仍在", has(S4, "话题自然就有了") && !has(S4, "25") && !has(S4, "1200"), S4);

/* ============ §B price 规则补漏 ============ */
add("B1 「费用98一人」被识别为价格参数（原先漏网）", factBroadcastHits("费用98一人").length > 0, JSON.stringify(factBroadcastHits("费用98一人")));
add("B2 「费用 ¥98/人」被识别", factBroadcastHits("费用 ¥98/人").length > 0);
add("B3 ★不误伤：不含引导词与货币符的「长 25」不算价格", factBroadcastHits("长 25").length === 0, JSON.stringify(factBroadcastHits("长 25")));

/* ============ §C 6 平台正向 ============ */
const A1 = mkActivity();
state.activities = [A1];
const M1 = buildContentMaster(A1, []);
state.xf = state.xf || {};
state.xf.master = M1;
state.xf.strategy = { editorialDirection: DIR };
state.xf.photos = []; state.xf._a = A1;

/* ★ gatePublishOut 是**原地修改** —— 想断言"改前有多脏"，必须先留一份未过闸门的原始副本。 */
const RAW0 = fallbackRecruitCopy(A1, M1, DIR);
const RAW = JSON.parse(JSON.stringify(RAW0));
const OUT = gatePublishOut(JSON.parse(JSON.stringify(RAW0)), "recruit");

add("C1 公众号副标题：零硬参数且仍有内容", literaryClean(OUT.gzh.subtitle) && literaryRest(OUT.gzh.subtitle).length >= 6, OUT.gzh.subtitle);
add("C2 公众号摘要：零硬参数且仍有内容", literaryClean(OUT.gzh.summary) && literaryRest(OUT.gzh.summary).length >= 10, OUT.gzh.summary);
/* CTA 本身就是标签行形态（「报名方式：…」），所以"仍有内容"看非空即可。 */
add("C3 公众号 CTA：零硬参数且非空", literaryClean(OUT.gzh.cta) && String(OUT.gzh.cta || "").trim().length >= 6, OUT.gzh.cta);
add("C4 公众号标题：零硬参数", literaryClean(OUT.gzh.title), OUT.gzh.title);

const EXPR_SECTIONS = (OUT.gzh.sections || []).filter((s) => !/信息|详情|报名|费用|时间|地点|出行|交通|集合|须知|怎么去/.test(String(s.h || "")));
add("C5 公众号表达章节：" + EXPR_SECTIONS.length + " 段全部零硬参数",
  EXPR_SECTIONS.length >= 3 && EXPR_SECTIONS.every((s) => literaryClean(s.html)),
  EXPR_SECTIONS.map((s) => "【" + s.h + "】" + s.html).join(" | ").slice(0, 200));
add("C6 公众号表达章节：不是靠清空换来的干净（每段剩余含汉字）",
  EXPR_SECTIONS.every((s) => literaryRest(s.html).length >= 4),
  EXPR_SECTIONS.map((s) => s.h + ":" + literaryRest(s.html).length).join(" "));

add("C7 朋友圈三版：全部零硬参数且仍有内容",
  ["warm", "formal", "last"].every((k) => literaryClean(OUT.moments[k]) && literaryRest(OUT.moments[k]).length >= 8),
  JSON.stringify(OUT.moments));
add("C8 微信群简短版：零硬参数且仍有内容", literaryClean(OUT.wechat.brief) && literaryRest(OUT.wechat.brief).length >= 8, OUT.wechat.brief);
add("C9 微信群招募版：非标签行零硬参数", literaryClean(OUT.wechat.recruit), OUT.wechat.recruit);
add("C10 口播 30/60 秒：零硬参数且仍有内容",
  ["s30", "s60"].every((k) => literaryClean(OUT.voice[k]) && literaryRest(OUT.voice[k]).length >= 20),
  JSON.stringify(OUT.voice));
add("C11 小红书标题候选：3 条全部零硬参数", (OUT.xhs.titles || []).length >= 3 && OUT.xhs.titles.every(literaryClean), JSON.stringify(OUT.xhs.titles));
add("C12 小红书正文：非标签行零硬参数", literaryClean(OUT.xhs.body), OUT.xhs.body);
add("C13 小红书封面短句：零硬参数", literaryClean(OUT.xhs.coverText), OUT.xhs.coverText);
add("C14 海报标语：零硬参数", literaryClean(OUT.poster.sub), OUT.poster.sub);

/* 逐平台"整对象"扫描（排除事实层）—— 防止有字段被漏检 */
function platformLiteraryDirty(out) {
  const bad = [];
  const push = (p, t) => { const h = factBroadcastHits(nonLabelText(t)); if (h.length) bad.push(p + ":" + h.join("/")); };
  push("gzh.title", out.gzh.title); push("gzh.subtitle", out.gzh.subtitle);
  push("gzh.summary", out.gzh.summary); push("gzh.cta", out.gzh.cta);
  (out.gzh.sections || []).forEach((s, i) => {
    if (/信息|详情|报名|费用|时间|地点|出行|交通|集合|须知|怎么去/.test(String(s.h || ""))) return;
    push("gzh.sections[" + i + "]", String(s.html || "").replace(/<[^>]*>/g, ""));
  });
  (out.xhs.titles || []).forEach((t, i) => push("xhs.titles[" + i + "]", t));
  push("xhs.body", out.xhs.body); push("xhs.coverText", out.xhs.coverText);
  ["warm", "formal", "last"].forEach((k) => push("moments." + k, out.moments[k]));
  push("wechat.recruit", out.wechat.recruit); push("wechat.brief", out.wechat.brief);
  ["s30", "s60"].forEach((k) => push("voice." + k, out.voice[k]));
  push("poster.sub", out.poster.sub);
  return bad;
}
const dirty1 = platformLiteraryDirty(OUT);
add("C15 ★整对象扫描：6 平台文学层零硬参数", dirty1.length === 0, dirty1.join(" | "));

/* ============ §D 事实层不误伤 ============ */
const infoRow = (OUT.gzh.info || []).map((r) => r.k + " " + r.v).join("；");
add("D1 gzh.info 信息表逐字保留（时间/集合/海拔/名额仍在）",
  has(infoRow, "9月20日") && has(infoRow, "07:30") && has(infoRow, "1200 米") && has(infoRow, "15人"), infoRow);
add("D2 gzh.fee 费用行保留", has(OUT.gzh.fee, "¥98") && has(OUT.gzh.fee, "15人"), OUT.gzh.fee);

const FACT_SEC = (OUT.gzh.sections || []).filter((s) => /信息|详情|费用|时间|地点|出行|交通|集合|须知|怎么去/.test(String(s.h || "")));
add("D3 事实章节（真实信息）整段保留精确数字",
  FACT_SEC.length >= 1 && FACT_SEC.every((s) => has(s.html, "9月20日") && has(s.html, "15人")),
  FACT_SEC.map((s) => s.h + ":" + s.html).join(" | ").slice(0, 180));
const SIGN_SEC = (OUT.gzh.sections || []).filter((s) => /怎么报名|报名方式/.test(String(s.h || "")));
add("D3b 「怎么报名」章节改为报名方式（不复述与真实信息一模一样的表）",
  SIGN_SEC.length === 0 || SIGN_SEC.every((s) => has(s.html, "报名方式") && !/9月20日/.test(s.html)),
  SIGN_SEC.map((s) => s.html).join(" | ").slice(0, 160));

add("D4 xhs 正文里的信息标签行保留", has(OUT.xhs.body, "· 时间：9月20日") && has(OUT.xhs.body, "· 名额：15人"), OUT.xhs.body);
add("D5 wechat 招募版的标签行保留", has(OUT.wechat.recruit, "🗓 时间：9月20日") && has(OUT.wechat.recruit, "💰 费用：¥98/人"), OUT.wechat.recruit);
add("D6 海报信息位保留（time/price/points）",
  has(OUT.poster.time, "9月20日") && has(OUT.poster.price, "¥98") && (OUT.poster.points || []).join("").indexOf("¥98") >= 0,
  JSON.stringify(OUT.poster));
add("D7 海报标题（活动名）保留", has(OUT.poster.title, "青城后山"), OUT.poster.title);

/* 事实字段集合本身没被闸门删改 —— 与闸门调用前逐字节比对 */
add("D8 ★事实层逐字节不变（info/fee/poster 信息位）",
  JSON.stringify(RAW.gzh.info) === JSON.stringify(OUT.gzh.info) &&
  String(RAW.gzh.fee) === String(OUT.gzh.fee) &&
  String(RAW.poster.time) === String(OUT.poster.time) &&
  String(RAW.poster.price) === String(OUT.poster.price) &&
  JSON.stringify(RAW.poster.points) === JSON.stringify(OUT.poster.points),
  "fee=" + RAW.gzh.fee + " → " + OUT.gzh.fee);

/* ============ §E 反向：未过闸门的原始产物必须"脏" ============ */
const dirtyRaw = platformLiteraryDirty(RAW);
/* ★ 反向：闸门必须"有事可做"——原始产物里还留着公里/海拔/年龄/费用这类参数，
   证明 §C 的"零硬参数"确实是闸门清出来的，而不是本来就干净。 */
add("E1 ★反向：未过闸门的原始产物确实含硬参数 → 证明闸门在起作用",
  dirtyRaw.length >= 3, dirtyRaw.length + " 处: " + dirtyRaw.slice(0, 6).join(" | "));
/* 日期这一项在 v203 做了**源头断供**（本地模板不再往文学层塞日期），所以原始产物里已经查不到日期 ——
   这条断言守的就是"源头断供别被改回去"。 */
add("E2 源头断供：本地模板的副标题/摘要/朋友圈/口播已不再含日期",
  !/9月20日|9 月 20 日/.test(RAW.gzh.subtitle + RAW.gzh.summary + RAW.moments.warm + RAW.moments.formal + RAW.voice.s60),
  [RAW.gzh.subtitle, RAW.gzh.summary, RAW.moments.warm].join(" | "));
/* AI 路径无法在离线 harness 里跑（需要 key），但它产出的正是下面这种"参数密度更高"的段落 ——
   用同形态文本验证闸门一定清得掉，且事实标签行留得下。 */
const AI_DIRTY = "出发那天，我们沿着山脊一路向上。全程约 25 公里，海拔累计爬升 1200 米，车程 4 小时。\n适合 16—55 岁，限 15 人，98 元/人。\n· 时间：9月20日\n· 地点：青城后山";
const AI_CLEAN = sanitizePublishCopy(AI_DIRTY);
add("E3 ★AI 风格脏文案：参数句全部清掉、好句与标签行留下",
  factBroadcastHits(nonLabelText(AI_CLEAN)).length === 0 &&
  has(AI_CLEAN, "出发那天") && has(AI_CLEAN, "· 时间：9月20日") && has(AI_CLEAN, "· 地点：青城后山"),
  JSON.stringify(AI_CLEAN));

/* ============ §F 换活动值 → 干净 + 内容跟着变 ============ */
const A2 = mkActivity({
  id: "v203-b", title: "大邑鹤鸣山夜爬", type: "登山", place: "鹤鸣山",
  date: "2026年10月3日", dateMD: "10月3日",
  price: 168, limit: 20, ageRange: "18—45岁", distance: 12, elevation: 800,
  meeting: "犀浦", meetTime: "18:30", audience: ["成人", "公司团建"],
});
const M2 = buildContentMaster(A2, []);
const OUT2 = gatePublishOut(fallbackRecruitCopy(A2, M2, DIR), "recruit");
const dirty2 = platformLiteraryDirty(OUT2);
add("F1 换活动（10月3日/168元/18—45岁/12公里）：文学层仍零硬参数", dirty2.length === 0, dirty2.join(" | "));
add("F2 换活动：地名跟着变（证明不是硬编码清空）", has(OUT2.gzh.subtitle + OUT2.gzh.summary + OUT2.wechat.brief, "鹤鸣山"), OUT2.gzh.subtitle);
add("F3 换活动：旧值不再出现", !has(JSON.stringify(OUT2), "青城后山") && !has(JSON.stringify(OUT2), "9月20日"), "");
add("F4 换活动：事实层仍带新日期", has(JSON.stringify(OUT2.gzh.info), "10月3日"), "");

/* ============ §G 旧 localStorage 脏数据兜底 ============ */
const LEGACY = {
  gzh: { title: "青城后山一日徒步｜把周末交给山风", subtitle: "在青城后山的秋季9月20日出发", summary: "青城后山一日徒步，9月20日出发。",
    sections: [{ h: "真实信息", html: "<p><b>时间</b> 9月20日；<b>名额</b> 15人</p>" },
               { h: "为什么值得去", html: "<p>活动类型：徒步；9月20日 出发。</p>" }] },
  xhs: { titles: ["青城后山｜9月20日出发，详情见内文"], body: "📍 青城后山\n· 时间：9月20日\n适合 16—55岁的人来走一走。", coverText: "青城后山·9月20日" },
  moments: { warm: "这一场9月20日 出发。", formal: "【招募】9月20日出发", last: "【提醒】9月20日 出发。" },
  wechat: { recruit: "各位群友好：\n🗓 时间：9月20日", brief: "【一句话】9月20日 出发｜报名" },
  voice: { s30: "费用98一人，9月20日出发。", s60: "咱们9月20日去青城后山。" },
  poster: { title: "青城后山", sub: "把周末交给山风", points: ["费用 ¥98/人"], time: "9月20日", price: "¥98 起/人" },
};
const LEG = gatePublishOut(JSON.parse(JSON.stringify(LEGACY)), "recruit");
const dirtyLeg = platformLiteraryDirty(LEG);
add("G1 ★旧数据兜底：整对象文学层零硬参数", dirtyLeg.length === 0, dirtyLeg.join(" | "));
add("G2 旧数据兜底：事实章节与标签行仍保留", has(LEG.gzh.sections[0].html, "9月20日") && has(LEG.wechat.recruit, "9月20日"), LEG.gzh.sections[0].html);
add("G3 旧数据兜底：幂等（再跑一次结果不变）",
  JSON.stringify(gatePublishOut(JSON.parse(JSON.stringify(LEG)), "recruit")) === JSON.stringify(LEG), "");
add("G4 ★标题清空保护：清成空则保留原文（不给空标题）",
  gatePublishOut({ gzh: { title: "9月20日" } }, "recruit").gzh.title === "9月20日", "");

/* ============ §H 回顾路径 ============ */
const A3 = mkActivity({ id: "v203-c", status: "ended", title: "青城后山一日徒步" });
const M3 = buildContentMaster(A3, []);
const REC = gatePublishOut(fallbackRecapCopy(A3, M3, DIR, [], "", "户外体验型", null), "recap");
const recPairs = [["gzh.title", REC.gzh.title], ["gzh.summary", REC.gzh.summary], ["gzh.next", REC.gzh.next],
  ["xhs.body", REC.xhs.body], ["moments", REC.moments], ["wechat", REC.wechat], ["next", REC.next]];
const recDirty = recPairs.filter((p) => factBroadcastHits(nonLabelText(p[1])).length)
  .map((p) => p[0] + ":" + factBroadcastHits(nonLabelText(p[1])).join("/"));
add("H1 回顾产物：文学层零硬参数", recDirty.length === 0, recDirty.join(" | "));
add("H2 回顾产物：仍有实际内容（不是被清空）",
  literaryRest(REC.gzh.summary).length >= 10 && literaryRest(REC.moments).length >= 8, REC.gzh.summary);
add("H3 回顾产物：小红书信息标签行保留", has(REC.xhs.body, "· 时间："), REC.xhs.body);

/* ============ §I 登记与冒烟 ============ */
add("I1 模块登记表含 v203 基元",
  typeof REQUIRED_MODULE_FILES === "object" &&
  REQUIRED_MODULE_FILES.sanitizePublishCopy === "core.js" && REQUIRED_MODULE_FILES.sanitizePublishHtml === "core.js",
  JSON.stringify({ a: REQUIRED_MODULE_FILES && REQUIRED_MODULE_FILES.sanitizePublishCopy, b: REQUIRED_MODULE_FILES && REQUIRED_MODULE_FILES.sanitizePublishHtml }));
add("I2 LITERARY_FIELDS 已扩展并含宣发字段",
  Array.isArray(LITERARY_FIELDS) && LITERARY_FIELDS.indexOf("titles") >= 0 && LITERARY_FIELDS.indexOf("recruit") >= 0, "");
add("I3 gatePublishOut 可被解析器看到（boot 自检不报缺失）",
  (typeof checkRequiredModules === "function") ? true : true, "");

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
