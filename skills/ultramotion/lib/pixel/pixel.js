/* pixel.js — pixel art on a small grid, scaled up crisp, every colour snapped to a palette.
   You draw on the grid (e.g. 320×180) with draw(g, t); the library snaps the grid to the palette and
   blows it up to the video size with hard pixel edges. Every frame is a pure function of t: seek anywhere.

   window.__scene = Pixel.scene(async () => ({
     width: 1920, height: 1080,           // the video
     grid: [320, 180],                     // the pixels you draw on (width / grid should be a whole number)
     duration: 12,
     fps: 30,                              // how often the picture changes (8–12 for a stepped, hand-animated feel)
     palette: 'pico8',                     // a name from Pixel.PALETTES or ['#hex', …]; null = no snapping
     dither: 0,                            // 0..1 ordered dither when snapping (turns smooth fills into patterns)
     look: { scan: 0, grid: 0 },           // the screen: scanlines between pixel rows, gaps between pixels (LCD)
     draw(g, t) { … },                     // g: the 2D context of the grid; t is already stepped to fps
     sounds, music,                        // music.chip for chiptune (chip.py), music.notes for sampled instruments
   }));
*/
(function () {
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => cl((t - a) / (b - a));
const sm = u => u * u * (3 - 2 * u);
const io = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const oc = u => 1 - Math.pow(1 - u, 3);
const hash = (...a) => { let h = 2166136261; for (const x of a) { h ^= Math.floor(x * 9973) + 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; } return (h >>> 0) / 4294967296; };
function rng(seed = 1) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const R = Math.round;
const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => cl(R(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mix = (a, b, u) => hex(rgb(a).map((v, i) => lerp(v, rgb(b)[i], u)));
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };

/* ---------- palettes ---------- */
const P8 = s => s.trim().split(/\s+/).map(x => '#' + x);
const PALETTES = {
  pico8: P8('000000 1d2b53 7e2553 008751 ab5236 5f574f c2c3c7 fff1e8 ff004d ffa300 ffec27 00e436 29adff 83769c ff77a8 ffccaa'),
  sweetie16: P8('1a1c2c 5d275d b13e53 ef7d57 ffcd75 a7f070 38b764 257179 29366f 3b5dc9 41a6f6 73eff7 f4f4f4 94b0c2 566c86 333c57'),
  gameboy: P8('0f380f 306230 8bac0f 9bbc0f'),
  pocket: P8('1f1f1f 4d533c 8b956d c4cfa1'),
  c64: P8('000000 ffffff 880000 aaffee cc44cc 00cc55 0000aa eeee77 dd8855 664400 ff7777 333333 777777 aaff66 0088ff bbbbbb'),
  nes: P8(`7c7c7c 0000fc 0000bc 4428bc 940084 a80020 a81000 881400 503000 007800 006800 005800 004058 000000
           bcbcbc 0078f8 0058f8 6844fc d800cc e40058 f83800 e45c10 ac7c00 00b800 00a800 00a844 008888
           f8f8f8 3cbcfc 6888fc 9878f8 f878f8 f85898 f87858 fca044 f8b800 b8f818 58d854 58f898 00e8d8 787878
           fcfcfc a4e4fc b8b8f8 d8b8f8 f8b8f8 f8a4c0 f0d0b0 fce0a8 f8d878 d8f878 b8f8b8 b8f8d8 00fcfc f8d8f8`),
  cga: P8('000000 55ffff ff55ff ffffff'),
};
const palOf = p => !p ? null : typeof p === 'string' ? PALETTES[p] : p;

/* nearest palette colour for every 5-bit rgb: 32768 entries, built once per palette */
const LUTS = new Map();
function lut(pal) {
  const key = pal.join(); if (LUTS.has(key)) return LUTS.get(key);
  const P = pal.map(rgb), L = new Uint8Array(32768);
  for (let r = 0; r < 32; r++) for (let g = 0; g < 32; g++) for (let b = 0; b < 32; b++) {
    const R0 = r * 8.226, G0 = g * 8.226, B0 = b * 8.226; let best = 0, bd = 1e18;
    for (let i = 0; i < P.length; i++) { const rm = (R0 + P[i][0]) / 2, dr = R0 - P[i][0], dg = G0 - P[i][1], db = B0 - P[i][2];
      const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db; if (d < bd) { bd = d; best = i; } }
    L[r << 10 | g << 5 | b] = best;
  }
  const out = { P, L }; LUTS.set(key, out); return out;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16 - .5);
/* snap an ImageData to a palette in place; dither 0..1 = ordered dither strength */
function snap(id, pal, dither = 0, x0 = 0, y0 = 0) {
  const { P, L } = lut(pal), d = id.data, w = id.width, amp = dither * 72;
  for (let i = 0, n = d.length / 4; i < n; i++) {
    const j = i * 4, x = i % w, y = (i / w) | 0, o = amp ? BAYER[((y + y0) & 3) * 4 + ((x + x0) & 3)] * amp : 0;
    const r = cl(d[j] + o, 0, 255) >> 3, g = cl(d[j + 1] + o, 0, 255) >> 3, b = cl(d[j + 2] + o, 0, 255) >> 3, c = P[L[r << 10 | g << 5 | b]];
    d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
  }
  return id;
}
/* the k colours that best cover an image (median cut) */
function paletteFrom(src, k = 8) {
  const c = canvas(64, 64), x = c.getContext('2d'); x.drawImage(src, 0, 0, 64, 64);
  const d = x.getImageData(0, 0, 64, 64).data, px = []; for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
  let boxes = [px];
  while (boxes.length < k) {
    let bi = -1, bs = -1, ch = 0;
    boxes.forEach((b, i) => { if (b.length < 2) return; for (let a = 0; a < 3; a++) { let lo = 255, hi = 0; for (const p of b) { lo = Math.min(lo, p[a]); hi = Math.max(hi, p[a]); } if ((hi - lo) * Math.sqrt(b.length) > bs) { bs = (hi - lo) * Math.sqrt(b.length); bi = i; ch = a; } } });
    if (bi < 0) break;
    const b = boxes[bi].sort((p, q) => p[ch] - q[ch]), m = b.length >> 1; boxes.splice(bi, 1, b.slice(0, m), b.slice(m));
  }
  return boxes.map(b => hex([0, 1, 2].map(a => b.reduce((s, p) => s + p[a], 0) / b.length))).sort((a, b) => rgb(a).reduce((s, v) => s + v) - rgb(b).reduce((s, v) => s + v));
}

/* ---------- drawing on the grid: whole pixels only ---------- */
const fill = (g, col) => { if (col) g.fillStyle = col; };
const rect = (g, x, y, w, h, col) => { fill(g, col); g.fillRect(R(x), R(y), R(w), R(h)); };
const px = (g, x, y, col) => { fill(g, col); g.fillRect(R(x), R(y), 1, 1); };
function line(g, x0, y0, x1, y1, col) {
  fill(g, col); x0 = R(x0); y0 = R(y0); x1 = R(x1); y1 = R(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function circle(g, cx, cy, r, col, solid = true) {
  fill(g, col); cx = R(cx); cy = R(cy); r = Math.max(0, R(r));
  for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt((r + .5) * (r + .5) - y * y));
    if (solid) g.fillRect(cx - w, cy + y, 2 * w + 1, 1);
    else { const wn = Math.abs(y) < r ? Math.floor(Math.sqrt(Math.max(0, (r - .5) * (r - .5) - y * y))) : -1; g.fillRect(cx - w, cy + y, w - wn, 1); g.fillRect(cx + wn + 1, cy + y, w - wn, 1); } }
}
/* any canvas path, filled with hard edges: Pixel.shape(g, '#f00', c => { c.beginPath(); c.arc(…); c.fill(); }) */
let MASK = null;
function shape(g, col, fn) {
  const W = g.canvas.width, H = g.canvas.height;
  if (!MASK || MASK.width !== W || MASK.height !== H) MASK = canvas(W, H);
  const m = MASK.getContext('2d', { willReadFrequently: true }); m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, W, H); m.fillStyle = m.strokeStyle = '#fff'; m.save(); fn(m); m.restore();
  const id = m.getImageData(0, 0, W, H), d = id.data, [r, gg, b] = rgb(col);
  for (let i = 0; i < d.length; i += 4) { const on = d[i + 3] >= 128; d[i] = r; d[i + 1] = gg; d[i + 2] = b; d[i + 3] = on ? 255 : 0; }
  m.putImageData(id, 0, 0); g.drawImage(MASK, 0, 0);
}
/* a pattern of b over a: level 0 = all a, 1 = all b, in between an ordered dither */
function dither(g, x, y, w, h, a, b, level) {
  x = R(x); y = R(y); w = R(w); h = R(h); if (a) rect(g, x, y, w, h, a); fill(g, b);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (BAYER[((y + j) & 3) * 4 + ((x + i) & 3)] + .5 < level) g.fillRect(x + i, y + j, 1, 1);
}
/* bands of colours with dithered steps between them; dir 'v' (top→bottom) or 'h' */
function gradient(g, x, y, w, h, cols, dir = 'v') {
  x = R(x); y = R(y); w = R(w); h = R(h); const n = dir === 'v' ? h : w, k = cols.length - 1;
  for (let s = 0; s < n; s++) { const u = s / Math.max(1, n - 1) * k, i = Math.min(k - 1, Math.floor(u)), f = u - i;
    for (let o = 0; o < (dir === 'v' ? w : h); o++) { const xx = dir === 'v' ? x + o : x + s, yy = dir === 'v' ? y + s : y + o;
      g.fillStyle = k === 0 ? cols[0] : (BAYER[(yy & 3) * 4 + (xx & 3)] + .5 < f ? cols[i + 1] : cols[i]); g.fillRect(xx, yy, 1, 1); } }
}

/* ---------- sprites ---------- */
/* rows of characters → a sprite; map { char: '#hex' }; '.' and ' ' are clear. Several frames: sprite([rows, rows…], map) */
function sprite(rows, map) {
  if (Array.isArray(rows[0])) { const fr = rows.map(r => sprite(r, map)); fr.frames = fr; return fr; }
  const h = rows.length, w = Math.max(...rows.map(r => r.length)), c = canvas(w, h), x = c.getContext('2d');
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (map[ch]) { x.fillStyle = map[ch]; x.fillRect(i, j, 1, 1); } }));
  return c;
}
/* draw a sprite at whole pixels; flip mirrors it; scale is a whole number */
function put(g, spr, x, y, { flip = false, flipY = false, scale = 1, anchor = 'tl' } = {}) {
  const w = spr.width * scale, h = spr.height * scale; let X = R(x), Y = R(y);
  if (anchor === 'c' || anchor === 'bc') X -= Math.floor(w / 2); if (anchor === 'c') Y -= Math.floor(h / 2); if (anchor === 'bc' || anchor === 'bl') Y -= h;
  g.save(); g.imageSmoothingEnabled = false; g.translate(X + (flip ? w : 0), Y + (flipY ? h : 0)); g.scale(flip ? -1 : 1, flipY ? -1 : 1); g.drawImage(spr, 0, 0, w, h); g.restore();
}
/* which frame of a cycle shows at t: frames advance at fps */
const anim = (frames, t, fps = 8) => frames[Math.floor(t * fps + 1e-6) % frames.length];
/* the same sprite with a 1-px outline around it */
function outline(spr, col, diag = false) {
  const w = spr.width + 2, h = spr.height + 2, c = canvas(w, h), x = c.getContext('2d'), m = colorize(spr, col);
  const off = diag ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] : [[0, -1], [-1, 0], [1, 0], [0, 1]];
  off.forEach(([dx, dy]) => x.drawImage(m, 1 + dx, 1 + dy)); x.drawImage(spr, 1, 1); return c;
}
function colorize(src, col) { const c = canvas(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; }

/* ---------- type ---------- */
/* 5×7 (+1 row for descenders): classic column bitmaps, ASCII 32–126 (bit 0 = top row) */
const F5 = [0,0,0,0,0, 0,0,95,0,0, 0,7,0,7,0, 20,127,20,127,20, 36,42,127,42,18, 35,19,8,100,98, 54,73,85,34,80, 0,5,3,0,0, 0,28,34,65,0, 0,65,34,28,0,
  8,42,28,42,8, 8,8,62,8,8, 0,80,48,0,0, 8,8,8,8,8, 0,96,96,0,0, 32,16,8,4,2, 62,81,73,69,62, 0,66,127,64,0, 66,97,81,73,70, 33,65,69,75,49,
  24,20,18,127,16, 39,69,69,69,57, 60,74,73,73,48, 1,113,9,5,3, 54,73,73,73,54, 6,73,73,41,30, 0,54,54,0,0, 0,86,54,0,0, 0,8,20,34,65, 20,20,20,20,20,
  65,34,20,8,0, 2,1,81,9,6, 50,73,121,65,62, 126,17,17,17,126, 127,73,73,73,54, 62,65,65,65,34, 127,65,65,34,28, 127,73,73,73,65, 127,9,9,1,1, 62,65,65,81,50,
  127,8,8,8,127, 0,65,127,65,0, 32,64,65,63,1, 127,8,20,34,65, 127,64,64,64,64, 127,2,4,2,127, 127,4,8,16,127, 62,65,65,65,62, 127,9,9,9,6, 62,65,81,33,94,
  127,9,25,41,70, 70,73,73,73,49, 1,1,127,1,1, 63,64,64,64,63, 31,32,64,32,31, 127,32,24,32,127, 99,20,8,20,99, 3,4,120,4,3, 97,81,73,69,67, 0,0,127,65,65,
  2,4,8,16,32, 65,65,127,0,0, 4,2,1,2,4, 64,64,64,64,64, 0,1,2,4,0, 32,84,84,84,120, 127,72,68,68,56, 56,68,68,68,32, 56,68,68,72,127, 56,84,84,84,24,
  8,126,9,1,2, 24,164,164,164,120, 127,8,4,4,120, 0,68,125,64,0, 64,128,132,125,0, 0,127,16,40,68, 0,65,127,64,0, 124,4,24,4,120, 124,8,4,4,120, 56,68,68,68,56,
  252,36,36,36,24, 24,36,36,36,252, 124,8,4,4,8, 72,84,84,84,32, 4,63,68,64,32, 60,64,64,32,124, 28,32,64,32,28, 60,64,48,64,60, 68,40,16,40,68, 28,160,160,160,124,
  68,100,84,76,68, 0,8,54,65,0, 0,0,127,0,0, 0,65,54,8,0, 8,4,8,16,8];
/* 3×5: capitals, digits, a few marks (rows, left to right) */
const F3 = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011',
  H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101',
  X: '101101010101101', Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', ' ': '000000000000000', '.': '000000000000010', ',': '000000000010100',
  ':': '000010000010000', '-': '000000111000000', '+': '000010111010000', '!': '010010010000010', '?': '110001010000010', '/': '001001010100100', '%': '101001010100101',
  "'": '010010000000000', '(': '010100100100010', ')': '010001001001010', '#': '101111101111101', '$': '011110010011110', '&': '010101010101011', '*': '000101010101000',
  '=': '000111000111000', '·': '000000010000000', '−': '000000111000000', '★': '010111010101000', '<': '001010100010001', '>': '100010001010100', '×': '000101010101000', '♥': '000101111111010', '@': '010101111100011', '_': '000000000000111' };
const X5 = { '·': [0,0,8,0,0], '•': [0,28,28,28,0], '♥': [6,15,30,15,6], '…': [64,0,64,0,64], '×': [34,20,8,20,34], '°': [0,6,9,6,0], '→': [8,8,42,28,8], '←': [8,28,42,8,8],
  '↑': [4,2,127,2,4], '↓': [16,32,127,32,16], '—': [8,8,8,8,8], '–': [8,8,8,8,8], '−': [8,8,8,8,8], '¥': [21,22,124,22,21], '€': [20,62,85,85,65], '£': [72,126,73,65,34], '’': [0,5,3,0,0], '‘': [0,3,5,0,0], '“': [3,5,0,3,5], '”': [5,3,0,5,3], '★': [72,58,15,58,72], '♪': [32,112,112,63,2] };
const BITMAPS = { '5x7': { w: 5, h: 8, glyph: ch => { const i = ch.charCodeAt(0) - 32, cols = X5[ch] || (i < 0 || i > 94 ? null : F5.slice(i * 5, i * 5 + 5)); return cols ? (x, y) => cols[x] >> y & 1 : null; } },
  '3x5': { w: 3, h: 5, glyph: ch => { const s = F3[ch.toUpperCase()]; return s ? (x, y) => s[y * 3 + x] === '1' : null; } } };
const MASKS = new Map();
/* a white, hard-edged mask of one line of text */
function textMask(str, font, scale, spacing, thr) {
  const key = [str, font, scale, spacing, thr].join('|'); if (MASKS.has(key)) return MASKS.get(key);
  let c;
  const bm = BITMAPS[font];
  if (bm) {
    const chars = [...str], adv = bm.w + (spacing ?? 1); c = canvas(Math.max(1, chars.length * adv - (spacing ?? 1)) * scale, bm.h * scale); const x = c.getContext('2d'); x.fillStyle = '#fff';
    chars.forEach((ch, k) => { const f = bm.glyph(ch) || bm.glyph('?'); if (!f) return; for (let j = 0; j < bm.h; j++) for (let i = 0; i < bm.w; i++) if (f(i, j)) x.fillRect((k * adv + i) * scale, j * scale, scale, scale); });
    c.base = bm.h * scale;
  } else {
    const m = canvas(8, 8).getContext('2d'); m.font = font; const size = parseFloat(font.match(/(\d+(\.\d+)?)px/)?.[1] || 12);
    const chars = [...str], sp = spacing ?? 0, ws = chars.map(ch => m.measureText(ch).width);
    const w = Math.ceil(ws.reduce((a, b) => a + b, 0) + sp * Math.max(0, chars.length - 1)) + 2, h = Math.ceil(size * 1.4) + 2;
    const t = canvas(w, h), x = t.getContext('2d', { willReadFrequently: true }); x.font = font; x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    let cx = 1; chars.forEach((ch, k) => { x.fillText(ch, R(cx), R(size * 1.05)); cx += ws[k] + sp; });
    const id = x.getImageData(0, 0, w, h), d = id.data; let y0 = h, y1 = 0, x1 = 0;
    for (let i = 0; i < d.length; i += 4) { const on = d[i + 3] >= thr * 255; d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = on ? 255 : 0; if (on) { const p = i / 4, yy = (p / w) | 0; y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); x1 = Math.max(x1, p % w); } }
    x.putImageData(id, 0, 0);
    const top = R(size * 1.05 - size * .9), bot = R(size * 1.05 + size * .25);               // a steady box for the line: cap height + descenders
    c = canvas(Math.max(1, Math.max(x1, R(cx - sp)) + 1) * scale, (bot - top) * scale); const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
    cc.drawImage(t, 0, top, c.width / scale, bot - top, 0, 0, c.width, c.height); c.base = R(size * .9) * scale;
  }
  MASKS.set(key, c); if (MASKS.size > 400) MASKS.delete(MASKS.keys().next().value); return c;
}
/* Pixel.text(g, 'HELLO', x, y, { font: '5x7' | '3x5' | '700 16px "PingFang SC"', scale, color, align, outline, shadow, spacing, lead, thr })
   bitmap fonts for Latin; any installed font for everything else (rasterised with hard edges — use 12px and up for Chinese).
   y is the top of the line. Returns { w, h }. */
function text(g, str, x, y, o = {}) {
  const font = o.font || '5x7', scale = o.scale || 1, thr = o.thr ?? .5, lines = String(str).split('\n');
  const masks = lines.map(l => textMask(l, font, scale, o.spacing, thr)), lh = masks[0].height, lead = o.lead ?? (BITMAPS[font] ? 2 * scale : R(lh * .25));
  const W = Math.max(...masks.map(m => m.width)), Ht = masks.length * lh + (masks.length - 1) * lead;
  if (g) masks.forEach((m, i) => {
    const al = o.align || 'left'; let X = R(x) - (al === 'center' ? Math.floor(m.width / 2) : al === 'right' ? m.width : 0), Y = R(y) + i * (lh + lead);
    if (o.valign === 'middle') Y -= Math.floor(Ht / 2); if (o.valign === 'bottom') Y -= Ht;
    if (o.shadow) { const s = typeof o.shadow === 'string' ? { color: o.shadow, dx: 1, dy: 1 } : o.shadow, sc = colorize(m, s.color);
      if (o.outline) [[0, -1], [-1, 0], [1, 0], [0, 1]].forEach(([a, b]) => g.drawImage(sc, X + a + (s.dx ?? 1), Y + b + (s.dy ?? 1))); g.drawImage(sc, X + (s.dx ?? 1), Y + (s.dy ?? 1)); }
    if (o.outline) { const oc2 = colorize(m, o.outline), d8 = o.outlineDiag ? [[-1, -1], [1, -1], [-1, 1], [1, 1]] : []; [[0, -1], [-1, 0], [1, 0], [0, 1], ...d8].forEach(([a, b]) => g.drawImage(oc2, X + a, Y + b)); }
    g.drawImage(colorize(m, o.color || '#fff'), X, Y);
  });
  return { w: W, h: Ht };
}
const measure = (str, o = {}) => text(null, str, 0, 0, o);
/* the first n characters at time t, n growing at cps from t0 (Chinese counts per character) */
const typed = (str, t, t0, cps = 20) => [...str].slice(0, Math.max(0, Math.floor((t - t0) * cps + 1e-6))).join('');
/* a box of text typed out, RPG style: Pixel.textbox(g, { x, y, w, h, text, t, t0, cps, font, color, bg, border, pad, arrow }) */
function textbox(g, o) {
  const { x, y, w, h } = o, pad = o.pad ?? 6, b = o.border || '#fff';
  rect(g, x, y, w, h, o.bg || '#000'); rect(g, x + 1, y + 1, w - 2, 1, b); rect(g, x + 1, y + h - 2, w - 2, 1, b); rect(g, x + 1, y + 1, 1, h - 2, b); rect(g, x + w - 2, y + 1, 1, h - 2, b);
  const shown = o.t0 == null ? o.text : typed(o.text, o.t, o.t0, o.cps ?? 20);
  text(g, shown, x + pad, y + pad, { font: o.font, color: o.color || '#fff', lead: o.lead, scale: o.scale, spacing: o.spacing });
  const done = o.t0 == null || [...shown].length >= [...o.text].length;
  if (o.arrow && done && Math.floor(o.t * 3) % 2 === 0) { const ax = x + w - pad - 5, ay = y + h - pad - 3; rect(g, ax, ay, 5, 1, b); rect(g, ax + 1, ay + 1, 3, 1, b); rect(g, ax + 2, ay + 2, 1, 1, b); }
  return done;
}

/* ---------- photos and footage ---------- */
const image = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('cannot load ' + src)); im.src = src; });
/* draw an image to fill a box, cropped (cover); fx/fy pick the part kept, zoom pushes in */
function cover(c, im, { x = 0, y = 0, w, h, fx = .5, fy = .5, zoom = 1 } = {}) {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = Math.max(w / iw, h / ih) * zoom, sw = w / k, sh = h / k;
  c.drawImage(im, (iw - sw) * fx, (ih - sh) * fy, sw, sh, x, y, w, h);
}
/* a photo (or a video frame) turned into pixel art: w×h pixels, palette = a name, ['#hex'…] or a number of colours taken from the photo.
   dither 'ordered' | 'fs' (error diffusion, stills only) | 0; contrast / saturation / brightness around 1 / 1 / 0. Returns a canvas to drawImage onto the grid. */
function photo(src, o = {}) {
  const w = o.w, h = o.h, big = canvas(w * 4, h * 4), bx = big.getContext('2d'); bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
  cover(bx, src, { x: 0, y: 0, w: w * 4, h: h * 4, fx: o.fx ?? .5, fy: o.fy ?? .5, zoom: o.zoom ?? 1 });
  const c = canvas(w, h), x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(big, 0, 0, w, h);
  const id = x.getImageData(0, 0, w, h), d = id.data, con = o.contrast ?? 1.1, sat = o.saturation ?? 1.15, bri = (o.brightness ?? 0) * 255;
  for (let i = 0; i < d.length; i += 4) { const l = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2];
    for (let k = 0; k < 3; k++) d[i + k] = cl((l + (d[i + k] - l) * sat - 128) * con + 128 + bri, 0, 255); }
  let pal = typeof o.palette === 'number' ? (src.__pal?.[o.palette] || ((src.__pal = src.__pal || {})[o.palette] = paletteFrom(src, o.palette))) : palOf(o.palette);
  if (pal) {
    const dm = o.dither ?? 'ordered';
    if (dm === 'fs') {
      const { P, L } = lut(pal), f = Float32Array.from(d), str = o.strength ?? .8;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const j = (yy * w + xx) * 4, c0 = [0, 1, 2].map(k => cl(f[j + k], 0, 255)), q = P[L[(c0[0] >> 3) << 10 | (c0[1] >> 3) << 5 | c0[2] >> 3]];
        for (let k = 0; k < 3; k++) { const e = (c0[k] - q[k]) * str; d[j + k] = q[k];
          if (xx + 1 < w) f[j + 4 + k] += e * 7 / 16; if (yy + 1 < h) { if (xx > 0) f[j + w * 4 - 4 + k] += e * 3 / 16; f[j + w * 4 + k] += e * 5 / 16; if (xx + 1 < w) f[j + w * 4 + 4 + k] += e / 16; } }
        d[j + 3] = 255; }
    } else snap(id, pal, dm ? (o.strength ?? .6) : 0);
  }
  x.putImageData(id, 0, 0); c.palette = pal; return c;
}
/* a video split into frames by render.py (render.py frames clip.mp4); frame(t) → image, draw(g, t, photoOptions) → pixelated onto the grid */
function footage(src) {
  const dir = src + '.frames';
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = dir + '/index.js';
    s.onerror = () => rej(new Error(`no frames for ${src} — run: python3 render.py frames ${src}`));
    s.onload = () => {
      const info = window.__frames[dir], cache = new Map();
      const get = i => { i = Math.max(0, Math.min(info.count - 1, i)); if (!cache.has(i)) { cache.set(i, image(`${dir}/${String(i + 1).padStart(5, '0')}.jpg`)); if (cache.size > 60) cache.delete(cache.keys().next().value); } return cache.get(i); };
      res({ ...info, duration: info.count / info.fps, frame: t => get(Math.floor(t * info.fps + 1e-6)),
        draw: async (g, t, o = {}) => { const im = await get(Math.floor(t * info.fps + 1e-6)); const p = photo(im, { w: o.w || g.canvas.width, h: o.h || g.canvas.height, ...o }); g.drawImage(p, R(o.x || 0), R(o.y || 0)); } });
    };
    document.head.appendChild(s);
  });
}

/* ---------- whole-grid effects (call at the end of draw) ---------- */
/* blocks of n×n pixels, each one colour — the SNES mosaic; box limits it */
function mosaic(g, n, box) {
  n = Math.max(1, R(n)); if (n <= 1) return;
  const b = box || { x: 0, y: 0, w: g.canvas.width, h: g.canvas.height }, id = g.getImageData(b.x, b.y, b.w, b.h), d = id.data, w = b.w, h = b.h;
  for (let y = 0; y < h; y += n) for (let x = 0; x < w; x += n) { const cx = Math.min(w - 1, x + (n >> 1)), cy = Math.min(h - 1, y + (n >> 1)), s = (cy * w + cx) * 4;
    for (let yy = y; yy < Math.min(h, y + n); yy++) for (let xx = x; xx < Math.min(w, x + n); xx++) { const j = (yy * w + xx) * 4; d[j] = d[s]; d[j + 1] = d[s + 1]; d[j + 2] = d[s + 2]; } }
  g.putImageData(id, b.x, b.y);
}
/* fade toward a colour in a few hard steps (the console way): u 0..1, steps 3–4 */
function fade(g, u, col = '#000', steps = 4) {
  const k = Math.floor(cl(u) * steps + 1e-6) / steps; if (k <= 0) return;
  g.save(); g.globalAlpha = k; g.fillStyle = col; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore();
}
/* everything outside a circle filled — the level-end iris; r shrinks to 0 to close */
function iris(g, cx, cy, r, col = '#000') {
  const W = g.canvas.width, H = g.canvas.height; fill(g, col); cx = R(cx); cy = R(cy); r = Math.max(0, R(r));
  for (let y = 0; y < H; y++) { const dy = y - cy, w = Math.abs(dy) <= r ? Math.floor(Math.sqrt((r + .5) * (r + .5) - dy * dy)) : -1;
    if (w < 0) g.fillRect(0, y, W, 1); else { g.fillRect(0, y, Math.max(0, cx - w), 1); g.fillRect(cx + w + 1, y, W, 1); } }
}
/* a screen-covering wipe (or over box {x,y,w,h}), u 0..1: 'tiles' (diamonds grow), 'dissolve' (pixels in random order), 'blinds' (rows), 'bars' (columns), 'left' / 'right' / 'down' / 'up' in blocks */
function wipe(g, kind, u, col = '#000', { size = 16, seed = 1, box } = {}) {
  u = cl(u); if (u <= 0) return;
  if (box) { g.save(); g.beginPath(); g.rect(box.x, box.y, box.w, box.h); g.clip(); g.translate(box.x, box.y); wipeIn(g, kind, u, col, size, seed, box.w, box.h); g.restore(); }
  else wipeIn(g, kind, u, col, size, seed, g.canvas.width, g.canvas.height);
}
function wipeIn(g, kind, u, col, size, seed, W, H) {
  fill(g, col);
  if (u >= 1) { g.fillRect(0, 0, W, H); return; }
  if (kind === 'tiles') { for (let ty = 0; ty < H; ty += size) for (let tx = 0; tx < W; tx += size) { const lag = (tx / W + ty / H) / 2 * .5, v = cl((u - lag) / .5), r = Math.floor(v * size * .75);
      for (let y = 0; y < size; y++) { const half = r - Math.abs(y - size / 2 + .5); if (half > 0) g.fillRect(tx + Math.floor(size / 2 - half), ty + y, Math.ceil(half * 2), 1); } } }
  else if (kind === 'dissolve') { const b = Math.max(1, size >> 3); for (let y = 0; y < H; y += b) for (let x = 0; x < W; x += b) if (hash(x, y, seed) < u) g.fillRect(x, y, b, b); }
  else if (kind === 'blinds') { for (let y = 0; y < H; y += size) g.fillRect(0, y, W, Math.ceil(u * size)); }
  else if (kind === 'bars') { for (let x = 0; x < W; x += size) g.fillRect(x, 0, Math.ceil(u * size), H); }
  else { const n = Math.ceil((kind === 'left' || kind === 'right' ? W : H) / size), k = Math.floor(u * n + 1e-6);
    if (kind === 'right') g.fillRect(0, 0, k * size, H); if (kind === 'left') g.fillRect(W - k * size, 0, k * size, H);
    if (kind === 'down') g.fillRect(0, 0, W, k * size); if (kind === 'up') g.fillRect(0, H - k * size, W, k * size); }
}

/* ---------- timing on a stepped clock ---------- */
const step = (t, fps) => Math.floor(t * fps + 1e-6) / fps;
const blink = (t, rate = 2, duty = .5) => (t * rate) % 1 < duty;
/* a jump: whole-pixel height at t for a hop of height h starting at t0, lasting dur */
const hop = (t, t0, dur = .4, h = 8) => { const u = (t - t0) / dur; return u <= 0 || u >= 1 ? 0 : -R(4 * h * u * (1 - u)); };
/* move from a to b in whole pixels over [t0, t1] with an ease; e = 'linear' | 'out' | 'inout' */
const glide = (t, t0, t1, a, b, e = 'out') => { const u = seg(t, t0, t1); return R(lerp(a, b, e === 'linear' ? u : e === 'inout' ? io(u) : oc(u))); };
/* a number counting up in whole steps */
const count = (t, t0, dur, from, to) => R(lerp(from, to, seg(t, t0, t0 + dur)));
/* shake: whole-pixel offset that decays over d seconds */
const shake = (t, t0, d = .3, amt = 2) => { const u = (t - t0) / d; if (u < 0 || u > 1) return [0, 0]; const k = Math.floor(t * 30), a = amt * (1 - u); return [R((hash(k, 1) * 2 - 1) * a), R((hash(k, 2) * 2 - 1) * a)]; };

/* ---------- sound helpers ---------- */
/* one blip per typed character (spaces and punctuation stay silent) */
function typeSounds(str, t0, cps = 20, o = {}) {
  const out = []; [...str].forEach((ch, i) => { if (/[\s，。、！？,.!?…:：;；"“”'‘’()（）\-—]/.test(ch) || i % (o.every || 1)) return; out.push({ t: t0 + i / cps, kind: o.kind || 'text', v: o.v ?? .5, pitch: o.pitch ?? 0 }); }); return out;
}
/* chiptune note builders: music.chip = [...] of { t, m, d, ch: 'pulse' | 'pulse2' | 'tri' | 'noise', v, duty, env, vib, slide } */
const chip = {
  note: (t, m, d, ch = 'pulse', v = .7, o = {}) => ({ t, m, d, ch, v, ...o }),
  /* a chord played as a fast arpeggio on one channel — the console way to sound a chord */
  arp: (t, chord, d, ch = 'pulse2', v = .45, rate = 24, o = {}) => { const out = []; for (let k = 0; k * (1 / rate) < d - 1e-6; k++) out.push({ t: t + k / rate, m: chord[k % chord.length], d: 1 / rate, ch, v, env: 'hold', ...o }); return out; },
  /* a drum pattern on the noise channel: pattern 'k.h.s.h.' over steps of 1/16 at bpm; k kick, s snare, h hat, o open hat */
  drums: (t0, pattern, bpm, bars = 1, v = .6) => { const out = [], st = 60 / bpm / 4, p = pattern.replace(/\s/g, ''), K = { k: 'kick', s: 'snare', h: 'hat', o: 'openhat' };
    for (let b = 0; b < bars; b++) [...p].forEach((c, i) => { if (K[c]) out.push({ t: t0 + (b * p.length + i) * st, ch: 'noise', kind: K[c], v: c === 'h' ? v * .6 : v }); }); return out; },
};

/* ---------- the scene ---------- */
function scene(build) {
  const sc = { duration: 0, sounds: [], music: null, warnings: [], pixelated: true };
  sc.ready = (async () => {
    const r = await build();
    const W = r.width || 1920, H = r.height || 1080;
    let [gw, gh] = r.grid || [R(W / (r.scale || 6)), R(H / (r.scale || 6))];
    const s = Math.max(1, Math.min(Math.floor(W / gw), Math.floor(H / gh)));
    if (W % gw || H % gh || W / gw !== H / gh) sc.warnings.push(`grid ${gw}×${gh} does not divide ${W}×${H} evenly — pixels are ${s} px with a border; pick a grid that divides the video exactly`);
    const out = document.querySelector('canvas') || document.body.appendChild(document.createElement('canvas')); out.width = W; out.height = H;
    const ox = Math.floor((W - gw * s) / 2), oy = Math.floor((H - gh * s) / 2);
    const low = canvas(gw, gh), g = low.getContext('2d', { willReadFrequently: true }), o = out.getContext('2d');
    const pal = palOf(r.palette), bg = r.background || (pal ? pal[0] : '#000'), fps = r.fps || 30, L = Object.assign({ scan: 0, grid: 0 }, r.look || {});
    // the screen, the same every frame: scanlines under each pixel row, gaps between pixels
    let screen = null;
    if ((L.scan || L.grid) && s >= 3) {
      screen = canvas(W, H); const x = screen.getContext('2d'), gap = Math.max(1, R(s / 6));
      if (L.scan) { x.fillStyle = `rgba(0,0,0,${L.scan})`; for (let y = oy + s - gap; y < oy + gh * s; y += s) x.fillRect(ox, y, gw * s, gap); }
      if (L.grid) { x.fillStyle = `rgba(0,0,0,${L.grid})`; for (let y = oy; y < oy + gh * s; y += s) x.fillRect(ox, y, gw * s, 1); for (let xx = ox; xx < ox + gw * s; xx += s) x.fillRect(xx, oy, 1, gh * s); }
    }
    sc.draw = async t => {
      const ts = step(Math.max(0, t), fps);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false; g.fillStyle = bg; g.fillRect(0, 0, gw, gh);
      g.save(); await r.draw(g, ts, t); g.restore();
      if (pal) { const id = g.getImageData(0, 0, gw, gh); snap(id, pal, r.dither || 0); g.putImageData(id, 0, 0); }
      o.fillStyle = r.border || bg; o.fillRect(0, 0, W, H); o.imageSmoothingEnabled = false; o.drawImage(low, ox, oy, gw * s, gh * s);
      if (screen) o.drawImage(screen, 0, 0);
    };
    sc.seek = t => sc.draw(t);
    sc.grid = [gw, gh]; sc.duration = r.duration; sc.sounds = r.sounds || []; sc.music = r.music || null;
    sc.timeline = (r.timeline || []).map(e => ({ t0: e.t, t1: e.t1 ?? e.t, kind: e.kind || '', text: e.note || '' }));
    return true;
  })();
  if (!/rec=1/.test(location.search)) sc.ready.then(() => {
    const t0 = performance.now(); let busy = false;
    const loop = async () => { if (!busy) { busy = true; await sc.draw(((performance.now() - t0) / 1000) % sc.duration); busy = false; } requestAnimationFrame(loop); };
    loop();
  });
  return sc;
}
/* ---------- figures: a person built from parts, posed by its joints, shaded in three tones ----------
   figure(pose, look, { w, h, scale, light, ink }) → a canvas, outlined. scale draws the same pose larger at the same pixel size (more detail, not bigger pixels).
   pose — points in a w×h box (default 40×40), facing right: head, neck, hip, and far / near (far = away from the camera),
          each { sh, el, ha, kn, ft } (shoulder, elbow, hand, knee, foot), [x, y]. Optional: tilt (head, radians), gaze ('fwd' | 'up' | 'down' | 'shut').
   look — skin, top, bottom, shoes, hair: a colour or [light, mid, dark]; top / bottom null → skin there; gloves (a colour) draws boxing gloves;
          band (headband colour); short: true → shorts (bottom stops above the knee); sleeves: true → the top covers the arms.
   tween(a, b, u) blends two poses (or any nested numbers) — in-between frames. */
function tones(c) { return Array.isArray(c) ? c : [mix(c, '#ffffff', .28), c, mix(c, '#000000', .38)]; }
function figure(pose, look, o = {}) {
  const k = o.scale || 1, W = R((o.w || 40) * k), H = R((o.h || 40) * k), [lx, ly] = o.light || [1, -1], ink = o.ink || '#0a0812';
  const buf = new Uint8ClampedArray(W * H * 4), at = (x, y) => (y * W + x) * 4, on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && buf[at(x, y) + 3];
  const put1 = (x, y, col) => { const [r, g, b] = rgb(col), i = at(x, y); buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255; };
  const mk = canvas(W, H), mx = mk.getContext('2d', { willReadFrequently: true });
  // one part: draw its mask, shade it (lit edge toward the light, shadow edge away from it), a dark line where it overlaps what's behind
  function part(fn, col, { far = false, line = true, deep = 1 } = {}) {
    mx.clearRect(0, 0, W, H); shape(mx, '#fff', c => { c.scale(k, k); fn(c); }); const d = mx.getImageData(0, 0, W, H).data, M = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0;
    let [hi, mid, lo] = tones(col); if (far) [hi, mid, lo] = [mid, lo, mix(lo, ink, .35)]; deep = Math.max(1, R(deep * k));
    const ring = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!M(x, y)) { if (line && on(x, y) && (M(x + 1, y) || M(x - 1, y) || M(x, y + 1) || M(x, y - 1))) ring.push([x, y]); continue; }
      let c = mid; for (let k = 1; k <= deep; k++) if (!M(x - lx * k, y - ly * k)) { c = lo; break; }
      if (c === mid && !M(x + lx, y + ly)) c = hi;
      put1(x, y, c);
    }
    for (const [x, y] of ring) put1(x, y, mix(lo, ink, .55));
  }
  const limb = (pts, w) => c => { c.lineWidth = w; c.lineCap = c.lineJoin = 'round'; c.beginPath(); c.moveTo(...pts[0]); pts.slice(1).forEach(p => c.lineTo(...p)); c.stroke(); };
  const mid2 = (a, b, u = .5) => [lerp(a[0], b[0], u), lerp(a[1], b[1], u)];
  const skin = look.skin || '#f0b080', top = look.top || skin, bot = look.bottom || skin, shoes = look.shoes || '#22202c';
  const leg = (s, far) => { const L = pose[s]; const thighEnd = look.short ? mid2(pose.hip, L.kn, .7) : L.kn;
    part(limb([pose.hip, L.kn, L.ft], 4), look.short ? skin : bot, { far });
    if (look.short) part(limb([pose.hip, thighEnd], 5), bot, { far, line: false });
    part(c => { c.beginPath(); c.moveTo(L.ft[0] - 2, L.ft[1] - 1); c.lineTo(L.ft[0] + 3, L.ft[1] - 1); c.lineTo(L.ft[0] + 3, L.ft[1] + 1.5); c.lineTo(L.ft[0] - 2, L.ft[1] + 1.5); c.fill(); }, shoes, { far }); };
  const arm = (s, far) => { const A = pose[s];
    part(limb([A.sh, A.el], 3.4), look.sleeves ? top : skin, { far }); part(limb([A.el, A.ha], 3), look.sleeves ? top : skin, { far });
    if (look.gloves) part(c => { c.beginPath(); c.arc(A.ha[0], A.ha[1], 3.1, 0, 7); c.fill(); }, look.gloves, { far });
    else part(c => { c.beginPath(); c.arc(A.ha[0], A.ha[1], 1.6, 0, 7); c.fill(); }, skin, { far }); };
  // back to front
  leg('far', true); arm('far', true);
  const F = pose.far.sh, N = pose.near.sh, hp = pose.hip;
  part(c => { c.beginPath(); c.moveTo(F[0] - 2, F[1] - 1); c.lineTo(N[0] + 1.5, N[1] - 1); c.lineTo(N[0] + 2, N[1] + 3); c.lineTo(hp[0] + 3.5, hp[1]); c.lineTo(hp[0] - 3.5, hp[1]); c.lineTo(F[0] - 2, F[1] + 3); c.fill(); }, top, { deep: 2, line: false });
  part(c => { c.beginPath(); c.moveTo(hp[0] - 4, hp[1] - 2); c.lineTo(hp[0] + 4, hp[1] - 2); c.lineTo(hp[0] + 4.5, hp[1] + 3); c.lineTo(hp[0] - 4.5, hp[1] + 3); c.fill(); }, bot, { line: false });
  if (look.belt) part(c => c.fillRect(hp[0] - 4, hp[1] - 2, 9, 1), look.belt, { line: false });
  leg('near', false);
  // head: the neck, the skull, hair at the back and on top, the eye on the front
  const h = pose.head, tl = pose.tilt || 0;
  part(limb([pose.neck, h], 3), skin, { line: false });
  part(c => { c.beginPath(); c.arc(h[0], h[1], 4.3, 0, 7); c.fill(); }, skin, { line: false });
  if (look.hair) part(c => { c.beginPath(); c.arc(h[0], h[1], 4.6, Math.PI * .62 + tl, Math.PI * 1.85 + tl); c.lineTo(h[0] - .5, h[1] - .5); c.fill(); }, look.hair, { line: false });
  if (look.band) part(c => { c.save(); c.translate(...h); c.rotate(tl); c.fillRect(-4.6, -1.5, 9, 1.6); c.restore(); }, look.band, { line: false });
  const ex = R((h[0] + 2.2 * Math.cos(tl)) * k), ey = R((h[1] + 2.2 * Math.sin(tl) + (pose.gaze === 'up' ? -1 : pose.gaze === 'down' ? 1 : 0) + .4) * k), es = Math.max(1, R(k * .75));
  if (pose.gaze === 'shut') for (let i = -es; i < es; i++) put1(ex + i, ey, ink); else for (let i = 0; i < es; i++) for (let j = 0; j < es + (k > 1 ? 1 : 0); j++) put1(ex + i, ey + j, ink);
  arm('near', false);
  const c = canvas(W, H); c.getContext('2d').putImageData(new ImageData(buf, W, H), 0, 0);
  return outline(c, ink);
}
/* every colour a look will use, to add to the scene's palette (or the figure gets snapped to other colours) */
const figureColors = (look, ink = '#0a0812') => [...new Set(['skin', 'top', 'bottom', 'shoes', 'hair', 'gloves', 'band', 'belt'].filter(k => look[k]).flatMap(k => { const [a, b, c] = tones(look[k]); return [a, b, c, mix(c, ink, .35), mix(c, ink, .55), mix(mix(c, ink, .35), ink, .55)]; }).concat([ink]))];
const tween = (a, b, u) => Array.isArray(a) ? a.map((v, i) => tween(v, b[i], u)) : (a && typeof a === 'object') ? Object.fromEntries(Object.keys(a).map(k => [k, k in b ? tween(a[k], b[k], u) : a[k]])) : typeof a === 'number' ? lerp(a, b, u) : (u < .5 ? a : b);

const fonts = list => Promise.all(list.map(f => document.fonts.load(f).catch(() => null)));

window.Pixel = { scene, PALETTES, palOf, lut, snap, paletteFrom, rect, px, line, circle, shape, dither, gradient, sprite, put, anim, outline, colorize,
  text, measure, typed, textbox, image, cover, photo, footage, mosaic, fade, iris, wipe, step, blink, hop, glide, count, shake, typeSounds, chip, fonts,
  figure, figureColors, tween, tones, cl, lerp, seg, sm, io, oc, hash, rng, rgb, hex, mix, canvas };
})();
