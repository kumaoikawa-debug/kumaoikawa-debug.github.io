/* ---------------- 版本自检：自动刷新，绕过边缘/浏览器缓存 (v126+) ---------------- */
(function () {
  try {
    var APP_VER = 234; // 与 version.json + HTML ?v= 同步，每次发版 +1
    function checkVer() {
      if (sessionStorage.getItem("__clubos_ver_reloaded") === "skip") return;
      fetch("version.json?_=" + Date.now(), { cache: "no-store" })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (j) {
          if (!j || typeof j.ver !== "number") return;
          if (j.ver === APP_VER) return;
          if (sessionStorage.getItem("__clubos_ver_reloaded") === String(j.ver)) return;
          /* 旧版宣发状态可能与新版结构不兼容 → 仅清宣发草稿(xf)，不清空用户业务数据 */
          try {
            var cur = JSON.parse(localStorage.getItem("clubos_v1") || "{}");
            if (cur && typeof cur === "object") { delete cur.xf; }
            localStorage.setItem("clubos_v1", JSON.stringify(cur));
          } catch (e) {}
          try { sessionStorage.setItem("__clubos_ver_reloaded", String(j.ver)); } catch (e2) {}
          /* 带时间戳跳转，绕过 EdgeOne/浏览器对 admin.html 的缓存 */
          location.href = location.pathname + "?_=" + Date.now();
        })
        .catch(function () {});
    }
    checkVer();
    /* 周期轮询：即使页面长时间打开，新版本发布后也能在 ~60s 内自动刷新 (v129) */
    setInterval(checkVer, 60000);
  } catch (e) {}
})();

  /* ---------------- v193 模块完整性自检（P0-5） ----------------
     防止出现「UI 有入口 / 有按钮，但函数不存在 → 点击运行时报错」。
     清单与自检函数定义在 core.js（可被冒烟脚本断言），这里只负责启动时跑一次：
     缺失 → console.error；本地开发环境额外在页面底部显示 Module Missing 横幅。 */
  (function () {
    var missing = (typeof checkRequiredModules === "function") ? checkRequiredModules() : [];
    window.__clubosMissingModules = missing;
    missing.forEach(function (m) { console.error("[ClubOS module missing]", m); });
    if (!missing.length) return;
    var host = location.hostname, proto = location.protocol;
    var isDev = proto === "file:" || host === "localhost" || host === "127.0.0.1" || host === "" || host === "0.0.0.0";
    if (!isDev) return;
    try {
      var box = document.createElement("div");
      box.id = "moduleMissingBanner";
      box.setAttribute("data-role", "module-missing");
      box.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#8a2f22;color:#fff;" +
        "font:12px/1.7 -apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;padding:8px 12px;white-space:pre-wrap";
      box.textContent = "Module Missing:\n" + missing.join("\n");
      document.body.appendChild(box);
    } catch (e) {}
  })();

  /* ---------------- init ---------------- */
  // 所有依赖就绪后再加载状态（避免 TDZ）
  state = loadState();
  refreshAiMonthly();
  // Boot directly into the right surface based on the entry link.
  if (isFrontMode()) showView("frontHome");
  else if (isAdminMode()) showView("dashboard"); // skip login for the backend link
  else showView("login");
/* 角标动态跟随 APP_VER，避免发版忘改静态文本 */
try{var _vt=document.getElementById("verTag");if(_vt&&typeof APP_VER!=="undefined")_vt.textContent="v"+APP_VER;}catch(e){}
