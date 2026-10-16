"""koch.words.json (faster-whisper word times for the whole video) → plan.json for the cut between T0 and T1"""
import json
from pathlib import Path
T0, T1 = 272.0, 314.8
KEYS = {'coolest': '😎', 'humanity': '🌍', 'float': '🎈', 'ceiling': '', 'flip': '🤸', 'best': ''}
ZOOM_ON = ['coolest', 'float']
segs = json.load(open('koch.words.json'))
words = [[round(a - T0, 3), round(b - T0, 3), w] for s in segs for a, b, w in s['words'] if a >= T0 - .05 and b <= T1 + .05]
HIGH = (0, 6.2, .56)   # the source's own question card sits low in the first seconds: captions go higher there
for w in words:
    if HIGH[0] <= w[0] < HIGH[1]: w.append(dict(y=HIGH[2]))
bare = lambda w: ''.join(ch for ch in w.lower() if ch.isalnum())
zooms = [[w[0], .9, 1.12] for w in words if bare(w[2]) in ZOOM_ON]
plan = dict(duration=round(T1 - T0, 3), words=words, zooms=zooms,
            wordStyle=dict(keys=list(KEYS), emoji={k: v for k, v in KEYS.items() if v}, y=.7))
Path('koch-float.plan.json').write_text(json.dumps(plan, indent=1)); print(len(words), 'words;', ' '.join(w[2] for w in words))
