#!/usr/bin/env python3
"""Tests for preflight.py (standard library only; the video tests need ffmpeg and skip without it)."""
import shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("preflight.py")
sys.path.insert(0, str(SCRIPT.parent))
import preflight  # noqa: E402

BAD = """<!doctype html><html><head><style>
:root { --t-big: 150px; --track: -0.06em; }
h1 { font: 800 var(--t-big)/1 "Missing Display", sans-serif; letter-spacing: var(--track); }
p { font-family: "Inter Tight", sans-serif; font-size: 18px; }
</style></head><body><h1>Hello<br>world</h1><p>x</p>
<script>tl.to("#a", { left: 10 });</script></body></html>"""

GOOD = """<!doctype html><html><head><style>
@font-face { font-family: "Inter Tight"; src: url("a.woff2"); }
h1 { font: 650 122px/1.1 "Inter Tight", sans-serif; letter-spacing: -0.02em; }
p { font: 400 56px/1.4 "Inter Tight", sans-serif; }
</style></head><body><h1>Hello world</h1><p>x</p></body></html>"""

# A page built the way the engine builds one: rem tokens in tokens.css, a composite `font` token with a calc()
# line height, families through var(), a Google Fonts <link> with href before rel, and utility classes it never uses.
TOKENS = """:root {
  --ds-font-size-11: 0.6875rem; --ds-font-size-14: 0.875rem; --ds-font-size-18: 1.125rem; --ds-font-size-9: 0.5625rem;
  --ds-font-family-text: Manrope, system-ui, sans-serif;
  --ds-font-family-mono: "Geist Mono", ui-monospace, monospace;
  --ds-text-body-sm: 400 var(--ds-font-size-11)/calc(1.4545 * var(--ds-script-line-height-scale, 1)) var(--ds-font-family-text);
  --ds-text-tiny: 400 var(--ds-font-size-9)/1 var(--ds-font-family-text);
}
.ds-text-body-sm { font: var(--ds-text-body-sm); }
.ds-text-tiny { font: var(--ds-text-tiny); }
"""
TOKEN_PAGE = """<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600&amp;family=Geist+Mono&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="tokens.css">
<style>
body { font-family: var(--ds-font-family-text); font-size: var(--ds-font-size-14); }
.meta { font: var(--ds-text-body-sm); }
code { font: 400 var(--ds-font-size-14)/22px var(--ds-font-family-mono); }
</style></head><body><p>x <span class="meta">y</span> <code>z</code></p></body></html>"""


def run(html, *args, files=None, name="i.html"):
    with tempfile.TemporaryDirectory() as d:
        for rel, text in (files or {}).items():
            (Path(d) / rel).parent.mkdir(parents=True, exist_ok=True)
            (Path(d) / rel).write_text(text)
        f = Path(d) / name
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(html)
        return subprocess.run([sys.executable, str(SCRIPT), "html", str(f), *args], capture_output=True, text=True)


class TestHtml(unittest.TestCase):
    def test_bad_page_is_caught(self):
        r = run(BAD, "--medium", "video")
        self.assertEqual(r.returncode, 1, r.stdout)
        for needle in ('"Missing Display"', '"Inter Tight"', "under 40px", "-0.06", "<br>", "animates left"):
            self.assertIn(needle, r.stdout)

    def test_good_page_passes(self):
        r = run(GOOD, "--medium", "video")
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertNotIn("WARN", r.stdout)

    def test_token_page_is_read(self):
        r = run(TOKEN_PAGE, files={"tokens.css": TOKENS})
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertNotIn("ERROR", r.stdout)                            # Google Fonts faces count as loaded
        self.assertIn("loaded from Google Fonts: Geist Mono, Manrope", r.stdout)
        self.assertIn("font sizes in px: [11, 14]", r.stdout)          # rem read; 22px line height and unused 9px class not
        self.assertIn("text under 12px for web: [11]", r.stdout)       # web: 11 px warns, it does not fail

    def test_tracking_capitals_and_size(self):                       # M51: owner review of a private B2B landing page, 2026-11-05
        page = """<!doctype html><html><head><style>
        .eyebrow { text-transform: uppercase; letter-spacing: -0.03em; font-size: 12px; }
        .lede { font-size: 14px; letter-spacing: -0.01em; }
        h1 { font-size: 40px; letter-spacing: 0.8px; }
        </style></head><body><p class="eyebrow">x</p><p class="lede">y</p><h1>z</h1></body></html>"""
        r = run(page)
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("capitals tracked tight: .eyebrow at -0.03em", r.stdout)
        self.assertIn("tracking gets looser as type gets bigger: h1 is 40px at 0.02em", r.stdout)   # 0.8 px / 40 px
        ok = page.replace("-0.03em", "0.06em").replace("0.8px", "-0.8px")
        self.assertEqual(run(ok).returncode, 0, run(ok).stdout)

    def test_fluid_sizes_are_measured_at_each_width(self):
        page = """<!doctype html><html><head><style>h1 { font-size: calc(1.5rem + 2.4vw); } h2 { font-size: 2.2vw; } p { font-size: 16px; }</style></head>
        <body><h1>a</h1><h2>b</h2><p>c</p></body></html>"""
        r = run(page)
        self.assertIn("2 fluid font size(s)", r.stdout)
        self.assertIn("390 px: [33.4, 8.6]", r.stdout)
        self.assertIn("fluid text under 11px at 320 px wide: [7]", r.stdout)     # 2.2vw at 320 px
        self.assertNotIn("depend on the parent or the window", r.stdout)

    def test_css_px_evaluates_like_a_browser(self):
        px = lambda v, w=390: preflight.css_px(v, 16, w)
        self.assertEqual(px("clamp(2rem, 1.5rem + 2vw, 4rem)", 1440), 52.8)
        self.assertEqual(px("min(5vw, 48px)", 1920), 48)
        self.assertEqual(px("calc(100vw / 20)", 320), 16)
        self.assertEqual(px("calc(1rem -0.5vw)", 400), 14)
        self.assertIsNone(px("1.2em"))
        self.assertIsNone(px("calc(50% + 1rem)"))

    def test_media_floors(self):
        self.assertNotIn("under", run(TOKEN_PAGE, "--medium", "app", files={"tokens.css": TOKENS}).stdout)
        r = run(TOKEN_PAGE, "--medium", "watch", files={"tokens.css": TOKENS})
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("text under 12px for watch: [11]", r.stdout)
        r = run(TOKEN_PAGE, "--medium", "video", files={"tokens.css": TOKENS})
        self.assertIn("WARN   loaded from Google Fonts", r.stdout)       # a renderer may not wait for web fonts

    def test_web_error_below_11(self):
        r = run('<html><head><style>p{font-size:10px}</style></head><body><p>x</p></body></html>')
        self.assertEqual(r.returncode, 1, r.stdout)
        self.assertIn("text under 11px for web: [10]", r.stdout)

    def test_root_relative_sheet_inline_style_and_scale(self):
        css = ("@font-face{font-family:'Hanken Grotesk';src:url(/f.woff2)}"
               ":root{--font-size-sm:12px;--font-size-md:16px;--font-size-lg:24px}body{font:400 16px/1.5 'Hanken Grotesk',sans-serif}")
        page = '<html><head><link rel="stylesheet" href="/site.css?v=2"></head><body><p style="font-size:13px">x</p></body></html>'
        r = run(page, files={"site.css": css}, name="docs/a/index.html")
        self.assertNotIn("ERROR", r.stdout)
        self.assertIn("font sizes in px: [13, 16]", r.stdout)
        self.assertIn("sizes outside the token scale [12, 16, 24]: [13]", r.stdout)

    def test_scale_named_the_ways_people_name_one(self):              # checker evals P-off-scale-fs, 2026-11-05
        for props in ("--fs-sm:14px;--fs-md:16px;--fs-lg:20px",                                              # hand-made
                      "--text-sm:0.875rem;--text-sm--line-height:1.5rem;--text-base:1rem;--text-xl:1.25rem;--text-muted:#666",  # Tailwind v4
                      "--md-sys-typescale-body-small-size:14px;--md-sys-typescale-body-small-line-height:22px;"
                      "--md-sys-typescale-body-large-size:16px;--md-sys-typescale-title-large-size:20px",    # Material 3
                      "--step-0:14px;--step-1:16px;--step-2:20px;--space-s:18px"):                            # Utopia
            r = run(f"<html><head><style>:root{{{props}}}body{{font-size:16px}}.x{{font-size:18px}}</style></head>"
                    "<body><p class=x>x</p></body></html>")
            self.assertIn("sizes outside the token scale [14, 16, 20]: [18]", r.stdout, props)
        self.assertTrue(preflight.size_token("--ds-font-size-14"))
        for name in ("--text-sm--line-height", "--font-weight-bold", "--text-color", "--font-family-sans", "--fs-tracking", "--step"):
            self.assertFalse(preflight.size_token(name), name)

    def test_unread_remote_sheet_warns_instead_of_failing(self):
        page = ('<html><head><link rel="stylesheet" href="https://use.typekit.net/abc.css">'
                '<style>body{font:400 16px/1.5 "Proxima Nova",sans-serif}</style></head><body>x</body></html>')
        r = run(page)
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn('WARN   font "Proxima Nova"', r.stdout)


def square_video(d, side, every, name="v.mkv"):
    """2 s at 30 fps, 270 x 480, mid grey, with a centred square that swaps black and white every `every` frames.
    Lossless RGB, so edges stay sharp and the flashing area is exactly side x side px."""
    x, y, out = (270 - side) // 2, (480 - side) // 2, Path(d) / name
    vf = (f"drawbox=x={x}:y={y}:w={side}:h={side}:color=black:t=fill,"
          f"drawbox=x={x}:y={y}:w={side}:h={side}:color=white:t=fill:enable='mod(floor(n/{every}),2)'")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "color=c=0x808080:s=270x480:r=30:d=2",
                    "-vf", vf, "-c:v", "ffv1", "-pix_fmt", "bgr0", str(out)], check=True)
    return out


def video(path, *args):
    return subprocess.run([sys.executable, str(SCRIPT), "video", str(path), *args], capture_output=True, text=True)


class TestFlash(unittest.TestCase):
    def test_field_sizes(self):  # the two viewing cases measured for the reels (1080 x 1920)
        self.assertEqual(round(preflight.flash_field(1080, 1920, "tablet")), 317)
        self.assertEqual(round(preflight.flash_field(1080, 1920, "phone")), 435)
        self.assertEqual(round(preflight.flash_field(1920, 1080, "tablet")), 317)  # turned to landscape

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "needs ffmpeg")
    def test_flashing_square(self):
        # field 79 px, limit 1,235 px²: a 40 px square swapping every frame flashes 1,600 px², 130% of the limit
        with tempfile.TemporaryDirectory() as d:
            r = video(square_video(d, 40, 1), "--flash-where", str(Path(d) / "worst.png"))
            self.assertEqual(r.returncode, 1, r.stdout)
            self.assertIn("worst flashing area 1,600 px²", r.stdout)
            self.assertIn("ERROR  flashing over the general flash threshold", r.stdout)
            self.assertTrue((Path(d) / "worst.png").stat().st_size > 0)

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "needs ffmpeg")
    def test_flash_rate_and_size(self):
        with tempfile.TemporaryDirectory() as d:
            r = video(square_video(d, 40, 4))  # 7 or 8 swaps a second: more than three flashes
            self.assertEqual(r.returncode, 1, r.stdout)
            r = video(square_video(d, 40, 5, "slow.mkv"))  # 6 swaps a second: three flashes, allowed at any size
            self.assertNotIn("ERROR", r.stdout)
            self.assertIn("nothing flashes more than 3 times a second", r.stdout)
            r = video(square_video(d, 20, 1, "small.mkv"))  # 400 px²: 32% of the limit
            self.assertNotIn("ERROR", r.stdout)
            self.assertIn("worst flashing area 400 px²", r.stdout)


if __name__ == "__main__":
    unittest.main()
