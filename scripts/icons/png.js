const fs = require('fs');
const zlib = require('zlib');
'use strict';
/* ---- PNG io ---- */
const CRC = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
  const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
  return Buffer.concat([l, td, c]); };
function writePNG(p, w, h, px, withAlpha) {
  const ch = withAlpha ? 4 : 3;
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4);
  ih[8] = 8; ih[9] = withAlpha ? 6 : 2;
  const stride = w * ch;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4, d = y * (stride + 1) + 1 + x * ch;
      raw[d] = px[s]; raw[d + 1] = px[s + 1]; raw[d + 2] = px[s + 2];
      if (withAlpha) raw[d + 3] = px[s + 3];
    }
  }
  fs.writeFileSync(p, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
function readPNG(path) {
  const buf = fs.readFileSync(path);
  let off = 8, w = 0, h = 0, depth = 8, ctype = 6; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  if (depth !== 8) throw new Error('bit depth ' + depth + ' unsupported');
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, un = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? un[y * stride + x - ch] : 0;
      const b = y > 0 ? un[(y - 1) * stride + x] : 0;
      const c = (x >= ch && y > 0) ? un[(y - 1) * stride + x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      un[y * stride + x] = v & 255;
    }
  }
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, b, a = 255;
    if (ch === 1) { r = g = b = un[i]; }
    else if (ch === 2) { r = g = b = un[i * 2]; a = un[i * 2 + 1]; }
    else if (ch === 3) { r = un[i * 3]; g = un[i * 3 + 1]; b = un[i * 3 + 2]; }
    else { r = un[i * 4]; g = un[i * 4 + 1]; b = un[i * 4 + 2]; a = un[i * 4 + 3]; }
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = a;
  }
  return { w, h, px };
}

/* ---- helpers ---- */
// high-quality box-filter resample of an RGBA buffer
function resample(src, sw, sh, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const xr = sw / dw, yr = sh / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * yr), y1 = Math.max(y0 + 1, Math.floor((y + 1) * yr));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * xr), x1 = Math.max(x0 + 1, Math.floor((x + 1) * xr));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = y0; sy < y1 && sy < sh; sy++) for (let sx = x0; sx < x1 && sx < sw; sx++) {
        const i = (sy * sw + sx) * 4, al = src[i + 3] / 255;
        r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; n++;
      }
      const o = (y * dw + x) * 4;
      if (a > 0.0001) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
      out[o + 3] = Math.round(a / n * 255);
    }
  }
  return out;
}
function blank(w, h, rgb, alpha) {
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { px[i * 4] = rgb[0]; px[i * 4 + 1] = rgb[1]; px[i * 4 + 2] = rgb[2]; px[i * 4 + 3] = alpha; }
  return px;
}
// draw src (RGBA) into dst at scale, centred
function place(dst, dw, dh, src, sw, sh, scale) {
  const tw = Math.round(dw * scale), th = Math.round(dh * scale);
  const r = resample(src, sw, sh, tw, th);
  const ox = Math.round((dw - tw) / 2), oy = Math.round((dh - th) / 2);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const s = (y * tw + x) * 4, d = ((oy + y) * dw + ox + x) * 4;
    if (oy + y < 0 || oy + y >= dh || ox + x < 0 || ox + x >= dw) continue;
    const a = r[s + 3] / 255, ia = 1 - a;
    dst[d] = Math.round(r[s] * a + dst[d] * ia);
    dst[d + 1] = Math.round(r[s + 1] * a + dst[d + 1] * ia);
    dst[d + 2] = Math.round(r[s + 2] * a + dst[d + 2] * ia);
    dst[d + 3] = Math.round(r[s + 3] + dst[d + 3] * ia);
  }
  return dst;
}


module.exports = { readPNG, writePNG, resample, blank, place };
