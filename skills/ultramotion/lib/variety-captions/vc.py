"""Variety captions on footage: preview a few moments, or render the finished mp4.

    python3 vc.py preview --footage talk.mp4 --plan plan.json --at 1.5,4.2,7.8 [--out preview.png]
    python3 vc.py render  --footage talk.mp4 --plan plan.json --out final.mp4 [--bgm]

plan.json  { "subs": [[start, end, "line"], …], "items": [{ "t": …, "kind": …, … }, …], "zooms": [[start, dur, scale, cx, cy], …] }
           (the format is in SKILL.md; `duration` is optional and defaults to the footage length)
preview    the footage frame at each time, with that moment's zoom and captions on it, in one contact sheet
render     draws every caption frame in scene.html, puts it on the footage with the punch-in zooms,
           keeps the footage's audio and mixes the sound effects from sfx.py on top

Placement: items without x/y are placed by `place` relative to the face (or the animal's head) during the item's time on
screen. The face is found once per footage and cached next to the plan as <footage>.subject.json — Apple Vision on macOS
(detect.swift), MediaPipe elsewhere; with neither, a talking-head default (face in the upper middle) is used and a note printed.
A zoom written as [start, dur, scale] centres on the face.

The footage is scaled to fill 1080×1920 and centre-cropped. Needs ffmpeg, playwright (python), Pillow, numpy, scipy, soundfile.
Uses Playwright's bundled Chromium, or the installed Google Chrome if that isn't downloaded.
"""
import argparse, base64, io, json, shutil, subprocess, sys, tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
FPS, W, H = 30, 1080, 1920
FIT = f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}'

def footage_duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)], capture_output=True, text=True)
    return float(out.stdout.strip())

def zoom_at(zooms, t):
    """Punch-in at time t: (scale, cx, cy). 0.12 s in, held, 0.25 s back out."""
    for t0, d, s, x, y in zooms:
        if t0 <= t <= t0 + d:
            k = min(1, (t - t0) / .12) * min(1, (t0 + d - t) / .25)
            return 1 + (s - 1) * k, x, y
    return 1, .5, .5

def zoom_filter(zooms):
    """ffmpeg chain: scale up per frame, then crop 1080×1920 around the zoom centre."""
    z, cx, cy = '1', '0.5', '0.5'
    for t0, d, s, x, y in zooms:
        b = f'if(between(t,{t0},{t0 + d}),min(1,(t-{t0})/0.12)*min(1,({t0 + d}-t)/0.25),0)'
        z += f'+{s - 1}*{b}'; cx = f'if(between(t,{t0},{t0 + d}),{x},{cx})'; cy = f'if(between(t,{t0},{t0 + d}),{y},{cy})'
    return (f"{FIT},fps={FPS},scale=w='trunc({W}*({z})/2)*2':h='trunc({H}*({z})/2)*2':eval=frame:flags=bicubic,"
            f"crop={W}:{H}:x='max(0,min(in_w-{W},in_w*({cx})-{W / 2}))':y='max(0,min(in_h-{H},in_h*({cy})-{H / 2}))'")

DETECT_FPS = 6
DEFAULT_FACE = [.3, .18, .4, .24]                                   # x, y, w, h（0–1）：没法检测时，按普通口播的位置

def detect(footage, frames_dir):
    """每帧最大的一张脸；没有脸就取动物的头（耳朵、眼睛、鼻子的点），再没有就用动物身体框的上 45%。返回 [[x, y, w, h] 或 None, …]"""
    files = sorted(Path(frames_dir).glob('*.jpg'))
    if sys.platform == 'darwin' and shutil.which('swift'):
        script = HERE / 'detect.swift'
        if not script.exists(): sys.exit(f'detect.swift is missing next to {HERE / "vc.py"} — copy it from the skill folder')
        out = subprocess.run(['swift', str(script), str(frames_dir)], capture_output=True, text=True)
        if out.returncode != 0: print('note: Apple Vision face detection failed:\n' + out.stderr.strip()[-600:], file=sys.stderr)
        else:
            found = json.loads(out.stdout); res = []
            for f in files:
                bs = found.get(f.name, []); best = lambda k: [b for b in bs if b[4] == k]
                faces, heads, bodies = best('face'), best('animal-head'), [b for b in bs if b[4] not in ('face', 'animal-head')]
                if faces: res.append(max(faces, key=lambda b: b[2] * b[3])[:4])
                elif heads: res.append(max(heads, key=lambda b: b[2] * b[3])[:4])
                elif bodies: x, y, w, h, _ = max(bodies, key=lambda b: b[2] * b[3]); res.append([x, y, w, h * .45])
                else: res.append(None)
            return res
    try:
        import mediapipe as mp, numpy as np
        from PIL import Image
        fd = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=.5); res = []
        for f in files:
            r = fd.process(np.asarray(Image.open(f).convert('RGB'))).detections
            if r: b = max(r, key=lambda d: d.location_data.relative_bounding_box.width).location_data.relative_bounding_box; res.append([b.xmin, b.ymin, b.width, b.height])
            else: res.append(None)
        return res
    except Exception:
        return None

def subject(footage, cache):
    """脸 / 主体的位置，每秒 DETECT_FPS 个。缺的帧用前后插值补上。存一份在 cache，下次直接读。"""
    if cache.exists(): return json.loads(cache.read_text())
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['ffmpeg', '-v', 'error', '-i', str(footage), '-vf', f'{FIT},fps={DETECT_FPS},scale=540:960', '-q:v', '3', f'{tmp}/%05d.jpg'], check=True)
        boxes = detect(footage, tmp)
    if not boxes or not any(boxes):
        print('note: no face detector available (Apple Vision / MediaPipe) or nothing found — placing around a default '
              'talking-head position (not cached; fix the detector and run again)', file=sys.stderr)
        return {'fps': DETECT_FPS, 'boxes': None}
    else:
        idx = [i for i, b in enumerate(boxes) if b]
        for i, b in enumerate(boxes):
            if b is None:
                j = min(idx, key=lambda k: abs(k - i)); boxes[i] = boxes[j]
    data = {'fps': DETECT_FPS, 'boxes': boxes}
    cache.write_text(json.dumps(data)); return data

def face_px(sub, t, zooms):
    """t 时刻脸在成片画面上的框（像素，推镜头算进去）"""
    if sub['boxes']: x, y, w, h = sub['boxes'][min(len(sub['boxes']) - 1, max(0, round(t * sub['fps'])))]
    else: x, y, w, h = DEFAULT_FACE
    s, cx, cy = zoom_at(zooms, t)
    if s == 1: return [x * W, y * H, (x + w) * W, (y + h) * H]
    bw, bh = W * s, H * s; l = min(max(0, bw * cx - W / 2), bw - W); u = min(max(0, bh * cy - H / 2), bh - H)
    return [x * bw - l, y * bh - u, (x + w) * bw - l, (y + h) * bh - u]

def attach_faces(plan, sub):
    """zoom 只写了 [开始, 持续, 倍数] 的，中心对准那一刻的脸；没写 x、y 的花字，带上它在屏那段时间里脸的并集"""
    zs = []
    for z in plan['zooms']:
        if len(z) == 3:
            x0, y0, x1, y1 = face_px(sub, z[0], [])
            z = [*z, round((x0 + x1) / 2 / W, 3), round((y0 + y1) / 2 / H, 3)]
        zs.append(z)
    plan['zooms'] = zs
    for it in plan['items']:
        if it.get('x') is None or it.get('y') is None:
            bs = [face_px(sub, it['t'] + k / 10 * it['d'], zs) for k in range(11)]
            it['face'] = [min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)]
    return plan

class Scene:
    """scene.html in a headless browser, with the plan loaded; frame(t) → transparent PNG bytes."""
    def __init__(self, plan):
        from playwright.sync_api import sync_playwright
        self.pw = sync_playwright().start()
        try: self.browser = self.pw.chromium.launch()
        except Exception: self.browser = self.pw.chromium.launch(channel='chrome')
        self.page = self.browser.new_page(viewport={'width': W, 'height': H}, device_scale_factor=1)
        self.page.goto((HERE / 'scene.html').as_uri() + '?rec=1')
        self.page.evaluate('p => window.__scene.load(p)', plan)
        self.hits = self.page.evaluate('window.__scene.hits')
    def frame(self, t):
        url = self.page.evaluate("t => window.__scene.seek(t).then(() => document.getElementById('c').toDataURL('image/png'))", t)
        return base64.b64decode(url.split(',', 1)[1])
    def close(self):
        self.browser.close(); self.pw.stop()

def load_plan(a):
    plan = json.loads(Path(a.plan).read_text())
    plan.setdefault('duration', round(footage_duration(a.footage), 3))
    plan.setdefault('subs', []); plan.setdefault('items', []); plan.setdefault('zooms', [])
    sub = subject(a.footage, Path(a.plan).resolve().with_name(Path(a.footage).stem + '.subject.json'))
    return attach_faces(plan, sub)

def preview(a):
    from PIL import Image, ImageDraw
    plan = load_plan(a); sc = Scene(plan); tiles = []
    for t in [float(x) for x in a.at.split(',')]:
        png = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', a.footage, '-frames:v', '1', '-vf', FIT, '-f', 'image2pipe', '-c:v', 'png', '-'],
                             capture_output=True, check=True).stdout
        bg = Image.open(io.BytesIO(png)).convert('RGB')
        s, x, y = zoom_at(plan['zooms'], t)
        if s > 1:
            bw, bh = round(W * s), round(H * s); bg = bg.resize((bw, bh), Image.BICUBIC)
            l = min(max(0, bw * x - W / 2), bw - W); u = min(max(0, bh * y - H / 2), bh - H); bg = bg.crop((round(l), round(u), round(l) + W, round(u) + H))
        top = Image.open(io.BytesIO(sc.frame(t))); bg.paste(top, (0, 0), top)
        tile = bg.resize((360, 640)); ImageDraw.Draw(tile).text((10, 8), f'{t:.2f}s', fill='white', stroke_width=2, stroke_fill='black')
        tiles.append(tile)
    sc.close()
    cols = min(5, len(tiles)); rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (360 * cols, 640 * rows))
    for i, tile in enumerate(tiles): sheet.paste(tile, ((i % cols) * 360, (i // cols) * 640))
    out = a.out or 'preview.png'; sheet.save(out); print(out)

def render(a):
    import soundfile as sf
    from sfx import track
    plan = load_plan(a); dur = plan['duration']; n = round(dur * FPS)
    sc = Scene(plan)
    has_audio = bool(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', a.footage],
                                    capture_output=True, text=True).stdout.strip())
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / 'fx.wav'; sf.write(wav, track(dur, sc.hits, bgm=a.bgm), 48000)
        mix = '[0:a][2:a]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.9[a]' if has_audio else '[2:a]anull[a]'
        ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-i', a.footage, '-f', 'image2pipe', '-framerate', str(FPS), '-c:v', 'png', '-i', '-', '-i', str(wav),
                               '-filter_complex', f'[0:v]{zoom_filter(plan["zooms"])}[bg];[bg][1:v]overlay=0:0:shortest=1[v];{mix}',
                               '-map', '[v]', '-map', '[a]', '-t', str(dur), '-c:v', 'libx264', '-crf', '19', '-pix_fmt', 'yuv420p',
                               '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', a.out], stdin=subprocess.PIPE)
        for i in range(n):
            ff.stdin.write(sc.frame(i / FPS))
            if i % 90 == 0: print(f'{i}/{n}', flush=True)
        ff.stdin.close(); sc.close()
        if ff.wait(): sys.exit('ffmpeg failed')
    print(a.out)

ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest='cmd', required=True)
p = sub.add_parser('preview'); p.add_argument('--footage', required=True); p.add_argument('--plan', required=True); p.add_argument('--at', required=True); p.add_argument('--out')
r = sub.add_parser('render'); r.add_argument('--footage', required=True); r.add_argument('--plan', required=True); r.add_argument('--out', required=True); r.add_argument('--bgm', action='store_true')
a = ap.parse_args()
preview(a) if a.cmd == 'preview' else render(a)
