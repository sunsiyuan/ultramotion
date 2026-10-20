"""Pieces: a picture taken apart into whole paper cut-outs, each put back exactly where that thing is in the picture.

    python3 pieces.py print.jpg piece.png [piece.png=x0,y0,x1,y1 …] --out media [--width 2400] [--rim 6]

Each piece is one thing from the picture drawn whole on its own, with a transparent background, made with the image model
you can call (the crop of that thing as the reference). Give them back to front. A piece is fitted by matching its drawing
to the picture (rotation, scale, position); a piece with a box after it (picture px at --width) is stretched into that box
instead — use the box for pieces whose drawing does not match well (water, swells, plain shapes).
Writes:
    media/layout.json        { order, pieces: { name: { m: [a, b, c, d, e, f] } } } — piece px → picture px, for ctx.setTransform
    media/<name>.webp        the piece
    media/rim-<name>.webp    its cut edge: the outline grown by --rim px, paper white, drawn under the piece with the shadow
    media/check.jpg          every piece laid back on the dimmed picture — look at it
Needs numpy, opencv-python (with SIFT), Pillow.
"""
import argparse, json
from pathlib import Path
import numpy as np, cv2
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('picture'); ap.add_argument('pieces', nargs='+'); ap.add_argument('--out', default='media')
ap.add_argument('--width', type=int, default=2400); ap.add_argument('--rim', type=int, default=6); ap.add_argument('--paper', default='246,240,226')
a = ap.parse_args()
O = Path(a.out); O.mkdir(parents=True, exist_ok=True)
pic = cv2.imread(a.picture); W = a.width; H = round(W * pic.shape[0] / pic.shape[1]); pic = cv2.resize(pic, (W, H), interpolation=cv2.INTER_AREA)
sift = cv2.SIFT_create(12000)
kp, dp = sift.detectAndCompute(cv2.cvtColor(pic, cv2.COLOR_BGR2GRAY), None)
paper = np.array([int(v) for v in a.paper.split(',')][::-1], np.uint8)
order, lay, canvas = [], {}, pic.astype(np.float32) * .35
for spec in a.pieces:
    f, _, box = spec.partition('=')
    name = Path(f).stem; order.append(name)
    p = cv2.imread(f, cv2.IMREAD_UNCHANGED)
    if p.shape[2] == 3: p = np.dstack([p, np.full(p.shape[:2], 255, np.uint8)])
    al = p[..., 3]
    if box:
        X0, Y0, X1, Y1 = map(float, box.split(','))
        ys, xs = np.nonzero(al > 128); x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
        sx, sy = (X1 - X0) / (x1 - x0), (Y1 - Y0) / (y1 - y0)
        m = [sx, 0, 0, sy, X0 - x0 * sx, Y0 - y0 * sy]; how = 'box'
    else:
        k1, d1 = sift.detectAndCompute(cv2.cvtColor(p[..., :3], cv2.COLOR_BGR2GRAY), (al > 128).astype(np.uint8) * 255)
        good = [x for x, y in cv2.BFMatcher().knnMatch(d1, dp, k=2) if x.distance < .75 * y.distance]
        src = np.float32([k1[g.queryIdx].pt for g in good]); dst = np.float32([kp[g.trainIdx].pt for g in good])
        M, inl = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=6)
        if M is None: raise SystemExit(f'{name}: no fit — give it a box (=x0,y0,x1,y1)')
        m = [M[0, 0], M[1, 0], M[0, 1], M[1, 1], M[0, 2], M[1, 2]]; how = f'matched ({int(inl.sum())} of {len(good)} points agree)'
        if inl.sum() < 12: how += ' — weak, check it or give it a box'
    lay[name] = {'m': [float(v) for v in m]}
    print(name, how)
    rim = cv2.dilate((al > 20).astype(np.uint8) * 255, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * a.rim + 1, 2 * a.rim + 1)))
    rim = cv2.GaussianBlur(rim, (0, 0), 1)
    Image.fromarray(cv2.cvtColor(p, cv2.COLOR_BGRA2RGBA)).save(O / f'{name}.webp', quality=92)
    Image.fromarray(np.dstack([np.broadcast_to(paper[::-1], rim.shape + (3,)), rim]).astype(np.uint8)).save(O / f'rim-{name}.webp', quality=92)
    A = np.float32([[m[0], m[2], m[4]], [m[1], m[3], m[5]]]); w = cv2.warpAffine(p, A, (W, H)); wa = w[..., 3:] / 255.
    canvas = canvas * (1 - wa) + w[..., :3] * wa
json.dump({'order': order, 'pieces': lay}, open(O / 'layout.json', 'w'), indent=1)
cv2.imwrite(str(O / 'check.jpg'), cv2.resize(canvas.astype(np.uint8), (W // 2, H // 2)), [cv2.IMWRITE_JPEG_QUALITY, 88])
print('layout', O / 'layout.json')
