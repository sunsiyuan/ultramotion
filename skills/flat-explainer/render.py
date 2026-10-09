"""Render a flat-explainer page to mp4 — frames, the narration, and the music ducked under it — or preview it as a contact sheet.

    python3 render.py page.html --out video.mp4
    python3 render.py page.html --preview [--at 1.5,6,12] [--out preview.png]

The page sets window.__scene = { duration, ready, seek(t), voice?, duck?, sounds?, music? }  (Flat.scene() makes one for you):
  sounds  [{ t, dur, kind }, …]   kind: whoosh shimmer riser boom sparkle ding chime swish
  music   { notes: [...] } | { file: 'x.wav' } | { style: 'ambient' | 'none' }
Needs ffmpeg and Python with playwright, Pillow, numpy, scipy, soundfile; uses Playwright's Chromium or the installed Google Chrome.
"""
import argparse, base64, io, json, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
FPS, W, H = 30, 1080, 1920
class Page:
    def __init__(self, path):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        args = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--allow-file-access-from-files']           # WebGL2 on the GPU; falls back to software if it must
        try: self.browser = self.pw.chromium.launch(args=args)
        except Exception: self.browser = self.pw.chromium.launch(channel='chrome', args=args)
        self.page = self.browser.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        errors = []; self.page.on('pageerror', lambda e: errors.append(str(e))); self.page.on('console', lambda m: m.type in ('error', 'warning') and errors.append(m.text))
        self.page.goto(Path(path).resolve().as_uri() + '?rec=1')
        try: self.page.evaluate('() => window.__scene.ready')
        except Exception as e: self.close(); sys.exit(f'page error: {str(e).splitlines()[0]}')
        for e in errors: print('page:', e, file=sys.stderr)
        self.duration = self.page.evaluate('window.__scene.duration')
        for s in self.page.evaluate('window.__scene.timeline || []'):
            print(f"{s['t0']:6.2f}–{s['t1']:6.2f}  {s['kind']:<9} {s.get('id') or ''} {(s.get('text') or '')[:40]}".rstrip())
        print(f'duration {self.duration:.2f}s')
        for w in self.page.evaluate('window.__scene.warnings || []'): print('warning:', w)
    def frame(self, t):
        url = self.page.evaluate("t => window.__scene.seek(t).then(() => document.querySelector('canvas').toDataURL('image/jpeg', .92))", t)
        return base64.b64decode(url.split(',', 1)[1])
    def close(self):
        self.browser.close(); self.pw.stop()

def preview(a):
    from PIL import Image, ImageDraw
    pg = Page(a.page); d = pg.duration
    ts = [float(x) for x in a.at.split(',')] if a.at else [round(d * k / 9, 2) for k in range(1, 10)]
    tiles = []
    for t in ts:
        im = Image.open(io.BytesIO(pg.frame(t))).convert('RGB').resize((360, 640)); ImageDraw.Draw(im).text((10, 8), f'{t:.2f}s', fill=(120, 120, 120)); tiles.append(im)
    pg.close()
    cols = min(5, len(tiles)); rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (360 * cols, 640 * rows), 'white')
    for i, im in enumerate(tiles): sheet.paste(im, ((i % cols) * 360, (i // cols) * 640))
    out = a.out or 'preview.png'; sheet.save(out); print(out)

def render(a):
    import soundfile as sf
    from sound import track
    pg = Page(a.page); dur = pg.duration; n = round(dur * FPS)
    sounds, music = pg.page.evaluate('window.__scene.sounds || []'), pg.page.evaluate('window.__scene.music || null')
    with tempfile.TemporaryDirectory() as tmp:
        bed = track(dur, sounds, music)
        voice, duck = pg.page.evaluate('window.__scene.voice || null'), pg.page.evaluate('window.__scene.duck ?? .35')
        if voice:                                           # the narration on top, the music and effects ducked while it speaks
            import numpy as np
            from scipy.signal import resample_poly
            vp = Path(voice) if Path(voice).is_absolute() else Path(a.page).resolve().parent / voice
            v, sr = sf.read(vp, always_2d=True); v = v.mean(1)
            if sr != 48000: v = resample_poly(v, 48000, sr)
            vv = np.zeros(len(bed)); vv[:min(len(v), len(bed))] = v[:len(bed)]
            env = np.convolve(np.abs(vv) > .02, np.ones(9600) / 9600, 'same'); env = np.clip(env * 4, 0, 1)
            mixd = bed * .55 * (1 - duck * env)[:, None] + vv[:, None] * (.9 / (np.abs(vv).max() + 1e-9))
            bed = mixd / (np.abs(mixd).max() + 1e-9) * .9
        wav = Path(tmp) / 'a.wav'; sf.write(wav, bed, 48000)
        ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', str(wav),
                               '-map', '0:v', '-map', '1:a', '-t', str(dur), '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p',
                               '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', a.out], stdin=subprocess.PIPE)
        for i in range(n):
            ff.stdin.write(pg.frame(i / FPS))
            if i % 90 == 0: print(f'{i}/{n}', flush=True)
        ff.stdin.close(); pg.close()
        if ff.wait(): sys.exit('ffmpeg failed')
    print(a.out)

ap = argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('--out'); ap.add_argument('--preview', action='store_true'); ap.add_argument('--at')
a = ap.parse_args()
if a.preview: preview(a)
elif not a.out: sys.exit('--out video.mp4 (or --preview)')
else: render(a)
