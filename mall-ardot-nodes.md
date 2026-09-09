# ClubOS 商城 · ardot 节点树（batch_edit 执行脚本 v82）

> 本文件是 `mall-ardot-design-spec.md` 的**下一步落地脚本**：把 8 套画板拆成 ardot `batch_edit` 可直接执行的节点树。
> 画布 MCP 未连接时本文件为「待执行脚本」；连接器就位后，按批次把每段 `// Batch N` 的代码原样传入 `batch_edit`（每段 ≤25 ops）即可。
> 路由判定：UI / interface（ardot-ui-design）。移动端画板 375×812；后台/平台 1440 桌面。

## 全局约定（执行前必读）

**设计 token（ardot 中用 `fill: "#hex"`，文本同样用 `fill`）**
| 角色 | hex | 用途 |
|------|-----|------|
| bg 米白 | `#F7F4EE` | 全局底 / 卡片底 |
| brand 松绿 | `#2F5D50` | 主色 / 标题 / 主按钮 |
| brand-700 | `#244A40` | 深绿 / 按下态 |
| brand-tint | `#F2F6F4` | 极浅绿 hover |
| accent 金棕 | `#C2873F` | 价格 / 关键数据 / CTA 描边 |
| line 细线 | `#E7E1D6` | 分组线（替代卡片描边） |
| text 正文 | `#2B2B28` | 主文字 |
| text-sub | `#7A766C` | 次级文字 |

**字体**：标题 `Noto Serif SC`（style Bold/Regular），正文 `Noto Sans SC`。⚠️ 执行前先 `get_available_fonts(keyword:"Noto Serif SC")` / `Noto Sans SC` 取精确 style 字符串替换下方占位。
**图片模式**：`<ardot_image_gen mode="ai">` → 全部 `G(node, "ai", "<prompt>")`（每段提示词见各画板）。每个节点仅 `G()` 一次。
**属性红线**：文本色用 `fill` 非 `textColor`；圆角 `cornerRadius` 非 `borderRadius`；字重 `"700"` 数字串；frame 背景 `fill`；每批 ≤25 ops；`pageId` 在新建文件为 `0:1`，打开已有文件用 `fetch_file_info` 取真实 id 替换。

---

## 视角 A · 消费者门店首页（renderStorefront）375×812

```javascript
// Batch A1: 屏幕框 + 顶栏 + 品牌头
aScreen=I(pageId, {type:"frame", name:"A-门店首页", width:375, height:812, fill:"#F7F4EE", layout:"vertical", layoutSizingVertical:"HUG"})
aTop=I(aScreen, {type:"frame", name:"topbar", width:"fill_container", layout:"horizontal", primaryAxisAlignItems:"SPACE_BETWEEN", counterAxisAlignItems:"CENTER", paddingTop:12, paddingBottom:12, paddingLeft:16, paddingRight:16, fill:"#FFFFFF"})
aBack=I(aTop, {type:"frame", name:"返回", width:56, height:32, cornerRadius:8, fill:"#F2F6F4"})
aBackTx=I(aBack, {type:"text", content:"‹ 返回", fontSize:14, fill:"#244A40", fontName:{family:"Noto Sans SC", style:"Regular"}})
aTopTx=I(aTop, {type:"text", content:"装备商城", fontSize:15, fontWeight:"700", fill:"#244A40", fontName:{family:"Noto Sans SC", style:"Bold"}})
aHeroBg=I(aScreen, {type:"frame", name:"store-hero", width:"fill_container", height:188, layout:"vertical", counterAxisAlignItems:"CENTER", paddingTop:24, paddingBottom:20, paddingLeft:20, paddingRight:20})
G(aHeroBg, "ai", "高山草甸徒步场景，领队整理背包特写，晨雾，松绿与米白基调，电影级户外品牌视觉，无文字")
aHeroOv=I(aHeroBg, {type:"frame", name:"hero-mask", width:"fill_container", height:"fill_container", layout:"vertical", counterAxisAlignItems:"CENTER", fill:"#244A40", opacity:0.42})
aHeroT=I(aHeroOv, {type:"text", content:"{俱乐部名}装备精选", fontSize:22, fontWeight:"700", fill:"#FFFFFF", fontName:{family:"Noto Serif SC", style:"Bold"}})
aHeroS=I(aHeroOv, {type:"text", content:"跟着领队用过的装备清单挑，出发前一次备齐", fontSize:13, fill:"#EDEFEA", fontName:{family:"Noto Sans SC", style:"Regular"}})
aTrust=I(aHeroOv, {type:"frame", name:"store-trust", layout:"horizontal", gap:10, counterAxisAlignItems:"CENTER", marginTop:12})
aT1=I(aTrust, {type:"text", content:"✓ 正品直发", fontSize:11, fill:"#FFFFFF", fontName:{family:"Noto Sans SC", style:"Regular"}})
aT2=I(aTrust, {type:"text", content:"✓ 7 天无理由", fontSize:11, fill:"#FFFFFF", fontName:{family:"Noto Sans SC", style:"Regular"}})
aT3=I(aTrust, {type:"text", content:"✓ 售后统一受理", fontSize:11, fill:"#FFFFFF", fontName:{family:"Noto Sans SC", style:"Regular"}})
```

```javascript
// Batch A2: 领队推荐货架 + 分类胶囊 + 商品网格(2 示例) + 底部 tabbar
aRecSec=I(aScreen, {type:"frame", name:"领队推荐", width:"fill_container", layout:"vertical", paddingLeft:16, paddingRight:16, paddingTop:16})
aRecH=I(aRecSec, {type:"text", content:"领队推荐", fontSize:16, fontWeight:"700", fill:"#244A40", fontName:{family:"Noto Serif SC", style:"Bold"}})
aRecRow=I(aRecSec, {type:"frame", name:"rec-row", width:"fill_container", layout:"horizontal", itemSpacing:12, paddingTop:10})
aRec1=I(aRecRow, {type:"frame", name:"mall-rec", width:120, height:160, cornerRadius:12, fill:"#FFFFFF", strokes:[{type:"SOLID", color:{r:0.91,g:0.88,b:0.84}, opacity:1}], strokeWeight:1})
aRec1Ph=I(aRec1, {type:"frame", name:"ph", width:"fill_container", height:96, cornerRadius:12})
G(aRec1Ph, "ai", "碳纤登山杖静物，自然光柔光，米白留白背景，户外装备产品摄影")
aRec1T=I(aRec1, {type:"text", content:"碳纤登山杖（一对）", fontSize:12, fill:"#2B2B28", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingLeft:8, paddingRight:8, paddingTop:6})
aRec1P=I(aRec1, {type:"text", content:"¥199", fontSize:13, fontWeight:"700", fill:"#C2873F", fontName:{family:"Noto Sans SC", style:"Bold"}, paddingLeft:8, paddingBottom:8})
// aRec2 = C(aRec1, aRecRow, {...}) 复制第 2 件（如 帐篷）
aCats=I(aScreen, {type:"frame", name:"mall-cats", width:"fill_container", layout:"horizontal", itemSpacing:8, paddingLeft:16, paddingRight:16, paddingTop:14})
aCat1=I(aCats, {type:"frame", name:"pill", cornerRadius:14, paddingTop:6, paddingBottom:6, paddingLeft:14, paddingRight:14, fill:"#F2F6F4"})
aCatTx=I(aCat1, {type:"text", content:"徒步", fontSize:12, fill:"#2F5D50", fontName:{family:"Noto Sans SC", style:"Regular"}})
// 分类 pill ×N（露营/研学/其他）复制 aCat1
aGrid=I(aScreen, {type:"frame", name:"mall-grid", width:"fill_container", layout:"wrap", layoutWrap:"WRAP", itemSpacing:12, counterAxisSpacing:12, paddingLeft:16, paddingRight:16, paddingTop:12, paddingBottom:80})
aCard=I(aGrid, {type:"frame", name:"mall-card", width:160, height:236, cornerRadius:12, fill:"#FFFFFF", strokes:[{type:"SOLID", color:{r:0.91,g:0.88,b:0.84}, opacity:1}], strokeWeight:1})
aCardPh=I(aCard, {type:"frame", name:"ph", width:"fill_container", height:120, cornerRadius:12})
G(aCardPh, "ai", "户外冲锋衣静物，柔光，浅景深，留白背景，产品摄影")
aCardT=I(aCard, {type:"text", content:"轻量冲锋衣（三合一）", fontSize:13, fill:"#2B2B28", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingLeft:8, paddingRight:8, paddingTop:6})
aCardTag=I(aCard, {type:"frame", name:"tags", width:"fill_container", layout:"horizontal", itemSpacing:6, paddingLeft:8, paddingTop:4})
aCardGt=I(aCardTag, {type:"text", content:"专业装备", fontSize:10, fill:"#2F5D50", fontName:{family:"Noto Sans SC", style:"Regular"}})
aCardRt=I(aCardTag, {type:"text", content:"★ 4.8", fontSize:10, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}})
aCardFoot=I(aCard, {type:"frame", name:"foot", width:"fill_container", layout:"horizontal", primaryAxisAlignItems:"SPACE_BETWEEN", counterAxisAlignItems:"CENTER", paddingLeft:8, paddingRight:8, paddingBottom:8, paddingTop:4})
aCardPr=I(aCardFoot, {type:"text", content:"¥599", fontSize:15, fontWeight:"700", fill:"#C2873F", fontName:{family:"Noto Sans SC", style:"Bold"}})
aCardSh=I(aCardFoot, {type:"text", content:"顺丰包邮", fontSize:10, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}})
// aCard2..N = C(aCard, aGrid, {覆盖 ph 的 G 与文案}) 复制商品卡
aTab=I(aScreen, {type:"frame", name:"front-tabbar", width:"fill_container", height:56, layout:"horizontal", primaryAxisAlignItems:"SPACE_BETWEEN", counterAxisAlignItems:"CENTER", fill:"#FFFFFF", strokes:[{type:"SOLID", color:{r:0.91,g:0.88,b:0.84}, opacity:1}], strokeWeight:1})
aTab1=I(aTab, {type:"frame", name:"ft-首页", layout:"vertical", counterAxisAlignItems:"CENTER", layoutGrow:1})
aTab1Tx=I(aTab1, {type:"text", content:"首页", fontSize:11, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}})
aTab2=I(aTab, {type:"frame", name:"ft-商城", layout:"vertical", counterAxisAlignItems:"CENTER", layoutGrow:1})
aTab2Tx=I(aTab2, {type:"text", content:"商城", fontSize:11, fontWeight:"700", fill:"#2F5D50", fontName:{family:"Noto Sans SC", style:"Bold"}})
// ft-订单 / ft-我的 复制 aTab1
```

---

## 视角 D · 商品详情（C 端）375×812

```javascript
// Batch D1: 顶栏 + 大图 + 标题区 + 价格(无佣金) + 购买按钮
dScreen=I(pageId, {type:"frame", name:"D-商品详情C端", width:375, height:812, fill:"#F7F4EE", layout:"vertical", layoutSizingVertical:"HUG"})
dTop=I(dScreen, {type:"frame", name:"topbar", width:"fill_container", layout:"horizontal", primaryAxisAlignItems:"SPACE_BETWEEN", counterAxisAlignItems:"CENTER", paddingTop:12, paddingBottom:12, paddingLeft:16, paddingRight:16, fill:"#FFFFFF"})
dBack=I(dTop, {type:"frame", name:"返回", width:56, height:32, cornerRadius:8, fill:"#F2F6F4"})
dBackTx=I(dBack, {type:"text", content:"‹ 返回", fontSize:14, fill:"#244A40", fontName:{family:"Noto Sans SC", style:"Regular"}})
dTopTx=I(dTop, {type:"text", content:"商品详情", fontSize:15, fontWeight:"700", fill:"#244A40", fontName:{family:"Noto Sans SC", style:"Bold"}})
dPh=I(dScreen, {type:"frame", name:"mall-detail-ph", width:"fill_container", height:300, fill:"#E9E4DA"})
G(dPh, "ai", "碳纤登山杖与户外手套组合静物，自然光，米白留白，产品摄影")
dBody=I(dScreen, {type:"frame", name:"front-body", width:"fill_container", layout:"vertical", paddingLeft:16, paddingRight:16, paddingTop:16})
dTitle=I(dBody, {type:"text", content:"碳纤登山杖（一对）", fontSize:19, fontWeight:"700", fill:"#2B2B28", fontName:{family:"Noto Serif SC", style:"Bold"}})
dSub=I(dBody, {type:"text", content:"超轻 EVA 手柄 · 三节外锁 · 适配徒步与登山", fontSize:13, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:4})
dTags=I(dBody, {type:"frame", name:"tags", layout:"horizontal", itemSpacing:8, paddingTop:10})
dGt=I(dTags, {type:"text", content:"专业装备", fontSize:11, fill:"#2F5D50", fontName:{family:"Noto Sans SC", style:"Regular"}})
dRt=I(dTags, {type:"text", content:"★ 4.8", fontSize:11, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}})
dPrice=I(dBody, {type:"frame", name:"price", layout:"horizontal", itemSpacing:8, counterAxisAlignItems:"CENTER", paddingTop:12})
dPr=I(dPrice, {type:"text", content:"¥199", fontSize:24, fontWeight:"700", fill:"#C2873F", fontName:{family:"Noto Sans SC", style:"Bold"}})
dShip=I(dPrice, {type:"text", content:"顺丰包邮 · 48h 内发出", fontSize:12, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}})
dNote=I(dBody, {type:"text", content:"正品直发，7 天无理由退换；穿戴与尺码问题可直接在订单里申请售后。", fontSize:12, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:8, lineHeight:18})
dBuy=I(dBody, {type:"frame", name:"立即购买", width:"fill_container", height:48, cornerRadius:24, fill:"#2F5D50", counterAxisAlignItems:"CENTER", primaryAxisAlignItems:"CENTER", marginTop:16})
dBuyTx=I(dBuy, {type:"text", content:"立即购买", fontSize:16, fontWeight:"700", fill:"#FFFFFF", fontName:{family:"Noto Sans SC", style:"Bold"}})
```

> ⚠️ **D 视角红线**：C 端绝不可出现「单件佣金」「上架到我的推荐货架」等经营动作（那是 D 俱乐部视角，见 Batch D-club）。

---

## 视角 E · 活动×装备融合（活动详情内嵌，renderGearMall）375×812

```javascript
// Batch E1: 装备建议区标题 + 匹配商品卡(清单匹配徽标)
eSec=I(pageId, {type:"frame", name:"E-装备建议", width:375, layout:"vertical", paddingLeft:16, paddingRight:16, paddingTop:16, fill:"#F7F4EE"})
eH=I(eSec, {type:"text", content:"装备建议", fontSize:16, fontWeight:"700", fill:"#244A40", fontName:{family:"Noto Serif SC", style:"Bold"}})
eHint=I(eSec, {type:"text", content:"根据本次活动清单自动匹配，出发前一次备齐", fontSize:12, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:2})
eCard=I(eSec, {type:"frame", name:"gear-mall-card", width:"fill_container", height:104, cornerRadius:12, fill:"#FFFFFF", layout:"horizontal", itemSpacing:12, paddingTop:12, paddingBottom:12, paddingLeft:12, paddingRight:12, strokes:[{type:"SOLID", color:{r:0.91,g:0.88,b:0.84}, opacity:1}], strokeWeight:1})
ePh=I(eCard, {type:"frame", name:"ph", width:80, height:80, cornerRadius:8})
G(ePh, "ai", "登山头盔 CE 认证产品静物，柔光，留白背景，户外安全装备摄影")
eInfo=I(eCard, {type:"frame", name:"info", layout:"vertical", layoutGrow:1, counterAxisAlignItems:"MIN"})
eT=I(eInfo, {type:"text", content:"攀登头盔（CE 认证）", fontSize:14, fontWeight:"700", fill:"#2B2B28", fontName:{family:"Noto Sans SC", style:"Bold"}})
eMeta=I(eInfo, {type:"frame", name:"meta", layout:"horizontal", itemSpacing:6, paddingTop:4})
eMatch=I(eMeta, {type:"frame", name:"gmc-match", cornerRadius:6, paddingTop:2, paddingBottom:2, paddingLeft:6, paddingRight:6, fill:"#2F5D50"})
eMatchTx=I(eMatch, {type:"text", content:"清单匹配", fontSize:10, fill:"#FFFFFF", fontName:{family:"Noto Sans SC", style:"Regular"}})
eGt=I(eMeta, {type:"text", content:"技术装备", fontSize:10, fill:"#C2873F", fontName:{family:"Noto Sans SC", style:"Regular"}})
ePr=I(eInfo, {type:"text", content:"¥329", fontSize:14, fontWeight:"700", fill:"#C2873F", fontName:{family:"Noto Sans SC", style:"Bold"}, paddingTop:6})
// eCard2..N 复制 eCard（匹配/非匹配；排序 匹配>安全>品质>评价>价格，佣金不参与）
```

> 重点打磨 `gmc-match`「清单匹配」徽标：松绿底白字，是活动×装备融合的核心差异化视觉。

---

## 视角 F · 消费者会员页（renderMembershipH5）375×812

```javascript
// Batch F1: 会员卡 + 权益三条 + 联系我们
fScreen=I(pageId, {type:"frame", name:"F-会员页", width:375, height:812, fill:"#F7F4EE", layout:"vertical", layoutSizingVertical:"HUG"})
fCard=I(fScreen, {type:"frame", name:"mc-card", width:"fill_container", layout:"vertical", paddingLeft:20, paddingRight:20, paddingTop:20, paddingBottom:20, cornerRadius:16, fill:"#2F5D50", marginLeft:16, marginRight:16, marginTop:16})
fName=I(fCard, {type:"text", content:"{会员名}", fontSize:20, fontWeight:"700", fill:"#FFFFFF", fontName:{family:"Noto Serif SC", style:"Bold"}})
fSub=I(fCard, {type:"text", content:"已参加 12 场 · 装备消费 ¥860", fontSize:13, fill:"#EDEFEA", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:4})
fBen=I(fScreen, {type:"frame", name:"mc-ben", width:"fill_container", layout:"vertical", paddingLeft:16, paddingRight:16, paddingTop:16})
fBenH=I(fBen, {type:"text", content:"会员权益", fontSize:16, fontWeight:"700", fill:"#244A40", fontName:{family:"Noto Serif SC", style:"Bold"}})
fB1=I(fBen, {type:"text", content:"· 老队员优先报名", fontSize:14, fill:"#2B2B28", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:8})
fB2=I(fBen, {type:"text", content:"· 装备推荐清单", fontSize:14, fill:"#2B2B28", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:4})
fB3=I(fBen, {type:"text", content:"· 活动记录留档", fontSize:14, fill:"#2B2B28", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:4})
fNote=I(fBen, {type:"text", content:"（以本俱乐部实际公告为准）", fontSize:11, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:6})
fContact=I(fScreen, {type:"frame", name:"mc-contact", width:"fill_container", layout:"vertical", paddingLeft:16, paddingRight:16, paddingTop:12})
fC1=I(fContact, {type:"text", content:"联系我们 · 微信 {wx} · 电话 {tel} · 地址 {addr}", fontSize:12, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}})
```

> ⚠️ F 视角红线：禁止渲染 B 端「俱乐部中心」与任何招商/抽成/佣金话术。

---

## 视角 H · C 端首页（renderFrontHome）375×812

```javascript
// Batch H1: 首页分区框架（正在招募/推荐/即将出发/往期/装备/关于品牌）+ tabbar
hScreen=I(pageId, {type:"frame", name:"H-首页", width:375, height:812, fill:"#F7F4EE", layout:"vertical", layoutSizingVertical:"HUG"})
hHero=I(hScreen, {type:"frame", name:"hero", width:"fill_container", height:200, fill:"#2F5D50", layout:"vertical", counterAxisAlignItems:"CENTER", paddingTop:28, paddingBottom:20})
G(hHero, "ai", "户外俱乐部活动剪影，远山晨光，暖松绿调，叙事感，无文字")
hHeroT=I(hHero, {type:"text", content:"{俱乐部名} · 户外活动", fontSize:22, fontWeight:"700", fill:"#FFFFFF", fontName:{family:"Noto Serif SC", style:"Bold"}})
hSec1=I(hScreen, {type:"frame", name:"正在招募", width:"fill_container", layout:"vertical", paddingLeft:16, paddingRight:16, paddingTop:16})
hSec1H=I(hSec1, {type:"text", content:"正在招募", fontSize:16, fontWeight:"700", fill:"#244A40", fontName:{family:"Noto Serif SC", style:"Bold"}})
hFeed=I(hSec1, {type:"frame", name:"sz-feed", width:"fill_container", layout:"vertical", itemSpacing:12, paddingTop:10})
hFeed1=I(hFeed, {type:"frame", name:"sz-card", width:"fill_container", height:150, cornerRadius:12, fill:"#FFFFFF", strokes:[{type:"SOLID", color:{r:0.91,g:0.88,b:0.84}, opacity:1}], strokeWeight:1})
G(hFeed1, "ai", "徒步活动雪山脚下的队伍，电影感户外摄影，无文字")
// hSec2 推荐 / hSec3 即将出发(up-row) / hSec4 往期 / hSec5 装备(mall-recs) / hSec6 关于品牌 —— 同结构复制，文案换标题
hTab=I(hScreen, {type:"frame", name:"front-tabbar", width:"fill_container", height:56, layout:"horizontal", primaryAxisAlignItems:"SPACE_BETWEEN", counterAxisAlignItems:"CENTER", fill:"#FFFFFF", marginBottom:0})
hTab1=I(hTab, {type:"frame", name:"ft-首页", layout:"vertical", counterAxisAlignItems:"CENTER", layoutGrow:1})
hTab1Tx=I(hTab1, {type:"text", content:"首页", fontSize:11, fontWeight:"700", fill:"#2F5D50", fontName:{family:"Noto Sans SC", style:"Bold"}})
// ft-商城 / ft-订单 / ft-我的 复制（参考 A 的 tabbar）
```

---

## 视角 B · 俱乐部收益台（renderClubMallConsole，后台 1440 桌面）

```javascript
// Batch B1: 后台壳(sidebar+顶栏占位) + 标题 + 4 收益卡
bShell=I(pageId, {type:"frame", name:"B-收益台", width:1440, height:900, layout:"horizontal", fill:"#F7F4EE"})
bSide=I(bShell, {type:"frame", name:"sidebar", width:220, height:"fill_container", fill:"#244A40", layout:"vertical", paddingTop:20, paddingLeft:16, paddingRight:16})
bSideTx=I(bSide, {type:"text", content:"俱乐部后台", fontSize:16, fontWeight:"700", fill:"#FFFFFF", fontName:{family:"Noto Serif SC", style:"Bold"}})
bMain=I(bShell, {type:"frame", name:"main", width:"fill_container", height:"fill_container", layout:"vertical", paddingLeft:32, paddingRight:32, paddingTop:24})
bTitle=I(bMain, {type:"text", content:"商城收益", fontSize:22, fontWeight:"700", fill:"#244A40", fontName:{family:"Noto Serif SC", style:"Bold"}})
bSub=I(bMain, {type:"text", content:"平台统一运营商品、定价、发货与售后；你只负责推荐，按成交拿佣金", fontSize:13, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:4})
bStats=I(bMain, {type:"frame", name:"stat-grid", width:"fill_container", layout:"horizontal", itemSpacing:16, paddingTop:16})
bS1=I(bStats, {type:"frame", name:"stat", width:240, height:96, cornerRadius:12, fill:"#FFFFFF", layout:"vertical", counterAxisAlignItems:"CENTER", justifyContent:"CENTER", strokes:[{type:"SOLID", color:{r:0.91,g:0.88,b:0.84}, opacity:1}], strokeWeight:1})
bS1N=I(bS1, {type:"text", content:"¥1,240", fontSize:22, fontWeight:"700", fill:"#C2873F", fontName:{family:"Noto Sans SC", style:"Bold"}})
bS1L=I(bS1, {type:"text", content:"在途佣金", fontSize:12, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}})
// bS2 可结算 / bS3 已到账 / bS4 在架推荐 复制 bS1（数字/标签换）
```

```javascript
// Batch B2: 我的推荐货架(shelf-row) + 商品库 + 佣金流转说明
bRecSec=I(bMain, {type:"frame", name:"我的推荐货架", width:"fill_container", layout:"vertical", paddingTop:20})
bRecH=I(bRecSec, {type:"text", content:"我的推荐货架", fontSize:16, fontWeight:"700", fill:"#244A40", fontName:{family:"Noto Serif SC", style:"Bold"}})
bShelf=I(bRecSec, {type:"frame", name:"shelf-list", width:"fill_container", layout:"vertical", itemSpacing:8, paddingTop:10})
bRow=I(bShelf, {type:"frame", name:"shelf-row", width:"fill_container", height:72, cornerRadius:10, fill:"#FFFFFF", layout:"horizontal", counterAxisAlignItems:"CENTER", itemSpacing:12, paddingLeft:12, paddingRight:12, strokes:[{type:"SOLID", color:{r:0.91,g:0.88,b:0.84}, opacity:1}], strokeWeight:1})
bRowPh=I(bRow, {type:"frame", name:"ph", width:56, height:56, cornerRadius:8})
G(bRowPh, "ai", "碳纤登山杖静物，柔光，留白背景，产品摄影")
bRowT=I(bRow, {type:"frame", name:"shelf-info", layout:"vertical", layoutGrow:1})
bRowTt=I(bRowT, {type:"text", content:"碳纤登山杖（一对）", fontSize:14, fill:"#2B2B28", fontName:{family:"Noto Sans SC", style:"Regular"}})
bRowTs=I(bRowT, {type:"text", content:"¥199 · 单件佣金 ¥24", fontSize:12, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:2})
bRowBtn=I(bRow, {type:"frame", name:"移出", height:32, cornerRadius:16, paddingLeft:14, paddingRight:14, fill:"#F2F6F4", counterAxisAlignItems:"CENTER", primaryAxisAlignItems:"CENTER"})
bRowBtnTx=I(bRowBtn, {type:"text", content:"移出", fontSize:12, fill:"#244A40", fontName:{family:"Noto Sans SC", style:"Regular"}})
// bRow2..N 复制（商品库池同上，按钮文案「上架」fill 改 #2F5D50）
bFlow=I(bMain, {type:"frame", name:"佣金流转", width:"fill_container", layout:"vertical", paddingTop:20})
bFlowTx=I(bFlow, {type:"text", content:"待确认 → 冻结（售后期）→ 可结算 → 已到账；订单退款则自动冲销归零", fontSize:12, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}})
```

---

## 视角 C · 平台商城运营（renderMallAdmin，1440 桌面）

```javascript
// Batch C1: 商品管理列表 + 编辑表单 + 佣金结算
cShell=I(pageId, {type:"frame", name:"C-平台运营", width:1440, height:900, layout:"horizontal", fill:"#F7F4EE"})
cSide=I(cShell, {type:"frame", name:"sidebar", width:220, height:"fill_container", fill:"#244A40", layout:"vertical", paddingTop:20, paddingLeft:16, paddingRight:16})
cSideTx=I(cSide, {type:"text", content:"ClubOS 总平台", fontSize:16, fontWeight:"700", fill:"#FFFFFF", fontName:{family:"Noto Serif SC", style:"Bold"}})
cMain=I(cShell, {type:"frame", name:"main", width:"fill_container", height:"fill_container", layout:"vertical", paddingLeft:32, paddingRight:32, paddingTop:24})
cH=I(cMain, {type:"text", content:"平台商城运营", fontSize:22, fontWeight:"700", fill:"#244A40", fontName:{family:"Noto Serif SC", style:"Bold"}})
cList=I(cMain, {type:"frame", name:"商品管理", width:"fill_container", layout:"vertical", paddingTop:16})
cRow=I(cList, {type:"frame", name:"mall-admin-row", width:"fill_container", height:72, cornerRadius:10, fill:"#FFFFFF", layout:"horizontal", counterAxisAlignItems:"CENTER", itemSpacing:12, paddingLeft:12, paddingRight:12, strokes:[{type:"SOLID", color:{r:0.91,g:0.88,b:0.84}, opacity:1}], strokeWeight:1})
cRowPh=I(cRow, {type:"frame", name:"ph", width:56, height:56, cornerRadius:8})
G(cRowPh, "ai", "户外装备产品静物，柔光，留白背景，产品摄影")
cRowT=I(cRow, {type:"frame", name:"mall-admin-info", layout:"vertical", layoutGrow:1})
cRowTt=I(cRowT, {type:"text", content:"碳纤登山杖（一对）", fontSize:14, fill:"#2B2B28", fontName:{family:"Noto Sans SC", style:"Regular"}})
cRowTs=I(cRowT, {type:"text", content:"徒步 · L2 一般户外 · 供货 ¥150 · 售 ¥199", fontSize:12, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}, paddingTop:2})
cRowDel=I(cRow, {type:"frame", name:"删除", height:32, cornerRadius:16, paddingLeft:14, paddingRight:14, fill:"#F2F6F4", counterAxisAlignItems:"CENTER", primaryAxisAlignItems:"CENTER"})
cRowDelTx=I(cRowDel, {type:"text", content:"删除", fontSize:12, fill:"#244A40", fontName:{family:"Noto Sans SC", style:"Regular"}})
// 编辑表单 apply-form（商品名/售价/供货价/佣金模式/佣金值/风险等级/保存）+ 佣金结算 comm-list 同结构复制
```

---

## 视角 G · 数据运营台（renderAnalytics，1440 桌面）

```javascript
// Batch G1: 北极星指标 + 5 指标卡 + 排行
gShell=I(pageId, {type:"frame", name:"G-数据台", width:1440, height:900, layout:"horizontal", fill:"#F7F4EE"})
gSide=I(gShell, {type:"frame", name:"sidebar", width:220, height:"fill_container", fill:"#244A40", layout:"vertical", paddingTop:20, paddingLeft:16, paddingRight:16})
gSideTx=I(gSide, {type:"text", content:"俱乐部后台", fontSize:16, fontWeight:"700", fill:"#FFFFFF", fontName:{family:"Noto Serif SC", style:"Bold"}})
gMain=I(gShell, {type:"frame", name:"main", width:"fill_container", height:"fill_container", layout:"vertical", paddingLeft:32, paddingRight:32, paddingTop:24})
gStar=I(gMain, {type:"frame", name:"北极星", width:"fill_container", height:120, cornerRadius:16, fill:"#2F5D50", layout:"vertical", counterAxisAlignItems:"CENTER", justifyContent:"CENTER"})
gStarT=I(gStar, {type:"text", content:"每 100 报名 → 商城 GMV", fontSize:20, fontWeight:"700", fill:"#FFFFFF", fontName:{family:"Noto Serif SC", style:"Bold"}})
gStarV=I(gStar, {type:"text", content:"¥8,640", fontSize:28, fontWeight:"700", fill:"#FFFFFF", fontName:{family:"Noto Sans SC", style:"Bold"}})
gCards=I(gMain, {type:"frame", name:"指标卡", width:"fill_container", layout:"horizontal", itemSpacing:16, paddingTop:16})
gC1=I(gCards, {type:"frame", name:"kpi", width:240, height:100, cornerRadius:12, fill:"#FFFFFF", layout:"vertical", counterAxisAlignItems:"CENTER", justifyContent:"CENTER", strokes:[{type:"SOLID", color:{r:0.91,g:0.88,b:0.84}, opacity:1}], strokeWeight:1})
gC1N=I(gC1, {type:"text", content:"312", fontSize:22, fontWeight:"700", fill:"#2F5D50", fontName:{family:"Noto Sans SC", style:"Bold"}})
gC1L=I(gC1, {type:"text", content:"本月报名", fontSize:12, fill:"#7A766C", fontName:{family:"Noto Sans SC", style:"Regular"}})
// gC2..gC5 复制（商城订单/GMV/在架商品/复购率）
```

---

## 执行顺序（ardot 连接器就位后）
1. `create_design`（或 `open_design` 已有文件）→ 拿到 `pageId`（新文件为 `0:1`）
2. `get_available_fonts` 校验 `Noto Serif SC` / `Noto Sans SC` 精确 style，回填所有 `fontName`
3. 按 A → D(C端) → E → B → D-club → C → F → G → H 顺序，每段 `// Batch` 作为一次 `batch_edit` 调用（≤25 ops）
4. 每批后 `capture_layout` 校验溢出；整页完成 `capture_screenshot` 走查
5. **截图校验重点**：A/D/F/H 绝无「佣金/供货价/上架/风险等级 L1-L3/招商」字样（消费者禁现内部信息）
