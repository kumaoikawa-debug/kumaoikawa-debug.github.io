// P1-1 简化结果页：普通老板默认只看到「当前风格 / 换一种版式 / 换一种风格 / 快捷(4)」。
// Family / Variant / Editorial Direction / Style Seed / Quality Score / 局部重生成 全部收进「高级调试区」。
const checks = [];
const chk = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });

const xf = {
  scenario: "recruit",
  family: "route_editorial",
  variant: 0,
  styleSeed: 48271,
  strategy: { editorialDirection: { angle: "scenery", hook: "走进山野", visual: { color: "墨绿", composition: "左右交替" } } },
  quality: { fictionRisk: false, unsupported: [], content: { score: 88 }, editorial: { score: 76 } },
  _styleHistory: [],
};
const html = styleBar(xf);

// 1) 默认可见：当前风格 / 换一种版式 / 换一种风格
chk("默认含-当前风格", html.indexOf("当前风格") >= 0);
chk("默认含-换一种版式", html.indexOf("换一种版式") >= 0);
chk("默认含-换一种风格", html.indexOf("换一种风格") >= 0);

// 2) 快捷仅 4 个固定预设；旧的场景依赖预设不再出现
const quickOk = ["更杂志", "更视觉", "更专业", "更自然"].every((l) => html.indexOf(l) >= 0);
const oldGone = ["更年轻", "更有挑战感", "更纪实", "更温暖", "更像画册", "更有人物感"].every((l) => html.indexOf(l) < 0);
chk("快捷-仅4固定预设", quickOk && oldGone, "quickOk=" + quickOk + " oldGone=" + oldGone);

// 3) 调试参数全部收进「高级调试区」(details.xf-adv)，不在主视图行
const advIdx = html.indexOf("高级调试区");
chk("存在-高级调试区", advIdx >= 0);
const allInAdv = ["编辑家族 Family", "版式变体 Variant", "编辑方向 Editorial Direction", "Style Seed", "Quality Score"].every((t) => {
  const i = html.indexOf(t); return i >= 0 && i > advIdx;
});
chk("调试参数-全部收进高级调试区", allInAdv);

// 4) 局部重生成也收进高级调试区（非默认主视图）
const localIdx = html.indexOf("局部重生成");
chk("局部重生成-收进高级调试区", localIdx >= 0 && localIdx > advIdx);

// 5) 不应残留旧的「快速调整」标签
chk("无-快速调整旧标签", html.indexOf("快速调整") < 0);

const passed = checks.filter((c) => c.pass).length;
return { ok: passed === checks.length, total: checks.length, passed: passed, checks: checks };
