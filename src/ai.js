  const AI_SYSTEM_PROMPT = `你是一个户外俱乐部的内容主笔。你写的不是游记、不是百科、也不是机械的行程说明，而是一份「有销售转化能力的户外活动宣传内容」。

【最高原则：允许创造表达，不允许创造事实】
- 可以创造：标题、修辞、文字节奏、情绪、内容角度、表达方式、叙述顺序。
- 不可以创造：路线事实、领队行为、保险、餐食、交通、住宿、装备、现场设施、服务内容、时间节点、用户评价、安全保障、救援能力、活动结果、未确认的体验细节。
- 所有事实只能来自「已确认活动资料」。没提到的具体数字、场景、服务不要编；信息不足就写「以领队现场安排为准」「出发前群内通知」或留白。

【写作顺序（必须遵循消费者阅读决策，不要按路线时间机械展开）】
1. 为什么值得来（风景/场景/季节/地点价值，但不是百科介绍）
2. 来了会体验什么（真实参与感：运动/探索/挑战/互动/拍照/社交/亲子/户外技能，必须建立在真实活动形式之上）
3. 参加完能得到什么（身体/心理/成长/亲子/社交等收获，只取最真实匹配的 1—3 项）
4. 适不适合我（推荐人群/不建议人群/强度/年龄/经验）
5. 真实行程与费用（作为决策验证信息，不统治全文）

【绝对禁止】
- 口号式反问：想不想、要不要、你准备好了吗、还在等什么、难道不
- 模板动词：带你、一起浪、约起来、等你来、冲起来、搞起来
- 空洞形容词堆砌：炎炎夏日、清凉刺激、清澈、蜿蜒、速度与激情、后花园、绝美、无敌、超赞、治愈、松弛感拉满、breathtaking、诗与远方、风景优美、景色宜人、绝美秘境、不容错过
- 无事实兜底的安全感口号：装备齐全、保险无忧、专业护航、全程保障、安全放心
- 强行动召唤：赶紧报名、限时抢购、先到先得、手慢无
- 百科式开头：某山位于某省……（除非确实对用户决策有价值）
- 过度文学化：山风吹过灵魂。内容首先服务报名决策。
- 固定对比句式：禁止套用「前半段……你以为……；后半段……才……」。
- 虚构现场细节：小卖部、冰棍、某次领队动作、某位用户反应、某种未确认服务。

【怎么写出吸引力——靠具体，不靠夸张】
1. 用名词和动词写画面：不要写「风景很美」，写「天气好的时候，从高处可以看到成都平原慢慢铺开」。
2. 优先写用户「得到什么」「参与后改变」：不要写「6公里徒步路线」，写「对刚开始接触徒步的人，这次更像一次对自己体能的真实测试」；不要写「这是一场有意义的户外活动」，写「走完以后，你会更清楚自己能走多远、下一次可以挑战什么」。
3. 地点语料只作背景：地点数据库不能决定内容主题，更不能复制成百科正文。先想清楚「这场活动为什么值得卖」，再决定地点怎么用。
4. 动态章节标题：正文允许用 AI 自定的小标题（如「为什么值得专门来一次」「这一天下来，你会带走什么」），但必须克制，不堆砌文艺腔。
5. hook 用只有这场活动才有的事实/画面/悬念开头，一句话 20-45 字。
6. body 必须是一篇连贯长文：按上面的写作顺序展开，段与段之间有逻辑递进，不要各写一段再拼接；最后给决策信息。
7. marketingTitles 一次 5 个，像杂志专题标题一样短而完整，彼此明显不同（地点气质/季节体感/行动邀请/情绪画面/完成感）。严禁出现任何硬销信息：具体日期、人数限制、名额、价格、公里数、爬升米数、年龄、保险、集合时间、装备清单、报名/优惠/倒计时/仅限/只剩/只限等字样。标题表达的是「为什么想去」，不是「什么时候、多少人、多少钱」。
8. highlights 每条「事实+好处」；sellingPoints 必须 4—6 条且角度明显不同（如稀缺场景/真实体验/服务保障/季节时机/人群匹配/完成感），禁止互相近义或空泛堆砌，desc 写清为什么重要。

请始终只返回一个严格符合给定 JSON Schema 的对象，不要输出任何额外文字或 Markdown 代码块。`;


    const STRATEGY_PROMPT = `你是一个户外俱乐部的「内容策略师」。你不直接写文案，而是先判断这场活动到底为什么值得卖，再给主笔一份统一的传播策略。

【输入】俱乐部的真实活动资料（已确认事实）。

【你的任务】只做三件事，严格按 JSON 返回：
1. consumerValue（消费者价值分析）：这场活动对参与者真正的价值。
   - scenicValue：这个地方为什么值得去（风景/季节/地貌/视野/稀缺场景/与城市的差异）。地点只作背景，不要写成百科。
   - experienceValue：参加到底有什么意思（运动/探索/挑战/互动/拍照/社交/亲子/户外技能），必须建立在真实活动形式之上，禁止只写「好玩/刺激/治愈」。
   - participationValue：完成以后能得到什么（身体/心理/成长/亲子/社交，只取最真实匹配的 1—3 项）。
   - targetUser：最推荐的人群。
   - mainConcern：这类用户在报名前最担心什么。
   - mainSellingPoint：整场活动最该被记住的那一句话价值。
2. contentStrategy（核心传播主题）：
   - mainTheme：整场活动只能有一个主传播主题（景观型/季节型/体验型/挑战型/成长型/亲子型/社交型/城市逃离型/第一次型）。
   - secondaryTheme：最多一个辅助主题，可空。
   - mainSellingPoint：贯穿所有渠道的核心卖点句。
   - audienceInsight：对目标人群的一句洞察。
   - tone：整体语气（如：克制专业/轻快陪伴/诗意克制）。
3. narrativePlan（完整叙事计划，不写长文，只列要点）：
   - coreMessage：核心信息一句。
   - whyGo：为什么值得去（要点）。
   - whatExperience：体验什么（要点）。
   - whatGain：能得到什么（要点）。
   - decisionInfo：需要给用户的决策信息。
   - closingEmotion：收尾情绪。

【类型价值权重（仅内部判断，不要写进文案）】
徒步：景观 40% / 体验 30% / 成长 30%；亲子：景观 20% / 体验 35% / 成长 45%；露营：景观 35% / 体验 45% / 成长 20%；高海拔登山：景观 20% / 体验 30% / 成长挑战 50%；漂流水上：景观 20% / 体验 60% / 成长 20%。

【事实边界】只能依据输入中的已确认事实；缺什么就标 missing，不要编造。
请只返回一个严格符合 Schema 的 JSON 对象。`;

  async function aiStrategy(text) {
    const schema = [
      "{",
      " \"facts\": {\"activityName\":\"\",\"activityType\":\"\",\"place\":\"\",\"date\":\"\",\"season\":\"\",\"price\":0,\"limit\":0,\"limitUnit\":\"人\",\"ageRange\":\"\",\"audience\":\"\",\"distance\":0,\"elevation\":0,\"difficulty\":\"\",\"meeting\":\"\",\"meetTime\":\"\",\"returnTime\":\"\",\"includedServices\":[],\"gear\":[],\"transport\":\"\",\"meal\":\"\",\"insurance\":\"\",\"leader\":\"\",\"itinerary\":[],\"missing\":[]},",
      " \"consumerValue\": {\"scenicValue\":\"\",\"experienceValue\":\"\",\"participationValue\":\"\",\"targetUser\":\"\",\"mainConcern\":\"\",\"mainSellingPoint\":\"\"},",
      " \"contentStrategy\": {\"mainTheme\":\"\",\"secondaryTheme\":\"\",\"mainSellingPoint\":\"\",\"audienceInsight\":\"\",\"tone\":\"\"},",
      " \"narrativePlan\": {\"coreMessage\":\"\",\"whyGo\":\"\",\"whatExperience\":\"\",\"whatGain\":\"\",\"decisionInfo\":\"\",\"closingEmotion\":\"\"}",
      "}"
    ].join("\n");
    const userMsg = ["请分析以下真实活动资料，严格按 Schema 返回 JSON：", text, "JSON Schema:", schema].join("\n\n");
    try {
      return await clubLLM({ system: STRATEGY_PROMPT, user: userMsg, json: true, temperature: 0.4 });
    } catch (e) { console.error("AI 策略分析异常:", e); return null; }
  }

  async function aiNarrative(text, strategy) {
    const stratTxt = strategy ? JSON.stringify({ consumerValue: strategy.consumerValue, contentStrategy: strategy.contentStrategy, narrativePlan: strategy.narrativePlan }, null, 2) : "";
    const schema = [
      "{",
      " \"title\":\"活动标题\",",
      " \"subtitle\":\"副标题（一句话承接主题）\",",
      " \"marketingTitles\":[\"标题备选1\",\"标题备选2\",\"标题备选3\",\"标题备选4\",\"标题备选5\"],",
      " \"heroHook\":\"详情页 Hero 钩子，20-45字，用本场才有的事实/画面/悬念开头\",",
      " \"intro\":\"120-220字导语：先事实定位，再写本场才有的具体画面，最后给决策信息\",",
      " \"hook\":\"正文开场钩子（可与 heroHook 不同角度），20-45字\",",
      " \"body\":[\"连贯长文第1段：为什么值得去\",\"第2段：来了会体验什么\",\"第3段：参加完能得到什么\",\"第4段：决策信息（适合谁/费用/名额）\"],",
      " \"editorialTitle\":\"详情页故事区小标题（动态、克制，禁止套固定句式）\",",
      " \"posterTagline\":\"海报氛围标语，结合季节+时间+地点，16-36字\",",
      " \"pullQuote\":\"记忆句/金句，8-20字\",",
      " \"storyPurpose\":\"照片故事主题，8-20字\",",
      " \"photoCaptions\":[\"配文1\",\"配文2\"],",
      " \"sectionTitles\":{\"whyGo\":\"为什么值得去（动态标题）\",\"experience\":\"来了会体验什么（动态标题）\",\"gain\":\"参加完你能得到什么（动态标题）\"},",
      " \"whyGo\":\"为什么值得去的一段话（具体、有画面）\",",
      " \"experience\":\"来了会体验什么的一段话\",",
      " \"gain\":\"参加完能得到什么的一段话\",",
      " \"fitFor\":\"推荐人群（一句话）\",",
      " \"notFitFor\":\"不建议人群（一句话，可空）\",",
      " \"socialCoreMessage\":\"贯穿所有渠道的核心传播句\",",
      " \"highlights\":[{\"text\":\"事实+好处\",\"icon\":\"star\"}],",
      " \"sellingPoints\":[{\"title\":\"一句话卖点标题\",\"desc\":\"具体支撑：为什么这个点对用户重要\"}],",
      " \"gearAdvice\":[\"装备1\"],",
      " \"itineraryDays\":[{\"label\":\"行程\",\"sub\":\"\",\"items\":[{\"time\":\"08:00\",\"text\":\"集合\"}]}],",
      " \"missingFacts\":[\"缺集合地点\"],",
      " \"shareCopies\":{\"wechat\":\"\",\"moments\":\"\",\"xhs\":\"\",\"gzh\":\"\",\"voice\":\"\"}",
      "}"
    ].join("\n");
    const userMsg = ["【已确认活动资料】", text, "【内容策略（必须严格服从，所有渠道同一主主题）】", stratTxt, "请严格按 Schema 返回 JSON。要求：1) 必须返回 Schema 中所有字段，不得省略；2) 每个字段都必须有有效内容，禁止空字符串、null 或省略；3) 正文必须是一篇连贯长文，围绕上面的主传播主题展开，不得各写一段再拼接；4) 若某字段信息不足，可基于已确认事实合理推断，但字段必须存在且有内容。"].join("\n\n");
    try {
      return await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.7 });
    } catch (e) { console.error("AI 叙事生成异常:", e); return null; }
  }

  function buildFactsText(a) {
    const f = [];
    if (a.title) f.push("活动名称：" + a.title);
    if (a.type) f.push("活动类型：" + a.type);
    if (a.place) f.push("地点：" + a.place);
    if (a.date || a.dateMD) f.push("日期：" + (a.dateMD || a.date));
    if (a.days > 1) f.push("天数：" + a.days);
    if (a.price != null) f.push("价格：" + a.price + "/" + (a.limitUnit || "人"));
    if (a.limit) f.push("名额：" + a.limit + (a.limitUnit || "人"));
    if (a.ageRange) f.push("适合年龄：" + a.ageRange);
    if (a.audience && a.audience.length) f.push("人群：" + a.audience.join("/"));
    if (a.distance != null) f.push("距离：" + a.distance + "KM");
    if (a.elevation) f.push("海拔：" + a.elevation + "米");
    if (a.difficulty) f.push("难度：" + a.difficulty);
    if (a.meeting) f.push("集合：" + a.meeting + (a.meetTime ? " " + a.meetTime : ""));
    if (a.returnTime) f.push("返回：" + a.returnTime);
    const inc = a.feeInclude || []; if (inc.length) f.push("包含：" + inc.join("、"));
    if (a.gear && a.gear.length) f.push("装备：" + a.gear.map(function(g){return g.name;}).join("、"));
    if (a.itineraryDays && a.itineraryDays.length) {
      const its = a.itineraryDays.map(function(d){ return (d.label || "") + "：" + (d.items || []).map(function(t){return t.time + " " + t.text;}).join("；"); }).join(" | ");
      if (its) f.push("行程：" + its);
    }
    if (a.leaderName) f.push("领队：" + a.leaderName + (a.leaderYears ? ("（" + a.leaderYears + "）") : ""));
    if (a.raw) f.push("原始资料：\n" + a.raw);
    return f.join("\n");
  }

  function contentConsistencyCheck(a) {
    const score = { readability: 0, attractiveness: 0, specificity: 0, consistency: 0, conversionValue: 0, factSafety: 0 };
    const notes = [];
    const prose = [a.intro, a.hook, (a.body || []).join(" "), (a.highlights || []).map(function(h){return h[0];}).join(" "), a.gain, a.experience, a.whyGo].filter(Boolean).join(" ");
    const fab = /(小卖部|冰棍|领队.*?(演示|说)|某次|往期|去年|上次)/.test(prose);
    score.factSafety = fab ? 1 : 5;
    if (fab) notes.push("检测到疑似虚构现场细节，请核对事实。");
    const hollow = /(绝美|无敌|超赞|治愈|松弛感|诗与远方|风景优美|景色宜人|不容错过|清凉刺激|速度与激情|breathtaking)/g;
    const hollowN = (prose.match(hollow) || []).length;
    score.specificity = hollowN === 0 ? 5 : Math.max(1, 5 - hollowN);
    if (hollowN >= 2) notes.push("文案出现较多空洞形容词，建议换具体描述。");
    const theme = a.contentPlan && a.contentPlan.contentStrategy && a.contentPlan.contentStrategy.mainTheme;
    score.consistency = theme ? 5 : 2;
    const ans = [ !!(a.whyGo || /为什么|值得/.test(prose)), !!(a.experience || /体验|参与|挑战/.test(prose)), !!(a.gain || /得到|收获|成长/.test(prose)) ].filter(Boolean).length;
    score.conversionValue = ans >= 2 ? 5 : (ans === 1 ? 3 : 1);
    if (ans < 2) notes.push("内容未充分回答「为什么值得去 / 好不好玩 / 能得到什么」。");
    const paras = (a.body || []).filter(Boolean);
    const dup = paras.length ? paras.some(function(p, i){ return paras.indexOf(p) !== i; }) : false;
    score.readability = (paras.length >= 3 && !dup) ? 5 : (paras.length ? 3 : 1);
    score.attractiveness = (a.hook && a.hook.length >= 15 && a.pullQuote) ? 5 : 3;
    return { score: score, notice: notes.join(" ") };
  }


  async function parseActivityWithAI(inputText) {
    if (!aiAuthMode()) return { _needKey: true, raw: inputText };
    const strategy = await aiStrategy(inputText);
    if (!strategy) return { _error: "策略分析失败", raw: inputText };
    const content = await aiNarrative(inputText, strategy);
    if (!content) return { _error: "内容生成失败", raw: inputText };
    // 合并：事实来自策略层（facts），正文来自叙事层；详情页渲染只需最终活动字段
    const merged = Object.assign({}, strategy.facts || {}, content);
    merged._raw = inputText;
    merged._contentPlan = {
      consumerValue: strategy.consumerValue || {},
      contentStrategy: strategy.contentStrategy || {},
      narrativePlan: strategy.narrativePlan || {}
    };
    return merged;
  }

  // 标题清洗：过滤掉带硬销/硬数据的标题（日期、人数、价格、公里、时间、保险、年龄、名额、报名、优惠、倒计时、只限/仅剩等）
  function sanitizeMarketingTitle(t) {
    const s = String(t || "").trim();
    if (!s) return "";
    // 含日期、时间、人数、价格、公里/米、年龄、保险、装备、名额、报名、优惠、倒计时、仅/只/剩/限等硬销字样
    const banned = /\d{1,2}月\d{1,2}[日号]?|\d{1,2}[日号]|周[一二三四五六日]|周六|周日|周末|星期[一二三四五六日]|仅\d+|只[限给]\d+|仅剩\d+|只剩\d+|限\d+|名额|\d+元|\d+折|\d+[\.\d]*公里|\d+KM|\d+km|\d+米|\d+m|保险|费用|报名费|报名|早鸟|优惠|立减|原价|现价|抢购|倒计时|最后一天|即将截止|满\d+减\d+|集合|装备|年龄|适合\d+|不建议\d+|只给|留了位置|还剩|剩\d+|限位|余位/;
    if (banned.test(s)) return "";
    // 太短的纯标签也过滤
    if (s.length < 5) return "";
    return s;
  }

  // 标题去重：先清洗，再去掉完全相同/互相包含的近义包装
  function dedupeTitles(titles) {
    const norm = (s) => String(s || "").trim().replace(/[\s，。、：:·\-—_]+/g, "");
    const out = [];
    for (const t of titles) {
      const clean = sanitizeMarketingTitle(t);
      if (!clean) continue;
      const tn = norm(clean);
      if (!tn) continue;
      const dup = out.some((o) => { const on = norm(o); return on === tn || on.includes(tn) || tn.includes(on); });
      if (!dup) out.push(clean);
    }
    return out;
  }
  // 标题数量不足时用本地方向库补齐，保证明显不同且数量足够
  function fillTitlesFromPool(titles, a) {
    const pool = directionPoolFor(a).map((d) => sanitizeMarketingTitle(d.headline)).filter(Boolean);
    const have = new Set(titles.map((t) => String(t).trim().replace(/[\s，。、：:·\-—_]+/g, "")));
    for (const h of pool) {
      if (titles.length >= 5) break;
      const hn = String(h).trim().replace(/[\s，。、：:·\-—_]+/g, "");
      if (!have.has(hn)) { titles.push(h.trim()); have.add(hn); }
    }
    return titles;
  }

  // —— 难度字段清洗：AI 在缺字段时常按提示词返回字面 "missing"，必须过滤，否则详情页会显示 missing ——
  const DIFFICULTY_VALID = ["轻松", "适中", "进阶", "挑战", "专业"];
  function cleanDifficulty(d) {
    if (d == null) return "";
    d = String(d).trim();
    if (/^missing$/i.test(d) || d === "待确认" || d === "待机构确认" || d === "未知" || d.length > 6) return "";
    if (DIFFICULTY_VALID.includes(d)) return d;
    const map = { "简单": "轻松", "简易": "轻松", "易": "轻松", "中等": "适中", "中强度": "适中", "中等强度": "适中", "困难": "挑战", "较难": "挑战", "难": "挑战", "进阶段": "进阶", "进阶难度": "进阶" };
    return map[d] || "";
  }

  // 把 LLM JSON 映射到 state.activity，保持详情页渲染所需的字段形态
  function applyAIResult(json, base) {
    const a = base || blankActivity();
    a.raw = json._raw || a.raw || "";
    if (json.title) a.title = json.title;
    if (Array.isArray(json.marketingTitles) && json.marketingTitles.length) {
      let mt = dedupeTitles(json.marketingTitles);
      mt = fillTitlesFromPool(mt, a);
      a.forewordTitles = mt;
      const first = mt[0] || json.title || a.title || "";
      a.titleVariants = { brand: first, info: first, wechat: first, xhs: first, moments: first };
      if (!a.title) a.title = first;
    }
    if (Array.isArray(json.contentDirections) && json.contentDirections.length) {
      a.contentDirections = json.contentDirections.slice(0, 3).map((d, i) => ({
        name: String(d.name || `方向 ${i + 1}`),
        headline: String(d.headline || ""),
        reason: String(d.reason || ""),
        intro: String(d.intro || ""),
        posterLine: String(d.posterLine || d.poster_line || "")
      }));
      a.contentDirection = 0;
      a.contentStrategy = a.contentDirections[0];
    }
    if (!a.contentDirections.length && Array.isArray(a.forewordTitles) && a.forewordTitles.length) {
      const facts = [a.distance ? `${a.distance}公里` : "", a.ageRange || "", a.days > 1 ? `${a.days}天` : "", a.limit ? `${a.limit}${a.limitUnit}` : ""].filter(Boolean);
      a.contentDirections = a.forewordTitles.slice(0, 3).map((headline, i) => ({
        name: ["主表达", "场景感", "招募感"][i] || `方向 ${i + 1}`,
        headline,
        reason: facts.length ? `基于本场已确认的${facts.slice(0, 2).join("、")}来组织表达。` : "基于老板提供的活动信息组织表达。",
        intro: a.intro || "",
        posterLine: a.posterTagline || ""
      }));
      a.contentDirection = 0;
      a.contentStrategy = a.contentDirections[0];
    }
    if (json.type) a.type = json.type;
    if (json.place) a.place = json.place;
    if (json.days) a.days = +json.days;
    if (json.startDate || json.date) { const d = json.startDate || json.date; a.date = d; a.dateMD = toDateMD(d); }
    if (json.price != null) a.price = +json.price;
    if (json.meeting) a.meeting = json.meeting;
    if (json.meetTime) a.meetTime = json.meetTime;
    if (json.returnTime) a.returnTime = json.returnTime;
    if (json.transport) a.transport = json.transport;
    if (json.leader) a.leaderName = json.leader;
    // 首次 AI 生成时，把日期/价格同步为默认团期
    if (a.date && (!a.departures || !a.departures.length)) {
      const d = departureFromDate(a.date, a.price);
      if (d) a.departures = [d];
    } else if (a.departures && a.departures.length && json.price != null) {
      a.departures.forEach((d) => { if (d.price == null) d.price = a.price; });
    }
    if (json.limit != null) a.limit = +json.limit;
    if (json.limitUnit) a.limitUnit = json.limitUnit;
    if (json.ageRange) { a.ageRange = json.ageRange; const mm = String(json.ageRange).match(/(\d{1,2})\s*[-—~至到]\s*(\d{1,2})/); if (mm) { a.ageFrom = +mm[1]; a.ageTo = +mm[2]; } }
    if (json.distance != null) a.distance = +json.distance;
    if (json.elevation != null) a.elevation = +json.elevation;
    // 难度：AI 缺字段会返回 "missing"，清洗后无效则归「待确认」，避免详情页渲染字面 missing
    if (json.difficulty != null) {
      const cd = cleanDifficulty(json.difficulty);
      a.difficulty = cd || "待确认";
    }
    if (Array.isArray(json.includedServices)) {
      a.included = json.includedServices.slice();
      a.feeInclude = json.includedServices.slice();
      a.includeLeader = json.includedServices.some((s) => /领队|向导|教练|带队/.test(s));
      a.includeMeal = json.includedServices.some((s) => /餐|食|午饭|午餐/.test(s));
      a.includeInsurance = json.includedServices.some((s) => /保险/.test(s));
      a.includeTransport = json.includedServices.some((s) => /交通|车|接送/.test(s));
      a.includeGear = json.includedServices.some((s) => /装备/.test(s));
    }
    if (json.intro) a.intro = json.intro;
    if (json.hook) a.hook = json.hook;
    if (Array.isArray(json.body)) a.body = json.body.filter(Boolean);
    if (Array.isArray(json.sellingPoints)) a.sellingPoints = json.sellingPoints.map((s) => ({ title: String((s && (s.title || s.text || (typeof s === "string" ? s : ""))) || ""), desc: String((s && s.desc) || "") }));
    if (json.editorialTitle) a.editorialTitle = json.editorialTitle;
    if (json.posterTagline) a.posterTagline = json.posterTagline;
    if (json.pullQuote) a.pullQuote = json.pullQuote;
    if (json.storyPurpose) a.storyPurpose = json.storyPurpose;
    if (Array.isArray(json.photoCaptions)) a.photoCaptions = json.photoCaptions.filter(Boolean);
    if (Array.isArray(json.highlights)) a.highlights = json.highlights.map((h) => {
      if (Array.isArray(h)) return [String(h[0] || ""), String(h[1] || "star")];
      if (h && typeof h === "object") return [String(h.text || h.title || ""), String(h.icon || "star")];
      return [String(h || ""), "star"];
    });
    if (Array.isArray(json.gearAdvice)) a.gear = json.gearAdvice.map((n) => ({ name: n, must: true }));
    if (Array.isArray(json.itineraryDays)) a.itineraryDays = json.itineraryDays;
    if (Array.isArray(json.missingFacts)) a.missingFacts = json.missingFacts;
    if (json.shareCopies && typeof json.shareCopies === "object") {
      a.shareWechat = json.shareCopies.wechat || "";
      a.shareMoments = json.shareCopies.moments || "";
      a.shareXhs = json.shareCopies.xhs || "";
      a.shareGzh = json.shareCopies.gzh || "";
      a.shareVoice = json.shareCopies.voice || "";
    }
    // 新架构：消费者价值 / 核心传播主题 / 叙事计划（来自策略层）+ 新版叙事字段
    if (json._contentPlan) a.contentPlan = json._contentPlan;
    if (a.contentPlan && a.contentPlan.contentStrategy) {
      const cs = a.contentPlan.contentStrategy;
      const cv = a.contentPlan.consumerValue || {};
      a.contentStrategy = {
        name: cs.mainTheme || (a.contentDirections[0] && a.contentDirections[0].name) || "主表达",
        headline: cs.mainSellingPoint || (a.contentDirections[0] && a.contentDirections[0].headline) || a.title,
        reason: cs.audienceInsight || "",
        intro: cv.mainSellingPoint || a.intro || "",
        posterLine: a.posterTagline || ""
      };
    }
    if (json.subtitle) a.subtitle = json.subtitle;
    if (json.heroHook) a.heroHook = json.heroHook;
    if (json.sectionTitles && typeof json.sectionTitles === "object") a.sectionTitles = json.sectionTitles;
    if (json.whyGo) a.whyGo = json.whyGo;
    if (json.experience) a.experience = json.experience;
    if (json.gain) a.gain = json.gain;
    if (json.fitFor) a.fitFor = json.fitFor;
    if (json.notFitFor) a.notFitFor = json.notFitFor;
    if (json.socialCoreMessage) a.socialCoreMessage = json.socialCoreMessage;
    // 构造详情页渲染所需的 pipeline 形态（卖点 + 出行须知），渲染器无需改动
    a.pipeline = {
      foreword: { titles: a.forewordTitles || [], intro: a.intro || "" },
      sellingPoints: ((json.sellingPoints && json.sellingPoints.length) ? json.sellingPoints : (json.highlights || [])).map((s) => ({ title: String((s && (s.title || s.text || (typeof s === "string" ? s : ""))) || ""), desc: String((s && s.desc) || "") })),
      itinerary: { days: a.days || 1 },
      details: {
        refund: ["出发前 7 天以上取消，全额退款。", "出发前 3—7 天取消，扣除 30% 费用。", "出发前 3 天内取消，费用不退，可协商转让名额。"],
        altitude: (a.elevation && +a.elevation >= 3500) ? ["本路线目标海拔约 " + a.elevation + " 米，请提前做好高反预防。"] : [],
        missing: Array.isArray(json.missingFacts) ? json.missingFacts : [],
        must: json.gearAdvice || [],
        suggest: []
      }
    };
    a.missing = [];
    syncItineraryDays(a);
    // 开场钩子模板化检测：命中固定对比句式则提示用户重新生成
    a.aiNotice = (a.hook && /你以为|前半段|后半段/.test(a.hook)) ? "开场钩子疑似套用固定句式，建议点「重新生成」换一版。" : "";
    // 新架构：内容一致性检查 + 评分（规则引擎，不额外消耗 AI）
    const chk = contentConsistencyCheck(a);
    a.contentScore = chk.score;
    if (chk.notice) a.aiNotice = a.aiNotice ? a.aiNotice + " " + chk.notice : chk.notice;
    return a;
  }

  // 已有一个 draft 时，调用 LLM 基于现有事实重新生成文案（不重解析事实）
    async function regenerateCopy(a) {
    if (!a) return false;
    if (!aiAuthMode()) return false;
    const factsText = buildFactsText(a);
    const hasPlan = a.contentPlan && a.contentPlan.contentStrategy && a.contentPlan.contentStrategy.mainTheme;
    const strategy = hasPlan ? a.contentPlan : await aiStrategy(factsText);
    if (!strategy) return false;
    const content = await aiNarrative(factsText, strategy);
    if (!content) return false;
    content._raw = a.raw;
    content._contentPlan = { consumerValue: strategy.consumerValue || {}, contentStrategy: strategy.contentStrategy || {}, narrativePlan: strategy.narrativePlan || {} };
    applyAIResult(content, a);
    await ensureNarrativeFields(a);
    await ensureItineraryFields(a);
    syncItineraryDays(a);
    return true;
  }

  // 兜底：若 AI 首次返回的叙事字段有空缺，用一次有针对性的补全调用填满，不再让编辑区留白
  async function ensureNarrativeFields(a) {
    if (!a) return false;
    const need = [];
    if (!a.intro) need.push("intro");
    if (!a.hook) need.push("hook");
    if (!Array.isArray(a.body) || !a.body.length) need.push("body");
    if (!a.whyGo) need.push("whyGo");
    if (!a.experience) need.push("experience");
    if (!a.gain) need.push("gain");
    if (!a.fitFor) need.push("fitFor");
    if (!a.notFitFor) need.push("notFitFor");
    if (!a.editorialTitle) need.push("editorialTitle");
    if (!a.pullQuote) need.push("pullQuote");
    if (!a.posterTagline) need.push("posterTagline");
    if (!a.storyPurpose) need.push("storyPurpose");
    if (!Array.isArray(a.photoCaptions) || !a.photoCaptions.length) need.push("photoCaptions");
    if (!a.sectionTitles || !a.sectionTitles.whyGo) need.push("sectionTitles");
    if (!need.length) return true;
    if (!aiAuthMode()) return false;
    const factsText = buildFactsText(a);
    const stratTxt = a.contentPlan ? JSON.stringify(a.contentPlan, null, 2) : "";
    const schemaParts = need.map((f) => {
      switch (f) {
        case "intro": return "\"intro\":\"120-220字导语\"";
        case "hook": return "\"hook\":\"20-45字开场钩子\"";
        case "body": return "\"body\":[\"第1段：为什么值得去\",\"第2段：来了会体验什么\",\"第3段：参加完能得到什么\",\"第4段：决策信息\"]";
        case "whyGo": return "\"whyGo\":\"为什么值得去的一段话\"";
        case "experience": return "\"experience\":\"来了会体验什么的一段话\"";
        case "gain": return "\"gain\":\"参加完能得到什么的一段话\"";
        case "fitFor": return "\"fitFor\":\"推荐人群\"";
        case "notFitFor": return "\"notFitFor\":\"不建议人群\"";
        case "editorialTitle": return "\"editorialTitle\":\"故事区小标题\"";
        case "pullQuote": return "\"pullQuote\":\"记忆句/金句\"";
        case "posterTagline": return "\"posterTagline\":\"海报氛围标语\"";
        case "storyPurpose": return "\"storyPurpose\":\"照片故事主题\"";
        case "photoCaptions": return "\"photoCaptions\":[\"配文1\",\"配文2\"]";
        case "sectionTitles": return "\"sectionTitles\":{\"whyGo\":\"章节标题\",\"experience\":\"章节标题\",\"gain\":\"章节标题\"}";
      }
      return "";
    });
    const schema = `{ ${schemaParts.join(", ")} }`;
    const userMsg = `已有活动事实：${factsText}\n\n${stratTxt ? "内容策略：\n" + stratTxt + "\n\n" : ""}请严格补全以下空缺字段，每个字段都必须有有效内容，禁止空字符串或省略：${need.join("、")}。\n\n严格只返回如下 JSON：\n${schema}`;
    try {
      const json = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.7 });
      if (!json) return false;
      if (json.intro) a.intro = json.intro;
      if (json.hook) a.hook = json.hook;
      if (Array.isArray(json.body)) a.body = json.body.filter(Boolean);
      if (json.whyGo) a.whyGo = json.whyGo;
      if (json.experience) a.experience = json.experience;
      if (json.gain) a.gain = json.gain;
      if (json.fitFor) a.fitFor = json.fitFor;
      if (json.notFitFor) a.notFitFor = json.notFitFor;
      if (json.editorialTitle) a.editorialTitle = json.editorialTitle;
      if (json.pullQuote) a.pullQuote = json.pullQuote;
      if (json.posterTagline) a.posterTagline = json.posterTagline;
      if (json.storyPurpose) a.storyPurpose = json.storyPurpose;
      if (Array.isArray(json.photoCaptions)) a.photoCaptions = json.photoCaptions.filter(Boolean);
      if (json.sectionTitles && typeof json.sectionTitles === "object") a.sectionTitles = Object.assign(a.sectionTitles || {}, json.sectionTitles);
      return true;
    } catch (e) { console.error("补全叙事字段异常:", e); return false; }
  }

  // 为活动生成真实可执行的日程安排；只基于已确认事实，不编造服务/设施/领队行为
  async function generateItinerary(a) {
    if (!a) return false;
    if (!aiAuthMode()) return { _needKey: true };
    if (aiBalance() < AI_COST_PER_CALL) return { _noCredit: true };
    const days = Math.max(1, a.days || 1);
    const baseDate = parseDateBase(a.date || a.dateMD || "");
    const dateSub = (offset) => {
      if (!baseDate) return "";
      const d = addDays(baseDate, offset);
      return `${d.getMonth() + 1}月${d.getDate()}日`;
    };
    const factsText = buildFactsText(a);
    const schema = [
      "{",
      `  "itineraryDays": [`,
      `    {"label": "${days > 1 ? "第 1 天" : "行程安排"}", "sub": "${dateSub(0)}", "items": [{"time": "08:00", "text": "集合出发"}, {"time": "12:00", "text": "途中简餐（以现场安排为准）"}]}` + (days > 1 ? "," : ""),
      (days > 1 ? `    {"label": "第 2 天", "sub": "${dateSub(1)}", "items": [{"time": "08:00", "text": "继续行程"}, {"time": "16:00", "text": "解散返程"}]}` : ""),
      `  ]`,
      "}"
    ].join("\n");
    const userMsg = `请为以下户外活动生成详细行程。\n\n【最高原则】\n- 必须严格依据已确认事实；未确认的具体时间、服务内容、设施、餐厅、领队动作不要编造。\n- 没有具体时间时，用“以领队现场安排为准”占位，不要写“专业护航”“全程保障”等无法验证的口号。\n- 总天数 ${days} 天，每天 4-8 个时间节点，时间段用 24 小时制（如 08:00）。\n\n已确认活动事实：\n${factsText}\n\n严格只返回如下 JSON Schema，不要输出任何额外文字或 Markdown：\n${schema}`;
    try {
      const json = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.6 });
      if (!json || !Array.isArray(json.itineraryDays)) return false;
      const out = [];
      for (let i = 0; i < days; i++) {
        const src = json.itineraryDays[i] || {};
        const items = (src.items || [])
          .map((it) => ({ time: String(it.time || "").trim(), text: String(it.text || "").trim() }))
          .filter((it) => it.time || it.text);
        out.push({
          label: String(src.label || (days > 1 ? `第 ${i + 1} 天` : "行程安排")).trim(),
          sub: String(src.sub || dateSub(i)).trim(),
          items: items.length ? items : [{ time: "", text: "行程待补充" }]
        });
      }
      if (!out.some((d) => d.items.some((it) => it.text && it.text !== "行程待补充"))) return false;
      a.itineraryDays = out;
      syncItineraryDays(a);
      consumeAi(AI_COST_PER_CALL, "AI 生成 · 行程");
      return true;
    } catch (e) { console.error("行程生成异常:", e); return false; }
  }

  // 兜底：若当前没有有效行程，自动调用 generateItinerary 补全
  async function ensureItineraryFields(a) {
    if (!a) return false;
    const hasItin = (a.itineraryDays || []).some((d) => (d.items || []).some((t) => t && (t.time || t.text)));
    if (hasItin) return true;
    return await generateItinerary(a);
  }

  const REGEN_FIELDS = {
    posterTagline: { label: "海报氛围标语", kind: "text", rule: "海报主标题下方的氛围标语。结合季节+时间+地点，16-36字，有户外向往感，不出现公里/价格/保险/年龄/人数等硬数据" },
    editorialTitle: { label: "故事区小标题", kind: "text", rule: "详情页故事区小标题（H2）。根据本次活动事实独创，禁止套用固定句式" },
    pullQuote: { label: "记忆句/金句", kind: "text", rule: "一句能让人记住的具体画面或判断，8-20字，不喊口号" },
    storyPurpose: { label: "照片故事主题", kind: "text", rule: "一句话说明这组照片应该呈现什么，8-20字，紧扣本次活动" },
    hook: { label: "开场钩子", kind: "text", rule: "详情页正文开场钩子，一句话（20-45字）。用只有这场活动才有的具体事实/画面/悬念开头，禁止口号/反问/想不想/空洞形容词" },
    intro: { label: "活动介绍/导语", kind: "text", rule: "120-200字。2-3个短段落：先事实定位，再写本场才有的具体画面，最后给决策信息。有吸引力但不油腻，禁止口号/反问/形容词堆砌" },
    photoCaptions: { label: "照片配文", kind: "list", rule: "每张照片一句配文，8-16字，紧扣场景" },
    body: { label: "正文段落", kind: "list", rule: "每段60-140字，用具体名词和动词写真实体验（出发准备/途中画面/某个细节），禁止形容词堆砌" },
    forewordTitles: { label: "标题备选", kind: "list", rule: "一次性给出 5 个像杂志专题一样的短标题，彼此必须明显不同（从不同角度切入：地点气质 / 季节体感 / 行动邀请 / 情绪画面 / 完成感），禁止只是换近义词或调整语序。严禁出现任何硬销信息：具体日期、人数限制、名额、价格、公里数、爬升米数、年龄、保险、集合时间、装备清单、报名/优惠/倒计时/仅限/只剩/只限等字样" }
  };
  function seasonOf(a) {
    const md = a.dateMD || "";
    const m = md.match(/(\d{1,2})月/);
    const mo = m ? +m[1] : (new Date().getMonth() + 1);
    if (mo >= 3 && mo <= 5) return "春季";
    if (mo >= 6 && mo <= 8) return "夏季";
    if (mo >= 9 && mo <= 11) return "秋季";
    return "冬季";
  }
  async function regenField(a, field) {
    if (!a || !REGEN_FIELDS[field]) return false;
    if (!aiAuthMode()) return { _needKey: true };
    // V2.0：先校验 AI 积分余额（不显 Token，只按「AI 积分」计量）
    if (aiBalance() < AI_COST_PER_CALL) return { _noCredit: true };
    const def = REGEN_FIELDS[field];
    const current = a[field];
    const ctx = {
      title: a.title, type: a.type, place: a.place, dateMD: a.dateMD,
      season: seasonOf(a), days: a.days, difficulty: a.difficulty,
      ageRange: a.ageRange, distance: a.distance, elevation: a.elevation
    };
    const isList = def.kind === "list";
    const cnt = isList ? (field === "forewordTitles" ? 5 : (Array.isArray(current) ? current.length : (field === "photoCaptions" ? (a.photos ? a.photos.length : 3) : 3))) : 0;
    const schemaItems = Array.from({ length: Math.max(cnt, 3) }, (_, i) => `"${def.label}${i + 1}"`).join(",");
    const schemaField = isList
      ? `{ "${field}": [${schemaItems}] }`
      : `{ "${field}": "${def.label}（${def.rule}）" }`;
    const currentRef = isList
      ? `当前已有版本（仅供参考，请勿重复，需全新角度）：${JSON.stringify(Array.isArray(current) ? current : [])}`
      : `当前已有版本（仅供参考，请勿重复，需全新角度）：${typeof current === "string" ? current : ""}`;
    const userMsg = `已有活动事实：${JSON.stringify(ctx)}\n\n请只重新生成「${def.label}」这一项。要求：${def.rule}。${currentRef}\n\n严格只返回如下 JSON Schema 中的一个字段：\n${schemaField}`;
    try {
      const json = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.85 });
      if (json == null) return false;
      if (isList) {
        if (Array.isArray(json[field]) && json[field].length) a[field] = json[field].filter(Boolean);
        else return false;
      } else {
        if (!json[field]) return false;
        a[field] = json[field];
      }
      if (field === "forewordTitles") {
        a[field] = fillTitlesFromPool(dedupeTitles(a[field]), a);
        const first = a[field][0] || a.title || "";
        a.titleVariants = { brand: first, info: first, wechat: first, xhs: first, moments: first };
      }
      consumeAi(AI_COST_PER_CALL, `AI 重写 · ${def.label}`);
      return true;
    } catch (e) { console.error("字段重生成异常:", e); return false; }
  }

  // 单个卖点重生成：只重写某一条 sellingPoint，要求与现有角度不同
  async function regenSellingPoint(a, idx) {
    if (!a || !Array.isArray(a.sellingPoints) || a.sellingPoints[idx] == null) return false;
    if (!aiAuthMode()) return { _needKey: true };
    if (aiBalance() < AI_COST_PER_CALL) return { _noCredit: true };
    const ctx = {
      title: a.title, type: a.type, place: a.place, dateMD: a.dateMD,
      season: seasonOf(a), days: a.days, difficulty: a.difficulty,
      ageRange: a.ageRange, distance: a.distance, elevation: a.elevation,
      meeting: a.meeting, meetTime: a.meetTime, price: a.price
    };
    const existing = a.sellingPoints.map((s, i) => (i === idx ? null : `${s.title || ""}｜${s.desc || ""}`)).filter(Boolean);
    const current = a.sellingPoints[idx];
    const userMsg = `已有活动事实：${JSON.stringify(ctx)}\n\n现有卖点（禁止重复或近义）：${existing.join("；") || "无"}\n\n请只重新生成第 ${idx + 1} 条卖点。要求：\n1. title 一句话事实点（8-20字），不要空泛形容词；\n2. desc 写清为什么这个点对用户重要（30-60字）；\n3. 必须与上面「现有卖点」角度明显不同；\n4. 从稀缺场景 / 真实体验 / 服务保障 / 季节时机 / 人群匹配 / 完成感 中任选一个不重复的角度。\n\n严格只返回如下 JSON Schema：\n{ "title": "卖点标题", "desc": "卖点描述" }`;
    try {
      const json = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.85 });
      if (json == null) return false;
      const title = String((json.title || json.sellingPointTitle || (typeof json === "string" ? json : "")) || "").trim();
      const desc = String((json.desc || json.sellingPointDesc || json.description || "") || "").trim();
      if (!title) return false;
      a.sellingPoints[idx] = { title, desc };
      // 同步 pipeline 形态
      a.pipeline = a.pipeline || { foreword: { titles: [] }, itinerary: { days: 1 }, details: {} };
      a.pipeline.sellingPoints = a.sellingPoints.map((s) => ({ title: String(s.title || ""), desc: String(s.desc || "") }));
      consumeAi(AI_COST_PER_CALL, "AI 重写 · 卖点");
      return true;
    } catch (e) { console.error("卖点重生成异常:", e); return false; }
  }

  // 单渠道分享文案重生成：只重写微信/朋友圈/小红书/公众号/口播中的一项
  const SHARE_COPY_CHANNELS = {
    wechat: { label: "微信群招募文案", style: "口语化，像发给微信群的招募通知。包含时间、地点、价格、报名召唤，不用标题党，不喊口号。" },
    moments: { label: "朋友圈文案", style: "适合配图发朋友圈，有画面感和轻微情绪，但不油腻、不堆砌形容词。" },
    xhs: { label: "小红书文案", style: "带 2-4 个相关话题标签（#xxx），口吻年轻、有场景感，避免过度营销感。" },
    gzh: { label: "公众号摘要", style: "正式一点的公众号摘要/导语，1-2 个短段落，有信息密度。" },
    voice: { label: "口播文案", style: "口语化，适合短视频口播或直播话术，自然、有节奏感。" }
  };
  async function regenShareCopy(a, type) {
    if (!a || !SHARE_COPY_CHANNELS[type]) return false;
    const key = "share" + type.charAt(0).toUpperCase() + type.slice(1);
    const keyDef = SHARE_COPY_CHANNELS[type];
    if (!aiAuthMode()) return { _needKey: true };
    const ctx = {
      title: a.title, type: a.type, place: a.place, dateMD: a.dateMD,
      days: a.days, difficulty: a.difficulty, price: a.price, limit: a.limit, limitUnit: a.limitUnit,
      ageRange: a.ageRange, distance: a.distance, elevation: a.elevation,
      meeting: a.meeting, meetTime: a.meetTime
    };
    const current = a[key] || "";
    const userMsg = `已有活动事实：${JSON.stringify(ctx)}\n\n请只重新生成「${keyDef.label}」。要求：${keyDef.style}。当前已有版本（仅供参考，请勿重复，可全新角度）：${current}\n\n严格只返回如下 JSON Schema 中的一个字段：\n{ "${type}": "${keyDef.label}内容" }`;
    try {
      const json = await clubLLM({ system: AI_SYSTEM_PROMPT, user: userMsg, json: true, temperature: 0.85 });
      if (json == null) return false;
      if (!json[type]) return false;
      a[key] = String(json[type]);
      saveState();
      return true;
    } catch (e) { console.error("分享文案重生成异常:", e); return false; }
  }

  // 事实派生的轻量同步（仅费用清单等，不含营销文案），替代旧 recompute
  function syncDerived(a) {
    const inc = [];
    if (a.includeLeader) inc.push("专业领队/向导");
    if (a.includeMeal) inc.push(a.type === "露营" ? "营地餐食" : "餐食");
    if (a.includeInsurance) inc.push("户外保险");
    if (a.includeTransport) inc.push("往返交通");
    if (a.includeGear) inc.push("活动装备");
    a.feeInclude = inc;
  }

  function openAISettings() { showView("ai"); }

  function blankActivity() {
    return {
      id: uid(), title: "", titleCandidates: [], type: "户外探索", pageStyle: "outdoor", audience: [], place: "自然", date: "", dateMD: "", departures: [],
      ageFrom: 6, ageTo: 12, ageRange: "", price: null, originalPrice: null,
      limit: null, limitUnit: "人", meeting: "", meetTime: "", returnTime: "", distance: null, elevation: "",
      includeLeader: false, includeMeal: false, includeInsurance: false, includeTransport: false, includeGear: false,
      photos: [], videos: [], highlights: [], intro: "", hook: "", body: [], sellingPoints: [], editorialTitle: "", posterTagline: "", pullQuote: "", storyPurpose: "", photoCaptions: [], itineraryDays: [], feeInclude: [], feeExclude: [], subtitle: "", heroHook: "", sectionTitles: {}, whyGo: "", experience: "", gain: "", fitFor: "", notFitFor: "", socialCoreMessage: "", contentPlan: null, contentScore: null,
      gear: [], gearManual: [], days: 1, difficulty: "轻松", tags: [], deposit: null, transport: "", contact: "", priceTBD: false, priceNote: "", childPrice: null, leaderIds: [], leaderName: "", leaderYears: "", leaderCert: "", leaderTrips: "", reviews: [], feeSummary: "", headline: "",
      safety: [], notesType: "", shareWechat: "", shareMoments: "", shareXhs: "", shareGzh: "", shareVoice: "",
      notes: "出发前 3 天可全额退；前 1 天退 50%；当天不退，但可转让名额。",
      status: "draft", createdAt: Date.now(), signups: 0, raw: "",
      pinned: false, pinnedAt: 0, ageManual: false,
      contentDirections: [], contentDirection: 0, contentApproved: false,
      brandTone: "",
      useMemberPrice: false, allowPoints: false, allowCoupons: false, tierPrices: {},
    };
  }

  function getActivity(id) { return state.activities.find((x) => x.id === id); }

  /* ---------------- mock AI ---------------- */
  /* ---------------- 活动类型知识库（规则引擎：优先关键词，不让 AI 自由猜测） ---------------- */
  const TYPE_RULES = [
    { type: "高海拔登山", kw: ["大峰", "二峰", "三峰", "雪山", "登顶", "冲顶", "攀登", "冰川", "垭口", "高原", "那玛峰", "贡嘎", "雨崩", "狼塔", "鳌太", "梅里", "珠峰", "乞力马扎罗", "哈巴雪山", "技术型雪山"] },
    { type: "滑雪", kw: ["滑雪", "雪场", "双板", "单板", "滑雪教学", "雪季", "开板", "滑雪营"] },
    { type: "攀岩", kw: ["攀岩", "攀冰", "岩壁", "抱石", "攀岩馆"] },
    { type: "骑行", kw: ["骑行", "自行车", "骑车", "单车", "公路车"] },
    { type: "桨板或皮划艇", kw: ["桨板", "皮划艇", "独木舟", "sup", "kayak"] },
    { type: "溯溪", kw: ["溯溪", "溪降", "溪谷", "玩水", "漂流"] },
    { type: "露营", kw: ["露营", "帐篷", "营地", "星空", "篝火", "天幕", "过夜营", "野营"] },
    { type: "跑步", kw: ["跑步", "马拉松", "越野跑", "夜跑", "晨跑"] },
    { type: "自驾旅行", kw: ["自驾", "开车", "房车", "自驾游"] },
    { type: "摄影旅行", kw: ["摄影", "旅拍", "风光摄影", "人像摄影", "扫街"] },
    { type: "企业团建", kw: ["团建", "拓展", "年会", "公司活动", "团队建设", "企业"] },
    { type: "研学", kw: ["研学", "自然教育", "夏令营", "冬令营", "独立营", "青少年营", "少年营"] },
    { type: "徒步", kw: ["徒步", "轻徒步", "穿越", "拉练", "步道", "徒步线路", "越野", "野路", "山脊", "爬山", "登山", "ridge", "trail", "登山徒步"] },
    { type: "城市旅行", kw: ["城市游", "城市旅行", "citywalk", "city walk", "夜景", "美食", "老街", "商圈", "博物馆", "步行街", "都市", "市区游", "周末游", "两日游", "三日游", "重庆", "上海", "北京", "西安", "长沙", "成都城区", "成都市区", "广州", "深圳", "杭州", "武汉", "南京", "苏州"] },
    { type: "景区观光", kw: ["景区", "观光", "打卡", "乐园", "古镇", "园林", "看展", "展览", "门票游", "周边游"] },
    { type: "综合旅行", kw: ["旅行", "游玩", "出游", "度假", "休闲游"] },
  ];
  const OUTDOOR_HARD = ["雪山", "登顶", "冲顶", "攀登", "冰川", "垭口", "高原", "大峰", "二峰", "三峰", "徒步", "爬山", "登山", "穿越", "拉练", "步道", "越野", "野路", "山脊", "露营", "帐篷", "营地", "滑雪", "雪场", "攀岩", "攀冰", "骑行", "自行车", "桨板", "皮划艇", "溯溪", "溪降", "跑步", "马拉松", "自驾", "摄影", "团建", "研学", "夏令营", "冬令营"];
  const PAGE_STYLE_MAP = {
    "城市旅行": "city", "景区观光": "sight", "徒步": "hike", "高海拔登山": "alpine", "露营": "camp",
    "亲子活动": "kids", "研学": "kids", "滑雪": "ski", "骑行": "cycling", "跑步": "run", "漂流": "water",
    "攀岩": "climb", "桨板或皮划艇": "water", "溯溪": "water", "自驾旅行": "drive",
    "摄影旅行": "photo", "企业团建": "team", "综合旅行": "travel", "户外探索": "outdoor",
  };
  // 编辑器下拉选项：value 为内部标准类型，label 为界面友好名称
  const TYPE_OPTIONS = [
    { value: "亲子活动", label: "亲子户外" },
    { value: "徒步", label: "徒步登山" },
    { value: "高海拔登山", label: "高海拔登山" },
    { value: "骑行", label: "骑行" },
    { value: "滑雪", label: "滑雪" },
    { value: "溯溪", label: "溯溪/漂流" },
    { value: "桨板或皮划艇", label: "桨板/皮划艇" },
    { value: "露营", label: "营地/露营" },
    { value: "城市旅行", label: "城市漫游" },
    { value: "景区观光", label: "景区观光" },
    { value: "摄影旅行", label: "摄影旅行" },
    { value: "企业团建", label: "企业团建" },
    { value: "综合旅行", label: "综合旅行" },
    { value: "户外探索", label: "户外探索" }
  ];
  // 高风险地点仅作参考；年龄 / 难度收紧必须结合「强风险关键词 + 海拔 + 天数 + 距离」综合判断，不能只凭地点名称
  const HIGH_RISK_PLACES = ["牛背山", "四姑娘山", "四姑娘", "哈巴雪山", "哈巴", "贡嘎", "雨崩", "狼塔", "鳌太", "梅里", "珠峰", "乞力马扎罗", "那玛峰", "华山", "黄山", "泰山", "峨眉山", "青城山", "青城后山", "赵公山", "鹤鸣山", "虹口"];
  // 强风险关键词：只有活动文本命中这些词才上调年龄 / 难度（如「大峰登顶」才算高风险；双桥沟观光、青城山亲子徒步都不算）
;
  const CITY_NAMES = ["重庆", "上海", "北京", "西安", "长沙", "成都城区", "成都市区", "广州", "深圳", "杭州", "武汉", "南京", "苏州", "成都", "天津", "青岛", "厦门", "昆明"];

  // 编辑器下拉框选项可能与内部标准类型名称不同，统一映射到标准类型
  function normalizeType(t) {
    const map = {
      "徒步登山": "徒步",
      "漂流": "溯溪",
      "营地": "露营",
      "亲子户外": "亲子活动",
    };
    return map[t] || t;
  }
  // 风险年龄收紧：须同时满足「户外类活动」+（强风险关键词 或 高海拔≥3500 或 长线≥15km 或 多日≥3天），不单凭地点名称



  function parseDatePhrase(a, text) {
    let m;
    if ((m = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/))) {
      a.date = `${curYear()}年${m[1]}月${m[2]}日`;
      a.dateMD = `${m[1]}月${m[2]}日`;
    } else {
      const resolved = resolveRelativeDate(text);
      if (resolved) { a.date = resolved; a.dateMD = toDateMD(resolved); }
    }
    // 首次识别日期时，把单日期自动写入团期数组
    if (a.date && (!a.departures || !a.departures.length)) {
      const d = departureFromDate(a.date, a.price);
      if (d) a.departures = [d];
    }
  }



  // 自动难度评估：根据类型 + 距离 + 天数，免去老板手动评级


  // 按「活动类型 + 风险度 + 地点风险」自动推荐适合年龄段（用户可在编辑器手动覆盖）


  // 当类型/天数/距离/海拔等事实变化时，重新评估难度与年龄（用户手动改过年龄则保留）


  function parseAgeRange(a, text) {
    const t = text != null ? text : a.ageRange || "";
    let m;
    if ((m = t.match(/(\d{1,2})\s*[-—~至到]\s*(\d{1,2})\s*岁?/))) { a.ageFrom = +m[1]; a.ageTo = +m[2]; a.ageRange = `${m[1]}—${m[2]}岁`; a.ageManual = true; }
    else if ((m = t.match(/(\d{1,2})\s*岁以上/))) { a.ageFrom = +m[1]; a.ageTo = 99; a.ageRange = `${m[1]}岁以上`; a.ageManual = true; }
    else if ((m = t.match(/(\d{1,2})\s*岁/))) { a.ageFrom = +m[1]; a.ageTo = +m[1]; a.ageRange = `${m[1]}岁`; a.ageManual = true; }
    else if ((m = t.match(/^(\d{1,2})$/))) { a.ageFrom = +m[1]; a.ageTo = 99; a.ageRange = `${m[1]}岁以上`; a.ageManual = true; }
  }

  function isFamilyActivity(a) {
    // 人群标签由规则引擎统一判定：亲子 / 研学 / 团队 / 成人 / 通用
    if (!a) return false;
    // 显式成人/非亲子输入优先，不因默认推断错判为亲子
    if (a.raw && /成人|非亲子|年轻化|不含儿童|仅成人/.test(a.raw)) return false;
    if (a.audience && a.audience.includes("亲子")) return true;
    if (a.type === "亲子活动" || a.type === "研学") return true;
    if (a.raw && /亲子|儿童|孩子|少年|家庭/.test(a.raw)) return true;
    // 仅当年龄区间明确出现亲子/儿童/少年/孩子时才算亲子；成人向的“X岁以上/16—55岁”不应被误判
    if (a.ageRange && /亲子|儿童|少年|孩子/.test(a.ageRange)) return true;
    return false;
  }
  function audienceLabel(a) {
    if (!a.audience || !a.audience.length) return "";
    if (a.audience.includes("亲子")) return "亲子";
    if (a.audience.includes("研学")) return "研学";
    if (a.audience.includes("团队")) return "团队";
    if (a.audience.includes("成人")) return "成人";
    return "通用";
  }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }




  /* V1.8 地点季节语料：让介绍文案扎根于真实地点与当季氛围。 */
  const SEASON_MONTHS = { spring:[3,4,5], summer:[6,7,8], autumn:[9,10,11], winter:[12,1,2] };
  function seasonKeyFromMonth(m) {
    for (const k in SEASON_MONTHS) if (SEASON_MONTHS[k].includes(m)) return k;
    return "spring";
  }
  function seasonFromActivity(a) {
    const d = a.date || a.dateMD || "";
    const m = d.match(/(\d{1,2})月/); if (m) return seasonKeyFromMonth(+m[1]);
    const dt = a.startDate ? new Date(a.startDate) : (a.date ? new Date(a.date) : null);
    if (dt && !isNaN(dt)) return seasonKeyFromMonth(dt.getMonth()+1);
    return seasonKeyFromMonth(new Date().getMonth()+1);
  }
  const PLACE_DB = {
    "都江堰": {
      aliases:["都江堰","青城山","虹口","龙池","赵公山","熊猫谷"],
      season:{
        spring:"春水涨满时，都江堰的山道刚被新绿洗过一遍。",
        summer:"暑气正盛的八月，青城山下的溪风比城里低好几度。",
        autumn:"秋意渐起，银杏和红叶把都江堰的山路铺成暖色调。",
        winter:"冬天的人少，山更静，都江堰的云雾像一层轻纱。"
      },
      vibe:"两千年的水利沉稳，和青城山道的清幽，都在这里。"
    },
    "成都": {
      aliases:["成都","天府新区","龙泉山","金堂","大邑","邛崃","崇州"],
      season:{
        spring:"成都的春天很短，短到值得用一场户外去认真接住。",
        summer:"成都夏天的余热，最适合交给山里的一场凉风。",
        autumn:"秋天的成都，天空和银杏一起变高。",
        winter:"冬天出太阳的日子，成都人都在往山里跑。"
      },
      vibe:"离城市不远，但离日常很远。"
    },
    "川西": {
      aliases:["川西","贡嘎","四姑娘山","毕棚沟","达瓦更扎","冷嘎措","稻城亚丁","海螺沟","牛背山","西岭雪山"],
      season:{
        spring:"高原的春天来得晚，但来得格外认真。",
        summer:"川西的夏天是流动的，草甸、花海和云影都在路上。",
        autumn:"秋天是川西的高光时刻，每一寸山色都是礼物。",
        winter:"冬天的川西很安静，雪山把天地都擦干净。"
      },
      vibe:"高原、雪山与风，是川西最直接的表达。"
    },
    "云南": {
      aliases:["云南","大理","丽江","香格里拉","泸沽湖","西双版纳","腾冲"],
      season:{
        spring:"云南的春天没有边界，花开到哪，路就延伸到哪。",
        summer:"夏天的云南是凉快的，云低得像是伸手就能够到。",
        autumn:"秋天的云南日光很长，适合慢慢走。",
        winter:"冬天的云南依旧温和，阳光是最好的行李。"
      },
      vibe:"去云南，就是把时间调慢一点。"
    },
    "贵州": {
      aliases:["贵州","贵阳","荔波","黔东南","铜仁","安顺"],
      season:{
        spring:"贵州的春天藏在山坳里，一转弯就是一片新绿。",
        summer:"夏天的贵州是天然的凉棚，瀑布和溶洞都在降温。",
        autumn:"秋天的贵州，梯田和村寨一起变颜色。",
        winter:"冬天的贵州多雨雾，山像水墨一样淡。"
      },
      vibe:"贵州的山，一层叠着一层，藏着不少秘密。"
    },
    "西藏": {
      aliases:["西藏","拉萨","林芝","阿里","珠峰","羊湖","纳木错"],
      season:{
        spring:"西藏的春天从林芝开始，桃花一路开到雪山脚下。",
        summer:"夏天的西藏氧气足、云多，是入藏最稳妥的季节。",
        autumn:"秋天的西藏干燥晴朗，能见度和心情一样好。",
        winter:"冬天的西藏游客少，阳光却把雪地照得很暖。"
      },
      vibe:"西藏不在 checklist 上，它在心里慢慢展开。"
    },
    "新疆": {
      aliases:["新疆","伊犁","喀纳斯","喀什","赛里木湖","独库公路"],
      season:{
        spring:"新疆的春天从伊犁的杏花开始，一路向北铺开。",
        summer:"夏天的新疆白天很长，草原和湖泊都在发光。",
        autumn:"秋天的喀纳斯，是新疆写给世界的一封情书。",
        winter:"冬天的新疆是雪的故乡，安静得像童话。"
      },
      vibe:"新疆的远，是风景的第一道门槛。"
    },
    "海南": {
      aliases:["海南","三亚","万宁","文昌","陵水"],
      season:{
        spring:"海南的春天和夏天很像，海是永远的背景。",
        summer:"夏天的海南浪大、云多，是玩海的好时候。",
        autumn:"秋天的海南少了暑期人潮，海更自在。",
        winter:"冬天的海南是很多人的季节转换器。"
      },
      vibe:"海南的方向，永远朝着海。"
    },
    "default": {
      season:{ spring:"这个时节的山野，刚好适合出门。", summer:"夏天 outdoors，风比空调更解闷。", autumn:"秋天的户外，每一口空气都清爽。", winter:"冬天出门需要一点勇气，但风景值得。" },
      vibe:"出门这件事，本身就是目的地。"
    }
  };
  function matchPlace(a) {
    const p = (a.place || "") + " " + (a.meeting || "") + " " + (a.title || "");
    const norm = p.replace(/后(?=山)|前(?=山)|景区|风景区|森林公园|地质公园|大峡谷/g, "");
    for (const key in PLACE_DB) {
      if (key === "default") continue;
      if (PLACE_DB[key].aliases.some((al)=>p.includes(al) || norm.includes(al))) return PLACE_DB[key];
    }
    return PLACE_DB.default;
  }
  function placeFlavorFor(a) {
    const rec = matchPlace(a);
    const s = seasonFromActivity(a);
    return { seasonLine: (rec.season[s] || rec.season.spring || PLACE_DB.default.season[s]), localVibe: rec.vibe || PLACE_DB.default.vibe };
  }

  /* V1.3 内容策略层：只改变表达，不增加活动事实。 */
  /* ===== V2.0 事实层：规则引擎负责事实，每个字段记录来源状态 =====
     status: confirmed(老板输入/确认) / inferred(规则推断，发布前须确认) / missing(缺失) / not_applicable(不适用)
     source: owner_input / owner_confirmed / rule_inferred / ""                                */
  const FACT_SPECS = [
    { key: "place", label: "活动地点", required: true, val: (a) => a.place, test: (raw) => /[\u4e00-\u9fa5]{2,8}?(?:山|湖|谷|林|公园|峰|岭|沟|塬|垭口|草原|梯田|古镇|古城|寺庙)/.test(raw) || CITY_NAMES.some((k) => raw.includes(k)) },
    { key: "date", label: "活动日期", required: true, val: (a) => a.date || a.dateMD, test: (raw) => /\d{1,2}\s*月\s*\d{1,2}\s*日|本周|下周|本周末|下周末|周末|国庆|元旦|春节|中秋|端午|清明|五一/.test(raw) },
    { key: "days", label: "活动天数", val: (a) => a.days, test: (raw) => /\d+\s*天|两日|三日|多天|多日|过夜/.test(raw) },
    { key: "type", label: "活动类型", val: (a) => a.type, test: (raw) => TYPE_RULES.some((r) => r.kw.some((k) => raw.includes(k))) },
    { key: "difficulty", label: "活动难度", required: (a) => a.type === "高海拔登山", val: (a) => a.difficulty, test: (raw) => /难度|轻松|中等|挑战|入门|进阶|专业级/.test(raw) },
    { key: "audience", label: "参与人群", val: (a) => (a.audience || []).join("/"), test: (raw) => /亲子|儿童|孩子|家庭|成人|团建|企业|研学|青少年|少年/.test(raw) },
    { key: "age", label: "适合年龄", required: (a) => isFamilyActivity(a), val: (a) => a.ageRange, test: (raw) => /\d{1,2}\s*[-—~至到]\s*\d{1,2}\s*岁|\d{1,2}\s*岁以上/.test(raw) },
    { key: "price", label: "活动价格", required: true, val: (a) => (a.price != null ? "¥" + a.price + "/" + a.limitUnit : (a.priceTBD ? "待定" : "")), test: (raw) => /\d{2,4}\s*元|\d{2,4}\s*\/\s*人|价格待定|费用待定|\d{2,4}\s*每人/.test(raw) },
    { key: "limit", label: "招募上限", val: (a) => (a.limit ? a.limit + a.limitUnit : ""), test: (raw) => /限\s*\d+|招募\s*\d+|成行\s*\d+|\d+\s*组|\d+\s*人/.test(raw) },
    { key: "distance", label: "路线距离", val: (a) => (a.distance ? a.distance + "KM" : ""), test: (raw) => /\d+(?:\.\d+)?\s*(?:KM|km|公里)/.test(raw) },
    { key: "elevation", label: "海拔", na: (a) => !["高海拔登山", "徒步"].includes(a.type), val: (a) => (a.elevation ? a.elevation + "m" : ""), test: (raw) => /海拔/.test(raw) },
    { key: "meeting", label: "集合地点", required: true, val: (a) => a.meeting, test: (raw) => /集合|上车|出发|签到/.test(raw) },
    { key: "meetTime", label: "集合时间", required: true, val: (a) => a.meetTime, test: (raw) => /\d{1,2}\s*[:：]\s*\d{2}|\d{1,2}\s*点/.test(raw) },
    { key: "returnTime", label: "返回时间", val: (a) => a.returnTime, test: (raw) => /返回|回到|解散/.test(raw) },
    { key: "services", label: "已确认服务", val: (a) => { const s = []; if (a.includeLeader) s.push("领队"); if (a.includeMeal) s.push("餐食"); if (a.includeInsurance) s.push("保险"); if (a.includeTransport) s.push("交通"); if (a.includeGear) s.push("装备"); return s.join("、"); }, test: (raw) => /领队|向导|教练|带队|协作|午餐|含餐|餐饮|吃饭|保险|交通|接送|包车|装备|全包/.test(raw) },
    { key: "feeExclude", label: "费用不含", val: (a) => ((a.feeExclude || []).length ? "已填写" : ""), test: (raw) => /不含|自理|自费/.test(raw) },
    { key: "itinerary", label: "详细行程", required: true, val: (a) => { const d = (a.itineraryDays || []).filter((x) => (x.items || []).some((t) => t && (t.time || t.text))); return d.length ? d.length + " 天已填" : ""; }, test: (raw) => /行程|集合后|出发后/.test(raw) },
    { key: "leaderInfo", label: "领队资料", val: (a) => a.leaderName, test: (raw) => /领队|教练|向导|从业|资质/.test(raw) },
    { key: "gear", label: "装备清单", val: (a) => ((a.gear || []).length ? "已生成" : ""), test: (raw) => /装备|租借|自备/.test(raw) },
    { key: "refund", label: "退款规则", val: (a) => a.notes, test: (raw) => /退款|退费|取消|转让|退订/.test(raw) },
    { key: "contact", label: "联系方式", val: (a) => a.contact, test: (raw) => /1\d{10}/.test(raw) },
  ];
  function factRegistry(a) {
    const raw = a.raw || "";
    const cf = a.factConfirmed || {};
    return FACT_SPECS.map((spec) => {
      if (spec.na && spec.na(a)) return { key: spec.key, label: spec.label, value: "", status: "not_applicable", source: "rule", required: false };
      const v = spec.val ? spec.val(a) : "";
      const has = !!(v !== null && v !== undefined && String(v).trim() !== "");
      const hit = spec.test ? spec.test(raw) : false;
      let status = "missing", source = "";
      if (hit && has) { status = "confirmed"; source = "owner_input"; }
      else if (has) { status = "inferred"; source = "rule_inferred"; }
      // 老板在后台手动确认过的事实升级为 confirmed
      if (cf[spec.key] && has) { status = "confirmed"; source = "owner_confirmed"; }
      return { key: spec.key, label: spec.label, value: String(v || ""), status, source, required: typeof spec.required === "function" ? !!spec.required(a) : !!spec.required };
    });
  }
  function factsOf(a, st) { return factRegistry(a).filter((f) => f.status === st); }
  function confirmedFacts(a) { return factsOf(a, "confirmed"); }
  function inferredFacts(a) { return factsOf(a, "inferred"); }
  function missingFacts(a) { return factsOf(a, "missing"); }
  function missingRequiredFacts(a) { return factRegistry(a).filter((f) => f.required && f.status === "missing"); }
  function confirmFact(a, key) { if (!a.factConfirmed) a.factConfirmed = {}; a.factConfirmed[key] = true; }
  /* ===== V2.0 发布前事实检查 =====
     blocking：关键错误，禁止发布；warnings：非关键缺失，可隐藏对应模块后发布。 */
  const STRATEGY_WORDS = ["推荐理由", "适合朋友圈传播", "强化年轻用户", "不虚构具体景点", "推荐选择该方向", "当前模板匹配度", "制造向往", "情绪钩子", "转化"];
  const TEMPLATE_PHRASES = ["走进自然，收获成长", "身体想念山野", "说走就走的旅行", "感受城市烟火", "重新认识自己", "治愈之旅", "松弛感拉满"];
  function runPublishCheck(a) {
    const blocking = [], warnings = [];
    const reg = factRegistry(a);

    // 1) 关键事实缺失
    const reqMissing = reg.filter((f) => f.required && f.status === "missing").map((f) => f.label);
    if (reqMissing.length) blocking.push("缺少关键事实：" + reqMissing.join("、"));

    // 2) 规则推断但未确认
    const inf = reg.filter((f) => f.status === "inferred");
    const criticalInf = inf.filter((f) => f.required || ["difficulty", "services"].includes(f.key));
    const optionalInf = inf.filter((f) => !criticalInf.includes(f));
    if (criticalInf.length) blocking.push("以下关键事实为系统推断，请老板确认：" + criticalInf.map((f) => f.label).join("、"));
    if (optionalInf.length) warnings.push("以下为规则推断，未确认前不会进入客户页：" + optionalInf.map((f) => f.label).join("、"));

    // 3) 全包与费用不含冲突
    if (a.allInclusive) {
      if ((a.feeExclude || []).length) blocking.push("已勾选“全包”，但费用不含仍有项目，二者冲突");
      if (!(a.feeInclude || []).length) warnings.push("“全包”需要老板确认具体包含项目");
    }

    // 4) 高风险活动的难度、适合人群与行程
    const hard = a.type === "高海拔登山" || a.difficulty === "挑战" || (a.elevation && +a.elevation >= 3500);
    const demandingRoute = (+a.distance >= 10) || (+a.elevation >= 800 && a.type !== "高海拔登山");
    if (demandingRoute && a.difficulty === "轻松") {
      blocking.push(`路线数据与难度冲突：${a.distance ? a.distance + "公里" : ""}${a.distance && a.elevation ? "、" : ""}${a.elevation ? "累计爬升/海拔数据 " + a.elevation + "米" : ""}不能直接标为“轻松”，请老板重新确认难度`);
    }
    if (hard) {
      if (!a.difficulty || a.difficulty === "待确认") blocking.push("高风险活动缺少难度评级");
      if (!reg.some((f) => f.key === "age" && f.status === "confirmed")) blocking.push("高风险活动必须由老板确认适合人群（年龄）");
      const hasItin = (a.itineraryDays || []).some((d) => (d.items || []).some((t) => t && (t.time || t.text)));
      if (!hasItin) warnings.push("高风险活动建议补充详细行程");
    } else {
      const hasItin = (a.itineraryDays || []).some((d) => (d.items || []).some((t) => t && (t.time || t.text)));
      if (!hasItin) warnings.push("暂无详细行程，详情页将显示“待补充”");
    }

    // 5) 价格与计价单位
    if (a.price == null && !a.priceTBD) blocking.push("缺少活动价格（或需标记为价格待定）");

    // 6) 内部策略语言不得进入客户页面
    const text = [
      a.title, a.intro, a.headline, a.shareWechat, a.shareMoments, a.shareXhs, a.shareGzh, a.shareVoice,
      (a.highlights || []).map((h) => (Array.isArray(h) ? h[0] : h)).join(" "),
      (a.safety || []).join(" "),
    ].filter(Boolean).join(" ");
    const hitStrategy = STRATEGY_WORDS.filter((w) => text.includes(w));
    if (hitStrategy.length) blocking.push("客户可见文案含内部策略语言：" + hitStrategy.join("、"));
    const hitTpl = TEMPLATE_PHRASES.filter((w) => text.includes(w));
    if (hitTpl.length) warnings.push("存在明显模板句，建议改写：" + hitTpl.join("、"));

    // 7) 中英文混杂
    const en = (text.match(/\b[A-Za-z]{3,}\b/g) || []);
    if (en.length > 10) warnings.push("文案中英文混杂偏多，建议统一为中文");

    return { blocking, warnings, ok: blocking.length === 0 };
  }



  function factTags(a) {
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    const out = [];
    if (confirmed.has("distance") && a.distance) out.push(`${a.distance}KM`);
    if (confirmed.has("elevation") && a.elevation) out.push(`${a.elevation}m`);
    if (confirmed.has("days") && a.days > 1) out.push(`${a.days}天`);
    if (confirmed.has("age") && a.ageRange) out.push(a.ageRange);
    if (confirmed.has("limit") && a.limit) out.push(`${a.limit}${a.limitUnit}`);
    return out;
  }
  /* V2.1 气候维度：让文案能引用当季体感，而不只是罗列“X月X日”。 */
  function climateFor(a) {
    const p = (a.place || "") + " " + (a.meeting || "") + " " + (a.title || "");
    const norm = p.replace(/后(?=山)|前(?=山)|景区|风景区|森林公园|地质公园|大峡谷/g, "");
    let key = "default";
    for (const k in PLACE_DB) {
      if (k === "default") continue;
      if (PLACE_DB[k].aliases.some((al) => p.includes(al) || norm.includes(al))) { key = k; break; }
    }
    const s = seasonFromActivity(a);
    const table = {
      "都江堰": { spring: "新绿刚醒，山路还带着潮气", summer: "溪风清凉，午后偶有阵雨", autumn: "天高云淡，昼夜微凉", winter: "湿冷多雾，山静人稀" },
      "成都": { spring: "短春多变，早晚仍凉", summer: "城里闷热，山里却爽", autumn: "爽朗少雨", winter: "湿冷，出太阳最宜出门" },
      "川西": { spring: "风大仍寒，高原慢慢苏醒", summer: "多雨多雾，午后易变天", autumn: "金光遍野，昼夜温差大", winter: "干冷日照强，雪线清晰" },
      "云南": { spring: "花开不断，昼暖夜凉", summer: "清凉多雨，云很低", autumn: "日光绵长，宜慢慢走", winter: "温和如春，阳光正好" },
      "贵州": { spring: "山坳新绿，润润的", summer: "天然凉棚，瀑布正丰", autumn: "梯田染色，村寨转暖", winter: "雨雾如水墨淡开" },
      "西藏": { spring: "林芝桃花映着雪", summer: "氧气足云多，最稳", autumn: "干晴通透", winter: "游客少，日照却暖" },
      "新疆": { spring: "伊犁杏花一路向北", summer: "白昼长，草原发光", autumn: "喀纳斯像一封情书", winter: "雪的故乡，安静如童话" },
      "海南": { spring: "海风常驻", summer: "浪大湿热，多阵雨", autumn: "人少海自在", winter: "温暖得像季节转换器" },
      "default": { spring: "山野渐渐回暖", summer: "风比空调更解闷", autumn: "空气清爽", winter: "出门需一点勇气，但风景值得" }
    };
    const text = (table[key] && table[key][s]) || table.default[s] || "";
    return { season: s, place: key, text };
  }
  function climateDirections(a) {
    const c = climateFor(a);
    if (!c.text) return [];
    const p = a.place || "这里";
    return [
      { name: "气候在场", headline: `${c.text}，${p}的这趟路，从体感开始。`, reason: "把当季体感写进邀请，比罗列日期更有画面。", mood: "时令" },
      { name: "带着天气出发", headline: `知道${c.text}，${p}才值得认真准备。`, reason: "气候是真实的出发理由，也自然带出装备与状态。", mood: "真实" }
    ];
  }

  // V1.9：AI 内容方向库——按活动类型 + 地点季节 + 事实属性生成丰富且美的表达方向
  function directionPoolFor(a) {
    const p = a.place || "这里";
    const flavor = placeFlavorFor(a);
    const season = (flavor.seasonLine || "").replace(/[。，]/g, "").trim();
    const localVibe = flavor.localVibe || "";
    const dist = a.distance ? `${a.distance}KM` : "";
    const days = a.days > 1 ? `${a.days}天` : "一天";
    const isFamily = isFamilyActivity(a);
    const diff = a.difficulty || "轻松";
    const date = a.dateMD || "下一次出发";
    const monthMatch = (a.dateMD || "").match(/(\d{1,2})月/);
    const month = monthMatch ? +monthMatch[1] : (new Date().getMonth() + 1);
    const isAutumn = [9, 10, 11].includes(month);
    const isSummer = [6, 7, 8].includes(month);
    const isSpring = [3, 4, 5].includes(month);
    const isWinter = [12, 1, 2].includes(month);
    const seasonWord = isAutumn ? "秋天" : (isSummer ? "夏天" : (isSpring ? "春天" : "冬天"));
    const isWeekend = /周六|周日|周末|星期六|星期天/.test(a.dateMD || a.date || "");
    const isHoliday = /国庆|五一|清明|端午|中秋|元旦|春节|假期/.test(a.dateMD || a.date || "");

    // 地点地貌/气质标签，用于生成更有辨识度的 headline
    const placeTone = (() => {
      const raw = (a.raw || "") + " " + (a.place || "");
      if (/云海|日出|星空|银河|云瀑|佛光/.test(raw)) return "云海星空";
      if (/瀑布|溪流|溪谷|峡谷|玩水|溪水/.test(raw)) return "溪水峡谷";
      if (/古镇|老城|寺庙|道观|文化|历史|古道|遗址/.test(raw)) return "人文古道";
      if (/草甸|花海|草原|森林|竹海|杜鹃|红叶|银杏/.test(raw)) return "森林草甸";
      if (/雪山|冰川|海拔|垭口|高海拔/.test(raw)) return "雪山高原";
      return "山野";
    })();

    // 通用户外 / 徒步方向池：季节、周末、地点气质、情绪拆分，避免 3 个固定模板
    const hikeDirections = [
      { name: "山野叙事", headline: dist ? `${p}${dist}，用脚步把${seasonWord}走得更远。` : `${p}的山路，${seasonWord}正好。`, reason: "把路线长度、季节和完成感串成一句邀请。", mood: "完成" },
      { name: "城市逃逸", headline: isWeekend ? `这个周末，去${p}把城市关掉。` : `城市之外，${p}正好。`, reason: "距离不远，刚好能把城市的喧嚣关在身后。", mood: "逃离" },
      { name: "季节在场", headline: season ? `${season}，${p}在等。` : `这个${seasonWord}，去${p}走一走。`, reason: "季节本身，就是出发的最好理由。", mood: "时令" },
      { name: "完成仪式", headline: `${days}${dist ? "、" + dist : ""}，把${p}走成一次小型远征。`, reason: "用一段路，完成一次给自己的小小仪式。", mood: "挑战" },
      { name: "山风来信", headline: `${p}的风${isAutumn ? "开始带凉" : (isSummer ? "比城里低好几度" : "已经吹到城市边缘")}，该出发了。`, reason: "山风先到一步，提醒你城市之外还有另一种节奏。", mood: "诗意" },
      { name: "脚踏实地", headline: `不追打卡点，只追${p}的真实山路。`, reason: "不追打卡点，只认真走一段真实山路。", mood: "真实" },
      { name: "云端对话", headline: `在${p}，把城市听不见的声音重新打开。`, reason: "城市听不见的声音，在这里重新打开。", mood: "感知" },
      { name: "克制向导", headline: `${p} / ${date}`, reason: "信息本身，就是态度。", mood: "克制" },
      { name: "周末重启", headline: isHoliday ? `假期不多，${p}足够让你换一口气。` : `用一个周末，把${p}走成生活的逗号。`, reason: "用一个周末，把生活节奏轻轻重启。", mood: "逃离" },
      { name: "在地气息", headline: localVibe ? `${p}的${placeTone}，比滤镜更真实。` : `${p}的${placeTone}，比攻略更具体。`, reason: "把地点的气质，写进每一步。", mood: "真实" },
      { name: "一步一景", headline: `${p}不赶时间，${days}只认真走一段。`, reason: "慢下来，山和树都会主动和你打招呼。", mood: "完成" },
      { name: "初阶友好", headline: diff === "轻松" ? `${p}这条线，新手也能走得尽兴。` : `${p}的真实山路，不需要朋友圈滤镜。`, reason: "新手也能走得尽兴，真实山路不需要滤镜。", mood: "真实" },
      { name: "独处阈值", headline: `不需要说话，${p}会把你安静地接住。`, reason: "有时出门不是为了热闹，而是为了把脑子清空。", mood: "松弛" },
      { name: "向光而行", headline: `光线好的时候，${p}会替你说出来出发的理由。`, reason: "光线和天气，是户外最诚实的文案。", mood: "诗意" },
      { name: "慢问自己", headline: `走${p}的路上，答案常常比问题先到。`, reason: "把户外写成一次和自己的对话，而非打卡。", mood: "哲思" },
      { name: "野趣入口", headline: `${p}不收门票，只收一点好奇心。`, reason: "把山野的开放性写成邀请，而非清单。", mood: "好奇" },
      { name: "微度假", headline: `把${p}当成离城市最近的一次深呼吸。`, reason: "近郊也能重置状态，不必远行。", mood: "松弛" },
      { name: "同行引力", headline: `和同样想去${p}的人，把周末走成经历。`, reason: "一个人出发是旅行，一群人出发是经历。", mood: "陪伴" }
    ];

    // 地点专属方向：根据已知地点扩展更有辨识度的表达
    const placeExtra = [];
    if (/牛背山|达瓦更扎|轿顶山|红岩顶/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "云海之上", headline: `${p}的云海和日出，值得一次早起。`, reason: "云海和日出，是写给早起的人的第一封信。", mood: "诗意" },
      { name: "星空营地", headline: `在${p}，等一场城市看不到的星空。`, reason: "城市的灯熄得太晚，这里的星空值得一次等待。", mood: "诗意" }
    );
    if (/青城山|青城后山|鹤鸣山|赵公山/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "古道问道", headline: `${p}的山道，藏着比风景更深的静谧。`, reason: "山道的静谧，藏在脚步声比人声更清楚的地方。", mood: "感知" },
      { name: "竹海听风", headline: `穿过${p}的竹林，风声比导航更清楚。`, reason: "竹林把风声筛得很轻，走着走着，心也慢了。", mood: "诗意" }
    );
    if (/四姑娘山|毕棚沟|双桥沟|长坪沟/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "雪山前站", headline: `${p}是通往雪山的第一站，也是很多人心动的开始。`, reason: "雪山的轮廓一旦出现，就想走得更近一点。", mood: "挑战" },
      { name: "高原初体验", headline: `${p}的海拔不高不低，刚好让人认真喘口气。`, reason: "海拔不高不低，刚好让呼吸和风景都变认真。", mood: "真实" }
    );
    if (/都江堰|虹口|龙池|熊猫谷/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "山水之间", headline: `${p}的水和山，把夏天的暑气冲淡。`, reason: "水和山挨得很近，夏天的暑气在这里自然退场。", mood: "清凉" },
      { name: "近郊出逃", headline: `离成都最近的山野，${p}刚刚好。`, reason: "不用太远，就能从城市切换成山野模式。", mood: "逃离" }
    );
    if (/成都|重庆|杭州|西安|苏州|南京|武汉|长沙|广州|深圳/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "城市绿肺", headline: `不用出城太远，${p}就能换一口气。`, reason: "周末不必奔波，近处的山野也能换一口气。", mood: "松弛" }
    );
    if (/川西|贡嘎|稻城亚丁|海螺沟|冷嘎措/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "高原长卷", headline: `${p}的每一公里，都是川西写给眼睛的礼物。`, reason: "川西的 landscape 不讲重点，每一公里都好看。", mood: "感知" },
      { name: "雪山注视", headline: `在${p}，雪山一直看着你走。`, reason: "雪山在远处看着你走，这种感觉比到达更难忘。", mood: "诗意" }
    );
    if (/云南|大理|丽江|香格里拉|泸沽湖/.test(a.raw || a.place || "")) placeExtra.push(
      { name: "云南慢调", headline: `${p}的云很慢，慢到能看清时间。`, reason: "云很慢，慢到你有时间认真看一朵。", mood: "松弛" },
      { name: "风物人间", headline: `${p}的风里，有花和远方的味道。`, reason: "风里有花的味道，也有远方的预感。", mood: "诗意" }
    );

    // 气候 + 地点专属方向：与活动类型无关的共情钩子，合并进所有类型，避免“写死三种风格”
    const generic = [...climateDirections(a), ...placeExtra];

    if (a.type === "高海拔登山") return [
      { name: "海拔仪式", headline: a.elevation ? `把人生的新高度，写在 ${a.elevation} 米。` : "把人生的新高度，留在那座山上。", reason: "高海拔活动的核心是目标、仪式感和完成感。", mood: "成就" },
      { name: "专业敬畏", headline: `${p}，每一米海拔都需要被认真对待。`, reason: "强调真实难度与已确认的专业协作。", mood: "专业" },
      { name: "风的边界", headline: `向上走，直到 ${p} 只剩风和呼吸。`, reason: "用克制的画面感表达攻顶过程。", mood: "探险" },
      { name: "山不言语", headline: `${p}不会答应你什么，但会让你重新校准对自己的判断。`, reason: "把登山从「征服」转向「对话」。", mood: "哲思" },
      ...generic
    ];

    if (a.type === "城市旅行" || a.type === "景区观光") return [
      { name: "城市漫游", headline: `${days}，轻松进入${p}的城市生活。`, reason: "行程已经确定，用松弛感而非户外挑战来吸引用户。", mood: "松弛" },
      { name: "周末逃离", headline: `换个城市过周末，这次去${p}。`, reason: "适合朋友圈与年轻用户，但不虚构具体景点。", mood: "逃离" },
      { name: "旅行杂志", headline: `${p} / ${a.days > 1 ? a.days + " DAYS" : "ONE DAY"}`, reason: "用 City Guide 语法展示已确认的旅行信息。", mood: "杂志" },
      { name: "本地切片", headline: `在${p}，把一天切成几个好片段。`, reason: "强调节奏与本地体验，而非赶路打卡。", mood: "生活" },
      { name: "城市绿肺", headline: `不用出城太远，${p}就能换一口气。`, reason: "周末不必奔波，近处的山野也能换一口气。", mood: "松弛" },
      ...generic
    ];

    if (a.type === "露营") return [
      { name: "星空停机", headline: `把闹钟关掉，去${p}听一夜风声。`, reason: "露营的核心是暂停与重置。", mood: "暂停" },
      { name: "山野过夜", headline: `${days}，${p}的星空比城市多很多。`, reason: "用夜晚场景制造稀缺感。", mood: "夜晚" },
      { name: "帐篷生活", headline: `在${p}扎一顶帐篷，把自己还给自然。`, reason: "强调简单生活的吸引力。", mood: "简单" },
      ...generic
    ];

    if (a.type === "滑雪") return [
      { name: "雪季重启", headline: `雪季不该只活在收藏夹里，${p}在等你。`, reason: "用季节限定制造紧迫感。", mood: "季节" },
      { name: "速度回归", headline: `去${p}的雪里，重新感受速度。`, reason: "把滑雪从运动变成情绪释放。", mood: "速度" },
      { name: "白色周末", headline: `${date}，${p}的粉雪是最好的周末答案。`, reason: "强调雪场与周末的契合。", mood: "周末" },
      ...generic
    ];

    if (a.type === "骑行") return [
      { name: "公路自由", headline: `风、公路和自由的味道，${p}都给你。`, reason: "把骑行与自由感直接绑定。", mood: "自由" },
      { name: "车轮视角", headline: `用两个轮子，重新看${p}。`, reason: "强调慢速深入的观察方式。", mood: "观察" },
      { name: "骑行周末", headline: `${date}，去${p}骑一段不堵车的路。`, reason: "用对比突出骑行的轻松。", mood: "轻松" },
      ...generic
    ];

    if (a.type === "攀岩") return [
      { name: "高度对话", headline: `低头是地面，抬头是${p}的岩壁与天空。`, reason: "用空间对比制造张力。", mood: "张力" },
      { name: "突破自己", headline: `在${p}，突破那点不敢尝试的自己。`, reason: "强调心理突破而非体能炫耀。", mood: "成长" },
      { name: "岩壁上的专注", headline: `${p}，让注意力回到身体本身。`, reason: "把攀岩描述为专注力训练。", mood: "专注" },
      ...generic
    ];

    if (a.type === "溯溪" || a.type === "桨板或皮划艇" || a.type === "漂流") return [
      { name: "夏日清凉", headline: `夏天的${p}，水是唯一的正解。`, reason: "用季节与水的关系制造渴望。", mood: "清凉" },
      { name: "水中漫游", headline: `在${p}的水面，把自己交给波纹。`, reason: "强调漂浮与放松的感觉。", mood: "漂浮" },
      { name: "野趣出片", headline: `${p}的溪谷，随手就是夏天的形状。`, reason: "兼顾体验与视觉传播。", mood: "出片" },
      ...generic
    ];

    if (a.type === "跑步") return [
      { name: "山风晨光", headline: `不为 PB，只为${p}那一程山风与晨光。`, reason: "把跑步从竞技转向体验。", mood: "体验" },
      { name: "脚步丈量", headline: `用脚步丈量${p}的清晨。`, reason: "强调简单与仪式感。", mood: "仪式" },
      { name: "跑者日常", headline: `${date}，和${p}一起醒来。`, reason: "把活动融入生活方式。", mood: "日常" },
      ...generic
    ];

    if (a.type === "自驾旅行") return [
      { name: "公路叙事", headline: `方向盘一转，把周末交给${p}的公路与山谷。`, reason: "强调驾驶本身的自由感。", mood: "自由" },
      { name: "车队同行", headline: `不独自赶路，${p}的车队领航更安心。`, reason: "突出编队与后勤保障。", mood: "安心" },
      { name: "路上风景", headline: `去${p}，重要的不是终点，是路上的光。`, reason: "弱化目的地，强化过程。", mood: "过程" },
      ...generic
    ];

    if (a.type === "摄影旅行") return [
      { name: "重新看见", headline: `把${p}的光与影，装进你的镜头。`, reason: "强调观察与记录。", mood: "看见" },
      { name: "机位之外", headline: `${p}不只有打卡机位，还有属于你的画面。`, reason: "反打卡，强调个人视角。", mood: "独特" },
      { name: "光线时刻", headline: `在${p}，等一束属于你的光。`, reason: "用光线制造诗意。", mood: "诗意" },
      ...generic
    ];

    if (a.type === "企业团建") return [
      { name: "山野默契", headline: `把团队带去${p}，找回办公室久违的默契。`, reason: "把团建与关系重建挂钩。", mood: "默契" },
      { name: "共同完成", headline: `${p}的${days}，让团队真正近一点。`, reason: "强调共同经历的价值。", mood: "协作" },
      { name: "换场思考", headline: `离开会议室，在${p}重新看见彼此。`, reason: "用场景转换激发团队活力。", mood: "转换" },
      ...generic
    ];

    if (a.type === "综合旅行") return [
      { name: "轻松打包", headline: `${days}，把${p}的好体验打包带走。`, reason: "强调一站式与省心。", mood: "省心" },
      { name: "慢慢来", headline: `在${p}，把假期过成羡慕的样子。`, reason: "强调松弛与品质。", mood: "松弛" },
      { name: "旅行杂志", headline: `${p} / ${a.days > 1 ? a.days + " DAYS" : "ONE DAY"}`, reason: "用 City Guide 语法展示已确认的旅行信息。", mood: "杂志" },
      ...generic
    ];

    if (isFamily || a.type === "亲子活动" || a.type === "研学") return [
      { name: "成长刻度", headline: dist ? `${p}${dist}，是孩子认识山野的第一条刻度。` : "不是带孩子走一次，是让他发现：原来我真的可以。", reason: "年龄与路线适合将真实的完成感作为主卖点。", mood: "成长" },
      { name: "自然课堂", headline: `第一次认识${p}，不需要从课本开始。`, reason: "把真实场地与孩子的感知体验连接起来。", mood: "探索" },
      { name: "陪伴时刻", headline: `这个周末，不赶时间。陪孩子好好走完${dist || "一段路"}。`, reason: "把家长的参与感和共同完成放在中心。", mood: "陪伴" },
      { name: "好奇心", headline: `${p}会替孩子问出很多问题，答案在路上。`, reason: "强调探索而非说教。", mood: "好奇" },
      ...generic
    ];

    // 通用户外 / 徒步：合并通用方向 + 气候 + 地点专属方向
    return [...hikeDirections, ...climateDirections(a), ...placeExtra];
  }


  function stableScore(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return h % 26;
  }
  // 按活动事实稳定打分。同一组事实输出一致，便于老板复用和测试。
  function scoreDirections(a, dirs) {
    const diff = a.difficulty || "轻松";
    const isFamily = isFamilyActivity(a);
    const days = a.days || 1;
    const dist = a.distance || 0;
    const flavor = placeFlavorFor(a);
    const hasSeason = !!flavor.seasonLine;
    const hasPlaceVibe = !!flavor.localVibe;
    const isWeekend = /周六|周日|周末|星期六|星期天/.test(a.dateMD || a.date || "");
    return dirs.map((d) => {
      let score = stableScore(`${a.raw || ""}|${d.name}|${d.headline}`);
      if (diff === "挑战" && d.mood === "挑战") score += 8;
      if (diff === "挑战" && d.mood === "成就") score += 6;
      if (days >= 2 && (d.mood === "完成" || d.mood === "远征")) score += 5;
      if (isFamily && (d.mood === "陪伴" || d.mood === "成长" || d.mood === "探索")) score += 7;
      if (!isFamily && (d.mood === "逃离" || d.mood === "诗意")) score += 4;
      if (!isFamily && isWeekend && d.mood === "逃离") score += 5;
      if (dist && (d.mood === "完成" || d.mood === "挑战")) score += 4;
      if (hasSeason && d.mood === "时令") score += 6;
      if (hasPlaceVibe && d.headline && d.headline.includes(a.place || "")) score += 6;
      // 徒步/户外类更偏好「真实」「感知」类方向，减少固定三种模板的出现概率
      if ((a.type === "徒步" || a.type === "户外探索") && ["真实", "感知", "诗意"].includes(d.mood)) score += 2;
      return { ...d, score };
    }).sort((x, y) => y.score - x.score);
  }

  /* ===== V2.0 洞察层：AI 只做内容策划，洞察必须引用本场具体事实，不补全事实 ===== */
  function buildInsight(a) {
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    const dist = a.distance ? a.distance + " 公里" : "";
    const days = a.days > 1 ? a.days + " 天" : "一天";
    const svc = [];
    const servicesConfirmed = confirmedFacts(a).some((f) => f.key === "services");
    if (servicesConfirmed && a.includeLeader) svc.push("领队");
    if (servicesConfirmed && a.includeMeal) svc.push("餐食");
    if (servicesConfirmed && a.includeInsurance) svc.push("保险");
    if (servicesConfirmed && a.includeTransport) svc.push("交通");
    if (servicesConfirmed && a.includeGear) svc.push("装备");

    const uniq = [];
    if (dist) uniq.push(dist);
    if (confirmed.has("age") && a.ageRange) uniq.push(a.ageRange);
    if (confirmed.has("limit") && a.limit) uniq.push("限 " + a.limit + a.limitUnit);
    if (confirmed.has("elevation") && a.elevation) uniq.push("海拔 " + a.elevation + " m");
    if (confirmed.has("days") && a.days > 1) uniq.push(days);
    if (confirmed.has("meeting") && confirmed.has("meetTime") && a.meeting && a.meetTime) uniq.push(a.meetTime + " " + a.meeting + " 集合");
    if (a.price != null) uniq.push("¥" + a.price + "/" + a.limitUnit);
    if (svc.length) uniq.push("已确认含" + svc.join("、"));

    const isFam = isFamilyActivity(a);
    let motivation = "用一段时间把自己从日常里抽离出来";
    if (isFam && a.type === "研学") motivation = "让孩子在真实场景里独立完成一件事";
    else if (isFam) motivation = "孩子完成一次可以感知的户外挑战";
    else if (a.type === "高海拔登山") motivation = "在有海拔目标的路线上验证自己的体能与经验";
    else if (a.type === "城市旅行" || a.type === "景区观光") motivation = "用最短的时间换一种生活节奏";
    else if (a.type === "露营") motivation = "把一整段连续的时间交还给自然";
    else if (a.type === "企业团建") motivation = "让团队在非工作场景里重新建立默契";
    else if (["滑雪", "攀岩", "骑行"].includes(a.type)) motivation = "把一项运动真正学会，而不只是体验一次";

    const isHard = a.type === "高海拔登山" || a.difficulty === "挑战" || (a.elevation && +a.elevation >= 3500);
    let core = "";
    if (isHard) {
      core = (a.elevation ? a.elevation + " 米" : (a.type === "高海拔登山" ? "雪线以上的强度" : "挑战级的强度")) + "决定了这不是一次轻松的出行，体能和经验都需要如实评估";
      if (a.days > 1) core += "，完整行程共 " + a.days + " 天";
    }
    else if (isFam && dist && a.ageRange) core = dist + " 是 " + a.ageRange + " 的孩子第一次自己掌握行走节奏的具体尺度";
    else if (isFam && dist) core = dist + " 把“陪孩子走一段”变成了一件可以被完成、被记住的事";
    else if (a.elevation) core = a.elevation + " 米的海拔差距，决定了这是一场需要认真准备的行程";
    else if (dist && a.days > 1) core = dist + " 压在 " + a.days + " 天里，强度是清晰可判断的";
    else if (dist) core = dist + " 把本次活动的路程变成了可以直接判断的具体数字";
    else if (a.limit) core = "本次招募上限为 " + a.limit + " " + a.limitUnit;
    else if (a.type === "城市旅行" || a.type === "景区观光") core = days + "的安排，把 " + a.place + " 的日常过成一段假期";
    else core = days + "的安排，让 " + a.place + " 成为一段不需要复杂准备就能出发的行程";

    let psp = "";
    if (isHard) psp = "用 " + days + " 认真完成一次" + (a.elevation ? a.elevation + " 米" : "高强度") + "的行程";
    else if (isFam && dist) psp = "用 " + dist + " 换来孩子一次“我自己走完了”的确认";
    else if (dist) psp = dist + "，一步一景地走完";
    else if (a.elevation) psp = "在 " + a.elevation + " 米的高度上重新看 " + a.place;
    else if (a.type === "城市旅行" || a.type === "景区观光") psp = "用 " + days + " 把 " + a.place + " 的城市节奏走一遍";
    else psp = "在 " + a.place + " 用 " + days + " 完成一次真实的户外";

    const support = [];
    if (isFam) support.push("家长全程同行，共同完成");
    if ((a.days || 1) <= 1) support.push("一天之内可以完成");
    else support.push(a.days + " 天的连续安排");
    if (svc.length) support.push("已确认含" + svc.join("、"));
    if (a.ageRange) support.push("适合 " + a.ageRange);

    const prohibited = [
      "自然教育课程", "专业认证", "独家路线", "小团/精品团", "避开大众路线",
      "网红机位/本地人私藏", "后勤保障", "全程安全管控", "应急预案", "海拔适应方案",
      "酒店/餐厅推荐", "领队资质", "未确认的保险/交通/餐食", "活动物料",
    ];
    if (a.type === "高海拔登山") prohibited.push("登顶承诺", "安全保障承诺");

    return {
      unique_facts: uniq,
      audience_motivation: motivation,
      core_insight: core,
      primary_selling_point: psp,
      supporting_points: support,
      prohibited_claims: prohibited,
      missing_facts: missingFacts(a).map((f) => f.label),
      confirmed_summary: confirmedFacts(a).map((f) => f.label + "：" + f.value),
    };
  }

  /* ===== V2.0 概念层：每次按洞察动态生成三个创意概念，三个必须是不同用户动机 ===== */
  const MOTIVATIONS = [
    { key: "achievement", label: "完成感", fit: (a) => !!a.distance || (a.days || 1) >= 2 || !!a.elevation,
      headline: (a) => a.distance ? a.distance + " 公里，是今天可以完整走完的一段路。" : a.days + " 天，把 " + a.place + " 走完一遍。",
      intro: (a) => (a.distance ? a.distance + " 公里" : a.days + " 天") + "不是一个靠意志硬撑的数字，而是被反复走过、确认过节奏的一条线。走完它不需要训练基础，但需要你真的走完全程。" + (a.ageRange ? "这也是 " + a.ageRange + " 能一起完成的长度。" : ""),
      story: "用距离/天数记录从出发到完成的变化",
      poster: (a) => a.distance ? "走完这 " + a.distance + " 公里。" : "用 " + a.days + " 天走完。",
      channel: "微信群 / 公众号",
      reason: (a) => (a.distance ? a.distance + " 公里" : a.days + " 天") + "是本场最容易被感知、也最容易形成完成感的事实" },

    { key: "companionship", label: "同行", fit: () => true,
      headline: (a) => isFamilyActivity(a) ? (a.distance ? a.distance + " 公里，不是孩子一个人的路。" : "这一天，陪孩子把 " + a.place + " 走完。") : "和一群同样想去 " + a.place + " 的人一起出发。",
      intro: (a) => isFamilyActivity(a) ? "这段路的意义不全在风景，而在于有人陪着走完。家长不用在旁边指挥，只是陪着，让孩子自己决定什么时候快、什么时候停。走完了，这件事会被记住很久。" : "一个人出发是旅行，一群人出发是经历。同行的都是奔着同一段路来的人，节奏相近，也不用互相迁就。",
      story: "人物互动与共同完成的过程",
      poster: (a) => isFamilyActivity(a) ? "陪他走完这一段。" : "和同路的人一起出发。",
      channel: "朋友圈 / 小红书",
      reason: (a) => isFamilyActivity(a) ? (a.ageRange || "亲子") + "决定了这场活动的决策者是家长，陪伴是最直接的动机" : "同行人群是这类活动复购与口碑的关键" },

    { key: "ease", label: "低门槛", fit: (a) => (a.days || 1) <= 1,
      headline: (a) => "一天来回，" + a.place + " 不用请假的走法。",
      intro: (a) => "不用提前训练，不用凑假期，也不用准备复杂装备。" + (a.meetTime ? a.meetTime + " 集合" : "早上集合") + "，" + (a.returnTime ? "大约 " + a.returnTime + " 返回" : "当天返回") + "，剩下的时间还是自己的。这是那种想去就能去的安排。",
      story: "用时间成本降低决策门槛",
      poster: () => "一天，来回。",
      channel: "微信群 / 小红书",
      reason: () => "单日活动的时间成本最低，“一天可完成”是最强的报名理由" },

    { key: "scarcity", label: "名额", fit: (a) => !!a.limit && a.limit <= 30,
      headline: (a) => a.limit + " " + a.limitUnit + "，这一场能被照顾到的规模。",
      intro: (a) => "这一场只收 " + a.limit + " " + a.limitUnit + "。人数不是用来制造紧张的，而是为了让每个人在路上都能被看见、被等到。" + (a.includeLeader ? "领队全程跟队，" : "") + "节奏按队伍的实际状态调整。",
      story: "用规模说明照顾程度",
      poster: (a) => a.limit + " " + a.limitUnit + "，报满为止。",
      channel: "微信群",
      reason: (a) => "限 " + a.limit + " " + a.limitUnit + " 是老板明确给出的规模，直接决定体验密度" },

    { key: "timing", label: "时机", fit: () => true,
      headline: (a) => (a.dateMD || "这个时节") + "，" + a.place + " 的样子只出现一次。",
      intro: (a) => "季节会决定同一条路的样子。" + (a.dateMD || "这个时节") + "的 " + a.place + "，光、温度和山色都和别的时候不一样。错过就要等下一年，这也是为什么它值得被单独安排一次。",
      story: "用时间限定制造出发理由",
      poster: (a) => (a.dateMD || "这一次") + "，就是现在。",
      channel: "朋友圈 / 小红书",
      reason: (a) => (a.dateMD || "日期") + "把这场活动限定在特定时间，是天然的出发理由" },

    { key: "growth", label: "成长", fit: (a) => isFamilyActivity(a) || a.type === "研学",
      headline: (a) => (a.ageRange || "这个年纪") + "，第一次自己掌握行走的节奏。",
      intro: () => "大人很容易替孩子决定速度和终点，但这段路留给孩子自己。什么时候快、什么时候歇、什么时候再站起来，都由他决定。走完之后，他会知道自己原来可以。",
      story: "记录孩子从依赖到独立的过程",
      poster: () => "这一次，让他自己走完。",
      channel: "小红书 / 公众号",
      reason: (a) => (a.ageRange || "孩子年龄") + "让“独立完成”成为家长真正在意的结果" },

    { key: "escape", label: "抽离", fit: (a) => (a.days || 1) <= 1,
      headline: (a) => "从 " + (a.meeting || "城市") + " 出发，" + (a.returnTime || "当天") + " 回到日常。",
      intro: (a) => "不需要长假期，也不需要复杂的计划。离开熟悉的环境一整天，把注意力交给路、风和身边发生的小事，再按时回来。这样的抽离，比一次长途旅行更容易重复。",
      story: "用出发与返回的时间结构说明可重复性",
      poster: () => "离开一天，再回来。",
      channel: "朋友圈",
      reason: (a) => (a.meetTime || "集合") + "到" + (a.returnTime || "返回") + "的完整时间结构，是最具体的可执行信息" },

    { key: "mastery", label: "专业", fit: (a) => ["高海拔登山", "攀岩", "滑雪", "骑行", "桨板或皮划艇", "溯溪"].includes(a.type),
      headline: (a) => a.elevation ? a.elevation + " 米，是一条对体能和经验都诚实的线。" : a.type + "不是体验一次，是认真学一次。",
      intro: (a) => "这条线路不会因为报名就变得容易。" + (a.elevation ? a.elevation + " 米的海拔" : "这项运动") + "要求你如实评估自己的体能和经验，也要求你按要求准备装备。把它当成一次认真的练习，而不是一次打卡。",
      story: "用海拔/强度/装备要求建立专业感",
      poster: (a) => a.elevation ? a.elevation + " 米，认真对待。" : "认真学一次。",
      channel: "公众号 / 微信群",
      reason: (a) => a.type + "的强度需要被如实呈现，专业表达反而更能建立信任" },
  ];

  // 不同活动的叙事重点不同：高海拔/高难度偏专业克制，城市偏生活方式，亲子偏成长与陪伴
  const MOTIVATION_WEIGHT = {
    "高海拔登山": { mastery: 12, achievement: 6, timing: 2, companionship: -10, escape: -12, ease: -12 },
    "攀岩": { mastery: 9, achievement: 4, companionship: -6 },
    "滑雪": { mastery: 9, achievement: 4, companionship: -4 },
    "骑行": { mastery: 5, achievement: 4 },
    "城市旅行": { escape: 5, ease: 3, timing: 3, achievement: -3 },
    "景区观光": { escape: 5, ease: 3, timing: 3, achievement: -3 },
    "亲子活动": { growth: 7, companionship: 5 },
    "研学": { growth: 7, achievement: 3 },
    "露营": { escape: 4, timing: 3, companionship: 2 },
  };
  function motivationWeight(a, key) {
    let w = (MOTIVATION_WEIGHT[a.type] || {})[key] || 0;
    if (a.difficulty === "挑战") {
      if (key === "mastery" || key === "achievement") w += 6;
      if (key === "ease" || key === "escape") w -= 8;
    }
    return w;
  }
  function buildConcepts(a) {
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    const place = a.place || "这次活动";
    const dist = a.distance ? `${a.distance}公里` : "";
    const days = a.days > 1 ? `${a.days}天` : "一天";
    const age = confirmed.has("age") ? (a.ageRange || "") : "";
    const limit = a.limit ? `${a.limit}${a.limitUnit}` : "";
    const elevation = a.elevation ? `${a.elevation}米` : "";
    const isFam = isFamilyActivity(a);
    const services = [];
    if (a.includeLeader) services.push("领队");
    if (a.includeMeal) services.push("餐食");
    if (a.includeInsurance) services.push("保险");
    if (a.includeTransport) services.push("交通");
    if (a.includeGear) services.push("装备");
    const safeServices = confirmed.has("services") ? services : [];
    const candidates = [];
    const add = (id, name, headline, intro, story, poster, reason, score) => candidates.push({
      id, motivation: id, motivationLabel: name, concept_name: name, name, mood: id,
      headline, intro, story_direction: story, poster_line: poster,
      channel: "活动页 / 微信 / 朋友圈", reason, score
    });

    if (dist && isFam) add(
      "measurable-growth", "一段可以完成的成长",
      `${dist}，是孩子第一次自己掌握行走节奏的具体尺度。`,
      `${place}把成长变成了一段看得见的距离。${age ? `这次活动面向${age}，` : ""}家长陪在身边，孩子用自己的节奏走完${dist}。`,
      "用距离记录孩子从出发到完成的变化", `这一次，让他自己走完${dist}。`,
      `${dist}${age ? `和${age}` : ""}是本场最具体、最有辨识度的事实。`, 100
    );
    if (elevation) add(
      "altitude", "高度是一条边界",
      `${elevation}，每一步都需要认真对待。`,
      `目的地是${place}，已知目标海拔为${elevation}${a.days > 1 ? `，行程共${days}` : ""}。页面不承诺登顶，只把强度、准备和真实行程说明白。`,
      "先讲海拔与强度，再讲风景", `${elevation}，认真对待。`,
      `海拔${elevation}直接决定用户是否适合参加。`, 96
    );
    if (dist) add(
      "distance", "路程有了刻度",
      `${place}，用${dist}把这次出发说清楚。`,
      `这不是一句模糊的“去山里走走”。本次${a.type}的已知距离是${dist}${a.days > 1 ? `，安排在${days}内完成` : ""}，用户可以据此判断自己的时间与体力。`,
      "围绕路线长度组织画面和信息", `${dist}，走完再回来。`,
      `${dist}让活动从抽象体验变成可判断的具体路线。`, 82
    );
    if (a.meetTime && a.returnTime) add(
      "time-window", "一天的完整去向",
      `${a.meetTime}出发，${a.returnTime}回来，把这一天交给${place}。`,
      `从${a.meetTime}${a.meeting ? `在${a.meeting}` : ""}集合，到${a.returnTime}返回，时间边界已经明确。对用户而言，这是一次可以直接放进日程里的${a.type}。`,
      "用出发与返回构成完整时间叙事", `${a.meetTime}出发，${a.returnTime}回来。`,
      `明确的出发与返回时间降低了报名决策成本。`, 88
    );
    if (a.days > 1) add(
      "duration", `${days}的连续体验`,
      `${days}，不是路过${place}，是把时间真正留在这里。`,
      `本次${a.type}共${days}${dist ? `，已知距离为${dist}` : ""}。页面将重点呈现每天的真实安排，让用户先理解节奏，再决定是否参加。`,
      "以每天的变化建立长线叙事", `把${days}留给${place}。`,
      `${days}是这场活动区别于单日体验的核心事实。`, 84
    );
    if (limit) add(
      "capacity", "名额是明确的",
      `这一场，只开放${limit}。`,
      `本次活动的招募上限是${limit}。不使用“精品小团”等未经确认的包装，只把真实名额、日期与报名信息清楚呈现。`,
      "用真实名额形成行动理由", `${limit}，本次招募。`,
      `招募上限来自老板输入，可以直接用于报名转化。`, 72
    );
    if (safeServices.length) add(
      "confirmed-service", "已确认的省心",
      `${safeServices.join("、")}，已经写进这次${place}的安排。`,
      `本次已经确认包含${safeServices.join("、")}。页面只展示这些明确服务，不补充酒店、交通、安全承诺或其他未确认项目。`,
      "把已确认服务放在决策信息中", `已确认包含${safeServices.join("、")}。`,
      `这些服务来自老板输入，是可以对外表达的真实信息。`, 68
    );
    add(
      "specific-invitation", "把活动说具体",
      `${a.dateMD || "这一次"}，去${place}完成一场${a.type}。`,
      `${a.dateMD ? `时间是${a.dateMD}，` : ""}地点是${place}，活动是${a.type}${age ? `，面向${age}` : ""}${a.price != null ? `，费用为${a.price}元/${a.limitUnit}` : ""}。信息足够清楚，出发才不需要靠想象。`,
      "用已确认事实建立可信邀请", `${a.dateMD || "这一次"}，去${place}。`,
      "当独特素材较少时，清楚准确比空泛抒情更有说服力。", 45
    );

    const seen = new Set();
    return candidates
      .sort((x, y) => y.score - x.score || x.id.localeCompare(y.id))
      .filter((c) => !seen.has(c.id) && seen.add(c.id))
      .slice(0, 3)
      .map(({ score, ...c }) => c);
  }



  // V2.0：标题分三类——品牌型（创意概念主宣传语，必须引用具体事实）/ 信息型 / 招募型

  /* 有温度、结合季节/气候/地点、不堆砌日期的详情页引言；按创意方向的情绪变化文体 */






  // 多平台文案：公式化（Hook+场景+干货+召唤）+ 去 AI 味，复用已确认事实




  function parseDateBase(dstr) {
    if (!dstr) return null;
    const m = dstr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const m2 = dstr.match(/(\d{1,2})月(\d{1,2})日/);
    if (m2) return new Date(curYear(), +m2[1] - 1, +m2[2]);
    return null;
  }
  function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }
  // 行程录入：机构粘贴真实行程（微信/Word/旧文案），AI 只负责分段与整理，不编造事实
  const CN_NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
  function cn2num(s) {
    if (/^\d+$/.test(s)) return +s;
    if (CN_NUM[s]) return CN_NUM[s];
    if (s.length === 2 && CN_NUM[s[0]] === 10) return 10 + (CN_NUM[s[1]] || 0);
    return 1;
  }
  function parseItinerary(text) {
    if (!text || !text.trim()) return [];
    const lines = text.split(/\r?\n+/).map((s) => s.trim()).filter(Boolean);
    const days = [];
    let cur = null;
    const pushCur = () => { if (cur) days.push(cur); };
    for (const line of lines) {
      let m;
      if ((m = line.match(/^(?:第\s*)?([一二三四五六七八九十\d]+)\s*(?:天|日|Day|day)(?=$|\s|：|·)/i))) {
        pushCur();
        const n = cn2num(m[1]);
        cur = { label: `第 ${n} 天`, sub: "", items: [] };
        const rest = line.replace(/^(?:第\s*)?([一二三四五六七八九十\d]+)\s*(?:天|日|Day|day)(?=$|\s|：|·)/i, "").trim();
        if (rest) cur.items.push({ time: "", text: rest });
        continue;
      }
      if ((m = line.match(/^day\s*(\d+)/i))) {
        pushCur();
        const n = +m[1];
        cur = { label: `第 ${n} 天`, sub: "", items: [] };
        const rest = line.replace(/^day\s*\d+/i, "").trim();
        if (rest) cur.items.push({ time: "", text: rest });
        continue;
      }
      let time = "", text2 = line;
      if ((m = line.match(/^(\d{1,2})[:：](\d{2})\s*[：: ]*\s*(.*)$/))) { time = `${m[1]}:${m[2]}`; text2 = m[3]; }
      else if ((m = line.match(/^(\d{1,2})\s*点\s*(?:[：: ]*)\s*(.*)$/))) { time = `${m[1]}:00`; text2 = m[2]; }
      else if ((m = line.match(/^(上午|早上|中午|下午|傍晚|晚上|凌晨)\s*[：: ]*\s*(.*)$/))) { time = m[1]; text2 = m[2]; }
      if (!cur) cur = { label: "行程安排", sub: "", items: [] };
      if (text2) cur.items.push({ time, text: text2 });
    }
    pushCur();
    if (!days.length) days.push({ label: "行程安排", sub: "", items: [{ time: "", text: text.trim() }] });
    return days;
  }
  // 保证 itineraryDays 数量与 days 一致（空天仅占位，等机构填充真实内容）
  function syncItineraryDays(a) {
    const n = Math.max(1, a.days || 1);
    const arr = a.itineraryDays || [];
    const out = [];
    for (let i = 0; i < n; i++) {
      if (arr[i]) out.push(arr[i]);
      else out.push({ label: n > 1 ? `第 ${i + 1} 天` : "行程安排", sub: "", items: [] });
    }
    a.itineraryDays = out;
  }

  /* ---------------- equipment intelligence ---------------- */
  const EQUIP_DB = {
    hiking: {
      mandatory: ["徒步/运动鞋", "双肩背包", "饮用水（≥1L）", "防晒用品", "雨具", "手机与充电宝", "个人证件"],
      recommended: ["登山杖", "速干衣裤", "替换衣物", "能量零食", "驱蚊液", "头灯/小手电", "垃圾袋"],
    },
    camping: {
      mandatory: ["帐篷", "睡袋", "防潮垫", "头灯/营地灯", "营地炊具", "饮用水与食物", "保暖衣物"],
      recommended: ["天幕", "折叠椅", "充电宝", "防蚊用品", "拖鞋", "洗漱包", "急救包", "垃圾袋"],
    },
    cycling: {
      mandatory: ["头盔", "骑行手套", "水壶/水袋", "备胎与修车工具", "反光背心", "手机"],
      recommended: ["骑行眼镜", "速干衣", "防晒", "能量补给", "小背包", "雨衣"],
    },
    rafting: {
      mandatory: ["救生衣", "防水袋", "防滑鞋", "换洗衣物", "毛巾", "防晒"],
      recommended: ["防水手机袋", "溯溪鞋", "速干衣", "能量零食", "保温杯"],
    },
    climbing: {
      mandatory: ["安全带", "头盔", "攀岩鞋", "主锁/保护器", "粉袋", "手机"],
      recommended: ["防滑粉", "运动手套", "能量补给", "防晒", "保暖层"],
    },
    skiing: {
      mandatory: ["滑雪服", "雪镜", "手套", "头盔", "保暖内层", "防晒（高原强紫外线）"],
      recommended: ["护具", "雪袜", "暖宝宝", "能量零食", "润唇膏"],
    },
    general: {
      mandatory: ["运动鞋", "饮用水", "防晒用品", "雨具", "替换衣物", "手机"],
      recommended: ["双肩包", "能量零食", "充电宝", "驱蚊液", "湿巾"],
    },
    city: {
      mandatory: ["舒适运动鞋", "轻便双肩包", "充电宝", "雨具", "防晒用品", "身份证件"],
      recommended: ["水杯", "小零食", "耳机", "纸巾湿巾", "随身小药包"],
    },
  };
  function equipType(type) {
    if (/徒步|登山|爬山/.test(type)) return "hiking";
    if (/露营|营地/.test(type)) return "camping";
    if (/骑行|自行车/.test(type)) return "cycling";
    if (/漂流|桨板|皮划艇|溯溪/.test(type)) return "rafting";
    if (/攀岩/.test(type)) return "climbing";
    if (/滑雪/.test(type)) return "skiing";
    if (/城市|景区|观光|旅行|自驾|摄影|团建/.test(type)) return "city";
    return "general";
  }


  function gearChipsHtml(a, must) {
    return (a.gear || [])
      .filter((g) => (typeof g === "string" ? false : g.must) === must)
      .map((g) => {
        const name = typeof g === "string" ? g : g.name;
        const note = typeof g === "object" && g.note ? g.note : "";
        const noteHtml = note ? `<span class="gnote" title="${esc(note)}">${esc(note)}</span>` : "";
        return `<span class="gear-chip ${note ? "has-note" : ""}"><span class="gname">${esc(name)}</span>${noteHtml}<button class="gx" data-action="delGear" data-name="${esc(name)}">${ICON("x")}</button></span>`;
      }).join("");
  }
  function gearIcon(name) {
    if (/鞋|靴/.test(name)) return "shoe";
    if (/雨|防水/.test(name)) return "umbrella";
    if (/包/.test(name)) return "bag";
    if (/水|水杯|保温杯|饮水/.test(name)) return "droplet";
    if (/食|餐|零食|干粮|补给|能量/.test(name)) return "food";
    if (/充电|电池/.test(name)) return "battery";
    if (/衣|服|保暖|速干|替换/.test(name)) return "shirt";
    if (/防晒|墨镜|雪镜|太阳/.test(name)) return "sun";
    if (/头灯|手电|营灯|灯/.test(name)) return "headlamp";
    if (/帐|帐篷/.test(name)) return "tent";
    if (/头盔|帽/.test(name)) return "shield";
    if (/相机|手机/.test(name)) return "camera";
    if (/登山杖|杖/.test(name)) return "mountain";
    if (/证件|身份证/.test(name)) return "book";
    return "ruler";
  }

  // 智能解析用户粘贴的大段装备建议文本，拆分为结构化装备项
  function parseGearText(text) {
    if (!text || text.trim().length < 2) return [];
    let s = text.replace(/\s+/g, " ").replace(/[;；]/g, "；").trim();

    // 定位装备清单开始位置
    const markers = ["装备建议", "建议携带", "必备装备", "需要准备", "装备清单", "携带物品", "建议准备"];
    let start = -1;
    for (const m of markers) { const i = s.indexOf(m); if (i > -1) { start = i + m.length; break; } }
    if (start > -1) s = s.slice(start);
    s = s.replace(/^[：:\s]+/, "");

    // 按句号/分号切分成句
    const sentences = s.split(/[；。]/).map((x) => x.trim()).filter((x) => x.length > 1);
    if (!sentences.length && s.includes("、")) sentences.push(s);

    const out = [];
    sentences.forEach((sentence) => {
      const sent = sentence.replace(/^\d+[\.、]/, "").trim();
      // 判断是必备还是建议：含"可备/建议/可选/备用"即为建议，否则必备
      const isMust = !/可备|建议携带|可选|备用|酌情|自行/.test(sent);
      // 去掉常见动词前缀
      let content = sent;
      const verbs = ["穿着", "可备", "准备", "携带", "带上", "备好", "建议", "需", "需要", "请", "如"];
      for (const v of verbs) { if (content.startsWith(v)) { content = content.slice(v.length); break; } }

      const parts = splitGearParts(content).filter((p) => p && !/等用品|等物品|等$/.test(p));
      parts.forEach((part) => {
        const item = parseGearItem(part);
        if (item) { item.must = isMust; out.push(item); }
      });
    });

    // 去重
    const seen = new Set();
    return out.filter((it) => { const k = it.name + "|" + it.note; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  // 按顿号切分，但保护括号内的顿号不被误拆
  function splitGearParts(s) {
    const parts = [];
    let cur = "", depth = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch === "（" || ch === "(") depth++;
      else if (ch === "）" || ch === ")") depth--;
      if (ch === "、" && depth === 0) { parts.push(cur); cur = ""; }
      else cur += ch;
    }
    if (cur) parts.push(cur);
    return parts.map((p) => p.trim());
  }
  function parseGearItem(str) {
    let name = str.trim();
    let note = "";
    const m1 = name.match(/（([^）]+)）/);
    const m2 = name.match(/\(([^)]+)\)/);
    if (m1) { note = m1[1].trim(); name = name.replace(/（[^）]+）/, "").trim(); }
    else if (m2) { note = m2[1].trim(); name = name.replace(/\([^)]+\)/, "").trim(); }
    name = name.replace(/[及和等]$/, "").trim();
    if (name.length < 2) return null;
    return { name, note, must: false };
  }

  function departuresEditHtml(a) {
    syncDepartures(a);
    const deps = a.departures || [];
    const list = deps.map((d) => {
      const price = d.price != null ? d.price : (a.price || "");
      return `<div class="departure-card">
        <div class="dep-date">
          <div class="dep-week">${esc(d.weekDay || "")}</div>
          <div class="dep-md">${esc(formatDepartureSlash(d.date))}</div>
        </div>
        <div class="dep-fields">
          <input type="number" class="input input-sm" data-bind-dep="${d.id}" data-dep-key="price" value="${price}" placeholder="价格">
          <select class="select select-sm" data-bind-dep="${d.id}" data-dep-key="status">
            <option value="open" ${d.status === "open" ? "selected" : ""}>可报名</option>
            <option value="full" ${d.status === "full" ? "selected" : ""}>已满员</option>
            <option value="closed" ${d.status === "closed" ? "selected" : ""}>已截止</option>
          </select>
          <input type="text" class="input input-sm" data-bind-dep="${d.id}" data-dep-key="note" value="${esc(d.note || "")}" placeholder="备注，如余位3">
        </div>
        <button class="icon-btn" data-action="deleteDeparture" data-id="${d.id}" title="删除团期">${ICON("x")}</button>
      </div>`;
    }).join("");
    return `<div class="panel">
      <div class="panel-head"><h3>行程与团期</h3><span class="tiny muted">一个活动可设置多个出发日期，每个团期可独立定价</span></div>
      <div class="panel-body">
        <div class="departure-add-row">
          <div class="field">
            <label>开始日期</label>
            <input type="date" class="input" id="depStartDate">
          </div>
          <div class="field">
            <label>结束日期（可选）</label>
            <input type="date" class="input" id="depEndDate">
          </div>
          <div class="field">
            <label>价格（可选）</label>
            <input type="number" class="input" id="depPriceInput" placeholder="默认 ¥${a.price || 0}">
          </div>
          <button class="btn btn-primary btn-sm" data-action="addDeparture">${ICON("plus")} 批量添加团期</button>
        </div>
        <div class="dep-hint"><span style="opacity:.7"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg></span> 选择起止日期可批量生成每一天的团期；只填开始日期则添加单日。已存在日期会自动跳过。</div>
        ${deps.length ? `<div class="departure-list">${list}</div>` : `<div class="dep-empty"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg><div><b>还没有团期</b><div>在上方选择日期范围，一键生成多日团期</div></div></div>`}
      </div>
    </div>`;
  }

  function memberMarketingEditHtml(a) {
    const tiers = state.memberTiers || [];
    const priceRows = tiers.map((t) => {
      const price = (a.tierPrices || {})[t.id];
      return `<div class="tier-price-row"><span class="tier-name" style="color:${esc(t.color)}">${ICON(t.icon)} ${esc(t.name)}</span><input type="number" class="input input-sm" data-bind-tier="${t.id}" value="${price != null ? price : ""}" placeholder="默认 ¥${a.price || 0}"></div>`;
    }).join("");
    return `<div class="panel">
      <div class="panel-head"><h3>会员与营销</h3><span class="tiny muted">每个俱乐部可独立设定会员体系与活动优惠规则</span></div>
      <div class="panel-body">
        <div class="opt-row">
          <label class="switch-label">
            <input type="checkbox" ${a.useMemberPrice ? "checked" : ""} data-action="toggleActOpt" data-key="useMemberPrice">
            <span>执行会员价</span>
          </label>
          <p class="tiny muted">开启后，不同等级会员报名时显示对应价格；不填则自动 fallback 到活动基础价</p>
          ${a.useMemberPrice ? `<div class="tier-price-list">${priceRows}</div>` : ""}
        </div>
        <div class="opt-row">
          <label class="switch-label">
            <input type="checkbox" ${a.allowPoints ? "checked" : ""} data-action="toggleActOpt" data-key="allowPoints">
            <span>接受会员积分抵现</span>
          </label>
          <p class="tiny muted">开启后会员可用积分抵扣部分报名费用</p>
        </div>
        <div class="opt-row">
          <label class="switch-label">
            <input type="checkbox" ${a.allowCoupons ? "checked" : ""} data-action="toggleActOpt" data-key="allowCoupons">
            <span>接受优惠券</span>
          </label>
          <p class="tiny muted">开启后会员可在报名时使用本俱乐部发放的优惠券</p>
        </div>
      </div>
    </div>`;
  }

  function leaderEditHtml(a) {
    ensureLeaders();
    const leaders = state.leaders || [];
    const editingId = a._editingLeaderId || "";
    const editing = editingId ? findLeaderById(editingId) : null;
    // 优先展示本次上传的草稿头像，未上传时才回落到资料库已有头像
    const avatar = (a._leaderAvatarDraft || "").trim() || (editing ? editing.avatar : "");
    const selectedCount = (a.leaderIds || []).length;
    return `<div class="panel" style="margin-bottom:18px">
      <div class="panel-head"><h3>领队与安全保障</h3><span class="tiny muted">据实填写，前端仅展示真实信息</span></div>
      <div class="panel-body">
        <div class="leader-library">
          <div class="tiny muted" style="margin-bottom:8px">从领队资料库选择（已保存 ${leaders.length} 位${selectedCount ? " · 本场已选 " + selectedCount + " 位" : ""}）</div>
          <div class="leader-chips">
            ${leaders.map((l) => {
              const sel = (a.leaderIds || []).includes(l.id);
              const isEditing = editingId === l.id;
              const av = l.avatar
                ? `<img class="lc-av" src="${esc(l.avatar)}" alt="">`
                : `<span class="lc-av-fallback" style="background:linear-gradient(140deg,var(--accent),#A86B2C)">${esc((l.name || "领")[0])}</span>`;
              return `<span class="leader-chip-wrap">
              <button class="leader-chip ${sel ? "sel" : ""} ${isEditing ? "editing" : ""}" data-action="toggleLeader" data-id="${l.id}">${av}<span>${esc(l.name)}${l.cert ? ` · ${esc(l.cert)}` : ""}</span></button>
              <button class="leader-chip-edit" data-action="editLeader" data-id="${l.id}" title="编辑资料">${ICON("edit")}</button>
            </span>`;
            }).join("")}
            <button class="leader-chip ghost" data-action="newLeader">+ 新建领队</button>
          </div>
        </div>

        <div class="leader-form-card">
          <div class="leader-form-head">
            <div class="leader-avatar-upload" data-action="uploadLeaderAvatar">
              ${avatar
                ? `<img class="leader-av-preview" src="${esc(avatar)}" alt=""><button class="logo-del" data-action="delLeaderAvatar" title="移除头像">${ICON("x")}</button>`
                : `<div class="leader-av-ph"><div class="ic">${ICON("upload")}</div><span>上传头像</span></div>`}
            </div>
            <input type="file" id="leaderAvatarInput" accept="image/*" style="display:none">
            <div class="leader-form-title">${editing ? "编辑领队资料" : "新建领队"}</div>
          </div>
          <div class="grid-2">
            <div class="field"><label>领队姓名 / 昵称</label><input class="input" data-bind="leaderName" value="${esc(a.leaderName || "")}"></div>
            <div class="field"><label>从业经验</label><input class="input" data-bind="leaderYears" value="${esc(a.leaderYears || "")}" placeholder="如：8 年户外领队"></div>
            <div class="field"><label>相关资质</label><input class="input" data-bind="leaderCert" value="${esc(a.leaderCert || "")}" placeholder="如：中国登山协会指导员"></div>
            <div class="field"><label>带队场次</label><input class="input" data-bind="leaderTrips" value="${esc(a.leaderTrips || "")}" placeholder="如：200+ 场"></div>
          </div>
          <div class="row gap-8" style="margin-top:10px">
            <button class="btn btn-soft btn-sm" data-action="saveLeader">${editing ? "保存到资料库" : "保存并加入活动"}</button>
            <button class="btn btn-ghost btn-sm" data-action="newLeader">清空/新建</button>
            ${editing && (a.leaderIds || []).includes(editingId) ? `<button class="btn btn-ghost btn-sm" data-action="removeLeaderFromActivity" data-id="${editingId}">从本场活动移除</button>` : ""}
            ${editing ? `<button class="btn btn-ghost btn-sm btn-danger" data-action="deleteLeader" data-id="${editingId}">从资料库删除</button>` : ""}
          </div>
        </div>
        <div class="tiny muted" style="margin-top:10px">领队头像上传后系统自动裁剪为圆形；未选择领队时，前端自动隐藏此模块，不生成虚假资质。</div>
      </div>
    </div>`;
  }
  function itineraryEditHtml(a) {
    const days = a.itineraryDays || [];
    const dayBlocks = days.map((day, di) => {
      const items = day.items.map((item, ii) => `
        <div class="itin-row">
          <input class="input itin-time" data-bind-itin="time" data-day="${di}" data-idx="${ii}" value="${esc(item.time)}" placeholder="时间">
          <input class="input itin-text" data-bind-itin="text" data-day="${di}" data-idx="${ii}" value="${esc(item.text)}" placeholder="行程内容">
          <button class="btn btn-ghost btn-sm" data-action="delItinItem" data-day="${di}" data-idx="${ii}">${ICON("x")}</button>
        </div>
      `).join("");
      return `
        <div class="itin-day">
          <div class="itin-day-head"><b>${esc(day.label)}</b><span class="tiny muted">${esc(day.sub)}</span></div>
          <div class="itin-items">${items}</div>
          <button class="btn btn-soft btn-sm" data-action="addItinItem" data-day="${di}">+ 添加行程项</button>
        </div>
      `;
    }).join("");
    return `
      <div class="panel" style="margin-bottom:18px">
        <div class="panel-head"><h3>详细行程 · 共 ${a.days || 1} 天</h3><span class="tiny muted">AI 先生成 · 你可手动调整</span></div>
        <div class="panel-body">
          ${dayBlocks}
          <div class="row gap-8" style="margin-top:12px">
            <button class="btn btn-soft btn-sm" data-action="regenItinerary">重新生成行程</button>
            <button class="btn btn-soft btn-sm" data-action="addItinDay" ${(a.days || 1) >= 7 ? "disabled" : ""}>+ 增加一天</button>
            <button class="btn btn-ghost btn-sm" data-action="delItinDay" ${(a.days || 1) <= 1 ? "disabled" : ""}>- 减少一天</button>
          </div>
        </div>
      </div>`;
  }

  /* ---------------- brand logo helpers ---------------- */
  function psLogo(white) {
    const b = state.brand;
    const inner = b.logo
      ? `<img class="l l-img" src="${esc(b.logo)}" alt="">`
      : `<span class="l"${white ? ' style="background:rgba(255,255,255,.25)"' : ""}>${esc(b.logoText || "C")}</span>`;
    return `<span class="ps-logo"${white ? ' style="color:#fff"' : ""}>${inner}${esc(b.name)}</span>`;
  }
  function brandMark() {
    const b = state.brand;
    if (b.logo) return `<div class="brand-logo brand-logo-img" style="background-image:url('${esc(b.logo)}')"></div>`;
    return `<div class="brand-logo">${esc(b.logoText || "C")}</div>`;
  }
  function orgLogo() {
    const b = state.brand;
    if (b.logo) return `<div class="org-logo org-logo-img" style="background-image:url('${esc(b.logo)}')"></div>`;
    return `<div class="org-logo">${esc(b.logoText || "C")}</div>`;
  }
  function gearRender(a, must, gearProduct) {
    const items = (a.gear || []).filter((g) => (typeof g === "string" ? false : g.must) === must);
    if (!items.length) return "";
      return `<div class="gear-group"><div class="gear-group-h">${must ? "必备装备" : "建议携带"}</div>
      <div class="gear-flow">${items.map((g) => {
        const name = typeof g === "string" ? g : g.name;
        const note = typeof g === "object" && g.note ? g.note : "";
        const hit = gearProduct && gearProduct[name];
        return `<div class="gear-item ${note ? "has-note" : ""} ${hit ? "has-mall" : ""}"><span class="gi">${ICON(gearIcon(name))}</span><div class="gi-text"><span class="gi-name">${esc(name)}</span>${note ? `<span class="gi-note">${esc(note)}</span>` : ""}</div>${hit ? `<button class="gi-link" data-action="mallProduct" data-id="${hit.id}" data-srctype="ai_gear_list" data-srcid="${a.id}"><span class="gi-member-t">商城同款</span><span class="gi-member-badge">会员价</span></button>` : ""}</div>`;
      }).join("")}</div></div>`;
  }

  // —— P3 活动 × 装备融合：把活动装备清单匹配到商城商品 ——
  // 关键词 → 商品标题/类目 谓词，避免泛化活动标签导致误匹配
  const GEAR_MATCH = [
    { kw: ["鞋", "徒步鞋", "登山鞋", "越野"], test: (p) => /(鞋)/.test(p.title + p.category) },
    { kw: ["杖", "手杖"], test: (p) => /杖/.test(p.title) },
    { kw: ["水", "饮水", "杯", "保温", "路餐"], test: (p) => /(水具|水壶|杯)/.test(p.category + p.title) },
    { kw: ["防晒", "帽", "渔夫帽"], test: (p) => /(帽)/.test(p.category + p.title) || /防晒/.test((p.tags || []).join()) },
    { kw: ["雨", "雨衣", "雨备"], test: (p) => /(雨具|雨衣)/.test(p.category + p.title) },
    { kw: ["灯", "照明", "头灯"], test: (p) => /(照明|灯)/.test(p.category + p.title) },
    { kw: ["包", "背包", "重装"], test: (p) => /(背包)/.test(p.category + p.title) },
    { kw: ["手套"], test: (p) => /手套/.test(p.title) },
    { kw: ["袜"], test: (p) => /袜/.test(p.title) },
    { kw: ["收纳", "袋"], test: (p) => /(收纳)/.test(p.category + p.title) },
    { kw: ["补给", "能量", "胶", "电解质"], test: (p) => /(补给)/.test(p.category + p.title) },
    { kw: ["营钉", "帐篷", "睡袋", "露营", "营地"], test: (p) => /(露营|睡眠)/.test(p.category + p.title) },
    { kw: ["头盔", "攀登", "攀岩", "雪山"], test: (p) => /(安全装备|头盔|绳|安全带)/.test(p.category + p.title) },
    { kw: ["安全带"], test: (p) => /安全带/.test(p.title) },
    { kw: ["绳"], test: (p) => /绳/.test(p.title) },
    { kw: ["防风", "外套", "冲锋衣"], test: (p) => /(冲锋衣|外套|防风)/.test(p.title) }
  ];
  // 推荐优先级：匹配 > 安全 > 品质 > 评价 > 价格 > 佣金（佣金绝不参与排序）
  function matchGearProducts(a) {
    const prods = state.mallProducts || [];
    const matchedIds = new Set();
    const gearProduct = {};
    (a.gear || []).forEach((g) => {
      const name = typeof g === "string" ? g : (g && g.name) || "";
      if (!name) return;
      for (const rule of GEAR_MATCH) {
        if (rule.kw.some((k) => name.indexOf(k) >= 0)) {
          // 只推荐商城在售有货商品（stock 为 null 视为不限库存）
          const hit = prods.find((p) => rule.test(p) && (p.stock == null || p.stock > 0));
          if (hit) { matchedIds.add(hit.id); if (!gearProduct[name]) gearProduct[name] = hit; }
          break;
        }
      }
    });
    return { matchedIds, gearProduct };
  }

  // —— 地点风景图：联网自动搜索 ——
  // 主源：Wikimedia Commons（CORS 友好、免 Key）；备用：Flickr 公共 feed（JSONP）。
  // 结果按地点缓存，老板可手动更换。
  const placePhotoCache = {};
  function fetchPlacePhotos(place, cb) {
    cb = cb || function () {};
    if (!place) { cb([]); return; }
    const key = String(place).trim();
    if (placePhotoCache[key]) { cb(placePhotoCache[key]); return; }
    let finished = false;
    let fkScript = null;
    let fkCbName = "";
    const cleanupFlickr = () => {
      try { if (fkCbName) delete window[fkCbName]; } catch (e) {}
      if (fkScript && fkScript.parentNode) fkScript.parentNode.removeChild(fkScript);
    };
    const done = (res) => {
      if (finished) return; finished = true;
      cleanupFlickr();
      const arr = (res || []).slice(0, 8);
      if (arr.length) placePhotoCache[key] = arr;
      cb(arr);
    };

    // 1) Wikimedia Commons（CORS + 免 Key）
    fetch("https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=" + encodeURIComponent(key) + "&prop=imageinfo&iiprop=url|thumburl&gsrlimit=12&format=json&origin=*")
      .then((r) => r.json())
      .then((data) => {
        const pages = (data && data.query && data.query.pages) || {};
        const arr = Object.values(pages).map((p) => {
          const ii = (p.imageinfo && p.imageinfo[0]) || {};
          return { src: ii.url || ii.thumburl || "", title: (p.title || "").replace(/^File:/, ""), author: "Wikimedia Commons" };
        }).filter((x) => x.src);
        if (arr.length) done(arr); else tryFlickr();
      })
      .catch(() => tryFlickr());

    // 2) Flickr 公共 feed（JSONP 备用）
    function tryFlickr() {
      if (finished) return;
      let fkDone = false;
      fkCbName = "fkcb_" + Math.random().toString(36).slice(2);
      window[fkCbName] = function (data) {
        const items = ((data && data.items) || []).map((it) => ({
          src: (it.media && it.media.m ? it.media.m.replace(/_m\.jpg$/, "_b.jpg") : ""),
          title: it.title || "",
          author: (it.author || "").replace(/^.*\("(.+)"\)\s*$/, "$1")
        })).filter((x) => x.src);
        if (!fkDone) { fkDone = true; done(items.slice(0, 8)); }
      };
      fkScript = document.createElement("script");
      fkScript.src = "https://www.flickr.com/services/feeds/photos_public.gne?tags=" + encodeURIComponent(key.replace(/\s+/g, ",")) + "&tagmode=any&format=json&jsoncallback=" + fkCbName;
      fkScript.onerror = () => { if (!fkDone) { fkDone = true; done([]); } };
      document.head.appendChild(fkScript);
      setTimeout(() => { if (!fkDone) { fkDone = true; done([]); } }, 7000);
    }

    setTimeout(() => done([]), 14000);
  }

  // 按活动类型 / 地点 / 季节 / 天气智能推荐装备清单（同时匹配商城商品）
  // 规则本地可跑、零依赖：依据 a.type/title/place、seasonOf(a)、a.elevation、天气关键词产出必备+建议，
  // 写入 a.gear 并去重；随后详情页经 matchGearProducts 自动挂「商城同款」。
  function autoRecommendGear(a) {
    if (!a) return { added: 0, total: 0 };
    const season = seasonOf(a);
    const typeText = ((a.type || "") + " " + (a.title || "") + " " + (a.place || ""));
    const elev = Number(a.elevation) || 0;
    const weatherText = ((a.raw || "") + " " + (a.weather || ""));
    const has = (...kws) => kws.some((k) => typeText.indexOf(k) >= 0);
    const wHas = (...kws) => kws.some((k) => weatherText.indexOf(k) >= 0);

    // 1) 活动分类（决定装备主调）
    let cat = "hike";
    if (has("雪山", "高海拔", "技术", "攀冰") || elev >= 3500) cat = "alpine";
    else if (has("漂流", "溯溪", "溪降", "皮划艇", "桨板", "水域", "漂流")) cat = "water";
    else if (has("露营", "营地", "过夜", "野营", "帐篷")) cat = "camp";
    else if (has("亲子", "研学", "自然教育", "少儿", "儿童", "亲子活动")) cat = "family";
    else if (has("骑行", "自行车", "公路车")) cat = "cycling";

    // 2) 通用基础必备（所有户外）
    const must = [
      { name: "徒步鞋/登山鞋", note: "防滑、包裹脚踝" },
      { name: "速干衣裤", note: "避免棉质，出汗不闷" },
      { name: "双肩背包", note: "装水与补给，20-30L" },
      { name: "饮用水", note: "人均 1.5L 起" },
      { name: "路餐/能量补给", note: "坚果、能量棒" },
      { name: "防晒帽", note: "遮挡紫外线" },
      { name: "防晒霜", note: "SPF50+" },
      { name: "身份证", note: "报名与保险核验" }
    ];
    const recommend = [
      { name: "登山杖", note: "下坡护膝" },
      { name: "雨衣", note: "山区天气多变" },
      { name: "头灯", note: "防天黑" },
      { name: "充电宝", note: "手机续航" },
      { name: "替换衣物", note: "返程更换" }
    ];

    // 3) 分类补充
    if (cat === "alpine") {
      must.push(
        { name: "硬壳冲锋衣", note: "防风防水" },
        { name: "保暖中层", note: "抓绒或羽绒" },
        { name: "雪镜/墨镜", note: "防雪盲与紫外线" }
      );
      recommend.push(
        { name: "头盔", note: "技术路段保护" },
        { name: "保暖手套", note: "高海拔防护" },
        { name: "保温杯", note: "喝热水" }
      );
    } else if (cat === "water") {
      must.push(
        { name: "溯溪鞋/防滑凉鞋", note: "湿滑路面抓地" },
        { name: "防水袋", note: "保护手机衣物" },
        { name: "速干毛巾", note: "" }
      );
      recommend.push(
        { name: "换洗衣物", note: "全套备用" },
        { name: "防晒衣", note: "水上暴晒" }
      );
    } else if (cat === "camp") {
      must.push(
        { name: "帐篷", note: "按人数选择" },
        { name: "睡袋", note: "按夜温选择" },
        { name: "防潮垫", note: "" },
        { name: "营地灯", note: "" }
      );
      recommend.push(
        { name: "炉具/套锅", note: "热食" },
        { name: "折叠椅", note: "" },
        { name: "防风绳/营钉", note: "" }
      );
    } else if (cat === "family") {
      must.push(
        { name: "儿童防晒", note: "温和不刺激" },
        { name: "备用衣物", note: "多带一套" }
      );
      recommend.push(
        { name: "小背包", note: "孩子自己背" },
        { name: "驱蚊液", note: "" },
        { name: "湿巾", note: "" }
      );
    } else if (cat === "cycling") {
      must.push(
        { name: "骑行头盔", note: "必备" },
        { name: "骑行手套", note: "防滑" }
      );
      recommend.push(
        { name: "骑行镜", note: "" },
        { name: "反光背心", note: "夜骑可见" }
      );
    }

    // 4) 季节补充
    if (season === "冬季" || (season === "秋季" && cat === "alpine")) {
      must.push({ name: "保暖手套", note: "" }, { name: "抓绒帽", note: "护耳" });
      recommend.push({ name: "暖宝宝", note: "" });
    } else if (season === "夏季") {
      recommend.push({ name: "驱蚊液", note: "" }, { name: "降温巾", note: "" });
    }

    // 5) 海拔 / 天气补充
    if (elev >= 3000 || wHas("雪", "降温", "寒冷", "低温", "严寒")) {
      recommend.push({ name: "羽绒服", note: "高海拔保暖" });
    }
    if (wHas("雨", "雷阵雨", "降水", "潮湿", "小雨")) {
      if (!must.some((g) => g.name === "雨衣")) must.push({ name: "雨衣", note: "一次性或便携" });
    }
    if (wHas("大风", "阵风", "强风")) {
      recommend.push({ name: "防风外套", note: "" });
    }

    // 6) 合并去重写入 a.gear
    const arr = a.gear || [];
    const exists = new Set(arr.map((g) => (typeof g === "string" ? g : (g && g.name) || "")));
    let added = 0;
    [...must.map((g) => ({ ...g, must: true })), ...recommend.map((g) => ({ ...g, must: false }))].forEach((g) => {
      if (!g.name || exists.has(g.name)) return;
      arr.push(g); exists.add(g.name); added++;
    });
    a.gear = arr;
    confirmFact(a, "gear");
    saveState();
    return { added, total: arr.length, cat, season };
  }

  function gearMallRecs(a, matchedIds) {
    const prods = state.mallProducts || [];
    const riskW = { L3: 300, L2: 200, L1: 100 };
    return prods.map((p) => {
      const matched = matchedIds.has(p.id);
      const score = (matched ? 10000 : 0) + (riskW[p.riskLevel] || 0) + (p.rating || 0) * 50 - (p.retailPrice || 0) / 50;
      return { p, score, matched };
    }).sort((x, y) => y.score - x.score).slice(0, 6);
  }
  function renderGearMall(a, matchedIds) {
    const recs = gearMallRecs(a, matchedIds);
    if (!recs.length) return "";
    return `<div class="gear-mall">
      <div class="gear-mall-h"><span>${ICON("shopping-bag")}</span> 可在商城一站式备齐 · 按「安全 &gt; 评价 &gt; 价格」推荐，正品直发、7 天无理由</div>
      <div class="gear-mall-grid">${recs.map((r) => `<button class="gear-mall-card" data-action="mallProduct" data-id="${r.p.id}" data-srctype="ai_gear_list" data-srcid="${a.id}">
        <div class="gmc-ph" style="background-image:url('${esc(r.p.cover)}')"></div>
        <div class="gmc-body">
          <div class="gmc-title">${esc(r.p.title)}</div>
          <div class="gmc-meta"><span class="gear-type g-${r.p.riskLevel}">${gearTypeLabel(r.p.riskLevel)}</span><span class="mall-rate">★ ${r.p.rating}</span>${r.matched ? `<span class="gmc-match">清单匹配</span>` : ""}</div>
          <div class="gmc-foot"><b>¥${r.p.retailPrice}</b><span class="gmc-go">查看 ${ICON("arrow-right")}</span></div>
        </div>
      </button>`).join("")}</div>
    </div>`;
  }

  /* ---------------- phone / detail render ---------------- */
  // V1.3.2 智能焦点：用画面对比度、色彩与边缘密度找到主体，避免裁切到大片空天空。
  const PHOTO_FOCUS_CACHE = new Map();
  const PHOTO_FOCUS_PENDING = new Set();
  function focusValue(src) { return PHOTO_FOCUS_CACHE.get(src) || { x: 50, y: 48 }; }
  function updateSmartImages(src, focus) {
    document.querySelectorAll("img[data-smart-img]").forEach((img) => {
      if (img.getAttribute("src") === src) img.style.objectPosition = `${focus.x}% ${focus.y}%`;
    });
  }
  function analyzeImageFocus(src) {
    const fallback = () => ({ x: 50, y: 48, orientation: "landscape", quality_score: 0.6, category: "未分析", emotion: "真实", subjects: [], focal_point: { x: 0.5, y: 0.48 }, safe_text_area: "top-right", recommended_use: ["story"], duplicate_group: null, simulated: true });
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const max = 180, scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(24, Math.round(img.naturalWidth * scale));
          const h = Math.max(24, Math.round(img.naturalHeight * scale));
          const c = document.createElement("canvas"); c.width = w; c.height = h;
          const cx = c.getContext("2d", { willReadFrequently: true });
          cx.drawImage(img, 0, 0, w, h);
          const px = cx.getImageData(0, 0, w, h).data;
          const cells = [], gx = 12, gy = 12;
          const lumAt = (x, y) => { const i = (Math.min(h-1,y)*w + Math.min(w-1,x))*4; return px[i]*.299 + px[i+1]*.587 + px[i+2]*.114; };
          for (let yy=0; yy<gy; yy++) for (let xx=0; xx<gx; xx++) {
            const x0=Math.floor(xx*w/gx), x1=Math.max(x0+1,Math.floor((xx+1)*w/gx));
            const y0=Math.floor(yy*h/gy), y1=Math.max(y0+1,Math.floor((yy+1)*h/gy));
            let edge=0, sat=0, contrast=0, count=0, lum=0;
            for(let y=y0; y<y1; y+=2) for(let x=x0; x<x1; x+=2){
              const i=(y*w+x)*4, r=px[i],g=px[i+1],b=px[i+2], hi=Math.max(r,g,b),lo=Math.min(r,g,b), l=r*.299+g*.587+b*.114;
              sat += hi ? (hi-lo)/hi : 0;
              edge += Math.abs(l-lumAt(Math.min(w-1,x+2),y)) + Math.abs(l-lumAt(x,Math.min(h-1,y+2)));
              contrast += Math.abs(l-150); lum += l; count++;
            }
            const n = Math.max(1, count);
            const ny=(yy+.5)/gy, nx=(xx+.5)/gx;
            const centerPrior = 1 - Math.min(.7, Math.abs(nx-.5)*.55);
            const lowerPrior = .9 + ny*.18;
            const rawScore=(edge/n)*2.8 + (sat/n)*78 + (contrast/n)*.16;
            const score=rawScore * centerPrior * lowerPrior;
            cells.push({ x:(xx+.5)*100/gx, y:(yy+.5)*100/gy, score, rawScore, edge: edge/n, sat: sat/n, contrast: contrast/n, lum: lum/n });
          }
          cells.sort((a,b)=>b.score-a.score);
          const chosen=cells.slice(0,Math.max(5,Math.round(cells.length*.10)));
          let sw=0,sx=0,sy=0; chosen.forEach(v=>{const wt=Math.max(.01,v.score);sw+=wt;sx+=v.x*wt;sy+=v.y*wt;});
          let fx=Math.round(Math.max(18,Math.min(82,sx/sw))), fy=Math.round(Math.max(18,Math.min(84,sy/sw)));
          // 若原始分数最高的区域明显在上半部，防止 lowerPrior 把人像头部压出画面
          const rawTop=cells.slice().sort((a,b)=>b.rawScore-a.rawScore).slice(0,Math.max(3,Math.round(cells.length*.08)));
          if(rawTop.length){
            const rawTopY=rawTop.reduce((s,v)=>s+v.y,0)/rawTop.length;
            const rawTopScore=rawTop.reduce((s,v)=>s+v.rawScore,0)/rawTop.length;
            const bottomCells=cells.filter(v=>v.y>55);
            const bottomScore=bottomCells.length?bottomCells.reduce((s,v)=>s+v.rawScore,0)/bottomCells.length:0;
            if(rawTopY<45 && rawTopScore>(bottomScore*1.08+0.01)) fy=Math.min(fy, Math.round(Math.max(30, rawTopY+5)));
          }
          resolve(buildPhotoMeta(img, fx, fy, cells));
        } catch(e) { resolve(fallback()); }
      };
      img.onerror = () => resolve(fallback());
      if (/^https?:\/\//.test(src)) { img.crossOrigin = "anonymous"; img.referrerPolicy = "no-referrer"; }
      img.src = src;
    });
  }

  /* V2.0 图片理解层
     真实计算：焦点坐标、横竖朝向、画质评分、文字安全区（基于像素统计）
     模拟推断：类别、主体、情绪（无视觉模型时的启发式结果，UI 必须标注「模拟分析（演示）」） */
  function buildPhotoMeta(img, fx, fy, cells) {
    const W = img.naturalWidth || 1, H = img.naturalHeight || 1;
    const ratio = W / H;
    const orientation = ratio > 1.15 ? "landscape" : (ratio < 0.87 ? "portrait" : "square");
    const avg = (k) => cells.reduce((s, v) => s + (v[k] || 0), 0) / Math.max(1, cells.length);
    const edge = avg("edge"), sat = avg("sat"), contrast = avg("contrast"), lum = avg("lum");
    const quality = Math.max(0.35, Math.min(0.99, 0.42 + edge / 850 + contrast / 700 + Math.min(0.14, Math.min(W, H) / 5200)));
    // 文字安全区：选边缘最少、亮度适中的象限
    const quad = (bx, by) => { const q = cells.filter(v => v.x >= bx && v.x < bx + 50 && v.y >= by && v.y < by + 50); if (!q.length) return null; return { e: q.reduce((s,v)=>s+v.edge,0)/q.length, l: q.reduce((s,v)=>s+v.lum,0)/q.length }; };
    const qs = [["top-left", quad(0,0)], ["top-right", quad(50,0)], ["bottom-left", quad(0,50)], ["bottom-right", quad(50,50)]].filter(x => x[1]);
    let safe = "top-right";
    if (qs.length) safe = qs.slice().sort((a,b) => (a[1].e + Math.abs(a[1].l-170)*0.25) - (b[1].e + Math.abs(b[1].l-170)*0.25))[0][0];
    // —— 以下为启发式模拟，不可作为真实识别结果对外宣称 ——
    let category = "环境/细节", emotion = "真实", subjects = ["环境"];
    if (sat > 0.34 && edge > 16) { category = "山野/植被"; subjects = ["植被", "地形"]; }
    else if (lum > 165) { category = "天空/开阔地"; subjects = ["天空", "远景"]; }
    else if (edge > 24) { category = "人物/动态"; subjects = ["人物"]; }
    if (lum < 95) emotion = "沉静"; else if (sat > 0.3) emotion = "明快";
    const rec = [];
    if (quality >= 0.7 && orientation !== "portrait") rec.push("hero");
    rec.push("story");
    if (orientation === "portrait") rec.push("full");
    if (quality < 0.58) rec.push("detail");
    return {
      x: fx, y: fy,
      category, orientation, emotion, subjects,
      quality_score: Math.round(quality * 100) / 100,
      focal_point: { x: Math.round(fx) / 100, y: Math.round(fy) / 100 },
      safe_text_area: safe,
      recommended_use: rec,
      duplicate_group: null,
      simulated: true,
    };
  }
  function photoMeta(src) { return PHOTO_FOCUS_CACHE.get(src) || null; }

  function scheduleSmartFocus(src) {
    if (!src || PHOTO_FOCUS_CACHE.has(src) || PHOTO_FOCUS_PENDING.has(src)) return;
    PHOTO_FOCUS_PENDING.add(src);
    analyzeImageFocus(src).then((focus) => {
      PHOTO_FOCUS_PENDING.delete(src); PHOTO_FOCUS_CACHE.set(src, focus); updateSmartImages(src, focus);
    });
  }
  function smartPos(src) {
    if (!src) return "center";
    scheduleSmartFocus(src);
    const f = focusValue(src);
    return `${f.x}% ${f.y}%`;
  }
  function bestCoverIndex(a) {
    const photos = (a && a.photos) || [];
    if (!photos.length) return 0;
    let best = 0, bestScore = -1;
    photos.forEach((src, i) => {
      const meta = photoMeta(src);
      if (!meta) return;
      const uses = meta.recommended_use || [];
      const score = (meta.quality_score || 0) * 100
        + (uses.includes("hero") ? 35 : 0)
        + (meta.orientation === "landscape" ? 18 : 0)
        + ((meta.subjects || []).length ? 8 : 0)
        - (meta.category === "天空" ? 24 : 0);
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  }
  function coverStyle(a) {
    if (a.photos && a.photos[0]) return `background-image:url('${a.photos[0]}');background-position:${smartPos(a.photos[0])};`;
    return "";
  }
  // 详情页按活动类型切换版式 + 图文混排（模块化合，类型决定顺序与视觉基调）
  const STYLE_ACCENT = {
    city:   { grad: "linear-gradient(135deg,#1d2742,#3b2c52)", accent: "#E8B04B", vibe: "城市漫游 · 老街、夜景与烟火气" },
    sight:  { grad: "linear-gradient(135deg,#26473b,#3a5a4a)", accent: "#7FC8A9", vibe: "景区观光 · 慢游不赶路" },
    hike:   { grad: "linear-gradient(135deg,#233a2c,#3f5e3a)", accent: "#9CCC65", vibe: "山野徒步 · 一步一景" },
    alpine: { grad: "linear-gradient(135deg,#1a1a1a,#3a3a3a)", accent: "#E6E6E6", vibe: "高海拔登山 · 云端之上" },
    camp:   { grad: "linear-gradient(135deg,#3a2e22,#5a4a35)", accent: "#E0A96D", vibe: "露营 · 星空与篝火" },
    kids:   { grad: "linear-gradient(135deg,#ffd9c0,#ffb0a3)", accent: "#FF7043", vibe: "亲子户外 · 自然里的成长" },
    ski:    { grad: "linear-gradient(135deg,#1e3a5f,#3a6ea5)", accent: "#B3E5FC", vibe: "滑雪 · 雪道与速度" },
    cycling:{ grad: "linear-gradient(135deg,#2a2640,#4a3a5a)", accent: "#CE93D8", vibe: "骑行 · 风与路" },
    run:    { grad: "linear-gradient(135deg,#3a2626,#5a3a3a)", accent: "#FF8A65", vibe: "跑步 · 节奏与坚持" },
    climb:  { grad: "linear-gradient(135deg,#2a2626,#4a3a2a)", accent: "#FFB74D", vibe: "攀岩 · 向上每一步" },
    water:  { grad: "linear-gradient(135deg,#123a4a,#2a6a7a)", accent: "#4DD0E1", vibe: "溯溪玩水 · 清凉一夏" },
    drive:  { grad: "linear-gradient(135deg,#2a2a3a,#4a4a5a)", accent: "#90CAF9", vibe: "自驾旅行 · 自由在路上" },
    photo:  { grad: "linear-gradient(135deg,#2a263a,#5a3a4a)", accent: "#F48FB1", vibe: "摄影旅行 · 把风景带回家" },
    team:   { grad: "linear-gradient(135deg,#1f3a2a,#3a5a4a)", accent: "#81C784", vibe: "企业团建 · 一起出发" },
    travel: { grad: "linear-gradient(135deg,#2a3a4a,#4a5a6a)", accent: "#4DB6AC", vibe: "综合旅行 · 去远方" },
    outdoor:{ grad: "linear-gradient(135deg,#233a2c,#3f5e3a)", accent: "#9CCC65", vibe: "户外探索 · 把周末交给自然" },
  };
  function styleAccent(a) { return STYLE_ACCENT[a.pageStyle] || STYLE_ACCENT.outdoor; }
  function emotionLine(a) {
    if (a.headline) return a.headline;
    const T = a.type || "";
    if (/亲子|遛娃|儿童|少年|自然教育/.test(T)) return "这个周末，把手机还给孩子，把自然还给孩子。";
    if (/研学/.test(T)) return "最好的课堂，从来不带围墙。";
    if (/滑雪/.test(T)) return "雪季不该只活在收藏夹里。";
    if (/骑行/.test(T)) return "风、公路和自由，这次都给你。";
    if (/攀岩/.test(T)) return "抬头是岩壁与天空，低头是那个不敢尝试的自己。";
    if (/溯溪|桨板|漂流|玩水/.test(T)) return "夏天该有的样子，就是和水在一起。";
    if (/跑步|马拉松/.test(T)) return "不为 PB，只为那一程山风与晨光。";
    if (/自驾/.test(T)) return "方向盘一转，把周末交给公路、山谷和日落。";
    if (/摄影/.test(T)) return "把眼睛重新打开，把风景装进镜头。";
    if (/团建|企业/.test(T)) return "把团队带去山野，找回办公室里久违的默契。";
    if (/高海拔|雪山|登山/.test(T)) return "每一步，都在把海拔换成具体的体感。";
    if (/露营|营地/.test(T)) return "把闹钟关掉，去山里听一夜风声。";
    if (/徒步|爬山/.test(T)) return "城市待太久了，山风该吹一吹了。";
    if (/城市/.test(T)) return "城市待久了，总得找个周末，把一座城慢慢走完。";
    if (/景区|观光/.test(T)) return "不用做攻略，把假期过成朋友圈最羡慕的样子。";
    if (/旅行|游/.test(T)) return "你只管放松，剩下的交给山野。";
    return "走出城市，把周末交给自然。";
  }
  function coreTags(a) {
    const t = [];
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    if (confirmed.has("days") && a.days > 1) t.push(a.days + " 天行程");
    if (confirmed.has("age")) t.push("适合" + a.ageRange);
    if (confirmed.has("difficulty")) t.push(a.difficulty + "难度");
    if (confirmed.has("limit")) t.push("限额" + a.limit + a.limitUnit);
    if (confirmed.has("services") && a.includeLeader) t.push("含领队");
    return t.slice(0, 4);
  }
  function mediaBlock(a, i, label) {
    const ph = (a.photos || []);
    if (ph[i]) return `<div class="ph"><img class="ph-img" data-smart-img src="${ph[i]}" alt="" style="object-position:${smartPos(ph[i])};object-fit:cover"></div>`;
    const ac = styleAccent(a);
    return `<div class="ph ph-ph" style="background:${ac.grad}"><span class="ph-ic">${ICON("camera")}</span><span class="ph-lab">${esc(label || "现场实拍")}</span></div>`;
  }
  function galleryLayoutFor(a) {
    const p = a.pageStyle;
    if (p === "hike" || p === "alpine" || p === "ski") return "mosaic";
    if (p === "city" || p === "water") return "split";
    return "cards"; // kids, camp, sight, fallback
  }
  function galleryTitleFor(a) {
    const p = a.place || "这里";
    switch (a.pageStyle) {
      case "hike": return `${p}的山野，比滤镜更真实`;
      case "alpine": return `高处的人，最先看见光`;
      case "city": return `${p}的另一种打开方式`;
      case "camp": return `营地不是终点，是暂停`;
      case "water": return `水是${p}夏天的真实形状`;
      case "ski": return `雪季该有的样子，${p}都有`;
      case "kids": return `让孩子看见真实的世界`;
      case "sight": return `${p}的光，值得被认真看见`;
      default: return `走进现场，感受这次出发`;
    }
  }
  function galleryCaption(a) {
    // 优先用一段与 headline 不重复的地点季节短句
    const f = placeFlavorFor(a);
    if (f.seasonLine && a.headline && !a.headline.includes(f.seasonLine.slice(0, 10))) {
      return f.seasonLine.replace(/[。]$/, "") + "，照片里是没加修饰的真实现场。";
    }
    // 次选：从介绍中抽一句非 headline 的段落
    if (a.intro) {
      const paras = a.intro.split(/\n+/).map((s) => s.trim()).filter((s) => s && !s.includes(a.headline || "__NOHEAD__"));
      if (paras[0]) return paras[0].length > 44 ? paras[0].slice(0, 44) + "…" : paras[0];
    }
    // 兜底
    if (f.localVibe) return f.localVibe;
    return "照片记录的是活动的真实现场。";
  }
  function blockGallery(a) {
    const n = (a.photos || []).length;
    if (!n) return "";
    const title = galleryTitleFor(a);
    const caption = galleryCaption(a);
    const layout = galleryLayoutFor(a);
    const copy = `<span>FIELD NOTES</span><b>${esc(a.headline || title)}</b><small>${esc(caption)}</small>`;
    let inner;
    if (n === 1) {
      inner = `<div class="editorial-gallery one">${mediaBlock(a,0,"")}<div class="photo-note"><b>${esc(a.headline || title)}</b><span>${esc(caption)}</span></div></div>`;
    } else if (n === 2) {
      inner = `<div class="editorial-gallery two ${layout}"><div class="photo-a">${mediaBlock(a,0,"")}</div><div class="photo-copy">${copy}</div><div class="photo-b">${mediaBlock(a,1,"")}</div></div>`;
    } else {
      inner = `<div class="editorial-gallery many ${layout}"><div class="photo-a">${mediaBlock(a,0,"")}</div><div class="photo-b">${mediaBlock(a,1,"")}</div><div class="photo-copy">${copy}</div><div class="photo-c">${mediaBlock(a,2,"")}</div></div>`;
    }
    return `<section class="dsec story-sec editorial-sec"><div class="editorial-index">03 / MOMENTS</div><h3>${title}</h3>${inner}</section>`;
  }
  function departuresBlockHtml(a) {
    syncDepartures(a);
    const deps = (a.departures || []).filter((d) => d.status !== "closed");
    if (!deps.length) return "";
    if (deps.length === 1) {
      const d = deps[0];
      const price = d.price != null ? d.price : a.price;
      return `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("calendar")}</span><h3>行程与团期</h3></div>
        <div class="departure-single">
          <div class="dep-single-date"><span class="dep-single-week">${esc(d.weekDay)}</span><span class="dep-single-md">${esc(formatDepartureSlash(d.date))}</span></div>
          <div class="dep-single-info">
            <div class="dep-single-price">${price != null ? "¥" + price + "<small>/" + esc(a.limitUnit) + "</small>" : "价格详询"}</div>
            ${d.note ? `<div class="dep-single-note">${esc(d.note)}</div>` : ""}
          </div>
        </div>
      </div>`;
    }
    const cards = deps.map((d) => {
      const price = d.price != null ? d.price : a.price;
      const disabled = d.status === "full";
      return `<div class="departure-slide ${disabled ? "full" : ""}" data-departure-id="${d.id}">
        <div class="dep-slide-week">${esc(d.weekDay)}</div>
        <div class="dep-slide-md">${esc(formatDepartureSlash(d.date))}</div>
        <div class="dep-slide-price">${price != null ? "¥" + price : "详询"}</div>
        ${d.note ? `<div class="dep-slide-note">${esc(d.note)}</div>` : ""}
        ${disabled ? `<div class="dep-slide-badge">已满员</div>` : ""}
      </div>`;
    }).join("");
    return `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("calendar")}</span><h3>行程与团期</h3></div>
      <div class="departure-swiper">
        <div class="departure-track">${cards}</div>
      </div>
      <div class="tiny muted" style="margin-top:6px">左右滑动查看可报名团期，报名时请选择对应日期。</div>
    </div>`;
  }

  function blockLeader(a) {
    const ids = a.leaderIds || [];
    if (!ids.length) return "";
    const list = ids.map((id) => findLeaderById(id)).filter(Boolean);
    if (!list.length) return "";
    const cards = list.map((l, i) => {
      const rows = [];
      if (l.years) rows.push(["从业经验", l.years]);
      if (l.cert) rows.push(["相关资质", l.cert]);
      if (l.trips) rows.push(["带队场次", l.trips]);
      const av = l.avatar
        ? `<div class="leader-av leader-av-img" style="background-image:url('${esc(l.avatar)}')"></div>`
        : `<div class="leader-av">${esc((l.name || "领")[0])}</div>`;
      const tag = i === 0 ? "主领队" : (i === list.length - 1 ? "收尾领队" : "协作领队");
      const rowsHtml = rows.map(([k, v]) => `<div class="leader-meta-row"><span class="leader-meta-label">${esc(k)}</span><span class="leader-meta-value">${esc(v)}</span></div>`).join("");
      return `<div class="leader-slide-card leader-slide-card-v2">
        <div class="leader-top">
          ${av}
          <div class="leader-name-line"><span class="leader-name-text">${esc(l.name)}</span><span class="leader-tag">${tag}</span></div>
        </div>
        ${rowsHtml ? `<div class="leader-meta">${rowsHtml}</div>` : ""}
      </div>`;
    }).join("");
    const dots = list.length > 1 ? `<div class="leader-dots">${list.map((_, i) => `<span class="ld ${i === 0 ? "active" : ""}"></span>`).join("")}</div>` : "";
    return `<div class="dsec"><h3><span class="bar"></span>领队与安全保障</h3>
      <div class="leader-swiper">
        <div class="leader-track" id="leaderTrack">${cards}</div>
      </div>
      ${dots}
      <div class="tiny muted" style="margin-top:8px">具体的安全说明与应急安排，以机构出团通知为准。</div>
    </div>`;
  }

  // 领队资料库：复用真实领队信息，避免每场活动重复填写
  function ensureLeaders() { if (!state.leaders) state.leaders = []; }
  function findLeaderById(id) { return (state.leaders || []).find((l) => l.id === id); }
  function loadLeaderIntoDraft(a, id) {
    const l = findLeaderById(id);
    if (!l) return;
    a._editingLeaderId = id;
    a.leaderName = l.name || "";
    a.leaderYears = l.years || "";
    a.leaderCert = l.cert || "";
    a.leaderTrips = l.trips || "";
  }
  function clearLeaderDraft(a) {
    a._editingLeaderId = "";
    a.leaderName = "";
    a.leaderYears = "";
    a.leaderCert = "";
    a.leaderTrips = "";
  }
  function toggleLeader(a, id) {
    ensureLeaders();
    const ids = a.leaderIds = a.leaderIds || [];
    const idx = ids.indexOf(id);
    if (idx >= 0) {
      ids.splice(idx, 1);
      if (a._editingLeaderId === id) clearLeaderDraft(a);
    } else {
      ids.push(id);
      loadLeaderIntoDraft(a, id);
      confirmFact(a, "leaderInfo");
    }
    saveState();
  }
  function removeLeaderFromActivity(a, id) {
    const ids = a.leaderIds = a.leaderIds || [];
    const idx = ids.indexOf(id);
    if (idx >= 0) ids.splice(idx, 1);
    if (a._editingLeaderId === id) clearLeaderDraft(a);
    saveState();
  }
  function saveLeaderFromDraft(a) {
    ensureLeaders();
    const name = String(a.leaderName || "").trim();
    if (!name) { toast("请先填写领队姓名"); return false; }
    const editingId = a._editingLeaderId || "";
    const existing = editingId ? findLeaderById(editingId) : null;
    const avatar = (a._leaderAvatarDraft || "").trim();
    if (existing) {
      existing.name = name;
      existing.years = a.leaderYears || "";
      existing.cert = a.leaderCert || "";
      existing.trips = a.leaderTrips || "";
      if (avatar) existing.avatar = avatar;
      existing.updatedAt = Date.now();
      if (!(a.leaderIds || []).includes(existing.id)) a.leaderIds.push(existing.id);
    } else {
      const id = uid();
      state.leaders.push({ id, name, years: a.leaderYears || "", cert: a.leaderCert || "", trips: a.leaderTrips || "", avatar: avatar || "", createdAt: Date.now() });
      a.leaderIds = a.leaderIds || [];
      a.leaderIds.push(id);
      a._editingLeaderId = id;
    }
    a._leaderAvatarDraft = "";
    saveState();
    confirmFact(a, "leaderInfo");
    return true;
  }
  function deleteLeaderFromLibrary(id) {
    ensureLeaders();
    state.leaders = (state.leaders || []).filter((l) => l.id !== id);
    (state.activities || []).forEach((a) => {
      a.leaderIds = (a.leaderIds || []).filter((lid) => lid !== id);
      if (a._editingLeaderId === id) clearLeaderDraft(a);
    });
    saveState();
  }
  // 领队头像：上传后自动居中裁剪为 1:1 正方形（前端圆形容器展示即为圆形头像）
  function cropToSquare(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const c = document.createElement("canvas");
        c.width = 256; c.height = 256;
        const cx = c.getContext("2d");
        cx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
        resolve(c.toDataURL("image/png"));
      };
      img.onerror = () => resolve("");
      img.src = src;
    });
  }

  // 头像手动裁剪编辑器：上传后可在圆形取景框内拖拽/缩放，确认后再生成头像
  let cropState = null;
  const CROP_VIEW = 260; // 取景框尺寸
  const CROP_OUT = 256;  // 输出头像尺寸
  function openAvatarCropper(src) {
    cropState = { src, w: 0, h: 0, scale: 1, x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };
    let overlay = $("#avatarCropOverlay");
    if (overlay) { if (overlay._cropCleanup) overlay._cropCleanup(); overlay.remove(); }
    overlay = document.createElement("div");
    overlay.className = "avatar-crop-overlay";
    overlay.id = "avatarCropOverlay";
    overlay.innerHTML = `
      <div class="avatar-crop-modal">
        <div class="avatar-crop-head">
          <h4>调整头像显示区域</h4>
          <p class="tiny muted">拖动图片，或滚动缩放，确保面部居中清晰</p>
        </div>
        <div class="avatar-crop-body">
          <div class="crop-stage" id="cropStage">
            <div class="crop-frame"></div>
            <img class="crop-img" id="cropImg" src="${esc(src)}" draggable="false" alt="">
          </div>
          <div class="crop-preview-col">
            <canvas class="crop-preview" id="cropPreview" width="64" height="64"></canvas>
            <span class="tiny muted">预览</span>
          </div>
        </div>
        <div class="crop-zoom">
          <span class="tiny muted">-</span>
          <input type="range" id="cropZoom" min="0" max="100" value="0">
          <span class="tiny muted">+</span>
        </div>
        <div class="avatar-crop-actions">
          <button class="btn btn-ghost btn-sm" data-action="autoCenterAvatar">自动居中</button>
          <button class="btn btn-ghost btn-sm" data-action="cancelAvatarCrop">取消</button>
          <button class="btn btn-soft btn-sm" data-action="confirmAvatarCrop">确认使用</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const img = $("#cropImg");
    const doFit = () => {
      if (!cropState || !cropState.w) return;
      cropState.scale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      cropState.x = 0; cropState.y = 0;
      updateCropPreview();
      if (img) img.classList.add("loaded");
    };
    img.onload = () => {
      cropState.w = img.naturalWidth || img.width || 260;
      cropState.h = img.naturalHeight || img.height || 260;
      doFit();
    };
    if (img.complete && img.naturalWidth) {
      cropState.w = img.naturalWidth; cropState.h = img.naturalHeight;
      doFit();
    }
    bindCropEvents(overlay);
  }
  function autoCenterAvatarCrop() {
    if (!cropState || !cropState.w || !cropState.h) return;
    cropState.scale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
    cropState.x = 0; cropState.y = 0;
    updateCropPreview();
  }
  function updateCropPreview() {
    if (!cropState || !cropState.w || !cropState.h || !cropState.scale) return;
    const { w, h, scale, x, y } = cropState;
    const imgW = w * scale;
    const imgH = h * scale;
    const baseX = (CROP_VIEW - imgW) / 2;
    const baseY = (CROP_VIEW - imgH) / 2;
    const rawX = baseX + x;
    const rawY = baseY + y;
    const minX = CROP_VIEW - imgW;
    const minY = CROP_VIEW - imgH;
    const clampedX = Math.max(minX, Math.min(0, rawX));
    const clampedY = Math.max(minY, Math.min(0, rawY));
    cropState.x = clampedX - baseX;
    cropState.y = clampedY - baseY;
    const img = $("#cropImg");
    if (img) { img.style.width = `${imgW}px`; img.style.height = `${imgH}px`; img.style.left = `${clampedX}px`; img.style.top = `${clampedY}px`; }
    drawCropPreview();
    const zoom = $("#cropZoom");
    if (zoom) {
      const minScale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      const t = Math.log(scale / minScale) / Math.log(3);
      zoom.value = Math.max(0, Math.min(100, Math.round(t * 100)));
    }
  }
  function drawCropPreview() {
    if (!cropState || !cropState.w || !cropState.h) return;
    const canvas = $("#cropPreview");
    if (!canvas || !canvas.getContext) return;
    const cx = canvas.getContext("2d");
    const size = canvas.width;
    cx.clearRect(0, 0, size, size);
    const img = $("#cropImg");
    if (!img || !img.complete || !img.naturalWidth) return;
    const { w, h, scale, x, y } = cropState;
    const imgW = w * scale;
    const imgH = h * scale;
    const baseX = (CROP_VIEW - imgW) / 2;
    const baseY = (CROP_VIEW - imgH) / 2;
    const left = baseX + x;
    const top = baseY + y;
    const sx = -left / scale;
    const sy = -top / scale;
    const sSize = CROP_VIEW / scale;
    cx.drawImage(img, sx, sy, sSize, sSize, 0, 0, size, size);
  }
  function bindCropEvents(overlay) {
    const stage = overlay.querySelector(".crop-stage");
    const zoom = $("#cropZoom");
    const onStart = (e) => {
      if (!cropState) return;
      e.preventDefault();
      cropState.dragging = true;
      const p = e.touches ? e.touches[0] : e;
      cropState.lastX = p.clientX; cropState.lastY = p.clientY;
      stage.style.cursor = "grabbing";
    };
    const onMove = (e) => {
      if (!cropState || !cropState.dragging) return;
      e.preventDefault();
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - cropState.lastX;
      const dy = p.clientY - cropState.lastY;
      cropState.x += dx; cropState.y += dy;
      cropState.lastX = p.clientX; cropState.lastY = p.clientY;
      updateCropPreview();
    };
    const onEnd = () => { if (cropState) cropState.dragging = false; stage.style.cursor = "grab"; };
    stage.addEventListener("mousedown", onStart);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    stage.addEventListener("touchstart", onStart, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    stage.addEventListener("wheel", (e) => {
      e.preventDefault();
      if (!cropState || !cropState.w) return;
      const minScale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      const delta = e.deltaY > 0 ? -0.06 : 0.06;
      cropState.scale = Math.max(minScale, Math.min(minScale * 3, cropState.scale * (1 + delta)));
      updateCropPreview();
    }, { passive: false });
    zoom.addEventListener("input", () => {
      if (!cropState || !cropState.w) return;
      const minScale = Math.max(CROP_VIEW / cropState.w, CROP_VIEW / cropState.h);
      const t = parseInt(zoom.value, 10) / 100;
      cropState.scale = minScale * Math.pow(3, t);
      updateCropPreview();
    });
    overlay._cropCleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }
  function closeAvatarCropper() {
    const overlay = $("#avatarCropOverlay");
    if (overlay && overlay._cropCleanup) overlay._cropCleanup();
    if (overlay) overlay.remove();
    cropState = null;
  }
  function confirmAvatarCrop() {
    if (!cropState || !cropState.w || !state.draft) { closeAvatarCropper(); return; }
    const img = new Image();
    img.onload = () => {
      const { w, h, scale, x, y } = cropState;
      const imgW = w * scale;
      const imgH = h * scale;
      const baseX = (CROP_VIEW - imgW) / 2;
      const baseY = (CROP_VIEW - imgH) / 2;
      const left = baseX + x;
      const top = baseY + y;
      const sx = -left / scale;
      const sy = -top / scale;
      const sSize = CROP_VIEW / scale;
      const c = document.createElement("canvas");
      c.width = CROP_OUT; c.height = CROP_OUT;
      const cx = c.getContext("2d");
      cx.drawImage(img, sx, sy, sSize, sSize, 0, 0, CROP_OUT, CROP_OUT);
      state.draft._leaderAvatarDraft = c.toDataURL("image/png");
      saveState();
      rerenderEditor();
      closeAvatarCropper();
    };
    img.src = cropState.src;
  }

  // 兼容旧逻辑：单领队字段仍可通过 confirmFact 识别
  function matchLeaderByFields(a) {
    return (state.leaders || []).find((l) =>
      l.name === (a.leaderName || "") &&
      l.years === (a.leaderYears || "") &&
      l.cert === (a.leaderCert || "") &&
      l.trips === (a.leaderTrips || "")
    );
  }
  function blockStats(a) {
    const items = [];
    if (a.elevation) items.push(["海拔", a.elevation + " m", "trending-up"]);
    items.push(["天数", (a.days > 1 ? a.days + " 天" : "单日"), "calendar"]);
    const routeConflict = a.difficulty === "轻松" && ((+a.distance >= 10) || (+a.elevation >= 800 && a.type !== "高海拔登山"));
    items.push(["难度", routeConflict ? "待机构确认" : (a.difficulty || "待确认"), "activity"]);
    if (!items.length) return "";
    return `<div class="stat-row">${items.map(([k,v,ic]) => `<div class="stat"><span class="st-ic">${ICON(ic)}</span><span class="s-k">${esc(k)}</span><div class="s-v">${esc(v)}</div></div>`).join("")}</div>`;
  }
  function blockRoute(a) {
    const facts = [];
    if (a.distance) facts.push(["路线距离", a.distance + " 公里"]);
    if (a.elevation) facts.push(["累计爬升", a.elevation + " 米"]);
    if (a.days > 1) facts.push(["行程天数", a.days + " 天"]);
    if (!facts.length) return "";
    return `<section class="route-facts"><h3>路线数据</h3><div class="route-list">${facts.map(([k, v]) => `<div class="route-fact"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}</div><p class="route-note">具体轨迹、爬升和路况以机构确认的真实行程为准。</p></section>`;
  }
  function atmosphereSentence(a) {
    const p = a.place || "这里";
    const f = placeFlavorFor(a);
    const s = (f.seasonLine || "").replace(/[。，]/, "");
    const dir = a.contentStrategy || {};
    const mood = dir.mood || "";
    const lines = [
      `${s ? s + "，" : ""}${p}的${a.type}，是把自己从日常里短暂打捞出来的方式。`,
      `去${p}，不是为了逃避城市，是为了让${a.type === "滑雪" ? "雪" : "风"}把节奏重新吹慢。`,
      `在${p}，${a.type}不是表演，是认真在场。`,
      `${p}不会承诺你什么，但会给你一段真实的时间。`,
      `这个${a.dateMD || "周末"}，和${p}一起醒来。`,
      `${a.type}的真正奖励，从来不是终点，是${p}路上的那阵风。`,
      `去${p}，把${a.type}过成一种看得见的生活。`
    ];
    // 按方向 mood 轻微排序，让氛围句与主方向呼应
    const scored = lines.map((l, i) => {
      let sc = i;
      if (mood === "诗意" && /风|云|光/.test(l)) sc += 3;
      if (mood === "逃离" && /逃避|打捞|日常/.test(l)) sc += 3;
      if (mood === "完成" && /终点|奖励/.test(l)) sc += 3;
      if (mood === "陪伴" && /一起|陪伴/.test(l)) sc += 3;
      if (s && l.includes(s.slice(0, 6))) sc += 2;
      return { l, sc };
    }).sort((x, y) => y.sc - x.sc);
    return scored[0].l;
  }
  function blockAtmosphere(a, text) {
    const ac = styleAccent(a);
    return `<div class="atmosphere" style="background:${ac.grad}"><div class="at-ic">${ICON("quote")}</div><div class="at-txt">${esc(text)}</div></div>`;
  }
  function blockVideo(a) {
    if (a.videos && a.videos[0]) return `<div class="video-card"><video class="vc" src="${a.videos[0]}" muted loop autoplay playsinline poster="${((a.photos||[])[0]||"")}" onerror="this.style.display='none'"></video><span class="vc-play">${ICON("play")}</span><span class="vc-dur">真实活动记录</span></div>`;
    return ""; // 无视频内容时直接隐藏模块，不显示占位
  }
  function blockReviews(a) {
    if (!a.reviews || !a.reviews.length) return ""; // 无真实评价时隐藏，绝不冒充
    return `<div class="reviews"><div class="rv-head">往期评价</div>${a.reviews.slice(0, 6).map((r)=>`<div class="rv"><div class="rv-av" style="${r.avatar?`background-image:url('${esc(r.avatar)}')`:''}"></div><div class="rv-body"><div class="rv-row"><span class="rv-name">${esc(r.name||"匿名用户")}</span><span class="rv-stars">${"★".repeat(r.stars||5)}</span></div><div class="rv-txt">${esc(r.text||"")}</div></div></div>`).join("")}</div>`;
  }
  /* ===== V2.0 动态区块编排 =====
     区块只是渲染能力；顺序、是否出现、图片分配均由「内容 + 素材数量 + 数据有无」决定，
     不再按活动类型套用整页固定模板。节奏：感性吸引 → 视觉证据 → 故事 → 记忆点
     → 更多视觉 → 强度与适合人群 → 行程/服务/费用 → 报名。 */
  function buildPageOutline(a) {
    const photos = a.photos || [];
    const n = photos.length;
    const T = a.type;
    const isFam = isFamilyActivity(a);
    const hasItin = (a.itineraryDays || []).some((d) => (d.items || []).some((t) => t && (t.time || t.text)));
    const hasVideo = !!(a.videos && a.videos[0]);
    const hasReviews = !!(a.reviews && a.reviews.length);
    const hasLeader = !!a.leaderName;
    const hasGear = !!(a.gear && a.gear.length);
    const hasHl = !!(a.highlights && a.highlights.length);
    const svc = [];
    if (a.includeLeader) svc.push("领队");
    if (a.includeMeal) svc.push("餐食");
    if (a.includeInsurance) svc.push("保险");
    if (a.includeTransport) svc.push("交通");
    if (a.includeGear) svc.push("装备");

    const cover = Math.max(0, Math.min(+(a.coverIndex || 0), Math.max(0, n - 1)));
    const ranked = photos.map((src, i) => {
      const m = photoMeta(src);
      let score = m ? (m.quality_score || 0) * 100 : 50;
      if (m && m.orientation === "landscape") score += 8;
      if (i === cover) score = -1;
      return { i, score };
    }).filter((x) => x.i !== cover).sort((x, y) => y.score - x.score || x.i - y.i).map((x) => x.i);
    let cursor = 0;
    const take = (k) => {
      const result = ranked.slice(cursor, cursor + k);
      cursor += result.length;
      return result;
    };

    const fallbackStoryPurpose =
      T === "高海拔登山" ? "说明海拔、强度与每一天的行进目标"
      : (T === "城市旅行" || T === "景区观光") ? "呈现城市街区与生活方式"
      : T === "露营" ? "营地、夜晚与慢下来的时间"
      : T === "漂流" || T === "溯溪" || T === "桨板或皮划艇" ? "水、浪与出发前的那一下心跳"
      : T === "企业团建" ? "团队在一起完成的动作"
      : isFam ? "人物互动与共同完成的过程"
      : T === "徒步" ? "路线、距离与沿途变化"
      : "活动当天的真实过程";
    const storyPurpose = (a.storyPurpose && String(a.storyPurpose).trim()) || fallbackStoryPurpose;

    const out = [];
    let capIdx = 0;
    // 只使用 AI/用户提供的真实照片配文；没有配文时不展示内部用途标签
    const nextCaption = () => {
      const caps = a.photoCaptions || [];
      const c = caps[capIdx];
      capIdx++;
      return (c && String(c).trim()) ? String(c).trim() : "";
    };

    // 自适应相册：按照片数量把图分组，营造杂志式“大图 + 留白 + 图文交错”的节奏
    function splitPhotos(cnt) {
      if (cnt <= 0) return [];
      if (cnt === 1) return [1];
      if (cnt === 2) return [2];
      if (cnt === 3) return [3];
      if (cnt === 4) return [2, 2];
      if (cnt === 5) return [3, 2];
      if (cnt === 6) return [3, 3];
      if (cnt === 7) return [3, 2, 2];
      if (cnt === 8) return [3, 3, 2];
      if (cnt === 9) return [3, 3, 3];
      return [3, 3, 3, cnt - 9]; // 10 张以上：末组吃剩余
    }
    function photoCls(c) { return c === 1 ? "v2-full" : c === 2 ? "v2-pair" : c === 3 ? "v2-trio" : c === 4 ? "v2-grid" : "v2-mosaic"; }
    const bodyParas = (a.body && a.body.length) ? a.body.slice() : [];
    let bodyCursor = 0;
    // 图文交错：每放一组图就接一段正文，形成连续阅读节奏；无图时正文集中呈现
    function emitStory() {
      const remain = Math.max(0, ranked.length - cursor);
      const groups = splitPhotos(remain);
      groups.forEach((c) => {
        const p = take(c);
        if (!p.length) return;
        out.push({ type: "gallery", cls: photoCls(p.length), caption: nextCaption(), photos: p });
        if (bodyCursor < bodyParas.length) { out.push({ type: "text_block", para: bodyCursor }); bodyCursor++; }
      });
      while (bodyCursor < bodyParas.length) { out.push({ type: "text_block", para: bodyCursor }); bodyCursor++; }
    }
    const pushFull = () => { const f = take(1); if (f.length) out.push({ type: "gallery", cls: "v2-full", caption: nextCaption(), photos: f }); };

    // 开场策略按活动类型不同，中段图文统一智能交错，不再套用单一版式
    if (T === "高海拔登山") {
      out.push({ type: "metric_strip", purpose: "先判断海拔与强度" });
      pushFull();
      out.push({ type: "editorial_lead", purpose: "说明挑战的具体边界" });
      out.push({ type: "suitability", purpose: "说明适合与不适合人群" });
      out.push({ type: "pull_quote", purpose: "强调认真准备" });
      emitStory();
      out.push({ type: "route_story", purpose: "路线、距离与海拔信息" });
    } else if (T === "城市旅行" || T === "景区观光") {
      out.push({ type: "editorial_lead", purpose: "建立本次城市体验的主线" });
      emitStory();
      out.push({ type: "pull_quote", purpose: "形成城市记忆点" });
      pushFull();
      out.push({ type: "metric_strip", purpose: "快速判断时间与费用" });
    } else if (isFam) {
      out.push({ type: "editorial_lead", purpose: "说明这次同行将完成什么" });
      emitStory();
      out.push({ type: "pull_quote", purpose: "留下本场活动的记忆句" });
      pushFull();
      out.push({ type: "metric_strip", purpose: "帮助快速判断" });
    } else {
      pushFull();
      out.push({ type: "editorial_lead", purpose: "说明这场活动为什么值得来" });
      out.push({ type: "pull_quote", purpose: "形成记忆点" });
      emitStory();
      out.push({ type: "metric_strip", purpose: "快速判断强度与时间安排" });
      if (T === "徒步" || T === "高海拔登山") out.push({ type: "route_story", purpose: "路线与距离信息" });
    }
    // 新架构：消费者价值叙事——围绕核心传播主题，先回答「为什么值得去 → 来了会体验什么 → 参加完能得到什么 → 适合谁」
    // 只有当至少一项叙事字段有值时才插入叙事序列，否则详情页完全回退到旧架构（editorial_lead/body/selling_points），避免半新半旧。
    const hasNarrative = (a.whyGo && String(a.whyGo).trim()) || (a.experience && String(a.experience).trim()) || (a.gain && String(a.gain).trim()) || (a.fitFor && String(a.fitFor).trim()) || (a.notFitFor && String(a.notFitFor).trim());
    if (hasNarrative) {
      out.push({ type: "narrative_why", purpose: "回答：为什么值得去" });
      out.push({ type: "narrative_experience", purpose: "回答：来了会体验什么" });
      out.push({ type: "narrative_gain", purpose: "回答：参加完能得到什么" });
      out.push({ type: "narrative_fit", purpose: "回答：适合谁 / 不适合谁" });
    }
    out.push({ type: "selling_points", purpose: "路线核心卖点（多阶段管线输出）" });
    if (hasVideo) out.push({ type: "video", purpose: "真实活动记录" });

    // 决策信息
    out.push({ type: "fee", purpose: "先说明价格与费用包含/不含" });
    if (hasItin) out.push({ type: "itinerary", purpose: "提供理性决策信息" });
    else out.push({ type: "itinerary", purpose: "提示真实行程待补充", pending: true });
    if (svc.length) out.push({ type: "services", purpose: "说明已确认服务" });
    if (hasGear) out.push({ type: "gear", purpose: "出发前建议准备什么" });
    if (hasLeader) out.push({ type: "leader_safety", purpose: "真实领队资料" });
    if (hasHl) out.push({ type: "highlights", purpose: "归纳核心卖点" });
    if (hasReviews) out.push({ type: "reviews", purpose: "往期真实评价" });
    out.push({ type: "travel_notes", purpose: "退改与安全须知（多阶段管线输出）" });
    out.push({ type: "org", purpose: "机构信息" });
    return out;
  }

  // 适合 / 不适合人群：只依据已确认事实，不做医疗或安全承诺
  function blockSuitability(a) {
    const fit = [], unfit = [];
    const confirmed = new Set(confirmedFacts(a).map((f) => f.key));
    if (confirmed.has("age")) {
      fit.push("符合机构确认的年龄范围：" + a.ageRange);
      unfit.push("年龄不在 " + a.ageRange + " 范围内");
    }
    if (confirmed.has("difficulty")) fit.push("能够完成机构确认的“" + a.difficulty + "”强度");
    if (confirmed.has("days") && a.days > 1) fit.push("可以完整参加 " + a.days + " 天行程");
    if (confirmed.has("meetTime") && confirmed.has("meeting")) fit.push("可以按时到达 " + a.meeting);
    if (a.type === "高海拔登山" && !confirmed.has("difficulty")) unfit.push("尚未与机构确认体能和经验要求的人");
    if (!fit.length) fit.push("请先向机构确认年龄、体能和经验要求");
    if (!unfit.length) unfit.push("不符合机构最终报名条件的人");
    if (!fit.length && !unfit.length) return "";
    return `<div class="dsec"><div class="dsec-h"><span class="dsec-ic">${ICON("users")}</span><h3>适合与不适合</h3></div><div class="suit-grid">`
      + (fit.length ? `<div class="suit-col ok"><div class="suit-h">适合</div>${fit.map((t) => `<div class="suit-row">${ICON("check")}<span>${esc(t)}</span></div>`).join("")}</div>` : "")
      + (unfit.length ? `<div class="suit-col no"><div class="suit-h">不适合</div>${unfit.map((t) => `<div class="suit-row">${ICON("x")}<span>${esc(t)}</span></div>`).join("")}</div>` : "")
      + `</div></div>`;
  }

  function pageComposition(a) {
    if (a.type === "高海拔登山") return "expedition";
    if (a.type === "城市旅行" || a.type === "景区观光") return "city-guide";
    if (isFamilyActivity(a)) return "family-journal";
    if (a.type === "露营") return "camp-diary";
    return "route-journal";
  }

  function editorialSectionTitle(a) {
    if (a.editorialTitle && String(a.editorialTitle).trim()) return String(a.editorialTitle).trim();
    if (a.type === "高海拔登山") return "先看清强度，再决定是否出发";
    if (a.type === "城市旅行" || a.type === "景区观光") return `把${a.days > 1 ? a.days + "天" : "这一天"}留给${a.place}`;
    if (isFamilyActivity(a)) return a.distance ? `让孩子自己走完这${a.distance}公里` : "让孩子自己完成这一次";
    if (a.distance) return `这${a.distance}公里，具体意味着什么`;
    return `为什么是这次${a.place}${a.type}`;
  }

  /* ============ V2.1 文案深度引擎：Prompt Enhancer + 去 AI 味 + 公式 + 多阶段管线 ============ */
  // —— 去 AI 味黑名单：删除空洞无画面感词汇（出现即剔除）——
;


  // —— Prompt Enhancer：隐式变量补全 + 风格路由 ——




  // —— 公式化结构：[情绪Hook/痛点反差] + [核心场景/五感体验] + [轻量干货] + [行动召唤] ——





  // —— 多阶段管线：阶段 A 爆款标题与情绪前言 ——



  // —— 阶段 B 路线核心卖点（3 个具象场景卖点）——


  // —— 阶段 C 逻辑化逐日行程 ——


  // —— 阶段 D 后勤干货与安全须知 ——





  // 文案归一化：去掉空白与标点，便于判断两条文案是否实质相同
  function normCopyTxt(s) { return String(s || "").replace(/[\s\p{P}\p{S}]/gu, ""); }
  // 判断两条文案是否实质相同：完全相同 / 一方包含另一方 / 共同前缀 ≥ 6 字。
  // 用于避免「亮点 bullets」与「产品亮点卡片」把同一批卖点渲染两遍。
  function isSameCopy(a, b) {
    const x = normCopyTxt(a), y = normCopyTxt(b);
    if (!x || !y) return false;
    if (x === y) return true;
    if (x.includes(y) || y.includes(x)) return true;
    let i = 0;
    while (i < x.length && i < y.length && x[i] === y[i]) i++;
    return i >= 6;
  }
  function pipelineSellingHtml(a) {
    const pl = a.pipeline;
    if (!pl || !pl.sellingPoints || !pl.sellingPoints.length) return "";
    const cover = Math.max(0, Math.min(+(a.coverIndex || 0), Math.max(0, (a.photos || []).length - 1)));
    const avail = (a.photos || []).map((_, i) => i).filter((i) => i !== cover);
    return `<div class="dsec sp-sec" id="sec-highlights"><div class="dsec-h"><h3>产品亮点</h3></div>
      <div class="feature-stack">${pl.sellingPoints.map((s, i) => {
        const imgIdx = avail[i % Math.max(1, avail.length)];
        const hasImg = a.photos && a.photos[imgIdx];
        const num = String(i + 1).padStart(2, "0");
        return `<div class="feature-card">
          ${hasImg ? `<div class="feature-media">${mediaBlock(a, imgIdx, "")}</div>` : ""}
          <div class="feature-body">
            <div class="feature-head">
              <span class="feature-num">${num}</span>
              <h4 class="feature-title">${esc(s.title)}</h4>
            </div>
            <p class="feature-desc">${esc(s.desc)}</p>
          </div>
        </div>`;
      }).join("")}</div>
    </div>`;
  }
  function pipelineNotesHtml(a) {
    const pl = a.pipeline;
    if (!pl || !pl.details) return "";
    const d = pl.details;
    const refund = (d.refund && d.refund.length) ? `<div class="note-block"><div class="note-h">退改守则</div>${d.refund.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}</div>` : "";
    const alt = (d.altitude && d.altitude.length) ? `<div class="note-block"><div class="note-h">高海拔提示</div>${d.altitude.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}</div>` : "";
    const gear = (!a.gear || !a.gear.length) ? `<div class="note-block"><div class="note-h">装备建议</div><div class="note-sub">强制</div>${d.must.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}<div class="note-sub">建议</div>${d.suggest.map((t) => `<div class="note-row">${esc(t)}</div>`).join("")}</div>` : "";
    return `<div class="dsec note-sec"><div class="dsec-h"><span class="dsec-ic">${ICON("shield")}</span><h3>出行须知</h3></div>${refund}${alt}${gear}</div>`;
  }
