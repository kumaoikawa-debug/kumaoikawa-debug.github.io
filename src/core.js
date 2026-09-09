/* ============================================================
   ClubOS Demo V1.0 — modular web app (vanilla JS, mock AI)
   代码已拆分为 src/ 下多文件 classic script（共享全局作用域、无构建）：
     core / ai / activities / members / mall / front / shell / boot
   加载顺序见各 HTML 入口（index/front/admin），boot.js 最后执行 init。
   Loop: 一句话创建 → AI 识别 → 确认/微调 → 上传照片 →
         生成 → 手机端实时预览 → 发布 → 前端报名 → 成功 → 后台名单
   ============================================================ */
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const curYear = () => new Date().getFullYear();
  const uid = () => "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function addH(t, h) {
    let [hh, mm] = t.split(":").map(Number);
    let total = Math.round(hh * 60 + mm + h * 60);
    hh = Math.floor(total / 60) % 24; mm = total % 60;
    return String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
  }
  function toDateMD(dstr) {
    if (!dstr) return dstr;
    const iso = dstr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (iso) return (+iso[2]) + "月" + (+iso[3]) + "日";
    const m = dstr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (m) return `${m[2]}月${m[3]}日`;
    const m2 = dstr.match(/(\d{1,2})月(\d{1,2})日/);
    if (m2) return `${m2[1]}月${m2[2]}日`;
    const rel = resolveRelativeDate(dstr);
    if (rel) return toDateMD(rel);
    return dstr;
  }
  function formatDateYMD(d) {
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function curYM() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const WEEK_DAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  function parseDateToYMD(dstr) {
    if (!dstr) return "";
    const iso = dstr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (iso) return `${iso[1]}-${String(+iso[2]).padStart(2, "0")}-${String(+iso[3]).padStart(2, "0")}`;
    const m = dstr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (m) return `${m[1]}-${String(+m[2]).padStart(2, "0")}-${String(+m[3]).padStart(2, "0")}`;
    const m2 = dstr.match(/(\d{1,2})月(\d{1,2})日/);
    if (m2) return `${curYear()}-${String(+m2[1]).padStart(2, "0")}-${String(+m2[2]).padStart(2, "0")}`;
    const rel = resolveRelativeDate(dstr);
    if (rel) return parseDateToYMD(rel);
    return "";
  }
  function weekDayName(ymd) {
    if (!ymd) return "";
    const d = new Date(ymd + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    return WEEK_DAYS[d.getDay()];
  }
  function formatDepartureMD(ymd) {
    if (!ymd) return "";
    const d = new Date(ymd + "T00:00:00");
    if (isNaN(d.getTime())) return toDateMD(ymd);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }
  function formatDepartureSlash(ymd) {
    if (!ymd) return "";
    const d = new Date(ymd + "T00:00:00");
    if (isNaN(d.getTime())) return "";
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  }
  function departureFromDate(dstr, price) {
    const ymd = parseDateToYMD(dstr);
    if (!ymd) return null;
    return { id: uid(), date: ymd, dateMD: formatDepartureMD(ymd), weekDay: weekDayName(ymd), price: price || null, status: "open", note: "", signups: 0 };
  }
  function syncDepartures(a) {
    if (!a.departures) a.departures = [];
    // 旧活动只有 date/dateMD 没有 departures 时，自动生成一个默认团期
    if (!a.departures.length && (a.date || a.dateMD)) {
      const d = departureFromDate(a.date || a.dateMD, a.price);
      if (d) { a.departures.push(d); a.date = d.dateMD; a.dateMD = d.dateMD; }
    }
    // 保持活动顶层日期与第一个团期同步
    if (a.departures.length) {
      const first = a.departures[0];
      a.date = first.dateMD; a.dateMD = first.dateMD;
    }
  }
  function resolveRelativeDate(text) {
    if (!text) return null;
    const now = new Date();
    const day = now.getDay(); // 0=Sun ... 6=Sat
    const year = now.getFullYear();
    const saturdayOffset = 6 - day; // days until this Saturday (0 if today is Sat, -1 if Sun)
    const thisSaturday = addDays(now, saturdayOffset);
    const thisSunday = addDays(now, 7 - day);
    const nextSaturday = addDays(thisSaturday, 7);

    if (/本周六/.test(text)) return formatDateYMD(saturdayOffset >= 0 ? thisSaturday : nextSaturday);
    if (/本周日/.test(text)) return formatDateYMD(thisSunday);
    if (/下周末|下周/.test(text)) return formatDateYMD(nextSaturday);
    if (/周末|本周/.test(text)) return formatDateYMD(saturdayOffset >= 0 ? thisSaturday : nextSaturday);
    if (/今天/.test(text)) return formatDateYMD(now);
    if (/明天/.test(text)) return formatDateYMD(addDays(now, 1));
    if (/后天/.test(text)) return formatDateYMD(addDays(now, 2));
    if (/国庆/.test(text)) return `${year}年10月1日`;
    if (/中秋/.test(text)) {
      const map = { 2025: "10月6日", 2026: "9月25日", 2027: "9月15日", 2028: "10月3日", 2029: "9月22日", 2030: "9月12日" };
      if (map[year]) return `${year}年${map[year]}`;
    }
    return null;
  }
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function darken(hex, f = 0.82) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  /* ---------------- icons ---------------- */
  const ICONS = {
    home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    sparkles: '<path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z"/><path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z"/>',
    list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    palette: '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="9" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16" cy="9" r="1"/><circle cx="17" cy="13" r="1"/><circle cx="7" cy="13" r="1"/>',
    crown: '<path d="M3 7l4 4 5-7 5 7 4-4-2 13H5z"/>',
    "arrow-left": '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v13"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    x: '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    mic: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v4"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
    photo: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
    tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><path d="M7 7h.01"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
    "map-pin": '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    signal: '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/>',
    "bar-chart": '<path d="M4 20V12"/><path d="M10 20V6"/><path d="M16 20v-6"/><path d="M22 20H2"/>',
    "shopping-bag": '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    trending: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    "trending-up": '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    star: '<path d="M12 2l3 6.5 7 .7-5.2 4.8 1.5 7L12 17l-6.3 3.8 1.5-7L2 9.2l7-.7z"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-6 7-9 16-9 0 9-3 16-9 16z"/><path d="M4 20c4-4 7-6 12-9"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.9 4.9l1.4 1.4"/><path d="M17.7 17.7l1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.9 19.1l1.4-1.4"/><path d="M17.7 6.3l1.4-1.4"/>',
    "chevron-right": '<path d="M9 18l6-6-6-6"/>',
    message: '<path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.5 8.5 0 0 1 12 3a8.38 8.38 0 0 1 9 8.5z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    mountain: '<path d="M3 20h18L14 8l-3 5-2-3z"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    headphones: '<path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>',
    shoe: '<path d="M2 16v-2a2 2 0 0 1 2-2h10l6 4a2 2 0 0 1 2 2v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z"/>',
    umbrella: '<path d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path d="M12 12v8a2 2 0 0 0 4 0"/>',
    bag: '<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    food: '<path d="M5 3v7a2 2 0 0 0 2 2v9"/><path d="M19 3v9a2 2 0 0 1-2 2"/><path d="M17 3v4"/>',
    battery: '<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 10v4"/>',
    shirt: '<path d="M8 3l4 3 4-3 5 4-3 4-2-1v10H8V10L6 9z"/>',
    headlamp: '<path d="M3 18a9 9 0 0 1 18 0"/><circle cx="12" cy="14" r="2"/><path d="M12 12V8"/>',
    ruler: '<path d="M3 9l12 12 6-6L9 3z"/><path d="M9 9l1.5 1.5"/><path d="M12.5 12.5L14 14"/>',
    flame: '<path d="M12 2c1 3 4 4 4 8a4 4 0 0 1-8 0c0-1 .6-2 1.4-2.7C8.2 8 6 10.2 6 13.2A6 6 0 0 0 18 13c0-5-6-9-6-11z"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5.5-5.5 2 2-5.5z"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
    droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    bike: '<circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 3.5L8.5 17"/><path d="M12 9.5l4.5 2.5H19"/>',
    tent: '<path d="M12 2L2 20h20L12 2z"/><path d="M9 20v-6h6v6"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14"/><path d="M15 6v14"/>',
    utensils: '<path d="M3 2v7a3 3 0 0 0 3 3v10"/><path d="M21 2v20"/><path d="M18 2v7a3 3 0 0 0 3 3"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    ticket: '<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>',
    quote: '<path d="M6 17h3l2-4V7H5v6h3zM14 17h3l2-4V7h-6v6h3z"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h2"/><path d="M14 6h2"/><path d="M8 10h2"/><path d="M14 10h2"/><path d="M8 14h2"/><path d="M14 14h2"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h6"/>',
    store: '<path d="M3 9l1-4h16l1 4"/><path d="M3 9h18"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M10 20v-6h4v6"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M21 7H5a2 2 0 0 0 0 4h16V7z"/><circle cx="16" cy="13" r="1"/>',
    "chevron-up": '<path d="M18 15l-6-6-6 6"/>',
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "chevron-left": '<path d="M15 18l-6-6 6-6"/>',
    "eye-off": '<path d="M17.94 17.94A10 10 0 0 1 12 20C5 20 1 12 1 12a18 18 0 0 1 5.06-5.06M9.9 4.24A9 9 0 0 1 12 4c7 0 11 8 11 8a18 18 0 0 1-2.16 3.19M1 1l22 22"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>',
    backpack: '<path d="M6 8a6 6 0 0 1 12 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><path d="M10 13h4"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    truck: '<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="17.5" cy="18.5" r="2"/>',
    "credit-card": '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  };
  const ICON = (n) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[n] || ""}</svg>`;

  /* ---------------- entry mode (front / admin / full) ----------------
     Each HTML entry sets window.CLUBOS_MODE before app.js runs, so the
     same codebase can boot into the customer front-end or the backend
     workspace directly. "?mode=front|admin" on the URL also works. */
  const CLUBOS_MODE = (typeof window !== "undefined"
    && (window.CLUBOS_MODE || new URLSearchParams(window.location.search).get("mode")))
    || "full";
  const isAdminMode = () => CLUBOS_MODE === "admin";
  const isFrontMode = () => CLUBOS_MODE === "front";

  /* ---------------- sample texts ---------------- */
  const SAMPLE_FULL = "9月12日赵公山轻装徒步，12公里爬升约1100米，适合16—55岁，168元/人，限25人，早上7:30天府广场集合，含领队和保险，当天往返。";
  const EXAMPLE2 = "本周末都江堰虹口漂流，适合8岁以上，199元/人，限30人，成都出发，含装备和保险。";
  const PASTE_SAMPLE = "各位爸妈好～这周六我们组织去青城后山玩，带小朋友走一小段路，大概6公里，适合6到12岁。一组家庭299，最多20组。早上8点天府广场集合，我们安排了领队，管午饭，也买了保险。下午5点回成都。有兴趣私我～";

  /* ---------------- state ---------------- */
  const LS_KEY = "clubos_v1";
  let state; // 延迟到所有依赖就绪后再初始化
  const backStack = [];
  let bentoScrollTimer;
  let heroScrollTimer;
  let signupFilterActivityId = null; // 报名名单当前筛选的活动

  const DEFAULT_MEMBER_TIERS = [
    { id: "t_normal", name: "普通会员", icon: "leaf", minPoints: 0, benefits: ["报名积分 1 倍", "商城会员价", "生日关怀"], color: "#8a8a7a", discount: 100, description: "1、会员购买小程序内产品可享受9.9折优惠；\n2、每消费1元获1经验值\n3、赠送30积分", growthSpend: 1, growthRecharge: 1, downgradeSms: false, downgradeDays: 7, pointsEnabled: true, pointsRate: 1, freeShipping: false, perks: [], memberDays: [], autoGrant: { enabled: false, points: 10, coupons: [] } },
    { id: "t_silver", name: "银卡会员", icon: "mountain", minPoints: 500, benefits: ["报名积分 1.2 倍", "装备 95 折", "专属活动优先报名"], color: "#9aa7ad", discount: 95, description: "1、会员购买小程序内产品可享受8.5折优惠；\n2、每周四会员可享受会员价6.5折优惠\n3、每消费1元获1经验值\n4、赠送指定商品5折优惠券1张，赠送30积分", growthSpend: 1, growthRecharge: 1, downgradeSms: false, downgradeDays: 7, pointsEnabled: true, pointsRate: 1, freeShipping: false, perks: [], memberDays: [], autoGrant: { enabled: false, points: 10, coupons: [] } },
    { id: "t_gold", name: "金卡会员", icon: "crown", minPoints: 2000, benefits: ["报名积分 1.5 倍", "装备 9 折", "领队 1v1 咨询", "装备优先试用"], color: "#B98A2E", discount: 90, description: "1、会员购买小程序内产品可享受8折优惠；\n2、每周四会员可享受会员价6折优惠\n3、每消费1元获1.5经验值\n4、赠送指定商品5折优惠券2张，赠送60积分", growthSpend: 1.5, growthRecharge: 1.5, downgradeSms: true, downgradeDays: 7, pointsEnabled: true, pointsRate: 0.8, freeShipping: true, perks: ["免配送费"], memberDays: [], autoGrant: { enabled: true, points: 20, coupons: [] } },
    { id: "t_black", name: "黑卡会员", icon: "star", minPoints: 6000, benefits: ["报名积分 2 倍", "装备 85 折", "私享路线定制", "家属同行权益"], color: "#2F5D50", discount: 85, description: "1、会员购买小程序内产品可享受7.5折优惠；\n2、每周四会员可享受会员价5.5折优惠\n3、每消费1元获2经验值\n4、赠送指定商品5折优惠券3张，赠送100积分", growthSpend: 2, growthRecharge: 2, downgradeSms: true, downgradeDays: 7, pointsEnabled: true, pointsRate: 0.5, freeShipping: true, perks: ["免配送费", "优先发货"], memberDays: [], autoGrant: { enabled: true, points: 50, coupons: [] } }
  ];

  const DEFAULT_MEMBERSHIP_SETTINGS = {
    activationMode: "condition",
    requireProfile: false,
    conditionMatch: "all",
    conditions: {
      followers: { enabled: false, value: 100 },
      phone: { enabled: true, value: 0 },
      orders: { enabled: false, value: 3 },
      spend: { enabled: false, value: 1000 },
      recharge: { enabled: false, value: 500 }
    },
    stores: "all"
  };

  /* ---------------- C 端首页自定义装修（v90） ---------------- */
  const HOME_COMPONENT_META = [
    { type: "banner", name: "轮播图", icon: "play" },
    { type: "entry", name: "焦点入口", icon: "compass" },
    { type: "activities", name: "活动专区", icon: "flame" },
    { type: "upcoming", name: "即将出发", icon: "clock" },
    { type: "coupon", name: "优惠券", icon: "ticket" },
    { type: "gear", name: "装备推荐", icon: "shopping-bag" },
    { type: "member", name: "会员积分卡", icon: "crown" },
    { type: "brand", name: "品牌故事", icon: "quote" },
  ];
  function defaultComponent(type) {
    const id = "hc_" + uid();
    const base = { id, type, hidden: false, config: {} };
    switch (type) {
      case "banner": base.config = { title: "", sub: "", tag: "" }; break;
      case "entry": base.config = { title: "探索目的地", items: [ { icon: "mountain", label: "徒步登山" }, { icon: "tent", label: "露营" }, { icon: "droplet", label: "溯溪漂流" }, { icon: "leaf", label: "亲子自然" } ] }; break;
      case "activities": base.config = { title: "正在招募", limit: 6, style: "grid" }; break;
      case "upcoming": base.config = { title: "即将出发" }; break;
      case "coupon": base.config = { title: "领券优惠" }; break;
      case "gear": base.config = { title: "装备推荐", limit: 6 }; break;
      case "member": base.config = { title: "会员积分" }; break;
      case "brand": base.config = { title: "" }; break;
    }
    return base;
  }
  const HOME_TEMPLATES = {
    classic_route: { id: "classic_route", name: "经典线路社", desc: "沉浸山河 · 高端路线 · 目的地宫格", icon: "mountain", components: ["banner","entry","activities","member","gear","brand"].map(defaultComponent) },
    camp_study: { id: "camp_study", name: "综合营地·研学", desc: "疗愈静谧 · 横向分类 · 课程列表", icon: "tent", components: ["banner","entry","activities","member","gear","brand"].map(defaultComponent) },
    community: { id: "community", name: "轻量社群", desc: "AI 搜索 · 社交 Feed · 打卡拼团", icon: "users", components: ["banner","activities","member","brand"].map(defaultComponent) },
  };
  function homeComponentsForTemplate(tplId) {
    const t = HOME_TEMPLATES[tplId];
    if (!t) return [];
    return t.components.map((c) => ({ type: c.type, id: "hc_" + uid(), hidden: false, config: JSON.parse(JSON.stringify(c.config)) }));
  }
  const DEFAULT_HOME_LAYOUT = { enabled: true, template: "classic_route", components: homeComponentsForTemplate("classic_route") };
  function getHomeComponents() {
    const hl = (state && state.homeLayout) || DEFAULT_HOME_LAYOUT;
    if (hl && hl.components && hl.components.length) return hl.components;
    return DEFAULT_HOME_LAYOUT.components;
  }

  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY));
      if (s && s.brand && s.activities) {
        s.history = s.history || [];
        s.leaders = s.leaders || [];
        (s.leaders || []).forEach((l) => { l.avatar = l.avatar || ""; });
        (s.activities || []).forEach((a) => {
          a.customFields = a.customFields || [];
          a.leaderIds = a.leaderIds || [];
          // 旧数据迁移：单领队字段 → 资料库 + leaderIds
          if (!a.leaderIds.length && a.leaderName) {
            const existing = (s.leaders || []).find((l) => l.name === a.leaderName);
            if (existing) {
              a.leaderIds = [existing.id];
            } else {
              const id = uid ? uid() : "l" + Date.now();
              s.leaders.push({ id, name: a.leaderName, years: a.leaderYears || "", cert: a.leaderCert || "", trips: a.leaderTrips || "", avatar: "", createdAt: Date.now() });
              a.leaderIds = [id];
            }
          }
          // 旧数据迁移：确保多团期与会员营销字段存在
          syncDepartures(a);
          if (a.useMemberPrice == null) a.useMemberPrice = false;
          if (a.allowPoints == null) a.allowPoints = false;
          if (a.allowCoupons == null) a.allowCoupons = false;
          a.tierPrices = a.tierPrices || {};
        });
        (s.signups || []).forEach((x) => { x.idType = x.idType || ""; x.idNumber = x.idNumber || ""; x.custom = x.custom || {}; });
        s.plan = "club"; // V2.0 单一俱乐部版，强制统一
        s.clubStatus = s.clubStatus || "approved";
        s.clubInfo = s.clubInfo || {};
        s.points = s.points || 0;
        s.memberExpire = s.memberExpire || null;
        s.aiCredit = s.aiCredit || { base: 1000, gift: 0, paid: 0, month: curYM() };
        s.aiCredit.base = s.aiCredit.base || 0; s.aiCredit.gift = s.aiCredit.gift || 0; s.aiCredit.paid = s.aiCredit.paid || 0; s.aiCredit.month = s.aiCredit.month || curYM(); s.aiCredit.milestones = s.aiCredit.milestones || {};
        s.aiLedger = s.aiLedger || [];
        s.memberTiers = s.memberTiers && s.memberTiers.length ? s.memberTiers : JSON.parse(JSON.stringify(DEFAULT_MEMBER_TIERS));
        s.memberTiers.forEach((t) => {
          if (t.discount == null) t.discount = 100;
          if (t.description == null) t.description = "";
          if (t.growthSpend == null) t.growthSpend = 1;
          if (t.growthRecharge == null) t.growthRecharge = 1;
          if (t.downgradeSms == null) t.downgradeSms = false;
          if (t.downgradeDays == null) t.downgradeDays = 7;
          if (t.pointsEnabled == null) t.pointsEnabled = true;
          if (t.pointsRate == null) t.pointsRate = 1;
          if (t.freeShipping == null) t.freeShipping = false;
          if (t.perks == null) t.perks = [];
          if (t.memberDays == null) t.memberDays = [];
          if (t.autoGrant == null) t.autoGrant = { enabled: false, points: 10, coupons: [] };
          else { if (t.autoGrant.coupons == null) t.autoGrant.coupons = []; }
        });
        s.membershipSettings = s.membershipSettings || JSON.parse(JSON.stringify(DEFAULT_MEMBERSHIP_SETTINGS));
        if (!s.membershipSettings.conditions) s.membershipSettings.conditions = JSON.parse(JSON.stringify(DEFAULT_MEMBERSHIP_SETTINGS.conditions));
        ["followers", "phone", "orders", "spend", "recharge"].forEach((k) => { if (!s.membershipSettings.conditions[k]) s.membershipSettings.conditions[k] = { enabled: false, value: DEFAULT_MEMBERSHIP_SETTINGS.conditions[k].value }; });
        s.membershipAdminTab = s.membershipAdminTab || "basic";
        s.membershipOrders = s.membershipOrders || [
          { id: uid(), userId: "u_18360601", uid: "18360601", nickname: "oikawa", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=oikawa", amount: 19.9, orderNo: "vip0811195950152", durationDays: 360, store: "—", status: "paid", paidAt: Date.now() - 86400000 * 2, createdAt: Date.now() - 86400000 * 2 }
        ];
        s.membershipOrderFilters = s.membershipOrderFilters || { uid: "", nickname: "", orderNo: "", store: "all", duration: "all", status: "all", startDate: "", endDate: "" };
        s.membershipOrderPage = s.membershipOrderPage || { page: 1, pageSize: 15 };
        s.coupons = s.coupons || [];
        s.referral = s.referral || { enabled: true, inviterPoints: 200, inviteePoints: 100, totalInvites: 0, successInvites: 0 };
        s.mmTab = s.mmTab || "tiers";
        s.customerTab = s.customerTab || "list";
        s.customerSearch = s.customerSearch || "";
        s.customerMemberFilter = s.customerMemberFilter || "all";
        s.customerPhoneFilter = s.customerPhoneFilter || "all";
        s.customerStartDate = s.customerStartDate || "";
        s.customerEndDate = s.customerEndDate || "";
        s.mallSalesMonth = s.mallSalesMonth || 0;
        if (!s.mallProducts) s.mallProducts = JSON.parse(JSON.stringify(MOCK_PRODUCTS));
        s.mallOrders = s.mallOrders || [];
        if (!s.homeLayout || !s.homeLayout.components || !s.homeLayout.components.length) s.homeLayout = JSON.parse(JSON.stringify(DEFAULT_HOME_LAYOUT));
        s.decorateEdit = s.decorateEdit == null ? null : s.decorateEdit;
        (s.mallOrders || []).forEach((o) => {
          if (!o.commissionStatus) o.commissionStatus = "pending";
          if (typeof o.commission !== "number") {
            let c = 0;
            (o.items || []).forEach((it) => { const p = (s.mallProducts || []).find((pp) => pp.id === it.productId); if (p) c += (p.commissionMode === "fixed" ? p.commissionValue : Math.round(it.price * (p.commissionValue / 100))) * (it.qty || 1); });
            o.commission = Math.round(c);
          }
        });
        s.myRecs = s.myRecs || [];
        s.mallView = s.mallView || "browse";
        s._mallSource = s._mallSource || null;
        s.aiGearOrders = s.aiGearOrders || 0;
        s.mallConsoleTab = s.mallConsoleTab || "products";
        s.commissionSubTab = s.commissionSubTab || "apply";
        s.commissionSettlements = s.commissionSettlements || [];
        s.settlementProfile = s.settlementProfile || { method: "company", companyName: "", taxNo: "", bank: "", accountNo: "", cardName: "", cardBank: "", cardNo: "", idCard: "" };
        // ---- V2.0 总平台：多俱乐部统管数据 ----
        if (!s.platformClubs) {
          s.platformClubs = PLATFORM_CLUBS.map((c) => ({
            ...c,
            permissions: { aiCreate: true, gearFusion: true, membership: true, marketing: true, data: true },
            mallEnabled: c.status === "approved",
            aiBaseQuota: 1000,
            aiCredit: { base: 1000, gift: 0, paid: 0, month: curYM() },
          }));
          s.platformClubs.push({
            id: "club_demo", name: (s.brand && s.brand.name) || "本俱乐部", region: (s.brand && s.brand.address) || "本平台",
            contact: (s.brand && s.brand.wechat) || "-", phone: (s.brand && s.brand.phone) || "-", appliedAt: "2026-08-10", status: "approved",
            permissions: { aiCreate: true, gearFusion: true, membership: true, marketing: true, data: true },
            mallEnabled: true, aiBaseQuota: 1000,
            aiCredit: { base: s.aiCredit.base, gift: s.aiCredit.gift, paid: s.aiCredit.paid, month: s.aiCredit.month },
          });
        }
        if (!s.suppliers) {
          const cnt = (sid) => (s.mallProducts || []).filter((p) => p.supplierId === sid).length;
          s.suppliers = MOCK_SUPPLIERS.map((sp) => ({ ...sp, syncStatus: "synced", lastSync: Date.now() - 86400000 * 2, productCount: cnt(sp.id) }));
        }
        if (!s.mallOrders || s.mallOrders.length === 0) {
          const mk = (st, title, price, comm, cstatus, logi) => ({ id: uid(), clubId: "club_demo", userId: "u_demo", sourceType: st, sourceId: "act_demo", referrerClubId: "", items: [{ productId: "p_stick", title, price, qty: 1 }], amount: price, commission: comm, commissionStatus: cstatus, logistics: logi || "pending", trackingNo: (logi === "shipped" || logi === "signed") ? "SF" + String(Date.now()).slice(-10) : "", refunded: false, status: "paid", createdAt: Date.now() - 86400000 * (1 + Math.random() * 5) });
          s.mallOrders = [
            mk("club_shop", "碳纤登山杖（一对）", 199, 24, "settled", "signed"),
            mk("ai_gear_list", "防晒速干渔夫帽", 49, 5, "available", "pending"),
            mk("activity_detail", "攀登头盔（CE 认证）", 329, 26, "frozen", "shipped"),
            mk("club_shop", "中帮防水登山鞋", 899, 108, "pending", "pending"),
          ];
        } else {
          (s.mallOrders || []).forEach((o) => { if (!o.logistics) o.logistics = "pending"; if ((o.logistics === "shipped" || o.logistics === "signed") && !o.trackingNo) o.trackingNo = "SF" + String(Date.now()).slice(-10); });
        }
        return s;
      }
    } catch (e) {}
    return seedState();
  }
  function saveState() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function seedState() {
    const a = blankActivity();
    a.title = "赵公山周末轻装徒步 · 登顶看成都平原"; a.type = "徒步"; a.pageStyle = "hike"; a.place = "赵公山"; a.audience = [];
    a.date = "2026年9月12日"; a.dateMD = "9月12日"; a.ageFrom = 16; a.ageTo = 55; a.ageRange = "16—55岁";
    a.price = 168; a.limit = 25; a.limitUnit = "人"; a.meeting = "天府广场"; a.meetTime = "07:30"; a.returnTime = "18:00";
    a.includeLeader = true; a.includeMeal = false; a.includeInsurance = true;
    a.itineraryDays = [{ label: "行程安排", sub: "9月12日", items: [
      { time: "07:30", text: "天府广场集合签到，行前说明" },
      { time: "09:00", text: "抵达山脚，热身与装备检查" },
      { time: "10:30", text: "上山｜林间土路，逐步爬升" },
      { time: "12:30", text: "山脊路餐（自带干粮）" },
      { time: "14:30", text: "登顶赵公山，俯瞰成都平原" },
      { time: "16:00", text: "下撤，18:00 回到集合点" },
    ] }];
    a.status = "recruiting"; a.signups = 10; a.createdAt = Date.now() - 86400000 * 3;
    syncDerived(a);
    a.title = "赵公山周末轻装徒步 · 登顶看成都平原";
    a.forewordTitles = [a.title, "赵公山：把城市的边界踩在脚下", "周末，去山脊上发一会儿呆"];
    a.titleVariants = { brand: a.title, info: a.title, wechat: a.title, xhs: a.title, moments: a.title };
    a.intro = "赵公山在都江堰与汶川交界，从成都出发约 1.5 小时。这次走一条 12 公里环线，累计爬升约 1100 米，山顶视野开阔，晴天能看见成都平原一直铺到地平线。适合有一定徒步基础、想认真走一段的人。";
    a.hook = "你以为最累的是最后三公里，其实最难的是刚出林线那一百米——风突然大起来，腿也开始抖。";
    a.body = [
      "7 点半成都出发，9 点前到山脚。领队先在路口统一检查鞋带和登山杖，讲清楚今天的水和节奏：每人至少 1.5 升，前三公里压住速度，别一上来就冲。",
      "前半段是林间土路，树荫多、坡度缓，适合把呼吸稳住。走到第五公里开始出林线，路面换成碎石和草坡，风一下大起来，视野也跟着打开。",
      "山顶没有补给，也没有信号。我们在垭口找背风处路餐，啃完面包抬头，成都平原就铺在脚下——这种时候没人急着拍照，都先看了会儿。",
      "下撤比上山大，膝盖最吃力。领队会在陡段提醒侧切和之字走法，多数人 16 点前回到林线，18 点准时上车回成都。"
    ];
    a.editorialTitle = "把自己从城市里拔出来一次";
    a.posterTagline = "九月末的山脊线，把暑气留在成都平原";
    a.pullQuote = "山顶没有信号，但你能看清整座成都";
    a.storyPurpose = "路线、爬升与登顶那一刻";
    a.photoCaptions = ["刚出林线、风突然变大的那一刻", "垭口俯瞰成都平原的边界"];
    a.sellingPoints = [
      { title: "12 公里环线，累计爬升约 1100 米", desc: "赵公山成熟环线，全程约 12 公里、累计爬升约 1100 米；山顶海拔约 2435 米，报名前请按自身体能评估。" },
      { title: "限 25 人小队，1 名领队全程随队", desc: "人数压到 25 人以内，一名领队全程随队控节奏，陡段会提醒侧切与之字走法；下撤安排以领队现场判断为准。" },
      { title: "成都周边 1.5 小时，当日往返", desc: "周末一日往返不请假，早上出发、晚上回城，把一整天交给山野而不是堵在高架上。" },
      { title: "含户外活动保险", desc: "机构统一投保，出发前签告知书，强度中等但保障不缺，自己不用另外买。" }
    ];
    a.highlights = [["12 公里环线，累计爬升约 1100 米", "mountain"], ["限 25 人小队，1 名领队随队", "users"], ["成都周边 1.5 小时，当日往返", "clock"], ["含户外活动保险，出发前签告知书", "shield"]];
    a.confirmedDemoFacts = [
      "起点与车程：成都都江堰，市区出发约 1.5 小时",
      "路线：赵公山 12 公里成熟环线，累计爬升约 1100 米",
      "山顶海拔：约 2435 米",
      "队伍规模：限 25 人以内",
      "人员配置：1 名领队全程随队",
      "费用包含：户外活动保险（机构统一投保）",
      "行程时长：1 天，当日往返"
    ];
    a.gear = [{ name: "防滑徒步鞋", must: true }, { name: "登山杖", must: true }, { name: "1.5L 以上饮水及路餐", must: true }, { name: "防晒与防风外套", must: false }];
    a.pipeline = { foreword: { titles: a.forewordTitles, intro: a.intro }, sellingPoints: (a.sellingPoints || []).map((s) => ({ title: s.title, desc: s.desc })), itinerary: { days: 1 }, details: { refund: ["出发前 7 天以上取消，全额退款。", "出发前 3—7 天取消，扣除 30% 费用。", "出发前 3 天内取消，费用不退，可协商转让名额。"], altitude: ["山顶海拔约 2435 米，请量力评估体能。"], missing: [], must: a.gear.map((g) => g.name), suggest: [] } };
    a.shareWechat = a.title + "\n" + a.intro + "\n赵公山·徒步·12公里。想参加直接咨询。";
    a.shareMoments = a.title + "\n" + a.intro;
    a.shareXhs = a.title + "\n" + a.intro + "\n#成都周边徒步 #赵公山 #周末去哪";
    a.shareGzh = a.title + "\n\n" + a.intro;
    a.shareVoice = a.intro;
    a.departures = [
      { id: uid(), date: "2026-09-12", dateMD: "9月12日", weekDay: "周六", price: 168, status: "open", note: "" },
      { id: uid(), date: "2026-09-19", dateMD: "9月19日", weekDay: "周六", price: 168, status: "open", note: "" },
    ];
    a.useMemberPrice = true;
    a.allowPoints = true;
    a.allowCoupons = true;
    a.tierPrices = { t_normal: 168, t_silver: 160, t_gold: 150, t_black: 140 };
    const b = JSON.parse(JSON.stringify(a));
    b.id = uid(); b.title = "虹口漂流：前半段温吞，后半段让你握紧桨"; b.type = "溯溪"; b.pageStyle = "water"; b.place = "都江堰虹口"; b.status = "recruiting"; b.signups = 3; b.createdAt = Date.now() - 86400000 * 2; b.photos = []; b.coverIndex = 0; b.pinned = false; b.pinnedAt = 0;
    b.date = "2026年9月28日"; b.dateMD = "9月28日";
    b.departures = [{ id: uid(), date: "2026-09-28", dateMD: "9月28日", weekDay: "周日", price: 198, status: "open", note: "" }];
    b.price = 198; b.limit = 20; b.tierPrices = { t_normal: 198, t_silver: 188, t_gold: 178, t_black: 168 };
    const brand = {
      name: "野径行", logoText: "野", logo: "", slogan: "把周末，交给山野。",
      style: "自然户外", primary: "#2F5D50", intro: "野径行是一支扎根成都的户外俱乐部，专注周边一日与多日徒步路线。我们相信，最好的状态在走得够远之后。",
      wechat: "yejingxing_club", phone: "138 0000 6021", address: "成都 · 都江堰",
    };
    const aiCredit = { base: 1000, gift: 0, paid: 0, month: curYM() };
    let s = {
      brand,
      activities: [a, b],
      history: [],
      leaders: [],
      signups: [
        { id: uid(), activityId: a.id, departureId: a.departures[0].id, name: "王女士", phone: "138****2233", adults: 2, children: 1, childName: "小宇", childAge: 8, note: "孩子对花粉轻微过敏", paid: true, createdAt: Date.now() - 86400000 * 2 },
        { id: uid(), activityId: a.id, departureId: a.departures[0].id, name: "李先生", phone: "139****8810", adults: 1, children: 1, childName: "糖糖", childAge: 7, note: "", paid: false, createdAt: Date.now() - 86400000 },
        { id: uid(), activityId: a.id, departureId: a.departures[1].id, name: "张先生", phone: "137****5566", adults: 2, children: 0, note: "", paid: true, createdAt: Date.now() - 86400000 * 1 },
        { id: uid(), activityId: a.id, departureId: a.departures[1].id, name: "陈女士", phone: "136****7788", adults: 2, children: 1, childName: "小宝", childAge: 6, note: "", paid: false, createdAt: Date.now() - 86400000 * 0.5 },
        { id: uid(), activityId: b.id, departureId: b.departures[0].id, name: "刘先生", phone: "135****9999", adults: 1, children: 1, childName: "果果", childAge: 9, note: "", paid: true, createdAt: Date.now() - 86400000 * 1.5 },
        { id: uid(), activityId: b.id, departureId: b.departures[0].id, name: "赵女士", phone: "133****1111", adults: 1, children: 0, note: "", paid: false, createdAt: Date.now() - 86400000 * 0.8 },
      ],
      view: "login", params: {},
      customerTab: "list",
      customerSearch: "",
      customerMemberFilter: "all",
      customerPhoneFilter: "all",
      customerStartDate: "",
      customerEndDate: "",
      plan: "club",
      clubStatus: "approved",
      clubInfo: {},
      points: 0,
      memberExpire: null,
      aiCredit,
      mallSalesMonth: 0,
      mallProducts: null,
      mallOrders: [],
      myRecs: [],
      mallView: "browse",
      mallEditId: null,
      _mallSource: null,
      aiGearOrders: 0,
      mallConsoleTab: "products",
      commissionSubTab: "apply",
      commissionSettlements: [],
      settlementProfile: { method: "company", companyName: "", taxNo: "", bank: "", accountNo: "", cardName: "", cardBank: "", cardNo: "", idCard: "" },
      platformClubs: [],
      suppliers: [],
      memberTiers: JSON.parse(JSON.stringify(DEFAULT_MEMBER_TIERS)),
      membershipSettings: JSON.parse(JSON.stringify(DEFAULT_MEMBERSHIP_SETTINGS)),
      membershipAdminTab: "basic",
      membershipOrders: [
        { id: uid(), userId: "u_18360601", uid: "18360601", nickname: "oikawa", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=oikawa", amount: 19.9, orderNo: "vip0811195950152", durationDays: 360, store: "—", status: "paid", paidAt: Date.now() - 86400000 * 2, createdAt: Date.now() - 86400000 * 2 }
      ],
      membershipOrderFilters: { uid: "", nickname: "", orderNo: "", store: "all", duration: "all", status: "all", startDate: "", endDate: "" },
      membershipOrderPage: { page: 1, pageSize: 15 },
      coupons: [
        { id: uid(), title: "新人满 200 减 50", type: "reduce", threshold: 200, value: 50, scope: "all", total: 500, claimed: 120, used: 64, status: "active", createdAt: Date.now() - 86400000 * 6 },
        { id: uid(), title: "老会员 9 折券", type: "discount", threshold: 0, value: 90, scope: "gear", total: 300, claimed: 88, used: 41, status: "active", createdAt: Date.now() - 86400000 * 3 },
        { id: uid(), title: "生日专享满 300 减 80", type: "reduce", threshold: 300, value: 80, scope: "all", total: 100, claimed: 23, used: 9, status: "active", createdAt: Date.now() - 86400000 }
      ],
      referral: { enabled: true, inviterPoints: 200, inviteePoints: 100, totalInvites: 36, successInvites: 12 },
      mmTab: "tiers",
      homeLayout: JSON.parse(JSON.stringify(DEFAULT_HOME_LAYOUT)),
      decorateEdit: null,
    };
    s.platformClubs = PLATFORM_CLUBS.map((c) => ({ ...c, permissions: { aiCreate: true, gearFusion: true, membership: true, marketing: true, data: true }, mallEnabled: c.status === "approved", aiBaseQuota: 1000, aiCredit: { base: 1000, gift: 0, paid: 0, month: curYM() } })).concat([{ id: "club_demo", name: brand.name || "本俱乐部", region: brand.address || "本平台", contact: brand.wechat || "-", phone: brand.phone || "-", appliedAt: "2026-08-10", status: "approved", permissions: { aiCreate: true, gearFusion: true, membership: true, marketing: true, data: true }, mallEnabled: true, aiBaseQuota: 1000, aiCredit: { base: aiCredit.base, gift: aiCredit.gift, paid: aiCredit.paid, month: aiCredit.month } }]);
    s.mallProducts = JSON.parse(JSON.stringify(MOCK_PRODUCTS));
    const productCountBySupplier = (sid) => (s.mallProducts || []).filter((p) => p.supplierId === sid).length;
    s.suppliers = MOCK_SUPPLIERS.map((sp) => ({ ...sp, syncStatus: "synced", lastSync: Date.now() - 86400000 * 2, productCount: productCountBySupplier(sp.id) }));
    s.mallOrders = [
      { id: uid(), clubId: "club_demo", userId: "u_demo", sourceType: "club_shop", sourceId: "act_demo", referrerClubId: "", items: [{ productId: "p_stick", title: "碳纤登山杖（一对）", price: 199, qty: 1 }], amount: 199, commission: 24, commissionStatus: "settled", logistics: "signed", trackingNo: "SF" + String(Date.now()).slice(-10), refunded: false, status: "paid", createdAt: Date.now() - 86400000 * 2 },
      { id: uid(), clubId: "club_demo", userId: "u_demo", sourceType: "ai_gear_list", sourceId: "act_demo", referrerClubId: "", items: [{ productId: "p_cap", title: "防晒速干渔夫帽", price: 49, qty: 1 }], amount: 49, commission: 5, commissionStatus: "available", logistics: "pending", trackingNo: "", refunded: false, status: "paid", createdAt: Date.now() - 86400000 * 3 },
      { id: uid(), clubId: "club_demo", userId: "u_demo", sourceType: "activity_detail", sourceId: "act_demo", referrerClubId: "", items: [{ productId: "p_helmet", title: "攀登头盔（CE 认证）", price: 329, qty: 1 }], amount: 329, commission: 26, commissionStatus: "frozen", logistics: "shipped", trackingNo: "SF" + String(Date.now()).slice(-10), refunded: false, status: "paid", createdAt: Date.now() - 86400000 * 1 },
      { id: uid(), clubId: "club_demo", userId: "u_demo", sourceType: "club_shop", sourceId: "act_demo", referrerClubId: "", items: [{ productId: "p_shoe", title: "中帮防水登山鞋", price: 899, qty: 1 }], amount: 899, commission: 108, commissionStatus: "pending", logistics: "pending", trackingNo: "", refunded: false, status: "paid", createdAt: Date.now() - 86400000 * 4 },
    ];
    return s;
  }

  /* ================= LLM（DeepSeek / Qwen）解析与文案生成 =================
     架构原则：语义理解与文案创作交给大模型，前端仅做状态管理与渲染。
     统一客户端 clubLLM()：
       - 若配置了总平台后端地址 → 走后端 /ai-proxy 代理（平台统一持有 Key，按 AI 积分计量），前端永不接触密钥；
       - 否则回退「演示模式」直连（Key 存于 localStorage，用户自行填写，仅用于本地联调/未部署后端时）。
     aiAuthMode() 返回当前可用模式：'backend' | 'key' | false，供需要「未配置则提示」的入口判断。 */
  const AI_LS_KEY = "clubos_ai_key";
  const AI_PROVIDER_KEY = "clubos_ai_provider";
  function getAIKey() { try { return (localStorage.getItem(AI_LS_KEY) || "").trim(); } catch (e) { return ""; } }
  function setAIKey(v) { try { localStorage.setItem(AI_LS_KEY, (v || "").trim()); } catch (e) {} }
  function getAIProvider() { try { return (localStorage.getItem(AI_PROVIDER_KEY) || "deepseek").trim(); } catch (e) { return "deepseek"; } }
  function setAIProvider(v) { try { localStorage.setItem(AI_PROVIDER_KEY, v || "deepseek"); } catch (e) {} }

  /* ================= 后端会员服务（可选接入） =================
     指向 clubos-backend 部署地址；留空则前端走本地 Demo 模式（模拟开通 / 积分）。
     真实环境填好后端地址后，开通会员 / 积分 / AI 代理会自动走后端接口（带 JWT）。 */
  async function apiCall(path, opts = {}) {
    const backend = getBackendURL();
    if (!backend) return { ok: false, demo: true };
    let tok = getBackendToken() || (await ensureBackendToken());
    const headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    if (tok) headers.Authorization = "Bearer " + tok;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      let r = await fetch(backend + path, {
        method: opts.method || "GET",
        headers: headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.status === 401 && tok) {
        // JWT 过期 → 刷新一次
        clearBackendToken();
        const tok2 = await ensureBackendToken();
        if (tok2) {
          headers.Authorization = "Bearer " + tok2;
          r = await fetch(backend + path, {
            method: opts.method || "GET",
            headers: headers,
            body: opts.body ? JSON.stringify(opts.body) : undefined,
            signal: ctrl.signal,
          });
        }
      }
      const data = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, data };
    } catch (e) {
      return { ok: false, demo: true };
    }
  }
  function aiEndpoint(provider) {
    if (provider === "qwen") return "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
    return "https://api.deepseek.com/chat/completions";
  }
  function aiModel(provider) {
    if (provider === "qwen") return "qwen-plus";
    return "deepseek-chat";
  }
  function aiAuthHeader(provider, key) {
    if (provider === "qwen") return { "Authorization": "Bearer " + key, "X-DashScope-SSE": "disable" };
    return { "Authorization": "Bearer " + key };
  }

  /* ================= 总平台后端 AI 代理（Key 不在前端） =================
     生产环境：俱乐部后台只配置「后端地址 + 管理员口令 + 商家ID」，AI Key 由总平台在服务端统一持有，
     按 AI 积分计量。前端通过 /api/pay/admin/login 换取 JWT，再调 /api/pay/membership/ai-proxy。
     未配置后端时，aiAuthMode() 回退 'key'（演示直连）。 */

  const BACKEND_URL_LS = "clubos_backend_url";
  const BACKEND_ADMIN_CODE_LS = "clubos_backend_admin_code";
  const BACKEND_MERCHANT_ID_LS = "clubos_backend_merchant_id";
  const BACKEND_TOKEN_LS = "clubos_backend_token";

  function getBackendURL() { try { return (localStorage.getItem(BACKEND_URL_LS) || "").trim().replace(/\/+$/, ""); } catch (e) { return ""; } }
  function setBackendURL(v) { try { if (v && v.trim()) localStorage.setItem(BACKEND_URL_LS, v.trim().replace(/\/+$/, "")); else localStorage.removeItem(BACKEND_URL_LS); } catch (e) {} }
  function getBackendAdminCode() { try { return (localStorage.getItem(BACKEND_ADMIN_CODE_LS) || "").trim(); } catch (e) { return ""; } }
  function setBackendAdminCode(v) { try { if (v && v.trim()) localStorage.setItem(BACKEND_ADMIN_CODE_LS, v.trim()); else localStorage.removeItem(BACKEND_ADMIN_CODE_LS); } catch (e) {} }
  function getBackendMerchantId() { try { return (localStorage.getItem(BACKEND_MERCHANT_ID_LS) || "1").trim(); } catch (e) { return "1"; } }
  function setBackendMerchantId(v) { try { localStorage.setItem(BACKEND_MERCHANT_ID_LS, (v || "1").trim()); } catch (e) {} }
  function getBackendToken() { try { return (localStorage.getItem(BACKEND_TOKEN_LS) || "").trim(); } catch (e) { return ""; } }
  function setBackendToken(v) { try { if (v && v.trim()) localStorage.setItem(BACKEND_TOKEN_LS, v.trim()); else localStorage.removeItem(BACKEND_TOKEN_LS); } catch (e) {} }
  function clearBackendToken() { setBackendToken(""); }

  // 当前可用 AI 模式：'backend'（走总平台代理）| 'key'（本地直连演示）| false（未配置）
  function aiAuthMode() {
    if (getBackendURL()) return "backend";
    if (getAIKey()) return "key";
    return false;
  }

  // 用管理员口令 + 商家ID 向后端换取 JWT（缓存于 localStorage；401 时由调用方清掉重试）
  async function ensureBackendToken() {
    const url = getBackendURL(); if (!url) return null;
    const code = getBackendAdminCode(); if (!code) return null;
    const mid = getBackendMerchantId();
    const cached = getBackendToken();
    if (cached) return cached;
    try {
      const r = await fetch(url + "/api/pay/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminCode: code, merchant_id: mid }),
      });
      if (!r.ok) return null;
      const d = await r.json().catch(() => ({}));
      const token = d && d.data && d.data.token;
      if (token) { setBackendToken(token); return token; }
      return null;
    } catch (e) { return null; }
  }

  function safeJsonParse(c) {
    if (c == null) return null;
    let s = String(c).trim();
    // 去掉 ```json ... ``` 或 ``` ... ``` 包裹
    if (s.startsWith("```")) {
      s = s.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
    }
    // 去掉首尾引号（模型偶尔把整块 JSON 当字符串输出）
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, "\n");
    }
    // 容忍尾逗号
    s = s.replace(/,\s*([}\]])/g, "$1");
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  // 演示模式：浏览器直连（仅在没有后端或后端不可达时用作兜底）
  async function clubLLMdirect(opts) {
    const key = getAIKey(); if (!key) return null;
    const p = getAIProvider();
    const body = { model: opts.model || aiModel(p), temperature: opts.temperature != null ? opts.temperature : 0.7, messages: [] };
    if (opts.system) body.messages.push({ role: "system", content: opts.system });
    body.messages.push({ role: "user", content: opts.user });
    if (opts.json) body.response_format = { type: "json_object" };
    try {
      const res = await fetch(aiEndpoint(p), {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, aiAuthHeader(p, key)),
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const d = await res.json();
      const c = d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (!c) return null;
      return opts.json ? safeJsonParse(c) : c.trim();
    } catch (e) { return null; }
  }

  // 总平台代理：走后端 /ai-proxy（Key 在服务端，按积分计量）。返回内容或 null；不可达/未鉴权时返回 "__fallback__" 让上层回退直连。
  async function clubLLMviaBackend(opts) {
    const url = getBackendURL();
    let token = await ensureBackendToken();
    if (!token) return "__fallback__";
    // 平台 Key 为 DeepSeek，强制统一模型，避免把 qwen-plus 误传 deepseek 接口
    const model = opts.model && /deepseek/i.test(opts.model) ? opts.model : "deepseek-chat";
    const body = { prompt: opts.user, system: opts.system || "", model: model, temperature: opts.temperature != null ? opts.temperature : 0.7 };
    if (opts.json) body.response_format = { type: "json_object" };
    const headers = { "Content-Type": "application/json", Authorization: "Bearer " + token };
    try {
      let res = await fetch(url + "/api/pay/membership/ai-proxy", { method: "POST", headers: headers, body: JSON.stringify(body) });
      if (res.status === 401) {
        // JWT 过期 → 清缓存刷新一次
        clearBackendToken();
        token = await ensureBackendToken();
        if (!token) return "__fallback__";
        res = await fetch(url + "/api/pay/membership/ai-proxy", { method: "POST", headers: Object.assign({}, headers, { Authorization: "Bearer " + token }), body: JSON.stringify(body) });
      }
      if (!res.ok) return null;
      const d = await res.json().catch(() => ({}));
      const c = d && d.data && d.data.content;
      if (!c) return null;
      return opts.json ? safeJsonParse(c) : c.trim();
    } catch (e) { return "__fallback__"; }
  }

  // 统一入口：有后端优先走代理；代理不可达/未鉴权时回退浏览器直连（演示态）
  async function clubLLM(opts) {
    if (getBackendURL()) {
      const r = await clubLLMviaBackend(opts);
      if (r !== "__fallback__") return r;
    }
    return clubLLMdirect(opts);
  }

  /* ================= 会员价工具函数（C 端与详情页共用） ================= */
  function currentMemberTier() {
    const points = state.points || 0;
    const tiers = (state.memberTiers || []).slice().sort((a, b) => (a.minPoints || 0) - (b.minPoints || 0));
    let cur = tiers[0] || null;
    tiers.forEach((t) => { if (points >= (t.minPoints || 0)) cur = t; });
    return cur;
  }
  function memberPriceForTier(a, tier) {
    if (!a || !a.useMemberPrice || !tier) return a && a.price != null ? a.price : null;
    const tp = (a.tierPrices || {})[tier.id];
    if (tp != null) return tp;
    if (tier.discount && tier.discount < 100 && a.price != null) return Math.round(a.price * tier.discount / 100);
    return a.price;
  }
  function memberPriceRange(a) {
    if (!a || !a.useMemberPrice) return null;
    const tiers = (state.memberTiers || []).filter((t) => (a.tierPrices || {})[t.id] != null);
    const prices = tiers.map((t) => (a.tierPrices || {})[t.id]).filter((p) => p != null);
    if (!prices.length) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
  }
  function formatMemberPriceNote(a) {
    if (!a || !a.useMemberPrice) return "";
    const cur = currentMemberTier();
    const my = memberPriceForTier(a, cur);
    const range = memberPriceRange(a);
    if (cur && my != null) return `${esc(cur.name)}价 ¥${my}`;
    if (range) return `会员价 ¥${range.min}起`;
    return "";
  }
