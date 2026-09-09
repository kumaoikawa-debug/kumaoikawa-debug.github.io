  /* ---------------- C 端首页装修器（v90） ----------------
     后台「设置 → 界面装修」三栏：左组件库 / 中手机预览 / 右属性配置。
     复用 front.js 的 renderComponent(c, true) 作实时预览。 */

  const HOME_TEMPLATE_CARDS = [
    { id: "classic_route", name: "经典线路社", desc: "徒步 / 登山 / 路线俱乐部", icon: "mountain" },
    { id: "camp_study", name: "综合营地·研学", desc: "营地教育 / 研学机构", icon: "tent" },
    { id: "community", name: "轻量社群", desc: "城市社群 / 运动打卡", icon: "users" },
    { id: "blank", name: "空白自定义", desc: "从零开始自由组合", icon: "layout" },
  ];
  const HOME_COMPONENT_LIB = [
    { type: "banner", name: "轮播图", icon: "photo" },
    { type: "entry", name: "焦点入口", icon: "compass" },
    { type: "activities", name: "活动专区", icon: "flame" },
    { type: "upcoming", name: "即将出发", icon: "clock" },
    { type: "coupon", name: "优惠券", icon: "ticket" },
    { type: "gear", name: "装备推荐", icon: "shopping-bag" },
    { type: "member", name: "会员积分卡", icon: "crown" },
    { type: "brand", name: "品牌故事", icon: "quote" },
  ];
  const DECORATE_ICON_CHOICES = ["mountain", "tent", "droplet", "leaf", "bike", "compass", "sun", "camera", "shoe", "umbrella", "flame", "users", "heart", "star", "map-pin", "book", "food", "utensils", "shirt", "ruler", "headlamp", "bag", "ticket", "crown", "sparkles"];
  function COMP_NAME(t) {
    return ({ banner: "轮播图", entry: "焦点入口", activities: "活动专区", upcoming: "即将出发", coupon: "优惠券", gear: "装备推荐", member: "会员积分卡", brand: "品牌故事" })[t] || t;
  }

  function renderDecorate() {
    const hl = state.homeLayout || (state.homeLayout = JSON.parse(JSON.stringify(DEFAULT_HOME_LAYOUT)));
    const comps = hl.components || [];
    return `
      <div class="section-head"><div class="section-title">界面装修</div><div class="section-sub">选一个行业模版快速起步，再自由调整组件顺序、内容与显隐</div></div>

      <div class="dec-templates">
        ${HOME_TEMPLATE_CARDS.map((t) => `<button class="tpl-card ${hl.template === t.id ? "active" : ""}" data-action="pickTemplate" data-id="${t.id}">
          <div class="tpl-ic">${ICON(t.icon)}</div>
          <div class="tpl-name">${esc(t.name)}</div>
          <div class="tpl-desc">${esc(t.desc)}</div>
        </button>`).join("")}
      </div>

      <div class="dec-body">
        <div class="dec-col dec-lib">
          <div class="dec-col-h">组件库</div>
          <div class="dec-lib-list">
            ${HOME_COMPONENT_LIB.map((c) => `<button class="lib-item" data-action="addComponent" data-type="${c.type}">
              <span class="lib-ic">${ICON(c.icon)}</span><span>${esc(c.name)}</span>
            </button>`).join("")}
          </div>
          <p class="tiny muted" style="padding:10px 12px;margin:0">点击组件添加到首页底部</p>
        </div>

        <div class="dec-col dec-preview">
          <div class="dec-col-h">手机预览</div>
          <div class="phone">
            <div class="phone-notch"></div>
            <div class="phone-screen" id="decoPhoneScreen">${comps.length ? comps.map((c, i) => renderDecoComp(c, i, comps.length)).join("") : '<div class="dec-empty">还没有组件，从左侧添加或选择上方模版</div>'}</div>
          </div>
        </div>

        <div class="dec-col dec-prop">
          <div class="dec-col-h">属性配置</div>
          <div class="dec-prop-body" id="decPropBody">${comps.length ? comps.map((c, i) => renderDecoProp(c, i)).join("") : '<div class="tiny muted" style="padding:12px">选中模版或添加组件后，可在此编辑标题与内容</div>'}</div>
        </div>
      </div>
    `;
  }

  function renderDecoComp(c, i, n) {
    const prev = c.hidden ? '<div class="deco-comp-empty">已隐藏（C 端不展示）</div>' : renderComponent(c, true);
    return `<div class="deco-comp ${c.hidden ? "is-hidden" : ""}" data-idx="${i}">
      <div class="deco-comp-bar">
        <span class="deco-comp-name">${COMP_NAME(c.type)}</span>
        <span class="deco-comp-actions">
          <button class="mini-btn" title="上移" data-action="moveComp" data-dir="up" data-idx="${i}" ${i === 0 ? "disabled" : ""}>${ICON("chevron-up")}</button>
          <button class="mini-btn" title="下移" data-action="moveComp" data-dir="down" data-idx="${i}" ${i === n - 1 ? "disabled" : ""}>${ICON("chevron-down")}</button>
          <button class="mini-btn" title="${c.hidden ? "显示" : "隐藏"}" data-action="toggleCompHidden" data-idx="${i}">${c.hidden ? ICON("eye-off") : ICON("eye")}</button>
          <button class="mini-btn danger" title="删除" data-action="delComp" data-idx="${i}">${ICON("trash")}</button>
        </span>
      </div>
      <div class="deco-comp-prev">${prev}</div>
    </div>`;
  }

  function renderDecoProp(c, i) {
    const cfg = c.config || {};
    let extra = "";
    if (c.type === "entry") {
      const items = cfg.items || [];
      extra = `<div class="prop-items">
        ${items.map((it, j) => `<div class="prop-item-row">
          <input class="input input-sm" data-bind-entry-label="${i}" data-j="${j}" value="${esc(it.label || "")}" placeholder="名称">
          <select class="select select-sm" data-bind-entry-icon="${i}" data-j="${j}">${DECORATE_ICON_CHOICES.map((ic) => `<option value="${ic}" ${ic === (it.icon || "mountain") ? "selected" : ""}>${ic}</option>`).join("")}</select>
          <button class="mini-btn danger" data-action="delEntryItem" data-i="${i}" data-j="${j}">${ICON("x")}</button>
        </div>`).join("")}
        <button class="btn btn-soft btn-sm" data-action="addEntryItem" data-i="${i}">+ 添加入口</button>
      </div>`;
    }
    return `<div class="prop-card">
      <div class="prop-card-h"><span class="prop-type">${COMP_NAME(c.type)}</span>${c.hidden ? '<span class="prop-hidden-badge">已隐藏</span>' : ""}</div>
      <div class="field"><label>标题</label><input class="input input-sm" data-bind-comp-title="${i}" value="${esc(cfg.title || "")}" placeholder="留空用默认标题"></div>
      ${extra}
    </div>`;
  }

  function refreshDecoPreview() {
    const sc = document.getElementById("decoPhoneScreen");
    if (!sc) return;
    const comps = state.homeLayout.components || [];
    sc.innerHTML = comps.length ? comps.map((c, i) => renderDecoComp(c, i, comps.length)).join("") : '<div class="dec-empty">还没有组件，从左侧添加或选择上方模版</div>';
  }
  function rerenderDecorateProps() {
    const pb = document.getElementById("decPropBody");
    if (!pb) return;
    const comps = state.homeLayout.components || [];
    pb.innerHTML = comps.length ? comps.map((c, i) => renderDecoProp(c, i)).join("") : '<div class="tiny muted" style="padding:12px">选中模版或添加组件后，可在此编辑标题与内容</div>';
  }
