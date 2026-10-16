# Social Post

Social post (帖子) — makes a VIDEO out of a post on X: the post itself, drawn the way the app shows it, as the hook, and then what the post doesn't say — the data that checks it, what the replies said, what it means. Vertical first, for TikTok, Reels, Shorts and the quote-post under the original.

`post.js` draws a post on a canvas (name, handle, badge, time, text, counts rolling up, dark or light) and a compact reply bubble with the author masked. `fetch_post.mjs` and `fetch_replies.mjs` save a real post — and as many of its replies as X will load — to JSON through a browser that is already logged in to X. The rest of each video is the template's own page.

## What to make

The post is the first three seconds; the video is the part the post leaves out. Pick the angle from the post:

- **Receipts** — a prediction, a call, a promise ("ATH by Christmas", "we ship in Q3"): the post, how many times they said it, the data since, what it would take, how often that has happened before. Ends on the date it will be settled.
- **The replies** — a question to followers ("which 3 would you hold", "what's your hot take"): read the replies, count what they say, race the answers, find the one thing the crowd agrees on.
- **The announcement** — an official account saying something happened ("heading to the World Series", "we raised", "record"): the history or numbers that make it big, the turn from last time to this time.
- **The thread** — a long thread: one beat per post, each with the number or picture it points at.

Write the words around the post in the voice of the place it will be posted: lowercase and dry under a crypto post, plain under a sports post. The post itself is never edited.

## Workflow

1. Get the post. With a browser logged in to X on a debugging port (`--remote-debugging-port`):
   `node fetch_post.mjs <post url> data/post.json` · `node fetch_replies.mjs '<search that finds the post>' data/replies.json`
   Without one, write the post into a JSON file by hand from the user's screenshot — name, handle, text, time (ISO, UTC), counts.
2. Get the data the angle needs (prices, scores, filings…) into `data/` and write a small `data/summary.py` that reads the raw files and writes `data/summary.js` (`window.DATA = …`). Every number on screen comes from there.
3. Copy `post.js` next to the page; start from the template page that matches the angle and change the beats.
4. `python3 $SKILL/render.py page.html --preview --at …` · `--out video.mp4`.

## post.js

```js
Post.card(ctx, post, x, y, { w: 960, scale: 1, theme: 'dark' | 'light', u: 1, extra: 'BTC when he posted: $85,320', avatar: img, tz: 'America/New_York' })  // → height
Post.reply(ctx, text, x, y, { w: 820, scale: 1 })                                                                                                        // → height
Post.wrap(ctx, text, size, maxW) · Post.kfmt(n) · Post.day(iso, tz)
```

`post`: `{ name, handle, verified, text, time, replies, reposts, likes, views }` — the shape the fetch scripts save (the counts parsed from `stats`). `u` rolls the counts up from 0. `extra` is one line under the card. The avatar circle shows the first letter on a gradient unless you pass an image; pass `avatarA` / `avatarB` for the gradient's colours (the account's colours).

## Real things stay real

- The post's words, time and counts as fetched; the date in the poster's own time zone (`tz`).
- Counts of replies say what was counted: how many replies loaded out of how many, what counts as a mention.
- Reply authors masked; the person's photo only if it's the user's own account.
- The source line at the end: where the post and the numbers came from, and when.

## Check your output

- **the card looks fake** — wrong font sizes or a missing badge/time; compare a frame with the real post side by side.
- **text runs off the card** — the text size is too big for the width; `wrap` breaks long words, but pick the size from the longest line.
- **numbers on screen that aren't in summary.js** — move them there.
- **the video is just the post moving** — the angle is missing: add what the post doesn't say.
