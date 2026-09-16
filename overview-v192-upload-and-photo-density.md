# v192 发版说明 · 修「上传没反应」+ 图文详情页真正照片驱动

> 背景：老板提交 2 个问题 —— ①编辑活动页「上传不了照片」（点了没反应、缩略图区空白）；
> ②昨天（v190/v191）改了很多，详情页/活动宣传仍不是想要的「照片驱动图文长页」，
> 参考样式为 `白鹤滩秋季宣传推文_高清长图.jpg`（1080×19744）。

---

## 一、bug#1「上传不了照片」

### 根因（两层，叠加出现）

1. **抢同一个 DOM 节点**
   全站只有一个全局文件输入 `#photoInput`（在 `admin.html / front.html / index.html` 的 `<body>` 末尾）。
   编辑页 `bindEditorExtras` 与宣发中心 `bindFabuExtras` **共用这个节点**，却各自用
   `if (!inp._bound) { inp._bound = true; inp.addEventListener("change", …) }`。
   → 谁先被访问谁绑上，`_bound` 之后**恒为 true**，后到的视图再也绑不上；
   而且两个 handler 写入**不同的草稿**（编辑页写 `state.draft.photos`，宣发中心写 `publishState().photos`）。

   **真机复现**：先进「AI 宣发中心」再进「编辑活动」，上传 4 张 →
   `draftPhotos=0 / thumbs=0 / xfPhotos=15`（照片全进了宣发草稿，编辑页看着就是「没反应」）。

2. **解码失败即死等**
   `analyzeImageFocus()` 内部只有 `img.onload`，既无 `img.onerror` 也无超时。
   批量上传里只要有**一张**图解码失败，`pending` 就永远减不到 0，缩略图刷新被永久卡住。

### 修法

- 新增 `installPhotoInput(kind)`：用 **`onchange` 赋值**（覆盖而非累积）替代 `addEventListener`，
  每次渲染都按当前 `state.view` 重新决定语义（editor / fabu）。
- 新增 `readPhotoFile(file, push, done)`：`FileReader.onerror` + **8s 超时**兜底，
  保证 `done()` **恰好被调用一次**，坏图只跳过自己、不拖死整批。
- `bindCreateExtras`（一句话创建）与 `bindConfirmExtras`（确认卡）同步改用 `onchange` + `readPhotoFile`。
- 宣发面板里两处重复的 `<input type="file" id="photoInput">` 删除，统一走全局那个。

### 真机验收（真机 Chromium）

| 场景 | 结果 |
|---|---|
| 先进宣发中心 → 再进编辑页 → 上传 4 张 | `draftPhotos=4 / thumbs=4 / xfPhotos=0` ✅ |
| 3 张里混 1 张损坏图 | 3 张全部落盘、界面不卡 ✅ |

---

## 二、bug#2「详情页不是照片驱动」

### 根因（一处逻辑 + 一处配额）

1. `editorialPhotosFor()` 里顺序补图分支是 `if (!out.length) { … }` ——
   **只有语义匹配一张都没命中**时才从池子补图。于是语义命中 1 张的章节**永远只有 1 张**，
   其余照片全部闲置：实测 20 张图只渲染出 7 张。
2. `renderActivityEditorial()` 里「照片 ≥8 张才预留末尾 3 张给图廊」+ 封面已占 1 张，
   于是 8 张图只剩 4 张可分，被前两个章节（每节 2 张）吃光 → **后 6 节全无图**，整页退化成纯文字。

### 修法

新增 `planEditorialPhotoCaps(photoCount, secs, coverIdx, maxPer, galleryMax)` —— 页面级配图分配计划：

1. **每个章节至少 1 张**；
2. 余图**轮转补给**章节第二/三张（不超过该变体上限）；
3. 留 1–3 张给结尾「现场影像」图廊（p0-4 长图文契约）；
4. 章节容量已满时分不出去的**并入图廊，不浪费**用户上传的照片。

`editorialPhotosFor(a, sec, usedSet, cap)` 增加 `cap` 参数，并改为「语义不足 → **一律补齐到该节预算**」。

**未改动** `sec.imgCount` / `sec.imgKind` → P0-12「不同变体图片结构不同」的语义完全保留
（`cap` 只作用于取图数量，不写回 outline）。

配套 CSS：单图章节与结尾影像**通栏出血**（去掉两侧 16px 内边距与圆角），
只改宽度、不动 `--ar` / `object-fit`，故 v190「容器比例 == 图片真实比例」约定不受影响。

### 真机量化（真机 Chromium · 10 张实拍占位图 · 手机列 351×8208）

| 指标 | v191 | v192 |
|---|---|---|
| 正文章节有图比例 | 2 / 8 | **7 / 7** |
| 单节图占比 | 0–69%（8 节里 6 节为 0） | 35%–73%（无 0） |
| 照片带占全页高度 | 36.4%（集中在头两节） | **37.1%（均匀铺开）** |
| 20 张图的 `<img>` 数 | 12 | **18** |
| 页面非纸面像素占比 | 42.2% | 44.1% |

> 说明：ClubOS 用松赞风**米白底**（品牌既定），与参考长图的彩色底不同——
> 本次对齐的是「**照片驱动**」（每节有图、图铺开、图当主视觉），而非照搬别家的底色。

---

## 三、验收

- 新增 `case-v192-photo-density.epilogue.js`（14 项），含反面护栏：
  「变体上限不被突破」「正文配图不重复」「`sec.imgCount` 未被改写」「图少于章节时不强占图廊」。
- **全量 30 / 30 个 epilogue 通过**（其中 p0-4 继续保证「结尾现场影像」契约不丢）。
- 改后 `U+FFFD = 0`（publish.js / shell.js / activities.js / styles.css）。

## 四、遗留 / 下一步

- 报名决策区（速览 / 费用 / 详细行程 / 装备 / 适合）约占全页 27%，天然以文字为主。
  若要让这一区也更「图文化」，建议下一步做「**公众号/详情页长图导出**」（当前无导出能力，
  无 html2canvas），把详情页按 1080 宽渲染成一张可发的长图，更贴近参考样式。
- 后端（`clubLLMviaBackend` / `ai-vision`）仍未部署，前端走演示直连回退。
