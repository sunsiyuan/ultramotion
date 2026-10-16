/* Data Story — years of data, played as time: an axis that grows with the data, a line or bars that carry the years,
   a big year behind everything, only the point being talked about named, a number that rolls with the head.
   Canvas 2D, no dependencies. Every frame is a pure function of t.

   const E = Trend.create({ width: 1080, height: 1920, time: [[0, 1949], [6, 1963], [9, 1963], [30, 2025]] });
   E.realAt(t) → the data time shown at video second t (years as numbers, or ms for dates) — a piecewise warp:
   fly over the quiet years, slow down where the story is, hold (two keys with the same data time) on the moment.
   window.__scene = Trend.scene(E, (ctx, t, E) => { … draw … }, { duration, music, sounds });
*/
(function () {
const TAU = Math.PI * 2;
const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
const seg = (t, a, z) => cl((t - a) / (z - a));
const lerp = (a, z, u) => a + (z - a) * u;
const oc = u => 1 - Math.pow(1 - u, 3);
const io = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const sm = u => { u = cl(u); return u * u * (3 - 2 * u); };
const pop = (t, t0, d = .5) => { const u = cl((t - t0) / d); return u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(10 * u); };
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SANS = '"SF Pro Display", "Helvetica Neue", "PingFang SC", sans-serif', TEXT = '"PingFang SC", "SF Pro Text", "Helvetica Neue", sans-serif', MONO = '"SF Mono", "Menlo", monospace';
const date = s => Date.parse(s.length <= 10 ? s + 'T00:00:00Z' : s);              // '2016-10-12' → ms (UTC)
const isMs = r => Math.abs(r) > 1e10;

function create(o = {}) {
  const W = o.width || 1080, H = o.height || 1920;
  const cv = o.canvas || document.querySelector('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const keys = (o.time || [[0, 0], [1, 1]]).slice().sort((a, b) => a[0] - b[0]);
  function realAt(t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, ra] = keys[i - 1], [b, rb] = keys[i]; const u = (t - a) / (b - a); return ra + (rb - ra) * (o.easeTime === false ? u : sm(u) * .35 + u * .65); }
    return keys[keys.length - 1][1];
  }
  function tAt(r) { for (let i = 1; i < keys.length; i++) { const [a, ra] = keys[i - 1], [b, rb] = keys[i]; if ((r - ra) * (r - rb) <= 0 && ra !== rb) { let lo = a, hi = b; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; ((realAt(m) - r) * (rb - ra) < 0) ? lo = m : hi = m; } return (lo + hi) / 2; } } return keys[keys.length - 1][0]; }
  return { W, H, ctx, canvas: cv, realAt, tAt, end: keys[keys.length - 1][0] };
}

/* ---------- series: [[time, value], …] sorted by time ---------- */
/* the value at x, interpolated; outside the series it holds the first / last value, or gives NaN with strict (a country with no data yet) */
function at(series, x, strict = false) {
  if (!series.length) return NaN; const n = series.length;
  if (x <= series[0][0]) return strict && x < series[0][0] - 1e-9 ? NaN : series[0][1]; if (x >= series[n - 1][0]) return strict && x > series[n - 1][0] + 1e-9 ? NaN : series[n - 1][1];
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; series[m][0] <= x ? lo = m : hi = m; }
  const [ta, va] = series[lo], [tb, vb] = series[hi]; return va + (vb - va) * (x - ta) / (tb - ta);
}
function upTo(series, x, from = -Infinity) {
  const out = []; let i = 0; while (i < series.length && series[i][0] <= x) { if (series[i][0] >= from) out.push(series[i]); i++; }
  if (i < series.length && i > 0 && series[i - 1][0] < x && x >= from) out.push([x, at(series, x)]);
  return out;
}
/* [min, max] of the values seen up to x — the axis can follow the data with this and stay continuous */
function extent(series, x, from = -Infinity) { let lo = Infinity, hi = -Infinity; upTo(series, x, from).forEach(([, v]) => { if (v < lo) lo = v; if (v > hi) hi = v; }); return [lo, hi]; }

/* ---------- the chart's frame ---------- */
/* box [x0, y0, x1, y1] (y0 = top); t: [t0, t1]; v: [v0, v1]; log: 0 = linear … 1 = logarithmic (animate it to switch scales on screen) */
function frame({ box, t, v, log = 0 }) {
  const [x0, y0, x1, y1] = box, [t0, t1] = t, [v0, v1] = v;
  const X = x => x0 + (x - t0) / (t1 - t0) * (x1 - x0);
  const lin = q => y1 - (q - v0) / (v1 - v0) * (y1 - y0);
  const lg = q => { const a = Math.log(Math.max(v0, 1e-9)), b = Math.log(v1); return y1 - (Math.log(Math.max(q, 1e-9)) - a) / (b - a) * (y1 - y0); };
  const Y = q => log <= 0 ? lin(q) : log >= 1 ? lg(q) : lerp(lin(q), lg(q), log);
  return { X, Y, box, t, v, log };
}
/* nice ticks for a value range; each with an alpha that fades in as the axis stretches far enough to fit it (no popping while the axis moves) */
function ticks(F, { minGap = 120 } = {}) {
  const [x0, y0, x1, y1] = F.box, [v0, v1] = F.v, px = Math.abs(y1 - y0), out = new Map();
  const put = (v, a) => { if (a > 0 && v >= v0 - 1e-9 && v <= v1 + 1e-9) out.set(+v.toPrecision(12), Math.max(out.get(+v.toPrecision(12)) || 0, a)); };
  const linA = 1 - sm(F.log * 2 - .5), logA = sm(F.log * 2 - .5);
  if (linA > 0) { const per = px / (v1 - v0);
    for (let k = Math.floor(Math.log10(v1 - v0)) + 1; k >= Math.floor(Math.log10(v1 - v0)) - 3; k--) [5, 2, 1].forEach(m => { const s = m * Math.pow(10, k), gap = s * per; if (gap > px) return;
      const a = sm((gap - minGap) / minGap) * linA; if (a <= 0) return; for (let q = Math.ceil(v0 / s) * s; q <= v1; q += s) put(q, a); }); }
  if (logA > 0 && v0 > 0) { const dec = px / (Math.log10(v1) - Math.log10(v0));
    for (let k = Math.floor(Math.log10(v0)); k <= Math.ceil(Math.log10(v1)); k++) { const d = Math.pow(10, k);
      put(d, sm((dec - minGap * .6) / minGap) * logA); put(2 * d, sm((dec * .3 - minGap) / minGap) * logA); put(5 * d, sm((dec * .3 - minGap) / minGap) * logA); } }
  return [...out].map(([v, a]) => ({ v, a })).sort((p, q) => p.v - q.v);
}
/* horizontal grid lines with their values; format(v) → text. Lines faint, labels small. side: 'left' / 'right' (above the line, inside) or 'out' (beside the line, right of the box) */
function grid(ctx, F, { format = fmt.compact, color = 'rgba(236,232,224,.09)', label = 'rgba(236,232,224,.38)', size = 24, side = 'left', minGap = 120, width = 2, a = 1, zero = true } = {}) {
  const [x0, y0, x1, y1] = F.box; ctx.save(); ctx.lineWidth = width; ctx.font = `500 ${size}px ${TEXT}`; ctx.textBaseline = 'bottom';
  ticks(F, { minGap }).forEach(({ v, a: k }) => { const y = F.Y(v); if (!zero && v === 0) return; ctx.globalAlpha = a * k; ctx.strokeStyle = color; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
    ctx.fillStyle = label; if (side === 'out') { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(format(v), x1 + 14, y); ctx.textBaseline = 'bottom'; }
    else { ctx.textAlign = side === 'left' ? 'left' : 'right'; ctx.fillText(format(v), side === 'left' ? x0 : x1, y - 8); } });
  ctx.restore();
}
/* time labels along the bottom: every `every` years (or a list); fades labels that would crowd */
function timeAxis(ctx, F, { every = 10, values = null, format = v => isMs(v) ? String(new Date(v).getUTCFullYear()) : String(Math.round(v)), color = 'rgba(236,232,224,.38)', size = 24, y = null, a = 1, upto = Infinity } = {}) {
  const [x0, y0, x1, y1] = F.box, [t0, t1] = F.t; let vs = values;
  if (!vs) { vs = []; if (isMs(t0)) { for (let yr = new Date(t0).getUTCFullYear(); yr <= new Date(t1).getUTCFullYear(); yr++) if (yr % every === 0) vs.push(Date.UTC(yr, 0, 1)); }
    else for (let q = Math.ceil(t0 / every) * every; q <= t1; q += every) vs.push(q); }
  ctx.save(); ctx.font = `500 ${size}px ${TEXT}`; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  vs.forEach(q => { const x = F.X(q); if (x < x0 - 1 || x > x1 + 1) return; ctx.globalAlpha = a * (q <= upto ? 1 : .0); ctx.fillText(format(q), x, (y ?? y1) + 16); });
  ctx.restore();
}

/* ---------- what carries time ---------- */
/* a line drawn up to `now`; the head glows. color can be a function of the point (t, v) → colour for a two-colour line. Returns the head { x, y, v, t }. */
function line(ctx, series, now, F, { color = '#ece8e0', width = 4, head = '#ff3b30', glow = true, fill = null, from = -Infinity, clip = true, dash = null } = {}) {
  const pts = upTo(series, now, from); if (pts.length < 2) return null;
  const [x0, y0, x1, y1] = F.box; ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (clip) { ctx.beginPath(); ctx.rect(x0 - 2, -1e5, x1 - x0 + 4, 2e5); ctx.clip(); }
  if (fill) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, fill); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(F.X(pts[0][0]), y1); pts.forEach(([t, v]) => ctx.lineTo(F.X(t), F.Y(v))); ctx.lineTo(F.X(pts[pts.length - 1][0]), y1); ctx.fill(); }
  ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  if (typeof color === 'function') { for (let i = 1; i < pts.length; i++) { ctx.strokeStyle = color(pts[i][0], pts[i][1]); ctx.beginPath(); ctx.moveTo(F.X(pts[i - 1][0]), F.Y(pts[i - 1][1])); ctx.lineTo(F.X(pts[i][0]), F.Y(pts[i][1])); ctx.stroke(); } }
  else { ctx.strokeStyle = color; ctx.beginPath(); pts.forEach(([t, v], k) => k ? ctx.lineTo(F.X(t), F.Y(v)) : ctx.moveTo(F.X(t), F.Y(v))); ctx.stroke(); }
  ctx.setLineDash([]);
  const [ht, hv] = pts[pts.length - 1], hx = F.X(ht), hy = F.Y(hv);
  if (head) { if (glow) { const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, width * 16); g.addColorStop(0, head + 'a0'); g.addColorStop(1, head + '00'); ctx.fillStyle = g; ctx.fillRect(hx - width * 16, hy - width * 16, width * 32, width * 32); }
    ctx.fillStyle = head; ctx.beginPath(); ctx.arc(hx, hy, width * 2.2, 0, TAU); ctx.fill(); }
  ctx.restore(); return { x: hx, y: hy, v: hv, t: ht };
}
/* the fall from the running peak, shaded between the peak level and the line; returns { pct (≤ 0), peakT, peakV } at `now` */
function drawdown(ctx, series, now, F, { color = 'rgba(255,59,48,.22)', edge = 'rgba(255,59,48,.55)', from = -Infinity, a = 1, min = -.2 } = {}) {
  const pts = upTo(series, now, from); if (pts.length < 2) return { pct: 0 };
  let pk = pts[0], runs = [], cur = null;
  pts.forEach(p => { if (p[1] >= pk[1]) { pk = p; if (cur) { runs.push(cur); cur = null; } } else { cur = cur || { peak: pk, pts: [] }; cur.pts.push(p); } });
  if (cur) runs.push(cur);
  ctx.save(); ctx.globalAlpha = a;
  runs.forEach(r => { const low = Math.min(...r.pts.map(p => p[1])); if (low / r.peak[1] - 1 > min) return;          // only the big falls
    ctx.beginPath(); ctx.moveTo(F.X(r.peak[0]), F.Y(r.peak[1])); r.pts.forEach(([t, v]) => ctx.lineTo(F.X(t), F.Y(v))); const last = r.pts[r.pts.length - 1]; ctx.lineTo(F.X(last[0]), F.Y(r.peak[1])); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(F.X(r.peak[0]), F.Y(r.peak[1])); ctx.lineTo(F.X(last[0]), F.Y(r.peak[1])); ctx.stroke(); ctx.setLineDash([]); });
  ctx.restore();
  const last = pts[pts.length - 1]; return { pct: last[1] / pk[1] - 1, peakT: pk[0], peakV: pk[1] };
}
/* one column per period (a year, a month): columns before `now` are standing, the one at `now` is growing.
   color(t, v) → colour, so only the ones being talked about are bright. width: fraction of the period. */
function columns(ctx, series, now, F, { color = () => '#ece8e0', width = .72, period = null, grow = 1, radius = 0, base = null } = {}) {
  const per = period || (series.length > 1 ? series[1][0] - series[0][0] : 1), y1 = base ?? F.Y(F.v[0] > 0 && F.log ? F.v[0] : 0), w = Math.abs(F.X(per) - F.X(0)) * width;
  ctx.save();
  series.forEach(([t, v]) => { const u = cl((now - t) / (per * grow)); if (u <= 0) return; const h = (y1 - F.Y(v)) * oc(u), x = F.X(t) - w / 2;
    ctx.fillStyle = color(t, v); if (radius) { ctx.beginPath(); ctx.roundRect(x, y1 - h, w, h, [Math.min(radius, w / 2), Math.min(radius, w / 2), 0, 0]); ctx.fill(); } else ctx.fillRect(x, y1 - h, w, h); });
  ctx.restore();
}
/* layers stacked on each other up to `now`: layers [{ name, series, color, label? }] bottom first, each series [[time, value], …] on the same times.
   Each layer's name sits inside it where it is thickest (if it is thick enough). Returns { top: [[time, total], …], at: { name: { y0, y1 } } at `now` }. */
function stack(ctx, layers, now, F, { size = 28, ink = '#0b0b0c', labels = true, a = 1, minLabel = 1.5, edge = 'rgba(0,0,0,.25)' } = {}) {
  const ts = layers[0].series.map(p => p[0]).filter(t => t <= now); if (ts.length && ts[ts.length - 1] < now && now <= layers[0].series[layers[0].series.length - 1][0]) ts.push(now);
  if (ts.length < 2) return { top: [], at: {} };
  let base = ts.map(() => 0); const out = { at: {} }, names = [];
  ctx.save(); ctx.globalAlpha *= a; ctx.lineJoin = 'round';
  layers.forEach(L => {
    const v = ts.map(t => Math.max(0, at(L.series, t))), top = v.map((q, i) => base[i] + q);
    ctx.beginPath(); ts.forEach((t, i) => i ? ctx.lineTo(F.X(t), F.Y(top[i])) : ctx.moveTo(F.X(t), F.Y(top[i]))); for (let i = ts.length - 1; i >= 0; i--) ctx.lineTo(F.X(ts[i]), F.Y(base[i])); ctx.closePath();
    ctx.fillStyle = L.color; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.5; ctx.stroke();
    if (labels) {   // the name goes where the layer is thick, as a weighted average, so it glides instead of jumping; it fades near the edges and where the layer is thin
      ctx.font = `700 ${size}px ${TEXT}`; const w = ctx.measureText(L.label || L.name).width / 2 + 10, xEnd = F.X(ts[ts.length - 1]), hmin = size * minLabel;
      let sw = 0, st = 0, best = 0;
      ts.forEach((t, i) => { const x = F.X(t), h = F.Y(base[i]) - F.Y(top[i]), e = sm((x - w - F.box[0]) / 60) * sm((xEnd - x - w) / 60), q = Math.max(0, h - hmin) * e;
        sw += q * q * q; st += q * q * q * t; best = Math.max(best, q); });
      if (sw > 0) { const tl = st / sw, B = ts.map((t, i) => [t, base[i]]), Tp = ts.map((t, i) => [t, top[i]]);
        names.push([L.label || L.name, L.ink || ink, F.X(tl), (F.Y(at(B, tl)) + F.Y(at(Tp, tl))) / 2, sm(best / size)]); } }
    out.at[L.name] = { y0: F.Y(base[base.length - 1]), y1: F.Y(top[top.length - 1]) };
    base = top;
  });
  ctx.font = `700 ${size}px ${TEXT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; names.forEach(([n, col, x, y, la]) => { ctx.globalAlpha = a * la; ctx.fillStyle = col; ctx.fillText(n, x, y); });   // names last, so no layer covers them
  ctx.restore(); out.top = ts.map((t, i) => [t, base[i]]); return out;
}
/* a legend that stays put: items [{ name, color, value }] in a grid of `cols` columns from (x, y); value is an optional string after the name (a share that rolls with the clock).
   Use it under a stack or a set of lines whenever some layers get too thin to carry their own names. */
function legend(ctx, items, { x, y, cols = 3, colW = 290, rowH = 56, size = 28, swatch = 22, color = '#ece8e0', valueColor = 'rgba(236,232,224,.6)', a = 1 } = {}) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  items.forEach((it, i) => { const cx = x + (i % cols) * colW, cy = y + Math.floor(i / cols) * rowH;
    ctx.fillStyle = it.color; ctx.beginPath(); ctx.roundRect(cx, cy - swatch / 2, swatch, swatch, 4); ctx.fill();
    ctx.font = `600 ${size}px ${TEXT}`; ctx.fillStyle = color; ctx.fillText(it.name, cx + swatch + 12, cy);
    if (it.value) { const w = ctx.measureText(it.name).width; ctx.font = `500 ${size * .9}px ${SANS}`; ctx.fillStyle = valueColor; ctx.fillText(it.value, cx + swatch + 12 + w + 10, cy); } });
  ctx.restore();
}
/* a ranking that races: items [{ name, series, color, label? }]; the top `top` are shown as horizontal bars, sorted, swapping places smoothly.
   Names sit left of the box (right-aligned at x0 − 18), values just past the end of each bar; `room` keeps space for the value after the longest bar.
   An item counts only inside its own series (no data yet → not in the race).
   step: how often (in data time) the order is re-taken — swaps take that long. Returns { [name]: { x, y, w, h, rank, v } } for anything you add on top. */
function race(ctx, items, now, { box, top = 10, step = .25, gap = .22, format = fmt.compact, max = null, label = true, value = true, size = 34, valueSize = null, color = '#ece8e0', text = '#ece8e0', dimText = 'rgba(236,232,224,.6)', radius = 6, room = .2 } = {}) {
  const [x0, y0, x1, y1] = box, rowH = (y1 - y0) / top, barH = rowH * (1 - gap);
  const vals = items.map(it => ({ it, v: at(it.series, now, true) })).filter(q => isFinite(q.v));
  const order = when => items.map(it => ({ name: it.name, v: at(it.series, when, true) })).filter(q => isFinite(q.v)).sort((a, b) => b.v - a.v).map(q => q.name);
  const k = Math.floor(now / step), u = io(cl(now / step - k)), A = order(k * step), B = order((k + 1) * step);
  const rank = n => { const a = A.indexOf(n), b = B.indexOf(n); return lerp(a < 0 ? items.length : a, b < 0 ? items.length : b, u); };
  const M = max ?? Math.max(...vals.map(q => q.v)) * 1.04, out = {};
  ctx.save(); ctx.textBaseline = 'middle';
  vals.forEach(({ it, v }) => { const r = rank(it.name); const a = cl(top - r); if (a <= 0) return;
    const y = y0 + r * rowH + (rowH - barH) / 2, w = Math.max(0, (x1 - x0) / (1 + room) * v / M);
    ctx.globalAlpha = a; ctx.fillStyle = it.color || color; ctx.beginPath(); ctx.roundRect(x0, y, Math.max(w, 2), barH, Math.min(radius, barH / 2)); ctx.fill();
    if (label) { ctx.font = `600 ${size}px ${TEXT}`; ctx.fillStyle = it.text || text; ctx.textAlign = 'right'; ctx.fillText(it.label || it.name, x0 - 18, y + barH / 2); }
    if (value) { ctx.font = `500 ${valueSize || size * .8}px ${SANS}`; ctx.fillStyle = it.valueColor || dimText; ctx.textAlign = 'left'; ctx.fillText(format(v), x0 + w + 14, y + barH / 2); }
    out[it.name] = { x: x0, y, w, h: barH, rank: r, v };
  });
  ctx.restore(); return out;
}

/* ---------- naming one thing ---------- */
/* a flag on the chart at (at, value): a dot, a thin stem and a small plate with the text — for an event on the line, a record, a crossing.
   side: 1 right / -1 left; dy: stem length up (negative = down). a: 0..1 (fade it in on its moment). */
function flag(ctx, F, at, value, { text = '', sub = '', color = '#ff3b30', plate = null, ink = '#fff', side = 1, dy = -110, dx = 24, size = 30, a = 1, dot = 7, x = null, y = null } = {}) {
  if (a <= 0) return null; const px = x ?? F.X(at), py = y ?? F.Y(value), tx = px + side * dx, ty = py + dy;
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, ty); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, dot, 0, TAU); ctx.fill();
  ctx.font = `700 ${size}px ${TEXT}`; const w1 = ctx.measureText(text).width; ctx.font = `500 ${size * .7}px ${TEXT}`; const w2 = sub ? ctx.measureText(sub).width : 0;
  const pw = Math.max(w1, w2) + size * .9, ph = size * (sub ? 2.15 : 1.45), bx = side > 0 ? tx : tx - pw, by = ty - ph / 2;
  ctx.fillStyle = plate || color; ctx.beginPath(); ctx.roundRect(bx, by, pw, ph, size * .25); ctx.fill();
  ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `700 ${size}px ${TEXT}`; ctx.fillText(text, bx + size * .45, sub ? by + size * .7 : by + ph / 2);
  if (sub) { ctx.font = `500 ${size * .7}px ${TEXT}`; ctx.globalAlpha *= .85; ctx.fillText(sub, bx + size * .45, by + size * 1.55); }
  ctx.restore(); return { x: bx, y: by, w: pw, h: ph };
}
/* labels that must not sit on top of each other: items [{ y, text, color, size, sub }] at a shared x; they keep their order,
   are pushed apart to `minGap`, kept inside [top, bottom], and a thin leader joins each to where it wanted to be (from fromX). */
function labels(ctx, items, { x, fromX = null, minGap = 44, top = 0, bottom = 1e5, align = 'left', size = 28, weight = 600, a = 1 } = {}) {
  const L = items.filter(q => q && q.text && (q.a ?? 1) > 0).map(q => ({ ...q, want: q.y, y: q.y })).sort((p, q) => p.want - q.want);
  for (let it = 0; it < 30; it++) { for (let i = 1; i < L.length; i++) { const d = L[i].y - L[i - 1].y, g = Math.max(minGap, ((L[i].size || size) + (L[i - 1].size || size)) * .62); if (d < g) { const m = (g - d) / 2; L[i].y += m; L[i - 1].y -= m; } }
    L.forEach(q => { q.y = cl(q.y, top, bottom); }); }
  ctx.save(); ctx.textBaseline = 'middle'; ctx.textAlign = align;
  L.forEach(q => { const s = q.size || size; ctx.globalAlpha = a * (q.a ?? 1);
    if (fromX !== null && Math.abs(q.y - q.want) > 2) { ctx.strokeStyle = q.color || '#ece8e0'; ctx.globalAlpha *= .5; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fromX, q.want); ctx.lineTo(x - (align === 'left' ? 10 : -10), q.y); ctx.stroke(); ctx.globalAlpha = a * (q.a ?? 1); }
    ctx.fillStyle = q.color || '#ece8e0'; ctx.font = `${q.weight || weight} ${s}px ${TEXT}`; ctx.fillText(q.text, x, q.y);
    if (q.sub) { ctx.globalAlpha *= .6; ctx.font = `500 ${s * .72}px ${TEXT}`; ctx.fillText(q.sub, x, q.y + s * .95); } });
  ctx.restore(); return L;
}

/* ---------- numbers and the year ---------- */
/* a number that rolls without the digits jumping around: fixed-width digits, separators in place. format(v) → string overrides the default. */
function counter(ctx, value, { x, y, size = 120, color = '#ece8e0', prefix = '', suffix = '', decimals = 0, align = 'left', font = SANS, weight = 700, format = null, a = 1 } = {}) {
  if (a <= 0) return 0;
  const s = format ? format(value) : prefix + value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  ctx.save(); ctx.globalAlpha *= a; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
  const dw = ctx.measureText('0').width, widths = [...s].map(ch => /[0-9]/.test(ch) ? dw : ctx.measureText(ch).width), tot = widths.reduce((p, q) => p + q, 0);
  let px = align === 'left' ? x : align === 'right' ? x - tot : x - tot / 2; ctx.textAlign = 'center';
  [...s].forEach((ch, i) => { ctx.fillText(ch, px + widths[i] / 2, y); px += widths[i]; });
  ctx.restore(); return tot;
}
/* for one value per period (a year): the period the clock is in and a value that rolls from the last period's to this one's as its column grows */
function current(series, now, { period = 1 } = {}) {
  let j = -1; while (j + 1 < series.length && series[j + 1][0] < now) j++;               // the last period that has started
  if (j < 0) return { t: series[0][0], v: series[0][1], index: 0 };
  const u = oc(cl((now - series[j][0]) / period)), prev = j ? series[j - 1][1] : series[0][1];
  return { t: series[j][0], v: lerp(prev, series[j][1], u), index: j };
}
/* the year (or month) behind everything, huge and faint; the new one slides up as it arrives */
function year(ctx, now, { x, y, size = 520, color = 'rgba(236,232,224,.06)', align = 'center', weight = 800, font = SANS, format = null, roll = .18, a = 1 } = {}) {
  let k, frac, txt;
  if (isMs(now)) { const d = new Date(now), y0 = Date.UTC(d.getUTCFullYear(), 0, 1), y1 = Date.UTC(d.getUTCFullYear() + 1, 0, 1); k = d.getUTCFullYear(); frac = (now - y0) / (y1 - y0); }
  else { k = Math.floor(now); frac = now - k; }
  if (frac < 1e-9) frac = 1;                                                         // held exactly on a year: show it, not the slide
  txt = format ? format(k) : String(k); const prev = format ? format(k - 1) : String(k - 1), u = oc(cl(frac / roll));
  ctx.save(); ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fontVariantNumeric = 'tabular-nums';
  ctx.beginPath(); ctx.rect(-1e4, y - size * .8, 2e4, size * .86); ctx.clip();
  if (u < 1) { ctx.globalAlpha = a * (1 - u); ctx.fillText(prev, x, y - u * size * .5); }
  ctx.globalAlpha = a * u; ctx.fillText(txt, x, y + (1 - u) * size * .5);
  ctx.restore();
}
const fmt = {
  compact: v => { const a = Math.abs(v); return a >= 1e12 ? +(v / 1e12).toFixed(a >= 1e13 ? 0 : 1) + 'T' : a >= 1e9 ? +(v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B' : a >= 1e6 ? +(v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M' : a >= 1e3 ? +(v / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'K' : String(+v.toFixed(2)); },
  wan: v => { const a = Math.abs(v); return a >= 1e8 ? +(v / 1e8).toFixed(a >= 1e9 ? 0 : 1) + ' 亿' : a >= 1e4 ? +(v / 1e4).toFixed(a >= 1e5 ? 0 : 1) + ' 万' : String(+v.toFixed(2)); },
  money: (v, cur = '$') => cur + (Math.abs(v) >= 1000 ? fmt.compact(v) : v >= 10 ? v.toFixed(0) : v.toFixed(2)),
};

/* ---------- scale you can see ---------- */
/* units: n of `total` cells shown, laid out in a block that grows upward; newly added cells fall in from above */
function units(ctx, n, { total, x, y, cols = 50, size = 13, gap = 4, color = '#ff3b30', dim = .68, fall = 6, shape = 'square' } = {}) {
  const whole = Math.floor(n), frac = n - whole;
  ctx.save(); const base = ctx.globalAlpha;
  for (let i = 0; i < Math.min(whole + fall, total); i++) {
    const col = i % cols, row = Math.floor(i / cols), cx = x + col * (size + gap), cy = y - row * (size + gap);
    let yy = cy, a = i >= whole - cols ? 1 : dim;
    if (i >= whole) { const k = i - whole + (1 - frac); yy = cy - k * size * 2.2; a = Math.max(0, 1 - k / fall) * .9; }
    ctx.globalAlpha = base * a; ctx.fillStyle = color;
    if (shape === 'person') { const m = cx + size / 2; ctx.beginPath(); ctx.arc(m, yy - size * .8, size * .17, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(m - size * .3, yy); ctx.lineTo(m - size * .3, yy - size * .4); ctx.quadraticCurveTo(m - size * .3, yy - size * .6, m, yy - size * .6); ctx.quadraticCurveTo(m + size * .3, yy - size * .6, m + size * .3, yy - size * .4); ctx.lineTo(m + size * .3, yy); ctx.closePath(); ctx.fill(); }
    else ctx.fillRect(cx, yy - size, size, size);
  }
  ctx.restore();
  return { top: y - Math.ceil(total / cols) * (size + gap) };
}

/* ---------- words ---------- */
function text(ctx, s, x, y, { size = 40, color = '#ece8e0', weight = 600, font = TEXT, align = 'left', a = 1, rise = 0, baseline = 'alphabetic' } = {}) {
  if (a <= 0) return 0; ctx.save(); ctx.globalAlpha *= a; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = baseline; ctx.fillText(s, x, y + (1 - a) * rise); const w = ctx.measureText(s).width; ctx.restore(); return w;
}
function source(ctx, s, { x = 80, y = null, size = 22, color = 'rgba(236,232,224,.36)' } = {}) { text(ctx, s, x, y ?? ctx.canvas.height - 70, { size, weight: 400, color }); }

/* ---------- camera ---------- */
/* push in on a point: everything drawn after this is scaled by z around (cx, cy) and moved so (cx, cy) lands at (tx, ty). Wrap in save/restore. */
function camera(ctx, { cx, cy, z = 1, tx = cx, ty = cy, rotate = 0 }) { ctx.translate(tx, ty); if (rotate) ctx.rotate(rotate * Math.PI / 180); ctx.scale(z, z); ctx.translate(-cx, -cy); }

/* ---------- film ---------- */
let GRAIN = null;
function finish(ctx, t, { grain = .06, vignette = .45, W = ctx.canvas.width, H = ctx.canvas.height } = {}) {
  if (vignette) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .58); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vignette})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (grain) {
    if (!GRAIN) { GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 256; const g = GRAIN.getContext('2d'), d = g.createImageData(256, 256);
      for (let i = 0; i < d.data.length; i += 4) { const v = hash(i * .37) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }
    const f = Math.floor(t * 30), ox = hash(f) * 256, oy = hash(f + 7.3) * 256;
    ctx.save(); ctx.globalAlpha = grain; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.translate(-ox, -oy); ctx.fillRect(ox, oy, W, H); ctx.restore();
  }
}
/* a soft tick each time the data clock passes a step (a year: every = 1; a month in ms: every = 'month'), so the ticking follows the warp;
   ticks closer than minGap merge. → sounds for Trend.scene */
function tick(E, { every = 1, from = 0, to = E.end, kind = 'tick', alt = 'tock', minGap = .08, v = .4, fps = 240 } = {}) {
  const key = r => every === 'month' ? (d => d.getUTCFullYear() * 12 + d.getUTCMonth())(new Date(r)) : every === 'year' && isMs(r) ? new Date(r).getUTCFullYear() : Math.floor(r / every);
  const out = []; let prev = key(E.realAt(from)), last = -1, k = 0;
  for (let t = from; t <= to; t += 1 / fps) { const cur = key(E.realAt(t)); if (cur !== prev) { if (t - last >= minGap) { out.push({ t, kind: k++ % 2 ? alt : kind, v }); last = t; } prev = cur; } }
  return out;
}

function scene(E, draw, { duration, music = null, sounds = [], background = '#0a0a0b' } = {}) {
  const Q = new URLSearchParams(location.search);
  const frameAt = t => { const c = E.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.fillStyle = background; c.fillRect(0, 0, E.W, E.H); draw(c, t, E); };
  const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => frameAt(0));
  const s = { duration, music, sounds, ready, seek: async t => { await ready; frameAt(t); } };
  if (!Q.get('rec')) ready.then(() => { const t0 = performance.now(); const loop = () => { frameAt(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); }; loop(); });
  return s;
}
/* load JSON files and images next to the page, then build: Trend.withData(['data/a.json'], ([a]) => { …; return Trend.scene(…); }) */
function withData(srcs, build) {
  const s = { duration: 1, seek: async () => {} };
  const load = u => /\.(png|jpe?g|webp)$/i.test(u) ? new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('cannot load ' + u)); im.src = u; }) : new Promise((ok, no) => { const x = new XMLHttpRequest(); x.open('GET', u); x.onload = () => { try { ok(JSON.parse(x.responseText)); } catch (e) { no(new Error('bad JSON in ' + u)); } };
    x.onerror = () => no(new Error('cannot load ' + u + ' — render through render.py, or serve the folder')); x.send(); });
  s.ready = Promise.all(srcs.map(load)).then(ds => { const real = build(ds); Object.assign(s, real); return real.ready; });
  return s;
}

window.Trend = { create, scene, withData, at, upTo, extent, current, frame, ticks, grid, timeAxis, line, drawdown, columns, stack, legend, race, flag, labels, counter, year, fmt, units, text, source, camera, finish, tick,
  cl, seg, lerp, oc, io, sm, pop, hash, date, TAU, SANS, TEXT, MONO };
})();
