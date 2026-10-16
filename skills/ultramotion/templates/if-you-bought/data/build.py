"""Builds the two series the page loads from the raw downloads in raw/ (fetched 2026-10-16):
  raw/cnbc-nvda.json      CNBC ts-api, NVDA daily closes, split-adjusted (cross-checked against Nasdaq from Oct 2016: no day differs by more than 0.2%;
                          the one day CNBC lacks, 2023-04-06, comes from raw/nasdaq-nvda.json)
  raw/nasdaq-nvda-div.json Nasdaq, NVDA cash dividends per share as paid (not split-adjusted)
  raw/cnbc-spxtr.json     CNBC ts-api, S&P 500 Total Return index (.SPXTR), daily closes
The page reinvests Nvidia's dividends itself; the S&P 500 Total Return index already does."""
import json, datetime as dt
A, Z = '20150102', '20241231'                       # first and last trading day held
def ms(s): return int(dt.datetime(int(s[:4]), int(s[4:6]), int(s[6:8]), tzinfo=dt.timezone.utc).timestamp() * 1000)
bars = lambda f: [(b['tradeTime'][:8], float(b['close'])) for b in json.load(open(f))['barData']['priceBars'] if A <= b['tradeTime'][:8] <= Z]
splits = [('20210720', 4), ('20240610', 10)]        # Nvidia's splits in the period (ex-dates)
def adj(day):                                       # how many of today's shares one share on `day` became
    k = 1
    for d, r in splits:
        if day < d: k *= r
    return k
divs = []
for r in json.load(open('raw/nasdaq-nvda-div.json'))['data']['dividends']['rows']:
    m, d, y = r['exOrEffDate'].split('/'); day = y + m + d
    if A < day <= Z and r['type'] == 'Cash': divs.append([ms(day), round(float(r['amount'][1:]) / adj(day), 6)])
divs.sort()
nv = dict(bars('raw/cnbc-nvda.json')); sp = bars('raw/cnbc-spxtr.json')
for r in json.load(open('raw/nasdaq-nvda.json'))['data']['tradesTable']['rows']:   # a day CNBC is missing, from Nasdaq
    m, d, y = r['date'].split('/'); day = y + m + d
    if A <= day <= Z and day not in nv: nv[day] = float(r['close'][1:])
nv = sorted(nv.items())
json.dump({'source': 'CNBC (Nvidia daily closes, split-adjusted; checked against Nasdaq) and Nasdaq (cash dividends, split-adjusted here); fetched 2026-10-16',
           'note': 'series: [ms, close], split-adjusted, dividends not included; dividends: [ex-date ms, $ per split-adjusted share] — the page reinvests them at the ex-date close',
           'series': [[ms(d), v] for d, v in nv], 'dividends': divs}, open('nvda-daily.json', 'w'))
json.dump({'source': 'S&P 500 Total Return index (S&P Dow Jones Indices, .SPXTR via CNBC), daily close, dividends reinvested; fetched 2026-10-16',
           'series': [[ms(d), v] for d, v in sp]}, open('sp500tr-daily.json', 'w'))
print(len(nv), nv[0], nv[-1], len(sp), sp[0], sp[-1], len(divs))
