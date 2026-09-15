// P0-2 验收：4 种徒步变体必须生成明显不同的文案，且无通用套话（呼吸/流汗/放松等）
const variants = [
  { title: "秋季彩林徒步", raw: "秋季彩林徒步，9月20日光雾山，赏红叶，约12公里", dateMD: "2026年9月20日", type: "徒步", place: "光雾山", distance: 12 },
  { title: "夏季溪谷徒步", raw: "夏季溪谷徒步溯溪，7月12日平武藤蔓谷，玩水清凉", dateMD: "2026年7月12日", type: "徒步", place: "藤蔓谷", distance: 8 },
  { title: "雪山挑战", raw: "四姑娘山雪山挑战登顶，10月1日，高海拔越野重装", dateMD: "2026年10月1日", type: "高海拔登山", place: "四姑娘山", distance: 22, elevation: 3800, difficulty: "挑战" },
  { title: "亲子轻徒步", raw: "亲子轻徒步自然教育，10月5日森林公园，带5岁孩子", dateMD: "2026年10月5日", type: "亲子户外", place: "森林公园", audience: ["亲子", "家庭"], ageRange: "5-12岁" }
];
const built = variants.map((v) => {
  const dna = buildActivityDNA(v);
  const copy = applyDnaCopyFallback(Object.assign({}, v, { activityDNA: dna }));
  return { v, dna, copy };
});
const uniq = (arr) => new Set(arr).size === arr.length;
const generic = /大口呼吸|呼吸新鲜空气|尽情流汗|痛快流汗|大汗淋漓|彻底放松|放松一下|放松身心|把城市关掉|诗与远方|惬意|松弛感|无敌|绝美|超赞|breathtaking/;
const allCopyText = built.map((b) => [
  b.copy.heroHook, b.copy.intro,
  (b.copy.body || []).join(""),
  (b.copy.sellingPoints || []).map((s) => s.title + "|" + s.desc).join(""),
  (b.copy.forewordTitles || []).join("")
].join(""));
const hasGeneric = allCopyText.some((t) => generic.test(t));
const prompts = built.map((b) => dnaPromptBlock(b.v));
const checks = [
  { name: "4 变种 mainTheme 各不相同", pass: uniq(built.map((b) => b.dna.mainTheme)) },
  { name: "4 变种 copyAngles 各不相同", pass: uniq(built.map((b) => (b.dna.copyAngles || []).join("|"))) },
  { name: "4 变种 toneWords 各不相同", pass: uniq(built.map((b) => (b.dna.toneWords || []).join("|"))) },
  { name: "4 变种 heroHook 各不相同", pass: uniq(built.map((b) => b.copy.heroHook)) },
  { name: "4 变种 intro 各不相同", pass: uniq(built.map((b) => b.copy.intro)) },
  { name: "4 变种 sellingPoints 各不相同", pass: uniq(built.map((b) => (b.copy.sellingPoints || []).map((s) => s.title).join("|"))) },
  { name: "4 变种 forewordTitles 各不相同", pass: uniq(built.map((b) => (b.copy.forewordTitles || []).join("|"))) },
  { name: "4 变种 DNA 注入提示各不相同", pass: uniq(prompts) },
  { name: "无通用套话（呼吸/流汗/放松等）", pass: !hasGeneric }
];
const allPass = checks.every((c) => c.pass);
return {
  ok: allPass,
  results: built.map((b) => ({
    form: b.dna.activityFormLabel, env: b.dna.environmentLabel, season: b.dna.season,
    coreMotivation: b.dna.coreMotivationLabel,
    mainTheme: b.dna.mainTheme,
    sceneSignature: b.dna.sceneSignature,
    copyAngles: b.dna.copyAngles,
    toneWords: b.dna.toneWords,
    heroHook: b.copy.heroHook,
    sellingPoints: (b.copy.sellingPoints || []).map((s) => s.title),
    forewordTitles: b.copy.forewordTitles
  })),
  checks
};
