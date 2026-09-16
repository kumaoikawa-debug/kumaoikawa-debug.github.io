# v189 · 修 v188 的致命遗漏：活动详情落点渲染成前台首页

## 老板看到的现象（v188 后）

点「一键生成图文详情页」→ 落在 **AI 宣发中心**（v188 修之前），
而 v188 修完后的真实情况更糟：**点完看到的是前台首页**。

## 根因

`showView(view, params)` 里有 **两处**必须同时登记新视图：

```js
const backend = ["dashboard", ..., "library", "mallConsole", ...];  // ← ① 视图白名单
if (backend.includes(view)) {
  ...
  else if (view === "activityPage") content = renderActivityPage();  // ← ② 渲染分支
  app.innerHTML = renderShell(content, view);
}
...
else app.innerHTML = renderFrontHome();   // ← 兜底分支
```

v188 只加了 ②，**忘了加 ①**。于是：

- `state.view === "activityPage"` ✅（`showView` 第一行就写了 state）
- `backend.includes("activityPage")` ❌ → 跳过整个后台分支
- 落进最后的 `else app.innerHTML = renderFrontHome()` → **老板看到前台首页**

**这是最难发现的一类缺陷**：应用层状态全部正确，我的 39 条断言（只查 `state.view`
与各函数返回值）**全绿通过**。是真实浏览器实测才暴露的──
`document.querySelector(".ap-head")` 为 null，而 `#app` 里是 `<div class="front front-v16">`。

## 修复

1. **`src/shell.js`**：`backend` 数组补上 `"activityPage"`（v188 的唯一遗漏点）。
2. **验收脚本** `case-sec7-oneclick-flow.epilogue.js` → 42 项，新增 3 条**渲染层断言**：
   - `★#app 真的渲染出活动详情工作区（ap-head）`
   - `★#app 渲染出图文长页（xh-ed）`
   - `★#app 不是兜底的前台首页`（不含 `front-v16` / `home-hero`）
3. **harness** `spa-smoke.js`：`getElementById`/`querySelector` 改为
   `_elCache` / `_elOnce(key)` —— **同一选择器返回同一元素**。
   此前每次返回新 `el()`，`$("#app").innerHTML = x` 写进临时对象后即丢失，
   渲染层断言根本无法进行（这正是「以前只敢断言 state」的技术根因）。

## 断言有效性：做过「反向验证」

临时把 `activityPage` 从白名单摘掉 → 重跑：

```
"passed": 39,
"failedNames": [
  "§七-4 ★#app 真的渲染出活动详情工作区（ap-head）",
  "§七-4 ★#app 渲染出图文长页（xh-ed）",
  "§七-4 ★#app 不是兜底的前台首页"
]
```

恢复后 **42/42 全绿**。**没做过反向验证的断言，不算有效断言。**

## 真机实测（agent-browser，线上 v189）

链路上真实执行 `confirmFactsToPage()` 后的浏览器读数：

```json
{ "view": "activityPage", "detailMode": "editorial", "draftReleased": true,
  "stored": true, "layout": "L-mosaic-story", "style": "S-scenery-mag",
  "hasAppHead": true, "hasPhone": true, "h1": "浏览器实测·赵公山轻装徒步",
  "btns": ["nav","operatorFromActivity","edit","confirmPublishPage",
           "setDetailMode","setDetailMode","regenLayout","regenStyle"] }
```

真实点击（非仅函数调用）：

- 换风格：`S-scenery-mag → S-challenge-doc`，视图仍为 activityPage
- 换版式：`L-mosaic-story → L-solo-route`，视图仍为 activityPage
- 简洁报名 ↔ 图文长页 切换正常
- 摘要条：「✓ AI 已自动完成　事实 12 项　选图 0/0　角色 0　版式 大图·行程序　风格 挑战·纪实型」

界面截图确认：左侧导航「活动内容」高亮、卡片式操作条、手机预览、右下角 `v189`。

## 发版

`bump.py 189` → commit `b9bf6c2` → push → curl 核验：
`version.json=189`、三入口 `APP_VER=189`、`shell.js?v=189` 第 6 行含 `"list", "activityPage"`、
本地与线上 MD5 一致（`f1709207…`）；`platform/` 独立序列 85 未动。
全量回归 **27 个 epilogue 全绿**。

## 沉淀到技能

`~/.workbuddy/skills/clubos-static-spa-release/SKILL.md` 已补：

1. §1.4 视图路由：新视图**两处都要登记**，漏白名单会静默落兜底分支
2. §4.2 冒烟：**渲染层断言纪律** + 反向验证 + stub 元素缓存说明
3. §4.5 真机：`state.view` 会骗人（要 state + DOM 双断言）、daemon 缓存诊断顺序、
   **Edit 后必须复验落盘**（本次一度误判为浏览器缓存）
