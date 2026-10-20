# Tweet to Video · 【帖子】一条帖子讲成视频

A call, a question, an announcement on X: the post as the hook, the data behind it. (大 V 的喊单、回复区、官方公告：帖子当钩子，数据讲清楚)

Engine: `lib/social-post/` — read its GUIDE.md.

## Start from

- `announcement/`
- `receipts/`
- `replies/`

Read the starting page to see how it is made, then make the user's video on the same engine — copy what serves their content, change what doesn't. The camera, the motion, the pacing and the music follow what is in their content and what happens in it. What the user gives:

- The post (in the example: its link)
- The angle (in the example: receipts / the replies / the announcement / the thread)
- The data that checks it
- The last line (in the example: See you on Dec 25.)

Start from the folder that matches the angle (receipts / replies / announcement); fetch the post with lib/social-post/fetch_post.mjs, and every number on screen comes from data/summary.py.

Judge the result by the standard in SKILL.md (Judgment), not by how close it stays to the example. Write the content for the user's place and audience; don't translate the example's.
