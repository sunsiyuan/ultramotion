# News Collage

News Collage (剪报拼贴) — this week's story explained as a collage VIDEO (mp4 with music): clippings, printed photos, the actual documents and screenshots laid on a desk, corkboard or newsprint, and marked up as you watch — a highlighter sweeping across the sentence that matters, a red pen circling a number, arrows, red string pinned from one clue to the next, ink stamps — while the camera travels from clue to clue and the headline is the answer. Use it for a news / finance / tech / politics explainer, 新闻解读, 剪报风, 拼贴动画, "explain this week's story", a court ruling, a policy, an earnings surprise, a record. In the manner of Vox and Johnny Harris explainers, Vox Borders and Atlas, and the NYT / Economist collage style: real paper with torn and cut edges and real shadows, one document read closely, the camera pushing into a phrase, the source on screen.

`collage.js` lays pieces of paper on a big board and draws every frame from t: torn, deckled and cut edges with the white fibre of a tear, drop shadows from one light, photos printed with a border, halftone, duotone or a faded print, text typeset onto the paper with every marked phrase remembered, then highlights, underlines, circles, boxes, strike-throughs, redactions, arrows, red string with pins, stamps and tape drawn on over time, a camera that frames any piece or phrase, and the sounds of all of it. `spans.py` finds a phrase on a real PDF page so it can be highlighted on the picture of that page. `render.py` renders the page to mp4 with the score from `sound.py`. Open any file in the template folder (`templates/collage-news-explainer/`) through a local server (`python3 -m http.server`) and it plays; `render.py` loads them directly.

## Workflow

1. Copy `lib/news-collage/collage.js` into your project; work on the copy.
2. **Get the story right before the look.** Find the primary source and read it: the ruling, the filing, the terms, the agency release, the earnings report. Write down, in a few lines: the one-sentence answer (that becomes the headline), the two to four clues that prove it, the number that sticks, who disagrees and what they say. Dates, figures and quotes come from the source, verbatim, with where they came from.
3. **Collect the pieces.** The document itself (a PDF page as an image, or its text typeset onto paper), the agency's photos, a chart you draw, a quote card, a label for each clue. Pictures you may use: the user's own, public-domain government images (NASA, NOAA, USGS, court and congressional documents), Wikimedia Commons with its licence noted. Keep files and numbers next to the page (`img/`, `data/`) and compute what's on screen from them.
4. **Lay out the board.** Place the pieces on one big board in the order the camera will visit them — a path down, across, or zigzagging — close enough that two clues fit one frame when you want to connect them. Put everything the user will want to swap (the words, dates, names, sources) in a `CONTENT` object at the top.
5. **Write the beats as times** (`T = { hook: .2, clue1: 3, … }`) and hang every arrival, mark and camera key on them.
6. `python3 $SKILL/render.py page.html --preview --at 1,4,7,10,…` → `preview.png`; look at every beat, open one frame full size (`--full`), fix, look again.
7. `python3 $SKILL/render.py page.html --out video.mp4`, then watch a contact sheet and listen.

## What to make

Who uses it: creators who post an explainer about this week's story on TikTok, Reels, Shorts — 30–60 s, vertical, made every week. The pieces change every week; the look should fit the story:

- **One document, read closely** — terms of service, a bill, a memo, a letter. Newsprint or a white desk, the document typeset from the real text, one highlighter colour and one red pen; the camera reads down the page phrase by phrase; one or two cards beside it (what it covers, the other side's answer); a stamp on the line that decides it. Quiet piano.
- **A case built from clues** — a court fight, a scandal, where the money went. A corkboard full of clippings, receipts, the court's own pages, numbers on labels, red string from cause to effect; fast camera, a beat every two seconds, stamps on the turning points. Plucked strings, light percussion.
- **The agency's own pictures** — a record, a launch, a disaster, an election night. Prints with white borders and typed captions on a dark desk, labels laid over them, a circle on the detail in the photo, two strips of paper drawn to scale for the comparison. Harp or piano, slower.
- **Screens and posts** — a viral post, a product page, a chart someone shared: screenshots printed and pinned, the key line highlighted, the reply beside it.

The board: `cork` `kraft` `paper` `newsprint` `desk` `black`, or your own colours (`{ kind: 'kraft', base: '#…' }`), or a function that paints it. The paper of each piece follows what it is: newsprint for clippings, bright white for printed documents and photos, yellow for sticky notes, black or red strips for labels, kraft for tags.

## How it moves

- **Pieces arrive one by one, the way paper does**: dropped onto the board (`drop`, a shadow that tightens as it lands), slapped down (`slap`, for labels and the headline), slid in from an edge (`left right top bottom`). Nothing grows from nothing; paper doesn't fade in. A piece can leave by sliding off (`exit`) when the board needs the room.
- **The marks are drawn while you watch**: the highlighter sweeps along the line(s) of the phrase left to right; the pen circles a word in one loop that doesn't quite close; underlines, boxes and strike-throughs are drawn in one stroke; arrows draw their shaft then their head; red string runs from the first pin to the second and the second pin goes in.
- **The camera reads**: it frames the phrase being marked (`C.frame('doc.phrase')`), then pulls back to show the next clue beside it, travels across the board to the next piece and settles before the mark lands. It holds while a line is read (two to three seconds for a sentence) and moves between ideas. Close-ups crop the paper; that's fine.
- **Connect clues by putting them in one frame** and drawing the connection: string, an arrow, a label with a pointer.
- **The end** comes back to the answer — the headline, or the first picture with the answer laid over it — not a summary slide.
- Stamps land with a small overshoot and a thud; the headline and labels slap. The picture never flashes or pulses with the music.

## Taste

- **The real thing beats a drawing of it.** The court's page with the court's sentence highlighted; the agency's photo; the exact words of the terms. Don't draw people, buildings or machines; use a photo or leave them out.
- **One reading at a time.** One highlighter colour, one pen colour; the rest is paper and black ink. A frame says one thing; the mark tells the eye where to go.
- **The headline is the finding**: "About $30 billion is still in the Treasury", not "Tariff refunds explained".
- **Type you could read on a phone**: 40 px or more on screen after the camera's zoom for document text, labels bigger. Condensed bold sans for labels and numbers, a serif for headlines and quotes, typewriter or mono for captions and receipts — two families per piece.
- **Give each piece a reason to be there** — if it isn't a clue, the source, or the answer, leave it off the board.
- **Layer, don't stack**: pieces overlap a little at slight angles (±1–5°), tape across corners, labels over photos. The marked line stays uncovered.
- **The source is on screen**: named on the card it comes from (`— Nieman Lab, Oct. 15`), the caption under the photo with its credit, and a source line at the start or the end.
- Read the examples to see how the ideas are carried out, then make your own story — not a variation of the nearest example.

## The page

```js
window.__scene = Collage.load({ d: 'data/facts.json', page: 'img/filing-p8.jpg', photo: 'img/photo.jpg' }, A => {
  const C = Collage.create({ board: 'cork', light: { dx: .5, dy: .85, dark: .45 } });
  const F = Collage.FONTS, T = { head: .2, doc: 3, mark: 5.5, dur: 36 };
  const head = C.piece({ id: 'head', x: 540, y: 400, w: 900, h: 'auto', rot: -1.5, paper: '#f6efdc', edge: { bottom: 'torn' }, enter: { at: T.head, from: 'slap' },
    face: (g, w, h, P) => P.text([{ t: 'About $30 billion is still in the Treasury.', id: 'answer' }], { x: 50, y: 120, width: w - 100, size: 72, font: F.condensed, weight: 800 }).y });
  const page = C.piece({ id: 'p8', x: 560, y: 1400, w: 760, h: 760 * 792 / 612, image: A.page, treat: { kind: 'print', saturation: 0 },
    imageSpans: { thirty: [[372.6, 72.5, 52.7, 13.3]] }, imageUnit: 150 / 72, edge: { bottom: 'torn' }, enter: { at: T.doc, from: 'drop' } });
  C.highlight('p8.thirty', { at: T.mark, dur: .6 });
  C.string(C.anchor('head.answer', 'bottom'), C.anchor('p8.thirty', 'top'), { at: T.mark + 1 });
  return C.scene({ duration: T.dur, camera: [[0, C.frame(head)], [2.6, C.frame(head)], [3.6, C.frame('p8.thirty', { maxZoom: 1.6 })], …],
    music: { notes }, overlay: (ctx, t) => Collage.source(ctx, 'Source: …', { a: … }) });
});
```

Board pixels: x right, y down; the screen shows 1080 × 1920 of them at zoom 1. Lay pieces anywhere, including negative x or far down; the camera finds them.

**`Collage.create({ board, light: { dx, dy, dark }, seed })`** — `light` sets the direction (`dx`, `dy`, per unit of lift) and darkness of every shadow.

**`C.piece(o)`** — a sheet of paper; returns it (its `spans`, `w`, `h` are filled in after it is built).
- Place: `id`, `x, y` (centre), `w`, `h` (or `'auto'`: the face returns the y where its content ends, `padBottom` is added), `rot` (degrees), `lift` (shadow height; 2 for a label lying flat, 4–7 for a print, more for something held up), `z` (order; default the order of creation).
- Paper: `paper` (colour), `edge`: `clean` `cut` `torn` `deckle`, or per side `{ top, right, bottom, left }`; `core` (the colour inside a tear), `shape: 'oval'`, `grain` (0–.2), `fold` (a crease at that fraction of the height), `shadow: false`.
- Picture: `image` (loaded), `border` / `borderBottom` (a print's white margin), `crop: [x, y, w, h]` (fractions), `focus: [fx, fy]`, `treat`: `'print'` (ink on paper; `saturation: 0` for a black-and-white printout), `'halftone'` (`ink`, `paper`, `cell`, `angle`), `'duotone'` / `'mono'` (`ink`, `paper`), `contrast`, `brightness`.
- Face: `face(g, w, h, P)` draws on the paper; `P.text(runs, { x, y, width, size, lh, font, weight, style, color, align, tracking })` typesets and wraps — `runs` is a string or a list of strings and `{ t, id, font, size, weight, style, color, bg }`; a run with an `id` becomes a span you can mark (one box per line); returns `{ y }`, the baseline after the last line. `P.span(id, x, y, w, h)`, `P.image(img, x, y, w, h, { treat, crop })`, `P.rule(x, y, w, { weight, color })`.
- Spans from outside: `spans: { id: [[x, y, w, h], …] }` in the piece's pixels; `imageSpans` in the image's pixels × `imageUnit` (PDF points from `spans.py` with `imageUnit: dpi / 72`), following the crop and the border.
- Moving: `enter: { at, from: 'drop' | 'slap' | 'left' | 'right' | 'top' | 'bottom' | 'fade' | 'none', dur, dist, sound: false }` (a number is `{ at, from: 'drop' }`), `exit: { at, to, dur }`, `motion: t => ({ x, y, rot, s, lift })` for anything else.

**`C.label(text, { x, y, size, width, font, style, weight, bg, color, align, at, rot })`** — a strip of paper with type on it (wraps to `width`); slaps down at `at`. **`C.tape({ x, y, w, rot, at, color })`** — a strip of see-through tape.

**Marks** — each takes `at`, `dur`, `color`, and `until` (+ `out`) to lift it off again; drawn on the piece they target, so later pieces cover them:
`C.highlight(target, { alpha, low })` (`low`: a marker line through the lower half) · `C.underline(target, { double, offset, slope, width })` · `C.strike(target)` · `C.circle(target, { pad, turns, width })` · `C.box(target, { pad })` · `C.redact(target)` · `C.focus(target, { alpha })` (the rest of the piece fades back, the target stays) · `C.stamp(text, { x, y, on, size, rot, shape: 'box' | 'double' | 'circle' | 'none', font, alpha })` (`\n` for two lines) · `C.arrow(from, to, { bend, head, width })` · `C.string(from, to, { sag, width, pins, pin })` · `C.draw((c, t, u) => …, { on, at, dur })` (your own drawing, in the piece's pixels, `u` 0→1 over `dur`: a bar that fills, a line chart that draws, a map route).

Targets: `'id.span'`, `'id'` or the piece (the whole sheet), `{ on: piece, rect: [x, y, w, h] }` (piece pixels), `[x, y, w, h]` (board). Points for arrows and string: `C.anchor(target, 'left' | 'right' | 'top' | 'bottom' | 'center', dx, dy)` — they follow the piece if it moves.

**Camera** — `C.frame(targets, { pad, zoom, maxZoom, safe: [left, top, right, bottom], dx, dy, rot })` gives the key that fits one or several targets inside the safe area (default keeps out of the platform's buttons and captions); `C.bounds(target)` gives a target's box on the board, to place the next piece beside it. `camera: [[t, key], …]` eases between keys (zoom evenly in scale); two equal keys hold. `drift` (default 1) adds a slow handheld float; `0` for a locked camera.

**`C.scene({ duration, camera, overlay(ctx, t, view), under(ctx, t), music, sounds, drift, whoosh, finish: { grain, vignette } })`** — `overlay` draws in screen pixels after the board (the source line: `Collage.source(ctx, text, { a, size, y })`). `C.sounds` holds the sounds made so far; push your own.

Also: `Collage.FONTS` (`serif didone sans condensed din mono typewriter hand`, all installed on macOS with fallbacks), `Collage.treat`, timing `seg cl lerp oc io sm back`, `hash rng fbm`.

**Handwriting**: for a note written stroke by stroke in the margin, load `lib/whiteboard/hand.js` beside this file: `Hand.textPaths(text, { x, y, size, font: 'script' })` gives the handwriting as point lists; draw them a stroke at a time inside `C.draw`. **Real 3D paper** (pop-ups, folds, a lit table): `lib/paper`.

## Sound

Pieces make their own sounds — `land` when one drops, `slide` when one slides, a `land` and `tap` when one slaps; the highlighter and the pen sound for as long as they draw; string is a `swish` and a `tap` at each pin; a stamp is a `thud`; long camera travels get a soft `whoosh` (`whoosh: false` to drop them). Add `tear`, `rustle`, `page`, `tick` where the picture does it.

Music is light and fits the story: a quiet piano for one document; plucked strings (`pizzicato`, `marimba`), a soft bass and a shaker for a fast case; `harp` and `vibraphone` for pictures and records. Melody in the middle register, one or two instruments, a `celesta` note on the marks that matter, the drums dropping out while the key line is read. Notes as `{ t, m, d, inst, v }`, on `music: { notes }`.

## Examples

Three stories that differ in subject, board, density and picture source. Read them for how the ideas are carried out, then make your own — not a variation of the nearest one.

- `templates/collage-news-explainer/meta-terms.html` — Meta's new commercial terms (vertical, English, newsprint, 39 s, restrained): the headline clipping, then the terms typeset from Meta's own text; the camera reads down the clause — the highlighter over "web scrapers, bots…", the pen around "create test credentials", "associated with your products or services" underlined; a yellow card slides in beside it ("Virtually every news organization", Nieman Lab) on red string; "train" circled; Meta's answer on a grey card; the opt-out line highlighted and stamped NO OPT-OUT; a black quote card (News/Media Alliance); the answer on red paper. Quiet piano.
- `templates/collage-news-explainer/tariff-refunds.html` — where the illegal-tariff money is (vertical, English, corkboard, 37 s, dense): the answer slapped down as the headline; the Supreme Court clipping stamped ILLEGAL; a customs receipt with the $166B total circled, on string; a kraft strip filling red to 76%; the Court of International Trade's own pages — "$126 billion … refunded" highlighted, the $30 billion sentence highlighted and circled with a red label pulled out of it, the court's line about small importers; the Oct. 8 order stamped CLASS CERTIFIED; what's next. Every number computed from the data file; the boxes on the court's pages from `spans.py`. Pizzicato, marimba, light kick and shaker that drop out for the court's words.
- `templates/collage-news-explainer/perseverance-record.html` — Perseverance's driving record (vertical, English, dark desk, 37 s, built from NASA's pictures): the navcam frame from the record day as a print, "28.10 miles" laid over it, the tracks circled; Opportunity's tracks in black and white with the old record; two bars to scale and "passed by about 200 feet"; years as paper strips; Sojourner's 20 points against Perseverance's 600,000 on string; the Moon records struck through; back to the first print with the answer pasted on. Harp and vibraphone.

## Check your output

- **flat rectangles that don't look like paper** — give pieces edges (`torn` on clippings, `cut` on labels), lift and a little rotation; a board with grain.
- **text you can't read on a phone** — frame closer on the phrase (`C.frame('id.span')`), make the type bigger, or cut the text down to the line that matters.
- **a mark that lands while the camera is still moving, or off screen** — settle the camera half a second before the mark.
- **a card covering the line that was just marked** — move it beside the line (`C.bounds`) or let the camera leave first.
- **everything arrives at once** — one piece per beat; quick runs only for things that belong together.
- **a long pull-back where nothing can be read** — end on the answer, close enough to read.
- **a quote or a number not in the source**, a figure typed by hand instead of computed from the data file, a picture without its credit.
- **looks like the nearest example** — go back to the story: its board, its paper, its pace.
