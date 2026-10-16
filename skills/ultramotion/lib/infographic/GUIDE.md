# Infographic

Infographic (信息图) — turns \"what is it made of, who is bigger, where does the money go\" into an animated infographic VIDEO (mp4 with music), not a static chart. Use it whenever the user asks for an infographic animation / 信息图动画 / 如果世界是 100 个人 / if the world were 100 people / where a dollar goes / 钱花在哪 / parts of a whole / 比例 / 构成 / 结构 / 对比 / 谁比谁大 / unit chart / isotype / waffle chart video — a population, a budget, a household's spending, sales by kind — rendered from code to mp4. In the manner of \"Wealth Inequality in America\" and \"If the World Were 100 People\" and Neil Halloran's unit charts: one crowd of simple units (people, squares, coins, notes) stays on screen the whole time and re-forms for every question, units walking their own paths and settling; one group lit at a time with its number beside it; two numbers set side by side in the same unit, the small one under a magnifying glass, the big one running out of the frame with the camera climbing after it; the unit written on screen; one continuous shot, no slides; the source in the corner.

`units.js` keeps one crowd of units and moves it through a series of arrangements — blocks, piles side by side, bars of units, waffles, rings, queues — every unit walking its own curved path, leaving a little after its neighbour and settling where it lands; it also lights one group at a time, places the numbers beside the groups without collisions, draws a magnifying glass and moves the camera. `render.py` renders the page to mp4 with the score from `sound.py`, played on sampled instruments. Open any file in the template folders (`templates/`) through a local server (`python3 -m http.server`) and it plays; `render.py` loads them directly.

## What the viewer wants

"What is this made of, and what should I remember?" — said with things they can count, not with a pie chart.

Someone who doesn't follow the subject gets it:
- The first seconds say what the units are and what one stands for — "如果中国是 100 个人", "1 个人 ≈ 1412 万人", "■ = 1¢ of every dollar, about $70 billion".
- Each question has one plain line and one number — "64 个住在城镇", "Interest on the debt: 13.8¢".
- At least one finding comes from putting two questions or two numbers together — the old people walking back to city and village show "老人更多留在乡村"; a rural year of income laid beside an urban year of spending.

## Workflow

1. Copy `lib/infographic/units.js` into your project; work on the copies.
2. **Find the questions and the finding.** Pick the one crowd (100 people, the 434 hundred-yuan notes of a year's income, the 100 cents of a dollar, 100 new cars) and three or four questions to ask it, in an order where each answer sets up the next. Then ask what a data desk would ask:
   - **Out of what?** Shares need the right whole: domestic sales, not sales including exports; net outlays, with what is left over named honestly ("everything else").
   - **Side by side with what?** A number means more beside another in the same unit: interest beside the military, NASA beside Social Security, what a rural household earns beside what an urban one spends.
   - **Which units carry two answers?** If the same units are lit in two arrangements (the over-60s in age, then in city / village), the split between them must come from the data (the census's own split by place), not be made up. Units you don't have a cross-tab for stay grey while they move.
   - **What does it say?** Write the line as the finding — "留在国内的车，新能源过了一半" — not the topic.
3. **Get the data, keep the raw file next to the page** (`data/`), load it with `Units.withData`, write down where it comes from (*Data*).
4. **Compute every number on screen from the data file in the page.** Whole units with `Units.split(values, n)` (largest remainder, always adds up to n); the shares, the differences, "64×" — computed, never typed.
5. **Storyboard the arrangements**: for each question, the layout the crowd takes, who lights up, the line and the number, how long it holds (*Arrangements*, *Time*).
6. Pick the units and the look (*Units and look*), the camera moves (*The camera*).
7. Write the score (*Sound*).
8. `python3 $SKILL/render.py page.html --preview --at 2,6,10,14,18,22,26,30` and look at the contact sheet: a time inside every arrangement and one inside every move. Open one frame full size.
9. `python3 $SKILL/render.py page.html --out video.mp4`.

## How it moves

1. **The same crowd, re-formed for every question.** The units never change; only where they stand does. Units walk from where they were to where they now belong — each on its own slightly curved path, leaving a little after the others, landing with a small give.
2. **One group lit at a time.** The group being talked about turns the one accent colour; everyone else goes grey; its number sits beside it. Between questions everyone goes back to the plain ink colour. A lit group can stay lit while the crowd re-forms, so it shows up inside the next grouping.
3. **Compare by putting side by side.** Two numbers become two piles of the same unit standing on one baseline, or one pile with a dashed line at the other's height and the difference lit above it. When one is far too small to see, a magnifying glass comes over it; when one is far too big for the frame, its pile runs out of the top and the camera climbs after it, with a ruler counting the small one up its side.
4. **Write the unit on screen.** One unit and its value stay in a corner: "= 1412 万人", "= 100 元", "= 1¢ ≈ $70 billion". Change the unit only on screen and say so.
5. **One continuous shot.** No slides, no cuts, no summary card. The crowd moves, the camera moves inside the same world; the line and the number change at the top.

## Arrangements

Layouts give the slots units fill, in order (`Units.grid / side / rows / waffle / ring / line`), each returning `{ slots, box }`; `side`, `rows` and `waffle` take counts and return one layout per group. Pick by the question:
- **A block** (`grid`) — the whole crowd, before and after: "if China were 100 people".
- **Piles side by side** (`side`) — a few groups compared by height, standing on one baseline: city / village, age bands, spent / kept, interest / military.
- **Bars of units** (`rows`) — many groups with names, sorted: what the spent money bought, schooling levels.
- **A waffle** (`waffle`) — parts of one whole that stays in one block: 48 of 100 new cars electric.
- **A ring** (`ring`) — a group standing in a circle (one `ring` per group, its radius from the count): age bands as circles of people.
- **A queue** (`line`) — units leaving: the exports driving off down a road, out of the frame.
- **Your own** — any `{ slots: [{ x, y, s }] }` you compute: a map, a staircase, a scale.

Inside a group, each unit takes the slot nearest to where it stood (paths cross as little as possible). Pass `order` instead when who stands where matters: the lit ones last, so they gather on top of their pile; the excess first, so the difference sits above the line.

Units can join and leave: a unit whose group has no layout in a state leaves (fades where it stands, or moves away with `exit`); a unit that had no place before arrives (drops in from `enter`). New units are for a comparison that needs more of them — say on screen what they are.

## Time

- Open on the crowd arriving (1.5–3 s), with the title and the unit.
- Each question: the crowd re-forms (1.5–2.5 s including the spread of departures), then holds 3–6 s while the group lights up, the number lands and the line is read.
- A comparison with the camera: 1.5–2 s into the close-up, 3–4 s to climb, 1.5 s hold at the top, 2 s back out.
- End on the crowd itself — back in its first block, or on the comparison — with one closing line; 3–5 s.
- 25–45 s in all for 3–5 questions.

## Units and look

The units are simple and all alike: a round head over round shoulders; a rounded square; a coin; a banknote; a small car. No faces, no detail, no outlines; draw your own as a function `(ctx, x, y, s, u) => …` when the subject has an obvious object.

The look follows the subject and the platform — the examples are a census on paper, banknotes on dark green, a dollar on white, cars on blue. In every one:
- One ground, one ink colour for units at rest, one grey for units not being talked about, one accent for the lit group. No other colours.
- Three type sizes: the question's number, huge; its line, beside or above it; names, labels and the source small and quiet.
- Numbers beside the groups (`Units.tags` keeps them from covering each other or the units), not in a legend.
- Vertical 1080×1920: line and number at the top, the unit key under them, the crowd in the middle and lower half, the source at the bottom. Landscape 1920×1080: line and number top left, the crowd along a floor across the bottom two-thirds. 1080×1350 works too.
- Light grain over everything (`finish`); a soft vignette on dark grounds.

## The camera

`Units.track([[t, { x, y, z }], …])` gives the camera at t (eased between keys, held on equal keys); `Units.camera(ctx, cam)` applies it inside `save / restore`; draw the world after it and the line, number and source after `restore`. Climbing a pile: keep the camera's x, move its y from the floor to the pile's top (`C.target(key, k).y0`) at a steady speed, with `Units.ruler` along the pile counting the small unit. Following a queue: move x along the road. The magnifying glass is drawn in the world: `Units.lens(ctx, { x, y, r, focus, zoom, draw: c => drawWorld(c, t) })` redraws the world inside the glass.

## A value smaller than one unit

- Give the unit `part` (0..1) and `grain` (default 10): `{ cat: 'NASA', part: 0.35, grain: 10 }`. `C.draw` draws it as the unit split into grain × grain small squares, `round(part × grain²)` filled from the bottom row up, the rest as faint outlines. `U.fraction(ctx, x, y, s, part, { grain })` draws the same thing anywhere (uses `ctx.fillStyle`).
- Put the magnifying glass over it with a zoom that fits the whole unit inside the glass (the unit's diagonal × zoom smaller than the glass's diameter), so every small square can be counted.
- Beside the glass, say what one unit is and how many small squares the value is: "1 square = 1¢", "NASA = 35 small squares", "0.35¢ of every dollar" / 「1 格 = 1 分钱」「NASA = 一格里的 35 小格」.

## The page

```js
const U = Units;
window.__scene = U.withData(['data/census.json'], ([D]) => {
  const E = U.create({ width: 1080, height: 1920 });
  const place = U.split({ 城镇: D.urban, 乡村: D.rural }, 100);                          // { 城镇: 64, 乡村: 36 }
  const people = U.list(place, 'place');                                                 // [{ place: '城镇' } ×64, …]
  U.mark(people, 'old', { 是: 10, 否: 54 }, u => u.place === '城镇');                    // more attributes inside a subset (from the data)
  const C = U.crowd(people);
  const k0 = C.state(.3, U.grid(100, { x: 540, y: 1200, cols: 10, cell: 80, size: 64, anchor: 'c' }), { stagger: 1.4, wave: 'y' });
  const k1 = C.state(4.2, U.side(place, { box: [110, 900, 970, 1600], cell: 66, cols: { 城镇: 8, 乡村: 4 } }), { by: u => u.place });
  const k2 = C.state(15.6, …, { by, order: u => u.old === '是' ? 1 : 0, dur: 1.5, stagger: 1.1, wave: 'x', arc: .22, settle: .05, enter, exit });
  const spot = U.spotlight([[5.8, 9.8, u => u.place === '城镇'], …]);                     // one group lit at a time
  const cam = U.track([[0, { x: 540, y: 960, z: 1 }], …]);
  const draw = (c, t) => {
    c.save(); U.camera(c, cam(t));
    C.draw(c, t, { shape: 'person', color: (u, t) => spot.color(u, t, { ink, dim, accent }), front: (u, t) => spot.k(u, t) > 0 });
    U.tags(c, [{ box: C.target('城镇', k1), value: '64', text: '城镇', sides: ['below', 'right'], stack: true, a }], { frame: [60, 600, 1020, 1800] });
    U.lens(c, { x, y, r: 150, focus: [fx, fy], zoom: 5, draw: cc => C.draw(cc, t, …) });
    U.ruler(c, { x, y0: floor, y1: top, every: px, label: i => i % 10 ? '' : `${i}` });
    c.restore();
    U.counter(c, 64, { x: 92, y: 330, size: 200, color }); U.text(c, '个住在城镇', x, y, { size: 58 });
    U.legend(c, '= 1412 万人', { x: 96, y: 600, shape: 'person', size: 46 });
    U.source(c, '数据：…'); U.finish(c, t);
  };
  return U.scene(E, draw, { duration: 37, background, music: { notes }, sounds: [...C.taps(k1)] });
});
```

Also: `C.now(t)` (every unit's live `{ u, x, y, s, a }`), `C.box(test, t)` (live box of some units), `C.settled(k)` (when state k stops moving), `U.tag` (one tag), `U.mix(a, b, k)` (hex colours), `U.bounds`, `U.toScreen`, `U.follow`; shapes `'person' 'square' 'circle' 'coin' 'note'` or a function; `U.fraction(ctx, x, y, s, part, { grain })` (see *A value smaller than one unit*); timing `seg(t, a, b)`, `io`, `oc`, `sm`, `lerp`, `cl`.

## Examples

Four stories that differ in subject, units, layout, look and format. Read them for how the ideas are carried out, then tell your own story with your own data — not a variation of the nearest example.

- `templates/if-it-were-100/china-100.html` — 如果中国是 100 个人 (vertical, Chinese, paper, people): 100 people arrive in a block; stand by city and village (64 / 36, city lit); by age (18 / 63 / 19, the over-60s lit); the over-60s stay lit and walk back to city and village, gathering on top of their piles — 9 of 36 in the village, 10 of 64 in the city, "老人更多留在乡村", from the census's own split by place; schooling as bars of people with names (大学 15 lit, then 初中 35); back into the first block for "同样这 100 个人" with the three numbers.
- `templates/where-the-money-goes/china-wallet.html` — 一个人一年挣的钱去了哪 (vertical, Chinese, dark green, hundred-yuan notes, serif lines): a year's disposable income as 434 notes; split into 295 spent and 139 not spent; the spent notes laid out as bars by what they bought (food lit, then housing), the unspent ones in a dim stack at the side; then the same notes become an urban resident's year of spending, 75 drop away, and a rural resident's year of income arrives beside it — "农村居民一年挣的，不够城镇居民一年花的", a dashed line at the rural height and the 114 notes above it lit.
- `templates/where-the-money-goes/us-dollar.html` — where a federal dollar went in fiscal 2025 (landscape, English, white, squares on a floor): $7.01 trillion as 100 cents; eight piles by budget function (Social Security lit, then interest on the debt beside the military); a magnifying glass over the last cent of "everything else", split into 100 small squares with NASA's 35 filled ("NASA = 35 small squares"); Social Security stands up as one column next to NASA's cent, the camera drops to the floor beside them and climbs the column, a ruler counting NASAs up its side — 64 — and pulls back out with the column running off the top of the frame.
- `templates/if-it-were-100/china-cars.html` — 如果 2025 年中国卖出的新车是 100 辆 (1080×1350, Chinese, blue, car icons drawn by the page): 100 cars arrive; a waffle with 48 electric lit; 21 drive off down a road out of the picture as exports, the camera following along the queue (8 of them electric); the 79 that stayed stand in two piles, 40 electric and 39 not — "留在国内的车，新能源过了一半".

## Data

| Data | Where |
|---|---|
| A country's population, census, household income and spending | the national statistics office's bulletins (国家统计局 公报 / 数据发布), census reports; check two numbers against the office's own page |
| US federal spending | Treasury's Monthly Treasury Statement via `api.fiscaldata.treasury.gov` (`mts_table_9` outlays by function, `mts_table_5` by agency; no key), OMB historical tables |
| US population, income, jobs | Census Bureau (ACS tables), BLS |
| Industry totals (car sales, power, phones) | the industry association's annual release (中汽协, 中电联…), as reported by an official news agency when the association's own site can't be reached |
| World figures | World Bank API, UN data, Our World in Data |

- **One source per number, named at the bottom**, with the rule behind it — "销量含出口", "net outlays by budget function", "含在校生".
- **Say what the remainder is.** If the categories don't cover the whole, name the rest ("没上过小学（含学龄前）", "everything else, net of offsetting receipts").
- **Rounding to whole units changes small groups.** Use `split` so the units add up, show the exact value in the label (13.8¢, 23.81%), and draw a value that is less than one unit as small squares (*A value smaller than one unit*).

## Sound

A light score on sampled instruments (`piano pluck celesta marimba kalimba keys pizzicato pad …`), written as notes on the page — `{ t, m (MIDI), d (seconds), inst, v }` — plus `dynamics: { inst: [[t, level], …] }`.
- One or two instruments; a broken chord or a plucked figure in the middle register, a new chord on each re-forming; a single `celesta` note when a group lights up; a short rising pluck line when the camera climbs.
- `C.taps(k)` gives soft taps as units land in state k, merged so they patter rather than crackle; a `whoosh` (with `dur`) under a big camera move.
- Sounds: `tap tick pop`, `whoosh` (with `dur`), `ding chime sparkle`.
- No drums, no full orchestra, no bass under 80 Hz carrying the piece; nothing that pulses with the beat.

## Check your output

- **the units only change colour in a fixed grid** — move them into a new arrangement for every question.
- **every group coloured at once, with a legend** — light one group, grey the rest, put its number beside it.
- **pages, tabs, cards or a summary slide** — one shot; the crowd re-forms and the camera moves.
- **the questions don't touch each other** — carry a lit group across, or set two numbers side by side, and say what that shows.
- **units all leave and land together** — spread the departures (`stagger`), let paths bend (`arc`).
- **a group lit in two arrangements without data for the split** — keep it grey while it moves.
- **numbers on top of each other or of the units** — `Units.tags` with `sides` and `avoid`; fade the old ones before the new land.
- **the small thing can't be seen / the big one is squeezed to fit** — magnifying glass for the small, let the big one leave the frame and climb after it.
- **no unit on screen** — "1 个人 ≈ …", "= 100 元", "■ = 1¢".
- **a number on screen that isn't computed from the data file**, or a number without a source.
