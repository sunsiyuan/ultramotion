/* paper.js — real paper on a table: cut-outs with thickness and grain, layered scenes with true soft shadows,
   pieces that stand up, fold and unfold, pop-up books, a 3D camera. WebGL2. Every frame is a pure function of t.

     const P = Paper;
     window.__scene = P.scene(async () => {
       const S = P.stage({ width: 1080, height: 1920, light: { from: 315, height: 50 } });
       S.sheet({ w: 1400, h: 2300, x: 540, y: 960, color: '#efe6d6', paper: 'rough', edge: 'clean' });     // the wall
       const sun = S.sheet({ w: 300, h: 300, x: 540, y: 600, z: 40, color: '#e8a33c', draw: P.circle, edge: 'cut' });
       return { duration: 8, camera: t => ({ zoom: 1 + t * .01 }), sounds: S.sounds() };
     });

   Coordinates: x right, y down, in pixels of the stage; z is height toward the camera (the default camera looks straight down at z = 0).
   A sheet's own coordinates are its canvas pixels (0..w, 0..h); its children are placed in those coordinates.
   Any number property can be a function of t.
*/
(function () {
'use strict';
const D2R = Math.PI / 180, TAU = Math.PI * 2;

/* ---------- timing ---------- */
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, t0, t1) => cl((t - t0) / (t1 - t0));
const sm = x => x * x * (3 - 2 * x);
const io = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const oc = x => 1 - Math.pow(1 - x, 3);
const ic = x => x * x * x;
const back = (x, k = 1.4) => 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);           // a little past, then back
const land = x => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.cos(x * Math.PI * 2.5) * Math.exp(-x * 5) * (1 - x) * (1 - x * .2); // overshoot, settle
const EASE = { io, oc, ic, sm, back, land, linear: x => x };
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e7) / 1e7; }; }
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const val = (p, t) => typeof p === 'function' ? p(t) : p;
/* keyframes: P.keys([[0, { x: 0 }], [2, { x: 100 }]], t, ease) → interpolated object */
function keys(k, t, ease = io) {
  if (t <= k[0][0]) return { ...k[0][1] };
  for (let i = 1; i < k.length; i++) if (t <= k[i][0]) {
    const [t0, a] = k[i - 1], [t1, b] = k[i], u = (k[i][2] || ease)((t - t0) / (t1 - t0)), o = { ...a };
    for (const key in b) o[key] = typeof b[key] === 'number' && typeof a[key] === 'number' ? lerp(a[key], b[key], u) : b[key];
    return o;
  }
  return { ...k[k.length - 1][1] };
}

/* ---------- colour ---------- */
function rgb(c) {
  if (Array.isArray(c)) return c;
  const x = document.createElement('canvas').getContext('2d'); x.fillStyle = '#000'; x.fillStyle = c; const s = x.fillStyle;
  if (s[0] === '#') return [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  const m = s.match(/[\d.]+/g); return [m[0] / 255, m[1] / 255, m[2] / 255];
}
const mixc = (a, b, u) => { a = rgb(a); b = rgb(b); return a.map((v, i) => lerp(v, b[i], u)); };
const css = c => { c = rgb(c); return `rgb(${c.map(v => Math.round(cl(v) * 255)).join(',')})`; };

/* ---------- matrices (column-major) ---------- */
const M = {
  id: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
  mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  T(x, y, z) { const m = M.id(); m[12] = x; m[13] = y; m[14] = z; return m; },
  S(x, y, z) { const m = M.id(); m[0] = x; m[5] = y; m[10] = z; return m; },
  axis(ux, uy, uz, a) {           // rotation by a radians about the unit axis u
    const c = Math.cos(a), s = Math.sin(a), k = 1 - c, m = M.id();
    m[0] = c + k * ux * ux;      m[4] = k * ux * uy - s * uz; m[8] = k * ux * uz + s * uy;
    m[1] = k * uy * ux + s * uz; m[5] = c + k * uy * uy;      m[9] = k * uy * uz - s * ux;
    m[2] = k * uz * ux - s * uy; m[6] = k * uz * uy + s * ux; m[10] = c + k * uz * uz;
    return m;
  },
  about(px, py, pz, ux, uy, uz, a) { return M.mul(M.T(px, py, pz), M.mul(M.axis(ux, uy, uz, a), M.T(-px, -py, -pz))); },
  apply(m, p) { const [x, y, z] = p; return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]; },
};
const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  scale: (a, k) => [a[0] * k, a[1] * k, a[2] * k], add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
};
/* a camera / light basis looking along F: R right, D down on the picture */
function basis(F, upHint, roll = 0) {
  let R = v3.norm(v3.cross(upHint, F)); if (!isFinite(R[0]) || Math.hypot(...v3.cross(upHint, F)) < 1e-4) R = v3.norm(v3.cross([0, 0, 1], F));
  let D = v3.cross(R, F);
  if (roll) { const c = Math.cos(roll * D2R), s = Math.sin(roll * D2R); const R2 = v3.add(v3.scale(R, c), v3.scale(D, s)), D2 = v3.add(v3.scale(D, c), v3.scale(R, -s)); R = R2; D = D2; }
  return { R, D, F };
}
function viewProj(C, b, persp, o) {     // persp: { f, aspect, near, far } | ortho: { half, aspect, range }
  const m = new Float32Array(16), { R, D, F } = b, dR = -v3.dot(R, C), dD = -v3.dot(D, C), dF = -v3.dot(F, C);
  if (persp) {
    const { f, aspect, near, far } = persp, A = (far + near) / (far - near), B = -2 * far * near / (far - near), fx = f / aspect, fy = -f;
    m.set([fx * R[0], fy * D[0], A * F[0], F[0], fx * R[1], fy * D[1], A * F[1], F[1], fx * R[2], fy * D[2], A * F[2], F[2], fx * dR, fy * dD, A * dF + B, dF]);
  } else {
    const { halfW, halfH, range } = o, sx = 1 / halfW, sy = -1 / halfH, sz = 1 / range;   // z: −range..range along F → −1..1
    m.set([sx * R[0], sy * D[0], sz * F[0], 0, sx * R[1], sy * D[1], sz * F[1], 0, sx * R[2], sy * D[2], sz * F[2], 0, sx * dR, sy * dD, sz * dF, 1]);
  }
  return m;
}

/* ---------- shapes for draw(g, w, h) ---------- */
const circle = (g, w, h) => { g.beginPath(); g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, TAU); g.fill(); };
const rect = (g, w, h) => g.fillRect(0, 0, w, h);
const rounded = r => (g, w, h) => { g.beginPath(); g.roundRect(0, 0, w, h, r); g.fill(); };
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); }
function path(g, d, x = 0, y = 0, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); g.fill(new Path2D(d)); g.restore(); }
/* cut a hole: everything drawn inside fn(g) is removed from the paper */
function cut(g, fn) { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.strokeStyle = '#000'; fn(g); g.restore(); }
/* radial symmetry, the way folded paper is cut: fn(g, r) draws one wedge (angle 0 … π/n, from the centre, x along the
   wedge's first edge); it is drawn 2n times, every other one mirrored. Use it inside draw or inside cut. */
function radial(g, cx, cy, n, fn) {
  for (let k = 0; k < n; k++) for (const m of [1, -1]) {
    g.save(); g.translate(cx, cy); g.rotate(k * TAU / n); g.scale(1, m);
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1e4, -.0015, Math.PI / n + .0015); g.closePath(); g.clip();
    fn(g); g.restore();
  }
}
/* mirror: draw half, get both halves (the 囍 fold) */
function mirror(g, cx, fn) { fn(g); g.save(); g.translate(cx * 2, 0); g.scale(-1, 1); fn(g); g.restore(); }
/* a wobbly, hand-cut version of a polygon */
function handcut(pts, amt = 2, seed = 1) {
  const r = rng(seed), out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(L / 40));
    for (let k = 0; k < n; k++) { const u = k / n; out.push([lerp(a[0], b[0], u) + (r() - .5) * amt * (k ? 1 : .3), lerp(a[1], b[1], u) + (r() - .5) * amt * (k ? 1 : .3)]); }
  }
  return out;
}
/* blob: a soft organic cut-out (Matisse leaves, clouds, bushes): n lobes round an ellipse */
function blob(g, w, h, { lobes = 7, depth = .18, seed = 1 } = {}) {
  const r = rng(seed), N = 160, ph = Array.from({ length: 3 }, () => r() * TAU), amp = [depth, depth * .45, depth * .25], fr = [lobes, lobes * 2 + 1, lobes * 3 + 2];
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const a = i / N * TAU; let k = 1; for (let j = 0; j < 3; j++) k += amp[j] * Math.sin(a * fr[j] + ph[j]);
    const x = w / 2 + Math.cos(a) * w / 2 / (1 + depth * 1.5) * k, y = h / 2 + Math.sin(a) * h / 2 / (1 + depth * 1.5) * k;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath(); g.fill();
}
async function image(src) { const im = new Image(); im.src = src; await im.decode(); return im; }
function cover(g, im, w, h, fx = .5, fy = .5) {
  const k = Math.max(w / im.width, h / im.height), iw = im.width * k, ih = im.height * k;
  g.drawImage(im, (w - iw) * fx, (h - ih) * fy, iw, ih);
}

/* ---------- the shared paper texture: r height, g tone, b edge noise (coarse), a edge noise (fine) ---------- */
function fiberTexture(N = 512) {
  const r = rng(91), lat = (n, seed) => { const q = rng(seed); return Float32Array.from({ length: n * n }, q); };
  const noise = (n, seed) => { const L = lat(n, seed), out = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * n, fy = y / N * n, x0 = Math.floor(fx), y0 = Math.floor(fy), u = sm(fx - x0), v = sm(fy - y0), x1 = (x0 + 1) % n, y1 = (y0 + 1) % n;
      out[y * N + x] = lerp(lerp(L[y0 * n + x0], L[y0 * n + x1], u), lerp(L[y1 * n + x0], L[y1 * n + x1], u), v);
    } return out; };
  const fbm = (base, oct, seed) => { const o = new Float32Array(N * N); let a = 1, s = 0;
    for (let k = 0; k < oct; k++) { const n = noise(base << k, seed + k); for (let i = 0; i < o.length; i++) o[i] += n[i] * a; s += a; a *= .5; }
    for (let i = 0; i < o.length; i++) o[i] /= s; return o; };
  // fibres: short curved strands, drawn wrapped so the tile repeats
  const fc = document.createElement('canvas'); fc.width = fc.height = N; const g = fc.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N); g.lineCap = 'round';
  for (let i = 0; i < 2600; i++) {
    const x = r() * N, y = r() * N, a = r() * TAU, L = 5 + r() * 22, bend = (r() - .5) * .8, wdt = .35 + r() * .7, al = .04 + r() * .14;
    g.strokeStyle = `rgba(255,255,255,${al})`; g.lineWidth = wdt;
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + Math.cos(a + bend) * L * .5, y + dy + Math.sin(a + bend) * L * .5, x + dx + Math.cos(a) * L, y + dy + Math.sin(a) * L); g.stroke();
    }
  }
  const fib = g.getImageData(0, 0, N, N).data;
  const h1 = fbm(16, 5, 3), t1 = fbm(6, 4, 17), e1 = fbm(8, 4, 29), grain = fbm(128, 2, 53);
  const px = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const f = fib[i * 4] / 255;
    px[i * 4] = cl(h1[i] * .6 + grain[i] * .4 + f * .08) * 255;             // relief
    px[i * 4 + 1] = cl((t1[i] - .5) * 1.4 + .5 + (r() - .5) * .05) * 255;     // tone
    px[i * 4 + 2] = cl(f * 1.6) * 255;                                         // fibres
    px[i * 4 + 3] = cl((e1[i] - .5) * 2 + .5) * 255;                           // edge wobble
  }
  return px;
}

/* paper kinds: bump (relief under raking light), tone (blotchy variation), scale (size of the grain), fibres;
   see-through ones also have opacity (how much of what's behind it hides) and frost (how blurred things behind it look, by their distance) */
const PAPERS = {
  smooth:    { bump: .35, tone: .025, scale: .6,  fiber: .02 },
  card:      { bump: .8,  tone: .04,  scale: 1,   fiber: .04 },    // construction paper, cardstock
  rough:     { bump: 1.5, tone: .05,  scale: 1.2, fiber: .03 },    // watercolour, handmade cotton
  rice:      { bump: .6,  tone: .08,  scale: .9,  fiber: .13 },    // 宣纸, 红纸: visible fibres
  kraft:     { bump: .9,  tone: .12,  scale: 1.1, fiber: .1 },
  cardboard: { bump: 1.4, tone: .1,   scale: 2.2, fiber: .05 },
  print:     { bump: .2,  tone: .01,  scale: .5,  fiber: 0 },      // a photo print, a printed card
  vellum:    { bump: .15, tone: .02,  scale: .5,  fiber: 0,   opacity: .45, frost: 2.6 },   // 硫酸纸, tracing paper: even, frosted
  tissue:    { bump: .5,  tone: .06,  scale: .9,  fiber: .22, opacity: .35, frost: 1.8 },   // 薄宣纸, 雁皮, tissue: cloudy, fibres show
};
/* edges: how the paper was separated. amp (px of irregularity), noise (px, size of the wobble), blur (px), rim (px of exposed core) */
const EDGES = {
  clean:  { kind: 0, amp: 0,   noise: 200, blur: 1.6, rim: 0 },
  knife:  { kind: 0, amp: 0,   noise: 200, blur: 1.1, rim: 0 },     // 剪纸: crisp, keeps hair-thin lines
  cut:    { kind: 1, amp: 2.2, noise: 420, blur: 2.6, rim: 0 },     // scissors: slight wander
  torn:   { kind: 2, amp: 9,   noise: 260, blur: 10,  rim: 5 },     // torn by hand: ragged, a band of white fibres
  deckle: { kind: 3, amp: 4,   noise: 90,  blur: 5,   rim: 2.5 },   // the fuzzy edge of handmade paper
};

/* ---------- GL ---------- */
const EDGE_GLSL = `
uniform sampler2D uTex, uFiber;
uniform vec2 uTexPx; uniform float uRes; uniform vec4 uEdge; uniform vec2 uSeed;
float edgeD(vec2 uv, vec2 px, out vec2 g) {
  vec2 e = 1.0 / uTexPx;
  float a = texture(uTex, uv).a;
  g = vec2(texture(uTex, uv + vec2(e.x, 0.)).a - texture(uTex, uv - vec2(e.x, 0.)).a,
           texture(uTex, uv + vec2(0., e.y)).a - texture(uTex, uv - vec2(0., e.y)).a) * .5 * uRes;
  float d = (a - .5) / max(length(g), .02);
  if (uEdge.z > .5) {
    float n1 = texture(uFiber, (px + uSeed) / uEdge.y).a, n2 = texture(uFiber, (px + uSeed) / (uEdge.y * .18) + .37).a, n3 = texture(uFiber, (px + uSeed) / 160. + .61).r;
    float n = uEdge.z < 1.5 ? n1 : uEdge.z < 2.5 ? (.55 * n1 + .3 * n2 + .3 * n3) : (.3 * n1 + .4 * n2 + .5 * n3);
    d -= uEdge.x * clamp(n, 0., 1.2);
  }
  return d;
}`;
const VS = `#version 300 es
in vec2 aP;
uniform mat4 uVP, uModel; uniform vec2 uSize, uPad;
out vec3 vW; out vec2 vUV, vPx; out vec3 vT, vB, vN;
void main() {
  vec4 w = uModel * vec4(aP, 0., 1.);
  vW = w.xyz; vPx = aP; vUV = (aP + uPad) / (uSize + 2. * uPad);
  vT = mat3(uModel)[0]; vB = mat3(uModel)[1]; vN = cross(vT, vB);
  gl_Position = uVP * w;
}`;
const FS_SHADOW = `#version 300 es
precision highp float;
in vec3 vW; in vec2 vUV, vPx; in vec3 vT, vB, vN;
${EDGE_GLSL}
uniform float uOpacity;
void main() { vec2 g; if (edgeD(vUV, vPx, g) < 0.) discard;
  if (uOpacity < .999 && fract(sin(dot(floor(vPx) + uSeed, vec2(12.9898, 78.233))) * 43758.5453) > uOpacity * .85) discard; }`;
const FS_MAIN = `#version 300 es
precision highp float;
in vec3 vW; in vec2 vUV, vPx; in vec3 vT, vB, vN;
${EDGE_GLSL}
uniform sampler2D uBackTex, uShK, uShS;
uniform mat4 uLK, uLS;
uniform vec3 uCam, uL, uLs, uKeyCol, uSkyCol, uCore, uBack;
uniform vec4 uPaper, uEmit, uShP;      // paper: bump, tone, scale, -   shP: key soft, key half, sky soft, sky half
uniform vec4 uShR;                      // key range, key texel, sky range, sky texel
uniform float uThick, uTrans, uAO, uBackMode, uExposure, uShade;
uniform float uOpacity, uFrost, uNear, uFar; uniform sampler2D uBk, uBkD; uniform vec2 uScreen;     // see-through paper: what's behind, and how far
out vec4 o;
float linZ(float z) { z = z * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 lin(vec3 c) { return pow(c, vec3(2.2)); }
float shadow(sampler2D sm, mat4 LVP, vec3 wp, vec3 n, vec3 L, float soft, float half_, float range, float texel, int taps) {
  float cosT = clamp(dot(n, L), .05, 1.), slope = sqrt(1. - cosT * cosT) / cosT;
  vec4 q = LVP * vec4(wp + n * texel * .5, 1.);
  vec3 c = q.xyz * .5 + .5;
  if (c.x < 0. || c.y < 0. || c.x > 1. || c.y > 1.) return 1.;
  float dr = c.z * 2. * range, bias = texel * (.6 + min(slope, 4.) * .9);
  float rot = hash(vPx + uSeed) * 6.2832, uvpx = 1. / (2. * half_);
  float sr = max(soft * 140., texel * 3.) * uvpx, bs = 0., bn = 0.;
  for (int i = 0; i < 14; i++) {
    float r = sqrt((float(i) + .5) / 14.), a = float(i) * 2.39996 + rot;
    float db = texture(sm, c.xy + vec2(cos(a), sin(a)) * r * sr).r * 2. * range;
    if (db < dr - bias) { bs += db; bn += 1.; }
  }
  if (bn < .5) return 1.;
  float gap = dr - bs / bn, pr = max(gap * soft, texel * 1.1) * uvpx, lit = 0.;
  for (int i = 0; i < 32; i++) {
    if (i >= taps) break;
    float r = sqrt((float(i) + .5) / float(taps)), a = float(i) * 2.39996 + rot * 1.7;
    lit += texture(sm, c.xy + vec2(cos(a), sin(a)) * r * pr).r * 2. * range < dr - bias ? 0. : 1.;
  }
  return lit / float(taps);
}
void main() {
  vec2 g; float d = edgeD(vUV, vPx, g);
  float cov = clamp(d / max(fwidth(d), 1e-3) + .5, 0., 1.);
  if (cov <= .01) discard;
  vec3 Ng = normalize(vN), V = normalize(uCam - vW);
  bool front = dot(Ng, V) >= 0.;
  vec3 N = front ? Ng : -Ng, T = normalize(vT), B = normalize(vB);
  // grain
  vec2 fu = (vPx + uSeed) / (512. * uPaper.z);
  float h0 = texture(uFiber, fu).r, hx = texture(uFiber, fu + vec2(1. / 512., 0.)).r, hy = texture(uFiber, fu + vec2(0., 1. / 512.)).r;
  vec3 Nb = normalize(N - uPaper.x * 3. * ((hx - h0) * T + (hy - h0) * B));
  vec3 col = front ? lin(texture(uTex, vUV).rgb) : uBackMode > 1.5 ? lin(texture(uBackTex, vec2(vUV.x, 1. - vUV.y)).rgb) : uBackMode > .5 ? lin(texture(uBackTex, vec2(1. - vUV.x, vUV.y)).rgb) : uBack;
  float tone = texture(uFiber, fu * .37 + .21).g, fib = texture(uFiber, fu * .8 + .43).b;
  col *= 1. + uPaper.y * (tone - .5) * 2.;
  col = mix(col, col * .55 + .45, fib * uPaper.w);
  // the exposed core along torn edges
  if (uEdge.w > 0.) { float f = texture(uFiber, (vPx + uSeed) / 140.).b, w = uEdge.w * (.5 + .9 * texture(uFiber, (vPx + uSeed) / 70. + .3).a);
    col = mix(col, uCore, clamp((1. - smoothstep(0., w, d)) * (.75 + .5 * f), 0., 1.)); }
  // the paper's thickness: a lit edge facing the light, a dark one away from it
  vec2 lp = vec2(dot(uL, T), dot(uL, B));
  float band = 1. - smoothstep(0., uThick, d);
  float face = length(g) > 1e-4 ? dot(-normalize(g), lp) : 0.;
  // light
  float sk = shadow(uShK, uLK, vW, Ng * (front ? 1. : -1.), uL, uShP.x, uShP.y, uShR.x, uShR.y, 24);
  float ss = uAO > 0. ? shadow(uShS, uLS, vW, Ng * (front ? 1. : -1.), uLs, uShP.z, uShP.w, uShR.z, uShR.w, 16) : 1.;
  float ndl = dot(Nb, uL);
  vec3 lit = uKeyCol * max(ndl, 0.) * sk;
  vec3 through = uKeyCol * max(-dot(N, uL), 0.) * sk * uTrans * col * 1.6;
  vec3 amb = uSkyCol * (.62 + .38 * dot(Nb, uLs)) * mix(1., ss, uAO);
  vec3 c = col * (lit + amb) * uShade + through + lin(uEmit.rgb) * uEmit.a;
  c *= 1. + band * face * .55;
  if (uOpacity < .999) {
    // see-through paper: what's behind shows, blurred by how far behind it is; cloudier where the pulp is thick, denser and brighter at the cut
    float rim = 1. - smoothstep(0., 5., d);
    float a = clamp(uOpacity * (1. + uPaper.y * (tone - .5) * 6. + uPaper.w * (fib - .3) * 2.5), 0., 1.);
    a = a + rim * (1. - a) * .45; c *= 1. + rim * .3;
    vec2 sp = gl_FragCoord.xy / uScreen;
    float lod = uFrost * smoothstep(0., 90., linZ(texture(uBkD, sp).r) - linZ(gl_FragCoord.z));
    vec3 bh = textureLod(uBk, sp, lod).rgb;
    if (lod > .3) { float r = exp2(lod) * .9; for (int i = 0; i < 6; i++) { float an = float(i) * 1.0472 + hash(vPx) * 1.0472; bh += textureLod(uBk, sp + vec2(cos(an), sin(an)) * r / uScreen, lod).rgb; } bh /= 7.; }
    c = mix(pow(bh, vec3(2.2)) / uExposure, c, a);
  }
  o = vec4(pow(max(c * uExposure, 0.), vec3(1. / 2.2)), cov);
}`;
const VS_POST = `#version 300 es
in vec2 aP; out vec2 vUV; void main() { vUV = aP * .5 + .5; gl_Position = vec4(aP, 0., 1.); }`;
const FS_POST = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 o;
uniform sampler2D uC, uD; uniform vec2 uPx; uniform float uNear, uFar, uFocus, uAp, uMaxR, uVig; uniform vec3 uBg;
float lin(float z) { z = z * 2. - 1.; return 2. * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
float coc(float d) { return d > uFar * .999 ? uMaxR : clamp(uAp * abs(1. - uFocus / d), 0., uMaxR); }
void main() {
  vec3 c = texture(uC, vUV).rgb;
  if (uAp > 0.) {
    float dc = lin(texture(uD, vUV).r), cc = coc(dc);
    vec3 acc = c; float wsum = 1.;
    for (int i = 0; i < 56; i++) {
      float r = sqrt((float(i) + .5) / 56.) * uMaxR, a = float(i) * 2.39996;
      vec2 uv = vUV + vec2(cos(a), sin(a)) * r * uPx;
      float ds = lin(texture(uD, uv).r), cs = coc(ds);
      if (ds > dc) cs = min(cs, cc);
      float w = smoothstep(r - 1., r + .5, cs);
      acc += texture(uC, uv).rgb * w; wsum += w;
    }
    c = acc / wsum;
  }
  vec2 q = vUV - .5; c *= 1. - uVig * smoothstep(.25, .85, length(q * vec2(1., uPx.x / uPx.y * 1.)) * 1.3);
  o = vec4(c, 1.);
}`;

function compile(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.bindAttribLocation(p, 0, 'aP'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
  const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

/* ---------- nodes ---------- */
let NODE_ID = 0;
class Node {
  constructor(S, o = {}) {
    this.S = S; this.o = o; this.id = ++NODE_ID; this.children = []; this.parent = null;
    if (o.parent) o.parent.add(this); else S.roots.push(this);
  }
  add(c) { if (c.parent) c.parent.children.splice(c.parent.children.indexOf(c), 1); else { const i = this.S.roots.indexOf(c); if (i >= 0) this.S.roots.splice(i, 1); } c.parent = this; this.children.push(c); return c; }
  local(t) {
    const o = this.o, g = k => val(o[k], t) ?? 0;
    const s = val(o.s, t) ?? 1, sx = (val(o.sx, t) ?? 1) * s, sy = (val(o.sy, t) ?? 1) * s;
    let x = g('x'), y = g('y'), rz = g('rz');
    if (this.S._boil && !o.still) { const st = this.S._step, b = this.S._boil; x += (hash(this.id, st) - .5) * b; y += (hash(this.id + 977, st) - .5) * b; rz += (hash(this.id + 1931, st) - .5) * b * .25; }
    let m = M.T(x, y, g('z'));
    if (rz) m = M.mul(m, M.axis(0, 0, 1, rz * D2R));
    const ry = g('ry'); if (ry) m = M.mul(m, M.axis(0, 1, 0, ry * D2R));
    const rx = g('rx'); if (rx) m = M.mul(m, M.axis(1, 0, 0, -rx * D2R));
    if (sx !== 1 || sy !== 1) m = M.mul(m, M.S(sx, sy, 1));
    return m;
  }
  update(t, parentM, tr = t) {                // tr: the real time (show is judged on it, so cuts land on the frame even in stop motion)
    const o = this.o;
    this.visible = (o.show === undefined ? true : !!val(o.show, tr)) && (!this.parent || this.parent.visible);
    let m = M.mul(parentM, this.local(t));
    if (this.w !== undefined) m = M.mul(m, M.T(-this.ax * this.w, -this.ay * this.h, 0));
    if (o.matrix) m = M.mul(m, o.matrix(t));
    this.M = m;
    for (const c of this.children) c.update(t, m, tr);
  }
}

class Sheet extends Node {
  constructor(S, o) {
    super(S, o);
    const e = EDGES[o.edge || 'cut'] || EDGES.cut, p = PAPERS[o.paper || 'card'] || PAPERS.card;
    this.edge = { ...e, ...(o.edgeOpts || {}) }; this.paper = { ...p, ...(o.paperOpts || {}) };
    if (o.text !== undefined && o.w === undefined) {           // size from the text
      const g = document.createElement('canvas').getContext('2d'); g.font = o.font; const m = g.measureText(o.text);
      const pad = o.pad ?? Math.ceil(parseFloat(String(o.font).match(/(\d+(\.\d+)?)px/)?.[1] || 100) * .06);
      o.w = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight + pad * 2);
      o.h = Math.ceil(m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + pad * 2);
      this.textBox = { left: m.actualBoundingBoxLeft + pad, top: m.actualBoundingBoxAscent + pad };
    }
    this.w = o.w ?? 200; this.h = o.h ?? 200;
    [this.ax, this.ay] = o.anchor || [.5, .5];
    this.color = o.color || '#eee8dc';
    this.backColor = o.back && typeof o.back !== 'function' && !o.back.draw ? o.back : null;
    this.seed = [hash(this.id, 7) * 4000, hash(this.id, 9) * 4000];
    if (o.share) { this.tex = o.share; } else S._pending.push(() => this.build());
    this.mesh = o.mesh || null;
  }
  build() {
    const o = this.o, S = this.S, gl = S.gl, e = this.edge;
    const plain = !o.draw && o.text === undefined && !o.image;
    let res = o.res ?? (plain ? .35 : 1);
    res = Math.min(res, 4096 / (this.w + 40), 4096 / (this.h + 40));
    const pad = Math.ceil(e.blur * 2.5 + e.amp + 3), cw = Math.ceil((this.w + 2 * pad) * res), ch = Math.ceil((this.h + 2 * pad) * res);
    const mk = () => { const c = document.createElement('canvas'); c.width = cw; c.height = ch; return c; };
    const art = mk(), g = art.getContext('2d');
    g.setTransform(res, 0, 0, res, pad * res, pad * res);
    g.fillStyle = css(this.color); g.strokeStyle = css(this.color);
    if (o.draw) o.draw(g, this.w, this.h, this);
    else if (o.text !== undefined) {
      g.font = o.font; g.textBaseline = 'alphabetic';
      if (this.textBox) g.fillText(o.text, this.textBox.left, this.textBox.top);
      else { const m = g.measureText(o.text); g.fillText(o.text, (this.w - m.actualBoundingBoxRight + m.actualBoundingBoxLeft) / 2, (this.h + m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2); }
    }
    else g.fillRect(0, 0, this.w, this.h);
    if (o.image) { g.save(); g.globalCompositeOperation = 'source-atop'; cover(g, o.image, this.w, this.h, ...(o.focus || [.5, .5])); g.restore(); }
    if (o.print) { g.save(); g.globalCompositeOperation = 'source-atop'; o.print(g, this.w, this.h, this); g.restore(); }
    // soft alpha (the cut), and colour pushed outward so the edge never samples black
    const soft = mk(), sg = soft.getContext('2d'); sg.filter = `blur(${Math.max(.5, e.blur * res)}px)`; sg.drawImage(art, 0, 0);
    const fat = mk(), fg = fat.getContext('2d'); fg.drawImage(art, 0, 0);
    fg.globalCompositeOperation = 'destination-over'; for (const b of [3, 8, 20]) { fg.filter = `blur(${b}px)`; fg.drawImage(art, 0, 0); fg.drawImage(fat, 0, 0); }
    const A = sg.getImageData(0, 0, cw, ch).data, C = fg.getImageData(0, 0, cw, ch).data;
    for (let i = 3; i < C.length; i += 4) C[i] = A[i];
    this.tex = S._texture(new ImageData(C, cw, ch), true);
    this.texPx = [cw, ch]; this.res = res; this.pad = pad;
    if (o.back && (typeof o.back === 'function' || o.back.draw)) {      // printed on the back: draw it as seen from behind
      const bc = mk(), bg = bc.getContext('2d'); bg.setTransform(res, 0, 0, res, pad * res, pad * res);
      bg.fillStyle = css(o.back.color || this.color); bg.fillRect(-pad, -pad, this.w + 2 * pad, this.h + 2 * pad);
      (o.back.draw || o.back)(bg, this.w, this.h, this);
      this.backTex = S._texture(bc, false); bc.width = 0;           // read mirrored in the shader, so it reads right from behind
    }
    art.width = soft.width = fat.width = 0;
    this.core = rgb(o.core || (e.rim ? mixc(this.color, '#f6f1e7', .6) : this.color));
    this.geom = S._mesh(this.mesh || [[-pad, -pad], [this.w + pad, -pad], [this.w + pad, this.h + pad], [-pad, this.h + pad]]);
  }
}

/* ---------- stage ---------- */
function stage(o = {}) {
  const W = o.width || 1080, H = o.height || 1920;
  const cv = o.canvas || document.querySelector('canvas'); cv.width = W; cv.height = H;
  const gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false });
  if (!gl) throw new Error('WebGL2 is not available');
  const S = { W, H, gl, roots: [], sheets: [], _pending: [], _sounds: [], o, light: o.light || {}, camera: o.camera || {}, focus: o.focus || null };
  const prog = compile(gl, VS, FS_MAIN), sprog = compile(gl, VS, FS_SHADOW), post = compile(gl, VS_POST, FS_POST);
  const fiber = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, fiber);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, fiberTexture(512));
  gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  S._texture = (src, mip) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  S._mesh = pts => {            // convex polygon → triangle fan
    const v = []; for (let i = 1; i < pts.length - 1; i++) v.push(...pts[0], ...pts[i], ...pts[i + 1]);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    return { b, n: v.length / 2 };
  };
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  // shadow maps
  const smap = size => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F, size, size, 0, gl.DEPTH_COMPONENT, gl.FLOAT, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, t, 0);
    gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); return { t, f, size }; };
  const SK = smap(o.shadowSize || 3072), SS = smap(1024);
  // multisampled scene → resolved colour + depth
  const samples = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
  const msF = gl.createFramebuffer(), msC = gl.createRenderbuffer(), msD = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, msC); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, W, H);
  gl.bindRenderbuffer(gl.RENDERBUFFER, msD); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, W, H);
  gl.bindFramebuffer(gl.FRAMEBUFFER, msF); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msC); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msD);
  const tex2 = (ifmt, fmt, type, filter) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, W, H, 0, fmt, type, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, filter], [gl.TEXTURE_MAG_FILTER, filter], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return t; };
  const rC = tex2(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR), rD = tex2(gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST);
  const rF = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, rF); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rC, 0); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, rD, 0);
  // what's behind a see-through sheet: the frame so far, with mipmaps to blur it (made only when a scene has one)
  let bk = null; const behind = () => { if (!bk) { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, Math.floor(Math.log2(Math.max(W, H))) + 1, gl.RGBA8, W, H);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); bk = { t, f }; }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msF); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, bk.f); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, rF); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, bk.t); gl.generateMipmap(gl.TEXTURE_2D); gl.bindFramebuffer(gl.FRAMEBUFFER, msF); return bk.t; };

  S.sheet = opts => { const s = new Sheet(S, opts); S.sheets.push(s); return s; };
  S.group = (opts = {}) => new Node(S, opts);
  /* a timed move: returns u(t) 0→1 over [t0, t0 + dur] with an ease, and puts its sound on the track */
  S.at = (t0, dur, opts = {}) => {
    const ease = typeof opts.ease === 'function' ? opts.ease : EASE[opts.ease || 'io'];
    if (opts.sound) { const k = opts.sound, end = ['stand', 'tap', 'crease', 'land', 'thud', 'pop'].includes(k);
      S._sounds.push({ kind: k, t: +(t0 + (end ? dur * (opts.soundAt ?? (opts.ease === 'land' ? .4 : .92)) : 0)).toFixed(3), dur, v: opts.v ?? 1, ...(opts.pan !== undefined ? { pan: opts.pan } : {}) }); }
    return t => ease(seg(t, t0, t0 + dur));
  };
  S.sound = s => { S._sounds.push(s); return s; };
  S.sounds = () => S._sounds.slice().sort((a, b) => a.t - b.t);

  /* letters: one sheet per character, laid out like text. (x, y) is where the line's baseline is centred (align: left|center|right);
     each sheet is pinned at its own baseline, so rx tips a letter about its foot. each(i, ch) can add or override any option
     (functions of t included); the sheet's home position is s.home. Returns the sheets. */
  S.letters = (str, opts) => {
    const g = document.createElement('canvas').getContext('2d'); g.font = opts.font;
    const chars = [...str], sp = opts.spacing || 0, adv = chars.map(c => g.measureText(c).width), total = adv.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
    const vertical = opts.vertical, size = parseFloat(String(opts.font).match(/(\d+(\.\d+)?)px/)[1]);
    let cur = vertical ? -(chars.length * (size + sp) - sp) / 2 : -total * ({ left: 0, center: .5, right: 1 }[opts.align || 'center']);
    const bx = val(opts.x, 0) ?? 0, by = val(opts.y, 0) ?? 0, out = [];
    chars.forEach((ch, i) => {
      const cx = vertical ? 0 : cur + adv[i] / 2, cy = vertical ? cur + size * .88 : 0;
      cur += (vertical ? size : adv[i]) + sp;
      if (ch.trim() === '') return;
      const base = { ...opts }; for (const k of ['each', 'spacing', 'align', 'vertical']) delete base[k];
      const hx = bx + cx, hy = by + cy;
      const extra = opts.each ? opts.each(out.length, ch, [hx, hy]) || {} : {};
      const s = S.sheet({ ...base, text: ch, x: hx, y: hy, ...extra });
      if (!('anchor' in extra)) { s.ax = (s.textBox.left + adv[i] / 2) / s.w; s.ay = s.textBox.top / s.h; }
      s.char = ch; s.home = [hx, hy]; out.push(s);
    });
    return out;
  };

  /* fold: a sheet with fold lines. folds: [{ line: [[x1, y1], [x2, y2]], move: [x, y], angle: t => degrees, dir: 1 | -1 }, …]
     in the sheet's own pixels. Fold k's line and move point are where they are after folds 1…k−1 are folded flat.
     angle 180 = folded flat over; 0 = open. Fold in order 1→n, unfold in reverse. Returns { node, cells }. */
  S.fold = (opts, folds) => {
    const node = S.group({ ...opts, w: undefined, parent: opts.parent });
    const host = S.sheet({ ...opts, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, sx: 1, sy: 1, parent: node, show: false });
    const th = opts.thickness ?? .7;
    const refl = ([a, b]) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, m00 = (dx * dx - dy * dy) / L, m01 = 2 * dx * dy / L;
      return { a: m00, b: m01, c: m01, d: -m00, e: a[0] - m00 * a[0] - m01 * a[1], f: a[1] - m01 * a[0] + m00 * a[1] }; };
    const cmp = (P, Q) => ({ a: P.a * Q.a + P.b * Q.c, b: P.a * Q.b + P.b * Q.d, c: P.c * Q.a + P.d * Q.c, d: P.c * Q.b + P.d * Q.d, e: P.a * Q.e + P.b * Q.f + P.e, f: P.c * Q.e + P.d * Q.f + P.f });
    const ap = (G, p) => [G.a * p[0] + G.b * p[1] + G.e, G.c * p[0] + G.d * p[1] + G.f];
    const inv = G => { const det = G.a * G.d - G.b * G.c, a = G.d / det, b = -G.b / det, c = -G.c / det, d = G.a / det; return { a, b, c, d, e: -(a * G.e + b * G.f), f: -(c * G.e + d * G.f) }; };
    const side = (l, p) => Math.sign((l[1][0] - l[0][0]) * (p[1] - l[0][1]) - (l[1][1] - l[0][1]) * (p[0] - l[0][0]));
    const split = (poly, l) => {
      const A = [], B = [], s = p => (l[1][0] - l[0][0]) * (p[1] - l[0][1]) - (l[1][1] - l[0][1]) * (p[0] - l[0][0]);
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length], sp = s(p), sq = s(q);
        if (sp >= 0) A.push(p); if (sp <= 0) B.push(p);
        if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) { const u = sp / (sp - sq), x = [lerp(p[0], q[0], u), lerp(p[1], q[1], u)]; A.push(x); B.push(x); }
      }
      const area = P => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
      return [A, B].filter(P => P.length >= 3 && area(P) > .5);
    };
    const pad = 40, I = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    let cells = [{ poly: [[-pad, -pad], [host.w + pad, -pad], [host.w + pad, host.h + pad], [-pad, host.h + pad]], G: I, m: [] }];
    folds.forEach((f, k) => {
      const R = refl(f.line), mv = side(f.line, f.move), next = [];
      for (const c of cells) {
        const Gi = inv(c.G), lp = [ap(Gi, f.line[0]), ap(Gi, f.line[1])];
        for (const piece of split(c.poly, lp)) {
          const cen = piece.reduce((a, p) => [a[0] + p[0] / piece.length, a[1] + p[1] / piece.length], [0, 0]);
          const moving = side(f.line, ap(c.G, cen)) === mv;
          next.push({ poly: piece, G: moving ? cmp(R, c.G) : c.G, m: [...c.m, moving] });
        }
      }
      cells = next;
    });
    // each fold's hinge in 3D: about its line, raised so the moving layers land on top (or underneath for dir −1)
    const hinge = folds.map((f, k) => {
      const [a, b] = f.line, dir = f.dir || 1; let u = v3.norm([b[0] - a[0], b[1] - a[1], 0]);
      const q = [f.move[0] - a[0], f.move[1] - a[1], 0], cz = u[0] * q[1] - u[1] * q[0];
      if (cz * dir < 0) u = v3.scale(u, -1);
      return { a, u, h: (Math.pow(2, k) - .5) * th * dir, angle: f.angle };
    });
    const out = cells.map((c, i) => S.sheet({ ...opts, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1, sx: 1, sy: 1, anchor: [0, 0], parent: node, share: true, mesh: c.poly,
      show: opts.show, matrix: t => {
        let m = M.id();
        hinge.forEach((hg, k) => { if (!c.m[k]) return; const ang = val(hg.angle, t) * D2R; if (!ang) return;
          m = M.mul(M.about(hg.a[0], hg.a[1], hg.h, hg.u[0], hg.u[1], hg.u[2], ang), m); });
        return M.mul(M.T(-host.ax * host.w, -host.ay * host.h, 0), m);
      } }));
    S._pending.push(() => { for (const s of out) { Object.assign(s, { tex: host.tex, backTex: host.backTex, texPx: host.texPx, res: host.res, pad: host.pad, core: host.core, seed: host.seed, w: host.w, h: host.h, ax: 0, ay: 0 }); s.geom = S._mesh(s.mesh); } });
    out.forEach(s => { s.w = host.w; s.h = host.h; s.ax = 0; s.ay = 0; });
    return { node, cells: out, host };
  };

  /* a pop-up book. The spine runs down the middle at (x, y); open(t) 0 = shut, 1 = flat open.
     Returns { node, left, right, open, rise(t, from, to) }: put pieces on left / right (page pixels, 0..w, 0..h). */
  S.book = (b) => {
    const w = b.w || 600, h = b.h || 800, th = b.thick ?? 14, bd = b.board ?? 14, open = typeof b.open === 'function' ? b.open : () => b.open ?? 1;
    const node = S.group({ x: b.x, y: b.y, z: b.z || 0, rz: b.rz, rx: b.rx, ry: b.ry, parent: b.parent });
    const page = b.page || '#f4efe4', cover = b.cover || '#7b2d26', pp = b.paper || 'smooth';
    S.sheet({ parent: node, w: w + bd, h: h + 2 * bd, anchor: [0, .5], x: -2, y: 0, z: 0, color: cover, paper: 'card', edge: 'clean', back: cover, thick: 3 });
    const right = S.sheet({ parent: node, w, h, anchor: [0, .5], x: 0, y: 0, z: th, color: page, paper: pp, edge: 'clean', draw: b.rightPage, thick: 1 });
    const hinge = S.group({ parent: node, x: 0, y: 0, z: th, ry: t => 180 * (1 - open(t)) });
    S.sheet({ parent: hinge, w: w + bd, h: h + 2 * bd, anchor: [1, .5], x: 2, y: 0, z: -th, color: cover, paper: 'card', edge: 'clean', back: b.coverArt ? { color: cover, draw: b.coverArt } : cover, thick: 3 });
    const left = S.sheet({ parent: hinge, w, h, anchor: [1, .5], x: 0, y: 0, z: 0, color: page, paper: pp, edge: 'clean', draw: b.leftPage, thick: 1 });
    // the page block's edges
    const lines = (g, W2, H2) => { g.fillStyle = css(page); g.fillRect(0, 0, W2, H2); g.fillStyle = 'rgba(0,0,0,.08)'; for (let i = 2; i < (W2 > H2 ? H2 : W2); i += 2.2) W2 > H2 ? g.fillRect(0, i, W2, .7) : g.fillRect(i, 0, .7, H2); };
    S.sheet({ parent: right, w, h: th, anchor: [0, 0], x: 0, y: h, rx: 90, color: page, draw: lines, edge: 'clean', paper: 'smooth', thick: 0 });
    S.sheet({ parent: right, w: th, h, anchor: [0, 0], x: w, y: 0, ry: 90, color: page, draw: lines, edge: 'clean', paper: 'smooth', thick: 0 });
    S.sheet({ parent: left, w, h: th, anchor: [0, 0], x: 0, y: h, rx: 90, color: page, draw: lines, edge: 'clean', paper: 'smooth', thick: 0 });
    S.sheet({ parent: left, w: th, h, anchor: [1, 0], x: 0, y: 0, ry: -90, color: page, draw: lines, edge: 'clean', paper: 'smooth', thick: 0 });
    const rise = (t, a = .15, z = .9) => sm(seg(open(t), a, z));
    return { node, left, right, open, rise };
  };

  /* ---------- render one frame ---------- */
  let norm = null;
  S.render = (t, cam = {}, light = {}) => {
    const L0 = { from: 315, height: 42, soft: .1, ambient: .36, ao: .7, color: '#fffaf0', sky: '#f2f4ff', exposure: 1, ...S.light, ...light };
    const lv = (f, h) => { const a = f * D2R, e = h * D2R; return v3.norm([Math.sin(a) * Math.cos(e), -Math.cos(a) * Math.cos(e), Math.sin(e)]); };
    const L = lv(L0.from, L0.height), Ls = lv(L0.skyFrom ?? 0, L0.skyHeight ?? 72);
    if (!norm) { const h = Math.max(.1, Math.sin((S.light.height ?? 42) * D2R)); norm = (1 - L0.ambient * (.62 + .38 * Ls[2])) / h; }
    const keyI = L0.key ?? norm;
    // world
    const step = S.o.stopMotion ? Math.floor(t * (S.o.stopMotion.fps || 12)) : 0;
    S._step = step; S._boil = S.o.stopMotion ? (S.o.stopMotion.boil ?? .8) : 0;
    const tm = S.o.stopMotion ? step / (S.o.stopMotion.fps || 12) : t;
    for (const r of S.roots) r.update(tm, M.id(), t);
    // camera
    const C0 = { x: W / 2, y: H / 2, z: 0, pitch: 0, yaw: 0, roll: 0, fov: 30, zoom: 1, ...S.camera, ...cam };
    const fit = (H / 2) / Math.tan(C0.fov * D2R / 2), dist = (C0.dist ?? fit) / C0.zoom;
    const p = C0.pitch * D2R, y = C0.yaw * D2R, dir = [Math.sin(y) * Math.sin(p), Math.cos(y) * Math.sin(p), Math.cos(p)];
    const target = [C0.x, C0.y, C0.z], eye = v3.add(target, v3.scale(dir, dist)), F = v3.scale(dir, -1);
    const near = Math.max(1, dist * .05), far = dist * 8;
    const VP = viewProj(eye, basis(F, [0, -1, 0], C0.roll), { f: 1 / Math.tan(C0.fov * D2R / 2), aspect: W / H, near, far });
    // lights
    const box = S.o.shadowBox || Math.max(W, H) * .8, range = Math.max(W, H) * 1.6, ctr = [S.o.shadowCenter?.[0] ?? W / 2, S.o.shadowCenter?.[1] ?? H / 2, 0];
    const lightVP = (Ld) => viewProj(ctr, basis(v3.scale(Ld, -1), Math.abs(Ld[1]) > .95 ? [0, 0, 1] : [0, -1, 0]), null, { halfW: box, halfH: box, range });
    const LK = lightVP(L), LS = lightVP(Ls);
    const live = S.sheets.filter(s => s.visible && s.geom);
    const opacity = s => cl(val(s.o.opacity, t) ?? s.paper.opacity ?? 1);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    const sheetUniforms = (P, s) => {
      const u = P.u;
      gl.uniformMatrix4fv(u.uModel, false, s.M); gl.uniform2f(u.uSize, s.w, s.h); gl.uniform2f(u.uPad, s.pad, s.pad);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex); gl.uniform1i(u.uTex, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fiber); gl.uniform1i(u.uFiber, 1);
      gl.uniform2f(u.uTexPx, s.texPx[0], s.texPx[1]); gl.uniform1f(u.uRes, s.res); gl.uniform2f(u.uSeed, s.seed[0], s.seed[1]);
      gl.uniform4f(u.uEdge, s.edge.amp, s.edge.noise, s.edge.kind, s.edge.rim);
      gl.bindBuffer(gl.ARRAY_BUFFER, s.geom.b); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    };
    for (const [SM, LVP] of [[SK, LK], [SS, LS]]) {
      if (SM === SS && !(L0.ao > 0)) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, SM.f); gl.viewport(0, 0, SM.size, SM.size); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(sprog.p); gl.uniformMatrix4fv(sprog.u.uVP, false, LVP);
      for (const s of live) if (s.o.cast !== false) { sheetUniforms(sprog, s); gl.uniform1f(sprog.u.uOpacity, opacity(s)); gl.drawArrays(gl.TRIANGLES, 0, s.geom.n); }
    }
    // scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, msF); gl.viewport(0, 0, W, H);
    const bg = rgb(S.o.background || '#20201e'); gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.SAMPLE_ALPHA_TO_COVERAGE); gl.enable(gl.POLYGON_OFFSET_FILL);
    const P = prog, u = P.u; gl.useProgram(P.p);
    gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uLK, false, LK); gl.uniformMatrix4fv(u.uLS, false, LS);
    gl.uniform3fv(u.uCam, eye); gl.uniform3fv(u.uL, L); gl.uniform3fv(u.uLs, Ls);
    const kc = rgb(L0.color).map(v => Math.pow(v, 2.2) * keyI), sc = rgb(L0.sky).map(v => Math.pow(v, 2.2) * L0.ambient);
    gl.uniform3fv(u.uKeyCol, kc); gl.uniform3fv(u.uSkyCol, sc);
    gl.uniform4f(u.uShP, L0.soft, box, L0.skySoft ?? .55, box); gl.uniform4f(u.uShR, range, 2 * box / SK.size, range, 2 * box / SS.size);
    gl.uniform1f(u.uAO, L0.ao); gl.uniform1f(u.uExposure, L0.exposure);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, SK.t); gl.uniform1i(u.uShK, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, SS.t); gl.uniform1i(u.uShS, 3);
    gl.uniform2f(u.uScreen, W, H); gl.uniform1f(u.uNear, near); gl.uniform1f(u.uFar, far);
    const sheer = live.filter(s => opacity(s) < .999).map(s => [s, v3.dot(v3.sub(M.apply(s.M, [s.w / 2, s.h / 2, 0]), eye), F)]).sort((a, b) => b[1] - a[1]).map(a => a[0]);
    const drawSheet = (s, i) => {
      sheetUniforms(P, s);
      const pa = s.paper, so = s.o;
      gl.uniform4f(u.uPaper, pa.bump, pa.tone, pa.scale, pa.fiber);
      gl.uniform3fv(u.uCore, s.core.map(v => Math.pow(v, 2.2)));
      gl.uniform3fv(u.uBack, rgb(val(so.backColor, t) || s.backColor || mixc(s.color, '#ffffff', .25)).map(v => Math.pow(v, 2.2)));
      gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, s.backTex || s.tex); gl.uniform1i(u.uBackTex, 4); gl.uniform1f(u.uBackMode, s.backTex ? (so.flip === 'x' ? 2 : 1) : 0);
      const em = so.emit ? (typeof so.emit === 'string' || Array.isArray(so.emit) ? [...rgb(so.emit), 1] : [...rgb(so.emit.color), val(so.emit.strength ?? 1, t)]) : [0, 0, 0, 0];
      gl.uniform4f(u.uEmit, em[0], em[1], em[2], em[3]);
      gl.uniform1f(u.uThick, so.thick ?? 1.6); gl.uniform1f(u.uTrans, val(so.translucent, t) ?? 0); gl.uniform1f(u.uShade, val(so.shade, t) ?? 1);
      gl.uniform1f(u.uOpacity, opacity(s)); gl.uniform1f(u.uFrost, val(so.frost, t) ?? s.paper.frost ?? 2);
      gl.polygonOffset(0, -i * 2);
      gl.drawArrays(gl.TRIANGLES, 0, s.geom.n);
    };
    live.forEach((s, i) => { if (!sheer.includes(s)) drawSheet(s, i); });
    sheer.forEach((s, k) => { const b = behind(); gl.useProgram(P.p);
      gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, b); gl.uniform1i(u.uBk, 5);
      gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, rD); gl.uniform1i(u.uBkD, 6);
      drawSheet(s, live.length + k);
      gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, null); });
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE); gl.disable(gl.POLYGON_OFFSET_FILL);
    // resolve
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msF); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, rF);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    // post: depth of field, vignette
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(post.p); const q = post.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, rC); gl.uniform1i(q.uC, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, rD); gl.uniform1i(q.uD, 1);
    gl.uniform2f(q.uPx, 1 / W, 1 / H); gl.uniform1f(q.uNear, near); gl.uniform1f(q.uFar, far);
    const fo = cam.focus ?? S.focus;           // { at: [x, y, z] (a point to keep sharp) | dist, blur: px at twice the distance }
    if (fo && fo.blur) {
      const fd = fo.at ? v3.dot(v3.sub(fo.at, eye), F) : fo.dist ?? dist;
      gl.uniform1f(q.uFocus, fd); gl.uniform1f(q.uAp, fo.blur); gl.uniform1f(q.uMaxR, fo.max ?? Math.min(18, fo.blur * 1.6));
    } else { gl.uniform1f(q.uAp, 0); gl.uniform1f(q.uFocus, 1); gl.uniform1f(q.uMaxR, 1); }
    gl.uniform1f(q.uVig, cam.vignette ?? S.o.vignette ?? .18);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  S.ready = async () => { for (const f of S._pending) await f(); S._pending = []; };
  return S;
}

/* ---------- scene: window.__scene = Paper.scene(async () => ({ stage, duration, camera?, light?, sounds?, music? })) ---------- */
function scene(build) {
  const sc = { duration: 0, sounds: [], music: null };
  sc.ready = (async () => {
    const r = await build(); const S = r.stage; await S.ready();
    Object.assign(sc, { duration: r.duration, sounds: r.sounds || S.sounds(), music: r.music || null });
    sc.draw = t => { if (r.update) r.update(t); S.render(t, r.camera ? r.camera(t) : {}, r.light ? r.light(t) : {}); };
    sc.seek = t => { sc.draw(t); return Promise.resolve(); };
    return true;
  })();
  if (!/rec=1/.test(location.search)) sc.ready.then(() => { const t0 = performance.now(); const loop = () => { sc.draw(((performance.now() - t0) / 1000) % sc.duration); requestAnimationFrame(loop); }; loop(); }).catch(e => { document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66">${e.stack || e}</pre>`); });
  return sc;
}

window.Paper = { stage, scene, keys, image, cover, circle, rect, rounded, poly, path, cut, radial, mirror, handcut, blob,
  rgb, mix: mixc, css, cl, lerp, seg, sm, io, oc, ic, back, land, EASE, rng, hash, PAPERS, EDGES, M };
})();
