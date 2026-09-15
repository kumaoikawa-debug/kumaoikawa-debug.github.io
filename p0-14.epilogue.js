// P0-14 冒烟：修正 Content Master 事实边界
// 验收：
//   1) creativeContext 只给表达方向，不含现场事实(星空/云海/溪流/营火…)，除非资料/图片确认
//   2) confirmedFacts 不因活动类型推断出现场事实（类型推断 ≠ 现场事实）
//   3) 活动类型推断(inferredContentKind)明确标记为推断、assertsScenes=false，绝不暗示具体景观
//   4) consumerValue 同样不含现场事实
//   5) 事实护栏 sanitizeCreativeContext 能把违规现场词剥离
//   6) gzhHighlight 不再把未确认景观词当已确认事实高亮（类型词仍高亮）

function mkAct(extra) {
  return Object.assign({
    id: "act-p14", title: "周末营地松弛一下", type: "露营", place: "莫干山",
    date: "2026-10-01", price: 299, days: 2, photos: []
  }, extra || {});
}

var checks = [];
function check(pass, name, detail) { checks.push({ name: name, pass: !!pass, detail: detail || "" }); }

// 1) 类型=露营、无照片、无确认景观 → 全字段不应含现场事实
var a = mkAct();
var m = buildContentMaster(a, []);
var ccStr = JSON.stringify(m.creativeContext);
var cfStr = JSON.stringify(m.confirmedFacts);
var cvStr = JSON.stringify(m.consumerValue);
check(!hasSceneClaim(ccStr), "creativeContext 不含现场事实", ccStr.slice(0, 90));
check(!hasSceneClaim(cfStr), "confirmedFacts 不含现场事实(类型推断泄漏)", cfStr.slice(0, 90));
check(!hasSceneClaim(cvStr), "consumerValue 不含现场事实", cvStr.slice(0, 90));

// 2) 类型推断明确标记，不是事实
check(m.creativeContext.inferredContentKind === "camp", "inferredContentKind=camp", "kind=" + m.creativeContext.inferredContentKind);
check(m.creativeContext.assertsScenes === false, "推断 assertsScenes=false", "");
check(m.creativeContext.isInference === true, "推断 isInference=true", "");
// confirmedFacts 里只有类型标签，没有把类型升级成具体景观
check(m.confirmedFacts.activityType === "露营", "confirmedFacts 仅含类型标签", "type=" + m.confirmedFacts.activityType);
check(!/星空|云海|溪流|营火|篝火/.test(m.confirmedFacts.activityType), "类型标签未被升级为景观", "");

// 3) 多种类型都不产生现场事实（类型推断 ≠ 现场事实）
["徒步", "登山", "溯溪", "摄影", "亲子", "桨板", "骑行"].forEach(function (t) {
  var mm = buildContentMaster(mkAct({ type: t }), []);
  var okAll = !hasSceneClaim(JSON.stringify(mm.creativeContext)) &&
    !hasSceneClaim(JSON.stringify(mm.confirmedFacts)) &&
    !hasSceneClaim(JSON.stringify(mm.consumerValue));
  check(okAll, "类型=" + t + " 全字段无现场事实", t);
});

// 4) 护栏：把违规现场词注入 creativeContext，必须被剥离
var dirty = {
  tone: "松弛", inferredContentKind: "camp", assertsScenes: false, isInference: true,
  angles: ["周末逃离城市，去营地松弛一下，看满天星空"],
  visualMoodHint: "不得凭空指定具体景观"
};
var res = sanitizeCreativeContext(dirty);
check(!hasSceneClaim(JSON.stringify(res.value)), "护栏剥离现场词(星空)", "after=" + JSON.stringify(res.value.angles));
check(res.stripped === true, "护栏标记 stripped=true", "");

// 5) gzhHighlight：未确认景观词不再高亮，活动类型词仍高亮
var hlScene = gzhHighlight("今晚有星空，溪流很凉", mkAct());
check(hlScene.indexOf("gzh-hl") < 0, "gzhHighlight 不再高亮未确认景观词", "");
var hlType = gzhHighlight("周末去露营最舒服", mkAct());
check(hlType.indexOf("gzh-hl") >= 0, "gzhHighlight 仍高亮活动类型词", "");

var allPass = checks.every(function (c) { return c.pass; });
return { ok: allPass, total: checks.length, passed: checks.filter(function (c) { return c.pass; }).length, checks: checks };
