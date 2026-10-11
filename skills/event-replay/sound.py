"""Sound for event replays: a documentary score played on sampled instruments, and the sounds of time passing.

    from sound import track
    audio = track(duration, sounds, music)   # (n, 2) float array, 48 kHz, stereo

music   { "notes": [{ "t": 0.0, "m": 48, "d": 4.0, "inst": "strings", "v": 0.6 }, …],     m = MIDI note, d = seconds, v = 0..1
          "dynamics": { "strings": [[t, level], …], … },                                 how loud an instrument plays over time (0..1): swells, fades
          "duck": [[t0, t1, level], …] }                                                  music level inside windows (0 = silence, .3 = under)
        { "file": "music.wav" }                                                            anything you made yourself
        instruments (sampled, GeneralUser GS through fluidsynth): piano strings cello bass choir horn harp celesta timpani pad
sounds  [{ "t": s, "kind": k, "dur": s, "v": 0..1 }, …]
        tick tock          a clock — one per step of the clock on screen (Replay.ticks makes them)
        impact             the moment: a sub drop with a long tail
        boom               a lighter hit
        heartbeat          lub-dub
        rumble  (dur)      the ground shaking, felt more than heard
        riser   (dur)      tension building into a moment
        whoosh  (dur)      the camera flying
        tap thud           small marks: a cell landing, a state called

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
PROGRAM = {'piano': 0, 'celesta': 8, 'cello': 42, 'bass': 43, 'harp': 46, 'timpani': 47, 'strings': 48, 'choir': 52, 'horn': 60, 'pad': 89}

def _bp(x, lo, hi): return sosfilt(butter(2, [lo, hi], 'band', fs=SR, output='sos'), x)
def _lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
def _hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
def _osc(f, n): return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, (n,))) / SR)
def _x(sec): n = max(1, int(sec * SR)); return n, np.arange(n) / SR

# ---------- the room ----------
def _ir(sec=2.6, seed=0):
    r = np.random.default_rng(seed); n, x = _x(sec); env = np.exp(-x * 6.9 / sec)
    lo = _lp(r.standard_normal(n), 2500); hi = r.standard_normal(n)
    ir = (lo * .8 + hi * .2 * np.exp(-x * 9)) * env; ir[:int(.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum())
_IR = None
def reverb(mono, wet=.3):
    global _IR
    if _IR is None: _IR = (_ir(seed=1), _ir(seed=2))
    L = fftconvolve(mono, _IR[0])[:len(mono)]; R = fftconvolve(mono, _IR[1])[:len(mono)]
    return np.stack([mono + wet * L, mono + wet * R], 1)

# ---------- sounds ----------
def accent(kind, dur=0, v=1.0):
    if kind == 'tick':
        n, x = _x(.05); return (_bp(_rng.standard_normal(n), 2500, 6000) * np.exp(-x * 260) + _osc(3100, n) * np.exp(-x * 120) * .25) * .5 * v
    if kind == 'tock':
        n, x = _x(.06); return (_bp(_rng.standard_normal(n), 1200, 3500) * np.exp(-x * 220) + _osc(1700, n) * np.exp(-x * 100) * .3) * .5 * v
    if kind == 'impact':
        n, x = _x(3.0); sub = _osc(38 + 70 * np.exp(-x * 7), n) * np.exp(-x * 1.4)
        body = _lp(_rng.standard_normal(n), 400) * np.exp(-x * 9) * .9
        return (sub + body) * np.minimum(1, x / .004) * .9 * v
    if kind == 'boom':
        n, x = _x(1.6); return (_osc(45 + 50 * np.exp(-x * 9), n) * np.exp(-x * 2.6) + _lp(_rng.standard_normal(n), 600) * np.exp(-x * 12) * .4) * .7 * v
    if kind == 'heartbeat':
        out = np.zeros(int(.7 * SR))
        for st, a in ((0, 1), (.2, .7)):
            n, x = _x(.3); out[int(st * SR):int(st * SR) + n] += _osc(48 + 30 * np.exp(-x * 30), n) * np.exp(-x * 16) * a
        return _lp(out, 180) * 1.4 * v
    if kind == 'rumble':
        n, x = _x(max(dur, 1)); T = x[-1]
        low = _lp(np.cumsum(_rng.standard_normal(n)) * .02, 70); low /= np.abs(low).max() + 1e-9
        rattle = _bp(_rng.standard_normal(n), 120, 500) * (.5 + .5 * _lp(_rng.standard_normal(n), 9) * 8).clip(0, 1.5)
        env = np.minimum(1, x / 1.2) * np.clip((T - x) / (T * .6), 0, 1) ** 1.5
        return (low * .9 + rattle * .12) * env * v
    if kind == 'riser':
        n, x = _x(max(dur, .8)); u = x / x[-1]
        return (_bp(_rng.standard_normal(n), 200, 5000) * .12 * u ** 3 + _osc(55 * 2 ** (u * 1.5), n) * .12 * u ** 2) * v
    if kind == 'whoosh':
        n, x = _x(max(dur, .5)); return _lp(_bp(_rng.standard_normal(n), 150, 1800), 1200) * np.sin(np.pi * x / x[-1]) ** 2 * .25 * v
    if kind == 'tap':
        n, x = _x(.08); return _bp(_rng.standard_normal(n), 900, 3500) * np.exp(-x * 80) * .35 * v
    if kind == 'thud':
        n, x = _x(.4); return _osc(55 + 60 * np.exp(-x * 25), n) * np.exp(-x * 10) * .7 * v
    return np.zeros(1)
WET = {'tick': .08, 'tock': .08, 'tap': .15, 'impact': .6, 'boom': .45, 'heartbeat': .2, 'rumble': .1, 'riser': .4, 'whoosh': .3, 'thud': .3}

# ---------- music on sampled instruments ----------
def _soundfont():
    if SF2.exists(): return SF2
    SF2.parent.mkdir(parents=True, exist_ok=True)
    print(f'downloading the GeneralUser GS soundfont (32 MB) to {SF2} …')
    urllib.request.urlretrieve(SF2_URL, SF2); return SF2

def _midi(notes, path, dynamics=None):
    """notes → a type-0 MIDI file; one channel per instrument, reverb send up; dynamics → expression (CC11) curves"""
    dynamics = {k: v for k, v in (dynamics or {}).items() if v}
    insts = sorted({nt.get('inst', 'piano') for nt in notes} | set(dynamics), key=list(PROGRAM).index)
    ch = {k: (i if i < 9 else i + 1) for i, k in enumerate(insts)}
    ev = []
    for k, c in ch.items(): ev += [(0, 0, bytes([0xC0 | c, PROGRAM[k]])), (0, 0, bytes([0xB0 | c, 91, 110])), (0, 0, bytes([0xB0 | c, 7, 110]))]
    for k, curve in dynamics.items():                                                  # [[t, level 0..1], …], linear between points
        pts = sorted(curve)
        for t in np.arange(pts[0][0], pts[-1][0] + .05, .05):
            lv = np.interp(t, [p[0] for p in pts], [p[1] for p in pts]); ev.append((int(t * 1920), 0, bytes([0xB0 | ch[k], 11, int(np.clip(lv, 0, 1) * 127)])))
    for nt in notes:
        c, m, vel = ch[nt.get('inst', 'piano')], int(nt.get('m', 60)), max(1, min(127, int(nt.get('v', .7) * 127)))
        on, off = int(nt['t'] * 1920), int((nt['t'] + nt.get('d', .5)) * 1920)
        ev += [(on, 2, bytes([0x90 | c, m, vel])), (off, 1, bytes([0x80 | c, m, 0]))]
    ev.sort(key=lambda e: (e[0], e[1]))
    def vlq(n):
        b = [n & 0x7F]; n >>= 7
        while n: b.insert(0, (n & 0x7F) | 0x80); n >>= 7
        return bytes(b)
    data, last = bytearray(b'\x00\xFF\x51\x03\x07\xA1\x20'), 0                                 # 120 bpm, 960 ticks per beat → 1920 ticks per second
    for tk, _, msg in ev: data += vlq(tk - last) + msg; last = tk
    data += b'\x00\xFF\x2F\x00'
    Path(path).write_bytes(b'MThd' + struct.pack('>IHHH', 6, 0, 1, 960) + b'MTrk' + struct.pack('>I', len(data)) + bytes(data))

def sampled(n, notes, dynamics=None):
    import soundfile as sf
    with tempfile.TemporaryDirectory() as d:
        mid, wav = Path(d) / 'm.mid', Path(d) / 'm.wav'; _midi(notes, mid, dynamics)
        subprocess.run(['fluidsynth', '-ni', '-q', '-g', '0.5', '-r', str(SR), '-o', 'synth.reverb.room-size=0.85', '-o', 'synth.reverb.width=1.0',
                        '-o', 'synth.reverb.level=0.7', '-F', str(wav), str(_soundfont()), str(mid)], check=True, capture_output=True)
        y, sr = sf.read(wav, always_2d=True)
    out = np.zeros((n, 2)); out[:min(n, len(y))] = y[:n, :2]; return out

def track(duration, sounds, music_spec=None):
    n = int((duration + .5) * SR)
    fx = np.zeros((n, 2))
    for s in sounds:
        v = accent(s.get('kind'), s.get('dur', 0), s.get('v', 1.0)); a = int(s['t'] * SR)
        if not (0 <= a < n) or len(v) < 2: continue
        tail = int(2.6 * SR); buf = np.concatenate([v, np.zeros(tail)]); st = reverb(buf, WET.get(s.get('kind'), .25)); z = min(n, a + len(st))
        fx[a:z] += st[:z - a]
    spec = music_spec or {}
    m = np.zeros((n, 2))
    if spec.get('file'):
        import soundfile as sf; from scipy.signal import resample_poly
        y, sr = sf.read(spec['file'], always_2d=True)
        if sr != SR: y = resample_poly(y, SR, sr, axis=0)
        y = y if y.shape[1] > 1 else np.repeat(y, 2, 1); m[:min(n, len(y))] = y[:n, :2]
    elif spec.get('notes'):
        try: m = sampled(n, spec['notes'], spec.get('dynamics'))
        except (FileNotFoundError, subprocess.CalledProcessError) as e:
            raise SystemExit(f'music needs fluidsynth: brew install fluid-synth (macOS) or apt install fluidsynth (Linux) — {e}')
    if np.abs(m).max() > 0: m = m / np.abs(m).max() * .6
    g = np.ones(n); x = np.arange(n) / SR
    for t0, t1, lv in spec.get('duck', []):                       # smooth in and out over .4 s
        inside = np.clip(np.minimum((x - t0) / .4 + 1, (t1 - x) / .4 + 1), 0, 1); g = np.minimum(g, 1 - (1 - lv) * inside)
    g *= np.clip((n - np.arange(n)) / (1.5 * SR), 0, 1)
    out = fx * .55 + m * g[:, None]
    out = out / (np.abs(out).max() + 1e-9)
    return np.tanh(out * 2.2) / np.tanh(2.2) * .89                                   # a soft limiter: hits stay hits, the music underneath comes up
