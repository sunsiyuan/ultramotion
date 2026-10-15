---
name: paper
description: "Paper Cutout (纸艺 / 剪纸) — makes a VIDEO (mp4 with sound) out of real-looking paper: cut-out pieces with grain, thickness and hand-cut or torn edges, layered at different heights so they throw true soft shadows on each other, folded paper that opens fold by fold, pop-up cards and books whose pieces stand up as they open, flat cut-paper titles that slide and slap into place, all under one light with a 3D camera. Use it when asked for a paper / 纸艺 / 剪纸 / 窗花 / 团花 / 立体书 / 立体贺卡 / pop-up book / pop-up card / papercraft / paper cut-out / cut-paper animation / layered paper / paper diorama / 折纸展开 / Saul Bass style title / Matisse cut-outs video — a festival greeting, a story or podcast opener, an invitation, a brand or product reveal, a title sequence, a map or a journey. In the manner of pop-up books, Chinese window-flower paper cutting and the 1958 Shanghai cut-paper films, Saul Bass and the Catch Me If You Can titles, Matisse's late cut-outs, and paper dioramas shot on a table."
---

# Paper Cutout

`paper.js` builds a scene out of sheets of paper on a table and renders it with WebGL2: each sheet is a shape you draw on a canvas, given a paper (grain, tone, fibres), an edge (clean, knife, cut, torn, deckle) and a place in 3D; a key light and a sky light cast real soft shadows (sharp where paper nearly touches, soft where it is far above), light passes through holes, pieces can be hinged, folded and stood up, and the camera moves in perspective. `render.py` renders the page to mp4 with the sound from `sound.py`. Open any file in `examples/` through a local server (`python3 -m http.server`) and it plays; `render.py` loads them directly.

## Workflow

1. Copy `paper.js`, `render.py`, `sound.py` into your project; work on the copies.
2. Work out who it is for and what it is used for (*What to make*), and pick the move that carries it (*How it moves*).
3. Put everything the user will want to swap — words, names, dates, colours, fonts, image paths — in a `CONTENT` object at the top of the page, and build the scene from it.
4. Build the sheets from back to front, give each a height, then write the timing with `S.at`.
5. `python3 render.py page.html --preview --at 1,3,5,8,12` and look at the contact sheet; open one or two frames full size (`--preview --at 8 --size 1920`) to check edges, shadows and text.
6. `python3 render.py page.html --out video.mp4`.

Needs ffmpeg, fluidsynth (only for music) and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`; uses Playwright's Chromium or the installed Google Chrome. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox.

## What to make

Read the content first: who sends or watches this, where it will be posted, how loud it should be. Then choose what the paper does. Some uses and the paper that suits them:

- **A festival greeting** (春节, 中秋, a wedding, a birthday): 剪纸 and 窗花 cut from one colour, folded paper that opens into a pattern, characters cut out of red squares, a strip with the family's name. Quiet table, warm light.
- **A story, podcast or channel opener**: a paper theatre — sky, hills, a building, rows of sea or forest — rising into place layer by layer, one light coming on, the title on cut letters. Calm, slow camera.
- **An invitation or announcement**: a pop-up card or book on a table opening, pieces standing up in front of the names, the camera coming down to look into it.
- **A title sequence or event trailer**: Saul Bass style — two or three flat colours, bold shapes pushed in from the edges, cut letters slapped down, a shape wiping across to change scene, stepped 12 fps motion.
- **A product or brand reveal**: the product's photo printed on card (`image`) standing up from a page or among layers; brand colours as the papers.
- **A map or a journey**: a folded map that opens panel by panel (`S.fold` with alternating `dir`), places standing up along the route, a cut-paper line laid down.
- **Explaining something**: Matisse-like shapes (`P.blob`, leaves, waves) sliding in and stacking, labels on paper strips.

Picture sources: everything drawn as flat shapes (the usual); the user's photo printed on a sheet and cut out (a product, a couple, a place — `image`); text as paper (`text`, `S.letters`) or printed on paper (`print`).

Draw only what cuts well: geometric and simple organic shapes (circles, arches, doors, houses, towers, hills, waves, leaves, clouds, stars, boats, symmetric patterns), letters, characters. People, animals, faces, hands, machines and detailed objects drawn by hand come out crude — leave them out, use a silhouette only if it can be a few clean shapes, or use the user's photo.

Composition: the whole frame is paper on a surface — fill the background with a sheet (a wall, a table, a sky) and give the subject room; keep text away from the platform's buttons in vertical video. Formats: 1080×1920 vertical or 1920×1080 landscape.

## How it moves

Paper moves like paper: it slides in over other paper, drops and settles, swings on a hinge, folds and unfolds, stands up. Pick the moves the content needs; mix them:

- **Slide in** — a sheet travels in from an edge or from below and stops on its place (`ease: 'oc'`, or `'back'` to overshoot a hair). The theatre-flat move: layers rising one after another.
- **Drop and settle** — a piece falls from height (`z` from a few hundred to its rest) with a small turn that straightens (`ease: 'land'`); its shadow comes in from far and soft to tight and sharp.
- **Flip up** — a piece hinged at an edge turns from edge-on to facing the camera (`rx` −90 → 0, anchor on the hinge); `S.letters` flips each letter about its own baseline.
- **Stand up** — a piece lying flat on a page rises to vertical as the page opens (pop-up), slightly late and with a small overshoot.
- **Fold / unfold** — `S.fold`: the paper starts folded, and opens fold by fold in reverse order. Leave the last few degrees un-flattened so the creases show.
- **Swing** — a door, a flap, a cover on a hinge (`ry`/`rx`), revealing what is behind.
- **Wipe** — a big sheet slides across the frame and becomes the next scene's background.
- **Camera** — choose by scene: still and straight down at a flat arrangement; a slow push in on a layered scene so the layers part; coming down from above onto a pop-up and levelling out to look into it; a dive into a shape that fills the frame and becomes the next scene. Depth of field (`focus`) when the camera looks across the table.
- **Light** — fixed, or slowly moving (a sun crossing a winter afternoon), so the shadows move.

Timing: one thing arrives at a time, each a beat after the last; things that belong together arrive in a quick run (letters, tiles). Hold the finished picture long enough to read it. Smooth motion suits greetings, stories and invitations; `stopMotion: { fps: 12, boil }` (pieces step and shiver a little each frame, the camera stays smooth) suits titles and cut-out animation. Nothing pulses or flashes to the beat.

## Building a scene

```js
const P = Paper;
window.__scene = P.scene(async () => {
  const S = P.stage({ width: 1080, height: 1920, background: '#2a2420', light: { from: 30, height: 34, soft: .09, ambient: .38 } });
  S.sheet({ w: 1500, h: 2500, x: 540, y: 960, color: '#efe3cc', paper: 'rice', edge: 'clean', cast: false });     // the surface
  const drop = S.at(1.0, .7, { ease: 'land', sound: 'land' });
  S.sheet({ w: 300, h: 300, x: 540, y: 900, z: t => 6 + 300 * (1 - drop(t)), rz: 45, color: '#c0171d', paper: 'rice', edge: 'knife',
    draw: (g, w, h) => { g.fillRect(0, 0, w, h); P.cut(g, g => { g.font = '400 200px "Weibei SC"'; g.textAlign = 'center'; g.fillText('福', w / 2, h * .72); }); } });
  return { stage: S, duration: 8, camera: t => ({ zoom: 1 + t * .005 }), sounds: S.sounds(), music: { notes: [...] } };
});
```

Space: x right, y down in stage pixels, z = height toward the camera. The default camera looks straight down at z = 0 and frames the stage exactly. Every number option can be a function of t.

**`P.stage({ width, height, background, light, camera, focus, stopMotion, shadowCenter, shadowBox, vignette })`**
- `light`: `from` (degrees round the picture the light comes from: 0 top, 90 right, 180 bottom, 270 left), `height` (degrees above the table; low = long shadows and strong grain), `soft` (penumbra per pixel of height, .05 crisp … .25 diffuse), `ambient` (.3 dark shadows … .55 light ones), `ao` (the soft sky shadow under everything, 0–1), `color`, `sky`. Return `light(t)` from the scene to move it.
- `shadowCenter`/`shadowBox`: centre and half-size of the area that receives shadows (defaults to the stage); widen them when the camera sees far.

**`S.sheet(o)`** — one piece of paper. Size `w, h`, or `text` + `font` (sized to the text).
- Place: `x, y, z`, `rx` (tip about its horizontal axis; positive lifts its top edge toward the camera), `ry` (positive lifts its left edge), `rz` (clockwise), `s / sx / sy`, `anchor: [ax, ay]` (the pivot, as fractions of w/h; default centre), `parent` (a sheet or group: then `x, y` are in the parent's own pixels and `z` is height above it), `show: t => bool`, `still` (no stop-motion shiver).
- Look: `color`; `paper`: `smooth card rough rice kraft cardboard print`, and the see-through ones `vellum` (硫酸纸 / tracing paper: even and frosted) and `tissue` (薄宣纸, 雁皮: cloudy, fibres show); `opacity` (0–1, any paper; what's behind shows through, blurred by how far behind it lies, denser at the cut edge and where sheets overlap) and `frost` (how much it blurs); `edge`: `clean` (machine-cut), `knife` (剪纸: crisp, keeps hairlines), `cut` (scissors: wanders a little), `torn` (ragged with a band of white fibres; `core` sets that colour), `deckle`; `thick` (px of the lit / shaded edge); `back` (colour of the back, or `{ color, draw }` printed on the back, drawn as seen from behind — add `flip: 'x'` if the sheet turns over its horizontal edge); `emit` (`color` or `{ color, strength }`: a lit window, a lamp, the moon); `translucent` (0–1, glows when lit from behind); `shade` (darken); `cast: false` (casts no shadow — the surface underneath).
- Shape: `draw(g, w, h)` paints the paper on a 2D canvas — what you fill is paper, `P.cut(g, fn)` removes it; `print(g, w, h)` prints ink or a picture on the paper without changing its shape; `image` (+ `focus: [fx, fy]`) prints a photo over the shape (`await P.image(src)`); `res` (texture pixels per stage pixel; raise it for pieces the camera gets very close to).

**`S.group(o)`** — an invisible node with the same placement options, to move or hinge several sheets together.

**`S.letters(str, { font, x, y, z, spacing, align, vertical, each: (i, ch, [hx, hy]) => ({…}), …sheet options })`** — one sheet per character, `(x, y)` on the baseline; each letter pivots on its own baseline. `each` returns per-letter options (timing, `rx`, `y`, `show`).

**`S.fold(o, folds)`** — a sheet with fold lines (same options as `S.sheet`). `folds`: `[{ line: [[x1, y1], [x2, y2]], move: [x, y], angle: t => degrees, dir }]` in the sheet's pixels: fold k's `line` and `move` (a point on the side that moves) are where they lie after folds 1…k−1 are folded flat; `angle` 180 = folded flat, 0 = open; `dir: -1` folds underneath (mountain fold, for maps). Unfold in reverse order. `P.radial(g, cx, cy, n, fn)` draws a pattern with the symmetry of paper folded into 2n layers (draw one wedge from the centre, angle 0…π/n); `P.mirror(g, cx, fn)` the symmetry of a sheet folded once (囍).

**`S.book({ x, y, w, h, open: t => 0..1, cover, coverArt, page, leftPage, rightPage, thick, board, rz })`** — a hard-cover book lying open on the table, spine at (x, y); returns `{ left, right, open, rise(t, from, to) }`. Put pieces on `left`/`right` in page pixels, standing with `anchor: [.5, 1]` and `rx: t => 90 * B.rise(t)` (rise follows the opening). For a card that opens to 90° and stands as a backdrop, build it from a base sheet and a hinged group instead (see `save-the-date.html`).

**`S.at(t0, dur, { ease, sound, v, pan })`** returns `u(t)` 0→1 and puts the move's sound on the track; eases `io oc ic sm back land linear` or a function. `S.sound({ kind, t, dur, v, pan })` adds any other sound; pass `S.sounds()` to the scene.

**`P.scene(async () => ({ stage, duration, camera(t), light(t), update(t), sounds, music }))`**
- `camera(t)` → `{ x, y, z` (the point looked at), `pitch` (0 straight down … 75 looking across the table from the front), `yaw, roll, fov, zoom, dist, focus: { at: [x, y, z], blur }, vignette }`.

Shapes and helpers: `P.circle, P.rect, P.rounded(r)` (as `draw`), `P.poly(g, pts)`, `P.path(g, svgPathData, x, y, scale)`, `P.handcut(pts, amount, seed)` (a hand-cut wobble on a polygon), `P.blob(g, w, h, { lobes, depth, seed })` (clouds, bushes, Matisse shapes), `P.cut`, `P.radial`, `P.mirror`, `P.image`, `P.cover`; `P.keys(keyframes, t)`, `P.seg, lerp, cl, io, oc, sm, back, land, rng, hash, css, mix`.

## How it looks

- One light for the whole scene, coming from a side that lights the faces you want seen (pieces standing up toward the camera need light from the camera's side: `from` 180–240). Shadows tell the heights: a few px of height for paper lying on paper, 20–60 for layers of a scene, hundreds only for something falling in.
- The surface is paper too: a wall, a table (`rough`, `cardboard`, `kraft`), a sky.
- Two to four colours per scene, flat, chosen for the occasion; the paper's grain does the texture.
- Edges match the craft: `knife` for 剪纸 and fine patterns, `cut` for scissors and Saul Bass, `torn` for hills, clouds, water and collage, `clean` for cards and books.
- See-through paper for what is light, air or water: a beam, a glow round the moon or a lamp, mist, a window pane, a veil, the near rows of water with what's under them showing; stack two or three sheets where it should be denser. Solid paper for everything else.
- Text: cut letters (`S.letters`, `text`), letters cut out of a sheet (`P.cut`), or printed on paper (`print`); installed fonts only.

## Sound

`S.at(…, { sound })` and `S.sound` put paper sounds where the paper moves: `slide` (dur), `flap` (a sheet or page swinging over, dur), `land`, `stand`, `crease`, `rustle` (dur), `tear` (dur), plus `tap`, `thud`, `whoosh` and the rest in `sound.py`. Any sound takes `v` and `pan`.

Music is small and fits the occasion, on sampled instruments, melody in the middle register: `music: { notes: [{ t, m, d, inst, v }] }`. A festival greeting: a plucked instrument (`guzheng`, `harp`, `pizzicato`) with a note on each fold or tile. A story opener: harp or piano, slow. An invitation: piano. A title sequence: upright `bass` walking, brushes (`snare`, `ride` softly), piano stabs on the cuts — put the cuts on the beat (`beat = 60 / bpm`, times as `n * beat`).

## Examples

Read them for how the ideas are carried out, then make your own piece for your own occasion — not a variation of the nearest example.

- `examples/chuanghua.html` — 窗花 · 三羊开泰 (vertical, Chinese, a New Year greeting for family groups): a red paper wedge slides onto a sheet of 宣纸 and unfolds three times into a round window flower whose creases still show; four red diamonds with characters cut out of them drop in one by one; a red strip with the family's name in gold slides in; the afternoon light moves. Guzheng, one note per fold.
- `examples/gull-rock.html` — The Keeper of Gull Rock (landscape, English, a bedtime-story podcast's episode opener): a paper theatre at night — stars, the moon, two torn clouds, the headland, a striped lighthouse on its rock and three rows of sea rise into place; a boat sails in, its hull showing through the near rows of tissue-paper sea; the moon has a halo of two tissue discs with the stars showing through; the lamp comes on and a beam of two vellum wedges, the narrow one over the wide one, sweeps over the clouds; the title flips up letter by letter; slow push in. Harp lullaby.
- `examples/save-the-date.html` — Maya & Jonah, Save the Date (vertical, English, a wedding announcement): a sage card with a monogram on a linen table opens to 90°; a low sun, a terracotta arch, two sprays of leaves, hills and the place line stand up in layers in front of the names; the camera comes down from above to look into the card, with depth of field. Piano.
- `examples/duimen.html` — 《对门》 (landscape, Chinese, a small-theatre thriller's premiere trailer): Saul Bass style at 12 fps — a door is built from black strips on orange, the camera dives into the peephole; two facing doors swing open a crack onto lit rooms; an orange sheet wipes across and the title's characters slap down; a black sheet wipes up for the dates and the theatre. Walking bass, brushes, piano stabs on the cuts.

## Check your output

- **flat colour shapes with no light** — give layers height, a surface to cast on, a light low enough to show grain and shadows.
- **shadows floating far from their pieces, or text with a legible double underneath** — lower the height, or raise `soft`.
- **flicker or blocky patches where two sheets touch** — two sheets at the same z: give each its own height, at least 1–2 px above what it lies on.
- **standing pieces dark and muddy** — the light is behind them; bring `from` round to the camera's side.
- **everything arrives at once, or fades in** — paper does not fade; bring pieces in one at a time by sliding, dropping, flipping, unfolding.
- **a crude drawing of a person, animal or object** — cut it, simplify it to clean shapes, or use a photo.
- **the same composition as an example** — start from your content's occasion and change the move, the camera and the palette.
- **sounds that don't match the moves** — take them from `S.at`, not typed times.
