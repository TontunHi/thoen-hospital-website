// OpenDesigner reference reader. Paste into a browser tool's JavaScript runner on a page the person
// approved (Claude in Chrome javascript_tool, Playwright page.evaluate, DevTools console). It only reads
// computed styles and same-origin stylesheets and returns JSON; it sends nothing anywhere. Save the
// result as page.json, then run:  python3 css_scan.py --from-json page.json --json
//
// It records values by role, so css_scan.py can tell body text from headings and buttons from links:
//   text sizes weighted by characters of visible text: body (running text), heading, nav, caption
//     (footer, small print, legal), control, code, label (short UI text and link lists), noise
//     (one unbroken string of 30 or more characters, such as base-64 used as decoration; never body text)
//   corner radii of controls (buttons, inputs), containers (cards, dialogs, menus), inline links,
//     decoration (badges, pills, dots) and media
//   colors on buttons, links with their own text, selected states, :focus rules (error states left
//     out), colored words inside headings and paragraphs (emphasis), and accent custom properties
//   box shadows (text shadows are never read), borders drawn by ::before and ::after, and depth drawn
//     with stacked boxes: offset slabs, frames and window title bars
//   motion split three ways: UI transitions, one-shot entrances, and loops that always run
//   the page as painted, on a 16 px grid: area share of each background color, full-width sections in
//     order, imagery, gradients and whitespace (no text, control or card-sized box; media is imagery)
//   type roles (family, weight, size, tracking, case and line height per role), loaded font faces,
//     component signatures (buttons, links, fields, chips, nav, cards) and voice statistics
// Voice is counts only (case, words per line, end punctuation, digits, emoji): no text is returned.
// Cookie and consent banners are left out. Motion is only what the browser exposes: canvas drawing and
// hover, focus or open states need interaction. Under Node this file only exports its pure helpers
// (used by test_extract.py).
(() => {
  // ---------- pure helpers ----------
  const splitTop = s => { // split on commas that are not inside parentheses: cubic-bezier(a, b, c, d), linear(...)
    const out = []; let depth = 0, cur = '';
    for (const ch of String(s == null ? '' : s)) {
      if (ch === '(') depth++;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      if (ch === ',' && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  const toMs = t => { t = String(t).trim(); const v = parseFloat(t); if (isNaN(v)) return 0; return t.endsWith('ms') ? v : v * 1000; };
  const parseRgb = c => { // computed sRGB colors: rgb(r, g, b) / rgba(r, g, b, a) / rgb(r g b / a)
    const m = String(c || '').match(/^rgba?\(([^()]*)\)$/); if (!m) return null;
    const p = m[1].split(/[\s,\/]+/).filter(Boolean); if (p.length < 3) return null;
    const ch = p.slice(0, 3).map(v => v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v));
    if (ch.some(isNaN)) return null;
    const a = p.length > 3 ? (p[3].endsWith('%') ? parseFloat(p[3]) / 100 : parseFloat(p[3])) : 1;
    return { hex: '#' + ch.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''), a };
  };
  const radiusValue = (r, w, h) => { // "6px" -> 6, pills and circles -> "full", "50%" -> "full"
    const first = String(r || '').trim().split(/\s+/)[0]; const v = parseFloat(first);
    if (isNaN(v)) return null;
    const side = Math.min(w || 0, h || 0);
    const px = first.endsWith('%') ? v / 100 * side : v;
    if ((first.endsWith('%') && v >= 50) || px >= 999 || (px > 0 && side > 0 && px >= side / 2 - 0.5)) return 'full';
    return Math.round(px);
  };
  const bump = (o, k, n = 1) => { if (k !== '' && k != null) o[k] = (o[k] || 0) + n; };
  const bumpIn = (o, group, k, n = 1) => { if (k === '' || k == null) return; (o[group] = o[group] || {}); bump(o[group], k, n); };
  const solid = c => c && c.a >= 0.5;
  const shadowVisible = sh => splitTop(sh === 'none' ? '' : sh).some(l => { // any outer layer with color and size
    const m = l.match(/rgba?\([^()]*\)/); const c = m ? parseRgb(m[0]) : null;
    const sizes = (l.replace(/rgba?\([^()]*\)/, '').match(/-?\d*\.?\d+px/g) || []).map(parseFloat);
    return !/\binset\b/.test(l) && (!c || c.a > 0) && sizes.some(n => n !== 0); });
  // The browser's own link colors (link, visited, active): a wrapper link around a card shows them without the
  // site choosing them.
  const UA_LINK = new Set(['#0000ee', '#551a8b', '#ee0000']);
  // Spatial properties move or resize something; color and opacity changes are fades.
  const SPATIAL = /^(all|transform|translate|scale|rotate|top|left|right|bottom|inset|width|height|max-height|max-width|margin.*|padding.*|grid.*|flex.*|offset.*|clip-path)$/;
  const propKind = p => p === 'none' ? null : SPATIAL.test(p) ? 'spatial' : /opacity|filter|visibility/.test(p) ? 'opacity' : 'color';

  // Text role: headings, navigation, small print, controls and code are kept apart from running text;
  // link text outside a paragraph (link lists, card links) and short text are UI labels.
  const textRole = d => d.noise ? 'noise' : d.ctx || (d.linkText ? 'label' : (d.prose || d.own >= 40) ? 'body' : 'label');

  // Radius role: only controls and containers describe a system's corner style, and only when the
  // corner is visible (a fill, a border or a shadow); a transparent text button has no visible corner.
  const radiusRole = (d, r, vw) => {
    if (d.media) return 'media';
    const surface = solid(d.bg) || (d.border && d.border.w > 0 && d.border.a > 0) || shadowVisible(d.boxShadow);
    if (d.buttonLike || d.formField) return surface ? 'control' : 'bare';
    if (d.link) return 'link';
    const sized = d.w >= 120 && d.h >= 48 && (!vw || d.w < 0.95 * vw);
    if (surface && sized && (r !== 0 || d.containerHint)) return 'container';
    return r ? 'decor' : null;
  };

  // Motion layers of one element: [kind, ms, easing, property kind]. A CSS animation that repeats forever, or runs
  // 2 s or longer more than once, is a loop (ambient motion), never UI timing; other animations are entrances.
  const motionLayers = d => {
    const out = [];
    if (d.transition) {
      const [props, durs, fns] = d.transition, P = splitTop(props), D = splitTop(durs), F = splitTop(fns);
      P.forEach((p, i) => { if (p === 'none' || !D.length) return;
        const ms = Math.round(toMs(D[i % D.length])); if (ms > 0) out.push(['ui', ms, F.length ? F[i % F.length] : 'ease', propKind(p)]); });
    }
    if (d.animation) {
      const [names, durs, fns, iters] = d.animation, N = splitTop(names), D = splitTop(durs), F = splitTop(fns), I = splitTop(iters || '1');
      N.forEach((n, i) => { if (n === 'none' || !D.length) return;
        const ms = Math.round(toMs(D[i % D.length])), it = I.length ? I[i % I.length] : '1';
        const loop = it === 'infinite' || (ms >= 2000 && parseFloat(it) > 1);
        if (ms > 0) out.push([loop ? 'loop' : 'entrance', ms, F.length ? F[i % F.length] : 'ease', null]); });
    }
    return out;
  };

  // d = one element described by describe() below (or a plain object in tests).
  function collect(items, vw) {
    const V = { colors: {}, fontFamilies: {}, fontSizes: {}, lineHeights: {}, fontWeights: {}, spacing: {},
      radii: {}, shadows: {}, durations: {}, easings: {},
      textSizes: {}, textElements: {}, radiiByRole: {}, accentSources: {},
      transitionKinds: {}, entrances: {}, loops: { durations: {}, easings: {}, count: 0 },
      borders: {}, borderColors: {}, typeRoles: {} };
    let under24 = 0;
    for (const d of items) {
      if (d.own > 0 && d.fontSize > 0) {
        const role = textRole(d), px = Math.round(d.fontSize);
        bumpIn(V.textSizes, role, px, d.own); bumpIn(V.textElements, role, px, 1);
        if (role !== 'noise') { bump(V.fontSizes, px); bump(V.fontFamilies, d.fontFamily, d.own); }
        bump(V.fontWeights, d.fontWeight); bump(V.lineHeights, d.lineHeight);
        if (d.color && d.color.a > 0) bump(V.colors, d.color.hex);
        const R = V.typeRoles[role] = V.typeRoles[role] || { families: {}, weights: {}, sizes: {}, tracking: {}, transform: {}, lineHeight: {}, chars: 0, faces: {} };
        R.chars += d.own; bump(R.families, d.fontFamily, d.own); bump(R.weights, d.fontWeight, d.own); bump(R.sizes, px, d.own);
        const F = R.faces[d.fontFamily] = R.faces[d.fontFamily] || { sizes: {}, weights: {} };
        bump(F.sizes, px, d.own); bump(F.weights, d.fontWeight, d.own);
        if (d.tracking != null) bump(R.tracking, d.tracking, d.own);
        if (d.transform) bump(R.transform, d.transform, d.own);
        const lh = parseFloat(d.lineHeight); if (lh > 0 && d.fontSize > 0) bump(R.lineHeight, Math.round(lh / d.fontSize * 20) / 20, d.own);
      }
      if (d.bg && d.bg.a > 0) bump(V.colors, d.bg.hex);
      if (d.border && d.border.w > 0 && d.border.a > 0) {
        bump(V.colors, d.border.hex);
        bump(V.borders, Math.round(d.border.w * 2) / 2 + 'px' + (d.border.pseudo ? ' drawn' : ''));
        bump(V.borderColors, d.border.hex);
      }
      for (const v of d.spacing || []) { const n = Math.round(v); if (n > 0 && n <= 160) bump(V.spacing, n); }
      const r = radiusValue(d.radius, d.w, d.h);
      const rr = r === null ? null : radiusRole(d, r, vw);
      if (rr && (r !== 0 || rr === 'control' || rr === 'container')) { bumpIn(V.radiiByRole, rr, r); if (r !== 0) bump(V.radii, r); }
      if (d.boxShadow && d.boxShadow !== 'none' && shadowVisible(d.boxShadow)) bump(V.shadows, d.boxShadow);
      // accent candidates: colors that mark interaction or emphasis
      if (d.buttonLike) {
        if (solid(d.bg)) bumpIn(V.accentSources, 'button', d.bg.hex);
        if (d.border && d.border.w > 0 && solid(d.border)) bumpIn(V.accentSources, 'buttonBorder', d.border.hex);
        if (solid(d.color)) bumpIn(V.accentSources, 'buttonText', d.color.hex);
      } else if (d.link && solid(d.color) && d.own > 0 && !UA_LINK.has(d.color.hex)) bumpIn(V.accentSources, 'link', d.color.hex);
      if (d.emphasis && solid(d.color)) bumpIn(V.accentSources, 'emphasis', d.color.hex, Math.max(1, Math.min(4, Math.round(d.own / 10))));
      if (d.selected) for (const c of [d.bg, d.color, d.border]) if (solid(c) && (c !== d.border || d.border.w > 0)) bumpIn(V.accentSources, 'selected', c.hex);
      if (d.formField && solid(d.accentColor)) bumpIn(V.accentSources, 'control', d.accentColor.hex);
      // motion: UI transitions keep their own duration list (the Energy dial); loops and entrances are kept apart
      const seen = new Set();
      for (const [kind, ms, fn, pk] of motionLayers(d)) {
        if (seen.has(kind + ms + fn)) continue; seen.add(kind + ms + fn);
        if (kind === 'ui') { bump(V.durations, ms); bump(V.easings, fn); bump(V.transitionKinds, pk); }
        else if (kind === 'loop') { V.loops.count++; bump(V.loops.durations, ms); bump(V.loops.easings, fn); }
        else bump(V.entrances, ms);
      }
      if ((d.buttonLike || d.formField) && (d.w < 24 || d.h < 24)) under24++;
    }
    return { values: V, targetsUnder24: under24 };
  }

  // Voice statistics of lines of UI text, without keeping the text.
  const caseOf = t => {
    const words = t.split(/\s+/).filter(w => /\p{L}/u.test(w)); if (!words.length) return null;
    const letters = t.replace(/[^\p{L}]/gu, '');
    if (letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase()) return 'upper';
    if (letters === letters.toLowerCase()) return 'lower';
    const caps = words.filter(w => /^\P{L}*\p{Lu}/u.test(w)).length;
    if (words.length > 1 && caps / words.length >= 0.75) return 'title';
    return 'sentence';
  };
  const voiceOf = texts => {
    const out = { n: 0, words: 0, case: {}, period: 0, exclaim: 0, question: 0, digits: 0, emoji: 0 };
    for (const raw of texts) {
      const t = String(raw).replace(/\s+/g, ' ').trim(); if (!t || t.length > 300) continue;
      out.n++; out.words += t.split(' ').length; bump(out.case, caseOf(t));
      if (/\.$/.test(t)) out.period++;
      if (/!/.test(t)) out.exclaim++;
      if (/\?$/.test(t)) out.question++;
      if (/\d/.test(t)) out.digits++;
      if (/\p{Extended_Pictographic}/u.test(t)) out.emoji++;
    }
    if (out.n) out.words = Math.round(out.words / out.n * 10) / 10;
    return out;
  };

  // noise: one unbroken run of 30+ base-64 or hash characters (CJK paragraphs and long words are text, not noise)
  const noiseText = t => /(^|\s)[A-Za-z0-9+\/=_-]{30,}(\s|$)/.test(String(t || ''));

  const api = { noiseText, splitTop, toMs, parseRgb, radiusValue, shadowVisible, textRole, radiusRole, collect, motionLayers, caseOf, voiceOf };
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    return api;
  }

  // ---------- browser adapter ----------
  const cvs = document.createElement('canvas'); cvs.width = cvs.height = 1;
  const cx = cvs.getContext('2d', { willReadFrequently: true }); const cache = new Map();
  const color = c => { // any CSS color (rgb, oklch, color(), lab) -> {hex, a}
    if (!c || c === 'transparent') return null; if (cache.has(c)) return cache.get(c);
    let out = parseRgb(c);
    if (!out && cx) { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
      const p = cx.getImageData(0, 0, 1, 1).data;
      out = p[3] ? { hex: '#' + [p[0], p[1], p[2]].map(v => v.toString(16).padStart(2, '0')).join(''), a: p[3] / 255 } : null; }
    cache.set(c, out); return out;
  };
  const styles = new Map(); const cs = e => { if (!styles.has(e)) styles.set(e, getComputedStyle(e)); return styles.get(e); };
  const CONSENT = '[id*=cookie i],[class*=cookie i],[id*=consent i],[class*=consent i],[aria-label*=cookie i],[aria-label*=consent i],'
    + '[data-framer-name*=cookie i],[id*=onetrust i],[class*=gdpr i]';
  const CTX = [['code', 'pre,code,kbd,samp'], ['heading', 'h1,h2,h3,h4,h5,h6,[role=heading]'],
    ['control', 'button,[role=button],input,select,textarea,label,[role=tab],[role=menuitem],[role=option],[role=switch]'],
    ['caption', 'small,figcaption,caption,footer,sup,sub,[role=contentinfo],[class*=legal i],[class*=disclaimer i],[class*=footnote i],[class*=caption i],[class*=copyright i]'],
    ['nav', 'nav,[role=navigation],[role=menubar],[role=menu],[role=tablist],[role=banner]']];
  const FIELD = 'input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]),select,textarea';
  const CONTAINER = /(^|[\s_-])(card|modal|dialog|popover|panel|sheet|tile|dropdown|toast|tooltip|menu|popup|drawer|window)([\s_-]|$)/i;
  const buttonLike = (e, s, b) => {
    if (e.matches('button,[role=button],input[type=submit],input[type=button],input[type=reset]')) return true;
    if (!e.matches('a[href]') || s.display === 'inline' || b.height < 24 || parseFloat(s.paddingLeft) < 8) return false;
    const bg = color(s.backgroundColor), bc = color(s.borderTopColor);
    return solid(bg) || (parseFloat(s.borderTopWidth) >= 1 && solid(bc));
  };
  const ownText = e => { let n = 0; for (const c of e.childNodes) if (c.nodeType === 3) n += c.textContent.replace(/\s+/g, ' ').trim().length; return n; };
  const noisy = e => { for (const c of e.childNodes) if (c.nodeType === 3 && noiseText(c.textContent)) return true; return false; };
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
  const pseudoBorder = e => { // Framer, Webflow and others draw borders with ::after or ::before
    for (const p of ['::after', '::before']) {
      const s = getComputedStyle(e, p); if (s.content === 'none' || s.content === 'normal') continue;
      const ws = SIDES.map(k => s['border' + k + 'Style'] === 'none' ? 0 : parseFloat(s['border' + k + 'Width']) || 0);
      const w = Math.max(...ws), side = SIDES[ws.indexOf(w)], c = w > 0 ? color(s['border' + side + 'Color']) : null;
      if (w > 0 && c && c.a > 0) return { ...c, w, pseudo: true, shadow: s.boxShadow };
      if (s.boxShadow && s.boxShadow !== 'none') return { hex: null, a: 0, w: 0, pseudo: true, shadow: s.boxShadow };
    }
    return null;
  };
  const describe = e => {
    const s = cs(e), b = e.getBoundingClientRect();
    const btn = buttonLike(e, s, b);
    let ctx = null;
    for (const [role, sel] of CTX) { if (e.closest(sel)) { ctx = role; break; } }
    const a = e.closest('a[href]');
    if (!ctx && a && buttonLike(a, cs(a), a.getBoundingClientRect())) ctx = 'control';
    const own = ownText(e);
    let border = (() => { const c = color(s.borderTopColor); return c ? { ...c, w: parseFloat(s.borderTopWidth) || 0 } : null; })();
    let boxShadow = s.boxShadow;
    const hasBorder = border && border.w > 0 && border.a > 0;
    if (!hasBorder || boxShadow === 'none') {
      const pb = pseudoBorder(e);
      if (pb && pb.w > 0 && !hasBorder) border = pb;
      if (pb && boxShadow === 'none' && pb.shadow && pb.shadow !== 'none') boxShadow = pb.shadow;
    }
    const col = color(s.color), parent = e.parentElement, pcol = parent ? color(cs(parent).color) : null;
    return {
      tag: e.tagName.toLowerCase(), w: b.width, h: b.height, own, ctx, noise: own >= 30 && noisy(e),
      prose: !!e.closest('p,li,dd,dt,td,th,blockquote'), linkText: !!a && !e.closest('p,dd,td,th,blockquote'),
      buttonLike: btn, link: !btn && e.matches('a[href]'), formField: e.matches(FIELD),
      selected: e.matches('[aria-selected=true],[aria-current]:not([aria-current=false]),[aria-pressed=true],[aria-checked=true],:checked'),
      media: e.matches('img,video,picture,svg,canvas,iframe'),
      containerHint: e.matches('dialog,[role=dialog],[role=alertdialog],[role=menu],[role=listbox],[role=tooltip],[popover]') || CONTAINER.test(e.getAttribute('class') || ''),
      // a colored word inside a heading or paragraph: a span, em or strong whose color differs from its parent's
      emphasis: own > 0 && !e.closest('a[href],button') && e.matches('span,em,strong,b,i,mark') && !!e.closest('h1,h2,h3,h4,h5,h6,p,[role=heading]')
        && !!col && !!pcol && col.hex !== pcol.hex,
      fontSize: parseFloat(s.fontSize), fontFamily: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
      fontWeight: s.fontWeight, lineHeight: s.lineHeight,
      tracking: s.letterSpacing === 'normal' ? 0 : Math.round(parseFloat(s.letterSpacing) / parseFloat(s.fontSize) * 100) / 100,
      transform: s.textTransform !== 'none' ? s.textTransform : null,
      color: col, bg: color(s.backgroundColor), border,
      accentColor: s.accentColor && s.accentColor !== 'auto' ? color(s.accentColor) : null,
      radius: s.borderTopLeftRadius, boxShadow,
      spacing: ['paddingTop', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap'].map(k => parseFloat(s[k]) || 0),
      transition: [s.transitionProperty, s.transitionDuration, s.transitionTimingFunction],
      animation: s.animationName && s.animationName !== 'none' ? [s.animationName, s.animationDuration, s.animationTimingFunction, s.animationIterationCount] : null,
    };
  };

  // Sample across the whole page (not only the header): every visible element, evenly thinned past 6000.
  // a cookie or consent banner is left out; a class on <body> or <html> (a plugin's "cookies-not-set") is not a banner
  const inConsent = e => { const c = e.closest(CONSENT); return !!c && c !== document.body && c !== document.documentElement; };
  const all = [...document.body.getElementsByTagName('*')].filter(e => !inConsent(e));
  const visible = e => { const s = cs(e), b = e.getBoundingClientRect();
    return b.width > 1 && b.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity) > 0; };
  const shown = all.filter(visible);
  const step = Math.max(1, Math.ceil(shown.length / 6000));
  const els = shown.filter((e, i) => !(i % step));
  const vw = document.documentElement.clientWidth;
  const descs = els.map(describe);
  const { values: V, targetsUnder24 } = collect(descs, vw);

  // Motion run by script (Web Animations started from JavaScript) is visible through getAnimations().
  try { for (const an of document.getAnimations()) {
    if (an.constructor.name !== 'Animation' || !an.effect || !an.effect.getTiming) continue;
    const t = an.effect.getTiming(), ms = Math.round(Number(t.duration) || 0); if (!ms) continue;
    if (t.iterations === Infinity || (ms >= 2000 && t.iterations > 1)) { V.loops.count++; bump(V.loops.durations, ms); bump(V.loops.easings, t.easing || 'linear'); }
    else bump(V.entrances, ms);
  } } catch (_) { /* a browser without getAnimations */ }

  // Stylesheets: :root custom properties, :focus and selected-state rules (states the page is not in now).
  const root = getComputedStyle(document.documentElement);
  const resolve = v => v.replace(/var\((--[\w-]+)\s*(?:,([^()]*))?\)/g, (_, n, fb) => root.getPropertyValue(n).trim() || (fb || '').trim());
  const COLOR_TOKEN = /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)/gi;
  const ERROR_STATE = /invalid|error|destructive|danger|warning|alert|success/i;
  const props = {}, media = new Set();
  const walk = rules => { for (const r of rules) {
    if (r.media) media.add(r.media.mediaText);
    if (r.selectorText && r.style) {
      if (/(^|,)\s*(:root|html)\b/.test(r.selectorText)) for (const n of r.style) if (n.startsWith('--')) props[n] = r.style.getPropertyValue(n).trim();
      const focus = /:focus/.test(r.selectorText) && !ERROR_STATE.test(r.selectorText);
      const sel = /\[aria-(selected|current|pressed|checked)|:checked|\.(active|selected|is-active|is-selected)\b|\[data-state=?["']?(active|checked|on)/.test(r.selectorText);
      if (focus || sel) {
        const keys = focus ? ['outline-color', 'outline', 'box-shadow', 'border-color'] : ['background-color', 'background', 'color', 'border-color'];
        for (const k of keys) for (const t of resolve(r.style.getPropertyValue(k) || '').match(COLOR_TOKEN) || []) {
          const c = color(t); if (solid(c)) bumpIn(V.accentSources, focus ? 'focus' : 'selected', c.hex); }
      }
    }
    if (r.cssRules) walk(r.cssRules);
  } };
  for (const sh of document.styleSheets) { try { walk(sh.cssRules); } catch (_) { /* cross-origin sheet */ } }
  // accent custom properties as the page resolves them (--accent, --primary, --ring, --brand ...); error colors left out
  for (const [n, v] of Object.entries(props)) {
    if (!/primary|accent|brand|link|focus|ring|interactive|action|cta|highlight/.test(n) || /foreground|-fg|on-|contrast|text|muted/.test(n) || ERROR_STATE.test(n)) continue;
    const c = color(resolve(v)); if (solid(c)) bumpIn(V.accentSources, 'token', c.hex);
  }

  // ---------- the page as painted, on a 16 px grid ----------
  // Document order approximates paint order: a later (deeper) fill covers an earlier one. Text line boxes, controls and
  // card-sized boxes whose fill differs from what is under them count as content; the rest is whitespace. Big panels are
  // ground, and media is imagery (reported apart), so photos and large panels never make a page read dense.
  const G = 16, docH = Math.min(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight), 40000);
  const cols = Math.ceil(vw / G), rows = Math.ceil(docH / G), N = cols * rows;
  const bgOf = e => { const c = color(cs(e).backgroundColor); return solid(c) ? c : null; };
  const pageBg = bgOf(document.body) || bgOf(document.documentElement) || { hex: '#ffffff', a: 1 };
  const palette = [pageBg.hex], pidx = new Map([[pageBg.hex, 0]]);
  const idx = h => { if (!pidx.has(h)) { pidx.set(h, palette.length); palette.push(h); } return pidx.get(h); };
  const paint = new Int16Array(N), ink = new Float32Array(N), img = new Uint8Array(N);
  const sy = window.scrollY, sx = window.scrollX;
  const cells = (r, fn) => {
    const c0 = Math.max(0, Math.round((r.left + sx) / G)), c1 = Math.min(cols, Math.round((r.right + sx) / G));
    const r0 = Math.max(0, Math.round((r.top + sy) / G)), r1 = Math.min(rows, Math.round((r.bottom + sy) / G));
    for (let y = r0; y < r1; y++) for (let x = c0; x < c1; x++) fn(y * cols + x);
  };
  const cover = r => { // content: each cell keeps the largest share of it that one box covers (small type counts at its area)
    const x0 = r.left + sx, x1 = r.right + sx, y0 = r.top + sy, y1 = r.bottom + sy;
    for (let y = Math.max(0, Math.floor(y0 / G)); y < Math.min(rows, Math.ceil(y1 / G)); y++) {
      const fy = (Math.min(y1, (y + 1) * G) - Math.max(y0, y * G)) / G;
      for (let x = Math.max(0, Math.floor(x0 / G)); x < Math.min(cols, Math.ceil(x1 / G)); x++) {
        const f = fy * (Math.min(x1, (x + 1) * G) - Math.max(x0, x * G)) / G, k = y * cols + x;
        if (f > ink[k]) ink[k] = f;
      }
    }
  };
  const sections = [], surfaces = { gradients: 0, imageBackgrounds: 0 };
  for (const e of shown) {
    const s = cs(e), r = e.getBoundingClientRect();
    const bg = bgOf(e), bimg = s.backgroundImage;
    if (bg) {
      const i = idx(bg.hex), wide = r.width >= 0.9 * vw && r.height >= 160;
      const card = r.width < 0.6 * vw || r.height < 0.5 * window.innerHeight;
      let differs = false;
      cells(r, k => { if (paint[k] !== i) differs = true; });
      cells(r, k => { paint[k] = i; });
      if (!wide && card && differs) cover(r);
      if (wide) sections.push({ hex: bg.hex, y: Math.round(r.top + sy), h: Math.round(r.height) });
    }
    if (bimg && bimg !== 'none') {
      if (/gradient\(/.test(bimg)) surfaces.gradients++;
      if (/url\(/.test(bimg) && r.width * r.height > 4000) { surfaces.imageBackgrounds++; cells(r, k => { img[k] = 1; }); }
    }
    if (e.matches('img,video,picture,canvas,iframe') || (e.matches('svg') && !(e.parentElement && e.parentElement.closest('svg')) && r.width * r.height > 1600))
      cells(r, k => { img[k] = 1; });
    if (e.matches('button,input,select,textarea')) cover(r);
  }
  const textInk = {}, rng = document.createRange();
  for (const e of shown) {
    const t = [...e.childNodes].filter(c => c.nodeType === 3 && c.textContent.trim()); if (!t.length) continue;
    const c = color(cs(e).color); let area = 0;
    for (const node of t) { rng.selectNodeContents(node); for (const r of rng.getClientRects()) { area += r.width * r.height; cover(r); } }
    if (c) bump(textInk, c.hex, Math.round(area));
  }
  const areas = {}; let inked = 0, imaged = 0, blank = 0;
  for (let k = 0; k < N; k++) { bump(areas, palette[paint[k]]); inked += ink[k]; imaged += img[k]; }
  for (let y = 0; y < rows; y++) { let n = 0; for (let x = 0; x < cols; x++) n += ink[y * cols + x] + img[y * cols + x]; if (n < 0.5) blank++; }
  // air: the gap from each block of text to the next one below it (overlapping across), in multiples of its type size
  const blocks = [];
  els.forEach((e, i) => { const d = descs[i]; if (d.own > 0 && !d.noise && d.fontSize > 0) { const b = e.getBoundingClientRect();
    blocks.push({ t: b.top + sy, b: b.bottom + sy, l: b.left, r: b.right, f: d.fontSize }); } });
  blocks.sort((a, b) => a.t - b.t);
  const gaps = [];
  blocks.forEach((a, i) => { for (let j = i + 1; j < blocks.length && j < i + 60; j++) { const c = blocks[j];
    if (c.t < a.b - 1) continue; const over = Math.min(a.r, c.r) - Math.max(a.l, c.l);
    if (over > 0.3 * Math.min(a.r - a.l, c.r - c.l)) { gaps.push((c.t - a.b) / a.f); break; } } });
  gaps.sort((a, b) => a - b);
  const air = gaps.length ? Math.round(gaps[Math.floor(gaps.length / 2)] * 100) / 100 : null;
  for (const h in areas) areas[h] = Math.round(areas[h] / N * 1000) / 1000;
  const inkTotal = Object.values(textInk).reduce((a, b) => a + b, 0) || 1, textShare = Math.round(inkTotal / (vw * docH) * 1000) / 1000;
  for (const h in textInk) textInk[h] = Math.round(textInk[h] / inkTotal * 1000) / 1000;
  // full-width sections in page order; nested sections of the same color merge, and runs of one color join
  sections.sort((a, b) => a.y - b.y);
  const runs = [];
  for (const s of sections.filter(x => x.h < 0.9 * docH)) {
    const last = runs[runs.length - 1];
    if (last && s.y < last.y + last.h - 8) { if (s.hex !== last.hex && s.h >= 0.5 * last.h) runs.push({ ...s }); continue; }
    if (last && last.hex === s.hex && s.y - (last.y + last.h) < 64) { last.h = s.y + s.h - last.y; continue; }
    runs.push({ ...s });
  }

  // ---------- depth drawn with elements, and windows ----------
  const patterns = { frames: {}, drawnOffsets: {}, windows: {} };
  const lum = c => { const p = c.hex.slice(1).match(/\w\w/g).map(x => parseInt(x, 16) / 255); return 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; };
  for (const e of shown) {
    const pb = e.getBoundingClientRect(); if (pb.width < 40 || pb.height < 24) continue;
    const kids = [...e.children].filter(visible);
    const ebg = bgOf(e);
    for (const k of ebg ? kids : []) { // a slab behind a box: the parent's fill shows as a band on some sides only
      const kb = k.getBoundingClientRect(), kbg = bgOf(k); if (!kbg || kbg.hex === ebg.hex || kb.width < 0.8 * pb.width) continue;
      const band = [kb.top - pb.top, pb.right - kb.right, pb.bottom - kb.bottom, kb.left - pb.left].map(v => Math.round(v));
      if (Math.max(...band) > 10 || Math.min(...band) < 0 || !band.some(v => v > 0)) continue;
      const sides = band.filter(v => v > 0).length, px = Math.max(...band);
      if (sides >= 3) bump(patterns.frames, `${px}px ${ebg.hex}`);
      else if (band[1] > 0 && band[2] > 0) bump(patterns.drawnOffsets, `${band[1]}px ${band[2]}px 0px 0px ${ebg.hex}`);
    }
    const par = e.parentElement; // an offset twin: a sibling of the same size, shifted down and right, painted before it
    if (par) for (const sib of par.children) {
      if (sib === e || !(sib.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const sb = sib.getBoundingClientRect(), sbg = bgOf(sib); if (!sbg) continue;
      const dx = Math.round(sb.left - pb.left), dy = Math.round(sb.top - pb.top);
      if (Math.abs(sb.width - pb.width) < 2 && Math.abs(sb.height - pb.height) < 2 && dx >= 1 && dy >= 1 && dx <= 10 && dy <= 10)
        bump(patterns.drawnOffsets, `${dx}px ${dy}px 0px 0px ${sbg.hex}`);
    }
    // a window: a full-width bar across the top (12 to 40 px) whose fill contrasts with the body under it
    if (kids.length >= 2 && pb.width >= 120 && pb.height >= 60) {
      const [bar, body] = kids, bb = bar.getBoundingClientRect(), yb = body.getBoundingClientRect();
      const barBg = bgOf(bar), bodyBg = bgOf(body) || ebg;
      if (barBg && bodyBg && Math.abs(bb.top - pb.top) <= 2 && bb.width >= 0.95 * pb.width && bb.height >= 12 && bb.height <= 40
          && yb.top >= bb.bottom - 2 && yb.height >= 2 * bb.height && Math.abs(lum(barBg) - lum(bodyBg)) >= 0.3) {
        const db = describe(bar), w = db.border && db.border.w > 0 ? db.border : describe(body).border;
        bump(patterns.windows, JSON.stringify({ bar: barBg.hex, barHeight: Math.round(bb.height), body: bodyBg.hex,
          border: w && w.w > 0 ? `${Math.round(w.w)}px ${w.hex}` : null, radius: radiusValue(cs(e).borderTopLeftRadius, pb.width, pb.height) || 0 }));
      }
    }
  }

  // ---------- components, by signature ----------
  const components = {};
  const sig = (group, o) => bumpIn(components, group, JSON.stringify(o));
  const edge = d => d.border && d.border.w > 0 && d.border.a > 0 ? `${d.border.w}px ${d.border.hex}` : null;
  els.forEach((e, i) => {
    const d = descs[i], s = cs(e), r = radiusValue(d.radius, d.w, d.h);
    const face = { family: d.fontFamily, size: Math.round(d.fontSize), weight: d.fontWeight, case: d.transform, tracking: d.tracking };
    if (d.buttonLike) sig('button', { bg: solid(d.bg) ? d.bg.hex : null, text: d.color && d.color.hex, border: edge(d), radius: r,
      height: Math.round(d.h), padX: Math.round(parseFloat(s.paddingLeft)), ...face });
    else if (d.link && d.own > 0 && d.prose) sig('link', { color: d.color && d.color.hex, underline: /underline/.test(s.textDecorationLine), weight: d.fontWeight });
    else if (d.formField) sig('field', { bg: solid(d.bg) ? d.bg.hex : null, border: edge(d), radius: r, height: Math.round(d.h) });
    else if (d.own > 0 && solid(d.bg) && d.h <= 30 && d.w <= 260 && !d.media) sig('chip', { bg: d.bg.hex, text: d.color && d.color.hex, radius: r, ...face });
    else if (d.ctx === 'nav' && d.own > 0 && d.own < 40) sig('nav', { color: d.color && d.color.hex, ...face });
    else if (!d.own && r !== null && radiusRole(d, r, vw) === 'container') sig('card', { bg: solid(d.bg) ? d.bg.hex : null, border: edge(d), radius: r,
      shadow: d.boxShadow && d.boxShadow !== 'none' ? d.boxShadow : null });
  });
  for (const g in components) components[g] = Object.fromEntries(Object.entries(components[g]).sort((a, b) => b[1] - a[1]).slice(0, 6));

  // ---------- voice (statistics only) and layout ----------
  const textOf = sel => [...document.querySelectorAll(sel)].filter(e => !inConsent(e) && visible(e)).map(e => e.innerText || '');
  const prose = textOf('p').filter(t => t.length >= 60);
  const sentences = prose.flatMap(t => t.split(/(?<=[.!?])\s+/)).filter(t => t.trim());
  const voice = { heading: voiceOf(textOf('h1,h2,h3,h4,[role=heading]')),
    button: voiceOf(textOf('button,[role=button],a[href]').filter(t => t.trim().length > 0 && t.length <= 40)),
    nav: voiceOf(textOf('nav a,[role=navigation] a')),
    prose: { paragraphs: prose.length,
      wordsPerSentence: sentences.length ? Math.round(sentences.reduce((n, t) => n + t.split(/\s+/).length, 0) / sentences.length * 10) / 10 : null,
      you: prose.filter(t => /\byou(r|'re)?\b/i.test(t)).length, contractions: prose.filter(t => /\b\w+['’](s|re|ll|ve|d|t)\b/i.test(t)).length,
      exclaim: prose.filter(t => /!/.test(t)).length, emoji: prose.filter(t => /\p{Extended_Pictographic}/u.test(t)).length } };
  const widths = els.filter((e, i) => descs[i].prose && descs[i].own >= 80).map(e => Math.round(e.getBoundingClientRect().width)).sort((a, b) => a - b);
  const layout = { maxTextWidth: widths.length ? widths[Math.floor(widths.length * 0.9)] : null, docHeight: docH };
  const fonts = [];
  try { for (const f of document.fonts) if (f.status === 'loaded' && !/(placeholder|fallback)$/i.test(f.family.replace(/["']/g, '').trim())) { const k = `${f.family.replace(/["']/g, '')}|${f.weight}|${f.style}`; if (!fonts.includes(k)) fonts.push(k); } } catch (_) { /* no FontFaceSet */ }

  return JSON.stringify({ source: location.href, method: 'computed', elements: els.length, totalElements: all.length,
    viewport: [vw, window.innerHeight], values: V, customProperties: props, media: [...media].slice(0, 30), targetsUnder24,
    surfaces: { grid: G, pageBg: pageBg.hex, areas, text: textInk, textShare, sections: runs.slice(0, 40), imagery: Math.round(imaged / N * 1000) / 1000,
      whitespace: Math.round((1 - inked / N) * 1000) / 1000, blankRows: Math.round(blank / rows * 1000) / 1000, air, ...surfaces },
    patterns, components, voice, layout, fontsLoaded: fonts.slice(0, 40) }, null, 1);
})();
