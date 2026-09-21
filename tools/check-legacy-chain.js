/* ==========================================================================
 * check-legacy-chain.js —— 旧 AI 内容主链「已断开」契约（Clean Rewrite §0 / §4）
 *
 * 为什么需要它：新引擎的契约（v230/v231/v232）全绿，与「旧链仍在正式路径上跑」
 * 可以**同时成立**——2026-09-21 盘点时就是这种状态：宣发中心两个主按钮仍调
 * genStrategy → genRecruit/genRecap，而新引擎的 61 条断言照样全绿。
 * 所以这条契约盯的不是「新引擎是否存在」，而是「旧链还有没有调用点」。
 *
 * 断言：
 *   1) genStrategy / genRecruit / genRecap 在 src/ 下零调用点（只许有定义）
 *   2) 宣发中心 runRecruitGen → generateVnextChannels（新引擎 /channel）
 *   3) 宣发中心 runRecapGen   → generateVnextRecap（新引擎 /recap）
 *   4) switchStyle 不再消费 family / variant / styleSeed（旧「换风格=换 CSS」）
 *   5) publish.js 结果区两个入口都有新引擎分支
 *   6) 回滚点 tag clubos-ai-content-legacy 存在
 *   7) 自检：把源码换成旧形态，契约必须变红（否则这条契约没牙）
 *
 * 用法：node tools/check-legacy-chain.js [--self-test]
 * ========================================================================== */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const FILES = ['src/publish.js', 'src/shell.js', 'src/aiVnext.js', 'src/activities.js', 'src/core.js'];
const LEGACY_FNS = ['genStrategy', 'genRecruit', 'genRecap'];

/** 统计某函数在源码里的「调用点」数量（排除 function 定义行与注释行） */
function countCalls(src, fn) {
  const lines = src.split('\n');
  let n = 0;
  lines.forEach((line) => {
    const code = line.replace(/\/\/.*$/, '');
    if (new RegExp('\\bfunction\\s+' + fn + '\\b').test(code)) return; // 定义行
    if (new RegExp('\\b' + fn + '\\s*\\(').test(code)) n += 1;
  });
  return n;
}

function run() {
  const fails = [];
  const ok = (cond, msg) => { if (!cond) fails.push(msg); else console.log('  ✓', msg); };
  const src = {};
  FILES.forEach((f) => { try { src[f] = read(f); } catch (e) { src[f] = ''; } });
  const all = FILES.map((f) => src[f]).join('\n');

  console.log('— 旧 AI 生成主链已断开（§4）—');
  LEGACY_FNS.forEach((fn) => {
    const total = FILES.reduce((acc, f) => acc + countCalls(src[f], fn), 0);
    ok(total === 0, `${fn} 调用点 = ${total}（旧链已停止调用，仅保留定义用于渲染历史产物）`);
  });

  console.log('— 宣发中心正式路径走新引擎 —');
  const shell = src['src/shell.js'];
  const recruitBody = (shell.match(/async function runRecruitGen\(\)[\s\S]*?\n  \}/) || [''])[0];
  const recapBody = (shell.match(/async function runRecapGen\(\)[\s\S]*?\n  \}/) || [''])[0];
  ok(/generateVnextChannels\(/.test(recruitBody), 'runRecruitGen 走 generateVnextChannels（/api/content-vnext/channel）');
  ok(/generateVnextRecap\(/.test(recapBody), 'runRecapGen 走 generateVnextRecap（/api/content-vnext/recap）');
  ok(!/genStrategy|genRecruit|genRecap/.test(recruitBody + recapBody), '两个生成入口内无任何旧链调用');

  console.log('— 换风格不再是「换 CSS」—');
  const switchBody = (shell.match(/case "switchStyle":[\s\S]*?break;\s*\n\s*\}/) || [''])[0];
  ok(!/xf\.family\s*=|xf\.variant\s*=|xf\.styleSeed\s*=/.test(switchBody),
    'switchStyle 不再写 family / variant / styleSeed（§4 禁止的固定 Family/Variant/Style）');
  ok(/generateVnextChannels\(/.test(switchBody), 'switchStyle 改为用新引擎重新策划（换宣传切口）');

  console.log('— 结果区渲染新引擎产出 —');
  const publish = src['src/publish.js'];
  ok(/vnextRecruitResult\(/.test(publish) && /_vc\.wechat/.test(publish),
    'recruitResult 有「新引擎产出优先」分支');
  ok(/vnextRecapResult\(/.test(publish) && /vnextRecap/.test(publish),
    'recapResult 有「新引擎产出优先」分支');
  ok(/renderChannelResult\(/.test(publish), '宣发结果复用渠道 Renderer（不另起模板）');

  console.log('— 回滚点 —');
  let hasTag = false;
  try {
    hasTag = execSync('git tag -l clubos-ai-content-legacy', { cwd: root }).toString().trim().length > 0;
  } catch (e) { hasTag = false; }
  ok(hasTag, '回滚 tag clubos-ai-content-legacy 存在');

  console.log('通过 ' + (14 - fails.length) + '，失败 ' + fails.length);
  if (fails.length) { console.error('失败项：', fails); process.exit(1); }
  console.log('%c[legacy chain] 旧链已断开，宣发走新引擎', 'color:#1a7f37;font-weight:bold');
}

/* 自检：把源码换成「旧形态」，契约必须变红 —— 否则说明断言没牙 */
function selfTest() {
  console.log('— 自检（反向验证：旧形态必须让契约变红）—');
  const badShell = `async function runRecruitGen() {
  xf.strategy = await genStrategy(a, actPhotos, xf.notes, "recruit");
  xf.out = await genRecruit(a, xf.master, xf.strategy);
  xf.family = xf.strategy.editorialDirection.family;
}`;
  const cases = [
    ['旧链调用被检出', countCalls(badShell, 'genStrategy') > 0],
    ['旧链调用被检出(genRecruit)', countCalls(badShell, 'genRecruit') > 0],
    ['定义行不算调用', countCalls('async function genStrategy(a, photos) {', 'genStrategy') === 0],
    ['新引擎调用被识别', /generateVnextChannels\(/.test('const out = await generateVnextChannels(a.id);')],
  ];
  let bad = 0;
  cases.forEach(([m, c]) => { if (!c) { bad += 1; console.error('  ✗', m); } else console.log('  ✓', m); });
  if (bad) { console.error('自检失败：契约对旧形态不敏感'); process.exit(1); }
  console.log('自检通过：契约有牙');
}

if (process.argv.includes('--self-test')) selfTest();
else { run(); if (process.argv.includes('--with-self-test')) selfTest(); }
