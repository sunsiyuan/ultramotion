---
name: liquid-glass
description: Liquid Glass (液态玻璃) motion style — Apple-style glass shapes that pop, stretch, merge and refract text, on a soft lavender–teal gradient, with synthesized music and droplet sounds. Use when asked to make a liquid-glass / 液态玻璃 / glassmorphism motion video, title intro, product or feature launch video, app UI demo, or a talking-head background, rendered from code to mp4.
---

# Liquid Glass

Everything you see is drawn by `scene.html`; everything you hear comes from `score.py`. Open `scene.html` in a browser and it plays.

## Workflow

1. Copy `scene.html` and `score.py` into your project and work on the copies. Leave the installed skill untouched.
2. If one of the existing cuts fits, use it with URL parameters. Otherwise write a new cut (see *Making a new video*).
3. Open `scene.html?cut=yourcut` in a browser and watch it.
4. Render the frames to mp4 (*Rendering*).
5. Make the soundtrack and mux it in (*Sound*).
6. Look at a contact sheet before you call it done (*Check your output*).

## How it moves

When you write new motion, use these — they are the style.

- **Pop with overshoot.** Shapes appear with a spring that overshoots ~12% and settles (`spr()`), so they feel soft, like jelly.
- **Stretch along motion.** A moving shape stretches along its direction of travel and narrows across it, then rounds out when it stops (`moving()`). This is most of what makes it read as liquid.
- **Merge and split.** Glass shapes are blended with a smooth union: when they get close they join into one drop, and when pulled apart they neck and snap. Splitting a pill into buttons, budding a tile out of its neighbour, collapsing everything back into one drop — all of it is just moving shapes while `k` does the joining.
- **Lens over text.** Text placed behind the glass (layer A) is magnified and bent near the edges, with a faint RGB fringe.
- **Text floats up**, one character at a time, from blurred to sharp; it exits with a sideways smear.

Palette: lavender `#8a78e6`, lilac-white `#e7e3f3`, teal `#8cc9d8`, ink `#1b1b22`, accent blue `#3b7bf6`. Dark mode swaps to a deep indigo/teal background with white ink. 120 BPM.

## The page

Canvas is 1080×1920 (vertical). `scene.html` exposes `window.__scene`:

| | |
|---|---|
| `duration` | length of the selected cut, seconds |
| `ready` | Promise — wait for it before capturing |
| `seek(t)` | draws the frame at second `t`; resolves when drawn |
| `drops` | times (s) where a shape pops or merges — feed these to `score.py` |
| `cues` | optional sound cues `{t, kind, d}` (whoosh, chime, click, type, blip, sweep…) |

**The frame is a pure function of `t`.** No state carries between frames, so you can render any range, in any order. For slow motion, step `t` in smaller increments — `seek(i / 120)` encoded at 30 fps is 4× slower, and every frame is still sharp.

URL parameters:

| | |
|---|---|
| `cut=` | `showcase` 16 s tour · `opener` 4 s title · `bg` 16 s seamless loop with the centre left empty for a person · `plain` 16 s loop, gradient only, to put other footage on · `product` · `search` · `data` · `music` 6 s examples |
| `title=Line one\|Line two` | opener title |
| `layout=top` | opener title in the top third, room for a person below |
| `lang=en` | English text in the frame |
| `theme=dark` | dark mode, works with any cut |
| `rec=1` | **always add this when rendering** — without it the page autoplays and fights your `seek()` |

If a person will talk over the video, put `opener` (with `layout=top`) straight in front of `bg` with no transition: the opener's last frame is exactly `bg`'s first frame. `bg` loops seamlessly for as long as they talk.

## Making a new video

New content = a new cut: a function `t → frame`, registered in `CUTS` with its `duration`, `drops` and `cues` (see `product`, `search`, `data`, `music` for 6-second examples). **List a `drops` time for every pop and merge in your cut** — that is where `score.py` puts the droplet sounds; leave it empty and the video is silent at exactly the moments that need sound.

A frame is:

- `shapes`: glass shapes — `box(x, y, halfW, halfH, radius, tint?)`, `circle(x, y, r)`. `tint` is `[r, g, b, alpha]`, 0–1. **At most 12 per frame** — extras are dropped without any error.
- `A`: draw functions for what sits **behind** the glass (gets refracted) — usually big titles via `text(ctx, str, x, y, {size, fx})`.
- `B`: draw functions for what sits **on** the glass (not refracted) — `label`, `icon`, `appIcon`, UI details.
- `k` (blend radius, 40–150), `refr` (edge refraction, ~40–52), `mag` (lens zoom, 1.03–1.16), `bev` (edge width), `bgT` (background time).

Timing helpers: `seg(t, a, b)` 0→1 over [a, b]; `io` / `oc` easings; `spr(t, start, dur)` overshooting pop; `path(keys, t)` keyframed position; `moving(keys, t, r)` a lens that stretches along its path; `enter(t, start)` / `both(t, in, out)` per-character text in/out.

## Rendering

You need a headless Chromium-based browser with WebGL (Playwright, Puppeteer, or Chrome's own `--headless`) and ffmpeg.

1. Open `scene.html?rec=1&cut=…` at a 1080×1920 viewport, device scale factor 1. A plain `file://` URL works — the page loads nothing external, so no server is needed.
2. Wait for `window.__scene.ready`.
3. For each frame `i`: `await __scene.seek(i / fps)`, then screenshot the viewport.
4. Encode the frames with ffmpeg (`-framerate 30`, libx264, `yuv420p`).

**If you're in a sandbox and the browser won't start** (e.g. Codex's `workspace-write` sandbox, where Chromium aborts on launch), ask for permission to run it outside the sandbox. Don't re-implement the shader in another language to get around it — that is far slower and drifts from the look.

## Sound

```python
from score import score            # numpy + scipy only
music = score(duration, drops, bpm=120, drums=True)   # (n, 2) float array, 48 kHz
```

It returns a pad + glassy bell arpeggio + light drums, with a droplet sound at every time in `drops`. Write it to wav (e.g. `scipy.io.wavfile.write`), optionally add whooshes at `cues`, and mux with ffmpeg (`-shortest`). If a voice-over will go on top, use `drums=False`.

## Check your output

Pull 8–10 frames from the mp4 into a contact sheet and look at them. If you see:

- **dark rings or orange edges around black text under the lens** — the RGB fringe or edge refraction is too strong. Keep the fringe around ±5% and `refr` around 48 (±10% and 70 px is what causes it).
- **a thin seam between two tiles while one buds out of the other** — `k` is too small for the gap (30 px apart needs `k` ≥ 50). Raise `k` while they bud, lower it once they settle.
- **a jump where the `bg` loop restarts** — some background motion has a period that doesn't divide 16 s.
- **a title that looks smaller than the size you set** — `text()` shrank it to fit 900 px. Shorten or split the line rather than lowering the size further.
