/* Ink Wash — Chinese ink painting that spreads, lives and turns into the next scene. WebGL + a small CPU rasteriser, no dependencies.
   Every frame is a pure function of t.

   Ink is not paint: each layer is a map of how much ink lands where (density) and *when* it gets there (arrival time),
   so a wash creeps outward from where the brush touched, wet and dark at its front, then settles lighter. All layers add up
   as ink density, and the paper absorbs light through it (paper × e^(−density)) — five tones of ink come out by themselves.

   const I = Ink.create({ width: 1080, height: 2400, view: [1080, 1920] });
   I.wash(draw, { from: [x, y], at: 1.0, speed: 380 })     // draw(ctx) paints a shape in grey on a 2D canvas: white = most ink; color: 1 = the one colour (cinnabar)
   I.mountain(ridge, { … })                                 // a range: ridge line, dark ink at the crest bleeding down into mist
   I.stroke(points, { width, ink, dry, at, dur })           // a brush stroke, drawn as time passes, flying-white at the dry end
   I.dots([[x, y], …], { size, ink, at })                   // moss dots on rocks and ridges
   I.live((ctx, t) => …)                                   // things that move every frame (geese, a boat, ripples), drawn in grey
   I.mist([{ y, height, speed, amount }])                   // bands of mist drifting across, thinning the ink under them
   I.camera(t => ({ x, y, zoom }));  I.text(…); I.seal(…)
   window.__scene = Ink.scene(I, { duration, music, sounds });
*/
(function () {
const TAU = Math.PI * 2;
// the seal-script face that ships with this skill (JFZSK Seal Script, SIL OFL — fonts/JFZSKSealScript-OFL.txt)
const HERE = (document.currentScript && document.currentScript.src) ? document.currentScript.src.replace(/[^/]*$/, '') : '';
const SEALFONT = new FontFace('InkSeal', `url(${HERE}fonts/JFZSKSealScript.ttf)`);
const sealFontReady = SEALFONT.load().then(f => { document.fonts.add(f); }).catch(() => {});
const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
const seg = (t, a, z) => cl((t - a) / (z - a));
const ease = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function vn(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, h = (a, b) => hash(a * 57.31 + b * 113.7), u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v; }
const fbm = (x, y, o = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); a *= .5; f *= 2.03; } return s; };

/* a ridge line made of a few peaks: base y, peaks [[x, height, width], …], rough = how broken the crest is. Returns x → y */
function ridge(base, peaks, { rough = 26, seed = 1 } = {}) {
  return x => { let h = 0; for (const [px, ph, pw] of peaks) { const d = (x - px) / pw; h = Math.max(h, ph * (.62 * Math.exp(-d * d) + .38 * Math.exp(-Math.abs(d) * 1.4))); }
    return base - h - rough * (fbm(x * .006 + seed * 3.1, seed) - .5) * 2 - rough * .45 * (vn(x * .045 + seed, 2) - .5) * 2; };
}

/* the seal, carved once: glyphs laid in a grid (right column first, top to bottom), stretched to fill their cells;
   then the pressing: uneven paste, specks of bare paper, chipped edges */
function sealImage(str, style = 'white', seed = 7) {
  const N = 320, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d', { willReadFrequently: true });
  const chars = [...str].slice(0, 4), n = chars.length, pad = style === 'white' ? 14 : 20, red = '#c22f22';
  const cells = n === 1 ? [[0, 0, 1, 1]] : n === 2 ? [[.5, 0, .5, 1], [0, 0, .5, 1]] : n === 3 ? [[.5, 0, .5, 1], [0, 0, .5, .5], [0, .5, .5, .5]] : [[.5, 0, .5, .5], [.5, .5, .5, .5], [0, 0, .5, .5], [0, .5, .5, .5]];
  const inner = N - pad * 2 - (style === 'white' ? 0 : 28), off = pad + (style === 'white' ? 0 : 14), gap = style === 'white' ? 10 : 6;
  const glyph = (ch, x, y, w, h) => {                                   // draw the glyph big, measure its ink, fit it to the cell
    const t = document.createElement('canvas'); t.width = t.height = 400; const tg = t.getContext('2d', { willReadFrequently: true });
    tg.font = '400 300px InkSeal, "Songti SC", serif'; tg.textAlign = 'center'; tg.textBaseline = 'middle'; tg.fillStyle = '#000'; tg.strokeStyle = '#000'; tg.lineWidth = style === 'white' ? 12 : 22; tg.lineJoin = 'round';
    tg.fillText(ch, 200, 200); tg.strokeText(ch, 200, 200);
    const d = tg.getImageData(0, 0, 400, 400).data; let x0 = 400, y0 = 400, x1 = 0, y1 = 0;
    for (let yy = 0; yy < 400; yy++) for (let xx = 0; xx < 400; xx++) if (d[(yy * 400 + xx) * 4 + 3] > 40) { x0 = Math.min(x0, xx); x1 = Math.max(x1, xx); y0 = Math.min(y0, yy); y1 = Math.max(y1, yy); }
    const sw = x1 - x0 + 1, sh = y1 - y0 + 1, dw = Math.min(w, sw * h / sh * 2.4);                // seal script stretches to fill its square
    g.drawImage(t, x0, y0, sw, sh, x + (w - dw) / 2, y, dw, h);
  };
  if (style === 'white') { g.fillStyle = red; g.fillRect(pad, pad, N - pad * 2, N - pad * 2); g.globalCompositeOperation = 'destination-out'; }
  else { g.strokeStyle = red; g.lineWidth = 18; g.strokeRect(pad, pad, N - pad * 2, N - pad * 2); }
  cells.forEach(([cx, cy, cw, ch], i) => { const x = off + cx * inner + gap / 2, y = off + cy * inner + gap / 2;
    if (style === 'white') glyph(chars[i], x, y, cw * inner - gap, ch * inner - gap);
    else { const tmp = document.createElement('canvas'); tmp.width = tmp.height = N; const save = g; }
  });
  if (style !== 'white') {                                              // red characters: draw them black into a mask, then colour them
    const m = document.createElement('canvas'); m.width = m.height = N; const mg = m.getContext('2d'); const keep = g.getImageData(0, 0, N, N);
    g.clearRect(0, 0, N, N); cells.forEach(([cx, cy, cw, ch], i) => glyph(chars[i], off + cx * inner + gap / 2, off + cy * inner + gap / 2, cw * inner - gap, ch * inner - gap));
    g.globalCompositeOperation = 'source-in'; g.fillStyle = red; g.fillRect(0, 0, N, N); g.globalCompositeOperation = 'destination-over'; mg.putImageData(keep, 0, 0); g.drawImage(m, 0, 0);
  }
  g.globalCompositeOperation = 'source-over';
  const im = g.getImageData(0, 0, N, N), D = im.data;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; if (!D[i + 3]) continue;
    const e = Math.min(x - pad, y - pad, N - pad - 1 - x, N - pad - 1 - y);
    const chip = e < 7 && fbm(x * .09 + seed, y * .09) + (7 - e) * .07 > .8;                  // chipped edges
    const speck = hash(x * 13.1 + y * 7.7 + seed) > .985 || fbm(x * .05 + seed + 9, y * .05) > .76;  // paper showing through
    D[i + 3] = chip || speck ? 0 : Math.min(255, D[i + 3] * (.76 + .32 * fbm(x * .02 + seed, y * .02)));   // uneven paste
  }
  g.putImageData(im, 0, 0); return c;
}

function create(o = {}) {
  const W = o.width || 1080, H = o.height || 1920, VW = (o.view || [W, H])[0], VH = (o.view || [W, H])[1];
  const RES = o.res || 2;                                         // ink maps are stored at 1/RES; the shader smooths and adds paper grain
  const MW = Math.ceil(W / RES), MH = Math.ceil(H / RES);
  const cv = o.canvas || document.querySelector('canvas') || document.body.appendChild(document.createElement('canvas'));
  cv.width = VW; cv.height = VH;
  const layers = [], lives = [], mists = [], texts = []; let cam = () => ({ x: W / 2, y: H / 2, zoom: VW / W }), seed = o.seed || 3;
  const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  /* a layer: density D (0–2), arrival time A (seconds), dryness Y (0–1); stored as an RGBA texture */
  function newMaps() { return { D: new Float32Array(MW * MH), A: new Float32Array(MW * MH).fill(1e4), Y: new Float32Array(MW * MH) }; }
  function addLayer(m, { wet = .55, settle = .72, spread = .35, fade = null, color = 0 } = {}) {
    let t0 = 1e4, t1 = -1e4; for (let i = 0; i < m.A.length; i++) if (m.D[i] > .003) { t0 = Math.min(t0, m.A[i]); t1 = Math.max(t1, m.A[i]); }
    if (t0 > t1) return; t1 = Math.max(t1, t0 + .001);
    const px = new Uint8Array(MW * MH * 4);
    for (let i = 0; i < MW * MH; i++) { px[i * 4] = cl(m.D[i] / 2) * 255; px[i * 4 + 1] = cl((m.A[i] - t0) / (t1 - t0)) * 255; px[i * 4 + 2] = cl(m.Y[i]) * 255; px[i * 4 + 3] = 255; }
    layers.push({ px, t0, t1, wet, settle, spread, fade, color, tex: null });
  }
  /* arrival from a point: distance through a noisy medium (paper fibres) at a speed; jitter makes the front ragged */
  const arrival = (x, y, from, at, speed, warp = 60) => {
    const wx = (fbm(x * .006 + 11, y * .006) - .5) * warp * 2, wy = (fbm(x * .006, y * .006 + 7) - .5) * warp * 2;
    return at + Math.hypot(x + wx - from[0], y + wy - from[1]) / speed + (fbm(x * .035, y * .035, 3) - .5) * .25;
  };

  /* wash: any shape drawn in grey on a 2D canvas (white = full ink) spreads out from `from` */
  function wash(draw, { from, at = 0, speed = 400, ink = 1, warp = 60, ...rest } = {}) {
    const c = document.createElement('canvas'); c.width = MW; c.height = MH; const g = c.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000'; g.fillRect(0, 0, MW, MH); g.scale(1 / RES, 1 / RES); draw(g);
    const d = g.getImageData(0, 0, MW, MH).data, m = newMaps(), f = from || [W / 2, H / 2];
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x, v = d[i * 4] / 255; if (v < .004) continue;
      m.D[i] = v * ink * 2; m.A[i] = arrival(x * RES, y * RES, f, at, speed, warp); }
    addLayer(m, rest);
  }

  /* a mountain range: ridge(x) → y of the crest. Dark ink gathers at the crest (edge), the body bleeds down and fades into mist;
     folds add darker texture strokes inside; the whole range spreads from `from` (default: its highest point) */
  function mountain(ridge, { x0 = 0, x1 = W, ink = .8, edge = 1, edgeWidth = 9, fall = 70, mistAt = 220, at = 0, speed = 500, from = null, texture = .35, cun = 14, ...rest } = {}) {
    const m = newMaps(); let top = [0, 1e9];
    for (let X = x0; X <= x1; X += RES) { const y = ridge(X); if (y < top[1]) top = [X, y]; }
    const f = from || top, sid = R() * 100;
    for (let my = 0; my < MH; my++) for (let mx = Math.max(0, Math.floor(x0 / RES)); mx < Math.min(MW, Math.ceil(x1 / RES)); mx++) {
      const X = mx * RES, Y = my * RES, r = ridge(X), d = Y - r; if (d < -2) continue;
      const ew = edgeWidth * (.6 + .9 * vn(X * .02 + sid, 0)), ne = .65 + .5 * vn(X * .013 + sid, 3);
      let D = edge * ne * Math.exp(-Math.max(d, 0) / ew) + ink * Math.exp(-Math.max(d, 0) / fall);
      D *= 1 + texture * ((fbm(X * .05, Y * .012 + sid) - .5) * 1.6 + (fbm(X * .012, Y * .012 + sid) - .5));     // streaky texture along the slope
      D *= 1 - seg(d + 40 * (vn(X * .008 + sid, 5) - .5), mistAt * .45, mistAt);                                   // the foot dissolves into mist
      D *= cl((d + 2) / 3);
      if (x0 > 0) D *= Math.pow(seg(X + 60 * (vn(Y * .01 + sid, 1) - .5), x0, x0 + 180), 1.5);           // the ends of a range dissolve too, never a straight cut
      if (x1 < W) D *= Math.pow(seg(X - 60 * (vn(Y * .01 + sid, 4) - .5), x1, x1 - 180), 1.5);
      const i = my * MW + mx; if (D <= .003) continue; m.D[i] = Math.max(0, D); m.A[i] = arrival(X, Y, f, at, speed);
    }
    // 皴: short dry strokes down the slope, dark near the crest, a few per peak — the rock's texture
    for (let k = 0; k < cun; k++) {
      const X = x0 + (x1 - x0) * (.08 + .84 * R()), y0 = ridge(X) + 6 + R() * 30, slope = (ridge(X + 6) - ridge(X - 6)) / 12, len = 40 + R() * 90;
      const dx = Math.sign(slope || 1) * .35 + (R() - .5) * .3, T = arrival(X, y0, f, at, speed);
      stroke([[X, y0], [X + dx * len * .5, y0 + len * .5], [X + dx * len, y0 + len]], { width: 5 + R() * 5, ink: (.6 + R() * .6) * Math.max(ink, .5), dry: .75, at: T, dur: .35, bristles: 5 }, m);
    }
    addLayer(m, rest);
  }

  /* a brush stroke along points [[x, y], …], laid down as time passes (at … at + dur). Pressure swells and tapers; the brush runs dry
     towards the end (`dry`, 0–1): bristles break up into flying white. `ink` 0–2, `width` in px */
  function stroke(pts, { width = 10, ink = 1.4, dry = .5, at = 0, dur = .6, taper = .7, bristles = null, press = null, ...rest } = {}, m = null) {
    const own = !m; m = m || newMaps();
    const P = [], Q = [pts[0], ...pts, pts[pts.length - 1]];                       // a smooth curve through the points (Catmull-Rom)
    for (let i = 1; i < Q.length - 2; i++) { const [p0, p1, p2, p3] = [Q[i - 1], Q[i], Q[i + 1], Q[i + 2]], n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 1.5));
      for (let j = 0; j < n; j++) { const u = j / n, u2 = u * u, u3 = u2 * u;
        P.push([0, 1].map(k => .5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3))); } }
    P.push(pts[pts.length - 1]);
    const N = P.length, sid = R() * 100; bristles = bristles || Math.max(5, Math.round(width / 2.2));
    for (let j = 0; j < N; j++) {
      const u = j / (N - 1), [x, y] = P[j], [nx2, ny2] = P[Math.min(N - 1, j + 1)], [px2, py2] = P[Math.max(0, j - 1)];
      const tx = nx2 - px2, ty = ny2 - py2, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl;
      const pr = press ? press(u) : Math.min(1, .35 + u / .08) * (1 - taper * Math.pow(u, 2.2));
      const w = width * pr, dryness = dry * Math.pow(u, 1.5), T = at + dur * u;
      for (let b = 0; b < bristles; b++) {
        const o = (b + .5) / bristles - .5, gap = vn(u * (5 + hash(b + sid) * 6) * (N / 120) + b * 7.3 + sid, b * 3.1) < dryness * 1.1;   // dry bristles run out in long streaks along the stroke
        if (gap) continue;
        const bx = x + nx * o * w, by = y + ny * o * w, r = Math.max(.6, w / bristles * .85);
        stamp(m, bx, by, r, ink * (1 - dryness * .45) * (.8 + .4 * hash(b + sid)), T, dryness);
      }
    }
    if (own) addLayer(m, { wet: .25, settle: .9, spread: .15, ...rest });
    return m;
  }
  function stamp(m, x, y, r, d, T, dry) {
    const cx = x / RES, cy = y / RES, rr = Math.max(.5, r / RES);
    for (let yy = Math.floor(cy - rr); yy <= Math.ceil(cy + rr); yy++) for (let xx = Math.floor(cx - rr); xx <= Math.ceil(cx + rr); xx++) {
      if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue; const k = 1 - Math.hypot(xx - cx, yy - cy) / (rr + .5); if (k <= 0) continue;
      const i = yy * MW + xx; m.D[i] = Math.max(m.D[i], d * Math.min(1, k * 2)); m.A[i] = Math.min(m.A[i], T); m.Y[i] = Math.max(m.Y[i], dry); }
  }
  /* many strokes as one layer (reeds, grass, a tree's branches) */
  function strokes(list, rest = {}) { const m = newMaps(); for (const [pts, opt] of list) stroke(pts, opt, m); addLayer(m, { wet: .25, settle: .9, spread: .15, ...rest }); }
  /* moss dots: short dabs of dark ink on ridges and rocks */
  function dots(list, { size = 6, ink = 1.6, at = 0, dur = .8, ...rest } = {}) { const m = newMaps(); list.forEach(([x, y], i) => stamp(m, x, y, size * (.7 + .6 * hash(i)), ink, at + dur * hash(i + 9), 0)); addLayer(m, { wet: .2, settle: .95, ...rest }); }

  const live = f => lives.push(f), mist = list => mists.push(...list), camera = f => { cam = f; };
  /* paint(img): a whole ink painting — generated with an image tool, or found — laid down as ink. It is fitted (cover) into the
     painting area and spreads from `from`; the darkest strokes arrive first when `darkFirst` (the brush lays the bones, then the washes) */
  const painting = { on: false };
  function paint(img, { from = [W / 2, H / 2], at = 0, speed = 500, spread = .5, wet = .5, darkFirst = 1.2, fade = null, fit = 'cover' } = {}) {
    const c = document.createElement('canvas'); c.width = MW; c.height = MH; const g = c.getContext('2d', { willReadFrequently: true });
    const sc = fit === 'contain' ? Math.min(MW / img.naturalWidth, MH / img.naturalHeight) : Math.max(MW / img.naturalWidth, MH / img.naturalHeight), dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
    g.fillStyle = `rgb(${paperC.map(v => v * 255 | 0).join(',')})`; g.fillRect(0, 0, MW, MH); g.drawImage(img, (MW - dw) / 2, (MH - dh) / 2, dw, dh);
    const d = g.getImageData(0, 0, MW, MH).data, A = new Float32Array(MW * MH); let t0 = 1e9, t1 = -1e9;
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x, l = (d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11) / 255;
      A[i] = arrival(x * RES, y * RES, from, at, speed) + darkFirst * l; t0 = Math.min(t0, A[i]); t1 = Math.max(t1, A[i]); }
    const ap = new Uint8Array(MW * MH * 4); for (let i = 0; i < MW * MH; i++) { ap[i * 4] = (A[i] - t0) / (t1 - t0) * 255; ap[i * 4 + 3] = 255; }
    Object.assign(painting, { on: true, tex: mkTex(MW, MH, new Uint8Array(d.buffer.slice(0))), atex: mkTex(MW, MH, ap), t0, t1, spread, wet, fade });
  }
  /* text drawn on top: columns of characters, brushed in over time */
  function text(str, { x, y, size = 110, font = '"Xingkai SC", "STKaiti", "Kaiti SC", serif', color = 'rgba(18,18,20,.9)', at = 0, per = .25, vertical = true, onPainting = false } = {}) { texts.push({ str, x, y, size, font, color, at, per, vertical, onPainting }); }
  /* a seal: 1, 2 or 4 characters in seal script. white = carved characters on a red block (白文), red = red characters in a thin frame (朱文) */
  function seal(str, { x, y, size = 90, at = 0, style = 'white', onPainting = false, seed = 7 } = {}) { texts.push({ seal: true, str, x, y, size, at, onPainting, img: null, style, seed }); }

  /* ---------- GPU ---------- */
  const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false });
  gl.getExtension('EXT_color_buffer_float');
  const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, `#version 300 es
in vec2 q; out vec2 uv; void main(){ uv = q * .5 + .5; gl_Position = vec4(q, 0, 1); }`)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;\n' + fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const NOISE = `float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * vn(p); p = p * 2.03 + 17.1; a *= .5; } return s; }`;
  // pass 1: add one layer's ink at time t into the accumulation buffer (painting space)
  const pAdd = prog(`in vec2 uv; out vec4 o; uniform sampler2D L; uniform float t, t0, t1, wet, settle, spread, fade0, fade1, flipY, color;
${NOISE}
void main(){
  vec2 st = vec2(uv.x, flipY > .5 ? 1. - uv.y : uv.y);
  vec4 m = texture(L, st); float D = m.r * 2.; if (D < .002) { o = vec4(0); return; }
  float T = mix(t0, t1, m.g), u = (t - T) / spread;
  float rev = smoothstep(0., 1., u), w = exp(-2.2 * (u - 1.) * (u - 1.)) * step(0., u);        // wet front: darker while it spreads
  float s = mix(1., settle, smoothstep(1., 4., u));                                             // then it dries a little lighter
  float d = D * (rev * s + wet * w * rev);
  d *= 1. - smoothstep(fade0, fade1, t);
  o = vec4(d * (1. - color), m.b * rev * (1. - color), d * color, 0);
}`);
  // pass 2: paper, fibres, edge darkening, mist, camera
  const pOut = prog(`in vec2 uv; out vec4 o; uniform sampler2D A, LV; uniform vec2 res, view; uniform vec3 camv; uniform float t; uniform vec3 paper, ink;
uniform vec4 mist[8]; uniform float nmist; uniform vec3 colorAbs;
uniform sampler2D PI, PA; uniform float pOn, pt0, pt1, pSpread, pWet, pFade0, pFade1;
${NOISE}
void main(){
  vec2 vp = vec2(uv.x, 1. - uv.y) * view;                              // view pixels, y down
  vec2 p = camv.xy + (vp - view * .5) / camv.z;                         // painting pixels
  vec2 a = p / res;
  // ink bleeds a little along the paper's fibres
  vec2 fw = vec2(fbm(p * .015 + 3.) - .5, fbm(p * .015 + 9.) - .5) * 3. / res;
  vec4 acc = texture(A, a) * .55 + texture(A, a + fw) * .25 + texture(A, a - fw * 1.7) * .2;
  float lv = texture(LV, vec2(a.x, a.y)).r * 2.;
  float D = acc.r + lv;
  // edge darkening: where the ink is thin next to thicker ink, a darker rim (water carried the pigment to the edge)
  vec2 e = 3. / res; float nb = (texture(A, a + vec2(e.x, 0)).r + texture(A, a - vec2(e.x, 0)).r + texture(A, a + vec2(0, e.y)).r + texture(A, a - vec2(0, e.y)).r) * .25;
  D += max(0., nb - acc.r) * .0 + max(0., acc.r - nb) * .6;
  // flying white: paper grain shows through dry strokes
  float dry = acc.g; D *= 1. - dry * smoothstep(.4, .75, fbm(p * vec2(.09, .35)));
  // mist: bands drifting sideways, thinning the ink under them
  for (int i = 0; i < 8; i++) { if (float(i) >= nmist) break; vec4 m = mist[i];
    float y = m.x + 18. * sin(p.x * .004 + t * .3 + float(i)), k = exp(-pow((p.y - y) / m.y, 2.)) * (.55 + .6 * fbm(vec2(p.x * .004 - t * m.z * .004, p.y * .01 + float(i))));
    D *= 1. - clamp(k * m.w, 0., 1.); }
  float grain = .9 + .2 * fbm(p * .5) * fbm(p * .08 + 2.);
  vec3 pap = paper * (1. - .035 * fbm(p * vec2(.01, .04))) * (.985 + .03 * h21(floor(p)));
  float Cr = acc.b * (.8 + .4 * fbm(p * .03));
  // a painting (generated or found) as an ink layer: its darkness becomes ink density per channel, revealed by its own wet front
  vec3 Dp = vec3(0.);
  if (pOn > .5) {
    vec3 pc = texture(PI, a).rgb; float T = mix(pt0, pt1, texture(PA, a).r), u = (t - T) / pSpread;
    float rev = smoothstep(0., 1., u) * (1. - smoothstep(pFade0, pFade1, t)), wetf = exp(-2.2 * (u - 1.) * (u - 1.)) * step(0., u) * pWet;
    Dp = max(-log(max(pc, vec3(.02)) / paper), 0.) * (rev + wetf * rev);
    for (int i = 0; i < 8; i++) { if (float(i) >= nmist) break; vec4 m = mist[i];                // mist thins the painting too
      float y = m.x + 18. * sin(p.x * .004 + t * .3 + float(i)), k = exp(-pow((p.y - y) / m.y, 2.)) * (.55 + .6 * fbm(vec2(p.x * .004 - t * m.z * .004, p.y * .01 + float(i))));
      Dp *= 1. - clamp(k * m.w, 0., 1.); }
  }
  vec3 c = pap * exp(-D * grain * ink) * exp(-Cr * colorAbs) * exp(-Dp);
  o = vec4(c, 1);
}`);
  const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const bindQ = p => { const a = gl.getAttribLocation(p, 'q'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0); };
  const mkTex = (w, h, data, fl = false) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (fl) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null); else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR)); [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE)); return t; };
  const accTex = mkTex(MW, MH, null, true), fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, accTex, 0);
  const liveC = document.createElement('canvas'); liveC.width = MW; liveC.height = MH; const lc = liveC.getContext('2d'); const liveTex = mkTex(MW, MH, null);
  const overC = document.createElement('canvas'); overC.width = VW; overC.height = VH; const oc2 = overC.getContext('2d');
  const out2 = document.createElement('canvas'); out2.width = VW; out2.height = VH; const final = cv;   // the visible canvas is the GL one; text goes on via a 2D pass below
  const hex = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16) / 255);
  const paperC = hex(o.paper || '#efe8da'), inkC = (o.inkTone || [1.05, 1.0, .94]);   // cool ink: red absorbed a little more than blue
  const colorAbsC = o.color || [.12, 1.35, 1.25];                                     // the one colour: cinnabar by default (ochre: [.25, .6, 1.1])

  function draw(t) {
    // 1 accumulate
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, MW, MH); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(pAdd); bindQ(pAdd); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const U = n => gl.getUniformLocation(pAdd, n);
    for (const L of layers) {
      if (t < L.t0 - .05) continue;
      if (!L.tex) L.tex = mkTex(MW, MH, L.px);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, L.tex); gl.uniform1i(U('L'), 0);
      gl.uniform1f(U('t'), t); gl.uniform1f(U('t0'), L.t0); gl.uniform1f(U('t1'), L.t1); gl.uniform1f(U('wet'), L.wet); gl.uniform1f(U('settle'), L.settle); gl.uniform1f(U('spread'), L.spread);
      gl.uniform1f(U('fade0'), L.fade ? L.fade[0] : 1e4); gl.uniform1f(U('fade1'), L.fade ? L.fade[0] + L.fade[1] : 1e4 + 1); gl.uniform1f(U('flipY'), 0); gl.uniform1f(U('color'), L.color ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.disable(gl.BLEND);
    // 2 live layer: drawn fresh each frame in grey (white = ink)
    lc.setTransform(1, 0, 0, 1, 0, 0); lc.fillStyle = '#000'; lc.fillRect(0, 0, MW, MH); lc.setTransform(1 / RES, 0, 0, 1 / RES, 0, 0);
    for (const f of lives) { lc.save(); f(lc, t); lc.restore(); }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, liveTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, liveC);
    // 3 out
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, VW, VH); gl.useProgram(pOut); bindQ(pOut);
    const V = n => gl.getUniformLocation(pOut, n), c = cam(t);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, accTex); gl.uniform1i(V('A'), 0); gl.uniform1i(V('LV'), 1);
    gl.uniform2f(V('res'), W, H); gl.uniform2f(V('view'), VW, VH); gl.uniform3f(V('camv'), c.x, c.y, c.zoom ?? VW / W); gl.uniform1f(V('t'), t);
    gl.uniform1f(V('pOn'), painting.on ? 1 : 0);
    if (painting.on) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, painting.tex); gl.uniform1i(V('PI'), 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, painting.atex); gl.uniform1i(V('PA'), 3);
      gl.uniform1f(V('pt0'), painting.t0); gl.uniform1f(V('pt1'), painting.t1); gl.uniform1f(V('pSpread'), painting.spread); gl.uniform1f(V('pWet'), painting.wet);
      gl.uniform1f(V('pFade0'), painting.fade ? painting.fade[0] : 1e4); gl.uniform1f(V('pFade1'), painting.fade ? painting.fade[0] + painting.fade[1] : 1e4 + 1); }
    gl.uniform3fv(V('paper'), paperC); gl.uniform3fv(V('ink'), inkC); gl.uniform3fv(V('colorAbs'), colorAbsC);
    const mv = new Float32Array(32); mists.slice(0, 8).forEach((m, i) => mv.set([m.y, m.height ?? 60, m.speed ?? 20, m.amount ?? .7], i * 4));
    gl.uniform4fv(V('mist'), mv); gl.uniform1f(V('nmist'), Math.min(8, mists.length));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return c;
  }
  /* text and seals: brushed on top of the GL frame, in view space (they follow the camera) */
  function overlay(ctx, t, c) {
    const z = c.zoom ?? VW / W, toV = (x, y, onPainting) => onPainting ? [VW / 2 + (x - c.x) * z, VH / 2 + (y - c.y) * z] : [x, y];
    for (const T of texts) {
      if (t < T.at) continue; const [x, y] = toV(T.x, T.y, T.onPainting), s = T.size * (T.onPainting ? z : 1);
      ctx.save(); ctx.globalCompositeOperation = 'multiply';
      if (T.seal) { if (!T.img) T.img = sealImage(T.str, T.style, T.seed);
        const k = seg(t, T.at, T.at + .12), sc = 1 + (1 - k) * .35; ctx.globalAlpha = k * .94; ctx.translate(x, y); ctx.rotate(-.03); ctx.scale(sc, sc);
        ctx.drawImage(T.img, -s / 2, -s / 2, s, s); ctx.restore(); continue; }
      ctx.font = `400 ${s}px ${T.font}`; ctx.fillStyle = T.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      [...T.str].forEach((ch, i) => { const k = seg(t, T.at + i * T.per, T.at + i * T.per + T.per * 1.6); if (k <= 0) return;
        ctx.globalAlpha = k; ctx.filter = `blur(${(1 - k) * 6}px)`; ctx.fillText(ch, T.vertical ? x : x + i * s * 1.05, T.vertical ? y + i * s * 1.12 : y); });
      ctx.restore();
    }
  }
  return { wash, mountain, stroke, strokes, dots, paint, live, mist, camera, text, seal, draw, overlay, W, H, VW, VH, canvas: cv, R };
}

/* load images, then build the scene — render.py waits for it. Ink.withImages(['ref/a.png'], ([a]) => { …; return Ink.scene(I, {…}); }) */
function withImages(srcs, build) {
  const s = { duration: 1, seek: async () => {} };
  s.ready = Promise.all(srcs.map(src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('cannot load ' + src)); im.src = src; })))
    .then(imgs => { const real = build(imgs); Object.assign(s, real); return real.ready; });
  return s;
}

function scene(I, { duration, music = null, sounds = [] } = {}) {
  const Q = new URLSearchParams(location.search), cv = I.canvas;
  // final picture = GL frame with the text overlay multiplied on top, on a 2D canvas the renderer reads
  const out = document.createElement('canvas'); out.width = I.VW; out.height = I.VH; out.id = 'out'; const ctx = out.getContext('2d');
  cv.style.display = 'none'; cv.parentNode.insertBefore(out, cv);
  const frame = t => { const c = I.draw(t); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.filter = 'none'; ctx.drawImage(cv, 0, 0); I.overlay(ctx, t, c); };
  const ready = Promise.all([document.fonts ? document.fonts.ready : null, sealFontReady]).then(() => frame(0));
  const s = { duration, music, sounds, ready, seek: async t => { await ready; frame(t); } };
  if (!Q.get('rec')) ready.then(() => { const t0 = performance.now(); const loop = () => { frame(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); }; loop(); });
  return s;
}


/* ---------- people and rain, drawn in a live layer (white = ink) ----------
   figure(g, kind, x, y, { size, t, hat, facing, a }) — x, y at the feet; size = height in px. kinds:
     'walker'   a figure in a long robe, walking — the robe one pale wash, one dark edge, a dot of a head, no limbs
     'umbrella' the same under an oil-paper umbrella
     'picker'   bent over the tea bushes, a basket on the back, a conical hat
     'boat'     a small boat with a figure standing at the stern, poling (x, y = the waterline at the middle of the boat)
   hat: 'none' | 'conical' (斗笠); facing: 1 right, -1 left; t drives the walk sway and the pole. */
function brush(g, pts, w0, w1) {                    // a tapered stroke through points: w0 at the start, w1 at the end
  const L = [], R = [];
  pts.forEach((p, i) => { const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], d = Math.hypot(dx, dy) || 1, u = i / (pts.length - 1);
    const w = (w0 + (w1 - w0) * u) * (1 + .18 * Math.sin(u * 9 + p[0] * .1)) / 2; L.push([p[0] - dy / d * w, p[1] + dx / d * w]); R.push([p[0] + dy / d * w, p[1] - dx / d * w]); });
  g.beginPath(); L.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); R.reverse().forEach(p => g.lineTo(p[0], p[1])); g.closePath(); g.fill();
}
const curve = (a, c, b, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const u = i / n, v = 1 - u; return [v * v * a[0] + 2 * u * v * c[0] + u * u * b[0], v * v * a[1] + 2 * u * v * c[1] + u * u * b[1]]; });
function figure(g, kind, x, y, { size = 90, t = 0, hat = kind === 'picker' ? 'conical' : 'none', facing = 1, a = 1 } = {}) {
  const s = size, base = g.globalAlpha; g.save(); g.translate(x, y); g.scale(facing, 1); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  const A = k => { g.globalAlpha = base * a * k; };
  const head = (hx, hy, r) => { A(.92); g.beginPath(); g.ellipse(hx, hy, r * .85, r, .15, 0, TAU); g.fill();
    if (hat === 'conical') { A(.8); brush(g, curve([hx - r * 2.7, hy + r * .1], [hx, hy - r * 2.4], [hx + r * 2.7, hy + r * .1], 12), s * .012, s * .03); A(.35); brush(g, curve([hx - r * 2.4, hy], [hx, hy - r * 1.3], [hx + r * 2.4, hy], 8), r * 1.2, r * .6); }
    else { A(.9); g.beginPath(); g.arc(hx - r * .25, hy - r * 1.05, r * .42, 0, TAU); g.fill(); } };
  // a robe in a few strokes, bell-shaped: narrow shoulders, a hem that flares and trails behind, a full back line, a big sleeve falling forward
  const robe = (top, w0, w1, sway, lean = 0) => {
    const bk0 = [lean - w0 * .35, top + s * .02], bk1 = [-w1 * .62 + sway, 0], fr0 = [lean + w0 * .3, top + s * .03], fr1 = [w1 * .38 + sway * 1.3, -s * .012];
    A(.26); g.beginPath(); curve(bk0, [-w1 * .55 + lean * .4, top * .35], bk1).forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
    curve(fr1, [w0 * .55 + lean * .5, top * .5], fr0).forEach(p => g.lineTo(p[0], p[1])); g.closePath(); g.fill();
    A(.2); brush(g, curve([lean, top + s * .05], [-w1 * .15 + lean * .3, top * .45], [-w1 * .25 + sway, -s * .01]), w0 * .7, w1 * .45);
    A(.9); brush(g, curve(bk0, [-w1 * .58 + lean * .4, top * .38], bk1, 12), s * .04, s * .012);
    A(.55); brush(g, curve(fr0, [w0 * .58 + lean * .5, top * .5], fr1, 12), s * .02, s * .008);
    A(.42); brush(g, curve([lean + w0 * .1, top + s * .07], [w0 * .9 + lean, top * .72], [w0 * .75 + lean * .5, top * .42]), s * .1, s * .07);         // the sleeve
    A(.85); brush(g, curve([lean + w0 * .2, top + s * .1], [w0 * .95 + lean, top * .62], [w0 * .7 + lean * .5, top * .4]), s * .022, s * .01);
    A(.5); for (let k = 0; k < 3; k++) { const hx = bk1[0] + (fr1[0] - bk1[0]) * (.12 + k * .34); brush(g, [[hx, -s * .012], [hx + s * .06, -s * .004]], s * .016, s * .005); } };
  const ph = t * 2.2, sway = Math.sin(ph) * s * .025, bob = Math.abs(Math.sin(ph)) * s * .012;
  if (kind === 'walker' || kind === 'umbrella') {
    g.translate(0, -bob); robe(-s * .76, s * .13, s * .38, sway, s * .03); head(s * .05, -s * .84, s * .055);
    if (kind === 'umbrella') { A(.85); brush(g, [[s * .07, -s * .56], [s * .02, -s * 1.07]], s * .016, s * .01);
      A(.5); g.beginPath(); curve([-s * .42, -s * .97], [s * .02, -s * 1.36], [s * .46, -s * .97], 14).forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
      curve([s * .46, -s * .97], [s * .02, -s * 1.05], [-s * .42, -s * .97], 10).forEach(p => g.lineTo(p[0], p[1])); g.closePath(); g.fill();       // the oil-paper canopy
      A(.9); brush(g, curve([-s * .44, -s * .96], [s * .02, -s * 1.04], [s * .48, -s * .96], 12), s * .016, s * .02);
      A(.4); for (let k = -2; k <= 2; k++) brush(g, [[s * .02, -s * 1.1], [s * (.02 + k * .19), -s * (.99 + Math.abs(k) * .01)]], s * .008, s * .004); }
  } else if (kind === 'picker') {                       // bent at the waist: the skirt falls straight, the back leans forward over the bushes
    const sw = Math.sin(t * 1.5) * s * .01;
    A(.28); g.beginPath(); curve([-s * .07, -s * .4], [-s * .13, -s * .2], [-s * .15, 0]).forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); curve([s * .13, -s * .01], [s * .1, -s * .2], [s * .07, -s * .4]).forEach(p => g.lineTo(p[0], p[1])); g.closePath(); g.fill();
    A(.85); brush(g, curve([-s * .08, -s * .42], [-s * .14, -s * .2], [-s * .16, 0]), s * .032, s * .012); A(.5); brush(g, curve([s * .07, -s * .4], [s * .11, -s * .2], [s * .13, -s * .01]), s * .016, s * .008);
    A(.35); brush(g, curve([-s * .01, -s * .38], [s * .06, -s * .55], [s * .18 + sw, -s * .6]), s * .16, s * .1);                                         // the leaning back
    A(.9); brush(g, curve([-s * .08, -s * .4], [-s * .02, -s * .62], [s * .16 + sw, -s * .68]), s * .036, s * .016);
    A(.45); g.save(); g.translate(-s * .02, -s * .6); g.rotate(-.55); g.beginPath(); g.ellipse(0, 0, s * .075, s * .12, 0, 0, TAU); g.fill();               // the basket on the back
    A(.85); brush(g, [[-s * .08, -s * .11], [s * .08, -s * .11]], s * .02, s * .016); g.restore();
    A(.7); brush(g, curve([s * .18 + sw, -s * .58], [s * .27, -s * .52], [s * .32, -s * .36 + Math.sin(t * 3) * s * .02]), s * .03, s * .012);                  // an arm into the bush
    head(s * .25 + sw, -s * .66, s * .055);
  } else if (kind === 'boat') {
    A(.35); brush(g, curve([-s * .85, -s * .03], [0, s * .14], [s * .9, -s * .08], 14), s * .1, s * .05);
    A(.9); brush(g, curve([-s * .92, -s * .07], [0, s * .1], [s * .95, -s * .11], 14), s * .03, s * .02);
    A(.45); g.beginPath(); curve([-s * .44, -s * .03], [-s * .1, -s * .42], [s * .24, -s * .04], 12).forEach((p, k) => k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();   // the awning
    A(.85); brush(g, curve([-s * .44, -s * .04], [-s * .1, -s * .42], [s * .24, -s * .05], 12), s * .024, s * .014);
    g.save(); g.translate(s * .55, -s * .06); g.scale(.55, .55); robe(-s * .74, s * .16, s * .26, 0, s * .03); head(s * .04, -s * .83, s * .06); g.restore();
    const swing = Math.sin(t * 1.3) * .25; A(.85); brush(g, [[s * .6, -s * .4], [s * .6 + Math.cos(1.25 + swing) * s * 1.05, -s * .4 + Math.sin(1.25 + swing) * s * 1.05]], s * .016, s * .008);
    for (let j = 0; j < 3; j++) { const q = (t * .5 + j / 3) % 1; A(.25 * (1 - q)); brush(g, [[-s * .9 - q * s * 1.4, s * .05 + q * 4], [-s * .9 - q * s * 2.6, s * .05 + q * 6]], 2, 1); }
  }
  g.restore();
}
/* rain as ink painters leave it: few, fine, pale strokes falling slowly on a slant; ripples where it meets water (water: [y0, y1]) */
function rain(g, t, { count = 60, speed = 240, slant = .14, length = 22, alpha = .16, width = 1.1, W = 1080, H = 1920, water = null, a = 1 } = {}) {
  const base = g.globalAlpha; g.save(); g.strokeStyle = '#fff'; g.lineWidth = width; g.lineCap = 'round';
  for (let i = 0; i < count; i++) { const v = speed * (.8 + .4 * hash(i + 3)), x = (hash(i) * (W + 200) + t * v * slant) % (W + 200) - 100, y = (hash(i + 7) * (H + 200) + t * v) % (H + 200) - 100;
    g.globalAlpha = base * a * alpha * (.6 + .4 * hash(i + 11)); g.beginPath(); g.moveTo(x, y); g.lineTo(x - length * slant, y + length); g.stroke(); }
  if (water) for (let i = 0; i < Math.round(count / 5); i++) { const ph = (t * .7 + hash(i * 3)) % 1, n = Math.floor(t * .7 + hash(i * 3)), x = 60 + hash(i * 5 + n) * (W - 120), y = water[0] + hash(i * 9 + n) * (water[1] - water[0]);
    g.globalAlpha = base * a * alpha * 1.4 * (1 - ph); g.beginPath(); g.ellipse(x, y, 4 + ph * 26, 1.5 + ph * 5, 0, 0, TAU); g.stroke(); }
  g.restore();
}

window.Ink = { create, scene, withImages, ridge, figure, rain, seg, ease, cl, hash, vn, fbm, TAU };
})();
