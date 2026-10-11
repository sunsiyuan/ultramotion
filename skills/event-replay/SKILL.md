---
name: event-replay
description: Event Replay (大事件复盘) motion style — one moment in history, stretched and replayed from real data, in the manner of Neil Halloran's The Fallen of World War II and the New York Times' visual investigations. It starts from the whole (the year, the tournament, the continent) and narrows to the moment; a big clock keeps running while an hour or a day is stretched to twenty seconds; a line carries time across the screen with a glowing head; the clock stops on the one minute that matters; a number becomes scale you can see (one cell = $10M, one figure = 10 people); the aftermath closes it, with the source in the corner. Black ground, one accent colour. Use for 大事件 / 复盘 / 那一天 / crash, earthquake, typhoon, election night, a final, an accident timeline, rendered from code to mp4 with music.
---

# Event Replay

`event.js` draws the clock, the lines, the maps (on real relief, tilted, with regions raised as blocks) and the unit grids on a canvas; `render.py` renders the page to mp4 with the score from `sound.py`, played on sampled instruments. Open any file in `examples/` in a browser through a local server (`python3 -m http.server`) and it plays; `render.py` loads them directly.

## What the viewer wants

"What happened that hour?" Not a slideshow of facts about the event — the event itself, happening again, at a speed you can follow. Every second of the video is a real moment, and the clock on screen says which one.

Someone who has never heard of it follows the whole story:
- The first seconds say what this is and why it was big — "Silicon Valley Bank, the 16th-largest bank in the US", "the strongest typhoon to hit Hainan in a decade".
- Each beat has a headline in plain words saying what just happened — "The bank announces a $1.8B loss", "Depositors pull $42B in one day", "California shuts the bank" — then the number, the clock and the cells that show it.
- Cause, the moment, what it led to, in that order; the last beat says what it all came to.

## Workflow

1. Copy `event.js`, `render.py`, `sound.py`, `relief.py` into your project; work on the copies.
2. **Find the moment.** Ask what the people who lived through it remember: the minute bitcoin hit $102,000, the second the ground started shaking, the call that put a candidate over 270, the home run that tied Game 7. That moment is where the clock stops. The daily chart usually hides it — get data fine enough to see it (*Data*).
3. **Get the data and write down where each number comes from.** Save the raw files next to the page (`data/`) and load them with `Replay.withData`.
4. **Lay out the time.** Write the warp: which hours fly by, which minutes are stretched, where the clock holds, how the aftermath flies forward (*Time*).
5. Pick what carries time on screen — a line, a map with a spreading front, a bracket, states rising — what makes the scale visible, and how the camera moves from the whole to the moment. For a map, make the ground with `relief.py`.
6. Write the score (*Sound*).
7. `python3 render.py page.html --preview --at 1,5,10,15,20,25,30` and look at the contact sheet; open one frame full size.
8. `python3 render.py page.html --out video.mp4`.

Needs ffmpeg, fluidsynth (`brew install fluid-synth` / `apt install fluidsynth`; the soundfont downloads itself on first use) and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`; uses Playwright's Chromium or the installed Google Chrome. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox.

## How it moves

0. **From the whole to the moment.** Open on the widest view of the story, then narrow, in one continuous move: the year's price line dives into one night, then one minute; twelve teams in a bracket become two, the series becomes Game 7, Game 7 becomes one swing; the continent pushes in to the country, the country to the fault.
1. **A moment stretched.** A big clock at the top keeps running the whole video — wall time in the place it happened, a match clock, seconds since the quake. Its speed changes: two hours in four seconds, then forty minutes in eleven.
2. **A line carries time.** A price line drawn minute by minute, a rupture tearing along a fault, a wave front spreading, a step line of goals, states lighting up as they are called. Its head glows and the camera follows or pushes in on it.
3. **Stop on the minute that matters.** The clock holds (two time keys with the same real time) and only that one thing is marked: the low, the epicentre, the equaliser, the call.
4. **Scale you can see.** A big number becomes things you can count: cells falling into a block, a crowd of small figures, a bar crossing a line. Say what one unit is.
5. **The aftermath.** Time flies forward — two days, six days, until the last state is called — and the numbers that came later close the video: casualties, where the price settled, aftershocks, the final count.

One continuous picture. The camera pushes in, pulls out, tips a map down to show its relief, turns a little; panels fade; nothing cuts to a new slide.

## Time

`Replay.create({ time: [[videoSec, realMs], …] })` maps video seconds to real time; `E.realAt(t)` gives the real time to draw, `E.tAt(real)` gives the video second a real moment arrives (to time a sound or a label to it).
- **A day or a night in ~30 s:** a fast approach, one stretch over the decisive hour, a hold of 2–8 s, a fast aftermath.
- **Seconds in ~15 s** (an earthquake, a crash): the stretch is the whole middle; the clock shows seconds.
- **A game:** the game's own clock (match minutes, innings) or the wall clock where it was played; the deciding stretch slowed, the rest flown over; a line of win probability, if the league publishes it, carries the whole game.
- Leave the clock running during the stretch; hold it still only on the moment.

## Data

Real data, in its finest grain:

| Event | Where |
|---|---|
| Crypto prices | Binance `api/v3/klines?interval=1m` (no key); other exchanges' public kline APIs |
| Stocks, indices | Yahoo Finance chart API (`interval=1m` for the last 7 days, `5m` / `1d` further back), Stooq CSV |
| Liquidations, funding | CoinGlass (usually only daily or 24h totals in public pages) |
| Earthquakes | USGS FDSN event API (`earthquake.usgs.gov/fdsnws/event/1/query?eventid=…&format=geojson`): time, epicentre, depth, ShakeMap intensity contours, PAGER impact text; the same API with `starttime/endtime/latitude/longitude/maxradiuskm/minmagnitude` for aftershocks |
| Typhoons, hurricanes | JTWC / NHC best-track, IBTrACS |
| Elections | the official result tables; race-call times from AP ("AP Race Call: … wins …" stories carry the minute) |
| Sports | the official match report (goal minutes, substitutions, penalty order); MLB Stats API (`statsapi.mlb.com`, no key: every play with its time, and win probability per play); league schedule/results APIs |
| Map shapes | world-atlas / us-atlas TopoJSON (`Replay.topo`), Natural Earth |
| The ground | `relief.py --box w s e n` — shaded relief from AWS Terrain Tiles (no key) |

- **When sources disagree, pick one, say which, and keep to it** — "CoinGlass, all exchanges, 24 h" next to the number. Two baselines gave the 1011 liquidations as $15B and $19B without saying why.
- **Don't make up the grain you don't have.** If liquidations exist only as a day total, show the day total after the clock stops, not cells falling minute by minute. If the goals are known only to the minute, put them in the middle of the minute. If the real order isn't known, colour by a rule you state (poll closing time) and say so in the source line.
- Search for the exact moment (the call time, the low and its minute, the rupture length) and check it against a second source before it goes on screen.
- The source line at the bottom names each source and rule.

## How it looks

- Black or near-black ground; one accent colour (red) for the moment and its head; everything else grey-white. Two accents only when the event has two sides (teams, parties), in their own colours.
- Type in three sizes: the clock and the key number, big, with fixed-width digits (`Replay.counter`, `Replay.clock`); the beat's headline, large and white, next to them; units, labels and sources small and grey.
- Maps: dark shaded relief (real mountains and valleys), borders faint, tipped back 30–55° once the camera is close; what happened is the only bright thing on them — a glowing rupture, intensity lit from below, regions rising as blocks whose height is the number (`extrude`).
- Film grain and a soft vignette over everything (`finish`).
- Vertical 1080×1920: clock at the top, the line or map in the middle, the scale or the sentence below, source at the very bottom. Landscape 1920×1080: clock top left, the map across the middle, the tally across the bottom.

## The page

```js
const R = Replay;
window.__scene = R.withData(['data/prices.json'], ([K]) => {                     // JSON next to the page, loaded before drawing
  const E = R.create({ width: 1080, height: 1920, time: [[0, start], [4.5, a], [15.5, low], [24, low], [30, after]] });
  const draw = (c, t) => {
    const now = E.realAt(t);
    R.clock(c, now, { x, y, size: 150, tz: 8, format: 'HH:MM' });              // tz in hours (6.5 works); 'HH:MM:SS'; { since } for elapsed seconds
    const P = R.line(c, series, now, { box: [x0, y0, x1, y1], range: { t: [t0, t1], v: [v0, v1], log }, head, fill, grid: { values, format } });   // [[time, value]], drawn up to now; P.X(t), P.Y(v), P.v
    R.mark(c, at, value, now, P, { label, sub, side, dy, a });                   // pass `a` while the clock is held
    R.counter(c, value, { x, y, size, prefix, suffix, decimals, align });
    R.units(c, n, { total, x, y, cols, size, gap, shape: 'square' | 'person' });  // grows upward from y; returns { top }
    const Pm = R.proj(R.lerpView(viewA, viewB, u));                              // views: { center: [lon, lat], scale: px per degree, W, H, tilt (deg), rotate (deg), dx, dy }
    R.basemap(c, reliefImg, [w, s, e, n], Pm);                                    // the relief.py image, following the view, tilt and turn included
    R.land(c, R.topo(tj, 'countries'), Pm, { fill, stroke, style: p => ({ fill }) });
    R.extrude(c, polys, Pm, { height: p => px, top: p => colour, side: p => colour });   // regions raised as blocks, drawn far to near
    R.wave(c, Pm, at, [lon, lat], now, { speed: 3.5 });                          // km/s
    R.place(c, Pm, [lon, lat], '曼德勒', { a, sub, side });
    R.text(c, '…', x, y, { size, color, a, align }); R.source(c, '数据：…');
    R.finish(c, t);                                                              // grain + vignette, last
  };
  return R.scene(E, draw, { duration: 34, music: { notes, dynamics, duck }, sounds: [...R.ticks(E, { every: 60e3 }), …] });
});
```

`withData` loads JSON and images (`.jpg`, `.png`). Helpers: `seg(t, a, b)` (0→1 between a and b), `io`, `oc`, `pop(t, t0)`, `lerp`, `shade(colour, k)`.

## Examples

Four events that differ in what carries time and in what the camera does. Read them for how the ideas are carried out, then replay your own event — not a variation of the nearest example.

- `examples/crash-1011.html` — 1011, the biggest liquidation day in crypto (vertical, Chinese): bitcoin's whole 2025 on a daily line up to the record high; the window dives into the night of October 10 while the clock turns into Beijing minutes; 04:40–05:20 stretched, one tick a minute, as the line crashes; the clock holds on $102,000 while the day's $19B of liquidations falls in as a wall of 1,900 cells; the camera backs out to the weeks around it.
- `examples/quake-myanmar.html` — Myanmar M7.7 (vertical, Chinese): from Asia down to central Myanmar on real relief, the map tipping back; a second hand ticking; the fault tears 500 km south along the valley, the wave front lights the shaking intensity behind it, cities light up as it reaches them, the camera follows south to Bangkok and holds; six days of aftershocks drop in on their own minute; the map goes dark and the dead become 380 figures, one for ten people.
- `examples/worldseries-2025.html` — the 2025 World Series (vertical, English): twelve teams in the October bracket, series ending on their real dates, the Dodgers' path and the Blue Jays' lighting up until they meet; seven game cards, Toronto one win away; the camera dives into Game 7 and the wall clock in Toronto takes over; one line carries it — the Dodgers' chance to win, play by play, from MLB's own feed; innings 1–8 fly, the top of the 9th is stretched to Toronto at 90.8% and the clock holds on the home run that tied it; the bases-loaded bottom of the 9th, the 11th-inning home run, the double play.
- `examples/election-2024.html` — US election night (landscape, English): the country from above, then tipped down over relief; each state rises out of the map when it is decided, its height its electoral votes; the swing states wait flat and outlined until the AP calls them; 267 at 3 AM, the hold at 5:34 AM as the camera pushes in on Wisconsin; three days fly to 312–226.

## Sound

A documentary score on sampled instruments (`piano strings cello bass choir horn harp celesta timpani pad`), written as notes on the page — `{ t, m (MIDI), d (seconds), inst, v }` — plus:
- `dynamics: { strings: [[t, level], …] }` — how loud an instrument plays over time: swell into the moment, fall away after.
- `duck: [[t0, t1, level]]` — pull the music under something.
- The clock's own sound: `Replay.ticks(E, { every })` puts a tick on each step of the real clock, so the ticking speeds up and slows down with time itself.

Shape it like the picture: something quiet and open before; in the stretch, a pulse that tightens and builds (eighth notes in the cellos, a line sinking with the price, a timpani roll into the moment); on the moment an `impact` and one sustained high note over a dark chord, nearly nothing else; after, a slower piano line over strings, a choir underneath for loss, horns and a major chord for a win. Sounds: `tick tock` (the clock), `impact` (the moment), `boom` (a goal, a call), `heartbeat`, `rumble` (with `dur`, shaking), `riser` (with `dur`, into the moment), `whoosh` (with `dur`, the camera flying), `tap thud` (cells, states).

## Check your output

- **it starts at the moment** — open wider: the year, the tournament, the continent, and narrow to it.
- **slides** — one title and one chart per screen, cut to the next — keep one picture and let time move it.
- **the clock never changes speed** — stretch the decisive minutes and fly over the rest.
- **a number with no unit you can see** — make it cells or figures, and say what one is.
- **a flat map on a black ground** — lay relief under it, tip it back once the camera is close.
- **music that loops the same bar** or stays at one loudness — give it sections that follow the picture and a `dynamics` curve.
- **labels on top of each other at the hold** — the moment's label, the counter and the scale each need their own space; fade what they replace.
- **a number without a source**, or two numbers from different sources for the same thing.
