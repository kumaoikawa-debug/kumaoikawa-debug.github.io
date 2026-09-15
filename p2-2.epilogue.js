// P2-2 图片不足自动降级验收：
// ① 封面图不进入正文图池（根因修复：少图时同一张图重复出现）
// ② 正文图在单次选取内互不重复
// ③ 仅封面一张图时，正文图池为空（不重复、不强行塞图）
// ④ 多图选取仍互不重复
// ⑤ 降级档位：<=3 少图 / 4-8 偏少 / >=9 充足
// ⑥ 结果页（xfStyleBar）在少图时提示已自动降级
const checks = [];
const chk = (name, pass, detail) => checks.push({ name, pass: !!pass, detail: detail || "" });
state = (typeof loadState === "function") ? (loadState() || {}) : {};
state.xf = { _styleHistory: [], scenario: "recruit" };

const a = { id: "p2", title: "测试活动", type: "徒步", place: "某山", date: "9月", status: "recruiting" };

// --- 1) 单元验证：xfPhotoSet 排除封面 + 无内部重复 ---
const fakeXf = {
  master: { keyImages: [{ src: "c.jpg", cat: "cover" }, { src: "b.jpg", cat: "scenic" }] },
  strategy: { photoIntel: { used: [{ src: "c.jpg", imageId: "i0" }, { src: "b.jpg", imageId: "i1" }], roles: { i0: "HeroImage", i1: "SupportImage" }, heroId: "i0" } }
};
const sp1 = xfPhotoSet(fakeXf, ["scenic", "people", "action", "detail", "cover", "team"], 6, "c.jpg");
chk("xfPhotoSet-排除封面后不含封面", sp1.every((p) => p.src !== "c.jpg") && sp1.length === 1, "len=" + sp1.length);
chk("xfPhotoSet-排除封面后正文无重复", sp1.length === new Set(sp1.map((p) => p.src)).size);

// 仅封面一张图 → 正文图池应为空
const onlyCover = {
  master: { keyImages: [{ src: "c.jpg", cat: "cover" }] },
  strategy: { photoIntel: { used: [{ src: "c.jpg", imageId: "i0" }], roles: { i0: "HeroImage" }, heroId: "i0" } }
};
const sp0 = xfPhotoSet(onlyCover, ["scenic", "people", "action", "detail", "cover", "team"], 6, "c.jpg");
chk("xfPhotoSet-仅封面时正文为空", sp0.length === 0, "len=" + sp0.length);

// 多图选取无内部重复
const many = [];
for (let i = 0; i < 10; i++) many.push({ src: "m" + i + ".jpg", cat: "scenic" });
const manyXf = { master: { keyImages: many }, strategy: { photoIntel: { used: many.map((p, i) => ({ src: p.src, imageId: "k" + i })), roles: {}, heroId: "k0" } } };
const spm = xfPhotoSet(manyXf, ["scenic"], 20);
chk("xfPhotoSet-多图无内部重复", spm.length === 10 && spm.length === new Set(spm.map((p) => p.src)).size, "len=" + spm.length);

// --- 2) 集成验证：真实生成链路下，少图(2张)封面不重复进正文 ---
const photos = ["c.jpg", "b.jpg"];
state.xf = { scenario: "recruit", photos, photoOverrides: { cover: null, excluded: {} }, _a: a, _styleHistory: [] };
const strat = await genStrategy(a, photos, "", "recruit");
const xf = { scenario: "recruit", photos, photoOverrides: { cover: null, excluded: {} }, _a: a, strategy: strat };
xf.master = (typeof buildContentMaster === "function") ? buildContentMaster(a, photos) : { keyImages: photos.map((s) => ({ src: s })) };
if (typeof xfAttachPhotoCaptions === "function") xf.master.keyImages = await xfAttachPhotoCaptions(xf.master.keyImages, xf.master.confirmedFacts, strat.editorialDirection);
const cover = xfGzhCover(xf);
const secPhotos = xfPhotoSet(xf, ["scenic", "people", "action", "detail", "cover", "team"], 6, cover.src);
chk("集成-少图(2张)封面不重复进正文", cover.src ? secPhotos.every((p) => p.src !== cover.src) : false, "cover=" + cover.src + " sec=" + secPhotos.length);
chk("集成-少图(2张)正文互不重复", secPhotos.length === new Set(secPhotos.map((p) => p.src)).size);

// --- 3) 降级档位 ---
chk("降级-少图档(<=3)", xfPhotoDowngrade({ photos: ["a", "b"] }).tier === "few");
chk("降级-偏少档(4-8)", xfPhotoDowngrade({ photos: ["a", "b", "c", "d", "e"] }).tier === "mild");
chk("降级-充足档(>=9)", xfPhotoDowngrade({ photos: Array.from({ length: 10 }, (_, i) => "a" + i) }).tier === "full");
chk("降级-少图提示非空", !!xfPhotoDowngrade({ photos: ["a", "b"] }).hint);
chk("降级-充足提示为空", xfPhotoDowngrade({ photos: Array.from({ length: 10 }, (_, i) => "a" + i) }).hint === "");

// --- 4) 结果页提示 ---
const sb = xfStyleBar({ scenario: "recruit", family: "route_editorial", variant: 0, strategy: { editorialDirection: { angle: "x" } }, photos: ["a", "b"], photoOverrides: { excluded: {} } });
chk("结果页-少图降级提示可见", sb.indexOf("克制留白版式") >= 0);
const sbFull = xfStyleBar({ scenario: "recruit", family: "route_editorial", variant: 0, strategy: { editorialDirection: { angle: "x" } }, photos: Array.from({ length: 10 }, (_, i) => "a" + i), photoOverrides: { excluded: {} } });
chk("结果页-充足时不显降级提示", sbFull.indexOf("克制留白版式") < 0);

const passed = checks.filter((c) => c.pass).length;
return { ok: passed === checks.length, total: checks.length, passed: passed, checks: checks };
