"""Sound for ultramotion videos: a score played on sampled instruments, the sounds of the picture, and one mix.
(Copied from tools/sound.py, plus the broken signal's own sounds, the music cut / stuck / crushed where the picture breaks,
recordings (the footage's own sound), and pan.)

    from sound import track
    audio = track(duration, sounds, music)   # (n, 2) float array, 48 kHz, stereo

music   { "notes": [{ "t": 0.0, "m": 60, "d": 0.5, "inst": "piano", "v": 0.7 }, …],      m = MIDI note, d = seconds, v = 0..1
          "dynamics": { "strings": [[t, level], …], … },                                 how loud an instrument plays over time (0..1)
          "duck": [[t0, t1, level], …] }                                                  music level inside windows
        { "style": "marimba" | "lofi" | "piano", "bpm": 96, "lift": [8.5] }               ready arrangements; lift = where a fuller layer comes in
        { "file": "music.wav" }
  instruments (sampled):
    keys      piano  keys (electric piano)  celesta  glockenspiel  musicbox  vibraphone  marimba  xylophone  bell  kalimba  harp  pluck  guitar  organ  accordion
    strings   strings  slowstrings  pizzicato  violin  viola  cello  bass  erhu
    winds     flute  piccolo  dizi  shakuhachi  panflute  whistle  recorder  oboe  clarinet  bassoon  horn  trumpet  trombone  brass
    world     guzheng  shamisen  sitar  banjo
    voices    choir  oohs
    other     pad  synthbass  timpani
    drums     kick  snare  hat  openhat  clap  shaker  tom  crash  ride                      (m is ignored)
sounds  [{ "t": s, "kind": k, "dur": s, "v": 0..1 }, …]
    tools     marker pencil chalk highlighter erase      (dur = how long the stroke lasts)
    moves     whoosh swish page riser                    (dur)
    time      tick tock heartbeat rumble (dur)
    hits      impact boom thud tap pop
    bells     ding chime sparkle tada shimmer           — played on sampled celesta and glockenspiel, in the music's key
    signal    data     digital garbage: 8–30 ms cells of square tones, held noise and gaps (dur)
              blip     one short digital chirp
              crunch   compression crunch: crushed low noise (dur)
              static   TV snow (dur)
              smear    a warbling, dragging noise under a datamosh (dur)
              crtoff   the set switching off: a falling whine, a thump, a crackle
              crton    the set switching on: a thump, the tube's buzz rising, a crackle
              (each takes "seed": the same seed gives the same sound)
    the music and recordings, where the picture breaks:
              cut      silence them for dur
              stutter  repeat the last `loop` seconds before t, for dur (a skipping CD)
              crush    bit-crush them for dur
    recording audio    { "src": "clip.mp4" | "voice.wav", "t": start in the video, "from": start in the file, "dur", "v" }
    any sound can carry "pan": -1 (left) … 1 (right)

Sampled instruments need fluidsynth (macOS: brew install fluid-synth · Linux: apt install fluidsynth) and the
GeneralUser GS soundfont, downloaded on first use to ~/.ultramotion/GeneralUser-GS.sf2 (free for any use).
"""
import os, struct, subprocess, tempfile, urllib.request
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
_rng = np.random.default_rng(11)
SF2 = Path(os.environ.get('ULTRAMOTION_SF2', Path.home() / '.ultramotion' / 'GeneralUser-GS.sf2'))
SF2_URL = 'https://raw.githubusercontent.com/mrbumpy409/GeneralUser-GS/main/GeneralUser-GS.sf2'
PROGRAM = {'piano': 0, 'soft': 0, 'keys': 4, 'celesta': 8, 'glockenspiel': 9, 'musicbox': 10, 'vibraphone': 11, 'marimba': 12, 'xylophone': 13, 'bell': 14,
           'organ': 19, 'accordion': 21, 'guitar': 24, 'synthbass': 38, 'violin': 40, 'viola': 41, 'cello': 42, 'bass': 43, 'pizzicato': 45, 'harp': 46, 'pluck': 46,
           'timpani': 47, 'strings': 48, 'slowstrings': 49, 'choir': 52, 'oohs': 53, 'trumpet': 56, 'trombone': 57, 'horn': 60, 'brass': 61, 'oboe': 68,
           'bassoon': 70, 'clarinet': 71, 'piccolo': 72, 'flute': 73, 'dizi': 73, 'recorder': 74, 'panflute': 75, 'shakuhachi': 77, 'whistle': 78,
           'pad': 89, 'sitar': 104, 'banjo': 105, 'shamisen': 106, 'guzheng': 107, 'kalimba': 108, 'erhu': 110}
DRUMS = {'kick': 36, 'snare': 38, 'clap': 39, 'hat': 42, 'openhat': 46, 'tom': 45, 'crash': 49, 'ride': 51, 'shaker': 70}

def _bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def _lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def _hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def _osc(f, n): return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, (n,))) / SR)
def _x(sec): n = max(1, int(sec * SR)); return n, np.arange(n) / SR
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

# ---------- the room ----------
def _ir(sec=2.6, seed=0):
    r = np.random.default_rng(seed); n, x = _x(sec); env = np.exp(-x * 6.9 / sec)
    ir = (_lp(r.standard_normal(n), 2500) * .8 + r.standard_normal(n) * .2 * np.exp(-x * 9)) * env; ir[:int(.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum())
_IR = None
def reverb(mono, wet=.3):
    global _IR
    if _IR is None: _IR = (_ir(seed=1), _ir(seed=2))
    return np.stack([mono + wet * fftconvolve(mono, _IR[0])[:len(mono)], mono + wet * fftconvolve(mono, _IR[1])[:len(mono)]], 1)

# ---------- the sounds of the picture ----------
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
    if kind == 'highlighter': return _bp(noise, 900, 3800) * edge * press * .12
    if kind == 'erase': return _bp(noise, 300, 2600) * edge * (.6 + .4 * np.sin(2 * np.pi * 7 * x)) * .26
    return _bp(noise, 2200, 7500) * edge * press * .15                                  # marker
TOOLS = ('marker', 'pencil', 'chalk', 'highlighter', 'erase')

def accent(kind, dur=0, v=1.0):
    if kind == 'tick':
        n, x = _x(.05); return (_bp(_rng.standard_normal(n), 2500, 6000) * np.exp(-x * 260) + _osc(3100, n) * np.exp(-x * 120) * .25) * .5 * v
    if kind == 'tock':
        n, x = _x(.06); return (_bp(_rng.standard_normal(n), 1200, 3500) * np.exp(-x * 220) + _osc(1700, n) * np.exp(-x * 100) * .3) * .5 * v
    if kind == 'impact':
        n, x = _x(3.0); return (_osc(38 + 70 * np.exp(-x * 7), n) * np.exp(-x * 1.4) + _lp(_rng.standard_normal(n), 400) * np.exp(-x * 9) * .9) * np.minimum(1, x / .004) * .9 * v
    if kind == 'boom':
        n, x = _x(1.6); return (_osc(45 + 50 * np.exp(-x * 9), n) * np.exp(-x * 2.6) + _lp(_rng.standard_normal(n), 600) * np.exp(-x * 12) * .4) * .7 * v
    if kind == 'heartbeat':
        out = np.zeros(int(.7 * SR))
        for st, a in ((0, 1), (.2, .7)): n, x = _x(.3); out[int(st * SR):int(st * SR) + n] += _osc(48 + 30 * np.exp(-x * 30), n) * np.exp(-x * 16) * a
        return _lp(out, 180) * 1.4 * v
    if kind == 'rumble':
        n, x = _x(max(dur, 1)); T = x[-1]; low = _lp(np.cumsum(_rng.standard_normal(n)) * .02, 70); low /= np.abs(low).max() + 1e-9
        rattle = _bp(_rng.standard_normal(n), 120, 500) * (.5 + .5 * _lp(_rng.standard_normal(n), 9) * 8).clip(0, 1.5)
        return (low * .9 + rattle * .12) * np.minimum(1, x / 1.2) * np.clip((T - x) / (T * .6), 0, 1) ** 1.5 * v
    if kind == 'riser':
        n, x = _x(max(dur, .8)); u = x / x[-1]; return (_bp(_rng.standard_normal(n), 200, 5000) * .12 * u ** 3 + _osc(55 * 2 ** (u * 1.5), n) * .12 * u ** 2) * v
    if kind == 'whoosh':
        n, x = _x(max(dur, .5)); return _lp(_bp(_rng.standard_normal(n), 150, 1800), 1200) * np.sin(np.pi * x / x[-1]) ** 2 * .25 * v
    if kind == 'swish':
        n, x = _x(.35); return _bp(_rng.standard_normal(n), 900, 7000) * np.sin(np.pi * x / .35) ** 3 * .3 * v
    if kind == 'page':
        n, x = _x(.45); return _bp(_rng.standard_normal(n), 500, 6000) * (np.sin(np.pi * x / .45) ** 2) * (1 + .6 * np.sin(2 * np.pi * 22 * x)) * .28 * v
    if kind == 'pop':
        n, x = _x(.14); return _osc(950 - 600 * x / .14, n) * np.exp(-x * 36) * .5 * v
    if kind == 'tap':
        n, x = _x(.08); return _bp(_rng.standard_normal(n), 900, 3500) * np.exp(-x * 80) * .35 * v
    if kind == 'thud':
        n, x = _x(.4); return _osc(55 + 60 * np.exp(-x * 25), n) * np.exp(-x * 10) * .7 * v
    if kind == 'shimmer':                                  # fine grains settling, no pitch
        n, x = _x(1.4); grains = (_rng.random(n) < 900 / SR) * _rng.standard_normal(n)
        return (_hp(_rng.standard_normal(n), 5000) * .25 + _bp(grains, 3000, 9000) * 2.2) * np.minimum(1, x / .15) * np.exp(-x * 2.6) * .07 * v
    return np.zeros(1)
WET = {'tick': .08, 'tock': .08, 'tap': .15, 'impact': .6, 'boom': .45, 'heartbeat': .2, 'rumble': .1, 'riser': .4, 'whoosh': .3, 'thud': .3, 'pop': .2, 'swish': .25, 'page': .15}


# ---------- the broken signal ----------
def _rs(s): return np.random.default_rng(int(abs(s.get('seed', 1)) * 1000 + 17) % 2 ** 32)
def glitch_sound(kind, s):
    v, r = s.get('v', 1.0), _rs(s)
    if kind in ('data', 'blip'):
        dur = .045 if kind == 'blip' else max(.05, s.get('dur', .1)); n, x = _x(dur); out = np.zeros(n); i = 0
        while i < n:                                                         # cells of different garbage
            m = min(n - i, int(r.uniform(.008, .03) * SR)); xm = np.arange(m) / SR; c = r.random() if kind == 'data' else .1
            if c < .38: cell = np.sign(np.sin(2 * np.pi * r.choice([110, 165, 220, 330, 440, 660, 880]) * xm)) * .5
            elif c < .72: hold = int(r.choice([6, 12, 24, 48])); cell = np.repeat(r.uniform(-1, 1, m // hold + 1), hold)[:m] * .6
            elif c < .86: cell = r.uniform(-1, 1, m) * .25
            else: cell = np.zeros(m)
            out[i:i + m] = cell; i += m
        edge = np.minimum(1, x / .002) * np.clip((dur - x) / .004, 0, 1)
        return _lp(out, 4500) * edge * .4 * v
    if kind == 'crunch':
        dur = max(.06, s.get('dur', .12)); n, x = _x(dur); hold = 40
        out = np.repeat(r.uniform(-1, 1, n // hold + 1), hold)[:n]; out = np.round(_bp(out, 120, 2400) * 4) / 4
        return out * np.minimum(1, x / .003) * np.clip((dur - x) / .01, 0, 1) * .45 * v
    if kind == 'static':
        dur = max(.05, s.get('dur', .15)); n, x = _x(dur)
        flutter = (.6 + .4 * np.repeat(r.random(int(dur * 120) + 2), SR // 120 + 1)[:n])
        return _lp(_hp(r.standard_normal(n), 250), 5200) * flutter * np.minimum(1, x / .003) * np.clip((dur - x) / .01, 0, 1) * .22 * v
    if kind == 'smear':
        dur = max(.2, s.get('dur', .8)); n, x = _x(dur); u = x / dur
        grains = np.repeat(r.uniform(-1, 1, n // 300 + 1), 300)[:n]
        low = _osc(70 + 25 * np.sin(2 * np.pi * 3.1 * x) + 40 * u, n) * .35
        body = _bp(grains, 150, 1800) * (.6 + .4 * np.sin(2 * np.pi * 7 * x))
        return (body * .5 + low) * np.sin(np.pi * u) ** .7 * .35 * v
    if kind == 'crtoff':
        n, x = _x(.9); f = 40 + 700 * np.exp(-x * 7)
        whine = _osc(f, n) * np.exp(-x * 4.5) * .22
        thump = _osc(55 + 40 * np.exp(-x * 30), n) * np.exp(-x * 14) * .7
        crack = _bp(r.standard_normal(n) * (r.random(n) < .02), 800, 4000) * np.exp(-x * 9) * .6
        return (whine + thump + crack) * v
    if kind == 'crton':
        n, x = _x(1.0)
        thump = _osc(50 + 50 * np.exp(-x * 25), n) * np.exp(-x * 10) * .7
        buzz = _lp(np.sign(np.sin(2 * np.pi * 100 * x)), 900) * np.minimum(1, x / .08) * np.exp(-x * 3) * .07
        crack = _bp(r.standard_normal(n) * (r.random(n) < .03), 700, 4500) * np.exp(-x * 5) * .5
        return (thump + buzz + crack) * v
    return np.zeros(1)
GLITCH = ('data', 'blip', 'crunch', 'static', 'smear', 'crtoff', 'crton')
WET.update({'data': .08, 'blip': .06, 'crunch': .05, 'static': .05, 'smear': .2, 'crtoff': .25, 'crton': .2})
BUS = ('cut', 'stutter', 'crush')

def bus(x, ops):
    """the music and recordings, broken where the picture breaks"""
    y = x.copy(); n = len(y)
    for s in sorted(ops, key=lambda s: s['t']):
        a, z = int(s['t'] * SR), min(n, int((s['t'] + s.get('dur', .1)) * SR))
        if a >= n or z <= a: continue
        k = s['kind']; r = int(.003 * SR)
        if k == 'cut':
            g = np.ones(n); g[a:z] = 0
            if a - r > 0: g[a - r:a] = np.linspace(1, 0, r)
            if z + r < n: g[z:z + r] = np.linspace(0, 1, r)
            y *= g[:, None]
        elif k == 'stutter':
            L = max(int(s.get('loop', .1) * SR), 64); src = x[max(0, a - L):a]
            if len(src) < 64: continue
            for i in range(a, z, len(src)):
                m = min(len(src), z - i); y[i:i + m] = src[:m] * np.r_[np.linspace(0, 1, 32), np.ones(max(0, m - 64)), np.linspace(1, 0, 32)][:m, None]
        elif k == 'crush':
            seg = y[a:z]; hold = 24; seg = np.repeat(seg[::hold], hold, axis=0)[:len(seg)]; y[a:z] = np.round(seg * 6) / 6
    return y

def recording(s, n):
    """the sound of a file (a video's sound track, a voice), placed at t"""
    out = np.zeros((n, 2)); a = int(s.get('t', 0) * SR)
    cmd = ['ffmpeg', '-v', 'error', '-ss', str(s.get('from', 0))] + (['-t', str(s['dur'])] if s.get('dur') else []) + ['-i', s['src'], '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-']
    raw = subprocess.run(cmd, capture_output=True).stdout
    y = np.frombuffer(raw, np.float32).reshape(-1, 2)
    if a < n and len(y): z = min(n, a + len(y)); out[a:z] = y[:z - a]
    return out * s.get('v', 1.0)

# bells: notes on sampled instruments, in the key of the music
BELLS = ('ding', 'chime', 'sparkle', 'tada')
def bell_notes(s, key):
    t, v, k = s['t'], s.get('v', 1.0), key or [0, 4, 7, 11, 2]
    if s['kind'] == 'ding': return [dict(t=t, m=84 + k[0], d=1.2, inst='celesta', v=.7 * v)]
    if s['kind'] == 'chime': return [dict(t=t + i * .02, m=72 + pc, d=2.2, inst='glockenspiel', v=.45 * v) for i, pc in enumerate(k[:4])]
    if s['kind'] == 'sparkle': return [dict(t=t + i * .06, m=m, d=.6, inst='celesta', v=.5 * v) for i, m in enumerate(sorted(84 + pc for pc in k[:4]))]
    return [dict(t=t, m=60 + pc, d=.14, inst='brass', v=.7 * v) for pc in (0, 4, 7)] + [dict(t=t + .16, m=60 + pc, d=1.0, inst='brass', v=.8 * v) for pc in (0, 4, 7, 12)]

def key_of(notes):
    """the pitch classes the music leans on, tonic first (the most-held low note), then by how long they sound — up to five"""
    tonal = [nt for nt in notes if nt.get('inst') not in DRUMS]
    if not tonal: return None
    w = np.zeros(12); low = np.zeros(12)
    for nt in tonal: w[nt.get('m', 60) % 12] += nt.get('d', .4); low[nt.get('m', 60) % 12] += nt.get('d', .4) * (nt.get('m', 60) < 55)
    tonic = int(np.argmax(low)) if low.max() > 0 else int(np.argmax(w))
    return [tonic] + [int(pc) for pc in np.argsort(-w) if w[pc] > .06 * w.sum() and pc != tonic][:4]

# ---------- ready arrangements, as notes ----------
CHORDS = [(60, 64, 67, 71), (57, 60, 64, 67), (53, 57, 60, 64), (55, 59, 62, 65)]          # Cmaj7 Am7 Fmaj7 G7
def arrangement(duration, style='marimba', bpm=None, lift=()):
    if style in (None, 'none'): return [], {}
    bpm = bpm or {'marimba': 104, 'lofi': 80, 'piano': 72}.get(style, 96); beat = 60 / bpm; bar = beat * 4
    lifts = sorted(lift or []); notes = []; N = lambda t, m, d, i, v: notes.append(dict(t=t, m=m, d=d, inst=i, v=v))
    i = 0
    while i * beat / 2 < duration:
        t = i * beat / 2; ch = CHORDS[int(t / bar) % 4]; s8 = i % 8; full = not lifts or any(t >= L for L in lifts)
        if style == 'marimba':
            N(t, ch[[0, 2, 1, 2, 3, 2, 1, 2][s8]] + 12, beat * .5, 'marimba', .6)
            if s8 == 0 and full: N(t, ch[0] - 24, bar, 'bass', .6); [N(t, m, bar, 'strings', .3) for m in ch[:3]]
            if full and s8 in (0, 4): N(t, 36, .2, 'kick', .7)
            if full and s8 in (2, 6): N(t, 42, .1, 'hat', .4)
        elif style == 'lofi':
            if s8 == 0: [N(t + k * .03, m, bar * .95, 'keys', .5) for k, m in enumerate(ch)]
            if full:
                if s8 in (0, 5): N(t, 36, .2, 'kick', .7)
                if s8 in (2, 6): N(t, 38, .1, 'snare', .45)
                N(t, 42, .05, 'hat', .3)
                if s8 == 0: N(t, ch[0] - 24, bar * .9, 'bass', .55)
        elif style == 'piano':
            if s8 in (0, 2, 4, 6): N(t, ch[s8 // 2] + 12, beat * 1.6, 'piano', .5)
            if s8 == 0: N(t, ch[0] - 12, bar, 'piano', .45)
            if full and s8 == 0: [N(t, m, bar, 'strings', .35) for m in ch[:3]]
        i += 1
    return notes, {}

# ---------- music on sampled instruments ----------
def _soundfont():
    if SF2.exists(): return SF2
    SF2.parent.mkdir(parents=True, exist_ok=True)
    print(f'downloading the GeneralUser GS soundfont (32 MB) to {SF2} …')
    urllib.request.urlretrieve(SF2_URL, SF2); return SF2

def _midi(notes, path, dynamics=None):
    """notes → a type-0 MIDI file; one channel per instrument (drums on channel 10), reverb send up; dynamics → expression (CC11)"""
    dynamics = {k: v for k, v in (dynamics or {}).items() if v and k in PROGRAM}
    unknown = sorted({nt.get('inst', 'piano') for nt in notes} - set(PROGRAM) - set(DRUMS))
    if unknown: print(f"note: no instrument called {', '.join(unknown)} — played on piano")
    inst = lambda nt: nt.get('inst', 'piano') if nt.get('inst', 'piano') in PROGRAM or nt.get('inst') in DRUMS else 'piano'
    insts = sorted({inst(nt) for nt in notes if inst(nt) in PROGRAM} | set(dynamics), key=list(PROGRAM).index)
    free = [c for c in range(16) if c != 9]
    if len(insts) > len(free): print(f'note: more than {len(free)} instruments — the last ones share a channel'); insts = insts[:len(free)]
    ch = {k: free[i] for i, k in enumerate(insts)}
    ev = []
    for k, c in ch.items(): ev += [(0, 0, bytes([0xC0 | c, PROGRAM[k]])), (0, 0, bytes([0xB0 | c, 91, 110])), (0, 0, bytes([0xB0 | c, 7, 110]))]
    ev += [(0, 0, bytes([0xB9, 91, 70])), (0, 0, bytes([0xB9, 7, 110]))]
    for k, curve in dynamics.items():
        if k not in ch: continue
        pts = sorted(curve)
        for t in np.arange(pts[0][0], pts[-1][0] + .05, .05):
            ev.append((int(t * 1920), 0, bytes([0xB0 | ch[k], 11, int(np.clip(np.interp(t, [p[0] for p in pts], [p[1] for p in pts]), 0, 1) * 127)])))
    for nt in notes:
        k = inst(nt); vel = max(1, min(127, int(nt.get('v', .7) * 127)))
        if k in DRUMS: c, m = 9, DRUMS[k]
        elif k in ch: c, m = ch[k], int(nt.get('m', 60))
        else: c, m = ch[insts[-1]], int(nt.get('m', 60))
        on, off = int(nt['t'] * 1920), int((nt['t'] + max(.03, nt.get('d', .5))) * 1920)
        ev += [(on, 2, bytes([0x90 | c, m, vel])), (off, 1, bytes([0x80 | c, m, 0]))]
    ev.sort(key=lambda e: (e[0], e[1]))
    def vlq(n):
        b = [n & 0x7F]; n >>= 7
        while n: b.insert(0, (n & 0x7F) | 0x80); n >>= 7
        return bytes(b)
    data, last = bytearray(b'\x00\xFF\x51\x03\x07\xA1\x20'), 0                                 # 120 bpm, 960 ticks per beat → 1920 ticks per second
    for tk, _, msg in ev: data += vlq(max(0, tk) - last) + msg; last = max(0, tk)
    data += b'\x00\xFF\x2F\x00'
    Path(path).write_bytes(b'MThd' + struct.pack('>IHHH', 6, 0, 1, 960) + b'MTrk' + struct.pack('>I', len(data)) + bytes(data))

def sampled(n, notes, dynamics=None):
    import soundfile as sf
    out = np.zeros((n, 2))
    if not notes: return out
    with tempfile.TemporaryDirectory() as d:
        mid, wav = Path(d) / 'm.mid', Path(d) / 'm.wav'; _midi(notes, mid, dynamics)
        try:
            subprocess.run(['fluidsynth', '-ni', '-q', '-g', '0.5', '-r', str(SR), '-o', 'synth.reverb.room-size=0.85', '-o', 'synth.reverb.width=1.0',
                            '-o', 'synth.reverb.level=0.7', '-F', str(wav), str(_soundfont()), str(mid)], check=True, capture_output=True)
        except FileNotFoundError:
            raise SystemExit('music needs fluidsynth: brew install fluid-synth (macOS) or apt install fluidsynth (Linux)')
        y, sr = sf.read(wav, always_2d=True)
    out[:min(n, len(y))] = y[:n, :2]; return out

def key_check(notes):
    """say where the music leaves its key (it will sound tense there)"""
    tonal = [nt for nt in notes if nt.get('inst') not in DRUMS]
    if len(tonal) < 8: return
    k = key_of(tonal); major = [0, 2, 4, 5, 7, 9, 11]; minor = [0, 2, 3, 5, 7, 8, 10]
    pcs = np.zeros(12)
    for nt in tonal: pcs[nt.get('m', 60) % 12] += nt.get('d', .4)
    best = max(((r, sc) for r in range(12) for sc in (major, minor)), key=lambda q: sum(pcs[(q[0] + i) % 12] for i in q[1]))
    inside = {(best[0] + i) % 12 for i in best[1]}; end = max(nt['t'] for nt in tonal); bad = []
    for w in np.arange(0, end, 2.0):
        win = [nt for nt in tonal if w <= nt['t'] < w + 2]
        if win:
            out = sum(nt.get('d', .4) for nt in win if nt.get('m', 60) % 12 not in inside) / sum(nt.get('d', .4) for nt in win)
            if out > .25: bad.append(f'{w:.0f}–{w + 2:.0f}s')
    if bad: print(f"note: these stretches leave the key and will sound tense: {', '.join(bad)}")

def track(duration, sounds, music_spec=None):
    n = int((duration + .5) * SR); spec = music_spec or {}
    notes, dyn = list(spec.get('notes') or []), dict(spec.get('dynamics') or {})
    if spec.get('style') and not notes: notes, dyn = arrangement(duration, spec['style'], spec.get('bpm'), spec.get('lift', ()))
    key = key_of(notes)
    if notes: key_check(notes)
    # the picture's sounds: synthesized ones through the room, bells on sampled instruments
    fx = np.zeros((n, 2)); bells = []; ops = []; rec = np.zeros((n, 2))
    for s in sounds:
        k = s.get('kind'); a = int(s['t'] * SR)
        if k in BELLS: bells += bell_notes(s, key); continue
        if k in BUS: ops.append(s); continue
        if k == 'audio': rec += recording(s, n); continue
        v = tool(k, s.get('dur', .2)) * s.get('v', 1.0) if k in TOOLS else glitch_sound(k, s) if k in GLITCH else accent(k, s.get('dur', 0), s.get('v', 1.0))
        if not (0 <= a < n) or len(v) < 2: continue
        st = reverb(np.concatenate([v, np.zeros(int(2.6 * SR))]), WET.get(k, .2)); z = min(n, a + len(st))
        if s.get('pan'): p = (np.clip(s['pan'], -1, 1) + 1) * np.pi / 4; st = st * np.array([np.cos(p), np.sin(p)]) * np.sqrt(2)
        fx[a:z] += st[:z - a]
    if bells: fx += sampled(n, bells) * .9
    m = np.zeros((n, 2))
    if spec.get('file'):
        import soundfile as sf; from scipy.signal import resample_poly
        y, sr = sf.read(spec['file'], always_2d=True)
        if sr != SR: y = resample_poly(y, SR, sr, axis=0)
        y = y if y.shape[1] > 1 else np.repeat(y, 2, 1); m[:min(n, len(y))] = y[:n, :2]
    elif notes: m = sampled(n, notes, dyn)
    if np.abs(m).max() > 0: m = m / np.abs(m).max() * .6
    m = m + rec
    if ops: m = bus(m, ops)
    g = np.ones(n); x = np.arange(n) / SR
    for t0, t1, lv in spec.get('duck', []):
        inside = np.clip(np.minimum((x - t0) / .4 + 1, (t1 - x) / .4 + 1), 0, 1); g = np.minimum(g, 1 - (1 - lv) * inside)
    g *= np.clip((n - np.arange(n)) / (1.5 * SR), 0, 1)
    out = fx * .55 + m * g[:, None]
    if np.abs(out).max() == 0: return out
    out = out / np.abs(out).max()
    return np.tanh(out * 2.2) / np.tanh(2.2) * .89                                   # a soft limiter: hits stay hits, the music underneath comes up
