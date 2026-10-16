/* Fluid — real fluid motion on the GPU (WebGL2), drawn into any 2D canvas. Load after mesh.js.

   Three engines:
   Fluid.sim(o)        a stable-fluids simulation: ink dropped in water, paint swirling, smoke, light in liquid. Sharp edges
                       (MacCormack advection on a full-resolution dye), vortices (vorticity confinement), sinking or rising
                       (gravity / buoyancy), obstacles (a word or a logo the flow goes around), shading with highlights.
                       Deterministic: frame n is always the same picture. It steps frame by frame from 0 and keeps a
                       snapshot every `keep` frames, so seeking any t works (backwards it restarts from the nearest snapshot).
   Fluid.marble(...)   paper marbling (ebru) in closed form: drops of paint spread on the water and push the rest aside, combs
                       and styluses drag it into chevrons, feathers and swirls. Exact at any size, a pure function of t, and it
                       loops when the strokes come and go periodically.
   Fluid.silk(...)     a sheet of satin folding in light: a height field lit with soft diffuse light and crisp specular streaks.
                       Pure function of t; loops.
*/
(function () {
const M = window.Mesh; if (!M) throw new Error('load mesh.js before fluid.js');
const TAU = Math.PI * 2, cl = M.cl;

/* ---------- GL ---------- */
let G = null;
function gl() {
  if (G) return G;
  const c = document.createElement('canvas'), g = c.getContext('webgl2', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false, alpha: true });
  if (!g) throw new Error('WebGL2 is not available');
  if (!g.getExtension('EXT_color_buffer_float')) throw new Error('float render targets are not available');
  g.getExtension('OES_texture_float_linear');
  G = { c, g, progs: new Map(), up: g.createTexture() };
  return G;
}
const VS = '#version 300 es\nvoid main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0,1);}';
const HEAD = '#version 300 es\nprecision highp float;\nprecision highp sampler2D;\nuniform vec2 res;\nout vec4 o;\n';
function prog(fs) {
  const { g, progs } = gl(); if (progs.has(fs)) return progs.get(fs);
  const sh = (type, src) => { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s) + '\n' + src.split('\n').slice(0, 4).join('\n')); return s; };
  const p = g.createProgram(); g.attachShader(p, sh(g.VERTEX_SHADER, VS)); g.attachShader(p, sh(g.FRAGMENT_SHADER, HEAD + fs)); g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
  const U = {}; const n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = g.getActiveUniform(p, i); U[u.name.replace(/\[0\]$/, '')] = { loc: g.getUniformLocation(p, u.name), type: u.type, size: u.size }; }
  const P = { p, U }; progs.set(fs, P); return P;
}
/* run a fragment shader into target (a {fbo, w, h}) or the canvas (null, w, h). textures: { name: tex } bound in order */
function pass(fs, target, uni = {}, w, h) {
  const { g, c } = gl(); const P = prog(fs);
  if (target) { g.bindFramebuffer(g.FRAMEBUFFER, target.fbo); w = target.w; h = target.h; }
  else { g.bindFramebuffer(g.FRAMEBUFFER, null); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } }
  g.viewport(0, 0, w, h); g.useProgram(P.p); let unit = 0;
  uni.res = [w, h];
  for (const k in uni) { const u = P.U[k]; if (!u) continue; const v = uni[k];
    if (u.type === g.SAMPLER_2D) { g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, v.tex || v); g.uniform1i(u.loc, unit++); }
    else if (u.type === g.FLOAT) u.size > 1 ? g.uniform1fv(u.loc, v) : g.uniform1f(u.loc, v);
    else if (u.type === g.FLOAT_VEC2) g.uniform2fv(u.loc, v); else if (u.type === g.FLOAT_VEC3) g.uniform3fv(u.loc, v); else if (u.type === g.FLOAT_VEC4) g.uniform4fv(u.loc, v);
    else if (u.type === g.INT) g.uniform1i(u.loc, v); }
  g.drawArrays(g.TRIANGLES, 0, 3);
}
function target(w, h, fmt = 'RGBA16F') {
  const { g } = gl(); const tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex);
  const type = fmt === 'RGBA32F' ? g.FLOAT : fmt === 'RGBA8' ? g.UNSIGNED_BYTE : g.HALF_FLOAT;
  g.texImage2D(g.TEXTURE_2D, 0, g[fmt], w, h, 0, g.RGBA, type, null);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  const fbo = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, fbo); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
  g.viewport(0, 0, w, h); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
  return { tex, fbo, w, h, fmt };
}
const pair = (w, h, fmt) => { const p = { a: target(w, h, fmt), b: target(w, h, fmt), swap() { [p.a, p.b] = [p.b, p.a]; } }; return p; };
function copy(src, dst) { const { g } = gl(); g.bindFramebuffer(g.READ_FRAMEBUFFER, src.fbo); g.bindFramebuffer(g.DRAW_FRAMEBUFFER, dst.fbo); g.blitFramebuffer(0, 0, src.w, src.h, 0, 0, dst.w, dst.h, g.COLOR_BUFFER_BIT, g.NEAREST); g.bindFramebuffer(g.READ_FRAMEBUFFER, null); g.bindFramebuffer(g.DRAW_FRAMEBUFFER, null); }
function free(t) { const { g } = gl(); g.deleteTexture(t.tex); g.deleteFramebuffer(t.fbo); }
/* upload an image / canvas into a texture (flipped so uv y=0 is the bottom of the picture) */
function upload(src) {
  const { g } = gl(); const tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
  g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
  return tex;
}
const toLin = c => (c /= 255) <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
const rgb = hex => { hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.replace(/./g, '$&$&'); return [0, 2, 4].map(i => toLin(parseInt(hex.slice(i, i + 2), 16))); };
function blit(ctx, o = {}) {
  const [x, y, w, h] = o.rect || [0, 0, ctx.canvas.width, ctx.canvas.height];
  ctx.save(); ctx.globalAlpha *= o.a ?? 1; if (o.blend) ctx.globalCompositeOperation = o.blend; ctx.drawImage(gl().c, x, y, w, h); ctx.restore();
}

const GLSL = `
float uh(vec2 p, float f, float k){ uvec3 v = uvec3(uint(p.x), uint(p.y), uint(f) * 3u + uint(k)); v = v * 1664525u + 1013904223u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; v ^= v >> 16u; v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y; return float(v.x) / 4294967295.; }
vec3 toSrgb(vec3 r){ r = clamp(r, 0., 1.); return mix(12.92 * r, 1.055 * pow(r, vec3(1. / 2.4)) - .055, step(.0031308, r)); }
vec3 dither(vec3 c, float fr){ vec2 g = floor(gl_FragCoord.xy); return c + (uh(g, fr, 0.) + uh(g, fr, 1.) - 1.) / 255.; }
vec3 h33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx) * 2. - 1.; }
float gnoise(vec3 p){ vec3 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
  return mix(mix(mix(dot(h33(i), f), dot(h33(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x), mix(dot(h33(i + vec3(0,1,0)), f - vec3(0,1,0)), dot(h33(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(h33(i + vec3(0,0,1)), f - vec3(0,0,1)), dot(h33(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x), mix(dot(h33(i + vec3(0,1,1)), f - vec3(0,1,1)), dot(h33(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z); }
`;

const CR = `
vec4 cr(sampler2D t, vec2 uv, vec2 ts){                                              // Catmull-Rom: sharper than bilinear, 9 taps
  vec2 sp = uv / ts, t1 = floor(sp - .5) + .5, f = sp - t1;
  vec2 w0 = f * (-.5 + f * (1. - .5 * f)), w1 = 1. + f * f * (-2.5 + 1.5 * f), w2 = f * (.5 + f * (2. - 1.5 * f)), w3 = f * f * (-.5 + .5 * f);
  vec2 w12 = w1 + w2, p0 = (t1 - 1.) * ts, p3 = (t1 + 2.) * ts, p12 = (t1 + w2 / w12) * ts;
  return texture(t, vec2(p0.x, p0.y)) * w0.x * w0.y + texture(t, vec2(p12.x, p0.y)) * w12.x * w0.y + texture(t, vec2(p3.x, p0.y)) * w3.x * w0.y
       + texture(t, vec2(p0.x, p12.y)) * w0.x * w12.y + texture(t, vec2(p12.x, p12.y)) * w12.x * w12.y + texture(t, vec2(p3.x, p12.y)) * w3.x * w12.y
       + texture(t, vec2(p0.x, p3.y)) * w0.x * w3.y + texture(t, vec2(p12.x, p3.y)) * w12.x * w3.y + texture(t, vec2(p3.x, p3.y)) * w3.x * w3.y;
}`;

/* ================= the simulation ================= */
const SIM = {
advect: `uniform sampler2D vel, src, obst; uniform vec2 vt; uniform float dt, decay, hasObst;
void main(){ vec2 uv = gl_FragCoord.xy / res; vec2 p = uv - dt * texture(vel, uv).xy * vt;
  vec4 r = texture(src, p) / (1. + decay * dt); if (hasObst > .5) r *= 1. - texture(obst, uv).r; o = r; }`,
hat: `uniform sampler2D vel, src; uniform vec2 vt, st; uniform float dt;
${CR}
void main(){ vec2 uv = gl_FragCoord.xy / res; o = max(cr(src, uv - dt * texture(vel, uv).xy * vt, st), 0.); }`,
mac: `uniform sampler2D vel, src, hat, obst; uniform vec2 vt, st; uniform float dt, decay, hasObst;
${CR}
void main(){ vec2 uv = gl_FragCoord.xy / res; vec2 v = dt * texture(vel, uv).xy * vt;
  vec4 h = texture(hat, uv), bar = cr(hat, uv + v, st), r = h + .5 * (texture(src, uv) - bar);
  vec2 c = (uv - v) / st - .5, f = (floor(c) + .5) * st;
  vec4 a = texture(src, f), b = texture(src, f + vec2(st.x, 0.)), cc = texture(src, f + vec2(0., st.y)), d = texture(src, f + st);
  r = clamp(r, min(min(a, b), min(cc, d)), max(max(a, b), max(cc, d)));
  r /= 1. + decay * dt; if (hasObst > .5) r *= 1. - texture(obst, uv).r; o = max(r, 0.); }`,
splat: `uniform sampler2D src; uniform vec2 pt, asp; uniform vec4 val; uniform float r, kind, hard, grain, gfreq, gseed;
${GLSL}
void main(){ vec2 uv = gl_FragCoord.xy / res; vec2 d = (uv - pt) * asp; float q = dot(d, d) / (r * r);
  float g = hard > 0. ? 1. - smoothstep(1. - hard, 1., sqrt(q)) : exp(-q);
  if (grain > 0.) g *= max(0., 1. + grain * 2. * (gnoise(vec3(uv * asp * gfreq, gseed)) + .5 * gnoise(vec3(uv * asp * gfreq * 2.3, gseed + 5.))));
  vec4 b = texture(src, uv);
  if (kind < .5) o = b + val * g;                                                     // add (velocity, ink, light)
  else if (kind < 1.5) { vec2 tg = vec2(-d.y, d.x) / max(r, 1e-4); o = b + vec4(tg * val.x * g, 0., 0.); }   // swirl
  else { float a = clamp(g * val.a, 0., 1.); o = b * (1. - a) + vec4(val.rgb, 1.) * a; } }`,           // paint: lays colour over (premultiplied)
force: `uniform sampler2D vel, dye; uniform float dt, grav, turb, tscale, tt, seed, paint; uniform vec2 asp;
${GLSL}
void main(){ vec2 uv = gl_FragCoord.xy / res; vec4 v = texture(vel, uv);
  vec4 dd = texture(dye, uv); float m = paint > .5 ? dot(dd.rgb, vec3(.333)) : dd.a; v.y -= dt * grav * m;
  if (turb > 0.) { vec2 p = uv * asp * tscale; float e = .02;
    float n0 = gnoise(vec3(p, tt + seed)), nx = gnoise(vec3(p + vec2(e, 0.), tt + seed)), ny = gnoise(vec3(p + vec2(0., e), tt + seed));
    v.xy += dt * turb * vec2(ny - n0, -(nx - n0)) / e; }
  o = v; }`,
curl: `uniform sampler2D vel; uniform vec2 vt;
void main(){ vec2 uv = gl_FragCoord.xy / res;
  float L = texture(vel, uv - vec2(vt.x, 0.)).y, R = texture(vel, uv + vec2(vt.x, 0.)).y, T = texture(vel, uv + vec2(0., vt.y)).x, B = texture(vel, uv - vec2(0., vt.y)).x;
  o = vec4(.5 * (R - L - T + B), 0., 0., 1.); }`,
vort: `uniform sampler2D vel, cu; uniform vec2 vt; uniform float dt, k;
void main(){ vec2 uv = gl_FragCoord.xy / res;
  float L = texture(cu, uv - vec2(vt.x, 0.)).x, R = texture(cu, uv + vec2(vt.x, 0.)).x, T = texture(cu, uv + vec2(0., vt.y)).x, B = texture(cu, uv - vec2(0., vt.y)).x, C = texture(cu, uv).x;
  vec2 f = .5 * vec2(abs(T) - abs(B), abs(R) - abs(L)); f /= length(f) + 1e-4; f *= k * C; f.y *= -1.;
  vec4 v = texture(vel, uv); v.xy += f * dt; v.xy = clamp(v.xy, -2000., 2000.); o = v; }`,
div: `uniform sampler2D vel, obst; uniform vec2 vt; uniform float hasObst;
float s(vec2 p){ return hasObst > .5 ? texture(obst, p).r : 0.; }
void main(){ vec2 uv = gl_FragCoord.xy / res; vec2 C = texture(vel, uv).xy;
  float L = texture(vel, uv - vec2(vt.x, 0.)).x, R = texture(vel, uv + vec2(vt.x, 0.)).x, T = texture(vel, uv + vec2(0., vt.y)).y, B = texture(vel, uv - vec2(0., vt.y)).y;
  if (uv.x - vt.x < 0.) L = -C.x; if (uv.x + vt.x > 1.) R = -C.x; if (uv.y + vt.y > 1.) T = -C.y; if (uv.y - vt.y < 0.) B = -C.y;
  L *= 1. - s(uv - vec2(vt.x, 0.)); R *= 1. - s(uv + vec2(vt.x, 0.)); T *= 1. - s(uv + vec2(0., vt.y)); B *= 1. - s(uv - vec2(0., vt.y));
  o = vec4(.5 * (R - L + T - B), 0., 0., 1.); }`,
scale: `uniform sampler2D src; uniform float k; void main(){ o = texture(src, gl_FragCoord.xy / res) * k; }`,
down: `uniform sampler2D src; uniform vec2 st; void main(){ vec2 uv = gl_FragCoord.xy / res;   // average a 4 × 4 block
  o = .25 * (texture(src, uv + st * vec2(-1., -1.)) + texture(src, uv + st * vec2(1., -1.)) + texture(src, uv + st * vec2(-1., 1.)) + texture(src, uv + st * vec2(1., 1.))); }`,
jacobiC: `uniform sampler2D p, dv; uniform vec2 vt; uniform float k2;
void main(){ vec2 uv = gl_FragCoord.xy / res;
  float s = texture(p, uv - vec2(vt.x, 0.)).x + texture(p, uv + vec2(vt.x, 0.)).x + texture(p, uv + vec2(0., vt.y)).x + texture(p, uv - vec2(0., vt.y)).x;
  o = vec4((s - k2 * texture(dv, uv).x) * .25, 0., 0., 1.); }`,
jacobi: `uniform sampler2D p, dv, obst; uniform vec2 vt; uniform float hasObst;
void main(){ vec2 uv = gl_FragCoord.xy / res; float C = texture(p, uv).x;
  vec2 q[4] = vec2[](uv - vec2(vt.x, 0.), uv + vec2(vt.x, 0.), uv + vec2(0., vt.y), uv - vec2(0., vt.y)); float s = 0.;
  for (int i = 0; i < 4; i++) { float n = texture(p, q[i]).x; if (hasObst > .5) n = mix(n, C, texture(obst, q[i]).r); s += n; }
  o = vec4((s - texture(dv, uv).x) * .25, 0., 0., 1.); }`,
grad: `uniform sampler2D p, vel, obst; uniform vec2 vt; uniform float hasObst;
void main(){ vec2 uv = gl_FragCoord.xy / res;
  float L = texture(p, uv - vec2(vt.x, 0.)).x, R = texture(p, uv + vec2(vt.x, 0.)).x, T = texture(p, uv + vec2(0., vt.y)).x, B = texture(p, uv - vec2(0., vt.y)).x;
  vec4 v = texture(vel, uv); v.xy -= .5 * vec2(R - L, T - B); if (hasObst > .5) v.xy *= 1. - texture(obst, uv).r;
  if (uv.x < vt.x || uv.x > 1. - vt.x) v.x = 0.; if (uv.y < vt.y || uv.y > 1. - vt.y) v.y = 0.;                     // closed tank: nothing flows through the walls
  o = v; }`,
load: `uniform sampler2D img; uniform sampler2D src; uniform float mode, amt, mass, keep, grain, gfreq; uniform vec2 asp;
${GLSL}
void main(){ vec2 uv = gl_FragCoord.xy / res; vec4 c = texture(img, uv); vec3 l = pow(c.rgb, vec3(2.2)); vec4 b = texture(src, uv) * keep;
  if (grain > 0.) c.a *= max(0., 1. + grain * 2. * (gnoise(vec3(uv * asp * gfreq, 1.)) + .5 * gnoise(vec3(uv * asp * gfreq * 2.3, 6.))));
  if (mode < .5) o = b + vec4(-log(max(l, vec3(.003))) * amt, mass) * c.a;          // ink: the picture's colour as pigment
  else if (mode < 1.5) o = b + vec4(l * amt, mass) * c.a;                              // light
  else o = b * (1. - c.a) + vec4(l, 1.) * c.a; }`,                                     // paint
mask: `uniform sampler2D img; uniform float soft; void main(){ vec2 uv = gl_FragCoord.xy / res; o = vec4(texture(img, uv).a, 0., 0., 1.); }`,
show: `uniform sampler2D dye, obst; uniform vec2 dt_; uniform vec3 bg, bg2, light; uniform float mode, shade, spec, shine, gain, fr, hasObst, edge, gamma, vign;
${GLSL}
vec3 col(vec4 d){
  if (mode < .5) return exp(-d.rgb * gain);                                            // ink: transmittance (multiplied with the ground)
  if (mode < 1.5) return 1. - exp(-d.rgb * gain);                                      // light: added to the ground
  return d.rgb; }
float ht(vec2 uv){ vec4 d = texture(dye, uv); return mode < .5 ? dot(d.rgb, vec3(.33)) : mode < 1.5 ? dot(1. - exp(-d.rgb * gain), vec3(.33)) * 3. : d.a * .6 + dot(d.rgb, vec3(.5)); }
void main(){
  vec2 uv = gl_FragCoord.xy / res; vec4 d = texture(dye, uv);
  vec3 ground = mix(bg2, bg, smoothstep(0., 1., uv.y));
  vec3 c;
  if (mode < .5) c = ground * col(d);
  else if (mode < 1.5) c = ground + col(d);
  else c = ground * (1. - clamp(d.a, 0., 1.)) + d.rgb * gain;
  if (shade > 0. || spec > 0.) {
    float e = 1.5; vec2 t = dt_ * e;
    float hl = ht(uv - vec2(t.x, 0.)), hr = ht(uv + vec2(t.x, 0.)), hb = ht(uv - vec2(0., t.y)), hu = ht(uv + vec2(0., t.y));
    vec3 n = normalize(vec3((hl - hr) * edge, (hb - hu) * edge, 1.));
    vec3 L = normalize(light), V = vec3(0., 0., 1.), H = normalize(L + V);
    float df = clamp(dot(n, L), 0., 1.), lam = clamp(dot(vec3(0., 0., 1.), L), .05, 1.);
    float amtv = clamp(ht(uv) * 2., 0., 1.);
    c *= mix(1., df / lam, shade * amtv);
    c += spec * pow(max(dot(n, H), 0.), shine) * amtv;
  }
  vec2 q = uv - .5; c *= 1. - vign * dot(q, q) * 1.8;
  c = pow(max(c, 0.), vec3(gamma));
  o = vec4(dither(toSrgb(c), fr), 1.);
}`,
};

/* a simulation.
   o: width, height    the picture size in px (the dye has this many cells × dye)
      res              cells on the short side of the velocity grid (default 256; bigger = finer eddies, slower)
      dye              dye resolution as a share of the picture (default 1 — full resolution, sharp edges)
      fps, substeps    frames per second of the video (30) and simulation steps per frame (2)
      mode             'ink'   pigment in water on a light ground: colours multiply, mixing yellow and blue gives green
                       'light' glowing colour on a dark ground: colours add (smoke lit from inside, light in liquid)
                       'paint' opaque colour laid over colour (oil, acrylic, liquid paint): the newest covers
      curl             vorticity confinement — how hard eddies are kept alive (0 smooth · 15 lively · 40 turbulent)
      pressure         solver iterations on the fine grid (default 30; a coarse grid takes care of the large scale)
      viscosity        how fast motion dies out (velocity decay per second, default .2); a number or a function of t
      fade             how fast colour fades (dye decay per second, default 0 — ink never disappears); a number or a function of t
                       (light that dies away after a moment, water that settles: fade: t => t < 6 ? .1 : 1.2)
      gravity          dye with mass sinks (> 0, ink in water) or rises (< 0, smoke, warm light), in cells/s² per unit of mass
      turbulence       { amount, scale, speed } a slow, deterministic stirring of the whole tank by a noise current
      keep             a snapshot every this many frames (default 30) — seeking backwards restarts from the nearest one
      start(F)         called once before frame 0: load a picture as dye (F.load), set obstacles (F.obstacle), drop colour
      step(F, t, dt)   called every simulation step: F.drop(...), F.pour(...), F.swirl(...), F.push(...) — a function of t only
   The returned F: F.at(t) brings the simulation to frame round(t × fps); F.draw(ctx, look) draws it. */
function sim(o = {}) {
  const W = o.width || 1080, H = o.height || 1920, short = Math.min(W, H);
  const res = o.res || 256, sw = Math.round(res * W / short), sh = Math.round(res * H / short);
  const dk = o.dye ?? 1, dw = Math.round(W * dk), dh = Math.round(H * dk);
  const fps = o.fps || 60, sub = o.substeps || 1, keep = o.keep || 60;
  const mode = { ink: 0, light: 1, paint: 2 }[o.mode || 'ink'];
  const vel = pair(sw, sh, 'RGBA32F'), prs = pair(sw, sh, 'RGBA32F'), dv = target(sw, sh, 'RGBA32F'), cu = target(sw, sh, 'RGBA32F');
  const cw = Math.ceil(sw / 4), ch = Math.ceil(sh / 4), dvC = target(cw, ch, 'RGBA32F'), prsC = pair(cw, ch, 'RGBA32F');   // a coarse grid for the large-scale pressure
  const dye = pair(dw, dh), hat = target(dw, dh);
  let obD = null, obV = null;
  const vt = [1 / sw, 1 / sh], st = [1 / dw, 1 / dh], asp = [W / short, H / short];
  const snaps = new Map(); let cur = -1;
  const F = { W, H, fps, mode: o.mode || 'ink', frame: () => cur };

  const xy = (x, y) => [x, 1 - y];                                                      // screen (y down, 0..1) → uv
  const toCells = (vx, vy) => [vx * res, -vy * res];                                    // short-sides per second → cells per second
  let nsplat = 0;
  function splatTo(p, x, y, r, val, kind = 0, hard = 0, grain = 0, gfreq = 60) { pass(SIM.splat, p.b, { src: p.a, pt: xy(x, y), asp, r, val, kind, hard, grain, gfreq, gseed: (nsplat++ % 977) * .173 }); p.swap(); }
  function pigment(c, amount) {                                                          // the colour a dye cell carries for `amount` of colour c
    const l = rgb(c);
    if (mode === 0) return [...l.map(v => -Math.log(Math.max(v, .003)) * amount), amount];
    if (mode === 1) return [...l.map(v => v * amount), amount];
    return [...l, amount];
  }
  /* colour and/or a push at a point, once.  { x, y (0..1 of the frame), r (share of the short side, .01 fine – .2 broad), color, amount,
     vx, vy (push, short-sides per second), mass (default amount; what gravity pulls on), hard (0 soft gaussian · .1 a disc with a crisp edge) } */
  F.drop = d => {
    const r = d.r ?? .05;
    if (d.vx || d.vy) splatTo(vel, d.x, d.y, r * (d.pushR ?? 1.4), [...toCells(d.vx || 0, d.vy || 0), 0, 0]);
    if (d.color) { const pg = pigment(d.color, d.amount ?? 1); if (d.mass != null && mode !== 2) pg[3] = d.mass; splatTo(dye, d.x, d.y, r, pg, mode === 2 ? 2 : 0, d.hard || 0, d.grain ?? o.grain ?? .35, d.grainSize ?? o.grainSize ?? 60); }
  };
  /* the same, but per second (call it every step while it flows: a stream of ink, a jet of paint) */
  F.pour = (d, dt) => F.drop({ ...d, amount: (d.amount ?? 1) * dt, mass: d.mass != null ? d.mass * dt : undefined, vx: (d.vx || 0) * dt * (d.kick ?? 8), vy: (d.vy || 0) * dt * (d.kick ?? 8) });
  /* a vortex: turns the water around (x, y); spin > 0 counter-clockwise on screen, in short-sides per second at radius r.
     With dt (call it every step) spin is an acceleration: it adds spin × dt each step. Without dt it is one kick. */
  F.swirl = ({ x, y, r = .12, spin = .2 }, dt = 1) => splatTo(vel, x, y, r, [-spin * dt * res, 0, 0, 0], 1);
  /* push the water without colour: vx, vy in short-sides per second (per second², with dt) */
  F.push = ({ x, y, r = .1, vx = 0, vy = 0 }, dt = 1) => splatTo(vel, x, y, r, [...toCells(vx * dt, vy * dt), 0, 0]);
  /* a picture (image or canvas the size of the frame, or any size — it is stretched) becomes dye: its colour where it is opaque.
     { amount (strength, default 1), mass (default 1), replace (true clears the dye first) } */
  F.load = (img, { amount = 1, mass = 1, replace = false, grain = 0, grainSize = 60 } = {}) => {
    const tex = upload(img); pass(SIM.load, dye.b, { img: tex, src: dye.a, mode, amt: amount, mass, keep: replace ? 0 : 1, grain, gfreq: grainSize, asp }); dye.swap(); gl().g.deleteTexture(tex);
  };
  /* solid shapes the water flows around (a word, a logo): opaque pixels of img are walls. null removes them. */
  F.obstacle = img => {
    if (obD) { free(obD); free(obV); obD = obV = null; } if (!img) return;
    const tex = upload(img); obD = target(dw, dh, 'RGBA8'); obV = target(sw, sh, 'RGBA8');
    pass(SIM.mask, obD, { img: tex }); pass(SIM.mask, obV, { img: tex }); gl().g.deleteTexture(tex);
  };
  const zero = target(1, 1, 'RGBA8');
  const ob = big => ({ obst: (big ? obD : obV) || zero, hasObst: obD ? 1 : 0 });

  const num = (v, t) => typeof v === 'function' ? v(t) : v;
  function stepOnce(t, dt) {
    if (o.step) o.step(F, t, dt);
    const tb = o.turbulence;
    if (o.gravity || (tb && tb.amount)) { pass(SIM.force, vel.b, { vel: vel.a, dye: dye.a, paint: mode === 2 ? 1 : 0, dt, grav: o.gravity || 0, turb: tb ? tb.amount * res : 0, tscale: tb ? tb.scale ?? 2 : 1, tt: tb ? t * (tb.speed ?? .15) : 0, seed: tb ? tb.seed ?? 0 : 0, asp }); vel.swap(); }
    if (o.curl ?? 20) { pass(SIM.curl, cu, { vel: vel.a, vt }); pass(SIM.vort, vel.b, { vel: vel.a, cu, vt, dt, k: o.curl ?? 20 }); vel.swap(); }
    pass(SIM.div, dv, { vel: vel.a, vt, ...ob(false) });
    pass(SIM.down, dvC, { src: dv, st: vt });
    pass(SIM.scale, prsC.b, { src: prs.a, k: 1 }); prsC.swap();
    for (let i = 0; i < 80; i++) { pass(SIM.jacobiC, prsC.b, { p: prsC.a, dv: dvC, vt: [1 / cw, 1 / ch], k2: (sw / cw) * (sh / ch) }); prsC.swap(); }
    pass(SIM.scale, prs.b, { src: prsC.a, k: 1 }); prs.swap();
    for (let i = 0; i < (o.pressure || 30); i++) { pass(SIM.jacobi, prs.b, { p: prs.a, dv, vt, ...ob(false) }); prs.swap(); }
    pass(SIM.grad, vel.b, { p: prs.a, vel: vel.a, vt, ...ob(false) }); vel.swap();
    pass(SIM.advect, vel.b, { vel: vel.a, src: vel.a, vt, dt, decay: num(o.viscosity ?? .2, t), ...ob(false) }); vel.swap();
    pass(SIM.hat, hat, { vel: vel.a, src: dye.a, vt, st, dt });
    pass(SIM.mac, dye.b, { vel: vel.a, src: dye.a, hat, vt, st, dt, decay: num(o.fade || 0, t), ...ob(true) }); dye.swap();
  }
  function snap(n) {
    if (snaps.has(n)) return; const s = { vel: target(sw, sh, 'RGBA32F'), prs: target(sw, sh, 'RGBA32F'), dye: target(dw, dh) };
    copy(vel.a, s.vel); copy(prs.a, s.prs); copy(dye.a, s.dye); snaps.set(n, s);
  }
  function restore(n) { const s = snaps.get(n); copy(s.vel, vel.a); copy(s.prs, prs.a); copy(s.dye, dye.a); cur = n; }
  function init() {
    for (const p of [vel, prs, dye]) for (const x of [p.a, p.b]) { const { g } = gl(); g.bindFramebuffer(g.FRAMEBUFFER, x.fbo); g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT); }
    if (o.start) o.start(F); cur = 0; snap(0);
  }
  /* bring the simulation to frame round(t × fps) */
  F.at = t => {
    const n = Math.max(0, Math.round(t * fps));
    if (cur < 0) init();
    if (n < cur) { let k = 0; for (const s of snaps.keys()) if (s <= n && s > k) k = s; restore(k); }
    else { let k = cur; for (const s of snaps.keys()) if (s <= n && s > k) k = s; if (k > cur) restore(k); }
    while (cur < n) {
      for (let s = 0; s < sub; s++) stepOnce((cur * sub + s) / (fps * sub), 1 / (fps * sub));
      cur++; if (cur % keep === 0) snap(cur);
    }
    return F;
  };
  /* draw the current state.
     look: { bg (ground colour; ink → the paper / water, light → the dark), bg2 (a second ground colour at the bottom, default bg),
             gain (colour strength, default 1), shade (0..1 relief from the dye's thickness), spec (0..1 highlights), shine (highlight size, 20 broad – 200 pin-sharp),
             edge (how steep the relief is, default 40), light: [x, y, z] direction (default from the upper left), vignette, gamma, rect, a } */
  F.draw = (ctx, L = {}, t = cur / fps) => {
    const bg = rgb(L.bg || (mode === 0 ? '#f4f1ea' : '#05060a')), bg2 = L.bg2 ? rgb(L.bg2) : bg;
    pass(SIM.show, null, { dye: dye.a, obst: obD || zero, hasObst: obD ? 1 : 0, dt_: st, bg, bg2, mode, gain: L.gain ?? 1, shade: L.shade ?? 0, spec: L.spec ?? 0, shine: L.shine ?? 60,
      edge: L.edge ?? 40, light: L.light || [-.5, .6, .9], fr: Math.round(t * fps) % 997, vign: L.vignette || 0, gamma: L.gamma ?? 1 }, dw, dh);
    blit(ctx, L);
  };
  F.dispose = () => { for (const s of snaps.values()) for (const x of Object.values(s)) free(x); snaps.clear(); };
  return F;
}

/* ================= marbling ================= */
/* ops are applied in order on the water; the shader runs them backwards for each pixel to find which paint lands there.
   kinds: 0 drop (cx, cy, r, colour)  1 tine stroke (px, py, dirx, diry | shift, falloff, spacing, alternate)  2 wave (dirx, diry, amp | wavelength, phase)
          3 swirl (cx, cy, angle, falloff) */
const MARBLE = `uniform sampler2D ops; uniform float n, aa, fr, tex, texScale, rim, seed; uniform vec3 base; uniform vec3 cols[24]; uniform vec2 asp, light; uniform float sheen;
${GLSL}
vec4 op(int i, int k){ return texelFetch(ops, ivec2(i * 3 + k, 0), 0); }
// returns colour index (-1 = the water) and the pre-image point inside that drop
vec4 trace(vec2 p){
  for (int i = int(n) - 1; i >= 0; i--) {
    vec4 a = op(i, 0), b = op(i, 1), c = op(i, 2); int kind = int(a.x + .5);
    if (kind == 0) { vec2 d = p - b.xy; float r = b.z, l2 = dot(d, d);
      if (r <= 0.) continue;
      if (l2 < r * r) return vec4(b.w, length(d) / r, p);
      p = b.xy + d * sqrt(1. - r * r / l2); }
    else if (kind == 1) { vec2 M = normalize(b.zw), N = vec2(-M.y, M.x); float dd = dot(p - b.xy, N);
      float sp = c.z, l = c.y, sh;
      if (sp <= 0.) sh = l / (abs(dd) + l);
      else if (c.w < .5) sh = l / (abs(dd - sp * floor(dd / sp + .5)) + l);
      else { float u = dd / sp, dp = sp * abs(u - 2. * floor(u * .5 + .5)), dm = sp * abs(u - 2. * floor((u - 1.) * .5 + .5) - 1.); sh = l / (dp + l) - l / (dm + l); }
      if (a.z > 0.) sh *= 1. - smoothstep(a.y - a.z, a.y, dot(p - b.xy, M));            // a stylus still on its way: only behind its tip
      p -= M * c.x * sh; }
    else if (kind == 2) { vec2 M = normalize(b.xy), N = vec2(-M.y, M.x); p -= M * b.z * sin(TAU_ * dot(p, N) / c.x + c.y); }
    else if (kind == 3) { vec2 d = p - b.xy; float l = length(d), th = -b.z * c.x / (l + c.x); float cs = cos(th), sn = sin(th); p = b.xy + mat2(cs, sn, -sn, cs) * d; }
  }
  return vec4(-1., 0., p);
}
vec3 paint(vec4 tr){
  if (tr.x < -.5) return base * (1. + tex * .5 * gnoise(vec3(tr.zw * texScale * .5, seed + 9.)));
  int k = int(tr.x + .5); vec3 c = cols[k];
  float g = gnoise(vec3(tr.zw * texScale, seed + float(k) * 7.31)) + .5 * gnoise(vec3(tr.zw * texScale * 2.7, seed + 3.1 + float(k)));
  c *= 1. + tex * g;
  c *= 1. - rim * smoothstep(.82, 1., tr.y);
  return c;
}
void main(){
  vec2 fc = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec3 acc = vec3(0.); int S = int(aa);
  for (int j = 0; j < 16; j++) { if (j >= S * S) break;
    vec2 off = (vec2(float(j % S), float(j / S)) + .5) / float(S) - .5;
    vec2 p = (fc + off) / min(res.x, res.y);
    acc += paint(trace(p)); }
  vec3 c = acc / float(S * S);
  o = vec4(dither(toSrgb(c), fr), 1.);
}`.replace(/TAU_/g, '6.28318530718');

/* draw marbled paint. ops (applied in order; build the list from t each frame — every value may depend on t):
     Fluid.drop(x, y, r, colourIndex)              a drop of paint of radius r spreading on the water; r grows as it lands (r × Fluid.grow(t, t0, dur))
     Fluid.tine({ x, y, angle, shift, falloff, spacing, alternate, head, soft })   a stylus (spacing 0) or a comb (spacing > 0) drawn through the paint
                                                   along angle (radians, 0 = right), dragging it by `shift` near the tines; falloff how wide the drag reaches;
                                                   alternate: neighbouring tines pull opposite ways. head: how far the tip has travelled from (x, y) along
                                                   angle (animate it to draw the stroke; leave it out for a finished stroke), soft: how long the pull fades in behind the tip
     Fluid.wave({ angle, amp, wavelength, phase }) the paint shifted along angle by a sine of the position across it (a wavy comb, a zig-zag)
     Fluid.swirl({ x, y, angle, falloff })         the paint turned around (x, y) by `angle` at the centre, less further out
   Positions are in short-sides (x 0..W/short, y 0..H/short, y down).
   o: { colors: ['#hex', …] (index = colourIndex), base (the water / size colour), aa (2 or 3 samples per side), texture (0..1 paint grain that
        stretches with the strokes), grain (size of that grain), rim (0..1 darker ring at the edge of each drop), rect, a } */
function marble(ctx, t, ops, o = {}) {
  const [x, y, w, h] = o.rect || [0, 0, ctx.canvas.width, ctx.canvas.height];
  const { g } = gl(); const N = ops.length, data = new Float32Array(Math.max(1, N) * 12);
  ops.forEach((p, i) => data.set(p, i * 12));
  if (!G.opsTex) { G.opsTex = g.createTexture(); }
  g.bindTexture(g.TEXTURE_2D, G.opsTex); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA32F, Math.max(1, N) * 3, 1, 0, g.RGBA, g.FLOAT, data);
  g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
  const cols = new Float32Array(72); (o.colors || []).slice(0, 24).forEach((c, i) => cols.set(rgb(c), i * 3));
  pass(MARBLE, null, { ops: G.opsTex, n: N, aa: o.aa ?? 2, fr: Math.round(t * 30) % 997, tex: o.texture ?? .12, texScale: o.grain ?? 40, rim: o.rim ?? 0, seed: o.seed ?? 0,
    base: rgb(o.base || '#101418'), cols }, Math.round(w), Math.round(h));
  blit(ctx, o);
}
const drop = (x, y, r, c) => [0, 0, 0, 0, x, y, r, c, 0, 0, 0, 0];
const tine = ({ x = 0, y = 0, angle = 0, shift = .1, falloff = .05, spacing = 0, alternate = false, head = null, soft = .12 }) => [1, head ?? 0, head == null ? 0 : soft, 0, x, y, Math.cos(angle), Math.sin(angle), shift, falloff, spacing, alternate ? 1 : 0];
const wave = ({ angle = 0, amp = .05, wavelength = .3, phase = 0 }) => [2, 0, 0, 0, Math.cos(angle), Math.sin(angle), amp, 0, wavelength, phase, 0, 0];
const swirl = ({ x, y, angle = 1, falloff = .2 }) => [3, 0, 0, 0, x, y, angle, 0, falloff, 0, 0, 0];
/* how far a drop has spread: 0 before t0, eases to 1 over dur (paint spreads fast then slows) */
const grow = (t, t0, dur = .8) => t <= t0 ? 0 : Math.sqrt(1 - Math.pow(1 - cl((t - t0) / dur), 3));

/* ================= silk ================= */
const SILK = `uniform float ph, fr, folds, depth, sharp, spec, shine, sheen, seed, drift, aniso, ao; uniform vec3 c0, c1, c2, c3, lightv; uniform vec2 dir;
${GLSL}
float fold(float w){ return mix(sin(w), 1. - 2. * sqrt(sin(.5 * w) * sin(.5 * w) + .015), sharp); }   // sharp = crisp crests, rounded hollows
vec2 rot(vec2 v, float a){ return vec2(cos(a) * v.x - sin(a) * v.y, sin(a) * v.x + cos(a) * v.y); }
float H(vec2 p){
  vec2 q = p + drift * vec2(.12 * sin(p.y * 1.1 + ph + seed), .1 * cos(p.x * .9 - ph + seed * 1.7));
  vec2 d = normalize(dir), n = vec2(-d.y, d.x);
  float u = dot(q, n), v = dot(q, d), f = folds * 3.14159;
  float w = f * u * (1. + .35 * sin(v * .8 + ph + seed)) + 1.6 * sin(v * 1.05 - ph + seed * 2.) + .5 * sin(v * 2.3 + 2. * ph);   // folds that fan out and gather along their length
  float h = fold(w);
  h += .22 * sin(f * 2.3 * dot(q, rot(n, .25)) + 1.2 * sin(v * 1.7 + 2. * ph) + seed);
  return h * depth;
}
void main(){
  vec2 fc = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y), p = fc / min(res.x, res.y);
  float e = 1.2 / min(res.x, res.y);
  float h = H(p), hx = H(p + vec2(e, 0.)), hy = H(p + vec2(0., e));
  vec3 nrm = normalize(vec3(-(hx - h) / e, (hy - h) / e, 1.));                       // screen y runs down
  vec3 L = normalize(lightv), V = vec3(0., 0., 1.), Hh = normalize(L + V);
  float wrap = clamp((dot(nrm, L) + .08) / 1.08, 0., 1.);
  float occl = mix(1., clamp(.55 + .45 * h / (depth * 1.6) + .3, 0., 1.), ao);
  float k = clamp(wrap * occl, 0., 1.);
  vec3 c = k < .4 ? mix(c0, c1, k / .4) : k < .78 ? mix(c1, c2, (k - .4) / .38) : mix(c2, c3, (k - .78) / .22);
  vec2 d = normalize(dir); vec3 T = normalize(vec3(d.x, -d.y, 0.) - nrm * dot(vec3(d.x, -d.y, 0.), nrm));
  float th = dot(T, Hh), kk = sqrt(max(1. - th * th, 0.));                          // satin: the highlight runs along the weave
  float sp = pow(max(mix(dot(nrm, Hh), kk, aniso), 0.), shine) * occl;
  float fres = pow(1. - clamp(nrm.z, 0., 1.), 2.);
  c += spec * sp * mix(c3, vec3(1.), .35) + sheen * fres * c2 * occl;
  o = vec4(dither(toSrgb(c), fr), 1.);
}`;
/* a sheet of satin folding slowly in light; loops every `loop` seconds.
   o: { colors: [shadow, mid, light, highlight] ('#hex', dark to light), folds (how many across, default 3), depth (fold height, default .06),
        sharp (0 rounded – 1 creased), drift (how much the folds wander, default 1), angle (direction of the folds, radians), spec (highlight strength, default .6),
        shine (highlight sharpness, default 40), aniso (0..1 satin stretch of the highlight), sheen (rim light), light [x, y, z], seed, loop, rect, a } */
function silk(ctx, t, o = {}) {
  const [x, y, w, h] = o.rect || [0, 0, ctx.canvas.width, ctx.canvas.height];
  const cs = (o.colors || ['#1a0f2e', '#5b2a86', '#d9779b', '#ffe3d1']).map(rgb), ang = o.angle ?? .5;
  pass(SILK, null, { ph: TAU * t / (o.loop || 20), fr: Math.round(t * 30) % 997, folds: o.folds ?? 1.6, depth: o.depth ?? .12, sharp: o.sharp ?? .35, spec: o.spec ?? .7, shine: o.shine ?? 24,
    sheen: o.sheen ?? .25, seed: o.seed ?? 0, drift: o.drift ?? 1, aniso: o.aniso ?? .6, ao: o.ao ?? .6, c0: cs[0], c1: cs[1], c2: cs[2], c3: cs[3], lightv: o.light || [-.55, -.45, .55], dir: [Math.cos(ang), Math.sin(ang)] }, Math.round(w), Math.round(h));
  blit(ctx, o);
}

window.Fluid = { sim, marble, drop, tine, wave, swirl, grow, silk };
})();
