/* ==========================================================================
 * case-v232-recap.epilogue.js —— 第三阶段（活动回顾）契约测试（§18 / §28）
 *
 * 在 harness（加载 src/aiPromoRenderer.js + src/aiVnext.js 后）运行，断言：
 *   1) 未生成时给「生成活动回顾」入口，不预设任何流程；
 *   2) 生成后把 AI 判断的「这一次真正值得记录的是什么」上屏；
 *   3) 回顾正文复用同一套「笨 Renderer」（12 个 block 类型），不另起一套模板；
 *   4) Renderer 绝不注入固定 skeleton（集合→出发→途中→合影→感谢→下一期）；
 *   5) 现场照片 src 解析自 activityMaster.photos（真实素材，不杜撰）；
 *   6) grounding 未通过时给出可见警示（§20）；
 *   7) §29 多样性闸门可见：宣传切口 / 相似度上屏，撞车时高亮告警；
 *   8) 空结果 / 空 blocks 不崩溃。
 *
 * 全部通过 → window.__V232_RECAP_OK = true
 * ========================================================================== */
(function () {
  'use strict';

  var fails = [];
  function ok(cond, msg) { if (!cond) fails.push(msg); else console.log('  ✓', msg); }

  // §28 明令禁止的固定 skeleton
  var FIXED_SKELETON = ['集合出发', '快乐出发', '途中的风景', '合影留念', '感谢每一位', '下一期再见', '期待下次'];

  function run() {
    if (typeof renderVnextRecapSection !== 'function') { console.error('renderVnextRecapSection 未加载'); return; }
    if (typeof renderPromoCanvas !== 'function') { console.error('renderPromoCanvas 未加载'); return; }

    // 1) 空态：只有入口，没有任何预设流程
    var empty = renderVnextRecapSection({ id: 'a1' });
    ok(empty.indexOf('vnextRecapGenerate') >= 0, '未生成时给「生成活动回顾」入口（data-action=vnextRecapGenerate）');
    var emptySkeleton = FIXED_SKELETON.filter(function (s) { return empty.indexOf(s) >= 0; });
    ok(emptySkeleton.length === 0, '空态不预设任何固定流程（' + (emptySkeleton.join('/') || '无') + '）');

    // 2) 已生成：worthRecording 上屏 + 正文走同一套 Renderer
    var result = {
      activityId: 'a1',
      worthRecording: '第一次有人在溪流边睡着了，没人催他',
      blocks: [
        { type: 'hero', headline: '溪边那半小时', sub: '整场最安静的一段' },
        { type: 'image_pair', mediaRefs: ['p1', 'p2'] },
        { type: 'text', text: '海拔爬升 1800m 之后，队伍在溪流边停了半小时。' },
        { type: 'cta', ctaText: '看看下一场' },
      ],
      grounding: { passed: true, issues: [] },
      diversity: {
        direction: { key: 'quiet', label: '安静的时刻', hint: '从「不赶路」切入' },
        repetition: { semantic: 0.18, layout: 0.1, repetitive: false },
      },
      activityMaster: {
        photos: [
          { id: 'p1', src: 'https://img/p1.jpg', caption: '溪流边', orientation: 'landscape' },
          { id: 'p2', src: 'https://img/p2.jpg', caption: '合影', orientation: 'landscape' },
        ],
      },
    };
    var html = renderVnextRecapSection({ id: 'a1', vnextRecap: result });

    ok(html.indexOf('第一次有人在溪流边睡着了') >= 0, '「这一次真正值得记录的是什么」上屏（AI 判断，非固定流程）');
    ok(html.indexOf('apc-hero') >= 0, '回顾正文复用 12 型「笨 Renderer」（hero 已渲染）');
    ok(html.indexOf('https://img/p1.jpg') >= 0 && html.indexOf('https://img/p2.jpg') >= 0,
      '现场照片 src 解析自 activityMaster.photos（真实素材，不杜撰）');
    ok(html.indexOf('vnextRecapGenerate') >= 0, '已生成时仍保留「重新回顾」入口');

    var injected = FIXED_SKELETON.filter(function (s) { return html.indexOf(s) >= 0; });
    ok(injected.length === 0, 'Renderer 未注入固定回顾 skeleton（' + (injected.join('/') || '无') + '）');

    // 3) grounding 未通过 → 可见警示（共用 Promo Canvas 的事实校验提示，§20）
    var bad = JSON.parse(JSON.stringify(result));
    bad.grounding = { passed: false, issues: [{ severity: 'block', field: 'text', message: '实际人数无据' }] };
    var badHtml = renderVnextRecapSection({ id: 'a1', vnextRecap: bad });
    ok(badHtml.indexOf('apc-grounding-bad') >= 0, 'grounding 未通过时给出可见警示（不静默放行）');

    // 4) §29 多样性闸门可见：切口 + 相似度上屏；撞车时高亮
    ok(html.indexOf('apc-diversity') >= 0 && html.indexOf('安静的时刻') >= 0,
      '§29 宣传切口上屏（闸门可见，不是黑箱）');
    ok(html.indexOf('18%') >= 0, '§29 与近期内容相似度上屏（0.18 → 18%）');
    var rep = JSON.parse(JSON.stringify(result));
    rep.diversity = { direction: { key: 'x', label: '另一种切口', hint: '' }, repetition: { semantic: 0.92, layout: 0.88, repetitive: true } };
    var repHtml = renderVnextRecapSection({ id: 'a1', vnextRecap: rep });
    ok(repHtml.indexOf('apc-diversity-bad') >= 0 && repHtml.indexOf('已强制换切口') >= 0,
      '§29 撞车时高亮告警（与近期内容过于相似 → 已强制换切口）');
    ok(renderVnextRecapSection({ id: 'a1', vnextRecap: { blocks: [{ type: 'text', text: 'x' }] } }).indexOf('apc-diversity') < 0,
      '无 diversity 元数据时不显示闸门行（不假装）');

    // 5) 非法输入不崩溃
    ok(renderVnextRecapSection({ id: 'a1', vnextRecap: { blocks: [] } }).indexOf('vnextRecapGenerate') >= 0,
      '空 blocks 回落空态（不崩溃）');
    ok(renderVnextRecapSection(null) === '', '无活动对象返回空（不崩溃）');

    if (fails.length === 0) {
      window.__V232_RECAP_OK = true;
      console.log('%c[V232 recap] 契约测试全部通过', 'color:#1a7f37;font-weight:bold');
    } else {
      window.__V232_RECAP_OK = false;
      console.error('[V232 recap] 契约测试失败：', fails);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  } else {
    run();
  }
})();
