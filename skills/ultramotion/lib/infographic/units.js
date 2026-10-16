/* Infographic — one crowd of units (people, squares, coins, notes) that re-forms for every question:
   the same 100 people stand by city and village, then by age, then by schooling; the same 434 notes split into spent and kept.
   Each unit walks its own curved path, leaves a little after its neighbour and settles where it lands.
   Also: one group lit at a time, numbers beside groups that keep out of each other's way, a magnifying glass,
   a camera that rides up a pile too tall for the frame, rolling numbers.
   Canvas 2D, no dependencies. Every frame is a pure function of t.

   const E = Units.create({ width: 1080, height: 1920 });
   const C = Units.crowd(people);                         // people: [{ …attributes }]
   C.state(0.5, Units.grid(100, { x: 540, y: 900, cols: 10, cell: 70, anchor: 'c' }));   // everyone in one block
   C.state(4, Units.side({ 城镇: 64, 乡村: 36 }, { box, cell: 64, cols: 8 }), { by: u => u.place });
   window.__scene = Units.scene(E, (c, t) => { C.draw(c, t, { shape: 'person', color: u => … }); }, { duration });
*/
(function () {
const TAU = Math.PI * 2;
const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
const seg = (t, a, z) => cl((t - a) / (z - a));
const lerp = (a, z, u) => a + (z - a) * u;
const oc = u => 1 - Math.pow(1 - u, 3);
const io = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const sm = u => { u = cl(u); return u * u * (3 - 2 * u); };
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SANS = '"SF Pro Display", "Helvetica Neue", "PingFang SC", sans-serif', TEXT = '"PingFang SC", "SF Pro Text", "Helvetica Neue", sans-serif', SERIF = '"Songti SC", "STSong", "Source Han Serif SC", Georgia, serif';

function create(o = {}) {
  const W = o.width || 1080, H = o.height || 1920;
  const cv = o.canvas || document.querySelector('canvas'); cv.width = W; cv.height = H;
  return { W, H, ctx: cv.getContext('2d'), canvas: cv };
}

/* ---------- counting ---------- */
/* real values → whole units that add up to exactly n (largest remainder). Takes an object or an array; returns the same shape. */
function split(values, n = 100) {
  const keys = Object.keys(values), v = keys.map(k => +values[k]), sum = v.reduce((p, q) => p + q, 0);
  const raw = v.map(q => q / sum * n), out = raw.map(Math.floor); let left = n - out.reduce((p, q) => p + q, 0);
  raw.map((q, i) => [q - Math.floor(q), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  const res = Array.isArray(values) ? [] : {}; keys.forEach((k, i) => { res[k] = out[i]; }); return res;
}
/* build a crowd's members from counts: list({ 城镇: 64, 乡村: 36 }, 'place') → [{ place: '城镇' } ×64, { place: '乡村' } ×36].
   Then mark more attributes inside a subset: mark(people, 'old', { 是: 10, 否: 54 }, u => u.place === '城镇'). */
function list(counts, key) { const out = []; Object.keys(counts).forEach(k => { for (let i = 0; i < counts[k]; i++) out.push({ [key]: k }); }); return out; }
function mark(units, key, counts, where = () => true) {
  const sub = units.filter(where); let j = 0;
  Object.keys(counts).forEach(k => { for (let i = 0; i < counts[k] && j < sub.length; i++) sub[j++][key] = k; });
  return units;
}

/* ---------- where units stand ----------
   Every layout returns { slots: [{ x, y, s }], box: { x0, y0, x1, y1 } }; (x, y) is the centre of a unit, s its size.
   Slots come in fill order: the first slot fills first. */
/* a block of n units. anchor: where (x, y) is — 'tl' top-left, 'bl' bottom-left (a pile that grows up), 'bc' bottom-centre, 'tc', 'c'.
   cell: the pitch between units (ch: a different pitch between rows, for flat units like notes); size: the unit's drawn size (default cell × .8).
   align: where a short last row sits ('left' | 'center' | 'right'). */
function grid(n, { x = 0, y = 0, cols = 10, cell = 40, ch = null, size = null, anchor = 'tl', align = 'left', rows = null } = {}) {
  const cy = ch ?? cell, s = size ?? cell * .8, nr = rows ?? Math.ceil(n / cols), w = Math.min(n, cols) * cell, h = nr * cy, up = anchor[0] === 'b';
  const x0 = anchor.endsWith('c') ? x - w / 2 : anchor.endsWith('r') ? x - w : x, y0 = anchor === 'c' ? y - h / 2 : up ? y - h : y;
  const slots = [];
  for (let i = 0; i < n; i++) { const r = Math.floor(i / cols), k = i % cols, inRow = Math.min(cols, n - r * cols);
    const off = align === 'center' ? (cols - inRow) * cell / 2 : align === 'right' ? (cols - inRow) * cell : 0;
    slots.push({ x: x0 + off + (k + .5) * cell, y: up ? y0 + h - (r + .5) * cy : y0 + (r + .5) * cy, s }); }
  return { slots, box: { x0, y0, x1: x0 + w, y1: y0 + h } };
}
/* units round a circle (or an arc from start to end, radians) */
function ring(n, { cx, cy, r, size = 30, start = -Math.PI / 2, end = null } = {}) {
  const span = end === null ? TAU : end - start, step = end === null ? span / n : span / Math.max(1, n - 1);
  const slots = Array.from({ length: n }, (_, i) => ({ x: cx + Math.cos(start + i * step) * r, y: cy + Math.sin(start + i * step) * r, s: size }));
  return { slots, box: { x0: cx - r - size / 2, y0: cy - r - size / 2, x1: cx + r + size / 2, y1: cy + r + size / 2 } };
}
/* a queue from (x0, y0) to (x1, y1), spaced by `gap` (default: spread evenly) */
function line(n, { x0, y0, x1, y1, size = 30, gap = null } = {}) {
  const L = Math.hypot(x1 - x0, y1 - y0), d = gap ?? (n > 1 ? L / (n - 1) : 0), ux = L ? (x1 - x0) / L : 1, uy = L ? (y1 - y0) / L : 0;
  const slots = Array.from({ length: n }, (_, i) => ({ x: x0 + ux * d * i, y: y0 + uy * d * i, s: size }));
  return { slots, box: bounds(slots) };
}
/* groups side by side, each a pile standing on one baseline (or hanging from the top, or centred): counts { key: n } in order.
   box [x0, y0, x1, y1]: the piles are spread across x0..x1 with equal gaps; cols: units per row (a number, or { key: n }).
   → { key: { slots, box } } — pass it straight to crowd.state(). */
function side(counts, { box, cell = 40, ch = null, size = null, cols = 5, align = 'bottom', gap = null } = {}) {
  const [x0, y0, x1, y1] = box, keys = Object.keys(counts), cw = k => (typeof cols === 'object' ? cols[k] : cols) * cell;
  const used = keys.reduce((p, k) => p + Math.min(cw(k), Math.max(1, counts[k]) * cell), 0), g = gap ?? (keys.length > 1 ? (x1 - x0 - used) / (keys.length - 1) : 0);
  let x = keys.length > 1 || gap !== null ? x0 : (x0 + x1 - used) / 2; const out = {};
  keys.forEach(k => { const c = typeof cols === 'object' ? cols[k] : cols, w = Math.min(cw(k), Math.max(1, counts[k]) * cell);
    out[k] = align === 'bottom' ? grid(counts[k], { x, y: y1, cols: c, cell, ch, size, anchor: 'bl' })
      : align === 'top' ? grid(counts[k], { x, y: y0, cols: c, cell, ch, size, anchor: 'tl' })
      : grid(counts[k], { x, y: (y0 + y1) / 2 - Math.ceil(counts[k] / c) * (ch ?? cell) / 2, cols: c, cell, ch, size, anchor: 'tl' });
    x += w + g; });
  return out;
}
/* groups as horizontal bars of units, one band per group from the top: each band `lines` units tall, filling left to right.
   → { key: { slots, box } }. Leave room on the left for names (x) and on the right for the numbers. */
function rows(counts, { x, y, cell = 30, ch = null, size = null, lines = 2, gap = null } = {}) {
  const cy = ch ?? cell, out = {}, band = lines * cy + (gap ?? cy * .8); let yy = y;
  Object.keys(counts).forEach(k => { const n = counts[k], s = size ?? cell * .8, slots = [];
    for (let i = 0; i < n; i++) slots.push({ x: x + (Math.floor(i / lines) + .5) * cell, y: yy + (i % lines + .5) * cy, s });
    out[k] = { slots, box: { x0: x, y0: yy, x1: x + Math.max(1, Math.ceil(n / lines)) * cell, y1: yy + lines * cy } }; yy += band; });
  return out;
}
/* one block where the groups follow each other (a waffle): counts { key: n } in order. order: 'rows' (left→right, top→bottom),
   'columns' (top→bottom, left→right) or 'snake'. → { key: { slots, box } }; box covers that group's cells. */
function waffle(counts, { x, y, cols = 10, cell = 40, ch = null, size = null, order = 'rows' } = {}) {
  const s = size ?? cell * .8, out = {}, total = Object.values(counts).reduce((p, q) => p + q, 0), nr = Math.ceil(total / cols); let i = 0;
  Object.keys(counts).forEach(k => { const slots = [];
    for (let j = 0; j < counts[k]; j++, i++) { let r, c;
      if (order === 'columns') { c = Math.floor(i / nr); r = i % nr; } else { r = Math.floor(i / cols); c = i % cols; if (order === 'snake' && r % 2) c = cols - 1 - c; }
      slots.push({ x: x + (c + .5) * cell, y: y + (r + .5) * (ch ?? cell), s }); }
    out[k] = { slots, box: bounds(slots) }; });
  return out;
}
/* the bounding box of slots or of live units ({ x, y, s }) */
function bounds(pts) {
  if (!pts.length) return null; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(p => { const h = (p.s || 0) / 2; x0 = Math.min(x0, p.x - h); y0 = Math.min(y0, p.y - h); x1 = Math.max(x1, p.x + h); y1 = Math.max(y1, p.y + h); });
  return { x0, y0, x1, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0, h: y1 - y0 };
}

/* ---------- the crowd ---------- */
/* units: an array of objects (their attributes); each keeps its identity through every state.
   crowd.state(t, arrangement, { by, order, dur, stagger, wave, arc, lift, settle, enter, exit })
     arrangement: one layout ({ slots }) for everyone, or { key: layout } with by(u) → key; units whose key has no layout leave (fade out).
     order(u) → number: who takes the first slots inside a group (e.g. lit ones last, so they gather together); without it,
       each unit takes the slot nearest to where it stands (paths cross as little as possible).
     dur: seconds one unit spends walking; stagger: spread of departures (s); wave: who leaves first — 'random' | 'x' | '-x' | 'y' | '-y' | 'near' | (u, from, to) → number.
     arc: how far paths bend sideways (× distance); lift: extra rise on the way (px); settle: a small give when a unit lands (× size, 0 = none).
     enter: { dx, dy } where newcomers come from (relative); exit: { dx, dy } where leavers go (default: they fade where they stand). */
function crowd(units) {
  const U = units.map((u, i) => Object.assign(u, { i })), S = [];
  const end = (k, i) => S[k].pos[i];                                                   // where unit i stands when state k is done (null = not shown)
  function assign(members, slots, prev, order) {
    const n = Math.min(members.length, slots.length), m = members.slice(0, members.length);
    if (order) { m.sort((a, b) => order(a) - order(b) || a.i - b.i); return m.map((u, j) => [u, j < n ? slots[j] : null]); }
    const P = u => prev[u.i] || { x: slots[0] ? slots[0].x : 0, y: -1e4 };
    const key = p => p.y * .002 + p.x;                                                 // sort both sides the same way, then improve by swaps
    m.sort((a, b) => key(P(a)) - key(P(b)) || a.i - b.i);
    const idx = slots.map((_, j) => j).sort((a, b) => key(slots[a]) - key(slots[b]));
    const pick = m.slice(0, n), sl = idx.slice(0, n).map(j => slots[j]);
    const d = (u, s) => { const p = P(u); return (p.x - s.x) ** 2 + (p.y - s.y) ** 2; };
    for (let pass = 0; pass < (n > 700 ? 2 : 6); pass++) { let better = false;
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        if (d(pick[a], sl[b]) + d(pick[b], sl[a]) < d(pick[a], sl[a]) + d(pick[b], sl[b]) - 1e-6) { const q = sl[a]; sl[a] = sl[b]; sl[b] = q; better = true; } }
      if (!better) break; }
    const out = pick.map((u, j) => [u, sl[j]]); m.slice(n).forEach(u => out.push([u, null])); return out;
  }
  function state(t, arr, o = {}) {
    const k = S.length, prev = k ? S[k - 1].pos : U.map(() => null), pos = U.map(() => null), groups = {};
    const lay = arr.slots ? { all: arr } : arr, by = arr.slots ? () => 'all' : (o.by || (() => 'all'));
    const members = {}; U.forEach(u => { const g = by(u); if (g != null && lay[g]) (members[g] = members[g] || []).push(u); });
    Object.keys(members).forEach(g => assign(members[g], lay[g].slots, prev, o.order).forEach(([u, s]) => { pos[u.i] = s; }));
    Object.keys(lay).forEach(g => { groups[g] = lay[g].box || bounds(lay[g].slots); });
    const st = { t, pos, groups, dur: o.dur ?? 1.3, stagger: o.stagger ?? .9, arc: o.arc ?? .22, lift: o.lift ?? 0, settle: o.settle ?? .05,
      enter: o.enter || { dx: 0, dy: -80 }, exit: o.exit || null, delay: [] };
    const w = o.wave || 'random', from = i => prev[i] || pos[i] || { x: 0, y: 0 }, to = i => pos[i] || prev[i] || { x: 0, y: 0 };
    const score = U.map((u, i) => typeof w === 'function' ? w(u, from(i), to(i)) : w === 'x' ? to(i).x : w === '-x' ? -to(i).x : w === 'y' ? to(i).y : w === '-y' ? -to(i).y
      : w === 'near' ? Math.hypot(to(i).x - from(i).x, to(i).y - from(i).y) : hash(i * 7.31 + k * 3.7));
    const rank = score.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), nn = Math.max(1, U.length - 1);
    rank.forEach(([, i], r) => { st.delay[i] = st.stagger * (r / nn) * (w === 'random' ? 1 : .85) + (w === 'random' ? 0 : st.stagger * .15 * hash(i * 1.7 + k)); });
    S.push(st); return k;
  }
  /* where unit i is at time t: { x, y, s, a, k (0..1 of its current walk), moving } */
  function at(i, t, upto = S.length - 1) {
    let k = -1; for (let j = 0; j <= upto; j++) if (S[j].t <= t) k = j;
    if (k < 0) { const p = S[0] && S[0].pos[i]; return p ? { x: p.x, y: p.y, s: p.s, a: 0, k: 0, moving: false } : null; }
    const st = S[k], dest = st.pos[i], u0 = cl((t - st.t - st.delay[i]) / st.dur), u = io(u0);
    const was = k ? at(i, st.t, k - 1) : null, src = was && was.a > 0 ? was : null;
    if (!dest && !src) return null;
    if (!dest) {                                                                         // leaving
      const ex = st.exit; if (u0 >= 1) return null;
      return ex ? { x: src.x + ex.dx * u, y: src.y + ex.dy * u, s: src.s, a: src.a * (1 - sm(u0 * 1.2)), k: u0, moving: u0 > 0 }
        : { x: src.x, y: src.y, s: src.s * (1 - .4 * u), a: src.a * (1 - u), k: u0, moving: u0 > 0 };
    }
    if (!src) {                                                                          // arriving
      const e = st.enter; return { x: dest.x + e.dx * (1 - u), y: dest.y + e.dy * (1 - u), s: dest.s, a: sm(u0 * 1.6), k: u0, moving: u0 < 1 };
    }
    const dx = dest.x - src.x, dy = dest.y - src.y, L = Math.hypot(dx, dy);
    if (L < .5 && Math.abs(dest.s - src.s) < .1) return { x: dest.x, y: dest.y, s: dest.s, a: 1, k: 1, moving: false };
    const bend = (hash(i * 3.3 + k * 11.1) - .5) * 2 * st.arc * L, nx = L ? -dy / L : 0, ny = L ? dx / L : 0;
    const cx = (src.x + dest.x) / 2 + nx * bend, cy = (src.y + dest.y) / 2 + ny * bend - st.lift;
    const x = (1 - u) ** 2 * src.x + 2 * (1 - u) * u * cx + u * u * dest.x, y0 = (1 - u) ** 2 * src.y + 2 * (1 - u) * u * cy + u * u * dest.y;
    const after = t - st.t - st.delay[i] - st.dur, give = after > 0 && after < .45 ? Math.sin(after / .45 * Math.PI) * (1 - after / .45) * st.settle * dest.s : 0;
    return { x, y: y0 + give, s: lerp(src.s, dest.s, u), a: src.a + (1 - src.a) * u, k: u0, moving: u0 > 0 && u0 < 1 };
  }
  const C = {
    units: U, states: S, state, at,
    /* every unit now: [{ u, x, y, s, a, k, moving }] (hidden units left out) */
    now(t) { const out = []; U.forEach((u, i) => { const p = at(i, t); if (p && p.a > .001) out.push(Object.assign(p, { u })); }); return out; },
    /* draw everyone. shape: 'person' | 'square' | 'circle' | 'coin' | 'note' | (ctx, x, y, s, u, p) => …; color(u, t, p) → css colour.
       A unit with u.part (0..1) is a value smaller than one unit: drawn as a grain × grain grid of small squares (u.grain, default 10),
       round(part × grain²) of them filled, the rest as faint outlines (see fraction()). scale: size multiplier. */
    draw(ctx, t, { shape = 'square', color = () => '#222', scale = 1, a = 1, front = null } = {}) {
      const ps = C.now(t); if (front) ps.sort((p, q) => (front(p.u, t) ? 1 : 0) - (front(q.u, t) ? 1 : 0));
      ctx.save(); const base = ctx.globalAlpha * a;
      ps.forEach(p => { ctx.globalAlpha = base * p.a; ctx.fillStyle = color(p.u, t, p); const s = p.s * scale;
        if (p.u.part != null && p.u.part < 1) fraction(ctx, p.x, p.y, s, p.u.part, { grain: p.u.grain || 10 });
        else unit(ctx, shape, p.x, p.y, s, p.u, p); });
      ctx.restore(); return ps;
    },
    /* the box a group stands in once state k has settled (for labels and the camera) */
    target(key, k = S.length - 1) { return S[k] && S[k].groups[key] ? Object.assign({}, S[k].groups[key], { cx: (S[k].groups[key].x0 + S[k].groups[key].x1) / 2, cy: (S[k].groups[key].y0 + S[k].groups[key].y1) / 2 }) : null; },
    /* the live box of the units that pass the test, as they move */
    box(test, t) { return bounds(C.now(t).filter(p => test(p.u))); },
    /* when state k is done moving */
    settled(k) { const st = S[k]; return st.t + Math.max(...st.delay) + st.dur; },
    /* soft taps as units land in state k, merged so they never crowd: → sounds for scene() */
    taps(k, { kind = 'tap', v = .22, minGap = .07, max = 18, test = null } = {}) {
      const st = S[k], ts = U.filter(u => st.pos[u.i] && (!test || test(u))).map(u => st.t + st.delay[u.i] + st.dur).sort((a, b) => a - b), out = []; let last = -1;
      ts.forEach(x => { if (x - last >= minGap && out.length < max) { out.push({ t: x, kind, v: v * (.75 + .5 * hash(x * 13)) }); last = x; } }); return out;
    },
  };
  return C;
}

/* ---------- unit shapes, drawn in a box of size s centred on (x, y) ---------- */
function unit(ctx, shape, x, y, s, u, p) {
  if (typeof shape === 'function') return shape(ctx, x, y, s, u, p);
  ctx.beginPath();
  if (shape === 'person') {           // a round head over rounded shoulders, the simplest figure that still reads as a person
    const w = s * .36, b = y + s * .5; ctx.arc(x, y - s * .28, s * .19, 0, TAU); ctx.fill(); ctx.beginPath();
    ctx.moveTo(x - w, b); ctx.lineTo(x - w, b - s * .38); ctx.quadraticCurveTo(x - w, b - s * .58, x, b - s * .58); ctx.quadraticCurveTo(x + w, b - s * .58, x + w, b - s * .38); ctx.lineTo(x + w, b); ctx.closePath(); ctx.fill(); return;
  }
  if (shape === 'circle') { ctx.arc(x, y, s / 2, 0, TAU); ctx.fill(); return; }
  if (shape === 'coin') { ctx.arc(x, y, s / 2, 0, TAU); ctx.fill(); ctx.save(); ctx.globalAlpha *= .35; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, s * .06); ctx.beginPath(); ctx.arc(x, y, s * .32, 0, TAU); ctx.stroke(); ctx.restore(); return; }
  if (shape === 'note') { ctx.roundRect(x - s / 2, y - s * .3, s, s * .6, s * .07); ctx.fill(); ctx.save(); ctx.globalAlpha *= .3; ctx.strokeStyle = '#000'; ctx.lineWidth = Math.max(1, s * .04); ctx.beginPath(); ctx.ellipse(x, y, s * .13, s * .17, 0, 0, TAU); ctx.stroke(); ctx.restore(); return; }
  ctx.roundRect(x - s / 2, y - s / 2, s, s, s * .18); ctx.fill();   // 'square'
}
/* a value smaller than one unit, drawn as that unit split into grain × grain small squares: round(part × grain²) filled (from the bottom row up,
   left to right), the others as faint outlines — so 0.35 of a unit is 35 small squares out of 100 that can be counted under a lens.
   Uses ctx.fillStyle as the colour. Returns the number of filled small squares. */
function fraction(ctx, x, y, s, part, { grain = 10, outline = .4, gap = .2 } = {}) {
  const g = grain, n = Math.round(cl(part) * g * g), pitch = s / g, q = pitch * (1 - gap), x0 = x - s / 2, y0 = y - s / 2, col = ctx.fillStyle;
  ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(.5, pitch * .09);
  for (let i = 0; i < g * g; i++) { const r = g - 1 - Math.floor(i / g), c = i % g, px = x0 + c * pitch + (pitch - q) / 2, py = y0 + r * pitch + (pitch - q) / 2;
    if (i < n) { ctx.fillRect(px, py, q, q); }
    else { const a = ctx.globalAlpha; ctx.globalAlpha = a * outline; ctx.strokeRect(px + ctx.lineWidth / 2, py + ctx.lineWidth / 2, q - ctx.lineWidth, q - ctx.lineWidth); ctx.globalAlpha = a; } }
  ctx.restore(); return n;
}
/* one unit and what it stands for: legend(ctx, '= 1,412 万人', { x, y, shape, size, color }) — returns its width */
function legend(ctx, s, { x, y, shape = 'square', size = 34, color = '#222', ink = color, text = 30, weight = 600, font = TEXT, a = 1 } = {}) {
  if (a <= 0) return 0; ctx.save(); ctx.globalAlpha *= a; ctx.fillStyle = color; unit(ctx, shape, x + size / 2, y - size / 2, size, {}, {});
  ctx.font = `${weight} ${text}px ${font}`; ctx.fillStyle = ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(s, x + size * 1.35, y - size / 2);
  const w = size * 1.35 + ctx.measureText(s).width; ctx.restore(); return w;
}

/* ---------- one group lit at a time ---------- */
/* cues [[t0, t1, test(u) → bool], …]: while a cue is on, the units that pass are lit and everyone else is dimmed.
   spot.k(u, t) → 0..1 how lit; spot.any(t) → 0..1 whether something is lit; spot.color(u, t, { ink, dim, accent }) → css colour. */
function spotlight(cues, { fade = .45 } = {}) {
  const w = (c, t) => seg(t, c[0], c[0] + fade) * (1 - seg(t, c[1] - fade, c[1]));
  const sp = {
    k: (u, t) => cues.reduce((m, c) => Math.max(m, c[2](u) ? w(c, t) : 0), 0),
    any: t => cues.reduce((m, c) => Math.max(m, w(c, t)), 0),
    color: (u, t, { ink, dim, accent }) => mix(mix(ink, dim, sp.any(t)), accent, sp.k(u, t)),
  };
  return sp;
}
/* mix two hex colours (#rgb or #rrggbb): k = 0 → a, 1 → b */
function mix(a, b, k) {
  if (k <= 0) return a; if (k >= 1) return b; const p = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const A = p(a), B = p(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
}

/* ---------- numbers and words next to the groups ---------- */
/* a tag beside a box: a big number and a short label. side: 'below' | 'above' | 'right' | 'left'. stack: label under the number (else on one line when it fits).
   Returns its rect { x0, y0, x1, y1 }. With dry: true it only measures. */
function tag(ctx, box, { value = '', text = '', side = 'below', size = 64, label = null, color = '#222', labelColor = null, a = 1, gap = 18, font = SANS, labelFont = TEXT, weight = 800, align = 'left', stack = false, dry = false } = {}) {
  const ls = label ?? Math.round(size * .42);
  ctx.save(); ctx.font = `${weight} ${size}px ${font}`; const wv = value ? ctx.measureText(value).width : 0; ctx.font = `600 ${ls}px ${labelFont}`; const wl = text ? ctx.measureText(text).width : 0; ctx.restore();
  const inline = !stack && (side === 'right' || side === 'left' || wv + wl + 14 < Math.max(box.x1 - box.x0, 260));   // number and label on one line when they fit
  const w = inline ? wv + (text ? 12 + wl : 0) : Math.max(wv, wl), h = inline ? size * .9 : size * .9 + ls * 1.4;
  let x0 = align === 'center' ? (box.x0 + box.x1) / 2 - w / 2 : align === 'right' ? box.x1 - w : box.x0, y0;
  if (side === 'below') y0 = box.y1 + gap; else if (side === 'above') y0 = box.y0 - gap - h;
  else { y0 = (box.y0 + box.y1) / 2 - h / 2; x0 = side === 'right' ? box.x1 + gap : box.x0 - gap - w; }
  const r = { x0, y0, x1: x0 + w, y1: y0 + h };
  if (dry || a <= 0) return r;
  ctx.save(); ctx.globalAlpha *= a; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  const base = y0 + size * .78;
  if (value) { ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.fillText(value, x0, base); }
  if (text) { ctx.font = `600 ${ls}px ${labelFont}`; ctx.fillStyle = labelColor || color; if (inline) ctx.fillText(text, x0 + wv + (value ? 12 : 0), base); else ctx.fillText(text, x0, base + ls * 1.35); }
  ctx.restore(); return r;
}
/* several tags that must not cover each other, the units, or leave the frame: items [{ box, value, text, sides: ['below', 'right', …], …tag options }].
   avoid: rects (or live unit boxes) to keep clear of; frame [x0, y0, x1, y1]. Each item takes the first side that fits. */
function tags(ctx, items, { avoid = [], frame = null } = {}) {
  const hit = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0, placed = [], out = [];
  items.forEach(it => { if (!it || (it.a ?? 1) <= 0) return; const sides = it.sides || [it.side || 'below'];
    let best = null, bestScore = Infinity;
    sides.forEach((sd, n) => { const r = tag(ctx, it.box, Object.assign({}, it, { side: sd, dry: true }));
      let score = n * .01; [...placed, ...avoid.filter(b => b !== it.box)].forEach(b => { if (hit(r, b)) score += 1; });
      if (frame && (r.x0 < frame[0] || r.y0 < frame[1] || r.x1 > frame[2] || r.y1 > frame[3])) score += 2;
      if (score < bestScore) { bestScore = score; best = sd; } });
    const r = tag(ctx, it.box, Object.assign({}, it, { side: best })); placed.push(r); out.push(r); });
  return out;
}
/* a number that rolls without the digits jumping: fixed-width digits. format(v) → string. Returns its width. */
function counter(ctx, value, { x, y, size = 120, color = '#222', prefix = '', suffix = '', decimals = 0, align = 'left', font = SANS, weight = 800, format = null, a = 1 } = {}) {
  if (a <= 0) return 0;
  const s = format ? format(value) : prefix + value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  ctx.save(); ctx.globalAlpha *= a; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
  const dw = ctx.measureText('0').width, widths = [...s].map(ch => /[0-9]/.test(ch) ? dw : ctx.measureText(ch).width), tot = widths.reduce((p, q) => p + q, 0);
  let px = align === 'left' ? x : align === 'right' ? x - tot : x - tot / 2; ctx.textAlign = 'center';
  [...s].forEach((ch, i) => { ctx.fillText(ch, px + widths[i] / 2, y); px += widths[i]; });
  ctx.restore(); return tot;
}
function text(ctx, s, x, y, { size = 40, color = '#222', weight = 600, font = TEXT, align = 'left', a = 1, rise = 0, baseline = 'alphabetic', lineHeight = 1.3, maxWidth = null } = {}) {
  if (a <= 0 || !s) return 0; ctx.save(); ctx.globalAlpha *= a; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline;
  let w = 0; String(s).split('\n').forEach((l, i) => { ctx.fillText(l, x, y + (1 - a) * rise + i * size * lineHeight, maxWidth ?? undefined); w = Math.max(w, ctx.measureText(l).width); });
  ctx.restore(); return w;
}
function source(ctx, s, { x = 80, y = null, size = 22, color = 'rgba(0,0,0,.4)', align = 'left' } = {}) { text(ctx, s, x, y ?? ctx.canvas.height - 64, { size, weight: 400, color, align }); }

/* ---------- the camera ---------- */
/* keyframes [[t, { x, y, z }], …] → t ↦ { x, y, z }: eased between keys, held before the first and after the last.
   x, y: the world point at the centre of the screen; z: zoom. Two keys with the same values hold the camera. */
function track(keys, { ease = io } = {}) {
  const K = keys.slice().sort((a, b) => a[0] - b[0]);
  return t => { if (t <= K[0][0]) return Object.assign({}, K[0][1]); for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const [a, A] = K[i - 1], [b, B] = K[i], u = ease((t - a) / (b - a));
      return { x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u), z: Math.exp(lerp(Math.log(A.z ?? 1), Math.log(B.z ?? 1), u)) }; }
    return Object.assign({}, K[K.length - 1][1]); };
}
/* apply a camera { x, y, z } (wrap in save/restore); everything drawn after it is in world coordinates */
function camera(ctx, cam, W = ctx.canvas.width, H = ctx.canvas.height) { ctx.translate(W / 2, H / 2); ctx.scale(cam.z ?? 1, cam.z ?? 1); ctx.translate(-cam.x, -cam.y); }
/* world → screen for a camera, to place things that stay on the screen (a number pinned to the top of a pile) */
function toScreen(cam, x, y, W, H) { const z = cam.z ?? 1; return { x: W / 2 + (x - cam.x) * z, y: H / 2 + (y - cam.y) * z }; }
/* the camera that keeps a tall pile's top in view: follow(t, top(t), { y: rest, margin }) — returns the camera y.
   While the top is inside the frame the camera rests at `rest`; once it climbs past `margin` from the top edge the camera rides up with it. */
function follow(topY, { rest, H, z = 1, margin = 260 } = {}) { const need = topY - margin / z + H / 2 / z; return Math.min(rest, need); }

/* ---------- the magnifying glass ---------- */
/* a lens at (x, y) of radius r that shows the world around `focus` [fx, fy] enlarged `zoom` times: draw(ctx) redraws the world
   (in the same coordinates as the lens). handle: angle of the handle (radians, 0 = right, π/4 = down-right). a: 0..1. */
function lens(ctx, { x, y, r = 150, focus, zoom = 6, draw, a = 1, rim = '#222', glass = '#fff', handle = Math.PI / 4, width = null } = {}) {
  if (a <= 0) return; const [fx, fy] = focus || [x, y], lw = width ?? r * .09, rr = r * (.85 + .15 * a);
  ctx.save(); ctx.globalAlpha *= a;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = r * .25; ctx.shadowOffsetY = r * .06; ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.clip(); ctx.translate(x, y); ctx.scale(zoom, zoom); ctx.translate(-fx, -fy); draw(ctx); ctx.restore();
  ctx.save(); ctx.globalAlpha *= .18; ctx.strokeStyle = '#fff'; ctx.lineWidth = rr * .08; ctx.beginPath(); ctx.arc(x, y, rr * .78, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke(); ctx.restore();
  ctx.strokeStyle = rim; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
  const hx = x + Math.cos(handle) * (rr + lw / 2), hy = y + Math.sin(handle) * (rr + lw / 2);
  ctx.lineCap = 'round'; ctx.lineWidth = lw * 2.1; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(handle) * r * .75, hy + Math.sin(handle) * r * .75); ctx.stroke();
  ctx.restore();
}

/* ---------- a scale bar for piles that run out of the frame ---------- */
/* a thin ruler along a pile from y0 (bottom) to y1 (top): ticks every `every` px with labels; for "this column is 64 NASAs tall" */
function ruler(ctx, { x, y0, y1, every, label = i => String(i), color = 'rgba(0,0,0,.4)', size = 20, a = 1, side = 1 } = {}) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.font = `500 ${size}px ${TEXT}`; ctx.textBaseline = 'middle'; ctx.textAlign = side > 0 ? 'left' : 'right';
  ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
  for (let i = 0, y = y0; y >= y1 - .5; i++, y -= every) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 10, y); ctx.stroke(); const s = label(i); if (s) ctx.fillText(s, x + side * 16, y); }
  ctx.restore();
}

/* ---------- film ---------- */
let GRAIN = null;
function finish(ctx, t, { grain = .05, vignette = .1, W = ctx.canvas.width, H = ctx.canvas.height } = {}) {
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  if (vignette) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .4, W / 2, H / 2, Math.hypot(W, H) * .6); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vignette})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (grain) {
    if (!GRAIN) { GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 256; const g = GRAIN.getContext('2d'), d = g.createImageData(256, 256);
      for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .37) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }
    const f = Math.floor(t * 30), ox = hash(f) * 256, oy = hash(f + 7.3) * 256;
    ctx.globalAlpha = grain; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.translate(-ox, -oy); ctx.fillRect(ox, oy, W, H);
  }
  ctx.restore();
}

function scene(E, draw, { duration, music = null, sounds = [], background = '#f1efe9' } = {}) {
  const Q = new URLSearchParams(location.search);
  const frameAt = t => { const c = E.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.fillStyle = background; c.fillRect(0, 0, E.W, E.H); draw(c, t, E); };
  const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => frameAt(0));
  const s = { duration, music, sounds, ready, seek: async t => { await ready; frameAt(t); } };
  if (!Q.get('rec')) ready.then(() => { const t0 = performance.now(); const loop = () => { frameAt(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); }; loop(); });
  return s;
}
/* load JSON files next to the page, then build: Units.withData(['data/a.json'], ([a]) => { …; return Units.scene(…); }) */
function withData(srcs, build) {
  const s = { duration: 1, seek: async () => {} };
  const load = u => new Promise((ok, no) => { const x = new XMLHttpRequest(); x.open('GET', u); x.onload = () => { try { ok(JSON.parse(x.responseText)); } catch (e) { no(new Error('bad JSON in ' + u)); } };
    x.onerror = () => no(new Error('cannot load ' + u + ' — render through render.py, or serve the folder')); x.send(); });
  s.ready = Promise.all(srcs.map(load)).then(ds => { const real = build(ds); Object.assign(s, real); return real.ready; });
  return s;
}

window.Units = { create, split, list, mark, grid, ring, line, side, rows, waffle, bounds, crowd, unit, fraction, legend, spotlight, mix, tag, tags, counter, text, source,
  track, camera, toScreen, follow, lens, ruler, finish, scene, withData, cl, seg, lerp, oc, io, sm, hash, TAU, SANS, TEXT, SERIF };
})();
