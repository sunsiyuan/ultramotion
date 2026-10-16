/* Karaoke — lyrics that light up as they are sung. Timing from a recording (lyrics.py → timing.json) or from a melody you
   write (Karaoke.score); lines laid out word by word (Chinese character by character); a fill that moves through each
   word at the speed it is sung, with a soft or hard edge, outline and lift; a bouncing ball; pagers for two-row karaoke,
   scrolling lyrics and one-line-at-a-time; count-in dots; photos and footage. Canvas 2D, no dependencies.
   Every frame is a pure function of t.

   const S = Karaoke.create({ width: 1920, height: 1080 });
   const T = await Karaoke.load('timing.json');               // or Karaoke.score({ … })
   window.__scene = Karaoke.scene(S, (ctx, t) => { … }, { duration, music, sounds, ready: [promises] });
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
  in: u => Math.pow(cl(u), 3),
};
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const noise = (x, seed = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1; };
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
const SANS = '"Avenir Next", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif';
const SERIF = '"Baskerville", "Times New Roman", "Songti SC", "Noto Serif CJK SC", serif';
const HEI = '"PingFang SC", "Hiragino Sans GB", "Heiti SC", "Noto Sans CJK SC", sans-serif';
const SONG = '"Songti SC", "STSong", "Noto Serif CJK SC", serif';
const KAI = '"Kaiti SC", "STKaiti", "KaiTi", serif';

function create(o = {}) {
  const W = o.width || 1920, H = o.height || 1080;
  const cv = o.canvas || document.querySelector('canvas') || document.body.appendChild(document.createElement('canvas'));
  cv.width = W; cv.height = H;
  return { W, H, canvas: cv, ctx: cv.getContext('2d') };
}
const offscreen = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ---------- timing ---------- */
/* read lyrics.py's timing.json (works from file:// in the renderer and from a local server) */
function load(url) {
  return new Promise((res, rej) => {
    const x = new XMLHttpRequest(); x.open('GET', url); x.overrideMimeType('application/json');
    x.onload = () => { try { res(timing(JSON.parse(x.responseText))); } catch (e) { rej(e); } };
    x.onerror = () => rej(new Error('cannot load ' + url)); x.send();
  });
}
/* tidy a timing object: every line gets t0/t1/i, every word t0/t1 and its syllables (or itself as one) */
function timing(d) {
  const lines = (d.lines || d).map((l, i) => {
    const words = l.words.map(w => ({ ...w, voice: w.voice ?? l.voice, syl: w.syl && w.syl.length ? w.syl : [{ text: w.text, t0: w.t0, t1: w.t1 }] }));
    return { ...l, i, words, voice: l.voice ?? words[0].voice, t0: l.t0 ?? words[0].t0, t1: l.t1 ?? words[words.length - 1].t1, text: l.text ?? words.map(w => w.text).join('').trim() };
  });
  return { ...d, lines };
}
/* shift a timing to video time: song time s plays at video time s − from + at */
function shift(T, by) {
  const m = x => x + by;
  return { ...T, beats: (T.beats || []).map(m), downbeats: (T.downbeats || []).map(m),
    lines: T.lines.map(l => ({ ...l, t0: m(l.t0), t1: m(l.t1), words: l.words.map(w => ({ ...w, t0: m(w.t0), t1: m(w.t1), syl: w.syl.map(s => ({ ...s, t0: m(s.t0), t1: m(s.t1) })) })) })) };
}
/* a song you write: the melody times the lyrics and also gives the guide notes for the backing.
   o: { bpm, meter = 4, start = 0 (s, where beat 0 is), lines: [[syllable, beats, midi?], …] per line, inst, v, octave = 0, swing }
   syllable: 'word' · 'pea-' (continues into the next syllable of the same word) · '~' (the previous syllable holds on) · '' (a rest).
   A line may start with { at: beat, voice } to pin where it starts and say who sings it; a { voice } inside a line hands the
   following syllables to another voice (duets: 'm', 'f', 'both' or any names). Words and lines carry `voice`; notes carry it too.
   → { lines, notes, beat, bar, at(beat), beats, downbeats, end } */
function score(o) {
  const beat = 60 / o.bpm, meter = o.meter || 4, start = o.start || 0, at = b => start + b * beat;
  let b = 0, voice; const notes = [], lines = [];
  for (const raw of o.lines) {
    const words = []; let word = null, lastSyl = null, lastWord = null, lineVoice;
    for (const item of raw) {
      if (!Array.isArray(item)) {                           // { at, voice }
        if (item.at != null && !words.length) b = item.at;
        if (item.voice !== undefined) { voice = item.voice; if (!words.length) lineVoice = voice; }
        continue;
      }
      const [s, len, m] = item, t0 = at(b), t1 = at(b + len);
      if (m != null && m !== false) notes.push({ t: t0, m: m + 12 * (o.octave || 0), d: (t1 - t0) * .96, inst: o.inst || 'piano', v: o.v ?? .55, voice });
      if (s === '~') { if (lastSyl) { lastSyl.t1 = t1; lastWord.t1 = t1; } }
      else if (s !== '' && s != null) {
        const cont = s.endsWith('-'), txt = cont ? s.slice(0, -1) : s;
        if (!word) { word = { text: '', t0, t1, syl: [], voice }; words.push(word); }
        lastSyl = { text: txt, t0, t1 }; lastWord = word; word.syl.push(lastSyl); word.text += txt; word.t1 = t1;
        if (!cont) { if (!CJK.test(txt)) word.text += ' '; word = null; }
      }
      b += len;
    }
    if (words.length) { words[words.length - 1].text = words[words.length - 1].text.replace(/\s+$/, ''); lines.push({ words, voice: lineVoice ?? words[0].voice }); }
  }
  const T = timing({ lines });
  const end = at(b), beats = [], downbeats = [];
  for (let k = 0; at(k) <= end + 1e-6; k++) { beats.push(at(k)); if (k % meter === 0) downbeats.push(at(k)); }
  return { ...T, notes, beat, bar: beat * meter, meter, at, beats, downbeats, end, bpm: o.bpm };
}
/* the line being sung at t (or the one about to be), and where t is inside it */
function current(T, t) {
  const L = T.lines || T; let i = L.findIndex(l => t < l.t1);
  if (i < 0) i = L.length - 1;
  return { i, line: L[i], sung: t >= L[i].t0 };
}

/* ---------- layout ---------- */
/* lay a line out. o: { font (css family), weight = 700, size, x, y (baseline of the first row), align: left|center|right,
   maxWidth (wrap to two rows, breaking after punctuation if it can), fit (shrink to maxWidth instead of wrapping;
   fit: 'fill' scales the line up or down to exactly maxWidth, for justified stacks),
   tracking (px), leading (× size), hyphen (show syllable breaks as ‘-’), weight, style }
   → { rows: [{ y, x0, x1, units: [{ text, x, w, t0, t1, word, voice, first, last }], words: [{ text, x, w, i, voice }] }],
       size, font, ascent, descent, line }  (word.i = index of the word in the line, word.voice its voice, word.src the timing's
       word itself, carrying any field you added to it) */
function layout(ctx, line, o = {}) {
  if (o.fit && o.maxWidth) {                               // shrink to fit on one row instead of wrapping
    const one = layout(ctx, line, { ...o, fit: false, maxWidth: Infinity });
    if (one.rows[0].width <= o.maxWidth && o.fit !== 'fill') return one;
    return layout(ctx, line, { ...o, fit: false, maxWidth: Infinity, size: Math.floor((o.size || 72) * o.maxWidth / one.rows[0].width) });
  }
  const size = o.size || 72, font = `${o.style || ''} ${o.weight || 700} ${size}px ${o.font || SANS}`.trim();
  ctx.save(); ctx.font = font; ctx.letterSpacing = (o.tracking || 0) + 'px';
  const mw = s => ctx.measureText(s).width;
  const pieces = line.words.map((w, wi) => {
    const shown = o.hyphen && w.syl.length > 1 ? w.syl.map(s => s.text).join('-') + (/\s$/.test(w.text) ? ' ' : '') : w.text;
    const body = shown.replace(/\s+$/, ''), width = mw(body), full = mw(shown);
    let acc = '', units = [];
    w.syl.forEach((s, k) => {
      const before = mw(acc); acc += s.text + (o.hyphen && k < w.syl.length - 1 ? '-' : '');
      const after = k === w.syl.length - 1 ? width : mw(acc);
      units.push({ text: s.text, dx: before, w: after - before, t0: s.t0, t1: s.t1, word: wi, voice: w.voice });
    });
    return { text: body, shown, w: width, adv: full, units, cjk: CJK.test(body), i: wi, voice: w.voice, src: w };
  });
  const m = ctx.measureText(CJK.test(line.text || '') ? '\u56fd' : 'Hd'), ascent = m.actualBoundingBoxAscent, descent = m.actualBoundingBoxDescent;
  ctx.restore();
  const maxW = o.maxWidth || Infinity, rows = [];
  const span = (a, b) => pieces.slice(a, b).reduce((s, p, k, arr) => s + (k === arr.length - 1 ? p.w : p.adv), 0);
  if (span(0, pieces.length) > maxW && pieces.length > 1) {
    // two rows if they fit: break after punctuation if possible, otherwise where the rows come out most even
    let best = null;
    for (let k = 1; k < pieces.length; k++) {
      const a = span(0, k), b = span(k, pieces.length); if (a > maxW || b > maxW) continue;
      const score = Math.abs(a - b) - (/[,\uff0c\u3001;\uff1b:\uff1a.\u3002!\uff01?\uff1f]\s*$/.test(pieces[k - 1].shown) ? maxW * .5 : 0);
      if (!best || score < best[0]) best = [score, k];
    }
    if (best) { rows.push(pieces.slice(0, best[1]), pieces.slice(best[1])); }
    else { let row = [], rw = 0; for (const p of pieces) { if (row.length && rw + p.w > maxW) { rows.push(row); row = []; rw = 0; } row.push(p); rw += p.adv; } if (row.length) rows.push(row); }
  } else rows.push(pieces);
  const lead = (o.leading || 1.25) * size, x = o.x ?? 0, y = o.y ?? 0, align = o.align || 'left';
  const out = rows.map((r, ri) => {
    const width = r.reduce((s, p, k) => s + (k === r.length - 1 ? p.w : p.adv), 0);
    let cx = align === 'center' ? x - width / 2 : align === 'right' ? x - width : x;
    const units = [], words = [];
    for (const p of r) { words.push({ text: p.text, x: cx, w: p.w, i: p.i, voice: p.voice, src: p.src }); for (const u of p.units) units.push({ ...u, x: cx + u.dx }); cx += p.adv; }
    if (units.length) { units[0].first = true; units[units.length - 1].last = true; }
    return { y: y + ri * lead, x0: units.length ? units[0].x : x, x1: cx, width, units, words };
  });
  return { rows: out, size, font, tracking: o.tracking || 0, ascent, descent, line, height: (out.length - 1) * lead + ascent + descent };
}
/* move a laid-out line (for scrolling / sliding) */
const moved = (L, dx, dy) => ({ ...L, rows: L.rows.map(r => ({ ...r, y: r.y + dy, x0: r.x0 + dx, x1: r.x1 + dx, units: r.units.map(u => ({ ...u, x: u.x + dx })), words: r.words.map(w => ({ ...w, x: w.x + dx })) })) });

/* how far the singing has got through each unit: 0 before it, 1 after; linear inside, or shaped by `curve` */
const unitP = (u, t, curve) => { const p = cl((t - u.t0) / Math.max(.04, u.t1 - u.t0)); return curve ? curve(p) : p; };
/* the x of the sung edge on a row at time t (null before the row starts) */
function edgeX(row, t, o = {}) {
  let x = null;
  for (const u of row.units) {
    if (t < u.t0) break;
    x = u.x + u.w * unitP(u, t, o.curve);
  }
  return x;
}

/* ---------- drawing the words ---------- */
/* draw a line in two states, sung and not yet sung, split at the sung edge.
   o.unsung / o.sung: { fill, stroke, strokeWidth, shadow: { color, blur, x, y }, alpha }, or a function (word, row, L) → that,
   to style words by what they are (a rhyme, a name; word.src is the timing word with any field you added)
   o.voices: { name: colour, … } — the sung fill of each word is its voice's colour (any number of singers). A word sung by several
   ('a+b', or an array) takes voices['a+b'] if given, else o.together: a colour for every group, 'split' (default: the singers'
   colours in horizontal bands through the letters, the way DAM shows a duet's chorus) or 'blend' (their colours mixed)
   o.edge: width of the soft edge in px (0 = hard wipe); o.curve: shape of the edge's travel inside a syllable;
   o.lift + o.liftTime: sung words rise by lift px over liftTime s; o.glow: { color, blur } around the syllable being sung */
const TMP = { c: null };
function drawText(c, L, rowsFilter, state, dyOf) {
  c.save(); c.font = L.font; c.letterSpacing = L.tracking + 'px'; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  c.lineJoin = 'round'; c.miterLimit = 2; const a0 = c.globalAlpha;
  for (const r of L.rows) {
    if (rowsFilter && !rowsFilter(r)) continue;
    for (const w of r.words) {
      const st = typeof state === 'function' ? state(w, r, L) || {} : state;
      c.globalAlpha = a0 * (st.alpha ?? 1); c.shadowColor = 'transparent';
      const dy = dyOf ? dyOf(w, r) : 0;
      if (st.shadow) { c.shadowColor = st.shadow.color; c.shadowBlur = st.shadow.blur || 0; c.shadowOffsetX = st.shadow.x || 0; c.shadowOffsetY = st.shadow.y || 0; }
      if (st.stroke && st.strokeWidth) { c.strokeStyle = st.stroke; c.lineWidth = st.strokeWidth * 2; c.strokeText(w.text, w.x, r.y + dy); c.shadowColor = 'transparent'; }
      if (st.fill) { c.fillStyle = st.fill; c.fillText(w.text, w.x, r.y + dy); }
    }
  }
  c.restore();
}
/* the paint for a voice: its colour, or for several singers together a group colour, bands or a blend (see sing) */
const voiceNames = v => Array.isArray(v) ? v : String(v).split('+').map(s => s.trim()).filter(Boolean);
function voicePaint(c, voices, voice, y0, y1, together = 'split') {
  if (voice == null) return null;
  const key = Array.isArray(voice) ? voice.join('+') : voice;
  if (voices[key]) return voices[key];
  const cols = voiceNames(voice).map(n => voices[n]).filter(Boolean);
  if (cols.length < 2) return cols[0] || null;
  if (together !== 'split' && together !== 'blend') return together;
  if (together === 'blend') {
    const rgb = cols.map(h => { const x = document.createElement('canvas').getContext('2d'); x.fillStyle = h; const v = x.fillStyle; return v.startsWith('#') ? [1, 3, 5].map(i => parseInt(v.slice(i, i + 2), 16)) : v.match(/[\d.]+/g).slice(0, 3).map(Number); });
    return `rgb(${[0, 1, 2].map(k => Math.round(rgb.reduce((s, c3) => s + c3[k], 0) / rgb.length))})`;
  }
  const g = c.createLinearGradient(0, y0, 0, y1);
  cols.forEach((col, k) => { g.addColorStop(k / cols.length, col); g.addColorStop((k + 1) / cols.length - 1e-4, col); });
  return g;
}
function sing(c, L, t, o = {}) {
  const W = c.canvas.width, H = c.canvas.height;
  if (!TMP.c || TMP.c.width !== W || TMP.c.height !== H) TMP.c = offscreen(W, H);
  const tc = TMP.c.getContext('2d'), edge = o.edge ?? 0, un = o.unsung || { fill: 'rgba(255,255,255,.4)' }, su = o.sung || { fill: '#fff' };
  const lift = o.lift || 0, lt = o.liftTime || .25;
  // per word: how far it has risen
  const wordLift = (w, r) => {
    if (!lift) return 0;
    const us = r.units.filter(u => u.x >= w.x - 1 && u.x < w.x + w.w); if (!us.length) return 0;
    return -lift * ease.out(seg(t, us[0].t0, us[0].t0 + lt));
  };
  // not yet sung: the whole line (the sung layer covers it)
  const sung = o.voices ? (w, r, L2) => {
    const st = (typeof su === 'function' ? su(w, r, L2) : su) || {};
    const f = voicePaint(c, o.voices, w.voice, r.y - L.ascent, r.y + L.descent * .3, o.together);
    return f ? { ...st, fill: f } : st;
  } : su;
  drawText(c, L, null, un, wordLift);
  for (const r of L.rows) {
    const ex = edgeX(r, t, o); if (ex === null) continue;
    tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, W, H); tc.setTransform(c.getTransform()); tc.globalAlpha = 1;
    drawText(tc, { ...L, rows: [r] }, null, sung, wordLift);
    // keep only what is left of the edge
    tc.globalCompositeOperation = 'destination-in';
    const g = tc.createLinearGradient(ex - edge / 2 - .5, 0, ex + edge / 2 + .5, 0); g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
    tc.fillStyle = g; tc.fillRect(-1e5, -1e5, 2e5, 2e5); tc.globalCompositeOperation = 'source-over';
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
    if (o.glow) {                                          // a glow on the syllable being sung, fading as it ends
      const u = r.units.find(u => t >= u.t0 && t < u.t1 + .25);
      if (u) { c.save(); c.filter = `blur(${o.glow.blur || 18}px)`; c.globalAlpha *= (o.glow.alpha ?? .7) * (1 - seg(t, u.t1, u.t1 + .25)); c.drawImage(TMP.c, 0, 0); c.restore(); }
    }
    c.drawImage(TMP.c, 0, 0); c.restore();
  }
}
/* the syllable being sung (for marks, bouncing, colour changes) */
function active(L, t) {
  for (const r of L.rows) for (const u of r.units) if (t >= u.t0 && t < u.t1) return { row: r, unit: u };
  return null;
}

/* ---------- bouncing ball ---------- */
/* targets: [{ x, y, t }] — where the ball lands (top centre of a syllable) and when that syllable starts.
   Between landings the ball flies an arc that takes `hop` s (or the whole gap if shorter) and is `height` px high
   (scaled with the distance); on a long note it rests. Before the first landing it drops in from `from`. → { x, y, squash } */
function ball(targets, t, o = {}) {
  const hop = o.hop || .42, H = o.height || 90;
  if (!targets.length) return null;
  const i = targets.findIndex(p => p.t > t);
  if (i === 0) {                                   // before the first syllable: fall in
    const p = targets[0], from = o.from || { x: p.x - 160, y: p.y - 2.4 * H }, k = seg(t, p.t - (o.enter || .8), p.t);
    if (k <= 0) return null;
    return { x: lerp(from.x, p.x, k), y: lerp(from.y, p.y, ease.in(k)) - Math.sin(Math.PI * k) * H * .3, squash: 0, a: seg(k, 0, .2) };
  }
  const a = targets[i < 0 ? targets.length - 1 : i - 1], b = i < 0 ? null : targets[i];
  if (!b) { const k = seg(t, a.t, a.t + (o.exit || .6)); return { x: a.x, y: a.y, squash: 0, a: 1 - k }; }
  const d = Math.min(hop, b.t - a.t), k = seg(t, b.t - d, b.t);
  const dist = Math.hypot(b.x - a.x, b.y - a.y), h = H * cl(.45 + dist / 520, .45, 1.25) * cl(d / hop, .5, 1);
  const x = lerp(a.x, b.x, k), y = lerp(a.y, b.y, k) - 4 * h * k * (1 - k);
  const land = Math.min(t - a.t, b.t - t);           // squash a little in the few frames around a landing
  return { x, y, squash: cl(1 - Math.min(t - a.t, 1e9) / .08) * (o.squash ?? .25), a: 1 };
}
/* landing points for every syllable of a laid-out line: top centre, `gap` px above the letters */
const targets = (L, gap = 8) => L.rows.flatMap(r => r.units.map(u => ({ x: u.x + u.w / 2, y: r.y - L.ascent - gap, t: u.t0, unit: u })));

/* ---------- pagers: which lines are on screen ---------- */
/* two-row karaoke: line k sits on row k % rows; it appears as soon as the line before it on the same row has been sung
   (the first pair `lead` s before the singing) and leaves when the next line takes the row; with no line after it on its row
   it stays `linger` s after it is sung.
   A long gap (> `gap` s, e.g. an instrumental) clears the screen; the next pair comes back `lead` s before singing.
   → [{ line, row, i, a (0..1 opacity), enter, leave }] */
function ktv(T, t, o = {}) {
  const L = T.lines || T, rows = o.rows || 2, lead = o.lead ?? 1.6, gapS = o.gap ?? 6, fade = o.fade ?? .25, after = o.after ?? .5;
  const blocks = []; let b = [];
  L.forEach((l, i) => { if (b.length && (l.t0 - L[i - 1].t1 > gapS || (o.sections && l.section !== L[i - 1].section))) { blocks.push(b); b = []; } b.push(i); });
  if (b.length) blocks.push(b);
  const out = [];
  for (const blk of blocks) blk.forEach((i, k) => {
    const l = L[i], prevSame = k >= rows ? L[blk[k - rows]] : null, nextSame = k + rows < blk.length ? L[blk[k + rows]] : null;
    const first = L[blk[0]], last = L[blk[blk.length - 1]];
    const enter = prevSame ? Math.min(prevSame.t1 + after, l.t0 - .3) : first.t0 - lead;
    const leave = nextSame ? Math.min(l.t1 + after, nextSame.t0 - .3) : l === last ? last.t1 + (o.hold ?? 1.2) : Math.max(l.t1 + after, Math.min(last.t1 + (o.hold ?? 1.2), l.t1 + (o.linger ?? 1.5)));
    const a = cl(Math.min((t - enter) / fade, (leave - t) / fade));
    if (a > 0) out.push({ line: l, i, row: k % rows, a, enter, leave, k });
  });
  return out;
}
/* scrolling lyrics: a smooth line index — whole numbers while a line is sung, moving to the next over `move` s
   just before it starts. Draw line j at offset (j − pos) × spacing. */
function scroll(T, t, o = {}) {
  const L = T.lines || T, move = o.move ?? .55;
  let pos = 0;
  for (let j = 1; j < L.length; j++) {
    const s = Math.min(L[j].t0 - (o.early ?? .25), Math.max(L[j - 1].t1, L[j].t0 - move - .25));
    pos += (o.ease || ease.io)(seg(t, s, s + move));
  }
  return pos;
}
/* group lines into pages of `per` lines (a new page also at a section change or a long gap) and say which page shows at t,
   with its fade: → { page: [lines], p (page index), a, enter, leave } */
function pages(T, t, o = {}) {
  const L = T.lines || T, per = o.per || 2, gapS = o.gap ?? 6, pre = o.lead ?? .6, fade = o.fade ?? .3;
  const P = []; let pg = [];
  L.forEach((l, i) => { if (pg.length >= per || (pg.length && (l.t0 - L[i - 1].t1 > gapS || (o.sections && l.section !== L[i - 1].section)))) { P.push(pg); pg = []; } pg.push(l); });
  if (pg.length) P.push(pg);
  for (let p = 0; p < P.length; p++) {
    const enter = P[p][0].t0 - pre, nextEnter = p + 1 < P.length ? P[p + 1][0].t0 - pre : Infinity;
    const leave = Math.min(nextEnter, P[p][P[p].length - 1].t1 + (o.hold ?? 2.5));
    if (t < enter - fade && p === 0) return { page: P[0], p: 0, a: 0, enter, leave, all: P };
    if (t < leave + fade || p === P.length - 1) {
      if (t < enter - fade) return { page: P[p], p, a: 0, enter, leave, all: P };
      return { page: P[p], p, a: cl(Math.min((t - enter + fade) / fade, (leave + fade - t) / fade)), enter, leave, all: P };
    }
  }
}
/* count-in before the first line after a gap: how many of n dots are still lit (n … 1, then 0) */
function countdown(t, firstStart, beat, n = 4) {
  const k = Math.ceil((firstStart - t) / beat);
  return k > n || k <= 0 ? (k > n ? -1 : 0) : k;
}

/* ---------- media ---------- */
const MEDIA = [];
const image = src => { const p = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('cannot load ' + src)); im.src = src; }); MEDIA.push(p); return p; };
/* a video, as frames on disk: render.py extracts clip.mp4 to clip.mp4.frames/ (jpgs + index.js) before rendering */
function footage(src) {
  const dir = src + '.frames';
  const p = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = dir + '/index.js';
    s.onerror = () => rej(new Error(`no frames for ${src}; run: python3 render.py frames ${src}`));
    s.onload = () => {
      const info = window.__frames[dir], cache = new Map();
      const get = i => { i = Math.max(0, Math.min(info.count - 1, i)); if (!cache.has(i)) { const q = new Promise((r2, j2) => { const im = new Image(); im.onload = () => r2(im); im.onerror = j2; im.src = `${dir}/${String(i + 1).padStart(5, '0')}.jpg`; }); cache.set(i, q); if (cache.size > 90) cache.delete(cache.keys().next().value); } return cache.get(i); };
      res({ ...info, duration: info.count / info.fps, frame: t => get(Math.floor(t * info.fps + 1e-6)) });
    };
    document.head.appendChild(s);
  });
  MEDIA.push(p); return p;
}
/* draw an image to fill a box, cropped (cover); fx/fy pick the part kept (0..1), zoom pushes in */
function cover(c, im, { x = 0, y = 0, w = c.canvas.width, h = c.canvas.height, fx = .5, fy = .5, zoom = 1, crop } = {}) {
  let iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, ox = 0, oy = 0;
  if (crop) { ox = crop[0] * iw; oy = crop[1] * ih; iw = (crop[2] - crop[0]) * iw; ih = (crop[3] - crop[1]) * ih; }
  const k = Math.max(w / iw, h / ih) * zoom, sw = w / k, sh = h / k;
  c.drawImage(im, ox + (iw - sw) * fx, oy + (ih - sh) * fy, sw, sh, x, y, w, h);
}
const fonts = list => { const p = Promise.all(list.map(f => document.fonts.load(f).catch(() => null))); MEDIA.push(p); return p; };

/* ---------- finish ---------- */
function vignette(c, amt = .35, color = '0,0,0') {
  const W = c.canvas.width, H = c.canvas.height, g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .25, W / 2, H / 2, Math.hypot(W, H) * .6);
  g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(1, `rgba(${color},${amt})`); c.save(); c.fillStyle = g; c.fillRect(0, 0, W, H); c.restore();
}
/* a band of darkness behind the lyrics so they read over any picture (y0..y1 in px, soft edges) */
function scrim(c, y0, y1, amt = .5, soft = 160, color = '0,0,0') {
  const W = c.canvas.width, g = c.createLinearGradient(0, y0 - soft, 0, y1 + soft);
  const H = y1 - y0 + 2 * soft, a = soft / H, b = 1 - a;
  g.addColorStop(0, `rgba(${color},0)`); g.addColorStop(a, `rgba(${color},${amt})`); g.addColorStop(b, `rgba(${color},${amt})`); g.addColorStop(1, `rgba(${color},0)`);
  c.save(); c.fillStyle = g; c.fillRect(0, y0 - soft, W, H); c.restore();
}

/* ---------- the scene ---------- */
/* draw may be async (footage). opts: { duration, music, sounds, background, ready: [promises], timeline } */
function scene(S, draw, o = {}) {
  const Q = new URLSearchParams(location.search), rec = !!Q.get('rec');
  const frameAt = async t => { const c = S.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; c.fillStyle = o.background || '#000'; c.fillRect(0, 0, S.W, S.H); await draw(c, t, S); };
  const ready = Promise.all([document.fonts ? document.fonts.ready : 0, ...MEDIA, ...(o.ready || [])]).then(() => frameAt(0));
  const s = { duration: o.duration, music: o.music || null, sounds: o.sounds || [], ready, timeline: o.timeline || [], seek: async t => { await ready; await frameAt(t); } };
  if (!rec) ready.then(() => {
    const audio = o.music && o.music.file ? new Audio(o.music.file) : null, from = (o.music && o.music.from) || 0;
    let t0 = performance.now(), busy = false;
    const loop = async () => { const t = ((performance.now() - t0) / 1000) % o.duration; if (!busy) { busy = true; await frameAt(t); busy = false; } requestAnimationFrame(loop); };
    if (audio) { document.addEventListener('click', () => { audio.currentTime = from; audio.play(); t0 = performance.now(); }, { once: true }); }
    loop();
  });
  return s;
}

window.Karaoke = { create, scene, load, timing, shift, score, current, layout, moved, edgeX, sing, voicePaint, voiceNames, active, ball, targets, ktv, scroll, pages, countdown,
  image, footage, cover, fonts, vignette, scrim, ease, cl, seg, lerp, hash, noise, TAU, CJK, SANS, SERIF, HEI, SONG, KAI };
})();
