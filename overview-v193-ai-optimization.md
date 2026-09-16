# ClubOS v193 发版说明 —— 按《ClubOS v192 AI 优化开发文档》执行全部 6 项改造（P0-A~E + P1）

- 版本：`193`（线上 `kumaoikawa-debug.github.io`）
- 提交：`dd018de`（main / origin/main，已 push）
- 需求来源：`~/Downloads/ClubOS_v192_AI优化开发文档_完整文本.txt`
- 用户硬指令：**「全部执行，不要自己决定删减，必须按文本要求全部一步一步执行」** —— 6 项无一遗漏。

---

## 0. 这次到底改了什么（一句话版）

文档给的 6 项，本质是同一件事的两个面：**让 AI 宣发「不虚构、不裁坏、真重生成、真识别」**。
P0-A/D 管「文案不编造事实、不编紧迫感」；P0-B 管「人物不被切半」；P0-C 管「换风格是真的重新写内容、不是换件衣服」；P0-E 管「加载即自检、少模块直接报错」；P1 管「视觉从假数据走向真实 schema + 诚实降级」。

---

## 1. P0-A　活动 DNA 的事实边界（不写没看见的风景）

**问题**：旧 `buildActivityDNA` 会按主题/动机硬塞场景词（如 `DNA_ENV_TAGS`、`DNA_ANGLES_BY_MOTIV.release` 里写「泡进溪水里 / 水花溅起」），秋天森林活动没红叶也被写成「层林尽染」——**AI 在凭主题编景物**。

**修法**（`src/publish.js`）：
- 新增受控场景词表 `GROUND_SCENE_LEXICON` + `collectGroundedScenes(a, photos)`：只有**四个来源**才允许进「已确认场景」——`user_input`（老板填）/ `itinerary`（行程）/ `vision`（视觉识别）/ `owner_confirmed`（老板确认）。来源不在其中一律不算。
- `seasonalCreativeContextFor(a)` 输出 `disclaimer: "creative_only"`：季节/氛围只作为「创意方向」，**不冒充事实**。
- `buildActivityDNA` 拆成两段返回：`factGrounded`（已确认场景）+ `creativeContext`（创意方向）；DNA 文案块 `dnaPromptBlock` 改为「【已确认场景】+【创意方向】+ 3 条硬规则」，硬规则明令「创意方向不得补事实、未识别到的景物不写」。
- 修掉 `DNA_THEME` / `DNA_ANGLES_BY_MOTIV` / `DNA_TONE` 里的越界写法（登顶/泡溪水等）。

**验收（真机）**：秋季森林活动、视觉未识别到红叶 → 生成文案**不出现**任何红叶/层林尽染类虚构景物。

---

## 2. P0-B　修 Safe Crop（人物·主体完整优先于容器填满）

**根因**：`activities.js` 的 `xhFig` 有一行 `if (contain && (!exact || clamped)) contain = false;`——主体完整（contain）被「比例不精确 / 被 clamp」轻易推翻 → 人物被 cover 切半。`cropPolicyOf` 又只读了**页面级 intel**，没读视觉元数据里的 `bbox` / `crop_risk`。

**修法**：
- `activities.js`：high 风险一律 `contain`、比例未知时才 `cover`；`medium` → `safe_cover`（留安全边）；`low` → `cover`。新增 `figContain(src)` 兜底；hero 加 `.keep`（主体保护）+ `.xh-ed-hero-backdrop`；全原比例组加 `.orig` 类；`styles.css` 加 `.xh-ed-hero.keep` / `.xh-ed-hero-backdrop` / `.xh-ed-figs.orig.two|three` 非对称布局。
- `src/publish.js`：新增 `cropPolicyOf(src)`（真实视觉 crop_risk 优先级）、`cropFitsSubjects` / `safePosOf` / `cropRenderOf` / `cropRenderViolations`；`mediaBlock` 输出 `data-crop-mode` / `data-crop-risk` 供断言。
- **关键纪律**：`cropPolicyOf` 必须直接读视觉元数据 `photoMeta` / `VISION_RESULTS[src]` 的 `bbox` 与 `crop_risk`，**不能只靠页面级 intel**（单张真实视觉结果时页面 intel 为空，会漏判 → 这是 P1 联调时抓出的真缺陷）。

**验收（真机）**：10 张图（含多张 high 风险人物图）→ high 风险**全部 contain**、容器比例 == 图片真实比例 8/8、**裁切违规 0**；低质/未知比例图安全 cover 不露边。

---

## 3. P0-C　让「换风格」真正重生成内容

**问题**：旧「换风格」只换视觉 class，**标题/导语/引文/段落一个字不变**——老板点了 5 次，看到的还是同一篇稿。

**修法**（`src/publish.js` + `src/shell.js`）：
- 新增 `EDITORIAL_ANGLE_VOICE`（7 个角度）、`angleEditorialPack`、`editorialFacts`、`editorialFactsFingerprint`、`dnaFactFingerprint`、`editorialStylePackOf`。
- 「换风格」改用 `regenStyleContent(target)`：**冻结** `facts` / `DNA` / `photo-intel`，只重生成标题、导语、引文、段落、章节组织。
- 事实指纹机制：指纹变化（如换了活动/换了照片）→ 旧 stylePack 失效重算；连续点同一角度用 `_styleHistory` **降权**避免每次同一套。
- `src/shell.js` 的 `case "regenStyle"` 改为调 `regenStyleContent`（旧逻辑是换 class）。

**验收（真机）**：同一活动连点「换风格」5 次 → 5 套**不同**的角度/标题/导语/引文/章节组织；**事实字节级完全一致**（除照片数外 `confirmedFacts` 不变）。

---

## 4. P0-D　清理 Fallback 假营销话术

**问题**：各渠道文案（朋友圈/微信/语音/海报/小红书/回顾）混了大量编造紧迫感：「名额有限 / 手慢无 / 先到先得 / 私信我 / 群里接龙」等——无真实容量依据就编。

**修法**（`src/publish.js`）：
- 新增 `confirmedCTAOf(a)` / `urgencyTextOf(cta)`（按**容量确认**分档的紧迫话术）/ `ctaShortOf` / `ctaText` / `nextActivityOf` / `recapParticipationConfirmed` / `recapThanksLine`。
- 删除所有「名额有限 / 手慢无 / 先到先得 / 私信我 / 群里接龙」类硬编码；重写 `moments / wechat / voice / poster / xhs / regenCta / generateSectionCopy`。
- `fallbackShareCopy` 清理（activities.js）。

**验收（断言）**：CTA 分档与容量确认一致；未确认容量不出现任何编造紧迫词；回顾文感谢语不臆造参与反应（有 `actualFeedback` 才保留）。

---

## 5. P0-E　模块完整性 + 启动自检

**问题**：缺模块（如视觉挂了没加载）时页面静默退化，无提示，难排查。

**修法**：
- `src/core.js`：新增 `REQUIRED_MODULE_FILES` / `REQUIRED_MODULES` / `checkRequiredModules()`（返回缺失列表）。**放在 core.js 而非 boot.js**——因为冒烟 harness 跳过 `boot.js`，registry 在 core.js 才能被 epilogue 断言（实测踩过：放 boot.js 时 `REQUIRED_MODULES` 对 harness 不可见）。
- `src/boot.js`：载入期调 `checkRequiredModules()`，`console.error` + 开发态「Module Missing」横幅。

**验收（真机）**：正常加载无「Module Missing」横幅；epilogue 可断言 `checkRequiredModules()` 返回空数组。

---

## 6. P1　真实视觉智能（从假数据到统一 schema + 诚实降级）

**问题**：视觉层是启发式占位，无真实 schema，也无「降级了就明说」。

**修法**（`src/vision.js` + `src/publish.js`）：
- 统一视觉 schema：`asArr()`、`VISION_FINE_SCENES`（19 类）、`VISION_FINE_RULES`、`VISION_TO_GROUNDED_RULES`、`VISION_RESULTS`、`VISION_DEGRADED`。
- `visionUnifiedOf` 产出文档规定 schema（数组化、`subjects[].type`）。
- `visionResultOf` / `visionEvidenceScope`（§四 形状：`{materialEvidence, eventFact:false}`——照片是物证，**不是事件事实**）/ `visionGroundingTags`（仅 `simulated:false` 才打真实标签）/ `visionDegrade` / `visionIsDegraded` / `visionStatusSummary` / `visionFineScenesOf` / `visionMatchesFine`。
- §三 职责：`visionFilterPhotos` / `visionSelectCover` / `visionSectionFit` / `visionMatchSection` / `visionPageStyleHint`；§六 `visionIntelLabel` / `visionIntelDetail`。
- `applyVision` 注册 `VISION_RESULTS[src] = visionUnifiedOf(...)`，`PI_SCENE_LABEL` 扩展；降级时 UI 诚实显示「图片智能：基础分析」（真实识别时显示「视觉识别」）。

**验收（断言）**：19 类细粒度全覆盖；降级/真实/未分析数量内部可见不阻塞；`evidenceScope.eventFact === false` 恒真。

---

## 7. 改动文件清单

| 文件 | 涉及项 |
|---|---|
| `src/publish.js` | P0-A / P0-B / P0-C / P0-D / P1 |
| `src/activities.js` | P0-B / P0-C（xhFig / hero / fallbackShareCopy）|
| `src/shell.js` | P0-C（`case "regenStyle"` → `regenStyleContent`）|
| `src/core.js` | P0-E（`checkRequiredModules` 放此处）|
| `src/boot.js` | P0-E（载入期自检）|
| `src/vision.js` | P1（统一 schema / 降级 / 职责）|
| `styles.css` | P0-B（hero 保护 / 原比例组 / 非对称布局）|

备份：仓库 `versions/` 已存 v192 _release 各改动文件快照（仍被 gitignore，仅本地留痕）。

---

## 8. 验收与发版

- **新增回归** `case-v193-doc-optimization.epilogue.js`（143 项断言，由 P0-A/D/C/P1 验证脚本 + P0-B 10 图 + P0-E 合并而成）。
- **全量回归：31 个 epilogue 文件全绿**（v193 专属 143/143 + 历史 30 个无回归）。
- **真机（agent-browser + 本地 Chromium）**：P0-C 换风格 ×5 → 5 套不同文案、事实字节级一致；P0-B high 风险全 contain、容器比例==真实比例 8/8、0 违规；P0-A 秋林不写红叶；P0-D CTA 分档正确；P0-E 无 Module Missing；P1 19 类 + 5 职责 + evidenceScope。
- `bump.py 193` → 三入口 + boot.js `?v=` 全 193（platform 独立序列未动）→ commit `dd018de` → push。
- **线上核验（curl + MD5）**：`version.json.ver=193`、admin/front/index 三入口 `APP_VER=193`、`src/publish.js` 线上与本地 **MD5 一致**（`0056e445…`）、关键符号（`collectGroundedScenes` / `cropPolicyOf` / `editorialStylePackOf` / `VISION_RESULTS` / `checkRequiredModules`）线上齐全、线上 boot 无缺失模块/无 JS 报错。

---

## 9. 交付图（同框对照）

- `v193-deliverable/v193-SafeCrop-人物不被切半.png`：P0-B 安全裁图——人物主体完整（contain）、容器比例跟随真实比例、无切半。
- `v193-deliverable/v193-换风格五次-内容重生成对照.png`：P0-C 连点 5 次换风格 → 5 套不同文案、事实一致。

（两图位于 WorkBuddy 工作区 `v193-deliverable/`，未进 git 仓库。）
