# Karaoke Lyrics

Karaoke Lyrics (卡拉 OK 歌词) — makes a lyric VIDEO (mp4 with the song) where the words light up exactly as they are sung — a colour wiping through each syllable at the singer's speed, words writing themselves on, a ball bouncing from syllable to syllable — and the lines turn over with the song. Times the lyrics to a real recording (Whisper plus forced alignment, word by word, Chinese character by character) or to a melody you write for a backing track. In the manner of DAM and JOYSOUND karaoke screens (two staggered rows, the colour wipe, count-in dots), Apple Music Sing's scrolling lyrics, and Max Fleischer's Screen Songs with the bouncing ball.

`lyrics.py` times lyrics to a recording; `karaoke.js` times them to a melody you write, lays the lines out, lights each syllable as it is sung, bounces a ball, decides which lines are on screen, and draws photos and footage on a canvas; `render.py` turns the page into an mp4 with the song (or the backing played by `sound.py`). Open any file in the template folders (`templates/`) through a local server (`python3 -m http.server`) and click to play it with sound.

## Workflow

1. Copy `lib/karaoke/karaoke.js`, `lib/karaoke/lyrics.py` into your project; work on the copies.
2. Work out who is singing along and where it will be seen (*What to make*). That decides the format, the screen layout and the pictures.
3. Get the timing (*Timing*): from the recording with `lyrics.py align`, or from the melody with `Karaoke.score`.
4. Check the timing against the voice: `python3 lyrics.py check song.mp3 timing.json` and look at the picture; fix any line that is off by editing the json.
5. Build the page: pictures, the pager, the way words light (*How it moves*, *karaoke.js*).
6. `python3 $SKILL/render.py page.html --preview --at …` with times inside sung words, at line changes and before the first line; look at one frame full size with `--full`.
7. `python3 $SKILL/render.py page.html --out video.mp4` (`--crf 26` for grainy photos or film if the file is too big), then watch it with the sound on.

## What to make

Read the song and the people first: who will sing it, what they are singing it for, where they will watch. Make that occasion's video.

- **A musician's lyric video** (YouTube, Spotify Canvas, Reels): the real recording; the words are the show, set large; pictures from the band's world or none. One mood for the whole song, a change of colour or picture at the chorus or the second half.
- **A KTV / 伴奏 track** (a karaoke room, a party, a class singing together): no lead vocal, or a guide melody only; the classic two-row screen at the bottom; a title card with lyricist and composer; count-in dots before each verse; scenery or footage behind.
- **A crowd sing-along** (a ballpark, a gym, an assembly, a church, a campfire): huge type, syllables hyphenated so everyone keeps up, a bouncing ball or a light that jumps with each syllable; the venue's own look (a scoreboard, a hymn board, a projector screen).
- **A family or friends' moment** (a birthday, a wedding, a farewell): short and vertical for a group chat; one line at a time; the name sung in the song gets the line it is sung in.
- **A duet or a group** (a KTV 对唱, a couple's song at a wedding, a K-pop or idol group, a choir with soloists): every singer has a colour and keeps it all song; the lines they sing together get a group colour or the singers' colours in bands; a small name or mark where the voice changes.
- **A cover or a clip on social** (抖音, 小红书, Reels): vertical, the line being sung in the middle, the lines before it stacked smaller above.
- **A rap verse** (a rapper's clip, a cypher, a freestyle): the words come fast and dense, so set them big and heavy and let the lighting race through them; a bar to a block; the hook and the rhymes can carry their own colour.

Put real names into the words when the occasion does (the team's name for "home team", 外婆 for 你). Credit the song (title, writer, licence) on screen or at the end.

Pictures: the user's photos or footage first; then public-domain or openly licensed photographs or film that belong to the song (credit them); then a clean ground — colour, paper, light, a pattern — with type doing the work. Don't draw people, rooms, shops or objects you can't draw well; tighten the frame or leave them out.

## How it moves

The style, whatever the look: **the words are there before they are sung, and light up exactly as they are sung, at the speed they are sung.** The singer can always read ahead: the next line is on screen before the current one ends, in every layout. A long note lights slowly; a run of short syllables lights quickly; nothing lights ahead of the voice or lags behind it.

Choose the screen for the occasion:

- **Two rows, taking turns** (`Karaoke.ktv`) — KTV, 伴奏, the karaoke room. Top row left-aligned, bottom row right-aligned. A row gets its next line as soon as its own line has been sung, while the other row is being sung. The first pair appears a few seconds before the singing with count-in dots (`Karaoke.countdown`); an instrumental gap clears the screen.
- **Scrolling** (`Karaoke.scroll`) — lyric videos, Apple-Music-style screens, phone clips. The line being sung is in one place; when it ends, the whole column moves up over about half a second. Past lines fade or shrink; the next line waits dim below.
- **Pages** (`Karaoke.pages`) — sing-alongs and boards: one or two lines at a time, centred, and the page turns in one stroke just before the next line.
- **Blocks** — rap and fast songs: a bar (or a couplet) as one block, the next block waiting small or hollow below; when the bar ends the next block jumps into its place.
- **One line, written as sung** — each character appears as it is sung (`sing` with a faint or empty unsung fill and a soft edge); the next line waits faint below.

Choose how a word lights:

- **Wipe** (`edge: 0–4`): a hard line moving through the letters; unsung and sung differ in fill and outline (white with a dark edge → colour with a white edge). KTV.
- **Soft fill** (`edge: 40–90`, maybe `lift: 2–4`): a soft gradient sweeps through the word and the word rises a hair. Lyric videos, streaming-app lyrics.
- **Appear** (empty unsung, soft edge): handwriting-like; good with brush or kai fonts.
- **Ball** (`Karaoke.ball` + `targets`): lands on each syllable at the moment it starts, arcs to the next, rests on a long note. Use with hyphenated syllables (`hyphen: true`). The wipe can run under it or the text can stay one colour.

Around the words:

- Lines change on the song's phrases; pictures change on sections or every line or two — at a line change, never in the middle of a line.
- Picture motion is slow (a push or drift of a few percent per shot) and does not follow the beat. No flashes, zooms or shakes on the beat.
- Duets, groups and choirs: each voice has its own sung colour (`sing` with `voices`), and a small mark (name, initial, 男/女/合) at the start of a line and wherever the voice changes. Lines sung together get a group colour or the singers' colours in bands (`together`). Mark voices in `lyrics.txt` with `[name]`, in `score` with `{ voice }`; several singers are `a+b`.
- End on the song's last note: hold the last line lit, then the credits or a card for the occasion.

## Timing

**From a recording** — `python3 lyrics.py align song.mp3 lyrics.txt --out timing.json [--from 48 --to 80] [--lang zh]`

- `lyrics.txt`: one sung line per line, in sung order, repeats written out, exactly the words the singer sings; a blank line between sections. Chinese and Japanese are timed character by character; other languages word by word. Duets: `[m] 你先唱 [f] 我接着 [m+f] 一起唱` — a tag holds until the next one; words and lines get `voice`.
- It transcribes with Whisper using your lyrics as a hint, matches what it heard to your words, then aligns each line's exact words to the audio. It prints each line's times and whether the line was aligned (`forced`) or only matched (`heard`); check `heard` lines closely.
- `--from/--to` limits it to the part of the song you are using (times stay song times; `Karaoke.shift(T, -from)` moves them to video time, or cut the audio first and align the cut).
- `python3 lyrics.py check song.mp3 timing.json --out check.png`: one strip per line, the voice's spectrogram with the word starts drawn on it. A start should sit where a syllable's energy begins. If a line is off, edit its times in the json.
- The json also has `bpm`, `beats` and `downbeats` from the recording, for cutting pictures on bars.
- Hard recordings (loud band, heavy effects, rap): align a vocal stem if the user has one (an a cappella, or the full mix minus the instrumental); otherwise align short sections with `--from/--to`. When the stem and the mix are the same take, align the stem and play the mix with the times moved by their offset (`K.shift`).

**From a melody** — `Karaoke.score({ bpm, meter, start, lines, inst, v })`

When there is no lead vocal (a backing track, a sing-along you are scoring, a public-domain song you arrange), write the tune once; it times the lyrics and becomes the guide notes of the backing:

```js
const SONG = Karaoke.score({ bpm: 168, meter: 3, start: .4, inst: 'organ', lines: [
  [{ at: 12 }, ['Take', 1, 60], ['', 1], ['me', 1, 72], ['out', 1, 69], ['to', 1, 67], ['the', 1, 64], ['ball', 3, 67], ['game,', 3, 62]],
  [['pea-', 1, 64], ['nuts', 1, 65], …],                  // 'pea-' continues into the next syllable of the same word
  [['长', 1, 67], ['亭', .5, 64], ['~', .5, 67], …],       // '~' the previous syllable holds onto the next note
]});
// SONG.lines (timing) · SONG.notes (melody for sound.py) · SONG.at(beat) · SONG.beat · SONG.bar · SONG.downbeats · SONG.end
```

`[syllable, beats, midi]`; `''` is a rest; `{ at: beat }` first in a line pins where it starts. Add the accompaniment as more notes on `SONG.at(beat)`.

## karaoke.js

Page skeleton:

```html
<canvas></canvas>
<script src="karaoke.js"></script>
<script>
const K = Karaoke, S = K.create({ width: 1920, height: 1080 });
let T; const ready = K.load('timing.json').then(d => T = d);
window.__scene = K.scene(S, (c, t) => {
  // background, pictures …
  for (const s of K.ktv(T, t)) {
    const L = K.layout(c, s.line, { font: K.HEI, weight: 600, size: 84, x: s.row ? 1750 : 170, y: s.row ? 1000 : 880, align: s.row ? 'right' : 'left' });
    c.save(); c.globalAlpha = s.a; K.sing(c, L, t, { unsung: { fill: '#fff', stroke: '#111', strokeWidth: 6 }, sung: { fill: '#2350b4', stroke: '#fff', strokeWidth: 6 }, edge: 3 }); c.restore();
  }
}, { duration: 34, ready: [ready], music: { file: 'song.mp3', from: 46, fadeOut: 1.5 } });
</script>
```

- `K.layout(ctx, line, { font, weight, size, x, y, align, maxWidth, fit, tracking, leading, hyphen })` → rows of syllable units with positions and times. `maxWidth` wraps to two rows (breaking after punctuation when it can); `fit: true` shrinks to one row instead; `fit: 'fill'` scales the line to exactly `maxWidth` (justified stacks). Lay out part of a line by passing `{ ...line, words: line.words.slice(a, b) }`. `K.moved(L, dx, dy)` shifts a laid-out line.
- `K.sing(ctx, L, t, { unsung, sung, edge, curve, lift, liftTime, glow, voices, together })` — draws the line split at the sung edge. Each state: `{ fill, stroke, strokeWidth, shadow: { color, blur, x, y } }`, or a function `(word, row, L)` returning one (`word.src` is the timing's word with any field you added, e.g. a rhyme). `voices: { name: colour }` colours each word's sung fill by its voice, any number of singers; words sung by several take `voices['a+b']` if given, else `together`: a colour, `'split'` (bands, default) or `'blend'`. `K.voicePaint(ctx, voices, voice, y0, y1, together)` gives the same paint for your own marks. Respects the context's transform and alpha.
- `K.edgeX(row, t)` — where the sung edge is; `K.active(L, t)` — the syllable being sung.
- `K.ball(targets, t, { hop, height, enter, from, squash })` → `{ x, y, squash, a }`; `K.targets(L, gap)` — landing points of a laid-out line; concatenate the lines of the whole song so the ball crosses pages.
- Pagers: `K.ktv(T, t, { rows, lead, after, linger, gap, hold, fade })` → visible lines with `row` and opacity `a`; `K.scroll(T, t, { move, early })` → smooth line index; `K.pages(T, t, { per, lead, hold, fade, sections })` → the page on screen; `K.current(T, t)`; `K.countdown(t, start, beat, n)` → dots left.
- Timing: `K.load(url)`, `K.timing(obj)`, `K.score(o)`, `K.shift(T, seconds)`.
- Pictures: `K.image(src)`, `K.footage('clip.mp4')` (render.py splits it into frames; `await (await F).frame(t)`), `K.cover(ctx, img, { x, y, w, h, fx, fy, zoom, crop })`, `K.scrim(ctx, y0, y1, amt, soft)` (a dark band so lyrics read over any picture), `K.vignette(ctx, amt)`.
- Also: `K.fonts([...])` to wait for local fonts, `K.ease`, `K.seg`, `K.lerp`, `K.cl`, `K.noise`, font stacks `K.SANS K.SERIF K.HEI K.SONG K.KAI`.

`music`: `{ file, from, at, gain, fadeIn, fadeOut }` for a recording (song time `from` plays at video time `at`); `{ notes }` for a backing on sampled instruments; both together to add notes over a recording. `sounds` as in `sound.py`.

## How it looks

- Type big enough to sing from across a room: on 1920×1080, 80–140 px; on a vertical phone video, 110–150 px for the line being sung. Use local fonts only. Heavy sans or rounded for KTV and boards; the song's own mood for lyric videos (a light sans, a serif, a brush or kai face for Chinese).
- The sung and unsung states differ clearly in one thing — colour, brightness or presence — and the edge between them is visible mid-word.
- Over pictures, the lyrics sit on an outline, a shadow or a soft dark band; never thin unoutlined text on a busy photo.
- Chinese: no spaces between characters; a full-width space where the phrase breathes; punctuation dropped or kept light.
- Credits are small and do not compete with the lyrics.

## Sound

- A recording plays as it is; fade in and out at the cut points. Nothing is added on the beat.
- A backing you write (`sound.py`, sampled instruments) is light and belongs to the occasion: piano for a class or a farewell, a music box or piano for a family birthday, a Hammond organ (`hammond`) for a ballpark, guitar for a campfire. The guide melody sits in the middle register (around C4–C5), a little louder than the accompaniment; the accompaniment stays below it.
- An intro of one to four bars before the first line, long enough for the count-in; end on the last chord held.

## Examples

Read them for how the ideas are carried out, then make your own video for your song and its occasion — not a variation of the nearest example.

- `templates/karaoke-lyric-video/the-merrier.html` — a songwriter's lyric video (16:9, English, real recording): the first chorus of Josh Woodward's “The Merrier” (CC BY 4.0), timed by `lyrics.py` (`media/the-merrier-chorus.json`). Warm paper, big left-aligned type scrolling a line at a time; words darken with a soft edge and rise a hair; the paper turns cooler for the second half; credit line at the bottom.
- `templates/karaoke-ktv/songbie.html` — 《送别》KTV 伴奏 (16:9, Chinese, no vocal): the 1915 song timed from its melody with `Karaoke.score`; piano accompaniment with the guide melody; John Thomson's 1871 photographs of the Nankou pass, sepia, slow push and dissolve per line; classic two staggered rows, white with a dark edge wiping to indigo with a white edge; title card with lyricist and composer, four count-in dots, photo credit at the end.
- `templates/karaoke-ballpark/seventh-inning.html` — a ballpark sing-along on the video board (16:9, English, no vocal): “Take Me Out to the Ball Game” (1908) on Hammond organ in 3/4 with oom-pah-pah, "home team" sung as the club's name; navy board with a red header and the score strip, two lines a page, hyphenated syllables, a baseball bouncing on every syllable, gold wipe under it, LED grid over everything.
- `templates/ktv-duet/manmanzou.html` — a KTV duet backing track (16:9, Chinese, no vocal): 《慢慢走》, an original 对唱 about getting home from work, timed from its melody with voices in the score; nylon guitar, strings under the chorus, guide melody on clarinet for him and flute for her; a drawn apartment block at night across the street (only windows, wall and AC boxes), the stairwell lights coming on floor by floor as she sings 楼道的灯, the camera pulling back as the windows light up in the chorus; two staggered rows, blue for him, red for her, green together, 男/女/合 marks at each line and at the change inside a line.
- `templates/rap-lyric-video/like-a-rapper.html` — a rap verse for Reels (9:16, English, real recording): the first verse and hook of Donnie Ozone's “Like A Rapper” on Alex Beroza's remix (both CC BY 3.0), timed by `lyrics.py` on the a cappella and shifted onto the remix; black, each bar a justified stack of heavy condensed capitals, hollow until rapped and solid after, a hard edge racing through; the refrain row in yellow and the rhymes in coral; the next bar waits small below and jumps into place; credit card at the end.
- `templates/karaoke-birthday-song/waipo-85.html` — a family's birthday clip for the group chat (9:16, Chinese, no vocal): the birthday song with the third line sung to 外婆; music box and soft piano; deep red ground with a faint 寿; each line written on in kai characters as it is sung, earlier lines stacked smaller above; an end card with her age and the date.

## Check your output

- **a word lights before or after it is heard** — run `lyrics.py check`, fix the times; for score timing, check `start`, `bpm` and pickups.
- **a long note lights in an instant, or a line lights at one even speed** — the times are per line, not per word; align again or split the words.
- **the next line appears only when it starts** — give the pager more `lead`; the singer needs to read ahead.
- **lines pile up or two rows show the same line** — check the pager's options and the line breaks in the lyrics file.
- **unreadable over the picture** — add an outline, a shadow or `scrim`; darken or blur the picture.
- **everything pulses on the beat** — remove it; only the words follow the voice.
- **a crudely drawn object or person** — replace it with a real photograph or film, or a clean ground.
- **the credit is missing** — add the song's title, writer and licence, and credits for the pictures.
