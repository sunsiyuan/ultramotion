/* Title Sequence — slow film titles: type that fades in and opens up, cards scheduled on the music, vertical Chinese,
   a camera that drifts, fog, light through a window, distant lights, light leaks, film dust, and a film finish
   (grade, grain, halation, vignette). Canvas 2D with a little WebGL2 for fog, rays and the finish. No dependencies.
   Every frame is a pure function of t.

   const S = Title.create({ width: 1920, height: 1080 });
   window.__scene = Title.scene(S, (ctx, t) => { … draw … }, { duration, music, sounds, background });
*/
(function () {
const TAU = Math.PI * 2;
const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
const seg = (t, a, z) => cl((t - a) / (z - a));
const lerp = (a, z, u) => a + (z - a) * u;
const ease = {
  linear: u => cl(u),
  sine: u => .5 - .5 * Math.cos(Math.PI * cl(u)),                                   // in and out, gentle
  io: u => (u = cl(u)) < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,     // in and out, firmer
  out: u => 1 - Math.pow(1 - cl(u), 3),
  expo: u => (u = cl(u)) >= 1 ? 1 : 1 - Math.pow(2, -10 * u),                     // arrives fast, settles long
  linger: u => (1 - Math.exp(-4.5 * cl(u))) / (1 - Math.exp(-4.5)),                 // moves at once, keeps creeping to the end
};
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const rand = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
const noise = (x, seed = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1; };   // smooth, −1..1
const SERIF = '"Baskerville", "Big Caslon", "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const SANS = '"Avenir Next", "Helvetica Neue", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const SONG = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", serif';
const FANG = '"STFangsong", "FangSong", "Songti SC", "Noto Serif CJK SC", serif';
const KAI = '"Kaiti SC", "STKaiti", "KaiTi", serif';

function create(o = {}) {
  const W = o.width || 1920, H = o.height || 1080;
  const cv = o.canvas || document.querySelector('canvas'); cv.width = W; cv.height = H;
  return { W, H, canvas: cv, ctx: cv.getContext('2d', { willReadFrequently: false }) };
}

/* ---------- time ---------- */
/* opacity of something that is on screen from t0 to t1, fading in over fin and out over fout seconds */
function env(t, t0, t1, fin = 1, fout = fin, e = ease.sine) {
  if (t <= t0 || t >= t1) return 0;
  return e(Math.min(fin > 0 ? (t - t0) / fin : 1, fout > 0 ? (t1 - t) / fout : 1, 1));
}
/* a value through keys [[t, v], …]; v a number, an array or an object of numbers; eased between keys */
function key(t, keys, e = ease.sine) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) {
    const [a, va] = keys[i - 1], [b, vb] = keys[i], u = e((t - a) / (b - a));
    if (typeof va === 'number') return lerp(va, vb, u);
    if (Array.isArray(va)) return va.map((x, k) => lerp(x, vb[k], u));
    const o = {}; for (const k in va) o[k] = lerp(va[k], vb[k] ?? va[k], u); return o;
  }
  return keys[keys.length - 1][1];
}
/* length of one bar (or beat) in seconds */
const bar = (bpm, beats = 4) => 60 / bpm * beats;
/* lay a list of cards out in time. Units are bars when bpm is given, seconds otherwise.
   o: { start, bpm, beats, hold, gap, fadeIn, fadeOut }   (fades in seconds)
   each card may set its own hold, gap (before it), at (absolute start), fadeIn, fadeOut.
   → the cards with t0 (fade-in begins), land (fully in), t1 (fully gone), fin, fout, i */
function schedule(cards, o = {}) {
  const unit = o.bpm ? bar(o.bpm, o.beats || 4) : 1;
  let cur = (o.start || 0) * unit;
  return cards.map((c, i) => {
    if (typeof c === 'string') c = { text: c };
    const gap = (c.gap ?? (i ? o.gap ?? 0 : 0)) * unit;
    const t0 = c.at != null ? c.at * unit : cur + gap, hold = (c.hold ?? o.hold ?? 4) * unit;
    const fin = c.fadeIn ?? o.fadeIn ?? 1, fout = c.fadeOut ?? o.fadeOut ?? fin;
    cur = t0 + hold;
    return { ...c, i, t0, t1: t0 + hold, land: t0 + fin, fin, fout, a: t => env(t, t0, t0 + hold, fin, fout) };
  });
}

/* ---------- type ---------- */
const fontOf = o => `${o.italic ? 'italic ' : ''}${o.weight || 400} ${o.size || 32}px ${o.font || SERIF}`;
const LAYOUT = new Map();
/* x of each character (from the left edge) with kerning kept, and the width, at a tracking given in em */
function layout(ctx, str, o) {
  ctx.font = fontOf(o); ctx.letterSpacing = '0px';
  const k = ctx.font + '|' + str; let L = LAYOUT.get(k);
  if (!L) {
    const ch = [...str], xs = [], ws = []; let pre = '';
    for (const c of ch) { xs.push(ctx.measureText(pre).width); ws.push(ctx.measureText(c).width); pre += c; }
    L = { ch, xs, ws, w: ctx.measureText(str).width }; if (LAYOUT.size > 4000) LAYOUT.clear(); LAYOUT.set(k, L);
  }
  const tr = (o.tracking || 0) * (o.size || 32), n = L.ch.length;
  return { ch: L.ch, ws: L.ws, xs: L.xs.map((x, i) => x + i * tr), w: L.w + Math.max(0, n - 1) * tr };
}
/* how far along each character is in a reveal (u 0..1):
   mode 'fade' all at once · 'letters' left to right · 'random' out of order · 'center' from the middle out · 'wipe' a soft edge passing */
function revealAt(r, i, n, pos) {
  if (!r) return 1; if (typeof r === 'number') r = { u: r };
  const u = r.u ?? 1, mode = r.mode || 'letters', sp = r.spread ?? .6, soft = r.soft ?? .25;
  if (mode === 'fade') return ease.sine(u);
  if (mode === 'wipe') return ease.sine((u * (1 + soft) - pos) / soft);
  let order = n > 1 ? i / (n - 1) : 0;
  if (mode === 'random') order = hash(i * 7.31 + (r.seed || 0) * 13.7);
  if (mode === 'center') order = Math.abs(pos - .5) * 2;
  return ease.sine(seg(u, order * sp, order * sp + (1 - sp)));
}
const isSpace = c => /\s/.test(c);
function drawChar(ctx, c, x, y, a, o, k) {
  if (a <= 0.003) return;
  ctx.globalAlpha = a;
  const blur = (o.blur || 0) + (o.reveal && o.reveal.blur ? o.reveal.blur * (1 - k) : 0);
  ctx.filter = blur > .3 ? `blur(${blur.toFixed(2)}px)` : 'none';
  const dy = o.reveal && o.reveal.rise ? o.reveal.rise * (1 - ease.out(k)) : 0;
  ctx.fillText(c, x, y + dy);
}
/* one line of type.
   o: { font, size, weight, italic, color, a, tracking (em), align 'left'|'center'|'right', caps, blur, glow: { color, blur },
        reveal: { u, mode, spread, soft, seed, blur, rise } }
   → { w, x0, x1 } */
function text(ctx, str, x, y, o = {}) {
  if (o.caps) str = str.toUpperCase();
  const L = layout(ctx, str, o), a0 = o.a ?? 1, n = L.ch.length;
  const x0 = x - (o.align === 'center' ? L.w / 2 : o.align === 'right' ? L.w : 0);
  if (a0 <= 0 || !n) return { w: L.w, x0, x1: x0 + L.w };
  ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = o.baseline || 'alphabetic'; ctx.fillStyle = o.color || '#f2eee6';
  if (o.glow) { ctx.shadowColor = o.glow.color || ctx.fillStyle; ctx.shadowBlur = o.glow.blur ?? 18; }
  const base = ctx.globalAlpha;
  L.ch.forEach((c, i) => { if (isSpace(c)) return; const pos = L.w ? (L.xs[i] + L.ws[i] / 2) / L.w : 0, k = revealAt(o.reveal, i, n, pos); drawChar(ctx, c, x0 + L.xs[i], y, base * a0 * k, o, k); });
  ctx.restore();
  return { w: L.w, x0, x1: x0 + L.w };
}
const measure = (ctx, str, o = {}) => layout(ctx, o.caps ? str.toUpperCase() : str, o).w;

/* lines stacked under each other: rows [{ text, size, font, weight, italic, tracking, color, a, caps, gap (px above), reveal }, …]
   o: defaults for every row, plus align and valign ('top' y is the top · 'middle' · 'bottom'). → { h } */
function block(ctx, rows, x, y, o = {}) {
  const R = rows.filter(Boolean).map(r => typeof r === 'string' ? { ...o, text: r } : { ...o, ...r });
  let h = 0; const ys = [];
  R.forEach((r, i) => { const s = r.size || 32; h += i ? (r.gap ?? s * .55) + s * .78 : s * .78; ys.push(h); h += s * .26; });
  const top = o.valign === 'middle' ? y - h / 2 : o.valign === 'bottom' ? y - h : y;
  R.forEach((r, i) => text(ctx, r.text, x, top + ys[i], r));
  return { h, top };
}

/* vertical Chinese: columns from right to left. x is the centre of the first (rightmost) column, y its top.
   cols: a string (one column), or [string | { text, size, font, color, weight, dy (em down), a }, …]
   o: { font, size, weight, color, a, tracking (em between characters), colGap (em between column centres), valign 'top'|'middle'|'bottom', reveal }
   → { w, h } */
const VERT = { '，': '︐', '、': '︑', '。': '︒', '：': '︓', '；': '︔', '！': '︕', '？': '︖', '「': '﹁', '」': '﹂', '『': '﹃', '』': '﹄', '《': '︽', '》': '︾',
  '〈': '︿', '〉': '﹀', '（': '︵', '）': '︶', '【': '︻', '】': '︼', '—': '︱', '…': '︙', '-': '︱', '·': '・' };
function vertical(ctx, cols, x, y, o = {}) {
  const C = (Array.isArray(cols) ? cols : [cols]).map(c => typeof c === 'string' ? { text: c } : c);
  const gapEm = o.colGap ?? 1.9, all = C.reduce((s, c) => s + [...c.text].length, 0);
  let idx = 0, cx = x, maxH = 0;
  const heights = C.map(c => { const s = c.size || o.size || 40, tr = c.tracking ?? o.tracking ?? .15; return [...c.text].length * s * (1 + tr) - s * tr + (c.dy || 0) * s; });
  const H = Math.max(...heights);
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  C.forEach((c, j) => {
    const r = { ...o, ...c }, s = r.size || 40, tr = r.tracking ?? .15, step = s * (1 + tr);
    const top = (o.valign === 'middle' ? y - heights[j] / 2 : o.valign === 'bottom' ? y - heights[j] : o.valign === 'block' ? y - H / 2 : y) + (c.dy || 0) * s;
    ctx.font = fontOf(r); ctx.letterSpacing = '0px'; ctx.fillStyle = r.color || '#f2eee6';
    if (r.glow) { ctx.shadowColor = r.glow.color || ctx.fillStyle; ctx.shadowBlur = r.glow.blur ?? 18; } else ctx.shadowBlur = 0;
    const base = ctx.globalAlpha;
    [...c.text].forEach((ch0, i) => {
      const ch = VERT[ch0] || ch0, k = revealAt(r.reveal, idx, all, (idx + .5) / all); idx++;
      if (!isSpace(ch0)) { drawChar(ctx, ch, cx, top + i * step + s / 2, base * (r.a ?? 1) * k, r, k); ctx.globalAlpha = base; }
    });
    maxH = Math.max(maxH, heights[j]);
    if (j < C.length - 1) cx -= gapEm * Math.max(s, C[j + 1].size || o.size || 40);
  });
  ctx.restore();
  return { w: x - cx + (o.size || 40), h: maxH };
}

/* ---------- camera ---------- */
/* everything drawn after this moves: x, y in px, z scale, r degrees, around (cx, cy) (default: the centre). Wrap in save/restore. */
function camera(ctx, { x = 0, y = 0, z = 1, r = 0, cx = ctx.canvas.width / 2, cy = ctx.canvas.height / 2 } = {}) {
  ctx.translate(cx + x, cy + y); if (r) ctx.rotate(r * Math.PI / 180); ctx.scale(z, z); ctx.translate(-cx, -cy);
}
/* gate weave: a tiny, slow, smooth drift of the whole picture. → { x, y } in px */
function weave(t, amt = 1) { return { x: noise(t * .6, 3) * amt, y: noise(t * .5, 9) * amt * 1.3 }; }

/* ---------- light and air ---------- */
/* a soft round light */
function glow(ctx, x, y, r, color = '#ffd9a0', a = 1, mode = 'lighter') {
  if (a <= 0 || r <= 0) return; ctx.save(); ctx.globalCompositeOperation = mode; ctx.globalAlpha *= a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(.25, rgba(color, .45)); g.addColorStop(.6, rgba(color, .1)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.restore();
}
function rgba(c, a) {
  if (c.startsWith('#')) { const h = c.length === 4 ? c.slice(1).split('').map(x => x + x).join('') : c.slice(1, 7); return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`; }
  const m = c.match(/[\d.]+/g); return m ? `rgba(${m[0]},${m[1]},${m[2]},${a * (m[3] ?? 1)})` : c;
}
const rgb = c => { const h = c.replace('#', ''); const f = h.length === 3 ? h.split('').map(x => x + x).join('') : h; return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16) / 255); };

/* out-of-focus lights (street lamps, windows across the river, candles): discs with a soft edge and a faint rim.
   o: { n, seed, box: [x, y, w, h], colors, size: [min, max], a, drift (px/s), focus (0 sharp points .. 1 fully soft), breathe } */
function bokeh(ctx, t, o = {}) {
  const r = rand(o.seed ?? 1), [bx, by, bw, bh] = o.box || [0, 0, ctx.canvas.width, ctx.canvas.height];
  const cols = o.colors || ['#ffcf8a', '#ffb36b', '#fff1d6'], [s0, s1] = o.size || [20, 90], foc = o.focus ?? 1, dr = o.drift ?? 4;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < (o.n ?? 30); i++) {
    const x = bx + r() * bw + noise(t * .07 + i, i) * dr * 3 + t * dr * (r() - .5), y = by + r() * bh + noise(t * .05 + i, i + 9) * dr * 2, col = cols[Math.floor(r() * cols.length)];
    const sz = lerp(s0, s1, Math.pow(r(), 1.6)), rad = lerp(1.5, sz, foc), br = (o.a ?? .5) * (.55 + .45 * r()) * (1 + (o.breathe ?? .15) * noise(t * .2 + i * 3.1, i)) * lerp(3, 1, foc) * Math.min(1, 24 / Math.max(rad, 1)) ** .35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, rgba(col, br * .55)); g.addColorStop(.78, rgba(col, br * .62)); g.addColorStop(.9, rgba(col, br * .75 * foc + br * .5 * (1 - foc))); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
/* specks floating in the air: dust in a sunbeam, snow, ash, pollen. Pure function of t.
   o: { n, seed, box, size: [min, max], color, a, fall (px/s, + down), wind (px/s), sway (px), twinkle (0..1), depth (0..1 share out of focus), light: (x, y) => 0..1 } */
function motes(ctx, t, o = {}) {
  const r = rand(o.seed ?? 7), [bx, by, bw, bh] = o.box || [0, 0, ctx.canvas.width, ctx.canvas.height];
  const [s0, s1] = o.size || [1, 3], col = o.color || '#fff4dc', fall = o.fall ?? 6, wind = o.wind ?? 3, sway = o.sway ?? 14, tw = o.twinkle ?? .25, depth = o.depth ?? .25;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < (o.n ?? 120); i++) {
    const z = r() < depth ? 1 : 0, sp = .5 + r(), ph = r() * 100;
    let x = bx + ((r() * bw + (wind * sp * t) + noise(t * .1 + ph, i) * sway) % bw + bw) % bw;
    let y = by + ((r() * bh + (fall * sp * t) + noise(t * .08 + ph, i + 3) * sway * .7) % bh + bh) % bh;
    const lit = o.light ? o.light(x, y) : 1; if (lit <= .01) { r(); r(); continue; }
    const s = lerp(s0, s1, r()) * (z ? 3.2 : 1), k = (1 - tw) + tw * (.5 + .5 * Math.sin(t * (.3 + .6 * r()) + ph));
    const a = (o.a ?? .8) * lit * k * (z ? .25 : 1);
    if (z) { const g = ctx.createRadialGradient(x, y, 0, x, y, s * 2); g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0)); ctx.fillStyle = g; ctx.fillRect(x - s * 2, y - s * 2, s * 4, s * 4); }
    else { ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.arc(x, y, s / 2, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}
/* a light leak: big warm blooms that wander in from an edge, swell and fade, the way light gets into a film camera.
   o: { seed, colors, a, side 'left'|'right'|'top'|'bottom'|'any', speed, size (fraction of the frame) } */
function leak(ctx, t, o = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height, r = rand(o.seed ?? 3), cols = o.colors || ['#ff6a2b', '#ffb347', '#ff3d2e'], sp = o.speed ?? .08, A = o.a ?? .5, side = o.side || 'left';
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) {
    const ph = r() * 50, s = (o.size ?? .7) * Math.max(W, H) * (.6 + .6 * r()), along = .5 + .45 * noise(t * sp + ph, i), off = .12 * noise(t * sp * .7 + ph, i + 4);
    const [x, y] = side === 'left' ? [W * off, H * along] : side === 'right' ? [W * (1 - off), H * along] : side === 'top' ? [W * along, H * off] : side === 'bottom' ? [W * along, H * (1 - off)] : [W * along, H * (.5 + .45 * noise(t * sp + ph, i + 8))];
    const k = A * Math.max(0, .55 + .65 * noise(t * sp * 1.6 + ph * 2, i + 2)), c = cols[i % cols.length];
    const g = ctx.createRadialGradient(x, y, 0, x, y, s); g.addColorStop(0, rgba(c, k)); g.addColorStop(.4, rgba(c, k * .45)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
/* a thin horizontal flare (anamorphic): a bright core and a long soft line, at (x, y) */
function streak(ctx, x, y, o = {}) {
  const W = ctx.canvas.width, len = o.len ?? W * .9, col = o.color || '#9fd2ff', a = o.a ?? .8, th = o.thick ?? 3; if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(x - len / 2, 0, x + len / 2, 0); g.addColorStop(0, rgba(col, 0)); g.addColorStop(.5, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.filter = `blur(${th}px)`; ctx.fillRect(x - len / 2, y - th * 1.5, len, th * 3); ctx.filter = 'none';
  ctx.fillRect(x - len / 4, y - th * .3, len / 2, th * .6); ctx.restore();
  glow(ctx, x, y, (o.core ?? 60), col, a * .8);
}
/* film dirt: specks, a hair now and then, a faint scratch; new every film frame. o: { amount 0..1, seed, fps, color } */
function dust(ctx, t, o = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height, f = Math.floor(t * (o.fps ?? 24)), r = rand(f * 31 + (o.seed ?? 0)), amt = o.amount ?? .5;
  ctx.save(); ctx.fillStyle = ctx.strokeStyle = o.color || 'rgba(255,250,240,.55)';
  const n = Math.floor(r() * 6 * amt + (r() < amt ? 1 : 0));
  for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, s = .6 + r() * 2.4 * (W / 1920); ctx.globalAlpha = .3 + .5 * r(); ctx.beginPath(); ctx.ellipse(x, y, s, s * (.5 + r()), r() * 3, 0, TAU); ctx.fill(); }
  if (r() < .06 * amt) { const x = r() * W, y = r() * H, L = 20 + r() * 50; ctx.globalAlpha = .35; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + r() * L - L / 2, y + r() * L, x + r() * L, y + r() * L - L / 2, x + r() * L - L / 2, y + L * r()); ctx.stroke(); }
  const sx = W * (.2 + .6 * noise(t * .05, 11) * .5 + .3); if (amt > .3 && noise(t * .4, 21) > .55) { ctx.globalAlpha = .12; ctx.fillRect(sx, 0, 1.2, H); }
  ctx.restore();
}

/* ---------- WebGL helpers (fog, rays, finish) ---------- */
let G = null;
function gl() {
  if (G) return G;
  const c = document.createElement('canvas'), g = c.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  if (!g) throw new Error('WebGL2 is not available');
  G = { c, g, progs: new Map(), tex: g.createTexture() };
  return G;
}
const VS = '#version 300 es\nvoid main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0,1);}';
const NOISE = `float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+1.),f.x),f.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*vn(p);p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(3.1,7.7);a*=.5;}return s;}`;
function prog(fs) {
  const { g, progs } = gl(); if (progs.has(fs)) return progs.get(fs);
  const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)); return s; };
  const p = g.createProgram(); g.attachShader(p, sh(g.VERTEX_SHADER, VS)); g.attachShader(p, sh(g.FRAGMENT_SHADER, fs)); g.linkProgram(p);
  const U = {}; const n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = g.getActiveUniform(p, i); U[u.name.replace(/\[0\]$/, '')] = { loc: g.getUniformLocation(p, u.name), type: u.type, size: u.size }; }
  const P = { p, U }; progs.set(fs, P); return P;
}
function run(fs, w, h, uni, src) {
  const { c, g, tex } = gl(); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const P = prog(fs); g.viewport(0, 0, w, h); g.useProgram(P.p);
  if (src) { g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tex); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src);
    g.generateMipmap(g.TEXTURE_2D); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE); }
  for (const k in uni) { const u = P.U[k]; if (!u) continue; const v = uni[k];
    if (u.type === g.FLOAT) u.size > 1 ? g.uniform1fv(u.loc, v) : g.uniform1f(u.loc, v);
    else if (u.type === g.FLOAT_VEC2) g.uniform2fv(u.loc, v); else if (u.type === g.FLOAT_VEC3) g.uniform3fv(u.loc, v); else if (u.type === g.FLOAT_VEC4) g.uniform4fv(u.loc, v);
    else if (u.type === g.INT || u.type === g.SAMPLER_2D) g.uniform1i(u.loc, v); }
  g.drawArrays(g.TRIANGLES, 0, 3); return c;
}

const FOG_FS = `#version 300 es
precision highp float; uniform vec2 res,full,drift; uniform float time,density,scale,seed,low,a,rise; uniform vec3 top,bottom,fog;
uniform int nl; uniform vec4 L[8]; uniform vec3 LC[8]; out vec4 o; ${NOISE}
void main(){ vec2 px=gl_FragCoord.xy/res*full; px.y=full.y-px.y; vec2 p=px/scale+seed;
  vec2 q=vec2(fbm(p+drift*time*.6),fbm(p+vec2(5.2,1.3)-drift.yx*time*.4));
  float f=fbm(p+1.7*q+drift*time+vec2(0.,-rise*time)); float y=px.y/full.y;
  float d=clamp(smoothstep(.25,.85,f)*density*mix(1.,smoothstep(.1,1.,y)*1.4,low),0.,1.);
  vec3 c=mix(mix(top,bottom,y),fog,d);
  for(int i=0;i<8;i++){ if(i>=nl) break; float r=length(px-L[i].xy)/L[i].z; c+=LC[i]*L[i].w*(exp(-r*r*3.)*(.25+1.3*d)+exp(-r*9.)*.6); }
  o=vec4(c,a);}`;
/* drifting fog or haze as the ground (or over it with a < 1). Lights glow through it.
   o: { top, bottom (colours of the air behind), fog (colour of the fog), density 0..1, scale (px per puff), drift [x, y] (puffs per s), rise,
        low (0..1 thicker near the bottom), lights: [{ x, y, r, color, a }], seed, a, quality (render scale, .5) } */
function fog(ctx, t, o = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height, q = o.quality ?? .5, Ls = (o.lights || []).slice(0, 8);
  const L = new Float32Array(32), LC = new Float32Array(24);
  Ls.forEach((l, i) => { L.set([l.x, l.y, l.r || 200, l.a ?? 1], i * 4); LC.set(rgb(l.color || '#ffcf8a'), i * 3); });
  const c = run(FOG_FS, Math.round(W * q), Math.round(H * q), { res: [Math.round(W * q), Math.round(H * q)], full: [W, H], time: t, density: o.density ?? .7, scale: o.scale ?? 520, seed: o.seed ?? 1.3,
    drift: o.drift || [.03, .006], rise: o.rise ?? 0, low: o.low ?? .3, a: 1, top: rgb(o.top || '#0b0f14'), bottom: rgb(o.bottom || o.top || '#141a20'), fog: rgb(o.fog || '#6f7d88'), nl: Ls.length, L, LC });
  ctx.save(); ctx.globalAlpha *= o.a ?? 1; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(c, 0, 0, W, H); ctx.restore();
}
const RAYS_FS = `#version 300 es
precision highp float; uniform vec2 res,full,src; uniform float time,ang,spread,len,seed,a,streaks,end; uniform vec3 col; out vec4 o; ${NOISE}
void main(){ vec2 px=gl_FragCoord.xy/res*full; px.y=full.y-px.y; vec2 d=px-src; float r=length(d); float th=atan(d.y,d.x);
  float da=atan(sin(th-ang),cos(th-ang)); float m=1.-smoothstep(spread*.55,spread,abs(da));
  float s=fbm(vec2(da/spread*streaks+seed,time*.06+seed))*1.2+fbm(vec2(da/spread*streaks*3.3,time*.11))*.5;
  float fall=exp(-r/len)*smoothstep(0.,len*.08,r); float e=end>0.?1.-smoothstep(end*.95,end*1.02,r):1.; float I=m*pow(s,2.2)*fall*a*e;
  o=vec4(col*I,1.);}`;
/* shafts of light from a source (a window, a door, a gap in the clouds), drawn additively. A source far outside the frame gives near-parallel beams.
   o: { x, y (source, px), angle (deg, direction of the beams), spread (deg, half-width), len (px fall-off), end (px from the source where the light lands, 0 = none), color, a, streaks (how many), seed, quality } */
function rays(ctx, t, o = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height, q = o.quality ?? .5;
  const c = run(RAYS_FS, Math.round(W * q), Math.round(H * q), { res: [Math.round(W * q), Math.round(H * q)], full: [W, H], src: [o.x ?? -W * .3, o.y ?? -H * .3], time: t,
    ang: (o.angle ?? 35) * Math.PI / 180, spread: (o.spread ?? 12) * Math.PI / 180, len: o.len ?? W, seed: o.seed ?? 2, a: o.a ?? .8, streaks: o.streaks ?? 6, end: o.end ?? 0, col: rgb(o.color || '#ffd9a0') });
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(c, 0, 0, W, H); ctx.restore();
}
const FIN_FS = `#version 300 es
precision highp float; uniform sampler2D s; uniform vec2 res; uniform float time,grain,gsize,vig,hal,ab,sat,con,split,frame,bloom;
uniform vec3 lift,gamma,gain,sh,hi,halc; out vec4 o;
float h(vec2 p){p=fract(p*vec2(443.897,441.423));p+=dot(p,p.yx+19.19);return fract((p.x+p.y)*p.x);}
float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 soft(vec3 b,vec3 l){return mix(2.*b*l+b*b*(1.-2.*l),sqrt(b)*(2.*l-1.)+2.*b*(1.-l),step(.5,l));}
void main(){ vec2 uv=gl_FragCoord.xy/res; vec2 dc=uv-.5; float r2=dot(dc*vec2(res.x/res.y,1.),dc*vec2(res.x/res.y,1.));
  vec2 off=dc*ab*.004*r2*4.; vec3 c=vec3(texture(s,uv+off).r,texture(s,uv).g,texture(s,uv-off).b);
  vec3 b=(textureLod(s,uv,3.)+textureLod(s,uv,5.)*.8+textureLod(s,uv,6.5)*.6).rgb/2.4;
  float bl=max(lum(b)-.18,0.); c+=halc*bl*hal*1.6+b*bl*bloom;
  c=gain*(c+lift*(1.-c)); c=pow(max(c,0.),1./gamma); c=(c-.5)*con+.5;
  float l=clamp(lum(c),0.,1.); c=mix(vec3(l),c,sat);
  c=mix(c,soft(clamp(c,0.,1.),sh),split*(1.-l)*(1.-l)*1.5); c=mix(c,soft(clamp(c,0.,1.),hi),split*l*l*1.5);
  c*=1.-vig*smoothstep(.15,1.,r2*1.25);
  vec2 gp=floor(gl_FragCoord.xy/gsize); float n=(h(gp+frame*1.37)+h(gp*1.3+frame*.71+9.)-1.);
  c+=n*grain*(.35+2.4*l*(1.-l));
  o=vec4(clamp(c,0.,1.),1.);}`;
/* the film finish over everything drawn so far — call it last (before letterbox).
   o: { grade: { lift, gamma, gain ([r, g, b] or one number), contrast, saturation, shadows: '#hex', highlights: '#hex', split (0..1) },
        grain (0..), grainSize (px), fps (grain changes per film frame), vignette (0..1), halation (0..1), halationColor, bloom, aberration (px-ish) } */
function finish(ctx, t, o = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height, gr = o.grade || {}, v3 = (x, d) => Array.isArray(x) ? x : [x ?? d, x ?? d, x ?? d];
  const c = run(FIN_FS, W, H, { res: [W, H], time: t, frame: Math.floor(t * (o.fps ?? 24)) % 997, grain: o.grain ?? .05, gsize: o.grainSize ?? 1.6, vig: o.vignette ?? .45,
    hal: o.halation ?? .25, halc: rgb(o.halationColor || '#ff5a2a'), bloom: o.bloom ?? .15, ab: o.aberration ?? .3,
    lift: v3(gr.lift, 0), gamma: v3(gr.gamma, 1), gain: v3(gr.gain, 1), con: gr.contrast ?? 1, sat: gr.saturation ?? 1,
    sh: rgb(gr.shadows || '#808080'), hi: rgb(gr.highlights || '#808080'), split: gr.split ?? 0 }, ctx.canvas);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'copy'; ctx.filter = 'none'; ctx.drawImage(c, 0, 0); ctx.restore();
}
/* black bars for a wider picture: ratio 2.39, 2, 1.85 … (on a vertical canvas, bars at top and bottom still) */
function letterbox(ctx, ratio = 2.39, color = '#000') {
  const W = ctx.canvas.width, H = ctx.canvas.height, h = W / ratio; if (h >= H) return (H - h) / 2;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = color;
  const b = (H - h) / 2; ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b); ctx.restore(); return b;
}

/* ---------- footage and stills ---------- */
const MEDIA = [];
/* a video the user gave, as a background. Its time follows the video: at second `at` of the video it shows `from`, at `rate` speed.
   o: { at, from, rate, loop } → a handle for cover() */
function footage(src, o = {}) {
  const el = document.createElement('video'); el.muted = true; el.playsInline = true; el.preload = 'auto'; el.crossOrigin = 'anonymous'; el.src = src;
  const m = { kind: 'video', el, src, at: o.at ?? 0, from: o.from ?? 0, rate: o.rate ?? 1, loop: o.loop ?? true,
    ready: new Promise((ok, no) => { el.addEventListener('loadeddata', ok, { once: true }); el.addEventListener('error', () => no(new Error('cannot load ' + src)), { once: true }); }) };
  m.time = t => { const d = el.duration || 1e9; let v = m.from + (t - m.at) * m.rate; return m.loop ? ((v % d) + d) % d : cl(v, 0, d - .04); };
  MEDIA.push(m); return m;
}
function still(src) {
  const el = new Image(); el.crossOrigin = 'anonymous'; el.src = src;
  const m = { kind: 'image', el, src, ready: new Promise((ok, no) => { el.onload = ok; el.onerror = () => no(new Error('cannot load ' + src)); }) };
  MEDIA.push(m); return m;
}
/* draw a video or image to cover a box, pushed in by z around a focus point (fx, fy as fractions of the picture). o: { box, z, fx, fy, a } */
function cover(ctx, m, o = {}) {
  const el = m.el, iw = el.videoWidth || el.naturalWidth, ih = el.videoHeight || el.naturalHeight; if (!iw) return;
  const [bx, by, bw, bh] = o.box || [0, 0, ctx.canvas.width, ctx.canvas.height], z = o.z ?? 1, fx = o.fx ?? .5, fy = o.fy ?? .5;
  const s = Math.max(bw / iw, bh / ih) * z, w = iw * s, h = ih * s;
  const x = bx + (bw - w) * fx, y = by + (bh - h) * fy;
  ctx.save(); ctx.globalAlpha *= o.a ?? 1; ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
  ctx.drawImage(el, cl(x, bx + bw - w, bx), cl(y, by + bh - h, by), w, h); ctx.restore();
}
function seekMedia(t, live) {
  return Promise.all(MEDIA.filter(m => m.kind === 'video').map(m => new Promise(ok => {
    const v = m.time(t), el = m.el;
    if (live) { if (el.paused) el.play().catch(() => {}); if (Math.abs(el.currentTime - v) > .4) el.currentTime = v; return ok(); }
    if (!el.paused) el.pause();
    if (Math.abs(el.currentTime - v) < .001 && el.readyState >= 2) return ok();
    const done = () => { clearTimeout(to); ok(); }, to = setTimeout(() => { el.removeEventListener('seeked', done); ok(); }, 3000);
    el.addEventListener('seeked', done, { once: true }); el.currentTime = v;
  })));
}

/* ---------- shots ---------- */
/* a run of shots, each with its own picture, light and camera move, changing between cards.
   shots: [{ draw(ctx, t, u, shot), cards: [i, …] | at (s), cam: { from: { x, y, z, r, cx, cy }, to: { … } }, in: 'fade' | 'black' | 'cut', dur (s), background }, …]
     cards — the indexes of the cards this shot carries: it starts in the gap before its first card (half-way, or `lead` s before it);
     at — or an explicit start in seconds. u is 0..1 through the shot (it keeps moving through the transitions); cam is eased along u.
     in — how the shot arrives: a dissolve from the last shot, through black, or a straight cut; dur — how long that takes.
   o: { cards, duration, in, dur, weave (px of gate weave), lead }
   → { shots (with t0, t1), draw(ctx, t), at(t) → index } */
let LAYER = null;
function reel(list, o = {}) {
  const cards = o.cards || [], D = o.duration ?? 1e9;
  const shots = list.map(sh => ({ in: o.in || 'fade', dur: o.dur ?? 1.2, ...sh }));
  shots.forEach((sh, i) => {
    if (sh.at != null) sh.t0 = sh.at;
    else if (!i) sh.t0 = 0;
    else if (sh.cards && sh.cards.length) {
      const first = cards[sh.cards[0]], prevCards = shots.slice(0, i).flatMap(p => p.cards || []), prev = prevCards.length ? cards[Math.max(...prevCards)] : null;
      sh.t0 = o.lead != null ? first.t0 - o.lead : prev ? (prev.t1 + first.t0) / 2 : first.t0 - 1;
    } else throw new Error('shot ' + i + ' needs cards or at');
  });
  shots.forEach((sh, i) => { sh.t1 = i < shots.length - 1 ? shots[i + 1].t0 : D; sh.i = i; });
  const at = t => { let i = 0; while (i < shots.length - 1 && t >= shots[i + 1].t0) i++; return i; };
  function paint(ctx, k, t) {
    const sh = shots[k], pad = sh.dur, u = (t - sh.t0 + pad) / (sh.t1 - sh.t0 + 2 * pad);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.fillStyle = sh.background || o.background || '#000'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (sh.cam) { const c = key(u, [[0, sh.cam.from || {}], [1, sh.cam.to || sh.cam.from || {}]]); camera(ctx, c); }
    if (o.weave) { const w = weave(t, o.weave); ctx.translate(w.x, w.y); }
    sh.draw(ctx, t, cl(u), sh); ctx.restore();
  }
  function draw(ctx, t) {
    const i = at(t), sh = shots[i], nx = shots[i + 1];
    let A = i, B = -1, u = 0, black = 0;
    if (i > 0 && sh.in === 'fade' && t < sh.t0 + sh.dur / 2) { A = i - 1; B = i; u = (t - sh.t0 + sh.dur / 2) / sh.dur; }
    else if (nx && nx.in === 'fade' && t > nx.t0 - nx.dur / 2) { A = i; B = i + 1; u = (t - nx.t0 + nx.dur / 2) / nx.dur; }
    if (i > 0 && sh.in === 'black' && t < sh.t0 + sh.dur / 2) black = 1 - (t - sh.t0) / (sh.dur / 2);
    if (nx && nx.in === 'black' && t > nx.t0 - nx.dur / 2) black = Math.max(black, (t - nx.t0 + nx.dur / 2) / (nx.dur / 2));
    paint(ctx, A, t);
    if (B >= 0) {
      const W = ctx.canvas.width, H = ctx.canvas.height;
      if (!LAYER || LAYER.width !== W || LAYER.height !== H) { LAYER = document.createElement('canvas'); LAYER.width = W; LAYER.height = H; }
      const L = LAYER.getContext('2d'); paint(L, B, t);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = ease.sine(u); ctx.drawImage(LAYER, 0, 0); ctx.restore();
    }
    if (black > 0) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = ease.sine(cl(black)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore(); }
  }
  return { shots, draw, at };
}

/* ---------- music ---------- */
/* a chord (MIDI notes), rolled upward by `roll` seconds per note */
const chord = (t, ms, { inst = 'piano', d = 4, v = .45, roll = .04 } = {}) => ms.map((m, i) => ({ t: t + i * roll, m, d, inst, v }));

/* ---------- the scene ---------- */
function scene(S, draw, { duration, music = null, sounds = [], background = '#050506', timeline = [] } = {}) {
  const Q = new URLSearchParams(location.search), rec = !!Q.get('rec');
  const frameAt = t => { const c = S.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.fillStyle = background; c.fillRect(0, 0, S.W, S.H); draw(c, t, S); };
  const ready = Promise.all([document.fonts ? document.fonts.ready : 0, ...MEDIA.map(m => m.ready)]).then(() => seekMedia(0)).then(() => frameAt(0));
  const s = { duration, music, sounds, ready, timeline, seek: async t => { await ready; await seekMedia(t); frameAt(t); } };
  if (!rec) ready.then(() => { const t0 = performance.now(); const loop = () => { const t = ((performance.now() - t0) / 1000) % duration; seekMedia(t, true); frameAt(t); requestAnimationFrame(loop); }; loop(); });
  return s;
}

window.Title = { create, scene, env, key, bar, schedule, reel, text, block, vertical, measure, layout, camera, weave, glow, bokeh, motes, leak, streak, dust, fog, rays, finish, letterbox,
  footage, still, cover, chord, ease, cl, seg, lerp, hash, rand, noise, rgba, TAU, SERIF, SANS, SONG, FANG, KAI };
})();
