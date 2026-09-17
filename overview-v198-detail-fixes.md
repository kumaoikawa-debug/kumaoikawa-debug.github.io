# ClubOS v198 · 活动详情页三处真修复

发布日期：2026-09-17　线上版本：**v198**　回归：**34 个 epilogue 全绿**（新增 `case-v198-itin-regen-cover.epilogue.js` 35 项）

---

## 老板反馈（原文）

1. 「活动详情页内多次出现详细行程，一直大重复，没有实现智能编辑」
2. 「假智能假AI，点换一种排版，详情根本没有变化（这里已经要求改无数次了浪费我的 token 还是没有改到满意）」
3. 「随机选图做封面，照片不能自动适配到最佳，两边出现黑屏」

---

## 一、行程只出现一次（原「详细行程」区块同屏两遍）

### 根因（不是「文案太长」，是双份渲染 + 角色误判）
| 层 | 问题 |
|---|---|
| 渲染 | 「详细行程」区块 = `itinContentHtml`（叙事块）**+** DAY 时间轴。`buildItineraryNarrative` 把途中每一项的「时间 + 事实」用「；」串成一整段 —— 等于把时间表原件复述一遍 |
| 分类 | `ITIN_ROLE_RULES` 里 `closing` 排在 `arrival` 之后 → 「17:30 **抵达**天府广场，活动**结束**」先命中 arrival，被塞进途中串讲**又**出现在收尾段（乱序 + 双重出现） |
| 范围 | `renderActivityEditorial`（图文长页）与 `renderActivityPhone`（简洁页）两处都是同样结构 |

### 修复
- **阅读页（editorial + lean）摘除叙事复述块**：完整行程只留 DAY 时间轴一处（`tl-item`），`itin-narrative` 出现次数 = 0。
- **叙事重写为「节奏摘要」**（保留在后台行程编辑面板作预览）：
  - 集合出发 1 句 + 最多 3 个关键节点（按真实时间表顺序、按时段聚合为「上午/中午/下午/傍晚」）+ 收尾 1 句；
  - **中间时间点不再出现在叙事里**（10:00 / 10:30 / 12:00 / 15:00 只属于 DAY 卡）；
  - 收尾取**最后一个** closing（15:00 下撤返回与 17:30 抵达解散同属 closing 时，锚点取 17:30）。
- **角色分类**：`closing` 提前到 `arrival` 之前，并补「下撤 / 简餐 / 路餐」关键词。

### 效果对照
改前（同一区块内出现两次行程）：
> 07:30，天府广场集合。这一程从这里开始… 10:00 抵达起点…；**17:30 抵达天府广场，活动结束**；10:30 开始山脊徒步探索；12:00 适中简餐…（青城后山），是整段行程最值得沉浸的部分。
> 07:30 天府广场集合 / 08:00 出发前往青城后山 / 10:00 抵达起点 / 10:30 开始山脊徒步 / 12:00 简餐 / 15:00 完成徒步 / 17:30 抵达天府广场，活动结束

改后：
> **详细行程**（DAY 1 · 一日山脊线）07:30 天府广场集合 → 08:00 出发 → 10:00 抵达起点…→ 17:30 抵达天府广场，活动结束

---

## 二、「换一种排版」= 真变化（版式轴不再冻结）

### 根因
`regenStyleContent` 只旋转**风格轴**（angle / density / family），`variant` 里刻意沿用 `curLayout` ——
按钮写着「换一种排版」，但老板感知的排版（hero 形态 / 章节结构 / 图片组合 / 字体）**完全没动**，只换了文案角度 → 判为「假 AI」。

### 修复
`regenStyleContent` 改为**双轴一起旋转**：
```js
const nextLayout = pickEditorialLayout(curLayout.id);
a.editorialStyleId  = next.id;
a.editorialLayoutId = nextLayout.id;   // ★ 新增：版式轴推进
const variant = { angle: next.angle, structure: nextLayout.structure, img: nextLayout.img,
                  density: next.density, layout: nextLayout.id, style: next.id,
                  typo: nextLayout.typo, family: next.family };
```
- 摘要标签（`editorialVariantSummary`）随双轴同步更新，老板点一次就能看到「大图Hero·叙事序｜看风景·杂志型」→「大图Hero·行程序｜挑战·纪实型」→「大图Hero·体验序｜陪伴·画册型」。
- **事实层依旧冻结**：事实指纹 + DNA 指纹跨连点**逐字节不变**（契约断言 B2d）。

---

## 三、封面按视觉分析自动选最佳 + hero 不再黑边

### 根因
| 现象 | 根因 |
|---|---|
| 「随机选图做封面」 | `bestCoverIndex()` 只在**上传回调**里算一次 —— 那一刻 `analyzeImageFocus` 还没跑完（`photoMeta` 全为 null）→ 恒返回 0；之后分析落地**再不重算** → 封面永远是第 0 张 |
| 「两边出现黑屏」 | 竖图/高风险封面走 `.xh-ed-hero.keep`（`background-size: contain`，不横裁主体），两侧垫的模糊底图 `opacity: .55`、垫在 `#17140f` 深色底上 → 深色照片两侧近乎纯黑 |

### 修复
- `bestCoverIndex`：`recommended_use` 含 `cover` 与 `hero` 同权加分（+35），横构图 +18，**高风险裁切 −30 / 中风险 −10**（主体靠边或竖图人物不该做满幅 hero）。
- 新增 `recomputeAutoCover(src)`，挂在两处视觉分析结果写回点：`applyVision`（真实模型）与 `scheduleSmartFocus` 的 `analyzeImageFocus().then()`（启发式）—— **分析一落地就自愈封面**；`_coverManual` 为 true（老板手动设过封面）时永不覆盖。
- 渲染层自愈：详情页非手动封面时按 `bestCoverIndex` 实时取封面，不依赖历史 `coverIndex`。
- `styles.css`：`.xh-ed-hero-backdrop` `opacity: .55 → .92` + `brightness(1.12) saturate(1.05)`；`.keep` 底 `#17140f → #2a2620`。

---

## 验收

| 项 | 结果 |
|---|---|
| 新增契约 `case-v198-itin-regen-cover.epilogue.js` | **35/35 PASS** |
| `p0-5.epilogue.js`（旧契约「两种表达并存」已在 v198 改写为阅读页时间轴唯一 + 叙事摘要化） | PASS |
| 全量 epilogue 回归 | **34/34 PASS，0 failing** |
| 线上核验 | `version.json = {"ver":198}`，10 个文件（5 源 js + styles.css + version.json + 3 HTML）本地/线上 **MD5 全一致** |
| 样例页 | `v198-sample.html`（真实渲染，封面索引=1、叙事块=0、时间轴 7 条、三次点击摘要互不相同）、`v198-compare.html`（老板反馈截图 vs 修复后） |

注：样例页/对比页内嵌 base64 截图，按项目惯例**不进 git**（`.gitignore` 已加 `v*-sample.html` / `v*-compare.html`），生成器 `gen-v198-showcase.js` 已入库。

---

## 本轮踩坑（已写进 memory / SKILL）

1. **Edit 工具两次「报成功未落盘」**：`buildItineraryNarrative` 的 closing-last 与测试用例的 `crop_risk` 种子都是假成功，导致连跑两轮仍红 → 改码一律用 Python `re.sub` + `count()==1` 锚点校验 + 改后立刻复核。
2. **契约测试异步回写竞态**：前序渲染触发 `scheduleSmartFocus` → `analyzeImageFocus().then()` 在后续 tick 用启发式 meta 覆盖同 URL 种子 → 后段断言假红。**各 § 用独立图片 URL 前缀**隔离。
3. **指纹基准时机**：渲染层会惰性补齐 canonical 字段，指纹基准必须取在**首次渲染之后**，否则把补字段算到 regen 头上。
