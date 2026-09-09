  function showView(view, params) {
    if (state.view && state.view !== view) backStack.push(state.view);
    state.view = view; state.params = params || {};
    const app = $("#app");
    if (view === "login") { app.innerHTML = renderLogin(); return; }
    const backend = ["dashboard", "create", "advice", "editor", "list", "customers", "operator", "mallConsole", "settings", "decorate", "analytics", "signups", "membership", "ai", "brand", "plans", "memberMarketing", "membershipAdmin"];
    if (backend.includes(view)) {
      let content = "";
      if (view === "dashboard") content = renderDashboard();
      else if (view === "create") content = renderCreate();
      else if (view === "advice") content = renderContentAdvice();
      else if (view === "editor") content = renderEditor();
      else if (view === "list") content = renderList();
      else if (view === "customers") content = renderCustomers();
      else if (view === "operator") content = renderFabu();
      else if (view === "mallConsole") { state.mallCtx = "console"; content = renderClubMallConsole(); }
      else if (view === "settings") content = renderSettings();
      else if (view === "decorate") content = renderDecorate();
      else if (view === "analytics") content = renderAnalytics();
      else if (view === "signups") content = renderSignups();
      else if (view === "membership" || view === "membershipAdmin") content = renderMembershipAdmin();
      else if (view === "ai" || view === "brand" || view === "plans" || view === "memberMarketing") content = renderSettings();
      app.innerHTML = renderShell(content, view);
      if (view === "editor") bindEditorExtras();
      // 进入编辑器即按地点联网自动搜索风景图（仅一次、且仅当已有地点且无图时），供「为什么值得去」配图
      if (view === "editor" && state.draft && state.draft.place && !state.draft.placePhotos && !state.draft._autoPhoto) {
        state.draft._autoPhoto = true;
        state.draft._searchingPlacePhotos = true;
        setTimeout(() => {
          if (!state.draft) return;
          fetchPlacePhotos(state.draft.place, (res) => {
            if (!state.draft) return;
            state.draft._searchingPlacePhotos = false;
            state.draft.placePhotos = res;
            if (!state.draft.whyGoPhoto && res.length) state.draft.whyGoPhoto = res[0].src;
            if (state.view === "editor") rerenderEditor();
          });
        }, 700);
      }
      if (view === "settings" || view === "brand") bindBrandExtras();
      if (view === "decorate") bindDecorateExtras();
      if (view === "operator") bindFabuExtras();
      updateBrandColor();
      return;
    }
    // frontend
    if (view === "frontHome") { app.innerHTML = renderFrontHome(); initBentoScroll(); initHeroCarousel(); }
    else if (view === "detail") app.innerHTML = wrapPhone(renderActivityPhone(getActivity(params.id)), true);
    else if (view === "signup") app.innerHTML = renderSignupPage(params.id);
    else if (view === "success") app.innerHTML = renderSuccess(params.id, params.signupId);
    else if (view === "mySignups") app.innerHTML = renderMySignups();
    else if (view === "myOrders") app.innerHTML = renderMyOrders();
    else if (view === "mall") { state.mallCtx = "store"; app.innerHTML = renderStorefront(); }
    else if (view === "mallAdmin") { state.mallView = "admin"; state.mallCtx = "admin"; app.innerHTML = renderMallAdmin(); }
    else if (view === "mallCommission") { state.mallConsoleTab = "commission"; state.view = "mallConsole"; app.innerHTML = renderShell(renderClubMallConsole(), "mallConsole"); }
    else if (view === "mallProduct") app.innerHTML = renderMallProduct(getProduct(params.id));
    else if (view === "memberCenter") app.innerHTML = renderMembershipH5();
    else app.innerHTML = renderFrontHome();
    window.scrollTo(0, 0);
  }

  function bindEditorExtras() {
    const inp = $("#photoInput");
    if (inp && !inp._bound) {
      inp._bound = true;
      inp.addEventListener("change", (e) => {
        const files = Array.from(e.target.files);
        let pending = files.length;
        if (!pending) return;
        files.forEach((f) => {
          const r = new FileReader();
          r.onload = (ev) => {
            const src = ev.target.result;
            analyzeImageFocus(src).then((focus) => {
              PHOTO_FOCUS_CACHE.set(src, focus);
              if (state.draft) state.draft.photos.push(src);
              if (--pending === 0) {
                if (state.draft && !state.draft._coverManual) state.draft.coverIndex = bestCoverIndex(state.draft);
                if (state.draft) { $("#thumbsWrap").innerHTML = thumbsHtml(state.draft); refreshPreview(); }
                e.target.value = "";
              }
            });
          };
          r.readAsDataURL(f);
        });
      });
    }
  }
  function bindFabuExtras() {
    const inp = $("#xfPhotoInput");
    if (inp && !inp._bound) {
      inp._bound = true;
      inp.addEventListener("change", (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        let pending = files.length;
        files.forEach((f) => {
          const r = new FileReader();
          r.onload = (ev) => {
            const src = ev.target.result;
            (typeof analyzeImageFocus === "function" ? analyzeImageFocus(src) : Promise.resolve(null)).then((focus) => {
              if (typeof PHOTO_FOCUS_CACHE !== "undefined" && focus) PHOTO_FOCUS_CACHE.set(src, focus);
              const xf = xfState();
              xf.photos = xf.photos || [];
              xf.photos.push(src);
              if (--pending === 0) showView(state.view);
            });
          };
          r.readAsDataURL(f);
        });
      });
    }
    // live bind custom recap fields so re-render does not lose typed values
    ["customTitle", "customDate", "customPlace", "customType", "customSignups", "customLeader"].forEach((k) => {
      const el = document.querySelector(`[data-xf="${k}"]`);
      if (el && !el._xfBound) {
        el._xfBound = true;
        el.addEventListener("input", (e) => {
          const xf = xfState();
          xf.customRecap = xf.customRecap || {};
          xf.customRecap[k.replace("custom", "").toLowerCase()] = e.target.value;
        });
      }
    });
  }
  function refreshPreview() {
    const sc = $("#previewScreen");
    if (sc && state.draft) sc.innerHTML = renderActivityPhone(state.draft);
  }
  function updateAgeTag(el) {
    const tag = el && el.closest(".field") && el.closest(".field").querySelector(".auto-tag");
    if (tag && tag.textContent !== "已手动调整") tag.textContent = "已手动调整";
  }
  function bindBrandExtras() {
    const inp = $("#logoInput");
    if (inp && !inp._bound) {
      inp._bound = true;
      inp.addEventListener("change", (e) => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = (ev) => { state.brand.logo = ev.target.result; state.brand.logoText = state.brand.logoText || "C"; saveState(); rerenderBrand(); };
        r.readAsDataURL(f);
      });
    }
  }
  function rerenderBrand() {
    const ed = $("#content");
    if (ed) { ed.innerHTML = renderBrand(); bindBrandExtras(); }
  }
  function bindDecorateExtras() {
    // 预览区内的组件（轮播/活动/入口等）点击不应触达全局导航，仅拦截组件体
    const ps = document.getElementById("decoPhoneScreen");
    if (ps && !ps._bound) {
      ps._bound = true;
      ps.addEventListener("click", (e) => { if (e.target.closest(".deco-comp-prev")) e.stopPropagation(); });
    }
  }
  function updateBrandColor() {
    document.documentElement.style.setProperty("--brand", state.brand.primary);
    document.documentElement.style.setProperty("--brand-700", darken(state.brand.primary, 0.82));
    document.documentElement.style.setProperty("--brand-soft", hexA(state.brand.primary, 0.10));
    document.documentElement.style.setProperty("--brand-tint", hexA(state.brand.primary, 0.05));
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------------- actions ---------------- */
  function syncCustSelUI() {
    const info = document.getElementById("custSelInfo");
    if (info) info.textContent = "· 已选 " + _clubosCustSel.size + " 位";
    const all = document.getElementById("customerSelectAll");
    if (all) {
      const rows = document.querySelectorAll('[data-action="customerSelect"]');
      all.checked = rows.length > 0 && [...rows].every((cb) => cb.checked);
    }
  }
  async function handleClick(action, el) {
    const d = el.dataset;
    switch (action) {
      case "backToEdit": {
        // 发布被阻止时，返回应回到可编辑的内容页，而不是跳过到工作台
        if (state.draft && state.editorTab === "publish" && state.draft._publishCheck && state.draft._publishCheck.blocking.length) {
          state.editorTab = "content"; rerenderEditor();
        } else {
          showView("dashboard"); window.scrollTo(0, 0);
        }
        break;
      }
      case "nav": showView(d.view); window.scrollTo(0, 0); break;
      case "doLogin": {
        const phone = $("#loginPhone").value.trim();
        if (!phone) return toast("请输入手机号");
        showView("dashboard"); break;
      }
      case "sendCode": toast("验证码已发送（Demo：1234）"); break;
      case "generate": generateFromInput(); break;
      case "voice": toast("语音输入为视觉占位，Demo 中请直接输入文字"); break;
      case "paste": { const ta = $("#createInput"); if (ta) { ta.value = PASTE_SAMPLE; ta.focus(); } toast("已填入一段示例旧文案"); break; }
      case "example": { const ta = $("#createInput"); if (ta) { ta.value = d.text; } else { state.draft = blankActivity(); state.draft.raw = d.text; parseActivityWithAI(d.text).then(async (json) => { if (json && !json._error && !json._needKey) { applyAIResult(json, state.draft); await ensureNarrativeFields(state.draft); await ensureItineraryFields(state.draft); syncItineraryDays(state.draft); } showView("editor"); }); } break; }
      case "back": {
        const prev = backStack.pop();
        if (prev) showView(prev); else showView("dashboard");
        break;
      }
      case "saveDraft": {
        if (!state.draft) return;
        state.draft.status = "draft";
        if (state.draft.pinned) state.draft.pinnedAt = Date.now();
        upsert(state.draft); state.draft = null; toast("已存为草稿"); showView("list"); break;
      }
      case "publish": {
        if (!state.draft) return;
        // V2.0：发布前事实检查——关键错误禁止发布，非关键缺失提示后可发布
        const chk = runPublishCheck(state.draft);
        state.draft._publishCheck = chk;
        if (chk.blocking.length) {
          toast("发布被阻止：" + chk.blocking[0]);
          state.editorTab = "publish";
          rerenderEditor();
          break;
        }
        if (chk.warnings.length) toast("有 " + chk.warnings.length + " 项待确认，详见发布 Tab");
        state.draft.status = "recruiting";
        if (state.draft.pinned) state.draft.pinnedAt = Date.now();
        const snap = JSON.parse(JSON.stringify(state.draft));
        upsert(state.draft);
        // 发布后自动进入历史活动库，供下次相似活动一键沿用
        state.history = state.history || [];
        snap._historyAt = Date.now();
        state.history.unshift(snap); state.history = state.history.slice(0, 30);
        saveState();
        const id = state.draft.id; state.draft = null; showPublishSuccess(id); break;
      }
      case "togglePinned": {
        if (!state.draft) break;
        state.draft.pinned = !state.draft.pinned;
        state.draft.pinnedAt = state.draft.pinned ? Date.now() : 0;
        rerenderEditor();
        break;
      }
      case "finishPublish": { closePublishSuccess(); break; }
      case "openFront": { const mm = document.querySelector(".modal-mask"); if (mm) mm.remove(); if (d.id) showView("detail", { id: d.id }); break; }
      case "openFrontHome": showView("frontHome"); break;
      case "focusSearch": { const inp = $("#frontSearchInput"); if (inp) { inp.focus(); toast("输入关键词，AI 将推荐相关活动"); } break; }
      case "edit": { const a = getActivity(d.id); if (a) { state.draft = JSON.parse(JSON.stringify(a)); showView("editor"); } break; }
      case "copy": {
        const a = getActivity(d.id); if (!a) break;
        const c = JSON.parse(JSON.stringify(a)); c.id = uid(); c.title = a.title + "（副本）"; c.status = "draft"; c.signups = 0; c.createdAt = Date.now();
        state.draft = c; toast("已复制，修改日期/价格即可重新发布"); showView("editor"); break;
      }
      case "toggle": {
        const a = getActivity(d.id); if (!a) break;
        a.status = a.status === "down" ? "recruiting" : "down"; saveState(); toast(a.status === "down" ? "已下架" : "已重新上架"); showView("list"); break;
      }
      case "del": {
        const a = getActivity(d.id); if (!a) break;
        if (window.confirm("确定删除活动「" + a.title + "」？")) { state.activities = state.activities.filter((x) => x.id !== d.id); saveState(); toast("已删除"); showView("list"); }
        break;
      }
      case "filter": state.listFilter = d.f; showView("list"); break;
      case "share": openShare(d.id); break;
      case "shareFront": openShare(d.id, "front"); break;
      case "parsePaste": {
        if (!state.draft) break;
        const ta = $("#itinPaste"); if (!ta || !ta.value.trim()) return toast("请先粘贴行程文本");
        const days = parseItinerary(ta.value);
        if (!days.length) return toast("未能识别到行程，请检查格式");
        state.draft.itineraryDays = days; syncItineraryDays(state.draft);
        confirmFact(state.draft, "itinerary");
        toast("已填入 " + days.length + " 天行程"); rerenderEditor(); break;
      }
      case "clearPaste": { const ta = $("#itinPaste"); if (ta) ta.value = ""; break; }
      case "reuseHistory": {
        if (!state.draft || !d.id) break;
        const h = (state.history || []).find((x) => x.id === d.id); if (!h) break;
        state.draft.itineraryDays = JSON.parse(JSON.stringify(h.itineraryDays || []));
        state.draft.intro = h.intro || state.draft.intro;
        state.draft.highlights = JSON.parse(JSON.stringify(h.highlights || []));
        state.draft.feeInclude = JSON.parse(JSON.stringify(h.feeInclude || []));
        state.draft.feeExclude = JSON.parse(JSON.stringify(h.feeExclude || []));
        state.draft.safety = JSON.parse(JSON.stringify(h.safety || []));
        state.draft._similarId = null; state.draft._similarTitle = null;
        syncDerived(state.draft);
        toast("已沿用《" + h.title + "》的行程与文案"); rerenderEditor(); break;
      }
      case "openHistory": openHistoryModal(); break;
      case "useHistory": {
        const h = (state.history || []).find((x) => x.id === d.id); if (!h) break;
        state.draft = JSON.parse(JSON.stringify(h)); state.draft.id = uid();
        state.draft.status = "draft"; state.draft.signups = 0; state.draft.createdAt = Date.now();
        state.draft._similarId = null; state.draft._similarTitle = null;
        state.draft.date = ""; state.draft.dateMD = ""; state.draft.price = null;
        syncDerived(state.draft);
        toast("已载入历史活动，请更新日期与价格"); showView("editor"); break;
      }
      case "upload": { const inp = $("#photoInput"); if (inp) inp.click(); break; }
      case "delPhoto": { if (state.draft) { state.draft.photos.splice(+d.i, 1); $("#thumbsWrap").innerHTML = thumbsHtml(state.draft); refreshPreview(); } break; }
      case "toggleServ": { if (state.draft) { state.draft[d.key] = !state.draft[d.key]; confirmFact(state.draft, "services"); syncDerived(state.draft); rerenderEditor(); } break; }
      case "toggleActOpt": {
        if (!state.draft) break;
        state.draft[d.key] = !state.draft[d.key];
        saveState();
        rerenderEditor();
        break;
      }
      case "pickMissing": {
        if (!state.draft) break;
        if (d.key === "meal") { state.draft.includeMeal = d.val === "1"; }
        else if (d.val === "2") { /* 暂不确定：保持默认 */ }
        else { state.draft[d.key] = isNaN(+d.val) ? d.val : +d.val; }
        syncDerived(state.draft); rerenderEditor(); break;
      }
      case "aiCmd": applyAiCmd($("#aiCmd") ? $("#aiCmd").value : ""); break;
      case "aiCmdPreset": $("#aiCmd").value = d.cmd; applyAiCmd(d.cmd); break;
      case "regenField": {
        if (!state.draft) break;
        const field = d.field;
        const def = REGEN_FIELDS[field];
        if (!def) break;
        if (!aiAuthMode()) { toast("请先在「AI 设置」配置后端地址或本地演示 Key 才能换文案"); break; }
        if (aiBalance() < AI_COST_PER_CALL) { toast("AI 积分不足，请到「俱乐部中心 → AI 额度」充值或等每月刷新"); break; }
        const btn = el.closest ? el.closest(".mini-regen") : null;
        if (btn) { btn.disabled = true; btn.classList.add("loading"); const t = btn.innerHTML; btn.dataset.ht = t; btn.innerHTML = '<span class="spin">' + ICON("refresh") + "</span>生成中"; }
        toast("AI 正在重写「" + def.label + "」…");
        regenField(state.draft, field).then((r) => {
          if (r && r._needKey) toast("请先在「AI 设置」填写 Key");
          else if (r && r._noCredit) toast("AI 积分不足，请到「俱乐部中心 → AI 额度」充值或等每月刷新");
          else if (r === true) { toast("已更新「" + def.label + "」· 消耗 " + AI_COST_PER_CALL + " AI 积分"); syncDerived(state.draft); }
          else toast("「" + def.label + "」生成失败，请重试");
          if (btn) { btn.disabled = false; btn.classList.remove("loading"); btn.innerHTML = btn.dataset.ht || t; }
          rerenderEditor(); refreshPreview();
        });
        break;
      }
      case "openAdvice": showView("advice"); break;
      case "pickContentDirection": {
        if (!state.draft || !state.draft.contentDirections) break;
        const i = Math.max(0, Math.min(+d.i || 0, state.draft.contentDirections.length - 1));
        const dir = state.draft.contentDirections[i];
        if (!dir) break;
        state.draft.contentDirection = i;
        state.draft.contentStrategy = dir;
        if (dir.headline) { state.draft.headline = dir.headline; state.draft.title = dir.headline; }
        if (dir.intro) state.draft.intro = dir.intro;
        if (dir.posterLine) state.draft.posterTagline = dir.posterLine;
        showView("advice");
        break;
      }
      case "approveDirection": {
        if (!state.draft) break;
        state.draft.contentApproved = true;
        showView("editor"); break;
      }
      case "pickForewordTitle": {
        if (!state.draft || !state.draft.forewordTitles || state.draft.forewordTitles[+d.i] == null) break;
        const t = state.draft.forewordTitles[+d.i];
        state.draft.title = t;
        state.draft.titleVariants = state.draft.titleVariants || {};
        state.draft.titleVariants.brand = t;
        if (state.draft.contentStrategy) state.draft.contentStrategy.headline = t;
        rerenderEditor(); break;
      }
      case "saveBrand": saveBrand(); break;
      case "saveAI": saveAISettings(); break;
      case "testAI": {
        const keyEl = $("#aiKey"); const provEl = $("#aiProvider");
        if (keyEl && keyEl.value.trim()) setAIKey(keyEl.value.trim());
        if (provEl) setAIProvider(provEl.value);
        if (!aiAuthMode()) return toast("请先填写本地演示 Key，或配置总平台后端地址");
        toast("正在测试连接…");
        parseActivityWithAI(SAMPLE_FULL).then((json) => {
          if (json && json._error) toast("测试失败：" + json._error);
          else if (json && json._needKey) toast("AI 未配置");
          else if (json && json.title) toast("连接成功：" + json.title.slice(0, 18));
          else toast("返回异常，请检查模型/Key/后端");
        });
        break;
      }
      case "testBackend": {
        testBackendConnection();
        break;
      }
      case "uploadLogo": { const li = $("#logoInput"); if (li) li.click(); break; }
      case "delLogo": { state.brand.logo = ""; saveState(); rerenderBrand(); break; }
      case "addGear": {
        if (!state.draft) break;
        const gi = $("#gearAdd");
        const v = gi ? gi.value.trim() : "";
        if (!v) { toast("请输入装备名称"); break; }
        state.draft.gearManual = state.draft.gearManual || [];

        // 长文本自动识别解析：复制进去的大段装备建议，拆成多条并提取备注
        const isLongText = v.length > 20 || /装备建议|建议携带|必备装备|\d+[\.、]|可备/.test(v);
        if (isLongText) {
          const parsed = parseGearText(v);
          if (parsed.length) {
            let added = 0, dup = 0;
            parsed.forEach((it) => {
              const exists = (state.draft.gear || []).some((g) => (typeof g === "string" ? g : g.name) === it.name);
              if (exists) { dup++; return; }
              state.draft.gearManual.push(it.name);
              state.draft.gear.push({ name: it.name, must: it.must, note: it.note, manual: true });
              added++;
            });
            if (gi) gi.value = "";
            toast(`已识别 ${parsed.length} 项装备，新增 ${added} 项${dup ? "，跳过重复 " + dup + " 项" : ""}`);
            rerenderEditor(); break;
          }
        }

        const exists = (state.draft.gear || []).some((g) => (typeof g === "string" ? g : g.name) === v) || state.draft.gearManual.includes(v);
        if (exists) { toast("该装备已存在"); break; }
        state.draft.gearManual.push(v);
        state.draft.gear.push({ name: v, must: false, manual: true });
        toast("已添加装备"); rerenderEditor(); break;
      }
      case "searchPlacePhotos": {
        if (!state.draft) break;
        const place = state.draft.place || state.draft.meeting;
        if (!place) { toast("请先在「活动地点 / 集合地点」填写地点，才能搜索风景图"); break; }
        state.draft._searchingPlacePhotos = true;
        if (state.view === "editor") rerenderEditor();
        toast("正在联网搜索「" + place + "」风景图…");
        fetchPlacePhotos(place, (res) => {
          if (!state.draft) return;
          state.draft._searchingPlacePhotos = false;
          state.draft.placePhotos = res;
          if (!state.draft.whyGoPhoto && res.length) state.draft.whyGoPhoto = res[0].src;
          if (state.view === "editor") rerenderEditor();
          toast(res.length ? ("已找到 " + res.length + " 张「" + place + "」风景图，点选一张用于「为什么值得去」") : ("未搜索到「" + place + "」的公开风景图，可手动粘贴图片链接替换"));
        });
        break;
      }
      case "pickPlacePhoto": {
        if (!state.draft) break;
        const i = +d.id; const ph = state.draft.placePhotos || [];
        if (ph[i]) { state.draft.whyGoPhoto = ph[i].src; rerenderEditor(); }
        break;
      }
      case "rmPlacePhoto": {
        if (!state.draft) break;
        const i = +d.id; const ph = state.draft.placePhotos || [];
        if (ph[i]) {
          const removed = ph[i].src; ph.splice(i, 1);
          if (state.draft.whyGoPhoto === removed) state.draft.whyGoPhoto = ph[0] ? ph[0].src : "";
          rerenderEditor();
        }
        break;
      }
      case "setWhyGoPhotoUrl": {
        if (!state.draft) break;
        const inp = $("#whyGoPhotoUrl"); const url = inp ? inp.value.trim() : "";
        if (!/^https?:\/\//.test(url)) { toast("请输入有效的图片链接（以 http/https 开头）"); break; }
        state.draft.placePhotos = state.draft.placePhotos || [];
        if (!state.draft.placePhotos.some((p) => p.src === url)) state.draft.placePhotos.push({ src: url, title: "手动替换", author: "" });
        state.draft.whyGoPhoto = url; rerenderEditor();
        break;
      }
      case "clearWhyGoPhoto": {
        if (!state.draft) break;
        state.draft.whyGoPhoto = ""; rerenderEditor();
        break;
      }
      case "addSP": { if (!Array.isArray(state.draft.sellingPoints)) state.draft.sellingPoints = []; state.draft.sellingPoints.push({ title: "", desc: "" }); rerenderEditor(); break; }
      case "delSP": { const di = +d.id; if (Array.isArray(state.draft.sellingPoints) && state.draft.sellingPoints[di]) { state.draft.sellingPoints.splice(di, 1); rerenderEditor(); } break; }
      case "regenSP": {
        if (!state.draft) break;
        const spIdx = +d.id;
        if (!aiAuthMode()) { toast("请先在「AI 设置」配置后端地址或本地演示 Key 才能换卖点"); break; }
        if (aiBalance() < AI_COST_PER_CALL) { toast("AI 积分不足，请到「俱乐部中心 → AI 额度」充值或等每月刷新"); break; }
        const btn = el.closest ? el.closest(".mini-regen") : null;
        if (btn) { btn.disabled = true; btn.classList.add("loading"); const t = btn.innerHTML; btn.dataset.ht = t; btn.innerHTML = '<span class="spin">' + ICON("refresh") + "</span>生成中"; }
        toast("AI 正在重写卖点…");
        regenSellingPoint(state.draft, spIdx).then((r) => {
          if (r && r._needKey) toast("请先在「AI 设置」填写 Key");
          else if (r && r._noCredit) toast("AI 积分不足，请到「俱乐部中心 → AI 额度」充值或等每月刷新");
          else if (r === true) { toast("已更新卖点 · 消耗 " + AI_COST_PER_CALL + " AI 积分"); syncDerived(state.draft); }
          else toast("卖点生成失败，请重试");
          if (btn) { btn.disabled = false; btn.classList.remove("loading"); btn.innerHTML = btn.dataset.ht || t; }
          rerenderEditor(); refreshPreview();
        });
        break;
      }
      case "addCustomField": { if (!Array.isArray(state.draft.customFields)) state.draft.customFields = []; state.draft.customFields.push({ id: "cf" + Date.now(), label: "", type: "text", required: false, placeholder: "" }); rerenderEditor(); break; }
      case "delCustomField": { const ci = +d.id; if (Array.isArray(state.draft.customFields) && state.draft.customFields[ci]) { state.draft.customFields.splice(ci, 1); rerenderEditor(); } break; }
      case "delGear": {
        if (!state.draft) break;
        const name = d.name;
        state.draft.gear = (state.draft.gear || []).filter((g) => (typeof g === "string" ? g : g.name) !== name);
        state.draft.gearManual = (state.draft.gearManual || []).filter((x) => x !== name);
        rerenderEditor(); break;
      }
      case "autoRecommendGear": {
        if (!state.draft) break;
        const r = autoRecommendGear(state.draft);
        toast(`已智能推荐 ${r.added} 项装备（共 ${r.total} 项）· 已自动匹配商城同款`);
        rerenderEditor(); break;
      }
      case "delItinItem": {
        if (!state.draft) break;
        const day = state.draft.itineraryDays[d.day];
        if (day && day.items[d.idx]) { day.items.splice(d.idx, 1); rerenderEditor(); }
        break;
      }
      case "addItinItem": {
        if (!state.draft) break;
        const day = state.draft.itineraryDays[d.day];
        if (day) {
          const last = day.items[day.items.length - 1];
          const t = last ? addH(last.time, 1) : "08:00";
          day.items.push({ time: t, text: "" });
          rerenderEditor();
        }
        break;
      }
      case "addItinDay": {
        if (!state.draft) break;
        state.draft.days = Math.min((state.draft.days || 1) + 1, 7);
        syncItineraryDays(state.draft);
        rerenderEditor();
        break;
      }
      case "delItinDay": {
        if (!state.draft) break;
        state.draft.days = Math.max((state.draft.days || 1) - 1, 1);
        syncItineraryDays(state.draft);
        rerenderEditor();
        break;
      }
      case "regenItinerary": {
        if (!state.draft) break;
        if (!aiAuthMode()) { toast("请先在「AI 设置」配置后端地址或本地演示 Key 以重新生成"); break; }
        if (aiBalance() < AI_COST_PER_CALL) { toast("AI 积分不足，请到「俱乐部中心 → AI 额度」充值或等每月刷新"); break; }
        toast("AI 正在生成行程…");
        generateItinerary(state.draft).then((res) => {
          if (res === true) toast("已生成行程");
          else if (res && res._noCredit) toast("AI 积分不足，请到「俱乐部中心 → AI 额度」充值");
          else if (res && res._needKey) toast("请先在「AI 设置」配置后端地址或本地演示 Key");
          else toast("行程生成失败，请重试");
          rerenderEditor();
        });
        break;
      }
      case "pickColor": { state.brand.primary = d.c; updateBrandColor(); $("input[data-brand=primary]").value = d.c; toast("已应用主色"); break; }
      case "openSignup": showView("signup", { id: d.id }); break;
      case "submitSignup": submitSignup(d.id); break;
      case "filterSignups": { signupFilterActivityId = d.id || null; showView("signups"); break; }
      case "markPaid": { const s = state.signups.find((x) => x.id === d.id); if (s) { s.paid = true; saveState(); toast("已标记为已付款"); showView("signups"); } break; }
      case "cancelSignup": { state.signups = state.signups.filter((x) => x.id !== d.id); saveState(); toast("已取消报名"); showView("signups"); break; }
      case "exportSignups": exportSignups(d.id); break;
      case "notifySignups": openNotify(d.id); break;
      case "copyPhones": { const n = state._notify; if (n) copyText(n.phones); break; }
      case "copyNotify": { const n = state._notify; const t = $("#notifyText") ? $("#notifyText").value : (n ? notifyDefault(getActivity(n.activityId) || {}) : ""); copyText(t); break; }
      case "closeNotify": { const mm = document.querySelector(".modal-mask"); if (mm) mm.remove(); delete state._notify; break; }
      case "export": toast("报名名单已就绪，可导出为 Excel"); break;
      case "openApplyClub": openApplyClub(); break;
      case "submitApplyClub": {
        const g = (id) => { const el = $("#" + id); return el ? el.value.trim() : ""; };
        const info = {
          name: g("applyName"), contact: g("applyContact"), phone: g("applyPhone"),
          city: g("applyCity"), activityType: g("applyType"), bio: g("applyBio"),
        };
        if (!info.name) return toast("请填写机构名称");
        if (!/^1\d{10}$/.test(info.phone)) return toast("请填写正确的 11 位手机号");
        state.clubInfo = info;
        state.clubStatus = "pending";
        saveState();
        const m = document.querySelector(".modal-mask"); if (m) m.remove();
        toast("入驻申请已提交，等待平台审核");
        showView("membershipAdmin"); window.scrollTo(0, 0);
        break;
      }
      case "simulateApproveClub": {
        state.clubStatus = "approved";
        saveState();
        const m = document.querySelector(".modal-mask"); if (m) m.remove();
        toast("平台已审核通过，俱乐部版全部功能已开通");
        showView("membershipAdmin"); window.scrollTo(0, 0);
        break;
      }
      case "membership": showView("membershipAdmin"); window.scrollTo(0, 0); break;
      case "memberCenter": showView("memberCenter"); window.scrollTo(0, 0); break;
      case "memberUpgrade": openMemberUpgrade(); break;
      case "memberMarketing": showView("memberMarketing"); window.scrollTo(0, 0); break;
      case "mmTab": { state.mmTab = d.tab; showView("memberMarketing"); break; }
      case "mmNewCoupon": {
        const title = window.prompt("优惠券名称（如：新人满 200 减 50）") || "";
        if (!title.trim()) break;
        const type = window.confirm("确认框点「确定」= 折扣券（如 9 折），点「取消」= 满减券") ? "discount" : "reduce";
        const value = parseFloat(window.prompt(type === "discount" ? "折扣值（如 9 表示 9 折）" : "减免金额（元）") || "0");
        const threshold = type === "reduce" ? parseFloat(window.prompt("使用门槛（满多少元，0 为无门槛）") || "0") : 0;
        const total = parseInt(window.prompt("发放总量") || "200", 10);
        (state.coupons = state.coupons || []).push({ id: uid(), title: title.trim(), type, threshold, value, scope: "all", total, claimed: 0, used: 0, status: "active", createdAt: Date.now() });
        saveState(); toast("已新建优惠券（Demo）"); showView("memberMarketing"); break;
      }
      case "mmToggleCoupon": { const c = (state.coupons || []).find((x) => x.id === d.id); if (c) { c.status = c.status === "active" ? "paused" : "active"; saveState(); toast(c.status === "active" ? "已启用" : "已暂停"); showView("memberMarketing"); } break; }
      case "mmToggleMemberOnly": { const a = getActivity(d.id); if (a) { a.memberOnly = !a.memberOnly; saveState(); toast(a.memberOnly ? "已设为会员专享" : "已取消会员专享"); showView("memberMarketing"); } break; }
      case "mmToggleReferral": { if (!state.referral) state.referral = { enabled: false, inviterPoints: 200, inviteePoints: 100, totalInvites: 0, successInvites: 0 }; state.referral.enabled = !state.referral.enabled; saveState(); toast(state.referral.enabled ? "邀请裂变已开启" : "邀请裂变已关闭"); showView("memberMarketing"); break; }
      case "openAiCredit": { openAiCredit(); break; }
      case "aiRecharge": {
        const pkg = AI_RECHARGE_PKGS.find((x) => x.id === d.id);
        if (!pkg) break;
        rechargeAi(pkg.id);
        const m = document.querySelector(".modal-mask"); if (m) m.remove();
        toast(`已充值 ${pkg.label} · +${pkg.amount.toLocaleString()} AI 积分（模拟支付，永久有效）`);
        openAiCredit();
        break;
      }
      // 总平台已独立为 clubos-platform 工程（/platform/），此处不再需要平台入口跳转
      case "platformApproveClub": { const pc = (state.platformClubs || []).find((x) => x.id === d.id); if (pc) { pc.status = "approved"; pc.mallEnabled = true; saveState(); toast("已通过入驻审核，已开通商城权限与基础 Token 额度（Demo）"); } showView("platformAudit"); break; }
      case "platformRejectClub": { const pc = (state.platformClubs || []).find((x) => x.id === d.id); if (pc) { pc.status = "rejected"; pc.mallEnabled = false; saveState(); toast("已拒绝入驻申请（Demo）"); } showView("platformAudit"); break; }
      case "platformClubDetail": { state.platformClubDetailId = d.id; showView("platformClubs"); break; }
      case "platformClubBack": { state.platformClubDetailId = null; showView("platformClubs"); break; }
      case "platformTokenFocus": { state.platformClubDetailId = null; showView("platformToken"); break; }
      case "platformTogglePerm": { const pc = (state.platformClubs || []).find((x) => x.id === d.id); if (pc) { pc.permissions[d.perm] = !pc.permissions[d.perm]; saveState(); toast((pc.permissions[d.perm] ? "已开通" : "已关闭") + "：" + ((PLATFORM_PERMS.find((p) => p.key === d.perm)) || {}).label); } showView("platformClubs"); break; }
      case "platformToggleMall": { const pc = (state.platformClubs || []).find((x) => x.id === d.id); if (pc) { pc.mallEnabled = !pc.mallEnabled; saveState(); toast(pc.mallEnabled ? "已开通该俱乐部商城权限" : "已关闭该俱乐部商城权限"); } showView("platformClubs"); break; }
      case "platformTokenAdd": { const pc = (state.platformClubs || []).find((x) => x.id === d.id); if (pc) { const amt = +d.amt; if (amt === -1) { pc.aiCredit.gift = 0; if (pc.id === "club_demo") state.aiCredit.gift = 0; } else { pc.aiCredit[d.kind] = (pc.aiCredit[d.kind] || 0) + amt; if (pc.id === "club_demo") { state.aiCredit[d.kind] = (state.aiCredit[d.kind] || 0) + amt; } } saveState(); toast("已调整 " + pc.name + " 的 Token 额度"); } showView(state.view === "platformClubs" ? "platformClubs" : "platformToken"); break; }
      case "platformTokenBatch": { const amt = parseInt(((document.getElementById("platformTokenBatch") || {}).value || "0"), 10); if (amt > 0) { (state.platformClubs || []).filter((c) => c.status === "approved").forEach((c) => { c.aiCredit.base = (c.aiCredit.base || 0) + amt; if (c.id === "club_demo") state.aiCredit.base = (state.aiCredit.base || 0) + amt; }); saveState(); toast("已为全部已开通俱乐部补充基础额度 " + amt); } else toast("请输入有效额度"); showView("platformToken"); break; }
      case "platformMallTab": { state.platformMallTab = d.tab; showView("platformMall"); break; }
      case "platformSyncSupplier": { const sp = (state.suppliers || []).find((x) => x.id === d.id); if (sp) { sp.syncStatus = "synced"; sp.lastSync = Date.now(); saveState(); toast("已同步 " + sp.name + " 的商品与库存（Demo）"); } showView("platformMall"); break; }
      case "platformPauseSupplier": { const sp = (state.suppliers || []).find((x) => x.id === d.id); if (sp) { sp.syncStatus = "paused"; saveState(); toast("已暂停对接 " + sp.name); } showView("platformMall"); break; }
      case "platformShipOrder": { const o = (state.mallOrders || []).find((x) => x.id === d.id); if (o) { o.logistics = "shipped"; o.trackingNo = "SF" + String(Date.now()).slice(-10); saveState(); toast("已发货，运单 " + o.trackingNo); } showView("platformMall"); break; }
      case "platformSignOrder": { const o = (state.mallOrders || []).find((x) => x.id === d.id); if (o) { o.logistics = "signed"; saveState(); toast("已签收"); } showView("platformMall"); break; }
      case "openMall": { state.mallView = "browse"; state.mallCtx = "store"; showView("mall"); window.scrollTo(0, 0); break; }
      case "mallConsole": { state.mallView = "browse"; state.mallCtx = "console"; showView("mallConsole"); window.scrollTo(0, 0); break; }
      case "mallAdmin": { state.mallView = "admin"; state.mallCtx = "admin"; state.mallEditId = null; showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin"); break; }
      case "mallBack": {
        state.mallView = "browse"; state.mallEditId = null;
        // 按进入商城时的视角回跳，避免俱乐部后台点返回掉进 C 端门店
        if (mallCtx() === "console") showView("mallConsole");
        else if (mallCtx() === "admin") showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin");
        else showView("mall");
        window.scrollTo(0, 0); break;
      }
      case "mallProduct": {
        if (d.srctype) state._mallSource = { type: d.srctype, id: d.srcid || "" };
        showView("mallProduct", { id: d.id }); window.scrollTo(0, 0); break;
      }
      case "mallRecEdit": { state.mallCtx = "console"; showView("mallConsole"); toast("在商品库点「上架」即可加入推荐货架"); break; }
      case "mallToggleRec": {
        const id = d.id; const i = state.myRecs.indexOf(id);
        if (i >= 0) state.myRecs.splice(i, 1); else state.myRecs.unshift(id);
        saveState();
        toast(i >= 0 ? "已取消主推" : "已设为主推");
        // data-stay=1 表示在收益台列表内就地切换，不跳详情页
        if (d.stay) showView("mallConsole"); else showView("mallProduct", { id });
        break;
      }
      case "mallBuy": {
        const p = getProduct(d.id); if (!p) break;
        const clubId = (state.brand && state.brand.id) || "club_demo";
        const commission = commissionOf(p, p.retailPrice);
        const src = state._mallSource || null;
        const sourceType = d.sourceType || (src && src.type) || "club_shop";
        const sourceId = d.sourceId || (src && src.id) || "";
        const order = { id: uid(), clubId, userId: "u_demo", sourceType, sourceId, referrerClubId: "", items: [{ productId: p.id, title: p.title, price: p.retailPrice, qty: 1 }], amount: p.retailPrice, commission, commissionStatus: "pending", logistics: "pending", refunded: false, status: "paid", createdAt: Date.now() };
        state.mallOrders.unshift(order);
        state.mallSalesMonth = (state.mallSalesMonth || 0) + p.retailPrice;
        const granted = checkAiMilestones();
        if (sourceType === "ai_gear_list") { state.aiGearOrders = (state.aiGearOrders || 0) + 1; toast("模拟下单成功（Demo）· 来自活动装备清单推荐，已归因 ai_gear_list" + (granted ? ` · 商城里程碑 +${granted} AI 积分` : "")); }
        else { toast("模拟下单成功（Demo）· 订单已归因本俱乐部，佣金进入「待确认」" + (granted ? ` · 商城里程碑 +${granted} AI 积分` : "")); }
        saveState();
        showView("mall"); break;
      }
      case "mallNew": { state.mallEditId = "__new__"; showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin"); break; }
      case "mallEdit": { state.mallEditId = d.id; showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin"); break; }
      case "mallSave": {
        const id = d.id;
        const title = $("#mpTitle").value.trim();
        const retailPrice = +($("#mpPrice").value || 0);
        const supplyPrice = +($("#mpSupply").value || 0);
        const commissionMode = $("#mpMode").value;
        const commissionValue = +($("#mpValue").value || 0);
        const riskLevel = $("#mpRisk").value;
        if (id === "__new__") {
          state.mallProducts.unshift({ id: "p_" + Date.now(), title, subtitle: "", cover: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80", category: "其他", riskLevel, fulfillmentMode: "cloud_warehouse", commissionMode, commissionValue, retailPrice, supplyPrice, stock: 100, supplierId: "sup_yun", tags: [], rating: 4.5 });
        } else {
          const p = getProduct(id); if (p) { p.title = title; p.retailPrice = retailPrice; p.supplyPrice = supplyPrice; p.commissionMode = commissionMode; p.commissionValue = commissionValue; p.riskLevel = riskLevel; }
        }
        state.mallEditId = null; saveState(); toast("已保存商品"); showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin"); break;
      }
      case "mallDel": {
        state.mallProducts = (state.mallProducts || []).filter((p) => p.id !== d.id);
        state.myRecs = (state.myRecs || []).filter((id) => id !== d.id);
        saveState(); toast("已删除商品"); showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin"); break;
      }
      /* P2 佣金状态机：pending → frozen → available → settled / reversed */
      case "openMallCommission": { state.mallView = "commission"; state.mallConsoleTab = "commission"; showView("mallConsole"); break; }
      case "mallConfirmReceive": {
        const o = (state.mallOrders || []).find((x) => x.id === d.id);
        if (o && o.commissionStatus === "pending") { o.commissionStatus = "frozen"; saveState(); toast("已确认收货，佣金进入「冻结(售后期)」"); }
        refreshMallContext(); break;
      }
      case "mallRelease": {
        const o = (state.mallOrders || []).find((x) => x.id === d.id);
        if (o && o.commissionStatus === "frozen") { o.commissionStatus = "available"; saveState(); toast("售后期结束，佣金「可结算」"); }
        refreshMallContext(); break;
      }
      case "mallSettle": {
        const o = (state.mallOrders || []).find((x) => x.id === d.id);
        if (o && o.commissionStatus === "available") { o.commissionStatus = "settled"; o.settledAt = Date.now(); saveState(); toast("已结算到俱乐部账户"); }
        refreshMallContext(); break;
      }
      case "mallSettleAll": {
        let n = 0;
        (state.mallOrders || []).forEach((o) => { if (o.commissionStatus === "available") { o.commissionStatus = "settled"; o.settledAt = Date.now(); n++; } });
        saveState(); toast(n ? `已批量结算 ${n} 笔佣金到俱乐部` : "没有可结算的佣金");
        if (state.mallView === "admin") showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin"); else if (isPlatformView(state.view)) showView("platformMall"); else { state.mallConsoleTab = "commission"; showView("mallConsole"); } break;
      }
      case "mallRefund": {
        const o = (state.mallOrders || []).find((x) => x.id === d.id);
        if (o && o.commissionStatus !== "settled" && o.commissionStatus !== "reversed") {
          const prev = o.commissionStatus;
          o.commissionStatus = "reversed"; o.refunded = true; saveState();
          toast(`订单退款，佣金由「${COMM_STATUS_LABEL[prev]}」冲销归零`);
        }
        refreshMallContext(); break;
      }
      case "mallConsoleTab": { state.mallConsoleTab = d.tab || "products"; showView("mallConsole"); break; }
      case "commissionSubTab": { state.commissionSubTab = d.tab || "apply"; showView("mallConsole"); break; }
      case "mallApplySettlement": {
        const checkboxes = document.querySelectorAll(".settle-cb:checked");
        const ids = Array.from(checkboxes).map((cb) => cb.dataset.id).filter(Boolean);
        if (!ids.length) { toast("请至少勾选一笔可结算佣金"); break; }
        const method = $("#settleMethod").value || "company";
        const companyName = $("#settleCompany").value.trim();
        const taxNo = $("#settleTax").value.trim();
        const bank = $("#settleBank").value.trim();
        const accountNo = $("#settleAccount").value.trim();
        const cardName = $("#settleCardName").value.trim();
        const cardBank = $("#settleCardBank").value.trim();
        const cardNo = $("#settleCardNo").value.trim();
        const idCard = $("#settleIdCard").value.trim();
        if (method === "company" && (!companyName || !accountNo)) { toast("请填写公司名称与对公账号"); break; }
        if (method === "card" && (!cardName || !cardNo)) { toast("请填写法人姓名与银行卡号"); break; }
        let amount = 0; let n = 0;
        ids.forEach((id) => {
          const o = (state.mallOrders || []).find((x) => x.id === id);
          if (o && o.commissionStatus === "available") { o.commissionStatus = "settled"; o.settledAt = Date.now(); amount += orderCommission(o); n++; }
        });
        state.settlementProfile = { method, companyName, taxNo, bank, accountNo, cardName, cardBank, cardNo, idCard };
        state.commissionSettlements = state.commissionSettlements || [];
        state.commissionSettlements.unshift({ id: uid(), clubId: currentClubId(), amount: Math.round(amount), method, companyName, taxNo, bank, accountNo, cardName, cardBank, cardNo, idCard, status: "pending", requestedAt: Date.now() });
        saveState();
        toast(n ? `已申请结算 ${n} 笔佣金，共 ¥${Math.round(amount)}` : "没有可结算的佣金");
        showView("mallConsole"); break;
      }
      case "saveAiKey": {
        const inp = $("#aiKeyInput");
        const v = inp ? inp.value.trim() : "";
        if (!v) return toast("请输入 AI Key");
        setAIKey(v); toast("AI Key 已保存（仅存本机）"); break;
      }
      case "testAiProxy": {
        const call = await apiCall("/api/pay/membership/ai-proxy", { method: "POST", body: { prompt: "用一句话介绍本周末的徒步活动" } });
        if (call.ok && call.data && call.data.data && call.data.data.content) toast("AI 全包：" + call.data.data.content.slice(0, 40) + "…");
        else toast("AI 全包（Demo：真实环境自动走平台 Key，按 AI 额度计量）");
        break;
      }
      case "goCreate": showView("create"); break;
      case "toast": toast(d.msg || "已完成"); break;
      case "copyText": {
        if (d.text != null) {
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(d.text).then(() => toast("已复制")).catch(() => toast("复制失败，请手动选择"));
          else toast("已生成文案");
        } else copyText(d.id, d.type);
        break;
      }
      case "opGen": {
        const a = getActivity(d.id); if (!a) break;
        const channels = (d.channels || "wechat,moments").split(",").filter(Boolean);
        toast("AI 正在生成运营文案");
        generateOpCopies(a, channels).then(() => { showView(state.view, state.params || {}); window.scrollTo(0, 0); });
        break;
      }
      case "opCopyRegenerate": {
        const a = getActivity(d.aid); if (!a) break;
        toast("AI 正在重写该渠道文案");
        regenerateOpCopyChannel(a, d.channel).then(() => { showView(state.view, state.params || {}); });
        break;
      }
      case "opCopyPrevBatch": {
        switchOpCopyBatch(d.aid, -1);
        showView(state.view, state.params || {});
        break;
      }
      case "opCopyNextBatch": {
        if (d.dir === "1") {
          switchOpCopyBatch(d.aid, 1);
          showView(state.view, state.params || {});
        } else {
          const a = getActivity(d.aid); if (!a) break;
          const channels = Object.keys((state._opCopies && state._opCopies[d.aid]) || {});
          if (!channels.length) channels.push("wechat", "moments");
          toast("AI 正在生成新一批文案");
          generateOpCopies(a, channels).then(() => { showView(state.view, state.params || {}); });
        }
        break;
      }
      case "recallGen": {
        toast("AI 正在生成召回文案…");
        generateRecallCopy(d.seg).then((text) => { state._recall = { seg: d.seg, text }; saveState(); showView(state.view, state.params || {}); window.scrollTo(0, 0); });
        break;
      }
      case "customerTab": { state.customerTab = d.tab; saveState(); showView("customers"); break; }
      case "customerQuery": {
        state.customerSearch = $("#customerSearch") ? $("#customerSearch").value : "";
        state.customerMemberFilter = $("#customerMemberFilter") ? $("#customerMemberFilter").value : "all";
        state.customerPhoneFilter = $("#customerPhoneFilter") ? $("#customerPhoneFilter").value : "all";
        state.customerStartDate = $("#customerStartDate") ? $("#customerStartDate").value : "";
        state.customerEndDate = $("#customerEndDate") ? $("#customerEndDate").value : "";
        saveState(); showView("customers"); toast("已筛选"); break;
      }
      case "customerSelect": {
        if (el.checked) _clubosCustSel.add(d.id); else _clubosCustSel.delete(d.id);
        syncCustSelUI();
        break;
      }
      case "customerSelectAll": {
        const on = el.checked;
        document.querySelectorAll('[data-action="customerSelect"]').forEach((cb) => { cb.checked = on; if (on) _clubosCustSel.add(cb.dataset.id); else _clubosCustSel.delete(cb.dataset.id); });
        syncCustSelUI();
        break;
      }
      case "customerExport": {
        const ids = [..._clubosCustSel];
        const all = deriveCustomers();
        const rows = ids.length ? all.filter((c) => ids.includes(c.id)) : all;
        toast("已生成客户 CSV（演示），共 " + rows.length + " 条" + (ids.length ? "（选中 " + ids.length + " 位）" : "（全部）"));
        break;
      }
      case "customerExportRecord": { toast("导出记录功能即将开放"); break; }
      case "customerToggleBanned": {
        const cid = d.id; const all = deriveCustomers(); const c = all.find((x) => x.id === cid);
        if (c) { c.banned = !c.banned; toast(c.banned ? "已禁止登录" : "已恢复登录"); saveState(); showView("customers"); }
        break;
      }
      case "customerOrders": { toast("历史订单弹窗：客户 " + d.id); break; }
      case "customerDist": { toast("分销关系：客户 " + d.id); break; }
      case "customerMore": { toast("更多操作：客户 " + d.id); break; }
      case "customerBindPhone": { toast("请进入客户详情绑定手机号"); break; }
      case "customerSetBirth": { toast("请进入客户详情修改生日"); break; }
      case "saveSettingsBrand": {
        const map = { name: "name", logoText: "logoText", slogan: "slogan", style: "style", intro: "intro", wechat: "wechat", phone: "phone", address: "address", primary: "primary" };
        Object.keys(map).forEach((k) => { const el = document.querySelector(`[data-brand="${k}"]`); if (el) state.brand[k] = el.value; });
        updateBrandColor(); saveState(); toast("机构与品牌已保存"); break;
      }
      case "uploadLogo": {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = "image/*";
        inp.addEventListener("change", (e) => {
          const f = e.target.files[0]; if (!f) return;
          const r = new FileReader();
          r.onload = (ev) => { state.brand.logo = ev.target.result; state.brand.logoText = state.brand.logoText || "C"; saveState(); showView("settings"); };
          r.readAsDataURL(f);
        });
        inp.click();
        break;
      }
      case "delLogo": { state.brand.logo = ""; saveState(); showView("settings"); break; }
      case "regenShareCopy": {
        const a = getActivity(d.id); if (!a) break;
        if (!aiAuthMode()) { toast("请先在「AI 设置」配置后端地址或本地演示 Key 才能换文案"); break; }
        const t = d.type, key = "share" + t.charAt(0).toUpperCase() + t.slice(1);
        const card = document.querySelector(`.share-block[data-share-type="${t}"] .share-card`);
        if (card) card.textContent = "生成中…";
        toast("AI 正在重写该渠道文案…");
        regenShareCopy(a, t).then((r) => {
          if (r && r._needKey) { toast("请先在「AI 设置」填写 Key"); return; }
          if (r) {
            toast("已换一版" + t + "文案");
            const card2 = document.querySelector(`.share-block[data-share-type="${t}"] .share-card`);
            if (card2) card2.textContent = a[key] || "";
          } else {
            toast("文案生成失败，请检查 Key 或重试");
            const card2 = document.querySelector(`.share-block[data-share-type="${t}"] .share-card`);
            if (card2) card2.textContent = a[key] || "";
          }
        });
        break;
      }
      case "editShareCopy": {
        const a = getActivity(d.id); if (!a) break;
        const t = d.type, key = "share" + t.charAt(0).toUpperCase() + t.slice(1);
        const block = document.querySelector(`.share-block[data-share-type="${t}"]`);
        if (!block) break;
        const oldCard = block.querySelector(".share-card");
        if (!oldCard) break;
        const val = a[key] || "";
        const editWrap = document.createElement("div");
        editWrap.className = "share-card share-card-edit";
        editWrap.innerHTML = `<textarea class="textarea share-edit-textarea" rows="6">${esc(val)}</textarea><div class="share-edit-actions"><button class="btn btn-primary btn-sm" data-action="saveShareCopy" data-id="${a.id}" data-type="${t}">保存</button><button class="btn btn-ghost btn-sm" data-action="cancelShareCopy" data-type="${t}">取消</button></div>`;
        oldCard.replaceWith(editWrap);
        break;
      }
      case "saveShareCopy": {
        const a = getActivity(d.id); if (!a) break;
        const t = d.type, key = "share" + t.charAt(0).toUpperCase() + t.slice(1);
        const block = document.querySelector(`.share-block[data-share-type="${t}"]`);
        if (!block) break;
        const ta = block.querySelector(".share-edit-textarea");
        const val = ta ? ta.value : "";
        a[key] = val;
        saveState();
        const newCard = document.createElement("div");
        newCard.className = "share-card";
        newCard.setAttribute("data-share-card", t);
        newCard.textContent = val;
        const editWrap = block.querySelector(".share-card-edit");
        if (editWrap) editWrap.replaceWith(newCard);
        toast("已保存" + t + "文案");
        break;
      }
      case "cancelShareCopy": {
        const a = getActivity(d.id); if (!a) break;
        const t = d.type, key = "share" + t.charAt(0).toUpperCase() + t.slice(1);
        const block = document.querySelector(`.share-block[data-share-type="${t}"]`);
        if (!block) break;
        const val = a[key] || "";
        const newCard = document.createElement("div");
        newCard.className = "share-card";
        newCard.setAttribute("data-share-card", t);
        newCard.textContent = val;
        const editWrap = block.querySelector(".share-card-edit");
        if (editWrap) editWrap.replaceWith(newCard);
        break;
      }
      case "closeModal": { const m = document.querySelector(".modal-mask"); if (m) m.remove(); break; }
      case "contactOrg": { const b = state.brand; toast("客服微信：" + b.wechat + " · 电话：" + b.phone); break; }
      case "switchTab": { state.editorTab = d.tab; rerenderEditor(); if (state.draft && (state.draft.photos || []).length) state.draft.photos.forEach((s) => scheduleSmartFocus(s)); break; }
      case "confirmInfer": { if (state.draft) { confirmFact(state.draft, d.key); rerenderEditor(); } break; }
      case "confirmAllInferred": { if (state.draft) { inferredFacts(state.draft).forEach((f) => confirmFact(state.draft, f.key)); rerenderEditor(); toast("已确认全部推断事实"); } break; }
      case "focusField": { if (state.draft) { state.editorTab = "content"; state.draft._focusField = d.key; rerenderEditor(); setTimeout(() => { const el = document.querySelector(`[data-bind="${d.key}"]`); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.focus(); } }, 50); } break; }
      case "setCover": { if (state.draft) { state.draft.coverIndex = +d.i; state.draft._coverManual = true; rerenderEditor(); } break; }
      case "copyDraft": { const t = d.type; const key = "share" + t.charAt(0).toUpperCase() + t.slice(1); const txt = (state.draft && state.draft[key]) || ""; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast("已复制" + t + "文案"), () => toast("复制失败")); else toast("当前环境不支持复制"); break; }
      case "mySignups": showView("mySignups"); window.scrollTo(0, 0); break;
      case "myOrders": showView("myOrders"); window.scrollTo(0, 0); break;
      case "saveLeader": {
        if (!state.draft) break;
        if (saveLeaderFromDraft(state.draft)) { toast("已保存到领队资料库"); rerenderEditor(); }
        else toast("请先填写领队姓名");
        break;
      }
      case "newLeader": {
        if (!state.draft) break;
        clearLeaderDraft(state.draft);
        rerenderEditor();
        break;
      }
      case "toggleLeader": {
        if (!state.draft || !d.id) break;
        toggleLeader(state.draft, d.id);
        rerenderEditor();
        break;
      }
      case "editLeader": {
        if (!state.draft || !d.id) break;
        const el = findLeaderById(d.id);
        if (el) { loadLeaderIntoDraft(state.draft, d.id); rerenderEditor(); }
        break;
      }
      case "removeLeaderFromActivity": {
        if (!state.draft || !d.id) break;
        removeLeaderFromActivity(state.draft, d.id);
        rerenderEditor();
        break;
      }
      case "uploadLeaderAvatar": {
        if (!state.draft) break;
        let inp = $("#leaderAvatarInput");
        if (!inp) {
          inp = document.createElement("input");
          inp.type = "file"; inp.id = "leaderAvatarInput"; inp.accept = "image/*"; inp.style.display = "none";
          document.body.appendChild(inp);
        }
        if (!inp._bound) {
          inp._bound = true;
          inp.addEventListener("change", (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = (ev) => { openAvatarCropper(ev.target.result); };
            r.readAsDataURL(f);
            e.target.value = "";
          });
        }
        inp.click();
        break;
      }
      case "delLeaderAvatar": {
        if (!state.draft) break;
        state.draft._leaderAvatarDraft = "";
        rerenderEditor();
        break;
      }
      case "confirmAvatarCrop": {
        confirmAvatarCrop();
        break;
      }
      case "cancelAvatarCrop": {
        closeAvatarCropper();
        break;
      }
      case "autoCenterAvatar": {
        autoCenterAvatarCrop();
        break;
      }
      case "addDeparture": {
        if (!state.draft) break;
        const startInput = $("#depStartDate");
        const endInput = $("#depEndDate");
        const priceInput = $("#depPriceInput");
        const startYmd = startInput ? startInput.value : "";
        const endYmd = endInput ? endInput.value : "";
        if (!startYmd) { toast("请先选择开始日期"); break; }
        state.draft.departures = state.draft.departures || [];
        const existingDates = new Set((state.draft.departures || []).map((x) => x.date));
        const basePrice = priceInput && priceInput.value ? +priceInput.value : state.draft.price;
        let added = 0;
        const end = endYmd && endYmd >= startYmd ? endYmd : startYmd;
        const startDate = new Date(startYmd + "T00:00:00");
        const endDate = new Date(end + "T00:00:00");
        for (let cur = new Date(startDate); cur <= endDate; cur.setDate(cur.getDate() + 1)) {
          const ymd = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
          if (existingDates.has(ymd)) continue;
          const dep = departureFromDate(ymd, basePrice);
          if (dep) { state.draft.departures.push(dep); existingDates.add(ymd); added++; }
        }
        if (added) {
          state.draft.departures.sort((x, y) => x.date.localeCompare(y.date));
          syncDepartures(state.draft);
          saveState();
          toast(`已添加 ${added} 个团期`);
        } else {
          toast("所选日期已存在，未添加新团期");
        }
        rerenderEditor();
        break;
      }
      case "deleteDeparture": {
        if (!state.draft || !d.id) break;
        state.draft.departures = (state.draft.departures || []).filter((x) => x.id !== d.id);
        syncDepartures(state.draft);
        saveState();
        rerenderEditor();
        break;
      }
      case "deleteLeader": {
        if (!d.id) break;
        if (window.confirm("确定从资料库删除该领队？该操作会同步从各活动中移除。")) {
          deleteLeaderFromLibrary(d.id);
          rerenderEditor();
        }
        break;
      }
      /* ---------- 首页装修器（v90） ---------- */
      case "pickTemplate": {
        const id = d.id;
        if (id === "blank") state.homeLayout = { enabled: true, template: "blank", components: [] };
        else state.homeLayout = { enabled: true, template: id, components: homeComponentsForTemplate(id) };
        saveState(); showView("decorate"); toast("已应用模版：" + (HOME_TEMPLATE_CARDS.find((t) => t.id === id) || {}).name); break;
      }
      case "addComponent": {
        if (!state.homeLayout) state.homeLayout = JSON.parse(JSON.stringify(DEFAULT_HOME_LAYOUT));
        const comp = defaultComponent(d.type);
        state.homeLayout.components = state.homeLayout.components || [];
        state.homeLayout.components.push(comp);
        saveState(); showView("decorate"); break;
      }
      case "moveComp": {
        const i = +d.idx, dir = d.dir, arr = state.homeLayout.components || [];
        const j = dir === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= arr.length) break;
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
        saveState(); showView("decorate"); break;
      }
      case "toggleCompHidden": {
        const i = +d.idx, arr = state.homeLayout.components || [];
        if (arr[i]) { arr[i].hidden = !arr[i].hidden; saveState(); showView("decorate"); }
        break;
      }
      case "delComp": {
        const i = +d.idx, arr = state.homeLayout.components || [];
        if (arr[i] && window.confirm("确定删除该组件？")) { arr.splice(i, 1); saveState(); showView("decorate"); }
        break;
      }
      case "addEntryItem": {
        const i = +d.i, arr = state.homeLayout.components || [];
        if (arr[i]) { arr[i].config = arr[i].config || {}; arr[i].config.items = arr[i].config.items || []; arr[i].config.items.push({ icon: "mountain", label: "新入口" }); saveState(); showView("decorate"); }
        break;
      }
      case "delEntryItem": {
        const i = +d.i, j = +d.j, arr = state.homeLayout.components || [];
        if (arr[i] && arr[i].config && arr[i].config.items) { arr[i].config.items.splice(j, 1); saveState(); showView("decorate"); }
        break;
      }
      /* ---------- 会员管理后台（v92） ---------- */
      case "membershipAdminTab": { state.membershipAdminTab = d.tab; showView("membershipAdmin"); break; }
      case "saveMembershipBasic": {
        const cfg = state.membershipSettings;
        const getRadio = (name) => { const el = document.querySelector(`input[name="${name}"]:checked`); return el ? el.value : cfg[name]; };
        cfg.activationMode = getRadio("activationMode");
        cfg.requireProfile = getRadio("requireProfile") === "yes";
        cfg.stores = getRadio("stores");
        const sel = document.querySelector('[data-action="membershipBasicSelect"][data-field="conditionMatch"]');
        if (sel) cfg.conditionMatch = sel.value;
        saveState(); toast("会员基础设置已保存"); showView("membershipAdmin"); break;
      }
      case "membershipCondToggle": {
        const cfg = state.membershipSettings;
        const c = cfg.conditions[d.key]; if (c) { c.enabled = el.checked; }
        break;
      }
      case "membershipTierSelect": { state._membershipTierEdit = d.id; showView("membershipAdmin"); break; }
      case "membershipTierDelete": {
        const tiers = state.memberTiers || [];
        if (tiers.length <= 1) { toast("至少保留一个会员等级"); break; }
        if (window.confirm("确定删除该会员等级？")) {
          state.memberTiers = tiers.filter((t) => t.id !== d.id);
          state._membershipTierEdit = (state.memberTiers[0] || {}).id;
          saveState(); showView("membershipAdmin");
        }
        break;
      }
      case "membershipTierAdd": {
        const tiers = state.memberTiers || [];
        const n = tiers.length + 1;
        const base = JSON.parse(JSON.stringify(DEFAULT_MEMBER_TIERS[Math.min(n - 1, DEFAULT_MEMBER_TIERS.length - 1)]));
        base.id = "t_" + uid(); base.name = "TOPV" + n; base.minPoints = tiers.length ? (tiers[tiers.length - 1].minPoints || 0) + 500 : 0;
        state.memberTiers.push(base);
        state._membershipTierEdit = base.id;
        saveState(); showView("membershipAdmin");
        break;
      }
      case "saveMembershipTiers": { saveState(); toast("会员等级设置已保存"); showView("membershipAdmin"); break; }
      case "membershipTierInput": {
        const tiers = state.memberTiers || []; const t = tiers.find((x) => x.id === d.id); if (!t) break;
        const val = el.value;
        if (d.field === "discount") t.discount = Math.max(0, Math.min(100, +val || 0));
        else if (d.field === "growthSpend") t.growthSpend = +val || 0;
        else if (d.field === "growthRecharge") t.growthRecharge = +val || 0;
        else if (d.field === "downgradeDays") t.downgradeDays = +val || 0;
        else if (d.field === "pointsRate") t.pointsRate = +val || 0;
        else if (d.field === "autoGrantPoints") { t.autoGrant = t.autoGrant || { enabled: false, points: 10, coupons: [] }; t.autoGrant.points = +val || 0; }
        else if (d.field === "name") t.name = val;
        else if (d.field === "description") t.description = val;
        break;
      }
      case "membershipTierToggle": {
        const tiers = state.memberTiers || []; const t = tiers.find((x) => x.id === d.id); if (!t) break;
        if (d.field === "downgradeSms") t.downgradeSms = el.checked;
        else if (d.field === "pointsEnabled") t.pointsEnabled = el.checked;
        else if (d.field === "freeShipping") t.freeShipping = el.checked;
        else if (d.field === "autoGrantEnabled") { t.autoGrant = t.autoGrant || { enabled: false, points: 10, coupons: [] }; t.autoGrant.enabled = el.checked; }
        break;
      }
      case "membershipTierPerk": {
        const tiers = state.memberTiers || []; const t = tiers.find((x) => x.id === d.id); if (!t) break;
        t.perks = t.perks || [];
        if (el.checked) { if (!t.perks.includes(d.perk)) t.perks.push(d.perk); }
        else { t.perks = t.perks.filter((p) => p !== d.perk); }
        break;
      }
      case "membershipTierDayAdd": {
        const tiers = state.memberTiers || []; const t = tiers.find((x) => x.id === d.id); if (!t) break;
        t.memberDays = t.memberDays || [];
        t.memberDays.push({ day: "周四", discount: "", pointsMultiplier: "", products: "", claimable: "" });
        showView("membershipAdmin"); break;
      }
      case "membershipTierDayDel": {
        const tiers = state.memberTiers || []; const t = tiers.find((x) => x.id === d.id); if (!t || !t.memberDays) break;
        t.memberDays.splice(+d.idx, 1); showView("membershipAdmin"); break;
      }
      case "membershipTierDay": {
        const tiers = state.memberTiers || []; const t = tiers.find((x) => x.id === d.id); if (!t || !t.memberDays) break;
        const day = t.memberDays[+d.idx]; if (day) day[d.key] = el.value;
        break;
      }
      case "membershipTierCouponAdd": {
        const tiers = state.memberTiers || []; const t = tiers.find((x) => x.id === d.id); if (!t) break;
        const title = window.prompt("优惠券名称（如：TOPV1会员券）") || ""; if (!title.trim()) break;
        const qty = parseInt(window.prompt("发放数量") || "1", 10) || 1;
        t.autoGrant = t.autoGrant || { enabled: false, points: 10, coupons: [] };
        t.autoGrant.coupons.push({ couponId: "c_" + String(Date.now()).slice(-6), title: title.trim(), qty });
        showView("membershipAdmin"); break;
      }
      case "membershipTierCouponDel": {
        const tiers = state.memberTiers || []; const t = tiers.find((x) => x.id === d.id); if (!t || !t.autoGrant || !t.autoGrant.coupons) break;
        t.autoGrant.coupons.splice(+d.idx, 1); showView("membershipAdmin"); break;
      }
      case "membershipTierIcon": {
        const url = window.prompt("请输入等级标识图片 URL（留空使用默认图标）") || "";
        const tiers = state.memberTiers || []; const t = tiers.find((x) => x.id === d.id); if (!t) break;
        if (url.trim()) t.iconUrl = url.trim(); else delete t.iconUrl;
        showView("membershipAdmin"); break;
      }
      case "membershipSmsSign": { toast("短信签名设置：请在「消息通知」中配置"); break; }
      case "membershipSmsRecharge": { toast("短信充值：模拟跳转充值页面"); break; }
      case "membershipOrderQuery": { state.membershipOrderPage.page = 1; saveState(); showView("membershipAdmin"); break; }
      case "membershipOrderExport": { toast("已生成购买会员订单 CSV（演示）"); break; }
      case "membershipPage": {
        const p = state.membershipOrderPage || { page: 1, pageSize: 15 };
        const totalPages = Math.max(1, Math.ceil((state.membershipOrders || []).length / p.pageSize));
        p.page = d.dir === "prev" ? Math.max(1, p.page - 1) : Math.min(totalPages, p.page + 1);
        showView("membershipAdmin"); break;
      }
      case "membershipPageSize": {
        state.membershipOrderPage = state.membershipOrderPage || { page: 1, pageSize: 15 };
        state.membershipOrderPage.pageSize = +el.value || 15;
        state.membershipOrderPage.page = 1;
        showView("membershipAdmin"); break;
      }
      case "membershipPageGo": {
        if (event && event.type === "keydown" && event.key !== "Enter") break;
        const p = state.membershipOrderPage || { page: 1, pageSize: 15 };
        const totalPages = Math.max(1, Math.ceil((state.membershipOrders || []).length / p.pageSize));
        p.page = Math.max(1, Math.min(totalPages, +el.value || 1));
        showView("membershipAdmin"); break;
      }
      /* ---- AI 宣发中心（v112） ---- */
      case "xfGoScenario": {
        const xf = xfState();
        if (d.s === "back") { xf.scenario = null; xf.step = null; xf.aid = null; xf.out = null; xf.recap = null; }
        else { xf.scenario = d.s; xf.step = null; xf.aid = null; xf.out = null; xf.recap = null; }
        showView(state.view);
        break;
      }
      case "xfFromTask": {
        const xf = xfState();
        xf.scenario = "recruit"; xf.step = null; xf.aid = d.aid; xf.out = null;
        showView(state.view);
        break;
      }
      case "xfPickActivity": {
        const xf = xfState();
        xf.aid = d.aid; xf.step = "pick";
        showView(state.view);
        break;
      }
      case "xfDelPhoto": {
        const xf = xfState();
        xf.photos = (xf.photos || []).filter((_, i) => i !== (+d.i));
        showView(state.view);
        break;
      }
      case "xfPlatTab": { xfState().platTab = d.k; showView(state.view); break; }
      case "xfSwitchFamily": {
        const xf = xfState();
        xf.family = d.f;
        const vs = (XF_FAMILIES[xf.family] && XF_FAMILIES[xf.family].variants) || [""];
        if (xf.variant >= vs.length) xf.variant = 0;
        showView(state.view);
        break;
      }
      case "xfSwitchVariant": {
        const xf = xfState();
        xf.variant = (+d.v) || 0;
        showView(state.view);
        break;
      }
      case "xfQuickStyle": { xfQuickStyle(d.k); break; }
      case "xfSwitchStyle": {
        const xf = xfState();
        const a = xf._a || (state.activities || []).find((x) => x.id === xf.aid);
        if (!a) { toast("请先重新选择活动再换风格"); break; }
        xf.styleSeed = Math.floor(Date.now() % 1000000) + Math.floor(Math.random() * 1000);
        xf.genState = "loading"; showView(state.view);
        try {
          xf.strategy = await genStrategy(a, xf.photos, xf.notes || xf.recapNotes, xf.scenario);
          if (xf.scenario === "recruit") xf.out = await genRecruit(a, xf.master, xf.strategy);
          else xf.recap = await genRecap(a, xf.master, xf.strategy, xf.photos, xf.recapNotes);
          xf.family = xf.strategy.editorialDirection.family;
          xf.variant = xf.strategy.editorialDirection.variant;
          xf._styleHistory.push({ family: xf.family, variant: xf.variant });
          xf.genState = "idle"; xf.platTab = "gzh";
          toast("已换风格重生成");
        } catch (e) { xf.genState = "idle"; toast("换风格失败：" + (e && e.message ? e.message : e)); }
        showView(state.view);
        break;
      }
      case "xfReset": { state.xf = null; showView(state.view); break; }
      case "xfRecruitGen": {
        const xf = xfState();
        const ta = document.querySelector('[data-xf="note"]');
        if (ta) xf.notes = ta.value;
        const a = (state.activities || []).find((x) => x.id === xf.aid);
        if (!a) { toast("请先选择一场活动"); break; }
        xf._a = a;
        xf.master = buildContentMaster(a, xf.photos);
        xf.genState = "loading"; showView(state.view);
        try {
          xf.strategy = await genStrategy(a, xf.photos, xf.notes, "recruit");
          xf.master.keyImages = await xfAttachPhotoCaptions(xf.master.keyImages, xf.master.confirmedFacts, xf.strategy.editorialDirection);
          xf.out = await genRecruit(a, xf.master, xf.strategy);
          // §41：版式质量不达标 → 重选家族/变体（重生成 ED/Layout）一次
          if (aiAuthMode() && state.xf.quality && state.xf.quality.editorialRisk) {
            xf.strategy = await genStrategy(a, xf.photos, xf.notes, "recruit");
            xf.out = await genRecruit(a, xf.master, xf.strategy);
          }
          xf.family = xf.strategy.editorialDirection.family;
          xf.variant = xf.strategy.editorialDirection.variant;
          xf.styleSeed = xf.strategy.editorialDirection.styleSeed;
          xf._styleHistory.push({ family: xf.family, variant: xf.variant });
          xf.step = "result"; xf.genState = "idle"; xf.platTab = "gzh";
          toast("已生成宣传内容");
        } catch (e) { xf.genState = "idle"; toast("生成失败：" + (e && e.message ? e.message : e)); }
        showView(state.view);
        break;
      }
      case "xfRecapGen": {
        const xf = xfState();
        const rt = document.querySelector('[data-xf="recapNotes"]');
        if (rt) xf.recapNotes = rt.value;
        const customFields = { title: "", date: "", place: "", type: "", signups: "", leader: "" };
        ["customTitle", "customDate", "customPlace", "customType", "customSignups", "customLeader"].forEach((k) => {
          const el = document.querySelector(`[data-xf="${k}"]`);
          if (el) customFields[k.replace("custom", "").toLowerCase()] = el.value;
        });
        xf.customRecap = customFields;
        let a;
        if (xf.aid) {
          a = (state.activities || []).find((x) => x.id === xf.aid);
          if (!a) { toast("所选活动不存在"); break; }
        } else {
          if (!customFields.title.trim()) { toast("请选择一场活动，或填写活动名称"); break; }
          a = {
            title: customFields.title.trim(), type: customFields.type.trim(), place: customFields.place.trim(),
            dateMD: customFields.date.trim(), signups: customFields.signups ? +customFields.signups : 0,
            leaderName: customFields.leader.trim(), status: "ended",
          };
        }
        xf._a = a;
        xf.master = buildContentMaster(a, xf.photos);
        xf.genState = "loading"; showView(state.view);
        try {
          xf.strategy = await genStrategy(a, xf.photos, xf.recapNotes, "recap");
          xf.master.keyImages = await xfAttachPhotoCaptions(xf.master.keyImages, xf.master.confirmedFacts, xf.strategy.editorialDirection);
          xf.recap = await genRecap(a, xf.master, xf.strategy, xf.photos, xf.recapNotes);
          // §41：版式质量不达标 → 重选家族/变体（重生成 ED/Layout）一次
          if (aiAuthMode() && state.xf.quality && state.xf.quality.editorialRisk) {
            xf.strategy = await genStrategy(a, xf.photos, xf.recapNotes, "recap");
            xf.recap = await genRecap(a, xf.master, xf.strategy, xf.photos, xf.recapNotes);
          }
          xf.recapType = xfRecapType(a, xf.photos);
          xf.family = xf.strategy.editorialDirection.family;
          xf.variant = xf.strategy.editorialDirection.variant;
          xf.styleSeed = xf.strategy.editorialDirection.styleSeed;
          xf._styleHistory.push({ family: xf.family, variant: xf.variant });
          xf.step = "result"; xf.genState = "idle"; xf.platTab = "gzh";
          toast("已生成活动回顾");
        } catch (e) { xf.genState = "idle"; toast("生成失败：" + (e && e.message ? e.message : e)); }
        showView(state.view);
        break;
      }
      case "xfCopyGzhHtml": {
        const art = document.getElementById("xfGzhArticle");
        if (!art) break;
        xbCopy(art.innerHTML);
        toast("已复制公众号 HTML，去微信后台粘贴即可");
        break;
      }
      case "xfCopyText": { xbCopy(d.text || ""); break; }
      default: break;
    }
  }

  function placeAliases(p) {
    const map = {
      "重庆市": ["重庆", "重庆市"], "重庆": ["重庆", "重庆市"],
      "四姑娘山": ["四姑娘山", "四姑娘"], "四姑娘": ["四姑娘", "四姑娘山"],
      "青城后山": ["青城后山", "青城山"], "青城山": ["青城山", "青城后山"],
      "虹口": ["虹口", "都江堰虹口"], "都江堰虹口": ["都江堰虹口", "虹口"],
      "成都市区": ["成都市区", "成都城区"], "成都城区": ["成都城区", "成都市区"],
    };
    return map[p] || [p];
  }
  function similarList(a) {
    const H = state.history || [];
    const pa = placeAliases(a.place);
    const out = [];
    for (const h of H) {
      let score = 0;
      const ph = placeAliases(h.place);
      if (pa.some((x) => ph.includes(x)) || ph.some((x) => pa.includes(x))) score += 3;
      if (h.type === a.type) score += 2;
      if ((h.days || 1) === (a.days || 1)) score += 1;
      if (h.title && a.title && h.title.replace(/[（(].*?[)）]/g, "").includes(a.place)) score += 1;
      if (score >= 3) out.push({ h, score });
    }
    out.sort((x, y) => y.score - x.score);
    return out.slice(0, 3).map((o) => o.h);
  }
  function findSimilar(a) {
    const list = similarList(a);
    return list.length ? list[0] : null;
  }
  function generateFromInput() {
    const ta = $("#createInput");
    const text = ta ? ta.value.trim() : "";
    if (!text) return toast("请先描述你的活动");
    if (!aiAuthMode()) { toast("请先在「AI 设置」配置后端地址或本地演示 Key 以启用 AI 生成"); openAISettings(); return; }
    state.draft = blankActivity();
    state.draft.raw = text;
    showGenerating();
    parseActivityWithAI(text).then(async (json) => {
      if (!json || json._needKey) { toast("请先在「AI 设置」填写 DeepSeek API Key"); openAISettings(); return; }
      if (json._error) { toast("AI 解析失败：" + json._error + "（可在 AI 设置更换 Key / 模型）"); return; }
      applyAIResult(json, state.draft);
      await ensureNarrativeFields(state.draft);
      await ensureItineraryFields(state.draft);
      syncItineraryDays(state.draft);
      const sims = similarList(state.draft);
      if (sims.length) state.draft._similarList = sims.map((s) => ({ id: s.id, title: s.title }));
      showView("advice");
    });
  }
  function showGenerating() {
    const steps = ["正在识别活动信息", "正在判断活动类型", "正在生成宣传内容", "正在匹配活动视觉", "正在整理装备与注意事项", "活动页面生成完成"];
    const ov = document.createElement("div");
    ov.className = "generate-overlay";
    ov.innerHTML = `${state.brand.logo ? `<div class="gen-logo gen-logo-img" style="background-image:url('${esc(state.brand.logo)}')"></div>` : `<div class="gen-logo">${esc(state.brand.logoText || "C")}</div>`}
      <ul class="gen-steps">${steps.map((s) => `<li data-i="${s}"><span class="mk"></span>${s}</li>`).join("")}</ul>`;
    document.body.appendChild(ov);
    (async () => {
      const lis = ov.querySelectorAll("li");
      for (let i = 0; i < steps.length; i++) {
        lis[i].classList.add("active");
        await sleep(520);
        lis[i].classList.remove("active"); lis[i].classList.add("done");
      }
      await sleep(300);
      ov.remove();
      showView("advice");
    })();
  }
  function rerenderEditor() {
    const ed = $("#content");
    if (ed) { ed.innerHTML = renderEditor(); bindEditorExtras(); }
  }
  function applyAiCmd(cmd) {
    if (!state.draft || !cmd) return;
    const a = state.draft;
    let m;
    if ((m = cmd.match(/价格.*?(\d+)/))) { a.price = +m[1]; toast("已将价格改为 ¥" + m[1]); }
    else if ((m = cmd.match(/人数.*?(\d+)/)) || (m = cmd.match(/限.*?(\d+)/))) { a.limit = +m[1]; a.limitUnit = a.limitUnit || "组家庭"; toast("已将招募上限改为 " + m[1]); }
    else if ((m = cmd.match(/集合.*?([\u4e00-\u9fa5A-Za-z·]{2,10})/))) { a.meeting = m[1]; toast("集合地点已更新"); }
    else if ((m = cmd.match(/时间.*?(\d{1,2}):?(\d{2})?/))) { a.meetTime = m[2] ? `${m[1]}:${m[2]}` : `${m[1]}:00`; toast("集合时间已更新"); }
    else if (/更吸引人|标题|重写|文案|朋友圈|小红书|年轻|高级|户外感/.test(cmd)) {
      if (aiAuthMode()) { toast("AI 正在重写文案…"); regenerateCopy(a).then((ok) => { if (ok) toast("文案已更新"); else toast("AI 重写失败，请检查配置"); rerenderEditor(); }); }
      else toast("请先在「AI 设置」配置后端地址或本地演示 Key 以重写文案");
      return;
    }
    else if (/安全|保障/.test(cmd)) { toast(a.includeInsurance || a.includeLeader ? "只强调已确认的领队/保险信息" : "当前没有已确认的保障数据，未添加虚构内容"); }
    else if (/亲子/.test(cmd)) { a.type = "亲子活动"; a.audience = ["亲子"]; a.pageStyle = "kids"; toast("已切换为亲子风格"); }
    else if (/成人|非亲子|年轻化/.test(cmd)) { a.audience = ["成人"]; if (a.type === "亲子活动" || a.type === "研学") { a.type = "徒步"; a.pageStyle = "hike"; } toast("已切换为成人户外风格"); }
    else { toast("已尝试理解指令"); }
    syncDerived(a);
    rerenderEditor();
  }
  function saveBrand() {
    const map = { name: "name", logoText: "logoText", slogan: "slogan", style: "style", intro: "intro", wechat: "wechat", phone: "phone", address: "address", primary: "primary" };
    Object.keys(map).forEach((k) => {
      const el = document.querySelector(`[data-brand="${k}"]`);
      if (el) state.brand[k] = el.value;
    });
    updateBrandColor();
    saveState();
    toast("品牌设置已保存");
  }
  function renderAISettings() {
    const key = getAIKey();
    const provider = getAIProvider();
    return `<div class="card card-pad" style="max-width:640px">
      <div class="eyebrow">AI 大模型</div>
      <h2 class="section-title" style="margin:8px 0 4px">AI 解析与文案设置</h2>
      <p class="muted small" style="margin:0 0 18px">生产环境由<b>总平台统一持有 AI Key</b>并按 AI 积分计量，俱乐部只需填「后端地址 + 管理员口令 + 商家ID」即可，无需任何 Key。未接后端时，可填下方「本地演示 Key」临时直连（仅存本机浏览器）。</p>
      <div class="field"><label>总平台后端地址</label>
        <input class="input" id="backendUrl" placeholder="https://your-backend.com/api/pay" value="${esc(getBackendURL())}" autocomplete="off">
        <div class="hint">留空则走本地演示直连；填写后所有 AI 调用经后端代理（Key 不在前端）。</div>
      </div>
      <div class="row gap-10" style="margin:6px 0">
        <input class="input" id="backendAdminCode" type="password" placeholder="管理员口令（ADMIN_CODE）" value="${esc(getBackendAdminCode())}" autocomplete="off" style="flex:1">
        <input class="input" id="backendMerchantId" placeholder="商家ID" value="${esc(getBackendMerchantId())}" autocomplete="off" style="width:120px">
      </div>
      <div class="row gap-10" style="margin-top:6px">
        <button class="btn btn-ghost" data-action="testBackend">${ICON("sparkles")} 测试后端连接</button>
      </div>
      <hr style="border:none;border-top:1px solid var(--line,#eee);margin:16px 0">
      <div class="field"><label>本地演示 Key（服务商）</label>
        <select class="input" id="aiProvider">
          <option value="deepseek" ${provider === "deepseek" ? "selected" : ""}>DeepSeek（deepseek-chat）</option>
          <option value="qwen" ${provider === "qwen" ? "selected" : ""}>阿里云百炼（qwen-plus）</option>
        </select>
      </div>
      <div class="field"><label>本地演示 Key</label>
        <input class="input" id="aiKey" type="password" placeholder="sk-... 或 DashScope Key（仅未接后端时生效）" value="${esc(key)}" autocomplete="off">
        <div class="hint">⚠️ 仅本地演示用：Key 只存本机浏览器，不上传服务器；接入总平台后端后此 Key 不再使用。</div>
      </div>
      <div class="row gap-10" style="margin-top:6px">
        <button class="btn btn-primary btn-lg" data-action="saveAI">${ICON("check")} 保存并设置</button>
        <button class="btn btn-ghost" data-action="testAI">${ICON("sparkles")} 测试连接</button>
      </div>
      <div class="tiny muted" style="margin-top:14px">说明：接入总平台后端后，浏览器不再直连模型 API，也不受 CORS 跨域限制；Key 由平台在服务端统一持有。</div>
    </div>`;
  }
  function saveAISettings() {
    const keyEl = $("#aiKey"); const provEl = $("#aiProvider");
    if (keyEl) setAIKey(keyEl.value.trim());
    if (provEl) setAIProvider(provEl.value);
    const bu = $("#backendUrl"); if (bu) setBackendURL(bu.value.trim());
    const bac = $("#backendAdminCode"); if (bac) setBackendAdminCode(bac.value.trim());
    const bmid = $("#backendMerchantId"); if (bmid) setBackendMerchantId(bmid.value.trim());
    // 保存后端配置后清掉旧 JWT，下次调用会按新地址/口令重新登录
    clearBackendToken();
    toast("AI 设置已保存");
  }
  async function testBackendConnection() {
    const url = getBackendURL();
    if (!url) return toast("请先填写总平台后端地址");
    const code = getBackendAdminCode();
    if (!code) return toast("请先填写管理员口令");
    toast("正在连接后端…");
    clearBackendToken();
    const tok = await ensureBackendToken();
    if (!tok) return toast("后端连接失败：请检查地址 / 口令 / 商家ID");
    const r = await clubLLMviaBackend({ system: "", user: "用一句话介绍本周末的徒步活动", json: false, temperature: 0.7 });
    if (r === "__fallback__") return toast("后端不可达（网络 / 地址错误）");
    if (r == null) return toast("后端已连通，但 AI 代理返回空（检查 PLATFORM_LLM_KEY 或 AI 积分）");
    toast("后端连通成功：" + String(r).slice(0, 30) + "…");
  }
  function submitSignup(id) {
    const a = getActivity(id); if (!a) return;
    syncDepartures(a);
    const deps = (a.departures || []).filter((d) => d.status !== "closed");
    let departureId = "";
    if (deps.length > 1) {
      const checked = document.querySelector('input[name="sf_departure"]:checked');
      if (!checked) return toast("请选择参加团期");
      departureId = checked.value;
      const dep = deps.find((d) => d.id === departureId);
      if (dep && dep.status === "full") return toast("该团期已满员，请选择其他团期");
    } else if (deps.length === 1) {
      departureId = deps[0].id;
    }
    const name = $("#sf_name").value.trim();
    const phone = $("#sf_phone").value.trim();
    const idType = $("#sf_idType").value;
    const idNumber = $("#sf_idNumber").value.trim();
    const agree = $("#sf_agree").checked;
    if (!name) return toast("请填写联系人姓名");
    if (!/^1\d{10}$/.test(phone)) return toast("请填写正确的 11 位手机号");
    if (!idType) return toast("请选择证件类型");
    if (!idNumber) return toast("请填写证件号码");
    if (!agree) return toast("请先同意活动须知");
    const custom = {};
    (a.customFields || []).forEach((f) => {
      const el = $(`#sf_custom_${f.id}`);
      if (el) custom[f.id] = el.value.trim();
    });
    const s = {
      id: uid(), activityId: id, departureId,
      name, phone, idType, idNumber,
      adults: +($("#sf_adults").value || 1), children: +($("#sf_children").value || 0),
      childName: $("#sf_childName").value.trim(), childAge: $("#sf_childAge").value.trim(),
      note: $("#sf_note").value.trim(), custom,
      paid: false, createdAt: Date.now(),
    };
    state.signups.unshift(s);
    a.signups = (a.signups || 0) + 1;
    const dep = (a.departures || []).find((d) => d.id === departureId);
    if (dep) dep.signups = (dep.signups || 0) + 1;
    saveState();
    showView("success", { id, signupId: s.id });
  }
  function upsert(a) {
    const i = state.activities.findIndex((x) => x.id === a.id);
    if (i >= 0) state.activities[i] = a; else state.activities.unshift(a);
    saveState();
  }
  function copyText(id, type) {
    const a = getActivity(id); if (!a) return;
    const txt = a["share" + type.charAt(0).toUpperCase() + type.slice(1)] || "";
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => toast("已复制到剪贴板")).catch(() => toast("复制失败，请手动选择"));
    } else toast("已生成文案（当前环境不支持自动复制）");
  }
  function xbCopy(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(() => toast("已复制")).catch(() => xbCopyFallback(t));
    } else xbCopyFallback(t);
  }
  function xbCopyFallback(t) {
    try {
      const ta = document.createElement("textarea");
      ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
      toast("已复制");
    } catch (e) { toast("复制失败，请手动选择文字"); }
  }
  // ---------- 海报生成：户外风 + 按活动类型调色 + 首图自动裁切 ----------
  const POSTER_SIZES = { vertical: { w: 750, h: 1000 }, square: { w: 800, h: 800 }, wide: { w: 1000, h: 562 } };
  const POSTER_PALETTE = {
    city:   { top: [55, 65, 75], bot: [30, 35, 42], accent: [232, 176, 75], ink: [35, 33, 27], paper: [250, 248, 244] },
    sight:  { top: [50, 80, 65], bot: [28, 45, 38], accent: [127, 200, 169], ink: [35, 33, 27], paper: [245, 250, 246] },
    hike:   { top: [40, 65, 50], bot: [22, 38, 30], accent: [156, 204, 101], ink: [35, 33, 27], paper: [247, 244, 238] },
    alpine: { top: [45, 55, 60], bot: [20, 25, 30], accent: [210, 220, 225], ink: [35, 33, 27], paper: [240, 242, 244] },
    camp:   { top: [75, 60, 45], bot: [45, 35, 28], accent: [224, 169, 109], ink: [35, 33, 27], paper: [250, 246, 238] },
    kids:   { top: [95, 120, 95], bot: [70, 90, 75], accent: [235, 140, 105], ink: [35, 33, 27], paper: [255, 250, 245] },
    ski:    { top: [35, 65, 100], bot: [20, 35, 55], accent: [179, 229, 252], ink: [35, 33, 27], paper: [245, 250, 255] },
    cycling:{ top: [55, 60, 75], bot: [30, 33, 45], accent: [170, 160, 200], ink: [35, 33, 27], paper: [248, 246, 252] },
    run:    { top: [90, 65, 55], bot: [55, 35, 30], accent: [255, 138, 101], ink: [35, 33, 27], paper: [255, 247, 244] },
    climb:  { top: [70, 60, 50], bot: [40, 33, 28], accent: [255, 183, 77], ink: [35, 33, 27], paper: [250, 247, 240] },
    water:  { top: [25, 75, 90], bot: [15, 45, 55], accent: [77, 208, 225], ink: [35, 33, 27], paper: [240, 248, 250] },
    drive:  { top: [55, 60, 75], bot: [30, 33, 45], accent: [144, 202, 249], ink: [35, 33, 27], paper: [245, 248, 252] },
    photo:  { top: [60, 55, 65], bot: [35, 30, 40], accent: [220, 160, 180], ink: [35, 33, 27], paper: [252, 246, 248] },
    team:   { top: [40, 75, 55], bot: [22, 45, 35], accent: [129, 199, 132], ink: [35, 33, 27], paper: [244, 250, 245] },
    travel: { top: [45, 70, 85], bot: [25, 45, 55], accent: [77, 182, 172], ink: [35, 33, 27], paper: [243, 249, 248] },
    outdoor:{ top: [40, 65, 50], bot: [22, 38, 30], accent: [156, 204, 101], ink: [35, 33, 27], paper: [247, 244, 238] },
  };
  function posterPalette(a) { return POSTER_PALETTE[a.pageStyle] || POSTER_PALETTE.outdoor; }
  function hexToRgb(h) { h = (h || "#2F5D50").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function mix(c1, c2, t) { return [0, 1, 2].map((i) => Math.round(c1[i] + (c2[i] - c1[i]) * t)); }
  function rgb(c, a) { return a == null ? "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")" : "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function darken(c, t) { return mix(c, [0, 0, 0], t); }
  function lighten(c, t) { return mix(c, [255, 255, 255], t); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wrapText(ctx, text, maxW) { const ch = [].concat(...String(text).split("")); let line = "", out = []; for (const c of ch) { if (ctx.measureText(line + c).width > maxW && line) { out.push(line); line = c; } else line += c; } if (line) out.push(line); return out; }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      if (/^https?:\/\//.test(src)) { img.crossOrigin = "anonymous"; img.referrerPolicy = "no-referrer"; }
      img.onload = () => resolve(img); img.onerror = () => reject(new Error("poster img load failed")); img.src = src;
    });
  }
  function drawImageCover(ctx, img, x, y, w, h, focus) {
    const iw = img.naturalWidth || img.width || 1, ih = img.naturalHeight || img.height || 1;
    const r = Math.max(w / iw, h / ih), sw = w / r, sh = h / r;
    let fx = focus && focus.x != null ? focus.x / 100 : .5;
    let fy = focus && focus.y != null ? focus.y / 100 : .48;
    // 竖图且只取局部时，防止焦点过低下切掉人物头部
    const isPortrait = ih / iw > 1.15;
    const isTightCrop = sh / ih < 0.72;
    if (isPortrait && isTightCrop) { fy = Math.max(0.30, Math.min(fy, 0.52)); }
    const sx = Math.max(0, Math.min(iw * fx - sw / 2, iw - sw));
    const sy = Math.max(0, Math.min(ih * fy - sh / 2, ih - sh));
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }
  function drawPosterBg(ctx, w, h, pal, img, focus) {
    if (img) { drawImageCover(ctx, img, 0, 0, w, h, focus); }
    else {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, rgb(pal.top)); g.addColorStop(1, rgb(pal.bot)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath(); ctx.moveTo(0, h * 0.72); ctx.bezierCurveTo(w * 0.25, h * 0.62, w * 0.55, h * 0.82, w, h * 0.68); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, h * 0.88); ctx.bezierCurveTo(w * 0.3, h * 0.78, w * 0.7, h * 0.92, w, h * 0.84); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath(); ctx.fill();
    }
  }
  function drawPoster(canvas, a, style, sizeKey, mode, img, focus, logoImg) {
    const S = POSTER_SIZES[sizeKey] || POSTER_SIZES.vertical;
    const w = S.w, h = S.h;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    const pal = posterPalette(a);
    const ink = pal.ink, paper = pal.paper, accent = pal.accent;
    const brand = state.brand || {};
    const logo = (brand.logoText || brand.name || "山野").slice(0, 1);
    const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textBaseline = "alphabetic";
    ctx.clearRect(0, 0, w, h);

    const titleRaw = ((a.titleVariants && a.titleVariants.brand) || a.title || a.type || "").trim();
    const promoRaw = (a.posterTagline || "").trim();
    const sub = (a.type || "") + " · " + (audienceLabel(a) || "成人");
    const dateTxt = (a.dateMD || a.date || "待定").trim();
    const placeRaw = ((a.meeting ? a.meeting + " · " : "") + (a.place || "待定"));
    const priceTxt = a.price ? ("¥" + a.price) : (a.priceTBD ? "价格待定" : "详询");
    const unitTxt = a.price ? ("/" + (a.limitUnit || "人")) : "";
    const diffTxt = a.difficulty || "待确认";
    const curPhoto = (a.photos || [])[a.posterPhotoIndex || 0] || (a.photos || [])[0];
    const posterFocus = focus || focusValue(curPhoto);

    const mx = sizeKey === "square" ? 40 : 44;
    const my = sizeKey === "square" ? 40 : 44;

    function fill(c) { ctx.fillStyle = c; }
    function stroke(c, lw) { ctx.strokeStyle = c; ctx.lineWidth = lw; }
    function font(size, weight) { ctx.font = weight + " " + size + "px " + FONT; }
    function textW(t, sz, wt) { font(sz, wt); return ctx.measureText(t).width; }
    function pill(txt, x, y, bg, fg, size, padX, hh, r) {
      font(size, "700");
      const tw = ctx.measureText(txt).width;
      fill(bg); rr(ctx, x, y, tw + padX * 2, hh, r); ctx.fill();
      fill(fg); ctx.fillText(txt, x + padX, y + hh * 0.72);
      return tw + padX * 2;
    }
    function fitTitle(txt, maxW, maxLines, sizes) {
      for (const sz of sizes) {
        font(sz, "800");
        const lines = wrapText(ctx, txt, maxW);
        if (lines.length <= maxLines) return { size: sz, lines };
      }
      font(sizes[sizes.length - 1], "800");
      const lines = wrapText(ctx, txt, maxW);
      return { size: sizes[sizes.length - 1], lines: lines.slice(0, maxLines) };
    }
    function clipText(txt, maxW, sz, wt) {
      font(sz, wt || "500");
      if (ctx.measureText(txt).width <= maxW) return txt;
      let s = txt;
      while (s.length > 1 && ctx.measureText(s + "…").width > maxW) s = s.slice(0, -1);
      return s + "…";
    }
    function promoLines(txt, maxW, maxLines, sz) {
      if (!txt) return [];
      font(sz, "600");
      return wrapText(ctx, txt, maxW).slice(0, maxLines);
    }
    function brandBlockLeft(x, y, maxW, light) {
      const r = 16;
      function drawLogoCircle(cx, cy, r) {
        if (logoImg && logoImg.naturalWidth) {
          ctx.save();
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
          ctx.drawImage(logoImg, cx - r, cy - r, r * 2, r * 2);
          ctx.restore();
        } else {
          fill(rgb(accent)); rr(ctx, cx - r, cy - r, r * 2, r * 2, r); ctx.fill();
          fill("#fff"); font(17, "800"); ctx.fillText(logo, cx - r + (logo.length > 1 ? 7 : 12), cy - r + 23);
        }
      }
      drawLogoCircle(x + r, y + r, r);
      const name = (brand.name || "").slice(0, 10);
      const slogan = (brand.slogan || "").slice(0, 16);
      if (name) {
        const nameW = textW(name, 20, "700");
        if (nameW < maxW - 52) {
          fill(light ? "#fff" : rgb(ink)); font(20, "700"); ctx.fillText(name, x + 44, y + 20);
          if (slogan) {
            const sW = textW(slogan, 15, "500");
            if (sW < maxW - 52) {
              fill(light ? "rgba(255,255,255,0.78)" : rgb(ink, 0.55)); font(15, "500"); ctx.fillText(slogan, x + 44, y + 39);
            }
          }
        }
      }
    }
    function brandBlockRight(xRight, y, maxW, light) {
      const r = 16;
      const name = (brand.name || "").slice(0, 10);
      const slogan = (brand.slogan || "").slice(0, 16);
      font(17, "800"); const lw = ctx.measureText(logo).width;
      let nameW = 0, sloganW = 0;
      if (name) { nameW = textW(name, 20, "700"); }
      if (slogan) { sloganW = textW(slogan, 15, "500"); }
      const textWid = Math.max(nameW, sloganW);
      const blockW = Math.min(maxW, 44 + textWid + 8);
      const x = xRight - blockW;
      if (logoImg && logoImg.naturalWidth) {
        ctx.save();
        ctx.beginPath(); ctx.arc(x + r, y + r, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        ctx.drawImage(logoImg, x, y, r * 2, r * 2);
        ctx.restore();
      } else {
        fill(rgb(accent)); rr(ctx, x, y, r * 2, r * 2, r); ctx.fill();
        fill("#fff"); font(17, "800"); ctx.fillText(logo, x + (logo.length > 1 ? 7 : 12), y + 23);
      }
      if (name && nameW < maxW - 52) {
        fill(light ? "#fff" : rgb(ink)); font(20, "700"); ctx.fillText(name, x + 44, y + 20);
        if (slogan && sloganW < maxW - 52) {
          fill(light ? "rgba(255,255,255,0.78)" : rgb(ink, 0.55)); font(15, "500"); ctx.fillText(slogan, x + 44, y + 39);
        }
      }
    }
    function priceRow(x, y, bigSize, unitSize, maxW) {
      let size = bigSize;
      font(size, "900");
      let pw = ctx.measureText(priceTxt).width;
      let uw = unitTxt ? textW(unitTxt, unitSize, "500") : 0;
      if (maxW && pw + uw + 10 > maxW) {
        while (size > 22 && pw + uw + 10 > maxW) {
          size -= 2;
          font(size, "900"); pw = ctx.measureText(priceTxt).width;
          if (unitTxt) { font(unitSize, "500"); uw = ctx.measureText(unitTxt).width; }
        }
      }
      fill(rgb(accent)); font(size, "900"); ctx.fillText(priceTxt, x, y);
      if (unitTxt) {
        fill(rgb(ink, 0.45)); font(unitSize, "500");
        ctx.fillText(unitTxt, x + pw + 10, y - (size - unitSize) * 0.35);
      }
    }

    if (style === "mood") {
      drawPosterBg(ctx, w, h, pal, img, posterFocus);
      const pillH = sizeKey === "vertical" ? 34 : 32;
      pill(sub, mx, my, "rgba(255,255,255,0.16)", "#fff", sizeKey === "vertical" ? 20 : 19, 13, pillH, 16);

      const bottomY = h - (sizeKey === "vertical" ? 40 : sizeKey === "square" ? 36 : 34);
      const priceBig = sizeKey === "vertical" ? 56 : sizeKey === "square" ? 48 : 44;
      const priceUnit = sizeKey === "vertical" ? 21 : 19;
      const infoSize = sizeKey === "vertical" ? 22 : 20;
      const priceMaxW = (sizeKey === "wide" ? w * 0.50 : w) - mx - (sizeKey === "vertical" ? 190 : 180) - 20;
      const lineGap = sizeKey === "vertical" ? 12 : 10;

      // 底部固定：价格 + 品牌（始终贴底，不与其他元素争空间）
      priceRow(mx, bottomY, priceBig, priceUnit, priceMaxW);
      if (sizeKey === "vertical") brandBlockLeft(w - 190, bottomY - 36, 150, true);
      else brandBlockRight(w - mx, bottomY - (sizeKey === "vertical" ? 36 : 34), sizeKey === "vertical" ? 150 : 140, true);

      // 日期 / 地点行：紧贴价格上方，单行不换行
      const infoY = bottomY - (priceBig * 0.62 + 26);
      const placeW = clipText(placeRaw, priceMaxW - textW(dateTxt + "  ·  ", infoSize, "500"), infoSize);
      fill("rgba(255,255,255,0.86)"); font(infoSize, "500");
      ctx.fillText(dateTxt + "  ·  " + placeW, mx, infoY);

      // 标题：在 [顶部下限, 日期行上限] 之间放置——任何尺寸都不重叠
      const titleMaxW = (sizeKey === "wide" ? w * 0.50 : w) - mx * 2;
      const sizes = sizeKey === "vertical" ? [54, 48, 42, 38] : sizeKey === "square" ? [46, 40, 36, 32] : [42, 38, 34, 30];
      const t = fitTitle(titleRaw, titleMaxW, 2, sizes);
      const lastBaseLimit = infoY - (infoSize * 0.82 + t.size * 0.24 + 12);
      const firstBaseMax = lastBaseLimit - (t.lines.length - 1) * (t.size + lineGap);
      const firstBaseMin = my + pillH + 10 + t.size * 0.82;
      const titleY = Math.max(firstBaseMin, firstBaseMax);
      fill("#fff"); font(t.size, "800");
      let y = titleY;
      t.lines.forEach((l, i) => { if (i) y += t.size + lineGap; ctx.fillText(l, mx, y); });

      if (mode === "front") {
        const qz = 76, qx = w - qz - mx - 4, qy = bottomY - qz - 18;
        fill("rgba(255,255,255,0.92)"); rr(ctx, qx, qy, qz, qz, 14); ctx.fill();
        stroke(rgb(accent), 3); rr(ctx, qx, qy, qz, qz, 14); ctx.stroke();
        fill(rgb(ink)); font(14, "600"); ctx.fillText("长按识别", qx + 16, qy + 38); ctx.fillText("立即报名", qx + 16, qy + 56);
      }
    } else if (style === "brand") {
      if (sizeKey === "vertical") {
        const heroH = Math.round(h * 0.50);
        drawPosterBg(ctx, w, heroH, pal, img, posterFocus);
        const tg = ctx.createLinearGradient(0, 0, 0, heroH * 0.42);
        tg.addColorStop(0, "rgba(0,0,0,0.22)");
        tg.addColorStop(1, "rgba(0,0,0,0)");
        fill(tg); ctx.fillRect(0, 0, w, heroH);
        pill(sub, mx, my, "rgba(255,255,255,0.16)", "#fff", 19, 13, 32, 16);

        fill(rgb(paper)); ctx.fillRect(0, heroH, w, h - heroH);
        const pad = 36;
        const cardTop = heroH;
        const availW = w - pad * 2;

        const bottomY = h - 30;
        const priceMaxW = availW - 170 - 20;
        priceRow(pad, bottomY, 52, 21, priceMaxW);
        brandBlockRight(w - pad, bottomY - 34, 150, false);

        const infoY = bottomY - 74;
        const titleBottom = infoY - 18;

        pill(a.type || "活动", pad, cardTop + pad, rgb(accent), "#fff", 19, 14, 32, 16);

        const t = fitTitle(titleRaw, availW, 2, [44, 40, 36, 32]);
        const realH = t.lines.length * t.size + (t.lines.length - 1) * 10;
        const titleY = Math.min(cardTop + pad + 38 + 22 + t.size, titleBottom - realH + t.size);
        fill(rgb(ink)); font(t.size, "800");
        let y = titleY;
        t.lines.forEach((l, i) => { if (i) y += t.size + 10; ctx.fillText(l, pad, y); });

        // V1.3 海报不只呈现事实：加入与内容方向一致的主宣传语。
        const promo = promoLines(promoRaw, availW, 2, 23);
        let py = y + 38;
        if (promo.length && py + promo.length * 32 < infoY - 12) {
          fill(rgb(ink, 0.68)); font(23, "italic 500");
          promo.forEach((line) => { ctx.fillText(line, pad, py); py += 32; });
          fill(rgb(accent)); ctx.fillRect(pad, py + 4, 46, 4);
        }

        const infoLine = clipText(dateTxt + "  ·  " + placeRaw + "  ·  难度 " + diffTxt, availW, 21);
        fill(rgb(ink, 0.55)); font(21, "500");
        ctx.fillText(infoLine, pad, infoY);
      } else if (sizeKey === "square") {
        const split = Math.round(w * 0.55);
        drawPosterBg(ctx, split, h, pal, img, posterFocus);
        const g = ctx.createLinearGradient(split - 90, 0, split, 0);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.22)");
        fill(g); ctx.fillRect(0, 0, split, h);
        fill(rgb(paper)); ctx.fillRect(split, 0, w - split, h);

        const ix = split + 34, rightEdge = w - 34;
        const availW = rightEdge - ix;
        const bottomY = h - 36;
        const priceMaxW = availW - 170 - 20;
        priceRow(ix, bottomY, 42, 17, priceMaxW);
        brandBlockRight(rightEdge, bottomY - 32, 160, false);

        const infoY = bottomY - 68;
        const titleBottom = infoY - 18;

        pill(a.type || "活动", ix, 40, rgb(accent), "#fff", 17, 12, 28, 14);

        const t = fitTitle(titleRaw, availW, 3, [38, 34, 30, 26]);
        const realH = t.lines.length * t.size + (t.lines.length - 1) * 9;
        const titleY = Math.min(40 + 28 + 16 + t.size, titleBottom - realH + t.size);
        fill(rgb(ink)); font(t.size, "800");
        let y = titleY;
        t.lines.forEach((l, i) => { if (i) y += t.size + 9; ctx.fillText(l, ix, y); });

        const promo = promoLines(promoRaw, availW, 2, 18);
        let py = y + 28;
        if (promo.length && py + promo.length * 25 < infoY - 8) {
          fill(rgb(ink, 0.66)); font(18, "italic 500");
          promo.forEach((line) => { ctx.fillText(line, ix, py); py += 25; });
        }

        if (titleY + realH + 16 + 78 < infoY) {
          fill(rgb(ink, 0.55)); font(18, "500");
          y = titleY + realH + 16;
          ctx.fillText(dateTxt, ix, y); y += 28;
          ctx.fillText(clipText(placeRaw, availW, 18), ix, y); y += 28;
          ctx.fillText("难度 " + diffTxt, ix, y);
        } else {
          const infoLine = clipText(dateTxt + "  ·  " + placeRaw + "  ·  难度 " + diffTxt, availW, 18);
          fill(rgb(ink, 0.55)); font(18, "500");
          ctx.fillText(infoLine, ix, infoY);
        }
      } else { // wide
        const split = Math.round(w * 0.50);
        drawPosterBg(ctx, split, h, pal, img, posterFocus);
        const g = ctx.createLinearGradient(split - 100, 0, split, 0);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.20)");
        fill(g); ctx.fillRect(0, 0, split, h);
        fill(rgb(paper)); ctx.fillRect(split, 0, w - split, h);

        const ix = split + 44, rightEdge = w - 44;
        const availW = rightEdge - ix;
        const bottomY = h - 40;
        const priceMaxW = availW - 170 - 20;
        priceRow(ix, bottomY, 44, 18, priceMaxW);
        brandBlockRight(rightEdge, bottomY - 34, 160, false);

        const infoY = bottomY - 72;
        const titleBottom = infoY - 18;

        pill(a.type || "活动", ix, 44, rgb(accent), "#fff", 18, 13, 30, 15);

        const t = fitTitle(titleRaw, availW, 2, [42, 38, 34, 30]);
        const realH = t.lines.length * t.size + (t.lines.length - 1) * 10;
        const titleY = Math.min(44 + 30 + 18 + t.size, titleBottom - realH + t.size);
        fill(rgb(ink)); font(t.size, "800");
        let y = titleY;
        t.lines.forEach((l, i) => { if (i) y += t.size + 10; ctx.fillText(l, ix, y); });

        const promo = promoLines(promoRaw, availW, 2, 19);
        let py = y + 29;
        if (promo.length && py + promo.length * 27 < infoY - 8) {
          fill(rgb(ink, 0.66)); font(19, "italic 500");
          promo.forEach((line) => { ctx.fillText(line, ix, py); py += 27; });
        }

        const infoLine = clipText(dateTxt + "  ·  " + placeRaw + "  ·  难度 " + diffTxt, availW, 20);
        fill(rgb(ink, 0.55)); font(20, "500");
        ctx.fillText(infoLine, ix, infoY);
      }
    } else { // recruit
      if (sizeKey === "vertical") {
        const heroH = Math.round(h * 0.48);
        drawPosterBg(ctx, w, heroH, pal, img, posterFocus);
        fill(rgb(paper)); ctx.fillRect(0, heroH, w, h - heroH);

        const pad = 36;
        const availW = w - pad * 2;
        const cardTop = heroH;

        const bottomY = h - 36;
        const priceMaxW = availW - 170 - 20;
        priceRow(pad, bottomY, 52, 20, priceMaxW);
        brandBlockRight(w - pad, bottomY - 34, 150, false);

        const listEnd = bottomY - 74;
        const titleBottom = listEnd - 16;

        const tagW = pill(a.type || "活动", pad, cardTop + pad, rgb(accent), "#fff", 18, 13, 30, 15);
        fill(rgb(ink, 0.45)); font(18, "600");
        ctx.fillText(dateTxt, pad + tagW + 14, cardTop + pad + 21);

        const t = fitTitle(titleRaw, availW, 2, [44, 40, 36, 32]);
        const realH = t.lines.length * t.size + (t.lines.length - 1) * 10;
        const titleY = Math.min(cardTop + pad + 30 + 22 + t.size, titleBottom - realH + t.size);
        fill(rgb(ink)); font(t.size, "800");
        let y = titleY;
        t.lines.forEach((l, i) => { if (i) y += t.size + 10; ctx.fillText(l, pad, y); });

        y = titleY + realH + 16;
        fill(rgb(ink, 0.55)); font(19, "500");
        ctx.fillText(clipText(placeRaw, availW, 19), pad, y);
        y += 32;

        fill(rgb(ink, 0.72)); font(19, "500");
        const hl = (a.highlights || []).slice(0, 3).map((hh) => (hh[0] || "").slice(0, 24)).filter(Boolean);
        const list = hl.length ? hl.map((l) => "· " + l) : ["· " + dateTxt + " 出发", "· 集合：" + (a.meeting || "待定")];
        list.forEach((l) => { if (y + 26 <= listEnd) { ctx.fillText(clipText(l, availW, 19), pad, y); y += 32; } });
      } else if (sizeKey === "square") {
        const split = Math.round(w * 0.55);
        drawPosterBg(ctx, split, h, pal, img, posterFocus);
        fill(rgb(paper)); ctx.fillRect(split, 0, w - split, h);

        const ix = split + 34, rightEdge = w - 34;
        const availW = rightEdge - ix;
        const bottomY = h - 36;
        const priceMaxW = availW - 160 - 20;
        priceRow(ix, bottomY, 38, 15, priceMaxW);
        brandBlockRight(rightEdge, bottomY - 32, 150, false);

        const listEnd = bottomY - 66;
        const titleBottom = listEnd - 14;

        pill(a.type || "活动", ix, 40, rgb(accent), "#fff", 17, 12, 28, 14);

        const t = fitTitle(titleRaw, availW, 3, [36, 32, 28, 24]);
        const realH = t.lines.length * t.size + (t.lines.length - 1) * 8;
        const titleY = Math.min(40 + 28 + 14 + t.size, titleBottom - realH + t.size);
        fill(rgb(ink)); font(t.size, "800");
        let y = titleY;
        t.lines.forEach((l, i) => { if (i) y += t.size + 8; ctx.fillText(l, ix, y); });

        y = titleY + realH + 14;
        fill(rgb(ink, 0.55)); font(17, "500");
        ctx.fillText(clipText(dateTxt + "  ·  " + placeRaw, availW, 17), ix, y);
        y += 28;

        fill(rgb(ink, 0.72)); font(17, "500");
        const hl = (a.highlights || []).slice(0, 3).map((hh) => (hh[0] || "").slice(0, 24)).filter(Boolean);
        const list = hl.length ? hl.map((l) => "· " + l) : ["· 难度 " + diffTxt];
        list.forEach((l) => { if (y + 24 <= listEnd) { ctx.fillText(clipText(l, availW, 17), ix, y); y += 28; } });
      } else { // wide
        const split = Math.round(w * 0.54);
        drawPosterBg(ctx, split, h, pal, img, posterFocus);
        fill(rgb(paper)); ctx.fillRect(split, 0, w - split, h);

        const ix = split + 40, rightEdge = w - 40;
        const availW = rightEdge - ix;
        const bottomY = h - 36;
        const priceMaxW = availW - 160 - 20;
        priceRow(ix, bottomY, 40, 16, priceMaxW);
        brandBlockRight(rightEdge, bottomY - 32, 150, false);

        const listEnd = bottomY - 66;
        const titleBottom = listEnd - 14;

        const tagW = pill(a.type || "活动", ix, 42, rgb(accent), "#fff", 17, 12, 28, 14);
        fill(rgb(ink, 0.45)); font(17, "600");
        ctx.fillText(dateTxt, ix + tagW + 12, 42 + 20);

        const t = fitTitle(titleRaw, availW, 2, [38, 34, 30, 26]);
        const realH = t.lines.length * t.size + (t.lines.length - 1) * 9;
        const titleY = Math.min(42 + 28 + 16 + t.size, titleBottom - realH + t.size);
        fill(rgb(ink)); font(t.size, "800");
        let y = titleY;
        t.lines.forEach((l, i) => { if (i) y += t.size + 9; ctx.fillText(l, ix, y); });

        y = titleY + realH + 14;
        fill(rgb(ink, 0.55)); font(18, "500");
        ctx.fillText(clipText(placeRaw, availW, 18), ix, y);
        y += 30;

        fill(rgb(ink, 0.72)); font(18, "500");
        const hl = (a.highlights || []).slice(0, 3).map((hh) => (hh[0] || "").slice(0, 24)).filter(Boolean);
        const list = hl.length ? hl.map((l) => "· " + l) : ["· 难度 " + diffTxt, "· 适合 " + (a.ageRange || "18—55岁")];
        list.forEach((l) => { if (y + 26 <= listEnd) { ctx.fillText(clipText(l, availW, 18), ix, y); y += 30; } });
      }
    }
  }
  function showPublishSuccess(id) {
    const a = getActivity(id); if (!a) return;
    const m = document.createElement("div");
    m.className = "modal-mask";
    m.innerHTML = `<div class="modal">
      <button class="modal-close-x" data-action="finishPublish" title="关闭并返回活动管理">${ICON("x")}</button>
      <div class="modal-body" style="text-align:center">
        <div class="success-ic" style="margin:6px auto 14px">${ICON("check")}</div>
        <h2 style="margin:0 0 6px">活动页面已发布 🎉</h2>
        <p class="muted" style="margin:0 0 14px">《${esc(a.title)}》已上线，以下素材已全部生成</p>
        <div class="pub-center">
          <div class="pc-item"><span class="pc-ic">${ICON("check")}</span>报名入口已生成</div>
          <div class="pc-item"><span class="pc-ic">${ICON("check")}</span>微信群文案已生成</div>
          <div class="pc-item"><span class="pc-ic">${ICON("check")}</span>朋友圈文案已生成</div>
          <div class="pc-item"><span class="pc-ic">${ICON("check")}</span>小红书文案已生成</div>
          <div class="pc-item"><span class="pc-ic">${ICON("check")}</span>3 款宣传海报已生成</div>
        </div>
        <div class="col gap-10" style="margin-top:18px">
          <button class="btn btn-primary btn-block" data-action="openFront" data-id="${a.id}">查看活动详情</button>
          <button class="btn btn-soft btn-block" data-action="share" data-id="${a.id}">${ICON("share")} 生成海报 / 复制文案去分享</button>
          <button class="btn btn-ghost btn-block" data-action="finishPublish">返回活动管理</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener("click", (e) => { if (e.target === m) closePublishSuccess(); });
  }
  function closePublishSuccess() {
    const m = document.querySelector(".modal-mask"); if (m) m.remove();
    showView("list");
  }

  function openShare(id, mode) {
    const isFront = mode === "front";
    const a = getActivity(id); if (!a) return;
    let m = document.createElement("div");
    m.className = "modal-mask";
    let pStyle = isFront ? "mood" : "brand", pSize = "vertical";
    let pPhotoIdx = Math.max(0, Math.min((a.photos || []).length - 1, a.posterPhotoIndex || 0));
    const photoPicker = (a.photos || []).length > 1 ? `
      <div class="seg-label">主图</div>
      <div class="poster-photo-picker" id="posterPhotoPicker">
        ${(a.photos || []).map((url, i) => `<button type="button" class="photo-thumb ${i === pPhotoIdx ? 'active' : ''}" data-poster="photo" data-idx="${i}" aria-label="选择第 ${i+1} 张作为主图"><img src="${esc(url)}" alt="" draggable="false"></button>`).join("")}
      </div>
    ` : "";
    if (isFront) {
      // 前端用户：仅生成海报 + 直接分享到微信 / 朋友圈（不展示多平台文案）
      m.innerHTML = `<div class="modal modal-wide">
        <div class="modal-head"><h3>生成专属海报 · 邀好友一起玩</h3><button class="icon-btn" data-action="closeModal">${ICON("x")}</button></div>
        <div class="modal-body">
          <div class="poster-panel">
            <div class="poster-controls">
              <div class="seg-label">风格</div>
              <div class="seg" id="posterStyles">
                <button class="seg-btn active" data-poster="style" data-val="mood">氛围视觉</button>
                <button class="seg-btn" data-poster="style" data-val="brand">品牌简约</button>
              </div>
              <div class="seg-label">尺寸</div>
              <div class="seg" id="posterSizes">
                <button class="seg-btn active" data-poster="size" data-val="vertical">竖版 3:4</button>
                <button class="seg-btn" data-poster="size" data-val="square">方形 1:1</button>
                <button class="seg-btn" data-poster="size" data-val="wide">横版 16:9</button>
              </div>
              ${photoPicker}
            </div>
            <div class="poster-stage"><canvas class="poster-canvas" id="posterCanvas"></canvas></div>
            <div class="share-actions">
              <button class="btn btn-primary" data-poster="share-wx">${ICON("message")} 分享到微信</button>
              <button class="btn btn-soft" data-poster="share-moments">${ICON("users")} 分享到朋友圈</button>
              <button class="btn btn-ghost" data-poster="save">${ICON("download")} 保存海报</button>
            </div>
            <p class="share-tip">保存海报后，在微信中发送给好友或分享到朋友圈即可。</p>
          </div>
        </div>
      </div>`;
    } else {
      // 后台商家：完整文案（微信 / 朋友圈 / 小红书 / 公众号 / 口播）+ 海报
      const channels = [["wechat", "微信群招募文案"], ["moments", "朋友圈文案"], ["xhs", "小红书文案"], ["gzh", "公众号摘要"], ["voice", "口播文案"]];
      m.innerHTML = `<div class="modal modal-wide">
        <div class="modal-head"><h3>分享素材 · 文案 + 海报</h3><button class="icon-btn" data-action="closeModal">${ICON("x")}</button></div>
        <div class="modal-body">
          <div class="share-grid">
            ${channels.map(([t, l]) => {
              const key = "share" + t.charAt(0).toUpperCase() + t.slice(1);
              const txt = esc(a[key] || "");
              return `<div class="share-block" data-share-type="${t}">
                <div class="row between">
                  <b>${l}</b>
                  <div class="share-block-actions">
                    <button class="copy-btn" data-action="copyText" data-id="${a.id}" data-type="${t}">复制</button>
                    <button class="copy-btn" data-action="regenShareCopy" data-id="${a.id}" data-type="${t}">${ICON("refresh")}换一版</button>
                    <button class="copy-btn" data-action="editShareCopy" data-id="${a.id}" data-type="${t}">编辑</button>
                  </div>
                </div>
                <div class="share-card" data-share-card="${t}">${txt}</div>
              </div>`;
            }).join("")}
          </div>
          <div class="poster-panel">
            <div class="poster-controls">
              <div class="seg-label">风格</div>
              <div class="seg" id="posterStyles">
                <button class="seg-btn active" data-poster="style" data-val="brand">品牌简约</button><button class="seg-btn" data-poster="style" data-val="mood">氛围视觉</button><button class="seg-btn" data-poster="style" data-val="recruit">信息招募</button>
              </div>
              <div class="seg-label">尺寸</div>
              <div class="seg" id="posterSizes">
                <button class="seg-btn active" data-poster="size" data-val="vertical">竖版 3:4</button>
                <button class="seg-btn" data-poster="size" data-val="square">方形 1:1</button>
                <button class="seg-btn" data-poster="size" data-val="wide">横版 16:9</button>
              </div>
              ${photoPicker}
            </div>
            <div class="poster-stage"><canvas class="poster-canvas" id="posterCanvas"></canvas></div>
            <button class="btn btn-primary poster-save" data-poster="save">${ICON("download")} 保存海报图片</button>
          </div>
        </div>
      </div>`;
    }
    document.body.appendChild(m);
    m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
    const canvas = m.querySelector("#posterCanvas");
    function drawPosterSafe(img, focus, logoImg) {
      try {
        drawPoster(canvas, a, pStyle, pSize, mode, img, focus, logoImg);
      } catch (err) {
        console.error("[drawPoster]", err);
        const S = POSTER_SIZES[pSize] || POSTER_SIZES.vertical;
        canvas.width = S.w; canvas.height = S.h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, S.w, S.h);
        ctx.fillStyle = "#c53030"; ctx.font = "bold 28px sans-serif"; ctx.textBaseline = "alphabetic";
        const lines = ["海报渲染失败", err.message || String(err), "请尝试切换风格/尺寸重试"];
        let y = S.h / 2 - (lines.length - 1) * 22;
        lines.forEach((l) => { ctx.fillText(l, 40, y); y += 44; });
        toast("海报渲染失败，请重试");
      }
    }
    const redraw = () => {
      const photoSrc = (a.photos || [])[pPhotoIdx] || (a.photos || [])[0];
      const logoSrc = (state.brand || {}).logo;
      const logoPromise = logoSrc ? loadImage(logoSrc).catch(() => null) : Promise.resolve(null);
      // 先画占位，避免空白等待
      const S = POSTER_SIZES[pSize] || POSTER_SIZES.vertical;
      canvas.width = S.w; canvas.height = S.h;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#f6f7f8"; ctx.fillRect(0, 0, S.w, S.h);
      ctx.fillStyle = "#9ca3af"; ctx.font = "24px sans-serif"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
      ctx.fillText("海报生成中...", S.w / 2, S.h / 2);
      ctx.textAlign = "left";
      const imgPromise = photoSrc ? loadImage(photoSrc).catch(() => null) : Promise.resolve(null);
      const focusPromise = photoSrc ? (PHOTO_FOCUS_CACHE.has(photoSrc) ? Promise.resolve(focusValue(photoSrc)) : analyzeImageFocus(photoSrc)) : Promise.resolve(null);
      Promise.all([imgPromise, logoPromise, focusPromise])
        .then(([img, logoImg, focus]) => {
          if (photoSrc && img && focus) PHOTO_FOCUS_CACHE.set(photoSrc, focus);
          drawPosterSafe(img, focus, logoImg);
        })
        .catch((err) => { console.error("[poster load]", err); drawPosterSafe(null, null, null); });
    };
    redraw();
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-poster]") || e.target.closest(".photo-thumb"); if (!b) return;
      const act = b.dataset.poster;
      if (act === "style") { pStyle = b.dataset.val; m.querySelectorAll("#posterStyles .seg-btn").forEach((x) => x.classList.toggle("active", x === b)); redraw(); }
      else if (act === "size") { pSize = b.dataset.val; m.querySelectorAll("#posterSizes .seg-btn").forEach((x) => x.classList.toggle("active", x === b)); redraw(); }
      else if (act === "photo") {
        pPhotoIdx = parseInt(b.dataset.idx, 10) || 0;
        a.posterPhotoIndex = pPhotoIdx;
        m.querySelectorAll("#posterPhotoPicker .photo-thumb").forEach((x) => x.classList.toggle("active", x === b));
        redraw(); toast("已切换主图");
      }
      else if (act === "save") {
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob); const link = document.createElement("a");
          link.href = url; link.download = "ClubOS_海报_" + a.type + "_" + Date.now() + ".png"; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000); toast("海报已保存到本地");
        }, "image/png");
      }
      else if (act === "share-wx") { shareViaWechat(a, canvas, false); }
      else if (act === "share-moments") { shareViaWechat(a, canvas, true); }
    });
  }

  // 前端用户「分享到微信 / 朋友圈」：优先唤起微信 JS-SDK 原生分享，否则保存海报并引导手动分享
  function shareViaWechat(a, canvas, toMoments) {
    if (typeof wx !== "undefined" && wx.ready && typeof wx.updateAppMessageShareData === "function") {
      const shareData = {
        title: a.title,
        desc: emotionLine(a),
        link: location.href,
        imgUrl: (a.photos || [])[a.posterPhotoIndex || 0] || (a.photos || [])[0] || "",
      };
      try {
        if (toMoments) wx.updateTimelineShareData({ title: a.title, link: location.href, imgUrl: shareData.imgUrl });
        else wx.updateAppMessageShareData(shareData);
        toast(toMoments ? "已唤起朋友圈分享" : "已唤起微信分享");
        return;
      } catch (e) { /* 回落到保存海报 */ }
    }
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = "ClubOS_海报_" + a.type + "_" + Date.now() + ".png"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(toMoments ? "海报已保存，去微信分享到朋友圈吧" : "海报已保存，去微信发给好友吧");
    }, "image/png");
  }

  /* ---------------- global listeners ---------------- */
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    handleClick(el.dataset.action, el);
  });
  document.addEventListener("input", (e) => {
    const listEl = e.target.closest("[data-bind-list]");
    if (listEl && state.draft) {
      const key = listEl.dataset.bindList;
      state.draft[key] = listEl.value.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      if (key === "feeExclude") state.draft.feeExcludeConfirmed = state.draft[key].length > 0;
      refreshPreview();
      return;
    }
    const el = e.target.closest("[data-bind]");
    if (el && state.draft) {
      const key = el.dataset.bind;
      state.draft[key] = el.value;
      const factKey = ({ date: "date", meeting: "meeting", meetTime: "meetTime", ageRange: "age", price: "price", days: "days", limit: "limit", type: "type", leaderName: "leaderInfo" })[key];
      if (factKey && String(el.value).trim()) confirmFact(state.draft, factKey);
      if (key === "type") {
        state.draft.type = normalizeType(state.draft.type);
        state.draft.pageStyle = PAGE_STYLE_MAP[state.draft.type] || "outdoor";
        if (state.draft.type === "亲子活动" || state.draft.type === "研学") state.draft.audience = ["亲子"];
        syncDerived(state.draft);
        rerenderEditor();
        return;
      }
      if (key === "date" || key === "days" || key === "ageRange") {
        if (key === "days") state.draft.days = Math.min(Math.max(parseInt(state.draft.days) || 1, 1), 7);
        if (key === "date") {
          state.draft.dateMD = state.draft.date ? toDateMD(state.draft.date) : state.draft.dateMD;
          // 首团日期变动时同步第一个团期
          if (state.draft.departures && state.draft.departures.length) {
            const first = state.draft.departures[0];
            const ymd = parseDateToYMD(state.draft.date);
            if (ymd) { first.date = ymd; first.dateMD = formatDepartureMD(ymd); first.weekDay = weekDayName(ymd); }
          }
        }
        if (key === "ageRange") { parseAgeRange(state.draft); state.draft.ageManual = true; updateAgeTag(el); }
        syncDerived(state.draft);
        refreshPreview();
        return;
      }
      refreshPreview();
      return;
    }
    const st = e.target.closest("[data-bind-section-title]");
    if (st && state.draft) {
      const key = st.dataset.bindSectionTitle;
      if (!state.draft.sectionTitles) state.draft.sectionTitles = {};
      state.draft.sectionTitles[key] = st.value;
      refreshPreview();
      return;
    }
    const ie = e.target.closest("[data-bind-itin]");
    if (ie && state.draft) {
      const di = +ie.dataset.day, ii = +ie.dataset.idx, k = ie.dataset.bindItin;
      const day = state.draft.itineraryDays[di];
      if (day && day.items[ii]) { day.items[ii][k] = ie.value; confirmFact(state.draft, "itinerary"); refreshPreview(); }
      return;
    }
    const spe = e.target.closest("[data-bind-sp]");
    if (spe && state.draft) {
      const i = +spe.dataset.bindSp, sub = spe.dataset.sub;
      if (!Array.isArray(state.draft.sellingPoints)) state.draft.sellingPoints = [];
      while (state.draft.sellingPoints.length <= i) state.draft.sellingPoints.push({ title: "", desc: "" });
      state.draft.sellingPoints[i][sub] = spe.value;
      refreshPreview();
      return;
    }
    const cf = e.target.closest("[data-bind-cf]");
    if (cf && state.draft) {
      const i = +cf.dataset.bindCf, k = cf.dataset.cfKey;
      if (!Array.isArray(state.draft.customFields)) state.draft.customFields = [];
      if (!state.draft.customFields[i]) state.draft.customFields[i] = { id: "cf" + Date.now() + "_" + i, label: "" };
      if (k === "required") state.draft.customFields[i][k] = cf.checked;
      else if (k === "options") state.draft.customFields[i][k] = cf.value.split(",").map((s) => s.trim()).filter(Boolean);
      else state.draft.customFields[i][k] = cf.value;
      refreshPreview();
      return;
    }
    const de = e.target.closest("[data-bind-dep]");
    if (de && state.draft) {
      const id = de.dataset.bindDep;
      const k = de.dataset.depKey;
      const dep = (state.draft.departures || []).find((x) => x.id === id);
      if (dep) {
        if (k === "price") dep.price = de.value === "" ? null : +de.value;
        else if (k === "status") dep.status = de.value;
        else if (k === "note") dep.note = de.value;
        saveState();
        refreshPreview();
      }
      return;
    }
    const te = e.target.closest("[data-bind-tier]");
    if (te && state.draft) {
      const tierId = te.dataset.bindTier;
      if (!state.draft.tierPrices) state.draft.tierPrices = {};
      state.draft.tierPrices[tierId] = te.value === "" ? null : +te.value;
      saveState();
      refreshPreview();
      return;
    }
    const be = e.target.closest("[data-brand]");
    if (be) {
      const k = be.dataset.brand;
      state.brand[k] = be.value;
      if (k === "primary") updateBrandColor();
      if (k === "name") { const n = $("#brandPrevName"); if (n) n.textContent = be.value; }
      if (k === "slogan") { const n = $("#brandPrevSlogan"); if (n) n.textContent = be.value; }
      if (k === "logoText") { const n = $("#brandPrevLogo"); if (n) n.textContent = be.value; }
    }
    // 首页装修：组件标题 / 入口项（不依赖 state.draft）
    const ct = e.target.closest("[data-bind-comp-title]");
    if (ct) {
      const i = +ct.dataset.bindCompTitle;
      const comp = (state.homeLayout && state.homeLayout.components || [])[i];
      if (comp) { comp.config = comp.config || {}; comp.config.title = ct.value; saveState(); refreshDecoPreview(); }
      return;
    }
    const elab = e.target.closest("[data-bind-entry-label]");
    if (elab) {
      const i = +elab.dataset.bindEntryLabel, j = +elab.dataset.j;
      const comp = (state.homeLayout && state.homeLayout.components || [])[i];
      if (comp && comp.config && comp.config.items && comp.config.items[j]) { comp.config.items[j].label = elab.value; saveState(); refreshDecoPreview(); }
      return;
    }
    const eic = e.target.closest("[data-bind-entry-icon]");
    if (eic) {
      const i = +eic.dataset.bindEntryIcon, j = +eic.dataset.j;
      const comp = (state.homeLayout && state.homeLayout.components || [])[i];
      if (comp && comp.config && comp.config.items && comp.config.items[j]) { comp.config.items[j].icon = eic.value; saveState(); refreshDecoPreview(); }
      return;
    }
    // 会员管理后台：订单筛选输入实时写 state
    const mof = e.target.closest("[data-action=\"membershipOrderFilter\"]");
    if (mof) {
      const field = mof.dataset.field;
      state.membershipOrderFilters = state.membershipOrderFilters || {};
      state.membershipOrderFilters[field] = mof.type === "checkbox" ? mof.checked : mof.value;
      return;
    }
    // 会员管理后台：条件数值输入
    const mcv = e.target.closest("[data-action=\"membershipCondValue\"]");
    if (mcv) {
      const cfg = state.membershipSettings;
      const c = cfg.conditions[mcv.dataset.key]; if (c) c.value = +mcv.value || 0;
      return;
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const action = el.dataset.action;
    if (action === "membershipPageGo") { handleClick(action, el); e.preventDefault(); }
  });
