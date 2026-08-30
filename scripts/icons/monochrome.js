'use strict';
/*
 * The monochrome (themed) icon needs a legible SHAPE, not the alpha silhouette:
 * flattening the art gives a blob with a ragged edge, because the drop shadow is
 * neither background nor mark.
 *
 * So the mask is built from colour instead:
 *   - keep only saturated pixels  -> drops the grey shadow and the light ground
 *   - knock out light detail      -> the text rules and clock hands read as holes
 * Android tints whatever alpha we hand it, so the result must survive as a
 * silhouette with interior cut-outs.
 */
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const lib = require(path.join(__dirname, 'png.js'));
const { readPNG, writePNG, resample, blank, place } = lib;

const SRC = process.argv[2], A = process.argv[3];
const img = readPNG(SRC);
const { w, h } = img;

const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// pass 1: saturated pixels only — the blue sheets and the red clock
const solid = new Float64Array(w * h);
for (let i = 0; i < w * h; i++) {
  const r = img.px[i * 4], g = img.px[i * 4 + 1], b = img.px[i * 4 + 2];
  const s = sat(r, g, b);
  solid[i] = Math.max(0, Math.min(1, (s - 0.18) / 0.06));
}

// The drop shadow carries just enough saturation to survive the threshold as a
// stray wedge. Keep only components big enough to be real, so the silhouette is
// the mark and nothing else — this also stops a speck inflating the scale.
{
  const seen = new Uint8Array(w * h);
  const keep = new Uint8Array(w * h);
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || solid[start] < 0.5) continue;
    const comp = [];
    const st = [start];
    seen[start] = 1;
    while (st.length) {
      const p = st.pop();
      comp.push(p);
      const x = p % w, y = (p - x) / w;
      const push = (q) => { if (!seen[q] && solid[q] >= 0.5) { seen[q] = 1; st.push(q); } };
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (y > 0) push(p - w);
      if (y < h - 1) push(p + w);
    }
    if (comp.length > w * h * 0.01) for (const p of comp) keep[p] = 1;
  }
  for (let i = 0; i < w * h; i++) if (!keep[i]) solid[i] = 0;
}

// pass 2: inside that shape, light detail becomes a hole
const hole = new Float64Array(w * h);
for (let i = 0; i < w * h; i++) {
  if (solid[i] < 0.5) continue;
  const r = img.px[i * 4], g = img.px[i * 4 + 1], b = img.px[i * 4 + 2];
  const L = lum(r, g, b);
  hole[i] = Math.max(0, Math.min(1, (L - 150) / 24));
}
// white clock hands are unsaturated, so they never entered `solid` — recover them
// as holes wherever they are enclosed by the mark
const enclosed = new Uint8Array(w * h);
const stack = [];
for (let x = 0; x < w; x++) { stack.push(x, (h - 1) * w + x); }
for (let y = 0; y < h; y++) { stack.push(y * w, y * w + w - 1); }
const outside = new Uint8Array(w * h);
while (stack.length) {
  const p = stack.pop();
  if (outside[p] || solid[p] >= 0.5) continue;
  outside[p] = 1;
  const x = p % w, y = (p - x) / w;
  if (x > 0) stack.push(p - 1);
  if (x < w - 1) stack.push(p + 1);
  if (y > 0) stack.push(p - w);
  if (y < h - 1) stack.push(p + w);
}
for (let i = 0; i < w * h; i++) if (!outside[i] && solid[i] < 0.5) enclosed[i] = 1;

const mono = Buffer.alloc(w * h * 4);
for (let i = 0; i < w * h; i++) {
  let a = solid[i] >= 0.5 || enclosed[i] ? 1 : solid[i];
  if (hole[i] > 0) a = Math.min(a, 1 - hole[i]);
  if (enclosed[i]) a = 0;            // hands and rules punch through
  mono[i * 4] = 255; mono[i * 4 + 1] = 255; mono[i * 4 + 2] = 255;
  mono[i * 4 + 3] = Math.round(a * 255);
}

// scale to the same safe zone as the foreground
let maxR = 0; const cx = w / 2, cy = h / 2;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (mono[(y * w + x) * 4 + 3] > 12) { const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (r > maxR) maxR = r; }
}
const S = 1024, scale = 0.60 / (maxR / (w / 2));
writePNG(`${A}/android-icon-monochrome.png`, S, S, place(blank(S, S, [0, 0, 0], 0), S, S, mono, w, h, scale), true);
console.log('monochrome rebuilt, scale x' + scale.toFixed(3));
