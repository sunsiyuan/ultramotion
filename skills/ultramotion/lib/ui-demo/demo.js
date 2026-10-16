/* ui-demo · real product screens being used: a phone or a browser window, a cursor or a finger, clicks, typing, scrolling,
   the camera pushing in on what matters, callouts and captions. Every frame is a pure function of t.
   window.Demo — see GUIDE.md */
(() => {
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, u) => a + (b - a) * u;
const seg = (t, a, b) => cl((t - a) / Math.max(1e-6, b - a));
const ease = {
  io: u => u * u * u * (u * (u * 6 - 15) + 10),                       // smootherstep: camera, screens
  out: u => 1 - Math.pow(1 - u, 3),
  out5: u => 1 - Math.pow(1 - u, 5),                                   // a flick: fast, a long settle (scroll)
  sine: u => .5 - .5 * Math.cos(Math.PI * u),
  hand: u => {                                                         // a hand moving a mouse: speeds up, slows, a hair past, back
    if (u <= 0) return 0; if (u >= 1) return 1;
    const k = 9, w = 8, f = x => 1 - Math.exp(-k * x) * (Math.cos(w * x) + k / w * Math.sin(w * x));
    return lerp(f(u) / f(1), 1, Math.pow(u, 6));
  },
};
const hash = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x, seed = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, seed), hash(i + 1, seed), u) * 2 - 1; };
const SANS = 'system-ui, -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
const MONO = '"SF Mono", Menlo, Monaco, monospace';
const rgb = c => { const m = String(c).match(/[\d.]+/g) || [0, 0, 0]; return c[0] === '#' ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : m.slice(0, 3).map(Number); };
const lum = c => { const [r, g, b] = rgb(c); return (.299 * r + .587 * g + .114 * b) / 255; };

/* ---------- captures ---------- */
const image = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => no(new Error('cannot load ' + src)); im.src = src; });
const script = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('cannot load ' + src)); document.head.appendChild(s); });
/* a capture made by capture.py: await Demo.shots('shots/name') → { url, title, device, viewport, scale, shots: [{ img, w, h, full, els, pins, … }] } */
async function shots(dir) {
  await script(dir + '/shots.js'); const cap = window.__shots[dir];
  if (!cap) throw new Error('no capture in ' + dir + ' — run capture.py');
  await Promise.all(cap.shots.map(async s => { s.img = await image(dir + '/' + s.src); await Promise.all((s.pins || []).map(async p => { p.img = await image(dir + '/' + p.src); })); s.cap = cap; }));
  return cap;
}
/* the shots grouped by the action that made them, in order: [[0], [1, 2, 3, 4, 5], [6, 7, …], …] — a drag, a word typed, one shot */
const runs = cap => { const out = []; cap.shots.forEach((s, i) => { const last = out[out.length - 1]; if (last && s.act && cap.shots[last[0]].act === s.act && /^(drag|keyshots)/.test(s.act)) last.push(i); else out.push([i]); }); return out; };
/* your own screenshots: Demo.images(['a.png', 'b.png'], { device: 'phone', scale: 3, viewport: { w: 393, h: 798 } }) → the same shape (no element boxes: aim with [x, y]) */
async function images(list, o = {}) {
  const cap = { url: o.url || '', title: o.title || '', device: o.device || 'phone', scale: o.scale || 3, shots: [] };
  for (const src of list) {
    const img = await image(src), w = img.naturalWidth / cap.scale, h = img.naturalHeight / cap.scale;
    cap.viewport = cap.viewport || o.viewport || { w, h: Math.min(h, o.viewportH || (cap.device === 'phone' ? w * 798 / 393 : w * 860 / 1440)) };
    cap.shots.push({ img, src, w, h, full: h > cap.viewport.h + 2, els: {}, pins: [], statusColor: o.statusColor || '#ffffff', cap });
  }
  return cap;
}
/* a screen recording (the user's), split into frames by render.py: Demo.footage('rec.mp4', { scale, device, statusColor }) */
async function footage(src, o = {}) {
  const dir = src + '.frames'; await script(dir + '/index.js'); const info = window.__frames[dir], cache = new Map();
  const get = i => { i = cl(i, 0, info.count - 1); if (!cache.has(i)) { cache.set(i, image(`${dir}/${String(i + 1).padStart(5, '0')}.jpg`)); if (cache.size > 60) cache.delete(cache.keys().next().value); } return cache.get(i); };
  const scale = o.scale || (o.device === 'laptop' ? 2 : 3) * info.width / (o.device === 'laptop' ? 2880 : 1179);
  const w = info.width / scale, h = info.height / scale;
  const shot = { video: { info, get, cur: null, fps: info.fps, duration: info.count / info.fps }, w, h, full: false, els: o.els || {}, pins: [], statusColor: o.statusColor || '#000000' };
  const cap = { url: o.url || '', title: o.title || '', device: o.device || 'phone', scale, viewport: { w, h }, shots: [shot] }; shot.cap = cap;
  shot.img = await get(0); return cap;
}

/* ---------- the pointer ---------- */
function arrow(c, x, y, s, press) {                                    // the standard arrow pointer, tip at (x, y), s = px per CSS px
  const k = s * (1 - .12 * press);
  c.save(); c.translate(x, y); c.scale(k, k);
  c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 4 * k; c.shadowOffsetY = 1.5 * k;
  const P = [[0, 0], [0, 17.2], [4.1, 13.3], [6.9, 19.6], [9.6, 18.4], [6.9, 12.3], [12.3, 12.3]];
  c.beginPath(); P.forEach(([px, py], i) => i ? c.lineTo(px, py) : c.moveTo(px, py)); c.closePath();
  c.lineJoin = 'round'; c.lineWidth = 2.1; c.strokeStyle = '#fff'; c.stroke(); c.shadowColor = 'transparent';
  c.fillStyle = '#111'; c.fill(); c.restore();
}
function touch(c, x, y, s, a, press, dark) {                           // a fingertip on glass: a soft disc that firms up when it presses
  if (a <= 0) return;
  const r = 19 * s * (1 - .1 * press);
  c.save(); c.globalAlpha *= a;
  c.fillStyle = dark ? `rgba(255,255,255,${.28 + .14 * press})` : `rgba(40,40,46,${.22 + .14 * press})`;
  c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  c.lineWidth = 1.5 * s; c.strokeStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.75)'; c.stroke();
  c.restore();
}

/* ---------- device frames ---------- */
function rr(c, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
/* geometry of a device around a screen of W × H CSS px at `s` px per CSS px → sizes in device px */
function geometry(kind, cap, o) {
  const s = cap.scale, W = cap.viewport.w, VH = cap.viewport.h;
  if (kind === 'phone') {
    const bar = o.statusBar === false ? 0 : 54, H = VH + bar, bez = 12, edge = 3.5, m = 4, R = o.radius ?? 55;
    const ox = (bez + edge + m) * s, oy = (bez + edge + m) * s;
    return { kind, s, W, H, VH, bar, top: bar, ox, oy, sx: ox, sy: oy, dw: (W + 2 * (bez + edge + m)) * s, dh: (H + 2 * (bez + edge + m)) * s, bez, edge, m, R };
  }
  if (kind === 'browser') {
    const chrome = o.chrome ?? 46, R = o.radius ?? 12, m = 1;
    return { kind, s, W, H: VH, VH, bar: 0, top: 0, chrome, R, m, sx: m * s, sy: (m + chrome) * s, dw: (W + 2 * m) * s, dh: (VH + chrome + 2 * m) * s };
  }
  const R = o.radius ?? 16, m = 1;                                     // 'none': the bare screen with rounded corners
  return { kind: 'none', s, W, H: VH, VH, bar: 0, top: 0, R, m, sx: m * s, sy: m * s, dw: (W + 2 * m) * s, dh: (VH + 2 * m) * s };
}
const FINISH = { titanium: ['#8d8a86', '#d9d6d1', '#6f6c68', '#bdbab4'], black: ['#2a2a2c', '#5a5a5e', '#1b1b1d', '#3d3d40'], silver: ['#b9bcc0', '#f2f3f4', '#9a9da1', '#dfe1e3'],
  blue: ['#3e4a5c', '#8a9bb3', '#2c3644', '#5d6c82'], white: ['#d8d5cf', '#fbfaf8', '#bdbab3', '#ecebe7'] };
function phoneBody(c, g, o) {
  const s = g.s, F = FINISH[o.finish || 'titanium'] || FINISH.titanium, m = g.m * s, e = g.edge * s, b = g.bez * s;
  const x = m, y = m, w = g.dw - 2 * m, h = g.dh - 2 * m, R = (g.R + g.bez + g.edge) * s;
  // buttons on the sides, under the body
  c.fillStyle = F[2];
  [[-1, .19, .035], [-1, .26, .062], [-1, .345, .062], [1, .29, .1]].forEach(([side, at, len]) => { const bx = side < 0 ? 0 : g.dw - m - .5 * s, by = g.dh * at; rr(c, bx, by, m + .5 * s, g.dh * len, 1.5 * s); c.fill(); });
  // the metal band
  const band = c.createLinearGradient(x, 0, x + w, 0); band.addColorStop(0, F[2]); band.addColorStop(.04, F[1]); band.addColorStop(.1, F[0]); band.addColorStop(.9, F[0]); band.addColorStop(.96, F[3]); band.addColorStop(1, F[2]);
  rr(c, x, y, w, h, R); c.fillStyle = band; c.fill();
  // the black glass
  rr(c, x + e, y + e, w - 2 * e, h - 2 * e, R - e); c.fillStyle = '#050506'; c.fill();
  c.lineWidth = .8 * s; c.strokeStyle = 'rgba(255,255,255,.10)'; c.stroke();
  return { ix: x + e + b, iy: y + e + b, iw: w - 2 * (e + b), ih: h - 2 * (e + b), ir: g.R * s };
}
function statusBar(c, g, x, y, color, o) {
  const s = g.s, dark = lum(color) < .55, ink = dark ? '#fff' : '#000';
  c.fillStyle = color; c.fillRect(x, y, g.W * s, g.bar * s);
  c.fillStyle = ink; c.font = `600 ${17 * s}px ${SANS}`; c.textBaseline = 'middle'; c.textAlign = 'center';
  c.fillText(o.time || '9:41', x + 64 * s, y + 31 * s);
  const rx = x + (g.W - 34) * s, cy = y + 31 * s;
  // battery
  c.globalAlpha = .4; rr(c, rx - 13 * s, cy - 6.5 * s, 26 * s, 13 * s, 4 * s); c.lineWidth = 1.2 * s; c.strokeStyle = ink; c.stroke(); c.fillStyle = ink; rr(c, rx + 14 * s, cy - 2.5 * s, 2 * s, 5 * s, 1 * s); c.fill();
  c.globalAlpha = 1; rr(c, rx - 11 * s, cy - 4.5 * s, 22 * s * (o.battery ?? .82), 9 * s, 2.5 * s); c.fill();
  // wifi
  const wx = rx - 32 * s, wy = cy + 5 * s; c.lineCap = 'round'; c.lineWidth = 2.6 * s; c.strokeStyle = ink;
  [10, 6.3].forEach(r => { c.beginPath(); c.arc(wx, wy, r * s, -Math.PI * .75, -Math.PI * .25); c.stroke(); }); c.beginPath(); c.arc(wx, wy - .5 * s, 1.8 * s, 0, 7); c.fill();
  // signal
  for (let i = 0; i < 4; i++) { rr(c, rx - (68 - i * 5.5) * s, cy + (3.5 - 3 * i) * s - 1 * s, 3.4 * s, (3 + 3 * i) * s, 1 * s); c.fill(); }
}
function browserChrome(c, g, cap, o) {
  const s = g.s, dark = o.theme === 'dark', w = g.dw - 2 * g.m * s, x = g.m * s, y = g.m * s, ch = g.chrome * s;
  c.fillStyle = dark ? '#2b2b2e' : '#ececee'; c.save(); rr(c, x, y, w, g.dh - 2 * g.m * s, g.R * s); c.clip(); c.fillRect(x, y, w, ch);
  c.fillStyle = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.09)'; c.fillRect(x, y + ch - s, w, s); c.restore();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(x + (20 + i * 20) * s, y + ch / 2, 6 * s, 0, 7); c.fill(); });
  // back / forward
  c.strokeStyle = dark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.4)'; c.lineWidth = 1.8 * s; c.lineCap = 'round'; c.lineJoin = 'round';
  [[92, -1], [118, 1]].forEach(([ax, d]) => { c.beginPath(); c.moveTo(x + (ax - 3 * d) * s, y + ch / 2 - 6 * s); c.lineTo(x + (ax + 3 * d) * s, y + ch / 2); c.lineTo(x + (ax - 3 * d) * s, y + ch / 2 + 6 * s); c.stroke(); });
  // the address
  const host = o.address || (cap.url ? new URL(cap.url).host.replace(/^www\./, '') : ''), pw = Math.min(w * .42, 560 * s), px = x + w / 2 - pw / 2, ph = 30 * s;
  rr(c, px, y + ch / 2 - ph / 2, pw, ph, 8 * s); c.fillStyle = dark ? '#3a3a3e' : '#ffffff'; c.fill();
  c.font = `500 ${13.5 * s}px ${SANS}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = dark ? '#e8e8ea' : '#2b2b2e';
  const tw = c.measureText(host).width; c.fillText(host, px + pw / 2 + 7 * s, y + ch / 2 + .5 * s);
  const lx = px + pw / 2 - tw / 2 - 8 * s, ly = y + ch / 2; c.fillStyle = dark ? '#bbb' : '#666';             // a padlock
  rr(c, lx - 4.5 * s, ly - 1 * s, 9 * s, 7 * s, 1.5 * s); c.fill(); c.lineWidth = 1.5 * s; c.strokeStyle = c.fillStyle; c.beginPath(); c.arc(lx, ly - 1.5 * s, 3 * s, Math.PI, 0); c.stroke();
}

/* ---------- WebGL: the device layer laid onto the stage in perspective ---------- */
function makeGL(W, H) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const gl = cv.getContext('webgl2', { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: true });
  if (!gl) return null;
  const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, `#version 300 es
in vec4 p; in vec2 uv; out vec2 v; void main(){ v = uv; gl_Position = p; }`));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; in vec2 v; uniform sampler2D tex; out vec4 o; void main(){ o = texture(tex, v); }`));
  gl.linkProgram(pr); gl.useProgram(pr);
  const buf = gl.createBuffer(), tex = gl.createTexture(), an = gl.getExtension('EXT_texture_filter_anisotropic');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  const lp = gl.getAttribLocation(pr, 'p'), lu = gl.getAttribLocation(pr, 'uv');
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  return { cv, draw(src, quad) {                                       // quad: 4 corners [x, y, w] in stage px, TL TR BR BL
    gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); gl.generateMipmap(gl.TEXTURE_2D);
    const uv = [[0, 0], [1, 0], [1, 1], [0, 1]], d = [];
    [0, 1, 2, 0, 2, 3].forEach(i => { const [x, y, w] = quad[i]; d.push((x / W * 2 - 1) * w, (1 - y / H * 2) * w, 0, w, uv[i][0], uv[i][1]); });
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(d), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 4, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(lu); gl.vertexAttribPointer(lu, 2, gl.FLOAT, false, 24, 16);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  } };
}

/* ---------- the film ---------- */
const OVERLAY = new Set(['callout', 'caption', 'spot']);
const KINDS = ['show', 'play', 'scroll', 'move', 'click', 'tap', 'type', 'drag', 'cam', 'callout', 'caption', 'spot', 'pointer', 'wait', 'swipe'];
function film(o) {
  const SW = o.width || 1080, SH = o.height || 1920, short = Math.min(SW, SH);
  const caps = [o.cap].concat(o.caps || []).filter(Boolean);
  const cap0 = o.cap, D = o.device || {}, kind = D.kind || (cap0.device === 'phone' ? 'phone' : 'browser');
  const G = geometry(kind, cap0, D);
  const pointerKind = o.pointer || (kind === 'phone' ? 'touch' : 'cursor');
  const csize = o.cursorSize ?? 1.5;
  // the device's place on the stage at rest: centre (x, y) and the screen's width in stage px
  const baseW = D.width || (kind === 'phone' ? short * .7 : SW * .8);
  const Z0 = baseW / (G.W * G.s), C0 = [D.x ?? SW / 2, D.y ?? SH / 2];
  const dcv = document.createElement('canvas'); dcv.width = Math.ceil(G.dw); dcv.height = Math.ceil(G.dh); const dc = dcv.getContext('2d');
  const gl = makeGL(SW, SH);

  /* --- steps → times --- */
  const steps = []; let cur = 0, prev = 0;
  const shotOf = ref => ref && (ref.img || ref.video) ? ref : typeof ref === 'number' ? cap0.shots[ref] : ref && ref.i != null ? (ref.cap || cap0).shots[ref.i] : cap0.shots[0];
  const add = (s, L) => {
    s.t0 = s.at != null ? s.at : (s.with ? prev : cur) + (s.gap || 0); s.L = L; s.t1 = s.t0 + L; prev = s.t0;
    const adv = OVERLAY.has(s.k) ? (s.wait ? L : 0) : L; if (!s.with) cur = Math.max(s.at != null ? s.t0 + adv : cur + (s.gap || 0) + adv, cur); steps.push(s); return s;
  };
  const shows = [];
  let screen = add({ k: 'show', shot: shotOf(o.start ?? 0), via: 'cut', at: 0 }, 0); shows.push(screen); cur = 0;
  for (const raw of o.steps || []) {
    const k = KINDS.find(n => n in raw); if (!k) throw new Error('step without a kind: ' + JSON.stringify(raw));
    const s = { ...raw, k };
    if (k === 'show') { s.shot = shotOf(raw.show); s.via = raw.via || 'cut'; const L = raw.dur ?? { cut: 0, fade: .35, push: .5, back: .5, up: .5, down: .45, zoom: .5 }[s.via] ?? .4; add(s, L); shows.push(s); screen = s; continue; }
    s.screen = screen;
    if ((k === 'click' || k === 'tap') && raw[k] !== true && raw[k] != null) {      // move there first
      s.target = raw[k];
      if (pointerKind === 'cursor' && raw.move !== false) { add({ k: 'move', move: raw[k], screen, dur: raw.moveDur ?? .7, at: raw.at, with: raw.with, gap: raw.gap, arc: raw.arc }, raw.moveDur ?? .7); s.at = undefined; s.with = false; s.gap = 0; }
      add(s, raw.dur ?? .32); continue;
    }
    if (k === 'move') { add(s, raw.dur ?? .7); continue; }
    if (k === 'type') { s.text = raw.text; add(s, (raw.lead ?? .15) + [...raw.text].length / (raw.cps || 13) + .25); continue; }
    if (k === 'scroll') { add(s, raw.dur ?? 1.1); continue; }
    if (k === 'swipe') { add(s, raw.dur ?? .5); continue; }
    if (k === 'play') {                                                 // a run of shots played in time: a word typed on a canvas, a page loading
      const list = raw.play, cap = screen.shot.cap, n = list.length; add(s, raw.dur ?? n * (raw.each ?? .09));
      s.typing = raw.keys ?? /^keyshots/.test(cap.shots[list[0]].act || '');
      list.forEach((idx, i) => { const sh = { k: 'show', shot: cap.shots[idx], via: 'cut', t0: s.t0 + s.L * i / n, L: 0, fromPlay: true }; sh.t1 = sh.t0; steps.push(sh); shows.push(sh); screen = sh; });
      continue;
    }
    if (k === 'drag') {                                                 // the screen follows the drag through the shots taken along it
      const list = raw.drag, cap = screen.shot.cap, n = list.length - 1, from = cap.shots[list[1]].dragFrom || cap.shots[list[0]].mouse;
      s.path = [from].concat(list.slice(1).map(i => cap.shots[i].mouse));
      if (pointerKind === 'cursor' && raw.move !== false) { add({ k: 'move', move: from, screen, dur: raw.moveDur ?? .7, at: raw.at, with: raw.with, gap: raw.gap }, raw.moveDur ?? .7); s.at = undefined; s.with = false; s.gap = raw.hold ?? .12; }
      add(s, raw.dur ?? 1.2);
      for (let i = 1; i <= n; i++) { const v = (i - .5) / n, sh = { k: 'show', shot: cap.shots[list[i]], via: 'cut', t0: s.t0 + s.L * Math.acos(1 - 2 * v) / Math.PI, L: 0, fromDrag: true };
        sh.t1 = sh.t0; steps.push(sh); shows.push(sh); screen = sh; }
      continue;
    }
    if (k === 'cam') { add(s, raw.dur ?? 1.1); continue; }
    if (k === 'callout' || k === 'caption' || k === 'spot') { add(s, raw.hold ?? (k === 'caption' ? 2.2 : 1.8)); continue; }
    if (k === 'pointer') { add(s, 0); continue; }
    if (k === 'wait') { add(s, raw.wait); continue; }
  }
  const duration = o.duration || Math.max(cur, ...steps.map(s => s.t1)) + (o.tail ?? 1);
  shows.sort((a, b) => a.t0 - b.t0);
  shows.forEach((s, i) => { const pv = shows[i - 1]; if (pv && s.shot.full && pv.shot.full && s.keepScroll !== false) s.inherit = pv; });
  shows.forEach((s, i) => { s.end = i < shows.length - 1 ? shows[i + 1].t0 : 1e9; s.idx = i; });

  /* --- screens and scrolling --- */
  const vh = sh => sh.cap.viewport.h, maxScroll = sh => Math.max(0, sh.full ? sh.h - vh(sh) : 0);
  const elOf = (sh, name) => { const e = sh.els && sh.els[name]; if (!e) throw new Error(`no element "${name}" in ${sh.src || 'shot'} — add --find ${name}=… to the capture`); return e; };
  const scrollTarget = (s, sh) => { const v = s.scroll; if (typeof v === 'number') return cl(v, 0, maxScroll(sh)); const e = elOf(sh, v); return cl(e.y - vh(sh) * (s.place ?? .3), 0, maxScroll(sh)); };
  function scrollOf(show, t) {
    let y = show.scroll != null && typeof show.scroll === 'number' ? show.scroll : show.inherit ? Math.min(scrollOf(show.inherit, show.t0), maxScroll(show.shot)) : 0;
    for (const s of steps) {
      if (s.k !== 'scroll' || s.screen !== show || s.t0 > t) continue;
      const to = scrollTarget(s, show.shot); y = lerp(y, to, (s.ease ? ease[s.ease] : ease.out5)(seg(t, s.t0, s.t1)));
    }
    return y;
  }
  const showAt = t => { let i = 0; while (i < shows.length - 1 && t >= shows[i + 1].t0) i++; return shows[i]; };
  // a target → a point on the screen (viewport CSS px) at time t
  function point(target, show, t) {
    if (Array.isArray(target)) return target;
    const sh = show.shot, e = typeof target === 'string' ? elOf(sh, target) : elOf(sh, target.el);
    const dx = typeof target === 'object' && target.dx != null ? target.dx : .5, dy = typeof target === 'object' && target.dy != null ? target.dy : .5;
    return [e.x + e.w * dx, e.y + e.h * dy - (sh.full ? scrollOf(show, t) : 0)];
  }
  const boxOf = (target, show, t) => { const sh = show.shot, e = elOf(sh, typeof target === 'string' ? target : target.el), y = e.y - (sh.full ? scrollOf(show, t) : 0); return { x: e.x, y, w: e.w, h: e.h, r: e.radius || 8, e }; };

  /* --- the pointer --- */
  const moves = steps.filter(s => s.k === 'move' || s.k === 'drag' || s.k === 'click' || s.k === 'tap' || s.k === 'swipe');
  const startPt = o.pointerStart || [G.W * .64, G.VH * .78];
  function pointerAt(t) {                                              // → { x, y, press, a } in viewport CSS px
    let p = startPt, press = 0, a = pointerKind === 'cursor' ? 1 : 0, from = startPt;
    const first = moves[0];
    for (const s of moves) {
      if (s.t0 > t) break;
      if (s.k === 'move') { const to = point(s.move, s.screen, s.t1), u = seg(t, s.t0, s.t1), e = ease.hand(u);
        const dx = to[0] - from[0], dy = to[1] - from[1], d = Math.hypot(dx, dy), side = hash(s.t0 * 7.3) < .5 ? -1 : 1, bow = d * (s.arc ?? .1) * Math.sin(Math.PI * cl(e)) * side;
        p = [lerp(from[0], to[0], e) - dy / (d || 1) * bow, lerp(from[1], to[1], e) + dx / (d || 1) * bow]; if (u >= 1) from = to; }
      if (s.k === 'click' || s.k === 'tap') {
        if (s.target) { p = point(s.target, s.screen, s.t0); from = p; }
        const tp = t - s.t0; press = Math.max(press, tp < .07 ? tp / .07 : cl(1 - (tp - .07) / .16));
        if (pointerKind === 'touch') a = Math.max(a, tp < 0 ? 0 : tp < .1 ? 1 : cl(1 - (tp - .22) / .18));
      }
      if (s.k === 'drag') {
        const P = s.path, u = ease.sine(seg(t, s.t0, s.t1)), f = u * (P.length - 1), i = Math.min(P.length - 2, Math.floor(f));
        p = [lerp(P[i][0], P[i + 1][0], f - i), lerp(P[i][1], P[i + 1][1], f - i)]; from = p;
        press = Math.max(press, cl((t - s.t0) / .08) * cl((s.t1 + .1 - t) / .1)); if (pointerKind === 'touch') a = Math.max(a, cl((t - s.t0 + .1) / .1) * cl((s.t1 + .25 - t) / .2));
      }
      if (s.k === 'swipe') {                                            // a finger flicking the page: down, up the screen, off
        const [x0, y0] = s.from || [G.W * .55, G.VH * .72], d = s.swipe === 'down' ? 1 : -1, len = s.len ?? G.VH * .32, u = seg(t, s.t0, s.t1);
        p = [x0 + 8 * u, y0 + d * len * ease.out(u)]; if (pointerKind === 'touch') a = Math.max(a, cl((t - s.t0) / .06) * cl((s.t1 - t) / .12));
      }
    }
    if (pointerKind === 'cursor') {
      for (const s of steps) if (s.k === 'pointer' && s.t0 <= t) a = s.pointer ? cl((t - s.t0) / .25) : cl(1 - (t - s.t0) / .25);
      if (first && o.pointerIn !== false && !steps.some(s => s.k === 'pointer' && s.t0 <= t)) a = cl((t - first.t0 + .35) / .3);
      const idle = 1 - moves.reduce((m, s) => Math.max(m, cl(1 - Math.abs(t - (s.t0 + s.t1) / 2) / ((s.t1 - s.t0) / 2 + .3))), 0);
      p = [p[0] + noise(t * .7, 3) * 1.4 * idle, p[1] + noise(t * .6, 9) * 1.1 * idle];
    }
    return { x: p[0], y: p[1], press, a };
  }

  /* --- the camera --- */
  const local = (sx, sy) => [G.sx + sx * G.s, G.sy + (G.top + sy) * G.s];   // screen CSS px → device px
  const BASE = { z: 1, f: [G.dw / 2, G.dh / 2], c: C0, rx: D.rx || 0, ry: D.ry || 0, rz: D.rz || 0, follow: 0 };
  const cams = steps.filter(s => s.k === 'cam');
  function camTarget(s, from) {
    const c = s.cam; if (c === 'reset' || c === 'out') return { ...BASE };
    const T = { ...from };
    if (c.zoom != null) T.z = c.zoom;
    if (c.on === 'device') { T.f = BASE.f; T.c = c.at || BASE.c; }
    else if (c.on != null) { const q = point(c.on, s.screen, s.t1); T.f = local(q[0], q[1]); T.c = c.at || [SW / 2, SH * (c.y ?? .5)]; }
    else if (c.zoom === 1) { T.f = BASE.f; T.c = c.at || BASE.c; }
    else if (c.at) T.c = c.at;
    if (c.tilt) { T.rx = c.tilt[0]; T.ry = c.tilt[1]; T.rz = c.tilt[2] || 0; }
    if (c.follow != null) T.follow = c.follow;
    return T;
  }
  function camAt(t) {
    let st = { ...BASE };
    for (const s of cams) {
      if (s.t0 > t) break;
      const T = camTarget(s, st), e = (s.ease ? ease[s.ease] : ease.io)(seg(t, s.t0, s.t1));
      st = { z: Math.exp(lerp(Math.log(st.z), Math.log(T.z), e)), f: [lerp(st.f[0], T.f[0], e), lerp(st.f[1], T.f[1], e)], c: [lerp(st.c[0], T.c[0], e), lerp(st.c[1], T.c[1], e)],
        rx: lerp(st.rx, T.rx, e), ry: lerp(st.ry, T.ry, e), rz: lerp(st.rz, T.rz, e), follow: lerp(st.follow, T.follow, e) };
    }
    const drift = o.drift ?? (G.kind === 'phone' ? 'hand' : 'camera');
    if (drift === 'camera') { st.rx += noise(t * .13, 1) * .5; st.ry += noise(t * .11, 2) * .6; }   // a held camera breathing
    if (drift === 'hand') { st.rz += noise(t * .21, 1) * .35; st.c = [st.c[0] + noise(t * .17, 2) * short * .003, st.c[1] + noise(t * .15, 3) * short * .004]; }   // a phone held in a hand
    if (D.enter && D.enter !== 'none') {                               // the device coming into the frame at the start
      const u = ease.out5(cl(t / (D.enterDur ?? 1.1)));
      if (D.enter === 'rise') st.c = [st.c[0], st.c[1] + (1 - u) * SH * .9];
      if (D.enter === 'fade') st.alpha = u;
    }
    if (st.follow > 0) {                                               // the camera trailing the pointer
      let ax = 0, ay = 0, wsum = 0; for (let i = 0; i < 16; i++) { const w = 16 - i, q = pointerAt(t - i * .075); ax += q.x * w; ay += q.y * w; wsum += w; }
      const L = local(ax / wsum, ay / wsum), Z = Z0 * st.z; st.f = [lerp(st.f[0], L[0], st.follow), lerp(st.f[1], L[1], st.follow)];
      const keep = (v, a, b) => cl(v, Math.min(a, b), Math.max(a, b));                            // the device fills the frame, or stays whole in it
      st.f[0] = keep(st.f[0], st.c[0] / Z, G.dw - (SW - st.c[0]) / Z); st.f[1] = keep(st.f[1], st.c[1] / Z, G.dh - (SH - st.c[1]) / Z);
    }
    return st;
  }
  const FOCAL = Math.max(SW, SH) * (o.focal ?? (G.kind === 'phone' ? 8 : 2.4));          // a long lens for a phone: no stretched near edge
  function projector(st) {
    const Z = Z0 * st.z, rx = st.rx * Math.PI / 180, ry = st.ry * Math.PI / 180, rz = st.rz * Math.PI / 180;
    const cz = Math.cos(rz), sz = Math.sin(rz), cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
    const raw = (lx, ly) => {
      let X = (lx - st.f[0]) * Z, Y = (ly - st.f[1]) * Z, Zc = 0;
      [X, Y] = [X * cz - Y * sz, X * sz + Y * cz];
      [X, Zc] = [X * cy + Zc * sy, -X * sy + Zc * cy];
      [Y, Zc] = [Y * cx - Zc * sx, Y * sx + Zc * cx];
      const f = FOCAL / (FOCAL + Zc); return [X * f, Y * f, 1 / f];
    };
    return (lx, ly) => { const [x, y, w] = raw(lx, ly); return [st.c[0] + x, st.c[1] + y, w]; };
  }

  /* --- drawing the screen --- */
  function drawShot(c, show, t, x0, y0) {                              // one screen's content at device px (x0, y0) = its top-left
    const sh = show.shot, s = G.s, W = G.W, VH = G.VH;
    let img = sh.img;
    if (sh.video) { const v = sh.video; img = v.cur || img; }
    const sy = sh.full ? scrollOf(show, t) : 0, scale = img.naturalWidth ? img.naturalWidth / sh.w : s;
    c.drawImage(img, 0, sy * scale, sh.w * scale, Math.min(VH, sh.h - sy) * scale, x0, y0, W * s, Math.min(VH, sh.h - sy) * s);
    for (const p of sh.pins || []) c.drawImage(p.img, x0 + p.x * s, y0 + p.y * s, p.w * s, p.h * s);
    // what happens on this screen: presses, typing, the spotlight
    for (const st of steps) {
      if (st.screen !== show || st.t0 > t) continue;
      if ((st.k === 'click' || st.k === 'tap') && st.target && !Array.isArray(st.target)) {
        if (st.press === false) continue;
        const b = boxOf(st.target, show, st.t0), u = t - st.t0, a = u < .06 ? u / .06 : cl(1 - (u - .1) / .25);
        if (a > 0) { c.save(); c.globalAlpha = a * (st.pressAlpha ?? .12); c.fillStyle = lum(b.e.bg) < .4 ? '#fff' : '#000'; rr(c, x0 + b.x * s, y0 + b.y * s, b.w * s, b.h * s, b.r * s); c.fill(); c.restore(); }
      }
      if (st.k === 'type' && st.cover !== false) {
        const b = boxOf(st.type, show, t), e = b.e, chars = [...st.text], n = cl(Math.floor((t - st.t0 - (st.lead ?? .15)) * (st.cps || 13)) + 1, 0, chars.length);
        const ix = 2, pl = st.padL ?? e.padL ?? 10, pt = e.padT || 0, pb = e.padB || 0;              // the text line inside the field: under a floating label, inside the padding
        const fx = x0 + (b.x + Math.max(ix, pl - 3)) * s, fy = y0 + (b.y + Math.max(ix, pt - 1)) * s, fw = (b.w - Math.max(ix, pl - 3) - Math.max(ix, (e.padR || 0) - 3)) * s, fh = (b.h - Math.max(ix, pt - 1) - Math.max(ix, pb - 1)) * s;
        c.save(); rr(c, fx, fy, fw, fh, pt > 6 ? 0 : Math.max(0, b.r - ix) * s); c.clip();
        if (st.erase !== false) { c.fillStyle = st.bg || (e.bg === 'rgba(0, 0, 0, 0)' ? '#fff' : e.bg); c.fillRect(fx, fy, fw, fh); }
        const size = (st.size || e.size || 16) * s, txt = chars.slice(0, n).join('');
        c.font = `${st.weight || e.weight || 400} ${size}px ${st.font || e.font || SANS}`; c.fillStyle = st.color || e.color || '#111'; c.textBaseline = 'middle'; c.textAlign = 'left';
        const tx = x0 + (b.x + pl) * s, ty = y0 + (b.y + pt + (b.h - pt - pb) / 2) * s, tw = c.measureText(txt).width;
        c.fillText(txt, tx, ty);
        const blink = (t - st.t1) < 0 || Math.floor((t - st.t1) * 1.9) % 2 === 0;
        if (blink && st.caret !== false && t < show.end) { c.fillStyle = st.caretColor || '#3478f6'; c.fillRect(tx + tw + 1 * s, ty - size * .62, 2 * s, size * 1.24); }
        c.restore();
      }
      if (st.k === 'spot' && t < st.t1 + .4) {
        const a = Math.min(cl((t - st.t0) / .35), cl((st.t1 + .35 - t) / .35)), b = boxOf(st.spot, show, t), pad = (st.pad ?? 8) * s;
        c.save(); c.globalAlpha = a * (st.dim ?? .55); c.fillStyle = '#000'; c.beginPath(); c.rect(x0, y0, W * s, VH * s);
        rr(c, x0 + b.x * s - pad, y0 + b.y * s - pad, b.w * s + 2 * pad, b.h * s + 2 * pad, b.r * s + pad); c.fill('evenodd'); c.restore();
      }
    }
  }
  function drawScreen(c, t, st) {
    const s = G.s, x0 = G.sx, y0 = G.sy + G.top * s, W = G.W * s, VH = G.VH * s, show = showAt(t), pv = shows[show.idx - 1];
    const u = show.L ? ease.io(seg(t, show.t0, show.t1)) : 1;
    c.save(); c.beginPath(); c.rect(x0, y0, W, VH); c.clip();
    if (u < 1 && pv) {
      const v = show.via;
      if (v === 'fade') { drawShot(c, pv, t, x0, y0); c.globalAlpha = u; drawShot(c, show, t, x0, y0); c.globalAlpha = 1; }
      else if (v === 'push' || v === 'back') {
        const d = v === 'push' ? 1 : -1, under = v === 'push' ? pv : show, over = v === 'push' ? show : pv, k = v === 'push' ? u : 1 - u;
        c.save(); c.translate(-W * .3 * k, 0); drawShot(c, under, t, x0, y0); c.fillStyle = `rgba(0,0,0,${.18 * k})`; c.fillRect(x0, y0, W, VH); c.restore();
        c.save(); c.translate(W * (1 - k), 0); c.shadowColor = 'rgba(0,0,0,.25)'; c.shadowBlur = 30 * s; c.fillStyle = '#fff'; c.fillRect(x0, y0, W, VH); c.shadowColor = 'transparent'; drawShot(c, over, t, x0, y0); c.restore();
      }
      else if (v === 'up' || v === 'down') {
        const k = v === 'up' ? u : 1 - u, under = v === 'up' ? pv : show, over = v === 'up' ? show : pv;
        drawShot(c, under, t, x0, y0); c.fillStyle = `rgba(0,0,0,${.3 * k})`; c.fillRect(x0, y0, W, VH);
        c.save(); c.translate(0, VH * (1 - k)); drawShot(c, over, t, x0, y0); c.restore();
      }
      else if (v === 'zoom') {                                         // an app opening out of the tapped spot
        drawShot(c, pv, t, x0, y0); const q = show.from ? point(show.from, pv, show.t0) : [G.W / 2, G.VH / 2], k = .2 + .8 * u;
        c.save(); c.globalAlpha = cl(u * 1.6); c.translate(x0 + q[0] * s * (1 - k), y0 + q[1] * s * (1 - k)); c.scale(k, k); c.translate(-x0, -y0); drawShot(c, show, t, x0, y0); c.restore();
      }
      else drawShot(c, show, t, x0, y0);
    } else drawShot(c, show, t, x0, y0);
    // the pointer
    const p = pointerAt(t), dark = lum(show.shot.statusColor || '#fff') < .45;
    for (const s2 of steps) {                                           // ripples where it clicked
      if ((s2.k !== 'click' && s2.k !== 'tap') || s2.ripple === false) continue; const tp = t - s2.t0; if (tp < 0 || tp > .6) continue;
      const q = s2.target ? point(s2.target, s2.screen, s2.t0) : (() => { const r = pointerAt(s2.t0); return [r.x, r.y]; })(), e = ease.out(tp / .6);
      c.save(); c.globalAlpha = (1 - e) * .5; c.strokeStyle = s2.rippleColor || (dark ? '#fff' : 'rgba(30,30,40,.9)'); c.lineWidth = 2 * s;
      c.beginPath(); c.arc(x0 + q[0] * s, y0 + q[1] * s, (8 + 26 * e) * s, 0, 7); c.stroke(); c.restore();
    }
    if (pointerKind === 'cursor') { if (p.a > 0) { c.save(); c.globalAlpha = p.a; arrow(c, x0 + p.x * s, y0 + p.y * s, s * csize, p.press); c.restore(); } }
    else touch(c, x0 + p.x * s, y0 + p.y * s, s * (o.fingerSize ?? 1), p.a, p.press, dark);
    c.restore();
    return show;
  }
  function drawDevice(t, st) {
    const c = dc, s = G.s; c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, dcv.width, dcv.height);
    if (G.kind === 'phone') {
      const b = phoneBody(c, G, D);
      c.save(); rr(c, b.ix, b.iy, b.iw, b.ih, b.ir); c.clip();
      const show = drawScreen(c, t, st);
      if (G.bar) statusBar(c, G, G.sx, G.sy, D.statusColor || show.shot.statusColor || '#fff', D);
      // the island and the home bar
      c.fillStyle = '#000'; rr(c, G.sx + (G.W / 2 - 62.5) * s, G.sy + 11 * s, 125 * s, 36.5 * s, 18.25 * s); c.fill();
      const home = D.homeBar ?? (lum(show.shot.statusColor || '#fff') < .45 ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.82)');
      if (home) { c.fillStyle = home; rr(c, G.sx + (G.W / 2 - 67) * s, G.sy + (G.H - 13) * s, 134 * s, 5 * s, 2.5 * s); c.fill(); }
      // light on the glass, moving as the phone turns
      if (D.glare) {
        const k = (st.ry / 25 + st.rx / 40) * .5, g = c.createLinearGradient(b.ix, b.iy, b.ix + b.iw, b.iy + b.ih * .6);
        const m = cl(.35 + k, .05, .9), A = .05 * D.glare; g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(cl(m - .3), 'rgba(255,255,255,0)'); g.addColorStop(m, `rgba(255,255,255,${A})`); g.addColorStop(cl(m + .3), 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(b.ix, b.iy, b.iw, b.ih);
      }
      c.restore();
    } else {
      const x = G.m * s, y = G.m * s, w = G.dw - 2 * x, h = G.dh - 2 * y;
      c.save(); rr(c, x, y, w, h, G.R * s); c.clip(); c.fillStyle = '#fff'; c.fillRect(x, y, w, h);
      if (G.kind === 'browser') browserChrome(c, G, cap0, D);
      drawScreen(c, t, st); c.restore();
      rr(c, x, y, w, h, G.R * s); c.lineWidth = 1 * s; c.strokeStyle = D.theme === 'dark' ? 'rgba(255,255,255,.16)' : 'rgba(0,0,0,.16)'; c.stroke();
    }
  }

  /* --- the stage --- */
  const blurCv = document.createElement('canvas'); blurCv.width = Math.ceil(SW / 24); blurCv.height = Math.ceil(SH / 24);
  function backdrop(c, t) {
    const B = o.backdrop || {}, cols = B.colors || (B.color ? [B.color, B.color] : ['#eceae6', '#d9d6d0']);
    const g = c.createLinearGradient(0, 0, SW * .3, SH); cols.forEach((col, i) => g.addColorStop(i / Math.max(1, cols.length - 1), col)); c.fillStyle = g; c.fillRect(0, 0, SW, SH);
    if (B.glow) { const [gx, gy] = [SW * (.5 + .12 * noise(t * .05, 4)), SH * (.42 + .08 * noise(t * .05, 5))], r = c.createRadialGradient(gx, gy, 0, gx, gy, Math.max(SW, SH) * .6);
      r.addColorStop(0, B.glow); r.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = r; c.fillRect(0, 0, SW, SH); }
    if (B.blur) {                                                       // the screen itself, huge and out of focus behind the device
      const sh = showAt(t).shot, b = blurCv.getContext('2d'), img = sh.video ? sh.video.cur || sh.img : sh.img, iw = img.naturalWidth || img.width, ih = Math.min(img.naturalHeight || img.height, iw * vh(sh) / sh.w);
      const k = Math.max(blurCv.width / iw, blurCv.height / ih); b.imageSmoothingQuality = 'high';
      b.drawImage(img, 0, 0, iw, ih, (blurCv.width - iw * k) / 2, (blurCv.height - ih * k) / 2, iw * k, ih * k);
      c.save(); c.globalAlpha = B.blur; c.imageSmoothingQuality = 'high'; c.filter = `blur(${short * .02}px)`; c.drawImage(blurCv, -SW * .05, -SH * .05, SW * 1.1, SH * 1.1); c.restore();
      if (B.tint) { c.fillStyle = B.tint; c.fillRect(0, 0, SW, SH); }
    }
  }
  function shadow(c, P, Z) {
    const cs = [P(G.m * G.s, G.m * G.s), P(G.dw - G.m * G.s, G.m * G.s), P(G.dw - G.m * G.s, G.dh - G.m * G.s), P(G.m * G.s, G.dh - G.m * G.s)];
    const w = Math.hypot(cs[1][0] - cs[0][0], cs[1][1] - cs[0][1]), S = o.shadow ?? 1; if (!S) return;
    const poly = () => { c.beginPath(); cs.forEach(([x, y], i) => i ? c.lineTo(x + 1e5, y) : c.moveTo(x + 1e5, y)); c.closePath(); };
    c.save();
    [[.06, .18, .03], [.012, .22, .006]].forEach(([blur, a, dy]) => { c.shadowColor = `rgba(0,0,0,${a * S})`; c.shadowBlur = w * blur * 2; c.shadowOffsetX = -1e5; c.shadowOffsetY = w * dy; c.fillStyle = '#000'; poly(); c.fill(); });
    c.restore();
  }

  /* --- callouts and captions, in stage px --- */
  function label(c, text, x, y, o2) {
    const size = o2.size || short * .03, padX = size * .7, padY = size * .45;
    c.font = `${o2.weight || 600} ${size}px ${o2.font || SANS}`; const w = c.measureText(text).width + padX * 2, h = size + padY * 2;
    return { w, h, draw: (bx, by) => { rr(c, bx, by, w, h, o2.radius ?? h / 2); c.fillStyle = o2.bg || '#111'; c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = size * .6; c.shadowOffsetY = size * .15; c.fill(); c.shadowColor = 'transparent';
      c.fillStyle = o2.color || '#fff'; c.textBaseline = 'middle'; c.textAlign = 'left'; c.fillText(text, bx + padX, by + h / 2 + size * .04); } };
  }
  function drawCallout(c, s, t, P) {
    const a = Math.min(cl((t - s.t0) / .3), cl((s.t1 + .3 - t) / .3)); if (a <= 0) return;
    const show = s.screen, b = boxOf(s.callout, show, t), sideX = s.side === 'left' ? 0 : s.side === 'right' ? 1 : .5, sideY = s.side === 'top' ? 0 : s.side === 'bottom' ? 1 : .5;
    const an = P(...local(b.x + b.w * sideX, b.y + b.h * sideY)), e = ease.out(cl((t - s.t0) / .4));
    const L = label(c, s.text, 0, 0, s), gap = s.reach ?? short * .07, dir = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] }[s.side || 'top'];
    let lx = an[0] + dir[0] * gap - (dir[0] < 0 ? L.w : dir[0] > 0 ? 0 : L.w / 2), ly = an[1] + dir[1] * gap - (dir[1] < 0 ? L.h : dir[1] > 0 ? 0 : L.h / 2);
    lx = cl(lx, short * .05, SW - short * .05 - L.w); ly = cl(ly, short * .05, SH - short * .05 - L.h);
    c.save(); c.globalAlpha = a; c.translate(-dir[0] * gap * .25 * (1 - e), -dir[1] * gap * .25 * (1 - e));
    const ex = cl(an[0], lx + L.h / 2, lx + L.w - L.h / 2), ey = cl(an[1], ly + L.h / 2, ly + L.h / 2);
    c.strokeStyle = s.line || s.bg || '#111'; c.lineWidth = short * .0028; c.beginPath(); c.moveTo(an[0], an[1]); c.lineTo(dir[1] ? ex : lx + (dir[0] < 0 ? L.w : 0), dir[1] ? ly + (dir[1] < 0 ? L.h : 0) : ey); c.stroke();
    c.fillStyle = s.line || s.bg || '#111'; c.beginPath(); c.arc(an[0], an[1], short * .009, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = short * .003; c.stroke();
    L.draw(lx, ly); c.restore();
  }
  function drawCaption(c, s, t) {                                      // a caption gives way when the next one comes
    const nx = steps.find(o2 => o2.k === 'caption' && o2 !== s && o2.t0 > s.t0 && (o2.pos || 'top') === (s.pos || 'top') && o2.y === s.y), fo = nx && nx.t0 < s.t1 + .35 ? .22 : .35;
    const end = nx ? Math.min(s.t1, nx.t0 - fo) : s.t1, out = cl((end + fo - t) / fo); if (t < s.t0 || out <= 0) return;
    const size = s.size || short * .062, x = s.x ?? SW / 2, y = s.y ?? SH * (s.pos === 'bottom' ? .86 : SH > SW ? .1 : .12), align = s.align || 'center';
    const lines = String(s.caption).split('\n'), lh = size * 1.12, font = `${s.weight || 700} ${size}px ${s.font || SANS}`;
    const ss = s.subSize || size * .44, subs = s.sub ? String(s.sub).split('\n') : [];
    c.save(); c.textBaseline = 'alphabetic'; c.textAlign = 'left'; c.globalAlpha = out;
    if (s.plate) {                                                      // a plate behind the words, for captions over a busy screen
      c.font = font; let w = Math.max(...lines.map(l => c.measureText(l).width)); c.font = `${s.subWeight || 500} ${ss}px ${s.font || SANS}`; subs.forEach(l => w = Math.max(w, c.measureText(l).width));
      const px = size * .5, top = y - size * .95 - px * .6, bottom = y + (lines.length - 1) * lh + (subs.length ? size * .55 + ss * 1.3 * subs.length : 0) + size * .3 + px * .6;
      const bx = align === 'center' ? x - w / 2 - px : align === 'right' ? x - w - px : x - px, u = ease.out(cl((t - s.t0) / .35));
      c.save(); c.globalAlpha *= u; c.fillStyle = s.plate; c.shadowColor = 'rgba(0,0,0,.12)'; c.shadowBlur = size * .5; c.shadowOffsetY = size * .1; rr(c, bx, top + size * .2 * (1 - u), w + 2 * px, bottom - top, s.plateRadius ?? size * .42); c.fill(); c.restore();
    }
    c.fillStyle = s.color || '#111';
    let wi = 0;
    lines.forEach((line, li) => {
      c.font = font; const words = line.split(' '), sp = c.measureText(' ').width, ws = words.map(w => c.measureText(w).width);
      const total = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1); let wx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
      words.forEach((w, i) => { const u = ease.out(cl((t - s.t0 - wi++ * (s.stagger ?? .045)) / .45)); c.save(); c.globalAlpha *= u; c.fillText(w, wx, y + li * lh + size * .4 * (1 - u)); c.restore(); wx += ws[i] + sp; });
    });
    if (subs.length) { const u = ease.out(cl((t - s.t0 - .25) / .5)); c.globalAlpha = out * u * (s.subAlpha ?? .62); c.font = `${s.subWeight || 500} ${ss}px ${s.font || SANS}`; c.textAlign = align;
      subs.forEach((l, i) => c.fillText(l, x, y + (lines.length - 1) * lh + size * .55 + ss * 1.3 * (i + 1))); }
    c.restore();
  }

  /* --- one frame --- */
  async function prepare(t) {                                          // screen recordings: fetch the frame for t
    for (const sh of new Set([showAt(t).shot, (shows[showAt(t).idx - 1] || {}).shot])) {
      if (!sh || !sh.video) continue; const sw = shows.find(x => x.shot === sh), lt = (t - sw.t0) * (sh.rate || 1) + (sh.from || 0);
      sh.video.cur = await sh.video.get(Math.floor(lt * sh.video.fps + 1e-6));
    }
  }
  function draw(c, t) {
    backdrop(c, t);
    const st = camAt(t), P = projector(st);
    if (o.under) o.under(c, t, { P, cam: st });
    drawDevice(t, st);
    c.save(); c.globalAlpha = st.alpha ?? 1;
    shadow(c, P, st);
    const q = [P(0, 0), P(G.dw, 0), P(G.dw, G.dh), P(0, G.dh)];
    if (gl) { gl.draw(dcv, q); c.drawImage(gl.cv, 0, 0); }
    else { c.save(); c.setTransform((q[1][0] - q[0][0]) / G.dw, (q[1][1] - q[0][1]) / G.dw, (q[3][0] - q[0][0]) / G.dh, (q[3][1] - q[0][1]) / G.dh, q[0][0], q[0][1]); c.drawImage(dcv, 0, 0); c.restore(); }
    c.restore();
    for (const s of steps) { if (s.k === 'callout') drawCallout(c, s, t, P); if (s.k === 'caption') drawCaption(c, s, t); }
  }

  /* --- what you hear --- */
  const sounds = [];
  for (const s of steps) {
    if (s.sound === false) continue; if (s.sound) { sounds.push({ t: s.t0, ...s.sound }); continue; }
    if (s.k === 'click') sounds.push({ t: s.t0 + .03, kind: 'tap', v: .55 }, { t: s.t0 + .14, kind: 'tick', v: .12 });
    if (s.k === 'tap') sounds.push({ t: s.t0 + .03, kind: 'tap', v: .4 });
    if (s.k === 'play' && s.typing) s.play.forEach((_, i) => sounds.push({ t: s.t0 + s.L * i / s.play.length, kind: 'tick', v: .1 + .08 * hash(i, s.t0) }));
    if (s.k === 'type') [...s.text].forEach((ch, i) => sounds.push({ t: s.t0 + (s.lead ?? .15) + i / (s.cps || 13), kind: ch === ' ' ? 'tock' : 'tick', v: .1 + .08 * hash(i, s.t0) }));
    if (s.k === 'show' && s.L && ['push', 'back', 'up', 'down'].includes(s.via)) sounds.push({ t: s.t0, kind: 'swish', v: .3 });
    if (s.k === 'cam' && s.dur !== 0) { const z = s.cam === 'reset' || s.cam === 'out' ? 1 : s.cam.zoom; if (z != null) sounds.push({ t: s.t0, kind: 'whoosh', dur: Math.max(.5, s.L), v: .16 }); }
    if (s.k === 'callout') sounds.push({ t: s.t0 + .05, kind: 'pop', v: .14 });
  }
  const timeline = steps.filter(s => s.k !== 'show' || s.L || s.t0 > 0).map(s => ({ t0: s.t0, t1: s.t1, kind: s.k, text: s.text || s.caption || (typeof s[s.k] === 'string' ? s[s.k] : '') }));
  return { duration, draw, prepare, sounds, timeline, steps, camAt, pointerAt, geometry: G, stage: [SW, SH], project: t => projector(camAt(t)), local };
}

/* ---------- the scene ---------- */
/* window.__scene = Demo.scene(async () => ({ width, height, film, duration?, draw?(c, t, film), music, sounds })) */
function scene(build) {
  const sc = { duration: 0, sounds: [], music: null, lossless: false };
  const Q = new URLSearchParams(location.search), rec = !!Q.get('rec');
  sc.ready = (async () => {
    if (document.fonts) await document.fonts.ready;
    const r = await build(), F = r.film, W = r.width || (F ? F.stage[0] : 1080), H = r.height || (F ? F.stage[1] : 1920);
    const cv = document.querySelector('canvas') || document.body.appendChild(document.createElement('canvas')); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    sc.duration = r.duration || (F && F.duration) || 10; sc.music = r.music || null; sc.sounds = (F ? F.sounds : []).concat(r.sounds || []); sc.timeline = F ? F.timeline : [];
    sc.draw = async t => {
      if (F) await F.prepare(t);
      c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none'; c.clearRect(0, 0, W, H);
      if (F) F.draw(c, t); if (r.draw) { c.save(); r.draw(c, t, F); c.restore(); }
    };
    await sc.draw(0);
    if (!rec) { const t0 = performance.now(); const loop = async () => { await sc.draw(((performance.now() - t0) / 1000) % sc.duration); requestAnimationFrame(loop); }; loop(); }
  })();
  sc.seek = async t => { await sc.ready; await sc.draw(t); };
  return sc;
}

window.Demo = { scene, film, shots, runs, images, footage, arrow, touch, rr, ease, cl, lerp, seg, hash, noise, lum, SANS, MONO };
})();
