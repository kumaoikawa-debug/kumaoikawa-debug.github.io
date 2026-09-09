/* ClubOS Platform — modular build (split from monolithic app.js v81).
   Loaded as classic <script> in order; shared global scope, no bundler. */
  const THEMES = [
    { name: "周末亲子", tag: "周末", img: "https://images.unsplash.com/photo-1472162072942-cd5147eb3902?w=600&q=80" },
    { name: "暑期独立营", tag: "独立", img: "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=600&q=80" },
    { name: "轻奢小团", tag: "轻奢", img: "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=600&q=80" },
    { name: "自然夜观", tag: "夜观", img: "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80" },
    { name: "徒步挑战", tag: "挑战", img: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80" },
    { name: "露营观星", tag: "观星", img: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=600&q=80" },
  ];

  /* ---------------- V2.0 装备商城种子数据（Demo 模拟，平台统一运营） ---------------- */
  const MOCK_SUPPLIERS = [
    { id: "sup_ka", name: "凯乐石供应链", companyName: "广州凯乐石户外用品有限公司", contactName: "陈经理", contactPhone: "13800000001", type: "brand", status: "active", settlementMode: "monthly", settlementCycle: "月结", invoiceType: "增值税专用" },
    { id: "sup_de", name: "迪卡侬联营", companyName: "迪卡侬（上海）体育用品", contactName: "李女士", contactPhone: "13800000002", type: "retail", status: "active", settlementMode: "monthly", settlementCycle: "月结", invoiceType: "增值税普通" },
    { id: "sup_yun", name: "云仓一件代发", companyName: "杭州云仓供应链管理", contactName: "王生", contactPhone: "13800000003", type: "fulfillment", status: "active", settlementMode: "settled", settlementCycle: "售后代发", invoiceType: "平台代开" },
  ];
  const MOCK_PRODUCTS = [
    { id: "p_stick", title: "碳纤登山杖（一对）", subtitle: "三节外锁 · 轻量减震", cover: "https://images.unsplash.com/photo-1551695113-8cb7e42aad8c?w=400&q=80", category: "登山装备", riskLevel: "L2", fulfillmentMode: "cloud_warehouse", commissionMode: "percentage", commissionValue: 12, retailPrice: 199, supplyPrice: 96, stock: 320, supplierId: "sup_ka", tags: ["徒步", "登山"], rating: 4.8 },
    { id: "p_bottle", title: "户外运动水壶 750ml", subtitle: "食品级 Tritan · 防漏", cover: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&q=80", category: "水具", riskLevel: "L1", fulfillmentMode: "cloud_warehouse", commissionMode: "percentage", commissionValue: 10, retailPrice: 59, supplyPrice: 26, stock: 880, supplierId: "sup_de", tags: ["徒步", "露营", "亲子"], rating: 4.7 },
    { id: "p_cap", title: "防晒速干渔夫帽", subtitle: "UPF50+ · 可折叠", cover: "https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80", category: "帽类", riskLevel: "L1", fulfillmentMode: "supplier_direct", commissionMode: "percentage", commissionValue: 10, retailPrice: 49, supplyPrice: 18, stock: 1200, supplierId: "sup_de", tags: ["徒步", "露营", "防晒"], rating: 4.6 },
    { id: "p_rain", title: "轻量雨衣（带背包位）", subtitle: "10K 防水 · 收纳仅拳头大", cover: "https://images.unsplash.com/photo-1520637736862-4d197d1c5a8a?w=400&q=80", category: "雨具", riskLevel: "L1", fulfillmentMode: "cloud_warehouse", commissionMode: "percentage", commissionValue: 10, retailPrice: 69, supplyPrice: 28, stock: 640, supplierId: "sup_de", tags: ["徒步", "雨备"], rating: 4.5 },
    { id: "p_head", title: "USB 充电头灯", subtitle: "400 流明 · 红光护眼", cover: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=400&q=80", category: "照明", riskLevel: "L1", fulfillmentMode: "cloud_warehouse", commissionMode: "fixed", commissionValue: 8, retailPrice: 99, supplyPrice: 42, stock: 410, supplierId: "sup_ka", tags: ["夜徒", "露营", "探洞"], rating: 4.7 },
    { id: "p_daybag", title: "20L 轻量徒步包", subtitle: "透气背负 · 水袋仓", cover: "https://images.unsplash.com/photo-1622260614153-03223fb72d9b?w=400&q=80", category: "背包", riskLevel: "L2", fulfillmentMode: "cloud_warehouse", commissionMode: "percentage", commissionValue: 12, retailPrice: 259, supplyPrice: 128, stock: 260, supplierId: "sup_ka", tags: ["徒步", "登山"], rating: 4.8 },
    { id: "p_glove", title: "防滑半指手套", subtitle: "耐磨掌垫 · 触屏指尖", cover: "https://images.unsplash.com/photo-1517438476312-9a3c1b4d9b0a?w=400&q=80", category: "配件", riskLevel: "L1", fulfillmentMode: "supplier_direct", commissionMode: "percentage", commissionValue: 10, retailPrice: 39, supplyPrice: 14, stock: 1500, supplierId: "sup_de", tags: ["徒步", "骑行"], rating: 4.6 },
    { id: "p_sock", title: "美利奴羊毛徒步袜", subtitle: "抑菌防臭 · 中筒", cover: "https://images.unsplash.com/photo-1586350977771-b3b0abd50c82?w=400&q=80", category: "袜类", riskLevel: "L1", fulfillmentMode: "cloud_warehouse", commissionMode: "percentage", commissionValue: 10, retailPrice: 45, supplyPrice: 16, stock: 1800, supplierId: "sup_de", tags: ["徒步", "保暖"], rating: 4.7 },
    { id: "p_cup", title: "316 保温杯 500ml", subtitle: "12h 保温 · 户外配色", cover: "https://images.unsplash.com/photo-1517254797898-04edd251bfb3?w=400&q=80", category: "水具", riskLevel: "L1", fulfillmentMode: "cloud_warehouse", commissionMode: "percentage", commissionValue: 10, retailPrice: 129, supplyPrice: 58, stock: 720, supplierId: "sup_de", tags: ["徒步", "露营"], rating: 4.8 },
    { id: "p_dry", title: "防水收纳袋套装", subtitle: "3 件装 · 透明视窗", cover: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&q=80", category: "收纳", riskLevel: "L1", fulfillmentMode: "cloud_warehouse", commissionMode: "fixed", commissionValue: 5, retailPrice: 39, supplyPrice: 13, stock: 900, supplierId: "sup_de", tags: ["露营", "防水"], rating: 4.5 },
    { id: "p_energy", title: "能量补给组合（5 包）", subtitle: "电解质 + 能量胶", cover: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&q=80", category: "补给", riskLevel: "L1", fulfillmentMode: "supplier_direct", commissionMode: "percentage", commissionValue: 10, retailPrice: 79, supplyPrice: 34, stock: 1100, supplierId: "sup_yun", tags: ["徒步", "补给"], rating: 4.6 },
    { id: "p_tent_acc", title: "防风营钉 + 风绳套装", subtitle: "铝合金 · 夜间反光", cover: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80", category: "露营", riskLevel: "L1", fulfillmentMode: "cloud_warehouse", commissionMode: "fixed", commissionValue: 4, retailPrice: 29, supplyPrice: 9, stock: 1300, supplierId: "sup_de", tags: ["露营"], rating: 4.4 },
    { id: "p_bag_l2", title: "55L 登山重装包", subtitle: "内置支架 · 防雨罩", cover: "https://images.unsplash.com/photo-1622260614153-03223fb72d9b?w=400&q=80", category: "背包", riskLevel: "L2", fulfillmentMode: "cloud_warehouse", commissionMode: "percentage", commissionValue: 12, retailPrice: 599, supplyPrice: 310, stock: 150, supplierId: "sup_ka", tags: ["登山", "重装"], rating: 4.9 },
    { id: "p_sleep", title: "木乃伊睡袋（舒适 5℃）", subtitle: "鸭绒充绒 · 可拼接", cover: "https://images.unsplash.com/photo-1537905569824-f89f14cceb26?w=400&q=80", category: "睡眠", riskLevel: "L2", fulfillmentMode: "cloud_warehouse", commissionMode: "percentage", commissionValue: 12, retailPrice: 459, supplyPrice: 230, stock: 180, supplierId: "sup_ka", tags: ["露营", "登山"], rating: 4.7 },
    { id: "p_shoe", title: "中帮防水登山鞋", subtitle: "Vibram 大底 · GTX", cover: "https://images.unsplash.com/photo-1605812860427-4024433a139d?w=400&q=80", category: "鞋类", riskLevel: "L2", fulfillmentMode: "cloud_warehouse", commissionMode: "percentage", commissionValue: 12, retailPrice: 899, supplyPrice: 470, stock: 120, supplierId: "sup_ka", tags: ["徒步", "登山"], rating: 4.9 },
    { id: "p_helmet", title: "攀登头盔（CE 认证）", subtitle: "ABS 外壳 · 头围可调", cover: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&q=80", category: "安全装备", riskLevel: "L3", fulfillmentMode: "cloud_warehouse", commissionMode: "percentage", commissionValue: 8, retailPrice: 329, supplyPrice: 160, stock: 90, supplierId: "sup_ka", tags: ["攀岩", "雪山"], rating: 4.8 },
    { id: "p_harness", title: "坐式安全带", subtitle: "全可调 · 承重 22kN", cover: "https://images.unsplash.com/photo-1522163182402-834f871fd851?w=400&q=80", category: "安全装备", riskLevel: "L3", fulfillmentMode: "supplier_direct", commissionMode: "fixed", commissionValue: 20, retailPrice: 459, supplyPrice: 220, stock: 70, supplierId: "sup_ka", tags: ["攀岩"], rating: 4.8 },
    { id: "p_rope", title: "动力绳 9.8mm（60m）", subtitle: "UIAA 认证 · 防水芯", cover: "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=400&q=80", category: "安全装备", riskLevel: "L3", fulfillmentMode: "supplier_direct", commissionMode: "fixed", commissionValue: 25, retailPrice: 799, supplyPrice: 400, stock: 50, supplierId: "sup_ka", tags: ["攀岩", "雪山"], rating: 4.9 },
  ];

  function getProduct(id) { return (state.mallProducts || []).find((p) => p.id === id); }
  function commissionOf(p, price) {
    if (!p) return 0;
    return p.commissionMode === "fixed" ? p.commissionValue : Math.round(price * (p.commissionValue / 100));
  }
  function riskLabel(r) { return { L1: "普通商品", L2: "一般户外装备", L3: "安全关键装备" }[r] || r; }

  /* ---------------- V2.0 AI 额度体系（对外只显「AI 积分」） ----------------
     内部按 token 折算；基础额度每月刷新、商城销量里程碑赠额（gift）月清、充值（paid）永久不清零。
     消耗顺序：base → gift → paid。 */
  const AI_BASE_MONTHLY = 1000;                       // 每月基础额度（AI 积分）
  const AI_RECHARGE_PKGS = [                          // 充值套餐（paid，不清零）
    { id: "r1", price: 9.9, amount: 3000, label: "体验包" },
    { id: "r2", price: 39, amount: 15000, label: "进阶包" }
  ];
  const AI_MILESTONES = [                              // 商城销量实时里程碑赠（gift，月清）
    { t: 10000, g: 100 }, { t: 50000, g: 300 }, { t: 100000, g: 500 }, { t: 500000, g: 1000 }
  ];
  const AI_COST_PER_CALL = 300;                        // 单次 AI 重写约耗 300 AI 积分（≈ 前端估算，非精确 token）
  function aiBalance() {
    const c = state.aiCredit || { base: AI_BASE_MONTHLY, gift: 0, paid: 0 };
    return (c.base || 0) + (c.gift || 0) + (c.paid || 0);
  }
  function aiLedgerPush(type, delta, note) {
    state.aiLedger = state.aiLedger || [];
    state.aiLedger.unshift({ id: uid(), ts: Date.now(), type, delta, balance: aiBalance(), note: note || "" });
    if (state.aiLedger.length > 60) state.aiLedger.length = 60;
  }
  // 消耗顺序 base → gift → paid；成功扣减并记账，余额不足返回 false
  function consumeAi(amount, reason) {
    const c = state.aiCredit; if (!c) return false;
    const need = amount || 0;
    if (aiBalance() < need) return false;
    let left = need;
    if (c.base > 0) { const d = Math.min(c.base, left); c.base -= d; left -= d; }
    if (left > 0 && c.gift > 0) { const d = Math.min(c.gift, left); c.gift -= d; left -= d; }
    if (left > 0 && c.paid > 0) { const d = Math.min(c.paid, left); c.paid -= d; left -= d; }
    aiLedgerPush("consume", -need, reason || "AI 内容生成");
    saveState();
    return true;
  }
  // 充值（paid，永久不清零）
  function rechargeAi(pkgId) {
    const pkg = AI_RECHARGE_PKGS.find((x) => x.id === pkgId); if (!pkg) return;
    state.aiCredit.paid = (state.aiCredit.paid || 0) + pkg.amount;
    aiLedgerPush("recharge", pkg.amount, `充值 ${pkg.label} ¥${pkg.price}`);
    saveState();
  }
  // 商城销量里程碑实时赠（gift，月清）；返回本次新赠总额（用于提示）
  function checkAiMilestones() {
    const c = state.aiCredit; if (!c) return 0;
    c.milestones = c.milestones || {};
    const sales = state.mallSalesMonth || 0;
    let granted = 0;
    AI_MILESTONES.forEach((m) => {
      const key = "m" + m.t;
      if (sales >= m.t && !c.milestones[key]) {
        c.milestones[key] = true;
        c.gift = (c.gift || 0) + m.g;
        granted += m.g;
        aiLedgerPush("grant", m.g, `商城销量达 ¥${m.t} 里程碑奖励`);
      }
    });
    if (granted) saveState();
    return granted;
  }
  // 月初刷新：base/gift 归位，里程碑标记清零（month 改变时）
  function refreshAiMonthly() {
    const c = state.aiCredit; if (!c) return;
    const ym = curYM();
    if (c.month !== ym) {
      c.base = AI_BASE_MONTHLY; c.gift = 0; c.month = ym; c.milestones = {};
      aiLedgerPush("refresh", AI_BASE_MONTHLY, "每月基础额度已刷新");
      saveState();
    }
  }

  /* ---------------- V2.0 佣金账本与状态机 ----------------
     MallOrder.commissionStatus: pending → frozen → available → settled / reversed
       pending   待确认（已下单，待发货/确认收货）
       frozen    冻结中（售后期内，无退货则解冻）
       available 可结算（售后期结束，平台可打款）
       settled   已结算（平台已结算到俱乐部）
       reversed  已冲销（发生退款，佣金归零）
     俱乐部仅得单级归因佣金（非多级分销）；退款触发冲销。 */
  const COMM_STATUS_LABEL = { pending: "待确认", frozen: "冻结中(售后期)", available: "可结算", settled: "已结算", reversed: "已冲销" };
  function orderCommission(o) {
    if (typeof o.commission === "number") return o.commission;
    let c = 0;
    (o.items || []).forEach((it) => { const p = getProduct(it.productId); if (p) c += commissionOf(p, it.price) * (it.qty || 1); });
    return Math.round(c);
  }
  function commissionSummary() {
    const orders = state.mallOrders || [];
    const sum = { pending: 0, frozen: 0, available: 0, settled: 0, reversed: 0 };
    orders.forEach((o) => {
      const st = (o.commissionStatus && COMM_STATUS_LABEL[o.commissionStatus]) ? o.commissionStatus : "pending";
      sum[st] += orderCommission(o);
    });
    return sum;
  }
  function commissionNextAction(o) {
    const st = o.commissionStatus || "pending";
    if (st === "pending") return { action: "mallConfirmReceive", label: "确认收货 → 冻结" };
    if (st === "frozen") return { action: "mallRelease", label: "售后期结束 → 可结算" };
    if (st === "available") return { action: "mallSettle", label: "申请结算" };
    return null;
  }
  function mallCommRowHtml(o, isPlatform) {
    const st = o.commissionStatus || "pending";
    const nx = commissionNextAction(o);
    const refundable = st !== "settled" && st !== "reversed";
    const title = (o.items && o.items[0] && o.items[0].title) || "商品";
    const clubTag = isPlatform ? `<span class="mall-cat">${esc(o.clubId || "club_demo")}</span>` : "";
    return `<div class="comm-row">
      <div class="comm-info">
        <div class="comm-title">${esc(title)}</div>
        <div class="comm-sub">订单 ${esc((o.id || "").slice(0, 8))} · ¥${o.amount} · 佣金 ¥${orderCommission(o)} · ${COMM_STATUS_LABEL[st]}${clubTag ? " · " : ""}${clubTag}</div>
      </div>
      <div class="comm-actions">
        ${nx ? `<button class="btn btn-soft btn-sm" data-action="${nx.action}" data-id="${o.id}">${nx.label}</button>` : ""}
        ${refundable ? `<button class="btn btn-ghost btn-sm" data-action="mallRefund" data-id="${o.id}">退款冲销</button>` : ""}
        ${(st === "settled" || st === "reversed") ? `<span class="comm-done ${st}">${st === "settled" ? "已结算" : "已冲销"}</span>` : ""}
      </div>
    </div>`;
  }

  function renderMallCommission() {
    const orders = (state.mallOrders || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const sum = commissionSummary();
    const pendingTotal = sum.pending + sum.frozen + sum.available;
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="back">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">我的佣金</div></div>
      <div class="front-body">
        <div class="comm-summary">
          <div class="comm-card"><div class="comm-num">¥${pendingTotal}</div><div class="comm-lbl">待结算佣金</div></div>
          <div class="comm-card"><div class="comm-num">¥${sum.available}</div><div class="comm-lbl">可结算</div></div>
          <div class="comm-card"><div class="comm-num">¥${sum.settled}</div><div class="comm-lbl">本月已结算</div></div>
          <div class="comm-card"><div class="comm-num">¥${sum.reversed}</div><div class="comm-lbl">已冲销</div></div>
        </div>
        <div class="fr-section"><div class="fr-section-h"><h3>佣金明细（状态机）</h3></div>
          ${orders.length ? `<div class="comm-list">${orders.map((o) => mallCommRowHtml(o, false)).join("")}</div>` : `<p class="muted small">还没有商城订单。去「装备商城」下一单，佣金将按 待确认 → 冻结 → 可结算 → 已结算 流转；发生退款则冲销归零。</p>`}
        </div>
      </div>
    </div>`;
  }
  function refreshMallContext() {
    const v = state.mallView || "browse";
    if (v === "commission") showView("mallCommission");
    else if (v === "admin") showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin");
    else showView("mall");
  }

  function renderMall() {
    const view = state.mallView || "browse";
    if (view === "admin") return renderMallAdmin();
    const products = state.mallProducts || [];
    const recs = (state.myRecs || []).map((id) => getProduct(id)).filter(Boolean);
    const cats = [...new Set(products.map((p) => p.category))];
    const grid = (list) => list.map((p) => `<div class="mall-card" data-action="mallProduct" data-id="${p.id}">
        <div class="mall-ph" style="background-image:url('${esc(p.cover)}')"></div>
        <div class="mall-meta">
          <div class="mall-title">${esc(p.title)}</div>
          <div class="mall-sub">${esc(p.subtitle)}</div>
          <div class="mall-tags"><span class="mall-risk r-${p.riskLevel}">${riskLabel(p.riskLevel)}</span><span class="mall-cat">${esc(p.category)}</span><span class="mall-rate">★ ${p.rating}</span></div>
          <div class="mall-foot"><b class="mall-price">¥${p.retailPrice}</b><span class="mall-commission">佣金 ${p.commissionMode === "fixed" ? "¥" + p.commissionValue : p.commissionValue + "%"}</span></div>
        </div>
      </div>`).join("");
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="back">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">装备商城</div>${isAdminMode() ? `<button class="btn btn-soft btn-sm" data-action="mallAdmin">平台运营</button>` : ""}</div>
      <div class="mall-banner">平台统一运营 · 俱乐部仅推荐与成交，按销量得佣金</div>
      ${recs.length ? `<div class="fr-section"><div class="fr-section-h"><h3>我的推荐货架</h3><span class="more" data-action="mallRecEdit">管理</span></div><div class="mall-recs">${recs.map((p) => `<div class="mall-rec" data-action="mallProduct" data-id="${p.id}"><div class="mall-rec-ph" style="background-image:url('${esc(p.cover)}')"></div><div class="mall-rec-t">${esc(p.title)}</div><div class="mall-rec-p">¥${p.retailPrice}</div></div>`).join("")}</div></div>` : ""}
      <div class="front-body">
        <div class="mall-cats">${cats.map((c) => `<span class="mall-cat-pill">${c}</span>`).join("")}</div>
        <div class="mall-grid">${grid(products)}</div>
      </div>
      ${isAdminMode() ? "" : `<button class="fab-admin" data-action="mallRecEdit">${ICON("plus")} 加推荐</button>`}
    </div>`;
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
    const commission = commissionOf(p, p.retailPrice);
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="mallBack">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">商品详情</div></div>
      <div class="mall-detail-ph" style="background-image:url('${esc(p.cover)}')"></div>
      <div class="front-body">
        <div class="mall-detail-title">${esc(p.title)}</div>
        <div class="mall-sub">${esc(p.subtitle)}</div>
        <div class="mall-tags"><span class="mall-risk r-${p.riskLevel}">${riskLabel(p.riskLevel)}</span><span class="mall-cat">${esc(p.category)}</span><span class="mall-rate">★ ${p.rating}</span></div>
        <div class="mall-detail-price"><b>¥${p.retailPrice}</b><span>本俱乐部预计佣金 ¥${commission}</span></div>
        <div class="mall-detail-note">由平台统一发货与售后 · 俱乐部仅获得销售佣金，不接触货款与库存。</div>
        <button class="btn btn-primary btn-lg btn-block" data-action="mallBuy" data-id="${p.id}">下单（模拟）</button>
        <button class="btn btn-soft btn-block" data-action="mallToggleRec" data-id="${p.id}">${state.myRecs.includes(p.id) ? "移出我的推荐" : "加入我的推荐货架"}</button>
      </div>
    </div>`;
  }

  function renderFrontHome() {
    const b = state.brand;
    const recruiting = state.activities.filter((a) => a.status === "recruiting" || a.status === "full");
    const pinned = recruiting.filter((a) => a.pinned).sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
    const autoFeatured = [...recruiting].sort((a, b) => b.createdAt - a.createdAt);
    const featured = pinned.length ? pinned : autoFeatured.slice(0, 4);

    // 图片辅助
    const szImg = (a) => {
      const hasPhoto = a.photos && a.photos[0];
      if (hasPhoto) return `<img data-smart-img src="${a.photos[0]}" alt="" style="object-position:${smartPos(a.photos[0])}">`;
      return `<div class="sz-gradient"><div class="img-pattern"></div></div>`;
    };

    // 主推瀑布网格：左大右小
    const songzanGrid = (list) => {
      const big = list[0];
      const smalls = list.slice(1, 3);
      return `<div class="songzan-grid">
        <div class="sz-big-card" data-action="openFront" data-id="${big.id}">
          <div class="sz-card-cover">${szImg(big)}</div>
          <div class="sz-card-mask"></div>
          <div class="sz-card-content">
            <span class="sz-card-tag ${big.pinned ? "" : "sz-tag-light"}">${big.status === "full" ? "已满员" : big.pinned ? "主推活动" : esc(big.type)}</span>
            <h4>${esc(big.title)}</h4>
            <p>${esc(big.dateMD || big.date || "日期待定")} · ${esc(big.meeting || "成都")}${big.days > 1 ? " · " + big.days + "天" + (big.days - 1) + "晚" : ""}</p>
            <div class="sz-card-foot">${big.price ? "¥" + big.price + "<span>/" + esc(big.limitUnit) + "</span>" : "详询"}</div>
          </div>
        </div>
        <div class="sz-right-stack">${smalls.map((a) => `<div class="sz-small-card" data-action="openFront" data-id="${a.id}">
          <div class="sz-card-cover">${szImg(a)}</div>
          <div class="sz-card-mask sz-card-mask-sm"></div>
          <div class="sz-card-content sz-card-content-sm">
            <span class="sz-card-tag sz-tag-light">${esc(a.type)}</span>
            <h4>${esc(a.title)}</h4>
            <p class="sz-card-sm-line">${esc(a.dateMD || a.date || "待定")} · ${esc(a.meeting || "成都")}</p>
          </div>
        </div>`).join("")}</div>
      </div>`;
    };

    // 大图 feed 卡片
    const szFeedCard = (a) => `<div class="sz-feed-card" data-action="openFront" data-id="${a.id}">
      <div class="sz-feed-cover">${szImg(a)}</div>
      <div class="sz-feed-mask"></div>
      <div class="sz-feed-content">
        <span class="sz-feed-tag ${a.pinned ? "" : "sz-tag-light"}">${a.status === "full" ? "已满员" : a.pinned ? "热招中" : esc(a.type)}</span>
        <h4>${esc(a.title)}</h4>
        <p>${esc(a.dateMD || a.date || "待定")} · ${esc(a.meeting || "成都")}</p>
        <div class="sz-feed-price">${a.price ? "¥" + a.price : "详询"}${a.price ? `<span>/${esc(a.limitUnit)}</span>` : ""}</div>
      </div>
    </div>`;

    // 主题瀑布卡片
    const szThemeCard = (t, i, isAct) => {
      if (isAct) {
        const tag = t.status === "recruiting" ? "热招中" : t.status === "full" ? "已满员" : "往期活动";
        return `<div class="sz-theme-card ${i % 2 === 1 ? 'tall' : ''}" data-action="openFront" data-id="${t.id}">
          <div class="sz-theme-cover">${szImg(t)}</div>
          <div class="sz-theme-mask"></div>
          <div class="sz-theme-content"><span class="sz-theme-tag">${tag}</span><h4>${esc(t.title)}</h4></div>
        </div>`;
      }
      return `<div class="sz-theme-card ${i % 2 === 1 ? 'tall' : ''}" data-action="toast" data-msg="主题详情开发中">
        <img src="${t.img}" alt="">
        <div class="sz-theme-mask"></div>
        <div class="sz-theme-content"><span>${t.tag}</span><h4>${esc(t.name)}</h4></div>
      </div>`;
    };

    const heroSlides = featured.length
      ? featured.slice(0, 3).map((a, i) => heroSlide(a, i)).join("")
      : `<div class="hero-slide active" data-idx="0">
          <div class="hero-bg"><div class="hero-def"></div></div>
          <div class="hero-mask"></div>
          <div class="hero-foot">
            <span class="hero-kicker">户外 · 自然 · 成长</span>
            <h1 class="hero-title">${esc(b.slogan || "和孩子一起，走进真实的自然")}</h1>
            <p class="hero-sub">真实行程 · 透明费用 · 出团通知为准</p>
            <div class="hero-cta">开启探索 ${ICON("chevron-right")}</div>
          </div>
        </div>`;
    const heroDots = featured.length > 1
      ? `<div class="hero-dots">${featured.slice(0, 3).map((_, i) => `<span class="hero-dot ${i === 0 ? "active" : ""}" data-idx="${i}"></span>`).join("")}</div>`
      : "";

    const heroSection = `<div class="home-hero" id="homeHero">
      <div class="hero-slides">${heroSlides}</div>
      <div class="hero-top">
        <div class="ht-brand">${frontLogo(30, true)}<span>${esc(b.name)}</span></div>
        <div class="ht-right">
          <button class="ht-loc" data-action="toast" data-msg="城市切换开发中">${ICON("map-pin")}<span>${esc(b.address?.split("·")[0] || "成都")}</span></button>
          <button class="ht-avatar" data-action="mySignups">${ICON("users")}</button>
        </div>
      </div>
      <div class="hero-search" data-action="focusSearch">
        ${ICON("search")}<input type="text" id="frontSearchInput" placeholder="想去哪座山？搜活动、目的地" autocomplete="off"><span class="ai-badge">AI</span>
      </div>
      ${heroDots}
    </div>`;

    const recent = recruiting.filter((a) => !featured.includes(a)).slice(0, 4);
    const statusRank = { recruiting: 0, full: 1, past: 2 };
    const themeActivities = [...state.activities]
      .filter((a) => a.status !== "draft")
      .sort((a, b) => (statusRank[a.status] || 0) - (statusRank[b.status] || 0) || b.createdAt - a.createdAt)
      .slice(0, 6);

    const isMember = true;
    const promoBar = `<div class="promo-bar promo-club" data-action="membership">
        <div class="promo-ic">${ICON("sparkles")}</div>
        <div class="promo-txt"><b>ClubOS 俱乐部版 · 全功能免费</b><span>活动管理 · 会员营销 · 专属装备商城（平台统一运营）</span></div>
        <button class="promo-btn">了解</button>
      </div>`;

    const catPills = CATEGORIES.map((c, i) => `<span class="cat-pill ${i === 0 ? "active" : ""}" data-action="toast" data-msg="「${c.name}」筛选开发中">${c.name}</span>`).join("");

    const horizonCards = `<div class="hz-scroll">${CATEGORIES.map((c) => `<div class="hz-card" data-action="toast" data-msg="「${c.name}」主题开发中">
      <div class="hz-photo" style="background-image:url('${c.img}')"></div>
      <span class="hz-name">${c.name}</span>
    </div>`).join("")}</div>`;

    const brandStory = `<div class="brand-story" data-action="toast" data-msg="品牌故事页开发中">
      <div class="brand-story-bg"></div>
      <div class="brand-story-content">
        <h4>什么是 ${esc(b.name)}</h4>
        <p>${esc(b.slogan || "和孩子一起，走进真实的自然。")}</p>
        <span class="brand-story-link">了解我们 ${ICON("arrow-right")}</span>
      </div>
    </div>`;

    return `<div class="front front-v16">
      ${heroSection}
      <div class="front-body">
        ${promoBar}

        <div class="fr-section">
          <div class="fr-section-h"><h3>${ICON("compass")} 探索主题</h3><span class="more" data-action="nav" data-view="list">全部</span></div>
          ${horizonCards}
        </div>

        <div class="fr-section">
          <div class="fr-section-h"><h3>${ICON("flame")} 主推活动</h3><span class="more" data-action="nav" data-view="list">全部 ${recruiting.length}</span></div>
          ${featured.length ? songzanGrid(featured.slice(0, 3)) : emptyBento()}
        </div>

        <div class="fr-section">
          <div class="cat-pills-scroll">${catPills}</div>
        </div>

        ${recent.length ? `<div class="fr-section">
          <div class="fr-section-h"><h3>${ICON("leaf")} 轻户外体验</h3><span class="more" data-action="nav" data-view="list">全部</span></div>
          <div class="songzan-feed">${recent.map(szFeedCard).join("")}</div>
        </div>` : ""}

        <div class="fr-section">
          <div class="fr-section-h"><h3>${ICON("sparkles")} 精选主题</h3><span class="more" data-action="nav" data-view="list">全部</span></div>
          <div class="songzan-theme-grid">${themeActivities.length ? themeActivities.map((a, i) => szThemeCard(a, i, true)).join("") : THEMES.map((t, i) => szThemeCard(t, i, false)).join("")}</div>
        </div>

        <div class="fr-section">${brandStory}</div>
      </div>

      <div class="front-tabbar">
        <div class="ft-item active">${ICON("home")}<span>首页</span></div>
        <div class="ft-item" data-action="toast" data-msg="目的地页开发中">${ICON("map-pin")}<span>目的地</span></div>
        <div class="ft-item" data-action="openMall">${ICON("shopping-bag")}<span>商城</span></div>
        <div class="ft-item" data-action="membership">${ICON("crown")}<span>会员</span></div>
        <div class="ft-item" data-action="mySignups">${ICON("users")}<span>我的</span></div>
      </div>
      ${isAdminMode() ? `<button class="fab-admin" data-action="nav" data-view="dashboard">${ICON("home")} 返回工作台</button>` : ""}
      <button class="fab-service" data-action="contactOrg">${ICON("headphones")}</button>
    </div>`;
  }

  function heroImg(a) {
    const hasPhoto = a.photos && a.photos[0];
    if (hasPhoto) return `<img data-smart-img src="${a.photos[0]}" alt="" style="object-position:${smartPos(a.photos[0])}">`;
    return `<div class="hero-def"></div>`;
  }
  function heroSlide(a, idx) {
    const kicker = a.status === "full" ? "已满员" : a.pinned ? "主推活动" : "本周热门";
    const sub = a.highlights && a.highlights[0]
      ? a.highlights[0][0]
      : (a.intro ? a.intro.slice(0, 36) + (a.intro.length > 36 ? "…" : "") : "");
    return `<div class="hero-slide ${idx === 0 ? "active" : ""}" data-action="openFront" data-id="${a.id}" data-idx="${idx}">
      <div class="hero-bg">${heroImg(a)}</div>
      <div class="hero-mask"></div>
      <div class="hero-foot">
        <span class="hero-kicker">${kicker}</span>
        <h1 class="hero-title">${esc(a.title)}</h1>
        ${sub ? `<p class="hero-sub">${esc(sub)}</p>` : ""}
        <div class="hero-cta">点击查看 ${ICON("chevron-right")}</div>
      </div>
    </div>`;
  }

  function bentoCard(a) {
    const hasPhoto = a.photos && a.photos[0];
    const img = hasPhoto ? `<img data-smart-img src="${a.photos[0]}" alt="" style="object-position:${smartPos(a.photos[0])}">` : "";
    const placeholder = hasPhoto ? "" : `<div class="gradient"><div class="img-pattern"></div></div>`;
    const tagCls = a.status === "full" ? "chip-onimg" : a.pinned ? "chip-onimg sun" : "chip-onimg brand";
    const tagTxt = a.status === "full" ? "已满员" : a.pinned ? "主推" : esc(a.type);
    const diff = a.difficulty ? `<span class="chip-onimg">${esc(a.difficulty)}</span>` : (a.days > 1 ? `<span class="chip-onimg">${a.days}天${a.days - 1}晚</span>` : "");
    return `<div class="bento-card" data-action="openFront" data-id="${a.id}">
      <div class="bento-cover">${img}${placeholder}</div>
      <div class="bento-overlay"></div>
      <div class="bento-top">
        <span class="${tagCls}">${tagTxt}</span>
        ${diff}
      </div>
      <div class="bento-bot">
        <h4>${esc(a.title)}</h4>
        <div class="bento-sub">${ICON("calendar")} ${esc(a.dateMD || a.date || "待定")} · ${ICON("map-pin")} ${esc(a.meeting || "成都")}</div>
        <div class="bento-bar">
          <div class="bento-price">${a.price ? "¥" + a.price : "详询"}${a.price ? `<span>/${esc(a.limitUnit)}</span>` : ""}</div>
          <span class="bento-go">查看 ${ICON("arrow-right")}</span>
        </div>
      </div>
    </div>`;
  }
  function emptyBento() {
    return `<div class="bento-empty" data-action="nav" data-view="create">
      <div class="bento-empty-ic">${ICON("mountain")}</div>
      <div>
        <div class="bento-empty-t">暂无招募中活动</div>
        <div class="tiny muted">去工作台发布第一场活动，即可自动滚播</div>
      </div>
    </div>`;
  }
  function catCell(c) {
    return `<div class="cat-cell" data-action="toast" data-msg="「${c.name}」分类筛选开发中">
      <div class="cat-photo" style="background-image:url('${c.img}')"></div>
      <span class="cat-name">${c.name}</span>
    </div>`;
  }
  function feedCard(a) {
    const hasPhoto = a.photos && a.photos[0];
    const img = hasPhoto ? `<img data-smart-img src="${a.photos[0]}" alt="" style="object-position:${smartPos(a.photos[0])}">` : "";
    const placeholder = hasPhoto ? "" : `<div class="gradient"><div class="img-pattern"></div></div>`;
    return `<div class="feed-card" data-action="openFront" data-id="${a.id}">
      <div class="feed-thumb">${img}${placeholder}</div>
      <div class="feed-body">
        <div class="feed-tags"><span class="feed-tag">${esc(a.type)}</span>${a.days > 1 ? `<span class="feed-tag">${a.days}天</span>` : ""}</div>
        <h4>${esc(a.title)}</h4>
        <div class="feed-meta">${esc(a.dateMD || a.date || "待定")} · ${esc(a.meeting || "成都")} · ${esc(a.ageRange || (isFamilyActivity(a) ? "亲子" : "成人"))}</div>
        <div class="feed-row"><span class="feed-price">${a.price ? "¥" + a.price : "详询"}${a.price ? `<small>/${esc(a.limitUnit)}</small>` : ""}</span></div>
      </div>
    </div>`;
  }
  function themeCard(t) {
    return `<div class="theme-card" data-action="toast" data-msg="主题详情开发中">
      <img src="${t.img}" alt="">
      <div class="theme-cover"><span class="theme-tag">${t.tag}</span><h4>${t.name}</h4></div>
    </div>`;
  }
  function activityThemeCard(a) {
    const hasPhoto = a.photos && a.photos[0];
    const img = hasPhoto ? `<img data-smart-img src="${a.photos[0]}" alt="" style="object-position:${smartPos(a.photos[0])}">` : `<div class="gradient"><div class="img-pattern"></div></div>`;
    const tag = a.status === "recruiting" ? "热招中" : a.status === "full" ? "已满员" : "往期活动";
    return `<div class="theme-card" data-action="openFront" data-id="${a.id}">
      ${img}
      <div class="theme-cover"><span class="theme-tag">${tag}</span><h4>${esc(a.title)}</h4></div>
    </div>`;
  }

  function initBentoScroll() {
    const sc = document.getElementById("bentoScroll");
    if (!sc || sc.children.length < 2) return;
    let idx = 0;
    const gap = parseInt(getComputedStyle(sc).gap) || 12;
    const itemW = sc.children[0].offsetWidth + gap;
    if (bentoScrollTimer) clearInterval(bentoScrollTimer);
    bentoScrollTimer = setInterval(() => {
      idx = (idx + 1) % sc.children.length;
      sc.scrollTo({ left: itemW * idx, behavior: "smooth" });
    }, 3200);
    sc.addEventListener("touchstart", () => { if (bentoScrollTimer) clearInterval(bentoScrollTimer); }, { passive: true });
    sc.addEventListener("touchend", () => {
      idx = Math.round(sc.scrollLeft / itemW);
      bentoScrollTimer = setInterval(() => { idx = (idx + 1) % sc.children.length; sc.scrollTo({ left: itemW * idx, behavior: "smooth" }); }, 3200);
    }, { passive: true });
  }

  function initHeroCarousel() {
    const hero = document.getElementById("homeHero");
    if (!hero) return;
    const slides = hero.querySelectorAll(".hero-slide");
    if (slides.length < 2) return;
    const dots = hero.querySelectorAll(".hero-dot");
    let idx = 0;
    if (heroScrollTimer) clearInterval(heroScrollTimer);
    heroScrollTimer = setInterval(() => {
      slides[idx].classList.remove("active");
      if (dots[idx]) dots[idx].classList.remove("active");
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add("active");
      if (dots[idx]) dots[idx].classList.add("active");
    }, 4200);
  }

  function customFieldsHtml(fields) {
    if (!fields || !fields.length) return "";
    return fields.map((f) => {
      const id = `sf_custom_${f.id}`;
      if (f.type === "select" && Array.isArray(f.options) && f.options.length) {
        return `<div class="field"><label>${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>
          <select class="select" id="${id}">${f.options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("")}</select></div>`;
      }
      return `<div class="field"><label>${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ""}</label>
        <input class="input" id="${id}" placeholder="${esc(f.placeholder || "")}"></div>`;
    }).join("");
  }

  function customFieldEditorHtml(a) {
    const fields = a.customFields || [];
    const rows = fields.map((f, i) => `
      <div class="cf-row" data-cf-idx="${i}">
        <input class="input cf-label" data-bind-cf="${i}" data-cf-key="label" value="${esc(f.label || "")}" placeholder="字段名，如：紧急联系人">
        <select class="select cf-type" data-bind-cf="${i}" data-cf-key="type">
          <option value="text" ${f.type !== "select" ? "selected" : ""}>文本</option>
          <option value="select" ${f.type === "select" ? "selected" : ""}>下拉选项</option>
        </select>
        <label class="cf-req"><input type="checkbox" data-bind-cf="${i}" data-cf-key="required" ${f.required ? "checked" : ""}> 必填</label>
        <button class="icon-btn" data-action="delCustomField" data-id="${i}" title="删除">${ICON("x")}</button>
      </div>
      ${f.type === "select"
        ? `<input class="input cf-opts" data-bind-cf="${i}" data-cf-key="options" value="${esc((f.options || []).join(","))}" placeholder="选项用逗号分隔，如：A型,B型,不确定">`
        : `<input class="input cf-ph" data-bind-cf="${i}" data-cf-key="placeholder" value="${esc(f.placeholder || "")}" placeholder="占位提示，如：请填写血型">`}
    `).join("");
    return `<div class="panel" style="margin-bottom:18px">
      <div class="panel-head"><h3>报名字段（自定义选填项）</h3><span class="tiny muted">除姓名 / 电话 / 证件外，可手动添加</span></div>
      <div class="panel-body">
        <div class="cf-list">${rows || '<div class="tiny muted" style="padding:6px 0">还没有自定义字段。下方可添加紧急联系人、血型、过敏史等选填项。</div>'}</div>
        <button class="btn btn-soft btn-sm" data-action="addCustomField" style="margin-top:6px">+ 添加选填项</button>
        <p class="tiny muted" style="margin-top:10px">这些字段会出现在报名表单中供报名者填写；勾选「必填」则报名时必须填写。固定必填项（姓名 / 手机号 / 证件）已内置，无需重复添加。</p>
      </div>
    </div>`;
  }

  function renderSignupPage(id) {
    const a = getActivity(id);
    if (!a) return `<div class="front"><div class="empty">活动不存在</div></div>`;
    syncDepartures(a);
    const deps = (a.departures || []).filter((d) => d.status !== "closed");
    const depSelect = deps.length > 1 ? `<div class="field"><label>选择团期 <span class="req">*</span></label><div class="departure-options">${deps.map((d, i) => {
      const price = d.price != null ? d.price : a.price;
      const disabled = d.status === "full";
      return `<label class="dep-option ${disabled ? "disabled" : ""}"><input type="radio" name="sf_departure" value="${d.id}" ${disabled ? "disabled" : (i === 0 ? "checked" : "")}>
        <span class="dep-option-body">
          <span class="dep-option-date">${esc(d.weekDay)} ${esc(formatDepartureSlash(d.date))}</span>
          <span class="dep-option-price">${price != null ? "¥" + price : "详询"}${disabled ? " · 已满员" : ""}</span>
        </span>
      </label>`;
    }).join("")}</div></div>` : "";
    const firstDep = deps[0] || {};
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="back">${ICON("arrow-left")} 返回</button>${psLogo(true)}</div>
      <div class="su-hero">
        <div class="su-pattern"></div>
        <div class="tiny" style="opacity:.9;position:relative;z-index:1">报名 · ${esc(a.title)}</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px;position:relative;z-index:1">${deps.length === 1 && firstDep.price != null ? "¥" + firstDep.price + " / " + a.limitUnit : (a.price ? "¥" + a.price + " / " + a.limitUnit : "详询")}</div>
      </div>
      <div class="signup-form">
        ${depSelect}
        <div class="field"><label>联系人姓名 <span class="req">*</span></label><input class="input" id="sf_name" placeholder="如：王女士"></div>
        <div class="field"><label>手机号 <span class="req">*</span></label><input class="input" id="sf_phone" placeholder="11 位手机号" maxlength="11"></div>
        <div class="grid-2">
          <div class="field"><label>证件类型 <span class="req">*</span></label>
            <select class="select" id="sf_idType">
              <option value="idcard">身份证</option>
              <option value="passport">护照</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div class="field"><label>证件号码 <span class="req">*</span></label><input class="input" id="sf_idNumber" placeholder="对应证件号码"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>成人人数</label><input class="input" type="number" id="sf_adults" value="1" min="0"></div>
          <div class="field"><label>儿童人数</label><input class="input" type="number" id="sf_children" value="0" min="0"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label>儿童姓名</label><input class="input" id="sf_childName" placeholder="如：小宇"></div>
          <div class="field"><label>儿童年龄</label><input class="input" id="sf_childAge" placeholder="如：8"></div>
        </div>
        ${customFieldsHtml(a.customFields)}
        <div class="field"><label>备注</label><textarea class="textarea" id="sf_note" placeholder="过敏史、特殊需求等"></textarea></div>
        <label class="consent"><input type="checkbox" id="sf_agree"> <span>我已阅读并同意《活动须知与退改规则》，知晓活动风险。</span></label>
        <button class="btn btn-primary btn-lg btn-block" data-action="submitSignup" data-id="${a.id}">提交报名</button>
        <p class="tiny muted center" style="margin-top:12px">Demo：提交后显示报名成功，暂不接入真实支付</p>
      </div>
    </div>`;
  }

  function renderSuccess(id, signupId) {
    const a = getActivity(id);
    const s = state.signups.find((x) => x.id === signupId);
    const dep = (a && a.departures && s && s.departureId) ? a.departures.find((d) => d.id === s.departureId) : null;
    const dateText = dep ? `${dep.weekDay} ${formatDepartureSlash(dep.date)}` : (a ? (a.dateMD || a.date || "") : "");
    return `<div class="front">
      <div class="success-wrap">
        <div class="success-ic">${ICON("check")}</div>
        <h2>报名成功！</h2>
        <p class="muted">我们已收到你的报名，客服会尽快联系你。</p>
        <div class="card card-pad" style="text-align:left;margin:18px 0">
          <div class="row between" style="padding:8px 0"><span class="muted small">活动</span><b class="small">${esc(a ? a.title : "")}</b></div>
          <div class="row between" style="padding:8px 0"><span class="muted small">时间</span><b class="small">${esc(dateText)}</b></div>
          <div class="row between" style="padding:8px 0"><span class="muted small">集合</span><b class="small">${esc(a ? a.meeting : "")} ${esc(a ? a.meetTime : "")}</b></div>
          <div class="row between" style="padding:8px 0"><span class="muted small">联系人</span><b class="small">${esc(s ? s.name : "")}</b></div>
        </div>
        <div class="tiny muted">扫码加入活动群（Demo 占位）</div>
        <div class="qr-box"></div>
        <div class="col gap-10" style="margin-top:8px">
          <button class="btn btn-soft btn-block" data-action="toast" data-msg="已打开装备清单">${ICON("ruler")} 查看装备清单</button>
          <button class="btn btn-primary btn-block" data-action="openFrontHome">返回机构主页</button>
        </div>
      </div>
    </div>`;
  }

  function mineName() {
    const list = state.signups || [];
    if (list.length) return list[0].name || "山友";
    return (state.brand && state.brand.name) || "山友";
  }
  function mineActCard(s) {
    const a = getActivity(s.activityId);
    const cover = (a && a.photos && a.photos[a.coverIndex || 0]) || (a && a.photos && a.photos[0]) || "";
    const isEnded = !!(a && a.status === "ended");
    const statusLabel = isEnded ? "已完成" : (s.paid ? "已付款" : "待确认");
    const statusCls = isEnded ? "done" : (s.paid ? "paid" : "pending");
    const title = a ? a.title : "已删除活动";
    const dateMD = a ? (a.dateMD || a.date || "") : "";
    const place = a ? a.place : "";
    const price = a ? a.price : "";
    return `<div class="mine-card" data-action="openFront" data-id="${a ? a.id : ""}" style="cursor:pointer">
      <div class="mine-card-img ${cover ? "" : "no-img"}" ${cover ? `style="background-image:url('${cover}')"` : ""}>
        <span class="mine-status ${statusCls}">${statusLabel}</span>
      </div>
      <div class="mine-card-body">
        <h4>${esc(title)}</h4>
        <div class="mine-card-meta">${esc(dateMD)}${place ? " · " + esc(place) : ""} · ${esc(s.name)}</div>
        <div class="mine-card-foot">
          <span class="mine-card-price">${price ? "¥" + price : "详询"}</span>
          <span class="mine-card-go">查看详情 ${ICON("chevron-right")}</span>
        </div>
      </div>
    </div>`;
  }
  function mineTool(icon, label, action, msg) {
    const attr = action === "toast" ? `data-action="toast" data-msg="${msg || ""}"` : `data-action="${action}"`;
    return `<div class="mine-tool" ${attr}>${ICON(icon)}<span>${label}</span></div>`;
  }

  function openApplyClub() {
    const info = state.clubInfo || {};
    const status = state.clubStatus || "approved";
    const statusText = { approved: "已通过平台审核", pending: "审核中（预计 1 个工作日内完成）", rejected: "未通过", suspended: "已停用" }[status] || "";
    const mask = document.createElement("div");
    mask.className = "modal-mask";
    mask.innerHTML = `<div class="upgrade-sheet" role="dialog" aria-label="俱乐部入驻">
      <button class="modal-close-x" data-action="closeModal" aria-label="关闭">${ICON("x")}</button>
      <div class="up-head">
        <div class="up-brand">${esc((state.brand && state.brand.name) || "俱乐部")} · 入驻 ClubOS</div>
        <h3 class="up-title">免费开通俱乐部版，全功能直接用</h3>
      </div>
      <div class="up-note">${statusText || "提交资料后由平台审核，通过即开通活动发布、会员营销与专属装备商城。"}</div>
      <div class="apply-form">
        <label>机构名称<input id="applyName" class="input" value="${esc(info.name || (state.brand && state.brand.name) || "")}" placeholder="如：山野小队户外"></label>
        <label>联系人<input id="applyContact" class="input" value="${esc(info.contact || "")}" placeholder="负责人姓名"></label>
        <label>手机号<input id="applyPhone" class="input" value="${esc(info.phone || "")}" placeholder="11 位手机号"></label>
        <label>所在城市<input id="applyCity" class="input" value="${esc(info.city || "")}" placeholder="如：成都"></label>
        <label>活动类型<input id="applyType" class="input" value="${esc(info.activityType || "")}" placeholder="如：徒步 / 露营 / 研学"></label>
        <label>俱乐部简介<textarea id="applyBio" class="textarea" rows="3" placeholder="一句话介绍你的俱乐部">${esc(info.bio || "")}</textarea></label>
      </div>
      ${status === "pending"
        ? `<button class="btn btn-soft btn-block up-cta" data-action="simulateApproveClub">模拟平台审核通过（Demo）</button>`
        : `<button class="btn btn-primary btn-block up-cta" data-action="submitApplyClub">${status === "approved" ? "保存资料" : "提交入驻申请"}</button>`}
    </div>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (e) => { if (e.target === mask) mask.remove(); });
  }

  /* ---------------- V2.0 P4：AI 额度明细（对外只称「AI 积分」） ---------------- */
  function aiMilestoneRow(m, sales, achieved) {
    const progress = Math.min(100, Math.round((sales / m.t) * 100));
    return `<div class="ai-ms ${achieved ? "is-done" : ""}">
      <div class="ai-ms-top"><span class="ai-ms-t">销量达 ¥${m.t.toLocaleString()}</span><span class="ai-ms-g">+${m.g} AI 积分</span></div>
      <div class="ai-ms-bar"><div style="width:${achieved ? 100 : progress}%"></div></div>
      <div class="ai-ms-sub">${achieved ? "已达成并已发放（本月）" : `还差 ¥${Math.max(0, m.t - sales).toLocaleString()}`}</div>
    </div>`;
  }
  function openAiCredit() {
    refreshAiMonthly();
    const c = state.aiCredit;
    const sales = state.mallSalesMonth || 0;
    const achieved = (t) => !!((c.milestones || {})["m" + t]);
    const ledger = state.aiLedger || [];
    const typeLabel = { consume: "消耗", recharge: "充值", grant: "里程碑赠送", refresh: "每月刷新" };
    const mask = document.createElement("div");
    mask.className = "modal-mask";
    mask.innerHTML = `<div class="upgrade-sheet" role="dialog" aria-label="AI 额度">
      <button class="modal-close-x" data-action="closeModal" aria-label="关闭">${ICON("x")}</button>
      <div class="up-head">
        <div class="up-brand">${esc((state.brand && state.brand.name) || "俱乐部")} · AI 额度</div>
        <h3 class="up-title">${aiBalance().toLocaleString()} <span style="font-size:15px;font-weight:500">AI 积分</span></h3>
      </div>
      <div class="up-note">AI 积分用于活动文案生成、智能解析等内容服务。内部按 token 折算，此处只显示「AI 积分」。</div>
      <div class="ai-break">
        <div class="ai-break-row"><span class="muted small">每月基础额度</span><b>${(c.base || 0).toLocaleString()}</b></div>
        <div class="ai-break-row"><span class="muted small">里程碑赠送（月清）</span><b>${(c.gift || 0).toLocaleString()}</b></div>
        <div class="ai-break-row"><span class="muted small">充值余额（不清零）</span><b>${(c.paid || 0).toLocaleString()}</b></div>
      </div>
      <div class="ai-sec-h">充值套餐（永久有效，不清零）</div>
      <div class="ai-pkgs">${AI_RECHARGE_PKGS.map((p) => `<button class="ai-pkg" data-action="aiRecharge" data-id="${p.id}">
        <div class="ai-pkg-amt">${p.amount.toLocaleString()} <small>AI 积分</small></div>
        <div class="ai-pkg-label">${p.label}</div>
        <div class="ai-pkg-price">¥${p.price}</div>
      </button>`).join("")}</div>
      <div class="ai-sec-h">商城销量里程碑（本月销量 ¥${sales.toLocaleString()}）</div>
      <div class="ai-mss">${AI_MILESTONES.map((m) => aiMilestoneRow(m, sales, achieved(m.t))).join("")}</div>
      <div class="ai-sec-h">额度流水</div>
      <div class="ai-ledger">${ledger.length ? ledger.slice(0, 12).map((l) => `<div class="ai-lg-row">
        <div class="ai-lg-l"><span class="ai-lg-t">${esc(typeLabel[l.type] || l.type)}</span><span class="ai-lg-n">${esc(l.note || "")}</span></div>
        <div class="ai-lg-r"><span class="ai-lg-d ${l.delta >= 0 ? "pos" : "neg"}">${l.delta >= 0 ? "+" : ""}${l.delta.toLocaleString()}</span><span class="ai-lg-b">余 ${(l.balance || 0).toLocaleString()}</span></div>
      </div>`).join("") : `<p class="muted small">暂无流水。使用 AI 换文案或在商城产生销量后会出现记录。</p>`}</div>
    </div>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (e) => { if (e.target === mask) mask.remove(); });
  }

  function renderMySignups() {
    const list = state.signups || [];
    const b = state.brand;
    const total = list.length;
    const paidCount = list.filter((s) => s.paid).length;
    const pendingCount = total - paidCount;
    const doneCount = list.filter((s) => { const a = getActivity(s.activityId); return a && a.status === "ended"; }).length;
    const name = mineName();
    const initial = (b && b.logoText) || name.slice(0, 1) || "野";
    return `<div class="front">
      <div class="mine-hero">
        <div class="mine-hero-mask"></div>
        <div class="mine-hero-inner">
          <div class="mine-avatar">${esc(initial)}</div>
          <div class="mine-user">
            <div class="mine-name">${esc(name)} <span class="mine-badge club">ClubOS 俱乐部版</span></div>
            <div class="mine-sub">${esc((b && b.slogan) || "把周末，交给山野。")}</div>
          </div>
          <button class="mine-set" data-action="toast" data-msg="设置页开发中">${ICON("settings")}</button>
        </div>
      </div>
      <div class="front-body">
        <div class="mine-orders">
          <div class="mine-order" data-action="toast" data-msg="待确认 ${pendingCount} 条"><div class="mine-order-n">${pendingCount}</div><div class="mine-order-l">待确认</div></div>
          <div class="mine-order" data-action="toast" data-msg="已付款 ${paidCount} 条"><div class="mine-order-n">${paidCount}</div><div class="mine-order-l">已付款</div></div>
          <div class="mine-order" data-action="toast" data-msg="已完成 ${doneCount} 条"><div class="mine-order-n">${doneCount}</div><div class="mine-order-l">已完成</div></div>
          <div class="mine-order" data-action="toast" data-msg="全部 ${total} 条"><div class="mine-order-n">${total}</div><div class="mine-order-l">全部</div></div>
        </div>
        <div class="fr-section" style="margin-bottom:30px">
          <div class="fr-section-h"><h3>我的报名</h3><span class="more" data-action="toast" data-msg="全部记录">全部</span></div>
          ${list.length ? list.map((s) => mineActCard(s)).join("") : '<div class="empty">还没有报名记录，去首页挑一场山野吧</div>'}
        </div>
        <div class="mine-tools">
          ${mineTool("crown", "俱乐部中心", "membership")}
          ${mineTool("heart", "我的收藏", "toast", "收藏功能开发中")}
          ${mineTool("headphones", "联系客服", "contactOrg")}
          ${mineTool("calendar", "活动日历", "toast", "日历功能开发中")}
          ${mineTool("settings", "设置", "toast", "设置页开发中")}
        </div>
      </div>
      <div class="front-tabbar">
        <div class="ft-item" data-action="openFrontHome">${ICON("home")}<span>首页</span></div>
        <div class="ft-item" data-action="toast" data-msg="目的地页开发中">${ICON("map-pin")}<span>目的地</span></div>
        <div class="ft-item" data-action="openMall">${ICON("shopping-bag")}<span>商城</span></div>
        <div class="ft-item" data-action="membership">${ICON("crown")}<span>会员</span></div>
        <div class="ft-item active" data-action="mySignups">${ICON("users")}<span>我的</span></div>
      </div>
      ${isAdminMode() ? `<button class="fab-admin" data-action="nav" data-view="dashboard">${ICON("home")} 返回工作台</button>` : ""}
      <button class="fab-service" data-action="contactOrg">${ICON("headphones")}</button>
    </div>`;
  }

  /* ---------------- router ---------------- */
