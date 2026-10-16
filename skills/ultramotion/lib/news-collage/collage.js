/* News Collage — a story laid out as a collage on a big board and explained live: paper clippings, printed photos,
   documents and labels with torn or cut edges and real drop shadows, annotated as you watch — a highlighter sweeping
   across a phrase, a marker circling a detail, arrows, red string pinned between two clues, ink stamps — while the
   camera travels from one clue to the next. Canvas 2D, no dependencies. Every frame is a pure function of t.

   window.__scene = Collage.load({ nav: 'img/nav.jpg', facts: 'data/facts.json' }, A => {
     const C = Collage.create({ board: 'cork' });
     const doc = C.piece({ id: 'doc', x: 540, y: 900, w: 820, h: 1000, rot: -2, edge: { bottom: 'torn' }, enter: { at: .4, from: 'drop' },
       face: (g, w, h, P) => P.text(['You authorize us to use ', { t: 'web scrapers', id: 'bots' }, ' …'], { x: 60, y: 120, width: w - 120, size: 40 }) });
     C.highlight('doc.bots', { at: 2 });
     return C.scene({ duration: 30, camera: [[0, C.frame(doc)], …], overlay: (ctx, t) => Collage.source(ctx, 'Source: …'), music });
   });
*/
(function () {
const TAU = Math.PI * 2;
const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
const seg = (t, a, z) => cl((t - a) / (z - a || 1e-6));
const lerp = (a, z, u) => a + (z - a) * u;
const oc = u => 1 - Math.pow(1 - cl(u), 3);
const io = u => { u = cl(u); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const sm = u => { u = cl(u); return u * u * (3 - 2 * u); };
const back = u => { u = cl(u); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2); };
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const rng = seed => { let s = (Math.floor(hash(seed) * 2 ** 31) || 1) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const noise1 = (x, seed = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i + seed * 101.7), hash(i + 1 + seed * 101.7), u) * 2 - 1; };
const fbm = (x, seed = 0) => noise1(x, seed) * .55 + noise1(x * 2.3, seed + 3) * .28 + noise1(x * 5.1, seed + 7) * .17;
const W = 1080, H = 1920;
const FONTS = {
  serif: '"Iowan Old Style", "Georgia", "Times New Roman", serif',
  didone: '"Didot", "Bodoni 72", "Times New Roman", serif',
  sans: '"Helvetica Neue", "Arial", sans-serif',
  condensed: '"Avenir Next Condensed", "DIN Condensed", "Helvetica Neue", sans-serif',
  din: '"DIN Condensed", "Avenir Next Condensed", sans-serif',
  mono: '"Courier New", "Courier", monospace',
  typewriter: '"American Typewriter", "Courier New", monospace',
  hand: '"Marker Felt", "Noteworthy", "Bradley Hand", cursive',
};
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

/* ---------- surfaces ---------- */
const BOARDS = {
  cork:      { base: '#b98a5c', speck: [['#6e4a2a', .5], ['#d9b385', .35], ['#8f6238', .5]], grains: 26000, size: [1, 3.2], fibre: 0 },
  kraft:     { base: '#b8956a', speck: [['#8b6a45', .18], ['#d2b48a', .12]], grains: 9000, size: [.6, 1.6], fibre: 900 },
  paper:     { base: '#efe9dd', speck: [['#cfc6b4', .16], ['#ffffff', .2]], grains: 7000, size: [.5, 1.4], fibre: 700 },
  newsprint: { base: '#dedad0', speck: [['#b9b4a8', .2], ['#f1eee6', .2]], grains: 9000, size: [.5, 1.4], fibre: 500 },
  desk:      { base: '#3b2f27', speck: [['#2a201a', .5], ['#4c3d32', .4]], grains: 6000, size: [.6, 2], fibre: 0, wood: true },
  black:     { base: '#151413', speck: [['#232220', .5], ['#0b0b0a', .5]], grains: 6000, size: [.5, 1.5], fibre: 300 },
};
function tile(spec, seed = 3) {
  const S = 768, c = canvas(S, S), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = spec.base; g.fillRect(0, 0, S, S);
  if (spec.wood) for (let y = 0; y < S; y += 2) { g.fillStyle = `rgba(0,0,0,${.06 + .06 * fbm(y * .05, seed)})`; g.fillRect(0, y, S, 2); }
  for (let i = 0; i < spec.grains; i++) {
    const [col, a] = spec.speck[i % spec.speck.length], x = r() * S, y = r() * S, s = lerp(spec.size[0], spec.size[1], r() ** 2);
    g.globalAlpha = a * (.4 + r() * .6); g.fillStyle = col; g.beginPath(); g.ellipse(x, y, s, s * (.6 + r() * .6), r() * TAU, 0, TAU); g.fill();
    for (const [dx, dy] of [[-S, 0], [S, 0], [0, -S], [0, S]]) if (x + dx > -4 && x + dx < S + 4 && y + dy > -4 && y + dy < S + 4) { g.beginPath(); g.ellipse(x + dx, y + dy, s, s, 0, 0, TAU); g.fill(); }
  }
  g.lineCap = 'round';
  for (let i = 0; i < spec.fibre; i++) {                                       // paper fibres
    const x = r() * S, y = r() * S, a = r() * TAU, l = 3 + r() * 14;
    g.globalAlpha = .05 + r() * .08; g.strokeStyle = r() < .5 ? '#000' : '#fff'; g.lineWidth = .6;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a + 1) * l * .5, y + Math.sin(a + 1) * l * .5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  g.globalAlpha = 1; return c;
}
let GRAIN = null;
function grainTile() {
  if (GRAIN) return GRAIN;
  GRAIN = canvas(256, 256); const g = GRAIN.getContext('2d'), d = g.createImageData(256, 256);
  for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (hash(i * .37) - .5) * 90; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return GRAIN;
}

/* ---------- edges ---------- */
/* one side from a to b: straight (clean), wandering a little (cut), ragged (torn) or soft-ragged (deckle) */
function side(a, b, kind, seed, amp) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
  if (kind === 'clean' || !kind) return [a];
  const step = kind === 'torn' ? 3 : kind === 'deckle' ? 4 : 10, n = Math.max(2, Math.round(L / step)), out = [];
  const A = amp ?? (kind === 'torn' ? 7 : kind === 'deckle' ? 3 : 1.2);
  for (let i = 0; i < n; i++) {
    const u = i / n, s = u * L, ends = Math.min(1, s / 18, (L - s) / 18);
    let o = kind === 'torn' ? fbm(s * .035, seed) * A * 1.4 + (hash(seed * 7 + i) - .5) * A * .55 + fbm(s * .006, seed + 9) * A * 1.6
          : kind === 'deckle' ? fbm(s * .12, seed) * A + (hash(seed + i) - .5) * A * .8 : fbm(s * .01, seed) * A;
    o = o * ends - (kind === 'torn' ? A * 1.2 * ends : 0);                // torn edges eat into the sheet, not out of it
    out.push([a[0] + (b[0] - a[0]) * u + nx * o, a[1] + (b[1] - a[1]) * u + ny * o, kind === 'torn' ? (2.5 + (fbm(s * .05, seed + 4) * .5 + .5) * A * .9) * ends : 0]);
  }
  return out;
}
function outline(w, h, edge, shape, seed) {
  if (shape === 'oval' || shape === 'circle') {
    const n = 180, out = [], kind = typeof edge === 'string' ? edge : 'cut';
    for (let i = 0; i < n; i++) { const a = i / n * TAU, o = kind === 'torn' ? fbm(i * .35, seed) * 6 - 6 : kind === 'clean' ? 0 : fbm(i * .2, seed) * 1.2;
      out.push([w / 2 + Math.cos(a) * (w / 2 + o), h / 2 + Math.sin(a) * (h / 2 + o), kind === 'torn' ? 3 + (fbm(i * .3, seed + 4) * .5 + .5) * 5 : 0]); }
    return out;
  }
  const E = typeof edge === 'string' || !edge ? { top: edge, right: edge, bottom: edge, left: edge } : edge;
  const k = s => E[s] || 'clean';
  return [...side([0, 0], [w, 0], k('top'), seed + 1), ...side([w, 0], [w, h], k('right'), seed + 2), ...side([w, h], [0, h], k('bottom'), seed + 3), ...side([0, h], [0, 0], k('left'), seed + 4)]
    .map(p => p.length > 2 ? p : [p[0], p[1], 0]);
}
const polyPath = (g, pts, ox = 0, oy = 0) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x + ox, y + oy) : g.moveTo(x + ox, y + oy)); g.closePath(); };
/* the inner line of a torn edge: the printed face stops short of the ragged white fibre band */
function inner(pts, w, h) {
  return pts.map(([x, y, b]) => { if (!b) return [x, y]; const dx = w / 2 - x, dy = h / 2 - y, d = Math.hypot(dx, dy) || 1; return [x + dx / d * b, y + dy / d * b]; });
}

/* ---------- photos ---------- */
function drawCover(g, img, x, y, w, h, focus = [.5, .5], crop) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  let [sx, sy, sw, sh] = crop ? [crop[0] * iw, crop[1] * ih, crop[2] * iw, crop[3] * ih] : [0, 0, iw, ih];
  const k = Math.max(w / sw, h / sh), cw = w / k, ch = h / k;
  sx += (sw - cw) * focus[0]; sy += (sh - ch) * focus[1];
  g.drawImage(img, sx, sy, cw, ch, x, y, w, h);
  return { sx, sy, k: w / cw, x, y };
}
const hex = c => { const m = c.replace('#', ''); const n = parseInt(m.length === 3 ? m.split('').map(x => x + x).join('') : m, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
/* print treatments, applied once to the photo area: halftone dots, duotone, mono, a printed look */
function treat(src, T) {
  if (!T || T === 'none') return src;
  const o = typeof T === 'string' ? { kind: T } : T, w = src.width, h = src.height;
  const g0 = src.getContext('2d'), d = g0.getImageData(0, 0, w, h), px = d.data;
  const con = o.contrast ?? (o.kind === 'print' ? 1.05 : 1.15), bri = o.brightness ?? 0;
  const lum = i => cl(((px[i] * .299 + px[i + 1] * .587 + px[i + 2] * .114) / 255 - .5) * con + .5 + bri);
  if (o.kind === 'halftone') {
    const ink = o.ink || '#1b1b1b', paper = o.paper || '#efe9dd', cell = o.cell || 9, ang = (o.angle ?? 45) * Math.PI / 180;
    const out = canvas(w, h), g = out.getContext('2d'); g.fillStyle = paper; g.fillRect(0, 0, w, h); g.fillStyle = ink;
    const ca = Math.cos(ang), sa = Math.sin(ang), R = Math.hypot(w, h);
    for (let u = -R; u < R; u += cell) for (let v = -R; v < R; v += cell) {
      const x = w / 2 + u * ca - v * sa, y = h / 2 + u * sa + v * ca; if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
      const i = (Math.min(h - 1, Math.max(0, y | 0)) * w + Math.min(w - 1, Math.max(0, x | 0))) * 4, dark = 1 - lum(i);
      const r = cell * .5 * Math.sqrt(dark) * 1.05; if (r < .35) continue;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    return out;
  }
  const a = hex(o.ink || (o.kind === 'mono' ? '#151515' : '#20304a')), b = hex(o.paper || (o.kind === 'mono' ? '#f2efe8' : '#f1e6cf'));
  for (let i = 0; i < px.length; i += 4) {
    const L = lum(i);
    if (o.kind === 'duotone' || o.kind === 'mono') { px[i] = lerp(a[0], b[0], L); px[i + 1] = lerp(a[1], b[1], L); px[i + 2] = lerp(a[2], b[2], L); }
    else if (o.kind === 'print') {                                              // ink on paper: a little faded, warm, lifted blacks
      const sat = o.saturation ?? .8, m = L * 255;
      for (let c = 0; c < 3; c++) { let v = lerp(m, px[i + c], sat); v = ((v / 255 - .5) * con + .5) * 255; px[i + c] = lerp(22, b[c], v / 255); }
    }
  }
  g0.putImageData(d, 0, 0); return src;
}

/* ---------- text on a piece ---------- */
/* runs: a string or [string | { t, font, size, weight, style, color, id, bg }]; wraps to width; records the boxes of runs with an id */
function typeset(g, runs, o, spans) {
  const R = (typeof runs === 'string' ? [runs] : runs).map(r => typeof r === 'string' ? { t: r } : r);
  const size = o.size || 40, lh = (o.lh || 1.3) * size, family = FONTS[o.font] || o.font || FONTS.serif, width = o.width || 1e9;
  const fontOf = r => `${r.style || o.style || 'normal'} ${r.weight || o.weight || 400} ${r.size || size}px ${FONTS[r.font] || r.font || family}`;
  const words = []; for (const r of R) { const parts = r.t.split(/(\s+|\n)/); for (const p of parts) if (p) words.push({ p, r }); }
  const lines = [[]]; let x = 0;
  for (const w of words) {
    if (w.p === '\n') { lines.push([]); x = 0; continue; }
    g.font = fontOf(w.r); const ww = g.measureText(w.p).width * (1 + (o.tracking || 0));
    if (/^\s+$/.test(w.p)) { if (x > 0) { lines[lines.length - 1].push({ ...w, w: ww }); x += ww; } continue; }
    if (x + ww > width && x > 0) { const L = lines[lines.length - 1]; while (L.length && /^\s+$/.test(L[L.length - 1].p)) L.pop(); lines.push([]); x = 0; }
    lines[lines.length - 1].push({ ...w, w: ww }); x += ww;
  }
  let y = o.y || 0; const boxes = {};
  for (const L of lines) {
    while (L.length && /^\s+$/.test(L[L.length - 1].p)) L.pop();
    const lw = L.reduce((s, w) => s + w.w, 0), x0 = (o.x || 0) - (o.align === 'center' ? lw / 2 : o.align === 'right' ? lw : 0);
    let cx = x0;
    for (const w of L) {
      const sz = w.r.size || size; g.font = fontOf(w.r);
      if (w.r.bg) { g.fillStyle = w.r.bg; g.fillRect(cx - 4, y - sz * .82, w.w + 8, sz * 1.08); }
      g.fillStyle = w.r.color || o.color || '#1a1a1a'; g.textBaseline = 'alphabetic';
      if (!/^\s+$/.test(w.p)) { if (o.tracking) { let tx = cx; for (const ch of w.p) { g.fillText(ch, tx, y); tx += g.measureText(ch).width * (1 + o.tracking); } } else g.fillText(w.p, cx, y); }
      if (w.r.id) { const b = (boxes[w.r.id] ||= []); const last = b[b.length - 1], top = y - sz * .78, hh = sz * 1.0;
        if (last && Math.abs(last.y - top) < 1 && /^\s+$/.test(w.p) === false && last.x + last.w >= cx - g.measureText(' ').width - 1) { last.w = cx + w.w - last.x; }
        else if (!/^\s+$/.test(w.p)) b.push({ x: cx, y: top, w: w.w, h: hh }); }
      cx += w.w;
    }
    y += L.length ? lh : lh * .6;
  }
  for (const [id, b] of Object.entries(boxes)) (spans[id] ||= []).push(...b);
  return { y, lines: lines.length, height: y - (o.y || 0) };
}

/* ---------- hand-drawn strokes ---------- */
function wob(pts, amp, seed) {
  let s = 0; return pts.map((p, i) => { if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    const j = Math.min(pts.length - 1, i + 1), k = Math.max(0, i - 1), dx = pts[j][0] - pts[k][0], dy = pts[j][1] - pts[k][1], d = Math.hypot(dx, dy) || 1, o = amp * fbm(s * .012, seed);
    return [p[0] - dy / d * o, p[1] + dx / d * o]; });
}
function partial(g, pts, u) {
  if (u <= 0 || pts.length < 2) return; let L = 0; const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const end = L * cl(u); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) { if (acc[i] <= end) g.lineTo(pts[i][0], pts[i][1]); else { const f = (end - acc[i - 1]) / (acc[i] - acc[i - 1] || 1); g.lineTo(lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)); break; } }
  g.stroke();
}
const quad = (a, c, b, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const u = i / n, v = 1 - u; return [v * v * a[0] + 2 * v * u * c[0] + u * u * b[0], v * v * a[1] + 2 * v * u * c[1] + u * u * b[1]]; });

/* ---------- the collage ---------- */
function create(o = {}) {
  const cv = o.canvas || document.querySelector('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const items = [], pieces = {}, sounds = [], seed0 = o.seed || 1;
  let z = 0, nid = 0;
  const board = typeof o.board === 'function' ? o.board : (() => { const spec = typeof o.board === 'object' ? { ...BOARDS[o.board.kind || 'cork'], ...o.board } : BOARDS[o.board || 'cork']; const T = tile(spec, seed0); return (c) => { c.fillStyle = c.createPattern(T, 'repeat'); c.fillRect(-1e4, -1e4, 3e4, 3e4); }; })();
  const light = { dx: o.light?.dx ?? .5, dy: o.light?.dy ?? .9, dark: o.light?.dark ?? .38 };

  /* a sheet of paper: photo, clipping, document, label, card */
  function piece(p) {
    const P = { id: p.id || 'p' + (nid++), x: 540, y: 960, w: 600, h: 400, rot: 0, lift: 4, paper: '#f4f0e6', edge: 'clean', shape: 'rect', z: z++, spans: {}, ...p };
    P.kind = 'piece'; P.seed = p.seed ?? hash(nid * 13.7 + seed0) * 1000; P.enter = p.enter === undefined ? { at: 0, from: 'none' } : typeof p.enter === 'number' ? { at: p.enter, from: 'drop' } : { from: 'drop', ...p.enter };
    const given = p.spans || {}; P.spans = {};                                // spans given in the piece's pixels
    for (const [id, rs] of Object.entries(given)) P.spans[id] = rs.map(r => Array.isArray(r) ? { x: r[0], y: r[1], w: r[2], h: r[3] } : r);
    pieces[P.id] = P; items.push(P);
    const e = P.enter, d = e.dur ?? ({ drop: .55, slap: .3, none: 0, fade: .4 })[e.from] ?? .7;
    e.dur = d;
    if (e.sound !== false) {
      if (e.from === 'drop') sounds.push({ t: e.at + d * .85, kind: 'land', v: .55 * (e.v ?? 1) });
      else if (e.from === 'slap') sounds.push({ t: e.at + d * .7, kind: 'land', v: .8 * (e.v ?? 1) }, { t: e.at + d * .7, kind: 'tap', v: .5 });
      else if (e.from !== 'none' && e.from !== 'fade') sounds.push({ t: e.at, kind: 'slide', dur: d, v: .5 * (e.v ?? 1) });
    }
    if (P.exit) { P.exit = { to: 'left', dur: .6, ...P.exit }; if (P.exit.sound !== false) sounds.push({ t: P.exit.at, kind: 'slide', dur: P.exit.dur, v: .4 }); }
    build(P); return P;
  }
  function build(P) {
    if (P.h === 'auto') {                                                     // measure: the face returns the y where its content ends
      const m = canvas(P.w, 10).getContext('2d'), r = P.face(m, P.w, 1e4, faceKit(m, { ...P, spans: {} }));
      P.h = Math.ceil((typeof r === 'number' ? r : r && r.y || 600) + (P.padBottom ?? 70));
    }
    const pad = 30, w = P.w, h = P.h, c = canvas(w + pad * 2, h + pad * 2), g = c.getContext('2d');
    const pts = outline(w, h, P.edge, P.shape, P.seed), inn = inner(pts, w, h);
    g.translate(pad, pad);
    polyPath(g, pts); g.fillStyle = P.core || '#fbf8f1'; g.fill();          // the white fibres of a torn edge
    g.save(); polyPath(g, inn); g.clip();
    g.fillStyle = P.paper; g.fillRect(-pad, -pad, w + pad * 2, h + pad * 2);
    if (P.image) {
      const b = P.border ?? 0, bw = w - b * 2, bh = h - b * 2 - (P.borderBottom ?? 0);
      const ph = canvas(bw, bh), pg = ph.getContext('2d'), m = drawCover(pg, P.image, 0, 0, bw, bh, P.focus, P.crop);
      g.drawImage(treat(ph, P.treat), b, b);
      const u = P.imageUnit ?? 1;                                              // imageSpans: boxes in the image's own pixels (× imageUnit, e.g. 150 / 72 for PDF points)
      for (const [id, rs] of Object.entries(P.imageSpans || {})) (P.spans[id] ||= []).push(...rs.map(([x, y, w2, h2]) => ({ x: b + (x * u - m.sx) * m.k, y: b + (y * u - m.sy) * m.k, w: w2 * u * m.k, h: h2 * u * m.k })));
    }
    if (P.face) P.face(g, w, h, faceKit(g, P));
    if (P.grain !== false) { g.globalAlpha = P.grain ?? .09; g.globalCompositeOperation = 'overlay'; g.fillStyle = g.createPattern(grainTile(), 'repeat'); g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
    if (P.fold) { const fg = g.createLinearGradient(0, h * P.fold - 10, 0, h * P.fold + 10); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(.5, 'rgba(0,0,0,.10)'); fg.addColorStop(.52, 'rgba(255,255,255,.18)'); fg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fg; g.fillRect(0, h * P.fold - 10, w, 20); }
    g.restore();
    if (P.opacity != null) { /* tape, vellum: see-through */ }
    P.cache = c; P.pad = pad; P.pts = pts;
  }
  function faceKit(g, P) {
    return {
      text: (runs, o = {}) => typeset(g, runs, o, P.spans),
      span: (id, x, y, w, h) => (P.spans[id] ||= []).push({ x, y, w, h }),
      image: (img, x, y, w, h, o = {}) => { const c = canvas(w, h); drawCover(c.getContext('2d'), img, 0, 0, w, h, o.focus, o.crop); g.drawImage(treat(c, o.treat), x, y); },
      rule: (x, y, w, o = {}) => { g.fillStyle = o.color || '#1a1a1a'; g.fillRect(x, y, w, o.weight || 2); },
      fonts: FONTS, P,
    };
  }

  /* where a piece is at t: centre, rotation, scale, lift, visible */
  function pose(P, t) {
    const e = P.enter; let x = P.x, y = P.y, rot = P.rot, s = 1, lift = P.lift, a = 1;
    if (t < e.at) return null;
    const u = e.dur ? seg(t, e.at, e.at + e.dur) : 1;
    const dir = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[e.from];
    if (e.from === 'drop') { const k = oc(u); s = lerp(1.1, 1, k); lift = lerp(P.lift + 46, P.lift, k); rot += (1 - k) * (hash(P.seed) > .5 ? 5 : -5); a = cl(u * 4); }
    else if (e.from === 'slap') { const k = back(u); s = lerp(1.35, 1, k); lift = lerp(P.lift + 30, P.lift, cl(u * 1.4)); a = cl(u * 6); }
    else if (e.from === 'fade') a = sm(u);
    else if (dir) { const k = oc(u), D = e.dist ?? 1500; x += dir[0] * D * (1 - k); y += dir[1] * D * (1 - k); rot += (1 - k) * (dir[0] || dir[1]) * 6; lift = P.lift + 10 * (1 - k); }
    if (P.exit && t > P.exit.at) {
      const v = oc(seg(t, P.exit.at, P.exit.at + P.exit.dur)), d2 = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[P.exit.to];
      if (d2) { x += d2[0] * 1600 * v; y += d2[1] * 1600 * v; rot += v * 8 * (d2[0] || d2[1]); } else a *= 1 - v;
      if (v >= 1) return null;
    }
    if (P.motion) { const m = P.motion(t) || {}; x += m.x || 0; y += m.y || 0; rot += m.rot || 0; s *= m.s || 1; lift += m.lift || 0; }
    return { x, y, rot, s, lift, a };
  }
  const local = (P, ps, lx, ly) => { const r = ps.rot * Math.PI / 180, dx = (lx - P.w / 2) * ps.s, dy = (ly - P.h / 2) * ps.s; return [ps.x + dx * Math.cos(r) - dy * Math.sin(r), ps.y + dx * Math.sin(r) + dy * Math.cos(r)]; };
  const resting = P => ({ x: P.x, y: P.y, rot: P.rot, s: 1, lift: P.lift, a: 1 });

  /* targets: 'piece.span', a piece, { on: piece, rect: [x, y, w, h] } in the piece's pixels, or { rect } on the board */
  function resolve(tg) {
    if (typeof tg === 'string') { const [pid, sid] = tg.split('.'); const P = pieces[pid]; if (!P) throw new Error('no piece ' + pid);
      if (!sid) return { on: P, rects: [{ x: 0, y: 0, w: P.w, h: P.h }] };
      const r = P.spans[sid]; if (!r) throw new Error(`no span "${sid}" on ${pid} (spans: ${Object.keys(P.spans).join(', ')})`); return { on: P, rects: r }; }
    if (tg && tg.kind === 'piece') return { on: tg, rects: [{ x: 0, y: 0, w: tg.w, h: tg.h }] };
    if (Array.isArray(tg)) return { on: null, rects: [{ x: tg[0], y: tg[1], w: tg[2] || 0, h: tg[3] || 0 }] };
    if (tg && tg.at) return { on: typeof tg.on === 'string' ? pieces[tg.on] : tg.on || null, rects: [{ x: tg.at[0], y: tg.at[1], w: 0, h: 0 }] };
    if (tg && tg.rect) { const [x, y, w, h] = tg.rect; return { on: tg.on ? (typeof tg.on === 'string' ? pieces[tg.on] : tg.on) : null, rects: [{ x, y, w, h }] }; }
    if (Array.isArray(tg)) return { on: null, rects: [{ x: tg[0], y: tg[1], w: tg[2] || 0, h: tg[3] || 0 }] };
    throw new Error('unknown target');
  }
  const union = rs => { const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y)), x1 = Math.max(...rs.map(r => r.x + r.w)), y1 = Math.max(...rs.map(r => r.y + r.h)); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
  /* the world box of a target, where it rests */
  function box(tg, pad = 0) {
    const R = resolve(tg), b = union(R.rects);
    if (!R.on) return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    const ps = resting(R.on), cs = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => local(R.on, ps, x, y));
    const xs = cs.map(c => c[0]), ys = cs.map(c => c[1]);
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  }
  /* the camera that fits a target (or several) in the frame */
  function frame(tg, { pad = 60, zoom, dy = 0, dx = 0, rot = 0, maxZoom = 4, safe = [90, 210, 150, 360] } = {}) {
    const bs = (Array.isArray(tg) && typeof tg[0] !== 'number' ? tg : [tg]).map(x => box(x, pad));
    const b = { x: Math.min(...bs.map(q => q.x)), y: Math.min(...bs.map(q => q.y)) }; b.w = Math.max(...bs.map(q => q.x + q.w)) - b.x; b.h = Math.max(...bs.map(q => q.y + q.h)) - b.y;
    const [sl, st, sr, sb] = safe, aw = W - sl - sr, ah = H - st - sb;
    const z = zoom ?? Math.min(maxZoom, aw / b.w, ah / b.h);
    const cx = b.x + b.w / 2 - ((sl - sr) / 2) / z + dx, cy = b.y + b.h / 2 - ((st - sb) / 2) / z + dy;
    return { x: cx, y: cy, zoom: z, rot };
  }

  /* annotations: each is drawn from its start time, growing over its duration */
  function mark(kind, tg, o, snd) {
    const M = { kind, z: o.z ?? z++, at: o.at ?? 0, dur: o.dur ?? .6, ...o, kind, tg: tg != null ? resolve(tg) : null, seed: hash(z * 7.3 + seed0) * 999 };
    if (M.tg && M.tg.on && o.top !== true) M.on = M.tg.on;
    items.push(M); if (snd && o.sound !== false) sounds.push(...[].concat(snd(M)).filter(Boolean)); return M;
  }
  const highlight = (tg, o = {}) => mark('highlight', tg, { color: '#ffe14d', dur: .5, ...o }, M => ({ t: M.at, kind: 'highlighter', dur: M.dur, v: .9 }));
  const underline = (tg, o = {}) => mark('underline', tg, { color: '#d7261e', width: 7, dur: .4, ...o }, M => ({ t: M.at, kind: 'marker', dur: M.dur, v: .8 }));
  const strike = (tg, o = {}) => mark('strike', tg, { color: '#d7261e', width: 7, dur: .35, ...o }, M => ({ t: M.at, kind: 'marker', dur: M.dur, v: .8 }));
  const circle = (tg, o = {}) => mark('circle', tg, { color: '#d7261e', width: 7, dur: .6, pad: 18, ...o }, M => ({ t: M.at, kind: 'marker', dur: M.dur, v: .9 }));
  const boxMark = (tg, o = {}) => mark('box', tg, { color: '#d7261e', width: 6, dur: .7, pad: 14, ...o }, M => ({ t: M.at, kind: 'marker', dur: M.dur, v: .8 }));
  const redact = (tg, o = {}) => mark('redact', tg, { color: '#111', dur: .45, ...o }, M => ({ t: M.at, kind: 'marker', dur: M.dur, v: .6 }));
  const focus = (tg, o = {}) => mark('focus', tg, { dur: .5, alpha: .72, ...o });
  const arrow = (from, to, o = {}) => mark('arrow', null, { color: '#d7261e', width: 7, dur: .55, bend: .25, head: 34, ...o, from, to, top: true }, M => ({ t: M.at, kind: 'marker', dur: M.dur, v: .8 }));
  const string = (from, to, o = {}) => mark('string', null, { color: '#c3161c', width: 4, dur: .7, sag: .08, pins: true, ...o, from, to, top: true },
    M => [{ t: M.at, kind: 'tap', v: .7 }, { t: M.at + M.dur, kind: 'tap', v: .8 }, { t: M.at, kind: 'swish', v: .35 }]);
  const stamp = (text, o = {}) => { const M = mark('stamp', o.on ? { on: o.on, rect: [o.x, o.y, 0, 0] } : [o.x, o.y], { color: '#c3161c', size: 90, rot: -12, dur: .14, shape: 'box', ...o, text },
    M => [{ t: M.at + .1, kind: 'thud', v: .9 }, { t: M.at + .1, kind: 'tap', v: .9 }]); M.cache = stampCache(M); return M; };
  const draw = (fn, o = {}) => mark('draw', o.on ? { on: o.on, rect: [0, 0, 0, 0] } : null, { ...o, fn });
  /* a strip of tape over a corner or across the top: semi-transparent paper */
  const tape = (o = {}) => piece({ w: o.w || 220, h: o.h || 64, paper: o.color || 'rgba(236,226,196,.78)', core: 'rgba(0,0,0,0)', edge: { left: 'deckle', right: 'deckle' }, lift: 1, grain: .05, enter: { at: o.at ?? 0, from: 'fade', dur: .15, sound: false }, ...o, tape: true });
  /* a label strip: white type on black (or any) — the name under a photo, the date, the thing being pointed at */
  const label = (text, o = {}) => {
    const size = o.size || 46, fam = FONTS[o.font] || o.font || FONTS.serif, font = `${o.style || 'italic'} ${o.weight || 600} ${size}px ${fam}`;
    const m = canvas(10, 10).getContext('2d'); m.font = font; const padX = o.padX ?? size * .45, tw = m.measureText(text).width;
    const w = Math.ceil(Math.min(tw + padX * 2, o.width || 1e9)), lh = o.lh || 1.12;
    return piece({ w, h: 'auto', padBottom: size * .38, paper: o.bg || '#141414', edge: 'cut', lift: 2, grain: .05, enter: { at: o.at ?? 0, from: 'slap' }, ...o, h: 'auto',
      face: (g, W, H, P) => P.text(text, { x: o.align === 'center' ? W / 2 : padX, y: size * 1.0, width: W - padX * 2, size, lh, font: fam, style: o.style || 'italic', weight: o.weight || 600, color: o.color || '#f6f1e6', align: o.align }).y - size * lh + size * .04 });
  };
  function stampCache(M) {
    const s = M.size, f = `${M.weight || 800} ${s}px ${FONTS[M.font] || M.font || FONTS.condensed}`, m = canvas(10, 10).getContext('2d'); m.font = f;
    const lines = String(M.text).split('\n'), tw = Math.max(...lines.map(l => m.measureText(l).width)) * (1 + (M.tracking ?? .06)), lh = s * 1.0;
    const bw = tw + s * .8, bh = lines.length * lh + s * .45, c = canvas(bw + 20, bh + 20), g = c.getContext('2d');
    g.translate(10, 10); g.strokeStyle = g.fillStyle = M.color; g.font = f; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => { let x = bw / 2 - m.measureText(l).width * (1 + (M.tracking ?? .06)) / 2; for (const ch of l) { const cw = m.measureText(ch).width; g.textAlign = 'left'; g.fillText(ch, x, s * .25 + lh * (i + .52)); x += cw * (1 + (M.tracking ?? .06)); } });
    g.lineWidth = s * .07;
    if (M.shape === 'box') { g.strokeRect(s * .08, s * .04, bw - s * .16, bh - s * .08); }
    else if (M.shape === 'double') { g.strokeRect(s * .04, s * .02, bw - s * .08, bh - s * .04); g.lineWidth = s * .03; g.strokeRect(s * .14, s * .1, bw - s * .28, bh - s * .2); }
    else if (M.shape === 'circle') { g.beginPath(); g.ellipse(bw / 2, bh / 2, bw / 2 - 4, bh / 2 - 4, 0, 0, TAU); g.stroke(); }
    g.globalCompositeOperation = 'destination-out'; const r = rng(M.seed);       // ink that didn't take
    for (let i = 0; i < bw * bh / 90; i++) { g.globalAlpha = .3 + r() * .7; g.beginPath(); g.arc(r() * bw, r() * bh, .4 + r() ** 3 * 3.2, 0, TAU); g.fill(); }
    g.globalAlpha = .35; for (let i = 0; i < 6; i++) { const y = r() * bh; g.fillRect(0, y, bw, 1 + r() * 2); }
    return c;
  }

  /* ---------- drawing ---------- */
  function rectsAt(R, ps) { return R.rects; }
  function drawMark(c, M, t, ps) {
    const u = seg(t, M.at, M.at + M.dur); if (t < M.at) return; if (M.until != null && t > M.until + (M.out ?? .3)) return;
    const fadeOut = M.until != null ? 1 - seg(t, M.until, M.until + (M.out ?? .3)) : 1;
    c.save(); c.globalAlpha *= fadeOut;
    if (M.kind === 'highlight') {
      const rs = M.tg.rects, tot = rs.reduce((s, r) => s + r.w, 0); let done = 0;
      c.globalCompositeOperation = 'multiply'; c.fillStyle = M.color;
      for (const [i, r] of rs.entries()) {
        const f = cl((u * tot - done) / r.w); done += r.w; if (f <= 0) break;
        const x0 = r.x - 8, y0 = r.y + r.h * (M.low ? .35 : -.02), hh = r.h * (M.low ? .62 : 1.04), x1 = x0 + (r.w + 16) * f, s = M.seed + i * 11;
        c.beginPath(); c.moveTo(x0 + 3, y0 + fbm(1, s) * 3);
        for (let x = x0; x <= x1; x += 12) c.lineTo(x, y0 + fbm(x * .03, s) * 2.5);
        c.lineTo(x1 + 4 * fbm(5, s), y0 + hh * .15); c.lineTo(x1 - 3, y0 + hh);
        for (let x = x1; x >= x0; x -= 12) c.lineTo(x, y0 + hh + fbm(x * .03, s + 5) * 2.5);
        c.lineTo(x0 - 4, y0 + hh * .6); c.closePath(); c.globalAlpha = (M.alpha ?? .85) * fadeOut; c.fill();
      }
    } else if (M.kind === 'focus') {
      const b = M.on; c.fillStyle = M.color || (b ? b.paper : '#000'); c.globalAlpha = (M.alpha) * sm(u) * fadeOut;
      c.beginPath(); c.rect(0, 0, b ? b.w : W, b ? b.h : H); for (const r of M.tg.rects) c.rect(r.x - 10 + r.w + 20, r.y - 8, -(r.w + 20), r.h + 16); c.fill('evenodd');
    } else if (M.kind === 'redact') {
      c.fillStyle = M.color; const rs = M.tg.rects, tot = rs.reduce((s, r) => s + r.w, 0); let done = 0;
      for (const r of rs) { const f = cl((u * tot - done) / r.w); done += r.w; if (f > 0) c.fillRect(r.x - 4, r.y - 2, (r.w + 8) * f, r.h + 4); }
    } else if (M.kind === 'underline' || M.kind === 'strike') {
      const rs = M.tg.rects, tot = rs.reduce((s, r) => s + r.w, 0); let done = 0;
      c.strokeStyle = M.color; c.lineWidth = M.width; c.lineCap = 'round'; c.lineJoin = 'round';
      for (const [i, r] of rs.entries()) {
        const f = cl((u * tot - done) / r.w); done += r.w; if (f <= 0) break;
        const y = M.kind === 'strike' ? r.y + r.h * .5 : r.y + r.h + 6 + (M.offset || 0), x0 = r.x - 6, x1 = r.x + r.w + 10;
        const pts = wob(Array.from({ length: 20 }, (_, k) => [lerp(x0, x1, k / 19), y + (k / 19 - .5) * (M.slope ?? -4)]), 2.5, M.seed + i);
        partial(c, pts, f);
        if (M.double && f >= 1) partial(c, wob(pts.map(([x, yy]) => [x + 8, yy + M.width * 1.6]), 2, M.seed + 9), cl((u - .7) / .3));
      }
    } else if (M.kind === 'circle' || M.kind === 'box') {
      const b = union(M.tg.rects), p = M.pad, cx = b.x + b.w / 2, cy = b.y + b.h / 2, rx = b.w / 2 + p, ry = b.h / 2 + p * .8;
      c.strokeStyle = M.color; c.lineWidth = M.width; c.lineCap = 'round'; c.lineJoin = 'round';
      let pts;
      if (M.kind === 'circle') { const turns = M.turns ?? 1.12, a0 = -1.9 + hash(M.seed) * .4; pts = Array.from({ length: 90 }, (_, k) => { const a = a0 + k / 89 * turns * TAU, grow = 1 + (k / 89) * .07; return [cx + Math.cos(a) * rx * grow, cy + Math.sin(a) * ry * grow]; }); pts = wob(pts, 3, M.seed); }
      else pts = wob([[b.x - p, b.y - p], [b.x + b.w + p, b.y - p + 3], [b.x + b.w + p - 2, b.y + b.h + p], [b.x - p + 2, b.y + b.h + p - 2], [b.x - p - 3, b.y - p - 6]].flatMap((q, i, a) => i ? Array.from({ length: 12 }, (_, k) => [lerp(a[i - 1][0], q[0], (k + 1) / 12), lerp(a[i - 1][1], q[1], (k + 1) / 12)]) : [q]), 2.5, M.seed);
      partial(c, pts, io(u));
    } else if (M.kind === 'stamp') {
      const r = M.tg.rects[0], k = seg(t, M.at, M.at + M.dur), s = lerp(1.6, 1, oc(k));
      c.translate(r.x, r.y); c.rotate(M.rot * Math.PI / 180); c.scale(s, s);
      c.globalCompositeOperation = M.blend || 'multiply'; c.globalAlpha = (M.alpha ?? .9) * cl(k * 3) * fadeOut;
      c.drawImage(M.cache, -M.cache.width / 2, -M.cache.height / 2);
    } else if (M.kind === 'draw') { M.fn(c, t, u); }
    c.restore();
  }
  /* a world point: [x, y] on the board, or { on: piece, at: [x, y] } in the piece's pixels (follows the piece) */
  function pointAt(p, t) {
    if (Array.isArray(p)) return p;
    if (typeof p === 'string' || p.kind === 'piece') p = anchor(p);
    const P = typeof p.on === 'string' ? pieces[p.on] : p.on, ps = pose(P, t) || resting(P);
    return local(P, ps, ...(p.at || [P.w / 2, P.h / 2]));
  }
  function drawTop(c, M, t) {
    if (t < M.at) return; const u = seg(t, M.at, M.at + M.dur);
    const fadeOut = M.until != null ? 1 - seg(t, M.until, M.until + (M.out ?? .3)) : 1; if (fadeOut <= 0) return;
    c.save(); c.globalAlpha *= fadeOut;
    const a = pointAt(M.from, t), b = pointAt(M.to, t), d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (M.kind === 'arrow') {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, nx = -(b[1] - a[1]) / d, ny = (b[0] - a[0]) / d, ctl = [mx + nx * d * M.bend, my + ny * d * M.bend];
      const pts = wob(quad(a, ctl, b, 40), 2.5, M.seed); c.strokeStyle = M.color; c.lineWidth = M.width; c.lineCap = 'round'; c.lineJoin = 'round';
      partial(c, pts, io(cl(u / .78)));
      const hu = cl((u - .78) / .22); if (hu > 0) { const e = pts[pts.length - 1], q = pts[pts.length - 5], an = Math.atan2(e[1] - q[1], e[0] - q[0]);
        for (const s of [-1, 1]) partial(c, [e, [e[0] - Math.cos(an + s * .5) * M.head, e[1] - Math.sin(an + s * .5) * M.head]], hu); }
    } else if (M.kind === 'string') {
      const sag = d * M.sag, ctl = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag * 2], pts = quad(a, ctl, b, 48), k = io(u);
      c.lineCap = 'round';
      c.save(); c.translate(light.dx * 7, light.dy * 7); c.strokeStyle = `rgba(0,0,0,${light.dark * .55})`; c.lineWidth = M.width + 1.5; c.filter = 'blur(2.5px)'; partial(c, pts, k); c.restore();
      c.strokeStyle = M.color; c.lineWidth = M.width; partial(c, pts, k);
      c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = M.width * .3; c.save(); c.translate(-M.width * .2, -M.width * .25); partial(c, pts, k); c.restore();
      if (M.pins) { pin(c, a, M.pin || M.color, M.seed); if (u >= 1) pin(c, b, M.pin || M.color, M.seed + 1); }
    }
    c.restore();
  }
  function pin(c, [x, y], col, s) {
    c.save(); c.fillStyle = `rgba(0,0,0,${light.dark * .7})`; c.filter = 'blur(3px)'; c.beginPath(); c.arc(x + light.dx * 9, y + light.dy * 9, 13, 0, TAU); c.fill(); c.restore();
    const g = c.createRadialGradient(x - 5, y - 6, 2, x, y, 15); g.addColorStop(0, '#ffffff'); g.addColorStop(.25, col); g.addColorStop(1, shade(col, -.45));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, 14, 0, TAU); c.fill(); void s;
  }
  const shade = (col, k) => { const [r, g, b] = hex(col.startsWith('#') ? col : '#c3161c'); const f = v => Math.round(cl(k < 0 ? v * (1 + k) : v + (255 - v) * k, 0, 255)); return `rgb(${f(r)},${f(g)},${f(b)})`; };

  function drawPiece(c, P, ps, zoom, t) {
    c.save(); c.translate(ps.x, ps.y); c.rotate(ps.rot * Math.PI / 180); c.scale(ps.s, ps.s); c.globalAlpha = ps.a;
    const L = ps.lift * ps.s;
    if (!P.tape && P.shadow !== false) {                                     // contact shadow + soft lifted shadow, light from one side
      c.shadowColor = `rgba(0,0,0,${light.dark})`; c.shadowBlur = (2 + L * 1.3) * zoom; c.shadowOffsetX = light.dx * L * zoom * .9; c.shadowOffsetY = light.dy * L * zoom * .9;
    }
    c.drawImage(P.cache, -P.w / 2 - P.pad, -P.h / 2 - P.pad);
    c.shadowColor = 'transparent';
    c.translate(-P.w / 2, -P.h / 2);
    if (P.curl) { const g = c.createLinearGradient(0, 0, P.w, P.h); g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.08)'); c.fillStyle = g; polyPath(c, P.pts); c.fill(); }
    for (const M of P.marks) drawMark(c, M, t, ps);
    c.restore();
  }

  /* ---------- camera ---------- */
  function camAt(keys, t) {
    if (typeof keys === 'function') return keys(t);
    const K = keys; if (!K || !K.length) return { x: W / 2, y: H / 2, zoom: 1, rot: 0 };
    if (t <= K[0][0]) return { rot: 0, ...K[0][1] };
    for (let i = 1; i < K.length; i++) if (t <= K[i][0]) {
      const [t0, a] = K[i - 1], [t1, b] = K[i], u = io((t - t0) / (t1 - t0));
      const z = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), u));       // zoom moves evenly in scale
      return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), zoom: z, rot: lerp(a.rot || 0, b.rot || 0, u) };
    }
    return { rot: 0, ...K[K.length - 1][1] };
  }

  function scene({ duration, camera, overlay, under, music = null, sounds: extra = [], drift = 1, whoosh = true, finish: fin = {} } = {}) {
    items.sort((a, b) => a.z - b.z);
    for (const P of Object.values(pieces)) P.marks = items.filter(M => M.kind !== 'piece' && M.on === P);
    const top = items.filter(M => M.kind === 'piece' || !M.on);
    const camSounds = [];
    if (whoosh && Array.isArray(camera)) for (let i = 1; i < camera.length; i++) {          // a soft air move under every long camera travel
      const [t0, a] = camera[i - 1], [t1, b] = camera[i], d = Math.hypot(a.x - b.x, a.y - b.y) * Math.min(a.zoom, b.zoom) + Math.abs(Math.log(b.zoom / a.zoom)) * 900;
      if (d > 500 && t1 - t0 > .25) camSounds.push({ t: t0, kind: 'whoosh', dur: t1 - t0, v: cl(d / 2200, .25, .6) });
    }
    const frameAt = t => {
      const v = camAt(camera, t), dz = drift ? 1 + .006 * Math.sin(t * .35) * drift : 1;
      const cx = v.x + (drift ? 6 * drift * Math.sin(t * .27 + 1) : 0), cy = v.y + (drift ? 5 * drift * Math.sin(t * .21) : 0), zoom = v.zoom * dz, rot = (v.rot || 0) + (drift ? .25 * drift * Math.sin(t * .17) : 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.filter = 'none';
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(rot * Math.PI / 180); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
      board(ctx, t, { x: cx, y: cy, zoom });
      under && under(ctx, t);
      for (const it of top) {
        if (it.kind === 'piece') { const ps = pose(it, t); if (ps) drawPiece(ctx, it, ps, zoom, t); }
        else if (it.kind === 'arrow' || it.kind === 'string') drawTop(ctx, it, t);
        else drawMark(ctx, it, t, null);
      }
      ctx.restore();
      if (overlay) { ctx.save(); overlay(ctx, t, { x: cx, y: cy, zoom }); ctx.restore(); }
      finish(ctx, t, fin);
    };
    const Q = new URLSearchParams(location.search);
    const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => frameAt(0));
    const s = { duration, music, sounds: [...sounds, ...camSounds, ...extra], ready, seek: async t => { await ready; frameAt(t); } };
    if (!Q.get('rec')) ready.then(() => { const t0 = performance.now(); const loop = () => { frameAt(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); }; loop(); });
    return s;
  }

  /* a point on a target, to hang an arrow or a string on: side 'left' 'right' 'top' 'bottom' 'center' (+ dx, dy in the piece's pixels) */
  function anchor(tg, sideName = 'center', dx = 0, dy = 0) {
    const R = resolve(tg), b = union(R.rects);
    const p = { left: [b.x - 10, b.y + b.h / 2], right: [b.x + b.w + 10, b.y + b.h / 2], top: [b.x + b.w / 2, b.y - 8], bottom: [b.x + b.w / 2, b.y + b.h + 8], center: [b.x + b.w / 2, b.y + b.h / 2] }[sideName];
    return R.on ? { on: R.on, at: [p[0] + dx, p[1] + dy] } : [p[0] + dx, p[1] + dy];
  }

  return { piece, label, tape, anchor, highlight, underline, strike, circle, box: boxMark, redact, focus, arrow, string, stamp, draw, frame, bounds: box, pieces, sounds, scene, ctx, W, H,
    point: (on, x, y) => ({ on, at: [x, y] }) };
}

/* ---------- screen-space helpers ---------- */
function finish(ctx, t, { grain = .07, vignette = .32 } = {}) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (vignette) { const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vignette})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (grain) { const f = Math.floor(t * 24), ox = hash(f) * 256, oy = hash(f + 7.3) * 256; ctx.save(); ctx.globalAlpha = grain; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat'); ctx.translate(-ox, -oy); ctx.fillRect(ox, oy, W, H); ctx.restore(); }
}
/* the source line, small, on a strip at the bottom-left — above the platform's caption area */
function source(ctx, text, { x = 64, y = 1610, size = 26, color = '#f4efe4', bg = 'rgba(20,20,20,.82)', font = FONTS.condensed, a = 1, maxWidth = 820 } = {}) {
  ctx.save(); ctx.globalAlpha = a; ctx.font = `500 ${size}px ${font}`; const lines = [];
  for (const para of String(text).split('\n')) { let line = ''; for (const w of para.split(' ')) { const tst = line ? line + ' ' + w : w; if (ctx.measureText(tst).width > maxWidth && line) { lines.push(line); line = w; } else line = tst; } lines.push(line); }
  const lh = size * 1.3, wmax = Math.max(...lines.map(l => ctx.measureText(l).width));
  ctx.fillStyle = bg; ctx.fillRect(x - 14, y - size - 8, wmax + 28, lines.length * lh + 14);
  ctx.fillStyle = color; lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh - 4)); ctx.restore();
}

/* load images and JSON next to the page, then build */
function load(assets, build) {
  const s = { duration: 1, seek: async () => {} };
  const one = u => /\.(png|jpe?g|webp|gif)$/i.test(u) ? new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('cannot load ' + u)); im.src = u; })
    : new Promise((ok, no) => { const x = new XMLHttpRequest(); x.open('GET', u); x.onload = () => { try { ok(JSON.parse(x.responseText)); } catch (e) { no(new Error('bad JSON in ' + u)); } }; x.onerror = () => no(new Error('cannot load ' + u + ' — render through render.py, or serve the folder')); x.send(); });
  const keys = Object.keys(assets || {});
  s.ready = Promise.all(keys.map(k => one(assets[k]))).then(vs => { const A = Object.fromEntries(keys.map((k, i) => [k, vs[i]])); const real = build(A); Object.assign(s, real); return real.ready; });
  return s;
}

window.Collage = { create, load, source, finish, typeset, treat, FONTS, BOARDS, cl, seg, lerp, oc, io, sm, back, hash, rng, fbm, W, H };
})();
