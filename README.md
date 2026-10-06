# ultramotion

Motion templates for AI agents. Each style is an [Agent Skill](https://agentskills.io): install it, and your agent can turn one prompt into a finished video with music.

[![Liquid Glass examples](assets/cover.jpg)](https://ultramotion.ai/)

## Install

```sh
npx skills add sunsiyuan/ultramotion
```

Or copy a style folder into your agent's skills directory, e.g. `skills/liquid-glass` → `~/.claude/skills/` (Claude Code) or `~/.codex/skills/` (ChatGPT Codex).

## Styles

| Style | | |
|---|---|---|
| [Liquid Glass](https://ultramotion.ai/styles/liquid-glass/) | Apple-style glass that pops, stretches, merges and bends text | 9:16, 120 BPM |
| [Kinetic Type](https://ultramotion.ai/styles/kinetic-type/) | Heavy condensed type slamming in on the beat, colour-block cuts | 9:16, 128 BPM |
| [Hand-drawn Explainer](https://ultramotion.ai/styles/whiteboard/) | Whiteboard, notebook or chalkboard explainers written stroke by stroke (real stroke order for Chinese), with a camera across the board and its own music | 9:16 |
| [Variety Captions](https://ultramotion.ai/styles/variety-captions/) | Variety-show pop words, bursts, stamps and sound effects on your own footage, placed around the face | 9:16, on your footage |

## Requirements

A headless Chromium-based browser with WebGL, ffmpeg, and Python with numpy and scipy for the soundtrack. Variety Captions also needs Playwright, Pillow and soundfile, and finds faces with Apple Vision on macOS or MediaPipe elsewhere.

## Benchmark

Every style's page on [ultramotion.ai](https://ultramotion.ai/) shows the same prompt run without and with the skill — Claude Code (Sonnet 5.5) and ChatGPT Codex (GPT-6.1-Sol), plus WorkBuddy (MiniMax M2.7) and 豆包 for some styles.

## License

MIT. The website font in `assets/fonts` is under the SIL Open Font License.
