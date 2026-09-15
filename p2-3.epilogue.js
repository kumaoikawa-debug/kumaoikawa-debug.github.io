// P2-3 最近风格去重验收：
// ① 连续多次生成（这里 6 次）的「家族 + 变体 + 配色 + 构图」视觉签名不出现连续完全相同
// ② 6 版至少 3 种不同视觉签名（多样性）
// ③ variant 序号不连续相同（跨家族避让）
// ④ _styleHistory 每条记录完整视觉签名（含 color / composition）
const checks = [];
const chk = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
state = (typeof loadState === "function") ? (loadState() || {}) : {};
state.xf = { _styleHistory: [], scenario: "recruit" };

const a = { id: "p3", title: "秋季登山活动", type: "登山", place: "四姑娘山", dateMD: "2026-10-01", status: "recruiting" };
const photos = ["a0.jpg", "a1.jpg", "a2.jpg", "a3.jpg", "a4.jpg"];

const sigs = [];
let consecutiveSame = 0;
let variantRepeatImmediate = 0;
let historyRich = true;
for (let i = 0; i < 6; i++) {
  // 每次换种子，模拟真实「多次点击生成」，避免巧合同值
  state.xf.styleSeed = 1000 + i * 7919;
  const st = await genStrategy(a, photos, "", "recruit");
  const dir = st.editorialDirection;
  const sig = {
    family: dir.family,
    variant: dir.variant,
    color: (dir.visual && dir.visual.color) || "",
    composition: (dir.visual && dir.visual.composition) || "",
  };
  if (i > 0) {
    const p = sigs[i - 1];
    if (p.family === sig.family && p.variant === sig.variant && p.color === sig.color && p.composition === sig.composition) consecutiveSame++;
    if (p.variant === sig.variant) variantRepeatImmediate++;
  }
  sigs.push(sig);
  const rec = { family: sig.family, variant: sig.variant, color: sig.color, composition: sig.composition, whitespace: (dir.whitespace || "") };
  if (!(rec.color && rec.composition)) historyRich = false;
  state.xf._styleHistory.push(rec);
}
chk("风格去重-连续6版无完全相同视觉签名", consecutiveSame === 0, "sameCount=" + consecutiveSame + " sigs=" + JSON.stringify(sigs));
chk("风格去重-6版至少3种不同视觉", new Set(sigs.map((s) => s.family + "|" + s.variant + "|" + s.color + "|" + s.composition)).size >= 3, "distinct=" + new Set(sigs.map((s) => s.family + "|" + s.variant + "|" + s.color + "|" + s.composition)).size);
chk("风格去重-variant不连续相同", variantRepeatImmediate === 0, "vr=" + variantRepeatImmediate);
chk("风格去重-历史含color/composition", historyRich);

const passed = checks.filter((c) => c.pass).length;
return { ok: passed === checks.length, total: checks.length, passed: passed, checks: checks };
