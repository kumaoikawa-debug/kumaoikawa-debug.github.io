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
  function departureFromDate(dstr, price, capacity) {
    const ymd = parseDateToYMD(dstr);
    if (!ymd) return null;
    const cap = (capacity != null && +capacity > 0) ? Math.round(+capacity) : null;
    return { id: uid(), date: ymd, dateMD: formatDepartureMD(ymd), weekDay: weekDayName(ymd), price: price || null, capacity: cap, status: "open", note: "", signups: 0 };
  }

  /* v197 团期批量生成：把「日期区间 + 发团节奏」展开成一组出发日（纯函数，便于契约测试）
     freq: "daily" 每天 | "weekly" 每周指定星期几 | "interval" 每隔 N 天
     weekdays: [0..6]，0=周日（仅 weekly 生效）；interval: 间隔天数（仅 interval 生效）
     返回升序 yyyy-mm-dd 数组；起始日无效或区间倒置返回 [] */
  function depBatchDates(opt) {
    opt = opt || {};
    const start = parseDateToYMD(opt.start || "");
    if (!start) return [];
    const end = parseDateToYMD(opt.end || "") || start;
    if (end < start) return [];
    const freq = opt.freq || "daily";
    const weekdays = (opt.weekdays || []).map(Number).filter((n) => n >= 0 && n <= 6);
    const interval = Math.max(1, Math.min(60, Math.round(+opt.interval) || 1));
    const out = [];
    const d = new Date(start + "T00:00:00");
    const last = new Date(end + "T00:00:00");
    let i = 0;
    for (let cur = new Date(d); cur <= last; cur.setDate(cur.getDate() + 1), i++) {
      let hit;
      if (freq === "weekly") hit = weekdays.length ? weekdays.indexOf(cur.getDay()) >= 0 : true;
      else if (freq === "interval") hit = (i % interval === 0);
      else hit = true;
      if (!hit) continue;
      out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`);
      if (out.length >= 400) break; // 安全上限：误选整年也不会生成上千条
    }
    return out;
  }

  /* v197 团期容量：优先 per-团期 capacity，缺省回退活动级 limit；两者都没有返回 null（不编造名额） */
  function depCapacityOf(d, a) {
    d = d || {};
    const c = (d.capacity != null && +d.capacity > 0) ? Math.round(+d.capacity) : null;
    if (c) return c;
    return (a && a.limit != null && +a.limit > 0) ? Math.round(+a.limit) : null;
  }
  /* v197 余位：只在有容量时计算，否则 null（UI 必须显示「名额未定」而不是 0） */
  function depRemainingOf(d, a) {
    const cap = depCapacityOf(d, a);
    if (cap == null) return null;
    return Math.max(0, cap - (+((d || {}).signups || 0)));
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
    gift: '<path d="M20 12v10H4V12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
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
    "x-circle": '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6"/><path d="M9 9l6 6"/>',
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
    "shopping-cart": '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
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
    /* v197 后台面板补充图标（未注册的 ICON() 会静默渲染空白） */
    info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    video: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    "dollar-sign": '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    "alert-triangle": '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
    package: '<line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    "map-pin": '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    "user-check": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
    "file-text": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
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
        s.detailMode = "editorial"; // v196：详情页统一为图文长页（「简洁报名 / 图文长页」二选一已下线，不再暴露给老板）
        s.clubStatus = s.clubStatus || "approved";
        s.clubInfo = s.clubInfo || {};
        s.points = s.points == null ? 0 : +s.points;
        s.pointsLedger = s.pointsLedger || [];
        s.memberMarketing = Object.assign(defaultMemberMarketing(), s.memberMarketing || {});
        /* v199 一次性种子：老数据里 points 恒为 0 且券都对活动不可用，
           会让「会员价 / 积分抵现 / 优惠券」在 C 端完全看不出效果。只补一次，不覆盖更高余额。 */
        if (!s._mmSeedV199) {
          s._mmSeedV199 = true;
          if (!(s.points > 0)) { s.points = 2600; s.pointsLedger.unshift({ id: uid(), type: "earn", points: 2600, reason: "历史活动累积", refId: "", at: Date.now() - 86400000 * 12 }); }
          if (!(s.coupons || []).some((c) => c && c.seedV199)) {
            (s.coupons = s.coupons || []).push({ id: uid(), title: "会员满 100 减 20", type: "reduce", threshold: 100, value: 20, scope: "all", total: 800, claimed: 156, used: 73, status: "active", createdAt: Date.now() - 86400000 * 2, seedV199: true });
          }
        }
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
        /* v157 自愈：独立键还在但主状态缺镜像时补回来（老用户无需重新输入 Key；
           补上后下一次 saveState 即持久化，往后独立键丢失也能恢复）。 */
        try {
          if (!s.aiKey) { var _ak = (localStorage.getItem(AI_LS_KEY) || "").trim(); if (_ak) s.aiKey = _ak; }
          /* v157 自愈：视觉独立键还在但主状态缺镜像时补回（与 aiKey 同理；
             独立键是用户录入的源，镜像为备份，读时 visionGet 优先独立键、丢失再回退镜像） */
          var _vc = s.visionCfg || {};
          if (typeof VISION_LS !== "undefined" && VISION_LS) {
            ["provider", "key", "model", "baseUrl"].forEach(function (kk) {
              if (!_vc[kk]) { var _vk = (localStorage.getItem(VISION_LS[kk]) || "").trim(); if (_vk) _vc[kk] = _vk; }
            });
          }
          s.visionCfg = _vc;
        } catch (e) {}
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
      detailMode: "editorial", // v196：种子态也统一为图文长页（mode 二选一已下线）
      customerTab: "list",
      customerSearch: "",
      customerMemberFilter: "all",
      customerPhoneFilter: "all",
      customerStartDate: "",
      customerEndDate: "",
      plan: "club",
      clubStatus: "approved",
      clubInfo: {},
      /* v199：演示账号给一档「金卡会员」的积分（2000 起），否则会员价/积分抵现
         在 C 端永远看不到效果（余额 0 → 普通等级 → 档位价等于原价 → 视觉上「没实现」）。 */
      points: 2600,
      pointsLedger: [
        { id: uid(), type: "earn", points: 2600, reason: "历史活动累积", refId: "", at: Date.now() - 86400000 * 12 }
      ],
      memberMarketing: defaultMemberMarketing(),
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
      mallFilter: { keyword: "", category: "all", gear: "all", tag: "all", sort: "default" },
      mallCart: [],
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
        { id: uid(), title: "生日专享满 300 减 80", type: "reduce", threshold: 300, value: 80, scope: "all", total: 100, claimed: 23, used: 9, status: "active", createdAt: Date.now() - 86400000 },
        { id: uid(), title: "会员满 100 减 20", type: "reduce", threshold: 100, value: 20, scope: "all", total: 800, claimed: 156, used: 73, status: "active", createdAt: Date.now() - 86400000 * 2 }
      ],
      referral: { enabled: true, inviterPoints: 200, inviteePoints: 100, totalInvites: 36, successInvites: 12 },
      mmTab: "tiers",
      homeLayout: JSON.parse(JSON.stringify(DEFAULT_HOME_LAYOUT)),
      decorateEdit: null,
      /* v157：AI Key 与视觉配置的「主状态镜像」。
         必须在这里声明默认值 —— saveState() 是把内存 state 整个序列化写回，
         若字段不在 state 里，任何一次普通 saveState 都会把镜像抹掉（v141 的兜底因此实测失效）。 */
      aiKey: "",
      visionCfg: {},
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
  function getAIKey() {
    try {
      var k = (localStorage.getItem(AI_LS_KEY) || "").trim();
      if (k) return k;
      /* 兜底：从主状态 clubos_v1.aiKey 恢复（更新后单独键若丢失可找回；boot.js 仅清 .xf，不动 aiKey） */
      var st = JSON.parse(localStorage.getItem("clubos_v1") || "{}");
      if (st && st.aiKey) return st.aiKey;
    } catch (e) {}
    return "";
  }
  function setAIKey(v) {
    try {
      v = (v || "").trim();
      if (v) localStorage.setItem(AI_LS_KEY, v);
      /* 同时镜像进主状态，随 clubos_v1 持久化，避免更新/误清后丢失 */
      var st = JSON.parse(localStorage.getItem("clubos_v1") || "{}");
      if (!st || typeof st !== "object") st = {};
      if (v) st.aiKey = v; else delete st.aiKey;
      localStorage.setItem("clubos_v1", JSON.stringify(st));
      /* v157：同步更新内存 state —— 否则紧随其后的 saveState() 会用不含 aiKey 的 state 覆盖掉上面的镜像 */
      if (typeof state !== "undefined" && state && typeof state === "object") {
        if (v) state.aiKey = v; else delete state.aiKey;
      }
    } catch (e) {}
  }
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
        body: JSON.stringify({ code: code, merchant_id: mid }),
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

  /* ================= v199 会员营销引擎（会员价 / 积分抵现 / 优惠券） =================
     为什么要有这一层：老板反馈「会员价格这一套营销包括积分，这些都没有实现」。
     实测根因三条 ——
       ① 会员价只作用于 a.price，档位价若等于基础价，客户眼里「什么都没变」；
       ② 积分只有 state.points 一个数字：没有任何地方发放，也没有任何地方抵扣；
       ③ 优惠券后台能建、首页能领，报名流程完全不读它。
     所以这里把三者收敛成可计算的规则，详情页 / C 端 / 报名结算共用同一份实现。 */

  /* 默认规则用「函数声明」而非 const —— seedState() 在文件前部定义并被提前调用，
     而 const 存在 TDZ，声明在后面的常量在 seedState 执行时读不到。 */
  function defaultMemberMarketing() {
    return {
      pointsEnabled: true,     // 会员积分抵现总开关
      pointsPerYuan: 100,      // 100 积分 = 1 元
      maxRedeemPercent: 20,    // 单笔最多抵扣订单额的 20%
      minRedeemPoints: 100,    // 单笔起抵积分（不足则不让抵，避免 0.01 元的碎抵扣）
      earnPerYuan: 1,          // 每消费 1 元累积 1 积分（再乘会员等级 pointsRate 倍率）
    };
  }

  function memberMarketingCfg() {
    const m = (state && state.memberMarketing) || {};
    const d = defaultMemberMarketing();
    const n = (v, fb) => (typeof v === "number" && isFinite(v) && v >= 0 ? v : (isFinite(+v) && +v >= 0 && v !== "" ? +v : fb));
    return {
      pointsEnabled: m.pointsEnabled == null ? d.pointsEnabled : !!m.pointsEnabled,
      pointsPerYuan: Math.max(1, n(m.pointsPerYuan, d.pointsPerYuan)),
      maxRedeemPercent: Math.min(100, n(m.maxRedeemPercent, d.maxRedeemPercent)),
      minRedeemPoints: n(m.minRedeemPoints, d.minRedeemPoints),
      earnPerYuan: n(m.earnPerYuan, d.earnPerYuan),
    };
  }

  /* 积分余额：单一真源是 state.points；流水（state.pointsLedger）只做审计展示，不反算余额。 */
  function memberPointsBalance() {
    const p = state && state.points;
    return (typeof p === "number" && isFinite(p) && p > 0) ? Math.floor(p) : (isFinite(+p) && +p > 0 ? Math.floor(+p) : 0);
  }
  function pointsToYuan(pts) {
    const c = memberMarketingCfg();
    return Math.floor(Math.max(0, +pts || 0) / c.pointsPerYuan * 100) / 100;
  }
  /* 等级 pointsRate 的单位是「几元赠送 1 积分」（见会员等级编辑面板文案「___ 元赠送1积分」，
     默认 普通1 / 银卡1 / 金卡0.8 / 黑卡0.5 —— 数值越小越慷慨）。它不是「倍率」：
     等级 benefits 文案写「报名积分 1.5 倍」而字段存 0.8，两者只有在
     「0.8 元 = 1 积分 = 1.25 积分/元」的解释下才自洽，故此处按元/积分换算。
     顺带把这个字段从「只存不用」变成真正参与计算。 */
  function pointsRateOf(tier) {
    return (tier && +tier.pointsRate > 0) ? +tier.pointsRate : 1;
  }
  function pointsPerYuanOf(tier) {
    const c = memberMarketingCfg();
    if (tier && tier.pointsEnabled === false) return 0;   // 该等级未开启「消费送积分」
    return Math.round((c.earnPerYuan / pointsRateOf(tier)) * 1000) / 1000;
  }
  function yuanToPoints(y, tier) {
    return Math.floor(Math.max(0, +y || 0) * pointsPerYuanOf(tier));
  }
  function pointsLedgerOf() { return (state && Array.isArray(state.pointsLedger)) ? state.pointsLedger : []; }
  function pushPointsLedger(entry) {
    if (!state) return;
    state.pointsLedger = Array.isArray(state.pointsLedger) ? state.pointsLedger : [];
    state.pointsLedger.unshift(Object.assign({ id: "pl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now() }, entry));
    state.pointsLedger = state.pointsLedger.slice(0, 200);
  }
  /* 发放积分（消费赠分 / 等级赠分 / 邀请奖励）—— 写余额并留痕 */
  function grantMemberPoints(pts, reason, refId) {
    const n = Math.floor(Math.max(0, +pts || 0));
    if (!n) return 0;
    state.points = memberPointsBalance() + n;
    pushPointsLedger({ type: "earn", points: n, reason: reason || "累积积分", refId: refId || "" });
    return n;
  }
  /* 扣减积分 —— 余额不足则整体不扣（不产生负数余额） */
  function redeemMemberPoints(pts, reason, refId) {
    const n = Math.floor(Math.max(0, +pts || 0));
    const bal = memberPointsBalance();
    if (!n || n > bal) return 0;
    state.points = bal - n;
    pushPointsLedger({ type: "spend", points: n, reason: reason || "积分抵现", refId: refId || "" });
    return n;
  }

  /* ---------- 价格真源：会员价 > 团期价 > 活动基础价 ---------- */
  function priceBaseOf(a, dep) {
    if (dep && dep.price != null && isFinite(+dep.price)) return +dep.price;
    return (a && a.price != null && isFinite(+a.price)) ? +a.price : null;
  }
  function effectiveUnitPrice(a, dep, tier) {
    const base = priceBaseOf(a, dep);
    if (base == null) return null;
    if (!a || !a.useMemberPrice) return base;
    const t = tier || currentMemberTier();
    if (!t) return base;
    const tp = (a.tierPrices || {})[t.id];
    if (tp != null && isFinite(+tp)) return +tp;
    if (t.discount && t.discount < 100) return Math.round(base * t.discount / 100);
    return base;
  }
  /* 会员权益：hasBenefit 只在「会员价真的低于原价」时为 true。
     这一条是防「假优惠」的关键 —— 档位价等于基础价时页面不该出现任何会员价字样，
     否则老板看到的就是「普通会员价 ¥180」，与没有会员价毫无区别。 */
  function memberBenefitOf(a, dep) {
    const base = priceBaseOf(a, dep);
    const member = effectiveUnitPrice(a, dep);
    const tier = (typeof currentMemberTier === "function") ? currentMemberTier() : null;
    const hasBenefit = !!(a && a.useMemberPrice && base != null && member != null && member < base);
    return { base: base, member: member, tier: tier, hasBenefit: hasBenefit, savePerUnit: hasBenefit ? base - member : 0 };
  }
  /* 跨等级最低会员价（未登录/未定级时展示「会员价 ¥X 起」） */
  function memberBestPriceOf(a, dep) {
    if (!a || !a.useMemberPrice) return null;
    const base = priceBaseOf(a, dep);
    const prices = (state.memberTiers || []).map(function (t) {
      const tp = (a.tierPrices || {})[t.id];
      if (tp != null && isFinite(+tp)) return +tp;
      if (t.discount && t.discount < 100 && base != null) return Math.round(base * t.discount / 100);
      return null;
    }).filter(function (p) { return p != null; });
    if (!prices.length) return null;
    const min = Math.min.apply(null, prices);
    return (base != null && min < base) ? min : null;
  }
  /* 详情页/列表统一价格 HTML：有真优惠才展示会员价与原价划线 */
  function priceDisplayHtml(a, dep, opts) {
    opts = opts || {};
    const unit = esc((a && a.limitUnit) || "人");
    const base = priceBaseOf(a, dep);
    if (base == null) return "详询";
    const ben = memberBenefitOf(a, dep);
    const suffix = opts.bare ? "" : "<small>/" + unit + "</small>";
    if (!ben.hasBenefit) {
      const best = opts.showRange === false ? null : memberBestPriceOf(a, dep);
      if (best != null) return '<b class="pp-base-only">¥' + base + "</b>" + suffix + '<span class="pp-tier pp-tier-plain">会员价 ¥' + best + " 起</span>";
      return "¥" + base + suffix;
    }
    const tierName = (ben.tier && ben.tier.name) ? ben.tier.name : "会员";
    return '<b class="pp-mem">¥' + ben.member + "</b>" + suffix
      + '<span class="pp-tier">' + esc(tierName) + "价</span>"
      + '<s class="pp-base">¥' + base + "</s>";
  }
  function memberPriceNoteText(a, dep) {
    const ben = memberBenefitOf(a, dep);
    if (ben.hasBenefit) return (ben.tier ? ben.tier.name : "会员") + "省 ¥" + ben.savePerUnit + (a.limitUnit ? "/" + a.limitUnit : "");
    return "";
  }

  /* ---------- 优惠券：可用性 / 抵扣额 ---------- */
  /* 活动报名只认「全场通用」券；scope=gear（装备专用）属于商城，不在报名里打折。 */
  function couponUsableFor(cp, amount, a) {
    if (!cp || cp.status !== "active") return false;
    if (cp.scope && cp.scope !== "all") return false;
    if (cp.total != null && cp.claimed != null && +cp.claimed >= +cp.total) return false;
    if (+cp.threshold > 0 && +amount < +cp.threshold) return false;
    return true;
  }
  function couponDiscountOf(cp, amount) {
    const amt = Math.max(0, +amount || 0);
    if (!cp) return 0;
    if (cp.type === "discount") {
      const rate = +cp.value > 0 ? +cp.value : 100;            // value=90 → 打 9 折
      return Math.round(amt * (100 - rate) / 100 * 100) / 100;
    }
    return Math.min(+cp.value || 0, amt);                       // 满减券不超过订单额
  }
  function usableCouponsFor(a, amount) {
    if (!a || !a.allowCoupons) return [];
    return (state.coupons || []).filter(function (cp) { return couponUsableFor(cp, amount, a); });
  }
  function couponTitleOf(cp) {
    if (!cp) return "";
    return cp.type === "discount" ? ((cp.value / 10) + " 折券") : ("¥" + cp.value + " 满减券");
  }

  /* 详情页「费用说明」下方的营销补充行：积分抵现额度 + 本单可用券。
     诚实原则：余额不足 / 无可用券时给明确说法，不写「名额有限」之类无法验证的紧迫话术。 */
  function memberMarketingExtrasHtml(a, amount) {
    if (!a) return "";
    const rows = [];
    const cfg = memberMarketingCfg();
    if (a.allowPoints && cfg.pointsEnabled) {
      const bal = memberPointsBalance();
      const capYuan = Math.round(Math.max(0, +amount || 0) * cfg.maxRedeemPercent) / 100;
      if (bal <= 0) {
        rows.push('<div class="fee-note fee-note-soft"><span class="fn-ic">' + ICON("gift") + '</span><span>本活动支持积分抵现（' + cfg.pointsPerYuan + ' 积分 = ¥1，单笔最多抵 ' + cfg.maxRedeemPercent + '%）；当前账号暂无可用积分</span></div>');
      } else {
        const usable = Math.min(bal, Math.floor(capYuan * cfg.pointsPerYuan));
        const canUse = usable >= cfg.minRedeemPoints;
        rows.push('<div class="fee-note fee-note-soft"><span class="fn-ic">' + ICON("gift") + '</span><span>积分抵现：可用 ' + bal + ' 积分'
          + (canUse ? '，本单最多抵 <b>¥' + pointsToYuan(usable) + '</b>（单笔上限 ' + cfg.maxRedeemPercent + '%）' : '，暂未达到 ' + cfg.minRedeemPoints + ' 积分的起抵线')
          + '</span></div>');
      }
    }
    if (a.allowCoupons) {
      const cps = usableCouponsFor(a, amount);
      if (cps.length) {
        rows.push('<div class="fee-note fee-note-soft"><span class="fn-ic">' + ICON("ticket") + '</span><span>本单可用优惠券：' + cps.map(function (c) { return esc(c.title); }).join("、") + '</span></div>');
      } else {
        rows.push('<div class="fee-note fee-note-soft"><span class="fn-ic">' + ICON("ticket") + '</span><span>本单暂无可用优惠券（未达到券的使用门槛，或券不适用于活动报名）</span></div>');
      }
    }
    return rows.join("");
  }

  /* ---------- 统一结算：会员价 → 优惠券 → 积分抵现 → 应付 ---------- */
  function orderBreakdown(a, opts) {
    opts = opts || {};
    const cfg = memberMarketingCfg();
    const dep = opts.dep || null;
    const adults = Math.max(0, Math.floor(+opts.adults || 0));
    const children = Math.max(0, Math.floor(+opts.children || 0));
    const ben = memberBenefitOf(a, dep);
    const unit = ben.member != null ? ben.member : (a && a.price != null ? +a.price : 0);
    const rawUnit = ben.base != null ? ben.base : unit;
    const childRaw = (a && a.childPrice != null) ? +a.childPrice : rawUnit;
    const childUnit = ben.hasBenefit && rawUnit > 0 ? Math.round(childRaw * unit / rawUnit) : childRaw;

    const rawSubtotal = adults * rawUnit + children * childRaw;
    const subtotal = adults * unit + children * childUnit;
    const memberSaved = Math.max(0, Math.round((rawSubtotal - subtotal) * 100) / 100);

    let coupon = null, couponDiscount = 0;
    if (a && a.allowCoupons && opts.couponId) {
      const cp = (state.coupons || []).find(function (x) { return x.id === opts.couponId; });
      if (cp && couponUsableFor(cp, subtotal, a)) { coupon = cp; couponDiscount = couponDiscountOf(cp, subtotal); }
    }
    const afterCoupon = Math.max(0, Math.round((subtotal - couponDiscount) * 100) / 100);

    let pointsUsed = 0;
    const balance = memberPointsBalance();
    if (a && a.allowPoints && cfg.pointsEnabled && opts.usePoints) {
      const capYuan = Math.round(afterCoupon * cfg.maxRedeemPercent) / 100;
      const capPts = Math.floor(capYuan * cfg.pointsPerYuan);
      const maxPts = Math.min(balance, capPts);
      if (maxPts >= cfg.minRedeemPoints) pointsUsed = maxPts;
    }
    const pointsDiscount = Math.min(pointsToYuan(pointsUsed), afterCoupon);
    const payable = Math.max(0, Math.round((afterCoupon - pointsDiscount) * 100) / 100);
    const pointsEarned = yuanToPoints(payable, ben.tier);

    return {
      tier: ben.tier, hasMemberBenefit: ben.hasBenefit,
      unit: unit, rawUnit: rawUnit, childUnit: childUnit, adults: adults, children: children, qty: adults + children,
      rawSubtotal: rawSubtotal, subtotal: subtotal, memberSaved: memberSaved,
      coupon: coupon, couponDiscount: couponDiscount,
      pointsBalance: balance, pointsUsed: pointsUsed, pointsDiscount: pointsDiscount,
      payable: payable, pointsEarned: pointsEarned,
      maxRedeemPercent: cfg.maxRedeemPercent, pointsPerYuan: cfg.pointsPerYuan,
    };
  }

/* ================= v201 文案事实闸门（文学层 / 事实层边界） =================
   老板反馈：「为什么文案里面老是出现时间、日期，我们要的文案是有语言美感的，
   不是这种没有艺术的数字。」根因两条 ——
     ① 本地角度模板 EDITORIAL_ANGLE_VOICE 把 {D}(日期) / {startTime}(时刻) /
        {distWord}(公里) / {eleWord}(海拔) / {limit}(人数) 直接填进标题、导语、正文、金句；
     ② AI prompt 曾要求正文「最后给决策信息」→ AI 就在正文末尾播报
        「9月20日单日往返｜98元/人｜限15人｜4小时车程」。

   边界原则不是「删掉数字」，而是**分层**：
     · 事实层 —— 决策速览 / 数据条 / 行程时间轴 / 费用说明 / 报名结算 / 后台面板
       → 保留精确数字，**一个字都不动**（客户要据此做决策、下单、核对）。
     · 文学层 —— 标题 / 副标题 / 导语 / 正文段落 / 金句 / hero 摘要
       → 只谈画面、节奏与感受，参数一律剥离。

   闸门两件事：
     1) factBroadcastHits(text)：列出这段文字里的「硬参数」（日期/时刻/价格/名额/
        里程/海拔/年龄/天数）。
     2) sanitizeLiteraryText(text)：专用于文学层。命中 ≥3 处（或含 ≥2 个竖线且
        有参数）的句子判定为「参数播报行」→ 整句丢弃；否则就地剥离参数并收拾标点；
        剥离后残余汉字 < 4 或结尾悬空（约/共/达/左右…）也整句丢弃 ——
        宁可少一句，也不留一句读不通的。
   ------------------------------------------------------------------------- */

/* 每条规则都带上「引导词」（全程 / 约 / 限 / 海拔 / 价格…）。
   若只删数字本身，「全程约 25 公里，一路都在换视野」会被削成
   「全程约 ，一路都在换视野」这种断句 —— 所以引导词必须一起吃掉。 */
/* ★ 日期规则里**不认**独立的「周X / 星期X」：
   「走完回来，周一没那么难熬了。」是文学说法（指代「休息之后」），不是日期参数；
   早先把它算作日期，会把这类正常句子判成参数句而丢进闸门（v201 契约 B1 实测误伤）。
   真正的日期表达（9月20日 / 9/20 / 2026-09-20 / 9月）已由下面各分支覆盖。 */
const FACT_LITERAL_RULES = [
  { key: "date", re: /(?:\d{4}\s*年\s*)?\d{1,2}\s*月份?(?:\s*\d{1,2}\s*[日号]?)?|\d{4}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,2}|\d{1,2}\s*[\/／]\s*\d{1,2}(?!\d)/g },
  { key: "time", re: /(?:上午|下午|早上|傍晚|晚上|中午|凌晨)?\s*\d{1,2}\s*[:：]\s*\d{2}(?:\s*[-–~至]\s*\d{1,2}\s*[:：]\s*\d{2})?/g },
  /* ★ v203 补漏：原规则只认「数字+元/块」，于是本地模板里的
     「费用98一人」完全漏网（没有「元」字）。改为「引导词 + 数字」即可命中，
     并保留「数字+元/块」「¥+数字」两条老分支。引导词是硬要求 —— 没有引导词时
     必须带货币符号或单位，否则「长 25」这种正常词组会被误判成价格。 */
  { key: "price", re: /(?:价格|人均|每人|只需|只要|仅需|仅|费用|收费|团费|总价)\s*(?:¥|￥|RMB)?\s*\d+(?:\.\d+)?\s*(?:元|块钱|块)?(?:\s*\/\s*[人位份次])?|(?:¥|￥|RMB)\s*\d+(?:\.\d+)?(?:\s*\/\s*[人位份次])?|\d+(?:\.\d+)?\s*(?:元|块钱|块)(?:\s*\/\s*[人位份次])?/g },
  { key: "dist", re: /(?:全程|单程|全长|距离|累计|长约|大约|约|共|达)?\s*\d+(?:\.\d+)?\s*(?:公里|千米|km|KM|Km)/g },
  { key: "elev", re: /(?:海拔|累计爬升|爬升|上升|下降|落差)?\s*\d+(?:\.\d+)?\s*米(?![兰克])/g },
  { key: "quota", re: /(?:限|仅限|限额|人数|控制在|仅收)?\s*\d+\s*(?:人|位|名)(?![们民生])/g },
  { key: "age", re: /(?:年龄|适合)?\s*\d+\s*[-–~至]\s*\d+\s*岁|\d+\s*岁/g },
  { key: "count", re: /\d+\s*天(?!气)/g },
  /* 时长 / 车程：「4小时车程」也是参数（老板截图里那行参数串就含它）。
     只认「数字 + 时间单位」，不碰「一小时后」这种文学说法（那是中文数词）。 */
  { key: "dur", re: /(?:车程|路程|耗时|用时|时长|需要|大约|约|共)?\s*\d+(?:\.\d+)?\s*(?:小时|分钟|分钟车程|h)(?![时时])/g },
];

/* 逐条收集「硬参数」命中项。用 String.match(/g) 而非 exec —— 后者会污染
   模块级正则的 lastIndex，导致同一段文字第二次检测结果不一致。 */
function factBroadcastHits(text) {
  const s = String(text == null ? "" : text);
  const hits = [];
  for (let i = 0; i < FACT_LITERAL_RULES.length; i++) {
    const m = s.match(FACT_LITERAL_RULES[i].re);
    if (m) for (let j = 0; j < m.length; j++) { const t = String(m[j]).trim(); if (t) hits.push(t); }
  }
  return hits;
}

/* 把句子列表切成「句」——不用 lookbehind（旧 Safari 不支持），手工扫描更稳。 */
function splitLiterarySentences(src) {
  const parts = []; let buf = "";
  const enders = "。！？!?；;\n";
  for (let i = 0; i < src.length; i++) {
    const ch = src.charAt(i);
    buf += ch;
    if (enders.indexOf(ch) >= 0) { parts.push(buf); buf = ""; }
  }
  if (buf) parts.push(buf);
  return parts;
}

/* 单行净化：剥离参数、丢弃参数播报行、丢弃剥离后不成句的残句。 */
/* 参数两侧是否算「边界」：段首/段尾、或标点。
   只有两侧都是边界时，剥离才安全（参数本身就是整个分句）。 */
function isFactLiteralEdge(ch) {
  if (!ch) return true;
  return /[，。、；：｜|！？!?()（）【】「」·\-—\/]/.test(ch);
}
/* 单个分句的安全剥离。
   ★ 为什么这么严：参数**嵌在短语中间**时硬删会造出破句 ——
     「把9月20日留给朋友」→「把留给朋友」、「走完这12公里」→「走完这」。
     所以只有「参数本身就是整个分句」（两侧是边界或标点）时才剥离；
     否则报不安全，由调用方整句丢弃。宁可少一句，也不留破句。 */
function factStripSafe(seg) {
  const text = String(seg == null ? "" : seg);
  let unsafe = false;
  for (let r = 0; r < FACT_LITERAL_RULES.length; r++) {
    const re = new RegExp(FACT_LITERAL_RULES[r].re.source, "g");
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) { re.lastIndex++; continue; }
      const p0 = m.index, p1 = p0 + m[0].length;
      const before = text.slice(0, p0).replace(/\s+$/, "").slice(-1);
      const after = text.slice(p1).replace(/^\s+/, "").charAt(0);
      if (!isFactLiteralEdge(before) || !isFactLiteralEdge(after)) unsafe = true;
    }
  }
  if (unsafe) return { ok: false, text: "" };
  let out = text;
  for (let r = 0; r < FACT_LITERAL_RULES.length; r++) out = out.replace(FACT_LITERAL_RULES[r].re, "");
  out = out.replace(/[（(]\s*[）)]/g, "").replace(/【\s*】/g, "").replace(/「\s*」/g, "")
    .replace(/[｜|]+/g, "")
    /* 参数被吃掉后会留下空隔断：「社交 · 9月20日 · 25 公里 · 中等强度」→「社交 · · 中等强度」。
       先把连续/空的中圆点合并，再统一中圆点两侧间距，避免出现「· ·」这种残渣。 */
    /* 用「一串中圆点」而非「两个中圆点」：全局替换不重叠，
       三个点只会并成两个（实测）。这里要求 ≥2 个才合并，一次到位。 */
    .replace(/[·・](?:\s*[·・])+/g, "·")
    .replace(/\s*[·・]\s*/g, " · ")
    .replace(/([，。、；：])\s*[·・]/g, "$1")
    .replace(/[·・]\s*([，。、；：])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s·、]+|[\s·、]+$/g, "").trim();
  return { ok: true, text: out };
}

/* 单行净化（完整闸门）：剥离参数、丢弃参数播报行、丢弃剥离后不成句的残句。 */
function sanitizeLiteraryPass(line) {
  const src = String(line == null ? "" : line);
  if (!src.trim()) return "";
  const parts = splitLiterarySentences(src);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const sent = parts[i].trim();
    if (!sent) continue;
    const hits = factBroadcastHits(sent);
    /* 干净句原样放行 —— 这是「文学层不误伤」的保险：
       没有参数就不做任何标点重排与断句取舍（否则「这一天…脚下。」这类
       正常句子会被规则误伤）。 */
    if (!hits.length) { out.push(sent); continue; }
    /* ★ 这里**不做**「参数播报行整句丢弃」的短路。
       实测（v201 契约 A2b）：播报串常与正常句共处一句、中间没有句号 ——
       「9月20日单日往返｜98元/人｜限15人｜4小时车程｜海拔800米走路的时候，话题自然就有了。」
       若整句丢弃，后半句好文案会被一起带走；若整句保留，参数又漏出去。
       所以统一交给下面「逐分句 × 逐参数片段」处理：
       参数两侧是边界（段首/段尾/标点）才剥离，嵌在短语中间的只丢那一片。 */
    // 逐「分句」处理：只有参数本身就是整个分句时才剥离，
    // 嵌入短语中间的（把9月20日留给朋友 / 走完这12公里）整个分句丢弃。
    const segs = sent.split(/[，、]/);
    const kept = [];
    for (let k = 0; k < segs.length; k++) {
      const seg = segs[k];
      if (!factBroadcastHits(seg).length) { kept.push(seg); continue; }
      const r = factStripSafe(seg);
      if (!r.ok) continue;                                       // 参数嵌在短语中间 → 丢
      const han = (r.text.match(/[\u4e00-\u9fa5]/g) || []).length;
      if (han < 5) continue;                                     // 参数占了大头 → 丢
      kept.push(r.text);
    }
    const endM = sent.match(/[。！？!?；;]+$/);
    let s2 = kept.join("，").replace(/\s{2,}/g, " ")
      .replace(/^[，。、；：｜|·\s]+/, "").replace(/[，。、；：｜|·\s]+$/, "")
      .replace(/^(?:以及|还有|和|与|及|或者|或|并|且)[，、]?/, "")
      .trim();
    // 末段被丢掉时句末标点会一起消失 → 补回来，避免和下一句连成一片
    if (endM && s2 && !/[。！？!?；;]$/.test(s2)) s2 += endM[0];
    // ③ 残句判定：汉字过少、或结尾悬空（被吃掉引导词后只剩半句）→ 丢弃。
    //    只认「数量连接词」类悬空尾（约/共/达/左右/上下/以内/之内）——
    //    早先把「下/上/内/和/的/了」也算进去，误杀了「…脚**下**。」这类正常句。
    const tail = s2.replace(/[。！？!?；;]+$/, "");
    const han2 = (tail.match(/[\u4e00-\u9fa5]/g) || []).length;
    if (han2 < 4) continue;
    if (/(?:约|共|达|左右|上下|以内|之内)$/.test(tail)) continue;
    out.push(s2);
  }
  return out.join("").replace(/\s{2,}/g, " ").trim();
}

/* 文学层净化（完整闸门）：**先把换行当段落边界切开**，再逐行逐句处理。
   ★ 必须先切行：早先把「\n」也算作句末符，导致多段导语被合并成一段
   （段与段之间的换行被 join("") 吃掉了）—— 段落结构属于排版，不能被净化改掉。 */
function sanitizeLiteraryText(text) {
  const src = String(text == null ? "" : text);
  if (!src.trim()) return "";
  return src.split(/\n+/).map(function (line) { return sanitizeLiteraryPass(line); })
    .filter(function (l) { return l && l.trim(); }).join("\n");
}

/* 文学层净化（轻量闸门）：只丢弃「参数播报行」，其余**一字不动**。
   用在「老板可能亲手写过」的字段（活动名称 / 导语 / 正文段落 / 金句 / 为什么值得去…）——
   完整闸门会就地剥离参数，落到人手写的句子上就变成替作者改句子了。
   判断依据用「参数播报行」的特征（≥3 个硬参数，或 ≥2 个竖线且带参数）：
   老板自己写「9月20日出发」是他的表达自由；但
   「9月20日单日往返｜98元/人｜限15人｜4小时车程」这种参数串不是文案，直接丢掉。 */
function stripBroadcastLines(text) {
  const src = String(text == null ? "" : text);
  if (!src.trim()) return "";
  return src.split(/\n+/).map(function (line) {
    const parts = splitLiterarySentences(line);
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const sent = parts[i].trim();
      if (!sent) continue;
      const hits = factBroadcastHits(sent);
      const bars = (sent.match(/[｜|]/g) || []).length;
      if (hits.length >= 3 || (bars >= 2 && hits.length >= 1)) continue;
      out.push(sent);
    }
    return out.join("");
  }).filter(function (l) { return l && l.trim(); }).join("\n");
}

/* 列表版：逐条净化并丢掉空项（避免净化后在页面留下一个大白块）。 */
function sanitizeLiteraryList(list) {
  return (Array.isArray(list) ? list : []).map(function (t) { return sanitizeLiteraryText(t); }).filter(Boolean);
}
function stripBroadcastList(list) {
  return (Array.isArray(list) ? list : []).map(function (t) { return stripBroadcastLines(t); }).filter(Boolean);
}

/* 文学层字段白名单 —— AI 落库时按这张表过闸门（事实层字段不在此列，绝不动）。 */
/* 文学层字段白名单 —— 按**键名**通用闸门（事实层字段不在此列，绝不动）。
   v201 只登记了活动详情页的字段；v203 把宣发产物的文学字段也纳入（gatePublishOut
   会先按结构逐平台精确处理，最后再按本表做一次键名兜底 —— 防止将来新增字段漏网）。 */
const LITERARY_FIELDS = ["body", "intro", "hook", "pullQuote", "whyGo", "experience", "gain",
  "marketingTitles", "title", "subtitle", "summary", "coverText", "headline", "posterLine",
  "titles", "warm", "formal", "last", "recruit", "brief", "s30", "s60", "next", "sub", "reason"];

/* ================= v203 宣发出口闸门（把 v201 的分层推广到「所有宣传文案」） =================
   老板反馈：「所有宣传文案中都不要出现日期、年龄、这些字段呀。」
   v201 只覆盖了活动详情页（长页 + 简洁页）；AI 宣发中心另有 6 个出口
   （公众号 / 小红书 / 朋友圈 / 微信群 / 口播 / 海报）**一条都没过闸门** ——
   本地回退模板在正文里播报日期与公里数，AI prompt 甚至明确要求微信群文案
   「包含时间、地点、价格」。

   判据与 v201 完全一致，只是把它**结构化**成两种可判定的形态：
     · 事实层 = 「带标签的信息」——
         ① 标签行（整行）：「🗓 时间：9月20日」「· 地点：青城后山」「💰 费用：¥98/人」
         ② 标签分句（冒号前 ≤8 字的短标签）：「活动类型：徒步」「集合：天府广场 07:30」
       → 原样保留，一个字不动（读者据此报名、决策与核对）。
     · 文学层 = 其余一切句子（标题 / 副标题 / 摘要 / 正文段落 / 朋友圈 / 口播 / 海报标语）
       → 过 sanitizeLiteraryPass：句中参数剥离、参数播报句丢弃。
   ------------------------------------------------------------------------- */

/* 「短标签 + 冒号」= 标签信息。开头允许 emoji / 圆点 / 星号等装饰符号。
   ★ 为什么必须要求「冒号」：
     「时间」是标签（时间是 9月20日 —— 事实），但「适合 16—55岁」是**播报**
     （没有标签、直勾勾一串数字），必须走文学层净化 —— 这正是老板要清的。
   ★ 标签长度限 8 字：再长就不是字段名而是句子了
     （「各位群友好，这场活动开始招募：」不该被当成字段行整行放行）。 */
function isPublishInfoSeg(seg) {
  const s = String(seg == null ? "" : seg).replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, "");
  return /^[^\s：:，。；、]{1,8}\s*[：:]/.test(s);
}

/* 宣发文案净化：逐行 → 逐句。标签行/标签分句原样保留，其余走完整闸门。 */
function sanitizePublishCopy(text) {
  const src = String(text == null ? "" : text);
  if (!src.trim()) return "";
  return src.split(/\n+/).map(function (line) {
    const parts = splitLiterarySentences(line);
    const out = [];
    for (let i = 0; i < parts.length; i++) {
      const sent = parts[i].trim();
      if (!sent) continue;
      if (isPublishInfoSeg(sent)) { out.push(sent); continue; }   // 事实层：标签信息，原样保留
      const clean = sanitizeLiteraryPass(sent);
      if (clean) out.push(clean);
    }
    return out.join("").replace(/\s{2,}/g, " ").trim();
  }).filter(function (l) { return l && l.trim(); }).join("\n");
}

/* HTML 版：**只净化标签之外的文本节点**，`<p>/<b>/<br>` 等标签与结构原样保留。
   ★ 为什么不能整段当纯文本净化：公众号正文段落形如
     `<p><b>时间</b> 9月20日；<b>地点</b> 青城后山；</p>` —— 值在标签**外面**，
     整段净化会把 `<b>` 也算作汉字，残句判定（汉字 <4 丢弃）与剥离边界全乱。
   注意：调用方（gatePublishOut）已按**章节标题**把「真实信息」这类事实章节整体排除，
   所以这里只处理表达段落。 */
function sanitizePublishHtml(html) {
  const src = String(html == null ? "" : html);
  if (!src.trim()) return "";
  if (src.indexOf("<") < 0) return sanitizePublishCopy(src);
  const out = src.replace(/(^|>)([^<]+)/g, function (all, pre, txt) {
    if (!txt || !txt.trim()) return all;
    return pre + sanitizePublishCopy(txt);
  });
  return out.replace(/<p>\s*<\/p>/g, "");
}

/* ---------------- v193 模块完整性清单（P0-5） ----------------
   「UI 有入口但函数不存在」是最难查的一类线上问题：按钮点下去才报错。
   这里把「必须存在」的模块集中登记；boot.js 在启动时调用 checkRequiredModules() 自检，
   缺失则 console.error（本地开发环境额外显示横幅）。放在 core.js 是为了让冒烟脚本
   （会跳过 boot.js）也能断言这张清单本身。 */
const REQUIRED_MODULE_FILES = {
  renderEconomics: "economics.js",
  renderPrep: "ops.js",
  renderPrepSummary: "ops.js",
  renderEconCostPanel: "economics.js",
  econAnswer: "economics.js",
  /* v199 会员营销引擎：报名结算与详情页都直接调它们，缺一个就是「点下去才报错」 */
  orderBreakdown: "core.js",
  effectiveUnitPrice: "core.js",
  memberBenefitOf: "core.js",
  priceDisplayHtml: "core.js",
  memberPointsBalance: "core.js",
  grantMemberPoints: "core.js",
  redeemMemberPoints: "core.js",
  usableCouponsFor: "core.js",
  couponDiscountOf: "core.js",
  /* v201 文案事实闸门：publish.js（模板/AI 落库）与 activities.js（渲染兜底）都直接调 */
  sanitizeLiteraryText: "core.js",
  sanitizeLiteraryList: "core.js",
  sanitizePublishCopy: "core.js",
  sanitizePublishHtml: "core.js",
  stripBroadcastLines: "core.js",
  stripBroadcastList: "core.js",
  factBroadcastHits: "core.js",
  /* v202 参与人群单一真源：publish.js 的 editorialFacts 与「适合谁」补充句都走它 */
  activityAudienceText: "publish.js",
  /* v204 上传方案解析：renderCreate 的入口与 shell.js 的解析编排都直接调它们 */
  intakeKindOf: "intake.js",
  intakePanelHtml: "intake.js",
  intakeRunFiles: "intake.js",
  intakeFromOoxml: "intake.js",
  /* v205/v206 方案结构化抽取：事实字段 + 按天行程 */
  intakeParseFields: "intake.js",
  intakeParseItinerary: "intake.js",
  visionReadPoster: "vision.js",
};
const REQUIRED_MODULES = Object.keys(REQUIRED_MODULE_FILES);
/* 返回「缺失的模块名 → 应在文件」清单；全部就绪返回空数组 */
function checkRequiredModules() {
  const out = [];
  for (let i = 0; i < REQUIRED_MODULES.length; i++) {
    const name = REQUIRED_MODULES[i];
    const hit = (typeof window !== "undefined" && window && typeof window[name] === "function")
      || (typeof globalThis !== "undefined" && globalThis && typeof globalThis[name] === "function");
    if (!hit) out.push(name + " → " + REQUIRED_MODULE_FILES[name]);
  }
  return out;
}
