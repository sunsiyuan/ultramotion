"""data/replies.json (the post + the replies X would load, via fetch_replies.mjs) → data/summary.js
   a coin counts once per reply, and only when it is written as a $ticker"""
import json, re, collections
from pathlib import Path
D = Path(__file__).parent; d = json.load(open(D / 'replies.json'))
stats = lambda s: {k: int(v) for v, k in re.findall(r'(\d+) (replies|reposts|likes|bookmarks|views)', s)}
reps = sorted(d['replies'], key=lambda r: r.get('time') or '')
per = [sorted({m.upper() for m in re.findall(r'\$([A-Za-z][A-Za-z0-9]{1,9})\b', r['text'])}) for r in reps]
named = [(r, p) for r, p in zip(reps, per) if p]
count = collections.Counter(t for _, p in named for t in p)
top = count.most_common(8)
# the running count as the replies are read in order, for the race
race = []; run = collections.Counter()
for k, (_, p) in enumerate(named): run.update(p); race.append({t: run[t] for t, _ in top})
quotes = [dict(text=r['text'][:140]) for r, p in named if 'ANSEM' in p and 20 < len(r['text']) < 120][:12]
DATA = dict(post=dict(name=d['post']['name'], handle=d['post']['handle'], text=d['post']['text'], time=d['post']['time'], url=d['post']['url'], **stats(d['post']['stats'])),
            loaded=len(reps), named=len(named), tickers=len(count), top=[dict(t=t, n=n, share=round(n / len(named) * 100, 1)) for t, n in top],
            race=race[::max(1, len(race) // 60)] + [race[-1]], wall=[r['text'][:110] for r, p in named if 15 < len(r['text']) < 110][:60], quotes=quotes,
            source=f"{len(reps)} of {stats(d['post']['stats'])['replies']:,} replies X would load, {d['fetched'][:10]}; a coin counts once per reply, written as a $ticker")
(D / 'summary.js').write_text('window.DATA = ' + json.dumps(DATA) + ';\n')
print(json.dumps({k: v for k, v in DATA.items() if k not in ('race', 'wall', 'quotes')}, indent=1))
