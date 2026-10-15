---
name: mesh-gradient
description: "Mesh Gradient (流体渐变) — makes a VIDEO (mp4 with sound) where flowing colour is the subject: real fluid on the GPU (ink clouding through water and gathering into a wordmark, light rising through dark water, milk poured into coffee, paper marbling combed into feathers, satin folding in light) and soft fields of colour that flow and fold into each other, change as the content changes (the sky through a day, a mood, a song's sections, a breath), melt out of a photo or a cover and condense back into it, or gather into one living shape on an empty page — and loop without a seam when the piece plays on repeat. Mixes colour in OKLab so blends never go grey, dithers so the gradients don't band in the mp4. Use it when asked for a 流体 / 墨水入水 / 湿拓画 / 大理石纹 / 流体渐变 / 弥散渐变 / 渐变背景 / 呼吸引导 / 冥想 / 循环背景 / Spotify Canvas / 歌曲循环视频 / 等待画面 / fluid simulation / ink in water / marbling / mesh gradient / gradient loop / ambient loop / breathing animation / colour-of-the-day piece, or a soft colour ground under other type. In the manner of the Apple Music lyrics background (the cover's colours drifting behind the words) and Stripe's silk-like gradient shapes on white."
---

# Mesh Gradient

`fluid.js` (load after `mesh.js`) moves real fluid on the GPU: `Fluid.sim` — ink, paint, light or smoke in water, with sharp edges, eddies, sinking and rising, obstacles and shading; `Fluid.marble` — paper marbling drop by drop and stroke by stroke; `Fluid.silk` — satin folding in light. `mesh.js` draws flowing colour fields with WebGL2 into any 2D canvas (whole frame or any rectangle), melts pictures into their own colours, takes the main colours out of an image, and finishes the frame with grain and a dither; everything is a pure function of t and every flow comes back to where it started after `loop` seconds. `render.py` renders the page to mp4 with the score from `sound.py` (sampled instruments), captures frames losslessly, folds a looping piece's sound tail back into its start, and checks the seam. Open the files in `examples/` through a local server (`python3 -m http.server`) to watch them; `render.py` loads them directly.

## Workflow

1. Copy `mesh.js`, `fluid.js`, `render.py`, `sound.py` into your project; work on the copies.
2. Work out who it is for and where it plays (*What to make*), and what the colour is carrying in this piece.
3. Choose what the colour is made of — a fluid (ink, paint, milk, light, smoke, marbling, satin) or a colour field — and the colours from the content: a photo or cover (`Mesh.palette`), the brand, the real thing the piece is about (the sky, a season, a material), a feeling.
4. Build the page (*The page*); write the score (*Sound*).
5. `python3 render.py page.html --preview --at 1,4,8,12` → a contact sheet; `--preview --at 6 --full` for one frame at full size. For a loop, the preview also prints the seam check.
6. `python3 render.py page.html --out video.mp4`.

Needs ffmpeg, fluidsynth (`brew install fluid-synth` / `apt install fluidsynth`; the soundfont downloads itself on first use) and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`; uses Playwright's Chromium or the installed Google Chrome. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox; if frames come out blank, launch Chromium with `--disable-gpu`.

## What to make

The colour is the subject, not a backdrop for something else. A fluid that moves like the real thing is worth watching on its own; the topic rides on it. Decide what it does in this piece:

- **A real fluid doing what it does** — ink dropped in water clouding and curling, paint poured and folding over itself, milk tumbling into coffee, light or smoke rising through the dark, paint on water combed into a pattern. The material comes from the content (the product, the craft, the song's mood); the motion comes from forces you place in time (`Fluid.sim`, `Fluid.marble`).
- **A fluid that becomes something** — ink gathering into a wordmark, paint flowing around a logo (`obstacle`), a picture dissolving into the water (`load`). A simulation runs one way: to gather, run it forward from the finished shape and play it backwards.
- **A loop that plays behind something** — a Spotify Canvas or song loop (3–8 s, no words; the app shows the title), a livestream waiting screen, a wallpaper, a lobby screen. The flow is the whole piece; the last frame must flow into the first.
- **Colour that reports something real** — the sky over a city through one day, the seasons, air quality, a heart rate, the mood of a diary. The colours are computed from data; say on screen where the data comes from.
- **A guide** — breathing, a meditation timer, a focus session. One shape or one field that grows, holds and shrinks with the instruction; the words are a single word or a count.
- **A picture dissolving into its colours** — a cover, a photograph, the previous scene melting into a flowing field and condensing back (`melt`). Use the user's own picture or real photography; if you'd have to draw a recognisable thing (a shop front, a machine, a face) in code, don't — use a photo, a plain field, or a tighter crop.
- **A brand piece or title cards** — a piece of colour placed on a quiet page (white, cream, black) like a fold of silk, with names or a headline beside it; the colours change with each card.
- **Under other type** — lyrics, a quote, a countdown, an announcement. Here the field is a ground: keep it slow and keep the type readable.

Pick the strength for the setting: a product loop on a café screen settles slowly; an ident gathers, locks, and holds; a song teaser can be turbulent; a sleep guide barely moves and has no edges; a song loop can swirl; a brand card is crisp and sculptural.

## How it moves

**Fluid (`Fluid.sim`, `Fluid.marble`)**

1. **Forces, not paths.** Pour, drop, push, swirl at places and moments (`step(F, t, dt)` is a function of t only); gravity sinks heavy dye and lifts light; curl keeps eddies alive. Don't steer blobs along curves.
2. **Sharp.** Keep `dye: 1` (full-resolution dye) and a fine grid where the detail is (`res` 240–320).
3. **Something happens, then it settles.** A pour, a burst, a stroke — then let viscosity rise and the motion die down (`viscosity`, `fade` as functions of t) so the end can hold under the words.
4. **Time is yours.** The simulation is deterministic: `F.at(simTime(t))` plays it at any speed or backwards (ease in, slow to a lock, a forward breath at the end). Marbling is a pure function of t: build the list of drops and strokes from t each frame; `Fluid.grow` spreads a drop as it lands, `head` draws a stroke.
5. **Fast enough to render.** `fps × substeps` steps per second of video; more is smoother and slower. A preview of the late seconds runs the simulation from 0 — keep `keep` snapshots so seeking is cheap.

**Colour fields (`Mesh.field`)**

1. **The field never stops and never hurries.** Between two frames you can't see it move; a few seconds later it has clearly changed. A colour region takes several seconds to drift across a fraction of the frame. `loop` sets the pace as much as the seam: a longer loop is a slower flow.
2. **Edges change shape; regions don't slide.** Colours fold into one another, swell and recede; a whole blob gliding across the screen in a circle reads as a screensaver. Points drift a little (`wander`, amount .02–.08); the folding (`warp`) does the rest.
3. **Colour changes carry the story.** When the content changes — a new card, sunrise, inhale, the chorus — change the palette (`key` with colours, mixed in OKLab) over 0.8–3 s, or let it track the data continuously. Don't flash or cut colours on the beat.
4. **Melt and condense.** A picture can melt into its own flowing colours (amount 0 → 1 over 1.5–3 s) and come back. For a loop, start and end on the same state.
5. **Loop when it will be looped.** `scene({ loop: true })`; drive everything that moves with `t` through periodic functions of the loop length (`wander`, `breath`, `Math.sin(TAU * t / loop)`, the field's own `loop`); the end of a fade-out equals the start of the fade-in. `render.py` prints the seam: last→first should be no bigger than an ordinary step.
6. **Type stays still.** Fade it in and out (0.4–1 s), rise a few pixels at most. The field moves behind it.

## Colour

- Fluid modes: `ink` — pigment on a light ground, colours multiply (yellow and blue make green); `light` — glow on dark, colours add; `paint` — opaque, the newest covers. `F.draw` takes the ground (`bg`, `bg2`), `gain`, and relief and highlights from the dye's thickness (`shade`, `spec`, `shine`, `edge`, `light`).
- Marbling: up to 24 colours by index, a `base` for the water, `texture` / `grain` for pigment that stretches with the strokes, `rim` for the darker ring at a drop's edge.

- Three to five colours per state, plus a base for the empty areas when the field doesn't fill the frame. Draw them from the content (`Mesh.palette(img, { k: 5, minChroma: .03 })` for a photo or cover).
- Neighbouring hues blend best; a complementary pair through OKLab still works (`mix`), but give the in-between colour its own point if you want it to read.
- Keep one region darker or lighter than the rest so the frame has depth; a field of equal-lightness colours looks flat.
- `tone(c, { dL, dC, dh, L, C, h })` derives shades: a darker version of the field for text shadows, a desaturated one for the base.
- Grain .02–.04 on colour fields (`finish`); always call `finish` last — it also dithers so the gradients don't band.

## Type on colour

- Decide the type colour by the field's lightness at that place and moment; white on mid-tones needs a soft shadow taken from the field (`shadow: { color: Mesh.rgba(Mesh.tone(c, { dL: -.25 }), .35), blur: 28 }`).
- On white or cream pages put dark type in the empty part and the colour opposite it.
- Thin or light weights for calm pieces, heavier grotesques for brand cards; Chinese in 苹方 `HEI` or 宋体 `SONG` light weights. One or two sizes.
- Colour inside letters (`within`) is for a word that is the whole piece (a title, a single word); not for body text.

## The page

Fluid:

```js
const F = Fluid.sim({ width, height, res, dye, fps, substeps, keep, mode, curl, gravity, viscosity, fade, turbulence, pressure,
  start(F) { F.load(img, { amount, mass, replace }); F.obstacle(img); },
  step(F, t, dt) { F.drop({ x, y, r, color, amount, vx, vy, mass, hard }); F.pour({ …same }, dt); F.swirl({ x, y, r, spin }, dt); F.push({ x, y, r, vx, vy }, dt); } });
function draw(c, t) { F.at(t); F.draw(c, { bg, bg2, gain, shade, spec, shine, edge, light, vignette, rect, a }); …type…; M.finish(c, t, { grain }); }
Fluid.marble(c, t, [Fluid.drop(x, y, r * Fluid.grow(t, t0, dur), colourIndex), Fluid.tine({ x, y, angle, shift, falloff, spacing, alternate, head, soft }),
                    Fluid.wave({ angle, amp, wavelength, phase }), Fluid.swirl({ x, y, angle, falloff })], { colors, base, aa, texture, grain, rim, rect });
Fluid.silk(c, t, { colors: [shadow, mid, light, highlight], folds, depth, sharp, drift, angle, spec, shine, aniso, sheen, light, loop, rect });
```

- Positions are 0..1 of the frame for `sim`, short-sides (y down) for `marble`. Speeds are short-sides per second. `gravity` > 0 sinks, < 0 rises; `turbulence: { amount, scale, speed, seed }` stirs the whole tank slowly.
- A wordmark or logo: draw it into a layer (`M.layer`) and `load` it as dye or `obstacle` it as a wall.
- Bloom for `light` mode: draw the frame small and blurred back over itself with `lighter`.

Colour fields:

```js
const M = Mesh, { seg, lerp, env, ease } = M;
const S = M.create({ width: 1080, height: 1920 });                         // or 1920 × 1080, 1080 × 1080
function draw(c, t) {
  M.field(c, t, { loop, points: [{ c: '#hex', x, y, r, w }, …], base, warp, scale, focus, seed, twist, blob, sheen, rect, a });
  M.melt(c, t, imageOrCanvas, amount, { loop, warp, scale, zoom, blur, sat, rect });
  M.text(c, 'words', x, y, { font: M.HEI, size, weight, tracking, align, color, a, shadow });
  M.finish(c, t, { grain: .03, vignette: .2 });
}
window.__scene = M.scene(S, draw, { duration, loop, background, music: { notes, dynamics }, sounds, timeline });
```

- `field` options: `points` up to 12 colours at `x, y` (0..1 of the area, may sit outside it), `r` reach (share of the short side, .2 tight – .7 wide), `w` weight. `base` + `baseW` fills where no point reaches. `warp` 0 straight blends · .5 soft · 1 liquid · 1.6 marbled. `scale` size of the folds (smaller = bigger folds). `focus` 1 misty · 2 clear regions · 4 almost flat shapes. `twist` turns the whole field back and forth. `seed` another arrangement.
- `blob: { th, soft, warp }` paints only where the points gather — a shape on an empty page that breathes and merges. `soft` .01 crisp edge – .3 misty; `warp` how much the flow bends its edge (the colours inside still flow).
- `sheen` 0..1 adds light and shade in folds that follow the flow (silk); `sheenAng` their direction, `sheenFreq` how many.
- `melt(c, t, src, amount)` — a picture covers the area at 0 and becomes its own flowing colours at 1; feed it a layer (`M.layer('name', W, H)`) to melt a whole composed frame, the previous scene, or a video element.
- `palette(img)` → `[{ c, share, L, C, h }]`, biggest first. `image('x.jpg')` loads before the first frame; `cover(ctx, img, { z, fx, fy })` draws it like object-fit: cover.
- `within(ctx, shapeFn, fillFn)` paints a field only inside text or a path.
- Time: `wander(t, { loop, x, y, amount, seed })` a point that returns every loop; `breath(t, { inhale, hold, exhale, rest })` 0..1; `key(t, [[t, value], …])` for numbers, colours, lists of colours; `env(t, t0, t1, fin, fout)`; `phase(t, loop)`; eases `sine io out expo linger`.
- Colour: `mix(a, b, u)`, `oklch(L, C, h)`, `lch(c)`, `tone(c, …)`, `rgba(c, a)`. Fonts: `SANS SERIF HEI SONG KAI`.

## Sound

Light, on sampled instruments, written as notes `{ t, m, d, inst, v }` (+ `dynamics`). Match the weight to the piece: one or two instruments.
- A guide or a calm loop: `slowstrings` or `pad` held under the whole cycle, swelling with the breath (`dynamics`), and a `harp` / `celesta` / `piano` note where each phase begins.
- A song loop: write the hook as the song would play it — `guitar` or `keys` arpeggios, `bass`, a quiet `shaker` — a whole number of bars that equals the loop length.
- Colour over time: piano and soft strings whose harmony follows the change (dark and low at night, the piano coming in at sunrise).
- Brand or title cards: `keys` and `bass` at 90–110 bpm, a chord on each card; a soft `celesta` note as a card lands is plenty.
- Melody in the middle register (MIDI 55–76). No risers, booms or impacts; nothing that flashes or pumps the picture with the beat.
- With `loop: true` the tail of the last notes is folded into the start, so write notes right up to the end and let them ring.

## Examples

Four pieces that differ in who they are for, what the fluid is, how it is driven, format and strength. Read them for how the ideas are carried out, then make your own piece — not a variation of the nearest example.

- `examples/halden-ident-en.html` — the opening ident for Halden Film, a documentary company in Copenhagen (landscape, 8 s, English): clouds of dark ink drift up through clear water and gather into the HALDEN wordmark, slow down and lock into crisp letters; FILM settles underneath and the letters begin to bleed again. The simulation starts from the wordmark and lets it sink and dissolve; the video plays that backwards, then forwards very slowly for the hold. Low cello as the ink rises, a piano chord as the word locks.
- `examples/marbling-class-zh.html` — 安福路手作工作室的湿拓画体验课预告 (vertical, 17 s, Chinese): a basin seen from above; paint lands drop by drop and spreads, pushing the earlier drops into rings; a row of styluses draws a zig-zag, a fine comb pulls it into feathers; the water stops and the class details fade in on the dark water. Colours from Chinese mineral pigments. Piano notes as paint falls, slow strings under the strokes.
- `examples/lantern-single-en.html` — a Reels teaser for *Lantern*, an ambient-pop single from a Los Angeles artist (vertical, 14 s, English): amber, rose and cold blue light rise through dark water from three points, curl into eddies and add up where they meet, thin to wisps and die away; one small warm light rises alone under the title. `light` mode with a bloom; electric-piano arpeggios following the light.
- `examples/oat-latte-zh.html` — 成都精品咖啡店的桂花燕麦拿铁，吧台电视循环 (landscape, 12.5 s, Chinese): the side of a glass of cold brew, never drawn; oat milk pours in from above, plunges and rolls into clouds that sink to the bottom, streaked with osmanthus-caramel syrup; the name and price sit in the dark coffee above. `paint` mode with gravity; the tank is wider than the frame so the walls stay off screen.

The earlier colour-field pieces (`shanghai-sky-zh`, `low-tide-canvas-en`, `sleep-breath-zh`, `lineup-en`) are still in `examples/` for `Mesh.field`, `melt`, `blob` and `sheen`.

## Check your output

- **the fluid looks blurred or like a soft gradient** — full-resolution dye (`dye: 1`), a finer grid, more curl; less blur on top.
- **colour blobs drifting with nothing happening** — give it an event: a pour, a drop, a stroke, a push, something rising or sinking.
- **the motion never settles under the words** — raise `viscosity` and/or `fade` over time.
- **the gathered shape is mush when it should be crisp** — play the simulation backwards from the finished shape; end the reverse at sim time 0.

- **the picture is a static gradient with one moving thing** — let the colour itself flow and change.
- **colour regions sliding around in circles** — slow the drift, let the folding (`warp`) move the edges.
- **grey or muddy blends** — mix in OKLab (`field`, `mix`, `key` already do); add a point for the colour you want between two.
- **bands or steps in smooth areas** — call `finish` last; keep the grain on; don't run the canvas through JPEG.
- **a jump when the loop restarts** — everything that moves must be periodic in the loop length; check the seam line `render.py` prints.
- **type hard to read over a bright patch** — move it, change its colour with the field, or give it a soft shadow from the field's own dark colour.
- **a recognisable object drawn badly in code** — use a real photo, a plain field, or leave it out.
- **everything pumping with the beat** — colour changes follow the content, slowly.
