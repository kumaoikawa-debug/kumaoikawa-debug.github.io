# v199 · 会员价 / 积分抵现 / 优惠券真正落地

> 老板反馈原文：「会员价格这一套营销包括积分、这些都没有实现。」
> 结论：UI 开关在、底层字段在，**但成交链路一个都没接**。本版把三者收敛成一套可计算的引擎并在全链路接通。

---

## 一、实测根因（改前逐条取证）

用诊断 epilogue 在真实 `loadState()` 上取数，硬证据如下：

| 反馈点 | 实测现象 | 根因 |
| --- | --- | --- |
| 会员价 | `formatMemberPriceNote()` 输出 **「普通会员价 ¥180」**，与基础价完全相同 | ① 会员价只作用于 `a.price` 基础价，**不参与团期价**；② 档位价若等于基础价，页面照样打「会员价」标签 → 客户眼里「什么都没变」 |
| 积分抵现 | `state.points = 0` 恒定，无账户、无余额来源、无流水 | 积分只有**一个数字字段**：没有任何地方发放，也没有任何地方能抵扣；等级 `pointsRate`（元/积分）**只存不用** |
| 优惠券 | 后台能建、首页能领，`coupons` 有 3 张 | 报名流程**完全不读券**；且现有 3 张券门槛（满 200 / 装备专用 / 满 300）对 ¥180 的活动**一张都用不上** → 点开就是「没有可用券」 |
| 展示面 | 图文长页 `edHasMemNote: false` | 决策速览「价格」行、底部报名栏、底部 CTA、图文长页费用区 —— 全部硬写 `a.price` → **会员价只在简洁页露了个头** |

---

## 二、改动总览

### 1. 新增会员营销引擎（`core.js`）

新增一段独立引擎（挂在既有会员价工具区之后），是**详情页 / C 端 / 报名结算的唯一价格真源**：

- **价格**：`priceBaseOf(a, dep)`（团期价 > 活动基础价）、`effectiveUnitPrice(a, dep, tier)`（档位价 > 折扣 > 基础价）、`memberBenefitOf(a, dep)`、`memberBestPriceOf(a, dep)`、`priceDisplayHtml(a, dep, opts)`、`memberPriceNoteText()`
- **积分账户**：`memberPointsBalance()`（单一真源 = `state.points`）、`pointsToYuan()` / `yuanToPoints()` / `pointsRateOf()` / `pointsPerYuanOf()`、`pointsLedgerOf()` / `pushPointsLedger()`、`grantMemberPoints()` / `redeemMemberPoints()`
- **优惠券**：`couponUsableFor(cp, amount, a)`、`couponDiscountOf(cp, amount)`、`usableCouponsFor(a, amount)`、`couponTitleOf(cp)`
- **统一结算**：`orderBreakdown(a, opts)` —— **会员价 → 优惠券 → 积分抵现 → 应付 → 赠分** 的唯一定价入口
- **详情页补充行**：`memberMarketingExtrasHtml(a, amount)`
- **规则配置**：`defaultMemberMarketing()` / `memberMarketingCfg()`

> ⚠️ 关键工程细节：默认规则用**函数声明** `defaultMemberMarketing()` 而非 `const` 常量 ——
> `seedState()` 定义在文件前部且被提前调用，而 `const` 存在 TDZ，声明在后面的常量在 `seedState` 执行时读不到。

### 2. 防「假优惠」（本版最重要的语义修正）

`memberBenefitOf().hasBenefit` **只在会员价真的低于原价时为 true**；
`priceDisplayHtml()` 无真优惠时**绝不输出** `pp-mem` / 划线 / 「会员价」字样。

旧代码「档位价 ≠ 基础价就标会员价」正是老板看到「普通会员价 ¥180」的观感来源 —— 数字没变，却贴了会员标签。

### 3. 会员价接入全部价格展示点

| 位置 | 文件 | 改法 |
| --- | --- | --- |
| 图文长页费用说明 | `activities.js` | 新增 `fee-mem-row`（等级标签 + 会员价 + 原价划线 + 省额） |
| 图文长页费用区补充行 | `activities.js` | 追加 `memberMarketingExtrasHtml`（积分可抵 + 可用券） |
| 简洁页费用块 | `activities.js` | 同上两行 |
| 决策速览「价格」行 | `activities.js` | 走 `priceDisplayHtml`；该行标记 `_raw:1` 直出 HTML（其余行仍 `esc`） |
| 底部报名栏 / CTA | `activities.js` | 走 `priceDisplayHtml` |
| C 端列表卡 | `front.js` | `activityPriceHtml` / `activityPriceText` 重写，真优惠才标会员价 + 划线 |
| C 端团期选项 | `front.js` | **团期价也走会员价**（旧实现只把等级名贴上去、金额没变）+ `data-price`/`data-member-price` |
| C 端详情价格 | `front.js` | 走 `memberBenefitOf` |

### 4. 报名结算：真实抵扣与落库（`front.js` + `shell.js`）

- 新增结算区块 `#suSettle`：小计 / 会员优惠 / 券抵扣 / 积分抵扣 / **应付** / 完成后赠分
- 优惠券选择：可用的列出（含门槛说明与减额），**不可用给诚实空态**（「未达到使用门槛，或券不适用于活动报名」）
- 积分抵现开关：余额、换算比例、单笔上限、起抵线全部写明；不足起抵线时禁用并说明
- **实时刷新**：人数 / 换券 / 勾积分 → 只重刷 `#suSettle` 与按钮文案，**绝不重渲染整个表单**（否则用户填一半的姓名电话会被清空）
- `submitSignup` 落库结算快照：`unitPrice / rawUnitPrice / memberTierId / memberTierName / memberSaved / couponId / couponTitle / couponDiscount / pointsUsed / pointsDiscount / amountBase / amountPaid / pointsEarned`
  > 快照的意义：活动日后改价，历史订单金额**不漂移**
- 副作用顺序：**先扣积分与券 → 再按实付金额赠分**（赠分绝不基于抵扣前金额，否则等于刷分）
- 成功页展示费用明细（会员省 / 券 / 积分 / 实付 / 获得积分）

### 5. 后台面板与会员中心

- 「会员与营销」面板从**只有三个开关** → **开关 + 规则 + 生效预览**
  - 生效预览逐档列出「客户实际看到的价格 + 省多少」，并给出 `mm-pv-warn` 诚实提醒（例：*「当前 4 档会员价均与活动价（¥180）相同 —— 客户在详情页看不到任何会员优惠」*）
  - 积分规则（俱乐部级）：抵现比例 / 单笔上限% / 起抵积分 / 报名赠分
  - 每档补「每 ¥1 累积 N 积分」→ 让 `pointsRate` 真正可见
  - 优惠券提示：按当前活动价显示**本次可用几张**、俱乐部共几张
- 会员中心新增「积分明细」区段：可抵现金额、换算规则、流水（收入/支出分色）、**无流水时诚实空态**

### 6. 演示数据播种（否则 C 端永远看不出效果）

`seedState()` + 迁移块补：`points: 2600` + 一条历史流水 + `memberMarketing` 默认规则 + 一张 `满 100 减 20` 的**活动可用券**；
老 localStorage 走一次性 `_mmSeedV199` 标记补齐（不覆盖更高余额）。
> 没有这一步：余额 0 → 普通等级 → 档位价等于原价 → 视觉上「还是没实现」。

---

## 三、回归与验收

- 新增 `case-v199-member-marketing.epilogue.js`：**35 项契约**，覆盖
  会员价全展示点生效 / **假优惠不显示** / 团期价走会员价 / 积分上限与余额校验 / 起抵线 / 不为负 /
  券门槛与范围（装备券不进报名）/ 结算金额自洽 / 流水与赠分 / `saveState` 往返不抹字段 / 后台预览
- 全量 **35 个 epilogue 全绿**（Python 驱动判定退出码，规避本环境 bash grep 不可信）
- 全视图渲染冒烟：`renderFrontHome / frontDetail / signup / memberMembershipH5 / activityPage / editor / dashboard / list / customers / economics / settings / membershipAdmin / decorate / analytics / prep / success` 全部无异常，`checkRequiredModules()` = `[]`
- CDN + MD5：11 个文件本地/线上**全一致**，线上 `version.json` = **199**

## 四、合同/语义约定（后来者必读）

1. **会员等级 `pointsRate` 的单位是「几元赠送 1 积分」**（默认 普通 1 / 银卡 1 / 金卡 0.8 / 黑卡 0.5 —— 数值越小越慷慨），**不是倍率**。等级 benefits 文案写「报名积分 1.5 倍」而字段存 0.8，两者只有按「0.8 元 = 1 积分」解释才自洽。已固化为 `pointsPerYuanOf()` 并有断言钉死。
2. **无真优惠不得出现会员价痕迹**。任何新的价格展示点必须走 `priceDisplayHtml()`，不得再直接拼 `a.price`。
3. **积分余额单一真源是 `state.points`**；`state.pointsLedger` 只做审计展示，**不反算余额**。
4. **赠分基数必须是实付金额**（抵扣后），且顺序为先扣后赠。
5. **活动报名只认 `scope=all` 的券**；`scope=gear` 属商城，不在报名里打折。
