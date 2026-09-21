/* =======================================================================
 * case-v228-block.epilogue.js — 6 积木块 IR：build ↔ apply 往返 + 行程解析
 * -----------------------------------------------------------------------
 * 自包含、可离线运行：node case-v228-block.epilogue.js
 * 在 vm 沙箱里加载 publish.js（buildContentBlocks/applyContentBlocks/parseItinText）
 * 与 blocks.js（itinToText/itinFromText），以桩函数替代浏览器依赖，断言：
 *   1) build 出 6 块且 editable 标记正确（Trust/Price 只读）
 *   2) apply 只回写可编辑块，绝不碰 Trust/Price 硬数据
 *   3) tags / hook / cta 改写经 apply 落回活动
 *   4) timeline 文本框 itinToText → itinFromText 可逆
 *   5) parseItinText 多天分段正确
 * ======================================================================= */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const ROOT = __dirname;
function read(p) { return fs.readFileSync(path.join(ROOT, p), "utf8"); }

/* ---- 浏览器依赖桩（仅覆盖本测试用到的全局） ---- */
const sandbox = {
  console,
  state: { activities: [] },
  document: {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
  },
  window: {},
  localStorage: { getItem: () => null, setItem: () => {} },
  setTimeout, clearTimeout,
  // 价格/文案闸门的桩实现（与生产逻辑同形，便于断言回写行为）
  priceTextOf: (a) => (a && a.price != null) ? ("¥" + a.price + (a.limitUnit ? ("/" + a.limitUnit) : "")) : "详询",
  priceUnpricedTextOf: (a) => (a && a.price != null) ? null : "详询",
  sanitizePublishCopy: (t) => String(t == null ? "" : t),
  getActivity: (id) => (sandbox.state.activities.find((x) => x.id === id) || null),
  upsert: (a) => { const i = sandbox.state.activities.findIndex((x) => x.id === a.id); if (i >= 0) sandbox.state.activities[i] = a; else sandbox.state.activities.push(a); },
  saveState: () => {},
  toast: () => {},
  ICON: () => "",
  xbCopy: () => {},
  showView: () => {},
  clubLLM: async () => "__fallback__",
};
sandbox.window = sandbox;
vm.createContext(sandbox);

/* ---- 加载被测源码（顶层 function 声明会泄漏为沙箱全局） ---- */
vm.runInContext(read("src/publish.js"), sandbox, { filename: "publish.js" });
vm.runInContext(read("src/blocks.js"), sandbox, { filename: "blocks.js" });

/* ---- 断言 ---- */
const checks = [];
function rec(name, pass, detail) { checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) }); }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const sample = {
  id: "act-v228",
  title: "赵公山轻装徒步",
  type: "徒步",
  place: "成都",
  price: 168,
  limitUnit: "人",
  limit: 25,
  leaderName: "小林",
  leaderYears: 5,
  feeInclude: ["领队", "保险", "饮用水"],
  insurance: "专业户外险",
  tags: ["徒步", "周末"],
  hook: "一日往返，轻松登顶",
  cta: "名额有限，扫码报名",
  itineraryDays: [
    { label: "DAY 1", sub: "登山", items: [{ time: "07:30", text: "集合出发" }, { time: "14:30", text: "登顶" }] },
    { label: "DAY 2", sub: "", items: [{ time: "08:00", text: "早餐后返程" }] },
  ],
};

/* §1 build 出 6 块 + editable 标记 */
const b = sandbox.buildContentBlocks(sample);
rec("B1 build 返回 6 块", b && Object.keys(b).length === 6, b ? Object.keys(b).join(",") : "null");
rec("B2 可编辑块=tags/hook/timeline/cta", b.tags.editable && b.hook.editable && b.timeline.editable && b.cta.editable, "editable flags");
rec("B3 只读块=trust/price", b.trust.editable === false && b.price.editable === false, "readonly flags");
rec("B4 trust 投影含领队+含项+保险", b.trust.value.length === 3 && b.trust.value[0].indexOf("小林") >= 0 && b.trust.value[2].indexOf("保险") >= 0, JSON.stringify(b.trust.value));
rec("B5 price 投影文本=¥168/人", b.price.value.text === "¥168/人", b.price.value.text);

/* §2 Trust/Price 只读：篡改 blocks 后 apply 不得改写硬数据 */
const b2 = sandbox.buildContentBlocks(sample);
b2.trust.value = ["伪造领队"];
b2.price.value = { text: "¥1", raw: 1, unit: "人", limit: 999, tbd: false };
const a2 = Object.assign({}, sample);
sandbox.applyContentBlocks(a2, b2);
rec("P1 apply 后 price 硬数据不变", a2.price === 168 && a2.limitUnit === "人" && a2.limit === 25, JSON.stringify({ price: a2.price, unit: a2.limitUnit, limit: a2.limit }));
rec("P2 apply 后 leaderName 硬数据不变", a2.leaderName === "小林" && a2.insurance === "专业户外险", a2.leaderName + "/" + a2.insurance);

/* §3 可编辑块经 apply 落回活动 */
const b3 = sandbox.buildContentBlocks(sample);
b3.tags.value = ["徒步", "周末", "亲子"];
b3.hook.value = "新版主张";
b3.cta.value = "新版 CTA";
b3.timeline.value = [{ label: "DAY 1", sub: "", items: [{ time: "07:00", text: "新区集合" }] }];
const a3 = Object.assign({}, sample);
sandbox.applyContentBlocks(a3, b3);
rec("E1 tags 回写", eq(a3.tags, ["徒步", "周末", "亲子"]), JSON.stringify(a3.tags));
rec("E2 hook 回写", a3.hook === "新版主张", a3.hook);
rec("E3 cta 回写", a3.cta === "新版 CTA", a3.cta);
rec("E4 timeline 回写", a3.itineraryDays.length === 1 && a3.itineraryDays[0].items[0].text === "新区集合", JSON.stringify(a3.itineraryDays));

/* §4 timeline 文本框 itinToText → itinFromText 可逆 */
const txt = sandbox.itinToText(sample.itineraryDays);
const back = sandbox.itinFromText(txt);
rec("T1 itinToText 天数=2", sample.itineraryDays.length === 2, String(sample.itineraryDays.length));
rec("T2 反转后天数一致", back.length === 2, String(back.length));
rec("T3 反转后节点数一致", back[0].items.length === 2 && back[1].items.length === 1, back.map((d) => d.items.length).join(","));
rec("T4 反转后首节点时间保留", back[0].items[0].time === "07:30" && back[0].items[0].text === "集合出发", JSON.stringify(back[0].items[0]));

/* §5 parseItinText 多天分段 */
const parsed = sandbox.parseItinText("DAY 1\n07:30 集合\n09:00 出发\nDAY 2\n08:00 返程");
rec("X1 parseItinText 两天", parsed.length === 2, String(parsed.length));
rec("X2 第一天 2 节点", parsed[0].items.length === 2 && parsed[0].items[0].time === "07:30", JSON.stringify(parsed[0].items));

/* ---- 汇总 ---- */
let passN = 0;
checks.forEach((c) => { if (c.pass) passN++; console.log((c.pass ? "PASS" : "FAIL") + " · " + c.name + (c.pass ? "" : "  » " + c.detail)); });
console.log("\n" + passN + "/" + checks.length + " passed");
if (passN !== checks.length) { process.exit(1); }
