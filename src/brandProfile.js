/* ============ brandProfile.js — 品牌语言档案（文档 §十三：BrandProfile） ============
   v236：从旧 AI 总监 contentDirector.js（已删除）中独立拆出。
   唯一职责：拉取 / 保存 / 缓存当前俱乐部的品牌档案（/api/content/brand-profile）。
   彻底删除原先写死的「远拓旅游：年轻、松弛、山系高级感」——那是单俱乐部时期的遗留，
   不适用于多俱乐部 SaaS：会给没做过品牌设定的俱乐部套上别人的调性。
   现在：
     · 未设置 BrandProfile → 中性默认品牌语言（不注入任何具体调性）
     · 设置了 → 用该俱乐部自己的 toneKeywords / visualKeywords / contentRules
   ★ 绝不再默认所有俱乐部都是「年轻、松弛、山系高级感」。 */

/* 当前品牌档案：从 /api/content/brand-profile 取到后调用 setBrandProfile 注入。 */
var CURRENT_BRAND_PROFILE = null;
var _brandFetched = false;
var _brandInFlight = null;

function setBrandProfile(profile) {
  CURRENT_BRAND_PROFILE = profile || null;
  _brandFetched = true;
  try { if (typeof window !== "undefined") window.__CLUBOS_BRAND_PROFILE__ = CURRENT_BRAND_PROFILE; } catch (e) {}
}
function getBrandProfileOf() { return CURRENT_BRAND_PROFILE; }

/* 拉取一次品牌档案（幂等：已拉过直接用缓存，并发共用同一个 in-flight 请求）。
   拿不到（无后端 / 未登录 / 未设置）一律保持 null → 上层回落中性默认，绝不阻塞生成。 */
function ensureBrandProfile() {
  if (_brandFetched) return Promise.resolve(CURRENT_BRAND_PROFILE);
  if (_brandInFlight) return _brandInFlight;
  _brandInFlight = (async function () {
    try {
      var base = (typeof contentV3ApiBase === "function") ? contentV3ApiBase() : "";
      if (!base) return null;
      var auth = (typeof contentV3AuthHeader === "function") ? await contentV3AuthHeader() : null;
      if (!auth) return null;
      var r = await fetch(base + "/brand-profile", { headers: { Authorization: auth } });
      if (!r || !r.ok) return null;
      var j = await r.json();
      var p = j && j.data && j.data.brandProfile;
      return p || null;
    } catch (e) {
      return null;
    } finally {
      _brandFetched = true;
      _brandInFlight = null;
    }
  })().then(function (p) {
    if (p) setBrandProfile(p);
    return p || null;
  });
  return _brandInFlight;
}

/* 保存后强制下一次重新拉取（设置页保存完用） */
function refreshBrandProfile() {
  _brandFetched = false;
  _brandInFlight = null;
  return ensureBrandProfile();
}

/* 保存品牌档案（PUT）。返回 { ok, profile, message }，失败不抛 —— 设置页据此提示。 */
async function saveBrandProfile(input) {
  var base = (typeof contentV3ApiBase === "function") ? contentV3ApiBase() : "";
  if (!base) return { ok: false, message: "未配置后端地址" };
  var auth = (typeof contentV3AuthHeader === "function") ? await contentV3AuthHeader() : null;
  if (!auth) return { ok: false, message: "未登录后端" };
  try {
    var r = await fetch(base + "/brand-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify(input || {})
    });
    var j = await r.json().catch(function () { return {}; });
    if (!r || !r.ok) return { ok: false, message: (j && j.message) || ("HTTP " + (r && r.status)) };
    var p = j && j.data && j.data.brandProfile;
    if (p) setBrandProfile(p);
    else await refreshBrandProfile();
    return { ok: true, profile: p || null, message: "已保存" };
  } catch (e) {
    return { ok: false, message: "网络请求失败" };
  }
}

/* 把「逗号/空格/顿号分隔」的输入切成关键词数组（≤20 个，每个 ≤30 字） */
function brandKeywordsOf(s) {
  return String(s || "").split(/[\s,，、;；]+/).map(function (x) { return x.trim().slice(0, 30); })
    .filter(Boolean).slice(0, 20);
}

/* 显式挂到 window，兼容 vm 沙箱（顶层函数声明在沙箱里不一定进全局） */
if (typeof window !== "undefined") {
  window.setBrandProfile = setBrandProfile;
  window.getBrandProfileOf = getBrandProfileOf;
  window.ensureBrandProfile = ensureBrandProfile;
  window.refreshBrandProfile = refreshBrandProfile;
  window.saveBrandProfile = saveBrandProfile;
  window.brandKeywordsOf = brandKeywordsOf;
}
