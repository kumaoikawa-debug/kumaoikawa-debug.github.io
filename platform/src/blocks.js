/* ClubOS Platform — modular build (split from monolithic app.js v81).
   Loaded as classic <script> in order; shared global scope, no bundler. */
  function closeAvatarCropper() {
    const overlay = $("#avatarCropOverlay");
    if (overlay && overlay._cropCleanup) overlay._cropCleanup();
    if (overlay) overlay.remove();
    cropState = null;
  }
  function confirmAvatarCrop() {
    if (!cropState || !cropState.w || !state.draft) { closeAvatarCropper(); return; }
    const img = new Image();
    img.onload = () => {
      const { w, h, scale, x, y } = cropState;
      const imgW = w * scale;
      const imgH = h * scale;
      const baseX = (CROP_VIEW - imgW) / 2;
      const baseY = (CROP_VIEW - imgH) / 2;
      const left = baseX + x;
      const top = baseY + y;
      const sx = -left / scale;
      const sy = -top / scale;
      const sSize = CROP_VIEW / scale;
      const c = document.createElement("canvas");
      c.width = CROP_OUT; c.height = CROP_OUT;
      const cx = c.getContext("2d");
      cx.drawImage(img, sx, sy, sSize, sSize, 0, 0, CROP_OUT, CROP_OUT);
      state.draft._leaderAvatarDraft = c.toDataURL("image/png");
      saveState();
      rerenderEditor();
      closeAvatarCropper();
    };
    img.src = cropState.src;
  }

  // 兼容旧逻辑：单领队字段仍可通过 confirmFact 识别
  function matchLeaderByFields(a) {
    return (state.leaders || []).find((l) =>
      l.name === (a.leaderName || "") &&
      l.years === (a.leaderYears || "") &&
      l.cert === (a.leaderCert || "") &&
      l.trips === (a.leaderTrips || "")
    );
  }
  function blockStats(a) {
    const items = [];
    if (a.elevation) items.push(["海拔", a.elevation + " m"]);
    items.push(["天数", (a.days > 1 ? a.days + " 天" : "单日")]);
    items.push(["难度", a.difficulty || "待确认"]);
    if (!items.length) return "";
    return `<div class="stat-row">${items.map(([k,v]) => `<div class="stat"><span class="s-k">${esc(k)}</span><div class="s-v">${esc(v)}</div></div>`).join("")}</div>`;
  }
  function blockRoute(a) {
    const facts = [];
    if (a.distance) facts.push(["路线距离", a.distance + " 公里"]);
    if (a.elevation) facts.push(["累计爬升", a.elevation + " 米"]);
    if (a.days > 1) facts.push(["行程天数", a.days + " 天"]);
    if (!facts.length) return "";
    return `<section class="route-facts"><h3>路线数据</h3><div class="route-list">${facts.map(([k, v]) => `<div class="route-fact"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div><p class="route-note">具体轨迹、爬升和路况以机构确认的真实行程为准。</p></section>`;
  }
  function atmosphereSentence(a) {
    const p = a.place || "这里";
    const f = placeFlavorFor(a);
    const s = (f.seasonLine || "").replace(/[。，]/, "");
    const dir = a.contentStrategy || {};
    const mood = dir.mood || "";
    const lines = [
      `${s ? s + "，" : ""}${p}的${a.type}，是把自己从日常里短暂打捞出来的方式。`,
      `去${p}，不是为了逃避城市，是为了让${a.type === "滑雪" ? "雪" : "风"}把节奏重新吹慢。`,
      `在${p}，${a.type}不是表演，是认真在场。`,
      `${p}不会承诺你什么，但会给你一段真实的时间。`,
      `这个${a.dateMD || "周末"}，和${p}一起醒来。`,
      `${a.type}的真正奖励，从来不是终点，是${p}路上的那阵风。`,
      `去${p}，把${a.type}过成一种看得见的生活。`
    ];
    // 按方向 mood 轻微排序，让氛围句与主方向呼应
    const scored = lines.map((l, i) => {
      let sc = i;
      if (mood === "诗意" && /风|云|光/.test(l)) sc += 3;
      if (mood === "逃离" && /逃避|打捞|日常/.test(l)) sc += 3;
      if (mood === "完成" && /终点|奖励/.test(l)) sc += 3;
      if (mood === "陪伴" && /一起|陪伴/.test(l)) sc += 3;
      if (s && l.includes(s.slice(0, 6))) sc += 2;
      return { l, sc };
    }).sort((x, y) => y.sc - x.sc);
    return scored[0].l;
  }
  function blockAtmosphere(a, text) {
    const ac = styleAccent(a);
    return `<div class="atmosphere" style="background:${ac.grad}"><div class="at-ic">${ICON("quote")}</div><div class="at-txt">${esc(text)}</div></div>`;
  }
  function blockVideo(a) {
    if (a.videos && a.videos[0]) return `<div class="video-card"><video class="vc" src="${a.videos[0]}" muted loop autoplay playsinline poster="${((a.photos||[])[0]||"")}" onerror="this.style.display='none'"></video><span class="vc-play">${ICON("play")}</span><span class="vc-dur">真实活动记录</span></div>`;
    return ""; // 无视频内容时直接隐藏模块，不显示占位
  }
  function blockReviews(a) {
    if (!a.reviews || !a.reviews.length) return ""; // 无真实评价时隐藏，绝不冒充
    return `<div class="reviews"><div class="rv-head">往期评价</div>${a.reviews.slice(0, 6).map((r)=>`<div class="rv"><div class="rv-av" style="${r.avatar?`background-image:url('${esc(r.avatar)}')`:''}"></div><div class="rv-body"><div class="rv-row"><span class="rv-name">${esc(r.name||"匿名用户")}</span><span class="rv-stars">${"★".repeat(r.stars||5)}</span></div><div class="rv-txt">${esc(r.text||"")}</div></div></div>`).join("")}</div>`;
  }
  /* ===== V2.0 动态区块编排 =====
     区块只是渲染能力；顺序、是否出现、图片分配均由「内容 + 素材数量 + 数据有无」决定，
     不再按活动类型套用整页固定模板。节奏：感性吸引 → 视觉证据 → 故事 → 记忆点
     → 更多视觉 → 强度与适合人群 → 行程/服务/费用 → 报名。 */
  function buildPageOutline(a) {
    const photos = a.photos || [];
    const n = photos.length;
    const T = a.type;
    const isFam = isFamilyActivity(a);
    const hasItin = (a.itineraryDays || []).some((d) => (d.items || []).some((t) => t && (t.time || t.text)));
    const hasVideo = !!(a.videos && a.videos[0]);
    const hasReviews = !!(a.reviews && a.reviews.length);
    const hasLeader = !!a.leaderName;
    const hasGear = !!(a.gear && a.gear.length);
    const hasHl = !!(a.highlights && a.highlights.length);
    const svc = [];
    if (a.includeLeader) svc.push("领队");
    if (a.includeMeal) svc.push("餐食");
    if (a.includeInsurance) svc.push("保险");
    if (a.includeTransport) svc.push("交通");
    if (a.includeGear) svc.push("装备");

    const cover = Math.max(0, Math.min(+(a.coverIndex || 0), Math.max(0, n - 1)));
    const ranked = photos.map((src, i) => {
      const m = photoMeta(src);
      let score = m ? (m.quality_score || 0) * 100 : 50;
      if (m && m.orientation === "landscape") score += 8;
      if (i === cover) score = -1;
      return { i, score };
    }).filter((x) => x.i !== cover).sort((x, y) => y.score - x.score || x.i - y.i).map((x) => x.i);
    let cursor = 0;
    const take = (k) => {
      const result = ranked.slice(cursor, cursor + k);
      cursor += result.length;
      return result;
    };

    const fallbackStoryPurpose =
      T === "高海拔登山" ? "说明海拔、强度与每一天的行进目标"
      : (T === "城市旅行" || T === "景区观光") ? "呈现城市街区与生活方式"
      : T === "露营" ? "营地、夜晚与慢下来的时间"
      : T === "漂流" || T === "溯溪" || T === "桨板或皮划艇" ? "水、浪与出发前的那一下心跳"
      : T === "企业团建" ? "团队在一起完成的动作"
      : isFam ? "人物互动与共同完成的过程"
      : T === "徒步" ? "路线、距离与沿途变化"
      : "活动当天的真实过程";
    const storyPurpose = (a.storyPurpose && String(a.storyPurpose).trim()) || fallbackStoryPurpose;

    const out = [];
    let capIdx = 0;
    // 只使用 AI/用户提供的真实照片配文；没有配文时不展示内部用途标签
    const nextCaption = () => {
      const caps = a.photoCaptions || [];
      const c = caps[capIdx];
      capIdx++;
      return (c && String(c).trim()) ? String(c).trim() : "";
    };

    // 自适应相册：按照片数量把图分组，营造杂志式“大图 + 留白 + 图文交错”的节奏
    function splitPhotos(cnt) {
      if (cnt <= 0) return [];
      if (cnt === 1) return [1];
      if (cnt === 2) return [2];
      if (cnt === 3) return [3];
      if (cnt === 4) return [2, 2];
      if (cnt === 5) return [3, 2];
      if (cnt === 6) return [3, 3];
      if (cnt === 7) return [3, 2, 2];
      if (cnt === 8) return [3, 3, 2];
      if (cnt === 9) return [3, 3, 3];
      return [3, 3, 3, cnt - 9]; // 10 张以上：末组吃剩余
    }
    function photoCls(c) { return c === 1 ? "v2-full" : c === 2 ? "v2-pair" : c === 3 ? "v2-trio" : c === 4 ? "v2-grid" : "v2-mosaic"; }
    const bodyParas = (a.body && a.body.length) ? a.body.slice() : [];
    let bodyCursor = 0;
    // 图文交错：每放一组图就接一段正文，形成连续阅读节奏；无图时正文集中呈现
    function emitStory() {
      const remain = Math.max(0, ranked.length - cursor);
      const groups = splitPhotos(remain);
      groups.forEach((c) => {
        const p = take(c);
        if (!p.length) return;
        out.push({ type: "gallery", cls: photoCls(p.length), caption: nextCaption(), photos: p });
        if (bodyCursor < bodyParas.length) { out.push({ type: "text_block", para: bodyCursor }); bodyCursor++; }
      });
      while (bodyCursor < bodyParas.length) { out.push({ type: "text_block", para: bodyCursor }); bodyCursor++; }
    }
    const pushFull = () => { const f = take(1); if (f.length) out.push({ type: "gallery", cls: "v2-full", caption: nextCaption(), photos: f }); };

    // 开场策略按活动类型不同，中段图文统一智能交错，不再套用单一版式
    if (T === "高海拔登山") {
      out.push({ type: "metric_strip", purpose: "先判断海拔与强度" });
      pushFull();
      out.push({ type: "editorial_lead", purpose: "说明挑战的具体边界" });
      out.push({ type: "suitability", purpose: "说明适合与不适合人群" });
      out.push({ type: "pull_quote", purpose: "强调认真准备" });
      emitStory();
      out.push({ type: "route_story", purpose: "路线、距离与海拔信息" });
    } else if (T === "城市旅行" || T === "景区观光") {
      out.push({ type: "editorial_lead", purpose: "建立本次城市体验的主线" });
      emitStory();
      out.push({ type: "pull_quote", purpose: "形成城市记忆点" });
      pushFull();
      out.push({ type: "metric_strip", purpose: "快速判断时间与费用" });
    } else if (isFam) {
      out.push({ type: "editorial_lead", purpose: "说明这次同行将完成什么" });
      emitStory();
      out.push({ type: "pull_quote", purpose: "留下本场活动的记忆句" });
      pushFull();
      out.push({ type: "metric_strip", purpose: "帮助快速判断" });
    } else {
      pushFull();
      out.push({ type: "editorial_lead", purpose: "说明这场活动为什么值得来" });
      out.push({ type: "pull_quote", purpose: "形成记忆点" });
      emitStory();
      out.push({ type: "metric_strip", purpose: "快速判断强度与时间安排" });
      if (T === "徒步" || T === "高海拔登山") out.push({ type: "route_story", purpose: "路线与距离信息" });
    }
    out.push({ type: "selling_points", purpose: "路线核心卖点（多阶段管线输出）" });
    if (hasVideo) out.push({ type: "video", purpose: "真实活动记录" });

    // 决策信息
    if (hasItin) out.push({ type: "itinerary", purpose: "提供理性决策信息" });
    else out.push({ type: "itinerary", purpose: "提示真实行程待补充", pending: true });
    if (svc.length) out.push({ type: "services", purpose: "说明已确认服务" });
    if (hasGear) out.push({ type: "gear", purpose: "出发前建议准备什么" });
    if (hasLeader) out.push({ type: "leader_safety", purpose: "真实领队资料" });
    out.push({ type: "fee", purpose: "说明价格与费用包含/不含" });
    if (hasHl) out.push({ type: "highlights", purpose: "归纳核心卖点" });
    if (hasReviews) out.push({ type: "reviews", purpose: "往期真实评价" });
    out.push({ type: "travel_notes", purpose: "退改与安全须知（多阶段管线输出）" });
    out.push({ type: "org", purpose: "机构信息" });
    return out;
  }

  // 适合 / 不适合人群：只依据已确认事实，不做医疗或安全承诺
  function blockSuitability(a) {
    const fit = [], unfit = [];
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    if (confirmed.has("age")) {
      fit.push("符合机构确认的年龄范围：" + a.ageRange);
      unfit.push("年龄不在 " + a.ageRange + " 范围内");
    }
    if (confirmed.has("difficulty")) fit.push("能够完成机构确认的“" + a.difficulty + "”强度");
    if (confirmed.has("days") && a.days > 1) fit.push("可以完整参加 " + a.days + " 天行程");
    if (confirmed.has("meetTime") && confirmed.has("meeting")) fit.push("可以按时到达 " + a.meeting);
    if (a.type === "高海拔登山" && !confirmed.has("difficulty")) unfit.push("尚未与机构确认体能和经验要求的人");
    if (!fit.length) fit.push("请先向机构确认年龄、体能和经验要求");
    if (!unfit.length) unfit.push("不符合机构最终报名条件的人");
    if (!fit.length && !unfit.length) return "";
    return `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("users")}</span><h3>适合与不适合</h3></div><div class="suit-grid">`
      + (fit.length ? `<div class="suit-col ok"><div class="suit-h">适合</div>${fit.map((t) => `<div class="suit-row">${ICON("check")}<span>${esc(t)}</span></div>`).join("")}</div>` : "")
      + (unfit.length ? `<div class="suit-col no"><div class="suit-h">不适合</div>${unfit.map((t) => `<div class="suit-row">${ICON("x")}<span>${esc(t)}</span></div>`).join("")}</div>` : "")
      + `</div></div>`;
  }

  function pageComposition(a) {
    if (a.type === "高海拔登山") return "expedition";
    if (a.type === "城市旅行" || a.type === "景区观光") return "city-guide";
    if (isFamilyActivity(a)) return "family-journal";
    if (a.type === "露营") return "camp-diary";
    return "route-journal";
  }

  function editorialSectionTitle(a) {
    if (a.editorialTitle && String(a.editorialTitle).trim()) return String(a.editorialTitle).trim();
    if (a.type === "高海拔登山") return "先看清强度，再决定是否出发";
    if (a.type === "城市旅行" || a.type === "景区观光") return `把${a.days > 1 ? a.days + "天" : "这一天"}留给${a.place}`;
    if (isFamilyActivity(a)) return a.distance ? `让孩子自己走完这${a.distance}公里` : "让孩子自己完成这一次";
    if (a.distance) return `这${a.distance}公里，具体意味着什么`;
    return `为什么是这次${a.place}${a.type}`;
  }

  /* ============ V2.1 文案深度引擎：Prompt Enhancer + 去 AI 味 + 公式 + 多阶段管线 ============ */
  // —— 去 AI 味黑名单：删除空洞无画面感词汇（出现即剔除）——
;


  // —— Prompt Enhancer：隐式变量补全 + 风格路由 ——




  // —— 公式化结构：[情绪Hook/痛点反差] + [核心场景/五感体验] + [轻量干货] + [行动召唤] ——





  // —— 多阶段管线：阶段 A 爆款标题与情绪前言 ——



  // —— 阶段 B 路线核心卖点（3 个具象场景卖点）——


  // —— 阶段 C 逻辑化逐日行程 ——


  // —— 阶段 D 后勤干货与安全须知 ——





  function pipelineSellingHtml(a) {
    const pl = a.pipeline;
    if (!pl || !pl.sellingPoints || !pl.sellingPoints.length) return "";
    return `<div class="dsec sp-sec"><div class="dsec-h"><span class="dsec-ic">${ICON("sparkles")}</span><h3>路线核心卖点</h3></div>${pl.sellingPoints.map((s, i) => `<div class="sp-card"><div class="sp-no">0${i + 1}</div><div class="sp-body"><b>${esc(s.title)}</b><p>${esc(s.desc)}</p></div></div>`).join("")}</div>`;
  }
  function pipelineNotesHtml(a) {
    const pl = a.pipeline;
    if (!pl || !pl.details) return "";
    const d = pl.details;
    const refund = (d.refund && d.refund.length) ? `<div class="note-block"><div class="note-h">退改守则</div>${d.refund.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}</div>` : "";
    const alt = (d.altitude && d.altitude.length) ? `<div class="note-block"><div class="note-h">高海拔提示</div>${d.altitude.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}</div>` : "";
    const gear = (!a.gear || !a.gear.length) ? `<div class="note-block"><div class="note-h">装备建议</div><div class="note-sub">强制</div>${d.must.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}<div class="note-sub">建议</div>${d.suggest.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}</div>` : "";
    return `<div class="dsec note-sec"><div class="dsec-h"><span class="dsec-ic">${ICON("shield")}</span><h3>出行须知</h3></div>${refund}${alt}${gear}</div>`;
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

    function lightTags(a) {
      const arr = [];
      if (confirmedFacts(a).some((f) => f.key === "age")) arr.push(a.ageRange);
      else if (isFamily) arr.push("亲子活动");
      if (confirmedFacts(a).some((f) => f.key === "difficulty")) arr.push(a.difficulty + "难度");
      arr.push(a.days > 1 ? a.days + " 天" : "1 天");
      if (a.limit) arr.push("限" + a.limit + a.limitUnit);
      return arr;
    }

    // —— AI 生成内容守卫：避免空数组渲染出空白区块 ——
    const core = coreTags(a).filter(Boolean);                  // 可能 0 个
    const hl = (a.highlights || []).filter((x) => x && x[0]); // 可能 0 个
    const introTxt = (a.intro && String(a.intro).trim())
      ? a.intro
      : "活动介绍将在事实确认后生成。";

    const blocks = {
      timeline: `<div class="dsec itinerary-editorial"><div class="dsec-h"><span class="dsec-ic">${ICON("clock")}</span><h3>详细行程${a.days > 1 ? ` · 共 ${a.days} 天` : ""}</h3></div>${(a.itineraryDays || []).map((day) => { const items = (day.items || []).filter((t) => t && (t.time || t.text)); return `<div class="day-block"><div class="day-head"><span class="day-dot"></span>${esc(day.label)}${day.sub ? ` <span class="day-sub">${esc(day.sub)}</span>` : ""}</div>${items.length ? `<div class="timeline">${items.map((t) => `<div class="tl-item"><div class="tl-node"></div><div class="t">${esc(t.time)}</div><div class="d">${esc(t.text)}</div></div>`).join("")}</div>` : `<div class="tl-empty">本日行程待机构补充。</div>`}</div>`; }).join("") || `<div class="pending-section"><b>真实行程待补充</b><span>补充后才会进入客户页面和发布检查。</span></div>`}</div>`,
      highlights: hl.length ? `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("sparkles")}</span><h3>为什么值得参加</h3></div>${hl.map((h) => `<div class="hl"><div class="ic">${ICON(h[1] || "star")}</div><div class="txt">${esc(h[0])}</div></div>`).join("")}</div>` : "",
      gear: (() => {
        const gm = matchGearProducts(a);
        return `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("backpack")}</span><h3>装备建议</h3></div><div class="gear-list">${gearRender(a, true, gm.gearProduct)}${gearRender(a, false, gm.gearProduct)}</div>${renderGearMall(a, gm.matchedIds)}</div>`;
      })(),
      org: `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("home")}</span><h3>关于${esc(state.brand.name)}</h3></div><div class="org-block">${orgLogo()}<div><div style="font-weight:700">${esc(state.brand.name)}</div>${(isFamily || !/亲子|孩子|儿童|少年/.test(state.brand.intro || "")) && state.brand.intro ? `<div class="tiny muted" style="margin:3px 0;line-height:1.6">${esc(state.brand.intro)}</div>` : ""}<div class="tiny muted">客服微信：${esc(state.brand.wechat)} · ${esc(state.brand.phone)}</div></div></div></div>`,
    };
    // V2.0：按编排结果渲染；图片索引由编排层分配，同一张图不会重复填满多个模块
    function imgBlock(idxs, cls, caption) {
      const list = (idxs || []).filter((i) => a.photos && a.photos[i]);
      if (!list.length) return "";
      const cap = (caption && String(caption).trim()) ? String(caption).trim() : "";
      return `<figure class="v2-img ${cls}"><div class="v2-img-wrap">${list.map((i) => mediaBlock(a, i, "")).join("")}</div>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ""}</figure>`;
    }
    const servicesBlock = guaran.length
      ? `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("shield")}</span><h3>已确认服务</h3></div><div class="service-chips">${guaran.map((g)=>`<div class="service-chip"><span class="sc-ic">${ICON(guaranIcons[g] || "check")}</span><span>${esc(g)}</span></div>`).join("")}</div></div>`
      : "";
    const renderBlock = (b) => {
      switch (b.type) {
        case "editorial_lead": {
          const title = editorialSectionTitle(a);
          const hookTxt = (a.hook && a.hook.trim()) ? `<p class="story-hook">${esc(a.hook.trim())}</p>` : "";
          const introParas = introTxt.split(/\n+/).map((p) => p.trim()).filter(Boolean);
          if (!title && !hookTxt && !introParas.length) return "";
          return `<section class="v13-story">${title ? `<h3>${esc(title)}</h3>` : ""}${hookTxt}${introParas.map((p)=>`<p>${esc(p)}</p>`).join("")}</section>`;
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
        case "metric_strip": return blockStats(a);
        case "suitability": return blockSuitability(a);
        case "route_story": return blockRoute(a);
        case "itinerary": return blocks.timeline;
        case "services": return servicesBlock;
        case "gear": return blocks.gear;
        case "video": return blockVideo(a);
        case "reviews": return blockReviews(a);
        case "leader_safety": return blockLeader(a);
        case "highlights": return blocks.highlights;
        case "selling_points": return pipelineSellingHtml(a);
        case "travel_notes": return pipelineNotesHtml(a);
        default: return "";
      }
    };
    const story = buildPageOutline(a).map(renderBlock).join("\n");

    return `
      <div class="activity-page composition-${composition}">
      <div class="ps-topbar">${psLogo()}</div>
      <div class="cover type-${a.pageStyle} composition-${composition}" style="${hasPhoto ? "" : `background:${ac.grad}`}">
        ${hasPhoto ? `<img class="cover-img" data-smart-img src="${coverSrc}" alt="${esc(a.place || a.type)}活动主视觉" style="object-position:${smartPos(coverSrc)}">` : `<div class="cover-pattern"></div>`}
        <div class="scrim"></div>
        <button class="fav" data-action="toast" data-msg="已收藏">${ICON("heart")}</button>
        <div class="ct">
          <div class="cover-context">${esc(a.type)}${a.distance ? ` / ${a.distance}公里` : ""}${a.elevation ? ` / ${a.elevation}米` : ""}</div>
          <h2 class="cover-title">${esc(a.title)}</h2>
          <div class="cover-meta-pill"><span>${ICON("calendar")} ${esc(a.date || a.dateMD || "日期待定")}</span><span class="meta-div"></span><span>${ICON("map-pin")} ${esc(a.meeting || "集合点待定")}</span></div>
        </div>
      </div>

      <div class="detail-body composition-${composition}">
        <div class="detail-hero-stack">
          <div class="quote-card">
            <span class="quote-mark">“</span>
            <p>${esc((a.insight && a.insight.primary_selling_point) || a.title)}</p>
            ${core.length ? `<div class="core-tags">${core.map((t)=>`<span class="core-tag">${esc(t)}</span>`).join("")}</div>` : ""}
          </div>

          <div class="info-board">
            <div class="info-cell">
              <div class="ic-t"><span class="ici ici-cal">${ICON("calendar")}</span><span class="k">时间</span></div>
              <div class="v">${esc(a.dateMD || a.date || "待定")}</div>
            </div>
            <div class="info-cell">
              <div class="ic-t"><span class="ici ici-loc">${ICON("map-pin")}</span><span class="k">集合</span></div>
              <div class="v">${esc(a.meeting || "待定")}</div>
            </div>
            <div class="info-cell info-price">
              <div class="ic-t"><span class="ici ici-price">${ICON("tag")}</span><span class="k">价格</span></div>
              <div class="v">${a.price ? "¥" + a.price + "<small>/" + esc(a.limitUnit) + "</small>" : (a.priceTBD ? "待定" : "详询")}</div>
            </div>
            <div class="info-cell info-seat">
              <div class="ic-t"><span class="ici ici-seat">${ICON("users")}</span><span class="k">名额</span></div>
              <div class="v">${a.limit ? `<b>${a.signups || 0}</b>/<span>${a.limit}</span>${esc(a.limitUnit)}` : "不限"}</div>
            </div>
          </div>

          ${departuresBlockHtml(a)}

          <div class="tag-strip">${lightTags(a).map((t)=>`<span class="ts-pill">${esc(t)}</span>`).join("")}</div>
        </div>

        ${story}

        ${blocks.org}

        <div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("credit-card")}</span><h3>费用说明</h3></div>
          <div class="fee-card">
            <div class="fee-row fee-total"><span>活动价格</span><b>${a.price ? "¥" + a.price + " / " + a.limitUnit : "详询"}</b></div>
            ${fee.length ? `<div class="fee-sep"></div><div class="fee-subh">费用包含</div>${fee.map((f)=>`<div class="fee-row"><span class="fee-dot">${ICON("check")}</span><span>${esc(f)}</span></div>`).join("")}` : ""}
            ${(a.feeExclude||[]).length ? `<div class="fee-sep"></div><div class="fee-subh">费用不含</div>${(a.feeExclude||[]).map((f)=>`<div class="fee-row"><span class="fee-dot x">${ICON("x")}</span><span>${esc(f)}</span></div>`).join("")}` : ""}
            ${a.feeSummary ? `<div class="fee-summary">${esc(a.feeSummary)}</div>` : ""}
          </div>
        </div>
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
        ${isAdminMode() ? `<button class="nav-item platform-entry" data-action="enterPlatform"><span class="ic">${ICON("building")}</span>平台后台</button>` : ""}
        ${navItem("dashboard", "工作台", "home", active)}
        ${navItem("create", "AI 创建活动", "sparkles", active)}
        ${navItem("list", "活动管理", "list", active)}
        ${navItem("signups", "报名名单", "users", active)}
        ${navItem("ai", "AI 设置", "cpu", active)}
        ${navItem("brand", "品牌设置", "palette", active)}
        ${navItem("mallConsole", "装备商城", "shopping-bag", active)}
        ${navItem("analytics", "数据运营", "bar-chart", active)}
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
  function isPlatformView(v) { return ["platformAudit", "platformClubs", "platformToken", "platformMall", "platformAftersale", "platformData", "platformSettle", "platformPromo"].includes(v); }
  function platformNavItem(view, label, icon, active) {
    return `<button class="nav-item ${active === view ? "active" : ""}" data-action="nav" data-view="${view}"><span class="ic">${ICON(icon)}</span>${label}</button>`;
  }
  function renderPlatformShell(content, active) {
    return `<div class="shell platform-shell">
      <aside class="sidebar">
        <div class="brand-mark">
          <div class="brand-logo">${ICON("building")}</div>
          <div><div class="brand-name">ClubOS 总平台</div><div class="brand-sub">统管入驻 · 权限 · AI额度 · 商城</div></div>
        </div>
        ${platformNavItem("platformAudit", "入驻审核", "clipboard", active)}
        ${platformNavItem("platformClubs", "俱乐部管理", "users", active)}
        ${platformNavItem("platformToken", "AI额度", "cpu", active)}
        ${platformNavItem("platformMall", "商城平台", "store", active)}
        ${platformNavItem("platformAftersale", "售后管理", "shield", active)}
        ${platformNavItem("platformData", "全局数据", "bar-chart", active)}
        ${platformNavItem("platformSettle", "分账结算", "wallet", active)}
        ${platformNavItem("platformPromo", "推广营销", "share", active)}
        <div class="sidebar-foot">
          ${state.platformAccount ? `<div class="tiny muted center" style="margin-bottom:8px">平台账号 ${esc(state.platformAccount)}</div>` : ""}
          <button class="btn btn-soft btn-sm btn-block" data-action="platformLogout">退出平台账号</button>
        </div>
      </aside>
      <main class="content" id="content">${content}</main>
    </div>`;
  }
  function getPlatformClubs() { return state.platformClubs || []; }
  function clubNameOf(cid) {
    const c = (state.platformClubs || []).find((x) => x.id === cid);
    if (c) return c.name;
    if (cid === "club_demo") return (state.brand && state.brand.name) || "本俱乐部";
    return cid || "未知";
  }
  const PLATFORM_PERMS = [
    { key: "aiCreate", label: "AI 创建活动" },
    { key: "gearFusion", label: "活动×装备融合" },
    { key: "membership", label: "会员体系" },
    { key: "marketing", label: "营销中心" },
    { key: "data", label: "数据运营" },
  ];
  function clubStatusBadge(st) {
    return st === "pending" ? `<span class="mall-cat" style="background:#FCEBEB;color:#A32D2D">待审核</span>`
      : st === "approved" ? `<span class="mall-cat" style="background:#EAF3DE;color:#3B6D11">已通过</span>`
      : `<span class="mall-cat" style="background:#F1EFE8;color:#5F5E5A">已拒绝</span>`;
  }
  function fulfillmentLabel(m) { return { cloud_warehouse: "云仓代发", supplier_direct: "供应商直发" }[m] || m || "—"; }
  function supplierName(sid) { const s = (state.suppliers || []).find((x) => x.id === sid); return s ? s.name : (sid || "—"); }
  function sourceTypeLabel(t) { return { club_shop: "俱乐部商城", ai_gear_list: "活动装备清单", activity_detail: "活动详情", referral: "推荐转化" }[t] || (t || "其他"); }
  function renderPlatformAudit() {
    const clubs = getPlatformClubs();
    const pending = clubs.filter((c) => c.status === "pending").length;
    const approved = clubs.filter((c) => c.status === "approved").length;
    const rejected = clubs.filter((c) => c.status === "rejected").length;
    return `
      <div class="section-head"><div class="section-title">入驻审核</div><div class="section-sub">俱乐部免费入驻，平台审核后开通全功能与商城权限</div></div>
      <div class="an-row">
        <div class="an-card"><div class="an-card-h">${ICON("clipboard")}<span>待审核</span></div><div class="an-card-v">${pending}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("check")}<span>已通过</span></div><div class="an-card-v">${approved}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("x")}<span>已拒绝</span></div><div class="an-card-v">${rejected}</div></div>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>入驻申请队列</h3></div>
        ${clubs.map((c) => `
          <div class="club-row">
            <div class="club-info"><div class="club-name">${esc(c.name)}</div><div class="club-sub">${esc(c.region)} · ${esc(c.contact)} · ${esc(c.phone)} · 申请 ${esc(c.appliedAt)}</div></div>
            <div class="club-actions">${clubStatusBadge(c.status)}${c.status === "pending" ? `<button class="btn btn-primary btn-sm" data-action="platformApproveClub" data-id="${c.id}">通过</button><button class="btn btn-ghost btn-sm" data-action="platformRejectClub" data-id="${c.id}">拒绝</button>` : ""}</div>
          </div>`).join("")}
      </div>
      <p class="muted small">Demo：当前为模拟数据，真实环境接通商家入驻表（merchants）与平台审核流。审核通过即自动开通商城权限并初始化基础 AI额度。</p>`;
  }
  function renderPlatformClubs() {
    const clubs = getPlatformClubs();
    if (state.platformClubDetailId) return renderPlatformClubDetail(state.platformClubDetailId);
    return `
      <div class="section-head"><div class="section-title">俱乐部管理</div><div class="section-sub">平台统管所有俱乐部 · 点击查看权限 / 商城权限 / AI额度</div></div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>俱乐部列表（${clubs.length}）</h3></div>
        ${clubs.map((c) => `
          <div class="club-row" data-action="platformClubDetail" data-id="${c.id}" style="cursor:pointer">
            <div class="club-info"><div class="club-name">${esc(c.name)}</div><div class="club-sub">${esc(c.region)} · ${c.status === "approved" ? "正常经营" : c.status === "pending" ? "审核中" : "已停用"}${c.mallEnabled ? " · 商城已开通" : " · 商城未开通"}</div></div>
            <div class="club-metrics"><div><b>${Object.values(c.permissions).filter(Boolean).length}/5</b><span>功能权限</span></div><div><b>${(c.aiCredit.base + c.aiCredit.gift + c.aiCredit.paid).toLocaleString()}</b><span>AI额度</span></div></div>
          </div>`).join("")}
      </div>`;
  }
  function renderPlatformClubDetail(id) {
    const c = getPlatformClubs().find((x) => x.id === id);
    if (!c) { state.platformClubDetailId = null; return renderPlatformClubs(); }
    const permRows = PLATFORM_PERMS.map((p) => `
      <label class="pf-perm-row"><span>${p.label}</span>
        <span class="pf-switch ${c.permissions[p.key] ? "on" : ""}" data-action="platformTogglePerm" data-id="${c.id}" data-perm="${p.key}"><i></i></span>
      </label>`).join("");
    const cred = c.aiCredit;
    return `
      <div class="section-head"><div class="section-title">${esc(c.name)}</div><div class="section-sub">${esc(c.region)} · ${clubStatusBadge(c.status)} <button class="btn btn-ghost btn-sm" data-action="platformClubBack" style="margin-left:10px">返回列表</button></div></div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>功能权限分配</h3><span class="muted small">平台为俱乐部开通 / 关闭具体能力</span></div>
        <div class="pf-perm-list">${permRows}</div>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>商城权限</h3></div>
        <label class="pf-perm-row"><span>开通装备商城（前端商城入口 + 活动×装备融合）</span>
          <span class="pf-switch ${c.mallEnabled ? "on" : ""}" data-action="platformToggleMall" data-id="${c.id}"><i></i></span>
        </label>
        <p class="muted small">关闭后该俱乐部前端「商城」入口与活动×装备融合将不可用。</p>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>AI额度管理</h3><span class="more" data-action="platformTokenFocus" data-id="${c.id}">去统管页</span></div>
        <div class="an-row">
          <div class="an-card"><div class="an-card-h">${ICON("cpu")}<span>基础</span></div><div class="an-card-v">${cred.base}</div></div>
          <div class="an-card"><div class="an-card-h">${ICON("gift")}<span>赠送</span></div><div class="an-card-v">${cred.gift}</div></div>
          <div class="an-card"><div class="an-card-h">${ICON("wallet")}<span>充值</span></div><div class="an-card-v">${cred.paid}</div></div>
        </div>
        <div class="row gap-10" style="margin-top:10px">
          <button class="btn btn-soft btn-sm" data-action="platformTokenAdd" data-id="${c.id}" data-kind="base" data-amt="1000">+1000 基础</button>
          <button class="btn btn-soft btn-sm" data-action="platformTokenAdd" data-id="${c.id}" data-kind="paid" data-amt="5000">+5000 充值</button>
          <button class="btn btn-ghost btn-sm" data-action="platformTokenAdd" data-id="${c.id}" data-kind="gift" data-amt="-1">清零赠送</button>
        </div>
      </div>`;
  }
  function renderPlatformToken() {
    const clubs = getPlatformClubs().filter((c) => c.status === "approved");
    const sum = (k) => clubs.reduce((s, c) => s + (c.aiCredit[k] || 0), 0);
    const totalBase = sum("base"), totalGift = sum("gift"), totalPaid = sum("paid");
    const used = (state.aiLedger || []).filter((l) => l.type === "consume").reduce((s, l) => s + Math.abs(l.delta || 0), 0);
    return `
      <div class="section-head"><div class="section-title">AI额度统管</div><div class="section-sub">平台为所有俱乐部分配与管理 AI 额度（对外称 AI 积分）</div></div>
      <div class="an-row">
        <div class="an-card"><div class="an-card-h">${ICON("cpu")}<span>总基础池</span></div><div class="an-card-v">${totalBase.toLocaleString()}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("gift")}<span>总赠送</span></div><div class="an-card-v">${totalGift.toLocaleString()}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("wallet")}<span>总充值</span></div><div class="an-card-v">${totalPaid.toLocaleString()}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("activity")}<span>本月已消耗</span></div><div class="an-card-v">${used.toLocaleString()}</div></div>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>批量分配</h3></div>
        <div class="row gap-10">
          <input class="input" id="platformTokenBatch" placeholder="输入额度，如 1000" style="max-width:200px">
          <button class="btn btn-primary btn-sm" data-action="platformTokenBatch">为全部已开通俱乐部补充基础 AI额度</button>
        </div>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>各俱乐部 AI额度余额</h3></div>
        <div class="pf-token-table">
          <div class="pf-token-th"><span>俱乐部</span><span>基础</span><span>赠送</span><span>充值</span><span>可用合计</span><span>操作</span></div>
          ${clubs.map((c) => {
            const av = c.aiCredit.base + c.aiCredit.gift + c.aiCredit.paid;
            return `<div class="pf-token-tr">
              <span>${esc(c.name)}</span><span>${c.aiCredit.base}</span><span>${c.aiCredit.gift}</span><span>${c.aiCredit.paid}</span><span><b>${av.toLocaleString()}</b></span>
              <span class="row gap-6">
                <button class="btn btn-soft btn-xs" data-action="platformTokenAdd" data-id="${c.id}" data-kind="base" data-amt="1000">+1000</button>
                <button class="btn btn-soft btn-xs" data-action="platformTokenAdd" data-id="${c.id}" data-kind="paid" data-amt="5000">+5000</button>
              </span>
            </div>`;
          }).join("")}
        </div>
      </div>`;
  }
  function renderPlatformMall() {
    const tab = state.platformMallTab || "listing";
    const tabs = [["listing", "商品上架"], ["supply", "供应链货源"], ["orders", "订单(区分来源)"], ["logistics", "物流"]];
    const tabBar = `<div class="pf-mall-tabs">${tabs.map(([t, l]) => `<button class="pf-mall-tab ${tab === t ? "active" : ""}" data-action="platformMallTab" data-tab="${t}">${l}</button>`).join("")}</div>`;
    let body = "";
    if (tab === "listing") body = renderPlatformMallListing();
    else if (tab === "supply") body = renderPlatformSupply();
    else if (tab === "orders") body = renderPlatformOrders();
    else body = renderPlatformLogistics();
    return `
      <div class="section-head"><div class="section-title">商城平台</div><div class="section-sub">上架 / 供应链货源 / 订单(区分俱乐部来源) / 物流 · 平台统一运营</div></div>
      ${tabBar}
      ${body}`;
  }
  function renderPlatformMallListing() {
    const products = state.mallProducts || [];
    const cs = commissionSummary();
    return `
      <div class="an-row">
        <div class="an-card"><div class="an-card-h">${ICON("store")}<span>在售商品</span></div><div class="an-card-v">${products.length}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("shopping-bag")}<span>商城订单</span></div><div class="an-card-v">${(state.mallOrders || []).length}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("wallet")}<span>可结算佣金</span></div><div class="an-card-v">¥${cs.available.toLocaleString()}</div></div>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>商品管理（平台）</h3><span class="more" data-action="mallNew">新增商品</span></div>
        <div class="mall-admin-list">${products.map((p) => `<div class="mall-admin-row" data-action="mallEdit" data-id="${p.id}">
          <div class="mall-rec-ph" style="background-image:url('${esc(p.cover)}')"></div>
          <div class="mall-admin-info"><div class="mall-rec-t">${esc(p.title)}</div><div class="mall-sub">${esc(p.category)} · ${riskLabel(p.riskLevel)} · 供货 ¥${p.supplyPrice} · 售 ¥${p.retailPrice} · ${fulfillmentLabel(p.fulfillmentMode)} · ${supplierName(p.supplierId)}</div></div>
          <button class="btn btn-ghost btn-sm" data-action="mallDel" data-id="${p.id}">删除</button>
        </div>`).join("")}</div>
      </div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>佣金结算（平台）</h3>${cs.available > 0 ? `<span class="more" data-action="mallSettleAll">结算全部可结算</span>` : ""}</div>
        <div class="comm-list">${state.mallOrders && state.mallOrders.length ? (state.mallOrders.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((o) => mallCommRowHtml(o, true)).join("")) : `<p class="muted small">暂无商城订单。</p>`}</div>
      </div>`;
  }
  function renderPlatformSupply() {
    const sups = state.suppliers || [];
    return `
      <div class="fr-section">
        <div class="fr-section-h"><h3>供应链货源对接（${sups.length}）</h3></div>
        ${sups.map((s) => {
          const synced = s.syncStatus === "synced";
          const cnt = (state.mallProducts || []).filter((p) => p.supplierId === s.id).length;
          return `<div class="club-row">
            <div class="club-info">
              <div class="club-name">${esc(s.name)}</div>
              <div class="club-sub">${esc(s.companyName)} · ${s.type === "brand" ? "品牌方" : s.type === "retail" ? "零售商" : "代发仓"} · ${s.settlementCycle} · ${s.invoiceType}</div>
              <div class="club-sub">在架商品 ${cnt} · 上次同步 ${synced ? new Date(s.lastSync).toLocaleString("zh-CN") : "未同步"}</div>
            </div>
            <div class="club-actions">
              ${synced ? `<span class="mall-cat" style="background:#EAF3DE;color:#3B6D11">已对接</span>` : `<span class="mall-cat" style="background:#FCEBEB;color:#A32D2D">未对接</span>`}
              ${synced ? `<button class="btn btn-soft btn-sm" data-action="platformSyncSupplier" data-id="${s.id}">同步商品</button><button class="btn btn-ghost btn-sm" data-action="platformPauseSupplier" data-id="${s.id}">暂停对接</button>` : `<button class="btn btn-primary btn-sm" data-action="platformSyncSupplier" data-id="${s.id}">重新对接</button>`}
            </div>
          </div>`;
        }).join("")}
      </div>
      <p class="muted small">Demo：供应链对接为模拟。真实环境通过供应商开放 API / ERP 拉取商品、库存与物流轨迹，平台统一兜底售后与分账。</p>`;
  }
  function renderPlatformOrders() {
    const orders = (state.mallOrders || []).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const byClub = {};
    orders.forEach((o) => { (byClub[o.clubId] = byClub[o.clubId] || []).push(o); });
    const clubIds = Object.keys(byClub);
    return `
      <div class="fr-section">
        <div class="fr-section-h"><h3>商城订单（按俱乐部来源区分）</h3></div>
        ${clubIds.length ? clubIds.map((cid) => {
          const list = byClub[cid];
          const amt = list.reduce((s, o) => s + (+(o.amount) || 0), 0);
          return `<div class="pf-order-group">
            <div class="pf-order-group-h"><span class="mall-cat">${esc(clubNameOf(cid))}</span><span class="muted small">${list.length} 单 · ¥${amt.toLocaleString()}</span></div>
            ${list.map((o) => `<div class="comm-row">
              <div class="comm-info"><div class="comm-t">${esc((o.items || []).map((it) => it.title).join("、") || o.id)}</div>
              <div class="comm-sub">来源 ${sourceTypeLabel(o.sourceType)} · 状态 ${COMM_STATUS_LABEL[o.commissionStatus] || o.commissionStatus} · ${new Date(o.createdAt).toLocaleDateString("zh-CN")}</div></div>
              <div class="comm-amt">¥${(+(o.amount) || 0).toLocaleString()}</div>
            </div>`).join("")}
          </div>`;
        }).join("") : `<p class="muted small">暂无订单。</p>`}
      </div>
      <p class="muted small">平台按 clubId 归因每笔订单，区分俱乐部来源（俱乐部商城 / 活动装备清单 / 活动详情 / 推荐转化）。</p>`;
  }
  function renderPlatformLogistics() {
    const orders = (state.mallOrders || []).filter((o) => !o.refunded);
    const label = (s) => ({ pending: "待发货", shipped: "已发货", signed: "已签收", done: "已完成" }[s] || "待发货");
    return `
      <div class="fr-section">
        <div class="fr-section-h"><h3>物流管理</h3><span class="muted small">平台统一发货 · 供应商 / 云仓履约</span></div>
        ${orders.length ? orders.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((o) => {
          const ls = o.logistics || "pending";
          const canShip = ls === "pending";
          const canSign = ls === "shipped";
          const canComplete = ls === "signed";
          const fm = fulfillmentLabel(getProduct((o.items || [])[0] ? (o.items || [])[0].productId : "") ? getProduct((o.items || [])[0].productId).fulfillmentMode : "");
          return `<div class="comm-row">
            <div class="comm-info"><div class="comm-t">${esc((o.items || []).map((it) => it.title).join("、") || o.id)}</div>
            <div class="comm-sub">${esc(clubNameOf(o.clubId))} · ${fm} · ${ls === "shipped" ? ("运单 " + (o.trackingNo || "-")) : "—"}</div></div>
            <div class="comm-amt">${label(ls)}</div>
            <div class="comm-actions">${canShip ? `<button class="btn btn-primary btn-sm" data-action="platformShipOrder" data-id="${o.id}">发货</button>` : ""}${canSign ? `<button class="btn btn-soft btn-sm" data-action="platformSignOrder" data-id="${o.id}">签收</button>` : ""}${canComplete ? `<button class="btn btn-ghost btn-sm" data-action="platformCompleteOrder" data-id="${o.id}">完成</button>` : ""}</div>
          </div>`;
        }).join("") : `<p class="muted small">暂无订单。</p>`}
      </div>`;
  }
  function renderPlatformRefundLog() {
    const refunded = (state.mallOrders || []).filter((o) => o.refunded);
    if (!refunded.length) return "";
    return `<div class="fr-section">
      <div class="fr-section-h"><h3>退款冲销记录（${refunded.length}）</h3><span class="muted small">退款触发佣金冲销，详见「分账结算」</span></div>
      ${refunded.map((o) => `<div class="comm-row">
        <div class="comm-info"><div class="comm-t">${esc((o.items || []).map((it) => it.title).join("、") || o.id)}</div>
        <div class="comm-sub">${esc(clubNameOf(o.clubId))} · 佣金已冲销归零</div></div>
        <div class="comm-amt">¥${(+(o.amount) || 0).toLocaleString()}</div>
      </div>`).join("")}
    </div>`;
  }
  function renderPlatformAftersale() {
    if (!Array.isArray(state.aftersales)) state.aftersales = [];
    const all = state.aftersales;
    const tab = state.platformAftersaleTab || "pending";
    const TYPES = { refund: "仅退款", return: "退货退款", exchange: "换货", complaint: "投诉" };
    const STATUS = { pending: "待处理", processing: "处理中", done: "已完成", rejected: "已拒绝" };
    const statusStyle = (st) => st === "pending" ? "background:#FCEBEB;color:#A32D2D"
      : st === "processing" ? "background:#FFF4E0;color:#A66A00"
      : st === "done" ? "background:#EAF3DE;color:#3B6D11"
      : "background:#F1EFE8;color:#5F5E5A";
    const counts = { pending: 0, processing: 0, done: 0, rejected: 0 };
    all.forEach((a) => { counts[a.status] = (counts[a.status] || 0) + 1; });
    const openAmt = all.filter((a) => a.status === "pending" || a.status === "processing").reduce((s, a) => s + (+(a.amount) || 0), 0);
    const tabs = [["pending", "待处理"], ["processing", "处理中"], ["done", "已完成"], ["all", "全部"]];
    const list = (tab === "all" ? all : all.filter((a) => a.status === tab)).slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return `
      <div class="section-head"><div class="section-title">售后管理</div><div class="section-sub">退款 / 退货 / 换货 / 投诉 · 平台统一兜底售后与分账</div></div>
      <div class="an-row">
        <div class="an-card"><div class="an-card-h">${ICON("clock")}<span>待处理</span></div><div class="an-card-v">${counts.pending}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("refresh")}<span>处理中</span></div><div class="an-card-v">${counts.processing}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("check")}<span>已完成</span></div><div class="an-card-v">${counts.done}</div></div>
        <div class="an-card"><div class="an-card-h">${ICON("wallet")}<span>进行中金额</span></div><div class="an-card-v">¥${openAmt.toLocaleString()}</div></div>
      </div>
      <div class="pf-mall-tabs">${tabs.map(([t, l]) => `<button class="pf-mall-tab ${tab === t ? "active" : ""}" data-action="platformAftersaleTab" data-tab="${t}">${l}</button>`).join("")}</div>
      <div class="fr-section">
        <div class="fr-section-h"><h3>售后工单（${list.length}）</h3></div>
        ${list.length ? list.map((a) => {
          const canAccept = a.status === "pending";
          const canResolve = a.status === "processing";
          return `<div class="comm-row">
            <div class="comm-info">
              <div class="comm-t">${esc(a.product)} <span class="mall-cat" style="${statusStyle(a.status)}">${STATUS[a.status]}</span></div>
              <div class="comm-sub">${TYPES[a.type] || a.type} · ${esc(clubNameOf(a.clubId))} · 用户 ${esc(a.userId)} · ${new Date(a.createdAt).toLocaleDateString("zh-CN")}${a.resolvedAt ? " · 处理于 " + new Date(a.resolvedAt).toLocaleDateString("zh-CN") : ""}</div>
              <div class="comm-sub">原因：${esc(a.reason)}</div>
            </div>
            <div class="comm-amt">¥${(+(a.amount) || 0).toLocaleString()}</div>
            <div class="comm-actions">
              ${canAccept ? `<button class="btn btn-primary btn-sm" data-action="platformAftersaleAccept" data-id="${a.id}">受理</button>` : ""}
              ${canResolve ? `<button class="btn btn-primary btn-sm" data-action="platformAftersaleResolve" data-id="${a.id}">标记完成</button><button class="btn btn-ghost btn-sm" data-action="platformAftersaleReject" data-id="${a.id}">拒绝</button>` : ""}
              ${a.status === "done" || a.status === "rejected" ? `<span class="muted small">${a.status === "done" ? "已闭环" : "已拒绝"}</span>` : ""}
            </div>
          </div>`;
        }).join("") : `<p class="muted small">该分类下暂无售后工单。</p>`}
      </div>
      ${renderPlatformRefundLog()}
      <p class="muted small">平台按 clubId 归因售后，退款触发佣金冲销（见「分账结算」）。真实环境售后对接工单系统 / 微信支付退款接口，由平台统一兜底。</p>`;
  }
