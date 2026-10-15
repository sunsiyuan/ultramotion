# ultramotion

Motion templates for AI agents. Each style is an [Agent Skill](https://agentskills.io): install it, and your agent can turn one prompt into a finished video with music.

[![ultramotion styles](https://ultramotion.ai/assets/cover.jpg)](https://ultramotion.ai/)

## Install

```sh
npx skills add sunsiyuan/ultramotion
```

Or copy a style folder into your agent's skills directory, e.g. `skills/liquid-glass` → `~/.claude/skills/` (Claude Code) or `~/.codex/skills/` (ChatGPT Codex).

## Styles

| Style | | |
|---|---|---|
| [Liquid Glass](https://ultramotion.ai/templates/app-feature/) | Apple-style glass that pops, stretches, merges and bends text | 9:16, 120 BPM |
| [Kinetic Type](https://ultramotion.ai/templates/kinetic-event-poster/) | Heavy condensed type slamming in on the beat, colour-block cuts | 9:16, 128 BPM |
| [Hand-drawn Explainer](https://ultramotion.ai/templates/chalkboard-lesson/) | Whiteboard, notebook or chalkboard explainers written stroke by stroke (real stroke order for Chinese), with a camera across the board and its own music | 9:16 |
| [Variety Captions](https://ultramotion.ai/templates/talking-head-captions/) | Variety-show pop words, bursts, stamps and sound effects on your own footage, placed around the face | 9:16, on your footage |
| [Light Particles](https://ultramotion.ai/templates/product-reveal/) | Up to 1.6M glowing particles that gather into products, vehicles, towns and titles, build up in order and light up | 9:16, WebGL2 |
| [Flat Explainer](https://ultramotion.ai/templates/explain-a-number/) | Kurzgesagt-style narrated explainers: the voice-over is timed word by word and things appear as they are named | 9:16, narrated |
| [Painterly](https://ultramotion.ai/templates/van-gogh/) | Van Gogh / Loving Vincent-style oil paintings that move: thick strokes following the form, impasto lighting, the camera walking into the picture | 9:16 |
| [Ink Wash](https://ultramotion.ai/templates/ink-your-picture/) | Chinese ink painting in the manner of the Shanghai Animation Film Studio: ink spreads across rice paper, the picture keeps living, scenes dissolve through the ink, a carved seal | 9:16 |
| [Event Replay](https://ultramotion.ai/templates/election-night-map/) | A moment in history replayed from real data: from the whole to the moment, a clock that stretches the decisive minutes, a line that carries time, maps on real relief, numbers turned into things you can count | 9:16, 16:9 |
| [Data Story](https://ultramotion.ai/templates/if-you-bought/) | Years of real data played as time: decades fly and slow down where the story is, the axis grows with the data, one point named at a time, a number rolling with the line, every number next to what it should be compared with | 9:16, 16:9 |
| [Neon Sign](https://ultramotion.ai/templates/neon-shop-sign/) | A real neon sign switching on: grey glass tubes stutter, one catches late, the wall lights up in its colours and the wet street reflects it, with the transformer's hum | 9:16, 16:9, 1:1 |
| [Glitch](https://ultramotion.ai/templates/glitch-security-launch/) | Digital breakage used sparingly — splits, tears, compression blocks, datamosh — landing on the one beat that matters, closing on a CRT switch-off | 9:16, 1:1, 4:5 |
| [Infographic](https://ultramotion.ai/templates/where-the-money-goes/) | One crowd of units that lines up again for every question, one group lit at a time, a magnifying glass for the tiny and a pile off the top for the huge, from real data | 9:16, 16:9 |
| [Title Sequence](https://ultramotion.ai/templates/film-opening-credits/) | Slow film titles: one card at a time in the empty part of the frame, letters spacing out as they fade in, a new shot every card or two, grain and a piano note | 16:9, 9:16 |
| [Pixel Art](https://ultramotion.ai/templates/pixel-stream-starting/) | Low-resolution pixel art blown up with hard edges: a small palette, a stepped console clock, overworld maps and level-up screens, your own photo turned into pixels, chiptune and console sounds | 9:16, 16:9 |
| [Karaoke Lyrics](https://ultramotion.ai/templates/karaoke-lyric-video/) | Lyrics timed word by word to your recording, the next line always on screen, any number of singers each in their own colour | 9:16, 16:9 |
| [Paper Cutout](https://ultramotion.ai/templates/paper-save-the-date/) | Real-looking cut paper layered at different heights with true soft shadows: folds that open, pop-up cards and books, cut-paper titles, translucent vellum, one light and a 3D camera | 9:16, 16:9 |
| [Fluid](https://ultramotion.ai/templates/ink-logo-reveal/) | Real fluid on the GPU — ink gathering into a wordmark, light rising through water, milk poured into coffee, paper marbling — and soft colour fields that loop | 9:16, 16:9, WebGL2 |

## Requirements

A headless Chromium-based browser with WebGL, ffmpeg, and Python with numpy and scipy for the soundtrack. Variety Captions also needs Playwright, Pillow and soundfile, and finds faces with Apple Vision on macOS or MediaPipe elsewhere. Flat Explainer voices the script with `edge-tts` (free, no key) or aligns your own recording with Whisper.

## Benchmark

Every style's page on [ultramotion.ai](https://ultramotion.ai/) shows the same prompt run without and with the skill — Claude Code (Sonnet 5.5) and ChatGPT Codex (GPT-6.1-Sol), plus WorkBuddy (MiniMax M2.7) and 豆包 for some styles.

## License

MIT.
