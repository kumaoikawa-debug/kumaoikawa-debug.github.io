# v191 —— 《今日新增优化需求》8 方向落地：AI 经营分析 + 户外执行侧

发版：`5b85ceb` → 线上 `https://kumaoikawa-debug.github.io/admin.html?v=191`

本轮不对 V2.0 主干（AI 创建活动 / AI 图文详情 / 图片智能排版 / AI 宣发回顾 / 基础报名）做任何重构，全部为**增量叠加**：
新增文档 `docs/clubos-v2-increment-20260916.md`，新增两个模块 `src/economics.js`（1,379 行）+ `src/ops.js`（977 行）。

核心原则未变：**不是给老板更多复杂工具，而是让 AI 用真实业务数据替老板完成经营判断与操作。**

---

## 一、8 个方向 ↔ 落地位置

| # | 需求方向 | 落地 |
|---|---|---|
| 1 | 长线/多日活动复杂配置 | `opsParsePackageText` / `opsPackagePrice` / `opsSavePackages`（天数·房型·单房差·交通·自选增减） |
| 2 | 领队端离线活动包 | `buildLeaderPackHtml`（自包含单文件 HTML）+ `downloadLeaderPack` |
| 3 | 活动安全执行资料 | `opsSafetyBriefing` / `opsMemberRows` + **最小权限** `opsCanViewSafety` / `opsRedactActivity` |
| 4 | 保险自动化 | `opsRecommendInsurance` / `opsInsuranceRoster` / `opsInsuranceSyncFromProvider` / `opsApplyInsurancePlan` |
| 5 | 风险协议 / 电子签自动匹配 | `OPS_AGREEMENT_DEFS` / `opsAgreements` / `opsAgreementMarkSigned` |
| 6 | 户外退款 + 名额转让 | `opsParseRefundPolicy` / `opsRefundRateFor` / `opsTransferSlot` |
| 7 | AI 客户召回 | `opsCustomerIndex` / `opsRecallCandidates` / `opsRecallMessage` / `opsRecallMarkSent` |
| 8 | **AI 经营分析** | `renderEconomics()` + `econ*` 全套（本轮重点） |

> 「AI 财务核销」已按需求**取消命名**，改为 **AI 经营分析**。

---

## 二、AI 经营分析：明确不做财务系统

页面首屏原样写明边界：

> ClubOS 不做报销、审批、发票与会计 —— 收入自动从报名读取，成本只需一句话录入，结论由 AI 直接给你。

- **收入**：默认从报名记录自动读取（`adults × 单价 + children × 儿童价`，再抵扣退款）；无报名记录时退化为「人数 × 单价」。三档成本录入：极简表单 / 自然语言 / 截图识别，**均不强制凭证**。
- **成本自然语言**：`parseCostText("今天大巴2800，吃饭1260，两个领队一共1000")` → 按 8 个科目归集，支持 万/千/k 单位换算，不确定的落到 `unmatched` 让老板确认。
- **`activityProductId`**：`ensureActivityProductId()` 按路线归一化（剥掉「3月」「第2期」等批次词），同一产品跨月份**自动归并**，产品目录落在 `state.econProducts`。
- **4 层分析**：单场结果（`econMetrics`）→ 横向比较（`econAnomalies`）→ 12 个月基线（`econBaseline`）→ 产品盈利能力与组合（`econPortfolio` / `econClassifyProduct`）。
- **盈亏平衡**：`econBreakEvenFor` → `ceil(固定成本 / (单价 − 单位变动成本))`，变动科目默认「餐饮 + 保险」。
- **经营问答**：`econAnswer(q)` 覆盖 10 类意图（最赚钱 / 收入低毛利 / 可削减 / 车辆风险 / 供应商 / 类型对比 / 保本价 / 明年 / 差异原因 / 成本结构），答不上来返回 `insufficient: true` 而**不编造**。

### ★ 数据事实 vs AI 推测（硬约束）

- 有元数据（车型 / 供应商 / 公里数）才给推测：`econExplainDifference()` → `hypothesis: "…车型变化（29座中巴 vs 39座大巴）是重要因素"`。
- 无元数据一律 `reasonUnavailable: true`，原文只说：
  > 目前没有记录车辆型号、车辆供应商、车辆数量、行驶公里数，因此暂时无法确认具体原因。

真机逐字核验：全页**不出现**「旺季 / 涨价 / 供不应求 / 油价上涨」等归因。

### 产品分档不只看利润

`econClassifyProduct` 综合 频次 / 毛利率 / 报名 / 成团 / 成本与利润波动 / 复购 / 拉新 / 季节性，输出 7 档。
真机实测（14 场 / 6 产品）：

| 分档 | 产品 | 场均毛利 |
|---|---|---|
| 核心稳定产品 | 都江堰—青城后山 · 徒步（3 场） | ¥2,937 |
| 高利润产品 | 四姑娘山 · 大峰 · 登山（2 场） | ¥16,928 |
| 引流产品 | 龙泉山亲子自然课 · 亲子（2 场） | ¥272 |
| 待优化产品 | 彭州小鱼洞 · 徒步（3 场） | ¥2,585 |
| 低效产品 | 金堂白鹤滩湿地 · 徒步（3 场） | ¥177 |
| 观察中 | 九峰山 · 徒步（1 场） | ¥760 |

注意：**利润最高的四姑娘山没有被判成「核心稳定」**——核心稳定给的是场次最稳、成本波动最小的青城后山。

---

## 三、户外执行侧：离线包是给「没信号的地方」用的

- **完全自包含**：内联 CSS，无 `<link>`、无 `<img>`、无外部脚本、无 `http(s)://` 引用。真机验证：**停掉本地服务器**后以 `file://` 打开，`document.images.length === 0`、`styleSheets.length === 1`，标题与全文正常。
- 内含：活动名称/日期/集合、路线与行程摘要、队员名单 + 电话、紧急联系人、保险状态、未成年人监护、车辆信息、领队分组、安全提示、活动应急联系人。
- **最小权限**：安全执行资料仅 owner 与被指派领队可见（`opsViewer` / `opsCanViewSafety`），越权时用 `opsRedactActivity` 返回脱敏副本。
- **保险名单核验**识别 4 类真实问题：超龄 / 身份证校验不通过（GB 11643 校验位）/ 缺姓名电话 / 未投保。真机跑出「18/18 已投保」「1 人未投保」「身份证号异常」等结果均为真实判定。
- **协议自动匹配**（不自己造电子签，只判断该签哪些、交付第三方）：
  - 户外活动风险告知书 —— 所有户外活动的基础风险告知
  - 未成年人参加活动监护人知情同意书 —— 有未成年人参加，须监护人签署
  - 多日/长线活动补充告知 —— 行程 2 天及以上
- **退改一句话**：`"3天前可退80%，一天内不退，可以转给别人"` → 分档 + `transferable`；不可转让时 `opsTransferSlot` 明确拒绝，允许时**换人不换单、保留已付款**。
- **客户召回自建索引**（`opsCustomerIndex`，不依赖 B 端派生客户），按 类型 / 路线 / 强度 / 久未参加 / 复购 打分，**已报名本场自动排除**。

---

## 四、接线

- `src/activities.js`：活动详情页（`activityPage`）末尾追加「出发前准备」+「经营数据」两个 section；侧栏在「运营分析」前加「经营分析」。
- `src/shell.js`：`backend` 白名单新增 `"prep", "economics"`；`showView` 新增两条分支；`renderShell(content, …)` 对 `activityPage/prep` 用 `"list"` 高亮；`handleClick` 新增 `openPrep / econAsk / econAskChip / econToggleProduct / econToggleCost / econEditActivity`。
- 三入口（admin / front / index）在 `boot.js` 前挂载 `economics.js` 与 `ops.js`。

---

## 五、验收

- 新增 `case-v191-econ-ops.epilogue.js`：**155 项**断言，含**反向验证**（临时摘掉 `backend` 白名单里的 `prep/economics` → 8 条渲染断言立即变红），证明断言真的在读 DOM 而不是只读 `state`。
- 全量 **29 个 epilogue 全绿**（v190 为 28 个，本轮 +1）。
- **真机验证**（agent-browser，本地 8791，Chrome）：注入 14 场活动 / 6 产品 / 106 条报名后逐页人工核对 ——
  - 经营分析首页：14 场 · 报名 362 人 · 收入 ¥142,634 · 毛利 ¥52,256 · 平均毛利率 36.6%（无 JS 报错）
  - 经营问答三连：`哪条线最赚钱？` / `车辆成本是不是有问题？` / `明年这条路要不要涨价？` 均给出带数字依据的答案，且缺元数据时明确说「无法确认具体原因」
  - 活动详情页：出发前准备 + 经营数据两区块正常（收入 ¥34,440 自动读取、毛利率 43%、保本 9 人）
  - 出发前准备页：离线包 / 安全资料 / 保险核验 / 协议 / 退改 / 召回 全部渲染正常
  - 离线包：下载 7,096 bytes → 断网 `file://` 打开正常

### 真机验证发现的问题（本轮修正）

1. **身份证校验位是真校验**：首版夹具用随机 18 位数字，被 `opsValidIdCard`（GB 11643 校验位）全部判为异常 —— 这是**正确行为**，改为在夹具里按权重算真实校验位。
2. **「只报名儿童」的孤立记录会被判缺资料**：夹具最初生成了 `adults:0, children:1` 且无电话的记录，于是被标「缺少姓名或联系电话」。核对源码后确认**应用逻辑正确**——真实形态是儿童挂在家长记录上（`adults>=1, children:1`），修正夹具后异常归零（18/18 已投保）。此为夹具问题，未改动应用代码。

---

## 六、备份

`versions/{shell,activities,boot}-pre-econ-v190.{js}`、`versions/styles-pre-econ-v190.css`、`versions/{admin,front,index}-pre-econ-v190.html`（自 git `HEAD` 导出；`versions/` 被 `.gitignore`，不进提交）。

---

## 七、边界（本轮明确不做）

报销 / 审批 / 发票审核 / 会计凭证 / 总账 / ERP 式审批 —— 一律不做。成本只需一句话录入，**不要求任何凭证**。
