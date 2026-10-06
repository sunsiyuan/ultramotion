"""Sound for hand-drawn videos: the drawing tool on its surface, camera moves, little accents and a music bed.
numpy + scipy only, no samples.

    from sound import track
    audio = track(duration, sounds, music)   # (n, 2) float array, 48 kHz
    # sounds: [{"t": s, "dur": s, "kind": "marker"}, …]   music: {"style": "lofi", "bpm": 84, "lift": [8.5]}

tools   marker · pencil · chalk · highlighter · erase        (dur = how long the stroke lasts)
moves   whoosh · swish · page
accents pop · ding · tap · sparkle · tada · thud
music   your own piece, one of three ways:
        { "notes": [{ "t": 0.0, "m": 72, "d": 0.4, "inst": "kalimba", "v": 0.8 }, …] }   notes the page writes (m = MIDI note, d = seconds)
        { "file": "music.wav" }                                                            anything you synthesised yourself
        { "style": "marimba" | "lofi" | "piano", "bpm": 96, "lift": [8.5] }               three ready arrangements, as starting points
instruments for notes: kalimba bell marimba piano pluck pad bass organ whistle · drums: kick snare hat clap shaker
"""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
_rng = np.random.default_rng(11)

def _bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def _lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def _hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def _osc(f, n): return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, (n,))) / SR)
def _x(sec): n = max(1, int(sec * SR)); return n, np.arange(n) / SR
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

def tool(kind, dur):
    n, x = _x(max(dur, .03)); noise = _rng.standard_normal(n)
    edge = np.minimum(1, x / .012) * np.clip((dur - x) / .03, 0, 1)
    press = (1 + .5 * _lp(_rng.standard_normal(n), 25) * 6).clip(.3, 1.7)          # how hard the hand presses, moment to moment
    if kind == 'pencil':
        grain = (_rng.random(n) > .985) * _rng.standard_normal(n) * 3                  # paper tooth
        return (_bp(noise, 1800, 6000) * .5 + _hp(grain, 2500) * .25) * edge * press * .13
    if kind == 'chalk':
        s = _bp(noise, 700, 4200) * edge * press * .2
        k, xk = _x(.03); s[:k] += _bp(_rng.standard_normal(k), 1500, 6000) * np.exp(-xk * 160) * .5   # tap on the board
        return s
    if kind == 'highlighter':
        return _bp(noise, 900, 3800) * edge * press * .12
    if kind == 'erase':
        return _bp(noise, 300, 2600) * edge * (.6 + .4 * np.sin(2 * np.pi * 7 * x)) * .26
    return _bp(noise, 2200, 7500) * edge * press * .15                                  # marker

def accent(kind, dur=0):
    if kind == 'whoosh':
        n, x = _x(max(dur, .5)); return _lp(_bp(_rng.standard_normal(n), 150, 1800), 1200) * np.sin(np.pi * x / x[-1]) ** 2 * .25
    if kind == 'swish':
        n, x = _x(.35); return _bp(_rng.standard_normal(n), 900, 7000) * np.sin(np.pi * x / .35) ** 3 * .3
    if kind == 'page':
        n, x = _x(.45); return _bp(_rng.standard_normal(n), 500, 6000) * (np.sin(np.pi * x / .45) ** 2) * (1 + .6 * np.sin(2 * np.pi * 22 * x)) * .28
    if kind == 'pop':
        n, x = _x(.14); return _osc(950 - 600 * x / .14, n) * np.exp(-x * 36) * .5
    if kind == 'ding':
        n, x = _x(1.0); return (_osc(1568, n) + .4 * _osc(3136, n)) * np.exp(-x * 4.5) * .3
    if kind == 'tap':
        n, x = _x(.08); return _bp(_rng.standard_normal(n), 1200, 5000) * np.exp(-x * 90) * .6
    if kind == 'sparkle':
        out = np.zeros(int(.7 * SR))
        for k, m in enumerate((84, 88, 91, 96)):
            n, x = _x(.45); v = (_osc(hz(m), n) + .3 * _osc(hz(m) * 2, n)) * np.exp(-x * 9) * .2; a = int(k * .06 * SR); out[a:a + n] += v[:len(out) - a]
        return out
    if kind == 'tada':
        out = np.zeros(int(1.1 * SR))
        for st, d in ((0, .13), (.16, .8)):
            n, x = _x(d); ph = np.cumsum(np.ones(n)) / SR; ch = sum(2 * ((hz(m) * ph) % 1) - 1 for m in (60, 64, 67, 72)) / 4
            v = _lp(ch, 2600) * np.minimum(1, x / .015) * np.exp(-x * (2.5 if d > .5 else 12)) * .45; a = int(st * SR); out[a:a + n] += v
        return out
    if kind == 'thud':
        n, x = _x(.4); return _osc(55 + 60 * np.exp(-x * 25), n) * np.exp(-x * 10) * .8
    return np.zeros(1)

CHORDS = [(60, 64, 67, 71), (57, 60, 64, 67), (53, 57, 60, 64), (55, 59, 62, 65)]          # Cmaj7 Am7 Fmaj7 G7
def music(n, style='marimba', bpm=None, lift=()):
    if style in (None, 'none'): return np.zeros(n)
    bpm = bpm or {'marimba': 104, 'lofi': 80, 'piano': 72}.get(style, 96); beat = 60 / bpm; bar = beat * 4
    out = np.zeros(n); full = np.zeros(n); lifts = sorted(lift or [])
    def add(buf, t, v):
        a = int(t * SR); z = min(n, a + len(v))
        if 0 <= a < n: buf[a:z] += v[:z - a]
    def note(m, d, dec, kind='pluck'):
        k, x = _x(d)
        if kind == 'keys': return (_osc(hz(m), k) + .5 * _osc(hz(m) * 2, k) * np.exp(-x * 3)) * np.exp(-x * dec) * np.minimum(1, x / .01)
        if kind == 'soft': return (_osc(hz(m), k) + .2 * _osc(hz(m) * 3, k) * np.exp(-x * 6)) * np.minimum(1, x / .02) * np.exp(-x * dec)
        return (_osc(hz(m), k) + .25 * _osc(hz(m) * 4, k) * np.exp(-x * 30)) * np.exp(-x * dec)
    total = n / SR; i = 0
    while i * beat / 2 < total:
        t = i * beat / 2; ch = CHORDS[int(t / bar) % 4]; s8 = i % 8; lifted = any(t >= L for L in lifts)
        if style == 'marimba':
            add(out, t, note(ch[[0, 2, 1, 2, 3, 2, 1, 2][s8]] + 12, .5, 11) * .09)
            if s8 == 0: add(full if lifts else out, t, note(ch[0] - 24, 1.2, 3) * .2)
            if lifted and s8 in (0, 4): add(full, t, _lp(_rng.standard_normal(int(.08 * SR)), 180) * np.exp(-np.arange(int(.08 * SR)) / SR * 40) * .5)
        elif style == 'lofi':
            if s8 == 0: [add(out, t + k * .03, note(m, bar * .95, 1.3, 'keys') * .055) for k, m in enumerate(ch)]
            if lifted or not lifts:
                if s8 in (0, 5): kk, xk = _x(.25); add(full, t, _osc(60 * np.exp(-xk * 8) + 40, kk) * np.exp(-xk * 14) * .5)
                if s8 in (2, 6): kk, xk = _x(.12); add(full, t, _bp(_rng.standard_normal(kk), 1500, 6000) * np.exp(-xk * 30) * .12)
                kk, xk = _x(.05); add(full, t, _hp(_rng.standard_normal(kk), 6000) * np.exp(-xk * 80) * .05)
            if s8 == 0 and (lifted or not lifts): add(full, t, note(ch[0] - 24, bar * .9, 1.5, 'soft') * .16)
        elif style == 'piano':
            if s8 in (0, 2, 4, 6): add(out, t, note(ch[s8 // 2] + 12, 1.6, 2.2, 'soft') * .08)
            if s8 == 0: add(out, t, note(ch[0] - 12, bar, 1.2, 'soft') * .1)
            if lifted and s8 in (1, 3, 5, 7): add(full, t, note(ch[(s8 // 2 + 2) % 4] + 24, .8, 5, 'soft') * .04)
        i += 1
    if lifts:                                                                         # bring the fuller layer in over a second at each lift
        gain = np.zeros(n); x = np.arange(n) / SR
        for L in lifts: gain = np.maximum(gain, np.clip((x - L) / 1.0, 0, 1))
        full *= gain
    if style == 'lofi': out += _lp(_rng.standard_normal(n), 3000) * .006                 # vinyl hiss
    return _lp(out + full, 5000)

def instrument(inst, m, d, v=.8):
    """one note"""
    n, x = _x(d); f = hz(m); env_in = np.minimum(1, x / .006)
    soft = float(np.clip((84 - m) / 18, .15, 1))                     # high notes: overtones fade out so they stay round, not piercing
    if inst == 'kick': return _osc(50 + 90 * np.exp(-x * 30), n) * np.exp(-x * 12) * v
    if inst == 'snare': return (_bp(_rng.standard_normal(n), 1200, 6000) * .7 + _osc(190, n) * .4) * np.exp(-x * 18) * v * .6
    if inst == 'hat': return _hp(_rng.standard_normal(n), 7000) * np.exp(-x * 60) * v * .35
    if inst == 'clap': return _bp(_rng.standard_normal(n), 900, 3000) * (np.exp(-x * 30) + .5 * np.exp(-((x - .02) * 120) ** 2)) * v * .5
    if inst == 'shaker': return _bp(_rng.standard_normal(n), 4000, 10000) * np.sin(np.pi * np.clip(x / .08, 0, 1)) * v * .25
    if inst == 'kalimba': return (_osc(f, n) + .35 * soft * _osc(f * 5.4, n) * np.exp(-x * 25)) * np.exp(-x * 5) * env_in * v * .5 * (.6 + .4 * soft)
    if inst == 'bell': return sum(_osc(f * r, n) * a * (1 if r == 1 else soft) * np.exp(-x * k) for r, a, k in ((1, .6, 2.2), (2.76, .25, 4), (5.4, .12, 7))) * env_in * v * .5 * (.6 + .4 * soft)
    if inst == 'marimba': return (_osc(f, n) + .25 * soft * _osc(f * 4, n) * np.exp(-x * 30)) * np.exp(-x * 9) * env_in * v * .55 * (.6 + .4 * soft)
    if inst == 'piano': return (_osc(f, n) + .45 * _osc(f * 2, n) * np.exp(-x * 3) + .15 * _osc(f * 3, n) * np.exp(-x * 5)) * np.exp(-x * 2.2) * env_in * v * .45
    if inst == 'pluck':
        p = max(2, int(SR / f)); buf = _rng.uniform(-1, 1, p); out = np.zeros(n)
        for i in range(n): out[i] = buf[i % p]; buf[i % p] = .5 * (buf[i % p] + buf[(i + 1) % p]) * .996
        return out * env_in * v * .5
    if inst == 'pad': return _lp(sum(_osc(f * (1 + dt), n) for dt in (-.006, 0, .006)) / 3, 2000) * np.minimum(1, x / .3) * np.clip((d - x) / .4, 0, 1) * v * .6
    if inst == 'bass': return _lp(_osc(f, n) + .3 * _osc(f * 2, n), 600) * np.minimum(1, x / .01) * np.exp(-x * 2) * v * .6
    if inst == 'organ': return sum(_osc(f * r, n) * a for r, a in ((1, .5), (2, .3), (4, .15))) * np.minimum(1, x / .02) * np.clip((d - x) / .05, 0, 1) * v * .35
    if inst == 'whistle': return _osc(f * (1 + .006 * np.sin(2 * np.pi * 5 * x)), n) * np.minimum(1, x / .05) * np.clip((d - x) / .08, 0, 1) * v * .35
    return np.zeros(n)

DRUMS = ('kick', 'snare', 'hat', 'clap', 'shaker')
def key_check(notes):
    """find the major / minor scale the notes mostly use; report stretches that leave it (they sound tense, even scary)"""
    tonal = [nt for nt in notes if nt.get('inst') not in DRUMS]
    if len(tonal) < 8: return
    end = max(nt['t'] for nt in tonal); pcs = np.zeros(12)
    for nt in tonal:
        if nt['t'] <= end / 3: pcs[nt.get('m', 60) % 12] += nt.get('d', .4)       # the opening sets the key
    major, minor = [0, 2, 4, 5, 7, 9, 11], [0, 2, 3, 5, 7, 8, 10]
    best = max(((r, sc) for r in range(12) for sc in (major, minor)), key=lambda k: sum(pcs[(k[0] + i) % 12] for i in k[1]))
    inside = {(best[0] + i) % 12 for i in best[1]}
    names = 'C C# D D# E F F# G G# A A# B'.split()
    bad = []
    for w in np.arange(0, end, 2.0):
        win = [nt for nt in tonal if w <= nt['t'] < w + 2]
        if win:
            out = sum(nt.get('d', .4) for nt in win if nt.get('m', 60) % 12 not in inside) / sum(nt.get('d', .4) for nt in win)
            if out > .25: bad.append((w, out))
    if bad:
        spans = ', '.join(f'{w:.0f}–{w + 2:.0f}s ({o:.0%} off)' for w, o in bad)
        print(f"note: the music is in {names[best[0]]} {'major' if best[1] is major else 'minor'}, but these stretches leave the key and will sound tense or eerie: {spans}")

def from_notes(n, notes):
    out = np.zeros(n)
    hi = [nt['m'] for nt in notes if nt.get('m', 60) > 88 and nt.get('inst') not in ('kick', 'snare', 'hat', 'clap', 'shaker')]
    if hi: print(f'note: {len(hi)} notes above MIDI 88 (up to {max(hi)}) — they will sound thin and shrill; an octave lower usually sits better')
    key_check(notes)
    for nt in notes:
        v = instrument(nt.get('inst', 'piano'), nt.get('m', 60), nt.get('d', .4), nt.get('v', .8)); a = int(nt['t'] * SR); z = min(n, a + len(v))
        if 0 <= a < n: out[a:z] += v[:z - a]
    return out

def track(duration, sounds, music_spec=None):
    n = int((duration + .5) * SR); fx = np.zeros(n)
    for s in sounds:
        k = s.get('kind'); v = tool(k, s.get('dur', .2)) if k in ('marker', 'pencil', 'chalk', 'highlighter', 'erase') else accent(k, s.get('dur', 0))
        a = int(s['t'] * SR); z = min(n, a + len(v))
        if 0 <= a < n: fx[a:z] += v[:z - a]
    spec = music_spec or {'style': 'none'}
    if spec.get('file'):
        import soundfile as sf; from scipy.signal import resample_poly
        y, sr = sf.read(spec['file'], always_2d=True); y = y.mean(1)
        if sr != SR: y = resample_poly(y, SR, sr)
        m = np.zeros(n); m[:min(n, len(y))] = y[:n]
    elif spec.get('notes'): m = from_notes(n, spec['notes'])
    else: m = music(n, **{k: v for k, v in spec.items() if k in ('style', 'bpm', 'lift')})
    if np.abs(m).max() > 0: m = m / np.abs(m).max() * .55
    fade = np.clip((n - np.arange(n)) / (1.5 * SR), 0, 1)
    L = fx + m * fade
    out = np.stack([L, L], 1)
    return out / (np.abs(out).max() + 1e-9) * .85
