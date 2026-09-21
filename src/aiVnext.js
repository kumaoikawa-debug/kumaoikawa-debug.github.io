/* ==========================================================================
 * aiVnext.js —— 活动详情 AI Promo Canvas 前端协调层（Clean Rewrite §13/§15）
 *
 * 负责：
 *   - 调后端 /api/content-vnext/generate 生成 Promo Canvas（第一期范围，§24）
 *   - 调 /api/content-vnext/revise 做自然语言改稿（§15 / DoD #9）
 *   - 把结果存到 a.vnextPromo，并触发详情页重渲染
 *
 * 鉴权沿用现有后端代理约定：getBackendURL() + ensureBackendToken()（Bearer）。
 * 扁平 classic script：顶层函数即全局。
 * ========================================================================== */
(function () {
  'use strict';

  function backendBase() {
    return (typeof getBackendURL === 'function') ? getBackendURL() : '';
  }

  function mapPhotos(a) {
    return (a.photos || []).map(function (p, i) {
      return {
        id: p.id || ('ph_' + i),
        src: p.src || p.url || '',
        width: p.width,
        height: p.height,
        caption: p.caption || '',
        materialEvidence: p.materialEvidence,
        eventFact: p.eventFact,
        subjects: p.subjects,
      };
    }).filter(function (p) { return p.src; });
  }

  function gatherSources(a) {
    var sourceMaterials = [];
    var textBits = [a.summary, a.description, a.sellingPoints && JSON.stringify(a.sellingPoints)]
      .filter(Boolean).join('\n');
    if (textBits) {
      sourceMaterials.push({ id: 'src_activity', type: 'text', text: textBits });
    }
    return {
      activityId: a.id,
      activity: a,
      sourceMaterials: sourceMaterials,
      photos: mapPhotos(a),
    };
  }

  async function callVnext(path, body) {
    var base = backendBase();
    if (!base) { toast('未配置后端地址，无法生成 AI Promo Canvas'); return null; }
    var token = await ensureBackendToken();
    if (!token) { toast('AI 未登录（Key 无效或额度用完了）'); return null; }
    var res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      var err = await res.json().catch(function () { return {}; });
      toast('生成失败：' + (err.message || res.status));
      return null;
    }
    var d = await res.json();
    return d && d.data ? d.data : null;
  }

  async function generateVnextPromo(activityId) {
    var a = (typeof getActivity === 'function') ? getActivity(activityId) : null;
    if (!a) return;
    toast('AI 正在理解活动资料并策划 Promo Canvas…');
    var result = await callVnext('/api/content-vnext/generate', gatherSources(a));
    if (!result) return;
    a.vnextPromo = result;
    if (typeof saveState === 'function') saveState();
    if (typeof showView === 'function') showView(state.view, state.params);
    toast('AI Promo Canvas 已生成');
  }

  async function reviseVnextPromo(activityId) {
    var a = (typeof getActivity === 'function') ? getActivity(activityId) : null;
    if (!a) return;
    var input = document.getElementById('apc-revise-input');
    var instruction = input && input.value ? input.value.trim() : '';
    if (!instruction) { toast('请输入改稿指令，例如：字少一点 / 图片多一点 / 更专业 / 突出徒步'); return; }
    toast('AI 正在按指令改稿…');
    var body = gatherSources(a);
    body.instruction = instruction;
    body.existingBlocks = (a.vnextPromo && a.vnextPromo.blocks) || [];
    var result = await callVnext('/api/content-vnext/revise', body);
    if (!result) return;
    a.vnextPromo = result;
    if (typeof saveState === 'function') saveState();
    if (typeof showView === 'function') showView(state.view, state.params);
    toast('已按「' + instruction + '」改稿');
  }

  /** 详情页顶部区域：未生成 → 生成按钮；已生成 → Canvas + 改稿入口 */
  function renderVnextSection(a) {
    if (!a) return '';
    var has = a.vnextPromo && Array.isArray(a.vnextPromo.blocks) && a.vnextPromo.blocks.length;
    if (!has) {
      return '<div class="apc-region apc-empty">' +
        '<div class="apc-empty-txt">新版 AI Promo Canvas：让 ClubOS 自己当内容主编，按这场活动策划完全不同的宣传结构（不再套固定模板）。</div>' +
        '<button class="btn btn-primary" data-action="vnextGenerate">' + ICON('sparkles') + ' 生成 AI Promo Canvas</button>' +
        '</div>';
    }
    var canvas = (typeof renderPromoCanvas === 'function') ? renderPromoCanvas(a.vnextPromo, {}) : '';
    return '<div class="apc-region">' +
      '<div class="apc-bar">' +
      '<span class="apc-bar-t">AI Promo Canvas（动态策划 · 非模板）</span>' +
      '<button class="btn btn-ghost btn-sm" data-action="vnextGenerate">' + ICON('refresh') + ' 重新策划</button>' +
      '</div>' +
      canvas +
      '<div class="apc-revise">' +
      '<input id="apc-revise-input" class="apc-revise-input" placeholder="用自然语言改稿：字少一点 / 图片多一点 / 更专业 / 突出徒步 / 重新策划" />' +
      '<button class="btn btn-soft btn-sm" data-action="vnextRevise">' + ICON('edit') + ' 应用改稿</button>' +
      '</div></div>';
  }

  window.generateVnextPromo = generateVnextPromo;
  window.reviseVnextPromo = reviseVnextPromo;
  window.renderVnextSection = renderVnextSection;
})();
