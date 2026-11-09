#!/usr/bin/env python3
"""Tests for css_scan.py and read_page.js (reference measurement). Standard library only, no network.
The read_page.js tests need Node and are skipped without it. Fixtures are small pages written here.

    python3 skills/opendesigner-extract/scripts/test_extract.py
"""
import contextlib, importlib.util, io, json, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import css_scan  # noqa: E402

NODE = shutil.which("node")
ENGINE = next((p for p in (HERE / "engine.py", HERE.parent.parent / "opendesigner" / "scripts" / "engine.py") if p.exists()), None)

# A docs-like page: many short nav and caption rules, headings, one body size, slate text colors,
# a decorative chromatic blob, 1 px radius on inline links, pills as badges, a white fade "shadow".
SITE_CSS = """
:root { --brand: #5469d4; --radius-control: 6px; --shadow-card: 0 2px 5px rgba(60,66,87,.08), 0 1px 1px rgba(0,0,0,.12); }
html { font-size: 16px; }
body { font-size: 16px; color: #3c4257; font-family: "Sohne", -apple-system, sans-serif; }
p { font-size: 1rem; color: #3c4257; }
li { font-size: 16px; }
h1 { font-size: 48px; text-shadow: 0 1px 2px #000; }
h2 { font-size: 32px; } h3 { font-size: 24px; } h4 { font-size: 20px; }
nav a { font-size: 14px; color: #414552; border-radius: 1px; }
.nav-item { font-size: 14px; } .nav-link { font-size: 14px; } .menu-item { font-size: 14px; }
.sidebar-link { font-size: 14px; } .breadcrumb { font-size: 14px; }
.caption { font-size: 12px; } .legal { font-size: 12px; } small { font-size: 12px; } footer p { font-size: 12px; }
a { color: var(--brand); border-radius: 1px; }
a.inline { border-radius: 1px; } .prose a { border-radius: 1px; }
.btn { border-radius: var(--radius-control); background: var(--brand); color: #fff;
       transition: opacity .2s cubic-bezier(0.25, 0.1, 0.25, 1), transform 300ms linear(0, 0.5 50%, 1); }
.btn-secondary { border-radius: 6px; background: #fff; color: #3c4257; border: 1px solid #d4dee9; }
input, select { border-radius: 6px; border: 1px solid #d4dee9; }
:focus-visible { outline: 2px solid #5469d4; }
[aria-selected="true"] { background: #5469d4; color: #fff; }
.badge { border-radius: 9999px; background: #e5edf5; } .pill { border-radius: 9999px; } .tag { border-radius: 9999px; }
.avatar { border-radius: 50%; }
.card { border-radius: 12px; box-shadow: var(--shadow-card); background: #fff; }
.modal { border-radius: 12px; box-shadow: 0 15px 35px rgba(50,50,93,.1), 0 5px 15px rgba(0,0,0,.07); }
.fade-edge { box-shadow: 0 0 64px 64px rgba(255,255,255,.75); }
.hidden-ring { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
.hero-blob { background: #ff5996; } .hero-blob-2 { background: #ffc043; }
.heading-slate { color: #0a2540; }
"""

SYSTEM_ONLY_CSS = "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; }"


def scan(css, name="site.css"):
    d = Path(tempfile.mkdtemp())
    (d / name).write_text(css, encoding="utf-8")
    try:
        return css_scan.analyse(css_scan.scan_files([str(d)]))
    finally:
        shutil.rmtree(d)


class Helpers(unittest.TestCase):
    def test_split_top_keeps_function_commas(self):
        v = "opacity .2s cubic-bezier(0.25, 0.1, 0.25, 1), transform 300ms linear(0, 0.5 50%, 1), color 1s ease"
        self.assertEqual(len(css_scan.split_top(v)), 3)
        self.assertIn("cubic-bezier(0.25, 0.1, 0.25, 1)", css_scan.split_top(v)[0])

    def test_parse_color_forms(self):
        self.assertEqual(css_scan.parse_color("#abc"), ("#aabbcc", 1.0))
        self.assertEqual(css_scan.parse_color("rgba(84, 105, 212, 0.5)"), ("#5469d4", 0.5))
        self.assertEqual(css_scan.parse_color("rgb(84 105 212 / 50%)"), ("#5469d4", 0.5))
        self.assertEqual(css_scan.parse_color("hsl(0, 100%, 50%)")[0], "#ff0000")
        L, C, H = css_scan.oklch("#5469d4")
        back = css_scan.parse_color(f"oklch({L} {C} {H})")[0]  # oklch() rounds to 3 decimals
        self.assertTrue(all(abs(int(back[i:i + 2], 16) - int("5469d4"[i - 1:i + 1], 16)) <= 2 for i in (1, 3, 5)), back)
        self.assertEqual(css_scan.parse_color("transparent")[1], 0.0)

    def test_shadow_classification(self):
        cls = lambda s: css_scan.classify_layer(css_scan.parse_shadow_layer(s))
        self.assertEqual(cls("0 0 64px 64px rgba(255,255,255,.75)"), "fade")
        self.assertEqual(cls("rgba(0, 0, 0, 0) 0px 0px 0px 1px"), "transparent")
        self.assertEqual(cls("rgb(84, 105, 212) 0px 0px 0px 1px"), "ring")
        self.assertEqual(cls("inset 0 1px 0 rgba(0,0,0,.1)"), "inset")
        self.assertEqual(cls("0 1px 1px rgba(0,0,0,.12)"), "low")
        self.assertEqual(cls("rgba(50, 50, 93, 0.12) 0px 16px 32px 0px"), "high")
        self.assertEqual(cls("0 30px 60px -12px rgba(50,50,93,.25)"), "overlay")


class DeclaredScan(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a = scan(SITE_CSS)

    def test_body_size_is_running_text_not_nav_or_captions(self):
        t = self.a["type"]
        self.assertEqual(t["body"]["px"], 16)
        self.assertEqual(self.a["bodySize"], 16)
        self.assertEqual(t["scale"]["base"], 16)
        self.assertEqual(t["largestHeading"]["px"], 48)
        self.assertEqual(t["headingRatio"]["value"], 3.0)

    def test_accent_from_interactive_skips_neutrals(self):
        c = self.a["color"]
        self.assertEqual(c["accents"][0]["hex"], "#5469d4")
        hexes = [x["hex"] for x in c["accents"]]
        for gray in ("#3c4257", "#414552", "#ffffff", "#000000", "#d4dee9"):
            self.assertNotIn(gray, hexes)
        self.assertNotIn("#ff5996", hexes)  # decorative, not interactive
        self.assertIn(c["confidence"], ("high", "medium"))
        self.assertTrue({"button", "focus", "selected", "link"} <= set(c["accents"][0]["sources"]))

    def test_radius_control_and_container_apart(self):
        r = self.a["radius"]
        self.assertEqual(r["control"]["px"], 6)
        self.assertEqual(r["container"]["px"], 12)
        self.assertEqual(r["mostCommon"], 6)
        self.assertGreaterEqual(r["ignored"].get("link", 0), 3)
        self.assertGreaterEqual(r["ignored"].get("decor", 0), 3)

    def test_shadows_ignore_fades_and_text_shadows(self):
        d = self.a["depth"]
        self.assertEqual(d["hint"], "shadow-ladder")
        joined = " ".join(d["shadows"])
        self.assertNotIn("255, 255, 255", joined)
        self.assertNotIn("64px", joined)
        self.assertIn("fade", d["ignored"])
        self.assertEqual({l["level"] for l in d["levels"]}, {"low", "medium", "overlay"})  # 35 px modal blur = overlay
        self.assertEqual(d["count"], 3)  # .card (via var), --shadow-card token, .modal

    def test_motion_keeps_easing_commas(self):
        m = self.a["motion"]
        self.assertIn("cubic-bezier(0.25, 0.1, 0.25, 1)", m["easings"])
        self.assertIn("linear(0, 0.5 50%, 1)", m["easings"])
        self.assertEqual(sorted(m["durations"]), [200.0, 300.0])

    def test_identity_and_confidence(self):
        t = self.a["type"]
        self.assertEqual(t["families"], ["Sohne"])
        self.assertFalse(t["primaryIsSystem"])
        s = self.a["summary"]
        for k in ("bodySize", "headingRatio", "accent", "radiusControl", "radiusContainer", "depth", "motionMedianMs"):
            self.assertIn(k, s)
            self.assertIn(s[k]["confidence"], ("high", "medium", "low"))
            self.assertIsInstance(s[k]["count"], int)
        self.assertNotIn("#5469d4", json.dumps(s))  # the summary never offers the hue as a value
        self.assertEqual(self.a["identity"]["accentHue"], "#5469d4")
        self.assertIn("never values to adopt", self.a["identity"]["rule"])

    def test_system_faces_are_not_identity(self):
        a = scan(SYSTEM_ONLY_CSS)
        self.assertEqual(a["type"]["families"], [])
        self.assertTrue(a["type"]["primaryIsSystem"])
        self.assertIn("-apple-system", a["type"]["systemFaces"])

    def test_html_inline_styles_and_style_blocks(self):
        html = """<html><head><style>.card{border-radius:10px} p{font-size:17px}</style></head>
        <body><button class="cta" style="border-radius: 4px; background: #1f6f5c">Go</button>
        <a href="#" style="border-radius:1px">link</a></body></html>"""
        a = scan(html, "index.html")
        self.assertEqual(a["radius"]["control"]["px"], 4)
        self.assertEqual(a["radius"]["container"]["px"], 10)
        self.assertEqual(a["bodySize"], 17)
        self.assertEqual(a["color"]["accents"][0]["hex"], "#1f6f5c")

    def test_resets_vars_and_unknown_class_names(self):
        css = """:root { --font-text: "Inter", sans-serif; }
        button, input, select { border-radius: 0; font-family: inherit; }
        body { font-family: var(--font-text); }
        .TransactionRow { border-radius: 10px; } .surface { border-radius: 10px; } .avatar { border-radius: 50%; }"""
        a = scan(css)
        self.assertEqual(a["type"]["families"], ["Inter"])
        self.assertEqual(a["radius"]["control"]["px"], 10)
        self.assertEqual(a["radius"]["control"]["confidence"], "low")

    def test_report_is_readable(self):
        text = css_scan.report(self.a)
        self.assertIn("Body size: 16 px", text)
        self.assertIn("Control radius: 6 px", text)
        self.assertIn("[", text)


def capture(**values):
    base = {k: {} for k in ("colors", "fontFamilies", "fontSizes", "lineHeights", "fontWeights", "spacing",
                            "radii", "shadows", "durations", "easings")}
    base.update(values)
    return {"source": "fixture", "method": "computed", "elements": 400, "values": base}


class ComputedCapture(unittest.TestCase):
    def test_old_capture_without_roles_falls_back_with_low_confidence(self):
        # the shape the designer tester saved: counts only, header nav first in DOM order
        a = css_scan.analyse(capture(fontSizes={"16": 460, "12": 18, "20": 10, "11": 5, "34": 4, "14": 1},
                                     radii={"1": 31, "5": 10, "6": 8, "100": 3},
                                     colors={"#3c4257": 300, "#5469d4": 113, "#ffffff": 23},
                                     easings={"cubic-bezier(0.25": 150}))
        self.assertEqual(a["bodySize"], 16)
        self.assertEqual(a["type"]["body"]["confidence"], "low")
        self.assertEqual(a["radius"]["mostCommon"], 5)  # 1 px corners dropped
        self.assertEqual(a["color"]["accents"][0]["hex"], "#5469d4")
        self.assertEqual(a["color"]["confidence"], "low")

    def test_ring_colors_count_toward_accent(self):
        a = css_scan.analyse(capture(shadows={"rgb(84, 105, 212) 0px 0px 0px 1px, rgba(0, 0, 0, 0.12) 0px 1px 1px 0px": 4}))
        self.assertEqual(a["depth"]["hint"], "ring+faint-shadow")
        self.assertEqual(a["color"]["accents"][0]["hex"], "#5469d4")
        self.assertNotIn("84, 105, 212", " ".join(a["depth"]["shadows"]))


@unittest.skipUnless(NODE, "node not installed")
class ReadPageJs(unittest.TestCase):
    """read_page.js core (collect) on synthetic element descriptions, then css_scan on its output."""

    def node(self, script):
        r = subprocess.run([NODE, "-e", script], capture_output=True, text=True, timeout=30,
                           env={"RP": str(HERE / "read_page.js"), "PATH": ""})
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads(r.stdout)

    def collect(self, items):
        return self.node("const a=require(process.env.RP);const r=a.collect(" + json.dumps(items) + ",1280);"
                         "console.log(JSON.stringify({source:'fixture',method:'computed',elements:" + str(len(items)) +
                         ",values:r.values,targetsUnder24:r.targetsUnder24}))")

    def test_directory_page_reads_card_copy(self):
        # a docs hub: 16 px product names and link lists, 14 px one-line descriptions, no paragraphs
        base = {"w": 200, "h": 20, "ctx": None, "prose": False, "linkText": False, "fontFamily": "-apple-system",
                "fontWeight": "400", "lineHeight": "20px", "radius": "0px", "boxShadow": "none", "spacing": []}
        items = [{**base, "own": 30, "fontSize": 14} for _ in range(30)]
        items += [{**base, "own": 10, "fontSize": 16, "linkText": True} for _ in range(20)]
        items += [{**base, "own": 22, "fontSize": 16, "prose": True, "linkText": True} for _ in range(10)]
        items += [{**base, "own": 24, "fontSize": 32, "ctx": "heading"}]
        a = css_scan.analyse(self.collect(items))
        self.assertEqual(a["bodySize"], 14)
        self.assertEqual(a["type"]["body"]["confidence"], "medium")
        self.assertIn("mostly short text", a["type"]["body"]["basis"])
        self.assertEqual(a["type"]["families"], [])
        self.assertTrue(a["type"]["primaryIsSystem"])

    def test_split_and_durations(self):
        out = self.node("const a=require(process.env.RP);console.log(JSON.stringify(["
                        "a.splitTop('cubic-bezier(0.25, 0.1, 0.25, 1), linear(0, 0.25 25%, 1), ease'),"
                        "a.toMs('0.3s'), a.toMs('150ms'), a.radiusValue('50%', 40, 40), a.radiusValue('9999px', 80, 32),"
                        "a.radiusValue('6px', 80, 32), a.parseRgb('rgba(84, 105, 212, 0.5)')]))")
        self.assertEqual(out[0], ["cubic-bezier(0.25, 0.1, 0.25, 1)", "linear(0, 0.25 25%, 1)", "ease"])
        self.assertEqual(out[1:6], [300, 150, "full", "full", 6])
        self.assertEqual(out[6], {"hex": "#5469d4", "a": 0.5})
        vis = self.node("const a=require(process.env.RP);console.log(JSON.stringify(["
                        "a.shadowVisible('rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 1px'),"
                        "a.shadowVisible('rgba(0, 0, 0, 0.12) 0px 1px 1px 0px'), a.shadowVisible('none'),"
                        "a.shadowVisible('rgb(227, 232, 238) 0px -1px 0px 0px inset')]))")
        self.assertEqual(vis, [False, True, False, False])

    def test_collect_then_scan(self):
        items = []
        white, ink, accent, slate = ({"hex": h, "a": 1} for h in ("#ffffff", "#0a2540", "#533afd", "#50617a"))
        none = {"hex": "#000000", "a": 0}
        base = {"w": 100, "h": 20, "own": 0, "ctx": None, "prose": False, "buttonLike": False, "link": False,
                "formField": False, "selected": False, "media": False, "containerHint": False, "fontSize": 16,
                "fontFamily": "sohne-var", "fontWeight": "400", "lineHeight": "normal", "color": slate, "bg": none,
                "border": None, "accentColor": None, "radius": "0px", "boxShadow": "none", "spacing": [],
                "transition": ["all", "0s", "ease"], "animation": None}
        el = lambda **k: items.append({**base, **k})
        for _ in range(60):  # header nav: many short 14 px labels
            el(own=8, ctx="nav", fontSize=14)
        for _ in range(12):  # running text at 16 px (fewer elements, more characters)
            el(own=220, prose=True, fontSize=16)
        for _ in range(6):   # short 16 px card labels
            el(own=12, fontSize=16)
        el(own=30, ctx="heading", fontSize=56, color=ink)
        el(own=20, ctx="heading", fontSize=32, color=ink)
        for _ in range(3):   # small print
            el(own=90, ctx="caption", fontSize=12, prose=True)
        for _ in range(30):  # inline links with a 1 px radius
            el(own=10, prose=True, link=True, radius="1px", color=accent)
        for _ in range(4):   # pill buttons
            el(own=10, ctx="control", buttonLike=True, w=120, h=36, radius="9999px", bg=accent, color=white,
               transition=["opacity, transform", "0.3s, 150ms", "cubic-bezier(0.25, 0.1, 0.25, 1), linear(0, 0.5 50%, 1)"])
        for _ in range(3):   # cards
            el(w=320, h=200, radius="8px", bg=white,
               boxShadow="rgba(50, 50, 93, 0.12) 0px 16px 32px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px")
        el(w=900, h=40, radius="0px", boxShadow="rgba(255, 255, 255, 0.75) 0px 0px 64px 64px")  # fade glow
        el(w=40, h=20, radius="9999px", bg={"hex": "#e5edf5", "a": 1})  # badge
        for _ in range(10):  # transparent accordion buttons (shadow reset to transparent): no visible corner
            el(own=30, ctx="control", buttonLike=True, w=450, h=60, radius="0px",
               boxShadow="rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 1px")
        for _ in range(20):  # a link list at 14 px inside li: labels, not running text
            el(own=25, prose=True, linkText=True, link=True, fontSize=14, color=accent)
        cap = self.collect(items)
        v = cap["values"]
        self.assertEqual(v["radiiByRole"]["control"], {"full": 4})
        self.assertEqual(v["textSizes"]["label"]["14"], 500)
        self.assertIn("cubic-bezier(0.25, 0.1, 0.25, 1)", v["easings"])
        self.assertIn("linear(0, 0.5 50%, 1)", v["easings"])
        a = css_scan.analyse(cap)
        self.assertEqual(a["bodySize"], 16)
        self.assertEqual(a["type"]["body"]["confidence"], "high")
        self.assertEqual(a["type"]["headingRatio"]["value"], 3.5)
        self.assertEqual(a["radius"]["control"]["px"], "full")
        self.assertEqual(a["radius"]["container"]["px"], 8)
        self.assertEqual(a["radius"]["ignored"]["link"], 30)
        self.assertEqual(a["color"]["accents"][0]["hex"], "#533afd")
        self.assertNotIn("#50617a", [x["hex"] for x in a["color"]["accents"]])
        self.assertEqual(a["depth"]["hint"], "shadow-ladder")
        self.assertEqual(a["depth"]["ignored"].get("fade"), 1)
        self.assertEqual(sorted(a["motion"]["durations"]), [150.0, 300.0])
        self.assertEqual(a["type"]["families"], ["sohne-var"])
        cap["values"]["fontFamilies"] = {"-apple-system": 1966, "Menlo": 1003, "Source Code Pro": 20}
        t = css_scan.analyse(cap)["type"]
        self.assertEqual((t["families"], t["minorFaces"], t["primaryIsSystem"]), ([], ["Source Code Pro"], True))


class SixMeasurementFixes(unittest.TestCase):
    """The six bugs found on 2026-10-23 by reading typesafe.ai and davecto.com against davecto's Taste Index reel."""

    def test_1_hard_shadows_frames_and_windows(self):
        cls = lambda s: css_scan.classify_layer(css_scan.parse_shadow_layer(s))
        self.assertEqual(cls("4px 4px 0 #000"), "hard")
        self.assertEqual(cls("0 1px 0 rgba(31, 35, 40, 0.04)"), "line")  # a hairline under a button, not a shadow style
        win = json.dumps({"bar": "#1e1e1e", "barHeight": 20, "body": "#c4c4c4", "border": "1px #1e1e1e", "radius": 0})
        a = css_scan.analyse(capture(shadows={"rgba(0, 0, 0, 0.25) 0px 4px 4px 0px": 1}, borders={"1px drawn": 60}) | {
            "patterns": {"windows": {win: 8}, "frames": {"3px #c4c4c4": 5}, "drawnOffsets": {}}})
        d = a["depth"]
        self.assertEqual(d["hint"], "borders")  # one soft shadow among 60 drawn borders is minor
        self.assertEqual((d["windowCount"], d["windows"][0]["bar"], d["minorShadows"]), (8, "#1e1e1e", 1))
        self.assertEqual(d["frames"][0]["band"], "3px")
        h = css_scan.analyse(capture(shadows={"rgb(30, 30, 30) 3px 3px 0px 0px": 6}))["depth"]
        self.assertEqual(h["hint"], "hard-offset")
        o = css_scan.analyse(capture() | {"patterns": {"drawnOffsets": {"3px 3px 0px 0px #000000": 4}}})["depth"]
        self.assertEqual(o["hint"], "hard-offset")
        self.assertIn("(drawn with boxes)", o["hard"][0])

    def test_2_loops_apart_from_ui_motion(self):
        a = css_scan.analyse(capture(durations={"500": 7}, easings={"cubic-bezier(0.12, 0.23, 0.5, 1)": 7}, transitionKinds={"color": 7},
                                     loops={"count": 10, "durations": {"2000": 5, "18248": 5}, "easings": {"linear": 10}}))
        m = a["motion"]
        self.assertEqual(m["durations"], [500.0])
        self.assertTrue(m["fadesOnly"])
        self.assertEqual((m["loops"]["count"], m["loops"]["character"]), (10, "linear"))
        self.assertEqual([css_scan.ease_kind(e) for e in ("steps(4, end)", "linear", "cubic-bezier(0.3, 1.4, 0.6, 1)",
                                                          "linear(0, 1.1 60%, 1)", "ease-out")],
                         ["stepped", "linear", "springy", "springy", "eased"])
        declared = scan(".ticker { animation: spin 18s linear infinite; } .btn { transition: color 150ms ease; }")["motion"]
        self.assertEqual(declared["durations"], [150.0])
        self.assertEqual(declared["loops"]["count"], 1)

    def test_3_browser_link_blue_and_error_colours_never_win(self):
        a = css_scan.analyse(capture(accentSources={"link": {"#0000ee": 13}, "button": {"#f386a1": 1}}))
        self.assertEqual(a["color"]["accents"][0]["hex"], "#f386a1")
        b = scan(":root { --accent: #0f766e; --ring: #0f766e; --destructive: #8c3b2e; } .error:focus-visible { outline: 2px solid #8c3b2e; }")
        self.assertEqual(b["color"]["accents"][0]["hex"], "#0f766e")

    def test_4_and_5_and_6_space_colour_area_and_sections(self):
        surfaces = {"grid": 16, "pageBg": "#fefefe", "areas": {"#f386a1": 0.58, "#1e1e1e": 0.19, "#fefefe": 0.13, "#03aa5c": 0.08},
                    "text": {"#1e1e1e": 0.9, "#fefefe": 0.1}, "textShare": 0.05, "whitespace": 0.83, "blankRows": 0.17, "air": 0.63,
                    "sections": [{"hex": "#f386a1", "y": 2322, "h": 5946}, {"hex": "#03aa5c", "y": 8268, "h": 972},
                                 {"hex": "#1e1e1e", "y": 9240, "h": 2092}], "gradients": 0, "imagery": 0.4}
        a = css_scan.analyse(capture() | {"surfaces": surfaces, "layout": {"docHeight": 11362}})
        sf = a["surfaces"]
        self.assertEqual([w["hex"] for w in sf["worlds"]], ["#f386a1", "#1e1e1e", "#03aa5c"])
        self.assertTrue(sf["colourIsPlace"])
        self.assertAlmostEqual(sf["chromaticShare"], 0.66, places=2)
        self.assertEqual((a["air"], a["blankRows"]), (0.63, 0.17))
        quiet = css_scan.analyse(capture() | {"surfaces": {**surfaces, "areas": {"#f7f5f0": 1.0}, "sections": [],
                                                           "text": {"#181614": 0.55, "#6b655c": 0.35, "#0f766e": 0.1}}})
        self.assertLess(quiet["surfaces"]["chromaticShare"], 0.01)
        self.assertFalse(quiet["surfaces"]["colourIsPlace"])

    def test_type_roles_and_names(self):
        self.assertEqual(css_scan.face_name("Die Grotesk C Medium"), "Die Grotesk C")
        self.assertEqual(css_scan.face_name("'LisaTerminal Paper 2X3Y Medium'"), "LisaTerminal Paper 2X3Y")
        self.assertEqual(css_scan.face_name("sohne-var"), "sohne-var")
        roles = {"heading": {"families": {"Die Grotesk C Medium": 259}, "weights": {"500": 259}, "sizes": {"150": 140}, "tracking": {"-0.02": 259},
                             "transform": {"capitalize": 200}, "lineHeight": {}, "chars": 259},
                 "body": {"families": {"Die Grotesk C Regular": 2126, "LisaTerminal Paper 2X3Y Medium": 543}, "weights": {"400": 2126},
                          "sizes": {"22": 1150}, "tracking": {}, "transform": {}, "lineHeight": {"1.2": 2000}, "chars": 2669},
                 "noise": {"families": {"JetBrains Mono": 828}, "weights": {}, "sizes": {"12": 828}, "tracking": {}, "transform": {}, "lineHeight": {}, "chars": 828}}
        t = css_scan.analyse(capture(typeRoles=roles))["type"]
        self.assertEqual(t["roles"]["heading"]["family"], "Die Grotesk C")
        self.assertEqual(t["roles"]["heading"]["case"], "capitalize")
        self.assertEqual([v["family"] for v in t["voices"]], ["Die Grotesk C", "JetBrains Mono", "LisaTerminal Paper 2X3Y"])

    def test_merge_two_pages(self):
        p1 = capture(durations={"150": 4}) | {"surfaces": {"areas": {"#ffffff": 1.0}, "whitespace": 0.9, "blankRows": 0.5, "air": 3.0,
                                                           "sections": [], "text": {}}, "layout": {"docHeight": 1000}, "viewport": [1000, 800]}
        p2 = capture(durations={"150": 6}) | {"surfaces": {"areas": {"#0f766e": 1.0}, "whitespace": 0.5, "blankRows": 0.1, "air": 1.0,
                                                           "sections": [{"hex": "#0f766e", "y": 0, "h": 900}], "text": {}},
                                              "layout": {"docHeight": 1000}, "viewport": [1000, 800]}
        m = css_scan.merge_captures([p1, p2])
        self.assertEqual(m["values"]["durations"]["150"], 10)
        self.assertEqual(m["surfaces"]["areas"], {"#ffffff": 0.5, "#0f766e": 0.5})
        self.assertEqual(m["surfaces"]["sections"][0]["y"], 1000)
        self.assertEqual(css_scan.analyse(m)["pages"], 2)
        retro = capture(shadows={"rgba(30, 30, 30, 0.55) 3px 3px 0px 0px": 40}) | {"surfaces": {**p2["surfaces"], "areas": {"#f386a1": 0.7, "#ffffff": 0.3}}}
        quiet = capture(borders={"1px": 30}) | {"surfaces": {**p1["surfaces"], "areas": {"#f7f5f0": 1.0}}}
        self.assertEqual(css_scan.look_differences([quiet, quiet]), [])
        self.assertIn("give a different look its own Taste Index", css_scan.look_differences([quiet, retro])[0])


@unittest.skipUnless(NODE, "node not installed")
class ReadPageCollect(unittest.TestCase):
    def test_loops_links_noise_and_emphasis(self):
        base = {"w": 100, "h": 20, "own": 0, "ctx": None, "prose": False, "fontSize": 16, "fontFamily": "Inter", "fontWeight": "400",
                "lineHeight": "24px", "radius": "0px", "boxShadow": "none", "spacing": [], "color": {"hex": "#181614", "a": 1}}
        items = [{**base, "animation": ["blink", "2s", "linear", "infinite"]},
                 {**base, "transition": ["color", "0.5s", "ease-out"]},
                 {**base, "link": True, "own": 0, "color": {"hex": "#0000ee", "a": 1}},  # a wrapper link: no text of its own
                 {**base, "link": True, "own": 12, "color": {"hex": "#0000ee", "a": 1}},  # the browser's link blue
                 {**base, "own": 900, "noise": True, "fontSize": 12},  # a base-64 string used as decoration
                 {**base, "own": 30, "emphasis": True, "color": {"hex": "#0f766e", "a": 1}},
                 {**base, "own": 300, "prose": True, "fontSize": 18, "border": {"hex": "#1e1e1e", "a": 1, "w": 1, "pseudo": True}}]
        r = subprocess.run([NODE, "-e", "const a=require(process.env.RP);console.log(JSON.stringify(a.collect(" + json.dumps(items) + ",1280)))"],
                           capture_output=True, text=True, timeout=30, env={"RP": str(HERE / "read_page.js"), "PATH": ""})
        self.assertEqual(r.returncode, 0, r.stderr)
        v = json.loads(r.stdout)["values"]
        self.assertEqual(v["loops"]["count"], 1)
        self.assertEqual(v["durations"], {"500": 1})
        self.assertEqual(v["transitionKinds"], {"color": 1})
        self.assertNotIn("link", v["accentSources"])
        self.assertEqual(v["accentSources"]["emphasis"], {"#0f766e": 3})
        self.assertNotIn("12", v["textSizes"].get("body", {}))
        self.assertEqual(v["textSizes"]["noise"], {"12": 900})
        self.assertEqual(v["borders"], {"1px drawn": 1})


@unittest.skipUnless(ENGINE, "engine.py not found")
class EngineIntakeCompat(unittest.TestCase):
    """engine.py intake reads css_scan --json output unchanged (read-only use of the engine)."""

    def test_intake_reads_body_radius_accent(self):
        spec = importlib.util.spec_from_file_location("od_engine", ENGINE)
        eng = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(eng)
        a = scan(SITE_CSS)
        a["tag"] = "inspiration"
        fit = eng.fit_reference(json.loads(json.dumps(a)))
        by = {p["path"]: p for p in fit["proposals"]}
        self.assertIn("dials.roundness", by)
        self.assertIn("6", by["dials.roundness"]["basis"])
        self.assertIn("dials.density", by)
        self.assertIn("16", by["dials.density"]["basis"])
        self.assertIn("dials.colorfulness", by)
        self.assertNotIn("raw.brandColor", by)  # inspiration: the accent hue is never proposed

    def test_space_motion_and_colour_area_reach_the_dials(self):
        spec = importlib.util.spec_from_file_location("od_engine", ENGINE)
        eng = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(eng)
        dial = lambda ref, k: {p["path"]: p["value"] for p in eng.fit_reference(ref)["proposals"]}.get("dials." + k)
        airy = {"bodySize": 14, "air": 2.86, "blankRows": 0.48, "method": "computed"}
        self.assertLess(dial(airy, "density"), 34)  # small type in a lot of empty space is spacious, not compact
        self.assertGreater(dial({"bodySize": 13, "air": 0.7, "blankRows": 0.05, "method": "computed"}, "density"), 66)
        retro = {"method": "computed", "motion": {"durationMultiplier": 1.82, "median": 500, "fadesOnly": True, "fades": 7,
                                                  "loops": {"count": 10, "character": "linear"}}}
        self.assertEqual(dial(retro, "energy"), 35)  # was 100: slow colour fades plus linear loops are not energetic
        self.assertEqual(dial({"method": "computed", "depth": {"hint": "hard-offset"}}, "depth"), 5)
        col = lambda share: {"method": "computed", "color": {"accents": [{"hex": "#f386a1"}], "chromaticShare": share}}
        self.assertGreater(dial(col(0.66), "colorfulness"), 75)
        self.assertLess(dial({"method": "computed", "color": {"accents": [{"hex": "#0f766e"}], "chromaticShare": 0.004}}, "colorfulness"), 35)


def png_bytes(rows):
    """A small 8-bit RGB PNG, each row with a different filter (0 to 4), so the reader's unfiltering is exercised."""
    import struct, zlib

    def paeth(a, b, c):
        p = a + b - c
        pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        return a if pa <= pb and pa <= pc else b if pb <= pc else c
    raw, prev = b"", bytes(len(rows[0]) * 3)
    for y, row in enumerate(rows):
        line, f = bytes(v for px in row for v in px), y % 5
        out = bytearray()
        for i, v in enumerate(line):
            a, b, c = (line[i - 3] if i >= 3 else 0), prev[i], (prev[i - 3] if i >= 3 else 0)
            out.append((v - [0, a, b, (a + b) // 2, paeth(a, b, c)][f]) & 255)
        raw += bytes([f]) + bytes(out)
        prev = line
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", len(rows[0]), len(rows), 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


import taste_index  # noqa: E402


class TasteIndexTool(unittest.TestCase):
    """taste_index.py: the reel's structure from measurements, under the owner decision of 2026-10-23."""

    @staticmethod
    def retro_scan():
        win = json.dumps({"bar": "#1e1e1e", "barHeight": 20, "body": "#c4c4c4", "border": "1px #1e1e1e", "radius": 0})
        roles = {"heading": {"families": {"Die Grotesk C Medium": 260}, "weights": {"500": 260}, "sizes": {"150": 140, "64": 120}, "tracking": {},
                             "transform": {"capitalize": 260}, "lineHeight": {"0.8": 260}, "chars": 260,
                             "faces": {"Die Grotesk C Medium": {"sizes": {"150": 140, "64": 120}, "weights": {"500": 260}}}},
                 "body": {"families": {"Die Grotesk C Regular": 2100}, "weights": {"400": 2100}, "sizes": {"22": 2100}, "tracking": {},
                          "transform": {}, "lineHeight": {"1.2": 2100}, "chars": 2100, "faces": {}},
                 "noise": {"families": {"JetBrains Mono": 800}, "weights": {"300": 800}, "sizes": {"12": 800}, "tracking": {}, "transform": {},
                           "lineHeight": {}, "chars": 800, "faces": {}}}
        cap = capture(radiiByRole={"control": {"0": 6}, "container": {"0": 4}}, borders={"1px drawn": 60}, borderColors={"#1e1e1e": 60},
                      accentSources={"button": {"#f386a1": 2}}, typeRoles=roles, textSizes={"body": {"22": 2100}, "heading": {"150": 140}},
                      durations={"500": 7}, easings={"cubic-bezier(0.12, 0.23, 0.5, 1)": 7}, transitionKinds={"color": 7},
                      loops={"count": 10, "durations": {"2000": 10}, "easings": {"linear": 10}})
        cap |= {"patterns": {"windows": {win: 8}, "frames": {"3px #c4c4c4": 5}},
                "surfaces": {"pageBg": "#fefefe", "areas": {"#f386a1": 0.58, "#1e1e1e": 0.19, "#fefefe": 0.13, "#03aa5c": 0.08},
                             "text": {"#1e1e1e": 0.7, "#3d3d3d": 0.3}, "textShare": 0.05, "whitespace": 0.8, "blankRows": 0.17, "air": 0.63,
                             "sections": [{"hex": "#f386a1", "y": 2000, "h": 6000}, {"hex": "#03aa5c", "y": 8000, "h": 900},
                                          {"hex": "#1e1e1e", "y": 8900, "h": 2000}], "gradients": 0},
                "layout": {"docHeight": 11000, "maxTextWidth": 600},
                "components": {"button": {json.dumps({"bg": "#f386a1", "text": "#111111", "border": None, "radius": 0, "height": 36, "padX": 12,
                                                      "family": "Die Grotesk C Medium", "size": 16, "weight": "500", "case": None, "tracking": 0}): 2}},
                "voice": {"heading": {"n": 11, "words": 4.4, "case": {"title": 8, "sentence": 3}, "period": 2, "exclaim": 0, "question": 0,
                                      "digits": 3, "emoji": 0},
                          "button": {"n": 25, "words": 3.1, "case": {"title": 15}, "period": 0, "exclaim": 0, "question": 0, "digits": 0, "emoji": 0},
                          "prose": {"paragraphs": 14, "wordsPerSentence": 12.6, "you": 3, "contractions": 3, "exclaim": 0, "emoji": 1}}}
        return css_scan.analyse(cap)

    def test_draft_has_the_reels_structure(self):
        ix = taste_index.draft(self.retro_scan(), "retro-os")
        names = [p["name"] for p in ix["principles"] if p["keep"]]
        self.assertEqual(names[:2], ["Everything is a window", "Colour is a place"])
        self.assertIn("Square corners", names)
        self.assertIn("Something small is always running", names)
        self.assertTrue(all(p["status"] == "measured" and p["whyStatus"] == "inferred" and p["why"] for p in ix["principles"]))
        jobs = {c["hex"]: c for c in ix["colors"]}
        self.assertEqual(jobs["#fefefe"]["var"], "--ti-color-ground")
        self.assertEqual(jobs["#1e1e1e"]["var"], "--ti-color-ink")
        self.assertTrue(jobs["#f386a1"]["jobs"][0].startswith("world"))
        self.assertAlmostEqual(jobs["#f386a1"]["area"], 0.58)
        display = next(t for t in ix["type"] if t["role"] == "display")
        self.assertEqual((display["family"], display["substitute"], display["licence"]), ("Die Grotesk C", "Inter Tight", "not known"))
        mono = next(t for t in ix["type"] if t["family"] == "JetBrains Mono")
        self.assertEqual((mono["substitute"], mono["licence"]), ("JetBrains Mono", "open"))
        nevers = [n["rule"] for n in ix["never"]]
        for rule in ("Rounded corners", "Gradients", "Bounce or overshoot", "Emoji in headlines, buttons or navigation"):
            self.assertIn(rule, nevers)
        self.assertTrue(any(c["name"] == "window" for c in ix["components"]))
        self.assertIn("loop", " ".join(r["rule"] for r in ix["motion"]["rules"]))
        self.assertEqual(ix["notice"], taste_index.NOTICE)
        v = ix["variables"]
        for k in ("--ti-color-ground", "--ti-font-display", "--ti-radius-control", "--ti-duration-loop", "--ti-ease-loop", "--ti-frame-band"):
            self.assertIn(k, v)
        self.assertIn('"Die Grotesk C", "Inter Tight"', v["--ti-font-display"])
        errs, warns = taste_index.check(ix)
        self.assertEqual(errs, [])
        self.assertTrue(any("picture" in w for w in warns))

    def test_render_files_and_no_copy(self):
        ix = taste_index.draft(self.retro_scan(), "retro-os", picture="A desktop computer pinned onto pink paper")
        md, css, page = taste_index.render_md(ix), taste_index.css_for(ix), taste_index.specimen(ix)
        for part in ("## Principles", "## Colour", "## Type", "## Components", "## Motion", "## Voice", "## Never", "## Variables",
                     "*(measured)*", "*(inferred)*", taste_index.NOTICE):
            self.assertIn(part, md)
        self.assertIn(":root {", css)
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn('href="taste.css"', page)
        self.assertNotIn("fonts.googleapis", page + css)  # fonts are named, never fetched
        self.assertNotIn("@font-face", css)

    def test_check_catches_gaps(self):
        ix = taste_index.draft(self.retro_scan(), "retro-os")
        ix["notice"] = "edited"
        ix["never"] = []
        for p in ix["principles"]:
            p["keep"] = False
        errs, _ = taste_index.check(ix)
        self.assertTrue(any("notice" in e for e in errs))
        self.assertTrue(any("Never" in e for e in errs))
        self.assertTrue(any("principle" in e for e in errs))

    def test_free_substitutes(self):
        sub = taste_index.substitute
        self.assertEqual(sub("Die Grotesk C", "heading"), "Inter Tight")
        self.assertEqual(sub("Die Grotesk C", "body"), "Inter")
        self.assertEqual(sub("LisaTerminal Paper 2X3Y"), "VT323")
        self.assertEqual(sub("Tiempos Headline", "heading"), "Newsreader")
        self.assertEqual(sub("Fraunces"), "Fraunces")
        self.assertEqual(taste_index.licence("Fraunces"), "open")
        self.assertEqual(taste_index.licence("Söhne"), "not known")

    def test_screenshot_reference_for_intake(self):
        pink, paper = (243, 134, 161), (254, 254, 254)
        rows = [[pink] * 64 for _ in range(200)] + [[paper] * 64 for _ in range(240)]
        rows[220][10:20] = [(30, 30, 30)] * 10  # a line of "text" in the paper band
        d = Path(tempfile.mkdtemp())
        try:
            (d / "shot.png").write_bytes(png_bytes(rows))
            w, h, px = taste_index.read_png(d / "shot.png")
            self.assertEqual((w, h, px[0][0], px[439][63], px[220][15]), (64, 440, pink, paper, (30, 30, 30)))
            with contextlib.redirect_stdout(io.StringIO()):
                out = taste_index.cmd_screenshot(str(d / "shot.png"), "pink-paper", ["radius=0", "body=16"], str(d), "inspiration")
            ref = json.loads(out.read_text())
            self.assertEqual((ref["kind"], ref["method"], ref["estimated"]), ("screenshot", "estimated", {"radius": "0", "body": "16"}))
            self.assertEqual(ref["surfaces"]["pageBg"], "#fefefe")
            self.assertEqual(ref["surfaces"]["order"], ["#f386a1"])
            self.assertAlmostEqual(ref["surfaces"]["worlds"][0]["share"], 0.44, places=1)
            if ENGINE:
                spec = importlib.util.spec_from_file_location("od_engine", ENGINE)
                eng = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(eng)
                fit = eng.fit_reference(ref)
                paths = {p["path"] for p in fit["proposals"]}
                self.assertEqual(fit["kind"], "screenshot")
                self.assertIn("dials.roundness", paths)
                self.assertNotIn("dials.energy", paths)  # a still image has no motion
        finally:
            shutil.rmtree(d)

    @unittest.skipUnless(ENGINE, "engine.py not found")
    def test_use_needs_the_persons_font_choice_then_follows(self):
        d = Path(tempfile.mkdtemp())
        try:
            eng = taste_index.engine()
            with contextlib.redirect_stdout(io.StringIO()):
                eng.cmd_sketch(str(d / "opendesigner"), name="Trial", audience="regular", platforms="web", feel="friendly,minimal", quiet=True)
            scan = d / "scan.json"
            scan.write_text(json.dumps(self.retro_scan()))
            with contextlib.redirect_stdout(io.StringIO()):
                taste_index.cmd_draft(str(scan), "retro-os", "inspiration", None, str(d))
            state = json.loads((d / "opendesigner" / "state.json").read_text())
            self.assertTrue(state["references"]["retro-os"]["index"])  # taste.py reads its dials as inspiration evidence
            self.assertNotIn("tasteIndex", state)  # drafting never decides which index the system follows
            with self.assertRaises(SystemExit), contextlib.redirect_stdout(io.StringIO()):
                taste_index.cmd_use("retro-os", None, str(d))
            with contextlib.redirect_stdout(io.StringIO()):
                taste_index.cmd_use("retro-os", "free", str(d))
            state = json.loads((d / "opendesigner" / "state.json").read_text())
            self.assertEqual(state["tasteIndex"]["follows"], "retro-os")
            self.assertEqual(state["raw"]["brandColor"], "#f386a1")
            self.assertEqual(state["raw"]["displayFace"], "Inter Tight")  # free substitute, as chosen
            for f in ("index.json", "TASTE-INDEX.md", "taste.css", "specimen.html", "measured.json"):
                self.assertTrue((d / "opendesigner" / "taste-indexes" / "retro-os" / f).exists(), f)
        finally:
            shutil.rmtree(d)


class ReviewFixes(unittest.TestCase):
    """Bugs a fresh-eyes review found on 2026-10-23, each reproduced before the fix."""

    @unittest.skipUnless(NODE, "node not installed")
    def test_noise_is_base64_not_cjk(self):
        r = subprocess.run([NODE, "-e", "const a=require(process.env.RP);console.log(JSON.stringify(["
                            "a.noiseText('ZmxvYXRpbmcgcG9pbnQgbnVtYmVycyBhcmUgYXBwcm94aW1hdGlvbnM='),"
                            "a.noiseText('\u8fd9\u662f\u4e00\u4e2a\u5f88\u957f\u7684\u4e2d\u6587\u6bb5\u843d\u6ca1\u6709\u7a7a\u683c\u4f46\u662f\u5b83\u662f\u6b63\u5e38\u7684\u6587\u5b57\u5185\u5bb9\u800c\u4e0d\u662f\u88c5\u9970'),"
                            "a.noiseText('A short line of ordinary words.')]))"],
                           capture_output=True, text=True, timeout=30, env={"RP": str(HERE / "read_page.js"), "PATH": ""})
        self.assertEqual(json.loads(r.stdout), [True, False, False])

    def test_merge_skips_missing_numbers_and_averages_sentences(self):
        a = capture() | {"voice": {"prose": {"paragraphs": 0, "wordsPerSentence": None}}}
        b = capture() | {"voice": {"prose": {"paragraphs": 4, "wordsPerSentence": 12.6}}}
        c = capture() | {"voice": {"prose": {"paragraphs": 4, "wordsPerSentence": 12.6}}}
        self.assertEqual(css_scan.merge_captures([a, b])["voice"]["prose"]["wordsPerSentence"], 12.6)
        self.assertEqual(css_scan.merge_captures([b, c])["voice"]["prose"]["wordsPerSentence"], 12.6)

    def test_page_colour_is_not_the_accent_without_a_coloured_control(self):
        cap = capture(accentSources={"button": {"#111111": 6}}) | {"surfaces": {"areas": {"#f386a1": 0.25, "#ffffff": 0.75}, "sections": [], "text": {}}}
        self.assertNotIn("area", json.dumps(css_scan.analyse(cap)["color"]["accents"]))  # black buttons: no accent from the page's pink
        cap["values"]["accentSources"]["button"]["#f386a1"] = 1
        self.assertIn("area", css_scan.analyse(cap)["color"]["accents"][0]["sources"])  # a pink button: the pink area backs it

    def test_set_numbering_and_validation(self):
        d = Path(tempfile.mkdtemp())
        try:
            ix = taste_index.draft(TasteIndexTool.retro_scan(), "retro-os")
            taste_index.save_index(str(d), ix)
            quiet = contextlib.redirect_stdout(io.StringIO())
            with quiet:
                taste_index.cmd_set("retro-os", "principle", ["2"], str(d), drop=True)
                taste_index.cmd_set("retro-os", "why", ["2", "A new reason"], str(d))
            ps = taste_index.load_index(str(d), "retro-os")["principles"]
            self.assertFalse(ps[1]["keep"])
            self.assertEqual(ps[1]["why"], "A new reason")  # the same principle 2, kept or not
            for args in (("why", ["99", "x"], None), ("never", [], None), ("picture", [], None), ("principle", ["0"], True)):
                with self.assertRaises(SystemExit), contextlib.redirect_stdout(io.StringIO()):
                    taste_index.cmd_set("retro-os", args[0], args[1], str(d), drop=args[2])
            with contextlib.redirect_stdout(io.StringIO()):
                taste_index.cmd_set("retro-os", "never", ["Paragraphs in pixel type"], str(d))
            self.assertEqual(taste_index.load_index(str(d), "retro-os")["never"][-1]["status"], "inferred")
        finally:
            shutil.rmtree(d)

    def test_screenshot_index_marks_estimates(self):
        scan = css_scan.analyse({"method": "estimated", "values": {"colors": {"#f7f5f0": 900}},
                                 "surfaces": {"pageBg": "#f7f5f0", "areas": {"#f7f5f0": 1.0}, "sections": [], "text": {}, "gradients": 0,
                                              "whitespace": 0.9, "blankRows": 0.5}})
        scan["radius"] = {"mostCommon": 0, "control": {"px": 0, "confidence": "low"}}
        ix = taste_index.draft(scan, "shot")
        rules = {n["rule"]: n["status"] for n in ix["never"]}
        self.assertNotIn("Gradients", rules)  # a screenshot cannot show there are none
        self.assertNotIn("Soft drop shadows", rules)
        self.assertEqual(rules.get("Rounded corners"), "estimated")

    def test_card_wears_what_the_depth_model_says(self):
        flat = taste_index.draft(TasteIndexTool.retro_scan(), "retro-os")
        self.assertEqual(flat["variables"]["--ti-shadow-card"], "none")
        self.assertIn("var(--ti-shadow-card, none)", taste_index.css_for(flat))
        hard = css_scan.analyse(capture(shadows={"rgb(30, 30, 30) 3px 3px 0px 0px": 6}))
        self.assertEqual(taste_index.draft(hard, "hard")["variables"]["--ti-shadow-card"], "var(--ti-shadow-hard)")

    def test_redraft_keeps_hand_written_parts(self):
        d = Path(tempfile.mkdtemp())
        try:
            scan = d / "scan.json"
            scan.write_text(json.dumps(TasteIndexTool.retro_scan()))
            with contextlib.redirect_stdout(io.StringIO()):
                taste_index.cmd_draft(str(scan), "retro-os", "inspiration", "A desktop on pink paper", str(d))
                taste_index.cmd_set("retro-os", "never", ["Paragraphs in pixel type"], str(d))
                taste_index.cmd_draft(str(scan), "retro-os", "inspiration", None, str(d))
            ix = taste_index.load_index(str(d), "retro-os")
            self.assertEqual(ix["picture"]["text"], "A desktop on pink paper")
            self.assertIn("Paragraphs in pixel type", [n["rule"] for n in ix["never"]])
            self.assertEqual(ix["source"], None if not ix["source"] else ix["source"].split("/")[0])  # host only, never a path
        finally:
            shutil.rmtree(d)

    @unittest.skipUnless(ENGINE, "engine.py not found")
    def test_exact_fonts_keep_their_free_substitute(self):
        eng = taste_index.engine()
        faces = eng.font_faces({"textFace": ["Die Grotesk C", "Inter"], "displayFace": ["Die Grotesk C", "Inter Tight"]})
        self.assertEqual(faces["text"]["stack"], ["Die Grotesk C", "Inter"])
        self.assertEqual(eng.font_faces({"textFace": "Inter"})["text"].get("stack"), None)


if __name__ == "__main__":
    unittest.main(verbosity=1)
