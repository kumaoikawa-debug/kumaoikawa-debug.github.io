# v195 · 活动详情页重构：行程骨架 + 杂志视觉（组合方案）

> 触发：老板反馈「图文排班始终没有达到想要的效果」。
> 做法：先上 GitHub 找可借鉴的现成方案 → 定方向 → 出独立预览定稿 → 再接入 SPA 发版。

---

## 一、为什么之前的「图文排班」达不到效果

不是文案不行（v194 已修「所有文案都一样」），而是**整页缺少可导航的结构**：

| 症状 | 本质 |
| --- | --- |
| 长图文只能一路往下滚，找「多少钱」「怎么报名」要滑很久 | 没有区段导航 |
| 每天行程是一段带左边线的文字，DAY 之间没有呼吸感 | 行程没有卡片化骨架 |
| 出行前要带什么，只能翻正文找 | 没有清单模块 |
| 照片只能看小图 | 没有灯箱 |
| 徒步 / 溯溪 / 雪山 / 沙漠的活动页长得一模一样 | 没有按活动类型换肤 |

结论：缺的是**骨架**（可导航、可扫读、可交互）与**杂志视觉**（主视觉、图廊、主题感），不是再改文案。

## 二、GitHub 参考与取舍

调研落档：`activity-detail-github-refs.md`（工作区，非仓库）。

| 参考 | 借鉴点 | 取舍 |
| --- | --- | --- |
| `ns0116/trip-itinerary-template` | 吸顶区段 Tab、DAY 时间轴、悬浮报名卡、出行清单、design-token 主题 | **骨架首选**（纯 HTML/CSS/JS 无构建，可移植） |
| `CodingWithJiro/freecodecamp-css-magazine-layout` | Grid Hero 叠底、gap-free 图廊、lightbox | Hero 叠底 + lightbox 采纳；**gap-free 强制比例不采纳**（见下） |
| Blank Magazine（Hugo 主题） | 衬线正文、无缝隙图廊、灯箱 | 衬线正文/灯箱已有；图廊不动 |
| `ihaback/festival-landing-page` | CSS 变量主题分层 | 采纳为按活动类型换肤 |
| Dash10107/zine（Next.js）、cocteau/wwoc-starter（Svelte）、glidaa（React） | — | **排除**：带构建链，无法移植进「无构建纯静态 SPA」 |

**关键取舍**：参考里的「gap-free 图廊」普遍靠给每张图写死 `aspect-ratio` 实现。本项目有两条硬约定与之直接冲突：
- **v190**：图片容器比例 == 图片真实比例（写死比例会把竖图塞进扁容器）
- **P0-11**：安全裁切（宁可原比例留白，也不裁掉主体）

所以**图廊完全不动**，沿用既有 P0-10 自适应版式（`buildAdaptiveLayout` / `layoutHtml`），只加了 `cursor: zoom-in` 与灯箱。组合方案最终 = **ns0116 骨架 + Magazine 视觉中不违反上述两条约定的部分**。

## 三、本次改了什么（全部为「新增」）

### 1. 吸顶区段导航 `#xhTabs`
图文故事 / 详细行程 / 费用说明 / 出行清单 / 报名，5 个锚点，滚动联动高亮（IntersectionObserver）。

> ★ **本版本最大的坑**：导航**必须作为 `.activity-page` 的前置兄弟节点**返回，不能放在它内部。
> 原因：`.activity-page { overflow: hidden }`（styles.css L2407）会让它成为「最近的滚动容器」，
> 而它自身并不滚动 → 内部所有 `position: sticky` **静默失效**。
> 事实上既有的 `.ps-topbar`(L425) 与 `.bottom-bar`(L500) 都声明了 `position: sticky`，也正是因此一直没生效。
> 真实滚动容器是 `.phone-screen#previewScreen`（height:720px; overflow-y:auto），
> 导航作为它的直接子元素才能正确吸顶。**真机实测：容器内滚动 900px 后导航 `getBoundingClientRect().top` 不变。**

### 2. DAY 时间轴卡片化（ns0116 风格）
把原来的「左边线 + 段落」改为**卡片**：容器卡（圆角/描边/底色）+ 卡头（`DAY n · 标签`）+ 纵向轨道 + 节点圆点。
保留原 `.tl-item` / `.tl-node` / `.t` / `.d` 结构与 `--page-*` 配色，只重排容器与节点定位。

### 3. 出行前清单 `<details id="ed-prep">`
- 条目**按活动类型差异化**（基础 5 条 + 场景补充，最多 8 条）：
  徒步/登山 → 保暖层、徒步鞋、头灯、路餐（雪/高海拔再加雪镜）
  溯溪/水上 → 速干衣、溯溪鞋、防水袋
  骑行 → 头盔、补胎工具
- 勾选状态按活动持久化：`localStorage["clubos_prep_<活动id>"]`
- 进度 `x/N` 实时刷新（`case "clToggle"`）

### 4. 图片灯箱 `#xhLightbox`
点章节图 / 图廊图放大，点遮罩或关闭按钮收起。作为 `.activity-page` 的**后置兄弟节点**。

### 5. 按活动类型换肤 `.ed-theme-{forest|snow|island|desert}`
由 `edThemeOf(a)` 依据 `a.type + a.season + a.place` 判定；作用域**仅 `.xh-ed` 子树**，覆盖 `--brand / --brand-700 / --surface / --surface-2 / --line / --line-2 / --bg`。
**主题类必须同时打在「导航」和「页面根」上** —— 只打导航会导致换肤变量作用域不到页面主体（首次实现就踩了这个坑，被新增的契约断言抓住）。

### 6. 5 个区块锚点 id
`ed-story` / `ed-itin` / `ed-fee` / `ed-prep` / `ed-cta`，并配 `scroll-margin-top: 54px` 避免被吸顶条盖住标题。

## 四、刻意不做（守住既有契约）

| 不做 | 原因 |
| --- | --- |
| 图廊 gap-free 强制比例 | 同时违反 v190（真比例）与 P0-11（安全裁切） |
| 改 `.xh-ed-fig` / `.xh-ed-fig img` 的 `--ar` / `object-fit` | v190 契约本体 |
| 改 `sec.imgCount` / `sec.imgKind` | P0-12 契约 |
| 改 `.activity-page` 的 `overflow: hidden` | 它是通栏出血（`margin: 0 -16px`）的裁剪保障；改用兄弟节点绕开，不动它 |

## 五、验收

### 1. 新增契约 `case-v195-detail-skeleton.epilogue.js`（31 项）
覆盖：导航兄弟节点位置（`indexOf` 顺序断言）、5 锚点闭环（Tab 落点 id 必须真实存在）、
清单条数/进度/storage key、清单按类型差异化、四套主题判定 + 空值兜底、根与导航主题类一致（`occ==2`）、
溯溪活动实测渲染为海岛主题、DAY 骨架未破坏行程、`clToggle` / `edTab` / `initEditorialTabs` 接线不抛错、
**反向验证**（简洁报名详情不含新骨架）、v190 结构未被替换。

### 2. 回归
全量 **32 个 epilogue ALL GREEN**（原 31 + 新增 1）。

### 3. v190 守卫（程序化）
新增 CSS 段（`git diff` 的 `+` 行）中：`aspect-ratio` = **0**、`!important` = **0**，39 条规则全部为新作用域。

### 4. 真机视觉走查（浏览器实测，非纸面断言）
| 检查项 | 结果 |
| --- | --- |
| 吸顶是否真的生效 | 容器内滚 900px，`#xhTabs` 的 `top` 恒等于容器顶（225）→ 生效 |
| 导航是否为滚动容器直接子元素 | `tabs.parentElement === .sample-screen` → true |
| v190 容器比例 == 图片真实比例 | 全部章节图 `ratioProblems: []`（阈值 0.06） |
| 清单 | 8 条，`0/8`，勾选可切换 |
| 主题 | hike → `ed-theme-forest`，water → `ed-theme-island`；根 + 导航各 1 处 |
| 锚点 | `ed-story/ed-itin/ed-fee/ed-prep/ed-cta` 全部存在 |

> 走查时发现并修正了 2 个问题：
> ① 主题类只打在导航上 → 换肤不生效（已修，并加断言固化）；
> ② 根类拼接 `[:-1]` 把主题类加到了引号外（已修为 `[:-2]`）。

### 5. 线上核验
`APP_VER=195`；`version.json / boot.js / src/shell.js / src/activities.js / styles.css / admin.html / front.html / index.html` **8 个文件本地与线上 MD5 全一致**；13 项内容探针全中。

## 六、发版信息

- 版本：**v195**（`version.json` ver=195）
- 代码提交：`v195: 活动详情页重构（组合方案＝行程骨架 + 杂志视觉）`（9 文件，+429 / −54）
- 线上：<https://kumaoikawa-debug.github.io/admin.html>（活动内容 → 点开活动 → 图文长页）
- 预览样例（真实渲染输出 + 线上 styles.css 内联，单文件离线可开）：
  - 森林主题（徒步）：`detail-v195-sample-hike.html`
  - 海岛主题（溯溪）：`detail-v195-sample-water.html`

## 七、由此固化 / 强化的约定

1. **`.activity-page` 内的 `position: sticky` 一律不会生效**（因 `overflow: hidden`）。要吸顶，元素必须是 `.phone-screen#previewScreen` 的直接子元素 → 渲染函数要返回「兄弟节点」而不是单一根。
2. **主题/换肤类必须同时打在「容器根」与「任何被提到根之外的兄弟节点」上**，否则变量作用域断链。
3. **参考外部实现前先对齐本项目硬约定**：GitHub 上流行的「gap-free 图廊写死 aspect-ratio」在本项目里同时违反 v190 与 P0-11，属于**不可移植**的美学，必须换实现或放弃该模块。
4. 静态样例导出用真实渲染函数 + 内联真实 CSS（见工作区 `dump_sample.js`）；但**占位图无照片元数据**，需去掉 `loading="lazy"` 并等图解码后再量比例，否则会误判成「比例不对」。
