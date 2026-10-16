"""data/post.json (fetch_post.mjs) + data/postseason.json (MLB Stats API, every Brewers postseason game 1970–2026) → data/summary.js"""
import json, re
from pathlib import Path
D = Path(__file__).parent; J = lambda f: json.load(open(D / f))
post = J('post.json'); ps = {int(y): g for y, g in J('postseason.json').items()}
stats = {k: int(v) for v, k in re.findall(r'(\d+) (replies|reposts|likes|bookmarks|views)', post['stats'])}
ROUND = {'F': 'Wild Card', 'D': 'Division Series', 'L': 'NLCS', 'W': 'World Series'}
def series(y):
    s = {}
    for g in ps[y]: k = (g['type'], g['opp']); s.setdefault(k, [0, 0]); s[k][0 if g['win'] else 1] += 1
    return [dict(round=ROUND[t] if not (t == 'L' and y < 1998) else 'ALCS', opp=o.split()[-1], w=w, l=l) for (t, o), (w, l) in s.items()]
years = {y: series(y) for y in sorted(ps)}
lastWS = max(y for y in years if y < 2026 and any(s['round'] == 'World Series' for s in years[y]))
lcs = [dict(year=y, **s) for y in years for s in years[y] if s['round'] in ('NLCS', 'ALCS')]
DATA = dict(post=dict(name=post['name'], handle=post['handle'], verified=post['verified'], text=post['text'], time=post['time'], url=post['url'], **stats),
            first=1970, now=2026, years={str(y): v for y, v in years.items()}, lastWS=dict(year=lastWS, **next(s for s in years[lastWS] if s['round'] == 'World Series')),
            gap=2026 - lastWS, lcs=lcs, source='MLB Stats API: every Brewers postseason game, 1970–2026')
(D / 'summary.js').write_text('window.DATA = ' + json.dumps(DATA) + ';\n')
print(json.dumps({k: v for k, v in DATA.items() if k not in ('years',)}, indent=1))
