/* case-v219-backend-diag —— 后端连接「可定位」契约
   背景（线上真实事故）：`ensureBackendToken()` 任何失败都只 `return null`，界面统一提示
   「后端连接失败：请检查地址 / 口令 / 商家ID」，无法区分三类原因，只能靠猜：
     ① fetch 被拦（后端没开 CORS）② HTTP 401（口令不符）③ HTTP 404（路径不存在）。
   本契约同时锁死**前后端契约路径**：前端必须请求 `/api/pay/admin/login`
   （后端曾只注册 `/api/pay/login`，导致前端恒 401 → 拿不到 JWT → 所有 AI 调用静默回退）。
   harness 注意：sandbox 里 `fetch` 是 stub，本脚本在 epilogue 内覆盖 `globalThis.fetch`。 */
var checks = [];
function add(name, pass, detail) { checks.push({ name: name, pass: !!pass, detail: detail || "" }); }

var BASE = "https://backend.example.com";
var captured = [];
var originalFetch = globalThis.fetch;

function mockFetch(handler) {
  globalThis.fetch = function (url, opts) {
    captured.push({ url: String(url), opts: opts || {} });
    return handler(String(url), opts || {});
  };
}
function jsonRes(status, body) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status: status, json: function () { return Promise.resolve(body); } });
}

/* ---------- 0. 入口存在 + 已登记（可被 checkRequiredModules 发现） ---------- */
add("backendLastError 是函数", typeof backendLastError === "function", typeof backendLastError);
add("REQUIRED_MODULE_FILES 登记 backendLastError", typeof REQUIRED_MODULE_FILES === "object" && REQUIRED_MODULE_FILES.backendLastError === "core.js", String(REQUIRED_MODULE_FILES && REQUIRED_MODULE_FILES.backendLastError));
add("checkRequiredModules() 全绿（无缺失模块）", checkRequiredModules().length === 0, JSON.stringify(checkRequiredModules()));

/* ---------- 1. 前置校验：地址 / 口令缺失要说清楚是缺哪一个 ---------- */
setBackendURL(""); setBackendAdminCode("k"); clearBackendToken();
var t1 = await ensureBackendToken();
add("未填后端地址 → null", t1 === null, String(t1));
add("未填后端地址 → 原因含「后端地址」", /后端地址/.test(backendLastError()), backendLastError());

setBackendURL(BASE); setBackendAdminCode(""); clearBackendToken();
var t2 = await ensureBackendToken();
add("未填管理员口令 → 原因含「口令」", t2 === null && /口令/.test(backendLastError()), backendLastError());

/* ---------- 2. fetch 抛错（CORS 被拦 / 地址写错）→ 必须点出 CORS ---------- */
setBackendAdminCode("k"); clearBackendToken(); captured = [];
mockFetch(function () { return Promise.reject(new TypeError("Failed to fetch")); });
var t3 = await ensureBackendToken();
add("fetch 抛错 → null（不冒泡）", t3 === null, String(t3));
add("fetch 抛错 → 原因提示跨域/CORS", /CORS|跨域/.test(backendLastError()), backendLastError());

/* ---------- 3. HTTP 401 / 404 → 原因必须带状态码与后端 message ---------- */
clearBackendToken(); captured = [];
mockFetch(function () { return jsonRes(401, { code: -1, message: "登录口令错误" }); });
var t4 = await ensureBackendToken();
add("HTTP 401 → null", t4 === null, String(t4));
add("HTTP 401 → 原因含 401 与后端 message", /401/.test(backendLastError()) && /登录口令错误/.test(backendLastError()), backendLastError());

clearBackendToken(); captured = [];
mockFetch(function () { return jsonRes(404, { code: -1, message: "接口不存在" }); });
var t5 = await ensureBackendToken();
add("HTTP 404 → 原因含 404（路径不存在）", /404/.test(backendLastError()), backendLastError());

/* ---------- 4. ★契约路径：必须请求 /api/pay/admin/login，body 形状固定 ---------- */
clearBackendToken(); captured = [];
mockFetch(function () { return jsonRes(200, { code: 0, data: { token: "jwt-abc" } }); });
var tok = await ensureBackendToken();
add("成功 → 返回 token", tok === "jwt-abc", String(tok));
add("★登录路径 = <base>/api/pay/admin/login（与后端/README/DEPLOY.md 契约一致）",
  captured.length === 1 && captured[0].url === BASE + "/api/pay/admin/login", captured.length ? captured[0].url : "no-call");
var bodyObj = {};
try { bodyObj = JSON.parse((captured[0] && captured[0].opts && captured[0].opts.body) || "{}"); } catch (e) { bodyObj = {}; }
add("请求体含 code", bodyObj.code === "k", JSON.stringify(bodyObj));
add("请求体含 merchant_id", String(bodyObj.merchant_id) === "1", JSON.stringify(bodyObj));
add("Content-Type: application/json", (captured[0] && captured[0].opts && captured[0].opts.headers && captured[0].opts.headers["Content-Type"]) === "application/json", JSON.stringify(captured[0] && captured[0].opts && captured[0].opts.headers));
add("成功 → 清空上次失败原因", backendLastError() === "", backendLastError());
add("成功 → token 落 localStorage(clubos_backend_token)", (localStorage.getItem("clubos_backend_token") || "") === "jwt-abc", String(localStorage.getItem("clubos_backend_token")));

/* ---------- 5. 命中缓存 → 不再发请求（避免每次 AI 调用都登录） ---------- */
var before = captured.length;
var tok2 = await ensureBackendToken();
add("缓存命中 → 返回同一 token", tok2 === "jwt-abc", String(tok2));
add("缓存命中 → 不再发起登录请求", captured.length === before, before + " → " + captured.length);

/* ---------- 6. 响应结构不符（无 token）也要给原因 ---------- */
clearBackendToken(); captured = [];
mockFetch(function () { return jsonRes(200, { code: 0, data: {} }); });
var t6 = await ensureBackendToken();
add("200 但无 token → null 且给原因", t6 === null && backendLastError().length > 0, backendLastError());

/* ---------- 7. 复位 ---------- */
globalThis.fetch = originalFetch;
clearBackendToken(); setBackendURL(""); setBackendAdminCode("");

return { ok: checks.every(function (c) { return c.pass; }), total: checks.length, passed: checks.filter(function (c) { return c.pass; }).length, checks: checks };
