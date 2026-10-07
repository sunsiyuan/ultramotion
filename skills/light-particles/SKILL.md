---
name: light-particles
description: Light Particles (光粒子) motion style — hundreds of thousands to over a million particles that gather into things (titles, logos, products, vehicles, buildings, whole towns), fly between them on swirling paths, build up in order, light up at night, and glow with bloom; rendered with WebGL from code to mp4 with sound. Use when asked for a particle / 粒子 / light-particle / glowing-dots video — a logo or title reveal, product or vehicle reveal, festival greeting, a city or place as a lit model, a launch teaser — or anything that should assemble out of points of light.
---

# Light Particles

Everything you see comes from `particles.js` (WebGL2, no other dependency); `render.py` turns the page into an mp4 with sound from `sound.py`. Open any file in `examples/` in a browser and it plays.

## Workflow

1. Copy `particles.js`, `render.py`, `sound.py` and the example closest to your idea into your project; work on the copies.
2. Decide what the particles become and what the video is for (*What to build*), then the look (*The look*).
3. Write the page: shapes, then the keys that move the particles between them, then the camera, then the music.
4. `python3 render.py page.html --preview --at 2,6,10,14` and look at the contact sheet; fix, repeat.
5. `python3 render.py page.html --out video.mp4` renders frames, sound and music into one file.

## How it moves

These are the style; use them when you write new motion.

- **Gather.** Particles start as a loose field of dust or stars and fly into the first shape. `P.to(t, shape, { dur, swirl, stagger })`: `swirl` is how far the paths bow out, `stagger` how spread out the arrivals are.
- **Build in order.** A shape can say when each particle arrives (`o`, 0–1): towns rise from the centre out, a vehicle builds front to back like a scan, a lantern from the top. Built-in generators already carry an order.
- **Transform.** The same model in two states as two keys — parked then lifted, wings folded then open, doors shut then open — and the particles move between them.
- **Light up.** The same model twice, `lit: 0` then `lit: 1`, as two keys: windows, lanterns, light bars and signs come on in the same order the model was built.
- **Take over.** For a title or a marker over a model, `takeover(base, overlay, { share })` keeps most particles where they are and sends a share of them to form the overlay.
- **A camera that never stops.** `P.camera(t, { rotX, rotY, dist, target, roll, dur })` — each key is where the camera arrives at `t + dur`; with `glide: true` it passes through the keys on one smooth curve instead of stopping at each. Patterns:
  - *fly in* — start far outside the dust with the horizon tilted (`roll` .15–.2), push through it as the particles gather;
  - *drop low and circle* — a low angle (`rotX` near 0) walking around the object while it builds;
  - *close pass* — sweep past a detail at a short `dist` with the `target` moving along the object, as its lights come on;
  - *fly along* — follow a path through a place (a canal, a street) at mid height, the `target` moving with it;
  - *settle* — end on a steady three-quarter view for the title; *fly out* — push into the particles as they scatter.
  Particles close to the lens thin out instead of popping, so the camera can pass through dust or the model. `float` adds a slight handheld breathing. Builds take 6–9 s; hold the finished thing before the next change.
- **Turn.** `spin` on a key turns that shape about its vertical axis (radians per second). The next key carries on from the angle reached only if it also sets `spin` (0 to stop); leave `spin` out and the shape shows as authored.

## What to build

Ask what the particles should *become* for this content: the product itself, the place, the object of the occasion, the name. When the content has a product or an object (earbuds, a cup, a car, a building), the particles become that object as a solid model at real proportions — pick one real measurement (a wheel, a storey, a person) as the unit and size everything from it — and the camera moves around it while it builds.

| | |
|---|---|
| things made of light — titles, logos, numbers, lanterns, stars | the default glow: particles add up into light |
| a sign, an icon or a title as glowing tubes | `neon: 1` on `text` / `drawn`: particles crowd onto the outline; colour it along its length with `gradient()` |
| physical things — products, vehicles, buildings, towns, animals, mascots | `solid: true`: each particle is an opaque dot and nearer dots hide farther ones, like a point-cloud scan; put titles over them with `sparkle()` |
| a picture you already have — a map, an illustration, a logo with colours | `photo(src)`: particles land where the picture is bright and take its colours |

## Titles

Titles are read, so they stay crisp: `text(…, { dot })` with `dot` 1.8–2.6; a title over a model is `takeover(model, sparkle(colorize(text, 2.1)), { share })` with `share` about .015 for one line (more particles blur it into a glowing blob); main lines 120–230 px, smaller lines at least 44 px. Leave a title on screen for 3 s or more.

## Brightness

Glowing particles add up: with tens of thousands, `gain` .4–.5 is right; with hundreds of thousands, .25–.35, and fewer particles on the brightest part. White areas mean too bright. Solid scenes are lit, not added, so `gain` only affects their glowing parts.

## The look

The motion is the style; the look is chosen for each video — background, palette, how much glow, how dense, the type, the music. Pick it from the occasion and the audience: a New Year greeting in red and gold, a perfume in pearl and ice blue, a hover bike in deep space in olive military paint with a burning exhaust, a water town at night in white walls, dark tiles and red lanterns. `colors: [a, b, glow, glow2]` on each key sets the palette; any part can also carry its own colour with `tint()`.

## Building shapes

A shape is `fn(N, seed)` that returns, for N particles, `p` (x, y, z, size — px, centred on the frame, y points **down**), optionally `a` (normal x, y, z and colour `m`) and `o` (arrival order). The same seed must give the same points.

| helper | |
|---|---|
| `text(str, { size, font, y, dot })` | text; `size` = cap height, `dot` = particle size (smaller = crisper edges) |
| `image(img)` · `svg(paths, { box, width })` · `drawn(draw)` | a logo, an SVG path, anything drawn on a 2D canvas |
| `photo(src, { width, plane, gamma, floor, sharpen, depth })` | a picture in its own colours; `plane: 'xz'` lays it flat |
| `field()` · `ring()` · `sphere()` · `galaxy()` | dust, a ring, a sphere shell, a spiral |
| `lathe(profile, { ribs, rings })` · `strands()` | a solid of revolution (bottles, lanterns, vases) · hanging lines (tassels) |
| `city({ lit })` · `waterTown({ lit, site })` · `hoverBike({ lit, hover })` | complete lit models used by the examples; read them as patterns for your own |
| `mix([a, 2], [b, 1])` · `place(shape, { rx, ry, x, y, z, scale })` · `flatten(shape, { y })` | combine, move and turn, press flat onto the ground (the start of anything that grows up) |
| `takeover(base, overlay, { share, layer })` · `colorize(shape, m)` · `tint(hex, glow)` · `sparkle(shape)` | overlay (stack several with a different `layer` each); colour slot; own colour (`glow` 1–3 = emits light); loose twinkling points of light |
| `gradient(shape, [hex, …], { dir, glow })` | colours running across a shape by position, e.g. cyan to magenta |

For your own solid models, the generators in `particles.js` show the pattern: a list of parts with their surface areas, each part a function that returns one point with its normal, colour when dark (`m`) and colour when lit (`ml`), and arrival order. Spread particles by area so surfaces have no thin patches; give every surface a normal so it shades.

Colour `m`: 0–1 mixes `colors[0]`→`colors[1]` and is lit by the light; 2–3 glows in `colors[2]`, 3–4 in `colors[3]`; `tint()` values carry their own colour.

## The page

```js
const F = Particles;
const P = F.create({ count: 1200000, solid: true, shine: .9, glide: true, float: 1, background: '#07080a' });
P.to(0, F.field(), { dur: 0 })
 .to(1, model, { dur: 8, swirl: 90, stagger: .8, colors: [...] })
 .to(11.5, modelLit, { dur: 1.2, stagger: .6 })
 .to(17, F.takeover(modelLit, F.sparkle(F.colorize(F.text('NAME', { size: 140, dot: 2.4 }), 2.1)), { share: .015 }), { dur: 3.5 });
P.camera(0, { rotX: .04, rotY: -1.7, dist: 4300, roll: .22, dur: 0 })               // fly in, tilted
 .camera(0, { rotX: .05, rotY: -.25, dist: 1450, dur: 8 })                          // drop low, circle while it builds
 .camera(8, { rotX: .09, rotY: .45, dist: 880, target: [-220, 150, 0], dur: 3.5 })  // close pass as the lights come on
 .camera(15.5, { rotX: .12, rotY: -.55, dist: 1550, dur: 5 });                        // settle for the title
window.__scene = F.scene(P, { duration: 24, music: { notes }, sounds: [{ t: 11.5, kind: 'boom' }] });
```

`create` options: `count` (40k for a title, 200k–1.6M for solid models), `solid`, `shine` (gloss on solid surfaces), `glide`, `float` (0–1), `sweeps` (`[{ t, dur }]`, a band of light passing across the frame), `background`, `bloom`, `exposure`, `gain` (brightness of glowing particles), `ambient` and `light` (shading), `dof` (depth of field), `drift`, `twinkle`.

`window.__scene` is `{ duration, ready, seek(t), sounds, music, timeline }`; every frame is a pure function of `t`. Add `?rec=1` when capturing by hand — `render.py` does this for you.

## Sound

`render.py` mixes the sound for you: a whoosh as each shape flies in and a shimmer as it lands, plus `sounds` you list (`whoosh swish riser` with `dur`; `shimmer sparkle chime ding boom pop tada thud`), plus the music. Write music as notes on the page: `{ t, m (MIDI), d (seconds), inst, v }` with `kalimba bell marimba piano pluck pad bass organ whistle` and drums `kick snare hat clap shaker`. Choose it from the occasion: a pentatonic pluck for a Chinese water town, slow jazz piano for an auction, a synth pulse for a vehicle launch.

## Examples

- `new-year-zh.html` — 中文, New Year greeting: stars gather into a turning red lantern, burst into 2027, then 新年快乐. Glow.
- `aurora-launch-en.html` — English, perfume launch: a ring of ice-blue light becomes a pearl bottle, then the name. Glow.
- `city-night-zh.html` — 中文, a new riverside district as a lit model: towers rise from the ground, the lights come on, the name. Glow.
- `water-town-zh.html` — 中文, 云水里, a real-estate film for a waterfront commercial quarter: a gold line traces the plot on a top-down plan, the water-town quarter rises inside it (canals, bridges, shops, a cloud canopy over the canal, an art centre, a hotel), the camera flies along the canal as night falls, labels rise over the highlights, then the name and opening date. Solid, line, labels and title in sparkle.
- `hover-bike-en.html` — English, an outdoor sci-fi screening: the camera flies through stars as a hover bike builds front to back over a pad, the engine fires and it lifts, the camera sweeps round to the glowing exhaust, the name. Solid, stars and title in sparkle.

## Check your output

Look at the contact sheet, and at a full-size crop of anything that matters. If you see:

- **a building or product that looks like a glass box, or the back showing through the front** — use `solid: true`.
- **dark or bright specks on solid surfaces close up** — raise `count` or the model's `size`; spread particles by area.
- **a grey wall at the start of a solid scene** — the opening dust is solid too; make it `sparkle(field(...))` spread wider.
- **big blurry blobs when the camera is close** — pull `dist` back or raise the camera; close passes work over shapes, not at ground level in a dense model.
- **a title that is a fuzzy blob** — see *Titles*: lower its `share` or `dot`.
- **text that reads mirrored** — an earlier key spun; leave `spin` out of the text key.
- **everything white and blown out** — see *Brightness*.
- **an object that looks like a toy or a lump** — check its proportions against the real thing and add the parts that make it recognisable (for a vehicle: wheel size, seat and bar height, lights).
- **`photo` can't read the image** — the page was opened from `file://`; render with `render.py` or use a data: URL.
- **nothing at all, or a black frame** — the browser has no WebGL2; render with `render.py`, which starts Chromium with the GPU on.
