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

  // esc 兜底：真实环境由 core.js 提供（全局 const），此处保证单测/契约环境也能独立跑
  var esc = (typeof window !== 'undefined' && typeof window.esc === 'function')
    ? window.esc
    : function (s) {
        return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
      };

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

  /* ---------- §29 增强能力：宣传切口 + 反重复度量（让闸门可见） ----------
     后端默认开启多样性闸门：自动挑一个与近期内容不同的宣传切口。
     看不见的闸门等于没有闸门 —— 这里把「选了哪个切口 / 与近期内容像不像」直接上屏。 */

  function diversityLine(d) {
    if (!d) return '';
    var dir = d.direction;
    var rep = d.repetition;
    if (!dir && !rep) return '';
    var parts = [];
    if (dir && dir.label) parts.push('本次宣传切口：' + dir.label);
    if (rep) {
      var sim = Math.round(Math.max(rep.semantic || 0, rep.layout || 0) * 100);
      parts.push('与近期内容相似度 ' + sim + '%');
    }
    var txt = parts.join(' · ');
    var bad = !!(rep && rep.repetitive);
    return '<div class="apc-diversity' + (bad ? ' apc-diversity-bad' : '') + '">' + esc(txt) +
      (bad ? '　⚠ 与近期内容过于相似，已强制换切口' : '') + '</div>';
  }

  /** 详情页顶部区域：未生成 → 生成按钮；已生成 → Canvas + 改稿入口 */
  function renderVnextSection(a) {
    if (!a) return '';
    var has = a.vnextPromo && Array.isArray(a.vnextPromo.blocks) && a.vnextPromo.blocks.length;
    var canvasHtml;
    if (!has) {
      canvasHtml = '<div class="apc-region apc-empty">' +
        '<div class="apc-empty-txt">新版 AI Promo Canvas：让 ClubOS 自己当内容主编，按这场活动策划完全不同的宣传结构（不再套固定模板）。</div>' +
        '<button class="btn btn-primary" data-action="vnextGenerate">' + ICON('sparkles') + ' 生成 AI Promo Canvas</button>' +
        '</div>';
    } else {
      var canvas = (typeof renderPromoCanvas === 'function') ? renderPromoCanvas(a.vnextPromo, {}) : '';
      canvasHtml = '<div class="apc-region">' +
        '<div class="apc-bar">' +
        '<span class="apc-bar-t">AI Promo Canvas（动态策划 · 非模板）</span>' +
        '<button class="btn btn-ghost btn-sm" data-action="vnextGenerate">' + ICON('refresh') + ' 重新策划</button>' +
        '</div>' +
        diversityLine(a.vnextPromo.diversity) +
        canvas +
        '<div class="apc-revise">' +
        '<input id="apc-revise-input" class="apc-revise-input" placeholder="用自然语言改稿：字少一点 / 图片多一点 / 更专业 / 突出徒步 / 重新策划" />' +
        '<button class="btn btn-soft btn-sm" data-action="vnextRevise">' + ICON('edit') + ' 应用改稿</button>' +
        '</div></div>';
    }
    // 宣发渠道（第二阶段）：共享 Activity Master，各自独立策划
    var channelHtml = renderVnextChannelSection(a);
    // 活动回顾（第三阶段）：围绕真实现场重新策划
    var recapHtml = renderVnextRecapSection(a);
    return canvasHtml + channelHtml + recapHtml;
  }

  var CHANNEL_NAMES = { wechat: '微信公众号长文', xiaohongshu: '小红书笔记', poster: '海报', moments: '朋友圈/群' };
  function channelName(c) { return CHANNEL_NAMES[c] || c; }

  async function generateVnextChannel(activityId, channel) {
    var a = (typeof getActivity === 'function') ? getActivity(activityId) : null;
    if (!a) return;
    if (!channel) { toast('请选择宣发渠道'); return; }
    toast('AI 正在生成' + channelName(channel) + '…');
    var body = gatherSources(a);
    body.channel = channel;
    var result = await callVnext('/api/content-vnext/channel', body);
    if (!result) return;
    a.vnextChannel = a.vnextChannel || {};
    a.vnextChannel[channel] = result;
    if (typeof saveState === 'function') saveState();
    if (typeof showView === 'function') showView(state.view, state.params);
    toast(channelName(channel) + '已生成');
  }

  /** 复制某渠道产出到剪贴板（公众号=HTML，其余=纯文本） */
  function copyVnextChannel(channel) {
    var a = (typeof viewingActivity === 'function') ? viewingActivity() : null;
    // 宣发中心视图下 viewingActivity() 取不到活动 → 回落到宣发中心当前选中的活动
    if (!a && typeof publishState === 'function') {
      var ps = publishState();
      a = (ps && ps._a) || null;
    }
    if (!a || !a.vnextChannel || !a.vnextChannel[channel]) { toast('尚未生成该渠道'); return; }
    var c = a.vnextChannel[channel].content || {};
    var text = '';
    if (channel === 'wechat') text = c.html || '';
    else if (channel === 'xiaohongshu') text = [c.title, c.hook, c.body, (c.tags || []).join(' '), c.ctaText].filter(Boolean).join('\n\n');
    else if (channel === 'poster') text = [c.name, c.date + ' ' + c.location, c.priceText + ' ' + c.participation, c.sellingPoint, (c.highlights || []).join('\n')].filter(Boolean).join('\n');
    else if (channel === 'moments') text = c.text || '';
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast(channelName(channel) + '内容已复制'); }, function () { toast('复制失败，请手动选择'); });
    } else {
      toast('当前环境不支持自动复制');
    }
  }

  function renderVnextChannelToolbar() {
    var btns = ['wechat', 'xiaohongshu', 'poster', 'moments'].map(function (c) {
      return '<button class="btn btn-soft btn-sm" data-action="vnextChannelGenerate" data-channel="' + c + '">' + ICON('sparkles') + ' ' + channelName(c) + '</button>';
    }).join('');
    return '<div class="ch-toolbar">' + btns + '</div>';
  }

  function renderVnextChannelPreviews(a) {
    var ch = a.vnextChannel || {};
    var keys = ['wechat', 'xiaohongshu', 'poster', 'moments'].filter(function (k) { return ch[k]; });
    if (!keys.length) return '';
    return keys.map(function (k) {
      var r = ch[k];
      var g = r.grounding;
      var warn = '';
      if (g && !g.passed) {
        var n = (g.issues || []).filter(function (i) { return i.severity === 'block'; }).length;
        warn = '<div class="apc-grounding apc-grounding-bad">⚠ 事实校验发现 ' + n + ' 处疑似编造，请复核后再发布。</div>';
      }
      var preview = (typeof renderChannelResult === 'function') ? renderChannelResult(r) : '';
      return warn + diversityLine(r.diversity) + preview;
    }).join('');
  }

  function renderVnextChannelSection(a) {
    if (!a) return '';
    return '<div class="ch-region">' +
      '<div class="ch-head">宣发渠道（共享同一 Activity Master，各自重新策划）</div>' +
      renderVnextChannelToolbar() +
      renderVnextChannelPreviews(a) +
      '</div>';
  }

  /* ---------- 活动回顾（§18 / §28 第三阶段） ----------
     输入 = Activity Master + actualActivityData + 现场照片 + 领队备注 + 真实用户反馈。
     实际发生的数据沿用现有活动对象字段（与 V3 的 v3ActualPayload 同一真源）。 */

  function pushArr(out, x) {
    if (x == null) return;
    if (Array.isArray(x)) {
      x.forEach(function (v) { if (v) out.push(String(v).slice(0, 200)); });
    } else {
      out.push(String(x).slice(0, 200));
    }
  }

  function gatherRecapInput(a) {
    var actual = (typeof v3ActualPayload === 'function') ? (v3ActualPayload(a) || {}) : {};
    var leaderNotes = [];
    pushArr(leaderNotes, a.memorableMoments);
    pushArr(leaderNotes, a.completionSummary);
    pushArr(leaderNotes, a.providedNotes);
    pushArr(leaderNotes, a.leaderNotes);
    var feedback = [];
    pushArr(feedback, a.actualFeedback);
    pushArr(feedback, a.feedback);
    return {
      actualActivityData: actual,
      photos: mapPhotos(a),
      leaderNotes: leaderNotes,
      feedback: feedback,
    };
  }

  async function generateVnextRecap(activityId) {
    var a = (typeof getActivity === 'function') ? getActivity(activityId) : null;
    if (!a) return;
    toast('AI 正在回顾这场活动，判断真正值得记录的是什么…');
    var body = gatherSources(a);
    body.recap = gatherRecapInput(a);
    var result = await callVnext('/api/content-vnext/recap', body);
    if (!result) return;
    a.vnextRecap = result;
    if (typeof saveState === 'function') saveState();
    if (typeof showView === 'function') showView(state.view, state.params);
    toast('活动回顾已生成');
    return result;
  }

  function renderVnextRecapSection(a) {
    if (!a) return '';
    var r = a.vnextRecap;
    if (!r || !Array.isArray(r.blocks) || !r.blocks.length) {
      return '<div class="rc-region rc-empty">' +
        '<div class="rc-empty-txt">活动回顾：输入真实发生的数据 + 现场照片 + 领队备注，让 AI 重新判断「这一次真正值得记录的是什么」，不套固定流程。</div>' +
        '<button class="btn btn-primary btn-sm" data-action="vnextRecapGenerate">' + ICON('sparkles') + ' 生成活动回顾</button>' +
        '</div>';
    }
    var canvas = (typeof renderPromoCanvas === 'function') ? renderPromoCanvas(r, {}) : '';
    return '<div class="rc-region">' +
      '<div class="rc-bar"><span class="rc-bar-t">活动回顾（围绕真实现场重新策划 · 无固定流程）</span>' +
      '<button class="btn btn-ghost btn-sm" data-action="vnextRecapGenerate">' + ICON('refresh') + ' 重新回顾</button></div>' +
      diversityLine(r.diversity) +
      (r.worthRecording ? '<div class="rc-worth"><b>这一次真正值得记录的是：</b>' + esc(r.worthRecording) + '</div>' : '') +
      canvas +
      '</div>';
  }

  /* 宣发中心入口（§4：旧 AI 生成主链停止调用，宣发统一走新引擎）
     一次点击出齐四个渠道：wechat / xiaohongshu 走 LLM 重策划，poster / moments 为确定性提取（不额外消耗 LLM）。
     静默执行：不 toast / 不 showView / 中途不重渲，由调用方统一收口，避免四次渲染抖动。 */
  async function generateVnextChannels(activityId) {
    var a = (typeof getActivity === 'function') ? getActivity(activityId) : null;
    if (!a) return null;
    var body = gatherSources(a);
    var chans = ['wechat', 'xiaohongshu', 'poster', 'moments'];
    var out = {};
    for (var i = 0; i < chans.length; i++) {
      var payload = {
        activityId: body.activityId,
        activity: body.activity,
        sourceMaterials: body.sourceMaterials,
        photos: body.photos,
        channel: chans[i],
      };
      var r = await callVnext('/api/content-vnext/channel', payload);
      if (!r) return null; // callVnext 已提示失败原因（未配置后端 / 未登录 / 积分不足）
      out[chans[i]] = r;
    }
    a.vnextChannel = a.vnextChannel || {};
    Object.keys(out).forEach(function (k) { a.vnextChannel[k] = out[k]; });
    if (typeof saveState === 'function') saveState();
    return out;
  }

  window.generateVnextPromo = generateVnextPromo;
  window.reviseVnextPromo = reviseVnextPromo;
  window.renderVnextSection = renderVnextSection;
  window.generateVnextChannel = generateVnextChannel;
  window.generateVnextChannels = generateVnextChannels;
  window.copyVnextChannel = copyVnextChannel;
  window.renderVnextChannelSection = renderVnextChannelSection;
  window.generateVnextRecap = generateVnextRecap;
  window.renderVnextRecapSection = renderVnextRecapSection;
})();
