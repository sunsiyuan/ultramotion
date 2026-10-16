import gzip, json, subprocess, datetime as dt, os, sys
def LD(f):
    b=open(f,'rb').read()
    return json.loads(gzip.decompress(b) if b[:2]==b'\x1f\x8b' else b)
from concurrent.futures import ThreadPoolExecutor
U='static01.nyt.com/elections-assets/pages/data/2024-11-05/results-president.json'
ts=sorted(set(r[1] for r in json.load(open('cdx.json'))[1:]))
T=lambda s: dt.datetime.strptime(s,'%Y%m%d%H%M%S')
pick=[]; last=None
for s in ts:
    t=T(s)
    if t < dt.datetime(2024,11,5,23,30): continue
    gap = 900 if t < dt.datetime(2024,11,6,11) else 12*3600
    if last is None or (t-last).total_seconds()>=gap: pick.append(s); last=t
pick.append(ts[-1]); pick=sorted(set(pick)); print(len(pick), pick[-6:], flush=True)
def get(s):
    f=f'{s}.json'
    for k in range(4):
        try: LD(f); return s, 'ok'
        except Exception: pass
        subprocess.run(['curl','-sL','--max-time','120','--retry','3','--retry-all-errors','--retry-delay','10',f'http://web.archive.org/web/{s}id_/https://{U}','-o',f])
    return s, 'fail'
with ThreadPoolExecutor(3) as ex:
    for s, r in ex.map(get, pick): print(s, r, flush=True)
