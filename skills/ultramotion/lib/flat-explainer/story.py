"""The narration is the clock. Turn a script into a voice track plus word-level timings the page animates to.

    python3 story.py script.md                         # synthesise with edge-tts (free, no key) → voice.mp3, story.json, story.js
    python3 story.py script.md --voice en-US-AndrewNeural --rate +5%
    python3 story.py script.md --audio my_voice.wav    # your own recording: align the script to it with Whisper
    python3 story.py script.md --dry                   # no audio: estimated timings, to lay out scenes before voicing

script.md — one sentence per line; a blank line is a longer pause; `## name` starts a scene; `(pause 1.2)` on its own line adds silence:

    ## drop
    这是一滴水，大约零点零五毫升。
    比一颗豌豆还小。

    ## zoom
    我们把它放大一千万倍。

story.json — { duration, audio, scenes: [{ id, t0, t1 }], lines: [{ scene, text, t0, t1, words: [{ w, t0, t1 }] }] }
story.js   — the same, as `window.STORY = …`, so the page works when opened straight from disk.
Needs: pip install edge-tts (synthesis) · openai-whisper (only for --audio) · ffmpeg.
"""
import argparse, asyncio, json, re, subprocess, sys, tempfile
from pathlib import Path

LINE_GAP, PARA_GAP = .28, .7                       # silence after a line / after a blank line

def parse(path):
    items, scene = [], 'main'
    for raw in Path(path).read_text(encoding='utf-8').splitlines():
        s = raw.strip()
        if s.startswith('## '): scene = s[3:].strip(); continue
        if s.startswith('#'): continue
        m = re.fullmatch(r'\(pause\s+([\d.]+)\)', s)
        if m: items.append({'pause': float(m.group(1))}); continue
        if not s:
            if items and 'text' in items[-1]: items[-1]['gap'] = PARA_GAP
            continue
        items.append({'scene': scene, 'text': s, 'gap': LINE_GAP})
    return items

def dur(f):
    return float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)], capture_output=True, text=True).stdout)

async def tts_line(text, voice, rate, out):
    import edge_tts
    c = edge_tts.Communicate(text, voice, rate=rate, boundary='WordBoundary')
    words, audio = [], bytearray()
    async for ch in c.stream():
        if ch['type'] == 'audio': audio += ch['data']
        elif ch['type'] == 'WordBoundary': words.append({'w': ch['text'], 't0': ch['offset'] / 1e7, 't1': (ch['offset'] + ch['duration']) / 1e7})
    Path(out).write_bytes(bytes(audio))
    return words

def synthesise(items, voice, rate, outdir):
    tmp = Path(tempfile.mkdtemp()); t, parts, lines = 0.0, [], []
    for i, it in enumerate(items):
        if 'pause' in it: t += it['pause']; parts.append(('sil', it['pause'])); continue
        f = tmp / f'{i:03}.mp3'
        for attempt in range(4):
            try: words = asyncio.run(tts_line(it['text'], voice, rate, f)); break
            except Exception as e:
                if attempt == 3: sys.exit(f'edge-tts failed on line {i + 1}: {e}')
        d = dur(f)
        lines.append({'scene': it['scene'], 'text': it['text'], 't0': round(t, 3), 't1': round(t + d, 3),
                      'words': [{'w': w['w'], 't0': round(t + w['t0'], 3), 't1': round(t + w['t1'], 3)} for w in words]})
        parts.append(('file', f)); t += d
        parts.append(('sil', it['gap'])); t += it['gap']
    # concatenate with silences
    lst = tmp / 'list.txt'; entries = []
    for k, (kind, v) in enumerate(parts):
        if kind == 'sil':
            s = tmp / f'sil{k}.wav'; subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono', '-t', str(v), str(s)], check=True); entries.append(s)
        else:
            w = tmp / f'{Path(v).stem}.wav'; subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(v), '-ar', '24000', '-ac', '1', str(w)], check=True); entries.append(w)
    lst.write_text(''.join(f"file '{e}'\n" for e in entries))
    out = outdir / 'voice.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c:a', 'pcm_s16le', str(out)], check=True)
    return out, lines, t

def align(items, audio):
    """your own recording: Whisper word timestamps, matched to the script's lines in order"""
    try: import whisper
    except ImportError: sys.exit('--audio needs Whisper: pip install openai-whisper')
    texts = [it['text'] for it in items if 'text' in it]
    zh = any('一' <= ch <= '鿿' for ch in ''.join(texts))
    r = whisper.load_model('small').transcribe(str(audio), word_timestamps=True, language='zh' if zh else None, initial_prompt=' '.join(texts)[:200])
    heard = [{'w': w['word'].strip(), 't0': w['start'], 't1': w['end']} for s in r['segments'] for w in s['words'] if w['word'].strip()]
    norm = lambda s: re.sub(r'[\W_]+', '', s.lower())
    lines, k = [], 0
    for it in items:
        if 'text' not in it: continue
        target, got, ws = norm(it['text']), '', []
        while k < len(heard) and len(got) < len(target):
            ws.append(heard[k]); got += norm(heard[k]['w']); k += 1
        if not ws: break
        lines.append({'scene': it['scene'], 'text': it['text'], 't0': round(ws[0]['t0'], 3), 't1': round(ws[-1]['t1'], 3),
                      'words': [{'w': w['w'], 't0': round(w['t0'], 3), 't1': round(w['t1'], 3)} for w in ws]})
    return lines, dur(audio)

def dry(items):
    """no audio yet: about 4.2 characters a second for Chinese, 2.6 words a second for English"""
    t, lines = 0.0, []
    for it in items:
        if 'pause' in it: t += it['pause']; continue
        zh = any('一' <= ch <= '鿿' for ch in it['text'])
        toks = [c for c in it['text'] if not re.match(r'[\s，。、！？,.!?；;：:]', c)] if zh else it['text'].split()
        step = 1 / 4.2 if zh else 1 / 2.6; words = []
        for w in toks: words.append({'w': w, 't0': round(t, 3), 't1': round(t + step, 3)}); t += step
        lines.append({'scene': it['scene'], 'text': it['text'], 't0': words[0]['t0'] if words else t, 't1': round(t, 3), 'words': words})
        t += it['gap']
    return lines, t

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('script'); ap.add_argument('--out', default='.')
    ap.add_argument('--voice', default=None); ap.add_argument('--rate', default='+0%'); ap.add_argument('--audio'); ap.add_argument('--dry', action='store_true')
    ap.add_argument('--tail', type=float, default=1.5, help='seconds after the last word (for the closing shot)')
    a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    items = parse(a.script)
    zh = any('一' <= ch <= '鿿' for it in items for ch in it.get('text', ''))
    voice = a.voice or ('zh-CN-XiaoxiaoNeural' if zh else 'en-US-AndrewNeural')
    if a.dry: lines, end = dry(items); audio = None
    elif a.audio: lines, end = align(items, a.audio); audio = str(Path(a.audio).resolve())
    else: path, lines, end = synthesise(items, voice, a.rate, out); audio = path.name
    duration = round(max(end, lines[-1]['t1'] if lines else 0) + a.tail, 3)
    scenes = []
    for ln in lines:
        if not scenes or scenes[-1]['id'] != ln['scene']: scenes.append({'id': ln['scene'], 't0': ln['t0'], 't1': ln['t1']})
        else: scenes[-1]['t1'] = ln['t1']
    for i in range(len(scenes) - 1): scenes[i]['t1'] = scenes[i + 1]['t0']
    if scenes: scenes[0]['t0'] = 0; scenes[-1]['t1'] = duration
    story = {'duration': duration, 'audio': audio, 'voice': None if (a.dry or a.audio) else voice, 'scenes': scenes, 'lines': lines}
    (out / 'story.json').write_text(json.dumps(story, ensure_ascii=False, indent=1), encoding='utf-8')
    (out / 'story.js').write_text('window.STORY = ' + json.dumps(story, ensure_ascii=False) + ';\n', encoding='utf-8')
    print(f"{len(lines)} lines · {len(scenes)} scenes · {duration:.1f}s" + (f" · {voice}" if story['voice'] else ''))
    for s in scenes: print(f"  {s['t0']:6.2f}–{s['t1']:6.2f}  {s['id']}")

if __name__ == '__main__': main()
