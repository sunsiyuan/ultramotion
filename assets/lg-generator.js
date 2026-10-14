// Liquid Glass 生成器（/liquid-glass-generator/）：上半是 CSS + SVG 位移贴图，预览就是生成的那段代码本身；
// 下半把 skills/liquid-glass/scene.html 原样放进 iframe，逐帧 seek → WebCodecs 编码 → mp4-muxer 封装成 MP4，全在浏览器里。
// 统计（GoatCounter 事件）：lg/copy 有多少人要 CSS · lg/preview 改了标题 · lg/download 点了下载 · lg/download-done 真的下完
const track = name => { try { window.goatcounter && window.goatcounter.count({ path: name, title: name, event: true }); } catch (e) {} };
const $ = id => document.getElementById(id);

/* ---------- CSS 玻璃 ---------- */
const knobs = $('knobs'), glass = $('glass'), stage = $('stage');
const unit = { w: 'px', h: 'px', r: 'px', bezel: 'px', scale: '', blur: 'px', sat: '×', tint: '', shine: '' };
const val = () => Object.fromEntries([...knobs.querySelectorAll('input')].map(i => [i.name, +i.value]));
// 只有 Chromium 把 SVG 滤镜用在 backdrop-filter 上；userAgentData 也只有 Chromium 有，用它当开关
const REFRACT = !!navigator.userAgentData;

// 位移贴图：圆角矩形，中间中性（128），边缘一圈朝里推——采样点往里挪，边上的背景就被拉弯
function map({ w, h, r, bezel }) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'), img = ctx.createImageData(w, h), d = img.data;
  r = Math.min(r, w / 2, h / 2);
  const hx = w / 2 - r, hy = h / 2 - r;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + .5 - w / 2, py = y + .5 - h / 2, qx = Math.abs(px) - hx, qy = Math.abs(py) - hy;
    const e = r - Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - Math.min(Math.max(qx, qy), 0);   // 离边多深，里面为正
    let nx = 0, ny = 0, m = 0;
    if (e > 0 && e < bezel) {
      m = (1 - e / bezel) ** 2;
      if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); nx = Math.sign(px) * qx / l; ny = Math.sign(py) * qy / l; }
      else if (qx > qy) nx = Math.sign(px); else ny = Math.sign(py);
    }
    const k = (y * w + x) * 4;
    d[k] = 128 - nx * m * 127; d[k + 1] = 128 - ny * m * 127; d[k + 2] = 128; d[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

const shadow = s => `inset 0 0 0 1px rgba(255,255,255,${(.45 * s).toFixed(2)}), inset 2px 3px 4px -2px rgba(255,255,255,${(.9 * s).toFixed(2)}), inset -2px -3px 4px -2px rgba(255,255,255,${(.4 * s).toFixed(2)}), 0 12px 32px rgba(0,0,0,.18)`;

function code(v, href) {
  const r = Math.min(v.r, v.w / 2, v.h / 2);
  return `<!-- Liquid Glass ${v.w}×${v.h}, made with https://ultramotion.ai/liquid-glass-generator/ -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <filter id="liquid-glass" x="0" y="0" width="${v.w}" height="${v.h}" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceGraphic" stdDeviation="${v.blur}" result="blur"/>
    <feImage href="${href}" x="0" y="0" width="${v.w}" height="${v.h}" preserveAspectRatio="none" result="map"/>
    <feDisplacementMap in="blur" in2="map" scale="${v.scale}" xChannelSelector="R" yChannelSelector="G" result="bent"/>
    <feColorMatrix in="bent" type="saturate" values="${v.sat}"/>
  </filter>
</svg>
<div class="liquid-glass">Your content</div>

<style>
.liquid-glass {
  width: ${v.w}px; height: ${v.h}px; border-radius: ${r}px;
  background: rgba(255, 255, 255, ${v.tint});
  box-shadow: ${shadow(v.shine)};
  /* Safari, Firefox: frosted glass */
  -webkit-backdrop-filter: blur(${Math.max(v.blur, 4)}px) saturate(${v.sat});
  backdrop-filter: blur(${Math.max(v.blur, 4)}px) saturate(${v.sat});
}
/* Chromium: real refraction (the map is made for exactly ${v.w}×${v.h}) */
.liquid-glass.refract { backdrop-filter: url(#liquid-glass); }
</style>

<script>
// navigator.userAgentData only exists in Chromium browsers, which are the ones that refract
if (navigator.userAgentData) document.querySelectorAll('.liquid-glass').forEach(el => el.classList.add('refract'));
</script>`;
}

let pos = null, full = '';   // pos 玻璃中心，相对舞台，第一次按舞台中心偏下放；full 完整代码（框里只显示贴图开头）
{ const w = knobs.querySelector('[name=w]'), fit = Math.floor(stage.clientWidth * .75 / 10) * 10;   // 手机上默认别比舞台还宽
  if (+w.value > fit) w.value = fit; }
function update() {
  const v = val();
  knobs.querySelectorAll('label').forEach(l => { const i = l.querySelector('input'); l.querySelector('output').textContent = i.value + unit[i.name]; });
  const href = map(v), src = code(v, href);
  // 预览 = 把生成的代码原样放进舞台（只把 class 和 id 换成预览专用，免得和页面撞）
  const live = src.replace(/liquid-glass(?!-generator)/g, 'lg-live').replace('<div class="lg-live">Your content</div>', '').replace(/<script>[\s\S]*<\/script>/, '');
  glass.innerHTML = live; glass.className = 'glass lg-live' + (REFRACT ? ' refract' : '');
  if (!pos) pos = { x: stage.clientWidth * .5, y: stage.clientHeight * .62 };
  place();
  full = src;
  $('code').textContent = src.replace(href, href.slice(0, 48) + '…');
  $('codeSize').textContent = `HTML + CSS · ${(src.length / 1024).toFixed(0)} KB, most of it the displacement map (shortened here, copied in full)`;
}
function place() {
  const v = val();
  pos.x = Math.max(v.w / 2 - 40, Math.min(stage.clientWidth - v.w / 2 + 40, pos.x));
  pos.y = Math.max(v.h / 2 - 40, Math.min(stage.clientHeight - v.h / 2 + 40, pos.y));
  glass.style.left = (pos.x - v.w / 2) + 'px'; glass.style.top = (pos.y - v.h / 2) + 'px';
}
knobs.addEventListener('input', update);
glass.addEventListener('pointerdown', e => {
  glass.setPointerCapture(e.pointerId);
  const ox = e.clientX - pos.x, oy = e.clientY - pos.y;
  const move = ev => { pos = { x: ev.clientX - ox, y: ev.clientY - oy }; place(); };
  glass.addEventListener('pointermove', move);
  glass.addEventListener('pointerup', () => glass.removeEventListener('pointermove', move), { once: true });
});
addEventListener('resize', () => pos && place());
$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(full);
  $('copy').textContent = 'Copied'; setTimeout(() => $('copy').textContent = 'Copy code', 1400); track('lg/copy');
});
$('support').textContent = REFRACT
  ? 'Your browser refracts: this is what Chrome, Edge and other Chromium browsers show.'
  : 'Your browser shows the frosted version (Safari and Firefox don\'t refract through backdrop-filter yet). Open this page in Chrome or Edge to see the refraction.';
update();

/* ---------- 视频：原版 scene.html ---------- */
const scene = $('scene'), form = $('vform'), vnote = $('vnote'), dl = $('dl'), NOTE = vnote.textContent;
const sceneURL = rec => {
  const f = new FormData(form), t = `${f.get('l1').trim()}|${f.get('l2').trim()}`.replace(/^\||\|$/g, '');
  return `../skills/liquid-glass/scene.html?lang=en&cut=${f.get('cut')}&title=${encodeURIComponent(t || 'Liquid Glass')}${f.get('dark') ? '&theme=dark' : ''}${rec ? '&rec=1' : ''}`;
};
const load = url => new Promise(ok => { scene.onload = ok; scene.src = url; });
load(sceneURL(false));
form.addEventListener('submit', e => { e.preventDefault(); load(sceneURL(false)); track('lg/preview'); });

async function encoderConfig() {
  for (const codec of ['avc1.640028', 'avc1.4d0028', 'avc1.42e028']) {
    const c = { codec, width: 1080, height: 1920, bitrate: 10e6, framerate: 30 };
    if ((await VideoEncoder.isConfigSupported(c)).supported) return c;
  }
}
dl.addEventListener('click', async () => {
  track('lg/download');
  const config = window.VideoEncoder && await encoderConfig();
  if (!config) { vnote.textContent = 'This browser can\'t encode MP4. Try Chrome, Edge or Safari 17+.'; return; }
  dl.disabled = true;
  try {
    const { Muxer, ArrayBufferTarget } = await import('./vendor/mp4-muxer.mjs');
    await load(sceneURL(true));
    const win = scene.contentWindow; await win.__scene.ready;
    const canvas = scene.contentDocument.getElementById('gl'), fps = 30, n = Math.round(win.__scene.duration * fps);
    const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width: 1080, height: 1920 }, fastStart: 'in-memory' });
    let fail = null;
    const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => { fail = e; } });
    enc.configure(config);
    for (let i = 0; i < n && !fail; i++) {
      await win.__scene.seek(i / fps);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
      enc.encode(frame, { keyFrame: i % 60 === 0 }); frame.close();
      while (enc.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 5));
      if (i % 10 === 0) vnote.textContent = `Rendering frame ${i + 1} of ${n}…`;
    }
    if (fail) throw fail;
    await enc.flush(); muxer.finalize();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([muxer.target.buffer], { type: 'video/mp4' }));
    a.download = `liquid-glass-${new FormData(form).get('cut')}.mp4`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    vnote.textContent = NOTE; track('lg/download-done');
  } catch (e) {
    vnote.textContent = `Couldn't make the video here (${e.message || e}). Try Chrome or Edge.`;
  } finally {
    dl.disabled = false; load(sceneURL(false));
  }
});
