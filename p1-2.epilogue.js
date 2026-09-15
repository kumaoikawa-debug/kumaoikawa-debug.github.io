// P1-2 图片使用前轻确认验收：
// ① 面板含「上传N→建议M」统计 + 改封面(setCover)/删除某图(toggleExclude)/使用AI推荐(useRecommended)
// ② 删除某图：确实从生成图池剔除（生成不再用该图）
// ③ 改封面：老板选的封面落到生成结果的 photoIntel.heroId（否则 AI 自行选封面，改封面无效）
// ④ 安全护栏：已弃用的图不可被设为封面
const checks = [];
const chk = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
state = (typeof loadState === "function") ? (loadState() || {}) : {};

const photos = ["p0.jpg", "p1.jpg", "p2.jpg", "p3.jpg", "p4.jpg"];
const a = { id: "t1", title: "测试活动", type: "徒步", place: "某山", date: "9月", status: "recruiting" };

// --- 1) 轻确认面板渲染 ---
const xf0 = { scenario: "recruit", photos, photoOverrides: { cover: null, excluded: {} }, _a: a };
const review = photoReviewPanel(xf0);
chk("轻确认面板-存在", review.indexOf("智能筛图结果") >= 0);
chk("轻确认面板-含建议统计(建议使用)", /建议使用/.test(review));
chk("轻确认面板-改封面(setCover)", review.indexOf('data-action="setCover"') >= 0);
chk("轻确认面板-删除某图(toggleExclude)", review.indexOf('data-action="toggleExclude"') >= 0);
chk("轻确认面板-使用AI推荐(useRecommended,改动后出现)", photoReviewPanel({ scenario: "recruit", photos, photoOverrides: { cover: 2, excluded: {} }, _a: a }).indexOf('data-action="useRecommended"') >= 0);
chk("轻确认面板-未改动时不显示重置", review.indexOf('data-action="useRecommended"') < 0);

// --- 2) 删除某图：从生成图池剔除 ---
const xf1 = { scenario: "recruit", photos, photoOverrides: { cover: null, excluded: { "p1.jpg": true } }, _a: a };
const active1 = activePhotos(xf1);
chk("删除某图-生成池剔除", active1.length === 4 && active1.indexOf("p1.jpg") < 0, "len=" + active1.length);

// --- 3) 改封面：落到生成 hero ---
const xf2 = { scenario: "recruit", photos, photoOverrides: { cover: 2, excluded: {} }, _a: a }; // 选 p2.jpg 作封面
state.xf = xf2; // genStrategy 内部 pickFamily 等会读 state.xf
const strat = await genStrategy(a, activePhotos(xf2), "", "recruit");
xf2.strategy = strat;
applyCoverOverride(xf2);
const intel = strat.photoIntel;
const hero = (intel && intel.heroId) ? intel.used.find((u) => u.imageId === intel.heroId) : null;
chk("改封面-落到生成hero", !!(hero && hero.src === "p2.jpg"), "heroSrc=" + (hero && hero.src));

// --- 4) 护栏：已弃用图不作封面 ---
const xf3 = { scenario: "recruit", photos, photoOverrides: { cover: 1, excluded: { "p1.jpg": true } }, _a: a };
state.xf = xf3;
const strat3 = await genStrategy(a, activePhotos(xf3), "", "recruit");
xf3.strategy = strat3;
applyCoverOverride(xf3);
const intel3 = strat3.photoIntel;
const hero3 = (intel3 && intel3.heroId) ? intel3.used.find((u) => u.imageId === intel3.heroId) : null;
chk("封面护栏-弃用图不作封面", !hero3 || hero3.src !== "p1.jpg", "heroSrc=" + (hero3 && hero3.src));

const passed = checks.filter((c) => c.pass).length;
return { ok: passed === checks.length, total: checks.length, passed: passed, checks: checks };
