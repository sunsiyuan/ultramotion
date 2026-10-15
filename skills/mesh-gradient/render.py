"""Render a mesh-gradient page to mp4 with sound, or preview it as a contact sheet.

    python3 render.py page.html --out video.mp4 [--crf 20]
    python3 render.py page.html --preview [--at 1.5,6,12] [--out preview.png]
    python3 render.py page.html --preview --at 12 --full          one frame at full size
    python3 render.py page.html --seam                            loop pieces: does the last frame flow into the first?

The page sets window.__scene = { duration, loop?, ready, seek(t), sounds?, music? }  (Mesh.scene() makes one for you):
  loop    true → the sound's tail is folded back into its start so the mp4 repeats without a click, and the seam is checked
  sounds  [{ t, dur, kind, v }, …]   kind: whoosh swish shimmer riser chime sparkle ding … (see sound.py)
  music   { notes: [...], dynamics } | { file: 'x.wav' } | { style: 'piano' | 'lofi' | 'marimba' }
Frames are captured losslessly (PNG): smooth gradients band if they pass through JPEG first.
Needs ffmpeg and Python with playwright, Pillow, numpy, scipy, soundfile; uses Playwright's Chromium or the installed Google Chrome.
"""
import argparse, base64, io, json, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
FPS, W, H = 30, 1080, 1920
TAIL = 6.0                                                                                                   # seconds of sound after the end, folded back when looping
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
        self.duration = self.page.evaluate('window.__scene.duration'); self.loop = bool(self.page.evaluate('!!window.__scene.loop'))
        for s in self.page.evaluate('window.__scene.timeline || []'):
            print(f"{s['t0']:6.2f}–{s['t1']:6.2f}  {s['kind']:<9} {s.get('id') or ''} {(s.get('text') or '')[:40]}".rstrip())
        print(f'duration {self.duration:.2f}s' + ('  (loop)' if self.loop else ''))
    def frame(self, t, fmt='png'):
        url = self.page.evaluate("([t, f]) => window.__scene.seek(t).then(() => document.querySelector('canvas').toDataURL(f === 'png' ? 'image/png' : 'image/jpeg', .95))", [t, fmt])
        return base64.b64decode(url.split(',', 1)[1])
    def close(self):
        self.browser.close(); self.pw.stop()

def small(png):
    import numpy as np
    from PIL import Image, ImageFilter
    im = Image.open(io.BytesIO(png)).convert('L').filter(ImageFilter.GaussianBlur(12)).resize((48, 48))
    return np.asarray(im, dtype=np.float32)

def seam(pg):
    """how much the picture jumps from the last frame to the first, against how much it moves between two ordinary frames"""
    d, s = pg.duration, 1 / FPS
    last, first, second, wrap = (small(pg.frame(t)) for t in (d - s, 0, s, d))
    jump, step, back = abs(first - last).mean(), abs(second - first).mean(), abs(wrap - first).mean()
    ok = jump <= 1.6 * step + .4 and back <= .6
    print(f'seam: last→first {jump:.2f}  ·  an ordinary step {step:.2f}  ·  frame at t=duration vs t=0 {back:.2f}  →  {"ok" if ok else "JUMPS — something is not periodic in the loop"}')
    return ok

def preview(a):
    from PIL import Image, ImageDraw
    pg = Page(a.page); d = pg.duration
    ts = [float(x) for x in a.at.split(',')] if a.at else [round(d * k / 9, 2) for k in range(1, 10)]
    tiles = []
    for t in ts:
        im = Image.open(io.BytesIO(pg.frame(t, 'jpg'))).convert('RGB'); k = 1 if a.full else 640 / max(im.size); im = im.resize((round(im.width * k), round(im.height * k)))
        ImageDraw.Draw(im).text((10, 8), f'{t:.2f}s', fill=(120, 120, 120)); tiles.append(im)
    if pg.loop: seam(pg)
    pg.close()
    tw, th = tiles[0].size; cols = min(5 if tw < th else 3, len(tiles)); rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (tw * cols, th * rows), 'white')
    for i, im in enumerate(tiles): sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
    out = a.out or 'preview.png'; sheet.save(out); print(out)

def audio(dur, sounds, music, loop):
    import numpy as np
    from sound import track
    if not loop: return track(dur, sounds, music)
    n = int(round(dur * 48000)); a = track(dur + TAIL, sounds, music); out = a[:n].copy(); tail = a[n:]
    k = 0
    while k < len(tail): m = min(n, len(tail) - k); out[:m] += tail[k:k + m]; k += m                    # what rings past the end plays again at the start
    peak = np.abs(out).max(); return out / peak * .89 if peak > .89 else out

def render(a):
    import soundfile as sf
    pg = Page(a.page); dur = pg.duration; n = round(dur * FPS)
    if pg.loop: seam(pg)
    sounds, music = pg.page.evaluate('window.__scene.sounds || []'), pg.page.evaluate('window.__scene.music || null')
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'a.wav'; sf.write(wav, audio(dur, sounds, music, pg.loop), 48000)
        ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'png', '-i', '-', '-i', str(wav),
                               '-map', '0:v', '-map', '1:a', '-t', str(dur), '-c:v', 'libx264', '-crf', str(a.crf), '-preset', 'slow', '-x264-params', 'aq-mode=3', '-pix_fmt', 'yuv420p',
                               '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', a.out], stdin=subprocess.PIPE)
        for i in range(n):
            ff.stdin.write(pg.frame(i / FPS))
            if i % 90 == 0: print(f'{i}/{n}', flush=True)
        ff.stdin.close(); pg.close()
        if ff.wait(): sys.exit('ffmpeg failed')
    print(a.out)

ap = argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('--out'); ap.add_argument('--preview', action='store_true'); ap.add_argument('--at'); ap.add_argument('--full', action='store_true', help='full-size frames in the sheet')
ap.add_argument('--seam', action='store_true', help='only check the loop seam')
ap.add_argument('--crf', type=int, default=20, help='x264 quality: lower is better and bigger')
a = ap.parse_args()
if a.seam: pg = Page(a.page); seam(pg); pg.close()
elif a.preview: preview(a)
elif not a.out: sys.exit('--out video.mp4 (or --preview)')
else: render(a)
