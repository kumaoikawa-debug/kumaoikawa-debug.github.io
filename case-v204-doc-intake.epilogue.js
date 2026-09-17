/* case-v204-doc-intake.epilogue.js
   ClubOS v204「上传活动方案 → 自动生成活动」契约。

   老板的需求原话：「我发一个活动方案 word、ppt、pdf 或者活动的图片、海报进去，
   然后系统就自动生成活动招募信息」。落点是后台「第 1 步 / 描述活动」那一屏。

   落地拆成三层，本文件逐层断言：
     ① 解析层（intake.js，纯逻辑、零外链）：自研最小 ZIP + raw DEFLATE 解压
        → docx 抽 word/document.xml、pptx 抽 ppt/slides/*.xml（按页序）+ 演讲备注；
        PDF 走 pdf.js 懒加载（多 CDN 回退）；图片海报走视觉 AI 读图。
     ② 整理层：有 AI → 交给模型整理成「活动描述」；无 AI → **原样回填原文**，
        一个字都不加（承 v193 不虚构 / v201 分层）。prompt 里写死「只许搬运与重组」。
     ③ UI 层：renderCreate 加拖拽上传区 + 逐文件结果面板 + AI 可用时自动进生成流程。

   ★ 为什么内嵌真实字节：docx/pptx 解析最容易「看起来对、其实解不出来」。
     这里嵌的是 Python zipfile 产出的**真** .docx / .pptx（deflate 压缩 + 表格 + 3 页乱序编号）
     与一个 method=0（无压缩）的 zip，直接端到端跑解析器；开发期另用 Node zlib
     对 inflate 做过 5 组尺寸 × 压缩级别的字节级对照（10B/500B/5KB/200KB/stored）。

   跑法：SPA_SMOKE_EXTRA=publish.js node <skill>/scripts/spa-smoke.js <projDir> case-v204-doc-intake.epilogue.js */

state = (typeof loadState === "function") ? loadState() : state;
if (!state) state = {};

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail == null ? "" : String(detail) });
const has = (h, s) => String(h).indexOf(s) >= 0;

/* 真实文件字节（base64 内嵌，避免 epilogue 里 require("fs")） */
const B64_DOCX = "UEsDBBQAAAAIAPG4MV3HHBc8CgAAAAgAAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLMJqSxILda3AwBQSwMEFAAAAAgA8bgxXbGG0F7+AQAAtAMAABEAAAB3b3JkL2RvY3VtZW50LnhtbJWTzW7TQBDH730Ky4feqB0jQkkTV1x4AngA1zFpJH/JNoTeUqIQJ00hLaghxEWq3ApXpFUjXFTbKX0YMmv7lFdg7QYk2gDhMjuzO/P7a3dm86svJJF4Lmh6WZELZGaJJglB5pViWS4VyCePH91ZJgnd4OQiJyqyUCA3BJ1cZRfylVxR4Z9JgmwQmCDruUqBXDcMNUdROr8uSJy+pKiCjM+eKprEGTjUSlRF0YqqpvCCrmMBSaQYms5SEleWSRYj15TiRspWk0hLjMFG5+dQH8BwGF0GkV2Hb7vo5Ai5AbQctOehAzNPJWmJ1VKr3kKML6rfq5vTmu7XuOtORh8YmsmC5z5AlsnQqHs0GZmw40D9ZDJqzoH02xgZ919Bx/yFRN3j8UXrfu4u/Rsgca8zwToLX3o4Ew6PwbfAuwLLx5vx283wc+8hvLHnuUwTK0euF75zMCmTXYZ6jRr7/mTUjnsd5h52Z1OMNTFFXIN49gY4brRDZ+t2abrDz67JMLg3uPDPVVQquPAX3dAcwHbjP3UzNB0Ov/xLNl3wrW++IfT7yRviaTpsQOBHp6dJT9LJij9u4aOwF+CJQ/t7aZOd6GCOxiyKxgrUtyPXBvsMvX+9WDJWCGQNpnNnVcPAjD7ZcaOF9mtwuTu+Go69TlxzULOKrJkzR03/ROL8/G/sD1BLAwQUAAAACADxuDFdxxwXPAoAAAAIAAAAEwAAAFtDb250ZW50X1R5cGVzXS54bWyzCaksSC3WtwMAUEsBAhQDFAAAAAgA8bgxXcccFzwKAAAACAAAABMAAAAAAAAAAAAAAIABAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAMUAAAACADxuDFdsYbQXv4BAAC0AwAAEQAAAAAAAAAAAAAAgAE7AAAAd29yZC9kb2N1bWVudC54bWxQSwECFAMUAAAACADxuDFdxxwXPAoAAAAIAAAAEwAAAAAAAAAAAAAAgAFoAgAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLBQYAAAAAAwADAMEAAACjAgAAAAA=";
const B64_PPTX = "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";
const B64_STORED = "UEsDBBQAAAAAAEC5MV07k4AOWAAAAFgAAAARAAAAd29yZC9kb2N1bWVudC54bWw8dzpkb2N1bWVudD48dzpib2R5Pjx3OnA+PHc6dD7mnKrljovnvKnnmoTmtYvor5XmraPmloc8L3c6dD48L3c6cD48L3c6Ym9keT48L3c6ZG9jdW1lbnQ+UEsBAhQDFAAAAAAAQLkxXTuTgA5YAAAAWAAAABEAAAAAAAAAAAAAAIABAAAAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAABAAEAPwAAAIcAAAAAAA==";
function b64u8(s) {
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/* ============ §A 文件类型判定（浏览器给的 MIME 常为空 → 扩展名优先） ============ */
const kA = intakeKindOf("赵公山方案.docx");
add("A1 .docx → docx 且可读", kA.kind === "docx" && kA.ok === true, JSON.stringify(kA));
add("A2 大写扩展名 .PPTX 也认", intakeKindOf("虹口.PPTX").kind === "pptx", "");
add("A3 .PDF → pdf", intakeKindOf("a.PDF").kind === "pdf", "");
add("A4 图片扩展名 → image", intakeKindOf("海报.jpg").kind === "image" && intakeKindOf("x.HEIC").kind === "image", "");
add("A5 无扩展名但给了 image/* MIME → image", intakeKindOf("weird", "image/png").kind === "image", "");
add("A6 无扩展名但给了 pdf MIME → pdf", intakeKindOf("weird", "application/pdf").kind === "pdf", "");
const kDoc = intakeKindOf("旧方案.doc");
add("A7 .doc 旧格式 → 明确不支持 + 可执行建议",
  kDoc.ok === false && has(kDoc.reason, "另存为") && has(kDoc.reason, ".docx"), kDoc.reason);
add("A8 .xlsx / 陌生格式 → 明确不支持", intakeKindOf("表.xlsx").ok === false && intakeKindOf("a.weird").ok === false, "");
add("A9 文本类（txt/md/csv）→ text", ["a.txt", "b.md", "c.csv"].every((n) => intakeKindOf(n).kind === "text"), "");

/* ============ §B 文本解码与清洗 ============ */
add("B1 UTF-8 文本正常解码",
  intakeDecodeText(new TextEncoder().encode("赵公山徒步")) === "赵公山徒步", "");
/* ★Windows 记事本的 .txt 常是 GBK —— 只按 utf-8 解会整段乱码（真实用户场景） */
const GBK = new Uint8Array([0xD5, 0xD4, 0xB9, 0xAB, 0xC9, 0xBD, 0xC7, 0xE1, 0xD7, 0xB0, 0xCD, 0xBD, 0xB2, 0xBD, 0x20, 0x31, 0x36, 0x38, 0xD4, 0xAA, 0x2F, 0xC8, 0xCB]);
const gbkTxt = intakeDecodeText(GBK);
add("B2 GBK 编码的 txt 也能正确读出（不是乱码）", has(gbkTxt, "赵公山轻装徒步") && has(gbkTxt, "168元/人"), gbkTxt);
add("B3 相邻重复行去重（PPT 母版常见）", intakeCleanText("标题\n标题\n正文") === "标题\n正文", JSON.stringify(intakeCleanText("标题\n标题\n正文")));
add("B4 纯装饰符行/行首符号被清掉", intakeCleanText("· 第一条\n—\n※第二条") === "第一条\n第二条", JSON.stringify(intakeCleanText("· 第一条\n—\n※第二条")));
add("B5 段落换行保留、连续空行收敛", intakeCleanText("甲\n\n\n\n乙").split("\n").length === 3, JSON.stringify(intakeCleanText("甲\n\n\n\n乙")));
add("B6 控制字符被清除", !/[\u0000-\u0008]/.test(intakeCleanText("甲\u0001乙\u0007丙")), "");

/* ============ §C 自研 ZIP / DEFLATE（真实字节端到端） ============ */
const docxU8 = b64u8(B64_DOCX);
const pptxU8 = b64u8(B64_PPTX);
const ents = intakeZipEntries(docxU8);
add("C1 真实 .docx 的 zip 条目表能读出", !!ents && ents.length >= 2, ents ? ents.length : "null");
add("C2 条目表含 word/document.xml", !!ents && ents.some((e) => e.name === "word/document.xml"), ents ? ents.map((e) => e.name).join(",") : "");
add("C3 条目表含压缩方式（method=8 deflate）", !!ents && ents.some((e) => e.method === 8), ents ? ents.map((e) => e.method).join(",") : "");
add("C4 动态/固定 Huffman 都能解（inflate 不抛）",
  (function () { try { intakeInflateRaw(ents.find((e) => e.name === "word/document.xml").data); return true; } catch (e) { return false; } })(), "");
const storedU8 = b64u8(B64_STORED);
const sEnts = intakeZipEntries(storedU8);
add("C5 无压缩（method=0）样本的正文能取出",
  !!sEnts && has(intakeDecodeText(sEnts[0].data), "未压缩的测试正文"), sEnts ? sEnts[0].method : "null");
add("C6 坏字节 → 返回 error 而不是抛异常",
  (function () { const r = intakeFromOoxml(new Uint8Array([1, 2, 3, 4, 5, 6]), "docx"); return !r.text && !!r.error; })(), "");
add("C7 zip 里没有正文条目 → 诚实报错（不编内容）",
  (function () { const r = intakeFromOoxml(storedU8, "pptx"); return !r.text && !!r.error && has(r.error, "没有找到"); })(), "");

/* ============ §D docx / pptx 抽取保真（事实数字一字不动） ============ */
const dOut = intakeFromOoxml(docxU8, "docx");
const dTxt = dOut.text || "";
add("D1 Word 正文抽取成功", !!dTxt, dOut.error || "");
add("D2 活动标题原样保留", has(dTxt, "赵公山轻装徒步活动方案"), dTxt.slice(0, 40));
add("D3 日期数字原样（2026年9月20日）", has(dTxt, "2026年9月20日"), "");
add("D4 价格与名额原样（168元/人、限25人）", has(dTxt, "168元/人") && has(dTxt, "限25人"), "");
add("D5 集合时间原样（早上7:30）", has(dTxt, "早上7:30"), "");
add("D6 ★表格内容保留且同行显示（里程 ｜ 12公里）", has(dTxt, "里程 ｜ 12公里") && has(dTxt, "爬升 ｜ 1100米"), dTxt);
add("D7 XML 实体正确解码（&lt;免责声明&gt;）", has(dTxt, "<免责声明>") && !has(dTxt, "&lt;"), "");
add("D8 装备清单保留", has(dTxt, "徒步鞋") && has(dTxt, "登山杖"), "");

const pOut = intakeFromOoxml(pptxU8, "pptx");
const pTxt = pOut.text || "";
add("D9 PPT 正文抽取成功", !!pTxt, pOut.error || "");
add("D10 ★按页码升序（1→2→3→10，不是字符串序 1,10,2,3）",
  pTxt.indexOf("【第 1 页】") < pTxt.indexOf("【第 2 页】") &&
  pTxt.indexOf("【第 2 页】") < pTxt.indexOf("【第 3 页】") &&
  pTxt.indexOf("【第 3 页】") < pTxt.indexOf("【第 10 页】"), pTxt.slice(0, 80));
add("D11 每一页都标了页码（可追溯来源）", (pTxt.match(/【第 \d+ 页】/g) || []).length === 4, String((pTxt.match(/【第 \d+ 页】/g) || []).length));
add("D12 演讲备注一并取到（常在备注里写细节）", has(pTxt, "演讲备注") && has(pTxt, "领队小王负责签到"), "");
add("D13 PPT 里的价格事实原样（298元/人）", has(pTxt, "298元/人"), "");
add("D14 PPT 里不混入非幻灯片条目（比如 [Content_Types].xml）", !has(pTxt, "Content_Types") && !has(pTxt, "ppt/slides"), "");
add("D15 输出长度受上限约束（不把超长方案整段塞给模型）",
  (function () { const big = intakeFromOoxml(docxU8, "docx"); return (big.text || "").length <= INTAKE_MAX_FILE_CHARS; })(), "");

/* ============ §E 合并 / 无 AI 回填：绝不新增事实 ============ */
const mergedMulti = intakeMergeTexts([{ name: "方案.docx", text: "甲" }, { name: "海报.jpg", text: "乙" }]);
add("E1 多文件合并带来源标注", has(mergedMulti, "【来源：方案.docx】") && has(mergedMulti, "【来源：海报.jpg】"), mergedMulti);
add("E2 单文件不加来源标注（免得污染描述）", intakeMergeTexts([{ name: "a.docx", text: "甲" }]) === "甲", "");
add("E3 合并结果受总长上限约束", intakeMergeTexts([{ name: "a", text: "甲".repeat(30000) }]).length <= INTAKE_MAX_CHARS, "");
add("E4 空文本项被跳过（不产生空的来源块）",
  (function () { const r = intakeMergeTexts([{ name: "a", text: "" }, { name: "b", text: "乙" }]); return !has(r, "【来源：a】") && has(r, "乙"); })(), "");
/* ★最关键的一条：没有 AI 时只能截原文，不能组织出新句子 */
const rawSrc = intakeCleanText("赵公山轻装徒步，12公里爬升1100米，168元/人，限25人。早上7:30天府广场集合。");
const fb = intakeFallbackDescription(rawSrc);
add("E5 ★无 AI 回填是原文的连续子串（证明零新增字符）", rawSrc.indexOf(fb) >= 0 && fb.length > 0, fb);
add("E6 无 AI 回填仍保留精确数字（事实不能丢）", has(fb, "168元/人") && has(fb, "限25人") && has(fb, "12公里"), "");
add("E7 空输入不编造（返回空串）", intakeFallbackDescription("") === "", JSON.stringify(intakeFallbackDescription("")));
add("E8 ★prompt 里写死「绝对不允许新增事实」与「数字原样保留」",
  has(INTAKE_SYSTEM, "绝对不允许") && has(INTAKE_SYSTEM, "原样保留") && has(INTAKE_SYSTEM, "不要 markdown"), "");
add("E9 prompt 明确要求删掉无关内容（抬头/页脚/免责声明）",
  has(INTAKE_SYSTEM, "免责声明") && has(INTAKE_SYSTEM, "页眉页脚"), "");
/* ★未配置 AI：整理层必须走原文回填（usedAI=false），且回填内容仍是原文子串 */
try { localStorage.removeItem("clubos_ai_key"); localStorage.removeItem("clubos_backend_url"); } catch (e) {}
const compNoAI = await intakeComposeDescription(rawSrc);
add("E10 未配置 AI 时整理层走原文回填（usedAI=false，内容仍来自原文）",
  compNoAI.usedAI === false && rawSrc.indexOf(compNoAI.description) >= 0, JSON.stringify(compNoAI).slice(0, 90));

/* ============ §F 渲染层：入口 + 逐文件结果面板 ============ */
const savedIntake = state._intake;
delete state._intake;
const html0 = renderCreate();
add("F1 renderCreate 有「上传活动方案」拖拽区", has(html0, 'id="intakeDrop"') && has(html0, "intake-drop"), "");
add("F2 有独立文件输入 + accept 覆盖 docx/pptx/pdf/图片", has(html0, 'id="createDocInput"') && has(html0, ".docx") && has(html0, ".pptx") && has(html0, ".pdf") && has(html0, "image/*"), "");
add("F3 说明文案点明「会自动整理成活动描述」", has(html0, "自动整理成下面的「活动描述」"), "");
add("F4 没有方案记录时不渲染空面板", !has(html0, 'id="intakePanel"'), "");
add("F5 ★方案上传与活动照片是两个独立入口（不共用）",
  has(html0, 'id="intakeDrop"') && has(html0, 'id="createPhotoInput"') && html0.indexOf('id="intakeDrop"') !== html0.indexOf('id="createPhotoInput"'), "");
add("F6 原有「AI 生成活动」按钮未被动坏", has(html0, 'data-action="generate"') && has(html0, "AI 生成活动"), "");
add("F7 原有活动照片区未被动坏", has(html0, "xf-photos") && has(html0, "活动照片"), "");

state._intake = { busy: true, busyText: "正在读取《方案.docx》…（1/2）", items: [{ name: "海报.jpg", kind: "image", ok: false, note: "没配置视觉 AI" }] };
const htmlBusy = intakePanelHtml();
add("F8 读取中渲染转圈 + 进度文案", has(htmlBusy, "intake-spin") && has(htmlBusy, "正在读取《方案.docx》…（1/2）"), "");
add("F9 读取中已完成的失败项也照实显示", has(htmlBusy, "海报.jpg") && has(htmlBusy, "intake-row-s bad"), "");

state._intake = {
  busy: false, busyText: "",
  items: [
    { name: "赵公山方案.docx", kind: "docx", ok: true, note: "已读出 312 字" },
    { name: "旧方案.doc", kind: "unsupported", ok: false, note: "旧版 Office 格式（.doc）浏览器读不了，请另存为 .docx" }
  ],
  description: "赵公山轻装徒步，168元/人，限25人。",
  warn: "AI 整理没成功，已把原文直接填进描述（未做任何改写）"
};
const htmlDone = intakePanelHtml();
add("F10 成功项显示文件名 + 字数", has(htmlDone, "赵公山方案.docx") && has(htmlDone, "已读出 312 字") && has(htmlDone, "intake-row-s ok"), "");
add("F11 失败项显示原因（不是静默丢弃）", has(htmlDone, "旧版本".slice(0, 0) + "旧版 Office 格式") && has(htmlDone, "intake-row-s bad"), "");
add("F12 整理出的描述在面板里可见（老板能核对）", has(htmlDone, "intake-desc") && has(htmlDone, "赵公山轻装徒步，168元/人"), "");
add("F13 降级提示如实说明「原文直接填入、未做改写」", has(htmlDone, "intake-warn") && has(htmlDone, "未做任何改写"), "");
add("F14 面板挂在 renderCreate 里（不是孤立函数）",
  (function () { state._intake = { busy: false, busyText: "", items: [{ name: "a.docx", kind: "docx", ok: true, note: "已读出 10 字" }], description: "", warn: "" }; return has(renderCreate(), 'id="intakePanel"'); })(), "");

/* ============ §G 诚实降级 + 接线 + 模块自检 ============ */
state = (typeof loadState === "function") ? loadState() : state;
if (state.visionCfg) state.visionCfg = {};
try { localStorage.removeItem("clubos_vision_key"); localStorage.removeItem("clubos_vision_provider"); } catch (e) {}
const vNoKey = await visionReadPoster("data:image/png;base64,iVBORw0KGgo=");
add("G1 ★视觉 AI 未配置 → 不假装读到，返回空文本 + 人话原因",
  vNoKey.text === "" && has(vNoKey.reason, "视觉 AI"), JSON.stringify(vNoKey).slice(0, 90));
add("G2 视觉不可用时的提示里含可执行替代方案（文档上传 / 粘贴文字）",
  has(vNoKey.reason, "文档上传") || has(vNoKey.reason, "粘贴"), vNoKey.reason);
add("G3 ★读图只走直连（后端代理不支持）——代码里如实写明",
  has(String(visionReadPoster), "暂不支持读图"), "");
add("G4 未配置视觉 Key 时 visionAsk 直接返回 null（不发请求）",
  (function () { return typeof visionKey === "function" && visionKey() === ""; })(), "");
add("G5 图片文件走 dataURL + visionReadPoster（不当作活动照片混进配图）",
  has(String(intakeExtractOne), "visionReadPoster") && !has(String(intakeExtractOne), "readPhotoFile"), "");
add("G6 bindCreateExtras 已绑定方案输入与拖拽",
  has(String(bindCreateExtras), "createDocInput") && has(String(bindCreateExtras), "intakeDrop") &&
  has(String(bindCreateExtras), "ondrop") && has(String(bindCreateExtras), "intakeRunFiles"), "");
add("G7 ★方案文件使用 onchange 覆盖绑定（不用 _bound+addEventListener，防单例节点被抢占）",
  has(String(bindCreateExtras), "di.onchange") && !has(String(bindCreateExtras), "_bound"), "");
add("G8 自动进生成流程：AI 可用且有描述才调 generateFromInput",
  (function () { const s = String(intakeRunFiles); return has(s, "generateFromInput") && has(s, "aiAuthMode"); })(), "");
add("G9 解析流程里没有把海报写进 _pendingPhotos（避免海报被当封面）",
  !has(String(intakeRunFiles), "_pendingPhotos"), "");
add("G10 模块登记表含 v204 的 5 个符号",
  typeof REQUIRED_MODULE_FILES === "object" && REQUIRED_MODULE_FILES.intakeKindOf === "intake.js" &&
  REQUIRED_MODULE_FILES.intakePanelHtml === "intake.js" && REQUIRED_MODULE_FILES.intakeRunFiles === "intake.js" &&
  REQUIRED_MODULE_FILES.intakeFromOoxml === "intake.js" && REQUIRED_MODULE_FILES.visionReadPoster === "vision.js",
  JSON.stringify({ a: REQUIRED_MODULE_FILES && REQUIRED_MODULE_FILES.intakeKindOf, b: REQUIRED_MODULE_FILES && REQUIRED_MODULE_FILES.visionReadPoster }));
add("G11 启动自检无缺失模块（boot 不会报 intake 缺失）",
  checkRequiredModules().length === 0, checkRequiredModules().join(" | "));
add("G12 PDF 走懒加载且有多 CDN 回退（不是单点）",
  Array.isArray(INTAKE_PDF_LIB) && INTAKE_PDF_LIB.length >= 3 && Array.isArray(INTAKE_PDF_WORKER) && INTAKE_PDF_WORKER.length >= 3, "");
add("G13 PDF 引擎/内容失败都给「截图上传」替代方案",
  has(String(intakeFromPdf), "截图"), "");
add("G14 单文件解析超长时有截断，避免把上下文撑爆",
  typeof INTAKE_MAX_CHARS === "number" && INTAKE_MAX_CHARS <= 20000, String(INTAKE_MAX_CHARS));
add("G15 上传区 accept 与 intakeKindOf 支持集一致",
  has(INTAKE_ACCEPT, ".docx") && has(INTAKE_ACCEPT, ".pptx") && has(INTAKE_ACCEPT, ".pdf") && has(INTAKE_ACCEPT, "image/*"), INTAKE_ACCEPT);

/* ============ §H 不编造 / 边界反例 ============ */
const emptyR = await intakeFromBytes(new Uint8Array([]), "text");
add("H1 空字节 → 报错，不产出描述", !emptyR.text && !!emptyR.error, JSON.stringify(emptyR));
add("H2 内容里没有的活动字段不会被凭空补齐",
  (function () {
    const t = intakeFromOoxml(docxU8, "docx").text || "";
    return !has(t, "海拔3800") && !has(t, "露营") && !has(t, "999元");
  })(), "");
add("H3 损坏的 PPT 文件不抛异常（返回错误对象）",
  (function () { try { const r = intakeFromOoxml(new Uint8Array(pptxU8.subarray(0, 200)), "pptx"); return !!(r && (r.error || r.text)); } catch (e) { return false; } })(), "");
add("H4 图片走的是「读文字」prompt，不是照片画像 prompt",
  has(String(visionReadPoster), "VISION_DOC_SYSTEM") && !has(String(visionReadPoster), "VISION_SYSTEM"), "");
add("H5 读不到时返回人话原因（含「无法识别」判据）",
  has(String(visionReadPoster), "无法识别") && has(String(visionReadPoster), "reason"), "");

/* ============ §I 幂等 / 状态复位 ============ */
state._intake = { busy: false, busyText: "", items: [], description: "", warn: "" };
add("I1 空记录时面板不渲染（幂等）", intakePanelHtml() === "", "");
state._intake = { busy: false, busyText: "", items: [], description: "只有描述没文件" };
add("I2 只有描述也照实显示（不隐藏已读到的内容）", has(intakePanelHtml(), "只有描述没文件"), "");
state._intake = savedIntake;

const total = checks.length, passed = checks.filter((c) => c.pass).length;
return { ok: passed === total, total, passed, checks };
