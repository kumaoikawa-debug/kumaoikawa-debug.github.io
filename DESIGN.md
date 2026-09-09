---
name: ClubOS
description: 把真实活动资料整理成有品牌感的户外编辑内容
colors:
  forest: "#2F5D50"
  forest-deep: "#244A40"
  paper: "#F7F4EE"
  surface: "#FFFFFF"
  ink: "#23211B"
  muted: "#807865"
  line: "#E7E1D6"
  ochre: "#C2873F"
typography:
  display:
    fontFamily: "Manrope, Noto Sans SC, system-ui, sans-serif"
    fontSize: "clamp(36px, 8vw, 42px)"
    fontWeight: 760
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Noto Sans SC, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.9
  editorial:
    fontFamily: "Noto Serif SC, Georgia, serif"
    fontSize: "31px"
    fontWeight: 700
    lineHeight: 1.22
rounded:
  xs: "9px"
  sm: "13px"
  md: "20px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "34px"
  section: "68px"
components:
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "12px 20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px 14px"
---

# Design System: ClubOS

## Overview

**Creative North Star: "户外编辑手记"**

ClubOS 的后台安静、清楚、可信，优先帮助运营人员核对事实；客户活动页则像一本由真实照片、现场数据和有节奏文字组成的户外杂志。它不靠大量卡片制造“功能感”，而靠图片尺度、文字层级、留白和事实建立专业感。

同一套系统允许不同活动拥有不同视觉世界：亲子温暖留白、城市清爽理性、高海拔深色克制、露营偏夜色与慢生活。变化来自内容和素材，不是随意换色。

**Key Characteristics:**

- 后台低干扰、事实优先。
- 前台大图、大字、长短段落交替。
- 信息模块按真实数据出现，没有数据就隐藏。
- 图片以完整叙事为先，避免同图重复和无意义装饰。

## Colors

森林绿承担产品识别，纸张米白和墨色建立户外出版物质感，赭石只用于少量强调。

**The Sparse Accent Rule.** 强调色用于行动、状态和关键数字，不把整页染成品牌色。

## Typography

无衬线字体承担后台操作、事实与数据；衬线字体只在前台故事标题和引言中出现，形成编辑感。

**The One Strong Sentence Rule.** 每个视觉段落只设置一个主要句子，其余文字退为正文或注释。

## Layout

后台使用固定侧栏和双栏编辑预览。活动页采用单列长页，段落间距以 58–72px 为主；图片可以全宽、偏移、双列错落或连续排列。手机端保留边缘到边缘图片，并把双列决策信息压成清晰的两列或单列。

**The Narrative Rhythm Rule.** 感性主张、视觉证据、事实判断和行动信息交替出现，不能连续堆叠同形卡片。

## Elevation & Depth

活动页默认扁平，以色面、分隔线和留白形成层级；阴影只留给后台浮层、按钮反馈和必要的悬浮操作。正文模块不使用层层悬浮卡片。

## Shapes

后台表单和按钮使用中等圆角；客户活动页的主图和正文图片以直角、满幅或轻微错位为主。胶囊仅用于简短状态和筛选，不用于大面积信息容器。

## Components

### Buttons

- 主按钮为森林绿实底，中等圆角，文字清楚直接。
- 次按钮使用浅表面或描边；按下只做轻微位移反馈。

### Cards / Containers

- 后台卡片用于明确的编辑任务和校验分组。
- 前台故事、行程、费用与机构资料优先用分隔线和留白，不套卡片。

### Inputs / Fields

- 白色底、低对比边框、中等圆角。
- 事实状态在字段附近表达：确认、待确认、缺失，不用装饰性图标代替文字。

### Signature Component

动态活动长页由主视觉、编辑引言、图片序列、记忆句、数据条和真实决策模块组成。活动类型决定阅读顺序，图片数量决定组合方式。

## Do's and Don'ts

### Do:

- **Do** 让标题、导语、海报和平台文案围绕同一个本场卖点。
- **Do** 只展示老板输入或明确确认的服务、年龄、领队、安全和费用信息。
- **Do** 根据照片质量、方向和主体位置选择封面及裁切焦点。
- **Do** 让不同活动类型拥有不同的阅读节奏和视觉气质。

### Don't:

- **Don't** 用固定的“自然探索、治愈、松弛感”模板覆盖所有活动。
- **Don't** 在没有真实数据时展示保险、资质、评价、视频或详细行程。
- **Don't** 重复使用同一张照片填满多个图片区块。
- **Don't** 把客户活动页重新做成后台 SaaS 卡片墙。
