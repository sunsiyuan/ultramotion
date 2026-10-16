"""host.wav -> host-levels.js: the voice's loudness in BANDS frequency bands, RATE times a second, for the waveform.
    python3 media/levels.py            (run again when host.wav changes)"""
import json, numpy as np, soundfile as sf
from pathlib import Path
RATE, BANDS, HERE = 60, 32, Path(__file__).parent
x, sr = sf.read(HERE / 'host.wav'); x = x if x.ndim == 1 else x.mean(1)
win, hop = 2048, sr // RATE
edges = np.geomspace(90, 7000, BANDS + 1); f = np.fft.rfftfreq(win, 1 / sr)
rows = []
for i in range(0, len(x), hop):
    seg = x[max(0, i - win // 2): i + win // 2]; seg = np.pad(seg, (0, win - len(seg)))
    mag = np.abs(np.fft.rfft(seg * np.hanning(win)))
    rows.append([mag[(f >= a) & (f < b)].mean() for a, b in zip(edges[:-1], edges[1:])])
L = 20 * np.log10(np.array(rows) + 1e-9); L = np.clip((L - (L.max() - 48)) / 48, 0, 1)   # 48 dB range, 0..1
out = {'rate': RATE, 'bands': BANDS, 'frames': [[round(float(v), 2) for v in r] for r in L]}
(HERE / 'host-levels.js').write_text('window.HOST_LEVELS = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print(len(rows), 'frames ×', BANDS, 'bands; mean level per 0.05 s:', ' '.join(f'{v:.2f}' for v in L.mean(1)[::3]))
