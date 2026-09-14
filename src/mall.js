  function mallCardHtml(p) {
    const soldOut = (p.stock || 0) <= 0;
    const low = !soldOut && (p.stock || 0) <= 20;
    const badge = soldOut ? `<span class="mall-stock-badge soldout">已售罄</span>` : low ? `<span class="mall-stock-badge low">仅剩 ${p.stock} 件</span>` : "";
    return `<div class="mall-card ${soldOut ? "is-soldout" : ""}" data-action="mallProduct" data-id="${p.id}">
        <div class="mall-ph" ${smartBg(p.cover)}>${badge}</div>
        <div class="mall-meta">
          <div class="mall-title">${esc(p.title)}</div>
          <div class="mall-sub">${esc(p.subtitle)}</div>
          <div class="mall-tags"><span class="gear-type g-${p.riskLevel}">${gearTypeLabel(p.riskLevel)}</span><span class="mall-cat">${esc(p.category)}</span><span class="mall-rate">★ ${p.rating} · ${(productReviews(p) || []).length} 条</span></div>
          <div class="mall-foot"><b class="mall-price">¥${p.retailPrice}</b><span class="mall-ship">顺丰包邮</span></div>
        </div>
      </div>`;
  }
  function mallFilteredProducts() {
    const f = state.mallFilter || {};
    let list = (state.mallProducts || []).slice();
    if (f.keyword) {
      const k = String(f.keyword).toLowerCase();
      list = list.filter((p) => (p.title + " " + p.subtitle + " " + p.category + " " + (p.tags || []).join(" ")).toLowerCase().includes(k));
    }
    if (f.category && f.category !== "all") list = list.filter((p) => p.category === f.category);
    if (f.gear && f.gear !== "all") list = list.filter((p) => p.riskLevel === f.gear);
    if (f.tag && f.tag !== "all") list = list.filter((p) => (p.tags || []).includes(f.tag));
    const sort = f.sort || "default";
    if (sort === "priceAsc") list.sort((a, b) => a.retailPrice - b.retailPrice);
    else if (sort === "priceDesc") list.sort((a, b) => b.retailPrice - a.retailPrice);
    else if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    // 售罄永远沉底（稳定排序保留同组内顺序）
    list.sort((a, b) => ((a.stock > 0 ? 0 : 1) - (b.stock > 0 ? 0 : 1)));
    return list;
  }
  function mallGridHtml() {
    const list = mallFilteredProducts();
    if (!list.length) return `<div class="mall-empty">没有符合条件的装备，换个筛选试试～</div>`;
    return list.map(mallCardHtml).join("");
  }
  function refreshMallGrid() {
    const g = document.getElementById("mallGrid");
    if (g) g.innerHTML = mallGridHtml();
  }
  // 演示用稳定评价数据：按商品 id 生成，刷新页面不变（非真实用户评价）
  function productReviews(p) {
    const seed = (p.id || "").split("").reduce((n, c) => n + c.charCodeAt(0), 0);
    const nicks = ["山野老周", "小鹿同学", "阿凯", "Luna", "户外萌新", "清风", "大鹏", "薏米"];
    const avPrefix = ["https://api.dicebear.com/7.x/avataaars/svg?seed=", "https://api.dicebear.com/7.x/thumbs/svg?seed="];
    const parts = ["登山时用着很顺手", "领队推荐的果然靠谱", "轻量好收纳，赞", "做工扎实，性价比高", "物流很快，隔天就到了", "尺码标准，版型好看", "陪我走完了全程，稳", "细节到位，会回购"];
    const base10 = Math.round((p.rating || 4.5) * 10);
    const count = 3 + (seed % 4);
    const list = [];
    for (let i = 0; i < count; i++) {
      const r = Math.max(3, Math.min(5, Math.round(base10 / 10 + ((seed + i * 7) % 5 - 2) / 10)));
      list.push({
        nickname: nicks[(seed + i) % nicks.length],
        avatar: (avPrefix[i % avPrefix.length]) + encodeURIComponent(p.id + "_" + i),
        rating: r,
        content: parts[(seed + i * 3) % parts.length],
        date: new Date(Date.now() - (i + 1) * 86400000 * (3 + (seed % 6))).toLocaleDateString("zh-CN")
      });
    }
    return list;
  }
  function mallReviewsHtml(p, reviews) {
    if (!reviews || !reviews.length) return "";
    const stars = (n) => "★".repeat(n) + "☆".repeat(5 - n);
    return `<div class="mall-reviews">
      <div class="mall-reviews-h"><span>商品评价</span><span class="mall-reviews-sum">★ ${p.rating} · ${reviews.length} 条</span></div>
      <div class="mall-review-list">${reviews.map((rv) => `<div class="mall-review">
        <img class="mall-review-av" src="${rv.avatar}" alt="" loading="lazy">
        <div class="mall-review-body">
          <div class="mall-review-top"><span class="mall-review-name">${esc(rv.nickname)}</span><span class="mall-review-stars">${stars(rv.rating)}</span><span class="mall-review-date">${rv.date}</span></div>
          <div class="mall-review-c">${esc(rv.content)}</div>
        </div>
      </div>`).join("")}</div>
    </div>`;
  }
  function renderStorefront() {
    const b = state.brand || {};
    const products = state.mallProducts || [];
    const recs = (state.myRecs || []).map((id) => getProduct(id)).filter(Boolean);
    const cats = [...new Set(products.map((p) => p.category))];
    const tags = [...new Set(products.flatMap((p) => p.tags || []))];
    const f = state.mallFilter || {};
    const chip = (key, val, label) => `<button class="mall-chip ${f[key] === val ? "active" : ""}" data-action="mallFilter" data-fkey="${key}" data-fval="${val}">${label}</button>`;
    const sortOpts = [["default", "综合"], ["priceAsc", "价格低→高"], ["priceDesc", "价格高→低"], ["rating", "评分优先"]];
    const cartCount = (state.mallCart || []).reduce((n, i) => n + (i.qty || 1), 0);
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="back">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">装备商城</div>
        <button class="mall-cart-btn" data-action="openMallCart" aria-label="购物车">${ICON("shopping-cart")}${cartCount ? `<span class="mall-cart-badge">${cartCount}</span>` : ""}</button>
      </div>
      <div class="store-hero">
        <div class="store-hero-t">${esc(b.name || "俱乐部")}装备精选</div>
        <div class="store-hero-s">跟着领队用过的装备清单挑，出发前一次备齐</div>
        <div class="store-trust"><span>${ICON("check")} 正品直发</span><span>${ICON("check")} 7 天无理由</span><span>${ICON("check")} 售后统一受理</span></div>
      </div>
      ${recs.length ? `<div class="fr-section"><div class="fr-section-h"><h3>领队推荐</h3></div><div class="mall-recs">${recs.map((p) => `<div class="mall-rec" data-action="mallProduct" data-id="${p.id}"><div class="mall-rec-ph" ${smartBg(p.cover)}></div><div class="mall-rec-t">${esc(p.title)}</div><div class="mall-rec-p">¥${p.retailPrice}</div></div>`).join("")}</div></div>` : ""}
      <div class="front-body">
        <div class="mall-filterbar">
          <div class="mall-search"><input id="mallSearchInput" class="mall-search-input" type="search" placeholder="搜索装备 / 关键词" value="${esc(f.keyword)}"><span class="mall-search-ic">${ICON("search")}</span></div>
          <div class="mall-chips"><span class="mall-chip-label">分类</span>${chip("category", "all", "全部")}${cats.map((c) => chip("category", c, c)).join("")}</div>
          <div class="mall-chips"><span class="mall-chip-label">类型</span>${chip("gear", "all", "全部")}${chip("gear", "L1", "普通装备")}${chip("gear", "L2", "专业装备")}${chip("gear", "L3", "技术装备")}</div>
          <div class="mall-chips"><span class="mall-chip-label">场景</span>${chip("tag", "all", "全部")}${tags.map((t) => chip("tag", t, t)).join("")}</div>
          <div class="mall-chips mall-chips-inline"><span class="mall-chip-label">排序</span>
            <select class="mall-sort" data-action="mallFilter" data-fkey="sort">
              ${sortOpts.map(([v, l]) => `<option value="${v}" ${f.sort === v ? "selected" : ""}>${l}</option>`).join("")}
            </select>
            ${(f.keyword || f.category !== "all" || f.gear !== "all" || f.tag !== "all" || f.sort !== "default") ? `<button class="mall-filter-reset" data-action="mallFilterReset">清除筛选</button>` : ""}
          </div>
        </div>
        <div class="mall-grid" id="mallGrid">${mallGridHtml()}</div>
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
        <div class="mall-rec-ph" ${smartBg(p.cover)}></div>
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
        <div class="order-status">${o.refunded ? `<span class="badge refund">已退款</span>` : `<span class="badge ${o.logistics}">${logi}</span>${o.commissionStatus !== "settled" ? `<button class="btn btn-ghost btn-sm cart-refund" data-action="mallRefund" data-id="${o.id}">申请退款</button>` : ""}`}</div>
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
            <div class="mall-rec-ph" ${smartBg(p.cover)}></div>
            <div class="mall-admin-info"><div class="mall-rec-t">${esc(p.title)}</div><div class="mall-sub">${esc(p.category)} · ${riskLabel(p.riskLevel)} · 供货 ¥${p.supplyPrice} · 售 ¥${p.retailPrice} · 库存 ${p.stock} 件</div></div>
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
            <label>库存（件）<input id="mpStock" class="input" type="number" value="${ed.stock != null ? ed.stock : 100}"></label>
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
    const soldOut = (p.stock || 0) <= 0;
    const stockText = soldOut ? "已售罄" : ((p.stock || 0) <= 20 ? "仅剩 " + p.stock + " 件" : "现货 " + p.stock + " 件");
    const reviews = productReviews(p);
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="mallBack">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">${isConsole ? "商品详情（俱乐部视角）" : "商品详情"}</div></div>
      <div class="mall-detail-ph" ${smartBg(p.cover)}></div>
      <div class="front-body">
        <div class="mall-detail-title">${esc(p.title)}</div>
        <div class="mall-sub">${esc(p.subtitle)}</div>
        <div class="mall-tags"><span class="gear-type g-${p.riskLevel}">${gearTypeLabel(p.riskLevel)}</span><span class="mall-cat">${esc(p.category)}</span><span class="mall-rate">★ ${p.rating}</span></div>
        ${isConsole ? `
        <div class="mall-detail-price"><b>¥${p.retailPrice}</b><span>单件佣金 ¥${commission}</span></div>
        <div class="mall-detail-note">平台负责上架、定价、库存、物流与售后；俱乐部不接触货款，只能决定是否将该款设为本店主推。<br>当前库存：${p.stock} 件</div>
        <button class="btn ${onShelf ? "btn-soft" : "btn-primary"} btn-lg btn-block" data-action="mallToggleRec" data-id="${p.id}">${onShelf ? "取消主推" : "设为主推商品"}</button>
        ` : `
        <div class="mall-detail-price"><b>¥${p.retailPrice}</b><span class="mall-ship">顺丰包邮 · 48h 内发出</span></div>
        <div class="mall-detail-stock ${soldOut ? "soldout" : ""}">${ICON(soldOut ? "x-circle" : "check")} ${stockText}</div>
        <div class="mall-detail-note">正品直发，7 天无理由退换；穿戴与尺码问题可直接在订单里申请售后。</div>
        <div class="mall-detail-actions">
          ${soldOut
            ? `<button class="btn btn-ghost btn-lg btn-block" disabled>已售罄</button>`
            : `<button class="btn btn-soft btn-lg" data-action="mallAddCart" data-id="${p.id}">加入购物车</button>
               <button class="btn btn-primary btn-lg" data-action="mallBuy" data-id="${p.id}">立即购买</button>`}
        </div>
        ${mallReviewsHtml(p, reviews)}
        `}
      </div>
    </div>`;
  }

  function renderMallCart() {
    const cart = state.mallCart || [];
    const items = cart.map((c) => { const p = getProduct(c.productId); return p ? { p, qty: Math.max(1, c.qty || 1) } : null; }).filter(Boolean);
    const total = items.reduce((n, it) => n + it.p.retailPrice * it.qty, 0);
    const cartCount = cart.reduce((n, i) => n + (i.qty || 1), 0);
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="openMall">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">购物车</div>
        ${cartCount ? `<button class="mall-cart-btn" data-action="openMallCart" aria-label="购物车">${ICON("shopping-cart")}<span class="mall-cart-badge">${cartCount}</span></button>` : ""}
      </div>
      <div class="front-body">
        ${items.length ? `
        <div class="cart-list">
          ${items.map((it) => `<div class="cart-row" data-id="${it.p.id}">
            <div class="cart-ph" ${smartBg(it.p.cover)}></div>
            <div class="cart-info">
              <div class="cart-t">${esc(it.p.title)}</div>
              <div class="cart-price">¥${it.p.retailPrice}</div>
              <div class="cart-qty">
                <button class="cart-step" data-action="mallCartDec" data-id="${it.p.id}" aria-label="减少">−</button>
                <span class="cart-qty-num">${it.qty}</span>
                <button class="cart-step" data-action="mallCartInc" data-id="${it.p.id}" aria-label="增加">+</button>
              </div>
            </div>
            <button class="cart-del" data-action="mallCartRemove" data-id="${it.p.id}" aria-label="删除">${ICON("x")}</button>
          </div>`).join("")}
        </div>
        <div class="cart-foot">
          <div class="cart-total">合计 <b>¥${total}</b></div>
          <button class="btn btn-primary btn-lg btn-block" data-action="mallCheckout">去结算 · ¥${total}</button>
        </div>
        ` : `<div class="cart-empty">${ICON("shopping-cart")}<p>购物车还是空的</p><button class="btn btn-soft" data-action="openMall">去商城逛逛</button></div>`}
      </div>
      ${frontTabbar("mall")}
    </div>`;
  }

