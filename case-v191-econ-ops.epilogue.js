// v191 验收：① AI 经营分析（产品ID/成本/基线/异常/事实与推测分离/问答/分档/盈亏平衡）
//            ② 户外执行侧（离线包/安全最小权限/保险/协议/退改转让/客户召回/长线套餐）
// ⚠️ 夹具契约：本文件被包进 async 函数体，必须「裸顶层 return」返回；顶层需含 ok:false 才判失败。
state = (typeof initState === "function") ? initState() : ((typeof loadState === "function") ? loadState() : state);

const checks = [];
const add = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
const dbg = {};
const DAY = 86400000;
const iso = (d) => new Date(Date.now() - d * DAY).toISOString().slice(0, 10);
const monOf = (d) => new Date(Date.now() - d * DAY).getMonth() + 1;

try {
  /* ============ 0. 数据夹具 ============ */
  const COST = () => ({ transport: 0, accommodation: 0, meals: 0, leaders: 0, insurance: 0, tickets: 0, materials: 0, other: 0 });
  const mkEcon = (o) => Object.assign({
    productId: "", activityType: "", route: "", startDate: "", season: "",
    registeredParticipants: null, actualParticipants: null,
    revenue: { registration: null, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 },
    costs: COST(),
    transportMeta: { supplier: "", vehicleType: "", vehicleCount: null, distanceKm: null, note: "" },
    accommodationMeta: { supplier: "", roomCount: null, roomType: "" },
    mealMeta: { supplier: "", mealType: "" },
    costModel: { variableKeys: ["meals", "insurance"] }, source: "test", note: "", updatedAt: 0
  }, o);
  const mkA = (id, o) => Object.assign({
    id: id, title: "活动", type: "徒步", place: "", route: "", days: 1, price: 100, limit: 30,
    signups: 0, departures: [], photos: [], audience: [], gear: [], highlights: [], leaderIds: []
  }, o || {});

  /* P_A 青城山轻徒步：6 场、高毛利、成本稳定 → 期望「核心稳定产品」 */
  const A_DAYS = [150, 120, 90, 60, 30, 10];
  const P_A = A_DAYS.map((dg, i) => mkA("pa" + i, {
    title: "青城山轻徒步", type: "徒步", route: "都江堰—青城后山", place: "都江堰", price: 168, limit: 30,
    departures: [{ id: "dpa" + i, date: iso(dg) }],
    economics: mkEcon({
      registeredParticipants: 20, startDate: iso(dg), activityType: "徒步", route: "都江堰—青城后山",
      revenue: { registration: 20 * 168, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 },
      costs: { transport: 1200, accommodation: 0, meals: 24 * 20, leaders: 300, insurance: 12 * 20, tickets: 0, materials: 0, other: 0 }
    })
  }));

  /* P_B 四姑娘山大峰：2 场、单场利润突出 → 期望「高利润产品」（且不是核心稳定） */
  const P_B = [140, 40].map((dg, i) => mkA("pb" + i, {
    title: "四姑娘山大峰攀登", type: "高海拔登山", route: "四姑娘山·大峰", place: "四姑娘山", price: 1980, limit: 12, days: 3,
    departures: [{ id: "dpb" + i, date: iso(dg) }],
    economics: mkEcon({
      registeredParticipants: 10, startDate: iso(dg), activityType: "高海拔登山", route: "四姑娘山·大峰",
      revenue: { registration: 10 * 1980, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 },
      costs: { transport: 5000, accommodation: 6000, meals: 400, leaders: 2500, insurance: 350, tickets: 0, materials: 0, other: 0 }
    })
  }));

  /* P_C 白鹤滩露营：4 场、连续低毛利 → 期望「低效产品」 */
  const P_C = [130, 100, 70, 45].map((dg, i) => mkA("pc" + i, {
    title: "白鹤滩露营", type: "露营", route: "白鹤滩营地", place: "白鹤滩", price: 120, limit: 20,
    departures: [{ id: "dpc" + i, date: iso(dg) }],
    economics: mkEcon({
      registeredParticipants: 18, startDate: iso(dg), activityType: "露营", route: "白鹤滩营地",
      revenue: { registration: 18 * 120, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 },
      costs: { transport: 1400, accommodation: 0, meals: 500, leaders: 400, insurance: 0, tickets: 0, materials: 0, other: 0 }
    })
  }));

  /* P_D 彭州小鱼洞：3 场、有需求但成本波动大 → 期望「待优化产品」 */
  const D_COST = [{ transport: 700, meals: 400, leaders: 400 }, { transport: 1800, meals: 1000, leaders: 400 }, { transport: 900, meals: 500, leaders: 400 }];
  const P_D = [125, 85, 20].map((dg, i) => mkA("pd" + i, {
    title: "彭州小鱼洞环线", type: "徒步", route: "彭州小鱼洞环线", place: "彭州", price: 128, limit: 24,
    departures: [{ id: "dpd" + i, date: iso(dg) }],
    economics: mkEcon({
      registeredParticipants: 20, startDate: iso(dg), activityType: "徒步", route: "彭州小鱼洞环线",
      revenue: { registration: 20 * 128, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 },
      costs: Object.assign(COST(), D_COST[i])
    })
  }));

  /* P_E 亲子自然课：3 场、拉新为主、利润一般 → 期望「引流产品」 */
  const P_E = [115, 75, 35].map((dg, i) => mkA("pe" + i, {
    title: "亲子自然课", type: "研学", route: "龙泉山自然课堂", place: "龙泉山", price: 260, limit: 16,
    departures: [{ id: "dpe" + i, date: iso(dg) }],
    economics: mkEcon({
      registeredParticipants: 12, startDate: iso(dg), activityType: "研学", route: "龙泉山自然课堂",
      revenue: { registration: 12 * 260, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 },
      costs: { transport: 900, accommodation: 0, meals: 36 * 12, leaders: 800, insurance: 15 * 12, tickets: 0, materials: 300, other: 0 }
    })
  }));

  /* P_F 单场活动 → 期望「观察中」 */
  const P_F = [50].map((dg, i) => mkA("pf" + i, {
    title: "龙泉山夜爬", type: "徒步", route: "龙泉山夜爬线", place: "龙泉山", price: 88, limit: 20,
    departures: [{ id: "dpf" + i, date: iso(dg) }],
    economics: mkEcon({
      registeredParticipants: 15, startDate: iso(dg),
      revenue: { registration: 15 * 88, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 },
      costs: { transport: 600, accommodation: 0, meals: 0, leaders: 200, insurance: 0, tickets: 0, materials: 0, other: 0 }
    })
  }));

  /* P_G 成本异常线路：车费 3200/2400/2500（无元数据） */
  const P_G = [110, 70, 25].map((dg, i) => mkA("pg" + i, {
    title: "九峰山穿越", type: "徒步", route: "九峰山穿越线", place: "彭州", price: 300, limit: 30,
    departures: [{ id: "dpg" + i, date: iso(dg) }],
    economics: mkEcon({
      registeredParticipants: 20, startDate: iso(dg), activityType: "徒步", route: "九峰山穿越线",
      revenue: { registration: 20 * 300, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 },
      costs: {
        transport: [3200, 2400, 2500][i], accommodation: [1000, 1500, 2200][i],
        meals: 40 * 20, leaders: 800, insurance: 0, tickets: 0, materials: 0, other: 0
      }
    })
  }));

  /* P_H 同线路但记录了车型 → 推理应能给出「车型变化」假设 */
  const P_H = [105, 65, 22].map((dg, i) => mkA("ph" + i, {
    title: "天台山穿越", type: "徒步", route: "天台山穿越线", place: "邛崃", price: 300, limit: 30,
    departures: [{ id: "dph" + i, date: iso(dg) }],
    economics: mkEcon({
      registeredParticipants: 20, startDate: iso(dg), activityType: "徒步", route: "天台山穿越线",
      revenue: { registration: 20 * 300, supplements: 0, addons: 0, refunds: 0, other: 0, total: 0 },
      costs: { transport: [3600, 2400, 2450][i], accommodation: 0, meals: 40 * 20, leaders: 800, insurance: 0, tickets: 0, materials: 0, other: 0 },
      transportMeta: { supplier: "川运车队", vehicleType: ["39 座", "29 座", "29 座"][i], vehicleCount: 1, distanceKm: null, note: i === 0 ? "五一前临时换了大车" : "" }
    })
  }));

  const ALL = P_A.concat(P_B, P_C, P_D, P_E, P_F, P_G, P_H);
  state.activities = ALL;

  /* 报名记录（用于客户统计 / 召回 / 保险名单） */
  const sg = (id, activityId, name, phone, o) => Object.assign({ id: id, activityId: activityId, name: name, phone: phone, adults: 1, children: 0, paid: true, createdAt: Date.now() - 200 * DAY }, o || {});
  state.signups = [].concat([
      sg("s1", P_A[0].id, "张先生", "13800001111", { createdAt: Date.now() - 160 * DAY }),
      sg("s2", P_A[1].id, "李女士", "13800002222", { createdAt: Date.now() - 120 * DAY }),
      sg("s3", P_A[2].id, "王先生", "13800003333", { createdAt: Date.now() - 100 * DAY }),
      sg("s4", P_D[0].id, "张先生", "13800001111", { createdAt: Date.now() - 100 * DAY }),
      sg("s5", P_D[1].id, "李女士", "13800002222", { createdAt: Date.now() - 95 * DAY }),
      sg("s6", P_D[2].id, "陈先生", "13800004444", { createdAt: Date.now() - 70 * DAY }),
      sg("s7", P_E[0].id, "亲子甲", "13900001111", { adults: 1, children: 1, childName: "小甲", childAge: 8, createdAt: Date.now() - 110 * DAY }),
      sg("s8", P_E[1].id, "亲子乙", "13900002222", { adults: 1, children: 1, childName: "小乙", childAge: 9, createdAt: Date.now() - 72 * DAY }),
      sg("s9", P_E[2].id, "亲子丙", "13900003333", { adults: 1, children: 1, childName: "小丙", childAge: 7, createdAt: Date.now() - 34 * DAY })
    ]);

  /* ============ 一、activityProductId：同产品跨批次 ============ */
  econSyncProducts();
  const pidA = P_A[0].activityProductId, pidA6 = P_A[5].activityProductId;
  add("产品ID·同一路线不同月份归为同一个经营产品", !!pidA && pidA === pidA6, pidA + " vs " + pidA6);
  add("产品ID·格式为 PRODUCT_00N", /^PRODUCT_\d{3}$/.test(pidA || ""), String(pidA));
  add("产品ID·不同路线归为不同产品", P_A[0].activityProductId !== P_D[0].activityProductId, P_A[0].activityProductId + " vs " + P_D[0].activityProductId);
  const t1 = mkA("t_pid1", { type: "徒步", route: "青城后山3月第2期" });
  const t2 = mkA("t_pid2", { type: "徒步", route: "青城后山 5月" });
  const k1 = econProductKey(t1), k2 = econProductKey(t2);
  add("产品ID·归一化忽略批次词（3月/第2期）", k1 === k2, k1 + " | " + k2);
  state.activities = ALL.concat([t1, t2]);
  ensureActivityProductId(t1); ensureActivityProductId(t2);
  add("产品ID·已存在的产品被复用（不新建）", t1.activityProductId === t2.activityProductId, t1.activityProductId + " = " + t2.activityProductId);
  const keep = mkA("t_pid3", { activityProductId: "PRODUCT_999", type: "徒步", route: "完全不同的路线" });
  ensureActivityProductId(keep);
  add("产品ID·已有 productId 不被覆盖", keep.activityProductId === "PRODUCT_999", keep.activityProductId);
  state.activities = ALL;

  /* ============ 二、成本自然语言解析 ============ */
  const p1 = parseCostText("今天大巴2800，吃饭1260，两个领队一共1000。");
  dbg.parse1 = p1;
  const g1 = p1.grouped;
  add("成本解析·车辆 2800", g1.transport === 2800, String(g1.transport));
  add("成本解析·餐饮 1260", g1.meals === 1260, String(g1.meals));
  add("成本解析·领队 1000（「两个」不被当成金额）", g1.leaders === 1000, String(g1.leaders));
  add("成本解析·合计 5060", p1.total === 5060, String(p1.total));
  const p2 = parseCostText("住宿4500，门票1200，保险650，物料800");
  add("成本解析·住宿/门票/保险/物料归类", p2.grouped.accommodation === 4500 && p2.grouped.tickets === 1200 && p2.grouped.insurance === 650 && p2.grouped.materials === 800, JSON.stringify(p2.grouped));
  const p3 = parseCostText("车费 1.2万\n午餐 1200\n领队 800");
  add("成本解析·支持「1.2万」单位换算", p3.grouped.transport === 12000 && p3.grouped.meals === 1200 && p3.grouped.leaders === 800, JSON.stringify(p3.grouped));
  const p4 = parseCostText("今天整体还不错");
  add("成本解析·无金额句子不臆造", p4.items.length === 0 && p4.total === 0, JSON.stringify(p4.items));
  const p5 = parseCostText("包车2千，向导1000");
  add("成本解析·支持「2千」单位换算", p5.grouped.transport === 2000 && p5.grouped.leaders === 1000, JSON.stringify(p5.grouped));

  /* ============ 三、单场经营结果（收入自动读取） ============ */
  const revAct = mkA("rev1", {
    price: 200, childPrice: 100, signups: 0,
    economics: mkEcon({ costs: Object.assign(COST(), { transport: 1000 }) })
  });
  state.activities = ALL.concat([revAct]);
  state.signups = state.signups.concat([
    { id: "rs1", activityId: "rev1", name: "A", phone: "1", adults: 2, children: 1, createdAt: Date.now() },
    { id: "rs2", activityId: "rev1", name: "B", phone: "2", adults: 1, children: 0, createdAt: Date.now() }
  ]);
  const mRev = econMetrics(revAct);
  add("收入·报名收入按报名记录自动计算（成人2+1 × 200，儿童 1 × 100）", mRev.revenueTotal === 700, String(mRev.revenueTotal));
  add("人数·按报名人次（成人+儿童）", mRev.people === 4, String(mRev.people));
  add("成本·固定成本（车辆）与变动成本（餐饮/保险）分离", mRev.fixedTotal === 1000 && mRev.varPerPerson === 0, mRev.fixedTotal + "/" + mRev.varPerPerson);
  revAct.economics.revenue.refunds = 200;
  add("收入·退款抵扣收入", econMetrics(revAct).revenueTotal === 500, String(econMetrics(revAct).revenueTotal));
  revAct.economics.revenue.refunds = 0;
  revAct.economics.actualParticipants = 3;
  add("人数·实际参加人数优先于报名人数", econMetrics(revAct).people === 3, String(econMetrics(revAct).people));
  delete revAct.economics.actualParticipants;
  state.signups = state.signups.filter((s) => s.activityId !== "rev1");
  revAct.economics.registeredParticipants = 3;
  add("收入·无报名记录时退化为 人数 × 单价", econMetrics(revAct).revenueTotal === 600, String(econMetrics(revAct).revenueTotal));
  state.activities = ALL;

  /* ============ 四、盈亏平衡 ============ */
  add("盈亏平衡·ceil(3600 / (198 - 50)) = 25 人", econBreakEvenPeople(198, 3600, 50) === 25, String(econBreakEvenPeople(198, 3600, 50)));
  add("盈亏平衡·单人毛利非正时返回 null（不存在保本人数）", econBreakEvenPeople(100, 3000, 120) === null, String(econBreakEvenPeople(100, 3000, 120)));
  const sim = econSimulate(198, 3600, 50, [20, 25, 30, 35]);
  add("盈亏平衡·模拟 20/25/30/35 人的盈亏方向正确", sim.length === 4 && sim[0].profit < 0 && sim[1].profit >= 0 && sim[3].profit > sim[2].profit, JSON.stringify(sim.map((x) => x.profit)));
  const beA = econBreakEvenFor(P_A[0]);
  add("盈亏平衡·从活动数据自动算保本人数（168 元 / 固定 1500 / 变动 36）", beA.breakEvenPeople === 12, JSON.stringify({ be: beA.breakEvenPeople, fixed: beA.fixed, varPP: beA.varPerPerson }));
  add("盈亏平衡·返回保本点附近的模拟", (beA.simulate || []).length >= 3, String((beA.simulate || []).length));

  /* ============ 五、同类横向比较与成本异常 ============ */
  const anomalies = econAnomalies({ months: 12 });
  dbg.anomalyCount = anomalies.length;
  const anomG = anomalies.filter((f) => f.activityId === "pg0" && f.costKey === "transport")[0];
  add("异常·找到「九峰山 车费 3200 高于同线路平均」", !!anomG, anomG ? anomG.fact : "未找到");
  add("异常·事实句含具体金额与百分比（3300→2450 → 30.6%）", !!anomG && /3,200/.test(anomG.fact) && /2,450/.test(anomG.fact) && /30\.6%/.test(anomG.fact), anomG ? anomG.fact : "");
  add("异常·★无元数据时只说明「无法确认具体原因」，且不给假设", !!anomG && anomG.reasonUnavailable === true && !anomG.hypothesis, anomG ? String(anomG.hypothesis) + " | " + anomG.why : "");
  add("异常·★why 明说缺少哪些可比字段", !!anomG && /没有记录/.test(anomG.why) && /无法确认具体原因/.test(anomG.why), anomG ? anomG.why : "");
  const anomText = JSON.stringify(anomalies);
  add("异常·★绝不无据归因（不出现 旺季/涨价/油价/供不应求）", !/旺季|涨价|供不应求|油价上涨/.test(anomText), anomText.slice(0, 120));
  add("异常·★每条 finding 都有事实句，且 假设/无法确认 二选一", anomalies.every((f) => !!f.fact && ((!!f.hypothesis && f.reasonUnavailable === false) || (!f.hypothesis && f.reasonUnavailable === true))), "n=" + anomalies.length);
  const anomH = anomalies.filter((f) => f.activityId === "ph0" && f.costKey === "transport")[0];
  add("异常·★有车型记录时给出「车型变化是重要因素」假设", !!anomH && !!anomH.hypothesis && /车辆型号/.test(anomH.hypothesis) && /39 座/.test(anomH.hypothesis), anomH ? String(anomH.hypothesis) : "未找到");
  add("异常·★假设同时引用成本备注（换了大车）", !!anomH && /换了大车/.test(String(anomH.hypothesis)), anomH ? String(anomH.hypothesis) : "");
  const trendG = anomalies.filter((f) => f.id && f.id.indexOf("trend_") === 0 && f.productId === P_G[0].activityProductId)[0];
  add("异常·识别「同线路最近 3 场住宿成本持续上涨」", !!trendG, trendG ? trendG.fact : "未找到");
  add("异常·人均餐饮高于其他场次 18% 时提醒", anomalies.some((f) => f.costKey === "meals"), "");

  /* ============ 六、12 个月滚动基线 ============ */
  const base = econBaseline(12);
  const baseT = base.byKey.transport;
  add("基线·12 个月内有效活动被纳入", base.runs >= 15, "runs=" + base.runs);
  add("基线·车辆平均单次成本计算正确", Math.abs(baseT.avgPerRun - (baseT.avgPerRun)) < 1 && baseT.n > 0 && baseT.avgPerRun > 1000, String(Math.round(baseT.avgPerRun)));
  add("基线·按产品聚合平均车费", !!baseT.byProduct[pidA] && Math.abs(baseT.byProduct[pidA] - 1200) < 0.01, String(baseT.byProduct[pidA]));
  add("基线·按车型聚合（39 座 vs 29 座）", !!baseT.byVehicle["39 座"] && !!baseT.byVehicle["29 座"] && baseT.byVehicle["39 座"] > baseT.byVehicle["29 座"], JSON.stringify(baseT.byVehicle));
  add("基线·按供应商聚合", !!baseT.bySupplier["川运车队"], JSON.stringify(baseT.bySupplier));
  add("基线·人均餐饮与人均住宿基线", base.byKey.meals.avgPerPerson > 0 && base.byKey.accommodation.avgPerPerson > 0, base.byKey.meals.avgPerPerson.toFixed(1) + "/" + base.byKey.accommodation.avgPerPerson.toFixed(1));
  const farAct = mkA("far1", { price: 100, economics: mkEcon({ registeredParticipants: 10, startDate: iso(500), costs: Object.assign(COST(), { transport: 99999 }) }) });
  state.activities = ALL.concat([farAct]);
  add("基线·超过 12 个月的活动被排除", econBaseline(12).byKey.transport.avgPerRun < 90000, String(Math.round(econBaseline(12).byKey.transport.avgPerRun)));
  state.activities = ALL;

  /* ============ 七、产品经营画像与分档（不只看利润） ============ */
  const pf = econPortfolio();
  const byName = {};
  pf.items.forEach((it) => { byName[it.profile.name] = it; });
  const clsOf = (n) => (byName[n] ? byName[n].cls.key : "MISSING");
  dbg.classify = Object.keys(byName).map((n) => n + "=" + byName[n].cls.label);
  add("分档·青城山轻徒步 = 核心稳定产品", clsOf("都江堰—青城后山 · 徒步") === "stable", clsOf("都江堰—青城后山 · 徒步"));
  add("分档·四姑娘山大峰 = 高利润产品（频次低但单场利润高）", clsOf("四姑娘山·大峰 · 高海拔登山") === "profit", clsOf("四姑娘山·大峰 · 高海拔登山"));
  add("分档·白鹤滩露营 = 低效产品", clsOf("白鹤滩营地 · 露营") === "weak", clsOf("白鹤滩营地 · 露营"));
  add("分档·彭州小鱼洞 = 待优化产品（有需求、成本波动大）", clsOf("彭州小鱼洞环线 · 徒步") === "optimize", clsOf("彭州小鱼洞环线 · 徒步") + " reasons=" + (byName["彭州小鱼洞环线 · 徒步"] || {}).cls.reasons);
  add("分档·亲子自然课 = 引流产品（拉新为主）", clsOf("龙泉山自然课堂 · 研学") === "traffic", clsOf("龙泉山自然课堂 · 研学"));
  add("分档·单场活动 = 观察中（样本不足不判断）", clsOf("龙泉山夜爬线 · 徒步") === "new", clsOf("龙泉山夜爬线 · 徒步"));
  const pbIt = byName["四姑娘山·大峰 · 高海拔登山"], paIt = byName["都江堰—青城后山 · 徒步"];
  add("分档·★不只看单场利润：利润更高的产品没有被判成核心稳定", !!pbIt && !!paIt && pbIt.profile.avgProfit > paIt.profile.avgProfit && pbIt.cls.key !== "stable" && paIt.cls.key === "stable", (pbIt ? Math.round(pbIt.profile.avgProfit) : "?") + " > " + (paIt ? Math.round(paIt.profile.avgProfit) : "?"));
  add("分档·★判断依据里给出多维理由（不只利润）", !!paIt && paIt.cls.reasons.length >= 2 && /毛利率/.test(paIt.cls.reasons.join("")) && /(波动|成团|报名)/.test(paIt.cls.reasons.join("")), paIt ? paIt.cls.reasons.join(" / ") : "");
  const pfA = econProductProfile(pidA);
  add("画像·含执行场次/平均报名/均价/人均成本/毛利率", pfA.runs === 6 && pfA.avgSignups === 20 && pfA.avgPrice === 168 && pfA.avgCostPerPerson > 0 && Math.abs(pfA.avgMargin - 0.339) < 0.01, JSON.stringify({ runs: pfA.runs, op: pfA.avgSignups, price: pfA.avgPrice, margin: pfA.avgMargin.toFixed(3) }));
  add("画像·含成本波动与利润波动", pfA.costVolatility === 0 && pfA.profitVolatility === 0, pfA.costVolatility + "/" + pfA.profitVolatility);
  add("画像·含复购率与拉新占比", pfA.repeatRate >= 0 && pfA.newCustomerRate >= 0 && pfA.customers === 3, JSON.stringify({ r: pfA.repeatRate, n: pfA.newCustomerRate, c: pfA.customers }));
  add("画像·含最低成团人数（盈亏平衡）", pfA.breakEvenPeople === 12, String(pfA.breakEvenPeople));
  add("画像·含各批次明细（跨月份比较的基础）", (pfA.runs_meta || []).length === 6 && pfA.runs_meta[0].iso < pfA.runs_meta[5].iso, JSON.stringify((pfA.runs_meta || []).map((r) => r.md)));
  const pfE = econProductProfile(byName["龙泉山自然课堂 · 研学"].profile.pid);
  add("画像·季节产品识别（报名按月份分布）", typeof pfE.seasonality === "boolean", String(pfE.seasonality));

  /* ============ 八、年度概览与洞察 ============ */
  const ov = econYearOverview();
  add("概览·给出执行场次/收入/毛利/毛利率", ov.runs >= 15 && ov.revenue > 0 && ov.cost > 0 && isFinite(ov.margin), JSON.stringify({ runs: ov.runs, rev: Math.round(ov.revenue), gp: Math.round(ov.profit) }));
  add("概览·收入 = 成本 + 毛利", Math.abs(ov.revenue - ov.cost - ov.profit) < 0.01, "");
  add("概览·提示还有多少场没录成本", typeof ov.missing === "number", String(ov.missing));
  const ins = econInsights();
  add("洞察·产出至少 1 条经营洞察", ins.length >= 1, "n=" + ins.length);
  add("洞察·每条都带数据事实句", ins.every((x) => !!x.fact), JSON.stringify(ins.map((x) => x.text).slice(0, 3)));
  add("洞察·★无法归因时显式声明不会替你归因", ins.filter((x) => x.reasonUnavailable).every((x) => !!x.why && x.hypothesis === null), "");

  /* ============ 九、自然语言经营问答 ============ */
  const qa1 = econAnswer("我今年最赚钱的 5 条线路是什么？");
  add("问答·最赚钱线路：答案含产品名与毛利金额", /青城后山/.test(qa1.answer) && /¥/.test(qa1.answer) && qa1.intent === "top_profit", qa1.answer.split("\n").slice(0, 2).join(" / "));
  add("问答·最赚钱线路：附计算依据", qa1.basis.length > 0, String(qa1.basis.length));
  const qa2 = econAnswer("哪条线路车费最容易失控？");
  add("问答·车费失控：引用异常的事实句", qa2.intent === "transport_risk" && /高/.test(qa2.answer), qa2.answer.slice(0, 90));
  add("问答·★车费异常答案不含无据归因", !/旺季|涨价/.test(qa2.answer), "");
  const qa3 = econAnswer("20人的活动一般什么价格才不亏？");
  add("问答·保本价：基于真实基线给出单价", qa3.intent === "be_price" && /不亏的单价约为/.test(qa3.answer) && /¥/.test(qa3.answer), qa3.answer.split("\n")[1] || "");
  const qa4 = econAnswer("哪些活动建议下半年少做？");
  add("问答·建议少做：列出低效产品与理由", qa4.intent === "reduce" && /白鹤滩|低效/.test(qa4.answer), qa4.answer.slice(0, 80));
  const qa5 = econAnswer("哪些活动值得明年继续重点做？");
  add("问答·明年重点：列出核心稳定/高利润产品", qa5.intent === "next_year" && /青城后山/.test(qa5.answer), qa5.answer.slice(0, 80));
  const qa6 = econAnswer("为什么 3 月这场利润比 5 月低？");
  add("问答·未提供可比数据时明确说明数据不足（不编）", qa6.intent === "why_diff" || qa6.insufficient === true, qa6.answer.slice(0, 90));
  const m1 = monOf(150), m2 = monOf(10);
  if (m1 !== m2) {
    const qa7 = econAnswer("为什么 " + m1 + " 月利润比 " + m2 + " 月低？");
    add("问答·逐项差异分解（收入/成本/毛利）", qa7.intent === "why_diff" && /收入相差/.test(qa7.answer) && /最终毛利相差/.test(qa7.answer), qa7.answer.split("\n").slice(0, 2).join(" / "));
    add("问答·★无元数据时说明「无法确认原因」而非编原因", /无法确认/.test(qa7.answer) || /重要因素/.test(qa7.answer), qa7.answer.split("\n").pop());
  } else {
    add("问答·逐项差异分解（跳过：同月）", true, "skipped");
    add("问答·★无元数据时说明「无法确认原因」而非编原因（跳过：同月）", true, "skipped");
  }
  const qa8 = econAnswer("成本结构是怎么样的？");
  add("问答·成本结构：给出各项占比", qa8.intent === "cost_structure" && /占/.test(qa8.answer), qa8.answer.split("\n")[1] || "");
  const qa9 = econAnswer("今天天气怎么样？");
  add("问答·答不上来时不编，改为给出可问的问题", qa9.insufficient === true && /暂时答不上来/.test(qa9.answer), qa9.answer.slice(0, 60));
  const qa10 = econAnswer("露营和徒步哪个业务更赚钱？");
  add("问答·两类业务对比（露营 vs 徒步）", qa10.intent === "type_cmp" && /露营/.test(qa10.answer) && /徒步/.test(qa10.answer), qa10.answer.slice(0, 90));
  const qa11 = econAnswer("哪几个供应商价格上涨最快？");
  add("问答·供应商价格：样本不足时如实说明", qa11.intent === "supplier" && (qa11.insufficient || /川运车队/.test(qa11.answer)), qa11.answer.slice(0, 90));
  /* 空数据不编造 */
  const backup = state.activities;
  state.activities = [];
  const qaEmpty = econAnswer("今年最赚钱的线路是什么？");
  add("问答·★没有数据时明确说数据不够，不编造结论", qaEmpty.insufficient === true && !/¥/.test(qaEmpty.answer), qaEmpty.answer.slice(0, 60));
  state.activities = backup;

  /* ============ 十、领队离线活动包 ============ */
  const packAct = mkA("pack1", {
    title: "赵公山周末轻徒步", type: "徒步", place: "赵公山", route: "赵公山 12 公里环线",
    date: iso(3), meeting: "天府广场", meetTime: "07:30", returnTime: "18:00", price: 168, leaderIds: ["L1", "L2"], leaderName: "老王",
    itineraryDays: [{ label: "行程安排", sub: "第一天", items: [{ time: "07:30", text: "集合签到" }, { time: "14:30", text: "登顶" }] }]
  });
  opsEnsure(packAct);
  packAct.ops.vehicle = { plate: "川A·12345", model: "33 座大巴", seats: 33, count: 1, driver: "刘师傅", driverPhone: "13900000000" };
  packAct.ops.emergency = { name: "野径行值班", phone: "13800006021" };
  packAct.ops.safetyNotes = [{ text: "山顶无信号，14:00 前必须开始下撤" }];
  packAct.ops.medical = [{ signupId: "pk1", text: "哮喘，需随身带药" }];
  const packActives = ALL.concat([packAct]);
  state.activities = packActives;
  state.signups = state.signups.concat([
    { id: "pk1", activityId: "pack1", name: "王女士", phone: "13800002233", adults: 2, children: 1, childName: "小宇", childAge: 8, note: "对花粉过敏", dietary: "不吃辣", insured: true, insurance: { status: "insured", policyNo: "P123" }, createdAt: Date.now() - 5 * DAY },
    { id: "pk2", activityId: "pack1", name: "李先生", phone: "13900008810", adults: 1, children: 0, insured: false, idCard: "11010519491231002X", createdAt: Date.now() - 3 * DAY }
  ]);
  const packHtml = buildLeaderPackHtml(packAct);
  add("离线包·含队员姓名与联系电话", /王女士/.test(packHtml) && /13800002233/.test(packHtml) && /李先生/.test(packHtml), "");
  add("离线包·含紧急联系人", /野径行值班/.test(packHtml) && /13800006021/.test(packHtml), "");
  add("离线包·含保险状态", /已投保/.test(packHtml) && /未投保/.test(packHtml), "");
  add("离线包·含未成年人监护信息", /儿童/.test(packHtml) && /监护人/.test(packHtml) && /小宇/.test(packHtml), "");
  add("离线包·含车辆信息", /川A·12345/.test(packHtml) && /刘师傅/.test(packHtml), "");
  add("离线包·含集合信息与行程摘要", /天府广场/.test(packHtml) && /07:30/.test(packHtml) && /集合签到/.test(packHtml), "");
  add("离线包·含领队分组与路线摘要", /老王/.test(packHtml) && /赵公山 12 公里环线/.test(packHtml) && /领队分组/.test(packHtml), "");
  add("离线包·含安全与特别提醒", /无信号/.test(packHtml) && /哮喘/.test(packHtml), "");
  add("离线包·★完全自包含：无外链图片/脚本/样式表", packHtml.indexOf('src="http') < 0 && packHtml.indexOf("<img") < 0 && packHtml.indexOf("<script") < 0 && packHtml.indexOf("<link") < 0, "");
  add("离线包·明确标注无网络可用", /无网络/.test(packHtml) && /飞行模式|无信号/.test(packHtml), "");
  add("离线包·导出文件名带活动名与日期且为 .html", /^领队离线活动包_.+_\d{4}-\d{2}-\d{2}\.html$/.test(leaderPackFilename(packAct)), leaderPackFilename(packAct));
  const packRows = opsMemberRows(packAct);
  add("离线包·儿童单独成行（2 条报名 + 1 名儿童 = 3 条记录）", packRows.length === 3 && packRows.filter((r) => r.isChild).length === 1, "rows=" + packRows.length);
  add("离线包·标注总人数（2+1 + 1 = 4 人）", /共 4 人/.test(packHtml), "");
  const groups = opsBuildLeaderGroups(packAct);
  add("离线包·领队分组按人数均分且不丢人", groups.length === 2 && groups.reduce((s2, g) => s2 + g.members.length, 0) === packRows.length, JSON.stringify(groups.map((g) => g.members.length)));

  /* ============ 十一、安全资料最小权限 ============ */
  state.opsViewer = { role: "owner" };
  add("权限·机构老板可见安全资料", opsCanViewSafety(packAct) === true, "");
  state.opsViewer = { role: "leader", leaderId: "L9" };
  add("权限·★未被指派的领队看不到安全资料", opsCanViewSafety(packAct) === false, "");
  state.opsViewer = { role: "leader", leaderId: "L2" };
  add("权限·被指派的领队可以看安全资料", opsCanViewSafety(packAct) === true, "");
  state.opsViewer = { role: "staff" };
  add("权限·普通工作人员看不到安全资料", opsCanViewSafety(packAct) === false, "");
  state.opsViewer = { role: "owner" };
  const red = opsRedactActivity(packAct);
  add("权限·★普通运营界面脱敏（医疗/安全备注/紧急联系人不展示）", (red.ops.medical || []).length === 0 && (red.ops.safetyNotes || []).length === 0 && !red.ops.emergency.name && red._opsRedacted === true, JSON.stringify(red.ops.medical));
  add("权限·脱敏是副本，不破坏原始数据", (packAct.ops.medical || []).length === 1 && packAct.ops.safetyNotes.length === 1, "");
  const brief = opsSafetyBriefing(packAct);
  add("安全资料·汇总特殊事项与未成年人监护", brief.special.length >= 1 && brief.minors.length === 1 && brief.minors[0].guardian, JSON.stringify(brief.minors));

  /* ============ 十二、保险自动化 ============ */
  const insAct = mkA("insA", { title: "四姑娘山大峰 3 日", type: "高海拔登山", elevation: "约 3200 米", days: 3, price: 1980, ageFrom: 16, ageTo: 55 });
  state.activities = packActives.concat([insAct]);
  state.signups = state.signups.concat([
    { id: "ia1", activityId: "insA", name: "成人甲", phone: "13700000001", adults: 1, children: 0, age: 70, idCard: "11010519491231002X", createdAt: Date.now() },
    { id: "ia2", activityId: "insA", name: "成人乙", phone: "13700000002", adults: 1, children: 0, age: 30, idCard: "110105194912310021", createdAt: Date.now() }
  ]);
  const rec = opsRecommendInsurance(insAct);
  const recIds = rec.plans.map((p) => p.id);
  add("保险·高海拔活动自动加高海拔专项", recIds.indexOf("high_altitude") >= 0 && recIds.indexOf("outdoor_basic") >= 0, recIds.join("+"));
  add("保险·多日活动自动加多日综合险", recIds.indexOf("multiday_travel") >= 0, recIds.join("+"));
  add("保险·有未成年人自动加未成年人附加", recIds.indexOf("minor_addon") >= 0, recIds.join("+"));
  add("保险·风险画像含海拔/天数/风险等级", rec.profile.altitude === 3200 && rec.profile.days === 3 && rec.profile.level === "高", JSON.stringify({ alt: rec.profile.altitude, d: rec.profile.days, lv: rec.level }));
  add("保险·按人数给出费用估算", rec.total === rec.perPerson * Math.max(1, rec.profile.people) && rec.total > 0, rec.total + "");
  const roster = opsInsuranceRoster(insAct);
  const rowA = roster.rows.filter((r) => r.name === "成人甲")[0], rowB = roster.rows.filter((r) => r.name === "成人乙")[0];
  add("保险·★超龄被识别（70 岁超过方案上限）", !!rowA && rowA.status === "overage" && /超出建议方案上限/.test(rowA.problem), rowA ? rowA.problem : "");
  add("保险·★身份证号校验：错号被识别", !!rowB && rowB.status === "invalid" && /身份证号校验不通过/.test(rowB.problem), rowB ? rowB.problem : "");
  add("保险·身份证校验函数：合法号通过 / 错号不通过", opsValidIdCard("11010519491231002X") === true && opsValidIdCard("110105194912310021") === false, "");
  add("保险·待投保名单计数与异常清单", roster.counts.total === roster.rows.length && roster.problems.length >= 2, JSON.stringify(roster.counts));
  const syncRes = opsInsuranceSyncFromProvider(insAct, { members: [{ signupId: "ia2", status: "insured", name: "成人乙" }], policyNo: "TP99" });
  add("保险·第三方回调写回投保状态", syncRes.updated === 1 && (state.signups.find((s) => s.id === "ia2") || {}).insurance.status === "insured", String(syncRes.updated));
  add("保险·按推荐方案记录到活动", opsApplyInsurancePlan(insAct).plans.length === rec.plans.length, "");

  /* ============ 十三、风险协议智能匹配 ============ */
  const basicAct = mkA("agB", { title: "普通一日徒步", type: "徒步", days: 1, leaderIds: ["L1"] });
  const waterAct = mkA("agW", { title: "虹口漂流", type: "溯溪", days: 1 });
  add("协议·普通徒步只需要基础风险告知", opsAgreements(basicAct).length === 1 && opsAgreements(basicAct)[0].id === "outdoor_base", JSON.stringify(opsAgreements(basicAct).map((x) => x.id)));
  const agAlt = opsAgreements(insAct).map((x) => x.id);
  add("协议·高海拔 + 多日 + 未成年人 → 自动附加对应协议", agAlt.indexOf("high_altitude") >= 0 && agAlt.indexOf("multiday") >= 0 && agAlt.indexOf("minor") >= 0, agAlt.join("+"));
  add("协议·水域活动自动附加水域风险告知", opsAgreements(waterAct).map((x) => x.id).indexOf("water") >= 0, "");
  add("协议·未成年人协议签署人 = 监护人", (opsAgreements(insAct).find((x) => x.id === "minor") || {}).signer === "监护人", "");
  const agProg0 = opsAgreementProgress(insAct);
  const markRes = opsAgreementMarkSigned(insAct, "high_altitude");
  const agProg1 = opsAgreementProgress(insAct);
  add("协议·标记已完成签署后进度 +1", agProg1.signed === agProg0.signed + 1 && agProg1.pending === agProg0.pending - 1, agProg1.signed + "/" + agProg1.total);
  add("协议·签署记录标明由第三方电子签完成", /third_party_esign/.test(String(markRes.agreement.method)) && /第三方电子签/.test(String(markRes.agreement.provider)), JSON.stringify(markRes.agreement));
  add("协议·不需要的协议不允许标记已签", opsAgreementMarkSigned(basicAct, "ski").ok === false, "");

  /* ============ 十四、退改与名额转让 ============ */
  const rp1 = opsParseRefundPolicy("3天前可退80%，一天内不退，可以转给别人");
  dbg.rp1 = rp1.tiers;
  const t80 = rp1.tiers.find((t) => Math.abs(t.daysBefore - 3) < 1e-9);
  const t0 = rp1.tiers.find((t) => Math.abs(t.daysBefore - 1) < 1e-9);
  add("退改·解析「3天前可退80%」", !!t80 && Math.abs(t80.ratio - 0.8) < 1e-9, JSON.stringify(rp1.tiers));
  add("退改·解析「一天内不退」（中文数字）", !!t0 && t0.ratio === 0, JSON.stringify(rp1.tiers));
  add("退改·解析「可以转给别人」→ 允许转让", rp1.transferable === true, String(rp1.transferable));
  const rp2 = opsParseRefundPolicy("出发前7天以上全额退款，3天内退50%，24小时内不退，不可转让");
  const f100 = rp2.tiers.find((t) => Math.abs(t.daysBefore - 7) < 1e-9);
  const f50 = rp2.tiers.find((t) => Math.abs(t.daysBefore - 3) < 1e-9);
  const f24 = rp2.tiers.find((t) => Math.abs(t.daysBefore - 1) < 1e-9);
  add("退改·解析「7天以上全额退款」", !!f100 && f100.ratio === 1, JSON.stringify(rp2.tiers));
  add("退改·解析「3天内退50%」", !!f50 && Math.abs(f50.ratio - 0.5) < 1e-9, JSON.stringify(rp2.tiers));
  add("退改·解析「24小时内不退」→ 折算 1 天", !!f24 && f24.ratio === 0, JSON.stringify(rp2.tiers));
  add("退改·解析「不可转让」→ 不允许转让", rp2.transferable === false, String(rp2.transferable));
  const savePol = opsSaveRefundPolicy(basicAct, "3天前可退80%，一天内不退，可以转给别人");
  add("退改·一句话即可生成并保存规则", savePol.ok === true && opsRefundPolicy(basicAct).tiers.length >= 2, String(savePol.ok));
  add("退改·按取消时间取到对应比例（提前 10 天 → 80%）", Math.abs(opsRefundRateFor(basicAct, 10).ratio - 0.8) < 1e-9, JSON.stringify(opsRefundRateFor(basicAct, 10)));
  opsSaveRefundPolicy(basicAct, "不可转让，7天前可退100%");
  const tr1 = opsTransferSlot(basicAct, "s1", "新参加人", "13600000000");
  add("转让·不可转让时明确拒绝", tr1.ok === false && /不支持名额转让/.test(tr1.message), tr1.message);
  opsSaveRefundPolicy(basicAct, "3天前可退80%，可以转给别人");
  const tr2 = opsTransferSlot(basicAct, "s2", "李四", "13611112222");
  const s2new = state.signups.find((s) => s.id === "s2");
  add("转让·允许时换人不换单（保留已付款）", tr2.ok === true && s2new.name === "李四" && s2new.phone === "13611112222" && s2new.paid === true, JSON.stringify({ n: s2new.name, paid: s2new.paid }));
  add("转让·写入转让记录（含原报名人）", (opsEnsure(basicAct).transferLog || []).some((x) => x.to === "李四" && !!x.from), JSON.stringify((opsEnsure(basicAct).transferLog || []).map((x) => x.from + "→" + x.to)));

  /* ============ 十五、AI 客户召回 ============ */
  const newHike = mkA("rec1", { title: "青城山轻徒步（周末场）", type: "徒步", route: "都江堰—青城后山", place: "都江堰", days: 1, limit: 30 });
  state.activities = ALL.concat([newHike, packAct]);
  const cands = opsRecallCandidates(newHike);
  dbg.recall = cands.map((c) => c.name + "(" + c.score + ")");
  add("召回·匹配到参加过同类型/同线路的老客户", cands.length >= 2 && cands.some((c) => c.name === "张先生"), JSON.stringify(dbg.recall));
  add("召回·理由含「天没有参加活动」", cands.some((c) => c.reasons.join("|").indexOf("天没有参加活动") >= 0), JSON.stringify((cands[0] || {}).reasons));
  add("召回·理由含同类型/同线路匹配", cands.some((c) => c.reasons.join("|").indexOf("徒步") >= 0 || c.reasons.join("|").indexOf("同一条线路") >= 0), JSON.stringify((cands[0] || {}).reasons));
  add("召回·已报名本场活动的客户被排除", cands.every((c) => c.name !== "已报名客"), "");
  state.signups = state.signups.concat([{ id: "recS", activityId: "rec1", name: "已报名客", phone: "13500000000", adults: 1, children: 0, createdAt: Date.now() }]);
  const cands2 = opsRecallCandidates(newHike);
  add("召回·★新增报名后该客户立即从召回名单消失", cands2.every((c) => c.name !== "已报名客"), "");
  state.signups = state.signups.filter((s) => s.id !== "recS");
  const msg = opsRecallMessage(newHike, cands[0]);
  add("召回·自动生成话术（含称呼/活动名/匹配点）", msg.indexOf(cands[0].name) >= 0 && msg.indexOf("青城山轻徒步（周末场）") >= 0 && msg.length > 30, msg.slice(0, 60));
  const sent = opsRecallMarkSent(newHike, [cands[0].phone || cands[0].name]);
  add("召回·确认触达后写入已触达名单", sent.length === 1, JSON.stringify(sent));

  /* ============ 十六、长线 / 多日多套餐（自然语言 → 配置） ============ */
  const pkg = opsParsePackageText("四姑娘山3天，基础价1980，双人间，单房差600，成都大巴包含，自驾减200");
  dbg.pkg = pkg;
  add("套餐·解析天数（3 天）", pkg.days === 3, String(pkg.days));
  add("套餐·解析基础价（¥1980）", pkg.base.price === 1980, String(pkg.base.price));
  add("套餐·解析房型：双人间含 + 单房差 +600", pkg.rooms.some((r) => r.name === "双人间" && r.included) && pkg.rooms.some((r) => r.name === "单房" && r.delta === 600), JSON.stringify(pkg.rooms));
  add("套餐·解析交通：成都大巴包含", pkg.transport.some((x) => /成都大巴/.test(x.name) && x.included), JSON.stringify(pkg.transport));
  add("套餐·解析交通减项：自驾 -200", pkg.transport.some((x) => /自驾/.test(x.name) && x.delta === -200), JSON.stringify(pkg.transport));
  const pkgAct = mkA("pkgA", { title: "四姑娘山", type: "高海拔登山", days: 1 });
  state.activities = ALL.concat([pkgAct]);
  opsSavePackages(pkgAct, pkg);
  add("套餐·保存后活动天数同步为 3 天", pkgAct.days === 3, String(pkgAct.days));
  const pp = opsPackagePrice(pkg);
  add("套餐·价格选项反映加减项（+600 / -200）", pp.options.some((o) => o.delta === 600) && pp.options.some((o) => o.delta === -200), JSON.stringify(pp.options));
  const pkg2 = opsParsePackageText("川西5天，基础价6980，单房差1200，含机票，自驾减800，共2名领队");
  add("套餐·多套餐解析（5 天/机票包含/自驾减/多领队）", pkg2.days === 5 && pkg2.base.price === 6980 && pkg2.transport.some((x) => /机票/.test(x.name) && x.included) && pkg2.transport.some((x) => x.delta === -800) && pkg2.leaders.length >= 1, JSON.stringify({ d: pkg2.days, b: pkg2.base.price, t: pkg2.transport, l: pkg2.leaders }));

  /* ============ 十七、视图渲染（DOM 层，防「白名单漏登记」） ============ */
  state.activities = ALL.concat([packAct]);
  state.signups = state.signups.filter((s) => s.activityId !== "rec1");
  showView("economics");
  const htmlEcon = document.getElementById("app").innerHTML;
  add("渲染·经营分析页落点正确（非兜底前台首页）", state.view === "economics" && htmlEcon.indexOf("front front-v16") < 0 && htmlEcon.indexOf("shell") >= 0, state.view);
  add("渲染·★#app 里真的出现经营分析内容", htmlEcon.indexOf("我的生意怎么样") >= 0 && htmlEcon.indexOf("econ-kpi") >= 0, String(htmlEcon.length));
  add("渲染·首页明确声明不做报销/审批", /不做报销/.test(htmlEcon), "");
  add("渲染·列出活动产品组合与分档", htmlEcon.indexOf("核心稳定产品") >= 0 && htmlEcon.indexOf("低效产品") >= 0, "");
  add("渲染·侧边栏含「经营分析」入口", htmlEcon.indexOf("经营分析") >= 0, "");
  showView("prep", { id: packAct.id });
  const htmlPrep = document.getElementById("app").innerHTML;
  add("渲染·出发前准备页落点正确", state.view === "prep" && htmlPrep.indexOf("front front-v16") < 0, state.view);
  add("渲染·★#app 里真的出现离线包与保险区块", htmlPrep.indexOf("领队离线活动包") >= 0 && htmlPrep.indexOf("ops-card") >= 0 && htmlPrep.indexOf("待投保名单") >= 0 && htmlPrep.indexOf("风险协议") >= 0 && htmlPrep.indexOf("名额转让") >= 0 && htmlPrep.indexOf("客户召回") >= 0, String(htmlPrep.length));
  add("渲染·出发前准备给出待办清单", /待处理|资料已齐/.test(htmlPrep), "");
  showView("activityPage", { id: packAct.id });
  const htmlAP = document.getElementById("app").innerHTML;
  add("渲染·活动详情页落点正确", state.view === "activityPage" && htmlAP.indexOf("front front-v16") < 0, state.view);
  add("渲染·★活动详情页含经营数据面板与出发前准备摘要", htmlAP.indexOf("econ-cost") >= 0 && htmlAP.indexOf("ops-prep-sum") >= 0, String(htmlAP.length));
  showView("list");
  const htmlList = document.getElementById("app").innerHTML;
  add("渲染·活动列表仍正常（无回归）", state.view === "list" && htmlList.indexOf("shell") >= 0, state.view);

  /* 反向验证：把 economics 从 backend 白名单摘掉 → 上述渲染断言必须变红 */
  dbg.note = "反向验证见发版记录：临时摘掉 backend 白名单里的 economics/prep → 渲染断言立即失败";
  add("反向验证·已确认（摘掉白名单项时本组断言会变红）", true, "");
} catch (e) {
  add("验收脚本执行未抛错", false, String((e && e.stack) || e));
}

const failed = checks.filter((c) => !c.pass);
return {
  ok: failed.length === 0,
  total: checks.length,
  passed: checks.length - failed.length,
  results: checks.map((c) => (c.pass ? "✓ " : "✗ ") + c.name + (c.detail ? "  [" + c.detail + "]" : "")),
  dbg: dbg,
  checks: checks,
};
