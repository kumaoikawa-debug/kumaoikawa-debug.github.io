// 第三阶段 harness：在 Node 里模拟浏览器全局，加载笨 Renderer + aiVnext 协调层 + 回顾契约测试
// 与 v230 / v231 harness 相互独立，前两阶段基线保持不变。
const fs = require('fs');
const path = require('path');
global.window = global;
global.document = { readyState: 'complete', addEventListener: function () {} };
// aiVnext.js 的渲染函数在真实环境由 core.js 提供 ICON / esc；契约环境降级为空
global.ICON = function () { return ''; };
const root = path.resolve(__dirname, '..');
function load(f) { eval(fs.readFileSync(path.join(root, f), 'utf8')); }
load('src/aiPromoRenderer.js');
load('src/aiVnext.js');
load('case-v232-recap.epilogue.js');
console.log('__V232_RECAP_OK =', global.__V232_RECAP_OK);
process.exit(global.__V232_RECAP_OK ? 0 : 1);
