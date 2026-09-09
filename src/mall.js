  function renderStorefront() {
    const b = state.brand || {};
    const products = state.mallProducts || [];
    const recs = (state.myRecs || []).map((id) => getProduct(id)).filter(Boolean);
    const cats = [...new Set(products.map((p) => p.category))];
    const card = (p) => `<div class="mall-card" data-action="mallProduct" data-id="${p.id}">
        <div class="mall-ph" style="background-image:url('${esc(p.cover)}')"></div>
        <div class="mall-meta">
          <div class="mall-title">${esc(p.title)}</div>
          <div class="mall-sub">${esc(p.subtitle)}</div>
          <div class="mall-tags"><span class="gear-type g-${p.riskLevel}">${gearTypeLabel(p.riskLevel)}</span><span class="mall-cat">${esc(p.category)}</span><span class="mall-rate">★ ${p.rating}</span></div>
          <div class="mall-foot"><b class="mall-price">¥${p.retailPrice}</b><span class="mall-ship">顺丰包邮</span></div>
        </div>
      </div>`;
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="back">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">装备商城</div></div>
      <div class="store-hero">
        <div class="store-hero-t">${esc(b.name || "俱乐部")}装备精选</div>
        <div class="store-hero-s">跟着领队用过的装备清单挑，出发前一次备齐</div>
        <div class="store-trust"><span>${ICON("check")} 正品直发</span><span>${ICON("check")} 7 天无理由</span><span>${ICON("check")} 售后统一受理</span></div>
      </div>
      ${recs.length ? `<div class="fr-section"><div class="fr-section-h"><h3>领队推荐</h3></div><div class="mall-recs">${recs.map((p) => `<div class="mall-rec" data-action="mallProduct" data-id="${p.id}"><div class="mall-rec-ph" style="background-image:url('${esc(p.cover)}')"></div><div class="mall-rec-t">${esc(p.title)}</div><div class="mall-rec-p">¥${p.retailPrice}</div></div>`).join("")}</div></div>` : ""}
      <div class="front-body">
        <div class="mall-cats">${cats.map((c) => `<span class="mall-cat-pill">${c}</span>`).join("")}</div>
        <div class="mall-grid">${products.map(card).join("")}</div>
      </div>
      ${frontTabbar("mall")}
    </div>`;
  }

  // 俱乐部收益视角
  function renderClubMallConsole() {
    const cid = currentClubId();
    const orders = clubMallOrders();
    const cs = clubCommissionSummary();
    const products = state.mallProducts || [];
    const recIds = state.myRecs || [];
    const recs = recIds.map((id) => getProduct(id)).filter(Boolean);
    const tab = state.mallConsoleTab || "products";
    return `<div class="wrap">
      <div class="section-head">
        <div class="section-title">商城收益</div>
        <div class="section-sub">平台统一运营商品、定价、发货与售后；你只负责推荐，按成交拿佣金</div>
      </div>
      <div class="stat-grid">
        <div class="stat"><div class="num">¥${Math.round(cs.pending + cs.frozen)}</div><div class="lbl">在途佣金</div></div>
        <div class="stat"><div class="num">¥${Math.round(cs.available)}</div><div class="lbl">可结算</div></div>
        <div class="stat"><div class="num">¥${Math.round(cs.settled)}</div><div class="lbl">已到账</div></div>
        <div class="stat"><div class="num">${recs.length}</div><div class="lbl">本店主推</div></div>
      </div>
      <div class="mall-console-tabs">
        <button class="mall-console-tab ${tab === "products" ? "active" : ""}" data-action="mallConsoleTab" data-tab="products">平台商品 / 主推设置</button>
        <button class="mall-console-tab ${tab === "orders" ? "active" : ""}" data-action="mallConsoleTab" data-tab="orders">订单 / 物流 / 售后</button>
        <button class="mall-console-tab ${tab === "commission" ? "active" : ""}" data-action="mallConsoleTab" data-tab="commission">佣金结算</button>
      </div>
      ${tab === "products" ? renderMallProductsPanel(products, recIds, recs) : ""}
      ${tab === "orders" ? renderMallOrdersPanel(orders) : ""}
      ${tab === "commission" ? renderMallCommissionPanel(orders, cs) : ""}
    </div>`;
  }
  function renderMallProductsPanel(products, recIds, recs) {
    const rate = (p) => (p.commissionMode === "fixed" ? "¥" + p.commissionValue + "/件" : p.commissionValue + "%");
    const row = (p) => {
      const featured = recIds.includes(p.id);
      return `<div class="shelf-row">
        <div class="mall-rec-ph" style="background-image:url('${esc(p.cover)}')"></div>
        <div class="shelf-info">
          <div class="shelf-t">${esc(p.title)}</div>
          <div class="shelf-s">售价 ¥${p.retailPrice} · 单件佣金 ¥${commissionOf(p, p.retailPrice)}（${rate(p)}）</div>
        </div>
        <button class="btn ${featured ? "btn-ghost" : "btn-soft"} btn-sm" data-action="mallToggleRec" data-id="${p.id}" data-stay="1">${featured ? "取消主推" : "设为主推"}</button>
      </div>`;
    };
    return `<div class="mall-console-panel">
      ${recs.length ? `<div class="fr-section"><div class="fr-section-h"><h3>本店主推</h3><span class="tiny muted">会员在商城首页与活动页会优先看到这些商品</span></div><div class="shelf-list">${recs.map(row).join("")}</div></div>` : ""}
      <div class="fr-section"><div class="fr-section-h"><h3>平台商品池</h3><span class="tiny muted">平台已统一上架，你只能决定是否主推</span></div><div class="shelf-list">${products.map(row).join("")}</div></div>
    </div>`;
  }
  function renderMallOrdersPanel(orders) {
    const sorted = orders.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const row = (o) => {
      const title = (o.items && o.items[0] && o.items[0].title) || "商品";
      const logi = logisticsLabel(o.logistics);
      return `<div class="order-row">
        <div class="order-main">
          <div class="order-title">${esc(title)}</div>
          <div class="order-sub">订单 ${esc((o.id || "").slice(0, 8))} · ¥${o.amount} · ${formatDateYMD(new Date(o.createdAt))}</div>
          <div class="order-logi">${ICON("truck")} 物流：${logi}${o.trackingNo ? " · 运单 " + esc(o.trackingNo) : ""}</div>
        </div>
        <div class="order-status">${o.refunded ? `<span class="badge refund">已退款</span>` : `<span class="badge ${o.logistics}">${logi}</span>`}</div>
      </div>`;
    };
    return `<div class="mall-console-panel"><div class="fr-section"><div class="fr-section-h"><h3>本俱乐部 C 端订单</h3></div>${sorted.length ? `<div class="order-list">${sorted.map(row).join("")}</div>` : `<p class="muted small">暂无订单。</p>`}</div></div>`;
  }

  function renderMallAdmin() {
    const products = state.mallProducts || [];
    const ed = state.mallEditId ? getProduct(state.mallEditId) : null;
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="mallBack">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">平台商城运营</div></div>
      <div class="front-body">
        <div class="fr-section"><div class="fr-section-h"><h3>商品管理（平台）</h3><span class="more" data-action="mallNew">新增商品</span></div>
          <div class="mall-admin-list">${products.map((p) => `<div class="mall-admin-row" data-action="mallEdit" data-id="${p.id}">
            <div class="mall-rec-ph" style="background-image:url('${esc(p.cover)}')"></div>
            <div class="mall-admin-info"><div class="mall-rec-t">${esc(p.title)}</div><div class="mall-sub">${esc(p.category)} · ${riskLabel(p.riskLevel)} · 供货 ¥${p.supplyPrice} · 售 ¥${p.retailPrice}</div></div>
            <button class="btn btn-ghost btn-sm" data-action="mallDel" data-id="${p.id}">删除</button>
          </div>`).join("")}</div>
        </div>
        ${ed ? `<div class="fr-section"><div class="fr-section-h"><h3>编辑商品</h3></div>
          <div class="apply-form">
            <label>商品名<input id="mpTitle" class="input" value="${esc(ed.title)}"></label>
            <label>售价<input id="mpPrice" class="input" type="number" value="${ed.retailPrice}"></label>
            <label>供货价<input id="mpSupply" class="input" type="number" value="${ed.supplyPrice}"></label>
            <label>佣金模式<select id="mpMode" class="input"><option value="percentage" ${ed.commissionMode === "percentage" ? "selected" : ""}>按比例 %</option><option value="fixed" ${ed.commissionMode === "fixed" ? "selected" : ""}>固定 ¥</option></select></label>
            <label>佣金值<input id="mpValue" class="input" type="number" value="${ed.commissionValue}"></label>
            <label>风险等级<select id="mpRisk" class="input"><option value="L1" ${ed.riskLevel === "L1" ? "selected" : ""}>L1 普通</option><option value="L2" ${ed.riskLevel === "L2" ? "selected" : ""}>L2 一般户外</option><option value="L3" ${ed.riskLevel === "L3" ? "selected" : ""}>L3 安全关键</option></select></label>
            <button class="btn btn-primary btn-block" data-action="mallSave" data-id="${ed.id}">保存</button>
          </div></div>` : ""}
        <div class="fr-section"><div class="fr-section-h"><h3>佣金结算（平台）</h3>${commissionSummary().available > 0 ? `<span class="more" data-action="mallSettleAll">结算全部可结算</span>` : ""}</div>
          <div class="comm-list">${state.mallOrders && state.mallOrders.length ? (state.mallOrders.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((o) => mallCommRowHtml(o, true)).join("")) : `<p class="muted small">暂无商城订单。</p>`}</div>
        </div>
      </div>
    </div>`;
  }

  function renderMallProduct(p) {
    if (!p) return `<div class="front"><div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="mallBack">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">商品详情</div></div><div class="front-body"><p class="muted small">商品不存在或已下架。</p></div></div>`;
    const isConsole = mallCtx() === "console";
    const commission = commissionOf(p, p.retailPrice);
    const onShelf = (state.myRecs || []).includes(p.id);
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="mallBack">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">${isConsole ? "商品详情（俱乐部视角）" : "商品详情"}</div></div>
      <div class="mall-detail-ph" style="background-image:url('${esc(p.cover)}')"></div>
      <div class="front-body">
        <div class="mall-detail-title">${esc(p.title)}</div>
        <div class="mall-sub">${esc(p.subtitle)}</div>
        <div class="mall-tags"><span class="gear-type g-${p.riskLevel}">${gearTypeLabel(p.riskLevel)}</span><span class="mall-cat">${esc(p.category)}</span><span class="mall-rate">★ ${p.rating}</span></div>
        ${isConsole ? `
        <div class="mall-detail-price"><b>¥${p.retailPrice}</b><span>单件佣金 ¥${commission}</span></div>
        <div class="mall-detail-note">平台负责上架、定价、库存、物流与售后；俱乐部不接触货款，只能决定是否将该款设为本店主推。</div>
        <button class="btn ${onShelf ? "btn-soft" : "btn-primary"} btn-lg btn-block" data-action="mallToggleRec" data-id="${p.id}">${onShelf ? "取消主推" : "设为主推商品"}</button>
        ` : `
        <div class="mall-detail-price"><b>¥${p.retailPrice}</b><span class="mall-ship">顺丰包邮 · 48h 内发出</span></div>
        <div class="mall-detail-note">正品直发，7 天无理由退换；穿戴与尺码问题可直接在订单里申请售后。</div>
        <button class="btn btn-primary btn-lg btn-block" data-action="mallBuy" data-id="${p.id}">立即购买</button>
        `}
      </div>
    </div>`;
  }

