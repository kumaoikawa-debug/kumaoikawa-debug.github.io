// 第二阶段 harness：在 Node 里模拟浏览器全局，加载渠道 Renderer + 契约测试
// 与 v230 harness 相互独立，v230 基线（8/8）保持不变。
const fs = require('fs');
const path = require('path');
global.window = global;
global.document = { readyState: 'complete', addEventListener: function () {} };
const root = path.resolve(__dirname, '..');
function load(f) { eval(fs.readFileSync(path.join(root, f), 'utf8')); }
load('src/aiChannelRenderer.js');
load('case-v231-channel.epilogue.js');
console.log('__V231_CHANNEL_OK =', global.__V231_CHANNEL_OK);
process.exit(global.__V231_CHANNEL_OK ? 0 : 1);
