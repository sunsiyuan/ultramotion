"""液态玻璃的配乐 + 水滴声：numpy 合成，没有外部素材。

    from score import score
    music = score(duration=秒, drops=[秒, …], bpm=120, drums=True)   # → (n, 2) 数组，48 kHz

F 大调、梦幻向：Fmaj9 · Am7 · Dm9 · B♭maj9，一个和弦一小节（120 BPM = 2 秒）。
三层：软 pad（慢起慢收）· 玻璃铃八分音符琶音（正弦 + 2.76 倍非谐泛音，敲击感像玻璃）· 轻底鼓 + 十六分踩镲（drums=False 时不要）。
水滴：每个形状弹出 / 融合的时间点一声，正弦 40 ms 内从 300 Hz 滑到 1100 Hz 再快速衰减 —— 这个风格的「签名音效」。
"""
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000

def score(duration, drops=(), bpm=120, drums=True):
    n = int((duration + 1.0) * SR)
    rng = np.random.default_rng(11)
    def lp(x, f): return sosfilt(butter(2, f, 'low', fs=SR, output='sos'), x)
    def hp(x, f): return sosfilt(butter(2, f, 'high', fs=SR, output='sos'), x)
    def sine(f, L, ph=0): return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, (L,))) / SR + ph)
    def env(L, a, r):
        x = np.arange(L) / SR; return np.minimum(1, x / max(a, 1e-4)) * np.minimum(1, (L / SR - x) / max(r, 1e-4))
    def put(buf, x, t, g=1.0):
        i = int(t * SR); a, b = max(0, i), min(len(buf), i + len(x))
        if a < b: buf[a:b] += x[a - i:b - i] * g
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    beat = 60 / bpm; bar = 4 * beat
    CH = [[41, 57, 60, 64, 67], [45, 57, 60, 64, 67], [38, 57, 60, 64, 65], [46, 57, 60, 62, 65]]

    L_, R_ = np.zeros(n), np.zeros(n)
    # pad
    for k in range(int(duration / bar) + 2):
        ch = CH[k % 4]; L = int((bar + 1.5) * SR); e = env(L, .6, 1.4)
        for j, m in enumerate(ch):
            v = sum(a * sine(hz(m) * h * (1 + d), L, rng.uniform(0, 6)) for h, a in ((1, 1), (2, .25)) for d in (-.0015, .0015))
            v = lp(v, 1400) * e * (.10 if j == 0 else .045)
            pan = j / 4 - .5
            put(L_, v * (1 - pan), k * bar - .3); put(R_, v * (1 + pan), k * bar - .3)
    # 玻璃铃琶音
    pat = [0, 2, 1, 3, 2, 4, 3, 1]
    for i in range(int(duration / (beat / 2))):
        t = i * beat / 2; ch = CH[int(t / bar) % 4]; m = ch[1 + pat[i % 8] % 4] + 12
        L = int(1.2 * SR); x = np.arange(L) / SR
        v = (sine(hz(m), L) * np.exp(-x * 5) + .35 * sine(hz(m) * 2.76, L) * np.exp(-x * 14)) * .055 * (1 - np.exp(-x * 900))
        pan = .35 * np.sin(i * 1.3)
        put(L_, v * (1 - pan), t); put(R_, v * (1 + pan), t)
    # 轻鼓：第二小节起
    if drums:
        for i in range(int(duration / beat)):
            t = i * beat
            if t < bar: continue
            L = int(.35 * SR); x = np.arange(L) / SR
            kick = sine(48 + 70 * np.exp(-x * 30), L) * np.exp(-x * 9) * .32
            put(L_, kick, t); put(R_, kick, t)
            for s in range(4):
                Lh = int(.06 * SR); h = hp(rng.standard_normal(Lh), 7000) * np.exp(-np.arange(Lh) / SR * 70) * (.035 if s % 2 else .018)
                put(L_, h * .8, t + s * beat / 4); put(R_, h, t + s * beat / 4)
    # 水滴
    for t in drops:
        for dt, f0, f1, g in ((0, 300, 1100, .30), (.07, 520, 1700, .12)):
            L = int(.25 * SR); x = np.arange(L) / SR
            f = f0 + (f1 - f0) * np.minimum(1, x / .04)
            v = sine(f, L) * np.exp(-x * 30) * (1 - np.exp(-x * 2000)) * g
            put(L_, v, t + dt); put(R_, v, t + dt)
    # 混响 + 首尾淡
    def ir(seed):
        r = np.random.default_rng(seed); k = int(2.5 * SR); x = r.standard_normal(k) * np.exp(-np.arange(k) / SR / .7)
        return lp(x, 5000) / np.sqrt(np.sum(x ** 2))
    out = np.stack([L_ + .28 * fftconvolve(L_, ir(1))[:n], R_ + .28 * fftconvolve(R_, ir(2))[:n]], 1)
    fade = np.minimum(1, np.arange(n) / SR / .3) * np.clip((duration + .3 - np.arange(n) / SR) / 1.0, 0, 1)
    out *= fade[:, None]
    return out / (np.abs(out).max() + 1e-9) * .8
