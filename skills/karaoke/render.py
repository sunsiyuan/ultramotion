"""Render a karaoke page to mp4 with sound, or preview it as a contact sheet.

    python3 render.py page.html --out video.mp4 [--crf 23]
    python3 render.py page.html --preview [--at 1.5,6,12] [--out preview.png] [--full]
    python3 render.py frames clip.mp4 [--fps 30] [--width 1920]     video → clip.mp4.frames/ for Karaoke.footage('clip.mp4')

The page sets window.__scene = { duration, ready, seek(t), sounds?, music? }  (Karaoke.scene() makes one for you):
  music   { file: 'song.mp3', from: 48, at: 0, gain: 1, fadeIn: .3, fadeOut: 1.5 }   a recording: song time `from` plays at video time `at`
          { notes: [...], dynamics }  · { style: 'piano' | 'marimba' | 'lofi' }      a backing played on sampled instruments (see sound.py)
          { file: 'song.mp3', …, notes: [...] }                                       both: the recording with extra notes on top
  sounds  [{ t, kind, dur, v }, …]   see sound.py
Footage the page loads with Karaoke.footage('x.mp4') is split into frames automatically before rendering.
Needs ffmpeg and Python with playwright, Pillow, numpy, scipy, soundfile; uses Playwright's Chromium or the installed Google Chrome.
"""
import argparse, base64, io, json, re, subprocess, sys, tempfile
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
FPS, SR = 30, 48000

def frames(video, fps=30, width=1920):
    """split a video into numbered jpgs + index.js next to it, the way Karaoke.footage() reads them"""
    video = Path(video); out = Path(str(video) + '.frames'); out.mkdir(exist_ok=True)
    for f in out.glob('*.jpg'): f.unlink()
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(video), '-vf', f"fps={fps},scale='min({width},iw)':-2", '-q:v', '3', str(out / '%05d.jpg')], check=True)
    jpgs = sorted(out.glob('*.jpg')); from PIL import Image; w, h = Image.open(jpgs[0]).size
    (out / 'index.js').write_text("(window.__frames = window.__frames || {})[document.currentScript.getAttribute('src').replace(/\\/index\\.js$/, '')] = "
                                  + json.dumps({'fps': fps, 'count': len(jpgs), 'width': w, 'height': h}) + ';\n')
    print(f'{out}  {len(jpgs)} frames  {w}×{h}')

def prepare(page):
    html = Path(page).read_text()
    for src in re.findall(r"""footage\(\s*['"]([^'"]+)['"]""", html):
        v = (Path(page).parent / src).resolve(); idx = Path(str(v) + '.frames') / 'index.js'
        if v.exists() and (not idx.exists() or idx.stat().st_mtime < v.stat().st_mtime): frames(v)

class Page:
    def __init__(self, path):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        args = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--allow-file-access-from-files']
        try: self.browser = self.pw.chromium.launch(args=args)
        except Exception: self.browser = self.pw.chromium.launch(channel='chrome', args=args)
        self.page = self.browser.new_page(viewport={'width': 1080, 'height': 1080}, device_scale_factor=1)
        errors = []; self.page.on('pageerror', lambda e: errors.append(str(e))); self.page.on('console', lambda m: m.type in ('error', 'warning') and errors.append(m.text))
        prepare(path)
        self.page.goto(Path(path).resolve().as_uri() + '?rec=1')
        try: self.page.evaluate('() => window.__scene.ready')
        except Exception as e:
            for m in errors: print('page:', m, file=sys.stderr)
            self.close(); sys.exit(f'page error: {str(e).splitlines()[0]}')
        for e in errors: print('page:', e, file=sys.stderr)
        self.duration = self.page.evaluate('window.__scene.duration')
        for s in self.page.evaluate('window.__scene.timeline || []'):
            print(f"{s['t0']:6.2f}–{s['t1']:6.2f}  {(s.get('text') or '')[:60]}")
        print(f'duration {self.duration:.2f}s')
    def frame(self, t):
        url = self.page.evaluate("t => window.__scene.seek(t).then(() => document.querySelector('canvas').toDataURL('image/jpeg', .93))", t)
        return base64.b64decode(url.split(',', 1)[1])
    def close(self):
        self.browser.close(); self.pw.stop()

def recording(page, m, dur):
    """the song file, cut so that song time `from` lands on video time `at`, with fades → (n, 2) at 48 kHz"""
    src = Path(m['file']); src = src if src.is_absolute() else (Path(page).resolve().parent / src)
    start, at = float(m.get('from', 0)), float(m.get('at', 0))
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(start), '-t', str(dur - at + 1), '-i', str(src), '-vn', '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    y = np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64) * float(m.get('gain', 1))
    n = int(dur * SR); out = np.zeros((n, 2)); a = int(at * SR); k = min(len(y), n - a); out[a:a + k] = y[:k]
    x = np.arange(n) / SR; fi, fo = float(m.get('fadeIn', .3)), float(m.get('fadeOut', 1.5))
    g = np.clip((x - at) / max(fi, 1e-3), 0, 1) * np.clip((dur - x) / max(fo, 1e-3), 0, 1)
    return out * g[:, None]

def audio_for(page, dur, sounds, music):
    from sound import track
    music = dict(music or {})
    if music.get('file'):
        rec = recording(page, music, dur)
        extra = {k: v for k, v in music.items() if k in ('notes', 'dynamics', 'style', 'bpm')}
        if sounds or extra.get('notes') or extra.get('style'):
            over = track(dur, sounds, extra or None)[:len(rec)]; over = np.pad(over, ((0, len(rec) - len(over)), (0, 0)))
            rec = rec + over * float(music.get('extraGain', .5))
        peak = np.abs(rec).max()
        return rec / peak * .95 if peak > .99 else rec
    return track(dur, sounds, music or None)

def preview(a):
    from PIL import Image, ImageDraw
    pg = Page(a.page); d = pg.duration
    ts = [float(x) for x in a.at.split(',')] if a.at else [round(d * k / 9, 2) for k in range(1, 10)]
    tiles = []
    for t in ts:
        im = Image.open(io.BytesIO(pg.frame(t))).convert('RGB'); k = 1 if a.full else 640 / max(im.size); im = im.resize((round(im.width * k), round(im.height * k)))
        ImageDraw.Draw(im).text((10, 8), f'{t:.2f}s', fill=(255, 60, 60)); tiles.append(im)
    pg.close()
    tw, th = tiles[0].size; cols = 1 if a.full else min(5 if tw < th else 3, len(tiles)); rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (tw * cols, th * rows), 'white')
    for i, im in enumerate(tiles): sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
    out = a.out or 'preview.png'; sheet.save(out); print(out)

def render(a):
    import soundfile as sf
    pg = Page(a.page); dur = pg.duration; n = round(dur * FPS)
    sounds, music = pg.page.evaluate('window.__scene.sounds || []'), pg.page.evaluate('window.__scene.music || null')
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'a.wav'; sf.write(wav, audio_for(a.page, dur, sounds, music), SR)
        ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', str(wav),
                               '-map', '0:v', '-map', '1:a', '-t', str(dur), '-c:v', 'libx264', '-crf', str(a.crf), '-preset', 'medium', '-pix_fmt', 'yuv420p',
                               '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', a.out], stdin=subprocess.PIPE)
        for i in range(n):
            ff.stdin.write(pg.frame(i / FPS))
            if i % 150 == 0: print(f'{i}/{n}', flush=True)
        ff.stdin.close(); pg.close()
        if ff.wait(): sys.exit('ffmpeg failed')
    print(a.out)

if len(sys.argv) > 2 and sys.argv[1] == 'frames':
    fa = argparse.ArgumentParser(); fa.add_argument('cmd'); fa.add_argument('video'); fa.add_argument('--fps', type=int, default=30); fa.add_argument('--width', type=int, default=1920)
    f = fa.parse_args(); frames(f.video, f.fps, f.width); sys.exit()
ap = argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('--out'); ap.add_argument('--preview', action='store_true'); ap.add_argument('--at'); ap.add_argument('--full', action='store_true')
ap.add_argument('--crf', type=int, default=23, help='x264 quality: lower is better and bigger; photos and film with grain cost a lot of bits')
a = ap.parse_args()
if a.preview: preview(a)
elif not a.out: sys.exit('--out video.mp4 (or --preview)')
else: render(a)
