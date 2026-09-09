/* ClubOS Platform — modular build (split from monolithic app.js v81).
   Loaded as classic <script> in order; shared global scope, no bundler. */
  function showView(view, params) {
    if (state.view && state.view !== view) backStack.push(state.view);
    state.view = view; state.params = params || {};
    const app = $("#app");
    if (view === "login") { app.innerHTML = renderLogin(); return; }
    if (view === "platformLogin") { app.innerHTML = renderPlatformLogin(); return; }
    const backend = ["dashboard", "create", "advice", "editor", "list", "signups", "brand", "ai", "membership", "analytics", "mallConsole"];
    if (backend.includes(view)) {
      let content = "";
      if (view === "dashboard") content = renderDashboard();
      else if (view === "create") content = renderCreate();
      else if (view === "advice") content = renderContentAdvice();
      else if (view === "editor") content = renderEditor();
      else if (view === "list") content = renderList();
      else if (view === "signups") content = renderSignups();
      else       if (view === "brand") content = renderBrand();
      if (view === "brand") bindBrandExtras();
      else if (view === "membership") {
        if (isFrontMode()) { app.innerHTML = renderMembershipH5(); window.scrollTo(0, 0); return; }
        content = renderMembership();
      }
      else if (view === "ai") content = renderAISettings();
      else if (view === "analytics") content = renderAnalytics();
      else if (view === "mallConsole") content = renderMall();
      app.innerHTML = renderShell(content, view);
      if (view === "editor") bindEditorExtras();
      updateBrandColor();
      return;
    }
    // platform 总后台
    const platform = ["platformAudit", "platformClubs", "platformToken", "platformMall", "platformAftersale", "platformData", "platformSettle", "platformPromo"];
    if (platform.includes(view)) {
      let content = "";
      if (view === "platformAudit") content = renderPlatformAudit();
      else if (view === "platformClubs") content = renderPlatformClubs();
      else if (view === "platformToken") content = renderPlatformToken();
      else if (view === "platformMall") content = renderPlatformMall();
      else if (view === "platformData") content = renderPlatformData();
      else if (view === "platformAftersale") content = renderPlatformAftersale();
      else if (view === "platformPromo") content = renderPlatformPromo();
      else if (view === "platformSettle") content = renderPlatformSettle();
      app.innerHTML = renderPlatformShell(content, view);
      return;
    }
    // frontend
    if (view === "frontHome") { app.innerHTML = renderFrontHome(); initBentoScroll(); initHeroCarousel(); }
    else if (view === "detail") app.innerHTML = wrapPhone(renderActivityPhone(getActivity(params.id)), true);
    else if (view === "signup") app.innerHTML = renderSignupPage(params.id);
    else if (view === "success") app.innerHTML = renderSuccess(params.id, params.signupId);
    else if (view === "mySignups") app.innerHTML = renderMySignups();
    else if (view === "mall") app.innerHTML = renderMall();
    else if (view === "mallAdmin") { state.mallView = "admin"; app.innerHTML = renderMall(); }
    else if (view === "mallCommission") app.innerHTML = renderMallCommission();
    else if (view === "mallProduct") app.innerHTML = renderMallProduct(getProduct(params.id));
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
      case "platformDoLogin": {
        const acc = $("#pfLoginPhone").value.trim();
        const code = $("#pfLoginCode").value.trim();
        if (!acc) return toast("请输入平台账号");
        if (code !== "1234") return toast("验证码不正确（Demo：1234）");
        state.platformAccount = acc;
        saveState();
        toast("平台账号登录成功");
        showView("platformAudit"); window.scrollTo(0, 0); break;
      }
      case "platformLogout": { state.platformAccount = null; saveState(); showView("platformLogin"); break; }
      case "sendCode": toast("验证码已发送（Demo：1234）"); break;
      case "generate": generateFromInput(); break;
      case "voice": toast("语音输入为视觉占位，Demo 中请直接输入文字"); break;
      case "paste": { const ta = $("#createInput"); if (ta) { ta.value = PASTE_SAMPLE; ta.focus(); } toast("已填入一段示例旧文案"); break; }
      case "example": { const ta = $("#createInput"); if (ta) { ta.value = d.text; } else { state.draft = blankActivity(); state.draft.raw = d.text; parseActivityWithAI(d.text).then((json) => { if (json && !json._error && !json._needKey) applyAIResult(json, state.draft); showView("editor"); }); } break; }
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
        if (!getAIKey()) { toast("请先在「AI 设置」填写 Key 才能换文案"); break; }
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
        if (!getAIKey()) return toast("请先填写 API Key");
        toast("正在测试连接…");
        parseActivityWithAI(SAMPLE_FULL).then((json) => {
          if (json && json._error) toast("测试失败：" + json._error);
          else if (json && json._needKey) toast("Key 未保存");
          else if (json && json.title) toast("连接成功：" + json.title.slice(0, 18));
          else toast("返回异常，请检查模型/Key");
        });
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
      case "addSP": { if (!Array.isArray(state.draft.sellingPoints)) state.draft.sellingPoints = []; state.draft.sellingPoints.push({ title: "", desc: "" }); rerenderEditor(); break; }
      case "delSP": { const di = +d.id; if (Array.isArray(state.draft.sellingPoints) && state.draft.sellingPoints[di]) { state.draft.sellingPoints.splice(di, 1); rerenderEditor(); } break; }
      case "addCustomField": { if (!Array.isArray(state.draft.customFields)) state.draft.customFields = []; state.draft.customFields.push({ id: "cf" + Date.now(), label: "", type: "text", required: false, placeholder: "" }); rerenderEditor(); break; }
      case "delCustomField": { const ci = +d.id; if (Array.isArray(state.draft.customFields) && state.draft.customFields[ci]) { state.draft.customFields.splice(ci, 1); rerenderEditor(); } break; }
      case "delGear": {
        if (!state.draft) break;
        const name = d.name;
        state.draft.gear = (state.draft.gear || []).filter((g) => (typeof g === "string" ? g : g.name) !== name);
        state.draft.gearManual = (state.draft.gearManual || []).filter((x) => x !== name);
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
        if (getAIKey()) { toast("AI 正在重写文案…"); regenerateCopy(state.draft).then((ok) => { if (ok) toast("已重新生成文案"); else toast("AI 重写失败，请检查 Key"); rerenderEditor(); }); }
        else toast("请先在「AI 设置」填写 Key 以重新生成");
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
        showView("membership"); window.scrollTo(0, 0);
        break;
      }
      case "simulateApproveClub": {
        state.clubStatus = "approved";
        saveState();
        const m = document.querySelector(".modal-mask"); if (m) m.remove();
        toast("平台已审核通过，俱乐部版全部功能已开通");
        showView("membership"); window.scrollTo(0, 0);
        break;
      }
      case "membership": showView("membership"); window.scrollTo(0, 0); break;
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
      case "enterPlatform": { showView("platformAudit"); window.scrollTo(0, 0); break; }
      case "platformApproveClub": { const pc = (state.platformClubs || []).find((x) => x.id === d.id); if (pc) { pc.status = "approved"; pc.mallEnabled = true; saveState(); toast("已通过入驻审核，已开通商城权限与基础 AI额度（Demo）"); } showView("platformAudit"); break; }
      case "platformRejectClub": { const pc = (state.platformClubs || []).find((x) => x.id === d.id); if (pc) { pc.status = "rejected"; pc.mallEnabled = false; saveState(); toast("已拒绝入驻申请（Demo）"); } showView("platformAudit"); break; }
      case "platformClubDetail": { state.platformClubDetailId = d.id; showView("platformClubs"); break; }
      case "platformClubBack": { state.platformClubDetailId = null; showView("platformClubs"); break; }
      case "platformTokenFocus": { state.platformClubDetailId = null; showView("platformToken"); break; }
      case "platformTogglePerm": { const pc = (state.platformClubs || []).find((x) => x.id === d.id); if (pc) { pc.permissions[d.perm] = !pc.permissions[d.perm]; saveState(); toast((pc.permissions[d.perm] ? "已开通" : "已关闭") + "：" + ((PLATFORM_PERMS.find((p) => p.key === d.perm)) || {}).label); } showView("platformClubs"); break; }
      case "platformToggleMall": { const pc = (state.platformClubs || []).find((x) => x.id === d.id); if (pc) { pc.mallEnabled = !pc.mallEnabled; saveState(); toast(pc.mallEnabled ? "已开通该俱乐部商城权限" : "已关闭该俱乐部商城权限"); } showView("platformClubs"); break; }
      case "platformTokenAdd": { const pc = (state.platformClubs || []).find((x) => x.id === d.id); if (pc) { const amt = +d.amt; if (amt === -1) { pc.aiCredit.gift = 0; if (pc.id === "club_demo") state.aiCredit.gift = 0; } else { pc.aiCredit[d.kind] = (pc.aiCredit[d.kind] || 0) + amt; if (pc.id === "club_demo") { state.aiCredit[d.kind] = (state.aiCredit[d.kind] || 0) + amt; } } saveState(); toast("已调整 " + pc.name + " 的 AI额度"); } showView(state.view === "platformClubs" ? "platformClubs" : "platformToken"); break; }
      case "platformTokenBatch": { const amt = parseInt(((document.getElementById("platformTokenBatch") || {}).value || "0"), 10); if (amt > 0) { (state.platformClubs || []).filter((c) => c.status === "approved").forEach((c) => { c.aiCredit.base = (c.aiCredit.base || 0) + amt; if (c.id === "club_demo") state.aiCredit.base = (state.aiCredit.base || 0) + amt; }); saveState(); toast("已为全部已开通俱乐部补充基础 AI额度 " + amt); } else toast("请输入有效额度"); showView("platformToken"); break; }
      case "platformMallTab": { state.platformMallTab = d.tab; showView("platformMall"); break; }
      case "platformAftersaleTab": { state.platformAftersaleTab = d.tab; showView("platformAftersale"); break; }
      case "platformSyncSupplier": { const sp = (state.suppliers || []).find((x) => x.id === d.id); if (sp) { sp.syncStatus = "synced"; sp.lastSync = Date.now(); saveState(); toast("已同步 " + sp.name + " 的商品与库存（Demo）"); } showView("platformMall"); break; }
      case "platformPauseSupplier": { const sp = (state.suppliers || []).find((x) => x.id === d.id); if (sp) { sp.syncStatus = "paused"; saveState(); toast("已暂停对接 " + sp.name); } showView("platformMall"); break; }
      case "platformShipOrder": { const o = (state.mallOrders || []).find((x) => x.id === d.id); if (o) { o.logistics = "shipped"; o.trackingNo = "SF" + String(Date.now()).slice(-10); saveState(); toast("已发货，运单 " + o.trackingNo); } showView("platformMall"); break; }
      case "platformSignOrder": { const o = (state.mallOrders || []).find((x) => x.id === d.id); if (o) { o.logistics = "signed"; saveState(); toast("已签收"); } showView("platformMall"); break; }
      case "platformCompleteOrder": { const o = (state.mallOrders || []).find((x) => x.id === d.id); if (o && o.logistics === "signed") { o.logistics = "done"; saveState(); toast("订单已标记完成，交易闭环"); } showView("platformMall"); break; }
      case "openMall": { state.mallView = "browse"; showView("mall"); break; }
      case "mallConsole": { state.mallView = "browse"; showView("mallConsole"); window.scrollTo(0, 0); break; }
      case "mallAdmin": { state.mallView = "admin"; state.mallEditId = null; showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin"); break; }
      case "mallBack": { state.mallView = "browse"; state.mallEditId = null; showView("mall"); break; }
      case "mallProduct": {
        if (d.srctype) state._mallSource = { type: d.srctype, id: d.srcid || "" };
        showView("mallProduct", { id: d.id }); break;
      }
      case "mallRecEdit": { state.mallView = "browse"; showView("mall"); toast("在商品详情点击「加入我的推荐货架」即可"); break; }
      case "mallToggleRec": {
        const id = d.id; const i = state.myRecs.indexOf(id);
        if (i >= 0) state.myRecs.splice(i, 1); else state.myRecs.unshift(id);
        saveState(); showView("mallProduct", { id }); break;
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
      case "openMallCommission": { state.mallView = "commission"; showView("mallCommission"); break; }
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
        if (state.mallView === "admin") showView(isPlatformView(state.view) ? "platformMall" : "mallAdmin"); else if (isPlatformView(state.view)) showView("platformMall"); else showView("mallCommission"); break;
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
      case "platformAftersaleAccept": {
        const a = (state.aftersales || []).find((x) => x.id === d.id);
        if (a && a.status === "pending") { a.status = "processing"; saveState(); toast("已受理，工单进入处理中"); }
        showView("platformAftersale"); break;
      }
      case "platformAftersaleResolve": {
        const a = (state.aftersales || []).find((x) => x.id === d.id);
        if (a && a.status === "processing") {
          a.status = "done"; a.resolvedAt = Date.now();
          let msg = "售后工单已标记完成";
          if (a.type === "refund" || a.type === "return") {
            const ord = (state.mallOrders || []).find((o) => o.clubId === a.clubId && !o.refunded && (o.items || []).some((it) => it.title === a.product));
            if (ord && ord.commissionStatus !== "reversed") {
              const prev = ord.commissionStatus;
              ord.commissionStatus = "reversed"; ord.refunded = true;
              msg = `售后（${a.type === "refund" ? "仅退款" : "退货退款"}）闭环，关联订单佣金由「${COMM_STATUS_LABEL[prev] || prev}」冲销归零`;
            } else { msg = "售后闭环，关联订单已冲销或无可冲销佣金"; }
          } else if (a.type === "exchange") { msg = "换货工单闭环（不影响佣金）"; }
          saveState(); toast(msg);
        }
        showView("platformAftersale"); break;
      }
      case "platformAftersaleReject": {
        const a = (state.aftersales || []).find((x) => x.id === d.id);
        if (a) { a.status = "rejected"; a.resolvedAt = Date.now(); saveState(); toast("已拒绝该售后申请"); }
        showView("platformAftersale"); break;
      }
      case "promoTab": { state.promoTab = d.tab; showView("platformPromo"); break; }
      case "promoNewCampaign": {
        const title = window.prompt("活动名称（如：冬季冰雪节）") || "";
        if (!title.trim()) break;
        (state.promoCampaigns = state.promoCampaigns || []).push({ id: uid(), title: title.trim(), channel: "全平台", scope: "all", startAt: "2026-10-01", endAt: "2026-10-15", status: "scheduled", exposure: 0, orders: 0 });
        saveState(); toast("已新建营销活动（Demo）"); showView("platformPromo"); break;
      }
      case "promoNewCoupon": {
        const title = window.prompt("平台券名称（如：新人满 300 减 80）") || "";
        if (!title.trim()) break;
        (state.promoCoupons = state.promoCoupons || []).push({ id: uid(), title: title.trim(), type: "reduce", threshold: 300, value: 80, total: 1000, claimed: 0, used: 0, status: "active" });
        saveState(); toast("已新建平台券（Demo）"); showView("platformPromo"); break;
      }
      case "promoToggleCampaign": { const c = (state.promoCampaigns || []).find((x) => x.id === d.id); if (c) { c.status = c.status === "paused" ? "scheduled" : "paused"; saveState(); toast(c.status === "paused" ? "已暂停" : "已启用"); } showView("platformPromo"); break; }
      case "promoToggleCoupon": { const c = (state.promoCoupons || []).find((x) => x.id === d.id); if (c) { c.status = c.status === "active" ? "paused" : "active"; saveState(); toast(c.status === "active" ? "已启用" : "已暂停"); } showView("platformPromo"); break; }
      case "promoApproveDist": { const d2 = (state.distributors || []).find((x) => x.id === d.id); if (d2) { d2.status = "active"; saveState(); toast("分销员已通过审核"); } showView("platformPromo"); break; }
      case "promoDownloadMat": { toast("素材已加入下载队列（Demo）"); break; }
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
      case "copyText": copyText(d.id, d.type); break;
      case "regenShareCopy": {
        const a = getActivity(d.id); if (!a) break;
        if (!getAIKey()) { toast("请先在「AI 设置」填写 Key 才能换文案"); break; }
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
      case "mySignups": showView("mySignups"); break;
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
      case "addDeparture": {
        if (!state.draft) break;
        const dateInput = $("#depDateInput");
        const priceInput = $("#depPriceInput");
        const ymd = dateInput ? dateInput.value : "";
        if (!ymd) { toast("请先选择日期"); break; }
        state.draft.departures = state.draft.departures || [];
        const d = departureFromDate(ymd, priceInput && priceInput.value ? +priceInput.value : state.draft.price);
        if (d) {
          state.draft.departures.push(d);
          state.draft.departures.sort((x, y) => x.date.localeCompare(y.date));
          syncDepartures(state.draft);
          saveState();
          rerenderEditor();
        }
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
    if (!getAIKey()) { toast("请先在「AI 设置」填写 DeepSeek API Key 以启用 AI 生成"); openAISettings(); return; }
    state.draft = blankActivity();
    state.draft.raw = text;
    showGenerating();
    parseActivityWithAI(text).then((json) => {
      if (!json || json._needKey) { toast("请先在「AI 设置」填写 DeepSeek API Key"); openAISettings(); return; }
      if (json._error) { toast("AI 解析失败：" + json._error + "（可在 AI 设置更换 Key / 模型）"); return; }
      applyAIResult(json, state.draft);
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
      if (getAIKey()) { toast("AI 正在重写文案…"); regenerateCopy(a).then((ok) => { if (ok) toast("文案已更新"); else toast("AI 重写失败，请检查 Key"); rerenderEditor(); }); }
      else toast("请先在「AI 设置」填写 Key 以重写文案");
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
