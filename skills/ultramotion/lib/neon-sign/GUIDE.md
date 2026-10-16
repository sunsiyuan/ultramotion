# Neon Sign

Neon Sign (霓虹灯牌) — makes a VIDEO (mp4 with sound) of a real neon sign being switched on — dark grey glass tubes, the switch, tubes striking and stuttering, one bad tube buzzing at its electrode before it catches, then the sign holding steady while the light spills onto what's around it and the transformer hums. Hung on whatever the video needs: the user's own photo or footage of their shopfront, a bare wall seen so close the glass fills the frame, a pole sign against a dusk sky, a sign across the street seen through a rain-spattered window, a wet street at night. In the manner of the Radiator Springs relighting in Pixar's Cars (close-ups cut on each strike), Hong Kong's hand-bent street signs, and real neon shot close: tubes with thickness, bends and painted-out jumps, a white-hot core inside the colour, supports and electrode boots, cables to a transformer, shallow focus, light that spills onto the wall.

`neon.js` bends text and drawings into tubes, puts them on a wall (generated, or the user's photo or footage), draws the hardware and the lit glass on a canvas, runs each tube's ignition from a seed, reflects the sign in wet ground, adds lens effects (focus, a wet window), and turns the same ignition into sound; `render.py` renders the page to mp4 with the sound from `sound.py`. Open any file in the template folders (`templates/`) through a local server (`python3 -m http.server`) and it plays; `render.py` loads them directly.

## Workflow

1. Copy `lib/neon-sign/neon.js` into your project; work on the copies.
2. Work out who the video is for and where it will be posted, then what the sign says and what is around it (*Who it's for*, *Around the sign*).
3. Pick the shot: how close, from where, cut or one take, what's in focus (*The shot*).
4. Lay the sign out: the words and drawings, their fonts, how they are split into tubes, which gas each one is (*Tubes*).
5. Write the switching-on: when the power comes, which tube strikes when and how, which one misbehaves (*How it moves*).
6. The ambience and any music (*Sound*).
7. `python3 $SKILL/render.py page.html --preview --at 1,2.5,4,6,10` and look at the contact sheet; open one frame full size with the sign lit.
8. `python3 $SKILL/render.py page.html --out video.mp4`.

## Who it's for

Read the request for who will post this and what they want people to do. The sign says what that business or person would really put up — a name, what it sells, its hours, the floor, a title — and the scene around it follows from where it will be seen.

- **A shop or bar announcing it's open, or open late** — they usually have a photo or a clip of their own front. Put the sign on it (`N.photo`, `N.footage`). Ask for it if they have one; if they don't, use a bare wall, a close shot or a window view, never an invented shopfront.
- **An event, a gig, a party** — the name and the date on a backstage wall, a club's brick, the venue's own photo; close, warm, a little music once it's lit.
- **A brand, logo or product reveal** — the mark alone on a clean wall or backer, shot close, shallow focus, one take that ends on the whole mark sharp.
- **A channel or show intro** — short (4–6 s): dark, strike, hold on the name; the strike lands on the first beat of whatever follows.
- **A song or single** — the title as a sign, close on the glass, the colour and the pace of the song; its own few notes after it holds.
- **A wedding or party sign** — names, a date, a heart, on the venue's photo or a plain wall; soft and warm.
- **A street at night** — a place with a sign people know: a 冰室, a diner, a motel on a highway; the street, the rain, the reflection carry it.

## Around the sign

Only draw what you can draw well. Walls, brick, tile, concrete, planks, a painted steel cabinet, a sky, a far silhouette, wet ground and rain hold up; counters, machines, furniture, shelves of goods, people and lit shop interiors don't — leave them out, or keep them in the user's photo where they're real, or keep them dark or out of focus.

Choose one:
- **The user's photo or footage** — `N.photo(src)` / `N.footage(frames)` as the `wall`; the sign goes on the blank stretch above the door or on the window, at the photo's own angle (`N.warp`), light added onto the photo; their own wet ground reflects it (`floor: N.floor(y, { bare: true })`, `reflect: { light: true }`). Footage must be from a still camera; from a handheld clip take one frame as a photo.
- **The wall, close** — the frame is the tubes and a hand's width of wall around them: concrete, brick, plaster, a clear or black acrylic backer; `N.focus` for depth.
- **The whole wall** — the sign and the wall it's on, its hardware, a transformer, a conduit, a shutter or a dark doorway; wet street under it if it's outdoors.
- **Against the sky** — a pole or rooftop sign, `wall: null` and a `backdrop`: a photo of the place (the user's, public domain, or generated — a desert road, a rooftop skyline) drawn in the sign's world so it moves with the camera, softened in close-ups; or a painted sky with far ridges or rooftops in silhouette and the ground dark. The sign's light lands on the ground around it (`under`).
- **Through something** — a rain-spattered window (`N.glass`), a doorway, across a street: the sign soft and far, the near thing in focus, then focus moves to the sign.

## The shot

- **Locked off** — the camera doesn't move: a phone on a ledge across the street. Over photos and footage this is the default.
- **Slow push or drift** — z 1 → 1.03–1.1 over the video, drifting toward what lights last.
- **Slide along the glass** — close (z 1.3–2), tracking sideways along the word with the wall turned away (`N.warp`), focus following the tube that's lighting.
- **Cut on each strike** — close-ups of single parts, each held dark for a beat and cut a few frames after its tube catches, then a wide on the whole sign. Write the camera as a list of shots and pick by `t`.
- **Focus pull** — from the near thing (drops on a window, the near end of the word) to the sign, after it holds.

Formats: 1080×1920 for Reels / TikTok / 抖音 and tall signs; 1080×1440 for 小红书 and shopfront photos; 1080×1350 or 1080×1080 for a post or a cover; 1920×1080 for a wide street or a roadside sign.

## How it moves

The style, in order:

1. **Dark first.** Open on the unlit sign: grey glass tubes on whatever it hangs on, in that place's own light — supports, boots, cables visible. 1–2 s; long enough to read the shape that's about to light.
2. **The power.** One `clack` (switch or relay), a beat before the first tube strikes (leave it out when the camera is far from the sign).
3. **Strike.** Tubes come on one part at a time, 0.1–0.5 s apart: the frame, then the name letter by letter, then the small line. Each part is one transformer, so the tubes on it flicker together. Styles (`style` on a tube):
   - `snap` — one white frame, dark, up in four frames (healthy tube)
   - `stutter` — 2–5 bursts of 1–4 frames before it holds (the usual)
   - `stubborn` — only a short length by the electrode glows and twitches for `trying` seconds, then the whole tube catches; give this to one tube, the one the video waits for
   - `warm` — comes on dim and fills over ~1.5 s (purple, blue: argon tubes)
   - `faulty` — holds, then drops out for a frame or three every `every` seconds; at most one per sign
   - a tube that never lights (`at: 999`) — the NO of NO VACANCY, a dead letter
4. **Holds.** The moment the last tube catches is the moment of the video: what's around the sign takes its colour, the reflection fills in, the hum is full. Hold it 3–7 s.
5. **After.** Animated signs start their pattern only once everything is lit: a chaser (chevrons stepping, a crest rolling, an arrow running) via `level`; a border blinking via `N.blink`. A focus pull, a cut to the wide, or a closing sign switching off (`off`) can come here too.

Flicker is per frame, never a sine: what the ignition table gives, held for whole frames. When everything is lit it stays still — no breathing, no pulsing to a beat.

## Tubes

`N.text(str, { font, x, y, mode, inset, vertical, gap, spacing, align })` traces any installed font into tube paths; `(x, y)` is the centre of the ink.
- `mode: 'line'` (default) — one tube down the middle of each stroke. Use light/regular weights, rounded faces and scripts: `Yuanti SC`, `PingFang SC Light`, `Kaiti SC`, `Xingkai SC`, `Hannotate SC`, `SignPainter`, `Snell Roundhand`, `Avenir Next`, `Futura` Medium.
- `mode: 'outline'` — a tube round each stroke, pulled in by `inset` px: double-line letters, the Hong Kong look. Use heavy faces: `Weibei TC`, `Baoli SC`, `PingFang` Semibold, `Futura` Bold, `DIN Condensed`.
- `vertical: true` stacks characters into a 竖招牌 (or a vertical MOTEL).
- Returns `{ paths, chars, box }`; `chars[i].paths` are one character's strokes.

Other shapes: `N.svg(d, { x, y, scale })` (path data, M L H V C S Q T A Z), `N.line(points, bendRadius)`, `N.rect(x, y, w, h, r)`, `N.circle(cx, cy, r, a0, a1)`, `N.drawn(g => …)` (fill or stroke anything on a canvas and trace it).

`N.warp(src, quad, from)` puts a flat layout onto a wall seen at an angle: the rectangle `from` ([x, y, w, h], default the layout's box) goes to `quad` (four corners, clockwise from top-left). Works on paths or a `text()` result; each char gets `k`, its scale there — use it for width (`width: i => 10 * t.chars[i].k`); `result.map.scale(x, y)` gives it anywhere.

Making tubes:
- `N.tube(pathsOrText, opts)` — one tube: strokes are chained into one length of glass with painted-black jumps between them and an electrode boot at each end; strokes farther apart than `maxJump` start a new length. `join: false` keeps every stroke separate.
- `N.tubes(text, opts)` — one tube per character; any option can be `(i, ch) => value` (`at: i => 2 + i * .1`, `style: i => i === 2 ? 'stubborn' : 'stutter'`).
- A script word is one `N.tube`; block letters and Chinese characters are `N.tubes`, one per letter.
- Options: `gas` (`red orange gold yellow warmwhite white pink magenta purple blue ice aqua green lime`, or `{ tube, core, glow }`), `width` (glass diameter in px; about 1/20–1/25 of the letter height), `at`, `style`, `seed`, `trying`, `bursts`, `every`, `off`, `level: t => 0..1`, `supports` (spacing in px, 0 for none), `electrodes: false`.
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
    paint: g => { N.panel(g, { x, y, w, h, screws: true }); /* backer boards, cabinets, arms, conduits: anything on the wall */ },
    box: { x, y, w, h },  wires: [N.cable([x1, y1], tubes[0].ends[0], 40)],     // a transformer and its cables
    ambient: '#2d3650',                              // the night's colour on the wall (dusk: lighter, a room: warm, a photo: near white)
    spill: 2,  bloom: 1,  reflect: { strength: .9, ripple: 6, squash: .35 },
  });
  return {
    duration: 14,
    draw: t => { sign.draw(t, { camera: N.camera([[0, { x: 540, y: 960, z: 1 }], [14, { x: 540, y: 880, z: 1.08 }]], t) }); N.rain(S.ctx, t); },
    sounds: [{ kind: 'rain', t: 0, dur: 14 }, { kind: 'clack', t: 1.7 }, ...sign.sounds(14, { hz: 100 })],
  };
});
```

What the sign hangs on (`wall`):
- `N.wall(kind, …)` — a generated wall.
- `await N.photo('media/front.jpg', { w, h, focus: [fx, fy], zoom })` — the user's photo, cropped to cover the frame; `focus` picks what survives the crop. Use `ambient` near white so the photo stays as it was shot.
- `await N.footage('frames/%04d.jpg', { w, h, count, fps })` — a still-camera clip as frames (`ffmpeg -i clip.mp4 -vf fps=30 frames/%04d.jpg`); call `await footage.seek(t)` at the top of `draw` (make `draw` async).
- `null` with `backdrop: (c, t, cam) => …` — nothing behind the sign but what `backdrop` paints (sky, far ridges, a skyline); `cam.apply(c, k)` sets the camera with parallax `k` (0 fixed to the screen, 1 moves with the sign). Paint the cabinet, pole or backer in `paint`.

More:
- Everything in `paint` is lit by the tubes like the wall is. Things that give their own light go in `draw(t, { under: (c, t) => … })`, drawn after the night and before the neon.
- `draw(t, { over })` draws after the tubes, before the reflection.
- `reflect: { light: true }` mirrors only the sign's light — for photos and footage that already show their own reflections. `N.floor(y, { bare: true })` adds wetness without painting a ground.
- `N.rain(c, t, { n, speed, angle, color, alpha, length })` after `sign.draw`.
- `N.focus(c, opts)` after `sign.draw`: `{ blur }` everything soft; `{ at: [x, y], angle, sharp, falloff, max }` a plane turned away from the camera — sharp within `sharp` px of the line through `at`, `max` px blur `falloff` px further (`angle` 0: blur grows left and right; `side: 1 | -1` one side only); `{ at, radial: true, … }` sharp around a point. Screen pixels; animate `at` for a pull.
- `N.glass(c, t, { blur, soft, drops, size, runs, fog, fogColor, wipe, seed })` last: a wet window between the camera and everything drawn — the scene goes soft behind it (`blur`), drops hold small upside-down sharp copies of it, `runs` drops slide down leaving trails; `soft` blurs the drops when focus moves past the glass.
- `N.chase(n, step, { fill, hold, dim })` and `N.blink(period, duty, from)` make `level` functions.
- Also: `N.join`, `N.ignition`, `N.resample`, `N.bbox`, timing `seg io sm oc lerp`, colour `rgba mix`, `N.rng(seed)`, `N.hash`.

## How it looks

- The unlit sign reads as glass: a grey tube with a thin highlight, a soft shadow on the wall below it, dark round boots at the ends, small X-clips on supports. Painted-out jumps stay black when lit.
- Lit: colour on the tube wall, near-white core, a halo, and the wall around it in the same colour. The brighter the gas (warm white, yellow), the lower `bloom`; a pale face right behind the tubes (cream, white plaster) takes less `spill`.
- The sign is the brightest thing; the rest stays in the place's own light: night blue on a street, the last orange in a dusk sky, the photo as it was taken.
- Two or three gases per sign, each with a job: the name in one, the frame or the small line in another.
- Wet ground mirrors the sign squashed and streaked downward, broken by puddles; dry ground or no ground at all indoors.
- No grain, no per-frame noise.

## Sound

`sign.sounds(duration, { hz, hum, sizzle, zap })` reads every tube's ignition and gives back:
- `hum` — the transformer, as loud as the lit length of glass at each moment; `hz` 100 for 50 Hz mains (China, Hong Kong, Europe), 120 for 60 Hz (US, Japan west, Taiwan).
- `sizzle` — crackle while a tube struggles (`stubborn`, the bursts of `stutter`).
- `zap` — one dry click on each strike, panned to where the tube is.

Scale them to where the camera is: close on the glass, all three up; across a street or behind a window, hum and sizzle low. Add: `{ kind: 'clack', t }` for the switch; the ambience of the place — `{ kind: 'rain', t: 0, dur }`, `{ kind: 'street', t: 0, dur }`. Any sound takes `pan` (−1…1) and `v`.

Music is optional and small: none; or a few notes on one or two sampled instruments that belong to the place or the purpose (a guitar tried inside a bar, a twang on a desert highway, electric-piano chords for a song), written as `music: { notes: [{ t, m, d, inst, v }] }`, entering after the sign holds.

## Examples

Read them for how the ideas are carried out, then make your own sign for your own purpose — not a variation of the nearest example.

- `templates/neon-on-your-photo/gebi-bar.html` — 隔壁小酒馆 (3:4, Chinese, a lane bar's opening night): the owner's photo of the shopfront at dusk as the wall, 隔壁 in pink 行楷 single-line and 小酒馆 in warm white on the blank plaster over the door; the phone doesn't move; 壁 buzzes at its electrode before it catches; a pink streak appears in the photo's wet paving; light drizzle, a guitar tried inside.
- `templates/neon-single-cover/hai-mei-shui.html` — 还没睡 (square, Chinese, a single's cover sign): a handwritten title in blue argon on a rehearsal-room wall turned away from the lens, shot so close the near character fills a third of the frame; the camera slides along the word, focus moves from 还 to 睡 while 睡 struggles, then on to a small warm-white moon; electric-piano chords.
- `templates/neon-motel-sign/desert-rose-motel.html` — Desert Rose Motel (16:9, English, a highway at dusk): a weathered pole sign in the scrub beside a desert road, the mountains and the afterglow behind it (a photo, `media/desert-dusk.jpg`); close-ups cut on each strike with the desert soft behind — the aqua script, the red vertical MOTEL, VACANCY buzzing while NO stays dark — then the wide, the light going, the sign's colours on the ground around the pole, gold chevrons running toward the office; a short guitar line.
- `templates/neon-rainy-window/nicos-pizza.html` — Nico's Pizza (vertical, English, Queens in the rain): seen from an apartment window across the street, focus on the drops on the glass; the red script, PIZZA in warm white and a stubborn OPEN LATE in green come on as blurs and as tiny upside-down copies in every drop; drops slide down; then focus leaves the glass for the sign; rain on the pane, no music.
- `templates/neon-shop-sign/kam-kee-cafe.html` — 金記冰室 (vertical, Chinese, Hong Kong, rain): a 竖招牌 on a mosaic-tiled facade, 魏碑 characters in double-line red inside a green frame, KAM KEE CAFE in warm white along the bottom; the frame stutters, the characters strike one by one, 冰 glows only at its electrode before it catches; rain in front, the sign squashed and rippling in the wet road; a slow push; rain, far traffic, 100 Hz hum.

## Check your output

- **flat glowing outlines on black** — put the tubes on something with supports, boots and a shadow, and show them dark first.
- **a sign centred on a dark wall with a slow push, again** — go back to *Who it's for* and *The shot*: their photo, the glass up close, a sky, a window, cuts.
- **a counter, a machine, people or a shop interior drawn under the sign** — take them out: their photo, a closer frame, darkness or blur instead.
- **everything comes on at once, or fades in** — strike part by part; flicker in whole frames; one tube is late.
- **the wall doesn't change when the sign lights** — raise `spill`, check the wall isn't drawn after the sign.
- **the sign pasted flat on a photo taken at an angle** — `N.warp` it onto the wall's corners; widths from `k`.
- **pulsing or breathing after it holds** — nothing moves once lit except a chaser the sign itself would have, the camera and the focus.
- **the hum or clicks don't match** — take them from `sign.sounds`, never typed times.
- **tubes of two colours touching, or letters crowding** — space them a tube width apart; thinner `width` for small text.
- **a white blob instead of letters** — lower `bloom` or `width`; use a lighter weight in `line` mode.
- **long black jumps across a word** — split it (`maxJump`, one `N.tube` per word) or order the strokes.
- **slogan copy on the sign** — the business's name, what it sells, its hours, the floor, a title, a date.
