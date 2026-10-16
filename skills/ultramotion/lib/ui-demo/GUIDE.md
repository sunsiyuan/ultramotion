# UI Demo

UI Demo (产品界面演示) — a real app or website being used, rendered from code to a finished VIDEO (mp4 with music): a launch clip, a new feature, a product walkthrough, an app review. The real screens sit in a phone or a browser window; a cursor or a fingertip moves to things and clicks them, text gets typed, pages scroll, one screen gives way to the next, the camera pushes in on what matters and follows the cursor, and short captions and callouts say what just happened. In the manner of Linear, Raycast and Arc launch videos and the Screen Studio clips indie developers post on X.

`capture.py` drives the real page in a browser and saves what the demo needs: screenshots of each state (whole pages for scrolling, a shot for every step of a drag or every letter typed on a canvas), where every named element is, and how its text looks. `demo.js` lays those screens into a device and plays the demo from a list of steps: it works out the times, the cursor's path, the camera, the transitions and the sounds, and draws every frame as a function of t. `render.py` makes the mp4 with music from `sound.py`.

## What the viewer wants

To see the thing working, for real, fast enough to follow and slow enough to read: what you do, what it does, why it matters — in that order, one beat at a time. The screen is the subject; everything else (the device, the background, the captions) is there to frame it and gets out of the way.

## Workflow

1. Understand the product and who will watch: what is the one thing it does that they will care about, and which three to six actions show it. Write those actions down as a story with a payoff (a number, a result, a finished thing).
2. **Get the real screens.** In this order of preference:
   - the user's own screen recording → `Demo.footage('rec.mp4', { device: 'phone' | 'laptop' })` (`render.py` splits it into frames; a phone recording has its own status bar: `device: { statusBar: false }`);
   - the user's screenshots → `Demo.images([...])`;
   - a public web app or site → `capture.py` (below), driving the real UI through the actions in the story.
   Don't redraw a product's UI in code. If a step can't be captured (a native app, a paid account), ask for a recording or screenshots of it.
3. Copy `lib/ui-demo/demo.js` (and the capture folder) into the project; work on the copies.
4. Write the steps (*The page*), with the payoff numbers and words read from the capture (`cap.shots[i].els.name.text`), not typed in by hand.
5. `python3 $SKILL/render.py page.html --preview --at …` with a frame inside every step; `--preview --at 9 --size 0` for one frame at full size: read the text on the screen at full size.
6. `python3 $SKILL/render.py page.html --out video.mp4`; watch a contact sheet; listen.

WebGL2 is used to lay the device into the frame in perspective; without it the device is drawn flat.

## Capture

```
python3 $SKILL/lib/ui-demo/capture.py URL --out shots/name --device phone|laptop [--full] [--crop 4000] [--format jpg]
        --find name=selector …        the elements the demo will point at, zoom to, type into, read numbers from
        --do action …                 what happens between shots (shot, click, type, fill, check, upload, drag, keyshots, press, scroll, wait, goto …)
```

The full list of actions is at the top of `capture.py`. What to know:
- `--device phone` is a phone-sized page with touch and a phone user agent (the site's real mobile layout); `laptop` is a 1440-wide browser window.
- `shot:full` keeps the whole page for scrolling; fixed headers are cut out and drawn pinned on top. `--crop` stops it where the story ends.
- `drag:x1,y1>x2,y2:n` takes a shot at every step of the drag and `keyshots:text` one after every letter: drawing on a canvas, a slider moving, text typed where there is no input field. The film plays them back in time with the cursor.
- Elements are found again in every shot, so a box that moves when the page changes is still right.
- Wait for the page to finish what it is doing before a shot (`wait:ms`): encoders, charts, fetches.
- A site that needs a login, a key or a network the machine can't reach can't be captured; ask for screenshots.

Every shot also records where the mouse was and which action made it; `Demo.runs(cap)` groups the shots by action (`[[0], [1], [2, 3, 4, 5, 6], …]`) so the page doesn't count indexes.

## How it moves

- **The cursor moves like a hand**: it speeds up, slows down, slides a hair past and settles, on a slight curve; at rest it drifts by a pixel or two. It arrives a beat before the click, presses (shrinks), and the target darkens for a moment with a ring spreading from the point. A fingertip on a phone is a soft disc that only shows while it touches.
- **The camera does the reading.** Start on the whole device, push in on the thing being used (1.5–3×), come back out when the context changes. While the cursor works (drawing, filling a form) the camera can trail it with a lag (`follow`), never showing past the edge of the window. Between two zoomed places, either pull out and go in again or pan across at the same zoom.
- **Screens change the way the product changes them**: a phone pushes in from the right and back, sheets come up from the bottom, an app opens out of what was tapped, a page that updates in place fades or cuts. Pages scroll with a flick: fast, then a long settle.
- **A phone faces the camera.** Upright and straight-on, as if held in a hand in front of the lens: no turn on its own axis beyond a degree or two, a long lens (the default), a slight handheld sway. It is already there or rises into the frame from below (`enter: 'rise'`); it leaves by the camera pulling back, not by turning. Push in until the screen fills the frame for the parts that need reading, and go full-screen on the UI (zoomed past the bezel) as often as you show the device whole. Soft even light: no streak of glare across the screen (`glare` only for a faint sheen), a soft shadow underneath.
- **A browser window can sit in space**: a few degrees of tilt that settles to face the camera as the demo starts and turns away again for the end card; a soft shadow under it.
- **Text**: one caption at a time, a few words, naming what happens or what it means ("Drag quality down.", "7.75 MB → 2.49 MB."). Callouts point at one element with a dot and a line. The last card says where to get it.

The steps choose the pace. Punchy clips (TikTok, Reels, a launch on X): 12–20 s, a cut or a zoom every second or two, a caption on every beat, a big number at the payoff. Calm walkthroughs (a README, a landing page, a feature video): 20–40 s, longer holds, the camera following the work, captions small at the bottom.

## Looks

Choose the device for where the product lives: a phone for a mobile site or app (facing the camera); a browser window for a web app (in 16:9, or inside a vertical frame with the camera zoomed on the part being used); `none` for a bare screen or a cropped panel. The backdrop takes the product's colour or the opposite of its screen (a light app on a dark field, a dark app on a pale one), or the screen itself blurred behind the device. Captions in the system sans, bold for the main line, on a plate when they sit over the screen.

## The page

```js
const D = Demo;
window.__scene = D.scene(async () => {
  const cap = await D.shots('shots/name');                       // or D.images([...]), D.footage('rec.mp4')
  const film = D.film({
    width: 1080, height: 1920, cap,
    device: { kind: 'phone' | 'browser' | 'none', width, x, y, rx, ry, rz, enter: 'rise' | 'fade', enterDur, finish: 'titanium' | 'black' | 'silver' | 'blue' | 'white', glare: 0..1, theme: 'dark', address, statusBar, time },
    focal: 8,                                                      // lens length in frame heights: 8 for a phone (default), 2.4 for a browser window (default)
    drift: 'hand' | 'camera' | false,                              // a phone held in a hand (phone default), a camera breathing (browser default)
    backdrop: { colors: [...], glow, blur: 0..1, tint },
    pointer: 'cursor' | 'touch', cursorSize: 1.5, pointerStart: [x, y],
    steps: [ … ],
  });
  return { film, music: { notes }, sounds: [ … ], draw(c, t, film) { /* anything extra on top */ } };
});
```

Steps run one after another; each starts when the last one ends. `at: s` places one at an absolute time, `gap: s` waits first, `with: true` starts it together with the step before (a camera move during a scroll, a caption over a zoom); the next step doesn't wait for it. Captions, callouts and spotlights run alongside the steps that follow; `wait: s` holds.

| step | what it does |
|---|---|
| `{ show: i, via: 'cut' \| 'fade' \| 'push' \| 'back' \| 'up' \| 'down' \| 'zoom', from, dur }` | the next screen (a shot index); `zoom` opens out of `from` (an element) |
| `{ click: target }` / `{ tap: target }` | the cursor travels there (`moveDur`), presses; ripple and press on the target |
| `{ move: target, dur, arc }` | the cursor travels without clicking |
| `{ type: 'el', text, cps }` | text typed into an input on the current screen, caret blinking; the field's old text is covered |
| `{ drag: [i0, i1, …], dur }` | the cursor goes to where the drag began and drags along the recorded path while the shots play |
| `{ play: [i, …], dur }` | shots played in time (letters typed on a canvas — with key clicks — or a page loading) |
| `{ scroll: y \| 'el', place: .3, dur }` | the page scrolls to a y, or until the element sits `place` of the way down |
| `{ swipe: 'up' \| 'down', from, len }` | a fingertip flicking the page (put a `scroll` with it) |
| `{ cam: { zoom, on: target \| 'device', y, at: [x, y], tilt: [rx, ry, rz], follow: 0..1 }, dur, ease }` | the camera: `on` is centred at height `y` of the frame (or at `at`); `'reset'` goes back; `tilt` for browser windows, not phones |
| `{ caption: 'text\nline 2', sub, pos: 'top' \| 'bottom', y, size, color, plate, hold }` | words on the frame; the next caption replaces it |
| `{ callout: target, text, side: 'top' \| 'bottom' \| 'left' \| 'right', reach, bg, size, hold }` | a label on a line pointing at an element |
| `{ spot: target, hold, dim, pad }` | everything but the element dims |
| `{ pointer: true \| false }` | show or hide the cursor |

A target is an element name from the capture (`'save'`), `{ el: 'save', dx, dy }` for a point inside it (0..1), or `[x, y]` in the screen's CSS px. Elements on a scrolled page are found where they are at that moment.

Also: `D.runs(cap)`, `D.ease` (`io`, `out`, `out5`, `sine`, `hand`), `D.seg`, `D.lerp`, `D.cl`, `D.noise`, `D.arrow(c, x, y, scale, press)`, `D.touch(…)`, `D.rr(c, x, y, w, h, r)`, `D.SANS`, `D.MONO`; `film.project(t)` maps device px to the frame, `film.local(x, y)` screen CSS px to device px — for drawing your own things on top.

## Examples

Three demos that differ in device, frame, pace and product. Read them for how the ideas are carried out, then make your own product's demo — not a variation of the nearest one.

- `templates/product-demo/squoosh-phone-en.html` — Squoosh (Google's open-source image compressor) on a phone, 9:16, punchy, 17 s: the phone rises into the frame facing the camera; a 7.75 MB photo is too big to send; tap, the editor fades in with the photo already at 3.93 MB and the camera pushes in until the screen fills the frame; the panel opens, a fingertip drags quality from 75 to 52 while the shots of the drag play; the camera pushes in on ↓68 %, the caption reads 7.75 MB → 2.49 MB; the camera pulls back for squoosh.app. White caption plates on pink, electric piano and bass.
- `templates/product-demo/excalidraw-browser-en.html` — Excalidraw in a browser window, 16:9, calm, 24 s: the cursor picks the rectangle tool, draws three boxes — every drag and every letter a real shot — names them Browser, API, Postgres and joins them with arrows; the camera sits at 1.6× and trails the cursor; one small caption at the bottom; solo piano.
- `templates/product-demo/open-meteo-vertical-en.html` — Open-Meteo's API docs, a desktop browser inside a 9:16 frame for a developer's Short: the page scrolls to the form, the camera at 2.9× watches Berlin's coordinates replaced by Tokyo's, rain added, Reload Chart; the camera pans along the new seven-day chart, then a spotlight on the API URL; dark navy field, a pluck ostinato.

## Sound

Every step sounds by itself: a click is a `tap` with a small release `tick`, typing is a `tick` per letter (a `tock` for a space), a screen pushing in is a `swish`, a camera move a quiet `whoosh`, a callout a soft `pop`. `sound: false` silences a step, `sound: { kind, v, … }` replaces it.
- Music under it is light and steady: one or two sampled instruments and a bass (electric piano, pluck, marimba, piano), 90–120 bpm for a punchy clip, a slow piano for a walkthrough, written as notes on the page. Melody in the middle register.
- No drops, risers or hits; the clicks are the rhythm on top.

## Check your output

- **a step happens before you can see where** — give the camera time to arrive (`gap`), or move it `with` the step before.
- **the screen is too small to read** on a phone screen — push in; a laptop page at full width in a vertical frame needs 2× or more.
- **the camera swings to every click** — lower `follow`, or hold a zoom and let the cursor move inside it.
- **a caption sits on the screen and can't be read** — a `plate`, or move it to where the device isn't.
- **two captions at once** — they replace each other only at the same position; change one's `hold`.
- **the cursor clicks next to the thing** — the element moved between shots: find it again (`--find`) or aim with `{ el, dx, dy }`.
- **a jump when a screen changes** — the shots were taken at different scroll positions or sizes; take them in the same state, or change with a `fade`.
- **text in the screen looks soft when zoomed** — capture with a higher `--scale`.
- **the phone looks like a render, not a phone** — face it to the camera, drop the tilt and the glare, keep the default lens.
- **a sheet slides up carrying a whole second screen** — the shot is the full screen; when only part of the UI changes, `fade` or `cut`.
- **a long still ending** — end on the last card's hold, not seconds after it.
