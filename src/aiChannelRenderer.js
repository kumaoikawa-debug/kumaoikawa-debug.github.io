/* ==========================================================================
 * aiChannelRenderer.js —— 宣发渠道前端渲染（Clean Rewrite §17 / §27 第二阶段）
 *
 * 四个渠道共享同一 Activity Master，各自独立策划，前端各自渲染：
 *   - wechat      微信公众号长文：后端已产出可直接粘贴后台的 HTML，前端原样预览 + 复制
 *   - xiaohongshu 小红书笔记：结构化字段渲染为笔记卡片
 *   - poster      海报内容结构：结构化字段渲染为海报骨架
 *   - moments     朋友圈 / 群：轻量文案渲染
 *
 * 纪律：Renderer 只执行 AI/提取结果，绝不注入固定章节 / 营销金句 / 自动 Quote。
 * 扁平 classic script：顶层函数即全局。
 * ========================================================================== */
(function () {
  'use strict';

  var esc = (typeof window !== 'undefined' && typeof window.esc === 'function')
    ? window.esc
    : function (s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
      };

  // ICON 兜底：真实环境由 core.js 提供；契约测试环境（Node harness）降级为空
  var icon = (typeof ICON === 'function') ? ICON : function () { return ''; };

  function mediaMapFrom(photos) {
    var m = {};
    (photos || []).forEach(function (p) { m[p.id] = p; });
    return m;
  }

  function copyBtn(channel, label) {
    return '<button class="btn btn-ghost btn-sm" data-action="vnextCopyChannel" data-channel="' + esc(channel) + '">' + icon('copy') + ' ' + label + '</button>';
  }

  function renderWechatPreview(result) {
    var c = result.content || {};
    var html = c.html || '';
    return '<div class="ch ch-wechat">' +
      '<div class="ch-bar"><span class="ch-bar-t">微信公众号长文</span>' + copyBtn('wechat', '复制 HTML') + '</div>' +
      '<div class="ch-wechat-preview">' + html + '</div></div>';
  }

  function renderXhsPreview(result) {
    var c = result.content || {};
    var mm = mediaMapFrom((result.activityMaster && result.activityMaster.photos) || []);
    var tags = (c.tags || []).map(function (t) { return '<span class="ch-tag">' + esc(t) + '</span>'; }).join('');
    var imgs = (c.imageOrder || []).map(function (id) {
      var m = mm[id];
      return m ? '<img class="ch-xhs-img" src="' + esc(m.src) + '" alt="' + esc(m.caption || '') + '" loading="lazy">' : '';
    }).join('');
    return '<div class="ch ch-xhs">' +
      '<div class="ch-bar"><span class="ch-bar-t">小红书笔记</span>' + copyBtn('xiaohongshu', '复制文案') + '</div>' +
      '<div class="ch-xhs-card">' +
      (imgs ? '<div class="ch-xhs-cover">' + imgs + '</div>' : '') +
      '<h2 class="ch-xhs-title">' + esc(c.title || '') + '</h2>' +
      (c.hook ? '<p class="ch-xhs-hook">' + esc(c.hook) + '</p>' : '') +
      (c.body ? '<div class="ch-xhs-body">' + esc(c.body).replace(/\n/g, '<br>') + '</div>' : '') +
      (tags ? '<div class="ch-xhs-tags">' + tags + '</div>' : '') +
      (c.ctaText ? '<div class="ch-xhs-cta">' + esc(c.ctaText) + '</div>' : '') +
      '</div></div>';
  }

  function renderPosterPreview(result) {
    var c = result.content || {};
    var hl = (c.highlights || []).map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('');
    return '<div class="ch ch-poster">' +
      '<div class="ch-bar"><span class="ch-bar-t">海报内容结构</span>' + copyBtn('poster', '复制结构') + '</div>' +
      '<div class="ch-poster-card">' +
      '<div class="ch-poster-name">' + esc(c.name || '') + '</div>' +
      '<div class="ch-poster-meta">' + esc(c.date || '') + (c.location ? ' · ' + esc(c.location) : '') + '</div>' +
      '<div class="ch-poster-price">' + esc(c.priceText || '') + (c.participation ? '　' + esc(c.participation) : '') + '</div>' +
      (c.sellingPoint ? '<div class="ch-poster-point">' + esc(c.sellingPoint) + '</div>' : '') +
      (hl ? '<ul class="ch-poster-hl">' + hl + '</ul>' : '') +
      (c.signup ? '<div class="ch-poster-signup">' + esc(c.signup) + '</div>' : '') +
      '</div></div>';
  }

  function renderMomentsPreview(result) {
    var c = result.content || {};
    return '<div class="ch ch-moments">' +
      '<div class="ch-bar"><span class="ch-bar-t">朋友圈 / 微信群</span>' + copyBtn('moments', '复制文案') + '</div>' +
      '<div class="ch-moments-text">' + esc(c.text || '').replace(/\n/g, '<br>') + '</div></div>';
  }

  /** 按渠道渲染预览（供 activities 详情页调用） */
  function renderChannelResult(result) {
    if (!result || !result.channel) return '';
    switch (result.channel) {
      case 'wechat': return renderWechatPreview(result);
      case 'xiaohongshu': return renderXhsPreview(result);
      case 'poster': return renderPosterPreview(result);
      case 'moments': return renderMomentsPreview(result);
      default: return '';
    }
  }

  window.renderChannelResult = renderChannelResult;
})();
