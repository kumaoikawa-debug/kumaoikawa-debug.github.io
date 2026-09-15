# v187：§七 最终完成标准 —— 把「一句话创建」与「AI 宣发中心」接成一条闭环

## §七 要求 vs v186 现状（先做体检）

| §七 要求的老板体验 | v186 现状 | 判定 |
|---|---|---|
| 输入一句话 | `createInput` + `AI 生成活动` | ✅ |
| 上传图片 / 旧资料 | **创建阶段无照片入口**，照片必须另开「AI 宣发中心」重选活动再传 | ❌ 断点 |
| AI 自动理解 | `parseActivityWithAI` + `applyAIResult` + Activity DNA | ✅ |
| 系统只问几个必要问题 | 「老板确认卡」`detectKeyGaps`（缺失+推断，按优先级排序） | ✅ |
| 自动生成完整活动 | `ensureNarrativeFields` + `ensureItineraryFields` | ✅ |
| 自动生成有感染力的图文详情页 | 确认卡之后走 `advice → 进入编辑`，**被迫逐字段改**；详情页在另一个模块且要重选活动 | ❌ 核心断点 |
| 不满意就换版式 / 换风格 | `nextVariant` / `switchStyle` / `quickStyle` | ✅ |
| 确认发布 | **详情页结果页没有发布按钮**（只有复制 HTML / 重新选择） | ❌ 断点 |

**结论**：v186 的两个流程是**互不相通的两条路** ——
- 路径 A（活动内容）：一句话 → 确认卡 → 策略页 → **编辑器（逐字段改）** → 发布；
- 路径 B（AI 宣发中心）：选已有活动 → 传图 → 轻确认 → 生成 → 结果页（无发布出口）。

老板必须自己把两条路接起来，正是 §七 要消除的体验。本版把三个断点接上。

---

## 改了什么

### 断点 1：照片/旧资料在创建阶段无法上传 → 已补
- **第 1 步（`renderCreate`）**新增照片上传区（`createPhotoInput`），暂存到 `state._pendingPhotos`，
  `generateFromInput()` 生成活动时带进 `draft.photos`。严格对齐 §七 顺序：输入一句话 → 上传图片 → AI 理解。
- **确认卡（`renderFactConfirm`）**也新增照片上传区（`confirmPhotoInput`）+ 缩略图 + 移除，
  可随时补图，`bindConfirmExtras()` 直接写入 `draft.photos`。

### 断点 2：确认卡之后没有直连详情页 → 已补（核心）
- 新增 `confirmFactsToPage()`：应用确认卡里补的关键事实 → **自动落库**（`upsert`，老板无需手动保存）→
  初始化宣发状态（`scenario=recruit`、指向本活动、照片带入、原话作为补充资料）→ `showView("operator")`
  → 直接调 `runRecruitGen()` 生成 → 落到**可换版式/换风格的结果页**。
- 确认卡主按钮由「补全并进入编辑器」改为 **「补全并生成图文详情页」**；
  「进入编辑器」从主路径降级为 `advice` 页的次要出口（想逐字段调的人仍可用）。
- 策略页（`renderContentAdvice`）主 CTA 同步改为「生成图文详情页」，编辑器降为次要。
- 生成逻辑从 `recruitGen` / `recapGen` handler 抽出为 `runRecruitGen()` / `runRecapGen()`（两条路径复用同一实现，逻辑不变）。顺手修掉一个隐患：补充资料输入框为空时不再清掉已带入的 `xf.notes`。

### 断点 3：详情页没有发布出口 → 已补（最后一环）
- `styleBar` 新增主按钮 **「确认发布」**（`confirmPublishPage`），与「换一种版式 / 换一种风格」并排。
- `confirmPublishPage()`：先跑 `runPublishCheck`；**关键事实不全不硬发** —— 自动把活动照片带回并跳回确认卡补全
  （而不是丢进编辑器）；通过后状态置 `recruiting`、写入历史活动库（下次可一键沿用）。
- 回顾场景（`scenario=recap`）按钮为「发布回顾」，只标 `recapPublished`，**不改活动状态**（已结束活动不该被改回招募中）。

---

## 现在的老板体验（§七 目标形态）

```
输入一句话（第 1 步，可同时传图）
  ↓
AI 自动理解 → 老板确认卡：只问几个必要问题（可继续传图）
  ↓
点「生成图文详情页」 ── 自动落库 → 自动挑图 → 自动配图 → 自动排版 → 自动规避裁坏
  ↓
图文详情页结果页 ── 不满意：换一种版式 / 换一种风格（快捷：更杂志/更视觉/更专业/更自然）
  ↓
点「确认发布」→ 发布完成，自动进历史活动库
```
老板**不再需要**：逐字段修改、自己挑图、自己配图、自己排版、自己检查人物有没有被裁坏、以及「想到要去另一个模块」。

---

## 验收

新增 `case-sec7-oneclick-flow.epilogue.js`：**29/29 全绿**，端到端跑通真实链路。关键实测：

- 第 1 步存在传图入口；确认卡存在传图入口且主按钮 = `confirmFactsToPage`
- `confirmFactsToPage()` 后：活动已落库、`xf.scenario=recruit`、照片 3 张带入、`xf.step==="result"` 且 `out.gzh` 非空
- **全程 `state.view !== "editor"`、`state.draft` 已释放**（即未经过逐字段编辑器）
- 自动选定家族/变体（实测 `challenge_editorial/0`）、自动产出 5 节结构、`photoIntel.roles=3`、`evaluateCropSafety` 可自动调用
- 换风格后 `confirmedFacts` 前后一致（394→394 字节）——**只改视觉不改事实**
- `confirmPublishPage()` 后活动状态 `recruiting`、已进历史库
- **反面对照**：关键事实不全 → 状态仍 `draft`、自动回到 `factConfirm`；`photoOverrides.cover` 仍为 `null`、`excluded` 为空（=封面与筛图全由 AI 自动决定，老板未动手）

**全量回归 27 个 epilogue 文件全绿**（v186 的 26 + 本版 §七）。

---

## 顺手修掉的 harness 缺口

`spa-smoke.js` 的 DOM stub `style` 只有普通对象，缺 `setProperty`，
导致任何走 `showView → updateBrandColor` 的**链路级**断言会以 `TypeError` 误判失败（只能测纯函数）。
已补 `setProperty / removeProperty / getPropertyValue`，现在可以写「端到端点按钮」级验收。
（该文件在 `~/.workbuddy/skills/clubos-static-spa-release/scripts/`，为本轮 harness 能力升级。）

## 发版

备份 `versions/publish-presec7-v186.js`、`versions/shell-presec7-v186.js`、`versions/activities-presec7-v186.js`
（`versions/` 被 gitignore，仅本地留存）→ `bump.py 187` → version.json / 三入口 `APP_VER` / `?v=` 同步；
`platform/` 独立序列 85 未动。

## 说明

- §七 的「自动挑图/配图/排版/裁坏规避」底层能力在 v182–v186 已实现，本版做的是**把它们接进老板的实际点击路径**，
  而不是重写算法。
- 照片上传的浏览器端处理（`FileReader` + `analyzeImageFocus`）无法在 Node 冒烟里真实触发，
  该部分依赖手工走查；链路级断言已覆盖「照片进入生成 → 自动分配角色 → 自动排版」。
