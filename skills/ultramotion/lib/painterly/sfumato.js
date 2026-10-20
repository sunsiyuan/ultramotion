// Sfumato — Leonardo's touch for lib/painterly: a painting laid in soft strokes with no edges, the way thin glazes are laid.
// Every mark is a soft veil dragged a few lengths along the form, its colour taken from the picture at its own scale; big soft
// strokes first, then smaller, then the finest. Several pictures can be laid one over another (layers), each stroke with the
// moment it is laid and the moment it is lifted again; drifting veils (mist) can move over the still painting, kept to a mask.
// Read GUIDE.md, "Sfumato".
(() => {
  const VS = `#version 300 es
  in vec2 corner; in vec2 c; in vec3 s; in vec4 col; in vec4 mv;
  uniform vec2 view; uniform vec3 cam; uniform float t; uniform vec2 paint;
  out vec2 uv; out vec4 vcol; out vec2 pp;
  void main(){
    float ca=cos(s.z), sa=sin(s.z);
    vec2 cc=c; float a=col.a;
    float grow=1.;
    if(mv.w>0.){ float ph=fract((t+mv.z)/mv.w); a*=sin(3.14159*ph)*sin(3.14159*ph); cc+=mv.xy*mv.w*(ph-.5); }   // a veil drifts while it lives, unseen when it restarts
    else if(mv.w<0.){ float f=-mv.w, q=smoothstep(0.,1.,(t-mv.z)/f); a*=q; if(mv.x>0.) a*=1.-smoothstep(0.,1.,(t-mv.x)/f); grow=1.+.25*(1.-q); }   // laid at mv.z, lifted again at mv.x (if set)
    vec2 q=corner*2.6*grow;
    vec2 p=cc + vec2(ca*q.x*s.x - sa*q.y*s.y, sa*q.x*s.x + ca*q.y*s.y);
    pp=p/paint;
    vec2 v=(p-cam.xy)*cam.z/(view*.5); v.y=-v.y;
    gl_Position=vec4(v,0,1); uv=q; vcol=vec4(col.rgb,a);
  }`;
  const FS = `#version 300 es
  precision highp float; in vec2 uv; in vec4 vcol; in vec2 pp; uniform sampler2D mask; uniform float useMask; uniform float gain; out vec4 o;
  void main(){ if(any(lessThan(pp,vec2(0)))||any(greaterThan(pp,vec2(1)))) discard; float g=exp(-.5*dot(uv,uv)); float m=useMask>.5?texture(mask,pp).r:1.; float a=vcol.a*g*m*gain; o=vec4(vcol.rgb*a,a); }`;

  function blurred(img, W, H, s) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { willReadFrequently: true });
    x.filter = s > .3 ? `blur(${s}px)` : 'none'; x.drawImage(img, 0, 0, W, H); return x.getImageData(0, 0, W, H).data;
  }
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // A layer is one picture laid as strokes. levels: [sigma, alpha, gate, length] — gate 0 = everywhere; >0 = only where this
  // scale adds detail. Each mark is a soft stroke: a seed traced along the form (across the light gradient) for a few sigma,
  // a veil every half sigma, each taking the picture's colour at its own point; the stroke stops where the colour turns.
  // build(L, x, y, sigma, rnd) → { birth, drag, death } lays the strokes one after another (veils follow the drag) and lifts them at death.
  // where: Float32Array W*H of 0..1 — only lay strokes there, fading at its edge.
  function veils(img, W, H, { levels, build, where }) {
    const out = []; let prev = null, t0 = 1e9, t1 = 0;
    for (const [L, [sg, al, gate, len = 4]] of levels.entries()) {
      const B = blurred(img, W, H, Math.max(sg * .55, .01)), sp = Math.max(sg * 1.5, 1.5), lv = [];
      const lum = (i) => .3 * B[i] + .59 * B[i + 1] + .11 * B[i + 2];
      const at = (x, y) => Math.min(H - 2, Math.max(1, Math.round(y))) * W + Math.min(W - 2, Math.max(1, Math.round(x)));
      const idx = (x, y) => at(x, y) * 4;
      const r = Math.max(1, Math.round(sg));
      const grad = (x, y) => [lum(idx(x + r, y)) - lum(idx(x - r, y)), lum(idx(x, y + r)) - lum(idx(x, y - r))];
      for (let y = sp / 2; y < H; y += sp) for (let x = sp / 2; x < W; x += sp) {
        let px = x + (rnd() - .5) * sp, py = y + (rnd() - .5) * sp; const i0 = idx(px, py);
        if (where && where[at(px, py)] < .5) continue;
        if (gate > 0 && prev) { const d = Math.abs(lum(i0) - (.3 * prev[i0] + .59 * prev[i0 + 1] + .11 * prev[i0 + 2])) + .5 * (Math.abs(B[i0] - prev[i0]) + Math.abs(B[i0 + 2] - prev[i0 + 2])); if (rnd() > Math.min(1, (d - gate * .3) / gate)) continue; }
        const b = build ? build(L, px, py, sg, rnd) : { birth: 0, drag: 0 };
        const n = Math.max(2, Math.round(len * (.7 + .6 * rnd()) / .5)), a0 = al * (.75 + .5 * rnd());
        let [gx, gy] = grad(px, py), ang = Math.atan2(gy, gx) + Math.PI / 2; if (Math.hypot(gx, gy) < 2) ang = rnd() * Math.PI;
        let dx = Math.cos(ang), dy = Math.sin(ang);
        for (let k = 0; k < n; k++) {
          const i = idx(px, py), w = where ? where[at(px, py)] : 1;
          if (k > 1 && (Math.abs(lum(i) - lum(i0)) > 18 || w < .05)) break;
          const tb = b.birth + b.drag * k / n, td = b.death ? b.death + (b.dragOut ?? b.drag) * k / n : 0;
          t0 = Math.min(t0, tb); t1 = Math.max(t1, td || 1e9);
          lv.push([tb, px, py, sg * 1.25 * (.9 + .2 * rnd()), sg * .8 * (.9 + .2 * rnd()), Math.atan2(dy, dx), B[i] / 255, B[i + 1] / 255, B[i + 2] / 255, a0 * w, td]);
          [gx, gy] = grad(px, py);
          if (Math.hypot(gx, gy) > 2) { let nx = -gy, ny = gx; const m = Math.hypot(nx, ny); nx /= m; ny /= m; if (nx * dx + ny * dy < 0) { nx = -nx; ny = -ny; } dx = .6 * dx + .4 * nx; dy = .6 * dy + .4 * ny; const mm = Math.hypot(dx, dy); dx /= mm; dy /= mm; }
          px += dx * sg * .5; py += dy * sg * .5; if (px < 0 || py < 0 || px >= W || py >= H) break;
        }
      }
      if (build) lv.sort((a, b) => a[0] - b[0]);
      for (const v of lv) out.push(v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], v[9], v[10], 0, v[0], build ? -.22 : 0);
      prev = B;
    }
    return { data: new Float32Array(out), n: out.length / 13, last: prev, live: [build ? t0 : -1e9, t1 + .3] };
  }

  function create(o) {
    const { width: W, height: H, view = [1080, 1920], layers, after = null } = o;
    const out = document.createElement('canvas'); out.width = view[0]; out.height = view[1]; document.body.appendChild(out);
    out.style.cssText = 'display:block;width:100vw;height:100vh;object-fit:contain;background:#000'; const ctx = out.getContext('2d');
    const cv = document.createElement('canvas'); cv.width = view[0]; cv.height = view[1];
    const gl = cv.getContext('webgl2', { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    const sh = (ty, src) => { const s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(s); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
    const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const U = n => gl.getUniformLocation(pr, n);
    const vao = (data) => {
      const v = gl.createVertexArray(); gl.bindVertexArray(v);
      gl.bindBuffer(gl.ARRAY_BUFFER, quad); let l = gl.getAttribLocation(pr, 'corner'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      for (const [name, size, off] of [['c', 2, 0], ['s', 3, 2], ['col', 4, 5], ['mv', 4, 9]]) { l = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 52, off * 4); gl.vertexAttribDivisor(l, 1); }
      return v;
    };
    const LY = layers.map(l => { const V = veils(l.img, W, H, l); return { ...V, vao: vao(V.data) }; }); const V = LY[0];
    let mist = null, mistN = 0;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    const S = {
      n: LY.reduce((a, l) => a + l.n, 0), colourAt: (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return [V.last[i], V.last[i + 1], V.last[i + 2]]; },
      setMask(canvas) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas); },
      // drifting veils: [{x,y,sx,sy,a,c:[r,g,b],vx,vy,phase,period}]
      setMist(list) { const d = new Float32Array(list.length * 13); list.forEach((m, k) => d.set([m.x, m.y, m.sx, m.sy, m.ang || 0, m.c[0] / 255, m.c[1] / 255, m.c[2] / 255, m.a, m.vx, m.vy, m.phase, m.period], k * 13)); mist = vao(d); mistN = list.length; },
      draw(t, camera, { ground = [20, 16, 8], panel = null, mist: mistGain = 1 } = {}) {
        gl.viewport(0, 0, view[0], view[1]); gl.clearColor(ground[0] / 255, ground[1] / 255, ground[2] / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT);
        if (panel) {   // the bare panel the veils are laid on
          const z = camera.zoom, x0 = Math.round(view[0] / 2 - camera.x * z), y1 = Math.round(view[1] / 2 + camera.y * z);
          gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, view[1] - Math.round(view[1] / 2 + (H - camera.y) * z), Math.round(W * z), Math.round(H * z));
          gl.clearColor(panel[0] / 255, panel[1] / 255, panel[2] / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.disable(gl.SCISSOR_TEST);
        }
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.uniform2f(U('view'), view[0], view[1]); gl.uniform3f(U('cam'), camera.x, camera.y, camera.zoom); gl.uniform1f(U('t'), t); gl.uniform2f(U('paint'), W, H);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U('mask'), 0);
        // the panel: the painting's warm ground under everything
        gl.uniform1f(U('useMask'), 0); gl.uniform1f(U('gain'), 1);
        for (const l of LY) if (t >= l.live[0] && t <= l.live[1]) { gl.bindVertexArray(l.vao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, l.n); }
        if (mist && mistGain > 0) { gl.uniform1f(U('useMask'), 1); gl.uniform1f(U('gain'), mistGain); gl.bindVertexArray(mist); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, mistN); }
        ctx.drawImage(cv, 0, 0); if (after) after(ctx, t);
      },
    };
    return S;
  }
  const load = url => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('cannot load ' + url + ' — open the page through render.py (or a local server), not straight from disk')); i.src = url; });
  // a greyscale picture (white = 1) as a Float32Array W*H — for where: and for setMask (its canvas)
  const mask = async (url, W, H, invert = false) => { const i = await load(url), c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    if (invert) x.filter = 'invert(1)'; x.drawImage(i, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data, a = new Float32Array(W * H); for (let k = 0; k < a.length; k++) a[k] = d[k * 4] / 255; return { a, canvas: c }; };
  // window.__scene for render.py; opened in a browser it plays on its own
  function scene(draw, { duration, music = null, sounds = [] }) {
    const s = { duration, music, sounds, ready: Promise.resolve(), seek: async t => draw(t) };
    if (!new URLSearchParams(location.search).get('rec')) { const t0 = performance.now(); const loop = () => { draw(((performance.now() - t0) / 1000) % duration); requestAnimationFrame(loop); }; loop(); }
    return s;
  }
  const ease = v => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
  window.Sfumato = { create, load, mask, scene, ease, rnd: () => rnd() };
})();
