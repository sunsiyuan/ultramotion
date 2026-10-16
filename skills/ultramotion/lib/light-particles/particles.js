/* particles.js — tens of thousands of glowing particles that gather into shapes (text, logos, rings, spheres, galaxies),
   fly between them along swirling paths, and glow with bloom. WebGL2. Every frame is a pure function of t.

     const P = Particles.create({ count: 40000, background: '#04050a' });
     P.to(0,   Particles.field(),            { dur: 0 });
     P.to(1.0, Particles.text('2027', { size: 520 }), { dur: 2.2, swirl: 260, colors: ['#ffd27a', '#ff7a3d'] });
     window.__scene = Particles.scene(P, { duration: 8, music: { … } });
*/
(function () {
const W = 1080, H = 1920, TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e7) / 1e7; }; }

/* ---------- shapes ----------
   A shape is fn(N, seed) → either Float32Array N×4 (x, y, z, size), or { p, a, o } for solid, lit things:
     p  N×4  x, y, z, size        (pixels, centred on the frame; y points DOWN, so "up" is −y)
     a  N×4  nx, ny, nz, m        surface normal (0,0,0 = not lit, glows evenly) and colour: m 0–1 mixes colors[0]→colors[1];
                                  m 2–3 glows in colors[2], m 3–4 glows in colors[3] (higher = brighter); m < 0 = random mix; m ≥ 10 = its own colour (Particles.tint)
     o  N    0–1                  when this particle arrives, as a share of the flight (−1 = random) — for things that build up in order
   The same seed always gives the same points, so two shapes made from one generator line up particle for particle. */
// a shape from anything you can draw on a 2D canvas: points land where the drawing is opaque
function drawn(draw, { w = W, h = H, y = 0, x = 0, depth = 30, size = 3, edge = 0, step = 2, neon = 0 } = {}) {
  return (N, seed) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    draw(g, w, h);
    const d = g.getImageData(0, 0, w, h).data, pts = [];
    for (let j = 0; j < h; j += step) for (let i = 0; i < w; i += step) {
      const a = d[(j * w + i) * 4 + 3];
      if (a > 120) {
        const isEdge = (edge || neon) && (d[((j) * w + i + 3) * 4 + 3] < 60 || d[((j) * w + i - 3) * 4 + 3] < 60 || d[((j + 3) * w + i) * 4 + 3] < 60 || d[((j - 3) * w + i) * 4 + 3] < 60);
        pts.push(i, j, isEdge ? 1 : 0);
      }
    }
    const r = rng(seed + 11), out = new Float32Array(N * 4), n = pts.length / 3;
    if (!n) throw new Error('shape is empty — nothing was drawn (font not loaded? text off the canvas?)');
    for (let k = 0; k < N; k++) {
      let p = Math.floor(r() * n);
      const ed = neon ? Math.max(edge, .9 + .08 * neon) : edge;
      if (ed && r() < ed) for (let tries = 0; tries < 40 && !pts[p * 3 + 2]; tries++) p = Math.floor(r() * n);   // favour the outline
      out[k * 4] = pts[p * 3] - w / 2 + (r() - .5) * step + x;
      out[k * 4 + 1] = pts[p * 3 + 1] - h / 2 + (r() - .5) * step + y;
      out[k * 4 + 2] = (r() - .5) * depth;
      out[k * 4 + 3] = size * (.55 + r() * .9) * (neon ? (pts[p * 3 + 2] ? 1 + .8 * neon : 1 - .45 * neon) : 1);   // neon: a bright rim, a faint fill
    }
    return out;
  };
}
// text, one or more lines (\n); size is the cap height in px; fits the frame width. Sampled pixel by pixel with small dots (dot) so edges stay crisp
function text(str, { size = 360, font = `900 {s}px "Avenir Next", "PingFang SC", sans-serif`, y = 0, x = 0, leading = 1.12, maxWidth = 960, depth, edge = .25, dot = 3, ...o } = {}) {
  return drawn((g, w, h) => {
    const lines = String(str).split('\n'); let s = size;
    g.font = font.replace('{s}', s); const widest = Math.max(...lines.map(l => g.measureText(l).width));
    if (widest > maxWidth) { s *= maxWidth / widest; g.font = font.replace('{s}', s); }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * s * leading));
  }, { y, x, depth: depth ?? size * .025, edge, size: dot, step: 1, ...o });
}
// an image (logo) — load it first with Particles.load(url); light pixels become points unless invert
function image(img, { width = 760, y = 0, x = 0, ...o } = {}) {
  return drawn((g, w, h) => { const k = width / img.width; g.drawImage(img, (w - width) / 2, (h - img.height * k) / 2, width, img.height * k); }, { y, x, ...o });
}
// an SVG path (or several) in a box, like hand.js: paths, { box: [w, h], width }
function svg(paths, { box = [100, 100], width = 700, stroke = 0, y = 0, x = 0, ...o } = {}) {
  return drawn((g, w, h) => {
    const k = width / box[0]; g.translate((w - width) / 2, (h - box[1] * k) / 2); g.scale(k, k);
    for (const p of [].concat(paths)) { const P2 = new Path2D(p); if (stroke) { g.lineWidth = stroke / k; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.stroke(P2); } else { g.fillStyle = '#fff'; g.fill(P2); } }
  }, { y, x, ...o });
}
function field({ w = 2600, h = 3600, d = 2400, size = 3.6 } = {}) {
  return (N, seed) => { const r = rng(seed + 3), o = new Float32Array(N * 4);
    for (let k = 0; k < N; k++) { o[k * 4] = (r() - .5) * w; o[k * 4 + 1] = (r() - .5) * h; o[k * 4 + 2] = (r() - .5) * d; o[k * 4 + 3] = size * (.4 + r() * 1.2); } return o; };
}
function ring({ r = 380, width = 40, y = 0, x = 0, tilt = 0, size = 3 } = {}) {
  return (N, seed) => { const g = rng(seed + 5), o = new Float32Array(N * 4);
    for (let k = 0; k < N; k++) { const a = g() * TAU, rr = r + (g() - .5) * width * (1 + 2 * Math.pow(g(), 4)), z = (g() - .5) * width;
      const yy = Math.sin(a) * rr; o[k * 4] = Math.cos(a) * rr + x; o[k * 4 + 1] = yy * Math.cos(tilt) - z * Math.sin(tilt) + y; o[k * 4 + 2] = yy * Math.sin(tilt) + z * Math.cos(tilt); o[k * 4 + 3] = size * (.5 + g()); }
    return o; };
}
function sphere({ r = 420, shell = .08, y = 0, x = 0, size = 2.8 } = {}) {
  return (N, seed) => { const g = rng(seed + 7), o = new Float32Array(N * 4);
    for (let k = 0; k < N; k++) { const u = g() * 2 - 1, a = g() * TAU, s = Math.sqrt(1 - u * u), rr = r * (1 - shell * g());
      o[k * 4] = s * Math.cos(a) * rr + x; o[k * 4 + 1] = u * rr + y; o[k * 4 + 2] = s * Math.sin(a) * rr; o[k * 4 + 3] = size * (.5 + g()); }
    return o; };
}
function galaxy({ r = 520, arms = 3, twist = 2.6, thickness = 40, y = 0, x = 0, tilt = 1.0, size = 2.6 } = {}) {
  return (N, seed) => { const g = rng(seed + 9), o = new Float32Array(N * 4);
    for (let k = 0; k < N; k++) { const d = Math.pow(g(), .7) * r, arm = Math.floor(g() * arms), a = arm / arms * TAU + d / r * twist * TAU * .5 + (g() - .5) * .5 * (1 - d / r + .3);
      const xx = Math.cos(a) * d, zz = Math.sin(a) * d, yy = (g() - .5) * thickness * (1 - d / r + .2);
      o[k * 4] = xx + x; o[k * 4 + 1] = yy * Math.cos(tilt) - zz * Math.sin(tilt) + y; o[k * 4 + 2] = yy * Math.sin(tilt) + zz * Math.cos(tilt); o[k * 4 + 3] = size * (.4 + g() * 1.1 + (d < r * .15 ? 1 : 0)); }
    return o; };
}
/* a solid of revolution: profile = [[radius, y], …] top to bottom (px). Points spread evenly over the surface;
   ribs = how many vertical seams to draw brighter (lanterns, melons), rings = horizontal bands; spin it with { spin } on P.to */
function lathe(profile, { ribs = 0, ribShare = .3, rings = [], ringShare = .15, x = 0, y = 0, size = 2.8, inside = 0 } = {}) {
  return (N, seed) => {
    const g = rng(seed + 21), seg = [], o = new Float32Array(N * 4); let tot = 0;
    for (let i = 1; i < profile.length; i++) { const [r0, y0] = profile[i - 1], [r1, y1] = profile[i]; const L = Math.hypot(r1 - r0, y1 - y0) * (r0 + r1) / 2 + 1e-6; seg.push([r0, y0, r1, y1, L]); tot += L; }
    const at = u => { let a = u * tot; for (const s of seg) { if (a <= s[4]) { const v = a / s[4]; return [lerp(s[0], s[2], v), lerp(s[1], s[3], v)]; } a -= s[4]; } const l = seg[seg.length - 1]; return [l[2], l[3]]; };
    for (let k = 0; k < N; k++) {
      let [r, yy] = at(g()), a = g() * TAU; const pick = g();
      if (ribs && pick < ribShare) a = Math.floor(g() * ribs) / ribs * TAU + (g() - .5) * .02;
      else if (rings.length && pick < ribShare + ringShare) { const ry = rings[Math.floor(g() * rings.length)]; let best = 0; for (let q = 0; q < 40; q++) { const c = at(q / 40); if (Math.abs(c[1] - ry) < Math.abs(at(best / 40)[1] - ry)) best = q; } [r, yy] = at(best / 40 + (g() - .5) * .006); }
      if (inside && g() < inside) r *= Math.sqrt(g());
      o[k * 4] = Math.cos(a) * r + x; o[k * 4 + 1] = yy + y; o[k * 4 + 2] = Math.sin(a) * r; o[k * 4 + 3] = size * (.5 + g());
    }
    return o;
  };
}
// hanging lines: strands from [x, y, z] downward (tassels, hair, rain); count lines of length len with a little sway
function strands({ x = 0, y = 0, z = 0, count = 24, spread = 40, len = 260, size = 2.2 } = {}) {
  return (N, seed) => { const g = rng(seed + 31), o = new Float32Array(N * 4);
    for (let k = 0; k < N; k++) { const i = Math.floor(g() * count), a = i / count * TAU, rr = spread * (.3 + .7 * ((i * 7) % count) / count), u = g();
      o[k * 4] = x + Math.cos(a) * rr * (1 + u * .4); o[k * 4 + 1] = y + u * len * (.8 + .2 * ((i * 3) % 5) / 5); o[k * 4 + 2] = z + Math.sin(a) * rr * (1 + u * .4); o[k * 4 + 3] = size * (.5 + g()); }
    return o; };
}
function asSolid(r, N) {
  if (r && r.p) return { p: r.p, a: r.a || new Float32Array(N * 4).map((_, i) => i % 4 === 3 ? -1 : 0), o: r.o || new Float32Array(N).fill(-1) };
  const a = new Float32Array(N * 4); for (let k = 0; k < N; k++) a[k * 4 + 3] = -1;
  return { p: r, a, o: new Float32Array(N).fill(-1) };
}
// several shapes at once, sharing the particles in proportion to weights: Particles.mix([shapeA, 2], [shapeB, 1])
function mix(...parts) {
  return (N, seed) => {
    const tot = parts.reduce((s, [, w]) => s + w, 0), out = { p: new Float32Array(N * 4), a: new Float32Array(N * 4), o: new Float32Array(N) }; let at = 0;
    parts.forEach(([sh, w], i) => { const n = i === parts.length - 1 ? N - at : Math.round(N * w / tot), part = asSolid(sh(n, seed + i * 101), n);
      out.p.set(part.p, at * 4); out.a.set(part.a, at * 4); out.o.set(part.o, at); at += n; });
    const r = rng(seed + 77);
    for (let k = N - 1; k > 0; k--) { const j = Math.floor(r() * (k + 1));                 // interleave so no part always flies first
      for (let c = 0; c < 4; c++) { let t = out.p[k * 4 + c]; out.p[k * 4 + c] = out.p[j * 4 + c]; out.p[j * 4 + c] = t; t = out.a[k * 4 + c]; out.a[k * 4 + c] = out.a[j * 4 + c]; out.a[j * 4 + c] = t; }
      const t = out.o[k]; out.o[k] = out.o[j]; out.o[j] = t; }
    return out;
  };
}
/* most particles stay exactly where they are in base; a share of them leave to form overlay (text above a model, a marker on a map).
   Use it whenever the next shape is "the same thing plus something" — mix() would reshuffle everyone. Stack them (a line, then labels on top)
   with a different layer for each, so each overlay takes its own particles. */
function takeover(base, overlay, { share = .12, pick = 'random', layer = 0 } = {}) {
  return (N, seed) => { const b = asSolid(base(N, seed), N), p = new Float32Array(b.p), a = new Float32Array(b.a), o = new Float32Array(b.o);
    const r = rng(seed + 991 + layer * 7919), idx = [];
    for (let k = 0; k < N; k++) if (r() < share) idx.push(k);
    const ov = asSolid(overlay(idx.length, seed + 5), idx.length);
    idx.forEach((k, j) => { for (let c = 0; c < 4; c++) { p[k * 4 + c] = ov.p[j * 4 + c]; a[k * 4 + c] = ov.a[j * 4 + c]; } o[k] = ov.o[j]; });
    return { p, a, o };
  };
}
// move / turn a shape: rx, ry, rz in radians (applied in that order), then x, y, z; scale
function place(shape, { rx = 0, ry = 0, rz = 0, x = 0, y = 0, z = 0, scale = 1 } = {}) {
  return (N, seed) => { const s = asSolid(shape(N, seed), N), p = new Float32Array(s.p), a = new Float32Array(s.a);
    const rot = (v, i) => { let [X, Y, Z] = [v[i], v[i + 1], v[i + 2]];
      [Y, Z] = [Y * Math.cos(rx) - Z * Math.sin(rx), Y * Math.sin(rx) + Z * Math.cos(rx)];
      [X, Z] = [X * Math.cos(ry) + Z * Math.sin(ry), -X * Math.sin(ry) + Z * Math.cos(ry)];
      [X, Y] = [X * Math.cos(rz) - Y * Math.sin(rz), X * Math.sin(rz) + Y * Math.cos(rz)]; v[i] = X; v[i + 1] = Y; v[i + 2] = Z; };
    for (let k = 0; k < N; k++) { rot(p, k * 4); p[k * 4] = p[k * 4] * scale + x; p[k * 4 + 1] = p[k * 4 + 1] * scale + y; p[k * 4 + 2] = p[k * 4 + 2] * scale + z; p[k * 4 + 3] *= Math.sqrt(scale); rot(a, k * 4); }
    return { p, a, o: s.o };
  };
}
// set a shape's colour: m 0–1 mixes colors[0]→colors[1], m 2–3 glows in colors[2], m 3–4 in colors[3]
// a colour of its own for m (instead of the colors slots): Particles.tint('#ff4fa3') is a lit surface, tint(hex, 1–3) glows, brighter as it goes up
function tint(hex, glow = 0) { const [r, g, b] = hexrgb(hex); return pack(r, g, b, glow); }
function pack(r, g, b, glow = 0) { return 10 + Math.round(r * 63) * 4096 + Math.round(g * 63) * 64 + Math.round(b * 63) + Math.round(glow) * 262144; }
// colour a shape by position: colours run along dir (in screen px: [1, 0] left→right, [.6, .8] diagonal), glow 0–3
function gradient(shape, cols, { dir = [.6, .8], glow = 2 } = {}) { return (N, seed) => { const s = asSolid(shape(N, seed), N), a = new Float32Array(s.a), c = cols.map(hexrgb);
  let lo = 1e9, hi = -1e9; const d = k => s.p[k * 4] * dir[0] + s.p[k * 4 + 1] * dir[1];
  for (let k = 0; k < N; k++) { lo = Math.min(lo, d(k)); hi = Math.max(hi, d(k)); }
  for (let k = 0; k < N; k++) { const u = (d(k) - lo) / (hi - lo || 1) * (c.length - 1), i = Math.min(c.length - 2, Math.floor(u)), f = u - i;
    a[k * 4 + 3] = pack(...[0, 1, 2].map(j => c[i][j] + (c[i + 1][j] - c[i][j]) * f), glow); }
  return { p: s.p, a, o: s.o }; }; }
// loose, twinkling points of light instead of solid dots (only differs in a solid scene) — for titles over solid things
function sparkle(shape) { return (N, seed) => { const s = asSolid(shape(N, seed), N), p = new Float32Array(s.p); for (let k = 0; k < N; k++) p[k * 4 + 3] = -Math.abs(p[k * 4 + 3]); return { p, a: s.a, o: s.o }; }; }
function colorize(shape, m) { return (N, seed) => { const s = asSolid(shape(N, seed), N), a = new Float32Array(s.a); for (let k = 0; k < N; k++) a[k * 4 + 3] = m; return { p: s.p, a, o: s.o }; }; }
// the same points pressed flat onto the ground (y) — the start of anything that grows upward
function flatten(shape, { y = 0, size = .7, m } = {}) {
  return (N, seed) => { const s = asSolid(shape(N, seed), N), p = new Float32Array(s.p), a = new Float32Array(s.a);
    for (let k = 0; k < N; k++) { p[k * 4 + 1] = y; p[k * 4 + 3] *= size; a[k * 4] = 0; a[k * 4 + 1] = -1; a[k * 4 + 2] = 0; if (m !== undefined) a[k * 4 + 3] = m; }
    return { p, a, o: s.o };
  };
}

/* a city as a lit architectural model: towers on podiums, round towers, low blocks; streets on the ground; an irregular edge
   that thins out; optionally a river curving through (water shimmers). lit = share of windows switched on (0 = dark model).
   Buildings rise in order (centre first) and windows switch on from the centre outward — use stagger on P.to. */
function city({ grid = 13, lot = 120, street = 30, maxH = 820, ground = 320, lit = 0, river = true, haze = .025, x = 0, z = 0, size = 2.3, seed: cs = 5 } = {}) {
  return (N, seedIn) => {
    const g = rng(cs * 7919 + 1), half = grid * lot / 2, B = [];
    const wob = [g() * TAU, g() * TAU, g() * TAU], edge = a => 1 + .22 * Math.sin(2 * a + wob[0]) + .13 * Math.sin(3 * a + wob[1]) + .08 * Math.sin(5 * a + wob[2]);
    const riverZ = xx => half * .28 * Math.sin(xx / half * 2.2 + 1) - half * .05, riverW = lot * .85;
    const inside = (cx, cz) => { const rr = Math.hypot(cx, cz) / (half * .95), a = Math.atan2(cz, cx); return rr / edge(a); };   // < 1 inside the outline
    for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
      const cx = -half + (i + .5) * lot, cz = -half + (j + .5) * lot, q = inside(cx, cz);
      if (q > 1 || (q > .7 && g() < (q - .7) * 2.6)) continue;                     // ragged edge: blocks thin out
      if (river && Math.abs(cz - riverZ(cx)) < riverW * .75) continue;
      if (g() < .07) continue;                                                     // squares and parks
      const w = (lot - street) * (.5 + g() * .5), dd = (lot - street) * (.5 + g() * .5), dc = Math.min(1, q);
      const h = maxH * Math.pow(g(), 1.7) * Math.max(.12, 1 - dc * .9) + 40, kind = g(), r0 = dc;
      const ox = cx + (g() - .5) * 12, oz = cz + (g() - .5) * 12;
      if (h > 260 && kind < .4) {                                                 // tower on a podium, often with a setback
        const ph = 50 + g() * 70; B.push({ cx: ox, cz: oz, w, d: dd, y0: 0, h: ph, r: r0, round: false });
        const tw = w * (.45 + g() * .3), td = dd * (.45 + g() * .3); B.push({ cx: ox, cz: oz, w: tw, d: td, y0: ph, h: h - ph, r: r0 + .02, round: false });
        if (g() < .5) B.push({ cx: ox, cz: oz, w: tw * .6, d: td * .6, y0: h, h: h * .12, r: r0 + .03, round: false });
      } else if (h > 200 && kind < .55) B.push({ cx: ox, cz: oz, w: Math.min(w, dd), d: Math.min(w, dd), y0: 0, h, r: r0, round: true });
      else B.push({ cx: ox, cz: oz, w, d: dd, y0: 0, h, r: r0, round: false });
    }
    B.sort((p, q) => p.r - q.r);
    const area = B.map(b => (b.round ? Math.PI * b.w : 2 * (b.w + b.d)) * b.h + b.w * b.d), tot = area.reduce((s, v) => s + v, 0);
    const r = rng(cs * 104729 + 3), p = new Float32Array(N * 4), a = new Float32Array(N * 4), o = new Float32Array(N);
    const nGround = Math.round(N * .12), nRiver = river ? Math.round(N * .08) : 0, nHaze = Math.round(N * haze);
    let k = 0;
    for (; k < nGround; k++) {                                                    // ground: streets inside the outline, lights scattering past it
      let gx, gz, onStreet = r() < .6, q;
      for (let t = 0; t < 12; t++) {
        if (onStreet) { const line = Math.floor(r() * (grid + 1)), along = (r() - .5) * grid * lot, side = (r() - .5) * street * .6;
          if (r() < .5) { gx = -half + line * lot + side; gz = along; } else { gx = along; gz = -half + line * lot + side; } }
        else { gx = (r() - .5) * grid * lot * 1.5; gz = (r() - .5) * grid * lot * 1.5; }
        q = inside(gx, gz); if (river && Math.abs(gz - riverZ(gx)) < riverW * .6) continue;
        if (q < 1 || r() < Math.exp(-(q - 1) * 4) * .5) break;                       // fewer and fewer beyond the edge
      }
      const fade = q < 1 ? 1 : Math.exp(-(q - 1) * 3);
      p.set([gx + x, ground, gz + z, size * (onStreet ? .85 : .5)], k * 4);
      a.set([0, -1, 0, onStreet && lit ? 2 + .3 * lit * fade : (onStreet ? .15 * fade : .02)], k * 4);
      o[k] = Math.min(1, Math.hypot(gx, gz) / half * .55);
    }
    for (; k < nGround + nRiver; k++) {                                           // the river: a soft band of water catching the light
      const rx = (r() - .5) * grid * lot * 1.5, rz = riverZ(rx) + (r() - .5) * riverW * 1.1;
      const stripe = Math.sin(rx * .045 + rz * .02) * Math.sin(rx * .013 - rz * .05) > .35;     // light rippling on the water
      p.set([rx + x, ground + 2, rz + z, size * (.4 + r() * .5)], k * 4);
      a.set([0, -1, 0, lit && stripe ? 2 + .2 * r() : .95 + .05 * r()], k * 4);
      o[k] = Math.min(1, Math.abs(rx) / half * .5);
    }
    for (const end = k + nHaze; k < end; k++) {                                   // a thin mist hanging over the streets
      let hx, hz; do { hx = (r() - .5) * grid * lot * 1.3; hz = (r() - .5) * grid * lot * 1.3; } while (inside(hx, hz) > 1.1);
      p.set([hx + x, ground - Math.pow(r(), 2.5) * 140, hz + z, size * (.6 + r() * .8)], k * 4);
      a.set([0, 0, 0, 0], k * 4); o[k] = -1;
    }
    let bi = 0, acc = area[0]; const first = k;
    for (; k < N; k++) {
      const u = (k - first) / (N - first) * tot; while (u > acc && bi < B.length - 1) acc += area[++bi];
      const b = B[bi], wallA = b.round ? Math.PI * b.w * b.h : 2 * (b.w + b.d) * b.h, f = r() * (wallA + b.w * b.d);
      let px, py, pz, nx = 0, ny = 0, nz = 0, win = false, u2 = 0, hy;
      if (f >= wallA) { if (b.round) { const an = r() * TAU, rr = Math.sqrt(r()) * b.w / 2; px = Math.cos(an) * rr; pz = Math.sin(an) * rr; } else { px = (r() - .5) * b.w; pz = (r() - .5) * b.d; }
        hy = b.y0 + b.h; ny = -1; }
      else { hy = b.y0 + r() * b.h;
        if (b.round) { const an = r() * TAU; px = Math.cos(an) * b.w / 2; pz = Math.sin(an) * b.w / 2; nx = Math.cos(an); nz = Math.sin(an); u2 = an * b.w / 2; }
        else { const wall = r() * 2 * (b.w + b.d);
          if (wall < b.w) { px = wall - b.w / 2; pz = b.d / 2; nz = 1; } else if (wall < 2 * b.w) { px = wall - b.w * 1.5; pz = -b.d / 2; nz = -1; }
          else if (wall < 2 * b.w + b.d) { px = b.w / 2; pz = wall - 2 * b.w - b.d / 2; nx = 1; } else { px = -b.w / 2; pz = wall - 2 * b.w - b.d * 1.5; nx = -1; }
          u2 = nx ? pz : px; }
        const fx = (u2 + 400) % 20, fy = hy % 24; win = fx > 3 && fx < 17 && fy > 6 && fy < 19; }
      py = -hy;
      const wid = Math.floor((u2 + 400) / 20) * 131 + Math.floor(hy / 24) * 17 + bi * 7;
      const on = win && lit && ((wid * 2654435761 >>> 0) % 1000) / 1000 < lit * (1 - b.r * .35);
      p.set([b.cx + px + x, ground + py, b.cz + pz + z, size * (on ? 1.25 : win ? .9 : .8)], k * 4);
      a.set([nx, ny, nz, on ? 2.3 + .65 * r() : (win ? .12 : .45 + .3 * r())], k * 4);
      o[k] = lit ? Math.min(1, b.r * .85 + r() * .15) : Math.min(1, bi / B.length * .8 + (hy / (b.y0 + b.h)) * .2);
    }
    return { p, a, o };
  };
}

/* a waterfront commercial quarter in a Jiangnan water town, as a lit site model for a real-estate film: canals that split and rejoin,
   bridges, white-walled houses with dark roofs turned into shops along the main canal, a landmark cloud canopy floating over the
   canal, a round glass art centre on the square, a courtyard hotel, and the grey city around the site. lit = 0 dark model, 1 night
   (windows in colors[2], lanterns in colors[3], signs and the canopy's warm underside in their own colours). site = true gives only
   the plot's boundary as a line of light, drawn around in order. Builds from the square out. */
function waterTown({ ground = 320, lit = 0, size = 2.2, x = 0, z = 0, seed: ws = 9, site = false } = {}) {
  return (N, seedIn) => {
    const g = rng(ws * 7919 + 5), R = 860;
    const mz = px => 80 * Math.sin((px + 900) / 1800 * 5.5) + 40;                        // the main canal's centre line, z at x
    const canals = [                                                                     // [f(t) → [x, z] for t 0…1, width]
      [t => [-1000 + 2000 * t, mz(-1000 + 2000 * t)], 92],                                // main canal, east–west
      [t => [-420 - 300 * t + 40 * Math.sin(t * 6), mz(-420) - 620 * t], 56],               // north-west branch, off to the edge
      [t => [200 + 380 * t, mz(200 + 380 * t) + 430 * Math.sin(Math.PI * t)], 56],         // south loop: leaves and rejoins the main canal → an island
      [t => [330 + 60 * Math.sin(t * 4), mz(330) - 640 * t], 52],                          // north branch
      [t => [-600 + 930 * t, -340 + 35 * Math.sin(t * 7)], 48],                            // northern cross canal: north-west branch ↔ north branch
      [t => [-150 - 240 * t, mz(-150) + 600 * t], 52],                                     // south-west branch
    ];
    const pts = canals.map(([f, w]) => Array.from({ length: 161 }, (_, i) => f(i / 160)).map(q => [q[0], q[1], w]));
    const water = (px, pz, pad = 0) => pts.some(c => c.some(([cx, cz, w]) => Math.hypot(px - cx, pz - cz) < w / 2 + pad));
    const frame = (c, t) => { const [f] = canals[c], [cx, cz] = f(t), [dx, dz] = f(Math.min(1, t + .004)), [ex, ez] = f(Math.max(0, t - .004)), L = Math.hypot(dx - ex, dz - ez) || 1;
      return { cx, cz, ax: (dx - ex) / L, az: (dz - ez) / L, w: canals[c][1] }; };             // a point on a canal and its direction
    const PL = [10, -185], plaza = (px, pz, pad = 0) => Math.hypot((px - PL[0]) / 1.35, pz - PL[1]) < 125 + pad;
    const outline = (px, pz) => { const a = Math.atan2(pz, px), e = 1 + .16 * Math.sin(2 * a + 1) + .1 * Math.sin(3 * a + 2) + .06 * Math.sin(5 * a); return Math.hypot(px, pz) / (R * e); };
    const parts = [], add = (area, f) => parts.push([area, f]);
    const P = (px, py, pz, nx, ny, nz, m, ml, o) => ({ px, py, pz, nx, ny, nz, m, ml, o });
    const dist = (px, pz) => Math.min(1, Math.hypot(px - PL[0], pz - PL[1]) / (R * 1.15));
    if (site) {                                                                         // only the plot's boundary, a line of light drawn around it in order
      const p = new Float32Array(N * 4), a = new Float32Array(N * 4), o = new Float32Array(N), r = rng(ws + 77);
      for (let k = 0; k < N; k++) { const an = r() * TAU, e = 1.03 * (1 + .16 * Math.sin(2 * an + 1) + .1 * Math.sin(3 * an + 2) + .06 * Math.sin(5 * an)), w = (r() - .5) * 8;
        p.set([Math.cos(an) * (R * e + w) + x, ground - 3, Math.sin(an) * (R * e + w) + z, size * (.8 + r() * .5)], k * 4); a.set([0, 0, 0, 2.6], k * 4); o[k] = an / TAU; }
      return { p, a, o };
    }
    const ball = (cx, cy, cz, rx, ry, rz, col, colLit, o, dense = 1, keep = () => true) => add(4.2 * Math.pow(rx * ry * rz, 2 / 3) * dense, r => {   // an ellipsoid's surface
      let nx, ny, nz; do { const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u); nx = s * Math.cos(a); ny = u; nz = s * Math.sin(a); } while (!keep(cx + nx * rx, cy + ny * ry));
      return P(cx + nx * rx, cy + ny * ry, cz + nz * rz, nx / rx * 80, ny / ry * 80, nz / rz * 80, col, colLit, o); });
    // water: dark, with faint reflections of the lights
    pts.forEach((c, ci) => add(c[0][2] * 2000 * .8, r => { const { cx, cz, ax, az, w } = frame(ci, r()), off = (r() - .5) * w, px = cx - az * off, pz = cz + ax * off;
      const glint = Math.sin(px * .05 + pz * .03) * Math.sin(px * .017 - pz * .06) > .6 && r() < .5;
      return P(px, ground + 2, pz, 0, -1, 0, .18, glint ? (r() < .3 ? 3.02 : 2.02) : .2, dist(px, pz) * .4); }));
    // embankments: pale stone edges
    pts.forEach((c, ci) => add(2000 * 22, r => { const { cx, cz, ax, az, w } = frame(ci, r()), sd = r() < .5 ? -1 : 1, off = sd * (w / 2 + r() * 5), px = cx - az * off, pz = cz + ax * off;
      if (outline(px, pz) > 1) return P(cx, ground + 2, cz, 0, -1, 0, .18, .2, 1);
      return P(px, ground - r() * 7, pz, 0, -1, 0, .85, .85, dist(px, pz) * .5); }));
    // houses, and the shops along the main canal
    const WOOD = tint('#5a3826');                                                       // dark timber: doors, window lattices, railings
    const NEON = ['#ff4fa3', '#3fe6ff', '#ffb43a', '#9dff6a', '#c58bff'];
    const houses = [];
    for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) {
      const hx = i * 64 + (g() - .5) * 16, hz = j * 60 + (g() - .5) * 16, q = outline(hx, hz);
      if (q > 1 || (q > .78 && g() < (q - .78) * 3)) continue;
      if (water(hx, hz, 26) || plaza(hx, hz, 30) || g() < .08) continue;
      const toMain = mz(hx) - hz, shop = Math.abs(toMain) < 135 && Math.abs(hx) < 820 && g() < .85;
      const alongX = shop || g() < .5, two = shop ? g() < .7 : g() < .3;
      const w = 42 + g() * 22, d = 34 + g() * 14, h = (two ? 60 : 36) + g() * 12;
      houses.push({ hx, hz, w: alongX ? w : d, d: alongX ? d : w, h, rh: 15 + g() * 7, alongX, gable: g() < .55, shop, face: toMain > 0 ? 1 : -1,
        neon: NEON[Math.floor(g() * NEON.length)], sign: g(), o: dist(hx, hz) });
    }
    houses.forEach(b => {
      const L = b.alongX ? b.w : b.d, S = b.alongX ? b.d : b.w;                           // ridge length, span
      const toW = (u, v, y, nu, nv) => b.alongX ? [b.hx + u, y, b.hz + v, nu, 0, nv] : [b.hx + v, y, b.hz + u, nv, 0, nu];
      const two = b.h > 45, on = (i, j) => ((i * 7 + j * 13 + Math.round(b.hx) * 3 + Math.round(b.hz)) * 2654435761 >>> 0) % 100 < 50;
      add(2 * L * b.h, r => { const side = r() < .5 ? -1 : 1, u = (r() - .5) * L, hy = r() * b.h, front = side === b.face;
        const [px, py, pz, nx, ny, nz] = toW(u, side * S / 2, ground - hy, 0, side), Q = (m, ml = m) => P(px, py, pz, nx, ny, nz, m, ml, b.o);
        if (hy < 4) return Q(.55);                                                      // stone plinth
        if (hy < 28) {                                                                    // ground floor
          if (b.shop && front) {                                                          // shopfront: glass in a wooden frame, lit from inside
            const bar = Math.abs(u) > L / 2 - 3 || hy > 25 || (u + 400) % 11 < 1.2 || Math.abs(hy - 18) < .8;
            return bar ? Q(WOOD) : Q(.3, 2.45 + r() * .2); }
          const du = Math.abs(u - (side > 0 ? 0 : L * .18));
          if (du < 9 && hy < 24) return du < .9 || du > 8 || hy > 23 ? Q(.08) : Q(WOOD);   // a pair of wooden doors
          const cx = (u + 400) % 18, cell = Math.floor((u + 400) / 18);
          if (cx > 4 && cx < 14 && hy > 10 && hy < 22) { const lat = (cx - 4) % 3 < .7 || (hy - 10) % 4 < .7 || cx < 5 || cx > 13;   // lattice window
            return lat ? Q(WOOD) : Q(.2, on(cell, 0) ? 2.2 + .3 * r() : .2); }
          return Q(.92);
        }
        if (two && hy < 33) return b.shop && front ? Q(.15, tint(b.neon, 2)) : Q(.92);    // between floors: a sign band on shops
        const cx = (u + 400) % 16, cell = Math.floor((u + 400) / 16);
        if (two && cx > 3 && cx < 13 && hy > 38 && hy < 52) { const lat = (cx - 3) % 2.5 < .6 || (hy - 38) % 3.5 < .6 || cx < 4 || cx > 12;   // upper lattice windows
          return lat ? Q(WOOD) : Q(.2, on(cell, 1) ? 2.2 + .3 * r() : .2); }
        return Q(.92); });
      if (two) {                                                                          // a small tiled eave between the floors (腰檐), on both long sides
        add(2 * L * 9 * 1.4, r => { const side = r() < .5 ? -1 : 1, u = (r() - .5) * (L + 4), f = r(), [px, py, pz] = toW(u, side * (S / 2 + f * 9), ground - (34 - f * 5), 0, side);
          return P(px, py, pz, b.alongX ? 0 : side * .5, -.85, b.alongX ? side * .5 : 0, f > .9 ? .75 : .22, f > .9 ? .75 : .22, b.o); });
        if (b.shop) add(L * 10 * .3, r => { let u, hy; do { u = (r() - .5) * L; hy = 34 + r() * 10; } while (!((u + 400) % 6 < 1 || hy > 43 || Math.abs(hy - 38) < .6));   // balcony railing over the water
          const [px, py, pz, nx, ny, nz] = toW(u, b.face * (S / 2 + 7), ground - hy, 0, b.face); return P(px, py, pz, nx, ny, nz, WOOD, WOOD, b.o); });
      }
      add(2 * S * (b.h + b.rh), r => { const side = r() < .5 ? -1 : 1, v = (r() - .5) * S, top = b.gable ? b.h + b.rh + 12 - Math.floor(Math.abs(v) / (S / 6)) * 9 : b.h + b.rh * (1 - Math.abs(v) / (S / 2));
        const hy = r() * top, edge = b.gable && top - hy < 3; const [px, py, pz, nx, ny, nz] = toW(side * L / 2, v, ground - hy, side, 0);
        return P(px, py, pz, nx, ny, nz, edge ? .05 : .92, edge ? .05 : .92, b.o); });
      add(L * S * 1.3, r => { const side = r() < .5 ? -1 : 1, u = (r() - .5) * (L + 14), f = r(), span = S / 2 + 8, curve = Math.pow(f, 1.6);
        const lift = Math.pow(Math.abs(u) / ((L + 14) / 2), 6) * 8 * f, hy = b.h + b.rh * (1 - curve) + lift, ridge = f < .07, eave = f > .93;
        const tiles = .22 + .1 * (Math.sin(u * .9) > .6 ? 1 : 0);
        const [px, py, pz] = toW(u, side * f * span, ground - hy, 0, side);
        return P(px, py, pz, b.alongX ? 0 : side * .6, -.8, b.alongX ? side * .6 : 0, ridge || eave ? .75 : tiles, ridge || eave ? .75 : tiles, b.o); });
      if (b.shop && b.sign < .6) {                                                       // a projecting sign: a tall panel sticking out from the wall
        const u0 = (b.sign - .3) * L * 1.2;
        add(56 * 20 * 3, r => { const out = 4 + r() * 20, hy = 28 + r() * 56, [px, py, pz] = toW(u0, b.face * (S / 2 + out), ground - hy, 0, b.face);
          return P(px, py, pz, b.alongX ? 1 : 0, 0, b.alongX ? 0 : 1, .15, tint(b.neon, 3), b.o); });
      }
    });
    // lanterns along the banks, and strings of small lights across the main canal
    const lanterns = [];
    pts.forEach((c, ci) => { for (let t = 0; t <= 1; t += ci ? .05 : .022) { const { cx, cz, ax, az, w } = frame(ci, t);
      [-1, 1].forEach(sd => { const off = sd * (w / 2 + 9), lx = cx - az * off, lz = cz + ax * off; if (outline(lx, lz) < .95 && !plaza(lx, lz, 10)) lanterns.push([lx, lz]); }); } });
    lanterns.forEach(([lx, lz]) => add(200, r => { const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u);
      return P(lx + s * Math.cos(a) * 6, ground - 48 + u * 8, lz + s * Math.sin(a) * 6, 0, 0, 0, .35, 3.25 + .3 * r(), dist(lx, lz)); }));
    for (let t = .08; t < .95; t += .045) { const { cx, cz, ax, az, w } = frame(0, t); if (outline(cx, cz) > .9) continue;
      const a0 = [cx + az * (w / 2 + 12), cz - ax * (w / 2 + 12)], a1 = [cx - az * (w / 2 + 12), cz + ax * (w / 2 + 12)];
      add(420, r => { const f = r(), px = a0[0] + (a1[0] - a0[0]) * f, pz = a0[1] + (a1[1] - a0[1]) * f, hy = 58 - 22 * Math.sin(Math.PI * f), bulb = (f * 14) % 1 < .35;
        return P(px, ground - hy, pz, 0, 0, 0, .25, bulb ? tint('#ffd59a', 3) : .25, dist(px, pz)); }); }
    // bridges
    const bridge = (ci, t, kind) => {
      const { cx, cz, ax, az, w } = frame(ci, t), span = w + 34, o = dist(cx, cz), at = (s, w2) => [cx - az * s + ax * w2, cz + ax * s + az * w2];
      const bw = kind === 'gallery' ? 30 : kind === 'triple' ? 26 : 20;
      const rise = kind === 'flat' ? 8 : kind === 'gallery' ? 12 : kind === 'triple' ? 26 : 34;
      const deck = s => kind === 'flat' || kind === 'gallery' ? rise : rise * Math.cos(s / span * Math.PI);
      add(span * bw * 2.2, r => { const s = (r() - .5) * span, w2 = (r() - .5) * bw, [px, pz] = at(s, w2); return P(px, ground - 6 - deck(s), pz, 0, -1, 0, .8, .8, o); });   // deck
      add(span * 14 * 2, r => { const s = (r() - .5) * span, sd = r() < .5 ? -1 : 1, [px, pz] = at(s, sd * bw / 2);                                 // the sides, with arch openings
        const top = 6 + deck(s), arches = kind === 'triple' ? 3 : kind === 'flat' ? 0 : 1, cell = span / Math.max(1, arches), sc = ((s + span / 2) % cell) - cell / 2;
        const hole = arches ? (kind === 'triple' ? 18 : kind === 'gallery' ? 0 : 26) * Math.sqrt(Math.max(0, 1 - Math.pow(sc / (cell * .42), 2))) : 0;
        const hy = hole + r() * Math.max(1, top - hole), rim = hole > 0 && hy - hole < 2;
        return P(px, ground - hy, pz, ax * sd, 0, az * sd, rim ? .95 : .8, rim ? .95 : .8, o); });
      if (kind === 'gallery') {                                                             // a covered bridge: posts and a tiled roof, lanterns under the eaves
        add(span * 40, r => { const s = (Math.floor(r() * 6) / 5 - .5) * span * .9, sd = r() < .5 ? -1 : 1, [px, pz] = at(s + (r() - .5) * 3, sd * (bw / 2 - 2));
          return P(px, ground - 18 - r() * 40, pz, 0, 0, 0, .1, .1, o); });
        add(span * bw * 2, r => { const s = (r() - .5) * (span + 16), f = r(), sd = r() < .5 ? -1 : 1, [px, pz] = at(s, sd * f * (bw / 2 + 8));
          return P(px, ground - 72 + f * f * 14, pz, ax * sd * .5, -.85, az * sd * .5, f < .08 ? .75 : .24, f < .08 ? .75 : .24, o); });
        for (let k = 0; k < 5; k++) { const [px, pz] = at((k / 4 - .5) * span * .85, 0);
          add(140, r => { const u = r() * 2 - 1, a = r() * TAU, s2 = Math.sqrt(1 - u * u); return P(px + s2 * Math.cos(a) * 5, ground - 54 + u * 7, pz + s2 * Math.sin(a) * 5, 0, 0, 0, .35, 3.3, o); }); }
      }
    };
    [[0, .2, 'triple'], [0, .505, 'flat'], [0, .78, 'triple'], [0, .38, 'flat'], [0, .62, 'flat'], [0, .09, 'arch'], [0, .9, 'arch'],
     [1, .35, 'arch'], [1, .75, 'flat'], [2, .25, 'arch'], [2, .55, 'flat'], [2, .8, 'arch'], [3, .3, 'flat'], [3, .7, 'arch'],
     [4, .2, 'flat'], [4, .45, 'arch'], [4, .75, 'flat'], [5, .3, 'arch'], [5, .7, 'flat']].forEach(([ci, t, kind]) => bridge(ci, t, kind));
    // boats: a slim hull with a dark arched canopy, a lantern at the bow
    [[0, .27], [0, .58], [0, .7], [2, .4], [4, .6], [1, .55]].forEach(([ci, t], k) => {
      const { cx, cz, ax, az } = frame(ci, t), off = (k % 2 ? 1 : -1) * 12, bx = cx - az * off, bz = cz + ax * off, o = dist(bx, bz);
      add(48 * 14 * 3, r => { const s = (r() - .5) * 2, wd = 13 * Math.sqrt(1 - s * s), sd = r() < .5 ? -1 : 1, px = bx + ax * s * 48 - az * sd * wd, pz = bz + az * s * 48 + ax * sd * wd;
        return P(px, ground - r() * 6, pz, -az * sd, 0, ax * sd, .55, .55, o); });
      add(26 * 30 * 2, r => { const s = (r() - .5) * 26, a = r() * Math.PI, px = bx + ax * s - az * Math.cos(a) * 11, pz = bz + az * s + ax * Math.cos(a) * 11;
        return P(px, ground - 6 - Math.sin(a) * 14, pz, -az * Math.cos(a), -Math.sin(a), ax * Math.cos(a), .06, .06, o); });
      add(120, r => { const u = r() * 2 - 1, a = r() * TAU, s2 = Math.sqrt(1 - u * u); return P(bx + ax * 40 + s2 * Math.cos(a) * 4, ground - 24 + u * 5, bz + az * 40 + s2 * Math.sin(a) * 4, 0, 0, 0, .35, 3.3, o); });
    });
    // willows by the water
    for (let k = 0; k < 34; k++) { const ci = k % canals.length, { cx, cz, ax, az, w } = frame(ci, .05 + g() * .9), sd = g() < .5 ? -1 : 1, tx = cx - az * sd * (w / 2 + 16), tz = cz + ax * sd * (w / 2 + 16);
      if (outline(tx, tz) > .95 || plaza(tx, tz, 20)) continue;
      add(800, r => { const a = r() * TAU, rr = Math.sqrt(r()) * 28, hang = r(); return P(tx + Math.cos(a) * rr, ground - 86 + hang * hang * 66, tz + Math.sin(a) * rr, 0, -.6, .4, .3, .3, dist(tx, tz)); }); }
    // the square: pale stone
    add(Math.PI * 170 * 125, r => { let px, pz; do { px = PL[0] + (r() - .5) * 340; pz = PL[1] + (r() - .5) * 250; } while (!plaza(px, pz)); return P(px, ground, pz, 0, -1, 0, .7, .75, 0); });
    const WARM = tint('#ffe2b4', 2), WHITE = tint('#f4f2ee'), METAL = tint('#2e3238');
    // the landmark — the cloud canopy: a long, thin white roof floating over the middle of the main canal on slender columns,
    // its edge rippling like a cloud, its underside glowing warm at night. Walks and cafés along both banks sit under it.
    const C0 = .3, C1 = .72, cw = u => 74 * (1 + .18 * Math.sin(u * 37) * Math.sin(u * 11 + 1) + .12 * Math.sin(u * 7));
    const ch = (u, v) => 128 + 16 * Math.sin(u * TAU * 2.3 + .6) + 14 * v * v;                       // height: a slow swell along it, edges curling up
    add((C1 - C0) * 2000 * 150 * 2.2, r => { let u, v, px, pz, cx, cz, ax, az;
      do { u = r(); v = r() * 2 - 1; ({ cx, cz, ax, az } = frame(0, C0 + (C1 - C0) * u)); const off = v * cw(u); px = cx - az * off; pz = cz + ax * off; }
      while (Math.abs(v) < .9 && Math.sin(px * .075 + Math.sin(pz * .05) * 1.5) * Math.sin(pz * .075 + Math.sin(px * .04)) > .05);   // perforated: soft openings let light through
      const below = r() < .5, h = ch(u, v) - (below ? 0 : 4), edge = Math.abs(v) > .9 || Math.abs(Math.sin(u * 140)) > .97;   // a bright rim and fine ribs across
      return P(px, ground - h, pz, -az * v * .4, below ? 1 : -1, ax * v * .4, edge ? WHITE : below ? tint('#d9d6cf') : tint('#c9ccd2'), edge ? tint('#fff4e0', 2) : below ? tint('#ffd9a0', 1) : WHITE, .05 + u * .1); });
    for (let u = .02; u < 1; u += .045) [-.78, .78].forEach(v => { const { cx, cz, ax, az } = frame(0, C0 + (C1 - C0) * u), off = v * cw(u), px = cx - az * off, pz = cz + ax * off, top = ch(u, v);
      add(top * 4 * 3, r => { const an = r() * TAU; return P(px + Math.cos(an) * 2.5, ground - r() * top, pz + Math.sin(an) * 2.5, Math.cos(an), 0, Math.sin(an), WHITE, WHITE, .05 + u * .1); }); });
    // the art centre on the square: a round glass pavilion under a thin white disc roof with an open ring in the middle
    const AC = [PL[0], PL[1] + 10];
    add(TAU * 88 * 54 * 1.4, r => { const an = r() * TAU, h = r() * 50, mull = Math.abs(Math.sin(an * 24)) > .93;
      return P(AC[0] + Math.cos(an) * 88, ground - h, AC[1] + Math.sin(an) * 70, Math.cos(an), 0, Math.sin(an), mull ? WHITE : tint('#253038'), mull ? WHITE : (r() < .8 ? WARM : tint('#fff1d6', 3)), .02); });
    add(Math.PI * 118 * 96 * 2, r => { const rr = Math.sqrt(.12 + .88 * r()), an = r() * TAU, below = r() < .5;
      return P(AC[0] + Math.cos(an) * rr * 118, ground - 56 - (below ? 0 : 5) - 8 * (1 - rr), AC[1] + Math.sin(an) * rr * 96, 0, below ? 1 : -1, 0, WHITE, below ? WARM : WHITE, .03); });
    // the hotel: a courtyard block of four storeys with a dark metal roof, a grid of windows, a pool of light in the courtyard
    const HO = [560, -230], HS = 120, HW = 46, HH = 112;
    const inRing = (px, pz) => Math.max(Math.abs(px - HO[0]), Math.abs(pz - HO[1])) < HS && Math.max(Math.abs(px - HO[0]), Math.abs(pz - HO[1])) > HS - HW;
    add(8 * HS * HH * 1.3, r => { const side = Math.floor(r() * 4), outer = r() < .6, e = outer ? HS : HS - HW, s2 = (r() * 2 - 1) * e, h = r() * HH;
      const [px, pz, nx, nz] = side === 0 ? [HO[0] + s2, HO[1] - e, 0, -1] : side === 1 ? [HO[0] + s2, HO[1] + e, 0, 1] : side === 2 ? [HO[0] - e, HO[1] + s2, -1, 0] : [HO[0] + e, HO[1] + s2, 1, 0];
      const fx = (s2 + 400) % 18, fy = h % 28, win = fx > 4 && fx < 14 && fy > 8 && fy < 22 && h > 6, on = win && ((Math.floor((s2 + 400) / 18) * 7 + Math.floor(h / 28) * 13 + side) * 2654435761 >>> 0) % 100 < 65;
      return P(px, ground - h, pz, outer ? nx : -nx, 0, outer ? nz : -nz, win ? .2 : .9, on ? 2.3 : win ? .2 : .9, .12); });
    add(4 * HS * HW * 1.2, r => { let px, pz; do { px = HO[0] + (r() * 2 - 1) * HS; pz = HO[1] + (r() * 2 - 1) * HS; } while (!inRing(px, pz)); return P(px, ground - HH, pz, 0, -1, 0, METAL, METAL, .12); });
    add((HS - HW) * (HS - HW) * 3, r => { const px = HO[0] + (r() * 2 - 1) * (HS - HW - 6), pz = HO[1] + (r() * 2 - 1) * (HS - HW - 6), pool = Math.abs(px - HO[0]) < 40 && Math.abs(pz - HO[1]) < 22;
      return P(px, ground - 1, pz, 0, -1, 0, pool ? tint('#2d5f6e') : .7, pool ? tint('#5fd6e8', 2) : .75, .12); });
    // the city around the site: low grey blocks on a street grid, unlit — the context a site model sits in
    for (let i = -22; i <= 22; i++) for (let j = -22; j <= 22; j++) {
      const bx = i * 92 + (g() - .5) * 10, bz = j * 92 + (g() - .5) * 10, q = outline(bx, bz);
      if (q < 1.08 || q > 1.75 || g() < .15) continue;
      const bw = 50 + g() * 26, bd = 50 + g() * 26, bh = 18 + g() * g() * 110, o = .9 + g() * .1;
      add((bw * bd + 2 * (bw + bd) * bh) * .22, r => { const f2 = r() * (bw * bd + 2 * (bw + bd) * bh);
        if (f2 < bw * bd) return P(bx + (r() - .5) * bw, ground - bh, bz + (r() - .5) * bd, 0, -1, 0, .5, .5, o);
        const side = r() < bw / (bw + bd) ? 0 : 1, sd = r() < .5 ? -1 : 1, h = r() * bh;
        return side ? P(bx + sd * bw / 2, ground - h, bz + (r() - .5) * bd, sd, 0, 0, .42, .42, o) : P(bx + (r() - .5) * bw, ground - h, bz + sd * bd / 2, 0, 0, sd, .42, .42, o); });
    }
    const tot = parts.reduce((s2, [a2]) => s2 + a2, 0), p = new Float32Array(N * 4), a = new Float32Array(N * 4), o = new Float32Array(N), r = rng(ws * 104729 + 7);
    let k = 0;
    parts.forEach(([area, f], i) => { const n = i === parts.length - 1 ? N - k : Math.round(N * area / tot);
      for (let j = 0; j < n && k < N; j++, k++) { const q = f(r), on = lit && (q.ml >= 2 && q.ml < 10 || q.ml >= 10 + 262144);
        p.set([q.px + x, q.py, q.pz + z, size * (on ? 1.3 : 1) * (.7 + r() * .5)], k * 4); a.set([q.nx, q.ny, q.nz, lit ? q.ml : q.m], k * 4); o[k] = Math.min(1, q.o + r() * .08); } });
    return { p, a, o };
  };
}

/* a hover bike (no make): a long slim body with the rider's seat and handlebars at the back, two long rods reaching far forward with
   steering vanes on their tips, a big engine block under the seat with a glowing exhaust, no wheels — it floats over a glowing pad.
   Olive and grey military paint with panel seams. lit = 1: engine, exhaust, repulsor glow under it, running lights. Builds front to back. */
function hoverBike({ lit = 0, glow = '#ff8a3a', length = 900, hover = 110, pad = true, size = 1.5, x = 0, y = 0, z = 0 } = {}) {
  return (N, seed) => {
    const s = length / 900, G = 0;
    const OLIVE = tint('#7d8466'), PANEL = tint('#5f654e'), GREY = tint('#8a8d8f'), DARKG = tint('#3a3d3f'), BLACK = tint('#101112'), SEATC = tint('#2b2622');
    const BURN = lit ? tint(glow, 3) : tint('#3a2a20'), REP = lit ? tint('#7fd6ff', 2) : tint('#22303a'), RUN = lit ? tint('#ff3b2e', 3) : tint('#3a1412');
    const parts = [], add = (area, f) => parts.push([area, f]);
    const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const H = hover + 60;                                                         // height of the body's centre line above the pad
    const Pt = (px, h, pz, n, m, o) => ({ px, py: G - h, pz, n: [n[0], -n[1], n[2]], m, o: o ?? clamp((px + 450) / 900, 0, 1) });
    const seam = px => Math.abs((px + 1000) % 38) < 1.1;
    // a loft along x; sec(t) → { hw, hh, hc } ; k sets how square the sections are
    const loft = (x0, x1, sec, k = 2 / 4) => (t, a) => { const tt = clamp(t, 0, 1), q = sec(tt), c = Math.cos(a), sn = Math.sin(a);
      return [x0 + (x1 - x0) * tt, q.hc + q.hh * Math.sign(sn) * Math.pow(Math.abs(sn), k), (q.zc || 0) + q.hw * Math.sign(c) * Math.pow(Math.abs(c), k)]; };
    const skin = (S, sec, x0, x1, area, paint) => add(area, r => { let t, a, p, q, tries = 0;
      do { t = r(); a = r() * TAU; p = S(t, a); q = S(t, a + .002); } while (r() * 300 > Math.min(300, Math.hypot(...q.map((v, i) => v - p[i])) / .002) && ++tries < 40);
      const pu = S(t + .002, a), A = pu.map((v, i) => v - p[i]), B = q.map((v, i) => v - p[i]);
      let n = [A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]]; const l = Math.hypot(...n) || 1; n = n.map(v => v / l);
      const c = sec(clamp(t, 0, 1)); if (n[1] * (p[1] - c.hc) + n[2] * (p[2] - (c.zc || 0)) < 0) n = n.map(v => -v);
      return Pt(p[0], p[1], p[2], n, paint(p, n, t)); });
    // the main body: a slim beam from the front of the rods' mount back to the tail, thickening into the engine block under the seat
    const bodySec = t => ({ hw: 16 + 30 * smooth(.25, .55, t) - 8 * smooth(.85, 1, t), hh: 14 + 34 * smooth(.3, .55, t) - 14 * smooth(.8, 1, t), hc: H - 4 - 18 * smooth(.3, .55, t) });
    const body = loft(-170, 430, bodySec);
    skin(body, bodySec, -170, 430, 600 * 120, (p, n, t) => {
      if (t > .45 && t < .85 && Math.abs(n[2]) > .8 && Math.abs((p[0] + 1000) % 14) < 5 && p[1] < H - 8) return DARKG;   // cooling fins on the engine block
      if (t > .97) return BURN;                                                                                       // the exhaust at the tail
      if (Math.abs(n[2]) > .7 && Math.abs(p[1] - (H + 4)) < 2 && t < .45) return GREY;                               // a pale stripe along the beam
      return seam(p[0]) ? PANEL : OLIVE; });
    // the seat and the rider's hump in front of it
    const seatSec = t => ({ hw: 22 + 6 * Math.sin(Math.PI * t), hh: 8 + 10 * Math.sin(Math.PI * t), hc: H + 18 + 26 * smooth(0, .4, t) - 12 * smooth(.7, 1, t) });
    skin(loft(60, 330, seatSec, 2 / 2.6), seatSec, 60, 330, 270 * 60, (p, n, t) => t > .35 && n[1] > .4 ? SEATC : t < .3 ? GREY : OLIVE);
    // handlebars: a short stem rising in front of the seat, a wide bar, grips; a small screen
    const tube = (A, B, rad, col, dense = 1) => add(Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) * rad * TAU * dense, r => {
      const D = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], L = Math.hypot(...D), u = D.map(v => v / L), ref = Math.abs(u[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
      let e1 = [u[1] * ref[2] - u[2] * ref[1], u[2] * ref[0] - u[0] * ref[2], u[0] * ref[1] - u[1] * ref[0]]; const l1 = Math.hypot(...e1); e1 = e1.map(v => v / l1);
      const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]], f = r(), an = r() * TAU, nn = e1.map((v, i) => v * Math.cos(an) + e2[i] * Math.sin(an));
      return Pt(A[0] + D[0] * f + nn[0] * rad, A[1] + D[1] * f + nn[1] * rad, A[2] + D[2] * f + nn[2] * rad, nn, typeof col === 'function' ? col(f) : col); });
    tube([40, H + 30, 0], [20, H + 78, 0], 7, DARKG);
    tube([20, H + 78, -62], [20, H + 78, 62], 5, DARKG);
    [-1, 1].forEach(sd => { tube([20, H + 78, sd * 62], [36, H + 74, sd * 84], 6, BLACK, 1.5); tube([90, H + 4, sd * 30], [130, H - 14, sd * 52], 4, GREY); });   // grips, foot pegs
    add(40 * 30, r => { const u = r(), v = r() * 2 - 1; return Pt(14 - u * 16, H + 52 + u * 30, v * 22, [-.8, .6, 0], u > .9 || Math.abs(v) > .9 ? GREY : tint('#1a2a24')); });   // screen
    // two long rods reaching forward from the front of the body, slightly apart, with steering vanes on the tips
    [-1, 1].forEach(sd => {
      tube([-160, H - 2, sd * 13], [-410, H + 2, sd * 30], 6.5, f => seam(-160 - f * 250) ? PANEL : GREY, 1.4);
      // the vane: a vertical plate on the outside of the rod tip, wider at the front, with a running light at its nose
      add(110 * 70 * 2, r => { const u = r(), v = r(), px = -470 + u * 110, hh = 26 + 12 * (1 - u), h = H + 2 + (v * 2 - 1) * hh, side = r() < .5 ? -1 : 1;
        const light = u < .06 && Math.abs(h - H - 2) < 6;
        return Pt(px, h, sd * (36 + 3 * side), [0, 0, sd * side], light ? RUN : Math.abs(h - H - 2) < 1.2 || seam(px) ? PANEL : OLIVE, .02); });
      // a small flap above and below each vane
      [-1, 1].forEach(ud => add(50 * 20, r => { const u = r(), w = r(), px = -440 + u * 50, h = H + 2 + ud * (40 + w * 4); return Pt(px, h, sd * (30 + w * 16), [0, ud, 0], DARKG, .02); }));
    });
    // repulsor glow under the engine block, and the pad it hovers over
    add(Math.PI * 60 * 30, r => { const rr = Math.sqrt(r()), an = r() * TAU; return Pt(200 + Math.cos(an) * rr * 90, H - 54, Math.sin(an) * rr * 30, [0, -1, 0], rr > .85 ? REP : DARKG); });
    if (pad) add(Math.PI * 520 * 520 * .25, r => { const rr = 520 * Math.sqrt(r()), an = r() * TAU, edge = rr > 512, ring = (rr % 40) < 1.2, under = Math.hypot((Math.cos(an) * rr - 200) / 2.2, Math.sin(an) * rr) < 50;
      return Pt(Math.cos(an) * rr, -2, Math.sin(an) * rr, [0, 1, 0], edge ? (lit ? tint('#ffb070', 2) : tint('#2c3034')) : under && lit ? tint('#2c4652', 1) : ring ? tint('#24272b') : tint('#121315'), rr / 520 * .3); });
    const tot = parts.reduce((t2, [a2]) => t2 + a2, 0), p = new Float32Array(N * 4), a = new Float32Array(N * 4), o = new Float32Array(N), r = rng(seed * 31 + 3);
    let k = 0;
    parts.forEach(([area, f], i) => { const n = i === parts.length - 1 ? N - k : Math.round(N * area / tot);
      for (let j = 0; j < n && k < N; j++, k++) { const q = f(r);
        p.set([q.px * s + x, q.py * s + y + 300, q.pz * s + z, size * (.75 + r() * .4)], k * 4); a.set([q.n[0], q.n[1], q.n[2], q.m], k * 4); o[k] = q.o * .9 + r() * .1; } });
    return { p, a, o };
  };
}

/* a picture made of particles that keep the picture's own colours: bright places get more particles, dark places stay empty.
   src = an image URL (or data: URL, or a loaded <img>). plane 'xy' faces the camera; 'xz' lies flat, like a galaxy seen from above.
   depth = how thick it is (px); only the brightest, smoothest parts swell. gamma > 1 thins out faint haze; floor = brightness below which nothing lands;
   sharpen > 0 favours small bright details (stars, windows) over smooth glow, and empties dark lanes. */
const pending = [];
function photo(src, { width = 900, x = 0, y = 0, z = 0, plane = 'xy', depth = 0, gamma = 1.5, floor = .04, sharpen = 0, size = 2.4, res = 1024 } = {}) {
  let px = null, w = 0, h = 0;
  const got = (typeof src === 'string' ? load(src) : Promise.resolve(src)).then(img => {
    const k = Math.min(1, res / Math.max(img.width, img.height)); w = Math.round(img.width * k); h = Math.round(img.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
    try { px = g.getImageData(0, 0, w, h).data; }
    catch (e) { throw new Error('photo: the browser will not let the page read this image (opened from file://?). Use a data: URL, or render with render.py'); }
  });
  pending.push(got);
  return (N, seed) => {
    if (!px) throw new Error('photo: image not loaded yet — build the scene with Particles.scene, which waits for it');
    const r = rng(seed + 29), cdf = new Float64Array(w * h), L = new Float32Array(w * h); let tot = 0;
    for (let i = 0; i < w * h; i++) L[i] = (px[i * 4] * .3 + px[i * 4 + 1] * .55 + px[i * 4 + 2] * .15) / 255;
    let soft = L;
    if (sharpen) {                                                              // a blurred copy (box blur, twice each way); detail = L − blur
      const box = (src, dx, dy) => { const out = new Float32Array(w * h), rad = Math.max(2, Math.round(w / 260));
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let sum = 0, n = 0;
          for (let q = -rad; q <= rad; q++) { const ii = i + q * dx, jj = j + q * dy; if (ii >= 0 && ii < w && jj >= 0 && jj < h) { sum += src[jj * w + ii]; n++; } }
          out[j * w + i] = sum / n; } return out; };
      soft = box(box(box(box(L, 1, 0), 0, 1), 1, 0), 0, 1);
    }
    for (let i = 0; i < w * h; i++) { tot += Math.pow(Math.max(0, L[i] + sharpen * (L[i] - soft[i]) - floor), gamma); cdf[i] = tot; }
    if (!tot) throw new Error('photo: the image is all dark');
    const p = new Float32Array(N * 4), a = new Float32Array(N * 4), o = new Float32Array(N).fill(-1), s = width / w;
    const gauss = () => { let v = 0; for (let i = 0; i < 4; i++) v += r(); return (v - 2) / .58; };
    for (let n = 0; n < N; n++) {
      let lo = 0, hi = w * h - 1; const u = r() * tot; while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; }
      const R = px[lo * 4], G = px[lo * 4 + 1], B = px[lo * 4 + 2], mx = Math.max(R, G, B, 1);
      const th = depth * Math.max(.02, (soft[lo] - .55) / .4) ** 2, j = .7 + th / s * .5, u2 = ((lo % w) + .5 + gauss() * j - w / 2) * s, v2 = (Math.floor(lo / w) + .5 + gauss() * j - h / 2) * s, d = gauss() * th;   // the bright middle swells, the rest stays a thin sheet; each point spreads as a ball, not a column
      if (plane === 'xz') p.set([u2 + x, d + y, v2 + z, size * (.5 + r() * .8)], n * 4); else p.set([u2 + x, v2 + y, d + z, size * (.5 + r() * .8)], n * 4);
      a[n * 4 + 3] = pack(R / mx, G / mx, B / mx);                            // its own colour, at full strength: how bright a place is comes from how many particles land there
    }
    return { p, a, o };
  };
}

/* ---------- GL ---------- */
const VS = `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uP, uAt, uO; uniform int uRows;
uniform int uA, uB; uniform float uSweep, uSweepW, uShine, uSpinA, uSpinB, uP0, uStagger, uSwirl, uTime, uFocal, uDist, uScale, uTwinkle, uDrift, uAmbient, uFocus, uDof;
uniform mat3 uRot; uniform vec3 uTarget, uLight; uniform vec2 uRes; uniform float uRoll, uSolid;
uniform vec3 uC0, uC1, uC2, uC3, uD0, uD1, uD2, uD3;
in vec4 aRand;
out vec3 vCol; out float vA, vLight;
ivec2 at(int s, int i) { return ivec2(i % 1024, i / 1024 + s * uRows); }
vec3 spinY(vec3 v, float an) { float c = cos(an), s = sin(an); return vec3(v.x * c - v.z * s, v.y, v.x * s + v.z * c); }
vec3 shade(vec4 at, vec3 c0, vec3 c1, vec3 c2, vec3 c3, float an) {
  float m = at.w < 0.0 ? aRand.w : at.w;
  vec3 col;
  if (m >= 10.0) {                                                             // its own colour (tint, photo): 6 bits a channel, glow level on top
    float v = m - 10.0, lv = floor(v / 262144.0); v -= lv * 262144.0;
    col = vec3(floor(v / 4096.0), mod(floor(v / 64.0), 64.0), mod(v, 64.0)) / 63.0;
    if (lv > 0.0) { col *= (1.0 + (lv - 1.0) * .75) * 1.25; if (dot(at.xyz, at.xyz) < .01) return col; return col * (.55 + .45 * max(dot(uRot * spinY(at.xyz, an), uLight), 0.0)); }   // glows, but still shows its shape
  } else {
    if (m >= 3.0) return c3 * (1.0 + (m - 3.0) * 1.5) * 1.25;                  // emits its own light, second colour
    if (m >= 2.0) return c2 * (1.0 + (m - 2.0) * 1.5) * 1.25;                  // emits its own light
    col = mix(c0, c1, clamp(m, 0.0, 1.0));
  }
  if (dot(at.xyz, at.xyz) < .01) return col;
  vec3 n = normalize(uRot * spinY(at.xyz, an)), h = normalize(uLight + vec3(0, 0, -1));
  return col * (uAmbient + (1.0 - uAmbient) * max(dot(n, uLight), 0.0)) + uShine * pow(max(dot(n, h), 0.0), 60.0);   // shine: a glossy highlight (paint, chrome)
}
void main() {
  int i = gl_VertexID;
  vec4 A = texelFetch(uP, at(uA, i), 0), B = texelFetch(uP, at(uB, i), 0);
  vec4 AA = texelFetch(uAt, at(uA, i), 0), BB = texelFetch(uAt, at(uB, i), 0);
  float ord = texelFetch(uO, at(uB, i), 0).r;
  A.xyz = spinY(A.xyz, uSpinA); B.xyz = spinY(B.xyz, uSpinB);
  float d = (ord < 0.0 ? aRand.x : ord) * uStagger, p = clamp((uP0 - d) / max(1e-4, 1.0 - uStagger), 0.0, 1.0);
  float e = p < .5 ? 4.0 * p * p * p : 1.0 - pow(-2.0 * p + 2.0, 3.0) / 2.0;
  float bell = sin(3.14159 * p) * clamp(length(B.xyz - A.xyz) / 160.0, 0.0, 1.0);   // only particles that travel bow out and flare
  vec3 pos = mix(A.xyz, B.xyz, e);
  float lt = (e > .5 ? B.w : A.w) < 0.0 ? 1.0 : 0.0; vLight = lt;            // sparkle: a loose point of light, not a solid dot
  pos += vec3(sin(uTime * 1.7 + aRand.y * 60.0), cos(uTime * 1.3 + aRand.z * 60.0), sin(uTime * 1.1 + aRand.w * 60.0)) * 3.0 * lt;
  pos += vec3(sin(aRand.y * 6.283 + p * 3.1), cos(aRand.z * 6.283 + p * 2.7), sin(aRand.w * 6.283 + p * 2.3)) * uSwirl * bell * (.4 + aRand.x);
  pos += vec3(sin(uTime * .7 + aRand.y * 40.0), cos(uTime * .6 + aRand.z * 40.0), sin(uTime * .5 + aRand.w * 40.0)) * uDrift;
  pos = uRot * (pos - uTarget);
  float z = pos.z + uDist, near = smoothstep(40.0, 340.0, z);                   // flying through: close to the lens, particles thin out instead of popping
  if (z < 40.0 || (uSolid > .5 && aRand.y > near)) { gl_Position = vec4(2, 2, 2, 1); return; }
  float k = uFocal / z;
  vec2 s = pos.xy * k * uScale; s = mat2(cos(uRoll), sin(uRoll), -sin(uRoll), cos(uRoll)) * s;   // roll: tilt the horizon
  gl_Position = vec4(s.x / (uRes.x * .5), -s.y / (uRes.y * .5), clamp(z / 20000.0, 0.0, 1.0) * 2.0 - 1.0, 1);   // depth only matters in solid mode
  float tw = 1.0 + uTwinkle * sin(uTime * (2.0 + aRand.z * 3.0) + aRand.y * 90.0);
  float base = max(1.0, mix(abs(A.w), abs(B.w), e) * k * uScale * tw * 1.4);
  float blur = min(9.0, uDof * abs(z - uFocus) / uFocus * 26.0);                            // depth of field: out of focus = bigger and dimmer
  gl_PointSize = min(base + blur, 56.0);
  vCol = mix(shade(AA, uC0, uC1, uC2, uC3, uSpinA), shade(BB, uD0, uD1, uD2, uD3, uSpinB), e) * (1.0 + bell * .6);
  vCol *= 1.0 - lt * .6 * (.5 + .5 * sin(uTime * (2.5 + aRand.z * 4.0) + aRand.y * 90.0));   // sparkles twinkle
  vCol *= 1.0 + 1.4 * exp(-pow((s.x * .6 - s.y * .8 - uSweep) / uSweepW, 2.0));   // a band of light sweeping across
  vA = clamp(k * 1.2, .2, 1.6) * (base * base) / ((base + blur) * (base + blur)) * near;
}`;
const FS = `#version 300 es
precision highp float; uniform float uGain, uSolid, uPass; in vec3 vCol; in float vA, vLight; out vec4 o;
void main() { float d = length(gl_PointCoord - .5) * 2.0; if (d > 1.0) discard;
  if (uSolid > .5 && (vLight > .5) != (uPass > .5)) discard;                  // solid scenes: pass 0 draws solid dots, pass 1 the sparkles
  if (uSolid > .5 && uPass < .5) { o = vec4(vCol * (1.0 - .25 * d * d), 1); return; }       // solid: an opaque dot, nearer dots hide farther ones
  float core = exp(-d * d * 9.0), halo = exp(-d * d * 2.2) * .35; o = vec4(vCol * (core + halo) * vA * uGain, 1); }`;
const QUAD = `#version 300 es
in vec2 aP; out vec2 vUv; void main() { vUv = aP * .5 + .5; gl_Position = vec4(aP, 0, 1); }`;
const BLUR = `#version 300 es
precision highp float; uniform sampler2D uT; uniform vec2 uDir; in vec2 vUv; out vec4 o;
void main() { vec3 c = texture(uT, vUv).rgb * .227;
  c += (texture(uT, vUv + uDir * 1.385).rgb + texture(uT, vUv - uDir * 1.385).rgb) * .316;
  c += (texture(uT, vUv + uDir * 3.231).rgb + texture(uT, vUv - uDir * 3.231).rgb) * .070; o = vec4(c, 1); }`;
const COMP = `#version 300 es
precision highp float; uniform sampler2D uScene, uB1, uB2; uniform vec3 uBg; uniform float uBloom, uExposure, uVignette; in vec2 vUv; out vec4 o;
void main() { vec3 c = texture(uScene, vUv).rgb + (texture(uB1, vUv).rgb * .6 + texture(uB2, vUv).rgb * .9) * uBloom;
  float L = max(max(c.r, c.g), c.b); c = c * (1.0 - exp(-L * uExposure)) / max(L, 1e-4);   // tone map on brightness only: overlapping points stay their colour instead of going white
  vec2 q = vUv - .5; float v = 1.0 - dot(q, q) * uVignette;
  float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - .5;   // dither: no banding in the dark gradients
  o = vec4((uBg + c * (1.0 - uBg)) * v + n / 255.0 * 1.5, 1); }`;
function hexrgb(h) { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }

function create(opts = {}) {
  const O = { count: 40000, background: '#04050a', bloom: 1, exposure: 1.3, gain: .5, vignette: 1.1, twinkle: .25, drift: 2.0, focal: 1600, seed: 1,
              light: [-.45, -.7, .55], ambient: .22, dof: .5, ...opts };
  const keys = [], cams = [];
  const P = {
    opts: O, keys, cams,
    /* fly into a shape: starts at t, takes dur. swirl = how far the paths bow out (px); stagger = 0–0.9, how spread out the arrivals are
       (in the shape's own order if it has one, else random); colors = [a, b, glow, glow2]; spin = radians per second the shape turns about its vertical axis */
    to(t, shape, { dur = 4, swirl = 120, stagger = .5, colors, label, spin } = {}) { keys.push({ t, shape, dur, swirl, stagger, colors, label, spin }); return P; },
    /* camera: rotX tips it to look down (radians), rotY orbits; target = [x, y, z] the point it looks at; dist = how far back; eased over dur */
    camera(t, { rotX = 0, rotY = 0, dist = 1600, zoom = 1, roll = 0, target = [0, 0, 0], dur = 3 } = {}) { cams.push({ t, rotX, rotY, dist, zoom, roll, target, dur }); return P; },   // the target is in focus; dof (create option) sets how soft the rest gets
  };
  return P;
}

function scene(P, opts = {}) {
  const O = { ...P.opts, ...opts }, N = O.count;
  const cv = O.canvas || document.querySelector('canvas'); cv.width = W; cv.height = H;
  const gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL2 is not available in this browser');
  gl.getExtension('EXT_color_buffer_float');
  const prog = (vs, fs) => { const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); gl.attachShader(p, s); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const pPts = prog(VS, FS), pBlur = prog(QUAD, BLUR), pComp = prog(QUAD, COMP);
  const U = (p, n) => gl.getUniformLocation(p, n);
  const target = (w, h) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR);
    for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return { t, f, w, h }; };
  const S0 = target(W, H), depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, W, H);
  gl.bindFramebuffer(gl.FRAMEBUFFER, S0.f); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  const A1 = target(W / 4, H / 4), B1 = target(W / 4, H / 4), A2 = target(W / 12, H / 12), B2 = target(W / 12, H / 12);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vaoQ = gl.createVertexArray(); gl.bindVertexArray(vaoQ);
  for (const p of [pBlur, pComp]) { const l = gl.getAttribLocation(p, 'aP'); if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); } }
  const r = rng(O.seed), rnd = new Float32Array(N * 4); for (let k = 0; k < N * 4; k++) rnd[k] = r();
  const vaoP = gl.createVertexArray(); gl.bindVertexArray(vaoP);
  const rb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, rb); gl.bufferData(gl.ARRAY_BUFFER, rnd, gl.STATIC_DRAW);
  const la = gl.getAttribLocation(pPts, 'aRand'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 4, gl.FLOAT, false, 0, 0);

  const keys = [...P.keys].sort((a, b) => a.t - b.t), cams = [...P.cams].sort((a, b) => a.t - b.t);
  if (!keys.length) throw new Error('no shapes — call P.to(t, shape) at least once');
  const rows = Math.ceil(N / 1024); let texP = null, texA = null, texO = null, sounds = [], duration = O.duration;
  const tex = (data, internal, format, comps) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, 1024, rows * keys.length, 0, format, gl.FLOAT, data);
    for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST); return t; };
  // spin is continuous: each shape starts at the angle the previous one had reached
  // spin: a key that sets spin (even 0) carries on from the angle the previous one reached; a key without spin shows its shape as authored
  let ang = 0; keys.forEach((k, i) => { k.base = k.spin === undefined ? 0 : ang; const nx = keys[i + 1]; if (nx) ang = k.base + (k.spin || 0) * (nx.t - k.t); });
  const angle = (k, t) => k.base + (k.spin || 0) * Math.max(0, t - k.t);
  const ready = Promise.all([document.fonts.ready, ...pending]).then(() => {
    const size = 1024 * rows * keys.length, P4 = new Float32Array(size * 4), A4 = new Float32Array(size * 4), O1 = new Float32Array(size).fill(-1);
    keys.forEach((k, s) => { const sol = asSolid(k.shape(N, O.seed), N); P4.set(sol.p, s * 1024 * rows * 4); A4.set(sol.a, s * 1024 * rows * 4); O1.set(sol.o, s * 1024 * rows); });
    texP = tex(P4, gl.RGBA32F, gl.RGBA); texA = tex(A4, gl.RGBA32F, gl.RGBA); texO = tex(O1, gl.R32F, gl.RED);
    keys.forEach((k, i) => { if (i && k.dur > .2) { sounds.push({ t: k.t, dur: k.dur * .8, kind: 'whoosh' }); sounds.push({ t: k.t + k.dur * .82, kind: 'shimmer' }); } });
    duration = duration || keys[keys.length - 1].t + keys[keys.length - 1].dur + 3;
  });
  const colOf = k => { const c = (k.colors || O.colors || ['#ffffff', '#9fd4ff']); return [c[0], c[1], c[2] || c[1], c[3] || c[2] || c[1]].map(hexrgb); };
  function state(t) {
    let i = 0; while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
    const k = keys[i], prev = i ? i - 1 : 0, p = k.dur > 0 ? clamp((t - k.t) / k.dur, 0, 1) : 1;
    return { a: i ? prev : 0, b: i, p: i ? p : 1, k, ka: keys[prev] };
  }
  // the camera: each key arrives at t + dur. Plain: ease in and out of every key. glide: pass through the keys without stopping
  // (a smooth curve that keeps its speed; it only eases at the first and last key, and where the camera waits before a key's t)
  const vec = c => [c.rotX, c.rotY, c.dist, c.zoom, c.roll || 0, ...c.target], unvec = v => ({ rotX: v[0], rotY: v[1], dist: v[2], zoom: v[3], roll: v[4], target: v.slice(5, 8) });
  const knots = (() => { let last = { t: 0, v: [0, 0, 1600, 1, 0, 0, 0, 0] }; const ks = [last];
    for (const c of cams) { if (c.t > last.t + 1e-3) ks.push(last = { t: c.t, v: last.v, hold: true }); ks.push(last = { t: c.t + Math.max(c.dur, 1e-3), v: vec(c) }); }
    ks.forEach((q, i) => { const a = ks[i - 1], b = ks[i + 1];
      q.m = q.v.map((x, j) => { if (!a || !b || q.hold || b.hold) return 0; const d0 = x - a.v[j], d1 = b.v[j] - x; return d0 * d1 <= 0 ? 0 : (b.v[j] - a.v[j]) / (b.t - a.t); }); });
    return ks; })();
  function cam(t) {
    let v;
    if (O.glide) {
      let i = 0; while (i + 1 < knots.length - 1 && knots[i + 1].t <= t) i++;
      const A = knots[i], B = knots[i + 1] || A, h = Math.max(1e-3, B.t - A.t), u = clamp((t - A.t) / h, 0, 1), u2 = u * u, u3 = u2 * u;
      v = unvec(A.v.map((x, j) => (2 * u3 - 3 * u2 + 1) * x + (u3 - 2 * u2 + u) * h * A.m[j] + (-2 * u3 + 3 * u2) * B.v[j] + (u3 - u2) * h * B.m[j]));
    } else {
      v = { rotX: 0, rotY: 0, dist: 1600, zoom: 1, roll: 0, target: [0, 0, 0] };
      for (const c of cams) { if (t < c.t) break; const u = ease(clamp((t - c.t) / Math.max(1e-3, c.dur), 0, 1));
        v = { rotX: lerp(v.rotX, c.rotX, u), rotY: lerp(v.rotY, c.rotY, u), dist: lerp(v.dist, c.dist, u), zoom: lerp(v.zoom, c.zoom, u), roll: lerp(v.roll, c.roll || 0, u), target: v.target.map((x, j) => lerp(x, c.target[j], u)) }; }
    }
    const f = O.float || 0;                                                     // float: a slow handheld breathing, never quite still
    v.rotX += f * (.012 * Math.sin(t * .53 + .3) + .005 * Math.sin(t * 1.31 + 2)); v.rotY += f * (.016 * Math.sin(t * .41 + 1.7) + .006 * Math.sin(t * 1.07)); v.roll += f * .008 * Math.sin(t * .37 + 2.1);
    return v;
  }
  const L = (() => { const l = O.light, n = Math.hypot(...l); return l.map(x => x / n); })();
  function draw(t) {
    if (!texP) return;
    const st = state(t), c = cam(t), bg = hexrgb(O.background);
    const cx = Math.cos(c.rotX), sx = Math.sin(c.rotX), cy = Math.cos(c.rotY), sy = Math.sin(c.rotY);
    const rot = [cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy];   // Ry · Rx, column-major
    gl.bindFramebuffer(gl.FRAMEBUFFER, S0.f); gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(pPts); gl.bindVertexArray(vaoP);
    if (O.solid) gl.enable(gl.DEPTH_TEST); else { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); }
    const sw = (O.sweeps || []).find(q => t >= q.t && t < q.t + (q.dur || 1.2));
    gl.uniform1f(U(pPts, 'uSweep'), sw ? -1300 + 2600 * (t - sw.t) / (sw.dur || 1.2) : 1e5); gl.uniform1f(U(pPts, 'uSweepW'), 120);
    gl.uniform1f(U(pPts, 'uSolid'), O.solid ? 1 : 0); gl.uniform1f(U(pPts, 'uShine'), O.shine || 0);
    [[texP, 'uP'], [texA, 'uAt'], [texO, 'uO']].forEach(([x, n], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, x); gl.uniform1i(U(pPts, n), i); });
    gl.uniform1i(U(pPts, 'uRows'), rows);
    gl.uniform1i(U(pPts, 'uA'), st.a); gl.uniform1i(U(pPts, 'uB'), st.b); gl.uniform1f(U(pPts, 'uP0'), st.p);
    gl.uniform1f(U(pPts, 'uSpinA'), angle(st.ka, t)); gl.uniform1f(U(pPts, 'uSpinB'), angle(st.k, t));
    gl.uniform1f(U(pPts, 'uStagger'), st.k.stagger); gl.uniform1f(U(pPts, 'uSwirl'), st.k.swirl); gl.uniform1f(U(pPts, 'uTime'), t);
    gl.uniform1f(U(pPts, 'uFocal'), O.focal); gl.uniform1f(U(pPts, 'uDist'), c.dist); gl.uniform1f(U(pPts, 'uScale'), c.zoom);
    gl.uniform1f(U(pPts, 'uTwinkle'), O.twinkle); gl.uniform1f(U(pPts, 'uDrift'), O.drift); gl.uniform1f(U(pPts, 'uGain'), O.gain); gl.uniform1f(U(pPts, 'uAmbient'), O.ambient); gl.uniform1f(U(pPts, 'uFocus'), c.dist); gl.uniform1f(U(pPts, 'uDof'), O.dof);
    gl.uniformMatrix3fv(U(pPts, 'uRot'), false, rot); gl.uniform1f(U(pPts, 'uRoll'), c.roll); gl.uniform2f(U(pPts, 'uRes'), W, H); gl.uniform3fv(U(pPts, 'uTarget'), c.target); gl.uniform3fv(U(pPts, 'uLight'), L);
    const [c0, c1, c2, c3] = colOf(st.ka), [d0, d1, d2, d3] = colOf(st.k);
    [['uC0', c0], ['uC1', c1], ['uC2', c2], ['uC3', c3], ['uD0', d0], ['uD1', d1], ['uD2', d2], ['uD3', d3]].forEach(([n, v]) => gl.uniform3fv(U(pPts, n), v));
    gl.uniform1f(U(pPts, 'uPass'), 0); gl.drawArrays(gl.POINTS, 0, N);
    if (O.solid) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false); gl.uniform1f(U(pPts, 'uPass'), 1); gl.drawArrays(gl.POINTS, 0, N); gl.depthMask(true); }   // sparkles: glow, hidden behind solid things
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(pBlur); gl.bindVertexArray(vaoQ); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(U(pBlur, 'uT'), 0);
    const pass = (src, dst, dx, dy) => { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform2f(U(pBlur, 'uDir'), dx / dst.w, dy / dst.h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    pass(S0, A1, 1, 0); pass(A1, B1, 0, 1); pass(B1, A1, 1.6, 0); pass(A1, B1, 0, 1.6);
    pass(B1, A2, 1, 0); pass(A2, B2, 0, 1); pass(B2, A2, 1.8, 0); pass(A2, B2, 0, 1.8);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(pComp);
    [[S0, 'uScene'], [B1, 'uB1'], [B2, 'uB2']].forEach(([x, n], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, x.t); gl.uniform1i(U(pComp, n), i); });
    gl.uniform3fv(U(pComp, 'uBg'), bg); gl.uniform1f(U(pComp, 'uBloom'), O.bloom); gl.uniform1f(U(pComp, 'uExposure'), O.exposure); gl.uniform1f(U(pComp, 'uVignette'), O.vignette);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.activeTexture(gl.TEXTURE0);
  }
  const S = {
    ready, draw,
    get duration() { return duration; },
    get sounds() { return [...sounds, ...(O.sounds || [])]; },
    get timeline() { return keys.map(k => ({ kind: 'to', id: k.label, t0: k.t, t1: k.t + k.dur })); },
    music: O.music || { style: 'none' },
    seek: t => ready.then(() => new Promise(ok => { draw(t); gl.finish(); requestAnimationFrame(() => ok()); })),
  };
  if (!new URLSearchParams(location.search).has('rec')) ready.then(() => { const t0 = performance.now(); const loop = () => { draw(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); }; loop(); });
  return S;
}
function load(url) { return new Promise((ok, no) => { const i = new Image(); if (/^https?:/.test(url)) i.crossOrigin = 'anonymous'; i.onload = () => ok(i); i.onerror = no; i.src = url; }); }

window.Particles = { W, H, create, scene, text, image, svg, drawn, field, ring, sphere, galaxy, lathe, strands, mix, takeover, place, flatten, colorize, city, waterTown, hoverBike, photo, tint, sparkle, gradient, load, rng, ease };
})();
