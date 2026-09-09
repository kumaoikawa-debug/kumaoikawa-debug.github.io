/* ClubOS Platform — modular build (split from monolithic app.js v81).
   Loaded as classic <script> in order; shared global scope, no bundler. */
  function renderAISettings() {
    const key = getAIKey();
    const provider = getAIProvider();
    return `<div class="card card-pad" style="max-width:640px">
      <div class="eyebrow">AI 大模型</div>
      <h2 class="section-title" style="margin:8px 0 4px">AI 解析与文案设置</h2>
      <p class="muted small" style="margin:0 0 18px">一句话生成活动已改为「真 AI（LLM）+ 结构化 JSON」。请填写你的模型 API Key，Key 仅保存在本机浏览器（localStorage），不会上传到任何服务器。</p>
      <div class="field"><label>服务商</label>
        <select class="input" id="aiProvider">
          <option value="deepseek" ${provider === "deepseek" ? "selected" : ""}>DeepSeek（deepseek-chat）</option>
          <option value="qwen" ${provider === "qwen" ? "selected" : ""}>阿里云百炼（qwen-plus）</option>
        </select>
      </div>
      <div class="field"><label>API Key</label>
        <input class="input" id="aiKey" type="password" placeholder="sk-... 或 DashScope Key" value="${esc(key)}" autocomplete="off">
        <div class="hint">DeepSeek：platform.deepseek.com ｜ 通义：dashscope.console.aliyun.com</div>
      </div>
      <div class="row gap-10" style="margin-top:6px">
        <button class="btn btn-primary btn-lg" data-action="saveAI">${ICON("check")} 保存并设置</button>
        <button class="btn btn-ghost" data-action="testAI">${ICON("sparkles")} 测试连接</button>
      </div>
      <div class="tiny muted" style="margin-top:14px">说明：浏览器直连模型 API 可能受 CORS 跨域限制；若「测试连接」失败，请改用你的后端代理地址（在代码 aiEndpoint 处替换为你自己的代理）。</div>
    </div>`;
  }
  function saveAISettings() {
    const keyEl = $("#aiKey"); const provEl = $("#aiProvider");
    if (keyEl) setAIKey(keyEl.value.trim());
    if (provEl) setAIProvider(provEl.value);
    toast("AI 设置已保存");
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
    const be = e.target.closest("[data-brand]");
    if (be) {
      const k = be.dataset.brand;
      state.brand[k] = be.value;
      if (k === "primary") updateBrandColor();
      if (k === "name") { const n = $("#brandPrevName"); if (n) n.textContent = be.value; }
      if (k === "slogan") { const n = $("#brandPrevSlogan"); if (n) n.textContent = be.value; }
      if (k === "logoText") { const n = $("#brandPrevLogo"); if (n) n.textContent = be.value; }
    }
  });

