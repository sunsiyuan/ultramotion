/* Pier 9 Waterfront as a lit site model, built the way particles.js builds waterTown():
   a river across the front, a long park along the water (lawns, a winding path, trees, a lamp-lit promenade), two piers reaching
   into the river lined with small shops under string lights, a ferry landing (glass terminal, gangway, pontoon, a moored ferry),
   mid-rise homes in rows behind the park, and the grey city around the site. lit = 0 dark model, 1 night. site = true gives only
   the plot's boundary as a line of light. Builds from the waterfront out. */
(function () {
const TAU = Math.PI * 2, { rng, tint } = Particles;
function pierDistrict({ ground = 320, lit = 0, size = 2.2, x = 0, z = 0, seed: ws = 9, site = false } = {}) {
  return (N, seedIn) => {
    const g = rng(ws * 7919 + 5), R = 860;
    const shore = px => -60 + 16 * Math.sin(px / 260 + .8);                                  // z of the water's edge at x (water is at smaller z)
    const outline = (px, pz) => { const a = Math.atan2(pz, px), e = 1 + .16 * Math.sin(2 * a + 1) + .1 * Math.sin(3 * a + 2) + .06 * Math.sin(5 * a); return Math.hypot(px, pz) / (R * e); };
    const dist = (px, pz) => Math.min(1, Math.hypot(px, (pz + 60) * 1.3) / (R * 1.15));
    const parts = [], add = (area, f) => parts.push([area, f]);
    const P = (px, py, pz, nx, ny, nz, m, ml, o) => ({ px, py, pz, nx, ny, nz, m, ml, o });
    if (site) {
      const p = new Float32Array(N * 4), a = new Float32Array(N * 4), o = new Float32Array(N), r = rng(ws + 77);
      for (let k = 0; k < N; k++) { const an = r() * TAU, e = 1.03 * (1 + .16 * Math.sin(2 * an + 1) + .1 * Math.sin(3 * an + 2) + .06 * Math.sin(5 * an)), w = (r() - .5) * 8;
        p.set([Math.cos(an) * (R * e + w) + x, ground - 3, Math.sin(an) * (R * e + w) + z, size * (.8 + r() * .5)], k * 4); a.set([0, 0, 0, 2.6], k * 4); o[k] = an / TAU; }
      return { p, a, o };
    }
    const WOOD = tint('#5a3826'), METAL = tint('#2e3238'), WHITE = tint('#f4f2ee'), WARM = tint('#ffe2b4', 2), DECK = tint('#a8977f');
    const WATER = tint('#0f1622'), LAWN = tint('#33493c'), LEAF = [tint('#2f5a3c'), tint('#3f6b48'), tint('#4c7a52')], BULB = tint('#ffd59a', 3);
    const NEON = ['#ff4fa3', '#3fe6ff', '#ffb43a', '#9dff6a', '#c58bff'];
    const PIERS = [-300, 170], PW = 120, PEND = -470, FX = 580;                          // pier centre lines (x), width, far end (z); ferry landing x
    const onPier = (px, pz) => pz < shore(px) + 4 && pz > PEND - 30 && PIERS.some(c => Math.abs(px - c) < PW / 2 + 4);
    const ball = (cx, cy, cz, rx, ry, rz, col, colLit, o) => add(4.2 * Math.pow(rx * ry * rz, 2 / 3), r => {
      const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u), nx = s * Math.cos(a), ny = u, nz = s * Math.sin(a);
      return P(cx + nx * rx, cy + ny * ry, cz + nz * rz, nx, ny, nz, col, colLit, o); });
    const box = (cx, cz, w, d, y0, h, wall, roof, o, dense = 1) => add((2 * (w + d) * h + w * d) * dense, r => {   // a plain box: walls(u, h, side) → [m, ml]
      const A = 2 * (w + d) * h, f = r() * (A + w * d);
      if (f >= A) { const [m, ml] = roof(r); return P(cx + (r() - .5) * w, ground - y0 - h, cz + (r() - .5) * d, 0, -1, 0, m, ml, o); }
      const s = r() * 2 * (w + d), hy = r() * h; let px, pz, nx = 0, nz = 0, u;
      if (s < w) { px = s - w / 2; pz = -d / 2; nz = -1; u = px; } else if (s < 2 * w) { px = s - w * 1.5; pz = d / 2; nz = 1; u = px; }
      else if (s < 2 * w + d) { px = w / 2; pz = s - 2 * w - d / 2; nx = 1; u = pz; } else { px = -w / 2; pz = s - 2 * w - d * 1.5; nx = -1; u = pz; }
      const [m, ml] = wall(u, hy, nx, nz, r); return P(cx + px, ground - y0 - hy, cz + pz, nx, 0, nz, m, ml, o); });

    // the river: dark water with ripples of light, wide in front of the site
    add(2600 * 1250 * .32, r => { let px, pz; do { px = (r() - .5) * 2600; pz = shore(px) - r() * 1250; } while (onPier(px, pz));
      const near = shore(px) - pz, glint = near < 130 && outline(px, pz) < 1 && Math.abs((px + 2000 + 23) % 46 - 23) < 3.5 - near / 60 && Math.sin(pz * .35 + px) > -.3 && r() < .8 * (1 - near / 130);   // the lamps' light reflected below them   // lights reflected near the bank
      return P(px, ground + 2, pz, 0, -1, 0, WATER, glint ? 2.0 + .25 * r() : WATER, dist(px, pz) * .4); });
    // the embankment and the promenade along the water, with a railing
    add(1900 * 34 * 1.1, r => { const px = (r() - .5) * 1900, f = r(), pz = shore(px) + f * 34; if (outline(px, pz) > 1.02) return P(px, ground + 2, shore(px) - 20, 0, -1, 0, WATER, WATER, 1);
      return P(px, ground - 4, pz, 0, -1, 0, f < .06 ? .95 : .8, f < .06 ? .95 : .8, dist(px, pz) * .5); });
    add(1900 * 8 * .5, r => { const px = (r() - .5) * 1900, pz = shore(px) + 2; let hy = 4 + r() * 8; if (!((px + 2000) % 7 < 1 || hy > 11)) hy = 11.5;
      if (outline(px, pz) > 1 || PIERS.some(c => Math.abs(px - c) < PW / 2) || Math.abs(px - FX) < 14) return P(px, ground + 2, pz - 30, 0, -1, 0, WATER, WATER, 1);
      return P(px, ground - hy, pz, 0, 0, -1, .6, .6, dist(px, pz) * .5); });
    // the park: lawns with a winding path through them, and a street behind
    const PARK1 = 110, path = px => 30 + 22 * Math.sin(px / 170) + 10 * Math.sin(px / 61);
    add(1900 * PARK1 * .9, r => { const px = (r() - .5) * 1900, pz = shore(px) + 34 + r() * (PARK1 - 34 + 60);
      if (outline(px, pz) > 1) return P(px, ground + 2, shore(px) - 20, 0, -1, 0, WATER, WATER, 1);
      const onPath = Math.abs(pz - path(px)) < 8, road = pz > 100;
      return P(px, ground - 1, pz, 0, -1, 0, road ? .3 : onPath ? .72 : LAWN, road ? .3 : onPath ? .78 : LAWN, dist(px, pz) * .6); });
    // trees along the park, and lamps along the promenade
    for (let k = 0; k < 64; k++) { const tx = -880 + k * 28 + (g() - .5) * 14, onPathSide = g(), tz = onPathSide < .5 ? path(tx) - 22 - g() * 14 : path(tx) + 20 + g() * 30, o = dist(tx, tz);
      if (outline(tx, tz) > .95 || Math.abs(tx - FX) < 90 || g() < .25) continue;
      const rr = 15 + g() * 9, th = 26 + g() * 12, col = LEAF[Math.floor(g() * 3)];
      add(th * 12, r => { const an = r() * TAU; return P(tx + Math.cos(an) * 2.5, ground - r() * th, tz + Math.sin(an) * 2.5, Math.cos(an), 0, Math.sin(an), WOOD, WOOD, o); });
      ball(tx, ground - th - rr * .8, tz, rr, rr * .85, rr, col, col, o); }
    for (let lx = -860; lx < 860; lx += 46) { const lz = shore(lx) + 18; if (outline(lx, lz) > .96 || PIERS.some(c => Math.abs(lx - c) < PW / 2 + 6) || Math.abs(lx - FX) < 40) continue; const o = dist(lx, lz);
      add(38 * 6, r => P(lx, ground - r() * 38, lz, 0, 0, -1, METAL, METAL, o));
      add(160, r => { const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u); return P(lx + s * Math.cos(a) * 4.5, ground - 41 + u * 4.5, lz + s * Math.sin(a) * 4.5, 0, 0, 0, .35, 2.6 + .4 * r(), o); }); }
    // the two piers: a timber deck on the water, a row of small shops down the middle, string lights along both edges, a red beacon at the end
    PIERS.forEach((c, pi) => { const z0 = shore(c), L = z0 - PEND, o0 = dist(c, z0);
      add(PW * L * 1.2, r => { const px = c + (r() - .5) * PW, pz = PEND + r() * L, plank = (pz + 2000) % 9 < 1;
        return P(px, ground - 8, pz, 0, -1, 0, plank ? .5 : DECK, plank ? .5 : DECK, Math.min(1, o0 + (z0 - pz) / L * .3)); });
      add(2 * (PW + L) * 10 * .8, r => { const s = r() * 2 * (PW + L), hy = r() * 10; let px, pz, nx = 0, nz = 0;
        if (s < L) { px = c - PW / 2; pz = PEND + s; nx = -1; } else if (s < 2 * L) { px = c + PW / 2; pz = PEND + s - L; nx = 1; } else { px = c + (s - 2 * L - PW) ; pz = PEND; nz = -1; if (px < c - PW / 2) px += PW; }
        return P(px, ground + 2 - hy, pz, nx, 0, nz, .6, .6, Math.min(1, o0 + (z0 - pz) / L * .3)); });
      const shops = 5, sl = (L - 120) / shops;
      for (let s = 0; s < shops; s++) { const cz = z0 - 30 - sl * (s + .5), sw = 62, sd = sl - 26, h = 32, o = Math.min(1, o0 + (s + 1) / shops * .3), neon = NEON[(s + pi * 2) % NEON.length];
        box(c, cz, sw, sd, 8, h, (u, hy, nx, nz, r) => {
          if (hy < 3) return [.55, .55];
          if (hy > h - 7) return nx ? [.15, tint(neon, 2)] : [.9, .9];                    // a sign band along the top of each long side
          const bar = Math.abs(u) > (nx ? sd : sw) / 2 - 2.5 || (u + 400) % 12 < 1.2;
          return bar ? [WOOD, WOOD] : [.3, 2.45 + r() * .2]; }, () => [.9, .9], o);
        add(sw * sd * 1.6, r => { const f = r(), sd2 = r() < .5 ? -1 : 1, ridge = f < .06, eave = f > .94;      // a pitched metal roof, ridge along the pier
          return P(c + sd2 * f * (sw / 2 + 6), ground - 8 - h - 14 * (1 - f), cz + (r() - .5) * (sd + 6), sd2 * .5, -.85, 0, ridge || eave ? .75 : METAL, ridge || eave ? .75 : METAL, o); }); }
      [-1, 1].forEach(sd2 => { const px = c + sd2 * (PW / 2 - 4);
        for (let pz = PEND + 6; pz < z0 - 8; pz += 34) add(30 * 4, r => P(px, ground - 8 - r() * 30, pz, sd2, 0, 0, METAL, METAL, Math.min(1, o0 + (z0 - pz) / L * .3)));
        add(L * 6, r => { const pz = PEND + 6 + r() * (L - 14), f = ((pz - PEND - 6) % 34) / 34, bulb = (f * 7) % 1 < .3;
          return P(px, ground - 8 - 30 + 9 * Math.sin(Math.PI * f), pz, 0, 0, 0, .25, bulb ? BULB : .25, Math.min(1, o0 + (z0 - pz) / L * .3)); }); });
      add(60 * 6, r => P(c, ground - 8 - r() * 60, PEND + 12, 0, 0, -1, METAL, METAL, Math.min(1, o0 + .3)));
      add(220, r => { const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u); return P(c + s * Math.cos(a) * 6, ground - 72 + u * 6, PEND + 12 + s * Math.sin(a) * 6, 0, 0, 0, .35, 3.35, Math.min(1, o0 + .3)); });
    });
    // the ferry landing: a glass terminal on the promenade under a thin white roof, a gangway down to a pontoon, the ferry alongside
    const TZ = shore(FX) + 46, oF = dist(FX, -100);
    box(FX, TZ, 130, 56, 0, 40, (u, hy, nx, nz, r) => { const mull = (u + 400) % 13 < 1.2 || hy > 37; return mull ? [WHITE, WHITE] : [tint('#253038'), r() < .8 ? WARM : tint('#fff1d6', 3)]; }, () => [WHITE, WHITE], oF);
    add(190 * 120 * 2, r => { const px = FX + (r() - .5) * 190, pz = TZ + 30 - r() * 120, below = r() < .5, edge = Math.abs(px - FX) > 92 || pz < TZ - 87;
      return P(px, ground - 46 - (below ? 0 : 4), pz, 0, below ? 1 : -1, 0, WHITE, edge ? tint('#fff4e0', 2) : below ? WARM : WHITE, oF); });
    const GZ0 = shore(FX), GZ1 = -205;
    add(24 * (GZ0 - GZ1) * 2, r => { const f = r(), px = FX + (r() - .5) * 24, pz = GZ0 - f * (GZ0 - GZ1), side = Math.abs(px - FX) > 10.5;
      return P(px, ground - 4 - (side ? 10 * r() : 0) + f * 2, pz, 0, -1, 0, side ? .6 : .8, side ? .6 : .8, oF + .05); });
    box(FX, -228, 200, 46, -2, 8, () => [.85, .85], () => [.8, .8], oF + .08);
    add(200 * 4, r => { const px = FX + (r() - .5) * 196, side = r() < .5 ? -1 : 1, bulb = (px + 400) % 40 < 3;
      return P(px, ground - 6 - 10 * r() * (bulb ? 0 : 1) - (bulb ? 12 : 0), -228 + side * 21, 0, 0, side, METAL, bulb ? BULB : METAL, oF + .08); });
    const BX = FX - 10, BZ = -290, BL = 190, BB = 50, oB = oF + .12;                    // the ferry: a white hull, a band of lit cabin windows, a wheelhouse
    const beam = s => BB / 2 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, Math.abs(s) - .55) / .45, 2)));
    add(BL * 18 * 2.4, r => { const s = r() * 2 - 1, sd = r() < .5 ? -1 : 1, hy = r() * 18, w = beam(s) * (.85 + .15 * hy / 18);
      return P(BX + s * BL / 2, ground + 2 - hy, BZ + sd * w, 0, 0, sd, hy < 5 ? .2 : hy > 15 ? tint('#c23a2c') : WHITE, hy < 5 ? .2 : hy > 15 ? tint('#c23a2c') : WHITE, oB); });
    add(BL * BB * .8, r => { const s = r() * 2 - 1, w = beam(s); return P(BX + s * BL / 2, ground - 16, BZ + (r() * 2 - 1) * w, 0, -1, 0, .8, .8, oB); });
    box(BX - 8, BZ, 130, 38, 16, 22, (u, hy, nx, nz, r) => { const win = hy > 6 && hy < 17 && (u + 400) % 10 > 2; return win ? [.25, 2.4 + .3 * r()] : [WHITE, WHITE]; }, () => [.85, .85], oB);
    box(BX + 22, BZ, 46, 30, 38, 14, (u, hy) => hy > 4 && hy < 11 ? [.25, 2.6] : [WHITE, WHITE], () => [METAL, METAL], oB);
    [[BX - BL / 2 + 6, '#ff3b2a', 3.3], [BX + BL / 2 - 6, '#6dff9a', 0]].forEach(([nx2, hex, m]) => add(140, r => { const u = r() * 2 - 1, a = r() * TAU, s = Math.sqrt(1 - u * u);
      return P(nx2 + s * Math.cos(a) * 4, ground - 30 + u * 4, BZ + s * Math.sin(a) * 4, 0, 0, 0, .35, m || tint(hex, 3), oB); }));
    // mid-rise homes behind the park: rows of five- to eight-storey blocks with a grid of windows, shops on the ground floor of the front row
    const ST = 22;
    for (let row = 0; row < 5; row++) for (let i = -6; i <= 6; i++) {
      const cz = 175 + row * 170 + (g() - .5) * 16, cx = i * 150 + (row % 2) * 60 + (g() - .5) * 20, q = outline(cx, cz);
      if (q > .93 || (q > .8 && g() < .5) || g() < .06) continue;
      const w = 104 + g() * 26, d = 58 + g() * 22, floors = 5 + Math.floor(g() * (row ? 4 : 2)), h = floors * ST + 6, o = dist(cx, cz), seedB = Math.floor(g() * 1000);
      const front = row === 0, terrace = g() < .5;
      box(cx, cz, w, d, 0, h, (u, hy, nx, nz, r) => {
        if (hy > h - 5) return [.85, .85];                                                    // parapet
        if (front && hy < ST && nz < 0) { const bar = (u + 400) % 16 < 1.4 || hy > ST - 3; return bar ? [WOOD, WOOD] : [.3, 2.45 + r() * .2]; }
        const fx = (u + 400) % 15, fy = hy % ST, win = fx > 3 && fx < 12 && fy > 7 && fy < 18, cell = Math.floor((u + 400) / 15) * 7 + Math.floor(hy / ST) * 13 + seedB + (nx * 3 + nz * 5);
        const on = win && ((cell * 2654435761) >>> 0) % 100 < 58;
        if (!win) return fy < 2 ? [.7, .7] : [.9, .9];                                        // slab edges, a little darker
        return [.2, on ? 2.2 + .35 * r() : .2]; },
        r => terrace && r() < .45 ? [LEAF[1], LEAF[1]] : [.55, .55], o, .9);
    }
    // the city around the site: low grey blocks on a street grid, unlit (none in the river)
    for (let i = -22; i <= 22; i++) for (let j = -22; j <= 22; j++) {
      const bx = i * 92 + (g() - .5) * 10, bz = j * 92 + (g() - .5) * 10, q = outline(bx, bz);
      if (q < 1.08 || q > 1.75 || g() < .15 || bz < shore(bx) + 60) continue;
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
Particles.pierDistrict = pierDistrict;
})();
