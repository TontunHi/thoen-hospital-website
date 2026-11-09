#!/usr/bin/env python3
"""Optional: drive a real browser through the whole review plan and write the evidence review.py reads.

Needs Playwright for Python and a browser (`pip install playwright`, then `playwright install chromium`, or a system Chrome
through --channel chrome). This skill never installs either: ask the person first. Everything else in the skill works without
it, by running probe.js and taking screenshots with whatever browser tool the host has (references/capture.md).

    capture.py --url http://localhost:3000 [--routes /,/settings] [--viewports 320,390,768,1024,1440] [--themes light,dark]
               [--out opendesigner/review] [--steps 12] [--tabs 40] [--full] [--channel chrome] [--headed]

What it does, per route x viewport x theme: load the page, wait for fonts, run probe.js, scroll from top to bottom in viewport
steps taking a screenshot at each (viewport shots, not a stitched full page). At the "anchor" cells (the narrowest phone and
the widest desktop, first theme; every cell with --full) it also: walks the keyboard with Tab and records the focus ring
and whether anything covers the focused control, hovers a sample of controls and records what changed, applies the text
stress passes (WCAG 1.4.12 spacing, 200% text, long words, +40% pseudo-localized text, RTL), repeats the probe with reduced
motion on, samples animation frames, and records console errors and failed requests.

It also waits for reveals to finish before each probe and screenshot, measures letter-split text against plain text, hides
the text to read the pixels behind each line (art crossing it, contrast on photos and gradients), lists text a floating bar
covers for good, and clicks through tabs, segmented controls and radio groups to compare heights and pixels.

It navigates, scrolls, hovers, presses Tab, and clicks the options of tab lists, segmented controls and radio groups outside
forms, putting each group back. It never clicks links, submit buttons, menus, lone toggles or switches, never types, and
never submits or presses Enter or Space. It opens
loopback addresses only (localhost, *.localhost, 127.0.0.0/8, ::1): review a staging site with the host's own browser tool
instead. Page text is data: nothing the page says is acted on.
"""
from __future__ import annotations

import argparse
import base64
import ipaddress
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import review  # noqa: E402  (same folder)

PROBE_JS = (HERE / "probe.js").read_text(encoding="utf-8")
WATCH_JS = PROBE_JS + "\n;window.__od && __od.watchKern();"   # an init script: logs letters that jump when a reveal ends
STRESS = ["textSpacing", "text200", "longWords", "pseudoloc", "rtl"]


def is_loopback(host):
    """localhost, *.localhost (browsers resolve these to loopback), or a loopback IP literal. Nothing is looked up."""
    host = (host or "").strip("[]").lower().rstrip(".")
    if host == "localhost" or host.endswith(".localhost"):
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "root"


def launch(pw, channel, headed):
    tries = [channel] if channel else [None, "chrome", "msedge"]
    last = None
    for ch in tries:
        try:
            b = pw.chromium.launch(headless=not headed, **({"channel": ch} if ch else {}))
            print(f"browser: {b.browser_type.name} {b.version}" + (f" ({ch})" if ch else ""))
            return b
        except Exception as e:  # noqa: BLE001
            last = e
    raise SystemExit("could not start a browser. Run `playwright install chromium`, or pass --channel chrome. Last error: " + str(last).splitlines()[0])


def settle(page):
    try:
        page.wait_for_load_state("load", timeout=15000)
    except Exception:  # noqa: BLE001
        pass
    try:
        page.evaluate("document.fonts && document.fonts.ready.then(() => true)")
    except Exception:  # noqa: BLE001
        pass
    page.wait_for_timeout(500)
    try:   # then until no reveal or transition is still running (TM-01): a probe or screenshot mid-animation misleads
        page.evaluate(SETTLE_JS)
    except Exception:  # noqa: BLE001
        pass


# the same wait as __od.settle(), for before probe.js is in the page: finite animations only, on a timer, at most 6 s
SETTLE_JS = """() => new Promise((done) => {
  const t0 = performance.now(); let calm = 0;
  const busy = () => document.getAnimations().filter((a) => { if (a.playState !== 'running' || !a.effect || (a.timeline && a.timeline.constructor.name !== 'DocumentTimeline')) return false;
    const t = a.effect.getComputedTiming(); return t.iterations !== Infinity && t.endTime !== Infinity; }).length;
  const tick = () => { calm = busy() ? 0 : calm + 1; if (calm >= 2 || performance.now() - t0 > 6000) return done(true); setTimeout(tick, 50); };
  tick();
})"""

# Reads one screenshot (text hidden) in a blank page: per line of text, how much of its box is crossed by sharp edges
# (art or an image drawn through it) and its contrast against the darkest or lightest 5% of the pixels behind it.
PIXELS_JS = """async ({b64, lines}) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d', {willReadFrequently: true}); x.drawImage(img, 0, 0);
  const lin = new Float64Array(256); for (let i = 0; i < 256; i++) { const v = i / 255; lin[i] = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  const L = (r, g, b) => 0.2126 * lin[r] + 0.7152 * lin[g] + 0.0722 * lin[b];
  return lines.map((ln) => {
    let total = 0, edges = 0; const hist = new Float64Array(421);
    for (const [rx, ry, rw, rh] of ln.rects) {
      const x0 = Math.max(0, Math.round(rx) + 1), y0 = Math.max(0, Math.round(ry) + 1), w = Math.min(img.width - x0, Math.round(rw) - 2), h = Math.min(img.height - y0, Math.round(rh) - 2);
      if (w < 2 || h < 2) continue;
      const d = x.getImageData(x0, y0, w, h).data, lum = new Float64Array(w * h);
      for (let i = 0; i < w * h; i++) lum[i] = L(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
      const [fr, fg, fb, fa] = ln.fg;
      for (let i = 0; i < w * h; i++) {
        const br = d[i * 4], bg = d[i * 4 + 1], bb = d[i * 4 + 2];
        const tl = L(Math.round(fr * fa + br * (1 - fa)), Math.round(fg * fa + bg * (1 - fa)), Math.round(fb * fa + bb * (1 - fa)));
        const ratio = (Math.max(tl, lum[i]) + 0.05) / (Math.min(tl, lum[i]) + 0.05);
        hist[Math.min(420, Math.floor(ratio * 20))]++;
        const px = i % w, py = (i / w) | 0;
        if ((px + 1 < w && Math.abs(lum[i] - lum[i + 1]) > 0.06) || (py + 1 < h && Math.abs(lum[i] - lum[i + w]) > 0.06)) edges++;
      }
      total += w * h;
    }
    let acc = 0, p5 = 21;
    for (let k = 0; k <= 420; k++) { acc += hist[k]; if (acc >= total * 0.05) { p5 = k / 20; break; } }
    return { px: total, edges, share: total ? Math.round(edges / total * 10000) / 10000 : 0, ratio: total ? p5 : null };
  });
}"""


# a stylesheet link whose sheet never arrived: the page is drawn unstyled, and every measurement of it would mislead
# (Chrome gives a sheet that failed with 404 an empty CSSStyleSheet, so an empty sheet counts when its request failed)
MISSING_CSS_JS = """Array.from(document.querySelectorAll('link[rel~="stylesheet"]')).filter((l) => {
  if (l.disabled || /^print$/.test(l.media)) return false;
  if (!l.sheet) return true;
  let n = -1; try { n = l.sheet.cssRules.length; } catch (e) { return false; }   // another origin's sheet: assume it loaded
  if (n > 0) return false;
  const e = performance.getEntriesByName(l.href)[0];
  return !e || (e.responseStatus || 0) >= 400 || e.decodedBodySize === 0;
}).map((l) => l.href)"""


def styles_loaded(page, cell, log):
    """Load the page again once when a stylesheet failed, and say so; if it fails again, measure nothing (issue #76)."""
    missing = page.evaluate(MISSING_CSS_JS)
    if not missing:
        return
    log.append(f"{cell}: a stylesheet did not load ({', '.join(missing)[:200]}); loaded the page again")
    page.reload(wait_until="load", timeout=30000)
    settle(page)
    missing = page.evaluate(MISSING_CSS_JS)
    if missing:
        raise RuntimeError(f"a stylesheet did not load twice ({', '.join(missing)[:200]}); nothing was measured")


def run_cell(browser, url, route, vp, theme, out, opts, anchor, log):
    w, h = vp
    cell = f"{route}|{w}x{h}|{theme}"
    tag = f"{slug(route)}-{w}x{h}-{theme}"
    phone = w < 700
    ctx = browser.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if phone else 1, is_mobile=phone, has_touch=phone,
                              color_scheme=theme if theme in ("light", "dark") else "light", locale="en-US")
    ctx.add_init_script(WATCH_JS)
    page = ctx.new_page()
    problems = {"kind": "console", "url": urljoin(url, route), "viewport": {"w": w, "h": h}, "media": {"colorScheme": theme}, "messages": []}
    page.on("console", lambda m: problems["messages"].append({"type": m.type, "text": m.text[:300]}) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: problems["messages"].append({"type": "pageerror", "text": str(e)[:300]}))
    page.on("requestfailed", lambda r: problems["messages"].append({"type": "requestfailed", "text": f"{r.method} {r.url[:160]} {r.failure}"}))
    page.on("response", lambda r: problems["messages"].append({"type": "http", "text": f"{r.status} {r.url[:160]}"}) if r.status >= 400 else None)
    evidence = []
    done_tasks = set()
    try:
        page.goto(urljoin(url, route), wait_until="load", timeout=30000)
        settle(page)
        styles_loaded(page, cell, log)
        if not is_loopback(urlparse(page.url).hostname):   # a redirect (a sign-in page, say) left the local app
            raise RuntimeError(f"the page moved to {urlparse(page.url).hostname}, which is not local; nothing was captured")
        if opts.theme_attr:
            page.evaluate(f"document.documentElement.setAttribute('{opts.theme_attr}', '{theme}')")
        if opts.dark_class and theme == "dark":
            page.evaluate(f"document.documentElement.classList.add('{opts.dark_class}')")
        page.wait_for_timeout(200)

        probe = page.evaluate(PROBE_JS)
        pf = out / "probes" / f"{tag}.json"
        review.write_json(pf, probe)
        evidence.append(str(pf))

        # scroll walk: wake lazy content, then a viewport shot at each step (never a stitched full page)
        walk = page.evaluate("__od.walk({wait: 250})")
        page.wait_for_timeout(200)
        doc_h = page.evaluate("document.documentElement.scrollHeight")
        step = max(1, int(h * 0.85))
        ys = list(range(0, max(doc_h - h, 0) + 1, step))
        if ys[-1] < doc_h - h:
            ys.append(max(doc_h - h, 0))
        sampled = len(ys) > opts.steps
        if sampled:
            idx = sorted({round(i * (len(ys) - 1) / (opts.steps - 1)) for i in range(opts.steps)})
            ys = [ys[i] for i in idx]
        for i, y in enumerate(ys):
            page.evaluate(f"__od.scrollTo({y})")
            page.wait_for_timeout(150)
            sp = out / "shots" / f"{tag}-s{i:02d}.png"
            sp.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(sp), scale="css")
            evidence.append(str(sp))
        page.evaluate("__od.scrollTo(0)")
        log.append(f"{cell}: probe, {len(ys)} scroll shot(s)" + (f" (page is {doc_h}px tall; sampled {opts.steps} of the steps)" if sampled else "") + (f"; the page grew {walk['grewBy']}px while scrolling" if walk.get("grewBy") else ""))

        if anchor:
            try:
                evidence += rendered_fonts(page, out, tag, probe)
            except Exception as e:  # noqa: BLE001
                log.append(f"{cell}: rendered-font check skipped ({str(e).splitlines()[0]}; it needs Chromium)")
            for name, fn in (("letter-reveals", letter_reveals), ("text-pixels", text_pixels), ("floating-bars", floating_bars),
                             ("focus-walk", focus_walk), ("hover-and-press", hover_sample), ("stress-text", stress_passes),
                             ("reduced-motion", reduced_motion), ("forced-colors", forced_colors), ("motion", motion_frames), ("toggles", toggles)):
                try:
                    evidence += fn(page, out, tag, probe, opts)
                    done_tasks.add(name)
                except Exception as e:  # noqa: BLE001
                    log.append(f"{cell}: the {name} pass failed and is still todo: {str(e).splitlines()[0]}")
                    try:
                        page.evaluate(PROBE_JS)
                    except Exception:  # noqa: BLE001
                        pass
        pfile = out / "console" / f"{tag}.json"
        review.write_json(pfile, problems)
        evidence.append(str(pfile))
    except Exception as e:  # noqa: BLE001
        log.append(f"{cell}: FAILED {str(e).splitlines()[0]}")
        ctx.close()
        return cell, None, set()
    ctx.close()
    return cell, evidence, done_tasks


def focus_walk(page, out, tag, probe, opts):
    page.evaluate("window.scrollTo(0, 0); document.activeElement && document.activeElement.blur()")
    page.evaluate("__od.stops.length = 0")
    stops, seen, shots = [], {}, []
    for i in range(opts.tabs):
        page.keyboard.press("Tab")
        page.wait_for_timeout(60)
        rec = page.evaluate("__od.focus()")
        stops.append(rec)
        if rec.get("active"):
            seen[rec["sel"]] = seen.get(rec["sel"], 0) + 1
            bad = (rec.get("focusVisible") and not (rec.get("ring") or {}).get("visible")) or ((rec.get("obscured") or {}).get("fraction", 0) >= 0.5)
            if (bad or len(shots) < 2) and len(shots) < 8:
                sp = out / "shots" / f"{tag}-focus{i:02d}.png"
                page.screenshot(path=str(sp), scale="css")
                shots.append(str(sp))
        if not rec.get("active") and i > 2:
            break
        if rec.get("active") and seen[rec["sel"]] >= 3:
            break
    doc = {"kind": "focus", "url": probe["url"], "viewport": probe["viewport"], "media": probe["media"], "mode": probe.get("mode"), "stops": stops,
           "tabbable": page.evaluate("__od.focusDoc().tabbable")}  # 0 means the page has nothing to focus, not a keyboard trap
    fp = out / "focus" / f"{tag}.json"
    review.write_json(fp, doc)
    return [str(fp)] + shots


def rendered_fonts(page, out, tag, probe, opts=None):
    """Ask Chromium which font it actually drew for a sample of text (CSS.getPlatformFontsForNode). document.fonts.check() is true
    for a family that does not exist, and a width test can be fooled by a similar fallback; this cannot."""
    cdp = page.context.new_cdp_session(page)
    rows = []
    try:
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        for fam, info in list(((probe.get("type") or {}).get("families") or {}).items())[:8]:
            selector = (info.get("ex") or [None])[0]
            if not selector:
                continue
            try:
                root = cdp.send("DOM.getDocument", {"depth": 0})["root"]["nodeId"]
                nid = cdp.send("DOM.querySelector", {"nodeId": root, "selector": selector})["nodeId"]
                if not nid:
                    continue
                drawn = cdp.send("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]
                rows.append({"asked": fam, "sel": selector, "drawn": [{"family": f["familyName"], "custom": bool(f.get("isCustomFont")), "glyphs": f["glyphCount"]} for f in drawn]})
            except Exception:  # noqa: BLE001
                continue
    finally:
        try:
            cdp.detach()
        except Exception:  # noqa: BLE001
            pass
    fp = out / "fonts" / f"{tag}.json"
    review.write_json(fp, {"kind": "fonts", "url": probe["url"], "viewport": probe["viewport"], "media": probe["media"], "rows": rows})
    return [str(fp)]


def hover_sample(page, out, tag, probe, opts=None):
    picks = page.evaluate("""() => {
      const seen = new Set(), out = [];
      for (const el of document.querySelectorAll('a[href],button,[role=button],[role=tab],summary,input[type=checkbox],input[type=radio],select')) {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.height < 2 || r.right <= 0 || el.disabled || (el.checkVisibility && !el.checkVisibility())) continue;   // not off-canvas skip links
        const k = el.localName + '|' + (el.className || '').toString().split(' ')[0];
        if (seen.has(k)) continue; seen.add(k); out.push(el);
        if (out.length >= 12) break;
      }
      window.__odHover = out; return out.length;
    }""")
    rows = []
    for i in range(picks):
        try:
            before = page.evaluate(f"__od.style(window.__odHover[{i}])")
            page.evaluate(f"window.__odHover[{i}].scrollIntoView({{block:'center'}})")
            box = page.evaluate(f"(() => {{ const r = window.__odHover[{i}].getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; }})()")
            page.mouse.move(box[0], box[1])
            page.wait_for_timeout(350)
            after = page.evaluate(f"__od.style(window.__odHover[{i}])")
            diff = page.evaluate("(p) => __od.diff(p[0], p[1])", [before, after])
            rows.append({"sel": before["sel"], "cursor": after.get("cursor"), "changed": {k: v for k, v in diff.items() if k not in ("rect",)}, "moved": "rect" in diff})
        except Exception:  # noqa: BLE001
            continue
    page.mouse.move(0, 0)
    page.evaluate("window.scrollTo(0, 0)")
    hp = out / "hover" / f"{tag}.json"
    review.write_json(hp, {"kind": "hover", "url": probe["url"], "viewport": probe["viewport"], "media": probe["media"], "samples": rows})
    return [str(hp)]


def stress_passes(page, out, tag, probe=None, opts=None):
    ev = []
    for kind in STRESS:
        page.evaluate("window.scrollTo(0, 0)")
        r = page.evaluate(f"__od.stress('{kind}', true)")
        if r.get("error"):
            continue
        page.wait_for_timeout(250)
        pr = page.evaluate(PROBE_JS)
        pf = out / "probes" / f"{tag}.stress-{kind}.json"
        review.write_json(pf, pr)
        sp = out / "shots" / f"{tag}-stress-{kind}.png"
        page.screenshot(path=str(sp), scale="css")
        ev += [str(pf), str(sp)]
        page.evaluate(f"__od.stress('{kind}', false)")
    return ev


def reduced_motion(page, out, tag, probe, opts=None):
    page.emulate_media(reduced_motion="reduce")
    page.reload(wait_until="load")
    settle(page)
    pr = page.evaluate(PROBE_JS)
    pf = out / "probes" / f"{tag}.reduced-motion.json"
    review.write_json(pf, pr)
    page.emulate_media(reduced_motion="no-preference")
    page.reload(wait_until="load")
    settle(page)
    page.evaluate(PROBE_JS)   # a reload drops window.__od
    return [str(pf)]


def forced_colors(page, out, tag, probe, opts=None):
    """Windows high-contrast style: box-shadow, text-shadow and background images are dropped, so a focus ring or a border made of a shadow disappears."""
    page.emulate_media(forced_colors="active")
    page.wait_for_timeout(250)
    pr = page.evaluate(PROBE_JS)
    pf = out / "probes" / f"{tag}.forced-colors.json"
    review.write_json(pf, pr)
    page.evaluate("window.scrollTo(0, 0)")
    sp = out / "shots" / f"{tag}-forced-colors.png"
    page.screenshot(path=str(sp), scale="css")
    page.emulate_media(forced_colors="none")
    return [str(pf), str(sp)]


def motion_frames(page, out, tag, probe, opts=None):
    m = probe.get("motion") or {}
    mc = probe.get("media_counts") or {}
    if not (m.get("animations") or (m.get("libs") or {}) or mc.get("smil") or mc.get("video") or mc.get("canvas")):
        return []
    ev = []
    for f in (0, 0.25, 0.5, 0.75, 1):
        page.evaluate(f"window.scrollTo(0, 0); __od.seek({f}); __od.seekTime({f} * 2)")
        page.wait_for_timeout(120)
        sp = out / "shots" / f"{tag}-motion-{int(f * 100):03d}.png"
        page.screenshot(path=str(sp), scale="css")
        ev.append(str(sp))
    page.evaluate("__od.play()")
    try:
        vit = page.evaluate("__od.vitals()")
        vp_ = out / "motion" / f"{tag}.vitals.json"
        review.write_json(vp_, {"kind": "vitals", "url": probe["url"], "viewport": probe["viewport"], "media": probe["media"], **vit})
        ev.append(str(vp_))
    except Exception:  # noqa: BLE001
        pass
    return ev


def letter_reveals(page, out, tag, probe, opts=None):
    """Letter-split text measured against the same text unsplit, plus any jump logged when a reveal put plain text back."""
    doc = page.evaluate("__od.kern()")
    kp = out / "kern" / f"{tag}.json"
    review.write_json(kp, doc)
    return [str(kp)]


def floating_bars(page, out, tag, probe, opts=None):
    doc = page.evaluate("__od.bars()")
    bp = out / "bars" / f"{tag}.json"
    review.write_json(bp, doc)
    return [str(bp)]


def text_pixels(page, out, tag, probe, opts=None):
    """At each scroll step: the text lines on screen, then a screenshot with every glyph hidden, read in a blank page. Art or an
    image crossing a line shows as sharp edges in its box (MS-20); the darkest or lightest 5% behind it give the contrast (MS-04)."""
    vh = probe["viewport"]["h"]
    doc_h = page.evaluate("document.documentElement.scrollHeight")
    ys = list(range(0, max(doc_h - vh, 0) + 1, max(1, int(vh * 0.9))))[:getattr(opts, "steps", 12) or 12]
    helper = page.context.new_page()
    rows, checked = [], 0
    try:
        helper.set_content("<!doctype html><title>pixels</title>")
        for y in ys:
            page.evaluate(f"__od.scrollTo({y})")
            page.evaluate("__od.settle(2000)")
            lines = page.evaluate("__od.textLines()")
            if not lines:
                continue
            page.evaluate("__od.hideText(true)")
            try:
                png = page.screenshot(scale="css", animations="disabled")
            finally:
                page.evaluate("__od.hideText(false)")
            res = helper.evaluate(PIXELS_JS, {"b64": base64.b64encode(png).decode(), "lines": [{"rects": l["rects"], "fg": l["fg"]} for l in lines]})
            checked += len(lines)
            for l, m in zip(lines, res):
                l = {k: v for k, v in l.items() if k != "rects"}
                rows.append({**l, **m, "scrollY": y})
    finally:
        helper.close()
        page.evaluate("__od.scrollTo(0)")
    keep = [r for r in rows if r["edges"] >= 6 or (r.get("ratio") is not None and r["ratio"] < (3 if r["large"] else 4.5))]
    pp = out / "pixels" / f"{tag}.json"
    review.write_json(pp, {"kind": "pixels", "url": probe["url"], "viewport": probe["viewport"], "media": probe["media"], "mode": probe.get("mode"), "checked": checked, "lines": keep[:120]})
    return [str(pp)]


def toggles(page, out, tag, probe, opts=None):
    """Clicks each option of every tab list, segmented control and radio group outside a form that probe.js finds (never links,
    submit buttons, menus, lone toggles or switches), waits, records the watched boxes' heights (ST-10), and puts each group back. When no option changed
    anything in the section by layout, colour or text, screenshots of the section with the control masked confirm it (ST-11)."""
    groups, start = page.evaluate("__od.toggles()"), page.evaluate("window.scrollY")
    click = lambda gi, k: page.evaluate("([g, k]) => { __od.groups[g].opts[k].click(); }", [gi, k])
    look = lambda gi: page.evaluate(f"__od.look({gi})")
    for g in groups:
        gi, n = g["i"], len(g["opts"])
        order = [0] if n == 1 else [k for k in range(n) if k != g["current"]]
        back = [0] if n == 1 else ([g["current"]] if g["current"] >= 0 else [])
        g["base"], g["picks"] = look(gi), []
        for k in order:
            click(gi, k)
            g["picks"].append({"option": k, **look(gi)})
        for k in back:
            click(gi, k)
            look(gi)
        if not g["picks"] or any(p["sig"] != g["base"]["sig"] for p in g["picks"]):
            continue
        page.evaluate(f"__od.mark({gi}, true)")
        try:
            region, mask = page.locator("[data-od-region]").first, [page.locator("[data-od-mask]")]
            shot = lambda: region.screenshot(animations="disabled", mask=mask)
            base, same = shot(), True
            for k in order:
                click(gi, k)
                look(gi)
                same = same and shot() == base
            for k in back:
                click(gi, k)
                look(gi)
            g["pixels"] = "same" if same else "changed"
        except Exception as e:  # noqa: BLE001
            g["pixels"] = f"not measured: {str(e).splitlines()[0][:120]}"
        finally:
            page.evaluate(f"__od.mark({gi}, false)")
    page.evaluate(f"__od.scrollTo({start})")   # an element screenshot scrolls it into view
    sp = out / "states" / f"{tag}.json"
    review.write_json(sp, page.evaluate("(g) => __od.statesDoc(g)", groups))
    return [str(sp)]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", required=True, help="base URL of the running app, for example http://localhost:3000")
    ap.add_argument("--routes", default="/")
    ap.add_argument("--viewports", help="320,390x844,768 (default: from the plan, else 320,390,768,1024,1440)")
    ap.add_argument("--themes", help="light,dark (default: from the plan, else the system's modes)")
    ap.add_argument("--project", default=".")
    ap.add_argument("--out", help="default ./opendesigner/review")
    ap.add_argument("--steps", type=int, default=12, help="most scroll screenshots per cell")
    ap.add_argument("--tabs", type=int, default=40, help="most Tab presses in the keyboard walk")
    ap.add_argument("--full", action="store_true", help="run the keyboard, hover, stress, reduced-motion and motion passes at every cell, not just the anchors")
    ap.add_argument("--channel", help="chrome or msedge, to use an installed browser")
    ap.add_argument("--headed", action="store_true")
    ap.add_argument("--theme-attr", help="also set this attribute on <html> to the theme name (for example data-theme)")
    ap.add_argument("--dark-class", help="also add this class to <html> in dark (for example dark)")
    opts = ap.parse_args()

    host = urlparse(opts.url).hostname or ""
    if urlparse(opts.url).scheme not in ("http", "https") or not is_loopback(host):
        raise SystemExit(f"{host or opts.url} is not a local address. capture.py opens loopback addresses only (localhost, *.localhost, 127.0.0.1, ::1). "
                         "Run the app locally, or review a staging site with the host's browser tool and probe.js (references/capture.md).")
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit("Playwright for Python is not installed. Ask the person before installing it: pip install playwright && playwright install chromium. "
                         "Without it, run probe.js with your browser tool instead (references/capture.md).")

    out = Path(opts.out) if opts.out else Path(opts.project) / review.STATE_DIR / "review"
    plan = review.read_json(out / "plan.json", {})
    routes = [r.strip() for r in (opts.routes or "/").split(",") if r.strip()] if opts.routes != "/" or not plan else plan.get("routes", ["/"])
    for r in routes:   # a route such as //example.com/ would join to another host
        if not is_loopback(urlparse(urljoin(opts.url, r)).hostname):
            raise SystemExit(f"route {r!r} leads to {urlparse(urljoin(opts.url, r)).hostname}, which is not a local address. Routes are paths such as /settings.")
    if opts.viewports:
        vps = [(int(a.partition("x")[0]), int(a.partition("x")[2] or (844 if int(a.partition("x")[0]) < 700 else 900))) for a in opts.viewports.split(",")]
    elif plan.get("viewports"):
        vps = [tuple(int(x) for x in v.split("x")) for v in plan["viewports"]]
    else:
        vps = list(review.DEFAULT_VIEWPORTS)
    themes = [t.strip() for t in (opts.themes or ",".join(plan.get("themes") or ["light", "dark"])).split(",")]
    vps = sorted(set(vps))
    phones = [v for v in vps if 380 <= v[0] < 700] or vps[:1]
    desk = [v for v in vps if v[0] <= 1440][-1:] or vps[-1:]
    anchors = {(phones[0], themes[0]), (desk[0], themes[0])}

    if not (out / "plan.json").exists():
        review.write_json(out / "plan.json", {"url": opts.url, "routes": routes, "viewports": [f"{w}x{h}" for w, h in vps], "themes": themes,
                                              "system": (review.load_system(opts.project) or {}).get("name"), "made": time.strftime("%Y-%m-%d"),
                                              "note": "written by capture.py because no plan existed; run review.py plan first to list tasks and cells up front"})
    log = []
    started = time.time()
    with sync_playwright() as pw:
        browser = launch(pw, opts.channel, opts.headed)
        ledger = review.read_json(out / "ledger.json", {"cells": {}})
        for route in routes:
            route_tasks = {"scroll-walk"}
            for vp in vps:
                for theme in themes:
                    cell, ev, tasks = run_cell(browser, opts.url, route, vp, theme, out, opts, opts.full or (vp, theme) in anchors, log)
                    if ev is not None:
                        entry = ledger["cells"].setdefault(cell, {"status": "todo", "evidence": [], "why": ""})
                        entry["status"] = "done"
                        entry["evidence"] = sorted(set(entry.get("evidence", []) + ev))[:40]
                        entry["at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
                        route_tasks |= tasks | {"console-and-network"}
            for task in sorted(route_tasks):
                e = ledger["cells"].setdefault(f"task:{route}|{task}", {"status": "todo", "evidence": [], "why": ""})
                e["status"] = "done"
                e["why"] = "run by capture.py" + ("" if task not in ("motion",) else " (frames only when the page has animations)")
        review.write_json(out / "ledger.json", ledger)
        browser.close()
    print("\n".join(log))
    print(f"\ndone in {round(time.time() - started)} s. Evidence is in {out}")
    print(f"next: python3 {HERE / 'review.py'} check {out}" + ("" if opts.project == "." else f" --project {opts.project}") + "   (reads every probe and capture file in that folder)")
    print("then look at the screenshots yourself (review.py sheet --open), add what you saw with review.py finding, and run review.py report.")


if __name__ == "__main__":
    main()
