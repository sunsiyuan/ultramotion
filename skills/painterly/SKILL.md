---
name: painterly
description: Painterly (名画笔触) motion style — a moving oil painting made of thick brush strokes, Van Gogh / Loving Vincent style. Every stroke has body, bristle lines, a lit ridge and a shadowed edge; strokes follow the form (around a swirling sky, along hills, across water, up a wall), parts of the painting flow, the rest gently "boils" the way a hand-painted film does, and the camera moves through the painting. Use when asked for a Van Gogh / Starry Night / oil painting / 油画 / 梵高 / 星月夜 / 名画动起来 / painterly / brush-stroke animation, a painting that comes alive, or an art-history or museum piece, rendered from code to mp4 with music.
---

# Painterly

`brush.js` paints with oil strokes on a Canvas 2D page; `render.py` renders the page to mp4 with the music from `sound.py`. Open any file in `examples/` in a browser and it plays.

## Workflow

1. Copy `brush.js`, `render.py`, `sound.py` and the example closest to your idea into your project; work on the copies.
2. Decide the painting: which painter or painting, which scene, what moves (*What to paint*).
3. **If it is a real painting, paint from the original** (*Painting from the original*): download a public-domain image of it and let every stroke take its colour and direction from it. Only invent the picture yourself when there is no original (a new scene in a painter's manner).
4. Write `paint(x, y, t)` — the colour and the stroke direction at every point (*The paint function*). Add what moves, the camera, and anything drawn on top.
5. `python3 render.py page.html --preview --at 1,6,12` and look at the contact sheet; open one frame full size and look at the strokes up close.
6. `python3 render.py page.html --out video.mp4`.

Needs ffmpeg and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`; uses Playwright's Chromium or the installed Google Chrome. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox.

## Stillness with one thing moving

Before writing any motion, ask: *this moment in the painting — what happens in the next second?*

- **A large stillness, one small life.** Most of the painting only breathes; one small thing really moves — a petal letting go, a dragonfly touching the water, a crow lifting off, a candle flame, a curtain stirring.
- **The movement comes from the painting's own meaning.** Sunflowers that are wilting drop a petal; a summer pond gets a dragonfly; a wheatfield under a storm sends its crows up; a bedroom has a shutter tapping in the wind. Not an effect added on top — the moment continuing.
- **What moves carries time.** Something falling, arriving, leaving, growing, fading.
- **One or two, slowly.**

## How it moves

These are the style.

- **The painting breathes, never flickers.** Every stroke is repainted now and then, but only a share of them at a time (`boil`: `rate` repaints a second, `share` of the strokes each time), so the surface shimmers like a hand-painted film. Defaults: 12 a second, a sixth of the strokes.
- **Strokes follow the form.** Around a swirl, along a hill, across water, up a wall, along the curve of a boat or a cypress flame. The direction field is what makes it read as Van Gogh; a field that ignores the form reads as a texture laid on top.
- **What should flow, flows.** `flow` slides strokes along their own direction — sky, water, smoke, wind through wheat, a cypress licking upwards. Stars and lamps get rings that keep turning.
- **The camera moves through the painting.** Make the painting larger than the screen and drift, push in, or walk down a street. Slow — a full move takes most of the video.
- **Something lives in it.** A flock of crows lifting off, a couple strolling away, a boat drifting — painted with the same brush (see *People and props*).

## Painting from the original

Famous paintings are in the public domain; Wikimedia Commons has good scans — `https://commons.wikimedia.org/w/index.php?title=Special:FilePath/<file name>&width=1200` downloads one (send a User-Agent). Save it next to the page, resized to about 1000 px.

```js
window.__scene = Painterly.fromImage('ref/sunflowers.jpg', img => {
  const R = Painterly.reference(img, { width: 1296, height: 2304 });          // fitted into the painting area ('cover' or 'contain')
  const paint = (x, y, t) => { const p = R.at(x - sway(x, y, t), y); return { c: p.c, a: p.a, size: p.size, flow: p.coherence > .35 ? 7 : 0 }; };
  const P = Painterly.create({ width: 1296, height: 2304, view: [1080, 1920], paint, lines: R.lines, camera: … });
  return Painterly.scene(P, { duration: 18, music: { notes } });
});
```

`R.at(x, y)` gives the painting's colour, the direction its brushwork runs (from the grain of the picture), how clear that direction is (`coherence`), and a smaller stroke `size` where there is detail. `R.lines` are the painter's own dark drawing lines; pass them as `lines` and they are redrawn thin on top (`linesOffset(x, y, t)` moves them with the motion).

**Make it move — a still painting with strokes is not enough.** Sample the painting at a moving point to animate it: flowers stirring (`x - sway`), water rippling, a sky turning around its centre, wheat in waves. Add `flow` where the brushwork has a clear direction, something that lives in it (a petal falling, a crow, a boat), and a camera move. The original stays recognisable because the colours and directions still come from it.

Very finely broken paintings (Monet, Seurat) turn to texture at full view: push the camera in, or lower `strokes.size`.

## What to paint

Stay close to the original painting: its composition, its palette, its subject. Pick the painting from the occasion and the audience; change what moves and where the camera goes.

| painter / painting | what makes it |
|---|---|
| Van Gogh — The Starry Night, Wheatfield with Crows, Café Terrace at Night, Sunflowers, Irises, The Bedroom | swirling direction fields, complementary blue and yellow, Prussian-blue contours, stars and lamps in rings |
| Monet — water lilies, Japanese bridge, Impression, Sunrise | short broken horizontal strokes on water, no contours, light pastel palette, reflections that wobble |
| Seurat / pointillism | `strokes: { size: .4, impasto: .3 }` and `len` near .4 — dots, not strokes; pure colours side by side |
| Munch — The Scream | long wavy strokes that warp the whole picture, blood-orange sky |
| Hokusai — The Great Wave | not oil: lower `impasto`, flat Prussian blue, white foam strokes curling at the tips |

## The paint function

```js
const P = Painterly.create({
  width: 1080, height: 2400,          // the painting; larger than the view lets the camera travel
  view: [1080, 1920],                 // the video frame
  paint: (x, y, t) => ({ c: [r, g, b], a: angle, flow: 0, size: 1, len: 1 }),
  camera: t => ({ x, y, zoom }),      // the point at the centre of the frame, in painting pixels
  contours: t => [{ pts: [[x, y], …], color: [22, 36, 82], width: 5 }],   // Prussian-blue outlines around the main forms
  after: (ctx, t) => { P.stroke(x, y, angle, length, width, [r, g, b], key) },  // things drawn on top with the same brush
  boil: { rate: 12, share: 1 / 6, amount: 1 },
  strokes: { size: 1, density: 1, impasto: 1, bristles: 3 },
  background: '#0e1222',
});
window.__scene = Painterly.scene(P, { duration: 18, music: { notes }, sounds: [{ t: 9, dur: 3, kind: 'whoosh' }] });
```

`paint` returns, for any point: `c` the colour, `a` the stroke angle, `flow` how fast strokes slide along `a` (px/s, 0 = still), `size` the stroke scale (below .8 adds a second, finer layer of strokes — use it for windows, faces, signs, stars), `len` a length multiplier. Give each region its own direction rule.

Helpers on `Painterly`: `swirl(x, y, vortices, base)` → `{ a, band }` for a turning sky; `glow(x, y, cx, cy, r, reach)` → rings around a star or lamp; `inPoly(x, y, pts)`; `vn` / `fbm` noise; `hex`, `mix`, `seg`, `ease`.

Each stroke is a flat-brush ribbon: square and thick where it starts, bristle tracks side by side, a second colour picked up along one side, a ragged dry-brush tail, each brushload slightly warmer or cooler (`strokes.temperature`). The paint is laid on two layers — colour and thickness — and a lighting pass turns the thickness into impasto: ridges, a soft key light from `light: [dx, dy]`, a glint on the thickest paint. An underpainting shows faintly between strokes. `impasto: 0` gives flat strokes.

## People and props

Draw them with the same brush, in `after`, so they look painted rather than pasted on:

- `P.figure(x, y, height, { coat, skin, hat, dress, rim, rimSide, step, k })` — a person in the Loving Vincent manner: a silhouette filled with strokes running down the coat or dress, a coloured rim on the side the light comes from (`rim` = the light's colour), a brushed Prussian-blue outline; `step` animates the walk. Seated people: draw the figure, then the table in front of it.
- `P.mass(points, colour(x, y), angle(x, y), { size, width, k })` — any prop (a table, a chair, a boat, a lamp post): a polygon filled with strokes along its form and outlined with a broken brush line. `P.ellipsePts(x, y, rx, ry)` for round things.
- `P.stroke(x, y, angle, halfLength, width, colour, key)` — a single stroke (a crow's wing, a ripple).

## Examples

- `sunflowers.html` — Sunflowers, **painted from the original** (`ref/sunflowers.jpg`): colour and brush direction from the painting, the flowers stirring in a breeze, the painter's dark lines redrawn on top, a petal falling, the camera leaning in.

- `starry-night.html` — The Starry Night, invented in code (no original used — the way to paint a new scene in Van Gogh's manner): wind streams with two big spirals inside, the moon and stars in turning rings, a cypress flaming upwards; the camera drifts down from the sky to the village and leans in towards the lit windows.
- `wheatfield-crows.html` — Wheatfield with Crows: a storm sky churning, wind running through the wheat in waves, three paths, crows lifting off and flying into the distance.
- `cafe-terrace.html` — Café Terrace at Night: everything in one-point perspective, a yellow awning and lit terrace with people at the tables, short strokes on the cobbles, flower-like stars, a couple strolling down the street, lit from the café on one side and the night on the other.

## Sound

Write music as notes on the page: `{ t, m (MIDI), d (seconds), inst, v }` with `kalimba bell marimba piano pluck pad bass organ whistle` and drums `kick snare hat clap shaker`. Sounds: `whoosh swish riser` (with `dur`), `shimmer sparkle chime ding boom pop tada thud`. Choose the music from the painting: a slow minor pad and piano for a night sky, a low unsettled pad for the wheatfield, a waltz for the café.

## Check your output

Look at the contact sheet and at one frame full size. If you see:

- **strokes that look like rice grains, embroidery or mosaic** — strokes too small or too even; keep the default size, and give regions their own direction rule.
- **plasticine worms** — too much relief; lower `impasto`.
- **people or props that look pasted on** (flat fills, clean computer lines) — draw them with `P.figure` / `P.mass`, never with plain canvas shapes.
- **a texture laid over shapes** — the direction field ignores the form; give each region its own angle rule.
- **flicker** — `boil.share` or `amount` is too high, or something random is not seeded by the stroke's key.
- **everything looks the same muddy blue** — neighbouring regions need more contrast in value, not just hue; add contours.
- **details lost (windows, stars, faces)** — return `size` below .8 there.
- **a slideshow** — nothing flows and the camera doesn't move; add `flow` to the sky or water and a camera move.
