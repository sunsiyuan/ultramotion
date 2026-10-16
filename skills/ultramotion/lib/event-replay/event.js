/* Event Replay — one moment, stretched: a clock that keeps running, a line that carries time, the one minute that matters,
   scale you can see, the aftermath. Canvas 2D, no dependencies. Every frame is a pure function of t.

   const E = Replay.create({ width: 1080, height: 1920, time: [[0, realStart], [8, realA], [20, realB], …] });
   E.realAt(t) → the real time (ms) shown at video second t — a piecewise-linear warp: stretch the minutes that matter,
   fly over the hours that don't, and hold (two keys with the same real time) on the moment you want to stop on.
   window.__scene = Replay.scene(E, (ctx, t, E) => { … draw … }, { duration, music, sounds });
*/
(function () {
const TAU = Math.PI * 2;
const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
const seg = (t, a, z) => cl((t - a) / (z - a));
const lerp = (a, z, u) => a + (z - a) * u;
const oc = u => 1 - Math.pow(1 - u, 3);
const io = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const pop = (t, t0, d = .5) => { const u = cl((t - t0) / d); return u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(10 * u); };
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const SANS = '"SF Pro Display", "Helvetica Neue", "PingFang SC", sans-serif', TEXT = '"PingFang SC", "SF Pro Text", "Helvetica Neue", sans-serif', MONO = '"SF Mono", "Menlo", monospace';

function create(o = {}) {
  const W = o.width || 1080, H = o.height || 1920;
  const cv = o.canvas || document.querySelector('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const keys = (o.time || [[0, 0], [1, 1]]).slice().sort((a, b) => a[0] - b[0]);
  // video seconds → real time, eased inside each segment so the stretch has no corners
  function realAt(t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, ra] = keys[i - 1], [b, rb] = keys[i]; const u = (t - a) / (b - a); return ra + (rb - ra) * (o.easeTime === false ? u : (u * u * (3 - 2 * u)) * .35 + u * .65); }
    return keys[keys.length - 1][1];
  }
  // the inverse: when (video seconds) does the real time r arrive? — to time a sound or a label to a real moment
  function tAt(r) { for (let i = 1; i < keys.length; i++) { const [a, ra] = keys[i - 1], [b, rb] = keys[i]; if ((r - ra) * (r - rb) <= 0 && ra !== rb) { let lo = a, hi = b; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; ((realAt(m) - r) * (rb - ra) < 0) ? lo = m : hi = m; } return (lo + hi) / 2; } } return keys[keys.length - 1][0]; }
  return { W, H, ctx, canvas: cv, realAt, tAt };
}

/* ---------- time ---------- */
const pad = n => String(n).padStart(2, '0');
/* a big clock: real time in a time zone (hours offset from UTC); format 'HH:MM', 'HH:MM:SS', or 'D' for elapsed seconds since `since` */
function clock(ctx, real, { x, y, size = 150, tz = 8, format = 'HH:MM', since = null, color = '#ece8e0', dot = '#ff3b30', blink = true, align = 'left' } = {}) {
  let s;
  if (since !== null) s = `${Math.max(0, Math.floor((real - since) / 1000))}s`;
  else { const d = new Date(real + tz * 3600e3); s = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` + (format === 'HH:MM:SS' ? `:${pad(d.getUTCSeconds())}` : ''); }
  ctx.save(); ctx.font = `600 ${size}px ${SANS}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fontVariantNumeric = 'tabular-nums'; ctx.fillText(s, x, y);
  if (dot) { const w = ctx.measureText(s).width, on = !blink || (real / 1000) % 1 < .6; ctx.globalAlpha = on ? 1 : .25; ctx.fillStyle = dot; ctx.beginPath(); ctx.arc(align === 'left' ? x + w + size * .2 : x + size * .2, y - size * .33, size * .08, 0, TAU); ctx.fill(); }
  ctx.restore();
}
/* a number that rolls without the digits jumping around: fixed-width digits, separators in place */
function counter(ctx, value, { x, y, size = 120, color = '#ece8e0', prefix = '', suffix = '', decimals = 0, align = 'left', font = SANS, weight = 700 } = {}) {
  const s = prefix + value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
  ctx.save(); ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textBaseline = 'alphabetic';
  const dw = ctx.measureText('0').width, widths = [...s].map(ch => /[0-9]/.test(ch) ? dw : ctx.measureText(ch).width), tot = widths.reduce((a, b) => a + b, 0);
  let px = align === 'left' ? x : align === 'right' ? x - tot : x - tot / 2; ctx.textAlign = 'center';
  [...s].forEach((ch, i) => { ctx.fillText(ch, px + widths[i] / 2, y); px += widths[i]; });
  ctx.restore(); return tot;
}

/* ---------- a line that carries time ---------- */
/* series: [[time, value], …] sorted. Draws up to real time `now` inside box [x0, y0, x1, y1] (y0 = top);
   range: { t: [t0, t1], v: [v0, v1], log }. Returns the head point { x, y, v } so the camera or a label can follow it. */
function line(ctx, series, now, { box, range, color = '#ece8e0', width = 3.5, head = '#ff3b30', glow = true, fill = null, grid = null, from = null } = {}) {
  const [x0, y0, x1, y1] = box, [t0, t1] = range.t, [v0, v1] = range.v, L = range.log;
  const X = t => x0 + (t - t0) / (t1 - t0) * (x1 - x0), Y = v => L ? y1 - (Math.log(v) - Math.log(v0)) / (Math.log(v1) - Math.log(v0)) * (y1 - y0) : y1 - (v - v0) / (v1 - v0) * (y1 - y0);
  if (grid) { ctx.save(); ctx.strokeStyle = grid.color || 'rgba(236,232,224,.08)'; ctx.fillStyle = grid.label || 'rgba(236,232,224,.32)'; ctx.lineWidth = 2; ctx.font = `500 ${grid.size || 24}px ${TEXT}`; ctx.textAlign = 'right';
    (grid.values || []).forEach(v => { const y = Y(v); ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillText(grid.format ? grid.format(v) : v, x1, y - 10); }); ctx.restore(); }
  const pts = []; let i = 0; while (i < series.length && series[i][0] <= now) { if (from === null || series[i][0] >= from) pts.push(series[i]); i++; }
  if (i < series.length && i > 0 && series[i - 1][0] < now) { const [ta, va] = series[i - 1], [tb, vb] = series[i], u = (now - ta) / (tb - ta); pts.push([now, va + (vb - va) * u]); }
  if (pts.length < 2) return null;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 1, -1e5, x1 - x0 + 2, 2e5); ctx.clip();                  // the line stays inside its box while the window moves
  if (fill) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, fill); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(X(pts[0][0]), y1); pts.forEach(([t, v]) => ctx.lineTo(X(t), Y(v))); ctx.lineTo(X(pts[pts.length - 1][0]), y1); ctx.fill(); }
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); pts.forEach(([t, v], k) => k ? ctx.lineTo(X(t), Y(v)) : ctx.moveTo(X(t), Y(v))); ctx.stroke(); ctx.restore();
  const [ht, hv] = pts[pts.length - 1], hx = X(ht), hy = Y(hv);
  if (head) { if (glow) { const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 64); g.addColorStop(0, head + 'b0'); g.addColorStop(1, head + '00'); ctx.fillStyle = g; ctx.fillRect(hx - 64, hy - 64, 128, 128); }
    ctx.fillStyle = head; ctx.beginPath(); ctx.arc(hx, hy, width * 2.8, 0, TAU); ctx.fill(); }
  ctx.restore(); return { x: hx, y: hy, v: hv, X, Y };
}
/* a marker on the line at a real moment: a vertical rule, a dot, a small card — appears when the line reaches it */
function mark(ctx, at, value, now, P, { label = '', sub = '', color = '#ff3b30', side = 1, dy = -120, size = 34, a = null } = {}) {
  if (!P || now < at) return; const x = P.X(at), y = P.Y(value);
  if (a === null) a = oc(cl((now - at) / 1e5));               // by real time; pass `a` when time is held still
  ctx.save(); ctx.globalAlpha *= a; ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([5, 7]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 30, y + dy); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill();
  ctx.textAlign = side > 0 ? 'left' : 'right'; ctx.font = `700 ${size}px ${SANS}`; ctx.fillText(label, x + side * 38, y + dy + 8);
  if (sub) { ctx.font = `500 ${size * .62}px ${TEXT}`; ctx.fillStyle = 'rgba(236,232,224,.6)'; ctx.fillText(sub, x + side * 38, y + dy + 8 + size * .95); }
  ctx.restore();
}

/* ---------- scale you can see ---------- */
/* units: n of `total` cells shown, laid out in a block that grows upward; newly added cells fall in from above */
function units(ctx, n, { total, x, y, cols = 50, size = 13, gap = 4, color = '#ff3b30', dim = .68, fall = 6, shape = 'square', t = 0 } = {}) {
  const whole = Math.floor(n), frac = n - whole;
  ctx.save(); const base = ctx.globalAlpha;
  for (let i = 0; i < Math.min(whole + fall, total); i++) {
    const col = i % cols, row = Math.floor(i / cols), cx = x + col * (size + gap), cy = y - row * (size + gap);
    let yy = cy, a = i >= whole - cols ? 1 : dim;
    if (i >= whole) { const k = i - whole + (1 - frac); yy = cy - k * size * 2.2; a = Math.max(0, 1 - k / fall) * .9; }   // still falling
    ctx.globalAlpha = base * a; ctx.fillStyle = color;
    if (shape === 'person') { const m = cx + size / 2; ctx.beginPath(); ctx.arc(m, yy - size * .8, size * .17, 0, TAU); ctx.fill();                  // a head and rounded shoulders
      ctx.beginPath(); ctx.moveTo(m - size * .3, yy); ctx.lineTo(m - size * .3, yy - size * .4); ctx.quadraticCurveTo(m - size * .3, yy - size * .6, m, yy - size * .6); ctx.quadraticCurveTo(m + size * .3, yy - size * .6, m + size * .3, yy - size * .4); ctx.lineTo(m + size * .3, yy); ctx.closePath(); ctx.fill(); }
    else ctx.fillRect(cx, yy - size, size, size);
  }
  ctx.restore();
  return { top: y - Math.ceil(total / cols) * (size + gap) };
}

/* ---------- maps ---------- */
/* decode a TopoJSON object into polygons [[ [lon, lat], … ], …] (outer rings) with their properties */
function topo(tj, object) {
  const [sx, sy] = tj.transform.scale, [tx, ty] = tj.transform.translate;
  const arcs = tj.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
  const ring = r => { const out = []; r.forEach(i => { const p = i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); out.push(...(out.length ? p.slice(1) : p)); }); return out; };
  const res = [];
  tj.objects[object].geometries.forEach(g => { const ps = g.type === 'MultiPolygon' ? g.arcs : g.type === 'Polygon' ? [g.arcs] : []; ps.forEach(p => res.push({ id: g.id, props: g.properties || {}, ring: ring(p[0]) })); });
  return res;
}
/* a map view: centre [lon, lat] and a scale (px per degree of latitude); equirectangular with cos(lat) on longitude, good up to a continent */
/* a view: { center: [lon, lat], scale (px per degree of latitude), W, H, tilt (degrees, 0 = looking straight down), rotate (degrees), dx, dy (shift on screen) }
   equirectangular with cos(lat) on longitude, good up to a continent. P([lon, lat], z) → [x, y]; z lifts the point z px off the ground. P.depth(ll): larger = nearer */
function proj(view) {
  const k = Math.cos(view.center[1] * Math.PI / 180), ti = (view.tilt || 0) * Math.PI / 180, ro = (view.rotate || 0) * Math.PI / 180;
  const ct = Math.cos(ti), st = Math.sin(ti), cr = Math.cos(ro), sr = Math.sin(ro), cx = view.W / 2 + (view.dx || 0), cy = view.H / 2 + (view.dy || 0);
  const plane = ([lon, lat]) => { const x = (lon - view.center[0]) * view.scale * k, y = -(lat - view.center[1]) * view.scale; return [x * cr - y * sr, x * sr + y * cr]; };
  const P = (ll, z = 0) => { const [x, y] = plane(ll); return [cx + x, cy + y * ct - z * st]; };
  P.depth = ll => plane(ll)[1]; P.view = view;
  return P;
}
function lerpView(a, b, u) {
  const L = (k, d = 0) => lerp(a[k] ?? d, b[k] ?? d, u);
  return { center: [lerp(a.center[0], b.center[0], u), lerp(a.center[1], b.center[1], u)], scale: Math.exp(lerp(Math.log(a.scale), Math.log(b.scale), u)), W: a.W, H: a.H, tilt: L('tilt'), rotate: L('rotate'), dx: L('dx'), dy: L('dy') };
}
/* a picture of the ground (relief.py makes one: equirectangular, box [w, s, e, n]) laid under the map, following any view, tilt and turn included */
function basemap(ctx, img, box, P, { alpha = 1 } = {}) {
  const [w, s, e, n] = box, p0 = P([w, n]), p1 = P([e, n]), p2 = P([w, s]);
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.transform((p1[0] - p0[0]) / img.width, (p1[1] - p0[1]) / img.width, (p2[0] - p0[0]) / img.height, (p2[1] - p0[1]) / img.height, p0[0], p0[1]);
  ctx.drawImage(img, 0, 0); ctx.restore();
}
/* regions raised as blocks: height(p) in px (0 = flat), top(p) / side(p) colours; drawn far to near so nearer blocks cover farther ones */
function extrude(ctx, polys, P, { height = () => 0, top = () => '#444', side = null, edge = 'rgba(0,0,0,.35)', width = 1 } = {}) {
  const cen = p => { let x = 0, y = 0; p.ring.forEach(c => { x += c[0]; y += c[1]; }); return [x / p.ring.length, y / p.ring.length]; };
  polys.map(p => [P.depth(cen(p)), p]).sort((a, b) => a[0] - b[0]).forEach(([, p]) => {
    const h = height(p) || 0, col = top(p);
    if (h > .5) { ctx.beginPath(); const r = p.ring;
      for (let i = 0; i < r.length - 1; i++) { const a0 = P(r[i]), b0 = P(r[i + 1]), b1 = P(r[i + 1], h), a1 = P(r[i], h); ctx.moveTo(a0[0], a0[1]); ctx.lineTo(b0[0], b0[1]); ctx.lineTo(b1[0], b1[1]); ctx.lineTo(a1[0], a1[1]); ctx.closePath(); }
      ctx.fillStyle = side ? side(p) : shade(col, .55); ctx.fill(); }
    ctx.beginPath(); p.ring.forEach((c, i) => { const [x, y] = P(c, h); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = width; ctx.stroke();
  });
}
function shade(col, k) { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = col; const v = c.fillStyle;
  if (v[0] === '#') { const n = parseInt(v.slice(1), 16); return `rgb(${(n >> 16) * k | 0},${(n >> 8 & 255) * k | 0},${(n & 255) * k | 0})`; }
  return v.replace(/rgba?\(([^)]+)\)/, (m, a) => { const q = a.split(',').map(Number); return `rgba(${q[0] * k | 0},${q[1] * k | 0},${q[2] * k | 0},${q[3] ?? 1})`; }); }
function land(ctx, polys, P, { fill = '#1b1d22', stroke = 'rgba(236,232,224,.18)', width = 1.5, style = null } = {}) {
  ctx.save(); ctx.lineJoin = 'round';
  polys.forEach(p => { const st = style ? style(p) || {} : {}; ctx.beginPath(); p.ring.forEach((c, i) => { const [x, y] = P(c); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
    ctx.fillStyle = st.fill || fill; ctx.fill(); ctx.strokeStyle = st.stroke || stroke; ctx.lineWidth = st.width || width; ctx.stroke(); });
  ctx.restore();
}
/* a ring spreading from a point at a speed (km/s), drawn on the map at real time `now`; km → degrees of latitude */
function wave(ctx, P, at, center, now, { speed = 3.5, color = '#ff3b30', width = 3, fade = 1500, scale } = {}) {
  const sec = (now - at) / 1000; if (sec <= 0) return; const km = sec * speed, deg = km / 111.2;
  const [cx, cy] = P(center), v = P.view, r = deg * v.scale, ry = r * Math.cos((v.tilt || 0) * Math.PI / 180);
  ctx.save(); ctx.globalAlpha = Math.max(0, 1 - km / fade); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.ellipse(cx, cy, r, ry, 0, 0, TAU); ctx.stroke(); ctx.restore();
  return km;
}
function place(ctx, P, [lon, lat], name, { color = '#ece8e0', size = 30, dot = 7, side = 1, a = 1, sub = '' } = {}) {
  if (a <= 0) return; const [x, y] = P([lon, lat]);
  ctx.save(); const base = ctx.globalAlpha; ctx.globalAlpha = base * a; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, dot, 0, TAU); ctx.fill();
  ctx.font = `600 ${size}px ${TEXT}`; ctx.textAlign = side > 0 ? 'left' : 'right'; ctx.textBaseline = 'middle'; ctx.fillText(name, x + side * (dot + 10), y);
  if (sub) { ctx.font = `500 ${size * .72}px ${TEXT}`; ctx.globalAlpha = base * a * .65; ctx.fillText(sub, x + side * (dot + 10), y + size); }
  ctx.restore();
}

/* ---------- words ---------- */
function text(ctx, s, x, y, { size = 40, color = '#ece8e0', weight = 600, font = TEXT, align = 'left', a = 1, rise = 0 } = {}) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.font = `${weight} ${size}px ${font}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y + (1 - a) * rise); ctx.restore();
}
function source(ctx, s, { W = 1080, H = 1920, size = 22 } = {}) { text(ctx, s, 80, H - 70, { size, weight: 400, color: 'rgba(236,232,224,.32)' }); }

/* ---------- film ---------- */
/* grain that changes every frame and a soft vignette, over everything */
let GRAIN = null;
function finish(ctx, t, { grain = .07, vignette = .55, W = ctx.canvas.width, H = ctx.canvas.height } = {}) {
  if (vignette) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .58); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${vignette})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (grain) {
    if (!GRAIN) { GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 256; const g = GRAIN.getContext('2d'), d = g.createImageData(256, 256);
      for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }
    const f = Math.floor(t * 30), ox = hash(f) * 256, oy = hash(f + 7.3) * 256;
    ctx.save(); ctx.globalAlpha = grain; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = ctx.createPattern(GRAIN, 'repeat'); ctx.translate(-ox, -oy); ctx.fillRect(ox, oy, W, H); ctx.restore();
  }
}
/* the clock's sound: one tick each time the real clock passes a step (every ms), so the ticking speeds up and slows down with time itself;
   ticks closer than minGap merge into a fast rattle. → sounds for Replay.scene */
function ticks(E, { every = 1000, from = 0, to = 1e9, kind = 'tick', alt = 'tock', minGap = .07, v = .5, fps = 240 } = {}) {
  const out = []; let prev = Math.floor(E.realAt(from) / every), last = -1, k = 0;
  for (let t = from; t <= to; t += 1 / fps) { const cur = Math.floor(E.realAt(t) / every); if (cur !== prev) { if (t - last >= minGap) { out.push({ t, kind: k++ % 2 ? alt : kind, v }); last = t; } prev = cur; } }
  return out;
}

function scene(E, draw, { duration, music = null, sounds = [], background = '#0a0a0b' } = {}) {
  const Q = new URLSearchParams(location.search);
  const frame = t => { const c = E.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.fillStyle = background; c.fillRect(0, 0, E.W, E.H); draw(c, t, E); };
  const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => frame(0));
  const s = { duration, music, sounds, ready, seek: async t => { await ready; frame(t); } };
  if (!Q.get('rec')) ready.then(() => { const t0 = performance.now(); const loop = () => { frame(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); }; loop(); });
  return s;
}
/* load JSON files and images next to the page, then build: Replay.withData(['data/a.json'], ([a]) => { …; return Event.scene(…); }) */
function withData(srcs, build) {
  const s = { duration: 1, seek: async () => {} };
  const load = u => /\.(png|jpe?g|webp)$/i.test(u) ? new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('cannot load ' + u)); im.src = u; }) : new Promise((ok, no) => { const x = new XMLHttpRequest(); x.open('GET', u); x.onload = () => { try { ok(JSON.parse(x.responseText)); } catch (e) { no(new Error('bad JSON in ' + u)); } };
    x.onerror = () => no(new Error('cannot load ' + u + ' — render through render.py, or serve the folder')); x.send(); });            // XHR, so it also works from file:// under render.py
  s.ready = Promise.all(srcs.map(load)).then(ds => { const real = build(ds); Object.assign(s, real); return real.ready; });
  return s;
}

window.Replay = { create, scene, withData, clock, counter, line, mark, units, topo, proj, lerpView, basemap, extrude, shade, land, wave, place, text, source, finish, ticks,
  cl, seg, lerp, oc, io, pop, hash, TAU, SANS, TEXT, MONO };
})();
