"""A dark shaded-relief base map for a lon/lat box, from open elevation tiles (AWS Terrain Tiles, no key).

    python3 relief.py --box 88 10 106 28 --width 2400 --out data/relief-myanmar.jpg
    python3 relief.py --box -126 23 -65 50 --width 3000 --style night --out data/relief-us.jpg

The image is equirectangular (lon and lat linear), so on the page it lines up with Replay.proj:
    Replay.basemap(ctx, img, [w, s, e, n], P)            — the box is written next to it as <out>.json
--style dark   (default) charcoal land, shading from the north-west, near-black sea with faint depth
--style night  bluer, for night scenes
--exaggerate   vertical exaggeration of the shading (default 1.6; more for flat countries)
--feather      how far the edges fade into black (default .08 of the size); 0 for a detail map laid over a wider one
"""
import argparse, json, math, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import numpy as np
from PIL import Image

URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
CACHE = Path.home() / '.ultramotion' / 'terrarium'

def tile(z, x, y):
    f = CACHE / f'{z}-{x}-{y}.png'
    if not f.exists():
        f.parent.mkdir(parents=True, exist_ok=True)
        for k in range(5):
            try: f.write_bytes(urllib.request.urlopen(URL.format(z=z, x=x % (2 ** z), y=y), timeout=60).read()); break
            except OSError:
                if k == 4: raise
                time.sleep(1 + k)
    a = np.asarray(Image.open(f).convert('RGB'), dtype=np.float32)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

def mx(lon, z): return (lon + 180) / 360 * 2 ** z * 256
def my(lat, z): r = math.radians(lat); return (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * 2 ** z * 256

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--box', nargs=4, type=float, required=True, metavar=('W', 'S', 'E', 'N'))
    ap.add_argument('--width', type=int, default=2400); ap.add_argument('--out', required=True)
    ap.add_argument('--style', default='dark'); ap.add_argument('--exaggerate', type=float, default=1.6); ap.add_argument('--feather', type=float, default=.08)
    a = ap.parse_args(); w, s, e, n = a.box
    W = a.width; H = int(round(W * (n - s) / ((e - w) * math.cos(math.radians((n + s) / 2)))))
    z = max(1, min(11, int(math.log2(W / ((e - w) / 360 * 256))) + 1))                     # a little finer than the output
    x0, x1, y0, y1 = int(mx(w, z) // 256), int(mx(e, z) // 256), int(my(n, z) // 256), int(my(s, z) // 256)
    jobs = [(z, x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]
    print(f'zoom {z}: {len(jobs)} tiles → {W}×{H}')
    with ThreadPoolExecutor(8) as ex: tiles = list(ex.map(lambda j: tile(*j), jobs))
    mosaic = np.zeros(((y1 - y0 + 1) * 256, (x1 - x0 + 1) * 256), np.float32)
    for (zz, x, y), t in zip(jobs, tiles): mosaic[(y - y0) * 256:(y - y0 + 1) * 256, (x - x0) * 256:(x - x0 + 1) * 256] = t
    # resample to equirectangular
    lons = w + (np.arange(W) + .5) / W * (e - w); lats = n - (np.arange(H) + .5) / H * (n - s)
    px = np.clip((mx(lons, z) - x0 * 256).astype(int), 0, mosaic.shape[1] - 1)
    py = np.clip((np.array([my(l, z) for l in lats]) - y0 * 256).astype(int), 0, mosaic.shape[0] - 1)
    el = mosaic[py[:, None], px[None, :]]
    # hillshade, light from the north-west
    cell = (e - w) / W * 111320 * math.cos(math.radians((n + s) / 2))
    gy, gx = np.gradient(np.maximum(el, 0) * a.exaggerate, cell)
    slope = np.arctan(np.hypot(gx, gy)); aspect = np.arctan2(-gx, gy)
    az, alt = math.radians(315), math.radians(40)
    shade = np.clip(np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect), 0, 1)
    land = el > 0
    if a.style == 'night': base, tint, sea = np.array([22, 26, 36]), np.array([70, 80, 105]), np.array([6, 8, 14])
    else: base, tint, sea = np.array([24, 25, 28]), np.array([88, 88, 90]), np.array([8, 9, 11])
    height = np.clip(el / 3500, 0, 1)[..., None]
    rgb = base + (shade[..., None] - .55) * tint * 1.4 + height * 14
    depth = np.clip(-el / 5000, 0, 1)[..., None]
    rgb = np.where(land[..., None], rgb, sea * (1 - .5 * depth) + 3)
    f = max(a.feather, 1e-6); fy = np.clip(np.minimum(np.arange(H), H - 1 - np.arange(H)) / (H * f), 0, 1); fx = np.clip(np.minimum(np.arange(W), W - 1 - np.arange(W)) / (W * f), 0, 1)
    edge = (np.minimum(fy[:, None], fx[None, :]) ** 1.5)[..., None]                            # the edges fade into the page's black, so the box never shows
    rgb = rgb * edge + np.array([10, 10, 11]) * (1 - edge)
    Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8)).save(a.out, quality=90)
    Path(a.out + '.json').write_text(json.dumps({'box': [w, s, e, n], 'width': W, 'height': H}))
    print(a.out)

if __name__ == '__main__': main()
