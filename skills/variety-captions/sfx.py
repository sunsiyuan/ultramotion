"""Variety-show sound effects, numpy + scipy only, no samples.

    from sfx import track
    audio = track(duration, hits, bgm=True)   # (n, 2) float array, 48 kHz
    # hits: [{"t": seconds, "kind": "boing"}, ...]  — the page exposes them as window.__scene.hits

kinds: boing · pop · swoosh · duang · alarm · ding · drip · scratch · thud ·
       sparkle · tada · wahwah · slide-up · slide-down · fire · crickets · heartbeat · gulp · cymbal · none
The same kind used again in one track comes back at a different pitch, so repeats don't sound copied.
bgm=True adds a light plucked loop under everything; leave it off when the footage has its own music or a voice you want clean.
"""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
_rng = np.random.default_rng(3)

def _t(sec): return np.arange(int(sec * SR)) / SR
def _osc(f, x): return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, x.shape)) / SR)
def _bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def _lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)

def _saw(f, x):
    ph = np.cumsum(np.broadcast_to(f, x.shape)) / SR
    return 2 * (ph % 1) - 1
def _hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def _env(x, a, d): return np.minimum(1, x / max(a, 1e-4)) * np.exp(-np.maximum(0, x - a) * d)
def _hz(m): return 440 * 2 ** ((m - 69) / 12)

def sound(kind, p=1.0):
    """one effect; p scales the pitch (track() varies it on repeats)"""
    if kind == 'boing':
        x = _t(.45); f = (220 + 520 * np.exp(-x * 9)) * p + 18 * np.sin(2 * np.pi * 18 * x)
        return _osc(f, x) * np.exp(-x * 6) * .6
    if kind == 'pop':
        x = _t(.12); return _osc((900 - 600 * x / .12) * p, x) * np.exp(-x * 40) * .6
    if kind == 'swoosh':
        x = _t(.4); n = _rng.standard_normal(len(x)); env = np.sin(np.pi * x / .4) ** 2
        return _bp(n, 600 * p, min(5000 * p, 20000)) * env * .35
    if kind == 'duang':
        x = _t(1.0); low = _osc((60 + 90 * np.exp(-x * 20)) * p, x) * np.exp(-x * 5)
        ring = sum(_osc(f * p, x) * a for f, a in ((523, .3), (784, .2), (1046, .12))) * np.exp(-x * 3.5)
        return (low * .9 + ring * .5) * .7
    if kind == 'alarm':
        x = _t(.9); f = np.where((x * 6).astype(int) % 2 == 0, 880, 660) * p
        return np.sign(_osc(f, x)) * .18 * (x < .85)
    if kind == 'ding':
        x = _t(.9); return (_osc(1568 * p, x) + .4 * _osc(3136 * p, x)) * np.exp(-x * 5) * .35
    if kind == 'drip':
        x = _t(.25); return _osc((500 + 900 * x / .25) * p, x) * np.exp(-x * 22) * .5
    if kind == 'scratch':
        x = _t(.5); n = _rng.standard_normal(len(x)); f = (300 + 900 * np.abs(np.sin(2 * np.pi * 3 * x))) * p
        return _bp(n, 400, 3000) * .3 + _osc(f, x) * .15 * np.exp(-x * 4)
    if kind == 'thud':
        x = _t(.4); return _osc((55 + 60 * np.exp(-x * 25)) * p, x) * np.exp(-x * 10) * .9 + _bp(_rng.standard_normal(len(x)), 100, 900) * np.exp(-x * 40) * .3
    if kind == 'sparkle':                                   # rising glassy arpeggio — something lovely, a highlight
        out = np.zeros(int(.7 * SR))
        for k, m in enumerate((84, 88, 91, 96, 100)):
            x = _t(.45); v = (_osc(_hz(m) * p, x) + .3 * _osc(_hz(m) * 2 * p, x)) * np.exp(-x * 9) * .22
            a = int(k * .055 * SR); out[a:a + len(v)] += v[:len(out) - a]
        return out
    if kind == 'tada':                                      # two brassy major chords, short–long — success, a verdict
        out = np.zeros(int(1.1 * SR))
        for st, dur in ((0, .13), (.16, .8)):
            x = _t(dur); ch = sum(_saw(_hz(m) * p, x) for m in (60, 64, 67, 72)) / 4
            v = _lp(ch, 2600) * _env(x, .015, 2.5 if dur > .5 else 12) * .55
            a = int(st * SR); out[a:a + len(v)] += v
        return out
    if kind == 'wahwah':                                    # sad trombone, four falling notes — failure, disappointment
        out = np.zeros(int(1.9 * SR))
        for k, (m, dur) in enumerate(((58, .32), (57, .32), (56, .32), (55, .85))):
            x = _t(dur); f = _hz(m) * p * (1 + .012 * np.sin(2 * np.pi * 5.5 * x) * (dur > .5))
            v = _lp(_saw(f, x), 1300) * _env(x, .03, 1.5) * .45
            a = int(k * .34 * SR); out[a:a + len(v)] += v[:len(out) - a]
        return out
    if kind in ('slide-up', 'slide-down'):                  # slide whistle — rising hopes / sinking feeling
        x = _t(.7); g = x / .7 if kind == 'slide-up' else 1 - x / .7
        f = (500 + 1100 * g) * p * (1 + .02 * np.sin(2 * np.pi * 7 * x))
        return _osc(f, x) * np.sin(np.pi * x / .7) ** .5 * .35
    if kind == 'fire':                                      # whoosh of flame + crackle — spicy, heated
        x = _t(1.1); n = _rng.standard_normal(len(x))
        roar = _lp(_bp(n, 150, 2500), 1800) * np.minimum(1, x / .08) * np.exp(-x * 2.2) * .6
        crack = (_rng.random(len(x)) > .9985) * _rng.standard_normal(len(x)) * 4
        return (roar + _hp(crack, 2000) * np.exp(-x * 1.5) * .25) * .5
    if kind == 'crickets':                                  # chirps in silence — awkward pause
        out = np.zeros(int(1.4 * SR))
        for k in range(4):
            x = _t(.16); v = _osc(4200 * p, x) * (np.sin(2 * np.pi * 30 * x) > 0) * np.sin(np.pi * x / .16) * .3
            a = int(k * .34 * SR); out[a:a + len(v)] += v
        return out
    if kind == 'heartbeat':                                 # lub-dub twice — suspense, before a reveal
        out = np.zeros(int(1.5 * SR))
        for st in (0, .18, .75, .93):
            x = _t(.18); v = _osc((60 - 20 * x / .18) * p, x) * np.exp(-x * 22) * (.9 if st in (0, .75) else .6)
            a = int(st * SR); out[a:a + len(v)] += v
        return out
    if kind == 'gulp':                                      # swallow — nervous, "uh oh"
        x = _t(.22); return _osc((420 - 260 * x / .22) * p, x) * np.exp(-((x - .06) / .05) ** 2) * .5
    if kind == 'cymbal':                                    # crash — a big reveal, end of a joke
        x = _t(1.6); n = _rng.standard_normal(len(x))
        return _hp(_bp(n, 3000, 14000), 2500) * _env(x, .003, 2.6) * .35
    return np.zeros(1)

PITCH = [1, 1.19, .89, 1.33, 1.06, .84, 1.26]              # repeats of one kind step through these

def _bgm(n):
    out = np.zeros(n); beat = 60 / 112
    bass = [48, 48, 55, 55, 53, 53, 55, 55]; mel = [72, 76, 79, 76, 77, 74, 79, 74]
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    for i in range(int(n / SR / (beat / 2)) + 1):
        t = i * beat / 2; k = i % 16
        for m, g, dec in ((bass[(k // 2) % 8], .22, 9), (mel[k % 8], .10, 14)):
            if m == mel[k % 8] and k % 2: continue
            x = _t(.35); v = (_osc(hz(m), x) + .3 * _osc(hz(m) * 2, x)) * np.exp(-x * dec) * g
            a = int(t * SR); z = min(n, a + len(v))
            if a < n: out[a:z] += v[:z - a]
    return _lp(out, 3500)

def track(duration, hits, bgm=False):
    n = int((duration + .5) * SR); L = np.zeros(n); seen = {}
    for h in hits:
        k = h['kind']; i = seen.get(k, 0); seen[k] = i + 1
        v = sound(k, PITCH[i % len(PITCH)]); a = int(h['t'] * SR); z = min(n, a + len(v))
        if 0 <= a < n: L[a:z] += v[:z - a]
    if bgm: L += _bgm(n)
    out = np.stack([L, L], 1)
    return out / (np.abs(out).max() + 1e-9) * .85
