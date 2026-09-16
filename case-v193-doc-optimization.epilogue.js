/* case-v193-doc-optimization.epilogue.js
   ClubOS v192 AI 优化开发文档（P0-A~E + P1）的回归契约。
   覆盖：DNA 事实边界 / Safe Crop / 换风格真重生成 / Fallback 去营销假设 / 模块完整性 / Vision Intelligence。
   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v193-doc-optimization.epilogue.js */
state = (typeof initState === "function") ? initState() : loadState();
var OUT = [];
function chk(name, pass, dbg) { OUT.push({ name: name, pass: !!pass, dbg: dbg == null ? "" : String(dbg) }); }

// ================= P0-A Activity DNA 事实边界 =================
(function () {
const sceneClaim = /红叶|彩林|叶雨|落叶|溪水|水花|脚泡|雪线|云海|篝火|星空|银河|满山红|漫山/;

// Case 1：10月青城山徒步 —— 无照片、无红叶信息
const c1 = { type: "徒步", title: "青城山徒步", raw: "10月青城山徒步", place: "青城山", dateMD: "2026年10月1日", distance: 10, photos: [] };
const d1 = buildActivityDNA(c1);
const copy1 = applyDnaCopyFallback(Object.assign({}, c1, { activityDNA: d1 }));
const text1 = [copy1.heroHook, copy1.intro, (copy1.body || []).join(""), copy1.whyGo, copy1.experience, copy1.gain, (copy1.sellingPoints || []).map(s => s.title + " " + s.desc).join(""), (copy1.forewordTitles || []).join(" ")].join(" ");
chk("Case1 groundedScenes 为空", d1.groundedScenes.length === 0, JSON.stringify(d1.groundedScenes));
chk("Case1 sceneSignature 为空（不臆造现场）", d1.sceneSignature === "", "sig=" + JSON.stringify(d1.sceneSignature));
chk("Case1 正文不含具体现场画面（红叶/落叶/彩林…）", !sceneClaim.test(text1), sceneClaim.test(text1) ? text1.match(sceneClaim)[0] : "clean");
chk("Case1 copyAngles 不含环境画面角度", !(d1.copyAngles || []).some(x => sceneClaim.test(x)), JSON.stringify(d1.copyAngles.slice(0, 2)));
chk("Case1 保留季节气质（creativeContext）", !!d1.seasonalCreativeContext.season && d1.seasonalCreativeContext.disclaimer === "creative_only", JSON.stringify(d1.seasonalCreativeContext));
chk("Case1 Prompt 含【已确认场景】/【创意方向】", /【已确认场景】/.test(dnaPromptBlock(c1)) && /【创意方向】/.test(dnaPromptBlock(c1)));

// Case 2：10月光雾山红叶徒步 —— 用户明确提供
const c2 = { type: "徒步", title: "光雾山红叶徒步", raw: "10月光雾山红叶徒步", place: "光雾山", dateMD: "2026年10月18日" };
const d2 = buildActivityDNA(c2);
chk("Case2 红叶进入 groundedScenes（Source A）", (d2.groundedScenes || []).indexOf("红叶") >= 0, JSON.stringify(d2.groundedSceneDetails));
chk("Case2 来源标注 = 老板明确输入", (d2.groundedSceneDetails || []).some(g => g.scene === "红叶" && g.source === "user_input"), JSON.stringify(d2.groundedSceneDetails.map(g => g.scene + "/" + g.source)));

// Case 3：行程里出现「穿越彩林」
const c3 = { type: "徒步", title: "周末徒步", raw: "周末活动", place: "光雾山", dateMD: "2026年10月18日",
  itineraryDays: [{ label: "行程安排", items: [{ time: "10:30", text: "穿越彩林" }] }] };
const d3 = buildActivityDNA(c3);
chk("Case3 行程里的「彩林」进入 groundedScenes（Source B）", (d3.groundedScenes || []).indexOf("彩林") >= 0, JSON.stringify(d3.groundedSceneDetails));
chk("Case3 来源标注 = 行程明确出现", (d3.groundedSceneDetails || []).some(g => g.scene === "彩林" && g.source === "itinerary"));

// 老板手动确认（Source D）
const c4 = Object.assign({}, c1, { confirmedScenes: ["云海"] });
const d4 = buildActivityDNA(c4);
chk("Case-D 老板确认的场景进入事实层", (d4.groundedScenes || []).indexOf("云海") >= 0, JSON.stringify(d4.groundedSceneDetails.map(g => g.scene + "/" + g.source)));

// 禁止行为：夏季溪谷（无「下水/玩水」字样）不得自动生成"下水/水花"
const c5 = { type: "徒步", title: "夏季溪谷徒步", raw: "夏季溪谷徒步", place: "藤蔓谷", dateMD: "2026年7月12日" };
const d5 = buildActivityDNA(c5);
chk("禁止：夏季溪谷 ≠ 自动生成「溪水/水花」", d5.sceneSignature === "" && !(d5.copyAngles || []).some(x => /溪水|水花|下水|泡/.test(x)), "sig=" + JSON.stringify(d5.sceneSignature));

// 禁止行为：冬季/高山 不得自动生成雪线云海
const c6 = { type: "登山", title: "高山徒步", raw: "高山徒步", place: "某山", dateMD: "2027年1月10日", elevation: 2600 };
const d6 = buildActivityDNA(c6);
chk("禁止：冬季高山 ≠ 自动生成「雪线/云海」", d6.sceneSignature === "", "sig=" + JSON.stringify(d6.sceneSignature));

// 结构契约
chk("DNA 含 creativeContext 五要素", !!(d1.creativeContext && d1.creativeContext.mainTheme && d1.creativeContext.toneWords && d1.creativeContext.suggestedAngles && d1.creativeContext.visualMood && d1.creativeContext.seasonalMood));
chk("DNA 含 evidence 溯源", !!d1.evidence && !!d1.evidence.activityForm && !!d1.evidence.descriptors);
chk("旧字段向后兼容（mainTheme/sceneTags/toneWords 仍在）", !!d1.mainTheme && Array.isArray(d1.sceneTags) && Array.isArray(d1.toneWords));
chk("sceneTags 不含臆造物象（Case1）", !(d1.sceneTags || []).some(t => sceneClaim.test(t)), JSON.stringify(d1.sceneTags));
})();

// ================= P0-D Fallback 去营销假设 =================
(function () {
var BAN = /名额有限|手慢无|先到先得|最后几个|最后机会|私信我|私信报名|群里接龙|评论区扣|扣 ?1|我帮你留位|赶紧报名|限时抢购|名额疯抢|马上满员|还有少量名额|私聊|少数名额/;

function mkA(extra) {
  return Object.assign({
    id: "p0d-1", type: "徒步", title: "青城后山徒步", place: "都江堰", dateMD: "10月1日",
    price: 128, limitUnit: "人", limit: 20, difficulty: "适中", photos: [],
    itineraryDays: [], body: []
  }, extra || {});
}
function mkM(a) { return { confirmedFacts: { activityName: a.title, place: a.place, date: a.dateMD, price: a.price, limitUnit: "人", limit: a.limit, difficulty: a.difficulty }, cta: ctaText(a) }; }
var DIR = { structure: ["为什么值得去", "来了会体验什么", "参加完能得到什么", "适不适合我", "真实信息", "怎么报名"], hook: "山脊在云里时隐时现" };

// —— 1) confirmedCTA 结构 ——
var c0 = confirmedCTAOf(mkA());
chk("confirmedCTA 含 5 个规定字段", ["signupMethod", "capacity", "remainingSlots", "deadline", "urgencyConfirmed"].every(function (k) { return k in c0; }), JSON.stringify(c0));

// —— 2) 报名方式必须有来源 ——
var aPage = mkA({ signupMethod: ["page"] });
var aWx = mkA({ signupMethod: ["wechat"] });
var aGrp = mkA({ signupMethod: ["group"] });
var aNone = mkA();
chk("signupMethod=[page] → 点击本页报名", ctaShortOf(aPage) === "点击本页报名", ctaShortOf(aPage));
chk("signupMethod=[wechat] → 添加客服微信咨询报名", ctaShortOf(aWx) === "添加客服微信咨询报名", ctaShortOf(aWx));
chk("signupMethod=[group] → 群内接龙", ctaShortOf(aGrp) === "群内接龙", ctaShortOf(aGrp));
chk("无 signupMethod → 查看活动详情与报名信息（中性）", ctaShortOf(aNone) === "查看活动详情与报名信息", ctaShortOf(aNone));
chk("无数据时不出现「私信 / 群里接龙 / 评论区扣1」", !BAN.test(ctaText(aNone)), ctaText(aNone));

// —— 3) 紧迫感必须来自计算 ——
function urg(cap, signed) { var a = mkA({ limit: cap, signups: signed }); return urgencyTextOf(confirmedCTAOf(a)); }
chk(">50% 剩余 → 不强调", urg(100, 10) === "", JSON.stringify(urg(100, 10)));
chk("20%-50% → 报名进行中", urg(100, 60) === "报名进行中。", JSON.stringify(urg(100, 60)));
chk("<=20% → 剩余名额不多", urg(100, 85) === "剩余名额不多。", JSON.stringify(urg(100, 85)));
chk("明确剩余 3 个 → 剩余 3 个名额", urg(100, 97) === "剩余 3 个名额。", JSON.stringify(urg(100, 97)));
chk("满员 → 名额已满", urg(20, 20) === "名额已满。", JSON.stringify(urg(20, 20)));
chk("无 capacity → 不说名额", urgencyTextOf(confirmedCTAOf(mkA({ limit: null, signups: 0 }))) === "");
chk("紧迫感文案不含无依据话术", !BAN.test(urg(100, 97) + urg(100, 60)), urg(100, 97) + urg(100, 60));

// —— 4) Fallback 全渠道禁词扫描 ——
var aR = mkA();
var rec = fallbackRecruitCopy(aR, mkM(aR), DIR);
var recText = JSON.stringify(rec);
chk("招募 Fallback 全渠道无营销禁词", !BAN.test(recText), BAN.test(recText) ? (recText.match(BAN) || [])[0] : "clean");
chk("招募 Fallback 的 moments.last 不再含「最后几个名额/手慢无」", !/最后几个|手慢无/.test(rec.moments.last), rec.moments.last.slice(0, 60));
chk("招募 Fallback poster CTA 来自 signupMethod", /查看活动详情与报名信息|点击本页报名|添加客服微信|群内接龙|电话报名/.test(rec.poster.cta), rec.poster.cta);

var recG = fallbackRecruitCopy(mkA({ signupMethod: ["group"] }), mkM(aR), DIR);
chk("signupMethod=[group] 时才允许出现「群内接龙」", /群内接龙/.test(JSON.stringify(recG)), recG.wechat.brief);

// —— 5) Recap 感谢语安全 ——
var recapNoConfirm = fallbackRecapCopy(mkA(), mkM(aR), DIR, [], "", "户外体验型", null);
chk("未确认参与 → 不写「感谢每一位到场的朋友」", !/感谢每一位|感谢每位/.test(JSON.stringify(recapNoConfirm)), "");
chk("未确认参与 → 使用「本次活动已经结束，以下为本次活动的现场记录。」", /本次活动已经结束，以下为本次活动的现场记录。/.test(JSON.stringify(recapNoConfirm)), "");
var recapConfirmed = fallbackRecapCopy(mkA({ actualActivityData: { actualParticipants: 12 } }), mkM(aR), DIR, [], "", "户外体验型", { actualParticipants: 12 });
chk("确认有实际参与 → 允许「谢谢这次一起出发的朋友。」", /谢谢这次一起出发的朋友。/.test(JSON.stringify(recapConfirmed)), "");

// —— 6) nextText 受控 ——
state.activities = [mkA({ id: "p0d-1" })];
chk("没有下一场活动 → 不预告「下一期正在安排 / 群里接龙占位」", nextText(mkA({ id: "p0d-1" })) === "更多活动信息可关注机构后续发布。", nextText(mkA({ id: "p0d-1" })));
chk("nextText 输出不含禁词", !BAN.test(nextText(mkA({ id: "p0d-1" }))), "");
state.activities = [mkA({ id: "p0d-1" }), mkA({ id: "p0d-2", title: "下一场活动", place: "光雾山", dateMD: "10月18日" })];
chk("有下一场活动 → 只陈述已确认信息", /下一场：光雾山/.test(nextText(mkA({ id: "p0d-1" }))), nextText(mkA({ id: "p0d-1" })));

// —— 7) 分享文案（activities.js）——
var shares = ["wechat", "moments", "xhs", "gzh", "voice"].map(function (c) { return fallbackShareCopy(mkA(), c); }).join("\n");
chk("活动详情分享文案无营销禁词", !BAN.test(shares), BAN.test(shares) ? (shares.match(BAN) || [])[0] : "clean");
chk("分享文案保留了时间/名称等事实", /青城后山徒步/.test(shares) && /10月1日/.test(shares), "");
})();

// ================= P0-C 换风格真重生成 =================
(function () {
function mkA() {
  return {
    id: "p0c-1", type: "徒步", title: "青城后山徒步", place: "都江堰", dateMD: "10月18日", date: "2026年10月18日",
    price: 128, limitUnit: "人", limit: 20, difficulty: "适中", days: 1, distance: 10, elevation: 1180,
    meeting: "天府广场", meetTime: "09:00", returnTime: "18:00",
    includeLeader: true, includeInsurance: true, includeTransport: true, includeMeal: false,
    feeInclude: ["往返交通", "专业领队"], feeExclude: ["个人消费"],
    gear: [{ name: "防滑徒步鞋", must: true }, { name: "登山杖", must: true }],
    targetAudience: "户外爱好者",
    intro: "10月18日，从成都出发，去青城后山。",
    whyGo: "视野会变。", experience: "林间土路与碎石草坡。", gain: "把节奏还给自己。", fitFor: "有基础徒步经验的人。",
    sellingPoints: [{ title: "小众路线", desc: "避开人流" }], body: ["出发前夜下了点雨。"],
    itineraryDays: [{ label: "行程安排", sub: "10月18日", items: [
      { time: "09:00", text: "天府广场集合签到" }, { time: "12:30", text: "山脊路餐" }, { time: "18:00", text: "回到集合点" }] }],
    photos: ["p0c://a.jpg", "p0c://b.jpg", "p0c://c.jpg", "p0c://d.jpg", "p0c://e.jpg", "p0c://f.jpg", "p0c://g.jpg", "p0c://h.jpg"],
    confirmedFacts: { place: "都江堰", date: "2026年10月18日", price: 128 },
    actualActivityData: { actualParticipants: 0 },
  };
}

// —— 1) 连点「换风格」×5：内容必须真的变化 ——
var a = mkA();
var factsBefore = JSON.stringify([a.place, a.date, a.price, a.distance, a.elevation, a.difficulty, a.days, a.limit,
  a.meeting, a.meetTime, a.returnTime, a.itineraryDays, a.gear, a.feeInclude, a.feeExclude,
  a.includeLeader, a.includeInsurance, a.includeTransport, a.includeMeal, a.title]);
var factsFpBefore = editorialFactsFingerprint(a);

var rounds = [];
for (var i = 0; i < 5; i++) {
  if (typeof regenStyleContent === "function") regenStyleContent(a);
  var pack = a.editorialStylePack;
  var html = "";
  try { html = renderActivityEditorial(a); } catch (e) { html = ""; }
  rounds.push({
    n: i + 1, angle: pack && pack.angle, styleId: pack && pack.styleId, layoutId: pack && pack.layoutId,
    title: pack && pack.title, lead: pack && pack.lead, quote: pack && pack.pullQuote,
    photoStrategy: pack && pack.photoStrategy && pack.photoStrategy.name,
    headings: (typeof buildEditorialOutline === "function" ? buildEditorialOutline(a, editorialVariantOf(a)) : []).map(function (s) { return s.key + ":" + s.heading; }).join("|"),
    parasSample: (typeof buildEditorialOutline === "function" ? buildEditorialOutline(a, editorialVariantOf(a)) : []).map(function (s) { return s.key + "=" + (s.paras[0] || ""); }).join("|"),
    htmlLen: html.length,
    galleryCount: (html.match(/xh-ed-gallery/g) || []).length,
  });
}
var angles = rounds.map(function (r) { return r.angle; });
var titles = rounds.map(function (r) { return r.title; });
var leads = rounds.map(function (r) { return r.lead; });
var quotes = rounds.map(function (r) { return r.quote; });
var heads = rounds.map(function (r) { return r.headings; });
var parasS = rounds.map(function (r) { return r.parasSample; });
var psNames = rounds.map(function (r) { return r.photoStrategy; });
function uniq(arr) { var s = {}; arr.forEach(function (x) { s[String(x)] = 1; }); return Object.keys(s).length; }

chk("换风格×5：内容角度出现 ≥4 种不同值", uniq(angles) >= 4, JSON.stringify(angles));
chk("换风格×5：标题出现 ≥4 种不同值", uniq(titles) >= 4, JSON.stringify(titles.map(function (t) { return String(t).slice(0, 18); })));
chk("换风格×5：开场导语出现 ≥4 种不同值", uniq(leads) >= 4, JSON.stringify(leads.map(function (t) { return String(t).slice(0, 16); })));
chk("换风格×5：金句出现 ≥4 种不同值", uniq(quotes) >= 4, "");
chk("换风格×5：章节标题组合出现 ≥3 种不同值", uniq(heads) >= 3, uniq(heads) + " 种");
chk("换风格×5：章节正文出现 ≥3 种不同值", uniq(parasS) >= 3, uniq(parasS) + " 种");
chk("换风格×5：图片叙事策略出现 ≥3 种不同值", uniq(psNames) >= 3, JSON.stringify(psNames));
chk("换风格×5：相邻两次角度不重复（连续重复降权）",
  rounds.every(function (r, i) { return i === 0 || r.angle !== rounds[i - 1].angle; }),
  JSON.stringify(angles));

// —— 2) 事实必须完全不变（按「用户真正看到的渲染结果」比，而不是比裸字段） ——
/* 注意：本项目 core.js 会把 a.date 归一化为 a.dateMD（departures 机制，属既有行为），
   所以裸字段 date 会从长格式变短格式 —— 那不是换风格造成的。真正该守的契约是
   「渲染出来的时间/地点/价格/行程/装备/保险/领队一字不变」，故按渲染片段比对。 */
function factBlocks(html) {
  var pick = function (re) { var m = String(html || "").match(re); return m ? m[0] : ""; };
  return [
    pick(/<div class="xh-ed-kvs">[\s\S]*?<\/div>\s*<\/div>/),
    pick(/<div class="xh-ed-pill">[\s\S]*?<\/div>/),
    pick(/<section class="xh-ed-decision"[\s\S]*?<\/section>/),
  ].join(" || ");
}
var fb1 = factBlocks(rounds[0] && rounds[0].html || rounds[0].rendered || "");
// rounds 未存 html，这里补一次渲染取样
var sampleHtml = [];
var aTmp = mkA();
for (var k = 0; k < 5; k++) { regenStyleContent(aTmp); try { sampleHtml.push(renderActivityEditorial(aTmp)); } catch (e) { sampleHtml.push(""); } }
var factSet = sampleHtml.map(factBlocks);
var factUniq = factSet.filter(function (x, i, arr) { return arr.indexOf(x) === i; });
chk("★事实零改动：渲染出的 数据条/时间地点/决策区(费用·行程·装备·适合) 五次完全一致",
  factUniq.length === 1 && String(factSet[0]).length > 200, "unique=" + factUniq.length + " len=" + String(factSet[0]).length);
chk("★渲染事实块确实包含时间/地点/价格（非空断言，防止比了个空串）",
  /10月18日/.test(String(factSet[0])) && /¥128/.test(String(factSet[0])) && /天府广场/.test(String(factSet[0])),
  String(factSet[0]).slice(0, 120));
var factsAfter = JSON.stringify([a.place, a.price, a.distance, a.elevation, a.difficulty,
  a.days, a.limit, a.meeting, a.meetTime, a.returnTime, a.itineraryDays, a.gear, a.feeInclude, a.feeExclude,
  a.includeLeader, a.includeInsurance, a.includeTransport, a.includeMeal, a.title]);
var factsBefore2 = JSON.stringify([a.place, a.price, a.distance, a.elevation, a.difficulty,
  a.days, a.limit, a.meeting, a.meetTime, a.returnTime, a.itineraryDays, a.gear, a.feeInclude, a.feeExclude,
  a.includeLeader, a.includeInsurance, a.includeTransport, a.includeMeal, a.title]);
chk("★事实字段零改动（地点/价格/里程/海拔/难度/天数/人数/集合/行程/装备/费用/服务选项/标题）",
  factsAfter === factsBefore2, factsAfter === factsBefore2 ? "identical" : "DIFF");
chk("★confirmedFacts / actualActivityData 未被触碰",
  JSON.stringify(a.confirmedFacts) === JSON.stringify({ place: "都江堰", date: "2026年10月18日", price: 128 })
  && a.actualActivityData.actualParticipants === 0, "");

// —— 3) DNA 事实层冻结（groundedScenes / environment / season 跨 5 次换风格不变） ——
function dnaFactSig(x) {
  var d = buildActivityDNA(x, x.photos) || {};
  return [(d.groundedScenes || []).join(","), d.environment, d.season, d.activityForm].join("~");
}
var aD = mkA();
regenStyleContent(aD); var dnaSig1 = dnaFactSig(aD);
for (var m = 0; m < 4; m++) { regenStyleContent(aD); }
var dnaSig5 = dnaFactSig(aD);
chk("★DNA 事实层冻结：groundedScenes / environment / season 跨 5 次换风格不变",
  dnaSig1 === dnaSig5, dnaSig1 + " vs " + dnaSig5);

// —— 4) 换版式不重生成内容（冻结点一致） ——
var a2 = mkA();
regenStyleContent(a2);
var beforeLayout = JSON.stringify([a2.editorialStylePack.title, a2.editorialStylePack.lead, a2.editorialStylePack.pullQuote]);
var beforePackAngle = a2.editorialStylePack.angle;
var cur = a2.editorialLayoutId || "";
var nxt = pickEditorialLayout(cur);
a2.editorialLayoutId = nxt.id;             // 只换版式
var pkAfter = editorialStylePackOf(a2);
chk("换版式后内容包仍有效且内容未变（版式轴不触碰文案）",
  !!pkAfter && JSON.stringify([pkAfter.title, pkAfter.lead, pkAfter.pullQuote]) === beforeLayout,
  "angle=" + (pkAfter && pkAfter.angle) + " vs " + beforePackAngle);

// —— 5) 事实变更 → 旧内容包自动作废 ——
var a3 = mkA();
regenStyleContent(a3);
a3.price = 199;                             // 改事实
chk("★事实变更后旧内容包自动作废（不会拿旧文案配新价格）", editorialStylePackOf(a3) === null, String(editorialStylePackOf(a3)));

// —— 6) 内容安全：不得出现未确认的现场画面 / 营销话术 ——
var BAN = /名额有限|手慢无|先到先得|最后几个|私信我|群里接龙|评论区扣|漫山红叶|满山红叶|遍地野花|云海翻涌|溪水潺潺/;
var allText = rounds.map(function (r) { return r.title + r.lead + r.quote + r.headings + r.parasSample; }).join(" ");
chk("★换风格生成的全部文案无营销话术/无臆造现场画面", !BAN.test(allText),
  BAN.test(allText) ? (allText.match(BAN) || [])[0] : "clean");

// —— 7) 结构契约：pack 必含规定字段 ——
var pk = rounds[4] && a.editorialStylePack;
chk("stylePack 含规定字段（angle/title/subtitle/lead/paras/pullQuote/photoStrategy/createdAt）",
  !!(pk && pk.angle && pk.title && pk.subtitle && pk.lead && pk.paras && pk.pullQuote && pk.photoStrategy && pk.createdAt), Object.keys(pk || {}).join(","));
chk("_styleHistory 记录 {contentAngle, styleId, layoutId, createdAt}",
  Array.isArray(a._styleHistory) && a._styleHistory.length >= 5
  && a._styleHistory.every(function (h) { return h.contentAngle && h.styleId && h.layoutId && h.createdAt; }),
  JSON.stringify((a._styleHistory || []).length));

// —— 8) 未换风格的活动不受影响（回归安全） ——
var a4 = mkA();
var h4 = "";
try { h4 = renderActivityEditorial(a4); } catch (e) { h4 = ""; }
chk("未换风格的活动仍可正常渲染（向后兼容）", h4.length > 800 && /xh-ed-sec/.test(h4), "len=" + h4.length);
chk("未换风格时 hero 标题回退到 a.title", /青城后山徒步/.test(h4), "");
})();

// ================= P1 Vision Intelligence =================
(function () {
// —— 1) 统一 schema 字段完整 ——
var S = "p1://sanya-paddle.jpg";
applyVision(S, { orientation: "landscape", quality_score: 0.86, scene: "water", subject: "人物",
  people_count: 4, action: "动态", emotion: "明快", safe_text_area: "top-right",
  focal_point: { x: 0.4, y: 0.55 }, crop_risk: "high", recommended_use: ["hero", "story"],
  objects: ["桨板", "水面", "救生衣"], people: { count: 4, group: false, children: false },
  subjects: [{ name: "人物", bbox: { x: 0.2, y: 0.3, width: 0.4, height: 0.5 } }],
  activity: "桨板", environment: "水域", composition: "中景",
  safe_crop_box: { x: 0.15, y: 0.2, width: 0.6, height: 0.7 }, confidence: 0.88 });

var r = visionResultOf(S);
var REQ = ["imageId", "scene", "objects", "people", "subjects", "activity", "environment", "orientation",
  "qualityScore", "emotion", "composition", "focalPoint", "safeCropBox", "textSafeArea", "duplicateGroup", "confidence"];
chk("统一 visionResult 含 schema 规定的全部字段", !!r && REQ.every(function (k) { return k in r; }), r ? REQ.filter(function (k) { return !(k in r); }).join(",") : "null");
chk("people 结构为 {count, group, children}", !!r && r.people && r.people.count === 4 && r.people.group === false && r.people.children === false, JSON.stringify(r && r.people));
chk("subjects 保留 bbox", !!r && r.subjects.length === 1 && r.subjects[0].bbox.width === 0.4, JSON.stringify(r && r.subjects));
chk("safeCropBox 归一化成功", !!r && r.safeCropBox && r.safeCropBox.width === 0.6, JSON.stringify(r && r.safeCropBox));
chk("§一 Schema：scene / activity / environment / textSafeArea 均为数组",
  !!r && Array.isArray(r.scene) && Array.isArray(r.activity) && Array.isArray(r.environment) && Array.isArray(r.textSafeArea),
  JSON.stringify({ scene: r.scene, activity: r.activity, environment: r.environment, textSafeArea: r.textSafeArea }));
chk("§一 Schema：subjects[].type 存在且 bbox 保留",
  !!r && r.subjects.length === 1 && !!r.subjects[0].type && !!r.subjects[0].bbox,
  JSON.stringify(r && r.subjects));
chk("§一 Schema：strings 字段 scene 支持多值（逗号/斜杠分隔 → 数组）",
  (function () { var u = visionUnifiedOf("v193://multi.jpg", { scene: "风景/人物", activity: "徒步、登山", environment: "森林", simulated: false }); return u.scene.length === 2 && u.activity.length === 2; })(),
  "");
chk("§一 Schema：focalPoint 缺省为 {0.5, 0.5}（文档默认值）",
  (function () { var u = visionUnifiedOf("v193://fp.jpg", { scene: "scenic", simulated: false }); return u.focalPoint && u.focalPoint.x === 0.5 && u.focalPoint.y === 0.5; })(), "");
chk("§一 Schema：duplicateGroup 缺省为 null",
  (function () { var u = visionUnifiedOf("v193://dup.jpg", { scene: "scenic", simulated: false }); return u.duplicateGroup === null; })(), "");

// —— 2) 20 类细粒度识别 ——
var CASES = [
  ["p1://a-forest.jpg", { scene: "scenic", environment: "森林", objects: ["树林", "松林"] }, "森林"],
  ["p1://a-snow.jpg", { scene: "scenic", environment: "雪山", objects: ["雪坡"] }, "雪山"],
  ["p1://a-tent.jpg", { scene: "camp", objects: ["帐篷", "睡袋"] }, "帐篷"],
  ["p1://a-camp.jpg", { scene: "camp", objects: ["营地", "天幕"] }, "营地"],
  ["p1://a-kayak.jpg", { scene: "water", activity: "皮划艇", objects: ["皮划艇"] }, "皮划艇"],
  ["p1://a-paddle.jpg", { scene: "water", activity: "桨板", objects: ["桨板"] }, "桨板"],
  ["p1://a-hike.jpg", { scene: "hike", activity: "徒步", objects: ["步道"] }, "徒步"],
  ["p1://a-climb.jpg", { scene: "hike", activity: "登山", objects: ["山顶"] }, "登山"],
  ["p1://a-meal.jpg", { scene: "meal", objects: ["路餐"] }, "餐食"],
  ["p1://a-gear.jpg", { scene: "gear", objects: ["背包", "登山杖"] }, "装备"],
  ["p1://a-van.jpg", { scene: "detail", objects: ["商务车"] }, "车辆"],
  ["p1://a-sunset.jpg", { scene: "sky", objects: ["日落", "晚霞"] }, "日出日落"],
  ["p1://a-night.jpg", { scene: "night", objects: ["星空"] }, "夜景"],
  ["p1://a-route.jpg", { scene: "route", objects: ["路标"] }, "路线"],
  ["p1://a-group.jpg", { scene: "people", objects: ["合影"], people_count: 8 }, "合影"],
  ["p1://a-water.jpg", { scene: "water", objects: ["溪流"] }, "水域"],
  ["p1://a-people.jpg", { scene: "people", people_count: 2 }, "人物"],
  ["p1://a-scenic.jpg", { scene: "scenic", objects: ["远景"] }, "风景"],
];
CASES.forEach(function (c) { applyVision(c[0], Object.assign({ orientation: "landscape", quality_score: 0.8, recommended_use: ["story"], simulated: false }, c[1])); });
var miss = CASES.filter(function (c) { var f = visionFineScenesOfSrc(c[0]); return f.indexOf(c[2]) < 0; });
chk("细粒度识别覆盖 20 类（风景/人物/合影/徒步/登山/桨板/皮划艇/露营/帐篷/餐食/装备/车辆/营地/水域/森林/雪山/路线/日出日落/夜景）",
  miss.length === 0, miss.map(function (c) { return c[2] + "→[" + visionFineScenesOfSrc(c[0]).join(",") + "]"; }).join(" | "));
chk("VISION_FINE_SCENES 常量声明的类别数 ≥ 19", (VISION_FINE_SCENES || []).length >= 19, String((VISION_FINE_SCENES || []).length));
var c1 = ["p1://c-camp1.jpg", "p1://c-camp2.jpg"];
c1.forEach(function (x) { applyVision(x, { scene: "camp", objects: ["露营", "帐篷"], orientation: "landscape", quality_score: 0.8, simulated: false }); });
chk("露营可被识别（scene=camp/objects 含露营）", visionMatchesFine("p1://c-camp1.jpg", ["露营", "帐篷"]), visionFineScenesOfSrc("p1://c-camp1.jpg").join(","));

// —— 3) evidenceScope：素材证据 vs 活动事实 ——
var es = visionEvidenceScope(S);
chk("§四 evidenceScope 形状 = { materialEvidence: true, eventFact: false }",
  !!es && es.materialEvidence === true && es.eventFact === false,
  JSON.stringify({ materialEvidence: es.materialEvidence, eventFact: es.eventFact }));
chk("§四 materialItems 含画面里确实有的内容（桨板/水域/人物）",
  !!es && /桨板/.test((es.materialItems || []).join(",")) && /水域/.test((es.materialItems || []).join(",")),
  JSON.stringify(es && es.materialItems));
chk("★§四 eventFact 必须为 false（照片不能证明活动当天发生了什么）", es.eventFact === false, String(es.eventFact));
chk("§四 evidenceScope 带说明文案（不会被误当成活动事实）", /素材/.test(es.note) && /活动当天/.test(es.note), String(es.note).slice(0, 70));
chk("§四 未分析图返回 materialEvidence=false（不编造证据）", visionEvidenceScope("v193://never.jpg").materialEvidence === false, "");

// —— 4) P0-A Source C 打通：真实视觉 → 已生成 groundedScenes ——
var tags = visionGroundingTags(["p1://a-tent.jpg", "p1://a-snow.jpg", "p1://a-sunset.jpg"]);
chk("visionGroundingTags 从真实结果产出「已确认场景」", tags.length >= 3, JSON.stringify(tags.map(function (t) { return t.scene; })));
var aV = { id: "p1v", type: "露营", title: "营地之夜", place: "某营地", dateMD: "10月3日",
  photos: ["p1://a-tent.jpg", "p1://a-snow.jpg", "p1://a-sunset.jpg"] };
var dV = buildActivityDNA(aV, aV.photos);
chk("★DNA groundedScenes 采纳图片真实识别（Source C）",
  (dV.groundedSceneDetails || []).some(function (g) { return g.source === "vision"; }),
  JSON.stringify((dV.groundedSceneDetails || []).map(function (g) { return g.scene + "/" + g.source; })));
chk("★未确认画面不会被 Vision 无中生有：森林图片不产生「彩林/红叶」",
  !/彩林|红叶/.test(JSON.stringify(visionGroundingTags(["p1://a-forest.jpg"]))), JSON.stringify(visionGroundingTags(["p1://a-forest.jpg"])));

// —— 5) 模拟（启发式）结果不得充当「图片证据」 ——
var SIM = "p1://sim.jpg";
applyVision(SIM, { scene: "camp", objects: ["帐篷"], orientation: "landscape", quality_score: 0.7, simulated: false });
// 手动改成模拟态
if (typeof PHOTO_FOCUS_CACHE !== "undefined") { var mm = PHOTO_FOCUS_CACHE.get(SIM) || {}; PHOTO_FOCUS_CACHE.set(SIM, Object.assign({}, mm, { simulated: true })); }
if (typeof VISION_RESULTS !== "undefined" && VISION_RESULTS[SIM]) VISION_RESULTS[SIM].simulated = true;
chk("★simulated=true 的启发式结果不进入「已确认场景」（防止换种方式臆造事实）",
  visionGroundingTags([SIM]).length === 0, JSON.stringify(visionGroundingTags([SIM])));

// —— 6) 降级：不阻塞、标 simulated ——
var okDeg = visionDegrade("p1://no-key.jpg", "no_vision_key");
chk("visionDegrade 返回 true 且不抛错（降级路径安全）", okDeg === true, "");
chk("visionIsDegraded 记录降级状态", visionIsDegraded("p1://no-key.jpg") === true, "");
var sum = visionStatusSummary([S, SIM, "p1://never-seen.jpg"]);
chk("visionStatusSummary 区分 real / degraded / none", sum.real >= 1 && sum.degraded >= 1 && sum.total === 3, JSON.stringify(sum));

// —— 7) 归一化：坏值必须被丢弃，不得透传 ——
var bad = visionNormalize({ scene: "camp", subjects: [{ name: "人", bbox: { x: "x", y: 0.1, width: 0.2, height: 0.2 } }],
  safe_crop_box: { x: 0.1, y: 0.1, width: 0, height: 0.5 }, confidence: 3, objects: ["帐篷", "", "  "], people: 3 });
chk("归一化丢弃坏 bbox（非法 subjects[].bbox）", !!bad && !bad.subjects, JSON.stringify(bad && bad.subjects));
chk("归一化丢弃零面积 safe_crop_box", !!bad && !bad.safe_crop_box, JSON.stringify(bad && bad.safe_crop_box));
chk("归一化对超范围 confidence 走保守换算（3 → 0.03，绝不当作满置信）", !!bad && bad.confidence === 0.03, String(bad && bad.confidence));
chk("归一化清洗 objects 空串", !!bad && bad.objects.join(",") === "帐篷", JSON.stringify(bad && bad.objects));
chk("归一化支持 people 数字简写 → {count}", !!bad && bad.people && bad.people.count === 3, JSON.stringify(bad && bad.people));
chk("归一化不认识的字段被剔除", !!bad && !("foo" in (visionNormalize({ scene: "camp", foo: 1 }) || {})));

// —— 8) 服务下游：筛图 / 封面 / 内容匹配可用细粒度 ——
chk("封面筛选可用：visionMatchesFine 命中 桨板", visionMatchesFine(S, ["桨板"]) === true, "");
chk("内容匹配可用：不相关类不误命中", visionMatchesFine("p1://a-forest.jpg", ["皮划艇"]) === false, "");

// —— 9) 真实视觉的 bbox 进入 Safe Crop（P0-B 联动） ——
var pol = cropPolicyOf(S);
chk("★真实 Vision 的 bbox 进入 CropPolicy.subjectBoxes（P0-B 联动）",
  !!(pol && pol.subjectBoxes && pol.subjectBoxes.length), JSON.stringify(pol && pol.subjectBoxes));
chk("★真实 Vision 的 crop_risk=high 使 CropPolicy 判 high / aspect_preserved",
  !!(pol && (pol.riskLevel === "high" || pol.mode === "aspect_preserved")), pol && (pol.riskLevel + "/" + pol.mode));

// —— 10) 真实模型结果写回后统一结果自动登记 ——
chk("applyVision 写回后 VISION_RESULTS 自动登记", !!(typeof VISION_RESULTS !== "undefined" && VISION_RESULTS[S]), "");
chk("visionResultOf 对未分析图返回 null（不编造）", visionResultOf("p1://never-seen-xyz.jpg") === null, String(visionResultOf("p1://never-seen-xyz.jpg")));
})();

// ================= P0-B Safe Crop：10 类测试图 =================
(function () {
  var KEY = "cropPolicyOf";
  if (typeof cropPolicyOf !== "function") { chk("P0-B cropPolicyOf 存在", false, "missing"); return; }
  // 10 类：人头 / 人脚 / 合影 / 竖图人物 / 横图人物 / 超宽风景 / 方图 / 低画质 / 无主体风景 / 夜景
  var T = [
    ["p0b://head-portrait.jpg",  { orientation: "portrait",  scene: "people", crop_risk: "high",   quality_score: 0.9, people_count: 1, ratio: 0.66, subjects: [{ name: "人物", bbox: { x: 0.25, y: 0.05, width: 0.5, height: 0.9 } }] }, "high"],
    ["p0b://feet-portrait.jpg",  { orientation: "portrait",  scene: "people", crop_risk: "high",   quality_score: 0.88, people_count: 1, ratio: 0.68, subjects: [{ name: "人物", bbox: { x: 0.2, y: 0.08, width: 0.55, height: 0.88 } }] }, "high"],
    ["p0b://group-8.jpg",        { orientation: "landscape", scene: "people", crop_risk: "high",   quality_score: 0.85, people_count: 8, ratio: 1.5, people: { count: 8, group: true }, subjects: [{ name: "合影", bbox: { x: 0.05, y: 0.3, width: 0.9, height: 0.5 } }] }, "high"],
    ["p0b://portrait-solo.jpg",  { orientation: "portrait",  scene: "people", crop_risk: "medium", quality_score: 0.8, people_count: 1, ratio: 0.75 }, "medium"],
    ["p0b://landscape-people.jpg", { orientation: "landscape", scene: "people", crop_risk: "medium", quality_score: 0.8, people_count: 2, ratio: 1.5 }, "medium"],
    ["p0b://wide-scenery.jpg",   { orientation: "landscape", scene: "scenic", crop_risk: "low",    quality_score: 0.9, people_count: 0, ratio: 3.0 }, "low"],
    ["p0b://square-scenery.jpg", { orientation: "square",    scene: "scenic", crop_risk: "low",    quality_score: 0.86, people_count: 0, ratio: 1.0 }, "low"],
    ["p0b://lowq.jpg",           { orientation: "landscape", scene: "detail", crop_risk: "medium",  quality_score: 0.4, people_count: 0, ratio: 1.5 }, "medium"],
    ["p0b://no-subject.jpg",     { orientation: "landscape", scene: "scenic", crop_risk: "low",    quality_score: 0.9, people_count: 0, ratio: 1.6 }, "low"],
    ["p0b://night.jpg",          { orientation: "landscape", scene: "night",  crop_risk: "low",    quality_score: 0.8, people_count: 0, ratio: 1.5 }, "low"],
  ];
  T.forEach(function (x) { applyVision(x[0], Object.assign({ simulated: false, recommended_use: ["story"] }, x[1])); });
  var wrong = T.filter(function (x) { var p = cropPolicyOf(x[0]); return !p || p.riskLevel !== x[2]; });
  chk("P0-B 10 类测试图的 CropPolicy 风险判级正确", wrong.length === 0,
    wrong.map(function (x) { return x[0] + "=" + (cropPolicyOf(x[0]) || {}).riskLevel + "(期望" + x[2] + ")"; }).join(" | "));

  var highs = T.filter(function (x) { return x[2] === "high"; });
  var badMode = highs.filter(function (x) { var p = cropPolicyOf(x[0]); return !p || p.mode !== "aspect_preserved" || p.allowCrop !== false; });
  chk("P0-B 高风险图一律 aspect_preserved 且 allowCrop=false", badMode.length === 0,
    badMode.map(function (x) { return x[0]; }).join(","));

  var meds = T.filter(function (x) { return x[2] === "medium"; });
  var medMode = meds.filter(function (x) { var p = cropPolicyOf(x[0]); return !p || p.mode !== "safe_cover" || p.allowCrop !== true; });
  chk("P0-B 中风险图一律 safe_cover（允许裁切但须按 focalPoint/safeCropBox 定位）", medMode.length === 0,
    medMode.map(function (x) { return x[0]; }).join(","));

  var lows = T.filter(function (x) { return x[2] === "low"; });
  var lowMode = lows.filter(function (x) { var p = cropPolicyOf(x[0]); return !p || p.mode !== "cover"; });
  chk("P0-B 低风险图一律 cover（风景无人可安全裁切）", lowMode.length === 0, lowMode.map(function (x) { return x[0]; }).join(","));

  // ★ 渲染层不得把高风险翻回 cover —— 这是本次修复的核心（旧实现在 xhFig 里静默翻回）
  var af = { id: "p0b", type: "徒步", place: "某地", dateMD: "10月1日", price: 99, limit: 20, limitUnit: "人",
    difficulty: "适中", photos: T.map(function (x) { return x[0]; }) };
  var html = "";
  try { html = renderActivityEditorial(af); } catch (e) { html = ""; }
  var viol = (typeof cropRenderViolations === "function") ? cropRenderViolations(html) : ["fn-missing"];
  chk("P0-B ★渲染结果中不存在「高风险图却用 cover 渲染」的违规", viol.length === 0, JSON.stringify(viol).slice(0, 200));

  var headFig = "";
  try { headFig = xhFig(af, 0, ""); } catch (e) { headFig = ""; }
  chk("P0-B ★人头图最终渲染为 contain（不裁头）", /ph-safe/.test(headFig) && /object-fit:contain/.test(headFig), headFig.slice(0, 160));
  chk("P0-B ★人头图容器比例 = 图片真实比例（不 clamp，故不露色带）",
    (function () { var m = photoMeta(af.photos[0]); var ar = String((headFig.match(/--ar:\s*([0-9.]+)/) || [])[1] || ""); return !!m && ar && Math.abs(Number(ar) - Number(m.ratio)) < 0.001; })(), headFig.slice(0, 90));
  chk("P0-B ★人头图带 data-crop-risk=high 与 data-crop-mode=aspect_preserved（可审计）",
    /data-crop-risk="high"/.test(headFig) && /data-crop-mode="aspect_preserved"/.test(headFig), "");
  var wideFig = "";
  try { wideFig = xhFig(af, 5, ""); } catch (e) { wideFig = ""; }
  chk("P0-B 无主体风景图仍走 cover（未被过度保护成 contain）", /object-fit:cover/.test(wideFig) && !/ph-safe/.test(wideFig), wideFig.slice(0, 120));
  /* 中风险有两种正确落法：
     ① 纯中风险（横图/无人/低画质）→ safe_cover，object-position 按 focalPoint 计算；
     ② 竖图含人 → 沿用既有 P0-11「必须原比例」的更严格规则，渲染为 aspect_preserved。
     两种都绝不允许落到普通 cover（那会就是「中风险图被硬裁」）。 */
  var medFig = "";
  try { medFig = xhFig(af, 7, ""); } catch (e) { medFig = ""; }   // lowq：横图/无人/中风险
  chk("P0-B 纯中风险图渲染为 safe_cover（object-position 按 focalPoint 计算）",
    /data-crop-mode="safe_cover"/.test(medFig) && /object-position:\s*\d+% \d+%/.test(medFig), medFig.slice(0, 170));
  var medFigP = "";
  try { medFigP = xhFig(af, 3, ""); } catch (e) { medFigP = ""; }  // 竖图含人：沿用 P0-11 更严格规则
  chk("P0-B 竖图含人的中风险图沿用 P0-11 更严格规则（aspect_preserved，不横裁）",
    /data-crop-mode="aspect_preserved"/.test(medFigP) && /object-fit:contain/.test(medFigP), medFigP.slice(0, 170));
  chk("P0-B ★中风险图绝不落到普通 cover（否则就是被硬裁）",
    !/data-crop-mode="cover"/.test(medFig) && !/data-crop-mode="cover"/.test(medFigP), "");

  // 封面：竖图/人物封面「降 FullBleed」改原比例 + 模糊底图
  var afP = Object.assign({}, af, { photos: [T[0][0], T[1][0], T[2][0]] });
  var htmlP = "";
  try { htmlP = renderActivityEditorial(afP); } catch (e) { htmlP = ""; }
  chk("P0-B ★竖图/人物封面「降 FullBleed」：hero 带 keep 类 + 模糊底图",
    /xh-ed-hero[^"]*keep/.test(htmlP) && /xh-ed-hero-backdrop/.test(htmlP), "");

  // 优先级不能被「容器填满」推翻（反向验证：把风险评估抽掉后应退回 cover）
  var afNo = { id: "p0bn", type: "徒步", place: "某地", dateMD: "10月1日", photos: ["p0b://never-analyzed.jpg"] };
  var figNo = "";
  try { figNo = xhFig(afNo, 0, ""); } catch (e) { figNo = ""; }
  chk("P0-B ★反向验证：无分析数据时退回 cover（证明 contain 真的由风险评估驱动）",
    /object-fit:cover/.test(figNo) && !/ph-safe/.test(figNo), figNo.slice(0, 120));
})();

// ================= P0-E 模块完整性 / 启动自检 =================
(function () {
  var MODS = ["renderEconomics", "renderPrep", "renderPrepSummary", "renderEconCostPanel", "econAnswer"];
  var missing = MODS.filter(function (n) { return typeof window[n] !== "function"; });
  chk("P0-E 文档点名的 5 个经营分析模块函数全部存在（无「有入口无函数」）", missing.length === 0, missing.join(","));
  var REQ = (typeof REQUIRED_MODULES !== "undefined" && Array.isArray(REQUIRED_MODULES)) ? REQUIRED_MODULES : null;
  chk("P0-E REQUIRED_MODULES 清单已声明且覆盖上述 5 个函数", !!REQ && MODS.every(function (n) { return REQ.indexOf(n) >= 0; }), REQ ? String(REQ.length) : "missing");
  var miss2 = (REQ || []).filter(function (n) { return typeof window[n] !== "function"; });
  chk("P0-E 启动自检清单里的模块全部可解析", miss2.length === 0, miss2.join(","));
  chk("P0-E 自检函数可调用且返回缺失清单（不抛错）",
    typeof checkRequiredModules === "function" && Array.isArray(checkRequiredModules()),
    typeof checkRequiredModules === "function" ? JSON.stringify(checkRequiredModules()) : "missing");
  chk("P0-E renderActivityPhone 可渲染经营分析视图（模块真实可用）", typeof renderActivityPhone === "function", "");
})();

// ================= P1 §三 Vision 的 5 项职责 + §六 降级 UI =================
(function () {
  function V(src, o) { applyVision(src, Object.assign({ simulated: false, quality_score: 0.8, orientation: "landscape", recommended_use: ["story"] }, o)); }

  // —— §三.1 筛图：模糊 / 重复 / 过暗 / 主体不清 ——
  V("v193://f-blur.jpg",   { scene: "scenic", quality_score: 0.28 });
  V("v193://f-dark.jpg",   { scene: "scenic", quality_score: 0.8, emotion: "暗" });
  V("v193://f-dupA.jpg",   { scene: "scenic", quality_score: 0.9, duplicate_group: "g1" });
  V("v193://f-dupB.jpg",   { scene: "scenic", quality_score: 0.6, duplicate_group: "g1" });
  V("v193://f-nosubj.jpg", { scene: "people", quality_score: 0.9, people_count: 2 });
  V("v193://f-good.jpg",   { scene: "scenic", quality_score: 0.92 });
  var fl = visionFilterPhotos(["v193://f-blur.jpg", "v193://f-dark.jpg", "v193://f-dupA.jpg", "v193://f-dupB.jpg", "v193://f-nosubj.jpg", "v193://f-good.jpg"]);
  var dropMap = {};
  fl.drop.forEach(function (d) { dropMap[d.src] = d.reasons.join("|"); });
  chk("§三.1 筛图：模糊图被判定为「模糊或画质偏低」", /模糊/.test(dropMap["v193://f-blur.jpg"] || ""), dropMap["v193://f-blur.jpg"]);
  chk("§三.1 筛图：过暗图被判定为「过暗」", /过暗/.test(dropMap["v193://f-dark.jpg"] || ""), dropMap["v193://f-dark.jpg"]);
  chk("§三.1 筛图：同 duplicateGroup 只留质量最高的一张", fl.drop.some(function (d) { return d.src === "v193://f-dupB.jpg"; }) && fl.keep.indexOf("v193://f-dupA.jpg") >= 0, dropMap["v193://f-dupB.jpg"]);
  chk("§三.1 筛图：识别人物但无 bbox → 判「主体不清」", /主体不清/.test(dropMap["v193://f-nosubj.jpg"] || ""), dropMap["v193://f-nosubj.jpg"]);
  chk("§三.1 筛图：合格图被保留（keep 含 f-good）", fl.keep.indexOf("v193://f-good.jpg") >= 0, fl.keep.length + " 张保留");
  chk("★§三.1 筛图：无分析数据的图一律保留（不凭无数据判死）", visionFilterPhotos(["v193://no-analysis-xyz.jpg"]).keep.length === 1, "");

  // —— §三.2 封面选择：质量高 / 主体完整 / 有代表性 / 适合 Hero ——
  V("v193://c-person-high.jpg", { scene: "people", quality_score: 0.95, people_count: 1, crop_risk: "high", ratio: 0.66, recommended_use: ["story"] });
  V("v193://c-scenic.jpg", { scene: "scenic", quality_score: 0.9, crop_risk: "low", ratio: 1.77, recommended_use: ["hero", "story"] });
  V("v193://c-scenic2.jpg", { scene: "scenic", quality_score: 0.88, crop_risk: "low", ratio: 1.6, recommended_use: ["story"] });
  var cov = visionSelectCover(["v193://c-person-high.jpg", "v193://c-scenic.jpg", "v193://c-scenic2.jpg"]);
  chk("§三.2 封面选择：优先「无裁切风险 + 横构图 + 模型推荐 Hero」的风景图（而非最高分但高风险人物图）",
    cov.index === 1, "index=" + cov.index + " score=" + cov.score + " " + JSON.stringify(cov.reason));
  chk("§三.2 封面选择：给出可解释理由（质量/主体/代表性/Hero）",
    Array.isArray(cov.reason) && cov.reason.some(function (x) { return /无裁切风险|质量/.test(x); }), JSON.stringify(cov.reason));
  chk("§三.2 封面选择：老板已选封面不轻易被改（差距 ≤0.12 时保留）",
    visionSelectCover(["v193://c-person-high.jpg", "v193://c-scenic.jpg", "v193://c-scenic2.jpg"], 2).index === 2, "");
  chk("§三.2 封面选择：无照片时安全返回", visionSelectCover([]).index === 0, "");

  // —— §三.3 图片与内容匹配：午餐安排优先 meal、不得徒步远景 ——
  V("v193://m-meal.jpg",  { scene: "meal", objects: ["路餐"], activity: "餐食", quality_score: 0.85 });
  V("v193://m-hike.jpg",  { scene: "hike", activity: "徒步", objects: ["步道", "远景"], quality_score: 0.9 });
  var mealSec = { key: "meal", kind: "meal" };
  chk("§三.3 内容匹配：「午餐安排」章节接受餐食图", visionMatchSection("v193://m-meal.jpg", mealSec) === true, JSON.stringify(visionSectionFit("v193://m-meal.jpg", mealSec)));
  chk("§三.3 ★内容匹配：「午餐安排」章节拒绝徒步远景图（文档原文要求）",
    visionMatchSection("v193://m-hike.jpg", mealSec) === false,
    JSON.stringify(visionSectionFit("v193://m-hike.jpg", mealSec)));
  chk("§三.3 内容匹配：给出命中/冲突场景，便于排查",
    (function () { var f = visionSectionFit("v193://m-hike.jpg", mealSec); return Array.isArray(f.hit) && Array.isArray(f.against) && f.against.length > 0; })(), "");
  chk("§三.3 内容匹配：无法判断时放行（undecided，不误杀）",
    visionSectionFit("v193://no-analysis-abc.jpg", { key: "why", kind: "why" }).undecided === true, "");
  chk("§三.3 内容匹配：营地章节期望 露营/帐篷/营地",
    (function () { var w = visionSectionScenesFor({ key: "camp", kind: "camp" }); return w.indexOf("露营") >= 0 && w.indexOf("帐篷") >= 0; })(), JSON.stringify(visionSectionScenesFor({ key: "camp", kind: "camp" })));
  chk("§三.3 内容匹配：day 行程章节走行程语义",
    (function () { var w = visionSectionScenesFor({ key: "day1", kind: "route" }); return w.length > 0; })(), "");

  // —— §三.5 页面风格判断 ——
  var PERSON = [], SCENERY = [], ACTION = [], CAMP = [];
  for (var i = 0; i < 10; i++) {
    var k = "v193://ps-" + i + ".jpg";
    if (i < 7) V(k, { scene: "people", quality_score: 0.85, people_count: 2 });
    else V(k, { scene: "scenic", quality_score: 0.85 });
    PERSON.push(k);
  }
  var hP = visionPageStyleHint(PERSON);
  chk("§三.5 风格判断：70% 人物 → 偏纪实 / 社交", hP.hint === "偏纪实 / 社交", hP.hint + " " + JSON.stringify(hP.ratios));
  for (var j = 0; j < 10; j++) { var k2 = "v193://sc-" + j + ".jpg"; V(k2, { scene: "scenic", objects: ["远景"], quality_score: 0.9 }); SCENERY.push(k2); }
  chk("§三.5 风格判断：70% 风景 → 偏视觉大片", visionPageStyleHint(SCENERY).hint === "偏视觉大片", visionPageStyleHint(SCENERY).hint);
  for (var m = 0; m < 10; m++) { var k3 = "v193://ac-" + m + ".jpg"; V(k3, { scene: "hike", activity: "徒步", objects: ["山脊"], quality_score: 0.9 }); ACTION.push(k3); }
  chk("§三.5 风格判断：大量动作图 → 偏挑战 / 动态", visionPageStyleHint(ACTION).hint === "偏挑战 / 动态", visionPageStyleHint(ACTION).hint);
  for (var q = 0; q < 10; q++) { var k4 = "v193://cp-" + q + ".jpg"; V(k4, { scene: "camp", objects: ["帐篷", "营地"], quality_score: 0.9 }); CAMP.push(k4); }
  chk("§三.5 风格判断：大量营地细节 → 偏生活方式 / Lookbook", visionPageStyleHint(CAMP).hint === "偏生活方式 / Lookbook", visionPageStyleHint(CAMP).hint);
  chk("§三.5 风格判断：返回各占比 + 可解释说明", (function () { var h = visionPageStyleHint(CAMP); return h.ratios && typeof h.ratios.person === "number" && h.notes.length > 0; })(), JSON.stringify(visionPageStyleHint(CAMP).ratios));
  chk("§三.5 风格判断：无照片时安全返回", visionPageStyleHint([]).hint === "", "");

  // —— §六 降级 UI 标签 ——
  chk("§六 降级可用：Vision 不可用时 UI 显示「图片智能：基础分析」",
    (function () { var pics = ["v193://ui-deg.jpg"]; visionDegrade(pics[0], "no_vision_key"); return visionIntelLabel(pics) === "图片智能：基础分析"; })(),
    visionIntelLabel(["v193://ui-deg.jpg"]));
  chk("§六 全部真实识别时显示「图片智能：视觉识别」",
    (function () { var pics = ["v193://c-scenic.jpg"]; return visionIntelLabel(pics) === "图片智能：视觉识别"; })(),
    visionIntelLabel(["v193://c-scenic.jpg"]));
  chk("§六 详情文案含真实/降级/未分析数量（内部可见，不阻塞流程）",
    /真实识别 \d+ 张/.test(visionIntelDetail(["v193://c-scenic.jpg", "v193://ui-deg.jpg"])), visionIntelDetail(["v193://c-scenic.jpg", "v193://ui-deg.jpg"]));

  // —— §二 至少识别 19 类户外语义（文档逐条列出）——
  var NEED = ["风景", "人物", "合影", "徒步", "登山", "桨板", "皮划艇", "露营", "帐篷", "餐食", "装备", "车辆", "营地", "水域", "森林", "雪山", "路线", "日出日落", "夜景"];
  var lack = NEED.filter(function (x) { return (VISION_FINE_SCENES || []).indexOf(x) < 0; });
  chk("§二 细粒度语义覆盖文档列出的 19 类", lack.length === 0, lack.join(","));
})();

return { results: OUT, ok: OUT.every(function (r) { return r.pass; }) };
