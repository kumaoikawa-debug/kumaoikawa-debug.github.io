# v197 · 后台编辑器三处重做：团期批量生成 + 视觉Tab卡片化 + 整体视觉可切换

> 触发：老板三条反馈 ——「① 行程与团期这里，团期可以不可以批量选，比如9月17日至10月1日，每天都可以发团，每团限20人 这种」「② 视觉显现（视觉呈现 Tab）UI 太差」「③ 这些地方 UI 交互都设计得太差了。整视也不能换」。
> 三条分别对应：团期生成器、视觉呈现 Tab、整体视觉（配色主题）切换入口。其中「整视也不能换 / UI 交互差」的**头号根因**是 `@media(max-width:480px)` 误吞了 94 条桌面面板规则（详见第四节）。

---

## 一、三条反馈 → 三个改动

| 反馈 | 问题本质 | v197 做法 |
| --- | --- | --- |
| ① 团期能不能批量选 | 只能逐个加团期，区间+节奏+限人数无法一键生成 | **`depBatchDates` 区间批量 + `departureFromDate` 落 capacity + `departuresEditHtml` 面板（区间/节奏/周几/限人数/价格/实时预览/生成）** |
| ② 视觉呈现 Tab UI 太差 | 图片分析信息堆成一坨、无卡片感、无主题切换 | **`visualTabHtml` 卡片化**：五主题卡 + 每图分析卡（质量分/中文 chips/用途全中文）+ 封面大图 + 结构大纲 |
| ③ 整视也不能换 | 全站无任何「换整体配色主题」入口；且桌面规则被窄屏媒体查询误吞导致整页失样式 | **`ED_THEMES` 五选一 + `setEdTheme` 落 `draft.edTheme` + 三节点齐打 `ed-theme-*`**；并修 `@media` 误包根因 |

---

## 二、① 团期批量生成

### 新增能力
- `depBatchDates({start,end,freq})`：`freq∈{daily | weekly(weekdays:[0..6]) | interval(interval:n)}`，返回**升序去重**日期数组；**安全上限 400**；倒置区间/坏日期返回 `[]`；缺 `end` 退化为单日。
- `departureFromDate(date, price, cap)`：第三参 `capacity` **落库**（非法 capacity → `null`）。
- `depCapacityOf(dep, act)`：团期 `capacity` 优先 → 回退活动级 `limit` → 都没有 → `null`（**绝不编造名额**）；`depRemainingOf` = 容量 − 已报名。
- 面板 `departuresEditHtml(A)`：区间 input ×2 + 节奏三选（每天/每周几/每隔N天）+ 周一~周日 7 颗按钮 + 限人数/价格 input + 实时预览节点 `#depPreview` + 生成按钮 `addDeparture`。配置后实时预览由 `depBatchPreview(A)` 算出（含「将新增 N 个团期」「每团限 X 人」「已存在的日期自动跳过」）。
- `addDeparture` 生成时**跳过 `departures` 已存在的日期**。

### 验收（真实路径）
配 `9/17–10/1 daily, cap=20, price=199` → `depBatchPreview` 得 `count===14`（15 天 − 已存在 9/28），text 含「将新增 14 个团期」「每团限 20 人」。
`depBatchDates` 各节奏：每天 15 天全中；每周末（9/17 是周四）→ 9/19·20·26·27 四天；每隔3天 → 9/17·20·23·26·29 五天；倒置/坏日期 → `[]`。

---

## 三、② 视觉呈现 Tab 卡片化 + ③ 整体视觉可切换

### 视觉呈现 Tab（`visualTabHtml`）
- **整体视觉五主题卡**：`data-action="setEdTheme"`，自动 + forest/island/desert/snow，每卡带色卡与中文描述。
- **每张图一张 `photo-card`**：缩略图 `pc-thumb` + 序号 `pc-idx` + 质量分卡 `pc-q`（优≥70% / 良≥60% / 一般）+ 中文 chips `pc-chip`（构图·主体·情绪）+ 用途 `pc-use` 全中文（封面主视觉/主视觉大图/正文配图/细节配图/通栏大图/图廊）。
- **封面大图** `vt-cover-main` + 6 张 `setCover` 缩略图可点换封面，选中高亮。
- **页面结构大纲**：`buildPageStoryOutline` / `visualOutlineHtml`，26 种区块类型（`BLOCK_META`）全部有中文 label + 已注册图标（`ICON`），英文 `type` 原值不直出。
- **空照片态**：`photos:[]` 走诚实空态「还没有上传图片」，不报错。

### 整体视觉可切换（`ED_THEMES` / `edThemeOf` / `setEdTheme`）
- `edThemeOf(a)`：手动 `edTheme` 覆盖自动推导（按 `type`/`place`/`season`），非法值不生效，缺字段回退 `forest`。
- `setEdTheme` 落 `draft.edTheme`；换肤类 `ed-theme-*` 必须**页面根 / 底部阅读栏 / 抽屉根三处齐打**（承 v196 作用域结论），否则变量作用域断链、整页无色。
- `renderActivityPhone(edTheme:"snow"|"island")` 可对比验证两种主题渲染。

### ★ 契约测试的两个隐蔽坑（已写入 `case-v197-editor-panels.epilogue.js`）
1. **「将新增」不在静态 HTML**：`departuresEditHtml` 静态输出只含 `#depPreview` 空节点，预览文本由 `depBatchPreview` 运行时产出。断言须先 `state.editorDepBatch={...}` 再调 `depBatchPreview(A)`。
2. **`PHOTO_FOCUS_CACHE` 未种入 → 卡片走「分析中…」占位**：`visualTabHtml` 的富卡（质量分/chips/用途）只有在 `analyzeImageFocus`/`applyVisionNormalized` 把元数据写回 `PHOTO_FOCUS_CACHE` 后才渲染。契约测试须在渲染前对每张 `photos[i]` 种入 `{quality_score,orientation,category,subjects,emotion,recommended_use,safe_text_area}`。未种入则 `pc-q/pc-chip/pc-use` 全红。
3. **反向断言**：内部字段原值（`landscape`/`portrait`/`square`/`story`/`full`/`gallery`/`top-left`/`quality_score`）不得直出 UI，必须映射中文。

---

## 四、★ 根因修复：`@media(max-width:480px)` 误吞 94 条桌面规则

用户「整视也不能换 / UI 交互都太差」的**头号根因**不在功能缺失，而在 `styles.css` 的 **L1909–2038 共 94 条桌面面板规则被误包进了 `@media(max-width:480px)` 窄屏媒体查询块内**——结果**桌面宽度打开后台编辑器时，这些规则整段不生效，编辑器面板几乎全失样式**。

### 修法
- 把被误包的桌面主样式**移出**媒体查询块，回到全局作用域；窄屏只在媒体查询内做**覆盖/收紧**，绝不重新声明桌面主样式。
- 纪律固化进 §4.25 / §5 交付清单：**任何新增桌面面板规则都不得写进 `@media(max-width:480px)`**。
- JS 层拿不到 CSS 原文，由「真机打开桌面后台编辑器、面板样式是否齐全」兜底；契约测试用 `BLOCK_META.length>=24`（桌面面板类齐全的代理）守卫。

---

## 五、验收与发版

- 语法：`node --check` 全绿；U+FFFD=0。
- 契约测试：`case-v197-editor-panels.epilogue.js` **56/56 全绿**（§A 团期批量 / §B 视觉Tab / §C 整体视觉 / §D 根因守卫）。
- **全量回归：33 个 epilogue 文件（case-* + p0-* + p1/p2-*）全部 `✅ 冒烟通过`，0 failing** —— v197 改动未破坏任何历史契约。
- 版本：`bump.py 197` 同步 version.json + boot.js APP_VER + 三 HTML `?v=` + admin `verTag`。
- 提交 `fbcacdc`（11 文件，+902/−127）→ push origin/main。
- **线上核验**：`curl version.json` = `{"ver":197}`；本地/线上 **10 文件 MD5 全部一致**（5 源 js + styles.css + version.json + 3 HTML）。

### 交付物
- `overview-v197-editor-panels.md`（本文件）
- `v197-sample.html`（自包含样例页：内联 styles.css + 真实 `departuresEditHtml`/`visualTabHtml`/`renderActivityPhone` 渲染，所见即真实产出）
- `v197-compare.html`（改前/改后对比页：base64 内嵌 `/tmp/v197-before-full.png` + `v197-after-mediafix.png` + `v197-live-visual.png` + `v197-live-price.png` 真机截图）
- `gen-v197-showcase.js`（样例页生成器，复用 §4.22 模式）
- `case-v197-editor-panels.epilogue.js`（契约测试，56 项）

### 真机走查（线上 admin.html，桌面宽度）
- 团期批量：9/17–10/1 每天 → 预览「将新增 14 个团期 · 每团限 20 人」，生成后 14 个新团期 + 跳过已有 9/28。
- 视觉 Tab：五主题卡可点、每张图分析卡显示质量分/中文 chips/用途；换封面即时生效。
- 整体视觉：森林/海岛/沙漠/雪境 四主题一键切换，页面根/阅读栏/抽屉三处同步换色，无 console error。
- 桌面编辑器面板样式齐全（根因修复后整页正常）。
