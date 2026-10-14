/* glitch.js — a broken digital signal laid over anything drawn on a 2D canvas.
   You draw the picture (type, shapes, photos, video frames) with draw(c, t); a timeline says when the signal breaks
   and how; one WebGL pass breaks it. Every frame is a pure function of t: seek anywhere.

   window.__scene = Glitch.scene(async () => ({
     width, height, duration,
     draw(c, t) { … },                              // the clean picture at time t (may be async — return a promise)
     glitches: [{ t, kind, d, amt, seed, area, … }], // when it breaks (see SKILL.md for the kinds)
     look: { scan, curve, vignette, ghost, bloom, chroma, mono },    // the screen, constant over time
     sounds, music,                                   // add Glitch.sounds(glitches, duration) to sounds
   }));
*/
(function () {
const FPS = 30;
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => cl((t - a) / (b - a));
const sm = u => u * u * (3 - 2 * u);
const io = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const oc = u => 1 - Math.pow(1 - u, 3);
const hash = (...a) => { let h = 2166136261; for (const x of a) { h ^= Math.floor(x * 9973) + 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; } return (h >>> 0) / 4294967296; };
function rng(seed = 1) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const fr = t => Math.floor(t * FPS + 1e-6);                 // frame index of a time

/* ---------- the kinds of break ----------
   sharp kinds last a few frames and change state every 1–2 frames; d is in seconds (defaults below).
   Each returns, for frame k of the event, the fx levels (0..1 or px) before amt scaling. */
const DEF = { blip: 2, hit: 3, tear: 3, blocks: 4, burst: 9, sort: 6, drop: 4, roll: 12, freeze: 18, stutter: 12, flash: 2, mosh: 30, off: 20, on: 16, shift: 2 };
function stepFx(kind, k, n, r, o) {
  const a = () => .45 + .55 * r();                          // a random level for this step
  switch (kind) {
    case 'blip': return { rgb: 10 * a(), tear: .15 * a(), jitter: (r() - .5) * 14 };
    case 'shift': return { rgb: 4, jitter: (r() < .5 ? -1 : 1) * (10 + 20 * r()), tear: .08 };
    case 'hit': return k === 0 ? { rgb: 22 * a(), tear: .55 * a(), block: .1, noise: r() < .4 ? .5 : 0, jitter: (r() - .5) * 30 }
                               : { rgb: 12 * a(), tear: .35 * a(), block: .06 * a(), crush: .3 };
    case 'tear': return { tear: .6 + .4 * r(), rgb: 8 + 10 * r(), repeat: .5 * r(), bands: 8 + 22 * r() };
    case 'blocks': return { block: .12 + .25 * r(), bsize: [16, 24, 32, 48][Math.floor(r() * 4)], crush: .5 + .4 * r(), rgb: 4 };
    case 'burst': {
      const off = k > 0 && k < n - 1 && r() < .22;            // a clean frame inside a burst
      if (off) return {};
      return { rgb: 25 * a(), tear: .8 * a(), block: .25 * a(), noise: r() < .3 ? .6 : 0, sort: r() < .3 ? .7 : 0, crush: .5 * r(), jitter: (r() - .5) * 50, repeat: .4 * r(), invert: r() < .08 ? 1 : 0 };
    }
    case 'sort': return { sort: .4 + .6 * (k + 1) / n, rgb: 4, tear: .1 * r() };
    case 'drop': return k === 0 || k === n - 1 ? { noise: 1, black: .3, roll: .1 * r() } : { noise: 1, black: .5 + .5 * r(), roll: .3 * r() };
    case 'flash': return { rgb: 14 * a(), tear: .4 * a(), crush: .4 };
    default: return {};
  }
}

/* the whole state at time t: fx levels, which content time to draw, and a held time for mosh */
function stateAt(list, t, W, H) {
  const fx = { rgb: 0, tear: 0, bands: 0, block: 0, bsize: 24, crush: 0, noise: 0, sort: 0, roll: 0, jitter: 0, repeat: 0, invert: 0, black: 0, mosh: 0, squeeze: 0, seed: 0, area: null };
  let ct = t, held = null, k0 = fr(t);
  for (const [i, e] of list.entries()) {
    const kind = e.kind || 'hit', d = e.d ?? DEF[kind] / FPS, f0 = fr(e.t), n = Math.max(1, Math.round(d * FPS)), k = k0 - f0, amt = e.amt ?? 1;
    const seed = e.seed ?? (i + 1) * 7.31;
    if (kind === 'off') {                                     // the picture squeezes to a line, then a dot, then nothing; stays off
      if (t >= e.t) { fx.squeeze = Math.max(fx.squeeze, cl((t - e.t) / d)); }
      continue;
    }
    if (kind === 'on') {                                      // dot → line → picture; black before
      if (t < e.t) { fx.squeeze = 1; continue; }
      if (t < e.t + d) fx.squeeze = Math.max(fx.squeeze, 1 - cl((t - e.t) / d));
      continue;
    }
    if (k < 0 || k >= n) continue;
    const u = (t - e.t) / d;
    if (kind === 'mosh') {                                    // the old picture dragged by the new one, block by block
      fx.mosh = Math.max(fx.mosh, cl(u) * .999 + .001); held = e.from ?? (e.t - 1 / FPS); fx.seed = seed + 13;
      fx.moshAmt = (e.amt ?? 1); fx.area = e.area || fx.area;
      continue;
    }
    if (kind === 'freeze') { ct = e.at ?? e.t; if (k === 0 || k === n - 1) { fx.rgb = Math.max(fx.rgb, 8 * amt); fx.tear = Math.max(fx.tear, .25 * amt); } if (e.area) fx.area = e.area; continue; }
    if (kind === 'stutter') { const loop = e.loop ?? 3 / FPS; ct = (e.at ?? e.t) - loop + ((t - e.t) % loop); fx.rgb = Math.max(fx.rgb, 3 * amt); continue; }
    if (kind === 'roll') { fx.roll = Math.max(fx.roll, (e.dir ?? 1) * io(cl(u)) * (e.amt ?? 1)); fx.rgb = Math.max(fx.rgb, 6 * Math.sin(Math.PI * u)); fx.seed = seed; continue; }
    if (kind === 'flash') ct = e.show ?? t;
    // sharp kinds: a new state every 1–2 frames
    let step = 0, acc = 0; const hs = j => 1 + (hash(seed, j, 3) < .45 ? 1 : 0);
    while (acc + hs(step) <= k) { acc += hs(step); step++; }
    const r = rng(Math.floor(hash(seed, step) * 1e9) + 1);
    const s = kind === 'fx' ? Object.fromEntries(Object.entries(e.fx || {}).map(([q, v]) => [q, typeof v === 'number' && q !== 'bsize' && q !== 'bands' ? v * (.5 + .5 * r()) : v])) : stepFx(kind, k, n, r, e);
    for (const [q, v] of Object.entries(s)) {
      if (q === 'bsize' || q === 'bands') { fx[q] = v; continue; }
      if (q === 'jitter' || q === 'roll') { fx[q] += v * amt; continue; }
      fx[q] = Math.max(fx[q], v * (q === 'invert' ? 1 : amt));
    }
    fx.seed = seed * 3.7 + step * 1.13;
    if (e.area) fx.area = e.area;
  }
  return { fx, ct, held };
}

/* ---------- the shader ---------- */
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p * .5 + .5; gl_Position = vec4(p, 0., 1.); }`;
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D src, held, grainT;
uniform vec2 res;
uniform float rgb, tear, bands, block, bsize, crush, noise, sortA, roll, jitter, rep, inv, black, mosh, moshAmt, squeeze, seed;
uniform vec4 area; uniform float areaOn;
uniform float scan, scanPx, curve, vig, ghost, bloom, chroma, mono, grain;
float h(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float h1(float x, float s){ return h(vec2(x, s)); }
float lum(vec3 c){ return dot(c, vec3(.299, .587, .114)); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y); }
vec3 S(vec2 q){ return texture(src, q).rgb; }
float inside(vec2 q){ return step(0., q.x) * step(q.x, 1.) * step(0., q.y) * step(q.y, 1.); }
void main(){
  vec2 q = uv;
  if (curve > 0.) { vec2 c = q - .5; q = .5 + c * (1. + curve * dot(c, c)); }
  // CRT off/on: squash to a line, then to a dot
  float sy = mix(1., .0025, smoothstep(0., .5, squeeze)), sx = mix(1., .002, smoothstep(.5, .85, squeeze));
  vec2 qs = (q - .5) / vec2(sx, sy) + .5;
  vec2 px = qs * res;
  bool hit = areaOn < .5 || (px.x >= area.x && px.x <= area.x + area.z && px.y >= area.y && px.y <= area.y + area.w);
  vec2 g = qs;
  float bandShift = 0., broken = 0.;
  if (hit) {
    g.y = fract(g.y + roll);
    g.x += jitter / res.x;
    if (tear > 0.) {
      float nb = max(bands, 4.), b1 = floor(g.y * nb), b2 = floor(g.y * nb * 5.);
      if (h1(b1, seed) > 1. - tear * .55) bandShift += (h1(b1, seed + 2.) - .5) * .3 * tear;
      if (h1(b2, seed + 1.) > 1. - tear * .35) bandShift += (h1(b2, seed + 3.) - .5) * .08 * tear;
      if (rep > 0. && h1(b1, seed + 5.) > 1. - rep * .4) g.y = (b1 + .5 + floor((h1(b1, seed + 6.) - .5) * 3.)) / nb;   // a band repeats a row
      g.x += bandShift; broken = step(.0005, abs(bandShift));
    }
    if (block > 0.) {
      vec2 bc = floor(g * res / bsize), bs = bsize / res;
      float r = h(bc + seed * 1.7);
      if (r > 1. - block) {
        float m = h(bc + seed + 9.);
        vec2 off = (vec2(h(bc + seed + 3.), h(bc + seed + 5.)) - .5) * vec2(.35, .08);
        vec2 f = fract(g * res / bsize); broken = 1.;
        if (m < .45) g += off;                                           // a block copied from elsewhere
        else if (m < .8) g = (bc + .5) * bs + off * .2;                    // a flat block of one colour
        else g = (bc + vec2(f.x, .5)) * bs + off * .1;                     // a block smeared from one row
      }
    }
  }
  vec3 c;
  float ca = ((hit ? rgb : 0.) * (1. + abs(bandShift) * 20.) + chroma) / res.x;
  if (hit && mosh > 0.) {
    // datamosh: the held picture flows on, pushed along the new picture's edges; the new picture breaks through in patches
    vec2 bc = floor(g * res / 16.), bq = (bc + .5) * 16. / res;
    float e = 3. / res.x;
    vec2 grad = vec2(lum(S(bq + vec2(e, 0.))) - lum(S(bq - vec2(e, 0.))), lum(S(bq + vec2(0., e))) - lum(S(bq - vec2(0., e))));
    vec2 flow = (vec2(vn(bc / 7. + seed), vn(bc / 7. + seed + 31.)) - .5) * .3 * pow(mosh, 1.2) * moshAmt;
    vec2 m = g - flow - grad * .08 * sin(3.14159 * mosh) * moshAmt;
    vec3 old = vec3(texture(held, m + vec2(ca, 0.)).r, texture(held, m).g, texture(held, m - vec2(ca, 0.)).b);
    vec3 nw = vec3(S(g + vec2(ca, 0.)).r, S(g).g, S(g - vec2(ca, 0.)).b);
    float field = vn(bc / 5. + seed + 7.) * .7 + h(bc + seed) * .2 + min(length(grad) * 2., .6);
    float through = step(1.05 - mosh * 1.2, field);
    c = mix(old, nw, through);
  } else {
    c = vec3(S(g + vec2(ca, 0.)).r, S(g).g, S(g - vec2(ca, 0.)).b);
  }
  if (hit && sortA > 0.) {
    // pixel sort: each bright run down a column is re-laid from dark (top) to light (bottom)
    float colR = h1(floor(g.x * res.x / 2.), seed + 11.);
    float thr = mix(.8, .3, sortA), L = (80. + 420. * colR) * sortA / res.y;
    if (lum(c) > thr && colR > .2) {
      float up = 0., dn = 0.;
      for (int i = 1; i <= 24; i++) { float y = g.y + float(i) * L / 24.; if (y > 1. || lum(S(vec2(g.x, y))) < thr) break; up = float(i) * L / 24.; }
      for (int i = 1; i <= 24; i++) { float y = g.y - float(i) * L / 24.; if (y < 0. || lum(S(vec2(g.x, y))) < thr) break; dn = float(i) * L / 24.; }
      float span = up + dn;
      if (span > 2. / res.y) {
        float f = up / span;                                        // 0 at the top of the run, 1 at the bottom
        vec3 sm[12]; float sl[12];
        for (int i = 0; i < 12; i++) { sm[i] = S(vec2(g.x, g.y + up - span * (float(i) + .5) / 12.)); sl[i] = lum(sm[i]); }
        int want = int(clamp(f * 12., 0., 11.)); vec3 pick = c;
        for (int i = 0; i < 12; i++) { int rank = 0; for (int j = 0; j < 12; j++) rank += (sl[j] < sl[i] || (sl[j] == sl[i] && j < i)) ? 1 : 0; if (rank == want) pick = sm[i]; }
        c = pick;
      }
    }
  }
  if (hit && crush > 0. && broken > 0.) { float lv = mix(48., 3., crush); c = floor(c * lv + .5) / lv; }
  if (ghost > 0.) c += S(g - vec2(ghost * 14. / res.x, 0.)) * .18 * ghost;
  if (bloom > 0.) {
    vec3 b = vec3(0.); for (int i = 0; i < 12; i++) { float a = float(i) * 2.399, r = 6. + float(i) * 2.2; b += max(S(g + vec2(cos(a), sin(a)) * r / res) - .55, 0.); }
    c += b / 12. * bloom * 2.;
  }
  if (hit && noise > 0.) {
    // static in a few thick bands (all of it when noise is 1)
    float bh = mix(50., 220., h1(floor(px.y / 300.), seed + 4.));
    float band = floor(px.y / bh);
    float on = noise >= 1. ? 1. : step(1. - noise * .3, h1(band, seed + 7.));
    vec3 sn = vec3(h(floor(px / vec2(1., 2.)) + seed * 17.));
    c = mix(c, sn * (.35 + .5 * h1(band, seed + 8.)), on * .85);
    c += step(.996, h1(floor(px.y / 2.), seed + 9.)) * on * .5;
  }
  if (hit && inv > .5) c = 1. - c;
  if (mono > 0.) c = mix(c, vec3(lum(c)), mono);
  if (scan > 0.) c *= 1. - scan * .55 * (.5 + .5 * cos(px.y * 6.2832 / scanPx));
  if (grain > 0.) c += (texture(grainT, uv * res / 256.).r - .5) * grain;      // still grain: the same every frame
  if (vig > 0.) { vec2 v = uv - .5; c *= 1. - vig * smoothstep(.2, .85, length(v * vec2(1., res.y / res.x)) * 1.4); }
  // the off / on line: the squashed picture is brighter, the dot fades
  float lit = inside(qs);
  float glowL = smoothstep(.3, .52, squeeze) * .8;
  c = c * lit + vec3(.92, .96, 1.) * glowL * lit * (1. - smoothstep(.85, 1., squeeze));
  if (squeeze > .82) { float r = length((uv - .5) * res) ; float dot1 = exp(-r * r / mix(400., 4., smoothstep(.82, 1., squeeze))) * (1. - smoothstep(.9, 1., squeeze)); c = max(c, vec3(.95, .97, 1.) * dot1); }
  if (squeeze > 0. && curve > 0.) c *= inside(q);
  c *= 1. - black;
  o = vec4(clamp(c, 0., 1.), 1.);
}`;

/* ---------- scene ---------- */
function makeGL(cv) {
  const gl = cv.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL2 is not available');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
  gl.useProgram(pr);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = (unit) => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, unit === 2 ? gl.REPEAT : gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, unit === 2 ? gl.REPEAT : gl.CLAMP_TO_EDGE); return t; };
  const T = [tex(0), tex(1), tex(2)];
  gl.uniform1i(gl.getUniformLocation(pr, 'src'), 0); gl.uniform1i(gl.getUniformLocation(pr, 'held'), 1); gl.uniform1i(gl.getUniformLocation(pr, 'grainT'), 2);
  const U = {}; const u = n => U[n] ?? (U[n] = gl.getUniformLocation(pr, n));
  // still grain texture
  const gc = document.createElement('canvas'); gc.width = gc.height = 256; const gg = gc.getContext('2d'), id = gg.createImageData(256, 256), r = rng(77);
  for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  gg.putImageData(id, 0, 0);
  const up = (unit, src) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, T[unit]); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); };
  up(2, gc);
  return { gl, u, up };
}

function scene(build) {
  const sc = { duration: 0, sounds: [], music: null };
  sc.ready = (async () => {
    const r = await build();
    const W = r.width || 1920, H = r.height || 1080;
    const cv = document.querySelector('canvas') || document.body.appendChild(document.createElement('canvas'));
    cv.width = W; cv.height = H;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const srcC = mk(), heldC = mk(), sctx = srcC.getContext('2d'), hctx = heldC.getContext('2d');
    const { gl, u, up } = makeGL(cv);
    const list = (r.glitches || []).slice().sort((a, b) => a.t - b.t);
    const L = Object.assign({ scan: 0, scanPx: 3, curve: 0, vignette: 0, ghost: 0, bloom: 0, chroma: 0, mono: 0, grain: 0 }, r.look || {});
    let heldAt = null;
    const paint = async (c, t) => { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.restore(); c.save(); await r.draw(c, Math.max(0, t)); c.restore(); };
    sc.draw = async t => {
      const { fx, ct, held } = stateAt(list, t, W, H);
      await paint(sctx, ct); up(0, srcC);
      if (fx.mosh > 0 && held !== null) { if (heldAt !== held) { await paint(hctx, held); heldAt = held; } up(1, heldC); }
      gl.viewport(0, 0, W, H);
      const f1 = (n, v) => gl.uniform1f(u(n), v);
      gl.uniform2f(u('res'), W, H);
      f1('rgb', fx.rgb); f1('tear', fx.tear); f1('bands', fx.bands || 14); f1('block', fx.block); f1('bsize', fx.bsize); f1('crush', fx.crush);
      f1('noise', fx.noise); f1('sortA', fx.sort); f1('roll', fx.roll); f1('jitter', fx.jitter); f1('rep', fx.repeat); f1('inv', fx.invert);
      f1('black', fx.black); f1('mosh', fx.mosh); f1('moshAmt', fx.moshAmt ?? 1); f1('squeeze', fx.squeeze); f1('seed', fx.seed % 97);
      const a = fx.area; f1('areaOn', a ? 1 : 0); if (a) gl.uniform4f(u('area'), a.x, H - a.y - a.h, a.w, a.h);
      f1('scan', L.scan); f1('scanPx', L.scanPx); f1('curve', L.curve); f1('vig', L.vignette); f1('ghost', L.ghost); f1('bloom', L.bloom);
      f1('chroma', L.chroma); f1('mono', L.mono); f1('grain', L.grain);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    sc.seek = t => sc.draw(t);
    sc.duration = r.duration; sc.sounds = r.sounds || []; sc.music = r.music || null;
    sc.timeline = list.map(e => ({ t0: e.t, t1: e.t + (e.d ?? DEF[e.kind || 'hit'] / FPS), kind: e.kind || 'hit', text: e.note || '' }));
    return true;
  })();
  if (!/rec=1/.test(location.search)) sc.ready.then(() => {
    const t0 = performance.now(); let busy = false;
    const loop = async () => { if (!busy) { busy = true; await sc.draw(((performance.now() - t0) / 1000) % sc.duration); busy = false; } requestAnimationFrame(loop); };
    loop();
  });
  return sc;
}

/* ---------- sound from the same timeline ----------
   every break gets its sound on the same frame; the music is cut or stuck where the picture is */
function sounds(list, duration, o = {}) {
  const out = [], v = o.v ?? 1;
  for (const [i, e] of list.entries()) {
    const kind = e.kind || 'hit', d = e.d ?? DEF[kind] / FPS, amt = Math.min(1.2, e.amt ?? 1), seed = e.seed ?? (i + 1) * 7.31, pan = e.pan ?? 0;
    const S = (k, x = {}) => out.push(Object.assign({ kind: k, t: e.t, dur: d, v: v * amt, pan, seed }, x));
    if (e.sound === false) continue;
    switch (kind) {
      case 'blip': case 'shift': S('blip', { v: .55 * v * amt }); break;
      case 'hit': case 'flash': S('data'); S('cut'); break;
      case 'tear': S('data', { v: .8 * v * amt }); S('cut'); break;
      case 'blocks': S('crunch'); S('crush'); break;
      case 'burst': S('data', { v: v * amt }); S('stutter', { loop: 2 / FPS }); break;
      case 'sort': S('smear', { v: .6 * v * amt }); break;
      case 'drop': S('static'); S('cut'); break;
      case 'roll': S('static', { v: .35 * v * amt }); break;
      case 'freeze': S('blip', { dur: .06 }); S('stutter', { loop: e.loop ?? Math.min(.3, Math.max(.12, d / 3)) }); break;
      case 'stutter': S('stutter', { loop: e.loop ?? 3 / FPS }); break;
      case 'mosh': S('smear'); break;
      case 'off': S('crtoff'); S('cut', { dur: Math.max(.1, duration - e.t) }); break;
      case 'on': S('crton'); break;
      case 'fx': S('data', { v: .7 * v * amt }); break;
    }
  }
  return out;
}

/* ---------- media ---------- */
const image = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('cannot load ' + src)); im.src = src; });
/* a video, as frames on disk: render.py extracts `clip.mp4` to `clip.mp4.frames/` (jpgs + index.js) before rendering */
function footage(src) {
  const dir = src + '.frames';
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = dir + '/index.js';
    s.onerror = () => rej(new Error(`no frames for ${src} — run: python3 render.py frames ${src}`));
    s.onload = () => {
      const info = window.__frames[dir]; const cache = new Map();
      const get = i => { i = Math.max(0, Math.min(info.count - 1, i)); if (!cache.has(i)) { cache.set(i, image(`${dir}/${String(i + 1).padStart(5, '0')}.jpg`)); if (cache.size > 90) cache.delete(cache.keys().next().value); } return cache.get(i); };
      res({ ...info, duration: info.count / info.fps,
        frame: t => get(Math.floor(t * info.fps + 1e-6)),
        draw: async (c, t, box) => { const im = await get(Math.floor(t * info.fps + 1e-6)); cover(c, im, box || { x: 0, y: 0, w: c.canvas.width, h: c.canvas.height }); } });
    };
    document.head.appendChild(s);
  });
}
/* draw an image to fill a box, cropped (cover) — fx/fy pick the part kept (0..1), zoom pushes in */
function cover(c, im, { x = 0, y = 0, w, h, fx = .5, fy = .5, zoom = 1 } = {}) {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, k = Math.max(w / iw, h / ih) * zoom;
  const sw = w / k, sh = h / k; c.drawImage(im, (iw - sw) * fx, (ih - sh) * fy, sw, sh, x, y, w, h);
}

/* ---------- type helpers ---------- */
/* wait for local fonts before the first frame: await Glitch.fonts(['700 120px "PingFang SC"', …]) */
const fonts = list => Promise.all(list.map(f => document.fonts.load(f).catch(() => null)));
/* draw a string with every character in a fixed-width cell (clock digits, counters that must not wobble) */
function cells(c, str, x, y, cell, align = 'left') {
  const chars = [...str], w = chars.length * cell; let x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  const ta = c.textAlign; c.textAlign = 'center';
  chars.forEach((ch, i) => c.fillText(ch, x0 + (i + .5) * cell, y)); c.textAlign = ta;
}
/* text typed out like a terminal: the first n characters of str at time t, n growing at cps from t0 */
const typed = (str, t, t0, cps = 24) => { const chars = [...str]; return chars.slice(0, cl(Math.floor((t - t0) * cps), 0, chars.length)).join(''); };
/* scrambled characters resolving to the real text: each character settles at its own time */
function decode(str, t, t0, dur = .6, o = {}) {
  const pool = o.pool || '█▓▒░#%&@$*+=<>/\\|01';
  return [...str].map((ch, i) => { if (ch === ' ') return ' '; const settle = t0 + dur * (o.order === 'random' ? hash(i, 5) : i / Math.max(1, str.length - 1));
    if (t >= settle) return ch; if (t < t0 - .001) return ''; return pool[Math.floor(hash(i, fr(t)) * pool.length)]; }).join('');
}

window.Glitch = { scene, sounds, footage, image, cover, typed, decode, fonts, cells, stateAt, KINDS: Object.keys(DEF), DEF,
  FPS, cl, lerp, seg, sm, io, oc, hash, rng, fr };
})();
