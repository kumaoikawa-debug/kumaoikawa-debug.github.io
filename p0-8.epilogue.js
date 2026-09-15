/* P0-8 冒烟：图片角色系统（7 类角色 + 重要度阶梯）
   验收：每张图必须先确定角色；不能再让所有图片在页面中拥有同等重要性。
   通过注入不同内容的视觉元信息（piApplyVision），验证：
     ① 全部图片都落在 7 角色之一，且每张恰属一个角色；
     ② 7 角色的重要度（importance）互不相同——不存在「同等重要性」；
     ③ 弃用池全部标记为 DiscardCandidate（重要度 0，不进版面）；
     ④ 使用池服从预算（14 张：Hero1/主图5/辅助图6/细节图2，其中辅助图含图廊+信息背景）；
     ⑤ 角色由「内容」驱动，与上传顺序无关（乱序后逐图角色一致，且强图>弱图）。 */
const inject = (src, meta) => piApplyVision(src, meta);
const SIGN = (o) => Object.assign({ orientation: "landscape", safe_text_area: "top-right", recommended_use: ["story"], category: "内容识别", emotion: "真实", focal_point: { x: 0.5, y: 0.45 }, cropRisk: null, sat: 0.2, edge: 10, blueRatio: 0.1, warmRatio: 0.2, skinRatio: 0, motionScore: 0, pHash: { lo: (Math.floor(Math.random() * 1e6) + 1), hi: 1 } }, o);

/* 构造 28 张：5 同哈希重复 + 3 低质量 + 20 正常（混合风景/人物以产生角色差异） */
const photos = [];
for (let k = 0; k < 5; k++) inject("p0-8://dup" + k, SIGN({ quality_score: 0.85, avgLum: 140, sat: 0.42, edge: 18, blueRatio: 0.45, pHash: { lo: 777, hi: 7 } }));   // 重复（同哈希）
for (let k = 0; k < 3; k++) inject("p0-8://low" + k, SIGN({ quality_score: 0.40, avgLum: 120, edge: 8, pHash: { lo: 900 + k, hi: 1 } }));                            // 低质量
for (let k = 0; k < 20; k++) {
  const scenic = (k % 2 === 0);
  inject("p0-8://mid" + k, SIGN(scenic
    ? { quality_score: 0.85, avgLum: 140, sat: 0.42, edge: 18, blueRatio: 0.42 }
    : { quality_score: 0.82, avgLum: 135, sat: 0.30, edge: 12, skinRatio: 0.12 }));
}
for (let k = 0; k < 5; k++) photos.push("p0-8://dup" + k);
for (let k = 0; k < 3; k++) photos.push("p0-8://low" + k);
for (let k = 0; k < 20; k++) photos.push("p0-8://mid" + k);

const intel = buildPhotoIntelligence(photos, null, null, "recruit");
const roles = intel.roles;
const rc = intel.roleCounts;
const checks = [];

/* ① 全部图片都落在 7 角色之一，且每张恰好一个角色 */
const validRoles = intel.roleOrder || ["HeroImage", "SectionLeadImage", "SupportImage", "GalleryImage", "DetailImage", "InfoBackground", "DiscardCandidate"];
let allAssigned = true, allValid = true;
intel.analysis.forEach((p) => {
  const r = roles[p.imageId];
  if (!r) allAssigned = false;
  if (validRoles.indexOf(r) < 0) allValid = false;
});
checks.push({ name: "每张图都分配了角色（28 张全覆盖）", pass: allAssigned, detail: allAssigned ? "28 张全部有角色" : "存在未分配角色的图片" });
checks.push({ name: "角色均为 7 类合法值之一", pass: allValid, detail: allValid ? "角色集合 ⊂ {Hero/SectionLead/Support/Gallery/Detail/InfoBackground/DiscardCandidate}" : "出现非法角色" });

/* ② 7 角色重要度互不相同——不存在「同等重要性」 */
const imps = validRoles.map((r) => (intel.rolesMeta && intel.rolesMeta[r]) ? intel.rolesMeta[r].importance : -1);
const uniqImp = new Set(imps);
checks.push({ name: "7 角色重要度阶梯互不相同（无同等重要性）", pass: uniqImp.size === validRoles.length && imps.every((v) => v >= 0), detail: "重要度 = [" + imps.join(", ") + "]" });

/* ③ 弃用池全部为 DiscardCandidate（重要度 0） */
checks.push({ name: "弃用图片标记为 DiscardCandidate（重要度 0）", pass: rc.DiscardCandidate === intel.selection.discarded.length && rc.DiscardCandidate > 0, detail: "DiscardCandidate = " + (rc.DiscardCandidate || 0) + "，弃用总数 = " + intel.selection.discarded.length });

/* ④ 使用池服从预算（14 张：Hero1/主图5/辅助图6/细节图2） */
const used = intel.used.length;
const aux = (rc.SupportImage || 0) + (rc.GalleryImage || 0) + (rc.InfoBackground || 0);
checks.push({ name: "使用张数 = 14（20+ 张强制筛选）", pass: used === 14, detail: "使用 " + used + " 张" });
checks.push({ name: "角色预算 Hero1 / 主图5 / 辅助图6 / 细节图2", pass: rc.HeroImage === 1 && rc.SectionLeadImage === 5 && aux === 6 && rc.DetailImage === 2, detail: "Hero " + (rc.HeroImage || 0) + " · 主图 " + (rc.SectionLeadImage || 0) + " · 辅助图 " + aux + "(含图廊" + (rc.GalleryImage || 0) + "/信息背景" + (rc.InfoBackground || 0) + ") · 细节图 " + (rc.DetailImage || 0) });

/* ⑤ 角色由内容驱动，与上传顺序无关 + 强图>弱图 */
const strong = "p0-8://strong", weak = "p0-8://weak";
inject(strong, SIGN({ quality_score: 0.92, orientation: "landscape", avgLum: 140, sat: 0.45, edge: 20, blueRatio: 0.5 }));
inject(weak, SIGN({ quality_score: 0.55, orientation: "portrait", avgLum: 120, edge: 8, blueRatio: 0.1 }));
const i1 = buildPhotoIntelligence([strong, weak], null, null, "recruit");
const i2 = buildPhotoIntelligence([weak, strong], null, null, "recruit");
const idOf = (src) => i1.analysis.find((p) => p.src === src).imageId;
const rStrongA = i1.roles[idOf(strong)], rWeakA = i1.roles[idOf(weak)];
const rStrongB = i2.roles[i2.analysis.find((p) => p.src === strong).imageId];
const rWeakB = i2.analysis && i2.roles[i2.analysis.find((p) => p.src === weak).imageId];
const impOf = (i, src) => i.importanceOf(i.analysis.find((p) => p.src === src).imageId);
const orderStable = rStrongA === rStrongB && rWeakA === rWeakB;
const strongHigher = impOf(i1, strong) > impOf(i1, weak);
checks.push({ name: "角色与上传顺序无关（乱序后逐图角色一致）", pass: orderStable, detail: "强图角色 " + rStrongA + "（正序）/ " + rStrongB + "（乱序）；弱图 " + rWeakA + " / " + rWeakB });
checks.push({ name: "内容驱动：强图重要度 > 弱图重要度", pass: strongHigher, detail: "强图 importance=" + impOf(i1, strong) + " > 弱图 importance=" + impOf(i1, weak) });

/* ⑥ 使用池内不存在「全部同等重要性」（至少出现多种角色） */
const usedRoles = new Set(intel.used.map((p) => roles[p.imageId]));
checks.push({ name: "使用池内角色多样（非同等重要性）", pass: usedRoles.size >= 4, detail: "使用池出现 " + usedRoles.size + " 种角色：" + Array.from(usedRoles).join(" / ") });

const allPass = checks.every((c) => c.pass);
return { ok: allPass, results: { used: used, discarded: intel.selection.discarded.length, roleCounts: rc, allRoles: validRoles.length }, checks: checks };
