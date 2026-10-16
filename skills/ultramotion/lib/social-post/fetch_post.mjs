/* one post, as X shows it, through a browser logged in to X → json
   node fetch_post.mjs <post url> <out.json>        (CDP=http://127.0.0.1:9222 by default) */
import { writeFileSync } from 'node:fs';
const CDP = process.env.CDP || 'http://127.0.0.1:9222';
const [URL, OUT] = process.argv.slice(2);
const t = await (await fetch(CDP + '/json/new?' + URL, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const pend = {};
const send = (method, params = {}) => new Promise(r => { pend[++id] = r; ws.send(JSON.stringify({ id, method, params })); });
ws.onmessage = e => { const m = JSON.parse(e.data); if (pend[m.id]) pend[m.id](m.result); };
await new Promise(r => ws.onopen = r); await new Promise(r => setTimeout(r, 9000));
const p = (await send('Runtime.evaluate', { returnByValue: true, expression: `(()=>{const a=document.querySelector('article'); const un=a.querySelector('[data-testid="User-Name"]').innerText.split('\\n');
  return {url: location.href, name: un[0], handle: un[1], verified: !!a.querySelector('[data-testid="icon-verified"]'), text: a.querySelector('[data-testid="tweetText"]')?.innerText||'',
    time: a.querySelector('time')?.getAttribute('datetime'), stats: a.querySelector('[role="group"]')?.getAttribute('aria-label')||'', fetched: new Date().toISOString()}})()` })).result.value;
writeFileSync(OUT, JSON.stringify(p, null, 1)); console.log(JSON.stringify(p, null, 1));
await fetch(CDP + '/json/close/' + t.id); process.exit(0);
