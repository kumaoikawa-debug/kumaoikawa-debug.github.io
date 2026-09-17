/* ================= ClubOS · 真实视觉模型接入（v151） =================
   目标：把 photo.js 的「规则启发式推断」替换为真实视觉模型输出，**无需改动任何版式/渲染代码**。
   分层策略（与 core.js 的 clubLLM 完全一致）：
     1) 配置了总平台后端 → 走后端 /api/pay/membership/ai-vision（Key 在服务端，按 AI 积分计量）；
     2) 未配置后端但填了「视觉模型 Key」→ 浏览器直连（演示 / 自测 / 小体量）；
     3) 都没有 → 返回 null，上层继续使用本地像素分析 + 规则推断（simulated 标记）。
   结果统一经 applyVision() 写回缓存 → analyzePhotos / selectPhotos / assignPhotoRoles / buildAdaptiveLayout /
   evaluateCropSafety / matchPhotosToSections 自动采用，业务代码零改动。 */

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
  "recommended_use": ["hero","story","gallery","detail","full"] 的子集,
  "objects": ["画面中确实存在的物体/元素，如 帐篷、桨板、背包、雪山、溪流、篝火"],
  "people": { "count": 整数, "group": true|false, "children": true|false },
  "subjects": [{ "name": "人物|主体", "bbox": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1 } }],
  "activity": "徒步|登山|露营|桨板|皮划艇|餐食|车程|观光|其他",
  "environment": "森林|水域|雪山|草甸|峡谷|海岸|城市|其他",
  "composition": "全景|中景|特写|对称|引导线|留白",
  "safe_crop_box": { "x": 0-1, "y": 0-1, "width": 0-1, "height": 0-1 },
  "confidence": 0 到 1 的数字
}
只输出画面中确实存在的内容：看不清或不确定的字段请省略，不要猜。`;
/* ---------- P1：统一视觉理解结果（visionResult）契约 ----------
   在既有 applyVision / applyVisionBatch / PHOTO_FOCUS_CACHE 之上补一层「视觉理解」，
   不重构 Photo Layout Intelligence：旧字段（orientation/quality_score/scene/...）继续有效，
   新增字段只是让下游能拿到 bbox / 人物构成 / 物体 / 构图 / 置信度。
   ★ evidenceScope 把「素材证据」与「活动事实」显式分开：
     照片能证明「素材里有什么」，不能证明「活动当天发生了什么」。 */
const VISION_FINE_SCENES = ["风景", "人物", "合影", "徒步", "登山", "桨板", "皮划艇", "露营", "帐篷", "餐食",
  "装备", "车辆", "营地", "水域", "森林", "雪山", "路线", "日出日落", "夜景"];
const VISION_FINE_RULES = [
  { scene: "桨板", kw: ["桨板", "sup", "paddleboard", "paddle board"] },
  { scene: "皮划艇", kw: ["皮划艇", "kayak", "canoe", "独木舟", "划艇"] },
  { scene: "帐篷", kw: ["帐篷", "tent"] },
  { scene: "营地", kw: ["营地", "营位", "campsite", "campground"] },
  { scene: "露营", kw: ["露营", "camp"] },
  { scene: "登山", kw: ["登山", "攀登", "山顶", "登顶", "mountaineer", "alpine", "summit"] },
  { scene: "徒步", kw: ["徒步", "山脊", "步道", "hiking", "trek", "trail", "hike"] },
  { scene: "雪山", kw: ["雪山", "雪坡", "冰川", "snow", "glacier"] },
  { scene: "水域", kw: ["水域", "溪", "河", "湖", "海", "浅滩", "water", "lake", "river", "sea", "stream"] },
  { scene: "森林", kw: ["森林", "树林", "林间", "forest", "woods"] },
  { scene: "日出日落", kw: ["日出", "日落", "朝霞", "晚霞", "sunrise", "sunset"] },
  { scene: "夜景", kw: ["夜景", "星空", "银河", "星轨", "night", "star"] },
  { scene: "路线", kw: ["路线", "路标", "山径", "route", "path"] },
  { scene: "车辆", kw: ["车辆", "车", "商务车", "面包车", "van", "bus", "vehicle"] },
  { scene: "餐食", kw: ["餐食", "路餐", "午餐", "晚餐", "吃饭", "meal", "food"] },
  { scene: "装备", kw: ["装备", "背包", "登山杖", "头盔", "gear", "equipment", "backpack"] },
  { scene: "合影", kw: ["合影", "全家福", "大合照", "group photo"] },
  { scene: "人物", kw: ["人物", "队友", "孩子", "people", "person", "portrait"] },
  { scene: "风景", kw: ["风景", "远景", "开阔", "scenery", "landscape", "vista"] },
];
/* 素材画面 → 可用于「已确认场景」（P0-A Source C）的映射。
   ★ 只做「画面里明确出现了什么」的映射，绝不把季节/地貌推断成具体物象：
     森林 ↛ 彩林、高山 ↛ 云海、水域 ↛ 一定有水花。 */
const VISION_TO_GROUNDED_RULES = [
  { grounded: "雪景", kw: ["雪山", "雪坡", "冰川", "积雪", "snow"] },
  { grounded: "海景", kw: ["海", "沙滩", "海岸", "礁石", "sea", "beach"] },
  { grounded: "溪水", kw: ["溪", "溯溪", "浅滩", "stream", "creek"] },
  { grounded: "瀑布", kw: ["瀑布", "跌水", "waterfall"] },
  { grounded: "露营", kw: ["帐篷", "营地", "露营", "tent", "camp"] },
  { grounded: "篝火", kw: ["篝火", "营火", "火堆", "campfire", "bonfire"] },
  { grounded: "星空", kw: ["星空", "银河", "星轨", "夜景", "night", "star"] },
  { grounded: "日出日落", kw: ["日出", "日落", "朝霞", "晚霞", "sunrise", "sunset"] },
  { grounded: "野花", kw: ["野花", "花海", "花田", "wildflower"] },
  { grounded: "草甸", kw: ["草甸", "高山草", "辽阔草", "meadow"] },
];
/* 真实视觉结果注册表：src → visionResult（统一 schema） */
const VISION_RESULTS = {};
/* 降级记录：src → {simulated, reason}（Vision 不可用/失败 → Canvas 启发式兜底） */
const VISION_DEGRADED = {};

/* P1：白名单在旧字段基础上扩展统一视觉理解字段（旧字段一个不删 → 下游零改动） */
const VISION_FIELD_WHITELIST = ["orientation", "quality_score", "scene", "subject", "people_count", "action", "emotion", "safe_text_area", "focal_point", "crop_risk", "recommended_use",
  "objects", "people", "subjects", "activity", "environment", "composition", "safe_crop_box", "confidence", "duplicate_group"];

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
  /* —— P1 新增字段归一化（全部做形状/取值校验，坏值直接丢弃，绝不透传到下游） —— */
  if (out.objects != null) {
    const arr = Array.isArray(out.objects) ? out.objects : [out.objects];
    out.objects = arr.map(function (x) { return String(x == null ? "" : x).trim(); }).filter(Boolean).slice(0, 12);
    if (!out.objects.length) delete out.objects;
  }
  if (out.people != null) {
    let ppl = out.people;
    if (typeof ppl === "number" || typeof ppl === "string") ppl = { count: ppl };
    if (ppl && typeof ppl === "object") {
      const cnt = parseInt(ppl.count, 10);
      const clean = { count: isNaN(cnt) ? (parseInt(out.people_count, 10) || 0) : Math.max(0, cnt) };
      if (ppl.group !== undefined) clean.group = !!ppl.group;
      if (ppl.children !== undefined) clean.children = !!ppl.children;
      out.people = clean;
      if (out.people_count == null) out.people_count = clean.count;   // 旧字段回填，保证旧下游可读
    } else delete out.people;
  }
  const normBox = function (b) {
    if (!b || typeof b !== "object") return null;
    const num = function (v) { const n = Number(v); return isNaN(n) ? null : n; };
    const x = num(b.x), y = num(b.y), w = num(b.width != null ? b.width : b.w), h = num(b.height != null ? b.height : b.h);
    if (x === null || y === null || w === null || h === null) return null;
    const cl = function (v) { return Math.max(0, Math.min(1, v)); };
    const box = { x: cl(x), y: cl(y), width: cl(w), height: cl(h) };
    if (box.width <= 0 || box.height <= 0) return null;
    return box;
  };
  if (out.subjects != null) {
    const arr = Array.isArray(out.subjects) ? out.subjects : [out.subjects];
    out.subjects = arr.map(function (x) {
      if (x && typeof x === "object") {
        const b = normBox(x.bbox || x.box || x);
        if (!b) return null;
        return { name: String(x.name || x.label || "主体").trim() || "主体", bbox: b };
      }
      return null;
    }).filter(Boolean).slice(0, 8);
    if (!out.subjects.length) delete out.subjects;
  }
  if (out.safe_crop_box != null) {
    const b = normBox(out.safe_crop_box);
    if (b) out.safe_crop_box = b; else delete out.safe_crop_box;
  }
  if (out.confidence != null) {
    const c = Number(out.confidence);
    out.confidence = isNaN(c) ? undefined : Math.max(0, Math.min(1, c > 1 ? c / 100 : c));
    if (out.confidence === undefined) delete out.confidence;
  }
  ["activity", "environment", "composition"].forEach(function (k) {
    if (out[k] != null) { const v = String(out[k]).trim(); if (v) out[k] = v; else delete out[k]; }
  });
  return Object.keys(out).length > 1 ? out : null;
}

/* ---------- P2-4：标准化视觉模型接口（Mock / 真实 共用同一归一化契约） ----------
   契约（VISION_NORMALIZED_SCHEMA）：模型只需返回这组字段（见 VISION_FIELD_WHITELIST），
   与后端 / 浏览器直连 / 未来任意供应商无关。本层负责把它映射成 photo.js 内部的
   photoMeta 形态（metaToSignals 读取的字段名），使 analyzeOnePhoto → selectPhotos → assignPhotoRoles
   → buildAdaptiveLayout 等全部下游「零改动」即可消费真实视觉结果。
   写回入口统一为 applyVision(src, meta)（meta.simulated 强制置 false）。
   切换路径：
     ① Demo（无模型）：photoMeta 返回 null → analyzeOnePhoto 走像素启发式（simulated=true），UI 标「模拟分析」；
     ② 真实模型：visionAnalyzeBatch → applyVisionNormalized 写回 PHOTO_FOCUS_CACHE
       → 下次 analyzePhotos 经 photoMeta 读到 simulated=false，自动采用真实字段。 */
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
   使 tagPhoto / primaryScene 能正确归类，避免真实模型结果在标签层被丢弃。 */
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
  /* —— P1：统一视觉理解字段映射进内部 meta ——
     bbox / safeCropBox 让 P0-B Safe Crop 拿到真实主体框（而不是只有「含人物」这一条启发式），
     fineScenes/objects 让筛图、封面选择、内容匹配有真实内容依据。 */
  if (Array.isArray(n.subjects) && n.subjects.length) {
    sig.subjectBoxes = n.subjects.map(function (x) { return x && x.bbox; }).filter(Boolean);
    sig.subjects = n.subjects.map(function (x) { return (x && x.name) || "主体"; }).filter(Boolean);
    sig.protectedSubjects = sig.subjects.slice();
  }
  if (n.safe_crop_box) sig.safeCropBox = n.safe_crop_box;
  if (Array.isArray(n.objects) && n.objects.length) sig.objects = n.objects.slice();
  ["activity", "environment", "composition"].forEach(function (k) { if (n[k]) sig[k] = n[k]; });
  if (n.confidence != null) sig.confidence = n.confidence;
  if (n.duplicate_group != null) sig.duplicateGroup = n.duplicate_group;
  if (n.people && typeof n.people === "object") sig.people = { count: n.people.count || 0, group: !!n.people.group, children: !!n.people.children };
  sig.fineScenes = visionFineScenesOf(n);
  sig.evidenceScope = "material";   // 只证明素材里有什么
  return sig;
}
/* 统一视觉结果 → 细粒度场景（20 类）。用 scene / activity / environment / objects / subject 合成识别串。 */
function visionFineScenesOf(n) {
  if (!n || typeof n !== "object") return [];
  const hay = asArr(n.scene).concat(asArr(n.activity)).concat(asArr(n.environment))
    .concat(asArr(n.composition)).concat(asArr(n.subject)).concat(asArr(n.objects))
    .concat((n.subjects || []).map(function (x) { return (x && (x.name || x.type)) || ""; }))
    .filter(Boolean).join(" ").toLowerCase();
  if (!hay) return [];
  const out = [];
  VISION_FINE_RULES.forEach(function (r) { if (r.kw.some(function (k) { return hay.indexOf(String(k).toLowerCase()) >= 0; })) out.push(r.scene); });
  // people_count 兜底：有明确人数但没匹配到人物类，补「人物」
  if (!out.length && (parseInt(n.people_count, 10) || 0) > 0) out.push("人物");
  return out.slice(0, 6);
}
/* 细粒度场景 → 可直接进入「已确认场景」的画面（严格：只映射画面里明确出现的物象） */
function visionGroundedFromFine(fine, objects) {
  const hay = (fine || []).concat(objects || []).join(" ").toLowerCase();
  const out = [];
  VISION_TO_GROUNDED_RULES.forEach(function (r) {
    if (r.kw.some(function (k) { return hay.indexOf(String(k).toLowerCase()) >= 0; })) out.push(r.grounded);
  });
  return out;
}
/* 写回入口（标准化）：把真实模型归一化结果映射成 photoMeta 后写回缓存 */
function applyVisionNormalized(src, norm) {
  const meta = visionToPhotoMeta(norm);
  if (!meta) return false;
  return (typeof applyVision === "function") ? applyVision(src, meta) : false;
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

/* ================= v204：读「海报 / 方案截图」的文字（与照片分析不同：这里要的是文本，不是 JSON 画像） =================
   visionDirect 的 prompt 是固定的「照片画像」，问不出活动信息。这里提供通用的「带图提问」入口：
   ★ 只支持**直连**（provider Key 在本机）。走总平台代理时服务端 prompt 固定为照片画像，
     读不了海报 —— 这种情况如实返回 reason，由上层提示「把海报里的文字粘贴过来 / 用文档上传」。 */
const VISION_DOC_SYSTEM = [
  "你在读一张户外活动的宣传海报、活动方案截图或行程图。",
  "请只做「抄录 + 归纳」：把图上**确实出现**的文字信息整理成一段中文活动描述，供俱乐部老板核对并生成招募页。",
  "硬规则：",
  "1. 只能写图上真实出现的文字信息，图上没有的一律不写；绝不猜测、绝不补全、绝不按常识脑补（地点、日期、价格、名额、装备都不许编）。",
  "2. 看不清的内容直接跳过，不要写「疑似」「大概」「可能是」这类猜测。",
  "3. 精确数字（日期、集合时间、价格、名额、公里、海拔、天数、适合年龄）必须原样保留，不要改写成含糊说法。",
  "4. 忽略二维码、水印、logo、页码、广告位、以及纯装饰文字。",
  "5. 直接输出整理后的中文描述（可分段），不要 JSON、不要 markdown 标题、不要解释你在做什么、不要复述本规则。",
  "6. 如果这张图不是活动海报、或上面读不到任何活动信息，只输出四个字：无法识别。"
].join("\n");

/* 通用「图 + 提问」：返回模型纯文本（失败/未配置返回 null） */
async function visionAsk(src, systemPrompt, userText) {
  const key = visionKey();
  if (!key) return null;
  const kind = visionKind();
  const model = visionModel();
  const ask = userText || "请按约定输出。";
  try {
    if (kind === "gemini") {
      const inline = await visionToInline(src);
      if (!inline) return null;
      const url = visionBase() + "/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key);
      const body = {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: ask }, { inline_data: inline }] }],
        generationConfig: { temperature: 0.1 },
      };
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) return null;
      const d = await res.json().catch(function () { return {}; });
      const parts = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts;
      const t = (parts || []).map(function (p) { return p.text || ""; }).join("").trim();
      return t || null;
    }
    const res = await fetch(visionBase() + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
      body: JSON.stringify({
        model: model,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: [{ type: "text", text: ask }, { type: "image_url", image_url: { url: src } }] },
        ],
      }),
    });
    if (!res.ok) return null;
    const d = await res.json().catch(function () { return {}; });
    const t = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
    return (typeof t === "string" && t.trim()) ? t.trim() : null;
  } catch (e) { return null; }
}

/* 海报 / 方案图 → 活动文字。返回 { text } 或 { text:"", reason }（reason 是给老板看的人话） */
async function visionReadPoster(src) {
  const mode = visionAuthMode();
  if (!mode) return { text: "", reason: "还没配置视觉 AI，读不了图上的文字。请在「AI 设置」里填一个视觉模型 Key，或改用文档上传 / 手动粘贴文字" };
  if (mode !== "key") return { text: "", reason: "读图需要本机直连的视觉模型 Key（当前走总平台后端代理，暂不支持读图）。替代办法：把海报里的文字粘贴到「活动描述」" };
  const raw = await visionAsk(src, VISION_DOC_SYSTEM, "请按约定，把这张海报/方案图上的活动信息整理成一段描述。");
  if (!raw) return { text: "", reason: "视觉 AI 没能返回结果（可能是网络或额度问题），可以再试一次或改用文档上传" };
  const t = (typeof intakeCleanText === "function") ? intakeCleanText(raw) : String(raw).trim();
  if (!t || /^无法识别$/.test(t) || t.length < 6) return { text: "", reason: "这张图上没有读出可用的活动信息（可能只是配图，不是活动海报）" };
  return { text: t.slice(0, INTAKE_MAX_FILE_CHARS) };
}

/* ================= P1：统一 visionResult 接口 + 降级 + 素材证据 ================= */
/* 把「字符串 / 数组」统一成数组（文档 P1 Schema 里 scene/activity/environment/textSafeArea 都是数组） */
function asArr(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map(function (x) { return String(x == null ? "" : x).trim(); }).filter(Boolean);
  const str = String(v).trim();
  if (!str) return [];
  return str.split(/[、,，/|]+/).map(function (x) { return x.trim(); }).filter(Boolean);
}
/* 构建统一 visionResult（schema 固定，缺字段不补假值） */
function visionUnifiedOf(src, raw) {
  const n = raw || {};
  const meta = (typeof photoMeta === "function") ? photoMeta(src) : null;
  const subjRaw = Array.isArray(n.subjects) ? n.subjects : [];
  const subjects = subjRaw.map(function (x) {
    if (!x || typeof x !== "object") return null;
    const b = x.bbox || x.box || null;
    return { type: String(x.type || x.name || x.label || "subject").trim() || "subject", bbox: b || null };
  }).filter(Boolean);
  const cnt = (n.people && n.people.count != null) ? n.people.count : ((n.people_count != null) ? n.people_count : 0);
  const subjStr = String(n.subject == null ? "" : n.subject).trim();
  return {
    imageId: src,
    /* —— 文档 P1 规定字段（数组 / 结构体严格按 Schema） —— */
    scene: asArr(n.scene).length ? asArr(n.scene)
      : ((subjStr && !/^(人物|person|people|合影|group)$/i.test(subjStr)) ? [subjStr] : []),
    objects: asArr(n.objects),
    people: {
      count: (parseInt(cnt, 10) || 0),
      group: !!(n.people && n.people.group),
      children: !!(n.people && n.people.children),
    },
    subjects: subjects,
    activity: asArr(n.activity),
    environment: asArr(n.environment),
    orientation: n.orientation || "",
    qualityScore: (n.quality_score != null) ? n.quality_score : null,
    emotion: n.emotion || "",
    composition: n.composition || "",
    focalPoint: n.focal_point || { x: 0.5, y: 0.5 },
    safeCropBox: n.safe_crop_box || null,
    textSafeArea: asArr(n.safe_text_area),
    duplicateGroup: (n.duplicate_group != null) ? n.duplicate_group : null,
    confidence: (n.confidence != null) ? n.confidence : (n.simulated ? 0.45 : 0.9),
    /* —— ClubOS 扩展字段（文档未禁止，供下游使用） —— */
    fineScenes: visionFineScenesOf(n),
    cropRisk: n.crop_risk || null,
    recommendedUse: asArr(n.recommended_use),
    simulated: !!n.simulated,
    degraded: !!n.degraded,
    ratio: (meta && meta.ratio) ? meta.ratio : null,
  };
}

/* 读取某图的统一视觉结果（真实结果优先，其次从 photoMeta 合成，最后 null） */
function visionResultOf(src) {
  if (!src) return null;
  if (VISION_RESULTS[src]) return VISION_RESULTS[src];
  const m = (typeof photoMeta === "function") ? photoMeta(src) : null;
  if (!m) return null;
  const u = visionUnifiedOf(src, m);
  u.simulated = (m.simulated !== false);
  return u;
}
/* ★ 素材证据 vs 活动事实：照片只能证明素材里有什么，不能证明当天发生了什么。
   下游（DNA / 文案 / 宣发）只允许把 materialEvidence 当事实用；
   eventFact 一律为空数组 —— 它需要人工确认，不能由 Vision 产生。 */
function visionEvidenceScope(src) {
  const r = visionResultOf(src);
  const note = "画面只能证明「素材里有什么」，不能证明「活动当天发生了什么」（天气 / 是否实际发生 / 参与者是否到场）。";
  if (!r) return { materialEvidence: false, eventFact: false, materialItems: [], note: note, ok: false };
  const items = []
    .concat(r.fineScenes || []).concat(r.objects || [])
    .concat(r.activity || []).concat(r.environment || [])
    .concat(r.people && r.people.count > 0 ? ["有人物（" + r.people.count + "人）"] : [])
    .filter(Boolean);
  return {
    /* 文档 §四：evidenceScope = { materialEvidence: true, eventFact: false } */
    materialEvidence: items.length > 0,
    eventFact: false,
    materialItems: items,          // 具体证据项（供文案引用「上传素材里有…」）
    note: note,
    ok: true,
    confidence: r.confidence,
    simulated: r.simulated,
  };
}

/* P0-A Source C：真实视觉识别 → 已确认场景。
   ★ 只采信 simulated === false 的真实模型结果 —— 像素启发式属于「模拟分析」，
     不能当作「图片里确实有红叶」的证据（否则等于换个方式臆造事实）。 */
function visionGroundingTags(photos) {
  const list = (photos || []).filter(Boolean);
  const out = [], seen = {};
  list.forEach(function (src) {
    const r = VISION_RESULTS[src];
    if (!r || r.simulated) return;
    const scenes = visionGroundedFromFine(r.fineScenes, r.objects);
    const conf = (r.confidence != null) ? r.confidence : 0.9;
    scenes.forEach(function (sc) {
      if (seen[sc]) return;
      seen[sc] = true;
      out.push({ scene: sc, confidence: conf, src: src });
    });
  });
  return out;
}
/* 降级：Vision 不可用 / 调用失败 → Canvas 像素启发式兜底，标 simulated=true，且绝不阻塞发布 */
function visionDegrade(src, reason) {
  VISION_DEGRADED[src] = { simulated: true, reason: reason || "vision_unavailable" };
  try {
    if (typeof analyzeImageFocus === "function" && typeof PHOTO_FOCUS_CACHE !== "undefined" && !PHOTO_FOCUS_CACHE.has(src)) {
      const p = analyzeImageFocus(src);
      if (p && typeof p.then === "function") {
        p.then(function (f) {
          if (f && !PHOTO_FOCUS_CACHE.has(src)) PHOTO_FOCUS_CACHE.set(src, Object.assign({}, f, { simulated: true, degraded: true }));
        }).catch(function () {});
      }
    } else if (typeof PHOTO_FOCUS_CACHE !== "undefined" && PHOTO_FOCUS_CACHE.has(src)) {
      const prev = PHOTO_FOCUS_CACHE.get(src) || {};
      PHOTO_FOCUS_CACHE.set(src, Object.assign({}, prev, { simulated: true, degraded: true }));
    }
  } catch (e) { /* 降级路径本身也绝不抛错 */ }
  return true;
}
function visionIsDegraded(src) { return !!VISION_DEGRADED[src]; }
/* 整页视觉状态摘要：给 UI / 验收用（是否真实识别、是否降级、覆盖多少张） */
function visionStatusSummary(photos) {
  const list = (photos || []).filter(Boolean);
  let real = 0, degraded = 0, none = 0;
  list.forEach(function (src) {
    const m = (typeof photoMeta === "function") ? photoMeta(src) : null;
    if (m && m.simulated === false) real++;
    else if (VISION_DEGRADED[src] || (m && m.simulated === true)) degraded++;
    else none++;
  });
  return { total: list.length, real: real, degraded: degraded, none: none, available: (typeof visionAvailable === "function") ? visionAvailable() : false };
}
/* 服务下游的统一入口：按用途返回「该用哪些图」的细粒度建议（筛图 / 封面 / 内容匹配共用） */
function visionFineScenesOfSrc(src) { const r = visionResultOf(src); return r ? (r.fineScenes || []) : []; }
function visionMatchesFine(src, want) {
  const f = visionFineScenesOfSrc(src);
  return (want || []).some(function (w) { return f.indexOf(w) >= 0; });
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
/* ================= P1 §三：Vision 在 ClubOS 中的 5 项职责 ================= */
/* §三.1 筛图：判断 模糊 / 重复 / 过暗 / 主体不清。
   ★ 没有分析数据的图一律保留（不能凭「无数据」判死老板的照片）。 */
function visionQualityScoreOf(src) {
  const r = visionResultOf(src);
  if (!r) return 0.6;
  const q = (r.qualityScore != null) ? Number(r.qualityScore) : 0.6;
  const bonus = (r.subjects && r.subjects.length) ? 0.05 : 0;
  return Math.min(1, Math.max(0, q + bonus));
}
function visionFilterPhotos(photos) {
  const list = (photos || []).filter(Boolean);
  const QUAL_MIN = 0.45;
  const drop = [], keep = [], reasonsOf = {};
  // 重复检测：同一 duplicateGroup 只留质量最高的一张
  const groupBest = {};
  list.forEach(function (src) {
    const r = visionResultOf(src);
    if (!r || r.duplicateGroup == null) return;
    const g = String(r.duplicateGroup);
    if (!groupBest[g] || visionQualityScoreOf(src) > visionQualityScoreOf(groupBest[g])) groupBest[g] = src;
  });
  list.forEach(function (src) {
    const r = visionResultOf(src);
    if (!r) { keep.push(src); return; }
    const m = (typeof photoMeta === "function") ? photoMeta(src) : null;
    const q = (r.qualityScore != null) ? Number(r.qualityScore) : null;
    const reasons = [];
    // 模糊 / 画质
    if (r.blur === true || (m && m.blur === true) || (q != null && q < QUAL_MIN)) reasons.push("模糊或画质偏低");
    // 过暗
    if (r.tooDark === true || (m && m.tooDark === true) || r.emotion === "暗" || String(r.orientation) === "dark") reasons.push("过暗");
    // 重复
    if (r.duplicateGroup != null) {
      const g = String(r.duplicateGroup);
      if (groupBest[g] !== src) reasons.push("与其他照片重复（同组 " + g + "）");
    }
    // 主体不清：识别到人物却没定位到任何主体
    if (r.people && r.people.count > 0 && !(r.subjects || []).length) reasons.push("主体不清（识别人物但未定位 bbox）");
    if (reasons.length) { drop.push({ src: src, reasons: reasons }); reasonsOf[src] = reasons; }
    else keep.push(src);
  });
  return { keep: keep, drop: drop, total: list.length, reasonsOf: reasonsOf };
}
/* §三.2 封面选择：视觉质量高 / 主体完整 / 有代表性 / 适合 Hero */
function visionCoverScore(src, photos) {
  const r = visionResultOf(src);
  if (!r) return { score: 0.5, why: ["无分析数据（按中性处理）"] };
  const why = [];
  let score = 0;
  const q = (r.qualityScore != null) ? Number(r.qualityScore) : 0.6;
  score += q * 0.35;
  why.push("视觉质量 " + q.toFixed(2));
  let intact = 0.25;
  if (r.cropRisk === "low" || r.cropRisk == null) { intact = 1; why.push("无裁切风险，主体完整"); }
  else if (r.cropRisk === "medium") { intact = 0.55; why.push("中度裁切风险"); }
  else { intact = 0.2; why.push("高风险：主体可能被裁，不作为首选"); }
  score += intact * 0.3;
  // 有代表性：该图场景在整页中的出现频率
  const freq = {};
  (photos || []).forEach(function (x) {
    const rr = visionResultOf(x);
    ((rr && rr.fineScenes) || []).forEach(function (f) { freq[f] = (freq[f] || 0) + 1; });
  });
  const tot = Math.max(1, (photos || []).length);
  const rep = (r.fineScenes || []).reduce(function (mx, f) { return Math.max(mx, (freq[f] || 0) / tot); }, 0);
  score += rep * 0.2;
  if (rep) why.push("代表场景占比 " + Math.round(rep * 100) + "%");
  const heroRec = (r.recommendedUse || []).indexOf("hero") >= 0;
  score += (heroRec ? 0.1 : 0.05);
  if (heroRec) why.push("模型推荐用作 Hero");
  const ar = r.ratio || 1;
  const arFit = (ar >= 1.2 && ar <= 2.2) ? 1 : (ar >= 0.9 ? 0.65 : 0.4);
  score += arFit * 0.05;
  if (arFit === 1) why.push("横构图，适合满幅 Hero");
  else if (arFit < 0.5) why.push("竖构图，宜原比例展示");
  return { score: +Math.min(1, score).toFixed(3), why: why };
}
function visionSelectCover(photos, preferIdx) {
  const list = (photos || []).filter(Boolean);
  if (!list.length) return { index: 0, score: 0, reason: ["没有照片"], ranking: [] };
  const table = list.map(function (src, i) {
    const c = visionCoverScore(src, list);
    return { i: i, src: src, score: c.score, why: c.why };
  });
  const sorted = table.slice().sort(function (a, b) { return b.score - a.score; });
  let best = sorted[0];
  // 老板已手动指定封面时，只有当它明显劣于最优（差 > 0.12）才建议替换
  if (preferIdx != null && table[preferIdx] && (best.score - table[preferIdx].score) <= 0.12) best = table[preferIdx];
  return { index: best.i, score: best.score, reason: best.why, ranking: sorted.slice(0, 6).map(function (x) { return { i: x.i, score: x.score, why: x.why }; }) };
}
/* §三.3 图片与内容匹配：章节语义 → 期望场景；例如「午餐安排」优先 meal、不得是徒步远景 */
const VISION_SECTION_SCENES = {
  meal: ["餐食"], gear: ["装备"], camp: ["露营", "帐篷", "营地"], night: ["夜景", "露营", "帐篷", "营地"],
  water: ["水域", "桨板", "皮划艇"], route: ["路线", "车辆", "徒步"], itinerary: ["车辆", "路线", "徒步", "登山"],
  people: ["人物", "合影"], companion: ["人物", "合影"], scenery: ["风景", "森林", "雪山", "日出日落"],
  hero: ["风景", "人物", "雪山", "森林"],
};
function visionSectionScenesFor(sec) {
  const k = String((sec && (sec.kind || sec.key)) || "");
  if (VISION_SECTION_SCENES[k]) return VISION_SECTION_SCENES[k].slice();
  if (/^day/.test(k)) return VISION_SECTION_SCENES.itinerary.slice();
  return [];
}
function visionSectionFit(src, sec) {
  const want = visionSectionScenesFor(sec);
  const r = visionResultOf(src);
  const fine = (r && r.fineScenes) || [];
  if (!want.length || !fine.length) return { ok: true, hit: [], against: [], undecided: true };
  const hit = fine.filter(function (f) { return want.indexOf(f) >= 0; });
  // 餐食章节不得用纯徒步/远景图（文档原文：「不能出现徒步远景」）
  const forbid = (String((sec && (sec.kind || sec.key)) || "") === "meal") ? ["风景", "徒步", "登山", "路线"] : [];
  const against = fine.filter(function (f) { return forbid.indexOf(f) >= 0; });
  return { ok: hit.length > 0 && against.length === 0, hit: hit, against: against, undecided: false };
}
function visionMatchSection(src, sec) { return visionSectionFit(src, sec).ok; }
/* §三.5 页面风格判断：70% 人物 → 纪实/社交；70% 风景 → 视觉大片；
   大量动作图 → 挑战/动态；大量营地细节 → 生活方式/Lookbook */
function visionPageStyleHint(photos) {
  const list = (photos || []).filter(Boolean);
  const n = list.length;
  if (!n) return { hint: "", ratios: { person: 0, scenery: 0, action: 0, camp: 0 }, notes: ["没有照片"], analyzed: 0, real: 0, simulated: false };
  let person = 0, scenery = 0, action = 0, camp = 0, real = 0, analyzed = 0;
  list.forEach(function (src) {
    const r = visionResultOf(src);
    if (!r) return;
    analyzed++;
    if (!r.simulated) real++;
    const f = r.fineScenes || [];
    const has = function (arr) { return arr.some(function (x) { return f.indexOf(x) >= 0; }); };
    if (has(["人物", "合影"]) || (r.people && r.people.count > 0)) person++;
    if (has(["风景", "森林", "雪山", "日出日落"])) scenery++;
    if (has(["徒步", "登山", "桨板", "皮划艇"])) action++;
    if (has(["露营", "帐篷", "营地", "装备", "餐食"])) camp++;
  });
  const base = Math.max(1, analyzed || n);
  const R = function (x) { return +(x / base).toFixed(2); };
  const ratios = { person: R(person), scenery: R(scenery), action: R(action), camp: R(camp) };
  const notes = [];
  let hint = "";
  if (ratios.person >= 0.7) { hint = "偏纪实 / 社交"; notes.push("人物照片占 " + Math.round(ratios.person * 100) + "%"); }
  else if (ratios.scenery >= 0.7) { hint = "偏视觉大片"; notes.push("风景照片占 " + Math.round(ratios.scenery * 100) + "%"); }
  else if (ratios.action >= 0.5) { hint = "偏挑战 / 动态"; notes.push("动作类照片占 " + Math.round(ratios.action * 100) + "%"); }
  else if (ratios.camp >= 0.5) { hint = "偏生活方式 / Lookbook"; notes.push("营地/装备/餐食细节占 " + Math.round(ratios.camp * 100) + "%"); }
  else { hint = "综合型"; notes.push("人物/风景/动作/细节均未过半，保持均衡叙事"); }
  return { hint: hint, ratios: ratios, notes: notes, analyzed: analyzed, real: real, simulated: real < analyzed };
}
/* §六 UI：Vision 失败时内部显示「图片智能：基础分析」，不影响用户流程 */
function visionIntelLabel(photos) {
  const s = visionStatusSummary(photos);
  return (s.real > 0 && s.degraded === 0 && s.none === 0) ? "图片智能：视觉识别" : "图片智能：基础分析";
}
function visionIntelDetail(photos) {
  const s = visionStatusSummary(photos);
  return visionIntelLabel(photos) + "（真实识别 " + s.real + " 张 / 降级 " + s.degraded + " 张 / 未分析 " + s.none + " 张）";
}

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
  const result = { total: list.length, analyzed: 0, failed: 0, degraded: 0, skipped: list.length - targets.length, results: {}, blocking: false };
  if (!visionAvailable() || !targets.length) {
    // 模型不可用：全部走启发式兜底并标记降级（**不阻塞发布**）
    targets.forEach(function (src) {
      if (visionDegrade(src, visionAvailable() ? "skipped" : "no_vision_key")) result.degraded++;
    });
    if (opts.onProgress) opts.onProgress(0, targets.length);
    return result;
  }
  let cursor = 0, done = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const i = cursor++;
      const src = targets[i];
      let data = null;
      try { data = await visionAnalyzeOne(src); } catch (e) { data = null; }
      if (data && data !== "__fallback__" && applyVisionNormalized(src, data)) {
        VISION_RESULTS[src] = visionUnifiedOf(src, data);
        result.analyzed++;
        result.results[src] = data;
      } else {
        // ★ 单张失败/整体不可用 → 自动降级为 Canvas heuristic（simulated=true），继续处理其余图片
        visionDegrade(src, "analyze_failed");
        result.failed++;
        result.degraded++;
      }
      done++;
      if (opts.onProgress) opts.onProgress(done, targets.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
  return result;
}
