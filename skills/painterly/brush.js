/* Painterly — oil-paint strokes that move. Canvas 2D, no dependencies.
   Every frame is a pure function of t: strokes are seeded once, then each frame decides where every stroke sits,
   which colour it picks up and whether it has been repainted.

   const P = Painterly.create({ width, height, paint, ... });
   window.__scene = Painterly.scene(P, { duration, music, sounds });

   paint(x, y, t) → { c: [r, g, b], a: angle, flow?: px/s, size?: 1, edge?: 0 }
     c     colour of the paint at that spot
     a     stroke direction (radians) — follow the form: around a swirl, along a hill, across water, up a wall
     flow  strokes slide along their direction at this speed (sky, water, wind in the wheat); 0 = still
     size  stroke scale (smaller where there is detail: faces, windows, a café sign)
*/
(function () {
const TAU = Math.PI * 2;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function vn(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, h = (a, b) => hash(a * 57.31 + b * 113.7);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
const fbm = (x, y, o = 4) => { let s = 0, a = .5, f = 1; for (let i = 0; i < o; i++) { s += a * vn(x * f, y * f); a *= .5; f *= 2.03; } return s; };
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
const seg = (t, a, z) => cl((t - a) / (z - a));
const ease = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const rgb = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

/* swirl: direction and a 0–1 band value around a set of vortices — the Starry Night sky.
   vortices: [[x, y, radius, dir(+1 / -1)], …]; base: angle where no vortex reaches */
function swirl(x, y, vortices, base = 0) {
  let a = base, band = .5 + .5 * Math.sin(y * .03 + Math.sin(x * .006) * 2);
  for (const [vx, vy, r, dir] of vortices) {
    const d = Math.hypot(x - vx, y - vy), f = Math.exp(-Math.pow(d / (r * 1.4), 2));
    const ta = Math.atan2(y - vy, x - vx) + Math.PI / 2 * dir;
    a = a + Math.atan2(Math.sin(ta - a), Math.cos(ta - a)) * f;
    band = band + (.5 + .5 * Math.sin(d * .05) - band) * f;
  }
  return { a, band };
}
/* glow: rings of light around a point (a star, a lamp) — returns null outside, else { a, k } with k 0 at the centre → 1 at the edge */
function glow(x, y, cx, cy, r, reach = 3) {
  const d = Math.hypot(x - cx, y - cy); if (d > r * reach) return null;
  return { a: Math.atan2(y - cy, x - cx) + Math.PI / 2, k: d / (r * reach), core: d < r, ring: Math.sin((d - r) * .2) > 0 };
}
const inPoly = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };

/* impasto lighting: normals from the paint's thickness, a soft key light from the top-left, a glint on the ridges */
function makeLight(w, h) {
  const g = document.createElement('canvas'); g.width = w; g.height = h;
  const gl = g.getContext('webgl', { preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) return (col) => col;
  const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const p = gl.createProgram();
  gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 q; varying vec2 uv; void main(){ uv = q * .5 + .5; uv.y = 1. - uv.y; gl_Position = vec4(q, 0, 1); }'));
  gl.attachShader(p, sh(gl.FRAGMENT_SHADER, `precision highp float; varying vec2 uv; uniform sampler2D C, Hm; uniform vec2 px; uniform float k; uniform vec2 L;
    float H(vec2 o){ return texture2D(Hm, uv + o * px * 1.6).r; }
    void main(){
      vec3 col = texture2D(C, uv).rgb;
      float dx = (H(vec2(1,0)) - H(vec2(-1,0))) * 2. + (H(vec2(1,1)) - H(vec2(-1,1)) + H(vec2(1,-1)) - H(vec2(-1,-1)));
      float dy = (H(vec2(0,1)) - H(vec2(0,-1))) * 2. + (H(vec2(1,1)) - H(vec2(1,-1)) + H(vec2(-1,1)) - H(vec2(-1,-1)));
      vec3 n = normalize(vec3(-dx * k, -dy * k, 1.));
      vec3 l = normalize(vec3(L, .9)), v = vec3(0, 0, 1);
      float diff = .86 + .24 * dot(n, l);
      float spec = pow(max(dot(reflect(-l, n), v), 0.), 18.) * .22 * smoothstep(.5, .85, H(vec2(0)));
      float cavity = smoothstep(.2, .0, H(vec2(0))) * .12;
      gl_FragColor = vec4(col * (diff - cavity) + spec * vec3(1., .97, .9), 1.);
    }`));
  gl.linkProgram(p); gl.useProgram(p);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(p, 'q'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
  const tex = unit => { const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(f => gl.texParameteri(gl.TEXTURE_2D, f, gl.LINEAR)); [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(f => gl.texParameteri(gl.TEXTURE_2D, f, gl.CLAMP_TO_EDGE)); return t; };
  const tC = tex(0), tH = tex(1);
  gl.uniform1i(gl.getUniformLocation(p, 'C'), 0); gl.uniform1i(gl.getUniformLocation(p, 'Hm'), 1); gl.uniform2f(gl.getUniformLocation(p, 'px'), 1 / w, 1 / h);
  const uk = gl.getUniformLocation(p, 'k'), uL = gl.getUniformLocation(p, 'L');
  gl.viewport(0, 0, w, h);
  return (colC, hgtC, zoom, light) => {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tC); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, colC);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tH); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, hgtC);
    gl.uniform1f(uk, .75 / Math.max(.6, zoom)); gl.uniform2f(uL, light[0], -light[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return g;
  };
}

function create(o) {
  const W = o.width || 1080, H = o.height || 1920;                       // the painting's size (the canvas can be smaller or bigger: o.view)
  const VW = (o.view || [W, H])[0], VH = (o.view || [W, H])[1];
  const cv = o.canvas || document.querySelector('canvas') || document.body.appendChild(document.createElement('canvas'));
  cv.width = VW; cv.height = VH;
  const out = cv.getContext('2d');
  // paint goes on two layers at once: its colour, and how thick it is; a lighting pass turns the thickness into impasto
  const colC = document.createElement('canvas'), hgtC = document.createElement('canvas');
  colC.width = hgtC.width = VW; colC.height = hgtC.height = VH;
  const c = colC.getContext('2d'), hc = hgtC.getContext('2d');
  const lightPass = makeLight(VW, VH);
  const S = Object.assign({ size: 1, density: 1, impasto: 1 }, o.strokes || {});
  const B = Object.assign({ rate: 12, share: 1 / 6, amount: 1 }, o.boil || {});         // the "boil": rate repaints per second, share of strokes each time
  const LIGHT = o.light || [-.6, -.8];
  const paint = o.paint;
  let seed = o.seed || 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // strokes: an even, jittered grid; a second finer pass where paint() asks for small strokes
  const st = [];
  const lay = (cell, keep) => {
    for (let y = -cell; y < H + cell; y += cell) for (let x = -cell; x < W + cell; x += cell) {
      const px = x + R() * cell, py = y + R() * cell, p = paint(px, py, 0);
      if (!keep(p)) continue;
      st.push({ x: px, y: py, r1: R(), r2: R(), k: st.length, s: p.size ?? 1 });
    }
  };
  const base = 12.5 / Math.sqrt(S.density);
  lay(base * S.size, () => true);
  lay(base * S.size * .6, p => (p.size ?? 1) < .8);
  for (let i = st.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)), t = st[i]; st[i] = st[j]; st[j] = t; }   // shuffled, so later strokes overlap earlier ones at random

  // underpainting: the paint itself, darker and blurred — what shows between strokes
  const under = document.createElement('canvas'); under.width = Math.ceil(W / 12); under.height = Math.ceil(H / 12);
  { const g = under.getContext('2d'); for (let y = 0; y < under.height; y++) for (let x = 0; x < under.width; x++) {
      const p = paint(x * 12 + 6, y * 12 + 6, 0), d = o.underDark ?? .68; g.fillStyle = rgb(p.c.map(v => v * d)); g.fillRect(x, y, 1, 1); } }

  // one stroke of oil paint, the way a loaded flat brush leaves it: a ribbon of paint that starts thick and square,
  // made of bristle tracks side by side, picking up a second colour on one side, ending in a ragged dry-brush tail.
  // Colour goes to c, thickness to hc; the lighting pass makes the ridges and glints.
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  function stroke(x, y, a, L, w, col, k, alpha = 1) {
    const ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca, bend = (hash(k * 5) - .5) * w * .45;
    { const tw = (hash(k * 3.7) - .5) * 46 * (S.temperature ?? 1); col = [col[0] + tw, col[1] + tw * .15, col[2] - tw * .7]; }   // each brushload a little warmer or cooler
    const pt = (u, off) => { const s0 = (u * 2 - 1) * L, b = bend * (1 - (u * 2 - 1) ** 2); return [x + ca * s0 + nx * (off + b), y + sa * s0 + ny * (off + b)]; };
    const hw = u => w * .5 * (u < .1 ? .82 + 1.8 * u : 1 - .3 * (u - .1));                   // thick start, slight taper
    const r = i => hash(k * 7.13 + i * 1.71);
    // the colour the brush picked up from the wet paint next to it: a little lighter or darker, warmer or cooler
    const pick = mixc(col, r(1) > .5 ? [Math.min(255, col[0] * 1.25 + 30), Math.min(255, col[1] * 1.2 + 25), Math.min(255, col[2] * 1.12 + 20)] : col.map(v => v * .62), .55 + r(2) * .3);
    const side = r(3) > .5 ? 1 : -1, imp = S.impasto;
    if (alpha < 1) { c.globalAlpha = alpha; hc.globalAlpha = alpha; }
    // body
    c.beginPath(); hc.beginPath();
    for (let j = 0; j <= 8; j++) { const u = .02 + j / 8 * .86, [px, py] = pt(u, hw(u)); j ? (c.lineTo(px, py), hc.lineTo(px, py)) : (c.moveTo(px, py), hc.moveTo(px, py)); }
    for (let j = 8; j >= 0; j--) { const u = .02 + j / 8 * .86, [px, py] = pt(u, -hw(u)); c.lineTo(px, py); hc.lineTo(px, py); }
    c.closePath(); hc.closePath(); c.fillStyle = rgb(col.map(v => v * .94)); c.fill(); hc.fillStyle = `rgb(${115 * imp | 0},0,0)`; hc.fill();
    // bristle tracks
    const n = Math.max(4, Math.round(w / 2.3)), bw = w / n * 1.25;
    c.lineCap = hc.lineCap = 'butt'; c.lineWidth = hc.lineWidth = bw;
    for (let i = 0; i < n; i++) {
      const o = (i + .5) / n - .5, us = r(10 + i) * .05, ue = .78 + r(30 + i) * .22 - (Math.abs(o) > .35 ? .08 : 0);
      const band = Math.max(0, Math.min(1, side * o * 2.4 + (r(4) - .5)));                    // the picked-up colour streaks along one side
      const cc = mixc(col, pick, band).map(v => v + (r(50 + i) - .5) * 26);
      c.strokeStyle = rgb(cc);
      const ridge = 1 - Math.abs(o) * 1.4, hgt = (135 + 70 * ridge * (.55 + .45 * r(70 + i))) * imp;
      hc.strokeStyle = `rgb(${hgt | 0},0,0)`;
      c.beginPath(); hc.beginPath();
      for (let j = 0; j <= 6; j++) { const u = us + (ue - us) * j / 6, [px, py] = pt(u, o * 2 * hw(u)); j ? (c.lineTo(px, py), hc.lineTo(px, py)) : (c.moveTo(px, py), hc.moveTo(px, py)); }
      c.stroke(); hc.stroke();
    }
    // the paint piles up where the brush first touched
    const [sx, sy] = pt(.06, 0); hc.fillStyle = `rgb(${225 * imp | 0},0,0)`; hc.beginPath(); hc.ellipse(sx, sy, w * .12 + 1, hw(.06) * .8, a, 0, Math.PI * 2); hc.fill();
    if (alpha < 1) { c.globalAlpha = 1; hc.globalAlpha = 1; }
  }

  // contours: Prussian-blue outlines drawn as a chain of short strokes
  function contour(pts, t, { color = [22, 36, 82], width = 5 } = {}) {
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 16));
      for (let j = 0; j < n; j++) { const u = (j + .5) / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, k = i * 97 + j;
        stroke(x + (hash(k) - .5) * 2, y + (hash(k + 1) - .5) * 2, Math.atan2(y1 - y0, x1 - x0) + (hash(k + 2) - .5) * .15, len / n * .62, width * 1.3, color.map(v => v + (hash(k + 3) - .5) * 20), 9e6 + k); }
    }
  }

  function draw(t) {
    const cam = o.camera ? o.camera(t) : { x: W / 2, y: H / 2, zoom: VW / W };
    const z = cam.zoom ?? VW / W;
    c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = o.background || '#0e1222'; c.fillRect(0, 0, VW, VH);
    hc.setTransform(1, 0, 0, 1, 0, 0); hc.fillStyle = '#100000'; hc.fillRect(0, 0, VW, VH);
    c.setTransform(z, 0, 0, z, VW / 2 - cam.x * z, VH / 2 - cam.y * z); hc.setTransform(z, 0, 0, z, VW / 2 - cam.x * z, VH / 2 - cam.y * z);
    c.imageSmoothingEnabled = true; c.filter = 'blur(6px)'; c.drawImage(under, 0, 0, W, H); c.filter = 'none';
    if (o.before) o.before(c, t);
    const x0 = cam.x - VW / 2 / z - 40, x1 = cam.x + VW / 2 / z + 40, y0 = cam.y - VH / 2 / z - 40, y1 = cam.y + VH / 2 / z + 40;
    for (const s of st) {
      // boil: this stroke is repainted `rate` times a second, but only `share` of the strokes each time
      const gen = Math.floor(t * B.rate * B.share + s.r1) , j1 = (hash(s.k * 13 + gen) - .5) * B.amount, j2 = (hash(s.k * 17 + gen) - .5) * B.amount;
      let x = s.x + j1 * 4, y = s.y + j2 * 4;
      let p = paint(x, y, t), alpha = 1;
      if (p.flow) {                                                     // slide along the paint's direction, fading in and out
        const period = 60 * (s.s || 1), ph = ((p.flow * t / period + s.r2) % 1 + 1) % 1, d = (ph - .5) * period;
        x += Math.cos(p.a) * d; y += Math.sin(p.a) * d; p = paint(x, y, t); alpha = Math.min(1, Math.sin(Math.PI * ph) * 2.2);
      }
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const sz = (p.size ?? 1) * S.size, L = (11 + s.r1 * 16) * sz * (p.len ?? 1), w = (13 + s.r2 * 9) * sz;
      stroke(x, y, p.a + j1 * .25, L, w, p.c.map(v => v + (s.r2 - .5) * 24), s.k, alpha);
    }
    if (o.lines) for (let i = 0; i < o.lines.length; i++) {          // the painting's own dark lines, redrawn thin on top
      const l = o.lines[i], gen = Math.floor(t * B.rate * B.share + hash(i)), j = (hash(i * 13 + gen) - .5) * B.amount, off = o.linesOffset ? o.linesOffset(l.x, l.y, t) : [0, 0];
      const x = l.x + off[0] + j * 2, y = l.y + off[1];
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      stroke(x, y, l.a + j * .2, 6 + hash(i * 3) * 4, 4 + hash(i * 5) * 2, l.c.map(v => v * .85), 8e8 + i);
    }
    for (const cn of (o.contours ? o.contours(t) : [])) contour(cn.pts, t, cn);
    if (o.after) o.after(c, t);
    c.setTransform(1, 0, 0, 1, 0, 0); hc.setTransform(1, 0, 0, 1, 0, 0);
    if (S.impasto > 0) out.drawImage(lightPass(colC, hgtC, z, LIGHT), 0, 0); else out.drawImage(colC, 0, 0);
    if (o.overlay) o.overlay(out, t);
  }
  /* a mass: fill a polygon with strokes that follow a direction, then brush a broken Prussian-blue outline round it.
     pts = [[x, y], …]; colour(x, y) and angle(x, y) give the paint; size is the stroke scale (≈ .25–.5 for figures and props).
     Strokes are placed where their centre falls inside, so the edge stays soft and painterly, never die-cut. */
  function mass(pts, colour, angle, { size = .4, outline = [16, 28, 72], width = 4, k = 1 } = {}) {
    let bx = 1e9, by = 1e9, ex = -1e9, ey = -1e9; for (const [x, y] of pts) { bx = Math.min(bx, x); by = Math.min(by, y); ex = Math.max(ex, x); ey = Math.max(ey, y); }
    const cell = 11 * size; let i = 0;
    for (let y = by - cell; y < ey + cell; y += cell) for (let x = bx - cell; x < ex + cell; x += cell) {
      const px = x + hash(k * 31 + i) * cell, py = y + hash(k * 57 + i) * cell, r1 = hash(k * 71 + i), r2 = hash(k * 91 + i); i++;
      if (!inPoly(px, py, pts)) continue;
      stroke(px, py, angle(px, py) + (r1 - .5) * .3, (9 + r1 * 9) * size, (12 + r2 * 6) * size, colour(px, py).map(v => v + (r2 - .5) * 18), 6e7 + k * 4099 + i);
    }
    if (outline) contour([...pts, pts[0]], 0, { color: outline, width });
  }
  const ellipsePts = (x, y, rx, ry, n = 18) => Array.from({ length: n }, (_, i) => [x + Math.cos(i / n * Math.PI * 2) * rx, y + Math.sin(i / n * Math.PI * 2) * ry]);
  /* a person painted the way Loving Vincent does it: a silhouette filled with strokes running down the coat or dress,
     a warm (or cool) rim on the side the light comes from, a Prussian-blue outline. (x, y) = feet, h = height, step = walking phase */
  function figure(x, y, h, { coat = [30, 34, 60], skin = [214, 168, 128], hat = null, dress = false, rim = null, rimSide = -1, step = 0, k = 1 } = {}) {
    const u = h / 100, sw = Math.sin(step), hip = y - (dress ? 2 : 30) * u, sh = y - 76 * u, w = dress ? 22 : 15;
    const lit = (px, base) => { const f = (px - x) / (w * u) * rimSide; return rim ? base.map((v, i) => v + (rim[i] - v) * Math.max(0, f - .2) * .9) : base; };
    if (!dress) [-1, 1].forEach((d, i) => { const lx = x + d * 5 * u + (i ? -sw : sw) * 4 * u;
      mass([[lx - 4.5 * u, hip], [lx + 4.5 * u, hip], [lx + 3.5 * u, y], [lx - 3.5 * u, y]], px => lit(px, coat.map(v => v * .72)), () => Math.PI / 2, { size: u * .26, width: 2.2 * u, k: k * 10 + i }); });
    const body = [[x - 8 * u, sh - 2 * u], [x - 14 * u, sh + 5 * u], [x - (w - 2) * u, (sh + hip) / 2], [x - w * u, hip], [x + w * u, hip], [x + (w - 2) * u, (sh + hip) / 2], [x + 14 * u, sh + 5 * u], [x + 8 * u, sh - 2 * u]];
    mass(body, px => lit(px, coat), px => Math.PI / 2 + (px - x) / (w * u) * (dress ? .25 : .08), { size: u * .3, width: 2.6 * u, k: k * 10 + 3 });
    const hy = sh - 9 * u;
    mass(ellipsePts(x, hy, 5.5 * u, 7 * u, 12), px => lit(px, skin), () => Math.PI / 2, { size: u * .17, width: 1.8 * u, k: k * 10 + 4 });
    if (hat) { mass(ellipsePts(x, hy - 5 * u, 11 * u, 2.8 * u, 12), () => hat, () => 0, { size: u * .18, width: 1.8 * u, k: k * 10 + 5 });
      mass([[x - 5.5 * u, hy - 5 * u], [x - 5 * u, hy - 13 * u], [x + 5 * u, hy - 13 * u], [x + 5.5 * u, hy - 5 * u]], () => hat, () => 0, { size: u * .18, width: 1.8 * u, k: k * 10 + 6 }); }
  }
  return { draw, canvas: cv, ctx: c, stroke, contour, mass, figure, ellipsePts, W, H, VW, VH, count: st.length };
}

/* Paint from the original painting. reference(img, { width, height, fit }) reads a picture and returns a sampler:
   at(x, y) → { c, a, size } — the painting's colour there, the direction its brushwork runs (along the edges and the
   grain of the picture, from a smoothed structure tensor), and a smaller stroke where there is detail.
   Painting coordinates: the image is fitted ('cover', default, or 'contain') into width × height. */
function reference(img, { width = 1080, height = 1920, fit = 'cover', grid = 2, smooth = 3, detail = .68 } = {}) {
  const gw = Math.ceil(width / grid), gh = Math.ceil(height / grid);
  const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh; const g = cv.getContext('2d', { willReadFrequently: true });
  const s = fit === 'contain' ? Math.min(gw / img.naturalWidth, gh / img.naturalHeight) : Math.max(gw / img.naturalWidth, gh / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  g.fillStyle = '#000'; g.fillRect(0, 0, gw, gh); g.drawImage(img, (gw - dw) / 2, (gh - dh) / 2, dw, dh);
  const px = g.getImageData(0, 0, gw, gh).data, N = gw * gh;
  const col = new Float32Array(N * 3), lum = new Float32Array(N);
  for (let i = 0; i < N; i++) { col[i * 3] = px[i * 4]; col[i * 3 + 1] = px[i * 4 + 1]; col[i * 3 + 2] = px[i * 4 + 2]; lum[i] = px[i * 4] * .3 + px[i * 4 + 1] * .59 + px[i * 4 + 2] * .11; }
  const L = (x, y) => lum[Math.min(gh - 1, Math.max(0, y)) * gw + Math.min(gw - 1, Math.max(0, x))];
  let jxx = new Float32Array(N), jxy = new Float32Array(N), jyy = new Float32Array(N), mag = new Float32Array(N);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const gx = (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x - 1, y) + L(x - 1, y + 1));
    const gy = (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1)) - (L(x - 1, y - 1) + 2 * L(x, y - 1) + L(x + 1, y - 1));
    const i = y * gw + x; jxx[i] = gx * gx; jxy[i] = gx * gy; jyy[i] = gy * gy; mag[i] = Math.hypot(gx, gy);
  }
  const blur = (a, r) => { const t = new Float32Array(N), o = new Float32Array(N);
    for (let y = 0; y < gh; y++) { let acc = 0, n = 0; for (let x = -r; x < gw + r; x++) { if (x + r < gw) { acc += a[y * gw + x + r]; n++; } if (x - r - 1 >= 0) { acc -= a[y * gw + x - r - 1]; n--; } if (x >= 0 && x < gw) t[y * gw + x] = acc / n; } }
    for (let x = 0; x < gw; x++) { let acc = 0, n = 0; for (let y = -r; y < gh + r; y++) { if (y + r < gh) { acc += t[(y + r) * gw + x]; n++; } if (y - r - 1 >= 0) { acc -= t[(y - r - 1) * gw + x]; n--; } if (y >= 0 && y < gh) o[y * gw + x] = acc / n; } }
    return o; };
  const R = Math.max(2, Math.round(smooth * 8 / grid));
  jxx = blur(blur(jxx, R), R); jxy = blur(blur(jxy, R), R); jyy = blur(blur(jyy, R), R); mag = blur(mag, Math.max(1, R >> 1));
  const cb = [0, 1, 2].map(k => Float32Array.from({ length: N }, (_, i) => col[i * 3 + k]));
  let mmax = 0; for (let i = 0; i < N; i++) mmax = Math.max(mmax, mag[i]);
  // the painter's own drawing: thin lines clearly darker than their surroundings, kept as short strokes to redraw on top
  const mean = blur(blur(lum, 4), 4), lines = [], step = Math.max(1, Math.round(5 / grid));
  for (let y = 0; y < gh; y += step) for (let x = 0; x < gw; x += step) { const i = y * gw + x;
    if (lum[i] < mean[i] - 26 && mag[i] > mmax * .08) lines.push({ x: x * grid, y: y * grid, a: .5 * Math.atan2(2 * jxy[i], jxx[i] - jyy[i]) + Math.PI / 2, c: [col[i * 3], col[i * 3 + 1], col[i * 3 + 2]] }); }
  const idx = (x, y) => Math.min(gh - 1, Math.max(0, Math.round(y / grid))) * gw + Math.min(gw - 1, Math.max(0, Math.round(x / grid)));
  return {
    width, height, lines,
    at(x, y) {
      const i = idx(x, y), a = .5 * Math.atan2(2 * jxy[i], jxx[i] - jyy[i]) + Math.PI / 2;     // along the grain, across the gradient
      const coh = Math.sqrt((jxx[i] - jyy[i]) ** 2 + 4 * jxy[i] ** 2) / (jxx[i] + jyy[i] + 1e-3);  // 0 = no clear direction, 1 = a clear one
      return { c: [cb[0][i], cb[1][i], cb[2][i]], a, coherence: coh, size: 1 - detail * Math.min(1, mag[i] / (mmax * .25)) };
    },
  };
}
/* load an image, then build the scene from it. render.py waits for it. Use: Painterly.fromImage('ref/x.jpg', img => { …; return Painterly.scene(P, {…}); }) */
function fromImage(src, build) {
  const s = { duration: 1, ready: null, seek: async () => {} };
  s.ready = new Promise((ok, no) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => no(new Error('cannot load ' + src + ' — open the page through render.py (or a local server), not straight from disk')); img.src = src; })
    .then(img => { const real = build(img); Object.assign(s, real, { ready: real.ready }); return real.ready; });
  return s;
}

function scene(P, { duration, music = null, sounds = [] } = {}) {
  const Q = new URLSearchParams(location.search);
  const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => P.draw(0));
  const s = { duration, music, sounds, ready, seek: async t => { await ready; P.draw(t); }, strokes: P.count };
  if (!Q.get('rec')) ready.then(() => { const t0 = performance.now(); const loop = () => { P.draw(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); }; loop(); });
  return s;
}

window.Painterly = { create, scene, reference, fromImage, swirl, glow, inPoly, hash, vn, fbm, hex, mix, cl, seg, ease };
})();
