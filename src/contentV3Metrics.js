/* contentV3Metrics.js —— Content Engine V3 质量指标仪表盘（文档 §二十四）
 *
 * V3 不再以「成功生成了内容」作为成功指标。这里把后端的 5 个指标上屏：
 *   1. Direct Publish Rate —— AI 生成后可直接发布率
 *   2. Edit Ratio          —— 老板修改文字的比例（优<15% / 可接受15~30% / 不合格>50%）
 *   3. Diversity           —— 最近 20 场的 semantic / layout / opening 相似度（越低越多样）
 *   4. Grounding           —— 无依据 claim 必须为 0
 *   5. Time-to-Publish     —— 老板丢资料到可发布的时间
 *
 * 数据来源：GET {backend}/api/backend.../api/content/metrics（backend steps/metrics.ts 计算）。
 * ★ 只做展示，不在这里重新算指标 —— 指标判据必须与生产同源，前端另算一套就是判据分叉。
 * ★ 后端不可用 / 未配置时给诚实空态，不编造数字。
 */

/* ---------------------------------------------------------------- 可用性 */

function contentV3MetricsAvailable() {
  try {
    return (typeof contentV3ApiBase === "function") && !!contentV3ApiBase();
  } catch (e) { return false; }
}

/* ---------------------------------------------------------------- 取数 */

async function contentV3MetricsFetch(opts) {
  opts = opts || {};
  if (!contentV3MetricsAvailable()) return null;
  var base = contentV3ApiBase();
  var auth = null;
  try {
    if (typeof contentV3AuthHeader === "function") auth = await contentV3AuthHeader();
  } catch (e) { auth = null; }
  if (!auth) return null;

  var qs = [];
  if (opts.scenario) qs.push("scenario=" + encodeURIComponent(opts.scenario));
  if (opts.limit) qs.push("limit=" + encodeURIComponent(String(opts.limit)));
  var url = base + "/metrics" + (qs.length ? ("?" + qs.join("&")) : "");

  try {
    var resp = await fetch(url, { method: "GET", headers: { Authorization: auth } });
    if (!resp.ok) return null;
    var json = await resp.json();
    // 后端统一 { code:0, data:{...} }
    if (!json || (json.code !== undefined && json.code !== 0)) return null;
    return (json.data || json.result || json);
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------- 渲染 */

function contentV3MetricsPct(n) {
  var v = Number(n || 0);
  return (Math.round(v * 1000) / 10).toFixed(1) + "%";
}

/** Edit Ratio 分级配色（文档 §二十四 三档；30~50% 文档未给档位，记为「注意」） */
function contentV3MetricsGradeClass(grade) {
  if (grade === "excellent") return "v3m-ok";
  if (grade === "acceptable") return "v3m-info";
  if (grade === "poor") return "v3m-bad";
  return "v3m-warn";
}

function contentV3MetricsCard(title, value, sub, cls) {
  return '<div class="v3m-card ' + (cls || "") + '">'
    + '<div class="v3m-title">' + title + '</div>'
    + '<div class="v3m-value">' + value + '</div>'
    + (sub ? '<div class="v3m-sub">' + sub + '</div>' : "")
    + '</div>';
}

/** 把后端指标渲染成 HTML；m 为 null 时给诚实空态 */
function contentV3MetricsRender(m) {
  if (!m) {
    return '<div class="v3m-empty">未接入后端或暂无数据 —— 质量指标不在这里编造。</div>';
  }

  var cards = "";

  /* 1. Direct Publish Rate */
  cards += contentV3MetricsCard(
    "Direct Publish Rate",
    contentV3MetricsPct(m.directPublishRate && m.directPublishRate.rate),
    "已发布 " + (m.directPublishRate ? m.directPublishRate.published : 0)
      + " / 未改直发 " + (m.directPublishRate ? m.directPublishRate.publishedWithoutEdit : 0)
      + " / 共 " + (m.directPublishRate ? m.directPublishRate.total : 0),
    ""
  );

  /* 2. Edit Ratio（带分级） */
  var er = m.editRatio || {};
  cards += contentV3MetricsCard(
    "Edit Ratio",
    contentV3MetricsPct(er.ratio),
    "改过 " + (er.edited || 0) + " / 共 " + (er.total || 0)
      + ' · <b class="' + contentV3MetricsGradeClass(er.grade) + '">' + (er.label || "—") + "</b>",
    ""
  );

  /* 3. Diversity（越低越多样） */
  var dv = m.diversity || {};
  cards += contentV3MetricsCard(
    "Diversity",
    "语义 " + contentV3MetricsPct(dv.semantic) + " · 版式 " + contentV3MetricsPct(dv.layout),
    "开场雷同 " + contentV3MetricsPct(dv.opening) + " · 采样 " + (dv.sample || 0) + " 场"
      + (dv.semanticAvailable ? "" : " · 语义层降级(bigram)"),
    ""
  );

  /* 4. Grounding —— 无依据 claim 必须为 0 */
  var gr = m.grounding || {};
  cards += contentV3MetricsCard(
    "Grounding",
    (gr.violations || 0) + " 处",
    "扫描 " + (gr.docsScanned || 0) + " 份 · 硬要求：必须为 0",
    gr.ok ? "v3m-ok" : "v3m-bad"
  );

  /* 5. Time-to-Publish */
  var tp = m.timeToPublish || {};
  cards += contentV3MetricsCard(
    "Time-to-Publish",
    tp.avgHuman || "—",
    "样本 " + (tp.sample || 0) + " 份",
    ""
  );

  return '<div class="v3m-grid">' + cards + '</div>'
    + '<div class="v3m-note">' + ((m.window && m.window.note) || "") + '</div>';
}

/* ---------------------------------------------------------------- 面板 */

/** 面板骨架（容器 + 刷新按钮）；内容由 contentV3MetricsRefresh 填充 */
function contentV3MetricsPanel() {
  if (!contentV3MetricsAvailable()) return "";
  return '<div class="v3m-panel" id="v3MetricsPanel">'
    + '<div class="v3m-head">'
    + '<span class="v3m-h">内容质量指标（§二十四）</span>'
    + '<button type="button" class="v3m-btn" data-action="v3-metrics-refresh">刷新</button>'
    + '</div>'
    + '<div class="v3m-body" id="v3MetricsBody">'
    + '<div class="v3m-empty">点击「刷新」加载质量指标。</div>'
    + '</div>'
    + '</div>';
}

/** 拉取并渲染；由 data-action="v3-metrics-refresh" 触发 */
async function contentV3MetricsRefresh() {
  var box = (typeof document !== "undefined") ? document.getElementById("v3MetricsBody") : null;
  if (!box) return null;
  box.innerHTML = '<div class="v3m-empty">加载中…</div>';
  var m = await contentV3MetricsFetch({ limit: 50 });
  box.innerHTML = contentV3MetricsRender(m);
  return m;
}
