# v186：§六验收 Case 1 / 2 / 10 从「只检测」升级为「真生效」

上一版 v185 修完 Case 4/7/9 后，遗留三项为 **detect-not-block**（有信号、有检测，但不驱动输出）。
本版把这三项接进决策链路，让「识别到的照片特征」真正改变页面。

改动规模：`src/publish.js` +292 行、`src/activities.js` 1 行、`styles.css` +6 行。

---

## Case 1｜秋季徒步 15 张横向秋景 → 大图 / 风景 / 暖感 / 杂志结构

**缺口**：照片层没有「色温」这一维，暖感只存在于文案的口头描述，不驱动排版。

**改动**
1. 照片识别层（`analyzePhoto` 输出 schema）新增暖/冷信号：
   `warmthRatio`（暖色占比）、`warmthLabel`（暖调 / 中性 / 冷调）、`nightRatio`，随 `photoProfile` 向上传递。
2. 新增 `photoContentProfile(photos)`：聚合出 `warmth / warmthRatio / warmthLabel / warmLed / nightRatio`，并入方向决策输入。
3. `heuristicDirection` 消费暖感信号：
   - `color` → 暖轴色（秋日暖褐 / 山系橙），冷调素材不套暖
   - `typographic` → 衬线大标题，`readingMood` → 暖调回看
   - 新增 `photoLed.warmth` 字段，保留「这条方向有照片依据」的可追溯性
4. 新增 `autoEditorialPick(a, profile)`：暖调 + 横图为主时自动落到 **大图 + 杂志** 轴
   （`L-mosaic-story` / `S-season-mag`），无需人工选版式。
5. `styleAccent`（activities.js 消费 + styles.css 新增 `.warm` 色调类）→ 页面强调色整体转暖。

**验收（7 项）**：暖调识别、画像并入 photoProfile、describePhotoProfile 带暖感、方向转暖、
含 photoLed 依据、版式自动选大图+杂志轴、强调色转暖；另加**反向断言**——冷调素材不套暖感
（label=冷调、无色温改写、无暖 accent）。

---

## Case 2｜同活动换 15 张人物互动 → 页面转人物 / 体验主导

**缺口**：`heuristicDirection` 完全不读 `photoProfile`，换图不换方向，页面永远走风景线。

**改动**
1. 新增 `photoDominance(photos)`：按人物占比判定 `personLed`（人物主导）。
2. `heuristicDirection` 在 `personLed` 时切换整条决策：
   - `angle` / `hook` → 人物视角（与风景版明显不同）
   - `visualFocus` → 网格画廊 + 人物推进
   - `structure` → 同家族内按主体（人物 / 风景）分出两套章节
3. `autoEditorialPick` 人物主导时切到人物/体验轴（`L-strip-exp` / `S-social-conv`）。
4. 亲子竖图子类：自动选「陪伴画册」分支（不横裁孩子）。

**事实不变性**：验收中断言「换图不改事实」——除照片数外 `confirmedFacts` 完全一致；
且人物版每个新标题都产出非空 fallback 正文（结构变了、事实没丢）。

**验收（8 项）**：占比较高→人物主导、角度/钩子转人物、版式组合转人物轴、章节结构变化、
页面版式自动切换、标题均非空正文、事实一致性、亲子竖图走陪伴画册。

---

## Case 10｜回顾只有现场照片 → 不得虚构用户反馈与具体事件

**缺口**：`qualityCheck` 只有「检测」（列出问题），不阻断；且 `genRecap` 末次质检
**漏传 `actual`**，导致用户已确认的反馈也被误删（真实缺陷，本版一并修复）。

**改动**
1. 「用户反馈」类虚构词表收紧（`有人说` / `大家一致` / `好评一片` 等 → 必须有 `actualFeedback` 才放行）。
2. 新增 `recapHasActualEvidence(m, actual)`：判定是否存在真实来源（补充资料 / actual），
   **照片不算事件来源**（只有现场照片 = 无事件来源）。
3. 新增 `stripFabricatedRecapEvents(copy, m, actual)`：无来源时**主动删除**虚构的
   - 具体现场环节（热身 / 一起沿着溪谷前行 之类）
   - 参与者反应（意犹未尽 / 玩得特别开心 之类）
   并保留合规内容（照片现场记录、下一期预告）——**不误删**。
4. 修复 `genRecap` 末次 `qualityCheck` 漏传 `actual` 的真实缺陷（导致确认过的反馈被误删）。
5. 兜底版回顾在无来源时即输出「照片现场记录」体（以现场照片为准），不编事件。
6. 闸门状态挂到质量状态 `fabricationGuard`（空 = 无需阻断）。

**验收（12 项）**：含反向用例——有补充资料时闸门不干预（removed 为空、原文保留）；
以及 `withActual=true / withoutActual=false` 对照，证明末次质检必须带 `actual`。

---

## 回归与发版

- 新增 `case-1-2-10.epilogue.js`：**27/27 全绿**
- 全量回归：**26 个 epilogue 文件全绿**（v185 的 25 + 本版 Case 1/2/10）
- 备份：`versions/publish-precase1210-v185.js`（`versions/` 被 gitignore，仅本地留存）
- 版本：`bump.py 186` → version.json / index / admin / front 三入口 `APP_VER` + `?v=` 同步；
  `platform/` 独立序列不动。

**仍未覆盖**：夜晚识别在「无显式标注 + 无真实视觉模型」时仍依赖亮度启发式，可能漏判；
暖/人物判定同属启发式，真实视觉模型接入后准确率会显著提升。
