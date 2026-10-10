// 首页和每个风格页共用：文案、风格表、语言切换、片子、对比。
// 页面里先设 window.PAGE = { base: '' | '../../', style: '<id>' }，再引这个文件。
const PAGE = window.PAGE || { base: '' };
// 统计（GoatCounter，无 cookie）：页面浏览自动记；下面这些点击记成事件，每个回答一个问题——
// card 首页哪个风格最吸引人 · copy 有多少人真想装 · sound 有人在意声音吗 · more 有人看「更多 agent」吗 · source 开发者兴趣 · lang 中英文占比
const track = name => { try { window.goatcounter && window.goatcounter.count({ path: name, title: name, event: true }); } catch (e) {} };
const here = () => PAGE.style || 'home';
const BASE = PAGE.base || '';

const T = {
  en: { navStyles: 'Styles', h1: 'Motion templates for AI agents.', lede: 'Open source. One prompt to a finished video, music included.',
        styles: 'Styles', copy: 'Copy', copied: 'Copied', other: '中文', soundOn: 'Play with sound', soundOff: 'Mute',
        back: '← All styles', demos: 'Examples', use: 'Use it', useText: 'Install the skills, then ask your agent for a video in this style. For example:',
        source: 'Source on GitHub →', bench: 'Same prompt, without and with the skill', without: 'Without skill', with: 'With skill',
        viewPrompt: 'View the prompt', more: 'More agents',
        fullPrompt: 'Full prompt', fullHint: 'Paste it into Claude Code, Codex or any agent to make the first video above.', copyPrompt: 'Copy prompt', showAll: 'Show all', showLess: 'Show less',
        deliver: 'Rather not set it up? We’ll make the video for you →',
        },
  zh: { navStyles: '风格', h1: '给 AI 用的动效模板', lede: '开源。一句话，做出带配乐的完整视频。',
        styles: '风格', copy: '复制', copied: '已复制', other: 'EN', soundOn: '打开声音', soundOff: '静音',
        back: '← 全部风格', demos: '示例', use: '怎么用', useText: '装上 skill，然后让你的 agent 做一个这种风格的视频。比如：',
        source: '在 GitHub 上看源码 →', bench: '同一句提示词，没使用 skill 和使用 skill', without: '没使用 skill', with: '使用 skill',
        viewPrompt: '查看提示词', more: '更多 agent',
        fullPrompt: '完整提示词', fullHint: '粘贴给 Claude Code、Codex 或任何 agent，做出上面第一条视频。', copyPrompt: '复制提示词', showAll: '展开全部', showLess: '收起',
        deliver: '不想自己装？我们直接交成片 →',
        },
};
let lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('lang') || 'en';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;     // 要求少动画时，视频不自动播
const play = v => { if (!still) v.play().catch(() => {}); };

// 风格表：网站上跟风格有关的东西都从这里读，加一个风格 = 加一行（再加一个 styles/<id>/index.html）。
// v：片子按语言换文件的后缀；cover：卡片和首屏用哪条、从第几秒开始；demos：详情页的示例片
const STYLES = [
  { id: 'liquid-glass', name: { en: 'Liquid Glass', zh: '液态玻璃' }, meta: { en: '9:16, 120 BPM', zh: '9:16，120 BPM' }, v: { en: '-en', zh: '' },
    cover: ['showcase', 8.6], demos: ['showcase', 'opener', 'product', 'search', 'data'],
    desc: { en: 'Apple-style glass that pops, stretches, merges and bends the text behind it, on a soft gradient, cut to a beat.',
            zh: '苹果风格的液态玻璃：弹出、拉长、融合，透过它的字会被放大、弯折，跟着节拍走。' } },
  { id: 'kinetic-type', name: { en: 'Kinetic Type', zh: '动感排版' }, meta: { en: '9:16, 128 BPM', zh: '9:16，128 BPM' }, v: { en: '', zh: '-zh' },
    cover: ['showcase', 2.2], fixed: ['ex-night-market-retro', 'ex-type-coffee-swiss', 'ex-arcade-night-neon'],
    demos: { en: ['showcase', 'ex-type-coffee-swiss', 'ex-arcade-night-neon', 'ex-night-market-retro', 'quote', 'countdown'],
             zh: ['showcase', 'ex-night-market-retro', 'ex-arcade-night-neon', 'ex-type-coffee-swiss', 'quote', 'countdown'] },
    desc: { en: 'Heavy condensed type slamming in on the beat, with full-frame colour-block cuts — for gig promos, quotes and countdowns.',
            zh: '粗重的窄体大字踩着鼓点砸进来，整屏色块切换，适合演出宣传、引语和倒数。' } },
  { id: 'variety-captions', name: { en: 'Variety Captions', zh: '综艺花字' }, meta: { en: 'On your footage', zh: '叠在实拍视频上' }, v: { en: '-en', zh: '-zh' },
    cover: ['demo', 7.0], demos: ['demo'],
    desc: { en: 'Variety-show captions on your own footage: pop words, bursts, stamps, subtitles and sound effects, placed around the face.',
            zh: '给你自己的视频加综艺花字：大字、爆炸框、印章、字幕和音效，自动避开人脸。' } },
  // 手绘白板有好几种样子（黑板 / 白板 / 笔记本 / 彩色），文件名自带语言，按语言给出整份清单
  { id: 'whiteboard', name: { en: 'Hand-drawn Explainer', zh: '手绘白板' }, meta: { en: '9:16, written stroke by stroke', zh: '9:16，一笔一画写出来' }, v: { en: '', zh: '' },
    cover: { en: ['chalk-en', 8.0], zh: ['chalk-zh', 9.0] },
    demos: { en: ['chalk-en', 'colorful-en', 'notebook-en', 'chalk-zh', 'board-zh'], zh: ['chalk-zh', 'board-zh', 'chalk-en', 'colorful-en', 'notebook-en'] },
    desc: { en: 'Whiteboard, notebook or chalkboard explainers, written stroke by stroke as the camera moves across the board, with its own music.',
            zh: '白板、笔记本或黑板讲解，一笔一画写出来（中文是真实笔顺），镜头在板上移动，配乐自己写。' } },
  // 光粒子：五条示例各是一场本地内容，文件名自带语言
  { id: 'light-particles', name: { en: 'Light Particles', zh: '光粒子' }, meta: { en: '9:16, up to 1.6M particles', zh: '9:16，最多 160 万颗粒子' }, v: { en: '', zh: '' },
    cover: { en: ['hover-bike-en', 20.0], zh: ['water-town-zh', 20.0] },
    demos: { en: ['hover-bike-en', 'aurora-launch-en', 'water-town-zh', 'new-year-zh', 'city-night-zh'], zh: ['water-town-zh', 'new-year-zh', 'city-night-zh', 'hover-bike-en', 'aurora-launch-en'] },
    desc: { en: 'Hundreds of thousands of glowing particles that gather into products, vehicles, towns and titles, build up in order and light up — for reveals, launches and greetings.',
            zh: '几十万到上百万颗发光粒子聚成产品、飞行器、整片街区和标题，按顺序搭起来、再亮灯，适合发布、揭晓和节日祝福。' } },
  // 扁平科普：先配音、每个字带时间，画面按字出场；两条示例各是一场本地内容，文件名不带语言
  { id: 'flat-explainer', name: { en: 'Flat Explainer', zh: '扁平科普' }, meta: { en: '9:16, narrated', zh: '9:16，带旁白' }, v: { en: '', zh: '' },
    cover: { en: ['planets-gap', 12.0], zh: ['water-drop', 9.5] },
    demos: { en: ['planets-gap', 'water-drop'], zh: ['water-drop', 'planets-gap'] },
    desc: { en: 'Kurzgesagt-style narrated explainers: the voice-over is timed word by word, things pop in as they are named, the camera travels across scales, flat shapes with soft three-tone shading.',
            zh: '像 Kurzgesagt 那样的带旁白科普动画：配音逐字对时，说到什么什么就出现，镜头一路跨尺度推进，扁平插画加三层明暗。' } },
  // 名画笔触：示例贴近原画，中英文同一套
  { id: 'painterly', name: { en: 'Painterly', zh: '名画笔触' }, meta: { en: '9:16, oil paint that moves', zh: '9:16，会动的油画' }, v: { en: '', zh: '' },
    cover: ['starry-night', 6.0], demos: ['starry-night', 'sunflowers', 'wheatfield-crows', 'cafe-terrace'],
    desc: { en: 'A living oil painting in the manner of Van Gogh and Loving Vincent: thick brush strokes that follow the form, a sky that turns, impasto catching the light, the camera walking into the picture.',
            zh: '像梵高和《至爱梵高》那样会动的油画：厚厚的笔触顺着形体走，天空在转，颜料的厚度反着光，镜头走进画里。' } },
  // 水墨：五条示例题材各不相同，中英文同一套
  { id: 'ink-wash', name: { en: 'Ink Wash', zh: '水墨晕染' }, meta: { en: '9:16, ink that spreads and lives', zh: '9:16，会晕开、会活的墨' }, v: { en: '', zh: '' },
    cover: ['jiangnan-rain', 9.0], demos: ['jiangnan-rain', 'shrimp', 'tadpoles', 'plum', 'bailu'],
    desc: { en: 'Chinese ink painting in the manner of the Shanghai Animation Film Studio: ink creeps across rice paper, the painting keeps living — rain, mist, a boat, a school of tadpoles — scenes dissolve through the ink, a seal at the end.',
            zh: '上海美术电影制片厂那样的水墨动画：墨在宣纸上晕开，画一直活着——雨、雾、小船、一群蝌蚪，一幕化开成下一幕，最后落印。' } },
];
const STYLE = Object.fromEntries(STYLES.map(s => [s.id, s]));
const INSTALL = 'npx skills add sunsiyuan/ultramotion';

// 对比里展示哪些 agent：每种语言先放两组主流的，其余收进「更多」；英文不放豆包
const AGENT = name => /豆包|Doubao/i.test(name) ? 'doubao' : /MiniMax/i.test(name) ? 'minimax' : /Haiku|Luna/i.test(name) ? 'other' : /Codex|GPT/i.test(name) ? 'codex' : /Sonnet|Claude/i.test(name) ? 'sonnet' : 'other';
const PRIMARY = { en: ['sonnet', 'codex'], zh: ['codex', 'doubao'] };
const ORDER = ['codex', 'sonnet', 'doubao', 'minimax', 'other'];
const HIDDEN = { en: ['doubao'], zh: [] };

// fixed：只有一种语言的示例片（文件名不带语言后缀）
const src = (st, clip, l = lang) => `${BASE}assets/${st.id}/${clip}${(st.fixed || []).includes(clip) ? '' : st.v[l]}.mp4`;
// 只有一条示例、而且中英文是两场不同内容的风格：两种语言的示例都放，当前语言在前
const coverOf = st => Array.isArray(st.cover) ? st.cover : st.cover[lang];
const demoList = st => !Array.isArray(st.demos) ? st.demos[lang].map(c => [c, lang]) : st.demos.length === 1 && st.v.en !== st.v.zh ? [[st.demos[0], lang], [st.demos[0], lang === 'en' ? 'zh' : 'en']] : st.demos.map(c => [c, lang]);
function setClips() {
  document.querySelectorAll('video[data-clip]').forEach(v => {
    const st = STYLE[v.dataset.style], [clip, t0] = 'cover' in v.dataset ? coverOf(st) : [v.dataset.clip, v.dataset.t0];
    const s = src(st, clip, v.dataset.lang || lang) + (t0 ? `#t=${t0}` : '');
    if (v.getAttribute('src') !== s) { v.src = s; if (v.hasAttribute('data-auto')) play(v); }
  });
}

// 声音（只在详情页）：每条视频右下角一个喇叭，点开一条，其余全部静音；对比那一组四条一起从头放
const ICON = '<svg class="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="m22 9-6 6m0-6 6 6"/></svg>'
  + '<svg class="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
function muteAll() {
  document.querySelectorAll('video').forEach(v => { v.muted = true; });
  document.querySelectorAll('.snd').forEach(b => { b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', T[lang].soundOn); });
}
function addSound(root) {
  root.querySelectorAll('video:not([data-snd])').forEach(v => {
    v.dataset.snd = 1;
    const wrap = document.createElement('span'); wrap.className = 'vid'; v.before(wrap); wrap.append(v);
    const b = document.createElement('button'); b.className = 'snd'; b.innerHTML = ICON;
    b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', T[lang].soundOn); wrap.append(b);
    b.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      const was = !v.muted; muteAll(); if (was) return;
      track(`sound/${here()}/${v.closest('[data-group]') ? (v.closest('.bench > div')?.querySelector('h3')?.firstChild.textContent.trim() || 'compare') : 'demo'}`);
      const group = v.closest('[data-group]');
      if (group) group.restart(); else { v.currentTime = 0; v.play().catch(() => {}); }
      v.muted = false; b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', T[lang].soundOff);
    };
  });
}
// 一组视频一起从头放，短的停在最后一帧，等都放完再一起重来
function syncGroup(el) {
  const vs = [...el.querySelectorAll('video')], restart = () => vs.forEach(v => { v.currentTime = 0; v.play().catch(() => {}); });
  el.restart = restart;
  vs.forEach(v => v.addEventListener('ended', () => { if (vs.every(x => x.ended)) restart(); }));
  if (!still) restart();
}

// 「交给我们做」的 Tally 表单，中英各一张。这一行由 repo-tools/tally/build.mjs 写，别手改
const FORMS = {"zh": "gDyM8d", "en": "yPK984"};
// 首页两类人：装 skill 的（上面那行命令）和要我们直接交片的（这个按钮）。点开记 deliver，交了记 deliver-sent
function deliverLink() { return `<button class="deliver">${T[lang].deliver}</button>`; }
function wireDeliver() {
  document.querySelectorAll('.deliver').forEach(b => b.onclick = async () => {
    track(`deliver/${here()}`);
    if (!window.Tally) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://tally.so/widgets/embed.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    Tally.openPopup(FORMS[lang], { layout: 'modal', width: 560, onSubmit: () => track(`deliver-sent/${here()}`) });
  });
}

function installBox() {
  return `<div class="install"><code>${INSTALL}</code><button class="copy">${T[lang].copy}</button></div>`;
}
function wireCopy() {
  document.querySelectorAll('.install .copy').forEach(b => b.onclick = () => { navigator.clipboard.writeText(INSTALL); b.textContent = T[lang].copied; track(`copy/${here()}`); });
}

/* ---------- 首页 ---------- */
function home() {
  const t = T[lang];
  document.getElementById('hero-side').innerHTML = `<p class="lede">${t.lede}</p><div>${installBox()}${deliverLink()}</div>`;
  const banner = document.getElementById('banner');
  if (!banner.children.length) {
    // 横幅：一条片子穿过所有风格，静音自动播，右下角喇叭开声音
    const tall = matchMedia('(max-width: 700px)').matches, v = tall ? '-m' : '';    // 手机上放竖版（4:5）
    banner.classList.toggle('tall', tall);
    banner.innerHTML = `<video src="${BASE}assets/hero${v}.mp4" poster="${BASE}assets/hero${v}.jpg" muted loop playsinline data-auto></video>`;
    play(banner.querySelector('video')); addSound(banner);
    document.getElementById('styleCards').innerHTML = STYLES.map(st => `<a class="style" href="${BASE}styles/${st.id}/" onclick="track('card/${st.id}')">
      <video data-style="${st.id}" data-clip="cover" data-cover muted loop playsinline data-auto></video>
      <p><b data-name="${st.id}"></b><span data-meta="${st.id}"></span></p></a>`).join('');
  }
}

/* ---------- 风格详情页 ---------- */
function benchHTML(groups) {
  const t = T[lang];
  return `<div class="bench" data-group>${groups.map(g => {
    const [agent, model] = g.name.split('·').map(x => x.trim());
    return `<div><h3>${agent}<span>${model || ''}</span></h3><div class="pair">
      <div><video src="${BASE}${g.before.video}" muted playsinline></video><p>${t.without}</p></div>
      <div class="with"><video src="${BASE}${g.after.video}" muted playsinline></video><p>${t.with}</p></div></div></div>`;
  }).join('')}</div>`;
}
function detail(id) {
  const st = STYLE[id], t = T[lang], el = document.getElementById('detail');
  document.title = `${st.name[lang]} — ultramotion`;
  el.innerHTML = `<section class="detail"><div class="wrap">
      <a class="back" href="${BASE}">${t.back}</a>
      <h1>${st.name[lang]}</h1><p class="lede">${st.desc[lang]}</p>
      <div class="demos">${demoList(st).map(([c, l]) => `<video data-style="${id}" data-clip="${c}" data-lang="${l}" muted loop playsinline data-auto></video>`).join('')}</div>
      <div id="full" hidden><p class="full-cap"><b>${t.fullPrompt}</b><span>${t.fullHint}</span></p>
        <div class="full"><button class="copy">${t.copyPrompt}</button><pre id="fullText"></pre><button class="more-btn">${t.showAll}</button></div></div>
    </div></section>
    <section class="use"><div class="wrap"><h2>${t.use}</h2><p>${t.useText}</p>${installBox()}
      <details class="prompt"><summary>${t.viewPrompt}</summary><p id="prompt"></p></details>
      <a class="src" href="https://github.com/sunsiyuan/ultramotion/tree/master/skills/${id}" onclick="track('source/${id}')">${t.source}</a></div></section>
    <section id="compare"><div class="wrap"><h2>${t.bench}</h2><div id="benchMain"></div><div id="benchMore"></div></div></section>`;
  setClips(); addSound(el.querySelector('.demos'));
  // 完整提示词：assets/prompts/<id>.<lang>.txt 是唯一一份，没有这个文件就不显示
  fetch(`${BASE}assets/prompts/${id}.${lang}.txt`).then(r => r.ok ? r.text() : null).then(txt => {
    const box = document.getElementById('full'); if (!txt || !box) return;
    box.querySelector('#fullText').textContent = txt; box.hidden = false;
    const cp = box.querySelector('.copy'), mb = box.querySelector('.more-btn');
    cp.onclick = () => { navigator.clipboard.writeText(txt); cp.textContent = t.copied; track(`prompt/${id}`); };
    mb.onclick = () => { const open = box.querySelector('.full').classList.toggle('open'); mb.textContent = open ? t.showLess : t.showAll; };
  });
  const base = `${BASE}assets/compare/${id}/compare.`;
  fetch(base + lang + '.json').then(r => r.ok ? r.json() : fetch(base + 'zh.json').then(r => r.json())).then(all => {
    const shown = all.filter(g => !HIDDEN[lang].includes(AGENT(g.name)));
    const rank = g => { const k = AGENT(g.name), p = PRIMARY[lang].indexOf(k); return p >= 0 ? p : 10 + ORDER.indexOf(k); };
    shown.sort((a, b) => rank(a) - rank(b));
    const main = shown.slice(0, 2), more = shown.slice(2);
    document.getElementById('prompt').textContent = all[0].prompt;
    const m = document.getElementById('benchMain'); m.innerHTML = benchHTML(main); syncGroup(m.firstElementChild); addSound(m);
    const mo = document.getElementById('benchMore');
    if (more.length) {
      mo.innerHTML = `<details class="more"><summary>${t.more} (${more.map(g => g.name.split('·')[0].trim()).join(', ')})</summary>${benchHTML(more)}</details>`;
      const d = mo.querySelector('details'), grp = d.querySelector('[data-group]');
      addSound(d); d.addEventListener('toggle', () => { if (d.open) { syncGroup(grp); track(`more/${id}`); } else grp.querySelectorAll('video').forEach(v => v.pause()); }, { once: false });
    } else mo.innerHTML = '';
  });
}

/* ---------- 共用 ---------- */
function apply() {
  const t = T[lang];
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-t]').forEach(el => el.textContent = t[el.dataset.t]);
  document.getElementById('lang').textContent = t.other;
  if (PAGE.style) detail(PAGE.style); else home();
  document.querySelectorAll('[data-name]').forEach(el => el.textContent = STYLE[el.dataset.name].name[lang]);
  document.querySelectorAll('[data-meta]').forEach(el => el.textContent = STYLE[el.dataset.meta].meta[lang]);
  muteAll(); setClips(); wireCopy();
}
document.getElementById('lang').onclick = () => { lang = lang === 'en' ? 'zh' : 'en'; localStorage.setItem('lang', lang); track(`lang/${lang}`); apply(); };
apply();
