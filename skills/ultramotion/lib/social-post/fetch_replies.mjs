/* the post and as many replies as X will load, through a browser logged in to X → json
   node fetch_replies.mjs '<search that finds the post>' <out.json>        (CDP=http://127.0.0.1:9222 by default) */
import { writeFileSync } from 'node:fs';
const CDP = process.env.CDP || 'http://127.0.0.1:9222';
const [Q, OUT] = process.argv.slice(2);
const u = 'https://x.com/search?q=' + encodeURIComponent(Q) + '&src=typed_query&f=live';
const t = await (await fetch(CDP + '/json/new?' + u, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = {};
const send = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (pend[m.id]) pend[m.id](m.result); };
await new Promise(r => ws.onopen = r);
const sleep = ms => new Promise(r => setTimeout(r, ms)), ev = async x => (await send('Runtime.evaluate', { returnByValue: true, expression: x })).result.value;
await sleep(8000);
const url = await ev(`(()=>{const a=document.querySelector('article'); return a && 'https://x.com' + [...a.querySelectorAll('a[href*="/status/"]')].map(x=>x.getAttribute('href')).find(h=>/status\\/\\d+$/.test(h))})()`);
if (!url) { console.log('post not found'); process.exit(1); }
await send('Page.navigate', { url }); await sleep(8000);
const ART = `a=>{const un=a.querySelector('[data-testid="User-Name"]')?.innerText.split('\\n')||[]; return {name: un[0], handle: un[1], text: a.querySelector('[data-testid="tweetText"]')?.innerText||'', time: a.querySelector('time')?.getAttribute('datetime'), stats: a.querySelector('[role="group"]')?.getAttribute('aria-label')||'', url: 'https://x.com' + ([...a.querySelectorAll('a[href*="/status/"]')].map(x=>x.getAttribute('href')).find(h=>/status\\/\\d+$/.test(h))||'')}}`;
const post = await ev(`(${ART})(document.querySelector('article'))`);
const seen = new Map(); let still = 0;
for (let i = 0; i < 400 && still < 12; i++) {
  const got = await ev(`[...document.querySelectorAll('article')].slice(1).map(${ART})`);
  const before = seen.size; for (const r of got) if (r.url && !seen.has(r.url)) seen.set(r.url, r);
  still = seen.size === before ? still + 1 : 0;
  // X tucks some replies behind "Show more replies" / "Show probable spam"
  await ev(`[...document.querySelectorAll('button,[role="button"]')].filter(b=>/^Show (more|additional) replies|Show probable spam/i.test(b.innerText)).forEach(b=>b.click())`);
  await send('Runtime.evaluate', { expression: 'scrollBy(0, 2200)' }); await sleep(1600);
  if (i % 25 === 0) console.log(i, seen.size);
}
const out = { fetched: new Date().toISOString(), post, replies: [...seen.values()].filter(r => r.handle !== post.handle || r.text !== post.text) };
writeFileSync(OUT, JSON.stringify(out, null, 1)); console.log('replies', out.replies.length, post.stats);
await fetch(CDP + '/json/close/' + t.id); process.exit(0);
