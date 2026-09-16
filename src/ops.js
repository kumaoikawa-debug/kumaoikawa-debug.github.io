/* =========================================================================
   ClubOS · 户外执行侧能力（v191）
   文档依据：《ClubOS v142+ 今日新增优化需求补充文档》第三 ~ 九节。

   覆盖：
     ① 领队端离线活动包（无网络可看）
     ② 活动安全执行资料（最小权限）
     ③ 保险自动化（建议险种 / 待投保名单 / 异常 / 状态回写）
     ④ 风险协议 / 电子签智能匹配（知道该签什么）
     ⑤ 户外阶梯退款 + 名额转让（自然语言配置）
     ⑥ AI 客户召回（按活动匹配历史客户并生成话术）
     ⑦ 长线 / 多日活动多套餐（自然语言 → 配置）

   原则：保险与电子签不自研底层 —— ClubOS 只做「匹配与整理」，
        实际投保 / 签署由第三方服务商完成（本模块预留回写接口）。
   ========================================================================= */

/* ------------------------- 基础 ------------------------- */

const OPS_INS_STATUS = {
  none: "未投保", pending: "投保中", insured: "已投保", failed: "投保失败",
  overage: "超龄", missing: "信息缺失", invalid: "身份证异常"
};
const OPS_INS_STATUS_CLS = {
  none: "warn", pending: "info", insured: "ok", failed: "bad", overage: "bad", missing: "warn", invalid: "bad"
};

function opsBlank() {
  return {
    vehicle: { plate: "", model: "", seats: null, count: null, driver: "", driverPhone: "" },
    emergency: { name: "", phone: "" },
    meetings: [],
    leaders: [],
    leaderGroups: [],
    safetyNotes: [],
    medical: [],
    insurance: { planId: "", provider: "", policyNo: "", status: "", updatedAt: 0 },
    agreements: {},
    refund: null,
    packages: null,
    recallSent: [],
    transferLog: [],
    packGeneratedAt: 0
  };
}
function opsEnsure(a) {
  if (!a.ops) a.ops = opsBlank();
  const o = a.ops;
  ["vehicle", "emergency", "insurance"].forEach((k) => { if (!o[k]) o[k] = opsBlank()[k]; });
  ["meetings", "leaders", "leaderGroups", "safetyNotes", "medical", "recallSent", "transferLog"].forEach((k) => { if (!Array.isArray(o[k])) o[k] = []; });
  if (!o.agreements) o.agreements = {};
  return o;
}
function opsText(a, v) { return (v === undefined || v === null) ? "" : String(v); }

/* ------------------------- ① 队员名单（离线包与保险共用） ------------------------- */

function opsInsStatusOf(s) {
  if (!s) return "none";
  if (s.insurance && s.insurance.status && OPS_INS_STATUS[s.insurance.status]) return s.insurance.status;
  return s.insured ? "insured" : "none";
}
function opsIdCardOf(s) { return (s && (s.idCard || (s.insurance && s.insurance.idCard))) || ""; }
function opsValidIdCard(id) {
  const v = String(id || "").trim().toUpperCase();
  if (!/^\d{17}[\dX]$/.test(v)) return false;
  const w = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const code = "10X98765432";
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += parseInt(v[i], 10) * w[i];
  return code[sum % 11] === v[17];
}
/* 年龄：儿童用 childAge；成人可选 age/birthYear */
function opsAgeOf(s) {
  if (s && s.childAge != null && s.childAge !== "") return econNum(s.childAge);
  if (s && s.age != null && s.age !== "") return econNum(s.age);
  if (s && s.birthYear) return new Date().getFullYear() - econNum(s.birthYear);
  return null;
}
function opsSignupsOf(a) { return (state.signups || []).filter((s) => s && s.activityId === (a && a.id)); }
/* 每行 = 一个人（儿童单独成行，便于保险与监护核对） */
function opsMemberRows(a) {
  const o = opsEnsure(a);
  const rows = [];
  opsSignupsOf(a).forEach((s) => {
    const ins = s.insurance || {};
    const base = {
      signupId: s.id, name: s.name || "—", phone: s.phone || "",
      emergencyName: s.emergencyName || o.emergency.name || "", emergencyPhone: s.emergencyPhone || o.emergency.phone || "",
      note: s.note || "", dietary: s.dietary || "", special: s.special || "",
      idCard: opsIdCardOf(s), status: opsInsStatusOf(s), policyNo: ins.policyNo || "",
      paid: !!s.paid, isChild: false, guardian: "", age: opsAgeOf(s)
    };
    rows.push(base);
    const n = econNum(s.children);
    for (let i = 0; i < n; i++) {
      rows.push({
        signupId: s.id, name: (i === 0 ? (s.childName || "随行儿童") : (s.childName ? s.childName + "（" + (i + 1) + "）" : "随行儿童 " + (i + 1))),
        phone: "", emergencyName: s.name || "", emergencyPhone: s.phone || "",
        note: s.note || "", dietary: s.dietary || "", special: s.special || "",
        idCard: "", status: opsInsStatusOf(s), policyNo: ins.policyNo || "",
        paid: !!s.paid, isChild: true, guardian: s.guardianName || s.name || "", age: s.childAge != null ? econNum(s.childAge) : null
      });
    }
  });
  const med = o.medical || [];
  rows.forEach((r) => {
    const hit = med.find((m) => m.signupId === r.signupId || (m.name && m.name === r.name));
    if (hit) { r.special = r.special || hit.text || ""; r.medical = hit.text || ""; }
  });
  return rows;
}

/* ------------------------- ② 领队分组 ------------------------- */

function opsLeadersOf(a) {
  const o = opsEnsure(a);
  if (o.leaders.length) return o.leaders;
  const ids = a.leaderIds || [];
  let name = a.leaderName || "";
  const cnt = Math.max(1, ids.length || (name ? 1 : 1));
  const out = [];
  for (let i = 0; i < cnt; i++) {
    out.push({ name: name || (ids[i] || ("领队" + (i + 1))), phone: "", id: ids[i] || ("L" + (i + 1)) });
  }
  return out;
}
/* 未手动分组时按人数均分（默认 1 名领队 → 全部） */
function opsBuildLeaderGroups(a) {
  const o = opsEnsure(a);
  if (o.leaderGroups.length) return o.leaderGroups;
  const leaders = opsLeadersOf(a);
  const rows = opsMemberRows(a);
  const groups = leaders.map((l) => ({ leader: l.name, phone: l.phone || "", id: l.id || l.name, members: [] }));
  rows.forEach((r, i) => { groups[i % groups.length].members.push({ name: r.name, phone: r.phone, isChild: r.isChild }); });
  return groups;
}

/* ------------------------- ③ 离线活动包（自包含 HTML） ------------------------- */

function opsItinerarySummary(a, maxLines) {
  const lim = maxLines || 8;
  const out = [];
  (a.itineraryDays || []).forEach((d) => {
    out.push((d.sub ? d.sub + " · " : "") + (d.label || ""));
    (d.items || []).slice(0, lim).forEach((it) => out.push((it.time ? it.time + " " : "") + (it.text || "")));
  });
  if (!out.length) out.push(a.intro ? String(a.intro).slice(0, 80) : "（未填写行程摘要）");
  return out.filter(Boolean);
}
function opsPackData(a) {
  const o = opsEnsure(a);
  const rows = opsMemberRows(a);
  const groups = opsBuildLeaderGroups(a);
  const d = econDateOf(a);
  return {
    title: a.title || "未命名活动",
    date: a.date || d.iso,
    place: a.place || "",
    route: a.route || a.place || "",
    meeting: a.meeting || (o.meetings[0] && o.meetings[0].place) || "",
    meetTime: a.meetTime || "",
    returnTime: a.returnTime || "",
    days: a.days || 1,
    difficulty: a.difficulty || "",
    elevation: a.elevation || "",
    phone: (state.brand && state.brand.phone) || "",
    contact: a.contact || "",
    emergency: o.emergency,
    vehicle: o.vehicle,
    itinerary: opsItinerarySummary(a),
    members: rows,
    headcount: opsSignupsOf(a).reduce((s2, x) => s2 + econNum(x.adults) + econNum(x.children), 0),
    groups: groups,
    safetyNotes: (o.safetyNotes || []).slice(),
    insurance: o.insurance,
    insuranceSummary: opsInsuranceSummary(a),
    altitude: opsAltitudeOf(a),
    generatedAt: new Date().toLocaleString("zh-CN")
  };
}
/* 离线包必须是自包含的：无外链、无图片请求、无脚本依赖 */
function buildLeaderPackHtml(a) {
  const p = opsPackData(a);
  const esc2 = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const ins = p.insuranceSummary;
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>领队离线活动包 · ${esc2(p.title)}</title>
<style>
*{box-sizing:border-box}
body{margin:0;padding:18px;font:14px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#1b1a17;background:#fbfaf7}
h1{font-size:19px;margin:0 0 2px}
h2{font-size:15px;margin:22px 0 8px;padding-bottom:6px;border-bottom:1px solid #e3ded4}
.sub{color:#7b7568;font-size:12px;margin-bottom:14px}
.card{border:1px solid #e3ded4;border-radius:10px;padding:12px 14px;background:#fff;margin-bottom:12px}
.kv{display:flex;gap:8px;padding:3px 0;font-size:13px}
.kv b{min-width:76px;color:#6b6558;font-weight:600}
.warn{border-color:#e6c9a8;background:#fdf6ee}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border-bottom:1px solid #ece7dd;padding:6px 6px;text-align:left;vertical-align:top}
th{color:#6b6558;font-weight:600;background:#faf8f4}
.tag{display:inline-block;padding:1px 7px;border-radius:99px;font-size:11px;border:1px solid #d8d2c6;color:#5d5749}
.tag.ok{border-color:#9dc4a8;color:#2f6b45}
.tag.warn{border-color:#e0bf87;color:#8a5b12}
.tag.bad{border-color:#e0a89a;color:#8e3a26}
ol,ul{margin:4px 0 4px 18px;padding:0}
.foot{color:#8b8577;font-size:11px;margin-top:18px}
@media print{body{background:#fff}}
</style></head>
<body>
<h1>${esc2(p.title)}</h1>
<div class="sub">${esc2(p.date)} · ${esc2(p.days)} 天 · ${esc2(p.difficulty)}${p.altitude ? " · 海拔 " + p.altitude + " 米" : ""}　｜　领队离线活动包（无网络可查）</div>

<div class="card warn">
  <div class="kv"><b>集合地点</b><span>${esc2(p.meeting || "待定")}</span></div>
  <div class="kv"><b>集合时间</b><span>${esc2(p.meetTime || "待定")}${p.returnTime ? "（预计 " + esc2(p.returnTime) + " 返回）" : ""}</span></div>
  <div class="kv"><b>路线摘要</b><span>${esc2(p.route || "待定")}</span></div>
  <div class="kv"><b>机构电话</b><span>${esc2(p.phone || "—")}</span></div>
  <div class="kv"><b>活动应急</b><span>${esc2(p.emergency.name || "—")} ${esc2(p.emergency.phone || "")}</span></div>
  ${p.contact ? `<div class="kv"><b>对接人</b><span>${esc2(p.contact)}</span></div>` : ""}
</div>

<h2>车辆信息</h2>
<div class="card">
  <div class="kv"><b>车牌</b><span>${esc2(p.vehicle.plate || "—")}</span></div>
  <div class="kv"><b>车型</b><span>${esc2(p.vehicle.model || "—")}${p.vehicle.seats ? " · " + p.vehicle.seats + " 座" : ""}${p.vehicle.count ? " × " + p.vehicle.count : ""}</span></div>
  <div class="kv"><b>司机</b><span>${esc2(p.vehicle.driver || "—")} ${esc2(p.vehicle.driverPhone || "")}</span></div>
</div>

<h2>保险状态（${ins.ok}/${ins.total} 已投保）</h2>
<div class="card">
  ${ins.problems.length ? `<ul>${ins.problems.map((x) => `<li>${esc2(x)}</li>`).join("")}</ul>` : `<div>全部成员保险状态正常。</div>`}
</div>

<h2>队员名单（${p.members.length} 条记录 · 共 ${p.headcount} 人）</h2>
<table><thead><tr><th>姓名</th><th>电话</th><th>紧急联系人</th><th>保险</th><th>备注</th></tr></thead><tbody>
${p.members.map((m) => `<tr>
  <td>${esc2(m.name)}${m.isChild ? ' <span class="tag">儿童' + (m.age != null ? " " + m.age + "岁" : "") + "</span>" : ""}${m.isChild && m.guardian ? `<div class="sub">监护人：${esc2(m.guardian)}</div>` : ""}</td>
  <td>${esc2(m.phone || "—")}</td>
  <td>${esc2(m.emergencyName || "—")}<div class="sub">${esc2(m.emergencyPhone || "")}</div></td>
  <td><span class="tag ${OPS_INS_STATUS_CLS[m.status] || ""}">${esc2(OPS_INS_STATUS[m.status] || m.status)}</span></td>
  <td>${esc2(m.note || "")}${m.dietary ? `<div class="sub">饮食：${esc2(m.dietary)}</div>` : ""}${m.special ? `<div class="sub">特殊：${esc2(m.special)}</div>` : ""}</td>
</tr>`).join("")}
</tbody></table>

<h2>领队分组</h2>
${p.groups.map((g) => `<div class="card">
  <div class="kv"><b>${esc2(g.leader)}</b><span>${esc2(g.phone || "")}　${g.members.length} 人</span></div>
  <div>${g.members.map((m) => esc2(m.name)).join("、")}</div>
</div>`).join("")}

<h2>行程摘要</h2>
<div class="card"><ol>${p.itinerary.map((t) => `<li>${esc2(t)}</li>`).join("")}</ol></div>

${p.safetyNotes.length ? `<h2>安全与特别提醒（仅执行人员）</h2>
<div class="card warn"><ul>${p.safetyNotes.map((t) => `<li>${esc2(t.text || t)}</li>`).join("")}</ul></div>` : ""}

<div class="foot">生成时间 ${esc2(p.generatedAt)}　｜　ClubOS 领队离线活动包 · 本文件已内联全部资料，飞行模式/无信号时可直接打开。</div>
</body></html>`;
}
function leaderPackFilename(a) {
  const d = econDateOf(a);
  return "领队离线活动包_" + String(a.title || "活动").replace(/[\\/:*?"<>|\s]/g, "").slice(0, 18) + "_" + (d.iso || "") + ".html";
}
function downloadLeaderPack(a) {
  const html = buildLeaderPackHtml(a);
  opsEnsure(a).packGeneratedAt = Date.now();
  saveState();
  try {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = leaderPackFilename(a);
    document.body.appendChild(link); link.click();
    setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 800);
    toast("离线活动包已下载，无网络也能打开");
  } catch (e) { toast("下载失败，请重试"); }
  return html;
}

/* ------------------------- ④ 安全执行资料（最小权限） ------------------------- */

/* viewer: {role:"owner"} | {role:"leader", leaderId} | {role:"staff"} */
function opsViewer() {
  return state.opsViewer || { role: "owner" };
}
function opsCanViewSafety(a, viewer) {
  const v = viewer || opsViewer();
  if (!v || v.role === "owner") return true;
  if (v.role !== "leader") return false;
  const ids = (a && a.leaderIds) || [];
  if (!ids.length || !v.leaderId) return false;
  return ids.indexOf(v.leaderId) >= 0;
}
/* 普通运营界面（活动列表、宣发等）一律脱敏：不展示特殊医疗/紧急联系人 */
function opsRedactActivity(a) {
  if (!a || !a.ops) return a;
  const copy = Object.assign({}, a);
  copy.ops = Object.assign({}, a.ops, { medical: [], safetyNotes: [], emergency: { name: "", phone: "" } });
  copy._opsRedacted = true;
  return copy;
}
function opsSafetyBriefing(a) {
  const o = opsEnsure(a);
  const rows = opsMemberRows(a);
  const ins = opsInsuranceSummary(a);
  return {
    emergency: o.emergency,
    notes: (o.safetyNotes || []).slice(),
    special: rows.filter((r) => r.special || r.dietary || r.note).map((r) => ({ name: r.name, note: r.note, dietary: r.dietary, special: r.special })),
    medical: (o.medical || []).slice(),
    minors: rows.filter((r) => r.isChild).map((r) => ({ name: r.name, age: r.age, guardian: r.guardian, emergencyPhone: r.emergencyPhone })),
    insurance: ins,
    highRisk: ["高海拔登山", "攀岩", "溯溪", "桨板或皮划艇", "滑雪"].indexOf(a.type) >= 0 || opsAltitudeOf(a) >= 2500
  };
}

/* ------------------------- ⑤ 保险自动化 ------------------------- */

function opsAltitudeOf(a) {
  if (!a) return 0;
  if (a.elevation && /^\d+/.test(String(a.elevation).trim())) return parseInt(String(a.elevation).trim(), 10);
  const s = String(a.elevation || "") + " " + String(a.title || "") + " " + String(a.intro || "");
  const m = s.match(/(\d{3,5})\s*米/);
  return m ? parseInt(m[1], 10) : 0;
}
const OPS_INS_PLANS = [
  { id: "outdoor_basic", name: "户外运动意外险（基础版）", perPerson: 8, cover: 30, maxAge: 65, why: "一日徒步/露营等常规户外活动的基础保障" },
  { id: "water_sport", name: "水上活动专项意外险", perPerson: 25, cover: 50, maxAge: 60, why: "涉及水域（溯溪/漂流/桨板/皮划艇）时的必要附加保障" },
  { id: "cycling", name: "骑行运动专项险", perPerson: 15, cover: 40, maxAge: 65, why: "骑行活动的第三方责任与意外医疗" },
  { id: "climbing", name: "攀岩攀冰专项险", perPerson: 30, cover: 60, maxAge: 60, why: "高空坠落与器材相关风险的专项条款" },
  { id: "ski", name: "滑雪运动专项险", perPerson: 20, cover: 50, maxAge: 60, why: "雪场运动的高发伤情专项保障" },
  { id: "high_altitude", name: "高海拔登山专项险", perPerson: 35, cover: 80, maxAge: 60, why: "海拔 2500 米以上，需覆盖高原病与直升机救援" },
  { id: "multiday_travel", name: "多日旅行综合险", perPerson: 20, cover: 50, maxAge: 70, why: "2 天及以上行程的住宿、行程取消等综合保障" },
  { id: "minor_addon", name: "未成年人附加保障", perPerson: 10, cover: 30, maxAge: 99, why: "未成年人需在监护责任条款下加保" }
];
function opsRiskProfile(a) {
  const alt = opsAltitudeOf(a);
  const type = String((a && a.type) || "");
  const title = String((a && a.title) || "");
  const isWater = /溯溪|桨板|皮划艇|漂流|溪降|玩水/.test(type + title);
  const days = econNum(a && a.days) || 1;
  const rows = opsMemberRows(a);
  const ages = rows.map((r) => r.age).filter((x) => x != null);
  const ageFrom = (a && a.ageFrom != null && a.ageFrom !== "") ? econNum(a.ageFrom) : 0;
  const hasMinor = rows.some((r) => r.isChild || (r.age != null && r.age < 18)) || (ageFrom > 0 && ageFrom < 18);
  const isHigh = alt >= 2500 || /高海拔登山|雪山|冰川/.test(type + title);
  const level = isHigh ? "高" : (isWater || /攀岩|滑雪|骑行/.test(type + title)) ? "中高" : (days >= 2 ? "中" : "低");
  return {
    altitude: alt, isWater: isWater, days: days, hasMinor: hasMinor, isHigh: isHigh,
    type: type, title: title,
    ages: ages, ageRange: ages.length ? Math.min.apply(null, ages) + " - " + Math.max.apply(null, ages) + " 岁" : (a && a.ageRange) || "",
    people: rows.length, level: level
  };
}
function opsRecommendInsurance(a) {
  const p = opsRiskProfile(a);
  const picked = [];
  const reasons = [];
  picked.push(OPS_INS_PLANS[0]);
  reasons.push("所有户外活动先配基础户外意外险");
  if (p.isWater) { picked.push(OPS_INS_PLANS[1]); reasons.push("涉及水域，需附加水上活动专项"); }
  if (/骑行/.test(p.type + p.title)) { picked.push(OPS_INS_PLANS[2]); reasons.push("骑行活动需骑行专项"); }
  if (/攀岩|攀冰|抱石/.test(p.type + p.title)) { picked.push(OPS_INS_PLANS[3]); reasons.push("攀岩/攀冰属高风险项目"); }
  if (/滑雪/.test(p.type + p.title)) { picked.push(OPS_INS_PLANS[4]); reasons.push("滑雪属高发伤情项目"); }
  if (p.isHigh) { picked.push(OPS_INS_PLANS[5]); reasons.push("海拔 " + (p.altitude || "2500 米以上") + "，需覆盖高原病与救援"); }
  if (p.days >= 2) { picked.push(OPS_INS_PLANS[6]); reasons.push("行程 " + p.days + " 天，需多日综合保障"); }
  if (p.hasMinor) { picked.push(OPS_INS_PLANS[7]); reasons.push("有未成年人参加，需监护人责任条款"); }
  const people = Math.max(1, p.people);
  const perPerson = picked.reduce((s, x) => s + x.perPerson, 0);
  return {
    profile: p, plans: picked, reasons: reasons, perPerson: perPerson,
    people: people, total: perPerson * people, level: p.level
  };
}
/* 待投保名单 + 异常（未投保 / 投保失败 / 超龄 / 信息缺失 / 身份证错误） */
function opsInsuranceRoster(a) {
  const rec = opsRecommendInsurance(a);
  const plan = rec.plans[rec.plans.length - 1] || rec.plans[0];
  const maxAge = rec.plans.reduce((m, x) => Math.min(m, x.maxAge), 99);
  const rows = opsMemberRows(a).map((r) => {
    let status = r.status, problem = "";
    if (r.age != null && r.age > maxAge) { status = "overage"; problem = "年龄 " + r.age + " 岁，超出建议方案上限 " + maxAge + " 岁"; }
    else if (r.idCard && !opsValidIdCard(r.idCard)) { status = "invalid"; problem = "身份证号校验不通过"; }
    else if (!r.name || r.name === "—" || (!r.phone && !r.isChild)) { status = "missing"; problem = "缺少姓名或联系电话"; }
    return Object.assign({}, r, { status: status, problem: problem });
  });
  const counts = { total: rows.length, insured: 0, none: 0, pending: 0, failed: 0, overage: 0, missing: 0, invalid: 0 };
  rows.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  const problems = rows.filter((r) => r.problem).map((r) => r.name + "：" + r.problem);
  rows.forEach((r) => {
    if (r.status === "none" && !r.problem) problems.push(r.name + "：尚未投保");
    if (r.status === "pending") problems.push(r.name + "：投保处理中");
  });
  return { rows: rows, counts: counts, problems: problems, plan: plan, perPerson: rec.perPerson, total: rec.perPerson * Math.max(1, rows.length) };
}
function opsInsuranceSummary(a) {
  const r = opsInsuranceRoster(a);
  return { total: r.counts.total, ok: r.counts.insured, problems: r.problems, counts: r.counts };
}
/* 第三方投保结果回写（服务商回调 / 手动同步） */
function opsInsuranceSyncFromProvider(a, payload) {
  const o = opsEnsure(a);
  const list = (payload && payload.members) || payload || [];
  let n = 0;
  list.forEach((m) => {
    const s = (state.signups || []).find((x) => x.id === (m.signupId || "")) || (state.signups || []).find((x) => x.name === m.name);
    if (!s) return;
    s.insurance = s.insurance || {};
    s.insurance.status = m.status || "insured";
    if (m.policyNo) s.insurance.policyNo = m.policyNo;
    s.insurance.updatedAt = Date.now();
    if (m.status === "insured") s.insured = true;
    n++;
  });
  if (payload && payload.policyNo) o.insurance.policyNo = payload.policyNo;
  o.insurance.updatedAt = Date.now();
  saveState();
  return { updated: n };
}
function opsApplyInsurancePlan(a) {
  const rec = opsRecommendInsurance(a);
  const o = opsEnsure(a);
  o.insurance.planId = rec.plans.map((p) => p.id).join("+");
  o.insurance.provider = "第三方保险服务商（待对接）";
  o.insurance.updatedAt = Date.now();
  saveState();
  return rec;
}

/* ------------------------- ⑥ 风险协议 / 电子签匹配 ------------------------- */

const OPS_AGREEMENT_DEFS = [
  { id: "outdoor_base", title: "户外活动风险告知书", signer: "本人", test: () => true, reason: "所有户外活动的基础风险告知" },
  { id: "high_altitude", title: "高海拔活动风险告知与承诺书", signer: "本人", test: (a, p) => p.isHigh, reason: "海拔 2500 米以上或雪山/冰川路线" },
  { id: "water", title: "水域活动风险告知书", signer: "本人", test: (a, p) => p.isWater, reason: "涉及溯溪/漂流/桨板/皮划艇等水域项目" },
  { id: "climbing", title: "攀岩攀冰专项风险告知", signer: "本人", test: (a, p) => /攀岩|攀冰|抱石/.test(p.type + p.title), reason: "高空与器材相关风险" },
  { id: "ski", title: "滑雪运动风险告知", signer: "本人", test: (a, p) => /滑雪|雪场/.test(p.type + p.title), reason: "雪场运动专项" },
  { id: "cycling", title: "骑行活动风险告知", signer: "本人", test: (a, p) => /骑行|单车|公路车/.test(p.type + p.title), reason: "道路骑行风险" },
  { id: "minor", title: "未成年人参加活动监护人知情同意书", signer: "监护人", test: (a, p) => p.hasMinor, reason: "有未成年人参加，须监护人签署" },
  { id: "multiday", title: "多日/长线活动补充告知", signer: "本人", test: (a, p) => p.days >= 2, reason: "行程 2 天及以上" }
];
function opsAgreements(a) {
  const p = opsRiskProfile(a);
  return OPS_AGREEMENT_DEFS.filter((d) => {
    try { return !!d.test(a, p); } catch (e) { return false; }
  }).map((d) => ({ id: d.id, title: d.title, signer: d.signer, reason: d.reason, required: true }));
}
function opsAgreementProgress(a) {
  const list = opsAgreements(a);
  const o = opsEnsure(a);
  const rows = list.map((x) => {
    const rec = o.agreements[x.id] || null;
    return Object.assign({}, x, { signed: !!(rec && rec.signedAt), signedAt: rec ? rec.signedAt : 0, method: rec ? rec.method : "", count: rec ? rec.count || 0 : 0 });
  });
  const signed = rows.filter((r) => r.signed).length;
  return { rows: rows, total: rows.length, signed: signed, pending: rows.length - signed, people: opsMemberRows(a).length };
}
/* 实际签署由第三方电子签完成，这里只记录「已完成签署」的事实 */
function opsAgreementMarkSigned(a, id, opts) {
  const o = opsEnsure(a);
  const def = opsAgreements(a).find((x) => x.id === id);
  if (!def) return { ok: false, message: "这场活动不需要签署该协议" };
  o.agreements[id] = {
    signedAt: Date.now(),
    method: (opts && opts.method) || "third_party_esign",
    provider: (opts && opts.provider) || "第三方电子签（待对接）",
    count: (opts && opts.count) || opsMemberRows(a).length
  };
  saveState();
  return { ok: true, agreement: o.agreements[id] };
}

/* ------------------------- ⑦ 阶梯退款 + 名额转让 ------------------------- */

const OPS_CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function opsCnToNum(s) {
  const t = String(s || "").trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (OPS_CN_NUM[t] != null) return OPS_CN_NUM[t];
  if (t === "半") return 0.5;
  return NaN;
}
/* 「3天前可退80%，一天内不退，可以转给别人」
   「出发前7天以上全额退款，3天内退50%，24小时内不退，不可转让」 */
function opsParseRefundPolicy(text) {
  const raw = String(text == null ? "" : text);
  const tiers = [];
  const push = (daysBefore, ratio, label) => {
    if (!isFinite(daysBefore)) return;
    const hit = tiers.find((t) => Math.abs(t.daysBefore - daysBefore) < 1e-9);
    if (hit) { hit.ratio = ratio; hit.label = label; return; }
    tiers.push({ daysBefore: daysBefore, ratio: ratio, label: label });
  };
  const numPat = "([0-9]+(?:\\.5)?|[一二两三四五六七八九十半])";
  /* 可退 N% */
  const re1 = new RegExp(numPat + "\\s*(天|小时|日)\\s*(?:前|以上|之外|以前|以内|内|之内)?\\s*(?:可|可以|予以)?\\s*退\\s*([0-9]{1,3})\\s*%", "g");
  let m;
  while ((m = re1.exec(raw))) {
    const n = opsCnToNum(m[1]);
    const days = m[2] === "小时" ? n / 24 : n;
    push(days, econNum(m[3]) / 100, "出发前 " + (m[2] === "小时" ? n + " 小时" : n + " 天") + "可退 " + m[3] + "%");
  }
  /* 不退 */
  const re2 = new RegExp(numPat + "\\s*(天|小时|日)\\s*(?:内|以内|之内|以下)\\s*(?:不|不予|不可)\\s*退", "g");
  while ((m = re2.exec(raw))) {
    const n = opsCnToNum(m[1]);
    const days = m[2] === "小时" ? n / 24 : n;
    push(days, 0, (m[2] === "小时" ? n + " 小时" : n + " 天") + "内不退");
  }
  if (/当天(?:取消)?不退|活动当天不退|出发当天不退/.test(raw)) push(0, 0, "活动当天不退");
  /* 全额退款优先按「出发前 X 天以上全额退」解析；没写天数才用 30 天保守取值 */
  const reFull = new RegExp(numPat + "\\s*(天|小时|日)\\s*(?:以上|前|以外|之外|以内|内)?\\s*(?:可|可以|予以)?\\s*全额退", "g");
  let hitFull = false;
  while ((m = reFull.exec(raw))) {
    const n = opsCnToNum(m[1]);
    const days = m[2] === "小时" ? n / 24 : n;
    push(days, 1, "出发前 " + (m[2] === "小时" ? n + " 小时" : n + " 天") + "以上全额退款");
    hitFull = true;
  }
  if (!hitFull && /全额退款|全退|全额退/.test(raw)) push(30, 1, "出发前 30 天以上全额退款");
  const transferable = /不可转让|不能转让|不允许转让|不可转名额/.test(raw) ? false
    : (/转让|转给别人|可转|转名额/.test(raw) ? true : null);
  tiers.sort((x, y) => y.daysBefore - x.daysBefore);
  return { tiers: tiers, transferable: transferable, source: raw.trim(), parsedAt: Date.now() };
}
function opsDefaultRefundPolicy(a) {
  return {
    tiers: [
      { daysBefore: 7, ratio: 1, label: "出发前 7 天以上全额退款" },
      { daysBefore: 3, ratio: 0.5, label: "出发前 3 - 7 天退 50%" },
      { daysBefore: 1, ratio: 0, label: "出发前 24 小时内不退" },
      { daysBefore: 0, ratio: 0, label: "活动当天不退" }
    ],
    transferable: true, source: "默认规则（户外常规）", parsedAt: 0
  };
}
function opsRefundPolicy(a) {
  const o = opsEnsure(a);
  if (o.refund && (o.refund.tiers || []).length) return o.refund;
  if (a && a.notes && /退/.test(a.notes)) {
    const p = opsParseRefundPolicy(a.notes);
    if (p.tiers.length) return p;
  }
  return opsDefaultRefundPolicy(a);
}
function opsRefundRateFor(a, daysBefore) {
  const pol = opsRefundPolicy(a);
  const hit = pol.tiers.filter((t) => daysBefore >= t.daysBefore).sort((x, y) => y.daysBefore - x.daysBefore)[0];
  return hit || { daysBefore: 0, ratio: 0, label: "不在退款范围内" };
}
function opsSaveRefundPolicy(a, text) {
  const p = opsParseRefundPolicy(text);
  if (!p.tiers.length) return { ok: false, message: "没读懂退款规则，试试「3天前可退80%，一天内不退，可以转给别人」" };
  const o = opsEnsure(a);
  o.refund = p;
  if (p.transferable === null) p.transferable = true;
  saveState();
  return { ok: true, policy: p };
}
/* 名额转让：保留已付金额，仅更换参加人 */
function opsTransferSlot(a, signupId, newName, newPhone) {
  const s = (state.signups || []).find((x) => x.id === signupId);
  if (!s) return { ok: false, message: "没找到这笔报名" };
  const pol = opsRefundPolicy(a);
  if (pol.transferable === false) return { ok: false, message: "这场活动不支持名额转让（按当前退款规则）" };
  const o = opsEnsure(a);
  const from = s.name;
  o.transferLog = o.transferLog || [];
  o.transferLog.push({ signupId: signupId, from: from, to: newName, phone: newPhone, at: Date.now(), amountKept: econNum(s.adults) * econNum(a.price) + econNum(s.children) * econNum(a.childPrice != null ? a.childPrice : a.price) });
  s.name = newName || s.name;
  if (newPhone) s.phone = newPhone;
  s.transferredFrom = from;
  saveState();
  return { ok: true, signup: s };
}

/* ------------------------- ⑧ AI 客户召回（活动级） ------------------------- */

function opsTypeWords(t) {
  return String(t || "").split(/[·、,，\s]/).filter(Boolean);
}
/* 客户索引：从报名记录自己聚合（不依赖其他模块的客户结构，保证字段稳定） */
function opsCustomerIndex() {
  const map = {};
  (state.signups || []).forEach((s) => {
    const k = s.phone || s.name || "";
    if (!k) return;
    const c = map[k] = map[k] || { key: k, name: s.name || "", phone: s.phone || "", activityIds: [], last: 0, people: 0, spent: 0 };
    if (s.name) c.name = s.name;
    if (s.phone) c.phone = s.phone;
    if (c.activityIds.indexOf(s.activityId) < 0) c.activityIds.push(s.activityId);
    if (s.createdAt && s.createdAt > c.last) c.last = s.createdAt;
    const pp = econNum(s.adults) + econNum(s.children);
    c.people += pp;
    const a = getActivity(s.activityId);
    c.spent += econNum(a && a.price) * pp;
  });
  return Object.keys(map).map((k) => map[k]);
}
/* 打分：类型匹配 / 路线地点匹配 / 强度匹配 / 久未参加 / 复购历史 */
function opsRecallCandidates(a, opts) {
  opts = opts || {};
  const minScore = opts.minScore != null ? opts.minScore : 4;
  const customers = opsCustomerIndex();
  const aWords = opsTypeWords(a.type).concat(opsTypeWords(a.place), opsTypeWords(a.route));
  const aDays = econNum(a.days) || 1;
  const now = Date.now(), DAY = 86400000;
  const out = [];
  customers.forEach((c) => {
    const acts = c.activityIds || [];
    if (acts.indexOf(a.id) >= 0) return; // 已经报过名，不需要召回
    const reasons = [];
    let score = 0;
    const types = {};
    acts.forEach((id) => {
      const x = getActivity(id);
      if (!x) return;
      opsTypeWords(x.type).forEach((w) => { types[w] = (types[w] || 0) + 1; });
    });
    const typeHit = Object.keys(types).filter((w) => aWords.indexOf(w) >= 0);
    if (typeHit.length) { score += 2; reasons.push("参加过 " + typeHit.join("/") + " 类活动 " + typeHit.reduce((s2, w) => s2 + types[w], 0) + " 次"); }
    const placeWords = opsTypeWords(a.place).concat(opsTypeWords(a.route));
    const placeHit = acts.filter((id) => {
      const x = getActivity(id);
      return x && placeWords.some((w) => w && (String(x.place || "").indexOf(w) >= 0 || String(x.route || "").indexOf(w) >= 0 || String(x.title || "").indexOf(w) >= 0));
    });
    if (placeHit.length) { score += 2; reasons.push("走过同一条线路/同一片区域 " + placeHit.length + " 次"); }
    const histDays = econMean(acts.map((id) => econNum((getActivity(id) || {}).days) || 1));
    if (histDays && Math.abs(histDays - aDays) <= 0.6) { score += 1; reasons.push("历史活动强度（" + (histDays % 1 ? histDays.toFixed(1) : histDays) + " 天）与本次活动接近"); }
    const inactiveDays = c.last ? Math.floor((now - c.last) / DAY) : null;
    if (inactiveDays != null && inactiveDays >= 90) { score += 2; reasons.push(inactiveDays + " 天没有参加活动"); }
    else if (inactiveDays != null && inactiveDays >= 60) { score += 1; reasons.push(inactiveDays + " 天没有参加活动"); }
    if (acts.length >= 2) { score += 1; reasons.push("已参加过 " + acts.length + " 场，是老客户"); }
    if (score >= minScore) {
      out.push({
        name: c.name || "—", phone: c.phone || "", acts: acts.length,
        inactiveDays: inactiveDays, score: score, reasons: reasons, spent: c.spent
      });
    }
  });
  return out.sort((x, y) => y.score - x.score);
}
function opsRecallMessage(a, c) {
  const d = econDateOf(a);
  const when = a.date || d.iso;
  const where = a.place || a.route || "";
  const priceTxt = a.price ? "¥" + econNum(a.price) + "/人" : "";
  const lead = (c.reasons && c.reasons.length) ? c.reasons[0] : "";
  return [
    c.name + "，好久不见！",
    "我们 " + when + " 有一场「" + (a.title || "") + "」" + (where ? "（" + where + "）" : "") + (priceTxt ? "，" + priceTxt : "") + "。",
    lead ? "看到你" + lead + "，这场应该挺合你的节奏。" : "觉得这场挺适合你。",
    "要给你留个名额吗？"
  ].join("");
}
function opsRecallMarkSent(a, keys) {
  const o = opsEnsure(a);
  o.recallSent = o.recallSent || [];
  (keys || []).forEach((k) => { if (o.recallSent.indexOf(k) < 0) o.recallSent.push(k); });
  saveState();
  return o.recallSent;
}

/* ------------------------- ⑨ 长线 / 多日多套餐（自然语言 → 配置） ------------------------- */

function opsParsePackageText(text) {
  const raw = String(text == null ? "" : text);
  const out = { days: 1, base: { price: null, note: "" }, rooms: [], transport: [], extras: [], meetings: [], leaders: [], source: raw.trim(), parsedAt: Date.now() };
  const dm = raw.match(/(\d+)\s*天/);
  if (dm) out.days = parseInt(dm[1], 10);
  const bp = raw.match(/基础价\s*(?:¥|￥)?\s*(\d+)/) || raw.match(/(?:¥|￥)\s*(\d+)\s*(?:的)?基础/) || raw.match(/基础\s*(?:套餐)?\s*(?:¥|￥)?\s*(\d+)/);
  if (bp) out.base.price = parseInt(bp[1], 10);
  else {
    const any = raw.match(/(?:¥|￥)\s*(\d+)/) || raw.match(/(\d{3,5})\s*(?:元|块)/);
    if (any) out.base.price = parseInt(any[1], 10);
  }
  /* 单房差 → 房型 */
  const sd = raw.match(/单房差\s*(?:¥|￥)?\s*(\d+)/);
  if (sd) out.rooms.push({ name: "单房", delta: parseInt(sd[1], 10), included: false, note: "单房差" });
  if (/双人间|标间|双标|双床/.test(raw)) out.rooms.unshift({ name: "双人间", delta: 0, included: true, note: "基础房型，已含" });
  const roomPlus = raw.match(/(\S{0,4}?(?:间|房|房型|帐篷|营位))\s*(?:加|＋|\+)\s*(?:¥|￥)?\s*(\d+)/);
  if (roomPlus) out.rooms.push({ name: roomPlus[1].replace(/(加|＋|\+)/, ""), delta: parseInt(roomPlus[2], 10), included: false });
  /* 交通：包含 / 减价 */
  const segs = raw.split(/[，,。;；\n、]+/).map((s) => s.trim()).filter(Boolean);
  segs.forEach((seg) => {
    const inc = seg.match(/^(.*?)(?:包含|已含|含)$/) || (/(?:包含|已含|含)/.test(seg) ? [seg, seg.replace(/(?:包含|已含|含)/, "")] : null);
    if (inc && inc[1] && !/基础价/.test(seg)) {
      const nm = String(inc[1]).trim();
      if (/大巴|包车|车|交通|机票|高铁|自驾|中巴|商务车/.test(nm)) {
        out.transport.push({ name: nm, delta: 0, included: true });
        return;
      }
    }
    const neg = seg.match(/(\S{1,10}?)\s*(?:减|少|便宜)\s*(?:¥|￥)?\s*(\d+)/);
    if (neg) {
      const nm = String(neg[1]).replace(/^(含|含了|其中)/, "").trim();
      const item = { name: nm, delta: -parseInt(neg[2], 10), included: false };
      if (/自驾|车|机票|高铁|交通|房|餐|住/.test(nm)) (/(房|住|间|营位|帐篷)/.test(nm) ? out.rooms : out.transport).push(item);
      else out.extras.push(item);
      return;
    }
    const plus = seg.match(/(\S{1,10}?)\s*(?:加|＋|\+)\s*(?:¥|￥)?\s*(\d+)/);
    if (plus) {
      const nm = String(plus[1]).replace(/^(含|含了|其中|单人)/, "").trim();
      out.extras.push({ name: nm || "附加项目", delta: parseInt(plus[2], 10), included: false });
      return;
    }
    const mt = seg.match(/^(.{1,8}?)(?:集合|出发集合)/);
    if (mt) { out.meetings.push({ place: mt[1].trim() }); return; }
    const ld = seg.match(/(?:共|配备|带)?\s*(\d+|[一二两三四五六七八九十]+)\s*(?:名|个|位)?\s*领队/);
    if (ld) { out.leaders.push({ name: "领队", count: opsCnToNum(ld[1]) || 1 }); }
  });
  /* 分段集合（逗号分隔的多集合点） */
  const meetSeg = segs.find((s) => /集合/.test(s) && /、|和|\//.test(s));
  if (meetSeg) {
    meetSeg.replace(/([^、和\/\s集合]+)(?=集合)/g, (all, p) => { out.meetings.push({ place: p }); return all; });
  }
  if (!out.meetings.length && /成都|市区|地铁/.test(raw) && /集合/.test(raw)) out.meetings.push({ place: raw.match(/([\u4e00-\u9fa5]{2,8})集合/)[1] });
  if (out.days >= 2 && !out.rooms.length) out.rooms.push({ name: "标准间", delta: 0, included: true, note: "默认房型" });
  return out;
}
function opsSavePackages(a, pkg) {
  const o = opsEnsure(a);
  o.packages = pkg;
  if (pkg.days && pkg.days !== a.days) a.days = pkg.days;
  saveState();
  return o.packages;
}
function opsPackagePrice(pkg) {
  if (!pkg) return { base: 0, options: [] };
  const base = econNum(pkg.base && pkg.base.price);
  const options = []
    .concat((pkg.rooms || []).filter((x) => !x.included).map((x) => ({ group: "住宿", name: x.name, delta: econNum(x.delta) })))
    .concat((pkg.transport || []).filter((x) => !x.included).map((x) => ({ group: "交通", name: x.name, delta: econNum(x.delta) })))
    .concat((pkg.extras || []).map((x) => ({ group: "附加", name: x.name, delta: econNum(x.delta) })));
  const included = { rooms: (pkg.rooms || []).filter((x) => x.included), transport: (pkg.transport || []).filter((x) => x.included) };
  return { base: base, options: options, included: included };
}

/* ------------------------- ⑩ 汇总：出发前准备状态 ------------------------- */

function opsPrepStatus(a) {
  const ins = opsInsuranceSummary(a);
  const ag = opsAgreementProgress(a);
  const o = opsEnsure(a);
  const d = econDateOf(a);
  const daysLeft = Math.ceil((d.ts - Date.now()) / 86400000);
  const issues = [];
  if (!a.meeting || !a.meetTime) issues.push("集合地点或时间未填写");
  if (!o.vehicle.plate && !o.vehicle.model) issues.push("车辆信息未填写");
  if (!o.emergency.name || !o.emergency.phone) issues.push("活动应急联系人不完整");
  if (ins.counts.none > 0) issues.push(ins.counts.none + " 人未投保");
  if (ins.counts.failed > 0) issues.push(ins.counts.failed + " 人投保失败");
  if (ins.counts.overage > 0) issues.push(ins.counts.overage + " 人超龄需换方案");
  if (ins.counts.invalid > 0) issues.push(ins.counts.invalid + " 人身份证号异常");
  if (ag.pending > 0) issues.push(ag.pending + " 份风险协议待签");
  return { daysLeft: daysLeft, issues: issues, insurance: ins, agreements: ag, ready: issues.length === 0 };
}

/* ------------------------- ⑪ 视图：出发前准备 ------------------------- */

function opsStatusTag(st) {
  return `<span class="ops-tag ops-tag-${esc(OPS_INS_STATUS_CLS[st] || "info")}">${esc(OPS_INS_STATUS[st] || st)}</span>`;
}
function renderPrep(a) {
  if (!a) return `<div class="empty">活动不存在。</div>`;
  const o = opsEnsure(a);
  const st = opsPrepStatus(a);
  const canSeeSafety = opsCanViewSafety(a);
  const brief = opsSafetyBriefing(a);
  const rec = opsRecommendInsurance(a);
  const roster = opsInsuranceRoster(a);
  const ag = opsAgreementProgress(a);
  const pol = opsRefundPolicy(a);
  const pkg = o.packages;
  const pkgPrice = pkg ? opsPackagePrice(pkg) : null;
  const recall = opsRecallCandidates(a);
  const sent = o.recallSent || [];
  const d = econDateOf(a);
  const mode = state._refundMode || "view";
  return `
  <div class="section-head">
    <div><div class="section-title">出发前准备 · ${esc(a.title || "未命名活动")}</div>
      <div class="muted small">${esc(a.date || d.iso)}　${esc(a.place || "")}　${st.daysLeft >= 0 ? "距出发 " + st.daysLeft + " 天" : "已结束"}　·　${st.ready ? "资料已齐" : st.issues.length + " 项待处理"}</div></div>
    <button class="btn btn-ghost btn-sm" data-action="openActivityPage" data-id="${esc(a.id)}">${ICON("arrow-left")} 返回活动详情</button>
  </div>
  ${!st.ready ? `<div class="ops-issues"><b>${ICON("x-circle")} 出发前待办</b><ul>${st.issues.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : `<div class="ops-ready">${ICON("check")} 出发前资料已齐备</div>`}

  <div class="ops-card">
    <div class="ops-card-h"><div class="ops-card-t">${ICON("download")} 领队离线活动包</div>
      <button class="btn btn-primary btn-sm" data-action="downloadLeaderPack" data-id="${esc(a.id)}">下载离线包（.html）</button></div>
    <div class="muted small">山区、高原、营地常常没有信号。离线包把这场活动全部关键执行资料内联在一个文件里，下载后<strong>无网络也能打开</strong>。</div>
    <div class="ops-chips">${["活动名称/日期/集合", "行程摘要", "队员名单+电话", "紧急联系人", "保险状态", "未成年人监护", "车辆信息", "领队分组", "路线摘要", "应急联系人"].map((x) => `<span class="ops-chip">${ICON("check")} ${esc(x)}</span>`).join("")}</div>
    <div class="tiny muted">${o.packGeneratedAt ? "上次生成：" + new Date(o.packGeneratedAt).toLocaleString("zh-CN") : "尚未生成过（下载时会重新生成最新版本）"}　·　共 ${opsMemberRows(a).length} 人</div>
  </div>

  <div class="ops-card">
    <div class="ops-card-h"><div class="ops-card-t">${ICON("shield")} 活动安全执行资料</div>
      <span class="ops-tag ops-tag-info">最小权限：仅执行人员可见</span></div>
    ${canSeeSafety ? `
      <div class="ops-kv"><b>活动应急联系人</b><span>${esc(o.emergency.name || "未填写")} ${esc(o.emergency.phone || "")}</span></div>
      <div class="ops-kv"><b>高风险活动</b><span>${brief.highRisk ? "是 —— 需额外确认（见风险协议）" : "否"}</span></div>
      <div class="ops-sub">特殊事项（用户主动填写）</div>
      ${brief.special.length ? `<ul class="ops-list">${brief.special.map((x) => `<li><b>${esc(x.name)}</b>${x.note ? " · " + esc(x.note) : ""}${x.dietary ? " · 饮食：" + esc(x.dietary) : ""}${x.special ? " · " + esc(x.special) : ""}</li>`).join("")}</ul>` : `<div class="tiny muted">暂无</div>`}
      <div class="ops-sub">未成年人监护信息</div>
      ${brief.minors.length ? `<ul class="ops-list">${brief.minors.map((x) => `<li><b>${esc(x.name)}</b>${x.age != null ? " · " + x.age + " 岁" : ""}　监护人：${esc(x.guardian || "—")}　紧急电话：${esc(x.emergencyPhone || "—")}</li>`).join("")}</ul>` : `<div class="tiny muted">本场没有未成年参加者</div>`}
      <div class="tiny muted">活动结束后，这些资料不会出现在普通运营界面（活动列表、宣发中心一律脱敏）。</div>
    ` : `<div class="ops-locked">${ICON("eye-off")} 你不是本场活动的执行领队，无法查看安全资料。</div>`}
  </div>

  <div class="ops-card">
    <div class="ops-card-h"><div class="ops-card-t">${ICON("shield")} 保险</div>
      <button class="btn btn-soft btn-sm" data-action="applyInsurancePlan" data-id="${esc(a.id)}">按推荐方案配置</button></div>
    <div class="ops-kv"><b>风险画像</b><span>${esc(rec.profile.type || "—")}　风险等级 <b>${esc(rec.level)}</b>${rec.profile.altitude ? "　海拔 " + rec.profile.altitude + " 米" : ""}${rec.profile.days > 1 ? "　" + rec.profile.days + " 天" : ""}${rec.profile.hasMinor ? "　有未成年人" : ""}</span></div>
    <div class="ops-sub">建议配置</div>
    <ul class="ops-list">${rec.plans.map((p) => `<li><b>${esc(p.name)}</b>（¥${p.perPerson}/人）· ${esc(p.why)}</li>`).join("")}</ul>
    <div class="tiny muted">合计约 ${econMoney(rec.total)}（${rec.people} 人 × ¥${rec.perPerson}）· 实际投保由第三方保险服务商完成，ClubOS 只做匹配与状态回写。</div>
    <div class="ops-sub">待投保名单与异常</div>
    ${roster.rows.length ? `<table class="ops-tbl"><thead><tr><th>姓名</th><th>保险状态</th><th>问题</th></tr></thead><tbody>
      ${roster.rows.map((r) => `<tr><td>${esc(r.name)}${r.isChild ? " · 儿童" : ""}</td><td>${opsStatusTag(r.status)}</td><td class="muted">${esc(r.problem || "—")}</td></tr>`).join("")}
    </tbody></table>` : `<div class="tiny muted">还没有报名，报名结束后会自动生成待投保名单。</div>`}
    ${roster.problems.length ? `<div class="ops-issues small"><b>需要处理</b><ul>${roster.problems.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    <div class="ops-actions"><button class="btn btn-ghost btn-sm" data-action="insuranceSync" data-id="${esc(a.id)}">同步投保结果（对接第三方回调）</button></div>
  </div>

  <div class="ops-card">
    <div class="ops-card-h"><div class="ops-card-t">${ICON("clipboard")} 风险协议 / 电子签</div>
      <span class="muted small">已签 ${ag.signed}/${ag.total}</span></div>
    <div class="muted small">ClubOS 不自己造电子签 —— 它负责判断<strong>这场活动应该签什么</strong>，实际签署交给专业电子签服务。</div>
    <table class="ops-tbl"><thead><tr><th>协议</th><th>签署人</th><th>为什么需要</th><th>状态</th></tr></thead><tbody>
      ${ag.rows.map((r) => `<tr><td>${esc(r.title)}</td><td>${esc(r.signer)}</td><td class="muted">${esc(r.reason)}</td>
        <td>${r.signed ? `<span class="ops-tag ops-tag-ok">已签 ${r.count} 人</span>` : `<button class="btn btn-ghost btn-xs" data-action="agreementSign" data-id="${esc(a.id)}" data-ag="${esc(r.id)}">标记已完成签署</button>`}</td></tr>`).join("")}
    </tbody></table>
  </div>

  <div class="ops-card">
    <div class="ops-card-h"><div class="ops-card-t">${ICON("refresh")} 退款与名额转让</div>
      <button class="btn btn-ghost btn-sm" data-action="refundEdit" data-id="${esc(a.id)}">${mode === "edit" ? "取消" : "一句话改规则"}</button></div>
    <table class="ops-tbl"><thead><tr><th>取消时间</th><th>退款比例</th></tr></thead><tbody>
      ${pol.tiers.map((t) => `<tr><td>${esc(t.label || ("出发前 " + t.daysBefore + " 天"))}</td><td>${econPct(t.ratio)}</td></tr>`).join("")}
    </tbody></table>
    <div class="ops-kv"><b>名额转让</b><span>${pol.transferable === false ? "不允许" : "允许（活动开始前可转让，已付款项保留）"}</span></div>
    <div class="tiny muted">规则来源：${esc(pol.source || "默认")}</div>
    ${mode === "edit" ? `<div class="ops-actions">
      <input class="input" id="refundPolicyInput" placeholder="例如：3天前可退80%，一天内不退，可以转给别人" value="${esc(a.notes || "")}">
      <button class="btn btn-primary btn-sm" data-action="refundParse" data-id="${esc(a.id)}">${ICON("sparkles")} 生成规则</button>
    </div>` : ""}
  </div>

  <div class="ops-card">
    <div class="ops-card-h"><div class="ops-card-t">${ICON("users")} AI 客户召回</div>
      <span class="muted small">匹配到 ${recall.length} 位老客户</span></div>
    <div class="muted small">系统按「历史活动类型 / 强度 / 线路」与「最近参与时间」自动找人，并生成召回话术。你只需要确认是否触达。</div>
    ${recall.length ? `<table class="ops-tbl"><thead><tr><th>客户</th><th>匹配理由</th><th>召回话术</th><th></th></tr></thead><tbody>
      ${recall.slice(0, 8).map((c) => `<tr>
        <td><b>${esc(c.name)}</b><div class="tiny muted">${esc(c.phone || "—")}</div></td>
        <td class="muted">${c.reasons.map((r) => esc(r)).join("<br>")}</td>
        <td class="ops-msg">${esc(opsRecallMessage(a, c))}</td>
        <td>${sent.indexOf(c.phone || c.name) >= 0 ? `<span class="ops-tag ops-tag-ok">已触达</span>` : `<button class="btn btn-ghost btn-xs" data-action="recallSend" data-id="${esc(a.id)}" data-key="${esc(c.phone || c.name)}">确认触达</button>`}</td>
      </tr>`).join("")}
    </tbody></table>` : `<div class="tiny muted">暂无匹配的历史客户（或报名记录还太少）。</div>`}
  </div>

  <div class="ops-card">
    <div class="ops-card-h"><div class="ops-card-t">${ICON("map")} 长线 / 多日套餐</div>
      ${a.days > 1 ? `<span class="ops-tag ops-tag-info">${a.days} 天</span>` : ""}</div>
    <div class="muted small">不用建 SKU。把这句话直接说给我，AI 拆成套餐配置。</div>
    <div class="ops-actions">
      <input class="input" id="pkgInput" placeholder="例如：四姑娘山3天，基础价1980，双人间，单房差600，成都大巴包含，自驾减200">
      <button class="btn btn-primary btn-sm" data-action="pkgParse" data-id="${esc(a.id)}">${ICON("sparkles")} 拆解套餐</button>
    </div>
    ${pkg ? `<div class="ops-pkg">
      <div class="ops-pkg-base">基础套餐 ${econMoney(pkgPrice.base)}${pkg.days > 1 ? ` · ${pkg.days} 天` : ""}</div>
      ${pkgPrice.included.rooms.length || pkgPrice.included.transport.length ? `<div class="ops-pkg-row"><b>已包含</b><span>${pkgPrice.included.rooms.map((x) => esc(x.name)).concat(pkgPrice.included.transport.map((x) => esc(x.name))).join("、")}</span></div>` : ""}
      ${pkgPrice.options.map((x) => `<div class="ops-pkg-row"><b>${esc(x.group)}</b><span>${esc(x.name)} ${x.delta >= 0 ? "+" : "-"}${econMoney(Math.abs(x.delta)).replace("¥", "¥")}</span></div>`).join("")}
      ${pkg.meetings.length ? `<div class="ops-pkg-row"><b>集合点</b><span>${pkg.meetings.map((x) => esc(x.place)).join("、")}</span></div>` : ""}
      ${pkg.leaders.length ? `<div class="ops-pkg-row"><b>领队</b><span>${pkg.leaders.map((x) => esc(x.name) + " × " + x.count).join("、")}</span></div>` : ""}
    </div>` : ""}
  </div>`;
}

/* 活动详情页里的紧凑摘要（不必进详情就能看见待办） */
function renderPrepSummary(a) {
  const st = opsPrepStatus(a);
  const n = opsMemberRows(a).length;
  return `<div class="ops-card ops-prep-sum">
    <div class="ops-card-h">
      <div class="ops-card-t">${ICON("compass")} 出发前准备</div>
      <div>
        <button class="btn btn-ghost btn-sm" data-action="downloadLeaderPack" data-id="${esc(a.id)}">${ICON("download")} 领队离线包</button>
        <button class="btn btn-soft btn-sm" data-action="openPrep" data-id="${esc(a.id)}">出发前准备详情</button>
      </div>
    </div>
    <div class="ops-prep-grid">
      <div>${ICON("shield")} 保险 <b>${st.insurance.ok}/${st.insurance.total}</b> 已投保${st.insurance.problems.length ? `　<span class="ops-tag ops-tag-warn">${st.insurance.problems.length} 项异常</span>` : ""}</div>
      <div>${ICON("clipboard")} 风险协议 <b>${st.agreements.signed}/${st.agreements.total}</b> 已签</div>
      <div>${ICON("users")} 队员 <b>${n}</b> 人</div>
      <div>${ICON("map")} ${a.days > 1 ? `<b>${a.days}</b> 天长线` : "一日活动"}</div>
    </div>
    <div class="tiny muted">${st.issues.length ? "待处理：" + st.issues.map((x) => esc(x)).join("；") : ICON("check") + " 出发前资料已齐"}</div>
  </div>`;
}

/* ------------------------- ⑫ 事件接线 ------------------------- */

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const act = btn.getAttribute("data-action");
  const aid = btn.getAttribute("data-id");
  const a = aid ? getActivity(aid) : null;
  switch (act) {
    case "downloadLeaderPack": {
      if (!a) { toast("活动不存在"); break; }
      downloadLeaderPack(a);
      showView("prep", { id: a.id });
      break;
    }
    case "applyInsurancePlan": {
      if (!a) break;
      const rec = opsApplyInsurancePlan(a);
      toast("已按推荐方案记录：" + rec.plans.map((p) => p.name).join(" + ") + "（实际投保交给第三方服务商）");
      showView("prep", { id: a.id });
      break;
    }
    case "insuranceSync": {
      if (!a) break;
      const rows = opsMemberRows(a).filter((r) => !r.isChild).map((r) => ({ signupId: r.signupId, status: "insured", name: r.name }));
      const res = opsInsuranceSyncFromProvider(a, { members: rows, policyNo: "TP" + Date.now().toString().slice(-8) });
      toast("已回写 " + res.updated + " 人的投保状态（模拟第三方回调）");
      showView("prep", { id: a.id });
      break;
    }
    case "agreementSign": {
      if (!a) break;
      const res = opsAgreementMarkSigned(a, btn.getAttribute("data-ag"));
      toast(res.ok ? "已记录签署完成（实际签署由第三方电子签完成）" : res.message);
      showView("prep", { id: a.id });
      break;
    }
    case "refundEdit": {
      state._refundMode = (state._refundMode === "edit") ? "view" : "edit";
      showView("prep", { id: aid });
      break;
    }
    case "refundParse": {
      if (!a) break;
      const inp = document.getElementById("refundPolicyInput");
      const res = opsSaveRefundPolicy(a, (inp && inp.value) || "");
      if (!res.ok) { toast(res.message); break; }
      state._refundMode = "view";
      toast("退款规则已生成：" + res.policy.tiers.map((t) => t.label + " " + econPct(t.ratio)).join("｜") + (res.policy.transferable ? "｜可转让名额" : "｜不可转让"));
      showView("prep", { id: a.id });
      break;
    }
    case "recallSend": {
      if (!a) break;
      opsRecallMarkSent(a, [btn.getAttribute("data-key")]);
      toast("已标记触达");
      showView("prep", { id: a.id });
      break;
    }
    case "pkgParse": {
      if (!a) break;
      const inp = document.getElementById("pkgInput");
      const pkg = opsParsePackageText((inp && inp.value) || "");
      if (!pkg.base.price && !pkg.rooms.length && !pkg.transport.length) { toast("没拆出套餐内容，换个说法试试"); break; }
      opsSavePackages(a, pkg);
      toast("已拆解：基础 " + econMoney(pkg.base.price || 0) + "，住宿 " + pkg.rooms.length + " 项，交通 " + pkg.transport.length + " 项，附加 " + pkg.extras.length + " 项");
      showView("prep", { id: a.id });
      break;
    }
    default: break;
  }
});
