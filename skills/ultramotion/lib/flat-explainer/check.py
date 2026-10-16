"""Check a rendered explainer before you hand it over: where does the picture stop moving?

    python3 check.py video.mp4 [story.json]

Prints how much of the time the picture is alive (at least 2% of it visibly changing), overall and per scene (from story.json),
and lists every stretch of 1 s or more where it is not. Aim for 65% or more, no scene under 50%, and no still stretch over 1.5 s.
"""
import json, subprocess, sys
import numpy as np

video = sys.argv[1]; story = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else None
FPS = 15
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'fps={FPS},scale=270:480', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
F = np.frombuffer(raw, np.uint8).reshape(-1, 480, 270).astype(np.float32)
# a frame is "alive" when at least 2% of the picture visibly changes — Kurzgesagt is alive ~83% of the time
share = np.r_[1.0, (np.abs(np.diff(F, axis=0)) > 6).mean((1, 2))]
still = share < .02; t = np.arange(len(F)) / FPS
print(f'alive {1 - still.mean():.0%} of {len(F) / FPS:.1f}s' + ('  ✓' if still.mean() < .35 else '  — aim for 65% or more'))
if story:
    for s in story['scenes']:
        m = (t >= s['t0']) & (t < s['t1'])
        if m.any(): print(f"  {s['id']:<14} {s['t0']:6.1f}–{s['t1']:5.1f}s  alive {1 - still[m].mean():4.0%}" + ('' if still[m].mean() < .5 else '  ← add motion'))
runs, start = [], None
for i, v in enumerate(list(still) + [False]):
    if v and start is None: start = i
    if not v and start is not None:
        if (i - start) / FPS >= 1: runs.append((start / FPS, i / FPS))
        start = None
for a, b in runs: print(f'  still {a:5.1f}–{b:5.1f}s ({b - a:.1f}s)' + ('  ← fix' if b - a > 1.5 else ''))
