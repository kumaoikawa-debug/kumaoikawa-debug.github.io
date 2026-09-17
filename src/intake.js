/* ================= v204：上传活动方案（Word / PPT / PDF / 图片海报）→ 自动生成招募信息 =================
   老板的现状：活动方案躺在 Word / PPT / PDF 里，或者就是别人发来的一张海报图。
   目标：拖进来 → 本地解析出文字 → AI 整理成「活动描述」→ 直接进活动生成流程。

   ★ 诚实原则（承 v193「不虚构」/ v201「事实·文学分层」）：解析只做「搬运 + 整理」，
     **绝不新增原文里没有的事实**；读不出来就如实说读不出来，不猜、不补。
   ★ 零外链依赖：docx / pptx 走自研最小 ZIP 读取 + raw DEFLATE 解压（不引 JSZip，
    也不用 DecompressionStream，老浏览器一样能跑）。
   ★ 唯一的重活是 PDF：浏览器里没有原生 PDF 文本层，只能懒加载 pdf.js（多 CDN 回退）。
     加载失败时给**可执行的替代方案**（转图片上传 / 粘贴文字），而不是一句「失败了」。
*/

/* 可接受的文件后缀（与 admin.html 里 input 的 accept 保持一致） */
const INTAKE_ACCEPT = ".txt,.md,.markdown,.csv,.docx,.pptx,.pdf,image/*";
/* 喂给 AI 的原文上限（防超大方案把上下文撑爆） */
const INTAKE_MAX_CHARS = 12000;
/* 单文件解析后保留的文字上限 */
const INTAKE_MAX_FILE_CHARS = 8000;
/* 图片后缀（视觉 AI 能读的） */
const INTAKE_IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "heic", "heif", "avif"];
/* 老版 Office 二进制格式：浏览器里没有任何可用的纯前端解析方案，如实告知 */
const INTAKE_LEGACY_EXT = ["doc", "ppt", "xls", "xlsx", "wps", "et", "dps", "pages", "key", "numbers"];

/* ---------- ① 文件类型判定（扩展名优先：浏览器给的 MIME 常为空或 octet-stream） ---------- */
function intakeKindOf(name, mime) {
  const n = String(name || "").toLowerCase();
  const m = String(mime || "").toLowerCase();
  const ext = (n.match(/\.([a-z0-9]+)$/) || [])[1] || "";
  if (ext === "docx") return { kind: "docx", ext: ext, ok: true };
  if (ext === "pptx") return { kind: "pptx", ext: ext, ok: true };
  if (ext === "pdf") return { kind: "pdf", ext: ext, ok: true };
  if (["txt", "md", "markdown", "csv", "json", "text"].indexOf(ext) >= 0) return { kind: "text", ext: ext, ok: true };
  if (INTAKE_IMAGE_EXT.indexOf(ext) >= 0 || /^image\//.test(m)) return { kind: "image", ext: ext || "image", ok: true };
  if (INTAKE_LEGACY_EXT.indexOf(ext) >= 0) {
    return { kind: "unsupported", ext: ext, ok: false, reason: "旧版 Office 格式（." + ext + "）浏览器读不了，请另存为 .docx / .pptx 或导出 PDF 再上传" };
  }
  if (/^application\/pdf/.test(m)) return { kind: "pdf", ext: "pdf", ok: true };
  if (/wordprocessingml/.test(m)) return { kind: "docx", ext: "docx", ok: true };
  if (/presentationml/.test(m)) return { kind: "pptx", ext: "pptx", ok: true };
  return { kind: "unsupported", ext: ext || "?", ok: false, reason: "暂不支持这种格式" + (ext ? "（." + ext + "）" : "") };
}
/* 给 file input 用：把一批文件分成「能读的 / 读不了的」，UI 直接照此提示 */
function intakeSplitFiles(files) {
  const list = Array.from(files || []).map(function (f) {
    const k = intakeKindOf(f && f.name, f && f.type);
    return { file: f, name: (f && f.name) || "未命名文件", kind: k.kind, ok: k.ok, reason: k.reason || "" };
  });
  return { ok: list.filter(function (x) { return x.ok; }), bad: list.filter(function (x) { return !x.ok; }) };
}

/* ---------- ② raw DEFLATE（ZIP method 8）解压：纯 JS、零依赖 ---------- */
/* 长度码基值/附加位、距离码基值/附加位、码长表顺序（RFC 1951 固定表） */
const INTAKE_LEN_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const INTAKE_LEN_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const INTAKE_DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const INTAKE_DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const INTAKE_CLEN_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

/* 规范 Huffman 表：只存「各长度码字数 + 按长度排好的符号」，解码时边读位边定位（puff 的经典做法） */
function intakeHuff(lengths) {
  const MAXBITS = 15;
  const counts = new Uint16Array(MAXBITS + 1);
  let i = 0;
  for (i = 0; i < lengths.length; i++) counts[lengths[i]]++;
  counts[0] = 0;
  const offs = new Uint16Array(MAXBITS + 2);
  for (i = 1; i <= MAXBITS; i++) offs[i + 1] = offs[i] + counts[i];
  const symbols = new Uint16Array(lengths.length);
  for (i = 0; i < lengths.length; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
  return { counts: counts, symbols: symbols };
}
function intakeInflateRaw(src) {
  const u8 = src instanceof Uint8Array ? src : new Uint8Array(src);
  let pos = 0, bit = 0;
  function bits(n) {
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (pos >= u8.length) throw new Error("压缩数据不完整");
      v |= ((u8[pos] >> bit) & 1) << i;
      if (++bit === 8) { bit = 0; pos++; }
    }
    return v;
  }
  function align() { if (bit) { bit = 0; pos++; } }
  function decode(h) {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len <= 15; len++) {
      code |= bits(1);
      const count = h.counts[len];
      if (code - first < count) return h.symbols[index + (code - first)];
      index += count; first = (first + count) << 1; code <<= 1;
    }
    throw new Error("无效的哈夫曼编码");
  }
  /* 输出用单块可增长缓冲：LZ77 回引可跨「已输出」的任意位置，分块会断链 */
  let buf = new Uint8Array(1 << 16), len = 0;
  function ensure(extra) {
    if (len + extra <= buf.length) return;
    let cap = buf.length;
    while (cap < len + extra) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(buf.subarray(0, len));
    buf = nb;
  }
  let fixedLit = null, fixedDist = null;
  for (;;) {
    const last = bits(1), type = bits(2);
    if (type === 0) {                                   // 无压缩块
      align();
      if (pos + 4 > u8.length) throw new Error("压缩数据不完整");
      const blen = u8[pos] | (u8[pos + 1] << 8);
      pos += 4;
      if (pos + blen > u8.length) throw new Error("压缩数据不完整");
      ensure(blen);
      buf.set(u8.subarray(pos, pos + blen), len);
      len += blen;
      pos += blen;
    } else if (type === 1 || type === 2) {
      let litH, distH;
      if (type === 1) {                                 // 固定 Huffman
        if (!fixedLit) {
          const ll = new Uint8Array(288);
          for (let i = 0; i < 288; i++) ll[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8;
          const dd = new Uint8Array(30);
          for (let i = 0; i < 30; i++) dd[i] = 5;
          fixedLit = intakeHuff(ll); fixedDist = intakeHuff(dd);
        }
        litH = fixedLit; distH = fixedDist;
      } else {                                          // 动态 Huffman
        const hlit = bits(5) + 257, hdist = bits(5) + 1, hclen = bits(4) + 4;
        const clens = new Uint8Array(19);
        for (let i = 0; i < hclen; i++) clens[INTAKE_CLEN_ORDER[i]] = bits(3);
        const clH = intakeHuff(clens);
        const lens = new Uint8Array(hlit + hdist);
        let i = 0;
        while (i < lens.length) {
          const sym = decode(clH);
          if (sym < 16) lens[i++] = sym;
          else if (sym === 16) { const p = lens[i - 1]; let n = bits(2) + 3; while (n-- > 0) lens[i++] = p; }
          else if (sym === 17) { let n = bits(3) + 3; while (n-- > 0) lens[i++] = 0; }
          else { let n = bits(7) + 11; while (n-- > 0) lens[i++] = 0; }
        }
        litH = intakeHuff(lens.subarray(0, hlit));
        distH = intakeHuff(lens.subarray(hlit));
      }
      for (;;) {
        const sym = decode(litH);
        if (sym < 256) { ensure(1); buf[len++] = sym; continue; }
        if (sym === 256) break;
        const li = sym - 257;
        if (li >= 29) throw new Error("无效的长度码");
        const length = INTAKE_LEN_BASE[li] + bits(INTAKE_LEN_EXTRA[li]);
        const di = decode(distH);
        if (di >= 30) throw new Error("无效的距离码");
        const dist = INTAKE_DIST_BASE[di] + bits(INTAKE_DIST_EXTRA[di]);
        if (dist > len) throw new Error("无效的回引距离");
        ensure(length);
        const from = len - dist;
        for (let k = 0; k < length; k++) buf[len++] = buf[from + k];   // 允许重叠（RLE 语义）
      }
    } else {
      throw new Error("无效的压缩块类型");
    }
    if (last) break;
  }
  return buf.subarray(0, len);
}

/* ---------- ③ 最小 ZIP 读取（docx / pptx 都是 zip 包） ---------- */
function intakeZipEntries(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (u8.length < 22) return null;
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  /* 从尾部往前找 EOCD（PK\x05\x06）；最多回看 66KB 以兼容 zip 注释 */
  let eocd = -1;
  const floor = Math.max(0, u8.length - 66000);
  for (let i = u8.length - 22; i >= floor; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder("utf-8");
  const out = [];
  for (let i = 0; i < count && p + 46 <= u8.length; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    if (lho + 30 <= u8.length && dv.getUint32(lho, true) === 0x04034b50) {
      const lnlen = dv.getUint16(lho + 26, true);
      const lelen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lnlen + lelen;
      if (start + csize <= u8.length) out.push({ name: name, method: method, data: u8.subarray(start, start + csize) });
    }
    p += 46 + nlen + elen + clen;
  }
  return out.length ? out : null;
}
/* 取出某个 zip 条目的文本（method 0 = 原样存，method 8 = raw deflate） */
function intakeZipText(entries, name) {
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].name === name) {
      const e = entries[i];
      const raw = e.method === 0 ? e.data : (e.method === 8 ? intakeInflateRaw(e.data) : null);
      if (!raw) return null;
      return new TextDecoder("utf-8").decode(raw);
    }
  }
  return null;
}

/* ---------- ④ 文本清洗（XML 抽文之后统一走这里） ---------- */
function intakeCleanText(s) {
  const lines = String(s == null ? "" : s).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const t0 = String(lines[i])
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
      .replace(/[ \t\u00a0\u3000]+/g, " ")
      .trim();
    /* 真空行 = 段落间隔，保留一个空行 */
    if (!t0) { if (out.length && out[out.length - 1] !== "") out.push(""); continue; }
    /* ★纯装饰行（分隔线 ———、※、★、页码装饰等）整行丢弃，且**不留空行** ——
       否则一条分隔线会在正文里切出一个假段落。判据：不含任何汉字/字母/数字。 */
    if (!/[\u4e00-\u9fa5A-Za-z0-9]/.test(t0)) continue;
    const t = t0.replace(/^[·•▪◦※*\-–—>》]+/, "").trim();
    if (!t) continue;
    if (out[out.length - 1] === t) continue;                              // 相邻重复行（PPT 母版常见）
    out.push(t);
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  while (out.length && out[0] === "") out.shift();
  return out.join("\n");
}
/* docx / pptx 的 XML → 纯文本：靠「闭合标签」定位段落边界，再统一剥标签（比逐层解析稳） */
function intakeXmlToText(xml) {
  return String(xml || "")
    /* v205：先剥掉所有属性值，再剥标签。AI 生成的 PPT 常把整套版式源码塞进形状 descr（替代文字）
       属性里，且源码里的 ">" 没做 XML 转义 —— 不先剥属性，后面的剥标签会在那个 ">" 提前终止，
       剩下的源码全被当成正文漏进来，几千字垃圾吃掉长度预算，真正的行程页反而被截掉。 */
    .replace(/\s[a-zA-Z_:][-\w.:]*="[^"]*"/g, "")
    .replace(/\s[a-zA-Z_:][-\w.:]*='[^']*'/g, "")
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/w:tc>/g, " ｜ ")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<a:br\b[^>]*\/?>/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    /* 表格：单元格内段落结束会先插一个换行，把「里程 / ｜ 12公里」并回同一行 */
    .replace(/\n[ \t]*｜/g, " ｜ ");
}
function intakeSlideIdx(name) { const m = String(name).match(/^ppt\/slides\/slide(\d+)\.xml$/i); return m ? +m[1] : 0; }
function intakeNotesIdx(name) { const m = String(name).match(/^ppt\/notesSlides\/notesSlide(\d+)\.xml$/i); return m ? +m[1] : 0; }

/* ---------- ⑤ docx / pptx → 文字 ---------- */
function intakeFromOoxml(buf, kind) {
  let entries;
  try { entries = intakeZipEntries(buf); } catch (e) { entries = null; }
  if (!entries) return { error: "这个文件不是有效的 " + (kind === "docx" ? "Word" : "PPT") + " 文件（压缩包结构损坏）" };
  if (kind === "docx") {
    let xml = null;
    try { xml = intakeZipText(entries, "word/document.xml"); } catch (e) { xml = null; }
    if (xml == null) return { error: "这个 Word 文件里没有正文（可能是纯图片文档或加密文件）" };
    const text = intakeCleanText(intakeXmlToText(xml)).slice(0, INTAKE_MAX_FILE_CHARS);
    return text ? { text: text } : { error: "Word 正文是空的，或内容全在图片里（请把正文截图后按图片上传）" };
  }
  const slides = entries.filter(function (e) { return intakeSlideIdx(e.name); })
    .sort(function (a, b) { return intakeSlideIdx(a.name) - intakeSlideIdx(b.name); });
  if (!slides.length) return { error: "这个 PPT 里没有找到幻灯片正文" };
  const parts = [];
  for (let i = 0; i < slides.length; i++) {
    let t = "";
    try { t = intakeCleanText(intakeXmlToText(intakeZipText(entries, slides[i].name) || "")); } catch (e) { t = ""; }
    if (t) parts.push("【第 " + intakeSlideIdx(slides[i].name) + " 页】\n" + t);
  }
  const notes = entries.filter(function (e) { return intakeNotesIdx(e.name); })
    .sort(function (a, b) { return intakeNotesIdx(a.name) - intakeNotesIdx(b.name); });
  let noteTxt = "";
  for (let i = 0; i < notes.length; i++) {
    let t = "";
    try { t = intakeCleanText(intakeXmlToText(intakeZipText(entries, notes[i].name) || "")); } catch (e) { t = ""; }
    if (t) noteTxt += (noteTxt ? "\n" : "") + t;
  }
  if (noteTxt) parts.push("【演讲备注】\n" + noteTxt);
  const text = parts.join("\n").slice(0, INTAKE_MAX_FILE_CHARS);
  return text ? { text: text } : { error: "PPT 页面里没有文字（可能是纯图版式，请把关键页截图后按图片上传）" };
}

/* ---------- ⑦c v206：按天行程抽取 → 行程页直接用方案原文 ----------
   形态：Day 1 / DAY 2 / 第一天 作天标题；其后「08:00 - 12:00」这样的时刻段 +
   下一行非空描述 = 一条时间轴。原则仍是宁可缺也不猜：抽不到就返回空数组，
   让行程页回落到 AI 生成，绝不拿无关行拼凑行程。 */
const INTAKE_DAY_RE = /^(?:day|d|第)\s*(\d+)\s*(?:天|日)?(?:\s*(?:时间计划|行程|schedule))?$/i;
const INTAKE_DAY_CN = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
function intakeDayNo(line) {
  const t = String(line || "").trim();
  let m = t.match(INTAKE_DAY_RE);
  if (m) return +m[1];
  m = t.match(/^第\s*([一二三四五六七八九十])\s*天/);
  if (m) return INTAKE_DAY_CN.indexOf(m[1]) + 1;
  m = t.match(/^第\s*(\d+)\s*天/);
  if (m) return +m[1];
  return 0;
}
/* 追加一条时间轴；返回是否真的写入（重复汇总行会被丢掉） */
function intakePushItem(cur, time, text) {
  if (!cur) return false;
  const txt = String(text || "").slice(0, 60);
  if (!txt) return false;
  const prev = cur.items[cur.items.length - 1];
  /* 单点时刻（无区间）且描述已被上一条覆盖 → 是汇总行（如「21:00 返回酒店」），丢掉 */
  if (prev && !/[-–—~至]/.test(time) && (prev.text.indexOf(txt) >= 0 || txt.indexOf(prev.text) >= 0)) return false;
  cur.items.push({ time: time, text: txt });
  return true;
}
function intakeParseItinerary(text) {
  const lines = String(text || "").split("\n").map(function (x) { return String(x || "").trim(); });
  const days = [];
  let cur = null, pendTime = "";
  const isTime = function (L) { return /^\d{1,2}[:：]\d{2}/.test(L); };
  const isRange = function (L) { return /^\d{1,2}[:：]\d{2}\s*[-–—~至]\s*\d{1,2}[:：]\d{2}/.test(L); };
  const isNoise = function (L) {
    if (!L) return true;
    if (/^\d{2,4}\s*\/\s*\d{1,2}/.test(L)) return true;                 // 页码 05 / 15
    if (/^(ARC|arc)/.test(L)) return true;                              // 页脚品牌
    if (/^\d{2,4}\s*(KM|M|MIN|km|m|min)$/i.test(L)) return true;        // 统计数字
    if (/^(全天车程|最高海拔|金山观景|返程|里程|车程)$/.test(L)) return true;
    return false;
  };
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (!L) { continue; }
    const dn = intakeDayNo(L);
    if (dn >= 1) {
      cur = { no: dn, label: "第 " + dn + " 天", sub: "", items: [] };
      days.push(cur); pendTime = "";
      /* 天标题后紧跟的非时刻行（路线概述）作为 sub */
      for (let j = i + 1; j < lines.length; j++) {
        const nx = lines[j];
        if (!nx) continue;
        if (isTime(nx) || intakeDayNo(nx)) break;
        if (!isNoise(nx) && nx.length <= 40) { cur.sub = nx; break; }
        break;
      }
      continue;
    }
    if (!cur) continue;
    /* 两种形态都要支持：①「08:00 - 12:00」独占一行、描述在下一行（PPT 常见）
       ②「08:00 集合出发」时刻与描述同行（Word / 表格常见） */
    const rm = L.match(/^(\d{1,2}[:：]\d{2}\s*[-–—~至]\s*\d{1,2}[:：]\d{2})\s*(.*)$/);
    const tm = L.match(/^(\d{1,2}[:：]\d{2})\s*(.*)$/);
    if (rm) {
      /* 只归一化分隔符本身，保留原空格（「08:00 - 12:00」比「08:00-12:00」好读） */
      pendTime = rm[1].replace(/\s+/g, " ").replace(/\s*[-–—~至]\s*/, " - ");
      if (rm[2]) { intakePushItem(cur, pendTime, rm[2]); pendTime = ""; }
      continue;
    }
    if (tm) {
      pendTime = tm[1];
      if (tm[2]) { intakePushItem(cur, pendTime, tm[2]); pendTime = ""; }
      continue;
    }
    if (isNoise(L)) continue;
    if (pendTime) { intakePushItem(cur, pendTime, L); pendTime = ""; continue; }
  }
  /* 合并同一天（同一 Day 号可能在总览页与计划页各出现一次） */
  const merged = [];
  days.forEach(function (d) {
    const hit = merged.filter(function (m) { return m.no === d.no; })[0];
    if (!hit) { merged.push({ no: d.no, label: d.label, sub: d.sub, items: d.items.slice() }); return; }
    if (!hit.sub && d.sub) hit.sub = d.sub;
    d.items.forEach(function (it) {
      const dup = hit.items.some(function (x) { return x.time === it.time && x.text === it.text; });
      if (!dup) hit.items.push(it);
    });
  });
  const out = merged
    .filter(function (d) { return d.items.length > 0; })
    .sort(function (a, b) { return a.no - b.no; })
    .map(function (d) { return { label: d.label, sub: d.sub, items: d.items }; });
  return out;
}

/* ---------- ⑦b v205：结构化事实抽取 → 确认卡「按你上传的方案」预填 ----------
   原则：宁可缺也不猜 —— 每个字段都要有明确的标签行或强模式才给值；抽不到就不给，
   让确认卡回落到历史/规则来源，绝不用模糊匹配编一个像样的地点或时间。 */
function intakeRouteOf(s) {
  const parts = String(s || "").split(/[·、，,\s—–]+/).map(function (x) { return x.trim(); }).filter(Boolean);
  const names = parts.map(function (p) {
    const segs = p.split(/(?:省|自治区|市|州|区|县|镇|乡)+/).filter(Boolean);
    return (segs.length ? segs[segs.length - 1] : p).replace(/(省|市|州|区|县|镇|乡)$/, "");
  }).filter(function (x) { return x.length >= 2; });
  const uniq = []; names.forEach(function (n) { if (uniq.indexOf(n) < 0) uniq.push(n); });
  return uniq.slice(0, 4).join("—");
}
function intakeParseFields(text) {
  const lines = String(text || "").split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
  const f = {};
  const LABEL_RE = /^(活动时间|出行时间|活动日期|出发日期|集合时间|出发时间|集合地点|集合位置|上车地点|集合|活动人数|人数限制|人数|名额|活动地点|地点|活动价格|价格|费用|人均费用|人均)$/;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const pm = L.match(/^([^：:]{1,8})[：:]\s*(.+)$/);
    const lab = (pm && LABEL_RE.test(pm[1])) ? pm[1] : (LABEL_RE.test(L) ? L : "");
    if (!lab) continue;
    const v = (pm && lab === pm[1]) ? pm[2].trim() : (lines[i + 1] || "");
    if (!v) continue;
    if ((lab.indexOf("时间") >= 0 && lab.indexOf("集合") < 0 && lab.indexOf("出发") < 0) || lab.indexOf("日期") >= 0) {
      if (!f.date && /月|日|\/|\d{4}/.test(v)) f.date = v.slice(0, 60);
    } else if (lab === "集合地点" || lab === "集合位置" || lab === "上车地点" || lab === "集合") {
      if (!f.meeting) f.meeting = v.slice(0, 40);
    } else if (lab === "集合时间" || lab === "出发时间") {
      if (!f.meetTime) f.meetTime = v.slice(0, 40);
    } else if (lab.indexOf("人数") >= 0 || lab === "名额") {
      const n = v.match(/\d{1,4}/); if (n && !f.limit) f.limit = n[0];
    } else if (lab === "活动价格" || lab === "价格" || lab === "费用" || lab.indexOf("人均") >= 0) {
      const n = v.match(/(\d{2,5})/); if (n && !f.price) f.price = n[1];
    } else if (lab === "活动地点" || lab === "地点") {
      if (!f.route) f.route = intakeRouteOf(v);
    }
  }
  /* 无标签行的强模式兜底：时刻段（08:00 - 12:00）后两三行里出现「集合出发」才算集合时间 */
  if (!f.meetTime) {
    for (let i = 0; i < lines.length; i++) {
      if (!/^\d{1,2}[:：]\d{2}/.test(lines[i])) continue;
      for (let j = i + 1; j <= i + 3 && j < lines.length; j++) {
        const mm = lines[j].match(/[\u4e00-\u9fa5]{2,6}(?:集合出发|等地集合|集合)/);
        if (mm) {
          f.meetTime = (((lines[i].match(/(\d{1,2}[:：]\d{2})/) || [])[1]) || "") + " 出发";
          if (!f.meeting) f.meeting = mm[0].replace(/集合.*/, "") + "集合";
          break;
        }
      }
      if (f.meetTime) break;
    }
  }
  const t = String(text || "");
  if (!f.limit) { const m2 = t.match(/限\s*(\d{1,4})\s*人/); if (m2) f.limit = m2[1]; }
  if (!f.days) {
    const dm = t.match(/(\d+)\s*天\s*\d*\s*夜?/);
    if (dm) f.days = dm[1];
    else if (/两天一夜|两日/.test(t)) f.days = "2";
    else if (/三天两夜|三日/.test(t)) f.days = "3";
    else if (/一日游|当天往返/.test(t)) f.days = "1";
    else {
      let mx = 0; t.replace(/DAY\s*(\d+)/gi, function (all, n) { mx = Math.max(mx, +n); return all; });
      if (mx >= 1) f.days = String(mx);
    }
  }
  if (!f.route) {
    const m3 = t.match(/(?:位于|目的地?为?)([^\n。]{4,40}?)(?:境内|[。\n ]|$)/);
    if (m3) f.route = intakeRouteOf(m3[1]);
  }
  return f;
}

/* ---------- ⑥ PDF：懒加载 pdf.js（多 CDN 回退） ---------- */
const INTAKE_PDF_LIB = [
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"
];
const INTAKE_PDF_WORKER = [
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"
];
/* 依次尝试加载脚本；全部失败返回 false（不抛异常，让上层给替代方案） */
function intakeLoadScript(urls) {
  return new Promise(function (resolve) {
    let i = 0;
    const next = function () {
      if (i >= urls.length) return resolve(false);
      const url = urls[i++];
      let done = false;
      const finish = function (ok) { if (done) return; done = true; ok ? resolve(true) : next(); };
      try {
        const s = document.createElement("script");
        s.src = url;
        s.async = true;
        s.onload = function () { setTimeout(function () { finish(true); }, 0); };
        s.onerror = function () { finish(false); };
        (document.head || document.body || document.documentElement).appendChild(s);
        setTimeout(function () { finish(false); }, 12000);
      } catch (e) { finish(false); }
    };
    next();
  });
}
async function intakePdfLib() {
  if (typeof window !== "undefined" && window.pdfjsLib) return window.pdfjsLib;
  const ok = await intakeLoadScript(INTAKE_PDF_LIB);
  if (!ok || !(typeof window !== "undefined" && window.pdfjsLib)) return null;
  return window.pdfjsLib;
}
async function intakeFromPdf(buf) {
  const lib = await intakePdfLib();
  if (!lib) return { error: "PDF 解析引擎没加载成功（通常是网络原因）。替代办法：把 PDF 截图 / 导出成图片上传，或直接把文字粘贴到「活动描述」" };
  try {
    lib.GlobalWorkerOptions.workerSrc = INTAKE_PDF_WORKER[0];
    const doc = await lib.getDocument({ data: new Uint8Array(buf) }).promise;
    const parts = [];
    const maxPage = Math.min(doc.numPages || 0, 40);
    for (let i = 1; i <= maxPage; i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const txt = intakeCleanText((tc.items || []).map(function (it) { return it.str || ""; }).join(" "));
      if (txt) parts.push("【第 " + i + " 页】\n" + txt);
    }
    const text = parts.join("\n").slice(0, INTAKE_MAX_FILE_CHARS);
    if (!text) return { error: "这个 PDF 里读不到文字层（多半是扫描件或图片型 PDF）。替代办法：把 PDF 截图后按图片上传" };
    return { text: text, pageCount: doc.numPages };
  } catch (e) {
    return { error: "PDF 内容读取失败（可能是加密文件或损坏）。替代办法：把 PDF 截图后按图片上传" };
  }
}

/* ---------- ⑦ 多文件合并 + 无 AI 时的诚实回填 ---------- */
function intakeMergeTexts(items) {
  const parts = [];
  for (let i = 0; i < (items || []).length; i++) {
    const t = items[i] && items[i].text;
    if (!t) continue;
    parts.push((items.length > 1 ? "【来源：" + items[i].name + "】\n" : "") + t);
  }
  return parts.join("\n\n").slice(0, INTAKE_MAX_CHARS);
}
/* ★ 不编造：没有 AI 时只把原文裁一段出来，一个字都不加/不改顺序 */
function intakeFallbackDescription(text) {
  /* ★v206：1500 字会把方案后半段的逐日行程整段截掉（实测 2820 字的方案卡在第 8 页 Day 2 中间）。
     行程是行程页的唯一原材料，宁可描述长一点，也不能丢。 */
  return intakeCleanText(String(text || "").slice(0, 4000));
}
/* 送进 AI 的整理指令：只许搬运与重组，不许新增事实（承 v193 / v201 / v203） */
const INTAKE_SYSTEM = [
  "你在帮户外俱乐部的老板整理活动方案。用户给你的是一份活动方案（来自 Word / PPT / PDF / 海报识图）的原始文字。",
  "请把它整理成一段【活动描述】，供后续系统生成活动招募页使用。",
  "硬规则（必须逐条遵守）：",
  "1. 只能使用原文里**已经出现**的信息，做搬运与重组；**绝对不允许**新增、推测、补全任何未出现的事实（地点、日期、价格、名额、装备、注意事项、交通、保险都不许编）。",
  "2. 原文没有的信息一律不写，也不要用「待定」「请补充」这类占位话术。",
  "3. 原文里的精确数字（日期、集合时间、价格、名额、公里、海拔、天数、适合年龄）必须**原样保留**，不要改写成含糊说法。",
  "4. 删掉与活动内容无关的东西：公司抬头、页眉页脚、模板说明、目录、免责声明、版权信息、水印、二维码文字、纯装饰字。",
  "5. ★行程安排（Day 1 / Day 2 / 第一天…，各时间点+地点+做什么）是系统生成行程页的**唯一原材料**，必须按天、按时间顺序**逐条完整保留**（每一条都写成「08:00 - 12:00 成都集合出发，前往康定城区」这样的完整一行），**绝对不许**压缩成一句总结、不许合并时段、不许只挑亮点。",
  "6. 输出一段自然语言的中文描述，可以分段；不要 markdown 标题、不要 JSON、不要解释你在做什么、不要复述本规则。",
  "7. 除行程外的部分控制在 500 字以内；★但行程时间轴不受此限制，方案里写了多少条就保留多少条（可以超过 900 字）。"
].join("\n");

/* ---------- ⑧ 文件读取（DOM 侧） ---------- */
function intakeReadFile(file, as) {
  return new Promise(function (resolve) {
    let done = false;
    const finish = function (v) { if (!done) { done = true; resolve(v); } };
    try {
      const r = new FileReader();
      r.onerror = function () { finish(null); };
      r.onload = function (e) { finish(e && e.target ? e.target.result : null); };
      if (as === "text") r.readAsText(file, "utf-8");
      else if (as === "dataURL") r.readAsDataURL(file);
      else r.readAsArrayBuffer(file);
    } catch (e) { finish(null); }
  });
}
/* 文本解码：UTF-8 优先；出现大量替换符说明是 GBK/GB18030（Windows 记事本常见），再试一次 */
function intakeDecodeText(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  try { s = new TextDecoder("utf-8").decode(u8); } catch (e) { s = ""; }
  const bad = (s.match(/\uFFFD/g) || []).length;
  if (bad && bad > Math.max(1, Math.floor(s.length * 0.02))) {
    try {
      const g = new TextDecoder("gbk").decode(u8);
      if ((g.match(/\uFFFD/g) || []).length < bad) s = g;
    } catch (e) {}
  }
  return s;
}
/* 纯逻辑层入口（不碰 DOM）：字节 → 文字。docx/pptx/pdf/文本 全走这里，便于单测 */
async function intakeFromBytes(buf, kind) {
  if (kind === "docx" || kind === "pptx") return intakeFromOoxml(buf, kind);
  if (kind === "pdf") return await intakeFromPdf(buf);
  const t = intakeCleanText(intakeDecodeText(buf)).slice(0, INTAKE_MAX_FILE_CHARS);
  return t ? { text: t } : { error: "这个文件里没有文字" };
}
/* 单文件 → { text } | { error }。图片走视觉 AI（视觉不可用时如实说明） */
async function intakeExtractOne(file, kind) {
  const name = (file && file.name) || "未命名文件";
  if (kind === "image") {
    const src = await intakeReadFile(file, "dataURL");
    if (!src) return { error: "「" + name + "」读取失败" };
    if (typeof visionReadPoster !== "function") return { error: "这个版本缺少读图模块，请改用文档上传" };
    const r = await visionReadPoster(src);
    if (!r || !r.text) return { error: (r && r.reason) || "这张图没能读出活动信息" };
    return { text: r.text };
  }
  if (kind === "text" || kind === "docx" || kind === "pptx" || kind === "pdf") {
    const b = await intakeReadFile(file, "buffer");
    if (!b) return { error: "「" + name + "」读取失败" };
    return await intakeFromBytes(b, kind);
  }
  return { error: "暂不支持这种格式" };
}

/* ---------- ⑨ 编排：文件 → 描述（UI 只负责显示） ---------- */
function intakeState() {
  if (!state._intake) state._intake = { busy: false, busyText: "", items: [], description: "", warn: "", fields: {}, itinerary: [], _fresh: false };
  if (!state._intake.fields) state._intake.fields = {};
  if (!state._intake.itinerary) state._intake.itinerary = [];
  return state._intake;
}
/* 某个文件一行的显示（读到了 / 没读到，都如实写清楚） */
function intakeRowHtml(x) {
  const ic = (x && x.kind === "image") ? "image" : "file-text";
  return '<div class="intake-row"><span class="intake-row-ic">' + ICON(ic) + "</span>"
    + '<span class="intake-row-n">' + esc((x && x.name) || "文件") + "</span>"
    + '<span class="intake-row-s ' + (x && x.ok ? "ok" : "bad") + '">' + esc((x && x.note) || "") + "</span></div>";
}
/* 「上传方案」区块下方的状态面板：逐文件结果 + 结果摘要（有内容才渲染） */
function intakePanelHtml() {
  const it = state._intake;
  if (!it) return "";
  const items = it.items || [];
  if (it.busy) {
    return '<div class="intake-panel" id="intakePanel">' + items.map(intakeRowHtml).join("")
      + '<div class="intake-row intake-row-busy"><span class="intake-spin"></span>'
      + '<span class="intake-row-n">' + esc(it.busyText || "正在读取方案…") + "</span></div></div>";
  }
  if (!items.length && !it.description && !(it.itinerary || []).length) return "";
  const warn = it.warn ? '<div class="intake-warn">' + ICON("alert-triangle") + "<span>" + esc(it.warn) + "</span></div>" : "";
  /* v206：行程是行程页的原材料，单独列出来让老板核对有没有读全 */
  let itinHtml = "";
  const itins = it.itinerary || [];
  if (itins.length) {
    const cnt = itins.reduce(function (n, d) { return n + (d.items || []).length; }, 0);
    itinHtml = '<div class="intake-itin"><div class="intake-desc-h">' + ICON("map")
      + " 已读出 " + itins.length + " 天 / " + cnt + " 条行程（生成时会直接用到行程页）</div>"
      + itins.map(function (d) {
        return '<div class="intake-itin-d"><b>' + esc(d.label) + "</b>"
          + (d.sub ? '<span class="intake-itin-s">' + esc(d.sub) + "</span>" : "")
          + '<div class="intake-itin-i">' + (d.items || []).map(function (t) {
            return "<span>" + esc(t.time) + " " + esc(t.text) + "</span>";
          }).join("") + "</div></div>";
      }).join("") + "</div>";
  }
  const desc = it.description
    ? '<div class="intake-desc"><div class="intake-desc-h">' + ICON("check") + " 已整理成活动描述（已填到下面的输入框，可直接修改）</div>"
      + '<div class="intake-desc-b">' + esc(it.description) + "</div></div>"
    : "";
  return '<div class="intake-panel" id="intakePanel">' + items.map(intakeRowHtml).join("") + warn + itinHtml + desc + "</div>";
}
/* 全部读完后：有 AI 就整理，没 AI 就原样回填（并如实说明） */
async function intakeComposeDescription(merged) {
  const needKey = !aiAuthMode();
  if (needKey || !merged) return { description: intakeFallbackDescription(merged), usedAI: false };
  let out = null;
  try {
    out = await clubLLM({ system: INTAKE_SYSTEM, user: merged, json: false, temperature: 0.2 });
  } catch (e) { out = null; }
  if (!out || typeof out !== "string" || out.trim().length < 8) {
    return { description: intakeFallbackDescription(merged), usedAI: false };
  }
  return { description: intakeCleanText(out).slice(0, 2000), usedAI: true };
}
/* 主入口：files → state._intake + 回填「活动描述」+ （AI 可用时）自动进生成流程 */
async function intakeRunFiles(files) {
  const split = intakeSplitFiles(files);
  const it = intakeState();
  it.items = split.bad.map(function (x) { return { name: x.name, kind: x.kind, note: x.reason, ok: false }; });
  it.description = ""; it.warn = ""; it.busy = true; it.busyText = "正在读取方案…";
  if (state.view === "create") showView("create");
  const texts = [];
  for (let i = 0; i < split.ok.length; i++) {
    const f = split.ok[i];
    it.busyText = "正在读取《" + f.name + "》…（" + (i + 1) + "/" + split.ok.length + "）";
    if (state.view === "create") showView("create");
    let r;
    try { r = await intakeExtractOne(f.file, f.kind); } catch (e) { r = { error: "解析出错了" }; }
    if (r && r.text) {
      texts.push({ name: f.name, text: r.text });
      it.items.push({ name: f.name, kind: f.kind, ok: true, note: "已读出 " + r.text.length + " 字" });
    } else {
      it.items.push({ name: f.name, kind: f.kind, ok: false, note: (r && r.error) || "读取失败" });
    }
  }
  const merged = intakeMergeTexts(texts);
  const comp = await intakeComposeDescription(merged);
  /* v205：结构化事实（集合地点/时间/价格/日期/人数/天数/路线）——确认卡「按你上传的方案」预填的来源 */
  it.planText = merged;   /* v207：全量方案原文随行，供旧草稿自愈回填行程 */
  it.fields = intakeParseFields(merged);
  /* v206：按天行程直接抽成结构化数组（行程页的原材料，不再只靠描述文本传递） */
  it.itinerary = intakeParseItinerary(merged);
  if (it.itinerary.length) {
    const n = it.itinerary.reduce(function (s, d) { return s + (d.items || []).length; }, 0);
    it.fields.itineraryNote = it.itinerary.length + " 天 " + n + " 条";
  }
  it.busy = false; it.busyText = "";
  it.description = comp.description || "";
  if (texts.length && !comp.usedAI) {
    const unreachable = split.ok.some(function (f) { return f.kind === "image"; });
    it.warn = aiAuthMode()
      ? "AI 整理没成功，已把原文直接填进描述（未做任何改写）"
      : (unreachable
        ? "未配置 AI：图片海报只能读出需要视觉 AI，已把能读到的文字原样填进描述"
        : "未配置 AI：已把原文原样填进描述，没有做任何整理");
  } else if (!texts.length) {
    /* 每份文件的具体原因已经写在各自那一行（红字），这里只给一句中性结论；
       不再给「换一种格式试试」这种可能不对症的笼统建议（比如其实是没配视觉 AI）。 */
    it.warn = "没有读到可用内容，具体原因见上面每一份文件后面的说明";
  } else if (comp.usedAI) {
    it.warn = "";
  }
  /* 回填「活动描述」——直接写 DOM，避免整页重渲时被 state 覆盖 */
  if (state.view === "create") {
    const ta = $("#createInput");
    if (ta && it.description) ta.value = it.description;
    if (state.draft && it.description) state.draft.raw = it.description;
  }
  saveState();
  if (state.view === "create") showView("create");
  const ta2 = $("#createInput");
  if (ta2 && it.description) ta2.value = it.description;
  /* 用户要的是「传进去就自动生成」：AI 可用且确实读到了内容 → 直接进生成流程 */
  if (it.description && aiAuthMode()) {
    it._fresh = true; /* v205：刚传完方案 → 接下来这次生成允许消费结构化字段（一次性，防串场） */
    toast("方案已整理成活动描述，正在生成活动…");
    if (typeof generateFromInput === "function") generateFromInput();
  } else if (it.description) {
    toast("方案已填进活动描述，配置 AI 后可一键生成活动");
  }
  return it;
}
if (typeof window !== "undefined") {
  window.intakeRunFiles = intakeRunFiles;
  window.intakeKindOf = intakeKindOf;
}
