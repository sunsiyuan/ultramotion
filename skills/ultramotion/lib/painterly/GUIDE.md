# Painterly

Painterly (名画笔触) motion style — a moving oil painting made of brush strokes: Van Gogh / Loving Vincent's thick flowing strokes, or Monet's broken dabs of light. Every stroke has body, bristle lines, a lit ridge and a shadowed edge; strokes follow the form (around a swirling sky, along hills, across water, up a wall), parts of the painting flow, the rest gently \"boils\" the way a hand-painted film does, and the camera moves through the painting.

`brush.js` paints with oil strokes on a Canvas 2D page; `render.py` renders the page to mp4 with the music from `sound.py`. Open any page in `templates/` in a browser and it plays.

## Workflow

1. Copy `lib/painterly/brush.js` into your project; work on the copies.
2. Decide the painting: which painter or painting, which scene, what moves (*What to paint*).
3. **If it is a real painting, paint from the original** (*Painting from the original*): download a public-domain image of it and let every stroke take its colour and direction from it. Only invent the picture yourself when there is no original (a new scene in a painter's manner).
4. Write `paint(x, y, t)` — the colour and the stroke direction at every point (*The paint function*). Add what moves, the camera, and anything drawn on top.
5. **Compare with the original, change what differs, look again.** `python3 $SKILL/render.py page.html --preview --at 1,9,17 --ref ref/painting.jpg` puts the original beside each frame. Ask of every part: are the colours as rich, do the strokes run the way the painter's do, is the drawing still there (a church, a face, a signature, lit windows)? Then open one frame full size and compare one part up close — that is where muddy colour and broken drawing show. Change, render again, until it reads as the painting.
6. `python3 $SKILL/render.py page.html --out video.mp4`.

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

**Each painter's touch.** `strokes.touch: 'flat'` (default) is a loaded flat brush laying long ribbons along the form — Van Gogh. `'dab'` is short broken touches of colour side by side that barely follow the form — Monet and the Impressionists; with it, what moves is the light more than the strokes (a reflection drifting across the water, the hour warming), and the water shivers in thin horizontal touches. `'line'` is long thin flat lines traced along the form with the ground showing between them — Munch's tempera and crayon, anything made of flowing bands.

**What must survive.** Two things are lost when a painting is turned into strokes, and both have a way back:
- Bright small touches (flowers on the water, lit windows, glints, stars) average away into the colour around them. Return `pop: p.pop` from `paint` and they are painted again on top, small.
- Detail that is drawing rather than brushwork — a village of small roofs and a church, a face, lettering — breaks into confetti. Pass `keep: { image: R.image, mask: (x, y) => 0..1 }` and the original itself is laid there, with only a few strokes over it.

## Sfumato: paintings without visible strokes

Leonardo, Raphael, Vermeer, Bellini, most portraits before 1850: no brushwork to follow, edges melting like smoke: use `sfumato.js`, not `brush.js` — every mark a soft stroke with no edge, its colour taken from the picture at its own scale, big soft strokes first, then smaller, then the finest.

```js
const P = Sfumato.create({ width: 1600, height: 2384, view: [1080, 1920], after: (ctx, t) => { /* captions */ },
  layers: [{ img, levels: [[48, .5, 0, 5], [24, .42, 0, 5], [12, .42, 0, 4], [6, .45, 3, 4], [3, .5, 4, 3], [1.6, .55, 5, 3]],
             where: maskArray,                                            // optional: only lay strokes here (0..1 per pixel)
             build: (L, x, y, sigma, rnd) => ({ birth, drag, death }) }] });
window.__scene = Sfumato.scene(t => P.draw(t, { x, y, zoom }, { panel: [176, 178, 162], mist }), { duration, music });
```

`levels`: `[size, opacity, detail gate, length]` per pass — gate 0 lays everywhere, higher lays only where that scale adds detail (faces, hands, lace). `build` decides when each stroke is laid (`birth`), how long it takes to drag along (`drag`), and when it is lifted again (`death`, optional). `panel` is the bare ground the painting is laid on.

**What it can do:**
- **Painted out of a bare panel, stroke by stroke** — lay it the way a hand works: from the face outward (`birth` grows with the distance from the face), each place getting its big strokes, then smaller, then the finest, so there is always a line between finished painting, strokes landing and bare panel. Keep the camera back far enough to see the whole panel being laid.
- **The world behind changes, the figure never moves** — one layer per background, each laid over the last from one side (`birth` grows with x), the old one lifted a moment after the new one covers it; the figure is a layer on top that never dies. The backgrounds come from an image model (below).
- **Lifted and laid again** — `death` on every layer, finest strokes first, then a second set of layers laid faster.
- **Mist** — `setMist([{ x, y, sx, sy, a, c, vx, vy, phase, period }])` with `setMask(canvas)` (white = where it may drift): long pale veils over lakes and valleys, moving slowly one way.

**New backgrounds behind the same figure.** The result: the figure stays exactly the same through every station, with no trace of the old background around her edge; each background reads at a glance as that real place or moment, is painted in the painter's manner and lit like the figure. One way there: the image model you can call, given the original and a real picture of that moment, asked for the painting again with the figure as it is and the background replaced. Then line them up and find the figure:

```
python3 $SKILL/lib/painterly/stations.py original.jpg station-a.png station-b.png … --out media
```

It writes each station warped onto the original, and `matte.png` — the figure, found as what no station changed (three or more stations give a clean one). Look at `check.jpg`. Lay the backgrounds with `where:` = the inverse of the matte (reaching a little under the figure's edge), and the figure from the original with `where:` = the matte.

## What to paint

Stay close to the original painting: its composition, its palette, its subject. Pick the painting from the occasion and the audience; change what moves and where the camera goes.

| painter / painting | what makes it |
|---|---|
| Van Gogh — The Starry Night, Wheatfield with Crows, Café Terrace at Night, Sunflowers, Irises, The Bedroom | swirling direction fields, complementary blue and yellow, Prussian-blue contours, stars and lamps in rings |
| Monet — water lilies, Japanese bridge, Impression, Sunrise | short broken horizontal strokes on water, no contours, light pastel palette, reflections that wobble |
| Seurat / pointillism | `strokes: { size: .4, impasto: .3 }` and `len` near .4 — dots, not strokes; pure colours side by side |
| Munch — The Scream | long thin lines (`touch: 'line'`) that warp the whole picture, blood-orange sky |

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

- `starry-night-original.html` — The Starry Night, **landscape, painted from the original** (`ref/starry-night.jpg`): long strokes running with the swirls, the original's colours kept rich, the two great swirls turning a few degrees and back, the cypress swaying from its tip; the village kept from the original (`keep`) with its lit windows (`pop`); the camera comes down from the sky to the village. Made by comparing frames with the original until it read as Van Gogh.
- `water-lilies.html` — Monet's Water Lilies (1906), painted from the original in **dabs** (`touch: 'dab'`), kept to the painting's own quiet blues and greens: the light moves — the sky's reflection drifting down the pond, the water shivering; one small life — a dragonfly crosses, hovers, touches the water once and a ring spreads; the pink and yellow flowers kept with `pop`.
- `starry-night.html` — The Starry Night, invented in code (no original used — the way to paint a new scene in Van Gogh's manner): wind streams with two big spirals inside, the moon and stars in turning rings, a cypress flaming upwards; the camera drifts down from the sky to the village and leans in towards the lit windows.
- `wheatfield-crows.html` — Wheatfield with Crows: a storm sky churning, wind running through the wheat in waves, three paths, crows lifting off and flying into the distance.
- `cafe-terrace.html` — Café Terrace at Night: everything in one-point perspective, a yellow awning and lit terrace with people at the tables, short strokes on the cobbles, flower-like stars, a couple strolling down the street, lit from the café on one side and the night on the other.

- `templates/leonardo/lady-with-an-ermine.html` — **sfumato**: Leonardo's Lady with an Ermine laid out of a bare panel from her face outward, the ermine laid last; then the camera leans in to the two faces.
- `effects/painted-out-of-haze.html` — **sfumato**: the Mona Lisa laid stroke by stroke out of a bare panel from her face outward, then haze drifting over the far lakes.
- `effects/history-behind-her.html` — **sfumato, the world behind changing**: the Mona Lisa holds still while the background behind her is laid again from left to right — the new Louvre of 1797, the empty wall of 1911, today's crowd of phones — each made with an image model and lined up with `stations.py`.

## Sound

Music is written as notes on the page — `{ t, m (MIDI), d (seconds), inst, v }` — and played on sampled instruments (the list is at the top of `sound.py`); `dynamics: { inst: [[t, level], …] }` shapes how loud an instrument plays over time.
Choose the music from the painting and its place:
- a night sky: piano rolling arpeggios the whole time, strings swelling in as the camera comes down, a cello singing the line, a celesta when the stars flare;
- sunflowers: harp arpeggios, a clarinet and then a flute singing, plucked strings walking, bright and warm;
- the wheatfield before the storm: cellos repeating a low note, violins holding a high rubbing note above, an oboe, a timpani roll building;
- a café terrace: a waltz — accordion melody, guitar on beats two and three, plucked bass on one, a violin answering.
Sounds: `whoosh swish riser` (with `dur`), `shimmer sparkle chime ding boom pop tada thud`.

## Check your output

Look at the contact sheet and at one frame full size. If you see:

- **strokes that look like rice grains, embroidery or mosaic** — strokes too small or too even; keep the default size, and give regions their own direction rule.
- **plasticine worms** — too much relief; lower `impasto`.
- **people or props that look pasted on** (flat fills, clean computer lines) — draw them with `P.figure` / `P.mass`, never with plain canvas shapes.
- **a texture laid over shapes** — the direction field ignores the form; give each region its own angle rule.
- **flicker** — `boil.share` or `amount` is too high, or something random is not seeded by the stroke's key.
- **everything looks the same muddy blue** — neighbouring regions need more contrast in value, not just hue; add contours.
- **details lost (windows, stars, faces)** — return `size` below .8 there; for small bright touches return `pop`; where the detail is drawing (a village, a face, lettering) lay the original with `keep`.
- **greyer than the original** — compare with `--ref`; the colour comes from the painting, so check what `paint` does to it.
- **a slideshow** — nothing flows and the camera doesn't move; add `flow` to the sky or water and a camera move.
