"""Render a page to mp4 with sound, or preview it as a contact sheet.

    python3 render.py page.html --out video.mp4 [--crf 20]
    python3 render.py page.html --preview [--at 1.5,6,12] [--size 640] [--full] [--ref painting.jpg] [--out preview.png]
    python3 render.py page.html --audio --out sound.wav                  only the sound, to work on the music without rendering frames
    python3 render.py page.html --seam                                   a looping page: does the last frame flow into the first?
    python3 render.py frames clip.mp4 [--fps 30] [--width 1920]          video → clip.mp4.frames/ for footage('clip.mp4') (pixel art: --width 640)

The page sets window.__scene (every engine's scene() makes one):
  duration, ready, seek(t)        required: seek(t) draws the frame at t and resolves when it is on screen
                                  (the canvas is captured; a page without a canvas is screenshot at 1080×1920)
  loop        true → the sound's tail is folded back into its start, and the seam is checked
  lossless    true → frames are captured as PNG (smooth gradients band if they pass through JPEG)
  pixelated   true → contact sheets are scaled with hard edges
  sounds      [{ t, kind, dur, v, pan, … }, …]                         see sound.py; chip sounds (coin jump …) go to lib/pixel/chip.py
  music       { notes: [...], dynamics, duck }                          sampled instruments (sound.py)
              { style: 'piano' | 'marimba' | 'lofi', bpm, lift }        a ready arrangement
              { file: 'song.mp3', from, at, gain, fadeIn, fadeOut }    a recording: song time `from` plays at video time `at`; notes may ride on top
              { chip: [...] }                                           chiptune (lib/pixel/chip.py), alone or with the above
  voice, duck  a narration file mixed on top, the rest ducked under it while it speaks
  timeline, warnings               printed when the page loads
Footage a page loads with footage('x.mp4') is split into frames before rendering (and again when the video changes).
Paths in music, sounds and voice are relative to the page.
Needs ffmpeg and Python with playwright, Pillow, numpy, scipy, soundfile; uses Playwright's Chromium or the installed Google Chrome.
"""
import argparse, base64, io, json, re, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE)); sys.path.insert(0, str(HERE / 'lib' / 'pixel'))
FPS, SR, TAIL = 30, 48000, 6.0                                          # TAIL: seconds of sound after the end, folded back when looping
CEIL = .89                                                              # sample peak of the mix (−1 dBFS); AAC can overshoot it, which render() checks after encoding
HANZI = Path.home() / '.cache/whiteboard-hanzi'

def frames(video, fps=30, width=1920):
    """split a video into numbered jpgs + index.js next to it, the way footage() reads them"""
    video = Path(video); out = Path(str(video) + '.frames'); out.mkdir(exist_ok=True)
    for f in out.glob('*.jpg'): f.unlink()
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-vf', f"fps={fps},scale='min({width},iw)':-2", '-q:v', '3', str(out / '%05d.jpg')], check=True)
    jpgs = sorted(out.glob('*.jpg')); from PIL import Image; w, h = Image.open(jpgs[0]).size
    (out / 'index.js').write_text("(window.__frames = window.__frames || {})[document.currentScript.getAttribute('src').replace(/\\/index\\.js$/, '')] = "
                                  + json.dumps({'fps': fps, 'count': len(jpgs), 'width': w, 'height': h}) + ';\n')
    print(f'{out}  {len(jpgs)} frames  {w}×{h}')

def prepare(page):
    """extract frames for every footage('…') in the page that has none yet or is older than its video"""
    html = Path(page).read_text()
    for src in re.findall(r"""footage\(\s*['"]([^'"]+)['"]""", html):
        v = (Path(page).parent / src).resolve(); idx = Path(str(v) + '.frames') / 'index.js'
        if v.exists() and (not idx.exists() or idx.stat().st_mtime < v.stat().st_mtime): frames(v, width=640 if 'Pixel.' in html else 1920)

def hanzi(route):
    """Chinese stroke data (hanzi-writer-data on jsDelivr) from a local cache; fetched and kept the first time"""
    url = route.request.url; f = HANZI / (url.rsplit('/', 1)[1].replace('%', '_'))
    if f.exists(): return route.fulfill(status=200, body=f.read_bytes(), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
    r = route.fetch()
    if r.ok: HANZI.mkdir(parents=True, exist_ok=True); f.write_bytes(r.body())
    route.fulfill(response=r)

class Page:
    def __init__(self, path):
        from playwright.sync_api import sync_playwright
        self.path = path; self.pw = sync_playwright().start()
        args = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--allow-file-access-from-files']           # WebGL2 on the GPU; falls back to software if it must
        try: self.browser = self.pw.chromium.launch(args=args)
        except Exception: self.browser = self.pw.chromium.launch(channel='chrome', args=args)
        self.page = self.browser.new_page(viewport={'width': 1080, 'height': 1920}, device_scale_factor=1)
        self.page.route('https://cdn.jsdelivr.net/npm/hanzi-writer-data*/**', hanzi)
        errors = []; self.page.on('pageerror', lambda e: errors.append(str(e))); self.page.on('console', lambda m: m.type in ('error', 'warning') and errors.append(m.text))
        prepare(path)
        self.page.goto(Path(path).resolve().as_uri() + '?rec=1')
        try: self.page.evaluate('() => window.__scene.ready')
        except Exception as e:
            for m in errors: print('page:', m, file=sys.stderr)
            self.close(); sys.exit(f'page error: {str(e).splitlines()[0]}')
        for e in errors: print('page:', e, file=sys.stderr)
        S = self.page.evaluate('({ d: window.__scene.duration, loop: !!window.__scene.loop, lossless: !!window.__scene.lossless, px: !!window.__scene.pixelated, canvas: !!document.querySelector("canvas") })')
        self.duration, self.loop, self.lossless, self.pixelated, self.canvas = S['d'], S['loop'], S['lossless'] or S['loop'], S['px'], S['canvas']
        for s in self.page.evaluate('window.__scene.timeline || []'):
            print(f"{s['t0']:6.2f}–{s['t1']:6.2f}  {s.get('kind', ''):<9} {s.get('id') or ''} {(s.get('text') or '')[:50]}".rstrip())
        print(f'duration {self.duration:.2f}s' + ('  (loop)' if self.loop else ''))
        for w in self.page.evaluate('window.__scene.warnings || []'): print('warning:', w)
    def frame(self, t, fmt=None):
        fmt = fmt or ('png' if self.lossless else 'jpg')
        if not self.canvas:                                              # a page drawn with HTML elements: screenshot the viewport
            self.page.evaluate('t => window.__scene.seek(t)', t)
            return self.page.screenshot(type='png' if fmt == 'png' else 'jpeg', **({} if fmt == 'png' else {'quality': 95}))
        url = self.page.evaluate("([t, f]) => window.__scene.seek(t).then(() => document.querySelector('canvas').toDataURL(f === 'png' ? 'image/png' : 'image/jpeg', .95))", [t, fmt])
        return base64.b64decode(url.split(',', 1)[1])
    def get(self, expr): return self.page.evaluate(expr)
    def close(self):
        self.browser.close(); self.pw.stop()

# ---------- sound ----------
def absolute(page, sounds, music, voice):
    base = Path(page).resolve().parent
    for s in sounds:
        if s.get('src') and not Path(s['src']).is_absolute(): s['src'] = str(base / s['src'])
    if music and music.get('file') and not Path(music['file']).is_absolute(): music['file'] = str(base / music['file'])
    if voice and not Path(voice).is_absolute(): voice = str(base / voice)
    return sounds, music, voice

def recording(m, dur):
    """the song file, cut so that song time `from` lands on video time `at`, with fades → (n, 2)"""
    import numpy as np
    start, at = float(m.get('from', 0)), float(m.get('at', 0))
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(start), '-t', str(dur - at + 1), '-i', m['file'], '-vn', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    y = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64) * float(m.get('gain', 1))
    n = int(dur * SR); out = np.zeros((n, 2)); a = int(at * SR); k = min(len(y), n - a); out[a:a + k] = y[:k]
    x = np.arange(n) / SR; fi, fo = float(m.get('fadeIn', .3)), float(m.get('fadeOut', 1.5))
    g = np.clip((x - at) / max(fi, 1e-3), 0, 1) * np.clip((dur - x) / max(fo, 1e-3), 0, 1)
    return out * g[:, None]

def mix(dur, sounds, music, voice=None, duck=.35):
    import numpy as np
    from sound import track
    music = dict(music or {}); notes = music.pop('chip', None) or []
    try: import chip; CS = chip.SFX
    except ImportError: chip, CS = None, ()
    cs = [s for s in sounds if s.get('kind') in CS]; other = [s for s in sounds if s.get('kind') not in CS]
    n = int(round(dur * SR)); out = np.zeros((n, 2))
    if music.get('file'):                                                # a recording, with notes / sounds on top
        rec = recording(music, dur); extra = {k: v for k, v in music.items() if k in ('notes', 'dynamics', 'style', 'bpm', 'duck')}
        if other or extra.get('notes') or extra.get('style'):
            over = track(dur, other, extra or None)[:n]; rec[:len(over)] += over * float(music.get('extraGain', .5))
        out[:len(rec)] += rec[:n]
    elif other or music.get('notes') or music.get('style'):
        b = track(dur, other, music or None)[:n]; out[:len(b)] += b
    if chip and (notes or cs):
        c = chip.render(dur, notes, cs)[:n]; out[:len(c)] = out[:len(c)] * .8 + c
    if voice:                                                            # the narration on top, everything else ducked while it speaks
        import soundfile as sf
        from scipy.signal import resample_poly
        v, sr = sf.read(voice, always_2d=True); v = v.mean(1)
        if sr != SR: v = resample_poly(v, SR, sr)
        vv = np.zeros(n); vv[:min(len(v), n)] = v[:n]
        env = np.clip(np.convolve(np.abs(vv) > .02, np.ones(9600) / 9600, 'same') * 4, 0, 1)
        out = out * .55 * (1 - duck * env)[:, None] + vv[:, None] * (.9 / (np.abs(vv).max() + 1e-9))
    pk = np.abs(out).max()
    return out / pk * CEIL if pk > CEIL else out

def audio(pg, extra=0.0):
    dur = pg.duration + extra
    sounds, music, voice = absolute(pg.path, pg.get('window.__scene.sounds || []'), pg.get('window.__scene.music || null'), pg.get('window.__scene.voice || null'))
    return mix(dur, sounds, music, voice, pg.get('window.__scene.duck ?? .35'))

def soundtrack(pg):
    """the mix; a looping page gets what rings past the end folded back into its start"""
    import numpy as np
    if not pg.loop: return audio(pg)
    n = int(round(pg.duration * SR)); a = audio(pg, TAIL); out = a[:n].copy(); tail = a[n:]; k = 0
    while k < len(tail): m = min(n, len(tail) - k); out[:m] += tail[k:k + m]; k += m
    pk = np.abs(out).max(); return out / pk * CEIL if pk > CEIL else out

# ---------- picture ----------
def small(png):
    import numpy as np
    from PIL import Image, ImageFilter
    im = Image.open(io.BytesIO(png)).convert('L').filter(ImageFilter.GaussianBlur(12)).resize((48, 48))
    return np.asarray(im, dtype=np.float32)

def seam(pg):
    """how much the picture jumps from the last frame to the first, against how much it moves between two ordinary frames"""
    d, s = pg.duration, 1 / FPS
    last, first, second, wrap = (small(pg.frame(t, 'png')) for t in (d - s, 0, s, d))
    jump, step, back = abs(first - last).mean(), abs(second - first).mean(), abs(wrap - first).mean()
    ok = jump <= 1.6 * step + .4 and back <= .6
    print(f'seam: last→first {jump:.2f}  ·  an ordinary step {step:.2f}  ·  frame at t=duration vs t=0 {back:.2f}  →  {"ok" if ok else "JUMPS — something is not periodic in the loop"}')
    return ok

def preview(a):
    from PIL import Image, ImageDraw
    pg = Page(a.page); d = pg.duration
    ts = [float(x) for x in a.at.split(',')] if a.at else [round(d * k / 9, 2) for k in range(1, 10)]
    size = 0 if a.full else a.size
    tiles = []
    for t in ts:
        im = Image.open(io.BytesIO(pg.frame(t, 'jpg'))).convert('RGB'); k = size / max(im.size) if size else 1
        im = im.resize((round(im.width * k), round(im.height * k)), Image.NEAREST if pg.pixelated else Image.LANCZOS)
        if len(ts) > 1: ImageDraw.Draw(im).text((10, 8), f'{t:.2f}s', fill=(255, 60, 60))
        tiles.append(im)
    if pg.loop: seam(pg)
    pg.close()
    if a.ref:                                   # the original beside every frame, the same height: compare, fix what differs, look again
        ref = Image.open(a.ref).convert('RGB'); th = tiles[0].height; ref = ref.resize((round(ref.width * th / ref.height), th))
        def pair(im): p = Image.new('RGB', (ref.width + 8 + im.width, th), 'white'); p.paste(ref, (0, 0)); p.paste(im, (ref.width + 8, 0)); return p
        tiles = [pair(im) for im in tiles]
    tw, th = tiles[0].size; cols = max(1, min(len(tiles), (5 if tw < th else 3) if not a.ref else 1800 // tw)) if size else 1
    rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (tw * cols, th * rows), 'white')
    for i, im in enumerate(tiles): sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
    out = a.out or 'preview.png'; sheet.save(out); print(out)

def render(a):
    import soundfile as sf
    pg = Page(a.page); dur = pg.duration; n = round(dur * FPS)
    if pg.loop: seam(pg)
    with tempfile.TemporaryDirectory() as tmp:
        snd = soundtrack(pg)
        if not pg.loop: k = int(.03 * SR); snd[:k] *= (__import__('numpy').arange(k) / k)[:, None]   # 30 ms in: a loud first note makes ffmpeg's AAC blow up its first frame by ~5 dB (10 ms isn't enough)
        wav = Path(tmp) / 'a.wav'; sf.write(wav, snd, SR)
        ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'png' if pg.lossless else 'mjpeg', '-i', '-', '-i', str(wav),
                               '-map', '0:v', '-map', '1:a', '-t', str(dur), '-c:v', 'libx264', '-crf', str(a.crf), '-preset', 'slow', '-x264-params', 'aq-mode=3',
                               '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', a.out], stdin=subprocess.PIPE)
        for i in range(n):
            ff.stdin.write(pg.frame(i / FPS))
            if i % 150 == 0: print(f'{i}/{n}', flush=True)
        ff.stdin.close(); pg.close()
        if ff.wait(): sys.exit('ffmpeg failed')
        under(a.out, wav, dur, tmp)
    print(a.out)

def under(mp4, wav, dur, tmp, ceiling=-1.0):
    """ffmpeg's AAC encoder can overshoot the mix's −1 dB peak. Measure the decoded audio's real peak (astats; volumedetect stops at 0.0)
    and if it is over, re-encode the audio from the mix (not from the encoded audio) up to 2 dB quieter, once; a spike that doesn't scale with the gain is only reported"""
    peak = lambda: max((float(x) for x in re.findall(r'Peak level dB: (-?[\d.]+)', subprocess.run(['ffmpeg', '-i', mp4, '-map', '0:a?', '-af', 'astats=measure_perchannel=none', '-f', 'null', '-'], capture_output=True, text=True).stderr)), default=None)
    p = peak()
    if p is None or p <= ceiling + .05: return
    gain = max(ceiling - .3 - p, -2.0); out = Path(tmp) / 'under.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp4, '-i', str(wav), '-map', '0:v', '-map', '1:a', '-t', str(dur), '-c:v', 'copy', '-af', f'volume={gain:.2f}dB',
                    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', str(out)], check=True)
    out.replace(mp4); q = peak()
    print(f'audio peaked at {p:+.1f} dB after encoding: lowered {gain:.1f} dB' + (f' — still {q:+.1f} dB: listen for a click' if q is not None and q > 0 else ''))

def listen(a):
    import soundfile as sf
    pg = Page(a.page); sf.write(a.out, soundtrack(pg), SR); pg.close(); print(a.out)

if len(sys.argv) > 2 and sys.argv[1] == 'frames':
    fa = argparse.ArgumentParser(); fa.add_argument('cmd'); fa.add_argument('video'); fa.add_argument('--fps', type=int, default=30); fa.add_argument('--width', type=int, default=1920)
    f = fa.parse_args(); frames(f.video, f.fps, f.width); sys.exit()
ap = argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('--out'); ap.add_argument('--preview', action='store_true'); ap.add_argument('--at')
ap.add_argument('--size', type=int, default=640, help='longest side of each frame in the sheet; 0 = full size')
ap.add_argument('--full', action='store_true', help='full-size frames in the sheet')
ap.add_argument('--ref', help='a picture shown beside each frame (the original painting)')
ap.add_argument('--audio', action='store_true', help='write only the sound to --out x.wav')
ap.add_argument('--seam', action='store_true', help='only check the loop seam')
ap.add_argument('--crf', type=int, default=20, help='x264 quality: lower is better and bigger; grain costs a lot of bits')
a = ap.parse_args()
if a.seam: pg = Page(a.page); seam(pg); pg.close()
elif a.preview: preview(a)
elif not a.out: sys.exit('--out video.mp4 (or --preview)')
elif a.audio: listen(a)
else: render(a)
