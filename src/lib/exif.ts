// @ts-nocheck
// 写真から撮影日時・撮影場所・機種を読む（03_試作/04 で iPhone・Android の実機で確かめた部品）
const __root: any = {};
// 写真のファイルから、撮影日時・撮影場所・機種を読む（JPEG と HEIC）。外部の部品は使わない。
// 返す形：{ format, date, lat, lon, model, note }。読めなかったものは null。
(function (root) {
  function ascii(dv, off, len) {
    let s = "";
    for (let i = 0; i < len && off + i < dv.byteLength; i++) {
      const c = dv.getUint8(off + i);
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  // TIFF（Exif の中身）を読む。start は TIFF の先頭
  function readTiff(dv, start) {
    const out = { date: null, lat: null, lon: null, model: null };
    const order = ascii(dv, start, 2);
    if (order !== "II" && order !== "MM") return out;
    const le = order === "II";
    const u16 = (o) => dv.getUint16(start + o, le);
    const u32 = (o) => dv.getUint32(start + o, le);
    const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

    function entries(ifd) {
      const res = {};
      if (ifd <= 0 || start + ifd + 2 > dv.byteLength) return res;
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (start + e + 12 > dv.byteLength) break;
        const tag = u16(e), type = u16(e + 2), count = u32(e + 4);
        const bytes = (SIZE[type] || 1) * count;
        const at = bytes <= 4 ? e + 8 : u32(e + 8);
        res[tag] = { type, count, at };
      }
      return res;
    }
    function str(ent) { return ent ? ascii(dv, start + ent.at, ent.count) : null; }
    function rationals(ent) {
      if (!ent) return null;
      const v = [];
      for (let i = 0; i < ent.count; i++) {
        const num = u32(ent.at + i * 8), den = u32(ent.at + i * 8 + 4);
        v.push(den ? num / den : 0);
      }
      return v;
    }

    const ifd0 = entries(u32(4));
    out.model = str(ifd0[0x0110]);
    let date = str(ifd0[0x0132]);
    if (ifd0[0x8769]) {
      const ex = entries(u32(ifd0[0x8769].at));
      date = str(ex[0x9003]) || date;
    }
    out.date = date || null;
    if (ifd0[0x8825]) {
      const g = entries(u32(ifd0[0x8825].at));
      const la = rationals(g[2]), lo = rationals(g[4]);
      if (la && lo && la.length === 3 && lo.length === 3) {
        let lat = la[0] + la[1] / 60 + la[2] / 3600;
        let lon = lo[0] + lo[1] / 60 + lo[2] / 3600;
        if (str(g[1]) === "S") lat = -lat;
        if (str(g[3]) === "W") lon = -lon;
        if (lat !== 0 || lon !== 0) { out.lat = lat; out.lon = lon; }
      }
    }
    return out;
  }

  function readJpeg(dv) {
    let p = 2;
    while (p + 4 <= dv.byteLength) {
      if (dv.getUint8(p) !== 0xff) return null;
      const marker = dv.getUint8(p + 1);
      const size = dv.getUint16(p + 2);
      if (marker === 0xe1 && ascii(dv, p + 4, 4) === "Exif") return readTiff(dv, p + 10);
      if (marker === 0xda) return null; // 画像の本体まで来た
      p += 2 + size;
    }
    return null;
  }

  // HEIC（ISOBMFF）の中から Exif の場所を探す
  function readHeic(dv) {
    function boxes(from, to) {
      const list = [];
      let p = from;
      while (p + 8 <= to) {
        let size = dv.getUint32(p);
        const type = ascii(dv, p + 4, 4);
        let head = 8;
        if (size === 1) { size = Number(dv.getBigUint64(p + 8)); head = 16; }
        if (size === 0) size = to - p;
        if (size < head || p + size > to) break;
        list.push({ type, start: p, body: p + head, end: p + size });
        p += size;
      }
      return list;
    }
    const meta = boxes(0, dv.byteLength).find((b) => b.type === "meta");
    if (!meta) return null;
    const inner = boxes(meta.body + 4, meta.end);
    const iinf = inner.find((b) => b.type === "iinf");
    const iloc = inner.find((b) => b.type === "iloc");
    const idat = inner.find((b) => b.type === "idat");
    if (!iinf || !iloc) return null;

    // Exif の item ID
    const iv = dv.getUint8(iinf.body);
    const cnt = iv === 0 ? dv.getUint16(iinf.body + 4) : dv.getUint32(iinf.body + 4);
    let exifId = null;
    for (const b of boxes(iinf.body + 4 + (iv === 0 ? 2 : 4), iinf.end)) {
      if (b.type !== "infe") continue;
      const v = dv.getUint8(b.body);
      if (v < 2) continue;
      const id = v === 2 ? dv.getUint16(b.body + 4) : dv.getUint32(b.body + 4);
      const typeAt = b.body + 4 + (v === 2 ? 2 : 4) + 2;
      if (ascii(dv, typeAt, 4) === "Exif") { exifId = id; break; }
    }
    if (exifId === null || cnt === 0) return null;

    // その item がファイルのどこにあるか
    const v = dv.getUint8(iloc.body);
    let p = iloc.body + 4;
    const b1 = dv.getUint8(p), b2 = dv.getUint8(p + 1);
    const offSize = b1 >> 4, lenSize = b1 & 15, baseSize = b2 >> 4, idxSize = (v === 1 || v === 2) ? b2 & 15 : 0;
    p += 2;
    const readN = (n) => {
      let x = 0;
      for (let i = 0; i < n; i++) x = x * 256 + dv.getUint8(p + i);
      p += n;
      return x;
    };
    const items = v < 2 ? readN(2) : readN(4);
    for (let i = 0; i < items; i++) {
      const id = v < 2 ? readN(2) : readN(4);
      const method = (v === 1 || v === 2) ? readN(2) & 15 : 0;
      readN(2); // data_reference_index
      const base = readN(baseSize);
      const extents = readN(2);
      let first = null;
      for (let e = 0; e < extents; e++) {
        if (idxSize) readN(idxSize);
        const off = readN(offSize), len = readN(lenSize);
        if (first === null) first = { off, len };
      }
      if (id === exifId && first) {
        let at = base + first.off;
        if (method === 1 && idat) at += idat.body;
        const skip = dv.getUint32(at); // TIFF までのずれ
        return readTiff(dv, at + 4 + skip);
      }
    }
    return null;
  }

  function readPhotoInfo(buffer) {
    const dv = new DataView(buffer);
    const empty = { date: null, lat: null, lon: null, model: null };
    if (dv.byteLength > 3 && dv.getUint16(0) === 0xffd8) {
      return Object.assign({ format: "JPEG" }, empty, readJpeg(dv) || {});
    }
    if (dv.byteLength > 12 && ascii(dv, 4, 4) === "ftyp") {
      const brand = ascii(dv, 8, 4);
      const fmt = /hei|hev|mif|msf/.test(brand) ? "HEIC" : "ISOBMFF(" + brand + ")";
      try {
        return Object.assign({ format: fmt }, empty, readHeic(dv) || {});
      } catch (e) {
        return Object.assign({ format: fmt, note: "読み取りで止まった：" + e.message }, empty);
      }
    }
    if (dv.byteLength > 8 && dv.getUint32(0) === 0x89504e47) return Object.assign({ format: "PNG" }, empty);
    return Object.assign({ format: "不明" }, empty);
  }

  root.readPhotoInfo = readPhotoInfo;
  if (typeof module !== "undefined") module.exports = { readPhotoInfo };
})(__root);

export type PhotoInfo = { format: string; date: string | null; lat: number | null; lon: number | null; model: string | null };
export const readPhotoInfo: (buffer: ArrayBuffer) => PhotoInfo = __root.readPhotoInfo;
