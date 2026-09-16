# v190 —— 老板过目卡「AI 预填」+ 图文页图片真实比例出图

发版：`d51f207` → 线上 `https://kumaoikawa-debug.github.io/admin.html?v=190`（已 curl 核验 version.json / APP_VER / 新符号，本地-线上 MD5 一致）

## 老板反馈的两个问题

| 截图 | 抱怨 | 真实根因 |
|---|---|---|
| 确认卡 | 「为什么还要让俱乐部老板手动确认这么多东西？」 | 6 个缺口全是**空输入框** + 标题「还差 5 项关键事实」+ 按钮「补全并生成」——打字量没降下来，体感仍是「要我自己填」 |
| 活动详情 | 「图片处理能力这么差，还出现这种」 | 图片容器固定高 280px + `object-fit: contain` → 竖图左右各露出一大片米色背景；**根因是容器宽高比 ≠ 图片宽高比** |

## 一、过目卡：能推断的绝不让老板打字

新增事实建议引擎 `FACT_SUGGEST`（publish.js），来源优先级：

`本次一句话已解析 → 俱乐部历史活动同类型众数 → 品牌资料 → 活动常规默认`

| 事实 | 建议来源示例 |
|---|---|
| 集合地点 | 历史活动众数「成都·太平园地铁站 A 口」 |
| 集合时间 | 08:00（长线自动 07:00） |
| 活动价格 | 历史均价 80/100 → **¥90** |
| 费用包含 | 复用历史配置「专业领队、户外保险」 |
| 活动日期 | 从「这周六」解析 → 9月19日 |
| 联系方式 | 品牌资料里的手机号 |
| 具体路线 | 系统无法替你决定 → 给**历史路线候选 chips** 一键点选 |

- 每项都**预填进输入框**并标注真实来源（蓝色标签 `AI 建议 · 按你的历史活动`）。
- 标题改为「**AI 已替你填好 5 项，还剩 1 项点一下候选就行**」，按钮统一为「一键生成图文详情页」。
- `confirmFactsToPage()` 前置 `applyAllSuggestions(fa, true)`：老板**一个字都不改**也能生成完整活动。

真机实测：6 项缺口 → 5 项已预填、仅「具体路线」待选（附历史候选）。

## 二、图片：容器比例 = 图片真实比例

- `buildPhotoMeta()` 现在把真实 `ratio = naturalWidth / naturalHeight` 存进图片元数据。
- `figAspect()` 输出 `--ar`，`xhFig()` 渲染 `<figure class="xh-ed-fig s-tall" style="--ar:0.75" data-ar-auto>`，CSS 用 `aspect-ratio: var(--ar, 4/3)` 驱动，**删掉全部固定 `height:280/190/150px`**。
- **contain 的放行条件改为「容器比例 == 图片真实比例」**：此条件下 contain 与 cover 视觉等价（不裁、不留白），P0-11「不裁坏人物」的需求依然保住；比例未知、或极端长图比例被 clamp（收敛到 `[0.62, 2.6]`）时一律退回 cover。
- 像素分析是异步的：首屏用中性比例 1.36，分析完成后由 `updateSmartFocus()` 回填精确 `--ar`（并同步 `s-tall/s-wide/s-square`，同时移除旧类）。

真机实测（本地 8899 + agent-browser）：

```
横图 1600x1067 → --ar:1.5  fit:cover  img 156x104  (比例 1.50 ✔)
竖图  900x1200 → --ar:0.75 fit:cover  img 319x425  (比例 0.75 ✔)
img.width == figure.width → 零留白（截图确认）
```

## 三、验收

- 新增 `case-v190-suggest-and-photo.epilogue.js`：**31 项**，含一条**反向验证**（把图片比例从缓存抽掉后 `figAspect` 必须从 0.667 退化为 1.36，证明断言真的在读数据）+ 两条 contain 边界断言（真实比例允许 contain / 比例被收敛时禁止 contain）。
- 全量 **28 个 epilogue 全绿**（含 §七 一键闭环 42 项、§六 各 Case）。

## 四、备份

`versions/publish-v189.js`、`versions/shell-v189.js`、`versions/activities-v189.js`、`versions/styles-v189.css`（从 git `HEAD` 导出）。
