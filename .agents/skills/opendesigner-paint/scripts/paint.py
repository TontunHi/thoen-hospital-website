#!/usr/bin/env python3
"""Bridge between an OpenDesigner design system and the painting engine vendored in this skill (engine/, styles/:
paintings and short films painted in code: watercolour, pointillism, charcoal, sketch, woodcut, 2D cel or mixed).

    python3 paint.py doctor                               the engine, Node, ffmpeg and Python tools: what is ready
    python3 paint.py brief --slot hero [--message "..."]   design system -> brief.json + brief.md (style, palette, text, motion)
    python3 paint.py scaffold --style cel FILM_DIR [--id ID]   a film project: engine + style demo + src/brand.js + BRIEF.md
    python3 paint.py palette FILM_DIR                     (re)write FILM_DIR/src/brand.js: the brief's palette families
    python3 paint.py lint FILM_DIR                        scenes use brand colours, seeded randomness, no text, no copied art
    python3 paint.py ingest FILM_DIR --to DIR [--as react|html|img] [--poster PLATE] [--label "..."]
                                                          checks passed? copy the film or painting into the app, with a
                                                          reduced-motion still, a pause control and a ledger row
    python3 paint.py ledger                               write opendesigner/paintings/CREDITS.md

The brief reads opendesigner/state.json (dials, answers, context, fonts) and the token CSS or DTCG primitives
(colour ramps), and works with no OpenDesigner system too (--accent '#hex'). Everything is written under
opendesigner/paintings/ in the person's project. The engine (vendored from generative-painting-skills, MIT; see
../THIRD-PARTY.md) needs Node, npm packages, Playwright's Chromium and ffmpeg in each film project. This script never
installs or runs them: scaffold prints the install commands for the person to approve. Standard library only; no network.
"""
import argparse, datetime, html, json, math, os, re, secrets, shutil, string, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
ENGINE, STYLES_DIR = SKILL / "engine", SKILL / "styles"
VENDORED = {"repo": "https://github.com/ckryptickunal/generative-painting-skills",
            "commit": "1ff8212779985e573507ebd51e5da080605af48d", "path": "skills/opendesigner-paint (engine/, styles/)",
            "licence": "MIT (generative-painting-skills contributors)",
            "runtime": "p5.js 2.3.3 (LGPL-2.1) and p5.brush 2.2.3 (MIT), installed from npm into each film, not shipped in frames"}
STYLES = ("watercolour", "pointillism", "charcoal", "sketch", "woodcut", "cel")

# ---------------------------------------------------------------- colour (OKLab; same maths as the engine and illustrate.py)

def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _gam(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


def hex_rgb(hx):
    hx = hx.lstrip("#")
    hx = "".join(ch * 2 for ch in hx[:3]) if len(hx) in (3, 4) else hx[:6]
    return tuple(int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgb_hex(rgb):
    return "#" + "".join(f"{round(min(1, max(0, c)) * 255):02x}" for c in rgb)


def oklch(hx):
    r, g, b = (_lin(c) for c in hex_rgb(hx))
    l = (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3)
    m = (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3)
    s = (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3)
    L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
    bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    return L, math.hypot(a, bb), math.degrees(math.atan2(bb, a)) % 360


def from_oklch(L, C, H):
    def rgb(c):
        a, b = c * math.cos(math.radians(H)), c * math.sin(math.radians(H))
        l, m, s = ((L + 0.3963377774 * a + 0.2158037573 * b) ** 3, (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
                   (L - 0.0894841775 * a - 1.2914855480 * b) ** 3)
        return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
                -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)
    lo, hi = 0.0, C
    ok = lambda c: all(-1e-4 <= v <= 1 + 1e-4 for v in rgb(c))
    if ok(C):
        lo = C
    else:
        for _ in range(24):
            mid = (lo + hi) / 2
            lo, hi = (mid, hi) if ok(mid) else (lo, mid)
    return rgb_hex(tuple(_gam(min(1, max(0, v))) for v in rgb(lo)))


def contrast(a, b):
    lum = lambda hx: sum(w * _lin(c) for w, c in zip((0.2126, 0.7152, 0.0722), hex_rgb(hx)))
    x, y = sorted((lum(a), lum(b)), reverse=True)
    return (x + 0.05) / (y + 0.05)


def delta_e(a, b):
    (L1, C1, H1), (L2, C2, H2) = oklch(a), oklch(b)
    a1, b1 = C1 * math.cos(math.radians(H1)), C1 * math.sin(math.radians(H1))
    a2, b2 = C2 * math.cos(math.radians(H2)), C2 * math.sin(math.radians(H2))
    return math.dist((L1, a1, b1), (L2, a2, b2))

# ---------------------------------------------------------------- the design system

RAMP_VAR = re.compile(r"--([a-z0-9-]*?)color-([a-z0-9]+)-(light|dark)-(\d{1,2})\s*:\s*(#[0-9a-fA-F]{6})\s*;")


def find_first(base, rels):
    for b in [base] + list(base.parents)[:3]:
        for rel in rels:
            if (b / rel).exists():
                return b / rel
    return None


def seed_ramp(seed, dark=False, neutral=False):
    L0, C0, H = oklch(seed)
    C0 = min(C0, 0.02) if neutral else C0
    Ls = [0.17, 0.2, 0.24, 0.28, 0.32, 0.36, 0.42, 0.52, L0, L0 + 0.05, 0.8, 0.94] if dark else \
         [0.99, 0.975, 0.95, 0.925, 0.9, 0.87, 0.82, 0.72, L0, L0 - 0.05, 0.5, 0.27]
    ks = [0.08, 0.12, 0.2, 0.28, 0.36, 0.44, 0.55, 0.75, 1, 0.95, 0.75, 0.45]
    return {i + 1: from_oklch(max(0, min(1, L)), C0 * k, H) for i, (L, k) in enumerate(zip(Ls, ks))}


def load_ramps(project, tokens=None, accent=None):
    """{'light': {ramp: {step: hex}}, 'dark': {...}, 'source': ...} from tokens.css, DTCG primitives or one seed hex."""
    if accent:
        out = {"light": {}, "dark": {}, "source": f"seed {accent}"}
        for mode in ("light", "dark"):
            out[mode]["accent"] = seed_ramp(accent, mode == "dark")
            out[mode]["neutral"] = seed_ramp(from_oklch(0.55, 0.01, oklch(accent)[2]), mode == "dark", neutral=True)
        return out
    path = Path(tokens) if tokens else find_first(project, ("opendesigner/build/css/tokens.css", "build/css/tokens.css",
                                                           "opendesigner/tokens/primitives.tokens.json", "tokens/primitives.tokens.json"))
    if not path or not path.exists():
        raise SystemExit("No tokens found. Run from the project (opendesigner/build/css/tokens.css), pass --tokens, or --accent '#hex'.")
    out = {"light": {}, "dark": {}, "source": str(path)}
    if path.suffix == ".json":
        for ramp, modes in json.loads(path.read_text(encoding="utf-8")).get("color", {}).items():
            for mode in ("light", "dark"):
                for step, tok in ((modes or {}).get(mode) or {}).items() if isinstance(modes, dict) else []:
                    v = tok.get("$value") if isinstance(tok, dict) else None
                    hx = v.get("hex") if isinstance(v, dict) else None
                    if step.isdigit() and hx:
                        out[mode].setdefault(ramp, {})[int(step)] = hx.lower()[:7]
    else:
        for m in RAMP_VAR.finditer(path.read_text(encoding="utf-8")):
            out[m.group(3)].setdefault(m.group(2), {})[int(m.group(4))] = m.group(5).lower()
    if "neutral" not in out["light"] or "accent" not in out["light"]:
        raise SystemExit(f"{path} has no neutral and accent ramps; pass --accent '#hex' instead.")
    return out


def load_state(project):
    p = find_first(project, ("opendesigner/state.json",))
    return json.loads(p.read_text(encoding="utf-8")) if p else {}


def val(state, *keys, default=None):
    cur = state
    for k in keys:
        cur = cur.get(k) if isinstance(cur, dict) else None
        if cur is None:
            return default
    return cur.get("value", default) if isinstance(cur, dict) and "value" in cur else cur

# ---------------------------------------------------------------- brand -> painting decisions

# Where each style sits on the dials (0-100). The engine's own guide (choosing-and-mixing-styles.md) maps briefs
# to styles by mood; these targets translate that mood table into OpenDesigner dials [inferred, house judgement].
STYLE_TARGETS = {
    "watercolour": {"energy": 35, "colorfulness": 55, "warmth": 60, "expression": 50, "_why": "delicate, archival, calm; pale paper under text"},
    "pointillism": {"energy": 70, "colorfulness": 85, "warmth": 55, "expression": 70, "_why": "luminous, saturated, textured; forms that dissolve into dots"},
    "cel": {"energy": 75, "colorfulness": 75, "warmth": 60, "expression": 70, "roundness": 80, "_why": "flat 2D animation; mechanisms, impacts, friendly characters"},
    "sketch": {"energy": 25, "colorfulness": 20, "warmth": 50, "expression": 30, "_why": "calm notes and diagrams in graphite or pen; quiet tools"},
    "charcoal": {"energy": 45, "colorfulness": 10, "warmth": 35, "expression": 55, "_why": "weight and tension in value plus one accent"},
    "woodcut": {"energy": 85, "colorfulness": 30, "warmth": 40, "expression": 80, "_why": "force and declaration in ink and one accent block"},
}
FROM_Q_IMG_04 = {"hand-drawn": "sketch", "line": "sketch", "flat": "cel", "mascot": "cel"}

SLOTS = {  # where painted work may go in a product, and the shape it takes there
    "hero": {"kind": "film or still", "size": "16:9, plates 1920x864 inside 1920x1080", "max_seconds": 24,
             "where": "marketing pages and the top of onboarding"},
    "launch": {"kind": "film", "size": "16:9 1920x1080 with a phrase track", "max_seconds": 30, "where": "a launch page, social video"},
    "onboarding": {"kind": "still or short loop", "size": "square 600 master, 1080 delivery", "max_seconds": 8, "where": "first-run screens"},
    "celebration": {"kind": "short loop", "size": "square 600 master", "max_seconds": 4, "where": "a success moment, once"},
    "og-image": {"kind": "still", "size": "1200x630", "max_seconds": 0, "where": "link previews"},
    "empty-state": {"kind": "still", "size": "square 600, shown at 160-240 px", "max_seconds": 0, "where": "empty and error screens"},
    "background": {"kind": "still", "size": "the section's size", "max_seconds": 0, "where": "a quiet ground behind marketing copy"},
}


def recommend_style(dials, q_img=None):
    if q_img == "none":
        return [("none", "Q-img-04 says no illustration: a painting would contradict a confirmed decision")]
    if q_img in FROM_Q_IMG_04:
        s = FROM_Q_IMG_04[q_img]
        rest = [(k, STYLE_TARGETS[k]["_why"]) for k in rank_styles(dials) if k != s][:2]
        return [(s, f"Q-img-04 is '{q_img}', which this style draws natively")] + rest
    ranked = rank_styles(dials)
    out = []
    for k in ranked[:3]:
        t = STYLE_TARGETS[k]
        near = ", ".join(f"{d} {dials.get(d, 50)}" for d in ("energy", "colorfulness", "warmth", "expression") if abs(dials.get(d, 50) - t[d]) <= 20)
        out.append((k, f"{t['_why']} (close on {near or 'overall balance'})"))
    return out


def rank_styles(dials):
    def dist(t):
        keys = [k for k in t if not k.startswith("_")]
        return math.sqrt(sum((dials.get(k, 50) - t[k]) ** 2 for k in keys) / len(keys))
    return sorted(STYLE_TARGETS, key=lambda k: dist(STYLE_TARGETS[k]))


def palette_families(r):
    """7-9 families (7, plus one per extra accent ramp) across pale, dark and saturated grounds, built only from the token ramps (style-dna.md logic:
    one family per plate, 3-6 hues plus the ground, one near-white "almost nothing" and one near-black monument)."""
    L, D = r["light"], r["dark"]
    acc = [a for a in ("accent", "accent2", "accent3") if a in L]
    g = lambda mode, ramp, step: (L if mode == "light" else D).get(ramp, {}).get(step)
    fams = {
        "brand-paper": {"ground": g("light", "neutral", 1), "keys": [g("light", a, 9) for a in acc] + [g("light", "accent", 11)], "ink": g("light", "neutral", 12)},
        "brand-tint": {"ground": g("light", "accent", 3), "keys": [g("light", "accent", 9), g("light", "accent", 11)] + [g("light", a, 9) for a in acc[1:]], "ink": g("light", "neutral", 12)},
        "brand-night": {"ground": g("dark", "neutral", 1), "keys": [g("dark", a, 9) for a in acc] + [g("dark", "accent", 11)], "ink": g("dark", "neutral", 12)},
        "saturated-field": {"ground": g("light", "accent", 9), "keys": [g("light", a, 9) for a in acc[1:]] + [g("light", "neutral", 1), g("light", "accent", 4)], "ink": g("light", "neutral", 12)},
        "archival-ink": {"ground": g("light", "neutral", 2), "keys": [g("light", "accent", 11), g("light", "neutral", 6), g("light", "neutral", 9)], "ink": g("light", "neutral", 12)},
        "almost-nothing": {"ground": g("light", "neutral", 1), "keys": [g("light", "accent", 9), g("light", "neutral", 4)], "ink": g("light", "neutral", 10)},
        "monument": {"ground": g("dark", "neutral", 1), "keys": [g("dark", "accent", 9), g("dark", "accent", 11), g("dark", "neutral", 12)], "ink": g("dark", "neutral", 12)},
    }
    for a in acc[1:]:
        fams[f"{a}-paper"] = {"ground": g("light", a, 2), "keys": [g("light", a, 9), g("light", a, 11), g("light", "accent", 9)], "ink": g("light", "neutral", 12)}
    ivory, charcoal = g("light", "neutral", 1), g("light", "neutral", 12)
    for f in fams.values():
        f["keys"] = [k for k in dict.fromkeys(f["keys"]) if k]
        ci, cc = contrast(f["ground"], ivory), contrast(f["ground"], charcoal)
        f["text"] = ("ivory" if ci >= cc else "charcoal") if max(ci, cc) >= 4.5 else "none"
        f["text_contrast"] = round(max(ci, cc), 2)
    return fams


def font_decision(state):
    raw = state.get("raw", {})
    face = raw.get("displayFace")
    face = raw.get("textFace") if not face or face == "=textFace" else face
    lic = raw.get("fontLicence") or {}
    brand = raw.get("brandFace")
    if not face:
        return {"face": None, "status": "none", "say": "No typeface in state.json: use an OFL face, licence file beside it."}
    if brand and lic.get("selfHost") is True:
        return {"face": face, "status": "licensed", "say": f"{face}: your licence allows self-hosting; confirm it also covers text rendered into video and images before export."}
    if brand:
        return {"face": face, "status": "ask", "say": f"{face} is a brand font whose licence for video and image rendering is not recorded. Ask; until then use an OFL face of the same class."}
    return {"face": face, "status": "check-source", "say": f"{face}: confirm it is OFL or Apache on its source page, then ship the woff2 with its licence and a SHA-256 (widescreen-and-titles.md)."}


def build_brief(project, slot, message, tokens=None, accent=None, style=None):
    state = load_state(project)
    ramps = load_ramps(project, tokens, accent)
    dials = {k: (v.get("value") if isinstance(v, dict) else v) for k, v in (state.get("dials") or {}).items()}
    q_img = val(state, "answers", "Q-img-04")
    recs = recommend_style(dials, q_img)
    chosen = style or recs[0][0]
    if chosen not in STYLES + ("mixed", "none"):
        raise SystemExit(f"--style must be one of {STYLES + ('mixed',)}")
    fams = palette_families(ramps)
    slot_info = SLOTS[slot]
    accent9 = ramps["light"]["accent"].get(9)
    warm_red = accent9 and (oklch(accent9)[2] < 50 or oklch(accent9)[2] > 340) and oklch(accent9)[1] > 0.1
    expression = dials.get("expression", 50)
    ctx = state.get("context") or {}
    return {
        "made": datetime.date.today().isoformat(), "project": state.get("name") or project.name, "slot": slot, "slot_info": slot_info,
        "message": message or ctx.get("memorable") or "", "product": ctx.get("product", ""), "audience": ctx.get("audience", ""),
        "frame": None if "square" in slot_info["size"] else
                 "The engine's renderer and export make 600x600 squares. For this size, paint plates at it and add the small "
                 "compositor in widescreen-and-titles.md section 2 to the film project.",
        "style": chosen, "recommendations": [{"style": s, "why": w} for s, w in recs],
        "mixing": "Mixing styles is allowed: give each material a job, pointillism as punctuation (choosing-and-mixing-styles.md)" if expression >= 75 and slot in ("hero", "launch")
                  else "One style for the whole piece (mixing needs Expression 75+ and a hero or launch film)",
        "dials": dials, "palette_source": ramps["source"], "families": fams,
        "accent_mark": ("the brand accent will read as the style's red accent mark" if warm_red else
                        "charcoal, sketch and woodcut turn only warm reds into their accent mark; a non-red brand accent paints as value. "
                        "Use watercolour, pointillism or cel when the accent colour must show") if chosen in ("charcoal", "sketch", "woodcut") else None,
        "paper": fams["archival-ink"]["ground"],
        "font": font_decision(state),
        "text": "Words go in a fixed-anchor phrase track over the plates, never painted in. Only families whose 'text' is not 'none' may carry words; "
                "measure 4.5:1 under the glyph mask (widescreen-and-titles.md). WCAG 2.2 AA is a locked OpenDesigner floor.",
        "motion": ("Films and loops only in marketing, onboarding and celebration (DC-L05-21; STD-when-to-animate-11 keeps decorative motion off "
                   "functional screens; STD-easing-duration-09 allows over 1 s only for illustrative motion). In the app: muted, a still for "
                   "prefers-reduced-motion, and a pause control when it plays over 5 s (WCAG 2.2.2)."),
        "sound": "Muted in the product. The soft score is only for the downloadable film or a page where the person presses play.",
        "identity": ("The engine's scene library recreates one earlier film ('reconstructed'; the three 'supplied' ports of unnamed sketches are left out). Use it for "
                     "structure only (composition, rhythm, archetypes); every shipped plate needs this product's subject and palette. "
                     "References give structure, never identity (guardrails.md)."),
        "upstream": VENDORED,
    }


def brief_md(b):
    rows = "\n".join(f"| {n} | `{f['ground']}` | {' '.join(f'`{k}`' for k in f['keys'])} | `{f['ink']}` | {f['text']} ({f['text_contrast']}:1) |"
                     for n, f in b["families"].items())
    recs = "\n".join(f"{i + 1}. **{r['style']}**: {r['why']}" for i, r in enumerate(b["recommendations"]))
    return f"""# Painting brief: {b['project']} · {b['slot']}

Made {b['made']} by opendesigner-paint from the design system ({b['palette_source']}). The painting skill reads this file before planning.

- **Message:** {b['message'] or '(ask the person in one line)'}
- **Slot:** {b['slot']}: {b['slot_info']['kind']}, {b['slot_info']['size']}, at most {b['slot_info']['max_seconds']} s; {b['slot_info']['where']}
{('- **Frame:** ' + b['frame']) if b.get('frame') else ''}
- **Style:** {b['style']}. {b['mixing']}.
{('- **Accent mark:** ' + b['accent_mark']) if b['accent_mark'] else ''}

## Style recommendations (from the dials)
{recs}

## Palette families (only these colours; one family per plate)
Scenes import them from `src/brand.js`. Pigment mixing makes in-between colours; that is expected.

| Family | Ground | Keys | Ink | Text on it |
|---|---|---|---|---|
{rows}

## Rules from the design system
- **Font:** {b['font']['say']}
- **Text:** {b['text']}
- **Motion:** {b['motion']}
- **Sound:** {b['sound']}
- **Identity:** {b['identity']}
- **Paper:** charcoal and sketch materials take `PLATES[id].material.paper = '{b['paper']}'`.
"""

# ---------------------------------------------------------------- commands

def proj_dir(a):
    return Path(a.project).resolve()


def paintings(a):
    return proj_dir(a) / "opendesigner" / "paintings"


def cmd_doctor(a):
    styles = sorted(d.name for d in STYLES_DIR.glob("*/") if (d / "demo" / "film.js").exists()) if STYLES_DIR.exists() else []
    print(f"engine          {ENGINE if (ENGINE / 'package.json').exists() else 'missing: ' + str(ENGINE)}")
    print(f"styles          {', '.join(styles) or 'none found'}")
    print(f"vendored from   {VENDORED['repo']} @ {VENDORED['commit'][:12]} ({VENDORED['licence']})")
    for tool, need in (("node", "Node 18+"), ("npm", "npm"), ("ffmpeg", "ffmpeg (video export; --no-video works without it)"),
                       ("python3", "Python 3 (numpy and scipy only for tools/cut_audit.py)")):
        print(f"{tool:<15} {shutil.which(tool) or 'missing: ' + need}")
    print("\nEach film project needs `npm ci` (p5, p5.brush, Vite, Playwright, pinned by engine/package-lock.json) and `npx playwright install chromium`."
          "\nAsk the person before the first one: both download code from npm and a browser build.")


def cmd_brief(a):
    b = build_brief(proj_dir(a), a.slot, a.message, a.tokens, a.accent, a.style)
    d = paintings(a) / (a.id or a.slot)
    d.mkdir(parents=True, exist_ok=True)
    (d / "brief.json").write_text(json.dumps(b, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (d / "brief.md").write_text(brief_md(b), encoding="utf-8")
    print(f"{d / 'brief.md'}\n  style {b['style']} ({'; '.join(r['style'] for r in b['recommendations'])})\n  {len(b['families'])} palette families from {b['palette_source']}"
          f"\n  font: {b['font']['status']}")


def cmd_scaffold(a):
    """new-film.sh without the automatic install: copy the engine and the style's demo, set the id and audio seed,
    write src/brand.js and BRIEF.md, then print the install commands for the person to approve."""
    style = a.style
    demo = STYLES_DIR / style / "demo"
    if not (demo / "film.js").exists():
        raise SystemExit(f"unknown style {style!r}: {', '.join(sorted(d.name for d in STYLES_DIR.glob('*/') if (d / 'demo' / 'film.js').exists()))}")
    target = Path(a.film)
    fid = a.id or target.name
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", fid):
        raise SystemExit(f"film id must be lowercase letters, digits and hyphens: {fid!r}")
    if target.exists() and any(target.iterdir()):
        raise SystemExit(f"refusing to write into non-empty {target}")
    shutil.copytree(ENGINE, target, dirs_exist_ok=True, ignore=shutil.ignore_patterns("node_modules", "out", ".vite", "__pycache__", ".DS_Store"))
    shutil.copyfile(demo / "film.js", target / "src" / "film.js")
    (target / "src" / "scenes").mkdir(parents=True, exist_ok=True)
    for f in sorted((demo / "scenes").glob("*.js")):
        shutil.copyfile(f, target / "src" / "scenes" / f.name)
    seed = "".join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(20))
    film = target / "src" / "film.js"
    t = film.read_text(encoding="utf-8")
    t = re.sub(r"^export const ID = .*$", f"export const ID = '{fid}';", t, count=1, flags=re.M)
    t = re.sub(r"^export const AUDIO_SEED = .*$", f"export const AUDIO_SEED = '{seed}';", t, count=1, flags=re.M)
    film.write_text(t, encoding="utf-8")
    note = ""
    try:
        b, src = brief_for(a, target)
        cmd_palette(a)
        shutil.copyfile(src.with_suffix(".md"), target / "BRIEF.md")
        if b["style"] not in (style, "mixed"):
            note = f"\nnote: the brief recommends {b['style']}; you scaffolded {style}. Say why, or re-run brief --style {style}."
    except SystemExit:
        note = "\nnote: no brief yet: run `paint.py brief --slot <slot>`, then `paint.py palette` for src/brand.js."
    print(f"Ready: {target} (style {style}, film id {fid}, audio seed {seed}). The demo scenes are placeholders: replace them."
          f"{note}\nWith the person's OK (about 75 MB of npm packages, then about 210 MB of Chromium downloads for Playwright,"
          f" more once unpacked):\n  cd {target} && npm ci --no-audit --no-fund && npx playwright install chromium"
          "\nThen: npm run plates (paintings), npm run dev (preview), npm run export (film and checks).")


def brief_for(a, film):
    path = Path(a.brief) if getattr(a, "brief", None) else None
    if not path:
        hits = sorted(paintings(a).glob("*/brief.json"), key=lambda p: p.stat().st_mtime)
        path = hits[-1] if hits else None
    if not path or not path.exists():
        raise SystemExit("No brief yet: run `paint.py brief --slot <slot>` first (or pass --brief).")
    return json.loads(path.read_text(encoding="utf-8")), path


def cmd_palette(a):
    b, src = brief_for(a, a.film)
    out = Path(a.film) / "src" / "brand.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    fams = {n: {k: f[k] for k in ("ground", "keys", "ink", "text")} for n, f in b["families"].items()}
    out.write_text(f"""/** Brand palette for this film, generated by opendesigner-paint from {src.name} ({b['made']}).
 * One family per plate: its ground, 3-6 keys and an ink. `text` says which polarity may carry words on that
 * ground ('none' means no words on it). Do not hand-edit: change the design system and run `paint.py palette`. */
export const BRAND = {json.dumps(fams, indent=2)};
export const PAPER = {json.dumps(b['paper'])};
export const STYLE_FROM_BRIEF = {json.dumps(b['style'])};
/** The family a plate uses: `const F = family('brand-night'); k.ground([[F.ground, 50]]); k.glaze(pts, F.keys[0], 160);` */
export function family(name) {{
  const f = BRAND[name];
  if (!f) throw new Error(`Unknown brand family ${{name}}: ${{Object.keys(BRAND).join(', ')}}`);
  return f;
}}
""", encoding="utf-8")
    print(out)


HEX = re.compile(r"['\"](#[0-9a-fA-F]{6})['\"]")


def cmd_lint(a):
    film = Path(a.film)
    b, _ = brief_for(a, film)
    allowed = {c.lower() for f in b["families"].values() for c in [f["ground"], f["ink"], *f["keys"]] if c}
    problems, notes = [], []
    film_js = film / "src" / "film.js"
    if film_js.exists():
        t = film_js.read_text(encoding="utf-8")
        m = re.search(r"export const STYLE = '([a-z]+)'", t)
        if m and b["style"] not in ("mixed", m.group(1)):
            notes.append(f"film.js STYLE is '{m.group(1)}' but the brief chose '{b['style']}'")
        fps = int((re.search(r"export const FPS = (\d+)", t) or [0, 24])[1])
        ends = [int(x) for x in re.findall(r"\[\s*'\d+'\s*,\s*\d+\s*,\s*(\d+)\s*,", t)]
        cap = b["slot_info"]["max_seconds"]
        if ends and cap and max(ends) / fps > cap:
            problems.append(f"film runs {max(ends) / fps:.1f} s; the {b['slot']} slot allows {cap} s")
        # Particle motion is drawn in colours hard-coded in src/particles.js, not in the scenes.
        parts = film / "src" / "particles.js"
        kinds = sorted(set(re.findall(r"motion:\s*'([a-z-]+)'", t)))
        if kinds and parts.exists():
            pt = parts.read_text(encoding="utf-8")
            segs = []
            for fn in sorted({"buildOceanParticles" if k in ("school", "jelly") else "buildWatercolourParticles" for k in kinds}):
                i = pt.find(f"function {fn}(")
                segs.append(pt[i:pt.find("\nfunction ", i + 1)] if i >= 0 else pt)
            off = sorted({h.lower() for s in segs for h in HEX.findall(s)} - allowed)
            if off:
                problems.append(f"particles.js: the {', '.join(kinds)} motion draws particles in the engine's own colours ({len(off)} off-brand); "
                                "recolour those palettes from src/brand.js")
    for f in sorted((film / "src" / "scenes").glob("*.js")):
        if f.name == "index.js":
            continue
        t = f.read_text(encoding="utf-8")
        if "Math.random" in t:
            problems.append(f"{f.name}: Math.random breaks determinism; use the seeded kit (k.R, p.random)")
        if re.search(r"\b(p|brush)\.text(Font|Size)?\s*\(", t):
            problems.append(f"{f.name}: text drawn into a plate; words belong in the phrase track")
        if re.search(r"kind:\s*'(reconstructed|supplied)'", t):
            off = [h for h in HEX.findall(t) if h.lower() not in allowed]
            if off:
                problems.append(f"{f.name}: a library scene still in its original colours ({len(off)} off-brand); repaint it with this product's subject and palette")
            else:
                notes.append(f"{f.name}: adapted from the engine's library; make sure the subject is this product's own")
        off = sorted({h.lower() for h in HEX.findall(t)} - allowed)
        if off and "brand.js" not in t:
            nearest = lambda h: min(allowed, key=lambda c: delta_e(h, c)) if allowed else "?"
            notes.append(f"{f.name}: {len(off)} colours outside the brand families, e.g. " + ", ".join(f"{h}->{nearest(h)}" for h in off[:4]))
    for p in problems:
        print(f"FAIL {p}")
    for n in notes:
        print(f"note {n}")
    if not problems and not notes:
        print("ok: brand palette, seeded randomness, no text in plates, no unadapted library scenes")
    if problems:
        sys.exit(1)


def film_out(film):
    outs = sorted((film / "out").glob("*/manifest.json"), key=lambda p: p.stat().st_mtime) or sorted((film / "out").glob("*/plates-contact.png"))
    if not outs:
        raise SystemExit(f"No export in {film / 'out'}: run `npm run export` (film) or `npm run plates` (painting) first.")
    return outs[-1].parent


def cmd_ingest(a):
    film = Path(a.film)
    out = film_out(film)
    b, _ = brief_for(a, film)
    checks = json.loads((out / "checks.json").read_text(encoding="utf-8")) if (out / "checks.json").exists() else None
    if checks is not None and checks.get("failed"):
        raise SystemExit(f"The export's own checks failed ({len(checks['failed'])}): fix them first. {checks['failed'][:2]}")
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8")) if (out / "manifest.json").exists() else {}
    fid = manifest.get("id") or out.name
    # The still: a plate from `npm run plates`, else the film's own anchor frame for that plate (`npm run export`).
    plates = {p.stem: p for p in sorted((out / "plates").glob("*.png"))}
    for p in sorted((out / "anchors").glob("*.png")):
        m = re.fullmatch(r"\d+-(.+)-f\d+", p.stem)
        if m:
            plates.setdefault(m.group(1), p)
    want = a.poster or next((s.get("plate") for s in manifest.get("shots") or [] if s.get("plate") in plates), None)
    if a.poster and want not in plates:
        raise SystemExit(f"No plate {a.poster}: choose from {sorted(plates)}")
    poster = plates.get(want) or next(iter(plates.values()), None)
    video = out / f"{fid}.mp4" if (out / f"{fid}.mp4").exists() else None
    if not poster:
        raise SystemExit(f"No still in {out} (the image, or the film's reduced-motion still): run `npm run plates` first.")
    dest = Path(a.to)
    dest.mkdir(parents=True, exist_ok=True)
    written = []
    shutil.copyfile(poster, dest / f"{fid}-poster.png")
    written.append(dest / f"{fid}-poster.png")
    is_film = bool(video) and a.as_ != "img"
    if is_film:
        shutil.copyfile(video, dest / f"{fid}.mp4")
        written.append(dest / f"{fid}.mp4")
    seconds = manifest.get("seconds") or 0
    alt = a.label or ""
    comp = "".join(w.capitalize() for w in re.split(r"[^a-zA-Z0-9]+", fid) if w) + ("Film" if is_film else "Painting")
    if a.as_ == "react":
        body = (_react_film(comp, fid, alt, seconds) if is_film else _react_still(comp, fid, alt))
        (dest / f"{comp}.tsx").write_text(body, encoding="utf-8")
        written.append(dest / f"{comp}.tsx")
    elif a.as_ == "html":
        (dest / f"{fid}.html").write_text(_html_film(fid, alt, seconds) if is_film else _html_still(fid, alt), encoding="utf-8")
        written.append(dest / f"{fid}.html")
    led_path = paintings(a) / "ledger.json"
    led = json.loads(led_path.read_text(encoding="utf-8")) if led_path.exists() else {"_about": "Painted work used in this project.", "items": []}
    entry = {"id": fid, "slot": b["slot"], "style": b["style"], "kind": "film" if is_film else "painting", "made": manifest.get("exportedAt", b["made"]),
             "seconds": seconds, "files": [str(p) for p in written], "checks": "passed" if checks is not None else "none (plates only)",
             "plate_hashes": {p["plate"]: p["hash"] for p in manifest.get("plates") or [] if isinstance(p, dict) and p.get("plate") and p.get("hash")},
             "rights": "made for this project by code; the project owns the output",
             "credits": f"Painted with the generative-painting engine vendored in opendesigner-paint ({VENDORED['licence']}, commit {VENDORED['commit'][:12]}); {VENDORED['runtime']}",
             "fonts": b["font"]}
    led["items"] = [e for e in led["items"] if e["id"] != fid] + [entry]
    led_path.parent.mkdir(parents=True, exist_ok=True)
    led_path.write_text(json.dumps(led, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_credits(paintings(a))
    for p in written:
        print(f"wrote {p}")
    if is_film:
        print(f"Film {seconds:g} s: muted, a still for reduced motion{', and a pause button (over 5 s)' if seconds > 5 else ''}. "
              "Optional smaller files: ffmpeg -i <film>.mp4 -c:v libx264 -crf 23 -an <film>-web.mp4")
    print("Record it: engine.py set hooks.H-motion.status (film) or hooks.H-illus.status (still) '\"tool\"' --why \"painted with opendesigner-paint\"")


def _react_film(comp, fid, alt, seconds):
    pause = seconds > 5
    return f"""// {fid}: painted in code with opendesigner-paint.
// Muted and inline; a still for prefers-reduced-motion{"; a pause control because it plays over 5 s (WCAG 2.2.2)" if pause else ""}.
import {{ useEffect, useRef, useState }} from "react";

export function {comp}({{ src = "{fid}.mp4", poster = "{fid}-poster.png", className }}: {{ src?: string; poster?: string; className?: string }}) {{
  const ref = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(true);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {{
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(q.matches);
    sync();
    q.addEventListener("change", sync);
    return () => q.removeEventListener("change", sync);
  }}, []);
  if (reduced) return <img src={{poster}} alt={{{json.dumps(alt)}}} {"" if alt else 'aria-hidden="true" '}className={{className}} />;
  return (
    <div className={{className}} style={{{{ position: "relative" }}}}>
      <video ref={{ref}} src={{src}} poster={{poster}} autoPlay muted loop playsInline {"aria-label={" + json.dumps(alt) + "}" if alt else 'aria-hidden="true"'} style={{{{ width: "100%", display: "block" }}}} />
{'''      <button type="button" onClick={() => { const v = ref.current; if (!v) return; if (v.paused) { v.play(); setPlaying(true); } else { v.pause(); setPlaying(false); } }}
        aria-label={playing ? "Pause animation" : "Play animation"} style={{ position: "absolute", right: 12, bottom: 12, minWidth: 24, minHeight: 24 }}>
        {playing ? "Pause" : "Play"}
      </button>
''' if pause else ""}    </div>
  );
}}
"""


def _react_still(comp, fid, alt):
    return f"""// {fid}: a painting made in code with opendesigner-paint.
export function {comp}({{ src = "{fid}-poster.png", className }}: {{ src?: string; className?: string }}) {{
  return <img src={{src}} alt={{{json.dumps(alt)}}} {"" if alt else 'aria-hidden="true" '}className={{className}} />;
}}
"""


def _html_film(fid, alt, seconds):
    label = f'aria-label="{html.escape(alt)}"' if alt else 'aria-hidden="true"'
    still = f'alt="{html.escape(alt)}"' if alt else 'alt="" aria-hidden="true"'
    pause = ('\n  <button type="button" class="od-film-toggle" onclick="var v=this.parentNode.querySelector(\'video\');'
             'if(v.paused){v.play();this.textContent=\'Pause\'}else{v.pause();this.textContent=\'Play\'}">Pause</button>') if seconds > 5 else ""
    return f"""<!-- {fid}: painted in code with opendesigner-paint. Muted; a still image for reduced motion{"; a pause control because it plays over 5 s" if pause else ""}. -->
<div class="od-film">
  <video src="{fid}.mp4" poster="{fid}-poster.png" autoplay muted loop playsinline {label}></video>
  <img class="od-film-still" src="{fid}-poster.png" {still}>{pause}
</div>
<style>
  .od-film {{ position: relative }}
  .od-film video, .od-film-still {{ display: block; width: 100%; height: auto }}
  .od-film-still {{ display: none }}
  .od-film-toggle {{ position: absolute; right: 12px; bottom: 12px; min-width: 24px; min-height: 24px }}
  @media (prefers-reduced-motion: reduce) {{ .od-film video, .od-film-toggle {{ display: none }} .od-film-still {{ display: block }} }}
</style>
"""


def _html_still(fid, alt):
    a = f'alt="{html.escape(alt)}"' if alt else 'alt="" aria-hidden="true"'
    return f'<img src="{fid}-poster.png" {a}>\n'


def write_credits(d):
    led = json.loads((d / "ledger.json").read_text(encoding="utf-8")) if (d / "ledger.json").exists() else {"items": []}
    lines = ["# Painted work: credits", "", "Generated by opendesigner-paint from ledger.json.", "",
             "| Work | Slot | Style | Rights | Made with | Font |", "|---|---|---|---|---|---|"]
    for e in led["items"]:
        lines.append(f"| {e['id']} ({e['kind']}) | {e['slot']} | {e['style']} | {e['rights']} | {e['credits']} | {(e.get('fonts') or {}).get('face') or 'no text'} |")
    (d / "CREDITS.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return d / "CREDITS.md"


def cmd_ledger(a):
    print(write_credits(paintings(a)))


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", default=".", help="the person's project root (holds opendesigner/)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("doctor").set_defaults(fn=cmd_doctor)
    p = sub.add_parser("scaffold"); p.add_argument("film"); p.add_argument("--style", required=True); p.add_argument("--id")
    p.add_argument("--brief"); p.set_defaults(fn=cmd_scaffold)
    p = sub.add_parser("brief"); p.add_argument("--slot", required=True, choices=list(SLOTS)); p.add_argument("--message")
    p.add_argument("--style", help="override the recommendation"); p.add_argument("--id", help="brief folder name (default: the slot)")
    p.add_argument("--tokens"); p.add_argument("--accent", help="no tokens yet: build the palette from this hex"); p.set_defaults(fn=cmd_brief)
    for name, fn in (("palette", cmd_palette), ("lint", cmd_lint)):
        p = sub.add_parser(name); p.add_argument("film"); p.add_argument("--brief"); p.set_defaults(fn=fn)
    p = sub.add_parser("ingest"); p.add_argument("film"); p.add_argument("--to", required=True); p.add_argument("--brief")
    p.add_argument("--as", dest="as_", default="react", choices=["react", "html", "img"]); p.add_argument("--poster", help="plate id for the still")
    p.add_argument("--label", help="meaningful art: its accessible name; omit for decorative (aria-hidden)"); p.set_defaults(fn=cmd_ingest)
    sub.add_parser("ledger").set_defaults(fn=cmd_ledger)
    a = ap.parse_args(argv)
    a.fn(a)


if __name__ == "__main__":
    main()
