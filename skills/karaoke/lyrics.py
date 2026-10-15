"""Time lyrics to a recording: when each word (each character, in Chinese or Japanese) starts and ends, and where the beats are.

    python3 lyrics.py align song.mp3 lyrics.txt --out timing.json [--lang en] [--from 48 --to 78] [--model small]
    python3 lyrics.py check song.mp3 timing.json [--out check.png]
    python3 lyrics.py beats song.mp3 [--from 48 --to 78]

lyrics.txt  one sung line per line, in the order they are sung, repeats written out; a blank line starts a new section;
            lines starting with # are skipped, and so are lines that are only a [Section] label. Write the words exactly as sung.
            Duets: [name] before a line (or inside it) says who sings what follows — [m] I said / [f] you said / [both] we said —
            and the voice carries on until the next tag; words and lines in timing.json get "voice".
align       transcribes the recording with Whisper, matches what it heard to your lyrics, then times every line again against
            the exact words of that line (forced alignment). --from/--to limits it to one part of the song (times stay song times).
check       draws each line's stretch of the recording (a spectrogram of the voice range) with the word boundaries on it:
            a boundary should sit where a syllable's energy begins; a word drawn over silence or over the next line is wrong.
timing.json { "audio", "from", "to", "bpm", "beats": [s, …], "downbeats": [s, …],
              "lines": [{ "text", "t0", "t1", "section", "voice"?, "words": [{ "text", "t0", "t1", "voice"? }, …] }, …] }
            line.text is the words' text joined; each word carries its trailing space or punctuation.
            Correct any time by hand in the json; the page reads it as it is.

Needs ffmpeg and Python with openai-whisper (pip install openai-whisper), numpy, scipy, Pillow. The model downloads on first use.
"""
import argparse, json, re, sys, unicodedata
from difflib import SequenceMatcher
from pathlib import Path
import numpy as np

SR = 16000
CJK = re.compile(r'[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]')

def norm(s):
    s = unicodedata.normalize('NFKC', s).lower().replace('’', "'")
    return ''.join(ch for ch in s if ch.isalnum() or ch == "'").replace("'", '')

def units(line):
    """split a line into sung units: Han/kana/hangul characters one by one, other scripts word by word; spaces and punctuation ride on the unit before"""
    out, buf = [], ''
    for ch in line:
        if CJK.match(ch):
            if buf.strip(): out.append(buf); buf = ''
            out.append(ch)
        elif ch.isspace() or not (ch.isalnum() or ch in "'’-"):
            if out and not buf.strip(): out[-1] += ch
            else: buf += ch
        else:
            if buf and not buf[-1].isalnum() and buf[-1] not in "'’-" and buf.strip(): out.append(buf); buf = ''
            buf += ch
    if buf.strip(): out.append(buf)
    elif buf and out: out[-1] += buf
    return [u for u in out if norm(u)] or ([line] if line.strip() else [])

TAG = re.compile(r'\[([^\]]*)\]')

def read_lyrics(path):
    lines, section, voice = [], 0, None
    for raw in Path(path).read_text(encoding='utf-8').splitlines():
        s = raw.strip()
        if not s:
            if lines and lines[-1]['section'] == section: section += 1
            continue
        if s.startswith('#') or not TAG.sub('', s).strip(): continue
        parts = TAG.split(s)                       # text, tag, text, tag, …
        us, vs, line_voice = [], [], None
        for k, part in enumerate(parts):
            if k % 2: voice = part.strip() or None; continue
            for u in units(part.strip()):
                if not us: line_voice = voice
                us.append(u); vs.append(voice)
        if us: us[-1] = us[-1].rstrip()
        us = [u if i == len(us) - 1 or u.endswith((' ',)) or CJK.match(u[-1]) else u + ' ' for i, u in enumerate(us)]
        lines.append({'text': ''.join(us).strip(), 'section': section, 'units': us, 'voices': vs, 'voice': line_voice})
    return lines

def load(path):
    import subprocess
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vn', '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()

# ---------- beats ----------
def onset_env(y, hop=256):
    from scipy.signal import stft
    _, _, Z = stft(y, SR, nperseg=1024, noverlap=1024 - hop, boundary=None)
    S = np.log1p(np.abs(Z) * 20)
    f = np.maximum(0, np.diff(S, axis=1)).mean(0)
    f = f - np.convolve(f, np.ones(32) / 32, 'same')
    return np.maximum(f, 0), SR / hop

def beats(y, t_from=0.0):
    """tempo from the onset envelope's autocorrelation, then a beat grid that follows the onsets (dynamic programming, after Ellis 2007)"""
    env, fr = onset_env(y)
    env = env / (env.std() + 1e-9)
    ac = np.correlate(env, env, 'full')[len(env) - 1:]
    lags = np.arange(len(ac)); bpm_of = 60 * fr / np.maximum(lags, 1)
    ok = (bpm_of > 55) & (bpm_of < 190)
    w = np.exp(-.5 * (np.log2(bpm_of / 110) / .9) ** 2)                      # prefer the walking-pace range
    period = lags[ok][np.argmax((ac * w)[ok])]
    bpm = 60 * fr / period
    n = len(env); score = env.copy(); back = np.full(n, -1)
    for i in range(n):
        lo, hi = i - int(period * 2), i - int(period * .5)
        if hi <= 0: continue
        lo = max(lo, 0); prev = np.arange(lo, hi)
        cost = -100 * np.log((i - prev) / period) ** 2
        k = np.argmax(score[lo:hi] + cost); score[i] += score[lo + k] + cost[k]; back[i] = lo + k
    i = int(np.argmax(score[max(0, n - int(period)):])) + max(0, n - int(period)); out = []
    while i >= 0: out.append(i); i = back[i]
    bt = np.array(out[::-1]) / fr + t_from
    # bars of 3 or 4: the phase whose beats carry the most onset energy is the downbeat
    best = None
    for meter in (4, 3):
        for ph in range(meter):
            idx = (np.array(out[::-1])[ph::meter]).astype(int)
            s = env[idx].mean() if len(idx) else 0
            if best is None or s > best[0] * (1.08 if meter == 3 else 1): best = (s, meter, ph)
    _, meter, ph = best
    return round(float(bpm), 2), [round(float(b), 3) for b in bt], [round(float(b), 3) for b in bt[ph::meter]], meter

# ---------- alignment ----------
def heard_units(segments, cjk):
    out = []
    for s in segments:
        for w in s.get('words', []):
            txt, a, b = w['word'], w['start'], w['end']
            if cjk:
                chars = [c for c in txt if norm(c)]
                for k, c in enumerate(chars):
                    out.append((norm(c), a + (b - a) * k / len(chars), a + (b - a) * (k + 1) / len(chars)))
            elif norm(txt): out.append((norm(txt), a, b))
    return out

def match(lyr, heard):
    """global alignment of lyric units to heard units; similar spellings count (forts/forks)"""
    n, m = len(lyr), len(heard)
    sim = lambda a, b: 1.0 if a == b else (SequenceMatcher(None, a, b).ratio() if len(a) > 1 and len(b) > 1 else 0)
    G = -.4
    D = np.zeros((n + 1, m + 1)); P = np.zeros((n + 1, m + 1), np.int8)
    D[1:, 0] = G * np.arange(1, n + 1); D[0, 1:] = G * np.arange(1, m + 1); P[1:, 0] = 1; P[0, 1:] = 2
    for i in range(1, n + 1):
        a = lyr[i - 1]
        for j in range(1, m + 1):
            s = sim(a, heard[j - 1][0]); d = D[i - 1, j - 1] + (s * 2 - .6 if s >= .5 else -1.2)
            u, l = D[i - 1, j] + G, D[i, j - 1] + G
            if d >= u and d >= l: D[i, j], P[i, j] = d, 0
            elif u >= l: D[i, j], P[i, j] = u, 1
            else: D[i, j], P[i, j] = l, 2
    pairs, i, j = {}, n, m
    while i > 0 or j > 0:
        p = P[i, j]
        if i > 0 and j > 0 and p == 0:
            if sim(lyr[i - 1], heard[j - 1][0]) >= .5: pairs[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif i > 0 and (j == 0 or p == 1): i -= 1
        else: j -= 1
    return pairs

def rough_times(n, pairs, heard, t_from, t_to):
    t0, t1 = np.full(n, np.nan), np.full(n, np.nan)
    for i, j in pairs.items(): t0[i], t1[i] = heard[j][1], heard[j][2]
    known = np.where(~np.isnan(t0))[0]
    if not len(known): sys.exit('could not hear any of the lyrics in this part of the recording; check --from/--to and --lang')
    for i in range(n):
        if not np.isnan(t0[i]): continue
        before, after = known[known < i], known[known > i]
        a = (before[-1], t1[before[-1]]) if len(before) else (-1, t_from)
        b = (after[0], t0[after[0]]) if len(after) else (n, t_to)
        k = (i - a[0]) / (b[0] - a[0]); span = (b[1] - a[1]) / (b[0] - a[0])
        t0[i] = a[1] + span * (i - a[0] - 1); t1[i] = t0[i] + span
    return t0, t1

def force(model, tokenizer, y, a, b, words, cjk):
    """time the exact words of one line inside [a, b] with Whisper's cross-attention alignment"""
    import whisper, torch
    from whisper.timing import find_alignment
    clip = y[int(a * SR):int(b * SR)]
    mel = whisper.log_mel_spectrogram(clip, model.dims.n_mels, padding=whisper.audio.N_SAMPLES)
    nf = min(clip.shape[-1] // whisper.audio.HOP_LENGTH, whisper.audio.N_FRAMES)
    mel = whisper.pad_or_trim(mel, whisper.audio.N_FRAMES).to(model.device)
    text = ''.join(words) if cjk else ' ' + ' '.join(w.strip() for w in words)
    toks = tokenizer.encode(text)
    with torch.no_grad(): got = find_alignment(model, tokenizer, toks, mel, nf)
    got = [g for g in got if norm(g.word)]
    # spread whisper's words back over our units by their letters
    out, k, have = [], 0, ''
    for u in words:
        need = norm(u); s = e = None
        while k < len(got) and len(have) < len(need):
            if s is None: s = got[k].start
            e = got[k].end; have += norm(got[k].word); k += 1
        have = have[len(need):]
        out.append(None if s is None else (a + s, a + e))
    if any(o is None for o in out): return None
    return out

def align(a):
    import whisper
    lines = read_lyrics(a.lyrics)
    if not lines: sys.exit('no lyrics found in ' + a.lyrics)
    full = load(a.audio)
    t_from = a.t_from or 0.0; t_to = a.t_to or len(full) / SR
    y = full[int(t_from * SR):int(t_to * SR)]
    cjk = any(CJK.search(l['text']) for l in lines)
    lang = a.lang or ('zh' if cjk else 'en')
    model = whisper.load_model(a.model)
    prompt = ('，'.join if cjk else ', '.join)(l['text'] for l in lines)[:400]
    res = model.transcribe(y, language=lang, word_timestamps=True, condition_on_previous_text=False, no_speech_threshold=None,
                           logprob_threshold=None, compression_ratio_threshold=None, initial_prompt=prompt, fp16=False)
    heard = [(w, s + t_from, e + t_from) for w, s, e in heard_units(res['segments'], cjk)]
    flat = [(li, u) for li, l in enumerate(lines) for u in l['units']]
    pairs = match([norm(u) for _, u in flat], heard)
    t0, t1 = rough_times(len(flat), pairs, heard, t_from, t_to)
    print(f'heard {len(pairs)} of {len(flat)} sung units in the transcript')
    tokenizer = whisper.tokenizer.get_tokenizer(model.is_multilingual, language=lang, task='transcribe')
    out, k = [], 0
    for li, l in enumerate(lines):
        n = len(l['units']); r0, r1 = t0[k:k + n], t1[k:k + n]
        prev_end = out[-1]['t1'] if out else t_from
        nxt = t0[k + n] if k + n < len(flat) else t_to
        a0, b0 = max(prev_end - .15, r0[0] - 1.0, t_from), min(nxt + .3, r1[-1] + 1.2, t_to)
        timed = force(model, tokenizer, full, a0, b0, l['units'], cjk) if b0 - a0 < 29 else None
        if timed and abs(timed[0][0] - r0[0]) < 1.5 and abs(timed[-1][1] - r1[-1]) < 2.0: src = 'forced'
        else: timed, src = list(zip(r0, r1)), 'heard'
        if src == 'forced':                       # the alignment hands any lead-in silence to the first word; start it where it was heard
            s, e = timed[0]; heard0 = r0[0] if k in pairs else -1e9
            timed[0] = (min(max(s, heard0, e - .8), e - .12), e)
        words = []
        for u, v, (s, e) in zip(l['units'], l['voices'], timed):
            s = max(s, words[-1]['t1'] if words else s); e = max(e, s + .06)
            words.append({'text': u, 't0': round(float(s), 3), 't1': round(float(e), 3), **({'voice': v} if v else {})})
        out.append({'text': ''.join(w['text'] for w in words).strip(), 't0': words[0]['t0'], 't1': words[-1]['t1'], 'section': l['section'],
                    **({'voice': l['voice']} if l['voice'] else {}), 'words': words})
        print(f"{words[0]['t0']:7.2f}–{words[-1]['t1']:7.2f}  {src:<6}  {l['text']}")
        k += n
    bpm, bt, down, meter = beats(y, t_from)
    data = {'audio': str(a.audio), 'from': t_from, 'to': round(t_to, 3), 'bpm': bpm, 'meter': meter, 'beats': bt, 'downbeats': down, 'lines': out}
    Path(a.out).write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f'bpm {bpm} ({meter}/4) · {a.out}')

# ---------- check ----------
def check(a):
    from PIL import Image, ImageDraw, ImageFont
    from scipy.signal import stft
    d = json.loads(Path(a.timing).read_text()); y = load(a.audio)
    rows, W, Hh, pad = [], 1600, 150, .6
    font = ImageFont.load_default()
    for fp in ('/System/Library/Fonts/Hiragino Sans GB.ttc', '/System/Library/Fonts/STHeiti Light.ttc', '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 'C:/Windows/Fonts/msyh.ttc'):
        try: font = ImageFont.truetype(fp, 18); break
        except Exception: pass
    for l in d['lines']:
        s0, s1 = max(0, l['t0'] - pad), l['t1'] + pad; seg = y[int(s0 * SR):int(s1 * SR)]
        if len(seg) < 2048: continue
        f, _, Z = stft(seg, SR, nperseg=1024, noverlap=1024 - 160)
        band = (f > 90) & (f < 5000); S = np.log1p(np.abs(Z[band]) * 40)
        fb = f[band]; ys = np.linspace(np.log(90), np.log(5000), 110); S = np.stack([np.interp(ys, np.log(fb), S[:, i]) for i in range(S.shape[1])], 1)
        S = (S - S.min()) / (np.ptp(S) + 1e-9); img = Image.fromarray((255 * (1 - S[::-1])).astype(np.uint8)).resize((W, 110)).convert('RGB')
        row = Image.new('RGB', (W, Hh), 'white'); row.paste(img, (0, 30)); dr = ImageDraw.Draw(row)
        X = lambda t: (t - s0) / (s1 - s0) * W
        for i, w in enumerate(l['words']):
            x0, x1 = X(w['t0']), X(w['t1']); c = (220, 40, 40) if i % 2 == 0 else (30, 90, 220)
            dr.rectangle([x0, 140, x1, 146], fill=c); dr.line([x0, 26, x0, 146], fill=c, width=2); dr.text((x0 + 3, 4), w['text'].strip(), fill=c, font=font)
        dr.text((W - 120, 128), f"{l['t0']:.2f}s", fill=(120, 120, 120), font=font)
        rows.append(row)
    sheet = Image.new('RGB', (W, Hh * len(rows)), 'white')
    for i, r in enumerate(rows): sheet.paste(r, (0, i * Hh))
    out = a.out or 'check.png'; sheet.save(out); print(out)

def beats_cmd(a):
    y = load(a.audio); t_from = a.t_from or 0.0; t_to = a.t_to or len(y) / SR
    bpm, bt, down, meter = beats(y[int(t_from * SR):int(t_to * SR)], t_from)
    print(json.dumps({'bpm': bpm, 'meter': meter, 'beats': bt, 'downbeats': down}))

ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
p = sub.add_parser('align'); p.add_argument('audio'); p.add_argument('lyrics'); p.add_argument('--out', default='timing.json'); p.add_argument('--lang')
p.add_argument('--from', dest='t_from', type=float); p.add_argument('--to', dest='t_to', type=float); p.add_argument('--model', default='small')
p = sub.add_parser('check'); p.add_argument('audio'); p.add_argument('timing'); p.add_argument('--out')
p = sub.add_parser('beats'); p.add_argument('audio'); p.add_argument('--from', dest='t_from', type=float); p.add_argument('--to', dest='t_to', type=float)
a = ap.parse_args()
{'align': align, 'check': check, 'beats': beats_cmd}[a.cmd](a)
