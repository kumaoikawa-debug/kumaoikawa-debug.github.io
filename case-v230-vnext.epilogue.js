/* ==========================================================================
 * case-v230-vnext.epilogue.js —— 第一阶段契约测试（Clean Rewrite §26 DoD #3/#4/#5/#10）
 *
 * 在 harness（加载 core.js + aiPromoRenderer.js 后）运行，断言：
 *   1) 笨 Renderer 只执行 AI 策划，绝不注入固定章节/标题/金句；
 *   2) Block 类型严格 12 种（§10）；
 *   3) 不同 block 序列产出不同结构（顺序/数量不固定，§9）；
 *   4) grounding 未通过时在 Canvas 给出可见警示（§20）。
 *
 * 全部通过 → window.__V230_VNEXT_OK = true；否则记录失败条数。
 * ========================================================================== */
(function () {
  'use strict';

  var fails = [];
  function ok(cond, msg) { if (!cond) fails.push(msg); else console.log('  ✓', msg); }

  function run() {
    if (typeof renderPromoCanvas !== 'function') { console.error('renderPromoCanvas 未加载'); return; }

    // 1) 12 型白名单
    ok(window.APC_BLOCK_TYPES && window.APC_BLOCK_TYPES.length === 12,
      'Promo Block 类型严格 12 种（hero/text/statement/metric_strip/single_image/image_pair/image_triplet/image_group/text_image/quote/divider/cta）');

    // 2) 只给一个 text block，Renderer 不得注入固定章节
    var fixedSections = ['为什么值得去', '活动体验', '适合谁', '活动收获', '为什么去', '体验什么', '收获什么'];
    var out1 = renderPromoCanvas({ blocks: [{ type: 'text', text: '这是一段基于资料的事实描述。' }] }, {});
    var injected = fixedSections.filter(function (s) { return out1.indexOf(s) >= 0; });
    ok(injected.length === 0, 'Renderer 未注入任何固定章节骨架（' + (injected.join('/') || '无') + '）');
    ok(out1.indexOf('这是一段基于资料的事实描述。') >= 0, 'Renderer 原样执行 AI 的 text block（不篡改内容）');

    // 3) hero block 被执行（证明按 AI 策划渲染，而非套模板）
    var out2 = renderPromoCanvas({ blocks: [{ type: 'hero', headline: '蓥华山森林瑜伽', subtitle: '徒步+瑜伽一日' }] }, {});
    ok(out2.indexOf('蓥华山森林瑜伽') >= 0, 'hero block 的 headline 被正确渲染（执行 AI 策划）');

    // 4) 不同结构：顺序/数量不固定
    var a = renderPromoCanvas({ blocks: [{ type: 'hero', headline: 'A' }, { type: 'text', text: 'B' }, { type: 'cta', ctaText: '报名' }] }, {});
    var b = renderPromoCanvas({ blocks: [{ type: 'statement', text: 'S' }, { type: 'image_pair', mediaRefs: ['x', 'y'] }, { type: 'quote', text: 'Q' }, { type: 'divider' }, { type: 'text', text: 'T' }] }, {});
    ok(a !== b, '不同 block 序列产出不同 DOM 结构（顺序/数量不固定）');
    ok((a.match(/apc-block/g) || []).length === 3 && (b.match(/apc-block/g) || []).length === 5,
      'block 数量由 AI 决定（3 vs 5，非固定）');

    // 5) grounding 未通过 → 可见警示
    var outBad = renderPromoCanvas({
      blocks: [{ type: 'text', text: 'X' }],
      grounding: { passed: false, issues: [{ severity: 'block', field: 'weather', snippet: '日照金山', reason: 'r' }] },
    }, {});
    ok(outBad.indexOf('apc-grounding-bad') >= 0, 'grounding 未通过时 Canvas 给出可见警示（§20）');

    // 6) 未知 block 类型被丢弃（保证前端可控）
    var outUnknown = renderPromoCanvas({ blocks: [{ type: 'hero', headline: 'H' }, { type: 'evil_template', text: 'X' }] }, {});
    ok(outUnknown.indexOf('evil_template') < 0, '未知 block 类型被丢弃（不渲染、不报错）');

    if (fails.length === 0) {
      window.__V230_VNEXT_OK = true;
      console.log('%c[V230 vnext] 契约测试全部通过', 'color:#1a7f37;font-weight:bold');
    } else {
      window.__V230_VNEXT_OK = false;
      console.error('[V230 vnext] 契约测试失败：', fails);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  } else {
    run();
  }
})();
