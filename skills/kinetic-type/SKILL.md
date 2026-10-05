---
name: kinetic-type
description: Kinetic Type (动感排版) motion style — heavy condensed type that slams in on the beat, flat colour blocks (one bold accent, off-white, ink), rotating starburst badges, perspective tunnels, scrolling tape bands and diagonal wipes, at 128 BPM with a synthesized electronic beat. Use when asked to make a kinetic typography / 动感排版 / bold type / beat-synced video — a gig or event promo, lyric video, quote card, countdown, chapter card, stat reveal, big emphasis text for a talking-head video, or its background — rendered from code to mp4.
---

# Kinetic Type

Everything you see is drawn by `scene.html` (Canvas 2D, no WebGL); everything you hear comes from `score.py`. Open `scene.html` in a browser and it plays.

The built-in content is a made-up gig — names, venue and date are all invented; replace them with yours. Each language is its own local event, not a translation: English is Night Shift on 10.31, Chinese is a New Year's Eve show (零点现场, 12.31). When you localise, change the occasion, not just the words.

## Workflow

1. Copy `scene.html` and `score.py` into your project and work on the copies. Leave the installed skill untouched.
2. If one of the existing cuts fits, use it with URL parameters. Otherwise write a new cut (see *Making a new video*).
3. Open `scene.html?cut=yourcut` in a browser and watch it.
4. Render the frames to mp4 (*Rendering*).
5. Make the soundtrack and mux it in (*Sound*).
6. Look at a contact sheet before you call it done (*Check your output*).

## How it moves

When you write new motion, use these — they are the style.

- **Everything lands on the beat.** Times are written in beats: `b(n)` is beat `n` at 128 BPM. A word, a cut, a wipe — each starts on a beat or half-beat. Never place anything in raw seconds.
- **Slam in.** Letters drop from above one by one with a slight twist and an overshoot (`drop()`); single words punch in from 1.5× scale on their beat (`punch()`).
- **Leave with a smear.** Letters exit sideways, staggered (`out()`).
- **Cut with a diagonal wipe.** A colour block sweeps across the frame; the scene changes at the moment it covers everything (`wipe()`).
- **Keep something moving between hits.** Starburst badges rotate, tunnels pull toward the camera, tape bands scroll, rings of text spin — and things pulse on every beat (`pulse()`).

Palette: one strong accent plus off-white `#efefe6` and ink `#151713`; each scene is one flat colour block. The accent follows the occasion — orange `#ff6a13` for the English event (Halloween), red `#e8202a` for the Chinese one (New Year's Eve). Swap it with `&accent=`. 128 BPM.

## Type

Use installed fonts; point the `KT Latin` / `KT CJK` `@font-face` rules at them.

- **Latin:** a tall, very heavy condensed sans, in capitals — e.g. Anton, League Gothic, Bebas Neue. The built-in renders use Anton.
- **Chinese:** the heaviest weight of a plain, upright sans — e.g. Source Han Sans Heavy, Noto Sans CJK SC Black, HarmonyOS Sans Black. The built-in renders use Source Han Sans Heavy.
- **Avoid:** slanted or decorative display faces, and regular-weight UI fonts.

Without them the page falls back to Helvetica Neue Condensed Black or Impact, and PingFang SC.

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
| `accent=dfff1a` | swap the accent colour |
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
music = score(duration, hits, bpm=128, drums=True)   # (n, 2) float array, 48 kHz
```

It returns kick on every beat, clap on 2 and 4, hats, an off-beat bass ducked by the kick, and a chord stab plus low impact at every time in `hits`. Write it to wav (e.g. `scipy.io.wavfile.write`), optionally add whooshes at `cues`, and mux with ffmpeg (`-shortest`). If a voice-over will go on top, use `drums=False`.

## Check your output

Pull 8–10 frames from the mp4 into a contact sheet and look at them. If you see:

- **wide, soft-looking letters, or thin Chinese** — the browser fell back to the default fonts. See *Type*.
- **motion that feels late or mushy against the music** — something is placed in seconds instead of beats, or its `hits` time is missing.
- **a badge or band sitting on top of a title** — positions are fixed; move the element, not the font size.
- **a jump where the `bg` loop restarts** — a band's scroll speed isn't a whole number of repeats per loop.
