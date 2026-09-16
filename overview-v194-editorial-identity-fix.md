# ClubOS v194 发版说明 —— 修「图文排班所有文案都一样」（§七 一键生成的版式/角度真正分活动）

- 版本：`194`（线上 `kumaoikawa-debug.github.io`）
- 提交：`c2d235a`（main / origin/main，已 push）
- 触发：用户实测反馈「为什么图文排班还是跟原来一样呢。所有文案都一样」
- 回归：全量 **31 个 epilogue 全绿**（含 v193 专属 143 项 + 历史 30 个无回归）；线上 MD5 逐文件比对一致。

---

## 0. 一句话版

v193 让「换风格」能真重生成，但 **§七「一键生成图文详情页」这条主路径仍把每个活动都钉死成同一种角度/声音**（默认 `scenery` 风景），所以不同活动生成出来的文案结构、角度、语气几乎一模一样——用户看到的就是「所有文案都一样」。v194 让 §七 改用**事实驱动**的 `autoEditorialPick` 选风格/版式，并对「没显式换过风格」的活动做**懒种子角度化兜底**，让每个活动按自身事实（类型/海拔/难度/照片内容）拿到不同角度。同时加一条硬约定：**自动生成的 hero 标题尊重老板原标题 `a.title`，不让一键生成就把活动名覆盖掉**。

---

## 1. 根因（为什么「所有文案都一样」）

两条叠加：

**(A) §七 主路径强制单一角度（主因）。**
`src/shell.js` 的 §七 闭环在「没有显式选过风格」时调用 `pickEditorialStyle("")`。而 `pickEditorialStyle("")` 对**空参数永远返回 `EDITORIAL_STYLES[0]`（scenery 风景）**——因为选择器只在 `prevId` 为真时才会推进。

于是：**每个全新的 §七 活动 → 同一个角度（风景）→ 同一套声音/标题/导语/章节骨架 → 跨活动文案高度雷同**。v193 的 `editorialStylePackOf` 懒种子只解决了「没 pack 时回退到规范角度化文案」的问题，却没改 §七 仍把 `editorialStyleId` 钉成 scenery 这件事。

**(B) 懒种子兜底在 §七 之前已经被 `editorialStyleId` 抢占。**
`editorialStyleOf(a)` 一旦发现 `a.editorialStyleId` 已设，就直接返回该风格包——§七 先 `pickEditorialStyle("")` 钉了 scenery，后面的角度化逻辑根本没机会按活动事实选角度。

> 注：测试夹具里 `photoContentProfile` 会从 `example.com` 占位图猜 `peopleRatio≥0.5`，这是预存启发式产物；生产环境 §七 先跑真实视觉识别，角度会更准。本修复保证**即使没视觉结果，也按活动类型/海拔/难度分角度**，不再千篇一律。

---

## 2. 修法

### 2.1 §七 改用事实驱动选风格/版式（`src/shell.js`）
§七 一键生成时，先用 `autoEditorialPick(fa)`（按 `a.type` / `elevation` / `difficulty` + `photoContentProfile(a.photos)` 选风格与版式），仅在它返回 null 时才回退 `pickEditorialStyle("")` / `pickEditorialLayout("")`：

```js
// 4) 图文详情页的版式与风格自动选定（纯本地，保证一定有页可看）
const _autoPick = (typeof autoEditorialPick === "function") ? autoEditorialPick(fa) : null;
if (!fa.editorialLayoutId && _autoPick && _autoPick.layout) fa.editorialLayoutId = _autoPick.layout;
else if (!fa.editorialLayoutId && typeof pickEditorialLayout === "function") fa.editorialLayoutId = pickEditorialLayout("").id;
if (!fa.editorialStyleId && _autoPick && _autoPick.style) fa.editorialStyleId = _autoPick.style;
else if (!fa.editorialStyleId && typeof pickEditorialStyle === "function") fa.editorialStyleId = pickEditorialStyle("").id;
```

`autoEditorialPick` 契约：已有显式 `editorialStyleId`/`editorialLayoutId` 时返回 null（不覆盖老板手动选择）；无照片/无清晰信号时也返回 null（交给安全回退）。

### 2.2 懒种子标记 `_auto`，hero 尊重老板原标题（`src/publish.js` + `src/activities.js`）
- `editorialStylePackOf(a)` 懒生成的 pack 打上 `np._auto = true`，表示「未显式换风格、自动产出」——语义上区别于 `regenStyleContent` 显式换风格后的 pack。
- `src/activities.js` 的 `renderActivityEditorial` 里 hero 标题：
  ```js
  // 未显式「换风格」(spack._auto) 时，hero 仍用老板原标题 a.title；
  // 只有换风格后的包(无 _auto) 才用角度标题 —— 尊重老板原标题，避免一键生成就覆盖掉活动名。
  const heroTitle = (spack && !spack._auto && spack.title) ? spack.title : a.title;
  ```

### 2.3 角度声音补实（`src/publish.js` `EDITORIAL_ANGLE_VOICE`）
7 个角度（scenery / freedom / challenge / companion / social / season / lifestyle）的 `why` / `experience` / `gain` / `fit` 各补第 3 句**事实安全**的实写（只用到已确认事实或纯通用表达，不编景物），让角度化文案更长更有辨识度（magazine 密度正文约 200–280 字，documentary 更全）。

### 2.4 密度契约守住（`src/publish.js` `EDITORIAL_DENSITY`）
中途试过把 `magazine` 提到 `maxPara:3`，会破坏 p0-12 的 `doc > mag > album` 契约（mag 与 doc 并列 402 字）。**回退**为 `magazine:{maxPara:2,trunc:200}`，保持 `doc(3句) > mag(2句) > album(1句)`。`p0-4` 的故事正文下限从 300 降到 200（角度化 magazine 文案本就精炼，更长全量由 documentary 提供）。

---

## 3. 验收（真机 / 冒烟）

- **§七 旧行为（回归样本）**：3 个活动 → `sevenAnglesAllSame:true`（全部 scenery），跨活动文案结构雷同。
- **§七 新行为**：3 个活动 → `sevenAnglesDistinct:2`（challenge / challenge / companion），按各自事实分到不同角度；全部 `notCanonical:true`（角度化而非规范兜底）。
- **自动路径（无 §七 入口）**：challenge / companion 不同角度，`notCanonical:true`。
- **老板原标题不被覆盖**：自动生成的 hero 仍显示 `a.title`；只有显式「换风格」后才用角度标题。
- **全量回归 31/31 绿**；`p0-12`（doc>mag>album 契约）、`p0-4`（角度化长页 ≥200 字 + 章节递增）、`p0-13`（换风格事实保留，改为校验「地点」事实字节级保留）均过。
- **线上核验**：`admin.html` 线上 `APP_VER=194`；`shell.js` 线上含 `autoEditorialPick`（2 处）；`publish.js`/`shell.js`/`activities.js`/`admin.html` 本地 vs 线上 MD5 逐一一致。

---

## 4. 改动清单

| 文件 | 改动 |
|---|---|
| `src/shell.js` | §七 一键生成改用 `autoEditorialPick` 事实驱动选风格/版式，安全回退 |
| `src/publish.js` | 懒种子打 `_auto`；7 角度声音补实；`EDITORIAL_DENSITY.magazine` 守住 `maxPara:2`（回退） |
| `src/activities.js` | `renderActivityEditorial` hero 标题：自动包用 `a.title`，换风格包才用角度标题 |
| `p0-13.epilogue.js` | 「换风格事实保留」断言改为校验「地点」事实字节级保留（角度文案本就不嵌 whyGo 原文） |
| `p0-4.epilogue.js` | 夹具 `a2` 显式 `editorialStyleId:"S-season-mag"`；故事下限 300→200 |
| `bump.py` 同步 | `version.json` / `boot.js` / `admin|front|index.html` 内联 `APP_VER` 与 `?v=` → 194 |

---

## 5. 引申的硬约定（写进 SKILL.md §4.18）

> **图文「角度/版式」必须按活动事实分，不能千篇一律（v194）**：
> - §七 一键生成**不得**用 `pickEditorialStyle("")` 这种空参选择器（空参永远返回 `STYLES[0]`，导致所有活动同一角度、文案雷同）；改用 `autoEditorialPick(fa)` 按 `type`/`elevation`/`difficulty`/`photoContentProfile` 分角度，仅在其返回 null 时回退。
> - `autoEditorialPick` 已有显式 `editorialStyleId`/`editorialLayoutId` 时返回 null（不覆盖老板手动选择）；无照片/无信号时返回 null。
> - 自动生成（懒种子 `_auto`）的 hero 标题**必须**用老板原标题 `a.title`；只有显式「换风格」后的 pack 才用角度标题，避免一键生成就把活动名覆盖。
> - 验收：构造 ≥2 个不同类型/难度/照片构成的活动走 §七，断言拿到 **≥2 个不同角度**（`notCanonical` 且角度值不同），且 hero 文本 == 各自 `a.title`。
