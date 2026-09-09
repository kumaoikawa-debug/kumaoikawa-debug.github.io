# ClubOS C 端首页三模版设计规范（v91）

> 依据用户 2026-09-04 提供的 3 张参考截图制定：经典线路社 / 综合营地·研学 / 轻量社群。

## 1. 模版映射

| 模版 ID | 参考图 | 定位 | 情绪关键词 |
|---------|--------|------|-----------|
| `classic_route` | 图 1（松赞经典：雪山大 Hero + 搜索条 + 目的地宫格 + 会员礼金条） | 高端路线俱乐部 / 山地徒步 / 多日路线 | 沉浸、山河、经典、品质感 |
| `camp_study` | 图 2（疗愈森林 Hero + 横向分类胶囊 + 活动列表） | 营地教育 / 研学 / 身心疗愈 | 静谧、自然、课程、治愈 |
| `community` | 图 3（AI 搜索 + 社交 Feed 卡片 + 点赞） | 城市社群 / 运动打卡 / 社交拼团 | 年轻、社交、内容流、轻量 |

## 2. 公共基础

- 容器：`.front-body` 添加 `data-tpl="{template}"` / `class="tpl-{template}"`，所有样式通过 `data-tpl` 作用域隔离。
- 色彩：沿用品牌主色 `--brand #2F5D50`，仅在氛围渐变上按模版微调。
- 字体：标题 `--serif`，数字 `--display`，正文 sans-serif。
- 圆角：`--radius 18px`、`--radius-sm 14px`。
- 安全区：底部 tabbar 高 64px，front-body padding-bottom ≥ 82px。

## 3. 组件按模版差异

### 3.1 Banner / Hero

- **classic_route**：全屏 520px 沉浸式 Hero；搜索条置顶半透明；标题左下角大衬线字；底部 pagination dots。
- **camp_study**：全屏 480px 暗色森林/疗愈图；文字居中；带玻璃药丸按钮「开启疗愈之旅」。
- **community**：弱化 Hero，顶部只保留 AI 搜索条 + 紧凑 slogan；下方直接接 Feed。

### 3.2 Entry / 焦点入口

- **classic_route**：4 宫格圆角图标入口（徒步、露营、溯溪、亲子）。
- **camp_study**：横向滚动的图片胶囊分类（单日活动、多日活动、博物馆、在地推荐）。
- **community**：隐藏或改为 5 图标快捷条（首页 / 目的地 / 精选 / 轻奢小团 / 我的）。

### 3.3 Activities / 活动专区

- **classic_route**：Songzan 宫格（大图 + 双小图叠加），主打「目的地」。
- **camp_study**：两列 masonry 主题卡（卡片带课程标签、柔和阴影）。
- **community**：单列 Feed 卡片（大图 + 标题 + 发起人 + 点赞数）。

### 3.4 Member / 会员积分卡

- **classic_route**：横向会员礼金条（白底卡片 + 品牌红 CTA）。
- **camp_study**：居中权益卡（深绿渐变 + 白字）。
- **community**：最小化行内入口（头像 + 积分 + 权益链接）。

### 3.5 Brand / 品牌故事

- **classic_route**：底部品牌宣言 + 联系入口。
- **camp_study**：品牌理念短句 + 营地实景图。
- **community**：折叠为「关于我们」小卡片。

## 4. 响应式

- 手机优先 375–430px；桌面预览 ≤480px 居中。
- Hero 文字 ≤600px 时缩小 12%–15%。

## 5. 实现清单

- [ ] `core.js`：HOME_TEMPLATES 组件顺序与默认文案。
- [ ] `front.js`：renderComponent 注入 `data-tpl`。
- [ ] `styles.css`：`.tpl-*` 作用域样式追加。
- [ ] `decorate.js`：模版卡描述更新。
- [ ] HTML：缓存戳 v90→v91。
- [ ] Smoke + 部署。
