# v204 · 上传活动方案（Word / PPT / PDF / 图片海报）→ 自动生成活动

老板原话：「我发一个活动方案 word、ppt、pdf 或者活动的图片、海报进去，然后系统就自动生成活动招募信息」。
落点：后台「第 1 步 / 描述活动」那一屏（`renderCreate`），在「活动描述」输入框**上方**新增一个拖拽上传区。

---

## 一、做了什么

| 层 | 文件 | 内容 |
|---|---|---|
| 解析 | **`src/intake.js`（新）** | 自研最小 ZIP 读取 + **纯 JS raw DEFLATE 解压** → docx 抽 `word/document.xml`、pptx 抽 `ppt/slides/*.xml`（按页序）+ 演讲备注；PDF 懒加载 pdf.js（3 个 CDN 回退）；文本类含 **GBK** 兜底 |
| 读图 | `src/vision.js` | 新增 `visionAsk()` / `visionReadPoster()` + `VISION_DOC_SYSTEM`（读海报文字，与「照片画像」是两套 prompt） |
| 整理 | `src/intake.js` | `intakeComposeDescription()`：有 AI → 交给模型整理成活动描述；**无 AI → 原样回填原文**，一个字都不加 |
| 编排 | `src/intake.js` | `intakeRunFiles(files)`：逐文件解析 → 合并 → 整理 → 回填描述 → **AI 可用时自动进生成流程** |
| UI | `src/activities.js` | `renderCreate` 加 `.intake-drop` 拖拽区 + `intakePanelHtml()` 逐文件结果面板 |
| 接线 | `src/shell.js` | `bindCreateExtras()` 绑定 `#createDocInput`（`onchange` 覆盖式）+ `ondragover/ondrop` + 刷新后自愈回填 |
| 样式 | `styles.css`（贴文件尾） | `.intake-*` 共 25 条规则，**全部在全局层（depth 0）**，未包进 `@media(max-width:480px)` |

### 支持矩阵

| 类型 | 处理方式 | 依赖 |
|---|---|---|
| `.docx` | 自研解压 → 抽段落/表格 | 无（零外链） |
| `.pptx` | 自研解压 → 按页序抽文字 + 备注 | 无（零外链） |
| `.pdf` | pdf.js 懒加载 | 3 个 CDN 依次回退 |
| `.txt / .md / .csv / .json` | UTF-8，失败回退 **GBK** | 无 |
| 图片（`.jpg/.png/.heic/…`） | 视觉 AI 读海报文字 | 需**直连**视觉 Key |
| `.doc / .ppt / .xls / Pages…` | **明确不支持** + 给出可执行建议（另存为 docx / 导出 PDF） | — |

**PDF / 图片读不出来时给的是替代方案**（截图后按图片上传 / 粘贴文字），不是一句「失败了」。

---

## 二、三条设计取舍（为什么这么做）

1. **方案文件与「活动照片」刻意分成两个 input。**
   方案只用来**读信息**；照片才作为配图。合并成一个入口的话，老板发一张满是文字的海报当方案，封面就变成那张海报。
   → `intakeRunFiles` 全程不碰 `state._pendingPhotos`（有断言守门）。

2. **不引第三方库（JSZip / pdf.js 除外）。**
   docx/pptx 走自研 ZIP + raw DEFLATE：不依赖 `DecompressionStream`（老浏览器也能用）、不依赖 CDN、可离线。
   PDF 是唯一没法规避的重活，所以只对它做懒加载 + 多源回退。

3. **默认「传完就自动生成」，但只在 AI 可用时自动。**
   符合老板原话的「然后系统就自动生成」；未配置 AI 时不擅自跳转（会弹「请先配置 AI 设置」），只回填描述 + 如实告知。

---

## 三、不虚构（承 v193 / v201 / v203）

- `INTAKE_SYSTEM` 硬规则第 1 条：**绝对不允许新增、推测、补全原文未出现的事实**；第 3 条：精确数字（日期/价格/名额/公里/海拔）**原样保留**（它们要进事实层）。
- 无 AI 时走 `intakeFallbackDescription()`：只做「清洗 + 截断」，**输出必是原文的连续子串**（有断言证明零新增字符）。
- 图片读不出 → 返回 `{text:"", reason:"人话原因"}`，绝不假装读到；UI 里红字照实写。
- 降级文案如实写「AI 整理没成功，已把原文直接填进描述（未做任何改写）」。

---

## 四、验收证据

### 1. 解析器字节级验证（开发期，Node + zlib 对照）
| 用例 | 结果 |
|---|---|
| inflate：10B / 500B / 5KB / 200KB × 压缩级别 1/6/9 | 全部与 `zlib.deflateRawSync` 输出**逐字节相同** |
| ZIP method=0（无压缩）条目 | ✅ |
| 真 `.docx`（Python zipfile 产出，含表格） | 标题/日期/价格/名额/集合时间/表格/XML 实体全部保真 |
| 真 `.pptx`（4 页乱序编号 1,2,10,3 + 备注） | 输出顺序 **1→2→3→10**（数字序，非字符串序） |

### 2. 契约测试 `case-v204-doc-intake.epilogue.js` — **83 项全绿**
内嵌**真实文件字节**（base64）端到端跑解析器，不靠 mock：
- §A 类型判定 9 项（含 `.doc` 旧格式的「另存为」建议、无扩展名时的 MIME 兜底）
- §B 解码清洗 6 项（★GBK 真字节 → 正确中文）
- §C ZIP/DEFLATE 7 项（含坏字节不抛、条目缺失诚实报错）
- §D 抽取保真 15 项（★表格同行、★页码数字序、备注、长度上限）
- §E 合并不编造 10 项（★回填是原文连续子串、prompt 守门）
- §F 渲染层 14 项（入口存在、两个 input 不共用、面板四态）
- §G 降级与接线 15 项（★读图只走直连如实写明、★`onchange` 覆盖绑定不用 `_bound`、模块自检）
- §H 不编造反例 5 项 + §I 幂等 2 项

### 3. 全量回归：**40 / 40 epilogue 全绿**

### 4. 真机（agent-browser + Chromium，本地 8794）
| 步骤 | 观察结果 |
|---|---|
| 进入「创建活动」 | 拖拽区 `710×134`，在首屏内可见；accept = `.txt,.md,.markdown,.csv,.docx,.pptx,.pdf,image/*` |
| 上传真 `.docx` | 面板 1 行「赵公山活动方案.docx 已读出 150 字」；描述框**自动填好且与整理结果逐字相同** |
| 未配 AI 时的提示 | 「未配置 AI：已把原文原样填进描述，没有做任何整理」 |
| **拖拽**（`.pptx` + 旧版 `.doc`） | `dragover` 高亮生效；pptx 读出 153 字（页码序 1,2,3,10 ✓）；`.doc` 红字如实说明需另存为 |
| 上传海报（无视觉 Key） | 红字「还没配置视觉 AI…或改用文档上传 / 手动粘贴文字」；`_pendingPhotos` 仍为 **0**（未污染配图） |
| 刷新页面后再进该屏 | 面板与描述框**一致**（自愈回填生效） |
| `window.onerror` / `unhandledrejection` | `errs = []`（全程无异常） |

---

## 五、备用路径（给用户的一句话）

- 想要**先看再生成**（不自动跳转）：把 `intakeRunFiles()` 末尾那段 `if (it.description && aiAuthMode()) { … generateFromInput(); }` 去掉即可，改成只 toast 提示。
- PDF 若在弱网下加载不到 pdf.js：界面会直接提示「把 PDF 截图后按图片上传」，不走死路。
- 后端代理模式（总平台）目前不开放读图 → 提示用户改用文档上传或粘贴文字（服务端 prompt 固定为照片画像，改不了）。
