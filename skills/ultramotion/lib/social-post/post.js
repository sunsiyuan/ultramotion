/* post.js — a social post drawn on a canvas, as the app shows it: name, handle, badge, time, text, counts.
   Post.card(ctx, post, x, y, { w, scale, theme, u, extra, avatar, tz }) draws it with its top-left at (x, y) and returns its height (after scale).
     post   { name, handle, verified, text, time (ISO), replies, reposts, likes, views }  — as fetch_post.mjs / fetch_replies.mjs save them
     u      0..1, how far the counts have rolled up (1 = the real numbers)
     extra  one line under the card (e.g. the price that day), drawn in theme.accent
     avatar an Image to put in the circle; without one the circle shows the first letter on a gradient
   Post.reply(ctx, text, x, y, { w, scale, theme, mask }) — a compact reply bubble: text only, the author masked
   Post.wrap / Post.kfmt / Post.day are exported for layouts that need to measure first. */
(function () {
  const THEMES = {
    dark: { bg: '#000000', card: '#000000', line: '#2f3336', text: '#e7e9ea', mute: '#71767b', blue: '#1d9bf0', like: '#f91880', accent: '#f7931a' },
    light: { bg: '#ffffff', card: '#ffffff', line: '#cfd9de', text: '#0f1419', mute: '#536471', blue: '#1d9bf0', like: '#f91880', accent: '#d9480f' },
  };
  const FONT = '-apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
  const kfmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n));
  const day = (iso, tz = 'America/New_York') => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz });
  const io = u => u < .5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2;
  function width(ctx, s, size, weight = 400) { ctx.font = `${weight} ${size}px ${FONT}`; return ctx.measureText(s).width; }
  function wrap(ctx, text, size, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      if (!para) { out.push(''); continue; }
      let line = '';
      for (let w of para.split(' ')) {
        const tryL = line ? line + ' ' + w : w; if (width(ctx, tryL, size) <= maxW) { line = tryL; continue; }
        if (line) { out.push(line); line = ''; }
        while (width(ctx, w, size) > maxW) { let k = w.length; while (k > 1 && width(ctx, w.slice(0, k), size) > maxW) k--; out.push(w.slice(0, k)); w = w.slice(k); }   // a word wider than the card breaks
        line = w;
      }
      out.push(line);
    }
    return out;
  }
  function txt(ctx, s, x, y, size, col, weight = 400, align = 'left') { ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = col; ctx.textAlign = align; ctx.fillText(s, x, y); }
  function badge(ctx, x, y, r, col) {
    ctx.fillStyle = col; ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, rr = i % 2 ? r * .82 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = r * .22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - r * .4, y); ctx.lineTo(x - r * .1, y + r * .32); ctx.lineTo(x + r * .45, y - r * .35); ctx.stroke();
  }
  // the four counts as small drawn icons, so they look the same on every machine (no emoji)
  function icon(ctx, kind, x, y, s, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = s * .09; ctx.lineJoin = ctx.lineCap = 'round'; ctx.beginPath();
    if (kind === 'replies') { ctx.ellipse(x, y, s * .45, s * .36, 0, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - s * .2, y + s * .3); ctx.lineTo(x - s * .32, y + s * .5); ctx.lineTo(x, y + s * .34); ctx.stroke(); }
    if (kind === 'reposts') { ctx.moveTo(x - s * .4, y + s * .1); ctx.lineTo(x - s * .4, y - s * .25); ctx.lineTo(x + s * .25, y - s * .25); ctx.moveTo(x + s * .4, y - s * .1); ctx.lineTo(x + s * .4, y + s * .25); ctx.lineTo(x - s * .25, y + s * .25); ctx.stroke(); }
    if (kind === 'likes') { ctx.moveTo(x, y + s * .38); ctx.bezierCurveTo(x - s * .7, y - s * .05, x - s * .35, y - s * .6, x, y - s * .2); ctx.bezierCurveTo(x + s * .35, y - s * .6, x + s * .7, y - s * .05, x, y + s * .38); ctx.stroke(); }
    if (kind === 'views') { for (const [dx, h] of [[-.3, .3], [0, .6], [.3, .45]]) { ctx.moveTo(x + dx * s, y + s * .35); ctx.lineTo(x + dx * s, y + s * .35 - h * s); } ctx.stroke(); }
    ctx.restore();
  }
  function card(ctx, p, x, y, o = {}) {
    const T = THEMES[o.theme || 'dark'], w = o.w || 960, s = o.scale || 1, u = o.u ?? 1, size = o.size || 52;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const lines = wrap(ctx, p.text, size, w - 80), h = 150 + 40 + lines.length * size * 1.23 + 110;
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 28); ctx.fillStyle = T.card; ctx.fill(); ctx.strokeStyle = T.line; ctx.lineWidth = 2; ctx.stroke();
    if (o.avatar) { ctx.save(); ctx.beginPath(); ctx.arc(84, 84, 44, 0, 7); ctx.clip(); ctx.drawImage(o.avatar, 40, 40, 88, 88); ctx.restore(); }
    else { const g = ctx.createLinearGradient(40, 40, 128, 128); g.addColorStop(0, o.avatarA || '#f7931a'); g.addColorStop(1, o.avatarB || '#7b3fe4'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(84, 84, 44, 0, 7); ctx.fill();
      txt(ctx, [...(p.name || '?')][0].toUpperCase(), 84, 101, 46, '#fff', 800, 'center'); }
    txt(ctx, p.name, 148, 78, 38, T.text, 700); if (p.verified !== false) badge(ctx, 148 + width(ctx, p.name, 38, 700) + 26, 66, 17, T.blue);
    txt(ctx, `${p.handle} · ${day(p.time, o.tz)}`, 148, 124, 32, T.mute);
    lines.forEach((l, i) => txt(ctx, l, 40, 220 + i * size * 1.23, size, T.text));
    ['replies', 'reposts', 'likes', 'views'].forEach((k, i) => { const v = (p[k] || 0) * io(u), col = k === 'likes' && u > .99 ? T.like : T.mute, cx = 40 + i * 230;
      icon(ctx, k, cx + 16, h - 62, 30, col); txt(ctx, kfmt(v), cx + 46, h - 50, 32, col); });
    if (o.extra) txt(ctx, o.extra, 40, h + 56, 34, T.accent, 600);
    ctx.restore(); return (h + (o.extra ? 70 : 0)) * s;
  }
  function reply(ctx, text, x, y, o = {}) {
    const T = THEMES[o.theme || 'dark'], w = o.w || 820, s = o.scale || 1, size = o.size || 36;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const lines = wrap(ctx, text, size, w - 120).slice(0, 3), h = 70 + lines.length * size * 1.25;
    ctx.beginPath(); ctx.roundRect(0, 0, w, h, 22); ctx.fillStyle = o.fill || '#16181c'; ctx.fill();
    ctx.fillStyle = T.line; ctx.beginPath(); ctx.arc(46, 46, 22, 0, 7); ctx.fill();
    ctx.fillStyle = T.line; ctx.fillRect(84, 26, 140, 18);                      // the author, masked
    lines.forEach((l, i) => txt(ctx, l, 84, 86 + i * size * 1.25, size, T.text));
    ctx.restore(); return h * s;
  }
  window.Post = { card, reply, wrap, kfmt, day, THEMES };
})();
