# Tweet to Video · 【帖子】一条帖子讲成视频

A call, a question, an announcement on X: the post as the hook, the data behind it. (大 V 的喊单、回复区、官方公告：帖子当钩子，数据讲清楚)

Engine: `lib/social-post/` — read its GUIDE.md.

## Start from

- `announcement/`
- `receipts/`
- `replies/`

Copy the starting file that matches the user's language (and the media it loads) into the project and keep its look, pacing, camera, type and music. Change only what the user's content changes:

- The post (in the example: its link)
- The angle (in the example: receipts / the replies / the announcement / the thread)
- The data that checks it
- The last line (in the example: See you on Dec 25.)

Start from the folder that matches the angle (receipts / replies / announcement); fetch the post with lib/social-post/fetch_post.mjs, and every number on screen comes from data/summary.py.

If the words are longer or shorter, change the size and the line breaks, not the structure. Write the content for the user's place and audience; don't translate the example's.
