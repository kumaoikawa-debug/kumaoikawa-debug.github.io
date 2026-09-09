/* ClubOS Platform — modular build (split from monolithic app.js v81).
   Loaded as classic <script> in order; shared global scope, no bundler. */
  function syncItineraryDays(a) {
    const n = Math.max(1, a.days || 1);
    const arr = a.itineraryDays || [];
    const out = [];
    for (let i = 0; i < n; i++) {
      if (arr[i]) out.push(arr[i]);
      else out.push({ label: n > 1 ? `第 ${i + 1} 天` : "行程安排", sub: "", items: [] });
    }
    a.itineraryDays = out;
  }

  /* ---------------- equipment intelligence ---------------- */
  const EQUIP_DB = {
    hiking: {
      mandatory: ["徒步/运动鞋", "双肩背包", "饮用水（≥1L）", "防晒用品", "雨具", "手机与充电宝", "个人证件"],
      recommended: ["登山杖", "速干衣裤", "替换衣物", "能量零食", "驱蚊液", "头灯/小手电", "垃圾袋"],
    },
    camping: {
      mandatory: ["帐篷", "睡袋", "防潮垫", "头灯/营地灯", "营地炊具", "饮用水与食物", "保暖衣物"],
      recommended: ["天幕", "折叠椅", "充电宝", "防蚊用品", "拖鞋", "洗漱包", "急救包", "垃圾袋"],
    },
    cycling: {
      mandatory: ["头盔", "骑行手套", "水壶/水袋", "备胎与修车工具", "反光背心", "手机"],
      recommended: ["骑行眼镜", "速干衣", "防晒", "能量补给", "小背包", "雨衣"],
    },
    rafting: {
      mandatory: ["救生衣", "防水袋", "防滑鞋", "换洗衣物", "毛巾", "防晒"],
      recommended: ["防水手机袋", "溯溪鞋", "速干衣", "能量零食", "保温杯"],
    },
    climbing: {
      mandatory: ["安全带", "头盔", "攀岩鞋", "主锁/保护器", "粉袋", "手机"],
      recommended: ["防滑粉", "运动手套", "能量补给", "防晒", "保暖层"],
    },
    skiing: {
      mandatory: ["滑雪服", "雪镜", "手套", "头盔", "保暖内层", "防晒（高原强紫外线）"],
      recommended: ["护具", "雪袜", "暖宝宝", "能量零食", "润唇膏"],
    },
    general: {
      mandatory: ["运动鞋", "饮用水", "防晒用品", "雨具", "替换衣物", "手机"],
      recommended: ["双肩包", "能量零食", "充电宝", "驱蚊液", "湿巾"],
    },
    city: {
      mandatory: ["舒适运动鞋", "轻便双肩包", "充电宝", "雨具", "防晒用品", "身份证件"],
      recommended: ["水杯", "小零食", "耳机", "纸巾湿巾", "随身小药包"],
    },
  };
  function equipType(type) {
    if (/徒步|登山|爬山/.test(type)) return "hiking";
    if (/露营|营地/.test(type)) return "camping";
    if (/骑行|自行车/.test(type)) return "cycling";
    if (/漂流|桨板|皮划艇|溯溪/.test(type)) return "rafting";
    if (/攀岩/.test(type)) return "climbing";
    if (/滑雪/.test(type)) return "skiing";
    if (/城市|景区|观光|旅行|自驾|摄影|团建/.test(type)) return "city";
    return "general";
  }


  function gearChipsHtml(a, must) {
    return (a.gear || [])
      .filter((g) => (typeof g === "string" ? false : g.must) === must)
      .map((g) => {
        const name = typeof g === "string" ? g : g.name;
        const note = typeof g === "object" && g.note ? g.note : "";
        const noteHtml = note ? `<span class="gnote" title="${esc(note)}">${esc(note)}</span>` : "";
        return `<span class="gear-chip ${note ? "has-note" : ""}"><span class="gname">${esc(name)}</span>${noteHtml}<button class="gx" data-action="delGear" data-name="${esc(name)}">${ICON("x")}</button></span>`;
      }).join("");
  }
  function gearIcon(name) {
    if (/鞋|靴/.test(name)) return "shoe";
    if (/雨|防水/.test(name)) return "umbrella";
    if (/包/.test(name)) return "bag";
    if (/水|水杯|保温杯|饮水/.test(name)) return "droplet";
    if (/食|餐|零食|干粮|补给|能量/.test(name)) return "food";
    if (/充电|电池/.test(name)) return "battery";
    if (/衣|服|保暖|速干|替换/.test(name)) return "shirt";
    if (/防晒|墨镜|雪镜|太阳/.test(name)) return "sun";
    if (/头灯|手电|营灯|灯/.test(name)) return "headlamp";
    if (/帐|帐篷/.test(name)) return "tent";
    if (/头盔|帽/.test(name)) return "shield";
    if (/相机|手机/.test(name)) return "camera";
    if (/登山杖|杖/.test(name)) return "mountain";
    if (/证件|身份证/.test(name)) return "book";
    return "ruler";
  }

  // 智能解析用户粘贴的大段装备建议文本，拆分为结构化装备项
  function parseGearText(text) {
    if (!text || text.trim().length < 2) return [];
    let s = text.replace(/\s+/g, " ").replace(/[;；]/g, "；").trim();

    // 定位装备清单开始位置
    const markers = ["装备建议", "建议携带", "必备装备", "需要准备", "装备清单", "携带物品", "建议准备"];
    let start = -1;
    for (const m of markers) { const i = s.indexOf(m); if (i > -1) { start = i + m.length; break; } }
    if (start > -1) s = s.slice(start);
    s = s.replace(/^[：:\s]+/, "");

    // 按句号/分号切分成句
    const sentences = s.split(/[；。]/).map((x) => x.trim()).filter((x) => x.length > 1);
    if (!sentences.length && s.includes("、")) sentences.push(s);

    const out = [];
    sentences.forEach((sentence) => {
      const sent = sentence.replace(/^\d+[\.、]/, "").trim();
      // 判断是必备还是建议：含"可备/建议/可选/备用"即为建议，否则必备
      const isMust = !/可备|建议携带|可选|备用|酌情|自行/.test(sent);
      // 去掉常见动词前缀
      let content = sent;
      const verbs = ["穿着", "可备", "准备", "携带", "带上", "备好", "建议", "需", "需要", "请", "如"];
      for (const v of verbs) { if (content.startsWith(v)) { content = content.slice(v.length); break; } }

      const parts = splitGearParts(content).filter((p) => p && !/等用品|等物品|等$/.test(p));
      parts.forEach((part) => {
        const item = parseGearItem(part);
        if (item) { item.must = isMust; out.push(item); }
      });
    });

    // 去重
    const seen = new Set();
    return out.filter((it) => { const k = it.name + "|" + it.note; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  // 按顿号切分，但保护括号内的顿号不被误拆
  function splitGearParts(s) {
    const parts = [];
    let cur = "", depth = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "（" || ch === "(") depth++;
      else if (ch === "）" || ch === ")") depth--;
      if (ch === "、" && depth === 0) { parts.push(cur); cur = ""; }
      else cur += ch;
    }
    if (cur) parts.push(cur);
    return parts.map((p) => p.trim());
  }
  function parseGearItem(str) {
    let name = str.trim();
    let note = "";
    const m1 = name.match(/（([^）]+)）/);
    const m2 = name.match(/\(([^)]+)\)/);
    if (m1) { note = m1[1].trim(); name = name.replace(/（[^）]+）/, "").trim(); }
    else if (m2) { note = m2[1].trim(); name = name.replace(/\([^)]+\)/, "").trim(); }
    name = name.replace(/[及和等]$/, "").trim();
    if (name.length < 2) return null;
    return { name, note, must: false };
  }

  function departuresEditHtml(a) {
    syncDepartures(a);
    const deps = a.departures || [];
    const list = deps.map((d) => {
      const price = d.price != null ? d.price : (a.price || "");
      return `<div class="departure-card">
        <div class="dep-date">
          <div class="dep-week">${esc(d.weekDay || "")}</div>
          <div class="dep-md">${esc(formatDepartureSlash(d.date))}</div>
        </div>
        <div class="dep-fields">
          <input type="number" class="input input-sm" data-bind-dep="${d.id}" data-dep-key="price" value="${price}" placeholder="价格">
          <select class="select select-sm" data-bind-dep="${d.id}" data-dep-key="status">
            <option value="open" ${d.status === "open" ? "selected" : ""}>可报名</option>
            <option value="full" ${d.status === "full" ? "selected" : ""}>已满员</option>
            <option value="closed" ${d.status === "closed" ? "selected" : ""}>已截止</option>
          </select>
          <input type="text" class="input input-sm" data-bind-dep="${d.id}" data-dep-key="note" value="${esc(d.note || "")}" placeholder="备注，如余位3">
        </div>
        <button class="icon-btn" data-action="deleteDeparture" data-id="${d.id}" title="删除团期">${ICON("x")}</button>
      </div>`;
    }).join("");
    return `<div class="panel" style="margin-top:14px">
      <div class="panel-head"><h3>行程与团期</h3><span class="tiny muted">一个活动可设置多个出发日期，每个团期可独立定价</span></div>
      <div class="panel-body">
        <div class="departure-add-row">
          <input type="date" class="input" id="depDateInput">
          <input type="number" class="input" id="depPriceInput" placeholder="价格（默认 ¥${a.price || 0}）">
          <button class="btn btn-soft btn-sm" data-action="addDeparture">添加团期</button>
        </div>
        ${deps.length ? `<div class="departure-list">${list}</div>` : `<div class="tiny muted" style="margin-top:10px">暂无团期，请在上方添加；未设置团期时前端显示「日期待定」。</div>`}
      </div>
    </div>`;
  }

  function leaderEditHtml(a) {
    ensureLeaders();
    const leaders = state.leaders || [];
    const editingId = a._editingLeaderId || "";
    const editing = editingId ? findLeaderById(editingId) : null;
    // 优先展示本次上传的草稿头像，未上传时才回落到资料库已有头像
    const avatar = (a._leaderAvatarDraft || "").trim() || (editing ? editing.avatar : "");
    const selectedCount = (a.leaderIds || []).length;
    return `<div class="panel" style="margin-bottom:18px">
      <div class="panel-head"><h3>领队与安全保障</h3><span class="tiny muted">据实填写，前端仅展示真实信息</span></div>
      <div class="panel-body">
        <div class="leader-library">
          <div class="tiny muted" style="margin-bottom:8px">从领队资料库选择（已保存 ${leaders.length} 位${selectedCount ? " · 本场已选 " + selectedCount + " 位" : ""}）</div>
          <div class="leader-chips">
            ${leaders.map((l) => {
              const sel = (a.leaderIds || []).includes(l.id);
              const isEditing = editingId === l.id;
              const av = l.avatar
                ? `<img class="lc-av" src="${esc(l.avatar)}" alt="">`
                : `<span class="lc-av-fallback" style="background:linear-gradient(140deg,var(--accent),#A86B2C)">${esc((l.name || "领")[0])}</span>`;
              return `<span class="leader-chip-wrap">
              <button class="leader-chip ${sel ? "sel" : ""} ${isEditing ? "editing" : ""}" data-action="toggleLeader" data-id="${l.id}">${av}<span>${esc(l.name)}${l.cert ? ` · ${esc(l.cert)}` : ""}</span></button>
              <button class="leader-chip-edit" data-action="editLeader" data-id="${l.id}" title="编辑资料">${ICON("edit")}</button>
            </span>`;
            }).join("")}
            <button class="leader-chip ghost" data-action="newLeader">+ 新建领队</button>
          </div>
        </div>

        <div class="leader-form-card">
          <div class="leader-form-head">
            <div class="leader-avatar-upload" data-action="uploadLeaderAvatar">
              ${avatar
                ? `<img class="leader-av-preview" src="${esc(avatar)}" alt=""><button class="logo-del" data-action="delLeaderAvatar" title="移除头像">${ICON("x")}</button>`
                : `<div class="leader-av-ph"><div class="ic">${ICON("upload")}</div><span>上传头像</span></div>`}
            </div>
            <input type="file" id="leaderAvatarInput" accept="image/*" style="display:none">
            <div class="leader-form-title">${editing ? "编辑领队资料" : "新建领队"}</div>
          </div>
          <div class="grid-2">
            <div class="field"><label>领队姓名 / 昵称</label><input class="input" data-bind="leaderName" value="${esc(a.leaderName || "")}"></div>
            <div class="field"><label>从业经验</label><input class="input" data-bind="leaderYears" value="${esc(a.leaderYears || "")}" placeholder="如：8 年户外领队"></div>
            <div class="field"><label>相关资质</label><input class="input" data-bind="leaderCert" value="${esc(a.leaderCert || "")}" placeholder="如：中国登山协会指导员"></div>
            <div class="field"><label>带队场次</label><input class="input" data-bind="leaderTrips" value="${esc(a.leaderTrips || "")}" placeholder="如：200+ 场"></div>
          </div>
          <div class="row gap-8" style="margin-top:10px">
            <button class="btn btn-soft btn-sm" data-action="saveLeader">${editing ? "保存到资料库" : "保存并加入活动"}</button>
            <button class="btn btn-ghost btn-sm" data-action="newLeader">清空/新建</button>
            ${editing && (a.leaderIds || []).includes(editingId) ? `<button class="btn btn-ghost btn-sm" data-action="removeLeaderFromActivity" data-id="${editingId}">从本场活动移除</button>` : ""}
            ${editing ? `<button class="btn btn-ghost btn-sm btn-danger" data-action="deleteLeader" data-id="${editingId}">从资料库删除</button>` : ""}
          </div>
        </div>
        <div class="tiny muted" style="margin-top:10px">领队头像上传后系统自动裁剪为圆形；未选择领队时，前端自动隐藏此模块，不生成虚假资质。</div>
      </div>
    </div>`;
  }
  function itineraryEditHtml(a) {
    const days = a.itineraryDays || [];
    const dayBlocks = days.map((day, di) => {
      const items = day.items.map((item, ii) => `
        <div class="itin-row">
          <input class="input itin-time" data-bind-itin="time" data-day="${di}" data-idx="${ii}" value="${esc(item.time)}" placeholder="时间">
          <input class="input itin-text" data-bind-itin="text" data-day="${di}" data-idx="${ii}" value="${esc(item.text)}" placeholder="行程内容">
          <button class="btn btn-ghost btn-sm" data-action="delItinItem" data-day="${di}" data-idx="${ii}">${ICON("x")}</button>
        </div>
      `).join("");
      return `
        <div class="itin-day">
          <div class="itin-day-head"><b>${esc(day.label)}</b><span class="tiny muted">${esc(day.sub)}</span></div>
          <div class="itin-items">${items}</div>
          <button class="btn btn-soft btn-sm" data-action="addItinItem" data-day="${di}">+ 添加行程项</button>
        </div>
      `;
    }).join("");
    return `
      <div class="panel" style="margin-bottom:18px">
        <div class="panel-head"><h3>详细行程 · 共 ${a.days || 1} 天</h3><span class="tiny muted">AI 先生成 · 你可手动调整</span></div>
        <div class="panel-body">
          ${dayBlocks}
          <div class="row gap-8" style="margin-top:12px">
            <button class="btn btn-soft btn-sm" data-action="regenItinerary">重新生成行程</button>
            <button class="btn btn-soft btn-sm" data-action="addItinDay" ${(a.days || 1) >= 7 ? "disabled" : ""}>+ 增加一天</button>
            <button class="btn btn-ghost btn-sm" data-action="delItinDay" ${(a.days || 1) <= 1 ? "disabled" : ""}>- 减少一天</button>
          </div>
        </div>
      </div>`;
  }

  /* ---------------- brand logo helpers ---------------- */
  function psLogo(white) {
    const b = state.brand;
    const inner = b.logo
      ? `<img class="l l-img" src="${esc(b.logo)}" alt="">`
      : `<span class="l"${white ? ' style="background:rgba(255,255,255,.25)"' : ""}>${esc(b.logoText || "C")}</span>`;
    return `<span class="ps-logo"${white ? ' style="color:#fff"' : ""}>${inner}${esc(b.name)}</span>`;
  }
  function brandMark() {
    const b = state.brand;
    if (b.logo) return `<div class="brand-logo brand-logo-img" style="background-image:url('${esc(b.logo)}')"></div>`;
    return `<div class="brand-logo">${esc(b.logoText || "C")}</div>`;
  }
  function orgLogo() {
    const b = state.brand;
    if (b.logo) return `<div class="org-logo org-logo-img" style="background-image:url('${esc(b.logo)}')"></div>`;
    return `<div class="org-logo">${esc(b.logoText || "C")}</div>`;
  }
  function gearRender(a, must, gearProduct) {
    const items = (a.gear || []).filter((g) => (typeof g === "string" ? false : g.must) === must);
    if (!items.length) return "";
    return `<div class="gear-group"><div class="gear-group-h">${must ? "必备装备" : "建议携带"}</div>
      <div class="gear-flow">${items.map((g) => {
        const name = typeof g === "string" ? g : g.name;
        const note = typeof g === "object" && g.note ? g.note : "";
        const hit = gearProduct && gearProduct[name];
        return `<div class="gear-item ${note ? "has-note" : ""}">${hit ? `<button class="gi-link" data-action="mallProduct" data-id="${hit.id}" data-srctype="ai_gear_list" data-srcid="${a.id}">商城同款</button>` : ""}<span class="gi">${ICON(gearIcon(name))}</span><div class="gi-text"><span class="gi-name">${esc(name)}</span>${note ? `<span class="gi-note">${esc(note)}</span>` : ""}</div></div>`;
      }).join("")}</div></div>`;
  }

  // —— P3 活动 × 装备融合：把活动装备清单匹配到商城商品 ——
  // 关键词 → 商品标题/类目 谓词，避免泛化活动标签导致误匹配
  const GEAR_MATCH = [
    { kw: ["鞋", "徒步鞋", "登山鞋", "越野"], test: (p) => /(鞋)/.test(p.title + p.category) },
    { kw: ["杖", "手杖"], test: (p) => /杖/.test(p.title) },
    { kw: ["水", "饮水", "杯", "保温", "路餐"], test: (p) => /(水具|水壶|杯)/.test(p.category + p.title) },
    { kw: ["防晒", "帽", "渔夫帽"], test: (p) => /(帽)/.test(p.category + p.title) || /防晒/.test((p.tags || []).join()) },
    { kw: ["雨", "雨衣", "雨备"], test: (p) => /(雨具|雨衣)/.test(p.category + p.title) },
    { kw: ["灯", "照明", "头灯"], test: (p) => /(照明|灯)/.test(p.category + p.title) },
    { kw: ["包", "背包", "重装"], test: (p) => /(背包)/.test(p.category + p.title) },
    { kw: ["手套"], test: (p) => /手套/.test(p.title) },
    { kw: ["袜"], test: (p) => /袜/.test(p.title) },
    { kw: ["收纳", "袋"], test: (p) => /(收纳)/.test(p.category + p.title) },
    { kw: ["补给", "能量", "胶", "电解质"], test: (p) => /(补给)/.test(p.category + p.title) },
    { kw: ["营钉", "帐篷", "睡袋", "露营", "营地"], test: (p) => /(露营|睡眠)/.test(p.category + p.title) },
    { kw: ["头盔", "攀登", "攀岩", "雪山"], test: (p) => /(安全装备|头盔|绳|安全带)/.test(p.category + p.title) },
    { kw: ["安全带"], test: (p) => /安全带/.test(p.title) },
    { kw: ["绳"], test: (p) => /绳/.test(p.title) },
    { kw: ["防风", "外套", "冲锋衣"], test: (p) => /(冲锋衣|外套|防风)/.test(p.title) }
  ];
  // 推荐优先级：匹配 > 安全 > 品质 > 评价 > 价格 > 佣金（佣金绝不参与排序）
  function matchGearProducts(a) {
    const prods = state.mallProducts || [];
    const matchedIds = new Set();
    const gearProduct = {};
    (a.gear || []).forEach((g) => {
      const name = typeof g === "string" ? g : (g && g.name) || "";
      if (!name) return;
      for (const rule of GEAR_MATCH) {
        if (rule.kw.some((k) => name.indexOf(k) >= 0)) {
          const hit = prods.find((p) => rule.test(p));
          if (hit) { matchedIds.add(hit.id); if (!gearProduct[name]) gearProduct[name] = hit; }
          break;
        }
      }
    });
    return { matchedIds, gearProduct };
  }
  function gearMallRecs(a, matchedIds) {
    const prods = state.mallProducts || [];
    const riskW = { L3: 300, L2: 200, L1: 100 };
    return prods.map((p) => {
      const matched = matchedIds.has(p.id);
      const score = (matched ? 10000 : 0) + (riskW[p.riskLevel] || 0) + (p.rating || 0) * 50 - (p.retailPrice || 0) / 50;
      return { p, score, matched };
    }).sort((x, y) => y.score - x.score).slice(0, 6);
  }
  function renderGearMall(a, matchedIds) {
    const recs = gearMallRecs(a, matchedIds);
    if (!recs.length) return "";
    return `<div class="gear-mall">
      <div class="gear-mall-h"><span>${ICON("shopping-bag")}</span> 可在商城一站式备齐 · 按「安全 &gt; 评价 &gt; 价格」推荐（平台统一发货，佣金归本俱乐部）</div>
      <div class="gear-mall-grid">${recs.map((r) => `<button class="gear-mall-card" data-action="mallProduct" data-id="${r.p.id}" data-srctype="ai_gear_list" data-srcid="${a.id}">
        <div class="gmc-ph" style="background-image:url('${esc(r.p.cover)}')"></div>
        <div class="gmc-body">
          <div class="gmc-title">${esc(r.p.title)}</div>
          <div class="gmc-meta"><span class="mall-risk r-${r.p.riskLevel}">${riskLabel(r.p.riskLevel)}</span><span class="mall-rate">★ ${r.p.rating}</span>${r.matched ? `<span class="gmc-match">清单匹配</span>` : ""}</div>
          <div class="gmc-foot"><b>¥${r.p.retailPrice}</b><span class="gmc-go">查看 ${ICON("arrow-right")}</span></div>
        </div>
      </button>`).join("")}</div>
    </div>`;
  }

  /* ---------------- phone / detail render ---------------- */
  // V1.3.2 智能焦点：用画面对比度、色彩与边缘密度找到主体，避免裁切到大片空天空。
  const PHOTO_FOCUS_CACHE = new Map();
  const PHOTO_FOCUS_PENDING = new Set();
  function focusValue(src) { return PHOTO_FOCUS_CACHE.get(src) || { x: 50, y: 48 }; }
  function updateSmartImages(src, focus) {
    document.querySelectorAll("img[data-smart-img]").forEach((img) => {
      if (img.getAttribute("src") === src) img.style.objectPosition = `${focus.x}% ${focus.y}%`;
    });
  }
  function analyzeImageFocus(src) {
    const fallback = () => ({ x: 50, y: 48, orientation: "landscape", quality_score: 0.6, category: "未分析", emotion: "真实", subjects: [], focal_point: { x: 0.5, y: 0.48 }, safe_text_area: "top-right", recommended_use: ["story"], duplicate_group: null, simulated: true });
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const max = 180, scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(24, Math.round(img.naturalWidth * scale));
          const h = Math.max(24, Math.round(img.naturalHeight * scale));
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          const cx = c.getContext("2d", { willReadFrequently: true });
          cx.drawImage(img, 0, 0, w, h);
          const px = cx.getImageData(0, 0, w, h).data;
          const cells = [], gx = 12, gy = 12;
          const lumAt = (x, y) => { const i = (Math.min(h-1,y)*w + Math.min(w-1,x))*4; return px[i]*.299 + px[i+1]*.587 + px[i+2]*.114; };
          for (let yy=0; yy<gy; yy++) for (let xx=0; xx<gx; xx++) {
            const x0=Math.floor(xx*w/gx), x1=Math.max(x0+1,Math.floor((xx+1)*w/gx));
            const y0=Math.floor(yy*h/gy), y1=Math.max(y0+1,Math.floor((yy+1)*h/gy));
            let edge=0, sat=0, contrast=0, count=0, lum=0;
            for(let y=y0; y<y1; y+=2) for(let x=x0; x<x1; x+=2){
              const i=(y*w+x)*4, r=px[i],g=px[i+1],b=px[i+2], hi=Math.max(r,g,b),lo=Math.min(r,g,b), l=r*.299+g*.587+b*.114;
              sat += hi ? (hi-lo)/hi : 0;
              edge += Math.abs(l-lumAt(Math.min(w-1,x+2),y)) + Math.abs(l-lumAt(x,Math.min(h-1,y+2)));
              contrast += Math.abs(l-150); lum += l; count++;
            }
            const n = Math.max(1, count);
            const ny=(yy+.5)/gy, nx=(xx+.5)/gx;
            const centerPrior = 1 - Math.min(.7, Math.abs(nx-.5)*.55);
            const lowerPrior = .9 + ny*.18;
            const rawScore=(edge/n)*2.8 + (sat/n)*78 + (contrast/n)*.16;
            const score=rawScore * centerPrior * lowerPrior;
            cells.push({ x:(xx+.5)*100/gx, y:(yy+.5)*100/gy, score, rawScore, edge: edge/n, sat: sat/n, contrast: contrast/n, lum: lum/n });
          }
          cells.sort((a,b)=>b.score-a.score);
          const chosen=cells.slice(0,Math.max(5,Math.round(cells.length*.10)));
          let sw=0,sx=0,sy=0; chosen.forEach(v=>{const wt=Math.max(.01,v.score);sw+=wt;sx+=v.x*wt;sy+=v.y*wt;});
          let fx=Math.round(Math.max(18,Math.min(82,sx/sw))), fy=Math.round(Math.max(18,Math.min(84,sy/sw)));
          // 若原始分数最高的区域明显在上半部，防止 lowerPrior 把人像头部压出画面
          const rawTop=cells.slice().sort((a,b)=>b.rawScore-a.rawScore).slice(0,Math.max(3,Math.round(cells.length*.08)));
          if(rawTop.length){
            const rawTopY=rawTop.reduce((s,v)=>s+v.y,0)/rawTop.length;
            const rawTopScore=rawTop.reduce((s,v)=>s+v.rawScore,0)/rawTop.length;
            const bottomCells=cells.filter(v=>v.y>55);
            const bottomScore=bottomCells.length?bottomCells.reduce((s,v)=>s+v.rawScore,0)/bottomCells.length:0;
            if(rawTopY<45 && rawTopScore>(bottomScore*1.08+0.01)) fy=Math.min(fy, Math.round(Math.max(30, rawTopY+5)));
          }
          resolve(buildPhotoMeta(img, fx, fy, cells));
        } catch(e) { resolve(fallback()); }
      };
      img.onerror = () => resolve(fallback());
      if (/^https?:\/\//.test(src)) { img.crossOrigin = "anonymous"; img.referrerPolicy = "no-referrer"; }
      img.src = src;
    });
  }

  /* V2.0 图片理解层
     真实计算：焦点坐标、横竖朝向、画质评分、文字安全区（基于像素统计）
     模拟推断：类别、主体、情绪（无视觉模型时的启发式结果，UI 必须标注「模拟分析（演示）」） */
  function buildPhotoMeta(img, fx, fy, cells) {
    const W = img.naturalWidth || 1, H = img.naturalHeight || 1;
    const ratio = W / H;
    const orientation = ratio > 1.15 ? "landscape" : (ratio < 0.87 ? "portrait" : "square");
    const avg = (k) => cells.reduce((s, v) => s + (v[k] || 0), 0) / Math.max(1, cells.length);
    const edge = avg("edge"), sat = avg("sat"), contrast = avg("contrast"), lum = avg("lum");
    const quality = Math.max(0.35, Math.min(0.99, 0.42 + edge / 850 + contrast / 700 + Math.min(0.14, Math.min(W, H) / 5200)));
    // 文字安全区：选边缘最少、亮度适中的象限
    const quad = (bx, by) => { const q = cells.filter(v => v.x >= bx && v.x < bx + 50 && v.y >= by && v.y < by + 50); if (!q.length) return null; return { e: q.reduce((s,v)=>s+v.edge,0)/q.length, l: q.reduce((s,v)=>s+v.lum,0)/q.length }; };
    const qs = [["top-left", quad(0,0)], ["top-right", quad(50,0)], ["bottom-left", quad(0,50)], ["bottom-right", quad(50,50)]].filter(x => x[1]);
    let safe = "top-right";
    if (qs.length) safe = qs.slice().sort((a,b) => (a[1].e + Math.abs(a[1].l-170)*0.25) - (b[1].e + Math.abs(b[1].l-170)*0.25))[0][0];
    // —— 以下为启发式模拟，不可作为真实识别结果对外宣称 ——
    let category = "环境/细节", emotion = "真实", subjects = ["环境"];
    if (sat > 0.34 && edge > 16) { category = "山野/植被"; subjects = ["植被", "地形"]; }
    else if (lum > 165) { category = "天空/开阔地"; subjects = ["天空", "远景"]; }
    else if (edge > 24) { category = "人物/动态"; subjects = ["人物"]; }
    if (lum < 95) emotion = "沉静"; else if (sat > 0.3) emotion = "明快";
    const rec = [];
    if (quality >= 0.7 && orientation !== "portrait") rec.push("hero");
    rec.push("story");
    if (orientation === "portrait") rec.push("full");
    if (quality < 0.58) rec.push("detail");
    return {
      x: fx, y: fy,
      category, orientation, emotion, subjects,
      quality_score: Math.round(quality * 100) / 100,
      focal_point: { x: Math.round(fx) / 100, y: Math.round(fy) / 100 },
      safe_text_area: safe,
      recommended_use: rec,
      duplicate_group: null,
      simulated: true,
    };
  }
  function photoMeta(src) { return PHOTO_FOCUS_CACHE.get(src) || null; }

  function scheduleSmartFocus(src) {
    if (!src || PHOTO_FOCUS_CACHE.has(src) || PHOTO_FOCUS_PENDING.has(src)) return;
    PHOTO_FOCUS_PENDING.add(src);
    analyzeImageFocus(src).then((focus) => {
      PHOTO_FOCUS_PENDING.delete(src); PHOTO_FOCUS_CACHE.set(src, focus); updateSmartImages(src, focus);
    });
  }
  function smartPos(src) {
    if (!src) return "center";
    scheduleSmartFocus(src);
    const f = focusValue(src);
    return `${f.x}% ${f.y}%`;
  }
  function bestCoverIndex(a) {
    const photos = (a && a.photos) || [];
    if (!photos.length) return 0;
    let best = 0, bestScore = -1;
    photos.forEach((src, i) => {
      const meta = photoMeta(src);
      if (!meta) return;
      const uses = meta.recommended_use || [];
      const score = (meta.quality_score || 0) * 100
        + (uses.includes("hero") ? 35 : 0)
        + (meta.orientation === "landscape" ? 18 : 0)
        + ((meta.subjects || []).length ? 8 : 0)
        - (meta.category === "天空" ? 24 : 0);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  }
  function coverStyle(a) {
    if (a.photos && a.photos[0]) return `background-image:url('${a.photos[0]}');background-position:${smartPos(a.photos[0])};`;
    return "";
  }
  // 详情页按活动类型切换版式 + 图文混排（模块化合，类型决定顺序与视觉基调）
  const STYLE_ACCENT = {
    city:   { grad: "linear-gradient(135deg,#1d2742,#3b2c52)", accent: "#E8B04B", vibe: "城市漫游 · 老街、夜景与烟火气" },
    sight:  { grad: "linear-gradient(135deg,#26473b,#3a5a4a)", accent: "#7FC8A9", vibe: "景区观光 · 慢游不赶路" },
    hike:   { grad: "linear-gradient(135deg,#233a2c,#3f5e3a)", accent: "#9CCC65", vibe: "山野徒步 · 一步一景" },
    alpine: { grad: "linear-gradient(135deg,#1a1a1a,#3a3a3a)", accent: "#E6E6E6", vibe: "高海拔登山 · 云端之上" },
    camp:   { grad: "linear-gradient(135deg,#3a2e22,#5a4a35)", accent: "#E0A96D", vibe: "露营 · 星空与篝火" },
    kids:   { grad: "linear-gradient(135deg,#ffd9c0,#ffb0a3)", accent: "#FF7043", vibe: "亲子户外 · 自然里的成长" },
    ski:    { grad: "linear-gradient(135deg,#1e3a5f,#3a6ea5)", accent: "#B3E5FC", vibe: "滑雪 · 雪道与速度" },
    cycling:{ grad: "linear-gradient(135deg,#2a2640,#4a3a5a)", accent: "#CE93D8", vibe: "骑行 · 风与路" },
    run:    { grad: "linear-gradient(135deg,#3a2626,#5a3a3a)", accent: "#FF8A65", vibe: "跑步 · 节奏与坚持" },
    climb:  { grad: "linear-gradient(135deg,#2a2626,#4a3a2a)", accent: "#FFB74D", vibe: "攀岩 · 向上每一步" },
    water:  { grad: "linear-gradient(135deg,#123a4a,#2a6a7a)", accent: "#4DD0E1", vibe: "溯溪玩水 · 清凉一夏" },
    drive:  { grad: "linear-gradient(135deg,#2a2a3a,#4a4a5a)", accent: "#90CAF9", vibe: "自驾旅行 · 自由在路上" },
    photo:  { grad: "linear-gradient(135deg,#2a263a,#5a3a4a)", accent: "#F48FB1", vibe: "摄影旅行 · 把风景带回家" },
    team:   { grad: "linear-gradient(135deg,#1f3a2a,#3a5a4a)", accent: "#81C784", vibe: "企业团建 · 一起出发" },
    travel: { grad: "linear-gradient(135deg,#2a3a4a,#4a5a6a)", accent: "#4DB6AC", vibe: "综合旅行 · 去远方" },
    outdoor:{ grad: "linear-gradient(135deg,#233a2c,#3f5e3a)", accent: "#9CCC65", vibe: "户外探索 · 把周末交给自然" },
  };
  function styleAccent(a) { return STYLE_ACCENT[a.pageStyle] || STYLE_ACCENT.outdoor; }
  function emotionLine(a) {
    if (a.headline) return a.headline;
    const T = a.type || "";
    if (/亲子|遛娃|儿童|少年|自然教育/.test(T)) return "这个周末，把手机还给孩子，把自然还给孩子。";
    if (/研学/.test(T)) return "最好的课堂，从来不带围墙。";
    if (/滑雪/.test(T)) return "雪季不该只活在收藏夹里。";
    if (/骑行/.test(T)) return "风、公路和自由，这次都给你。";
    if (/攀岩/.test(T)) return "抬头是岩壁与天空，低头是那个不敢尝试的自己。";
    if (/溯溪|桨板|漂流|玩水/.test(T)) return "夏天该有的样子，就是和水在一起。";
    if (/跑步|马拉松/.test(T)) return "不为 PB，只为那一程山风与晨光。";
    if (/自驾/.test(T)) return "方向盘一转，把周末交给公路、山谷和日落。";
    if (/摄影/.test(T)) return "把眼睛重新打开，把风景装进镜头。";
    if (/团建|企业/.test(T)) return "把团队带去山野，找回办公室里久违的默契。";
    if (/高海拔|雪山|登山/.test(T)) return "每一步，都在把海拔换成具体的体感。";
    if (/露营|营地/.test(T)) return "把闹钟关掉，去山里听一夜风声。";
    if (/徒步|爬山/.test(T)) return "城市待太久了，山风该吹一吹了。";
    if (/城市/.test(T)) return "城市待久了，总得找个周末，把一座城慢慢走完。";
    if (/景区|观光/.test(T)) return "不用做攻略，把假期过成朋友圈最羡慕的样子。";
    if (/旅行|游/.test(T)) return "你只管放松，剩下的交给山野。";
    return "走出城市，把周末交给自然。";
  }
  function coreTags(a) {
    const t = [];
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    if (confirmed.has("days") && a.days > 1) t.push(a.days + " 天行程");
    if (confirmed.has("age")) t.push("适合" + a.ageRange);
    if (confirmed.has("difficulty")) t.push(a.difficulty + "难度");
    if (confirmed.has("limit")) t.push("限额" + a.limit + a.limitUnit);
    if (confirmed.has("services") && a.includeLeader) t.push("含领队");
    return t.slice(0, 4);
  }
  function mediaBlock(a, i, label) {
    const ph = (a.photos || []);
    if (ph[i]) return `<div class="ph"><img class="ph-img" data-smart-img src="${ph[i]}" alt="" style="object-position:${smartPos(ph[i])};object-fit:cover"></div>`;
    const ac = styleAccent(a);
    return `<div class="ph ph-ph" style="background:${ac.grad}"><span class="ph-ic">${ICON("camera")}</span><span class="ph-lab">${esc(label || "现场实拍")}</span></div>`;
  }
  function galleryLayoutFor(a) {
    const p = a.pageStyle;
    if (p === "hike" || p === "alpine" || p === "ski") return "mosaic";
    if (p === "city" || p === "water") return "split";
    return "cards"; // kids, camp, sight, fallback
  }
  function galleryTitleFor(a) {
    const p = a.place || "这里";
    switch (a.pageStyle) {
      case "hike": return `${p}的山野，比滤镜更真实`;
      case "alpine": return `高处的人，最先看见光`;
      case "city": return `${p}的另一种打开方式`;
      case "camp": return `营地不是终点，是暂停`;
      case "water": return `水是${p}夏天的真实形状`;
      case "ski": return `雪季该有的样子，${p}都有`;
      case "kids": return `让孩子看见真实的世界`;
      case "sight": return `${p}的光，值得被认真看见`;
      default: return `走进现场，感受这次出发`;
    }
  }
  function galleryCaption(a) {
    // 优先用一段与 headline 不重复的地点季节短句
    const f = placeFlavorFor(a);
    if (f.seasonLine && a.headline && !a.headline.includes(f.seasonLine.slice(0, 10))) {
      return f.seasonLine.replace(/[。]$/, "") + "，照片里是没加修饰的真实现场。";
    }
    // 次选：从介绍中抽一句非 headline 的段落
    if (a.intro) {
      const paras = a.intro.split(/\n+/).map((s) => s.trim()).filter((s) => s && !s.includes(a.headline || "__NOHEAD__"));
      if (paras[0]) return paras[0].length > 44 ? paras[0].slice(0, 44) + "…" : paras[0];
    }
    // 兜底
    if (f.localVibe) return f.localVibe;
    return "照片记录的是活动的真实现场。";
  }
  function blockGallery(a) {
    const n = (a.photos || []).length;
    if (!n) return "";
    const title = galleryTitleFor(a);
    const caption = galleryCaption(a);
    const layout = galleryLayoutFor(a);
    const copy = `<span>FIELD NOTES</span><b>${esc(a.headline || title)}</b><small>${esc(caption)}</small>`;
    let inner;
    if (n === 1) {
      inner = `<div class="editorial-gallery one">${mediaBlock(a,0,"")}<div class="photo-note"><b>${esc(a.headline || title)}</b><span>${esc(caption)}</span></div></div>`;
    } else if (n === 2) {
      inner = `<div class="editorial-gallery two ${layout}"><div class="photo-a">${mediaBlock(a,0,"")}</div><div class="photo-copy">${copy}</div><div class="photo-b">${mediaBlock(a,1,"")}</div></div>`;
    } else {
      inner = `<div class="editorial-gallery many ${layout}"><div class="photo-a">${mediaBlock(a,0,"")}</div><div class="photo-b">${mediaBlock(a,1,"")}</div><div class="photo-copy">${copy}</div><div class="photo-c">${mediaBlock(a,2,"")}</div></div>`;
    }
    return `<section class="dsec story-sec editorial-sec"><div class="editorial-index">03 / MOMENTS</div><h3>${title}</h3>${inner}</section>`;
  }
  function departuresBlockHtml(a) {
    syncDepartures(a);
    const deps = (a.departures || []).filter((d) => d.status !== "closed");
    if (!deps.length) return "";
    if (deps.length === 1) {
      const d = deps[0];
      const price = d.price != null ? d.price : a.price;
      return `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("calendar")}</span><h3>行程与团期</h3></div>
        <div class="departure-single">
          <div class="dep-single-date"><span class="dep-single-week">${esc(d.weekDay)}</span><span class="dep-single-md">${esc(formatDepartureSlash(d.date))}</span></div>
          <div class="dep-single-info">
            <div class="dep-single-price">${price != null ? "¥" + price + "<small>/" + esc(a.limitUnit) + "</small>" : "价格详询"}</div>
            ${d.note ? `<div class="dep-single-note">${esc(d.note)}</div>` : ""}
          </div>
        </div>
      </div>`;
    }
    const cards = deps.map((d) => {
      const price = d.price != null ? d.price : a.price;
      const disabled = d.status === "full";
      return `<div class="departure-slide ${disabled ? "full" : ""}" data-departure-id="${d.id}">
        <div class="dep-slide-week">${esc(d.weekDay)}</div>
        <div class="dep-slide-md">${esc(formatDepartureSlash(d.date))}</div>
        <div class="dep-slide-price">${price != null ? "¥" + price : "详询"}</div>
        ${d.note ? `<div class="dep-slide-note">${esc(d.note)}</div>` : ""}
        ${disabled ? `<div class="dep-slide-badge">已满员</div>` : ""}
      </div>`;
    }).join("");
    return `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("calendar")}</span><h3>行程与团期</h3></div>
      <div class="departure-swiper">
        <div class="departure-track">${cards}</div>
      </div>
      <div class="tiny muted" style="margin-top:6px">左右滑动查看可报名团期，报名时请选择对应日期。</div>
    </div>`;
  }

  function blockLeader(a) {
    const ids = a.leaderIds || [];
    if (!ids.length) return "";
    const list = ids.map((id) => findLeaderById(id)).filter(Boolean);
    if (!list.length) return "";
    const cards = list.map((l, i) => {
      const rows = [];
      if (l.years) rows.push(["从业经验", l.years]);
      if (l.cert) rows.push(["相关资质", l.cert]);
      if (l.trips) rows.push(["带队场次", l.trips]);
      const av = l.avatar
        ? `<div class="leader-av leader-av-img" style="background-image:url('${esc(l.avatar)}')"></div>`
        : `<div class="leader-av">${esc((l.name || "领")[0])}</div>`;
      const tag = i === 0 ? "主领队" : (i === list.length - 1 ? "收尾领队" : "协作领队");
      const rowsHtml = rows.map(([k, v]) => `<div class="leader-meta-row"><span class="leader-meta-label">${esc(k)}</span><span class="leader-meta-value">${esc(v)}</span></div>`).join("");
      return `<div class="leader-slide-card">
        ${av}
        <div class="leader-info">
          <div class="leader-name"><span class="leader-name-text">${esc(l.name)}</span><span class="leader-tag">${tag}</span></div>
          <div class="leader-meta">${rowsHtml}</div>
        </div>
      </div>`;
    }).join("");
    const dots = list.length > 1 ? `<div class="leader-dots">${list.map((_, i) => `<span class="ld ${i === 0 ? "active" : ""}"></span>`).join("")}</div>` : "";
    return `<div class="dsec"><h3><span class="bar"></span>领队与安全保障</h3>
      <div class="leader-swiper">
        <div class="leader-track" id="leaderTrack">${cards}</div>
      </div>
      ${dots}
      <div class="tiny muted" style="margin-top:8px">具体的安全说明与应急安排，以机构出团通知为准。</div>
    </div>`;
  }

  // 领队资料库：复用真实领队信息，避免每场活动重复填写
  function ensureLeaders() { if (!state.leaders) state.leaders = []; }
  function findLeaderById(id) { return (state.leaders || []).find((l) => l.id === id); }
  function loadLeaderIntoDraft(a, id) {
    const l = findLeaderById(id);
    if (!l) return;
    a._editingLeaderId = id;
    a.leaderName = l.name || "";
    a.leaderYears = l.years || "";
    a.leaderCert = l.cert || "";
    a.leaderTrips = l.trips || "";
  }
  function clearLeaderDraft(a) {
    a._editingLeaderId = "";
    a.leaderName = "";
    a.leaderYears = "";
    a.leaderCert = "";
    a.leaderTrips = "";
  }
  function toggleLeader(a, id) {
    ensureLeaders();
    const ids = a.leaderIds = a.leaderIds || [];
    const idx = ids.indexOf(id);
    if (idx >= 0) {
      ids.splice(idx, 1);
      if (a._editingLeaderId === id) clearLeaderDraft(a);
    } else {
      ids.push(id);
      loadLeaderIntoDraft(a, id);
      confirmFact(a, "leaderInfo");
    }
    saveState();
  }
  function removeLeaderFromActivity(a, id) {
    const ids = a.leaderIds = a.leaderIds || [];
    const idx = ids.indexOf(id);
    if (idx >= 0) ids.splice(idx, 1);
    if (a._editingLeaderId === id) clearLeaderDraft(a);
    saveState();
  }
  function saveLeaderFromDraft(a) {
    ensureLeaders();
    const name = String(a.leaderName || "").trim();
    if (!name) { toast("请先填写领队姓名"); return false; }
    const editingId = a._editingLeaderId || "";
    const existing = editingId ? findLeaderById(editingId) : null;
    const avatar = (a._leaderAvatarDraft || "").trim();
    if (existing) {
      existing.name = name;
      existing.years = a.leaderYears || "";
      existing.cert = a.leaderCert || "";
      existing.trips = a.leaderTrips || "";
      if (avatar) existing.avatar = avatar;
      existing.updatedAt = Date.now();
      if (!(a.leaderIds || []).includes(existing.id)) a.leaderIds.push(existing.id);
    } else {
      const id = uid();
      state.leaders.push({ id, name, years: a.leaderYears || "", cert: a.leaderCert || "", trips: a.leaderTrips || "", avatar: avatar || "", createdAt: Date.now() });
      a.leaderIds = a.leaderIds || [];
      a.leaderIds.push(id);
      a._editingLeaderId = id;
    }
    a._leaderAvatarDraft = "";
    saveState();
    confirmFact(a, "leaderInfo");
    return true;
  }
  function deleteLeaderFromLibrary(id) {
    ensureLeaders();
    state.leaders = (state.leaders || []).filter((l) => l.id !== id);
    (state.activities || []).forEach((a) => {
      a.leaderIds = (a.leaderIds || []).filter((lid) => lid !== id);
      if (a._editingLeaderId === id) clearLeaderDraft(a);
    });
    saveState();
  }
  // 领队头像：上传后自动居中裁剪为 1:1 正方形（前端圆形容器展示即为圆形头像）
  function cropToSquare(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const c = document.createElement("canvas");
        c.width = 256; c.height = 256;
        const cx = c.getContext("2d");
        cx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => resolve("");
      img.src = src;
    });
  }

  // 头像手动裁剪编辑器：上传后可在圆形取景框内拖拽/缩放，确认后再生成头像
  let cropState = null;
  const CROP_VIEW = 260; // 取景框尺寸
  const CROP_OUT = 256;  // 输出头像尺寸
  function openAvatarCropper(src) {
    cropState = { src, w: 0, h: 0, scale: 1, x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };
    let overlay = $("#avatarCropOverlay");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.className = "avatar-crop-overlay";
    overlay.id = "avatarCropOverlay";
    overlay.innerHTML = `
      <div class="avatar-crop-modal">
        <div class="avatar-crop-head">
          <h4>调整头像显示区域</h4>
          <p class="tiny muted">拖动图片，或滚动缩放，确保面部居中清晰</p>
        </div>
        <div class="avatar-crop-body">
          <div class="crop-stage">
            <div class="crop-frame"></div>
            <img class="crop-img" id="cropImg" src="${esc(src)}" draggable="false" alt="">
          </div>
          <div class="crop-preview-col">
            <div class="crop-preview" id="cropPreview"></div>
            <span class="tiny muted">预览</span>
          </div>
        </div>
        <div class="crop-zoom">
          <span class="tiny muted">-</span>
          <input type="range" id="cropZoom" min="0" max="100" value="0">
          <span class="tiny muted">+</span>
        </div>
        <div class="avatar-crop-actions">
          <button class="btn btn-ghost btn-sm" data-action="cancelAvatarCrop">取消</button>
          <button class="btn btn-soft btn-sm" data-action="confirmAvatarCrop">确认使用</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const img = $("#cropImg");
    const preview = $("#cropPreview");
    img.onload = () => {
      cropState.w = img.naturalWidth || img.width;
      cropState.h = img.naturalHeight || img.height;
      const minScale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      cropState.scale = minScale;
      cropState.x = 0; cropState.y = 0;
      updateCropPreview();
    };
    if (img.complete && img.naturalWidth) {
      cropState.w = img.naturalWidth; cropState.h = img.naturalHeight;
      cropState.scale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      updateCropPreview();
    }
    bindCropEvents(overlay);
  }
  function updateCropPreview() {
    if (!cropState) return;
    const { w, h, scale, x, y } = cropState;
    const imgW = w * scale;
    const imgH = h * scale;
    const baseX = (CROP_VIEW - imgW) / 2;
    const baseY = (CROP_VIEW - imgH) / 2;
    const rawX = baseX + x;
    const rawY = baseY + y;
    const minX = CROP_VIEW - imgW;
    const minY = CROP_VIEW - imgH;
    const clampedX = Math.max(minX, Math.min(0, rawX));
    const clampedY = Math.max(minY, Math.min(0, rawY));
    cropState.x = clampedX - baseX;
    cropState.y = clampedY - baseY;
    const img = $("#cropImg");
    if (img) { img.style.width = `${imgW}px`; img.style.height = `${imgH}px`; img.style.left = `${clampedX}px`; img.style.top = `${clampedY}px`; }
    const preview = $("#cropPreview");
    if (preview) {
      const sx = -clampedX / scale;
      const sy = -clampedY / scale;
      const sSize = CROP_VIEW / scale;
      preview.style.backgroundImage = `url('${esc(cropState.src)}')`;
      preview.style.backgroundSize = `${(CROP_VIEW / sSize) * 100}%`;
      preview.style.backgroundPosition = `${((sx + sSize / 2) / w) * 100}% ${((sy + sSize / 2) / h) * 100}%`;
    }
    const zoom = $("#cropZoom");
    if (zoom && cropState.w && cropState.h) {
      const minScale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      const t = Math.log(scale / minScale) / Math.log(3);
      zoom.value = Math.max(0, Math.min(100, Math.round(t * 100)));
    }
  }
  function bindCropEvents(overlay) {
    const stage = overlay.querySelector(".crop-stage");
    const zoom = $("#cropZoom");
    const onStart = (e) => {
      cropState.dragging = true;
      const p = e.touches ? e.touches[0] : e;
      cropState.lastX = p.clientX; cropState.lastY = p.clientY;
      stage.style.cursor = "grabbing";
    };
    const onMove = (e) => {
      if (!cropState || !cropState.dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - cropState.lastX;
      const dy = p.clientY - cropState.lastY;
      cropState.x += dx; cropState.y += dy;
      cropState.lastX = p.clientX; cropState.lastY = p.clientY;
      updateCropPreview();
    };
    const onEnd = () => { cropState.dragging = false; stage.style.cursor = "grab"; };
    stage.addEventListener("mousedown", onStart);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    stage.addEventListener("touchstart", onStart, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (!cropState || !cropState.w) return;
      const minScale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      const delta = e.deltaY > 0 ? -0.06 : 0.06;
      cropState.scale = Math.max(minScale, Math.min(minScale * 3, cropState.scale * (1 + delta)));
      updateCropPreview();
    }, { passive: false });
    zoom.addEventListener("input", () => {
      if (!cropState || !cropState.w) return;
      const minScale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      const t = parseInt(zoom.value, 10) / 100;
      cropState.scale = minScale * Math.pow(3, t);
      updateCropPreview();
    });
    overlay._cropCleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }
