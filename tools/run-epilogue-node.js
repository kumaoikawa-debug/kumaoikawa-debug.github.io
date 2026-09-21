// 最小 harness：在 Node 里模拟浏览器全局，加载 Renderer + 契约测试
const fs = require('fs');
const path = require('path');
global.window = global;
global.document = { readyState: 'complete', addEventListener: function () {} };
const root = path.resolve(__dirname, '..');
function load(f) { eval(fs.readFileSync(path.join(root, f), 'utf8')); }
load('src/aiPromoRenderer.js');
load('case-v230-vnext.epilogue.js');
console.log('__V230_VNEXT_OK =', global.__V230_VNEXT_OK);
process.exit(global.__V230_VNEXT_OK ? 0 : 1);
