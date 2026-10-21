/* ============ 三星堆研学 · SANXINGDUI ENIGMA · H5 测试版 ============
 * 暗夜青铜 / 神秘策展主题。依据 V1.5 PRD 与既有 Demo 架构重建。
 * 数据 localStorage 模拟；支付与微信登录为占位。
 */
'use strict';

const KEY = 'sxd_h5_';
let products = [], sessions = [], orders = [], certificates = [];
let backStack = [];
let state = {
  page: 'home', tab: 'home', filter: '全部',
  selectedProduct: 1, selectedSession: 101, quantity: 1,
  orderFilter: '全部', adminOrderFilter: '全部',
  certSearch: '', certResult: null,
  adminPage: 'dashboard', currentOrderId: null,
  courseSearch: '', payOrderId: null, payPaid: false,
  orderSearchKey: '', orderSearchResult: null,
};

/* ---------- 种子数据 ---------- */
const SEED = {
  products: [
    { id: 1, name: '古蜀文明探索研学', category: '馆内研学', age: '8–14 岁', duration: '半日营', price: 198, status: '在售', cover: 'assets/cover-1.jpg', long: 'assets/long-1.jpg', intro: '走进三星堆博物馆，解码青铜文明与古蜀谜题，配套讲师导览与手作体验。' },
    { id: 2, name: '考古探索实践营', category: '考古实践', age: '9–15 岁', duration: '一日营', price: 368, status: '在售', cover: 'assets/cover-2.jpg', long: 'assets/long-2.jpg', intro: '模拟考古发掘、文物修复与拓印，在专业指导下完成一次“考古任务”。' },
    { id: 3, name: '古蜀文化亲子研学', category: '亲子研学', age: '亲子家庭', duration: '一日营', price: 498, status: '在售', cover: 'assets/cover-3.jpg', long: 'assets/long-3.jpg', intro: '亲子协作完成古蜀主题手作与闯关，强化家庭共同记忆。' },
  ],
  sessions: [
    { id: 101, pid: 1, date: '2026-11-07', time: '09:30–12:00', total: 20, left: 12, min: 8 },
    { id: 102, pid: 1, date: '2026-11-08', time: '14:00–16:30', total: 20, left: 18, min: 8 },
    { id: 103, pid: 2, date: '2026-11-14', time: '09:00–16:00', total: 24, left: 13, min: 10 },
    { id: 104, pid: 3, date: '2026-11-15', time: '09:30–16:00', total: 18, left: 9, min: 6 },
  ],
  orders: [
    { id: 'YXSEED01', pid: 1, sid: 101, product: '古蜀文明探索研学', date: '2026-11-07', time: '09:30–12:00', qty: 2, amount: 396, contact: '张先生', phone: '13800001111', idcard: '510101198810123456', participants: '张同学（10岁）\n李同学（8岁）', status: '已核销', created: '2026-11-01 10:00' },
    { id: 'YXSEED02', pid: 2, sid: 103, product: '考古探索实践营', date: '2026-11-14', time: '09:00–16:00', qty: 1, amount: 368, contact: '张先生', phone: '13800001111', idcard: '510101198810123456', participants: '张同学（10岁）', status: '已支付', created: '2026-11-02 14:30' },
  ],
  certs: [
    { no: 'SXD-YX-2026-000001', status: '有效', student: '张同学', orderId: 'YXSEED01', product: '古蜀文明探索研学', date: '2026-11-07', phone: '13800001111', issuedAt: '2026-11-07', issuer: '三星堆研学（演示）' },
  ],
};

const CATEGORIES = ['全部', '馆内研学', '考古实践', '亲子研学', '寒暑假营', '学校团体'];
const GLYPH = {
  '馆内研学': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.4 3.2h3.2l-.6 2.2h-2l-.6-2.2z"/><path d="M9.7 5.8h4.6v2.2H9.7z"/><path d="M9.5 8.4v6.6h5V8.4"/><path d="M9.5 10.6 7.8 12.2M14.5 10.6l1.7 1.6"/><path d="M10.5 15.4 9.9 20.8M13.5 15.4l.6 5.4"/></svg>',
  '考古实践': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.6c1.7 2.2 2.7 5 2.7 8.4 0 3.5-1.1 6.6-2.7 8.6-1.6-2-2.7-5.1-2.7-8.6 0-3.4 1-6.2 2.7-8.4Z"/><path d="M10.5 5.6h3"/><path d="M12 19.6v1.8"/></svg>',
  '亲子研学': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.2 10.8c0-2 1.3-3.6 2.8-3.6s2.8 1.6 2.8 3.6v1.8c0 2.1-1.3 3.8-2.8 3.8s-2.8-1.7-2.8-3.8v-1.8z"/><path d="M9.4 8.8 8.2 5.8l1.9.8M14.6 8.8l1.2-3-1.9.8"/><path d="M10.6 12.2h.1M13.3 12.2h.1"/><path d="M11 14.8h2"/></svg>',
  '寒暑假营': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 12.5c2.6-2.2 5.6-3.2 9-2.8"/><path d="M14.5 9.7l2.4-1.2-1.6 2.6"/><path d="M5.5 12.5c-.6 2.4 1.2 4.4 4 4.8"/><path d="M5.5 12.5 3 17.4"/><path d="M8.5 13.2c1.6 1.2 3.4 1.9 5.4 2.1"/><path d="M9.5 17.3l-.6 3M11.5 17.5l.4 2.8"/></svg>',
};
/* 真实文物质感影像 · hero 自动轮换（AI 生成：纵目面具 / 黄金面具 / 青铜大立人） */
const ARTIFACTS = [
  { zh: '纵目面具', en: 'PROTRUDING-EYE MASK · BRONZE', img: 'assets/art-mask.webp' },
  { zh: '黄金面具', en: 'GOLDEN MASK · GOLD FOIL', img: 'assets/art-gold.webp' },
  { zh: '青铜大立人', en: 'BRONZE STANDING FIGURE', img: 'assets/art-figure.webp' },
];

/* 未解之物 · 考古卡组 */
const ENIGMA = [
  { k: 'mask', zh: '纵目面具', en: 'PROTRUDING-EYE MASK', riddle: '眼球向前突出 16 厘米。他究竟在望向何处？', cat: '馆内研学',
    g: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.2 3.8c-1.3.7-2.2 2-2.4 3.5-.1.9-.3 1.8-.6 2.6-.3.8-.2 1.6.3 2.2.6.8 1.6 1.2 2.6 1.4 1.1.2 2.3.2 3.4 0 1-.2 2-.6 2.6-1.4.5-.6.6-1.4.3-2.2-.3-.8-.5-1.7-.6-2.6-.2-1.5-1.1-2.8-2.4-3.5Z"/><path d="M6.6 9.8H2.6M17.4 9.8h4"/><path d="M7.1 9c.7-.4 1.5-.5 2.3-.3M13.7 9c-.7.4-1.5.5-2.3.3"/><path d="M7.1 10.6c.7.4 1.5.5 2.3.3M13.7 10.6c-.7.4-1.5.5-2.3.3"/><path d="M12 9.2v2.4M10.4 12.6c1 .6 2.2.6 3.2 0"/></svg>' },
  { k: 'tree', zh: '青铜神树', en: 'BRONZE SACRED TREE', riddle: '三层九枝、十鸟栖枝。那是古蜀人心中的通天之路吗？', cat: '考古实践',
    g: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-8.6"/><path d="M12 13.4 8.4 9.4M12 13.4l3.6-4"/><path d="M8.4 9.4 6.6 6M15.6 9.4l1.8-3.4"/><path d="M6.6 6 5.4 3.6M17.4 6l1.2-2.4"/><circle cx="12" cy="3.4" r="1.5"/><circle cx="5" cy="3.2" r="1"/><circle cx="19" cy="3.2" r="1"/><path d="M9.8 16.6H7.2M14.2 16.6h2.6"/><path d="M9.4 22h5.2"/></svg>' },
  { k: 'scepter', zh: '黄金权杖', en: 'GOLD SCEPTER', riddle: '1.42 米金箔之下，鱼与鸟的图腾指向哪一个王？', cat: '亲子研学',
    g: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M8.8 21h6.4"/><path d="M12 3 10.2 5.6h3.6L12 3Z"/><path d="M9.6 8.4c1.5 1.6 3.3 1.6 4.8 0"/><path d="M9.6 12c1.5 1.6 3.3 1.6 4.8 0"/><path d="M9.6 15.6h4.8"/></svg>' },
];

/* ---------- 存储 ---------- */
function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
function load(k, def) { try { const r = localStorage.getItem(KEY + k); return r ? JSON.parse(r) : def; } catch (e) { return def; } }
function loadAll() {
  products = load('products', SEED.products);
  sessions = load('sessions', SEED.sessions);
  orders = load('orders', SEED.orders);
  certificates = load('certs', SEED.certs);
}
function profile() { return load('demo_profile', null); }
function demoEnsureData() {
  if (!orders.length) { orders = SEED.orders.slice(); save('orders', orders); }
  if (!certificates.length) { certificates = SEED.certs.slice(); save('certs', certificates); }
}

/* ---------- 工具 ---------- */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function money(v) { return '¥' + Number(v).toLocaleString('zh-CN'); }
function getProduct(id) { return products.find(p => p.id === id); }
function getSession(id) { return sessions.find(s => s.id === id); }
function getP() { return getProduct(state.selectedProduct) || products[0]; }
function getS() { return getSession(state.selectedSession); }
function maskPhone(p) { p = String(p || ''); return p.length === 11 ? p.slice(0, 3) + '****' + p.slice(7) : (p || '未绑定'); }
const RE_PHONE = /^1[3-9][0-9]{9}$/;
const RE_IDCARD = /^([1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]|\d{15})$/;
function validPhone(v) { return RE_PHONE.test(String(v || '').trim()); }
function validIdCard(v) { return RE_IDCARD.test(String(v || '').trim()); }
function maskId(v) { v = String(v || ''); return v.length >= 10 ? v.slice(0, 4) + '**********' + v.slice(-4) : (v ? '****' : '未填写'); }
function fmtNow() { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function no(i) { return 'No.' + String(i).padStart(3, '0'); }
function nextSession(pid) { const ss = sessions.filter(s => s.pid === pid && s.left > 0).sort((a, b) => a.date < b.date ? -1 : 1); return ss[0] || null; }
function statusBadge(s) {
  const m = { '待支付': 'warn', '已支付': 'paid', '已核销': 'done', '已退款': 'refund', '有效': 'done', '未绑定': '' };
  return `<span class="badge ${m[s] || ''}">${esc(s)}</span>`;
}
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ---------- 路由 ---------- */
const TAB_PAGES = ['home', 'courses', 'certs', 'mine'];
function switchTab(tab) { backStack = []; state.tab = tab; state.page = tab; render(); }
function navigate(page) { backStack.push(state.page); state.page = page; render(); }
function goBack() { if (backStack.length) { state.page = backStack.pop(); render(); } else { switchTab(state.tab); } }
function navTitle() {
  const m = { courses: '活动目录', certs: '证书查询', mine: '我的', detail: '活动详情', booking: '填写报名', orders: '我的订单', orderDetail: '订单详情', myCerts: '我的证书', login: '微信登录', profile: '个人资料', admin: '演示后台', pay: '收银台', orderSearch: '订单查询' };
  return m[state.page] || '';
}

/* ---------- 渲染主函数 ---------- */
let revealObserver;
function initRevealObserver() {
  if (revealObserver) return;
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealObserver.unobserve(e.target); } });
  }, { root: document.getElementById('page'), threshold: 0.12 });
}
function observeReveals() {
  document.querySelectorAll('#page .reveal:not(.in)').forEach(el => revealObserver && revealObserver.observe(el));
}
function render() {
  const isTab = TAB_PAGES.includes(state.page);
  document.body.classList.toggle('no-tab', !isTab);
  document.body.classList.toggle('hide-back', isTab);
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.dataset.tab === state.tab));
  document.getElementById('navTitle').textContent = navTitle();
  document.body.classList.toggle('nav-bare', state.page === 'home');
  document.getElementById('navBack').style.visibility = isTab ? 'hidden' : 'visible';
  const pg = document.getElementById('page');
  pg.innerHTML = pageHTML();
  pg.scrollTop = 0;
  pg.classList.remove('page-anim'); void pg.offsetWidth; pg.classList.add('page-anim');
  bindHeroFX();
  if (state.page === 'home' || state.page === 'courses') { initRevealObserver(); requestAnimationFrame(observeReveals); }
  if (state.page === 'home') {
    maskCycleIdx = 0;
    const mw = document.getElementById('maskwrap');
    if (mw && introDone) mw.classList.add('draw');
  }
}
function pageHTML() {
  switch (state.page) {
    case 'home': return pageHome();
    case 'courses': return pageCourses();
    case 'certs': return pageCerts();
    case 'mine': return pageMine();
    case 'detail': return pageDetail();
    case 'booking': return pageBooking();
    case 'orders': return pageOrders();
    case 'orderDetail': return pageOrderDetail();
    case 'myCerts': return pageMyCerts();
    case 'login': return pageLogin();
    case 'profile': return pageProfile();
    case 'admin': return pageAdmin();
    case 'pay': return pagePay();
    case 'orderSearch': return pageOrderSearch();
    default: return pageHome();
  }
}

/* ---------- 首页 · 神秘开场 + 活动脉络 ---------- */
function courseCard(p, idx) {
  const ns = nextSession(p.id);
  const nextTxt = ns ? ` · <b>${esc(ns.date.slice(5))} 开营</b>` : '';
  return `<button class="course" onclick="showProduct(${p.id})">
    <div class="c-img"><img src="${esc(p.cover)}" alt=""><span class="c-no">${no(idx + 1)}</span><span class="c-tag">${esc(p.category)}</span></div>
    <div class="c-body"><h4>${esc(p.name)}</h4>
    <div class="c-meta">适龄 ${esc(p.age)}${nextTxt}</div>
    <div class="c-foot"><span class="price">${money(p.price)}<small class="muted"> 起</small></span><span class="c-go">查看详情 ›</span></div></div></button>`;
}
/* 首页活动整屏Section：往下滑，一件一件活动呈现 */
function actSection(p, i) {
  const ns = nextSession(p.id);
  return `<section class="act reveal" id="act-${p.id}" onclick="showProduct(${p.id})">
    <div class="act-img"><img src="${esc(p.cover)}" alt="" loading="lazy">
      <span class="act-no">${no(i + 1)}</span><span class="act-tag">${esc(p.category)}</span></div>
    <div class="act-body">
      <h3>${esc(p.name)}</h3>
      <p class="act-intro">${esc(p.intro || '')}</p>
      <div class="act-meta">
        <span>${esc(p.duration)}</span><i></i><span>${esc(p.age)}</span><i></i>
        <span>${ns ? esc(ns.date.slice(5)) + ' 开营' : '团期咨询中'}</span>
      </div>
      <div class="act-foot">
        <span class="price">${money(p.price)}<small> 起</small></span>
        <span class="act-go">进入活动 ›</span>
      </div>
    </div></section>`;
}
function pageHome() {
  const list = products.filter(p => p.status === '在售');
  const cats = ['馆内研学', '考古实践', '亲子研学', '寒暑假营'];
  return `
  <section class="hero" id="hero">
    <div class="hero-bg"></div>
    <div class="hero-grain"></div>
    <div class="maskwrap" id="maskwrap">
      <div class="maskglow"></div>
      <div class="maskart">${ARTIFACTS.map((a, i) => `<div class="mimg ${i === 0 ? 'on' : ''}"><img class="base" src="${esc(a.img)}" alt="${esc(a.zh)}"><img class="lit" src="${esc(a.img)}" alt=""></div>`).join('')}</div>
      <div class="fog"></div>
    </div>
    <h1 class="hero-title">三星堆<span class="sub">未 解 之 谜</span></h1>
    <div class="hero-en">A MYSTERIOUS CIVILIZATION WAITS IN THE DARK</div>
    <p class="hero-tag">在青铜与黄金之间，遇见三千年前的凝视。<br>一场穿越未知的古蜀研学之旅，由此开启。</p>
    <div class="hero-cta"><button onclick="scrollToActivities()">开启探索<span class="arr">→</span></button></div>
  </section>

  <div class="section-h reveal" id="enigmaSec">
    <div><div class="eyebrow">UNSOLVED · 未解之物</div><h2 class="sh-zh">先解开谜面，再走进现场</h2></div>
    <span class="more" onclick="switchTab('courses')">全部 ›</span>
  </div>
  <div class="erow reveal">
    ${ENIGMA.map((e, i) => `<div class="ecard" onclick="this.classList.toggle('flip')">
      <div class="ec-in">
        <div class="ec-face">
          <span class="ec-no">No.0${i + 1}</span>
          <div class="ec-ico">${e.g}</div>
          <div class="ec-zh">${esc(e.zh)}</div>
          <div class="ec-en">${esc(e.en)}</div>
          <span class="ec-tap">查看谜面 ›</span>
        </div>
        <div class="ec-back">
          <div class="ec-q">“${esc(e.riddle)}”</div>
          <button class="ec-go" onclick="event.stopPropagation();setFilterGo('${e.cat}')">走进现场 →</button>
        </div>
      </div></div>`).join('')}
  </div>

  <div class="feature-head reveal">
    <div><div class="eyebrow">CATEGORIES</div><div class="sh-zh" style="font-family:var(--serif);font-size:22px;letter-spacing:2px;margin-top:6px">探索分类</div></div>
  </div>
  <div class="cats reveal">
    ${cats.map(c => `<button class="cat" onclick="setFilterGo('${c}')"><div class="c-ico">${GLYPH[c] || ''}</div><div class="c-txt">${c}</div></button>`).join('')}
  </div>

  <div class="feature-head reveal" id="activities">
    <div><div class="eyebrow">EXHIBITIONS · 正在开展</div><div class="sh-zh" style="font-family:var(--serif);font-size:22px;letter-spacing:2px;margin-top:6px">研学活动 · ${list.length} 场</div></div>
    <span class="more" onclick="switchTab('courses')">全部 ›</span>
  </div>
  ${list.map((p, i) => actSection(p, i)).join('')}

  <footer class="homefoot reveal">
    <div class="hf-brand">SANXINGDUI · ENIGMA</div>
    <div class="hf-links">
      <span onclick="navigate('orderSearch')">订单查询</span><i>·</i>
      <span onclick="switchTab('certs')">证书验真</span><i>·</i>
      <span onclick="switchTab('courses')">全部活动</span>
    </div>
    <div class="hf-note">三千年前的凝视，等你赴约</div>
  </footer>`;
}
function scrollToActivities() {
  const pg = document.getElementById('page');
  const el = document.getElementById('activities');
  if (pg && el) pg.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' });
}
function setFilterGo(f) { state.filter = f; switchTab('courses'); }

/* ---------- 活动目录 · 查询 + 分类 ---------- */
function setCourseSearch(v) { state.courseSearch = v; render(); document.getElementById('courseSearch') && document.getElementById('courseSearch').focus(); }
function pageCourses() {
  const kw = (state.courseSearch || '').trim().toLowerCase();
  let list = products.filter(p => p.status === '在售' && (state.filter === '全部' || p.category === state.filter));
  if (kw) list = list.filter(p => (p.name + p.category + p.intro + p.age + p.duration).toLowerCase().includes(kw));
  return `
  <div class="searchwrap">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="6"/><path d="M14.8 14.8 21 21"/></svg>
    <input id="courseSearch" placeholder="查询活动 / 关键词" value="${esc(state.courseSearch)}" oninput="courseSearchInput(this.value)">
    ${state.courseSearch ? `<button class="sclear" onclick="state.courseSearch='';render()">✕</button>` : ''}
  </div>
  <div class="filters">${CATEGORIES.map(f => `<button class="chip ${state.filter === f ? 'on' : ''}" onclick="state.filter='${f}';render()">${f}</button>`).join('')}</div>
  <div class="section-h"><div><div class="eyebrow">ARCHIVE</div><h2 class="sh-zh">研学活动目录</h2></div><span class="muted">${list.length} 场在展</span></div>
  <div class="clist">${list.length ? list.map((p, i) => `<div class="reveal" data-k="${esc(p.name + p.category + p.intro + p.age + p.duration)}">${courseCard(p, i)}</div>`).join('') :
    `<div class="empty"><div class="empty-ico">⌕</div>未找到相关活动<br><small>换个关键词或分类试试</small>
     <button class="btn btn-ghost" style="margin-top:14px;width:auto;padding:9px 18px;font-size:12px" onclick="state.courseSearch='';state.filter='全部';render()">清空条件</button></div>`}</div>`;
}
function courseSearchInput(v) {
  state.courseSearch = v;
  const kw = v.trim().toLowerCase();
  let shown = 0;
  document.querySelectorAll('#page .clist .reveal').forEach(el => {
    const hit = !kw || (el.dataset.k || '').toLowerCase().includes(kw);
    el.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
  const cnt = document.querySelector('#page .section-h .muted');
  if (cnt) cnt.textContent = shown + ' 场在展';
}

/* ---------- 课程详情 ---------- */
function showProduct(id) { state.selectedProduct = id; navigate('detail'); }
function pageDetail() {
  const p = getP();
  const ns = nextSession(p.id);
  return `
  <div class="detailhero" style="background-image:url('${esc(p.cover)}')">
    <div class="d-no">${esc(p.category)} · ${esc(p.duration)} · RELIC</div>
    <h2>${esc(p.name)}</h2>
  </div>
  <div class="dbox">
    <div class="eyebrow" style="margin-bottom:8px">ABOUT · 活动简介</div>
    <p class="muted">${esc(p.intro || '')}</p>
    <div class="spec">
      <div><div class="sp-k">适龄 AGE</div><div class="sp-v">${esc(p.age)}</div></div>
      <div><div class="sp-k">时长 DURATION</div><div class="sp-v">${esc(p.duration)}</div></div>
      <div><div class="sp-k">起价 PRICE</div><div class="sp-v" style="color:var(--gold)">${money(p.price)}</div></div>
      <div><div class="sp-k">近一期 NEXT</div><div class="sp-v">${ns ? esc(ns.date.slice(5)) : '敬请期待'}</div></div>
    </div>
  </div>
  <div class="notice"><h4>报名须知 / 退款规则</h4>
    <ul><li>本活动为研学专属课程，建议按适龄要求报名。</li>
    <li>出营前按规定天数可申请退款，规则以正式版为准。</li>
    <li>名额有限，支付成功后方可锁定席位（演示为模拟支付）。</li></ul>
  </div>
  <img class="longpic" src="${esc(p.long || p.cover)}" onerror="this.style.display='none'" alt="课程详情长图">
  <div style="height:18px"></div>
  <div class="fixedbar">
    <div class="fb-price"><small>起价 FROM</small><br><strong class="price" style="font-size:19px">${money(p.price)}</strong></div>
    <button class="btn btn-primary" onclick="startBooking()">立即报名</button>
  </div>`;
}

/* ---------- 预订 ---------- */
function startBooking() {
  const ss = sessions.filter(s => s.pid === getP().id);
  if (!ss.length) { toast('该课程暂无可报名场次'); return; }
  const avail = ss.filter(s => s.left > 0);
  state.selectedSession = (avail[0] || ss[0]).id;
  state.quantity = 1;
  navigate('booking');
}
function calItem(s) {
  const sel = state.selectedSession === s.id;
  return `<div class="calitem ${sel ? 'sel' : ''}" onclick="selectSession(${s.id})">
    <div class="ci-left"><b>${esc(s.date)}</b><small>${esc(s.time)} · 余 ${s.left} 位</small></div>
    <div class="radio"></div></div>`;
}
function selectSession(id) { state.selectedSession = id; render(); }
function changeQty(d) {
  state.quantity = Math.min(10, Math.max(1, state.quantity + d));
  const el = document.getElementById('qty'); if (el) el.textContent = state.quantity;
}
function pageBooking() {
  const p = getP();
  const ss = sessions.filter(s => s.pid === p.id);
  return `
  <div class="dbox">
    <h3>${esc(p.name)}</h3>
    <p class="muted">请选择课程团期（示例数据）</p>
    <div id="calWrap">${ss.map(calItem).join('') || '<div class="empty">暂无场次</div>'}</div>
    <div class="divider"></div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span>报名人数</span>
      <div class="stepper"><button onclick="changeQty(-1)">－</button><b id="qty">${state.quantity}</b><button onclick="changeQty(1)">＋</button></div>
    </div>
  </div>
  <form class="dbox" id="bookingForm" onsubmit="submitBooking(event)">
    <h3>填写报名信息</h3>
    <div class="field"><label>联系人姓名 *</label><input name="contact" required maxlength="30" placeholder="请输入联系人姓名"></div>
    <div class="field"><label>联系电话 *</label><input name="phone" required type="tel" inputmode="numeric" maxlength="11" pattern="1[3-9][0-9]{9}" placeholder="11 位手机号，用于接收行前通知"></div>
    <div class="field"><label>联系人身份证号 *</label><input name="idcard" required maxlength="18" placeholder="实名预约必填，仅用于场馆登记与保险投保"></div>
    <div class="field"><label>参与人信息 *（每人一行）</label><textarea name="participants" required placeholder="例如：张同学（10岁，身份证号 5101...）&#10;李同学（8岁，身份证号 5101...）"></textarea></div>
    <div class="hint">演示版不连接微信支付；提交后生成“待支付订单”。真实系统于支付回调后锁定名额。</div>
    <button class="btn btn-primary btn-block" type="submit" style="margin-top:12px">提交并生成订单</button>
  </form>`;
}
function submitBooking(ev) {
  ev.preventDefault();
  const p = getP(), s = getS();
  if (!s || s.pid !== p.id || s.left < state.quantity) { toast('所选场次人数不足，请重新选择'); return; }
  const fd = new FormData(ev.target);
  const contact = String(fd.get('contact') || '').trim();
  const phone = String(fd.get('phone') || '').trim();
  const idcard = String(fd.get('idcard') || '').trim().toUpperCase();
  const participants = String(fd.get('participants') || '').trim();
  if (!contact) { toast('请填写联系人姓名'); return; }
  if (!validPhone(phone)) { toast('请填写正确的 11 位手机号'); return; }
  if (!validIdCard(idcard)) { toast('请填写正确的 18 位身份证号'); return; }
  if (!participants) { toast('请填写参与人信息'); return; }
  const o = {
    id: 'YX' + Date.now().toString().slice(-10), pid: p.id, sid: s.id, product: p.name,
    date: s.date, time: s.time, qty: state.quantity, amount: p.price * state.quantity,
    contact, phone, idcard, participants, status: '待支付', created: fmtNow(),
  };
  orders.unshift(o); save('orders', orders);
  state.currentOrderId = o.id; state.payOrderId = o.id; state.payPaid = false;
  state.page = 'pay'; render();
  toast('订单已创建，请完成支付');
}

/* ---------- 收银台（模拟支付） ---------- */
function goPay(id) { state.payOrderId = id; state.payPaid = false; navigate('pay'); }
function pagePay() {
  const o = orders.find(x => x.id === state.payOrderId);
  if (!o) return '<div class="empty">订单不存在</div>';
  if (state.payPaid || o.status !== '待支付') {
    return `
    <div class="payok">
      <div class="pk-ico">✓</div>
      <div class="pk-t">支付成功</div>
      <div class="pk-s">PAYMENT SUCCESSFUL</div>
      <div class="pk-amt">${money(o.amount)}</div>
      <div class="pk-info">${esc(o.product)} · ${esc(o.date)} ${esc(o.time)} · ${o.qty} 人</div>
      <div class="hint" style="text-align:left">名额已锁定（模拟）。出行当天凭订单号/手机号核销入场；活动完成后可查询研学证书。</div>
    </div>
    <div style="padding:4px 16px 20px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary btn-block" onclick="openOrder('${o.id}')">查看订单详情</button>
      <button class="btn btn-ghost btn-block" onclick="navigate('orders')">我的订单列表</button>
      <button class="btn btn-ghost btn-block" onclick="switchTab('home')">返回首页</button>
    </div>`;
  }
  const p = getProduct(o.pid);
  return `
  <div class="card paybox">
    <div class="pb-label">应付金额 AMOUNT DUE</div>
    <div class="pb-amt">${money(o.amount)}</div>
    <div class="divider"></div>
    <div class="pb-row"><span>活动</span><b>${esc(o.product)}</b></div>
    <div class="pb-row"><span>团期</span><b>${esc(o.date)} ${esc(o.time)}</b></div>
    <div class="pb-row"><span>人数</span><b>${o.qty} 人</b></div>
    <div class="pb-row"><span>订单号</span><b>${esc(o.id)}</b></div>
  </div>
  <div class="card">
    <div class="pb-label" style="margin-bottom:10px">支付方式 PAY WITH</div>
    <div class="paym sel">
      <span class="pm-ico">💬</span>
      <div style="flex:1"><b>微信支付</b><small>演示环境模拟扣款</small></div>
      <div class="radio on"></div>
    </div>
    <div class="paym off" onclick="toast('该渠道暂未接入，演示版仅微信支付')">
      <span class="pm-ico">🅐</span>
      <div style="flex:1"><b>支付宝</b><small>暂未接入</small></div>
      <div class="radio"></div>
    </div>
    <div class="hint" style="margin-top:12px">正式版将调用 wx.requestPayment 拉起微信支付，支付回调后自动锁定名额并生成电子凭证。</div>
    <button class="btn btn-gold btn-block" style="margin-top:14px" onclick="confirmPay()">确认支付 ${money(o.amount)}</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px" onclick="openOrder('${o.id}')">暂不支付，稍后处理</button>
  </div>`;
}
function confirmPay() {
  const id = state.payOrderId;
  const o = orders.find(x => x.id === id);
  if (!o || o.status !== '待支付') return;
  const s = sessions.find(x => x.id === o.sid);
  if (s) s.left = Math.max(0, s.left - o.qty);
  o.status = '已支付'; o.paidAt = fmtNow();
  save('orders', orders); save('sessions', sessions);
  state.payPaid = true; render();
  window.scrollTo && null; toast('支付成功（模拟）');
}

/* ---------- 订单查询（免登录查单） ---------- */
function pageOrderSearch() {
  const res = state.orderSearchResult;
  return `
  <div class="card">
    <div class="eyebrow" style="margin-bottom:6px">ORDER LOOKUP</div>
    <h3 style="margin:0 0 6px;font-family:var(--serif);letter-spacing:1px">订单查询</h3>
    <p class="muted">无需登录，凭 <b style="color:var(--gold-soft)">手机号</b> 或 <b style="color:var(--gold-soft)">订单号</b> 查询报名订单与出行凭证。</p>
    <form onsubmit="searchOrders(event)" style="display:flex;gap:9px;margin-top:12px">
      <input id="osKey" placeholder="手机号 / 订单号，如 YXSEED01" value="${esc(state.orderSearchKey)}"
        style="flex:1;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:rgba(255,255,255,.04);outline:none">
      <button class="btn btn-primary" type="submit" style="padding:12px 20px">查询</button>
    </form>
  </div>
  ${res === null ? '' : (res.length ? `
    <div class="section-h" style="padding-top:8px"><div><div class="eyebrow">RESULTS</div><h2 class="sh-zh" style="font-size:18px">查询到 ${res.length} 笔订单</h2></div></div>
    <div class="olist" style="padding-top:0">${res.map(orderCard).join('')}</div>`
    : `<div class="empty"><div class="empty-ico">▤</div>未找到相关订单<br><small>请确认手机号或订单号是否正确</small></div>`)}`;
}
function searchOrders(ev) {
  if (ev) ev.preventDefault();
  const el = document.getElementById('osKey');
  const v = (el ? el.value : state.orderSearchKey).trim();
  state.orderSearchKey = v;
  if (!v) { toast('请输入手机号或订单号'); return; }
  const up = v.toUpperCase();
  const res = orders.filter(o => o.phone === v || o.id.toUpperCase() === up || o.contact === v);
  state.orderSearchResult = res;
  render();
  if (res.length) toast('查询到 ' + res.length + ' 笔订单'); else toast('未找到相关订单');
}

/* ---------- 订单 ---------- */
function openOrder(id) { state.currentOrderId = id; navigate('orderDetail'); }
function pageOrders() {
  const me = profile();
  let list = me ? orders.filter(o => o.phone === me.phone) : orders.slice();
  const tabs = ['全部', '待支付', '待出行', '已退款'];
  const f = state.orderFilter;
  if (f === '待出行') list = list.filter(o => ['已支付', '已核销'].includes(o.status));
  else if (f !== '全部') list = list.filter(o => o.status === f);
  return `
  <div class="otabs">${tabs.map(t => `<button class="${state.orderFilter === t ? 'on' : ''}" onclick="state.orderFilter='${t}';render()">${t}</button>`).join('')}</div>
  <div class="olist">${list.length ? list.map(orderCard).join('') :
    '<div class="empty"><div class="empty-ico">▤</div>暂无相关订单</div>'}</div>`;
}
function orderCard(o) {
  const p = getProduct(o.pid);
  return `<div class="order" onclick="openOrder('${o.id}')">
    <div class="o-main">
      ${p ? `<img class="o-thumb" src="${esc(p.cover)}" alt="">` : ''}
      <div class="o-info">
        <div class="o-top"><b>${esc(o.product)}</b>${statusBadge(o.status)}</div>
        <div class="o-meta">${esc(o.date)} ${esc(o.time)} · ${o.qty} 人</div>
        <div class="o-foot"><span class="price">${money(o.amount)}</span><span class="muted">查看详情 ›</span></div>
      </div>
    </div>
    <div class="o-no">订单号 ${esc(o.id)}</div></div>`;
}
function pageOrderDetail() {
  const o = orders.find(x => x.id === state.currentOrderId);
  if (!o) return '<div class="empty">订单不存在</div>';
  let actions = '';
  if (o.status === '待支付') actions = `<button class="btn btn-gold btn-block" onclick="goPay('${o.id}')">立即支付 ${money(o.amount)}</button>
    <button class="btn btn-ghost" onclick="cancelOrder('${o.id}')">取消订单</button>`;
  else if (o.status === '已支付') actions = `<button class="btn btn-ghost" onclick="simulateRefund('${o.id}')">申请退款（演示）</button><button class="btn btn-primary" onclick="simulateCheckin('${o.id}')">模拟核销（演示）</button>`;
  else if (o.status === '已核销') actions = `<button class="btn btn-primary btn-block" onclick="switchTab('certs')">去查询我的证书 ›</button>`;
  else if (o.status === '已退款') actions = `<div class="hint">该订单已退款，库存已返还。</div>`;
  return `
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:15px;font-family:var(--serif);letter-spacing:.5px">${esc(o.product)}</b>${statusBadge(o.status)}</div>
    <div style="color:var(--muted);font-size:12px;margin:8px 0">订单号 ${esc(o.id)}<br>团期 ${esc(o.date)} ${esc(o.time)}<br>报名 ${o.qty} 人 · 金额 <span class="price">${money(o.amount)}</span><br>创建 ${esc(o.created || '')}</div>
    <div class="divider"></div>
    <div class="field"><label>联系人</label><div>${esc(o.contact)} · ${esc(maskPhone(o.phone))}</div></div>
    ${o.idcard ? `<div class="field"><label>身份证号</label><div>${esc(maskId(o.idcard))}</div></div>` : ''}
    <div class="field"><label>参与人信息</label><pre style="white-space:pre-wrap;background:rgba(255,255,255,.04);padding:10px;border-radius:8px;margin:0;font-size:12px">${esc(o.participants)}</pre></div>
    ${(o.status === '已支付' || o.status === '已核销') ? `<div class="cert-status">✓ 电子预约凭证已生成（演示）</div>` : ''}
  </div>
  <div style="padding:12px 16px;display:flex;gap:10px">${actions}</div>`;
}
function cancelOrder(id) {
  const o = orders.find(x => x.id === id);
  if (!o || o.status !== '待支付') return;
  o.status = '已退款'; o.cancelledAt = fmtNow();
  save('orders', orders); render(); toast('订单已取消');
}
function simulatePay(id) {
  const o = orders.find(x => x.id === id); if (!o || o.status !== '待支付') return;
  const s = sessions.find(x => x.id === o.sid); if (s) s.left = Math.max(0, s.left - o.qty);
  o.status = '已支付'; save('orders', orders); save('sessions', sessions); render(); toast('支付成功（演示）');
}
function simulateRefund(id) {
  const o = orders.find(x => x.id === id); if (!o || o.status !== '已支付') return;
  const s = sessions.find(x => x.id === o.sid); if (s) s.left += o.qty;
  o.status = '已退款'; save('orders', orders); save('sessions', sessions); render(); toast('退款完成，库存已返还');
}
function simulateCheckin(id) {
  const o = orders.find(x => x.id === id); if (!o || o.status !== '已支付') return;
  o.status = '已核销'; save('orders', orders); render(); toast('核销完成（演示）');
}

/* ---------- 证书查询（公开） ---------- */
function pageCerts() {
  return `
  <div class="card cert-search">
    <div style="text-align:center;padding:6px 0 12px">
      <div class="eyebrow">CERTIFICATE · 研学证书查询</div>
      <h2 style="margin:10px 0;font-family:var(--serif);font-size:21px;letter-spacing:2px">查询你的研学鉴证</h2>
      <p class="muted">输入证书编号，验证电子证书真伪</p>
    </div>
    <div class="field"><label>证书编号 CERT No.</label><input id="certInput" placeholder="SXD-YX-2026-000001" value="${esc(state.certSearch)}"></div>
    <button class="btn btn-primary btn-block" onclick="findCert()">查询证书</button>
    ${state.certResult ? certResultHTML() : ''}
    <div class="hint" style="margin-top:14px">实体证书预印唯一编号后绑定学员。未绑定编号无法查询；本测试版仅演示流程。</div>
  </div>`;
}
function findCert() {
  const input = document.getElementById('certInput');
  const q = (input ? input.value : state.certSearch || '').trim().toUpperCase();
  state.certSearch = q;
  const c = certificates.find(x => x.no.toUpperCase() === q);
  state.certResult = c ? { no: c.no, verified: false } : { notFound: true };
  render();
  if (state.certResult.notFound) toast('未查询到此编号');
}
function certResultHTML() {
  const r = state.certResult;
  if (r.notFound) return '<div class="cert-invalid">未查询到此编号。请检查编号，或联系研学服务方。</div>';
  const c = certificates.find(x => x.no === r.no);
  if (!c) return '<div class="cert-invalid">没有找到该证书。</div>';
  if (c.status !== '有效') return `<div class="cert-invalid">该证书状态：${esc(c.status)}。请联系研学服务方核实。</div>`;
  if (r.verified) return `<div class="cert-status">✓ 身份核验通过</div><button class="btn btn-primary btn-block" onclick="showCertificate('${c.no}')">查看电子证书</button>`;
  return `<div class="cert-status">✓ 演示证书记录存在 · 状态有效<br><small>课程：${esc(c.product)} · 日期：${esc(c.date)} · 姓名：${esc((c.student || '?').slice(0, 1) + '**')}</small></div>
    <div class="field"><label>报名手机后四位（演示身份核对）</label><input id="certPhone" maxlength="4" inputmode="numeric" placeholder="请输入后4位"></div>
    <button class="btn btn-ghost btn-block" onclick="verifyCert()">验证并查看电子证书</button>`;
}
function verifyCert() {
  const c = certificates.find(x => x.no === state.certResult?.no);
  const v = (document.getElementById('certPhone')?.value || '').trim();
  if (!c || !/^\d{4}$/.test(v) || !String(c.phone || '').endsWith(v)) { toast('验证信息不匹配'); return; }
  state.certResult.verified = true; render(); toast('演示身份核验通过');
}

/* ---------- 我的证书 ---------- */
function pageMyCerts() {
  const me = profile();
  if (!me) return `<div class="empty"><div class="empty-ico">◇</div>请先登录后查看<br><button class="btn btn-ghost" style="margin-top:10px" onclick="switchTab('mine')">去登录</button></div>`;
  const list = certificates.filter(c => c.phone === me.phone && c.status === '有效');
  return `
  <div class="section-h"><div><div class="eyebrow">MY CERTIFICATE</div><h2 class="sh-zh">我的证书</h2></div></div>
  ${list.map(c => `<div class="card" onclick="showCertificate('${c.no}')" style="cursor:pointer">
    <div style="display:flex;justify-content:space-between;align-items:center"><b style="font-family:var(--serif)">${esc(c.student)}</b>${statusBadge('已核销')}</div>
    <div class="muted" style="font-size:12px;margin-top:6px">${esc(c.product)}<br>${esc(c.date)} · 编号 ${esc(c.no)}</div>
  </div>`).join('') || '<div class="empty"><div class="empty-ico">◇</div>暂无可查询的研学证书</div>'}`;
}

/* ---------- 我的 / 个人中心 ---------- */
function pageMine() {
  const me = profile();
  const list = me ? orders.filter(o => o.phone === me.phone) : [];
  const cnt = s => list.filter(o => o.status === s).length;
  const travel = list.filter(o => ['已支付', '已核销'].includes(o.status)).length;
  const certCount = me ? certificates.filter(c => c.phone === me.phone && c.status === '有效').length : 0;
  let top, cards;
  if (me) {
    top = `
    <div class="mine-hero">
      <div class="avatar">${esc((me.name || '游')[0])}</div>
      <div style="flex:1"><div class="mh-name">${esc(me.name)}</div><div class="mh-sub">${maskPhone(me.phone)}</div></div>
      <button class="login-btn" onclick="navigate('profile')">编辑 ›</button>
    </div>
    <div class="order-cards">
      <button onclick="state.orderFilter='待支付';navigate('orders')"><b>${cnt('待支付')}</b><span>待付款</span></button>
      <button onclick="state.orderFilter='待出行';navigate('orders')"><b>${travel}</b><span>待出行</span></button>
      <button onclick="state.orderFilter='全部';navigate('orders')"><b>${list.length}</b><span>全部订单</span></button>
      <button onclick="navigate('myCerts')"><b>${certCount}</b><span>我的证书</span></button>
    </div>`;
  } else {
    top = `
    <div class="mine-hero">
      <div class="avatar">游</div>
      <div style="flex:1"><div class="mh-name">欢迎来到三星堆研学</div><div class="mh-sub">登录后管理报名信息及订单</div></div>
      <button class="login-btn" onclick="navigate('login')">登录 ›</button>
    </div>
    <div style="padding:16px"><button class="btn btn-primary btn-block" onclick="demoLogin()">微信一键登录（演示）</button>
    <button class="btn btn-ghost btn-block" style="margin-top:10px" onclick="navigate('login')">其他手机号登录 ›</button></div>`;
  }
  return `
  <div class="demobanner">H5 测试版 · 支付与微信登录为演示占位，正式版接入微信能力</div>
  ${top}
  <div class="menu">
    <button onclick="${me ? "navigate('orders')" : "navigate('login')"}"><span class="m-ico">▤</span> 报名订单与电子凭证 <span class="m-arrow">›</span></button>
    <button onclick="navigate('orderSearch')"><span class="m-ico">⌕</span> 订单查询（手机号/订单号） <span class="m-arrow">›</span></button>
    <button onclick="${me ? "navigate('myCerts')" : "navigate('login')"}"><span class="m-ico">◇</span> 我的研学证书 <span class="m-arrow">›</span></button>
    <button onclick="${me ? "navigate('profile')" : "navigate('login')"}"><span class="m-ico">♙</span> 联系人及个人资料 <span class="m-arrow">›</span></button>
    <button onclick="toast('正式版将提供官方客服与售后入口')"><span class="m-ico">◌</span> 联系客服 <span class="m-arrow">›</span></button>
    <button onclick="openAdmin()"><span class="m-ico">⚙</span> 演示后台<span class="demo-tag">核销/发证</span> <span class="m-arrow">›</span></button>
    ${me ? `<button onclick="logout()"><span class="m-ico">⏏</span> 退出登录 <span class="m-arrow">›</span></button>` : ''}
  </div>`;
}
function pageLogin() {
  return `
  <div class="card" style="text-align:center">
    <div class="avatar" style="margin:10px auto">游</div>
    <h3 style="margin:6px 0;font-family:var(--serif);letter-spacing:2px">微信登录</h3>
    <p class="muted">使用微信授权登录，管理你的研学订单与证书</p>
    <button class="btn btn-primary btn-block" style="margin-top:14px" onclick="demoLogin()">微信授权登录（演示）</button>
    <div class="divider"></div>
    <form onsubmit="loginWithPhone(event)">
      <div class="field" style="text-align:left"><label>称呼 *</label><input name="name" required maxlength="30" placeholder="如：张先生"></div>
      <div class="field" style="text-align:left"><label>手机号 *</label><input name="phone" required type="tel" inputmode="numeric" maxlength="11" pattern="1[3-9][0-9]{9}" placeholder="11 位手机号"></div>
      <div class="field" style="text-align:left"><label>身份证号 *</label><input name="idcard" required maxlength="18" placeholder="用于研学实名预约与保险投保"></div>
      <button class="btn btn-ghost btn-block" type="submit">使用此手机号登录</button>
    </form>
    <div class="hint" style="margin-top:14px">称呼、手机号、身份证号均为必填；正式版接入微信登录与手机号授权，身份证信息仅用于实名预约。</div>
  </div>`;
}
function demoLogin() {
  save('demo_profile', { name: '张先生', phone: '13800001111', idcard: '510101199001011234' });
  demoEnsureData(); render(); toast('已登录（演示账号）');
}
function loginWithPhone(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const name = String(fd.get('name') || '').trim();
  const phone = String(fd.get('phone') || '').trim();
  const idcard = String(fd.get('idcard') || '').trim().toUpperCase();
  if (!name) { toast('请填写称呼'); return; }
  if (!validPhone(phone)) { toast('请填写正确的 11 位手机号'); return; }
  if (!validIdCard(idcard)) { toast('请填写正确的 18 位身份证号'); return; }
  save('demo_profile', { name, phone, idcard });
  demoEnsureData(); render(); toast('已登录');
}
function logout() { localStorage.removeItem(KEY + 'demo_profile'); render(); toast('已退出'); }
function pageProfile() {
  const me = profile() || {};
  return `
  <div class="card">
    <h3 style="margin-top:0;font-family:var(--serif);letter-spacing:1px">${me.name ? '编辑个人资料' : '个人资料'}</h3>
    <p class="muted">本地演示表单；正式版使用微信登录与手机号授权。</p>
    <form onsubmit="saveProfile(event)">
      <div class="field"><label>称呼 *</label><input name="name" required maxlength="30" value="${esc(me.name || '')}"></div>
      <div class="field"><label>手机号 *</label><input name="phone" required type="tel" inputmode="numeric" maxlength="11" pattern="1[3-9][0-9]{9}" value="${esc(me.phone || '')}"></div>
      <div class="field"><label>身份证号 *</label><input name="idcard" required maxlength="18" value="${esc(me.idcard || '')}" placeholder="用于实名预约与保险投保"></div>
      <div class="actions" style="display:flex;gap:10px"><button class="btn btn-ghost" style="flex:1" type="button" onclick="goBack()">取消</button><button class="btn btn-primary" style="flex:1" type="submit">保存</button></div>
    </form>
  </div>`;
}
function saveProfile(e) {
  e.preventDefault();
  const fd = new FormData(e.target);
  const phone = String(fd.get('phone') || '').trim();
  const idcard = String(fd.get('idcard') || '').trim().toUpperCase();
  if (!validPhone(phone)) { toast('请填写正确的 11 位手机号'); return; }
  if (!validIdCard(idcard)) { toast('请填写正确的 18 位身份证号'); return; }
  save('demo_profile', { name: String(fd.get('name')).trim(), phone, idcard });
  render(); toast('资料已保存');
}

/* ---------- 演示后台 ---------- */
function openAdmin() { state.adminPage = 'dashboard'; navigate('admin'); }
function pageAdmin() {
  const menu = [['dashboard', '工作台', '▦'], ['orders', '报名订单', '▤'], ['certificates', '研学证书', '◇']];
  return `
  <div class="admin-h"><h2>演示后台</h2><p>核销 / 订单 / 证书绑定（本地模拟，非生产系统）</p></div>
  <div class="admin-menu">${menu.map(([id, l, ico]) => `<button onclick="state.adminPage='${id}';render()"><span class="am-ico">${ico}</span>${l}</button>`).join('')}</div>
  <button class="btn btn-ghost" style="margin:0 16px 12px;width:auto" onclick="resetDemo()">重置演示数据</button>
  ${adminBody()}`;
}
function adminBody() {
  if (state.adminPage === 'dashboard') {
    const paid = orders.filter(o => ['已支付', '已核销'].includes(o.status));
    const eligible = orders.filter(o => o.status === '已核销');
    const bound = certificates.filter(c => c.status === '有效').length;
    return `<div class="statgrid">
      <div class="stat"><b>${products.filter(p => p.status === '在售').length}</b><small>在售课程</small></div>
      <div class="stat"><b>${sessions.filter(s => s.left > 0).length}</b><small>可售团期</small></div>
      <div class="stat"><b>${orders.filter(o => o.status === '待支付').length}</b><small>待支付</small></div>
      <div class="stat"><b>${paid.length}</b><small>已付订单</small></div>
      <div class="stat"><b>${orders.filter(o => o.status === '已核销').length}</b><small>已核销</small></div>
      <div class="stat"><b>${Math.max(0, eligible.length - bound)}</b><small>待绑定证书</small></div>
    </div>
    <div class="hint" style="margin:0 16px 16px">高频操作：报名订单核销、导入预印证书编号、绑定学员。</div>`;
  }
  if (state.adminPage === 'orders') {
    const tabs = ['全部', '待支付', '已支付', '已核销', '已退款'];
    const f = state.adminOrderFilter || '全部';
    const list = f === '全部' ? orders : orders.filter(o => o.status === f);
    return `<div class="otabs">${tabs.map(t => `<button class="${f === t ? 'on' : ''}" onclick="state.adminOrderFilter='${t}';render()">${t}</button>`).join('')}</div>
    <div class="card" style="padding:0;overflow:hidden;margin-top:6px"><table class="table"><thead><tr><th>订单</th><th>课程/团期</th><th>联系人</th><th>状态</th><th></th></tr></thead><tbody>
    ${list.map(o => `<tr><td>${esc(o.id)}</td><td><b>${esc(o.product)}</b><br><small>${esc(o.date)} ${esc(o.time)}</small></td><td>${esc(o.contact)}<br><small>${esc(maskPhone(o.phone))}</small>${o.idcard ? `<br><small>证 ${esc(maskId(o.idcard))}</small>` : ''}</td><td>${statusBadge(o.status)}</td><td>${adminOrderActions(o)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">暂无</td></tr>'}
    </tbody></table></div>`;
  }
  if (state.adminPage === 'certificates') return adminCert();
  return '';
}
function adminOrderActions(o) {
  let a = '';
  if (o.status === '已支付') a += `<button class="link" onclick="adminCheckin('${o.id}')">核销</button> `;
  if (o.status === '已支付') a += `<button class="link" onclick="adminRefund('${o.id}')">退款</button>`;
  if (o.status === '待支付') a += `<button class="link" onclick="adminCancel('${o.id}')">取消</button>`;
  return a || '<span class="muted">—</span>';
}
function adminCheckin(id) { const o = orders.find(x => x.id === id); if (!o || o.status !== '已支付') return; o.status = '已核销'; save('orders', orders); render(); toast('核销完成'); }
function adminRefund(id) { const o = orders.find(x => x.id === id); if (!o || o.status !== '已支付') return; const s = sessions.find(x => x.id === o.sid); if (s) s.left += o.qty; o.status = '已退款'; save('orders', orders); save('sessions', sessions); render(); toast('退款完成，库存已返还'); }
function adminCancel(id) { const o = orders.find(x => x.id === id); if (!o || o.status !== '待支付') return; o.status = '已退款'; save('orders', orders); render(); toast('订单已取消'); }

/* ---------- 证书管理（后台） ---------- */
function adminCert() {
  const unbound = certificates.filter(c => c.status === '未绑定').length;
  const valid = certificates.filter(c => c.status === '有效').length;
  const eligible = orders.filter(o => o.status === '已核销');
  return `
  <div class="statgrid">
    <div class="stat"><b>${certificates.length}</b><small>预印编号总数</small></div>
    <div class="stat"><b>${unbound}</b><small>未绑定</small></div>
    <div class="stat"><b>${valid}</b><small>已激活证书</small></div>
  </div>
  <div class="card">
    <h3 style="margin-top:0;font-family:var(--serif);letter-spacing:1px">① 预印编号入库</h3>
    <div class="grid3">
      <div class="field" style="margin:0"><label>前缀</label><input id="certPrefix" value="SXD-YX-2026-"></div>
      <div class="field" style="margin:0"><label>起始序号</label><input id="certStart" type="number" min="1" value="1"></div>
      <div class="field" style="margin:0"><label>结束序号</label><input id="certEnd" type="number" min="1" value="100"></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="importCertRange()">导入连续预印编号</button>
    <div class="field" style="margin-top:12px"><label>非连续编号批量导入（每行一条）</label><textarea id="certListInput" rows="2" placeholder="SXD-YX-2026-000501&#10;SXD-YX-2026-000503"></textarea></div>
    <button class="btn btn-ghost btn-block" onclick="importCertList()">导入编号列表</button>
  </div>
  <div class="card">
    <h3 style="margin-top:0;font-family:var(--serif);letter-spacing:1px">② 活动核销后绑定学员</h3>
    <div class="grid3">
      <div class="field" style="margin:0"><label>纸证编号</label><input id="bindCertNo" placeholder="SXD-YX-2026-000001"></div>
      <div class="field" style="margin:0"><label>已核销订单号</label><input id="bindOrder" placeholder="从订单复制"></div>
      <div class="field" style="margin:0"><label>学员姓名</label><input id="bindStudent" placeholder="须与名单一致"></div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-top:10px" onclick="bindCertFromForm()">绑定并激活电子证书</button>
    <div class="field" style="margin-top:12px"><label>批量绑定（编号,姓名,订单号）</label><textarea id="bulkBindRows" rows="3" placeholder="SXD-YX-2026-000001,张同学,YXSEED01&#10;SXD-YX-2026-000002,李同学,YXSEED01"></textarea></div>
    <button class="btn btn-ghost btn-block" onclick="bulkBindCerts()">批量绑定</button>
    <p class="muted" style="font-size:11px">已核销订单（${eligible.length} 笔）：${eligible.slice(0, 3).map(o => esc(o.id) + '（' + esc((o.participants || o.contact).split(/[\n,，]/)[0]) + '）').join('；') || '请先核销订单'}</p>
  </div>
  <div class="card">
    <h3 style="margin-top:0;font-family:var(--serif);letter-spacing:1px">③ 编号状态（${certificates.length}）</h3>
    <table class="table"><thead><tr><th>编号</th><th>学员</th><th>订单</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${certificates.slice(0, 100).map(c => `<tr><td><b>${esc(c.no)}</b></td><td>${esc(c.student || '—')}</td><td>${esc(c.orderId || '—')}</td><td>${statusBadge(c.status === '有效' ? '已核销' : c.status)}</td><td>${c.status === '有效' ? `<button class="link" onclick="showCertificate('${c.no}')">电子证</button> <button class="link" onclick="revokeCert('${c.no}')">撤销</button>` : '—'}</td></tr>`).join('') || '<tr><td colspan="5">编号库为空，先导入预印编号。</td></tr>'}
    </tbody></table>
    ${certificates.length > 100 ? '<small class="muted">仅展示前100条</small>' : ''}
  </div>
  <div class="hint" style="margin:0 16px 16px">实体证书预印编号后绑定学员。未绑定编号不可查到证书；已撤销编号不再分配。</div>`;
}
function importCertRange() {
  const prefix = document.getElementById('certPrefix').value.trim();
  const start = parseInt(document.getElementById('certStart').value, 10);
  const end = parseInt(document.getElementById('certEnd').value, 10);
  if (!(start >= 1 && end >= start)) { toast('序号不合法'); return; }
  let n = 0;
  for (let i = start; i <= end; i++) {
    const no = prefix + String(i).padStart(6, '0');
    if (!certificates.find(c => c.no === no)) { certificates.push({ no, status: '未绑定' }); n++; }
  }
  save('certs', certificates); render(); toast(`已导入 ${n} 个预印编号`);
}
function importCertList() {
  const v = document.getElementById('certListInput').value;
  const lines = v.split(/[\n,，]/).map(s => s.trim().toUpperCase()).filter(Boolean);
  let n = 0;
  lines.forEach(no => { if (!certificates.find(c => c.no === no)) { certificates.push({ no, status: '未绑定' }); n++; } });
  save('certs', certificates); render(); toast(`已导入 ${n} 个编号`);
}
function bindCertFromForm() {
  const no = document.getElementById('bindCertNo').value.trim().toUpperCase();
  const oid = document.getElementById('bindOrder').value.trim();
  const name = document.getElementById('bindStudent').value.trim();
  bindOne(no, name, oid);
}
function bulkBindCerts() {
  const v = document.getElementById('bulkBindRows').value;
  const rows = v.split(/[\n]/).map(s => s.trim()).filter(Boolean);
  let ok = 0, fail = 0;
  rows.forEach(r => {
    const [no, name, oid] = r.split(/[,\t，]/).map(s => s.trim());
    if (bindOne((no || '').toUpperCase(), name, oid)) ok++; else fail++;
  });
  toast(`绑定成功 ${ok} 条${fail ? '，失败 ' + fail + ' 条（编号不存在/未核销/重复）' : ''}`);
}
function bindOne(no, name, oid) {
  const c = certificates.find(x => x.no === no);
  const o = orders.find(x => x.id === oid);
  if (!c || c.status !== '未绑定' || !o || o.status !== '已核销') return false;
  c.status = '有效';
  c.student = name || (o.participants || o.contact).split(/[\n,，]/)[0];
  c.orderId = o.id; c.product = o.product; c.date = o.date; c.phone = o.phone;
  c.issuedAt = fmtNow(); c.issuer = '三星堆研学（演示）';
  save('certs', certificates); return true;
}
function revokeCert(no) {
  const c = certificates.find(x => x.no === no);
  if (!c || c.status !== '有效') return;
  c.status = '已撤销'; c.revokedAt = fmtNow(); save('certs', certificates); render(); toast('证书已撤销');
}

/* ---------- 证书预览 ---------- */
function certMarkup(c) {
  return `<div class="cert-preview">
    <div class="cert-brand">SANXINGDUI MUSEUM · YOUTH STUDY</div>
    <div class="cert-title">研学实践证书</div>
    <div class="cert-eng">CERTIFICATE OF STUDY</div>
    <div class="cert-person">${esc(c.student || '学员')}</div>
    <div class="cert-copy">兹证明该学员参加了「${esc(c.product || '三星堆研学')}」课程，完成全部研学实践内容，表现优秀，特发此证，以资鼓励。</div>
    <div class="cert-meta"><div>课程：${esc(c.product || '—')}</div><div>日期：${esc(c.date || '—')}</div></div>
    <div class="cert-seal">研学<br>认证</div>
    <div style="margin-top:10px;font-size:11px;color:#a98a5b">编号 ${esc(c.no)} · 签发 ${esc(c.issuer || '三星堆研学')}</div>
  </div>
  <div class="actions"><button class="btn btn-ghost" onclick="closeModal()">关闭</button><button class="btn btn-primary" onclick="toast('演示版：正式版支持导出 PDF')">保存/打印</button></div>`;
}
function showCertificate(no) {
  const c = certificates.find(x => x.no === no);
  if (!c) { toast('未找到该证书'); return; }
  openModal(`<h3>电子证书</h3>${certMarkup(c)}`);
}

/* ---------- 弹层 ---------- */
function openModal(html) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg'; bg.id = 'modal';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) closeModal(); });
  document.body.appendChild(bg);
}
function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }

/* ---------- 重置 ---------- */
function resetDemo() {
  ['products', 'sessions', 'orders', 'certs', 'demo_profile'].forEach(k => localStorage.removeItem(KEY + k));
  loadAll(); render(); toast('已重置为默认演示数据');
}

/* ---------- 首页探索式交互：发掘序章 + 迷雾揭示 + 视差 ---------- */
let introDone = false;
function startIntro() {
  const app = document.getElementById('app');
  if (!app) { introDone = true; return; }
  const d = document.createElement('div');
  d.className = 'intro'; d.id = 'intro';
  d.innerHTML = `<div class="intro-ring"></div>
    <div class="intro-lines">
      <div class="il" style="--d:.15s">LOCATING · 30°59′N 104°12′E</div>
      <div class="il" style="--d:.65s">EXCAVATION DEPTH · 2.4 M</div>
      <div class="il" style="--d:1.15s">SIGNAL · UNKNOWN BRONZE</div>
      <div class="il ok" style="--d:1.65s">ACCESS GRANTED · SANXINGDUI</div>
    </div>
    <div class="intro-bar"><i></i></div>
    <button class="intro-skip" onclick="endIntro()">SKIP ›</button>`;
  app.appendChild(d);
  introDone = true;
  setTimeout(endIntro, 2700);
}
function endIntro() {
  const d = document.getElementById('intro');
  if (!d || d.dataset.done) return;
  d.dataset.done = '1';
  d.classList.add('out');
  const mw = document.getElementById('maskwrap'); if (mw) mw.classList.add('draw');
  setTimeout(() => d.remove(), 700);
}
function bindHeroFX() {
  const pg = document.getElementById('page');
  if (!pg || pg.dataset.hfx) return;
  pg.dataset.hfx = '1';
  pg.addEventListener('scroll', heroScroll, { passive: true });
  pg.addEventListener('pointermove', heroPointer, { passive: true });
  pg.addEventListener('touchmove', heroPointer, { passive: true });
  pg.addEventListener('pointerleave', litOff, { passive: true });
  pg.addEventListener('touchend', litOffDelayed, { passive: true });
  window.addEventListener('deviceorientation', e => {
    if (state.page !== 'home') return;
    const mw = document.getElementById('maskwrap'); if (!mw) return;
    mw.style.setProperty('--px', Math.max(-16, Math.min(16, (e.gamma || 0) * 0.6)).toFixed(1) + 'px');
  }, { passive: true });
}
let litTimer = null;
function litOn() {
  const mw = document.getElementById('maskwrap');
  if (!mw) return;
  if (litTimer) { clearTimeout(litTimer); litTimer = null; }
  mw.classList.add('lit-on');
}
function litOffDelayed() {
  if (litTimer) clearTimeout(litTimer);
  litTimer = setTimeout(() => {
    const mw = document.getElementById('maskwrap');
    if (mw) mw.classList.remove('lit-on');
  }, 900);
}
function litOff() {
  const mw = document.getElementById('maskwrap');
  if (mw) mw.classList.remove('lit-on');
}
function heroPointer(e) {
  if (state.page !== 'home') return;
  const mw = document.getElementById('maskwrap'); if (!mw) return;
  const t = (e.touches && e.touches[0]) || e;
  if (t.clientX == null) return;
  const r = mw.getBoundingClientRect();
  const x = t.clientX - r.left, y = t.clientY - r.top;
  mw.style.setProperty('--mx', ((x / r.width) * 100).toFixed(1) + '%');
  mw.style.setProperty('--my', ((y / r.height) * 100).toFixed(1) + '%');
  mw.style.setProperty('--px', (((x / r.width) - 0.5) * -20).toFixed(1) + 'px');
  mw.style.setProperty('--py', (((y / r.height) - 0.5) * -12).toFixed(1) + 'px');
  litOn();
}
function heroScroll() {
  if (state.page !== 'home') return;
  const pg = document.getElementById('page'), mw = document.getElementById('maskwrap');
  if (!pg || !mw) return;
  const st = Math.max(0, pg.scrollTop);
  mw.style.setProperty('--sy', (st * 0.26).toFixed(1) + 'px');
  const hero = document.getElementById('hero');
  if (hero) hero.style.setProperty('--fade', Math.max(0, 1 - st / 340).toFixed(3));
}

/* 文物自动轮换：描边绘制 → 停留 → 淡出切换 */
let maskCycleIdx = 0, maskTimer = null;
const MASK_MS = 6800;
function startMaskCycle() {
  if (maskTimer) return;
  maskTimer = setInterval(() => {
    if (state.page !== 'home' || document.hidden) return;
    showArtifact(maskCycleIdx + 1);
  }, MASK_MS);
}
function showArtifact(i) {
  const arts = document.querySelectorAll('.maskart .mimg');
  if (!arts.length) return;
  const next = ((i % arts.length) + arts.length) % arts.length;
  if (next === maskCycleIdx && arts[next].classList.contains('on')) return;
  arts.forEach(el => el.classList.remove('on'));
  void arts[next].offsetWidth;
  arts[next].classList.add('on');
  maskCycleIdx = next;
}

/* ---------- 暗夜粒子氛围 ---------- */
let fxRAF, fxParticles = [], fxCanvas, fxCtx, fxRunning = false;
function initFX() {
  fxCanvas = document.getElementById('bgfx');
  if (!fxCanvas) return;
  fxCtx = fxCanvas.getContext('2d');
  resizeFX();
  window.addEventListener('resize', resizeFX);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopFX(); }
    else { startFX(); }
  });
  startFX();
}
function resizeFX() {
  const app = document.getElementById('app');
  if (!fxCanvas || !app) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = app.clientWidth, h = app.clientHeight;
  fxCanvas.width = w * dpr; fxCanvas.height = h * dpr;
  fxCanvas.style.width = w + 'px'; fxCanvas.style.height = h + 'px';
  fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const count = Math.round(Math.min(60, (w * h) / 9000));
  fxParticles = Array.from({ length: count }, () => ({
    x: Math.random() * w, y: Math.random() * h,
    r: Math.random() * 1.6 + 0.4, a: Math.random() * 0.5 + 0.15,
    vx: (Math.random() - 0.5) * 0.18, vy: (Math.random() - 0.5) * 0.18,
    tw: Math.random() * 0.02 + 0.004, tp: Math.random() * Math.PI * 2,
  }));
}
function startFX() { if (fxRunning) return; fxRunning = true; loopFX(); }
function stopFX() { fxRunning = false; cancelAnimationFrame(fxRAF); }
function loopFX() {
  if (!fxRunning) return;
  const w = fxCanvas.clientWidth, h = fxCanvas.clientHeight;
  fxCtx.clearRect(0, 0, w, h);
  for (const p of fxParticles) {
    p.x += p.vx; p.y += p.vy; p.tp += p.tw;
    if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
    const alpha = p.a * (0.6 + 0.4 * Math.sin(p.tp));
    fxCtx.beginPath();
    fxCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    fxCtx.fillStyle = `rgba(227,187,124,${alpha})`;
    fxCtx.fill();
  }
  fxRAF = requestAnimationFrame(loopFX);
}

/* ---------- 启动 ---------- */
loadAll();
render();
initFX();
bindHeroFX();
startIntro();
startMaskCycle();
