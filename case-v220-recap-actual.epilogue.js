/* case-v220-recap-actual —— 回顾渠道「现场素材」前后端字段契约
   背景（v220 真机走查发现的静默缺陷）：
     后端 recap 契约 `ActualActivityData = { attendance, weather, actualRoute, highlights[],
     feedbacks[], onSiteNotes[] }`（clubos-backend/src/content-engine/contracts/channels.ts），
     而前端 `extractActualActivityData()` 产出 `{ actualParticipants, actualWeather,
     actualHighlights[], actualFeedback[], memorableMoments[], completionSummary,
     actualRouteChange, providedNotes }` —— **字段名零交集**。
     后果：后端 `buildRecapInsight()` 读 `actual.highlights/feedbacks/onSiteNotes` 永远为空
     → evidence 空 → coreMemory/whyItMatters 空 → 回顾恒定「无现场素材」诚实空态，
     用户在后台填的实际人数/天气/亮点全部无效，**且不报错**（只表现为内容变薄）。
   修法：`v3ActualPayload()`（contentChannels.js）做字段桥接，v3ChannelBody 内接线。
   本契约锁死：① 字段名必须落在后端契约白名单内；② attendance 只取「实到」，禁止拿报名数顶替
   （P0-6 硬规则）；③ 无素材时不发 actual（保持后端诚实空态）。 */
var checks = [];
function add(name, pass, detail) { checks.push({ name: name, pass: !!pass, detail: detail || "" }); }

/* ---------- 0. 入口存在 ---------- */
add("v3ActualPayload 已定义", typeof v3ActualPayload === "function");
add("v3ChannelBody 已定义", typeof v3ChannelBody === "function");

/* ---------- 1. legacy 形状 → 后端契约字段名 ---------- */
var legacy = {
  registeredParticipants: 12,
  actualParticipants: 18,
  actualWeather: "晴，山脊风大",
  actualRouteChange: "因塌方绕行 1 公里",
  actualHighlights: ["全员登顶", "山脊视野极好"],
  actualFeedback: ["比想象中累但值得"],
  memorableMoments: ["大风里合影"],
  completionSummary: "18 人全员完成",
  providedNotes: "现场日照强，补水点只有一处"
};
var ap = v3ActualPayload(legacy) || {};
add("attendance ← actualParticipants（实到）", ap.attendance === 18, String(ap.attendance));
add("weather ← actualWeather", ap.weather === "晴，山脊风大", String(ap.weather));
add("actualRoute ← actualRouteChange", ap.actualRoute === "因塌方绕行 1 公里", String(ap.actualRoute));
add("highlights ← actualHighlights", Array.isArray(ap.highlights) && ap.highlights[0] === "全员登顶", JSON.stringify(ap.highlights));
add("feedbacks ← actualFeedback", Array.isArray(ap.feedbacks) && ap.feedbacks[0] === "比想象中累但值得", JSON.stringify(ap.feedbacks));
add("onSiteNotes 汇总 3 条（memorable+summary+notes）",
  Array.isArray(ap.onSiteNotes) && ap.onSiteNotes.length === 3, JSON.stringify(ap.onSiteNotes));

/* ---------- 2. 输出字段必须 ⊆ 后端契约（防再次漂移） ---------- */
var BACKEND_CONTRACT = ["attendance", "weather", "actualRoute", "highlights", "feedbacks", "onSiteNotes"];
var keys = Object.keys(ap);
add("输出 key 全部落在后端契约白名单内",
  keys.length > 0 && keys.every(function (k) { return BACKEND_CONTRACT.indexOf(k) >= 0; }), JSON.stringify(keys));
add("契约覆盖 ≥5 个字段（防「全被过滤却假通过」）", keys.length >= 5, String(keys.length));
add("不再泄漏 legacy 字段名",
  ap.actualParticipants === undefined && ap.actualHighlights === undefined && ap.actualWeather === undefined);

/* ---------- 3. P0-6 硬规则：报名数 ≠ 实到数 ---------- */
var onlyRegistered = v3ActualPayload({
  registeredParticipants: 12, actualParticipants: null, actualHighlights: ["x"]
});
add("未确认实到 → 不写 attendance（禁拿报名数顶替）",
  onlyRegistered && !("attendance" in onlyRegistered), JSON.stringify(onlyRegistered));

/* ---------- 4. 无素材 → null（保持诚实空态） ---------- */
add("只有报名数、无任何现场素材 → null",
  v3ActualPayload({ registeredParticipants: 12, actualParticipants: null }) === null);
add("空对象 → null", v3ActualPayload({}) === null);
add("null / undefined → null", v3ActualPayload(null) === null && v3ActualPayload(undefined) === null);
add("非对象 → null", v3ActualPayload("abc") === null && v3ActualPayload(5) === null);

/* ---------- 5. 已是后端契约形状 → 原样透传（幂等） ---------- */
var nativeShape = { attendance: 18, highlights: ["a"], feedbacks: [], onSiteNotes: [] };
add("已是契约形状 → 原样返回（幂等，不二次改写）", v3ActualPayload(nativeShape) === nativeShape);

/* ---------- 6. v3ChannelBody 接线：请求体只带契约形状 ---------- */
var act = { id: "a-1", title: "赵公山周末轻装徒步" };
var b1 = v3ChannelBody(act, {});
add("无 actual → 请求体不带 actual 字段", b1 && !("actual" in b1), JSON.stringify(Object.keys(b1 || {})));
var b2 = v3ChannelBody(act, { actual: { registeredParticipants: 12, actualParticipants: null } });
add("actual 无素材 → 请求体不带 actual（不污染后端）", b2 && !("actual" in b2));
var b3 = v3ChannelBody(act, { actual: legacy });
add("actual 有素材 → body.actual 为后端契约形状",
  b3 && b3.actual && b3.actual.attendance === 18 && b3.actual.actualParticipants === undefined,
  JSON.stringify(b3 && b3.actual));
add("body.activityId 仍正确（接线未破坏原有 body）", b3 && b3.activityId === "a-1", String(b3 && b3.activityId));

return { ok: checks.every(function (c) { return c.pass; }), total: checks.length, passed: checks.filter(function (c) { return c.pass; }).length, checks: checks };
