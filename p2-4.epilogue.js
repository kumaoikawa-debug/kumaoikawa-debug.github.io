// P2-4 真实视觉模型接口标准化验收：
// ① 模型只需返回「归一化 JSON 契约」（VISION_NORMALIZED_SCHEMA），与后端/直连无关
// ② 归一化 JSON 经 visionToPhotoMeta 映射成 photoMeta 形态，再经 applyVisionNormalized 写回缓存
// ③ 写回后 photoMeta 标记为真实（simulated=false），analyzeOnePhoto 自动采用真实字段（业务代码零改动）
// ④ 画质 / 场景 / 人物 等真实字段正确透传到下游分析
const checks = [];
const chk = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });

// 真实模型返回形态（归一化契约）
const norm = {
  orientation: "landscape", quality_score: 0.92, scene: "water", subject: "环境",
  people_count: 3, action: "动态", emotion: "活力", safe_text_area: "top-right",
  focal_point: { x: 0.4, y: 0.5 }, crop_risk: "low", recommended_use: ["hero", "story"]
};
const okWrite = (typeof applyVisionNormalized === "function") ? applyVisionNormalized("vtest.jpg", norm) : false;
chk("P2-4-标准化写回入口可用", okWrite === true);
chk("P2-4-映射函数存在", typeof visionToPhotoMeta === "function" && typeof applyVisionNormalized === "function");

const meta = (typeof photoMeta === "function") ? photoMeta("vtest.jpg") : null;
chk("P2-4-缓存标记为真实(simulated=false)", !!(meta && meta.simulated === false), "sim=" + (meta && meta.simulated));

const an = (typeof analyzeOnePhoto === "function") ? analyzeOnePhoto("vtest.jpg", 0, null) : null;
chk("P2-4-下游分析采用真实字段(simulated=false)", an && an.simulated === false, "sim=" + (an && an.simulated));
chk("P2-4-画质透传(0.92)", an && Math.abs((an.quality || 0) - 0.92) < 0.01, "q=" + (an && an.quality));
chk("P2-4-场景标签含「水上」", an && (an.tags || []).indexOf("水上") >= 0, "tags=" + (an && (an.tags || []).join(",")));
chk("P2-4-人物识别透传(3人→合影)", an && ((an.tags || []).indexOf("人物") >= 0 || (an.tags || []).indexOf("合影") >= 0), "tags=" + (an && (an.tags || []).join(",")));
chk("P2-4-人数透传(3)", an && an.people === 3, "people=" + (an && an.people));

// 契约字段白名单齐全
const need = ["orientation", "quality_score", "scene", "subject", "people_count", "action", "emotion", "safe_text_area", "focal_point", "crop_risk", "recommended_use"];
chk("P2-4-契约字段完整", need.every((k) => k in VISION_NORMALIZED_SCHEMA), "missing=" + need.filter((k) => !(k in VISION_NORMALIZED_SCHEMA)).join(","));

// 非法/缺字段不写回（健壮性）
const bad = (typeof applyVisionNormalized === "function") ? applyVisionNormalized("bad.jpg", null) : "fn-missing";
chk("P2-4-非法输入不写回", bad === false);

const passed = checks.filter((c) => c.pass).length;
return { ok: passed === checks.length, total: checks.length, passed: passed, checks: checks };
