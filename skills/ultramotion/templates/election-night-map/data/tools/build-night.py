import gzip, json, glob, datetime as dt, os
def LD(f):
    b=open(f,'rb').read()
    return json.loads(gzip.decompress(b) if b[:2]==b'\x1f\x8b' else b)
import re
def PT(s):
    s=s.replace('Z','+00:00'); s=re.sub(r'\.(\d+)', lambda m: '.'+(m.group(1)+'000000')[:6], s); return dt.datetime.fromisoformat(s)
iso = lambda s: int(PT(s).timestamp()*1000)
snaps, calls = [], {}
for f in sorted(glob.glob('2024*.json')):
    try: d = LD(f)
    except Exception: continue
    t = iso(d['resultsMeta']['resultsUpdatedAt'])
    tv = te = 0; st = {}; seen = set()
    for r in d['races']:
        if r.get('office_id') != 'P' or r.get('race_type_id') != 'G' or r['nyt_id'] in seen or r['nyt_id'].startswith('US-'): continue
        seen.add(r['nyt_id'])
        u = r.get('top_reporting_unit') or next(x for x in r['reporting_units'] if x.get('level') in ('state', 'district')); key = r['nyt_id'].replace('-G-P', '').replace('-2024-11-05', '').replace('CD_', '')
        o = r['outcome']
        if o['won'] and o.get('winner_accepted_at'):
            calls.setdefault(key, (o['won'][0], o['winner_accepted_at'][0], f[:14]))
        if '-' in key: continue
        tot = sum(c['votes']['total'] for c in u['candidates']); tv += tot; te += int(u.get('total_expected_vote') or 0)
        lead = next((c['nyt_id'] for c in u['candidates'] if c.get('leader')), None)
        st[key] = [float(u.get('eevp') or 0), {'trump-d': 'R', 'harris-k': 'D'}.get(lead) if tot else None]
    if any(abs(q['t'] - t) < 60e3 for q in snaps): continue
    snaps.append({'t': t, 'counted': round(100*tv/te, 1) if te else 0, 'votes': tv, 'states': st})
snaps.sort(key=lambda q: q['t']); print(len(snaps))
for s in snaps: print(dt.datetime.utcfromtimestamp(s['t']/1000)-dt.timedelta(hours=5), s['counted'], s['votes'], s['states'].get('WI'), s['states'].get('PA'), s['states'].get('MI'))
for k, (w, a, f) in sorted(calls.items(), key=lambda x: x[1][1]): print(k, w, (PT(a)-dt.timedelta(hours=5)).strftime('%b %d %H:%M:%S'), f)
# the AP's own minute, from its "AP Race Call" stories, where the feed's timestamp is off by more than a minute
AP = {'IN': '2024-11-05 19:00', 'KY': '2024-11-05 19:00', 'MO': '2024-11-05 21:49', 'NM': '2024-11-05 23:33', 'NC': '2024-11-05 23:18', 'GA': '2024-11-06 00:58',
      'PA': '2024-11-06 02:24', 'WI': '2024-11-06 05:34', 'MI': '2024-11-06 12:54', 'ME': '2024-11-06 16:23', 'NV': '2024-11-09 00:15', 'AZ': '2024-11-09 21:21'}
for k, m in AP.items():
    w, a, f = calls[k]; t = dt.datetime.strptime(m, '%Y-%m-%d %H:%M') + dt.timedelta(hours=5); fa = PT(a).replace(tzinfo=None)
    sec = fa.second if fa.strftime('%Y%m%d%H%M') == t.strftime('%Y%m%d%H%M') else 30
    calls[k] = (w, (t + dt.timedelta(seconds=sec)).strftime('%Y-%m-%dT%H:%M:%S+00:00'), f)
close={}
for f in sorted(glob.glob('2024*.json')):
    try: close={p['reporting_unit']['state_postal']: iso(p['poll_closing_time']) for p in LD(f)['pollClosingTimes']}; break
    except Exception: pass
json.dump({'source': 'The New York Times live results feed (static01.nyt.com/elections-assets/pages/data/2024-11-05/results-president.json), archived by the Wayback Machine; calls are the AP\'s (winner_accepted_at)', 'closing': close, 'snapshots': snaps, 'calls': {k: [w, iso(a)] for k, (w, a, f) in calls.items()}}, open('/private/tmp/ultramotion-runs/v-election-night-map/data/night.json', 'w'), separators=(',', ':'))
