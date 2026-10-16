"""Binance BTCUSDT candles in data/ → data/summary.js (window.DATA): the post, the gap to the all-time high, the days left, how often bitcoin has done it"""
import json, datetime
from pathlib import Path
D = Path(__file__).parent; J = lambda f: json.load(open(D / f))
utc = lambda ms: datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc)
import re
def stats(p): return {k: int(v) for v, k in re.findall(r'(\d+) (replies|reposts|likes|bookmarks|views)', p['stats'])}
POSTS = sorted(J('posts.json')['posts'], key=lambda p: p['time'])
MAIN = next(p for p in POSTS if 'screenshot this' in p['text'])
TARGET = datetime.date(2026, 12, 25)
d, h = J('btc-1d.json'), J('btc-1h.json')
ath = max(d, key=lambda r: float(r[2])); now = d[-1]
price_at = lambda iso: round(float([r for r in h if utc(r[0]) <= datetime.datetime.fromisoformat(iso.replace('Z', '+00:00'))][-1][4]))
need = float(ath[2]) / float(now[4]) - 1; days = (TARGET - utc(now[0]).date()).days
closes = [float(r[4]) for r in d]
wins = [(i, closes[i + days] / closes[i] - 1) for i in range(len(closes) - days)]
hits = [w for w in wins if w[1] >= need]; last = max(hits, key=lambda w: w[0])
weekly = [dict(t=utc(r[0]).date().isoformat(), c=round(float(r[4]))) for r in d if utc(r[0]).date() >= datetime.date(2025, 1, 1)][::3]
DATA = dict(main=dict(name=MAIN['name'], handle=MAIN['handle'], text=MAIN['text'], time=MAIN['time'], url=MAIN['url'], verified=MAIN['verified'], **stats(MAIN)),
  posts=[dict(text=p['text'], time=p['time'], url=p['url'], price=price_at(p['time']), **stats(p)) for p in POSTS], now=dict(price=round(float(now[4])), date=utc(now[0]).date().isoformat()),
  ath=dict(price=round(float(ath[2])), date=utc(ath[0]).date().isoformat()), need=round(need * 100, 1), days=days, perDay=round(((1 + need) ** (1 / days) - 1) * 100, 2),
  windows=len(wins), hits=len(hits), hitIdx=[i for i, _ in hits], share=round(len(hits) / len(wins) * 100, 1),
  last=dict(start=utc(d[last[0]][0]).date().isoformat(), end=utc(d[last[0] + days][0]).date().isoformat(), gain=round(last[1] * 100, 1)),
  series=weekly, source='Binance BTC/USDT daily closes, Aug 2017 – Oct 16, 2026')
(D / 'summary.js').write_text('window.DATA = ' + json.dumps(DATA) + ';\n')
print(json.dumps({k: v for k, v in DATA.items() if k not in ('series', 'hitIdx', 'posts')}, indent=1))
