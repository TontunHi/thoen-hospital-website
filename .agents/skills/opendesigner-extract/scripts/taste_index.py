#!/usr/bin/env python3
"""Taste Index: a full description of one look, measured from a site (or a screenshot) the person loves, written so
any agent can build in that look. Owner decision 2026-10-23 (SPEC 5.4): when an index is first presented it may keep
the site's exact measured values, colours and font names; what the person keeps or changes is their responsibility.
Logos, brand names, imagery and written copy stay out, and font files are never downloaded or shipped.

    python3 taste_index.py draft scan.json --id retro-os [--tag inspiration|our-product] [--picture "..."] [--project .]
    python3 taste_index.py screenshot shot.png --id retro-os [--estimate radius=0 --estimate body=16 ...] [--project .]
    python3 taste_index.py set retro-os picture "Desktop software from the early 80s, printed on flat pink paper"
    python3 taste_index.py set retro-os principles                  every principle found, numbered as the next two commands use them
    python3 taste_index.py set retro-os why 2 "A flat colour per section tells you where you are"
    python3 taste_index.py set retro-os principle 3 --drop          (or --keep; 5 to 7 are kept)
    python3 taste_index.py set retro-os never "Paragraphs in pixel type"    (always inferred; never --drop N removes one)
    python3 taste_index.py build retro-os        TASTE-INDEX.md, taste.css (a variable for every value) and specimen.html
    python3 taste_index.py check retro-os        the reel's structure is complete and every line says measured or inferred
    python3 taste_index.py list                  the indexes in this project, and which one the system follows
    python3 taste_index.py use retro-os --fonts exact|free     only after the person chose it: the system follows this index

scan.json is css_scan.py --json output (one page, or several pages merged with repeated --from-json). Each index lives
in opendesigner/taste-indexes/<id>/ and is registered as a reference, so its dials reach the taste index (taste.py) as
inspiration evidence. Name the look, not the brand: the id is the look's name (retro-os, warm-paper).
Standard library only; no network.
"""
import argparse, contextlib, datetime, html, importlib.util, io, json, math, re, struct, sys, zlib
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import css_scan  # noqa: E402

NOTICE = ("This index keeps the reference's exact measured values, colours and font names, as first presented. "
          "Using them, changing them or replacing them is your call and your responsibility, including any rights in what "
          "you keep. Logos, brand names, imagery and written copy are never part of it, and font files are never downloaded "
          "or shipped: a font is named, with a free substitute.")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,40}$")

# Open-licence faces (SIL OFL or Apache 2.0, all on Google Fonts): named and usable as they are.
OPEN = {f.lower() for f in [
    "Inter", "Inter Tight", "Roboto", "Roboto Mono", "Roboto Flex", "Roboto Slab", "Open Sans", "Lato", "Montserrat", "Poppins",
    "Work Sans", "DM Sans", "DM Serif Display", "Manrope", "Figtree", "Geist", "Geist Mono", "Fira Sans", "Fira Code", "Public Sans",
    "Lexend", "Outfit", "Space Grotesk", "Space Mono", "Sora", "Karla", "Rubik", "Merriweather", "Lora", "Playfair Display",
    "Source Sans 3", "Source Serif 4", "Source Code Pro", "Recursive", "Instrument Sans", "Instrument Serif", "Onest",
    "Hanken Grotesk", "Plus Jakarta Sans", "Nunito", "IBM Plex Sans", "IBM Plex Serif", "IBM Plex Mono", "JetBrains Mono",
    "Noto Sans", "Noto Serif", "Atkinson Hyperlegible", "Fraunces", "Newsreader", "VT323", "Pixelify Sans", "Silkscreen",
    "EB Garamond", "Libre Baskerville", "Crimson Pro", "Bricolage Grotesque", "Schibsted Grotesk", "Archivo", "Barlow",
    "Mulish", "Raleway", "Oswald", "Bebas Neue", "Anton", "Epilogue", "Syne", "Unbounded", "Literata", "Spectral"]}
# A commercial or unknown face becomes the closest open face of its kind (by words in its name, then its fallback).
SUBSTITUTES = [(r"mono|code|courier|consol|menlo", "JetBrains Mono"), (r"pixel|terminal|bitmap|8.?bit|lisa|chicago|geneva", "VT323"),
               (r"slab|egyptian|clarendon", "Roboto Slab"), (r"rounded|round", "Nunito"),
               (r"grotesk|grotesque|helvetica|neue|akzidenz|s.hne|graphik|suisse|haas|unica|aktiv", "Inter Tight"),
               (r"futura|circular|avenir|gilroy|euclid|sofia|proxima|gotham|brandon|geometric", "Plus Jakarta Sans"),
               (r"serif|garamond|caslon|tiempos|times|georgia|canela|baskerville|didot|bodoni|freight|lyon|publico|domaine", "Newsreader")]
ROLE_NAMES = {"heading": "display", "body": "text", "nav": "navigation", "control": "controls", "label": "labels",
              "caption": "small print", "code": "code", "noise": "machine decoration"}


# ---------- the engine (state, references, dials) ----------
def engine():
    for p in (HERE / "engine.py", HERE.parent.parent / "opendesigner" / "scripts" / "engine.py"):
        if p.exists():
            spec = importlib.util.spec_from_file_location("od_engine", p)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod
    return None


def od_dir(project):
    return Path(project).resolve() / "opendesigner"


def index_dir(project, iid):
    return od_dir(project) / "taste-indexes" / iid


def load_index(project, iid):
    p = index_dir(project, iid) / "index.json"
    if not p.exists():
        sys.exit(f"No taste index named {iid} here. `taste_index.py list` shows the ones in this project.")
    return json.loads(p.read_text(encoding="utf-8"))


def save_index(project, ix):
    p = index_dir(project, ix["id"])
    p.mkdir(parents=True, exist_ok=True)
    (p / "index.json").write_text(json.dumps(ix, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


# ---------- small helpers ----------
def pct(x, digits=0):
    if x is None:
        return "not measured"
    v = round(float(x) * 100, digits)
    return "under 0.1%" if 0 < float(x) < 0.001 else f"{v:g}%"


def hex_name(h):
    L, C, H = css_scan.oklch(h)
    if C < 0.03:
        return "near-white" if L > 0.93 else "near-black" if L < 0.25 else "light grey" if L > 0.75 else "dark grey" if L < 0.45 else "grey"
    cuts = [0, 15, 40, 70, 95, 115, 135, 170, 200, 225, 270, 300, 335, 361]  # OKLCH hue
    names = ["pink", "red", "orange", "amber", "yellow", "lime", "green", "teal", "cyan", "blue", "violet", "magenta", "pink"]
    name = next(n for lo, hi, n in zip(cuts, cuts[1:], names) if lo <= H < hi)
    return ("deep " if L < 0.45 else "pale " if L > 0.85 else "") + name


def licence(face):
    if not face:
        return "system"
    if face.lower() in OPEN:
        return "open"
    if face.lower() in css_scan.SYSTEM_FACES:
        return "system"
    return "not known"


def substitute(face, role="text"):
    if not face or face.lower() in OPEN:
        return face
    if face.lower() in css_scan.SYSTEM_FACES:
        return None
    for pat, sub in SUBSTITUTES:
        if re.search(pat, face, re.I):
            return "Inter" if sub == "Inter Tight" and role not in ("heading", "display") else sub
    return "Inter Tight" if role == "heading" else "Inter"


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", str(s).lower()).strip("-")


def stack(face, sub, generic):
    out = [f'"{face}"'] if face and face.lower() not in css_scan.SYSTEM_FACES else []
    if sub and sub != face:
        out.append(f'"{sub}"')
    return ", ".join(out + (["ui-monospace", "monospace"] if generic == "mono" else ["ui-serif", "Georgia", "serif"] if generic == "serif"
                            else ["system-ui", "sans-serif"]))


def generic_of(face, sub):
    key = f"{face} {sub}".lower()
    return "mono" if re.search(r"mono|code|vt323|terminal|pixel", key) else "serif" if re.search(r"serif|newsreader|fraunces|garamond", key) and "sans" not in key else "sans"


def source_host(src):
    """Where it was measured, as hosts only (no path or query): provenance, never part of the look."""
    hosts = []
    for part in str(src or "").split(", "):
        m = re.match(r"^[a-z]+://([^/?#]+)", part.strip())
        h = m.group(1) if m else part.strip()
        if h and h not in hosts:
            hosts.append(h)
    return ", ".join(hosts) or None


def measured(rule, basis, **kw):
    return {"rule": rule, "basis": basis, "status": "measured", **kw}


# ---------- draft: measurements -> the index's structure ----------
def colour_jobs(a):
    sf, col = a.get("surfaces") or {}, a.get("color") or {}
    jobs, data = {}, {}

    def job(h, text, area=None, txt=None, generic=False):
        h = css_scan.hex_norm(h)
        if not h or (generic and jobs.get(h)):
            return  # a generic job (surface, text) only names a colour that has no specific one
        jobs.setdefault(h, [])
        if text not in jobs[h]:
            jobs[h].append(text)
        d = data.setdefault(h, {"area": 0.0, "text": 0.0})
        if area is not None:
            d["area"] = max(d["area"], area)
        if txt is not None:
            d["text"] = max(d["text"], txt)
    areas = {x["hex"]: x["share"] for x in sf.get("areas") or []}
    texts = {x["hex"]: x["share"] for x in sf.get("text") or []}
    if sf.get("pageBg"):
        job(sf["pageBg"], "ground: the page itself", areas.get(sf["pageBg"], 0))
    for i, w in enumerate(sf.get("worlds") or []):
        if w["hex"] != sf.get("pageBg"):
            job(w["hex"], f"world: a full-width section colour ({w['sections']} section{'s' * (w['sections'] != 1)}, {pct(w['share'])} of the height)",
                areas.get(w["hex"], 0))
    neutral_text = [h for h, v in sorted(texts.items(), key=lambda kv: -kv[1]) if css_scan.is_neutral(h)]
    if neutral_text:
        job(neutral_text[0], "ink: most text", txt=texts[neutral_text[0]])
    if len(neutral_text) > 1 and texts[neutral_text[1]] >= 0.05:
        L0, L1 = css_scan.oklch(neutral_text[0])[0], css_scan.oklch(neutral_text[1])[0]
        job(neutral_text[1], "text on dark sections" if abs(L0 - L1) > 0.5 else "muted text: secondary lines and labels", txt=texts[neutral_text[1]])
    acc = (col.get("accents") or [None])[0]
    if acc:
        where = ", ".join({"button": "buttons", "link": "links", "focus": "focus rings", "selected": "selected states", "emphasis": "coloured words",
                           "token": "the accent token", "area": "large areas", "ring": "rings", "control": "form controls"}.get(s, s)
                          for s in sorted(acc["sources"]))
        job(acc["hex"], f"accent: {where}", areas.get(acc["hex"], 0), texts.get(acc["hex"], 0))
    dep = a.get("depth") or {}
    for w in dep.get("windows") or []:
        job(w["bar"], "window title bars")
        if w.get("border"):
            job(w["border"].split()[-1], "window borders")
    for f in dep.get("frames") or []:
        job(f["color"], f"the {f['band']} frame band inside windows")
    for sig in (a.get("components") or {}).get("button", [])[:2]:
        if sig.get("bg"):
            job(sig["bg"], "button fill", areas.get(sig["bg"]))
    for sig in (a.get("components") or {}).get("chip", [])[:2]:
        job(sig["bg"], "label chips", areas.get(sig["bg"]))
    for h, n in list((col.get("borders") or {}).items())[:2]:
        job(h, "rules and borders")
    for h, v in areas.items():
        if v >= 0.005:
            job(h, "surface: boxes and panels", v, generic=True)
    for h, v in texts.items():
        if v >= 0.02:
            job(h, "text", txt=v, generic=True)
    out = []
    for h, js in jobs.items():
        L, C, H = css_scan.oklch(h)
        d = data.get(h, {})
        out.append({"hex": h, "name": hex_name(h), "jobs": js, "area": round(d.get("area") or areas.get(h, 0), 3),
                    "text": round(d.get("text") or texts.get(h, 0), 3), "oklch": [L, C, H], "status": "measured"})
    out.sort(key=lambda c: (-(c["area"] + c["text"] * 0.2), c["hex"]))
    for c in out:  # the variable is named after the colour's most important job
        heads = [j.split(":")[0].split(" ")[0] for j in c["jobs"]]
        c["var"] = "--ti-color-" + next((k for k in ("ground", "ink", "world", "accent", "muted") if k in heads), "c")
    seen = Counter()
    for c in out:  # unique variable names: --ti-color-world, --ti-color-world-2 ...
        seen[c["var"]] += 1
        if seen[c["var"]] > 1 or c["var"] == "--ti-color-c":
            c["var"] += f"-{seen[c['var']]}"
    return out


def type_roles(a):
    t = a.get("type") or {}
    roles = t.get("roles") or {}
    out = []
    order = ["heading", "body", "nav", "control", "label", "caption", "code", "noise"]
    for role in sorted(roles, key=lambda r: order.index(r) if r in order else 99):
        r = roles[role]
        total = sum(r["families"].values()) or 1
        for fam, n in r["families"].items():
            system = fam.lower() in css_scan.SYSTEM_FACES
            if n / total < 0.15 or (system and (len(r["families"]) > 1 or r["share"] < 0.02)):
                continue
            sub = substitute(fam, role)
            fc = (r.get("faces") or {}).get(fam) or {"sizes": r["sizes"], "weights": r["weights"]}
            out.append({"role": ROLE_NAMES.get(role, role), "from": role, "family": fam, "share": round(r["share"] * n / total, 3),
                        "weights": [int(float(w)) for w in fc["weights"] if str(w).replace(".", "").isdigit()][:3], "sizes": fc["sizes"][:4],
                        "tracking": r["tracking"], "case": r["case"], "lineHeight": r["lineHeight"],
                        "substitute": sub, "licence": licence(fam), "generic": generic_of(fam, sub), "status": "measured"})
    if not out and t.get("families"):
        for f in t["families"][:3]:
            out.append({"role": "text", "from": "body", "family": f, "share": None, "weights": t.get("weights", [])[:3],
                        "sizes": [t["body"]["px"]] if t.get("body") else [], "tracking": 0, "case": None, "lineHeight": None,
                        "substitute": substitute(f), "licence": licence(f), "generic": generic_of(f, substitute(f)), "status": "measured"})
    return out


def describe_sig(kind, s):
    face = " ".join(x for x in (s.get("family"), f"{s['size']} px" if s.get("size") else "", str(s.get("weight") or "")) if x)
    corner = "square corners" if s.get("radius") == 0 else "pill corners" if s.get("radius") == "full" else f"{s.get('radius')} px corners" if s.get("radius") is not None else ""
    case = {"uppercase": "in capitals", "capitalize": "in Title Case", "lowercase": "in lowercase"}.get(s.get("case") or "", "")
    track = f"tracking {s['tracking']:g} em" if s.get("tracking") else ""
    if kind == "button":
        fill = f"{s['bg']} fill" if s.get("bg") else "no fill"
        return ", ".join(x for x in (fill, f"{s['text']} text" if s.get("text") else "", f"{s['border']} border" if s.get("border") else "no border",
                                     corner, f"{s['height']} px tall" if s.get("height") else "", f"{s['padX']} px side padding" if s.get("padX") else "",
                                     face, case, track) if x)
    if kind == "link":
        return f"{s.get('color')}, {'underlined' if s.get('underline') else 'not underlined'}, weight {s.get('weight')}"
    if kind == "chip":
        return ", ".join(x for x in (f"{s['bg']} with {s.get('text')} text", corner, face, case, track) if x)
    if kind == "nav":
        return ", ".join(x for x in (f"{s.get('color')}", face, case, track) if x)
    if kind == "card":
        return ", ".join(x for x in (f"{s['bg']} fill" if s.get("bg") else "no fill", f"{s['border']} border" if s.get("border") else "no border",
                                     corner, "no shadow" if not s.get("shadow") else f"shadow {s['shadow']}") if x)
    if kind == "field":
        return ", ".join(x for x in (f"{s['bg']} fill" if s.get("bg") else "no fill", f"{s['border']} border" if s.get("border") else "no border",
                                     corner, f"{s['height']} px tall" if s.get("height") else "") if x)
    return json.dumps(s)


def components(a):
    comps, c = [], a.get("components") or {}
    dep = a.get("depth") or {}
    for w in dep.get("windows") or []:
        comps.append({"name": "window", "rule": f"{w.get('border') or 'no'} border, a {w['bar']} title bar {w['barHeight']} px tall, a {w['body']} body, "
                                               + ("square corners" if not w.get("radius") else f"{w['radius']} px corners") + f" ({w['count']} on the page)",
                      "values": w, "status": "measured"})
    for f in dep.get("frames") or []:
        comps.append({"name": "frame", "rule": f"a {f['band']} band of {f['color']} on three sides inside a box, drawn with stacked boxes, no blur ({f['count']})",
                      "values": f, "status": "measured"})
    for h in dep.get("hard") or []:
        comps.append({"name": "hard shadow", "rule": f"{h}: a solid offset copy with no blur", "values": {"shadow": h}, "status": "measured"})
    labels = {"button": "button", "link": "link in text", "chip": "label chip", "nav": "navigation link", "card": "card", "field": "field"}
    for kind in ("button", "link", "chip", "nav", "card", "field"):
        sigs = sorted(c.get(kind) or [], key=lambda s: (kind == "button" and not s.get("bg") and not s.get("border"), -s.get("count", 0)))
        for i, s in enumerate(sigs[:2]):
            bare = kind == "button" and not s.get("bg") and not s.get("border")
            name = ("text button" if bare else labels[kind]) + ("" if i == 0 or bare else " (second style)")
            comps.append({"name": name, "kind": kind, "rule": describe_sig(kind, s) + f" ({s['count']} on the page)", "values": s, "status": "measured"})
    if dep.get("hint") == "borders" and not dep.get("shadows"):
        b = next(iter(dep.get("borders") or {}), None)
        comps.append({"name": "edges", "rule": f"lines instead of shadows: {b or 'thin'} borders, no shadows anywhere", "values": {"borders": dep.get("borders")},
                      "status": "measured"})
    return comps


def motion_part(a):
    m = a.get("motion") or {}
    rules, ui, loops = [], None, m.get("loops")
    if m.get("durations"):
        what = "colour and opacity fades only; nothing moves in space" if m.get("fadesOnly") else (
            f"{m.get('moves')} moving transition(s) and {m.get('fades')} fade(s)" if m.get("moves") is not None else "transitions")
        ui = {"median": m["median"], "durations": m["durations"], "easing": (m.get("easings") or ["ease"])[0], "character": m.get("character"),
              "fadesOnly": m.get("fadesOnly")}
        rules.append(measured(f"Interface changes take {m['median']:g} ms with {ui['easing']} ({ui['character']}): {what}", f"{m['count']} transition layer(s)"))
        if not m.get("overshoot"):
            rules.append(measured("No bounce or overshoot in any curve", "every easing measured stays inside its start and end"))
    if loops:
        rules.append(measured(f"Something is always running: {loops['count']} loop(s), {loops['character']}, "
                              + ", ".join(f"{d / 1000:g} s" for d in loops["durations"][:4]), loops["basis"]))
    if m.get("entrances"):
        rules.append(measured(f"{m['entrances']['count']} one-shot entrance animation(s), median {m['entrances']['median']:g} ms", "animations that run once"))
    if not rules:
        rules.append({"rule": "No motion was measured", "basis": m.get("note") or "a screenshot shows no motion", "status": "measured"})
    if loops and m.get("fadesOnly"):
        feel = "Mechanical and constant: small things run on plain loops, and interface changes are simple fades."
    elif loops:
        feel = "Always alive: loops run in the background while the interface responds on its own timing."
    elif m.get("fadesOnly") or (m.get("median") and m["median"] <= 200 and not m.get("overshoot")):
        feel = "Quiet: a change fades in about " + f"{m.get('median', 150):g} ms and nothing travels. If it reads as an animation, it is too much."
    elif m.get("overshoot"):
        feel = "Springy: things move and settle with a little overshoot."
    elif m.get("durations"):
        feel = "Measured: things move on smooth curves, without bounce."
    else:
        feel = None
    return {"feeling": {"text": feel, "status": "inferred"}, "ui": ui, "loops": loops, "rules": rules}


def voice_part(a):
    v, out = a.get("voice") or {}, []
    case_word = {"title": "Title Case", "sentence": "sentence case", "upper": "capitals", "lower": "lowercase"}

    def line(key, label):
        x = v.get(key) or {}
        if not x.get("n"):
            return
        c = Counter(x.get("case") or {})
        top, n = c.most_common(1)[0] if c else (None, 0)
        bits = [f"{case_word.get(top, top)} ({n} of {x['n']})" if top else None, f"about {x['words']:g} words"]
        if x.get("period") is not None:
            bits.append("never end with a period" if not x["period"] else f"{x['period']} of {x['n']} end with a period")
        if x.get("digits"):
            bits.append(f"numbers in {x['digits']} of {x['n']}")
        bits.append("no emoji" if not x.get("emoji") else f"emoji in {x['emoji']} of {x['n']}")
        if x.get("exclaim"):
            bits.append(f"an exclamation mark in {x['exclaim']}")
        out.append(measured(f"{label}: " + ", ".join(b for b in bits if b), f"{x['n']} {label.lower()} counted; no text kept"))
    line("heading", "Headlines")
    line("button", "Buttons and links")
    line("nav", "Navigation")
    p = v.get("prose") or {}
    if p.get("paragraphs"):
        bits = [f"about {p['wordsPerSentence']:g} words a sentence" if p.get("wordsPerSentence") else None,
                f"speaks to the reader as \"you\" in {p['you']} of {p['paragraphs']} paragraphs" if p.get("you") else "never addresses the reader as \"you\"",
                f"contractions in {p['contractions']}" if p.get("contractions") else "no contractions",
                "no exclamation marks" if not p.get("exclaim") else f"exclamation marks in {p['exclaim']}"]
        out.append(measured("Paragraphs: " + ", ".join(b for b in bits if b), f"{p['paragraphs']} paragraphs counted; no text kept"))
    return out


def nevers(a, colors, types):
    out, sf, dep = [], a.get("surfaces") or {}, a.get("depth") or {}
    rad = a.get("radius") or {}
    est = a.get("method") == "estimated"  # a screenshot: pixels are measured; radius, depth and fonts are estimates
    shape = "estimated" if est else "measured"
    rc, rk = (rad.get("control") or {}).get("px"), (rad.get("container") or {}).get("px")
    corners = [r for r in (rc, rk) if r is not None]
    if corners and all(r == 0 for r in corners):
        out.append(dict(measured("Rounded corners", "every measured button, field and box is square"), status=shape))
    elif corners and all(isinstance(r, (int, float)) and r <= 4 for r in corners):
        out.append(dict(measured(f"Corners rounder than {max(corners):g} px", f"controls {rc} px, boxes {rk if rk is not None else 'not measured'}"), status=shape))
    if sf and not sf.get("gradients") and not est:
        out.append(measured("Gradients", "no gradient on any element" + ("; sections change with hard cuts" if sf.get("colourIsPlace") else "")))
    if dep.get("hint") in ("borders", "hard-offset") and not dep.get("shadows") and not est:
        out.append(measured("Soft drop shadows", "no blurred shadow anywhere on the page"))
    if sf:
        hexes = {c["hex"]: c for c in colors}
        pure = [h for h in ("#ffffff", "#000000") if h in hexes and (hexes[h]["area"] >= 0.001 or hexes[h]["text"] >= 0.01)]
        if not pure:
            out.append(measured("Pure white (#ffffff) or pure black (#000000)", f"the ground is {sf.get('pageBg')} and the ink is "
                                + next((c["hex"] for c in colors if any(j.startswith("ink") for j in c["jobs"])), "not pure black")))
    disp = [t for t in types if t["from"] == "heading"]
    if disp and disp[0]["weights"] and max(disp[0]["weights"]) <= 500:
        out.append(measured(f"Headlines heavier than {max(disp[0]['weights'])}", f"{disp[0]['family']} headlines are set at {', '.join(map(str, disp[0]['weights']))}"))
    v = a.get("voice") or {}
    if v and not any((v.get(k) or {}).get("emoji") for k in ("heading", "button", "nav")):
        out.append(measured("Emoji in headlines, buttons or navigation", "none in any measured headline, button or link"))
    if v and not any((v.get(k) or {}).get("exclaim") for k in ("heading", "button", "nav", "prose")):
        out.append(measured("Exclamation marks", "none in headlines, buttons, navigation or paragraphs"))
    m = a.get("motion") or {}
    if m.get("durations") and not m.get("overshoot"):
        out.append(measured("Bounce or overshoot", "no measured curve passes its end value"))
    return out


PRINCIPLE_ORDER = ["window", "place", "paper", "space", "accent", "voices", "corners", "edges", "always", "quiet", "headlines", "capitals", "dense"]


def principles(a, colors, types, comps):
    P, sf, dep, m = {}, a.get("surfaces") or {}, a.get("depth") or {}, a.get("motion") or {}
    rad = a.get("radius") or {}
    est = a.get("method") == "estimated"
    from_estimate = {"corners", "edges", "voices"} if est else set()  # read by eye from a screenshot, not measured
    if (dep.get("windowCount") or 0) >= 3:
        w = dep["windows"][0]
        P["window"] = ("Everything is a window", f"{dep['windowCount']} boxes carry a {w['bar']} title bar and {w.get('border') or 'no'} border",
                       "Boxes that read as windows make content feel like working software on a desktop, not a page of marketing.")
    worlds = [w for w in sf.get("worlds") or []]
    if sf.get("colourIsPlace") and worlds:
        P["place"] = ("Colour is a place", f"{len(sf.get('order') or [])} full-width sections, each one flat colour ("
                      + ", ".join(f"{w['hex']} {pct(w['share'])}" for w in worlds[:4]) + ")" + (", hard cuts, no gradients" if not sf.get("gradients") else ""),
                      "A flat colour per section tells you where you are before you read a word.")
    fams = [v for v in (a.get("type") or {}).get("voices") or [] if not v["system"]]
    kinds = {generic_of(v["family"], substitute(v["family"])) for v in fams}
    if len(fams) >= 2 and len(kinds) >= 2:
        P["voices"] = (f"{['', '', 'Two', 'Three', 'Four'][min(len(fams), 4)]} voices", "; ".join(f"{v['family']} for {', '.join(ROLE_NAMES.get(r, r) for r in v['roles'])}" for v in fams[:4]),
                       "The face tells you who is speaking, so the kinds of text never blur together.")
    elif len(fams) == 2:
        P["voices"] = ("A display face and a text face", f"{fams[0]['family']} and {fams[1]['family']}",
                       "One face carries personality in headlines, the other stays out of the way in running text.")
    rc = (rad.get("control") or {}).get("px")
    if rc == 0:
        P["corners"] = ("Square corners", "buttons, fields and boxes are all 0 px", "Square corners keep the grid exact and the look printed.")
    elif isinstance(rc, (int, float)) and rc <= 4:
        P["corners"] = ("Corners barely softened", f"{rc} px on controls", "A hint of rounding takes the edge off without turning soft.")
    if dep.get("hint") == "borders" and not dep.get("shadows") and (not est or (a.get("estimated") or {}).get("depth")):
        P["edges"] = ("Lines, not shadows", f"{next(iter(dep.get('borders') or {}), 'thin')} borders and no shadows", "Depth comes from lines, so the page stays flat like print.")
    elif dep.get("hint") == "hard-offset":
        P["edges"] = ("Hard shadows, no blur", ", ".join((dep.get("hard") or [])[:2]), "A solid offset reads as graphic and deliberate, never soft.")
    air, blank = a.get("air"), a.get("blankRows")
    if air is not None and (air >= 2 or (blank or 0) >= 0.35):
        P["space"] = ("A lot of empty space", f"blocks of text sit {air:g} type sizes apart; {pct(blank)} of the page height is blank",
                      "Space makes each block feel considered and gives the reader time.")
    elif air is not None and air <= 0.8 and (blank or 0) <= 0.1:
        P["dense"] = ("Packed and efficient", f"blocks of text sit {air:g} type sizes apart; {pct(blank)} of the height is blank",
                      "Many things fit on one screen, so people scan instead of scrolling.")
    if m.get("loops"):
        P["always"] = ("Something small is always running", f"{m['loops']['count']} loop(s), {m['loops']['character']}",
                       "Constant small motion makes the page feel like a machine that is switched on.")
    elif m.get("durations") and (m.get("fadesOnly") or m.get("median", 999) <= 200):
        P["quiet"] = ("Motion stays quiet", f"{m['median']:g} ms {(m.get('easings') or ['ease'])[0]}" + (", fades only" if m.get("fadesOnly") else ""),
                      "Motion only confirms a change; it never performs.")
    acc = next((c for c in colors if any(j.startswith("accent") for j in c["jobs"])), None)
    if acc and sf.get("chromaticShare") is not None and sf["chromaticShare"] < 0.05:
        P["accent"] = ("One accent, used sparingly", f"{acc['hex']} on {acc['jobs'][0].split(': ', 1)[-1]}; {pct(sf.get('chromaticShare'), 1)} of the page is in colour",
                       "Colour is rare, so where it appears it means something.")
    hr = ((a.get("summary") or {}).get("headingRatio") or {}).get("value")
    if hr and hr >= 5:
        P["headlines"] = ("Big, confident headlines", f"the largest headline is {hr:g} times the body size",
                          "One confident statement does the work of a picture.")
    bg = sf.get("pageBg")
    if bg:
        L, C, H = css_scan.oklch(bg)
        if L > 0.9 and 0.004 <= C and 40 <= H <= 110:
            P["paper"] = ("Warm paper, not white", f"the ground is {bg}", "Off-white and near-black feel printed and calm, not screen-bright.")
    nav = next((t for t in types if t["from"] == "nav"), None)
    if nav and nav.get("case") == "uppercase" and (nav.get("tracking") or 0) >= 0.05:
        P["capitals"] = ("Small tracked capitals for navigation", f"{nav['family']} {nav['sizes'][0]:g} px in capitals, tracking {nav['tracking']:g} em",
                         "Spaced capitals read as labels, so they never compete with content.")
    out = []
    for k in PRINCIPLE_ORDER:
        if k in P:
            name, fact, why = P[k]
            out.append({"key": k, "name": name, "fact": fact, "why": why, "status": "estimated" if k in from_estimate else "measured",
                        "whyStatus": "inferred", "keep": len(out) < 7})
    return out


def variables(ix):
    V = {}
    for c in ix["colors"]:
        V[c["var"]] = c["hex"]
    acc = next((c for c in ix["colors"] if any(j.startswith("accent") for j in c["jobs"])), None)
    if acc and acc["var"] != "--ti-color-accent":
        V["--ti-color-accent"] = f"var({acc['var']})"  # the accent is also a section colour: one value, two names
    seen = Counter()
    for t in ix["type"]:
        key = {"display": "display", "text": "text", "navigation": "nav", "controls": "control", "labels": "label", "small print": "small",
               "code": "code", "machine decoration": "machine"}.get(t["role"], slug(t["role"]))
        seen[key] += 1
        if seen[key] > 1:
            key = f"{key}-{seen[key]}"
        t["key"] = key
        V[f"--ti-font-{key}"] = stack(t["family"], t["substitute"], t["generic"])
        if t["sizes"]:
            V[f"--ti-size-{key}"] = f"{t['sizes'][0]:g}px"  # the size most of its text is set in
            if key == "display" and max(t["sizes"]) != t["sizes"][0]:
                V["--ti-size-display-max"] = f"{max(t['sizes']):g}px"  # the largest headline
        if t["weights"]:
            V[f"--ti-weight-{key}"] = str(t["weights"][0])
        V[f"--ti-tracking-{key}"] = f"{t['tracking'] or 0:g}em"
        if t.get("lineHeight"):
            V[f"--ti-leading-{key}"] = f"{t['lineHeight']:g}"
        if t.get("case"):
            V[f"--ti-case-{key}"] = t["case"]
    m = ix["measured"]
    rad = m.get("radius") or {}
    for role in ("control", "container"):
        r = (rad.get(role) or {}).get("px")
        if r is not None:
            V[f"--ti-radius-{role}"] = "9999px" if r == "full" else f"{r}px"
    dep = m.get("depth") or {}
    b = next(iter(dep.get("borders") or {}), None)
    if b:
        V["--ti-border-width"] = b.split()[0]
    border = next((c["hex"] for c in ix["colors"] if any("border" in j for j in c["jobs"])), None)
    if border:
        V["--ti-color-border"] = border
    for i, s in enumerate((dep.get("hard") or [])[:2]):
        V[f"--ti-shadow-hard{'' if i == 0 else '-2'}"] = s.replace(" (drawn with boxes)", "")
    minor = dep.get("hint") in ("borders", "hard-offset")  # a stray soft shadow on a look made of lines is recorded, never the default
    for i, s in enumerate((dep.get("shadows") or [])[:2]):
        V[f"--ti-shadow{'-minor' if minor else ''}{'' if i == 0 else '-2'}"] = s
    if minor or (not dep.get("shadows") and not dep.get("hard")):
        V["--ti-shadow"] = "none"
    # what a card or panel wears, by the measured depth model: its hard shadow, its soft shadow, or nothing
    V["--ti-shadow-card"] = ("var(--ti-shadow-hard)" if dep.get("hint") == "hard-offset" and dep.get("hard")
                             else "var(--ti-shadow)" if dep.get("hint") in ("shadow-ladder", "ring+faint-shadow") and dep.get("shadows") else "none")
    for f in (dep.get("frames") or [])[:1]:
        V["--ti-frame-band"] = f["band"]
    for w in (dep.get("windows") or [])[:1]:
        V["--ti-window-bar-height"] = f"{w['barHeight']}px"
    sp = m.get("space") or {}
    if sp.get("unit"):
        V["--ti-space-unit"] = f"{sp['unit']}px"
    if m.get("air") is not None:
        V["--ti-block-gap"] = f"{m['air']:g}em"
    if (m.get("layout") or {}).get("maxTextWidth"):
        V["--ti-measure"] = f"{m['layout']['maxTextWidth']}px"
    mo = ix["motion"]
    if mo.get("ui"):
        V["--ti-duration-ui"] = f"{mo['ui']['median']:g}ms"
        V["--ti-ease-ui"] = mo["ui"]["easing"]
    if mo.get("loops"):
        V["--ti-duration-loop"] = f"{mo['loops']['durations'][0]:g}ms"
        V["--ti-ease-loop"] = mo["loops"]["easings"][0]
    return V


def draft(scan, iid, tag="inspiration", picture=None, source_kind=None):
    a = scan
    colors = colour_jobs(a)
    types = type_roles(a)
    comps = components(a)
    ix = {"v": 1, "kind": "taste-index", "id": iid, "date": datetime.date.today().isoformat(), "tag": tag,
          "source": source_host(a.get("source")), "pages": a.get("pages") or 1, "method": a.get("method") or source_kind or "computed",
          "notice": NOTICE,
          "picture": {"text": picture, "status": "inferred" if picture else "missing"},
          "principles": principles(a, colors, types, comps), "colors": colors, "type": types, "components": comps,
          "motion": motion_part(a), "voice": voice_part(a), "never": nevers(a, colors, types),
          "unsure": [f"{k}: {v['confidence']} confidence ({v.get('basis') or ''})" for k, v in (a.get("summary") or {}).items()
                     if v.get("confidence") in ("low", "none")],
          "measured": {k: a.get(k) for k in ("radius", "depth", "space", "air", "blankRows", "whitespace", "layout", "surfaces") if a.get(k) is not None}}
    if a.get("method") == "estimated":
        ix["unsure"].insert(0, "everything here was read from a screenshot: sizes, radii and fonts are estimates; motion is unknown")
    ix["variables"] = variables(ix)
    return ix


# ---------- screenshots (PNG, standard library) ----------
def read_png(path):
    """(width, height, rows of (r, g, b)) for an 8-bit, non-interlaced PNG (gray, RGB, palette, with or without alpha)."""
    data = Path(path).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        sys.exit("Not a PNG. Save the screenshot as PNG (most screenshot tools do), then run this again.")
    pos, idat, plte = 8, [], None
    while pos < len(data):
        n, typ = struct.unpack(">I4s", data[pos:pos + 8])
        body = data[pos + 8:pos + 8 + n]
        if typ == b"IHDR":
            w, h, depth, ctype, _, _, interlace = struct.unpack(">IIBBBBB", body)
        elif typ == b"PLTE":
            plte = [tuple(body[i:i + 3]) for i in range(0, len(body), 3)]
        elif typ == b"IDAT":
            idat.append(body)
        pos += 12 + n
    if depth != 8 or interlace:
        sys.exit("This PNG uses 16-bit colour or interlacing. Re-save it as an ordinary 8-bit PNG.")
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[ctype]
    raw, stride, prev, rows, off = zlib.decompress(b"".join(idat)), w * ch, bytearray(w * ch), [], 0
    for _ in range(h):
        f, line = raw[off], bytearray(raw[off + 1:off + 1 + stride])
        off += 1 + stride
        if f == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 255
        elif f == 2:
            line = bytearray((x + y) & 255 for x, y in zip(line, prev))
        elif f == 3:
            for i in range(stride):
                line[i] = (line[i] + ((line[i - ch] if i >= ch else 0) + prev[i]) // 2) & 255
        elif f == 4:
            for i in range(stride):
                a_, b_, c_ = (line[i - ch] if i >= ch else 0), prev[i], (prev[i - ch] if i >= ch else 0)
                p = a_ + b_ - c_
                pa, pb, pc = abs(p - a_), abs(p - b_), abs(p - c_)
                line[i] = (line[i] + (a_ if pa <= pb and pa <= pc else b_ if pb <= pc else c_)) & 255
        prev = line
        if ctype == 3:
            rows.append([plte[i] for i in line])
        elif ctype in (0, 4):
            rows.append([(line[i], line[i], line[i]) for i in range(0, stride, ch)])
        else:
            rows.append([tuple(line[i:i + 3]) for i in range(0, stride, ch)])
    return w, h, rows


def measure_png(path, cell=16):
    """Colour area shares, the page ground, full-width bands of one colour (sections), whitespace and blank rows, from pixels."""
    w, h, rows = read_png(path)
    q = lambda p: "#%02x%02x%02x" % tuple(min(255, (c // 8) * 8 + 4) for c in p)  # merge near-identical anti-aliased shades
    exact, buckets = Counter(), {}
    cells_x, cells_y = max(1, w // cell), max(1, h // cell)
    uniform = blank_rows = 0
    band_colors = []
    for cy in range(cells_y):
        row_uniform = 0
        row_counter = Counter()
        for cx in range(cells_x):
            cc = Counter()
            for yy in range(cy * cell, min(h, cy * cell + cell), 4):
                for xx in range(cx * cell, min(w, cx * cell + cell), 4):
                    p = rows[yy][xx]
                    cc[q(p)] += 1
                    exact["#%02x%02x%02x" % p] += 1
                    buckets.setdefault(q(p), Counter())["#%02x%02x%02x" % p] += 1
            top, n = cc.most_common(1)[0]
            if n >= 0.95 * sum(cc.values()):
                uniform += 1
                row_uniform += 1
                row_counter[top] += 1
        if row_uniform >= 0.98 * cells_x:
            blank_rows += 1
        band_colors.append(row_counter.most_common(1)[0][0] if row_counter and row_counter.most_common(1)[0][1] >= 0.9 * cells_x else None)
    total = sum(exact.values())
    areas = Counter()
    for b, inner in buckets.items():
        areas[inner.most_common(1)[0][0]] += sum(inner.values()) / total
    page = areas.most_common(1)[0][0]
    sections, run = [], None
    for i, c in enumerate(band_colors + [None]):
        rep_ = buckets[c].most_common(1)[0][0] if c else None
        if run and rep_ == run["hex"]:
            run["h"] += cell
            continue
        if run and run["h"] >= 160:
            sections.append(run)
        run = {"hex": rep_, "y": i * cell, "h": cell} if rep_ else None
    return {"grid": cell, "pageBg": page, "areas": {k: round(v, 3) for k, v in areas.most_common(16) if v >= 0.001}, "text": {}, "textShare": 0,
            "sections": [s for s in sections if s["h"] < 0.9 * h], "imagery": None, "whitespace": round(uniform / (cells_x * cells_y), 3),
            "blankRows": round(blank_rows / cells_y, 3), "air": None, "gradients": 0, "size": [w, h]}


ESTIMATES = {"radius": ("radius", "mostCommon"), "body": ("bodySize", None), "depth": ("depth", "hint"), "font": ("type", "families"),
             "heading": ("headingRatio", None)}


def cmd_screenshot(png, iid, estimates, project, tag):
    """A screenshot as a reference file (kind "screenshot") that engine.py intake reads: colours, areas, sections and space are
    measured from the pixels; radius, body size, depth and fonts are the agent's estimates, marked estimated."""
    surf = measure_png(png)
    w, h = surf.pop("size")
    cap = {"method": "estimated", "kind": "screenshot", "tag": tag, "source": Path(png).name, "surfaces": surf,
           "values": {"colors": {k: max(1, round(v * 1000)) for k, v in surf["areas"].items()}},
           "layout": {"docHeight": h}, "viewport": [w, h]}
    a = css_scan.analyse(cap)
    a.update({"kind": "screenshot", "tag": tag, "id": iid, "method": "estimated",
              "estimated": {}, "note": "colours, areas, sections and space were measured from the pixels; everything else is an estimate"})
    for e in estimates:
        k, _, v = e.partition("=")
        if k in ("radius", "body") and v != "full" and not re.fullmatch(r"\d+(\.\d+)?", v):
            sys.exit(f"--estimate {k}= takes a number of pixels" + (" or full" if k == "radius" else "") + f", not {v!r}.")
        if k == "accent" and not css_scan.hex_norm(v if v.startswith("#") else "#" + v):
            sys.exit(f"--estimate accent= takes a hex colour such as #0f766e, not {v!r}.")
        if k == "accent" and not v.startswith("#"):
            v = "#" + v
        if k == "radius":
            a["radius"] = {"mostCommon": "full" if v == "full" else float(v), "control": {"px": "full" if v == "full" else float(v), "confidence": "low"}}
        elif k == "body":
            a["bodySize"] = float(v)
            a.setdefault("type", {})["body"] = {"px": float(v), "confidence": "low"}
        elif k == "depth":
            a["depth"] = {**(a.get("depth") or {}), "hint": v, "confidence": "low"}
        elif k == "font":
            a.setdefault("type", {}).setdefault("families", []).append(v)
        elif k == "accent":
            h = css_scan.hex_norm(v)
            L, C, H = css_scan.oklch(h)
            a["color"]["accents"] = [{"hex": h, "count": 1, "oklch": [L, C, H], "sources": {"estimated": 1}, "score": 0}]
        else:
            sys.exit(f"Unknown estimate {k}. Use radius=, body=, depth=borders|hard-offset|shadow-ladder, font=, accent=#hex")
        a["estimated"][k] = v
    a["summary"] = css_scan.summarize(a)
    out = od_dir(project) / "references" / f"{iid}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(a, indent=1) + "\n", encoding="utf-8")
    print(f"wrote {out} (kind screenshot): page {surf['pageBg']}, {len(surf['areas'])} colours, {len(a['surfaces']['order'])} section band(s), "
          f"{pct(surf['whitespace'])} whitespace, {pct(surf['blankRows'])} blank rows")
    print("Next: engine.py intake " + str(out) + "   or   taste_index.py draft " + str(out) + f" --id {iid}")
    return out


# ---------- rendering ----------
def mark(status):
    return {"measured": "measured", "inferred": "inferred", "missing": "not written yet", "estimated": "estimated"}.get(status, status)


def render_md(ix):
    kept = [p for p in ix["principles"] if p.get("keep")]
    pic = ix["picture"]
    L = [f"# Taste Index: {ix['id']}", "",
         f"> {ix['notice']}", "",
         f"Measured from {ix.get('source') or 'a screenshot'} ({ix['pages']} page{'s' * (ix['pages'] != 1)}, {ix['method']}) on {ix['date']}; "
         "the source is named only to say where the values came from, never as part of the look. "
         "Every line says whether it was **measured** or **inferred** (judgement, rewrite it in your words if it is wrong).", "",
         "## The picture", "", (f"{pic['text']} *({mark(pic['status'])})*" if pic.get("text") else "*Not written yet: one line, a picture rather than adjectives.*"), "",
         "## Principles", ""]
    for i, p in enumerate(kept, 1):
        L.append(f"{i}. **{p['name']}.** {p['fact']} *({mark(p['status'])})*. Why: {p['why']} *({mark(p['whyStatus'])})*")
    dropped = [p["name"] for p in ix["principles"] if not p.get("keep")]
    if dropped:
        L += ["", "Also found, not kept: " + "; ".join(dropped) + f". (`taste_index.py set {ix['id']} principles` numbers them all.)"]
    L += ["", "## Colour", "", "| Swatch | Variable | Job | Page area | Of the text | |", "|---|---|---|---|---|---|"]
    for c in ix["colors"]:
        L.append(f"| `{c['hex']}` {c['name']} | `{c['var']}` | {'; '.join(c['jobs'])} | {pct(c['area'], 1)} | {pct(c['text'], 1)} | {mark(c['status'])} |")
    L += ["", "## Type", "", "| Role | Exact face | Free substitute | Licence | Weights | Sizes | Tracking | Case | Line height |", "|---|---|---|---|---|---|---|---|---|"]
    for t in ix["type"]:
        L.append(f"| {t['role']} | {t['family']} | {t['substitute'] or 'system'} | {t['licence']} | {', '.join(map(str, t['weights'])) or '-'} | "
                 f"{', '.join(f'{s:g}' for s in t['sizes']) or '-'} px | {t['tracking'] or 0:g} em | {t['case'] or 'as written'} | {t['lineHeight'] or '-'} |")
    L += ["", "Fonts are named, never shipped. A face whose licence is \"not known\" needs your own licence before you use it; otherwise use the substitute.", "",
          "## Components", ""]
    L += [f"- **{c['name'].capitalize()}:** {c['rule']} *({mark(c['status'])})*" for c in ix["components"]] or ["- None measured."]
    mo = ix["motion"]
    L += ["", "## Motion", ""]
    if mo["feeling"].get("text"):
        L.append(f"**{mo['feeling']['text']}** *({mark(mo['feeling']['status'])})*")
        L.append("")
    L += [f"- {r['rule']} *({mark(r['status'])}: {r['basis']})*" for r in mo["rules"]]
    L += ["", "## Voice", "", "Measured from counts only: no sentence from the site is kept.", ""]
    L += [f"- {r['rule']} *({mark(r['status'])})*" for r in ix["voice"]] or ["- Not measured (a screenshot has no text to count)."]
    L += ["", "## Never", ""]
    L += [f"- **{n['rule']}.** {n.get('basis') or ''} *({mark(n['status'])})*" for n in ix["never"]] or ["- Nothing measured yet."]
    L += ["", "## Variables", "", "Every value above is a variable in `taste.css`; the component classes use only these. `specimen.html` shows them live.", "",
          "```css", ":root {"] + [f"  {k}: {v};" for k, v in ix["variables"].items()] + ["}", "```", ""]
    if ix["unsure"]:
        L += ["## What I was not sure about", ""] + [f"- {u}" for u in ix["unsure"]] + [""]
    L += ["## For your AGENTS.md or CLAUDE.md", "", "```", agents_line(ix), "```", ""]
    return "\n".join(L)


def agents_line(ix):
    return (f"Before building any page, component or animation, read opendesigner/taste-indexes/{ix['id']}/TASTE-INDEX.md and use "
            f"opendesigner/taste-indexes/{ix['id']}/taste.css; follow its principles and Never list, and ask before going against one.")


def css_for(ix):
    V = ix["variables"]
    has = lambda k: k in V
    lines = ["/* Taste Index: " + ix["id"] + ". Every value is a variable; the classes below use only these variables.",
             "   " + ix["notice"].replace("*/", "") + " */", ":root {"]
    lines += [f"  {k}: {v};" for k, v in V.items()]
    lines.append("}")
    font = lambda k, fb: f"var(--ti-font-{k})" if has(f"--ti-font-{k}") else fb
    text_font = font("text", "system-ui, sans-serif")
    ink = "var(--ti-color-ink)" if has("--ti-color-ink") else "currentColor"
    ground = "var(--ti-color-ground)" if has("--ti-color-ground") else "Canvas"
    edge = f"var(--ti-border-width, 0px) solid var(--ti-color-border, {ink})"  # no measured border, no border
    rc = "var(--ti-radius-control, 0px)"
    ui = "var(--ti-duration-ui, 0ms) var(--ti-ease-ui, ease)"
    btn = next((c["values"] for c in ix["components"] if c.get("kind") == "button"), {})
    chip = next((c["values"] for c in ix["components"] if c.get("kind") == "chip"), {})
    nav = next((c["values"] for c in ix["components"] if c.get("kind") == "nav"), {})
    link = next((c["values"] for c in ix["components"] if c.get("kind") == "link"), {})
    win = next((c["values"] for c in ix["components"] if c["name"] == "window"), {})
    lines += [
        f".ti {{ background: {ground}; color: {ink}; font-family: {text_font}; font-size: var(--ti-size-text, 16px);"
        f" line-height: var(--ti-leading-text, 1.5); letter-spacing: var(--ti-tracking-text, 0); }}",
        f".ti-display {{ font-family: {font('display', text_font)}; font-size: var(--ti-size-display, 48px); font-weight: var(--ti-weight-display, 600);"
        f" letter-spacing: var(--ti-tracking-display, 0); line-height: var(--ti-leading-display, 1.05); text-transform: var(--ti-case-display, none); margin: 0; }}",
        f".ti-button {{ font: inherit; font-family: {font('control', text_font)}; display: inline-flex; align-items: center; min-height: 24px;"
        f" {'height: ' + str(btn['height']) + 'px; ' if btn.get('height') else ''}padding: 0 {btn.get('padX') or 12}px; border-radius: {rc};"
        f" background: {btn.get('bg') or 'transparent'}; color: {btn.get('text') or ink};"
        f" border: {(btn.get('border').split()[0] + ' solid ' + btn.get('border').split()[1]) if btn.get('border') else '0'};"
        f" font-size: {btn.get('size') or 16}px; font-weight: {btn.get('weight') or 500}; text-transform: {btn.get('case') or 'none'};"
        f" letter-spacing: {btn.get('tracking') or 0}em; cursor: pointer; transition: background-color {ui}, color {ui}, border-color {ui}, opacity {ui}; }}",
        ".ti-button:hover { opacity: .82; }",
        ".ti-button:focus-visible, .ti-link:focus-visible { outline: 2px solid var(--ti-color-accent, currentColor); outline-offset: 2px; }",
        f".ti-link {{ color: {link.get('color') or 'var(--ti-color-accent, currentColor)'}; text-decoration: {'underline' if link.get('underline', True) else 'none'};"
        f" text-underline-offset: .2em; transition: color {ui}, opacity {ui}; }}",
        ".ti-link:hover { opacity: .7; }",
        f".ti-chip {{ display: inline-block; background: {chip.get('bg') or 'var(--ti-color-ink, #111)'}; color: {chip.get('text') or ground};"
        f" font-family: {font('label', text_font)}; font-size: {chip.get('size') or 12}px; padding: 2px 6px; border-radius: {rc};"
        f" text-transform: {chip.get('case') or 'none'}; letter-spacing: {chip.get('tracking') or 0}em; }}",
        f".ti-nav {{ font-family: {font('nav', text_font)}; font-size: {nav.get('size') or 14}px; font-weight: {nav.get('weight') or 400};"
        f" text-transform: {nav.get('case') or 'none'}; letter-spacing: {nav.get('tracking') or 0}em; color: {nav.get('color') or ink}; text-decoration: none; }}",
        f".ti-card {{ background: {ground}; border: {edge}; border-radius: var(--ti-radius-container, {rc}); box-shadow: var(--ti-shadow-card, none); padding: 16px; }}",
        f".ti-window {{ border: {edge}; border-radius: var(--ti-radius-container, 0); background: {win.get('body') or ground};"
        f" box-shadow: var(--ti-shadow-card, none); overflow: hidden; }}",
        f".ti-window__bar {{ background: {win.get('bar') or ink}; color: {ground}; height: var(--ti-window-bar-height, 24px); display: flex; align-items: center;"
        f" padding: 0 8px; font-family: {font('control', font('code', font('machine', text_font)))}; font-size: 13px; }}",
        f".ti-window__body {{ margin: 0 var(--ti-frame-band, 0) var(--ti-frame-band, 0); background: {ground}; border: {edge}; border-top: 0; padding: 12px; }}",
        f".ti-mono {{ font-family: {font('code', font('machine', 'ui-monospace, monospace'))}; }}",
        "@keyframes ti-loop { 0%, 49% { opacity: 1; } 50%, 100% { opacity: .15; } }",
        ".ti-loop { animation: ti-loop var(--ti-duration-loop, 2000ms) var(--ti-ease-loop, linear) infinite; }",
        "@media (prefers-reduced-motion: reduce) { .ti-loop { animation: none; } .ti * { transition-duration: 0ms !important; } }"]
    for i, c in enumerate([c for c in ix["colors"] if any(j.startswith(("world", "ground")) for j in c["jobs"])], 1):
        L_ = c["oklch"][0]
        lines.append(f".ti-world-{i} {{ background: var({c['var']}); color: {'#ffffff' if L_ < 0.55 else ink}; }}")
    return "\n".join(lines) + "\n"


def contrast_text(h):
    return "#ffffff" if css_scan.oklch(h)[0] < 0.6 else "#111111"


def specimen(ix):
    e = html.escape
    kept = [p for p in ix["principles"] if p.get("keep")]
    worlds = [c for c in ix["colors"] if any(j.startswith(("world", "ground")) for j in c["jobs"])]
    sw = "".join(
        f'<figure class="sw"><div class="chip-swatch" style="background:{c["hex"]};color:{contrast_text(c["hex"])}">{c["hex"]}</div>'
        f'<figcaption><b>{e(c["name"])}</b><br>{e("; ".join(c["jobs"]))}<br><span class="dim">page {pct(c["area"], 1)} · text {pct(c["text"], 1)} · '
        f'<code>{c["var"]}</code> · {mark(c["status"])}</span><div class="bar"><i style="width:{min(100, max(0.5, c["area"] * 100)):.1f}%;background:{c["hex"]}"></i></div></figcaption></figure>'
        for c in ix["colors"])
    types = "".join(
        f'<div class="type-row"><div class="dim">{e(t["role"])} · {e(t["family"])} → free: {e(t["substitute"] or "system")} · licence {e(t["licence"])} · '
        f'{", ".join(f"{s:g}" for s in t["sizes"])} px · weight {", ".join(map(str, t["weights"])) or "-"} · {mark(t["status"])}</div>'
        f'<div style="font-family:var(--ti-font-{t["key"]});font-size:clamp(14px,{min(t["sizes"][0] if t["sizes"] else 16, 96):g}px,12vw);'
        f'font-weight:var(--ti-weight-{t["key"]},400);letter-spacing:var(--ti-tracking-{t["key"]},0);text-transform:var(--ti-case-{t["key"]},none);line-height:1.1">'
        f'Measured, named, never shipped 0123456789</div></div>' for t in ix["type"])
    comp_list = "".join(f"<li><b>{e(c['name'].capitalize())}:</b> {e(c['rule'])} <span class='dim'>({mark(c['status'])})</span></li>" for c in ix["components"])
    mo = ix["motion"]
    win_demo = ('<div class="ti-window" style="max-width:360px"><div class="ti-window__bar"><span class="ti-loop">■</span>&nbsp; window</div>'
                '<div class="ti-window__body">A box with a title bar, as measured.</div></div>') if any(c["name"] == "window" for c in ix["components"]) else ""
    nev = "".join(f"<li><b>{e(n['rule'])}.</b> {e(n.get('basis') or '')} <span class='dim'>({mark(n['status'])})</span></li>" for n in ix["never"])
    vo = "".join(f"<li>{e(r['rule'])} <span class='dim'>({mark(r['status'])})</span></li>" for r in ix["voice"])
    var_rows = "".join(f"<tr><td><code>{e(k)}</code></td><td><code>{e(v)}</code></td></tr>" for k, v in ix["variables"].items())
    worlds_html = "".join(f'<div class="ti-world-{i}" style="padding:20px 16px">{e(c["name"])} {c["hex"]}: {e(c["jobs"][0])}</div>'
                          for i, c in enumerate(worlds, 1))
    pic = ix["picture"]
    link = next((c["values"] for c in ix["components"] if c.get("kind") == "link"), {})
    link_bg = ' class="on-ink"' if link.get("color") and css_scan.oklch(link["color"])[0] > 0.6 else ""
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Taste Index: {e(ix['id'])}</title>
<link rel="stylesheet" href="taste.css">
<style>
 body {{ margin: 0; }}
 .wrap {{ max-width: 1100px; margin: 0 auto; padding: 32px 16px 80px; overflow-wrap: anywhere; }}
 h1.ti-display {{ font-size: min(var(--ti-size-display-max, var(--ti-size-display, 96px)), 14vw); }}
 .on-ink {{ background: var(--ti-color-ink, #111); padding: 4px 8px; }}
 section {{ margin: 48px 0; }}
 h2 {{ font-family: var(--ti-font-display, inherit); font-size: 28px; margin: 0 0 16px; }}
 .dim {{ opacity: .68; font-size: 13px; }}
 .notice {{ border: 1px solid currentColor; padding: 12px 14px; font-size: 14px; margin: 16px 0; }}
 .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }}
 .sw {{ margin: 0; }} .chip-swatch {{ height: 84px; display: flex; align-items: flex-end; padding: 8px; font: 13px ui-monospace, monospace; border: 1px solid rgba(0,0,0,.12); }}
 .sw figcaption {{ font-size: 13px; padding-top: 6px; }} .bar {{ height: 4px; background: rgba(0,0,0,.08); margin-top: 6px; }} .bar i {{ display: block; height: 4px; }}
 .type-row {{ padding: 16px 0; border-bottom: 1px solid rgba(0,0,0,.12); overflow-wrap: anywhere; }}
 ol li, ul li {{ margin: 8px 0; }} table {{ border-collapse: collapse; font-size: 13px; }} td {{ padding: 4px 12px 4px 0; vertical-align: top; }}
 .row {{ display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }}
 pre {{ white-space: pre-wrap; font-size: 13px; }}
</style></head>
<body class="ti"><div class="wrap">
<p class="dim">Taste Index · measured from {e(str(ix.get('source') or 'a screenshot'))} · {ix['pages']} page(s) · {e(ix['date'])}</p>
<h1 class="ti-display">{e(ix['id'])}</h1>
<p style="font-size:20px;max-width:var(--ti-measure,680px)">{e(pic['text']) if pic.get('text') else '<i>The picture is not written yet.</i>'} <span class="dim">({mark(pic['status'])})</span></p>
<div class="notice">{e(ix['notice'])}</div>
<section><h2>Principles</h2><ol>{''.join(f"<li><b>{e(p['name'])}.</b> {e(p['fact'])} <span class='dim'>(measured)</span><br>Why: {e(p['why'])} <span class='dim'>({mark(p['whyStatus'])})</span></li>" for p in kept)}</ol></section>
<section><h2>Colour</h2><div class="grid">{sw}</div><div style="margin-top:16px">{worlds_html}</div></section>
<section><h2>Type</h2>{types}</section>
<section><h2>Components</h2><div class="row"><button class="ti-button">Button</button><span{link_bg}><a class="ti-link" href="#">A link in text</a></span>
<span class="ti-chip">Label</span><a class="ti-nav" href="#">Navigation</a></div>
<div class="row" style="margin-top:16px"><div class="ti-card" style="width:260px">A card, as measured.</div>{win_demo}</div><ul>{comp_list}</ul></section>
<section><h2>Motion</h2><p><b>{e(mo['feeling'].get('text') or 'No motion measured.')}</b> <span class="dim">({mark(mo['feeling']['status'])})</span></p>
<p class="row"><button class="ti-button">Hover me: the measured interface timing</button> <span class="ti-loop ti-mono">■ a loop on the measured timing</span></p>
<ul>{''.join(f"<li>{e(r['rule'])} <span class='dim'>({mark(r['status'])})</span></li>" for r in mo['rules'])}</ul></section>
<section><h2>Voice</h2><ul>{vo or '<li>Not measured.</li>'}</ul></section>
<section><h2>Never</h2><ul>{nev or '<li>Nothing measured yet.</li>'}</ul></section>
<section><h2>Variables</h2><table>{var_rows}</table></section>
<section><h2>For your AGENTS.md or CLAUDE.md</h2><pre>{e(agents_line(ix))}</pre></section>
</div></body></html>
"""


# ---------- check ----------
def check(ix):
    errs, warns = [], []
    kept = [p for p in ix["principles"] if p.get("keep")]
    if not 5 <= len(kept) <= 7:
        (errs if not kept else warns).append(f"{len(kept)} principle(s) kept: the index needs 5 to 7 (taste_index.py set {ix['id']} principle N --keep|--drop)")
    for p in kept:
        if not p.get("why"):
            errs.append(f"principle '{p['name']}' has no why")
    if not (ix.get("picture") or {}).get("text"):
        warns.append(f"the picture is not written: taste_index.py set {ix['id']} picture \"one line, a picture rather than adjectives\"")
    for c in ix["colors"]:
        if not c.get("jobs") or c.get("area") is None:
            errs.append(f"colour {c['hex']} has no job or share")
    if not ix["colors"]:
        errs.append("no colours")
    for t in ix["type"]:
        if t["licence"] == "not known" and not t.get("substitute"):
            errs.append(f"{t['family']} has no free substitute")
    if not ix["type"]:
        warns.append("no type roles (a screenshot names fonts only by estimate)")
    if not ix["never"]:
        errs.append("the Never list is empty")
    for group in ("principles", "components", "voice", "never"):
        for item in ix[group]:
            if item.get("status") not in ("measured", "inferred", "estimated"):
                errs.append(f"{group}: an item is not marked measured, inferred or estimated")
    if ix.get("notice") != NOTICE:
        errs.append("the responsibility notice is missing or changed")
    banned = ("logo", "wordmark")
    for k in ix["variables"]:
        if any(b in k for b in banned):
            errs.append(f"variable {k} names an identity asset")
    if len(json.dumps(ix.get("voice"))) > 4000:
        errs.append("the voice section is too long: it should hold counts, never the site's sentences")
    return errs, warns


# ---------- commands ----------
def register(project, iid, scan_path, tag):
    """The index as a reference in state.json, so taste.py reads its dials as inspiration evidence (engine.py intake)."""
    eng = engine()
    d = od_dir(project)
    if not eng or not (d / "state.json").exists():
        return None
    ref = json.loads(Path(scan_path).read_text(encoding="utf-8"))
    ref["tag"], ref["id"] = tag, iid
    tmp = index_dir(project, iid) / "measured.json"
    tmp.write_text(json.dumps(ref, indent=1) + "\n", encoding="utf-8")
    with contextlib.redirect_stdout(io.StringIO()):
        fit = eng.cmd_intake(str(d), str(tmp), accept=False, as_json=True)
    state = eng.merge_defaults(eng.read_json(str(d / "state.json")))
    if iid in (state.get("references") or {}):
        state["references"][iid]["index"] = True
        eng.dump_json(str(d / "state.json"), state)
    return {p["path"]: p["value"] for p in fit["proposals"]}


def cmd_draft(scan_path, iid, tag, picture, project):
    if not ID_RE.match(iid):
        sys.exit("Give the index a short name for the look, not the brand: lowercase letters, digits and hyphens (for example retro-os).")
    scan = json.loads(Path(scan_path).read_text(encoding="utf-8"))
    if "summary" not in scan:
        sys.exit("That file is not css_scan.py --json output. Run css_scan.py --from-json page.json --json > scan.json first.")
    ix = draft(scan, iid, tag, picture, scan.get("kind"))
    p = index_dir(project, iid)
    if (p / "index.json").exists():  # drafting again (new pages, say): keep what was written by hand
        old = json.loads((p / "index.json").read_text(encoding="utf-8"))
        if not picture and (old.get("picture") or {}).get("text"):
            ix["picture"] = old["picture"]
        fresh = {x["key"]: x for x in ix["principles"]}
        for q in old.get("principles") or []:
            if q.get("key") in fresh:
                fresh[q["key"]]["why"], fresh[q["key"]]["keep"] = q.get("why") or fresh[q["key"]]["why"], q.get("keep", True)
        ix["never"] += [n for n in old.get("never") or [] if n.get("status") == "inferred" and n not in ix["never"]]
        if (old.get("motion") or {}).get("feeling", {}).get("text") not in (None, ix["motion"]["feeling"]["text"]):
            ix["motion"]["feeling"] = old["motion"]["feeling"]
        print(f"{iid} already existed: kept its picture, reasons, kept principles and hand-written Never items.")
    p.mkdir(parents=True, exist_ok=True)
    (p / "measured.json").write_text(json.dumps(scan, indent=1) + "\n", encoding="utf-8")
    dials = register(project, iid, p / "measured.json", tag)
    eng = engine()
    if dials is None and eng:
        dials = {p_["path"]: p_["value"] for p_ in eng.fit_reference({**scan, "tag": tag})["proposals"]}
    ix["dials"] = {k.removeprefix("dials."): v for k, v in (dials or {}).items() if k.startswith("dials.")}
    save_index(project, ix)
    cmd_build(iid, project, quiet=True)
    kept = [x for x in ix["principles"] if x["keep"]]
    print(f"Drafted taste index {iid} in {p}")
    print(f"  {len(ix['colors'])} colours with jobs, {len(ix['type'])} type roles, {len(ix['components'])} components, "
          f"{len(ix['motion']['rules'])} motion rules, {len(ix['voice'])} voice rules, {len(ix['never'])} Never items, {len(ix['variables'])} variables")
    print(f"  {len(kept)} principle(s) kept of {len(ix['principles'])} found: " + "; ".join(x["name"] for x in kept))
    print("  dials (inspiration evidence for taste.py): " + ", ".join(f"{k} {v}" for k, v in ix["dials"].items())
          + ("" if (od_dir(project) / "state.json").exists() else "  (no design system here yet: they join the taste index at the first build after engine.py sketch)"))
    print("Now: look at the pages, write the picture, rewrite each why that is wrong, add inferred Never items, then build and check.")
    print("Notice to show the person when you present it: " + NOTICE)


def _nth(items, raw, what):
    """Item N (1-based) of a list, or a plain error: principles are numbered in full, kept or not (`taste_index.py set ID principles`)."""
    try:
        n = int(raw)
    except (TypeError, ValueError):
        sys.exit(f"Give the number of the {what}.")
    if not 1 <= n <= len(items):
        sys.exit(f"There is no {what} {n}: there are {len(items)}.")
    return items[n - 1]


def cmd_set(iid, field, rest, project, drop=None, keep=None, inferred=True):
    ix = load_index(project, iid)
    text = " ".join(rest[1:] if field == "why" else rest).strip()
    if field == "principles":  # print the numbering the other commands use
        for i, p in enumerate(ix["principles"], 1):
            print(f"{i}. [{'kept' if p.get('keep') else 'dropped'}] {p['name']}: {p['fact']}")
        return
    if field in ("picture", "why", "feeling") and not text:
        sys.exit(f"Write the {field} in quotes after the command.")
    if field == "picture":
        ix["picture"] = {"text": text, "status": "inferred"}
    elif field == "why":
        p = _nth(ix["principles"], rest[0] if rest else None, "principle")
        p["why"], p["whyStatus"] = text, "inferred"
    elif field == "principle":
        p = _nth(ix["principles"], rest[0] if rest else None, "principle")
        p["keep"] = bool(keep) or not drop
    elif field == "never":
        if drop is not None:
            ix["never"].remove(_nth(ix["never"], drop, "Never item"))
        elif not text:
            sys.exit("Write the Never item in quotes, or --drop N to remove one.")
        else:  # written by hand from looking at the pages: judgement, so inferred
            ix["never"].append({"rule": text.rstrip("."), "basis": "judgement from looking at the pages", "status": "inferred"})
    elif field == "feeling":
        ix["motion"]["feeling"] = {"text": text, "status": "inferred"}
    else:
        sys.exit("set takes: picture, principles, why N, principle N --keep|--drop, never \"...\" | never --drop N, feeling")
    save_index(project, ix)
    cmd_build(iid, project, quiet=True)
    print(f"updated {iid}: {field}")


def cmd_build(iid, project, quiet=False):
    ix = load_index(project, iid)
    sp, measured_file = od_dir(project) / "state.json", index_dir(project, iid) / "measured.json"
    if sp.exists() and measured_file.exists() and iid not in (json.loads(sp.read_text(encoding="utf-8")).get("references") or {}):
        dials = register(project, iid, measured_file, ix.get("tag", "inspiration"))  # drafted before the system existed
        if dials and not ix.get("dials"):
            ix["dials"] = {k.removeprefix("dials."): v for k, v in dials.items() if k.startswith("dials.")}
    ix["variables"] = variables(ix)
    save_index(project, ix)
    p = index_dir(project, iid)
    (p / "TASTE-INDEX.md").write_text(render_md(ix), encoding="utf-8")
    (p / "taste.css").write_text(css_for(ix), encoding="utf-8")
    (p / "specimen.html").write_text(specimen(ix), encoding="utf-8")
    errs, warns = check(ix)
    if not quiet:
        print(f"built {p}: TASTE-INDEX.md, taste.css ({len(ix['variables'])} variables), specimen.html")
        for w in warns:
            print("  to do: " + w)
        if any("principle" in x for x in warns + errs):
            cmd_set(iid, "principles", [], project)
        for e_ in errs:
            print("  error: " + e_)
        print("Show the person: " + NOTICE)
        print("One line for AGENTS.md or CLAUDE.md (add it only after they choose this index): " + agents_line(ix))
    return 1 if errs else 0


def cmd_check(iid, project):
    errs, warns = check(load_index(project, iid))
    for w in warns:
        print("warning: " + w)
    for e_ in errs:
        print("error: " + e_)
    print(f"{iid}: {len(errs)} error(s), {len(warns)} warning(s)")
    return 1 if errs else 0


def cmd_list(project):
    root = od_dir(project) / "taste-indexes"
    follows = None
    sp = od_dir(project) / "state.json"
    if sp.exists():
        follows = (json.loads(sp.read_text(encoding="utf-8")).get("tasteIndex") or {}).get("follows")
    items = sorted(root.glob("*/index.json")) if root.exists() else []
    if not items:
        print("No taste indexes yet. Measure a site you love (read_page.js, css_scan.py), then taste_index.py draft.")
        return
    for f in items:
        ix = json.loads(f.read_text(encoding="utf-8"))
        print(f"{'*' if ix['id'] == follows else ' '} {ix['id']:20s} {ix.get('source') or 'screenshot'}  ({ix['date']}, {ix['tag']})"
              + ("  <- the system follows this one" if ix["id"] == follows else ""))
    if not follows:
        print("The system follows none yet. Ask the person which one (or none); never pick for them.")


def cmd_use(iid, fonts, project):
    """The person chose this index: the system follows it. Its dials, its accent as the brand colour and its fonts (exact names or
    the free substitutes, as they chose) are recorded with set_by reference and the index as the source."""
    if fonts not in ("exact", "free"):
        sys.exit("Ask the person first: keep the exact fonts (they need their own licence; nothing is downloaded) or use the free substitutes? "
                 "Then pass --fonts exact or --fonts free.")
    ix = load_index(project, iid)
    eng = engine()
    d = od_dir(project)
    if not eng or not (d / "state.json").exists():
        sys.exit("No design system here yet: run engine.py sketch first, then use the index.")
    applied, skipped = [], []

    def put(path, value, why):
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                eng.cmd_set(str(d), path, value, why=why, set_by="reference", source_ref=iid, quiet=True)
            applied.append(path)
        except SystemExit as ex:
            skipped.append(f"{path}: {str(ex).splitlines()[0]}")
    for k, v in (ix.get("dials") or {}).items():
        put(f"dials.{k}", v, f"from taste index {iid} (measured)")
    acc = next((c for c in ix["colors"] if any(j.startswith("accent") for j in c["jobs"])), None)
    if acc:
        put("raw.brandColor", acc["hex"], f"the accent of taste index {iid}, kept exact as first presented (the person's call and responsibility)")
    face = lambda frm: next((t for t in ix["type"] if t["from"] == frm), None)
    for frm, path in (("body", "raw.textFace"), ("heading", "raw.displayFace"), ("code", "raw.monoFace")):
        t = face(frm) or (face("noise") if frm == "code" else None)
        if not t or t["licence"] == "system":
            continue
        name = t["family"] if fonts == "exact" else t["substitute"]
        value = [name, t["substitute"]] if fonts == "exact" and t["substitute"] and t["substitute"] != name else name
        put(path, value, f"{t['role']} face of taste index {iid} ({'exact name, never shipped' if fonts == 'exact' else 'free substitute'})")
    state = eng.merge_defaults(eng.read_json(str(d / "state.json")))
    state["tasteIndex"] = {"follows": iid, "fonts": fonts, "date": datetime.date.today().isoformat(), "set_by": "chosen",
                           "file": f"opendesigner/taste-indexes/{iid}/TASTE-INDEX.md"}
    eng.dump_json(str(d / "state.json"), state)
    print(f"The system now follows taste index {iid} ({len(applied)} value(s) recorded from it; fonts: {fonts}).")
    for s_ in skipped:
        print("  not changed: " + s_)
    print("Run engine.py build to regenerate the system. DESIGN.md will point every agent at the index.")
    print("Remind the person: " + NOTICE)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--project", default=".", help="the person's project folder (holds opendesigner/)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("draft")
    d.add_argument("scan")
    d.add_argument("--id", required=True)
    d.add_argument("--tag", default="inspiration", choices=["inspiration", "our-product"])
    d.add_argument("--picture")
    s = sub.add_parser("screenshot")
    s.add_argument("png")
    s.add_argument("--id", required=True)
    s.add_argument("--tag", default="inspiration", choices=["inspiration", "our-product"])
    s.add_argument("--estimate", action="append", default=[])
    st = sub.add_parser("set")
    st.add_argument("id")
    st.add_argument("field")
    st.add_argument("rest", nargs="*")
    st.add_argument("--drop", nargs="?", const="yes", help="principle N --drop, or never --drop N")
    st.add_argument("--keep", action="store_true")
    st.add_argument("--inferred", action="store_true", help="accepted for clarity: a Never item written by hand is always inferred")
    for name in ("build", "check"):
        sub.add_parser(name).add_argument("id")
    sub.add_parser("list")
    u = sub.add_parser("use")
    u.add_argument("id")
    u.add_argument("--fonts")
    a = ap.parse_args()
    if a.cmd == "draft":
        cmd_draft(a.scan, a.id, a.tag, a.picture, a.project)
    elif a.cmd == "screenshot":
        cmd_screenshot(a.png, a.id, a.estimate, a.project, a.tag)
    elif a.cmd == "set":
        if a.field == "never" and a.drop == "yes":
            sys.exit("never --drop takes the number of the item to remove (TASTE-INDEX.md lists them in order).")
        drop = (a.drop is not None) if a.field == "principle" else a.drop
        cmd_set(a.id, a.field, a.rest, a.project, drop=drop, keep=a.keep)
    elif a.cmd == "build":
        sys.exit(cmd_build(a.id, a.project))
    elif a.cmd == "check":
        sys.exit(cmd_check(a.id, a.project))
    elif a.cmd == "list":
        cmd_list(a.project)
    elif a.cmd == "use":
        cmd_use(a.id, a.fonts, a.project)


if __name__ == "__main__":
    main()
