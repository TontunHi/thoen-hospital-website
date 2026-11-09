#!/usr/bin/env python3
"""The taste poll: a library of real screens, the poll page built from it, and its results read back.

    python3 taste.py build [--project NAME] [--out opendesigner/preview/taste-poll] [--min 20] [--max 30] [--open]
    python3 taste.py coverage            where the library is thin (which dial ends, which kinds)
    python3 taste.py check               validate the library (CI); missing images are listed, not errors
    python3 taste.py add entries.json    add screens fetched on the spot (see "Adding screens" below)
    python3 taste.py import [FILE|-]     read the "OD:set taste.poll=..." line, write opendesigner/taste-profile.json,
                                         record taste.poll in state, build the taste index and print the dial recommendations
    python3 taste.py index [--json]      merge every taste signal in this project into opendesigner/taste-profile.json:
                                         the poll, the person's own decisions, inspirations, the style pick, feel words
    python3 taste.py fit OPTIONS|-       order options (a list with "dials", or an option-gallery payload) by fit; leave out
                                         any past a red line on a dial they differ on (all past one: keep all, warn)

The library (assets/taste/library.json) lists each screen: its source link, kind, platform, eight dial positions
(expression, brandPresence, density, energy, roundness, depth, colorfulness, warmth; 0-100) and style tags. It holds
no images. Images are looked up, in order, in $OD_TASTE_SCREENS, the repo's git-ignored taste-screens/ folder
(the maintainers' copy) and the person's own cache ~/.opendesigner/taste-screens/. Screens without an image are
left out of the poll. Mobbin screens stay local: Mobbin's terms do not allow re-hosting them, so they are never
committed or published.

Adding screens: entries.json is a list of library entries plus "image_url". Each image is downloaded (the only
network use in this script, and only for this command) and kept as it is, credit bar included. The entry is added
to ~/.opendesigner/taste-extra.json (or, with --library, to the shared library and the repo's taste-screens/, for
maintainers).

The taste index (references/taste.md, "The taste index") lives in the project only: taste-profile.json beside state.json.
Its dial recommendations are printed with --set-by assumed: the person confirms them in the sketch.
Standard library only.
"""
from __future__ import annotations

import argparse, json, math, os, re, shutil, subprocess, sys, urllib.request, webbrowser
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKILL = HERE.parent
LIBRARY = SKILL / "assets" / "taste" / "library.json"
TEMPLATE = SKILL / "assets" / "templates" / "taste-poll.html"
HOME = Path(os.environ.get("OD_HOME", Path.home() / ".opendesigner"))
EXTRA = HOME / "taste-extra.json"
DIALS = ["expression", "brandPresence", "density", "energy", "roundness", "depth", "colorfulness", "warmth"]
KINDS = {"hero", "section", "dashboard", "table", "settings", "feed", "detail", "onboarding", "signup", "paywall",
         "pricing", "checkout", "empty", "profile", "player", "search", "chat", "map", "game", "editor"}
TAGS = {
    # style
    "bold colour", "big type", "flat", "3D", "illustration", "photography", "gradient", "glow", "glass", "dark", "neon",
    "pastel", "monochrome", "hairlines", "editorial", "serif", "condensed type", "mono type", "thick borders",
    "brutalist", "retro", "grain texture", "collage", "sticker", "mascot", "split layout", "card grid", "masonry",
    "bento", "full-bleed image", "product shot", "native", "dense", "airy", "sharp", "soft", "pill shapes",
    "chunky buttons",
    # mood
    "serious", "playful", "luxurious", "friendly", "technical", "creative", "calm", "energetic", "minimal", "maximal",
    "utilitarian", "cute"}
ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)+$")


def screen_dirs():
    dirs = []
    if os.environ.get("OD_TASTE_SCREENS"):
        dirs.append(Path(os.environ["OD_TASTE_SCREENS"]))
    for up in (SKILL.parent.parent, SKILL.parent.parent.parent):  # skills/opendesigner or .claude/skills/opendesigner
        if (up / "taste-screens").is_dir():
            dirs.append(up / "taste-screens")
            break
    dirs.append(HOME / "taste-screens")
    return dirs


def load(path):
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def library(extra=True):
    entries = load(LIBRARY)
    if extra:
        seen = {e["id"] for e in entries}
        entries += [e for e in load(EXTRA) if e.get("id") not in seen]
    return entries


def image_for(sid):
    for d in screen_dirs():
        p = d / f"{sid}.jpg"
        if p.exists():
            return p
    return None


def problems(entries):
    out, seen = [], set()
    for i, e in enumerate(entries):
        where = e.get("id") or f"entry {i}"
        if not ID_RE.match(str(e.get("id", ""))):
            out.append(f"{where}: id must be kind-app in lowercase with hyphens")
        if e.get("id") in seen:
            out.append(f"{where}: duplicate id")
        seen.add(e.get("id"))
        for f in ("app", "kind", "platform", "source"):
            if not e.get(f):
                out.append(f"{where}: missing {f}")
        if e.get("kind") and e["kind"] not in KINDS:
            out.append(f"{where}: unknown kind {e['kind']!r}")
        if e.get("platform") not in (None, "web", "ios", "android"):
            out.append(f"{where}: platform must be web, ios or android")
        d = e.get("d")
        if not (isinstance(d, list) and len(d) == 8 and all(isinstance(x, (int, float)) and 0 <= x <= 100 for x in d)):
            out.append(f"{where}: d must be 8 numbers from 0 to 100 ({', '.join(DIALS)})")
        bad = [t for t in e.get("tags", []) if t not in TAGS]
        if bad or not e.get("tags"):
            out.append(f"{where}: tags must be 1 or more from the vocabulary" + (f"; unknown: {bad}" if bad else ""))
        if e.get("source") == "mobbin" and not str(e.get("mobbin_url", "")).startswith("https://mobbin.com/"):
            out.append(f"{where}: a Mobbin screen needs its mobbin_url")
    return out


def coverage(entries, thin=6):
    rows, gaps = [], []
    for i, name in enumerate(DIALS):
        lo = sum(1 for e in entries if e["d"][i] < 25)
        mid = sum(1 for e in entries if 25 <= e["d"][i] <= 75)
        hi = sum(1 for e in entries if e["d"][i] > 75)
        rows.append((name, lo, mid, hi))
        if lo < thin:
            gaps.append(f"{name} low")
        if hi < thin:
            gaps.append(f"{name} high")
    kinds = {}
    for e in entries:
        kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
    return rows, kinds, gaps


# ---------------------------------------------------------------------------------------------
# The taste index: every taste signal in this project, on the eight dials (references/taste.md, "The taste index")
# ---------------------------------------------------------------------------------------------
SURE = 0.45   # at or above: offer the value as "confirm this?"; below: ask the dial directly
DRIFT = 20    # engine.py review flags a dial this far from a sure value
SIG = 18      # the poll page's kernel width, so the poll alone gives the same profile as its results card
# Strongest first: the person overriding a recommendation, a poll Cracked or I-hate-it, an inspiration, then feel words and
# a style pick. Our own guesses (assumed, auto_default, delegated) are never evidence, so the index cannot echo itself.
WEIGHTS = {"override": 8, "chosen": 5, "cracked": 3, "hate": -3, "best": 2, "crazy": 1, "okay": 0.25, "generic": -1,
           "inspiration": 2.5, "confirmed": 1.5, "style": 1.5, "feel": 1}
REF_CONFIDENCE = {"high": 1.0, "medium": 0.8, "low": 0.5}
REF_TAGS = {"inspiration": 1.0, "our-product": 0.5, "competitor": 0.0}  # their own product pulls at half; a competitor never
GUESSES = ("assumed", "auto_default", "delegated")
ENDS = {"expression": ("productive", "expressive"), "brandPresence": ("native", "brand-led"), "density": ("spacious", "compact"),
        "energy": ("calm", "energetic"), "roundness": ("sharp", "soft"), "depth": ("flat", "deep"),
        "colorfulness": ("mono", "vivid"), "warmth": ("cool", "warm")}


def _k(x):
    return math.exp(-(x * x) / (2 * SIG * SIG))


def solve(items):
    """(value, confidence) of one dial from its evidence, by the poll page's model: each item pulls (a negative weight pushes)
    around its value and the value is the strongest point. Confidence grows with the evidence, a clear peak and agreement
    among the strong items."""
    if not items:
        return 50, 0.0
    f = [0.5 * _k(v - 50) + sum(it["weight"] * _k(v - it["value"]) for it in items) for v in range(101)]
    best = max(range(101), key=f.__getitem__)
    hi, lo, mean = f[best], min(f), sum(f) / len(f)
    peak = (hi - mean) / (hi - lo) if hi - lo > 1e-6 else 0
    mass = sum(max(it["weight"], 0) + 0.3 * max(-it["weight"], 0) for it in items)
    liked = sum(it["weight"] for it in items if it["weight"] >= 1)
    loved = [it for it in items if it["weight"] >= 2]
    agree = 1.0
    if len(loved) > 1:
        w = sum(it["weight"] for it in loved)
        m = sum(it["weight"] * it["value"] for it in loved) / w
        agree = 1 - min(0.6, math.sqrt(sum(it["weight"] * (it["value"] - m) ** 2 for it in loved) / w) / 50)
    return best, max(0.0, min(0.9, (mass / 22) * (0.4 + 0.6 * peak) * agree * min(1, liked / 8)))


def read_poll(d):
    """The poll record in d/taste-profile.json: the page's own result, or the copy the index keeps under "poll"."""
    p = Path(d) / "taste-profile.json"
    rec = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    if "poll" in rec:
        return rec["poll"]
    return rec if isinstance(rec.get("dials"), dict) and rec.get("kind") != "taste-index" else None


def _how(entries):
    """How the latest decision on one path was made: override (chosen, unlike our last recommendation), chosen, confirmed
    (chosen as recommended, or confirmed_default) or None (our guess, a reference, an asset or a standard)."""
    last = entries[-1]
    if last["set_by"] == "confirmed_default":
        return "confirmed"
    if last["set_by"] != "chosen":
        return None
    rec = next((x for x in reversed(entries[:-1]) if x["set_by"] in GUESSES), None)
    return "chosen" if rec is None else "confirmed" if rec["value"] == last["value"] else "override"


def _look_dials(eng, state, look):
    """The dial values a style or preset (a Q-dir-01 answer) sets: the preset's, then the style's own on top."""
    presets = {p["id"]: p for p in eng.levers()["presets"]}
    s = eng.style_list(state).get(look)
    out = dict((presets.get(s.get("preset") if s else look) or {}).get("dials") or {})
    out.update((s or {}).get("dials") or {})
    return {k: v for k, v in out.items() if k in DIALS and isinstance(v, (int, float))}


def build_index(d, eng=None, state=None):
    """The taste index of the project whose opendesigner/ folder is d, from what is on disk now. eng is the engine module (its
    state, decisions and catalogues); without it only the poll counts. Each dial gets a value, a confidence (0 to 0.9; a dial
    the person decided is pinned at their value, 0.95) and its evidence, strongest first."""
    d = Path(d)
    poll = read_poll(d)
    if state is None and eng is not None and (d / "state.json").exists():
        state = eng.merge_defaults(eng.read_json(str(d / "state.json")))
    ev = {name: [] for name in DIALS}
    decided, counts = {}, {}

    def add(name, source, sid, kind, value, weight):
        ev[name].append({"source": source, "id": sid, "kind": kind, "value": round(value), "weight": round(weight, 2)})

    lib = {e["id"]: e for e in library()} if poll else {}
    rated = [(lib[sid], k) for sid, k in (poll or {}).get("ratings") or [] if sid in lib and k in WEIGHTS]
    for s, k in rated:
        for i, name in enumerate(DIALS):
            add(name, "poll", s["id"], k, s["d"][i], WEIGHTS[k])
    hated = [s for s, k in rated if k == "hate"]
    card = bool(poll) and not rated  # ratings of screens this machine's library lacks: the results card stands in
    for name in DIALS if card else ():
        rec = poll["dials"].get(name) or {}
        if rec.get("conf"):
            add(name, "poll", "results-card", "summary", rec["value"], 6 * rec["conf"])
    if poll:
        counts["poll"] = len(rated) if rated else poll.get("n") or 0
    if eng is not None and state is not None:
        by_path = {}
        for x in eng._decision_log(str(d)):
            if x["path"]:
                by_path.setdefault(x["path"], []).append(x)
        def history(path, rec):
            """The log entries behind a stored value; none when a later answer set it as one of its effects."""
            entries = by_path.get(path)
            return entries if entries and (not isinstance(rec, dict) or rec.get("decision") in (None, entries[-1]["id"])) else None

        for name in DIALS:
            rec = (state.get("dials") or {}).get(name)
            val, entries = eng.dial_value(rec), history(f"dials.{name}", rec)
            how = _how(entries) if entries else _how([rec]) if isinstance(rec, dict) and rec.get("set_by") else None
            if isinstance(val, (int, float)) and how:
                did = entries[-1]["id"] if entries else rec.get("decision") or "state"
                add(name, "decision", did, how, val, WEIGHTS[how])
                decided[name] = (did, round(val))
                counts["decision"] = counts.get("decision", 0) + 1
        ans = (state.get("answers") or {}).get("Q-dir-01")
        entries = history("answers.Q-dir-01", ans)
        how = _how(entries) if entries else _how([ans]) if isinstance(ans, dict) and ans.get("set_by") else None
        look = eng.answer_value(ans) if ans else None
        if isinstance(look, str) and how:
            for name, v in _look_dials(eng, state, look).items():
                add(name, "style", look, "override" if how == "override" else "style pick",
                    v, WEIGHTS["override"] if how == "override" else WEIGHTS["style"])
            counts["style"] = 1
        for rid, ref in sorted((state.get("references") or {}).items()):
            tag = ref.get("tag", "inspiration")
            for pr in ref.get("proposals") or []:
                name = str(pr.get("path", "")).removeprefix("dials.")
                if name in DIALS and str(pr.get("path")).startswith("dials.") and isinstance(pr.get("value"), (int, float)):
                    src = "taste-index" if ref.get("index") else "reference"  # a Taste Index (opendesigner-extract) counts as an inspiration
                    add(name, src, rid, tag, pr["value"],
                        WEIGHTS["inspiration"] * REF_CONFIDENCE.get(pr.get("confidence"), 0.8) * REF_TAGS.get(tag, 1.0))
                    counts[src] = counts.get(src, 0) + 1
        entries = by_path.get("macros")
        if not entries or entries[-1]["set_by"] not in GUESSES:
            table = {m["id"]: m for m in eng.levers()["macros"]}
            offsets = {}
            for mid, strength in eng._macro_list(state):
                for name, off in ((table.get(mid) or {}).get("offsets") or {}).items():
                    offsets[name] = offsets.get(name, 0) + off * strength
            words = ", ".join((state.get("taste") or {}).get("feelWords") or [m for m, _s in eng._macro_list(state)])
            for name, off in offsets.items():
                if name in DIALS:
                    add(name, "feel", words, "feel words", max(0, min(100, 50 + off)), WEIGHTS["feel"])
            counts["feel"] = 1 if offsets else 0
    dials = {}
    for name in DIALS:
        v, c = solve([x for x in ev[name] if x["weight"]])
        dials[name] = {"value": v, "conf": round(c, 2)}
        if name in decided:
            dials[name].update(value=decided[name][1], conf=0.95, decided=decided[name][0])
        dials[name]["evidence"] = sorted(ev[name], key=lambda x: -abs(x["weight"]))
    red = []
    for s in hated:  # the poll page's rule: far from the taste and far from the middle; one line per dial, first hated first
        for i, name in enumerate(DIALS):
            x, v = s["d"][i], dials[name]["value"]
            if abs(x - v) >= 30 and abs(x - 50) >= 30 and not any(r["dial"] == name for r in red):
                high = x > 50
                red.append({"dial": name, "side": "high" if high else "low", "value": x, "limit": x - 15 if high else x + 15,
                            "from": s["id"]})
    if card:
        red = [dict(r, limit=r["value"] - 15 if r["side"] == "high" else r["value"] + 15, **{"from": "results-card"})
               for r in poll.get("redLines") or []]
    red = [r for r in red if not (r["dial"] in decided and crossed({"redLines": [r]}, {r["dial"]: decided[r["dial"]][1]}))]
    poll = poll or {}
    return {"v": 2, "kind": "taste-index", "date": date.today().isoformat(), "dials": dials, "redLines": red,
            "genericAllergy": poll.get("genericAllergy"), "everyday": poll.get("everyday"), "hero": poll.get("hero"),
            "likes": poll.get("likes") or [], "dislikes": poll.get("dislikes") or [],
            "counts": {k: n for k, n in counts.items() if n}, "poll": poll or None}


def has_evidence(index):
    return bool(index and any(index["dials"][n]["evidence"] for n in DIALS))


def fit(index, dials):
    """How well dial values fit the index, 0 to 1, each dial weighted by how sure the index is; None when it is sure of none."""
    num = den = 0.0
    for name, v in (dials or {}).items():
        rec = (index.get("dials") or {}).get(name)
        if rec and rec.get("conf") and isinstance(v, (int, float)):
            num += rec["conf"] * abs(v - rec["value"])
            den += rec["conf"]
    return round(1 - num / (100 * den), 2) if den else None


def crossed(index, dials):
    """The red lines these dial values cross: as far out as a screen the person hated, give or take 15."""
    return [r for r in index.get("redLines") or [] if isinstance((dials or {}).get(r["dial"]), (int, float))
            and (dials[r["dial"]] >= r["limit"] if r["side"] == "high" else dials[r["dial"]] <= r["limit"])]


def sure(index):
    """True when the index is sure of at least one dial the person has not decided: only then does it order options."""
    return any(r["conf"] >= SURE and not r.get("decided") for r in (index.get("dials") or {}).values())


def shared(options):
    """The dials every option sets to the same value. They cannot tell the options apart."""
    sets = [o.get("dials") or {} for o in options]
    return {n for n in (sets[0] if sets else {})
            if all(isinstance(s.get(n), (int, float)) for s in sets) and len({s[n] for s in sets}) == 1}


def rank(index, options, keep=None):
    """(shown, left out, past): the options to show, each with "fit", best first when the index is sure of something;
    the options left out, each with "redLines"; and the shown options that are past a line only because leaving them out
    would leave nothing, each with "redLines" (empty unless every option is past one: the caller warns, naming the lines).
    A red line judges only the dials the options differ on: a dial they all share is the same whichever is picked, so it is
    drift for `engine.py review`, never a reason to hide a choice. keep (the person's current answer) stays in even past a
    line: it is theirs, not an offer."""
    same = shared(options)
    hits = [[r for r in crossed(index, o.get("dials")) if r["dial"] not in same] for o in options]
    hide = [bool(h) and (keep is None or str(o.get("value")) != str(keep)) for o, h in zip(options, hits)]
    every = bool(options) and all(hide)  # then show them all with a warning, never an empty list
    kept, out = [], []
    for o, h, x in zip(options, hits, hide):
        if x and not every:
            out.append(dict(o, redLines=h))
            continue
        f = fit(index, o.get("dials"))
        o = o if f is None else dict(o, fit=f)
        kept.append(dict(o, redLines=h) if x else o)
    if sure(index):  # feel words alone are too weak to reorder what the person sees
        kept.sort(key=lambda o: (o.get("fit") is None, -(o.get("fit") or 0)))
    return kept, out, (kept if every else [])


def past_text(options, plain=True):
    """'Glass (too deep, too soft); Flat 2.0 (too mono)': each option with the red lines it crosses."""
    return "; ".join(f"{o.get('label') or o.get('value')} ({', '.join(line_text(r, plain) for r in o['redLines'])})"
                     for o in options)


def line_text(r, plain=False):
    """A red line in words: 'too deep (depth 70 or more)', or with plain just 'too deep'."""
    words = f"too {ENDS[r['dial']][1 if r['side'] == 'high' else 0]}"
    return words if plain else f"{words} ({r['dial']} {r['limit']} or {'more' if r['side'] == 'high' else 'less'})"


def drift(index, dials):
    """Dials of the built system that left the taste: far from a value the index is sure of (and the person did not decide),
    or past a red line."""
    out = []
    for name in DIALS:
        rec, v = index["dials"].get(name) or {}, (dials or {}).get(name)
        if not isinstance(v, (int, float)):
            continue
        lines = crossed(index, {name: v})
        far = rec.get("conf", 0) >= SURE and not rec.get("decided") and abs(v - rec["value"]) >= DRIFT
        if far or lines:
            out.append({"dial": name, "system": round(v), "taste": rec.get("value"), "conf": rec.get("conf"),
                        "sources": sources_text(rec), "redLines": lines})
    return out


def sources_text(rec):
    """'22 poll ratings, reference acme, style glass': where a dial's value comes from, strongest kinds first."""
    by = {}
    for x in rec.get("evidence") or []:
        if x["weight"]:
            by.setdefault(x["source"], []).append(x["id"])
    parts = []
    for src, ids in by.items():
        ids = list(dict.fromkeys(ids))
        parts.append(f"{len(ids)} poll rating{'s' if len(ids) != 1 else ''}" if src == "poll" and ids != ["results-card"]
                     else f"{src} {', '.join(ids)}" if src != "decision" else f"your decision {', '.join(ids)}")
    return ", ".join(parts)


def write_index(d, eng=None):
    index = build_index(d, eng)
    if has_evidence(index):
        (Path(d) / "taste-profile.json").write_text(json.dumps(index, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return index


def offer(index):
    """What to do with each dial: confirm a sure one, ask an unsure one, leave a decided one; and the red lines."""
    rows = [(n, index["dials"][n]) for n in DIALS]
    sure = [(n, r) for n, r in rows if not r.get("decided") and r["conf"] >= SURE]
    unsure = [(n, r) for n, r in rows if not r.get("decided") and r["conf"] < SURE]
    done = [(n, r) for n, r in rows if r.get("decided")]
    lines = []
    if sure:
        lines.append('Offer each sure dial as "confirm this?": set it as assumed now; it becomes chosen when they say yes.')
        lines += [f"  python3 engine.py set dials.{n} {r['value']} --set-by assumed "
                  f"--why \"taste index: {round(r['conf'] * 100)}% sure ({sources_text(r)})\"" for n, r in sure]
    if unsure:
        lines.append("Ask directly (the index is unsure; its value can still be the recommended option): "
                     + ", ".join(f"{n} {r['value']}" for n, r in unsure))
    if done:
        lines.append("Decided by the person, so nothing to ask: " + ", ".join(f"{n} {r['value']} ({r['decided']})" for n, r in done))
    if index["redLines"]:
        lines.append("Red lines (leave out an option past one, unless every option is; taste.md \"Using it\"): "
                     + "; ".join(f"{line_text(r)}, like {r['from']}" for r in index["redLines"]))
    return lines


def _engine():
    import engine  # scripts/engine.py, beside this file
    return engine


def cmd_index(a):
    index = write_index(a.dir, _engine())
    if not has_evidence(index):
        sys.exit("No taste evidence yet. Run the poll (taste.py build), add an inspiration (opendesigner-extract), "
                 "or answer the feel question; then run this again.")
    if a.json:
        print(json.dumps(index, indent=1, ensure_ascii=False))
        return
    print(f"wrote {Path(a.dir) / 'taste-profile.json'} ("
          + ", ".join(f"{n} {k}" for k, n in index["counts"].items()) + ")")
    print("\n".join(offer(index)))


def cmd_fit(a):
    text = sys.stdin.read() if a.options == "-" else Path(a.options).read_text(encoding="utf-8")
    data = json.loads(text)
    index = build_index(a.dir, _engine())
    if not has_evidence(index):
        sys.exit("No taste evidence yet, so there is nothing to order by. Show the options as they are.")
    payload = data if isinstance(data, dict) else {"options": data}
    payload["options"], left, past = rank(index, payload.get("options") or [])
    payload["leftOut"] = [{"value": o.get("value"), "label": o.get("label"), "why": "; ".join(line_text(r) for r in o["redLines"])}
                          for o in left]
    if past:
        payload["warning"] = ("Every option is past a red line, so none is left out. Tell the person before they pick: "
                              + past_text(past, plain=False) + ".")
    shown = [str(o.get("value")) for o in payload["options"]]
    if "recommended" in payload and shown and str(payload["recommended"]) not in shown:
        payload["recommended"] = payload["options"][0].get("value")  # never recommend an option that was left out
    print(json.dumps(payload, indent=1, ensure_ascii=False))


def cmd_coverage(a):
    entries = library()
    have = [e for e in entries if image_for(e["id"])]
    rows, kinds, gaps = coverage(have)
    print(f"{len(entries)} screens in the library, {len(have)} with an image on this machine\n")
    print(f"{'dial':<14}{'low <25':>9}{'middle':>9}{'high >75':>10}")
    for name, lo, mid, hi in rows:
        print(f"{name:<14}{lo:>9}{mid:>9}{hi:>10}")
    print("\nkinds: " + ", ".join(f"{k} {n}" for k, n in sorted(kinds.items(), key=lambda x: -x[1])))
    print("thin (fewer than 6 screens): " + (", ".join(gaps) if gaps else "none"))


def cmd_check(a):
    entries = library(extra=False)
    errs = problems(entries)
    for e in errs:
        print("error:", e)
    missing = [e["id"] for e in entries if not image_for(e["id"])]
    print(f"{len(entries)} screens, {len(errs)} errors, {len(missing)} without an image on this machine")
    sys.exit(1 if errs else 0)


def cmd_build(a):
    entries = [e for e in library() if image_for(e["id"])]
    if not entries:
        sys.exit("No screen images found. Looked in: " + ", ".join(str(d) for d in screen_dirs())
                 + ". Fetch some with Mobbin and `taste.py add`, or set OD_TASTE_SCREENS.")
    out = Path(a.out)
    (out / "img").mkdir(parents=True, exist_ok=True)
    screens = []
    for e in entries:
        src = image_for(e["id"])
        dst = out / "img" / f"{e['id']}.jpg"
        if not dst.exists() or dst.stat().st_size != src.stat().st_size:
            shutil.copyfile(src, dst)
        screens.append({"id": e["id"], "app": e["app"], "kind": e["kind"], "platform": e["platform"],
                        "mobbin_url": e.get("mobbin_url", ""), "src": f"img/{e['id']}.jpg", "d": e["d"],
                        "tags": e["tags"], "common": bool(e.get("common"))})
    data = {"project": a.project or "", "min": a.min, "max": a.max, "screens": screens}
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    html, n = re.subn(r'(<script type="application/json" id="od-data">).*?(</script>)',
                      lambda m: m.group(1) + "\n" + blob + "\n" + m.group(2),
                      TEMPLATE.read_text(encoding="utf-8"), count=1, flags=re.S)
    if n != 1:
        sys.exit("template has no od-data block")
    page = out / "index.html"
    page.write_text(html, encoding="utf-8")
    print(f"{page}  ({len(screens)} screens)")
    if a.open:
        webbrowser.open(page.resolve().as_uri())


def cmd_add(a):
    new = json.loads(Path(a.entries).read_text(encoding="utf-8"))
    new = new if isinstance(new, list) else [new]
    target = LIBRARY if a.library else EXTRA
    folder = (SKILL.parent.parent / "taste-screens") if a.library else HOME / "taste-screens"
    folder.mkdir(parents=True, exist_ok=True)
    current = load(target)
    have = {e["id"] for e in library()}
    added = 0
    for e in new:
        url = e.pop("image_url", None)
        e.setdefault("source", "mobbin" if "mobbin.com" in str(e.get("mobbin_url", "")) else "web")
        errs = problems([e])
        if errs or e["id"] in have:
            print("skipped:", "; ".join(errs) or f"{e['id']} is already in the library")
            continue
        dest = folder / f"{e['id']}.jpg"
        if url and not dest.exists():
            urllib.request.urlretrieve(url, dest)
        current.append(e)
        have.add(e["id"])
        added += 1
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(current, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"added {added} screen(s) to {target}")


def cmd_import(a):
    text = sys.stdin.read() if a.file in (None, "-") else Path(a.file).read_text(encoding="utf-8")
    m = re.search(r"OD:set taste\.poll=(\{.*\})", text)
    if m:
        rec = json.loads(m.group(1))
    else:
        rec = json.loads(text)  # the saved taste-profile.json
        rec = rec.get("poll") or rec  # a taste index keeps the poll under "poll"
    if not isinstance(rec.get("dials"), dict):
        sys.exit("no taste poll result found")
    od = Path(a.dir)
    od.mkdir(parents=True, exist_ok=True)
    (od / "taste-profile.json").write_text(json.dumps(rec, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    summary = {k: v for k, v in rec.items() if k != "ratings"}
    if (od / "state.json").exists():
        engine = [sys.executable, str(HERE / "engine.py")]
        subprocess.run(engine + ["set", "taste.poll", json.dumps(summary), "--set-by", "chosen",
                                 "--why", f"taste poll, {rec.get('n')} screens rated"], cwd=od.parent, check=False)
    index = write_index(od, _engine())  # the poll joins the person's decisions, inspirations and feel words
    print(f"wrote {od / 'taste-profile.json'} (" + ", ".join(f"{n} {k}" for k, n in index["counts"].items()) + ")\n")
    print("\n".join(offer(index)))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("build")
    b.add_argument("--project", default="")
    b.add_argument("--out", default="opendesigner/preview/taste-poll")
    b.add_argument("--min", type=int, default=20)
    b.add_argument("--max", type=int, default=30)
    b.add_argument("--open", action="store_true")
    sub.add_parser("coverage")
    sub.add_parser("check")
    ad = sub.add_parser("add")
    ad.add_argument("entries")
    ad.add_argument("--library", action="store_true", help="maintainers: add to the shared library")
    im = sub.add_parser("import")
    im.add_argument("file", nargs="?")
    im.add_argument("--dir", default="opendesigner")
    ix = sub.add_parser("index")
    ix.add_argument("--dir", default="opendesigner")
    ix.add_argument("--json", action="store_true")
    ft = sub.add_parser("fit")
    ft.add_argument("options", help="JSON file or -: a list of options, each with dials, or an option-gallery payload")
    ft.add_argument("--dir", default="opendesigner")
    a = ap.parse_args()
    {"build": cmd_build, "coverage": cmd_coverage, "check": cmd_check, "add": cmd_add, "import": cmd_import,
     "index": cmd_index, "fit": cmd_fit}[a.cmd](a)


if __name__ == "__main__":
    main()
