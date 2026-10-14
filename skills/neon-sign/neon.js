/* neon.js — real neon signs on a canvas: glass tubes bent from text or drawings, a wall they light up, the hardware that holds them,
   seeded ignition flicker, wet-ground reflections, and the hum and clicks that go with every tube.

   window.__scene = Neon.scene(async () => {
     const S = Neon.stage({ width: 1080, height: 1920 });
     const word = await Neon.text('OPEN', { font: '500 260px "Futura"', x: 540, y: 800 });
     const sign = Neon.sign({ stage: S, wall: Neon.wall('brick', { w: 1080, h: 1920 }), tubes: Neon.tubes(word, { gas: 'red', at: 2 }) });
     return { duration: 12, draw: t => sign.draw(t), sounds: sign.sounds(12) };
   });
*/
(function () {
'use strict';
const TAU = Math.PI * 2, FPS = 30;
const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
const seg = (t, a, z) => cl((t - a) / (z - a));
const lerp = (a, z, u) => a + (z - a) * u;
const sm = u => { u = cl(u); return u * u * (3 - 2 * u); };
const io = u => { u = cl(u); return u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
const oc = u => 1 - Math.pow(1 - cl(u), 3);
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function rng(seed) { let a = (Math.floor(seed * 7919) ^ 0x9E3779B9) >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
const rgb = h => { if (Array.isArray(h)) return h; h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const rgba = (h, a = 1) => { const [r, g, b] = rgb(h); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; };
const mix = (a, b, u) => { a = rgb(a); b = rgb(b); return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; };
const shade = (h, k) => rgb(h).map(v => cl(v * k, 0, 255));

/* ---------- gases: what a lit tube looks like (tube wall, the white-hot core, the halo) ---------- */
const GAS = {
  red:       { tube: '#ff3a1c', core: '#ffd6c0', glow: '#ff1e0a' },
  orange:    { tube: '#ff7a18', core: '#ffe4b8', glow: '#ff5200' },
  gold:      { tube: '#ffbe2e', core: '#fff3c4', glow: '#ff9a10' },
  yellow:    { tube: '#ffe03a', core: '#fffbd6', glow: '#ffc400' },
  warmwhite: { tube: '#ffd6a0', core: '#fffaf0', glow: '#ffae60' },
  white:     { tube: '#e6efff', core: '#ffffff', glow: '#9cc2ff' },
  pink:      { tube: '#ff4f9e', core: '#ffe2f0', glow: '#ff2386' },
  magenta:   { tube: '#ff3ad8', core: '#ffe0fa', glow: '#e010c8' },
  purple:    { tube: '#a24cff', core: '#efdcff', glow: '#7424ff' },
  blue:      { tube: '#3c68ff', core: '#d4e2ff', glow: '#2040ff' },
  ice:       { tube: '#5cd2ff', core: '#e8fbff', glow: '#1ea4ff' },
  aqua:      { tube: '#1ef0d2', core: '#dcfff8', glow: '#00ccb0' },
  green:     { tube: '#40ff6e', core: '#e4ffe8', glow: '#10dc48' },
  lime:      { tube: '#b6ff3c', core: '#f4ffd8', glow: '#86f000' },
};
const gasOf = g => typeof g === 'string' ? (GAS[g] || { tube: g, core: rgba(mix(g, '#ffffff', .75)), glow: g }) : g;

/* ---------- geometry: polylines [[x, y], …] ---------- */
const plen = p => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
function cum(p) { const c = [0]; for (let i = 1; i < p.length; i++) c.push(c[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return c; }
function resample(p, step) {
  if (p.length < 2) return p.slice(); const c = cum(p), L = c[c.length - 1], n = Math.max(1, Math.round(L / step)), out = []; let j = 0;
  for (let k = 0; k <= n; k++) { const s = L * k / n; while (j < p.length - 2 && c[j + 1] < s) j++; const u = (s - c[j]) / ((c[j + 1] - c[j]) || 1); out.push([lerp(p[j][0], p[j + 1][0], u), lerp(p[j][1], p[j + 1][1], u)]); }
  return out;
}
function smoothP(p, r, closed) {
  if (r < 1 || p.length < 3) return p; const n = p.length, out = [];
  for (let i = 0; i < n; i++) {
    if (!closed && (i === 0 || i === n - 1)) { out.push(p[i]); continue; }
    const rr = closed ? r : Math.min(r, i, n - 1 - i); let sx = 0, sy = 0, k = 0;
    for (let j = -rr; j <= rr; j++) { const q = p[closed ? (i + j + n) % n : i + j]; sx += q[0]; sy += q[1]; k++; }
    out.push([sx / k, sy / k]);
  }
  return out;
}
function subpath(p, c, a, b) {                                   // the part of p between arc lengths a and b
  const out = []; if (b <= a) return out; let i = 0;
  while (i < p.length - 1 && c[i + 1] < a) i++;
  const at = (s) => { while (i < p.length - 2 && c[i + 1] < s) i++; const u = (s - c[i]) / ((c[i + 1] - c[i]) || 1); return [lerp(p[i][0], p[i + 1][0], cl(u)), lerp(p[i][1], p[i + 1][1], cl(u))]; };
  out.push(at(a)); for (let k = i + 1; k < p.length && c[k] < b; k++) out.push(p[k]); out.push(at(b)); return out;
}
const closedP = p => p.length > 2 && Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 1.5;
const xf = (paths, f) => paths.map(p => p.map(f));
function bbox(paths) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const p of paths) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }; }

/* ---------- raster → tubes: skeleton (single line) or contour (double line) ---------- */
function binarize(cv, thr = 110) { const { width: w, height: h } = cv; const d = cv.getContext('2d').getImageData(0, 0, w, h).data, g = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) g[i] = d[i * 4 + 3] > thr ? 1 : 0; return g; }
function distance(g, w, h) {                                     // chamfer distance to the outside, in px
  const D = new Float32Array(w * h), B = 1e6, r2 = Math.SQRT2;
  for (let i = 0; i < w * h; i++) D[i] = g[i] ? B : 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (!D[i]) continue; D[i] = Math.min(D[i], D[i - 1] + 1, D[i - w] + 1, D[i - w - 1] + r2, D[i - w + 1] + r2); }
  for (let y = h - 2; y > 0; y--) for (let x = w - 2; x > 0; x--) { const i = y * w + x; if (!D[i]) continue; D[i] = Math.min(D[i], D[i + 1] + 1, D[i + w] + 1, D[i + w + 1] + r2, D[i + w - 1] + r2); }
  return D;
}
function thin(g, w, h) {                                          // Zhang–Suen, then remove staircase corners
  const del = []; let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x; if (!g[i]) continue;
        const p2 = g[i - w], p3 = g[i - w + 1], p4 = g[i + 1], p5 = g[i + w + 1], p6 = g[i + w], p7 = g[i + w - 1], p8 = g[i - 1], p9 = g[i - w - 1];
        const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9; if (B < 2 || B > 6) continue;
        const A = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2); if (A !== 1) continue;
        if (pass === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8) : (p2 && p4 && p8) || (p2 && p6 && p8)) continue;
        del.push(i);
      }
      for (const i of del) g[i] = 0; if (del.length) changed = true;
    }
  }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!g[i]) continue;
    const N = g[i - w], E = g[i + 1], S = g[i + w], W = g[i - 1], NE = g[i - w + 1], SE = g[i + w + 1], SW = g[i + w - 1], NW = g[i - w - 1];
    if ((N && E && !S && !W && !SW) || (E && S && !W && !N && !NW) || (S && W && !N && !E && !NE) || (W && N && !E && !S && !SE)) g[i] = 0;
  }
  return g;
}
function skeletonPaths(g, w, h, D, o) {
  const NB = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1]];
  const nbrs = i => { const x = i % w, y = (i / w) | 0, out = []; for (const [dx, dy] of NB) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && g[Y * w + X]) out.push(Y * w + X); } return out; };
  const node = new Int32Array(w * h).fill(-1), nodes = [];
  // half the stroke width, from the distance transform along the skeleton
  let hw = 0, nh = 0; for (let i = 0; i < w * h; i++) if (g[i]) { hw += D[i]; nh++; } hw = nh ? hw / nh : 4;
  for (let i = 0; i < w * h; i++) {
    if (!g[i] || node[i] >= 0) continue; const n = nbrs(i).length; if (n === 2) continue;
    if (n === 1 || n === 0) { node[i] = nodes.length; nodes.push({ x: i % w, y: (i / w) | 0, end: true, px: [i] }); continue; }
    const id = nodes.length, px = [i]; node[i] = id; const st = [i];                 // a junction: gather the cluster
    while (st.length) { const j = st.pop(); for (const k of nbrs(j)) if (node[k] < 0 && nbrs(k).length >= 3) { node[k] = id; px.push(k); st.push(k); } }
    nodes.push({ x: px.reduce((s, k) => s + k % w, 0) / px.length, y: px.reduce((s, k) => s + ((k / w) | 0), 0) / px.length, end: false, px });
  }
  const seen = new Uint8Array(w * h), edges = [], pairDone = new Set();
  const P = i => [i % w, (i / w) | 0];
  for (let a = 0; a < nodes.length; a++) for (const s of nodes[a].px) for (const q of nbrs(s)) {
    if (node[q] === a) continue;
    if (node[q] >= 0) { const key = Math.min(a, node[q]) + ':' + Math.max(a, node[q]); if (!pairDone.has(key)) { pairDone.add(key); edges.push({ a, b: node[q], pts: [[nodes[a].x, nodes[a].y], [nodes[node[q]].x, nodes[node[q]].y]] }); } continue; }
    if (seen[q]) continue;
    const pts = [[nodes[a].x, nodes[a].y]]; let prev = s, cur = q, b = -1;
    for (let guard = 0; guard < w * h; guard++) {
      seen[cur] = 1; pts.push(P(cur));
      const ns = nbrs(cur).filter(k => k !== prev);
      const nodeHit = ns.find(k => node[k] >= 0 && (node[k] !== a || pts.length > 3));
      if (nodeHit !== undefined) { b = node[nodeHit]; pts.push([nodes[b].x, nodes[b].y]); break; }
      const free = ns.filter(k => !seen[k] && node[k] < 0); if (!free.length) break;
      prev = cur; cur = free.find(k => Math.abs(k - prev) === 1 || Math.abs(k - prev) === w) ?? free[0];
    }
    edges.push({ a, b, pts });
  }
  for (let i = 0; i < w * h; i++) if (g[i] && !seen[i] && node[i] < 0) {          // loops with no node (an O)
    const pts = []; let prev = -1, cur = i;
    for (let guard = 0; guard < w * h; guard++) { seen[cur] = 1; pts.push(P(cur)); const nx = nbrs(cur).find(k => !seen[k] && k !== prev); if (nx === undefined) break; prev = cur; cur = nx; }
    if (pts.length > 4) { pts.push(pts[0]); edges.push({ a: -1, b: -1, pts, closed: true }); }
  }
  // prune short spurs off junctions
  const prune = o.prune ?? hw * 1.6;
  for (let it = 0; it < 3; it++) {
    const deg = new Map(); const inc = n => n >= 0 && deg.set(n, (deg.get(n) || 0) + 1);
    for (const e of edges) if (!e.dead) { inc(e.a); inc(e.b); }
    for (const e of edges) {
      if (e.dead || e.closed) continue; const da = deg.get(e.a) || 0, db = deg.get(e.b) || 0, L = plen(e.pts);
      if (L < prune && ((da === 1 && db >= 3) || (db === 1 && da >= 3))) e.dead = true;
      if (L < hw * .8 && da === 1 && db === 1) e.dead = true;
    }
  }
  let live = edges.filter(e => !e.dead);
  // merge through nodes: degree 2 always; at junctions the straightest pairs
  const dirAt = (e, n) => { const p = e.a === n ? e.pts : e.pts.slice().reverse(); const k = Math.min(p.length - 1, Math.max(2, Math.round(hw * 2))); const dx = p[k][0] - p[0][0], dy = p[k][1] - p[0][1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
  for (let guard = 0; guard < 4000; guard++) {
    const at = new Map(); for (const e of live) { if (e.closed) continue; for (const n of [e.a, e.b]) if (n >= 0) { if (!at.has(n)) at.set(n, []); at.get(n).push(e); } }
    let did = false;
    for (const [n, es] of at) {
      if (es.length < 2) continue; let best = null;
      if (es.length === 2) best = [es[0], es[1]];
      else { let bd = .5; for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) { if (es[i] === es[j]) continue; const u = dirAt(es[i], n), v = dirAt(es[j], n), d = -(u[0] * v[0] + u[1] * v[1]); if (d > bd) { bd = d; best = [es[i], es[j]]; } } }
      if (!best) continue; const [e1, e2] = best;
      if (e1 === e2) { e1.closed = true; e1.a = e1.b = -1; did = true; break; }
      const p1 = e1.b === n ? e1.pts : e1.pts.slice().reverse(), p2 = e2.a === n ? e2.pts : e2.pts.slice().reverse();
      const o1 = e1.b === n ? e1.a : e1.b, o2 = e2.a === n ? e2.b : e2.a;
      const ne = { a: o1, b: o2, pts: p1.concat(p2.slice(1)) };
      if (o1 === n && o2 === n) { ne.closed = true; ne.a = ne.b = -1; }
      live = live.filter(e => e !== e1 && e !== e2); live.push(ne); did = true; break;
    }
    if (!did) break;
  }
  // stretch the ends back out to where the stroke ended, smooth the pixel steps into bends
  const ext = o.extend ?? hw * .6, bend = o.bend ?? Math.max(2, hw * 1.2);
  const out = [];
  for (const e of live) {
    let p = resample(e.pts, 1.5);
    if (!e.closed) {
      const deg = n => n >= 0 && nodes[n].end;
      const grow = (p, atStart) => { const q = atStart ? p : p.slice().reverse(); const k = Math.min(q.length - 1, Math.max(2, Math.round(hw * 1.5))); const dx = q[0][0] - q[k][0], dy = q[0][1] - q[k][1], L = Math.hypot(dx, dy) || 1; q.unshift([q[0][0] + dx / L * ext, q[0][1] + dy / L * ext]); return atStart ? q : q.reverse(); };
      if (deg(e.a)) p = grow(p, true); if (deg(e.b)) p = grow(p, false);
    }
    p = smoothP(resample(p, 1.5), Math.round(bend / 1.5), e.closed);
    if (plen(p) < (o.minLen ?? hw * 2)) continue;
    out.push(resample(p, 3));
  }
  return { paths: out, hw };
}
function contourPaths(g, w, h, o) {                             // marching squares → closed loops
  const segs = new Map(), key = (x, y) => x + ',' + y, add = (a, b) => { const k = key(...a); if (!segs.has(k)) segs.set(k, []); segs.get(k).push(b); const k2 = key(...b); if (!segs.has(k2)) segs.set(k2, []); segs.get(k2).push(a); };
  const v = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : g[y * w + x];
  for (let y = -1; y < h; y++) for (let x = -1; x < w; x++) {
    const c = v(x, y) | v(x + 1, y) << 1 | v(x + 1, y + 1) << 2 | v(x, y + 1) << 3; if (c === 0 || c === 15) continue;
    const T = [x + .5, y], R = [x + 1, y + .5], B = [x + .5, y + 1], L = [x, y + .5];
    const map = { 1: [[L, T]], 2: [[T, R]], 3: [[L, R]], 4: [[R, B]], 5: [[L, T], [R, B]], 6: [[T, B]], 7: [[L, B]], 8: [[B, L]], 9: [[B, T]], 10: [[T, R], [B, L]], 11: [[B, R]], 12: [[R, L]], 13: [[R, T]], 14: [[T, L]] }[c];
    for (const [a, b] of map) add(a, b);
  }
  const used = new Set(), loops = [];
  for (const [k] of segs) {
    if (used.has(k)) continue; const loop = []; let cur = k, prev = null;
    for (let guard = 0; guard < 1e6; guard++) { used.add(cur); const [x, y] = cur.split(',').map(Number); loop.push([x, y]); const nx = segs.get(cur).map(p => key(...p)).find(q => q !== prev && !used.has(q)); if (!nx) break; prev = cur; cur = nx; }
    if (loop.length > 8) { loop.push(loop[0]); loops.push(loop); }
  }
  const bend = o.bend ?? 3;
  return loops.map(p => resample(smoothP(resample(p, 1.5), Math.round(bend / 1.5), true), 3)).filter(p => plen(p) > (o.minLen ?? 12));
}
function trace(cv, o) {                                          // a canvas with ink in its alpha → tube paths in canvas pixels
  const w = cv.width, h = cv.height, g = binarize(cv);
  const D = distance(g, w, h);
  if (o.mode === 'outline') {
    const v = []; for (let i = 0; i < w * h; i += 3) if (g[i]) v.push(D[i]); v.sort((p, q) => p - q); const hw = v.length ? v[Math.floor(v.length * .8)] : 4;   // about half the stroke width
    const inset = Math.min(o.inset ?? 0, hw * .45); const g2 = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) g2[i] = D[i] > inset ? 1 : 0;
    return { paths: contourPaths(g2, w, h, o) };
  }
  return skeletonPaths(thin(g, w, h), w, h, D, o);
}

/* text → tube paths. (x, y) is the centre of the ink; align 'left' | 'right' puts x at that edge.
   mode 'line' (default): one tube down the middle of each stroke — use a light or regular weight, a rounded face, a script.
   mode 'outline': a tube around each stroke, pulled in by `inset` px — use a heavy face; reads as the classic double-line sign.
   vertical: true stacks the characters top to bottom, `gap` apart. Returns { paths, chars: [{ ch, paths, box }], box }. */
async function text(str, o = {}) {
  const font = o.font || '400 200px "PingFang SC"', size = parseFloat((font.match(/([\d.]+)px/) || [0, 200])[1]);
  try { await document.fonts.load(font, str); } catch (e) {}
  const k = o.res ?? cl(260 / size, 1, 4);                       // raster scale: small text is traced larger, then scaled back
  const sp = o.spacing ?? 0;
  const one = (s) => {
    const m0 = canvas(4, 4).getContext('2d'); m0.font = font; try { m0.letterSpacing = sp + 'px'; } catch (e) {} const m = m0.measureText(s);
    const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent, left = m.actualBoundingBoxLeft, right = m.actualBoundingBoxRight, pad = size * .25;
    const cv = canvas((left + right + 2 * pad) * k, (asc + desc + 2 * pad) * k), g = cv.getContext('2d');
    g.scale(k, k); g.font = font; try { g.letterSpacing = sp + 'px'; } catch (e) {} g.fillStyle = '#000'; g.textBaseline = 'alphabetic'; g.fillText(s, pad + left, pad + asc);
    const r = trace(cv, { mode: o.mode, inset: (o.inset ?? 0) * k, bend: o.bend != null ? o.bend * k : undefined, prune: o.prune != null ? o.prune * k : undefined, minLen: o.minLen != null ? o.minLen * k : undefined, extend: o.extend != null ? o.extend * k : undefined });
    const paths = r.paths.map(p => p.map(([x, y]) => [x / k - pad - left, y / k - pad - asc]));   // origin at the text start, on the baseline
    const starts = [...s].map((_, i) => { m0.font = font; return m0.measureText([...s].slice(0, i).join('')).width; });
    return { paths, ink: { x: -left, y: -asc, w: left + right, h: asc + desc }, starts, width: m.width };
  };
  let chars = [];
  if (o.vertical) {
    const gap = o.gap ?? size * 1.08, list = [...str]; let y = o.y - gap * (list.length - 1) / 2;
    for (const ch of list) { const r = one(ch); const cx = r.ink.x + r.ink.w / 2, cy = r.ink.y + r.ink.h / 2;
      const paths = xf(r.paths, ([x, yy]) => [x - cx + o.x, yy - cy + y]); chars.push({ ch, paths, box: bbox(paths) }); y += gap; }
  } else {
    const r = one(str), list = [...str];
    const ax = o.align === 'left' ? -r.ink.x : o.align === 'right' ? -(r.ink.x + r.ink.w) : -(r.ink.x + r.ink.w / 2), ay = -(r.ink.y + r.ink.h / 2);
    const paths = xf(r.paths, ([x, y]) => [x + ax + o.x, y + ay + o.y]);
    chars = list.map((ch, i) => ({ ch, paths: [], x0: r.starts[i] + ax + o.x, x1: (i + 1 < list.length ? r.starts[i + 1] : r.width) + ax + o.x }));
    for (const p of paths) { const b = bbox([p]); let best = 0, bd = 1e9; chars.forEach((c, i) => { const d = Math.abs((c.x0 + c.x1) / 2 - b.cx); if (b.cx >= c.x0 && b.cx <= c.x1) { if (d < bd) { bd = d - 1e6; best = i; } } else if (d < bd) { bd = d; best = i; } }); chars[best].paths.push(p); }
    chars = chars.filter(c => c.ch.trim() && c.paths.length).map(c => ({ ch: c.ch, paths: c.paths, box: bbox(c.paths) }));
  }
  const all = chars.flatMap(c => c.paths);
  return { paths: all, chars, box: bbox(all) };
}

/* any drawing → tube paths: draw(g) paints with fill or thick strokes on a w×h canvas; traced like text */
function drawn(draw, o = {}) {
  const w = o.w || 1080, h = o.h || 1920, k = o.res ?? 1, cv = canvas(w * k, h * k), g = cv.getContext('2d');
  g.scale(k, k); g.fillStyle = g.strokeStyle = '#000'; g.lineCap = g.lineJoin = 'round'; draw(g);
  const r = trace(cv, { mode: o.mode, inset: (o.inset ?? 0) * k, bend: o.bend != null ? o.bend * k : undefined, prune: o.prune != null ? o.prune * k : undefined, minLen: o.minLen != null ? o.minLen * k : undefined });
  const paths = r.paths.map(p => p.map(([x, y]) => [x / k, y / k])); return { paths, box: bbox(paths) };
}

/* SVG path data → polylines, placed at (x, y) with `scale` (default: the path's own units) */
function svg(d, o = {}) {
  const toks = d.match(/[a-zA-Z]|-?[\d.]+(?:e-?\d+)?/g) || [], paths = []; let i = 0, cmd = '', cur = [0, 0], start = [0, 0], p = null, lastC = null, lastQ = null;
  const num = () => parseFloat(toks[i++]), step = o.step || 4, sc = o.scale ?? 1, ox = o.x ?? 0, oy = o.y ?? 0;
  const push = (pt) => { if (!p) { p = [cur.slice()]; paths.push(p); } p.push(pt); cur = pt; };
  const bez = (pts, n) => { for (let k = 1; k <= n; k++) { const u = k / n; let q = pts.map(x => x.slice()); while (q.length > 1) q = q.slice(1).map((b, j) => [lerp(q[j][0], b[0], u), lerp(q[j][1], b[1], u)]); push(q[0]); } };
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), R = (x, y) => rel ? [cur[0] + x, cur[1] + y] : [x, y];
    if (C === 'M') { const pt = R(num(), num()); p = null; cur = pt; start = pt; cmd = rel ? 'l' : 'L'; lastC = lastQ = null; continue; }
    if (C === 'Z') { push(start.slice()); p = null; lastC = lastQ = null; continue; }
    if (C === 'L') { push(R(num(), num())); }
    else if (C === 'H') { const x = num(); push([rel ? cur[0] + x : x, cur[1]]); }
    else if (C === 'V') { const y = num(); push([cur[0], rel ? cur[1] + y : y]); }
    else if (C === 'C' || C === 'S') {
      const c1 = C === 'C' ? R(num(), num()) : lastC ? [2 * cur[0] - lastC[0], 2 * cur[1] - lastC[1]] : cur.slice(), c2 = R(num(), num()), e = R(num(), num());
      const n = Math.max(4, Math.ceil(plen([cur, c1, c2, e]) * sc / step)); bez([cur.slice(), c1, c2, e], n); lastC = c2; lastQ = null; continue;
    } else if (C === 'Q' || C === 'T') {
      const c1 = C === 'Q' ? R(num(), num()) : lastQ ? [2 * cur[0] - lastQ[0], 2 * cur[1] - lastQ[1]] : cur.slice(), e = R(num(), num());
      bez([cur.slice(), c1, e], Math.max(4, Math.ceil(plen([cur, c1, e]) * sc / step))); lastQ = c1; lastC = null; continue;
    } else if (C === 'A') {
      let rx = Math.abs(num()), ry = Math.abs(num()); const phi = num() * Math.PI / 180, fa = num(), fs = num(), e = R(num(), num());
      const [x1, y1] = cur, [x2, y2] = e, cp = Math.cos(phi), sp = Math.sin(phi), dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
      const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy; const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry); if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
      const sgn = fa === fs ? -1 : 1, num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, co = sgn * Math.sqrt(Math.max(0, num2 / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
      const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx, cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
      const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
      const th = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry); let dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
      if (!fs && dth > 0) dth -= TAU; if (fs && dth < 0) dth += TAU;
      const n = Math.max(6, Math.ceil(Math.abs(dth) * Math.max(rx, ry) * sc / step));
      for (let k = 1; k <= n; k++) { const a = th + dth * k / n; push([cx + rx * Math.cos(a) * cp - ry * Math.sin(a) * sp, cy + rx * Math.cos(a) * sp + ry * Math.sin(a) * cp]); }
    } else { i++; continue; }
    lastC = lastQ = null;
  }
  const out = paths.filter(p => p.length > 1).map(p => resample(p.map(([x, y]) => [x * sc + ox, y * sc + oy]), 3));
  return { paths: out, box: bbox(out) };
}
const circle = (cx, cy, r, a0 = 0, a1 = TAU) => { const n = Math.max(12, Math.ceil(Math.abs(a1 - a0) * r / 3)), p = []; for (let k = 0; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return p; };
function rect(x, y, w, h, r = 0) { r = Math.min(r, w / 2, h / 2); const p = [];
  const arc = (cx, cy, a0) => { for (let k = 0; k <= 8; k++) { const a = a0 + Math.PI / 2 * k / 8; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  if (r > 0) { arc(x + w - r, y + r, -Math.PI / 2); arc(x + w - r, y + h - r, 0); arc(x + r, y + h - r, Math.PI / 2); arc(x + r, y + r, Math.PI); p.push(p[0].slice()); }
  else p.push([x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]);
  return resample(p, 3); }
/* a cable from a to b hanging `sag` px below the straight line → sign({ wires: [cable(…), …] }) */
const cable = (a, b, sag = 40, o = {}) => ({ pts: [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag], b], sag: true, ...o });
const line = (pts, bendR = 0) => resample(bendR ? smoothP(resample(pts, 2), Math.round(bendR / 2), false) : pts, 3);

/* chain separate strokes into one tube: painted-black jumps between them, electrodes only at the two ends.
   Returns runs [{ pts, lit }]. Strokes farther apart than maxJump start a new tube (→ an array of tubes' runs). */
function join(paths, o = {}) {
  const maxJump = o.maxJump ?? 1e9, left = paths.map(p => p.slice()), tubes = [];
  const order = o.order || ((a, b) => (a[0][1] + a[0][0] * .3) - (b[0][1] + b[0][0] * .3));
  while (left.length) {
    left.sort((a, b) => order(a, b)); let cur = left.shift(); const runs = [{ pts: cur, lit: true }];
    if (closedP(cur)) { /* keep */ }
    for (;;) {
      const end = runs[runs.length - 1].pts[runs[runs.length - 1].pts.length - 1]; let best = -1, bd = 1e9, rev = false, rot = -1;
      left.forEach((p, i) => {
        if (closedP(p)) { p.forEach((q, j) => { const d = Math.hypot(q[0] - end[0], q[1] - end[1]); if (d < bd) { bd = d; best = i; rot = j; rev = false; } }); }
        else { const d0 = Math.hypot(p[0][0] - end[0], p[0][1] - end[1]), d1 = Math.hypot(p[p.length - 1][0] - end[0], p[p.length - 1][1] - end[1]);
          if (d0 < bd) { bd = d0; best = i; rev = false; rot = -1; } if (d1 < bd) { bd = d1; best = i; rev = true; rot = -1; } }
      });
      if (best < 0 || bd > maxJump) break;
      let p = left.splice(best, 1)[0];
      if (rot >= 0) { p = p.slice(rot, -1).concat(p.slice(0, rot + 1)); } else if (rev) p = p.slice().reverse();
      if (bd > 2) runs.push({ pts: resample([end, p[0]], 3), lit: false });
      runs.push({ pts: p, lit: true });
    }
    tubes.push(runs);
  }
  return tubes;
}

/* ---------- ignition: a seeded frame-by-frame table, so every frame is a pure function of t ----------
   style  'snap'     one white frame, dark, then up in a few frames (a healthy tube)
          'stutter'  2–5 bursts of 1–4 frames before it holds (the usual)
          'stubborn' a bad contact: only a short length by the electrode glows and twitches for a second or two, then the whole tube catches
          'faulty'   comes on, then drops out for a frame or three every few seconds
          'warm'     comes on dim and pale and fills to full over ~1.5 s (cold argon/mercury blues)
   off    a time to switch it off (a closing sign); level(t) multiplies on top (chasers, blinking borders). */
function ignition(o = {}) {
  const r = rng((o.seed ?? 1) * 31 + 7), style = o.style || 'stutter', at = o.at ?? 0, off = o.off ?? Infinity;
  const fr = []; const F = (b, reach = 1, n = 1, arc = 0) => { for (let i = 0; i < n; i++) fr.push({ b, reach, arc }); };
  if (style === 'snap') { F(.95, 1, 1, 1); F(0, 1, 1 + (r() * 2 | 0)); F(.35); F(.65); F(.88); }
  else if (style === 'warm') { F(.9, 1, 1, 1); F(0, 1, 2); const n = Math.round(1.5 * FPS); for (let i = 0; i < n; i++) F(.28 + .72 * sm(i / n) + (r() - .5) * .04 * (1 - i / n)); }
  else if (style === 'stubborn') {
    const n = Math.round((o.trying ?? (.9 + r() * 1.1)) * FPS); let i = 0;
    while (i < n) { const h = 1 + (r() * 3 | 0), u = r(); if (u < .68) F(.3 + r() * .35, .04 + r() * .2, h, 1); else if (u < .9) F(0, 1, h); else F(.85, 1, 1, 1); i += h; }
    F(0, 1, 2 + (r() * 4 | 0)); F(.9, 1, 1, 1); F(.15); F(.55); F(.85);
  } else {
    const n = o.bursts ?? (2 + (r() * 4 | 0));
    for (let k = 0; k < n; k++) { F(.35 + r() * .65, 1, 1 + (r() * 3 | 0), 1); F(0, 1, 2 + (r() * (k === 0 ? 8 : 5) | 0)); }
    F(.92, 1, 1, 1); F(.6); F(.9);
  }
  const drops = [];                                                 // faulty: dropouts after it holds
  if (style === 'faulty') { let s = fr.length / FPS + .8 + r() * 1.5; while (s < 600) { const n = 1 + (r() * 3 | 0), lv = .05 + r() * .35; drops.push([s, n, lv]); if (r() < .35) drops.push([s + (n + 2) / FPS, 1 + (r() * 2 | 0), .1 + r() * .3]); s += (o.every ?? 2.5) * (.5 + r()); } }
  const level = o.level || null;
  function at_(t) {
    if (t < at) return { b: 0, reach: 1, arc: 0 };
    const k = Math.floor((t - at) * FPS + 1e-6); let s = k < fr.length ? fr[k] : { b: 1, reach: 1, arc: 0 };
    if (k >= fr.length && drops.length) { const u = t - at; for (const [d0, n, lv] of drops) { if (u < d0) break; if (u < d0 + n / FPS) { s = { b: lv, reach: 1, arc: lv < .2 ? 0 : 1 }; break; } } }
    if (t >= off) { const j = Math.floor((t - off) * FPS + 1e-6); s = { b: j === 0 ? s.b * .45 : j === 1 ? s.b * .12 : 0, reach: 1, arc: 0 }; }
    const L = level ? level(t) : 1; return { b: s.b * L, reach: s.reach, arc: s.arc * L };
  }
  at_.start = at; at_.settled = at + fr.length / FPS; return at_;
}

/* a tube (or a few joined into one): paths or runs → { runs, gas, width, state(t), ends, supports } */
function tube(src, o = {}) {
  let runs;
  if (src && src.runs) runs = src.runs;
  else if (Array.isArray(src) && src.length && src[0] && src[0].pts) runs = src;
  else { const paths = src.paths || src; runs = o.join === false ? paths.map((p, i) => ({ pts: p, lit: true, chain: i })) : join(paths, { maxJump: o.maxJump ?? Math.max(60, (o.width ?? 12) * 7) }).flatMap((ch, i) => ch.map(r => ({ ...r, chain: i }))); }
  runs = runs.map(r => ({ ...r, c: cum(r.pts) })); runs.forEach(r => r.L = r.c[r.c.length - 1]);
  const width = o.width ?? 12, gas = gasOf(o.gas || 'red');
  const litL = runs.filter(r => r.lit).reduce((s, r) => s + r.L, 0);
  const endDir = (p, atStart) => { const q = atStart ? p : p.slice().reverse(); const k = Math.min(q.length - 1, 4); const dx = q[0][0] - q[k][0], dy = q[0][1] - q[k][1], L = Math.hypot(dx, dy) || 1; return [q[0][0], q[0][1], dx / L, dy / L]; };
  const chains = []; runs.forEach(r => { const k = r.chain ?? 0; (chains[k] = chains[k] || []).push(r); });
  const ends = o.electrodes === false ? [] : chains.filter(Boolean).flatMap(ch => ch.length === 1 && closedP(ch[0].pts) ? [] : [endDir(ch[0].pts, true), endDir(ch[ch.length - 1].pts, false)]);
  const supports = [], spacing = o.supports ?? width * 16;
  if (spacing) for (const r of runs) if (r.lit && r.L > width * 8) { const n = Math.max(1, Math.round(r.L / spacing)); for (let k = 0; k < n; k++) { const s = r.L * (k + .5) / n, p = subpath(r.pts, r.c, s, s + 2); if (p.length > 1) supports.push([p[0][0], p[0][1], Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0])]); } }
  const state = ignition(o);
  const b = bbox(runs.map(r => r.pts));
  return { runs, gas, width, state, ends, supports, litL, box: b, name: o.name, glass: o.glass, ignition: o };
}
/* one tube per character (or per stroke group) of a text(), with per-character options: values or functions (i, ch) => value */
function tubes(t, o = {}) {
  const groups = t.chars || [{ paths: t.paths, ch: '' }];
  const val = (v, i, ch) => typeof v === 'function' ? v(i, ch) : v;
  return groups.map((g, i) => { const oo = {}; for (const k in o) oo[k] = k === 'level' ? o[k] : val(o[k], i, g.ch); if (typeof o.level === 'function' && o.level.length >= 2) oo.level = t2 => o.level(t2, i); if (oo.seed == null) oo.seed = i + 1; return tube(g.paths, oo); });
}

/* ---------- walls and floors: an albedo canvas (what the wall looks like in plain light) ---------- */
function wall(kind = 'brick', o = {}) {
  const W = o.w || 1080, H = o.h || 1920, q = o.res ?? 1.5, cv = canvas(W * q, H * q), g = cv.getContext('2d'), r = rng(o.seed ?? 3); g.scale(q, q);
  const blot = (n, rmin, rmax, col, amin, amax) => { for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H, rr = rmin + r() * (rmax - rmin), gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, rgba(col, amin + r() * (amax - amin))); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } };
  const speck = (n, x0, y0, w, h, cols, a, s = 2) => { for (let i = 0; i < n; i++) { g.fillStyle = rgba(cols[(r() * cols.length) | 0], a * (.4 + r() * .6)); const ss = s * (.5 + r()); g.fillRect(x0 + r() * w, y0 + r() * h, ss, ss); } };
  const streaks = (n, col, a) => { for (let i = 0; i < n; i++) { const x = r() * W, y = r() * H * .7, h = 80 + r() * 500, w = 3 + r() * 18, gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, rgba(col, a * r())); gr.addColorStop(1, rgba(col, 0)); g.fillStyle = gr; g.fillRect(x, y, w, h); } };
  if (kind === 'brick') {
    const [bw, bh] = o.brick || [W * .105, W * .042], mortar = o.mortar || '#7a736a', base = o.color || '#7a3b2a', m = Math.max(2, bh * .1);
    g.fillStyle = mortar; g.fillRect(0, 0, W, H); speck(W * H / 300, 0, 0, W, H, ['#000', '#fff'], .08);
    for (let row = 0; row * bh < H; row++) for (let col = -1; col * bw < W; col++) {
      const x = col * bw + (row % 2) * bw / 2 + m / 2, y = row * bh + m / 2, w = bw - m, h = bh - m, k = .72 + r() * .45, c = shade(base, k);
      if (r() < .05) c.forEach((v, j) => c[j] = v * .7 + 30);
      g.fillStyle = rgba(c); g.fillRect(x, y, w, h);
      speck(w * h / 40, x, y, w, h, ['#000', '#fff', '#3a1a10'], .12, 2.2);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x, y, w, 2); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y + h - 2.5, w, 2.5);
      if (r() < .15) { g.fillStyle = rgba(mortar, .9); const cx = r() < .5 ? x : x + w - 6, cy = r() < .5 ? y : y + h - 5; g.fillRect(cx, cy, 4 + r() * 6, 3 + r() * 5); }
    }
    blot(40, 80, 380, '#000', .05, .22); streaks(40, '#000', .18);
  } else if (kind === 'concrete') {
    const base = o.color || '#7b7873'; g.fillStyle = base; g.fillRect(0, 0, W, H);
    blot(260, 30, 320, '#000', .02, .09); blot(160, 30, 260, '#fff', .02, .07); speck(W * H / 25, 0, 0, W, H, ['#000', '#fff'], .1, 1.6);
    const pw = o.panel?.[0] ?? W * .5, ph = o.panel?.[1] ?? H * .17;
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; for (let x = pw; x < W; x += pw) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = ph; y < H; y += ph) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    for (let y = ph / 2; y < H; y += ph) for (let x = pw / 4; x < W; x += pw / 2) { g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(x, y - 2, 6, Math.PI, TAU); g.fill(); }
    streaks(70, '#000', .16); streaks(14, '#5a3a1a', .2);
  } else if (kind === 'wood') {
    const base = o.color || '#6e4a2f', ph = o.plank ?? H * .055, vertical = !!o.vertical;
    if (vertical) { g.translate(W, 0); g.rotate(Math.PI / 2); } const LW = vertical ? H : W, LH = vertical ? W : H;
    for (let y = 0; y < LH; y += ph) {
      g.fillStyle = rgba(shade(base, .75 + r() * .4)); g.fillRect(0, y, LW, ph);
      for (let k = 0; k < 34; k++) { const yy = y + r() * ph, a = .05 + r() * .14, f = .002 + r() * .006, ph2 = r() * 9; g.strokeStyle = rgba(r() < .7 ? '#000' : '#fff', a * (r() < .7 ? 1 : .5)); g.lineWidth = .6 + r() * 1.6; g.beginPath(); for (let x = 0; x <= LW; x += 24) { const yv = yy + Math.sin(x * f + ph2) * ph * .08; x ? g.lineTo(x, yv) : g.moveTo(x, yv); } g.stroke(); }
      if (r() < .5) { const kx = r() * LW, ky = y + ph * (.3 + r() * .4); g.strokeStyle = 'rgba(30,15,5,.4)'; for (let j = 1; j < 5; j++) { g.lineWidth = 1.2; g.beginPath(); g.ellipse(kx, ky, j * 7, j * 3, 0, 0, TAU); g.stroke(); } }
      g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(0, y + ph - 3, LW, 3); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, y, LW, 2);
      for (let x = 60 + r() * 100; x < LW; x += 380 + r() * 200) { g.fillStyle = 'rgba(20,20,20,.8)'; g.beginPath(); g.arc(x, y + ph * .25, 3, 0, TAU); g.arc(x, y + ph * .75, 3, 0, TAU); g.fill(); }
    }
    g.setTransform(q, 0, 0, q, 0, 0); blot(30, 100, 400, '#000', .05, .18);
  } else if (kind === 'tile') {
    const s = o.tile ?? W * .045, gr = o.grout || '#3c3a36', cols = o.colors || [o.color || '#d9d4c6'];
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += s) for (let x = 0; x < W; x += s) { const c = shade(cols[(r() * cols.length) | 0], .82 + r() * .26); g.fillStyle = rgba(c); g.fillRect(x + 1.5, y + 1.5, s - 3, s - 3); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 2, y + 2, s - 4, 2); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x + 2, y + s - 4, s - 4, 2); if (r() < .012) { g.fillStyle = gr; g.fillRect(x + 1.5, y + 1.5, s - 3, s - 3); } }
    blot(60, 60, 360, '#2a2418', .04, .2); streaks(50, '#2a2418', .22);
  } else if (kind === 'metal') {
    const base = o.color || '#2b2d30', sw = o.sheet ?? W * .25; g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += sw) { const gl = g.createLinearGradient(x, 0, x + sw, 0); gl.addColorStop(0, 'rgba(255,255,255,.05)'); gl.addColorStop(.5, 'rgba(0,0,0,.05)'); gl.addColorStop(1, 'rgba(255,255,255,.03)'); g.fillStyle = gl; g.fillRect(x, 0, sw, H); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, 0, 2, H); for (let y = 30; y < H; y += 90) { g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(x + 12, y, 4, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.15)'; g.beginPath(); g.arc(x + 11, y - 1, 2, 0, TAU); g.fill(); } }
    blot(50, 40, 300, '#000', .05, .2); streaks(30, '#5a3010', .2); speck(W * H / 80, 0, 0, W, H, ['#000', '#fff'], .06);
  } else {                                                          // 'paint': a painted wall, a little worn
    const base = o.color || '#3d4a52'; g.fillStyle = base; g.fillRect(0, 0, W, H);
    blot(220, 40, 300, '#000', .02, .08); blot(120, 40, 260, '#fff', .02, .06); speck(W * H / 40, 0, 0, W, H, ['#000', '#fff'], .07, 1.5);
    for (let i = 0; i < 18; i++) { const x = r() * W, y = r() * H, rr = 10 + r() * 50; g.fillStyle = rgba(shade(base, .7), .8); g.beginPath(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU, rv = rr * (.5 + r() * .7); k ? g.lineTo(x + Math.cos(a) * rv, y + Math.sin(a) * rv) : g.moveTo(x + Math.cos(a) * rv, y + Math.sin(a) * rv); } g.fill(); }
    streaks(50, '#000', .15);
  }
  if (o.paint) o.paint(g, r);
  return cv;
}
/* a floor below y: wet asphalt or stone with puddles. Returns { y, albedo, wet } canvases in the wall's size. */
function floor(y, o = {}) {
  const W = o.w || 1080, H = o.h || 1920, q = o.res ?? 1.5, r = rng(o.seed ?? 9);
  const al = canvas(W * q, H * q), g = al.getContext('2d'); g.scale(q, q);
  const wet = canvas(W / 4, H / 4), m = wet.getContext('2d'); m.scale(.25, .25);
  const kind = o.kind || 'asphalt', base = o.color || (kind === 'stone' ? '#55524c' : '#2c2c2e');
  g.fillStyle = base; g.fillRect(0, y, W, H - y);
  if (kind === 'stone') { const s = o.slab ?? W * .16; for (let yy = y; yy < H; yy += s * .55 * (1 + (yy - y) / (H - y))) { const sh = s * .55 * (1 + (yy - y) / (H - y)); for (let x = -(r() * s); x < W; x += s) { g.fillStyle = rgba(shade(base, .8 + r() * .35)); g.fillRect(x + 2, yy + 2, s - 4, sh - 4); } } }
  for (let i = 0; i < (W * (H - y)) / 30; i++) { g.fillStyle = rgba(r() < .5 ? '#000' : '#fff', .05 + r() * .08); g.fillRect(r() * W, y + r() * (H - y), 1.5 + r() * 2, 1.5 + r() * 2); }
  if (o.curb !== false) { g.fillStyle = rgba(shade(base, 1.7)); g.fillRect(0, y, W, 6); g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, y + 6, W, 10); }
  // puddles: soft flat blobs, wider than tall (we look at them from an angle)
  m.fillStyle = `rgba(255,255,255,${o.sheen ?? .35})`; m.fillRect(0, y, W, H - y);
  for (let i = 0; i < (o.puddles ?? 14); i++) { const px = r() * W, py = y + 20 + r() * (H - y), rx = 80 + r() * 380, ry = rx * (.12 + .18 * (py - y) / (H - y)); const gr = m.createRadialGradient(px, py, 0, px, py, rx); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.7, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); m.save(); m.translate(px, py); m.scale(1, ry / rx); m.translate(-px, -py); m.fillStyle = gr; m.beginPath(); m.arc(px, py, rx, 0, TAU); m.fill(); m.restore(); }
  return { y, albedo: al, wet, res: q };
}
/* draw a backing board / raceway / box onto an albedo with (g) → used in sign({ paint }) */
function panel(g, o) {
  const { x, y, w, h } = o, rr = o.radius ?? 8; g.save();
  g.fillStyle = 'rgba(0,0,0,.45)'; g.filter = 'blur(10px)'; g.beginPath(); g.roundRect(x + 6, y + 14, w, h, rr); g.fill(); g.filter = 'none';
  g.fillStyle = o.color || '#1c1d20'; g.beginPath(); g.roundRect(x, y, w, h, rr); g.fill();
  if (o.edge !== false) { g.strokeStyle = o.edge || 'rgba(255,255,255,.12)'; g.lineWidth = 3; g.beginPath(); g.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, rr); g.stroke(); }
  if (o.screws) for (const [sx, sy] of [[x + 16, y + 16], [x + w - 16, y + 16], [x + 16, y + h - 16], [x + w - 16, y + h - 16]]) { g.fillStyle = '#555'; g.beginPath(); g.arc(sx, sy, 5, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(sx - 1, sy - 1, 2, 0, TAU); g.fill(); }
  g.restore();
}

/* ---------- the sign: everything drawn in the right order ---------- */
function sign(o) {
  const S = o.stage, W = S.W, H = S.H, [WW, HH] = o.size || [W, H], q = o.res ?? 1.5, T = o.tubes.flat();
  const amb = o.ambient || '#28304a';                                   // the colour of the night on the wall
  const spill = o.spill ?? 2, bloom = o.bloom ?? 1;
  const fl = o.floor || null;
  // static albedo: wall, floor, the agent's own painting, hardware shadows, supports, boots, wires, a transformer
  const alb = canvas(WW * q, HH * q), g = alb.getContext('2d'); g.scale(q, q);
  if (o.wall) g.drawImage(o.wall, 0, 0, WW, HH); else { g.fillStyle = '#555'; g.fillRect(0, 0, WW, HH); }
  if (fl) g.drawImage(fl.albedo, 0, 0, WW, HH);
  if (o.paint) o.paint(g);
  const wires = (o.wires || []).map(w => Array.isArray(w) ? { pts: w } : w);
  const tubeShadow = (t, off, blur, a) => { g.save(); g.filter = `blur(${blur}px)`; g.strokeStyle = `rgba(0,0,0,${a})`; g.lineCap = g.lineJoin = 'round'; g.lineWidth = t.width * 1.1; g.beginPath(); for (const r of t.runs) { r.pts.forEach(([x, y], i) => i ? g.lineTo(x + off[0], y + off[1]) : g.moveTo(x + off[0], y + off[1])); } g.stroke(); g.restore(); };
  const sh = o.shadow ?? [.25, 1.1];                                        // cast shadow offset, in tube widths
  for (const t of T) tubeShadow(t, [t.width * sh[0], t.width * sh[1]], t.width * .7, o.shadowAlpha ?? .4);
  for (const w of wires) {                                                   // cables: shadow, body, a thin highlight
    const p = w.sag ? resample(w.pts.length === 3 ? (() => { const [a, c, b] = w.pts, out = []; for (let k = 0; k <= 24; k++) { const u = k / 24; out.push([(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * c[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * c[1] + u * u * b[1]]); } return out; })() : w.pts, 3) : resample(smoothP(resample(w.pts, 3), 4, false), 3);
    const wd = w.width ?? 6;
    g.save(); g.lineCap = g.lineJoin = 'round';
    g.filter = 'blur(4px)'; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = wd; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x + 3, y + 8) : g.moveTo(x + 3, y + 8)); g.stroke(); g.filter = 'none';
    g.strokeStyle = w.color || '#141416'; g.lineWidth = wd; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = wd * .25; g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x - wd * .2, y - wd * .25) : g.moveTo(x - wd * .2, y - wd * .25)); g.stroke(); g.restore();
  }
  if (o.box) { const b = o.box; panel(g, { x: b.x, y: b.y, w: b.w, h: b.h, radius: 4, color: b.color || '#3a3d40', screws: true }); if (b.label) { g.fillStyle = 'rgba(230,230,220,.55)'; g.font = `600 ${Math.round(b.h * .12)}px "Helvetica Neue", "PingFang SC"`; g.textAlign = 'center'; g.fillText(b.label, b.x + b.w / 2, b.y + b.h * .58); } }
  for (const t of T) {
    for (const [x, y] of t.supports) {                                      // tube supports: a round base on the wall
      const r0 = t.width * .75; g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(x + 2, y + 4, r0 + 2, 0, TAU); g.fill();
      g.fillStyle = '#4a4a4a'; g.beginPath(); g.arc(x, y, r0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.arc(x - r0 * .25, y - r0 * .3, r0 * .45, 0, TAU); g.fill();
    }
    for (const [x, y, dx, dy] of t.ends) {                                  // electrode boots where the tube turns into the wall
      const r0 = t.width * .95, bx = x + dx * t.width * .2, by = y + dy * t.width * .2;
      g.fillStyle = 'rgba(0,0,0,.55)'; g.beginPath(); g.arc(bx + 3, by + 6, r0 + 3, 0, TAU); g.fill();
      const gr = g.createRadialGradient(bx - r0 * .35, by - r0 * .4, 1, bx, by, r0); gr.addColorStop(0, '#5a5a5c'); gr.addColorStop(1, '#141415'); g.fillStyle = gr; g.beginPath(); g.arc(bx, by, r0, 0, TAU); g.fill();
    }
  }
  // per-frame scratch: half-res light, small light map, full-res light×albedo
  const A = canvas(W / 2, H / 2), a = A.getContext('2d'), G = [1, 2, 3].map(() => canvas(W / 2, H / 2)), Ls = canvas(W / 8, H / 8), ls = Ls.getContext('2d'), Lf = canvas(W, H), lf = Lf.getContext('2d');
  const R = canvas(W, H), rc = R.getContext('2d'), Rs = canvas(W / 2, Math.max(8, H / 28)), rs = Rs.getContext('2d');
  const paths = T.map(t => { const lit = new Path2D(), dark = new Path2D(); for (const r of t.runs) { const P = r.lit ? lit : dark; r.pts.forEach(([x, y], i) => i ? P.lineTo(x, y) : P.moveTo(x, y)); } return { lit, dark }; });
  const litPath = (t, i, st) => { if (st.reach >= 1) return paths[i].lit; const P = new Path2D(); let left = st.reach * t.litL;
    for (const r of t.runs) { if (!r.lit) continue; if (left <= 0) break; const p = left >= r.L ? r.pts : subpath(r.pts, r.c, 0, left); p.forEach(([x, y], j) => j ? P.lineTo(x, y) : P.moveTo(x, y)); left -= r.L; } return P; };
  const camOf = c => c ? { x: c.x ?? W / 2, y: c.y ?? H / 2, z: c.z ?? 1, rot: c.rot ?? 0 } : { x: W / 2, y: H / 2, z: 1, rot: 0 };
  const setCam = (ctx, cam, k) => { ctx.setTransform(k * cam.z, 0, 0, k * cam.z, k * (W / 2 - cam.x * cam.z), k * (H / 2 - cam.y * cam.z)); if (cam.rot) { ctx.translate(cam.x, cam.y); ctx.rotate(cam.rot); ctx.translate(-cam.x, -cam.y); } };
  const glassTint = o.glass || 'rgba(170,175,190,';

  function states(t) { return T.map(tb => tb.state(t)); }
  function draw(t, opt = {}) {
    const c = S.ctx, cam = camOf(opt.camera), st = states(t);
    // 1. the wall in the night's own light
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    setCam(c, cam, 1); c.drawImage(alb, 0, 0, WW, HH); c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'multiply'; c.fillStyle = typeof amb === 'function' ? amb(t) : amb; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
    if (opt.under) { setCam(c, cam, 1); opt.under(c, t); c.setTransform(1, 0, 0, 1, 0, 0); }
    // 2. light: every lit tube, half res
    a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, A.width, A.height); setCam(a, cam, .5); a.lineCap = a.lineJoin = 'round'; let any = 0;
    T.forEach((tb, i) => { const s = st[i]; if (s.b <= .002) return; any += s.b; a.globalAlpha = cl(s.b); a.strokeStyle = tb.gas.glow; a.lineWidth = tb.width * 1.3; a.stroke(litPath(tb, i, s)); });
    a.globalAlpha = 1;
    if (any > 0) {
      // 3. the wall lit by the tubes: blurred light × albedo, added
      ls.setTransform(1, 0, 0, 1, 0, 0); ls.globalCompositeOperation = 'source-over'; ls.clearRect(0, 0, Ls.width, Ls.height); ls.globalCompositeOperation = 'lighter';
      const z = cam.z; for (const [r, n] of [[2.5, 1], [9, 2], [30, 3]]) { ls.filter = `blur(${r * z}px)`; for (let k = 0; k < n; k++) ls.drawImage(A, 0, 0, Ls.width, Ls.height); } ls.filter = 'none';
      lf.setTransform(1, 0, 0, 1, 0, 0); lf.globalCompositeOperation = 'source-over'; lf.fillStyle = '#000'; lf.fillRect(0, 0, W, H); lf.globalCompositeOperation = 'lighter';
      for (let k = spill; k > 0; k -= 1) { lf.globalAlpha = Math.min(1, k); lf.drawImage(Ls, 0, 0, W, H); } lf.globalAlpha = 1;
      lf.globalCompositeOperation = 'multiply'; setCam(lf, cam, 1); lf.drawImage(alb, 0, 0, WW, HH); lf.setTransform(1, 0, 0, 1, 0, 0); lf.globalCompositeOperation = 'source-over';
      c.globalCompositeOperation = 'lighter'; c.drawImage(Lf, 0, 0); c.globalCompositeOperation = 'source-over';
    }
    // 4. glass: blackout runs always dark; the rest grey glass that fades as it lights
    setCam(c, cam, 1); c.lineCap = c.lineJoin = 'round';
    T.forEach((tb, i) => {
      const s = st[i], w = tb.width, off = 1 - cl(s.b * 1.4) * (s.reach >= 1 ? 1 : .2);
      c.strokeStyle = 'rgba(14,14,16,.95)'; c.lineWidth = w; c.stroke(paths[i].dark); c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = w * .18; c.save(); c.translate(-w * .12, -w * .2); c.stroke(paths[i].dark); c.restore();
      if (off > .01) {
        c.globalAlpha = off; c.strokeStyle = (tb.glass || glassTint) + '.30)'; c.lineWidth = w; c.stroke(paths[i].lit);
        c.strokeStyle = 'rgba(10,10,14,.35)'; c.lineWidth = w * .55; c.stroke(paths[i].lit);
        c.strokeStyle = 'rgba(255,255,255,.42)'; c.lineWidth = w * .16; c.save(); c.translate(-w * .12, -w * .22); c.stroke(paths[i].lit); c.restore();
        c.strokeStyle = rgba(tb.gas.tube, .10); c.lineWidth = w * .5; c.stroke(paths[i].lit); c.globalAlpha = 1;
      }
    });
    // 5. lit tube walls, the bloom, the hot core
    T.forEach((tb, i) => { const s = st[i]; if (s.b <= .002) return; c.globalAlpha = cl(s.b * 1.2); c.strokeStyle = tb.gas.tube; c.lineWidth = tb.width; c.stroke(litPath(tb, i, s)); }); c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (any > 0) {
      const z = cam.z, radii = [1.0, 3.2, 9].map(k => k * z), wts = [.8, .6, .45].map(v => v * bloom), base = T.reduce((s, t) => s + t.width, 0) / T.length;
      G.forEach((cv, k) => { const gg = cv.getContext('2d'); gg.setTransform(1, 0, 0, 1, 0, 0); gg.clearRect(0, 0, cv.width, cv.height); gg.filter = `blur(${radii[k] * base * .5}px)`; gg.drawImage(A, 0, 0); gg.filter = 'none'; });
      c.globalCompositeOperation = 'lighter'; G.forEach((cv, k) => { for (let v = wts[k]; v > 0; v -= 1) { c.globalAlpha = Math.min(1, v); c.drawImage(cv, 0, 0, W, H); } }); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    }
    setCam(c, cam, 1);
    T.forEach((tb, i) => { const s = st[i]; if (s.b <= .002) return; const P = litPath(tb, i, s); c.globalAlpha = cl(s.b); c.strokeStyle = tb.gas.core; c.lineWidth = tb.width * .38; c.stroke(P); c.globalAlpha = cl(s.b * .5); c.strokeStyle = '#fff'; c.lineWidth = tb.width * .15; c.stroke(P); }); c.globalAlpha = 1;
    // 6. the wire clips over the tubes at each support
    c.strokeStyle = 'rgba(60,60,60,.9)'; c.lineWidth = 1.6; T.forEach(tb => { for (const [x, y, ang] of tb.supports) { const nx = -Math.sin(ang), ny = Math.cos(ang), k = tb.width * .8, tx = Math.cos(ang) * tb.width * .35, ty = Math.sin(ang) * tb.width * .35; c.beginPath(); c.moveTo(x - nx * k - tx, y - ny * k - ty); c.lineTo(x + nx * k + tx, y + ny * k + ty); c.moveTo(x - nx * k + tx, y - ny * k + ty); c.lineTo(x + nx * k - tx, y + ny * k - ty); c.stroke(); } });
    if (opt.over) opt.over(c, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    // 7. the wet floor: the picture above the floor line, mirrored, streaked down, only where it is wet
    if (fl) {
      const fy = (fl.y - cam.y) * cam.z + H / 2, hR = H - fy;
      if (hR > 2 && fy > 2) {
        const k = o.reflect?.squash ?? .35, src = Math.min(fy, hR / k);
        rs.setTransform(1, 0, 0, 1, 0, 0); rs.clearRect(0, 0, Rs.width, Rs.height); rs.save(); rs.translate(0, Rs.height); rs.scale(1, -1); rs.filter = 'blur(1.5px)'; rs.drawImage(S.cv, 0, fy - src, W, src, 0, 0, Rs.width, Rs.height); rs.restore();
        rc.setTransform(1, 0, 0, 1, 0, 0); rc.globalCompositeOperation = 'source-over'; rc.clearRect(0, 0, W, H);
        const rip = o.reflect?.ripple ?? 5, band = 3;
        for (let y = 0; y < hR; y += band) { const v = y / hR, dx = rip * (.4 + v * 1.6) * (Math.sin(y * .05 + t * 2.1) * .6 + Math.sin(y * .013 - t * .9) * .4); rc.drawImage(Rs, 0, v * Rs.height, Rs.width, band / hR * Rs.height, dx, fy + y, W, band); }
        rc.globalCompositeOperation = 'destination-in'; setCam(rc, cam, 1); rc.drawImage(fl.wet, 0, 0, WW, HH); rc.setTransform(1, 0, 0, 1, 0, 0);
        const fade = rc.createLinearGradient(0, fy, 0, H); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,.35)'); rc.fillStyle = fade; rc.fillRect(0, fy, W, hR);
        rc.globalCompositeOperation = 'source-over';
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = o.reflect?.strength ?? .85; c.drawImage(R, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
    }
    if (o.vignette !== false) { const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .6); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${o.vignette ?? .55})`); c.fillStyle = v; c.fillRect(0, 0, W, H); }
    c.restore();
  }
  /* sounds that follow the picture: the hum's loudness and the arc's crackle sampled from the same states, a click on every strike */
  function sounds(duration, so = {}) {
    const rate = 200, n = Math.ceil(duration * rate), hum = new Array(n).fill(0), siz = new Array(n).fill(0), zaps = [];
    const Ltot = T.reduce((s, t) => s + t.litL, 0) || 1, Lmax = Math.max(...T.map(t => t.litL));
    T.forEach(tb => { let prev = 0, lastZap = -1; for (let k = 0; k < n; k++) { const t = k / rate, s = tb.state(t), w = tb.litL / Ltot;
      hum[k] += s.b * s.reach * w; siz[k] += s.arc * (s.reach < 1 ? .9 : .35) * Math.sqrt(w) + Math.abs(s.b - prev) * 2 * Math.sqrt(w);
      if (s.b > .5 && prev < .2 && t - lastZap > .05) { zaps.push({ t, v: .35 + .65 * Math.sqrt(tb.litL / Lmax), pan: cl((tb.box.cx / W - .5) * 1.6, -1, 1) }); lastZap = t; }
      prev = s.b; } });
    zaps.sort((p, q) => p.t - q.t); const merged = []; for (const z of zaps) { const m = merged[merged.length - 1]; if (m && z.t - m.t < .02) { m.v = Math.max(m.v, z.v); m.pan = (m.pan + z.pan) / 2; } else merged.push({ ...z }); }
    const out = [{ kind: 'hum', t: 0, dur: duration, env: hum.map(v => +v.toFixed(3)), rate, hz: so.hz ?? 100, v: so.hum ?? 1 },
                 { kind: 'sizzle', t: 0, dur: duration, env: siz.map(v => +cl(v, 0, 1.5).toFixed(3)), rate, v: so.sizzle ?? 1 }];
    for (const z of merged) out.push({ kind: 'zap', t: z.t, v: z.v * (so.zap ?? 1), pan: z.pan });
    return out;
  }
  return { draw, sounds, tubes: T, states, albedo: alb };
}

/* rain in front of the picture, lit by the sign: deterministic streaks */
function rain(c, t, o = {}) {
  const W = c.canvas.width, H = c.canvas.height, n = o.n ?? 260, sp = o.speed ?? 2200, ang = o.angle ?? .12, col = o.color || '#c8d4ff', L0 = o.length ?? 46;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const depth = .35 + hash(i * 3.1) * .65, L = L0 * depth, y = ((hash(i) * (H + 200) + t * sp * depth) % (H + 200)) - 100, x = (hash(i * 7.7) * (W + 200) - 100 + y * ang) % (W + 200);
    c.strokeStyle = rgba(col, (o.alpha ?? .22) * depth); c.lineWidth = .8 + depth * 1.4; c.beginPath(); c.moveTo(x, y); c.lineTo(x - ang * L, y - L); c.stroke();
  }
  c.restore();
}

/* camera keys: [[t, { x, y, z, rot }], …] → the camera at t, eased between keys */
function camera(keys, t) {
  if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, A] = keys[i - 1], [b, B] = keys[i], u = io((t - a) / (b - a)); const out = {}; for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) out[k] = lerp(A[k] ?? B[k], B[k] ?? A[k], u); return out; }
  return keys[keys.length - 1][1];
}
/* a chaser: n segments lit in turn, `step` seconds each — returns (t, i) => 0..1 for tubes({ level }) */
const chase = (n, step = .25, o = {}) => (t, i) => { const k = Math.floor(t / step); const on = o.fill ? (k % (n + (o.hold ?? 2))) >= i : (k % n) === i; return on ? 1 : (o.dim ?? 0); };
const blink = (period = 1, duty = .5, from = 0) => t => t < from ? 1 : (((t - from) / period) % 1) < duty ? 1 : 0;

/* stage + scene: window.__scene = Neon.scene(async () => ({ duration, draw(t), sounds, music })) */
function stage(o = {}) { const cv = document.querySelector('canvas') || document.body.appendChild(document.createElement('canvas')); cv.width = o.width || 1080; cv.height = o.height || 1920; return { cv, ctx: cv.getContext('2d'), W: cv.width, H: cv.height }; }
function scene(build) {
  const sc = { duration: 0, sounds: [], music: null };
  sc.ready = (async () => { const r = await build(); Object.assign(sc, r); sc.seek = t => { r.draw(t); return Promise.resolve(); }; return true; })();
  if (!/rec=1/.test(location.search)) sc.ready.then(() => { const t0 = performance.now(); const loop = () => { const t = ((performance.now() - t0) / 1000) % sc.duration; sc.draw(t); requestAnimationFrame(loop); }; loop(); });
  return sc;
}

window.Neon = { GAS, gas: gasOf, text, drawn, svg, circle, rect, line, cable, join, tube, tubes, ignition, wall, floor, panel, sign, rain, camera, chase, blink, stage, scene,
  rng, hash, cl, seg, lerp, sm, io, oc, rgba, mix, resample, bbox, FPS };
})();
