"""Stations: the same painting with its background changed, lined up, and the figure found from what never changes.

    python3 stations.py original.jpg station-a.png station-b.png … --out scenes [--width 1600]

Each station is a version of the painting made with an image model: the figure kept as it is, the background replaced.
Writes, at the original's proportions and --width:
    scenes/original.jpg        the original
    scenes/<station>.jpg       each station, warped onto the original so the figure sits exactly where it does there
    scenes/matte.png           the figure: white where no station differs from the original
    scenes/check.jpg           the matte, then each station with the original figure laid in front — look at it
Needs numpy, opencv-python, Pillow. More stations give a cleaner matte (three or more).
"""
import argparse
from pathlib import Path
import numpy as np, cv2
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('original'); ap.add_argument('stations', nargs='+'); ap.add_argument('--out', default='scenes'); ap.add_argument('--width', type=int, default=1600)
ap.add_argument('--tolerance', type=float, default=60, help='how far a station may drift from the original and still count as unchanged')
a = ap.parse_args()
O = Path(a.out); O.mkdir(parents=True, exist_ok=True)
src = Image.open(a.original).convert('RGB'); W = a.width; H = round(W * src.height / src.width)
orig = np.asarray(src.resize((W, H), Image.LANCZOS)).astype(np.float32)
g0 = cv2.GaussianBlur(cv2.cvtColor(orig, cv2.COLOR_RGB2GRAY), (0, 0), 3)
roi = np.zeros((H, W), np.uint8); cv2.ellipse(roi, (W // 2, int(H * .6)), (int(W * .4), int(H * .45)), 0, 0, 360, 255, -1)   # the middle of the picture steers the fit
diffs, out = [], {}
for f in a.stations:
    g = np.asarray(Image.open(f).convert('RGB').resize((W, H), Image.LANCZOS)).astype(np.float32)
    gg = cv2.GaussianBlur(cv2.cvtColor(g, cv2.COLOR_RGB2GRAY), (0, 0), 3)
    M = np.eye(2, 3, dtype=np.float32)
    _, M = cv2.findTransformECC(g0, gg, M, cv2.MOTION_AFFINE, (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6), roi, 5)
    w = cv2.warpAffine(g, M, (W, H), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP, borderMode=cv2.BORDER_REFLECT)
    out[Path(f).stem] = w
    diffs.append(np.abs(cv2.GaussianBlur(w, (0, 0), 6) - cv2.GaussianBlur(orig, (0, 0), 6)).sum(2))
same = (np.max(diffs, 0) < a.tolerance).astype(np.uint8)
n, lab, st, _ = cv2.connectedComponentsWithStats(same)
fig = (lab == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA])).astype(np.uint8)
fill = fig.copy(); cv2.floodFill(fill, np.zeros((H + 2, W + 2), np.uint8), (0, 0), 1); fig[fill == 0] = 1          # close holes inside her
fig = cv2.morphologyEx(fig, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (41, 41)))
fig = cv2.morphologyEx(fig, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)))
matte = cv2.GaussianBlur(fig * 255, (0, 0), 5).astype(np.uint8)
Image.fromarray(matte).save(O / 'matte.png'); Image.fromarray(orig.astype(np.uint8)).save(O / 'original.jpg', quality=92)
m = matte[..., None] / 255.; th = 600; tw = round(th * W / H)
sheet = [cv2.resize(np.repeat(matte[..., None], 3, 2), (tw, th), interpolation=cv2.INTER_AREA)]
for k, w in out.items():
    Image.fromarray(np.clip(w, 0, 255).astype(np.uint8)).save(O / f'{k}.jpg', quality=92)
    sheet.append(cv2.resize((orig * m + w * (1 - m)).astype(np.uint8), (tw, th), interpolation=cv2.INTER_AREA))
Image.fromarray(np.hstack(sheet)).save(O / 'check.jpg', quality=90)
print('stations', list(out), '→', O)
