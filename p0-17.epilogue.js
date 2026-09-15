// P0-17 冒烟：Recap 独立 actualActivityData（八字段结构化；报名人数 ≠ 实际参与人数；未确认实际人数禁止写"XX人参加"）
// 验收：
//   1) actualActivityData 是独立对象，含 8 字段（blankActivity 默认空）
//   2) 结构化 actualParticipants 优先于 notes 文本解析（真正"独立"）
//   3) 报名人数(registeredParticipants) 与实际人数(actualParticipants) 是独立字段，互不被当作对方
//   4) 未确认 actualParticipants：Fallback 回顾正文不出现任何"XX人参加 / 共X人 / 实际参加X人"
//   5) 已确认 actualParticipants：Fallback 回顾出现"实际参加 N 人"，且不与报名人数混淆
//   6) 质量检查 contentQuality：未确认实际人数时把"XX人参加"判为无依据；已确认时放行
//   7) actualActivityData 默认不确认天气/完成/人数（避免回退到虚构）

function mkAct(extra) {
  return Object.assign({
    id: "act-p17", title: "赵公山周末徒步", type: "徒步", place: "赵公山",
    date: "2026-10-02", dateMD: "10月2日", price: 168, days: 1, limit: 25, limitUnit: "人",
    difficulty: "中级", photos: [], signups: 0
  }, extra || {});
}
var RECAP_STRUCT = ["开场", "本次活动核心记忆", "本次参与体验", "值得记住的瞬间", "参与者收获", "照片回顾", "下一期预告"];
function mkDir() { return { structure: RECAP_STRUCT.slice(), angle: "赵公山徒步回顾" }; }
function allText(out) {
  var s = [];
  if (out.gzh) {
    s.push(out.gzh.title || "", out.gzh.summary || "");
    (out.gzh.sections || []).forEach(function (x) { s.push((x.h || "") + " " + (x.html || "").replace(/<[^>]+>/g, " ")); });
    s.push(out.gzh.next || "");
  }
  if (out.xhs) { s.push(out.xhs.titles.join(" "), out.xhs.body, out.xhs.coverText); }
  if (out.moments) s.push(out.moments);
  if (out.wechat) s.push(out.wechat);
  if (out.next) s.push(out.next);
  return s.join("\n");
}
// 任何形式的"实际到场人数"断言（不论用 参加/到场/实到/出席/共X人/实际参加X）
function hasAttendance(text) { return /(\d+)\s*(人|位|名)\s*(参加|到场|实到|出席)|共\s*\d+\s*人|实际参加\s*\d+/.test(text); }

var checks = [];
function check(pass, name, detail) { checks.push({ name: name, pass: !!pass, detail: detail || "" }); }

// --- 1) actualActivityData 是独立对象，含 8 字段（blankActivity 默认空）---
var blank = blankActivity();
var adKeys = blank.actualActivityData ? Object.keys(blank.actualActivityData).sort() : [];
var EXPECT = ["actualFeedback", "actualHighlights", "actualParticipants", "actualRouteChange", "actualWeather", "completionSummary", "memorableMoments", "registeredParticipants"].sort();
check(adKeys.length === 8 && EXPECT.every(function (k) { return adKeys.indexOf(k) >= 0; }),
  "actualActivityData 独立对象含 8 字段", "keys=" + adKeys.join(","));
check(blank.actualActivityData.actualParticipants == null && blank.actualActivityData.registeredParticipants == null,
  "actualActivityData 默认 actualParticipants/registeredParticipants 为空", "ok");

// --- 2) 结构化 actualParticipants 优先于 notes 文本解析（真正"独立"）---
var aStruct = mkAct({ actualActivityData: { actualParticipants: 8, registeredParticipants: 10 } });
var adS = extractActualActivityData(aStruct, "实际到场 20 人"); // notes 与结构化冲突，结构化应胜出
check(adS.actualParticipants === 8, "结构化 actualParticipants(8) 优先于 notes 解析(20)", "actual=" + adS.actualParticipants);
check(adS.registeredParticipants === 10, "结构化 registeredParticipants(10) 被采用", "registered=" + adS.registeredParticipants);

// --- 3) 报名人数 ≠ 实际人数：仅 signups 时，actualParticipants 必须保持 null（不可被当成实际）---
var aReg = mkAct({ signups: 10 }); // 只有报名人数，无实际确认
var adR = extractActualActivityData(aReg, "");
check(adR.registeredParticipants === 10 && adR.actualParticipants == null,
  "仅报名人数(signups=10)：registered=10 且 actualParticipants=null(未混淆)", JSON.stringify({ reg: adR.registeredParticipants, act: adR.actualParticipants }));

// --- 4) 未确认 actualParticipants：Fallback 回顾正文不出现任何参加人数断言 ---
var photos5 = ["p1.jpg", "p2.jpg", "p3.jpg", "p4.jpg", "p5.jpg"];
var mR = buildContentMaster(aReg, photos5);
var dir = mkDir();
var type = recapType(aReg, photos5);
var outR = fallbackRecapCopy(aReg, mR, dir, photos5, "", type, extractActualActivityData(aReg, ""));
var tR = allText(outR);
check(!hasAttendance(tR), "未确认实际人数：Fallback 回顾无\"XX人参加/共X人/实际参加X人\"", hasAttendance(tR) ? "FOUND attendance" : "absent");
// 质量检查在 adv.actualParticipants=null 时应把"12人参加"判为无依据
var fakeNull = { gzh: { title: "回顾", summary: "x", sections: [{ h: "a", html: "实际参加 12 人" }], next: "y" } };
var qNull = contentQuality(fakeNull, dir, "recap", mR.confirmedFacts, extractActualActivityData(aReg, ""));
check((qNull.flags || []).indexOf("unsupported:实际人数") >= 0,
  "质量检查：未确认实际人数时\"实际参加 12 人\"被判无依据", "flags=" + (qNull.flags || []).join(","));

// --- 5) 已确认 actualParticipants=8：Fallback 出现"实际参加 8 人"，且与报名(10)不混淆 ---
var aConf = mkAct({ actualActivityData: { actualParticipants: 8, registeredParticipants: 10 } });
var mC = buildContentMaster(aConf, photos5);
var outC = fallbackRecapCopy(aConf, mC, dir, photos5, "", type, extractActualActivityData(aConf, ""));
var tC = allText(outC);
check(tC.indexOf("实际参加 8 人") >= 0, "已确认实际人数：Fallback 出现\"实际参加 8 人\"", "present");
check(!/实际参加\s*10|10\s*人\s*参加|报名\s*8/.test(tC), "已确认实际人数：不与报名人数(10)混淆", "noConflation");
// 质量检查在 adv.actualParticipants=8 时应放行"实际参加 8 人"
var fakeConf = { gzh: { title: "回顾", summary: "x", sections: [{ h: "a", html: "实际参加 8 人" }], next: "y" } };
var qConf = contentQuality(fakeConf, dir, "recap", mC.confirmedFacts, extractActualActivityData(aConf, ""));
check((qConf.flags || []).indexOf("unsupported:实际人数") < 0,
  "质量检查：已确认实际人数(8)时\"实际参加 8 人\"放行", "flags=" + (qConf.flags || []).join(","));

// --- 6) 报名人数作为"报名"陈述不应被当成"参加"无依据（区分报名 vs 实际）---
var fakeReg = { gzh: { title: "回顾", summary: "x", sections: [{ h: "a", html: "本期报名 10 人" }], next: "y" } };
var qReg = contentQuality(fakeReg, dir, "recap", mR.confirmedFacts, extractActualActivityData(aReg, ""));
check((qReg.flags || []).indexOf("unsupported:实际人数") < 0,
  "质量检查：\"报名 10 人\"(非到场)不被误判为人数虚构", "flags=" + (qReg.flags || []).join(","));

// --- 7) actualActivityData 默认不确认天气/完成/人数（避免回退到虚构）---
var adDef = extractActualActivityData(mkAct({}), "");
check(!adDef.actualWeather && !adDef.completionSummary && adDef.actualParticipants == null,
  "actualActivityData 默认不确认天气/完成/人数", JSON.stringify({ w: adDef.actualWeather, c: adDef.completionSummary, p: adDef.actualParticipants }));

var allPass = checks.every(function (c) { return c.pass; });
return { ok: allPass, total: checks.length, passed: checks.filter(function (c) { return c.pass; }).length, checks: checks };
