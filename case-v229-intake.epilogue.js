/* v229 契约：intake 无 AI 兜底——页码坐标「【第 N 页】」不进描述 + 未配置指路文案
   运行：node case-v229-intake.epilogue.js（vm 沙箱，无浏览器依赖） */
"use strict";
const vm = require("vm");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "src", "intake.js");
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(SRC, "utf8"), ctx);
vm.runInContext(
  "this.__t = { fb: intakeFallbackDescription, clean: intakeCleanText };",
  ctx
);
const { fb, clean } = ctx.__t;

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log("PASS · " + name); }
  else { fail++; console.log("FAIL · " + name); }
}

const sample = [
  "【第 1 页】",
  "成都集合出发，前往康定城区",
  "12:00 - 13:00 康定城区午餐 · 王府（溜溜城店）",
  "【第 2 页】",
  "08:00 - 08:30 酒店早餐",
  "13:00 - 19:00 乘车返回成都",
].join("\n");

/* F 组：页码坐标整行剥离，正文一字不动 */
const out = fb(sample);
ok("F1 描述不含【第 1 页】", out.indexOf("【第 1 页】") === -1);
ok("F2 描述不含【第 2 页】", out.indexOf("【第 2 页】") === -1);
ok("F3 正文行全部保留", out.indexOf("成都集合出发，前往康定城区") !== -1
  && out.indexOf("12:00 - 13:00 康定城区午餐 · 王府（溜溜城店）") !== -1
  && out.indexOf("08:00 - 08:30 酒店早餐") !== -1
  && out.indexOf("13:00 - 19:00 乘车返回成都") !== -1);
ok("F4 剥离后不留假空行", out.indexOf("\n\n") === -1);

/* F5：行中间出现的「第 1 页」字样（非整行坐标）不误伤 */
ok("F5 行内页码字样不误伤", fb("今天出发第 1 页内容要讲清集合时间").indexOf("第 1 页") !== -1);

/* F6：空输入安全 */
ok("F6 空输入返回空串", fb("") === "" && fb(null) === "");

/* F7：页码行带尾随空格也剥 */
ok("F7 页码行带尾随空格也剥", fb("【第 3 页】 \n内容X").indexOf("【第 3 页】") === -1 && fb("【第 3 页】 \n内容X").indexOf("内容X") !== -1);

/* C 组：cleanText 基线不回归（v228 之前的行为） */
ok("C1 控制字符被剥", clean("a\u0007b").indexOf("\u0007") === -1);
ok("C2 纯装饰行（---）丢弃", clean("---\n正文").indexOf("---") === -1);

/* W 组：intakeRunFiles 的未配置指路文案（源码级断言，避免拖起整个 state 依赖） */
const src = fs.readFileSync(SRC, "utf8");
ok("W1 未配置文案指路「设置 → AI 设置」", src.indexOf("到「设置 → AI 设置」填「后端地址+管理员口令+商家ID」") !== -1);
ok("W2 图片未配置文案指路", src.indexOf("到「设置 → AI 设置」连接后端可自动整理") !== -1);

/* S 组：shell.js / activities.js 接线（源码级） */
const shellSrc = fs.readFileSync(path.join(__dirname, "src", "shell.js"), "utf8");
ok("S1 generateFromInput 未配置→滚到 aiSettingsBox 并高亮", shellSrc.indexOf('document.getElementById("aiSettingsBox")') !== -1 && shellSrc.indexOf("flash-hint") !== -1);
ok("S2 空输入聚焦输入框", shellSrc.indexOf("先在框里写一句话描述活动") !== -1);
ok("S3 saveAISettings 回读校验防静默丢配置", shellSrc.indexOf("配置没能保存：浏览器阻止了本地存储") !== -1);

const actSrc = fs.readFileSync(path.join(__dirname, "src", "activities.js"), "utf8");
ok("S4 dashboard AI 未连接横条", actSrc.indexOf('class="ai-off-banner"') !== -1 && actSrc.indexOf('data-view="ai"') !== -1);
ok("S5 AI 设置面板挂 aiSettingsBox 锚点", actSrc.indexOf('id="aiSettingsBox"') !== -1);

const cssSrc = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");
ok("S6 横条与高亮样式存在", cssSrc.indexOf(".ai-off-banner{") !== -1 && cssSrc.indexOf(".flash-hint{") !== -1);

console.log("\n" + pass + "/" + (pass + fail) + " passed");
process.exit(fail ? 1 : 0);
