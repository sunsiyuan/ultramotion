/* Mesh Gradient — soft fields of colour that flow, change palette, melt out of a picture, gather into a shape and loop
   without a seam. WebGL2 for the field, Canvas 2D for everything on top. No dependencies. Every frame is a pure function of t.

   const S = Mesh.create({ width: 1080, height: 1920 });
   window.__scene = Mesh.scene(S, (ctx, t) => { Mesh.field(ctx, t, { points, loop }); … type … ; Mesh.finish(ctx, t, { grain }) }, { duration, loop, music });
*/
(function () {
const TAU = Math.PI * 2;
const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
const seg = (t, a, z) => cl((t - a) / (z - a));
const lerp = (a, z, u) => a + (z - a) * u;
const ease = {
  linear: u => cl(u),
  sine: u => .5 - .5 * Math.cos(Math.PI * cl(u)),
  io: u => (u = cl(u)) < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2,
  out: u => 1 - Math.pow(1 - cl(u), 3),
  expo: u => (u = cl(u)) >= 1 ? 1 : 1 - Math.pow(2, -10 * u),
  linger: u => (1 - Math.exp(-4.5 * cl(u))) / (1 - Math.exp(-4.5)),
};
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const rand = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
const SERIF = '"New York", "Baskerville", "Songti SC", "Noto Serif CJK SC", serif';
const SANS = '"Avenir Next", "Helvetica Neue", "PingFang SC", "Noto Sans CJK SC", sans-serif';
const SONG = '"Songti SC", "STSong", "Noto Serif CJK SC", serif';
const HEI = '"PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif';
const KAI = '"Kaiti SC", "STKaiti", "KaiTi", serif';

function create(o = {}) {
  const W = o.width || 1080, H = o.height || 1920;
  const cv = o.canvas || document.querySelector('canvas'); cv.width = W; cv.height = H;
  return { W, H, canvas: cv, ctx: cv.getContext('2d') };
}

/* ---------- time ---------- */
function env(t, t0, t1, fin = 1, fout = fin, e = ease.sine) {
  if (t <= t0 || t >= t1) return 0;
  return e(Math.min(fin > 0 ? (t - t0) / fin : 1, fout > 0 ? (t1 - t) / fout : 1, 1));
}
/* a value through keys [[t, v], …]; v a number, an array, a colour '#rrggbb', a list of colours, or an object of these. Colours mix in OKLab. */
function key(t, keys, e = ease.sine) {
  const mixv = (a, b, u) => typeof a === 'number' ? lerp(a, b, u) : typeof a === 'string' ? mix(a, b, u)
    : Array.isArray(a) ? a.map((x, k) => mixv(x, b[k] ?? x, u)) : Object.fromEntries(Object.keys(a).map(k => [k, mixv(a[k], b[k] ?? a[k], u)]));
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [a, va] = keys[i - 1], [b, vb] = keys[i]; return mixv(va, vb, e((t - a) / (b - a))); }
  return keys[keys.length - 1][1];
}
/* phase of a loop: 0..1 over `loop` seconds */
const phase = (t, loop) => ((t / loop) % 1 + 1) % 1;
/* a breathing cycle → 0 (out) .. 1 (in). times in seconds; periodic */
function breath(t, { inhale = 4, hold = 0, exhale = 4, rest = 0, start = 0 } = {}) {
  const T = inhale + hold + exhale + rest, u = ((t - start) % T + T) % T;
  if (u < inhale) return ease.sine(u / inhale);
  if (u < inhale + hold) return 1;
  if (u < inhale + hold + exhale) return 1 - ease.sine((u - inhale - hold) / exhale);
  return 0;
}
/* a point that wanders smoothly and comes back to where it was every `loop` seconds.
   o: { loop, x, y (centre, 0..1), amount (how far, 0..1 of the frame), seed, speed (1 = once round per loop; whole numbers only) } */
function wander(t, { loop = 12, x = .5, y = .5, amount = .15, seed = 1, speed = 1 } = {}) {
  const r = rand(seed * 7919 + 13), ph = TAU * t / loop; let dx = 0, dy = 0;
  for (let k = 1; k <= 3; k++) { const a = amount / k, f = k * speed; dx += a * Math.sin(f * ph + r() * TAU) * (r() * .6 + .4); dy += a * Math.cos(f * ph * (k === 2 ? -1 : 1) + r() * TAU) * (r() * .6 + .4); }
  return { x: x + dx, y: y + dy };
}

/* ---------- colour (OKLab) ---------- */
const toLin = c => (c /= 255) <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
const toSrgb = c => Math.round(255 * cl(c <= .0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - .055));
const hexRgb = h => { h = h.replace('#', ''); if (h.length === 3) h = h.replace(/./g, '$&$&'); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const rgbHex = rgb => '#' + rgb.map(v => cl(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
function linLab([r, g, b]) {
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .7936177850 * m - .0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s, .0259040371 * l + .7827717662 * m - .8086757660 * s];
}
function labLin([L, A, B]) {
  const l = (L + .3963377774 * A + .2158037573 * B) ** 3, m = (L - .1055613458 * A - .0638541728 * B) ** 3, s = (L - .0894841775 * A - 1.2914855480 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.7076147010 * s];
}
const lab = hex => linLab(hexRgb(hex).map(toLin));
const fromLab = L => rgbHex(labLin(L).map(toSrgb));
/* mix two colours in OKLab (no grey mud between complementary colours) */
const mix = (a, b, u) => { const p = lab(a), q = lab(b); return fromLab(p.map((v, i) => lerp(v, q[i], u))); };
/* a colour from lightness 0..1, chroma 0..0.37, hue in degrees */
const oklch = (L, C, h) => fromLab([L, C * Math.cos(h / 360 * TAU), C * Math.sin(h / 360 * TAU)]);
/* lightness, chroma, hue of a colour */
const lch = hex => { const [L, A, B] = lab(hex); return { L, C: Math.hypot(A, B), h: (Math.atan2(B, A) / TAU * 360 + 360) % 360 }; };
/* change a colour: { L, C, h } absolute, or dL, dC, dh relative */
const tone = (hex, o = {}) => { const c = lch(hex); return oklch(o.L ?? c.L + (o.dL || 0), Math.max(0, o.C ?? c.C * (o.kC ?? 1) + (o.dC || 0)), o.h ?? c.h + (o.dh || 0)); };
const rgba = (hex, a = 1) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };

/* the main colours of a picture (image, canvas or video frame): [{ c: '#hex', share, L, C, h }, …], biggest first.
   o: { k (how many), minChroma (drop greys below this, 0 keeps them) } */
function palette(img, { k = 5, minChroma = 0, seed = 3 } = {}) {
  const w = 64, h = Math.max(1, Math.round(64 * (img.height || img.videoHeight || 64) / (img.width || img.videoWidth || 64)));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, px = [];
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { const L = linLab([toLin(d[i]), toLin(d[i + 1]), toLin(d[i + 2])]); if (Math.hypot(L[1], L[2]) >= minChroma) px.push(L); }
  if (!px.length) return [];
  const r = rand(seed); let cen = Array.from({ length: k }, () => px[Math.floor(r() * px.length)].slice()); let lab_ = new Array(px.length).fill(0);
  for (let it = 0; it < 14; it++) {
    px.forEach((p, i) => { let b = 0, bd = 1e9; cen.forEach((q, j) => { const dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (dd < bd) { bd = dd; b = j; } }); lab_[i] = b; });
    cen = cen.map((q, j) => { const s = [0, 0, 0]; let n = 0; px.forEach((p, i) => { if (lab_[i] === j) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; n++; } }); return n ? s.map(v => v / n) : q; });
  }
  const cnt = cen.map((_, j) => lab_.filter(x => x === j).length);
  return cen.map((q, j) => ({ c: fromLab(q), share: cnt[j] / px.length, L: q[0], C: Math.hypot(q[1], q[2]), h: (Math.atan2(q[2], q[1]) / TAU * 360 + 360) % 360 }))
    .filter(p => p.share > 0).sort((a, b) => b.share - a.share);
}

/* ---------- WebGL ---------- */
let G = null;
function gl() {
  if (G) return G;
  const c = document.createElement('canvas'), g = c.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false });
  if (!g) throw new Error('WebGL2 is not available');
  G = { c, g, progs: new Map(), tex: g.createTexture() };
  return G;
}
const VS = '#version 300 es\nvoid main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0,1);}';
function prog(fs) {
  const { g, progs } = gl(); if (progs.has(fs)) return progs.get(fs);
  const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)); return s; };
  const p = g.createProgram(); g.attachShader(p, sh(g.VERTEX_SHADER, VS)); g.attachShader(p, sh(g.FRAGMENT_SHADER, fs)); g.linkProgram(p);
  const U = {}; const n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = g.getActiveUniform(p, i); U[u.name.replace(/\[0\]$/, '')] = { loc: g.getUniformLocation(p, u.name), type: u.type, size: u.size }; }
  const P = { p, U }; progs.set(fs, P); return P;
}
function run(fs, w, h, uni, src) {
  const { c, g, tex } = gl(); w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const P = prog(fs); g.viewport(0, 0, w, h); g.useProgram(P.p);
  if (src) { g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tex); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src);
    g.generateMipmap(g.TEXTURE_2D); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.MIRRORED_REPEAT); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.MIRRORED_REPEAT); }
  for (const k in uni) { const u = P.U[k]; if (!u) continue; const v = uni[k];
    if (u.type === g.FLOAT) u.size > 1 ? g.uniform1fv(u.loc, v) : g.uniform1f(u.loc, v);
    else if (u.type === g.FLOAT_VEC2) g.uniform2fv(u.loc, v); else if (u.type === g.FLOAT_VEC3) g.uniform3fv(u.loc, v); else if (u.type === g.FLOAT_VEC4) g.uniform4fv(u.loc, v);
    else if (u.type === g.INT || u.type === g.SAMPLER_2D) g.uniform1i(u.loc, v); }
  g.drawArrays(g.TRIANGLES, 0, 3); return c;
}

/* shared GLSL: the flow (periodic in ph), OKLab → sRGB, dither */
const COMMON = `
uniform float ph, warp, wscale, seed, frame, twist;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float uh(vec2 p, float f, float k){ uvec3 v = uvec3(uint(p.x), uint(p.y), uint(f) * 3u + uint(k)); v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return float(v.x) / 4294967295.; }
vec2 flow(vec2 p){
  vec2 q = p * wscale + seed;
  for (int i = 0; i < 4; i++) {
    float f = float(i) + 1., k = (i == 1 || i == 3) ? -float(i / 2 + 1) : float(i / 2 + 1);
    q += warp * .55 / f * vec2(sin(q.y * (1.1 + .23 * f) + ph * k + seed * 1.7 * f), cos(q.x * (1.3 - .17 * f) - ph * k * (i == 2 ? -1. : 1.) + seed * 2.3 * f));
  }
  q = q / wscale - seed / wscale;
  float a = twist * sin(ph);
  return mat2(cos(a), sin(a), -sin(a), cos(a)) * q;
}
vec3 lab2srgb(vec3 c){
  float l = c.x + .3963377774 * c.y + .2158037573 * c.z, m = c.x - .1055613458 * c.y - .0638541728 * c.z, s = c.x - .0894841775 * c.y - 1.2914855480 * c.z;
  l = l * l * l; m = m * m * m; s = s * s * s;
  vec3 r = vec3(4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.7076147010 * s);
  r = clamp(r, 0., 1.);
  return mix(12.92 * r, 1.055 * pow(r, vec3(1. / 2.4)) - .055, step(.0031308, r));
}
vec3 dither(vec3 c){ vec2 g = floor(gl_FragCoord.xy); return c + (uh(g, frame, 0.) + uh(g, frame, 1.) - 1.) / 255.; }
`;

const FIELD_FS = `#version 300 es
precision highp float;
uniform vec2 res; uniform float n, focus, baseW, blobTh, blobSoft, blobWarp, sheen, sheenAng, sheenFreq;
uniform vec3 labs[12]; uniform vec4 pts[12]; uniform vec3 base; uniform float hasBase;
out vec4 o;
${COMMON}
void main(){
  vec2 fc = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y), asp = res / min(res.x, res.y);
  vec2 p = fc / min(res.x, res.y);
  vec2 q = flow(p);
  float lw[13]; float mx = -1e9, dens = 0.; vec2 qd = mix(p, q, blobWarp);
  for (int i = 0; i < 12; i++) { if (float(i) >= n) break;
    vec2 c = pts[i].xy * asp; float d = length(q - c) / pts[i].z, dd = length(qd - c) / pts[i].z;
    lw[i] = log(max(pts[i].w, 1e-4)) - focus * d * d; mx = max(mx, lw[i]); dens += pts[i].w * exp(-dd * dd); }
  float lb = log(max(baseW, 1e-4)) - focus * 1.2; if (hasBase > .5) mx = max(mx, lb);
  vec3 acc = vec3(0.); float tot = 0.;
  for (int i = 0; i < 12; i++) { if (float(i) >= n) break; float w = exp(lw[i] - mx); acc += labs[i] * w; tot += w; }
  if (hasBase > .5) { float w = exp(lb - mx); acc += base * w; tot += w; }
  vec3 L = acc / tot;
  if (sheen > 0.) {                                                              // folds like silk: bands that follow the flow
    vec2 dir = vec2(cos(sheenAng), sin(sheenAng));
    float h = dot(q, dir) * sheenFreq + .6 * sin(ph + dot(p, dir.yx) * 2.);
    float s = sin(h), hl = pow(max(s, 0.), 6.), sh = pow(max(-s, 0.), 2.);
    L.x += sheen * (hl * .16 - sh * .12); L.yz *= 1. - sheen * hl * .35;
  }
  float a = blobTh > 0. ? smoothstep(blobTh - blobSoft, blobTh + blobSoft, dens) : 1.;
  o = vec4(dither(lab2srgb(L)), a);
}`;

/* draw a mesh gradient into ctx.
   o: points  [{ c: '#hex', x, y (0..1 of the area), r (radius, share of the area's short side, default .45), w (weight, default 1) }, …]  up to 12
      base    a colour that fills where no point reaches;   baseW its weight (default .4)
      loop    seconds; the flow comes back to the same place every loop (default 12)
      warp    how far the colours are folded and swirled (0 = straight blends, .5 soft, 1 liquid, 1.6 marbled; default .7)
      scale   size of the folds (smaller = bigger folds; default 1.4)
      focus   1 soft · 2 clear regions · 4 almost-shapes (default 1.4)
      twist   the whole field turns back and forth by this many radians over the loop (default 0)
      seed    another arrangement of the folds
      blob    { th, soft, warp } — only where the points gather is painted (a shape that breathes and merges); th .3–.9, soft .02 crisp – .3 misty;
              warp 0..1: how much the flow bends the shape's edge (default .3; the colours inside still flow fully)
      sheen   0..1 — light and shade in folds that follow the flow, like silk;  sheenAng their direction (radians);  sheenFreq how many folds (default 9)
      rect    [x, y, w, h] in pixels (default the whole canvas);  a  opacity;  blend  a canvas composite op */
function field(ctx, t, o = {}) {
  const [x, y, w, h] = o.rect || [0, 0, ctx.canvas.width, ctx.canvas.height];
  const pts = (o.points || []).slice(0, 12), loop = o.loop || 12;
  const labs = new Float32Array(36), P = new Float32Array(48);
  pts.forEach((p, i) => { labs.set(lab(p.c), i * 3); P.set([p.x, p.y, p.r ?? .45, p.w ?? 1], i * 4); });
  const c = run(FIELD_FS, w, h, { res: [Math.round(w), Math.round(h)], n: pts.length, labs, pts: P, base: o.base ? lab(o.base) : [0, 0, 0], hasBase: o.base ? 1 : 0, baseW: o.baseW ?? .4,
    focus: o.focus ?? 1.4, ph: TAU * t / loop, warp: o.warp ?? .7, wscale: o.scale ?? 1.4, seed: o.seed ?? 0, twist: o.twist ?? 0, frame: Math.floor(t * 30) % 997,
    blobTh: o.blob ? o.blob.th ?? .5 : 0, blobSoft: o.blob ? o.blob.soft ?? .08 : 0, blobWarp: o.blob ? o.blob.warp ?? .3 : 1, sheen: o.sheen || 0, sheenAng: o.sheenAng ?? .6, sheenFreq: o.sheenFreq ?? 9 });
  ctx.save(); ctx.globalAlpha *= o.a ?? 1; if (o.blend) ctx.globalCompositeOperation = o.blend; ctx.drawImage(c, x, y, w, h); ctx.restore();
}

const MELT_FS = `#version 300 es
precision highp float;
uniform sampler2D s; uniform vec2 res; uniform float amt, zoom, lod, texW, bright, sat, srcAsp;
out vec4 o;
${COMMON}
void main(){
  vec2 fc = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y), asp = res / min(res.x, res.y);
  vec2 p = fc / min(res.x, res.y);
  vec2 c = asp * .5;
  vec2 q = mix(p, flow(p), amt);
  q = c + (q - c) / mix(1., zoom, amt);
  vec2 uv = q / asp;
  float ra = res.x / res.y;                                                     // cover the area like object-fit: cover
  uv = ra > srcAsp ? vec2(uv.x, .5 + (uv.y - .5) * srcAsp / ra) : vec2(.5 + (uv.x - .5) * ra / srcAsp, uv.y);
  float L = lod * amt, R = exp2(L) / texW * 1.6, j = h21(gl_FragCoord.xy) * 6.2832;
  vec3 acc = vec3(0.);
  for (int i = 0; i < 16; i++) { float a = float(i) * 2.39996 + j, r = sqrt((float(i) + .5) / 16.) * R;
    vec2 u = uv + vec2(cos(a), sin(a)) * r; acc += textureLod(s, vec2(u.x, 1. - u.y), L).rgb; }
  vec3 col = acc / 16.;
  float g = dot(col, vec3(.299, .587, .114)); col = mix(vec3(g), col, mix(1., sat, amt)) * mix(1., bright, amt);
  o = vec4(dither(clamp(col, 0., 1.)), 1.);
}`;

/* a picture (image / canvas / video) melting into a flowing field of its own colours, or condensing back.
   amount 0 = the picture as it is, 1 = only its colours, flowing.
   o: { loop, warp (default 1), scale, seed, twist, zoom (how far it pushes in as it melts, default 1.6), blur (0..1, default 1), sat (saturation at amount 1, default 1.15), bright (default 1), rect, a, blend } */
function melt(ctx, t, src, amount, o = {}) {
  const [x, y, w, h] = o.rect || [0, 0, ctx.canvas.width, ctx.canvas.height];
  const b = o.blur ?? 1, loop = o.loop || 12;
  const sw = src.width || src.videoWidth || 1, sh = src.height || src.videoHeight || 1;
  const c = run(MELT_FS, w, h, { res: [Math.round(w), Math.round(h)], amt: cl(amount), zoom: o.zoom ?? 1.25, lod: (Math.log2(Math.max(sw, sh)) - 3.5) * b, texW: Math.max(sw, sh), srcAsp: sw / sh, sat: o.sat ?? 1.15, bright: o.bright ?? 1,
    ph: TAU * t / loop, warp: o.warp ?? 1, wscale: o.scale ?? 1.4, seed: o.seed ?? 0, twist: o.twist ?? 0, frame: Math.floor(t * 30) % 997 }, src);
  ctx.save(); ctx.globalAlpha *= o.a ?? 1; if (o.blend) ctx.globalCompositeOperation = o.blend; ctx.drawImage(c, x, y, w, h); ctx.restore();
}

const FINISH_FS = `#version 300 es
precision highp float;
uniform sampler2D s; uniform vec2 res; uniform float grain, gsize, vig, frame;
out vec4 o;
float uh(vec2 p, float f, float k){ uvec3 v = uvec3(uint(p.x), uint(p.y), uint(f) * 3u + uint(k)); v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return float(v.x) / 4294967295.; }
void main(){
  vec2 uv = gl_FragCoord.xy / res; vec3 c = texture(s, uv).rgb;
  vec2 g = floor(gl_FragCoord.xy / gsize), q = floor(gl_FragCoord.xy);
  float n = (uh(g, frame, 0.) + uh(g, frame, 1.) + uh(g, frame, 2.)) / 3. - .5;
  float l = dot(c, vec3(.299, .587, .114));
  c += n * grain * (1.2 - .6 * l);
  vec2 d = uv - .5; c *= 1. - vig * dot(d, d) * 1.6;
  c += (uh(q, frame + 500., 0.) + uh(q, frame + 500., 1.) - 1.) / 255.;
  o = vec4(c, 1.);
}`;
/* last thing in a frame: grain (0.02 barely – 0.06 filmic), its size in px, a vignette (0..1), and a dither so smooth colour does not band in the mp4 */
function finish(ctx, t, { grain = .03, size = 1.4, vignette = 0, fps = 30 } = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const c = run(FINISH_FS, W, H, { res: [W, H], grain, gsize: size, vig: vignette, frame: Math.floor(t * fps) % 997 }, ctx.canvas);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'copy'; ctx.drawImage(c, 0, 0); ctx.restore();
}

/* ---------- layers ---------- */
const LAYERS = new Map();
/* an offscreen canvas the size of ctx's (or w × h), cleared, reused by name */
function layer(name, w, h) {
  let c = LAYERS.get(name); if (!c) { c = document.createElement('canvas'); LAYERS.set(name, c); }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.clearRect(0, 0, w, h); return g;
}
/* paint `fill` only inside `shape`: within(ctx, g => g.fillText('慢', x, y), g => Mesh.field(g, t, {...}), { a })
   shape draws in any opaque colour; its alpha is the mask (text, paths, images, blurred shapes all work) */
function within(ctx, shape, fill, { a = 1, blend } = {}) {
  const W = ctx.canvas.width, H = ctx.canvas.height, f = layer('__fill', W, H), m = layer('__mask', W, H);
  fill(f); shape(m); f.globalCompositeOperation = 'destination-in'; f.drawImage(m.canvas, 0, 0); f.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha *= a; if (blend) ctx.globalCompositeOperation = blend; ctx.drawImage(f.canvas, 0, 0); ctx.restore();
}
/* text with letter-spacing that stays centred where you asked. o: { font, size, weight, tracking (em), align, color, a, blur, shadow: { color, blur } } */
function text(ctx, s, x, y, o = {}) {
  ctx.save(); const size = o.size || 48;
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size}px ${o.font || SANS}`; ctx.letterSpacing = `${(o.tracking || 0) * size}px`;
  ctx.textBaseline = o.baseline || 'alphabetic'; ctx.textAlign = 'left';
  const w = ctx.measureText(s).width - (o.tracking || 0) * size, al = o.align || 'center';
  const x0 = al === 'center' ? x - w / 2 : al === 'right' ? x - w : x;
  ctx.globalAlpha *= o.a ?? 1; if (o.blur) ctx.filter = `blur(${o.blur}px)`;
  if (o.shadow) { ctx.shadowColor = o.shadow.color || 'rgba(0,0,0,.25)'; ctx.shadowBlur = o.shadow.blur ?? 30; ctx.shadowOffsetY = o.shadow.y || 0; }
  ctx.fillStyle = o.color || '#fff'; ctx.fillText(s, x0, y); ctx.restore(); return w;
}
const measure = (ctx, s, o = {}) => { ctx.save(); const size = o.size || 48; ctx.font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${size}px ${o.font || SANS}`; ctx.letterSpacing = `${(o.tracking || 0) * size}px`; const w = ctx.measureText(s).width - (o.tracking || 0) * size; ctx.restore(); return w; };

/* ---------- pictures ---------- */
const MEDIA = [];
/* an image file, loaded before the first frame */
function image(src) { const im = new Image(); im.crossOrigin = 'anonymous'; const m = { el: im, ready: new Promise((res, rej) => { im.onload = res; im.onerror = () => rej(new Error('cannot load ' + src)); }) }; im.src = src; MEDIA.push(m); return im; }
/* draw a picture to cover a rect, pushing in by z towards (fx, fy) */
function cover(ctx, im, { rect, z = 1, fx = .5, fy = .5, a = 1 } = {}) {
  const [x, y, w, h] = rect || [0, 0, ctx.canvas.width, ctx.canvas.height], iw = im.width || im.videoWidth, ih = im.height || im.videoHeight;
  const k = Math.max(w / iw, h / ih) * z, dw = iw * k, dh = ih * k;
  ctx.save(); ctx.globalAlpha *= a; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.drawImage(im, x + (w - dw) * fx, y + (h - dh) * fy, dw, dh); ctx.restore();
}

/* ---------- music ---------- */
const chord = (t, ms, { inst = 'piano', d = 4, v = .45, roll = .04 } = {}) => ms.map((m, i) => ({ t: t + i * roll, m, d, inst, v }));

/* ---------- the scene ---------- */
/* loop: true when the piece is meant to play on repeat — the last frame flows into the first, and render.py folds the sound's tail back into its start */
function scene(S, draw, { duration, loop = false, music = null, sounds = [], background = '#000', timeline = [] } = {}) {
  const Q = new URLSearchParams(location.search), rec = !!Q.get('rec');
  const frameAt = t => { const c = S.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.fillStyle = background; c.fillRect(0, 0, S.W, S.H); draw(c, t, S); };
  const ready = Promise.all([document.fonts ? document.fonts.ready : 0, ...MEDIA.map(m => m.ready)]).then(() => frameAt(0));
  const s = { duration, loop, music, sounds, ready, timeline, seek: async t => { await ready; frameAt(t); } };
  if (!rec) ready.then(() => { const t0 = performance.now(); const tick = () => { frameAt(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(tick); }; tick(); });
  return s;
}

window.Mesh = { create, scene, field, melt, finish, palette, layer, within, text, measure, image, cover, wander, breath, phase, env, key, chord,
  mix, oklch, lch, tone, lab, fromLab, rgba, ease, cl, seg, lerp, hash, rand, TAU, SERIF, SANS, SONG, HEI, KAI };
})();
