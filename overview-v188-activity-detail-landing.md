# v188 · 修「创建活动后跳到 AI 宣发中心，没有生成活动详情」

## 老板反馈

> 「创建活动后直接跳到宣传中心来了，没有生成活动详情。」

## 根因（v187 的落点错了）

v187 把确认卡主按钮做成「补全并生成图文详情页」，但落点写成了：

```js
showView("operator");     // ← AI 宣发中心
await runRecruitGen();    // ← 生成的是公众号推文 / 小红书文案
```

而系统里真正的**活动详情页**是另一套东西：

| | 视图 | 渲染函数 | 说明 |
|---|---|---|---|
| AI 宣发中心 | `operator` | `renderFabu` | 生成公众号 / 小红书 / 朋友圈宣发文案 |
| **活动详情页** | `detail` / `activityPage` | `renderActivityPhone` → `renderActivityEditorial` | 活动本身的图文详情页（含换版式/换风格） |

所以老板被送进了「宣发中心」，看到的是"本次核心传播主题 / 换一种版式 / 换一种风格"，
自然会说「没有生成活动详情」。

## 修复

### 1. 新增后台「活动详情」工作区（`activityPage`）

`renderActivityPage()`（activities.js）：创建后的**默认落点**，套在后台 shell 里，
顶部是一条工作流工具条 + 下方是真实渲染的活动图文详情页（手机预览）：

- 状态徽标（草稿 / 招募中 / 已结束）
- **AI 已自动完成**摘要：事实 N 项 · 选图 M/N 张 · 角色 N 个 · 版式 · 风格
- 操作：`返回活动内容` / `生成宣发文案`（可选后置） / `微调字段`（兜底） / **`确认发布`**
- 详情页模式：`简洁报名` / **`图文长页`（默认）**
- `换版式` / `换风格`（复用 P0-13 的双轴：layout 轴 / style 轴）

### 2. `confirmFactsToPage()` 落点改对

```js
// v187（错）
showView("operator"); await runRecruitGen();

// v188（对）
state.detailMode = "editorial";        // 默认给有感染力的图文详情页
state.draft = null;                    // 不挂在编辑器里
showView("activityPage", { id: fa.id });
```

同时补上「完整活动」的自动生成：`syncDerived` / `ensureNarrativeFields` /
`ensureItineraryFields` / `syncItineraryDays` + 自动选封面 `bestCoverIndex` +
自动选定 `editorialLayoutId` / `editorialStyleId`（纯本地，保证一定有页可看）。

### 3. 宣发文案降级为「可选后置步骤」

新增动作 `operatorFromActivity`：老板在活动详情页点「生成宣发文案」才进 AI 宣发中心，
并把当前活动（含照片）自动带过去，不需要重新选活动。

### 4. 确认发布支持三种语境

`confirmPublishPage()` 现在可从「活动详情工作区 / 前台详情页 / 宣发中心结果页」任一处触发；
事实不全时不硬发，带照片回退到确认卡补全。

### 5. 活动列表入口

「查看」改为「详情页」→ 直接进 `activityPage` 工作区（原来只跳前台详情）。

### 6. 侧边导航高亮

`activityPage` 归到「活动内容」分组高亮，不再出现"导航无高亮"。

## 验收

`case-sec7-oneclick-flow.epilogue.js` 重写，**39/39 全绿**，关键回归断言：

- `§七-4 ★落点 = 后台「活动详情」工作区（activityPage）` ✅
- `§七-4 ★不再跳到 AI 宣发中心（operator）` ✅
- `§七-4 全程未进入逐字段编辑器` / `草稿已释放` / `默认输出图文长页` ✅
- `§七-5 完整活动：关键决策字段齐备`（title/type/place/date/price/limit/difficulty）✅
- `§七-6 详情页渲染出图文长页（xh-ed，15599 字符）` ✅
- `§七-7 换版式生效`（`L-mosaic-story → L-solo-route`）`换风格生效` `事实不变` ✅
- `§七-8 点「生成宣发文案」才进 AI 宣发中心` ✅
- `§七-9 确认发布 → 招募中 + 进历史库 + 仍停在活动详情` ✅
- `§七-11 反面对照：事实不全 → 不硬发，回确认卡` ✅

全量回归 **27/27 全绿**。

## 老板现在的一遍操作

输入一句话 →（第一步就能传图）→ AI 生成中 → 确认卡（只补几个必要问题）
→ **活动详情页**（AI 已排好版、配好图、选好封面）→ 不满意就换版式 / 换风格
→ `确认发布` → 上线。想发公众号时再点「生成宣发文案」。

不再经过：逐字段改 / 自己挑图 / 自己配图 / 自己排版 / 自己检查裁图。
