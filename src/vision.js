/* ================= ClubOS · 真实视觉模型接入（v151） =================
   目标：把 photo.js 的「规则启发式推断」替换为真实视觉模型输出，**无需改动任何版式/渲染代码**。
   分层策略（与 core.js 的 clubLLM 完全一致）：
     1) 配置了总平台后端 → 走后端 /api/pay/membership/ai-vision（Key 在服务端，按 AI 积分计量）；
     2) 未配置后端但填了「视觉模型 Key」→ 浏览器直连（演示 / 自测 / 小体量）；
     3) 都没有 → 返回 null，上层继续使用本地像素分析 + 规则推断（simulated 标记）。
   结果统一经 piApplyVision() 写回缓存 → piAnalyze / piSelect / piAssignRoles / piAdaptiveLayout /
   piCropSafety / piMatchSections 自动采用，业务代码零改动。 */

const VISION_LS = {
  provider: "clubos_vision_provider",
  key: "clubos_vision_key",
  model: "clubos_vision_model",
  baseUrl: "clubos_vision_baseurl",
};

/* OpenAI 兼容类基本都支持 { messages:[{content:[{type:"text"},{type:"image_url"}]}] } 结构 */
const VISION_PROVIDERS = {
  openai: { label: "OpenAI 兼容（GPT-4o / Qwen-VL / GLM-4V）", defaultBase: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", kind: "openai",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"] },
  qwen: { label: "通义千问 Qwen-VL（DashScope 兼容模式）", defaultBase: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen3-vl-plus", recommended: "qwen3-vl-plus（均衡）/ qwen3-vl-flash（省钱批量）/ qwen-vl-max（最强）", kind: "openai",
    models: ["qwen3-vl-plus", "qwen3-vl-flash", "qwen-vl-max", "qwen2.5-vl-max"] },
  glm: { label: "智谱 GLM-4V", defaultBase: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4v-flash", recommended: "glm-4v-flash（免费）/ glm-4v-plus", kind: "openai",
    models: ["glm-4v-flash", "glm-4v-plus", "glm-4v"] },
  gemini: { label: "Google Gemini", defaultBase: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.0-flash", recommended: "gemini-2.0-flash（推荐）/ gemini-2.0-pro", kind: "gemini",
    models: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-2.0-pro", "gemini-1.5-flash"] },
};

function visionGet(k, def) {
  try {
    var v = (localStorage.getItem(VISION_LS[k]) || "").trim();
    if (v) return v;
    /* v157 兜底：独立键丢失时从主状态 clubos_v1.visionCfg 恢复（更新/误清后可找回） */
    if (typeof state !== "undefined" && state && state.visionCfg && state.visionCfg[k]) {
      var m = String(state.visionCfg[k]).trim();
      if (m) return m;
    }
  } catch (e) {}
  return def;
}
function visionSet(k, v) {
  try {
    v = (v == null) ? "" : String(v).trim();
    if (v) localStorage.setItem(VISION_LS[k], v);
    else localStorage.removeItem(VISION_LS[k]);
    /* v157 镜像进主状态，随 clubos_v1 持久化 —— 否则紧随其后的 saveState() 会用不含
       visionCfg 的 state 覆盖掉配置（与 v141 的 aiKey 镜像失效是同一类 bug）。 */
    if (typeof state !== "undefined" && state && state.visionCfg) {
      if (v) state.visionCfg[k] = v; else delete state.visionCfg[k];
    }
    try {
      var st = JSON.parse(localStorage.getItem("clubos_v1") || "{}");
      if (!st || typeof st !== "object") st = {};
      st.visionCfg = st.visionCfg || {};
      if (v) st.visionCfg[k] = v; else delete st.visionCfg[k];
      localStorage.setItem("clubos_v1", JSON.stringify(st));
    } catch (e2) {}
  } catch (e) {}
}
function visionProvider() { return visionGet("provider", "openai"); }
function visionKey() { return visionGet("key", ""); }
function visionBase() {
  const p = visionProvider();
  return visionGet("baseUrl", (VISION_PROVIDERS[p] || VISION_PROVIDERS.openai).defaultBase).replace(/\/+$/, "");
}
function visionModel() { return visionGet("model", (VISION_PROVIDERS[visionProvider()] || VISION_PROVIDERS.openai).defaultModel); }
function visionKind() { return (VISION_PROVIDERS[visionProvider()] || VISION_PROVIDERS.openai).kind; }

/* 当前可用模式：'backend' | 'key' | false */
function visionAuthMode() {
  try { if (getBackendURL()) return "backend"; } catch (e) {}
  return visionKey() ? "key" : false;
}
function visionAvailable() { return !!visionAuthMode(); }

const VISION_SYSTEM = `你是户外活动照片分析助手。请只根据画面中确实存在的内容分析，不得臆造天气、地点或事件。
必须输出严格 JSON（不要任何解释、不要 markdown 代码块），字段：
{
  "orientation": "landscape|portrait|square",
  "quality_score": 0 到 1 的数字,
  "scene": "scenic|sky|people|action|water|camp|meal|gear|detail|route",
  "subject": "人物|环境|天空|细节",
  "people_count": 画面中清晰可辨的人物数量（整数，0 表示无人）,
  "action": "动态|静止",
  "emotion": "明快|沉静|治愈|活力",
  "safe_text_area": "top-left|top-right|bottom-left|bottom-right",
  "focal_point": { "x": 0 到 1, "y": 0 到 1 },
  "crop_risk": "low|medium|high（把该图裁成横幅或竖版时，人物/主体被裁断的风险）",
  "recommended_use": ["hero","story","gallery","detail","full"] 的子集
}`;

const VISION_FIELD_WHITELIST = ["orientation", "quality_score", "scene", "subject", "people_count", "action", "emotion", "safe_text_area", "focal_point", "crop_risk", "recommended_use"];

/* ---------- 结果归一化：只接受白名单字段，剔除模型多余输出 ---------- */
function visionNormalize(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = { simulated: false };
  VISION_FIELD_WHITELIST.forEach((k) => { if (raw[k] !== undefined && raw[k] !== null) out[k] = raw[k]; });
  if (out.orientation && ["landscape", "portrait", "square"].indexOf(out.orientation) < 0) delete out.orientation;
  if (out.quality_score != null) {
    const q = Number(out.quality_score);
    out.quality_score = isNaN(q) ? undefined : Math.max(0, Math.min(1, q > 1 ? q / 100 : q));
    if (out.quality_score === undefined) delete out.quality_score;
  }
  if (out.people_count != null) {
    const n = parseInt(out.people_count, 10);
    out.people_count = isNaN(n) ? undefined : Math.max(0, n);
    if (out.people_count === undefined) delete out.people_count;
  }
  if (out.crop_risk && ["low", "medium", "high"].indexOf(out.crop_risk) < 0) delete out.crop_risk;
  if (out.safe_text_area && ["top-left", "top-right", "bottom-left", "bottom-right"].indexOf(out.safe_text_area) < 0) delete out.safe_text_area;
  if (out.focal_point && typeof out.focal_point !== "object") delete out.focal_point;
  return Object.keys(out).length > 1 ? out : null;
}

/* ---------- P2-4：标准化视觉模型接口（Mock / 真实 共用同一归一化契约） ----------
   契约（VISION_NORMALIZED_SCHEMA）：模型只需返回这组字段（见 VISION_FIELD_WHITELIST），
   与后端 / 浏览器直连 / 未来任意供应商无关。本层负责把它映射成 photo.js 内部的
   photoMeta 形态（metaToSignals 读取的字段名），使 piAnalyzeOne → piSelect → piAssignRoles
   → piAdaptiveLayout 等全部下游「零改动」即可消费真实视觉结果。
   写回入口统一为 piApplyVision(src, meta)（meta.simulated 强制置 false）。
   切换路径：
     ① Demo（无模型）：photoMeta 返回 null → piAnalyzeOne 走像素启发式（simulated=true），UI 标「模拟分析」；
     ② 真实模型：visionAnalyzeBatch → piApplyVisionNormalized 写回 PHOTO_FOCUS_CACHE
       → 下次 piAnalyze 经 photoMeta 读到 simulated=false，自动采用真实字段。 */
const VISION_NORMALIZED_SCHEMA = {
  orientation: "landscape|portrait|square",
  quality_score: "0-1 数字",
  scene: "scenic|sky|people|action|water|camp|meal|gear|detail|route",
  subject: "人物|环境|天空|细节",
  people_count: "整数，0 表示无人",
  action: "动态|静止",
  emotion: "明快|沉静|治愈|活力",
  safe_text_area: "top-left|top-right|bottom-left|bottom-right",
  focal_point: "{x:0-1, y:0-1}",
  crop_risk: "low|medium|high",
  recommended_use: "['hero','story','gallery','detail','full'] 子集",
};
/* 归一化视觉 JSON → photoMeta 形态（metaToSignals 读取的字段名）。
   关键：把模型的 scene 映射成内部布尔信号（isWater/isNight/isHike/...），
   使 piTagPhoto / piPrimaryScene 能正确归类，避免真实模型结果在标签层被丢弃。 */
function visionToPhotoMeta(norm) {
  if (!norm || typeof norm !== "object") return null;
  const n = norm;
  const scene = n.scene || "";
  const peopleCount = (n.people_count != null) ? (parseInt(n.people_count, 10) || 0) : 0;
  const skinRatio = peopleCount > 0 ? Math.min(0.42, 0.05 * peopleCount + 0.04) : 0;
  const sig = {
    simulated: false,
    orientation: n.orientation || "landscape",
    quality_score: (n.quality_score != null) ? Number(n.quality_score) : undefined,
    people_count: peopleCount,
    skinRatio: skinRatio,
    emotion: n.emotion || "真实",
    action: n.action || "",
    actionFlag: n.action === "动态",
    safe_text_area: n.safe_text_area || "top-right",
    recommended_use: n.recommended_use || ["story"],
    focal_point: n.focal_point || { x: 0.5, y: 0.45 },
    crop_risk: n.crop_risk || null,
    category: (scene && PI_SCENE_LABEL[scene]) ? PI_SCENE_LABEL[scene] : "内容识别",
    sceneLabel: (scene && PI_SCENE_LABEL[scene]) ? PI_SCENE_LABEL[scene] : "",
  };
  // scene → 内部布尔信号（与 metaToSignals 推导保持一致）
  if (scene === "water") sig.isWater = true;
  if (scene === "night" || scene === "sky") sig.isNight = true;
  if (scene === "hike" || scene === "route") sig.isHike = true;
  if (scene === "route") sig.isRoute = true;
  if (scene === "gear") sig.isGear = true;
  if (scene === "action") sig.actionFlag = true;
  if (scene === "detail") sig.isDetail = true;
  return sig;
}
/* 写回入口（标准化）：把真实模型归一化结果映射成 photoMeta 后写回缓存 */
function piApplyVisionNormalized(src, norm) {
  const meta = visionToPhotoMeta(norm);
  if (!meta) return false;
  return (typeof piApplyVision === "function") ? piApplyVision(src, meta) : false;
}

function visionParseJson(text) {
  if (!text) return null;
  let s = String(text).trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(s); } catch (e) {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

/* ---------- 图像 → 请求体 ---------- */
/* OpenAI 兼容：可直接传 http(s) URL 或 dataURL，无需自行转 base64 */
function visionOpenAIBody(src, model) {
  return {
    model: model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: VISION_SYSTEM },
      { role: "user", content: [
        { type: "text", text: "请分析这张活动照片，按约定 JSON 输出。" },
        { type: "image_url", image_url: { url: src } },
      ] },
    ],
  };
}
/* dataURL → { mimeType, data }；远程 URL 尝试 fetch 转 base64（Gemini 需要内联） */
function visionToInline(src) {
  return new Promise((resolve) => {
    const m = String(src || "").match(/^data:([^;]+);base64,(.*)$/);
    if (m) return resolve({ mimeType: m[1], data: m[2] });
    if (!/^https?:/.test(src)) return resolve(null);
    fetch(src).then((r) => (r && r.ok ? r.blob() : null)).then((b) => {
      if (!b) return resolve(null);
      const fr = new FileReader();
      fr.onload = () => {
        const mm = String(fr.result || "").match(/^data:([^;]+);base64,(.*)$/);
        resolve(mm ? { mimeType: mm[1], data: mm[2] } : null);
      };
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(b);
    }).catch(() => resolve(null));
  });
}

/* ---------- 单张：直连各 provider ---------- */
async function visionDirect(src) {
  const kind = visionKind();
  const model = visionModel();
  const key = visionKey();
  if (!key) return null;
  try {
    if (kind === "gemini") {
      const inline = await visionToInline(src);
      if (!inline) return null;
      const url = visionBase() + "/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
      const body = {
        systemInstruction: { parts: [{ text: VISION_SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: "请分析这张活动照片，按约定 JSON 输出。" }, { inline_data: inline }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) return null;
      const d = await res.json().catch(() => ({}));
      const t = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts.map((p) => p.text || "").join("");
      return visionNormalize(visionParseJson(t));
    }
    // 默认：OpenAI 兼容（openai / qwen / glm）
    const res = await fetch(visionBase() + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify(visionOpenAIBody(src, model)),
    });
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    const t = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    return visionNormalize(visionParseJson(t));
  } catch (e) { return null; }
}

/* ---------- 单张：走后端代理（Key 在服务端） ---------- */
async function visionViaBackend(src) {
  const url = getBackendURL();
  let token = await ensureBackendToken();
  if (!token) return "__fallback__";
  const post = (tk) => fetch(url + "/api/pay/membership/ai-vision", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk },
    body: JSON.stringify({ images: [{ id: "img", src: src }] }),
  });
  try {
    let res = await post(token);
    if (res.status === 401) { clearBackendToken(); token = await ensureBackendToken(); if (!token) return "__fallback__"; res = await post(token); }
    if (!res.ok) return null;
    const d = await res.json().catch(() => ({}));
    const item = d && d.data && d.data.results && d.data.results[0];
    return visionNormalize(item && (item.analysis || item));
  } catch (e) { return "__fallback__"; }
}

/* 单张统一入口 */
async function visionAnalyzeOne(src) {
  if (!src || !visionAvailable()) return null;
  if (getBackendURL()) {
    const r = await visionViaBackend(src);
    if (r !== "__fallback__") return r;
  }
  return visionDirect(src);
}

/* 该图是否已有「真实模型」结果（避免重复调用） */
function visionHasReal(src) {
  if (typeof photoMeta !== "function") return false;
  const m = photoMeta(src);
  return !!(m && m.simulated === false);
}

/* ---------- 批量：带并发上限与进度回调 ---------- */
async function visionAnalyzeBatch(photos, opts) {
  opts = opts || {};
  const list = (photos || []).filter(Boolean).filter((s, i, a) => a.indexOf(s) === i);
  const concurrency = Math.max(1, Math.min(4, opts.concurrency || 2));
  const force = !!opts.force;
  const targets = force ? list : list.filter((s) => !visionHasReal(s));
  const result = { total: list.length, analyzed: 0, failed: 0, skipped: list.length - targets.length, results: {} };
  if (!visionAvailable() || !targets.length) {
    if (opts.onProgress) opts.onProgress(0, targets.length);
    return result;
  }
  let cursor = 0, done = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const i = cursor++;
      const src = targets[i];
      const data = await visionAnalyzeOne(src);
      if (data && piApplyVisionNormalized(src, data)) { result.analyzed++; result.results[src] = data; }
      else result.failed++;
      done++;
      if (opts.onProgress) opts.onProgress(done, targets.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return result;
}
