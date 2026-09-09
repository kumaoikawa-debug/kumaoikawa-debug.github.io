/* ================= ClubOS · AI 宣发中心（v113） =================
   一次理解，多平台适配：上传活动资料/照片 → 提取 Content Master →
   生成并排版微信公众号图文（4 套版式，可编辑、可复制 HTML）+
   小红书 / 朋友圈 / 微信群 / 口播 / 海报；活动结束可生成活动回顾。
   无 AI Key 时全部回退到基于真实活动事实的模板生成。 */

function xfState() {
  state.xf = state.xf || {
    scenario: null, aid: null, step: null,
    master: null, out: null, recap: null,
    layout: "diary", photos: [], notes: "", recapNotes: "",
    genState: "idle", platTab: "gzh", recapType: "",
    customRecap: { title: "", date: "", place: "", type: "", signups: "", leader: "" },
  };
  if (!state.xf.customRecap) state.xf.customRecap = { title: "", date: "", place: "", type: "", signups: "", leader: "" };
  /* 一致性守卫：旧版残留的半截生成状态若缺关键字段，回退到选择页，避免渲染崩溃 */
  var xf0 = state.xf;
  if (xf0.scenario === "recruit" && xf0.step === "result") {
    if (!xf0.out || !xf0.master || !xf0.master.mainTheme) { xf0.step = null; xf0.out = null; }
  }
  if (xf0.scenario === "recap" && xf0.step === "result") {
    if (!xf0.recap) { xf0.step = null; }
  }
  return xf0;
}

/* ---------- 工具 ---------- */
function xfSeason(a) {
  const ds = a.dateMD || a.date || "";
  const m = ds.match(/(\d{4})[-/](\d{1,2})/) || ds.match(/(\d{1,2})[-/](\d{1,2})/);
  if (!m) return "";
  const mo = +m[2];
  if (mo >= 3 && mo <= 5) return "春季";
  if (mo >= 6 && mo <= 8) return "夏季";
  if (mo >= 9 && mo <= 11) return "秋季";
  return "冬季";
}
function xfTargetUser(a) {
  const t = (a.type || "") + (a.audience || []).join("") + (a.title || "");
  if (/亲子|研学|自然|儿童/.test(t)) return "3-12 岁孩子的家庭，希望周末高质量陪伴";
  if (/露营|营地|派对|音乐/.test(t)) return "想松弛社交、逃离内卷的年轻都市人";
  if (/漂流|溯溪|水上|桨板/.test(t)) return "怕热又爱玩水、想痛快释放的户外新人";
  if (/登山|雪山|越野|高海拔|攀岩/.test(t)) return "有训练基础、追求挑战与完成感的老驴";
  if (/摄影|出片|风光|银河/.test(t)) return "喜欢用相机记录山河的摄影爱好者";
  return "平时坐办公室、周末想动一动的城市人群";
}
function xfConcern(a) {
  const t = (a.type || "") + (a.title || "");
  if (/亲子|研学/.test(t)) return "安全、孩子能否玩得投入、大人是否轻松";
  if (/漂流|溯溪|水上/.test(t)) return "会不会太危险、装备怎么准备、谁带";
  if (/登山|雪山|越野|高海拔/.test(t)) return "强度是否匹配自己、路线是否成熟、保障是否到位";
  return "值不值这个价、强度适不适合我、有没有人带";
}

/* 按活动类型给出统一的「主传播主题 + 价值」 */
function xfTypeProfile(a) {
  const t = (a.type || "") + (a.title || "");
  if (/亲子|研学|自然|儿童|少儿/.test(t)) return { kind: "family", tone: "温暖、轻快、有画面", themeA: "陪孩子去自然里上一堂户外课", scenic: "孩子能蹲下来观察的昆虫、溪流与植物", experience: "亲子协作的小任务，孩子在玩里认识世界", participation: "一段高质量陪伴，和孩子共同的自然记忆" };
  if (/露营|营地|星空|音乐|派对/.test(t)) return { kind: "camp", tone: "松弛、年轻、有氛围", themeA: "周末逃离城市，去营地躺平看星星", scenic: "开阔草地、营火与星空的氛围画面", experience: "搭帐篷、煮咖啡、围炉夜话的松弛社交", participation: "卸下疲惫的周末放松与同好相聚" };
  if (/漂流|溯溪|水上|溪降|桨板|皮划艇|冲浪/.test(t)) return { kind: "water", tone: "清凉、活泼、直接", themeA: "三伏天最爽的事，是跳进山里的水里", scenic: "清澈溪水与峡谷带来的清凉画面", experience: "戏水漂流直接的刺激与畅快", participation: "高温天极致的降温与释放" };
  if (/登山|雪山|高海拔|攀岩|攀冰|越野|重装|穿越/.test(t)) return { kind: "mountain", tone: "克制、专业、有力量", themeA: "用脚步丈量山脊，把城市留在脚下", scenic: "连绵山脊、云海与登顶视线的壮美", experience: "一步步向上的身体挑战与专注", participation: "体能突破与登顶完成的实在成就感" };
  if (/摄影|出片|风光|秋色|红叶|花海|银河/.test(t)) return { kind: "photo", tone: "审美、克制、有质感", themeA: "这片山，只为此刻的光而来", scenic: "此刻才有的光影与地貌层次", experience: "等一束光、构一张图的创作过程", participation: "带得走的一组自己拍的大片" };
  return { kind: "hike", tone: "真诚、自然、不浮夸", themeA: "走得动的山，才装得下周末的好心情", scenic: "行走其中才懂的山水与季节变化", experience: "呼吸、流汗、和朋友边走边聊的节奏", participation: "一次身体舒展与精神放空的周末充电" };
}

function xfCta(a) {
  const when = a.dateMD || a.date || "近期";
  const price = a.price != null ? "¥" + a.price + "/" + (a.limitUnit || "人") : "详询";
  return `报名方式：私信 / 群里接龙，或直接在本页提交报名。${when} 出发，名额${a.limit ? a.limit + (a.limitUnit || "人") + "，" : ""}先到先得。`;
}

/* ---------- Content Master ---------- */
function buildContentMaster(a, photos) {
  const p = xfTypeProfile(a);
  const facts = {
    activityName: a.title || "", activityType: a.type || "", place: a.place || "",
    date: a.dateMD || a.date || "", season: xfSeason(a),
    price: a.price != null ? a.price : "", limit: a.limit || "", limitUnit: a.limitUnit || "人",
    days: a.days || 1, ageRange: a.ageRange || "", audience: (a.audience || []).join("/"),
    distance: a.distance || "", elevation: a.elevation || "", difficulty: a.difficulty || "",
    meeting: a.meeting || "", meetTime: a.meetTime || "", returnTime: a.returnTime || "",
    includedServices: a.feeInclude || [], gear: (a.gear || []).map((g) => (g.name || g)),
    transport: a.transport || "", meal: a.meal || "", insurance: a.insurance || "",
    leader: a.leaderName ? (a.leaderName + (a.leaderYears ? "（" + a.leaderYears + "）" : "")) : "",
    itinerary: a.itineraryDays || [],
  };
  const cv = {
    scenicValue: p.scenic, experienceValue: p.experience, participationValue: p.participation,
    targetUser: xfTargetUser(a), mainConcern: xfConcern(a), mainSellingPoint: p.themeA,
  };
  const cs = { mainTheme: p.themeA, secondaryTheme: "", mainSellingPoint: p.themeA, audienceInsight: cv.targetUser, tone: p.tone };
  return {
    contentType: "recruitment", confirmedFacts: facts,
    targetAudience: cv.targetUser, mainTheme: cs.mainTheme, mainSellingPoint: cs.mainSellingPoint,
    scenicValue: cv.scenicValue, experienceValue: cv.experienceValue, participationValue: cv.participationValue,
    tone: cs.tone, keyImages: autoClassifyPhotos([...(photos || []), ...(a.photos || [])].filter((x, i, arr) => x && arr.indexOf(x) === i)), cta: xfCta(a),
  };
}

/* ---------- 照片分类 ---------- */
function xfPhotoCategory(src, i) {
  const meta = (typeof photoMeta === "function") ? photoMeta(src) : null;
  if (meta && meta.category) return meta.category;
  const order = ["cover", "scenic", "people", "action", "team", "gear", "meal", "camp", "route", "water", "detail"];
  return order[i % order.length];
}
function autoClassifyPhotos(photos) {
  return (photos || []).map((src, i) => ({ src: src, cat: xfPhotoCategory(src, i), i: i }));
}
function matchPhoto(m, prefer, idx) {
  const list = m.keyImages || [];
  if (!list.length) return null;
  const want = {
    cover: ["cover"], scenic: ["scenic", "route", "water", "camp", "detail", "cover"],
    experience: ["action", "people", "team", "scenic"], people: ["people", "team", "cover"],
  }[prefer] || [prefer];
  let f = list.find((p) => want.includes(p.cat));
  if (f) return f;
  return list[idx % list.length] || list[0];
}

/* ---------- AI 增强（可选） ---------- */
async function xfLLM(system, user, json) {
  if (!aiAuthMode()) return null;
  try {
    return await clubLLM({ system: system, user: user, json: !!json, temperature: 0.7 });
  } catch (e) { return null; }
}

/* ================= 活动招募生成 ================= */
async function genRecruit(a, m) {
  const f = m.confirmedFacts;
  const placeLine = f.place ? `在${f.place}` : "在山野里";
  const seasonLine = f.season ? `${f.season}的` : "";
  const diffLine = f.difficulty ? `，强度${f.difficulty}` : "";
  const elevLine = f.elevation ? `，海拔约 ${f.elevation} 米` : "";
  const dayLine = f.days > 1 ? `，全程 ${f.days} 天` : "";

  // 公众号正文（优先 AI，失败回退模板）
  let gzh = null;
  if (aiAuthMode()) {
    const sys = `你是户外俱乐部公众号主编。基于已确认事实写公众号图文，按消费者决策逻辑：为什么值得去→体验→收获→适合谁→真实信息→报名。禁止虚构领队/天气/事件/用户感受。只返回 JSON：{title,subtitle,summary,sections:[{h,html}],info:[{k,v}],fee,service,cta}`;
    const user = `活动：${JSON.stringify(f)}\n主主题：${m.mainTheme}\n价值：${m.scenicValue} / ${m.experienceValue} / ${m.participationValue}\n语气：${m.tone}`;
    gzh = await xfLLM(sys, user, true);
  }
  if (!gzh || !gzh.sections) {
    gzh = {
      title: `${f.activityName || "这场活动"}｜${m.mainTheme}`,
      subtitle: `${seasonLine}${placeLine}，${f.date || "近期"}出发${dayLine}${diffLine}${elevLine}`,
      summary: `${m.mainTheme}。${m.scenicValue}本文讲清为什么值得去、来了体验什么、参加完能得到什么，以及真实的报名信息。`,
      sections: [
        { h: "为什么值得去", html: `${m.scenicValue}。${placeLine}的${seasonLine}风景，不是手机壁纸能替代的——得自己走一趟才装得下。` },
        { h: "来了会体验什么", html: `${m.experienceValue}。${f.days > 1 ? "两天一夜" : "一天"}的节奏里，你会暂时忘记待办清单，只剩下脚下的路和身边的人。` },
        { h: "参加完你能得到什么", html: `${m.participationValue}。比起又刷了一天手机，这种踏实感更耐放。` },
        { h: xfFitTitle(a), html: xfFitText(a, m) },
      ],
      info: xfInfoRows(a),
      fee: f.price != null ? `¥${f.price}/${f.limitUnit || "人"}${f.limit ? `，限 ${f.limit}${f.limitUnit || "人"}` : ""}` : "详询",
      service: (f.includedServices && f.includedServices.length) ? f.includedServices.join("、") : "专业领队全程陪同",
      cta: m.cta,
    };
  }

  // 小红书（优先 AI）
  let xhs = null;
  if (aiAuthMode()) {
    const sys = `你是小红书户外赛道爆款博主，擅长把一场普通周末活动写成让人忍不住收藏的笔记。
要求：
1) titles：3-5 个标题，必须带强钩子——用「谁懂啊 / 后悔没早来 / 被问爆了 / 周末封神 / 本地人都不一定知道」等情绪前缀，含 emoji，长度≤20字，可带地点或结果；
2) body：第一人称、有画面、有细节、有情绪起伏。结构：① 一句话钩子（emoji+反差/痛点）② 2-4 个带小标题的分段（如「📍在哪」「✅为什么值」「🎒怎么玩」「💡真心话」）③ 每段 2-4 句，口语、不要说明书腔 ④ 结尾行动钩子（"码住 / 约起来 / 评论区扣1"）；
3) cover：一句能当封面大字报的短句（≤12字，带 emoji）；
4) tags：6-10 个，含 #地点+活动 类（如 #成都周边游 #周末去哪儿 #徒步）和情绪类（#小众秘境 #出片圣地 #治愈系风景）；
5) imgOrder：留空数组即可。
禁止虚构天气/人数/价格/领队；只基于给定事实。返回 JSON：{titles:[3-5],body,cover,tags:[],imgOrder:[]}`;
    xhs = await xfLLM(sys, `活动：${JSON.stringify(f)}\n价值：${m.scenicValue}/${m.experienceValue}/${m.participationValue}`, true);
  }
  if (!xhs || !xhs.body) {
    xhs = {
      titles: [xfXhsTitle(a, m, 1), xfXhsTitle(a, m, 2), xfXhsTitle(a, m, 3)],
      body: `谁懂啊😭 ${m.mainTheme}这么玩也太舒服了\n\n📍 ${placeLine}的${seasonLine}这一程，不是手机壁纸能替代的——得自己走一趟才装得下。\n\n✅ 为什么值得去\n${m.scenicValue}。呼吸、流汗、和朋友边走边聊，比刷一天手机耐放多了。\n\n🎒 怎么玩\n${m.experienceValue}。${f.days > 1 ? "两天一夜" : "一天"}的节奏，不用赶景点，时间全是自己的。\n\n💡 真心话\n${m.participationValue}。真实去一次，比收藏一百篇攻略都管用。\n\n📌 实用信息\n· 时间：${f.date || "近期"}\n· ${f.price != null ? "费用：¥" + f.price + "/" + (f.limitUnit || "人") : "费用详询"}\n· ${f.difficulty ? "强度：" + f.difficulty : "强度友好"}\n· 装备：${(f.gear && f.gear.length) ? f.gear.slice(0, 4).join("、") : "轻装即可"}\n\n码住这篇，周末约起来👀 评论区扣 1 我拉你进群～`,
      cover: `${f.place || "山里"}·${xfSeason(a) || ""}封神`,
      tags: xfTags(a),
      imgOrder: [],
    };
  }

  // 朋友圈 / 微信群 / 口播 / 海报（基于同一 master）
  return {
    gzh: gzh, xhs: xhs,
    moments: {
      warm: `周末想透口气的不妨看过来🌿 ${placeLine}的${seasonLine}局又开了，${f.date || ""} 出发。不用做攻略，跟着走就行，想一起的私我占位～`,
      formal: `【招募】${f.activityName || "本周活动"} · ${f.date || "近期"} 出发${dayLine}${diffLine}\n${m.mainSellingPoint}。名额不多，先把你那天的日历空出来☀️ 报名戳我或群里接龙。`,
      last: `⏰ 最后几个名额！${f.activityName || "本周活动"} ${f.date || ""} 出发，${m.mainSellingPoint}。错过这期要等下个月，想来的抓紧私信，手慢无～`,
    },
    wechat: {
      recruit: `各位群友好👋 ${f.activityName || "本周活动"} 开始招募啦，这趟真的别错过：\n🗓 时间：${f.date || "近期"}${dayLine}\n📍 地点：${f.place || "集合点群内发"}\n💰 ${f.price != null ? "费用：¥" + f.price + "/" + (f.limitUnit || "人") : "费用详询"}\n🔥 强度：${f.difficulty || "适中"}\n\n${m.mainSellingPoint}。名额有限，想一起的直接接龙或私信我，我帮你留位～`,
      brief: `【一句话】${f.activityName || "活动"} ${f.date || ""} 出发｜${m.mainSellingPoint}｜名额有限，戳我报名👇`,
    },
    voice: {
      s30: `大家好，这周末咱们去${f.place || "山里"}，主题是${m.mainTheme}。${f.price != null ? "费用" + f.price + "一人" : "费用详询"}，强度${f.difficulty || "适中"}，新手也能跟上。想一起的朋友私信我报名哈。`,
      s60: `大家好，给大伙说个周末的好去处。咱们${f.date || "这周末"}去${f.place || "山里"}，这场活动的主题是${m.mainTheme}。${m.experienceValue}，参加完${m.participationValue}。${f.price != null ? "费用" + f.price + "一人" : "费用详询"}，含${gzh.service || "领队陪同"}，强度${f.difficulty || "适中"}，不用担心跟不上。名额不多，想一起的朋友现在就可以私信我报名。`,
    },
    poster: {
      title: f.activityName || "户外活动",
      sub: m.mainTheme,
      place: f.place || "",
      points: [m.scenicValue, m.experienceValue].map((s) => s.split("。")[0]).filter(Boolean).slice(0, 2),
      time: f.date || "近期",
      price: f.price != null ? "¥" + f.price + " 起/" + (f.limitUnit || "人") : "详询",
      cta: "扫码 / 私信报名",
    },
  };
}

function xfFitTitle(a) { return (a.audience && a.audience.length) ? `适合谁 · ${a.audience.join("/")}` : "适不适合我"; }
function xfFitText(a, m) {
  const f = m.confirmedFacts;
  const age = f.ageRange ? `适合 ${f.ageRange}` : "门槛友好";
  return `${age}。${m.targetAudience}。${f.concern ? "你可能担心" + f.concern + "——" : ""}这场有${f.leader || "专业领队"}带队，路线成熟，按自己的节奏走就好。`;
}
function xfInfoRows(a) {
  const rows = [];
  if (a.dateMD || a.date) rows.push({ k: "时间", v: a.dateMD || a.date });
  if (a.place) rows.push({ k: "地点", v: a.place });
  if (a.meeting) rows.push({ k: "集合", v: a.meeting + (a.meetTime ? " " + a.meetTime : "") });
  if (a.days > 1) rows.push({ k: "天数", v: a.days + " 天" });
  if (a.elevation) rows.push({ k: "海拔", v: a.elevation + " 米" });
  if (a.difficulty) rows.push({ k: "强度", v: a.difficulty });
  if (a.limit) rows.push({ k: "名额", v: a.limit + (a.limitUnit || "人") });
  if (a.leaderName) rows.push({ k: "领队", v: a.leaderName + (a.leaderYears ? "（" + a.leaderYears + "）" : "") });
  if (a.insurance) rows.push({ k: "保险", v: a.insurance });
  return rows;
}
function xfTags(a) {
  const t = (a.type || "") + (a.title || "");
  const base = ["户外", "周末去哪儿"];
  if (/亲子|研学/.test(t)) base.push("亲子户外", "自然教育");
  else if (/露营|营地/.test(t)) base.push("露营", "营地生活");
  else if (/漂流|溯溪|水上/.test(t)) base.push("玩水", "溯溪");
  else if (/登山|雪山|越野/.test(t)) base.push("徒步登山", "向上挑战");
  else if (/摄影/.test(t)) base.push("户外摄影", "出片");
  else base.push("徒步", "爬山");
  return base;
}
function xfXhsTitle(a, m, n) {
  const f = m.confirmedFacts;
  const arr = [
    `${f.place || "山里"}的${xfSeason(a) || ""}也太好拍了｜${m.mainTheme}`,
    `周末去哪？${f.activityName || "这场活动"}直接封神`,
    `谁懂啊，${f.place || "这儿"}才是${xfSeason(a) || "周末"}正确打开方式`,
    `${m.mainTheme}｜一次说走就走的户外充电`,
    `${f.activityName || "活动"}实录：原来户外可以这么松弛`,
  ];
  return arr[(n - 1) % arr.length];
}

/* ================= 活动回顾生成 ================= */
function xfRecapType(a, photos) {
  const t = (a.type || "") + (a.title || "");
  if (/亲子|研学|自然|儿童/.test(t)) return "亲子陪伴型";
  if (/雪山|越野|高海拔|重装|攀岩/.test(t)) return "完成挑战型";
  if (/漂流|溯溪|水上|露营|营地|派对/.test(t)) return "活动氛围型";
  if (/摄影|风光|秋色|红叶|花海/.test(t)) return "风景纪实型";
  if (photos && photos.length >= 6) return "团队成长型";
  return "户外体验型";
}
async function genRecap(a, m, photos, notes) {
  const f = m.confirmedFacts;
  const type = xfRecapType(a, photos);
  const signN = a.signups || (a.departures ? a.departures.reduce((s, d) => s + (d.sign || 0), 0) : 0);
  let gzh = null;
  if (aiAuthMode()) {
    const sys = `你是户外俱乐部内容主笔，写活动回顾。像真正参加过的人认真回看这一天：真实、有画面、有完成感，禁止虚构天气/事件/用户感受/领队行为。只返回 JSON：{title,summary,sections:[{h,html}],next}`;
    const user = `活动：${JSON.stringify(f)}\n回顾类型：${type}\n实际参与：${signN} 人\n补充资料：${notes || "无"}\n照片：${photos.length} 张（已分类）`;
    gzh = await xfLLM(sys, user, true);
  }
  if (!gzh || !gzh.sections) {
    gzh = {
      title: `回顾｜${f.activityName || "这场活动"}，我们${type === "完成挑战型" ? "登顶了" : "一起走过"}`,
      summary: `${f.date || "这场活动"}，${signN ? signN + " 位伙伴" : "一群伙伴"}在${f.place || "山野"}完成了一次${type}的户外日。`,
      sections: [
        { h: "开场", html: `${f.date || "那天"}，${signN ? signN + " 位伙伴" : "我们"}在${f.place || "集合点"}汇合。${type === "完成挑战型" ? "目标很明确：走完它。" : "没有什么宏大目标，就是认真地把这一天过好。"}` },
        { h: "本次活动核心记忆", html: `${type === "风景纪实型" ? (m.scenicValue + "，这一程的景色是主线。") : (m.experienceValue + "，大家投入的样子就是最好的回忆。")}` },
        { h: "本次参与体验", html: `${f.difficulty ? "强度" + f.difficulty + "，" : ""}但节奏把控得刚好。${f.leader ? f.leader + "带队，" : ""}该停就停，该走就走。` },
        { h: "值得记住的瞬间", html: notes && notes.trim() ? `这次特别记下：${notes.trim()}` : `合照那一刻、抵达那一刻、还有返程车上安静下来的那一刻——都算数。` },
        { h: "参与者收获", html: `${m.participationValue}。有人说来对了，这就够。` },
        { h: "照片回顾", html: `这一程的画面都在下面，留给一起走过的人。` },
        { h: "结尾", html: `山还在，路还在。谢谢每一位把周末交给户外的人。` },
        { h: "下一期预告", html: xfNextText(a) },
      ],
      next: xfNextText(a),
    };
  }
  let xhs = null;
  if (aiAuthMode()) {
    const sys = `你是小红书活动回顾爆款博主，把刚结束的一场活动写成有温度、有画面、让人想参加的笔记。
要求：
1) titles：3 个，带情绪钩子（"圆满收官 / 被治愈了 / 下次还来 / 值了"），含 emoji，≤20字；
2) body：第一人称回顾。结构：① 一句钩子（"刚结束的XX，我宣布值了"）② 2-3 个分段小标题（如「🌟最难忘的瞬间」「🤝一起走过的人」「📷出片现场」「💬真心话」）③ 每段口语 2-4 句，有画面有情绪，可引用 notes 中的特别瞬间 ④ 结尾钩子（"下一期我已占位 / 评论区蹲下次"）；
3) cover：≤12字封面短句带 emoji；
4) tags：6-10 个，含 #活动回顾 #地点 #活动类型 与情绪类。
禁止虚构天气/事件/用户感受；只基于给定事实与补充说明。返回 JSON：{titles:[3],body,cover,tags:[]}`;
    xhs = await xfLLM(sys, `活动：${JSON.stringify(f)}\n类型：${type}\n补充：${notes || "无"}`, true);
  }
  if (!xhs || !xhs.body) {
    xhs = {
      titles: [`回顾｜${f.activityName || "这场活动"}，值了🔥`, `周末去${f.place || "山里"}的人，后来都怎样了`, `${type}的一天，比想象中更难忘`],
      body: `刚结束的${f.activityName || "这场活动"}，我宣布：值了📷\n\n🌟 最难忘的瞬间\n${gzh.sections[1].html}\n\n🤝 一起走过的人\n${gzh.sections[3].html}\n\n💬 真心话\n真实去一次，比任何攻略都具体。下一期${xfNextText(a)}，我已经先占位了。\n\n评论区蹲下次活动的小伙伴扣 1 👇`,
      cover: `圆满收官·${f.place || "山里"}`,
      tags: xfTags(a).concat(["活动回顾"]),
    };
  }
  return {
    gzh: gzh, xhs: xhs,
    moments: `【活动回顾】${f.activityName || "本周活动"}顺利收官🎉 ${signN ? signN + " 位伙伴" : "大家"}一起${type === "完成挑战型" ? "把山踩在了脚下" : "度过了超舒服的一天"}。最开心的不是到达，是路上有人一起走。下一期${xfNextText(a)}`,
    wechat: `各位群友，咱们的${f.activityName || "活动"}圆满收官啦🌿 ${signN ? "共 " + signN + " 位伙伴参加" : "大家玩得超尽兴"}。\n\n特别感谢每一位准时出发、互相照应的伙伴——下次还跟你走。照片已整理在相册，记得自取📷\n\n错过这一次的别慌，${xfNextText(a)}想一起的下期提前占位，我帮你留着～`,
    next: xfNextText(a),
  };
}
function xfNextText(a) {
  const f = (a && (a.dateMD || a.date)) ? (a.dateMD || a.date) : "";
  return `咱们还会继续进山，下一期路线正在安排，留意群里接龙就能占位。`;
}

/* ================= 渲染：AI 宣发中心 ================= */
function renderFabu() {
  const xf = xfState();
  return `
  <div class="section-head">
    <div class="section-title">AI 宣发中心</div>
    <div class="section-sub">上传活动资料和照片，ClubOS 自动理解内容、提炼传播主题、生成并排版微信公众号图文，同步生成小红书等内容。活动结束还能一键生成活动回顾。</div>
  </div>
  ${xfFlow()}
  ${xfLegacySection()}
  `;
}

function xfFlow() {
  const xf = xfState();
  if (!xf.scenario) return xfScenarioHtml();
  if (xf.scenario === "recruit") return xf.step === "result" && xf.out ? xfRecruitResult() : xfRecruitPicker();
  if (xf.scenario === "recap") return xf.step === "result" && xf.recap ? xfRecapResult() : xfRecapPicker();
  return xfScenarioHtml();
}

function xfScenarioHtml() {
  return `
  <div class="xf-hero">
    <div class="xf-hero-txt">
      <div class="eyebrow">一次理解 · 多平台适配</div>
      <h2>把活动资料和照片交给 ClubOS</h2>
      <p class="muted">自动生成公众号图文与小红书内容；活动结束还能生成完整活动回顾。目标：10–20 分钟完成初稿、排版与修改。</p>
    </div>
    <div class="xf-cards">
      <button class="xf-card" data-action="xfGoScenario" data-s="recruit">
        <span class="xf-card-ic">${ICON("send")}</span>
        <b>活动招募</b>
        <span>生成宣传内容</span>
        <i>公众号图文 · 小红书 · 朋友圈 · 微信群 · 口播 · 海报</i>
      </button>
      <button class="xf-card" data-action="xfGoScenario" data-s="recap">
        <span class="xf-card-ic">${ICON("camera")}</span>
        <b>活动回顾</b>
        <span>生成活动回顾</span>
        <i>选已完成活动 · 传照片 · 自动排版回顾</i>
      </button>
    </div>
  </div>`;
}

function xfActivityPicker(filterFn, label, emptyMsg) {
  const acts = (state.activities || []).filter(filterFn);
  return `
  <div class="xf-pick">
    <button class="btn btn-ghost btn-sm" data-action="xfGoScenario" data-s="back">${ICON("chevron-left")} 返回</button>
    <h3>${label}</h3>
    ${acts.length ? `<div class="xf-act-list">${acts.map((a) => `
      <div class="xf-act">
        <div class="xf-act-thumb" style="background-image:url('${(a.photos && a.photos[a.coverIndex || 0]) || ""}')"></div>
        <div class="xf-act-info">
          <b>${esc(a.title || "未命名活动")}</b>
          <span class="muted small">${(a.dateMD || a.date || "时间待定")} · ${esc(a.place || "")} · ${esc(a.status || "")}</span>
        </div>
        <button class="btn btn-primary btn-sm" data-action="xfPickActivity" data-aid="${a.id}">选择</button>
      </div>`).join("")}</div>` : `<div class="empty"><div class="e-ic">📭</div><div>${esc(emptyMsg || "没有符合条件的活动，先去「活动内容」创建一场吧。")}</div></div>`}
  </div>`;
}

function xfRecruitPicker() {
  const xf = xfState();
  return xfActivityPicker((a) => a.status === "recruiting" || a.status === "draft" || a.status === "full" || !a.status, "选择要招募的活动") +
    `<div class="xf-supp">
      <div class="panel"><div class="panel-head"><h3>补充资料（可选）</h3><span class="tiny muted">粘贴旧文案 / 备注，帮助 AI 更准</span></div>
        <div class="panel-body"><textarea class="textarea" data-xf="note" placeholder="例如：往年这篇活动阅读很高、客户最关心亲子安全、这次新增了溯溪环节…">${esc(xf.notes || "")}</textarea></div></div>
      <div class="panel"><div class="panel-head"><h3>添加图片 / 海报（可选）</h3><span class="tiny muted">用于公众号配图，自动分类</span></div>
        <div class="panel-body">
          <div class="xf-photos">${(xf.photos || []).map((p, i) => `<div class="xf-ph" style="background-image:url('${p}')"><button class="x" data-action="xfDelPhoto" data-i="${i}">${ICON("x")}</button></div>`).join("")}
            <label class="xf-ph-add">${ICON("upload")}<input type="file" id="xfPhotoInput" accept="image/*" multiple hidden></label></div>
          <button class="btn btn-primary btn-sm" data-action="xfRecruitGen" style="margin-top:10px">${ICON("sparkles")} 生成宣传内容</button>
        </div></div>
    </div>`;
}

function xfRecapPicker() {
  const xf = xfState();
  const c = xf.customRecap || {};
  const selected = xf.aid ? (state.activities || []).find((a) => a.id === xf.aid) : null;
  return xfActivityPicker((a) => a.status === "ended", "选择已结束的活动", "没有已结束活动，可直接填写下方信息生成回顾") +
    (selected ? `<div class="xf-supp"><div class="panel"><div class="panel-head"><h3>已选择活动</h3></div><div class="panel-body"><div class="xf-act" style="margin:0"><div class="xf-act-info"><b>${esc(selected.title || "未命名活动")}</b><span class="muted small">${(selected.dateMD || selected.date || "时间待定")} · ${esc(selected.place || "")}</span></div><button class="btn btn-ghost btn-sm" data-action="xfPickActivity" data-aid="">清除选择</button></div></div></div></div>` : "") +
    `<div class="xf-supp">
      <div class="panel"><div class="panel-head"><h3>或直接填写活动信息生成回顾</h3><span class="tiny muted">不绑定已有活动时使用这些信息</span></div>
        <div class="panel-body">
          <div class="xf-field"><label>活动名称</label><input class="input" data-xf="customTitle" placeholder="例如：虹口漂流一日记" value="${esc(c.title || "")}"></div>
          <div class="xf-field"><label>活动时间</label><input class="input" data-xf="customDate" placeholder="例如：9月28日" value="${esc(c.date || "")}"></div>
          <div class="xf-field"><label>活动地点</label><input class="input" data-xf="customPlace" placeholder="例如：都江堰虹口" value="${esc(c.place || "")}"></div>
          <div class="xf-field"><label>活动类型</label><input class="input" data-xf="customType" placeholder="漂流 / 登山 / 亲子 / 露营…" value="${esc(c.type || "")}"></div>
          <div class="xf-field"><label>参与人数</label><input class="input" data-xf="customSignups" type="number" placeholder="例如：18" value="${esc(c.signups || "")}"></div>
          <div class="xf-field"><label>领队 / 组织者</label><input class="input" data-xf="customLeader" placeholder="例如：阿龙" value="${esc(c.leader || "")}"></div>
        </div></div>
      <div class="panel"><div class="panel-head"><h3>上传本次活动照片</h3><span class="tiny muted">自动分类：封面/风景/人物/动作/团队/合影/细节</span></div>
        <div class="panel-body">
          <div class="xf-photos">${(xf.photos || []).map((p, i) => `<div class="xf-ph" style="background-image:url('${p}')"><button class="x" data-action="xfDelPhoto" data-i="${i}">${ICON("x")}</button><span class="xf-ph-cat">${xfPhotoCategory(p, i)}</span></div>`).join("")}
            <label class="xf-ph-add">${ICON("camera")}<input type="file" id="xfPhotoInput" accept="image/*" multiple hidden></label></div>
          <p class="tiny muted">分类为自动推断（演示），生成时按内容匹配到正文段落。</p>
        </div></div>
      <div class="panel"><div class="panel-head"><h3>补充资料（可选）</h3><span class="tiny muted">领队备注 / 用户反馈 / 特别瞬间 / 实际天气</span></div>
        <div class="panel-body"><textarea class="textarea" data-xf="recapNotes" placeholder="例如：当天其实放晴了、小朋友第一次自己爬上来、大家最满意的是晚餐…">${esc(xf.recapNotes || "")}</textarea>
          <button class="btn btn-primary btn-sm" data-action="xfRecapGen" style="margin-top:10px">${ICON("sparkles")} 生成活动回顾</button>
        </div></div>
    </div>`;
}

/* 平台 Tab */
function xfPlatTabs(active, prefix) {
  const tabs = [["gzh", "公众号"], ["xhs", "小红书"], ["moments", "朋友圈"], ["wechat", "微信群"], ["voice", "口播"], ["poster", "海报"]];
  return `<div class="xf-tabs">${tabs.map(([k, l]) => `<button class="xf-tab ${active === k ? "active" : ""}" data-action="xfPlatTab" data-k="${k}" data-prefix="${prefix}">${l}</button>`).join("")}</div>`;
}

function xfRecruitResult() {
  const xf = xfState();
  const o = xf.out;
  if (xf.genState === "loading") return `<div class="xf-loading">${ICON("sparkles")} 正在生成宣传内容…</div>`;
  return `
  <div class="xf-back"><button class="btn btn-ghost btn-sm" data-action="xfReset">${ICON("chevron-left")} 重新选择</button></div>
  <div class="xf-theme"><span class="xf-theme-lbl">本次核心传播主题</span><b>${esc((xf.master || {}).mainTheme || "")}</b></div>
  ${xfPlatTabs(xf.platTab, "recruit")}
  <div class="xf-plat-body">
    ${xf.platTab === "gzh" ? xfGzhPanel(o.gzh, xf.layout) : ""}
    ${xf.platTab === "xhs" ? xfXhsPanel(o.xhs) : ""}
    ${xf.platTab === "moments" ? xfMomentsPanel(o.moments) : ""}
    ${xf.platTab === "wechat" ? xfWechatPanel(o.wechat) : ""}
    ${xf.platTab === "voice" ? xfVoicePanel(o.voice) : ""}
    ${xf.platTab === "poster" ? xfPosterPanel(o.poster, xf) : ""}
  </div>`;
}

function xfGzhPanel(gzh, layout) {
  const xf = xfState();
  const layouts = [["diary", "山野日记型"], ["magazine", "户外杂志型"], ["youth", "年轻潮流型"], ["family", "亲子自然型"], ["challenge", "挑战运动型"], ["longform", "招募长图文"]];
  return `
  <div class="xf-gzh-head">
    <div class="xf-layouts">${layouts.map(([k, l]) => `<button class="xf-layout ${layout === k ? "active" : ""}" data-action="xfSwitchLayout" data-l="${k}">${l}</button>`).join("")}</div>
    <button class="btn btn-primary btn-sm" data-action="xfCopyGzhHtml">${ICON("copy")} 复制公众号（HTML）</button>
  </div>
  ${layout === "diary" ? xfGzhDiaryHtml(gzh, xf, false) : xfGzhClassicHtml(gzh, xf, layout, false)}
  <p class="tiny muted">正文可直接点击修改（contenteditable），改完点「复制公众号（HTML）」粘贴到微信后台；换版式只改视觉风格，不改内容。</p>`;
}
function xfPhotoForSection(h) {
  if (/为什么|值得去|风景|景|地点|路线|地貌/.test(h || "")) return "scenic";
  if (/体验|玩|挑战|探索|运动|做/.test(h || "")) return "experience";
  if (/收获|得到|适合|谁|陪伴|成长/.test(h || "")) return "people";
  return "scenic";
}

/* ---------- 公众号排版：图片与版式增强 ---------- */
function xfEyebrow(a, m) {
  const f = m && m.confirmedFacts ? m.confirmedFacts : {};
  const season = f.season || xfSeason(a) || "";
  const month = (f.date || "").match(/(\d{1,2})[\/\-]/) ? (f.date.match(/(\d{1,2})[\/\-]/)[1] + "月") : "";
  const enMonth = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const mo = month ? parseInt(month, 10) - 1 : -1;
  const moEn = mo >= 0 && mo < 12 ? enMonth[mo] : "MOUNTAIN";
  const typeMap = { hike: "DIARY", mountain: "DIARY", water: "WATER", camp: "CAMP", family: "FAMILY", photo: "PHOTO" };
  const p = xfTypeProfile(a);
  const tag = typeMap[p.kind] || "DIARY";
  return `${moEn} · ${tag}${season ? " · " + season : ""}`;
}
function xfBrandPill(a) {
  const club = state.club && state.club.name ? state.club.name : "远拓旅游";
  const y = ((a.dateMD || a.date || "").match(/(\d{4})/) || ["", new Date().getFullYear()])[1];
  return `${club} · ${y}`;
}
function xfGzhCover(xf) {
  const gzh = xf.out && xf.out.gzh ? xf.out.gzh : {};
  let cover = gzh.cover && gzh.cover.src ? gzh.cover : matchPhoto(xf.master, "cover", 0);
  if (!cover || !cover.src) {
    const list = xf.master && xf.master.keyImages ? xf.master.keyImages : [];
    if (list.length) cover = list[0];
  }
  return cover || {};
}
function xfPhotoSet(xf, prefer, count) {
  const list = [];
  const used = new Set();
  const imgs = (xf.master && xf.master.keyImages) || [];
  const order = Array.isArray(prefer) ? prefer : [prefer];
  for (const cat of order) {
    for (const p of imgs) {
      if (p && p.src && !used.has(p.src) && p.cat === cat) {
        list.push(p);
        used.add(p.src);
        if (list.length >= count) return list;
      }
    }
  }
  for (const p of imgs) {
    if (p && p.src && !used.has(p.src)) {
      list.push(p);
      used.add(p.src);
      if (list.length >= count) return list;
    }
  }
  return list;
}
function xfGzhTextParas(html) {
  return (html || "").split(/\n+/).map((p) => p.trim()).filter(Boolean);
}
function xfGzhHighlight(html, a) {
  const p = xfTypeProfile(a);
  const kw = [p.themeA, (a.place || ""), (a.type || ""), "森林", "溪流", "山顶", "露营", "篝火", "星空", "徒步", "溯溪", "桨板", "漂流"].filter(Boolean);
  let out = html;
  for (const k of kw) {
    if (!k || k.length < 2) continue;
    out = out.split(k).join(`<span class="gzh-hl">${k}</span>`);
  }
  return out;
}

/* 山野日记型：大图叠标题、极简杂志长图 */
function xfGzhDiaryHtml(gzh, xf, isRecap) {
  const a = (state.activities || []).find((x) => x.id === xf.aid) || {};
  const m = xf.master || {};
  const f = m.confirmedFacts || {};
  const cover = xfGzhCover(xf);
  const eyebrow = xfEyebrow(a, m);
  const pill = xfBrandPill(a);
  const sectionCount = (gzh.sections || []).length || 4;
  // quote 不配图，多取一些保证其它区块有图；照片按顺序喂给各 section
  const secPhotos = xfPhotoSet(xf, ["scenic", "people", "action", "detail", "cover", "team"], Math.max(sectionCount, 6));
  const hasPhotos = secPhotos.length > 0 || !!cover.src;
  let photoIdx = 0;

  // 标题拆分：活动名 + 主题，避免 hero 标题过长
  const titleParts = (gzh.title || "").split(/[｜|]/);
  const heroTitle = (titleParts[0] || gzh.title || f.activityName || "山野日记").trim();
  const heroSub = (titleParts[1] || gzh.subtitle || m.mainTheme || "").trim();
  const heroDate = f.date ? `${f.place || ""} · ${f.date}`.replace(/^ · /, "") : (f.place || "");

  const hero = cover.src
    ? `<div class="gzh-hero" style="background-image:url('${cover.src}')"><div class="gzh-hero-mask"></div><div class="gzh-hero-txt"><div class="gzh-eyebrow">${esc(eyebrow)}</div><h1 class="gzh-hero-title">${esc(heroTitle)}</h1>${heroSub ? `<div class="gzh-hero-sub">${esc(heroSub)}</div>` : ""}${heroDate ? `<div class="gzh-hero-pill">${esc(heroDate)}</div>` : `<div class="gzh-hero-pill">${esc(pill)}</div>`}</div></div>`
    : `<div class="gzh-hero gzh-hero-empty"><div class="gzh-hero-mask"></div><div class="gzh-hero-txt"><div class="gzh-eyebrow">${esc(eyebrow)}</div><h1 class="gzh-hero-title">${esc(heroTitle)}</h1>${heroSub ? `<div class="gzh-hero-sub">${esc(heroSub)}</div>` : ""}${heroDate ? `<div class="gzh-hero-pill">${esc(heroDate)}</div>` : `<div class="gzh-hero-pill">${esc(pill)}</div>`}<div class="gzh-hero-upload-hint">📷 上传 1 张大图，这里会变成全幅封面</div></div></div>`;

  const lead = gzh.summary ? `<div class="gzh-lead"><p>${esc(gzh.summary)}</p></div>` : "";

  const nextPhoto = (layout) => {
    if (layout === "gzh-sec-quote") return null;
    return secPhotos[photoIdx++] || null;
  };

  const sections = (gzh.sections || []).map((s, i) => {
    const layoutClass = ["gzh-sec-full", "gzh-sec-split", "gzh-sec-quote", "gzh-sec-img"][i % 4];
    const ph = nextPhoto(layoutClass);
    const paras = xfGzhTextParas(s.html).map((p) => `<p>${xfGzhHighlight(p, a)}</p>`).join("");
    if (layoutClass === "gzh-sec-quote") {
      return `<section class="gzh-sec gzh-sec-quote"><div class="gzh-quote-mark">”</div><h2>${esc(s.h)}</h2><div class="gzh-quote-body">${paras}</div></section>`;
    }
    if (layoutClass === "gzh-sec-split" && ph && ph.src) {
      return `<section class="gzh-sec gzh-sec-split"><div class="gzh-split-text"><h2>${esc(s.h)}</h2>${paras}</div><div class="gzh-split-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div></section>`;
    }
    if (layoutClass === "gzh-sec-img" && ph && ph.src) {
      return `<section class="gzh-sec gzh-sec-img"><div class="gzh-wide-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div><div class="gzh-img-text"><h2>${esc(s.h)}</h2>${paras}</div></section>`;
    }
    return `<section class="gzh-sec gzh-sec-full"><h2>${esc(s.h)}</h2>${paras}${ph && ph.src ? `<div class="gzh-sec-imgbox" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}</section>`;
  }).join("");

  const infoBlock = (!isRecap && gzh.info && gzh.info.length)
    ? `<div class="gzh-info-grid">${gzh.info.map((r) => `<div class="gzh-info-cell"><span class="gzh-info-k">${esc(r.k)}</span><span class="gzh-info-v">${esc(r.v)}</span></div>`).join("")}</div>`
    : "";

  const feeBlock = (!isRecap && gzh.fee)
    ? `<div class="gzh-diary-block"><h2>费用说明</h2><p>${esc(gzh.fee)}</p>${gzh.service ? `<p class="gzh-service">${esc(gzh.service)}</p>` : ""}</div>`
    : "";

  const uploadHint = !hasPhotos
    ? `<div class="gzh-upload-tip"><div class="gzh-upload-tip-ic">📷</div><div><b>这张图文还没有照片</b><p>在「添加图片 / 海报」处上传 3–6 张活动照片，系统会自动匹配到封面与各段落，排版会立刻更有杂志感。</p></div></div>`
    : "";

  const cta = gzh.cta || (isRecap && gzh.next) ? `<div class="gzh-diary-cta">${esc(gzh.cta || gzh.next || "")}</div>` : "";

  return `<div class="gzh-article gzh-diary" id="xfGzhArticle" contenteditable="true" spellcheck="false">
    ${hero}
    ${lead}
    ${sections}
    ${infoBlock}
    ${feeBlock}
    ${uploadHint}
    ${cta}
  </div>`;
}

/* 经典四版式：杂志/潮流/亲子/挑战 */
function xfGzhClassicHtml(gzh, xf, layout, isRecap) {
  const a = (state.activities || []).find((x) => x.id === xf.aid) || {};
  const m = xf.master || {};
  const f = m.confirmedFacts || {};
  const cover = xfGzhCover(xf);
  const eyebrow = xfEyebrow(a, m);
  const photos = xfPhotoSet(xf, ["scenic", "people", "action", "cover", "detail"], 8);
  const secPhotos = xfPhotoSet(xf, ["scenic", "people", "action", "detail"], 8);
  const hasPhotos = photos.length > 0 || !!cover.src;
  const parasFn = (html) => xfGzhTextParas(html).map((p) => `<p>${xfGzhHighlight(p, a)}</p>`).join("");
  const infoBlock = (!isRecap && gzh.info && gzh.info.length)
    ? `<div class="gzh-info"><h2>活动信息</h2><table>${gzh.info.map((r) => `<tr><td>${esc(r.k)}</td><td>${esc(r.v)}</td></tr>`).join("")}</table></div>`
    : "";
  const feeBlock = (!isRecap && gzh.fee)
    ? `<div class="gzh-block"><h2>费用说明</h2><p>${esc(gzh.fee)}</p>${gzh.service ? `<p>${esc(gzh.service)}</p>` : ""}</div>`
    : "";
  const cta = gzh.cta || (isRecap && gzh.next) ? `<div class="gzh-cta">${esc(gzh.cta || gzh.next || "")}</div>` : "";
  const uploadHint = !hasPhotos
    ? `<div class="gzh-upload-tip"><div class="gzh-upload-tip-ic">📷</div><div><b>这张图文还没有照片</b><p>上传 3–6 张照片，各版式会自动匹配封面与段落配图。</p></div></div>`
    : "";

  if (layout === "youth") {
    const cards = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = parasFn(s.html);
      return `<div class="gzh-youth-card">
        ${ph && ph.src ? `<div class="gzh-youth-card-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
        <div class="gzh-youth-card-body">
          <div class="gzh-youth-card-num">0${(i % 9) + 1}</div>
          <h3>${esc(s.h)}</h3>
          ${paras}
        </div>
      </div>`;
    }).join("");
    const tags = xfTags(a).slice(0, 6).map((t) => `<span class="gzh-youth-tag">#${esc(t)}</span>`).join("");
    return `<div class="gzh-article gzh-youth" id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-youth-hero">
        <div class="gzh-youth-eyebrow">${esc(eyebrow)}</div>
        <h1 class="gzh-youth-title">${esc(gzh.title)}</h1>
        ${gzh.subtitle ? `<div class="gzh-youth-sub">${esc(gzh.subtitle)}</div>` : ""}
        ${cover.src ? `<div class="gzh-youth-cover" style="background-image:url('${cover.src}')"></div>` : ""}
      </div>
      ${gzh.summary ? `<div class="gzh-youth-lead">${parasFn(gzh.summary)}</div>` : ""}
      <div class="gzh-youth-cards">${cards}</div>
      <div class="gzh-youth-tags">${tags}</div>
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  if (layout === "family") {
    const steps = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = parasFn(s.html);
      return `<div class="gzh-family-step">
        <div class="gzh-family-step-num">${i + 1}</div>
        <div class="gzh-family-step-body">
          <h3>${esc(s.h)}</h3>
          ${paras}
        </div>
        ${ph && ph.src ? `<div class="gzh-family-step-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
      </div>`;
    }).join("");
    return `<div class="gzh-article gzh-family" id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-family-hero">
        <div class="gzh-family-cover" ${cover.src ? `style="background-image:url('${cover.src}')"` : ""}>
          <div class="gzh-family-cover-mask"></div>
          <div class="gzh-family-cover-txt">
            <div class="gzh-family-eyebrow">${esc(eyebrow)}</div>
            <h1 class="gzh-family-title">${esc(gzh.title)}</h1>
          </div>
        </div>
        ${gzh.subtitle ? `<div class="gzh-family-sub">${esc(gzh.subtitle)}</div>` : ""}
      </div>
      ${gzh.summary ? `<div class="gzh-family-lead">${parasFn(gzh.summary)}</div>` : ""}
      <div class="gzh-family-steps">${steps}</div>
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  if (layout === "challenge") {
    const kv = [
      { k: "距离", v: f.distance || "--" },
      { k: "爬升", v: f.elevation ? f.elevation + "m" : "--" },
      { k: "强度", v: f.difficulty || "--" },
      { k: "天数", v: (f.days || 1) + "天" },
    ];
    const kvHtml = kv.map((r) => `<div class="gzh-challenge-kv"><b>${esc(r.v)}</b><span>${esc(r.k)}</span></div>`).join("");
    const sections = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = parasFn(s.html);
      return `<section class="gzh-sec gzh-challenge-sec">
        <div class="gzh-challenge-sec-head">
          <div class="gzh-challenge-sec-num">0${(i % 9) + 1}</div>
          <h2>${esc(s.h)}</h2>
        </div>
        <div class="gzh-challenge-sec-body">
          ${paras}
          ${ph && ph.src ? `<div class="gzh-challenge-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
        </div>
      </section>`;
    }).join("");
    return `<div class="gzh-article gzh-challenge" id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-challenge-hero">
        <div class="gzh-challenge-eyebrow">${esc(eyebrow)}</div>
        <h1 class="gzh-challenge-title">${esc(gzh.title)}</h1>
        ${gzh.subtitle ? `<div class="gzh-challenge-sub">${esc(gzh.subtitle)}</div>` : ""}
        <div class="gzh-challenge-kvs">${kvHtml}</div>
      </div>
      ${cover.src ? `<div class="gzh-challenge-cover" style="background-image:url('${cover.src}')"></div>` : ""}
      ${gzh.summary ? `<div class="gzh-challenge-lead">${parasFn(gzh.summary)}</div>` : ""}
      ${sections}
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  if (layout === "longform") {
    const metaPill = f.date ? `${f.place || ""} · ${f.date}`.replace(/^ · /, "") : (f.place || "");
    const kv = [
      { k: "天数", v: (f.days || 1) + "天" },
      { k: "距离", v: f.distance || "--" },
      { k: "爬升", v: f.elevation ? f.elevation + "m" : "--" },
      { k: "强度", v: f.difficulty || "--" },
    ];
    const kvHtml = kv.map((r) => `<div class="gzh-longform-kv"><b>${esc(r.v)}</b><span>${esc(r.k)}</span></div>`).join("");
    const sections = (gzh.sections || []).map((s, i) => {
      const ph = secPhotos[i] || null;
      const paras = parasFn(s.html);
      const align = i % 2 === 0 ? "left" : "right";
      return `<section class="gzh-sec gzh-longform-sec gzh-longform-sec-${align}">
        ${ph && ph.src ? `<div class="gzh-longform-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
        <div class="gzh-longform-text">
          <div class="gzh-longform-sec-num">0${(i % 9) + 1}</div>
          <h2>${esc(s.h)}</h2>
          ${paras}
        </div>
      </section>`;
    }).join("");
    return `<div class="gzh-article gzh-longform" id="xfGzhArticle" contenteditable="true" spellcheck="false">
      <div class="gzh-longform-hero">
        ${cover.src ? `<div class="gzh-longform-cover" style="background-image:url('${cover.src}')"><div class="gzh-longform-cover-mask"></div></div>` : ""}
        <div class="gzh-longform-hero-txt">
          <div class="gzh-longform-eyebrow">${esc(eyebrow)}</div>
          <h1 class="gzh-longform-title">${esc(gzh.title)}</h1>
          ${gzh.subtitle ? `<div class="gzh-longform-sub">${esc(gzh.subtitle)}</div>` : ""}
          ${metaPill ? `<div class="gzh-longform-pill">${esc(metaPill)}</div>` : ""}
        </div>
      </div>
      <div class="gzh-longform-kvs">${kvHtml}</div>
      ${gzh.summary ? `<div class="gzh-longform-lead">${parasFn(gzh.summary)}</div>` : ""}
      ${sections}
      ${infoBlock}
      ${feeBlock}
      ${uploadHint}
      ${cta}
    </div>`;
  }

  // magazine 默认：户外杂志型
  const sections = (gzh.sections || []).map((s, i) => {
    const ph = secPhotos[i] || null;
    const paras = parasFn(s.html);
    const align = i % 2 === 0 ? "left" : "right";
    return `<section class="gzh-sec gzh-mag-sec gzh-mag-sec-${align}">
      <div class="gzh-mag-text">
        <div class="gzh-mag-sec-num">0${(i % 9) + 1}</div>
        <h2>${esc(s.h)}</h2>
        ${paras}
      </div>
      ${ph && ph.src ? `<div class="gzh-mag-img" style="background-image:url('${ph.src}')"><span class="gzh-img-cap">${esc(ph.cat || "")}</span></div>` : ""}
    </section>`;
  }).join("");
  const gallery = photos.length > 1
    ? `<div class="gzh-gallery-classic"><h2>本期画面</h2><div class="gzh-gallery-grid">${photos.slice(0, 4).map((p) => `<div class="gzh-gallery-item" style="background-image:url('${p.src}')"><span class="gzh-img-cap">${esc(p.cat || "")}</span></div>`).join("")}</div></div>`
    : "";
  return `<div class="gzh-article gzh-magazine" id="xfGzhArticle" contenteditable="true" spellcheck="false">
    <div class="gzh-cover" ${cover.src ? `style="background-image:url('${cover.src}')"` : ""}><div class="gzh-cover-mask"><div class="gzh-cover-cap">${esc(cover.cat ? "封面建议：" + cover.cat : (xf.photos && xf.photos.length ? "可换一张更具张力的大图作封面" : "未上传照片，建议补 1 张封面大图"))}</div></div></div>
    <div class="gzh-mag-head">
      <div class="gzh-mag-eyebrow">${esc(eyebrow)}</div>
      <h1 class="gzh-title">${esc(gzh.title)}</h1>
      ${gzh.subtitle ? `<div class="gzh-sub">${esc(gzh.subtitle)}</div>` : ""}
    </div>
    ${gzh.summary ? `<div class="gzh-sum">${parasFn(gzh.summary)}</div>` : ""}
    ${sections}
    ${infoBlock}
    ${feeBlock}
    ${gallery}
    ${uploadHint}
    ${cta}
  </div>`;
}

function xfXhsPanel(x) {
  return `<div class="xf-text-card">
    <div class="xf-field"><label>标题候选</label>${x.titles.map((t) => `<div class="xf-line">· ${esc(t)} <button class="copy-btn" data-action="xfCopyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>
    <div class="xf-field"><label>正文</label><div class="xf-pre">${esc(x.body)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(x.body)}">复制正文</button></div>
    <div class="xf-field"><label>封面短句</label><div class="xf-line">${esc(x.cover)}</div></div>
    <div class="xf-field"><label>话题标签</label><div class="xf-tags">${x.tags.map((t) => `<span class="xf-tag">#${esc(t)}</span>`).join("")}</div></div>
  </div>`;
}
function xfMomentsPanel(m) {
  const items = [["预热版", m.warm], ["正式招募版", m.formal], ["最后招募版", m.last]];
  return `<div class="xf-text-card">${items.map(([l, t]) => `<div class="xf-field"><label>${l}</label><div class="xf-pre">${esc(t)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>`;
}
function xfWechatPanel(w) {
  const items = [["直接招募文案", w.recruit], ["简短报名说明", w.brief]];
  return `<div class="xf-text-card">${items.map(([l, t]) => `<div class="xf-field"><label>${l}</label><div class="xf-pre">${esc(t)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>`;
}
function xfVoicePanel(v) {
  const items = [["30 秒口播", v.s30], ["60 秒口播", v.s60]];
  return `<div class="xf-text-card">${items.map(([l, t]) => `<div class="xf-field"><label>${l}</label><div class="xf-pre">${esc(t)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(t)}">复制</button></div>`).join("")}</div>`;
}
function xfPosterPanel(p, xf) {
  const cover = (xf && xf.out && xf.out.gzh && xf.out.gzh.cover && xf.out.gzh.cover.src) ? xf.out.gzh.cover.src : (xfGzhCover(xf).src || "");
  const pill = (p.place && p.time) ? (p.place + " · " + p.time) : (p.time || p.place || "");
  const pts = (p.points && p.points.length) ? p.points : [p.sub].filter(Boolean);
  return `<div class="xf-poster">
    <div class="xf-poster-art" ${cover ? `style="background-image:url('${cover}')"` : ""}>
      <div class="xf-poster-art-mask"></div>
      <div class="xf-poster-art-txt">
        <div class="xf-poster-eyebrow">${esc(xfBrandPill({}))}</div>
        <h2 class="xf-poster-title">${esc(p.title)}</h2>
        ${p.sub ? `<div class="xf-poster-sub">${esc(p.sub)}</div>` : ""}
        ${pill ? `<div class="xf-poster-pill">📍 ${esc(pill)}</div>` : ""}
      </div>
    </div>
    <div class="xf-poster-info">
      <ul class="xf-poster-pts">${pts.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      <div class="xf-poster-meta"><span>⏰ ${esc(p.time)}</span><span>💰 ${esc(p.price)}</span></div>
      <div class="xf-poster-cta">${esc(p.cta)}</div>
    </div>
    <button class="copy-btn" data-action="xfCopyText" data-text="${esc(p.title + "｜" + p.sub + " " + pill + " " + p.price + " " + p.cta)}">复制文案</button>
  </div>`;
}

function xfRecapResult() {
  const xf = xfState();
  const o = xf.recap;
  if (xf.genState === "loading") return `<div class="xf-loading">${ICON("sparkles")} 正在生成活动回顾…</div>`;
  return `
  <div class="xf-back"><button class="btn btn-ghost btn-sm" data-action="xfReset">${ICON("chevron-left")} 重新选择</button></div>
  <div class="xf-theme"><span class="xf-theme-lbl">本次活动回顾主题</span><b>${esc(xf.recapType)}</b></div>
  ${xfPlatTabs(xf.platTab, "recap")}
  <div class="xf-plat-body">
    ${xf.platTab === "gzh" ? xfRecapGzhPanel(o.gzh, xf.layout) : ""}
    ${xf.platTab === "xhs" ? xfXhsPanel(o.xhs) : ""}
    ${xf.platTab === "moments" ? `<div class="xf-text-card"><div class="xf-field"><label>朋友圈回顾</label><div class="xf-pre">${esc(o.moments)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(o.moments)}">复制</button></div></div>` : ""}
    ${xf.platTab === "wechat" ? `<div class="xf-text-card"><div class="xf-field"><label>微信群感谢</label><div class="xf-pre">${esc(o.wechat)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(o.wechat)}">复制</button></div></div>` : ""}
    ${xf.platTab === "voice" ? "" : ""}
    ${xf.platTab === "poster" ? `<div class="xf-text-card"><div class="xf-field"><label>下一期预告</label><div class="xf-pre">${esc(o.next)}</div><button class="copy-btn" data-action="xfCopyText" data-text="${esc(o.next)}">复制</button></div></div>` : ""}
  </div>`;
}

function xfRecapGzhPanel(gzh, layout) {
  const xf = xfState();
  const layouts = [["diary", "山野日记型"], ["magazine", "户外杂志型"], ["youth", "年轻潮流型"], ["family", "亲子自然型"], ["challenge", "挑战运动型"], ["longform", "招募长图文"]];
  return `
  <div class="xf-gzh-head">
    <div class="xf-layouts">${layouts.map(([k, l]) => `<button class="xf-layout ${layout === k ? "active" : ""}" data-action="xfSwitchLayout" data-l="${k}">${l}</button>`).join("")}</div>
    <button class="btn btn-primary btn-sm" data-action="xfCopyGzhHtml">${ICON("copy")} 复制公众号（HTML）</button>
  </div>
  ${layout === "diary" ? xfGzhDiaryHtml(gzh, xf, true) : xfGzhClassicHtml(gzh, xf, layout, true)}
  <p class="tiny muted">回顾正文可直接点击修改；禁止虚构现场细节，所有事实须来自上传资料。改完点「复制公众号（HTML）」。</p>`;
}

/* 持续运营（保留原有运营任务 + 老客户召回） */
function xfLegacySection() {
  const tasks = buildActivityTasks();
  const customers = deriveCustomers();
  const inactive = customers.filter((c) => c.inactiveDays != null && c.inactiveDays >= 60);
  return `
  <details class="xf-legacy" open>
    <summary class="xf-legacy-sum">持续运营 · 单渠道快生 & 老客户召回</summary>
    <div class="xf-legacy-body">
      <div class="section-head" style="margin-top:0"><div class="section-title">活动运营任务</div><span class="muted small">${tasks.length} 项</span></div>
      ${tasks.length ? `<div class="op-tasks">${tasks.map((t) => `
        <div class="op-task">
          <div class="op-task-l"><span class="op-badge">${esc(t.badge)}</span><div><div class="op-task-title">${esc(t.a.title)}</div><div class="op-task-tip">${esc(t.tip)}</div></div></div>
          <div class="op-task-r"><button class="btn btn-primary btn-sm" data-action="xfFromTask" data-aid="${t.a.id}">${ICON("sparkles")} ${esc(t.btn)}</button></div>
          ${renderOpCopies(t.a.id)}
        </div>`).join("")}</div>` : `<div class="empty"><div class="e-ic">📣</div><div>当前没有进行中的活动任务。</div></div>`}
      <div class="section-head"><div class="section-title">老客户召回</div><span class="muted small">${inactive.length} 人 60 天未参加</span></div>
      <div class="recall-card">
        <div class="recall-segs">
          <button class="recall-seg" data-action="recallGen" data-seg="亲子"><b>${customers.filter((c) => c.tags.has("亲子客户")).length}</b><span>亲子客户</span><i>生成邀请</i></button>
          <button class="recall-seg" data-action="recallGen" data-seg="徒步"><b>${customers.filter((c) => c.tags.has("徒步客户")).length}</b><span>徒步客户</span><i>生成邀请</i></button>
          <button class="recall-seg" data-action="recallGen" data-seg="inactive60"><b>${inactive.length}</b><span>60天未参加</span><i>生成邀请</i></button>
        </div>
        ${state._recall ? `<div class="recall-out"><div class="recall-out-h">召回文案 · ${esc(state._recall.seg)}<button class="btn btn-ghost btn-xs" data-action="copyText" data-text="${esc(state._recall.text)}">${ICON("copy")} 复制</button></div><div class="recall-out-body">${esc(state._recall.text)}</div></div>` : ""}
      </div>
    </div>
  </details>`;
}
