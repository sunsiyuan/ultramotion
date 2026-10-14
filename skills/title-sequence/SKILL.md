---
name: title-sequence
description: Title Sequence (电影片头字) — slow, quiet film titles rendered from code to a finished VIDEO (mp4 with music): opening credits, a film or documentary title, chapter cards, a podcast or series opening. Type fades in and opens up letter-space by letter-space, one card at a time on the music's bars, in wide empty frames over dark footage, fog, window light, distant lights or a dusk horizon, with a slow camera, grain, halation and a film grade; Chinese can run vertically. Use it when asked for 片头 / 片头字幕 / 演职员表 / 电影感开场 / 纪录片片头 / 章节卡 / title sequence / opening credits / cinematic title / film-style intro. In the manner of the openings collected on Art of the Title — Manchester by the Sea, The Social Network, The Green Knight, A24 and Netflix documentary openings: small tracked capitals placed in the quiet part of the picture, long holds, one long note when the title lands.
---

# Title Sequence

`title.js` sets the type (tracking that animates without losing its centre, letter-by-letter and wipe reveals, vertical Chinese), lays the cards out in time, cuts between shots, and draws the grounds — fog, shafts of light, floating dust, out-of-focus lights, light leaks, film dirt, user footage — and the film finish (grade, grain, halation, vignette, letterbox) on a canvas. `render.py` turns the page into an mp4 with the score from `sound.py`, played on sampled instruments. Open any file in `examples/` in a browser and it plays.

## What the viewer wants

To be told, quietly, that something is about to begin and what it is — the people who made it, where and when it is, its name — while the picture sets the mood. Nothing hits, flashes or bounces. The frame is mostly empty; one thing is said at a time; the title gets the longest, emptiest moment.

## Workflow

1. Copy `title.js`, `render.py`, `sound.py` into your project; work on the copies.
2. Understand the film: what it is about, where it happens, who it is for. Write the cards the way the film would really credit itself — company presents, the cast, the title, written and directed by; a place and a year; chapter names — in the language and order that the film's culture uses.
3. Lay the cards out in time (*Time*).
4. Plan the shots (*Shots*): a new one every card or two, from the user's footage or stills if they have any, otherwise dark pictures made in code from the film's world (*Grounds*).
5. Write the score so the long note lands on the title (*Sound*).
6. `python3 render.py page.html --preview --at 2,6,10,14,18,22` and look at the contact sheet; `--preview --at 12 --full` for one frame at full size. Look at the type at full size.
7. `python3 render.py page.html --out video.mp4` (`--crf 27` by default; grain costs bits — lower the grain before lowering the crf).

Needs ffmpeg, fluidsynth (`brew install fluid-synth` / `apt install fluidsynth`; the soundfont downloads itself on first use) and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`; uses Playwright's Chromium or the installed Google Chrome. WebGL2 is used for fog, rays and the finish. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox; if frames come out blank, launch Chromium with `--disable-gpu`.

## How it moves

1. **One thing at a time.** A card fades in (0.5–1.5 s), holds (2.5–6 s), fades out, and the picture plays alone for a moment before the next. A list of names is several cards, not one block.
2. **Small, tracked, placed in the quiet.** Credits are small — a cap height of about 1.5–2.5% of the frame's short side for Latin; Chinese a little larger. Capitals get wide tracking (0.15–0.4 em); lowercase and italics stay close to normal. Put each card where the picture is empty — the sky, the water, the dark side of the room — and move it when the picture changes; it does not have to be centred.
3. **Tracking keeps opening.** Through a card's hold the letter-spacing can widen very slowly and never quite stop (`ease.linger`); or the title starts wide and settles. Never a bounce or an overshoot.
4. **A new shot every card or two.** Change the framing, the place or the time of day's light — wide, close, a detail, the sky. Change with a dissolve (1–2.5 s), through black, or a straight cut in the gap between cards. The title gets the best empty shot.
5. **The picture moves, the type stays.** Inside each shot the camera pushes or drifts — a few percent of zoom, or a slow pan or rise — with a little gate weave. Type is pinned to the frame. Natural motion in the background — branches, grass, water, fog, dust, lights — is slow (seconds per sway), small and continuous, moving together like one wind; never a jitter or a per-frame random offset.
6. **The title is the one moment.** It comes last or after the cast, in the emptiest frame, held longest. It can appear letter by letter, out of order, from a blur, or where a flare has passed — and when its last letter lands (or its tracking arrives) the music lands a long low note. After that, nothing new for a while.
7. **The end goes to black** slowly, or leaves the picture on its own.

Ways to bring a word in — pick one per piece and keep to it, with at most a different one for the title:
- a plain fade (`reveal: { mode: 'fade' }`, or just `a`);
- out of a blur into focus (`blur` falling to 0, or `reveal: { blur }`);
- letter by letter, left to right or top to bottom (`mode: 'letters'`), or out of order (`mode: 'random'`), or from the middle out (`mode: 'center'`);
- a soft edge passing across (`mode: 'wipe'`), with a flare (`streak`) riding the edge;
- tracking opening from tight to wide, or closing from very wide to set.

## Type

- **Serif** for drama, period, literature, documentary (Baskerville, Big Caslon, Didot, Hoefler Text; 宋体 Songti SC, 仿宋 STFangsong); **light geometric or grotesque sans** for the modern, the urban, the technical (Avenir Next, Futura, Helvetica Neue Light; 苹方 PingFang light weights).
- Two weights or styles at most: the role small and dim (italic lowercase, or small caps), the name larger. A credit can mix an italic first name with an upright surname.
- Chinese credits: role and name separated by a full-width space or put in two columns, no colon; dates in Chinese numerals (二〇二五年) in a literary film, Arabic numerals in a modern one.
- **Vertical Chinese** (`vertical`): columns run right to left, the role column first (to the right), the name column a little lower; punctuation turns into its vertical form by itself. Good for documentary, history, the countryside, family; place it on the right third.
- Colour: warm off-white on dark (#efe6d6), a cold white on a blue night; titles may take the colour of the light in the picture.

## Time

Units are seconds, or bars when you give a tempo. `T.schedule(cards, { bpm, hold, gap, fadeIn, fadeOut })` returns each card with `t0` (fade-in starts), `land` (fully in), `t1` (gone) and `a(t)`; a card can set its own `at`, `hold`, `gap`, fades.
- **A cast list on a slow piano** (60–76 bpm): one card per one to two bars, half a bar of picture between cards.
- **A documentary opening**: a place and a year first, alone; then the people; then the title; 40–50 s.
- **A short social cut** (vertical, 20–30 s): one or two cards, the title by second 10–15, held 6–10 s.
- Leave a beat of silence or a held breath in the music right before the title.

## Shots

`T.reel([{ draw(ctx, t, u), cards: [i, …] | at, cam: { from, to }, in, dur }, …], { cards, duration, dur, weave })` → `{ draw(ctx, t), shots, at(t) }`.
- `cards` says which cards a shot carries; it starts half-way through the gap before its first card. `at` gives a start in seconds instead (for a title that is not in the schedule).
- `cam: { from: { x, y, z, r, cx, cy }, to: { … } }` — the shot's own camera move, eased across the shot and still moving through the transitions; `u` (0..1) is passed to `draw` for anything else that travels (a cable car crossing, the sun sinking).
- `in`: `'fade'` (a dissolve, the default), `'black'`, `'cut'`; `dur` how long the change takes.
- Draw the type after `shots.draw`, outside the shots.

A sequence of shots for one film stays in one world and one grade: the same farm at dusk from five places, the same old house room by room, the same foggy riverside street by street. Vary the size: a wide, a detail, a close-up against the light, a wide again for the title. Keep every shot dark, quiet and mostly empty.

## Grounds

What a shot can be made of — pick what belongs to the film — a room, a street, a field, a sea — and keep it dark and slow.
- **The user's footage or stills**: `T.footage('clip.mp4', { at, from, rate })` and `T.still('a.jpg')`, drawn with `T.cover(ctx, m, { z, fx, fy, a })` (z for a slow push, fx/fy the point it pushes towards). Video is seeked to the right frame before each frame is drawn. Darken and grade it; place the type where it is quiet.
- **Fog or haze** (`T.fog`) with lights glowing through it — a river at night, a mountain town, a harbour.
- **Light through a window or a door** (`T.rays` with `end` where the light lands) with **dust floating only inside the beam** (`T.motes` with a `light` function) and the window's shape on the floor.
- **A landscape drawn in code**: a gradient sky with a low sun (`T.glow`), silhouettes — buildings, hills, poles, trees — on parallax layers, grass or reeds moving in gusts.
- **Distant lights out of focus** (`T.bokeh`), which can come into focus (`focus` 1 → 0.3) after the title.
- **A plain dark ground** with a **light leak** wandering in from an edge (`T.leak`), or a single **flare** (`T.streak`).
- Snow, ash, pollen or dust in the air: `T.motes` with `fall`, `wind`, `sway`.

## The film finish

`T.finish(ctx, t, { grade, grain, grainSize, vignette, halation, bloom, aberration })` last, then `T.letterbox(ctx, 2.39)` for a scope picture on a 16:9 canvas.
- `grade`: `lift` (raise the blacks a little: .02–.04), `gamma`, `gain`, `contrast` (.9–1), `saturation` (.75–.9), `shadows` / `highlights` colours with `split` (.3–.5) — teal shadows and warm highlights, or cold all over for winter, amber for a memory.
- Grain changes per film frame (24 fps): .04–.06 clean, .07–.09 16 mm. Halation .25–.5 puts a warm edge on bright things; vignette .4–.6.
- `T.dust` for film dirt on an old or handmade film; `T.weave` for gate weave inside the camera transform.

## The page

```js
const T = Title, { seg, lerp, env, ease } = T;
const S = T.create({ width: 1920, height: 1080 });                         // or 1080 × 1920
const cards = T.schedule([{ name: '…', role: '…', x, y }, …], { bpm: 72, hold: 1.5, gap: .5, fadeIn: 1, fadeOut: 1 });
function draw(c, t) {
  shots.draw(c, t);                                                        // const shots = T.reel([{ cards: [0], cam, draw: (c, t, u) => { /* fog / rays / motes / bokeh / footage / your own drawing */ } }, …], { cards, duration })
  cards.forEach(k => T.block(c, [{ text: k.role, size: 20, italic: true }, { text: k.name, size: 26, tracking: .3, gap: 10 }], k.x, k.y, { font, align: 'center', valign: 'middle', a: k.a(t) }));
  T.text(c, 'TITLE', x, y, { font, size, weight, tracking, align, caps, color, a, blur, glow: { color, blur }, reveal: { u, mode, spread, soft, seed, blur, rise } });
  T.vertical(c, ['角色', { text: '名字', size: 46, dy: 1.2 }], x, y, { font: T.SONG, size, tracking, colGap, valign, reveal });
  T.finish(c, t, { grade: { … }, grain, halation }); T.letterbox(c, 2.39);
}
window.__scene = T.scene(S, draw, { duration, background, music: { notes, dynamics }, sounds, timeline });
```

Also: `T.env(t, t0, t1, fadeIn, fadeOut)`, `T.key(t, [[t, v], …])` (numbers, arrays or objects), `T.measure`, `T.glow(ctx, x, y, r, color, a)`, `T.weave(t, amt)` (slow drift), `T.noise(x, seed)`, `T.rand(seed)`, `T.chord(t, midis, { inst, d, v, roll })`; eases `ease.sine io out expo linger`; fonts `T.SERIF T.SANS T.SONG T.FANG T.KAI`; `seg`, `lerp`, `cl`, `rgba`.

## Examples

Four openings that differ in subject, ground, script, layout and format. Read them for how the ideas are carried out, then make your own film's opening — not a variation of the nearest example.

- `examples/move-out-zh.html` — 《搬家以前》, a family documentary (landscape, Chinese): an old house in 慈城, one shot per card — winter sun through a window landing on the floor with dust lit only inside the beam, a doorway onto the courtyard's daylight, a thermos and an enamel mug on the table, the courtyard at dusk with a few persimmons left on the tree, and for the title a lattice window; vertical 宋体 credits on the right, place and year first, then filmmaker, the grandparents, sound; the title comes in character by character out of a blur and keeps opening; solo piano, one phrase per card, a low D and a quiet chord when the title lands, then fewer and fewer notes.
- `examples/xiabancheng-zh.html` — 《下半城》, a short film about Chongqing's old riverside streets (vertical, Chinese): one shot per card, all in fog — the Yangtze with the far bank's lights, stone stairs climbing into the fog past a wall lamp, stilt houses with a few windows lit, the cable car crossing the river for the title, the river again at first light for the director; a ship's horn; the title in heavy 宋体 opening from tight to very wide out of a blur, then the street names; piano and cello, a low D minor as the title's spacing arrives.
- `examples/winter-wheat-en.html` — *Winter Wheat*, opening credits of an independent film on a North Dakota farm (landscape, 2.39 letterbox, English): a shot per card from dusk into night, drawn in code — the sky with lit clouds, the grain elevator close with its red light, the gravel road and poles going away, the stubble from down low against the sun, the widest emptiest field for the title (in through black), the lit farmhouse window in the first snow; a light leak, film dirt, 16 mm grain; small tracked Baskerville capitals placed where each shot is empty; the title's letters appear out of order after a beat of silence; piano at 72 bpm with one repeated note over moving chords.
- `examples/night-shift-en.html` — *Night Shift*, the opening of a Chicago podcast about people who work through the night (vertical, English): three of its people, one line each; a thin blue flare slides across the dark and the title appears where it has passed; the river's lights below come into focus; electric piano and bass, a low note and a pad under the title.

## Sound

A light score on sampled instruments, written as notes on the page — `{ t, m (MIDI), d (seconds), inst, v }` — plus `dynamics: { inst: [[t, level], …] }` for swells.
- One or two instruments: solo piano; piano and cello; electric piano (`keys`) and `bass`; `slowstrings` or `pad` underneath for the title. Melody in the middle register (MIDI 55–76).
- Notes start with the cards: a chord or a short phrase as each card comes in, computed from the schedule (`k.t0`, `k.land`).
- **The landing**: at the title's moment a low root (`bass` or `piano` an octave or two down, `cello`) and a rolled chord (`T.chord`); for a larger film `slowstrings` swelling in from a second before; for a small, personal one only the piano, quiet, then fewer and fewer notes to the end. Don't build up after the title.
- A beat or two of silence just before the title makes the landing.
- Sounds that belong to the place are welcome: a ship's horn (`horn`, low, long), a `whoosh` under a flare, a soft `shimmer`. No `impact`, `boom` or risers.

## Check your output

- **two cards on screen at once**, or a card arriving before the last one has gone — leave a gap.
- **credits big and centred on every card** — make them small, and place each in the quiet part of the picture.
- **the title rushes** — give it the emptiest frame, the longest hold, and its own musical moment.
- **a bounce, a pop, a flash or a hard cut** — fade, blur, drift, open.
- **one picture under every card** — change the shot every card or two.
- **shots that don't belong together** — one place, one world, one grade; vary the framing and the light, not the style.
- **the picture is frozen** — move the camera, the fog, the dust or the light all the time.
- **the type swims with the camera** — draw the type outside the camera transform.
- **tracking that shifts the word off centre** — use `text`/`measure`, which keep the centre.
- **a bright area under small type** — move the card or darken the ground there.
- **vertical Chinese with horizontal punctuation** — use `vertical`, which turns it.
