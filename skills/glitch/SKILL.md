---
name: glitch
description: "Glitch (故障) — makes a VIDEO (mp4 with sound) where the picture is clean almost all the time and the digital signal breaks only on the moments that matter — RGB channels pulling apart, the frame torn into sliding horizontal bands, compression blocks, pixel-sorted streaks, static bars, frozen or skipping frames, a datamosh where one shot is dragged into the next, a CRT switching on, and the set switching off (the picture squeezed to a line, then a dot). Works on type, graphics, photos and the user's own footage. Use it when asked for a glitch / 故障 / 故障风 / 信号干扰 / 数据错位 / RGB 分离 / datamosh / 像素排序 / 电视关机 / CRT / VHS-style title, intro, transition, lyric card, launch video or teaser. In the manner of the Mr. Robot title cards, the Cyberpunk 2077 E3 2018 logo reveal and the datamosh in Kanye West's Welcome to Heartbreak: two to four bad frames that change something, then clean again; one long break at the end."
---

# Glitch

`glitch.js` takes the picture you draw on a 2D canvas each frame and breaks it with one WebGL pass, following a list of breaks you place in time; the same list gives the sounds. `render.py` renders the page to mp4 with the sound from `sound.py`, and splits any footage the page uses into frames first. Open any file in `examples/` through a local server (`python3 -m http.server`) and it plays; `render.py` loads them directly.

## Workflow

1. Copy `glitch.js`, `render.py`, `sound.py` into your project; work on the copies.
2. Read the content: what the piece is for, who watches it, which three or four moments carry it (*What to make*).
3. Draw the clean picture as a function of time — type, layout, images, footage — and watch it play clean first.
4. Place the breaks on those moments (*How it moves*, *Kinds*), and the sound with them (*Sound*).
5. `python3 render.py page.html --preview --at 2.4,2.47,2.53,5,8.1` — put times on the frames of each break, and on clean frames between.
6. `python3 render.py page.html --out video.mp4`.

Needs ffmpeg, fluidsynth (only for music) and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`; uses Playwright's Chromium or the installed Google Chrome. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox. If frames come out blank, add `--disable-gpu` to the browser args in `render.py`.

## What to make

The piece is about its content, never about the glitch. Find where the content itself has a break — time jumping, a system failing, an intruder, a cut between two shots, something switching off, a secret flashing up — and the signal breaks there.

- **A title** — a series, a short drama, a film, an episode: the title lands with a break, holds clean.
- **An intro** — a podcast, a channel, an esports match: a moment of failure in the story (a command, an error, a dropped call) cuts the music and breaks the frame; the title card comes after.
- **A launch or teaser** — a security product, a device, a game: one element is wrong (a row, a face, a word) and only it glitches; the product fixes it and it goes still.
- **A lyric card or music post** — over the band's footage or photo: breaks on the cut, on a held word, and the set switches off at the end.
- **On someone's footage or photo** — a vlog cut, an old home movie, a portrait: the user's picture is the content; breaks on its cuts and its last frame.

## How it moves

1. **Clean first.** The picture reads clean for a while before anything breaks; most frames of the video — 85–95% — have no break at all.
2. **A break is short.** Sharp breaks last 1–4 frames, 6 at most; a burst is 2–3 of them with clean frames in between.
3. **A break changes something.** Each one is a door: the clock jumps back, the title arrives, the colour changes, the shot cuts, the row is caught. Nothing breaks just to decorate.
4. **Spacing.** Close together (0.5–1 s apart) only where something is being revealed; elsewhere 2–6 s apart, or none for a long stretch.
5. **One long break at the end** — or none: a datamosh into the last shot, a freeze, the set switching off.
6. **Narrow it.** When one thing is wrong, `area` the break to that thing and leave the rest of the frame still.
7. **On the sound's hits, not on the beat.** A break falls on a word, a cut, a key press, a reveal — never on every beat of the music, never a whole-frame flash or pulse in time with it.

## Kinds

Each break is `{ t, kind, d?, amt?, seed?, area? }` — `t` and `d` in seconds (each kind has a default length), `amt` scales it (0.5 subtle … 1.2 heavy), the same `seed` gives the same break, `area` `{ x, y, w, h }` in pixels limits it to a part of the frame.

| kind | what | default |
|---|---|---|
| `blip` | channels split and a sliver of tear for a frame or two — the smallest accent | 2 frames |
| `shift` | the frame jumps sideways a few pixels and back | 2 frames |
| `hit` | tear + channel split + a few blocks, maybe a static band | 3 frames |
| `tear` | horizontal bands slide apart; some rows repeat | 3 frames |
| `blocks` | compression blocks: copied from elsewhere, flattened, smeared, colours crushed | 4 frames |
| `burst` | everything, changing every frame or two, with clean frames inside | 9 frames |
| `sort` | bright runs pixel-sorted down the columns, growing | 6 frames |
| `drop` | signal lost: static and darkness | 4 frames |
| `roll` | vertical hold slips: the picture rolls (`dir` 1 / −1) | 12 frames |
| `freeze` | the picture stops (`at`: which moment it holds; default its own `t`) | 18 frames |
| `stutter` | the last few frames repeat (`loop` seconds) | 12 frames |
| `flash` | a frame or two of another moment (`show`: its time) — a glimpse of what's coming | 2 frames |
| `mosh` | datamosh: the frame before `t` (or `from`) is dragged by the new picture until it breaks through in patches; put it on a cut | 1 s |
| `on` | the set switching on: black, a dot, a line, the picture | 0.5 s |
| `off` | the set switching off: the picture squeezes to a bright line, then a dot that fades; stays black | 0.65 s |
| `fx` | your own mix: `fx: { rgb, tear, bands, block, bsize, crush, noise, sort, jitter, repeat, invert, black }` | 3 frames |

## The page

```html
<canvas></canvas>
<script src="glitch.js"></script>
<script>
const G = Glitch;
window.__scene = G.scene(async () => {
  await G.fonts(['700 120px "PingFang SC"']);
  const clip = await G.footage('media/clip.mp4');           // render.py splits it into frames; G.image('photo.jpg') for stills
  const glitches = [
    { t: 0, kind: 'on' },
    { t: 3.2, kind: 'hit', seed: 4 },
    { t: 6.0, kind: 'mosh', d: 1.0 },                        // the clip cuts at 6.0
    { t: 8.4, kind: 'blip', area: { x: 120, y: 820, w: 840, h: 120 } },
    { t: 11.3, kind: 'off' },
  ];
  return {
    width: 1080, height: 1920, duration: 12,
    draw: async (c, t) => {                                  // the clean picture at t; async when it waits for a frame
      await clip.draw(c, t);                                 // fills the canvas, cropped; or clip.draw(c, t, { x, y, w, h, fx, fy, zoom })
      c.fillStyle = '#fff'; c.font = '700 120px "PingFang SC"'; c.fillText('…', 120, 900);
    },
    glitches,
    look: { scan: .12 },
    sounds: [...G.sounds(glitches, 12)],
    music: { notes: [] },
  };
});
</script>
```

- `draw(c, t)` must depend only on `t`. The library calls it with the content time — a `freeze`, `stutter` or `flash` changes which `t` it gets — and again with the frame before a `mosh`.
- Helpers: `G.typed(str, t, t0, cps)` (typed out), `G.decode(str, t, t0, dur)` (scrambled characters settling into the text), `G.cells(c, str, x, y, cell, align)` (fixed-width digits that don't wobble), `G.cover(c, img, box)`, `G.fonts([...])`, timing `seg io sm oc lerp`, `G.hash`, `G.rng(seed)`.
- `render.py frames clip.mp4 [--fps 30 --width 1920]` splits footage by hand; `render.py page.html …` does it for every `G.footage('…')` it finds.

## How it looks

- `look` is the screen, the same on every frame: `scan` (scanlines, 0.08–0.25; `scanPx` their spacing), `curve` (CRT bulge, 0.08–0.15), `vignette`, `ghost` (a faint echo to the right), `bloom` (bright parts glow), `chroma` (a constant 1–2 px colour fringe), `mono`, `grain` (still grain, the same every frame). Leave all of them at 0 for a clean modern piece; use them when the picture is meant to be on a set or a tape.
- Static, noise and anything that changes every frame appear only inside breaks; clean frames are clean.
- Choose the palette for the content: paper and ink for a podcast, a dark lock screen for a thriller, faded Kodachrome for old footage, a navy dashboard for security. Neon cyan-magenta is one option, not the default.
- Type sits still and well set; the break is what moves it.
- Formats: 1080×1920 for short-drama and phone posts, 1920×1080 for intros and launches, 1080×1080 or 1080×1350 for feed posts and lyric cards.

## Sound

`G.sounds(glitches, duration)` gives every break its sound on the same frame:
- sharp breaks → `data` (digital garbage) or `blip`, `crunch` for blocks, `static` for drops and rolls, `smear` under a mosh, `crtoff` / `crton` for the set;
- and they break the music and recordings: `cut` (silence for the break), `stutter` (the last slice repeats — on freeze, stutter, burst), `crush` (bit-crushed — on blocks). `off` cuts everything to the end.

Add your own: `{ kind: 'cut', t, dur }` for a longer silence after a moment; `tick`, `tap`, `thud` and the rest of `sound.py` for clocks, keys and landings; `{ kind: 'audio', src: 'clip.mp4', t, from, dur, v }` for the footage's own sound (it gets cut and stuck with the music). `"sound": false` on a break leaves it silent.

Music: small and electronic or plain — a synth bass and an electric piano, a few piano notes over a soft pad, a vibraphone line over upright bass — in the middle register, sitting under the picture. It stops when the picture breaks and comes back after; it never pulses or flashes with the picture.

## Examples

Read them for how the ideas are carried out, then make your own piece on your own content — not a variation of the nearest example.

- `examples/huidang.html` — 《回档》第 1 集 (vertical, Chinese short drama): a dark lock screen, the clock ticking to 03:17:00; a `hit` and it reads 03:16:55 again; 「第七次了。」; two frames `flash` the title before it exists; the second time the clock reaches 3:17 a `burst` brings in 回档 in red, which holds clean; a `drop`, and the lock screen is back at 03:16:55. Sparse piano over a pad, clock ticks, the music cut on every break.
- `examples/houtai-jincheng.html` — 《后台进程》第 58 期 (landscape, Chinese tech podcast): paper white, a terminal typing `DROP DATABASE orders;` — on Enter, `blocks` and the music stops dead; `Query OK, 0 rows affected`; `# 等等……这台是生产库` typed into the silence; a `mosh` drags the terminal into the episode card 「删库之后的 72 小时」, music comes back; one small `shift` on “72”. No scanlines.
- `examples/wickett.html` — Wickett (square, English security launch): this morning's sign-ins in a table; one row from Kaunas on a Windows laptop keeps breaking up — `blip`, `tear`, `blocks`, `hit`, all `area`-limited to that row — until it is boxed BLOCKED and goes still; the end card is clean. Pad and quiet bass; the bad row cuts the music.
- `examples/long-way-over.html` — Marlowe Street, “The Long Way Over” (4:5, English lyric card on footage): 1941 Kodachrome of the San Francisco harbor and the Bay Bridge (`media/bay-1941.mp4`, Prelinger Archives, public domain) on a curved, scanlined set; it switches `on`, four lyric lines, a `mosh` across the cut from harbor to bridge, a `freeze` on “home”, a `tear` into the band and release card, and the set switches `off`. Electric piano, upright bass, a vibraphone line.

## Check your output

- **it glitches all the time** — cut it to the 3–6 moments that change something; the clean stretches are most of the video.
- **breaks with nothing changing** — move each break onto a cut, a word, a key press, a reveal, or delete it.
- **every break looks the same** — vary kind, length, `amt`, `area`; a small `blip` here, a `burst` there.
- **the whole screen flashes or dims on a break** — use `area`, lower `amt`, or a kind without `drop`/`invert`.
- **breaks on the beat** — move them to the picture's hits; the music stops for a break instead of hitting it.
- **static or grain on clean frames** — noise only inside breaks; `look.grain` is still, not per frame.
- **a mosh that looks like random squares** — put it on a real cut between two different pictures, 0.8–1.5 s long.
- **the off has no line or dot** — give `off` 0.5–0.8 s and leave the last 0.5 s of the video black.
- **sound and picture apart** — take the sounds from `G.sounds`, never typed times.
- **the copy talks about glitches** — write what the show, product or song would actually say.
