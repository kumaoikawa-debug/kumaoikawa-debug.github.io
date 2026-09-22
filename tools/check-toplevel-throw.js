// v239 守护：publish.js 顶层曾因引用已删除的 photoDayNight 而 ReferenceError 中断，
// 后续 let 声明全部进入永久 TDZ →「AI 生成活动」走到 photoContentProfile 时
// unhandled rejection 静默死掉（AI 调用全成功、页面不跳转、无任何报错）。
// 离线 epilogue harness 只加载 aiPromoRenderer/aiVnext，从不加载 publish/shell，所以全绿照样翻车。
// 本脚本按 index.html 的 script 顺序在 Node 里加载全部 src，任何顶层 throw = 失败。
// 局限：只捕捉「未定义标识符 / TDZ / 顶层逻辑炸」类哑弹，不模拟完整 DOM。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/<script[^>]+src="(src\/[^"]+)"/g)].map((m) => m[1].replace(/\?.*$/, ""));
if (!files.length) { console.error('index.html 中未解析到 src 脚本'); process.exit(1); }

function stubEl() {
  return { style: {}, innerHTML: '', textContent: '', value: '', className: '', id: '',
    setAttribute: function () {}, getAttribute: function () { return null; },
    appendChild: function () {}, removeChild: function () {}, remove: function () {},
    addEventListener: function () {}, classList: { add: function () {}, remove: function () {}, toggle: function () {} },
    querySelector: function () { return null; }, querySelectorAll: function () { return [] }, focus: function () {}, blur: function () {} };
}
global.window = global;
global.document = {
  readyState: 'complete',
  addEventListener: function () {},
  getElementById: function () { return stubEl(); },
  querySelector: function () { return stubEl(); },
  querySelectorAll: function () { return []; },
  createElement: function () { return stubEl(); },
  body: { appendChild: function () {}, classList: { add: function () {}, remove: function () {} } },
  head: { appendChild: function () {} },
};
global.navigator = { userAgent: 'node-guard' };
global.location = { href: 'http://localhost/', hash: '', search: '' };
global.localStorage = { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
global.fetch = function () { return Promise.reject(new Error('offline-guard')); };
global.alert = function () {};
global.requestAnimationFrame = function (f) { return 0; };

let fails = 0;
for (const f of files) {
  const p = path.join(root, f);
  if (!fs.existsSync(p)) { console.error('  ✗ ' + f + ' 文件不存在（index.html 引用了缺失脚本）'); fails += 1; continue; }
  try {
    vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: f });
    console.log('  ✓ ' + f + ' 顶层加载 OK');
  } catch (e) {
    console.error('  ✗ ' + f + ' 顶层抛错: ' + e.message);
    fails += 1;
  }
}
console.log(fails ? '顶层加载守护：失败 ' + fails : '顶层加载守护：' + files.length + ' 个文件全 OK');
process.exit(fails ? 1 : 0);
