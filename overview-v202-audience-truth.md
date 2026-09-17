# v202 · 参与人群单一真源（「适合谁」里老板填的人群从不出现）

> 本轮不是老板报的 bug，而是 **v201 收尾后自审发现的自己写的问题**：
> v201 那句「只要活动填了参与人群，就在『适合谁』里显式补一句」**从来没有触发过**。

## 一、怎么找到的：野字段审计

v201 在 `publish.js` 里加了一段读 `a.targetAudience` 的代码。收尾时顺手做了一次全量审计：

1. 抓出 `publish.js` 里所有 `a.<字段>` 的读取；
2. 与 `blankActivity()` 声明的字段做差集 → 32 个「读到了但没声明」的字段；
3. 对每个候选查**双信号**：「编辑器有没有 `data-bind="X"` 输入框」「有没有写入点」。

结论：32 个里绝大多数是运行期动态字段（`factConfirmed`/`pipeline`/`contentStrategy`/`forewordTitles`… 由 AI 回填或迁移块写），只有 **`targetAudience` 一个**是「读者有、写者无」：

| | |
|---|---|
| `a.targetAudience` | **野键**：全仓 `0` 个写入点、编辑器 `0` 个 `data-bind`；只有 `buildContentMaster()` 的**内部对象**才有这个键（值来自 `targetUser(a)`） |
| `a.audience` | **老板唯一能填的字段**：`activities.js` 的「参与人群」input，`data-bind="audience"`，存**数组**（顿号分隔） |

于是两处读它必然拿到空串：

- `editorialFacts().audience` —— 模板占位符 `{audience}` 的数据源；
- v201 新加的「适合谁补一句」—— **这句从未触发过**（代码注释却写着「只要活动填了目标人群就补」）。

## 二、修法

### 1. 单一真源

`publish.js` 新增 `activityAudienceText(a)`：

- `a.audience` 数组 → 顿号串（过滤空值/空白）；
- 兼容旧数据里的字符串形态（`、`/`,`/`/` 都拆）；
- 都没有 → 空串（**绝不回落「通用」这类占位词**）；
- 最后才兜底 legacy 的 `a.targetAudience`（不破坏老对象）。

两处读取（`editorialFacts` + 「适合谁」）全部改走它；`checkRequiredModules` 登记。

### 2. ★第二个坑：内容包会把你的入参整段顶掉

只改字段读取后跑测试，**那一句依旧不出现**。真正原因在 `buildEditorialOutline`：

```
pkPick(key, v, f) = (pk.paras[key] 有内容) ? pk.paras[key].slice() : pick(v, f)
```

`editorialStylePackOf(a)` 会**懒种子**一个内容包（`_auto=true`，`pk.paras.fit` 是角度化文案），
只要包在，「适合谁」的正文就来自包 —— v201 把补充句塞进 `fitLines`（`pkPick` 的入参）**等于交给包去覆盖**。

修法：

- `make()` 改为**返回章节对象**（被密度裁掉则返回 `null`）；
- 补充句追加在 **`make()` 返回的 `fitSec.paras`** 上，并用 `indexOf(audTxt)` 去重。

```js
const fitSec = make("fit", "fit", "people", "适合谁", pkPick("fit", a.fitFor, fb.fitFor || ""));
const audTxt = activityAudienceText(a);
if (audTxt && fitSec && fitSec.paras.join("\n").indexOf(audTxt) < 0) fitSec.paras.push(audTxt + "，都能找到自己的步频。");
```

> 通用规律：**想在「由内容包驱动的章节」里补东西，必须改章节定稿后的对象，不能改喂给 `pkPick` 的入参。**

## 三、验收

`case-v202-audience-truth.epilogue.js`（**21 项全绿**）

| 组 | 覆盖 |
|---|---|
| §A | 真源函数：数组/旧字符串/空值过滤/空数组/无字段/legacy 兜底/不取占位词 |
| §B | `editorialFacts().audience` 正向读到、未填仍空 |
| §C | 图文长页「适合谁」：**正向**出现人群原文与补充句；**反向**换人群值应跟着变、不填则不出现；**去重**（已含则不追加）、**不重复**（全页只出现一次） |
| §D | 不误伤：编辑器 `data-bind="audience"` 仍在、事实层人群表达与其它事实字段逐项不变 |
| §E | 编辑器/长页/简洁页/宣发中心/列表 渲染冒烟 + `checkRequiredModules()` 为空 |

**反向验证**：把 `versions/publish-pre-v202.js` 换回 `src/publish.js` 再跑 → **12 项变红**
（A1–A6 / B1 / C1a / C1b / C3a / C4b / E2），改回后 MD5 完全一致。

全量回归 **38 个 epilogue 全绿**。

## 四、线上

- `bump.py 202` → commit `4cdabcb` → push `origin main`
- 线上 `version.json` = `{"ver": 202}`
- 11 个文件 MD5 **全部一致**（version.json / admin / front / index / styles.css / core / publish / boot / activities / shell / front）

## 五、踩坑与约定

- ★**野字段判定要双信号**，只看「不在 `blankActivity` 里」会得 32 个假阳性（动态字段会被误判成缺陷）。
- ★**内容包优先路径**：`pkPick` 的入参只是「没包时的兜底」，补内容要落在章节对象上。
- ★**测试断言挂在稳定返回物上**：`make()` 返回值比「渲染后 HTML 里的长字符串」可靠（不受图片、密度、闸门影响）。
- 参与人群请写字词人群（亲子/成人/团建），年龄填「适合年龄」字段 —— 文学层闸门会把带数字的人群文案当年龄参数处理。
