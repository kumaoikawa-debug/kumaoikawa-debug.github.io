# v196 · 活动详情页交互重构：底部阅读栏 + 选项收敛 + 评价独立区段

> 触发：老板三条反馈 ——「① 放在顶部是不对的，交互体验不好」「② 这么多选项太多了，能不能减少掉换一种风格」「③ 活动评价也没有」。
> 三条都是**信息架构问题**，不是文案问题（v194 已修文案、v195 已补骨架）。本版一次性收敛。

---

## 一、三条反馈 → 三个改动

| 反馈 | 问题本质 | v196 做法 |
| --- | --- | --- |
| ① 顶部吸顶 Tab 体验差 | 顶部占位吃首屏；拇指够不到；遮挡主视觉 | **拆掉顶部 Tab**，改**底部阅读栏 + 目录抽屉** |
| ② 选项太多 | 简洁报名/图文长页/换版式/换风格 四个按钮并列，用户不知道点哪个 | **收敛为单个「换一种排版」**，详情页统一为图文长页 |
| ③ 活动评价没有 | 评价被埋在「报名信息」里，且**无数据时整体隐藏** → 观感就是「这页没有评价」 | **提升为独立区段 `#ed-reviews`**，进目录，无数据时给诚实空态 |

## 二、① 顶部 Tab → 底部阅读栏 + 目录抽屉

### 拆掉的部分
`<nav class="xh-ed-tabs" id="xhTabs">` 整块删除，`initEditorialTabs()`（IntersectionObserver 版）整块删除。

### 新增的部分
```
.activity-page          ← 页面主体（overflow: hidden，不能放 sticky）
.xh-ed-dock#xhDock      ← 底部阅读栏（后继兄弟节点）
.xh-ed-toc-root#xhTocRoot ← 目录抽屉根（再下一个兄弟）
```

**阅读栏内容**：左侧「目录」按钮（`data-action="edToc"`）+ 当前章节名 `#xhDockCur` ｜ 右侧 价格 + 咨询 + 立即报名。

**目录抽屉**：遮罩（点它关闭，`edTocClose`）+ 底部弹层，**6 个锚点一次全可见**，含编号 / 标题 / 副标题，当前项左侧色条高亮。点击（`edTocGo`）→ 收起抽屉 → 平滑滚到目标区段。

### ★ 本版最大的坑（沿用并强化 v195 结论）
`.activity-page { overflow: hidden }`（styles.css L2407）会让它成为「最近的滚动容器」且自身不滚动 →
**它内部任何 `position: sticky` 都静默失效**。真实滚动容器是 `.phone-screen#previewScreen`。
所以阅读栏与抽屉根**必须作为 `.activity-page` 的后继兄弟节点**返回（`renderActivityPhone` 返回多节点拼接，而非单一根）。

抽屉根不是 `position: fixed`，而是 `position: absolute; top: <scrollTop>px; height: <clientHeight>px` 由 JS 动态钉住
（`openToc` 里按 `previewScreen.scrollTop` / `clientHeight` 赋值）—— 因为 `absolute` 会随内容滚动，必须手动贴住可视区。
**真机实测：root 与 screen 的四边完全重合（`top/bottom/left/right` delta 全为 0）。**

### 主题换肤作用域随之放宽（承 v195 遗留）
v195 的主题类作用域是 `.xh-ed.ed-theme-*`，只覆盖 `.xh-ed` 子树。
但阅读栏与抽屉是 `.activity-page` 的**兄弟**，拿不到 `.xh-ed` 作用域 → 会出现「页面换肤了、阅读栏还是默认色」的断层。
v196 改为 `.ed-theme-*` 独立生效，并**在页面根 / 阅读栏 / 抽屉根三处都打主题类**。
真机实测：森林活动 `ed-theme-forest × 3`，溯溪活动 `ed-theme-island × 3`。

## 三、② 选项收敛：4 个按钮 → 1 个

- **删除 `detailModeSwitch()`**（简洁报名 / 图文长页 的模式开关），全仓 0 残留。
- `core.js` 默认 `state.detailMode = "editorial"`，seed 同步改为 `"editorial"` → **详情页统一图文长页**。
- 操作条 `ap-switch` 收敛为**单个** `chip(false,"regenStyle","","sparkles","换一种排版")`，右侧保留版式摘要（如「大图Hero-体感 ｜ 社交-转化型」）。
- `setDetailMode` / `regenLayout` **两个 action 处理器保留**（能力不删，只是不再暴露按钮），契约断言显式覆盖这一点。

> 取舍：老板要「换一种风格 / 另一种排版」，但「简洁报名」这条精简路径对**弱网/纯文字场景**仍有用，
> 所以**保留能力、摘掉入口**，而不是删除代码。

## 四、③ 活动评价提升为独立区段 `#ed-reviews`

### 之前为什么「没有」
`blockReviews(a)` 被塞在 `extraHtml`（报名信息区）内部，且开头就 `if (!a.reviews || !a.reviews.length) return ""` ——
**无数据时整块消失**，用户看到的就是「这个页面没有评价功能」。

### 现在
独立 `<section class="xh-ed-sec xh-ed-reviews" id="ed-reviews" data-sec="reviews">`，编号动态排（`08 / REVIEWS`），进目录第 5 项。

| 分支 | 渲染 |
| --- | --- |
| **有真实评价** | 均分（`4.7`）+ 星级条 + `N 条真实评价` + 条目列表（昵称/星级/日期/正文，最多 **12 条**，`rvItems.slice(0,12)`）；管理员每条可删（垃圾桶按钮） |
| **无评价** | 诚实空态：`还没有评价` + 「活动结束后的参与者评价会展示在这里。你也可以先在下面录入往期活动的真实评价 —— **平台不会替你编造任何评价。**」 |
| **管理员** | 空态或列表下方追加录入表单：昵称（可留空）/ 星级 select / 日期（默认今天）/ textarea / 「保存评价」 |

动作：`edReviewSave`（`unshift` 进 `a.reviews`，**正文为空时拒绝写入**）、`edReviewDel`（按下标 `splice`，越界安全不动数据）。

### ★ 非虚构硬约定（承 v185/v186）
**平台绝不自动生成、补齐、润色任何评价。** 无数据就如实说「还没有评价」。
录入表单里的 textarea 只给 placeholder 提示（"写下这位参与者的真实评价（活动后的原话最好）"），
**不预填任何内容** —— 这一点与「确认卡不许空输入框」不冲突：确认卡是**已知事实的确认**，
评价是**尚未发生的真实反馈**，不能凭推断造。

管理员可见性走 `edCanEditReviews()`（顶层函数，返回 `isAdminMode()`）——
**提到顶层是为了让 epilogue 能覆写它来分别测「有/无录入入口」两个分支**（首次实现嵌在 `renderActivityEditorial` 里，`ReferenceError`）。

## 五、刻意不做（守住既有契约）

| 不做 | 原因 |
| --- | --- |
| 改 `.xh-ed-fig` / `.xh-ed-fig img` 的 `--ar` / `object-fit` | **v190 契约本体**（容器比例＝图片真实比例） |
| 改图廊 `.ph` / `.ly-*` 版式 | **P0-10 / P0-11 契约**（设计槽位形状 + 安全裁切）；v195 已定「图廊完全不动」 |
| 改 `.activity-page` 的 `overflow: hidden` | 它是通栏出血（`margin: 0 -16px`）的裁剪保障；用兄弟节点绕开，不动它 |
| 改 `sec.imgCount` / `sec.imgKind` | P0-12 契约 |

**程序化守卫**：本次 commit 对 `styles.css` 的新增行中 `aspect-ratio` = **0**、`object-fit` = **0**、`!important` = **0**。

## 六、验收

### 1. 契约测试 `case-v196-detail-reading.epilogue.js`（**49 项，全绿**）
取代 `case-v195-detail-skeleton.epilogue.js`。覆盖：
- ① 顶部 Tab 与其 id 均不存在；阅读栏存在、是 `.activity-page` 后继兄弟（`indexOf` 顺序断言）、`position: sticky`
- ① 抽屉：6 个 `edTocGo` + 2 个 `edTocClose`；6 个锚点 id 真实存在；`initEditorialToc` 接线
- ② 无 `setDetailMode` / `regenLayout` 按钮；`regenStyle` 恰好 1 个；`detailModeSwitch` 0 残留；默认 `detailMode === "editorial"`
- ③ 评价区段存在；空态文案诚实（含「不会替你编造任何评价」）；管理员表单字段齐全；`edReviewSave` 空正文被拒；`edReviewDel` 越界安全
- 主题 `ed-theme-*` 在根/阅读栏/抽屉三处齐备；溯溪活动实测 island
- v195 骨架（DAY 卡片 / 清单 / 灯箱 / 5 锚点）未被破坏
- **反向验证**：简洁报名（lean）详情不含新骨架
- 接线：`await handleClick` 跑 `edToc` / `edTocClose` / `edTocGo` / `edReviewSave` / `edReviewDel` / `clToggle` 均不抛错

### 2. 回归
全量 **32 个 epilogue ALL GREEN**。
配套修正：`p0-3.epilogue.js` 显式固定 `state.detailMode = "lean"`（它测的是 lean 双层输出）；
`case-v192-photo-density.epilogue.js` 的 `secFigCounts` 排除 `reviews`（无图区段，不是配图回归）。

### 3. 真机浏览器走查（Playwright 实测，非纸面断言）

**线上生产页 `admin.html` → `showView("detail")`**（容器 `.phone-screen#previewScreen`，351×720）：

| 检查项 | 实测结果 |
| --- | --- |
| 顶部 Tab | `.xh-ed-tabs` 数量 **0**、`#xhTabs` **不存在** |
| 阅读栏父子关系 | `parentElement === #previewScreen` **true**；`page.nextElementSibling === dock` **true** |
| 阅读栏吸附（滚 0 / 700 / 1600px） | 底边相对容器底 `[0, 0, 0]` → **恒贴底** |
| 阅读栏内容 | `图文故事 ¥168/人 咨询 立即报名` |
| 滚动联动当前章节 | 顶=「图文故事」→ 62% 处=「费用说明」→ **随滚动切换** |
| 横向裁切 | `scrollWidth - clientWidth = 0` |
| 6 个锚点 | `ed-story / ed-itin / ed-fee / ed-prep / ed-reviews / ed-cta` **全 ✓** |
| 抽屉开合 | `display: none → block`；滚动锁 `overflowY: hidden` → 关后还原 `auto` |
| 目录条目 | **6 项**，含「05 活动评价 / 参与者怎么说」 |
| 抽屉定位（等动画结束） | root `top/bottom` = 66/786 = 容器；panel `bottom/left/right` delta **全为 0**；`inside: true`；末项可见；遮罩全覆盖 |
| 点目录第 5 项 | `scrollTop` 0 → 8381；`#ed-reviews` 停在容器顶 **14px**（＝`scroll-margin-top`）；目录项高亮 idx=4；阅读栏同步显示「活动评价」；抽屉自动收起 |
| 选项收敛 | `[data-action=setDetailMode]` 数量 **0**；`[data-action=regenStyle]` 数量 **1** |
| 主题 | 森林活动 `ed-theme-forest × 3`；溯溪活动 `ed-theme-island × 3`；阅读栏也带上主题类 |
| 默认模式 | `state.detailMode === "editorial"` |
| 控制台 | **无 error** |
| 全页 19x 文本 | 仅 `v196`（16 处），**无任何 `195` 残留** |

> 走查中一度以为「抽屉面板底边超出容器 16px」「点目录不跳转」，实为两个**测量陷阱**：
> ① 面板有 `animation: xhTocUp .22s`（`translateY(16px) → 0`），**进场动画进行中测量**就会多出 16px；
> ② `edTocGo` 用 `scrollIntoView({behavior:"smooth"})`，**平滑滚动是异步动画**，点击后同步读 `scrollTop` 必然是旧值。
> 两者**延时重测后均归零/归位**，非缺陷 —— 已写进下方「固化的约定」。

### 4. 静态样例（真实渲染函数 + 线上 CSS 内联，单文件离线可开）
- `detail-v196-sample-hike.html`（森林主题 · **有 3 条真实评价**，均分 4.7）
- `detail-v196-sample-water.html`（海岛主题 · **无评价 → 诚实空态**）
- v190 图片比例实测：6 张 `.xh-ed-fig` **全部** `--ar` 与图片真实比例一致（偏差 0）；
  图廊 `.ph` 沿用 P0-10 设计槽位 + 安全裁切（`object-fit: cover`），**非 v196 回归**（本版对图廊 CSS 改动 0 行）。

### 5. 线上核验
`version.json` = **196**；`version.json / src/boot.js / index.html / admin.html / front.html / src/activities.js / src/shell.js / src/core.js / styles.css`
**9 个文件本地与线上 MD5 全一致**；**32 项内容探针全部命中**（版本 4 项 / ① 8 项 / ② 7 项 / ③ 7 项 / CSS 6 项）。

## 七、发版信息

- 版本：**v196**（`version.json` ver=196）
- 代码提交：`v196 活动详情页交互重构：底部阅读栏 + 选项收敛 + 评价独立区段`（15 文件，+642 / −291，含新增契约测试 +292 行）
- 线上：<https://kumaoikawa-debug.github.io/admin.html>（活动内容 → 点开活动 → 详情）

## 八、由此固化 / 强化的约定

1. **`.activity-page` 内的 `position: sticky` 一律无效**（`overflow: hidden` 所致）。
   要吸顶/吸底，元素必须是 `.phone-screen#previewScreen` 的直接子元素 → 渲染函数要返回「兄弟节点」而不是单一根。（v195 立，v196 再次命中）
2. **主题/换肤类必须同时打在「容器根 + 所有被提到根之外的兄弟节点」上**，否则变量作用域断链。
   v196 起作用域放宽为 `.ed-theme-*`（不再要求 `.xh-ed` 前缀），并实测 `× 3`。
3. **`position: absolute` 的浮层不会自己贴住滚动视口** —— 必须由 JS 按 `scrollTop` / `clientHeight` 动态钉位。
4. **测量浮层几何前必须等进场动画结束**（`animation` 会临时改变 `translateY`），否则会误判成「定位溢出」。
5. **测量平滑滚动结果前必须等动画结束**（`scrollIntoView({behavior:"smooth"})` 是异步的），同步读 `scrollTop` 会得到旧值。
6. **非虚构硬约定的边界**：确认卡「不许空输入框」是因为要确认**已知事实**；
   评价表单可以留空，因为那是**尚未发生的真实反馈**，**平台绝不代填、代造**。
7. **保留能力 ≠ 保留入口**：老板嫌选项多时，优先**摘掉按钮、保留 action 处理器**（并加断言固化），而不是删代码。
