---
name: neon-sign
description: Neon Sign (霓虹灯牌) — makes a VIDEO (mp4 with sound) of a real neon sign being switched on — dark grey glass tubes on a brick, concrete, tile or plank wall, the switch, tubes striking and stuttering, one bad tube buzzing at its electrode before it catches, then the sign holding steady while the wall takes its colour, the wet street reflects it and the transformer hums. Use it when asked for a neon / 霓虹 / 霓虹灯 / 灯牌 / 招牌亮灯 / neon sign / neon text / "OPEN" sign / shop sign lighting up video — a shop, café, bar, diner or noodle-house sign, a band or show name, a logo or a drawing in neon. In the manner of the Radiator Springs relighting in Pixar's Cars, Hong Kong's hand-bent street signs, and real neon shot close: tubes with thickness, bends and painted-out jumps, a white-hot core inside the colour, supports and electrode boots, cables to a transformer, light that spills onto the wall.
---

# Neon Sign

`neon.js` bends text and drawings into tubes, draws the wall, the hardware and the lit glass on a canvas, runs each tube's ignition from a seed, reflects the sign in wet ground, and turns the same ignition into sound; `render.py` renders the page to mp4 with the sound from `sound.py`. Open any file in `examples/` through a local server (`python3 -m http.server`) and it plays; `render.py` loads them directly.

## Workflow

1. Copy `neon.js`, `render.py`, `sound.py` into your project; work on the copies.
2. Decide what the sign is and where it hangs (*What to make*): whose sign, which street, what time, what wall.
3. Lay the sign out: the words and drawings, their fonts, how they are split into tubes, which gas each one is (*Tubes*).
4. Write the switching-on: when the power comes, which tube strikes when and how, which one misbehaves (*How it moves*).
5. The camera, the ambience, any music (*Sound*).
6. `python3 render.py page.html --preview --at 1,2.5,4,6,10` and look at the contact sheet; open one frame full size with the sign lit.
7. `python3 render.py page.html --out video.mp4`.

Needs ffmpeg, fluidsynth (only for music) and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`; uses Playwright's Chromium or the installed Google Chrome. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox.

## What to make

Read the content first: who owns this sign, who walks past it, what hour it is. The sign is a real object in a real place, so the words are the words that business would put up — the shop's name, what it sells, its hours, the floor it's on — and the place is the street, stairwell or bar that business is in.

- **A shop at night** — a noodle house, a 冰室, a diner, a bar: the name, sometimes what it's known for or "OPEN".
- **A sign that points** — an arrow and a floor number up a stairwell, a cup and the word 咖啡, "ROOMS" with an arrow.
- **A name on a wall** — a band's residency, a show, a studio, a person: script on planks behind a stage.
- **A drawing** — a cup with steam, a cocktail glass, a fish, a hand, a heart: a single-line drawing bent from a few tubes, sometimes animated in steps.

Place it: wall material (`brick concrete tile wood metal paint`), what else is on the wall (a conduit, a shutter, a doorway, a backer board, steel arms), wet ground or not, rain or not, dusk or night or inside a room. One sign per video, two or three colours.

## How it moves

The style, in order:

1. **Dark first.** Open on the unlit sign: grey glass tubes standing off a wall in the night's own light — supports, boots, cables visible. 1–2 s; long enough to read the shape that's about to light.
2. **The power.** One `clack` (switch or relay), a beat before the first tube strikes.
3. **Strike.** Tubes come on one part at a time, 0.1–0.5 s apart: the frame, then the name letter by letter, then the small line. Each part is one transformer, so the tubes on it flicker together. Styles (`style` on a tube):
   - `snap` — one white frame, dark, up in four frames (healthy tube)
   - `stutter` — 2–5 bursts of 1–4 frames before it holds (the usual)
   - `stubborn` — only a short length by the electrode glows and twitches for `trying` seconds, then the whole tube catches; give this to one tube, the one the video waits for
   - `warm` — comes on dim and fills over ~1.5 s (purple, blue: argon tubes)
   - `faulty` — holds, then drops out for a frame or three every `every` seconds; at most one per sign
4. **Holds.** The moment the last tube catches is the moment of the video: the wall is lit in the sign's colours, the reflection fills in, the hum is full. Hold it 4–7 s.
5. **Camera.** A slow push the whole way through (zoom 1 → 1.05–1.12), drifting a little toward what lights last. No cuts, no shake.
6. **After.** Animated signs start their pattern only once everything is lit: a chaser (chevrons stepping up the stairs, a crest rolling along a wave) via `level`; a border blinking via `N.blink`. A closing sign can switch off at the end (`off`).

Flicker is per frame, never a sine: what the ignition table gives, held for whole frames. When everything is lit it stays still — no breathing, no pulsing to a beat.

## Tubes

`N.text(str, { font, x, y, mode, inset, vertical, gap, spacing, align })` traces any installed font into tube paths; `(x, y)` is the centre of the ink.
- `mode: 'line'` (default) — one tube down the middle of each stroke. Use light/regular weights, rounded faces and scripts: `Yuanti SC`, `PingFang SC Light`, `Kaiti SC`, `Hannotate SC`, `SignPainter`, `Snell Roundhand`, `Avenir Next`, `Futura` Medium.
- `mode: 'outline'` — a tube round each stroke, pulled in by `inset` px: double-line letters, the Hong Kong look. Use heavy faces: `Weibei TC`, `Baoli SC`, `PingFang` Semibold, `Futura` Bold, `DIN Condensed`.
- `vertical: true` stacks Chinese characters into a 竖招牌.
- Returns `{ paths, chars, box }`; `chars[i].paths` are one character's strokes.

Other shapes: `N.svg(d, { x, y, scale })` (path data, M L H V C S Q T A Z), `N.line(points, bendRadius)`, `N.rect(x, y, w, h, r)`, `N.circle(cx, cy, r, a0, a1)`, `N.drawn(g => …)` (fill or stroke anything on a canvas and trace it).

Making tubes:
- `N.tube(pathsOrText, opts)` — one tube: strokes are chained into one length of glass with painted-black jumps between them and an electrode boot at each end; strokes farther apart than `maxJump` start a new length. `join: false` keeps every stroke separate.
- `N.tubes(text, opts)` — one tube per character; any option can be `(i, ch) => value` (`at: i => 2 + i * .1`, `style: i => i === 2 ? 'stubborn' : 'stutter'`).
- A script word is one `N.tube`; block letters and Chinese characters are `N.tubes`, one per letter.
- Options: `gas` (`red orange gold yellow warmwhite white pink magenta purple blue ice aqua green lime`, or `{ tube, core, glow }`), `width` (glass diameter in px; about 1/20–1/25 of the letter height), `at`, `style`, `seed`, `trying`, `every`, `off`, `level: t => 0..1`, `supports` (spacing in px, 0 for none), `electrodes: false`.
- Tubes never touch tubes of another colour; leave a tube width of air.

## The sign

```js
const N = Neon;
window.__scene = N.scene(async () => {
  const S = N.stage({ width: 1080, height: 1920 });
  const name = await N.text('金記冰室', { font: '400 205px "Weibei TC"', x: 540, y: 560, vertical: true, gap: 218, mode: 'outline', inset: 6 });
  const tubes = [
    N.tube([N.rect(334, 144, 412, 952, 18)], { gas: 'green', width: 10, at: 2.0, style: 'stutter' }),
    ...N.tubes(name, { gas: 'red', width: 8, at: i => 2.4 + i * .2, style: i => i === 2 ? 'stubborn' : 'stutter' }),
  ];
  const sign = N.sign({
    stage: S, tubes, size: [1080, 1920],            // size: the world, if the camera roams past the frame
    wall: N.wall('tile', { w: 1080, h: 1920, tile: 24, colors: [...] }),        // brick | concrete | tile | wood | metal | paint
    floor: N.floor(1430, { w: 1080, h: 1920, kind: 'asphalt', puddles: 16, sheen: .22 }),   // wet ground below y; asphalt | stone
    paint: g => { N.panel(g, { x, y, w, h, screws: true }); /* shutters, doors, conduits, arms: anything on the wall */ },
    box: { x, y, w, h },  wires: [N.cable([x1, y1], tubes[0].ends[0], 40)],     // a transformer and its cables
    ambient: '#2d3650',                              // the night's colour on the wall (dusk: lighter, a room: warm)
    spill: 2,  bloom: 1,  reflect: { strength: .9, ripple: 6, squash: .35 },
  });
  return {
    duration: 14,
    draw: t => { sign.draw(t, { camera: N.camera([[0, { x: 540, y: 960, z: 1 }], [14, { x: 540, y: 880, z: 1.08 }]], t) }); N.rain(S.ctx, t); },
    sounds: [{ kind: 'rain', t: 0, dur: 14 }, { kind: 'clack', t: 1.7 }, ...sign.sounds(14, { hz: 100 })],
  };
});
```

- Everything painted in `paint` is lit by the tubes like the wall is. Things that give their own light (a lit shop window, a street lamp) go in `draw(t, { under: (c, t) => … })`, drawn after the night and before the neon.
- `draw(t, { over })` draws after the tubes, before the reflection.
- `N.rain(c, t, { n, speed, angle, color, alpha })` after `sign.draw`.
- `N.chase(n, step, { fill, dim })` and `N.blink(period, duty, from)` make `level` functions.
- Also: `N.join`, `N.ignition`, `N.resample`, `N.bbox`, timing `seg io sm oc lerp`, `N.rng(seed)`, `N.hash`.

## How it looks

- The unlit sign reads as glass: a grey tube with a thin highlight, a soft shadow on the wall below it, dark round boots at the ends, small X-clips on supports. Painted-out jumps stay black when lit.
- Lit: colour on the tube wall, near-white core, a halo, and the wall around it in the same colour. The brighter the gas (warm white, yellow), the lower `bloom`.
- The scene is mostly dark: the night `ambient` keeps the wall readable but low; the sign is the only bright thing.
- Two or three gases per sign, each with a job: the name in one, the frame or the small line in another.
- Wet ground mirrors the sign squashed and streaked downward, broken by puddles; dry ground or no ground at all for indoor walls.
- No grain, no per-frame noise.
- Formats: vertical 1080×1920 for a hanging 竖招牌 and the street under it; 1920×1080 for a wide shopfront; 1080×1080 or 1080×1350 for a single sign on a wall.

## Sound

`sign.sounds(duration, { hz, hum, sizzle, zap })` reads every tube's ignition and gives back:
- `hum` — the transformer, as loud as the lit length of glass at each moment; `hz` 100 for 50 Hz mains (China, Hong Kong, Europe), 120 for 60 Hz (US, Japan west, Taiwan).
- `sizzle` — crackle while a tube struggles (`stubborn`, the bursts of `stutter`).
- `zap` — one dry click on each strike, panned to where the tube is.

Add: `{ kind: 'clack', t }` for the switch; the ambience of the place — `{ kind: 'rain', t: 0, dur }`, `{ kind: 'street', t: 0, dur }`. Any sound takes `pan` (−1…1) and `v`.

Music is optional and small: none; or a few notes on one or two sampled instruments that belong to the place (an upright bass checking a note, a piano chord in a bar), written as `music: { notes: [{ t, m, d, inst, v }] }`, entering after the sign holds.

## Examples

Read them for how the ideas are carried out, then make your own sign — not a variation of the nearest example.

- `examples/kam-kee-cafe.html` — 金記冰室 (vertical, Chinese, Hong Kong, rain): a 竖招牌 on a mosaic-tiled facade, 魏碑 characters in double-line red inside a green frame, KAM KEE CAFE in warm white along the bottom; the frame stutters, the characters strike one by one, 冰 glows only at its electrode for a second and a half before it catches; rain in front, the sign squashed and rippling in the wet road; rain, far traffic, 100 Hz hum.
- `examples/rosies-diner.html` — Rosie's Diner (landscape, English, US, before dawn): "Rosie's" in one pink script tube with a tail that keeps dropping out, DINER in ice-blue double-line letters snapping on left to right, a blue-bordered OPEN box whose N buzzes at one end for two seconds; brick wall, a steel band over the storefront, cables to a transformer; street ambience, 120 Hz.
- `examples/upstairs-coffee.html` — 楼上咖啡 (4:5, Chinese, dusk): a cup and steam drawn as single tubes, 楼上咖啡 in rounded single-line characters, 2F and three orange chevrons on a concrete wall by a stairwell; the steam warms up after the cup, the words stutter as one, then the chevrons start stepping upstairs one at a time.
- `examples/low-tide-fridays.html` — Low Tide · Fridays 9 PM (square, English, inside a bar): a band's name in purple script that warms up slowly, the day and time in aqua, a wave of five crests that rolls once everything is lit; vertical planks, a clear acrylic backer; one note on the upright bass and a piano chord after it holds.

## Check your output

- **flat glowing outlines on black** — put the tubes on a wall with supports, boots and a shadow, and show them dark first.
- **everything comes on at once, or fades in** — strike part by part; flicker in whole frames; one tube is late.
- **the wall doesn't change when the sign lights** — raise `spill`, check the wall isn't drawn after the sign.
- **pulsing or breathing after it holds** — nothing moves once lit except a chaser that the sign itself would have.
- **the hum or clicks don't match** — take them from `sign.sounds`, never typed times.
- **tubes of two colours touching, or letters crowding** — space them a tube width apart; thinner `width` for small text.
- **a white blob instead of letters** — lower `bloom` or `width`; use a lighter weight in `line` mode.
- **long black jumps across a word** — split it (`maxJump`, one `N.tube` per word) or order the strokes.
- **slogan copy on the sign** — the business's name, what it sells, its hours, the floor.
