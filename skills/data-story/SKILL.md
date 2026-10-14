---
name: data-story
description: "Data Story (数据走势) — turns years of real data into a finished data-animation VIDEO (mp4 with music), not a static chart. Use it whenever the user asks for a data animation / 数据动画 / 数据可视化视频 / animated chart video / 历年走势 / 排名变化 / 动态条形图 / 如果当年买了 — a stock or coin over ten years, births, GDP, prices, rankings, any number over years — rendered from code to mp4. In the manner of Hans Rosling, the New York Times and Financial Times chart animations: decades fly and slow where the story is, the axis grows as the data arrives, only the point being talked about is named, the number rolls with the line, it stops on the record, the overtake, the crash, and every number is set against the right comparison — the market, inflation, the other way of counting — with the source in the corner."
---

# Data Story

`trend.js` draws the axes that grow with the data, the line, the columns, the ranking race, the flags, the rolling numbers and the year behind everything on a canvas; `render.py` renders the page to mp4 with the score from `sound.py`, played on sampled instruments. Open any file in `examples/` through a local server (`python3 -m http.server`) and it plays; `render.py` loads them directly.

## What the viewer wants

"How did this change, and what should I remember?" Not a chart that slowly fills in — a story told by the data, at a speed you can follow, with a clear end.

Someone who doesn't follow the subject gets it:
- The first seconds say what is measured and over what span — "How many babies China has had each year since 1949", "$1,000 into Nvidia ten years ago".
- Each turning point has a plain headline saying what happened there — "The crypto-mining boom ends: −56% in under three months", "2010: passes Japan, second in the world" — while the chart shows it.
- The end says what it all came to, as a comparison a person can feel.

## Workflow

1. Copy `trend.js`, `render.py`, `sound.py` into your project; work on the copies.
2. **Find the finding, not just the topic.** Plot the data once for yourself first, then ask what a data desk would ask before publishing:
   - **Compared with what?** A stock's ×139 means little until the same $1,000 in the whole market (×3.7) runs beside it; births mean more next to deaths.
   - **Per what?** Totals move with the population behind them: cars per 1,000 people, crimes per 100,000, a budget per resident, a share of everyone who could have.
   - **Adjusted for what?** Money over decades in today's money (CPI), or a home price in years of median income; a nominal record may not be a real one.
   - **Counted how?** Current US dollars move with exchange rates (Germany passing Japan in 2023 came with the yen losing a quarter of its value); purchasing power parity counts differently (China passed the US in 2014). Revisions, definitions, what is left out (dividends, taxes).
   - **What does it say?** Write the headline as the finding — "Nvidia ×139, the market ×3.7", "2022 年起，每年死的比生的多" — not the topic ("Nvidia stock price").
   Then pick four to six moments where the story turns — the record, the crash, the overtake, the crossing, the echo of an earlier peak, the newest point being the lowest ever; those are where time slows and stops.
3. **Get the data, keep the raw file next to the page** (`data/`), load it with `Trend.withData`, and write down where it comes from (*Data*).
4. **Compute every number on screen from the data file in the page** — the drawdown, the multiple, the rank, the "less than 1961 by 3.98 million". Don't type a number that the data can give you.
5. **Lay out the time.** Write the warp: which years fly, which slow down, where the clock holds (*Time*).
6. Pick what carries time (*Forms*), the look (*How it looks*), and how the camera moves.
7. Write the score (*Sound*).
8. `python3 render.py page.html --preview --at 2,6,10,14,18,22,26,30` and look at the contact sheet; open one frame full size.
9. `python3 render.py page.html --out video.mp4`.

Needs ffmpeg, fluidsynth (`brew install fluid-synth` / `apt install fluidsynth`; the soundfont downloads itself on first use) and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`; uses Playwright's Chromium or the installed Google Chrome. **If you're in a sandbox and the browser won't start**, ask for permission to run it outside the sandbox.

## How it moves

1. **Time is the main character.** The data's clock runs the whole video, shown as a big faint year behind the chart (`Trend.year`) and as the date under the number. Quiet stretches fly by; the clock slows into each turning point and holds on it.
2. **The axis grows with the data.** The top follows the highest value so far, so a record pushes the frame open; the time window widens as the years arrive, so the head of the line is always near the right edge. Grid lines fade in and out as the scale changes (`Trend.grid` does this).
3. **Only one thing is named.** The point, the bar or the columns being talked about light up in the one accent colour with a flag; everything else stays grey. When the story moves on the flag fades — or stays faint, if the end will come back to it.
4. **The number rolls with the head.** A big number at the top follows the data every frame — fixed-width digits, never jumping a place (`Trend.counter`) — with the date or year it belongs to under it.
5. **Stop on the moment.** The record, the overtake, the bottom of the crash, the day of the news: the clock holds there for 1–3 s while the flag and headline land.
6. **Make the size felt.** End on a comparison: what $1,000 became; this year against the record year, side by side in the accent colour; a line at today's level drawn back across every earlier year; "fewer than in the famine year"; the share of the leader.
7. **Change the scale on screen when the data spans orders of magnitude.** Show the linear chart first so the viewer sees the early years flatten, then turn it into a log scale (`frame({ log })` from 0 to 1) and say what a step now means ("every line is ×10").

The picture keeps moving: a slow push-in across the whole video, the window widening, bars swapping places. Nothing cuts to a new slide.

## Forms

What carries time — pick by the data:
- **A line** — prices, rates, temperatures; daily or monthly points (`Trend.line`), with the fall from the running peak shaded (`Trend.drawdown`) and flags on the events.
- **Columns, one per period** — a count per year: births, harvests, launches (`Trend.columns`); the column for the current year grows while the clock passes through it.
- **A stack** — parts of a whole handing over to each other: formats, energy sources, where the money comes from (`Trend.stack`); the names sit inside their layers where they fit, and a legend that stays put under the chart (`Trend.legend`, with each layer's share of the year) names the thin ones. A stack can change unit on screen (dollars of the day → today's dollars) by recomputing the layers each frame.
- **A ranking race** — who leads over the decades: GDP, market caps, medal tables (`Trend.race`); hold on the overtake; an entry outside the top N that the story follows gets its own row under the list with its rank.
- **Bubbles** — two measures and time (Rosling): place each with `Trend.at(series, now)` on a `Trend.frame`, size by a third value, a faint trail behind the one being named.
- **Units** — people or things counted as cells or figures (`Trend.units`), for "one figure = 10,000 people".

## Time

`Trend.create({ time: [[videoSec, dataTime], …] })` maps video seconds to data time — years as numbers (`1963`) or dates as ms (`Trend.date('2016-10-12')`); `E.realAt(t)` gives the data time to draw, `E.tAt(x)` gives the video second it arrives (to time a note, a flag or a headline to it). Two keys with the same data time hold the clock.
- **Decades in ~30 s:** a slow first second or two on the start, fly the quiet decades at 3–6 years a second, slow to ~1 year a second around each turning point, hold 1.5–3 s on each, end with a 5–8 s hold for the comparison.
- **Ten years of daily prices in ~35 s:** fly the rises, slow through each crash so the fall can be watched, hold on the bottom and on the news days.
- **A ranking:** hold on each overtake; slow the years just before it so the bars visibly close in.
- One value per year: the column (or bar) for year y grows while the clock runs from y to y + 1; `Trend.current(series, now)` gives the year the clock is in and a value that rolls to it — use those for the counter and the year label, so they always agree with the chart.

## Data

| Data | Where |
|---|---|
| Country statistics (GDP, population, life expectancy, CO₂ …) | World Bank API (`api.worldbank.org/v2/country/all/indicator/NY.GDP.MKTP.CD?format=json&date=1980:2025&per_page=20000`; drop aggregates via `/v2/country`), Our World in Data grapher CSV (`ourworldindata.org/grapher/<chart>.csv`) |
| A country's own statistics | the national statistics office's yearbook and annual releases; Wikipedia tables that cite them (`en.wikipedia.org/w/api.php?action=parse&page=…&prop=wikitext&section=…&format=json`) when the office's site can't be reached — check two years against the office's own release |
| US stocks | Nasdaq (`api.nasdaq.com/api/quote/<TICKER>/historical?assetclass=stocks&fromdate=…&todate=…&limit=9999`, browser User-Agent; 10 years of daily closes, split-adjusted) |
| Crypto | Binance `api/v3/klines` (no key), CoinGecko `market_chart`, Coin Metrics community CSV |
| US macro (CPI, rates, unemployment) | FRED CSV (`fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL`, no key) |

- **Use the figure the audience already knows.** For China's births that is the statistics office's 9.02 million for 2023, not a UN estimate of 8.9 million.
- **One source per number, named at the bottom**, with the rule behind it — "price only, split-adjusted; dividends not counted", "当年公布数", "current US$".
- **An entity exists only from its first data point** (`Trend.at(series, x, true)` gives NaN before it; `race` does this itself). Know who is missing — the World Bank has no Soviet Union, so a GDP ranking before 1990 is wrong — and start where the comparison is fair.
- Search for the facts in the headlines (what happened that day, the policy year) and check them against a second source.
- When a period's number is a projection or provisional, say so or leave it out.

## How it looks

The look follows the subject and the platform — the examples are a newspaper page, a trading screen at night and a deep-blue ranking. In every one:
- The grid is the faintest thing, the data the brightest. One accent colour for what is named; everything else grey. A second colour only for a real second side (up green / down red on a price).
- Three type sizes: the rolling number, big, fixed-width digits; the beat's headline, large, next to it; labels, axis values and the source small and quiet. A serif headline gives the newspaper look; a heavy sans the screen look.
- A huge faint year behind the chart.
- Vertical 1080×1920: number at the top, headline under it, the chart in the middle, the closing comparison under the chart, the source at the very bottom. Landscape 1920×1080: number top left, headline top right, the chart across the middle and bottom.
- Light grain over everything (`finish`); a soft vignette on dark grounds.

## The page

```js
const T = Trend;
window.__scene = T.withData(['data/series.json'], ([D]) => {                     // JSON next to the page, loaded before drawing
  const S = D.series;                                                              // [[time, value], …] sorted; years or ms
  const E = T.create({ width: 1080, height: 1920, time: [[0, 1949], [6, 1963], [8, 1963], [30, 2025], [36, 2025]] });
  const draw = (c, t) => {
    const now = E.realAt(t), [, hi] = T.extent(S, now);                          // the highest value seen so far
    const F = T.frame({ box: [x0, y0, x1, y1], t: [t0, t1], v: [0, hi * 1.15], log: 0 });   // log 0..1 morphs linear → log; F.X(time), F.Y(value)
    T.year(c, now, { x, y, size: 420, color });                                   // the big faint year; slides to the next one
    T.grid(c, F, { format: v => …, side: 'out' });  T.timeAxis(c, F, { every: 10 });
    T.columns(c, S, now, F, { color: (time, v) => … });                           // or:
    const head = T.line(c, S, now, F, { color, head, fill });  T.drawdown(c, S, now, F, { min: -.5 });
    T.race(c, items, now, { box, top: 10, format });                              // items [{ name, label, series, color }]
    T.stack(c, layers, now, F, { size });                                           // layers [{ name, series, color, ink }], bottom first; returns { top, at }
    T.legend(c, [{ name, color, value }, …], { x, y, cols });                       // a fixed key under the chart; value e.g. the share this year
    T.flag(c, F, time, value, { text, sub, color, side, dy, a });                 // a 0..1: fade it in on its moment
    T.labels(c, [{ y, text, color }, …], { x, fromX, minGap });                   // labels kept apart, with leaders
    const cur = T.current(S, now);                                                // { t, v }: the year the clock is in and a rolling value
    T.counter(c, cur.v, { x, y, size, prefix, suffix, decimals, format });
    T.text(c, '…', x, y, { size, color, a, align, rise }); T.source(c, '数据：…');
    T.finish(c, t);                                                               // grain + vignette, last
  };
  return T.scene(E, draw, { duration: 36, background, music: { notes, dynamics }, sounds: [...T.tick(E, { every: 1 })] });
});
```

Also: `T.at(series, x, strict)`, `T.upTo(series, x)`, `T.ticks(F)`, `T.units(c, n, { total, x, y, cols, shape: 'person' })`, `T.camera(c, { cx, cy, z })` (inside save/restore, for a push-in), `T.fmt.compact` (1.2K, 3.4B), `T.fmt.wan` (1.2 万, 3.4 亿), `T.fmt.money`; timing `seg(t, a, b)`, `io`, `oc`, `sm`, `pop`, `lerp`, `cl`.

## Examples

Five stories that differ in subject, form, look and format. Read them for how the ideas are carried out, then tell your own story with your own data — not a variation of the nearest example.

- `examples/births-china.html` — 中国每年出生多少人 (vertical, Chinese, newspaper page): one column per year from 1949, the number rolling at the top, a serif headline per turning point; deaths drawn as a thin dark line over the columns, so the two years it rises above them — 1960 and 2022 onwards — speak for themselves; the 1963 record held with a flag that stays faint, the 1987 echo of the 1963 generation, the 2016 second-child bump, the fall to 2025; the end lights 1963 and 2025 together, draws 2025's level back across every year and sets it against that year's deaths. The data plays the tune: each year's column sounds a note, lower for fewer births.
- `examples/nvidia-1000.html` — $1,000 in Nvidia ten years ago, against the market (landscape, English, dark trading screen): the same $1,000 in Nvidia and in the S&P 500, both rolling at the top, both lines drawn across ten years of daily closes; the two falls of more than half shaded from their peaks and held at the bottom; ChatGPT and the +24% day flagged; at mid-2024 the linear chart shows the market and Nvidia's first years flattened, then turns into a log scale where both climbs can be read; the end — Nvidia ×139, the market ×3.7, and what each cost on the way down — with the arithmetic and what isn't counted.
- `examples/music-formats.html` — What Americans spend on recorded music, 1973–2024 (vertical, English, dark): a stack of formats — vinyl, tapes, CD, downloads, streaming — handing over to each other, the year's total rolling at the top; the CD arriving, the 1999 peak, the fall to 2014, streaming bringing it back past 1999 and to a record in 2024, all in dollars of the day; then, held on 2024, the whole stack turns into 2024 dollars — 1999 rises to $27.5B, a dashed line at 2024's level runs back and 1977 stands above it too; the end per person. The data's own caveat is on screen: RIAA reports 2025 only at wholesale value, so the series stops at 2024.
- `examples/china-power.html` — 中国的电从哪里来，2000—2025 (vertical, Chinese, dark): the year's electricity stacked by source — coal at the bottom, then gas, nuclear, hydro, wind and solar on top — growing three times over in a decade; the first year coal fell, wind and solar passing hydro, solar passing wind, 2025 when the new demand came almost all from wind and solar; then the stack turns into shares — each year stretching to 100%, the axis changing from 万亿千瓦时 to percent — and coal's layer sinks from 78% to 55%; it turns back to electricity for the last line: coal is still 5.4 times what it was in 2000. Share and amount, side by side.
- `examples/gdp-race.html` — 世界 GDP 前十，1990—2025 (vertical, Chinese, deep blue): a top-ten race with every country grey and China red; China outside the ten gets its own row with its rank; holds on 2000, on 2005–2007 as it passes France, the UK and Germany, on 2010 when it passes Japan, and on 2023 when Germany passes Japan as the yen falls; the end sets the two ways of counting side by side — current dollars and purchasing power parity. Every year and share is computed from the data.

## Sound

A light score on sampled instruments (`piano pluck celesta marimba keys strings slowstrings cello pad bass timpani …`), written as notes on the page — `{ t, m (MIDI), d (seconds), inst, v }` — plus `dynamics: { inst: [[t, level], …] }` for how loud an instrument plays over time.
- **The data can play the tune:** one note per period at `E.tAt(period)`, its pitch from the value on a pentatonic scale, notes closer than ~0.1 s merged when the years fly by.
- Plucked eighth notes or a piano figure while the line climbs; thin it out to low strings or cello in the falls; a timpani note on the bottom; a bell (`celesta`) on a record or an overtake; one piano chord and a held note for the end.
- `Trend.tick(E, { every: 1 })` puts a soft tick on each year (or `'month'`, `'year'` for dates) so the ticking speeds up and slows down with the warp.
- Sounds: `tick tock`, `whoosh` (with `dur`, a scale change or a sweep), `riser` (with `dur`), `tap thud pop`, `ding chime sparkle`.
- Keep it light — piano, plucks, a pad; no full orchestra under a chart.

## Check your output

- **the chart fills in at one speed** — slow down into the turning points, fly the rest, hold on the moment.
- **a raw total or a nominal price standing alone** — set it against the market, the population, inflation, or the other way of counting, and say the finding in the headline.
- **every point is labelled** — name only what the headline is about; grey the rest.
- **a number on screen that isn't computed from the data file** — compute it in the page.
- **the counter and the chart disagree** (the counter shows 1964 while the 1963 column is held) — take both from `Trend.current` or the same `now`.
- **the axis jumps** — let the range follow `extent` (or the tallest standing column) instead of switching between fixed ranges.
- **the early years are flat against the bottom** — switch to a log scale on screen and say so.
- **labels on top of each other** — `Trend.labels`, or fade the old flag before the new one lands.
- **an entity in the chart before its data begins**, or a ranking that leaves out someone who existed (USSR before 1991).
- **a slide at the end** with a summary in text — end on the chart itself, with the comparison drawn on it.
- **a number without a source**, or a modelled estimate where the audience knows the official figure.
