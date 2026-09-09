/* ClubOS Platform — modular build (split from monolithic app.js v81).
   Loaded as classic <script> in order; shared global scope, no bundler. */
/* ---------------- init (was at end of IIFE) ---------------- */
  /* ---------------- init ---------------- */
  // 所有依赖就绪后再加载状态（避免 TDZ）
  state = loadState();
  refreshAiMonthly();
  // 总平台是独立工程：始终从平台登录页进入，不再经过俱乐部登录
  showView(state.platformAccount ? "platformAudit" : "platformLogin");
