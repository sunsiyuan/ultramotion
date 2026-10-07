/* 网站的 SEO 层：把 assets/site.js 里的文字预先写进每个页面的 HTML（爬虫和 LLM 不跑 JS 也能读到），
   补上 title / description / canonical / Open Graph / JSON-LD，再生成 sitemap.xml、robots.txt、llms.txt。
     node build_site.mjs
   文字只有 site.js 里那一份（T、STYLES、INSTALL），这里只读不改；加风格 = 照常加 STYLES 一行和页面，再跑一次。
   写进页面的东西都夹在 <!--pre--> … <!--/pre--> 之间，重跑会替换掉；JS 跑起来以后会照常重画这些位置。 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SITE = 'https://ultramotion.ai/';
const REPO = 'https://github.com/sunsiyuan/ultramotion';
const js = readFileSync('assets/site.js', 'utf8');
const grab = (name, close) => {
  const i = js.indexOf(`const ${name} = `) + `const ${name} = `.length, j = js.indexOf(`\n${close};`, i);
  return (0, eval)(`(${js.slice(i, j + 2)})`);
};
const T = grab('T', '}'), STYLES = grab('STYLES', ']');
const INSTALL = js.match(/const INSTALL = '([^']+)'/)[1];
const t = T.en;
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// 两篇对照页：按搜索的人会用的词写（After Effects alternative、Remotion for beginners）
const GUIDES = [
  { path: 'after-effects-alternative/', title: 'An After Effects alternative for people who just need the video',
    desc: 'Make motion graphics without learning After Effects: describe the video to Claude Code or ChatGPT Codex and an open-source motion template renders it to mp4 with music.' },
  { path: 'remotion-alternative/', title: 'Remotion for beginners — or skip the React setup',
    desc: 'Want programmatic video like Remotion without learning React and a video framework first? ultramotion templates let your AI agent write, render and score the video for you.' },
];

const PAGES = [
  { file: 'index.html', path: '', title: 'ultramotion — open-source motion graphics templates for AI agents',
    desc: 'Open-source motion templates (Agent Skills) for Claude Code and ChatGPT Codex. One prompt to a finished 9:16 motion graphics video with music — no After Effects, no Remotion project.' },
  ...STYLES.map(st => ({ file: `styles/${st.id}/index.html`, path: `styles/${st.id}/`, style: st,
    title: `${st.name.en} — motion template for AI agents | ultramotion`, desc: st.desc.en })),
  ...GUIDES.map(g => ({ file: `${g.path}index.html`, path: g.path, title: `${g.title} | ultramotion`, desc: g.desc })),
];

function fill(html, id, inner) {           // 往 id="…" 那个空容器里写；已经写过就换掉
  const k = html.indexOf(`id="${id}"`); if (k < 0) throw new Error(`no #${id}`);
  const open = html.indexOf('>', k) + 1;
  if (html.startsWith('<!--pre-->', open)) {
    const end = html.indexOf('<!--/pre-->', open) + '<!--/pre-->'.length;
    return html.slice(0, open) + `<!--pre-->${inner}<!--/pre-->` + html.slice(end);
  }
  return html.slice(0, open) + `<!--pre-->${inner}<!--/pre-->` + html.slice(open);
}
function block(html, name, inner, before) {   // <!--name--> … <!--/name-->，第一次插在 before 前面
  const a = `<!--${name}-->`, z = `<!--/${name}-->`, i = html.indexOf(a);
  if (i >= 0) return html.slice(0, i) + a + inner + z + html.slice(html.indexOf(z) + z.length);
  const k = html.indexOf(before); if (k < 0) throw new Error(`no ${before}`);
  return html.slice(0, k) + a + inner + z + '\n' + html.slice(k);
}

const ld = p => p.path === '' ? `\n<script type="application/ld+json">${JSON.stringify({
  '@context': 'https://schema.org', '@type': 'SoftwareSourceCode', name: 'ultramotion', url: SITE, codeRepository: REPO,
  description: p.desc, license: 'https://opensource.org/licenses/MIT', programmingLanguage: ['HTML', 'JavaScript', 'Python'],
  keywords: 'motion graphics, motion templates, agent skills, claude code, codex, after effects alternative, remotion alternative, AI video',
})}</script>` : '';
const head = p => `
<link rel="icon" href="/favicon.ico" sizes="32x32"><link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta name="theme-color" content="#1f1f23">
<link rel="canonical" href="${SITE}${p.path}">
<meta property="og:type" content="website"><meta property="og:site_name" content="ultramotion">
<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.desc)}">
<meta property="og:url" content="${SITE}${p.path}">
<meta property="og:image" content="${SITE}assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${SITE}assets/og.png">${ld(p)}
`;
const guideLinks = base => GUIDES.map(g => `<a href="${base}${g.path}">${g.path.startsWith('after') ? 'After Effects alternative' : 'Remotion alternative'}</a>`).join('');
const prompts = Object.fromEntries(STYLES.map(st => {
  const f = `assets/compare/${st.id}/compare.en.json`;
  return [st.id, existsSync(f) ? JSON.parse(readFileSync(f, 'utf8'))[0]?.prompt : null];
}));

// 完整提示词：assets/prompts/<id>.en.txt 原文写进页面，爬虫和 agent 不跑 JS 也能读到
const full = Object.fromEntries(STYLES.map(st => {
  const f = `assets/prompts/${st.id}.en.txt`;
  return [st.id, existsSync(f) ? readFileSync(f, 'utf8') : null];
}));

for (const p of PAGES) {
  if (!existsSync(p.file)) throw new Error(`missing ${p.file}`);
  let h = readFileSync(p.file, 'utf8');
  const base = '../'.repeat(p.path.split('/').filter(Boolean).length);
  h = h.replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`)
       .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(p.desc)}">`);
  h = block(h, 'seo', head(p), '<link rel="stylesheet"');
  if (p.path === '') {
    h = h.replace(/<h1 data-t="h1">[^<]*<\/h1>/, `<h1 data-t="h1">${esc(t.h1)}</h1>`);
    h = fill(h, 'hero-side', `<p class="lede">${esc(t.lede)}</p><div class="install"><code>${INSTALL}</code></div>`);
    h = fill(h, 'styleCards', STYLES.map(st => `<a class="style" href="styles/${st.id}/"><p><b>${esc(st.name.en)}</b><span>${esc(st.meta.en)}</span></p><p>${esc(st.desc.en)}</p></a>`).join(''));
  }
  if (p.style) {
    const st = p.style, pr = prompts[st.id];
    h = fill(h, 'detail', `<section class="detail"><div class="wrap"><a class="back" href="${base}">${esc(t.back)}</a>
<h1>${esc(st.name.en)}</h1><p class="lede">${esc(st.desc.en)}</p>
${full[st.id] ? `<p class="full-cap"><b>${esc(t.fullPrompt)}</b><span>${esc(t.fullHint)}</span></p><div class="full"><pre>${esc(full[st.id])}</pre></div>` : ''}</div></section>
<section class="use"><div class="wrap"><h2>${esc(t.use)}</h2><p>${esc(t.useText)}</p><div class="install"><code>${INSTALL}</code></div>
${pr ? `<details class="prompt"><summary>${esc(t.viewPrompt)}</summary><p>${esc(pr)}</p></details>` : ''}
<a class="src" href="${REPO}/tree/master/skills/${st.id}">${esc(t.source)}</a></div></section>`);
  }
  h = block(h, 'foot', `<div class="wrap"><span>ultramotion</span><span class="flinks">${guideLinks(base)}<a href="${REPO}">GitHub</a></span></div>`, '</footer>')
       .replace(/<footer>[\s\S]*?<!--foot-->/, '<footer><!--foot-->');
  writeFileSync(p.file, h);
  console.log(p.file);
}

writeFileSync('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${PAGES.map(p => `  <url><loc>${SITE}${p.path}</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
writeFileSync('llms.txt', `# ultramotion

> Open-source motion graphics templates for AI coding agents (Claude Code, ChatGPT Codex and other agents that load Agent Skills). Ask your agent for a video and it builds a finished vertical (9:16) motion graphics video with music from a template — no After Effects, no Remotion project, no editing skills. MIT licensed.

Install: \`${INSTALL}\`

How it works: each style is an Agent Skill. \`scene.html\` draws every frame in code (the frame is a pure function of time), \`score.py\` generates the soundtrack with numpy/scipy, and the agent renders the frames to mp4 with a headless browser and ffmpeg, then muxes the music.

## Styles

${STYLES.map(st => `- [${st.name.en}](${SITE}styles/${st.id}/): ${st.desc.en} (${st.meta.en})`).join('\n')}

## Guides

${GUIDES.map(g => `- [${g.title}](${SITE}${g.path}): ${g.desc}`).join('\n')}

## Source

- [GitHub repository](${REPO}): skills, README, license
`);
console.log('sitemap.xml robots.txt llms.txt');
