---
name: variety-captions
description: Variety-show captions (综艺花字) on top of real footage — bubbly outlined pop words, episode tags, warning boxes, name tags, explosion bursts, question marks, sweat drops, vertical text, stamps, subtitles, punch-in zooms and cartoon sound effects. Use when asked to add 综艺花字 / variety captions / reaction captions / meme captions / fun subtitles to a talking-head video, vlog, food or pet clip, rendered to mp4.
---

# Variety Captions

`scene.html` draws the captions on a transparent canvas; `vc.py` finds the face in your footage, places each caption around it, previews, and renders the finished mp4 with punch-in zooms and the sound effects from `sfx.py`.

## Workflow

1. Copy every file in this skill's folder (`scene.html`, `vc.py`, `sfx.py`, `detect.swift`) into one folder in your project. Leave the installed skill untouched.
2. Transcribe the footage with word-level timestamps (Whisper, faster-whisper or any ASR that gives times).
3. Write `plan.json` (see *The plan* and *Pacing*): subtitles from the transcript, captions on the moments worth reacting to, zooms on the biggest ones. All caption text comes from this footage. Give captions a `place`, not coordinates.
4. Preview the moments you captioned:
   `python3 vc.py preview --footage talk.mp4 --plan plan.json --at 1.5,4.2,7.8`  → `preview.png`
5. Render: `python3 vc.py render --footage talk.mp4 --plan plan.json --out final.mp4`
6. Pull 8–10 frames from `final.mp4` into a contact sheet and look at them before you call it done (*Check your output*).

Needs ffmpeg, and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`. `vc.py` uses Playwright's bundled Chromium, or the installed Google Chrome when that isn't downloaded. Face finding uses Apple Vision on macOS (`swift`, from the Xcode command-line tools) and `mediapipe` elsewhere (`pip install mediapipe`); with neither, captions are placed around a typical talking-head position. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox.

## The plan

```json
{
  "subs":  [[0.2, 2.6, "first subtitle line"], …],
  "items": [{ "t": 2.0, "d": 1.4, "kind": "burst", "text": "NO WAY!" },
            { "t": 3.6, "d": 1.8, "kind": "pop", "text": "SO GOOD", "place": "below-face" }, …],
  "zooms": [[2.0, 0.7, 1.22], …]
}
```

`t` / `d` are seconds. A zoom is `[start, duration, scale]` and centres on the face. Every item may also set `sfx` to override its default sound. `duration` is optional and defaults to the footage length.

**Placement.** `vc.py` follows the face (or an animal's head) through the footage and places each caption around where the face is during that caption's whole time on screen, clear of the tag, the subtitles and any caption already showing. `place` says where; leave it out to use the kind's default.

| place | where |
|---|---|
| `below-face` | on the chest, the table, the food |
| `above-head` | over the head; drops below the face when there's no room |
| `beside-face` | beside the head, on the side with more room (`left-of-face` / `right-of-face` to choose) |
| `top` / `bottom` | top of the frame / just above the subtitles |

Write `x` / `y` (fractions of the frame) only to pin a caption to a fixed spot.

| kind | what it is | fields | default place | default sound |
|---|---|---|---|---|
| `pop` | big bubbly word, pops in letter by letter, with sparkles | `text`, `sub` (small line above), `size` (150–220), `color`, `rot` | below-face | boing |
| `tag` | pill label, top-left, stays on screen | `text`, `color` | top-left | none |
| `burst` | explosion shape + speed lines + white flash | `text`, `color`, `size` | above-head | duang |
| `warn` | hazard-striped box that shakes and blinks | `text` | above-head | alarm |
| `name` | name card with a title strip and a pointer | `title`, `text` | beside-face | pop |
| `ask` | floating question marks | `count` | beside-face | ding |
| `sweat` | two sweat drops sliding down | — | beside-face | drip |
| `vertical` | column of text, one character at a time | `text` | beside-face | none |
| `stamp` | red circular stamp slamming in | `text` | below-face | thud |

Colors: `yellow` `pink` `cyan` `green` `red` `white`.

## Pacing

- A `tag` with the show or episode name for the whole clip, and a subtitle for every spoken line.
- Every reaction gets a caption on the word that carries it: surprise and verdicts → `pop`, complaints and suffering → `sweat` or `pop`, questions → `ask`, awkward pauses → `vertical`, introducing someone → `name`, the final verdict → `stamp`.
- The biggest reaction in the clip gets a `burst` with a zoom on the same moment; a `warn` can announce it a second or two earlier.
- One big caption at a time, 1–2.5 s each. Pop words 150–220 px; keep them to a few words, the punchline rather than the whole line.

## Type

- **Pop words, tags, name cards:** a rounded, heavy, playful face — e.g. Luckiest Guy for Latin, ZCOOL KuaiLe (站酷快乐体) for Chinese.
- **Bursts and warnings:** a condensed comic face for Latin — e.g. Bangers; the heaviest weight of a plain sans for Chinese — e.g. Source Han Sans Heavy.
- **Subtitles:** a heavy plain sans.

The page uses them if installed (`local()` in the `VC …` `@font-face` rules); point those rules at what you choose. Without them it falls back to system fonts.

## Sound

Sound the moments that should land — a reaction, a punchline, the verdict — and let the rest play silent; about half the captions get a sound. Keep the second before the biggest hit quiet so it lands harder, keep sounds at least 0.8 s apart, and leave labels and awkward pauses silent (the silence is the joke). Set `sfx` on each caption for what is happening at that moment; the kind's default is a fallback. Repeats of one sound come back at a different pitch.

| moment | sfx |
|---|---|
| something appears, a playful word | `boing`, `pop` |
| a label slides in, a cut | `swoosh` |
| the biggest hit of the clip | `duang`, `cymbal` |
| warning, "here it comes" | `alarm`, `heartbeat` |
| a good thing, a highlight, cute | `sparkle`, `ding` |
| success, the verdict, "worth it" | `tada` |
| failure, disappointment | `wahwah`, `slide-down` |
| rising hope, getting excited | `slide-up` |
| spicy, heated, angry | `fire` |
| awkward pause, nobody laughs | `crickets` |
| nervous, "uh oh" | `gulp`, `drip` |
| a twist, a record stop | `scratch` |
| a stamp, a heavy landing | `thud` |
| keep this caption silent | `none` |

`vc.py render` keeps the footage's own audio and mixes the effects on top. Add `--bgm` for a light plucked loop when the footage has no music. To use the effects elsewhere:

```python
from sfx import track
audio = track(duration, hits, bgm=False)   # (n, 2) float array, 48 kHz
```

## Check your output

Pull 8–10 frames from the mp4 into a contact sheet and look at them. If you see:

- **a caption over a face** — give it another `place`, or pin it with `x` / `y`.
- **letters running into each other** — the word is too long for its size; shorten it or split it across `sub` and `text`.
- **two big captions on screen at once** — stagger them or drop one.
- **a subtitle shrunk to a thin line** — the line is too long; split it into two `subs`.
