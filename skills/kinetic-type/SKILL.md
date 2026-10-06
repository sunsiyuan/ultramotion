---
name: kinetic-type
description: Kinetic Type (动感排版) motion style — heavy condensed type that slams in on the beat, flat colour blocks, rotating starburst badges, perspective tunnels, scrolling tape bands and diagonal wipes, cut to a synthesized electronic beat; the colours, typefaces and tempo are chosen for each video. Use when asked to make a kinetic typography / 动感排版 / bold type / beat-synced video — a gig or event promo, lyric video, quote card, countdown, chapter card, stat reveal, big emphasis text for a talking-head video, or its background — rendered from code to mp4.
---

# Kinetic Type

Everything you see is drawn by `scene.html` (Canvas 2D, no WebGL); everything you hear comes from `score.py`. Open `scene.html` in a browser and it plays.

The built-in content is a made-up gig — names, venue and date are all invented; replace them with yours. Each language is its own local event, not a translation: English is Night Shift on 10.31, Chinese is a New Year's Eve show (零点现场, 12.31). When you localise, change the occasion, not just the words.

## Workflow

1. Copy `scene.html` (or the example closest to what you want, from `examples/`) and `score.py` into your project and work on the copies. Leave the installed skill untouched.
2. Decide the look for this content and audience (*The look*) and set it in `LOOK`.
3. If one of the existing cuts fits, use it with your words. Otherwise write a new cut (see *Making a new video*).
4. Open `scene.html?cut=yourcut` in a browser and watch it.
5. Render the frames to mp4 (*Rendering*).
6. Make the soundtrack and mux it in (*Sound*), at the same BPM as the page.
7. Look at a contact sheet before you call it done (*Check your output*).

## How it moves

When you write new motion, use these — they are the style.

- **Everything lands on the beat.** Times are written in beats: `b(n)` is beat `n` at the page's BPM. A word, a cut, a wipe — each starts on a beat or half-beat. Never place anything in raw seconds.
- **Slam in.** Letters drop from above one by one with a slight twist and an overshoot (`drop()`); single words punch in from 1.5× scale on their beat (`punch()`).
- **Leave with a smear.** Letters exit sideways, staggered (`out()`).
- **Cut with a diagonal wipe.** A colour block sweeps across the frame; the scene changes at the moment it covers everything (`wipe()`).
- **Keep something moving between hits.** Starburst badges rotate, tunnels pull toward the camera, tape bands scroll, rings of text spin — and things pulse on every beat (`pulse()`).

## The look

The motion above is the style; the look is yours to choose for each video. All of it sits in `LOOK` at the top of `scene.html`:

| | |
|---|---|
| `paper` / `ink` | the two grounds — one light, one dark; type sits on one of them, and scenes alternate between them and the accent |
| `accent` | one strong colour that marks the important thing |
| `latin` / `cjk` | the heavy display faces; the first installed one wins |
| `weight` | how heavy the type is |
| `bpm` | the pace — keep it between about 115 and 145: 120 feels warm and upbeat, 128 like a club, 140+ urgent; slower than that and the slams drag |
| `glow` | a tight halo around light type (0 = flat print, 1 = neon); the letters themselves stay sharp |

Pick them from what the video is and who watches it — the occasion, the place, the season, the genre — so it looks made for this event rather than for any event. It doesn't have to be literal: a night market can look like an old printed poster, a design talk like a Swiss grid, a gaming night like neon. Start from the example closest to your idea and change it.

Fonts must be installed; describe the kind you want and use what's there — e.g. a tall heavy condensed sans (Anton, League Gothic, Bebas Neue, Big Shoulders Display, Helvetica Neue Condensed), a heavy didone or slab serif for a printed-poster feel (Bodoni, Didot, Rockwell), and for Chinese the heaviest weight of a plain sans (Source Han Sans Heavy, Noto Sans CJK Black), a Song face for a printed feel (Songti), or a display face for something playful (Smiley Sans, ZCOOL KuaiLe).

## Taste

- **Two grounds and one accent.** Every scene is one flat block of `paper`, `ink` or `accent`. A second accent makes it a different video, not a richer one.
- **One word big, the rest small.** Each beat has one thing that lands; supporting text is a quarter of its size or less.
- **Type fills the width.** Big words run edge to edge (the 936 px measure); a timid size reads as a slideshow.
- **Every move on the beat.** If something feels off, it is almost always timing, not colour.
- **Let it breathe once.** Hold the strongest frame for a full beat before the next cut.

## Examples

`examples/` — each is `scene.html` with its own `LOOK` and its own event; open one in a browser to watch.

- `night-market-retro.html` — 中文, a summer night market as an old printed poster: cream paper, brown ink, mustard, Bodoni and Song type, 120 BPM.
- `type-coffee-swiss.html` — English, a design meetup as a Swiss grid: off-white, black, one red, condensed Helvetica, 112 BPM.
- `arcade-night-neon.html` — 中文, an all-night arcade in neon: dark ground, glowing magenta, Big Shoulders and Smiley Sans, 140 BPM.
- `scene.html` itself — a gig poster: off-white, ink and one hot accent, Anton and Source Han Sans Heavy, 128 BPM.

## The page

Canvas is 1080×1920 (vertical). `scene.html` exposes `window.__scene`:

| | |
|---|---|
| `duration` | length of the selected cut, seconds |
| `ready` | Promise — wait for it before capturing |
| `seek(t)` | draws the frame at second `t`; resolves when drawn |
| `hits` | times (s) where a word slams in — feed these to `score.py` |
| `cues` | optional sound cues `{t, kind, d}` (whoosh, riser, sweep, chime…) |

**The frame is a pure function of `t`.** No state carries between frames, so you can render any range, in any order, at any frame rate.

URL parameters:

| | |
|---|---|
| `cut=` | `showcase` 15 s tour · `opener` 3.75 s title · `bg` 15 s seamless loop with the centre left empty for a person · `quote` · `countdown` · `chapter` · `data` 5.6 s examples |
| `title=Line one\|Line two` | opener title |
| `layout=top` | opener title higher, room for a person below |
| `lang=zh` | Chinese text in the frame |
| `accent=dfff1a` | swap the accent colour · `bpm=` the tempo (everything else lives in `LOOK`) |
| `rec=1` | **always add this when rendering** — without it the page autoplays and fights your `seek()` |

If a person will talk over the video, put `opener` straight in front of `bg` with no transition: the opener's last frame is exactly `bg`'s first frame, and `bg` loops seamlessly for as long as they talk.

## Making a new video

New content = a new cut: a function `(ctx, t) → draws the frame`, registered in `CUTS` with its `duration`, `hits` and `cues` (see `quote`, `countdown`, `chapter`, `data`). The event's words live in `HUD`, `LINEUP` and `HEADLINER` near the top, and `band()` takes either one word or a list of names. **List a `hits` time for every word that slams in** — that is where `score.py` puts the stab and the impact; leave it empty and the big moments land in silence.

Drawing helpers:

- `fill(ctx, colour)` — the scene's colour block.
- `line(ctx, str, x, y, size, {color, align, track, fx, maxW})` — one line of heavy type at baseline `y`, with a per-letter effect `fx`. A line wider than `maxW` (936 px) shrinks to fit.
- `badge(ctx, x, y, r, t, scale)` · `burst(ctx, x, y, r, rot, colour)` — accent disc with a rotating starburst; a bare starburst.
- `tunnel(ctx, t, cx, cy, colA, colB)` · `band(ctx, cx, cy, angle, height, bg, fg, word, offset, size)` · `ring(ctx, cx, cy, r, text, rot, colour, size)` — tunnel, scrolling tape, circular text.
- `wipe(ctx, p, colour)` — the transition; `p` 0→1 over a beat, full cover at 0.5.
- `hud(ctx, [topLeft, topRight, bottomLeft, bottomRight], colour)` — the small corner lines.

Timing helpers: `b(n)` beats → seconds; `seg(t, a, z)` 0→1 over [a, z]; `io` / `oc` / `back` easings; `pulse(t)` 1 on every beat, decaying; `drop(t, start)` / `punch(t, start)` / `out(t, start)` / `both(in, out)` per-letter effects.

## Rendering

You need a headless Chromium-based browser and ffmpeg.

1. Open `scene.html?rec=1&cut=…` at a 1080×1920 viewport, device scale factor 1. A plain `file://` URL works — the page loads nothing external, so no server is needed.
2. Wait for `window.__scene.ready`.
3. For each frame `i`: `await __scene.seek(i / fps)`, then screenshot the viewport.
4. Encode the frames with ffmpeg (`-framerate 30`, libx264, `yuv420p`).

**If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox. Don't re-implement the scene in another language to get around it.

## Sound

```python
from score import score            # numpy + scipy only
music = score(duration, hits, bpm=bpm, drums=True)   # (n, 2) float array, 48 kHz — bpm = window.__scene.bpm
```

It returns kick on every beat, clap on 2 and 4, hats, an off-beat bass ducked by the kick, and a chord stab plus low impact at every time in `hits`. Write it to wav (e.g. `scipy.io.wavfile.write`), optionally add whooshes at `cues`, and mux with ffmpeg (`-shortest`). If a voice-over will go on top, use `drums=False`.

## Check your output

Pull 8–10 frames from the mp4 into a contact sheet and look at them. If you see:

- **wide, soft-looking letters, or thin Chinese** — the font in `LOOK` isn't installed and the browser fell back. Pick an installed one.
- **it looks like every other kinetic-type video** — go back to *The look* and choose it from this event.
- **motion that feels late or mushy against the music** — something is placed in seconds instead of beats, or its `hits` time is missing.
- **a badge or band sitting on top of a title** — positions are fixed; move the element, not the font size.
- **a jump where the `bg` loop restarts** — a band's scroll speed isn't a whole number of repeats per loop.
