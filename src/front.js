  /* ---------------- 图片与卡片辅助（模块级，供组件复用） ---------------- */
  function szImg(a) {
    const hasPhoto = a.photos && a.photos[0];
    if (hasPhoto) return `<img data-smart-img src="${a.photos[0]}" alt="" style="object-position:${smartPos(a.photos[0])}">`;
    return `<div class="sz-gradient"><div class="img-pattern"></div></div>`;
  }
  function songzanGrid(list) {
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
          <div class="sz-card-foot">${activityPriceHtml(big, true)}</div>
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
  }
  // C 端价格展示：优先显示当前会员等级价；未登录/无等级时显示会员价区间；未开会员价显示基础价
  function activityPriceHtml(a, compact) {
    const cur = currentMemberTier();
    const my = memberPriceForTier(a, cur);
    const range = memberPriceRange(a);
    if (a.useMemberPrice && my != null && my !== a.price) {
      return `<b>¥${my}</b><small>/${esc(a.limitUnit)}</small>${compact ? "" : `<span class="price-tag">${esc(cur.name)}</span>`}`;
    }
    if (a.useMemberPrice && range) {
      return `<b>¥${range.min}起</b><small>/${esc(a.limitUnit)}</small>${compact ? "" : `<span class="price-tag">会员</span>`}`;
    }
    return a.price ? `<b>¥${a.price}</b><small>/${esc(a.limitUnit)}</small>` : "详询";
  }
  function activityPriceText(a) {
    const cur = currentMemberTier();
    const my = memberPriceForTier(a, cur);
    if (a.useMemberPrice && my != null) return "¥" + my;
    return a.price ? "¥" + a.price : "详询";
  }
  function szFeedCard(a) {
    return `<div class="sz-feed-card" data-action="openFront" data-id="${a.id}">
      <div class="sz-feed-cover">${szImg(a)}</div>
      <div class="sz-feed-mask"></div>
      <div class="sz-feed-content">
        <span class="sz-feed-tag ${a.pinned ? "" : "sz-tag-light"}">${a.status === "full" ? "已满员" : a.pinned ? "热招中" : esc(a.type)}</span>
        <h4>${esc(a.title)}</h4>
        <p>${esc(a.dateMD || a.date || "待定")} · ${esc(a.meeting || "成都")}</p>
        <div class="sz-feed-price">${activityPriceHtml(a, true)}</div>
      </div>
    </div>`;
  }
  function szThemeCard(t, i, isAct) {
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
  }
  function homeGearPicks() {
    const recs = (state.myRecs || []).map((id) => getProduct(id)).filter(Boolean);
    if (recs.length) return recs.slice(0, 6);
    return (state.mallProducts || []).slice().sort((x, y) => (y.rating || 0) - (x.rating || 0)).slice(0, 6);
  }
  function homeTemplate() { return (state.homeLayout && state.homeLayout.template) || "classic_route"; }

  /* ---------------- 8 个首页组件（v90/v91，组件化渲染，支持三模版） ---------------- */
  function renderBanner(c, preview, tpl) {
    const cfg = c.config || {};
    const b = state.brand;
    const recruiting = state.activities.filter((a) => a.status === "recruiting" || a.status === "full");
    const pinned = recruiting.filter((a) => a.pinned).sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
    const auto = [...recruiting].sort((a, b) => b.createdAt - a.createdAt);
    const featured = pinned.length ? pinned : auto.slice(0, 4);
    const emptySlide = () => `<div class="hero-slide active" data-idx="0"><div class="hero-bg"><div class="hero-def"></div></div><div class="hero-mask"></div><div class="hero-foot"><span class="hero-kicker">${esc(cfg.tag || "户外 · 自然 · 成长")}</span><h1 class="hero-title">${esc(cfg.title || b.slogan || "和孩子一起，走进真实的自然")}</h1><p class="hero-sub">${esc(cfg.sub || "真实行程 · 透明费用 · 出团通知为准")}</p><div class="hero-cta">开启探索 ${ICON("chevron-right")}</div></div></div>`;
    if (preview) {
      const first = featured[0];
      const slide = first ? heroSlide(first, 0, tpl).replace('data-action="openFront"', '') : emptySlide();
      return `<div class="home-hero home-hero-preview"><div class="hero-slides">${slide}</div></div>`;
    }
    if (tpl === "community") {
      return `<div class="home-hero home-hero-community" id="homeHero">
        <div class="hero-top">
          <div class="ht-brand">${frontLogo(30, true)}<span>${esc(b.name)}</span></div>
          <div class="ht-right"><button class="ht-avatar" data-action="mySignups" aria-label="查看我的活动">${ICON("users")}</button></div>
        </div>
        <div class="hero-search" data-action="focusSearch">${ICON("search")}<input type="text" id="frontSearchInput" placeholder="搜索目的地 / 活动 / 装备" autocomplete="off"><span class="ai-badge">AI 搜索</span></div>
        <div class="hero-community-slogan">
          <h1>${esc(cfg.title || b.slogan || "发现下一个出发")}</h1>
          <p>${esc(cfg.sub || "和一群人，去有意思的地方")}</p>
        </div>
      </div>`;
    }
    const slides = featured.length ? featured.slice(0, 3).map((a, i) => heroSlide(a, i, tpl)).join("") : emptySlide();
    const heroDots = featured.length > 1 ? `<div class="hero-dots">${featured.slice(0, 3).map((_, i) => `<span class="hero-dot ${i === 0 ? "active" : ""}" data-idx="${i}"></span>`).join("")}</div>` : "";
    if (tpl === "camp_study") {
      return `<div class="home-hero home-hero-camp" id="homeHero">
        <div class="hero-slides">${slides}</div>
        <div class="hero-top"><div class="ht-brand">${frontLogo(30, true)}<span>${esc(b.name)}</span></div><div class="ht-right"><button class="ht-avatar" data-action="mySignups" aria-label="查看我的活动">${ICON("users")}</button></div></div>
        <div class="hero-search" data-action="focusSearch">${ICON("search")}<input type="text" id="frontSearchInput" placeholder="搜索疗愈活动 / 营地课程" autocomplete="off"></div>
        <div class="hero-camp-cta"><button class="hero-pill" data-action="nav" data-view="list">${esc(cfg.tag || "开启疗愈之旅")} ${ICON("chevron-right")}</button></div>
        ${heroDots}
      </div>`;
    }
    return `<div class="home-hero" id="homeHero">
      <div class="hero-slides">${slides}</div>
      <div class="hero-top"><div class="ht-brand">${frontLogo(30, true)}<span>${esc(b.name)}</span></div><div class="ht-right"><button class="ht-avatar" data-action="mySignups" aria-label="查看我的活动">${ICON("users")}</button></div></div>
      <div class="hero-search" data-action="focusSearch">${ICON("search")}<input type="text" id="frontSearchInput" placeholder="搜本俱乐部活动" autocomplete="off"></div>
      ${heroDots}
    </div>`;
  }
  function renderEntry(c, tpl) {
    const cfg = c.config || {};
    const items = cfg.items || [];
    if (!items.length) return "";
    const primary = state.brand.primary || "#2F5D50";
    const title = esc(cfg.title || "探索目的地");
    if (tpl === "camp_study") {
      return `<div class="fr-section fr-entry-camp"><div class="fr-section-h"><h3>${ICON("compass")} ${title}</h3></div>
        <div class="camp-pills">${items.map((it) => `<div class="camp-pill" data-action="toast" data-msg="${esc(it.label)}分类开发中">
          <div class="camp-pill-ic">${ICON(it.icon || "leaf")}</div><span>${esc(it.label)}</span>
        </div>`).join("")}</div></div>`;
    }
    if (tpl === "community") {
      return `<div class="fr-section fr-entry-community"><div class="fr-section-h"><h3>${ICON("compass")} ${title}</h3></div>
        <div class="community-quick">${items.map((it) => `<div class="community-quick-cell" data-action="toast" data-msg="${esc(it.label)}分类开发中">
          <div class="community-quick-ic" style="background:${hexA(primary, 0.10)};color:${primary}">${ICON(it.icon || "mountain")}</div><span>${esc(it.label)}</span>
        </div>`).join("")}</div></div>`;
    }
    return `<div class="fr-section"><div class="fr-section-h"><h3>${ICON("compass")} ${title}</h3></div>
      <div class="entry-grid">${items.map((it) => `<div class="entry-cell" data-action="toast" data-msg="${esc(it.label)}分类开发中">
        <div class="entry-ic" style="background:${hexA(primary, 0.10)};color:${primary}">${ICON(it.icon || "mountain")}</div>
        <span class="entry-label">${esc(it.label)}</span>
      </div>`).join("")}</div></div>`;
  }
  function renderHomeActivities(c, tpl) {
    const cfg = c.config || {};
    const recruiting = state.activities.filter((a) => a.status === "recruiting" || a.status === "full");
    const pinned = recruiting.filter((a) => a.pinned).sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0));
    const auto = [...recruiting].sort((a, b) => b.createdAt - a.createdAt);
    const featured = pinned.length ? pinned : auto.slice(0, 4);
    const limit = cfg.limit || 6;
    const title = esc(cfg.title || "正在招募");
    if (tpl === "community") {
      const list = featured.slice(0, Math.min(4, limit));
      return `<div class="fr-section fr-feed"><div class="fr-section-h"><h3>${ICON("flame")} ${title}</h3><span class="more" data-action="nav" data-view="list">全部 ${recruiting.length}</span></div>
        ${list.length ? `<div class="community-feed">${list.map((a) => communityFeedCard(a)).join("")}</div>` : emptyBento()}</div>`;
    }
    if (tpl === "camp_study") {
      const list = featured.slice(0, Math.min(6, limit));
      return `<div class="fr-section fr-camp-acts"><div class="fr-section-h"><h3>${ICON("flame")} ${title}</h3><span class="more" data-action="nav" data-view="list">全部 ${recruiting.length}</span></div>
        ${list.length ? `<div class="camp-masonry">${list.map((a, i) => szThemeCard(a, i, true)).join("")}</div>` : emptyBento()}</div>`;
    }
    const list = featured.slice(0, Math.min(3, limit));
    return `<div class="fr-section"><div class="fr-section-h"><h3>${ICON("flame")} ${title}</h3><span class="more" data-action="nav" data-view="list">全部 ${recruiting.length}</span></div>
      ${list.length ? songzanGrid(list) : emptyBento()}</div>`;
  }
  function communityFeedCard(a) {
    const hasPhoto = a.photos && a.photos[0];
    const img = hasPhoto ? `<img data-smart-img src="${a.photos[0]}" alt="" style="object-position:${smartPos(a.photos[0])}">` : "";
    const placeholder = hasPhoto ? "" : `<div class="gradient"><div class="img-pattern"></div></div>`;
    const likes = (a.likes == null ? Math.max(12, Math.round((a.title || "").length * 1.3) + (a.price ? 30 : 0)) : a.likes);
    return `<div class="community-card" data-action="openFront" data-id="${a.id}">
      <div class="community-cover">${img}${placeholder}<span class="community-tag">${a.status === "full" ? "已满员" : a.pinned ? "热招中" : esc(a.type)}</span></div>
      <div class="community-body">
        <h4>${esc(a.title)}</h4>
        <div class="community-meta">${esc(a.dateMD || a.date || "待定")} · ${esc(a.meeting || "成都")} · ${a.days > 1 ? a.days + "天" : "单日"}</div>
        <div class="community-foot"><span class="community-price">${activityPriceHtml(a, true)}</span><span class="community-likes">${ICON("heart")} ${likes}</span></div>
      </div>
    </div>`;
  }
  function renderHomeUpcoming(c, tpl) {
    const cfg = c.config || {};
    const recruiting = state.activities.filter((a) => a.status === "recruiting" || a.status === "full");
    const upcoming = recruiting.map((a) => ({ a, d: daysUntil(a) }))
      .filter((x) => x.d != null && x.d >= 0 && x.d <= 30)
      .sort((x, y) => x.d - y.d).slice(0, 4);
    if (!upcoming.length) return "";
    return `<div class="fr-section"><div class="fr-section-h"><h3>${ICON("clock")} ${esc(cfg.title || "即将出发")}</h3></div>
      <div class="up-list">${upcoming.map(({ a, d }) => `<div class="up-row" data-action="openFront" data-id="${a.id}">
        <div class="up-d"><b>${d === 0 ? "今天" : d === 1 ? "明天" : d}</b><span>${d <= 1 ? "出发" : "天后"}</span></div>
        <div class="up-main"><div class="up-t">${esc(a.title)}</div><div class="up-s">${esc(a.dateMD || a.date || "")}${a.meetTime ? " " + esc(a.meetTime) : ""}${a.meeting ? " · " + esc(a.meeting) : ""}</div></div>
        <div class="up-r">${a.status === "full" ? '<span class="up-full">已满员</span>' : activityPriceText(a)}</div>
      </div>`).join("")}</div></div>`;
  }
  function renderHomeCoupon(c, tpl) {
    const cfg = c.config || {};
    const coupons = (state.coupons || []).filter((x) => x.status === "active").slice(0, 4);
    if (!coupons.length) return "";
    return `<div class="fr-section"><div class="fr-section-h"><h3>${ICON("ticket")} ${esc(cfg.title || "领券优惠")}</h3></div>
      <div class="home-coupons">${coupons.map((cp) => `<div class="home-coupon">
        <div class="hc-left"><div class="hc-amt">${cp.type === "discount" ? (cp.value / 10) + "折" : "¥" + cp.value}</div><div class="hc-cond">${cp.threshold ? "满" + cp.threshold + "可用" : "无门槛"}</div></div>
        <div class="hc-body"><div class="hc-title">${esc(cp.title)}</div><div class="hc-sub">${cp.scope === "gear" ? "限装备商城" : (cp.total ? "已领" + cp.claimed + "/" + cp.total : "")}</div></div>
        <button class="hc-btn" data-action="toast" data-msg="领取成功（Demo）">领取</button>
      </div>`).join("")}</div></div>`;
  }
  function renderHomeGear(c, tpl) {
    const cfg = c.config || {};
    const picks = homeGearPicks();
    if (!picks.length) return "";
    return `<div class="fr-section"><div class="fr-section-h"><h3>${ICON("shopping-bag")} ${esc(cfg.title || "装备推荐")}</h3><span class="more" data-action="openMall">去商城</span></div>
      <div class="mall-recs">${picks.slice(0, cfg.limit || 6).map((p) => `<div class="mall-rec" data-action="mallProduct" data-id="${p.id}">
        <div class="mall-rec-ph" style="background-image:url('${esc(p.cover)}')"></div>
        <div class="mall-rec-t">${esc(p.title)}</div>
        <div class="mall-rec-p">¥${p.retailPrice}</div>
      </div>`).join("")}</div></div>`;
  }
  function renderHomeMember(c, tpl) {
    const cfg = c.config || {};
    const b = state.brand;
    const title = esc(cfg.title || "会员积分");
    if (tpl === "community") {
      return `<div class="fr-section fr-member-row"><div class="fr-section-h"><h3>${ICON("crown")} ${title}</h3><span class="more" data-action="memberCenter">会员权益</span></div>
        <div class="member-row" data-action="memberCenter"><div class="member-row-ic">${ICON("crown")}</div><div class="member-row-txt"><div>${esc(b.name)} 会员 · 积分可抵现</div><span>去查看</span></div></div></div>`;
    }
    if (tpl === "camp_study") {
      return `<div class="fr-section fr-member-camp"><div class="fr-section-h"><h3>${ICON("crown")} ${title}</h3><span class="more" data-action="memberCenter">会员权益</span></div>
        <div class="member-camp" data-action="memberCenter"><div class="member-camp-ic">${ICON("crown")}</div><div class="member-camp-txt"><h4>${esc(b.name)} 会员</h4><p>积分可抵现，营地课程优先报名</p></div><button class="member-camp-btn">领取权益</button></div></div>`;
    }
    return `<div class="fr-section"><div class="fr-section-h"><h3>${ICON("crown")} ${esc(cfg.title || "会员积分")}</h3><span class="more" data-action="memberCenter">会员权益</span></div>
      <div class="home-member" data-action="memberCenter"><div class="hm-left"><div class="hm-badge">${esc(b.logoText || "C")}</div><div class="hm-info"><div class="hm-name">${esc(b.name)} 会员</div><div class="hm-sub">积分可抵现，专享活动优先报名</div></div></div><div class="hm-go">${ICON("chevron-right")}</div></div></div>`;
  }
  function renderHomeBrand(c, tpl) {
    const cfg = c.config || {};
    const b = state.brand;
    if (tpl === "community") {
      return `<div class="fr-section fr-brand-sm" style="margin-bottom:30px"><div class="brand-sm" data-action="contactOrg">
        <div class="brand-sm-logo">${frontLogo(34, true)}</div><div class="brand-sm-txt"><h4>${esc(b.name)}</h4><p>${esc(b.intro || b.slogan || "把周末，交给山野。")}</p></div>
      </div></div>`;
    }
    if (tpl === "camp_study") {
      return `<div class="fr-section fr-brand-camp" style="margin-bottom:30px"><div class="brand-camp" data-action="contactOrg">
        <div class="brand-camp-bg"></div><div class="brand-camp-content"><h4>${esc(cfg.title || ("关于 " + b.name))}</h4><p>${esc(b.intro || b.slogan || "在自然里，找回身心平衡。")}</p><span class="brand-camp-link">联系我们 ${ICON("arrow-right")}</span></div>
      </div></div>`;
    }
    return `<div class="fr-section" style="margin-bottom:30px"><div class="brand-story" data-action="contactOrg">
      <div class="brand-story-bg"></div>
      <div class="brand-story-content"><h4>${esc(cfg.title || ("关于 " + b.name))}</h4><p>${esc(b.intro || b.slogan || "把周末，交给山野。")}</p><span class="brand-story-link">联系我们 ${ICON("arrow-right")}</span></div>
    </div></div>`;
  }
  function renderComponent(c, preview, tpl) {
    if (!c || c.hidden) return "";
    const t = tpl || homeTemplate();
    switch (c.type) {
      case "banner": return renderBanner(c, preview, t);
      case "entry": return renderEntry(c, t);
      case "activities": return renderHomeActivities(c, t);
      case "upcoming": return renderHomeUpcoming(c, t);
      case "coupon": return renderHomeCoupon(c, t);
      case "gear": return renderHomeGear(c, t);
      case "member": return renderHomeMember(c, t);
      case "brand": return renderHomeBrand(c, t);
    }
    return "";
  }

  /* ---------------- 首页（按 homeLayout 组件化渲染，v90/v91） ---------------- */
  function renderFrontHome() {
    const comps = getHomeComponents();
    const tpl = homeTemplate();
    return `<div class="front front-v16">
      <div class="front-body tpl-${tpl}" data-tpl="${tpl}">${comps.map((c) => renderComponent(c, false, tpl)).join("")}</div>
      ${frontTabbar("home")}
      ${isAdminMode() ? `<button class="fab-admin" data-action="nav" data-view="dashboard">${ICON("home")} 返回工作台</button>` : ""}
      <button class="fab-service" data-action="contactOrg" aria-label="联系俱乐部客服">${ICON("headphones")}</button>
    </div>`;
  }

  function heroImg(a) {
    const cover = a.photos && a.photos[Math.max(0, Math.min(+(a.coverIndex || 0), a.photos.length - 1))];
    if (cover) return `<img data-smart-img src="${cover}" alt="${esc(a.place || a.type)}活动图片" style="object-position:${smartPos(cover)}">`;
    return `<div class="hero-def"><span>活动主视觉待补充</span></div>`;
  }
  function heroSlide(a, idx, tpl) {
    const kicker = a.status === "full" ? "已满员" : a.pinned ? "主推活动" : "本周热门";
    const sub = a.highlights && a.highlights[0]
      ? a.highlights[0][0]
      : (a.intro ? a.intro.slice(0, 36) + (a.intro.length > 36 ? "…" : "") : "");
    const isCamp = tpl === "camp_study";
    return `<div class="hero-slide ${idx === 0 ? "active" : ""} ${isCamp ? "hero-slide-center" : ""}" data-action="openFront" data-id="${a.id}" data-idx="${idx}">
      <div class="hero-bg">${heroImg(a)}</div>
      <div class="hero-mask"></div>
      <div class="hero-foot">
        ${isCamp ? `<div class="hero-center-wrap"><span class="hero-kicker">${kicker}</span><h1 class="hero-title">${esc(a.title)}</h1>${sub ? `<p class="hero-sub">${esc(sub)}</p>` : ""}<div class="hero-cta">开启课程 ${ICON("chevron-right")}</div></div>` : `<span class="hero-kicker">${kicker}</span><h1 class="hero-title">${esc(a.title)}</h1>${sub ? `<p class="hero-sub">${esc(sub)}</p>` : ""}<div class="hero-cta">点击查看 ${ICON("chevron-right")}</div>`}
      </div>
    </div>`;
  }

  function bentoCard(a) {
    const hasPhoto = a.photos && a.photos[0];
    const img = hasPhoto ? `<img data-smart-img src="${a.photos[0]}" alt="" style="object-position:${smartPos(a.photos[0])}">` : "";
    const placeholder = hasPhoto ? "" : `<div class="gradient"><div class="img-pattern"></div></div>`;
    const tagCls = a.status === "full" ? "chip-onimg" : a.pinned ? "chip-onimg sun" : "chip-onimg brand";
    const tagTxt = a.status === "full" ? "已满员" : a.pinned ? "主推" : esc(a.type);
    const diff = (a.difficulty && !/missing/i.test(a.difficulty)) ? `<span class="chip-onimg">${esc(a.difficulty)}</span>` : (a.days > 1 ? `<span class="chip-onimg">${a.days}天${a.days - 1}晚</span>` : "");
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
    if (!sc || sc.children.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
      const base = d.price != null ? d.price : a.price;
      const myP = a.useMemberPrice ? memberPriceForTier(a, currentMemberTier()) : null;
      const price = myP != null ? myP : base;
      const disabled = d.status === "full";
      return `<label class="dep-option ${disabled ? "disabled" : ""}"><input type="radio" name="sf_departure" value="${d.id}" ${disabled ? "disabled" : (i === 0 ? "checked" : "")}>
        <span class="dep-option-body">
          <span class="dep-option-date">${esc(d.weekDay)} ${esc(formatDepartureSlash(d.date))}</span>
          <span class="dep-option-price">${price != null ? "¥" + price : "详询"}${a.useMemberPrice && currentMemberTier() ? `<small>/${esc(currentMemberTier().name)}</small>` : ""}${disabled ? " · 已满员" : ""}</span>
        </span>
      </label>`;
    }).join("")}</div></div>` : "";
    const firstDep = deps[0] || {};
    return `<div class="front">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="back">${ICON("arrow-left")} 返回</button>${psLogo(true)}</div>
      <div class="su-hero">
        <div class="su-pattern"></div>
        <div class="tiny" style="opacity:.9;position:relative;z-index:1">报名 · ${esc(a.title)}</div>
        <div style="font-size:20px;font-weight:700;margin-top:4px;position:relative;z-index:1">${(() => { const cur = currentMemberTier(); const depP = deps.length === 1 && firstDep.price != null ? firstDep.price : a.price; const myP = a.useMemberPrice ? memberPriceForTier(a, cur) : null; if (myP != null && myP !== depP) return `<b>¥${myP}</b><small>/${esc(a.limitUnit)}</small><span class="price-base">¥${depP}</span>`; return depP != null ? `<b>¥${depP}</b><small>/${esc(a.limitUnit)}</small>` : "详询"; })()}</div>
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
            <div class="mine-name">${esc(name)} <span class="mine-badge club">${esc((b && b.name) || "俱乐部")}会员</span></div>
            <div class="mine-sub">${esc((b && b.slogan) || "把周末，交给山野。")}</div>
          </div>
          <button class="mine-set" data-action="toast" data-msg="设置页开发中">${ICON("settings")}</button>
        </div>
      </div>
      <div class="front-body">
        <div class="mine-orders">
          <div class="mine-order" data-action="myOrders"><div class="mine-order-n">${pendingCount}</div><div class="mine-order-l">待付款</div></div>
          <div class="mine-order" data-action="myOrders"><div class="mine-order-n">${paidCount}</div><div class="mine-order-l">已付款</div></div>
          <div class="mine-order" data-action="myOrders"><div class="mine-order-n">${doneCount}</div><div class="mine-order-l">已完成</div></div>
          <div class="mine-order" data-action="myOrders"><div class="mine-order-n">${total}</div><div class="mine-order-l">全部</div></div>
        </div>
        <div class="fr-section" style="margin-bottom:30px">
          <div class="fr-section-h"><h3>我的报名</h3><span class="more" data-action="myOrders">全部</span></div>
          ${list.length ? list.map((s) => mineActCard(s)).join("") : '<div class="empty">还没有报名记录，去首页挑一场山野吧</div>'}
        </div>
        <div class="mine-tools">
          ${mineTool("crown", "会员权益", "memberCenter")}
          ${mineTool("list", "我的订单", "myOrders")}
          ${mineTool("headphones", "联系客服", "contactOrg")}
          ${mineTool("shopping-bag", "装备商城", "openMall")}
        </div>
      </div>
      ${frontTabbar("mine")}
      ${isAdminMode() ? `<button class="fab-admin" data-action="nav" data-view="dashboard">${ICON("home")} 返回工作台</button>` : ""}
      <button class="fab-service" data-action="contactOrg" aria-label="联系俱乐部客服">${ICON("headphones")}</button>
    </div>`;
  }

  /* ---------------- router ---------------- */
