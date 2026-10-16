# Animated Captions · 【爆款字幕】口播逐词字幕

Talking heads, interviews, podcast clips: each word lights up as it is said, key words in colour. (口播、采访、播客切片：念到哪个词亮哪个，关键词变色)

Engine: `lib/variety-captions/` — read its GUIDE.md.

## Start from

- `koch-float.plan.json`

Copy the starting file that matches the user's language (and the media it loads) into the project and keep its look, pacing, camera, type and music. Change only what the user's content changes:

- Your clip (in the example: a talking-head video)
- Key words
- Colours (in the example: white, yellow, green)

Transcribe with word times (faster-whisper), write the plan the way make_plan.py does, then render with lib/variety-captions/vc.py.

If the words are longer or shorter, change the size and the line breaks, not the structure. Write the content for the user's place and audience; don't translate the example's.
