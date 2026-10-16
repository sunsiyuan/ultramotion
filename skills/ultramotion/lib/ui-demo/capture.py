"""Capture a real web page (or a run of its states) for a UI demo: screenshots, where the named elements are, how they look.

    python3 capture.py URL --out shots/name [--device phone|laptop|WxH] [--scale 3] [--full] [--dark]
                       [--find name=selector …] [--do action …] [--css "…"] [--hide selector …] [--wait ms] [--proxy http://…]

  --device   phone: 393×798 CSS px, an iPhone user agent, touch (the screen under the status bar of a 6.1" phone)
             laptop: 1440×860 (a browser window on a laptop) · or any WxH
  --scale    pixels per CSS px (phone 3, laptop 2 by default). Raise it when the camera will push in far: 4 / 3.
  --full     each shot is the whole page, for scrolling; fixed and sticky bars are cut out and saved as pins drawn on top
  --crop     with --full: stop this many CSS px down the page
  --find     name=selector: the element's box (in page coordinates), its font, colours, radius and text, in every shot.
             Playwright selectors: 'css=…', 'text=Download', 'input[type=search]', 'role=button[name="Send"]'.
  --do       what happens between shots, in order (a shot is taken after the last action if none is asked for):
               shot[:full]                  take a shot now (the viewport, or the whole page)
               click:SEL  tap:SEL  hover:SEL  focus:SEL
               type:SEL=text               types it like a person (fills the field and fires the input events)
               fill:SEL=text               replaces what is in the field at once (the demo animates the typing)
               check:SEL                   ticks a checkbox
               press:Key                   Enter, Escape, Meta+K …
               keys:text                   type into whatever has focus
               keyshots:text               the same, a shot after every character (text typed on a canvas, a terminal)
               upload:SEL=path/to/file     sets a file input (a photo to compress, a document to open)
               mouse:x,y  down  up         the mouse, in viewport CSS px — draw on a canvas app
               drag:x1,y1>x2,y2[:n]        drag in n steps (default 6) and take a shot at every step (each records dragFrom): a drag you can play back
               scroll:px  wait:ms  goto:URL  eval:js
  --css      extra CSS for the page (hide a cookie banner, a chat bubble); --hide selector does the same for one element

Writes OUT/0.png, 1.png, …, pins, and OUT/shots.js, which a page loads with Demo.shots('OUT'):
  { url, title, device, viewport: {w, h}, scale, shots: [{ src, w, h, full, statusColor, pins: [{src, x, y, w, h}],
    els: { name: { x, y, w, h, font, size, color, bg, radius, padL/R/T/B, text, placeholder } }, mouse: [x, y], act: the --do that made it }, … ] }
Everything is in CSS px of the page; a shot is w×h CSS px (the whole page when full).
"""
import argparse, json, os, re, sys, time
from pathlib import Path

PHONE_UA = ('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) '
            'Version/18.0 Mobile/15E148 Safari/604.1')

ap = argparse.ArgumentParser()
ap.add_argument('url'); ap.add_argument('--out', required=True)
ap.add_argument('--device', default='laptop'); ap.add_argument('--scale', type=float)
ap.add_argument('--full', action='store_true'); ap.add_argument('--dark', action='store_true')
ap.add_argument('--find', action='append', default=[]); ap.add_argument('--do', action='append', default=[])
ap.add_argument('--css', default=''); ap.add_argument('--hide', action='append', default=[])
ap.add_argument('--crop', type=int, help='a full page stops this many CSS px down (keeps the files small)'); ap.add_argument('--wait', type=int, default=1500); ap.add_argument('--proxy', default=os.environ.get('https_proxy') or os.environ.get('HTTPS_PROXY'))
ap.add_argument('--format', default='png', choices=['png', 'jpg'], help='jpg is 5–10× smaller; text stays clean at quality 92')
a = ap.parse_args()

out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
for f in out.glob('*'):
    if f.suffix in ('.png', '.jpg') or f.name == 'shots.js': f.unlink()
phone = a.device == 'phone'
if phone: vw, vh = 393, 798
elif a.device == 'laptop': vw, vh = 1440, 860
else: vw, vh = map(int, a.device.lower().split('x'))
scale = a.scale or (3 if phone else 2)

FIND = []
for f in a.find:
    name, sel = f.split('=', 1); FIND.append((name.strip(), sel.strip()))

STYLE_JS = r"""el => {
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  let bg = 'rgba(0, 0, 0, 0)', p = el;
  while (p && p.nodeType === 1) { const c = getComputedStyle(p).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { bg = c; break; } p = p.parentElement; }
  return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height,
    font: cs.fontFamily, size: parseFloat(cs.fontSize), weight: cs.fontWeight, color: cs.color, bg,
    radius: parseFloat(cs.borderTopLeftRadius) || 0, padL: parseFloat(cs.paddingLeft) || 0, padR: parseFloat(cs.paddingRight) || 0, padT: parseFloat(cs.paddingTop) || 0, padB: parseFloat(cs.paddingBottom) || 0,
    text: (el.value !== undefined && el.tagName !== 'BUTTON' ? el.value : el.innerText || '').trim().slice(0, 300),
    placeholder: el.getAttribute('placeholder') || '' };
}"""

PINS_JS = r"""() => {
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * .5 || r.height < 8 || r.height > innerHeight * .4) continue;
    if (r.bottom <= 0 || r.top >= innerHeight) continue;
    if (out.some(o => o.el.contains(el))) continue;
    out.push({ el, x: r.left, y: r.top, w: r.width, h: r.height });
  }
  window.__pins = out.map(o => o.el);
  return out.map(({ x, y, w, h }) => ({ x, y, w, h }));
}"""

def main():
    from playwright.sync_api import sync_playwright
    from PIL import Image
    with sync_playwright() as pw:
        kw = {'proxy': {'server': a.proxy}} if a.proxy else {}
        try: br = pw.chromium.launch(**kw)
        except Exception: br = pw.chromium.launch(channel='chrome', **kw)
        ctx = br.new_context(viewport={'width': vw, 'height': vh}, device_scale_factor=scale, is_mobile=phone, has_touch=phone,
                             user_agent=PHONE_UA if phone else None, color_scheme='dark' if a.dark else 'light', locale='en-US')
        pg = ctx.new_page()
        def go(url):                                          # pages that never go quiet (sockets, analytics) still load
            try: pg.goto(url, wait_until='networkidle', timeout=25000)
            except Exception: pg.wait_for_load_state('load', timeout=30000)
        go(a.url)
        css = a.css + ''.join(f'{s}{{display:none!important}}' for s in a.hide)
        css += '*{caret-color:transparent!important}'                 # the demo draws its own caret
        pg.add_style_tag(content=css); pg.wait_for_timeout(a.wait)
        shots, mouse = [], [vw / 2, vh / 2]
        ext = 'jpg' if a.format == 'jpg' else 'png'
        def save(path, **k):
            if ext == 'jpg': pg.screenshot(path=str(path), type='jpeg', quality=92, **k)
            else: pg.screenshot(path=str(path), **k)

        def shot(full):
            i = len(shots); src = f'{i}.{ext}'; pins = []
            if full:
                for y in range(0, pg.evaluate('document.documentElement.scrollHeight'), vh // 2):   # wake lazy images
                    pg.evaluate(f'scrollTo(0, {y})'); pg.wait_for_timeout(60)
                pg.evaluate('scrollTo(0, 0)'); pg.wait_for_timeout(400)
                boxes = pg.evaluate(PINS_JS)
                for k, b in enumerate(boxes):
                    ps = f'{i}-pin{k}.png'
                    pg.screenshot(path=str(out / ps), clip={'x': b['x'], 'y': b['y'], 'width': b['w'], 'height': b['h']}, omit_background=True)
                    pins.append({'src': ps, **b})
                pg.evaluate("() => (window.__pins || []).forEach(e => e.style.setProperty('visibility', 'hidden', 'important'))")
            els = {}
            for name, sel in FIND:
                try:
                    loc = pg.locator(sel).first
                    if loc.count() and loc.is_visible(): els[name] = loc.evaluate(STYLE_JS)
                except Exception as e: print(f'  find {name}: {str(e).splitlines()[0]}', file=sys.stderr)
            sy = pg.evaluate('scrollY')
            if not full:                                       # viewport shots: element boxes relative to the viewport
                for e in els.values(): e['y'] -= sy
            if full and a.crop: save(out / src, full_page=True, clip={'x': 0, 'y': 0, 'width': vw, 'height': min(a.crop, pg.evaluate('document.documentElement.scrollHeight'))})
            else: save(out / src, full_page=full)
            if full: pg.evaluate("() => (window.__pins || []).forEach(e => e.style.removeProperty('visibility'))")
            im = Image.open(out / src).convert('RGB'); W, H = im.size
            c = im.getpixel((W // 2, 2)); status = '#%02x%02x%02x' % c
            shots.append({'src': src, 'w': round(W / scale), 'h': round(H / scale), 'full': full, 'scrollY': 0 if full else sy,
                          'statusColor': status, 'pins': pins, 'els': els, 'mouse': list(mouse), 'act': ACT[0]})
            print(f'{src}  {W}×{H}  ' + ' '.join(els) + ('  pins: %d' % len(pins) if pins else ''))

        def split_val(s):                                     # 'SEL=value': the first '=' outside [], quotes and an engine prefix (text=, css= …)
            depth, q, start = 0, None, (s.index('=') + 1 if re.match(r'^(text|css|role|xpath|id)=', s) else 0)
            for i, ch in enumerate(s):
                if q: q = None if ch == q else q; continue
                if ch in '"\'': q = ch
                elif ch in '[(': depth += 1
                elif ch in '])': depth -= 1
                elif ch == '=' and depth == 0 and i >= start: return s[:i], s[i + 1:]
            return s, ''

        def center(sel):
            b = pg.locator(sel).first.bounding_box(); return [b['x'] + b['width'] / 2, b['y'] + b['height'] / 2]

        took = False; ACT = ['start']
        for d in a.do:
            cmd, _, arg = d.partition(':'); ACT[0] = d
            if cmd == 'shot': shot(arg == 'full' or (a.full and arg != 'view')); took = True
            elif cmd in ('click', 'tap'):
                mouse[:] = center(arg)
                loc = pg.locator(arg).first; act = loc.tap if phone else loc.click
                try: act(timeout=4000)
                except Exception: act(force=True)                 # something drawn over it (a switch's thumb) takes the click
                pg.wait_for_timeout(700)
            elif cmd == 'hover': mouse[:] = center(arg); pg.locator(arg).first.hover(); pg.wait_for_timeout(300)
            elif cmd == 'focus': pg.locator(arg).first.focus()
            elif cmd == 'type':
                s, v = split_val(arg); mouse[:] = center(s); pg.locator(s).first.click(); pg.keyboard.type(v, delay=30); pg.wait_for_timeout(600)
            elif cmd == 'fill':
                s_, v = split_val(arg); pg.locator(s_).first.fill(v); pg.wait_for_timeout(600)
            elif cmd == 'check': pg.locator(arg).first.check(force=True); pg.wait_for_timeout(700)
            elif cmd == 'press': pg.keyboard.press(arg); pg.wait_for_timeout(600)
            elif cmd == 'keys': pg.keyboard.type(arg, delay=40); pg.wait_for_timeout(400)
            elif cmd == 'keyshots':
                for ch in arg: pg.keyboard.type(ch); pg.wait_for_timeout(120); shot(False)
                took = True
            elif cmd == 'upload':
                s, v = split_val(arg); pg.locator(s).first.set_input_files(str(Path(v).resolve())); pg.wait_for_timeout(2500)
            elif cmd == 'mouse':
                x, y = map(float, arg.split(',')); mouse[:] = [x, y]; pg.mouse.move(x, y)
            elif cmd == 'down': pg.mouse.down()
            elif cmd == 'up': pg.mouse.up(); pg.wait_for_timeout(300)
            elif cmd == 'drag':
                path, _, n = arg.partition(':'); n = int(n or 6)
                (x1, y1), (x2, y2) = [map(float, p.split(',')) for p in path.split('>')]
                pg.mouse.move(x1, y1); mouse[:] = [x1, y1]; pg.mouse.down()
                for k in range(1, n + 1):
                    u = k / n; mouse[:] = [x1 + (x2 - x1) * u, y1 + (y2 - y1) * u]; pg.mouse.move(*mouse, steps=3); pg.wait_for_timeout(80)
                    if k < n: shot(False); shots[-1]['dragFrom'] = [x1, y1]
                pg.mouse.up(); pg.wait_for_timeout(250); shot(False); shots[-1]['dragFrom'] = [x1, y1]; took = True
            elif cmd == 'scroll': pg.mouse.wheel(0, float(arg)); pg.wait_for_timeout(700)
            elif cmd == 'wait': pg.wait_for_timeout(int(arg))
            elif cmd == 'goto': go(arg); pg.add_style_tag(content=css); pg.wait_for_timeout(a.wait)
            elif cmd == 'eval': pg.evaluate(arg)
            else: sys.exit(f'unknown action {d}')
        if not took: shot(a.full)
        info = {'url': pg.url, 'title': pg.title(), 'device': 'phone' if phone else 'laptop' if a.device == 'laptop' else a.device,
                'viewport': {'w': vw, 'h': vh}, 'scale': scale, 'shots': shots}
        key = out.name
        (out / 'shots.js').write_text("(window.__shots = window.__shots || {})[document.currentScript.getAttribute('src').replace(/\\/shots\\.js$/, '')] = "
                                      + json.dumps(info, indent=1) + ';\n')
        print(out / 'shots.js'); br.close()

main()
