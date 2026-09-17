# ClubOS v200 · 「任选一张图做封面 → 详情页虚化」修复说明

> 老板反馈原文：**「视觉管理里面 任选一个图做封面，然后详情这边出现虚化 bug」**（附截图：视觉管理里已选「当前封面·图 4」为一张人像竖图；右侧详情页 Hero 整幅糊成一片）。

---

## 一、根因：不是滤镜参数，是**层序**

Hero 的结构一直是这样的（`src/activities.js`）：

```html
<header class="xh-ed-hero keep" style="background-image:url(封面图)">   <!-- ← 照片画在 header 自身背景上 -->
  <div class="xh-ed-hero-backdrop" style="background-image:url(封面图)"></div>  <!-- 同图 + blur(26px) -->
  <div class="xh-ed-hero-mask"></div>
  <div class="xh-ed-hero-txt">…标题…</div>
</header>
```

CSS 渲染顺序里，**绝对定位的子元素永远绘制在父元素自身背景之上**。
所以那层「用来填两侧留白的模糊垫图」其实覆盖的是**整幅 Hero**，而不是只有两侧：

| 版本 | `.xh-ed-hero-backdrop` opacity | 客户实际看到 |
|---|---|---|
| v197 及以前 | .55 | 半糊（还能隐约看到照片，但已发灰） |
| **v198**（为修「两侧黑屏」而提亮） | **.92 + brightness(1.12)** | **照片几乎完全被糊图盖住 = 整幅虚化** |

而 keep 模式的判定条件（`cropPolicyOf` 判 high 裁切风险 / `mode=aspect_preserved` / `realAspect < 0.95`）恰好会被**「人像竖图做封面」**命中 —— 老板一选人像图当封面，就必然踩中。

**一句话：v198 把垫图提亮到 .92，把「垫图盖住照片」这个一直存在的层序错误放大成了显性 bug。**

---

## 二、改法：照片独立成层，压在垫图**之上**

### `src/activities.js`

```js
const heroBackdrop = coverKeep && coverSrc ? `<div class="xh-ed-hero-backdrop" …></div>` : "";
// v200：照片本体独立图层 —— 几何内联，抗 styles.css 缓存
const heroFig = coverKeep && coverSrc
  ? `<div class="xh-ed-hero-fig" style="position:absolute;inset:0;z-index:1;background-image:url('${coverSrc}');
       background-size:contain;background-repeat:no-repeat;background-position:center"></div>`
  : "";
const heroStyleAttr = coverKeep
  ? `style="background-image:none"`     // keep：header 自身不再画一层「永远看不见」的图
  : (coverSrc ? `style="background-image:url('${coverSrc}')"` : `style="background:${ac.grad}"`);
```

- **keep 模式**：照片走 `.xh-ed-hero-fig`（contain、原比例、不裁主体，承 P0-B），header 不再承载照片。
- **cover 模式（横图低风险）**：行为**完全不变**（仍由 header 承载照片、不引入任何垫图层）。

### `styles.css`

```css
.xh-ed-hero.keep { overflow: hidden; … }            /* 收掉垫图 inset:-24px 的外溢（不再糊到上方导航条） */
.xh-ed-hero-backdrop { … z-index: 0; }              /* 同图模糊延展，填原比例留白 */
.xh-ed-hero-fig { position:absolute; inset:0; background-size:contain; background-repeat:no-repeat; background-position:center; z-index:1; }
.xh-ed-hero.keep .xh-ed-hero-mask { z-index: 2; }   /* 面具在照片之上，文字仍可读 */
.xh-ed-hero.keep .xh-ed-hero-txt  { z-index: 3; }
```

**层序固定为：`backdrop(0) → fig(1) → mask(2) → txt(3)`。**

---

## 三、验收证据

### 1. 契约测试 `case-v200-hero-keep-layer.epilogue.js`（20 项全绿）

关键断言：

- `A4` 层序：`backdrop < fig < mask`（DOM 顺序即绘制顺序，同一 stacking context）
- **`A6` 守门断言（本次回归的直接捕手）**：keep 模式 **header 开标签里不得出现 `background-image:url(`**
  —— 只要照片还被画在 header 背景上，垫图就会立刻把它盖回去
- `A5` fig 几何**内联**（`contain` + `z-index:1`）→ 即便 styles.css 被 CDN 缓存成旧版，层序也不会塌回原来的样子
- `C1–C3` cover 模式行为未变（仍由 header 承载、不引入垫图层）
- `D1–D4` **CSS 契约**：`.xh-ed-hero-fig` 存在且 `contain`+`z-index:1`、backdrop `z-index:0`、keep 的 mask=2/txt=3、`.keep` 有 `overflow:hidden`
- `E1–E3` **反向验证**：手工摘掉 fig 图层 / 还原成 v198 形态（照片画回 header 背景）后，判定函数必须变红

> 顺带为项目补上了一个能力缺口：**harness 现在把 styles.css 注入为 `__PROJ_CSS__`**（连同 `__PROJ_DIR__`）。
> v198 那次因为「epilogue 沙箱里读不到 CSS」，`z-index`/层序这类样式契约只能放弃断言；现在可以了。

### 2. 真机像素验证（Chrome，dpr=3）

专用对照页 `v200-compare.html`（只放改前 / 改后两块 Hero，坐标固定）逐行锐度（`FIND_EDGES` stddev）：

| Hero 高度 | 改前（v198 形态） | 改后（v200） | 倍数 | 区域 |
|---|---|---|---|---|
| 5% / 10% / 15% / 20% / 25% | 5.8 / 5.5 / 4.9 / 4.2 / 3.8 | 完全相同 | 1.00× | 原比例留白带 |
| **30%** | **4.8** | **27.9** | **5.80×** | 照片本体上沿 |
| 35% / 40% / 45% / 50% | 3.6 / 3.4 / 3.2 / 3.0 | 7.0 / 7.1 / 5.5 / 4.8 | 1.6–2.1× | 照片本体 |
| 55% – 95% | 57.3 / 65.1 / 66.0 / 81.3 | 完全相同 | 1.00× | 标题文字 + 渐变面具 |

**留白带与文字区逐行完全一致**（证明本次只动了层序、没碰别的东西），**照片本体锐度提升到 5.8×**。

对照图：`v200-hero-verify.png`（左：改前整幅糊；右：改后照片清晰，余下部分是提亮后的同图模糊延展）。

### 3. 全量回归

**36 个 epilogue 全绿**（35 个既有 + 新增 `case-v200`）；线上核验：`version.json = 200`，11 个文件本地/线上 MD5 全一致。

---

## 四、发版

| 项 | 内容 |
|---|---|
| commit | `db6d8a3` |
| 版本 | v199 → **v200**（`bump.py 200`，三处 APP_VER + `?v=` 全对齐） |
| 线上 | <https://kumaoikawa-debug.github.io/admin.html> |
| 产物 | `v200-sample.html`（全量样例页）、`v200-compare.html`（改前/改后专用对照页）、`v200-hero-verify.png`（像素对照图）——均**不进 git**（生成脚本 `gen-v200-showcase.js` 已入库） |

---

## 五、这次踩到的坑（已固化进技能）

1. **通用规律：任何「垫在下面的装饰层」都不能靠父元素背景承载主体内容。**
   父元素背景永远在最底层 → 垫层一提高不透明度就把主体吃掉。主体必须自己是一层（`position:absolute` + `z-index`）。
2. **真机量像素的两个陷阱**：
   - `agent-browser screenshot --full` 会把 daemon 的 viewport 改成文档尺寸并**粘住**（后续 `innerWidth` 变成 980），于是「用 `getBoundingClientRect` 推算截图坐标」会错位 → 要用**只含目标元素的专用对照页 + 固定坐标**。
   - 元素截图需先 `scrollIntoView`，且仍可能拍到空白（时序/懒加载）→ 别把它当唯一证据。
3. **PIL `FIND_EDGES` 的 stddev 会被大片文字主导**：整幅 Hero 的锐度差异只有 1.01×，因为 55%–95% 的标题文字把数据淹了。**必须只取「照片本体所在的横向带」并逐行比对**才能看出 5.8×。
4. **zsh heredoc + JS 模板字符串**：把含 `${...}` 的 JS 正文写进 `<<'PY'` heredoc 会触发 `Bad substitution`；改成「用 Write 工具写正文文件 + 小 Python 脚本拼接」最稳。
