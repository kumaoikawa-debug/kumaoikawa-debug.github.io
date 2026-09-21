/* ==========================================================================
 * aiPromoRenderer.js —— AI Promo Canvas 「笨 Renderer」（Clean Rewrite §11）
 *
 * 设计纪律（§11 / §12）：
 *   - 只执行 AI 的策划（blocks 序列），绝不自行添加：
 *       固定标题 / 营销金句 / 固定「为什么值得去」/ 自动 Quote / 固定 CTA 位置 / 按活动类型切模板
 *   - Block 类型有限（12），但顺序 / 数量 / 组合完全由 AI 决定；
 *   - 图文布局由 block + 图片本身（朝向 / 主体）共同决定；
 *   - 高风险人物图不强行填满容器（subjects 含人物时优先完整展示）。
 *
 * 本文件为扁平 classic script：顶层函数即全局，供 activities.js 直接调用。
 * ========================================================================== */

(function () {
  'use strict';

  // esc 兜底：真实环境由 core.js 提供，单测/契约环境可独立运行
  var esc = (typeof window !== 'undefined' && typeof window.esc === 'function')
    ? window.esc
    : function (s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
      };

  // 12 个允许的 block 类型（与后端白名单一致，§10）
  var BLOCK_TYPES = [
    'hero', 'text', 'statement', 'metric_strip', 'single_image',
    'image_pair', 'image_triplet', 'image_group', 'text_image',
    'quote', 'divider', 'cta'
  ];

  function mediaMapFrom(photos) {
    var m = {};
    (photos || []).forEach(function (p) { m[p.id] = p; });
    return m;
  }

  function imgTag(ref, media, fit) {
    if (!ref) return '';
    var src = (media && media.src) || ref;
    var alt = (media && media.caption) || '';
    var subj = (media && media.subjects) || [];
    // 高风险人物图：优先完整展示（contain），避免切头切脚
    var isPerson = /人|队员|领队|客|娃|儿童|亲子/.test(subj.join('/') + ' ' + alt);
    var cls = 'apc-img' + (isPerson ? ' apc-img-person' : '');
    return '<img class="' + cls + '" src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" style="' +
      (fit ? 'aspect-ratio:' + fit + ';' : '') + '">';
  }

  function blockImages(mediaRefs, mediaMap, layout) {
    var refs = (mediaRefs || []).map(function (id) { return mediaMap[id]; }).filter(Boolean);
    if (!refs.length) return '';
    if (layout === 'pair') {
      return '<div class="apc-pair">' + refs.slice(0, 2).map(function (r) {
        var fit = (r.orientation === 'portrait') ? '3/4' : (r.orientation === 'landscape' ? '4/3' : '1/1');
        return '<div class="apc-cell">' + imgTag(r.src, r, fit) + '</div>';
      }).join('') + '</div>';
    }
    if (layout === 'triplet') {
      return '<div class="apc-triplet">' + refs.slice(0, 3).map(function (r) {
        return '<div class="apc-cell">' + imgTag(r.src, r, '1/1') + '</div>';
      }).join('') + '</div>';
    }
    if (layout === 'group') {
      return '<div class="apc-group">' + refs.map(function (r) {
        return '<div class="apc-cell">' + imgTag(r.src, r, '1/1') + '</div>';
      }).join('') + '</div>';
    }
    // single
    var r = refs[0];
    var fit = (r.orientation === 'portrait') ? '3/4' : (r.orientation === 'landscape' ? '16/10' : '1/1');
    return '<div class="apc-single">' + imgTag(r.src, r, fit) + '</div>';
  }

  function renderBlock(b, mediaMap) {
    if (BLOCK_TYPES.indexOf(b.type) < 0) return ''; // 未知类型直接丢弃，保证可控
    switch (b.type) {
      case 'hero': {
        var heroImg = (b.mediaRefs && b.mediaRefs[0]) ? mediaMap[b.mediaRefs[0]] : null;
        var heroFit = (heroImg && heroImg.orientation === 'portrait') ? '3/4' : '16/9';
        return '<section class="apc-block apc-hero">' +
          (heroImg ? '<div class="apc-hero-img">' + imgTag(heroImg.src, heroImg, heroFit) + '</div>' : '') +
          '<div class="apc-hero-txt">' +
          (b.headline ? '<h1 class="apc-h1">' + esc(b.headline) + '</h1>' : '') +
          (b.subtitle ? '<p class="apc-sub">' + esc(b.subtitle) + '</p>' : '') +
          '</div></section>';
      }
      case 'text':
        return '<section class="apc-block apc-text"><p>' + esc(b.text || '') + '</p></section>';
      case 'statement':
        return '<section class="apc-block apc-statement"><p>' + esc(b.text || '') + '</p></section>';
      case 'quote':
        return '<section class="apc-block apc-quote"><blockquote>' + esc(b.text || '') + '</blockquote></section>';
      case 'metric_strip': {
        var ms = (b.metrics || []).map(function (x) {
          return '<div class="apc-metric"><b>' + esc(x.value || '') + '</b><span>' + esc(x.label || '') + '</span></div>';
        }).join('');
        return '<section class="apc-block apc-metrics">' + ms + '</section>';
      }
      case 'single_image':
        return '<section class="apc-block apc-media">' + blockImages(b.mediaRefs, mediaMap, 'single') + '</section>';
      case 'image_pair':
        return '<section class="apc-block apc-media">' + blockImages(b.mediaRefs, mediaMap, 'pair') + '</section>';
      case 'image_triplet':
        return '<section class="apc-block apc-media">' + blockImages(b.mediaRefs, mediaMap, 'triplet') + '</section>';
      case 'image_group':
        return '<section class="apc-block apc-media">' + blockImages(b.mediaRefs, mediaMap, 'group') + '</section>';
      case 'text_image':
        return '<section class="apc-block apc-text-image">' +
          '<div class="apc-ti-txt">' +
          (b.headline ? '<h2 class="apc-h2">' + esc(b.headline) + '</h2>' : '') +
          (b.body ? '<p>' + esc(b.body) + '</p>' : '') +
          '</div>' +
          blockImages(b.mediaRefs, mediaMap, 'single') +
          '</section>';
      case 'divider':
        return '<section class="apc-block apc-divider"><hr></section>';
      case 'cta':
        return '<section class="apc-block apc-cta">' +
          '<button class="btn btn-primary apc-cta-btn" data-action="' + esc(b.ctaAction || 'signup') + '">' +
          esc(b.ctaText || '立即报名') + '</button></section>';
      default:
        return '';
    }
  }

  /** 渲染整个 Promo Canvas（不含任何固定外层结构） */
  function renderPromoCanvas(vnextPromo, opts) {
    opts = opts || {};
    if (!vnextPromo || !Array.isArray(vnextPromo.blocks) || !vnextPromo.blocks.length) {
      return '';
    }
    var mediaMap = mediaMapFrom((vnextPromo.activityMaster && vnextPromo.activityMaster.photos) || []);
    var html = vnextPromo.blocks.map(function (b) { return renderBlock(b, mediaMap); }).join('');
    // grounding 报告（§20）：若未通过，给出可见提示，但不篡改内容
    var g = vnextPromo.grounding;
    var warn = '';
    if (g && !g.passed) {
      var n = (g.issues || []).filter(function (i) { return i.severity === 'block'; }).length;
      warn = '<div class="apc-grounding apc-grounding-bad">⚠ 事实校验发现 ' + n +
        ' 处疑似编造（天气/名额/价格等），请人工复核后再发布。</div>';
    } else if (g && g.issues && g.issues.length) {
      warn = '<div class="apc-grounding apc-grounding-warn">⚠ 事实校验提示 ' + g.issues.length + ' 条（多为弱信号），建议复核。</div>';
    }
    return '<div class="apc" data-vnext="1">' + warn + html + '</div>';
  }

  // 暴露全局
  window.renderPromoCanvas = renderPromoCanvas;
  window.APC_BLOCK_TYPES = BLOCK_TYPES;
})();
