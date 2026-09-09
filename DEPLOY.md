# ClubOS 部署文档（GitHub Pages · 自动同步）

本目录 `clubos-deploy/` 已是**唯一代码源**（不再维护 `clubos-demo` / `clubos-platform` 镜像）。
目标是：本地改完 → `git push` → GitHub Pages 监听到 `main` 分支更新 → **自动发布**，链接永久稳定（不再被沙盒回收）。

---

## 重要：本项目必须用「根路径」托管

`admin.html` / `index.html` / `front.html` 以及 `src/*.js` 里大量使用**绝对路径**
（`/src/boot.js`、`/platform/index.html`、`/version.json`、`/styles.css?v=131` 等）。
GitHub Pages 的「项目站点」默认挂在子路径 `https://<用户>.github.io/<仓库>/` 下，
绝对路径会解析错（变成 `/src/...` 而非 `/<仓库>/src/...`），导致整站 404。

因此二选一（都必须让站点**根路径 `/` 可访问**）：

### 方案 A（最快，零额外配置）：GitHub 用户站点
- 在 GitHub 新建仓库，仓库名必须严格为：`<你的GitHub用户名>.github.io`
- 站点直接发布在 `https://<用户>.github.io/`（根路径），绝对路径天然正确。
- 缺点：占用你账号唯一的用户站点；`github.io` 在国内访问有时偏慢。

### 方案 B（推荐·国内生产）：项目仓库 + 自定义域名
- 任意仓库名（如 `clubos`）。
- 启用自定义域名 `clubos.topoutdoor.cn`（你已有 ICP 备案的域名，国内快且稳）。
- 仓库根放 `CNAME` 文件，内容一行：`clubos.topoutdoor.cn`
- 域名 DNS 加一条 **CNAME** 记录：`clubos.topoutdoor.cn` → `<你的GitHub用户名>.github.io`
- GitHub Pages 设置里填自定义域名并勾选 Enforce HTTPS（证书自动签发，约几分钟）。
- 站点发布在 `https://clubos.topoutdoor.cn/`（根路径），绝对路径正确。

> 若暂时不想配域名，先用方案 A 跑通；之后随时切到 B（加 `CNAME` + DNS 即可，代码不变）。

---

## 首次发布步骤

> 本机未安装 `gh` CLI，以下用普通 `git` 命令。先在 github.com 网页端**新建一个空仓库**（不要勾选 README/.gitignore），拿到仓库地址。

```bash
cd /Users/jckuma/WorkBuddy/2026-08-03-15-24-29/clubos-deploy

# 1) 改为你自己的 Git 身份（否则 commit 不会关联你的 GitHub 账号）
git config user.name  "你的GitHub用户名"
git config user.email "你的GitHub邮箱"

# 2) 关联远端（二选一）
#    SSH（推荐，配一次公钥后免密）：
git remote add origin git@github.com:<你的GitHub用户名>/clubos.git
#    或 HTTPS + 个人访问令牌(PAT，推送时密码处填 token 不是账号密码)：
# git remote add origin https://github.com/<你的GitHub用户名>/clubos.git

# 3) 首次推送（空仓库用 -u）
git push -u origin main
```

推送后到 GitHub 仓库 **Settings → Pages**：
- Source 选 **Deploy from a branch**
- Branch 选 **main** / 目录 **/ (root)**
- Save。约 1 分钟内站点上线（方案 B 还需等自定义域名 DNS 生效 + HTTPS 证书签发）。

---

## 日常「改完即同步云」工作流

```bash
cd /Users/jckuma/WorkBuddy/2026-08-03-15-24-29/clubos-deploy

# 改代码后（注意：发版请把 version.json.ver / boot.js 的 APP_VER / HTML 的 ?v= 一并 +1，
# 否则缓存自检不会触发刷新——见下方「缓存」）
git add -A
git commit -m "描述这次改了什么"
git push          # ← 这一推，GitHub Pages 自动重新发布，云端即更新
```

AI 助手（本会话）改完代码后，也会执行相同的 `git add -A && git commit && git push` 帮你同步。

---

## 缓存与版本自检（与 GitHub Pages 配合）

- GitHub Pages 默认给静态资源发 `Cache-Control: max-age=600` + `ETag`，比原 CloudStudio 沙盒
  （完全不发缓存头、靠浏览器启发式长期缓存）健康得多。
- 站内已有根治机制：`<head>` 内联脚本同步拉 `version.json?_=时间戳`（绕过缓存）作为权威版本，
  与 `APP_VER` 不一致即跳带时间戳 URL 强刷；只清宣发草稿 `xf`，不动业务数据。
- 因此**每次 push 后**：GitHub 自动部署（<1 分钟）→ 用户下次打开，自检发现 `version.json.ver`
  变化 → 自动刷新到最新。无需手动硬刷新（首次建议硬刷一次拉新 HTML）。
- 发版纪律：改任何 JS/CSS 并要用户立即看到，务必同步 +1 这三处：
  `version.json` 的 `ver`、各 `src/boot.js` 的 `APP_VER`、各 HTML 引用的 `?v=`。

---

## 回滚

```bash
git log --oneline          # 找到要回的提交哈希
git revert <hash>           # 或 git reset --hard <hash>
git push                   # 推回即云端回滚
```

---

## 备选更优托管（可选）

若 `github.io` 国内访问不理想，可把同一仓库接 **EdgeOne Pages / Vercel / CloudBase 静态托管**
（均支持连 Git 仓库、push 自动部署，且国内更快、缓存头更可控）。代码无需改动，
仅部署平台配置不同；本目录结构（含 `platform/` 子目录）可直接作为站点根发布。
