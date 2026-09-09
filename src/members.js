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
  // riskLevel 为平台内部字段：只用于「安全优先」的推荐排序与平台上架审核，不对消费者展示原始等级码。
  function riskLabel(r) { return { L1: "普通商品", L2: "一般户外装备", L3: "安全关键装备" }[r] || r; }
  // 消费者视角只看到「装备类型」这一层语义，不暴露风控等级。
  function gearTypeLabel(r) { return { L1: "普通装备", L2: "专业装备", L3: "技术装备" }[r] || "户外装备"; }
  // 商城上下文：store = 消费者门店视角（无佣金）；console = 俱乐部收益视角；admin = 平台运营视角。
  function mallCtx() { return state.mallCtx === "console" || state.mallCtx === "admin" ? state.mallCtx : "store"; }
  function currentClubId() { return (state.brand && state.brand.id) || "club_demo"; }
  function clubMallOrders() { return (state.mallOrders || []).filter((o) => o.clubId === currentClubId()); }
  function clubCommissionSummary() {
    const sum = { pending: 0, frozen: 0, available: 0, settled: 0, reversed: 0 };
    clubMallOrders().forEach((o) => { const st = o.commissionStatus || "pending"; if (sum[st] != null) sum[st] += orderCommission(o); });
    return sum;
  }
  function logisticsLabel(l) { return { pending: "待发货", shipped: "已发货", signed: "已签收" }[l] || l; }

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

  function renderMallCommissionPanel(orders, cs) {
    const sub = state.commissionSubTab || "apply";
    const availableOrders = orders.filter((o) => o.commissionStatus === "available").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const allOrders = orders.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const records = (state.commissionSettlements || []).filter((r) => r.clubId === currentClubId()).sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
    return `<div class="mall-console-panel">
      <div class="comm-subtabs">
        <button class="comm-subtab ${sub === "apply" ? "active" : ""}" data-action="commissionSubTab" data-tab="apply">可申请结算的佣金</button>
        <button class="comm-subtab ${sub === "details" ? "active" : ""}" data-action="commissionSubTab" data-tab="details">佣金明细</button>
        <button class="comm-subtab ${sub === "records" ? "active" : ""}" data-action="commissionSubTab" data-tab="records">结算记录</button>
      </div>
      ${sub === "apply" ? renderApplyCommission(availableOrders, cs) : ""}
      ${sub === "details" ? renderCommissionDetails(allOrders) : ""}
      ${sub === "records" ? renderSettlementRecords(records) : ""}
    </div>`;
  }
  function renderApplyCommission(orders, cs) {
    const total = orders.reduce((sum, o) => sum + orderCommission(o), 0);
    const pf = state.settlementProfile || {};
    return `<div class="apply-section">
      <div class="apply-summary"><div><b>可结算总额</b><span class="amount">¥${Math.round(total)}</span></div><div class="muted small">勾选订单后选择结算方式并申请</div></div>
      ${orders.length ? `<div class="comm-list">${orders.map((o) => `<div class="comm-row"><input type="checkbox" class="settle-cb" data-id="${o.id}" checked><div class="comm-info"><div class="comm-title">${esc((o.items && o.items[0] && o.items[0].title) || "商品")}</div><div class="comm-sub">订单 ${esc((o.id || "").slice(0, 8))} · ¥${o.amount} · 佣金 ¥${orderCommission(o)} · ${COMM_STATUS_LABEL[o.commissionStatus]}</div></div></div>`).join("")}</div>` : `<p class="muted small">当前没有可结算佣金。待确认 → 冻结（售后期）→ 可结算，到达后可在此申请。</p>`}
      <div class="settle-form">
        <label class="settle-method">结算方式<select id="settleMethod" class="input">
          <option value="company" ${pf.method !== "card" ? "selected" : ""}>对公结算（结算到俱乐部对公账户）</option>
          <option value="card" ${pf.method === "card" ? "selected" : ""}>法人卡结算（结算到法人银行卡）</option>
        </select></label>
        <input id="settleCompany" class="input" placeholder="公司全称" value="${esc(pf.companyName || "")}">
        <input id="settleTax" class="input" placeholder="统一社会信用代码" value="${esc(pf.taxNo || "")}">
        <input id="settleBank" class="input" placeholder="开户银行" value="${esc(pf.bank || "")}">
        <input id="settleAccount" class="input" placeholder="对公账号" value="${esc(pf.accountNo || "")}">
        <input id="settleCardName" class="input" placeholder="法人姓名" value="${esc(pf.cardName || "")}">
        <input id="settleCardBank" class="input" placeholder="法人银行卡开户行" value="${esc(pf.cardBank || "")}">
        <input id="settleCardNo" class="input" placeholder="法人银行卡号" value="${esc(pf.cardNo || "")}">
        <input id="settleIdCard" class="input" placeholder="法人身份证号" value="${esc(pf.idCard || "")}">
        <button class="btn btn-primary btn-block" data-action="mallApplySettlement" ${total <= 0 ? "disabled" : ""}>申请结算</button>
      </div>
    </div>`;
  }
  function renderCommissionDetails(orders) {
    return `<div class="fr-section"><div class="fr-section-h"><h3>佣金明细</h3></div>
      ${orders.length ? `<div class="comm-list">${orders.map((o) => `<div class="comm-row"><div class="comm-info"><div class="comm-title">${esc((o.items && o.items[0] && o.items[0].title) || "商品")}</div><div class="comm-sub">订单 ${esc((o.id || "").slice(0, 8))} · ¥${o.amount} · 佣金 ¥${orderCommission(o)} · ${COMM_STATUS_LABEL[o.commissionStatus]}</div></div><div class="comm-actions"><span class="comm-status ${o.commissionStatus}">${COMM_STATUS_LABEL[o.commissionStatus]}</span></div></div>`).join("")}</div>` : `<p class="muted small">暂无佣金明细。</p>`}
    </div>`;
  }
  function renderSettlementRecords(records) {
    return `<div class="fr-section"><div class="fr-section-h"><h3>结算记录</h3></div>
      ${records.length ? `<div class="settle-table-wrap"><table class="settle-table"><thead><tr><th>申请时间</th><th>金额</th><th>结算方式</th><th>账户</th><th>状态</th></tr></thead><tbody>${records.map((r) => `<tr><td>${formatDateYMD(new Date(r.requestedAt))}</td><td>¥${r.amount}</td><td>${r.method === "company" ? "对公结算" : "法人卡结算"}</td><td>${r.method === "company" ? esc(r.companyName || "-") : esc(r.cardName || "-")}</td><td><span class="settle-status ${r.status}">${r.status === "pending" ? "未结算" : "已到账"}</span></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">暂无结算记录。</p>`}
    </div>`;
  }
  function refreshMallContext() {
    const v = state.mallView || "browse";
    if (v === "commission") { state.mallConsoleTab = "commission"; showView("mallConsole"); }
    else if (v === "admin") showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin");
    else if (mallCtx() === "console") showView("mallConsole");
    else showView("mall");
  }

  /* ---------------- 商城三视角（V1.0 收口） ----------------
     Storefront        消费者门店：只看商品与购买，看不到佣金/供货价/风控等级
     ClubMallConsole   俱乐部收益：推荐货架经营 + 佣金收益，不能改价改库存
     PlatformMallAdmin 平台运营：上架/定价/佣金规则/结算（renderMallAdmin）        */

  // 消费者门店视角
