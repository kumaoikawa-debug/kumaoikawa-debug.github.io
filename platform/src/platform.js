/* ClubOS Platform — modular build (split from monolithic app.js v81).
   Loaded as classic <script> in order; shared global scope, no bundler. */
  function renderPlatformPromo() {
    const campaigns = state.promoCampaigns || [];
    const coupons = state.promoCoupons || [];
    const dists = state.distributors || [];
    const mats = state.promoMaterials || [];
    const tab = state.promoTab || "campaigns";
    const tabs = [
      { k: "campaigns", label: "营销活动" }, { k: "coupons", label: "平台券" },
      { k: "distributors", label: "分销员" }, { k: "materials", label: "推广素材" }
    ];
    const running = campaigns.filter((c) => c.status === "running").length;
    const couponUsed = coupons.reduce((a, c) => a + (c.used || 0), 0);
    const distGmv = dists.reduce((a, d) => a + (d.gmv || 0), 0);
    return `<h2 class="section-title" style="margin-bottom:6px">推广营销</h2>
      <div class="pf-promo-ov">
        ${[["进行中活动", running], ["已发平台券", coupons.length], ["券核销次数", couponUsed], ["分销 GMV", "¥" + distGmv.toLocaleString()]].map((x) => `<div class="pf-promo-ov-card"><div class="pf-promo-ov-val">${x[1]}</div><div class="pf-promo-ov-label">${x[0]}</div></div>`).join("")}
      </div>
      <div class="pf-mall-tabs">
        ${tabs.map((t) => `<button class="pf-mall-tab ${tab === t.k ? "active" : ""}" data-action="promoTab" data-tab="${t.k}">${t.label}</button>`).join("")}
      </div>
      ${tab === "campaigns" ? `
        <div class="row between" style="margin:6px 0 10px"><b>营销活动（${campaigns.length}）</b><button class="btn btn-sm btn-primary" data-action="promoNewCampaign">+ 新建活动</button></div>
        <div class="pf-promo-list">
          ${(campaigns).map((c) => `<div class="pf-promo-card ${c.status === "paused" ? "paused" : ""}">
            <div class="pf-promo-card-h"><b>${esc(c.title)}</b><span class="pf-badge pf-badge-${c.status}">${{ running: "进行中", scheduled: "待开始", paused: "已暂停", ended: "已结束" }[c.status] || c.status}</span></div>
            <div class="pf-promo-meta">渠道：${c.channel} · 范围：${{
              all: "全平台", new: "新俱乐部", gear: "装备商城", act: "活动线"
            }[c.scope] || c.scope} · ${c.startAt} ~ ${c.endAt}</div>
            <div class="pf-promo-stats"><div><b>${c.exposure.toLocaleString()}</b><span>曝光</span></div><div><b>${c.orders}</b><span>订单</span></div><div><b>${c.exposure ? Math.round((c.orders / c.exposure) * 1000) / 10 : 0}%</b><span>转化</span></div></div>
            <div class="row gap"><button class="btn btn-xs btn-soft" data-action="promoToggleCampaign" data-id="${c.id}">${c.status === "paused" ? "启用" : "暂停"}</button></div>
          </div>`).join("")}
        </div>
      ` : ""}
      ${tab === "coupons" ? `
        <div class="row between" style="margin:6px 0 10px"><b>平台券（${coupons.length}）</b><button class="btn btn-sm btn-primary" data-action="promoNewCoupon">+ 新建平台券</button></div>
        <div class="pf-promo-list">
          ${(coupons).map((c) => `<div class="pf-promo-card ${c.status === "paused" ? "paused" : ""}">
            <div class="pf-promo-card-h"><b>${esc(c.title)}</b><span class="pf-badge pf-badge-${c.status}">${c.status === "active" ? "发放中" : "已暂停"}</span></div>
            <div class="pf-promo-meta">${c.type === "discount" ? (c.value / 10) + " 折" : "满 " + c.threshold + " 减 " + c.value} · 已领 ${c.claimed}/${c.total} · 已核销 ${c.used}</div>
            <div class="row gap"><button class="btn btn-xs btn-soft" data-action="promoToggleCoupon" data-id="${c.id}">${c.status === "active" ? "暂停" : "启用"}</button></div>
          </div>`).join("")}
        </div>
      ` : ""}
      ${tab === "distributors" ? `
        <div class="row between" style="margin:6px 0 10px"><b>分销员（${dists.length}）</b><span class="muted small">按 clubId 归因，佣金随分账结算走平台</span></div>
        <div class="pf-promo-list">
          ${(dists).map((d) => `<div class="pf-promo-card ${d.status === "pending" ? "paused" : ""}">
            <div class="pf-promo-card-h"><b>${esc(d.name)}</b><span class="pf-badge pf-badge-${d.status === "active" ? "running" : "pending"}">${d.status === "active" ? "已合作" : "待审核"}</span></div>
            <div class="pf-promo-meta">归属俱乐部：${clubNameOf(d.clubId)}</div>
            <div class="pf-promo-stats"><div><b>${d.orders}</b><span>订单</span></div><div><b>¥${d.gmv.toLocaleString()}</b><span>GMV</span></div><div><b>¥${d.commission.toLocaleString()}</b><span>佣金</span></div></div>
            ${d.status === "pending" ? `<div class="row gap"><button class="btn btn-xs btn-primary" data-action="promoApproveDist" data-id="${d.id}">通过审核</button></div>` : ""}
          </div>`).join("")}
        </div>
      ` : ""}
      ${tab === "materials" ? `
        <div class="row between" style="margin:6px 0 10px"><b>推广素材（${mats.length}）</b><span class="muted small">各俱乐部可一键下载转发</span></div>
        <div class="pf-promo-list">
          ${(mats).map((m) => `<div class="pf-promo-card">
            <div class="pf-promo-card-h"><b>${esc(m.title)}</b><span class="pf-badge pf-badge-running">${m.type}</span></div>
            <div class="pf-promo-meta">尺寸 ${m.size} · 下载 ${m.downloads} 次</div>
            <div class="row gap"><button class="btn btn-xs btn-soft" data-action="promoDownloadMat" data-id="${m.id}">下载素材</button></div>
          </div>`).join("")}
        </div>
      ` : ""}
    `;
  }
  function renderPlatformData() {
    const m = analyticsMetrics();
    const orders = (state.mallOrders || []).filter((o) => o.commissionStatus !== "reversed");
    let grossProfit = 0, supplyCost = 0;
    orders.forEach((o) => {
      let sc = 0;
      (o.items || []).forEach((it) => { const p = getProduct(it.productId); if (p) sc += (p.supplyPrice || 0) * (it.qty || 1); });
      grossProfit += (+(o.amount || 0)) - sc - orderCommission(o);
      supplyCost += sc;
    });
    const me = (state.brand && state.brand.name) || "本俱乐部";
    const otherClubs = [
      { name: "山野小队", signups: 420, gmv: 38600 },
      { name: "峰行户外", signups: 310, gmv: 24800 },
      { name: "溪畔营地", signups: 260, gmv: 15200 },
      { name: "岩点攀岩", signups: 180, gmv: 13600 },
      { name: "童行研学", signups: 350, gmv: 9400 }
    ];
    const clubRank = otherClubs.map((c) => ({ name: c.name, signups: c.signups, gmv: c.gmv, per100: c.signups ? (c.gmv / c.signups) * 100 : 0, isMe: false }))
      .concat([{ name: me, signups: m.people, gmv: m.gmv, per100: m.per100, isMe: true }])
      .sort((a, b) => b.per100 - a.per100).slice(0, 8);
    const cs = commissionSummary();
    const card = (icon, label, value) => `<div class="an-card"><div class="an-card-h">${ICON(icon)}<span>${label}</span></div><div class="an-card-v">${value}</div></div>`;
    const totalPeople = m.people + 1620, totalGmv = Math.round(m.gmv + 99400);
    return `
      <div class="section-head"><div class="section-title">全局运营数据</div><div class="section-sub">全平台北极星：每 100 报名 → 商城 GMV</div></div>
      <div class="an-hero">
        <div class="an-hero-l"><div class="an-hero-t">每 100 报名 → 商城 GMV</div><div class="an-hero-v">¥${Math.round((totalGmv / Math.max(1, totalPeople)) * 100).toLocaleString()}</div><div class="an-hero-s">全平台报名 ${totalPeople} 人次 · 商城 GMV ¥${totalGmv.toLocaleString()}</div></div>
        <div class="an-hero-r">${ICON("bar-chart")}</div>
      </div>
      <div class="an-row">
        ${card("list", "全平台活动", (state.activities || []).length + 38)}
        ${card("users", "报名人次", totalPeople)}
        ${card("shopping-bag", "商城 GMV", "¥" + totalGmv.toLocaleString())}
        ${card("wallet", "平台毛利差", "¥" + Math.round(grossProfit + 21000).toLocaleString())}
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>俱乐部转化排行</h3></div>
        <div class="rank-list">${clubRank.map((c, i) => `<div class="rank-row ${c.isMe ? "me" : ""}"><span class="rank-no">${i + 1}</span><span class="rank-name">${esc(c.name)}</span><span class="rank-val">¥${Math.round(c.per100)} / 100报名</span></div>`).join("")}</div>
      </div>`;
  }
  function renderPlatformSettle() {
    const orders = state.mallOrders || [];
    const cs = commissionSummary();
    let grossProfit = 0;
    orders.filter((o) => o.commissionStatus !== "reversed").forEach((o) => {
      let sc = 0;
      (o.items || []).forEach((it) => { const p = getProduct(it.productId); if (p) sc += (p.supplyPrice || 0) * (it.qty || 1); });
      grossProfit += (+(o.amount || 0)) - sc - orderCommission(o);
    });
    return `
      <div class="section-head"><div class="section-title">分账结算</div><div class="section-sub">平台毛利差 + 商城订单佣金账本（全量）</div></div>
      <div class="an-row">
        ${cs.available > 0 ? `<div class="an-card"><div class="an-card-h">${ICON("wallet")}<span>待结算佣金</span></div><div class="an-card-v">¥${cs.available.toLocaleString()}</div></div>` : ""}
        <div class="an-card"><div class="an-card-h">${ICON("check")}<span>已结算佣金</span></div><div class="an-card-v">¥${cs.settled.toLocaleString()}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("store")}<span>平台毛利差</span></div><div class="an-card-v">¥${Math.round(grossProfit).toLocaleString()}</div></div>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>佣金账本（全量）</h3>${cs.available > 0 ? `<span class="more" data-action="mallSettleAll">结算全部可结算</span>` : ""}</div>
        <div class="comm-list">${orders.length ? orders.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((o) => mallCommRowHtml(o, true)).join("") : `<p class="muted small">暂无订单。</p>`}</div>
      </div>`;
  }

  /* ---------------- views: backend ---------------- */
  function renderLogin() {
    return `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(1000px 500px at 50% -10%, #EAF0ED, var(--bg))">
      <div class="card card-pad" style="width:420px;max-width:100%">
        <div class="brand-mark" style="padding:0 0 16px">
          <div class="brand-logo">${esc(state.brand.logoText || "C")}</div>
          <div><div class="brand-name">ClubOS</div><div class="brand-sub">AI 活动发布工作台</div></div>
        </div>
        <div class="eyebrow">一句话，发布一场活动</div>
        <h1 style="font-size:24px;margin:8px 0 4px">欢迎回来</h1>
        <p class="muted small" style="margin:0 0 22px">不用写文案，不用做设计，不用改图片尺寸。</p>
        <div class="field"><label>手机号</label><input class="input" id="loginPhone" placeholder="请输入手机号" value="13800006021"></div>
        <div class="field"><label>验证码</label><div class="row gap-10"><input class="input" id="loginCode" placeholder="输入验证码"><button class="btn btn-ghost btn-sm" data-action="sendCode">获取验证码</button></div></div>
        <button class="btn btn-primary btn-lg btn-block" data-action="doLogin" style="margin-top:6px">进入工作台</button>
        <p class="tiny muted center" style="margin:16px 0 0">Demo 模式：任意手机号，验证码 <b>1234</b> 即可进入</p>
      </div>
    </div>`;
  }

  /* ---------------- 总平台独立登录页 ----------------
     平台方是独立角色，不再需要先登录成某个俱乐部再从侧边栏切进平台 */
  function renderPlatformLogin() {
    return `<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(1000px 500px at 50% -10%, #E4EDE9, var(--bg))">
      <div class="card card-pad" style="width:430px;max-width:100%">
        <div class="brand-mark" style="padding:0 0 18px">
          <div class="brand-logo" style="background:#2F5D50;color:#fff">${ICON("building")}</div>
          <div><div class="brand-name">ClubOS 总平台</div><div class="brand-sub">统管入驻 · 权限 · AI额度 · 商城</div></div>
        </div>
        <div class="eyebrow">平台运营专用入口</div>
        <h1 style="font-size:24px;margin:8px 0 4px">平台管理后台</h1>
        <p class="muted small" style="margin:0 0 22px">管理所有入驻俱乐部、统一运营装备商城。</p>
        <div class="field"><label>平台账号</label><input class="input" id="pfLoginPhone" placeholder="请输入平台账号手机号" value="13800000000"></div>
        <div class="field"><label>验证码</label><div class="row gap-10"><input class="input" id="pfLoginCode" placeholder="输入验证码"><button class="btn btn-ghost btn-sm" data-action="sendCode">获取验证码</button></div></div>
        <button class="btn btn-primary btn-lg btn-block" data-action="platformDoLogin" style="margin-top:6px">进入总平台</button>
        <p class="tiny muted center" style="margin:16px 0 0">Demo 模式：任意账号，验证码 <b>1234</b> 即可进入</p>
        <p class="tiny muted center" style="margin:8px 0 0">俱乐部请前往 <b>俱乐部后台</b> 登录 · C 端用户请使用小程序</p>
      </div>
    </div>`;
  }

  /* ---------------- V2.0 P5：数据运营后台 ----------------
     北极星指标：每 100 报名 → 商城 GMV（衡量活动流量转化为装备销售的效率） */
  function analyticsMetrics() {
    const orders = (state.mallOrders || []).filter((o) => o.commissionStatus !== "reversed");
    const signups = state.signups || [];
    // 报名人次 = Σ(成人 + 儿童)
    const people = signups.reduce((s, x) => s + (+(x.adults || 1)) + (+(x.children || 0)), 0);
    const gmv = orders.reduce((s, o) => s + (+(o.amount || 0)), 0);
    const per100 = people > 0 ? (gmv / people) * 100 : 0;
    const cs = commissionSummary();
    const commission = cs.pending + cs.frozen + cs.available + cs.settled;
    const conv = people > 0 ? (orders.length / people) * 100 : 0;
    const aiConsumed = (state.aiLedger || []).filter((l) => l.type === "consume").reduce((s, l) => s + Math.abs(l.delta || 0), 0);
    const recruiting = (state.activities || []).filter((a) => a.status === "recruiting" || a.status === "full").length;
    return { orders, signups, people, gmv, per100, cs, commission, conv, aiConsumed, recruiting };
  }
  function renderAnalytics() {
    const m = analyticsMetrics();
    const me = (state.brand && state.brand.name) || "本俱乐部";
    // 商品排行：按成交额聚合
    const prodMap = {};
    m.orders.forEach((o) => {
      (o.items || []).forEach((it) => {
        const k = it.productId;
        if (!prodMap[k]) prodMap[k] = { productId: k, title: it.title, qty: 0, amount: 0, commission: 0 };
        prodMap[k].qty += (it.qty || 1);
        prodMap[k].amount += (it.price || 0) * (it.qty || 1);
        prodMap[k].commission += commissionOf(getProduct(k), it.price) * (it.qty || 1);
      });
    });
    const prodRank = Object.values(prodMap).sort((a, b) => b.amount - a.amount).slice(0, 8);
    const maxAmt = prodRank.length ? prodRank[0].amount : 1;
    // 俱乐部排行（Demo 模拟同平台其他俱乐部，本俱乐部按真实数据插入）
    const otherClubs = [
      { name: "山野小队", signups: 420, gmv: 38600 },
      { name: "峰行户外", signups: 310, gmv: 24800 },
      { name: "溪畔营地", signups: 260, gmv: 15200 },
      { name: "岩点攀岩", signups: 180, gmv: 13600 },
      { name: "童行研学", signups: 350, gmv: 9400 }
    ];
    const clubRank = otherClubs
      .map((c) => ({ name: c.name, signups: c.signups, gmv: c.gmv, per100: c.signups ? (c.gmv / c.signups) * 100 : 0, isMe: false }))
      .concat([{ name: me, signups: m.people, gmv: m.gmv, per100: m.per100, isMe: true }])
      .sort((a, b) => b.per100 - a.per100)
      .slice(0, 8);
    const card = (icon, label, value, sub) => `<div class="an-card">
      <div class="an-card-h">${ICON(icon)}<span>${esc(label)}</span></div>
      <div class="an-card-v">${value}</div>
      ${sub ? `<div class="an-card-s">${esc(sub)}</div>` : ""}
    </div>`;
    return `
      <div class="section-head"><div class="section-title">数据运营</div></div>
      <p class="muted small" style="margin:-6px 0 14px">北极星指标：每 100 报名带来多少商城 GMV。活动流量越能转化为装备销售，平台与俱乐部共赢。</p>

      <div class="an-hero">
        <div class="an-hero-l">
          <div class="an-hero-t">每 100 报名 → 商城 GMV</div>
          <div class="an-hero-v">¥${Math.round(m.per100).toLocaleString()}</div>
          <div class="an-hero-s">报名 ${m.people} 人次 · 商城成交 ¥${Math.round(m.gmv).toLocaleString()} · 共 ${m.orders.length} 单</div>
        </div>
        <div class="an-hero-r">${ICON("target")}</div>
      </div>

      <div class="an-grid">
        ${card("users", "报名人次", m.people.toLocaleString(), `招募中活动 ${m.recruiting} 场`)}
        ${card("shopping-bag", "商城 GMV", "¥" + Math.round(m.gmv).toLocaleString(), `本月 ¥${Math.round(state.mallSalesMonth || 0).toLocaleString()}`)}
        ${card("trending", "装备转化率", m.conv.toFixed(1) + "%", `${m.orders.length} 单 / ${m.people} 人次`)}
        ${card("crown", "累计佣金", "¥" + Math.round(m.commission).toLocaleString(), `可结算 ¥${Math.round(m.cs.available).toLocaleString()} · 已结算 ¥${Math.round(m.cs.settled).toLocaleString()}`)}
        ${card("sparkles", "AI 积分消耗", m.aiConsumed.toLocaleString(), `当前余额 ${aiBalance().toLocaleString()}`)}
        ${card("bar-chart", "活动场次", (state.activities || []).length + " 场", `招募中 ${m.recruiting} 场`)}
      </div>

      <div class="card card-pad" style="margin-top:16px">
        <div class="section-head"><div class="section-title">俱乐部排行 · 每 100 报名 GMV</div><span class="muted small">Demo 含模拟俱乐部</span></div>
        <div class="an-rank">${clubRank.map((c, i) => `<div class="an-rank-row ${c.isMe ? "is-me" : ""}">
          <div class="an-rank-no">${i + 1}</div>
          <div class="an-rank-name">${esc(c.name)}${c.isMe ? `<span class="an-me-tag">本俱乐部</span>` : ""}</div>
          <div class="an-rank-bar"><div style="width:${Math.min(100, Math.round((c.per100 / Math.max(1, clubRank[0].per100)) * 100))}%"></div></div>
          <div class="an-rank-v">¥${Math.round(c.per100).toLocaleString()}</div>
        </div>`).join("")}</div>
        <p class="muted small" style="margin:10px 0 0">口径：GMV ÷ 报名人次 × 100。仅统计未冲销订单。</p>
      </div>

      <div class="card card-pad" style="margin-top:16px">
        <div class="section-head"><div class="section-title">商品排行 · 按成交额</div><span class="muted small">共 ${prodRank.length} 个 SKU</span></div>
        ${prodRank.length ? `<div class="an-rank">${prodRank.map((p, i) => `<div class="an-rank-row">
          <div class="an-rank-no">${i + 1}</div>
          <div class="an-rank-name">${esc(p.title)}<span class="an-rank-meta">${p.qty} 件 · 佣金 ¥${Math.round(p.commission).toLocaleString()}</span></div>
          <div class="an-rank-bar"><div style="width:${Math.round((p.amount / maxAmt) * 100)}%"></div></div>
          <div class="an-rank-v">¥${Math.round(p.amount).toLocaleString()}</div>
        </div>`).join("")}</div>` : `<p class="muted small">还没有商城订单。在「装备商城」或活动详情的装备推荐里下一单即可看到排行。</p>`}
      </div>
    `;
  }

  function renderDashboard() {
    const acts = state.activities.slice(0, 6);
    const totalSign = state.signups.length + state.activities.reduce((s, a) => s + (a.signups || 0), 0);
    return `
      <div class="hero">
        <div class="slogan-en">One sentence. One event.</div>
        <h1>下午好，${esc(state.brand.name)}。</h1>
        <p>今天想发布什么活动？用一句话描述，剩下的交给 ClubOS。</p>
        <div class="create-box">
          <textarea id="createInput" placeholder="例如：本周六赵公山轻装徒步，12公里爬升1100米，168元/人，限25人……"></textarea>
          <div class="create-actions">
            <button class="btn btn-accent btn-lg" data-action="generate">${ICON("sparkles")} AI 生成活动</button>
            <button class="btn btn-ghost btn-lg" data-action="voice">${ICON("mic")} 语音输入</button>
            <button class="btn btn-ghost btn-lg" data-action="paste">${ICON("copy")} 粘贴文案</button>
          </div>
          <div class="example-chips">
            <span class="chip" data-action="example" data-text="${esc(SAMPLE_FULL)}">赵公山徒步</span>
            <span class="chip" data-action="example" data-text="${esc(EXAMPLE2)}">都江堰虹口漂流</span>
          </div>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat"><div class="num">${state.activities.filter((a) => a.status === "recruiting").length}</div><div class="lbl">本月招募中活动</div></div>
        <div class="stat"><div class="num">${totalSign}</div><div class="lbl">累计报名人数</div></div>
        <div class="stat"><div class="num">1,280</div><div class="lbl">本月页面浏览量</div></div>
      </div>

      <div class="section-head">
        <div class="section-title">最近活动</div>
        <button class="btn btn-soft btn-sm" data-action="nav" data-view="list">查看全部 ${ICON("chevron-right")}</button>
      </div>
      ${acts.length ? `<div class="activity-strip">${acts.map(actCard).join("")}</div>` : `<div class="empty"><div class="e-ic">🌱</div><div>还没有活动，点击上方输入框开始创建吧。</div></div>`}
    `;
  }

  function actCard(a) {
    const coverCls = a.photos && a.photos[0] ? "act-cover" : "act-cover gradient";
    const cover = a.photos && a.photos[0] ? `style="background-image:url('${a.photos[0]}')"` : "";
    const badge = statusBadge(a.status);
    return `<div class="act-card">
      <div class="${coverCls}" ${cover}><span class="badge ${badge.cls}"><span class="dot"></span>${badge.txt}</span></div>
      <div class="act-body">
        <h4>${esc(a.title)}</h4>
        <div class="act-meta"><span>${esc(a.dateMD || a.date || "待定")}</span><span>${a.signups || 0} 报名</span></div>
      </div>
      <div class="act-actions">
        <button class="btn btn-soft btn-sm" data-action="edit" data-id="${a.id}">${ICON("edit")} 编辑</button>
        <button class="btn btn-ghost btn-sm" data-action="openFront" data-id="${a.id}">${ICON("eye")} 查看</button>
        <button class="btn btn-ghost btn-sm" data-action="share" data-id="${a.id}">${ICON("share")}</button>
      </div>
    </div>`;
  }
  function statusBadge(s) {
    return ({ draft: { cls: "badge-draft", txt: "草稿" }, recruiting: { cls: "badge-recruiting", txt: "招募中" }, full: { cls: "badge-full", txt: "已满员" }, ended: { cls: "badge-ended", txt: "已结束" }, down: { cls: "badge-down", txt: "已下架" } })[s] || { cls: "badge-draft", txt: "草稿" };
  }

  function renderCreate() {
    return `<div class="create-wrap">
      <div class="steps"><div class="step done"></div><div class="step active"></div><div class="step"></div><div class="step"></div></div>
      <div class="card card-pad">
        <div class="eyebrow">第 1 步 / 描述活动</div>
        <h2 class="section-title" style="margin:8px 0 4px">说一句话，剩下的交给我们</h2>
        <p class="muted small" style="margin:0 0 18px">支持一句话输入，也可以粘贴聊天记录、旧文案或零散信息，AI 会自动整理。</p>
        <div class="field"><label>活动描述</label>
          <textarea id="createInput" style="min-height:150px" placeholder="例如：本周六赵公山轻装徒步，12公里爬升1100米，168元/人，限25人，早上7:30天府广场集合……">${esc(state.draft && state.draft.raw ? state.draft.raw : "")}</textarea>
          <div class="hint">支持粘贴微信聊天、旧活动文案、简单行程。</div>
        </div>
        <div class="example-chips" style="margin-bottom:18px">
          <span class="chip" data-action="example" data-text="${esc(SAMPLE_FULL)}">青城后山亲子徒步</span>
          <span class="chip" data-action="example" data-text="${esc(EXAMPLE2)}">都江堰虹口漂流</span>
          <span class="chip" data-action="paste">粘贴一段旧文案</span>
        </div>
        <div class="row gap-10">
          <button class="btn btn-accent btn-lg" data-action="generate">${ICON("sparkles")} AI 生成活动</button>
          <button class="btn btn-ghost btn-lg" data-action="voice">${ICON("mic")} 语音</button>
        </div>
      </div>
    </div>`;
  }

  function pastePanelHtml(a) {
    return `<div class="panel" style="margin-bottom:18px">
      <div class="panel-head"><h3>粘贴真实行程</h3><span class="tiny muted">微信/Word 旧文案直接粘贴，AI 只分段整理不编造</span></div>
      <div class="panel-body">
        <textarea id="itinPaste" class="input" style="min-height:96px;width:100%;font-size:13px" placeholder="例如：\n第一天\n08:00 集合签到\n10:30 抵达起点\n12:00 午餐\n第二天\n09:00 自然探索\n15:00 返程"></textarea>
        <div class="row gap-8" style="margin-top:8px">
          <button class="btn btn-primary btn-sm" data-action="parsePaste">解析并填入行程</button>
          <button class="btn btn-ghost btn-sm" data-action="clearPaste">清空</button>
          <button class="btn btn-soft btn-sm" data-action="openHistory">${ICON("history")} 从历史复用</button>
        </div>
      </div>
    </div>`;
  }
  function historyModalHtml() {
    const H = state.history || [];
    if (!H.length) return `<div class="modal"><div class="modal-head"><h3>历史活动库</h3><button class="icon-btn" data-action="closeModal">${ICON("x")}</button></div><div class="modal-body"><div class="empty">还没有已发布的活动。发布活动后，会自动进入历史库，下次可一键沿用行程与文案。</div></div></div>`;
    return `<div class="modal">
      <div class="modal-head"><h3>历史活动库</h3><button class="icon-btn" data-action="closeModal">${ICON("x")}</button></div>
      <div class="modal-body">
        <div class="hist-list">
          ${H.map((h) => `<div class="hist-item">
            <div class="hist-main">
              <div class="hist-title">${esc(h.title)}</div>
              <div class="tiny muted">${esc(h.type)} · ${esc(h.place)} · ${(h.days || 1) > 1 ? h.days + " 天" : "单日"} · ${(h.itineraryDays || []).length} 天行程</div>
            </div>
            <button class="btn btn-soft btn-sm" data-action="useHistory" data-id="${h.id}">复用</button>
          </div>`).join("")}
        </div>
      </div>
    </div>`;
  }
  function openHistoryModal() {
    const m = document.createElement("div");
    m.className = "modal-mask"; m.innerHTML = historyModalHtml();
    document.body.appendChild(m);
    m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
  }
  function renderEditor() {
    const a = state.draft;
    if (!a) { showView("create"); return ""; }
    const tab = state.editorTab || "content";
    const servChips = [["includeLeader", "领队"], ["includeMeal", "午餐"], ["includeInsurance", "保险"], ["includeTransport", "交通"], ["includeGear", "装备"]];
    return `
      <div class="row between" style="margin-bottom:18px">
        <div><div class="eyebrow">AI 活动工作台</div><h2 class="section-title" style="margin:4px 0 0">确认并微调你的活动</h2></div>
        <div class="row gap-10">
          <button class="btn btn-ghost btn-sm" data-action="backToEdit">${ICON("arrow-left")} 返回</button>
          <button class="btn btn-soft btn-sm" data-action="saveDraft">存为草稿</button>
          <button class="btn btn-primary btn-sm" data-action="publish">${ICON("check")} 发布活动</button>
        </div>
      </div>
      <div class="editor">
      <div class="editor-main">
        <div class="editor-tabs">
          <button class="etab ${tab==="content"?"active":""}" data-action="switchTab" data-tab="content">内容</button>
          <button class="etab ${tab==="visual"?"active":""}" data-action="switchTab" data-tab="visual">视觉</button>
          <button class="etab ${tab==="publish"?"active":""}" data-action="switchTab" data-tab="publish">发布</button>
        </div>
        <div class="etab-panel" data-panel="content" ${tab!=="content"?"hidden":""}>
          ${factConfirmHtml(a)}
          <div class="strategy-inline">
          <div><span class="eyebrow">AI 内容方向 · ${esc(a.contentStrategy ? a.contentStrategy.name : "推荐")}</span><h3>${esc(a.headline || "")}</h3><p>${esc(a.contentStrategy ? a.contentStrategy.reason : "")}</p></div>
          <button class="btn btn-soft btn-sm" data-action="openAdvice">换一个方向</button>
        </div>
        ${a._similarList && a._similarList.length ? `<div class="similar-banner"><div class="sb-ic">${ICON("history")}</div><div class="sb-txt"><b>找到 ${a._similarList.length} 个相似历史活动</b><br><span class="tiny muted">${a._similarList.map((s)=>esc(s.title)).join("、")} · 可直接沿用行程，仅需改日期与价格</span></div><button class="btn btn-soft btn-sm" data-action="reuseHistory" data-id="${a._similarList[0].id}">沿用上次行程</button></div>` : ""}
        <div class="panel" style="margin-bottom:18px">
            <div class="panel-head"><h3>AI 识别结果</h3><span class="tiny muted">点击任意字段即可修改</span></div>
            <div class="panel-body">
              <div class="grid-2">
                <div class="field"><label>活动名称</label><input class="input" data-bind="title" value="${esc(a.title)}"></div>
                <div class="field"><label>活动类型</label><select class="select" data-bind="type">${TYPE_OPTIONS.map((o)=>`<option value="${esc(o.value)}" ${a.type === o.value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>
                <div class="field"><label>活动日期</label><input class="input" data-bind="date" value="${esc(a.date || a.dateMD)}"></div>
                <div class="field"><label>集合地点</label><input class="input" data-bind="meeting" value="${esc(a.meeting)}"></div>
                <div class="field"><label>集合时间</label><input class="input" data-bind="meetTime" value="${esc(a.meetTime)}"></div>
                <div class="field"><label>适合年龄 <span class="auto-tag">${a.ageManual ? "已手动调整" : "AI 已按类型/风险预填"}</span></label><input class="input" data-bind="ageRange" value="${esc(a.ageRange)}" placeholder="如：18—55岁、22岁以上、6到12岁"><div class="tiny muted" style="margin-top:4px">可直接修改，支持 6—12岁 / 22岁以上 / 6到12岁 等写法；手动修改后切换类型将保留你的值。</div></div>
                <div class="field"><label>活动价格（元）</label><input class="input" type="number" data-bind="price" value="${a.price || ""}"></div>
                <div class="field"><label>活动天数</label><input class="input" type="number" min="1" max="7" data-bind="days" value="${a.days || 1}"></div>
                <div class="field"><label>招募上限</label><div class="limit-field"><input class="input" type="number" data-bind="limit" value="${a.limit || ""}" placeholder="数量"><select class="select" data-bind="limitUnit"><option ${a.limitUnit === "组家庭" ? "selected" : ""}>组家庭</option><option ${a.limitUnit === "人" ? "selected" : ""}>人</option></select></div></div>

              </div>

              ${departuresEditHtml(a)}
              <div class="field" style="margin-top:6px"><label>包含服务</label>
                <div class="quick">
                  ${servChips.map(([k, l]) => `<button class="${a[k] ? "sel" : ""}" data-action="toggleServ" data-key="${k}">${l}</button>`).join("")}
                </div>
              </div>
              <div class="field" style="margin-top:14px"><label>费用不含 <span class="auto-tag">只显示老板确认的内容</span></label>
                <textarea class="textarea" data-bind-list="feeExclude" placeholder="每行一项，如：\n往返大交通\n个人消费">${esc((a.feeExclude || []).join("\n"))}</textarea>
              </div>
              <div class="field" style="margin-top:6px"><label>主页推荐</label>
                <div class="quick">
                  <button class="${a.pinned ? "sel" : ""}" data-action="togglePinned">${a.pinned ? "已设为主推" : "设为主推活动"}</button>
                  <span class="tiny muted" style="display:flex;align-items:center">开启后该活动将在首页 Bento 轮播中优先展示</span>
                </div>
              </div>
              <div class="field" style="margin-top:6px"><label>活动照片（普通照片即可，自动裁切）</label>
                <div class="uploader" data-action="upload">${ICON("upload")}<div style="margin-top:6px">点击上传 1—10 张照片</div><div class="tiny">不用裁切，不用调尺寸</div></div>
                <div class="thumbs" id="thumbsWrap">${thumbsHtml(a)}</div>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-bottom:18px">
            <div class="panel-head"><h3>详情页文案结构</h3><span class="tiny muted">由 AI 根据活动事实生成 · 可手动修改</span></div>
            <div class="panel-body">
              <div class="grid-2">
                <div class="field"><label class="fl"><span>故事区小标题</span><button class="mini-regen" data-action="regenField" data-field="editorialTitle" type="button">${ICON("refresh")}换一句</button></label><input class="input" data-bind="editorialTitle" value="${esc(a.editorialTitle || "")}" placeholder="如：在3200米处，看见幺妹峰的另一面"></div>
                <div class="field"><label class="fl"><span>记忆句 / 金句</span><button class="mini-regen" data-action="regenField" data-field="pullQuote" type="button">${ICON("refresh")}换一句</button></label><input class="input" data-bind="pullQuote" value="${esc(a.pullQuote || "")}" placeholder="如：不是征服海拔，是完整经历一天"></div>
              </div>
              <div class="field" style="margin-top:10px"><label class="fl"><span>海报氛围标语 <span class="auto-tag">AI 按季节+时间+地点生成</span></span><button class="mini-regen" data-action="regenField" data-field="posterTagline" type="button">${ICON("refresh")}换一句</button></label><input class="input" data-bind="posterTagline" value="${esc(a.posterTagline || "")}" placeholder="如：九月末的山脊线，把暑气留在成都平原"></div>
              <div class="field" style="margin-top:10px"><label class="fl"><span>照片故事主题</span><button class="mini-regen" data-action="regenField" data-field="storyPurpose" type="button">${ICON("refresh")}换一句</button></label><input class="input" data-bind="storyPurpose" value="${esc(a.storyPurpose || "")}" placeholder="如：记录队伍在高原上的真实状态"></div>
              <div class="field" style="margin-top:10px"><label class="fl"><span>照片配文 <span class="auto-tag">每行一条</span></span><button class="mini-regen" data-action="regenField" data-field="photoCaptions" type="button">${ICON("refresh")}换一组</button></label><textarea class="textarea" data-bind-list="photoCaptions" placeholder="每行一条照片配文，如：&#10;幺妹峰在清晨光线里&#10;队员在碎石坡上保持节奏">${esc((a.photoCaptions || []).join("\n"))}</textarea></div>
              <div class="field" style="margin-top:10px"><label class="fl"><span>活动介绍 / 导语</span><button class="mini-regen" data-action="regenField" data-field="intro" type="button">${ICON("refresh")}换一段</button></label><textarea class="textarea" data-bind="intro" rows="4" placeholder="2 个短段落：事实定位→具体画面">${esc(a.intro || "")}</textarea></div>
              <div class="field" style="margin-top:10px"><label class="fl"><span>开场钩子</span><button class="mini-regen" data-action="regenField" data-field="hook" type="button">${ICON("refresh")}换一句</button></label><input class="input" data-bind="hook" value="${esc(a.hook || "")}" placeholder="详情页正文第一句，用本场才有的事实/悬念开头"></div>
              <div class="field" style="margin-top:10px"><label class="fl"><span>正文段落 <span class="auto-tag">每段一行</span></span><button class="mini-regen" data-action="regenField" data-field="body" type="button">${ICON("refresh")}换一组</button></label><textarea class="textarea" data-bind-list="body" rows="6" placeholder="每段写一段具体场景或体验，每行一段">${esc((a.body || []).join("\n"))}</textarea></div>
              <div class="field" style="margin-top:12px"><label>核心卖点 <span class="auto-tag">可增删</span></label><div class="sp-edit-list">${((a.sellingPoints && a.sellingPoints.length) ? a.sellingPoints : [{title:"",desc:""}]).map((s, i) => `<div class="sp-edit-row" data-sp-idx="${i}"><input class="input sp-title" data-bind-sp="${i}" data-sub="title" value="${esc(s.title || "")}" placeholder="卖点（事实点）"><textarea class="textarea sp-desc" data-bind-sp="${i}" data-sub="desc" rows="2" placeholder="一句话支撑，为什么重要">${esc(s.desc || "")}</textarea><button class="icon-btn" data-action="delSP" data-id="${i}">${ICON("x")}</button></div>`).join("")}<button class="btn btn-soft btn-sm" data-action="addSP">+ 添加卖点</button></div></div>
            </div>
          </div>

          <div class="panel" style="margin-bottom:18px">
            <div class="panel-head"><h3>装备建议</h3><span class="tiny muted">按活动类型智能推荐 · 可手动增减</span></div>
            <div class="panel-body">
              <div class="gear-edit-group"><div class="tiny muted" style="margin-bottom:8px">必备</div>
                <div class="gear-edit-list" id="gearMandatory">${gearChipsHtml(a, true)}</div></div>
              <div class="gear-edit-group"><div class="tiny muted" style="margin-bottom:8px">建议携带</div>
                <div class="gear-edit-list" id="gearRecommended">${gearChipsHtml(a, false)}</div></div>
              <div class="row gap-8" style="margin-top:10px">
                <input class="input" id="gearAdd" placeholder="可粘贴整段装备建议，系统自动识别拆分">
                <button class="btn btn-soft btn-sm" data-action="addGear">添加</button>
              </div>
            </div>
          </div>

          ${customFieldEditorHtml(a)}
          ${leaderEditHtml(a)}
          ${itineraryEditHtml(a)}
          ${pastePanelHtml(a)}

          <div class="panel">
            <div class="panel-head"><h3>用 AI 改一改</h3><span class="tiny muted">像聊天一样下指令</span></div>
            <div class="panel-body">
              <div class="ai-cmd">
                <input class="input" id="aiCmd" placeholder="例如：把价格改成 269 元 / 强调安全保障">
                <button class="btn btn-primary" data-action="aiCmd">应用</button>
              </div>
              <div class="cmd-chips">
                <button class="chip" data-action="aiCmdPreset" data-cmd="标题更吸引人">标题更吸引人</button>
                <button class="chip" data-action="aiCmdPreset" data-cmd="文案更简洁">文案更简洁</button>
                <button class="chip" data-action="aiCmdPreset" data-cmd="强调安全保障">强调安全保障</button>
                <button class="chip" data-action="aiCmdPreset" data-cmd="更适合朋友圈传播">更适合朋友圈</button>
                <button class="chip" data-action="aiCmdPreset" data-cmd="调整为亲子风格">亲子风格</button>
              </div>
            </div>
          </div>
        </div>
        </div>
        <div class="etab-panel" data-panel="visual" ${tab!=="visual"?"hidden":""}>${visualTabHtml(a)}</div>
        <div class="etab-panel" data-panel="publish" ${tab!=="publish"?"hidden":""}>${publishTabHtml(a)}</div>
      </div>

        <div class="editor-right">
          <div class="panel">
            <div class="panel-head"><h3>手机端实时预览</h3><span class="tiny muted">随修改同步</span></div>
            <div class="panel-body" style="background:var(--surface-2)">
              <div class="phone"><div class="phone-notch"></div><div class="phone-screen" id="previewScreen">${renderActivityPhone(a)}</div></div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderContentAdvice() {
    const a = state.draft;
    if (!a) return renderCreate();
    const facts = [a.place, a.type, a.dateMD, a.difficulty, a.ageRange, a.price ? `¥${a.price}/${a.limitUnit}` : ""].filter(Boolean);
    return `<div class="advice-shell">
      <div class="advice-top"><span class="ai-orb">AI</span><span>CONTENT STRATEGY · AI 生成</span></div>
      <div class="eyebrow">AI 已生成内容</div>
      <h1>${esc(a.title || "未命名活动")}</h1>
      <p class="advice-lead">${esc(a.intro || "活动介绍将在事实确认后生成。")}</p>
      <div class="advice-facts"><b>已提取的真实信息</b><span>${esc(facts.join(" · "))}</span></div>
      ${ (a.missingFacts && a.missingFacts.length) ? `<div class="advice-missing"><b>AI 提示缺少的信息</b>${a.missingFacts.map((t) => `<div class="am-item">${esc(t)}</div>`).join("")}</div>` : "" }
      ${ (a.forewordTitles && a.forewordTitles.length) ? `<div class="title-cands"><div class="tc-h">标题备选（点击采用）</div>${a.forewordTitles.map((t, i) => `<button class="tc-item" data-action="pickForewordTitle" data-i="${i}">${esc(t)}</button>`).join("")}</div>` : "" }
      <div class="advice-actions"><button class="btn btn-ghost" data-action="nav" data-view="create">返回修改输入</button><button class="btn btn-primary btn-lg" data-action="approveDirection">进入编辑 ${ICON("arrow-right")}</button></div>
    </div>`;
  }

  function factConfirmHtml(a) {
    const reg = factRegistry(a);
    const confirmed = reg.filter((f) => f.status === "confirmed");
    const inferred = reg.filter((f) => f.status === "inferred");
    const missing = reg.filter((f) => f.status === "missing");
    if (!confirmed.length && !inferred.length && !missing.length) return "";
    const total = reg.length;
    const progress = total ? Math.round((confirmed.length / total) * 100) : 0;
    const progressColor = progress === 100 ? "#10b981" : missing.length ? "#ef4444" : "#f59e0b";
    return `<div class="fact-confirm">
      <div class="fc-header">
        <div>
          <div class="fc-title">事实确认</div>
          <div class="fc-sub">${confirmed.length}/${total} 已核对 · ${inferred.length} 项待确认</div>
        </div>
        <div class="fc-progress" aria-label="事实完整度 ${progress}%">
          <div class="fc-progress-ring" style="--p:${progress}"><span class="fc-progress-num">${progress}%</span></div>
        </div>
      </div>
      ${inferred.length ? `<div class="fc-section fc-inferred">
        <div class="fc-sec-head">
          <div><span class="fc-dot" style="background:#f59e0b"></span><b>AI 推断 · 待确认</b><span class="fc-count">${inferred.length}</span></div>
          <button class="fc-confirm-all" data-action="confirmAllInferred">全部确认 ${ICON("check")}</button>
        </div>
        <div class="fc-list">
          ${inferred.map((f) => `<div class="fc-row" data-action="confirmInfer" data-key="${f.key}">
            <div class="fc-meta">
              <span class="fc-label">${esc(f.label)}</span>
              <span class="fc-value">${esc(f.value || "—")}</span>
            </div>
            <button class="fc-check" data-action="confirmInfer" data-key="${f.key}" aria-label="确认 ${esc(f.label)}">${ICON("check")}</button>
          </div>`).join("")}
        </div>
        <div class="fc-tip">核对无误后点击右侧按钮，或一键全部确认</div>
      </div>` : ""}
      ${missing.length ? `<div class="fc-section fc-missing">
        <div class="fc-sec-head"><span class="fc-dot" style="background:#ef4444"></span><b>缺失信息 · 发布前补充</b><span class="fc-count">${missing.length}</span></div>
        <div class="fc-list">
          ${missing.map((f) => `<div class="fc-row fc-row-missing"><span class="fc-label">${esc(f.label)}</span><button class="fc-edit" data-action="focusField" data-key="${f.key}">去填写</button></div>`).join("")}
        </div>
      </div>` : ""}
      ${confirmed.length ? `<div class="fc-section fc-confirmed">
        <div class="fc-sec-head"><span class="fc-dot" style="background:#10b981"></span><b>已确认事实</b><span class="fc-count">${confirmed.length}</span></div>
        <div class="fc-chips">${confirmed.map((f) => `<span class="fc-chip">${esc(f.label)}：${esc(f.value || "")}</span>`).join("")}</div>
      </div>` : ""}
    </div>`;
  }
  function visualTabHtml(a) {
    const photos = a.photos || [];
    const cover = a.coverIndex || 0;
    const outline = buildPageOutline(a);
    return `<div class="vis-tab">
      <div class="vis-sec">
        <h4>图片分析结果<span class="sim-tag">模拟分析（演示）</span></h4>
        ${photos.length ? `<div class="photo-analysis">${photos.map((src, i) => { const m = photoMeta(src); return `<div class="photo-card"><div class="pc-thumb" style="background-image:url('${src}')"></div><div class="pc-meta"><div><b>图 ${i + 1}</b>${i === cover ? " · 封面" : ""}</div>${m ? `<div>类别：${m.category} · 朝向：${m.orientation === "landscape" ? "横" : m.orientation === "portrait" ? "竖" : "方"} · 质量：${m.quality_score}</div><div>主体：${m.subjects.join("、")} · 情绪：${m.emotion}</div><div>推荐：${m.recommended_use.join("、")} · 文字区：${m.safe_text_area}</div>` : `<div class="muted small">分析中…（模拟推断）</div>`}</div></div>`; }).join("")}</div>` : `<div class="empty">还没有上传图片</div>`}
      </div>
      <div class="vis-sec">
        <h4>封面图</h4>
        ${photos.length ? `<div class="cover-row">${photos.map((src, i) => `<button class="cover-thumb ${i === cover ? "sel" : ""}" data-action="setCover" data-i="${i}" style="background-image:url('${src}')"></button>`).join("")}</div><div class="tiny muted">点击选择封面（仅用于页面主视觉）</div>` : `<div class="empty">上传图片后可选封面</div>`}
      </div>
      <div class="vis-sec">
        <h4>页面结构（随内容与素材动态编排）</h4>
        <div class="outline-list">${outline.map((b) => `<div class="ol-item"><span class="ol-no">${esc(b.type)}</span><span class="ol-t">${esc(b.purpose || "")}</span></div>`).join("")}</div>
        <div class="tiny muted">共 ${outline.length} 个区块，少图不重复填充、多图形成节奏。</div>
      </div>
    </div>`;
  }
  function publishTabHtml(a) {
    const chk = runPublishCheck(a);
    const channels = [["wechat", "微信群招募文案"], ["moments", "朋友圈文案"], ["xhs", "小红书文案"], ["gzh", "公众号摘要"], ["voice", "口播文案"]];
    return `<div class="pub-tab">
      <div class="vis-sec">
        <h4>发布前事实检查</h4>
        ${chk.blocking.length ? `<div class="pub-box pub-err"><b>⛔ 关键问题（禁止发布）</b>${chk.blocking.map((t) => `<div class="pub-line">· ${esc(t)}</div>`).join("")}<button class="btn btn-soft btn-sm" data-action="backToEdit" style="margin-top:10px">去完善信息 ${ICON("arrow-left")}</button></div>` : ""}
        ${chk.warnings.length ? `<div class="pub-box pub-warn"><b>⚠ 待确认（可隐藏对应模块后发布）</b>${chk.warnings.map((t) => `<div class="pub-line">· ${esc(t)}</div>`).join("")}</div>` : ""}
        ${!chk.blocking.length && !chk.warnings.length ? `<div class="pub-box pub-ok">✓ 未发现问题，可直接发布</div>` : ""}
      </div>
      <div class="vis-sec">
        <h4>活动详情页</h4>
        <div class="tiny muted">右侧为手机端实时预览，下方为各平台发布文案。</div>
      </div>
      <div class="vis-sec">
        <h4>多平台发布文案<span class="sim-tag">演示生成</span></h4>
        <div class="share-grid">
          ${channels.map(([t, l]) => `<div class="share-block"><div class="row between"><b>${l}</b><button class="copy-btn" data-action="copyDraft" data-type="${t}">复制</button></div><div class="share-card share-card-sm">${esc(a["share" + t.charAt(0).toUpperCase() + t.slice(1)] || "（生成中…）")}</div></div>`).join("")}
        </div>
      </div>
      <div class="vis-sec">
        <h4>海报</h4>
        <button class="btn btn-primary btn-sm" data-action="openShare" data-id="${a.id}">生成分享海报</button>
      </div>
    </div>`;
  }

  function thumbsHtml(a) {
    if (!a.photos || !a.photos.length) return "";
    const cover = a.coverIndex || 0;
    return a.photos.map((p, i) => {
      const isCover = i === cover;
      return `<div class="thumb ${isCover ? "is-cover" : ""}" style="background-image:url('${p}')">
        <button class="x" data-action="delPhoto" data-i="${i}" title="删除">${ICON("x")}</button>
        ${isCover ? `<span class="cover-badge">封面</span>` : `<button class="set-cover-btn" data-action="setCover" data-i="${i}">设为封面</button>`}
      </div>`;
    }).join("");
  }
  function missingHtml(a) {
    return `<div class="missing-card"><h4>还差 ${a.missing.length} 项即可发布（已为你预填推荐值）</h4>
      ${a.missing.map((m) => `<div class="q-item">
        <div class="q">${esc(m.q)}</div>
        ${m.type === "bool"
        ? `<div class="quick"><button class="sel" data-action="pickMissing" data-key="${m.key}" data-val="1">包含</button><button data-action="pickMissing" data-key="${m.key}" data-val="0">不包含</button><button data-action="pickMissing" data-key="${m.key}" data-val="2">暂不确定</button></div>`
        : `<div class="row gap-8"><input class="input" data-bind="${m.key}" value="${esc(a[m.key] || "")}" style="flex:1"><div class="quick">${(m.suggest || []).map((s) => `<button data-action="pickMissing" data-key="${m.key}" data-val="${esc(s)}">${esc(s)}</button>`).join("")}</div></div>`}
      </div>`).join("")}
    </div>`;
  }

  function renderList() {
    const tabs = [["all", "全部"], ["recruiting", "招募中"], ["draft", "草稿"], ["full", "已满员"], ["ended", "已结束"], ["down", "已下架"]];
    const f = state.listFilter || "all";
    const acts = state.activities.filter((a) => f === "all" || a.status === f);
    return `<div class="row between" style="margin-bottom:18px">
        <div><div class="eyebrow">活动管理</div><h2 class="section-title" style="margin:4px 0 0">你发布过的所有活动</h2></div>
        <button class="btn btn-primary" data-action="nav" data-view="create">${ICON("plus")} 新建活动</button>
      </div>
      <div class="row gap-8 wrap" style="margin-bottom:18px">
        ${tabs.map(([k, l]) => `<button class="btn btn-sm ${f === k ? "btn-primary" : "btn-ghost"}" data-action="filter" data-f="${k}">${l}</button>`).join("")}
      </div>
      ${acts.length ? `<div class="activity-strip">${acts.map(actCard).join("")}</div>` : `<div class="empty"><div class="e-ic">📭</div><div>该分类下还没有活动</div></div>`}
    `;
  }

  function signupCard(s, a) {
    const idMap = { idcard: "身份证", passport: "护照", other: "证件" };
    const idLabel = idMap[s.idType] || "证件";
    const idMask = s.idNumber ? s.idNumber.replace(/^(.{3})(.*)(.{4})$/, "$1********$3") : "—";
    const childInfo = s.children > 0 ? `${s.childName || "儿童"}${s.childAge ? "（" + s.childAge + "岁）" : ""}` : "—";
    const customInfo = (a && a.customFields || []).filter((f) => s.custom && s.custom[f.id]).map((f) => `<div class="su-row"><span class="su-k">${esc(f.label)}</span><span class="su-v">${esc(s.custom[f.id])}</span></div>`).join("");
    const dep = (a && a.departures && s.departureId) ? a.departures.find((d) => d.id === s.departureId) : null;
    const depText = dep ? `${dep.weekDay} ${formatDepartureSlash(dep.date)}` : (a ? (a.dateMD || a.date || "—") : "—");
    return `<div class="su-card">
      <div class="su-head">
        <div class="su-title"><b>${esc(s.name)}</b><span class="su-phone">${esc(s.phone)}</span></div>
        ${s.paid ? '<span class="badge badge-paid">已付款</span>' : '<span class="badge badge-draft">待确认</span>'}
      </div>
      <div class="su-body">
        <div class="su-row"><span class="su-k">团期</span><span class="su-v">${esc(depText)}</span></div>
        <div class="su-row"><span class="su-k">${idLabel}</span><span class="su-v">${idMask}</span></div>
        <div class="su-row"><span class="su-k">成人 / 儿童</span><span class="su-v">${s.adults} / ${s.children}</span></div>
        <div class="su-row"><span class="su-k">儿童信息</span><span class="su-v">${childInfo}</span></div>
        ${s.note ? `<div class="su-row"><span class="su-k">备注</span><span class="su-v">${esc(s.note)}</span></div>` : ""}
        ${customInfo}
      </div>
      <div class="su-foot">
        ${s.paid ? "" : `<button class="btn btn-soft btn-sm" data-action="markPaid" data-id="${s.id}">标记付款</button>`}
        <button class="btn btn-ghost btn-sm" data-action="cancelSignup" data-id="${s.id}">取消报名</button>
      </div>
    </div>`;
  }

  function csvCell(v) {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function downloadText(filename, text, mime) {
    try {
      const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) { toast("导出失败：" + e.message); }
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => toast("已复制到剪贴板")).catch(() => fallbackCopy(t));
    } else fallbackCopy(t);
  }
  function fallbackCopy(t) {
    const ta = document.createElement("textarea"); ta.value = t;
    ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("已复制到剪贴板"); } catch (e) { toast("复制失败，请手动选择"); }
    document.body.removeChild(ta);
  }
  function exportSignups(activityId) {
    const a = getActivity(activityId); if (!a) return;
    const list = (state.signups || []).filter((s) => s.activityId === activityId);
    if (!list.length) return toast("该活动还没有报名记录");
    const idMap = { idcard: "身份证", passport: "护照", other: "证件" };
    const fields = a.customFields || [];
    const head = ["姓名", "手机号", "团期", "证件类型", "证件号码", "成人人数", "儿童人数", "儿童信息", "备注", "状态", "提交时间"]
      .concat(fields.map((f) => f.label));
    const rows = list.map((s) => {
      const childInfo = s.children > 0 ? (s.childName || "儿童") + (s.childAge ? "（" + s.childAge + "岁）" : "") : "";
      const dep = (a.departures && s.departureId) ? a.departures.find((d) => d.id === s.departureId) : null;
      const depText = dep ? `${dep.weekDay} ${formatDepartureSlash(dep.date)}` : (a.dateMD || a.date || "");
      const base = [
        s.name, s.phone, depText, idMap[s.idType] || "证件", s.idNumber || "",
        s.adults, s.children, childInfo, s.note || "",
        s.paid ? "已付款" : "待确认", new Date(s.createdAt || Date.now()).toLocaleString("zh-CN"),
      ];
      const custom = fields.map((f) => (s.custom && s.custom[f.id]) || "");
      return base.concat(custom);
    });
    const csv = "﻿" + [head].concat(rows).map((r) => r.map(csvCell).join(",")).join("\r\n");
    downloadText((a.title || "报名名单") + "-报名名单.csv", csv, "text/csv;charset=utf-8");
    toast("名单已导出为 CSV（Excel 可直接打开）");
  }
  function notifyDefault(a) {
    return `【${a.title || "活动"}】通知：\n活动时间 ${(a.dateText || a.date) || "待定"}，地点 ${a.place || "待定"}。\n请留意集合时间与装备清单，如有疑问可回复本信息。\n——${state.brand.name || "俱乐部"}`;
  }
  function openNotify(activityId) {
    const a = getActivity(activityId); if (!a) return;
    const list = (state.signups || []).filter((s) => s.activityId === activityId);
    if (!list.length) return toast("该活动还没有报名记录");
    const phones = list.map((s) => s.phone).join(";");
    state._notify = { activityId, phones, count: list.length };
    const m = document.createElement("div");
    m.className = "modal-mask";
    m.innerHTML = `<div class="modal notify-modal" onclick="event.stopPropagation()">
      <div class="modal-head"><b>群发通知 · ${esc(a.title)}</b><button class="icon-btn" data-action="closeNotify">${ICON("x")}</button></div>
      <div class="modal-body">
        <p class="muted small" style="margin:0 0 12px">共 <b>${list.length}</b> 位报名者。Demo 暂未接入短信网关，可复制手机号到群发工具，或复制通知文案发到微信群 / 短信。</p>
        <div class="field"><label>通知文案</label><textarea class="textarea" id="notifyText" rows="6" placeholder="输入要发送的通知...">${esc(notifyDefault(a))}</textarea></div>
        <div class="nf-actions">
          <button class="btn btn-soft" data-action="copyPhones">${ICON("copy")} 复制全部手机号（${list.length}）</button>
          <button class="btn btn-primary" data-action="copyNotify">${ICON("send")} 复制通知文案</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener("click", (e) => { if (e.target === m) { m.remove(); delete state._notify; } });
  }

  function renderSignups() {
    const all = state.signups || [];
    const acts = state.activities || [];
    if (!acts.length) return `<h2 class="section-title">报名名单</h2><div class="empty" style="margin-top:30px"><div class="e-ic">📋</div><div>还没有活动，先去创建一场活动吧</div></div>`;
    const count = (id) => all.filter((s) => s.activityId === id).length;
    signupFilterActivityId = signupFilterActivityId || acts[0].id;
    const current = getActivity(signupFilterActivityId) || acts[0];
    const list = all.filter((s) => s.activityId === signupFilterActivityId);
    const tabs = acts.map((a) => `<button class="su-tab ${a.id === signupFilterActivityId ? "active" : ""}" data-action="filterSignups" data-id="${a.id}">${esc(a.title)} <span>${count(a.id)}</span></button>`).join("");
    const toolbar = list.length ? `<div class="su-toolbar">
        <button class="btn btn-soft btn-sm" data-action="exportSignups" data-id="${signupFilterActivityId}">${ICON("download")} 导出名单</button>
        <button class="btn btn-soft btn-sm" data-action="notifySignups" data-id="${signupFilterActivityId}">${ICON("send")} 群发通知</button>
        <span class="su-count">本场共 ${list.length} 人</span>
      </div>` : "";
    return `<h2 class="section-title" style="margin-bottom:6px">报名名单</h2>
      <p class="muted small" style="margin:0 0 14px">按活动查看名单，管理该场活动的报名与付款状态。</p>
      <div class="su-tabs">${tabs}</div>
      ${toolbar}
      ${list.length ? `<div class="su-cards">${list.map((s) => signupCard(s, current)).join("")}</div>` : `<div class="empty" style="margin-top:30px"><div class="e-ic">📋</div><div>该活动还没有报名记录</div></div>`}`;
  }

  function renderBrand() {
    const b = state.brand;
    const presets = ["#2F5D50", "#B4543B", "#C2873F", "#3E5C7C", "#5C4A7C", "#4A6B3E"];
    return `<h2 class="section-title" style="margin-bottom:18px">品牌设置</h2>
      <div class="editor" style="grid-template-columns:1fr 320px">
        <div class="panel"><div class="panel-head"><h3>机构信息</h3></div>
          <div class="panel-body">
            <div class="field"><label>机构名称</label><input class="input" data-brand="name" value="${esc(b.name)}"></div>
            <div class="field"><label>机构 Logo 图片</label>
              <div class="logo-upload" data-action="uploadLogo">
                ${b.logo
                  ? `<img class="logo-prev" src="${esc(b.logo)}" alt="logo"><button class="logo-del" data-action="delLogo" title="移除图片">${ICON("x")}</button>`
                  : `<div class="logo-ph"><div class="ic">${ICON("upload")}</div>点击上传图片 Logo</div><div class="tiny muted">多数机构已有图片 Logo，直接上传即可；留空则显示文字</div>`}
              </div>
            </div>
            <div class="field"><label>Logo 文字（无图片时显示）</label><input class="input" data-brand="logoText" value="${esc(b.logoText)}" maxlength="2"></div>
            <div class="field"><label>品牌口号</label><input class="input" data-brand="slogan" value="${esc(b.slogan)}"></div>
            <div class="field"><label>品牌风格</label><select class="select" data-brand="style">
              ${["专业克制", "年轻户外", "温暖亲子", "高级旅行", "活泼社群"].map((s) => `<option ${b.style === s ? "selected" : ""}>${s}</option>`).join("")}
            </select></div>
            <div class="field"><label>机构简介</label><textarea class="textarea" data-brand="intro">${esc(b.intro)}</textarea></div>
            <div class="grid-2">
              <div class="field"><label>客服微信</label><input class="input" data-brand="wechat" value="${esc(b.wechat)}"></div>
              <div class="field"><label>联系电话</label><input class="input" data-brand="phone" value="${esc(b.phone)}"></div>
            </div>
            <div class="field"><label>机构地址</label><input class="input" data-brand="address" value="${esc(b.address)}"></div>
            <button class="btn btn-primary" data-action="saveBrand">${ICON("check")} 保存品牌设置</button>
          </div>
        </div>
        <div>
          <div class="panel"><div class="panel-head"><h3>品牌主色</h3></div>
            <div class="panel-body">
              <div class="color-row" style="margin-bottom:12px">
                ${presets.map((c) => `<div class="sw" data-action="pickColor" data-c="${c}" style="background:${c}"></div>`).join("")}
              </div>
              <input type="color" data-brand="primary" value="${esc(b.primary)}" style="width:100%;height:42px;border:1px solid var(--line);border-radius:11px">
              <div class="brand-prev">
                <div class="bl ${b.logo ? "bl-img" : ""}" id="brandPrevLogo" style="${b.logo ? "background-image:url('" + esc(b.logo) + "')" : "background:" + esc(b.primary)}">${b.logo ? "" : esc(b.logoText)}</div>
                <div><div style="font-weight:700" id="brandPrevName">${esc(b.name)}</div><div class="tiny muted" id="brandPrevSlogan">${esc(b.slogan)}</div></div>
              </div>
              <p class="tiny muted" style="margin-top:12px">主色将实时应用到整个工作台与活动页。</p>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderMembership() {
    const status = state.clubStatus || "approved";
    const statusLabel = { approved: "已通过", pending: "审核中", rejected: "未通过", suspended: "已停用" }[status] || "已通过";
    const aiBal = aiBalance();
    const mallSales = state.mallSalesMonth || 0;
    const nextMilestone = AI_MILESTONES.find((m) => mallSales < m.t);
    const progress = nextMilestone ? Math.min(100, Math.round((mallSales / nextMilestone.t) * 100)) : 100;
    return `<h2 class="section-title" style="margin-bottom:6px">俱乐部中心</h2>
      <div class="mem-hero is-member">
        <div class="mem-plan-row">
          <div class="mem-plan-name">ClubOS 俱乐部版</div>
          <div class="mem-points">入驻状态：${statusLabel}</div>
        </div>
        <div class="mem-plan-sub">全功能免费开放 · 活动报名 0% 抽成 · 装备商城销售得佣金</div>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>AI 额度</h3><span class="more" data-action="openAiCredit">明细</span></div>
        <div class="mem-ai">
          <div class="ai-balance-row"><b>${aiBal.toLocaleString()}</b><span> AI 积分</span></div>
          <div class="ai-progress"><div class="ai-progress-bar" style="width:${progress}%"></div></div>
          <p class="muted small" style="margin-top:8px">${nextMilestone ? `本月商城销售 ¥${mallSales.toLocaleString()} · 达 ¥${nextMilestone.t.toLocaleString()} 奖励 +${nextMilestone.g} AI 积分（${progress}%）` : "已达最高里程碑，继续加油"}</p>
          <div class="row between" style="margin-top:6px"><span class="muted small">基础 / 赠送 / 充值</span><span class="muted small">${(state.aiCredit.base || 0).toLocaleString()} · ${(state.aiCredit.gift || 0).toLocaleString()} · ${(state.aiCredit.paid || 0).toLocaleString()}</span></div>
          <p class="muted small" style="margin-top:6px">每月基础额度自动刷新，销量里程碑赠送按月清零，充值余额永久不清零。</p>
        </div>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>我的商城</h3><span class="more" data-action="openMallCommission">佣金明细</span></div>
        <div class="mem-ai">
          <div class="row between"><span class="muted small">本月装备销售</span><b>¥${mallSales}</b></div>
          <div class="row between"><span class="muted small">待结算佣金</span><b>¥${commissionSummary().pending + commissionSummary().frozen + commissionSummary().available}</b></div>
          <div class="row between"><span class="muted small">本月已结算佣金</span><b>¥${commissionSummary().settled}</b></div>
          <p class="muted small" style="margin-top:8px">商城由平台统一运营（上架 / 售价 / 物流 / 售后），俱乐部仅负责推荐与成交，按销量获得单级归因佣金。佣金流转：待确认 → 冻结 → 可结算 → 已结算，退款即冲销。</p>
        </div>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>入驻资料</h3></div>
        <div class="mem-ai">
          <button class="btn btn-soft btn-block" data-action="openApplyClub">${status === "approved" ? "查看 / 修改入驻资料" : "补充入驻资料"}</button>
        </div>
      </div>`;
  }

  function renderMembershipH5() {
    return `<div class="front front-v16">
      <div class="front-body">
        ${renderMembership()}
      </div>
      <div class="front-tabbar">
        <div class="ft-item" data-action="openFrontHome">${ICON("home")}<span>首页</span></div>
        <div class="ft-item" data-action="toast" data-msg="目的地页开发中">${ICON("map-pin")}<span>目的地</span></div>
        <div class="ft-item" data-action="openMall">${ICON("shopping-bag")}<span>商城</span></div>
        <div class="ft-item active" data-action="membership">${ICON("crown")}<span>会员</span></div>
        <div class="ft-item" data-action="mySignups">${ICON("users")}<span>我的</span></div>
      </div>
    </div>`;
  }

  /* ---------------- views: frontend ---------------- */
  function frontLogo(size = 44, onDark = false) {
    const b = state.brand;
    if (b.logo) return `<img class="fh-logo-img ${onDark ? "on-dark" : ""}" src="${esc(b.logo)}" alt="" style="width:${size}px;height:${size}px">`;
    return `<div class="fh-logo-text ${onDark ? "on-dark" : ""}" style="width:${size}px;height:${size}px">${esc(b.logoText || "C")}</div>`;
  }
  const CATEGORIES = [
    { key: "hike", name: "山野徒步", color: "#2F5D50", img: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80", icon: "mountain" },
    { key: "camp", name: "亲子露营", color: "#C2873F", img: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80", icon: "tent" },
    { key: "nature", name: "自然探索", color: "#6E9B86", img: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80", icon: "leaf" },
    { key: "study", name: "研学营", color: "#6B8EAE", img: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400&q=80", icon: "compass" },
    { key: "water", name: "溯溪玩水", color: "#4A9AA8", img: "https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&q=80", icon: "droplet" },
    { key: "cycling", name: "骑行", color: "#8B6B4A", img: "https://images.unsplash.com/photo-1544191696-1029c4f70d78?w=400&q=80", icon: "bike" },
  ];
