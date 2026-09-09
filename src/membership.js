  /* ============================================================
     ClubOS 会员管理后台（v92）
     三栏：会员基础设置 / 会员等级设置 / 购买会员订单
     ============================================================ */

  function renderMembershipAdmin() {
    const tab = state.membershipAdminTab || "basic";
    return `
      <div class="section-head">
        <div class="section-title">${ICON("crown")} 会员</div>
        <div class="section-sub">用户会员管理设置</div>
      </div>
      <div class="mem-admin-tabs">
        <button class="mem-admin-tab ${tab === "basic" ? "active" : ""}" data-action="membershipAdminTab" data-tab="basic">会员基础设置</button>
        <button class="mem-admin-tab ${tab === "tiers" ? "active" : ""}" data-action="membershipAdminTab" data-tab="tiers">会员等级设置</button>
        <button class="mem-admin-tab ${tab === "orders" ? "active" : ""}" data-action="membershipAdminTab" data-tab="orders">购买会员订单</button>
      </div>
      ${tab === "basic" ? renderMembershipBasic() : ""}
      ${tab === "tiers" ? renderMembershipTiers() : ""}
      ${tab === "orders" ? renderMembershipOrders() : ""}
    `;
  }

  function renderMembershipBasic() {
    const cfg = state.membershipSettings || JSON.parse(JSON.stringify(DEFAULT_MEMBERSHIP_SETTINGS));
    const cond = cfg.conditions || {};
    const radio = (name, value, checked) => `<label class="mem-radio"><input type="radio" name="${name}" value="${value}" ${checked ? "checked" : ""} data-action="membershipBasicChange" data-field="${name}"><span></span><i>${value === "purchase" ? "购买开通" : value === "condition" ? "条件开通" : value === "yes" ? "是" : value === "no" ? "否" : value === "all" ? "全部" : value === "any" ? "任意" : value === "selected" ? "指定门店" : "全部门店"}</i></label>`;
    const checkbox = (key, label, checked, val) => `
      <label class="mem-checkbox-row">
        <input type="checkbox" ${checked ? "checked" : ""} data-action="membershipCondToggle" data-key="${key}">
        <span>${label}</span>
        ${val !== undefined ? `<input type="number" class="input input-xs" value="${esc(val)}" data-action="membershipCondValue" data-key="${key}">` : ""}
      </label>`;
    return `
      <div class="card card-pad mem-card">
        <div class="mem-section-title">基础设置</div>
        <div class="mem-form-row">
          <label class="mem-form-label">会员开通方式</label>
          <div class="mem-radio-group">
            ${radio("activationMode", "purchase", cfg.activationMode === "purchase")}
            ${radio("activationMode", "condition", cfg.activationMode === "condition")}
          </div>
        </div>
        <div class="mem-form-row">
          <label class="mem-form-label">提交生日/姓名</label>
          <div class="mem-radio-group">
            ${radio("requireProfile", "no", !cfg.requireProfile)}
            ${radio("requireProfile", "yes", cfg.requireProfile)}
          </div>
          <span class="mem-form-hint">*成为会员前需提交生日、姓名、性别信息。仅6.3.15以上版本支持</span>
        </div>
        <div class="mem-form-row">
          <label class="mem-form-label">满足条件数量</label>
          <select class="select select-sm" data-action="membershipBasicSelect" data-field="conditionMatch">
            <option value="all" ${cfg.conditionMatch === "all" ? "selected" : ""}>全部</option>
            <option value="any" ${cfg.conditionMatch === "any" ? "selected" : ""}>任意</option>
          </select>
        </div>
        <div class="mem-form-row">
          <label class="mem-form-label">成为会员条件</label>
          <div class="mem-check-list">
            ${checkbox("followers", "粉丝达到指定人数", cond.followers && cond.followers.enabled, cond.followers && cond.followers.value)}
            ${checkbox("phone", "绑定手机号码", cond.phone && cond.phone.enabled)}
            ${checkbox("orders", "订单达到指定次数", cond.orders && cond.orders.enabled, cond.orders && cond.orders.value)}
            ${checkbox("spend", "消费达到指定金额", cond.spend && cond.spend.enabled, cond.spend && cond.spend.value)}
            ${checkbox("recharge", "充值达到指定金额", cond.recharge && cond.recharge.enabled, cond.recharge && cond.recharge.value)}
          </div>
        </div>
        <div class="mem-form-row">
          <label class="mem-form-label">参与会员价门店</label>
          <div class="mem-radio-group">
            ${radio("stores", "all", cfg.stores === "all")}
            ${radio("stores", "selected", cfg.stores === "selected")}
          </div>
        </div>
        <div class="mem-form-actions">
          <button class="btn btn-primary" data-action="saveMembershipBasic">${ICON("check")} 保存设置</button>
        </div>
      </div>
    `;
  }

  function renderMembershipTiers() {
    const tiers = state.memberTiers || [];
    const activeTierId = state._membershipTierEdit || (tiers[0] && tiers[0].id);
    const tier = tiers.find((t) => t.id === activeTierId) || tiers[0];
    const idx = tier ? tiers.indexOf(tier) : 0;
    const tabs = tiers.map((t, i) => `<button class="mem-tier-pill ${t.id === activeTierId ? "active" : ""}" data-action="membershipTierSelect" data-id="${t.id}">${i + 1}级:${esc(t.name)} ${t.id === activeTierId ? "" : `<span class="mem-tier-close" data-action="membershipTierDelete" data-id="${t.id}">${ICON("x")}</span>`}</button>`).join("");
    if (!tier) return `<div class="card card-pad"><p class="muted small">暂无会员等级，请先添加。</p><button class="btn btn-primary" data-action="membershipTierAdd">添加等级</button></div>`;

    const textRow = (label, value, field, placeholder = "", type = "text") => `
      <div class="mem-form-row">
        <label class="mem-form-label">${label}</label>
        <input type="${type}" class="input input-sm" value="${esc(value)}" placeholder="${placeholder}" data-action="membershipTierInput" data-field="${field}" data-id="${tier.id}">
      </div>`;

    const memberDaysRows = (tier.memberDays || []).map((d, i) => `
      <div class="mem-day-row">
        <input class="input input-xs" placeholder="周几" value="${esc(d.day || "")}" data-action="membershipTierDay" data-id="${tier.id}" data-idx="${i}" data-key="day">
        <input class="input input-xs" placeholder="折扣" value="${esc(d.discount || "")}" data-action="membershipTierDay" data-id="${tier.id}" data-idx="${i}" data-key="discount">
        <input class="input input-xs" placeholder="积分倍数" value="${esc(d.pointsMultiplier || "")}" data-action="membershipTierDay" data-id="${tier.id}" data-idx="${i}" data-key="pointsMultiplier">
        <input class="input input-xs" placeholder="参与商品" value="${esc(d.products || "")}" data-action="membershipTierDay" data-id="${tier.id}" data-idx="${i}" data-key="products">
        <input class="input input-xs" placeholder="可领取" value="${esc(d.claimable || "")}" data-action="membershipTierDay" data-id="${tier.id}" data-idx="${i}" data-key="claimable">
        <button class="mini-btn mini-btn-danger" data-action="membershipTierDayDel" data-id="${tier.id}" data-idx="${i}">${ICON("trash")}</button>
      </div>
    `).join("");

    const couponRows = (tier.autoGrant && tier.autoGrant.coupons || []).map((c, i) => `
      <div class="mem-coupon-row">
        <span class="mem-coupon-cell">${esc(c.couponId || "—")}</span>
        <span class="mem-coupon-cell">${esc(c.title || "—")}</span>
        <span class="mem-coupon-cell">${esc(c.qty || 1)}</span>
        <button class="mini-btn mini-btn-danger" data-action="membershipTierCouponDel" data-id="${tier.id}" data-idx="${i}">${ICON("trash")}</button>
      </div>
    `).join("");

    return `
      <div class="card card-pad mem-card">
        <div class="mem-tier-tabs">
          ${tabs}
          <button class="mem-tier-pill mem-tier-add" data-action="membershipTierAdd">+ 添加等级</button>
        </div>

        <div class="mem-tier-panel">
          <div class="mem-section-title">基础设置</div>
          ${textRow("会员标题", tier.name, "name")}
          <div class="mem-form-row">
            <label class="mem-form-label">会员折扣</label>
            <div class="mem-input-unit">
              <input type="number" class="input input-sm" value="${esc(tier.discount)}" data-action="membershipTierInput" data-field="discount" data-id="${tier.id}">
              <span>折</span>
            </div>
          </div>
          <div class="mem-form-row">
            <label class="mem-form-label">等级标识</label>
            <div class="mem-logo-upload" data-action="membershipTierIcon" data-id="${tier.id}">
              ${tier.iconUrl ? `<img src="${esc(tier.iconUrl)}" class="mem-tier-icon-prev">` : `<div class="mem-tier-icon-ph">${ICON(tier.icon || "crown")}</div>`}
            </div>
            <span class="mem-form-hint">*推荐高宽比例：1:2</span>
          </div>

          <div class="mem-section-title">会员说明</div>
          <div class="mem-form-row">
            <textarea class="textarea" rows="5" data-action="membershipTierInput" data-field="description" data-id="${tier.id}">${esc(tier.description)}</textarea>
          </div>

          <div class="mem-section-title">升级规则</div>
          <div class="mem-form-row">
            <label class="mem-form-label">每消费1元获得</label>
            <div class="mem-input-unit">
              <input type="number" class="input input-sm" value="${esc(tier.growthSpend)}" data-action="membershipTierInput" data-field="growthSpend" data-id="${tier.id}">
              <span>成长值</span>
            </div>
          </div>
          <div class="mem-form-row">
            <label class="mem-form-label">每充值1元获得</label>
            <div class="mem-input-unit">
              <input type="number" class="input input-sm" value="${esc(tier.growthRecharge)}" data-action="membershipTierInput" data-field="growthRecharge" data-id="${tier.id}">
              <span>成长值</span>
            </div>
          </div>

          <div class="mem-section-title">降级策略</div>
          <div class="mem-form-row">
            <label class="mem-form-label">降级提醒</label>
            <label class="mem-switch-label">
              <input type="checkbox" ${tier.downgradeSms ? "checked" : ""} data-action="membershipTierToggle" data-field="downgradeSms" data-id="${tier.id}">
              <span>短信提醒</span>
            </label>
            <span class="mem-form-hint">降级考核前</span>
            <input type="number" class="input input-xs" style="width:70px" value="${esc(tier.downgradeDays)}" data-action="membershipTierInput" data-field="downgradeDays" data-id="${tier.id}">
            <span class="mem-form-hint">天向会员发送降级提醒短信</span>
          </div>
          <p class="mem-form-warning">请先修改短信签名 <a data-action="membershipSmsSign">前往修改 &gt;</a></p>
          <p class="mem-form-hint">短信每条：0.055元，当前余额：0.000元 <a data-action="membershipSmsRecharge">去充值 &gt;</a></p>

          <div class="mem-section-title">会员权益</div>
          <div class="mem-form-row">
            <label class="mem-form-label">消费送积分</label>
            <label class="switch switch-sm">
              <input type="checkbox" ${tier.pointsEnabled ? "checked" : ""} data-action="membershipTierToggle" data-field="pointsEnabled" data-id="${tier.id}">
              <span class="slider"></span>
            </label>
          </div>
          <p class="mem-form-hint">[会员专享]</p>
          <div class="mem-form-row">
            <label class="mem-form-label">消费赠送积分</label>
            <div class="mem-input-unit-group">
              <span>每消费</span>
              <input type="number" class="input input-xs" value="${esc(tier.pointsRate)}" data-action="membershipTierInput" data-field="pointsRate" data-id="${tier.id}">
              <span>元赠送1积分</span>
            </div>
          </div>
          <div class="mem-form-row">
            <label class="mem-form-label">会员包邮</label>
            <label class="switch switch-sm">
              <input type="checkbox" ${tier.freeShipping ? "checked" : ""} data-action="membershipTierToggle" data-field="freeShipping" data-id="${tier.id}">
              <span class="slider"></span>
            </label>
          </div>
          <div class="mem-form-row">
            <label class="mem-form-label">会员专享功能</label>
            <label class="mem-checkbox-row" style="margin:0">
              <input type="checkbox" ${tier.perks && tier.perks.includes("免配送费") ? "checked" : ""} data-action="membershipTierPerk" data-id="${tier.id}" data-perk="免配送费">
              <span>免配送费</span>
            </label>
          </div>

          <div class="mem-section-title">会员日时间</div>
          <div class="mem-day-table">
            <div class="mem-day-th">
              <span>时间</span><span>折扣</span><span>积分倍数</span><span>参与商品</span><span>可领取</span><span>操作</span>
            </div>
            ${memberDaysRows || `<div class="mem-empty-row">暂无数据</div>`}
            <button class="btn btn-ghost btn-sm" data-action="membershipTierDayAdd" data-id="${tier.id}">${ICON("plus")} 添加方案</button>
          </div>

          <div class="mem-section-title">自动发放周期</div>
          <div class="mem-form-row">
            <label class="switch switch-sm">
              <input type="checkbox" ${tier.autoGrant && tier.autoGrant.enabled ? "checked" : ""} data-action="membershipTierToggle" data-field="autoGrantEnabled" data-id="${tier.id}">
              <span class="slider"></span>
            </label>
          </div>
          <div class="mem-form-row">
            <label class="mem-form-label">赠送积分</label>
            <input type="number" class="input input-sm" value="${esc(tier.autoGrant && tier.autoGrant.points)}" data-action="membershipTierInput" data-field="autoGrantPoints" data-id="${tier.id}">
          </div>
          <div class="mem-form-row">
            <label class="mem-form-label">送优惠券</label>
            <div class="mem-coupon-table">
              <div class="mem-coupon-th"><span>券ID</span><span>名称</span><span>数量</span><span>操作</span></div>
              ${couponRows || `<div class="mem-empty-row">暂无数据</div>`}
              <button class="btn btn-ghost btn-sm" data-action="membershipTierCouponAdd" data-id="${tier.id}">${ICON("plus")} 添加优惠券</button>
            </div>
          </div>

          <div class="mem-form-actions">
            <button class="btn btn-primary" data-action="saveMembershipTiers">${ICON("check")} 保存设置</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderMembershipOrders() {
    const filters = state.membershipOrderFilters || {};
    const page = state.membershipOrderPage || { page: 1, pageSize: 15 };
    let list = (state.membershipOrders || []).slice();
    if (filters.uid) list = list.filter((o) => (o.uid || "").includes(filters.uid));
    if (filters.nickname) list = list.filter((o) => (o.nickname || "").includes(filters.nickname));
    if (filters.orderNo) list = list.filter((o) => (o.orderNo || "").includes(filters.orderNo));
    if (filters.store && filters.store !== "all") list = list.filter((o) => (o.store || "—") === filters.store);
    if (filters.duration && filters.duration !== "all") list = list.filter((o) => String(o.durationDays) === filters.duration);
    if (filters.status && filters.status !== "all") list = list.filter((o) => o.status === filters.status);
    if (filters.startDate) list = list.filter((o) => o.createdAt >= new Date(filters.startDate + "T00:00:00").getTime());
    if (filters.endDate) list = list.filter((o) => o.createdAt <= new Date(filters.endDate + "T23:59:59").getTime());

    const total = list.length;
    const totalAmount = list.reduce((s, o) => s + (o.amount || 0), 0);
    const totalPages = Math.max(1, Math.ceil(total / page.pageSize));
    page.page = Math.min(page.page, totalPages);
    const start = (page.page - 1) * page.pageSize;
    const rows = list.slice(start, start + page.pageSize);

    const fmtDate = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
    const statusBadge = (st) => { const map = { paid: "已支付", pending: "待支付", refunded: "已退款" }; const cls = { paid: "success", pending: "warn", refunded: "danger" }; return `<span class="mem-status ${cls[st] || "warn"}">${map[st] || st}</span>`; };

    return `
      <div class="card card-pad mem-card">
        <div class="mem-filter-bar">
          <div class="mem-filter-field"><label>UID</label><input class="input input-sm" placeholder="UID" value="${esc(filters.uid || "")}" data-action="membershipOrderFilter" data-field="uid"></div>
          <div class="mem-filter-field"><label>用户昵称</label><input class="input input-sm" placeholder="用户昵称" value="${esc(filters.nickname || "")}" data-action="membershipOrderFilter" data-field="nickname"></div>
          <div class="mem-filter-field"><label>订单号</label><input class="input input-sm" placeholder="订单号" value="${esc(filters.orderNo || "")}" data-action="membershipOrderFilter" data-field="orderNo"></div>
          <div class="mem-filter-field"><label>下单门店</label>
            <select class="select select-sm" data-action="membershipOrderFilter" data-field="store">
              <option value="all" ${filters.store === "all" ? "selected" : ""}>全部门店</option>
              <option value="—" ${filters.store === "—" ? "selected" : ""}>线上</option>
            </select>
          </div>
          <div class="mem-filter-field"><label>时长</label>
            <select class="select select-sm" data-action="membershipOrderFilter" data-field="duration">
              <option value="all">全部</option>
              ${[30, 90, 180, 360].map((d) => `<option value="${d}" ${filters.duration === String(d) ? "selected" : ""}>${d}天</option>`).join("")}
            </select>
          </div>
          <div class="mem-filter-field"><label>状态</label>
            <select class="select select-sm" data-action="membershipOrderFilter" data-field="status">
              <option value="all">全部</option>
              <option value="paid" ${filters.status === "paid" ? "selected" : ""}>已支付</option>
              <option value="pending" ${filters.status === "pending" ? "selected" : ""}>待支付</option>
              <option value="refunded" ${filters.status === "refunded" ? "selected" : ""}>已退款</option>
            </select>
          </div>
          <div class="mem-filter-field mem-filter-dates"><label>下单时间</label>
            <input type="date" class="input input-sm" value="${esc(filters.startDate || "")}" data-action="membershipOrderFilter" data-field="startDate">
            <span>至</span>
            <input type="date" class="input input-sm" value="${esc(filters.endDate || "")}" data-action="membershipOrderFilter" data-field="endDate">
          </div>
          <button class="btn btn-primary btn-sm" data-action="membershipOrderQuery">查询</button>
          <button class="btn btn-ghost btn-sm" data-action="membershipOrderExport">导出</button>
        </div>

        <div class="mem-order-summary">
          <div><span>订单数</span><b>${total}</b></div>
          <div><span>订单金额</span><b>${totalAmount.toFixed(2)}</b></div>
        </div>

        <div class="mem-order-table-wrap">
          <table class="mem-order-table">
            <thead><tr>
              <th>UID</th><th>用户头像</th><th>用户昵称</th><th>金额</th><th>订单号</th><th>续费时长(天)</th><th>下单门店</th><th>支付状态</th><th>下单时间</th>
            </tr></thead>
            <tbody>
              ${rows.length ? rows.map((o) => `
                <tr>
                  <td>${esc(o.uid || "—")}</td>
                  <td><img src="${esc(o.avatar || "")}" class="mem-order-avatar" alt=""></td>
                  <td>${esc(o.nickname || "—")}</td>
                  <td>${o.amount != null ? o.amount.toFixed(2) : "—"}</td>
                  <td>${esc(o.orderNo || "—")}</td>
                  <td>${esc(o.durationDays || "—")}</td>
                  <td>${esc(o.store || "—")}</td>
                  <td>${statusBadge(o.status)}</td>
                  <td>${fmtDate(o.createdAt)}</td>
                </tr>
              `).join("") : `<tr><td colspan="9" class="mem-empty-cell">暂无订单数据</td></tr>`}
            </tbody>
          </table>
        </div>

        <div class="mem-pagination">
          <span>共 ${total} 条</span>
          <select class="select select-sm" data-action="membershipPageSize">
            <option value="15" ${page.pageSize === 15 ? "selected" : ""}>15条/页</option>
            <option value="30" ${page.pageSize === 30 ? "selected" : ""}>30条/页</option>
            <option value="50" ${page.pageSize === 50 ? "selected" : ""}>50条/页</option>
          </select>
          <button class="mini-btn" data-action="membershipPage" data-dir="prev" ${page.page <= 1 ? "disabled" : ""}>${ICON("chevron-left")}</button>
          <span class="mem-page-current">${page.page}</span>
          <button class="mini-btn" data-action="membershipPage" data-dir="next" ${page.page >= totalPages ? "disabled" : ""}>${ICON("chevron-right")}</button>
          <span>前往</span>
          <input type="number" class="input input-xs" style="width:56px" value="${page.page}" data-action="membershipPageGo">
          <span>页</span>
        </div>
      </div>
    `;
  }
