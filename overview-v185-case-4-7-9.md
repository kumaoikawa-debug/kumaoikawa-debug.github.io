# v185 · §六 最终验收修复：Case 4 / 7 / 9

上一轮（v184）完成 §五 状态结构对齐后，对 §六 10 个最终验收案例做了代码级能力映射，
判定 PASS=4、PARTIAL=5、GAP=1，并定位出 5 个真实缺口。本版按选项 B 一次性修掉其中
最具代表性的三项：Case 9（结构随风格变）、Case 7（安全/装备权重）、Case 4（昼夜节奏）。

## 修改清单（src/publish.js）

### 1. Case 9｜结构随「编辑家族」明显不同
`heuristicDirection(a, p, family, scenario, photoProfile)`

- **问题**：`structure` 只按 `scenario`（招募/回顾）给一套固定章节，换家族/风格时
  章节结构完全不变，违反「换风格三次，图文结构应明显不同」。
- **改法**：新增 `structRecruitByFamily` / `structRecapByFamily` 两张表，
  6 个编辑家族各自一套章节结构；未知家族回退旧结构。
- **关键约束**：每个新标题都内嵌 legacy 触发词（值得/体验/行程/收获/适合/报名），
  保证 `sectionBody` 仍能路由到正确的正文桶，不出现空段。
- **不变**：事实来源仍是 `confirmedFacts` —— 变的只是章节切分与表达，不新增任何事实。

### 2. Case 7｜强度 / 海拔 / 装备 / 安全 权重提高
`generateSectionCopy(h, m, a, seed)` + `sectionBody(h, a, m)`

- **问题**：段落文案只消费 `confirmedFacts`，不做风险分级；雪山与亲子活动用同一套
  松弛口吻，专业信息权重不足。
- **改法**：
  - 由 Activity DNA 判定「专业/高强度」活动（`intensity=challenge` /
    `activityForm=mountain` / `elevation>=2500` / `professionalLevel=technical`）。
  - 命中时，体验段优先输出海拔、装备底线、经验与状态确认的专业表达。
  - 新增「强度 / 海拔 / 装备 / 安全 / 准备 / 风险 / 硬指标」分支，
    一次性汇总硬指标（强度 + 海拔 + 必备装备 + 保险 + 安全事项）。
  - `sectionBody` 行程段补上已填写的保险 / 安全事实。
- **不变**：只搬运已确认事实，缺项就少写，绝不编造保险、救援、安全保障。

### 3. Case 4｜白天→夜晚 情绪节奏
新增 `photoDayNight(photos)` + `buildEditorialOutline` 注入 + `editorialPhotosFor` 取图

- **问题**：夜晚素材只体现在图片分类（scene=night），长页章节按 kind 排序，
  不会形成任何时间线节奏；露营的昼→夜情绪弧完全缺失。
- **改法**：
  - `photoDayNight(photos)` 同步判定每张图属于白天还是夜晚。
    信号优先级：照片显式 `isNight` / `analysis.isNight` > 内容识别 `scene=night` / 标签含「夜景」。
  - `buildEditorialOutline` 在「白天 + 夜晚素材齐备」时注入 `kind=night` 的「入夜」章节。
  - `EDITORIAL_STRUCTURES` 五种排序中，`night` 一律排在 `route` 之后、`gain` 之前，
    长页自然呈现 白天 → 夜晚 → 收获 的情绪弧。
  - `editorialPhotosFor` 遇到 `kind=night` 时优先取夜晚素材，节奏在配图层同样成立。
  - 纯白天素材不会凭空生成「入夜」章节（不臆造未发生的夜晚）。
- **导出**：`CLUBOS_PIPELINE.photoDayNight`、`buildEditorialOutline`、`heuristicDirection`。

## 验收结果

新增 `case-4-7-9.epilogue.js`（12 项断言，确定性夹具，不依赖 AI Key 与视觉模型）：

| Case | 断言 | 结果 |
|---|---|---|
| 9 | 三个家族产出结构互不相同 | ✓ 6/5/5 节，两两不同 |
| 9 | 每家族结构 ≥4 节且标题非空 | ✓ |
| 9 | 每个新标题都能产出非空 fallback 正文 | ✓ 无空段 |
| 7 | 高强度体验段显性给出海拔 4500 米 | ✓ |
| 7 | 高强度体验段给出装备底线（冰爪/安全带/头盔） | ✓ |
| 7 | 强度/安全段汇总硬指标（海拔+装备+保险） | ✓ |
| 7 | 低强度活动不被套用高强度话术 | ✓ |
| 4 | 正确区分白天 6 张 / 夜晚 4 张 | ✓ hasRhythm=true |
| 4 | 长页自动注入「入夜」章节 | ✓ why,experience,day1,day2,night,gain,fit |
| 4 | 夜章节排在白天行程之后、收获之前 | ✓ route=2 night=4 gain=5 |
| 4 | 纯白天素材不生成「入夜」章节 | ✓ |
| 4 | 夜章节配图取自夜晚素材 | ✓ picked=[6,7] ⊂ night=[6,7,8,9] |

回归：原有 23 个 epilogue + `case-1-2-3-5-6-photo.epilogue.js`（Case 1/2/3/5/6 图片层 19 项）
+ 本版 12 项，共 **25 个回归文件全绿**，无回退。

## 发版

- `bump.py 185`：version.json=185，index/admin/front 三入口 `APP_VER=185` 与 `?v=` 同步。
- `platform/` 为独立版本序列（APP_VER=85），本次未改动，保持不动。
- 备份：`versions/publish-precase974-v184.js`（改动前快照）。

## 仍未覆盖（下一轮可选）

- Case 4 的夜晚识别依赖真实视觉模型时最准；当前优先读照片显式 `isNight`，
  无标注时回退内容识别（亮度/标签），无标注且无真实分析时可能识别不到夜晚。
- Case 2 / Case 1 / Case 10 的「暖感 / 人物主导 / 不虚构反馈」仍属
  detect-not-block（有检测、无强制阻断），需在文案生成后做事实校验拦截。
