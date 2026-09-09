/* ClubOS Platform — modular build (split from monolithic app.js v81).
   Loaded as classic <script> in order; shared global scope, no bundler. */
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
