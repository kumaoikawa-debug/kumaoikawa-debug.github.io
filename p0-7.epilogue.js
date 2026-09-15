// P0-7 冒烟验收（epilogue）：证明「AI 先筛素材，再排版」——20+ 张不会无脑全塞进页面，
// 且每张图按「内容」精确分入 使用/弃用 两类，弃用再细分为 重复/质量较低/内容重复·弱相关。
// 构造：28 张 = 5 张同哈希重复图(弃 4 留 1) + 3 张低质量 + 20 张正常唯一图。
//   期望：使用 14（Hero1 / 主图5 / 辅助图6 / 细节图2）；弃用 14（重复 4 / 质量较低 3 / 内容重复·弱相关 7）。
if (typeof selectPhotos === "undefined" || typeof assignAllRoles === "undefined" || typeof buildPhotoIntelligence === "undefined" || typeof applyVision === "undefined") {
  return { ok: false, reason: "P0-7 依赖函数未加载", results: [], checks: [{ name: "函数就绪", pass: false }] };
}

// 注入一张图的内容元信息（模拟真实视觉模型写回）。dup 图显式给相同 pHash；其余不写 pHash→走确定性代理哈希，互不碰撞。
function inject(src, meta) { applyVision(src, meta); }
const SIGN = (extra) => Object.assign({ orientation: "landscape", safe_text_area: "top-right", recommended_use: ["story"], category: "内容识别", emotion: "真实", focal_point: { x: 0.5, y: 0.45 }, cropRisk: null, sat: 0.3, edge: 14, blueRatio: 0.1, warmRatio: 0.2, skinRatio: 0, motionScore: 0, avgLum: 130 }, extra || {});

const checks = [];

/* ---------- 主案例：28 张 ---------- */
const s28 = [];
// 5 张完全重复（同 pHash）→ 弃 4 留 1
for (let k = 0; k < 5; k++) s28.push("p0-7://dup" + k);
// 3 张低质量（quality<0.5，无 pHash→代理）
for (let k = 0; k < 3; k++) s28.push("p0-7://low" + k);
// 20 张正常唯一图（无 pHash→代理；内容各异）
for (let k = 0; k < 20; k++) s28.push("p0-7://norm" + k);

s28.forEach((src, i) => {
  if (i < 5) inject(src, SIGN({ quality_score: 0.82, pHash: { lo: 12345, hi: 6789 } }));      // 重复组
  else if (i < 8) inject(src, SIGN({ quality_score: 0.40, avgLum: 80 }));                       // 低质量
  else inject(src, SIGN({ quality_score: 0.60 + (i % 7) * 0.05, avgLum: 90 + (i % 11) * 8, edge: 12 + (i % 5) * 4, blueRatio: (i % 3 === 0) ? 0.40 : 0.12, skinRatio: (i % 4 === 0) ? 0.08 : 0 })); // 正常
});

const intel28 = buildPhotoIntelligence(s28, null, null, "recruit");
const sel28 = intel28.selection;
const rc28 = sel28.reasons || { dup: 0, low: 0, weak: 0 };

// ① 总量与「使用/弃用」分布
checks.push({
  name: "28 张 → 使用 14 / 弃用 14（不无脑全塞）",
  pass: sel28.total === 28 && sel28.used.length === 14 && sel28.discarded.length === 14 && sel28.used.length < sel28.total,
  detail: `total=${sel28.total} used=${sel28.used.length} discarded=${sel28.discarded.length}`,
});

// ② 弃用三类精确计数：重复 4 / 质量较低 3 / 内容重复·弱相关 7
checks.push({
  name: "弃用三类计数(重复4 / 质量较低3 / 内容重复·弱相关7)",
  pass: rc28.dup === 4 && rc28.low === 3 && rc28.weak === 7,
  detail: `重复=${rc28.dup} 质量较低=${rc28.low} 内容重复·弱相关=${rc28.weak}`,
});

// ③ 弃用理由文案属于三类（无遗留「超出推荐张数」等旧理由）
const ALLOWED = ["重复（与其他图近似）", "质量较低", "内容重复 / 与主题弱相关"];
const badReason = sel28.discarded.filter((d) => ALLOWED.indexOf(d.reason) < 0);
checks.push({ name: "弃用理由仅限三类", pass: badReason.length === 0, detail: badReason.length ? ("非法理由:" + badReason.map((d) => d.reason).join(",")) : ("三类齐全: " + ALLOWED.join(" | ")) });

// ④ 角色预算：Hero1 / 主图5 / 辅助图6 / 细节图2（P0-8 起「辅助图」含 图廊+信息背景，仍合计 6）
const rc = intel28.roleCounts || {};
const aux28 = (rc.SupportImage || 0) + (rc.GalleryImage || 0) + (rc.InfoBackground || 0);
checks.push({
  name: "使用张数角色分配(Hero1/主图5/辅助图6/细节图2)",
  pass: rc.HeroImage === 1 && rc.SectionLeadImage === 5 && aux28 === 6 && rc.DetailImage === 2,
  detail: `Hero=${rc.HeroImage || 0} 主图=${rc.SectionLeadImage || 0} 辅助图=${aux28}(含图廊${rc.GalleryImage || 0}/信息背景${rc.InfoBackground || 0}) 细节图=${rc.DetailImage || 0}`,
});

// ⑤ 重复使用池绝不含 重复图/低质量图（劣图不进版面）
const usedIds = {}; sel28.used.forEach((p) => { usedIds[p.imageId] = true; });
const leaked = sel28.used.filter((p) => p.dupOf || p.lowQuality);
checks.push({ name: "使用池排除重复图与低质量图", pass: leaked.length === 0, detail: leaked.length ? ("泄漏: " + leaked.map((p) => p.imageId).join(",")) : "使用池全部为可用候选" });

// ⑥ 全集覆盖：28 张每张都落在 使用 或 弃用，且两集合不相交、并集=28
const usedSet = new Set(sel28.used.map((p) => p.imageId));
const discSet = new Set(sel28.discarded.map((d) => d.imageId));
let overlap = 0; usedSet.forEach((id) => { if (discSet.has(id)) overlap++; });
const allIds = new Set([...usedSet, ...discSet]);
const coverOk = overlap === 0 && allIds.size === 28;
checks.push({ name: "全集覆盖(每张仅属 使用/弃用 之一)", pass: coverOk, detail: coverOk ? ("28 张全部归类，无遗漏无重叠(使用14+弃用14)") : ("重叠=" + overlap + " 并集=" + allIds.size) });

// ⑦ 汇总文案可对外展示（含三类计数与角色预算）
const ok7 = /重复 4 \/ 质量较低 3 \/ 内容重复/.test(intel28.summary) && /封面主图 1/.test(intel28.summary);
checks.push({ name: "汇总文案含 三类弃用 + 角色预算", pass: ok7, detail: intel28.summary });

/* ---------- 缩放对照：8 张（≤8 应全部使用，不过度裁剪） ---------- */
const s8 = [];
for (let k = 0; k < 8; k++) s8.push("p0-7://small" + k);
s8.forEach((src) => inject(src, SIGN({ quality_score: 0.9, avgLum: 140, edge: 16 })));
const intel8 = buildPhotoIntelligence(s8, null, null, "recruit");
checks.push({
  name: "缩放: 8 张全部使用(不过度裁剪)",
  pass: intel8.selection.used.length === 8 && intel8.selection.discarded.length === 0,
  detail: `used=${intel8.selection.used.length} discarded=${intel8.selection.discarded.length}`,
});

/* ---------- 缩放对照：20 张（>8 应截到 12，证明不无脑全塞） ---------- */
const s20 = [];
for (let k = 0; k < 20; k++) s20.push("p0-7://mid" + k);
s20.forEach((src, idx) => inject(src, SIGN({ quality_score: 0.85, avgLum: 135, edge: 15, blueRatio: (idx % 3 === 0) ? 0.4 : 0.1 })));
const intel20 = buildPhotoIntelligence(s20, null, null, "recruit");
checks.push({
  name: "缩放: 20 张截到 12(不全部进页面)",
  pass: intel20.selection.used.length === 12 && intel20.selection.used.length < 20,
  detail: `used=${intel20.selection.used.length} discarded=${intel20.selection.discarded.length}`,
});

const ok = checks.every((c) => c.pass);
return {
  ok: ok,
  results: {
    s28: { total: sel28.total, used: sel28.used.length, discarded: sel28.discarded.length, reasons: rc28, roles: intel28.roleCounts },
    s8: { used: intel8.selection.used.length }, s20: { used: intel20.selection.used.length },
  },
  checks: checks,
};
