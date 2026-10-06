---
name: whiteboard
description: Hand-drawn explainer video — someone explaining while drawing on a whiteboard, a notebook page or a chalkboard; text written stroke by stroke (real stroke order for Chinese), arrows, circles, highlights, doodles and diagrams drawn as you watch, the camera moving across the board, with drawing sounds and music. Use when asked for a whiteboard / hand-drawn / sketch / doodle / draw-as-you-explain / 手绘 / 白板讲解 / 黑板 video, rendered to mp4.
---

# Hand-drawn explainer

You design the video; this skill gives you a way of working, a menu of moves, three finished examples, and an optional library (`hand.js`) for the parts that are hard to build: stroke-by-stroke handwriting, hand-wobbled lines, marker / pencil / chalk brushes, a pen that follows the tip, a camera across a big board, and the sound.

## Workflow

1. **Understand the content.** Write down, in a few lines: the one thing the viewer should get; the point where people usually get lost; the picture or comparison that makes it click; the numbers or the example that prove it.
2. **Understand the audience.** Who is watching, on which platform, what they already know, and what they are used to seeing.
3. **Invent the look and the sound for this video.** Something that matches the content and the audience — it doesn't have to be literal (a receipt for a budget, graph paper for a growth curve, a recipe card for a habit, a teacher's chalkboard for a physics question). Take an example as a starting point and change it: the surface, the paper colour, the pen, the palette, how heavy the writing is, the music's instruments, tempo and mood. Two videos on different topics should not look or sound alike.
4. **Storyboard 3–5 beats.** For each beat: what is written, what is drawn, which move from the menu, and what the viewer feels (curious → "oh" → satisfied). Open with a hook (a question, a surprising number, a problem the viewer has).
5. **Build the page.** Follow *Taste*. Draw anything you can imagine — your own doodles as SVG paths, diagrams, little characters, motion in `over()`, your own background and pen. The examples show techniques; your video should look like it was made for this topic.
6. **Preview** `python3 render.py page.html --preview` → `preview.png` (nine moments; prints the timeline, the duration and any text that overlaps other text). Look at it and fix what's cramped, cluttered, too small or too slow.
7. **Render** `python3 render.py page.html --out video.mp4`, then look at a contact sheet of the mp4 before you call it done.

Copy `hand.js`, `render.py` and `sound.py` next to your page (`<script src="hand.js">`). Needs ffmpeg and Python with `playwright`, `Pillow`, `numpy`, `scipy`, `soundfile`; uses Playwright's Chromium or the installed Google Chrome. Chinese stroke data is fetched per character from jsDelivr. **If you're in a sandbox and the browser or the download won't run**, ask for permission to run it outside the sandbox.

## Taste

What makes a hand-drawn explainer look expensive rather than busy:

- **Restraint.** One ink colour for almost everything, one or two accents that always mean the same thing. A frame with three colours reads better than a frame with seven.
- **Hierarchy from size and weight.** At most three text sizes in a section — heading, line, note — and each clearly bigger than the next (about ×1.5). Notes are smaller and grey. Put main and secondary lines in one `stack()` so their spacing comes from their sizes.
- **Air.** One idea on screen at a time; leave a third of the frame empty and 90 px or more at the edges. Give a line of text at least half its own height of space above and below.
- **Few drawings, drawn big.** One picture that carries the idea, large and confident, beats many small icons. Anything you draw yourself — a hand, a character, a prop — should look as finished as the built-in pieces; when it doesn't, use a simpler shape.
- **Alignment.** Each section has one axis — a shared left edge or a centre line — and things sit on it. Numbers line up.
- **Rhythm.** Draw, let the key line sit for a beat, then move. The camera moves when the idea changes, not in between.
- **Plain is a style.** Black ink on white with one red circle can be the best-looking version of a video.

## Moves

Pick what serves each beat; mix them.

- **One picture per idea** — a metaphor drawn simply: money as a snowball, attention as a battery, a queue as people in line. Draw the thing, not a label for it.
- **Build up** — a diagram that grows a piece at a time; a number worked out on the board (`100 × 10% = 10`); a chart that rises as it's drawn; a pie filling quarter by quarter.
- **Contrast** — split the board left / right (before / after, wrong / right); cross out the wrong one.
- **Erase and redraw** — wipe part of the board and draw the next state in the same place (morning → evening, mistake → fix).
- **Zoom to a detail, pull back to the whole** — move the camera close on the key number, then show the full board at the end.
- **A character** — a stick figure who has the problem, reacts, and is fine at the end.
- **Motion that isn't drawing** — something travelling along a path (a planet on its orbit, a coin rolling, a clock hand turning), done in `over()`.
- **Mark the key part** — underline, circle, highlighter, box, a filled shape, a check mark.
- **Notes in the margin** — small side comments, a sticky note, an arrow with "this one!".

## Making it your own

- **Surface:** `whiteboard` `notebook` `grid` `chalkboard`, or your own — `surface: (ctx, view, t) => { … }` paints the background (kraft paper, a receipt, a blueprint, a sticky-note wall…); set `paper` to its colour so pencil and chalk grain match.
- **Pen:** `marker` `felt` `pencil` `chalk` `none`, or your own — `pen: (ctx, x, y, color, lift) => { … }` draws it with the tip at (x, y).
- **Ink:** `brush` (`marker` `pencil` `chalk` `highlighter`), `palette: { ink: '#…', accent: '#…' }` for your own colour names, `bold`, `font` (`sans` `script`).
- **Music:** write your own notes (see *Sound*), synthesise a wav and pass it in, or start from one of three arrangements and change it.

## Examples

`examples/` — open any of them in a browser to watch.

- `pomodoro-whiteboard.html` — 中文, whiteboard and marker: a hook with a stick figure pulled by distractions, a tomato that becomes a timer (its hand turns in `over()`), a time bar, a checklist, four tomatoes filling up.
- `leap-year-notebook.html` — English, pencil on a notebook page: script title, the Earth travelling its orbit, a clock with a quarter shaded, a pie filling a quarter a year, a calendar page and a sticky note.
- `sky-chalkboard.html` — 中文, chalk on a blackboard: a prism splitting light, air molecules bouncing blue light everywhere, then the board is erased and the sunset drawn in its place.
- `habit-loop-colorful.html` — English, felt-tips in many colours: colour inside a heading, hatched bubbles joined into a loop, a checklist with the old habit struck out.

## hand.js

```js
const b = Hand.board({ pace: 1.6 });           // pace speeds up all drawing; maxZoom (1.5) caps how close the camera gets
b.section('hook');                              // the camera frames each section in turn and travels to the next
b.write('Why leap years?', { x: 540, y: 500, size: 120, font: 'script', id: 'title' });
b.underline('title', { color: 'red' });
b.draw(['M10 80 Q50 10 90 80'], { x: 540, y: 900, size: 400, color: 'blue', fill: 'blue' });
window.__scene = Hand.scene(b, { surface: 'notebook', pen: 'pencil',   // pens: marker felt pencil chalk none music: { style: 'lofi', lift: [8] }, over(ctx, t) { /* your own motion */ } });
```

Steps play in order, each after the previous one. Coordinates are board pixels (the screen shows 1080 × 1920 of them at zoom 1); lay sections out beside and below each other on one big board.

| step | draws |
|---|---|
| `write(text, { x, y, size, color, font, bold, align, maxWidth, id })` | handwriting, stroke by stroke (Chinese in real stroke order with KaiTi shapes); `\n` for lines; → × ≈ ✓ … ¥ ° work; text can be segments `[['the '], ['habit', 'blue']]` to colour words |
| `stack([{ text, size, color, … }, …], { x, y, align, gap })` | several lines downward from `y`, spaced by their sizes — headings with their sub-lines, a label with its note |
| `draw(paths, { x, y, size, box, color, fill, width })` | your own drawing: SVG path strings (M L H V C Q A Z) or point lists, in a 100 × 100 box scaled to `size` at (x, y) — leave out x / y / size to use board pixels |
| `icon(name, { x, y, size, color, fill, hatch })` | spark coin coins money piggy clock calendar person bulb check cross star heart house sun moon globe cloud book phone cup gift cart lock chat rocket plant tomato flag target |
| `line(from, to)` · `arrow(from, to, { bend })` | hand-drawn line, arrow (bend −0.4…0.4) |
| `circle({ x, y, r | rx, ry } or { around: id })` · `box({ x, y, w, h } or { around: id })` | loop, box; `fill` washes the inside, `hatch: true` adds marker hatching |
| `underline(id, { double })` · `highlight(id, { color })` · `strike(id, { cross })` | mark something already drawn |
| `erase(ids or steps, { d })` | wipe them off |
| `wait(s)` · `sfx(name)` · `look(ids or [x, y, w, h])` · `overview()` | pause, a sound, move the camera on purpose, show the whole board |

Every drawing step also takes `brush` (`marker` `pencil` `chalk` `highlighter`), `width`, `d` (its drawing time), `wait`, `after`, `sfx` (a sound when it finishes) and `id`; each returns the step, whose `t0` / `t1` (after the build) tell you when it is drawn — use them to time motion in `over()`. Lower-level pieces are on `Hand` too: `textPaths`, `svg`, `arc`, `curve`, `fn` (a function plotted into a box), `wobble`, `drawPen`, `surface`.

Without `hand.js`, any page works with `render.py` if it sets `window.__scene = { duration, ready, seek(t), sounds, music }` and draws to one 1080 × 1920 `<canvas>`.

## Sound

Drawing sounds follow the strokes (marker squeak, pencil scratch, chalk with a tap), the camera whooshes when it travels, and erasing rubs. Add accents where something lands — `sfx` on a step or `b.sfx(name)`: `pop` `ding` `tap` `sparkle` `tada` `thud` `swish` `page`.

Music is part of the design: pick instruments, tempo and mood for this video, and let it change where the explanation turns (an instrument joins, the beat comes in, it drops out before the punchline).

Build energy by adding parts — a bass, then a beat, then a second instrument — and keep the melody in key within about MIDI 60–84.

- **Your own notes** — `music: { notes: [{ t, m, d, inst, v }, …] }` (t seconds, m MIDI note, d seconds, v 0–1). Instruments: `kalimba` `bell` `marimba` `piano` `pluck` `pad` `bass` `organ` `whistle`; drums `kick` `snare` `hat` `clap` `shaker`. `habit-loop-colorful.html` builds its tune in a few lines.
- **Your own audio** — `music: { file: 'music.wav' }`, synthesised however you like.
- **A ready arrangement to start from** — `music: { style: 'marimba' | 'lofi' | 'piano', bpm, lift: [seconds] }`.

## Check your output

- **a section that is mostly empty** — add the picture or the worked example for that idea, or move things closer.
- **text too small to read on a phone** — main lines 70 px or more after the camera zoom; notes 50 px or more.
- **things overlapping** — check the preview at the moment both are on the board.
- **too long** — raise `pace`, cut a beat, shorten the lines; 15–30 s is right for most explainers.
- **looks like every other video** — go back to steps 1–3 and draw the one picture that belongs to this topic.
- **busy** — remove colours, icons and notes until each section says one thing.
