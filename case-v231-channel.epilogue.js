/* ==========================================================================
 * case-v231-channel.epilogue.js —— 第二阶段（宣发渠道）契约测试（§17 / §27）
 *
 * 在 harness（加载 src/aiChannelRenderer.js 后）运行，断言：
 *   1) 四渠道共享同一 Activity Master（图片 src 从 master.photos 解析，不杜撰）；
 *   2) 公众号 HTML 原样嵌入预览，Render 不篡改；
 *   3) 小红书 / 海报 / 朋友圈 按各自结构渲染，四者互不相同（独立策划，非复制）；
 *   4) Renderer 绝不注入固定章节 / 营销金句；
 *   5) 未知渠道 / 空结果不崩溃。
 *
 * 全部通过 → window.__V231_CHANNEL_OK = true
 * ========================================================================== */
(function () {
  'use strict';

  var fails = [];
  function ok(cond, msg) { if (!cond) fails.push(msg); else console.log('  ✓', msg); }

  function run() {
    if (typeof renderChannelResult !== 'function') { console.error('renderChannelResult 未加载'); return; }

    var fixedSections = ['为什么值得去', '活动体验', '适合谁', '活动收获', '为什么去', '体验什么', '收获什么'];

    // 1) 公众号：后端 HTML 原样嵌入
    var wechatHtml = '<div style="font-family:x"><h1>蓥华山徒步+瑜伽</h1><p>一天把电池充满</p></div>';
    var w = renderChannelResult({
      channel: 'wechat',
      content: { title: 'T', summary: 'S', html: wechatHtml, blocks: [] },
      activityMaster: { photos: [] },
    });
    ok(w.indexOf('蓥华山徒步+瑜伽') >= 0, '公众号 HTML 原样嵌入预览（Renderer 不篡改）');
    ok(w.indexOf('ch-wechat') >= 0, '公众号容器正确');
    var injected = fixedSections.filter(function (s) { return w.indexOf(s) >= 0; });
    ok(injected.length === 0, 'Renderer 未注入任何固定章节骨架（' + (injected.join('/') || '无') + '）');

    // 2) 小红书：图片顺序解析自共享 Activity Master
    var x = renderChannelResult({
      channel: 'xiaohongshu',
      content: { title: '周末去蓥华山', hook: 'H', body: 'B1\nB2', tags: ['#户外'], ctaText: '戳我报名', imageOrder: ['p1', 'p2'], blocks: [] },
      activityMaster: { photos: [{ id: 'p1', src: 'https://img/p1.jpg', caption: 'c1' }, { id: 'p2', src: 'https://img/p2.jpg', caption: 'c2' }] },
    });
    ok(x.indexOf('周末去蓥华山') >= 0, '小红书标题渲染');
    ok(x.indexOf('https://img/p1.jpg') >= 0 && x.indexOf('https://img/p2.jpg') >= 0,
      '小红书图片顺序解析自共享 Activity Master 的真实 src（不杜撰）');
    ok(x.indexOf('#户外') >= 0, '小红书标签渲染');

    // 3) 海报：结构化字段（确定性提取，不依赖 LLM）
    var p = renderChannelResult({
      channel: 'poster',
      content: { name: '蓥华山徒步', date: '2026-10-24', location: '什邡', priceText: '¥298', participation: '扫码', sellingPoint: '自然疗愈', highlights: ['森林瑜伽', '溪流徒步'], signup: '扫码报名' },
      activityMaster: { photos: [] },
    });
    ok(p.indexOf('蓥华山徒步') >= 0 && p.indexOf('¥298') >= 0, '海报名称 / 价格渲染（自母体提取）');
    ok(p.indexOf('森林瑜伽') >= 0, '海报亮点渲染');

    // 4) 朋友圈 / 群
    var m = renderChannelResult({
      channel: 'moments',
      content: { text: '本周末一起去', signup: '扫码' },
      activityMaster: { photos: [] },
    });
    ok(m.indexOf('本周末一起去') >= 0, '朋友圈文案渲染');

    // 5) 四渠道产出互不相同（独立策划，非互相复制 / 非复制详情页）
    ok(w !== x && x !== p && p !== m, '四个渠道产出互不相同 → 各自独立策划');

    // 6) 非法输入不崩溃
    ok(renderChannelResult({ channel: 'evil' }) === '', '未知渠道返回空（不渲染、不报错）');
    ok(renderChannelResult(null) === '', '空结果返回空（不崩溃）');

    if (fails.length === 0) {
      window.__V231_CHANNEL_OK = true;
      console.log('%c[V231 channel] 契约测试全部通过', 'color:#1a7f37;font-weight:bold');
    } else {
      window.__V231_CHANNEL_OK = false;
      console.error('[V231 channel] 契约测试失败：', fails);
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  } else {
    run();
  }
})();
