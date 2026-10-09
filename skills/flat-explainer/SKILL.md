---
name: flat-explainer
description: Flat Explainer (扁平科普) — a narrated science / explainer animation in flat vector illustration, Kurzgesagt-style. The narration is voiced first (free edge-tts, or the user's own recording) and every word gets a timestamp; scenes are built as layered flat worlds with three-tone shading and atmospheric depth, things pop in on the word that names them, the camera keeps moving and travels across scales, and the music ducks under the voice. Use when asked for an explainer / 科普 / 讲解视频 / 动画讲解 / Kurzgesagt-style / "explain X in a short video" with narration, rendered from code to mp4.
---

# Flat Explainer

`story.py` voices the script and times every word; `flat.js` draws the scenes on a Canvas 2D page and reads those times; `render.py` renders the page to mp4 with the voice on top of the music and sound effects from `sound.py`.

## Workflow

1. **Script.** Write the narration first (`script.md`, see *The script*). One idea per scene; open with a question or a surprising picture; land the big number on its own line; end by coming back to where you started.
2. **Voice it.** `python3 story.py script.md` → `voice.wav`, `story.json`, `story.js`. Own recording: `python3 story.py script.md --audio take.wav`. No voice yet: `--dry` gives estimated timings to lay out scenes.
3. **Check the facts and the arithmetic** in the script before drawing. Numbers on screen must match what is said.
4. **Storyboard.** For each scene: the world it happens in, what appears on which word, how the camera moves, how it hands over to the next scene.
5. **Build the page** (copy an example): one function per scene, all times taken from the narration (`S.at('word')`), never typed in by hand.
6. **Preview** `python3 render.py page.html --preview --at …` with a time inside every scene; fix, repeat.
7. **Render** `python3 render.py page.html --out video.mp4`.
8. **Check** `python3 check.py video.mp4 story.json` — it measures how much of the time the picture is alive, per scene, and lists the still stretches. Fix every scene it flags (a loop, a camera move, something drifting) and render again. Don't hand over a video that fails it.

Needs ffmpeg, Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`, and `pip install edge-tts` (Whisper only for `--audio`). **If you're in a sandbox and the browser or edge-tts can't reach the network**, ask for permission to run outside it.

## The script

```
## drop
这是一滴水。
大约零点零五毫升，比一颗豌豆还小。

## dive
我们钻进去看看。
```

`## name` starts a scene (it becomes the scene function's name), one sentence per line, a blank line is a longer pause, `(pause 1.2)` adds silence. Voices: Chinese `zh-CN-XiaoxiaoNeural` (default), `zh-CN-YunxiNeural`, `zh-CN-YunjianNeural`; English `en-US-AndrewNeural` (default), `en-US-AvaNeural`, `en-GB-RyanNeural`. `--rate +5%` speeds it up.

## How it moves

These are the style.

- **The word is the cue.** Something appears exactly when it is named: `F.pop(t, S.at('豌豆'))`. Labels, numbers and arrows land on their word too.
- **Every shot keeps moving.** A slow push-in on every scene (built in, `push`), plus at least two small loops inside it, big enough to see on a phone: clouds drifting, a leaf swaying, specks rising, planets turning, a dashed ruler marching. No frame should be a still picture with subtitles.
- **Travel across scale with one continuous camera.** From a drop to its molecules, from the Earth to the Moon: zoom one world on an exponential curve, swap in the next world when it fills the frame; mark the scale with a tag (`×1,000,000`).
- **Things land with a bounce.** Pops overshoot and settle; a drop falls and the leaf dips; a planet slides in and stops.
- **Scenes dissolve into each other** with a soft bloom (built in, 0.45 s). A scene that continues the previous shot (the same camera move) goes in `cut: { id: true }` instead.

## How it looks

- **No outlines.** Shapes are separated by value, not lines.
- **Three tones on everything:** `F.flat(ctx, path, colour)` draws the base, a hard-edged shadow on the side away from the light (shifted towards blue-violet, never towards black), and a thin highlight.
- **Depth by haze:** further layers lean towards the sky colour (`F.haze`), the nearest layer is darkest or a silhouette that frames the shot.
- **Gradients only for light:** sky, sun, glows (`F.glow`). Everything else is flat.
- **Round, simple shapes, repeated with variation:** `F.blob`, `F.scatter`.
- **One saturated world colour and one complementary accent per scene** (deep blue with gold, green with orange).
- **Big rounded type for numbers** (`F.say`), plates for names (`F.tag`), subtitles from the narration (`F.subtitles`, the spoken part brighter).

## The page

```js
const X = Flat.create({ width: 1080, height: 1920, scenes: {
  drop(ctx, u, S) { /* u = seconds since this scene began; T = u + S.scene('drop').t0 is the film time */ },
  dive(ctx, u, S) { … },
}, cut: { dive: true }, own: ['drop', 'dive'], push: .07, after(ctx, t, S) { Flat.subtitles(ctx, S, t, { y: 1700 }); } });
window.__scene = Flat.scene(X, { music: { notes }, sounds: [{ t: S.at('一千七百'), kind: 'boom' }] });
```

`own` lists scenes that run their own camera (no automatic push). Narration: `S.at(text, { scene, after })` → when it is said · `S.scene(id)` → `{ t0, t1 }` · `S.lines`, `S.words`.
Drawing: `flat(ctx, path, colour, { shadow, highlight, lightDir, size })` · shapes `circle`, `ellipse`, `rrect`, `blob` · `glow` · `scatter(n, seed, [x, y, w, h], fn)` · `drift(ctx, t, { n, area, color, speed })` · `tag(ctx, text, x, y, { bg, fg, align, a })` · `say(ctx, text, x, y, t, t0, { size, color, out })` · colour `rgb`, `css`, `mix`, `shade`, `light`, `haze` · timing `pop`, `breathe`, `seg`, `io`, `oc`.

## Examples

- `examples/water-drop/` — 中文, 一滴水里有多少个水分子: a drop falls onto a leaf at dawn, one continuous dive into it down to the molecules, a molecule assembled atom by atom, the number, eight billion people counting on a little planet, back out to the drop.
- `examples/planets-gap/` — English, could every planet fit between the Earth and the Moon: the textbook picture flies apart into true scale, the planets drop into the gap one by one, the camera leans in to the room left over.

## Sound

`render.py` mixes the narration on top and ducks the music and effects under it (`duck` in `Flat.scene`, default .35). Music as notes on the page: `{ t, m (MIDI), d, inst, v }` with `kalimba bell marimba piano pluck pad bass organ whistle`, drums `kick snare hat clap shaker`; let it thicken as the story builds and put a bell on the big reveals. Sounds: `whoosh swish riser` (with `dur`), `pop shimmer sparkle chime ding boom tada thud`.

## Check your output

- **`check.py` flags a scene** — it is a still picture with subtitles for too long: add a loop (drifting specks, swaying, turning, a marching ruler) or a camera move to that scene.
- **Something appears before or after its word** — its time is typed by hand; take it from `S.at`.
- **Flat colour blocks that look like clip art** — shapes without the three tones; draw them with `F.flat`.
- **Everything at the same depth** — add a hazier back layer and a dark near layer.
- **Subtitles running off the frame** — they wrap automatically; if a line still needs three rows, split the sentence in the script.
- **A wrong number** — check the arithmetic in the script; the narration and the screen must say the same thing.
