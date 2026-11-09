#!/usr/bin/env python3
"""Tests for paint.py and the vendored painting engine. Standard library only, no network, and no npm install: a
film's export is simulated with the files the engine writes (manifest.json, checks.json, plates). Node, when present,
syntax-checks the engine's JavaScript.

    python3 skills/opendesigner-paint/scripts/test_paint.py
"""
import contextlib, io, json, re, shutil, subprocess, sys, tempfile, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import paint  # noqa: E402

REPO = HERE.parents[2]
EXAMPLE = REPO / "examples" / "consumer-playful"
PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000"
                    "1f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082")


def run(argv):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        paint.main(argv)
    return buf.getvalue()


def project(tmp):
    """A person's project holding the playful example system under opendesigner/."""
    p = Path(tmp) / "app"
    (p / "opendesigner").mkdir(parents=True)
    for name in ("state.json", "build", "tokens"):
        src = EXAMPLE / name
        (shutil.copytree if src.is_dir() else shutil.copyfile)(src, p / "opendesigner" / name)
    return p


def fake_film(root, seconds=8.0, failed=(), plates=("opener", "monument"), scene=None, motion=None, particles=None, plate_pngs=True):
    """The files `npm run export` writes (manifest.json's plates is a list, as the engine's renderer returns it)."""
    film = Path(root) / "film"
    (film / "src" / "scenes").mkdir(parents=True)
    extra = f", {{ motion: '{motion}' }}" if motion else ""
    rows = ",\n".join(f"  ['0{i + 1}', {i * 24}, {(i + 1) * 24}, '{p}', 'shot', 'soft'{extra if i == 0 else ''}]" for i, p in enumerate(plates))
    (film / "src" / "film.js").write_text(f"export const STYLE = 'cel';\nexport const FPS = 24;\nconst rows = [\n{rows},\n];\n")
    (film / "src" / "scenes" / "01-opener.js").write_text(scene or "import { family } from '../brand.js';\nconst F = family('brand-night');\n")
    if particles is not None:
        (film / "src" / "particles.js").write_text(particles)
    out = film / "out" / "streak"
    (out / "plates").mkdir(parents=True)
    (out / "anchors").mkdir()
    for i, p in enumerate(plates):
        if plate_pngs:
            (out / "plates" / f"{p}.png").write_bytes(PNG)
        (out / "anchors" / f"0{i + 1}-{p}-f{i * 24 + 12:04d}.png").write_bytes(PNG)
    (out / "streak.mp4").write_bytes(b"\x00\x00\x00\x18ftypisom")
    (out / "manifest.json").write_text(json.dumps({"id": "streak", "seconds": seconds,
                                                   "plates": [{"plate": p, "seed": 1, "hash": f"h-{p}"} for p in plates],
                                                   "shots": [{"shot": f"0{i + 1}", "plate": p} for i, p in enumerate(plates)]}))
    (out / "checks.json").write_text(json.dumps({"failed": list(failed)}))
    return film


class Decisions(unittest.TestCase):
    def test_style_follows_the_dials(self):
        playful = {"energy": 80, "colorfulness": 85, "warmth": 78, "expression": 82, "roundness": 97}
        self.assertEqual(paint.recommend_style(playful)[0][0], "cel")
        calm_tool = {"energy": 20, "colorfulness": 15, "warmth": 50, "expression": 25}
        self.assertEqual(paint.recommend_style(calm_tool)[0][0], "sketch")
        archival = {"energy": 35, "colorfulness": 55, "warmth": 62, "expression": 48}
        self.assertEqual(paint.recommend_style(archival)[0][0], "watercolour")
        self.assertIn("close on", paint.recommend_style(playful)[0][1])

    def test_a_confirmed_drawing_style_wins(self):
        dials = {"energy": 80, "colorfulness": 85}
        self.assertEqual(paint.recommend_style(dials, "hand-drawn")[0][0], "sketch")
        self.assertEqual(paint.recommend_style(dials, "flat")[0][0], "cel")
        self.assertEqual(paint.recommend_style(dials, "none")[0][0], "none")

    def test_families_come_only_from_the_ramps_and_mark_legible_text(self):
        ramps = paint.load_ramps(EXAMPLE, tokens=EXAMPLE / "build" / "css" / "tokens.css")
        allowed = {hx for mode in ("light", "dark") for steps in ramps[mode].values() for hx in steps.values()}
        fams = paint.palette_families(ramps)
        self.assertGreaterEqual(len(fams), 8)
        for name, f in fams.items():
            with self.subTest(name):
                self.assertTrue({f["ground"], f["ink"], *f["keys"]} <= allowed)
                if f["text"] != "none":
                    self.assertGreaterEqual(f["text_contrast"], 4.5)
        self.assertLess(paint.oklch(fams["monument"]["ground"])[0], 0.25)       # a near-black monument
        self.assertGreater(paint.oklch(fams["almost-nothing"]["ground"])[0], 0.95)  # a near-white breath

    def test_mid_value_grounds_carry_no_text(self):
        ramps = paint.load_ramps(EXAMPLE, accent="#7a7a7a")
        ramps["light"]["accent"][9] = "#808080"  # a mid grey fails with both ivory and charcoal
        self.assertEqual(paint.palette_families(ramps)["saturated-field"]["text"], "none")

    def test_font_licence_is_never_guessed(self):
        self.assertEqual(paint.font_decision({"raw": {"textFace": "Nunito"}})["status"], "check-source")
        self.assertEqual(paint.font_decision({"raw": {"textFace": "Acme Sans", "brandFace": "Acme Sans", "fontLicence": {}}})["status"], "ask")
        self.assertEqual(paint.font_decision({"raw": {"textFace": "Acme Sans", "brandFace": "Acme Sans",
                                                      "fontLicence": {"selfHost": True}}})["status"], "licensed")


class Workflow(unittest.TestCase):
    def test_brief_palette_lint_ingest(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = project(tmp)
            out = run(["--project", str(app), "brief", "--slot", "onboarding", "--message", "Your streak keeps going"])
            self.assertIn("style cel", out)
            brief = json.loads((app / "opendesigner" / "paintings" / "onboarding" / "brief.json").read_text())
            md = (app / "opendesigner" / "paintings" / "onboarding" / "brief.md").read_text()
            for must in ("Your streak keeps going", "brand-night", "4.5:1", "prefers-reduced-motion", "structure only", "Nunito"):
                self.assertIn(must, md)
            self.assertEqual(brief["upstream"]["commit"], paint.VENDORED["commit"])

            film = fake_film(tmp)
            run(["--project", str(app), "palette", str(film)])
            js = (film / "src" / "brand.js").read_text()
            self.assertIn("export const BRAND", js)
            self.assertIn(brief["families"]["brand-night"]["ground"], js)

            self.assertIn("ok:", run(["--project", str(app), "lint", str(film)]))
            out = run(["--project", str(app), "ingest", str(film), "--to", str(app / "src" / "brand"), "--poster", "monument"])
            comp = (app / "src" / "brand" / "StreakFilm.tsx").read_text()
            self.assertIn("prefers-reduced-motion: reduce", comp)
            self.assertIn("muted", comp)
            self.assertIn("Pause animation", comp)           # 8 s is over 5 s: WCAG 2.2.2
            self.assertIn('aria-hidden="true"', comp)          # decorative by default
            self.assertTrue((app / "src" / "brand" / "streak.mp4").exists())
            self.assertTrue((app / "src" / "brand" / "streak-poster.png").exists())
            led = json.loads((app / "opendesigner" / "paintings" / "ledger.json").read_text())
            self.assertEqual(led["items"][0]["kind"], "film")
            self.assertEqual(led["items"][0]["plate_hashes"], {"opener": "h-opener", "monument": "h-monument"})
            self.assertIn("project owns the output", (app / "opendesigner" / "paintings" / "CREDITS.md").read_text())
            self.assertIn("H-motion", out)

    def test_short_loop_has_no_pause_and_a_label_when_meaningful(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = project(tmp)
            run(["--project", str(app), "brief", "--slot", "celebration"])
            film = fake_film(tmp, seconds=3)
            run(["--project", str(app), "ingest", str(film), "--to", str(app / "web"), "--as", "html", "--label", "Confetti for your streak"])
            page = (app / "web" / "streak.html").read_text()
            self.assertIn('aria-label="Confetti for your streak"', page)
            self.assertNotIn("od-film-toggle\"", page.split("<style>")[0])
            self.assertIn("prefers-reduced-motion: reduce", page)
            self.assertIn('<img class="od-film-still" src="streak-poster.png" alt="Confetti for your streak">', page)  # the label survives

    def test_long_html_film_has_a_pause_control_and_a_real_still(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = project(tmp)
            run(["--project", str(app), "brief", "--slot", "hero"])
            film = fake_film(tmp, seconds=8)
            run(["--project", str(app), "ingest", str(film), "--to", str(app / "web"), "--as", "html"])
            page = (app / "web" / "streak.html").read_text()
            self.assertNotIn("<picture", page)                                   # <video> is not valid inside <picture>
            self.assertIn('class="od-film-toggle"', page)
            self.assertIn("min-height: 24px", page)                              # 24 px target floor
            self.assertIn('alt="" aria-hidden="true"', page)                     # decorative by default

    def test_film_export_without_plates_uses_its_anchor_frame(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = project(tmp)
            run(["--project", str(app), "brief", "--slot", "hero"])
            film = fake_film(tmp, plate_pngs=False)                              # `npm run export` only, no `npm run plates`
            run(["--project", str(app), "ingest", str(film), "--to", str(app / "web")])
            self.assertTrue((app / "web" / "streak-poster.png").exists())
            run(["--project", str(app), "ingest", str(film), "--to", str(app / "web2"), "--poster", "monument"])
            self.assertTrue((app / "web2" / "streak-poster.png").exists())
            with self.assertRaises(SystemExit):
                run(["--project", str(app), "ingest", str(film), "--to", str(app / "web3"), "--poster", "nope"])

    def test_failed_checks_are_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = project(tmp)
            run(["--project", str(app), "brief", "--slot", "hero"])
            film = fake_film(tmp, failed=["compression: frame 12"])
            with self.assertRaises(SystemExit) as e:
                run(["--project", str(app), "ingest", str(film), "--to", str(app / "x")])
            self.assertIn("checks failed", str(e.exception))

    def test_still_painting(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = project(tmp)
            run(["--project", str(app), "brief", "--slot", "og-image"])
            film = fake_film(tmp)
            run(["--project", str(app), "ingest", str(film), "--to", str(app / "public"), "--as", "img", "--poster", "opener"])
            self.assertTrue((app / "public" / "streak-poster.png").exists())
            self.assertFalse((app / "public" / "streak.mp4").exists())


class Lint(unittest.TestCase):
    def lint(self, scene, seconds_rows=None):
        with tempfile.TemporaryDirectory() as tmp:
            app = project(tmp)
            run(["--project", str(app), "brief", "--slot", "celebration"])
            film = fake_film(tmp, scene=scene, plates=seconds_rows or ("opener",))
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), self.assertRaises(SystemExit) as e:
                paint.main(["--project", str(app), "lint", str(film)])
            return e.exception.code, buf.getvalue()

    def test_catches_what_breaks_the_brand(self):
        code, out = self.lint("export const s = { kind: 'reconstructed' };\nconst x = Math.random();\np.text('Hi', 1, 2);\nk.glaze(pts, '#1330b8', 140);\n")
        self.assertEqual(code, 1)
        self.assertIn("Math.random", out)
        self.assertIn("text drawn into a plate", out)
        self.assertIn("original colours", out)

    def lint_motion(self, particles):
        with tempfile.TemporaryDirectory() as tmp:
            app = project(tmp)
            run(["--project", str(app), "brief", "--slot", "hero"])
            film = fake_film(tmp, motion="dust", particles=particles)
            buf = io.StringIO()
            code = 0
            with contextlib.redirect_stdout(buf):
                try:
                    paint.main(["--project", str(app), "lint", str(film)])
                except SystemExit as e:
                    code = e.code
            return code, buf.getvalue()

    def test_particles_must_be_brand_coloured(self):
        engine = (paint.ENGINE / "src" / "particles.js").read_text()
        code, out = self.lint_motion(engine)                                     # the engine's own red and gold dust
        self.assertEqual(code, 1)
        self.assertIn("particles.js: the dust motion", out)
        code, out = self.lint_motion("function buildWatercolourParticles(kind, seed) {\n  const c = F.keys[0];\n}\n"
                                     "function buildOceanParticles(kind, seed) {\n  return '#123456';\n}\n")
        self.assertEqual(code, 0, out)                                           # dust recoloured; unused ocean colours ignored

    def test_too_long_for_the_slot(self):
        code, out = self.lint(None, seconds_rows=("a", "b", "c", "d", "e"))   # 5 x 24 frames = 5 s > 4 s celebration
        self.assertEqual(code, 1)
        self.assertIn("the celebration slot allows 4 s", out)


class Doctor(unittest.TestCase):
    def test_doctor_finds_the_vendored_engine(self):
        out = run(["doctor"])
        self.assertIn(str(paint.ENGINE), out)
        for style in paint.STYLES:
            self.assertIn(style, out)
        self.assertIn(paint.VENDORED["commit"][:12], out)
        self.assertIn("Ask the person", out)

    def test_bridge_stays_offline(self):
        src = (HERE / "paint.py").read_text()
        for bad in ("urllib", "urlopen", "socket", "subprocess", "os.system", "http.client"):
            self.assertNotIn(bad, src)


class Scaffold(unittest.TestCase):
    def test_scaffold_copies_engine_brands_it_and_installs_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            app = project(tmp)
            run(["--project", str(app), "brief", "--slot", "celebration"])
            film = Path(tmp) / "films" / "streak"
            out = run(["--project", str(app), "scaffold", str(film), "--style", "cel"])
            self.assertIn("With the person's OK", out)
            self.assertIn("npm ci", out)
            self.assertTrue((film / "package-lock.json").exists())     # npm ci needs the lockfile
            self.assertFalse((film / "node_modules").exists())          # nothing installed
            t = (film / "src" / "film.js").read_text()
            self.assertIn("export const ID = 'streak';", t)
            self.assertIn("export const STYLE = 'cel';", t)
            seed = re.search(r"AUDIO_SEED = '([a-z0-9]{20})'", t)
            self.assertTrue(seed)
            self.assertTrue((film / "src" / "brand.js").exists())
            self.assertTrue((film / "BRIEF.md").exists())
            self.assertTrue((film / "scripts" / "export.mjs").exists())
            self.assertTrue(any((film / "src" / "scenes").glob("*.js")))
            with self.assertRaises(SystemExit):                          # never into a non-empty folder
                run(["--project", str(app), "scaffold", str(film), "--style", "cel"])
            other = run(["--project", str(app), "scaffold", str(Path(tmp) / "films" / "two"), "--style", "woodcut"])
            self.assertIn("the brief recommends cel", other)

    def test_scaffold_refuses_unsafe_ids_and_unknown_styles(self):
        with tempfile.TemporaryDirectory() as tmp:
            for bad in ("it's", "a/b", "Caps", "x" * 80):
                with self.assertRaises(SystemExit):
                    run(["scaffold", str(Path(tmp) / "f"), "--style", "cel", "--id", bad])
            with self.assertRaises(SystemExit):
                run(["scaffold", str(Path(tmp) / "g"), "--style", "oil"])


class Vendored(unittest.TestCase):
    def test_licence_and_provenance_travel_with_the_code(self):
        notice = (paint.SKILL / "THIRD-PARTY.md").read_text()
        self.assertIn("MIT License", notice)
        self.assertIn(paint.VENDORED["commit"], notice)
        for removed in ("06-hibiscus-canopy", "08-ornament-grid", "20-field-journal"):
            self.assertFalse(list(paint.STYLES_DIR.rglob(f"{removed}.js")), removed)
            self.assertIn(removed.split("-", 1)[1].replace("-", " "), notice)
        self.assertEqual(len(list(paint.STYLES_DIR.glob("*/scene-library/*.js"))), 35)
        for image in ("beautiful-collisions-contact.jpg", "tidal-collisions-contact.jpg",       # they show the unattributed slots
                      "translation-plates-side-by-side.jpg", "translation-watercolour-vs-pointillist.jpg"):
            self.assertFalse(list(paint.SKILL.rglob(image)), image)
            self.assertIn(image, notice)

    def test_every_image_a_doc_names_exists(self):
        missing = []
        for md in paint.SKILL.rglob("*.md"):
            if md.name == "THIRD-PARTY.md":                                     # it lists what was left out
                continue
            for ref in re.findall(r"[`(]([\w./-]+\.jpg)[`)]", md.read_text()):
                if not ((md.parent / ref).exists() or (paint.SKILL / ref).exists()):
                    missing.append(f"{md.relative_to(paint.SKILL)}: {ref}")
        self.assertFalse(missing, missing)

    def test_dependencies_are_pinned_exactly(self):
        pkg = json.loads((paint.ENGINE / "package.json").read_text())
        deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
        self.assertEqual(set(deps), {"p5", "p5.brush", "playwright", "vite"})
        for name, ver in deps.items():
            self.assertRegex(ver, r"^\d+\.\d+\.\d+$", name)
        self.assertFalse(set(pkg.get("scripts", {})) & {"preinstall", "install", "postinstall", "prepare"})

    def test_lockfile_matches_the_manifest_and_the_registry(self):
        pkg = json.loads((paint.ENGINE / "package.json").read_text())
        lock = json.loads((paint.ENGINE / "package-lock.json").read_text())
        root = lock["packages"][""]
        self.assertEqual(root.get("dependencies"), pkg["dependencies"])
        self.assertEqual(root.get("devDependencies"), pkg["devDependencies"])
        for name in {**pkg["dependencies"], **pkg["devDependencies"]}:
            self.assertEqual(lock["packages"][f"node_modules/{name}"]["version"], {**pkg["dependencies"], **pkg["devDependencies"]}[name])
        for path, p in lock["packages"].items():
            if path:
                with self.subTest(path):
                    self.assertTrue(p.get("resolved", "").startswith("https://registry.npmjs.org/"))
                    self.assertTrue(p.get("integrity", "").startswith("sha512-"))

    def test_every_style_has_its_parts(self):
        for style in paint.STYLES:
            with self.subTest(style):
                d = paint.STYLES_DIR / style
                self.assertTrue((d / "STYLE.md").exists())
                self.assertIn(f"export const STYLE = '{style}'", (d / "demo" / "film.js").read_text())
                self.assertTrue(list((d / "demo" / "scenes").glob("*.js")))

    @unittest.skipUnless(shutil.which("node"), "Node not installed")
    def test_engine_javascript_parses(self):
        files = [p for p in paint.ENGINE.rglob("*.mjs")] + [p for p in paint.ENGINE.rglob("*.js") if "node_modules" not in p.parts]
        files += list(paint.STYLES_DIR.rglob("*.js"))
        bad = []
        for f in files:
            r = subprocess.run(["node", "--check", str(f)], capture_output=True, text=True)
            if r.returncode and "Cannot use import statement" not in r.stderr:
                bad.append(f"{f.name}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else r.returncode}")
        self.assertFalse(bad, bad)


if __name__ == "__main__":
    unittest.main()
