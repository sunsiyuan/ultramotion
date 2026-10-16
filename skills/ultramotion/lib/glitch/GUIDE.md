# Glitch

Glitch (故障) — makes a VIDEO (mp4 with sound) where the digital signal breaks: RGB channels pulling apart, the frame torn into sliding horizontal bands, compression blocks, pixel-sorted streaks, static, frozen or skipping frames, a datamosh where one picture is dragged into the next, a CRT switching on and off. How much it breaks comes from what the piece is for — from one bad moment in a thriller title or a security launch to a club night, a track, an esports opener, a streetwear drop or a cyberpunk title where the whole thing is a broken signal locked to the music. Works on type, posters, graphics, photos and the user's own footage. In the manner of the Mr. Robot title cards, the Cyberpunk 2077 E3 2018 logo reveal, the datamoshed Welcome to Heartbreak video and Weirdcore's videos for Aphex Twin.

`glitch.js` takes the picture you draw on a 2D canvas each frame and breaks it with one WebGL pass, following a list of breaks you place in time; the same list gives the sounds. `render.py` renders the page to mp4 with the sound from `sound.py`, and splits any footage the page uses into frames first. Open any file in the template folders (`templates/`) through a local server (`python3 -m http.server`) and it plays; `render.py` loads them directly.

## Workflow

1. Copy `lib/glitch/glitch.js` into your project; work on the copies.
2. Read the content: what the piece is for, where it will be posted, who watches it — and from that, how much it breaks (*How much*).
3. Draw the clean picture as a function of time — type, layout, photos, footage — and watch it play clean first.
4. Write the music or the sound first when the piece runs on music; the breaks follow its hits.
5. Place the breaks (*How it moves*, *Kinds*), and the sound with them (*Sound*).
6. `python3 $SKILL/render.py page.html --preview --at 2.4,2.47,2.53,5,8.1` — put times on the frames of each break, and on the frames between.
7. `python3 $SKILL/render.py page.html --out video.mp4`.

## What to make

The picture is the content — the event, the record, the product, the show, the user's photo or footage — and the signal breaks over it. The copy says what the show, product or song would say, never something about glitches.

What the picture is made of:
- **Type and posters** — a club night, a lineup, a release date, a title, lyrics; big type that the break tears, recolours and re-lays.
- **Photos** — a portrait, a product, a sculpture, a city, an album cover; pixel sort melts the bright parts, blocks eat the dark ones, a mosh drags one photo into the next.
- **Footage** — the band's video, a match clip, a vlog, an old home movie; breaks on its cuts, freezes on a frame, mosh across the cut.
- **Screens and UI** — when the content is a screen: a terminal, a feed, a dashboard, a game HUD.

## How much

Pick the strength from the use, not from a habit.

- **One bad moment** — a thriller or short-drama title, a podcast or true-crime intro, a security product, a brand film's single transition. The picture is clean; one to three breaks, each on the moment the story turns (a command runs, a call drops, the wrong row shows up, the title arrives). The clean stretches carry it.
- **Breaks on the turns** — a lyric card, a song teaser, a game logo reveal, a series opener, a launch countdown. Breaks on every cut and reveal, some bursts close together (0.5–1 s apart) where something is being revealed, one long break (a mosh, a freeze, the set switching off) at the end.
- **A broken signal the whole way** — a club night or festival post, an electronic or rap single's visualizer, an esports or game-season opener, a streetwear drop, a cyberpunk or sci-fi title, a gallery night. The break is the look: the picture is bad from the first frame, with an `unstable` signal under everything and sharp breaks on top. Here the clean frame is the accent — a held clean beat on the drop, the title landing clean, a clean last frame.

Inside one piece the strength can move: clean → broken as the story falls apart; broken → clean when the product fixes it; a club post that gets worse when the track drops.

## How it moves

- **On the sound's hits.** Every break, light or heavy, starts on a sound — a word, a cut, a key press, a snare, a stab, a hi-hat roll, a drum fill. In a piece that runs on music, give `unstable` the music's hit times as `steps` (from the same notes list) so the broken state jumps on them.
- **Not a pulse.** Never the whole frame flashing, dimming or scaling on every beat. Hit the off-beat stabs, the rolls, the fills, the melody — and vary the kind, the `area` and the strength from hit to hit.
- **A break holds or changes something.** A sharp break lasts 1–4 frames and lands on a change (the clock jumps, the title arrives, the colour flips, the shot cuts); an `unstable` state holds for a few frames to a beat and then jumps — it is a signal stuck in a bad state, not noise re-rolled every frame.
- **Density follows the music or the story.** Sparse in the intro or the calm part, denser into the fill, heaviest after the drop or the reveal, then the stop.
- **Let the words read.** Names, dates, prices and titles each get a moment where they read — they arrive with a break and then sit, or the signal around them stays bad while their slab holds.
- **Narrow it.** When one thing is wrong — a row, a word, a face — `area` the break to it.
- **The end.** A long break (a mosh into the last shot, a freeze with the music skipping, the set switching off, static to black), or a hard stop into the first clean frame.

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
| `unstable` | a bad signal over a whole span (`d`): bands shifted, channels apart, blocks, rows repeating, now and then sorted; one broken state holds, then jumps to another — on `steps: [t, …]` (the music's hits) or every `hold: [min, max]` frames; `rest` (0–1) how often a state is clean; `fx: {…}` to choose the mix | 3 s |
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

A heavy piece is usually one or more `unstable` spans laid under the whole video (a new span where the strength changes — the intro, after the drop) with sharp kinds on top of it; the sharp ones win while they last.

- `draw(c, t)` must depend only on `t`. The library calls it with the content time — a `freeze`, `stutter` or `flash` changes which `t` it gets — and again with the frame before a `mosh`.
- Helpers: `G.typed(str, t, t0, cps)` (typed out), `G.decode(str, t, t0, dur)` (scrambled characters settling into the text), `G.cells(c, str, x, y, cell, align)` (fixed-width digits that don't wobble), `G.cover(c, img, box)`, `G.fonts([...])`, timing `seg io sm oc lerp`, `G.hash`, `G.rng(seed)`.
- `python3 $SKILL/render.py frames clip.mp4 [--fps 30 --width 1920]` splits footage by hand; `render.py page.html …` does it for every `G.footage('…')` it finds.

## How it looks

- `look` is the screen, the same on every frame: `scan` (scanlines, 0.08–0.25; `scanPx` their spacing), `curve` (CRT bulge, 0.08–0.15), `vignette`, `ghost` (a faint echo to the right), `bloom` (bright parts glow), `chroma` (a constant 1–2 px colour fringe), `mono`, `grain` (still grain, the same every frame). Leave all of them at 0 for a clean modern piece; use them when the picture is meant to be on a set or a tape.
- Static and noise appear only inside breaks; in a piece that is broken the whole way, the signal is bad but the screen texture (`look`) stays still.
- Choose the palette for the content: a loud flat colour and black type for a club poster, grey marble and one ink colour for a drop, paper and ink for a podcast, faded Kodachrome for old footage, a dark set for a thriller. Neon cyan-magenta on black is one option, not the default.
- Type sits still and well set; the break is what moves it. A poster can re-lay itself between sections — the break is the door between two layouts.
- Formats: 1080×1920 for short-drama, Reels, Stories and 抖音, 1080×1440 for 小红书, 1920×1080 for intros and launches, 1080×1080 or 1080×1350 for feed posts and lyric cards.

## Sound

`G.sounds(glitches, duration)` gives every break its sound on the same frame:
- sharp breaks → `data` (digital garbage) or `blip`, `crunch` for blocks, `static` for drops and rolls, `smear` under a mosh, `crtoff` / `crton` for the set;
- and they break the music and recordings: `cut` (silence for the break), `stutter` (the last slice repeats — on freeze, stutter, burst), `crush` (bit-crushed — on blocks). `off` cuts everything to the end.

Over a track that has to keep playing (a club post, a visualizer), use `G.sounds(glitches, duration, { music: false })`: the breaks keep their own noises and leave the music whole; break the music only where you choose (a `freeze` that skips the beat, a stop before the last chord). `unstable` makes no sound — the music is its sound.

Add your own: `{ kind: 'cut', t, dur }` for a longer silence after a moment; `tick`, `tap`, `thud` and the rest of `sound.py` for clocks, keys and landings; `{ kind: 'audio', src: 'clip.mp4', t, from, dur, v }` for the footage's own sound (it gets cut and stuck with the music). `"sound": false` on a break leaves it silent.

Music follows the use. Under a title or an intro: small and plain — an electric piano over a synth bass, a few piano notes over a pad, a vibraphone line over upright bass — in the middle register; it stops when the picture breaks and comes back after. When the piece runs on music: the beat the event or the scene would play — techno for a club night (kick, off-beat hats, a clap, a rolling synth bass, a chord stab on the off-beats), half-time with hi-hat rolls and a sub for a drop or a rap single — and the breaks ride its stabs, rolls and fills. Either way the picture never pulses with the kick.

## Examples

Read them for how the ideas are carried out, then make your own piece on your own content — not a variation of the nearest example.

- `templates/glitch-podcast-intro/houtai-jincheng.html` — 《后台进程》第 58 期 (landscape, Chinese tech podcast intro; one bad moment): paper white, a terminal typing `DROP DATABASE orders;` — on Enter, `blocks` and the music stops dead; `Query OK, 0 rows affected`; `# 等等……这台是生产库` typed into the silence; a `mosh` drags the terminal into the episode card 「删库之后的 72 小时」, music comes back; one small `shift` on “72”. No scanlines.
- `templates/glitch-lyric-card/long-way-over.html` — Marlowe Street, “The Long Way Over” (4:5, English lyric card on footage; breaks on the turns): 1941 Kodachrome of the San Francisco harbor and the Bay Bridge (`media/bay-1941.mp4`, Prelinger Archives, public domain) on a curved, scanlined set; it switches `on`, four lyric lines, a `mosh` across the cut from harbor to bridge, a `freeze` on “home”, a `tear` into the band and release card, and the set switches `off`. Electric piano, upright bass, a vibraphone line.
- `templates/glitch-club-poster/pendi.html` — 盆地 第 19 夜 (3:4, a Chengdu techno night posted on 小红书; broken the whole way): a type poster, black 兰亭黑 on signal red; `unstable` from the first frame, its state jumping on the chord stabs; the three DJs each torn in with an `area`-limited `tear`; during the snare fill every snare is a new state and the bright type sorts; on the drop a `burst`, the poster flips to red on black and re-lays as date, lineup, address and prices, worse than before (steps on stabs and bass); the last chord rings over the first clean frame. Techno at 128 bpm; `G.sounds(…, { music: false })`.
- `templates/glitch-streetwear-drop/lowtide.html` — Lowtide Supply, Capsule 07 “Marble” (9:16, an LA streetwear drop on Reels; broken the whole way, on photos): four marble heads from the Met (`media/met-*.jpg`, Open Access, public domain) in grey, type on cobalt slabs; `unstable` jumping on the plucked line, the hi-hat rolls and the snare; each head `mosh`ed into the next on a snare, the marble `sort`ed into streaks under the long notes; the date and place arrive with the last head; it `freeze`s with the beat skipping, static, black. Half-time 140 with a sub and a plucked line in E minor.

## Check your output

- **the strength doesn't fit the use** — a club post that is clean most of the time, or a thriller title that never stops shaking: go back to *How much*.
- **breaks with nothing under them** — move each break onto a sound: a word, a cut, a key press, a stab, a roll, a fill.
- **every break looks the same** — vary kind, length, `amt`, `area`; a small `blip` here, a `burst` there; an `unstable` span with one mix all the way through needs sharp kinds on top and a change of strength somewhere.
- **flicker instead of a broken signal** — states re-rolled every frame read as noise; let them hold until the next hit.
- **the whole screen flashes, dims or scales on the beat** — take the breaks off the kick; use `area`, a lower `amt`, or a kind without `drop`/`invert`.
- **the words never read** — give each name, date and price a moment where it holds.
- **static or grain on clean frames** — noise only inside breaks; `look.grain` is still, not per frame.
- **a mosh that looks like random squares** — put it on a real cut between two different pictures, 0.5–1.5 s long.
- **the off has no line or dot** — give `off` 0.5–0.8 s and leave the last 0.5 s of the video black.
- **sound and picture apart** — take the sounds from `G.sounds` and the `steps` from the notes list, never typed times.
- **the copy talks about glitches** — write what the show, product, event or song would actually say.
