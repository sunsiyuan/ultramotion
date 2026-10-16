"""Kinetic Type soundtrack: numpy + scipy only, no samples.

    from score import score
    music = score(duration, hits, bpm=128, drums=True)   # (n, 2) float array, 48 kHz

A minor, Am · F · C · G, one chord per bar.
Drums: kick on every beat, clap on 2 and 4, 8th-note hats. Bass on the off-beats, ducked by the kick.
At every time in `hits` (a word slamming in): a short chord stab and a low impact.
drums=False drops kick, clap and hats — for under a voice-over.
"""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000

def score(duration, hits=(), bpm=128, drums=True):
    n = int((duration + 1.0) * SR)
    rng = np.random.default_rng(5)
    lp = lambda x, f: sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
    hp = lambda x, f: sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    def osc(f, L, kind='sine'):
        ph = np.cumsum(np.broadcast_to(f, (L,))) / SR
        return np.sin(2 * np.pi * ph) if kind == 'sine' else 2 * (ph % 1) - 1
    def put(buf, x, t, g=1.0):
        i = int(t * SR); a, z = max(0, i), min(len(buf), i + len(x))
        if a < z: buf[a:z] += x[a - i:z - i] * g
    beat = 60 / bpm; bar = 4 * beat
    CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]           # Am F C G
    ROOT = [33, 29, 36, 31]
    L_, R_ = np.zeros(n), np.zeros(n)
    duck = np.ones(n)

    if drums:
        for i in range(int(duration / beat) + 1):
            t = i * beat; Lk = int(.3 * SR); x = np.arange(Lk) / SR
            kick = osc(45 + 110 * np.exp(-x * 28), Lk) * np.exp(-x * 9) * .9 + hp(rng.standard_normal(Lk), 3000) * np.exp(-x * 120) * .08
            put(L_, kick, t); put(R_, kick, t)
            k0 = int(t * SR); kL = int(.18 * SR)
            if k0 < n: duck[k0:k0 + kL] = np.minimum(duck[k0:k0 + kL], np.linspace(.25, 1, len(duck[k0:k0 + kL])) ** 1.5)
            if i % 2 == 1:                                                  # clap on 2 and 4
                Lc = int(.25 * SR); x = np.arange(Lc) / SR; nz = sosfilt(butter(2, [900, 4000], 'band', fs=SR, output='sos'), rng.standard_normal(Lc))
                clap = nz * (np.exp(-x * 30) + .5 * np.exp(-np.maximum(0, x - .012) * 30) * (x > .012)) * .35
                put(L_, clap * .9, t); put(R_, clap, t + .004)
            for h in (0, .5):                                               # hats on the 8ths, open on the off-beat
                Lh = int((.09 if h else .04) * SR); x = np.arange(Lh) / SR
                hat = hp(rng.standard_normal(Lh), 8000) * np.exp(-x * (25 if h else 90)) * (.13 if h else .07)
                put(L_, hat * (1.1 if h else .8), t + h * beat); put(R_, hat * (.8 if h else 1.1), t + h * beat)

    pad = np.zeros(n)
    for k in range(int(duration / bar) + 2):                                # off-beat bass
        root = ROOT[k % 4]
        for i in range(4):
            t = k * bar + (i + .5) * beat; Lb = int(beat * .45 * SR); x = np.arange(Lb) / SR
            bass = lp(osc(hz(root), Lb, 'saw') + .5 * osc(hz(root - 12), Lb), 900) * np.minimum(1, x / .005) * np.exp(-x * 6) * .32
            put(pad, bass, t)
    pad *= duck
    L_ += pad; R_ += pad

    for t in hits:                                                          # chord stab + low impact on every hit
        k = int(t / bar) % 4; Ls = int(.5 * SR); x = np.arange(Ls) / SR
        stab = sum(lp(osc(hz(m + 12) * (1 + d), Ls, 'saw'), 3500) for m in CH[k] for d in (-.004, .004)) * np.exp(-x * 7) * .07
        boom = osc(38 + 40 * np.exp(-x * 14), Ls) * np.exp(-x * 5) * .5
        put(L_, stab + boom, t); put(R_, stab * .9 + boom, t)

    out = np.stack([L_, R_], 1)
    fade = np.minimum(1, np.arange(n) / SR / .05) * np.clip((duration + .2 - np.arange(n) / SR) / .6, 0, 1)
    out *= fade[:, None]
    return out / (np.abs(out).max() + 1e-9) * .85
