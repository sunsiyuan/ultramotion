---
name: ink-wash
description: Ink Wash (水墨晕染) motion style — Chinese ink painting that spreads and lives, in the manner of the Shanghai Animation Film Studio's ink films (山水情 Feelings from Mountain and Water, 小蝌蚪找妈妈). Ink creeps out across rice paper from where the brush touched, wet at its front; mountains rise in layers that pale into mist; brush strokes are written as time passes, with flying white; a boat drifts, geese cross, mist moves; one scene dissolves back into the paper and the next one spreads in; a vertical title and a red seal. Use for 水墨 / 国风 / ink wash / 山水 / 节气 / Chinese painting / sumi-e style videos, cultural and seasonal greetings, brand openings, rendered from code to mp4 with music.
---

# Ink Wash

`ink.js` paints ink on rice paper with WebGL; `render.py` renders the page to mp4 with the music from `sound.py`. Open any file in `examples/` in a browser and it plays.

## The picture is alive the whole time

Getting the ink onto the paper is the first few seconds. After that the painting must keep living until the last frame: rain or snow falling, mist bands drifting, water rippling, a boat or a figure crossing, geese passing, reeds swaying, petals or leaves drifting down, the camera moving slowly over the scroll. A painting that appears and then holds still is a slideshow.

## Workflow

1. Copy `ink.js`, `render.py`, `sound.py` (and `fonts/`) into your project; work on the copies.
2. Decide the scene from the content and the audience: what is painted, what lives in it, one quiet scene or two or three joined by ink dissolving (*Composition*).
3. **Get the painting.**
   - **If you can generate images** (an image tool, codex `image_gen`, an image API or MCP): generate the ink painting itself — vertical, in the composition you chose, leaving empty paper where things will move (the sky for geese, open water for a boat), and with no text, seal, boats, people or birds in it (those you animate). Lay it down with `I.paint(img, …)`: it spreads in as ink, darkest strokes first.
   - **Otherwise** build it from ink layers: `mountain`, `wash`, `stroke(s)`, `dots`.
   - Both mix: a generated painting as the base, a branch written on top with `stroke`, a cinnabar flower with `wash`.
4. Add what lives in it (`live`, `mist`, the camera), the title and seal, the music.
5. `python3 render.py page.html --preview --at 1,5,9,14` and look at the contact sheet; open one frame full size.
6. `python3 render.py page.html --out video.mp4`.

Needs ffmpeg and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`; uses Playwright's Chromium or the installed Google Chrome. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox.

## How it moves

- **A large emptiness, one small life.** Most of the picture is paper and mist; one small thing moves through it — a boat, a single figure, a line of geese, a falling leaf.
- **Ink arrives, it is never just there.** A painting spreads in from where the brush touched, the bones of dark ink first and the pale washes after; distant ranges surface out of the mist one after another; a branch is written stroke by stroke.
- **Scenes change through the ink.** One scene fades back into the paper (`fade`) while the next spreads in, often with the camera pushing closer — from a landscape to a branch, from a river to a single boat. No cuts.
- **Slow.** Shots of seven seconds and more; nothing snaps.

## Composition

Pick the composition from the subject; two videos should not share one.
- **高远 looking up** — a cliff or peak towering over a tiny figure or pavilion at its foot.
- **深远 looking deep** — valley behind valley, a path or stream winding back into the mist.
- **平远 looking across** — low far shores, a wide river or lake, almost all sky and water.
- **A close study** — one branch of plum, bamboo, a lotus leaf, a pine, a fish or a few shrimps in empty paper; no landscape at all.
- **Mountains differ:** rounded and soft (long hemp-fibre strokes), jagged and split (axe-cut strokes), flat-topped mesas, single needle peaks; a mountain is a few peaks of different heights, never a row of equal triangles.

## The season

The season is read from what is painted and from the one tone laid over the ink.
- **Spring** — willows just turning green, apricot or peach blossom in the one colour, swallows, fine rain and mist over water.
- **Summer** — lotus leaves in wet dark ink, heavy foliage, clouds lifting after a storm.
- **Autumn** — 浅绛: a pale ochre wash over the slopes and the tea terraces, leaves turning red on a few trees, reeds, geese flying south, a high empty sky, a moon.
- **Winter** — snow left as bare paper, dark water, a lone boat, plum blossom.
When you generate the painting, name the season's signs in the prompt and keep it to ink plus that season's one tone.

## How it looks

- **Five tones of ink, from paper to scorched black.** Far mountains pale, near rocks and branches dense; ink adds up as density, so overlaps darken naturally.
- **Crests dark, bodies fading down into mist.** A range's ridge gathers ink; its foot dissolves; texture strokes (皴) run down the slopes; moss dots sit on the crest.
- **Flying white.** Strokes run dry towards their end and break into streaks of paper.
- **Half the frame or more is empty paper.**
- **At most one colour,** used once, where it matters most: cinnabar plum blossoms, an ochre boat, a red leaf, the ochre of an autumn hillside (`color: 1`).
- **People are a few strokes of ink** — a robe as one pale wash with a dark back line, a dot of a head, a conical hat or an oil-paper umbrella, no arms and legs drawn; small, a few tens of pixels tall: `Ink.figure`.
- **Rain is fine, sparse and slow** — a few pale slanting strokes, rings where it meets the water: `Ink.rain`.
- **A vertical title in running script, a short line of verse beside it, a small red seal** — one to four characters in seal script (`fonts/`, carved for you): `style: 'white'` carves the characters out of a red block (白文), `'red'` gives red characters in a thin frame (朱文).

## The page

```js
const I = Ink.create({ width: 1080, height: 1920 });                             // taller than the view if the camera travels: view: [1080, 1920]
I.paint(img, { from: [x, y], at, speed, darkFirst: 1.5 });                      // a whole painting (generated or found) laid down as ink — Ink.withImages(['ref/p.jpg'], ([img]) => { … })
I.wash(ctx => { /* draw a shape in grey; white = most ink */ }, { from: [x, y], at, speed, ink, color: 1 });   // leaves, blossoms, rocks, a pool of ink
I.stroke([[x, y], …], { width, ink, dry, at, dur });                           // one brush stroke, written from at to at + dur — branches, stems, reeds, a frog's leg
I.strokes([[points, options], …]);                                               // many strokes as one layer
I.dots([[x, y], …], { size, ink, at });                                          // moss dots, eyes, stamens
I.mountain(Ink.ridge(baseY, [[x, height, width], …], { rough }), { x0, x1, ink, edge, fall, mistAt, at, speed, cun });   // a range, when the scene has one
I.live((ctx, t) => { /* draw what moves this frame in white (white = ink): creatures, a boat, rain, ripples */ });
  Ink.figure(ctx, 'walker' | 'umbrella' | 'picker' | 'boat', x, y, { size, t, hat: 'conical', facing: -1 });   // inside live: a person at the feet x, y (a boat at its waterline)
  Ink.rain(ctx, t, { count, speed, slant, alpha, water: [y0, y1] });                                    // inside live
I.mist([{ y, height, speed, amount }]);                                          // bands drifting across, thinning the ink under them
I.camera(t => ({ x, y, zoom }));
I.text('春水', { x, y, size, at }); I.seal('春', { x, y, size, at, style: 'red' });   // in frame pixels
window.__scene = Ink.scene(I, { duration: 18, music: { notes }, sounds });
```

Every layer takes `at` (when the ink starts to arrive), `speed` (how fast the wet front travels, px/s), `from` (where it starts), `fade: [t, seconds]` (dissolve back into the paper), `wet` (how dark the front is while it spreads), `color: 1` (the one colour instead of ink). `ink` and `edge` run from about .3 (a distant wash) to 2 (scorched black).
`Ink.create` options: `paper` (colour), `color` (absorption of the one colour; cinnabar by default, ochre `[.25, .6, 1.1]`), `res` (ink map resolution, 2 = half).

## Examples

Five pages that differ in subject, composition and technique. Read them for how the ideas are carried out, then paint your own subject — not a variation of the nearest example.

- `examples/shrimp.html` — 虾, after Qi Baishi: nothing on the paper but four shrimps; pale translucent bodies, a dark stomach seen through the shell, long dry whiskers; each one flicks, darts back and creeps forward again. No water drawn, yet they are in water. All in `live`.
- `examples/tadpoles.html` — 春水, in the manner of 小蝌蚪找妈妈: the whole sheet is water; a lotus leaf spreads in as wet pale ink, its stem written in one dry stroke; a school of tadpoles swims up towards it, scattering and gathering; a frog is written on the leaf when they arrive.
- `examples/plum.html` — 寒梅: two scenes joined by ink dissolving — a lone boatman on a snowy river among pale mountains; then the mountains fade back into the paper, an old plum branch is written stroke by stroke, the blossoms open one by one in cinnabar.
- `examples/jiangnan-rain.html` — 江南烟雨, **on a generated painting** (`ref/jiangnan.jpg`): it spreads in as ink, dark bones first; then fine rain slants down and rings the river (`Ink.rain`), mist drifts, a boatman in a conical hat poles across (`Ink.figure`).
- `examples/bailu.html` — 白露, built entirely from ink layers: a drop spreads into the nearest mountain, paler ranges surface behind it, reeds in scorched ink, geese cross, a boat drifts.

## Sound

Write music as notes on the page: `{ t, m (MIDI), d (seconds), inst, v }`. A pentatonic pluck (guqin / guzheng feel) over a long pad suits most scenes; a bell for blossoms opening or the seal. Sounds: `thud` for the seal and the first drop, `whoosh` (with `dur`) for a scene dissolving.

## Check your output

- **mountains like sine waves or triangles** — use a few peaks of different heights and widths with `rough`; let the far range be wider and gentler.
- **a range ends in a straight vertical edge** — start it beyond the frame or let it end inside: ends dissolve by themselves.
- **strokes that look segmented, like bamboo** — give the stroke more points along its path; `dry` makes long streaks, not breaks.
- **everything the same grey** — separate distant (`ink` ≈ .3–.5) from near (1.2–2).
- **nothing moves after the ink has spread** — add something to `live`, a `mist` band and a camera move.
- **a busy frame** — remove things until half the frame is paper.
