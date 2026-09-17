/* case-v205-plan-fields.epilogue.js
   ClubOS v205「方案 → 结构化事实 → 确认卡」契约。

   老板实测反馈（真实 15 页方案 PPT）：v204 只读出 4 页、行程/集合/费用全没读到，
   确认卡回落到历史活动默认值（医院门口/9:00/160）——两个根因：
     ① AI 生成的 PPT 把整套版式源码塞进形状 descr（替代文字）属性，且源码里的 ">" 没转义
        → 剥标签提前终止，源码全漏进正文，8000 字预算被垃圾吃满，真正的行程页被截掉；
     ② 就算读到了，确认卡 FACT_SUGGEST 也不读 a.raw 里的结构化事实（meetTime/meeting/price 只看历史/规则）。

   修复：① 剥标签前先剥所有属性值；② intakeParseFields 抽结构化字段 + planSuggestion 最高优先来源。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v205-plan-fields.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;

/* ---- 最小 stored-zip 构造器（epilogue 里没有 zlib；method=0 无需解压，v204 已验证该路径） ---- */
const CRC_TABLE = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(u8) {
  let c = -1;
  for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function u16arr(n) { return new Uint8Array([n & 255, (n >> 8) & 255]); }
function u32arr(n) { return new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255]); }
function storedZip(entries) {
  const parts = [], centr = [];
  let off = 0;
  entries.forEach((e) => {
    const name = new TextEncoder().encode(e.name);
    const crc = crc32(e.data);
    const lh = new Uint8Array(30 + name.length);
    lh.set(u32arr(0x04034b50), 0); lh.set(u16arr(20), 4); lh.set(u16arr(0), 8);
    lh.set(u32arr(crc), 14); lh.set(u32arr(e.data.length), 18); lh.set(u32arr(e.data.length), 22);
    lh.set(u16arr(name.length), 26); lh.set(name, 30);
    parts.push(lh, e.data);
    const cd = new Uint8Array(46 + name.length);
    cd.set(u32arr(0x02014b50), 0); cd.set(u16arr(20), 4); cd.set(u16arr(20), 6); cd.set(u16arr(0), 10);
    cd.set(u32arr(crc), 16); cd.set(u32arr(e.data.length), 20); cd.set(u32arr(e.data.length), 24);
    cd.set(u16arr(name.length), 28); cd.set(u32arr(off), 42); cd.set(name, 46);
    centr.push(cd);
    off += lh.length + e.data.length;
  });
  const cdLen = centr.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  eocd.set(u32arr(0x06054b50), 0); eocd.set(u16arr(entries.length), 8); eocd.set(u16arr(entries.length), 10);
  eocd.set(u32arr(cdLen), 12); eocd.set(u32arr(off), 16);
  const all = parts.concat(centr, [eocd]);
  let total = 0; all.forEach((p) => { total += p.length; });
  const out = new Uint8Array(total);
  let pos = 0; all.forEach((p) => { out.set(p, pos); pos += p.length; });
  return out;
}
const enc = (s) => new TextEncoder().encode(s);

/* ============ §A 根因①：descr 属性里的版式源码不再漏进正文 ============ */
/* 复刻真实病灶：descr 里的 JSX 含未转义的 ">"（如 "padding: 0 }}>"）→ 旧实现在此截断标签 */
const JSX_DESCR = "&lt;Slide style={{ width: 1280, height: 720, background: &apos;#0A0A0B&apos;, padding: 0 }}>&#xA;  &lt;Box style={{ width: 560, flexDirection: &apos;column&apos;, fontSize: 46 }}>&#xA;    &lt;Text style={{ fontSize: 12, letterSpacing: 4 }}>OUTDOOR&lt;/Text>&#xA;  &lt;/Box>&#xA;&lt;/Slide>";
const slide1 = "<p:sld xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\"><p:cSld><p:spTree>" +
  "<p:nvGrpSpPr><p:cNvPr id=\"1\" name=\"\" descr=\"" + JSX_DESCR + "\"/></p:nvGrpSpPr>" +
  "<p:sp><p:txBody><a:p><a:r><a:t>2026 远拓户外 川西两天一夜</a:t></a:r></a:p>" +
  "<a:p><a:r><a:t>08:00 - 12:00</a:t></a:r></a:p>" +
  "<a:p><a:r><a:t>成都集合出发，前往康定城区</a:t></a:r></a:p></p:txBody></p:sp>" +
  "</p:spTree></p:cSld></p:sld>";
const slide2 = "<p:sld xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\"><p:cSld><p:spTree>" +
  "<p:sp><p:txBody><a:p><a:r><a:t>基本信息</a:t></a:r></a:p>" +
  "<a:p><a:r><a:t>活动时间</a:t></a:r></a:p><a:p><a:r><a:t>2026 年 10 月 xx 日 — 10 月 xx 日</a:t></a:r></a:p>" +
  "<a:p><a:r><a:t>活动人数</a:t></a:r></a:p><a:p><a:r><a:t>20 人</a:t></a:r></a:p>" +
  "<a:p><a:r><a:t>活动地点</a:t></a:r></a:p><a:p><a:r><a:t>四川省甘孜州康定市 · 新都桥镇 · 鱼子西</a:t></a:r></a:p>" +
  "</p:txBody></p:sp></p:spTree></p:cSld></p:sld>";
const pptxU8 = storedZip([
  { name: "[Content_Types].xml", data: enc("<Types/>") },
  { name: "ppt/slides/slide1.xml", data: enc(slide1) },
  { name: "ppt/slides/slide2.xml", data: enc(slide2) }
]);
const ext = intakeFromOoxml(pptxU8, "pptx");
const extTxt = ext.text || "";
add("A1 抽取成功", !!extTxt, ext.error || "");
add("A2 ★descr 里的版式源码（Box/Slide/fontSize）不再漏进正文",
  !has(extTxt, "Box") && !has(extTxt, "Slide") && !has(extTxt, "fontSize") && !has(extTxt, "letterSpacing"), extTxt.slice(0, 120));
add("A3 正文文本完整保留", has(extTxt, "2026 远拓户外 川西两天一夜") && has(extTxt, "成都集合出发"), "");
add("A4 两页都读到（不再被垃圾吃掉预算）", (extTxt.match(/【第 \d+ 页】/g) || []).length === 2, String((extTxt.match(/【第 \d+ 页】/g) || []).length));

/* ============ §B 根因②：结构化事实抽取 ============ */
const fields = intakeParseFields(extTxt);
add("B1 集合时间（时刻段 + 集合出发 强模式）", fields.meetTime === "08:00 出发", JSON.stringify(fields));
add("B2 集合地点（成都集合出发 → 成都集合）", fields.meeting === "成都集合", "");
add("B3 人数（活动人数 → 下一行 20 人）", fields.limit === "20", "");
add("B4 天数（两天一夜）", fields.days === "2", "");
add("B5 日期（活动时间 → 下一行，xx 占位原样保留不编造）", has(fields.date, "10 月 xx 日"), JSON.stringify(fields.date));
add("B6 路线（地点行 → 去行政区划前缀）", fields.route === "康定—新都桥—鱼子西", JSON.stringify(fields.route));
add("B7 方案里没有的价格 → 不给（宁可缺也不猜）", !fields.price, JSON.stringify(fields));

const lab = intakeParseFields("活动时间：10月25日\n集合地点：天府广场地铁站A口\n集合时间：早上7:30\n费用：168元/人\n限25人\n活动地点：赵公山");
add("B8 标签行：日期", lab.date === "10月25日", JSON.stringify(lab));
add("B9 标签行：集合地点/集合时间", lab.meeting === "天府广场地铁站A口" && lab.meetTime === "早上7:30", "");
add("B10 标签行：费用/名额", lab.price === "168" && lab.limit === "25", "");
add("B11 空输入 → 空", Object.keys(intakeParseFields("")).length === 0, "");
add("B12 无事实文本 → 空（不猜）", Object.keys(intakeParseFields("今天天气不错\n出来玩吧")).length === 0, "");

/* ============ §C 确认卡接线：planSuggestion 最高优先 ============ */
const planDraft = { raw: "x", _planFields: { meetTime: "08:00 出发", meeting: "成都集合", limit: "20", days: "2", route: "康定—新都桥—鱼子西" } };
add("C1 meetTime 优先用方案", factSuggestionFor(planDraft, "meetTime").value === "08:00 出发" && factSuggestionFor(planDraft, "meetTime").src === "plan", JSON.stringify(factSuggestionFor(planDraft, "meetTime")));
add("C2 meeting 优先用方案", factSuggestionFor(planDraft, "meeting").label === "按你上传的方案", "");
add("C3 days 用方案", factSuggestionFor(planDraft, "days").value === "2", "");
add("C4 route 用方案", factSuggestionFor(planDraft, "route").value === "康定—新都桥—鱼子西", "");
add("C5 方案没给的字段正常回落（price 走历史/规则，不报错）",
  (function () { const s = factSuggestionFor(planDraft, "price"); return !!s && s.src !== "plan"; })(), JSON.stringify(factSuggestionFor(planDraft, "price")));
add("C6 没有 _planFields 的草稿完全不受影响",
  (function () { const s = factSuggestionFor({ raw: "x" }, "meetTime"); return s && s.src !== "plan"; })(), "");
add("C7 空 _planFields 不炸",
  (function () { const s = factSuggestionFor({ raw: "x", _planFields: {} }, "meeting"); return s && s.src !== "plan"; })(), "");
add("C8 标签行文案：方案来源不叫「AI 建议」",
  !has(String(detectKeyGaps(planDraft)), "AI 建议 · 按你上传的方案"), "");

/* ============ §D 接线：一次性消费 + 抽取挂载 ============ */
add("D1 intakeRunFiles 会抽取结构化字段", has(String(intakeRunFiles), "intakeParseFields(merged)"), "");
add("D2 上传成功才允许消费（_fresh 置位）", has(String(intakeRunFiles), "_fresh = true"), "");
add("D3 generateFromInput 一次性挂 _planFields 并清位（防串场）",
  has(String(generateFromInput), "_planFields = state._intake.fields") && has(String(generateFromInput), "_fresh = false"), "");
add("D4 方案字段挂到草稿、不写进活动库其他活动",
  has(String(generateFromInput), "state.draft._planFields"), "");

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
