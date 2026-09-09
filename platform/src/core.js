/* ClubOS Platform — modular build (split from monolithic app.js v81).
   Loaded as classic <script> in order; shared global scope, no bundler. */
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
  const LS_KEY = "clubos_platform_v1"; // 总平台独立数据存储，与 clubos-demo 完全隔离
  let state; // 延迟到所有依赖就绪后再初始化
  const backStack = [];
  let bentoScrollTimer;
  let heroScrollTimer;
  let signupFilterActivityId = null; // 报名名单当前筛选的活动

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
        s.mallSalesMonth = s.mallSalesMonth || 0;
        if (!s.mallProducts) s.mallProducts = JSON.parse(JSON.stringify(MOCK_PRODUCTS));
        s.mallOrders = s.mallOrders || [];
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
          const mk = (cid, st, title, price, comm, cstatus, logi) => ({ id: uid(), clubId: cid, userId: "u_demo", sourceType: st, sourceId: "act_demo", referrerClubId: "", items: [{ productId: "p_stick", title, price, qty: 1 }], amount: price, commission: comm, commissionStatus: cstatus, logistics: logi || "pending", refunded: false, status: "paid", createdAt: Date.now() - 86400000 * (1 + Math.random() * 5) });
          s.mallOrders = [
            mk("club_demo", "club_shop", "碳纤登山杖（一对）", 199, 24, "settled", "signed"),
            mk("club_xipan", "ai_gear_list", "防晒速干渔夫帽", 49, 5, "available", "pending"),
            mk("club_yandian", "activity_detail", "攀登头盔（CE 认证）", 329, 26, "frozen", "shipped"),
            mk("club_fengxing", "club_shop", "中帮防水登山鞋", 899, 108, "pending", "pending"),
          ];
        } else {
          (s.mallOrders || []).forEach((o) => { if (!o.logistics) o.logistics = "pending"; });
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
    a.status = "recruiting"; a.signups = 9; a.createdAt = Date.now() - 86400000 * 3;
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
    const brand = {
      name: "野径行", logoText: "野", logo: "", slogan: "把周末，交给山野。",
      style: "自然户外", primary: "#2F5D50", intro: "野径行是一支扎根成都的户外俱乐部，专注周边一日与多日徒步路线。我们相信，最好的状态在走得够远之后。",
      wechat: "yejingxing_club", phone: "138 0000 6021", address: "成都 · 都江堰",
    };
    const aiCredit = { base: 1000, gift: 0, paid: 0, month: curYM() };
    let s = {
      brand,
      activities: [a],
      history: [],
      leaders: [],
      signups: [
        { id: uid(), activityId: a.id, name: "王女士", phone: "138****2233", adults: 2, children: 1, childName: "小宇", childAge: 8, note: "孩子对花粉轻微过敏", paid: true, createdAt: Date.now() - 86400000 * 2 },
        { id: uid(), activityId: a.id, name: "李先生", phone: "139****8810", adults: 1, children: 1, childName: "糖糖", childAge: 7, note: "", paid: false, createdAt: Date.now() - 86400000 },
      ],
      view: "login", params: {},
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
      platformClubs: [],
      suppliers: [],
      aftersales: [],
      promoCampaigns: [],
      promoCoupons: [],
      distributors: [],
      promoMaterials: [],
      promoTab: "campaigns",
    };
    s.platformClubs = PLATFORM_CLUBS.map((c) => ({ ...c, permissions: { aiCreate: true, gearFusion: true, membership: true, marketing: true, data: true }, mallEnabled: c.status === "approved", aiBaseQuota: 1000, aiCredit: { base: 1000, gift: 0, paid: 0, month: curYM() } })).concat([{ id: "club_demo", name: brand.name || "本俱乐部", region: brand.address || "本平台", contact: brand.wechat || "-", phone: brand.phone || "-", appliedAt: "2026-08-10", status: "approved", permissions: { aiCreate: true, gearFusion: true, membership: true, marketing: true, data: true }, mallEnabled: true, aiBaseQuota: 1000, aiCredit: { base: aiCredit.base, gift: aiCredit.gift, paid: aiCredit.paid, month: aiCredit.month } }]);
    s.mallProducts = JSON.parse(JSON.stringify(MOCK_PRODUCTS));
    const productCountBySupplier = (sid) => (s.mallProducts || []).filter((p) => p.supplierId === sid).length;
    s.suppliers = MOCK_SUPPLIERS.map((sp) => ({ ...sp, syncStatus: "synced", lastSync: Date.now() - 86400000 * 2, productCount: productCountBySupplier(sp.id) }));
    s.mallOrders = [
      { id: uid(), clubId: "club_demo", userId: "u_demo", sourceType: "club_shop", sourceId: "act_demo", referrerClubId: "", items: [{ productId: "p_stick", title: "碳纤登山杖（一对）", price: 199, qty: 1 }], amount: 199, commission: 24, commissionStatus: "settled", logistics: "done", refunded: false, status: "paid", createdAt: Date.now() - 86400000 * 2 },
      { id: uid(), clubId: "club_xipan", userId: "u_demo", sourceType: "ai_gear_list", sourceId: "act_demo", referrerClubId: "", items: [{ productId: "p_cap", title: "防晒速干渔夫帽", price: 49, qty: 1 }], amount: 49, commission: 5, commissionStatus: "available", logistics: "pending", refunded: false, status: "paid", createdAt: Date.now() - 86400000 * 3 },
      { id: uid(), clubId: "club_yandian", userId: "u_demo", sourceType: "activity_detail", sourceId: "act_demo", referrerClubId: "", items: [{ productId: "p_helmet", title: "攀登头盔（CE 认证）", price: 329, qty: 1 }], amount: 329, commission: 26, commissionStatus: "frozen", logistics: "shipped", refunded: false, status: "paid", createdAt: Date.now() - 86400000 * 1 },
      { id: uid(), clubId: "club_fengxing", userId: "u_demo", sourceType: "club_shop", sourceId: "act_demo", referrerClubId: "", items: [{ productId: "p_shoe", title: "中帮防水登山鞋", price: 899, qty: 1 }], amount: 899, commission: 108, commissionStatus: "pending", logistics: "pending", refunded: false, status: "paid", createdAt: Date.now() - 86400000 * 4 },
    ];
    s.aftersales = [
      { id: uid(), type: "refund", clubId: "club_xipan", userId: "u_demo", product: "防晒速干渔夫帽", amount: 49, reason: "尺寸偏小，申请仅退款（订单未发货）", status: "pending", createdAt: Date.now() - 86400000 * 1 },
      { id: uid(), type: "return", clubId: "club_yandian", userId: "u_demo", product: "攀登头盔（CE 认证）", amount: 329, reason: "收到头盔内衬有划痕，申请退货退款", status: "processing", createdAt: Date.now() - 86400000 * 2 },
      { id: uid(), type: "exchange", clubId: "club_fengxing", userId: "u_demo", product: "中帮防水登山鞋", amount: 899, reason: "右脚鞋面开胶，申请换货", status: "done", createdAt: Date.now() - 86400000 * 6, resolvedAt: Date.now() - 86400000 * 4 },
      { id: uid(), type: "complaint", clubId: "club_demo", userId: "u_demo", product: "碳纤登山杖（一对）", amount: 0, reason: "收到的登山杖与商品页描述不符，投诉要求核实处理", status: "pending", createdAt: Date.now() - 86400000 * 8 },
    ];
    s.promoCampaigns = [
      { id: uid(), title: "秋季户外节 · 全平台大促", channel: "全平台", scope: "all", startAt: "2026-09-15", endAt: "2026-09-30", status: "scheduled", exposure: 0, orders: 0 },
      { id: uid(), title: "新俱乐部入驻扶持包", channel: "短信 + 企微", scope: "new", startAt: "2026-09-01", endAt: "2026-12-31", status: "running", exposure: 12400, orders: 86 },
      { id: uid(), title: "装备商城开学季", channel: "公众号 + 小程序弹窗", scope: "gear", startAt: "2026-09-05", endAt: "2026-09-20", status: "running", exposure: 8600, orders: 53 }
    ];
    s.promoCoupons = [
      { id: uid(), title: "平台新人满 300 减 80", type: "reduce", threshold: 300, value: 80, total: 2000, claimed: 420, used: 188, status: "active" },
      { id: uid(), title: "装备专场 88 折", type: "discount", threshold: 0, value: 88, total: 1000, claimed: 260, used: 131, status: "active" },
      { id: uid(), title: "老用户回归券 满 500 减 120", type: "reduce", threshold: 500, value: 120, total: 500, claimed: 96, used: 38, status: "paused" }
    ];
    s.distributors = [
      { id: uid(), name: "山野甄选", clubId: "club_xipan", orders: 42, gmv: 8600, commission: 860, status: "active" },
      { id: uid(), title: "", name: "徒步研究所", clubId: "club_yandian", orders: 27, gmv: 5300, commission: 530, status: "active" },
      { id: uid(), name: "户外老炮儿", clubId: "club_fengxing", orders: 15, gmv: 2900, commission: 290, status: "pending" }
    ];
    s.promoMaterials = [
      { id: uid(), title: "秋季户外节主视觉海报", type: "海报", size: "1080×1920", downloads: 320 },
      { id: uid(), title: "新俱乐部入驻扶持 · 朋友圈文案", type: "文案", size: "短文", downloads: 210 },
      { id: uid(), title: "装备开学季 · 小程序 Banner", type: "Banner", size: "750×400", downloads: 156 }
    ];
    return s;
  }

  /* ================= LLM（DeepSeek / Qwen）解析与文案生成 =================
     架构原则：语义理解与文案创作交给大模型，前端仅做状态管理与渲染。
     API Key 存于 localStorage（用户自行填写），绝不硬编码进代码。 */
  const AI_LS_KEY = "clubos_ai_key";
  const AI_PROVIDER_KEY = "clubos_ai_provider";
  function getAIKey() { try { return (localStorage.getItem(AI_LS_KEY) || "").trim(); } catch (e) { return ""; } }
  function setAIKey(v) { try { localStorage.setItem(AI_LS_KEY, (v || "").trim()); } catch (e) {} }
  function getAIProvider() { try { return (localStorage.getItem(AI_PROVIDER_KEY) || "deepseek").trim(); } catch (e) { return "deepseek"; } }
  function setAIProvider(v) { try { localStorage.setItem(AI_PROVIDER_KEY, v || "deepseek"); } catch (e) {} }

  /* ================= 后端会员服务（可选接入） =================
     指向 clubos-backend 部署地址；留空则前端走本地 Demo 模式（模拟开通 / 积分）。
     真实环境填好 BACKEND_URL 后，开通会员 / 积分 / AI 代理会自动走后端接口。 */
  const BACKEND_URL = "";
  async function apiCall(path, opts = {}) {
    if (!BACKEND_URL) return { ok: false, demo: true };
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(BACKEND_URL + path, {
        method: opts.method || "GET",
        headers: Object.assign({ "Content-Type": "application/json" }, opts.headers || {}),
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
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
  const AI_SYSTEM_PROMPT = `你是一个户外俱乐部的内容主笔。写出来的文案要让人想报名，但靠的是具体和真实，不是形容词和口号。

【绝对禁止】（出现即算失败）
- 口号式反问：想不想、要不要、你准备好了吗、还在等什么、难道不
- 模板动词：带你、带你体验、一起浪、约起来、等你来、冲起来、搞起来
- 空洞形容词堆砌：炎炎夏日、清凉刺激、清澈、蜿蜒、速度与激情、后花园、绝美、无敌、超赞、治愈、松弛感拉满、breathtaking、诗与远方
- 无事实兜底的安全感口号：装备齐全、保险无忧、专业护航、全程保障、安全放心
- 强行动召唤：赶紧报名、不容错过、限时抢购、先到先得、手慢无

【怎么写出吸引力——靠具体，不靠夸张】
1. 用名词和动词写画面：不要写"清澈的溪水"，写"溪水浅处能看清水底卵石"；不要写"风景很美"，写"幺妹峰在清晨的光里露出西壁"。
2. 把读者放进场景：写出发前领队演示的动作、途中某个具体转折、结束后那十分钟在岸上啃冰棍。这些细节比"好玩到爆"更有说服力。
3. 信息给足，让人自己决定：适合谁、多少钱、含什么、强度多大，写清楚。
4. hook（开场钩子）用"一个只有这场活动才有的事实或悬念"开头，例如"前半段水势温吞，你以为漂流就该这样；后半段连着三个跌水，桨一歪就灌满一船"，而不是"想不想来一场漂流"。
5. body（正文）写 3-5 段，每段只讲一个具体场景或事实，逐段把体验铺开，最后一段给决策信息（适合谁/费用/名额）。
6. marketingTitles（标题备选）是用于招募/传播的标题，必须有户外感和文字魅力，优先结合地点与场景氛围；严禁出现公里数、爬升米数、价格、保险、年龄、人数等硬数据。例如：赵公山可写「在成都平原的边界，站一会儿」「赵公山：把城市的边界踩在脚下」，不要写「赵公山12公里徒步，爬升1100米」。
7. posterTagline（海报氛围标语）是放在海报主标题下方的短句，必须结合「季节 + 具体时间 + 地点」写出情绪感和户外向往感，让人看一眼就想进山/下水/出发。字数 16-36 字，一句话，不要口号式反问，不要公里/价格/保险/年龄/人数等硬数据。例如：初秋赵公山可写「九月末的山脊线，把暑气留在成都平原」；八月末虹口漂流可写「水还够野，再晚就来不及了」。
8. editorialTitle（详情页小标题）必须根据本次活动事实独创，禁止套用"让孩子自己走完这 X 公里""这 X 公里，具体意味着什么""为什么是这次 XX"等固定句式；要让人一眼认出这是青城后山、四姑娘山还是虹口漂流。
9. highlights 每条是"事实 + 好处"；sellingPoints 的 desc 用一句话写清"为什么对参与者重要"，禁止空话。
10. photoCaptions 每条 8-16 字，紧扣本次活动场景，不要"展示人物与现场关系"这类通用说明。
11. pullQuote 是一句能记住的具体画面或判断。
12. 所有数据必须来自用户输入，没提到的具体数字不要编。
13. 类型判断（type）必须严格依据用户输入的活动事实判定，禁止默认“亲子活动”。只有当文本明确出现「亲子/儿童/孩子/少年/家庭/研学」等信号时才归类为亲子活动；仅含「X岁以上/成人/年轻化」等成人向信号，或完全未提人群的活动，都不要归为亲子活动。

【好文案示例（都江堰虹口漂流：1天/成都出发1.5h/199元·30人/8岁以上/含头盔救生衣领队大巴/落差集中段约40分钟）】
hook：前半段水势温吞，你以为漂流就该这样；后半段连着三个跌水，桨一歪就灌满一船。
intro：虹口漂流在都江堰龙溪—虹口保护区边缘，从成都出发约 1.5 小时车程。河道前半段平缓，后半段连续跌水，需要双手握桨控方向。199 元/人含头盔、救生衣、往返大巴和一名在水流复杂点值守的领队。
body：
- 集合点在都江堰客运站旁，8 点发车前领队先演示握桨和过跌水的姿势——桨面垂直入水，身体往前压，别往后仰。
- 第一段漂约 20 分钟，水面宽、水流慢，两岸竹林把太阳挡成碎光，第一次坐艇的孩子会先放松下来。
- 真正的落差集中在后半段，约 40 分钟连续跌水。浪打上来糊一脸是常事，船尾的人配合领队口令左右配重，不然容易卡在回流里。
- 终点有热水冲淋和换衣间，岸上小卖部卖五块钱一根的冰棍。多数人坐十分钟，再上车回成都。
sellingPoints：
- 全程分段放行，不扎堆｜每艘艇间隔 30 秒下水，前半段慢、后半段才有连续跌水，新手不会被直接推入急流。
- 水流复杂点有领队值守｜199 元含一名在最乱跌水段岸上守着的领队，卡船翻船能立刻搭手。
- 8 岁以上可独立坐艇｜提供儿童专用小一号救生衣和更轻的桨，孩子能自己控方向，家长坐船尾配重即可。

请始终只返回一个严格符合给定 JSON Schema 的对象，不要输出任何额外文字或 Markdown 代码块。`;

  async function parseActivityWithAI(inputText) {
    const key = getAIKey();
    if (!key) return { _needKey: true, raw: inputText };
    const provider = getAIProvider();
    const schema = `{
 "title": "活动标题",
 "marketingTitles": ["有户外感、结合地点的标题备选1","标题备选2","标题备选3","标题备选4","标题备选5"],
 "type": "徒步|高海拔登山|露营|滑雪|攀岩|骑行|漂流|溯溪|城市旅行|景区观光|企业团建|综合旅行|亲子活动",
 "place": "地点",
 "days": 1,
 "startDate": "YYYY-MM-DD 或空串",
 "price": 299,
 "limit": 20,
 "limitUnit": "人|组家庭",
 "ageRange": "6—12岁",
 "distance": 6,
 "difficulty": "轻松|中等|挑战",
 "elevation": 3500,
 "includedServices": ["专业领队带队","山野午餐","户外高额保险"],
"intro": "120-200字。2-3个短段落：先事实定位，再写一个本场活动才有的具体画面，最后给决策信息。有吸引力但不油腻，禁止口号/反问/形容词堆砌/'带你/一起浪/想不想'等套话",
"hook": "详情页正文开场钩子，一句话（20-45字）。用一个只有这场活动才有的具体事实、画面或悬念开头，让人想往下读；禁止口号/反问/想不想/空洞形容词",
"body": ["正文段落1：用具体名词和动词写一段真实体验（出发准备/途中画面/某个细节），60-140字，禁止形容词堆砌","正文段落2：再写一段体验或场景，60-140字","正文段落3：收尾或决策信息（适合谁/费用/名额），60-140字"],
"sellingPoints": [{"title":"核心卖点1（一个事实点，如：全程分段放行，不扎堆）","desc":"一句话具体支撑，40-80字，写清为什么对参与者重要，禁止空话"}],
"editorialTitle": "详情页故事区小标题（H2）。根据本次活动事实独创，禁止套用固定句式",
"posterTagline": "海报主标题下方的氛围标语。结合季节+时间+地点，16-36字，有户外向往感，不出现公里/价格/保险/年龄/人数等硬数据。例如：九月末的山脊线，把暑气留在成都平原",
"pullQuote": "一句能让人记住的具体画面或判断，8-20字，不喊口号",
"storyPurpose": "一句话说明这组照片应该呈现什么，8-20字，紧扣本次活动",
"photoCaptions": ["第一张照片配文，8-16字，紧扣场景","第二张照片配文，8-16字"],
"highlights": [{"text":"每条必须包含一个可验证的事实 + 一个具体好处，禁止纯形容词或口号","icon":"users"}],
 "missingFacts": ["缺少集合地点"],
 "gearAdvice": ["防滑徒步鞋","小背包","防晒用品"],
 "shareCopies": {"wechat":"","moments":"","xhs":"","gzh":"","voice":""},
 "itineraryDays": [{"label":"行程安排","sub":"日期","items":[{"time":"08:00","text":"集合签到"}]}]
}`;
    const userMsg = `请解析以下户外活动信息，并严格按 Schema 返回 JSON：\n\n${inputText}\n\nJSON Schema:\n${schema}`;
    try {
      const res = await fetch(aiEndpoint(provider), {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, aiAuthHeader(provider, key)),
        body: JSON.stringify({
          model: aiModel(provider),
          response_format: { type: "json_object" },
          temperature: 0.5,
          messages: [
            { role: "system", content: AI_SYSTEM_PROMPT },
            { role: "user", content: userMsg }
          ]
        })
      });
      if (!res.ok) { const t = await res.text().catch(() => ""); console.error("AI 解析失败:", res.status, t); return { _error: "HTTP " + res.status, raw: inputText }; }
      const data = await res.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) return { _error: "模型返回为空", raw: inputText };
      const json = JSON.parse(content);
      json._raw = inputText;
      return json;
    } catch (e) {
      console.error("AI 解析异常:", e);
      return { _error: String((e && e.message) || e), raw: inputText };
    }
  }

  // 把 LLM JSON 映射到 state.activity，保持详情页渲染所需的字段形态
  function applyAIResult(json, base) {
    const a = base || blankActivity();
    a.raw = json._raw || a.raw || "";
    if (json.title) a.title = json.title;
    if (Array.isArray(json.marketingTitles) && json.marketingTitles.length) {
      a.forewordTitles = json.marketingTitles.slice();
      a.titleVariants = { brand: json.marketingTitles[0], info: json.marketingTitles[0], wechat: json.marketingTitles[0], xhs: json.marketingTitles[0], moments: json.marketingTitles[0] };
      if (!a.title) a.title = json.marketingTitles[0];
    }
    if (json.type) a.type = json.type;
    if (json.place) a.place = json.place;
    if (json.days) a.days = +json.days;
    if (json.startDate) { a.date = json.startDate; a.dateMD = toDateMD(json.startDate); }
    if (json.price != null) a.price = +json.price;
    // 首次 AI 生成时，把日期/价格同步为默认团期
    if (a.date && (!a.departures || !a.departures.length)) {
      const d = departureFromDate(a.date, a.price);
      if (d) a.departures = [d];
    } else if (a.departures && a.departures.length && json.price != null) {
      a.departures.forEach((d) => { if (d.price == null) d.price = a.price; });
    }
    if (json.limit != null) a.limit = +json.limit;
    if (json.limitUnit) a.limitUnit = json.limitUnit;
    if (json.ageRange) { a.ageRange = json.ageRange; const mm = String(json.ageRange).match(/(\d{1,2})\s*[-—~至到]\s*(\d{1,2})/); if (mm) { a.ageFrom = +mm[1]; a.ageTo = +mm[2]; } }
    if (json.distance != null) a.distance = +json.distance;
    if (json.elevation != null) a.elevation = +json.elevation;
    if (json.difficulty) a.difficulty = json.difficulty;
    if (Array.isArray(json.includedServices)) {
      a.included = json.includedServices.slice();
      a.feeInclude = json.includedServices.slice();
      a.includeLeader = json.includedServices.some((s) => /领队|向导|教练|带队/.test(s));
      a.includeMeal = json.includedServices.some((s) => /餐|食|午饭|午餐/.test(s));
      a.includeInsurance = json.includedServices.some((s) => /保险/.test(s));
      a.includeTransport = json.includedServices.some((s) => /交通|车|接送/.test(s));
      a.includeGear = json.includedServices.some((s) => /装备/.test(s));
    }
    if (json.intro) a.intro = json.intro;
    if (json.hook) a.hook = json.hook;
    if (Array.isArray(json.body)) a.body = json.body.filter(Boolean);
    if (Array.isArray(json.sellingPoints)) a.sellingPoints = json.sellingPoints.map((s) => ({ title: (s && (s.title || s)) || "", desc: (s && s.desc) || "" }));
    if (json.editorialTitle) a.editorialTitle = json.editorialTitle;
    if (json.posterTagline) a.posterTagline = json.posterTagline;
    if (json.pullQuote) a.pullQuote = json.pullQuote;
    if (json.storyPurpose) a.storyPurpose = json.storyPurpose;
    if (Array.isArray(json.photoCaptions)) a.photoCaptions = json.photoCaptions.filter(Boolean);
    if (Array.isArray(json.highlights)) a.highlights = json.highlights.map((h) => Array.isArray(h) ? h : [h.text || h, (h.icon || "star")]);
    if (Array.isArray(json.gearAdvice)) a.gear = json.gearAdvice.map((n) => ({ name: n, must: true }));
    if (Array.isArray(json.itineraryDays)) a.itineraryDays = json.itineraryDays;
    if (Array.isArray(json.missingFacts)) a.missingFacts = json.missingFacts;
    if (json.shareCopies && typeof json.shareCopies === "object") {
      a.shareWechat = json.shareCopies.wechat || "";
      a.shareMoments = json.shareCopies.moments || "";
      a.shareXhs = json.shareCopies.xhs || "";
      a.shareGzh = json.shareCopies.gzh || "";
      a.shareVoice = json.shareCopies.voice || "";
    }
    // 构造详情页渲染所需的 pipeline 形态（卖点 + 出行须知），渲染器无需改动
    a.pipeline = {
      foreword: { titles: a.forewordTitles || [], intro: a.intro || "" },
      sellingPoints: ((json.sellingPoints && json.sellingPoints.length) ? json.sellingPoints : (json.highlights || [])).map((s) => ({ title: (s && (s.title || s.text || s)) || "", desc: (s && s.desc) || "" })),
      itinerary: { days: a.days || 1 },
      details: {
        refund: ["出发前 7 天以上取消，全额退款。", "出发前 3—7 天取消，扣除 30% 费用。", "出发前 3 天内取消，费用不退，可协商转让名额。"],
        altitude: (a.elevation && +a.elevation >= 3500) ? ["本路线目标海拔约 " + a.elevation + " 米，请提前做好高反预防。"] : [],
        missing: Array.isArray(json.missingFacts) ? json.missingFacts : [],
        must: json.gearAdvice || [],
        suggest: []
      }
    };
    a.missing = [];
    a.aiNotice = "";
    return a;
  }

  // 已有一个 draft 时，调用 LLM 基于现有事实重新生成文案（不重解析事实）
  async function regenerateCopy(a) {
    if (!a) return false;
    const key = getAIKey();
    if (!key) return false;
    const provider = getAIProvider();
    const ctx = { title: a.title, type: a.type, place: a.place, days: a.days, price: a.price, limit: a.limit, limitUnit: a.limitUnit, ageRange: a.ageRange, distance: a.distance, difficulty: a.difficulty, includedServices: a.included || a.feeInclude || [] };
    const userMsg = `已有活动事实：${JSON.stringify(ctx)}\n\n请基于以上事实重新生成文案与详情页结构。严格遵守 system prompt 中的风格规则：靠具体和真实写出吸引力，禁止"想不想/带你/一起浪/炎炎夏日/清凉刺激/速度与激情/后花园/装备齐全/保险无忧"等口水话；hook 要用本场才有的事实或悬念开头；body 写 3-5 段具体场景；intro 有画面感但不油腻；editorialTitle/posterTagline/pullQuote/storyPurpose/photoCaptions/sellingPoints 必须根据本次活动事实独创，禁止套用固定模板。\n\n严格按 Schema 返回 JSON（只需 title/marketingTitles/hook/intro/body/editorialTitle/posterTagline/pullQuote/storyPurpose/photoCaptions/highlights/sellingPoints/gearAdvice/missingFacts/shareCopies）：\n${JSON.stringify({ title: "", marketingTitles: [], hook: "", intro: "", body: [], editorialTitle: "", posterTagline: "", pullQuote: "", storyPurpose: "", photoCaptions: [], highlights: [], sellingPoints: [], gearAdvice: [], missingFacts: [], shareCopies: {} })}`;    try {
      const res = await fetch(aiEndpoint(provider), {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, aiAuthHeader(provider, key)),
        body: JSON.stringify({ model: aiModel(provider), response_format: { type: "json_object" }, temperature: 0.5, messages: [ { role: "system", content: AI_SYSTEM_PROMPT }, { role: "user", content: userMsg } ] })
      });
      if (!res.ok) return false;
      const data = await res.json();
      const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) return false;
      const json = JSON.parse(content);
      json._raw = a.raw;
      applyAIResult(json, a);
      return true;
    } catch (e) { console.error("AI 重生成异常:", e); return false; }
  }

  // 字段级单点重生成：只针对某一项文案让 AI 重新生成（不重解析事实、不动其它字段）
  const REGEN_FIELDS = {
    posterTagline: { label: "海报氛围标语", kind: "text", rule: "海报主标题下方的氛围标语。结合季节+时间+地点，16-36字，有户外向往感，不出现公里/价格/保险/年龄/人数等硬数据" },
    editorialTitle: { label: "故事区小标题", kind: "text", rule: "详情页故事区小标题（H2）。根据本次活动事实独创，禁止套用固定句式" },
    pullQuote: { label: "记忆句/金句", kind: "text", rule: "一句能让人记住的具体画面或判断，8-20字，不喊口号" },
    storyPurpose: { label: "照片故事主题", kind: "text", rule: "一句话说明这组照片应该呈现什么，8-20字，紧扣本次活动" },
    hook: { label: "开场钩子", kind: "text", rule: "详情页正文开场钩子，一句话（20-45字）。用只有这场活动才有的具体事实/画面/悬念开头，禁止口号/反问/想不想/空洞形容词" },
    intro: { label: "活动介绍/导语", kind: "text", rule: "120-200字。2-3个短段落：先事实定位，再写本场才有的具体画面，最后给决策信息。有吸引力但不油腻，禁止口号/反问/形容词堆砌" },
    photoCaptions: { label: "照片配文", kind: "list", rule: "每张照片一句配文，8-16字，紧扣场景" },
    body: { label: "正文段落", kind: "list", rule: "每段60-140字，用具体名词和动词写真实体验（出发准备/途中画面/某个细节），禁止形容词堆砌" }
  };
  function seasonOf(a) {
    const md = a.dateMD || "";
    const m = md.match(/(\d{1,2})月/);
    const mo = m ? +m[1] : (new Date().getMonth() + 1);
    if (mo >= 3 && mo <= 5) return "春季";
    if (mo >= 6 && mo <= 8) return "夏季";
    if (mo >= 9 && mo <= 11) return "秋季";
    return "冬季";
  }
  async function regenField(a, field) {
    if (!a || !REGEN_FIELDS[field]) return false;
    const key = getAIKey(); if (!key) return { _needKey: true };
    // V2.0：先校验 AI 积分余额（不显 Token，只按「AI 积分」计量）
    if (aiBalance() < AI_COST_PER_CALL) return { _noCredit: true };
    const provider = getAIProvider();
    const def = REGEN_FIELDS[field];
    const current = a[field];
    const ctx = {
      title: a.title, type: a.type, place: a.place, dateMD: a.dateMD,
      season: seasonOf(a), days: a.days, difficulty: a.difficulty,
      ageRange: a.ageRange, distance: a.distance, elevation: a.elevation
    };
    const isList = def.kind === "list";
    const cnt = isList ? (Array.isArray(current) ? current.length : (field === "photoCaptions" ? (a.photos ? a.photos.length : 3) : 3)) : 0;
    const schemaField = isList
      ? `{ "${field}": ["${def.label}1","${def.label}2"${cnt > 2 ? ',"' + def.label + '3"' : ""}] }`
      : `{ "${field}": "${def.label}（${def.rule}）" }`;
    const currentRef = isList
      ? `当前已有版本（仅供参考，请勿重复，需全新角度）：${JSON.stringify(Array.isArray(current) ? current : [])}`
      : `当前已有版本（仅供参考，请勿重复，需全新角度）：${typeof current === "string" ? current : ""}`;
    const userMsg = `已有活动事实：${JSON.stringify(ctx)}\n\n请只重新生成「${def.label}」这一项。要求：${def.rule}。${currentRef}\n\n严格只返回如下 JSON Schema 中的一个字段：\n${schemaField}`;
    try {
      const res = await fetch(aiEndpoint(provider), {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, aiAuthHeader(provider, key)),
        body: JSON.stringify({ model: aiModel(provider), response_format: { type: "json_object" }, temperature: 0.85, messages: [ { role: "system", content: AI_SYSTEM_PROMPT }, { role: "user", content: userMsg } ] })
      });
      if (!res.ok) return false;
      const data = await res.json();
      const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) return false;
      const json = JSON.parse(content);
      if (isList) {
        if (Array.isArray(json[field]) && json[field].length) a[field] = json[field].filter(Boolean);
        else return false;
      } else {
        if (!json[field]) return false;
        a[field] = json[field];
      }
      consumeAi(AI_COST_PER_CALL, `AI 重写 · ${def.label}`);
      return true;
    } catch (e) { console.error("字段重生成异常:", e); return false; }
  }

  // 单渠道分享文案重生成：只重写微信/朋友圈/小红书/公众号/口播中的一项
  const SHARE_COPY_CHANNELS = {
    wechat: { label: "微信群招募文案", style: "口语化，像发给微信群的招募通知。包含时间、地点、价格、报名召唤，不用标题党，不喊口号。" },
    moments: { label: "朋友圈文案", style: "适合配图发朋友圈，有画面感和轻微情绪，但不油腻、不堆砌形容词。" },
    xhs: { label: "小红书文案", style: "带 2-4 个相关话题标签（#xxx），口吻年轻、有场景感，避免过度营销感。" },
    gzh: { label: "公众号摘要", style: "正式一点的公众号摘要/导语，1-2 个短段落，有信息密度。" },
    voice: { label: "口播文案", style: "口语化，适合短视频口播或直播话术，自然、有节奏感。" }
  };
  async function regenShareCopy(a, type) {
    if (!a || !SHARE_COPY_CHANNELS[type]) return false;
    const key = "share" + type.charAt(0).toUpperCase() + type.slice(1);
    const keyDef = SHARE_COPY_CHANNELS[type];
    const aiKey = getAIKey(); if (!aiKey) return { _needKey: true };
    const provider = getAIProvider();
    const ctx = {
      title: a.title, type: a.type, place: a.place, dateMD: a.dateMD,
      days: a.days, difficulty: a.difficulty, price: a.price, limit: a.limit, limitUnit: a.limitUnit,
      ageRange: a.ageRange, distance: a.distance, elevation: a.elevation,
      meeting: a.meeting, meetTime: a.meetTime
    };
    const current = a[key] || "";
    const userMsg = `已有活动事实：${JSON.stringify(ctx)}\n\n请只重新生成「${keyDef.label}」。要求：${keyDef.style}。当前已有版本（仅供参考，请勿重复，可全新角度）：${current}\n\n严格只返回如下 JSON Schema 中的一个字段：\n{ "${type}": "${keyDef.label}内容" }`;
    try {
      const res = await fetch(aiEndpoint(provider), {
        method: "POST",
        headers: Object.assign({ "Content-Type": "application/json" }, aiAuthHeader(provider, aiKey)),
        body: JSON.stringify({ model: aiModel(provider), response_format: { type: "json_object" }, temperature: 0.85, messages: [ { role: "system", content: AI_SYSTEM_PROMPT }, { role: "user", content: userMsg } ] })
      });
      if (!res.ok) return false;
      const data = await res.json();
      const content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) return false;
      const json = JSON.parse(content);
      if (!json[type]) return false;
      a[key] = String(json[type]);
      saveState();
      return true;
    } catch (e) { console.error("分享文案重生成异常:", e); return false; }
  }

  // 事实派生的轻量同步（仅费用清单等，不含营销文案），替代旧 recompute
  function syncDerived(a) {
    const inc = [];
    if (a.includeLeader) inc.push("专业领队/向导");
    if (a.includeMeal) inc.push(a.type === "露营" ? "营地餐食" : "餐食");
    if (a.includeInsurance) inc.push("户外保险");
    if (a.includeTransport) inc.push("往返交通");
    if (a.includeGear) inc.push("活动装备");
    a.feeInclude = inc;
  }

  function openAISettings() { showView("ai"); }

  function blankActivity() {
    return {
      id: uid(), title: "", titleCandidates: [], type: "户外探索", pageStyle: "outdoor", audience: [], place: "自然", date: "", dateMD: "", departures: [],
      ageFrom: 6, ageTo: 12, ageRange: "", price: null, originalPrice: null,
      limit: null, limitUnit: "人", meeting: "", meetTime: "", returnTime: "", distance: null, elevation: "",
      includeLeader: false, includeMeal: false, includeInsurance: false, includeTransport: false, includeGear: false,
      photos: [], videos: [], highlights: [], intro: "", hook: "", body: [], sellingPoints: [], editorialTitle: "", posterTagline: "", pullQuote: "", storyPurpose: "", photoCaptions: [], itineraryDays: [], feeInclude: [], feeExclude: [],
      gear: [], gearManual: [], days: 1, difficulty: "轻松", tags: [], deposit: null, transport: "", contact: "", priceTBD: false, priceNote: "", childPrice: null, leaderIds: [], leaderName: "", leaderYears: "", leaderCert: "", leaderTrips: "", reviews: [], feeSummary: "", headline: "",
      safety: [], notesType: "", shareWechat: "", shareMoments: "", shareXhs: "", shareGzh: "", shareVoice: "",
      notes: "出发前 3 天可全额退；前 1 天退 50%；当天不退，但可转让名额。",
      status: "draft", createdAt: Date.now(), signups: 0, raw: "",
      pinned: false, pinnedAt: 0, ageManual: false,
      contentDirections: [], contentDirection: 0, contentApproved: false,
      brandTone: "",
    };
  }

  function getActivity(id) { return state.activities.find((x) => x.id === id); }

  /* ---------------- mock AI ---------------- */
  /* ---------------- 活动类型知识库（规则引擎：优先关键词，不让 AI 自由猜测） ---------------- */
  const TYPE_RULES = [
    { type: "高海拔登山", kw: ["大峰", "二峰", "三峰", "雪山", "登顶", "冲顶", "攀登", "冰川", "垭口", "高原", "那玛峰", "贡嘎", "雨崩", "狼塔", "鳌太", "梅里", "珠峰", "乞力马扎罗", "哈巴雪山", "技术型雪山"] },
    { type: "滑雪", kw: ["滑雪", "雪场", "双板", "单板", "滑雪教学", "雪季", "开板", "滑雪营"] },
    { type: "攀岩", kw: ["攀岩", "攀冰", "岩壁", "抱石", "攀岩馆"] },
    { type: "骑行", kw: ["骑行", "自行车", "骑车", "单车", "公路车"] },
    { type: "桨板或皮划艇", kw: ["桨板", "皮划艇", "独木舟", "sup", "kayak"] },
    { type: "溯溪", kw: ["溯溪", "溪降", "溪谷", "玩水", "漂流"] },
    { type: "露营", kw: ["露营", "帐篷", "营地", "星空", "篝火", "天幕", "过夜营", "野营"] },
    { type: "跑步", kw: ["跑步", "马拉松", "越野跑", "夜跑", "晨跑"] },
    { type: "自驾旅行", kw: ["自驾", "开车", "房车", "自驾游"] },
    { type: "摄影旅行", kw: ["摄影", "旅拍", "风光摄影", "人像摄影", "扫街"] },
    { type: "企业团建", kw: ["团建", "拓展", "年会", "公司活动", "团队建设", "企业"] },
    { type: "研学", kw: ["研学", "自然教育", "夏令营", "冬令营", "独立营", "青少年营", "少年营"] },
    { type: "徒步", kw: ["徒步", "轻徒步", "穿越", "拉练", "步道", "徒步线路", "越野", "野路", "山脊", "爬山", "登山", "ridge", "trail", "登山徒步"] },
    { type: "城市旅行", kw: ["城市游", "城市旅行", "citywalk", "city walk", "夜景", "美食", "老街", "商圈", "博物馆", "步行街", "都市", "市区游", "周末游", "两日游", "三日游", "重庆", "上海", "北京", "西安", "长沙", "成都城区", "成都市区", "广州", "深圳", "杭州", "武汉", "南京", "苏州"] },
    { type: "景区观光", kw: ["景区", "观光", "打卡", "乐园", "古镇", "园林", "看展", "展览", "门票游", "周边游"] },
    { type: "综合旅行", kw: ["旅行", "游玩", "出游", "度假", "休闲游"] },
  ];
  const OUTDOOR_HARD = ["雪山", "登顶", "冲顶", "攀登", "冰川", "垭口", "高原", "大峰", "二峰", "三峰", "徒步", "爬山", "登山", "穿越", "拉练", "步道", "越野", "野路", "山脊", "露营", "帐篷", "营地", "滑雪", "雪场", "攀岩", "攀冰", "骑行", "自行车", "桨板", "皮划艇", "溯溪", "溪降", "跑步", "马拉松", "自驾", "摄影", "团建", "研学", "夏令营", "冬令营"];
  const PAGE_STYLE_MAP = {
    "城市旅行": "city", "景区观光": "sight", "徒步": "hike", "高海拔登山": "alpine", "露营": "camp",
    "亲子活动": "kids", "研学": "kids", "滑雪": "ski", "骑行": "cycling", "跑步": "run", "漂流": "water",
    "攀岩": "climb", "桨板或皮划艇": "water", "溯溪": "water", "自驾旅行": "drive",
    "摄影旅行": "photo", "企业团建": "team", "综合旅行": "travel", "户外探索": "outdoor",
  };
  // 编辑器下拉选项：value 为内部标准类型，label 为界面友好名称
  const TYPE_OPTIONS = [
    { value: "亲子活动", label: "亲子户外" },
    { value: "徒步", label: "徒步登山" },
    { value: "高海拔登山", label: "高海拔登山" },
    { value: "骑行", label: "骑行" },
    { value: "滑雪", label: "滑雪" },
    { value: "溯溪", label: "溯溪/漂流" },
    { value: "桨板或皮划艇", label: "桨板/皮划艇" },
    { value: "露营", label: "营地/露营" },
    { value: "城市旅行", label: "城市漫游" },
    { value: "景区观光", label: "景区观光" },
    { value: "摄影旅行", label: "摄影旅行" },
    { value: "企业团建", label: "企业团建" },
    { value: "综合旅行", label: "综合旅行" },
    { value: "户外探索", label: "户外探索" }
  ];
  // 高风险地点仅作参考；年龄 / 难度收紧必须结合「强风险关键词 + 海拔 + 天数 + 距离」综合判断，不能只凭地点名称
  const HIGH_RISK_PLACES = ["牛背山", "四姑娘山", "四姑娘", "哈巴雪山", "哈巴", "贡嘎", "雨崩", "狼塔", "鳌太", "梅里", "珠峰", "乞力马扎罗", "那玛峰", "华山", "黄山", "泰山", "峨眉山", "青城山", "青城后山", "赵公山", "鹤鸣山", "虹口"];
  // 强风险关键词：只有活动文本命中这些词才上调年龄 / 难度（如「大峰登顶」才算高风险；双桥沟观光、青城山亲子徒步都不算）
;
  const CITY_NAMES = ["重庆", "上海", "北京", "西安", "长沙", "成都城区", "成都市区", "广州", "深圳", "杭州", "武汉", "南京", "苏州", "成都", "天津", "青岛", "厦门", "昆明"];

  // 编辑器下拉框选项可能与内部标准类型名称不同，统一映射到标准类型
  function normalizeType(t) {
    const map = {
      "徒步登山": "徒步",
      "漂流": "溯溪",
      "营地": "露营",
      "亲子户外": "亲子活动",
    };
    return map[t] || t;
  }
  // 风险年龄收紧：须同时满足「户外类活动」+（强风险关键词 或 高海拔≥3500 或 长线≥15km 或 多日≥3天），不单凭地点名称



