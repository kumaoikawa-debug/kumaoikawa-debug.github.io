// P2-5 页面内容质量评分验收：
// ① 六维齐全(事实安全/重复/主题一致/图片匹配/模板感/情绪感染力) + 总评0-100 + 定性档位
// ② 事实安全：含 FORBID 虚构词 → 子分下降
// ③ 重复：正文重复句 → 子分下降
// ④ 主题一致：覆盖核心事实词 → 子分高于无关文案
// ⑤ 图片匹配：照片分类覆盖正文场景 → 子分高于缺图
// ⑥ 模板感：套路开头 → 子分下降
// ⑦ 情绪感染力：感官/互动/情绪/设问 → 子分高于平淡文案
// ⑧ 结果页不暴露数字（仅定性档位：优秀/良好/可优化/需优化）
const checks = [];
const chk = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
state = (typeof loadState === "function") ? (loadState() || {}) : {};

// 构造 gzh 输出（供 textOf 抽取正文）
function gzh(sectionsHtml, title) {
  return { gzh: { title: title || "测试标题", summary: "摘要", sections: sectionsHtml.map((h) => ({ html: h })), cta: "立即报名" } };
}
const mkXf = (master, out) => {
  const xf = { scenario: "recruit", master: master || {}, out: out, pageQuality: null };
  state.xf = xf;
  return xf;
};

// --- 1) 结构齐全 ---
const baseMaster = {
  mainTheme: "周末轻徒步", confirmedFacts: { place: "莫干山", activityName: "竹海徒步", type: "徒步", season: "初秋" },
  mainSellingPoint: "逃离城市", keyImages: [{ src: "s.jpg", cat: "scenic" }, { src: "w.jpg", cat: "water" }],
};
const goodOut = gzh([
  "<p>莫干山的竹海徒步，是初秋最适合逃离城市的方式。山风穿过竹林，云海在脚下铺开。</p>",
  "<p>我们一起走完这条路线，沿途有水边休憩，也有装备细节可看。你不妨想象那样的自由。</p>",
  "<p>落日时分最治愈，你准备好了吗？这趟轻徒步值得期待。</p>",
], "莫干山竹海徒步");
const xf0 = mkXf(baseMaster, goodOut);
const pq0 = pageQuality(xf0, goodOut);
chk("结构-返回对象", pq0 && typeof pq0 === "object");
chk("结构-总评为0-100整数", typeof pq0.overall === "number" && pq0.overall >= 0 && pq0.overall <= 100);
chk("结构-档位合法", ["优秀", "良好", "可优化", "需优化"].indexOf(pq0.band) >= 0, "band=" + pq0.band);
const dimKeys = ["factSafety", "repeat", "theme", "image", "template", "emotion"];
chk("结构-六维齐全", dimKeys.every((k) => typeof pq0.dims[k] === "number"));
chk("结构-各维在0-1", dimKeys.every((k) => pq0.dims[k] >= 0 && pq0.dims[k] <= 1));
const wsum = dimKeys.reduce((s, k) => s + pq0.weights[k], 0);
chk("结构-权重和为1", Math.abs(wsum - 1) < 1e-9, "sum=" + wsum);

// --- 2) 事实安全：含虚构词降分 ---
const cleanOut = gzh(["<p>莫干山竹海徒步，初秋出发，路线清晰。</p>", "<p>我们一起走，沿途看水边风景。</p>", "<p>你准备好了吗？</p>"]);
const fictOut = gzh(["<p>莫干山竹海徒步，当天万里无云，阳光明媚。</p>", "<p>我们一起走，沿途风景绝佳。</p>", "<p>你准备好了吗？</p>"]);
const fsClean = pageQuality(mkXf(baseMaster, cleanOut), cleanOut).dims.factSafety;
const fsFict = pageQuality(mkXf(baseMaster, fictOut), fictOut).dims.factSafety;
chk("事实安全-含虚构词降分", fsFict < fsClean, "clean=" + fsClean + " fict=" + fsFict);

// --- 3) 重复：重复句降分 ---
const uniqOut = gzh(["<p>第一段讲路线，莫干山竹海很安静。</p>", "<p>第二段讲装备，登山杖很有用。</p>", "<p>第三段讲感受，落日很治愈。</p>"]);
const dupOut = gzh(["<p>这条路线风景很好，莫干山很安静。</p>", "<p>这条路线风景很好，莫干山很安静。</p>", "<p>这条路线风景很好，莫干山很安静。</p>"]);
const rpUniq = pageQuality(mkXf(baseMaster, uniqOut), uniqOut).dims.repeat;
const rpDup = pageQuality(mkXf(baseMaster, dupOut), dupOut).dims.repeat;
chk("重复-重复句降分", rpDup < rpUniq, "uniq=" + rpUniq + " dup=" + rpDup);

// --- 4) 主题一致：覆盖核心事实词高于无关文案 ---
const onTheme = gzh(["<p>莫干山竹海徒步，初秋最适合逃离城市的轻徒步。</p>", "<p>我们一起走完这条路线。</p>", "<p>你准备好了吗？</p>"]);
const offTheme = gzh(["<p>今天天气不错，吃了顿好饭，看了会儿手机。</p>", "<p>朋友聚会很开心。</p>", "<p>明天还要上班。</p>"]);
const thOn = pageQuality(mkXf(baseMaster, onTheme), onTheme).dims.theme;
const thOff = pageQuality(mkXf(baseMaster, offTheme), offTheme).dims.theme;
chk("主题一致-覆盖事实词更高", thOn > thOff, "on=" + thOn + " off=" + thOff);

// --- 5) 图片匹配：照片分类覆盖正文场景高于缺图 ---
const imgGoodMaster = { keyImages: [{ src: "s.jpg", cat: "scenic" }, { src: "w.jpg", cat: "water" }] };
const imgPoorMaster = { keyImages: [{ src: "s.jpg", cat: "scenic" }] };
const sceneText = gzh(["<p>山里有水。</p>", "<p>水边很安静。</p>", "<p>你看到了吗？</p>"]);
const imGood = pageQuality(mkXf(imgGoodMaster, sceneText), sceneText).dims.image;
const imPoor = pageQuality(mkXf(imgPoorMaster, sceneText), sceneText).dims.image;
chk("图片匹配-分类覆盖更高", imGood > imPoor, "good=" + imGood + " poor=" + imPoor);

// --- 6) 模板感：套路开头降分 ---
const plainOut = gzh(["<p>莫干山竹海徒步，初秋出发，山风很舒服。</p>", "<p>我们一起走，沿途有水边风景。</p>", "<p>你准备好了吗？</p>"]);
const tplOut = gzh(["<p>大家好！今天给大家介绍一条路线。首先，这条路线风景好。其次，强度友好。总而言之，值得一去。</p>", "<p>不仅如山风舒服，最后记得带装备。</p>", "<p>你准备好了吗？</p>"]);
const tpPlain = pageQuality(mkXf(baseMaster, plainOut), plainOut).dims.template;
const tpTpl = pageQuality(mkXf(baseMaster, tplOut), tplOut).dims.template;
chk("模板感-套路开头降分", tpTpl < tpPlain, "plain=" + tpPlain + " tpl=" + tpTpl);

// --- 7) 情绪感染力：感官/互动/情绪/设问高于平淡 ---
const vividOut = gzh(["<p>山风拂过竹林，云海在脚下铺开，落日把山谷染成金色。</p>", "<p>我们一起走，你不妨想象那份自由与治愈。</p>", "<p>这样的轻徒步，你心动了吗？</p>"]);
const flatOut = gzh(["<p>活动结束了。</p>", "<p>大家回去了。</p>", "<p>下次再说。</p>"]);
const emVivid = pageQuality(mkXf(baseMaster, vividOut), vividOut).dims.emotion;
const emFlat = pageQuality(mkXf(baseMaster, flatOut), flatOut).dims.emotion;
chk("情绪感染力-感官互动更高", emVivid > emFlat, "vivid=" + emVivid + " flat=" + emFlat);

// --- 8) 结果页不暴露数字（仅定性档位） ---
const sb = styleBar({ scenario: "recruit", family: "route_editorial", variant: 0, strategy: { editorialDirection: { angle: "x" } }, photos: ["s.jpg", "w.jpg"], photoOverrides: { excluded: {} }, pageQuality: pq0 });
chk("结果页-定性徽标渲染", sb.indexOf("xf-qb-") >= 0);
chk("结果页-含档位文字", sb.indexOf("优秀") >= 0 || sb.indexOf("良好") >= 0 || sb.indexOf("可优化") >= 0 || sb.indexOf("需优化") >= 0);
chk("结果页-主UI不暴露数字", !/内容质量\s*\d/.test(sb) && !/总评\s*\d/.test(sb));

// --- 9) 鲁棒性：缺 master/缺 out 不崩溃 ---
let robust = true;
try { const r1 = pageQuality({}, null); const r2 = pageQuality({ master: {} }, null); robust = r1 && r2 && typeof r1.overall === "number"; } catch (e) { robust = false; }
chk("鲁棒性-缺参不崩溃", robust);

// --- 10) 生成链路挂载：qualityCheck 后 state.xf.pageQuality 存在 ---
let mounted = false;
try {
  const a = { id: "p2", title: "测试活动", type: "徒步", place: "莫干山", date: "9月", status: "recruiting" };
  const xfGen = { scenario: "recruit", master: baseMaster, out: goodOut, _styleHistory: [] };
  state.xf = xfGen;
  qualityCheck(goodOut, { family: "route_editorial", variant: 0 }, "recruit", baseMaster.confirmedFacts);
  mounted = !!(xfGen.pageQuality && typeof xfGen.pageQuality.overall === "number");
} catch (e) { mounted = false; }
chk("挂载-xfQualityCheck后写入pageQuality", mounted);

const passed = checks.filter((c) => c.pass).length;
return { ok: passed === checks.length, total: checks.length, passed: passed, checks: checks };
