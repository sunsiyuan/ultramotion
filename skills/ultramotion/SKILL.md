---
name: ultramotion
description: "Makes finished motion-graphics VIDEOS (mp4 with music and sound) from a prompt, rendered from code in a browser: 58 templates plus the engines behind them. Neon signs, glitch titles and posters, pixel art, karaoke and lyric videos, paper cut-outs and pop-ups, fluid (ink in water, marbling, light in water, milk pouring), light particles, liquid glass, kinetic typography, bar chart races and data animation, event replays on 3D maps, infographics, film title sequences, Van Gogh and Monet paintings that move, Chinese ink wash, whiteboard and chalkboard explainers, flat narrated explainers, variety-show captions on your own footage. Use it for any 动效 / 片头 / 视频 / animation / motion graphics / explainer / lyric video / logo reveal / social video request — 霓虹 故障 像素 卡拉OK 歌词 剪纸 流体 粒子 液态玻璃 动感排版 数据动画 信息图 水墨 油画 手绘 综艺花字."
---

# ultramotion

A finished video from a prompt: the picture is a web page drawn as a pure function of time, `render.py` turns it into an mp4, and `sound.py` writes the music and the sounds. Below, `$SKILL` is this folder (where this file is).

- `templates/` — 58 templates, each a folder with `TEMPLATE.md` and the pages to start from. The index is `templates/README.md`, grouped by what people make (signs and posters, lyrics and music, data and news, titles and intros, product and brand, art in motion, greetings, explainers).
- `lib/<engine>/` — the engines the templates are built on, each with a `GUIDE.md`: what it does, how things move in it, its API, its sound, and what to check.
- `render.py` — page → mp4, contact sheets, sound only, loop seams, footage frames. The usage is at the top of the file.
- `sound.py` — sampled instruments, ready arrangements and the sounds of the picture; the full list is at the top of the file.

## Working

1. Read the request for who it is for, where it will play, and what it has to say. Write the content for that place and audience.
2. **A template fits** (look through `templates/README.md`): read its `TEMPLATE.md`, copy the starting page that matches the user's language and the media it loads into the project, copy the engine files its `<script>` tags load from `lib/` next to it and point the tags at the copies. Keep the look, pacing, camera, type and music; change what the user's content changes.
3. **Nothing fits**: pick the engine (or engines) for the picture the content wants, read their `GUIDE.md`, look at the templates built on them for how ideas are carried out, then make your own piece — not a variation of the nearest template.
4. `python3 $SKILL/render.py page.html --preview --at 1,4,8,12` → `preview.png`; look at it, open a frame at full size (`--full`), fix, look again.
5. `python3 $SKILL/render.py page.html --out video.mp4`, then watch a contact sheet of the mp4 and listen to it before calling it done.

Needs ffmpeg, Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`, and Playwright's Chromium or an installed Google Chrome; music on sampled instruments needs fluidsynth (`brew install fluid-synth` / `apt install fluidsynth`; the soundfont downloads itself on first use). Engines that need more say so in their GUIDE.md. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox; don't re-implement the page in another language to get around it.

## Engines

| `lib/…` | what it draws |
|---|---|
| `neon-sign` | real neon tubes switching on, on a wall, the user's photo or footage, through a wet window |
| `glitch` | a picture broken by one WebGL pass: splits, tears, compression blocks, datamosh, CRT off |
| `pixel` | low-resolution pixel art blown up with hard edges, people posed by their joints in 16-bit shading, photos turned to pixels, chiptune (`chip.py`) |
| `karaoke` | lyrics timed to a recording word by word (`lyrics.py`), the next line always on screen, any number of singers |
| `paper` | cut paper in layers with real shadows: folds, pop-ups, cut-paper titles, vellum, one light and a 3D camera |
| `mesh-gradient` | real fluid on the GPU (`fluid.js`: ink, paint, light, marbling, satin) and soft colour fields that loop (`mesh.js`) |
| `light-particles` | up to 1.6M glowing particles gathering into products, models, towns and titles |
| `liquid-glass` | Apple-style glass that pops, stretches, merges and bends text (`scene.html` with cuts) |
| `kinetic-type` | heavy type slamming in on the beat, colour-block cuts (`scene.html` with cuts) |
| `data-story` | years of real data played as time: lines, columns, ranking races, rolling numbers |
| `event-replay` | a moment replayed from data: a stretching clock, maps on real relief (`relief.py`), unit grids |
| `infographic` | one crowd of units re-formed for every question: blocks, piles, waffles, rings |
| `title-sequence` | slow film titles over fog, light, dusk and footage, letter-spacing reveals, vertical Chinese |
| `painterly` | oil-paint strokes that follow the form, the painting moving, the camera walking in |
| `ink-wash` | Chinese ink spreading on rice paper, scenes dissolving through the ink, a carved seal |
| `whiteboard` | writing and drawing stroke by stroke on a whiteboard, notebook or chalkboard, real Chinese stroke order |
| `flat-explainer` | narrated flat animation timed to every word of the voice-over (`story.py`) |
| `variety-captions` | variety-show pop words, bursts and sound effects on the user's own talking-head footage (`vc.py`) |

## Judgment

- **The content decides.** What is being said, to whom, where it plays; the look follows. A shop sign says what that shop would put up; a data piece answers one question and its title is the answer.
- **Every frame is a pure function of t.** No state carried between frames; `seek(t)` can jump anywhere.
- **Real things stay real.** Data from a named source, computed on the page, the source on screen; the user's own photo or footage over an invented one; if a recognisable thing would have to be drawn badly in code, use a photo, crop tighter, or leave it out.
- **Sound lands on what happens.** A tick when a number changes, a strike when a tube lights, a chord when a card lands. The picture doesn't flash or pump with the beat.
- **The music fits the weight of the piece.** A greeting or a short explainer gets one or two instruments; orchestral weight is for events that can carry it. Write it on sampled instruments (`sound.py`), not synthesised tones.
- **Type**: fonts that are on the machine (the engines list safe stacks), one or two sizes, readable over what is behind it.
- **Look before you call it done**: a contact sheet with a frame inside every moment, a frame at full size, the sound on.

## Sizes

Pages are made 9:16 (1080×1920) or 16:9 (1920×1080). Other shapes are re-laid out from the nearest one, not cropped:
- 3:4 and 4:5 (feeds) from 9:16: shorter; stacked elements close up or lose a layer; the subject stays the same size.
- 1:1 from 9:16, squeezed once more like 4:5; content that runs sideways (maps, timelines) from 16:9.
- 2.39:1 from 16:9: black bars inside the 16:9 frame, type and subject inside the picture.
- Type sizes follow the short side.
- Vertical video: keep the subject and type out of the bottom and right edges, where the platform's buttons and captions sit.
