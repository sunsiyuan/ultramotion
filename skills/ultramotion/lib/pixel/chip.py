"""Chiptune for pixel videos: two pulse channels, a triangle and a noise channel, the way an 8-bit console sounds,
plus the console's sound effects. render.py calls it for music.chip and for the sounds below.

    from chip import render, SFX
    audio = render(duration, notes, sfx)        # (n, 2) float array, 48 kHz, stereo

notes  [{ "t": s, "m": MIDI note, "d": s, "ch": ch, "v": 0..1, "duty": .25, "env": "pluck", "vib": 0, "slide": 0 }, …]
  ch     pulse, pulse2   square waves — duty .125 thin and nasal, .25 bright, .5 round and hollow
         tri             triangle — soft; the bass line, or a low, gentle melody
         noise           drums — "kind": kick | snare | hat | openhat | crash  (m is ignored)
  env    pluck  falls away like a struck note (default on pulse) · hold  stays to the end (default on tri) · swell  rises in
  vib    vibrato depth in semitones, coming in after the first 0.15 s of a long note (.1–.2)
  slide  semitones to bend across the note (−12 a drop, +2 a scoop)
sfx    [{ "t": s, "kind": k, "v": 0..1, "pitch": semitones }, …]
  coin jump select confirm cancel text powerup levelup oneup hurt explode warp step land pause count go door
"""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
hz = lambda m: 440 * 2 ** ((np.asarray(m, float) - 69) / 12)

def _lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def _hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)

def _blep(t, dt):
    out = np.zeros_like(t); a = t < dt; x = t[a] / dt[a] if np.ndim(dt) else t[a] / dt; out[a] = 2 * x - x * x - 1
    b = t > 1 - dt; x = (t[b] - 1) / (dt[b] if np.ndim(dt) else dt); out[b] = x * x + 2 * x + 1
    return out

def _freq(m, n, vib=0, slide=0):
    x = np.arange(n) / SR; semis = m + slide * np.minimum(1, x / max(x[-1], 1e-3)) if n > 1 else np.full(n, float(m))
    if vib: semis = semis + vib * np.sin(2 * np.pi * 5.5 * x) * np.clip((x - .15) / .1, 0, 1)
    return hz(semis)

def pulse(f, duty=.25):
    """band-limited pulse wave, f per sample"""
    dt = f / SR; ph = np.cumsum(dt) % 1
    y = np.where(ph < duty, 1.0, -1.0) + _blep(ph, dt) - _blep((ph - duty) % 1, dt)
    return y - (2 * duty - 1)

def tri(f):
    """the console triangle: 16 steps up and down"""
    ph = np.cumsum(f / SR) % 1; y = 1 - 4 * np.abs(ph - .5)
    return _lp(np.round(y * 7.5) / 7.5, 6000)

def noise(n, rate, seed=0, short=False):
    """sample-and-hold noise at a clock rate; short = the metallic looped mode"""
    r = np.random.default_rng(seed); k = (np.arange(n) * rate / SR).astype(int)
    vals = r.choice([-1.0, 1.0], 93 if short else k[-1] + 2 if n else 1)
    return vals[k % len(vals)]

def _env(kind, n, d):
    x = np.arange(n) / SR
    if kind == 'hold': e = np.ones(n)
    elif kind == 'swell': e = np.clip(x / .18, 0, 1)
    else: e = .3 + .7 * np.exp(-x * 7)
    e = np.ceil(e * 15) / 15                                                       # 16 volume steps
    e *= np.clip(x / .003, 0, 1) * np.clip((d - x) / .012, 0, 1)
    return e

LEVEL = {'pulse': .2, 'pulse2': .17, 'tri': .42, 'noise': .3}
PAN = {'pulse': -.22, 'pulse2': .22, 'tri': 0, 'noise': .05}

def drum(kind, v=1.0, seed=0):
    if kind == 'kick':
        n = int(.16 * SR); x = np.arange(n) / SR
        body = tri(180 * np.exp(-x * 24) + 42) * np.exp(-x * 16)
        return (body * 1.1 + noise(n, 9000, seed) * np.exp(-x * 220) * .35) * v
    if kind == 'snare':
        n = int(.2 * SR); x = np.arange(n) / SR
        return (noise(n, 14000, seed) * np.ceil(np.exp(-x * 18) * 15) / 15 * .8 + tri(220 * np.exp(-x * 10) + 120) * np.exp(-x * 30) * .5) * v
    if kind in ('hat', 'openhat'):
        n = int((.05 if kind == 'hat' else .28) * SR); x = np.arange(n) / SR
        return _hp(noise(n, 40000, seed, short=False), 5000) * np.exp(-x * (80 if kind == 'hat' else 11)) * .6 * v
    if kind == 'crash':
        n = int(1.0 * SR); x = np.arange(n) / SR
        return _hp(noise(n, 30000, seed), 2500) * np.exp(-x * 3.5) * .55 * v
    return np.zeros(1)

def voice(nt, seed=0):
    ch = nt.get('ch', 'pulse'); v = nt.get('v', .7)
    if ch == 'noise': return drum(nt.get('kind', 'snare'), v, seed)
    d = max(.02, nt.get('d', .25)); n = int(d * SR)
    f = _freq(nt.get('m', 60), n, nt.get('vib', 0), nt.get('slide', 0))
    if ch == 'tri': y = tri(f); env = _env(nt.get('env', 'hold'), n, d)
    else: y = pulse(f, nt.get('duty', .25 if ch == 'pulse' else .5)); env = _env(nt.get('env', 'pluck'), n, d)
    return y * env * v

def _place(buf, y, t, pan):
    a = int(round(t * SR))
    if a >= len(buf) or len(y) < 2: return
    if a < 0: y = y[-a:]; a = 0
    z = min(len(buf), a + len(y)); g = np.array([np.sqrt(.5 * (1 - pan)), np.sqrt(.5 * (1 + pan))]) * np.sqrt(2)
    buf[a:z] += y[:z - a, None] * g[None]

# ---------- sound effects, as short note lists on the same channels ----------
def sfx_notes(kind, p=0):
    N = lambda t, m, d, ch='pulse', v=.8, **k: dict(t=t, m=m + p, d=d, ch=ch, v=v, **k)
    if kind == 'coin': return [N(0, 83, .07, duty=.5, env='hold'), N(.07, 88, .38, duty=.5)]
    if kind == 'jump': return [N(0, 62, .2, duty=.25, slide=10, env='pluck')]
    if kind == 'select': return [N(0, 81, .05, duty=.25, env='hold', v=.6)]
    if kind == 'confirm': return [N(0, 76, .06, duty=.5, env='hold', v=.7), N(.06, 81, .14, duty=.5, v=.7)]
    if kind == 'cancel': return [N(0, 81, .06, duty=.5, env='hold', v=.6), N(.06, 76, .14, duty=.5, v=.6)]
    if kind == 'text': return [N(0, 74, .028, duty=.5, env='hold', v=.4)]
    if kind == 'step': return [dict(t=0, ch='noise', kind='hat', v=.35)]
    if kind == 'land': return [N(0, 40, .08, 'tri', 1.0, slide=-5)]
    if kind == 'pause': return [N(0, 83, .05, env='hold', v=.6), N(.09, 83, .05, env='hold', v=.6), N(.18, 88, .12, v=.6)]
    if kind == 'count': return [N(0, 69, .12, duty=.5, env='hold', v=.7)]
    if kind == 'go': return [N(0, 81, .45, duty=.5, env='pluck', v=.8)]
    if kind == 'powerup': return [N(k * .035, m, .035, duty=.25, env='hold', v=.6) for k, m in enumerate([60, 64, 67, 72, 62, 66, 69, 74, 64, 68, 71, 76, 65, 69, 72, 77])]
    if kind == 'oneup': return [N(k * .1, m, .1, duty=.5, env='hold', v=.6) for k, m in enumerate([76, 79, 88, 84, 86, 91])]
    if kind == 'levelup':
        return [N(0, 72, .09, duty=.5, env='hold'), N(.09, 76, .09, duty=.5, env='hold'), N(.18, 79, .09, duty=.5, env='hold'), N(.27, 84, .6, duty=.5, vib=.15),
                N(0, 64, .09, 'pulse2', .5, env='hold'), N(.09, 67, .09, 'pulse2', .5, env='hold'), N(.18, 72, .09, 'pulse2', .5, env='hold'), N(.27, 76, .6, 'pulse2', .5),
                N(0, 48, .27, 'tri', .9), N(.27, 48, .6, 'tri', .9)]
    if kind == 'hurt': return [N(0, 70, .18, duty=.125, slide=-14, env='pluck'), dict(t=0, ch='noise', kind='snare', v=.5)]
    if kind == 'warp': return [N(0, 76, .7, duty=.5, slide=-30, vib=.4, env='hold', v=.6)]
    if kind == 'door': return [dict(t=k * .05, ch='noise', kind='snare', v=.35 - k * .05) for k in range(5)]
    return []
SFX = ('coin', 'jump', 'select', 'confirm', 'cancel', 'text', 'step', 'land', 'pause', 'count', 'go', 'powerup', 'oneup', 'levelup', 'hurt', 'explode', 'warp', 'door')

def explode(v=1.0, seed=0):
    n = int(.9 * SR); x = np.arange(n) / SR; rate = 6000 * np.exp(-x * 2.2) + 400
    k = np.cumsum(rate / SR).astype(int); vals = np.random.default_rng(seed).choice([-1.0, 1.0], k[-1] + 2)
    return vals[k] * np.ceil(np.exp(-x * 4) * 15) / 15 * .9 * v

def render(duration, notes=None, sfx=None):
    n = int((duration + .5) * SR); mus = np.zeros((n, 2)); fx = np.zeros((n, 2))
    for i, nt in enumerate(notes or []):
        _place(mus, voice(nt, seed=i) * LEVEL.get(nt.get('ch', 'pulse'), .2), nt['t'], PAN.get(nt.get('ch', 'pulse'), 0))
    for i, s in enumerate(sfx or []):
        k, v, p = s.get('kind'), s.get('v', 1.0), s.get('pitch', 0)
        if k == 'explode': _place(fx, explode(v, i) * .35, s['t'], 0); continue
        for nt in sfx_notes(k, p):
            nt = dict(nt, v=nt.get('v', .8) * v); _place(fx, voice(nt, seed=1000 + i) * LEVEL.get(nt.get('ch', 'pulse'), .2) * 1.3, s['t'] + nt['t'], 0)
    out = mus + fx
    out = np.stack([_lp(_hp(out[:, c], 35), 9500) for c in range(2)], 1)
    try:
        from sound import reverb                                                    # a little room, so it doesn't sound like it's inside your ear
        out = np.stack([reverb(out[:, c], .1)[:, c] for c in range(2)], 1)
    except Exception: pass
    return out
