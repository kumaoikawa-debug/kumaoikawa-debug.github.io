  // 新架构叙事区块：围绕核心传播主题，按"为什么值得去→体验→收获→适合谁"呈现
  function narrativeBlock(a, field, title, defTitle, photo) {
    const txt = (a[field] && String(a[field]).trim()) || "";
    if (!txt) return "";
    const t = (title && String(title).trim()) || defTitle;
    // 长文中间插入「数据/状态」可视化，避免纯文字用户没耐心看完；仅「为什么值得去」区块显示事实胶囊+配图
    const meter = field === "whyGo" ? difficultyMeter(a) : "";
    const facts = field === "whyGo" ? narrativeFactStrip(a) : "";
    const fig = (photo && String(photo).trim()) ? `<figure class="narr-photo"><img data-smart-img src="${esc(photo)}" alt="${esc((a.place || a.type || "") + "风景")}" style="object-position:center" onerror="this.style.display='none';var p=this.parentElement;if(p)p.style.display='none';"></figure>` : "";
    return `<section class="v13-narrative" data-narr="${esc(field)}"><h3>${esc(t)}</h3>${fig}<p>${esc(txt)}</p>${meter}${facts}</section>`;
  }
  // 难度状态条：把文字难度变成可视化进度条（轻量状态图）
  const DIFF_ORDER = ["轻松", "适中", "进阶", "挑战", "专业"];
  function difficultyMeter(a) {
    const d = (a.difficulty && !/missing/i.test(a.difficulty)) ? a.difficulty : "";
    const idx = DIFF_ORDER.indexOf(d);
    if (idx < 0) return "";
    const pct = ((idx + 1) / DIFF_ORDER.length) * 100;
    return `<div class="diff-meter"><span class="dm-k">难度</span><div class="dm-track"><i class="dm-fill" style="width:${pct}%"></i></div><b class="dm-v">${esc(d)}</b></div>`;
  }
  // 关键事实胶囊条：从活动已确认事实抽取图标化数据，穿插在长文里
  function narrativeFactStrip(a) {
    const items = [];
    if (a.distance) items.push(["activity", a.distance + "km", "里程"]);
    if (a.elevation) items.push(["mountain", a.elevation + "m", "海拔"]);
    if (a.days > 1) items.push(["calendar", a.days + "天", "行程"]);
    const s = seasonOf(a);
    if (s) items.push(["sun", s, "季节"]);
    if (!items.length) return "";
    return `<div class="narr-facts">${items.map(([ic, v, k]) => `<div class="nf"><span class="nf-ic">${ICON(ic)}</span><b class="nf-v">${esc(v)}</b><span class="nf-k">${esc(k)}</span></div>`).join("")}</div><div class="narr-facts-hint">以上数据均来自已确认活动信息</div>`;
  }
  function narrativeFitBlock(a) {
    const fit = (a.fitFor && String(a.fitFor).trim()) || "";
    const unfit = (a.notFitFor && String(a.notFitFor).trim()) || "";
    if (!fit && !unfit) return "";
    return `<section class="v13-narrative fit" data-narr="fit"><h3>适合谁</h3>`
      + (fit ? `<p class="fit-yes">${esc(fit)}</p>` : "")
      + (unfit ? `<p class="fit-no">${esc(unfit)}</p>` : "")
      + `</section>`;
  }

  function renderActivityPhone(a) {
    if (!a) return "";
    const ac = styleAccent(a);
    const coverIdx = Math.max(0, Math.min(+(a.coverIndex || 0), Math.max(0, (a.photos || []).length - 1)));
    const coverSrc = (a.photos || [])[coverIdx];
    const hasPhoto = !!coverSrc;
    const composition = pageComposition(a);
    const fee = a.feeInclude || [];
    const isFamily = isFamilyActivity(a);
    const priceTxt = a.price ? `¥${a.price}<small>/${a.limitUnit}</small>` : "详询";
    const routeDifficultyConflict = a.difficulty === "轻松" && ((+a.distance >= 10) || (+a.elevation >= 800 && a.type !== "高海拔登山"));

    // 保障项：依据 AI 真实勾选生成，可能为空（下方已守卫）
    const guaranIcons = {
      "专业领队": "user-check", "活动保险": "shield", "小团控量": "users",
      "应急保障": "life-buoy", "正规机构": "award", "安全装备": "tool",
      "食宿安排": "coffee", "摄影跟拍": "camera", "交通接驳": "truck"
    };
    const guaran = [];
    const servicesConfirmed = confirmedFacts(a).some((f) => f.key === "services");
    if (servicesConfirmed && a.includeLeader) guaran.push("专业领队");
    if (servicesConfirmed && a.includeInsurance) guaran.push("活动保险");
    if (servicesConfirmed && a.includeGear) guaran.push("活动装备");
    if (servicesConfirmed && a.includeTransport) guaran.push("交通接驳");
    if (servicesConfirmed && a.includeMeal) guaran.push("餐食");

    // —— AI 生成内容守卫：避免空数组渲染出空白区块 ——
    const core = coreTags(a).filter(Boolean);                  // 可能 0 个
    const hl = (a.highlights || []).map((h) => {
      if (Array.isArray(h)) return [String(h[0] || ""), String(h[1] || "star")];
      if (h && typeof h === "object") return [String(h.text || h.title || ""), String(h.icon || "star")];
      return [String(h || ""), "star"];
    }).filter((x) => x && x[0]);
    const introTxt = (a.intro && String(a.intro).trim())
      ? a.intro
      : "活动介绍将在事实确认后生成。";

    const blocks = {
      timeline: `<div class="dsec itinerary-editorial"><div class="dsec-h"><h3>详细行程${a.days > 1 ? ` · 共 ${a.days} 天` : ""}</h3></div>${(a.itineraryDays || []).map((day, idx) => { const items = (day.items || []).filter((t) => t && (t.time || t.text)); return `<details class="day-block"><summary class="day-header-sz"><div class="day-no"><span>DAY</span><b>${idx + 1}</b></div><div class="day-route-block"><p class="day-route">${esc(day.label)}</p>${day.sub ? `<p class="day-subtitle">${esc(day.sub)}</p>` : ""}</div><span class="day-expand">${ICON("chevron-down")}</span></summary><div class="day-body">${items.length ? `<div class="timeline">${items.map((t) => `<div class="tl-item"><div class="tl-node"></div><div class="t">${esc(t.time)}</div><div class="d">${esc(t.text)}</div></div>`).join("")}</div>` : `<div class="tl-empty">本日行程待机构补充。</div>`}</div></details>`; }).join("") || `<div class="pending-section"><b>真实行程待补充</b><span>补充后才会进入客户页面和发布检查。</span></div>`}</div>`,
      highlights: hl.length ? `<div class="dsec"><div class="dsec-h"><h3>为什么值得参加</h3></div>${hl.map((h) => `<div class="hl"><div class="ic">${ICON(h[1] || "star")}</div><div class="txt">${esc(h[0])}</div></div>`).join("")}</div>` : "",
      gear: (() => {
        const gm = matchGearProducts(a);
        return `<div class="dsec"><div class="dsec-h"><h3>装备建议</h3></div><div class="gear-list">${gearRender(a, true, gm.gearProduct)}${gearRender(a, false, gm.gearProduct)}</div></div>`;
      })(),
      org: `<div class="dsec"><div class="dsec-h"><h3>关于${esc(state.brand.name)}</h3></div><div class="org-block">${orgLogo()}<div><div style="font-weight:700">${esc(state.brand.name)}</div>${(isFamily || !/亲子|孩子|儿童|少年/.test(state.brand.intro || "")) && state.brand.intro ? `<div class="tiny muted" style="margin:3px 0;line-height:1.6">${esc(state.brand.intro)}</div>` : ""}<div class="tiny muted">客服微信：${esc(state.brand.wechat)} · ${esc(state.brand.phone)}</div></div></div></div>`,
      fee: `<div class="dsec decision-fee" id="sec-notes"><div class="dsec-h"><h3>费用说明</h3></div><div class="fee-card">
        <div class="fee-hero">
          <div class="fee-hero-l"><span class="fee-hero-k">活动价格</span><b class="fee-hero-v">${a.price ? "¥" + a.price : "详询"}</b>${a.price ? `<span class="fee-hero-u">/ ${esc(a.limitUnit)}</span>` : ""}</div>
          ${a.useMemberPrice && memberPriceRange(a) ? `<span class="fee-hero-mem">${esc(formatMemberPriceNote(a))}</span>` : ""}
        </div>
        ${fee.length ? `<div class="fee-sec"><div class="fee-sec-h"><span class="fee-sec-ic ok">${ICON("check")}</span>费用包含</div><div class="fee-grid">${fee.map((f)=>`<div class="fee-cell"><span class="fee-cell-ic">${ICON("check")}</span><span>${esc(f)}</span></div>`).join("")}</div></div>` : ""}
        ${(a.feeExclude||[]).length ? `<div class="fee-sec"><div class="fee-sec-h"><span class="fee-sec-ic no">${ICON("x")}</span>费用不含</div><div class="fee-grid">${(a.feeExclude||[]).map((f)=>`<div class="fee-cell fee-cell-no"><span class="fee-cell-ic no">${ICON("x")}</span><span>${esc(f)}</span></div>`).join("")}</div></div>` : ""}
        ${a.feeSummary ? `<div class="fee-note">${ICON("clipboard")}<span>${esc(a.feeSummary)}</span></div>` : ""}
      </div></div>`,
    };
    // V2.0：按编排结果渲染；图片索引由编排层分配，同一张图不会重复填满多个模块
    function imgBlock(idxs, cls, caption) {
      const list = (idxs || []).filter((i) => a.photos && a.photos[i]);
      if (!list.length) return "";
      const cap = (caption && String(caption).trim()) ? String(caption).trim() : "";
      return `<figure class="v2-img ${cls}"><div class="v2-img-wrap">${list.map((i) => mediaBlock(a, i, "")).join("")}</div>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
    }
    const servicesBlock = guaran.length
      ? `<div class="dsec"><div class="dsec-h"><h3>已确认服务</h3></div><div class="service-chips">${guaran.map((g)=>`<div class="service-chip"><span class="sc-ic">${ICON(guaranIcons[g] || "check")}</span><span>${esc(g)}</span></div>`).join("")}</div></div>`
      : "";
    const renderBlock = (b) => {
      switch (b.type) {
        case "editorial_lead": {
          const title = editorialSectionTitle(a);
          const hookTxt = (a.hook && a.hook.trim()) ? `<p class="story-hook">${esc(a.hook.trim())}</p>` : "";
          const introParas = introTxt.split(/\n+/).map((p) => p.trim()).filter(Boolean);
          if (!title && !hookTxt && !introParas.length) return "";
          return `<section class="v13-story" id="sec-story">${title ? `<h3>${esc(title)}</h3>` : ""}${hookTxt}${introParas.map((p)=>`<p>${esc(p)}</p>`).join("")}</section>`;
        }
        case "gallery": return imgBlock(b.photos, b.cls || "v2-full", b.caption || "");
        case "full_image": return imgBlock(b.photos, "v2-full", b.caption || "");
        case "story_section": return imgBlock(b.photos, "v2-single", b.caption || "");
        case "image_pair": return imgBlock(b.photos, "v2-pair", b.caption || "");
        case "image_sequence": return imgBlock(b.photos, "v2-seq", b.caption || "");
        case "text_block": {
          const pt = (a.body && a.body[b.para]) ? String(a.body[b.para]).trim() : "";
          if (!pt) return "";
          return `<p class="v13-flow">${esc(pt)}</p>`;
        }
        case "pull_quote": return blockAtmosphere(a, (a.pullQuote && String(a.pullQuote).trim()) || ((a.contentStrategy && a.contentStrategy.poster_line) ? a.contentStrategy.poster_line : a.headline));
        // 新架构：消费者价值叙事（围绕核心传播主题，先于卖点与决策信息）
        case "narrative_why": return narrativeBlock(a, "whyGo", a.sectionTitles && a.sectionTitles.whyGo, "为什么值得去", a.whyGoPhoto);
        case "narrative_experience": return narrativeBlock(a, "experience", a.sectionTitles && a.sectionTitles.experience, "来了会体验什么");
        case "narrative_gain": return narrativeBlock(a, "gain", a.sectionTitles && a.sectionTitles.gain, "参加完你能得到什么");
        case "narrative_fit": return narrativeFitBlock(a);
        case "metric_strip": return blockStats(a);
        case "suitability": return blockSuitability(a);
        case "route_story": return blockRoute(a);
        case "itinerary": return blocks.timeline;
        case "services": return servicesBlock;
        case "gear": return blocks.gear;
        case "video": return blockVideo(a);
        case "reviews": return blockReviews(a);
        case "leader_safety": return blockLeader(a);
        // highlights 与 lead-sheet 的「亮点」bullets 用的是同一份 a.highlights 数据，
        // 顶部已展示过，这里再渲染一次会重复。返回空串即被 outlineBlocks 过滤掉。
        case "highlights": return "";
        case "selling_points": return sellingHtml;
        case "travel_notes": return pipelineNotesHtml(a);
        case "fee": return blocks.fee;
        default: return "";
      }
    };

    // 产品亮点先算一次。亮点 bullets 与产品亮点卡片常常指向同一批卖点
    // （AI 未返回卖点时 pipeline 还会直接回退用 highlights），两处都渲染就是重复内容。
    // 规则：卡片内容更完整，始终保留；bullets 只显示没被卡片覆盖掉的亮点。
    const sellingHtml = pipelineSellingHtml(a);
    let leadHl = hl;
    if (sellingHtml) {
      const spTitles = ((a.pipeline && a.pipeline.sellingPoints) || []).map((s) => s && s.title).filter(Boolean);
      leadHl = hl.filter((h) => !spTitles.some((t) => isSameCopy(h[0], t)));
    }

    // V2.2：按信息类型分组，配合顶部 Tab 导航
    const outlineBlocks = buildPageOutline(a).map((b) => ({ ...b, html: renderBlock(b) })).filter((b) => b.html);
    const groups = { highlights: [], story: [], itinerary: [], notes: [], org: [] };
    outlineBlocks.forEach((b) => {
      if (b.type === "selling_points") groups.highlights.push(b.html);
      else if (["itinerary", "services", "gear", "leader_safety"].includes(b.type)) groups.itinerary.push(b.html);
      else if (["fee", "travel_notes", "suitability"].includes(b.type)) groups.notes.push(b.html);
      else if (b.type === "org") groups.org.push(b.html);
      else groups.story.push(b.html);
    });

    return `
      <div class="activity-page composition-${composition}">
      <div class="ps-topbar">${psLogo()}</div>
      <div class="cover type-${a.pageStyle} composition-${composition}" style="${hasPhoto ? "" : `background:${ac.grad}`}">
        ${hasPhoto ? `<img class="cover-img" data-smart-img src="${coverSrc}" alt="${esc(a.place || a.type)}活动主视觉" style="object-position:${smartPos(coverSrc)}">` : `<div class="cover-pattern"></div><div class="cover-missing">${isAdminMode() ? "待上传主视觉" : "活动图片待机构补充"}</div>`}
        <div class="scrim"></div>
        <button class="fav" data-action="toast" data-msg="已收藏" aria-label="收藏活动">${ICON("heart")}</button>
        <div class="ct">
          <div class="cover-context">${esc(a.type)}${a.distance ? ` / ${a.distance}公里` : ""}${a.elevation ? ` / ${a.elevation}米` : ""}</div>
          <h2 class="cover-title">${esc(a.title)}</h2>
          <div class="cover-meta-pill"><span>${ICON("calendar")} ${esc(a.date || a.dateMD || "日期待定")}</span><span class="meta-div"></span><span>${ICON("map-pin")} ${esc(a.meeting || "集合点待定")}</span></div>
        </div>
      </div>

      <div class="detail-body composition-${composition}">
        <div class="lead-sheet">
          ${a.pullQuote ? `<div class="quote-card"><span class="quote-mark">“</span><p>${esc(a.pullQuote)}</p></div>` : ""}
          <div class="lead-tags">
            <span class="lead-tag-primary">${ICON("map-pin")}${esc(a.type)}</span>
            ${core.map((t) => `<span class="lead-tag-secondary">${esc(t)}</span>`).join("")}
          </div>
          <h1 class="lead-title">${esc(a.title)}</h1>
          ${a.posterTagline || a.hook ? `<p class="lead-subtitle">${esc(a.posterTagline || a.hook)}</p>` : ""}
          <div class="lead-quick-meta">
            <div class="lqm-item"><span class="lqm-ic">${ICON("calendar")}</span><div><span class="lqm-k">时间</span><span class="lqm-v">${esc(a.dateMD || a.date || "待定")}</span></div></div>
            <div class="lqm-item"><span class="lqm-ic">${ICON("map-pin")}</span><div><span class="lqm-k">集合</span><span class="lqm-v">${esc(a.meeting || "待定")}</span></div></div>
            <div class="lqm-item"><span class="lqm-ic">${ICON("activity")}</span><div><span class="lqm-k">强度</span><span class="lqm-v">${esc(routeDifficultyConflict ? "待机构确认" : ((a.difficulty && !/missing/i.test(a.difficulty)) ? a.difficulty : "待确认"))}</span></div></div>
          </div>
          ${leadHl.length ? `<div class="lead-highlights">${leadHl.map((h) => `<div class="lhl"><span class="lhl-dot"></span><span>${esc(h[0])}</span></div>`).join("")}</div>` : ""}
          <div class="lead-price-card">
            <div class="lead-price-main">${a.price ? `<b>¥${a.price}</b><small>/${esc(a.limitUnit)}</small>` : `<b>详询</b>`}${a.useMemberPrice && memberPriceRange(a) ? `<span class="lead-price-tag">${esc(formatMemberPriceNote(a))}</span>` : ""}</div>
            <div class="lead-price-note">${a.days > 1 ? `${a.days} 天 · ` : ""}${a.limit ? `限 ${a.limit}${esc(a.limitUnit)}` : "名额不限"}</div>
          </div>
        </div>

        ${departuresBlockHtml(a)}

        <div class="section-tabs">
          ${groups.highlights.length ? `<a href="#sec-highlights" class="stab active">亮点</a>` : ""}
          ${groups.story.length ? `<a href="#sec-story" class="stab">详情</a>` : ""}
          ${groups.itinerary.length ? `<a href="#sec-itinerary" class="stab">行程</a>` : ""}
          ${groups.notes.length ? `<a href="#sec-notes" class="stab">须知</a>` : ""}
        </div>

        ${groups.highlights.length ? `<div class="sec-panel">${groups.highlights.join("\n")}</div>` : ""}
        ${groups.story.length ? `<div class="sec-panel">${groups.story.join("\n")}</div>` : ""}
        ${groups.itinerary.length ? `<div class="sec-panel">${groups.itinerary.join("\n")}</div>` : ""}
        ${groups.notes.length ? `<div class="sec-panel">${groups.notes.join("\n")}</div>` : ""}

        ${groups.org.length ? groups.org.join("\n") : ""}

        ${(() => { const gm = matchGearProducts(a); return gm.matchedIds.length ? `<section class="after-signup-shop"><div><span>报名后的装备服务</span><h3>需要补装备，再去商城看看</h3><p>活动信息先帮助你决定是否参加；商城只作为出发前的补充服务。</p></div><button class="btn btn-soft btn-sm" data-action="nav" data-view="mall">查看匹配装备 ${ICON("arrow-right")}</button></section>` : ""; })()}
      </div>

      ${!isAdminMode() ? `<div class="invite-card"><div class="invite-ic">${ICON("users")}</div><div class="invite-txt"><b>邀好友一起玩</b><span>生成专属海报，分享到微信 / 朋友圈，呼朋唤伴出发</span></div><button class="btn btn-primary btn-sm" data-action="shareFront" data-id="${a.id}">${ICON("share")} 生成海报</button></div>` : ""}

      <div class="bottom-bar">
        <div class="price">${priceTxt}</div>
        <div class="bottom-actions">
          ${isAdminMode() ? `<button class="btn btn-soft btn-sm" data-action="share" data-id="${a.id}">${ICON("share")} 分享</button>` : ""}
          <button class="btn btn-ghost btn-sm" data-action="contactOrg">${ICON("message")} 咨询</button>
          <button class="btn btn-primary" data-action="openSignup" data-id="${a.id}">立即报名</button>
        </div>
      </div></div>`;
  }

  function wrapPhone(inner, withBack) {
    return `<div style="min-height:100vh;background:var(--bg);padding:18px 0 40px">
      ${withBack ? `<div style="max-width:480px;margin:0 auto;padding:0 16px"><button class="btn btn-ghost btn-sm" data-action="back">${ICON("arrow-left")} 返回</button></div>` : ""}
      <div class="phone"><div class="phone-notch"></div><div class="phone-screen" id="previewScreen">${inner}</div></div>
    </div>`;
  }

  /* ---------------- backend shell ---------------- */
  function navItem(view, label, icon, active) {
    return `<button class="nav-item ${active === view ? "active" : ""}" data-action="nav" data-view="${view}">
      <span class="ic">${ICON(icon)}</span>${label}</button>`;
  }
  function renderShell(content, active) {
    const b = state.brand;
    return `<div class="shell">
      <aside class="sidebar">
        <div class="brand-mark">
          ${brandMark()}
          <div><div class="brand-name">${esc(b.name)}</div><div class="brand-sub">ClubOS 工作台</div></div>
        </div>
        <div class="nav-group-label">内容发布</div>
        ${navItem("dashboard", "工作台", "home", active)}
        ${navItem("create", "AI 创建活动", "sparkles", active)}
        ${navItem("list", "活动内容", "list", active)}
        ${navItem("operator", "AI 宣发", "send", active)}
        <div class="nav-group-label">用户经营</div>
        ${navItem("customers", "客户管理", "users", active)}
        ${navItem("membershipAdmin", "会员与积分", "crown", active)}
        <div class="nav-group-label">商业增长</div>
        ${navItem("mallConsole", "商城收益", "shopping-bag", active)}
        ${navItem("analytics", "运营分析", "bar-chart", active)}
        <div class="nav-group-label">系统</div>
        ${navItem("settings", "设置", "settings", active)}
        <div class="sidebar-foot">
          <div class="card">
            <div class="tiny muted">机构主页已上线</div>
            <div class="small" style="margin:4px 0 10px">把专业活动页发给客户 👇</div>
            <button class="btn btn-soft btn-sm btn-block" data-action="openFrontHome">查看机构主页</button>
          </div>
        </div>
      </aside>
      <main class="content" id="content">${content}</main>
    </div>`;
  }

  /* ---------------- 平台运营总后台（V2.0 平台视角） ----------------
     平台统一运营：入驻审核 / 全俱乐部 / 商城运营 / 全局数据 / 分账结算。
     与俱乐部后台（renderShell）并列，左侧独立导航。 */
  const PLATFORM_CLUBS = [
    { id: "club_yeshan", name: "野山户外", region: "成都", contact: "王队", phone: "13800001111", appliedAt: "2026-08-28", status: "pending" },
    { id: "club_fengxing", name: "峰行户外", region: "杭州", contact: "李工", phone: "13800002222", appliedAt: "2026-08-30", status: "pending" },
    { id: "club_xipan", name: "溪畔营地", region: "莫干山", contact: "周姐", phone: "13800003333", appliedAt: "2026-08-25", status: "approved" },
    { id: "club_yandian", name: "岩点攀岩", region: "上海", contact: "陈教练", phone: "13800004444", appliedAt: "2026-08-20", status: "approved" },
    { id: "club_tongxing", name: "童行研学", region: "北京", contact: "赵老师", phone: "13800005555", appliedAt: "2026-08-18", status: "rejected" }
  ];
  function isPlatformView(v) { return ["platformAudit", "platformClubs", "platformToken", "platformMall", "platformData", "platformSettle"].includes(v); }

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

  /* ---------------- 工作台 / 运营助手 / 客户 / 设置（V1.0 收口版） ---------------- */
  function daysLeftOf(a) {
    if (a.daysLeft != null) return a.daysLeft;
    const ds = a.dateText || a.dateMD || a.date || "";
    const m = String(ds).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/) || String(ds).match(/(\d{1,2})[-/](\d{1,2})/);
    if (m) {
      const y = m[1].length === 4 ? +m[1] : new Date().getFullYear();
      const mo = +m[2], da = +m[3];
      const target = new Date(y, mo - 1, da);
      return Math.round((target - new Date()) / 86400000);
    }
    return null;
  }
  // 根据活动状态 / 距离天数 / 报名进度，自动生成运营任务（工作台与运营助手共用）
  function buildActivityTasks() {
    const tasks = [];
    (state.activities || []).forEach((a) => {
      const days = daysLeftOf(a);
      const limit = a.limit || 0;
      const sign = a.signups || 0;
      const ratio = limit ? sign / limit : 0;
      if (a.status === "recruiting") {
        if (sign === 0) tasks.push({ a, kind: "recruit1", badge: "刚发布", tip: "活动刚发布，建议进行第一轮正式招募。", btn: "生成宣传内容", channels: "wechat,moments,xhs" });
        else if (ratio >= 0.9) tasks.push({ a, kind: "last", badge: "仅剩少量名额", tip: `还剩 ${Math.max(0, limit - sign)} 个名额，可以进行最后一次招募。`, btn: "生成最后招募", channels: "wechat,moments,xhs" });
        else if (ratio >= 0.5) tasks.push({ a, kind: "half", badge: "报名过半", tip: "报名已超过一半，可发布「已成团」内容增强信任。", btn: "生成已成团宣传", channels: "moments,wechat" });
        else tasks.push({ a, kind: "recruit2", badge: "招募中", tip: "可继续第二、三轮宣传扩散。", btn: "生成宣传内容", channels: "wechat,moments" });
        if (days != null && days <= 3 && days > 1) tasks.push({ a, kind: "equip", badge: `出发前 ${days} 天`, tip: "即将出发，可提醒用户准备装备。", btn: "生成行前装备提醒", channels: "wechat" });
        else if (days != null && days === 1) tasks.push({ a, kind: "gather", badge: "明天出发", tip: "建议发送集合提醒（时间 / 地点 / 装备 / 天气）。", btn: "生成集合提醒", channels: "wechat,voice" });
      } else if (a.status === "ended") {
        tasks.push({ a, kind: "review", badge: "已结束", tip: "可上传照片并生成活动回顾，顺带预告下期活动。", btn: "生成活动回顾", channels: "moments,xhs,gzh" });
      }
    });
    return tasks;
  }
  function fallbackShareCopy(a, ch) {
    const name = a.title || "活动";
    const when = a.dateText || a.dateMD || a.date || "待定";
    const base = {
      wechat: `【${name}】${when} 出发，名额有限，欢迎报名参加～ 详情私聊或群里接龙。`,
      moments: `周末就去 ${name} 啦 🌿 还有少量名额，想一起的快来私信我。`,
      xhs: `#户外 #周末去哪儿 ${name} 招募中｜${when} 出发，详情私聊或群里接龙报名～`,
      gzh: `${name} 将于 ${when} 出发。本文介绍线路亮点、装备与注意事项，欢迎阅读并报名。`,
      voice: `大家好，这周末咱们去 ${name}，现在还有名额，想一起的朋友私信我报名哈。`
    };
    return base[ch] || name;
  }
  // 从报名记录派生客户（轻量 CRM，V1.0 不发展复杂 CRM）
  const C_GENDER_POOL = ["男", "女", "未知"];
  const C_DIST_NAMES = ["无", "李导", "王领队", "小野妈", "阿强", "徒步老张"];
  const C_VERSION = "7.7.7";

  function deriveCustomers() {
    const map = {};
    (state.signups || []).forEach((s, idx) => {
      const k = s.phone || s.name || uid();
      if (!map[k]) {
        const seed = k.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) + idx;
        const rng = (n) => ((seed * 9301 + 49297 * n) % 233280) / 233280;
        const genderIdx = Math.floor(rng(1) * C_GENDER_POOL.length);
        const distIdx = Math.floor(rng(2) * C_DIST_NAMES.length);
        const hasBirth = rng(3) > 0.35;
        const birthMonth = 1 + Math.floor(rng(4) * 12);
        const birthDay = 1 + Math.floor(rng(5) * 28);
        const regOffsetDays = Math.floor(rng(6) * 365 * 2) + 30;
        const registeredAt = Date.now() - regOffsetDays * 86400000;
        const balance = Math.floor(rng(7) * 500);
        const monthSpent = Math.floor(rng(8) * 800);
        const stampCount = Math.floor(rng(9) * 12);
        const member = rng(10) > 0.55;
        const memberExpired = member ? `${new Date(Date.now() + 180 * 86400000).getFullYear()}-06-30` : "非会员";
        const tier = member ? (balance > 300 ? "金卡" : balance > 100 ? "银卡" : "普通") : "—";
        map[k] = {
          id: "u" + ((Date.now() % 1000000000) + Math.floor(rng(11) * 100000)).toString().slice(0, 9),
          name: s.name || "—",
          phone: s.phone || "—",
          avatar: "",
          nickname: s.name ? s.name.replace(/^(.)先生|^(.)女士/, "$1") : "用户" + Math.floor(rng(12) * 9999),
          gender: C_GENDER_POOL[genderIdx],
          balance: balance,
          points: 0,
          birthday: hasBirth ? `${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}` : "",
          member: member,
          memberExpired: memberExpired,
          memberTier: tier,
          status: "正常",
          parentDistributor: C_DIST_NAMES[distIdx],
          totalSpent: 0,
          monthSpent: monthSpent,
          stampCount: stampCount,
          registeredAt: registeredAt,
          version: C_VERSION,
          banned: false,
          acts: new Set(),
          total: 0,
          last: 0,
          tags: new Set()
        };
      }
      const c = map[k];
      c.name = s.name || c.name; c.phone = s.phone || c.phone;
      c.acts.add(s.activityId);
      if (s.createdAt && s.createdAt > c.last) c.last = s.createdAt;
      const a = getActivity(s.activityId);
      if (a && a.price) c.total += (a.price || 0) * ((s.adults || 1) + (s.children || 0));
      if (a) {
        const t = (a.type || "") + (a.title || "");
        if (/亲子|露营|研学|儿童/.test(t)) c.tags.add("亲子客户");
        if (/徒步|登山|重装|雪山/.test(t)) c.tags.add("徒步客户");
      }
    });
    const now = Date.now(), DAY = 86400000;
    return Object.values(map).map((c) => {
      c.count = c.acts.size; delete c.acts;
      c.inactiveDays = c.last ? Math.round((now - c.last) / DAY) : null;
      if (c.inactiveDays != null && c.inactiveDays >= 90) c.tags.add("90天未参加");
      else if (c.inactiveDays != null && c.inactiveDays >= 60) c.tags.add("60天未参加");
      if (c.count >= 3) c.tags.add("高频用户");
      c.points = c.count * 100 + Math.round((c.total || 0) / 10);
      c.totalSpent = Math.round(c.total || 0);
      c.member = c.member || c.count >= 2 || c.points >= 500;
      if (c.member && c.memberExpired === "非会员") c.memberExpired = `${new Date(Date.now() + 180 * 86400000).getFullYear()}-06-30`;
      c.memberTier = c.member ? (c.points >= 2000 ? "黑卡" : c.points >= 500 ? "金卡" : c.points >= 100 ? "银卡" : "普通") : "—";
      return c;
    });
  }
function channelMeta(ch) {
    return ({ wechat: { name: "微信群", icon: "message" }, moments: { name: "朋友圈", icon: "share" }, xhs: { name: "小红书", icon: "camera" }, gzh: { name: "公众号", icon: "book" }, voice: { name: "口播", icon: "mic" } })[ch] || { name: ch, icon: "message" };
  }
  function currentOpCopies(aid) {
    return (state._opCopies && state._opCopies[aid]) || {};
  }
  function getOpCopyBatches(aid) {
    state._opCopyBatches = state._opCopyBatches || {};
    state._opCopyBatchIdx = state._opCopyBatchIdx || {};
    // migrate old flat _opCopies into batch 0
    if (state._opCopies && state._opCopies[aid] && !state._opCopyBatches[aid]) {
      const cur = state._opCopies[aid];
      if (cur && typeof cur === "object" && !Array.isArray(cur)) {
        state._opCopyBatches[aid] = [{ copies: JSON.parse(JSON.stringify(cur)), at: Date.now() }];
        state._opCopyBatchIdx[aid] = 0;
      }
    }
    return state._opCopyBatches[aid] || [];
  }
  function renderOpCopies(aid) {
    const copies = currentOpCopies(aid);
    const keys = Object.keys(copies);
    if (!keys.length) return "";
    const batches = getOpCopyBatches(aid);
    const idx = (state._opCopyBatchIdx || {})[aid] || 0;
    const hasPrev = idx > 0;
    const hasNext = idx < batches.length - 1;
    return `<div class="op-copy-suite">
      <div class="op-copy-batch-bar">
        <div class="op-copy-batch-info">第 ${idx + 1} 批文案 · 共 ${batches.length || 1} 批</div>
        <div class="op-copy-batch-actions">
          <button class="btn btn-ghost btn-xs" data-action="opCopyPrevBatch" data-aid="${aid}" ${!hasPrev ? "disabled" : ""}>${ICON("chevron-left")} 上一批</button>
          <button class="btn btn-soft btn-xs" data-action="opCopyNextBatch" data-aid="${aid}">${ICON("refresh")} 换一批</button>
          ${hasNext ? `<button class="btn btn-ghost btn-xs" data-action="opCopyNextBatch" data-aid="${aid}" data-dir="1">下一批 ${ICON("chevron-right")}</button>` : ""}
        </div>
      </div>
      <div class="op-copy-grid">
        ${keys.map((ch) => {
          const meta = channelMeta(ch);
          return `<div class="op-copy-card">
            <div class="op-copy-card-h">
              <span class="op-copy-channel">${ICON(meta.icon)} ${esc(meta.name)}</span>
              <button class="btn btn-ghost btn-xs" data-action="copyText" data-text="${esc(copies[ch])}">${ICON("copy")} 复制</button>
            </div>
            <div class="op-copy-card-body">${esc(copies[ch])}</div>
            <div class="op-copy-card-f">
              <button class="btn btn-ghost btn-xs" data-action="opCopyRegenerate" data-aid="${aid}" data-channel="${ch}">${ICON("refresh")} 重新生成</button>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }

  function renderDashboard() {
    const totalSign = state.signups.length + state.activities.reduce((s, a) => s + (a.signups || 0), 0);
    const tasks = buildActivityTasks();
    const customers = deriveCustomers();
    const inactive = customers.filter((c) => c.inactiveDays != null && c.inactiveDays >= 60).length;
    const cs = commissionSummary();
    const mallSales = state.mallSalesMonth || 0;
    return `
      <div class="hero hero-task">
        <div class="slogan-en">ClubOS 运营助手</div>
        <h1>${esc(state.brand.name)}，今天该做什么？</h1>
        <p>ClubOS 已经帮你把待办列好了，点开任意一项就能生成宣传 / 提醒 / 回顾内容。</p>
        <div class="create-box compact">
          <textarea id="createInput" placeholder="一句话创建新活动，例如：本周六赵公山轻装徒步，168 元/人，限 25 人……"></textarea>
          <div class="create-actions">
            <button class="btn btn-accent" data-action="generate">${ICON("sparkles")} AI 生成活动</button>
            <button class="btn btn-ghost" data-action="nav" data-view="create">${ICON("pencil")} 完整创建</button>
          </div>
        </div>
      </div>

      <div class="section-head"><div class="section-title">今日运营任务</div><span class="muted small">${tasks.length} 项待处理</span></div>
      ${tasks.length ? `<div class="op-tasks">${tasks.slice(0, 6).map((t) => `
        <div class="op-task">
          <div class="op-task-l">
            <span class="op-badge">${esc(t.badge)}</span>
            <div><div class="op-task-title">${esc(t.a.title)}</div><div class="op-task-tip">${esc(t.tip)}</div></div>
          </div>
          <div class="op-task-r">
            <button class="btn btn-primary btn-sm" data-action="opGen" data-id="${t.a.id}" data-channels="${t.channels}">${ICON("sparkles")} ${esc(t.btn)}</button>
            <button class="btn btn-ghost btn-sm" data-action="nav" data-view="operator">${ICON("chevron-right")}</button>
          </div>
          ${renderOpCopies(t.a.id)}
        </div>`).join("")}</div>` : `<div class="empty"><div class="e-ic">✅</div><div>暂时没有待处理的运营任务，去「运营助手」看看老客户召回吧。</div></div>`}

      <div class="dash-mini">
        <div class="dash-mini-card" data-action="nav" data-view="customers" style="cursor:pointer">
          <div class="dm-num">${inactive}</div><div class="dm-lbl">${inactive ? "名老客户 60 天未参加" : "客户活跃良好"}</div>
          <div class="dm-act">${inactive ? "AI 生成召回邀请" : "查看客户"} ${ICON("chevron-right")}</div>
        </div>
        <div class="dash-mini-card" data-action="nav" data-view="mallConsole" style="cursor:pointer">
          <div class="dm-num">¥${Math.round(mallSales).toLocaleString()}</div><div class="dm-lbl">本月装备销售</div>
          <div class="dm-act">预计佣金 ¥${Math.round(cs.pending + cs.frozen + cs.available).toLocaleString()} ${ICON("chevron-right")}</div>
        </div>
        <div class="dash-mini-card" data-action="nav" data-view="list" style="cursor:pointer">
          <div class="dm-num">${state.activities.filter((a) => a.status === "recruiting").length}</div><div class="dm-lbl">招募中活动</div>
          <div class="dm-act">管理报名 ${ICON("chevron-right")}</div>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat"><div class="num">${totalSign}</div><div class="lbl">累计报名人数</div></div>
        <div class="stat"><div class="num">${customers.length}</div><div class="lbl">沉淀客户</div></div>
        <div class="stat"><div class="num">¥${Math.round(cs.settled).toLocaleString()}</div><div class="lbl">已结算佣金</div></div>
      </div>

      <div class="row between" style="margin-top:6px">
        <span class="muted small">需要更深的经营数据？</span>
        <button class="btn btn-soft btn-sm" data-action="nav" data-view="analytics">${ICON("bar-chart")} 查看完整经营数据</button>
      </div>
    `;
  }

  // P1 修复：客户行复选框选中集合（跨重渲染持久，不写入 state 以免序列化异常）
  let _clubosCustSel = new Set();

  function renderCustomers() {
    const all = deriveCustomers();
    const tab = state.customerTab || "list";
    const search = (state.customerSearch || "").trim().toLowerCase();
    const memberFilter = state.customerMemberFilter || "all";
    const phoneFilter = state.customerPhoneFilter || "all";
    const start = state.customerStartDate || "";
    const end = state.customerEndDate || "";

    let list = all.filter((c) => {
      if (search && !(`${c.name} ${c.phone} ${c.nickname} ${c.id}`).toLowerCase().includes(search)) return false;
      if (memberFilter === "member" && !c.member) return false;
      if (memberFilter === "nonmember" && c.member) return false;
      if (phoneFilter === "bound" && (!c.phone || c.phone === "—")) return false;
      if (phoneFilter === "unbound" && c.phone && c.phone !== "—") return false;
      if (start && c.registeredAt < new Date(start + "T00:00:00").getTime()) return false;
      if (end && c.registeredAt > new Date(end + "T23:59:59").getTime()) return false;
      return true;
    });

    const totalUsers = all.length;
    const totalMembers = all.filter((c) => c.member).length;
    const totalBalance = all.reduce((s, c) => s + (c.balance || 0), 0);
    const totalPoints = all.reduce((s, c) => s + (c.points || 0), 0);

    const genderCounts = { "男": 0, "女": 0, "未知": 0 };
    const orderCounts = { ordered: 0, notOrdered: 0 };
    const memberCounts = { member: 0, nonMember: 0 };
    const rechargeCounts = { recharged: 0, notRecharged: 0 };
    all.forEach((c) => {
      genderCounts[c.gender || "未知"]++;
      if ((c.totalSpent || 0) > 0) orderCounts.ordered++; else orderCounts.notOrdered++;
      if (c.member) memberCounts.member++; else memberCounts.nonMember++;
      if ((c.balance || 0) > 0) rechargeCounts.recharged++; else rechargeCounts.notRecharged++;
    });

    const inactive = all.filter((c) => c.inactiveDays != null && c.inactiveDays >= 60);
    const parentTags = (seg) => all.filter((c) => c.tags.has(seg)).length;

    function pie(label, data, colors) {
      const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;
      let acc = 0;
      const segs = Object.entries(data).map(([k, v], i) => {
        const pct = (v / total * 100).toFixed(1);
        const start = (acc / total * 360).toFixed(2);
        acc += v;
        const end = (acc / total * 360).toFixed(2);
        const mid = ((+start + +end) / 2);
        const r = 15.9155;
        const rad = (mid - 90) * Math.PI / 180;
        const tx = 16 + 10 * Math.cos(rad);
        const ty = 16 + 10 * Math.sin(rad);
        return `<g><circle cx="16" cy="16" r="${r}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="6" stroke-dasharray="${(v/total*100).toFixed(2)} 100" transform="rotate(-90 16 16)" style="transform-origin:16px 16px; transform:rotate(${start}deg);"/><text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" font-size="5" fill="#333" font-weight="700">${v}</text></g>`;
      }).join("");
      const legend = Object.entries(data).map(([k, v], i) => `<span class="chart-legend"><i style="background:${colors[i % colors.length]}"></i>${k} <b>${v}</b></span>`).join("");
      return `<div class="chart-card"><div class="chart-head">${label}</div><div class="chart-body"><svg viewBox="0 0 32 32" class="pie">${segs}</svg><div class="chart-legend-list">${legend}</div></div></div>`;
    }

    const fmtDate = (ts) => {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return "—";
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    };

    return `
      <div class="section-head"><div class="section-title">客户</div><div class="section-sub">CRM 轻量管理：从报名沉淀到会员价值分析</div></div>

      <div class="customer-tabs">
        <button class="ctab ${tab==="list"?"active":""}" data-action="customerTab" data-tab="list">用户列表</button>
        <button class="ctab ${tab==="tags"?"active":""}" data-action="customerTab" data-tab="tags">用户标签</button>
        <button class="ctab ${tab==="import"?"active":""}" data-action="customerTab" data-tab="import">导入用户</button>
        <button class="ctab ${tab==="settings"?"active":""}" data-action="customerTab" data-tab="settings">设置</button>
      </div>

      ${tab === "list" ? `
        <div class="recall-card" style="margin-bottom:18px">
          <div class="recall-h"><span class="ic">${ICON("users")}</span><b>AI 老客户召回</b></div>
          <p class="muted small">系统根据报名记录自动发现可召回人群，点击即可生成邀请内容。</p>
          <div class="recall-segs">
            <button class="recall-seg" data-action="recallGen" data-seg="亲子"><b>${parentTags("亲子客户")}</b><span>亲子客户</span><i>生成邀请</i></button>
            <button class="recall-seg" data-action="recallGen" data-seg="徒步"><b>${parentTags("徒步客户")}</b><span>徒步客户</span><i>生成邀请</i></button>
            <button class="recall-seg" data-action="recallGen" data-seg="inactive60"><b>${inactive.length}</b><span>60天未参加</span><i>生成邀请</i></button>
          </div>
          ${state._recall ? `<div class="recall-out"><div class="recall-out-h">召回文案 · ${esc(state._recall.seg)}<button class="btn btn-ghost btn-xs" data-action="copyText" data-text="${esc(state._recall.text)}">${ICON("copy")} 复制</button></div><div class="recall-out-body">${esc(state._recall.text)}</div></div>` : ""}
        </div>

        <div class="crm-filter-bar">
          <div class="crm-filter-row">
            <div class="crm-field">
              <label>搜索用户</label>
              <input type="text" class="input input-sm" id="customerSearch" placeholder="ID/昵称/手机号码/账号/卡号" value="${esc(state.customerSearch || "")}">
            </div>
            <div class="crm-field">
              <label>会员</label>
              <select class="select select-sm" id="customerMemberFilter">
                <option value="all" ${memberFilter==="all"?"selected":""}>全部用户</option>
                <option value="member" ${memberFilter==="member"?"selected":""}>会员</option>
                <option value="nonmember" ${memberFilter==="nonmember"?"selected":""}>非会员</option>
              </select>
            </div>
            <div class="crm-field">
              <label>已授手机号</label>
              <select class="select select-sm" id="customerPhoneFilter">
                <option value="all" ${phoneFilter==="all"?"selected":""}>全部</option>
                <option value="bound" ${phoneFilter==="bound"?"selected":""}>已绑定</option>
                <option value="unbound" ${phoneFilter==="unbound"?"selected":""}>未绑定</option>
              </select>
            </div>
            <div class="crm-field crm-dates">
              <label>注册时间</label>
              <div class="crm-date-row">
                <input type="date" class="input input-sm" id="customerStartDate" value="${esc(start)}">
                <span>至</span>
                <input type="date" class="input input-sm" id="customerEndDate" value="${esc(end)}">
              </div>
            </div>
          </div>
          <div class="crm-filter-actions">
            <button class="btn btn-primary btn-sm" data-action="customerQuery">${ICON("search")} 查询</button>
            <button class="btn btn-soft btn-sm" data-action="customerExport">${ICON("download")} 导出</button>
            <button class="btn btn-ghost btn-sm" data-action="customerExportRecord">导出记录</button>
          </div>
        </div>

        <div class="crm-stats">
          <div class="crm-stat"><div class="crm-stat-num">${totalUsers.toLocaleString()}</div><div class="crm-stat-lbl">用户数</div></div>
          <div class="crm-stat"><div class="crm-stat-num">${totalMembers.toLocaleString()}</div><div class="crm-stat-lbl">会员数</div></div>
          <div class="crm-stat"><div class="crm-stat-num">¥${totalBalance.toLocaleString()}</div><div class="crm-stat-lbl">总余额</div></div>
          <div class="crm-stat"><div class="crm-stat-num">${totalPoints.toLocaleString()}</div><div class="crm-stat-lbl">总积分</div></div>
        </div>

        <div class="crm-charts">
          ${pie("性别分布", genderCounts, ["#4A90E2", "#E85D75", "#9AA0A6"])}
          ${pie("下单用户", { "下单用户": orderCounts.ordered, "未下单用户": orderCounts.notOrdered }, ["#4A90E2", "#81C784"])}
          ${pie("会员分布", { "会员": memberCounts.member, "普通": memberCounts.nonMember }, ["#F5A623", "#E85D75"])}
          ${pie("充值状态", { "充值过": rechargeCounts.recharged, "未充值": rechargeCounts.notRecharged }, ["#50E3C2", "#BD10E0"])}
        </div>

        <div class="section-head" style="margin-top:8px"><div class="section-title">客户列表</div><span class="muted small">${list.length} 人 / 共 ${all.length} 人</span><span id="custSelInfo" class="muted small">· 已选 ${_clubosCustSel.size} 位</span></div>
        <div class="customer-table-wrap">
          <table class="customer-table">
            <thead><tr>
              <th class="col-check"><input type="checkbox" id="customerSelectAll" data-action="customerSelectAll" ${list.length && list.every((c) => _clubosCustSel.has(c.id)) ? "checked" : ""}></th>
              <th>ID</th>
              <th>头像</th>
              <th>用户昵称</th>
              <th>上级分销员</th>
              <th>性别</th>
              <th>余额</th>
              <th>积分</th>
              <th>手机号</th>
              <th>生日</th>
              <th>会员</th>
              <th>操作</th>
            </tr></thead>
            <tbody>
              ${list.length ? list.map((c) => `
                <tr>
                  <td class="col-check"><input type="checkbox" data-action="customerSelect" data-id="${esc(c.id)}" ${_clubosCustSel.has(c.id) ? "checked" : ""}></td>
                  <td class="col-id">${esc(c.id)}</td>
                  <td><div class="cust-avatar">${esc((c.name || "客").slice(0, 1))}</div></td>
                  <td class="col-name">
                    <div class="cust-name-main">${esc(c.nickname || c.name || "—")}</div>
                    ${c.tags.size ? `<div class="cust-tag-row">${[...c.tags].slice(0,2).map((t) => `<span class="mall-cat">${esc(t)}</span>`).join("")}</div>` : ""}
                  </td>
                  <td>${esc(c.parentDistributor)}</td>
                  <td><span class="cust-badge ${c.gender==="男"?"male":""} ${c.gender==="女"?"female":""}">${esc(c.gender)}</span></td>
                  <td class="col-num">${(c.balance || 0).toFixed(2)}</td>
                  <td class="col-num">${(c.points || 0).toLocaleString()}</td>
                  <td>${c.phone && c.phone!=="—" ? `<span class="cust-phone">${esc(c.phone)}</span>` : `<button class="btn btn-ghost btn-xs" data-action="customerBindPhone" data-id="${esc(c.id)}">绑定手机号</button>`}</td>
                  <td>${c.birthday ? `<span class="cust-phone">${esc(c.birthday)}</span>` : `<button class="btn btn-ghost btn-xs" data-action="customerSetBirth" data-id="${esc(c.id)}">修改生日</button>`}</td>
                  <td>
                    ${c.member ? `<div class="cust-member"><span class="dot dot-${c.memberTier}"></span><span>${esc(c.memberTier || "会员")}</span></div>` : `<span class="muted small">否</span>`}
                  </td>
                  <td class="col-actions">
                    <div class="cust-actions">
                      <button class="btn btn-ghost btn-xs" data-action="customerOrders" data-id="${esc(c.id)}">历史订单</button>
                      <button class="btn btn-ghost btn-xs" data-action="customerDist" data-id="${esc(c.id)}">查看分销</button>
                      <div class="dropdown">
                        <button class="btn btn-ghost btn-xs" data-action="customerMore" data-id="${esc(c.id)}">更多</button>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr class="detail-row hidden" data-detail="${esc(c.id)}">
                  <td colspan="12">
                    <div class="cust-detail">
                      <div class="cust-detail-line"><b>注册时间</b>${fmtDate(c.registeredAt)}</div>
                      <div class="cust-detail-line"><b>总消费</b>¥${(c.totalSpent || 0).toLocaleString()}</div>
                      <div class="cust-detail-line"><b>本月消费</b>¥${(c.monthSpent || 0).toLocaleString()}</div>
                      <div class="cust-detail-line"><b>集章数量</b>${c.stampCount || 0}</div>
                      <div class="cust-detail-line"><b>会员到期时间</b>${esc(c.memberExpired)}</div>
                      <div class="cust-detail-line"><b>使用版本</b>${esc(c.version)}</div>
                      <div class="cust-detail-line"><b>禁止登录</b><label class="switch-label switch-sm"><input type="checkbox" ${c.banned?"checked":""} data-action="customerToggleBanned" data-id="${esc(c.id)}"><span></span></label></div>
                    </div>
                  </td>
                </tr>
              `).join("") : `<tr><td colspan="12" class="col-empty"><div class="empty"><div class="e-ic">👥</div><div>没有符合筛选条件的客户</div></div></td></tr>`}
            </tbody>
          </table>
        </div>
      ` : ""}

      ${tab === "tags" ? `<div class="card card-pad"><h3>用户标签</h3><p class="muted small">自动标签：亲子客户、徒步客户、60天未参加、90天未参加、高频用户。后续支持自定义标签。</p><div class="cust-tags" style="margin-top:12px">${["亲子客户","徒步客户","60天未参加","90天未参加","高频用户"].map((t)=>`<span class="mall-cat">${t}</span>`).join("")}</div></div>` : ""}
      ${tab === "import" ? `<div class="card card-pad"><h3>导入用户</h3><p class="muted small">即将支持 Excel 批量导入会员。当前可通过客户报名自动沉淀。</p><button class="btn btn-soft btn-sm" style="margin-top:12px" disabled>上传 Excel（敬请期待）</button></div>` : ""}
      ${tab === "settings" ? `<div class="card card-pad"><h3>客户设置</h3><p class="muted small">会员等级、积分规则、分销开关后续在此配置。</p></div>` : ""}
    `;
  }

  function renderOperator() {
    const tasks = buildActivityTasks();
    const customers = deriveCustomers();
    const inactive = customers.filter((c) => c.inactiveDays != null && c.inactiveDays >= 60);
    return `
      <div class="section-head"><div class="section-title">运营助手</div><div class="section-sub">活动发布后，ClubOS 持续帮你招募、提醒、回顾、召回——而不是创建完就结束</div></div>

      <div class="op-life">
        ${["刚发布 → 招募", "报名过半 → 成团", "剩少量 → 最后招募", "出发前 → 装备/集合", "结束 → 回顾", "一段时间后 → 召回"].map((s, i) => `<div class="op-life-node ${i === 0 ? "first" : ""}"><span class="op-dot"></span>${s}</div>${i < 5 ? '<span class="op-arrow">→</span>' : ""}`).join("")}
      </div>

      <div class="section-head" style="margin-top:6px"><div class="section-title">活动运营任务</div><span class="muted small">${tasks.length} 项</span></div>
      ${tasks.length ? `<div class="op-tasks">${tasks.map((t) => `
        <div class="op-task">
          <div class="op-task-l">
            <span class="op-badge">${esc(t.badge)}</span>
            <div><div class="op-task-title">${esc(t.a.title)}</div><div class="op-task-tip">${esc(t.tip)}</div></div>
          </div>
          <div class="op-task-r">
            <button class="btn btn-primary btn-sm" data-action="opGen" data-id="${t.a.id}" data-channels="${t.channels}">${ICON("sparkles")} ${esc(t.btn)}</button>
          </div>
          ${renderOpCopies(t.a.id)}
        </div>`).join("")}</div>` : `<div class="empty"><div class="e-ic">📣</div><div>当前没有进行中的活动任务。发布一场活动后，这里会自动出现招募 / 提醒 / 回顾任务。</div></div>`}

      <div class="section-head" style="margin-top:8px"><div class="section-title">老客户召回</div><span class="muted small">${inactive.length} 人 60 天未参加</span></div>
      <div class="recall-card">
        <p class="muted small">系统自动按标签分层，选择人群即可生成专属邀请文案。</p>
        <div class="recall-segs">
          <button class="recall-seg" data-action="recallGen" data-seg="亲子"><b>${customers.filter((c) => c.tags.has("亲子客户")).length}</b><span>亲子客户</span><i>生成邀请</i></button>
          <button class="recall-seg" data-action="recallGen" data-seg="徒步"><b>${customers.filter((c) => c.tags.has("徒步客户")).length}</b><span>徒步客户</span><i>生成邀请</i></button>
          <button class="recall-seg" data-action="recallGen" data-seg="inactive60"><b>${inactive.length}</b><span>60天未参加</span><i>生成邀请</i></button>
        </div>
        ${state._recall ? `<div class="recall-out"><div class="recall-out-h">召回文案 · ${esc(state._recall.seg)}<button class="btn btn-ghost btn-xs" data-action="copyText" data-text="${esc(state._recall.text)}">${ICON("copy")} 复制</button></div><div class="recall-out-body">${esc(state._recall.text)}</div></div>` : ""}
      </div>
    `;
  }

  function renderSettings() {
    const b = state.brand;
    const aiBal = aiBalance();
    const mallSales = state.mallSalesMonth || 0;
    const nextMilestone = AI_MILESTONES.find((m) => mallSales < m.t);
    const progress = nextMilestone ? Math.min(100, Math.round((mallSales / nextMilestone.t) * 100)) : 100;
    const cs = commissionSummary();
    const presets = ["#2F5D50", "#B4543B", "#C2873F", "#3E5C7C", "#5C4A7C", "#4A6B3E"];
    return `
      <div class="section-head"><div class="section-title">设置</div><div class="section-sub">机构资料、品牌、AI 额度与高级设置集中在这里</div></div>

      <div class="card card-pad">
        <div class="panel-head"><h3>机构与品牌</h3></div>
        <div class="field"><label>机构名称</label><input class="input" data-brand="name" value="${esc(b.name)}"></div>
        <div class="field"><label>机构 Logo 图片</label>
          <div class="logo-upload" data-action="uploadLogo">
            ${b.logo ? `<img class="logo-prev" src="${esc(b.logo)}" alt="logo"><button class="logo-del" data-action="delLogo" title="移除图片">${ICON("x")}</button>` : `<div class="logo-ph"><div class="ic">${ICON("upload")}</div>点击上传图片 Logo</div><div class="tiny muted">多数机构已有图片 Logo，直接上传即可；留空则显示文字</div>`}
          </div>
        </div>
        <div class="field"><label>Logo 文字（无图片时显示）</label><input class="input" data-brand="logoText" value="${esc(b.logoText)}" maxlength="2"></div>
        <div class="field"><label>品牌口号</label><input class="input" data-brand="slogan" value="${esc(b.slogan)}"></div>
        <div class="field"><label>品牌风格</label><select class="select" data-brand="style">${["专业克制", "年轻户外", "温暖亲子", "高级旅行", "活泼社群"].map((s) => `<option ${b.style === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
        <div class="field"><label>机构简介</label><textarea class="textarea" data-brand="intro">${esc(b.intro)}</textarea></div>
        <div class="grid-2">
          <div class="field"><label>客服微信</label><input class="input" data-brand="wechat" value="${esc(b.wechat)}"></div>
          <div class="field"><label>联系电话</label><input class="input" data-brand="phone" value="${esc(b.phone)}"></div>
        </div>
        <div class="field"><label>机构地址</label><input class="input" data-brand="address" value="${esc(b.address)}"></div>
        <div class="color-row" style="margin:6px 0 10px">${presets.map((c) => `<div class="sw" data-action="pickColor" data-c="${c}" style="background:${c}"></div>`).join("")}</div>
        <input type="color" data-brand="primary" value="${esc(b.primary)}" style="width:100%;height:42px;border:1px solid var(--line);border-radius:11px">
        <button class="btn btn-primary" style="margin-top:12px" data-action="saveSettingsBrand">${ICON("check")} 保存机构与品牌</button>
      </div>

      <div class="card card-pad" style="margin-top:14px">
        <div class="panel-head"><h3>界面装修</h3><span class="tiny muted">自定义 C 端首页</span></div>
        <p class="muted small" style="margin:0 0 10px">为不同业务模式预设 3 个行业模版，或自由拖拽组件、改文案，定制专属首页排版。</p>
        <button class="btn btn-primary" data-action="nav" data-view="decorate">${ICON("sliders")} 进入界面装修</button>
      </div>

      <div class="fr-section">
        <div class="fr-section-h"><h3>AI 额度</h3><span class="more" data-action="openAiCredit">明细</span></div>
        <div class="mem-ai">
          <div class="ai-balance-row"><b>${aiBal.toLocaleString()}</b><span> AI 积分</span></div>
          <div class="ai-progress"><div class="ai-progress-bar" style="width:${progress}%"></div></div>
          <p class="muted small" style="margin-top:8px">${nextMilestone ? `本月商城销售 ¥${mallSales.toLocaleString()} · 达 ¥${nextMilestone.t.toLocaleString()} 奖励 +${nextMilestone.g} AI 积分（${progress}%）` : "已达最高里程碑，继续加油"}</p>
          <div class="row between"><span class="muted small">基础 / 赠送 / 充值</span><span class="muted small">${(state.aiCredit.base || 0).toLocaleString()} · ${(state.aiCredit.gift || 0).toLocaleString()} · ${(state.aiCredit.paid || 0).toLocaleString()}</span></div>
        </div>
      </div>

      <div class="fr-section">
        <div class="fr-section-h"><h3>我的商城</h3></div>
        <div class="mem-ai">
          <div class="row between"><span class="muted small">本月装备销售</span><b>¥${mallSales}</b></div>
          <div class="row between"><span class="muted small">待结算佣金</span><b>¥${Math.round(cs.pending + cs.frozen + cs.available)}</b></div>
          <div class="row between"><span class="muted small">已结算佣金</span><b>¥${Math.round(cs.settled)}</b></div>
          <p class="muted small" style="margin-top:8px">商城由平台统一运营，俱乐部仅负责推荐与成交，按销量获得单级归因佣金。</p>
        </div>
      </div>

      <div class="fr-section">
        <div class="fr-section-h"><h3>关于 ClubOS</h3></div>
        <div class="mem-ai">
          <p class="muted small" style="margin:0">ClubOS 俱乐部版全功能免费开放：活动报名 0% 平台抽成，平台靠装备商城毛利与销售佣金盈利。俱乐部通过专属商城入口带来的装备销售，按销量获得阶梯佣金，达标可获 AI 额度奖励。</p>
          <button class="btn btn-soft btn-sm" style="margin-top:10px" data-action="openApplyClub">${state.clubStatus === "approved" ? "查看入驻资料" : "申请入驻"}</button>
        </div>
      </div>

      <details class="fr-section" open>
        <summary class="fr-section-h" style="cursor:pointer"><h3>AI 设置</h3><span class="more">收起</span></summary>
        <div class="mem-ai">
          <p class="muted small" style="margin:0 0 10px">生产环境由<b>总平台统一持有 AI Key</b>并按 AI 积分计量，俱乐部只需填下方「后端地址 + 管理员口令 + 商家ID」，无需任何 Key。未接后端时，可填「本地演示 Key」临时直连（仅存本机浏览器）。</p>
          <div class="field"><label>总平台后端地址</label><input class="input" id="backendUrl" placeholder="https://your-backend.com（根地址，不要带 /api/pay）" value="${esc(getBackendURL())}" autocomplete="off"><div class="hint">填总平台后端<b>根地址</b>（如 https://api.example.com），<b>不要带 /api/pay 后缀</b>；留空走本地演示直连，填写后所有 AI 调用经后端代理（Key 不在前端）。</div></div>
          <div class="field"><label>管理员口令</label><input class="input" id="backendAdminCode" type="password" placeholder="与后端 ADMIN_CODE 一致" value="${esc(getBackendAdminCode())}" autocomplete="off"></div>
          <div class="field"><label>商家ID</label><input class="input" id="backendMerchantId" placeholder="1" value="${esc(getBackendMerchantId())}" autocomplete="off"><div class="hint">后端数据库中的商家数字 ID，用于 AI 积分计量。</div></div>
          <div class="row gap-10"><button class="btn btn-ghost btn-sm" data-action="testBackend">${ICON("sparkles")} 测试后端连接</button></div>
          <hr style="border:none;border-top:1px solid var(--line,#eee);margin:12px 0">
          <div class="field"><label>本地演示 Key（服务商）</label><select class="input" id="aiProvider">${["deepseek", "qwen"].map((p) => `<option value="${p}" ${getAIProvider() === p ? "selected" : ""}>${p === "deepseek" ? "DeepSeek（deepseek-chat）" : "阿里云百炼（qwen-plus）"}</option>`).join("")}</select></div>
          <div class="field"><label>本地演示 Key</label><input class="input" id="aiKey" type="password" placeholder="sk-... 或 DashScope Key（仅未接后端时生效）" value="${esc(getAIKey())}" autocomplete="off"><div class="hint">⚠️ 仅本地演示用：Key 只存本机浏览器，不上传服务器；接入总平台后端后此 Key 不再使用。</div></div>
          <div class="row gap-10"><button class="btn btn-primary btn-sm" data-action="saveAI">${ICON("check")} 保存 AI 设置</button><button class="btn btn-ghost btn-sm" data-action="testAI">${ICON("sparkles")} 测试连接</button></div>
        </div>
      </details>
    `;
  }

  async function generateRecallCopy(seg) {
    const customers = deriveCustomers();
    const segMap = { 亲子: "亲子客户", 徒步: "徒步客户", inactive60: "60天未参加活动的老客户" };
    const label = segMap[seg] || "老客户";
    const list = customers.filter((c) => c.tags.has(label) || (seg === "inactive60" && c.inactiveDays != null && c.inactiveDays >= 60));
    if (aiAuthMode()) {
      const userMsg = `俱乐部「${state.brand.name}」有 ${list.length} 名「${label}」近期未报名。请写一段温和、不推销感的老客户召回邀请文案（微信群/私信口吻），提及新一期同类活动，不要虚构具体活动名称、时间、价格，用「本周新活动」等占位。只返回纯文本。`;
      const t = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: false, temperature: 0.7 });
      if (t) return t;
    }
    return `亲爱的「${label}」朋友，好久不见～ 咱们 ${state.brand.name} 本周又有新活动上线啦，想着第一时间告诉你。方便的话回复一下，我给你留位 🙌（共 ${list.length} 位老朋友收到这条邀请）`;
  }

  // 运营助手：为某场活动的指定渠道生成招募 / 提醒 / 回顾文案（AI 优先，失败回退模板）
  async function generateOpCopy(a, ch) {
    const chName = { wechat: "微信群", moments: "朋友圈", xhs: "小红书", gzh: "公众号", voice: "口播" };
    if (aiAuthMode()) {
      const userMsg = `俱乐部「${state.brand.name}」有一场活动：${a.title}（${a.dateText || a.dateMD || a.date || "待定"} 出发，${a.place || "集合点待定"}）。请为「${chName[ch] || ch}」渠道写一段招募或提醒文案，风格真诚、不浮夸；不要虚构领队、保险、路线条件、餐饮、住宿、救援等事实信息。只返回纯文本。`;
      const t = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: false, temperature: 0.7 });
      if (t && t.trim()) return t.trim();
    }
    return fallbackShareCopy(a, ch);
  }
  async function generateOpCopies(a, channels) {
    state._opCopies = state._opCopies || {};
    state._opCopies[a.id] = state._opCopies[a.id] || {};
    state._opCopyBatches = state._opCopyBatches || {};
    state._opCopyBatchIdx = state._opCopyBatchIdx || {};
    const result = {};
    for (const ch of channels) result[ch] = await generateOpCopy(a, ch);
    state._opCopies[a.id] = result;
    state._opCopyBatches[a.id] = state._opCopyBatches[a.id] || [];
    state._opCopyBatches[a.id].push({ copies: JSON.parse(JSON.stringify(result)), at: Date.now() });
    state._opCopyBatchIdx[a.id] = state._opCopyBatches[a.id].length - 1;
    saveState();
  }
  async function regenerateOpCopyChannel(a, ch) {
    const text = await generateOpCopy(a, ch);
    const aid = a.id;
    state._opCopies = state._opCopies || {};
    state._opCopies[aid] = state._opCopies[aid] || {};
    state._opCopies[aid][ch] = text;
    const idx = (state._opCopyBatchIdx || {})[aid] || 0;
    state._opCopyBatches = state._opCopyBatches || {};
    if (state._opCopyBatches[aid] && state._opCopyBatches[aid][idx]) {
      state._opCopyBatches[aid][idx].copies[ch] = text;
    }
    saveState();
    return text;
  }
  function switchOpCopyBatch(aid, dir) {
    state._opCopyBatches = state._opCopyBatches || {};
    state._opCopyBatchIdx = state._opCopyBatchIdx || {};
    const batches = state._opCopyBatches[aid] || [];
    let idx = state._opCopyBatchIdx[aid] || 0;
    idx = Math.max(0, Math.min(batches.length - 1, idx + dir));
    state._opCopyBatchIdx[aid] = idx;
    if (batches[idx]) state._opCopies[aid] = JSON.parse(JSON.stringify(batches[idx].copies));
    saveState();
  }

  function depSignupCount(a, depId) {
    if (!depId) return a.signups || 0;
    return (state.signups || []).filter((s) => s.activityId === a.id && s.departureId === depId).reduce((sum, s) => sum + (s.adults || 0) + (s.children || 0), 0);
  }
  function depStatusLabel(st) {
    return ({ open: "可报名", full: "已满员", closed: "已截止" })[st] || "可报名";
  }
  function actCard(a) {
    const coverCls = a.photos && a.photos[0] ? "act-row-cover" : "act-row-cover gradient";
    const cover = a.photos && a.photos[0] ? `style="background-image:url('${a.photos[0]}')"` : "";
    const badge = statusBadge(a.status);
    const deps = (a.departures || []).filter((d) => d && d.date);
    const depHeader = deps.length > 1 ? `<div class="act-dep" style="margin-bottom:2px"><span class="act-dep-date" style="color:var(--muted);font-weight:500">共 ${deps.length} 个团期</span><span class="act-dep-count">合计 ${deps.reduce((sum, d) => sum + depSignupCount(a, d.id), 0)} 报名</span></div>` : "";
    const depRows = deps.length
      ? deps.map((d) => `<div class="act-dep"><span class="act-dep-date">${esc(d.weekDay || "")} ${esc(formatDepartureSlash(d.date))}</span><span class="act-dep-count">${depSignupCount(a, d.id)} 报名</span>${d.status !== "open" ? `<span class="badge badge-${d.status === "full" ? "full" : "ended"}">${esc(depStatusLabel(d.status))}</span>` : ""}</div>`).join("")
      : `<div class="act-dep"><span class="act-dep-date">${esc(a.dateMD || a.date || "日期待定")}</span><span class="act-dep-count">${a.signups || 0} 报名</span></div>`;
    const shelfBtn = a.status === "down"
      ? `<button class="btn btn-primary btn-sm" data-action="toggle" data-id="${a.id}">上架</button>`
      : `<button class="btn btn-ghost btn-sm" data-action="toggle" data-id="${a.id}">下架</button>`;
    return `<div class="act-row">
      <div class="${coverCls}" ${cover}><span class="badge ${badge.cls}"><span class="dot"></span>${badge.txt}</span></div>
      <div class="act-row-body">
        <h4>${esc(a.title)}</h4>
        <div class="act-row-departures">${depHeader}${depRows}</div>
      </div>
      <div class="act-row-actions">
        ${shelfBtn}
        <button class="btn btn-soft btn-sm" data-action="edit" data-id="${a.id}">${ICON("edit")} 编辑</button>
        <button class="btn btn-ghost btn-sm" data-action="filterSignups" data-id="${a.id}">${ICON("users")} 报名名单</button>
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
    if (!H.length) return `<div class="modal"><div class="modal-head"><h3>历史活动库</h3><button class="icon-btn" data-action="closeModal" aria-label="关闭">${ICON("x")}</button></div><div class="modal-body"><div class="empty">还没有已发布的活动。发布活动后，会自动进入历史库，下次可一键沿用行程与文案。</div></div></div>`;
    return `<div class="modal">
      <div class="modal-head"><h3>历史活动库</h3><button class="icon-btn" data-action="closeModal" aria-label="关闭">${ICON("x")}</button></div>
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
  // 地点风景图编辑面板：展示自动搜索结果，老板可挑选 / 移除 / 手动替换
  function placePhotoPanelHtml(a) {
    const ph = a.placePhotos || [];
    const chosen = a.whyGoPhoto || "";
    const searching = !!a._searchingPlacePhotos;
    const emptyMsg = searching
      ? `<div class="pp-status"><span class="pp-spinner"></span>正在搜索「${esc(a.place || "活动地点")}」的风景图…</div>`
      : (ph.length ? "" : `<div class="pp-status pp-empty">还没有找到公开风景图。点击下方按钮联网搜索，或粘贴图片链接手动替换。</div>`);
    const thumbs = ph.length
      ? `<div class="place-photos">${ph.map((p, i) => `<div class="pp-thumb ${chosen === p.src ? "on" : ""}" data-action="pickPlacePhoto" data-id="${i}"><img src="${esc(p.src)}" alt="" loading="lazy"><button class="pp-x" data-action="rmPlacePhoto" data-id="${i}" aria-label="移除">${ICON("x")}</button>${chosen === p.src ? `<span class="pp-pick">已选用</span>` : ""}</div>`).join("")}</div>`
      : emptyMsg;
    return `<div class="panel" style="margin-bottom:18px">
      <div class="panel-head"><h3>地点风景图 · 为什么值得来</h3><span class="tiny muted">联网自动搜索，老板可手动更换</span></div>
      <div class="panel-body">
        ${chosen ? `<div class="pp-chosen"><span class="tiny muted">当前用于「为什么值得去」区块：</span><img src="${esc(chosen)}" alt=""></div>` : ""}
        ${thumbs}
        <div class="row gap-8" style="margin-top:10px">
          <button class="btn btn-soft btn-sm" data-action="searchPlacePhotos" type="button" ${searching ? "disabled" : ""}>${ICON("search")} ${searching ? "搜索中…" : "搜索该地点风景图"}</button>
        </div>
        <div class="row gap-8" style="margin-top:10px">
          <input class="input" id="whyGoPhotoUrl" placeholder="或粘贴一张图片链接手动替换">
          <button class="btn btn-ghost btn-sm" data-action="setWhyGoPhotoUrl" type="button">使用此图</button>
        </div>
        ${chosen ? `<button class="btn btn-ghost btn-sm" data-action="clearWhyGoPhoto" type="button" style="margin-top:8px">移除当前配图</button>` : ""}
      </div>
    </div>`;
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
      <div class="editor-steps">
        <div class="estep ${tab==="content"?"on":""}"><span class="es-no">1</span>确认事实 · 微调内容</div>
        <div class="estep ${tab==="price"?"on":""}"><span class="es-no">2</span>价格与团期</div>
        <div class="estep ${tab==="visual"?"on":""}"><span class="es-no">3</span>视觉呈现</div>
        <div class="estep ${tab==="publish"?"on":""}"><span class="es-no">4</span>预览并发布</div>
      </div>
      <div class="editor">
      <div class="editor-main">
        <div class="editor-tabs">
          <button class="etab ${tab==="content"?"active":""}" data-action="switchTab" data-tab="content">内容</button>
          <button class="etab ${tab==="price"?"active":""}" data-action="switchTab" data-tab="price">价格与团期</button>
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
              <details class="adv-collapse"><summary>高级编辑 · AI 已生成，需要微调再展开</summary>
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

              </details>
              <div class="panel-subhead" style="margin-top:18px"><h4>消费者价值叙事 <span class="auto-tag">新架构 · 优先渲染</span></h4><span class="tiny muted">按“为什么值得去 → 体验 → 收获 → 适合谁”组织详情页主线</span></div>
              <div class="field" style="margin-top:10px">
                <label class="fl narr-title-line"><span>为什么值得去</span><input class="input input-xs" data-bind-section-title="whyGo" value="${esc((a.sectionTitles && a.sectionTitles.whyGo) || "")}" placeholder="章节标题，如：在成都的黄昏里，登一座可以呼吸的山" style="flex:1;margin:0 10px"><button class="mini-regen" data-action="regenField" data-field="whyGo" type="button">${ICON("refresh")}换一段</button></label>
                <textarea class="textarea" data-bind="whyGo" rows="4" placeholder="回答：这个地方为什么值得去？风景、季节、场景稀缺性、与城市日常的差异。">${esc(a.whyGo || "")}</textarea>
              </div>
              <div class="field" style="margin-top:10px">
                <label class="fl narr-title-line"><span>来了会体验什么</span><input class="input input-xs" data-bind-section-title="experience" value="${esc((a.sectionTitles && a.sectionTitles.experience) || "")}" placeholder="章节标题" style="flex:1;margin:0 10px"><button class="mini-regen" data-action="regenField" data-field="experience" type="button">${ICON("refresh")}换一段</button></label>
                <textarea class="textarea" data-bind="experience" rows="4" placeholder="回答：参加这次活动到底有什么意思？运动、探索、挑战、互动、拍照、社交、亲子等真实体验。">${esc(a.experience || "")}</textarea>
              </div>
              <div class="field" style="margin-top:10px">
                <label class="fl narr-title-line"><span>参加完能得到什么</span><input class="input input-xs" data-bind-section-title="gain" value="${esc((a.sectionTitles && a.sectionTitles.gain) || "")}" placeholder="章节标题" style="flex:1;margin:0 10px"><button class="mini-regen" data-action="regenField" data-field="gain" type="button">${ICON("refresh")}换一段</button></label>
                <textarea class="textarea" data-bind="gain" rows="4" placeholder="回答：身体、心理、成长、社交、户外能力等方面，用户完成这次活动后可能带走什么。">${esc(a.gain || "")}</textarea>
              </div>
              <div class="grid-2" style="margin-top:10px">
                <div class="field"><label>适合谁</label><textarea class="textarea" data-bind="fitFor" rows="3" placeholder="推荐人群、经验、年龄、体能等">${esc(a.fitFor || "")}</textarea></div>
                <div class="field"><label>不建议谁</label><textarea class="textarea" data-bind="notFitFor" rows="3" placeholder="不建议参加的人群或身体状况">${esc(a.notFitFor || "")}</textarea></div>
              </div>

              <div class="field" style="margin-top:12px"><label>核心卖点 <span class="auto-tag">可增删</span></label><div class="sp-edit-list">${((a.sellingPoints && a.sellingPoints.length) ? a.sellingPoints : [{title:"",desc:""}]).map((s, i) => `<div class="sp-edit-row" data-sp-idx="${i}"><div class="sp-edit-head"><input class="input sp-title" data-bind-sp="${i}" data-sub="title" value="${esc(s.title || "")}" placeholder="卖点（事实点）"><button class="mini-regen" data-action="regenSP" data-id="${i}" type="button">${ICON("refresh")}换一个</button><button class="icon-btn" data-action="delSP" data-id="${i}">${ICON("x")}</button></div><textarea class="textarea sp-desc" data-bind-sp="${i}" data-sub="desc" rows="2" placeholder="一句话支撑，为什么重要">${esc(s.desc || "")}</textarea></div>`).join("")}<button class="btn btn-soft btn-sm" data-action="addSP">+ 添加卖点</button></div></div>
            </div>
          </div>

          ${placePhotoPanelHtml(a)}

          <div class="panel" style="margin-bottom:18px">
            <div class="panel-head"><h3>装备建议</h3><button class="btn btn-soft btn-sm" data-action="autoRecommendGear" type="button">${ICON("sparkles")} 一键智能推荐</button></div>
            <div class="tiny muted" style="margin:0 0 10px">按活动类型 / 地点 / 季节 / 天气自动生成清单并匹配商城装备 · 可手动增减</div>
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
        <div class="etab-panel" data-panel="price" ${tab!=="price"?"hidden":""}>
          ${departuresEditHtml(a)}
          ${memberMarketingEditHtml(a)}
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
    const facts = [a.place, a.type, a.dateMD, a.distance ? `${a.distance}公里` : "", a.elevation ? `${a.elevation}米` : "", a.difficulty, a.ageRange, a.price ? `¥${a.price}/${a.limitUnit}` : ""].filter(Boolean);
    const directions = (a.contentDirections || []).slice(0, 3);
    return `<div class="advice-shell">
      <div class="advice-top"><span class="ai-orb">AI</span><span>CONTENT STRATEGY · AI 生成</span></div>
      <div class="eyebrow">先选表达方向，再进入编辑</div>
      <h1>这场活动，最值得强调什么？</h1>
      <p class="advice-lead">AI 只包装老板给出的真实活动，不改变目的地、不补写行程，也不添加未确认的服务承诺。</p>
      <div class="advice-facts"><b>本次写作依据</b><span>${esc(facts.join(" · "))}</span></div>
      ${directions.length ? `<div class="direction-grid">${directions.map((d, i) => `<button class="direction-card ${i === +(a.contentDirection || 0) ? "selected" : ""}" data-action="pickContentDirection" data-i="${i}"><span class="direction-index">0${i + 1} · ${esc(d.name)}</span><strong>${esc(d.headline)}</strong><span class="direction-reason">${esc(d.reason)}</span><span class="direction-use">${i === +(a.contentDirection || 0) ? "当前推荐" : "选择这个方向"}</span></button>`).join("")}</div>` : ""}
      <div class="advice-preview">
        <span>当前主传播主题</span>
        <h2>${esc((a.contentPlan && a.contentPlan.contentStrategy && a.contentPlan.contentStrategy.mainTheme) || (a.contentStrategy && a.contentStrategy.name) || a.title || "未命名活动")}</h2>
        <p>${esc((a.contentPlan && a.contentPlan.contentStrategy && a.contentPlan.contentStrategy.mainSellingPoint) || (a.contentStrategy && a.contentStrategy.headline) || a.intro || "活动介绍将在事实确认后生成。")}</p>
        <div class="strat-tags">
          <span class="${a.whyGo ? "on" : ""}">为什么值得去</span>
          <span class="${a.experience ? "on" : ""}">好不好玩</span>
          <span class="${a.gain ? "on" : ""}">能得到什么</span>
        </div>
      </div>
      ${ (a.missingFacts && a.missingFacts.length) ? `<div class="advice-missing"><b>AI 提示缺少的信息</b>${a.missingFacts.map((t) => `<div class="am-item">${esc(t)}</div>`).join("")}</div>` : "" }
      ${ (a.forewordTitles && a.forewordTitles.length) ? `<div class="title-cands"><div class="tc-h"><span>标题备选（点击采用）</span><button class="tc-refresh mini-regen" data-action="regenField" data-field="forewordTitles">${ICON("refresh")} 换一组</button></div>${a.forewordTitles.map((t, i) => `<button class="tc-item" data-action="pickForewordTitle" data-i="${i}">${esc(t)}</button>`).join("")}</div>` : "" }
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
    let hint;
    if (missing.length) hint = `还有 <b>${missing.length}</b> 项必填信息待补充，补全后即可发布`;
    else if (inferred.length) hint = `AI 已预填 <b>${inferred.length}</b> 项，核对无误后点「全部确认」`;
    else hint = `全部事实已确认，可直接发布`;
    return `<div class="fact-confirm">
      <div class="fc-header">
        <div class="fc-head-main">
          <div class="fc-title">事实确认</div>
          <div class="fc-sub">${confirmed.length}/${total} 已核对${inferred.length ? ` · ${inferred.length} 项待确认` : ""}</div>
        </div>
        <div class="fc-progress" aria-label="事实完整度 ${progress}%">
          <div class="fc-progress-ring" style="--p:${progress}"><span class="fc-progress-num">${progress}%</span></div>
        </div>
      </div>
      <div class="fc-bar"><span style="width:${progress}%;background:${progressColor}"></span></div>
      <div class="fc-hint ${missing.length ? "warn" : inferred.length ? "wait" : "ok"}">${hint}</div>
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
        <div class="fc-tip">核对无误后点右侧的「✓」，或一键全部确认</div>
      </div>` : ""}
      ${missing.length ? `<div class="fc-section fc-missing">
        <div class="fc-sec-head"><span class="fc-dot" style="background:#ef4444"></span><b>缺失信息 · 发布前补充</b><span class="fc-count">${missing.length}</span></div>
        <div class="fc-list">
          ${missing.map((f) => `<div class="fc-row fc-row-missing"><span class="fc-label">${esc(f.label)}</span><button class="fc-edit" data-action="focusField" data-key="${f.key}">去填写 ${ICON("arrow-right")}</button></div>`).join("")}
        </div>
        <div class="fc-tip">点「去填写」直接跳到对应输入框</div>
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
    const emptyPhotoSvg = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
    const emptyCoverSvg = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M3 10h18"/></svg>';
    return `<div class="vis-tab">
      <div class="vis-sec">
        <h4>图片分析结果<span class="sim-tag">模拟分析（演示）</span></h4>
        ${photos.length ? `<div class="photo-analysis">${photos.map((src, i) => { const m = photoMeta(src); return `<div class="photo-card"><div class="pc-thumb" style="background-image:url('${src}')"></div><div class="pc-meta"><div><b>图 ${i + 1}</b>${i === cover ? " · 封面" : ""}</div>${m ? `<div>类别：${m.category} · 朝向：${m.orientation === "landscape" ? "横" : m.orientation === "portrait" ? "竖" : "方"} · 质量：${m.quality_score}</div><div>主体：${m.subjects.join("、")} · 情绪：${m.emotion}</div><div>推荐：${m.recommended_use.join("、")} · 文字区：${m.safe_text_area}</div>` : `<div class="muted small">分析中…（模拟推断）</div>`}</div></div>`; }).join("")}</div>` : `<div class="empty-state">${emptyPhotoSvg}<div><b>还没有上传图片</b><span>回到「内容」标签上传活动照片后，这里会自动分析画面并推荐用途</span></div></div>`}
      </div>
      <div class="vis-sec">
        <h4>封面图</h4>
        ${photos.length ? `<div class="cover-row">${photos.map((src, i) => `<button class="cover-thumb ${i === cover ? "sel" : ""}" data-action="setCover" data-i="${i}" style="background-image:url('${src}')"></button>`).join("")}</div><div class="tiny muted">点击选择封面（仅用于页面主视觉）</div>` : `<div class="empty-state">${emptyCoverSvg}<div><b>上传图片后可选封面</b><span>先上传照片，再从中挑选最具吸引力的一张作为活动封面</span></div></div>`}
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
        <button class="btn btn-primary btn-sm" data-action="share" data-id="${a.id}">生成分享海报</button>
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
      ${acts.length ? `<div class="activity-list">${acts.map(actCard).join("")}</div>` : `<div class="empty"><div class="e-ic">📭</div><div>该分类下还没有活动</div></div>`}
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

  function renderMemberMarketing() {
    const tiers = state.memberTiers || [];
    const coupons = state.coupons || [];
    const referral = state.referral || { enabled: false, inviterPoints: 0, inviteePoints: 0, totalInvites: 0, successInvites: 0 };
    const tab = state.mmTab || "tiers";
    const members = (state.signups || []).length;
    const activeMembers = (state.signups || []).filter((s) => s.paid).length;
    const issuedPoints = 3600; // Demo 累计发放会员积分
    const issuedCoupons = coupons.reduce((a, c) => a + (c.claimed || 0), 0);
    const tabs = [
      { k: "tiers", label: "会员等级" }, { k: "coupons", label: "优惠券" },
      { k: "exclusive", label: "会员专享" }, { k: "referral", label: "邀请裂变" }
    ];
    return `<h2 class="section-title" style="margin-bottom:6px">会员营销</h2>
      <div class="mm-overview">
        ${["会员总数", "活跃会员", "已发积分", "已发券"].map((t, i) => `<div class="mm-ov-card"><div class="mm-ov-val">${[members, activeMembers, issuedPoints, issuedCoupons][i]}</div><div class="mm-ov-label">${t}</div></div>`).join("")}
      </div>
      <div class="mm-tabs">
        ${tabs.map((t) => `<button class="mm-tab ${tab === t.k ? "active" : ""}" data-action="mmTab" data-tab="${t.k}">${t.label}</button>`).join("")}
      </div>
      ${tab === "tiers" ? `
        <div class="mm-tier-grid">
          ${(tiers).map((t) => `<div class="mm-tier" style="border-top:3px solid ${t.color}">
            <div class="mm-tier-head"><span class="mm-tier-icon" style="background:${t.color}">${ICON(t.icon)}</span><b>${t.name}</b></div>
            <div class="mm-tier-cond">升级条件：${t.minPoints === 0 ? "默认" : "累计 " + t.minPoints + " 积分"}</div>
            <ul class="mm-tier-ben">${t.benefits.map((b) => `<li>${ICON("check")}<span>${b}</span></li>`).join("")}</ul>
          </div>`).join("")}
        </div>
        <p class="muted small" style="margin-top:10px">会员等级按累计积分自动晋升，权益随等级解锁。积分通过报名、商城消费、邀请好友获取。</p>
      ` : ""}
      ${tab === "coupons" ? `
        <div class="row between" style="margin:12px 0 4px"><b>优惠券（${coupons.length}）</b><button class="btn btn-sm btn-primary" data-action="mmNewCoupon">+ 新建优惠券</button></div>
        <div class="mm-coupon-list">
          ${(coupons).map((c) => `<div class="mm-coupon ${c.status === "paused" ? "paused" : ""}">
            <div class="mm-coupon-left">
              <div class="mm-coupon-val">${c.type === "discount" ? (c.value / 10) + " 折" : "¥" + c.value}</div>
              <div class="mm-coupon-th">${c.threshold > 0 ? "满 " + c.threshold + " 可用" : "无门槛"}</div>
            </div>
            <div class="mm-coupon-body">
              <div class="mm-coupon-title">${c.title}<span class="mm-coupon-scope">${c.scope === "gear" ? "仅装备" : "全场通用"}</span></div>
              <div class="mm-coupon-meta">已领 ${c.claimed}/${c.total} · 已用 ${c.used} · ${c.status === "active" ? "发放中" : "已暂停"}</div>
              <div class="mm-coupon-bar"><div style="width:${Math.min(100, Math.round((c.claimed / c.total) * 100))}%"></div></div>
            </div>
            <button class="btn btn-sm ${c.status === "active" ? "btn-soft" : "btn-primary"}" data-action="mmToggleCoupon" data-id="${c.id}">${c.status === "active" ? "暂停" : "启用"}</button>
          </div>`).join("")}
        </div>
      ` : ""}
      ${tab === "exclusive" ? `
        <p class="muted small" style="margin:12px 0 6px">把活动标记为「会员专享」后，仅本俱乐部会员可报名，用于回馈老用户与提升复购。</p>
        <div class="mm-ex-list">
          ${(state.activities || []).map((a) => `<div class="mm-ex ${a.memberOnly ? "on" : ""}">
            <div><div class="mm-ex-title">${esc(a.title)}</div><div class="mm-ex-sub">${a.memberOnly ? "会员专享" : "全部用户可报名"}</div></div>
            <label class="switch"><input type="checkbox" ${a.memberOnly ? "checked" : ""} data-action="mmToggleMemberOnly" data-id="${a.id}"/><span class="slider"></span></label>
          </div>`).join("")}
        </div>
      ` : ""}
      ${tab === "referral" ? `
        <div class="fr-section">
          <div class="fr-section-h"><h3>邀请裂变</h3><label class="switch"><input type="checkbox" ${referral.enabled ? "checked" : ""} data-action="mmToggleReferral"/><span class="slider"></span></label></div>
          <div class="mm-ref-row">
            <div class="mm-ref-card"><div class="mm-ref-val">${referral.inviterPoints}</div><div class="muted small">邀请人奖励积分</div></div>
            <div class="mm-ref-card"><div class="mm-ref-val">${referral.inviteePoints}</div><div class="muted small">被邀请人奖励积分</div></div>
            <div class="mm-ref-card"><div class="mm-ref-val">${referral.successInvites}/${referral.totalInvites}</div><div class="muted small">成功/总邀请</div></div>
          </div>
          <p class="muted small" style="margin-top:8px">会员分享专属海报/链接给好友，好友完成首单或首登即双方各得积分，积分可用于报名抵扣与装备兑换。</p>
        </div>
      ` : ""}
    `;
  }

  /* ---------------- C 端收口（V1.0） ----------------
     4 个 tab：首页 / 商城 / 订单 / 我的。
     删除「目的地」（公共目的地本版不做）与「会员」独立 tab（会员即 C 端「我的」）。
     C 端不出现任何 B 端招商话术（免费开放 / 0% 抽成 / 佣金 / AI 额度）。 */
  function frontTabbar(active) {
    const it = (key, action, icon, label) =>
      `<div class="ft-item ${active === key ? "active" : ""}" data-action="${action}">${ICON(icon)}<span>${label}</span></div>`;
    return `<div class="front-tabbar">
      ${it("home", "openFrontHome", "home", "首页")}
      ${it("mall", "openMall", "shopping-bag", "商城")}
      ${it("orders", "myOrders", "list", "订单")}
      ${it("mine", "mySignups", "users", "我的")}
    </div>`;
  }

  // 解析活动出发时间戳：支持「2026年9月12日」「9月12日」「2026-09-12」，无法解析返回 null
  function actStartTs(a) {
    if (!a) return null;
    const src = a.date || a.dateMD || a.dateText || "";
    let m = String(src).match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    m = String(src).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();
    m = String(src).match(/(\d{1,2})\s*月\s*(\d{1,2})/);
    if (m) {
      const y = new Date().getFullYear();
      let t = new Date(y, +m[1] - 1, +m[2]).getTime();
      // 只写月日时，若已过去超过 60 天则按明年算
      if (t < Date.now() - 86400000 * 60) t = new Date(y + 1, +m[1] - 1, +m[2]).getTime();
      return t;
    }
    return null;
  }
  function daysUntil(a) {
    const t = actStartTs(a);
    if (t == null) return null;
    return Math.ceil((t - Date.now()) / 86400000);
  }

  // C 端订单页：活动报名 + 装备订单合并
  function renderMyOrders() {
    const signups = state.signups || [];
    const orders = (state.mallOrders || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const LOGI = { pending: "待发货", shipped: "已发货", signed: "已签收", done: "已完成" };
    const signupRow = (s) => {
      const a = getActivity(s.activityId);
      const st = !a ? "已结束" : a.status === "ended" ? "已完成" : s.paid ? "已付款" : "待付款";
      return `<div class="mo-row" ${a ? `data-action="openFront" data-id="${a.id}"` : ""}>
        <div class="mo-ic">${ICON("mountain")}</div>
        <div class="mo-main">
          <div class="mo-t">${esc(a ? a.title : "活动已下架")}</div>
          <div class="mo-s">${esc(a ? (a.dateMD || a.date || "日期待定") : "")}${a && a.meeting ? " · " + esc(a.meeting) : ""} · ${s.adults || 1} 人</div>
        </div>
        <div class="mo-r"><span class="mo-st ${s.paid ? "on" : ""}">${st}</span>${a && a.price ? `<span class="mo-amt">¥${a.price * (s.adults || 1)}</span>` : ""}</div>
      </div>`;
    };
    const gearRow = (o) => {
      const first = (o.items && o.items[0]) || {};
      const more = (o.items || []).length > 1 ? ` 等 ${(o.items || []).length} 件` : "";
      const st = o.refunded ? "已退款" : LOGI[o.logistics || "pending"] || "处理中";
      return `<div class="mo-row" data-action="mallProduct" data-id="${esc(first.productId || "")}">
        <div class="mo-ic">${ICON("shopping-bag")}</div>
        <div class="mo-main">
          <div class="mo-t">${esc(first.title || "装备订单")}${more}</div>
          <div class="mo-s">${o.trackingNo ? "运单 " + esc(o.trackingNo) : "下单 " + new Date(o.createdAt || Date.now()).toLocaleDateString("zh-CN")}</div>
        </div>
        <div class="mo-r"><span class="mo-st ${o.logistics === "signed" || o.logistics === "done" ? "on" : ""}">${st}</span><span class="mo-amt">¥${o.amount}</span></div>
      </div>`;
    };
    return `<div class="front">
      <div class="ps-topbar"><div class="tiny" style="font-weight:700;margin:0 auto">我的订单</div></div>
      <div class="front-body">
        <div class="fr-section">
          <div class="fr-section-h"><h3>活动报名</h3><span class="tiny muted">${signups.length} 笔</span></div>
          ${signups.length ? `<div class="mo-list">${signups.map(signupRow).join("")}</div>` : `<div class="empty">还没有报名记录，去首页挑一场山野吧</div>`}
        </div>
        <div class="fr-section" style="margin-bottom:30px">
          <div class="fr-section-h"><h3>装备订单</h3><span class="tiny muted">${orders.length} 笔</span></div>
          ${orders.length ? `<div class="mo-list">${orders.map(gearRow).join("")}</div>` : `<div class="empty">还没有装备订单，出发前可到商城一次备齐</div>`}
        </div>
      </div>
      ${frontTabbar("orders")}
      <button class="fab-service" data-action="contactOrg" aria-label="联系俱乐部客服">${ICON("headphones")}</button>
    </div>`;
  }

  // C 端会员页（消费者视角）：只讲"我参加了多少、能省多少"，不含任何俱乐部经营数据
  function renderMembershipH5() {
    const b = state.brand || {};
    const signups = state.signups || [];
    const joined = signups.length;
    const gearOrders = (state.mallOrders || []).filter((o) => !o.refunded);
    const gearSpend = gearOrders.reduce((n, o) => n + (o.amount || 0), 0);
    const name = mineName();
    const points = state.points || 0;
    const tiers = (state.memberTiers || []).slice().sort((a, c) => (a.minPoints || 0) - (c.minPoints || 0));
    let curIdx = 0;
    tiers.forEach((t, i) => { if (points >= (t.minPoints || 0)) curIdx = i; });
    const curTier = tiers[curIdx];
    const nextTier = tiers[curIdx + 1];
    const expire = state.memberExpire;
    const expireText = expire ? new Date(expire).toLocaleDateString("zh-CN") : "长期有效";
    const toNext = nextTier ? Math.max(0, (nextTier.minPoints || 0) - points) : 0;
    const progPct = nextTier ? Math.min(100, Math.round((points / Math.max(1, nextTier.minPoints || 1)) * 100)) : 100;
    const off = (d) => (d < 100 ? Math.round(d) / 10 + "折" : "");
    const perksHtml = (curTier ? (curTier.benefits || []) : []).map((bn) => `<div class="mc-perk"><span class="mc-perk-ic">${ICON("check")}</span><div><b>${esc(bn)}</b></div></div>`).join("");
    const extraPerks = (curTier && curTier.perks ? curTier.perks : []).map((p) => `<div class="mc-perk"><span class="mc-perk-ic">${ICON("gift")}</span><div><b>${esc(p)}</b></div></div>`).join("");
    const ladderHtml = tiers.map((t, i) => `
      <div class="mc-tier ${i === curIdx ? "is-current" : ""}">
        <div class="mc-tier-ic" style="background:${esc(t.color)}1a;color:${esc(t.color)}">${ICON(t.icon || "crown")}</div>
        <div class="mc-tier-main">
          <div class="mc-tier-top"><b>${esc(t.name)}</b>${off(t.discount) ? `<span class="mc-tier-off">${off(t.discount)}</span>` : ""}</div>
          <div class="mc-tier-sub">${t.minPoints > 0 ? "需 " + t.minPoints + " 积分" : "默认等级"}</div>
        </div>
        ${i === curIdx ? `<span class="mc-tier-now">当前</span>` : ""}
      </div>`).join("");
    return `<div class="front front-v16">
      <div class="ps-topbar"><button class="btn btn-ghost btn-sm" data-action="mySignups">${ICON("arrow-left")} 返回</button><div class="tiny" style="font-weight:700">会员中心</div></div>
      <div class="front-body">
        <div class="mc-card">
          <div class="mc-card-h"><span>${esc(b.name || "俱乐部")}会员</span>${ICON("crown")}</div>
          <div class="mc-card-name">${esc(name)}</div>
          <div class="mc-points-row"><span class="mc-points-num">${points}</span><span class="mc-points-label">会员积分</span></div>
          <div class="mc-card-sub">已参加 ${joined} 场活动 · 装备消费 ¥${gearSpend} · 有效期 ${expireText}${curTier ? " · " + esc(curTier.name) : ""}</div>
        </div>
        <div class="fr-section">
          <div class="fr-section-h"><h3>我的权益${curTier ? " · " + esc(curTier.name) : ""}</h3></div>
          <div class="mc-perks">
            ${curTier && curTier.discount < 100 ? `<div class="mc-perk"><span class="mc-perk-ic">${ICON("tag")}</span><div><b>会员折扣 ${off(curTier.discount)}</b><span>商城装备与报名享专属价</span></div></div>` : ""}
            ${perksHtml}
            ${extraPerks}
          </div>
        </div>
        <div class="fr-section">
          <div class="fr-section-h"><h3>会员成长</h3></div>
          <div class="mc-ladder">${ladderHtml}</div>
          <div class="mc-upgrade-box">
            ${nextTier
              ? `<div class="mc-grow"><div class="mc-grow-t">距离「${esc(nextTier.name)}」还差 <b>${toNext}</b> 积分</div><div class="mc-progress"><div style="width:${progPct}%"></div></div></div>`
              : `<div class="mc-grow done">已是最高会员等级</div>`}
            <button class="btn btn-primary btn-block" data-action="memberUpgrade">${nextTier ? "升级会员" : "查看会员权益"}</button>
          </div>
        </div>
        <div class="fr-section" style="margin-bottom:30px">
          <div class="fr-section-h"><h3>联系我们</h3></div>
          <div class="mc-contact">
            ${b.wechat ? `<div class="mc-contact-row">${ICON("send")}<span>微信 ${esc(b.wechat)}</span></div>` : ""}
            ${b.phone ? `<div class="mc-contact-row">${ICON("headphones")}<span>${esc(b.phone)}</span></div>` : ""}
            ${b.address ? `<div class="mc-contact-row">${ICON("map-pin")}<span>${esc(b.address)}</span></div>` : ""}
          </div>
        </div>
      </div>
      ${frontTabbar("mine")}
    </div>`;
  }

  function openMemberUpgrade() {
    const b = state.brand || {};
    const tiers = (state.memberTiers || []).slice().sort((a, c) => (a.minPoints || 0) - (c.minPoints || 0));
    const ms = state.membershipSettings || {};
    const cs = ms.conditions || {};
    const cond = [];
    if (cs.followers && cs.followers.enabled) cond.push("关注公众号 ≥ " + cs.followers.value);
    if (cs.phone && cs.phone.enabled) cond.push("绑定手机号");
    if (cs.orders && cs.orders.enabled) cond.push("报名 ≥ " + cs.orders.value + " 场");
    if (cs.spend && cs.spend.enabled) cond.push("累计消费 ≥ ¥" + cs.spend.value);
    if (cs.recharge && cs.recharge.enabled) cond.push("充值 ≥ ¥" + cs.recharge.value);
    const off = (d) => (d < 100 ? Math.round(d) / 10 + "折" : "无折扣");
    const mask = document.createElement("div");
    mask.className = "modal-mask";
    mask.innerHTML = `<div class="upgrade-sheet" role="dialog" aria-label="会员升级">
      <button class="modal-close-x" data-action="closeModal" aria-label="关闭">${ICON("x")}</button>
      <div class="up-head">
        <div class="up-brand">${esc(b.name || "俱乐部")} · 会员体系</div>
        <h3 class="up-title">开通会员，享专属权益</h3>
      </div>
      <div class="up-note">${cond.length ? "成为会员需满足（" + (ms.conditionMatch === "all" ? "全部" : "任一") + "）：" + cond.join("、") : "完成手机号绑定即可成为会员。"}</div>
      <div class="mc-sheet-tiers">
        ${tiers.map((t) => `<div class="mc-sheet-tier">
          <div class="mc-sheet-tier-h"><span class="mc-sheet-tier-ic" style="background:${esc(t.color)}1a;color:${esc(t.color)}">${ICON(t.icon || "crown")}</span><b>${esc(t.name)}</b><span class="mc-sheet-off">${off(t.discount)}</span></div>
          <div class="mc-sheet-tier-sub">${t.minPoints > 0 ? "需 " + t.minPoints + " 积分" : "默认等级"}</div>
          <ul class="mc-sheet-ben">${((t.benefits || []).map((bn) => `<li>${ICON("check")}<span>${esc(bn)}</span></li>`).join(""))}</ul>
        </div>`).join("")}
      </div>
      <button class="btn btn-primary btn-block up-cta" data-action="toast" data-msg="演示环境，会员开通功能开发中">立即开通（Demo）</button>
    </div>`;
    document.body.appendChild(mask);
    mask.addEventListener("click", (e) => { if (e.target === mask) mask.remove(); });
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
