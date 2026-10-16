/* Flat explainer — Kurzgesagt-style flat illustration, timed to the narration. Canvas 2D, no dependencies.
   The page includes story.js (from story.py), then:

   const X = Flat.create({ width: 1080, height: 1920, sky: '#0e1d4f', scenes: { drop(ctx, u, S) { … }, … } });
   window.__scene = Flat.scene(X, { music, sounds });

   Each scene function draws its frame at local time u (seconds since the scene started); S gives the narration's times.
   Every frame is a pure function of t. */
(function () {
const TAU = Math.PI * 2;
const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
const seg = (t, a, z) => cl((t - a) / (z - a));
const lerp = (a, z, u) => a + (z - a) * u;
const oc = u => 1 - Math.pow(1 - u, 3);
const io = u => u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/* spring in: 0 → 1 with a soft overshoot */
const pop = (t, t0, d = .55) => { const u = cl((t - t0) / d); return u <= 0 ? 0 : u >= 1 ? 1 : 1 - Math.exp(-6.5 * u) * Math.cos(10 * u); };
/* a small loop that never stops: returns -1…1 */
const breathe = (t, speed = 1, seed = 0) => Math.sin(t * speed * 1.7 + seed * 4.1) * .6 + Math.sin(t * speed * 2.9 + seed * 2.3) * .4;

/* colour: parse, mix, and the three tones of a flat shape */
const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, k) => { a = typeof a === 'string' ? rgb(a) : a; b = typeof b === 'string' ? rgb(b) : b; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; };
/* shade: darker and shifted towards blue-violet (never towards black). light: towards warm white */
const shade = (c, k = .28) => mix(mix(c, [40, 30, 120], k * .9), [0, 0, 0], k * .35);
const light = (c, k = .45) => mix(c, [255, 250, 235], k);
/* distance haze: further layers lean towards the sky colour */
const haze = (c, sky, depth) => mix(c, sky, cl(depth));

/* a flat shape with Kurzgesagt's three tones: base, a hard-edged shadow on the side away from the light, a thin highlight.
   path(ctx) traces the shape; light comes from the top-left by default. */
function flat(ctx, path, color, { shadow = .12, highlight = .05, lightDir = [-1, -1], size = 100, base, dark, lit } = {}) {
  const c = typeof color === 'string' ? rgb(color) : color, b = base || c, d = dark || shade(c), l = lit || light(c);
  const [lx, ly] = lightDir, n = Math.hypot(lx, ly) || 1;
  ctx.save(); ctx.beginPath(); path(ctx); ctx.fillStyle = css(d); ctx.fill(); ctx.clip();
  ctx.translate(lx / n * size * shadow, ly / n * size * shadow); ctx.beginPath(); path(ctx); ctx.fillStyle = css(b); ctx.fill();
  if (highlight > 0) { ctx.globalCompositeOperation = 'source-atop'; ctx.translate(-lx / n * size * shadow, -ly / n * size * shadow);
    ctx.save(); ctx.beginPath(); path(ctx); ctx.translate(-lx / n * size * highlight, -ly / n * size * highlight); ctx.beginPath(); ctx.rect(-1e4, -1e4, 2e4, 2e4); path(ctx); ctx.fillStyle = css(l); ctx.fill('evenodd'); ctx.restore(); }
  ctx.restore();
}
const circle = (x, y, r) => c => c.arc(x, y, r, 0, TAU);
const ellipse = (x, y, rx, ry, rot = 0) => c => c.ellipse(x, y, rx, ry, rot, 0, TAU);
const rrect = (x, y, w, h, r) => c => c.roundRect(x, y, w, h, r);
const blob = (x, y, r, wob = .12, seed = 0, n = 9) => c => {                     // a round, slightly uneven shape (clouds, rocks, bushes)
  for (let i = 0; i <= n; i++) { const a = i / n * TAU, rr = r * (1 + wob * (hash(seed * 31 + i % n) - .5) * 2), px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (!i) c.moveTo(px, py); else { const a0 = (i - .5) / n * TAU, r0 = r * (1 + wob * .6); c.quadraticCurveTo(x + Math.cos(a0) * r0, y + Math.sin(a0) * r0, px, py); } }
};
/* light is the only thing drawn with a gradient */
function glow(ctx, x, y, r, color, a = .5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r), c = typeof color === 'string' ? rgb(color) : color;
  g.addColorStop(0, css(c, a)); g.addColorStop(1, css(c, 0)); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
/* repeated but varied: n things scattered with a seed, each with its own size and phase */
function scatter(n, seed, area, fn) { for (let i = 0; i < n; i++) fn(area[0] + hash(seed + i * 3.1) * area[2], area[1] + hash(seed + i * 7.7) * area[3], hash(seed + i * 1.3), i); }
/* ambient specks drifting upward (bubbles, dust, spores) — keeps every shot alive */
function drift(ctx, t, { n = 30, seed = 1, area, color = '#ffffff', alpha = .25, size = [3, 10], speed = 30 } = {}) {
  const [x0, y0, w, h] = area;
  for (let i = 0; i < n; i++) { const r = lerp(size[0], size[1], hash(seed + i)), y = y0 + h - ((hash(seed + i * 2.7) * h + t * speed * (.5 + hash(i) )) % h), x = x0 + hash(seed + i * 5.1) * w + breathe(t, .6, i) * 12;
    ctx.fillStyle = css(rgb(color), alpha * (.5 + hash(i * 9) * .5)); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
}
/* a label tag: rounded plate with a darker lip, like Kurzgesagt's place names */
function tag(ctx, text, x, y, { size = 40, bg = '#ffd23f', fg = '#3a2400', font = FONT, align = 'left', a = 1 } = {}) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha *= a; ctx.font = `700 ${size}px ${font}`;
  const w = ctx.measureText(text).width + size * 1.1, h = size * 1.7, lip = size * .28, x0 = align === 'center' ? x - w / 2 : x;
  ctx.fillStyle = css(shade(rgb(bg), .45)); ctx.beginPath(); ctx.roundRect(x0, y, w, h + lip, size * .35); ctx.fill();
  ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x0, y, w, h, size * .35); ctx.fill();
  ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(text, x0 + size * .55, y + h / 2 + 2); ctx.restore();
}
const FONT = `"PingFang SC", "SF Pro Rounded", "Helvetica Neue", sans-serif`;
const ROUND = `"SF Pro Rounded", "Arial Rounded MT Bold", "PingFang SC", sans-serif`;
/* text that punches in on its word */
function say(ctx, text, x, y, t, t0, { size = 90, color = '#ffffff', font = ROUND, weight = 800, align = 'center', out = Infinity } = {}) {
  const k = pop(t, t0, .5), o = 1 - seg(t, out, out + .3); if (k <= 0 || o <= 0) return;
  ctx.save(); ctx.globalAlpha *= cl(k * 2) * o; ctx.translate(x, y); ctx.scale(.6 + .4 * k, .6 + .4 * k);
  ctx.font = `${weight} ${size}px ${font}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(text, 0, 0); ctx.restore();
}

/* the narration: times of lines and words */
function narration(story) {
  const lines = story.lines, words = lines.flatMap((l, li) => l.words.map(w => ({ ...w, line: li, scene: l.scene })));
  const scene = id => story.scenes.find(s => s.id === id);
  return {
    story, lines, words, scene,
    /* when is this said? the first word (or run of words) matching text, optionally only inside a scene / after a time */
    at(text, { scene: sid, after = -1 } = {}) {
      const pool = words.filter(w => (!sid || w.scene === sid) && w.t0 > after), norm = s => s.toLowerCase().replace(/[\s.,!?;:'"，。！？、；：]/g, '');
      let all = '', owner = []; pool.forEach((w, i) => { const n = norm(w.w); all += n; for (const _ of n) owner.push(i); });
      const k = all.indexOf(norm(text)); if (k >= 0) return pool[owner[k]].t0;
      console.warn('narration: not found', text); return pool.length ? pool[0].t0 : 0;
    },
    line: i => lines[i],
    lineAt: t => lines.findIndex(l => t >= l.t0 && t < l.t1 + .25),
  };
}

/* subtitles: the line being spoken, bottom of the frame, current word brighter */
function subtitles(ctx, S, t, { y, size = 46, width, color = '#ffffff', dim = .55, plate = 'rgba(8,14,40,.55)', font = FONT } = {}) {
  const i = S.lineAt(t); if (i < 0) return; const ln = S.lines[i], W = ctx.canvas.width, maxW = width || W - 140;
  ctx.save(); ctx.font = `600 ${size}px ${font}`; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const text = ln.text.replace(/[，。！？、,.!?]+$/, ''), cjk = /[\u4e00-\u9fff]/.test(text);
  // wrap: by words for Latin text, by characters for Chinese; balance two rows rather than leaving one word alone
  const units = cjk ? [...text] : text.split(/(\s+)/), rows = [['']];
  const fullW = ctx.measureText(text).width, target = fullW > maxW ? Math.min(maxW, fullW / Math.ceil(fullW / maxW) + size) : maxW;
  for (const u of units) { const r = rows[rows.length - 1]; if (ctx.measureText(r[0] + u).width > target && r[0].trim()) rows.push([u.trimStart()]); else r[0] += u; }
  let spoken = 0; for (const w of ln.words) if (t >= w.t0) spoken += w.w.replace(/[^\p{L}\p{N}]/gu, '').length;
  const lh = size * 1.35, yy = (y ?? ctx.canvas.height - 260) - (rows.length - 1) * lh / 2;
  let n = 0;
  rows.forEach(([row], k) => {
    const tw = ctx.measureText(row).width, x0 = (W - tw) / 2, ry = yy + k * lh;
    if (plate) { ctx.fillStyle = plate; ctx.beginPath(); ctx.roundRect(x0 - size * .6, ry - size * .8, tw + size * 1.2, size * 1.6, size * .45); ctx.fill(); }
    let x = x0;
    for (const ch of row) { const letter = /[\p{L}\p{N}]/u.test(ch); ctx.fillStyle = css(rgb(color), n < spoken || !letter ? 1 : dim); ctx.fillText(ch, x, ry); x += ctx.measureText(ch).width; if (letter) n++; }
  });
  ctx.restore();
}

function create(o) {
  const W = o.width || 1080, H = o.height || 1920, story = o.story || window.STORY, S = narration(story);
  const cv = o.canvas || document.querySelector('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d');
  const scenes = story.scenes, X = o.crossfade ?? .45;
  // every shot keeps moving: a slow push-in across the scene (push: how much it grows; scenes that run their own camera opt out with own: [ids])
  const push = o.push ?? .12, own = new Set(o.own || []);
  function frameScene(c, id, u, t) {
    const f = o.scenes[id], sc = story.scenes.find(s => s.id === id), len = sc ? sc.t1 - sc.t0 : 1;
    c.save();
    if (!own.has(id) && push) { const z = 1 + push * io(cl(u / (len + X))); c.translate(W / 2, H * .48); c.scale(z, z); c.translate(-W / 2, -H * .48); }
    if (f) f(c, u, S, t); else { c.fillStyle = o.sky || '#111'; c.fillRect(-W, -H, W * 3, H * 3); }
    c.restore();
  }
  const drawScene = (id, u, t) => frameScene(ctx, id, u, t);
  const buf = document.createElement('canvas'); buf.width = W; buf.height = H; const bctx = buf.getContext('2d');
  function draw(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    const i = Math.max(0, scenes.findIndex(s => t >= s.t0 && t < s.t1)), s = scenes[i] || scenes[scenes.length - 1];
    drawScene(s.id, t - s.t0, t);
    // the next scene dissolves in over the last X seconds of this one; a soft white bloom rides on the dissolve
    const nx = scenes[i + 1], k = nx && (o.cut || {})[nx.id] !== true ? seg(t, nx.t0 - X, nx.t0) : 0;
    if (k > 0) {
      bctx.setTransform(1, 0, 0, 1, 0, 0); bctx.clearRect(0, 0, W, H);
      frameScene(bctx, nx.id, t - nx.t0, t);
      ctx.save(); ctx.globalAlpha = io(k); ctx.drawImage(buf, 0, 0); ctx.restore();
      const b = Math.sin(Math.PI * k) * (o.bloom ?? .35); if (b > 0) { ctx.fillStyle = `rgba(255,252,240,${b})`; ctx.fillRect(0, 0, W, H); }
    }
    if (o.after) { ctx.save(); o.after(ctx, t, S); ctx.restore(); }
  }
  return { draw, S, W, H, ctx, canvas: cv };
}

function scene(X, { music = null, sounds = [], duck = .35 } = {}) {
  const st = X.S.story, Q = new URLSearchParams(location.search);
  const ready = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => X.draw(0));
  const s = { duration: st.duration, ready, seek: async t => { await ready; X.draw(t); }, music, sounds, voice: st.audio, duck,
    timeline: st.scenes.map(sc => ({ t0: sc.t0, t1: sc.t1, kind: 'scene', id: sc.id })) };
  if (!Q.get('rec')) ready.then(() => {
    let au = null; if (st.audio) { au = new Audio(st.audio); }
    const t0 = performance.now(); if (au) au.play().catch(() => {});
    const loop = () => { const t = au && !au.paused ? au.currentTime : ((performance.now() - t0) / 1000) % st.duration; X.draw(t); requestAnimationFrame(loop); }; loop(); });
  return s;
}

window.Flat = { create, scene, flat, circle, ellipse, rrect, blob, glow, scatter, drift, tag, say, subtitles, narration,
  rgb, css, mix, shade, light, haze, pop, breathe, cl, seg, lerp, oc, io, hash, FONT, ROUND, TAU };
})();
