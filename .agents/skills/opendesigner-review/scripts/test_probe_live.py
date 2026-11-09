#!/usr/bin/env python3
"""Runs probe.js and capture.py in a real browser against fixtures/broken.html. Skipped when Playwright or a Chrome-family
browser is not available (nothing is installed or downloaded by this test). Standard library plus Playwright.

    python3 skills/opendesigner-review/scripts/test_probe_live.py
"""
import functools
import http.server
import json
import re
import subprocess
import sys
import tempfile
import threading
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import review as rv  # noqa: E402

try:
    from playwright.sync_api import sync_playwright
    _pw = sync_playwright().start()
    _browser = None
    for ch in (None, "chrome", "msedge"):
        try:
            _browser = _pw.chromium.launch(**({"channel": ch} if ch else {}))
            _CHANNEL = ch
            break
        except Exception:  # noqa: BLE001
            continue
    if _browser is None:
        _pw.stop()
except Exception:  # noqa: BLE001
    _browser = None

PROBE = (HERE / "probe.js").read_text()


@unittest.skipIf(_browser is None, "Playwright or a Chromium-family browser is not available")
class Live(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(HERE / "fixtures"))
        handler.log_message = lambda *a, **k: None
        cls.httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.url = f"http://localhost:{cls.port}/broken.html"

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        if _browser:
            _browser.close()
            _pw.stop()

    def page(self, w=390, h=800):
        pg = _browser.new_page(viewport={"width": w, "height": h})
        self.addCleanup(pg.close)
        pg.goto(self.url)
        pg.wait_for_timeout(300)
        return pg

    def test_the_planted_defects_are_measured(self):
        p = self.page().evaluate(PROBE)
        self.assertEqual(p["doc"]["hOverflow"], 532)
        self.assertTrue(p["doc"]["blocksZoom"])
        self.assertIsNone(p["doc"]["lang"])
        self.assertEqual(p["contrast"]["failing"][0]["ratio"], 2.32)
        self.assertEqual(p["fonts"]["familyState"]["Nonexistent Brand Font"], "missing")
        self.assertTrue(p["a11y"]["states"]["focusRingRemoved"])
        self.assertTrue(any(s["w"] == 16 and not s["spacingException"] for s in p["targets"]["small"]))
        self.assertTrue(p["images"]["broken"] and p["images"]["noAlt"] and p["images"]["stretched"])
        self.assertTrue(p["content"]["placeholders"])
        self.assertTrue(p["targets"]["hiddenFocusable"])
        self.assertEqual(p["motion"]["infinite"], 1)
        self.assertEqual(p["motion"]["reducedMotionRules"], 0)
        self.assertTrue(p["overflow"]["scrollers"])
        self.assertTrue(p["overflow"]["clipped"][0]["ellipsis"])

    def test_labels_breaking_across_lines_are_found_and_nothing_else(self):                     # MS-15
        pg = _browser.new_page(viewport={"width": 800, "height": 600})
        self.addCleanup(pg.close)
        pg.goto(f"http://localhost:{self.port}/labels.html")
        pg.wait_for_timeout(300)
        lb = pg.evaluate(PROBE)["labels"]
        broken = {x["sel"]: x for x in lb["broken"]}
        self.assertEqual(set(broken), {"button#reassign", "span#chip"})   # the two-line button, the sentence and the card are not breaks
        self.assertTrue(broken["button#reassign"]["midWord"])
        self.assertGreaterEqual(broken["button#reassign"]["lines"], 3)
        self.assertFalse(broken["span#chip"]["midWord"])
        self.assertEqual(broken["span#chip"]["lines"], 2)

    def test_a_demo_built_from_real_buttons_is_a_picture_not_unnamed_controls(self):            # IN-03, IN-08, PR-07
        # opendesigner.dev's before-and-after demo draws an app from real buttons inside an aria-hidden shadow root, with
        # tabindex -1: nobody can reach them, so "no accessible name" and "too small" were false alarms (2026-11-05)
        pg = _browser.new_page(viewport={"width": 800, "height": 600})
        self.addCleanup(pg.close)
        pg.set_content('<main><h1>x</h1>'
                       '<div aria-hidden="true"><button tabindex="-1" class="demo"><svg width="8" height="8"></svg></button></div>'
                       '<div id="host" aria-hidden="true"></div>'
                       '<div inert><button class="inert"></button></div>'
                       '<div aria-hidden="true"><button class="reachable">Ghost</button></div>'
                       '<button class="real"></button></main>')
        pg.evaluate("document.getElementById('host').attachShadow({mode: 'open'}).innerHTML = '<button tabindex=\"-1\" class=\"shadow\"></button>'")
        p = pg.evaluate(PROBE)
        unnamed = [n["sel"] for n in p["targets"]["noName"]]
        self.assertEqual(unnamed, ["main > button.real"])                 # only the control people can actually reach
        self.assertFalse([s for s in p["targets"]["small"] if any(k in s["sel"] for k in ("demo", "shadow", "inert"))])
        hidden = {h["sel"].split(" > ")[-1]: h["why"] for h in p["targets"]["hiddenFocusable"]}
        self.assertEqual(hidden.get("button.reachable"), "inside aria-hidden")   # still reported, once, as reachable but unseen

    def test_a_sticky_sidebar_pushed_loose_at_the_end_is_not_pinned_under_the_header(self):     # CV-08
        # opendesigner.dev/docs/: near the footer the sticky sidebar runs out of container and scrolls up under the header like
        # any content, so its links were reported as pinned there for good (2026-11-05). A sidebar stuck under the bar still is.
        pg = _browser.new_page(viewport={"width": 1000, "height": 600})
        self.addCleanup(pg.close)
        head = '<header style="position:sticky;top:0;height:60px;background:#fff;z-index:2">Head</header>'
        links = "".join(f'<a href="#{i}" style="display:block;height:25px">Link {i}</a>' for i in range(20))   # 500 px, like a docs sidebar
        side = ('<div style="display:flex"><aside style="width:200px"><nav style="position:sticky;top:{top}px">' + links +
                '</nav></aside><main style="flex:1;height:2000px">x</main></div><footer style="height:900px">foot</footer>')
        pinned = lambda: [h for h in pg.evaluate(PROBE + ";__od.bars()")["hits"] if h["why"] == "pinned"]
        pg.set_content('<!doctype html><body style="margin:0">' + head + side.format(top=60))
        self.assertEqual(pinned(), [])                                            # loose at the end: it scrolls back out
        pg.set_content('<!doctype html><body style="margin:0">' + head + side.format(top=0))
        self.assertTrue(any(h["text"] == "Link 0" for h in pinned()))             # stuck under the bar: lost for good

    def test_visually_hidden_text_in_a_tiny_clipped_box_is_not_clipped_text(self):             # ST-04, issue #76
        # opendesigner.dev's library legends: 4 x 1 px, clipped, for screen readers; a real squeezed label still counts
        pg = _browser.new_page(viewport={"width": 800, "height": 600})
        self.addCleanup(pg.close)
        pg.set_content('<!doctype html><style>.sr{position:absolute;width:4px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}'
                       '.cp{position:absolute;width:40px;height:20px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}'
                       '.squeezed{width:60px;height:20px;overflow:hidden;white-space:nowrap}</style>'
                       '<fieldset><legend class="sr">Choose the seats for this booking</legend></fieldset>'
                       '<p class="cp">Hidden by clip-path for screen readers</p><p class="squeezed">A label squeezed into a box too small for it</p>')
        clipped = [c["sel"].split(":")[0] for c in pg.evaluate(PROBE)["overflow"]["clipped"]]
        self.assertEqual(clipped, ["p.squeezed"])

    def test_a_lone_arrow_is_held_to_3_to_1_and_text_to_4_5(self):                             # MS-04, issue #76
        pg = _browser.new_page(viewport={"width": 800, "height": 600})
        self.addCleanup(pg.close)
        # #808793 on white is 3.62:1: enough for a graphic (WCAG 1.4.11), not for text (1.4.3)
        pg.set_content('<!doctype html><body style="background:#fff;font:14px sans-serif"><p>Tokens <span class="arrow" style="color:#808793">→</span> theme</p>'
                       '<p class="words" style="color:#808793">Muted words at the same colour</p></body>')
        p = pg.evaluate(PROBE)
        failing = [c["sel"] for c in p["contrast"]["failing"]]
        self.assertFalse([s for s in failing if "arrow" in s])
        self.assertTrue([s for s in failing if s.startswith("p.words")])
        arrow = [c for c in p["contrast"]["lowest"] + p["contrast"]["failing"] if c["sel"].endswith("span.arrow")]
        self.assertTrue(arrow and arrow[0]["symbol"])

    def test_capture_loads_a_page_again_when_its_stylesheet_failed(self):                      # CV-09, issue #76
        import capture
        pg = _browser.new_page(viewport={"width": 800, "height": 600})
        self.addCleanup(pg.close)
        log = []
        pg.goto(f"http://localhost:{self.port}/labels.html"); pg.wait_for_timeout(200)
        capture.styles_loaded(pg, "ok-cell", log)                                 # nothing missing: nothing said, nothing reloaded
        self.assertEqual(log, [])
        page_url = f"http://localhost:{self.port}/no-styles.html"             # served by a route, so a reload asks for the same broken sheet
        pg.route(page_url, lambda r: r.fulfill(content_type="text/html", body=f'<!doctype html><link rel="stylesheet" href="http://localhost:{self.port}/missing-sheet.css"><p>x</p>'))
        pg.goto(page_url); pg.wait_for_timeout(200)
        with self.assertRaises(RuntimeError) as e:                                # missing twice: the cell measures nothing
            capture.styles_loaded(pg, "bad-cell", log)
        self.assertIn("did not load twice", str(e.exception))
        self.assertTrue(log and "loaded the page again" in log[0])                # and the reload is said

    def test_text_in_a_closed_details_is_not_under_a_bar(self):                                # CV-08
        # Chrome reports line boxes for a closed <details>' hidden text; a component page's source code was "under" the consent card
        pg = _browser.new_page(viewport={"width": 800, "height": 600})
        self.addCleanup(pg.close)
        code = "\n".join(f"line {i} " + "x" * 120 for i in range(200))   # long lines, so they reach under the card on the right
        pg.set_content('<!doctype html><body style="margin:0"><p>Top</p><details><summary>Source</summary><pre>' + code + '</pre></details>'
                       '<div style="height:400px"></div><div style="position:fixed;right:16px;bottom:16px;width:300px;height:160px;background:#fff">Card</div>'
                       '<div style="height:200px"></div></body>')
        self.assertEqual([h for h in pg.evaluate(PROBE + ";__od.bars()")["hits"] if h["text"].startswith("line")], [])

    def test_a_ring_drawn_on_a_stretched_after_counts_as_a_focus_ring(self):                  # IN-02
        # opendesigner.dev's library cards are one link whose ::after covers the card and carries the ring (2026-11-05)
        pg = _browser.new_page(viewport={"width": 800, "height": 600})
        self.addCleanup(pg.close)
        pg.set_content('<!doctype html><style>.card{position:relative;padding:16px} .card a:focus-visible{outline:none}'
                       '.card a::after{content:"";position:absolute;inset:0} .card a:focus-visible::after{outline:2px solid #2338ff;outline-offset:4px}'
                       '.bare:focus-visible{outline:none}</style>'
                       '<div class="card"><a href="#x">Card link</a></div><a class="bare" href="#y">No ring</a>')
        pg.evaluate(PROBE)
        pg.keyboard.press("Tab")
        card = pg.evaluate("__od.focus()")
        pg.keyboard.press("Tab")
        bare = pg.evaluate("__od.focus()")
        self.assertTrue(card["ring"]["visible"])
        self.assertEqual(card["ring"]["on"], "::after")
        self.assertFalse(bare["ring"]["visible"])                                 # a ring removed with nothing in its place still fails

    def test_competing_primary_buttons_are_counted_and_states_and_cards_are_not(self):          # MS-16
        pg = _browser.new_page(viewport={"width": 1280, "height": 800})
        self.addCleanup(pg.close)
        pg.goto(f"http://localhost:{self.port}/actions.html")
        pg.wait_for_timeout(300)
        p = pg.evaluate(PROBE)
        filled = {b["sel"]: b for b in p["buttons"]["filled"]}
        self.assertNotIn("a#nav-home", filled)            # the current page's nav item is a state
        self.assertNotIn("button#tab-day", filled)        # so is a selected tab
        self.assertNotIn("a#card", filled)                # a card that is a link is too big to be a button
        self.assertNotIn("button#pricing", filled)        # an outline button has no fill
        self.assertLess(filled["button#tour"]["ratio"], rv.PRIMARY_RATIO)          # a quiet fill is measured but is not a primary
        self.assertEqual(filled["a#signup"]["ratio"], 5.17)                       # #2563eb on white
        self.assertTrue(filled["button#upgrade"]["gradient"])
        self.assertEqual(filled["button#upgrade"]["fill"], "#7c3aed")              # a gradient counts by its first colour
        self.assertFalse(filled["button#save"]["first"])
        F = rv.Findings()
        rv.check_probe(p, None, F)
        ms16 = {f["title"]: f for f in F.done() if f["case"] == "MS-16"}
        self.assertIn("3 primary buttons in the first screen", ms16)               # Sign up, Get started, Book a demo
        self.assertIn("\"Save\" (#2563eb) and \"Delete\" (#dc2626) sit side by side", ms16["3 primary buttons in the first screen"]["measured"])
        self.assertIn("3 different fills for the main button", ms16)               # blue, near-black and the purple gradient; red is the danger level

    def test_the_stored_fixture_still_matches_a_live_run(self):
        live = self.page().evaluate(PROBE)
        stored = json.loads((HERE / "fixtures" / "broken-390.probe.json").read_text())
        for path in (("doc", "hOverflow"), ("contrast", "checked"), ("targets", "count"), ("images", "total")):
            a, b = live, stored
            for k in path:
                a, b = a[k], b[k]
            self.assertEqual(a, b, path)

    def test_probe_does_not_change_the_page(self):
        pg = self.page()
        before = pg.evaluate("document.documentElement.outerHTML.length")
        pg.evaluate(PROBE)
        self.assertEqual(pg.evaluate("document.documentElement.outerHTML.length"), before)

    def test_stress_changes_the_page_says_so_and_is_fully_reversible(self):
        pg = self.page(1280, 800)
        pg.evaluate(PROBE)
        html = pg.evaluate("document.documentElement.outerHTML")
        for kind in ("textSpacing", "text200", "pseudoloc", "longWords", "rtl"):
            r = pg.evaluate(f"__od.stress('{kind}', true)")
            self.assertNotIn("error", r)
            self.assertEqual(pg.evaluate("__od.probe()")["stress"], [kind])
            self.assertNotEqual(pg.evaluate("document.documentElement.outerHTML"), html, kind)
            pg.evaluate(f"__od.stress('{kind}', false)")
            self.assertEqual(pg.evaluate("document.documentElement.outerHTML"), html, kind)
        self.assertIn("error", pg.evaluate("__od.stress('nonsense', true)"))

    def test_long_words_push_a_narrow_layout_wider(self):
        pg = self.page(320, 640)
        pg.evaluate("document.querySelector('.wide').remove()")   # take the planted 900 px box out so only the stress can overflow
        base = pg.evaluate(PROBE)
        self.assertEqual(base["doc"]["hOverflow"], 0)
        pg.evaluate("__od.stress('longWords', true)")
        stressed = pg.evaluate("__od.probe()")
        self.assertGreater(stressed["doc"]["hOverflow"] + len(stressed["overflow"]["clipped"]), 0)

    def test_measure_at_style_seek_and_play(self):
        pg = self.page()
        pg.evaluate(PROBE)
        m = pg.evaluate("__od.measure('header', 'main')")
        self.assertGreaterEqual(m["gapY"], 0)
        self.assertIn("stack", pg.evaluate("__od.at(60, 300)"))
        self.assertIn("color", pg.evaluate("__od.style('h1')"))
        self.assertEqual(pg.evaluate("__od.seek(0.5)")["seeked"], 1)
        self.assertEqual(pg.evaluate("__od.play()")["resumed"], 1)

    def test_tab_walk_reports_a_missing_ring(self):
        pg = self.page(1280, 800)
        pg.evaluate(PROBE)
        for _ in range(4):
            pg.keyboard.press("Tab")
            rec = pg.evaluate("__od.focus()")
        self.assertTrue(rec["active"])
        self.assertFalse(rec["ring"]["visible"])
        F = rv.Findings()
        rv.check_focus(pg.evaluate("__od.focusDoc()"), F)
        self.assertTrue(any("no focus indicator" in f["title"] for f in F.done()))

    def test_hidden_skip_links_closed_details_and_srcset_images_are_not_misread(self):
        """Three false findings seen on a real page (2026-10-14): a skip link at left -9999 px named as the cause of sideways
        scroll, links inside a closed <details> counted as visible targets, and a 1440 px srcset file called blurry because
        naturalWidth is divided by the candidate's density."""
        c = _browser.new_context(viewport={"width": 390, "height": 800}, device_scale_factor=2)
        self.addCleanup(c.close)
        pg = c.new_page()
        base = f"http://localhost:{self.port}/srcset-test/"
        svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="#888"/></svg>'
        page = ('<!doctype html><html lang="en"><body style="margin:0"><a id="skip" href="#m" style="position:absolute;left:-9999px">Skip</a>'
                '<main id="m"><details><summary>Menu</summary><a id="hid" href="#" style="display:block;width:10px;height:10px;font-size:8px">x</a></details>'
                '<img alt="" srcset="big.svg 800w" sizes="200px" style="width:200px"></main></body></html>')
        pg.route(base + "**", lambda r: r.fulfill(status=200, content_type="image/svg+xml" if r.request.url.endswith(".svg") else "text/html", body=svg if r.request.url.endswith(".svg") else page))
        pg.goto(base + "page.html")
        pg.wait_for_timeout(200)
        self.assertEqual(pg.evaluate("document.querySelector('img').naturalWidth"), 200, "density-corrected naturalWidth (800w at 200px sizes)")
        p = pg.evaluate(PROBE)
        self.assertFalse(any("skip" in o["sel"] for o in p["overflow"]["list"]), p["overflow"]["list"])
        self.assertFalse(any("hid" in s["sel"] for s in p["targets"]["small"]), p["targets"]["small"])
        self.assertEqual(p["images"]["blurry"], [])
        self.assertTrue(any("skip" in h["sel"] for h in p["targets"]["hiddenFocusable"]), "the skip link is still listed, as outside the page")

    def test_capture_py_runs_the_whole_plan_and_check_reads_it(self):
        with tempfile.TemporaryDirectory() as d:
            args = [sys.executable, str(HERE / "capture.py"), "--url", f"http://localhost:{self.port}", "--routes", "/broken.html",
                    "--viewports", "390,1280x800", "--themes", "light", "--out", d]
            if _CHANNEL:
                args += ["--channel", _CHANNEL]
            r = subprocess.run(args, capture_output=True, text=True, timeout=240)
            self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
            out = Path(d)
            for sub in ("probes", "focus", "hover", "console", "shots"):
                self.assertTrue(any((out / sub).iterdir()), sub)
            self.assertTrue(any(p.name.endswith("stress-longWords.json") for p in (out / "probes").iterdir()))
            led = json.loads((out / "ledger.json").read_text())["cells"]
            self.assertEqual(led["/broken.html|390x844|light"]["status"], "done")
            r2 = subprocess.run([sys.executable, str(HERE / "review.py"), "check", d, "--dir", d, "--json"], capture_output=True, text=True)
            cases = {f["case"] for f in json.loads(r2.stdout)}
            self.assertTrue({"CV-05", "IN-02", "MS-04", "EN-06"} <= cases, cases)
            for remote in ("https://example.com", "http://192.168.1.10:3000", "http://staging.test"):
                refused = subprocess.run([sys.executable, str(HERE / "capture.py"), "--url", remote, "--out", d], capture_output=True, text=True)
                self.assertNotEqual(refused.returncode, 0, remote)
                self.assertIn("not a local address", refused.stderr + refused.stdout)
            sneaky = subprocess.run([sys.executable, str(HERE / "capture.py"), "--url", f"http://localhost:{self.port}", "--routes", "//example.com/", "--out", d],
                                    capture_output=True, text=True)
            self.assertNotEqual(sneaky.returncode, 0)
            self.assertIn("not a local address", sneaky.stderr + sneaky.stdout)


    def open(self, name, w):
        c = _browser.new_context(viewport={"width": w, "height": 844 if w < 700 else 900})
        self.addCleanup(c.close)
        import capture
        c.add_init_script(capture.WATCH_JS)
        pg = c.new_page()
        pg.goto(f"http://localhost:{self.port}/{name}")
        capture.settle(pg)
        return pg

    def test_type_layout_and_buttons_from_one_probe(self):                                        # MS-17, MS-18, MS-05, MS-19, EN-08
        p = self.open("round.html", 390).evaluate(PROBE)
        self.assertEqual([c["sel"] for c in p["type"]["capsTight"]], ["p#eyebrow"])
        self.assertEqual(p["type"]["tracking"]["40|0.02|0"]["ex"], ["p#big"])
        self.assertEqual([h["sel"] for h in p["type"]["headings"]["long"]], ["h1#head-long"])
        mixed = p["layout"]["mixed"][0]
        self.assertEqual((mixed["heading"], mixed["align"]), ("Built for operators", "center"))
        self.assertEqual({i["sel"]: i["align"] for i in mixed["items"]}, {"p#mixed-p": "left", "div#mixed-ctas": "left"})
        self.assertEqual([(o["sel"], o["off"]) for o in p["layout"]["offCentre"]], [("h2#off", 12)])
        self.assertEqual({s["sel"]: (s["kind"], s["radius"]) for s in p["buttons"]["styles"]}, {"a#buy": ("filled", 8), "a#demo": ("filled", "pill"), "a#more": ("outline", 2)})
        self.assertEqual(p["fonts"]["unused"], [{"family": "Fixture Unused", "faces": 1}])
        self.assertEqual(p["motion"]["pending"], 0)
        F = rv.Findings()
        rv.check_probe(p, None, F)
        fs = {f["case"] for f in F.done()}
        self.assertTrue({"MS-17", "MS-18", "MS-05", "MS-19", "MS-02", "EN-08"} <= fs, fs)

    def test_pixels_bars_toggles_and_kerning(self):                                               # MS-20, MS-04, CV-08, ST-10, ST-11, MS-17
        import capture
        pg = self.open("pixels.html", 1280)
        p = pg.evaluate(PROBE)
        html = pg.evaluate("document.body.innerHTML")
        with tempfile.TemporaryDirectory() as d:
            for fn in (capture.letter_reveals, capture.text_pixels, capture.floating_bars, capture.toggles):
                fn(pg, Path(d), "px-1280", p, None)
            self.assertEqual(pg.evaluate("document.body.innerHTML"), html)          # every toggle is put back, every mark removed
            self.assertEqual(pg.evaluate("window.scrollY"), 0)
            F = rv.Findings()
            for sub in ("pixels", "kern", "bars", "states"):
                doc = json.loads((Path(d) / sub / "px-1280.json").read_text())
                rv.CAPTURE_CHECKS[doc["kind"]](doc, F)
        by = {}
        for f in F.done():
            by.setdefault(f["case"], []).append(f)
        self.assertEqual(by["MS-20"][0]["evidence"], ["p#crossed"])                       # not the clean paragraph, not the tabs
        self.assertEqual(by["MS-04"][0]["evidence"], ["p#pale"])
        self.assertEqual({h.split(" ")[0] for h in by["CV-08"][0]["evidence"]}, {"p#pin-caption", "p#foot", "div#bar"})
        self.assertIn("div#panels", by["ST-10"][0]["evidence"])
        self.assertEqual(by["ST-11"][0]["evidence"][0], "button#s-a")
        self.assertIn("pixels", by["ST-11"][0]["measured"])
        self.assertGreater(float(re.search(r"up to ([\d.]+) px", by["MS-17"][0]["measured"]).group(1)), 5)   # inline-block letters drop AV, To, Ty

    def test_a_reveal_that_puts_plain_text_back_is_caught_jumping(self):                          # MS-17
        pg = self.open("pixels.html", 1280)
        pg.evaluate("""() => { const h = document.querySelector('#split'); h.textContent = h.getAttribute('aria-label'); }""")   # the reveal ends: plain text again
        pg.wait_for_timeout(300)
        swapped = pg.evaluate("__od.kern()")["swapped"]
        self.assertEqual(swapped[0]["sel"], "h2#split")
        self.assertGreater(swapped[0]["maxDx"], 5)

    def test_settle_waits_for_a_reveal_and_ignores_loops(self):                                   # TM-01
        pg = _browser.new_page()
        self.addCleanup(pg.close)
        pg.set_content('<style>@keyframes a{from{opacity:0}to{opacity:1}}@keyframes s{to{transform:rotate(1turn)}}</style>'
                       '<p style="animation:a 600ms both">x</p><i style="display:block;width:9px;height:9px;animation:s 1s linear infinite"></i>')
        pg.evaluate(PROBE)
        r = pg.evaluate("__od.settle(3000)")
        self.assertTrue(r["settled"])
        self.assertGreater(r["waited"], 400)
        self.assertLess(r["waited"], 2000)


def png_size(data):
    import struct
    assert data[:8] == b"\x89PNG\r\n\x1a\n"
    return struct.unpack(">II", data[16:24])


@unittest.skipIf(_browser is None, "Playwright or a Chromium-family browser is not available")
class ClaimsWeRelyOn(unittest.TestCase):
    """Browser behaviours that references/ and cases.json state as tested (2026-09-29, Chrome 153). If a browser update changes
    one, this fails and the text that relies on it needs a second look."""

    def page(self, w=800, h=600, **ctx):
        c = _browser.new_context(viewport={"width": w, "height": h}, **ctx)
        self.addCleanup(c.close)
        return c.new_page()

    def test_full_page_capture_never_expands_an_inner_scroll_area(self):                          # CV-04
        pg = self.page()
        pg.set_content('<body style="margin:0"><div style="height:300px;overflow:auto"><div style="height:2000px">x</div></div></body>')
        w, h = png_size(pg.screenshot(full_page=True))
        self.assertLess(h, 700)

    def test_full_page_capture_does_not_scroll_so_far_lazy_images_are_never_requested(self):      # CV-03
        pg = self.page()
        hits = []
        pg.route("**/lazy.png", lambda route: (hits.append(1), route.fulfill(status=200, content_type="image/png", body=b"")))
        pg.set_content('<body style="margin:0"><div style="height:9000px"></div><img loading="lazy" width="50" height="50" src="http://example.invalid/lazy.png"></body>')
        pg.wait_for_timeout(200)
        pg.screenshot(full_page=True)
        self.assertEqual(hits, [], "a far-away lazy image was requested without scrolling")
        pg.evaluate("window.scrollTo(0, document.documentElement.scrollHeight)")
        pg.wait_for_timeout(300)
        self.assertTrue(hits, "scrolling to it should request it")

    def test_a_finished_transition_disappears_from_getAnimations(self):                           # TM-02
        pg = self.page()
        pg.set_content('<style>#a{opacity:1;transition:opacity 100ms linear}#a.x{opacity:.2}</style><div id="a">a</div>')
        self.assertEqual(pg.evaluate("document.getAnimations().length"), 0)
        pg.evaluate("document.getElementById('a').classList.add('x'); document.getAnimations().length")
        self.assertEqual(pg.evaluate("document.getAnimations().length"), 1)
        pg.wait_for_timeout(400)
        self.assertEqual(pg.evaluate("document.getAnimations().length"), 0)

    def test_pause_and_seek_gives_the_same_frame_every_time(self):                                # TM-01
        pg = self.page()
        pg.set_content('<style>@keyframes m{to{transform:translateX(100px)}}#a{animation:m 1000ms linear forwards}</style><div id="a">a</div>')
        got = [pg.evaluate("(() => { const a = document.getAnimations()[0]; a.pause(); a.currentTime = 500; return new DOMMatrix(getComputedStyle(document.getElementById('a')).transform).m41; })()") for _ in range(2)]
        self.assertEqual(got[0], got[1])
        self.assertAlmostEqual(got[0], 50, delta=0.5)

    def test_document_fonts_check_is_true_for_a_font_that_does_not_exist(self):                   # MS-03
        pg = self.page()
        pg.set_content("<p>x</p>")
        self.assertTrue(pg.evaluate("document.fonts.check('16px \"Definitely Not A Font 123\"')"))

    def test_drawn_font_comes_from_cdp_not_from_fonts_check(self):                                # MS-03
        pg = self.page()
        pg.set_content('<p id="p" style="font-family:\'Definitely Not A Font 123\', Georgia">x</p>')
        cdp = pg.context.new_cdp_session(pg)
        cdp.send("DOM.enable")
        cdp.send("CSS.enable")
        root = cdp.send("DOM.getDocument", {"depth": 0})["root"]["nodeId"]
        nid = cdp.send("DOM.querySelector", {"nodeId": root, "selector": "#p"})["nodeId"]
        drawn = [f["familyName"] for f in cdp.send("CSS.getPlatformFontsForNode", {"nodeId": nid})["fonts"]]
        self.assertNotIn("Definitely Not A Font 123", drawn)
        self.assertTrue(drawn)

    def test_a_narrow_desktop_window_ignores_the_viewport_tag_a_phone_profile_does_not(self):     # CV-01
        wide = '<div style="width:600px;height:20px;background:#ccc">x</div>'
        desktop = self.page(390, 800)
        desktop.set_content(wide)
        phone = self.page(390, 800, is_mobile=True, has_touch=True)
        phone.set_content(wide)                      # no viewport meta: a phone lays out at its default width
        self.assertEqual(desktop.evaluate("document.documentElement.clientWidth"), 390)
        self.assertGreater(phone.evaluate("document.documentElement.clientWidth"), 390)
        self.assertFalse(phone.evaluate("matchMedia('(hover: hover)').matches"))
        self.assertTrue(phone.evaluate("matchMedia('(pointer: coarse)').matches"))

    def test_focus_visible_follows_the_keyboard_not_the_mouse(self):                              # ST-01
        pg = self.page()
        pg.set_content('<button id="a">a</button><button id="b">b</button>')
        pg.click("#b")
        self.assertFalse(pg.evaluate("document.getElementById('b').matches(':focus-visible')"))
        pg.keyboard.press("Shift+Tab")
        self.assertTrue(pg.evaluate("document.activeElement.matches(':focus-visible')"))

    def test_playwright_calls_an_invisible_control_visible(self):                                 # IN-08
        pg = self.page()
        pg.set_content('<button id="g" style="opacity:0">ghost</button><button id="o" style="position:absolute;left:-5000px">off</button>')
        self.assertTrue(pg.locator("#g").is_visible())
        self.assertTrue(pg.locator("#o").is_visible())

    def test_negative_left_overflow_does_not_raise_scroll_width(self):                            # CV-05
        pg = self.page(390, 800)
        pg.set_content('<body style="margin:0"><div id="n" style="margin-left:-80px;width:200px;height:10px;background:#ccc"></div></body>')
        self.assertEqual(pg.evaluate("document.documentElement.scrollWidth"), 390)
        self.assertLess(pg.evaluate("document.getElementById('n').getBoundingClientRect().left"), 0)
        probe = pg.evaluate(PROBE)
        self.assertTrue(probe["overflow"]["list"], "the probe checks each box, not only the page width")

    def test_a_phone_profile_zooms_out_to_fit_overflow_so_the_probe_uses_the_layout_viewport(self):   # CV-01, CV-05
        pg = self.page(390, 800, is_mobile=True, has_touch=True)
        pg.set_content('<meta name="viewport" content="width=device-width, initial-scale=1"><body style="margin:0"><div id="w" style="width:900px;height:20px;background:#ccc">wide</div></body>')
        probe = pg.evaluate(PROBE)
        self.assertEqual(probe["viewport"]["w"], 390)
        self.assertGreater(probe["viewport"]["innerW"], 390, "window.innerWidth grows to fit the overflowing content")
        self.assertGreater(probe["doc"]["hOverflow"], 0)
        self.assertTrue(probe["overflow"]["list"], "the wide box is listed against the layout width, not the zoomed-out one")

    def test_a_viewport_tag_that_caps_zoom_below_2x_is_flagged(self):                             # EN-01
        for meta, blocked in (("width=device-width, initial-scale=1", False), ("width=device-width, maximum-scale=5", False), ("width=device-width, maximum-scale=1.5", True),
                              ("width=device-width, maximum-scale=1", True), ("width=device-width, user-scalable=no", True)):
            pg = self.page()
            pg.set_content(f'<meta name="viewport" content="{meta}"><p>x</p>')
            self.assertEqual(pg.evaluate(PROBE)["doc"]["blocksZoom"], blocked, meta)

    def test_emulating_media_reaches_the_page(self):                                              # EN-02, TM-10
        pg = self.page()
        pg.set_content("<p>x</p>")
        pg.emulate_media(forced_colors="active", reduced_motion="reduce", color_scheme="dark")
        for q in ("(forced-colors: active)", "(prefers-reduced-motion: reduce)", "(prefers-color-scheme: dark)"):
            self.assertTrue(pg.evaluate(f"matchMedia('{q}').matches"), q)


if __name__ == "__main__":
    unittest.main(verbosity=1)
