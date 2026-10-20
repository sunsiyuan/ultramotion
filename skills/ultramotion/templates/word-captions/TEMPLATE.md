# Animated Captions · 【爆款字幕】口播逐词字幕

Talking heads, interviews, podcast clips: each word lights up as it is said, key words in colour. (口播、采访、播客切片：念到哪个词亮哪个，关键词变色)

Engine: `lib/variety-captions/` — read its GUIDE.md.

## Start from

- `koch-float.plan.json`

Read the starting page to see how it is made, then make the user's video on the same engine — copy what serves their content, change what doesn't. The camera, the motion, the pacing and the music follow what is in their content and what happens in it. What the user gives:

- Your clip (in the example: a talking-head video)
- Key words
- Colours (in the example: white, yellow, green)

Transcribe with word times (faster-whisper), write the plan the way make_plan.py does, then render with lib/variety-captions/vc.py.

Judge the result by the standard in SKILL.md (Judgment), not by how close it stays to the example. Write the content for the user's place and audience; don't translate the example's.
