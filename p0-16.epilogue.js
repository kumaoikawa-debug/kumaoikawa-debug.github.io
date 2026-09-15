// P0-16 冒烟：重写活动回顾 Fallback（只有照片、没有备注时只能做「照片现场记录」，不虚构故事）
// 验收：
//   1) Fallback 默认不生成「我们完成全程 / 大家玩得尽兴 / 有人说… / 合照那一刻 / 返程车上… / 当天下雨 / 大家互相照顾」
//   2) 只有照片、没有备注时：回顾只描述照片现场，绝不回显类型推断的 scenicValue/experienceValue/participationValue（那是招募视角）
//   3) 无照片、无备注时：回顾只留占位说明，不编造现场故事
//   4) 用户补充的 notes（actualActivityData 来源）才允许进入回顾正文
//   5) 质量检查 xfContentQuality 能捕获上述禁止故事断言（防御纵深）

function mkAct(extra) {
  return Object.assign({
    id: "act-p16", title: "赵公山周末徒步", type: "徒步", place: "赵公山",
    date: "2026-10-02", dateMD: "10月2日", price: 168, days: 1, limit: 25, limitUnit: "人",
    difficulty: "中级", photos: []
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

// P0-16 明确禁止的「未确认现场故事」断言
var BANNED = ["我们完成全程", "大家玩得尽兴", "玩得尽兴", "有人说", "合照那一刻", "返程车上", "当天下雨", "大家互相照顾", "互相照顾"];

var checks = [];
function check(pass, name, detail) { checks.push({ name: name, pass: !!pass, detail: detail || "" }); }

// --- 只有照片、没有备注：回顾只能做照片现场记录 ---
var a = mkAct({});
var photos5 = ["p1.jpg", "p2.jpg", "p3.jpg", "p4.jpg", "p5.jpg"];
var m = buildContentMaster(a, photos5);
var dir = mkDir();
var type = xfRecapType(a, photos5);
var out = xfFallbackRecap(a, m, dir, photos5, "", type, null);
var t = allText(out);
BANNED.forEach(function (w) {
  check(t.indexOf(w) < 0, "仅照片·无备注：Fallback 无禁止故事「" + w + "」", t.indexOf(w) < 0 ? "absent" : "FOUND");
});
// 照片现场记录必须出现（描述照片里实际存在的画面）
check(t.indexOf("现场照片") >= 0 || t.indexOf("现场共") >= 0, "仅照片·无备注：出现照片现场记录", "hasPhotoRecord");
// 绝不回显类型推断的价值判断（招募视角，非回顾事实）
check(t.indexOf(m.scenicValue) < 0, "仅照片·无备注：不回显 scenicValue(类型推断风景判断)", "scenicValue absent=" + (t.indexOf(m.scenicValue) < 0));
check(t.indexOf(m.experienceValue) < 0, "仅照片·无备注：不回显 experienceValue(类型推断体验判断)", "experienceValue absent=" + (t.indexOf(m.experienceValue) < 0));
check(t.indexOf(m.participationValue) < 0, "仅照片·无备注：不回显 participationValue(类型推断收获判断)", "participationValue absent=" + (t.indexOf(m.participationValue) < 0));
check(out.gzh.sections.length >= 5, "仅照片·无备注：结构完整(gzh.sections>=5)", "n=" + out.gzh.sections.length);

// --- 无照片、无备注：只留占位说明，不编造现场故事 ---
var m0 = buildContentMaster(a, []);
var out0 = xfFallbackRecap(a, m0, mkDir(), [], "", xfRecapType(a, []), null);
var t0 = allText(out0);
BANNED.forEach(function (w) {
  check(t0.indexOf(w) < 0, "无照片·无备注：Fallback 无禁止故事「" + w + "」", t0.indexOf(w) < 0 ? "absent" : "FOUND");
});
check(t0.indexOf("暂无现场照片") >= 0 || t0.indexOf("以现场照片与补充资料为准") >= 0, "无照片·无备注：只留占位说明(不虚构故事)", "hasPlaceholder");
check(t0.indexOf(m0.scenicValue) < 0 && t0.indexOf(m0.experienceValue) < 0 && t0.indexOf(m0.participationValue) < 0,
  "无照片·无备注：同样不回显类型推断价值判断", "noTypeInfer");

// --- 用户补充 notes（actualActivityData 来源）才允许进入回顾正文 ---
var notesTxt = "当天其实放晴了，小朋友第一次自己爬上来，大家最满意的是晚餐。";
var ad = xfActualActivityData(a, notesTxt);
var outN = xfFallbackRecap(a, m, mkDir(), photos5, notesTxt, type, ad);
var tN = allText(outN);
// 用户确认的现场（在 notes 里）应出现在「值得记住的瞬间」等节
check(tN.indexOf("小朋友第一次自己爬上来") >= 0, "有备注：用户确认现场(notes)进入回顾正文", "notes surfaced");
// 但即便有 notes，禁止故事断言仍不得自动出现（notes 里没有这些词时）
BANNED.forEach(function (w) {
  check(tN.indexOf(w) < 0, "有备注(无禁止词)：Fallback 仍无禁止故事「" + w + "」", tN.indexOf(w) < 0 ? "absent" : "FOUND");
});

// --- 质量检查能捕获禁止故事断言（防御纵深，覆盖 AI 路径与任何生成文本）---
var fakeOut = {
  gzh: { title: "回顾", summary: "x", sections: [{ h: "a", html: "我们完成全程，大家玩得尽兴" }], next: "y" },
  xhs: { body: "有人说合照那一刻，返程车上下雨了，大家互相照顾" }
};
var q = xfContentQuality(fakeOut, mkDir(), "recap", m.confirmedFacts, xfActualActivityData(a, ""));
check(q.fiction > 0, "质量检查捕获 P0-16 禁止故事断言", "fiction=" + q.fiction + " flags=" + (q.flags || []).join(","));

// --- actualActivityData 默认不确认天气/完成/人数（避免回退到虚构）---
var adDef = xfActualActivityData(a, "");
check(!adDef.actualWeather && !adDef.completionSummary && adDef.actualParticipants == null,
  "actualActivityData 默认不确认天气/完成/人数", JSON.stringify({ w: adDef.actualWeather, c: adDef.completionSummary, p: adDef.actualParticipants }));

var allPass = checks.every(function (c) { return c.pass; });
return { ok: allPass, total: checks.length, passed: checks.filter(function (c) { return c.pass; }).length, checks: checks };
