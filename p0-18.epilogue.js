// P0-18 Claim→Fact Validation 验收
// 逻辑：生成文案 → 提取关键 Claim → 对应事实字段检查 → 无依据 → 删除/重写
// 重点校验 12 类：领队/保险/餐食/住宿/交通/天气/人数/登顶/完成路线/用户反馈/安全保障/装备提供
state = (typeof initState === "function") ? initState() : (state || {});
if (!state.xf) state.xf = {};

const PUNCT = /[，。！？；、\n\s]/g;
function norm(s) { return (s || "").replace(PUNCT, ""); }

function mkOut(sentences) {
  // section1 额外带一句安全句，确保删除后 section 不空（qualityCheck 要求 sections>=3）
  const sec1 = sentences.concat(["（本场信息以发布页为准）"]).map((s) => "<p>" + s + "</p>").join("");
  return {
    gzh: {
      title: "测试标题",
      summary: "测试摘要。",
      sections: [
        { h: "主段落", html: sec1 },
        { h: "次段落", html: "<p>信息以发布页为准。</p>" },
        { h: "收尾", html: "<p>详情请咨询工作人员。</p>" },
      ],
    },
    xhs: { body: "封面短句\n" + sentences.join("\n") },
    moments: { warm: sentences.join(""), formal: "招募", last: "名额有限" },
    wechat: { recruit: sentences.join(""), brief: "一句话" },
  };
}
function allText(out) {
  const g = out.gzh || {};
  const parts = [];
  (g.sections || []).forEach((s) => parts.push(s.html || ""));
  if (g.title) parts.push(g.title);
  if (g.summary) parts.push(g.summary);
  if (out.xhs && out.xhs.body) parts.push(out.xhs.body);
  if (out.moments) parts.push(typeof out.moments === "string" ? out.moments : ["warm", "formal", "last"].map((k) => out.moments[k] || "").join(""));
  if (out.wechat) parts.push(typeof out.wechat === "string" ? out.wechat : ["recruit", "brief"].map((k) => out.wechat[k] || "").join(""));
  return parts.join("\n");
}

// 每个类别一个「无依据会被删除」的触发句 + 用于「有依据则保留」的事实设置
const CASES = [
  { w: "保险", claim: "本次活动含高额意外险，出行更安心。", fact: (f, a) => { f.insurance = true; } },
  { w: "领队", claim: "专业领队全程带队，节奏更稳。", fact: (f, a) => { f.leader = "阿伟"; } },
  { w: "交通", claim: "大巴接送，集合点直达起点。", fact: (f, a) => { f.transport = "大巴"; } },
  { w: "餐食", claim: "含两顿正餐，营地火锅管够。", fact: (f, a) => { f.meal = "两正餐"; } },
  { w: "装备", claim: "免费提供登山杖与头盔。", fact: (f, a) => { f.gear = ["登山杖"]; } },
  { w: "住宿", claim: "当晚入住山间民宿。", fact: (f, a) => { f.lodging = true; } },
  { w: "天气", claim: "当天万里无云，视野极好。", fact: (f, a) => { a.actualWeather = "晴"; } },
  { w: "实际人数", claim: "实际参加 12 人，热闹非凡。", fact: (f, a) => { a.actualParticipants = 12; } },
  { w: "登顶", claim: "全员登顶，站在山顶俯瞰群峰。", fact: (f, a) => { a.completionSummary = "全员成功登顶"; } },
  { w: "完成路线", claim: "我们走完了全程，顺利收官。", fact: (f, a) => { a.completionSummary = "走完全程"; } },
  { w: "用户反馈", claim: "大家纷纷表示这趟太值了。", fact: (f, a) => { a.actualFeedback = ["好评"]; } },
  { w: "路线成熟度", claim: "路线非常成熟，老少皆宜。", fact: (f, a) => { f.routeMaturity = "成熟"; } },
  { w: "安全保障", claim: "全程安全保障，放心出行。", fact: (f, a) => { f.insurance = true; } }, // insurance 作为具体安全事实代理
  { w: "风景判断", claim: "风景绝美，美到窒息。", fact: (f, a) => { /* ok:false，永远删 */ } },
];

const checks = [];
function chk(name, pass, detail) { checks.push({ name: name, pass: !!pass, detail: detail || "" }); }
const claimNorm = (s) => norm(s);

// 1) 无依据 → 删除：每类单独构造 out，跑 stripUnsupportedClaims，断言 claim 文本消失且 removed 含该类别
CASES.forEach((c) => {
  const out = mkOut([c.claim]);
  const removed = stripUnsupportedClaims(out, {}, {});
  const gone = norm(allText(out)).indexOf(claimNorm(c.claim)) < 0;
  chk("删除-无依据-" + c.w, gone && removed.indexOf(c.w) >= 0,
    "removed=" + JSON.stringify(removed) + " 文本残留=" + (!gone));
});

// 2) 有依据 → 保留：设置事实后同句应保留（风景判断永远删，跳过）
CASES.forEach((c) => {
  if (c.w === "风景判断") return;
  const f = {}, a = {};
  c.fact(f, a);
  const out = mkOut([c.claim]);
  const removed = stripUnsupportedClaims(out, f, a);
  const kept = norm(allText(out)).indexOf(claimNorm(c.claim)) >= 0;
  chk("保留-有依据-" + c.w, kept && removed.indexOf(c.w) < 0,
    "removed=" + JSON.stringify(removed) + " 被误删=" + (!kept));
});

// 3) 住宿否定句「不含住宿」即使无事实也应保留（事实陈述，非无依据承诺）
{
  const out = mkOut(["活动不含住宿，需自行预订。"]);
  const removed = stripUnsupportedClaims(out, {}, {});
  const kept = norm(allText(out)).indexOf("活动不含住宿需自行预订") >= 0;
  chk("住宿-否定句保留", kept && removed.indexOf("住宿") < 0, "removed=" + JSON.stringify(removed));
}

// 4) 整合路径：qualityCheck 在删除后置 removed 且 flag=unsupported_removed
{
  state.xf = { quality: {} };
  const f = {}, a = {};
  const out = mkOut(CASES.map((c) => c.claim));
  qualityCheck(out, { family: "recruit", structure: ["a", "b", "c", "d"] }, "recruit", f, a);
  const q = state.xf.quality || {};
  const allRemoved = CASES.every((c) => q.removed && q.removed.indexOf(c.w) >= 0);
  chk("整合-qualityCheck-删除并报告", allRemoved && q.flag === "unsupported_removed",
    "flag=" + q.flag + " removed=" + JSON.stringify(q.removed));
}

// 5) 整合路径：有依据时不被删除（风景判断除外）
{
  state.xf = { quality: {} };
  const f = {}, a = {};
  f.insurance = true; f.leader = "阿伟"; f.transport = "大巴"; f.meal = "两正餐";
  f.gear = ["登山杖"]; f.lodging = true; f.routeMaturity = "成熟";
  a.actualWeather = "晴"; a.actualParticipants = 12;
  a.completionSummary = "全员成功登顶、走完全程"; a.actualFeedback = ["好评"];
  const out = mkOut(CASES.map((c) => c.claim));
  qualityCheck(out, { family: "recruit", structure: ["a", "b", "c", "d"] }, "recruit", f, a);
  const q = state.xf.quality || {};
  const noFalseDelete = CASES.filter((c) => c.w !== "风景判断").every((c) => q.removed.indexOf(c.w) < 0);
  chk("整合-有依据不误删", noFalseDelete && q.removed.indexOf("风景判断") >= 0,
    "removed=" + JSON.stringify(q.removed));
}

const passed = checks.filter((c) => c.pass).length;
return { ok: passed === checks.length, total: checks.length, passed: passed, checks: checks };
